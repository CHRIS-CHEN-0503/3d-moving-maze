/* Geometric expressions: no external images, timers or per-frame allocations. Front is +Z. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CharacterFace=api;})(globalThis,function(){
  'use strict';
  function attach(T,model,rig,eyes,headY=0,robot=false){
    const ink=new T.MeshLambertMaterial({color:robot?0x58ecfa:0x4a3037});
    const surface=(x,y)=>.24*Math.sqrt(Math.max(.1,1-(x/.27)**2-(y/.275)**2))+.018;
    const detail=(w,h,d,x,y,z)=>{const geo=new T.SphereGeometry(1,8,6);geo.scale(w/2,h/2,d/2);const mesh=new T.Mesh(geo,ink);mesh.position.set(x,headY+y,model.userData.sculpted&&!robot?surface(x,y):z);rig.add(mesh);return mesh;};
    const brows=[detail(.09,.022,.022,-.13,.12,.265),detail(.09,.022,.022,.13,.12,.265)];
    const mouth=detail(.13,.035,.03,0,-.12,.247);
    const corners=[detail(.023,.045,.027,-.068,-.10,.261),detail(.023,.045,.027,.068,-.10,.261)];
    const face={eyes,brows,mouth,corners,mood:'calm',phase:(model.id%19)*.27,reaction:'',left:0,time:null,width:1,lids:[],lips:[],pupils:[]};
    // 微小高光跟著眼睛眨動；共用一組材質／幾何，不使用臉部貼圖。
    const shineMaterial=new T.MeshBasicMaterial({color:robot?0xe0ffff:0xfff3df});
    const shineGeometry=new T.SphereGeometry(.014,6,4);shineGeometry.scale(.75,1,.35);
    const pupilMaterial=new T.MeshBasicMaterial({color:robot?0xe0ffff:0x192127}),pupilGeometry=new T.SphereGeometry(.02,6,4);pupilGeometry.scale(.76,1.2,.35);
    for(const eye of eyes){const pupil=new T.Mesh(pupilGeometry,pupilMaterial);pupil.name='eye-pupil';pupil.position.z=.018;eye.add(pupil);face.pupils.push(pupil);const shine=new T.Mesh(shineGeometry,shineMaterial);shine.name='eye-catchlight';shine.position.set(-.011,.015,.026);eye.add(shine);}
    const white=new T.MeshLambertMaterial({color:robot?0xb1ffff:0xfff5df}),whiteGeo=new T.SphereGeometry(1,8,6);whiteGeo.scale(.049,.047,.018);face.whites=[];
    for(const eye of eyes){if(model.userData.sculpted&&!robot)eye.position.z=surface(eye.position.x,eye.position.y-headY);const sclera=new T.Mesh(whiteGeo,white);sclera.name='eye-white';sclera.position.copy(eye.position);sclera.position.z-=.009;rig.add(sclera);face.whites.push(sclera);eye.scale.set(.78,.84,1);}
    if(!robot){const lidMaterial=new T.MeshLambertMaterial({color:0x916c5b}),lidGeometry=new T.TorusGeometry(.047,.007,4,12,Math.PI);for(const eye of eyes){const lid=new T.Mesh(lidGeometry,lidMaterial);lid.name='upper-eyelid';lid.position.copy(eye.position);lid.position.z+=.004;lid.scale.set(1.15,.72,.7);rig.add(lid);face.lids.push(lid);}const lipMaterial=new T.MeshLambertMaterial({color:0xb78274});for(const [y,w]of [[-.109,.105],[-.144,.115]]){const lip=detail(w,.018,.018,0,y,.26);lip.name='sculpted-lip';lip.material=lipMaterial;face.lips.push(lip);}}
    const teeth=detail(.09,.014,.008,0,-.113,.267);teeth.material=white;teeth.visible=false;face.teeth=teeth;
    const blush=new T.MeshLambertMaterial({color:0xce8877,transparent:true,opacity:.48});face.cheeks=[-1,1].map(side=>{const cheek=detail(.067,.033,.014,side*.18,-.06,.216);cheek.material=blush;return cheek;});
    model.userData.face=face;return face;
  }
  const moods=['calm','hurt','focus','happy','alert','cast','talk','tired'];
  function react(model,mood,seconds=1.5){const f=model?.userData?.face;if(!f||!moods.includes(mood))return false;f.reaction=mood;f.left=Math.max(.1,Math.min(6,seconds));return true;}
  function update(model,time,mood='calm'){
    const f=model?.userData?.face;if(!f)return;
    const dt=f.time===null?0:Math.max(0,Math.min(.25,time-f.time));f.time=time;f.left=Math.max(0,f.left-dt);
    if(f.left>0&&mood!=='hurt')mood=f.reaction;
    f.mood=mood;
    const blink=((time+f.phase)%4.7)<.12;
    const hurt=mood==='hurt',focus=mood==='focus'||mood==='cast',happy=mood==='happy',alert=mood==='alert',talk=mood==='talk',tired=mood==='tired';
    for(let i=0;i<f.eyes.length;i++){const lid=blink?.12:hurt?.38:focus?.65:happy?.68:alert?1.1:tired?.48:.84;f.eyes[i].scale.y=lid;f.whites[i].scale.y=lid/.84;if(f.pupils?.[i])f.pupils[i].position.x=(focus?0:Math.sin(time*.7+f.phase)*.003);}
    f.brows[0].rotation.z=hurt?-.3:focus?-.3:happy?.2:alert?.3:0;
    f.brows[1].rotation.z=-f.brows[0].rotation.z;
    for(const b of f.brows)b.position.y=(f.browY??(f.browY=b.position.y))+(alert?.035:tired?-.025:0);
    f.mouth.scale.set((hurt?.65:happy?1.25:alert?.55:1)*f.width,hurt?2.6:happy?1.5:alert?2.6:talk?1.2+Math.sin(time*15)*.65:mood==='cast'?1.6:1,1);
    for(let i=0;i<f.lids.length;i++){f.lids[i].scale.y=f.eyes[i].scale.y*.85;f.lids[i].rotation.z=focus?(i?-.15:.15):0;}
    for(let i=0;i<f.lips.length;i++){f.lips[i].scale.x=f.mouth.scale.x;f.lips[i].position.y=f.mouth.position.y+(i?-.018:.012)*f.mouth.scale.y;}
    f.teeth.visible=happy;for(const c of f.cheeks)c.visible=!hurt&&!tired;
    for(const corner of f.corners)corner.visible=happy;
  }
  return Object.freeze({attach,update,react,moods});
});
