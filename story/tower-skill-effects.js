/* Original layered spells: filled silhouettes, GPU particles and soft light.
   Uses the existing loop, no dynamic lights, bloom, fullscreen flashes or lines. */
(function(root){'use strict';
  const PALETTES={swordsman:[0xffe5af,0xffa46c],mage:[0xc6b5ff,0x86e4ff],scout:[0xa3ffe0,0x54cda2],chef:[0xffd6a0,0xff9a64],healer:[0xd9ffe4,0x79edba],smith:[0xffdea9,0xffa465],archer:[0xffe6ac,0x99ddb2],robot:[0xbff3ff,0xffbd73]};
  const FAMILIES={arrow:'arrow',binding:'arrow',volley:'arrow',great_arrow:'arrow',decisive:'slash',star_ring:'meteor',escape:'scan',feast:'steam',sanctuary:'heal',fortress:'shield',cleave:'slash',circle:'spin',blind:'slash',stun:'impact',stagger:'impact',splash:'splash',bolt:'cast',weak:'cast',slow:'slash',mark:'cast',shock:'storm',thorns:'thorns',repel:'wave',starfall:'meteor',guard:'shield',barrier:'shield',ward:'shield',fortify:'shield',rally:'aura',speed:'aura',polish:'forge',stealth:'smoke',smoke:'smoke',stomach:'steam',meal:'steam',soup:'heal',heal:'heal',revive:'heal',cleanse:'cleanse',reveal:'scan',disarm:'scan',daylight:'sun',repair:'forge',frost:'frost',taunt:'wave',barricade:'forge'};
  const THEMES={shock:[0xebfaff,0x459fff],thorns:[0xd5f697,0x6aab43],starfall:[0xfff1cc,0xff8242],star_ring:[0xfff1cc,0xea92ff],frost:[0xe1fbff,0x72cdff],splash:[0xffd090,0xfb714a],weak:[0xe4fff2,0x8be8bd],mark:[0xfff0be,0xfa9e62]};
  const ROBOT_FAMILIES=Object.freeze({flying_fist:'rocket_fist',iron_charge:'ram',shoulder_quake:'quake',folded_guard:'shield',joint_oil:'lubricate',parts_restore:'rebuild',steel_meteor_fist:'quake',explosive_fists:'twin_fist',mech_aid:'shield'});
  Object.assign(FAMILIES,{robot_fist:'rocket_fist',robot_charge:'ram',robot_quake:'quake',robot_guard:'shield',robot_speed:'lubricate',robot_restore:'rebuild',robot_meteor:'quake',robot_double:'twin_fist',mech_aid:'shield'});
  const visualFamilies=new Set(Object.values(FAMILIES));
  const familyFor=skill=>ROBOT_FAMILIES[skill?.id]||(visualFamilies.has(skill?.presentation?.family)?skill.presentation.family:FAMILIES[skill?.effect]);
  const colorsFor=skill=>Array.isArray(skill?.presentation?.colors)&&skill.presentation.colors.length===2&&skill.presentation.colors.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffff)?skill.presentation.colors:THEMES[skill?.effect]||PALETTES[skill?.job]||PALETTES.swordsman;
  const PARTICLE_VERTEX=[
    'attribute vec3 velocity; attribute float seed; attribute float pointSize;',
    'uniform float age; uniform float duration; uniform float travel; uniform float flow;',
    'varying vec3 tint; varying float fade;',
    'void main(){float t=clamp(age/duration,0.,1.);vec3 p=position;',
    'if(flow<.5){p+=velocity*t*travel;p.y-=t*t*.5*travel;}',
    'else if(flow<1.5){float a=t*3.5*travel+seed*2.;p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;p.y+=t*1.7*travel;}',
    'else if(flow<2.5){p.xz*=1.-t*.85;p.y+=sin(t*3.14159)*.8*travel;}',
    'else{p+=velocity*t*.3*travel;p.y+=t*1.2*travel;}',
    'vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;',
    'gl_PointSize=clamp(pointSize*260./max(1.,-v.z),1.,42.);',
    'tint=color;fade=smoothstep(0.,.09,t+.035)*(1.-smoothstep(.48,1.,t));}'
  ].join('\n');
  const PARTICLE_FRAGMENT=[
    'varying vec3 tint;varying float fade;uniform float shape;',
    'void main(){vec2 p=(gl_PointCoord-.5)*2.;float d=length(p);float petal=abs(p.x)*1.3+abs(p.y)*.75;',
    'float alpha=pow(max(0.,1.-mix(d,petal,shape)),1.65)*fade;if(alpha<.012)discard;',
    'gl_FragColor=vec4(mix(tint,vec3(1.),pow(max(0.,1.-d),5.)*.75),alpha);}'
  ].join('\n');
  function create(T,ctx){
    let effects=[],destroyed=false;
    const limit=Math.max(1,Math.min(12,Math.floor(Number(ctx.limit)||12))),reduced=!!ctx.reducedMotion;
    // Three manager-owned, original 64px textures: 48 KiB, reused across floors.
    function texture(kind){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,d=Math.sqrt(dx*dx*(kind==='petal'?2:1)+dy*dy),noise=.86+.14*Math.sin(x*.51+Math.cos(y*.4))*Math.sin(y*.37);
      const a=Math.pow(Math.max(0,1-d),kind==='mist'?1.05:1.8)*(kind==='mist'?noise:1),i=(y*size+x)*4;
      data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*255);
    }const map=new T.DataTexture(data,size,size,T.RGBAFormat);map.needsUpdate=true;map.magFilter=map.minFilter=T.LinearFilter;return map;}
    const glow=texture('glow'),petal=texture('petal'),mist=texture('mist');
    // Keep the two GPU programs warm between casts. Each draw supplies its own
    // phase/tint; resetting a floor disposes effect geometry, not shared shaders.
    const particleMaterial=new T.ShaderMaterial({uniforms:{age:{value:0},duration:{value:1},travel:{value:reduced?.25:1},flow:{value:0},shape:{value:0}},vertexShader:PARTICLE_VERTEX,fragmentShader:PARTICLE_FRAGMENT,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
    let shieldMaterial=null;
    function dispose(f){if(!f)return;f.group.parent?.remove(f.group);const geometries=new Set();f.group.traverse(o=>{if((o.isMesh||o.isPoints)&&o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());f.mats.forEach(m=>m.dispose());}
    function emit(skill,at,angle=0,options={}){
      if(destroyed||!at||!skill||!familyFor(skill)||ctx.visible&&!ctx.visible(at))return null;
      if(effects.length>=limit)dispose(effects.shift());
      const baseFamily=familyFor(skill),family=options.impact?(skill.job==='robot'?'mechanical_hit':['storm','thorns'].includes(baseFamily)?baseFamily:'hit'):options.stage==='charge'?'charge':options.stage==='land'?(skill.job==='robot'?'quake':baseFamily==='meteor'?'meteor':'burst'):baseFamily;
      const colors=colorsFor(skill),group=new T.Group();group.name='skill-vfx-'+skill.id;group.position.set(at.x,.04,at.z);group.rotation.y=angle;
      const total=family==='thorns'&&options.impact?3:family==='storm'?.92:family==='hit'?.42:family==='charge'||family==='meteor'?Math.min(4,Math.max(.1,Number(options.duration)||.85)):reduced?.65:['heal','shield','sun'].includes(family)?1.6:1.15;
      const parts=[],mats=[],count=reduced?2:4,power=skill.unique?1.18:1;
      function material(color,opacity=.8,map=null,sprite=false){const opts={color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,...(map?{map}:{}),...(!sprite?{side:T.DoubleSide,forceSinglePass:true}:{})},m=sprite?new T.SpriteMaterial(opts):new T.MeshBasicMaterial(opts);m.userData.baseOpacity=opacity;mats.push(m);return m;}
      function soft(x,y,z,size,tint=0,mode='rise',leaf=false,map=leaf?petal:glow){const m=new T.Sprite(material(colors[tint],leaf?.85:.85,map,true));m.position.set(x,y,z);m.scale.set(size,leaf?size*1.4:size,1);group.add(m);parts.push({m,base:m.position.clone(),scale:m.scale.clone(),mode});return m;}
      function solid(geometry,x,y,z,tint=0,mode='rise',opacity=.65){const m=new T.Mesh(geometry,material(colors[tint],opacity));m.position.set(x,y,z);group.add(m);parts.push({m,base:m.position.clone(),scale:m.scale.clone(),mode});return m;}
      function particles(flow=0,leaf=false){const n=reduced?12:48,positions=[],velocities=[],seeds=[],sizes=[],tints=[];
        for(let i=0;i<n;i++){const seed=(i*.61803398875)%1,a=i*2.39996,r=.15+(i%7)/9;positions.push(Math.sin(a)*r,flow===0?.75+seed*.45:.18+seed*1.25,Math.cos(a)*r);velocities.push(Math.sin(a)*(1.1+seed*1.4),.3+seed*2,Math.cos(a)*(1.1+seed*1.4));seeds.push(seed);sizes.push((leaf?.19:.1)+seed*.13);const c=new T.Color(colors[i%2]);tints.push(c.r,c.g,c.b);}
        const geometry=new T.BufferGeometry();for(const [key,data,size]of [['position',positions,3],['velocity',velocities,3],['seed',seeds,1],['pointSize',sizes,1],['color',tints,3]])geometry.setAttribute(key,new T.Float32BufferAttribute(data,size));geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1,0),6);
        const cloud=new T.Points(geometry,particleMaterial);cloud.name='batched-spell-particles';cloud.userData.phase={age:0,duration:total,flow,shape:leaf?1:0};
        cloud.onBeforeRender=()=>{const u=particleMaterial.uniforms,p=cloud.userData.phase;for(const key of ['age','duration','flow','shape'])u[key].value=p[key];particleMaterial.uniformsNeedUpdate=true;};
        group.add(cloud);parts.push({m:cloud,mode:'particles'});return cloud;
      }
      const ground=new T.Mesh(new T.PlaneGeometry(3.6,3.6),material(colors[1],.24,glow));ground.rotation.x=-Math.PI/2;ground.position.y=.008;group.add(ground);
      if(['rocket_fist','twin_fist'].includes(family)){
        // A filled, forward-facing fist silhouette, not a generic magic orb.
        const n=family==='twin_fist'&&!reduced?2:1;
        for(let i=0;i<n;i++){
          const s=new T.Shape();s.moveTo(-.26,-.18);s.lineTo(.17,-.18);s.quadraticCurveTo(.32,-.12,.32,.045);s.quadraticCurveTo(.29,.12,.19,.13);s.lineTo(.19,.25);s.quadraticCurveTo(.13,.37,.05,.29);s.lineTo(.045,.235);s.quadraticCurveTo(-.025,.36,-.1,.28);s.lineTo(-.105,.215);s.quadraticCurveTo(-.18,.32,-.27,.23);s.lineTo(-.27,-.1);s.closePath();
          const geometry=new T.ExtrudeGeometry(s,{depth:.22,bevelEnabled:true,bevelThickness:.025,bevelSize:.02,bevelSegments:1,steps:1}),normals=geometry.attributes.normal,tints=[];
          // Raised gold bevels and shaded steel thickness retain a real fist
          // silhouette even in bright rooms; existing scene lights do the work.
          for(let v=0;v<normals.count;v++){const facing=Math.abs(normals.getZ(v)),color=new T.Color(facing>.95?colors[0]:facing>.15?colors[1]:0x456373);tints.push(color.r,color.g,color.b);}
          geometry.setAttribute('color',new T.Float32BufferAttribute(tints,3));
          const fist=solid(geometry,i?.37:-.37,1.12,.28+i*.17,0,'flight',.96),old=fist.material;
          mats.splice(mats.indexOf(old),1);old.dispose();fist.material=new T.MeshPhongMaterial({color:0xffffff,vertexColors:true,emissive:0x0f2630,emissiveIntensity:.4,specular:0xe2f1fa,shininess:70,transparent:true,opacity:.96,depthWrite:false,blending:T.NormalBlending,toneMapped:false});fist.material.userData.baseOpacity=.96;mats.push(fist.material);
          fist.name='robot-propelled-fist';fist.scale.setScalar(skill.unique?1.45:1);fist.rotation.y=i?-.18:.18;
          const exhaust=soft(i?.37:-.37,1.10,.12+i*.17,.78,1,'flight');exhaust.material.opacity=.45;exhaust.material.userData.baseOpacity=.45;exhaust.scale.z=1;
        }
      }else if(family==='ram'){
        soft(0,.82,.7,2.05,0,'breathe');
        for(let i=0;i<(reduced?1:3);i++){const s=new T.Shape();s.moveTo(-.66,0);s.quadraticCurveTo(0,.4,.66,0);s.lineTo(.56,-.11);s.quadraticCurveTo(0,.17,-.56,-.11);s.closePath();const plate=solid(new T.ShapeGeometry(s),0,.6+i*.24,.44+i*.21,i%2,'flight',.65);plate.name='robot-charge-pressure-front';}
      }else if(['quake','mechanical_hit'].includes(family)){
        const impact=soft(0,family==='quake'?.2:1.03,0,skill.unique?3.0:2.2,0,'breathe');impact.name='robot-impact-core';
        // Debris and filled pressure fans use the same bounded particle program.
        for(let i=0;i<(reduced?2:4);i++){const a=i*Math.PI*2/4,shard=solid(new T.DodecahedronGeometry(family==='quake'?.17:.11,0),Math.sin(a)*.33,family==='quake'?.24:1.03,Math.cos(a)*.33,i%2,'contact',.9);shard.name='robot-armor-impact-shard';shard.scale.y=family==='quake'?.7:1.6;}
      }else if(['rebuild','lubricate'].includes(family)){
        soft(0,.85,0,1.55,0,'breathe');
        if(family==='rebuild'){const s=new T.Shape();for(let i=0;i<32;i++){const a=i*Math.PI*2/32,r=i%4<2?.36:.29,x=Math.sin(a)*r,y=Math.cos(a)*r;if(i)s.lineTo(x,y);else s.moveTo(x,y);}s.closePath();const cog=solid(new T.ShapeGeometry(s),0,1.20,.28,1,'orbit',.8);cog.name='robot-repair-cog';}
        else {const s=new T.Shape();s.moveTo(0,.43);s.bezierCurveTo(-.13,.16,-.34,-.08,-.18,-.25);s.quadraticCurveTo(0,-.4,.18,-.25);s.bezierCurveTo(.34,-.08,.13,.16,0,.43);s.closePath();const oil=solid(new T.ShapeGeometry(s),0,1.24,.3,1,'rise',.85);oil.name='robot-lubricant-drop';}
        for(let i=0;i<(reduced?1:3);i++){const a=i*Math.PI*2/3;soft(Math.sin(a)*.47,.36+i*.24,Math.cos(a)*.47,.38,0,'orbit');}
      }else if(family==='storm'){
        soft(0,1.05,0,2.2,1,'breathe');
        for(let i=0;i<(reduced?2:3);i++){const s=new T.Shape();s.moveTo(0,0);s.lineTo(.48,.75);s.lineTo(.13,.7);s.lineTo(.68,1.48);s.lineTo(.3,1.4);s.lineTo(.75,2.4);s.lineTo(.07,1.5);s.lineTo(.35,1.55);s.lineTo(-.14,.65);s.lineTo(.16,.68);s.closePath();const bolt=solid(new T.ShapeGeometry(s),Math.sin(i*2.1)*.66,.15,Math.cos(i*2.1)*.66,i%2,'electric',.95);bolt.rotation.y=i*2.1;bolt.rotation.z=(i-1)*.6;}
        for(let i=0;i<(reduced?1:2);i++)soft(i?-.8:.8,1.1,0,.7,0,'contact');
      }else if(family==='thorns'){
        for(let i=0;i<(reduced?1:2);i++){const a=i*Math.PI,points=Array.from({length:10},(_,n)=>{const p=a+n*.65,r=.8-n*.045;return new T.Vector3(Math.sin(p)*r,n*.21,Math.cos(p)*r);});const vine=solid(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.1,5,false),0,0,0,1,'grow',.95);vine.material.blending=T.NormalBlending;
          const thorn=solid(new T.ConeGeometry(.22,.85,5),Math.sin(a+.7)*.68,.9,Math.cos(a+.7)*.68,0,'grow',.95);thorn.rotation.z=Math.cos(a)*.65;thorn.rotation.x=Math.sin(a)*.65;}
        soft(0,.28,0,2,1,'breathe');
      }else if(family==='splash'){
        const splash=soft(0,.7,.65,1.8,1,'splat');splash.scale.y=.85;
        for(let i=0;i<count;i++){const drop=solid(new T.SphereGeometry(.15,6,4),Math.sin(i*1.7)*.7,.65+Math.cos(i)*.2,.8+i*.09,i%2,'contact',.8);drop.scale.y=1.4;}
      }else if(['slash','spin'].includes(family)){
        for(let i=0;i<2;i++){const shape=new T.Shape();shape.moveTo(-1.3,0);shape.quadraticCurveTo(.2,1.7,1.4,.1);shape.quadraticCurveTo(.35,.6,-1.3,0);const sweep=solid(new T.ShapeGeometry(shape,16),0,family==='spin'?.85:1,family==='spin'?0:.5+i*.08,i,family==='spin'?'whirl':'sweep',i?.3:.75);sweep.rotation.x=family==='spin'?Math.PI/2:-.6;sweep.rotation.y=family==='spin'?i*Math.PI:0;sweep.rotation.z=family==='spin'?0:i*.18;}
        for(let i=0;i<count;i++)soft(Math.sin(i*1.6)*.7,.8+i*.09,.6+Math.cos(i)*.5,.45,i%2,'spark');
      }else if(family==='shield'){
        const dome=solid(new T.SphereGeometry(1.13,16,9,0,Math.PI*2,0,Math.PI*.62),0,.42,0,1,'breathe',.18);dome.userData.filledShield=true;
        if(!shieldMaterial)shieldMaterial=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color()},opacity:{value:1}},vertexShader:'varying vec3 n;varying vec3 eye;void main(){vec4 v=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-v.xyz);gl_Position=projectionMatrix*v;}',fragmentShader:'varying vec3 n;varying vec3 eye;uniform vec3 tint;uniform float opacity;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.4);gl_FragColor=vec4(mix(tint,vec3(1.),rim*.6),(.045+rim*.4)*opacity);}',side:T.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
        dome.material=shieldMaterial;dome.userData.tint=new T.Color(colors[1]);dome.userData.opacity=1;dome.onBeforeRender=()=>{shieldMaterial.uniforms.tint.value.copy(dome.userData.tint);shieldMaterial.uniforms.opacity.value=dome.userData.opacity;shieldMaterial.uniformsNeedUpdate=true;};
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;const crystal=solid(new T.OctahedronGeometry(.14),Math.sin(a)*.95,.35+i*.21,Math.cos(a)*.95,i%2,'orbit',.65);crystal.scale.y=1.5;}
      }else if(family==='meteor'){
        const n=reduced?1:skill.effect==='star_ring'?3:1;for(let i=0;i<n;i++){const a=i*Math.PI*2/3,x=Math.sin(a)*.8,z=Math.cos(a)*.8;const rock=solid(new T.DodecahedronGeometry(.37,0),x,3.5,z,0,'fall',.95);rock.rotation.set(.2,i,1);const flame=soft(x,4,z,1.35,1,'fall');flame.scale.y=2.7;}
      }else if(family==='charge'){
        soft(0,1.1,0,1.8,0,'breathe');for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*1.1,.2+i*.16,Math.cos(a)*1.1,.6,i%2,'gather');}
      }else if(family==='frost'){
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count,shard=solid(new T.ConeGeometry(.24,.9,5),Math.sin(a)*1.05,.34,Math.cos(a)*1.05,i%2,'grow',.8);shard.rotation.z=Math.sin(a)*.2;}soft(0,.4,0,2.3,1,'breathe');
      }else if(['smoke','steam'].includes(family)){
        for(let i=0;i<count;i++){const a=i*2.4;soft(Math.sin(a)*.65,.25+i*.13,Math.cos(a)*.65,1.55,1,'mist',false,mist);}
      }else if(family==='arrow'){
        soft(0,1.08,.6,1.1,0,'breathe');const n=reduced?1:skill.effect==='volley'?3:2;
        for(let i=0;i<n;i++){const s=new T.Shape();s.moveTo(0,1.35);s.lineTo(.13,.85);s.lineTo(.045,.92);s.lineTo(.04,0);s.lineTo(.13,-.2);s.lineTo(0,-.12);s.lineTo(-.13,-.2);s.lineTo(-.04,0);s.lineTo(-.045,.92);s.lineTo(-.13,.85);s.closePath();const arrow=solid(new T.ShapeGeometry(s),.24*(i-(n-1)/2),1.12,.2,i%2,'flight',.9);arrow.rotation.x=Math.PI/2;arrow.rotation.z=(i-(n-1)/2)*-.2;arrow.scale.setScalar(skill.unique?1.4:1);}
      }else if(family==='cast'){
        soft(0,1.12,.6,1.3,0,'breathe');for(let i=0;i<count;i++)soft(Math.sin(i*1.9)*.28,.95+i*.07,.4+i*.16,.4,i%2,'spark');
      }else if(['hit','burst','impact','forge'].includes(family)){
        soft(0,1.05,0,family==='burst'?2.4:1.7,0,'breathe');
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count,shard=solid(new T.OctahedronGeometry(family==='forge'?.085:.12),Math.sin(a)*.25,.95+Math.cos(a)*.2,Math.cos(a)*.25,i%2,'contact',.8);shard.scale.y=1.7;}
      }else if(['heal','cleanse'].includes(family)){
        soft(0,1.22,0,2.1,1,'breathe');const s=new T.Shape();s.moveTo(-.12,.46);s.lineTo(.12,.46);s.lineTo(.12,.12);s.lineTo(.46,.12);s.lineTo(.46,-.12);s.lineTo(.12,-.12);s.lineTo(.12,-.46);s.lineTo(-.12,-.46);s.lineTo(-.12,-.12);s.lineTo(-.46,-.12);s.lineTo(-.46,.12);s.lineTo(-.12,.12);s.closePath();const blessing=solid(new T.ShapeGeometry(s),0,1.65,.16,0,'rise',.7);blessing.name='restorative-blessing';
        for(let i=0;i<(reduced?1:3);i++){const a=i*Math.PI*2/3;soft(Math.sin(a)*.78,.2+i*.25,Math.cos(a)*.78,.55,i%2,'orbit',true);}
      }else{
        soft(0,['sun','heal','cleanse'].includes(family)?1.65:.6,0,family==='sun'?2.2:1.6,0,'breathe');
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*.78,.15+i*.25,Math.cos(a)*.78,.6,i%2,['scan','wave'].includes(family)?'spark':'orbit',['heal','aura','cleanse'].includes(family));}
      }
      particles(family==='charge'?2:['shield','heal','aura','cleanse','thorns','sun','rebuild','lubricate'].includes(family)?1:['steam','smoke'].includes(family)?3:0,['heal','aura','thorns','arrow'].includes(family));
      group.scale.setScalar(power);ctx.world().add(group);
      const f={group,total,left:total,parts,mats,family,at:{x:at.x,z:at.z},skill:skill.id};effects.push(f);return f;
    }
    function tick(dt){if(!Number.isFinite(dt)||dt<0)return;for(let i=effects.length-1;i>=0;i--){const f=effects[i];f.left-=dt;if(f.left<=0){dispose(f);effects.splice(i,1);continue;}if(ctx.visible)f.group.visible=ctx.visible(f.at);
      const t=1-f.left/f.total,fade=Math.min(1,(1-t)*3),travel=reduced?.25:1;for(const m of f.mats)if(m.userData.baseOpacity!==undefined)m.opacity=m.userData.baseOpacity*fade;
      for(const p of f.parts){const{m,base,mode,scale}=p;if(mode==='particles'){m.userData.phase.age=f.total-f.left;continue;}if(m.userData.filledShield)m.userData.opacity=fade;let size=1;
        if(mode==='rise')m.position.y=base.y+t*.85*travel;
        if(mode==='fall'){m.position.y=Math.max(.12,base.y-t*4.5);m.rotation.z+=dt*1.2*travel;}
        if(mode==='flight'){m.position.z=base.z+t*2.8*travel;size=1-t*.3;}
        if(mode==='spark'||mode==='contact'){m.position.x=base.x*(1+t*3*travel);m.position.z=base.z*(1+t*3*travel);m.position.y=base.y+(mode==='contact'?(base.y-1.05)*t*3:Math.sin(t*Math.PI)*.6);size=1-t*.6;}
        if(mode==='sweep'){m.rotation.z+=dt*3*travel;size=.7+t*.95;}
        if(mode==='whirl'){m.rotation.y+=dt*5.5*travel;size=.8+t*.4;}
        if(mode==='orbit'){const a=t*2*travel;m.position.x=base.x*Math.cos(a)-base.z*Math.sin(a);m.position.z=base.x*Math.sin(a)+base.z*Math.cos(a);m.position.y=base.y+t*.7;}
        if(mode==='grow')size=.12+.88*Math.min(1,t*7);
        if(mode==='electric')size=.94+.06*Math.sin(t*Math.PI*3);
        if(mode==='splat'){size=1+t*.9;m.position.y=base.y-t*.5;}
        if(mode==='breathe')size=.82+Math.sin(t*Math.PI)*.42;
        if(mode==='mist'){size=1+t*1.1;m.position.y=base.y+t*.5;}
        if(mode==='gather')m.position.set(base.x*(1-t),base.y+t*.7,base.z*(1-t));
        m.scale.copy(scale).multiplyScalar(size);
      }
    }}
    function reset(){effects.forEach(dispose);effects=[];}
    function cancel(f){const i=effects.indexOf(f);if(i>=0)dispose(effects.splice(i,1)[0]);}
    function destroy(){if(destroyed)return;reset();for(const map of [glow,petal,mist])map.dispose();particleMaterial.dispose();shieldMaterial?.dispose();destroyed=true;}
    return {emit,tick,reset,cancel,destroy,stats:()=>({groups:effects.length,max:limit,meshes:effects.reduce((n,f)=>n+f.group.children.length,0),particles:effects.reduce((n,f)=>n+f.parts.filter(p=>p.mode==='particles').reduce((s,p)=>s+p.m.geometry.attributes.position.count,0),0),textureBytes:destroyed?0:49152})};
  }
  root.TowerSkillEffects={create,FAMILIES,THEMES,ROBOT_FAMILIES,familyFor,colorsFor};
})(globalThis);
