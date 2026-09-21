(function(){
  'use strict';
  const kinds={oil:{name:'油漬：方向相反 10 秒',ms:10000,color:0xe6a827},glue:{name:'黏鼠板：定身 5 秒',ms:5000,color:0xcb65ad},foam:{name:'泡沫：減速 6 秒',ms:6000,color:0x61cce8},boost:{name:'加速踏板：加速 5 秒',ms:5000,color:0x65dda1}};
  let traps=[],effects={},stock={},root=null,seed=1,active=false,acc=0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const owner=()=>MP.order?.[0];
  const now=()=>performance.now();
  function stop(){if(root){root.parent?.remove(root);disposeSceneObject(root);}root=null;traps=[];effects={};stock={};active=false;$('shopTrapBtn').style.display='none';}
  function safe(x,z){return !(G.startCells||[]).some(c=>{const p=cellToWorld(c.x,c.y);return Math.hypot(p.x-x,p.z-z)<G.cell*1.5;})&&!(G.registers||[]).some(r=>Math.hypot(r.x-x,r.z-z)<G.cell);}
  function add(kind,x,z,by='',id=traps.length){
    if(!kinds[kind]||id>=40||traps[id])return;
    const def=kinds[kind],group=new THREE.Group();
    const base=new THREE.Mesh(kind==='glue'?new THREE.BoxGeometry(1.65,.07,1.25):new THREE.CylinderGeometry(.85,1,.06,12),new THREE.MeshLambertMaterial({color:def.color}));base.position.y=.07;group.add(base);
    // 地面低矮標記，不使用漂浮拾取光柱。
    const mark=makeTextSprite({oil:'反向',glue:'定身',foam:'減速',boost:'加速'}[kind]);mark.position.y=.45;mark.scale.set(1.25,.38,1);group.add(mark);
    if(kind==='oil'){const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.5,6),new THREE.MeshLambertMaterial({color:0xffdb72}));bottle.rotation.z=1.45;bottle.position.set(.65,.15,.35);group.add(bottle);}
    group.position.set(x,0,z);root.add(group);
    traps[id]={id,kind,x,z,by,armed:now()+(by?1500:0),mesh:group,used:false};
  }
  function start(){
    stop();if(!isShop()||!MP.started)return;
    active=true;seed=(MP.seed^0x7231)>>>0;root=new THREE.Group();scene.add(root);
    MP.roster.forEach(r=>stock[r.id]={left:3,at:0});
    const target=Math.min(16,Math.max(6,Math.floor(G.mazeW*G.mazeH/20)));
    for(let i=0,tries=0;i<target&&tries<500;tries++){
      const p=cellToWorld(Math.floor(rand()*G.mazeW),Math.floor(rand()*G.mazeH));
      if(!safe(p.x,p.z)||traps.some(t=>t&&Math.hypot(t.x-p.x,t.z-p.z)<G.cell))continue;
      add(Object.keys(kinds)[i%4],p.x,p.z);i++;
    }
    $('shopTrapBtn').style.display='block';updateButton();
    showToast('油漬會反向、黏板會定身；每輪可放三次陷阱。',3500);
  }
  function updateButton(){const s=stock[MP.id];if(!s)return;const left=Math.ceil((s.at-now())/1000);$('shopTrapCount').textContent=left>0?left+'秒':s.left;$('shopTrapBtn').disabled=s.left<=0||left>0;}
  function effect(id){const e=effects[id];return e&&now()<e.until?e:null;}
  function input(x,y,id){const e=effect(id);if(e?.kind==='glue')return{x:0,y:0};return e?.kind==='oil'?{x:-x,y:-y}:{x,y};}
  function speed(id){const e=effect(id);return e?.kind==='glue'?0:e?.kind==='foam'?0.55:e?.kind==='boost'?1.5:1;}
  function hit(id,t){
    const p=botPosOf(id);if(!p||t.used||now()<t.armed||Math.hypot(p.x-t.x,p.z-t.z)>1.35||now()<(effects[id]?.immune||0))return;
    RoomLifecycle.sendLocal({t:'chaoseffect',id,trap:t.id,kind:t.kind});
  }
  function tick(dt){
    if(!active||!MP.started||MP.ended||G.frozen||G.shifting)return;
    acc+=dt;if(acc<.1)return;acc=0;updateButton();
    if(!MP.host)return;
    for(const r of MP.roster)if(!r.disconnected)for(const t of traps)if(t)hit(r.id,t);
  }
  const handle=mpHandle;
  mpHandle=function(m){
    if(m.t==='chaosdrop'){
      if(!active||!MP.host||MP.ended||!MP.started||m.sr!==MP.seriesRound)return;
      const s=stock[m.f],p=botPosOf(m.f);if(!s||s.left<=0||now()<s.at||!p||!safe(p.x,p.z)||effect(m.f)?.kind==='glue')return;
      if(traps.filter(t=>t&&!t.used).some(t=>Math.hypot(p.x-t.x,p.z-t.z)<2))return;
      RoomLifecycle.sendLocal({t:'chaosplaced',id:m.f,trap:traps.length,kind:s.left%2?'oil':'glue',x:p.x,z:p.z});return;
    }
    if(m.t==='chaosplaced'||m.t==='chaoseffect'){
      if(!active||!MP.started||MP.ended||m.f!==owner()||m.sr!==MP.seriesRound)return;
      if(m.t==='chaosplaced'){
        const s=stock[m.id];if(!s||traps[m.trap]||s.left<=0)return;
        s.left--;s.at=now()+12000;add(m.kind,m.x,m.z,m.id,m.trap);updateButton();
        if(m.id===MP.id)showToast('已放置'+(m.kind==='oil'?'油漬':'黏鼠板')+'，一秒半後生效。');
      }else{
        const t=traps[m.trap];if(!t||t.used||t.kind!==m.kind)return;t.used=true;t.mesh.visible=false;
        const def=kinds[t.kind];effects[m.id]={kind:t.kind,until:now()+def.ms,immune:now()+def.ms+2500};
        if(t.kind==='glue'){const b=MP.bots?.find(b=>b.id===m.id);if(b)b.stunnedUntil=Math.max(b.stunnedUntil||0,now()+def.ms);}
        if(m.id===MP.id){if(t.kind!=='boost')cancelCheckout('受到地面效果影響，結帳中斷');addEffect('market',def.name,def.ms/1000);showToast(def.name,2200);}
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
  window.ShopChaos={start,stop,input,speed,tick};
  bindActionBtn($('shopTrapBtn'),()=>{if(active&&!G.frozen&&!MP.ended){if(MP.host)mpHandle({t:'chaosdrop',f:MP.id,sr:MP.seriesRound});else mpSend({t:'chaosdrop',sr:MP.seriesRound});}});
})();
