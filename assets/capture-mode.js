/* Uses the standard maze, controls, professions, pickups and room transport. */
(function(){
  'use strict';
  let state=null,view=null,hostId='',lastSend=0,lastHost=0,lastRev=-1,clockOffset=0,finished=false;
  let root=null,flag=null,hud=null,relay=null,applied={},simClock=0,mazeRound=0,scored=new Set(),pulse=null,lastSim=0,lastDriven=-Infinity;
  const colors=[0x57cfff,0xffad65],names=['蒼藍隊','琥珀隊'];
  const on=()=>MP.on&&MP.mode==='ctf'&&MP.started&&!MP.ended;
  // Snapshot counters come from another device; only finite, bounded integers reach the result HTML.
  const count=value=>Math.max(0,Math.min(1e6,Math.round(Number(value)||0)));
  function spawnCell(index,size){return {x:index%2?size-1:0,y:Math.min(size-1,Math.floor(index/2)*2)};}
  function positions(){return Object.fromEntries(MP.roster.filter(r=>!MP.outs[r.id]).map(r=>[r.id,botPosOf(r.id)]).filter(([,p])=>p));}
  // One segment-vs-box test per wall (no sampling along the line).
  function clear(a,b){return !!a&&!!b&&(!window.GameplayRules||window.GameplayRules.clear(a,b,G.wallBoxes));}
  function ensureUI(){
    if(hud)return;
    hud=document.createElement('div');hud.id='captureHud';hud.setAttribute('role','status');$('gameScreen').appendChild(hud);
    relay=document.createElement('button');relay.id='captureRelay';relay.textContent='接力傳旗 R';relay.hidden=true;$('gameScreen').appendChild(relay);bindActionBtn(relay,pass);
    window.addEventListener('keydown',e=>{if(e.code==='KeyR'&&on()&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();pass();}});
  }
  function start(owner){
    stop();ensureUI();hostId=owner;lastHost=performance.now();finished=false;applied={};lastRev=-1;lastSend=0;clockOffset=0;
    const mid=G.mazeW>>1,center=cellToWorld(mid,mid),bases=[cellToWorld(0,0),cellToWorld(G.mazeW-1,0)];
    state=MP.host?CaptureCore.create(MP.roster,center,bases,Date.now(),(matchRules().duelMin||5)*60000):null;
    if(state){state.walls=[];state.mazeRound=MP.round;}scored=new Set();
    view=state?JSON.parse(JSON.stringify(state)):CaptureCore.create(MP.roster,center,bases,Date.now());
    mazeRound=MP.round;root=new THREE.Group();scene.add(root);
    bases.forEach((p,i)=>{
      const platform=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.85,.16,24),new THREE.MeshLambertMaterial({color:colors[i]}));platform.position.set(p.x,.08,p.z);root.add(platform);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.09,6,32),new THREE.MeshBasicMaterial({color:colors[i]}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.25,p.z);root.add(ring);
      const label=makeTextSprite(names[i]+'基地');label.position.set(p.x,3.5,p.z);root.add(label);
    });
    flag=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,2.2,6),new THREE.MeshLambertMaterial({color:0xffe7af}));pole.position.y=1.1;flag.add(pole);
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(1.05,0);shape.lineTo(.78,-.4);shape.lineTo(1.05,-.8);shape.lineTo(0,-.8);shape.closePath();
    const cloth=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xffd45a,side:THREE.DoubleSide}));cloth.position.y=2.2;flag.add(cloth);root.add(flag);
    for(const [id,m] of Object.entries(view.members)){
      const model=id===MP.id?playerGroup:MP.players[id]?.mesh;if(!model)continue;
      const band=new THREE.Mesh(new THREE.TorusGeometry(.64,.065,5,20),new THREE.MeshBasicMaterial({color:colors[m.team]}));band.rotation.x=Math.PI/2;band.position.y=.08;model.add(band);
      const label=makeTextSprite(names[m.team]);label.position.y=3.2;model.add(label);
    }
    hud.hidden=false;showToast('中央搶旗 → 送到敵方基地守住 3 秒。靠近隊友按 R 接力！',5500);updateAtkBtn();
    lastSim=performance.now()-100;
    // Browsers suspend requestAnimationFrame in background tabs; the room must still publish liveness.
    // While the render loop is driving frames the timer has nothing to add.
    if(MP.host)pulse=setInterval(()=>{if(performance.now()-lastDriven<250)return;step(.1,performance.now());},100);
  }
  function broadcast(now){
    if(!state)return;
    if(now-lastSend<200)return;
    if(state.rev===lastRev&&now-lastSend<1000)return;
    lastRev=state.rev;lastSend=now;
    const message={t:'ctfstate',state,at:Date.now(),f:MP.id};
    handle(message); // The host must not wait for its own broker echo to apply hits or wins.
    mpSend(message);
  }
  function handle(m){
    if(!on())return;
    if(m.t==='ctfstate'){
      if(m.f!==hostId||!m.state||!Number.isFinite(m.at))return;
      if(view&&m.state.rev<view.rev)return;
      // Roster and geometry originate in the start packet, never a later snapshot.
      if(Object.keys(m.state.members||{}).join('|')!==MP.roster.map(r=>r.id).join('|'))return;
      view=JSON.parse(JSON.stringify(m.state));clockOffset=m.at-Date.now();lastHost=performance.now();
      if(view.mazeRound===MP.round&&!G.shifting)for(const w of view.walls||[]){const wb=G.wallBoxes.find(b=>!b.boundary&&b.type===w.type&&b.gx===w.gx&&b.gy===w.gy);if(wb)removeWallBox(wb,true);}
      for(const [id,member] of Object.entries(view.members))if(member.respawn>(applied[id]||0)){
        AudioEng.sfxHit(); // Only a newly confirmed hit, never a repeated snapshot.
        applied[id]=member.respawn;const cell=spawnCell(MP.order.indexOf(id),G.mazeW),p=cellToWorld(cell.x,cell.y);
        const remaining=Math.max(0,member.stun-(Date.now()+clockOffset));
        if(id===MP.id){G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);applyStun(id,remaining);showToast('受擊掉旗，回基地休整；恢復後有 3 秒保護');}
        else{const remote=MP.players[id];if(remote){remote.tx=p.x;remote.tz=p.z;remote.mesh.position.set(p.x,0,p.z);}applyStun(id,remaining);}
        if(MP.host){const b=MP.bots?.find(b=>b.id===id);if(b){b.x=p.x;b.z=p.z;b.path=null;}}
      }
      if(view.winner!==null&&!finished)end();
    }else if(MP.host&&state&&m.t==='ctfwall'){
      if(m.round!==MP.round||!state.members[m.f]||state.members[m.f].offline||G.shifting)return;
      const w=m.wall;if(!w||!['h','v'].includes(w.type)||!Number.isInteger(w.gx)||!Number.isInteger(w.gy)||w.gx<0||w.gy<0||w.gx>=G.mazeW-(w.type==='v'?1:0)||w.gy>=G.mazeH-(w.type==='h'?1:0))return;
      const p=cellToWorld(w.gx,w.gy);if(w.type==='h')p.z+=G.cell/2;else p.x+=G.cell/2;
      if(!CaptureCore.near(botPosOf(m.f),p,6))return;
      if(!state.walls.some(b=>b.type===w.type&&b.gx===w.gx&&b.gy===w.gy)){state.walls.push(w);state.rev++;broadcast(performance.now());}
    }else if(MP.host&&state&&(m.t==='ctfattack'||m.t==='ctfpass')){
      if(!state.members[m.f]||!state.members[m.to])return;
      const p=positions(),changed=m.t==='ctfattack'?CaptureCore.attack(state,m.f,m.to,p,Date.now(),clear):CaptureCore.pass(state,m.f,m.to,p,Date.now(),clear);
      if(changed)broadcast(performance.now());
    }
  }
  function target(friend,range){
    if(!view)return null;const team=view.members[MP.id]?.team;
    return MP.roster.filter(r=>r.id!==MP.id&&(view.members[r.id].team===team)===friend&&!view.members[r.id].offline).map(r=>({id:r.id,p:botPosOf(r.id)})).filter(r=>r.p&&CaptureCore.near({x:G.px,z:G.pz},r.p,range)&&clear({x:G.px,z:G.pz},r.p)).sort((a,b)=>Math.hypot(a.p.x-G.px,a.p.z-G.pz)-Math.hypot(b.p.x-G.px,b.p.z-G.pz))[0]?.id;
  }
  function attack(){if(!on()||G.frozen||performance.now()<G.stunnedUntil||performance.now()<G.atkCoolUntil)return;G.atkCoolUntil=performance.now()+1800;swingWeapon();const to=target(false,2.4);if(to)mpSend({t:'ctfattack',to});else showToast('靠近敵隊才能擊退；隊友不會被誤傷');}
  function pass(){if(!on()||view?.flag.holder!==MP.id||G.frozen||performance.now()<G.stunnedUntil)return;const to=target(true,6);if(to)mpSend({t:'ctfpass',to});else showToast('需要 6 公尺內、沒有牆阻擋的隊友');}
  function frame(dt,now){lastDriven=performance.now();step(dt,now);}
  function step(dt,now){
    if(!on()||!view)return;
    if(MP.host&&state){CaptureCore.timeout(state,Date.now());if(state.winner!==null){broadcast(now);return;}}
    // The room pulse also proves the host is alive; only give up when both have gone quiet.
    if(!MP.host&&now-Math.max(lastHost,window.RoomLifecycle?.hostSeenAt?.()||0)>12000){abort('房主連線中斷，本輪不計分');return;}
    if(MP.host&&state&&G.shifting&&state.channel){state.channel=null;state.rev++;}
    if(MP.host&&state&&G.shifting)broadcast(now);
    if(MP.host&&state&&!G.shifting&&now-lastSim>=40){
      dt=Math.min(.1,Math.max(0,(now-lastSim)/1000));lastSim=now;
      if(mazeRound!==MP.round){mazeRound=MP.round;state.walls=[];state.mazeRound=MP.round;state.rev++;if(!state.flag.holder){const c=worldToCell(state.flag.x,state.flag.z),p=cellToWorld(c.x,c.y);state.flag.x=p.x;state.flag.z=p.z;}}
      simClock+=dt;
      if(simClock>=.1){simClock=0;const stamp=Date.now();
        for(const r of MP.roster){if(r.id!==MP.id&&!r.bot&&now-(MP.players[r.id]?.lastSeen||0)>10000)CaptureCore.disconnect(state,r.id,positions(),stamp);}
        CaptureCore.tick(state,positions(),stamp,clear);
      }
      for(const b of MP.bots||[]){
        const me=state.members[b.id];if(me.offline||Date.now()<me.stun)continue;
        const holder=state.flag.holder,carrier=holder&&botPosOf(holder),ally=holder&&state.members[holder].team===me.team;
        let goal=holder===b.id?state.bases[1-me.team]:carrier||state.flag;
        // Teammates alternate escort and pressure on the enemy base, avoiding a single-file pileup.
        if(ally&&holder!==b.id&&MP.order.indexOf(b.id)%4>=2)goal=state.bases[1-me.team];
        const cell=worldToCell(goal.x,goal.z);botWalk(b,cell,'flag'+cell.x+','+cell.y,dt,now,(holder===b.id?.82:1)*(CHARS[b.charIdx]?.speedBonus||1));
        if(now>=(b.ctfScanAt||0)){b.ctfScanAt=now+200;const locations=positions();for(const r of MP.roster)if(state.members[r.id].team!==me.team&&CaptureCore.attack(state,b.id,r.id,locations,Date.now(),clear))break;}
      }
      broadcast(now);
    }
    const f=view.flag,p=f.holder?botPosOf(f.holder):f;if(p){flag.position.set(p.x,f.holder?2.2:.25+Math.sin(now*.003)*.1,p.z);flag.rotation.y=now*.001;}
    const my=view.members[MP.id],carrier=f.holder?mpName(f.holder):'中央／掉落位置';
    // The render loop also writes this clock, so compare with the element itself before writing.
    if(Number.isFinite(view.deadline)){const clock=$('hudTime'),text=(view.overtime?'延長 ':'')+fmtTime(Math.max(0,(view.deadline-Date.now()-clockOffset)/1000));if(clock.textContent!==text)clock.textContent=text;}
    const channel=view.channel?Math.max(0,3-(Date.now()+clockOffset-view.channel.since)/1000).toFixed(1):null;
    const line=names[my.team]+' · '+(channel?'基地佔領 '+channel+' 秒':f.holder===MP.id?'持旗中 · 前往'+names[1-my.team]+'基地':f.holder?carrier+' 持旗':'搶取金色旗幟')+' · 敵人在基地內會中斷佔領';
    if(hud.textContent!==line)hud.textContent=line;
    const relayHidden=f.holder!==MP.id||G.frozen||now<G.stunnedUntil;if(relay.hidden!==relayHidden)relay.hidden=relayHidden;
    playerGroup.userData.mood=now<G.stunnedUntil?'hurt':f.holder===MP.id?'focus':'calm';
  }
  function end(){
    clearInterval(pulse);pulse=null;
    finished=true;MP.ended=true;G.frozen=true;AudioEng.stopMusic();AudioEng.stopItemLoop();relay.hidden=true;hud.hidden=true;
    const won=view.winner;won===view.members[MP.id].team?AudioEng.sfxWin():AudioEng.sfxLose();
    const results=MP.roster.map(r=>({...r,win:view.members[r.id].team===won,points:count(view.members[r.id].points)}));
    const teamSummary=names.map((name,team)=>{const members=MP.roster.filter(r=>view.members[r.id].team===team),wins=(SERIES.stats[members[0].id]?.wins||0)+(team===won?1:0),points=members.reduce((sum,r)=>sum+count(SERIES.stats[r.id]?.points)+count(view.members[r.id].points),0);return '<strong>'+name+'：'+wins+' 勝／'+points+' 分</strong>';}).join(' · ');
    const details='<p>'+teamSummary+'</p>'+MP.roster.map(r=>{const m=view.members[r.id];return '<div>'+names[m.team]+' · '+escapeHtml(r.name)+' — 擊退 '+count(m.hits)+'／接力 '+count(m.passes)+'／'+count(m.points)+' 分</div>';}).join('');
    showMPResults(won===-1?'奪旗平手｜時間到':names[won]+'奪旗成功',details,results);updateAtkBtn();
    // The host's final snapshot is the round result: repeat it once a second until the next
    // round starts (at most a minute), so a guest that lost the winning packet still ends.
    if(MP.host&&state){const final={t:'ctfstate',state:JSON.parse(JSON.stringify(state)),f:MP.id,sr:MP.seriesRound};let left=60;
      pulse=setInterval(()=>{if(--left<0||!MP.on){clearInterval(pulse);pulse=null;return;}mpSend({...final,at:Date.now()});},1000);}
  }
  function abort(message){clearInterval(pulse);pulse=null;finished=true;MP.ended=true;MP.started=false;G.running=false;G.frozen=true;hud.hidden=true;relay.hidden=true;AudioEng.stopMusic();$('mpResultTitle').textContent='合作賽中止';$('mpResultBody').textContent=message;$('mpSeriesState').textContent='保留先前完成的輪次；請返回選單重新組隊。';$('mpSeriesSummary').innerHTML=seriesSummaryHtml();$('mpNextRound').style.display='none';$('mpResult').style.display='flex';}
  function leave(id){if(!on())return;if(id===hostId){abort('房主已離開，本輪不計分');return;}if(state){CaptureCore.disconnect(state,id,positions(),Date.now());broadcast(performance.now());}}
  function stop(){clearInterval(pulse);pulse=null;if(root){scene.remove(root);disposeSceneObject(root);}root=flag=null;state=view=null;simClock=0;if(hud)hud.hidden=true;if(relay)relay.hidden=true;}
  function speed(){return on()&&view?.flag.holder===MP.id ? .82 : 1;}
  function wall(wb){if(on()&&!wb.boundary)mpSend({t:'ctfwall',round:MP.round,wall:{type:wb.type,gx:wb.gx,gy:wb.gy}});}
  function collect(m){
    if(!on()||!state||m.round!==MP.round||m.kind!=='item'||!state.members[m.f])return;
    const item=G.items[m.i],key=MP.round+':'+m.i,points={star:100,timegem:150}[item?.type.id];
    if(points&&!scored.has(key)&&CaptureCore.near(botPosOf(m.f),item,3.2)){scored.add(key);state.members[m.f].points+=points;state.rev++;broadcast(performance.now());}
  }
  function goal(){if(!view)return G.exitCell;const f=view.flag,p=f.holder===MP.id?view.bases[1-view.members[MP.id].team]:f.holder?botPosOf(f.holder):f;return p?worldToCell(p.x,p.z):G.exitCell;}
  function map(ctx,big,pad,cw,ch){
    if(!on()||!view)return;
    const point=p=>({x:pad+(p.x/G.cell+(G.mazeW-1)/2+.5)*cw,y:pad+(p.z/G.cell+(G.mazeH-1)/2+.5)*ch});
    ctx.save();ctx.textAlign='center';ctx.font='bold '+(big?18:10)+'px sans-serif';
    view.bases.forEach((b,i)=>{const p=point(b);ctx.fillStyle=i?'#ffad65':'#57cfff';ctx.fillRect(p.x-5,p.y-5,10,10);if(big)ctx.fillText(names[i],p.x,p.y+24);});
    for(const r of MP.roster){if(view.members[r.id].team!==view.members[MP.id].team||view.members[r.id].offline)continue;const p=botPosOf(r.id);if(!p)continue;const v=point(p);ctx.fillStyle=colors[view.members[r.id].team]===colors[0]?'#57cfff':'#ffad65';ctx.beginPath();ctx.arc(v.x,v.y,big?5:3,0,Math.PI*2);ctx.fill();}
    const f=view.flag,p=f.holder?botPosOf(f.holder):f;if(p){const v=point(p);ctx.fillStyle='#ffdf76';ctx.fillText('旗',v.x,v.y-6);}
    ctx.restore();
  }
  window.CaptureFlag={start,spawnCell,handle,frame,attack,pass,leave,stop,speed,map,goal,wall,collect,view:()=>view};
})();
