/* Geometric expressions: no external images, timers or per-frame allocations. Front is +Z. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CharacterFace=api;})(globalThis,function(){
  'use strict';
  function attach(T,model,rig,eyes,headY=0,robot=false){
    const ink=new T.MeshLambertMaterial({color:robot?0x58ecfa:0x4a3037});
    const detail=(w,h,d,x,y,z)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),ink);mesh.position.set(x,headY+y,z);rig.add(mesh);return mesh;};
    const brows=[detail(.09,.022,.022,-.13,.12,.265),detail(.09,.022,.022,.13,.12,.265)];
    const mouth=detail(.13,.025,.027,0,-.12,.261);
    const corners=[detail(.023,.045,.027,-.068,-.10,.261),detail(.023,.045,.027,.068,-.10,.261)];
    const face={eyes,brows,mouth,corners,mood:'calm',phase:(model.id%19)*.27};
    model.userData.face=face;return face;
  }
  function update(model,time,mood='calm'){
    const f=model?.userData?.face;if(!f)return;
    f.mood=mood;
    const blink=((time+f.phase)%4.7)<.12;
    const hurt=mood==='hurt',focus=mood==='focus',happy=mood==='happy';
    for(let i=0;i<f.eyes.length;i++)f.eyes[i].scale.y=blink?.12:hurt?.5:focus?.75:1;
    f.brows[0].rotation.z=hurt?-.3:focus?-.24:happy?.12:0;
    f.brows[1].rotation.z=-f.brows[0].rotation.z;
    f.mouth.scale.set(hurt?.6:happy?1.2:1,hurt?2:1,1);
    for(const corner of f.corners)corner.visible=!hurt&&!focus;
  }
  return Object.freeze({attach,update});
});
