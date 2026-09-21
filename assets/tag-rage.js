/* 暴怒大鬼：房主計時與破牆裁定，外牆永遠保留。 */
(function(){
  'use strict';
  let state={id:null,since:0,until:0},lastBroadcast=0,lastTick=0,lastSwing={},visuals=new Map(),wasRaging=false;
  const owner=()=>MP.order?.[0];
  const duration=size=>size<=11?30000:size<=15?45000:60000;
  const raging=id=>MP.mode==='tag'&&MP.started&&!MP.ended&&state.id===id&&Date.now()<state.until;
  function reset(){
    for(const [mesh,v] of visuals){mesh.scale.setScalar(1);v.club.parent?.remove(v.club);disposeSceneObject(v.club);}
    visuals.clear();state={id:null,since:0,until:0};lastSwing={};
  }
  function club(){
    const g=new THREE.Group(),wood=new THREE.MeshLambertMaterial({color:0x75452c}),iron=new THREE.MeshLambertMaterial({color:0xa8b5c4});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.8,6),wood);shaft.position.y=.3;g.add(shaft);
    const head=new THREE.Mesh(new THREE.CylinderGeometry(.21,.18,.55,8),iron);head.position.y=.82;g.add(head);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,spike=new THREE.Mesh(new THREE.ConeGeometry(.08,.23,4),iron);spike.position.set(Math.cos(a)*.25,.72+(i%2)*.2,Math.sin(a)*.25);spike.rotation.z=-Math.cos(a)*Math.PI/2;spike.rotation.x=Math.sin(a)*Math.PI/2;g.add(spike);}
    g.rotation.x=.25;g.position.set(.48,.9,.18);return g;
  }
  function render(){
    const pairs=[[MP.id,playerGroup],...Object.entries(MP.players).map(([id,p])=>[id,p.mesh])];
    for(const [id,mesh] of pairs){if(!mesh)continue;const on=raging(id);mesh.scale.setScalar(on?1.5:1);
      let v=visuals.get(mesh);if(on&&!v){v={club:club()};mesh.add(v.club);visuals.set(mesh,v);}
      if(v)v.club.visible=on;
    }
    if(state.id&&raging(state.id)){
      $('tagBanner').style.display='block';$('tagBanner').textContent=mpName(state.id)+' 化為暴怒大鬼 · '+Math.ceil((state.until-Date.now())/1000)+'秒 · 狼牙棒可破內牆';
    }else if(wasRaging&&MP.mode==='tag')mpUpdateTagVisuals();
    wasRaging=raging(state.id);
  }
  function animate(){
    for(const [mesh,v] of visuals)if(v.club.visible&&window.CharacterMotion){
      CharacterMotion.weaponPose(v.club,mesh.userData.motion?.progress??1);
      if(mesh.userData.motion?.weapon)mesh.userData.motion.weapon.visible=false;
    }
  }
  function broadcast(){lastBroadcast=Date.now();RoomLifecycle.sendLocal({t:'ragestate',state:{...state}});}
  function tick(){
    if(MP.mode!=='tag'||!MP.started||MP.ended)return;
    const now=Date.now();
    if(now-lastTick<200)return;lastTick=now;
    if(MP.host){
      if(state.id!==MP.taggedId){state={id:MP.taggedId,since:now,until:0};broadcast();}
      if(!state.until&&now-state.since>=60000){state.until=now+duration(G.mazeW);broadcast();showToast('鬼生氣了！小心狼牙棒破牆！',2500);}
      if(state.until&&now>=state.until){state.until=0;state.since=now;broadcast();}
      if(now-lastBroadcast>=1000)broadcast();
      const bot=MP.bots?.find(b=>b.id===state.id);
      if(bot&&raging(bot.id)&&now-(lastSwing[bot.id]||0)>=800)smash(bot.id);
    }
    render();
  }
  function smash(id){
    if(!MP.host||!raging(id)||G.shifting||Date.now()-(lastSwing[id]||0)<650)return;
    const p=botPosOf(id),pl=MP.players[id],bot=MP.bots?.find(b=>b.id===id);
    if(!p||performance.now()<(id===MP.id?G.stunnedUntil:bot?.stunnedUntil||pl?.stunnedUntil||0))return;
    lastSwing[id]=Date.now();RoomLifecycle.sendLocal({t:'ragepose',id});
    const h=id===MP.id?G.heading:bot?.h??pl?.th??0;
    const wall=G.wallBoxes.find(w=>!w.boundary&&Array.from({length:9},(_,i)=>.4+i*.3).some(d=>{const x=p.x+Math.sin(h)*d,z=p.z+Math.cos(h)*d;return x>=w.minX-.12&&x<=w.maxX+.12&&z>=w.minZ-.12&&z<=w.maxZ+.12;}));
    if(wall)RoomLifecycle.sendLocal({t:'ragewall',round:MP.round,id,wall:{type:wall.type,gx:wall.gx,gy:wall.gy}});
  }
  const handle=mpHandle;mpHandle=function(m){
    if(m.t==='ragestate'){
      if(m.f!==owner()||m.sr!==MP.seriesRound||!MP.started||MP.ended||MP.mode!=='tag')return;
      if(!m.state||m.state.id!==MP.taggedId||!Number.isFinite(m.state.until))return;
      state={...m.state};render();return;
    }
    if(m.t==='rageswing'){if(m.sr===MP.seriesRound)smash(m.f);return;}
    if(m.t==='ragepose'){
      if(m.f!==owner()||m.sr!==MP.seriesRound||!raging(m.id))return;
      const mesh=m.id===MP.id?playerGroup:MP.players[m.id]?.mesh;
      if(mesh&&window.CharacterMotion)CharacterMotion.beginAction(mesh,'attack',.48);
      return;
    }
    if(m.t==='ragewall'){
      if(m.f!==owner()||m.sr!==MP.seriesRound||m.round!==MP.round||!raging(m.id))return;
      const w=G.wallBoxes.find(w=>!w.boundary&&w.type===m.wall?.type&&w.gx===m.wall.gx&&w.gy===m.wall.gy);
      if(w){removeWallBox(w,true);AudioEng.sfxBreak();burstParticles((w.minX+w.maxX)/2,(w.minZ+w.maxZ)/2);}
      return;
    }
    handle(m);
  };
  const attack=doAttack;doAttack=function(){
    const before=G.atkCoolUntil;attack();
    if(raging(MP.id)&&G.atkCoolUntil!==before){if(MP.host)smash(MP.id);else mpSend({t:'rageswing',sr:MP.seriesRound});}
  };
  // bindActionBtn 已擷取舊函式，因此在可用的揮擊入口同步破牆。
  const swing=swingWeapon;swingWeapon=function(){swing();if(raging(MP.id)){if(MP.host)smash(MP.id);else mpSend({t:'rageswing',sr:MP.seriesRound});}};
  const frame=mpFrame;mpFrame=function(dt){frame(dt);tick();animate();};
  const leave=mpLeave;mpLeave=function(){reset();leave();};
  window.TagRage={tick,reset,duration,raging};
})();
