/* A tiny, temporary story stage for the existing renderer. Story paragraphs stay
   untouched; it owns no animation loop, gameplay state, audio or external media. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerStoryTheater=api;})(globalThis,function(){
  'use strict';
  const PEOPLE=Object.freeze({
    '伊芙':Object.freeze({id:'eve',job:'scout',sex:'female'}),'米菈':Object.freeze({id:'mira',job:'healer',sex:'female'}),
    '洛恩':Object.freeze({id:'rowan',job:'smith',sex:'male'}),'星奈':Object.freeze({id:'sena',job:'mage',sex:'female'}),
    '奧倫':Object.freeze({id:'oren',job:'smith',sex:'male'}),'璃安':Object.freeze({job:'healer',sex:'female'})
  });
  const PALETTES=Object.freeze({
    cloud:[0x243449,0x8795a4,0xd7b578,0xd6e5ed],garden:[0x263b32,0x637c50,0xcbbb82,0xb8d28a],
    roots:[0x282a23,0x685443,0x9a8a63,0xb9c586],echo:[0x27384e,0x647d93,0x96c9d0,0xa9e3e8],
    library:[0x2d293b,0x655b75,0xa99169,0xd9cda2],mist:[0x253b41,0x567779,0x9db9a7,0xc2dbcd],
    frost:[0x2d3e51,0x879ead,0xbfd2df,0xe0f1fa],clockwork:[0x332f2b,0x84745c,0xb89866,0xe0bd7b],
    furnace:[0x3a292a,0x705447,0xad7b54,0xffb06b],heart:[0x2c3347,0x6c7687,0xafa586,0xedddb0]
  });
  function environmentId(environment,floor){
    const supplied=typeof environment==='string'?environment:environment?.environmentId||environment?.id;
    if(PALETTES[supplied])return supplied;
    if(floor<0)return ['roots','mist','library','furnace','heart'][Math.min(4,Math.floor((-floor-1)/10))];
    return ['cloud','garden','roots','echo','library','mist','frost','clockwork','furnace','heart'][Math.min(9,Math.max(0,Math.floor((99-(Number(floor)||99))/10)))];
  }
  function personIn(text){let name='',at=Infinity;for(const candidate of Object.keys(PEOPLE)){const index=text.indexOf(candidate);if(index>=0&&index<at){name=candidate;at=index;}}return name;}
  function performance(text,polished=false){
    if(/告別|再見|離開|歸途|回家|休息|放下/.test(text))return 'farewell';
    if(/受傷|疼痛|發抖|哭泣|低頭|害怕/.test(text))return 'hurt';
    if(/指向|指著|提醒|告訴|遞來|地圖|跟上|路牌|帶.*走/.test(text))return 'guide';
    if(/攔|守衛|挑戰|不准|逼近|舉起武器/.test(text))return 'challenge';
    if(polished){if(/歡呼|成功|希望|加油/.test(text))return 'excited';if(/發現|揭開|出現|光芒|召喚/.test(text))return 'reveal';if(/觀察|思考|回憶|猶豫|想起|望著/.test(text))return 'thoughtful';}
    return 'idle';
  }
  // Audio-file seconds are converted once to the existing playback rate.
  const SUMMIT_NARRATION_RATE=1.16;
  const summitBeats=rows=>Object.freeze(rows.map(([at,end,mood,gesture,gaze])=>Object.freeze({at:at/SUMMIT_NARRATION_RATE,duration:(end-at)/SUMMIT_NARRATION_RATE,mood,gesture,gaze:typeof gaze==='object'?Object.freeze({...gaze}):gaze})));
  const SUMMIT_ACTING=Object.freeze([
    Object.freeze({sourceDuration:24.4,hero:summitBeats([
      [0,3.5,'thoughtful','wake','down'],[3.5,9.5,'reveal','inspect',{x:-.18,y:.02,z:0}],
      [9.5,13.5,'thoughtful','inspect','down'],[13.5,17.2,'thoughtful','turn','altar'],
      [17.2,22.4,'reflective','listen','altar'],[22.4,24.4,'reflective','settle','front']
    ])}),
    Object.freeze({sourceDuration:24.24,hero:summitBeats([
      [0,3.3,'thoughtful','listen','partner-right'],[3.3,8.3,'thoughtful','inspect','down'],
      [8.3,11,'thoughtful','listen','partner-right'],[11,15,'guide','receive','partner-right'],
      [15,21,'thoughtful','inspect','palm'],[21,24.24,'thoughtful','turn','altar']
    ]),eve:summitBeats([
      [0,3.3,'idle','listen','partner-left'],[3.3,7,'challenge','warn','partner-left'],
      [7,11,'guide','point','down'],[11,15,'guide','offer','partner-left'],
      [15,21,'guide','point','partner-left'],[21,24.24,'reflective','recollect','front']
    ])}),
    Object.freeze({sourceDuration:19.52,hero:summitBeats([
      [0,5,'thoughtful','palm','palm'],[5,10,'thoughtful','listen','partner-right'],
      [10,14,'reflective','listen','partner-right'],[14,17.5,'thoughtful','turn','altar'],
      [17.5,19.52,'reveal','settle','altar']
    ]),eve:summitBeats([
      [0,4,'idle','listen','partner-left'],[4,8.6,'surprised','recollect','partner-left'],
      [8.6,13.5,'reflective','recollect','front'],[13.5,17.5,'thoughtful','turn','altar'],
      [17.5,19.52,'reveal','settle','altar']
    ])})
  ]);
  // Editorial shot data only: the existing director advances cuts and owns
  // camera timing. Eye-lines follow the authored actor heights, not a guessed
  // profession size. Every camera remains on the open, front side of the altar.
  function summitCuts(T,index,hero,npc,name){
    function face(actor,x,z){const point=new T.Vector3(x,1.9,z),head=actor?.userData?.headMesh||actor?.userData?.head;if(head){actor.updateMatrixWorld(true);head.getWorldPosition(point);}return point;}
    const h=face(hero,-.9,.45),n=face(npc,.95,-.05),protagonist=hero?['hero']:[],pair=npc?[...protagonist,name]:protagonist,traveller=npc?[name]:protagonist,lowerEye=npc?Math.min(h.y,n.y):h.y;
    const make=(id,at,duration,goal,goalTo,focus,focusTo,fov,subjects)=>Object.freeze({id,at,duration,goal:new T.Vector3(...goal),goalTo:new T.Vector3(...goalTo),focus:new T.Vector3(...focus),focusTo:new T.Vector3(...focusTo),fov,subjects:Object.freeze(subjects.slice())});
    const wide=(id,at,duration)=>make(id,at,duration,[3.2,6.2,7.8],[2.7,5.65,7.1],[-.35,-.25+(lowerEye-1.9)*.7,-.6],[-.35,-.2+(lowerEye-1.9)*.7,-.55],56,pair);
    const medium=(id,at,duration,point,subjects,side=1,handheld=false)=>make(id,at,duration,[point.x+side*.2,point.y+.22,point.z+3.2],[point.x+side*.12,point.y+.17,point.z+2.95],[point.x,point.y-(handheld?.79:.5),point.z],[point.x,point.y-(handheld?.76:.47),point.z],48,subjects);
    const close=(id,at,duration,point,subjects,side=1)=>make(id,at,duration,[point.x+side*.55,point.y+.12,point.z+2.22],[point.x+side*.43,point.y+.1,point.z+2.12],[point.x,point.y-.25,point.z],[point.x,point.y-.24,point.z],42,subjects);
    const side=(id,at,duration,handheld=false)=>make(id,at,duration,[3.0,2.7,3.7],[2.65,2.55,3.4],[-.5,lowerEye-(handheld?1.58:1.05),-.2],[-.55,lowerEye-(handheld?1.53:1),-.2],52,pair);
    if(index===0&&!npc)return Object.freeze([wide('summit-establish',0,4),side('summoning-side',4,4),medium('traveller-awakens',8,3.5,h,protagonist),close('traveller-question',11.5,3.5,h,protagonist)]);
    if(index===2)return Object.freeze([medium('fragment-discovery',0,4,h,protagonist,1,true),close('traveller-recognition',4,4,npc?n:h,traveller,-1),side('summoning-returns',8,3.5),wide('summit-after-echo',11.5,3.5)]);
    return Object.freeze([side('travellers-meet',0,4),medium('traveller-warning',4,3.5,npc?n:h,traveller,-1),side('map-offer-and-receive',7.5,6,true),close('traveller-shares-direction',13.5,4,npc?n:h,traveller,-1)]);
  }
  // One region has one visual identity, regardless of whether the entry is its
  // opening, a later chapter, a resumed objective or a journal replay.
  // Lighting and haze per region. The summit values are the approved originals;
  // every other region keeps three no-shadow lights and its own palette.
  const LOOKS=Object.freeze({
    cloud:Object.freeze({background:0xb6d8e7,fog:[16,45],ambient:[0xf0e4d3,.46],hemi:[null,null,.7],key:[0xffedda,.82,-3.8,7,5.5],lift:.2,contact:.199}),
    garden:Object.freeze({background:0xe7e6cf,fog:[15,42],ambient:[0xfff3dc,.48],hemi:[0xd9f0ff,0x50703c,.74],key:[0xfff0cc,.96,-4.5,8,4.6],lift:0,contact:.012}),
    roots:Object.freeze({background:0x18231a,fog:[9,28],ambient:[0xd8e6c0,.48],hemi:[0xc6d494,0x261d14,.72],key:[0xf6f2c0,.8,-2.6,9,2],lift:0,contact:.012}),
    echo:Object.freeze({background:0x0f1b2b,fog:[8,29],ambient:[0xcde7ff,.38],hemi:[0xa9e3e8,0x151b28,.66],key:[0xbdf2ff,.76,3.6,6.4,4.2],lift:0,contact:.012}),
    library:Object.freeze({background:0x1e1a27,fog:[9,29],ambient:[0xf6e2c4,.4],hemi:[0xe6d6a8,0x1d1826,.58],key:[0xffd49a,.86,-3,6,4.6],lift:0,contact:.012}),
    mist:Object.freeze({background:0xa8bdb6,fog:[8,27],ambient:[0xe6f2ec,.5],hemi:[0xdcefe8,0x2c4244,.64],key:[0xeefff6,.62,-4,7,5],lift:0,contact:.012}),
    frost:Object.freeze({background:0x4e6377,fog:[8,29],ambient:[0xe6f3ff,.46],hemi:[0xe4f3fb,0x2a3646,.72],key:[0xeef8ff,.84,-4,7.5,5],lift:0,contact:.012}),
    clockwork:Object.freeze({background:0x241e19,fog:[9,29],ambient:[0xf4dcb4,.4],hemi:[0xe8c788,0x221c16,.62],key:[0xffd8a0,.88,-3.5,6.5,5],lift:0,contact:.012}),
    furnace:Object.freeze({background:0x24110f,fog:[8,27],ambient:[0xffd6b8,.36],hemi:[0xffb878,0x200f0c,.66],key:[0xffac6c,.92,2.6,4.6,4.6],lift:0,contact:.012}),
    heart:Object.freeze({background:0x181d30,fog:[10,32],ambient:[0xf2e8d0,.52],hemi:[0xf0e2b8,0x1b2034,.74],key:[0xfff0c8,.95,-3.5,7,5],lift:0,contact:.012})
  });
  // The film stage deliberately has its own art direction. All surfaces are
  // authored here, with tiny deterministic textures and no downloaded media.
  // Static scenery is baked by surface and depth layer before the first frame;
  // the animation loop only changes transforms of the few retained props.
  function scenery(T,id,palette,scene,owned,motion,{deep=false,light=null}={}){
    const set=new T.Group();set.name='story-theater-environment';scene.add(set);
    const layers={};for(const name of ['near','middle','far']){const group=new T.Group();group.name='story-'+name+'-scenery';layers[name]=group;set.add(group);}
    const cache=new Map(),mats=new Map(),textures=[];
    const geometry=(key,build)=>{if(!cache.has(key)){const g=build();cache.set(key,g);owned.add(g);}return cache.get(key);};
    const texture=(kind,size=256)=>{
      const pixels=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const at=(y*size+x)*4,noise=((Math.sin(x*127.1+y*311.7)*43758.5453)%1+1)%1;
        let shade=.84+noise*.12,alpha=255;
        if(kind==='stone'){
          const row=Math.floor(y/32),u=(x+(row%2)*32)%64,v=y%32,seam=Math.min(u,64-u,v,32-v);
          shade*=seam<1.5?.38:seam<3?.65:1;
          if(Math.abs(Math.sin(x*.079+y*.19)+Math.sin(y*.041)*.48)<.034)shade*=.78;
        }else if(kind==='floor'){
          const u=x%64,v=y%64,seam=Math.min(u,64-u,v,64-v),diamond=Math.abs(Math.abs(u-32)+Math.abs(v-32)-22);
          shade*=seam<1.4?.77:diamond<1.1?.94:1;
          if(id==='frost')shade=.78+noise*.18+(Math.abs(Math.sin(x*.042+y*.075))<.065?.13:0);
          if(id==='furnace'&&Math.abs(Math.sin(x*.055+y*.12)+Math.cos(y*.097))<.1)shade=1.15;
        }else if(kind==='ornament'){
          const u=x%64,v=y%64,braid=Math.abs(u-32-Math.sin(v/64*Math.PI*4)*9),border=Math.min(u,64-u);
          shade=braid<2||border<3||Math.abs(v-32)<1.4?1:.53+noise*.09;
        }else if(kind==='ground'){
          // Soft organic ground (soil, grass, rock): three tileable octaves.
          const wave=(f,p)=>Math.sin((x/size)*Math.PI*2*f+p)*Math.cos((y/size)*Math.PI*2*(f+1)+p*1.7);
          shade=.8+wave(2,.4)*.06+wave(5,1.9)*.05+wave(11,3.1)*.035+noise*.08;
        }else{
          const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=u*u+v*v;
          shade=1;alpha=Math.round(Math.max(0,Math.exp(-r*4.8)-.012)*255);
        }
        const value=Math.max(0,Math.min(255,Math.round(shade*255)));pixels[at]=value;pixels[at+1]=value;pixels[at+2]=value;pixels[at+3]=alpha;
      }
      const tex=new T.DataTexture(pixels,size,size,T.RGBAFormat);tex.name='story-'+kind+'-surface';tex.needsUpdate=true;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;
      if(kind!=='soft'){tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(kind==='floor'||kind==='ground'?3:2,kind==='floor'||kind==='ground'?3:2);tex.colorSpace=T.SRGBColorSpace;}else{tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;tex.generateMipmaps=false;tex.minFilter=T.LinearFilter;}
      textures.push(tex);owned.add(tex);return tex;
    };
    const maps={stone:texture('stone'),floor:texture('floor'),ornament:texture('ornament'),soft:texture('soft',128)};
    const surfaceMap=name=>{if(name==='ground'&&!maps.ground)maps.ground=texture('ground',128);return maps[name]||null;};
    const material=(color,options={})=>{
      const {surface='',glow=false,opacity=1,shine=surface==='ornament'?55:10}=options,key=[color,surface,glow,opacity,shine,!!options.additive,!!options.double].join(':');
      if(!mats.has(key)){const params={color,map:surfaceMap(surface),transparent:opacity<1||!!options.additive,opacity,depthWrite:opacity===1&&!options.additive,side:options.double?T.DoubleSide:T.FrontSide};if(options.additive)params.blending=T.AdditiveBlending;const mat=glow?new T.MeshBasicMaterial(params):new T.MeshPhongMaterial({...params,specular:0x33404c,shininess:shine});mat.userData.storySurface=surface;owned.add(mat);mats.set(key,mat);}return mats.get(key);
    };
    const mesh=(g,color,x,y,z,options={})=>{owned.add(g);const part=new T.Mesh(g,material(color,options));part.position.set(x,y,z);part.name=options.name||'story-scenery-piece';(options.parent||layers.middle).add(part);part.castShadow=false;part.receiveShadow=false;return part;};
    const box=(w,h,d,color,x,y,z,options={})=>{const p=mesh(geometry('box',()=>new T.BoxGeometry(1,1,1)),color,x,y,z,options);p.scale.set(w,h,d);return p;};
    const orb=(rx,ry,rz,color,x,y,z,options={})=>{const p=mesh(geometry('orb',()=>new T.SphereGeometry(1,18,12)),color,x,y,z,options);p.scale.set(rx,ry,rz);return p;};
    const rod=(r,h,color,x,y,z,options={})=>{const p=mesh(geometry('rod',()=>new T.CylinderGeometry(1,1,1,12)),color,x,y,z,options);p.scale.set(r,h,r);return p;};
    const cone=(r,h,color,x,y,z,options={})=>{const p=mesh(geometry('cone',()=>new T.ConeGeometry(1,1,8)),color,x,y,z,options);p.scale.set(r,h,r);return p;};
    const ring=(r,t,color,x,y,z,options={})=>mesh(geometry('ring-'+r+'-'+t,()=>new T.TorusGeometry(r,t,6,48)),color,x,y,z,options);
    const animate=(part,kind,speed=1,range=.05,phase=0)=>{part.userData.storyDynamic=true;const tint=part.material?.color;motion.push({part,kind,speed,range,phase,x:part.position.x,y:part.position.y,z:part.position.z,rx:part.rotation.x,ry:part.rotation.y,rz:part.rotation.z,sx:part.scale.x,sy:part.scale.y,sz:part.scale.z,opacity:part.material?.opacity??1,intensity:part.intensity??0,cr:tint?.r??1,cg:tint?.g??1,cb:tint?.b??1});return part;};
    function bake(group){
      group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),groups=new Map(),toRemove=[];
      group.traverse(part=>{
        if(!part.isMesh||part.userData.storyDynamic||part.userData.storyUnbatched||part.userData.storyBakedPieces)return;let ancestor=part.parent;while(ancestor&&ancestor!==group){if(ancestor.userData.storyDynamic)return;ancestor=ancestor.parent;}
        const mat=part.material;if(Array.isArray(mat))return;
        const key=[mat.type,mat.map?.uuid||'',mat.opacity,mat.side,mat.shininess||0,mat.blending].join(':'),entry=groups.get(key)||{mat,parts:[]};entry.parts.push({part,matrix:inverse.clone().multiply(part.matrixWorld)});groups.set(key,entry);toRemove.push(part);
      });
      for(const entry of groups.values()){
        let count=0;for(const {part}of entry.parts)count+=part.geometry.index?.count||part.geometry.attributes.position.count;
        const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=new Float32Array(count*3),point=new T.Vector3(),normal=new T.Vector3();let offset=0;
        for(const {part,matrix}of entry.parts){const g=part.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index,normalMatrix=new T.Matrix3().getNormalMatrix(matrix),color=part.material.color;
          for(let at=0;at<(index?.count||p.count);at++){const ix=index?index.getX(at):at;point.fromBufferAttribute(p,ix).applyMatrix4(matrix);normal.set(n?n.getX(ix):0,n?n.getY(ix):1,n?n.getZ(ix):0).applyMatrix3(normalMatrix).normalize();positions[offset*3]=point.x;positions[offset*3+1]=point.y;positions[offset*3+2]=point.z;normals[offset*3]=normal.x;normals[offset*3+1]=normal.y;normals[offset*3+2]=normal.z;uvs[offset*2]=uv?.getX(ix)||0;uvs[offset*2+1]=uv?.getY(ix)||0;colors[offset*3]=color.r;colors[offset*3+1]=color.g;colors[offset*3+2]=color.b;offset++;}
        }
        const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uvs,2));g.setAttribute('color',new T.BufferAttribute(colors,3));g.computeBoundingSphere();owned.add(g);
        const mat=entry.mat.clone();mat.color.setHex(0xffffff);mat.vertexColors=true;owned.add(mat);const part=new T.Mesh(g,mat);part.name='story-batch-'+group.name+'-'+(mat.userData.storySurface||mat.type);part.userData.storyBakedPieces=entry.parts.length;part.castShadow=false;part.receiveShadow=false;group.add(part);
      }
      for(const part of toRemove)part.parent?.remove(part);
    }
    function cloud(x,y,z,scale=1,kind='cloud',color=0xf5ebdc,opacity=.16){const group=new T.Group();group.name='story-'+kind;group.position.set(x,y,z);group.scale.setScalar(scale);layers.far.add(group);for(let n=0;n<24;n++){const mist=mesh(geometry('fog-plane',()=>new T.PlaneGeometry(1,1)),color,Math.sin(n*2.399)*2.8,Math.cos(n*1.73)*.37,Math.sin(n*3.19)*.18,{parent:group,surface:'soft',opacity,glow:true,double:true});mist.scale.set(1.6+n%4*.23,.8+n%3*.19,1);mist.rotation.z=Math.sin(n*1.79)*.12;}bake(group);animate(group,kind,.08,.75);return group;}
    function ridge(depth,height,color,phase){
      const profile=[];for(let n=0;n<18;n++)profile.push(new T.Vector3((n-8.5)*2.7,height+Math.sin(n*1.41+phase)*1.15+Math.cos(n*.62+phase)*.74,Math.sin(n*.83+phase)*.42));
      const outline=new T.CatmullRomCurve3(profile).getPoints(85),positions=[],colors=[],tone=new T.Color(color);for(let row=0;row<2;row++)for(let n=0;n<outline.length-1;n++){
        for(const [at,band]of [[n,row],[n+1,row],[n,row+1],[n+1,row],[n+1,row+1],[n,row+1]]){const point=outline[at],fraction=1-band/2;positions.push(point.x+Math.sin(at*1.13+phase)*band*.2,point.y*fraction-(1-fraction)*2,depth+point.z+band*.75);const facet=.92+Math.sin(Math.floor(at/4)*.93+row)*.08;colors.push(tone.r*facet,tone.g*facet,tone.b*facet);}
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();owned.add(g);const mat=new T.MeshPhongMaterial({vertexColors:true,shininess:2,specular:0x101b24,side:T.DoubleSide});owned.add(mat);const mountain=new T.Mesh(g,mat);mountain.name='story-layered-mountain-ridge';mountain.userData.storyUnbatched=true;layers.far.add(mountain);return mountain;
    }
    function particles(color,count=28){const positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=Math.sin(i*12.1)*4.1;positions[i*3+1]=.4+((i*7)%31)/31*4.8;positions[i*3+2]=-1.8-((i*11)%23)/23*6;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));owned.add(g);const mat=new T.PointsMaterial({color,map:maps.soft,size:id==='frost'?.095:.06,transparent:true,opacity:.56,depthWrite:false});owned.add(mat);const p=new T.Points(g,mat);p.name='story-atmosphere-motes';layers.middle.add(p);animate(p,'float',.16,.13);}
    function sky(top,bottom){const g=geometry('sky',()=>new T.SphereGeometry(22,28,16)),colors=new Float32Array(g.attributes.position.count*3),upper=new T.Color(top),lower=new T.Color(bottom);for(let n=0;n<g.attributes.position.count;n++){const mix=Math.max(0,Math.min(1,(g.attributes.position.getY(n)/22+.17)*1.35));colors[n*3]=lower.r+(upper.r-lower.r)*mix;colors[n*3+1]=lower.g+(upper.g-lower.g)*mix;colors[n*3+2]=lower.b+(upper.b-lower.b)*mix;}g.setAttribute('color',new T.BufferAttribute(colors,3));const skyMat=new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false});owned.add(skyMat);const dome=new T.Mesh(g,skyMat);dome.name='story-gradient-sky';dome.userData.storyUnbatched=true;dome.position.y=4;layers.far.add(dome);return dome;}
    if(id==='cloud'){
      // Continuous floor and a readable foreground path ground the characters;
      // decorative edges frame them, without a floating circular display plinth.
      box(19,.24,17,palette[1],0,-.2,-3.5,{surface:'floor',parent:layers.near,name:'story-carved-floor'});
      for(let n=0;n<7;n++)box(2.7,.035,1.1,0x979b9b,0,-.045,-1-n*1.1,{surface:'floor'});
      for(const side of [-1,1]){box(.25,.2,13,palette[2],side*5.4,-.045,-3.3,{surface:'ornament'});box(.55,.28,.75,palette[1],side*3.6,.03,1.1,{surface:'stone',parent:layers.near});}
      sky(0x88bbd8,0xd2e8f3);
      ridge(-20,4.3,0xaccbb0,.8);ridge(-17.8,3.5,0x82ad84,2.1);ridge(-14.6,2.7,0x588b61,4.5);
      set.userData.storyArtDirection='cloud-summit';
      set.userData.storyLandmarks=Object.freeze(['carved-altar','inlaid-processional-path','fluted-pillars','wind-banners','blue-sky','green-mountain-ridges']);
      // The same engraved promenade, altar steps and roof parapet now surround
      // every cloud-region scene. Detail sits beside/behind the actors, keeping
      // the mobile close-up sightlines clear and the old summit choreography intact.
      for(let n=0;n<7;n++){
        const z=-1-n*1.1;for(const side of [-1,1])box(.045,.012,.88,palette[2],side*1.23,-.02,z,{surface:'ornament'});
        const diamond=box(.22,.013,.22,palette[2],0,-.022,z,{surface:'ornament'});diamond.rotation.y=Math.PI/4;
      }
      for(let step=0;step<3;step++)rod(1.9+step*.17,.055,step===2?0x657c8d:palette[1],0,-.08+step*.055,-.35,{surface:'stone'});
      for(const side of [-1,1]){for(let n=0;n<3;n++){box(.5,1.05,.55,palette[1],side*(2.7+n*.92),.44,-4.15,{surface:'stone'});box(.7,.15,.75,palette[2],side*(2.7+n*.92),1,-4.15,{surface:'ornament'});}box(4.9,.28,.45,palette[1],side*3.7,.2,-4.15,{surface:'stone'});rod(.3,3.8,palette[1],side*3.9,1.75,-3.65,{surface:'stone'});rod(.46,.23,palette[2],side*3.9,3.7,-3.65,{surface:'ornament'});cone(.7,.7,palette[2],side*3.9,4.16,-3.65,{surface:'ornament'});box(.3,4.5,.4,palette[1],side*5.5,2,-9,{surface:'stone',parent:layers.far});cone(.62,1.8,palette[2],side*5.5,5.07,-9,{parent:layers.far});}
      for(const side of [-1,1]){
        for(const y of [.13,.34,3.42])rod(y===.13?.49:.38,y===.13?.15:.11,palette[2],side*3.9,y,-3.65,{surface:'ornament'});
        for(let flute=0;flute<8;flute++){const angle=flute*Math.PI/4;rod(.018,2.88,0xc1cdd1,side*3.9+Math.cos(angle)*.305,1.88,-3.65+Math.sin(angle)*.305,{surface:'stone'});}
        for(let n=0;n<4;n++){const z=-4.2-n*1.2;box(.27,.9,.27,palette[1],side*5.25,.36,z,{surface:'stone'});box(.37,.1,.37,palette[2],side*5.25,.85,z,{surface:'ornament'});}
        box(.32,.16,5,palette[2],side*5.25,.99,-6,{surface:'ornament'});
        const bannerStaff=rod(.035,.98,palette[2],side*3.5,3.49,-3.57,{surface:'ornament'});bannerStaff.rotation.z=Math.PI/2;
        orb(.13,.13,.13,palette[2],side*3.9,4.64,-3.65,{surface:'ornament'});
      }
      const altar=rod(1.78,.24,palette[1],0,.065,-.35,{surface:'stone'});altar.name='story-summoning-altar';for(let n=0;n<2;n++){const summon=ring(n?.92:1.4,n?.027:.043,n?palette[3]:palette[2],0,.205+n*.004,-.35,{glow:true});summon.rotation.x=Math.PI/2;animate(summon,'turn',n?-.07:.05);}
      for(let n=0;n<12;n++){const glyph=box(.07,.022,.2,palette[2],Math.cos(n*Math.PI/6)*1.18,.203,-.35+Math.sin(n*Math.PI/6)*1.18,{glow:true});glyph.rotation.y=-n*Math.PI/6;}
      for(const side of [-1,1]){const cloth=new T.PlaneGeometry(.8,2.1,5,7),banner=mesh(cloth,0x384c72,side*3.5,2.5,-3.57,{surface:'ornament',double:true});banner.name='story-summit-banner';animate(banner,'cloth',.85,.075);}
      cloud(-6,2,-10,1.25);cloud(4.5,3.1,-13,1.6);cloud(0,4.8,-18,2.2);orb(.65,.65,.14,0xf8ddb0,-6.2,7,-17,{glow:true,parent:layers.far});particles(palette[3],20);
    }else regionScenery({T,id,deep,light,palette,set,layers,owned,motion,geometry,material,mesh,box,orb,rod,cone,ring,animate,bake,cloud,ridge,sky,maps,surfaceMap});
    for(const layer of Object.values(layers))bake(layer);
    let drawables=0,triangles=0;set.traverse(n=>{if(n.isMesh||n.isPoints){drawables++;if(n.isMesh)triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
    scene.userData.storySceneryBudget=Object.freeze({drawables,triangles,textures:textures.length,textureBytes:textures.reduce((sum,tex)=>sum+tex.image.data.byteLength,0),maxTextureSize:256});
    scene.userData.storyMotionTracks=Object.freeze(motion.map(track=>Object.freeze({name:track.part.name,kind:track.kind})));return set;
  }
  // Region film sets beyond the summit. Same toolkit, budgets and release path:
  // static pieces bake into a few batches per depth layer, and only a handful of
  // retained props (plus one point cloud) move. Nothing here touches gameplay.
  function regionScenery(kit){
    const {T,id,deep,light,palette,set,layers,owned,motion,geometry,mesh,box,orb,rod,cone,ring,animate,bake,cloud,ridge,sky}=kit;
    const near=layers.near,far=layers.far;
    // Deterministic 0..1 sequence; scenery never consumes gameplay randomness.
    const hash=n=>{const s=Math.sin(n*127.1+id.length*311.7)*43758.5453;return s-Math.floor(s);};
    const art=(name,landmarks)=>{set.userData.storyArtDirection=name;set.userData.storyLandmarks=Object.freeze(landmarks.slice());};
    const group=(x,y,z,parent=layers.middle,name='story-prop')=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
    const own=part=>{const copy=part.material.clone();owned.add(copy);part.material=copy;return part;};
    const disc=(r,h,color,x,y,z,options={})=>{const p=mesh(geometry('disc',()=>new T.CylinderGeometry(1,1,1,48)),color,x,y,z,options);p.scale.set(r,h,r);return p;};
    const hex=(r,h,color,x,y,z,options={})=>{const p=mesh(geometry('hex',()=>new T.CylinderGeometry(1,1,1,6)),color,x,y,z,options);p.scale.set(r,h,r);return p;};
    const gem=(rx,ry,rz,color,x,y,z,options={})=>{const p=mesh(geometry('gem',()=>new T.OctahedronGeometry(1,0)),color,x,y,z,options);p.scale.set(rx,ry,rz);return p;};
    const flat=(w,h,color,x,y,z,options={})=>{const p=mesh(geometry('plane',()=>new T.PlaneGeometry(1,1)),color,x,y,z,options);p.scale.set(w,h,1);return p;};
    const arch=(r,t,color,x,y,z,options={})=>mesh(geometry('arch-'+r+'-'+t,()=>new T.TorusGeometry(r,t,8,28,Math.PI)),color,x,y,z,options);
    // Low-poly buds for small blossoms, berries and glints: a fraction of an orb.
    const bud=(rx,ry,rz,color,x,y,z,options={})=>{const p=mesh(geometry('bud',()=>new T.SphereGeometry(1,8,6)),color,x,y,z,options);p.scale.set(rx,ry,rz);return p;};
    // Ground, actor platform with a trimmed edge and contact-friendly top at y=0.
    function ground(color,surface='ground'){
      // Organic ground extends past the haze; tiled floors keep their authored
      // tile size and sit on an untextured apron, so no slab edge reads on screen.
      if(surface==='ground'){box(48,.24,40,color,0,-.2,-6,{surface,parent:near,name:'story-carved-floor'});kit.surfaceMap('ground').repeat.set(7.5,6.25);}
      else{box(19,.24,17,color,0,-.2,-3.5,{surface,parent:near,name:'story-carved-floor'});const tone=new T.Color(color).multiplyScalar(.82).getHex();box(60,.2,50,tone,0,-.2,-8,{parent:near,name:'story-floor-apron'});}
    }
    function platform(color,trim,{surface='stone',glowTrim=false,radius=2.3}={}){
      disc(radius,.1,color,0,-.05,-.35,{surface,parent:near,name:'story-actor-platform'});
      const edge=ring(radius+.03,.045,trim,0,0,-.35,{glow:glowTrim,parent:near});edge.rotation.x=Math.PI/2;
    }
    function walls(color,trim,height=7.6){
      box(20,height,.5,color,0,height/2-.1,-11.2,{surface:'stone',parent:far});
      for(const side of [-1,1]){box(.6,height,15,color,side*7.7,height/2-.1,-4.4,{surface:'stone',parent:far});for(let n=0;n<4;n++)box(.5,height,.6,trim,side*7.3,height/2-.1,-1.4-n*2.9,{surface:'stone',parent:far});}
      box(15.6,.45,.6,trim,0,height-.3,-10.9,{surface:'ornament',parent:far});
    }
    // Point clouds. 'drift' falls or rises through a band and wraps; 'wander'
    // circles its home. Both rewrite retained positions only, never allocate.
    function motes(color,{count=32,kind='wander',dir=1,speed=.3,range=.35,size=.06,opacity=.7,low=.3,high=4.4,width=4.6,front=1.2,back=-7.5,additive=true,twinkle=true}={}){
      const positions=new Float32Array(count*3);
      for(let i=0;i<count;i++){positions[i*3]=(hash(i*3+1)*2-1)*width;positions[i*3+1]=low+hash(i*3+2)*(high-low);positions[i*3+2]=front+(back-front)*hash(i*3+3);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.computeBoundingSphere();owned.add(g);
      const mat=new T.PointsMaterial({color,map:kit.maps.soft,size,transparent:true,opacity,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending});owned.add(mat);
      const points=new T.Points(g,mat);points.name='story-atmosphere-motes';points.frustumCulled=false;layers.middle.add(points);
      animate(points,kind,speed,range);const track=motion[motion.length-1];Object.assign(track,{base:positions.slice(),low,span:Math.max(.5,high-low),dir:dir<0?-1:1,twinkle});
      return points;
    }
    function tree(x,z,scale,trunkColor,leafColors,phase){
      rod(.16*scale,2.4*scale,trunkColor,x,1.15*scale,z,{surface:'stone'});
      const crown=group(x,2.55*scale,z,layers.middle,'story-tree-crown');
      for(let n=0;n<5;n++){const a=n*1.257+phase;orb((.72+hash(n+phase*7)*.3)*scale,(.58+hash(n+9)*.2)*scale,(.7+hash(n+4)*.25)*scale,leafColors[n%leafColors.length],Math.cos(a)*.55*scale,(n%2?.35:-.05)*scale,Math.sin(a)*.42*scale,{parent:crown});}
      bake(crown);animate(crown,'sway',.55+phase*.07,.03,phase);return crown;
    }
    function lantern(x,y,z,glow,frame=0x3b2f24){
      const hang=group(x,y,z,layers.middle,'story-lantern');rod(.012,.9,frame,0,.45,0,{parent:hang});
      box(.2,.03,.2,frame,0,-.02,0,{parent:hang});box(.2,.03,.2,frame,0,-.36,0,{parent:hang});for(const [dx,dz]of [[-1,-1],[1,-1],[-1,1],[1,1]])rod(.012,.34,frame,dx*.09,-.19,dz*.09,{parent:hang});
      orb(.075,.11,.075,glow,0,-.19,0,{glow:true,parent:hang});flat(.6,.6,glow,0,-.19,.02,{glow:true,surface:'soft',opacity:.32,parent:hang,additive:true});
      bake(hang);animate(hang,'swing',.9+hash(x)*.4,.06,hash(z)*6);return hang;
    }
    function butterfly(x,y,z,color,phase){
      const fly=group(x,y,z,layers.middle,'story-butterfly'),wing=geometry('wing',()=>new T.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(.5,0,0));
      // Right wing first, then its mirror; flutter lifts both tips about the body line.
      for(const side of [1,-1]){const w=mesh(wing,color,0,0,0,{glow:true,double:true,parent:fly});w.scale.set(.15*side,1,.11);w.userData.storyDynamic=true;}
      animate(fly,'flutter',1,.9,phase);return fly;
    }
    if(id==='garden'){
      art('garden-terrace',['sunlit-terrace','rose-arch','hedge-walls','swaying-trees','flower-beds','rolling-hills','drifting-petals','butterflies']);
      sky(0x6aaedf,0xf7eccf);ridge(-20,4.1,0xb9d6a9,.4);ridge(-17.6,3.2,0x92be82,1.7);ridge(-14.9,2.4,0x6c9c5e,3.9);
      ground(0x5e8b47);platform(0xd4c8a4,palette[2],{surface:'floor'});
      for(let n=0;n<5;n++){const stone=box(.95,.05,.66,0xc2b896,(n%2?.2:-.2),-.045,-2.95-n*.98,{surface:'stone'});stone.rotation.y=(hash(n+40)-.5)*.5;}
      for(let n=0;n<120;n++){const a=n*2.399,r=2.55+hash(n)*4.6,x=Math.cos(a)*r,z=-.35+Math.sin(a)*r*.85;if(z>1.2&&Math.abs(x)<3.4||Math.abs(x)<.75&&z<-2.4&&z>-8)continue;const blade=cone(.035+hash(n+5)*.03,.18+hash(n+7)*.2,[0x4f8a3c,0x6aa24c,0x3f7a33,0x7db35a][n%4],x,.04,z);blade.rotation.z=(hash(n+11)-.5)*.5;}
      const blooms=[0xf4a6b8,0xfff0a6,0xffffff,0xc9a4f0,0xff8f8f];
      for(let n=0;n<44;n++){const a=n*.7+.3,r=2.55+(n%3)*.22,x=Math.cos(a)*r,z=-.35+Math.sin(a)*r*.9;if(z>1.3&&Math.abs(x)<3.3)continue;bud(.07,.06,.07,blooms[n%blooms.length],x,.08+(n%2)*.05,z);}
      for(const side of [-1,1])for(let n=0;n<6;n++){const z=-.9-n*1.2;for(let k=0;k<3;k++)orb(.55,.5,.5,[0x3f6d34,0x4b7c3d,0x365f2e][(n+k)%3],side*(4.55+(k-1)*.18),.42+k*.18,z+(k-1)*.32);for(let k=0;k<4;k++)bud(.06,.06,.06,blooms[(n+k)%blooms.length],side*(4.1+hash(n*4+k)*.3),.55+hash(n*7+k)*.6,z+(hash(n+k*3)-.5)*.9);}
      for(const side of [-1,1]){rod(.11,2.5,0xece4d2,side*1.45,1.15,-5.7,{surface:'stone'});rod(.18,.16,0xd8cfb8,side*1.45,-.02,-5.7,{surface:'stone'});}
      arch(1.45,.1,0xece4d2,0,2.4,-5.7,{surface:'stone'});
      for(let n=0;n<26;n++){const a=n/25*Math.PI,x=Math.cos(a)*1.45,y=2.4+Math.sin(a)*1.45;bud(.13,.11,.11,n%3?0x4b7c3d:0x5d9046,x,y,-5.62);if(n%2===0)bud(.075,.07,.07,n%4?0xf27a94:0xffd0dc,x+.05,y+.06,-5.5);}
      for(const side of [-1,1]){box(1.3,.08,.42,0xa9875e,side*3.15,.42,-3.05,{surface:'stone'});for(const dx of [-.5,.5])box(.08,.4,.36,0x8c6c49,side*3.15+dx,.2,-3.05,{surface:'stone'});rod(.26,.36,0xb76b4c,side*2.75,.18,-1.9,{surface:'stone'});orb(.32,.3,.32,0x4f8a3c,side*2.75,.5,-1.9);for(let k=0;k<4;k++)bud(.07,.07,.07,blooms[k],side*2.75+Math.cos(k*1.6)*.22,.66,-1.9+Math.sin(k*1.6)*.2);}
      tree(-5.7,-6.4,1.25,0x6d5137,[0x4c7f3c,0x5d9447,0x3f6f33],.3);tree(6,-5.4,1.12,0x6d5137,[0x5d9447,0x6fa752,0x4c7f3c],1.4);tree(-3.4,-9.3,1.45,0x5e4630,[0x3f6f33,0x4c7f3c],2.2);tree(4,-9.8,1.35,0x5e4630,[0x4c7f3c,0x5d9447],3.1);
      cloud(-6.5,6,-15,1.4,'cloud',0xfffaf0,.2);cloud(6.4,6.8,-16.5,1.7,'cloud',0xfffaf0,.18);orb(.9,.9,.1,0xfff3c8,-6.6,7.6,-17.5,{glow:true,parent:far});
      motes(0xf6b6c8,{count:36,kind:'drift',dir:-1,speed:.24,range:.38,size:.075,opacity:.85,additive:false,twinkle:false,low:.05,high:4.8});
      butterfly(-2.6,1.5,-1.6,0xffd27a,0);butterfly(2.4,1.8,-2.8,0x9fd0ff,2.3);
    }else if(id==='roots'){
      art(deep?'root-waystation':'inverted-forest',deep?['root-arches','hanging-roots','waystation-lanterns','route-sign','moss-floor','glowing-mushrooms','fireflies']:['root-arches','hanging-roots','giant-trunks','moss-floor','glowing-mushrooms','light-shafts','fireflies']);
      ground(0x3a3124);platform(0x5a4734,0x6f8a4a);
      for(let n=0;n<11;n++){const x=-7.2+n*1.45+(hash(n)-.5)*.6,z=-8.6-hash(n+3)*3.4,r=.38+hash(n+6)*.5;rod(r,11,n%2?0x3b2d21:0x45352a,x,4.9,z,{surface:'stone',parent:far});}
      for(const [r,z,tilt]of [[3.1,-4.5,.05],[3.7,-7.2,-.07],[4.3,-9.6,.03]]){const bow=arch(r,.24,0x4a3826,0,0,z,{surface:'stone'});bow.rotation.z=tilt;}
      for(const side of [-1,1])for(let n=0;n<3;n++){const root=rod(.2-n*.04,6.2,0x4f3b28,side*(4.3+n*.8),2.6,-2.6-n*2.2,{surface:'stone'});root.rotation.z=side*(.32+n*.06);root.rotation.x=-.08;}
      for(let n=0;n<30;n++){const x=(hash(n+20)*2-1)*5.6,z=-1.6-hash(n+31)*8.2,len=1.1+hash(n+42)*2.4;if(Math.abs(x)<2.2&&z>-3.2)continue;const strand=rod(.025+hash(n)*.035,len,0x5a4532,x,6.4-len/2,z,{surface:'stone'});strand.rotation.z=(hash(n+5)-.5)*.2;}
      for(let n=0;n<16;n++){const a=n*.83+.4,r=2.6+hash(n+60)*3.2,s=.28+hash(n+61)*.32;orb(s*1.3,.03,s,[0x3f5330,0x37482b,0x485e36][n%3],Math.cos(a)*r,-.075,-.35+Math.sin(a)*r*.8);}
      for(let n=0;n<12;n++){const side=n%2?1:-1,x=side*(2.6+hash(n+70)*1.6),z=-1.4-hash(n+71)*3.6,s=.7+hash(n+72)*.7;rod(.035*s,.24*s,0xe8dcc0,x,.1*s,z);orb(.16*s,.08*s,.16*s,n%3?0x8ff0b0:0x7fe0e8,x,.24*s,z,{glow:true});}
      if(deep){
        lantern(-2.7,2.7,-2.2,0x7fe8d8);lantern(2.8,2.9,-3.1,0x7fe8d8);lantern(-.6,3.2,-6.4,0x9ff0e0);
        rod(.06,1.5,0x5a4532,-3.7,.7,-2.4,{surface:'stone'});const sign=box(.9,.32,.06,0x7a5c3c,-3.55,1.3,-2.38,{surface:'stone'});sign.rotation.z=-.08;
      }else for(let n=0;n<3;n++){const shaft=own(flat(1.5,8,0xf6f2c0,-2.6+n*2.7,3.6,-3.2-n*1.6,{surface:'soft',glow:true,opacity:.22,double:true,additive:true}));shaft.rotation.z=.28;shaft.rotation.y=.2;animate(shaft,'pulse',.35+n*.08,.55,n*2.1);}
      motes(0xd8ff7a,{count:30,kind:'wander',speed:.45,range:.55,size:.11,opacity:1,low:.4,high:3.6});
    }else if(id==='echo'){
      art('crystal-cavern',['crystal-clusters','glowing-geode','stalactites','echo-ripples','cave-walls','sparkles']);
      ground(0x2a3441);platform(0x3c4a5d,palette[3],{glowTrim:true});
      for(let n=0;n<17;n++){const x=-8.2+n*1.02,lump=orb(1.1+hash(n)*.9,2.4+hash(n+1)*1.6,1,n%2?0x2c3a4c:0x34465a,x,2+hash(n+2)*1.8,-10.4+hash(n+3)*.8,{surface:'ground',parent:far});lump.rotation.z=(hash(n+4)-.5)*.4;}
      for(const side of [-1,1])for(let n=0;n<5;n++)orb(1.2+hash(n+9)*.6,2.6+hash(n+10),1.4,0x2f3e51,side*(7+hash(n+11)*.6),1.8,-1.5-n*2.2,{surface:'ground',parent:far});
      for(let n=0;n<22;n++){const x=(hash(n+30)*2-1)*6.4,z=-1.8-hash(n+31)*8.4,len=.7+hash(n+32)*1.9,spike=cone(.12+hash(n+33)*.18,len,0x4a5f75,x,6.4-len/2,z,{surface:'ground'});spike.rotation.x=Math.PI;}
      for(let n=0;n<10;n++){const side=n%2?1:-1,len=.5+hash(n+50)*1.1;cone(.16+hash(n+51)*.14,len,0x46596e,side*(3.4+hash(n+52)*2.6),len/2-.05,-1.2-hash(n+53)*6,{surface:'ground'});}
      const cluster=(x,z,s,color)=>{for(let k=0;k<5;k++){const a=k*1.4+x,shard=gem(.16*s,(.55+hash(k+x*3)*.5)*s,.16*s,color,x+Math.cos(a)*.22*s,(.42+hash(k+z)*.2)*s,z+Math.sin(a)*.18*s,{shine:110});shard.rotation.z=(hash(k+7+x)-.5)*.7;shard.rotation.x=(hash(k+9+z)-.5)*.5;}gem(.09*s,.36*s,.09*s,palette[3],x,.5*s,z,{glow:true,opacity:.6});};
      cluster(-3.9,-2.2,1,0x7ec3d4);cluster(3.7,-3,1.2,0x8fd5de);cluster(-5.4,-6.5,1.6,0x6fb3cc);cluster(5.6,-7.2,1.4,0x9adbe3);cluster(-2.3,-8.7,1.1,0x7ec3d4);cluster(2.1,-9.1,1.3,0x86cdd9);
      const geode=own(gem(.75,2.1,.75,0xbdf3ff,0,2.2,-8,{glow:true,opacity:.82}));animate(geode,'pulse',.7,.3);
      for(let k=0;k<7;k++){const a=k*.9;gem(.3,.85,.3,0x6fb3cc,Math.cos(a)*1.1,.8,-8+Math.sin(a)*.5,{shine:110}).rotation.z=Math.cos(a)*.5;}
      for(let n=0;n<2;n++){const echo=own(ring(1,.022,0xbdf3ff,0,.02,-.35,{glow:true,opacity:.7}));echo.rotation.x=Math.PI/2;animate(echo,'ripple',.16,3.4,n*.5);}
      motes(0xa9f0ff,{count:36,kind:'drift',dir:1,speed:.12,range:.25,size:.06,opacity:.85,low:.2,high:5});
    }else if(id==='library'){
      art(deep?'sunken-archive':'lost-library',deep?['towering-shelves','flooded-aisles','fallen-books','reading-desk','turning-pages','floating-books','dust-motes']:['towering-shelves','reading-desk','turning-pages','floating-books','candle-chandelier','dust-motes']);
      walls(0x2b2433,0x3b3042);ground(0x4b3a30,'floor');platform(0x6b2f3a,0xc9a460,{surface:'ornament'});
      const spines=[0x7a2e2e,0x2e4a6b,0x3d6b47,0x8a6a2e,0x5a3d6b,0x2e5f5f,0x9a8a6a,0x6b4a2e];let book=0;
      function shelf(x,z,turn,width,height,rows){
        const unit=group(x,0,z);unit.rotation.y=turn;
        box(width,height,.06,0x241b16,0,height/2,-.24,{parent:unit});for(const side of [-1,1])box(.12,height,.52,0x3d2c22,side*width/2,height/2,0,{surface:'stone',parent:unit});box(width+.2,.14,.58,0x4a3628,0,height,0,{surface:'stone',parent:unit});
        for(let row=0;row<rows;row++){const y=.12+row*(height-.2)/rows;box(width,.06,.5,0x4a3628,0,y,0,{parent:unit});let at=-width/2+.1;
          while(at<width/2-.14){const w=.07+hash(book)*.07,h=.26+hash(book+1)*.16,tilt=hash(book+2)>.88?.18:0;if(hash(book+3)>.95){at+=.12;book++;continue;}const b=box(w,h,.34,spines[book%spines.length],at+w/2,y+.03+h/2,.02,{parent:unit});b.rotation.z=tilt;at+=w+.012;book++;}}
      }
      for(const x of [-5.3,-1.75,1.75,5.3])shelf(x,-10.5,0,3.3,5.9,6);
      for(const side of [-1,1])for(const z of [-2.6,-6.2])shelf(side*6.85,z,-side*Math.PI/2,3.2,5.2,5);
      for(const side of [-1,1])rod(.03,3.6,0x6b5038,1.25+side*.25,1.75,-9.95,{surface:'stone'}).rotation.x=-.18;for(let n=0;n<8;n++){const y=.35+n*.42;box(.52,.035,.04,0x6b5038,1.25,y,-9.95-(y-1.75)*.179);}
      const desk=group(3.3,0,-2.4);desk.rotation.y=-.5;box(1.5,.08,.8,0x5b4130,0,.78,0,{surface:'stone',parent:desk});for(const [dx,dz]of [[-.65,-.32],[.65,-.32],[-.65,.32],[.65,.32]])box(.08,.76,.08,0x4a3628,dx,.38,dz,{parent:desk});
      box(.68,.04,.46,0x5a2a2a,-.15,.84,0,{parent:desk});for(const side of [-1,1]){const leaf=box(.31,.012,.42,0xf0e6cc,-.15+side*.16,.87,0,{parent:desk});leaf.rotation.z=side*-.08;}
      rod(.035,.22,0xf2ead8,.48,.93,-.12,{parent:desk});cone(.03,.08,0xffcf7a,.48,1.08,-.12,{glow:true,parent:desk});
      const page=mesh(geometry('page',()=>new T.PlaneGeometry(.3,.42).rotateX(-Math.PI/2).translate(.15,0,0)),0xfaf2dc,-.15,.885,0,{double:true,parent:desk,glow:true});page.name='story-turning-page';animate(page,'flip',.22,1);
      for(const [x,y,z,color,phase]of [[-2.7,2.4,-3.3,0x7a2e2e,0],[2.3,2.9,-4.6,0x2e4a6b,1.9],[-1,3.4,-5.8,0x3d6b47,3.7]]){const tome=group(x,y,z,layers.middle,'story-floating-book');tome.rotation.set(.3,phase,.2);box(.34,.06,.46,color,0,0,0,{parent:tome});box(.3,.05,.42,0xf0e6cc,.02,0,0,{parent:tome});bake(tome);animate(tome,'bob',.6,.14,phase);}
      const chandelier=group(0,4.7,-3.3);ring(1.05,.035,0xb89866,0,0,0,{parent:chandelier}).rotation.x=Math.PI/2;for(let n=0;n<8;n++){const a=n*Math.PI/4;rod(.03,.16,0xf2ead8,Math.cos(a)*1.05,.08,Math.sin(a)*1.05,{parent:chandelier});cone(.028,.08,0xffcf7a,Math.cos(a)*1.05,.2,Math.sin(a)*1.05,{glow:true,parent:chandelier});}for(const a of [0,2.1,4.2])rod(.008,2,0x5a4a38,Math.cos(a)*.6,1,Math.sin(a)*.6,{parent:chandelier}).rotation.z=Math.cos(a)*.27;
      if(deep){for(let n=0;n<5;n++){const pool=flat(1.2+hash(n)*1.4,.8+hash(n+1),0x5fb8c0,(hash(n+2)*2-1)*4.6,-.065,-2.2-hash(n+3)*6,{glow:true,opacity:.28,additive:true});pool.rotation.x=-Math.PI/2;}for(let n=0;n<14;n++){const b=box(.3,.06,.42,spines[n%spines.length],(n%2?1:-1)*(3+hash(n+5)*1.8),-.05+(n%3)*.06,-1.6-hash(n+6)*5);b.rotation.y=hash(n+7)*3;}lantern(-3,3,-4,0x7fe8d8);}
      if(light)animate(light,'flicker',1,.04);
      motes(0xffe2b0,{count:40,kind:'drift',dir:-1,speed:.06,range:.3,size:.05,opacity:.6,low:.3,high:4.8});
    }else if(id==='mist'){
      art(deep?'ferry-canal':'mist-cloister',deep?['reflecting-water','stone-colonnade','stepping-stones','drifting-fog','water-lanterns','ferry-boat']:['reflecting-water','stone-colonnade','stepping-stones','drifting-fog','lotus-lights']);
      sky(0x7c9b97,0xcddbd5);ridge(-19.5,3.7,0x8fa9a3,.9);ridge(-16.8,2.9,0x748f8a,2.4);
      ground(0x485d5e,'floor');platform(0x707f7c,palette[2]);
      const water=own(flat(15,12,0x3f7378,0,-.065,-5.6,{surface:'soft',opacity:.92,shine:120}));water.rotation.x=-Math.PI/2;water.name='story-reflecting-water';animate(water,'pulse',.5,.12);
      for(let n=0;n<6;n++)disc(.42+hash(n)*.08,.07,0x8a9a94,Math.sin(n*1.9)*.32,-.04,-2.6-n*.98,{surface:'stone'});
      for(const side of [-1,1])for(let n=0;n<5;n++){const z=-1.6-n*1.75;rod(.15,3.3,0xc9d6cf,side*3.75,1.55,z,{shine:40});box(.42,.16,.42,0xb4c3bc,side*3.75,3.25,z,{surface:'stone'});box(.4,.12,.4,0xb4c3bc,side*3.75,-.02,z,{surface:'stone'});if(n<4){const span=arch(.875,.07,0xc9d6cf,side*3.75,3.3,z-.875,{surface:'stone'});span.rotation.y=Math.PI/2;}rod(.12,2.3,0xb4c3bc,side*5.6,1.05,z-.4,{shine:40});}
      for(const side of [-1,1]){box(.36,.2,7.4,0xb4c3bc,side*3.75,4.24,-5.1,{surface:'stone'});box(.3,.14,7.4,0xa3b3ac,side*5.6,2.24,-5.5,{surface:'stone'});}
      cloud(-3.4,.55,-5,1,'cloud',0xe6f2ee,.18);cloud(3.9,.7,-7.6,1.2,'cloud',0xe6f2ee,.16);cloud(0,1.2,-11.5,1.7,'cloud',0xeaf4f0,.15);
      if(deep){
        for(const [x,z,phase]of [[-2.3,-3.8,0],[2.5,-4.7,1.3],[-1.1,-7,2.6],[1.7,-8.4,3.9]]){const float=group(x,-.03,z,layers.middle,'story-water-lantern');box(.22,.05,.22,0x4a3a2a,0,0,0,{parent:float});orb(.07,.1,.07,0xffd890,0,.12,0,{glow:true,parent:float});flat(.5,.5,0xffd890,0,.12,.01,{glow:true,surface:'soft',opacity:.3,parent:float,additive:true});bake(float);animate(float,'bob',.8,.025,phase);}
        const boat=group(3.6,-.02,-6.4,layers.middle,'story-ferry');box(.85,.22,2.3,0x4a3626,0,.05,0,{surface:'stone',parent:boat});cone(.42,.6,0x4a3626,0,.08,1.42,{parent:boat}).rotation.x=Math.PI/2;rod(.025,1.7,0x6b5038,.25,.9,-.6,{parent:boat}).rotation.z=-.25;orb(.07,.1,.07,0xffd890,.45,1.7,-.6,{glow:true,parent:boat});bake(boat);animate(boat,'bob',.5,.03,1.1);
      }else for(const [x,z,phase]of [[-2.4,-3.9,0],[2.6,-4.7,1.3],[-1.2,-7,2.6],[1.6,-8.3,3.9]]){const lotus=group(x,-.04,z,layers.middle,'story-lotus-light');orb(.34,.02,.34,0x4f7d55,0,0,0,{parent:lotus});for(let k=0;k<6;k++){const petal=cone(.07,.18,0xf2d7e4,Math.cos(k*1.05)*.08,.07,Math.sin(k*1.05)*.08,{parent:lotus});petal.rotation.z=Math.cos(k*1.05)*.5;petal.rotation.x=-Math.sin(k*1.05)*.5;}orb(.05,.05,.05,0xfff2c0,0,.1,0,{glow:true,parent:lotus});bake(lotus);animate(lotus,'bob',.9,.02,phase);}
      motes(0xe8fff6,{count:28,kind:'wander',speed:.25,range:.5,size:.06,opacity:.6,low:.2,high:3.2});
    }else if(id==='frost'){
      art('frost-corridor',['ice-pillars','icicle-eaves','frozen-bells','frost-windows','snow-drifts','snowfall']);
      walls(0x3c4f63,0x4a6075);ground(0x9db2c4,'floor');platform(0xbcd2e2,0xe0f1fa,{surface:'floor'});
      for(const x of [-3.6,0,3.6]){flat(1.5,2.4,0xcfe9ff,x,2.7,-10.92,{glow:true,opacity:.55,parent:far});arch(.75,.08,0x6f8aa3,x,3.9,-10.88,{surface:'stone',parent:far});for(const side of [-1,1])box(.1,2.4,.12,0x6f8aa3,x+side*.75,2.7,-10.88,{surface:'stone',parent:far});box(.06,2.4,.08,0x6f8aa3,x,2.7,-10.86,{parent:far});box(1.5,.06,.08,0x6f8aa3,x,2.7,-10.86,{parent:far});}
      for(const z of [-3,-6.6]){box(14,.42,.5,0x4a6075,0,5.1,z,{surface:'stone'});for(let n=0;n<16;n++){const x=-6.4+n*.85+(hash(n+z)-.5)*.3,len=.35+hash(n*3+z)*1.1;if(Math.abs(x)<1.6&&z>-4)continue;const ice=cone(.06+hash(n+2)*.06,len,0xd8eefa,x,4.89-len/2,z,{shine:110,opacity:.88});ice.rotation.x=Math.PI;}}
      for(const side of [-1,1])for(let n=0;n<3;n++){const z=-2.4-n*2.7;hex(.32,4.9,0xcfe6f5,side*3.95,2.35,z,{opacity:.82,shine:120});hex(.42,.3,0xe0f1fa,side*3.95,4.85,z,{shine:90});orb(.6,.22,.45,0xf4faff,side*3.95,.02,z);}
      const bell=(x,y,z,s,phase)=>{const hang=group(x,y,z,layers.middle,'story-frozen-bell');rod(.02,1.4,0x5a6b7a,0,.7,0,{parent:hang});mesh(geometry('bell',()=>new T.CylinderGeometry(.22,.5,.72,20,1)),0x8aa3b4,0,-.36,0,{parent:hang,shine:90}).scale.setScalar(s);orb(.24*s,.12*s,.24*s,0xf4faff,0,-.02,0,{parent:hang});ring(.5*s,.04,0xe0f1fa,0,-.72*s,0,{parent:hang}).rotation.x=Math.PI/2;orb(.07,.07,.07,0x5a6b7a,0,-.72*s,0,{parent:hang});bake(hang);animate(hang,'swing',.55,.05,phase);};
      bell(2.7,3.3,-4.3,1,0);bell(-3.1,3.1,-7.2,.8,1.8);
      for(let n=0;n<14;n++){const side=n%2?1:-1;orb(.8+hash(n)*.6,.18+hash(n+1)*.12,.5+hash(n+2)*.3,0xf4faff,side*(4.6+hash(n+3)*1.8),-.03,-1.2-hash(n+4)*7.6);}
      for(let n=0;n<10;n++){const a=n*.63+.5,r=2.55+hash(n+20)*.4;gem(.05,.14+hash(n+21)*.1,.05,0xe0f1fa,Math.cos(a)*r,.08,-.35+Math.sin(a)*r*.85,{glow:true,opacity:.8});}
      motes(0xffffff,{count:48,kind:'drift',dir:-1,speed:.32,range:.4,size:.095,opacity:.88,additive:false,twinkle:false,low:.02,high:5});
    }else if(id==='clockwork'){
      art('gear-workshop',['meshing-gears','brass-pipes','pistons','workbench','hanging-lamps','steam-puffs','sparks']);
      walls(0x3a312a,0x4a3e33);ground(0x5a4e40,'floor');platform(0x6a5a44,0xb89866,{surface:'ornament'});
      const gear=(x,y,z,r,teeth,color,speed,turn=0)=>{const wheel=group(x,y,z,layers.middle,'story-gear');wheel.rotation.y=turn;ring(r,.09,color,0,0,0,{parent:wheel,shine:70});ring(r*.32,.07,color,0,0,0,{parent:wheel,shine:70});rod(.12,.22,0x6b5438,0,0,0,{parent:wheel}).rotation.x=Math.PI/2;for(let k=0;k<teeth;k++){const a=k/teeth*Math.PI*2;box(.18,.2,.14,color,Math.cos(a)*(r+.14),Math.sin(a)*(r+.14),0,{parent:wheel,shine:70}).rotation.z=a;}for(let k=0;k<5;k++){const a=k/5*Math.PI*2;box(.07,r*.7,.06,color,Math.cos(a)*r*.62,Math.sin(a)*r*.62,0,{parent:wheel,shine:70}).rotation.z=a-Math.PI/2;}bake(wheel);animate(wheel,'gear',speed);return wheel;};
      gear(-3.3,3.7,-10.55,1.6,16,0xb08a52,.12);gear(-.55,4.6,-10.6,1,10,0xc49a5a,-.19);gear(1.95,3.3,-10.55,1.35,14,0x9c7b4a,.142);gear(4.35,4.75,-10.6,.8,8,0xd0a868,-.24);gear(7.1,2.6,-4.6,1.2,12,0xa98450,.1,Math.PI/2);
      for(const y of [1.25,5.9])rod(.09,13.5,0xb08a52,0,y,-10.6,{shine:70}).rotation.z=Math.PI/2;for(const side of [-1,1]){rod(.09,5.2,0xb08a52,side*6.2,2.6,-10.55,{shine:70});orb(.13,.13,.13,0xc49a5a,side*6.2,5.9,-10.55,{shine:70});orb(.13,.13,.13,0xc49a5a,side*6.2,1.25,-10.55,{shine:70});}
      for(const [x,y]of [[-5.2,2.3],[5.3,3.1]]){disc(.26,.05,0xffd58a,x,y,-10.5,{glow:true}).rotation.x=Math.PI/2;ring(.27,.035,0xb08a52,x,y,-10.46,{shine:70});}
      for(const side of [-1,1]){rod(.2,1.2,0x6b5438,side*3.6,.55,-4.3,{shine:40});const piston=rod(.08,1.1,0xc9c2b0,side*3.6,1.2,-4.3,{shine:100});animate(piston,'piston',1.6,.45,side>0?0:Math.PI);box(.5,.12,.5,0x8a6d47,side*3.6,1.8,-4.3,{shine:70});}
      const bench=group(-3.5,0,-2.6);bench.rotation.y=.45;box(1.6,.1,.75,0x6b4f35,0,.8,0,{surface:'stone',parent:bench});for(const [dx,dz]of [[-.7,-.3],[.7,-.3],[-.7,.3],[.7,.3]])box(.08,.8,.08,0x4a3628,dx,.4,dz,{parent:bench});box(.22,.18,.14,0x7a7a7a,.55,.94,-.15,{shine:90,parent:bench});rod(.025,.4,0x8a8a8a,-.2,.88,.05,{shine:90,parent:bench}).rotation.z=Math.PI/2;orb(.16,.16,.16,0xb08a52,-.45,1,-.1,{shine:70,parent:bench});box(.18,.22,.14,0xb08a52,-.45,.79+.25,-.1,{shine:70,parent:bench});
      for(const side of [-1,1]){rod(.012,1.2,0x3a3028,side*1.95,4.5,-2.9);cone(.26,.22,0x8a6d47,side*1.95,3.85,-2.9,{shine:70});orb(.09,.09,.09,0xffd58a,side*1.95,3.74,-2.9,{glow:true});}
      for(const [x,y,z,phase]of [[6.2,6,-10.3,0],[-6.2,1.4,-10.3,1.7],[3.6,1.95,-4.3,3.1]]){const puff=own(flat(.9,.9,0xf2e6d6,x,y,z,{surface:'soft',glow:true,opacity:.34,double:true}));animate(puff,'rise',.28,1.6,phase/5);}
      motes(0xffc96b,{count:26,kind:'drift',dir:1,speed:.75,range:.18,size:.045,opacity:.9,low:.2,high:3.4,width:4});
    }else if(id==='furnace'){
      art(deep?'geothermal-well':'molten-core',deep?['basalt-columns','hot-spring-pools','light-conduits','steam-vents','rising-steam']:['basalt-columns','lava-channels','furnace-core','energy-conduits','rising-embers']);
      walls(0x2a1d1c,0x352523);ground(0x3f2a26,'floor');platform(0x4a3530,deep?0x7fe0d0:0xff8a3a,{glowTrim:true});
      for(let n=0;n<26;n++){const side=n<13?-1:1,k=n%13,x=side*(4.4+(k%4)*.62+hash(n)*.2),z=-1.4-Math.floor(k/4)*2.1-hash(n+1)*.6,h=1.6+hash(n+2)*4.2;hex(.34+hash(n+3)*.16,h,k%2?0x2d2220:0x3a2b28,x,h/2-.08,z,{surface:'stone'});}
      for(let n=0;n<12;n++){const h=2+hash(n+40)*4.6;hex(.42+hash(n+41)*.2,h,0x2d2220,-5.6+n*1.02,h/2-.08,-9.6-hash(n+42),{surface:'stone',parent:far});}
      const molten=deep?0x4fc8b8:0xff6a20;
      for(const side of [-1,1]){const channel=own(flat(.72,9.4,molten,side*2.95,-.062,-4.6,{glow:true}));channel.rotation.x=-Math.PI/2;animate(channel,'glow',1.1,.28,side);for(const dx of [-.42,.42])box(.14,.08,9.4,0x241816,side*2.95+dx,-.05,-4.6,{surface:'stone'});const bloom=own(flat(2.2,9.8,molten,side*2.95,.02,-4.6,{surface:'soft',glow:true,opacity:.38,additive:true}));bloom.rotation.x=-Math.PI/2;animate(bloom,'pulse',1.1,.4,side);}
      const core=group(0,2.5,-8.3,layers.middle,'story-furnace-core');for(let k=0;k<8;k++){const a=k*Math.PI/4;rod(.06,4.2,0x6b4a3a,Math.cos(a)*1.15,0,Math.sin(a)*1.15,{shine:60,parent:core});}for(const y of [-2.05,2.05,0])ring(1.15,.07,0x8a5a3a,0,y,0,{shine:60,parent:core}).rotation.x=Math.PI/2;
      const heat=own(orb(.75,.75,.75,deep?0xffe9b0:0xffb06b,0,2.5,-8.3,{glow:true}));animate(heat,'glow',1.4,.25);const halo=own(flat(4.2,4.2,deep?0xfff0c0:0xff9a4a,0,2.5,-8.2,{surface:'soft',glow:true,opacity:.42,additive:true}));animate(halo,'pulse',1.4,.35);
      for(const y of [1.2,3.8])for(const side of [-1,1]){rod(.11,4.3,0x5a4034,side*3.4,y,-8.3,{shine:60}).rotation.z=Math.PI/2;box(3.6,.03,.05,deep?0x8ff0e0:0xffa040,side*3.4,y+.11,-8.2,{glow:true});}
      if(deep)for(const [x,z,phase]of [[-2.95,-2.6,0],[2.95,-4.4,.35],[-2.95,-6.8,.7]]){const steam=own(flat(1.1,1.1,0xe8fff8,x,.2,z,{surface:'soft',glow:true,opacity:.3,double:true}));animate(steam,'rise',.22,2.4,phase);}
      if(light)animate(light,'flicker',1,deep?.03:.07);
      motes(deep?0xd8fff4:0xffa040,{count:40,kind:'drift',dir:1,speed:deep?.2:.5,range:.3,size:deep?.07:.06,opacity:.9,low:.05,high:5});
    }else{
      art(deep?'primordial-gate':'tower-heart',deep?['ancient-gate','orbiting-rings','floating-stones','light-pillar','moss-carvings','memory-motes']:['homeward-gate','orbiting-rings','floating-stones','light-pillar','inlaid-floor','memory-motes']);
      const stone=deep?0x3c4a44:0x59617a,glow=deep?0x9ff0d8:palette[3];
      walls(deep?0x26302c:0x252c40,deep?0x32403a:0x313a52);ground(deep?0x34403a:0x3a4258,'floor');platform(stone,glow,{surface:'ornament',glowTrim:true,radius:2.4});
      for(let n=0;n<12;n++){const a=n*Math.PI/6,line=box(.04,.012,1.2,glow,Math.cos(a)*1.55,.004,-.35+Math.sin(a)*1.55,{glow:true});line.rotation.y=-a+Math.PI/2;}
      for(const side of [-1,1]){box(.95,5.4,.95,stone,side*2.5,2.6,-7.2,{surface:'stone'});box(1.2,.3,1.2,glow===palette[3]?0x8a8f9f:0x5a6a62,side*2.5,5.4,-7.2,{surface:'ornament'});}
      box(6.2,.7,1.05,stone,0,5.85,-7.2,{surface:'stone'});arch(2.02,.16,stone,0,3.1,-7.2,{surface:'stone'});arch(1.86,.03,glow,0,3.1,-6.68,{glow:true});
      const gate=own(flat(3.7,5.1,glow,0,2.55,-7.15,{surface:'soft',glow:true,opacity:.85,additive:true}));animate(gate,'pulse',.6,.35);
      const beam=own(rod(.85,9.5,glow,0,4.6,-7.6,{glow:true,opacity:.2,additive:true}));animate(beam,'pulse',.45,.4,1.2);
      for(let n=0;n<3;n++){const halo=own(ring([1.25,1.6,1.95][n],.032,n===1?0xffffff:glow,0,2.75,-6.5,{glow:true,opacity:.8}));animate(halo,'tumble',[.21,-.16,.12][n],0,n*1.7);}
      const stones=group(0,0,-6.4,layers.middle,'story-orbiting-stones');for(let n=0;n<7;n++){const a=n/7*Math.PI*2,r=3+hash(n)*.5;gem(.18+hash(n+1)*.12,.24+hash(n+2)*.14,.18,stone,Math.cos(a)*r,1.4+hash(n+3)*2.6,Math.sin(a)*r*.6,{surface:'stone',parent:stones});}bake(stones);animate(stones,'orbit',.09,.12);
      if(deep)for(let n=0;n<10;n++)orb(.5+hash(n)*.4,.06,.35,0x4f6b46,(n%2?1:-1)*(3.2+hash(n+5)*2.4),-.04,-1.4-hash(n+6)*6);
      for(const side of [-1,1]){hex(.3,1,stone,side*4.2,.45,-3,{surface:'stone'});orb(.16,.2,.16,glow,side*4.2,1.15,-3,{glow:true});}
      motes(deep?0xbff8e6:0xffe7a8,{count:40,kind:'drift',dir:1,speed:.16,range:.45,size:.065,opacity:.85,low:.1,high:5.4});
    }
  }
  // Object3D.clone serializes userData and cannot handle the game's circular
  // face/rig references. Clone the tree manually, borrowing its GPU resources,
  // then remap logical references only after every cloned node is known.
  function borrowTree(T,source){
    if(!source?.isObject3D)return null;
    const nodes=new Map();
    function copyNode(original){
      let copy;
      if(original.isSprite){copy=new T.Sprite(original.material);copy.geometry=original.geometry;}
      else if(original.isPoints)copy=new T.Points(original.geometry,original.material);
      else if(original.isLineSegments)copy=new T.LineSegments(original.geometry,original.material);
      else if(original.isLine)copy=new T.Line(original.geometry,original.material);
      else if(original.isInstancedMesh){copy=new T.InstancedMesh(original.geometry,original.material,original.count);copy.instanceMatrix=original.instanceMatrix;copy.instanceColor=original.instanceColor;}
      else if(original.isMesh)copy=new T.Mesh(original.geometry,original.material);
      else copy=original.isGroup?new T.Group():new T.Object3D();
      nodes.set(original,copy);copy.name=original.name;copy.position.copy(original.position);copy.rotation.order=original.rotation.order;copy.quaternion.copy(original.quaternion);copy.scale.copy(original.scale);
      copy.visible=original.visible;copy.frustumCulled=original.frustumCulled;copy.renderOrder=original.renderOrder;copy.castShadow=false;copy.receiveShadow=false;copy.matrixAutoUpdate=original.matrixAutoUpdate;copy.matrix.copy(original.matrix);
      copy.layers.mask=original.layers.mask;
      for(const child of original.children){if(child.isLight||child.isCamera)continue;copy.add(copyNode(child));}
      return copy;
    }
    const model=copyNode(source),seen=new WeakMap();
    function remap(value){
      if(!value||typeof value!=='object')return value;
      if(value.isObject3D)return nodes.get(value)||null;
      if(value.isBufferGeometry||value.isMaterial||value.isTexture)return value;
      if(seen.has(value))return seen.get(value);
      if(value.isVector2||value.isVector3||value.isVector4||value.isEuler||value.isQuaternion||value.isMatrix3||value.isMatrix4||value.isColor){const out=value.clone();seen.set(value,out);return out;}
      if(value instanceof Set){const out=new Set();seen.set(value,out);for(const item of value)out.add(remap(item));return out;}
      if(value instanceof Map){const out=new Map();seen.set(value,out);for(const [key,item]of value)out.set(remap(key),remap(item));return out;}
      if(ArrayBuffer.isView(value)){const out=value.slice();seen.set(value,out);return out;}
      const out=Array.isArray(value)?[]:{};seen.set(value,out);for(const key of Object.keys(value))out[key]=remap(value[key]);return out;
    }
    for(const [original,copy]of nodes)copy.userData=remap(original.userData);
    model.userData.storyTheaterActor=true;model.userData.borrowedStoryHero=true;return model;
  }
  function storyHeadRig(T,model){
    const data=model.userData,oldHead=data.head;if(!oldHead?.isMesh||oldHead.parent!==model)return;
    const head=new T.Group();head.name='cinema-head';head.position.copy(oldHead.position);
    const face=data.face||{},facial=new Set([face.mouth,face.teeth,...['eyes','brows','lips','lids','cheeks','whites','corners'].flatMap(key=>face[key]||[])]);
    const bones=new Set([data.body,data.armL,data.armR,data.legL,data.legR]);
    const pieces=model.children.filter(node=>node===oldHead||facial.has(node)||!bones.has(node)&&(/hair|fringe|hat|bun|braid|spectacle|brow|beard|nose|goggle/.test(node.name)||node.isMesh&&node.position.y>=head.position.y-.17));
    model.add(head);
    // These were direct children of this fresh actor. An identity pivot plus a
    // position subtraction preserves every authored shape, scale and rotation;
    // only subsequent head gestures move hats/hair/facial details together.
    for(const piece of pieces){piece.position.sub(head.position);head.add(piece);}
    data.headMesh=oldHead;data.head=head;if(data.face){face.rig=head;face.headY=0;if(Number.isFinite(face.browY))face.browY-=head.position.y;}
    data.cinemaRig={head,torso:data.body,arms:[data.armL,data.armR],legs:[data.legL,data.legR],mouth:face.mouth,eyes:face.eyes||[],brows:face.brows||[]};
  }
  function colorLian(model,retired){
    const clones=new Map(),originals=new Set(),clothing=new Set(model.userData.baseClothing||[]);
    model.traverse(node=>{
      const color=/hair|braid/.test(node.name)||node.userData.continuousHair?0xddebe8:node===model.userData.body||clothing.has(node)||node.userData.baseClothing||/sleeve|cuff|skirt|tunic|cape|robe/.test(node.name)?0x337f83:null;
      if(color===null||!node.material)return;
      const recolor=mat=>{if(!mat?.color)return mat;let byColor=clones.get(mat);if(!byColor){byColor=new Map();clones.set(mat,byColor);}if(!byColor.has(color)){const copy=mat.clone();copy.color.setHex(color);byColor.set(color,copy);}originals.add(mat);return byColor.get(color);};
      node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
    });
    const used=new Set();model.traverse(node=>{for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat)used.add(mat);});
    for(const mat of originals)if(!used.has(mat))retired.add(mat);
    model.userData.storyIdentityPalette='lian-teal-silver';
  }
  function create({THREE:T,hero,heroJob='swordsman',heroSex='male',heroName='旅人',buildActor,buildStoryActor,dispose,environment,floor=99,reduced=false}={}){
    if(!T?.Scene||!T?.Mesh)return null;
    const id=environmentId(environment,floor),palette=PALETTES[id],look=LOOKS[id],deep=Number(floor)<0,scene=new T.Scene(),owned=new Set(),motion=[];
    // Every region now has an authored film stage; the summit keeps its approved
    // opening choreography and every other page uses the editorial planner.
    const premium=true,summit=id==='cloud';scene.name='story-theater';scene.userData.storyTheater=true;scene.userData.environment=id;scene.userData.underworld=deep;scene.userData.cinematicPreview=premium;scene.background=new T.Color(look.background);scene.fog=new T.Fog(look.background,look.fog[0],look.fog[1]);
    const ambient=new T.AmbientLight(look.ambient[0],look.ambient[1]),keyLight=new T.HemisphereLight(look.hemi[0]??palette[3],look.hemi[1]??palette[0],look.hemi[2]);scene.add(ambient,keyLight);
    const cinemaLight=new T.DirectionalLight(look.key[0],look.key[1]);cinemaLight.name='story-key-light';cinemaLight.position.set(look.key[2],look.key[3],look.key[4]);cinemaLight.castShadow=false;scene.add(cinemaLight);
    const set=scenery(T,id,palette,scene,owned,motion,{deep,light:cinemaLight});scene.userData.storyArtDirection=set.userData.storyArtDirection;
    let lookSession=null;try{lookSession=globalThis.TowerCinematicLook?.create?.({THREE:T})||null;}catch{/* Optional film finish: retain the original actor if unavailable. */}
    const anchor=new T.Object3D();anchor.name='story-environment-focus';anchor.position.set(0,0,-.5);scene.add(anchor);
    function buildOwned(spec,factory=buildActor){
      if(typeof factory!=='function')return null;
      let model;try{model=factory(spec);}catch{return null;}
      // A builder must return a fresh, unattached actor. Never steal an active
      // gameplay actor, the supplied hero, or a previously staged character.
      return model?.isObject3D&&model!==hero&&!model.parent?model:null;
    }
    function releaseOwned(model){
      if(!model)return;scene.remove(model);
      if(typeof dispose==='function'){dispose(model);return;}
      const resources=new Set();model.traverse(node=>{if(node.geometry&&!node.isSprite)resources.add(node.geometry);for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat){resources.add(mat);for(const value of Object.values(mat))if(value?.isTexture)resources.add(value);}});for(const resource of resources)resource.dispose?.();
    }
    let heroModel=borrowTree(T,hero),ownsHero=false,heroLook=null,npcLook=null;
    if(!heroModel){heroModel=buildOwned({job:heroJob||'swordsman',sex:heroSex==='female'?'female':'male',name:heroName||'旅人'});ownsHero=!!heroModel;}
    if(heroModel){heroModel.userData.storyTheaterActor=true;heroModel.userData.ownedStoryHero=ownsHero;heroModel.position.set(-.9,look.lift,.45);heroModel.rotation.set(0,.17,0);heroModel.visible=true;scene.add(heroModel);heroLook=lookSession?.apply?.(heroModel)||null;}
    const contact=[];{let soft;for(const resource of owned)if(resource.isTexture&&resource.name==='story-soft-surface')soft=resource;const g=new T.PlaneGeometry(1.5,1.1),mat=new T.MeshBasicMaterial({color:0x111c28,map:soft,transparent:true,opacity:.32,depthWrite:false});owned.add(g);owned.add(mat);for(let n=0;n<2;n++){const part=new T.Mesh(g,mat);part.name='story-actor-contact-shadow';part.rotation.x=-Math.PI/2;part.position.set(n?.95:-.9,look.contact,n?-.05:.45);part.visible=n===0&&!!heroModel;contact.push(part);set.add(part);}scene.userData.storySceneryBudget=Object.freeze({...scene.userData.storySceneryBudget,drawables:scene.userData.storySceneryBudget.drawables+2,triangles:scene.userData.storySceneryBudget.triangles+4});}
    let npc=null,npcName='',target=heroModel||anchor,active=true,scriptedHero=false,filmProps=null,pageProps=null,heldFrom=Infinity;
    const pageVisibility=[];scene.userData.storyActionPlan=null;
    const heroBody=heroModel?.userData?.body,heroHead=heroModel?.userData?.head,heroRest=heroModel?{bodyY:heroBody?.scale.y||1,hx:heroHead?.rotation.x||0,hy:heroHead?.rotation.y||0}:null;
    function releaseNpc(){if(!npc)return;npcLook?.restore?.();npcLook=null;releaseOwned(npc);npc=null;npcName='';if(contact[1])contact[1].visible=false;}
    function resetPageProps(){
      for(const row of pageVisibility)row.part.visible=row.visible;pageVisibility.length=0;heldFrom=Infinity;pageProps=null;scriptedHero=false;scene.userData.storyActionPlan=null;
      if(filmProps){for(const part of filmProps.parts){part.parent?.remove(part);part.visible=false;}scene.remove(filmProps.warm);}
    }
    function ensureFilmProps(){
      if(filmProps)return filmProps;
      const material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}),warmMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false,colorWrite:false});owned.add(material);owned.add(warmMaterial);
      const positions=[],colors=[];
      const quad=(x,y,w,h,z,color)=>{const tint=new T.Color(color);for(const [dx,dy]of [[-1,-1],[1,-1],[-1,1],[1,-1],[1,1],[-1,1]]){const px=x+dx*w/2;positions.push(px,y+dy*h/2,z+(Math.abs(px)<.00001?.024:0));colors.push(tint.r,tint.g,tint.b);}};
      quad(-.125,0,.25,.31,0,0xe4d5ae);quad(.125,0,.25,.31,0,0xf0e4c8);quad(-.07,.055,.2,.013,.045,0x48746b);quad(.03,.012,.014,.1,.045,0x48746b);quad(.09,-.045,.13,.013,.045,0x48746b);
      const paper=new T.BufferGeometry();paper.setAttribute('position',new T.Float32BufferAttribute(positions,3));paper.setAttribute('color',new T.Float32BufferAttribute(colors,3));paper.computeBoundingSphere();owned.add(paper);
      const copper=new T.TorusGeometry(.105,.023,6,20,Math.PI),thread=new T.CylinderGeometry(.009,.009,.14,5);
      for(const [geometry,color]of [[copper,0xbb7f45],[thread,0xa7504c]]){const tint=new T.Color(color),attribute=new Float32Array(geometry.attributes.position.count*3);for(let n=0;n<attribute.length;n+=3){attribute[n]=tint.r;attribute[n+1]=tint.g;attribute[n+2]=tint.b;}geometry.setAttribute('color',new T.BufferAttribute(attribute,3));owned.add(geometry);}
      const map=()=>{const part=new T.Mesh(paper,material);part.name='story-film-map';part.userData.storyFilmProp='map';return part;},eveMap=map(),heroMap=map(),fragment=new T.Group();fragment.name='story-film-copper';fragment.userData.storyFilmProp='copper';fragment.add(new T.Mesh(copper,material));const redThread=new T.Mesh(thread,material);redThread.position.set(-.065,.025,.015);redThread.rotation.z=.4;fragment.add(redThread);
      // Pre-upload shared prop geometries before their first narrative reveal.
      // These zero-alpha, color-write-disabled meshes can never expose a prop.
      const warm=new T.Group();warm.name='story-film-prop-prewarm';for(const geometry of [paper,copper,thread]){const part=new T.Mesh(geometry,warmMaterial);part.frustumCulled=false;part.position.y=-20;part.renderOrder=-1000;warm.add(part);}
      filmProps={eveMap,heroMap,fragment,warm,parts:[eveMap,heroMap,fragment]};return filmProps;
    }
    function heldItems(actor){
      for(const part of actor?.userData?.heroPieces||[]){if(part.userData.baseKind==='robot_fists')continue;let parent=part.parent,held=part.userData.baseKind==='spellbook';while(parent&&parent!==actor){if(parent===actor.userData.armL||parent===actor.userData.armR)held=true;parent=parent.parent;}if(held)pageVisibility.push({part,visible:part.visible,held:true});}
    }
    function mountProp(part,actor,hand){
      const bowHand=actor?.userData?.bowArms?.[hand==='armL'?'left':'right']?.hand,arm=bowHand||actor?.userData?.[hand];if(!arm)return false;
      part.position.set(0,bowHand?.02:-.34,.22);part.rotation.set(hand==='armL'?-.4:-.75,0,hand==='armL'?.1:0);part.visible=false;arm.add(part);return true;
    }
    function configureProps(index){
      const props=ensureFilmProps();scene.add(props.warm);pageProps=props;
      if(index===1){const originalMap=npc?.getObjectByName('unfolded-map');if(originalMap){pageVisibility.push({part:originalMap,visible:originalMap.visible,held:false});originalMap.visible=false;}if(mountProp(props.eveMap,npc,'armL')){props.eveMap.position.z=.07;props.eveMap.rotation.x=.7;}mountProp(props.heroMap,heroModel,'armL');heldFrom=11/SUMMIT_NARRATION_RATE;heldItems(heroModel);}
      else if(index===2){mountProp(props.fragment,heroModel,'armR');props.fragment.visible=!!props.fragment.parent;heldFrom=0;heldItems(heroModel);}
    }
    function frame(time){
      if(!active||!Number.isFinite(time))return false;const t=Math.max(0,time);
      if(pageProps){if(pageProps.eveMap.parent)pageProps.eveMap.visible=t>=11/SUMMIT_NARRATION_RATE&&t<15/SUMMIT_NARRATION_RATE;if(pageProps.heroMap.parent)pageProps.heroMap.visible=t>=15/SUMMIT_NARRATION_RATE;if(pageProps.fragment.parent)pageProps.fragment.visible=true;for(const row of pageVisibility)if(row.held)row.part.visible=t<heldFrom&&row.visible;}
      if(reduced)return true;
      // The director owns the speaking/featured actor's joints. Only the other
      // character breathes here; no second controller fights the same rig.
      if(heroModel&&target!==heroModel&&!scriptedHero){if(heroBody)heroBody.scale.y=heroRest.bodyY*(1+Math.sin(t*1.6)*.004);if(heroHead){heroHead.rotation.x=heroRest.hx+Math.sin(t*.7)*.018;heroHead.rotation.y=heroRest.hy+Math.sin(t*.53)*.018;}}
      // Every kind below rewrites retained transforms, colors or vertex values
      // from the absolute story clock: deterministic, reversible, allocation-free.
      for(const track of motion){const p=track.part,kind=track.kind,wave=Math.sin(t*track.speed);
        if(kind==='turn'||kind==='gear')p.rotation.z=track.rz+t*track.speed;else if(kind==='cloth'){
        // Two tiny retained vertex grids: the stitched upper edge stays fixed,
        // while analytic normals follow the cloth without per-frame objects.
        const pos=p.geometry.attributes.position,normal=p.geometry.attributes.normal;
        for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),weight=(1.05-y)/2.1,phase=t*track.speed+x*4-y*2.8+p.position.x,sine=Math.sin(phase),cosine=Math.cos(phase),dx=track.range*weight*weight*cosine*4,dy=track.range*(-2*weight/2.1*sine-weight*weight*cosine*2.8),length=Math.hypot(dx,dy,1);pos.setZ(i,track.range*weight*weight*sine);normal.setXYZ(i,-dx/length,-dy/length,1/length);}pos.needsUpdate=true;normal.needsUpdate=true;
        }else if(kind==='cloud')p.position.x=track.x+wave*track.range;else if(kind==='water')p.scale.y=1+wave*track.range;else if(kind==='leaf')p.rotation.z=track.rz+wave*track.range;else if(kind==='ember')p.scale.y=.12*(1+wave*.15);
        else if(kind==='drift'||kind==='wander'){
          // Falling/rising motes wrap inside their band; wandering motes circle home.
          const pos=p.geometry.attributes.position,base=track.base,span=track.span,low=track.low;
          for(let i=0;i<pos.count;i++){const j=i*3,seed=i*1.618+track.phase;
            if(kind==='drift'){let y=base[j+1]-low+t*track.speed*(.7+(i%5)*.12)*track.dir;y-=Math.floor(y/span)*span;pos.setXYZ(i,base[j]+Math.sin(t*.9+seed)*track.range,low+y,base[j+2]+Math.cos(t*.7+seed*1.3)*track.range*.7);}
            else pos.setXYZ(i,base[j]+Math.sin(t*track.speed*.8+seed)*track.range,base[j+1]+Math.sin(t*track.speed*1.1+seed*2.1)*track.range*.6,base[j+2]+Math.cos(t*track.speed*.6+seed*1.7)*track.range);}
          pos.needsUpdate=true;if(track.twinkle)p.material.opacity=track.opacity*(.78+.22*Math.sin(t*2.3+track.phase));
        }else if(kind==='sway'){const phase=t*track.speed+track.phase;p.rotation.z=track.rz+Math.sin(phase)*track.range;p.rotation.x=track.rx+Math.sin(phase*.71+1.3)*track.range*.45;}
        else if(kind==='swing')p.rotation.z=track.rz+Math.sin(t*track.speed+track.phase)*track.range;
        else if(kind==='bob'){p.position.y=track.y+Math.sin(t*track.speed+track.phase)*track.range;p.rotation.y=track.ry+Math.sin(t*track.speed*.5+track.phase)*.3;}
        else if(kind==='pulse')p.material.opacity=track.opacity*(1-track.range*(.5+.5*Math.sin(t*track.speed+track.phase)));
        else if(kind==='glow'){const k=1-track.range*(.5+.5*Math.sin(t*track.speed+track.phase));p.material.color.setRGB(track.cr*k,track.cg*k,track.cb*k);}
        else if(kind==='ripple'){const u=((t*track.speed+track.phase)%1+1)%1,s=1+u*track.range;p.scale.set(track.sx*s,track.sy*s,track.sz);p.material.opacity=track.opacity*(1-u)*Math.min(1,u*8);}
        else if(kind==='rise'){const u=((t*track.speed+track.phase)%1+1)%1,s=1+u*.9;p.position.y=track.y+u*track.range;p.scale.set(track.sx*s,track.sy*s,track.sz);p.material.opacity=track.opacity*Math.sin(u*Math.PI);}
        else if(kind==='flip'){const u=((t*track.speed+track.phase)%1+1)%1,e=Math.min(1,u/.5);p.rotation.z=e*e*(3-2*e)*Math.PI*.97;p.visible=u<.88;}
        else if(kind==='tumble'){p.rotation.x=track.rx+t*track.speed+track.phase;p.rotation.y=track.ry+t*track.speed*.63;}
        else if(kind==='orbit'){p.rotation.y=track.ry+t*track.speed;p.position.y=track.y+Math.sin(t*.5+track.phase)*track.range;}
        else if(kind==='piston')p.position.y=track.y+(Math.sin(t*track.speed+track.phase)*.5+.5)*track.range;
        else if(kind==='flutter'){const a=t*track.speed+track.phase,flap=.25+.75*Math.abs(Math.sin(t*13+track.phase));p.position.set(track.x+Math.sin(a*.47)*track.range,track.y+Math.sin(a*1.13)*.22,track.z+Math.sin(a*.31+track.phase)*track.range*.6);p.rotation.y=track.ry+Math.cos(a*.47)*.9;if(p.children[0])p.children[0].rotation.z=flap;if(p.children[1])p.children[1].rotation.z=-flap;}
        else if(kind==='flicker')p.intensity=track.intensity*(1+(Math.sin(t*7.3+track.phase)*.6+Math.sin(t*12.9+track.phase+1.7)*.4)*track.range);
        else p.position.y=track.y+wave*track.range;}
      return true;
    }
    function page(spec={}){
      if(!active)return null;
      resetPageProps();
      const text=String(spec.text??spec.entry?.paragraphs?.[Number(spec.page)||0]??''),name=personIn(text);
      if(name&&name!==npcName&&(typeof buildActor==='function'||typeof buildStoryActor==='function')){
        releaseNpc();const appearance=PEOPLE[name];
        npc=appearance.id&&typeof buildStoryActor==='function'?buildOwned({id:appearance.id,job:appearance.job,sex:appearance.sex,name},buildStoryActor):null;
        if(!npc)npc=buildOwned({job:appearance.job,sex:appearance.sex,name});
        if(npc){storyHeadRig(T,npc);if(name==='璃安')colorLian(npc,owned);npcName=name;npc.name='story-'+name;npc.userData.storyTheaterActor=true;npc.userData.storyIdentity=name;npc.position.set(.95,id==='cloud'?.2:0,-.05);npc.rotation.set(0,-.19,0);npc.visible=true;scene.add(npc);npcLook=lookSession?.apply?.(npc)||null;}
      }
      if(npc)npc.visible=!!name&&name===npcName;if(contact[1])contact[1].visible=!!npc?.visible;
      target=name&&npc?.visible?npc:heroModel||anchor;
      const index=Math.max(0,Number(spec.page)||0),focus=new T.Vector3(target===anchor?0:target.position.x*.4,1.35,-.1),goal=new T.Vector3((index%3-1)*.52,2.08,5.6);let shot={focus,goal};
      if(premium){const opening=index===0&&!name;focus.set(name?.25:0,opening?1.25:1.4,opening?-.45:-.2);goal.set(opening?.4:(index%3-1)*.42,opening?2.45:2.15,opening?6:5.7);shot={focus,goal,focusTo:new T.Vector3(name?.3:0,opening?1.4:1.42,-.25),goalTo:new T.Vector3(opening?.15:name?-.1:.1,opening?2.2:2.05,opening?5.5:5.2),fov:opening?56:name?48:52,duration:15,edition:'preview',kind:opening?'summit-reveal':name?'two-person-dialogue':'summit-discovery',cuts:summitCuts(T,index,heroModel,npc?.visible?npc:null,name)};}
      let actorTracks,directedPerformance;
      const exactArrival=summit&&Number(floor)===99&&spec.entry?.id==='scene:99'&&index<3&&text===spec.entry.paragraphs?.[index];
      if(exactArrival){
        const authored=SUMMIT_ACTING[index],tracks=[];
        if(heroModel)tracks.push(Object.freeze({actor:heroModel,identity:'hero',performance:'thoughtful',personality:id,speechAnimation:false,idleLife:false,beats:authored.hero}));
        if(authored.eve&&npc?.visible&&name==='伊芙')tracks.push(Object.freeze({actor:npc,identity:'伊芙',performance:index===1?'guide':'reflective',personality:id,speechAnimation:false,idleLife:false,beats:authored.eve}));
        actorTracks=Object.freeze(tracks);scriptedHero=!!heroModel;configureProps(index);
        const props=index===1?[{kind:'map',identity:'伊芙',at:11/SUMMIT_NARRATION_RATE,duration:4/SUMMIT_NARRATION_RATE},{kind:'map',identity:'hero',at:15/SUMMIT_NARRATION_RATE,duration:(authored.sourceDuration-15)/SUMMIT_NARRATION_RATE}]:index===2?[{kind:'copper',identity:'hero',at:0,duration:authored.sourceDuration/SUMMIT_NARRATION_RATE}]:[];
        scene.userData.storyActionPlan=Object.freeze({pageIndex:index,narrationRate:SUMMIT_NARRATION_RATE,sourceDuration:authored.sourceDuration,duration:authored.sourceDuration/SUMMIT_NARRATION_RATE,tracks:Object.freeze(tracks.map(track=>Object.freeze({identity:track.identity,beats:track.beats}))),props:Object.freeze(props.map(prop=>Object.freeze(prop)))});
      }else if(premium){
        // Later objectives need their own acting, not the opening's wake-up,
        // map hand-off or copper reveal. The planner only sees this paragraph.
        const direction=globalThis.TowerStoryDirection?.plan?.({THREE:T,hero:heroModel,npc:npc?.visible?npc:null,text,environment:id,page:index,name:name&&npc?.visible?name:''});
        if(direction){shot=direction.shot;actorTracks=direction.actorTracks;directedPerformance=direction.performance;scriptedHero=!!actorTracks?.some(track=>track.actor===heroModel);scene.userData.storyActionPlan=direction.actionPlan;}
      }
      // The supplied paragraph is an entire narration track with embedded
      // quotations. Never incorrectly lip-sync that whole track to an NPC.
      return {target,actor:target===anchor?null:target,actorTracks,performance:directedPerformance||performance(text,premium),personality:id,speechAnimation:false,shot,scene,frame,text,title:spec.title??spec.entry?.title??'',entry:spec.entry,page:index};
    }
    function release(){
      if(!active)return false;active=false;resetPageProps();releaseNpc();heroLook?.restore?.();heroLook=null;lookSession?.dispose?.();lookSession=null;for(const resource of owned)resource.dispose();owned.clear();motion.length=0;
      if(ownsHero)releaseOwned(heroModel);else if(heroModel)scene.remove(heroModel);scene.remove(set,anchor,ambient,keyLight);if(cinemaLight)scene.remove(cinemaLight);set.clear();return true;
    }
    return Object.freeze({page,frame,dispose:release,scene,get active(){return active;},get hero(){return heroModel;}});
  }
  return Object.freeze({create,PEOPLE,PALETTES});
});
