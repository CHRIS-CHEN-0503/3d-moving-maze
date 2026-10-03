/* Small opt-in objectives reuse the maze, collision/pathfinding and existing room transport. */
(function(){
  'use strict';const C=ModeVariantsCore;
  let state=null,key='',layout=-1,root=null,hud=null,caption=null,fill=null,lastSync=0,lastRev=-1,offset=0,soloSeed=0,gates=[],noticeAt=0,lastLayout=0;
  const mode=()=>MP.on?MP.mode:'classic',id=()=>MP.on?MP.id:'solo',ids=()=>MP.on?MP.roster.map(r=>r.id):['solo'];
  const active=()=>G.running&&!(window.TowerMode?.active)&&C.enabled(mode(),matchRules())&&(!MP.on||MP.started);
  const authoritative=()=>!MP.on||MP.host;
  function dispose(){if(root){scene.remove(root);disposeSceneObject(root);root=null;}if(hud)hud.hidden=true;gates=[];}
  function reset(){dispose();state=null;key='';layout=-1;lastSync=lastRev=offset=0;soloSeed=0;}
  function ensure(){
    if(!active())return false;const epoch=MP.on?[MP.seed,MP.seriesRound,MP.mode].join(':'):'solo:'+G.startTime;
    if(epoch!==key){reset();key=epoch;soloSeed=MP.on?MP.seed:(Math.floor(G.startTime)^0x1a2c93)>>>0;
      const m=mode(),cells=C.cells(soloSeed,G.mazeW,G.mazeH,m==='race'&&G.startCells?.length?18:m==='race'||m==='classic'?1:2,[...(G.startCells||[{x:0,y:0}]),G.exitCell]);
      if(m==='race'&&G.startCells?.length){
        // Prefer a seeded landmark whose full start→landmark→exit routes are balanced.
        const spread=p=>{const tail=solveMaze(p.x,p.y,G.exitCell.x,G.exitCell.y).length,dist=G.startCells.map(s=>solveMaze(s.x,s.y,p.x,p.y).length+tail);return (Math.max(...dist)-Math.min(...dist))/Math.max(1,Math.min(...dist));};
        cells.sort((a,b)=>spread(a)-spread(b));cells.splice(1);
      }
      if(m==='ctf'){cells[0]={x:1,y:G.mazeH>>1};cells[1]={x:G.mazeW-2,y:G.mazeH>>1};}
      state=C.create(m,soloSeed,epoch,cells.map(c=>({...cellToWorld(c.x,c.y),cx:c.x,cy:c.y})),ids());
    }
    const round=MP.on?MP.round:0;if(layout!==round&&!G.shifting){layout=round;buildMarkers();}return true;
  }
  function buildMarkers(){
    dispose();if(!state||mode()==='shop')return;
    root=new THREE.Group();root.name='mode-variant-markers';scene.add(root);
    const labels={race:['中途地標'],classic:['中途地標'],treasure:['封印甲','封印乙'],ctf:['蒼藍側翼','琥珀側翼'],tag:['安全鐘甲','安全鐘乙']};
    state.points.forEach((p,i)=>{
      const color=mode()==='ctf'?(i?0xffad65:0x57cfff):0xffd778;
      const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.65,.9,.2,12),new THREE.MeshLambertMaterial({color}));pedestal.position.set(p.x,.1,p.z);root.add(pedestal);
      const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.32),new THREE.MeshBasicMaterial({color}));beacon.position.set(p.x,1.5,p.z);root.add(beacon);
      const label=makeTextSprite(labels[mode()]?.[i]||'地標');label.scale.multiplyScalar(.4);label.position.set(p.x,2.6,p.z);root.add(label);
      if(mode()==='ctf'){
        const wall=G.wallBoxes.filter(w=>!w.boundary).sort((a,b)=>Math.hypot((a.minX+a.maxX)/2-p.x,(a.minZ+a.maxZ)/2-p.z)-Math.hypot((b.minX+b.maxX)/2-p.x,(b.minZ+b.maxZ)/2-p.z)).find(w=>!gates.some(g=>g.type===w.type&&g.gx===w.gx&&g.gy===w.gy));
        if(wall)gates.push({...wall,team:i,open:false});
      }
    });
    if(!hud){hud=document.createElement('div');hud.id='modeObjective';hud.setAttribute('role','status');hud.style.cssText='position:absolute;right:150px;top:94px;max-width:44vw;font-size:12px;background:#122538dc;color:#ffe6a3;border:1px solid #937b47;border-radius:9px;padding:5px 9px;pointer-events:none;z-index:15';caption=document.createElement('span');fill=document.createElement('div');fill.style.cssText='height:3px;background:#ffd778;transform-origin:left;margin-top:4px';hud.appendChild(caption);hud.appendChild(fill);$('gameScreen').appendChild(hud);}
  }
  function position(actor){const remote=MP.host&&actor!==MP.id&&!MP.bots?.some(b=>b.id===actor)&&MP.players?.[actor];return remote&&Number.isFinite(remote.tx)&&Number.isFinite(remote.tz)?{x:remote.tx,z:remote.tz}:botPosOf(actor);}
  function positions(){return Object.fromEntries(ids().map(actor=>[actor,MP.on?position(actor):{x:G.px,z:G.pz}]).filter(([,p])=>p));}
  function context(){const now=performance.now(),view=window.CaptureFlag?.view?.();return {shifting:G.shifting||G.frozen,ended:MP.on&&MP.ended,holder:MP.treasure?.holder,ghost:MP.taggedId,outs:MP.on?MP.outs||{}:{},teams:Object.fromEntries(Object.entries(view?.members||{}).map(([actor,m])=>[actor,m.team])),stunned:Object.fromEntries(ids().map(actor=>[actor,now<(actor===id()?G.stunnedUntil:MP.bots?.find(b=>b.id===actor)?.stunnedUntil||MP.players[actor]?.stunnedUntil||0)]))};}
  function permanent(g){return (window.CaptureFlag?.view?.()?.walls||[]).some(w=>w.type===g.type&&w.gx===g.gx&&w.gy===g.gy);}
  function applyGates(now){
    if(mode()!=='ctf'||G.shifting)return;let close=false;
    for(const g of gates){const s=state.shortcut[g.team],want=now<s.until;
      if(want&&!g.open){const wall=G.wallBoxes.find(w=>w.type===g.type&&w.gx===g.gx&&w.gy===g.gy);if(wall)removeWallBox(wall,true);g.open=true;for(const b of MP.bots||[])b.path=null;}
      if(!want&&g.open){
        // Never close a gate through an actor or restore a wall permanently destroyed by a tool.
        if(permanent(g)){g.open=false;continue;}
        if(Object.values(positions()).some(p=>p.x+.4>g.minX&&p.x-.4<g.maxX&&p.z+.4>g.minZ&&p.z-.4<g.maxZ))continue;
        (g.type==='h'?G.hWalls:G.vWalls)[g.gy][g.gx]=true;g.open=false;close=true;
      }
    }
    if(close){buildWalls(LEVELS[G.lvlIdx]);for(const b of MP.bots||[])b.path=null;}
  }
  function text(){const p=state.progress[id()];if(!p)return '';switch(mode()){
    case 'classic':case 'race':return p.checkpoint?'地標完成 → 前往出口':'先抵達中途地標，站定片刻';
    case 'treasure':return state.sealed?(MP.treasure?.holder===id()?'持寶 → 任一封印點解封':'寶藏需先在封印點解封'):'封印已解 → 帶寶前往出口';
    case 'tag':return id()===MP.taggedId?'鬼不能啟動安全鐘':'下一站：安全鐘'+(p.bell%2?'乙':'甲')+' · '+p.score+'分'+(Date.now()+offset<p.cool?'（稍候再啟動）':'');
    case 'ctf':return '側翼符文站定 → 十秒捷徑';default:return '';
  }}
  function frame(){
    if(!ensure()){if(hud)hud.hidden=true;if(root)root.visible=false;return;}
    if(root)root.visible=true;const now=Date.now()+offset;
    if(authoritative()){
      const events=C.tick(state,positions(),Date.now(),context());
      for(const event of events)if(event.id===id())showToast(event.kind==='bell'?'安全鐘響了！＋25 分':event.kind==='seal'?'封印解除！前往出口':event.kind==='shortcut'?'側翼捷徑已開啟':'地標完成！前往出口',1600);
      if(MP.on&&MP.host&&(state.rev!==lastRev||Date.now()-lastSync>=700)){lastRev=state.rev;lastSync=Date.now();RoomLifecycle.sendLocal({t:'variantsync',key,state,at:Date.now()});}
    }
    applyGates(now);if(hud){hud.hidden=mode()==='shop'||MP.ended;const label=text();if(caption.textContent!==label)caption.textContent=label;const fraction=C.progress(state,id(),now);fill.style.transform='scaleX('+fraction+')';fill.hidden=!fraction;
      if(performance.now()-lastLayout>250){lastLayout=performance.now();const mini=$('minimapWrap').getBoundingClientRect?.();if(mini)hud.style.right=(Math.max(90,window.innerWidth-mini.left+8))+'px';}
    }
    if(mode()==='shop'&&MP.host){for(const b of MP.bots||[])if(ShopCollection.offers(b.id).length)ShopCollection.choose((soloSeed+MP.order.indexOf(b.id)+ShopCollection.progress(b.id).orders)%2,b.id);}
    window.ShopCollection?.sync?.();
  }
  function canFinish(actor=id()){if(!ensure()||C.canFinish(state,actor))return true;if(actor===id()&&performance.now()-noticeAt>2000){noticeAt=performance.now();showToast(mode()==='treasure'?'先到任一封印點解封寶藏':'先到中途地標完成挑戰',1500);}return false;}
  function botGoal(b,goal,goalKey,now){
    if(!ensure())return null;const p=state.progress[b.id];if(!p)return null;let point=null;
    if(['race','classic'].includes(mode())&&!p.checkpoint)point=state.points[0];
    if(mode()==='treasure'&&state.sealed&&MP.treasure?.holder===b.id)point=state.points.slice().sort((a,c)=>solveMaze(worldToCell(b.x,b.z).x,worldToCell(b.x,b.z).y,a.cx,a.cy).length-solveMaze(worldToCell(b.x,b.z).x,worldToCell(b.x,b.z).y,c.cx,c.cy).length)[0];
    if(mode()==='tag'&&MP.taggedId!==b.id&&p.score<150&&Date.now()>=p.cool){const ghost=position(MP.taggedId);if(!ghost||!C.near(b,ghost,8))point=state.points[p.bell%state.points.length];}
    if(mode()==='ctf'){const v=window.CaptureFlag?.view?.(),team=v?.members[b.id]?.team,s=state.shortcut[team];if(s&&v.flag.holder!==b.id&&MP.order.indexOf(b.id)%4>=2&&Date.now()>=s.cool&&Date.now()>=s.until)point=state.points[team];}
    return point?{goal:{x:point.cx,y:point.cy},key:'variant:'+layout+':'+point.cx+','+point.cy}:null;
  }
  function map(ctx,big,pad,cw,ch){if(!state||!active()||mode()==='shop')return;ctx.save();ctx.fillStyle='#ffd778';ctx.strokeStyle='#11273b';ctx.lineWidth=2;ctx.font='bold '+(big?15:9)+'px sans-serif';ctx.textAlign='center';state.points.forEach((p,i)=>{const x=pad+(p.cx+.5)*cw,y=pad+(p.cy+.5)*ch;ctx.beginPath();ctx.arc(x,y,big?9:5,0,Math.PI*2);ctx.fill();ctx.stroke();if(big){ctx.fillStyle='#1b263b';ctx.fillText(mode()==='tag'?'鐘':mode()==='treasure'?'封':mode()==='ctf'?'徑':'標',x,y+5);ctx.fillStyle='#ffd778';}});ctx.restore();}
  const send=mpSend;mpSend=function(m){if(['reach','twin'].includes(m.t)&&!m.timeout&&!canFinish(m.f||m.winner||MP.id))return;if(m.t==='end'&&MP.host&&state?.mode==='tag')m={...m,bells:Object.fromEntries(Object.entries(state.progress).map(([actor,p])=>[actor,p.score]))};send(m);};
  const handle=mpHandle;mpHandle=function(m){
    if(m.t==='variantsync'){
      if(!ensure()||m.f!==MP.roster[0]?.id||m.sr!==MP.seriesRound||m.key!==key||!m.state||m.state.epoch!==key||m.state.mode!==mode()||m.state.rev<state.rev||Object.keys(m.state.progress||{}).join('|')!==ids().join('|')||!Number.isFinite(m.at))return;
      if(MP.host)return;state=JSON.parse(JSON.stringify(m.state));offset=m.at-Date.now();return;
    }
    if(MP.host&&['reach','twin'].includes(m.t)&&!m.timeout&&!canFinish(m.f||m.winner))return;
    if(m.t==='end'&&m.f===MP.roster[0]?.id&&m.sr===MP.seriesRound&&state?.mode==='tag'&&m.bells){for(const actor of ids())state.progress[actor].score=Math.max(0,Math.min(150,Number(m.bells[actor])||0));}
    handle(m);
  };
  const results=showMPResults;showMPResults=function(title,html,rows){if(state?.mode==='tag'&&C.enabled('tag',matchRules())){rows=rows.map(r=>({...r,points:r.points+(state.progress[r.id]?.score||0)}));html+='<p>安全鐘：'+MP.roster.map(r=>escapeHtml(r.name)+' ＋'+(state.progress[r.id]?.score||0)).join(' · ')+'（不改變逃脫勝負）</p>';}if(hud)hud.hidden=true;if(root)root.visible=false;results(title,html,rows);};
  const leave=mpLeave;mpLeave=function(){reset();leave();};
  window.ModeVariants={frame,canFinish,botGoal,map,reset,state:()=>state};
})();
