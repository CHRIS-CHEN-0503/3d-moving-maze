/* Original expressions and tiny authored complexion maps. Front is +Z.
   Each map belongs to one character and follows normal scene disposal.
   No external images, shared GPU cache, lights, timers or frame allocations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CharacterFace=api;})(globalThis,function(){
  'use strict';
  const MAP_SIZE=128;
  function skinSurface(T,{job='classic',sex='male'}={}){
    if(!globalThis.document?.createElement||!T.CanvasTexture)return null;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=MAP_SIZE;
    const c=canvas.getContext?.('2d');if(!c)return null;
    c.fillStyle='#ffffff';c.fillRect(0,0,MAP_SIZE,MAP_SIZE);
    const female=sex==='female';
    // +Z on SphereGeometry is u=.25. Paint complexion only: eyes and lips
    // stay animated geometry, avoiding a second unmoving face in the texture.
    const soft=(u,v,rx,ry,color)=>{c.save();c.translate(u*MAP_SIZE,v*MAP_SIZE);c.scale(rx*MAP_SIZE,ry*MAP_SIZE);const fade=c.createRadialGradient(0,0,0,0,0,1);fade.addColorStop(0,color);fade.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=fade;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();};
    for(const u of [.169,.331]){soft(u,.468,.063,.065,'rgba(105,83,78,.19)');soft(u,.558,.055,.057,female?'rgba(208,115,114,.21)':'rgba(178,120,103,.12)');}
    soft(.25,.49,.021,.085,'rgba(255,239,217,.24)');soft(.25,.593,.018,.013,'rgba(119,84,72,.16)');soft(.25,.648,.039,.021,female?'rgba(159,86,98,.17)':'rgba(135,89,77,.12)');soft(.25,.71,.09,.026,'rgba(100,78,68,.12)');
    if(job==='scout'||job==='archer'){c.fillStyle='rgba(118,74,49,.24)';for(const side of [-1,1])for(let i=0;i<5;i++){const x=(.25+side*(.073+i*.005))*MAP_SIZE,y=(.554+Math.sin(i*2.1)*.012)*MAP_SIZE;c.beginPath();c.arc(x,y,.32,0,Math.PI*2);c.fill();}}
    if(!female&&job==='smith'){c.strokeStyle='rgba(236,209,182,.5)';c.lineWidth=.65;c.beginPath();c.moveTo(.174*MAP_SIZE,.392*MAP_SIZE);c.lineTo(.19*MAP_SIZE,.464*MAP_SIZE);c.stroke();}
    const texture=new T.CanvasTexture(canvas);texture.name='original-complexion-'+job+'-'+sex;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
    texture.userData={originalArt:true,owner:'character',byteBudget:MAP_SIZE*MAP_SIZE*4,kind:'complexion'};return texture;
  }
  function ribbon(T,width,height,curve=.004){
    const positions=[],indices=[];for(let i=0;i<=10;i++){const u=i/10*2-1,y=curve*(u*u-.3);for(const side of [-1,1])positions.push(u*width/2,y+side*height/2,-u*u*.009);}
    for(let i=0;i<10;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function attach(T,model,rig,eyes,headY=0,robot=false,appearance={}){
    const ink=new T.MeshLambertMaterial({color:robot?0x58ecfa:0x49312d});
    const surface=(x,y)=>.24*Math.sqrt(Math.max(.1,1-(x/.27)**2-(y/.275)**2))+.018;
    const detail=(w,h,d,x,y,z)=>{const geo=new T.SphereGeometry(1,8,6);geo.scale(w/2,h/2,d/2);const mesh=new T.Mesh(geo,ink);mesh.position.set(x,headY+y,model.userData.sculpted&&!robot?surface(x,y):z);rig.add(mesh);return mesh;};
    const brows=[detail(.087,.016,.012,-.116,.112,.265),detail(.087,.016,.012,.116,.112,.265)];
    const browMaterial=ink.clone();for(const brow of brows)brow.material=browMaterial;
    const mouth=detail(.112,.013,.01,0,-.12,.247);
    const corners=[detail(.014,.028,.009,-.056,-.108,.261),detail(.014,.028,.009,.056,-.108,.261)];
    const face={eyes,brows,mouth,corners,mood:'calm',phase:(model.id%19)*.27,reaction:'',left:0,time:null,width:1,lids:[],lips:[],pupils:[],headY,robot,rig,surface,baseEyeY:.72,skinTexture:null};
    const shineMaterial=new T.MeshBasicMaterial({color:robot?0xe0ffff:0xfff9ed});
    const shineGeometry=new T.SphereGeometry(.008,6,4);shineGeometry.scale(.75,1,.35);
    const pupilMaterial=new T.MeshBasicMaterial({color:robot?0xe0ffff:0x192127}),pupilGeometry=new T.SphereGeometry(.015,6,4);pupilGeometry.scale(.68,1.05,.35);
    for(const eye of eyes){const pupil=new T.Mesh(pupilGeometry,pupilMaterial);pupil.name='eye-pupil';pupil.position.z=.012;eye.add(pupil);face.pupils.push(pupil);const shine=new T.Mesh(shineGeometry,shineMaterial);shine.name='eye-catchlight';shine.position.set(-.008,.009,.019);eye.add(shine);}
    const white=new T.MeshLambertMaterial({color:robot?0xb1ffff:0xf2e8d8}),whiteGeo=new T.SphereGeometry(1,10,6);whiteGeo.scale(.047,.031,.011);face.whites=[];
    for(const eye of eyes){if(model.userData.sculpted&&!robot)eye.position.z=surface(eye.position.x,eye.position.y-headY);const sclera=new T.Mesh(whiteGeo,white);sclera.name='eye-white';sclera.position.copy(eye.position);sclera.position.z-=.008;rig.add(sclera);face.whites.push(sclera);eye.scale.set(.73,.72,.65);}
    if(!robot){const lidMaterial=new T.MeshLambertMaterial({color:0x795447}),lidGeometry=new T.TorusGeometry(.044,.0035,4,12,Math.PI);for(const eye of eyes){const lid=new T.Mesh(lidGeometry,lidMaterial);lid.name='upper-eyelid';lid.position.copy(eye.position);lid.position.z+=.006;lid.scale.set(1.09,.61,.65);rig.add(lid);face.lids.push(lid);}const lipMaterial=new T.MeshLambertMaterial({color:0xb78274});for(const [y,w]of [[-.111,.10],[-.136,.105]]){const lip=detail(w,.008,.009,0,y,.26);lip.name='sculpted-lip';lip.material=lipMaterial;face.lips.push(lip);}}
    const teeth=detail(.08,.009,.006,0,-.116,.267);teeth.material=white;teeth.visible=false;face.teeth=teeth;
    const blush=new T.MeshLambertMaterial({color:0xce8877,transparent:true,opacity:.12});face.cheeks=[-1,1].map(side=>{const cheek=detail(.057,.025,.007,side*.173,-.06,.216);cheek.material=blush;return cheek;});
    model.userData.face=face;
    const sex=appearance.heroSex||appearance.sex||(appearance.type==='girl'?'female':'male'),job=appearance.heroJob||appearance.job||'classic';
    if(!robot&&appearance.type!=='cat')refine(T,model,{...appearance,job,sex});
    return face;
  }
  function refine(T,model,{job=model.userData.heroJob||'classic',sex=model.userData.heroSex||'male',type='human',hair=0x49312d}={}){
    const f=model?.userData?.face;if(!f||f.robot||type==='cat')return false;
    const female=sex==='female',head=model.userData.headMesh||(model.userData.head?.isMesh?model.userData.head:null);
    if(head?.material&&head.geometry?.attributes.uv){
      if(!f.skinTexture)f.skinTexture=skinSurface(T,{job,sex});
      if(f.skinTexture){
        // NPC hands can share their skin material. Clone only in that case;
        // an already unique head material needs no abandoned extra material.
        if(!head.material.userData.faceMaterial){let shared=false;model.traverse(o=>{if(o!==head&&o.material===head.material)shared=true;});if(shared)head.material=head.material.clone();head.material.userData={...head.material.userData,faceMaterial:true};}
        head.material.map=f.skinTexture;head.material.needsUpdate=true;
      }
    }
    const eyeY=female?.037:.032,eyeX=job==='chef'?.119:job==='archer'?.11:.114,browY=female?.077:.073;
    for(let i=0;i<f.eyes.length;i++){
      const side=i===0?-1:1,eye=f.eyes[i];eye.position.set(side*eyeX,f.headY+eyeY,f.surface(side*eyeX,eyeY));eye.scale.set(female?.65:.61,female?.71:.64,.55);
      f.whites[i].position.copy(eye.position);f.whites[i].position.z-=.005;f.whites[i].scale.set(female?1:.98,female?1:.9,.75);
      f.lids[i]?.position.copy(eye.position);if(f.lids[i]){f.lids[i].position.z+=.006;f.lids[i].material.color.setHex(female?0x6a4243:0x725343);}
      f.brows[i].position.set(side*eyeX,f.headY+browY,f.surface(side*eyeX,browY)+.004);f.brows[i].material.color.setHex(hair);f.brows[i].scale.set(female?.88:job==='smith'?1.12:1.03,female?.62:.92,.65);
    }
    f.baseEyeY=female?.71:.64;f.eyeWhiteY=female?1:.9;f.browY=f.headY+browY;f.profile={job,sex,originalArt:true,mapSize:f.skinTexture?MAP_SIZE:0};
    if(!f.sculptedMouth){f.mouth.geometry.dispose();f.mouth.geometry=ribbon(T,.113,.009,.009);f.mouth.material.side=T.DoubleSide;for(const lip of f.lips){lip.geometry.dispose();lip.geometry=ribbon(T,.102,.005,.007);lip.material.side=T.DoubleSide;}f.sculptedMouth=true;}
    f.mouth.position.z=f.surface(0,-.12)+.001;
    for(const lip of f.lips){lip.position.z=f.mouth.position.z+.002;lip.material.color.setHex(female?0xb2767e:0xad8274);}
    for(const cheek of f.cheeks)cheek.material.opacity=female?.10:.07;
    const rig=model.userData.head?.isGroup?model.userData.head:f.rig,nose=rig?.children.find(o=>o.name==='sculpted-nose'),bridge=rig?.children.find(o=>o.name==='nose-bridge');
    // Human sculpture owns the nose. Retain legacy named mounts for compatibility
    // without displaying a rod, sphere or floating nostril glued to the face.
    if(nose)nose.visible=false;if(bridge)bridge.visible=false;
    for(const nostril of rig?.children.filter(o=>o.name==='nostril')||[])nostril.visible=false;
    return true;
  }
  const moods=['calm','hurt','focus','happy','alert','cast','talk','tired'];
  function react(model,mood,seconds=1.5){const f=model?.userData?.face;if(!f||!moods.includes(mood))return false;f.reaction=mood;f.left=Math.max(.1,Math.min(6,seconds));return true;}
  function update(model,time,mood='calm'){
    const f=model?.userData?.face;if(!f||!Number.isFinite(time))return;
    const dt=f.time===null?0:Math.max(0,Math.min(.25,time-f.time));f.time=time;f.left=Math.max(0,f.left-dt);
    if(f.left>0&&mood!=='hurt')mood=f.reaction;
    f.mood=mood;
    const blink=((time+f.phase)%4.7)<.12;
    const hurt=mood==='hurt',focus=mood==='focus'||mood==='cast',happy=mood==='happy',alert=mood==='alert',talk=mood==='talk',tired=mood==='tired';
    for(let i=0;i<f.eyes.length;i++){const lid=blink?.08:hurt?.3:focus?.52:happy?.54:alert?.9:tired?.38:f.baseEyeY;f.eyes[i].scale.y=lid;f.whites[i].scale.y=lid/f.baseEyeY*(f.eyeWhiteY||1);if(f.pupils?.[i])f.pupils[i].position.x=(focus?0:Math.sin(time*.7+f.phase)*.002);}
    f.brows[0].rotation.z=hurt?-.3:focus?-.24:happy?.16:alert?.25:0;
    f.brows[1].rotation.z=-f.brows[0].rotation.z;
    for(const b of f.brows)b.position.y=(f.browY??(f.browY=b.position.y))+(alert?.025:tired?-.014:0);
    f.mouth.scale.set((hurt?.65:happy?1.2:alert?.55:1)*f.width,hurt?2.5:happy?1.6:alert?3:talk?1.5+Math.sin(time*15)*.8:mood==='cast'?2:1,1);
    for(let i=0;i<f.lids.length;i++){f.lids[i].scale.y=f.eyes[i].scale.y*.82;f.lids[i].rotation.z=focus?(i?-.12:.12):0;}
    for(let i=0;i<f.lips.length;i++){f.lips[i].scale.x=f.mouth.scale.x;f.lips[i].position.y=f.mouth.position.y+(i?-.006:.006)*f.mouth.scale.y;}
    f.teeth.position.z=f.mouth.position.z+.003;f.teeth.visible=happy;for(const c of f.cheeks)c.visible=!hurt&&!tired;
    for(const corner of f.corners)corner.visible=happy;
  }
  return Object.freeze({attach,refine,skinSurface,update,react,moods,MAP_SIZE});
});
