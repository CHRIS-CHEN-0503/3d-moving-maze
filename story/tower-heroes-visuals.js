/* Authored silhouettes with compact static batches; reuse the game's lights.
   Each gear owns one optional 128px original atlas. No extra lights, post
   effects, texture downloads or per-frame geometry allocation. */
(function(root){'use strict';const H=root.TowerHeroes;
  const MASTERWORK=Object.freeze({
    4:Object.freeze({metal:0xbfc5df,trim:0xe3dcec,wood:0x493953,dark:0x342b48,gem:0xc6a4f1,cloth:0x5c527f}),
    5:Object.freeze({metal:0xd2e7e1,trim:0xf0d298,wood:0x2c514b,dark:0x1c383e,gem:0x95eedb,cloth:0x2f615c}),
  });
  const ROBOT_LOOKS=Object.freeze({male:Object.freeze({metal:0x687c88,trim:0xc1a474,dark:0x263a45,face:0xb7c6c9,core:0x72dce9,name:'鐵衡'}),female:Object.freeze({metal:0xdad5bd,trim:0xbb9663,dark:0x4b554c,face:0xeee5c9,core:0x91dfa8,name:'鈴芯'})});
  const ROBOT_CORE_COLORS=Object.freeze([0x48a8ff,0xf6f9ff,0xffd04d,0xa7eeee,0xd2b1f5]);
  function robotLight(equipment){if(H.ROBOT?.coreLight)return H.ROBOT.coreLight(equipment);const tier=Math.max(1,...['core1','core2'].map(slot=>{const g=equipment?.[slot];return H.GEAR[g?.kind]?.baseKind==='robot_core'?H.GEAR[g.kind].tier:0;}));return {tier,color:ROBOT_CORE_COLORS[tier-1]};}
  function robotHalo(T,group,points,color){
    const size=32,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),a=Math.max(0,1-r);const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*a*210);}
    const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.needsUpdate=true;texture.magFilter=texture.minFilter=T.LinearFilter;texture.userData={owner:'robot-glow',originalArt:true,byteBudget:4096};
    const material=new T.SpriteMaterial({map:texture,color,transparent:true,opacity:.46,blending:T.AdditiveBlending,depthWrite:false,depthTest:true});material.userData.robotGlow=true;
    for(const [x,y,z,r]of points){const halo=new T.Sprite(material);halo.name='robot-core-soft-glow';halo.position.set(x,y,z);halo.scale.set(r,r,1);group.add(halo);}
  }
  function colorRobotEnergy(model,info){model.traverse(p=>{for(const m of Array.isArray(p.material)?p.material:[p.material])if(m?.userData.robotEnergy){m.color.setHex(info.color);m.emissive?.setHex(info.color);m.emissiveIntensity=.74;}else if(m?.userData.robotGlow)m.color.setHex(info.color);});model.userData.robotLightTier=info.tier;model.userData.robotLightColor=info.color;}
  // Every articulated group owns its materials, so the existing scene disposer
  // can retire a changed fist or shell without invalidating another joint.
  function robotParts(T,sex,tier=1){
    const look={...ROBOT_LOOKS[sex==='female'?'female':'male']},master=MASTERWORK[tier];if(tier===2)look.metal=sex==='female'?0xe5dcc5:0x8b9da5;if(tier===3){look.metal=sex==='female'?0xe6e5d4:0xa3bbc5;look.trim=0xe3c18a;}if(master){look.metal=master.metal;look.trim=master.trim;}
    const group=new T.Group(),materials=new Map();
    const mesh=(geometry,color,x=0,y=0,z=0,name='robot-plated-surface')=>{if(!materials.has(color)){const energy=color===look.core,material=new T.MeshPhongMaterial({color,emissive:energy?color:0,emissiveIntensity:energy?.74:0,specular:0x82949a,shininess:42});material.userData.surface=energy?'robot-energy':'metal';material.userData.robotEnergy=energy;materials.set(color,material);}const part=new T.Mesh(geometry,materials.get(color));part.position.set(x,y,z);part.name=name;group.add(part);return part;};
    const soft=(w,h,d,c,x=0,y=0,z=0,name)=>{const geometry=new T.SphereGeometry(1,12,8);geometry.scale(w/2,h/2,d/2);return mesh(geometry,c,x,y,z,name);};
    const bevel=(w,h,d,c,x=0,y=0,z=0,name)=>mesh(root.CharacterSculpt?root.CharacterSculpt.roundedBox(T,w,h,d):new T.SphereGeometry(.15,8,6),c,x,y,z,name);
    const ring=(r,t,c,x=0,y=0,z=0,name='robot-inlaid-ring')=>mesh(new T.TorusGeometry(r,t,4,16),c,x,y,z,name);
    const scroll=(points,x,y,z,r=.008)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),points.length*3,r,4,false),look.trim,x,y,z,'robot-flush-engraving');
    return {group,look,mesh,soft,bevel,ring,scroll,finish:()=>batchGear(T,group)};
  }
  function robotGear(T,kind,appearance={},definition={}){
    const sex=appearance.sex==='female'?'female':'male',female=sex==='female',tier=definition.tier||1,baseKind=definition.baseKind||kind,p=robotParts(T,sex,tier),{look,soft,bevel,ring,scroll,mesh}=p,g=p.group;
    g.name='hero-gear-'+kind;Object.assign(g.userData,{tier,baseKind,wearVariant:sex,adultDesign:true,integratedRobotPart:true,detailEdition:3});
    if(baseKind==='robot_fists'){
      // Knuckle pads face +Z. No handle, shield or backwards striking face.
      g.userData.contact={kind:'knuckle-face',center:[0,0,.16],normal:[0,0,1],axis:[0,0,1],grip:[0,0,0]};
      const gradeSpan=1+(tier-1)*.09;
      soft((female?.27:.32)*gradeSpan,.24,.28,look.dark,0,0,0,'robot-palm-chassis');
      for(let i=0;i<3;i++){const x=(i-1)*(female?.077:.089)*gradeSpan;bevel(.08*gradeSpan,.145,.1,look.metal,x,.025,.125,'robot-forward-knuckle');soft(.076*gradeSpan,.052,.025,look.trim,x,.075,.18,'robot-knuckle-inlay');}
      soft(.085*gradeSpan,.14,.125,look.metal,.135*gradeSpan,-.055,.055,'robot-opposed-thumb');
      const cuff=ring((female?.145:.167)*gradeSpan,.023+tier*.001,look.trim,0,.105,-.065,'robot-forged-wrist');cuff.rotation.x=Math.PI/2;
      scroll([[-.11,0,0],[0,.07,.01],[.11,0,0]],0,-.07,.155,.007);
      if(tier>1)soft(.045,.045,.018,look.core,0,-.01,.191,'robot-tier-core');
      if(tier>=3)for(const side of [-1,1]){const rail=bevel(.065,.17,.12,look.trim,side*.145*gradeSpan,.02,.02,'robot-layered-punch-rail');rail.rotation.z=-side*.18;}
      if(tier>=4)scroll([[-.11,.02,0],[-.06,-.035,0],[0,.015,.01],[.06,-.035,0],[.11,.02,0]],0,-.10,.157,.009);
      const rearSocket=mesh(new T.CylinderGeometry(.052+tier*.004,.052+tier*.004,.018,8),look.trim,0,.018,-.144,'robot-fist-rear-coupling');rearSocket.rotation.x=Math.PI/2;
      if(tier>=3)for(const side of [-1,1]){const slit=mesh(new T.BoxGeometry(.018,.09,.012),look.dark,side*.076*gradeSpan,.013,-.141,'robot-fist-rear-vent');slit.rotation.z=side*.25;}
      if(tier>=4){const pin=mesh(new T.CylinderGeometry(.022,.022,.022,8),look.core,0,.018,-.151,'robot-fist-rear-power-pin');pin.rotation.x=Math.PI/2;}
    }else{
      const step=tier-1,w=(female?.66:.8)+step*(female?.062:.075),h=(female?.61:.64)+step*.018,y=1.08,depth=.49+step*.06;
      const body=soft(w,h,depth,look.metal,0,y,0,'robot-continuous-chest-shell');body.userData.robotShell=true;
      for(const side of [-1,1]){
        const shoulderX=side*((female?.365:.455)+step*.018),shoulderW=(female?.28:.35)+step*.062;
        soft(shoulderW,.25+step*.055,.42+step*.052,look.metal,shoulderX,1.33+step*.018,-.015,'robot-overlapping-pauldron');
        if(tier>=2){const plate=soft(shoulderW*.92,.11+step*.022,.38+step*.046,look.trim,shoulderX,1.39+step*.025,.055,'robot-layered-shoulder-rim');plate.rotation.z=-side*.17;}
        scroll([[side*.02,.17,0],[side*.16,.16,-.015],[side*(w*.35),.08,-.04],[side*(w*.32),-.12,-.045],[side*.07,-.19,-.012]],0,y,depth*.47);
        soft(.075+step*.013,.24,.085+step*.01,look.trim,side*(.26+step*.02),.78,.095,'robot-contoured-waist-fillet');
        for(const a of [0,1])soft(.024,.024,.014,look.trim,side*(.22-a*.05),1.23-a*.24,depth*.44,'robot-forged-rivet');
        if(tier>=4){const guard=bevel(shoulderW*.63,.18+step*.014,.15,look.dark,shoulderX,1.40+step*.031,.2+step*.015,'robot-fortress-shoulder-guard');guard.rotation.z=-side*.12;scroll([[side*.02,.06,0],[side*.08,.0,.02],[0,-.07,.025],[-side*.08,0,.02],[-side*.02,.06,0]],shoulderX,1.42+step*.023,.28+step*.012,.009);}
      }
      const coreZ=depth*.5+.015,bezel=ring((female?.111:.13)+step*.011,.024+step*.003,look.trim,0,1.115,coreZ,'robot-core-bezel');bezel.scale.z=.7;
      soft((female?.15:.18)+step*.018,(female?.15:.18)+step*.018,.075+step*.008,look.core,0,1.115,coreZ+.017,'robot-energy-core');
      if(tier>=2)for(const side of [-1,1])scroll([[side*.06,.04,0],[side*.15,.075,-.012],[side*(w*.36),.02,-.03]],0,1.25,depth*.47,.008);
      // One rounded hip plate follows the pelvis, no square rear belt block.
      soft((female?.5:.61)+step*.026,.23+step*.012,.34+step*.022,look.metal,0,.72,-.005,'robot-rounded-pelvis');
      scroll([[-.15,0,0],[0,-.09,.025],[.15,0,0]],0,.765,.166);
      if(tier>=3){for(const side of [-1,1])scroll([[side*.12,.07,0],[side*(w*.4),0,-.03],[side*(w*.32),-.12,-.04]],0,y,depth*.50,.008);}
      if(tier>=4)for(const side of [-1,1]){const jewel=mesh(new T.OctahedronGeometry(.037+step*.005),look.core,side*.21,1.25,depth*.46,'robot-masterwork-inlay');jewel.scale.z=.45;}
      if(tier===5){const keel=bevel(.15,.34,.12,look.dark,0,.94,depth*.46,'robot-abyss-heart-guard');keel.rotation.z=Math.PI/4;scroll([[-.06,.14,0],[0,.09,.025],[.06,.14,0],[0,-.09,.025],[-.06,.14,0]],0,.98,depth*.53,.011);}
      // Flush, low-face rear engineering follows the ellipsoid instead of
      // hanging a square backpack off the pelvis. It shares the shell batch.
      const rearZ=(x,y,lift=0)=>-depth*.5*Math.sqrt(Math.max(.07,1-(x/(w*.5))**2-((y-1.08)/(h*.5))**2))-lift;
      const rearPlate=(points,color,name,lift=.014)=>{
        if(points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-q[0]*p[1];},0)<0)points=points.slice().reverse();
        const cx=points.reduce((n,a)=>n+a[0],0)/points.length,cy=points.reduce((n,a)=>n+a[1],0)/points.length,positions=[],vertices=points.map(([x,y])=>[x,y,rearZ(x,y,.002)]),inset=points.map(([x,y])=>{x=cx+(x-cx)*.82;y=cy+(y-cy)*.82;return [x,y,rearZ(x,y,lift)];}),center=[cx,cy,rearZ(cx,cy,lift)];
        const tri=(a,b,c)=>positions.push(...a,...b,...c);
        for(let i=0;i<points.length;i++){const j=(i+1)%points.length;tri(center,inset[j],inset[i]);tri(inset[i],inset[j],vertices[j]);tri(inset[i],vertices[j],vertices[i]);}
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return mesh(geo,color,0,0,0,name);
      };
      const spineCount=3+Math.floor(step/2),spineW=(female?.085:.10)+step*.006;
      for(let i=0;i<spineCount;i++){const sy=.96+i*(.27/(spineCount-1)),sw=spineW*(i===0?.78:1);rearPlate([[-sw*.5,sy-.038],[0,sy-.052],[sw*.5,sy-.038],[sw*.5,sy+.034],[0,sy+.044],[-sw*.5,sy+.034]],i%2?look.trim:look.dark,'robot-rear-spine-segment',.025);}
      for(const side of [-1,1]){
        const vx=side*w*.245,vw=w*(female?.146:.155),vy=1.12,vh=.23+step*.012;
        rearPlate([[vx-vw*.5,vy-vh*.5],[vx+vw*.5,vy-vh*.5],[vx+vw*.5,vy+vh*.5],[vx-vw*.5,vy+vh*.5]],look.dark,'robot-rear-vent-recess',.007);
        for(let i=0;i<3+Math.floor(step/2);i++){const sy=vy-vh*.36+i*vh*.72/(2+Math.floor(step/2)),slant=side*(female?.018:.011);rearPlate([[vx-vw*.43,sy-.007-slant],[vx+vw*.43,sy-.007+slant],[vx+vw*.43,sy+.007+slant],[vx-vw*.43,sy+.007-slant]],look.trim,'robot-rear-cooling-slat',.021);}
        const pts=[[side*w*.08,1.31],[side*w*.255,1.28],[side*w*.35,1.10],[side*w*.22,.94]].map(([x,y])=>new T.Vector3(x,y,rearZ(x,y,.022)));
        mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),8,.009+step*.001,3,false),tier>=3?look.core:look.trim,0,0,0,'robot-rear-energy-pipe');
        if(tier>=2)rearPlate([[side*w*.08,.91],[side*w*.30,.96],[side*w*.29,.995],[side*w*.09,.94]],look.trim,'robot-rear-lower-armor-seam',.018);
      }
      if(tier>=3){const radius=.058+step*.004,cy=1.035,hex=Array.from({length:female?8:6},(_,i)=>{const a=i*Math.PI*2/(female?8:6);return [Math.sin(a)*radius,cy+Math.cos(a)*radius];});rearPlate(hex,look.trim,'robot-rear-core-cover',.038);const cap=mesh(new T.CylinderGeometry(radius*.6,radius*.6,.018,female?8:6),look.core,0,cy,rearZ(0,cy,.044),'robot-rear-core-seal');cap.rotation.x=Math.PI/2;}
      if(tier>=4)for(const side of [-1,1]){const cy=1.035;rearPlate([[side*.012,cy-.035],[side*.032,cy-.009],[side*.012,cy+.037],[side*.006,cy+.004]],look.core,'robot-rear-core-engraving',.061);rearPlate([[side*w*.065,1.29],[side*w*.20,1.33],[side*w*.29,1.29],[side*w*.28,1.26],[side*w*.20,1.29],[side*w*.065,1.265]],look.trim,'robot-rear-shoulder-crest',.025);}
      if(tier===5)rearPlate([[-w*.16,.885],[-w*.08,.86],[0,.895],[w*.08,.86],[w*.16,.885],[0,.925]],look.dark,'robot-rear-abyss-chevron',.025);
    }
    // ROBOT_NECK_CLEARANCE_BEGIN
    // Forge a neck saddle into the existing chest and inner shoulder faces.
    // The outboard armor stays thick; only the inboard top is chamfered so
    // the compact head and ear bearings can turn without entering the shell.
    // This construction-time deformation keeps every original vertex/index
    // and shares the existing batches, materials, core halos and light rig.
    if(baseKind==='robot_shell'){
      const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},point=new T.Vector3(),inverse=new T.Matrix4();
      for(const part of g.children){if(!part.isMesh)continue;part.updateMatrix();inverse.copy(part.matrix).invert();const position=part.geometry.attributes.position;let changed=false;
        for(let i=0;i<position.count;i++){
          point.fromBufferAttribute(position,i).applyMatrix4(part.matrix);const x=Math.abs(point.x),weight=1-ease(.32,.355,x),cap=(female?1.27:1.335)+.16*ease(.24,.32,x);
          if(weight<=0||point.y<=cap)continue;const rise=point.y-cap,roundedCap=cap+rise/(1+rise/.010);point.y-=(point.y-roundedCap)*weight;point.applyMatrix4(inverse);position.setXYZ(i,point.x,point.y,point.z);changed=true;
        }
        if(changed){position.needsUpdate=true;part.geometry.computeVertexNormals();part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();}
      }
      g.userData.robotNeckClearance=true;
    }
    // ROBOT_NECK_CLEARANCE_END
    const finished=p.finish();
    if(baseKind==='robot_shell')for(const [key,side]of [['legR',-1],['legL',1]]){
      const leg=robotParts(T,sex,tier),step=tier-1,width=(female?.225:.275)+step*.035,z=.155+step*.013;
      leg.soft(width,.165+step*.028,.10+step*.023,look.metal,0,-.30,z,'robot-tier-knee-plate');
      leg.soft(width*.88,.23+step*.029,.075+step*.022,look.metal,0,-.45,z-.006,'robot-tier-shin-plate');
      leg.scroll([[-width*.32,.065,0],[0,-.07,.021],[width*.32,.065,0]],0,-.30,z+.07+step*.012,.007+step*.001);
      if(tier>=3)leg.scroll([[-width*.32,.07,0],[0,-.065,.018],[width*.32,.07,0]],0,-.45,z+.06+step*.01,.007);
      if(tier>=4){const crest=leg.mesh(new T.OctahedronGeometry(.035+step*.006),look.core,0,-.30,z+.089+step*.012,'robot-energy-knee-inlay');crest.scale.z=.42;}
      const plate=leg.finish();plate.name='robot-articulated-leg-armor';plate.userData.robotJoint=key;plate.position.set(side*(female?.15:.18),.63,0);finished.add(plate);finished.userData.sourceParts+=plate.userData.sourceParts;finished.userData.renderParts+=plate.userData.renderParts;
    }
    if(baseKind==='robot_shell'){const step=tier-1,depth=.49+step*.06,points=[[0,1.115,depth*.5+.068,.38+step*.012]];if(tier>=3)points.push([0,1.035,-depth*.5-.070,.24+step*.01]);robotHalo(T,finished,points,ROBOT_CORE_COLORS[0]);}
    return finished;
  }
  function robotBase(T,sex='male',identity='hero'){
    const female=sex==='female',look=ROBOT_LOOKS[female?'female':'male'],m=new T.Group();m.name='robot-'+look.name;
    // A complete bare machine remains after a shell breaks. Armor upgrades
    // replace only the fitted torso layer; arms/legs and facial rig stay alive.
    const chassis=robotParts(T,sex),c=chassis.look;
    chassis.soft(female?.59:.72,.55,.4,c.dark,0,1.05,0,'robot-base-chassis');
    for(const y of [.77,.84,.91]){const r=chassis.ring(female?.2:.245,.025,c.trim,0,y);r.rotation.x=Math.PI/2;r.scale.y=.72;}
    chassis.soft(female?.48:.57,.23,.29,c.dark,0,.69,-.005,'robot-round-base-pelvis');
    const bareCore=new T.SphereGeometry(1,8,6);bareCore.scale(.083,.083,.036);chassis.mesh(bareCore,c.core,0,1.09,.224,'robot-innate-core');const bareBezel=chassis.mesh(new T.TorusGeometry(.093,.017,4,8),c.trim,0,1.09,.223,'robot-innate-core-bezel');bareBezel.scale.z=.65;
    const body=chassis.finish();robotHalo(T,body,[[0,1.09,.272,.34]],ROBOT_CORE_COLORS[0]);m.add(body);
    const head=new T.Group();head.position.y=female?1.60:1.655;m.add(head);
    const scalp=robotParts(T,sex),headPlate=scalp.soft(female?.53:.56,female?.58:.54,.5,c.metal,0,0,-.015,'robot-seamless-cranium');
    scalp.soft(female?.438:.46,.41,.107,c.face,0,-.025,.205,'robot-rounded-faceplate');
    scalp.scroll([[-.18,.16,-.015],[0,.25,-.02],[.18,.16,-.015]],0,.035,.183,.012);
    for(const side of [-1,1]){const ear=scalp.mesh(new T.CylinderGeometry(.13,.13,.065,12),c.trim,side*.273,0,-.025,'robot-ear-joint');ear.rotation.z=Math.PI/2;const inset=scalp.mesh(new T.CylinderGeometry(.08,.08,.071,12),c.dark,side*.273,0,-.025,'robot-ear-inset');inset.rotation.z=Math.PI/2;}
    head.add(scalp.finish());
    // Seat the head closer to the shoulder housing, keeping the short joint
    // overlapping both the chin and chassis instead of leaving a long stalk.
    const neck=robotParts(T,sex),neckJoint=new T.CylinderGeometry(.12,.12,.095,12);
    // ROBOT_NECK_FOOT_BEGIN
    // Sink the existing lower ring into the neck saddle. The visible upper
    // bearing remains short; its hidden foot bridges to the chest without
    // another mesh, collar or per-frame adjustment.
    const neckPosition=neckJoint.attributes.position;for(let i=0;i<neckPosition.count;i++)if(neckPosition.getY(i)<0)neckPosition.setY(i,neckPosition.getY(i)-.0525);neckJoint.computeVertexNormals();
    // ROBOT_NECK_FOOT_END
    neck.mesh(neckJoint,c.dark,0,1.37,-.012,'robot-neck-joint');m.add(neck.finish());
    const limbs={};for(const [key,side]of [['armR',-1],['armL',1]]){
      const joint=new T.Group();joint.position.set(side*(female?.405:.49),1.30,0);joint.name=key;const p=robotParts(T,sex);
      p.soft(female?.19:.24,.22,.23,c.dark,0,-.055,0,'robot-shoulder-ball');p.soft(female?.2:.245,.33,.22,c.metal,0,-.22,0,'robot-rounded-upper-arm');p.soft(female?.22:.27,.3,.255,c.metal,0,-.42,.005,'robot-forearm-shell');
      const r=p.ring(female?.12:.145,.022,c.trim,0,-.36,.01);r.rotation.x=Math.PI/2;p.scroll([[-.06,0,0],[0,-.11,.01],[.06,0,0]],0,-.40,.13,.007);joint.add(p.finish());m.add(joint);limbs[key]=joint;
      const hand=robotParts(T,sex);hand.soft(female?.2:.235,.19,.23,c.dark,0,0,0,'robot-bare-fist');const fist=hand.finish();fist.position.set(0,-.53,.07);joint.add(fist);limbs[key+'BareFist']=fist;
    }
    for(const [key,side]of [['legR',-1],['legL',1]]){const joint=new T.Group();joint.name=key;joint.position.set(side*(female?.15:.18),.63,0);const p=robotParts(T,sex);
      p.soft(female?.23:.29,.34,.27,c.metal,0,-.125,0,'robot-rounded-thigh');p.soft(.21,.18,.235,c.dark,0,-.31,.025,'robot-knee-joint');p.soft(female?.24:.3,.29,.27,c.metal,0,-.405,.005,'robot-continuous-shin');p.bevel(female?.29:.35,.18,.40,c.metal,0,-.55,.075,'robot-beveled-foot');p.scroll([[-.075,0,0],[0,-.08,.015],[.075,0,0]],0,-.40,.146,.008);joint.add(p.finish());m.add(joint);limbs[key]=joint;}
    m.scale.set(female?.95:1.04,female?.95:1.03,1);
    Object.assign(m.userData,{...limbs,body,head,headMesh:headPlate,frontAxis:'+Z',sculpted:true,heroJob:'robot',heroSex:sex,heroShape:female?'rounded-machine':'heavy-machine',heroVariant:'robot-'+sex,heroIdentityStyle:identity==='hero'?'protagonist':'traveller',adultDesign:true,heroPieces:[],baseClothing:[body],robotLook:look.name});
    const eyes=[-1,1].map(side=>{const geo=new T.SphereGeometry(1,10,6);geo.scale(female?.037:.033,female?.046:.036,.018);const eye=new T.Mesh(geo,new T.MeshBasicMaterial({color:c.core}));eye.position.set(side*.116,.03,.266);head.add(eye);return eye;});
    if(root.CharacterFace){const face=root.CharacterFace.attach(T,m,head,eyes,0,true,{job:'robot',sex});face.baseEyeY=female?.92:.76;face.browY=.103;face.width=female?1.06:.95;for(const part of [...face.brows,face.mouth,...face.corners])part.material.color.setHex(c.dark);for(const cheek of face.cheeks)cheek.material.opacity=0;for(const white of face.whites)white.material.color.setHex(female?0xeff4db:0xd3edf0);}
    colorRobotEnergy(m,robotLight({}));root.CharacterMotion?.prepare(m);return m;
  }
  function batchGear(T,g){
    const parts=g.children.filter(o=>o.isMesh),buckets=new Map(),kept=new Set();
    // Keep the shaped body/cap and nocked arrow independently addressable.
    for(const type of ['LatheGeometry','SphereGeometry']){const p=parts.find(o=>o.geometry.type===type);if(p&&!g.userData.bookSide)kept.add(p);}
    for(const p of parts)if(p.name==='bow-nocked-arrow')kept.add(p);
    for(const p of parts){if(kept.has(p))continue;const key=(p.material.userData.surface||'fabric')+'-'+p.material.side;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
    const retiredGeometry=new Set(),retiredMaterial=new Set();g.userData.authoredParts=parts.map(p=>p.name).filter(Boolean);g.userData.sourceParts=parts.length;
    for(const [surface,list]of buckets){if(list.length<2)continue;const position=[],normal=[],color=[],uv=[];
      for(const p of list){p.updateMatrix();const geo=p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone();geo.applyMatrix4(p.matrix);const xyz=geo.attributes.position,norm=geo.attributes.normal,c=p.material.color;
        for(let i=0;i<xyz.count;i++){position.push(xyz.getX(i),xyz.getY(i),xyz.getZ(i));normal.push(norm.getX(i),norm.getY(i),norm.getZ(i));uv.push(geo.attributes.uv?.getX(i)||0,geo.attributes.uv?.getY(i)||0);const energy=p.material.userData.robotEnergy,shade=.96+.04*Math.max(-1,Math.min(1,norm.getY(i)));color.push(energy?1:c.r*shade,energy?1:c.g*shade,energy?1:c.b*shade);}
        geo.dispose();g.remove(p);retiredGeometry.add(p.geometry);retiredMaterial.add(p.material);
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(position,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geo.setAttribute('color',new T.Float32BufferAttribute(color,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeBoundingSphere();
      const material=list[0].material.clone();if(!material.userData.robotEnergy)material.color.setHex(0xffffff);material.vertexColors=true;const m=new T.Mesh(geo,material);m.name='equipment-'+surface+'-batch';m.userData.staticBatch=true;g.add(m);
    }
    const liveGeometry=new Set(g.children.map(p=>p.geometry)),liveMaterial=new Set(g.children.map(p=>p.material));for(const x of retiredGeometry)if(!liveGeometry.has(x))x.dispose();for(const x of retiredMaterial)if(!liveMaterial.has(x))x.dispose();g.userData.renderParts=g.children.length;return g;
  }
  function gear(T,kind,appearance={}){
    if(H.GEAR[kind]?.baseKind==='robot_core'){
      const tier=H.GEAR[kind].tier,p=robotParts(T,appearance.sex,tier);p.look.core=ROBOT_CORE_COLORS[tier-1];const frame=p.mesh(new T.CylinderGeometry(.13+tier*.005,.13+tier*.005,.10+tier*.004,6+tier*2),p.look.trim,0,0,0,'robot-core-casing');frame.rotation.x=Math.PI/2;const stone=p.mesh(new T.OctahedronGeometry(.088+tier*.006),p.look.core,0,0,.076,'robot-core-crystal');stone.scale.z=.68;p.ring(.076+tier*.006,.012,p.look.dark,0,0,.068,'robot-core-socket');for(const side of [-1,1])p.bevel(.048,.037,.035,p.look.dark,side*.13,0,.023,'robot-core-coupling');const g=p.finish();g.name='hero-gear-'+kind;Object.assign(g.userData,{tier,baseKind:'robot_core',wearVariant:appearance.sex||'male',adultDesign:true,detailEdition:1});return g;
    }
    if((H.GEAR[kind]?.baseKind||kind)==='robot_shell'||(H.GEAR[kind]?.baseKind||kind)==='robot_fists')return robotGear(T,kind,appearance,H.GEAR[kind]);
    const g=new T.Group(),definition=H.GEAR[kind],tier=definition?.tier||1,female=appearance.sex==='female',job=appearance.job||definition?.jobs?.[0]||'swordsman',look=style(job,female?'female':'male'),master=MASTERWORK[tier],atlas=root.EquipmentSurfaces?.create(T,{tier,job,kind,sex:female?'female':'male'},root.document)||null;g.name='hero-gear-'+kind;Object.assign(g.userData,{tier,baseKind:definition?.baseKind||kind,wearVariant:female?'female':'male',adultDesign:true,surfaceAtlasSize:atlas?128:0,detailEdition:2});kind=g.userData.baseKind;const materials=new Map();
    let meshDestination=g;
    // Higher grades retain the fitted adult silhouette. Their cloth/metal
    // pairing is readable in dim corridors, without glow lights or extra rigs.
    if(master){look.cloak=master.cloth;look.accent=master.trim;look.leather=master.wood;}
    const mesh=(geo,c,x=0,y=0,z=0,surface='')=>{surface=surface||(c===look.skin?'skin':[gold,iron,dark,0xc9dde0].includes(c)?'metal':[wood,look.leather].includes(c)?'leather':[0x8de8cf,0x95c9ef,0xbab2f2].includes(c)?'gem':'fabric');const textured=atlas&&root.EquipmentSurfaces.REGIONS[surface];if(textured)root.EquipmentSurfaces.coordinates(T,geo,surface);const key=meshDestination.name+':'+c+':'+surface;if(!materials.has(key)){const m=new T.MeshPhongMaterial({color:c,map:textured?atlas:null,bumpMap:textured?atlas:null,bumpScale:surface==='metal'?.0035:surface==='leather'?.006:.003,specular:surface==='metal'?0x8997a2:surface==='gem'?0xaaaaaa:0x232822,shininess:surface==='metal'?62:surface==='gem'?76:surface==='leather'?14:7});m.userData.surface=surface;m.userData.originalSurface=!!textured;materials.set(key,m);}const m=new T.Mesh(geo,materials.get(key));m.position.set(x,y,z);meshDestination.add(m);return m;};
    const box=(w,h,d,c,x=0,y=0,z=0)=>mesh(root.CharacterSculpt?root.CharacterSculpt.roundedBox(T,w,h,d):new T.BoxGeometry(w,h,d),c,x,y,z),rod=(r,h,c,x=0,y=0,z=0)=>mesh(new T.CylinderGeometry(r,r,h,10),c,x,y,z),soft=(w,h,d,c,x=0,y=0,z=0)=>{const m=mesh(new T.SphereGeometry(1,12,8),c,x,y,z);m.scale.set(w/2,h/2,d/2);return m;},body=(w,h,d,c,y)=>{const geo=female?new T.LatheGeometry([[0,-.5],[.43,-.48],[.47,-.3],[.35,.02],[.49,.3],[.4,.43],[.25,.5],[0,.5]].map(([r,y])=>new T.Vector2(r*w,y*h)),12):root.CharacterSculpt?root.CharacterSculpt.torso(T,w,h,d):new T.BoxGeometry(w,h,d);if(female)geo.scale(1,1,d/w);return mesh(geo,c,0,y);},gold=master?.trim??(tier===3?0xf3d390:0xd9bb75),iron=master?.metal??(tier===3?0xcce2e8:tier===2?0xb2c9d2:female?0xb8cbd7:0x9aafbe),wood=master?.wood??(tier===3?0x495f4a:tier===2?0x785d51:0x72523e),dark=master?.dark??(tier===3?0x284753:0x354d60);
    const neck=(color,y,z)=>{const s=new T.Shape();s.moveTo(-.12,.13);s.lineTo(.12,.13);s.lineTo(0,-.1);s.closePath();return mesh(new T.ShapeGeometry(s),color,0,y,z);};
    const coat=(color,y=.58)=>{for(const side of [-1,1]){const tail=box(female?.23:.28,female?.48:.3,.07,color,side*.19,y,-.12);tail.rotation.z=side*(female?.13:.04);tail.name=female?'female-split-coat':'male-short-coat';}};
    const inlay=(points,c,x=0,y=0,z=0,name='raised-inlay',radius=.009)=>{const curve=new T.CatmullRomCurve3(points.map(([px,py,pz=0])=>new T.Vector3(px,py,pz)));const part=mesh(new T.TubeGeometry(curve,Math.max(4,points.length*2),radius,4,false),c,x,y,z,'metal');part.name=name;return part;};
    const herald=(x,y,z,r=.07,c=gold)=>{const motifs={swordsman:[[0,.85],[.7,.55],[.5,-.2],[0,-.85],[-.5,-.2],[-.7,.55]],mage:[[0,1],[.63,0],[0,-1],[-.63,0]],scout:[[-.6,.9],[.35,-.5],[.05,-.9],[-.35,-.5],[.6,.9],[0,.1]],chef:[[-.75,.3],[-.55,-.65],[.55,-.65],[.75,.3]],healer:[[0,-1],[.6,-.25],[.25,1],[0,.55],[-.25,1],[-.6,-.25]],smith:[[-.9,.4],[.9,.4],[.5,-.2],[.3,-.25],[.4,-.75],[-.4,-.75],[-.3,-.25],[-.5,-.2]],archer:[[0,-1],[.75,.15],[.2,1],[-.15,.55],[-.75,.15]]},points=motifs[job]||motifs.swordsman,s=new T.Shape();s.moveTo(points[0][0]*r,points[0][1]*r);for(const p of points.slice(1))s.lineTo(p[0]*r,p[1]*r);s.closePath();const m=mesh(new T.ShapeGeometry(s),c,x,y,z,'metal');m.name='profession-raised-heraldry';return m;};
    const rivet=(x,y,z,r=.016)=>{const m=mesh(new T.CylinderGeometry(r,r,.009,6),gold,x,y,z,'metal');m.rotation.x=Math.PI/2;m.name='forged-rivet';return m;};
    const grip=(x,y,z,length=.25)=>{for(let i=0;i<4;i++){const ring=mesh(new T.TorusGeometry(.042,.006,3,8),look.accent,x,y-length/2+(i+.5)*length/4,z,'fabric');ring.rotation.x=Math.PI/2;ring.name='wrapped-grip';}};
    if(['longsword','greatsword','twin_daggers'].includes(kind)){const big=kind==='greatsword',small=kind==='twin_daggers',length=(big?1.1:small?.4:.72)*(1+(tier-1)*.045),width=(big?.17:small?.07:.1)*(1+(tier-1)*.15);rod(.04,big?.4:.25,wood,0,big?-.125:-.05);const guard=box((big?.42:.28)+(tier-1)*.035,.055,.08,gold,0,.1);guard.rotation.z=tier===3?.13:0;const blade=new T.Shape();blade.moveTo(-width/2,0);blade.lineTo(-width/2,length*.78);blade.lineTo(0,length+.11);blade.lineTo(width/2,length*.78);blade.lineTo(width/2,0);blade.closePath();const steel=new T.ExtrudeGeometry(blade,{depth:.018,bevelEnabled:true,bevelThickness:.011,bevelSize:width*.16,bevelSegments:1,steps:1});steel.translate(0,0,-.009);mesh(steel,iron,0,.14).name='forged-tapered-blade';rod(.055,.055,gold,0,big?-.345:-.195);if(tier>1)for(const side of [-1,1]){const fin=box(.055,.14,.045,gold,side*(big?.18:.12),.155);fin.rotation.z=-side*.45;}}
    else if(kind==='arcane_staff'){rod(.035,1.3,wood,0,.35);for(const y of [-.2,.76])rod(.06,.1,gold,0,y);const crown=mesh(new T.TorusGeometry(.2,.035,5,12),gold,0,1.1);crown.rotation.y=.2;if(master)crown.scale.set(tier===4?.85:1.18,tier===4?1.2:.92,1);mesh(new T.OctahedronGeometry(.13+tier*.012),master?.gem||0xbab2f2,0,1.1,0,'gem');if(tier>1){const orbit=mesh(new T.TorusGeometry(.24,.018,4,16,Math.PI*1.6),iron,0,1.1);orbit.rotation.set(.55,.6,master?tier===4?.6:-.45:.25);}if(tier>=3)for(const side of [-1,1]){const arm=box(.035,.28,.04,gold,side*.155,.85);arm.rotation.z=-side*.55;}}
    else if(kind==='spellbook'){
      // The two real covers hinge around the spine. Each leaf owns its surface
      // materials, so batching/disposal never retires the other leaf's material.
      for(const side of [-1,1]){const leaf=new T.Group();leaf.name=side<0?'book-left-leaf':'book-right-leaf';leaf.userData.bookSide=side;g.add(leaf);meshDestination=leaf;
        box(.29,.07,master?.45+(tier-3)*.025:.45,master?dark:0x46757f,side*.14,0,.07).name='book-bound-cover';
        mesh(root.CharacterSculpt?root.CharacterSculpt.roundedBox(T,.25,.05,master?.4+(tier-3)*.025:.4):new T.BoxGeometry(.25,.05,master?.4+(tier-3)*.025:.4),0xf3ddad,side*.14,.055,.07,'paper').name='book-bound-pages';
        for(const y of [.062,.079])box(.13,.007,.014,0x89785e,side*.15,y,.09).name='book-page-script';
        if(tier>1)for(const z of [-.1,.23])box(.055,.02,.055,gold,side*.24,.04,z);
      }
      meshDestination=g;box(.035,.025,.33,gold,0,0,.08).name='book-flexible-spine';
      if(tier>=3){meshDestination=g.getObjectByName('book-right-leaf');const tab=box(.065,.025,.21,look.accent,.16,.028,.35);tab.rotation.x=-.3-(tier-3)*.2;meshDestination=g;}
    }
    else if(kind==='elven_bow'){
      // The limbs and taut string share the YZ shooting plane. The grip is
      // centered in the hand; the arrow nock touches the rear string.
      g.userData.contact={kind:'projectile',center:[0,0,.455],normal:[0,0,1],axis:[0,0,1],grip:[0,0,0],nock:[0,0,-.32]};
      const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.62,-.32),new T.Vector3(0,-.36,-.04),new T.Vector3(0,0,.01),new T.Vector3(0,.36,-.04),new T.Vector3(0,.62,-.32)]);
      mesh(new T.TubeGeometry(curve,16,.035+tier*.006,6,false),wood).name='bow-curved-limbs';rod(.022,.21,0x9c8b67).name='bow-centered-grip';if(tier>1)for(const side of [-1,1]){const leaf=soft(.055,.3,.12,tier===3?gold:look.accent,.012,side*.3,-.06);leaf.rotation.x=side*.32;}
      rod(.007,1.24,0xe4dfc8,0,0,-.32).name='bow-taut-string';for(const y of [-.48,.48]){const tip=mesh(new T.SphereGeometry(.07,8,5),gold,0,y,-.2);tip.scale.set(.5,.5,1);}g.rotation.z=.12;
      const arrow=box(.012,.015,.68,0xcfb38a,0,0,.02);arrow.name='bow-nocked-arrow';const arrowhead=mesh(new T.ConeGeometry(.035,.11,4),iron,0,0,.4);arrowhead.rotation.x=Math.PI/2;arrowhead.name='bow-forward-arrowhead';
    }
    else if(['smith_hammer','warhammer'].includes(kind)){
      const big=kind==='warhammer',stretch=master?1+(tier-3)*.06:1,y=big?.8:.55,capZ=(big?.28:.2)*stretch;
      g.userData.contact={kind:'hammer-face',center:[0,y,capZ+.0275],normal:[0,0,1],headCenter:[0,y,0],axis:[0,1,0],grip:[0,0,0],rearCenter:[0,y,-capZ-.0275]};
      rod(.04,big?1.1:.65,wood,0,.2);box(big?.35:.26,big?.34:.23,(big?.58:.42)*stretch,iron,0,y).name='hammer-forged-head';
      for(const side of [-1,1])box(big?.38:.29,big?.37:.27,.055,gold,0,y,side*capZ).name=side>0?'hammer-striking-face-front':'hammer-striking-face-back';
      if(tier>1)box(big?.35:.25,.07,.2,dark,0,big?1.01:.7);if(tier>=3)for(const side of [-1,1])box(.04,.17,.055,look.accent,big?.195:.15,y,side*.09);
    }
    else if(kind==='cooking_pan'){g.userData.contact={kind:'pan-bottom',center:[0,.48,-.0225],normal:[0,0,-1],headCenter:[0,.48,0],axis:[0,1,0],grip:[0,0,0]};rod(.045,.42,wood,0,.08);const pan=rod(.23+(tier-1)*.015,.045,dark,0,.48);pan.rotation.x=Math.PI/2;mesh(new T.TorusGeometry(.21+(tier-1)*.015,.025,5,14),iron,0,.48,.026);if(tier>1){const grip=mesh(new T.TorusGeometry(.075,.02,4,10,Math.PI*1.4),gold,0,.77);grip.rotation.z=-.2;}if(tier>=3)mesh(new T.TorusGeometry(.14,.012,4,12),gold,0,.48,.026);}
    else if(['buckler','round_shield','tower_shield'].includes(kind)){const big=kind==='tower_shield';if(big){box(.5,.75,.08,dark);box(.045,.72,.1,gold);box(.5,.045,.1,gold,0,.12);}else{const disk=rod(kind==='buckler'?.26:.31,.08,kind==='buckler'?wood:iron);disk.rotation.x=Math.PI/2;mesh(new T.TorusGeometry(kind==='buckler'?.24:.29,.025,4,12),gold,0,0,.055);mesh(new T.SphereGeometry(.075,8,6),iron,0,0,.08);}box(.16,.05,.11,wood,0,0,-.08);}
    else if(kind==='heavy_helm'){const cap=mesh(new T.SphereGeometry(female?.285:.315,12,6,0,Math.PI*2,0,Math.PI/2),iron,0,female?1.75:1.68);cap.scale.set(1,female?.86:1,.9);for(const side of [-1,1])soft(female?.065:.09,female?.2:.27,.28,iron,side*(female?.25:.275),female?1.68:1.63,-.025);if(female){for(const side of [-1,1]){const wing=soft(.15,.045,.12,gold,side*.245,1.84,.14);wing.rotation.z=-side*.3;}}else box(.055,.14,.49,gold,0,1.91);}
    else if(kind==='light_hood'){const cap=mesh(new T.SphereGeometry(female?.285:.325,12,6,0,Math.PI*2,0,Math.PI/2),female?look.cloak:wood,0,female?1.74:1.66);cap.scale.set(1,female?.75:1,.9);soft(female?.54:.63,.055,.23,female?look.accent:0xae875e,0,female?1.8:1.73,.23);if(female){const fold=soft(.15,.12,.28,look.cloak,.25,1.73,-.055);fold.rotation.z=-.25;soft(.07,.09,.04,gold,-.21,1.78,.2);}else for(const side of [-1,1])soft(.09,.27,.29,wood,side*.285,1.58,-.07);}
    else if(kind==='rune_crown'){
      // Low circlet: open headband, inset forehead jewel and rounded filigree, never spikes.
      for(const y of [1.75,1.82]){const band=mesh(new T.TorusGeometry(female?.3:.31,female?.014:.018,4,20),gold,0,y);band.rotation.x=Math.PI/2;band.scale.x=1.05;}
      for(const side of [-1,1]){box(.035,.09,.33,0x677b99,side*.32,1.785);const leaf=mesh(new T.SphereGeometry(.075,8,6),gold,side*.2,1.79,.27);leaf.scale.set(1.25,.5,.3);}
      const mount=mesh(new T.TorusGeometry(.075,female?.012:.017,4,12),gold,0,1.77,.327);mount.scale.set(female?.85:1,female?1.3:1.15,1);
      const jewel=mesh(new T.SphereGeometry(.062,8,6),female?(job==='healer'?0xb8e4cf:0xc5ace7):0x91d8e4,0,1.77,.34);jewel.scale.set(female?.72:.85,female?1.2:1.1,.42);
      for(const side of [-1,1]){const scroll=mesh(new T.TorusGeometry(.09,.012,4,10,Math.PI),gold,side*.12,1.77,.31);scroll.rotation.z=side<0?0:Math.PI;}
    }
    else if(kind==='heavy_armor'){
      const knight=!female&&job==='swordsman';
      if(knight&&root.CharacterSculpt?.knightTorso)mesh(root.CharacterSculpt.knightTorso(T,.74,.67,.43),iron,0,1.03).name='knight-fitted-cuirass';else body(female?.68:.76,female?.62:.59,.46,iron,1.03);
      for(const y of [female?.79:.76,.9,1.22]){const band=mesh(new T.TorusGeometry(female?.285:knight?.305:.34,.022,4,12),dark,0,y);band.rotation.x=Math.PI/2;band.scale.y=.67;}
      for(const side of [-1,1]){const pad=soft(female?.22:knight?.26:.3,female?.16:knight?.19:.25,knight?.37:.42,iron,side*(female?.335:knight?.36:.39),knight?1.27:1.25);if(knight)pad.rotation.z=-side*.17;if(female){const plate=box(.23,.25,.09,iron,side*.22,.7,.14);plate.rotation.z=side*.16;plate.name='female-armored-fauld';}}
      const crest=soft(female?.085:knight?.105:.12,.15,.035,gold,0,1.12,.25);crest.name=female?'female-leaf-crest':'male-shield-crest';coat(look.cloak,female?.58:.62);
    }
    else if(kind==='light_armor'){const leather=female?look.leather:0x89664a;body(female?.63:.7,female?.65:.63,.42,leather,1.0);for(const side of [-1,1]){const strap=box(.045,.57,.043,female?look.accent:0xc1a17b,side*(female?.1:.14),1,.215);strap.rotation.z=side*(female?.26:.16);}const belt=mesh(new T.TorusGeometry(female?.235:.31,.035,4,12),wood,0,.77);belt.rotation.x=Math.PI/2;belt.scale.y=.72;coat(female?look.cloak:leather,.6);if(female){neck(look.skin,1.26,.24);soft(.085,.07,.028,gold,0,1.1,.245);}else{const sash=box(.065,.61,.04,look.accent,0,1.0,.225);sash.rotation.z=-.6;}}
    else if(kind==='robe'){const cloth=look.cloak;if(female){const back=mesh(new T.CylinderGeometry(.25,.35,.85,14,1,true,Math.PI/2,Math.PI),cloth,0,.59,-.04);back.scale.z=.74;back.name='continuous-robe-back';for(const side of [-1,1]){const panel=box(.22,.79,.07,cloth,side*.22,.61,.17);panel.rotation.z=side*.095;panel.name='female-slit-robe';}}else{const skirt=mesh(new T.CylinderGeometry(.27,.37,.74,14),cloth,0,.66);skirt.scale.z=.75;}body(female?.64:.7,female?.64:.58,.43,cloth,1.06);for(const side of [-1,1])box(.035,female?.64:.79,.03,gold,side*(female?.13:.18),female?1.02:.91,.225);const belt=mesh(new T.TorusGeometry(female?.23:.3,.025,4,12),gold,0,female?.85:.92);belt.rotation.x=Math.PI/2;belt.scale.y=.75;if(female)neck(look.skin,1.3,.24);else{for(const side of [-1,1]){const lapel=box(.12,.26,.05,look.accent,side*.09,1.23,.23);lapel.rotation.z=-side*.3;}}}
    // Readable construction details sit flush to the silhouette. Surface grain,
    // fine engraving and stitching live in the atlas; only larger seams/crests
    // use geometry and are merged below with their existing material family.
    if(['longsword','greatsword','twin_daggers'].includes(kind)){
      const big=kind==='greatsword',small=kind==='twin_daggers',length=(big?1.1:small?.4:.72)*(1+(tier-1)*.045),w=big?.075:small?.026:.04;
      for(const side of [-1,1])inlay([[side*w,.23],[side*w*.65,.14+length*.55],[0,.14+length*.87]],dark,0,0,.027,'blade-fuller',.0035);
      grip(0,big?-.115:-.04,0,big?.37:.21);herald(0,.17,.033,small?.03:.045);rivet(0,big?-.34:-.19,.058,.025);
    }else if(kind==='arcane_staff'){
      grip(0,.27,0,.32);inlay([[-.12,.84],[-.2,1.04],[0,1.22],[.2,1.04],[.12,.84]],gold,0,0,.018,'staff-crystal-cradle',.012);herald(0,.65,.05,.055);
    }else if(kind==='spellbook'){
      // Fine writing is part of the page surface; these raised clasps provide a
      // silhouette-independent crafted spine and restrained illuminated cover.
      for(const side of [-1,1]){meshDestination=g.getObjectByName(side<0?'book-left-leaf':'book-right-leaf');box(.04,.018,.13,gold,side*.245,.04,.12).name='book-engraved-clasp';for(const z of [-.055,.16])inlay([[-.08,0,0],[0,.012,0],[.08,0,0]],0xab9672,side*.15,.086,z,'book-illuminated-margin',.003);const seal=herald(side*.14,-.036,.13,.05);seal.rotation.x=Math.PI/2;}
      meshDestination=g;
    }else if(kind==='elven_bow'){
      for(const side of [-1,1]){inlay([[.035,side*.51,-.16],[.035,side*.36,-.06],[.035,side*.15,-.01]],gold,0,0,0,'bow-leaf-inlay',.006);const leaf=herald(.05,side*.35,-.07,.037);leaf.rotation.set(side*.5,Math.PI/2,0);}
    }else if(['smith_hammer','warhammer'].includes(kind)){
      const big=kind==='warhammer',y=big?.8:.55,w=big?.22:.15,x=big?.183:.14;
      // Engravings remain on the cheeks, leaving both gold striking faces clear.
      for(const side of [-1,1])inlay([[side*x,-.075,-w],[side*x,0,-w*.65],[side*x,.075,-w]],gold,0,y,0,'hammer-forged-cheek',.009);const crest=herald(x+.004,y,0,big?.075:.055);crest.rotation.y=Math.PI/2;grip(0,big?.22:.05,0,.25);
    }else if(kind==='cooking_pan'){
      grip(0,.07,0,.23);for(const side of [-1,1])rivet(side*.045,.295,.035,.013);herald(0,.47,.035,.085);
    }else if(['buckler','round_shield','tower_shield'].includes(kind)){
      const big=kind==='tower_shield';herald(0,big?.06:0,.122,big?.14:.1);for(const side of [-1,1]){if(big)inlay([[side*.18,-.28],[side*.21,-.08],[side*.18,.27]],gold,0,0,.1,'shield-rim-scroll',.007);else inlay([[side*.12,-.17],[side*.2,0],[side*.12,.17]],gold,0,0,.106,'shield-rim-scroll',.007);rivet(side*(big?.2:.17),big?-.27:.12,.112);}
    }else if(kind==='heavy_helm'){
      const y=female?1.76:1.69,r=female?.285:.31,brim=mesh(new T.TorusGeometry(r,.013,4,20),gold,0,y);brim.rotation.x=Math.PI/2;brim.scale.z=.91;brim.name='helmet-rolled-brim';
      inlay([[-r*.7,.07],[0,.09],[r*.7,.07]],gold,0,y,.225,'helmet-brow-fillet',.009);for(const side of [-1,1])rivet(side*.23,y+.015,.14,.014);
    }else if(kind==='light_hood'){
      for(const side of [-1,1])inlay([[side*.22,1.73,.16],[side*.24,1.72,-.05],[side*.16,1.8,-.19]],look.accent,0,0,0,'hood-tailored-seam',.007);herald(-.17,female?1.79:1.74,.26,.035);
    }else if(kind==='rune_crown'){
      for(const side of [-1,1])inlay([[side*.07,1.765,.326],[side*.12,1.8,.322],[side*.21,1.795,.275],[side*.25,1.765,.23]],gold,0,0,0,'circlet-laurel-filigree',.006);
    }else if(kind==='heavy_armor'){
      const crest=herald(0,1.11,.283,female?.075:.094);crest.name=female?'female-leaf-crest':'male-shield-crest';
      for(const side of [-1,1]){inlay([[side*.055,1.22],[side*.19,1.17],[side*.245,.97],[side*.16,.86]],gold,0,0,.23,'armor-fluted-chest',.01);inlay([[side*.27,1.32],[side*(female?.39:.45),1.3],[side*(female?.43:.49),1.2]],gold,0,0,.16,'pauldron-rolled-edge',.012);for(const y of [.9,1.19])rivet(side*.23,y,.218);}
      const belt=box(.095,.07,.026,gold,0,.785,.253);belt.name='armor-forged-buckle';
    }else if(kind==='light_armor'){
      herald(0,1.1,.256,.055);for(const side of [-1,1]){inlay([[side*.25,1.22],[side*.29,1.05],[side*.23,.87]],look.accent,0,0,.173,'leather-reinforced-seam',.006);rivet(side*.12,.79,.19,.012);}const clasp=box(.082,.063,.025,gold,0,.79,.25);clasp.name='leather-belt-clasp';
    }else if(kind==='robe'){
      for(const side of [-1,1]){inlay([[side*.06,1.34],[side*.22,1.3],[side*.27,1.2]],gold,0,0,.214,'robe-embroidered-collar',.008);inlay([[side*.1,.82],[side*.18,.68],[side*.23,.42]],gold,0,0,.223,'robe-woven-border',.006);}herald(0,1.19,.256,.06);
    }
    // Other weapons already have the correct authored axis; expose it without
    // changing their grip, geometry, equipment rules or projectile direction.
    if(['longsword','greatsword','twin_daggers'].includes(kind)){
      const big=kind==='greatsword',small=kind==='twin_daggers',length=(big?1.1:small?.4:.72)*(1+(tier-1)*.045),width=(big?.17:small?.07:.1)*(1+(tier-1)*.15);
      const blade=g.getObjectByName('forged-tapered-blade');blade.geometry.computeBoundingBox();
      g.userData.contact={kind:'blade-edge',center:[width/2,.14+length*.66,0],normal:[1,0,0],tip:[0,blade.position.y+blade.geometry.boundingBox.max.y,0],axis:[0,1,0],grip:[0,0,0]};
      if(big)g.userData.contact.supportGrip=[0,-.20,0];
    }else if(kind==='arcane_staff')g.userData.contact={kind:'magic-emitter',center:[0,1.1,0],normal:[0,1,0],axis:[0,1,0],grip:[0,0,0]};
    else if(kind==='spellbook')g.userData.contact={kind:'magic-emitter',center:[0,.09,.3],normal:[0,0,1],axis:[0,0,1],grip:[0,0,0]};
    if(tier>1){
      const head=definition.slot==='helmet',body=definition.slot==='armor',shield=definition.slot==='shield',y=head?1.8:body?1.08:kind==='arcane_staff'?1.1:kind==='spellbook'?.08:kind==='elven_bow'?0:.32,z=head?.34:body?.26:shield?.1:kind==='spellbook'?.3:0;
      const gemColor={swordsman:0x9abcca,mage:0xbea2da,scout:0xc7ab7e,chef:0xdcba70,healer:0xa4cfb8,smith:0xc38b77,archer:0x83baa1}[job]||0x95c9ef;
      for(const side of [-1,1]){if(kind==='spellbook')meshDestination=g.getObjectByName('book-right-leaf');const geo=master?new T.OctahedronGeometry(tier===4?.038:.046):new T.SphereGeometry(tier===3?.036:.027,8,5),jewel=mesh(geo,gemColor,kind==='spellbook'?.14:side*(body?.19:head?.15:.09),kind==='spellbook'?-.043:y,kind==='spellbook'?.07+side*.1:z,'gem');jewel.scale.set(1,tier>=3?1.3:1,.3);if(kind==='spellbook')jewel.rotation.x=Math.PI/2;jewel.name='tier-inlaid-gem';}meshDestination=g;
      if(tier>=3){if(body){for(const side of [-1,1])inlay([[side*.14,1.21],[side*.23,1.11],[side*.2,.95],[side*.12,.85]],gold,0,0,.224,'tier-crafted-fillet',.0045);}else if(shield){for(const side of [-1,1])inlay([[side*.07,-.16],[side*.13,0],[side*.07,.16]],gold,0,0,.096,'tier-shield-fillet',.004);}else if(!head&&kind!=='spellbook'){rod(.065,.09,gold,0,kind==='arcane_staff'?.62:.16);}}
    }
    if(tier>1&&definition.slot==='armor'){
      const mantle=box(kind==='heavy_armor'?.75:.64,.12,.37,kind==='heavy_armor'?iron:look.accent,0,1.255,-.005);mantle.name='tiered-shoulder-mantle';
      if(root.CharacterSculpt?.cloth){const cape=mesh(root.CharacterSculpt.cloth(T,female?.61:.69,tier>=3?.69+(tier-3)*.04:.44,-.065),look.cloak,0,1.25,-.225,'fabric');cape.material.side=T.DoubleSide;cape.material.forceSinglePass=true;cape.name='folded-profession-cape';}
    }
    if(kind==='twin_daggers'){
      // The blade leaves the little-finger end of the handle (-Y), not the
      // thumb end. Bake the reverse hold into the authored equipment once;
      // animation can then turn the real tip/edges instead of a display trick.
      for(const part of g.children){if(!part.isMesh)continue;part.updateMatrix();part.geometry.applyMatrix4(part.matrix).rotateZ(Math.PI);part.position.set(0,0,0);part.quaternion.identity();part.scale.set(1,1,1);}
      const c=g.userData.contact;for(const key of ['center','normal','tip','axis'])c[key]=c[key].map((value,axis)=>axis===2||value===0?value:-value);g.userData.gripStyle='reverse';
    }
    if(female&&kind==='rune_crown'){g.scale.set(.88,.96,.91);g.position.y=.105;}
    if(kind==='spellbook'){
      for(const leaf of g.children.filter(p=>p.userData.bookSide))batchGear(T,leaf);
      batchGear(T,g);for(const leaf of g.children.filter(p=>p.userData.bookSide)){g.userData.authoredParts.push(...leaf.userData.authoredParts);g.userData.sourceParts+=leaf.userData.sourceParts;}g.userData.renderParts=g.children.reduce((n,p)=>n+(p.isMesh?1:p.userData.renderParts||0),0);
      bookPose(g,0);return g;
    }
    return batchGear(T,g);
  }
  function bookPose(book,open=0){open=Math.max(0,Math.min(1,open));book.userData.bookOpen=open;for(const leaf of book.children){const side=leaf.userData.bookSide;if(!side)continue;leaf.rotation.z=side*(Math.PI/2+(.12-Math.PI/2)*open);leaf.position.x=side*.082*(1-open);}}
  const STYLES=Object.freeze({swordsman:{shirt:0x577c99,hair:0x614832,skin:0xdcb38e,width:1.07,height:1.08,face:1.04,eyes:0x314a63,shape:'square'},mage:{shirt:0x796396,hair:0xd0c2da,skin:0xdfc1b2,width:.91,height:1.03,face:.95,eyes:0x614f92,shape:'slender'},scout:{shirt:0x498a78,hair:0x95533d,skin:0xd5a383,width:.88,height:.93,face:.9,eyes:0x30604c,shape:'petite'},chef:{shirt:0xa68156,hair:0x634330,skin:0xe4b087,width:1.18,height:.99,face:1.06,eyes:0x573e2d,shape:'round'},healer:{shirt:0x6d9982,hair:0xe0ce98,skin:0xe9c1a6,width:.94,height:1.01,face:.94,eyes:0x3f7766,shape:'soft'},smith:{shirt:0x796957,hair:0x4d3631,skin:0xbb8b6f,width:1.25,height:1.02,face:1.08,eyes:0x594337,shape:'stocky'},archer:{shirt:0x657e55,hair:0xd3bc76,skin:0xe7ceb0,width:.85,height:1.16,face:.89,eyes:0x3f8366,shape:'elf'}});
  // All playable/recruitable job variants are adult adventurers. Appearance only:
  // no item duplication, gender equip locks, stat changes or save migration.
  const VARIANTS=Object.freeze({
    robot:{male:{shirt:0x687c88,skin:0xb7c6c9,hair:0x687c88,eyes:0x72dce9,cloak:0x263a45,accent:0xc1a474,leather:0x263a45,width:1.04,height:1.03,face:1,shape:'heavy-machine',description:'鐵衡：鋼藍機殼、寬肩重拳、黃銅雕紋與藍色動力核'},female:{shirt:0xdad5bd,skin:0xeee5c9,hair:0xdad5bd,eyes:0x91dfa8,cloak:0x4b554c,accent:0xbb9663,leather:0x4b554c,width:.95,height:.95,face:1,shape:'rounded-machine',description:'鈴芯：象牙弧面機殼、圓潤臉孔、黃銅鑲邊與綠色動力核'}},
    swordsman:{male:{width:.99,height:1.18,face:.94,hair:0x40332f,skin:0xe0b999,cloak:0x293f66,accent:0xb9d4e8,leather:0x6a4b3b,description:'高挑勻稱、俐落側分短髮、收腰騎士鎧甲與盾徽'},female:{hair:0x953f34,shirt:0x7595b5,cloak:0x426993,accent:0xe2c585,leather:0x705241,description:'赤銅側辮、修身分片護甲與藍色長戰袍'}},
    mage:{male:{hair:0xbabecb,cloak:0x3f436b,accent:0xaacbda,leather:0x534662,description:'灰銀短髮、短鬚、立領長袍'},female:{hair:0x493457,shirt:0x9174b2,cloak:0x674677,accent:0xe4bd85,leather:0x76516e,description:'紫黑長波浪髮、收腰側開衩法袍'}},
    scout:{male:{hair:0x654132,cloak:0x244f47,accent:0x99c5b4,leather:0x785843,description:'斜瀏海、斜背束帶與短獵裝'},female:{hair:0xbc7845,shirt:0x76a18b,cloak:0x377561,accent:0xe4bc8b,leather:0x705b4f,description:'蜜銅側編髮、斜肩披巾與分片輕甲'}},
    chef:{male:{hair:0x4f3428,cloak:0x70503b,accent:0xf0ddbd,leather:0x876248,description:'濃髭、圓肩、雙排扣短圍裙'},female:{hair:0x7d3937,shirt:0xbb9070,cloak:0x946458,accent:0xf4dcc2,leather:0x9e7763,description:'側髻與捲髮、收腰圍裙式輕甲'}},
    healer:{male:{hair:0x715440,cloak:0x325e52,accent:0xb6d7b5,leather:0x625c42,description:'栗色短髮、寬領綠袍與療護肩巾'},female:{hair:0xe0be74,shirt:0x94b49b,cloak:0x648d79,accent:0xe9d6a0,leather:0x7b8060,description:'金色長側髮、垂墜開衩療護袍'}},
    smith:{male:{hair:0x332a27,cloak:0x4b3532,accent:0xd1a078,leather:0x574234,description:'厚鬚、寬肩金屬鎧與短工匠戰袍'},female:{skin:0xdab098,hair:0x824832,eyes:0x74563e,shirt:0x9c7857,cloak:0x806344,accent:0xe4c48e,leather:0x8d6245,description:'柔和圓臉、赤棕雙辮與實用工匠護甲'}},
    archer:{male:{hair:0xb19b62,cloak:0x354d3a,accent:0xb5c77d,leather:0x68543e,description:'精靈短髮、獵裝束帶與短斗篷'},female:{width:.98,height:1.03,face:.95,hair:0xd2aa55,shirt:0x90a36b,cloak:0x617843,accent:0xefd495,leather:0x847245,description:'勻稱精靈身形、長編髮、葉片輕甲與側披風'}},
  });
  const style=(job,sex='male')=>({...STYLES[job],...VARIANTS[job]?.[sex]});
  // Only archers need an elbow to hold a bow and reach its string without
  // pushing both straight arms through the chest. Built once, reused in pose.
  function bowArmRig(T,model){
    const rig={down:new T.Vector3(0,-1,0),delta:new T.Vector3(),dir:new T.Vector3(),pole:new T.Vector3(),joint:new T.Vector3(),lower:new T.Vector3(),inverse:new T.Quaternion(),orientation:new T.Quaternion(),euler:new T.Euler()};
    for(const [key,side]of [['right',-1],['left',1]]){
      const upper=model.userData[side<0?'armR':'armL'],elbow=new T.Group(),hand=new T.Group();elbow.name='bow-elbow-'+key;hand.name='bow-hand-'+key;elbow.position.y=-.42;hand.position.y=-.42;upper.add(elbow);elbow.add(hand);
      // Female limb width is baked into the new segments rather than scaling
      // the joint hierarchy, so both bones retain their authored reach.
      const width=upper.scale.x;upper.geometry=upper.geometry.clone();upper.geometry.scale(width,1,upper.scale.z);upper.scale.set(1,1,1);
      const forearm=new T.Mesh(root.CharacterSculpt.capsule(T,.145*width,.42,.16*width),upper.material);forearm.geometry.translate(0,-.21,0);forearm.name='bow-forearm-'+key;elbow.add(forearm);
      const palm=new T.Mesh(root.CharacterSculpt.capsule(T,.15*width,.15,.14*width),upper.material);palm.name='bow-grip-hand-'+key;hand.add(palm);
      const cuff=upper.children.find(c=>c.name==='tailored-wrist-cuff');if(cuff){elbow.add(cuff);cuff.position.y=-.39;}
      const thumb=upper.children.find(c=>c.geometry?.type==='SphereGeometry');if(thumb){hand.add(thumb);thumb.position.set(-side*.065,-.025,.045);}
      rig[key]={upper,elbow,hand,side};
    }
    model.userData.bowArms=rig;poseBowArms(model,0,0,0,0,0);return rig;
  }
  function placeBowArm(rig,arm,x,y,z,wx,wy,wz){
    const bone=arm.bone||.42,shoulder=arm.upper.position,d=rig.delta.set(x,y,z).sub(shoulder),length=Math.min(bone*2-.001,d.length()),dir=rig.dir.copy(d).normalize();
    // Bend outwards and forwards. This keeps both upper arms outside the
    // torso and both forearms in front, instead of folding through armor.
    const pole=rig.pole.set(arm.side*d.z,0,-arm.side*d.x);pole.addScaledVector(dir,-pole.dot(dir)).normalize();
    const joint=rig.joint.copy(shoulder).addScaledVector(dir,length/2).addScaledVector(pole,Math.sqrt(bone*bone-length*length/4));
    arm.upper.quaternion.setFromUnitVectors(rig.down,rig.lower.copy(joint).sub(shoulder).normalize());
    rig.inverse.copy(arm.upper.quaternion).invert();rig.lower.set(x,y,z).sub(joint).normalize().applyQuaternion(rig.inverse);arm.elbow.quaternion.setFromUnitVectors(rig.down,rig.lower);
    rig.orientation.setFromEuler(rig.euler.set(wx,wy,wz));arm.hand.quaternion.copy(arm.upper.quaternion).multiply(arm.elbow.quaternion).invert().multiply(rig.orientation);
  }
  function poseBowArms(model,raise,draw,wx,wy,wz){
    const r=model.userData.bowArms;if(!r)return;const a=Math.max(0,Math.min(1,raise)),x=-.4+.3*a,y=.70+.44*a,z=.22+.48*a;
    placeBowArm(r,r.right,x,y,z,wx,wy,wz);
    // Move the string hand forward before crossing the torso, and reverse
    // that route on recovery. A direct rest-to-nock line cuts through armor.
    const across=Math.max(0,(a-.35)/.65),forward=Math.min(1,a/.35);
    placeBowArm(r,r.left,.42-.52*across,y,.10+(.28-draw)*forward,0,0,0);
  }
  const SMITH_LEG_TRIM=.11;
  function smithDwarfBody(T,model){
    // Keep the existing stocky torso, head, arms and adult face. Compress only
    // the legs around their upper seam; matching mount offsets keep the soles
    // grounded and prevent the shortened dwarven silhouette from floating.
    const trim=SMITH_LEG_TRIM,retired=new Set();
    for(const key of ['legL','legR']){
      const leg=model.userData[key],old=leg.geometry,geometry=old.clone();retired.add(old);
      geometry.computeBoundingBox();const top=geometry.boundingBox.max.y,height=top-geometry.boundingBox.min.y,ratio=(height-trim)/height,p=geometry.attributes.position;
      for(let i=0;i<p.count;i++)p.setY(i,top+(p.getY(i)-top)*ratio);
      geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();leg.geometry=geometry;leg.position.y-=trim;
      for(const child of leg.children)child.position.y+=trim;
    }
    for(const key of ['body','armL','armR','head'])model.userData[key].position.y-=trim;
    const neck=model.getObjectByName('anatomical-neck');if(neck)neck.position.y-=trim;
    for(const piece of model.userData.baseClothing||[])if(piece!==model.userData.body)piece.position.y-=trim;
    model.userData.smithLegTrim=trim;
    for(const geometry of retired)geometry.dispose();
  }
  function smithLongBeard(T,beard){
    // One continuous rounded/tapered beard, attached below the expressive lips.
    // Reuse the owned mesh and hair material; the profile retains the original
    // eight rings / ten sides and is authored once, never reshaped each frame.
    const points=[[0,-.44],[.045,-.415],[.085,-.365],[.115,-.275],[.14,-.17],[.15,-.08],[.12,-.025],[0,0]].map(([r,y])=>new T.Vector2(r,y)),geometry=new T.LatheGeometry(points,10),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i);p.setZ(i,p.getZ(i)*.4+.09*(-y/.44));}
    geometry.computeVertexNormals();geometry.userData.smithLongBeard=true;
    beard.geometry.dispose();beard.geometry=geometry;beard.position.set(0,-.15,.192);
  }
  const KNIGHT_LEG_TRIM=.10;
  function knightBody(T,model,look){
    // Shorten only the legs. Lower every upper-body mount by the same amount,
    // and lift the boots inside their leg joints to preserve ground contact.
    const trim=KNIGHT_LEG_TRIM;
    const retired=new Set(),replace=(mesh,geometry)=>{retired.add(mesh.geometry);mesh.geometry=geometry;};
    replace(model.userData.body,root.CharacterSculpt.knightTorso(T,.66,.73,.38));model.userData.body.position.y=1.075-trim;
    for(const [key,side]of [['armR',-1],['armL',1]]){const arm=model.userData[key];replace(arm,root.CharacterSculpt.capsule(T,.16,.61,.17));arm.geometry.translate(0,-.25,0);arm.position.set(side*.40,1.25-trim,0);}
    for(const [key,side]of [['legR',-1],['legL',1]]){const leg=model.userData[key];replace(leg,root.CharacterSculpt.capsule(T,.195,.68-trim,.215));leg.geometry.translate(0,-.305+trim/2,0);leg.position.set(side*.145,.75-trim,0);for(const child of leg.children){if(child.geometry?.type==='ExtrudeGeometry'){child.position.y=-.585+trim;child.scale.x=.96;}else if(child.geometry?.type==='BoxGeometry'){child.position.y=-.66+trim;child.scale.x=.96;}}}
    for(const part of model.userData.baseClothing||[])if(part!==model.userData.body)part.position.y+=.125-trim;
    model.userData.head.position.y=1.68-trim;model.userData.head.scale.y=.92;
    const neck=model.getObjectByName('anatomical-neck');if(neck)neck.position.y=1.48-trim;
    const palm=model.userData.armR.children.find(c=>c.geometry?.type==='SphereGeometry');
    if(palm){replace(palm,root.CharacterSculpt.gripHand(T));palm.material=new T.MeshPhongMaterial({color:look.leather,specular:0x332c29,shininess:16});palm.name='knight-grip-gauntlet';palm.position.set(0,-.46,.10);model.userData.knightRightHand=palm;}
    // The authored hand anchor is cosmetic and never changes the hitbox or
    // gameplay reach. All attack offsets still come from the existing tracks.
    model.userData.heroGrip=[0,-.46,.10];model.userData.knightSculpt=true;
    for(const geometry of retired)geometry.dispose();
  }
  function fitKnightFace(T,model){
    const face=model.userData.face,head=model.userData.headMesh;if(!face||!head)return;
    // Sample the authored local triangles once while building the character.
    // Reuse the existing geometry/material; no extra rendered mesh or texture.
    const probe=new T.Mesh(head.geometry,head.material),ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(0,0,-1);
    probe.updateMatrixWorld(true);
    face.surface=(x,y)=>{ray.set(origin.set(x,y,1),direction);const hit=ray.intersectObject(probe,false)[0];return hit?hit.point.z+.006:.24;};
    const eyeX=.105,eyeY=.038,browY=.073;
    for(let i=0;i<face.eyes.length;i++){
      const side=i?1:-1,eye=face.eyes[i];eye.position.set(side*eyeX,eyeY,face.surface(side*eyeX,eyeY));
      face.whites[i].position.copy(eye.position);face.whites[i].position.z-=.005;
      if(face.lids[i]){face.lids[i].position.copy(eye.position);face.lids[i].position.z+=.006;}
      face.brows[i].position.set(side*eyeX,browY,face.surface(side*eyeX,browY)+.004);
    }
    face.browY=browY;face.width=.90;face.mouth.position.y=-.139;face.mouth.position.z=face.surface(0,-.139)+.001;
    for(let i=0;i<face.lips.length;i++){const lip=face.lips[i];lip.position.y=face.mouth.position.y+(i?-.006:.006);lip.position.z=face.surface(0,lip.position.y)+.003;}
    for(let i=0;i<face.corners.length;i++){const corner=face.corners[i];corner.position.set((i?1:-1)*.049,-.137,face.surface((i?1:-1)*.049,-.137)+.002);}
    for(const cheek of face.cheeks){cheek.position.x*=.9;cheek.position.y=-.069;cheek.position.z=face.surface(cheek.position.x,cheek.position.y);}
    face.teeth.position.set(0,face.mouth.position.y,face.mouth.position.z+.003);
  }
  function swordSupportRig(T,model,active){
    let rig=model.userData.swordSupportArm;
    if(!rig&&active){
      const upper=model.userData.armL,elbow=new T.Group(),hand=new T.Group(),owner=new T.Mesh(upper.geometry,upper.material),skin=upper.material;
      owner.name='sword-arm-owned-rest-geometry';owner.visible=false;model.add(owner);
      const bone=.44,upperGeometry=root.CharacterSculpt.capsule(T,.16,bone,.17);upperGeometry.translate(0,-bone/2,0);
      const forearm=new T.Mesh(root.CharacterSculpt.capsule(T,.145,bone,.16),skin);forearm.geometry.translate(0,-bone/2,0);forearm.name='sword-support-forearm';elbow.add(forearm);elbow.position.y=-bone;hand.position.y=-bone;upper.add(elbow);elbow.add(hand);elbow.name='sword-support-elbow';hand.name='sword-support-hand';
      rig={upper,elbow,hand,owner,upperGeometry,idleGeometry:upper.geometry,bone,side:1,down:new T.Vector3(0,-1,0),delta:new T.Vector3(),dir:new T.Vector3(),pole:new T.Vector3(),joint:new T.Vector3(),lower:new T.Vector3(),inverse:new T.Quaternion(),orientation:new T.Quaternion(),euler:new T.Euler(),target:new T.Vector3(),contact:new T.Vector3(),active:false};
      const palm=upper.children.find(c=>c.geometry?.type==='SphereGeometry');if(palm){palm.geometry.dispose();palm.geometry=root.CharacterSculpt.gripHand(T);palm.material=new T.MeshPhongMaterial({color:style('swordsman','male').leather,specular:0x332c29,shininess:16});palm.name='knight-support-gauntlet';rig.palm=palm;rig.palmRest=palm.position.clone();}
      model.userData.swordSupportArm=rig;
    }
    if(!rig||rig.active===active)return;
    rig.active=active;rig.elbow.visible=active;rig.upper.geometry=active?rig.upperGeometry:rig.idleGeometry;rig.owner.geometry=active?rig.idleGeometry:rig.upperGeometry;
    if(rig.palm){(active?rig.hand:rig.upper).add(rig.palm);rig.palm.position.copy(active?rig.contact.set(0,0,0):rig.palmRest);rig.palm.quaternion.identity();}
  }
  function poseSwordSupport(model,p,q){
    const rig=model.userData.swordSupportArm;if(!rig?.active)return;
    // Compute the secondary grip in model space, so heading, scale and body
    // lean are inherited exactly once. The arm solver allocates nothing.
    const right=model.userData.armR,grip=model.userData.heroGrip;
    rig.target.fromArray(grip).applyQuaternion(right.quaternion).add(right.position);rig.target.x+=p.wpx;rig.target.y+=p.wpy;rig.target.z+=p.wpz;
    q.setFromEuler(rig.euler.set(p.wx,p.wy,p.wz));rig.target.add(rig.contact.set(0,-.20,0).applyQuaternion(q));
    placeBowArm(rig,rig,rig.target.x,rig.target.y,rig.target.z,p.wx,p.wy,p.wz);
  }
  function joinHumanShoulders(T,model){
    // A sleeve rotates about an outboard arm pivot; simply widening it leaves
    // a gap again when raised. These fitted inner sleeves overlap the real
    // torso and the pivot sleeve in every direction, without moving the hands,
    // changing the bow/support solvers, or adding anything to the frame loop.
    const positions=[],normals=[],indices=[],centers=[];
    for(const [key,side]of [['armR',-1],['armL',1]]){
      const arm=model.userData[key],center=[arm.position.x-side*.105,arm.position.y,arm.position.z],g=new T.SphereGeometry(1,8,3);
      g.scale(.15,.10,.135);g.translate(...center);centers.push({side,center});
      const offset=positions.length/3;positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);indices.push(...Array.from(g.index.array,i=>i+offset));g.dispose();
    }
    // Both largely hidden seams share one draw call and 64 triangles total.
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setIndex(indices);
    const sleeve=model.userData.armR.children.find(p=>p.name==='connected-shoulder-sleeve'),joint=new T.Mesh(geometry,sleeve?.material||model.userData.body.material);
    joint.name='anatomical-shoulder-sockets';joint.userData.shoulderCenters=centers;model.add(joint);model.userData.shoulderJoints=[joint];
  }
  function base(job,build,identity='hero',sex=root.TowerPartyCore?.PROFESSIONS[job]?.gender||'male'){
    if(job==='robot')return robotBase(root.THREE,sex,identity);
    const s=style(job,sex),female=sex==='female',m=build({shirt:s.shirt,pants:0x354351,skin:s.skin,hair:s.hair,type:female?'girl':'boy',heroJob:job,heroSex:sex}),T=root.THREE;
    m.scale.set(s.width*(female?.9:1.03),s.height*(female?1.05:1),job==='chef'||job==='smith'?1.08:.96);
    Object.assign(m.userData,{heroIdentityStyle:identity==='hero'?'protagonist':'traveller',heroJob:job,heroSex:sex,heroShape:s.shape,heroVariant:job+'-'+sex,adultDesign:true,heroPieces:[]});
    const head=m.userData.head;if(!T||!head)return m;head.scale.set(s.face*(female?.87:1.03),female?.94:job==='chef'?.96:job==='archer'?1.07:1,1);if(female)head.position.y+=.07;
    // Preserve the character-owned complexion map when upgrading surface response.
    const replaced=new Map();m.traverse(o=>{if(!o.isMesh||o.material?.type!=='MeshLambertMaterial')return;const old=o.material;if(!replaced.has(old)){const isHair=old.color.getHex()===s.hair,isSkin=old.color.getHex()===s.skin,mat=new T.MeshPhongMaterial({color:old.color,map:old.map,bumpMap:old.bumpMap,bumpScale:old.bumpScale,specular:isHair?0x313038:isSkin?0x332521:0x171c22,shininess:isHair?27:isSkin?13:5,transparent:old.transparent,opacity:old.opacity,side:old.side});mat.userData={...old.userData};replaced.set(old,mat);}o.material=replaced.get(old);});for(const old of replaced.keys())old.dispose();
    const knight=job==='swordsman'&&!female,jaw=({swordsman:knight?1.06:1.14,mage:.94,scout:.95,chef:1.1,healer:1.0,smith:1.18,archer:.9}[job])*(female?.85:1),faceMesh=m.userData.headMesh;
    if(faceMesh&&root.CharacterSculpt?.head){faceMesh.geometry.dispose();faceMesh.geometry=knight&&root.CharacterSculpt.knightHead?root.CharacterSculpt.knightHead(T):root.CharacterSculpt.head(T,.54,.55,.48,{jaw:female&&job==='smith'?.94:jaw,cheek:job==='chef'?1.45:female&&job==='smith'?1.45:female?1.2:1,chin:female?.86:job==='smith'?1.12:1,detail:'hero'});}
    for(const child of head.children)if(child.name==='hair-side'||job==='archer'&&child.name==='human-ear')child.visible=false;
    if(m.children.find(c=>c.name==='base-skirt'))m.children.find(c=>c.name==='base-skirt').visible=false;
    const mats=new Map(),add=(geo,color,x,y,z,parent=head)=>{if(!mats.has(color))mats.set(color,new T.MeshLambertMaterial({color}));const o=new T.Mesh(geo,mats.get(color));o.position.set(x,y,z);parent.add(o);return o;};
    const soft=(w,h,d,color,x,y,z,parent=head)=>{const o=add(new T.SphereGeometry(1,10,6),color,x,y,z,parent);o.scale.set(w/2,h/2,d/2);return o;};
    if(female&&job==='chef'){const bun=soft(.25,.24,.24,s.hair,.17,-.045,-.23);bun.name='connected-hair-bun';}
    if(!female&&['mage','smith'].includes(job)){const beard=add(root.CharacterSculpt.capsule(T,job==='smith'?.26:.18,job==='smith'?.17:.12,.065),s.hair,0,-.2,.19);beard.name='profession-beard';if(job==='smith')smithLongBeard(T,beard);}
    if(job==='archer')for(const side of [-1,1]){const ear=add(new T.ConeGeometry(.085,.34,5),s.skin,side*.34,.02,-.02);ear.rotation.z=-side*1.05;add(new T.SphereGeometry(.035,6,4),0xe6d19d,side*.31,-.055,.025);}
    const nose=head.children.find(c=>c.name==='sculpted-nose');if(nose)nose.scale.set(female?.82:job==='smith'?1.15:1,female?.9:1,job==='mage'?1.15:female?.85:1);
    const bridge=soft(.048,.105,.044,s.skin,0,-.015,.244);bridge.name='nose-bridge';for(const side of [-1,1]){const nostril=soft(.013,.012,.01,0x8b6055,side*.024,-.074,.286);nostril.name='nostril';}
    const face=m.userData.face;if(face){const eyeMaterial=new T.MeshLambertMaterial({color:s.eyes});for(const eye of face.eyes){eye.material=eyeMaterial;eye.scale.x=female&&job==='smith'?.96:female?.88:.76;}for(const b of face.brows){b.scale.x=(job==='smith'?(female?.86:1.2):job==='healer'?.8:1)*(female?.9:1.1);b.scale.y=female?.7:1.2;}face.width=(job==='chef'?1.15:job==='archer'?.85:1)*(female?.9:1);for(const lip of face.lips||[])lip.material.color.setHex(female?0xb3747b:0xae8170);for(const cheek of face.cheeks)cheek.material.opacity=female?.34:.24;}
    root.CharacterFace?.refine(T,m,{job,sex,skin:s.skin,hair:s.hair,eyes:s.eyes});
    if(knight)fitKnightFace(T,m);
    // A real short neck overlaps chin and collar, avoiding floating female heads.
    const neckMesh=new T.Mesh(root.CharacterSculpt.capsule(T,female?.19:.22,.23,.19),new T.MeshPhongMaterial({color:s.skin,specular:0x332521,shininess:13}));neckMesh.name='anatomical-neck';neckMesh.position.set(0,1.35,-.015);m.add(neckMesh);
    if(job==='scout')for(const side of [-1,1])for(let i=0;i<2;i++)add(new T.SphereGeometry(.012,5,4),0xa56a51,side*(.15+i*.04),-.055,.265);
    if(job==='chef'&&!female){for(const side of [-1,1]){const moustache=add(new T.SphereGeometry(.065,8,5),s.hair,side*.045,-.09,.265);moustache.scale.set(1,.35,.3);}}
    if(job==='smith'&&!female){const scar=add(new T.BoxGeometry(.013,.11,.012),0xe2bd9b,-.16,.08,.275);scar.rotation.z=.25;}
    if(job==='archer'&&female)for(const limb of [m.userData.armL,m.userData.armR,m.userData.legL,m.userData.legR]){limb.scale.x*=1.08;limb.scale.z*=1.08;}
    const badge=add(new T.SphereGeometry(.045,8,5),s.accent,.2,1.21,.23,m);badge.scale.z=.4;m.userData.baseClothing?.push(badge);
    if(female){for(const leg of [m.userData.legL,m.userData.legR]){leg.material=new T.MeshPhongMaterial({color:s.skin,specular:0x332521,shininess:13});const boot=leg.children.find(c=>c.geometry?.type==='ExtrudeGeometry');if(boot){boot.scale.y=1.8;boot.position.y=-.38;}}}
    for(const arm of [m.userData.armL,m.userData.armR]){const sleeve=arm.children.find(c=>c.geometry?.type==='LatheGeometry');if(sleeve){sleeve.scale.set(1.12,female?.86:1.04,1.12);sleeve.name='connected-shoulder-sleeve';}const cuff=arm.children.find(c=>c.geometry?.type==='BoxGeometry');if(cuff){cuff.scale.set(1.06,1.1,1.06);cuff.name='tailored-wrist-cuff';}}
    if(job==='smith')smithDwarfBody(T,m);
    if(knight)knightBody(T,m,s);
    if(job==='archer'){const old=m.userData.armR.geometry;bowArmRig(T,m);old.dispose();}
    joinHumanShoulders(T,m);
    return m;
  }
  function portrait(job,sex='male'){
    if(job==='robot'){const l=ROBOT_LOOKS[sex==='female'?'female':'male'],hex=c=>'#'+c.toString(16).padStart(6,'0'),female=sex==='female';return '<svg class="hero-portrait" viewBox="0 0 96 112" role="img" aria-label="機器人 · '+l.name+'"><rect x="2" y="2" width="92" height="108" rx="20" fill="#1b333d"/><path d="M14 110V93q0-18 34-18t34 18v17" fill="'+hex(l.metal)+'" stroke="'+hex(l.trim)+'" stroke-width="3"/><circle cx="48" cy="94" r="10" fill="'+hex(l.dark)+'" stroke="'+hex(l.trim)+'" stroke-width="4"/><circle cx="48" cy="94" r="6" fill="'+hex(l.core)+'"/><path d="M23 44V31q0-23 25-23t25 23v22q-1 22-25 22T23 53Z" fill="'+hex(l.metal)+'" stroke="'+hex(l.trim)+'" stroke-width="3"/><path d="M29 36q19-10 38 0v20q0 13-19 15T29 56Z" fill="'+hex(l.face)+'"/><path d="M32 27 48 16l16 11M34 40h10m8 0h10" fill="none" stroke="'+hex(l.trim)+'" stroke-width="3"/><g fill="'+hex(l.dark)+'" stroke="'+hex(l.trim)+'" stroke-width="3"><ellipse cx="23" cy="44" rx="7" ry="11"/><ellipse cx="73" cy="44" rx="7" ry="11"/></g><g fill="'+hex(l.core)+'"><ellipse cx="38" cy="48" rx="'+(female?4.5:4)+'" ry="'+(female?6:4.5)+'"/><ellipse cx="58" cy="48" rx="'+(female?4.5:4)+'" ry="'+(female?6:4.5)+'"/></g><path d="M39 61q9 '+(female?6:3)+' 18 0" fill="none" stroke="'+hex(l.dark)+'" stroke-width="2" stroke-linecap="round"/></svg>';}
    const s=style(job,sex),female=sex==='female',hex=c=>'#'+c.toString(16).padStart(6,'0'),ears=job==='archer'?'<path d="m22 35-12-9 5 19 9 1m50-11 12-9-5 19-9 1" fill="'+hex(s.skin)+'"/>':'',long=['mage','healer','archer'].includes(job),hair=female?'<path d="M23 28q2-24 25-24t25 24v'+(long?55:40)+'l-12-8H32l-11 8Z" fill="'+hex(s.hair)+'"/>':'<path d="M23 30q1-25 25-25 27 3 25 25v13H23Z" fill="'+hex(s.hair)+'"/>',face=female?'M27 29q21-15 42 0v24q-2 15-21 23-19-8-21-23Z':'M24 29q24-17 48 0v27l-9 15-15 6-15-6-9-15Z';
    const braids=female&&job==='smith'?'<g data-hair="twin-braids" fill="none" stroke="'+hex(s.hair)+'" stroke-width="8" stroke-linecap="round"><path d="M24 51q-10 8-4 18t-1 17"/><path d="M72 51q10 8 4 18t1 17"/></g><path d="M14 84h12m44 0h12" stroke="'+hex(s.accent)+'" stroke-width="4"/>':female&&!long?'<path d="M72 50q11 7 3 21t-1 17" fill="none" stroke="'+hex(s.hair)+'" stroke-width="8" stroke-linecap="round"/>':'';
    return '<svg class="hero-portrait" viewBox="0 0 96 112" role="img" aria-label="'+H.JOBS[job].name+' · 成年'+(female?'女性':'男性')+' · '+s.description+'"><rect x="2" y="2" width="92" height="108" rx="20" fill="#1b333d"/>'+hair+ears+'<path d="'+face+'" fill="'+hex(s.skin)+'"/><path d="M'+(female?'19':'12')+' 110V92q0-20 '+(female?'29':'36')+'-20t'+(female?'29':'36')+' 20v18" fill="'+hex(s.cloak)+'"/><path d="M27 32q17-28 43-4l-16 7-11-8-16 16Z" fill="'+hex(s.hair)+'"/><path d="M30 42h12m12 0h12" stroke="'+hex(s.hair)+'" stroke-width="'+(female?2:3)+'" stroke-linecap="round"/><ellipse cx="36" cy="49" rx="3" ry="4" fill="'+hex(s.eyes)+'"/><ellipse cx="60" cy="49" rx="3" ry="4" fill="'+hex(s.eyes)+'"/><path d="m48 49-3 8h5m-9 7q7 4 14 0" fill="none" stroke="'+(female?'#aa6672':'#936f60')+'" stroke-width="2" stroke-linecap="round"/>'+braids+(!female&&['chef','mage','smith'].includes(job)?'<path '+(job==='smith'?'data-beard="long-dwarf" d="M34 65q14 10 28 0 1 21-14 36-15-15-14-36Z"':'d="m34 65 14 4 14-4-5 11H39Z"')+' fill="'+hex(s.hair)+'"/>':'')+'<path d="M'+(female?'32 83 48 98 64 83':'27 85h42m-33 0 12 16 12-16')+'" fill="none" stroke="'+hex(s.accent)+'" stroke-width="3"/></svg>';
  }
  function mountHeadwear(T,model,piece){
    const head=model.userData.head;
    if(!head||head.isMesh){model.add(piece);return;}
    const kind=piece.userData.baseKind,female=model.userData.heroSex==='female';
    if(kind==='heavy_helm'||kind==='light_hood'){
      // The retained lower hair starts at head-local y=.08. Seat the cap
      // slightly over that continuous seam, with its own shell thickness.
      // Head-local fitting follows the actual face scale and animation.
      const radius=kind==='heavy_helm'?(female?.285:.315):(female?.285:.325);
      const height=radius*(female?(kind==='heavy_helm'?.86:.75):1);
      const anchor=kind==='heavy_helm'?(female?1.75:1.68):(female?1.74:1.66);
      piece.scale.set(.303/radius,.28/height,.28/(radius*.9));
      piece.position.set(0,.074-anchor*piece.scale.y,-.018);
    }else if(kind==='rune_crown'){
      // An open circlet follows the rounded brow; keep the full hairstyle.
      const radius=female?.3:.31;
      piece.scale.set(.274/(radius*1.05),1,.240/radius);
      piece.position.set(0,.18-1.785,-.018);
    }else{
      // Preserve the authored rest placement for any future headgear type.
      head.updateMatrix();piece.updateMatrix();
      const local=new T.Matrix4().copy(head.matrix).invert().multiply(piece.matrix);
      local.decompose(piece.position,piece.quaternion,piece.scale);
    }
    head.add(piece);
  }
  function poseRobotLegArmor(model){if(model.userData.heroJob!=='robot')return;for(const shell of model.userData.heroPieces||[])if(shell.userData.baseKind==='robot_shell')for(const plate of shell.children){const joint=model.userData[plate.userData.robotJoint];if(joint){plate.position.copy(joint.position);plate.quaternion.copy(joint.quaternion);plate.scale.copy(joint.scale);}}}
  function dress(T,model,equipment,dispose,{showHelmet=true}={}){const appearance={job:model.userData.heroJob,sex:model.userData.heroSex},info=appearance.job==='robot'?robotLight(equipment):null;equipment=Object.fromEntries(Object.entries(equipment).filter(([slot,g])=>!['core1','core2'].includes(slot)&&g?.slot!=='core').map(([slot,g])=>[slot,g?.durability===0?null:g]));const geometrySignature=(appearance.job||'')+'|'+(appearance.sex||'male')+'|'+showHelmet+'|'+Object.values(equipment).map(g=>g?.kind||'-').join('|'),signature=geometrySignature+(info?'|core:'+info.tier:'');if(model.userData.heroDress===signature)return;if(model.userData.heroDressGeometry===geometrySignature){if(info)colorRobotEnergy(model,info);model.userData.heroDress=signature;return;}
    for(const p of model.userData.heroPieces||[]){p.parent?.remove(p);dispose(p);}const pieces=[];
    if(model.userData.knightSculpt)swordSupportRig(T,model,H.GEAR[equipment.weapon?.kind]?.baseKind==='greatsword');
    for(const item of Object.values(equipment).filter(g=>g&&(g.slot!=='helmet'||showHelmet))){const piece=gear(T,item.kind,appearance),slot=item.slot;pieces.push(piece);
      const baseKind=H.GEAR[item.kind].baseKind;
      if(slot==='weapon'){if(baseKind==='elven_bow'&&model.userData.bowArms){piece.position.set(0,0,0);model.userData.bowArms.right.hand.add(piece);}else{if(model.userData.heroGrip)piece.position.fromArray(model.userData.heroGrip);else piece.position.set(0,baseKind==='robot_fists'?-.53:-.36,baseKind==='robot_fists'?.07:.13);model.userData.armR.add(piece);}if(baseKind==='twin_daggers'||baseKind==='robot_fists'){const left=gear(T,item.kind,appearance);left.position.set(0,baseKind==='robot_fists'?-.53:-.36,baseKind==='robot_fists'?.07:.13);if(baseKind==='robot_fists')left.scale.x=-1;model.userData.armL.add(left);pieces.push(left);}}
      else if(slot==='shield'){piece.position.set(.07,-.32,.08);piece.rotation.y=Math.PI/3;model.userData.armL.add(piece);}else if(slot==='helmet')mountHeadwear(T,model,piece);else model.add(piece);
      if(model.userData.knightSculpt&&slot==='armor'){piece.scale.set(.95,1,.94);piece.position.y=.125-KNIGHT_LEG_TRIM;}
      if(model.userData.smithLegTrim&&slot==='armor')piece.position.y-=model.userData.smithLegTrim;
    }
    // His cropped hair is entirely under a full helmet; do not leave the thin
    // lower fringe floating along the cheek guards. Other hairstyles keep their
    // visible braids/nape. Removing or hiding the helmet restores the short cut.
    for(const p of model.userData.head?.children||[])if(p.name==='hair-crown'||p.name==='hair-fringe'||model.userData.knightSculpt&&p.name==='profession-hair')p.visible=!showHelmet||!equipment.helmet||H.GEAR[equipment.helmet.kind]?.baseKind==='rune_crown';
    // Equipment owns the torso/waist silhouette; old uniform trim must never
    // protrude from a slimmer robe or female armor. Broken/removed armor restores it.
    for(const p of model.userData.baseClothing||[])p.visible=!equipment.armor;
    Object.assign(model.userData,{heroDress:signature,heroDressGeometry:geometrySignature,heroPieces:pieces,heroWeapon:H.GEAR[equipment.weapon?.kind]?.baseKind,heroWeaponKind:equipment.weapon?.kind,hasWeapon:!!equipment.weapon,hasShield:!!equipment.shield});
    if(appearance.job==='robot'){model.userData.heroWeapon='robot_fists';model.userData.hasShield=false;for(const side of ['armR','armL'])if(model.userData[side+'BareFist'])model.userData[side+'BareFist'].visible=!equipment.weapon;poseRobotLegArmor(model);colorRobotEnergy(model,info);}
    if(['spellbook','twin_daggers'].includes(model.userData.heroWeapon))pose(model,0,1,false,0);
  }
  function pose(model,remaining,interval,fp=false,dt=0){const right=model.userData.armR,left=model.userData.armL,kind=model.userData.heroWeapon;if(!right||!left)return;
    if(root.TowerCombatMotion){
      const p=root.TowerCombatMotion.update(model,dt),T=root.THREE,q=model.userData.heroWrist||(model.userData.heroWrist=new T.Quaternion()),e=model.userData.heroWristEuler||(model.userData.heroWristEuler=new T.Euler()),offset=model.userData.heroWristOffset||(model.userData.heroWristOffset=new T.Vector3());
      right.rotation.set(p.rx,p.ry,p.rz);left.rotation.set(p.lx,p.ly,p.lz);
      const bow=model.userData.bowArms;if(bow){if(kind==='elven_bow')poseBowArms(model,p.bowRaise,p.bowDraw,p.wx,p.wy,p.wz);else for(const arm of [bow.right,bow.left]){arm.elbow.rotation.set(-.65,0,0);arm.hand.quaternion.identity();}}
      // Heading stays outermost, so the torso leans toward its own target at
      // every compass direction instead of pitching around the world's X axis.
      model.rotation.order='YXZ';model.rotation.x=p.lean;model.rotation.z=p.tilt;
      for(const part of model.userData.heroPieces||[]){part.visible=!fp||part.parent===right||part.parent===left||part.parent===bow?.right.hand||part.userData.baseKind==='spellbook';
        if(part.userData.baseKind===kind){if(kind==='spellbook'){part.position.set(0,-.36,.13);e.set(p.bookTilt,0,0);q.setFromEuler(e);part.quaternion.copy(right.quaternion).invert().multiply(q);bookPose(part,p.bookOpen);}else if(kind==='elven_bow'&&bow){part.position.set(0,0,0);part.quaternion.identity();}else{const l=part.parent===left;offset.set(l?p.lpx:p.wpx,l?p.lpy:p.wpy,l?p.lpz:p.wpz).applyQuaternion(q.copy(part.parent.quaternion).invert());if(model.userData.heroGrip&&!l)part.position.fromArray(model.userData.heroGrip);else part.position.set(0,kind==='robot_fists'?-.53:-.36,kind==='robot_fists'?.07:.13);part.position.add(offset);e.set(l?p.lwx:p.wx,l?p.lwy:p.wy,l?p.lwz:p.wz);q.setFromEuler(e);part.quaternion.copy(part.parent.quaternion).invert().multiply(q);}}
      }
      if(model.userData.knightRightHand){const hand=model.userData.knightRightHand;e.set(p.wx,p.wy,p.wz);q.setFromEuler(e);hand.quaternion.copy(right.quaternion).invert().multiply(q);offset.set(p.wpx,p.wpy,p.wpz).applyQuaternion(q.copy(right.quaternion).invert());hand.position.fromArray(model.userData.heroGrip).add(offset);}
      poseSwordSupport(model,p,q);
      if(model.userData.legL)model.userData.legL.rotation.x-=p.knee;if(model.userData.legR)model.userData.legR.rotation.x+=p.knee;poseRobotLegArmor(model);return;
    }
    const t=remaining>0?Math.max(0,Math.min(1,1-remaining/interval)):1,swing=remaining>0?Math.sin(t*Math.PI):0;
    // Forward is +Z: negative shoulder rotation moves the hand towards +Z.
    right.rotation.x=-.25-swing*1.45;right.rotation.z=-.08+swing*.3;
    if(['greatsword','warhammer','arcane_staff'].includes(kind)){left.rotation.x=-.48-swing*1.2;left.rotation.z=-.95;right.rotation.z=.65;}
    else if(kind==='spellbook'){right.rotation.x=-.28-swing*1.15;right.rotation.z=-.08;left.rotation.x=-swing*.65;left.rotation.z=.05;}
    else if(kind==='twin_daggers'){left.rotation.x=-.3-Math.sin(Math.min(1,t+.2)*Math.PI)*swing;left.rotation.z=.12;}
    else{left.rotation.z=.05;left.rotation.x=model.userData.hasShield?-.35:0;}
    const T=root.THREE,q=model.userData.heroWrist||(model.userData.heroWrist=new T.Quaternion()),e=model.userData.heroWristEuler||(model.userData.heroWristEuler=new T.Euler());
    for(const p of model.userData.heroPieces||[]){p.visible=!fp||p.parent===right||p.parent===left||p.userData.baseKind==='spellbook';
      if(p.userData.baseKind===kind&&p.parent!==model){const phase=p.parent===left?swing*.8:swing;if(kind==='spellbook'){e.set(-swing*.2,0,0);bookPose(p,swing);}else if(kind==='twin_daggers')e.set(Math.PI/2-2.7*phase,Math.PI/2,p.parent===left?.15:-.15);else e.set(.25+1.35*phase,.16*phase,.12-.3*phase);q.setFromEuler(e);p.quaternion.copy(p.parent.quaternion).invert().multiply(q);}
    }
  }
  root.TowerHeroVisuals={gear,STYLES,VARIANTS,ROBOT_LOOKS,ROBOT_CORE_COLORS,syncRobotLight:colorRobotEnergy,style,base,portrait,dress,pose,bookPose};
})(globalThis);
