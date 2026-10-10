/* Original layered spells: filled silhouettes, GPU particles and soft light.
   Uses the existing loop; no lights of its own, bloom, fullscreen flashes or lines.
   Real light comes from the floor's one permanent flash slot (ctx.flash), and heavy
   landings nudge the view (ctx.kick); both are optional and skipped when absent. */
(function(root){'use strict';
  const PALETTES={swordsman:[0xffe5af,0xffa46c],mage:[0xc6b5ff,0x86e4ff],scout:[0xa3ffe0,0x54cda2],chef:[0xffd6a0,0xff9a64],healer:[0xd9ffe4,0x79edba],smith:[0xffdea9,0xffa465],archer:[0xffe6ac,0x99ddb2],robot:[0xbff3ff,0xffbd73],cleric:[0xfff3f0,0xe05a5a]};
  const FAMILIES={arrow:'arrow',binding:'arrow',volley:'arrow',great_arrow:'arrow',decisive:'slash',star_ring:'meteor',escape:'scan',feast:'steam',sanctuary:'heal',fortress:'shield',cleave:'slash',circle:'spin',blind:'slash',stun:'impact',stagger:'impact',splash:'splash',bolt:'cast',weak:'cast',slow:'slash',mark:'cast',shock:'storm',thorns:'thorns',repel:'wave',starfall:'meteor',guard:'shield',barrier:'shield',ward:'shield',fortify:'shield',rally:'aura',speed:'aura',polish:'forge',stealth:'smoke',smoke:'smoke',stomach:'steam',meal:'steam',soup:'heal',heal:'heal',revive:'heal',cleanse:'cleanse',reveal:'scan',disarm:'scan',daylight:'sun',repair:'forge',frost:'frost',taunt:'wave',barricade:'forge'};
  const THEMES={shock:[0xebfaff,0x459fff],thorns:[0xd5f697,0x6aab43],starfall:[0xfff1cc,0xff8242],star_ring:[0xfff1cc,0xea92ff],frost:[0xe1fbff,0x72cdff],splash:[0xffd090,0xfb714a],weak:[0xe4fff2,0x8be8bd],mark:[0xfff0be,0xfa9e62]};
  const ROBOT_FAMILIES=Object.freeze({flying_fist:'rocket_fist',iron_charge:'ram',shoulder_quake:'quake',folded_guard:'shield',joint_oil:'lubricate',parts_restore:'rebuild',steel_meteor_fist:'quake',explosive_fists:'twin_fist',mech_aid:'shield'});
  Object.assign(FAMILIES,{robot_fist:'rocket_fist',robot_charge:'ram',robot_quake:'quake',robot_guard:'shield',robot_speed:'lubricate',robot_restore:'rebuild',robot_meteor:'quake',robot_double:'twin_fist',mech_aid:'shield',levelup:'levelup',critical:'critical',regen:'heal',kami:'shield'});
  const visualFamilies=new Set(Object.values(FAMILIES));
  const familyFor=skill=>ROBOT_FAMILIES[skill?.id]||(visualFamilies.has(skill?.presentation?.family)?skill.presentation.family:FAMILIES[skill?.effect]);
  const colorsFor=skill=>Array.isArray(skill?.presentation?.colors)&&skill.presentation.colors.length===2&&skill.presentation.colors.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffff)?skill.presentation.colors:THEMES[skill?.effect]||PALETTES[skill?.job]||PALETTES.swordsman;
  // A readable onset, held identity and recovery, rather than every layer
  // appearing at full brightness and disappearing together. No added draws.
  const SIGNATURES=Object.freeze({
    swordsman:Object.freeze({name:'刃光與碎金',attack:.045,peak:.2,ground:.17}),
    mage:Object.freeze({name:'元素凝聚與爆發',attack:.1,peak:.3,ground:.21}),
    scout:Object.freeze({name:'翠影與風羽',attack:.035,peak:.17,ground:.1}),
    chef:Object.freeze({name:'暖霧與湯滴',attack:.14,peak:.35,ground:.14}),
    healer:Object.freeze({name:'花瓣與復甦',attack:.18,peak:.48,ground:.17}),
    smith:Object.freeze({name:'熔金與金屬火星',attack:.045,peak:.19,ground:.16}),
    archer:Object.freeze({name:'葉羽與箭芒',attack:.055,peak:.23,ground:.11}),
    robot:Object.freeze({name:'機械壓力與核心脈衝',attack:.065,peak:.22,ground:.18}),
    cleric:Object.freeze({name:'紙垂與破魔箭芒',attack:.06,peak:.24,ground:.12})
  });
  const signatureFor=skill=>SIGNATURES[skill?.job]||SIGNATURES.swordsman;
  // One filled, locally bounded energy surface replaces the old blurred floor
  // square. The curtain and footprint share a single draw, not extra lights.
  const ACCENTS=Object.freeze({physical:0,arcane:1,botanical:2,radiant:3,mechanical:4,vapor:5});
  function accentFor(skill,family){
    if(['steam','smoke','splash'].includes(family))return 'vapor';
    if(['heal','cleanse','sun'].includes(family))return 'radiant';
    if(['thorns','arrow'].includes(family))return 'botanical';
    if(skill.job==='robot'||['forge','rebuild','lubricate'].includes(family))return 'mechanical';
    if(['storm','meteor','frost','cast','charge','shield'].includes(family))return 'arcane';
    return skill.job==='scout'?'botanical':'physical';
  }
  // The ground surface only depends on whether the family is a supportive one and on reduced motion;
  // its vertex data is built once. Each effect still gets its own geometry object (see dispose()).
  const SUPPORT=['heal','cleanse','shield','aura','sun','charge','rebuild','lubricate','thorns'],energyData=new Map();
  function energyArrays(family,reduced){
    const support=SUPPORT.includes(family),key=(reduced?2:0)+(support?1:0);let data=energyData.get(key);if(data)return data;
    const positions=[],uv=[],layers=[];
    function quad(a,b,c,d,layer,u0=0,u1=1){for(const [point,u,v]of [[a,u0,0],[b,u1,0],[c,u0,1],[b,u1,0],[d,u1,1],[c,u0,1]]){positions.push(...point);uv.push(u,v);layers.push(layer);}}
    quad([-1.8,.008,-1.8],[1.8,.008,-1.8],[-1.8,.008,1.8],[1.8,.008,1.8],0);
    if(!reduced){
      const segments=16,radius=support?.95:1.15,height=support?2.1:.72;
      for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        quad([Math.sin(a)*radius,.07,Math.cos(a)*radius],[Math.sin(b)*radius,.07,Math.cos(b)*radius],[Math.sin(a)*radius*1.08,height,Math.cos(a)*radius*1.08],[Math.sin(b)*radius*1.08,height,Math.cos(b)*radius*1.08],1,i/segments,(i+1)/segments);
      }
    }
    data={position:Float32Array.from(positions),uv:Float32Array.from(uv),layer:Float32Array.from(layers),sphere:null};energyData.set(key,data);return data;
  }
  function energyGeometry(T,family,reduced){
    const data=energyArrays(family,reduced),g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(data.position,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));g.setAttribute('energyLayer',new T.Float32BufferAttribute(data.layer,1));
    if(data.sphere)g.boundingSphere=new T.Sphere(new T.Vector3(data.sphere[0],data.sphere[1],data.sphere[2]),data.sphere[3]);else{g.computeBoundingSphere();const {center,radius}=g.boundingSphere;data.sphere=[center.x,center.y,center.z,radius];}
    return g;
  }
  function finishEnergy(material,phase){
    material.name='layered-spell-energy';material.userData.energyPhase=phase;
    material.onBeforeCompile=shader=>{
      shader.uniforms.energyAge=phase.age;shader.uniforms.energyStyle=phase.style;shader.uniforms.energyTint=phase.tint;shader.uniforms.energyQuiet=phase.quiet;
      shader.vertexShader='attribute float energyLayer; varying float vEnergyLayer; varying vec2 vEnergyUV;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEnergyLayer=energyLayer;vEnergyUV=uv;');
      shader.fragmentShader='uniform float energyAge; uniform float energyStyle; uniform float energyQuiet; uniform vec3 energyTint; varying float vEnergyLayer; varying vec2 vEnergyUV;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',[
        'vec2 ep=(vEnergyUV-.5)*2.;float et=clamp(energyAge,0.,1.);float er=length(ep);float ea=atan(ep.y,ep.x);',
        'float swell=.17+.65*smoothstep(0.,.7,et);float lobes=6.;if(energyStyle>1.5&&energyStyle<2.5)lobes=5.;if(energyStyle>3.5&&energyStyle<4.5)lobes=8.;',
        'float petal=.5+.5*cos(ea*lobes-et*1.5);float edge=swell*(.78+.22*petal);',
        'float rim=(er-edge)*8.;float crest=exp(-rim*rim)*(.28+.72*petal);float core=exp(-er*er*12.)*.5;',
        'float field=(crest+core)*(1.-smoothstep(.82,1.,er));',
        'if(energyStyle>.5&&energyStyle<1.5){float mist=.5+.5*sin(ep.x*9.+sin(ep.y*7.-et*3.)+et*2.);field*=.5+.5*mist;}',
        'if(energyStyle>2.5&&energyStyle<3.5)field=mix(field,exp(-er*er*4.)*(.6+.4*petal),.5);',
        'if(energyStyle>4.5)field=exp(-er*er*3.8)*(.65+.35*sin(ep.x*5.+sin(ep.y*5.)-et*2.));',
        'if(vEnergyLayer>.5){float eu=vEnergyUV.x*6.2831853,ey=vEnergyUV.y;float feather=pow(max(0.,sin(eu*lobes+ey*2.5-et*2.)),3.);',
        'float height=.23+.58*feather;field=pow(max(0.,1.-ey/height),1.6)*sin(ey*3.14159265)*1.45;',
        'if(energyStyle>3.5&&energyStyle<4.5){float panel=step(.16,fract(vEnergyUV.x*8.))*step(fract(vEnergyUV.x*8.),.84);field*=panel;}',
        'field*=1.-energyQuiet;}',
        'diffuseColor.rgb=mix(diffuseColor.rgb,energyTint,.3+.5*clamp(field,0.,1.));',
        'diffuseColor.a*=clamp(field*1.65,0.,1.5);'
      ].join('\n'));
    };
    material.customProgramCacheKey=()=> 'tower-energy-surface-v1575';
  }
  // The damage of a falling star is dealt on release, so the rock lands quickly: it falls from 3.5 to rest
  // at .12 within METEOR_FALL seconds, and its light and view kick come at that moment.
  const METEOR_FALL=.32;
  const POOL_CAP=16,IMPACTS_PER_FRAME=3,CRITS_PER_FRAME=2,SPARK_MODES=new Set(['contact','spark','electric']),INK_LIMIT=256;
  const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
  function envelope(t,signature,kind='body'){
    if(kind==='charge')return .2+.65*smooth(t);
    if(kind==='ground')return smooth(t/.12)*(1-smooth((t-.35)/.55));
    if(kind==='spark')return smooth(t/.035)*(1-smooth((t-.2)/.6));
    // A blade arc snaps in and is gone in about a third of a second; sparks and the floor glow linger.
    if(kind==='slash')return smooth(t/.03)*(1-smooth((t-.1)/.28));
    return smooth((t+.018)/signature.attack)*(1-smooth((t-signature.peak)/Math.max(.15,.95-signature.peak)));
  }
  const PARTICLE_VERTEX=[
    'attribute vec3 velocity; attribute float seed; attribute float pointSize; attribute float tone;',
    'uniform float age; uniform float duration; uniform float travel; uniform float flow; uniform vec3 tintA; uniform vec3 tintB;',
    'varying vec3 tint; varying float fade; varying float spin; varying float motionFlow;',
    'void main(){float t=clamp(age/duration,0.,1.);vec3 p=position;',
    'if(flow<.5){p+=velocity*t*travel;p.y-=t*t*.5*travel;}',
    'else if(flow<1.5){float a=t*3.5*travel+seed*2.;p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;p.y+=t*1.7*travel;}',
    'else if(flow<2.5){p.xz*=1.-t*.85;p.y+=sin(t*3.14159)*.8*travel;}',
    'else{p+=velocity*t*.3*travel;p.y+=t*1.2*travel;}',
    'vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;',
    'gl_PointSize=clamp(pointSize*260./max(1.,-v.z),1.,42.);',
    'tint=mix(tintA,tintB,tone);spin=seed*6.2831853+t*1.4;motionFlow=flow;fade=smoothstep(0.,.09,t+.035)*(1.-smoothstep(.48,1.,t));}'
  ].join('\n');
  const PARTICLE_FRAGMENT=[
    'varying vec3 tint;varying float fade;varying float spin;varying float motionFlow;uniform float shape;',
    'void main(){vec2 p=(gl_PointCoord-.5)*2.;p=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p;float d=length(p);float petal=abs(p.x)*1.3+abs(p.y)*.75;',
    'float edge=pow(max(0.,1.-mix(d,petal,shape)),1.65);',
    'float flare=exp(-abs(p.x)*18.-abs(p.y)*2.3)+exp(-abs(p.y)*22.-abs(p.x)*4.);',
    'edge=mix(edge,edge*.6+flare*.33,(1.-shape)*(1.-step(2.5,motionFlow)));',
    'float core=pow(max(0.,1.-d*2.8),2.);float alpha=edge*fade;if(alpha<.012)discard;',
    'gl_FragColor=vec4(mix(tint,vec3(1.),core*.85),alpha);}'
  ].join('\n');
  // One cloud's vertex data depends only on reduced motion, its flow mode and leaf shape. Colour is not
  // baked in: `tone` picks one of the two uniform tints, so a single table serves every palette.
  const cloudData=new Map();
  function cloudArrays(reduced,flow,leaf){
    const key=(reduced?4:0)+(leaf?2:0)+flow*8;let data=cloudData.get(key);if(data)return data;
    const n=reduced?12:48,positions=[],velocities=[],seeds=[],sizes=[],tones=[];
    for(let i=0;i<n;i++){const seed=(i*.61803398875)%1,a=i*2.39996,r=.15+(i%7)/9;positions.push(Math.sin(a)*r,flow===0?.75+seed*.45:.18+seed*1.25,Math.cos(a)*r);velocities.push(Math.sin(a)*(1.1+seed*1.4),.3+seed*2,Math.cos(a)*(1.1+seed*1.4));seeds.push(seed);sizes.push((leaf?.19:.1)+seed*.13);tones.push(i%2);}
    data=[['position',Float32Array.from(positions),3],['velocity',Float32Array.from(velocities),3],['seed',Float32Array.from(seeds),1],['pointSize',Float32Array.from(sizes),1],['tone',Float32Array.from(tones),1]];cloudData.set(key,data);return data;
  }
  function create(T,ctx){
    let effects=[],destroyed=false,impacts=0,crits=0;const inks=new Map(),templates=new Map();
    // Silhouettes are fixed by their key. Triangulating and tessellating them once is enough: each effect
    // receives its own geometry object holding a private copy of the arrays.
    function shape(key,make){
      let template=templates.get(key);if(!template)templates.set(key,template=make());
      const g=new T.BufferGeometry().copy(template);g.type=template.type;g.userData={shapeKey:key};return g;
    }
    const limit=Math.max(1,Math.min(12,Math.floor(Number(ctx.limit)||12))),reduced=!!ctx.reducedMotion;
    // Three manager-owned, original 64px textures: 48 KiB, reused across floors.
    function texture(kind){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,d=Math.sqrt(dx*dx*(kind==='petal'?2:1)+dy*dy),noise=.86+.14*Math.sin(x*.51+Math.cos(y*.4))*Math.sin(y*.37);
      const base=Math.pow(Math.max(0,1-d),kind==='mist'?1.05:1.8),core=Math.exp(-(dx*dx+dy*dy)*46),rays=Math.exp(-Math.abs(dx)*27-Math.abs(dy)*4)+Math.exp(-Math.abs(dy)*29-Math.abs(dx)*5);
      const a=Math.min(1,kind==='glow'?base*.55+core*.45+rays*.12:base*(kind==='mist'?noise:1)),i=(y*size+x)*4;
      data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*255);
    }const map=new T.DataTexture(data,size,size,T.RGBAFormat);map.needsUpdate=true;map.magFilter=map.minFilter=T.LinearFilter;return map;}
    const glow=texture('glow'),petal=texture('petal'),mist=texture('mist');
    // Owned by this manager until destroy(); the floor teardown skips flagged resources.
    for(const map of [glow,petal,mist])map.userData.sharedResource=true;
    // Keep the two GPU programs warm between casts. Each draw supplies its own
    // phase/tint; resetting a floor disposes effect geometry, not shared shaders.
    const particleMaterial=new T.ShaderMaterial({uniforms:{age:{value:0},duration:{value:1},travel:{value:reduced?.25:1},flow:{value:0},shape:{value:0},tintA:{value:new T.Color()},tintB:{value:new T.Color()}},vertexShader:PARTICLE_VERTEX,fragmentShader:PARTICLE_FRAGMENT,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});particleMaterial.userData.sharedResource=true;
    let shieldMaterial=null;
    // Recycled materials. One effect at a time leases a material (its colour and opacity are that effect's) and
    // gives it back when it ends instead of disposing it, so the GPU programs of the casts stay linked between
    // fights. Members are manager-owned (sharedResource): neither an effect's end, reset() nor a floor teardown
    // through disposeSceneObject touches them; destroy() disposes each exactly once. At most POOL_CAP members per
    // shader variant exist; past that an effect gets a private material that it disposes itself, as before.
    const pool=new Map(),members=new Map(),leased=new Set();
    function lease(variant,make){
      let slot=pool.get(variant);if(!slot)pool.set(variant,slot={free:[],made:0});
      let m=slot.free.pop();
      if(!m){m=make();if(slot.made<POOL_CAP){slot.made++;m.userData.sharedResource=true;members.set(m,variant);}}
      if(members.has(m))leased.add(m);
      return m;
    }
    function giveBack(m){const variant=members.get(m);if(variant===undefined)return false;if(leased.delete(m))pool.get(variant).free.push(m);return true;}
    function dispose(f){if(!f)return;f.group.parent?.remove(f.group);const geometries=new Set();f.group.traverse(o=>{if((o.isMesh||o.isPoints)&&o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());f.mats.forEach(m=>{if(!giveBack(m))m.dispose();});}
    function emit(skill,at,angle=0,options={}){
      if(destroyed||!at||!skill||!familyFor(skill)||ctx.visible&&!ctx.visible(at))return null;
      // A sweep that hits a whole pack in one frame shows the first few contacts; the damage itself
      // was already applied by the caller, so dropping the rest changes only what is drawn.
      if(options.impact&&impacts++>=IMPACTS_PER_FRAME)return null;
      // A sweep that crits on a whole pack still shows only the first two bursts in one frame.
      if(familyFor(skill)==='critical'&&crits++>=CRITS_PER_FRAME)return null;
      if(effects.length>=limit)dispose(effects.shift());
      const baseFamily=familyFor(skill),family=options.impact?(skill.job==='robot'?'mechanical_hit':['storm','thorns'].includes(baseFamily)?baseFamily:'hit'):options.stage==='charge'?'charge':options.stage==='land'?(skill.job==='robot'?'quake':baseFamily==='meteor'?'meteor':'burst'):baseFamily;
      const colors=colorsFor(skill),signature=signatureFor(skill),group=new T.Group();group.name='skill-vfx-'+skill.id;group.userData.signature=signature.name;group.position.set(at.x,.04,at.z);group.rotation.y=angle;
      const total=family==='critical'?(reduced?.4:.55):family==='levelup'?(reduced?1.2:1.8):family==='thorns'&&options.impact?3:family==='storm'?.92:family==='hit'?.42:family==='charge'||family==='meteor'?Math.min(4,Math.max(.1,Number(options.duration)||.85)):reduced?.65:['heal','shield','sun'].includes(family)?1.6:1.15;
      const parts=[],mats=[],count=reduced?2:4,power=skill.unique?1.18:1;
      // Surfaces with identical settings inside one effect share a single material, leased from the pool by shader
      // variant. Colour, opacity and envelope are set at lease time, and nothing mutates the material afterwards.
      const owned=new Map();
      // A critical burst draws over the attacker's own body (the camera usually sits behind them); its floor light keeps
      // normal depth. It leases from its own pool variant, so no shared material ever changes its depth test.
      const overlay=family==='critical';
      function material(color,opacity=.8,map=null,sprite=false,{vertexColors=false,blending=T.AdditiveBlending,spark=false,ground=false,slash=false}={}){
        const above=overlay&&!ground,key=[color,opacity,map?map.uuid:'',sprite,vertexColors,blending,spark,ground,slash,above].join();let m=owned.get(key);if(m)return m;
        m=lease(ground?'ground':[sprite?'sprite':'mesh',map?map.uuid:'',vertexColors,blending,above?'above':''].join(),()=>{
          const opts={color,transparent:true,opacity,depthWrite:false,...(above?{depthTest:false}:{}),blending,toneMapped:false,...(map?{map}:{}),...(vertexColors?{vertexColors:true}:{}),...(!sprite?{side:T.DoubleSide,forceSinglePass:true}:{})},made=sprite?new T.SpriteMaterial(opts):new T.MeshBasicMaterial(opts);
          if(ground)finishEnergy(made,{age:{value:0},style:{value:0},tint:{value:new T.Color()},quiet:{value:reduced?1:0}});
          return made;
        });
        m.color.setHex(color);m.opacity=opacity;m.userData.baseOpacity=opacity;m.userData.envelope=ground?'ground':spark?'spark':slash?'slash':undefined;mats.push(m);owned.set(key,m);return m;
      }
      function soft(x,y,z,size,tint=0,mode='rise',leaf=false,map=leaf?petal:glow,opacity=.85){const m=new T.Sprite(material(colors[tint],opacity,map,true,{spark:SPARK_MODES.has(mode)}));m.position.set(x,y,z);m.scale.set(size,leaf?size*1.4:size,1);group.add(m);parts.push({m,base:m.position.clone(),scale:m.scale.clone(),mode});return m;}
      function solid(geometry,x,y,z,tint=0,mode='rise',opacity=.65,{material:custom=null,blending=T.AdditiveBlending}={}){
        // A cool/warm body, bright crest and shaded facets read as a volume,
        // rather than a uniformly painted silhouette. Authored once per cast.
        if(!custom&&!geometry.attributes.color){
          const memo=geometry.userData.shapeKey?geometry.userData.shapeKey+'|'+tint+'|'+colors[0]+'|'+colors[1]:'',cached=memo&&inks.get(memo);
          if(cached)geometry.setAttribute('color',new T.Float32BufferAttribute(cached,3));
          else{
            const pos=geometry.attributes.position,normals=geometry.attributes.normal,ink=new Float32Array(pos.count*3),low=new T.Color(colors[1-tint]),high=new T.Color(colors[tint]);let min=Infinity,max=-Infinity;
            for(let i=0;i<pos.count;i++){min=Math.min(min,pos.getY(i));max=Math.max(max,pos.getY(i));}
            for(let i=0;i<pos.count;i++){const height=(pos.getY(i)-min)/Math.max(.001,max-min),crest=Math.pow(height,3)*.32,shade=.72+.28*Math.abs(normals?.getZ(i)||0),blend=.2+.7*height;
              for(let k=0;k<3;k++){const key=['r','g','b'][k],tone=(low[key]+(high[key]-low[key])*blend)*shade;ink[i*3+k]=tone+(1-tone)*crest;}
            }
            geometry.setAttribute('color',new T.Float32BufferAttribute(ink,3));
            if(memo){if(inks.size>=INK_LIMIT)inks.delete(inks.keys().next().value);inks.set(memo,ink);}
          }
        }
        const m=new T.Mesh(geometry,custom||material(0xffffff,opacity,null,false,{vertexColors:true,blending,spark:SPARK_MODES.has(mode),slash:mode==='sweep'||mode==='whirl'}));m.position.set(x,y,z);group.add(m);parts.push({m,base:m.position.clone(),scale:m.scale.clone(),mode});return m;
      }
      function particles(flow=0,leaf=false){
        const geometry=new T.BufferGeometry();for(const [key,data,size]of cloudArrays(reduced,flow,leaf))geometry.setAttribute(key,new T.Float32BufferAttribute(data,size));geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1,0),6);
        const cloud=new T.Points(geometry,particleMaterial);cloud.name='batched-spell-particles';cloud.userData.phase={age:0,duration:total,flow,shape:leaf?1:0,tintA:new T.Color(colors[0]),tintB:new T.Color(colors[1])};
        cloud.onBeforeRender=()=>{const u=particleMaterial.uniforms,p=cloud.userData.phase;for(const key of ['age','duration','flow','shape'])u[key].value=p[key];u.tintA.value.copy(p.tintA);u.tintB.value.copy(p.tintB);particleMaterial.uniformsNeedUpdate=true;};
        group.add(cloud);parts.push({m:cloud,mode:'particles'});return cloud;
      }
      // An afterimage, not a solid moon: the leading tip (-x, the side the arc turns towards) stays bright
      // and the trailing tip fades away. Alpha rides in a fourth colour channel of this effect's own copy.
      function trail(mesh){
        const g=mesh.geometry,c=g.attributes.color,pos=g.attributes.position;if(!c||c.itemSize!==3)return;
        let min=Infinity,max=-Infinity;for(let v=0;v<pos.count;v++){min=Math.min(min,pos.getX(v));max=Math.max(max,pos.getX(v));}
        const rgba=new Float32Array(c.count*4);for(let v=0;v<c.count;v++){const along=(pos.getX(v)-min)/Math.max(.001,max-min);rgba[v*4]=c.getX(v);rgba[v*4+1]=c.getY(v);rgba[v*4+2]=c.getZ(v);rgba[v*4+3]=.3+.7*Math.pow(1-along,1.2);}
        g.setAttribute('color',new T.Float32BufferAttribute(rgba,4));
      }
      const accent=accentFor(skill,family),ground=new T.Mesh(energyGeometry(T,family,reduced),material(colors[1],signature.ground,glow,false,{ground:true}));ground.name='spell-contact-light';group.add(ground);
      ground.userData.accent=accent;
      const energyPhase=ground.material.userData.energyPhase;energyPhase.age.value=0;energyPhase.style.value=ACCENTS[accent];energyPhase.tint.value.setHex(colors[0]);energyPhase.quiet.value=reduced?1:0;
      parts.push({m:ground,base:ground.position.clone(),scale:ground.scale.clone(),mode:'energy',phase:energyPhase});
      if(['rocket_fist','twin_fist'].includes(family)){
        // A filled, forward-facing fist silhouette, not a generic magic orb.
        const n=family==='twin_fist'&&!reduced?2:1,steel=lease('steel',()=>new T.MeshPhongMaterial({color:0xffffff,vertexColors:true,emissive:0x0f2630,emissiveIntensity:.4,specular:0xe2f1fa,shininess:70,transparent:true,opacity:.96,depthWrite:false,blending:T.NormalBlending,toneMapped:false}));steel.opacity=.96;steel.userData.baseOpacity=.96;mats.push(steel);
        for(let i=0;i<n;i++){
          const s=new T.Shape();s.moveTo(-.26,-.18);s.lineTo(.17,-.18);s.quadraticCurveTo(.32,-.12,.32,.045);s.quadraticCurveTo(.29,.12,.19,.13);s.lineTo(.19,.25);s.quadraticCurveTo(.13,.37,.05,.29);s.lineTo(.045,.235);s.quadraticCurveTo(-.025,.36,-.1,.28);s.lineTo(-.105,.215);s.quadraticCurveTo(-.18,.32,-.27,.23);s.lineTo(-.27,-.1);s.closePath();
          const geometry=new T.ExtrudeGeometry(s,{depth:.22,bevelEnabled:true,bevelThickness:.025,bevelSize:.02,bevelSegments:1,steps:1}),normals=geometry.attributes.normal,tints=[];
          // Raised gold bevels and shaded steel thickness retain a real fist
          // silhouette even in bright rooms; existing scene lights do the work.
          for(let v=0;v<normals.count;v++){const facing=Math.abs(normals.getZ(v)),color=new T.Color(facing>.95?colors[0]:facing>.15?colors[1]:0x456373);tints.push(color.r,color.g,color.b);}
          geometry.setAttribute('color',new T.Float32BufferAttribute(tints,3));
          const fist=solid(geometry,i?.37:-.37,1.12,.28+i*.17,0,'flight',.96,{material:steel});
          fist.name='robot-propelled-fist';fist.scale.setScalar(skill.unique?1.45:1);fist.rotation.y=i?-.18:.18;
          soft(i?.37:-.37,1.10,.12+i*.17,.78,1,'flight',false,glow,.45);
        }
      }else if(family==='ram'){
        soft(0,.82,.7,2.05,0,'breathe');
        for(let i=0;i<(reduced?1:3);i++){const plate=solid(shape('ram-plate',()=>{const s=new T.Shape();s.moveTo(-.66,0);s.quadraticCurveTo(0,.4,.66,0);s.lineTo(.56,-.11);s.quadraticCurveTo(0,.17,-.56,-.11);s.closePath();return new T.ShapeGeometry(s);}),0,.6+i*.24,.44+i*.21,i%2,'flight',.65);plate.name='robot-charge-pressure-front';}
      }else if(['quake','mechanical_hit'].includes(family)){
        const impact=soft(0,family==='quake'?.2:1.03,0,skill.unique?3.0:2.2,0,'pop');impact.name='robot-impact-core';
        // Debris and filled pressure fans use the same bounded particle program.
        for(let i=0;i<(reduced?2:4);i++){const a=i*Math.PI*2/4,shard=solid(shape(family==='quake'?'dodeca-.17':'dodeca-.11',()=>new T.DodecahedronGeometry(family==='quake'?.17:.11,0)),Math.sin(a)*.33,family==='quake'?.24:1.03,Math.cos(a)*.33,i%2,'contact',.9);shard.name='robot-armor-impact-shard';shard.scale.y=family==='quake'?.7:1.6;}
      }else if(['rebuild','lubricate'].includes(family)){
        soft(0,.85,0,1.55,0,'breathe');
        if(family==='rebuild'){const cog=solid(shape('cog',()=>{const s=new T.Shape();for(let i=0;i<32;i++){const a=i*Math.PI*2/32,r=i%4<2?.36:.29,x=Math.sin(a)*r,y=Math.cos(a)*r;if(i)s.lineTo(x,y);else s.moveTo(x,y);}s.closePath();return new T.ShapeGeometry(s);}),0,1.20,.28,1,'orbit',.8);cog.name='robot-repair-cog';}
        else {const oil=solid(shape('oil',()=>{const s=new T.Shape();s.moveTo(0,.43);s.bezierCurveTo(-.13,.16,-.34,-.08,-.18,-.25);s.quadraticCurveTo(0,-.4,.18,-.25);s.bezierCurveTo(.34,-.08,.13,.16,0,.43);s.closePath();return new T.ShapeGeometry(s);}),0,1.24,.3,1,'rise',.85);oil.name='robot-lubricant-drop';}
        for(let i=0;i<(reduced?1:3);i++){const a=i*Math.PI*2/3;soft(Math.sin(a)*.47,.36+i*.24,Math.cos(a)*.47,.38,0,'orbit');}
      }else if(family==='storm'){
        soft(0,1.05,0,2.2,1,'breathe');
        for(let i=0;i<(reduced?2:3);i++){const bolt=solid(shape('bolt',()=>{const s=new T.Shape();s.moveTo(0,0);s.lineTo(.48,.75);s.lineTo(.13,.7);s.lineTo(.68,1.48);s.lineTo(.3,1.4);s.lineTo(.75,2.4);s.lineTo(.07,1.5);s.lineTo(.35,1.55);s.lineTo(-.14,.65);s.lineTo(.16,.68);s.closePath();return new T.ShapeGeometry(s);}),Math.sin(i*2.1)*.66,.15,Math.cos(i*2.1)*.66,i%2,'electric',.95);bolt.rotation.y=i*2.1;bolt.rotation.z=(i-1)*.6;}
        for(let i=0;i<(reduced?1:2);i++)soft(i?-.8:.8,1.1,0,.7,0,'contact');
      }else if(family==='thorns'){
        for(let i=0;i<(reduced?1:2);i++){const a=i*Math.PI,vine=solid(shape('vine-'+i,()=>{const points=Array.from({length:10},(_,n)=>{const p=a+n*.65,r=.8-n*.045;return new T.Vector3(Math.sin(p)*r,n*.21,Math.cos(p)*r);});return new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.1,5,false);}),0,0,0,1,'grow',.95,{blending:T.NormalBlending});
          const thorn=solid(shape('thorn',()=>new T.ConeGeometry(.22,.85,5)),Math.sin(a+.7)*.68,.9,Math.cos(a+.7)*.68,0,'grow',.95);thorn.rotation.z=Math.cos(a)*.65;thorn.rotation.x=Math.sin(a)*.65;}
        soft(0,.28,0,2,1,'breathe');
      }else if(family==='splash'){
        const splash=soft(0,.7,.65,1.8,1,'splat');splash.scale.y=.85;
        for(let i=0;i<count;i++){const drop=solid(shape('drop',()=>new T.SphereGeometry(.15,6,4)),Math.sin(i*1.7)*.7,.65+Math.cos(i)*.2,.8+i*.09,i%2,'contact',.8);drop.scale.y=1.4;}
      }else if(['slash','spin'].includes(family)){
        for(let i=0;i<2;i++){const sweep=solid(shape('sweep',()=>{const shape=new T.Shape();shape.moveTo(-1.3,0);shape.quadraticCurveTo(.2,1.7,1.4,.1);shape.quadraticCurveTo(.35,.6,-1.3,0);return new T.ShapeGeometry(shape,16);}),0,family==='spin'?.85:1,family==='spin'?0:.5+i*.08,1-i,family==='spin'?'whirl':'sweep',i?.45:1);
          trail(sweep);sweep.rotation.x=family==='spin'?Math.PI/2:-.6;sweep.rotation.y=family==='spin'?i*Math.PI:0;sweep.rotation.z=family==='spin'?0:i*.18;}
        for(let i=0;i<count;i++)soft(Math.sin(i*1.6)*.7,.8+i*.09,.6+Math.cos(i)*.5,.45,i%2,'spark');
      }else if(family==='shield'){
        if(!shieldMaterial)shieldMaterial=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color()},opacity:{value:1},age:{value:0}},vertexShader:'varying vec3 n;varying vec3 eye;varying vec2 surfaceUV;void main(){vec4 v=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-v.xyz);surfaceUV=uv;gl_Position=projectionMatrix*v;}',fragmentShader:'varying vec3 n;varying vec3 eye;varying vec2 surfaceUV;uniform vec3 tint;uniform float opacity;uniform float age;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.4);vec2 cell=surfaceUV*vec2(12.,7.);cell.x+=mod(floor(cell.y),2.)*.5;vec2 facet=abs(fract(cell)-.5);float plate=(1.-smoothstep(.32,.47,max(facet.x*.86+facet.y*.5,facet.y)))*.065;float shimmer=.72+.28*sin(surfaceUV.y*9.-age*3.);gl_FragColor=vec4(mix(tint,vec3(1.),rim*.6),(.025+rim*.4+plate*shimmer)*opacity);}',side:T.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});shieldMaterial.userData.sharedResource=true;
        const dome=solid(shape('dome',()=>new T.SphereGeometry(1.13,16,9,0,Math.PI*2,0,Math.PI*.62)),0,.42,0,1,'breathe',.18,{material:shieldMaterial});dome.userData.filledShield=true;dome.userData.tint=new T.Color(colors[1]);dome.userData.opacity=1;dome.userData.age=0;dome.onBeforeRender=()=>{shieldMaterial.uniforms.tint.value.copy(dome.userData.tint);shieldMaterial.uniforms.opacity.value=dome.userData.opacity;shieldMaterial.uniforms.age.value=dome.userData.age;shieldMaterial.uniformsNeedUpdate=true;};
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;const crystal=solid(shape('crystal',()=>new T.OctahedronGeometry(.14)),Math.sin(a)*.95,.35+i*.21,Math.cos(a)*.95,i%2,'orbit',.65);crystal.scale.y=1.5;}
      }else if(family==='meteor'){
        const n=reduced?1:skill.effect==='star_ring'?3:1;for(let i=0;i<n;i++){const a=i*Math.PI*2/3,x=Math.sin(a)*.8,z=Math.cos(a)*.8;const rock=solid(shape('rock',()=>new T.DodecahedronGeometry(.37,0)),x,3.5,z,1,'fall',.95,{blending:T.NormalBlending});rock.rotation.set(.2,i,1);const flame=soft(x,4,z,1.35,1,'fall');flame.scale.y=2.7;}
      }else if(family==='charge'){
        soft(0,1.1,0,1.8,0,'breathe');for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*1.1,.2+i*.16,Math.cos(a)*1.1,.6,i%2,'gather');}
      }else if(family==='frost'){
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count,shard=solid(shape('icicle',()=>new T.ConeGeometry(.24,.9,5)),Math.sin(a)*1.05,.34,Math.cos(a)*1.05,i%2,'grow',.8);shard.rotation.z=Math.sin(a)*.2;}soft(0,.4,0,2.3,1,'breathe');
      }else if(['smoke','steam'].includes(family)){
        for(let i=0;i<count;i++){const a=i*2.4;soft(Math.sin(a)*.65,.25+i*.13,Math.cos(a)*.65,1.55,1,'mist',false,mist,family==='steam'?.46:.85);}
        if(family==='steam'){const steam=group.children.filter(o=>o.isSprite);for(let i=0;i<steam.length;i++)steam[i].name='culinary-warmth-'+i;}
      }else if(family==='arrow'){
        soft(0,1.08,.6,1.1,0,'breathe');const n=reduced?1:skill.effect==='volley'?3:2;
        for(let i=0;i<n;i++){const arrow=solid(shape('arrow',()=>{const s=new T.Shape();s.moveTo(0,1.35);s.lineTo(.13,.85);s.lineTo(.045,.92);s.lineTo(.04,0);s.lineTo(.13,-.2);s.lineTo(0,-.12);s.lineTo(-.13,-.2);s.lineTo(-.04,0);s.lineTo(-.045,.92);s.lineTo(-.13,.85);s.closePath();return new T.ShapeGeometry(s);}),.24*(i-(n-1)/2),1.12,.2,i%2,'flight',.9);arrow.rotation.x=Math.PI/2;arrow.rotation.z=(i-(n-1)/2)*-.2;arrow.scale.setScalar(skill.unique?1.4:1);}
      }else if(family==='cast'){
        soft(0,1.12,.6,1.15,0,'breathe');
        const core=solid(shape('seed',()=>new T.IcosahedronGeometry(.19,1)),0,1.12,.62,1,'flight',.9,{blending:T.NormalBlending});core.name=skill.job==='healer'?'purifying-light-seed':skill.job==='smith'?'weak-point-rivet':'arcane-condensed-core';
        if(skill.job==='smith'){core.scale.set(.5,.5,1.65);}else core.scale.set(1,1,1.4);
        for(let i=0;i<(reduced?1:3);i++)soft(Math.sin(i*1.9)*.28,.95+i*.07,.4+i*.16,.4,i%2,'spark');
      }else if(family==='levelup'){
        // Level up: a golden column of light rises out of a spreading ground ring,
        // two halos climb the body, a star flares overhead and sparks stream up.
        // The column is wide and faint so the hero stays clearly visible inside it.
        const pillar=solid(shape('levelup-pillar',()=>new T.CylinderGeometry(.62,.78,2.6,24,1,true)),0,1.3,0,1,'ascend',.16);pillar.name='level-up-light-pillar';
        const ring=solid(shape('levelup-ring',()=>new T.TorusGeometry(.85,.05,6,40)),0,.05,0,0,'sweep',.75);ring.rotation.x=Math.PI/2;ring.name='level-up-ground-ring';
        for(let i=0;i<2;i++){const halo=solid(shape('levelup-halo',()=>new T.TorusGeometry(.7,.028,6,36)),0,.2+i*.45,0,i%2,'climb',.6);halo.rotation.x=Math.PI/2;halo.name='level-up-rising-halo';}
        soft(0,.08,0,2,1,'pop',false,glow,.55);const star=soft(0,2.5,0,1.1,0,'flare');star.name='level-up-crest-star';
        for(let i=0;i<(reduced?2:7);i++){const a=i*Math.PI*2/7;const spark=soft(Math.sin(a)*.62,.25+(i%3)*.3,Math.cos(a)*.62,.3,i%2,'stream');spark.name='level-up-rising-spark';}
      }else if(family==='critical'){
        // A critical hit reads without any text: a white-gold star snaps open on the contact point,
        // light rays shoot outward and a ring flicks wide around it, all facing the attacker.
        const core=soft(0,1.05,0,1.15,0,'crit');core.name='critical-core-flash';
        const star=solid(shape('crit-star',()=>{const s=new T.Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.12:.62,x=Math.sin(a)*r,y=Math.cos(a)*r;if(i)s.lineTo(x,y);else s.moveTo(x,y);}s.closePath();return new T.ShapeGeometry(s);}),0,1.05,.12,0,'crit',.95);star.name='critical-star-burst';
        const ring=solid(shape('crit-ring',()=>new T.TorusGeometry(.4,.03,6,40)),0,1.05,.1,1,'snap',.85);ring.name='critical-shock-ring';
        const rays=reduced?3:6;for(let i=0;i<rays;i++){const a=i*Math.PI*2/rays+.26,ray=solid(shape('crit-ray',()=>{const s=new T.Shape();s.moveTo(0,0);s.lineTo(.04,.24);s.lineTo(0,.6);s.lineTo(-.04,.24);s.closePath();return new T.ShapeGeometry(s);}),Math.sin(a)*.16,1.05+Math.cos(a)*.16,.1,i%2,'ray',.9);ray.rotation.z=-a;ray.name='critical-light-ray';}
      }else if(['hit','burst','impact','forge'].includes(family)){
        soft(0,1.05,0,family==='burst'?2.4:1.7,0,'pop');
        const bladeHit=family==='hit'&&['blade','daggers'].includes(options.weapon);
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;
          const fragment=bladeHit?shape('crescent',()=>{const crescent=new T.Shape();crescent.moveTo(-.44,0);crescent.quadraticCurveTo(0,.42,.44,.02);crescent.quadraticCurveTo(0,.15,-.44,0);return new T.ShapeGeometry(crescent,10);}):shape(family==='forge'?'spark-.085':'spark-.12',()=>new T.OctahedronGeometry(family==='forge'?.085:.12));
          const shard=solid(fragment,Math.sin(a)*.25,.95+Math.cos(a)*.2,Math.cos(a)*.25,i%2,'contact',.8);shard.scale.y=bladeHit?1:1.7;shard.rotation.z=bladeHit?a:0;shard.name=bladeHit?'blade-contact-fragment':'impact-metal-spark';}
      }else if(['heal','cleanse'].includes(family)){
        soft(0,1.22,0,2.1,1,'breathe');const blessing=solid(shape('blessing',()=>{const s=new T.Shape();s.moveTo(-.12,.46);s.lineTo(.12,.46);s.lineTo(.12,.12);s.lineTo(.46,.12);s.lineTo(.46,-.12);s.lineTo(.12,-.12);s.lineTo(.12,-.46);s.lineTo(-.12,-.46);s.lineTo(-.12,-.12);s.lineTo(-.46,-.12);s.lineTo(-.46,.12);s.lineTo(-.12,.12);s.closePath();return new T.ShapeGeometry(s);}),0,1.65,.16,1,'rise',.82,{blending:T.NormalBlending});blessing.name='restorative-blessing';
        for(let i=0;i<(reduced?1:3);i++){const a=i*Math.PI*2/3;const petal=soft(Math.sin(a)*.78,.2+i*.25,Math.cos(a)*.78,.55,i%2,family==='cleanse'?'purify':'orbit',true);petal.name=family==='cleanse'?'cleansing-dispersal-petal':'restorative-rising-petal';}
      }else{
        soft(0,['sun','heal','cleanse'].includes(family)?1.65:.6,0,family==='sun'?2.2:1.6,0,'breathe');
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*.78,.15+i*.25,Math.cos(a)*.78,.6,i%2,['scan','wave'].includes(family)?'spark':'orbit',['heal','aura','cleanse'].includes(family));}
      }
      particles(family==='charge'?2:['shield','heal','aura','cleanse','thorns','sun','rebuild','lubricate','levelup'].includes(family)?1:['steam','smoke'].includes(family)?3:0,['heal','aura','thorns','arrow'].includes(family));
      // Preserve authored squash/stretch set by each silhouette builder. The
      // animation multiplies this final shape, not its pre-decoration scale.
      for(const part of parts)if(part.scale)part.scale.copy(part.m.scale);
      group.scale.setScalar(power);ctx.world().add(group);
      // Real coloured light on the floor, walls and actors, strongest where something lands.
      const heavy=!options.defeat&&(options.stage==='land'||family==='quake'&&!options.impact),support=SUPPORT.includes(family)||['cleanse','steam','smoke'].includes(family);
      const lightPower=(family==='critical'?4.2:family==='levelup'?3.4:options.defeat?3:options.impact?(skill.unique?3.4:2.4):heavy?6:family==='charge'?0:support?2:3.2)*(reduced?.6:1);
      const kick=!reduced&&(heavy||family==='critical'||skill.unique&&skill.attack&&!options.impact&&family!=='charge');
      const cue=()=>{if(lightPower>0)ctx.flash?.({x:at.x,y:options.impact||options.defeat||family==='critical'?1.15:1.4,z:at.z},colors[1],lightPower,family==='critical'?.3:family==='levelup'?.9:options.defeat?.38:options.impact?.2:heavy?.55:support?.75:.34);if(kick)ctx.kick?.(heavy?.14:family==='critical'?.05:.08,heavy?.3:family==='critical'?.14:.22);};
      // A falling star lights the room and shakes the view when it reaches the floor, not while it is still high up.
      const landsAt=family==='meteor'?Math.min(total,METEOR_FALL):0;
      const f={group,total,left:total,parts,mats,family,signature,at:{x:at.x,z:at.z},skill:skill.id,cue:landsAt>0?{left:landsAt,fire:cue}:null};if(!f.cue)cue();
      effects.push(f);return f;
    }
    function tick(dt){impacts=0;crits=0;if(!Number.isFinite(dt)||dt<0)return;for(let i=effects.length-1;i>=0;i--){const f=effects[i];f.left-=dt;if(f.cue){f.cue.left-=dt;if(f.cue.left<=0){const fire=f.cue.fire;f.cue=null;fire();}}if(f.left<=0){dispose(f);effects.splice(i,1);continue;}if(ctx.visible)f.group.visible=ctx.visible(f.at);
      const t=1-f.left/f.total,fade=envelope(t,f.signature),travel=reduced?.25:1;for(const m of f.mats)if(m.userData.baseOpacity!==undefined)m.opacity=m.userData.baseOpacity*envelope(t,f.signature,m.userData.envelope||(f.family==='charge'?'charge':'body'));
      for(const p of f.parts){const{m,base,mode,scale}=p;if(mode==='particles'){m.userData.phase.age=f.total-f.left;continue;}if(mode==='energy'){p.phase.age.value=t;continue;}if(m.userData.filledShield){m.userData.opacity=fade;m.userData.age=t;}let size=1;
        if(mode==='rise')m.position.y=base.y+t*.85*travel;
        // Level up: the column grows up from the floor, halos climb, the star flares, sparks stream to the crest.
        if(mode==='ascend'){const grow=smooth(Math.min(1,t/.22));m.scale.set(scale.x*(.7+.3*grow),scale.y*(.15+.85*grow),scale.z*(.7+.3*grow));m.position.y=base.y*(.15+.85*grow);continue;}
        if(mode==='climb'){m.position.y=base.y+t*1.9*travel;size=1-t*.35;}
        // Critical: the star and core snap to full size almost at once, then shrink away; rays fly out; the ring flicks wide.
        if(mode==='crit')size=t<.16?.3+.95*smooth(t/.16):1.25-.95*smooth((t-.16)/.84);
        if(mode==='ray'){const out=1+t*4.5*travel;m.position.x=base.x*out;m.position.y=1.05+(base.y-1.05)*out;size=1-t*.7;}
        if(mode==='snap')size=.4+1.6*smooth(Math.min(1,t/.5));
        if(mode==='flare'){const on=smooth(Math.max(0,Math.min(1,(t-.18)/.12)));size=.001+on*(1.3-.4*smooth(Math.max(0,(t-.3)/.5)));}
        if(mode==='stream'){m.position.y=base.y+t*2.3*travel;m.position.x=base.x*(1-.6*t);m.position.z=base.z*(1-.6*t);size=1-t*.5;}
        if(mode==='fall'){m.position.y=Math.max(.12,base.y-(f.total-f.left)/METEOR_FALL*(base.y-.12));m.rotation.z+=dt*1.2*travel;}
        if(mode==='flight'){m.position.z=base.z+t*2.8*travel;size=1-t*.3;}
        if(mode==='spark'||mode==='contact'){m.position.x=base.x*(1+t*3*travel);m.position.z=base.z*(1+t*3*travel);m.position.y=base.y+(mode==='contact'?(base.y-1.05)*t*3:Math.sin(t*Math.PI)*.6);size=1-t*.6;}
        if(mode==='sweep'){m.rotation.z+=dt*3*travel;size=.7+t*.95;}
        if(mode==='whirl'){m.rotation.y+=dt*5.5*travel;size=.8+t*.4;}
        if(mode==='orbit'){const a=t*2*travel;m.position.x=base.x*Math.cos(a)-base.z*Math.sin(a);m.position.z=base.x*Math.sin(a)+base.z*Math.cos(a);m.position.y=base.y+t*.7;}
        if(mode==='purify'){m.position.x=base.x*(1+t*1.7*travel);m.position.z=base.z*(1+t*1.7*travel);m.position.y=base.y+t*.95*travel;size=1-t*.65;}
        if(mode==='grow')size=.12+.88*Math.min(1,t*7);
        if(mode==='electric')size=.94+.06*Math.sin(t*Math.PI*3);
        if(mode==='splat'){size=1+t*.9;m.position.y=base.y-t*.5;}
        if(mode==='breathe')size=.82+Math.sin(t*Math.PI)*.42;
        if(mode==='pop')size=1.45-.75*smooth(t/.4);
        if(mode==='mist'){size=1+t*1.1;m.position.y=base.y+t*.5;}
        if(mode==='gather')m.position.set(base.x*(1-t),base.y+t*.7,base.z*(1-t));
        m.scale.copy(scale).multiplyScalar(size);
      }
    }}
    function reset(){effects.forEach(dispose);effects=[];impacts=0;crits=0;}
    function cancel(f){const i=effects.indexOf(f);if(i>=0)dispose(effects.splice(i,1)[0]);}
    function destroy(){if(destroyed)return;reset();inks.clear();templates.clear();for(const m of members.keys())m.dispose();members.clear();pool.clear();leased.clear();for(const map of [glow,petal,mist])map.dispose();particleMaterial.dispose();shieldMaterial?.dispose();destroyed=true;}
    return {emit,tick,reset,cancel,destroy,stats:()=>({groups:effects.length,max:limit,meshes:effects.reduce((n,f)=>n+f.group.children.length,0),particles:effects.reduce((n,f)=>n+f.parts.filter(p=>p.mode==='particles').reduce((s,p)=>s+p.m.geometry.attributes.position.count,0),0),textureBytes:destroyed?0:49152})};
  }
  root.TowerSkillEffects={create,FAMILIES,THEMES,ROBOT_FAMILIES,SIGNATURES,ACCENTS,METEOR_FALL,familyFor,colorsFor,signatureFor,accentFor,envelope};
})(globalThis);
