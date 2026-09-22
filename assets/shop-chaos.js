(function(){
  'use strict';
  const kinds={oil:{name:'哎呀！踩到油漬，方向亂掉了！',label:'方向亂掉啦',ms:10000,color:0xe6a827},glue:{name:'踩到黏鼠板，走不動了！',label:'黏住啦',ms:5000,color:0xcb65ad},foam:{name:'滿地泡泡！腳步變得慢吞吞！',label:'慢吞吞',ms:6000,color:0x61cce8},boost:{name:'踩到加速踏板，咻！衝出去囉！',label:'咻！加速中',ms:5000,color:0x65dda1}};
  const items={boost:{name:'加速',path:'M19 2 7 18h8l-2 12 12-18h-8Z'},oil:{name:'油漬',path:'M12 3h8v5l3 4v14H9V12l3-4Z M9 18h14'},glue:{name:'黏鼠板',path:'M5 7h22v18H5Z M8 11l16 10 M8 21l16-10'},foam:{name:'泡沫',path:'M6 21a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M17 11a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 7h3'},egg:{name:'雞蛋',path:'M16 3C10 3 6 17 6 21a10 8 0 0 0 20 0C26 17 22 3 16 3Z'}};
  const lootPool=['boost','boost','oil','glue','foam','egg','egg'];
  const EGG_MS=10000,eggFaces=new Map();
  let traps=[],boxes=[],effects={},stock={},flights=[],root=null,seed=1,active=false,acc=0,epoch=0,eggUntil=0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const owner=()=>MP.order?.[0],now=()=>performance.now();
  const player=id=>MP.roster.some(r=>r.id===id&&!r.disconnected);
  function clearMap(){if(root){root.parent?.remove(root);disposeSceneObject(root);}root=null;traps=[];boxes=[];flights=[];}
  function clearFace(id){const f=eggFaces.get(id);if(f?.mesh){f.mesh.parent?.remove(f.mesh);disposeSceneObject(f.mesh);}eggFaces.delete(id);}
  function stop(){clearMap();for(const id of eggFaces.keys())clearFace(id);effects={};stock={};active=false;eggUntil=0;acc=0;$('shopTrapBtn').style.display='none';$('shopEggSplat').hidden=true;}
  function safe(x,z){return !(G.startCells||[]).some(c=>{const p=cellToWorld(c.x,c.y);return Math.hypot(p.x-x,p.z-z)<G.cell*1.5;})&&!(G.registers||[]).some(r=>Math.hypot(r.x-x,r.z-z)<G.cell);}
  function add(kind,x,z,by='',id=traps.length){
    if(!kinds[kind]||id>=64||traps[id])return false;
    const def=kinds[kind],group=new THREE.Group();
    const base=new THREE.Mesh(kind==='glue'?new THREE.BoxGeometry(1.65,.07,1.25):new THREE.CylinderGeometry(.85,1,.06,12),new THREE.MeshLambertMaterial({color:def.color}));base.position.y=.07;group.add(base);
    const mark=makeTextSprite({oil:'反向',glue:'定身',foam:'減速',boost:'加速'}[kind]);mark.position.y=.45;mark.scale.set(1.25,.38,1);group.add(mark);
    if(kind==='oil'){const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.5,6),new THREE.MeshLambertMaterial({color:0xffdb72}));bottle.rotation.z=1.45;bottle.position.set(.65,.15,.35);group.add(bottle);}
    group.position.set(x,0,z);root.add(group);
    traps[id]={id,kind,x,z,by,armed:now()+(by?1500:2500),mesh:group,used:false};return true;
  }
  function addBox(x,z){
    const group=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.05,1.05),new THREE.MeshLambertMaterial({color:0x246c9f}));body.position.y=.8;group.add(body);
    const lid=new THREE.Mesh(new THREE.BoxGeometry(1.16,.15,1.16),new THREE.MeshLambertMaterial({color:0xffd36b}));lid.position.y=1.38;group.add(lid);
    const mark=makeTextSprite('？');mark.position.set(0,1.9,0);mark.scale.set(.9,.9,1);group.add(mark);
    group.userData.shopBox=boxes.length;group.position.set(x,0,z);root.add(group);boxes.push({id:boxes.length,x,z,mesh:group,used:false});
  }
  function rebuild(){
    if(!active)return;clearMap();epoch=MP.round||0;seed=(MP.seed^0x7231^Math.imul(epoch+1,2654435761))>>>0;root=new THREE.Group();scene.add(root);
    const target=Math.min(16,Math.max(6,Math.floor(G.mazeW*G.mazeH/20)));
    for(let i=0,tries=0;i<target&&tries<500;tries++){
      const p=cellToWorld(Math.floor(rand()*G.mazeW),Math.floor(rand()*G.mazeH));
      if(!safe(p.x,p.z)||traps.some(t=>t&&Math.hypot(t.x-p.x,t.z-p.z)<G.cell)||(G.goods||[]).some(g=>g&&Math.hypot(g.x-p.x,g.z-p.z)<2))continue;
      add(Object.keys(kinds)[i%4],p.x,p.z);i++;
    }
    const count=Math.max(3,Math.min(12,matchRules().itemCount||6));
    for(let tries=0;boxes.length<count&&tries<500;tries++){
      const p=cellToWorld(Math.floor(rand()*G.mazeW),Math.floor(rand()*G.mazeH));
      if(!safe(p.x,p.z)||[...traps,...boxes,...(G.goods||[])].some(t=>t&&Math.hypot(t.x-p.x,t.z-p.z)<G.cell))continue;
      addBox(p.x,p.z);
    }
  }
  function start(){
    stop();if(!isShop()||!MP.started)return;active=true;
    MP.roster.forEach(r=>stock[r.id]={queue:[],at:0,autoAt:now()+3000});rebuild();updateButton();
    showToast('找「？」道具箱取得道具；地面油漬、黏板要小心！',3000);
  }
  function updateButton(){
    const s=stock[MP.id],button=$('shopTrapBtn');button.style.display=active&&s?.queue.length?'block':'none';if(!s)return;
    const first=s.queue[0],left=Math.ceil((s.at-now())/1000);$('shopTrapCount').textContent=left>0?left+'秒':s.queue.length;
    button.disabled=!first||left>0||G.frozen||G.shifting||MP.ended;
    if(first){$('shopItemName').textContent=items[first.kind].name;$('shopItemIcon').setAttribute('d',items[first.kind].path);button.setAttribute('aria-label','使用'+items[first.kind].name+'，剩餘'+s.queue.length+'個');}
  }
  function effect(id){const e=effects[id];return e&&now()<e.until?e:null;}
  function input(x,y,id){const e=effect(id);if(e?.kind==='glue')return{x:0,y:0};return e?.kind==='oil'?{x:-x,y:-y}:{x,y};}
  function speed(id){const e=effect(id);return e?.kind==='glue'?0:e?.kind==='foam'?0.55:e?.kind==='boost'?1.5:1;}
  function hit(id,t){
    const p=botPosOf(id);if(!p||t.used||now()<t.armed||Math.hypot(p.x-t.x,p.z-t.z)>1.35||now()<(effects[id]?.immune||0))return;
    RoomLifecycle.sendLocal({t:'chaoseffect',id,trap:t.id,kind:t.kind,round:epoch});
  }
  function heading(id){return id===MP.id?G.heading:MP.bots?.find(b=>b.id===id)?.h??MP.players[id]?.th??0;}
  function eggShot(id){
    const p=botPosOf(id),h=heading(id),dx=Math.sin(h),dz=Math.cos(h);let range=10;
    for(let d=.5;d<=10;d+=.5)if(playerInWall(p.x+dx*d,p.z+dz*d,.12)){range=d-.5;break;}
    let target='',best=range;
    for(const r of MP.roster){if(r.id===id||r.disconnected)continue;const q=botPosOf(r.id);if(!q)continue;
      const x=q.x-p.x,z=q.z-p.z,along=x*dx+z*dz,side=Math.abs(x*dz-z*dx);
      if(along>.3&&along<best&&side<.9){best=along;target=r.id;}
    }
    return{target,x:p.x,z:p.z,ex:p.x+dx*best,ez:p.z+dz*best};
  }
  function throwEgg(m){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshLambertMaterial({color:0xfff3cf}));mesh.scale.y=1.35;root.add(mesh);
    flights.push({...m,mesh,at:now()});
  }
  // Original low-poly egg white, yolk and drips, attached to the moving head (+Z).
  function updateEggFaces(){
    for(const [id,f] of eggFaces){
      if(now()>=f.until||MP.ended){clearFace(id);continue;}
      const model=id===MP.id?playerGroup:MP.players[id]?.mesh,head=model?.userData?.head;
      if(!head)continue;
      if(f.mesh?.parent!==head){
        if(f.mesh){f.mesh.parent?.remove(f.mesh);disposeSceneObject(f.mesh);}
        const group=new THREE.Group();group.name='egg-face';
        const blob=(x,y,sx,sy,color,z=.294)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.scale.set(sx,sy,.018);group.add(m);};
        blob(-.09,.045,.17,.14,0xfff6d8);blob(.08,-.005,.16,.16,0xfff6d8);blob(.04,-.025,.10,.09,0xffc326,.318);
        blob(-.18,-.16,.034,.16,0xfff6d8);blob(.13,-.18,.025,.18,0xffcf39,.315);
        // A lopsided open mouth and tilted brow make the mishap readable even at a distance.
        blob(-.025,-.17,.05,.035,0x5b3429,.32);
        const brow=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,.02),new THREE.MeshLambertMaterial({color:0x5b3429}));brow.position.set(.125,.16,.3);brow.rotation.z=.42;group.add(brow);
        head.add(group);f.mesh=group;
      }
    }
  }
  function animateEggs(){
    for(let i=flights.length-1;i>=0;i--){const f=flights[i],t=Math.min(1,(now()-f.at)/350);
      f.mesh.position.set(f.x+(f.ex-f.x)*t,1.25+Math.sin(t*Math.PI)*.7,f.z+(f.ez-f.z)*t);
      if(t===1){root.remove(f.mesh);disposeSceneObject(f.mesh);flights.splice(i,1);
        if(f.target&&player(f.target)){const old=eggFaces.get(f.target);eggFaces.set(f.target,{mesh:old?.mesh,until:now()+EGG_MS});}
        if(f.target===MP.id){eggUntil=now()+EGG_MS;showToast('哎呀！雞蛋糊到臉上了！',1800,'哎呀！雞蛋糊到臉上了！');}
        const bot=MP.bots?.find(b=>b.id===f.target);if(bot)bot.stunnedUntil=Math.max(bot.stunnedUntil||0,now()+1500);
      }
    }
    updateEggFaces();
    $('shopEggSplat').hidden=!(active&&!MP.ended&&now()<eggUntil);
  }
  function use(id){
    const s=stock[id],p=botPosOf(id),first=s?.queue[0];
    const stunned=id===MP.id?G.stunnedUntil:MP.bots?.find(b=>b.id===id)?.stunnedUntil;
    if(!first||!p||now()<s.at||isCheckingOut(id)||now()<(stunned||0)||effect(id)?.kind==='glue')return;
    if(['oil','glue','foam'].includes(first.kind)&&(!safe(p.x,p.z)||traps.length>=64||traps.some(t=>t&&!t.used&&Math.hypot(p.x-t.x,p.z-t.z)<2)))return;
    RoomLifecycle.sendLocal({t:'chaosuse',id,token:first.token,kind:first.kind,trap:traps.length,x:p.x,z:p.z,round:epoch,...(first.kind==='egg'?eggShot(id):{})});
  }
  function tick(dt){
    if(!active||!MP.started)return;animateEggs();if(MP.ended){$('shopTrapBtn').style.display='none';return;}
    if(G.frozen||G.shifting)return;
    acc+=dt;if(acc<.1)return;acc=0;updateButton();if(!MP.host)return;
    for(const r of MP.roster){if(r.disconnected)continue;
      const s=stock[r.id],p=botPosOf(r.id);if(!s||!p)continue;
      for(const box of boxes)if(!box.used&&s.queue.length<3&&!isCheckingOut(r.id)&&Math.hypot(p.x-box.x,p.z-box.z)<1.2){
        RoomLifecycle.sendLocal({t:'chaosloot',id:r.id,box:box.id,kind:lootPool[Math.floor(rand()*lootPool.length)],round:epoch});
      }
      for(const t of traps)if(t)hit(r.id,t);
      if(r.bot&&now()>=s.autoAt){s.autoAt=now()+4000;use(r.id);}
    }
  }
  const handle=mpHandle;
  mpHandle=function(m){
    if(['chaosdrop','chaosloot','chaosuse','chaoseffect'].includes(m.t)){
      if(!active||!MP.started||MP.ended||m.sr!==MP.seriesRound||m.round!==epoch)return;
      if(m.t==='chaosdrop'){if(MP.host&&player(m.f)&&!G.frozen&&!G.shifting)use(m.f);return;}
      if(m.f!==owner()||!player(m.id))return;
      if(m.t==='chaosloot'){
        const box=boxes[m.box],s=stock[m.id];if(!box||box.used||!s||s.queue.length>=3||!items[m.kind])return;
        box.used=true;box.mesh.visible=false;s.queue.push({kind:m.kind,token:epoch+':'+m.box});
        if(m.id===MP.id)showToast('獲得 '+items[m.kind].name+'，點道具鈕使用',1800,'獲得 '+items[m.kind].name);updateButton();
      }else if(m.t==='chaosuse'){
        const s=stock[m.id],first=s?.queue[0];if(!first||first.token!==m.token||first.kind!==m.kind)return;
        if(['oil','glue','foam'].includes(m.kind)&&!add(m.kind,m.x,m.z,m.id,m.trap))return;
        s.queue.shift();s.at=now()+5000;
        if(m.kind==='boost')effects[m.id]={kind:'boost',until:now()+5000,immune:0};
        if(m.kind==='egg')throwEgg(m);
        if(m.id===MP.id)showToast('使用 '+items[m.kind].name,1400,'使用 '+items[m.kind].name);updateButton();
      }else{
        const t=traps[m.trap];if(!t||t.used||t.kind!==m.kind)return;t.used=true;t.mesh.visible=false;
        const def=kinds[t.kind];effects[m.id]={kind:t.kind,until:now()+def.ms,immune:now()+def.ms+2500};
        if(t.kind==='glue'){const b=MP.bots?.find(b=>b.id===m.id);if(b)b.stunnedUntil=Math.max(b.stunnedUntil||0,now()+def.ms);}
        if(m.id===MP.id){if(t.kind!=='boost')cancelCheckout();addEffect('market',def.label,def.ms/1000);showToast(def.name,2200,def.name);}
      }
      return;
    }
    handle(m);
  };
  const walk=botWalk;botWalk=function(b,goal,key,dt,time,mul){
    if(effect(b.id)?.kind==='oil'){
      const x=b.x-Math.sin(b.h)*2.6*dt,z=b.z-Math.cos(b.h)*2.6*dt;
      if(!playerInWall(x,z,.28)){b.x=x;b.z=z;}b.path=null;return;
    }
    walk(b,goal,key,dt,time,mul);
  };
  const frame=mpFrame;mpFrame=function(dt){tick(dt);frame(dt);};
  function collectForBot(b,dt,time,mul){
    if(!active||stock[b.id]?.queue.length!==0)return false;
    let best=null,dist=64;
    for(const box of boxes)if(!box.used){const d=(box.x-b.x)**2+(box.z-b.z)**2;if(d<dist){best=box;dist=d;}}
    if(!best)return false;botWalk(b,worldToCell(best.x,best.z),'box'+epoch+':'+best.id,dt,time,mul);return true;
  }
  window.ShopChaos={start,stop,rebuild,input,speed,tick,collectForBot,reserved:(x,z)=>[...traps,...boxes].some(t=>t&&Math.hypot(t.x-x,t.z-z)<G.cell)};
  bindActionBtn($('shopTrapBtn'),()=>{if(active&&!G.frozen&&!G.shifting&&!MP.ended){
    const first=stock[MP.id]?.queue[0];
    if(first&&['oil','glue','foam'].includes(first.kind)&&(!safe(G.px,G.pz)||traps.some(t=>t&&!t.used&&Math.hypot(G.px-t.x,G.pz-t.z)<2))){showToast('這裡太擠了，走開一點再放陷阱吧！',1600);return;}
    if(MP.host)mpHandle({t:'chaosdrop',f:MP.id,sr:MP.seriesRound,round:epoch});else mpSend({t:'chaosdrop',sr:MP.seriesRound,round:epoch});
  }});
})();
