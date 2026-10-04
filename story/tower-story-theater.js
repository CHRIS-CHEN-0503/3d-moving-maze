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
  // The film stage deliberately has its own art direction. All surfaces are
  // authored here, with tiny deterministic textures and no downloaded media.
  // Static scenery is baked by surface and depth layer before the first frame;
  // the animation loop only changes transforms of the few retained props.
  function scenery(T,id,palette,scene,owned,motion){
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
        }else{
          const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=u*u+v*v;
          shade=1;alpha=Math.round(Math.max(0,Math.exp(-r*4.8)-.012)*255);
        }
        const value=Math.max(0,Math.min(255,Math.round(shade*255)));pixels[at]=value;pixels[at+1]=value;pixels[at+2]=value;pixels[at+3]=alpha;
      }
      const tex=new T.DataTexture(pixels,size,size,T.RGBAFormat);tex.name='story-'+kind+'-surface';tex.needsUpdate=true;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;
      if(kind!=='soft'){tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(kind==='floor'?3:2,kind==='floor'?3:2);tex.colorSpace=T.SRGBColorSpace;}else{tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;tex.generateMipmaps=false;tex.minFilter=T.LinearFilter;}
      textures.push(tex);owned.add(tex);return tex;
    };
    const maps={stone:texture('stone'),floor:texture('floor'),ornament:texture('ornament'),soft:texture('soft',128)};
    const material=(color,options={})=>{
      const {surface='',glow=false,opacity=1,shine=surface==='ornament'?55:10}=options,key=[color,surface,glow,opacity,shine].join(':');
      if(!mats.has(key)){const params={color,map:maps[surface]||null,transparent:opacity<1,opacity,depthWrite:opacity===1,side:options.double?T.DoubleSide:T.FrontSide};const mat=glow?new T.MeshBasicMaterial(params):new T.MeshPhongMaterial({...params,specular:0x33404c,shininess:shine});mat.userData.storySurface=surface;owned.add(mat);mats.set(key,mat);}return mats.get(key);
    };
    const mesh=(g,color,x,y,z,options={})=>{owned.add(g);const part=new T.Mesh(g,material(color,options));part.position.set(x,y,z);part.name=options.name||'story-scenery-piece';(options.parent||layers.middle).add(part);part.castShadow=false;part.receiveShadow=false;return part;};
    const box=(w,h,d,color,x,y,z,options={})=>{const p=mesh(geometry('box',()=>new T.BoxGeometry(1,1,1)),color,x,y,z,options);p.scale.set(w,h,d);return p;};
    const orb=(rx,ry,rz,color,x,y,z,options={})=>{const p=mesh(geometry('orb',()=>new T.SphereGeometry(1,18,12)),color,x,y,z,options);p.scale.set(rx,ry,rz);return p;};
    const rod=(r,h,color,x,y,z,options={})=>{const p=mesh(geometry('rod',()=>new T.CylinderGeometry(1,1,1,12)),color,x,y,z,options);p.scale.set(r,h,r);return p;};
    const cone=(r,h,color,x,y,z,options={})=>{const p=mesh(geometry('cone',()=>new T.ConeGeometry(1,1,8)),color,x,y,z,options);p.scale.set(r,h,r);return p;};
    const ring=(r,t,color,x,y,z,options={})=>mesh(geometry('ring-'+r+'-'+t,()=>new T.TorusGeometry(r,t,6,48)),color,x,y,z,options);
    const animate=(part,kind,speed=1,range=.05)=>{part.userData.storyDynamic=true;motion.push({part,kind,speed,range,x:part.position.x,y:part.position.y,z:part.position.z,rx:part.rotation.x,ry:part.rotation.y,rz:part.rotation.z,sx:part.scale.x,sy:part.scale.y,sz:part.scale.z,opacity:part.material?.opacity??1});return part;};
    function bake(group){
      group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),groups=new Map(),toRemove=[];
      group.traverse(part=>{
        if(!part.isMesh||part.userData.storyDynamic||part.userData.storyUnbatched)return;let ancestor=part.parent;while(ancestor&&ancestor!==group){if(ancestor.userData.storyDynamic)return;ancestor=ancestor.parent;}
        const mat=part.material;if(Array.isArray(mat))return;
        const key=[mat.type,mat.map?.uuid||'',mat.opacity,mat.side,mat.shininess||0].join(':'),entry=groups.get(key)||{mat,parts:[]};entry.parts.push({part,matrix:inverse.clone().multiply(part.matrixWorld)});groups.set(key,entry);toRemove.push(part);
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
    // Continuous floor and a readable foreground path ground the characters;
    // decorative edges frame them, without a floating circular display plinth.
    box(19,.24,17,palette[1],0,-.2,-3.5,{surface:'floor',parent:layers.near,name:'story-carved-floor'});
    for(let n=0;n<7;n++)box(2.7,.035,1.1,0x979b9b,0,-.045,-1-n*1.1,{surface:'floor'});
    for(const side of [-1,1]){box(.25,.2,13,palette[2],side*5.4,-.045,-3.3,{surface:'ornament'});box(.55,.28,.75,palette[1],side*3.6,.03,1.1,{surface:'stone',parent:layers.near});}
    const outdoor=id==='cloud'||id==='garden'||id==='mist';
    if(outdoor){
      const g=geometry('sky',()=>new T.SphereGeometry(22,28,16)),colors=new Float32Array(g.attributes.position.count*3),top=new T.Color(0x88bbd8),bottom=new T.Color(0xd2e8f3);for(let n=0;n<g.attributes.position.count;n++){const mix=Math.max(0,Math.min(1,(g.attributes.position.getY(n)/22+.17)*1.35));colors[n*3]=bottom.r+(top.r-bottom.r)*mix;colors[n*3+1]=bottom.g+(top.g-bottom.g)*mix;colors[n*3+2]=bottom.b+(top.b-bottom.b)*mix;}g.setAttribute('color',new T.BufferAttribute(colors,3));const skyMat=new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false});owned.add(skyMat);const sky=new T.Mesh(g,skyMat);sky.name='story-gradient-sky';sky.userData.storyUnbatched=true;sky.position.y=4;layers.far.add(sky);
      ridge(-20,4.3,0xaccbb0,.8);ridge(-17.8,3.5,0x82ad84,2.1);ridge(-14.6,2.7,0x588b61,4.5);
    }else{box(20,8,.5,palette[0],0,3.75,-10,{surface:'stone',parent:layers.far});for(const side of [-1,1])box(.65,6.5,14,palette[1],side*7.5,3,-5,{surface:'stone',parent:layers.far});}
    if(id==='cloud'){
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
    }
    for(const layer of Object.values(layers))bake(layer);
    let drawables=0,triangles=0;set.traverse(n=>{if(n.isMesh||n.isPoints){drawables++;if(n.isMesh)triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
    scene.userData.storySceneryBudget=Object.freeze({drawables,triangles,textures:textures.length,textureBytes:textures.reduce((sum,tex)=>sum+tex.image.data.byteLength,0),maxTextureSize:256});
    scene.userData.storyMotionTracks=Object.freeze(motion.map(track=>Object.freeze({name:track.part.name,kind:track.kind})));return set;
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
  // Non-cloud regions keep their own released stage designs. In particular,
  // later cloud floors must never fall back to this featureless prototype.
  function legacyScenery(T,id,palette,scene,owned,motion){
    const set=new T.Group();set.name='story-theater-environment';scene.add(set);
    const mats=new Map(),material=(color,glow=false,opacity=1)=>{const key=color+':'+glow+':'+opacity;if(!mats.has(key)){const mat=glow?new T.MeshBasicMaterial({color,transparent:opacity<1,opacity}):new T.MeshLambertMaterial({color,transparent:opacity<1,opacity});mats.set(key,mat);owned.add(mat);}return mats.get(key);};
    const mesh=(geometry,color,x,y,z,{glow=false,opacity=1,parent=set}={})=>{owned.add(geometry);const part=new T.Mesh(geometry,material(color,glow,opacity));part.position.set(x,y,z);parent.add(part);return part;};
    const box=(w,h,d,color,x,y,z,options)=>mesh(new T.BoxGeometry(w,h,d),color,x,y,z,options);
    const orb=(rx,ry,rz,color,x,y,z,options)=>{const part=mesh(new T.SphereGeometry(1,10,7),color,x,y,z,options);part.scale.set(rx,ry,rz);return part;};
    const rod=(r,h,color,x,y,z,options)=>mesh(new T.CylinderGeometry(r,r,h,10),color,x,y,z,options);
    const animate=(part,kind,speed=1,range=.05)=>{motion.push({part,kind,speed,range,x:part.position.x,y:part.position.y,z:part.position.z,rx:part.rotation.x,ry:part.rotation.y,rz:part.rotation.z,sx:part.scale.x,sy:part.scale.y,sz:part.scale.z,opacity:part.material?.opacity??1});return part;};
    mesh(new T.CylinderGeometry(4.4,4.6,.22,24),palette[1],0,-.12,0);box(13,.14,12,palette[1],0,-.28,-1);
    for(const side of [-1,1]){box(.45,3.7,.5,palette[1],side*3.8,1.55,-3.5);box(.52,.16,.65,palette[2],side*3.8,3.3,-3.5);}
    if(id==='cloud'){
      mesh(new T.CylinderGeometry(1.65,1.85,.26,16),palette[1],0,.06,-.35);const summon=mesh(new T.TorusGeometry(1.3,.027,5,36),palette[2],0,.21,-.35,{glow:true});summon.rotation.x=Math.PI/2;animate(summon,'turn',.065);const inner=mesh(new T.TorusGeometry(.9,.018,4,30),palette[3],0,.212,-.35,{glow:true});inner.rotation.x=Math.PI/2;animate(inner,'turn',-.085);
      for(let n=0;n<5;n++){const glyph=box(.12,.025,.32,palette[2],Math.cos(n*Math.PI*.4)*1.08,.21,-.35+Math.sin(n*Math.PI*.4)*1.08,{glow:true});glyph.rotation.y=-n*Math.PI*.4;}
      for(const side of [-1,1]){box(.22,1.25,.3,palette[1],side*2.5,.52,-3.25);box(1.35,.15,.3,palette[2],side*2.7,1.07,-3.25);animate(orb(2.2,.28,.8,palette[3],side*4.4,1.45,-4.2,{opacity:.28}),'cloud',.11,.65);}
    }else if(id==='garden'||id==='roots'){
      for(const side of [-1,1]){const trunk=rod(.15,id==='roots'?2.5:2.2,0x70583f,side*2.6,1,-2.4);trunk.rotation.z=side*.2;for(let n=0;n<3;n++)animate(orb(.8,.48,.62,id==='roots'?0x70854e:0x779953,side*2.6+(n-1)*.45,2.25+n*.08,-2.4),'leaf',.56,.035);}
      for(let n=0;n<4;n++){const root=rod(.09,1.75,palette[2],-2.3+n*1.45,.16,-2.5);root.rotation.z=Math.PI/2;root.rotation.y=(n-1.5)*.19;}
    }else if(id==='echo'||id==='frost'){
      for(let n=0;n<5;n++){const crystal=mesh(new T.OctahedronGeometry(.34+n%2*.16),palette[n%2?2:3],-2.8+n*1.35,.4+n%2*.3,-2.65,{glow:n%2===0});crystal.scale.y=1.9;crystal.rotation.z=(n-2)*.12;if(id==='echo')animate(crystal,'float',.63,.055);}
    }else if(id==='library'){
      for(const side of [-1,1]){box(1.4,2.45,.25,0x574b43,side*2.75,1.1,-2.8);for(let shelf=0;shelf<3;shelf++){box(1.45,.09,.5,palette[2],side*2.75,.45+shelf*.63,-2.55);for(let book=0;book<3;book++){const tome=box(.22,.4,.32,[0x728e81,0x928b72,0x73748e][book],side*2.75+(book-1)*.35,.7+shelf*.63,-2.5);tome.rotation.z=(book-1)*.05;}}}
      animate(orb(.1,.1,.1,palette[3],0,2.7,-2.2,{glow:true}),'float',.5,.1);
    }else if(id==='mist'){
      const water=mesh(new T.CylinderGeometry(1.7,1.7,.05,24),0x4f939b,0,-.03,-2.4,{glow:true,opacity:.55});animate(water,'water',.68,.025);
      for(const side of [-1,1]){rod(.045,1.45,palette[2],side*2.5,.68,-2.2);animate(orb(.14,.23,.14,palette[3],side*2.5,1.4,-2.2,{glow:true}),'float',.7,.035);}
    }else if(id==='clockwork'){
      for(let n=0;n<3;n++){const gear=mesh(new T.TorusGeometry(.42+n*.07,.085,6,18),palette[2],-1.5+n*1.5,2.3,-3.25);animate(gear,'gear',(n%2?-.12:.10));for(let spoke=0;spoke<4;spoke++){const bar=box(.1,.65,.06,palette[2],0,0,0,{parent:gear});bar.rotation.z=spoke*Math.PI/4;}}
    }else if(id==='furnace'){
      mesh(new T.CylinderGeometry(.95,1.15,.45,12),palette[1],0,.1,-2.6);animate(orb(.7,.12,.7,palette[3],0,.38,-2.6,{glow:true}),'ember',.7,.04);
      for(const side of [-1,1]){rod(.12,2.1,palette[2],side*2.5,.8,-2.65);animate(orb(.17,.24,.17,palette[3],side*2.5,1.8,-2.65,{glow:true}),'float',1,.07);}
    }else{
      for(const side of [-1,1])box(.4,2.6,.55,palette[2],side*1.9,1,-3.1);box(4.25,.35,.65,palette[2],0,2.5,-3.1);const halo=mesh(new T.TorusGeometry(.6,.035,5,30),palette[3],0,1.75,-3.05,{glow:true});animate(halo,'gear',.06);
    }
    return set;
  }
  function create({THREE:T,hero,heroJob='swordsman',heroSex='male',heroName='旅人',buildActor,buildStoryActor,dispose,environment,floor=99,reduced=false}={}){
    if(!T?.Scene||!T?.Mesh)return null;
    const id=environmentId(environment,floor),palette=PALETTES[id],scene=new T.Scene(),owned=new Set(),motion=[];
    const premium=id==='cloud';scene.name='story-theater';scene.userData.storyTheater=true;scene.userData.environment=id;scene.userData.cinematicPreview=premium;scene.userData.storyArtDirection=premium?'cloud-summit':id+'-stage';scene.background=new T.Color(premium?0xb6d8e7:palette[0]);scene.fog=new T.Fog(premium?0xb6d8e7:palette[0],premium?16:10,premium?45:22);
    const ambient=new T.AmbientLight(0xf0e4d3,premium?.46:.65),keyLight=new T.HemisphereLight(palette[3],palette[0],premium?.7:.85);scene.add(ambient,keyLight);
    const cinemaLight=premium?new T.DirectionalLight(0xffedda,.82):null;if(cinemaLight){cinemaLight.position.set(-3.8,7,5.5);cinemaLight.castShadow=false;scene.add(cinemaLight);}
    const set=(premium?scenery:legacyScenery)(T,id,palette,scene,owned,motion);
    let lookSession=null;try{if(premium)lookSession=globalThis.TowerCinematicLook?.create?.({THREE:T})||null;}catch{/* Optional preview finish: retain the original actor if unavailable. */}
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
    if(heroModel){heroModel.userData.storyTheaterActor=true;heroModel.userData.ownedStoryHero=ownsHero;heroModel.position.set(-.9,id==='cloud'?.2:0,.45);heroModel.rotation.set(0,.17,0);heroModel.visible=true;scene.add(heroModel);heroLook=lookSession?.apply?.(heroModel)||null;}
    const contact=[];if(premium){let soft;for(const resource of owned)if(resource.isTexture&&resource.name==='story-soft-surface')soft=resource;const g=new T.PlaneGeometry(1.5,1.1),mat=new T.MeshBasicMaterial({color:0x111c28,map:soft,transparent:true,opacity:.32,depthWrite:false});owned.add(g);owned.add(mat);for(let n=0;n<2;n++){const part=new T.Mesh(g,mat);part.name='story-actor-contact-shadow';part.rotation.x=-Math.PI/2;part.position.set(n?.95:-.9,.199,n?-.05:.45);part.visible=n===0&&!!heroModel;contact.push(part);set.add(part);}scene.userData.storySceneryBudget=Object.freeze({...scene.userData.storySceneryBudget,drawables:scene.userData.storySceneryBudget.drawables+2,triangles:scene.userData.storySceneryBudget.triangles+4});}
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
      part.position.set(0,bowHand?-.015:-.34,.22);part.rotation.set(hand==='armL'?-.4:-.75,0,hand==='armL'?.1:0);part.visible=false;arm.add(part);return true;
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
      for(const track of motion){const p=track.part,wave=Math.sin(t*track.speed);if(track.kind==='turn'||track.kind==='gear')p.rotation.z=track.rz+t*track.speed;else if(track.kind==='cloth'){
        // Two tiny retained vertex grids: the stitched upper edge stays fixed,
        // while analytic normals follow the cloth without per-frame objects.
        const pos=p.geometry.attributes.position,normal=p.geometry.attributes.normal;
        for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),weight=(1.05-y)/2.1,phase=t*track.speed+x*4-y*2.8+p.position.x,sine=Math.sin(phase),cosine=Math.cos(phase),dx=track.range*weight*weight*cosine*4,dy=track.range*(-2*weight/2.1*sine-weight*weight*cosine*2.8),length=Math.hypot(dx,dy,1);pos.setZ(i,track.range*weight*weight*sine);normal.setXYZ(i,-dx/length,-dy/length,1/length);}pos.needsUpdate=true;normal.needsUpdate=true;
      }else if(track.kind==='cloud')p.position.x=track.x+wave*track.range;else if(track.kind==='water')p.scale.y=1+wave*track.range;else if(track.kind==='leaf')p.rotation.z=track.rz+wave*track.range;else if(track.kind==='ember')p.scale.y=.12*(1+wave*.15);else p.position.y=track.y+wave*track.range;}
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
      const exactArrival=premium&&Number(floor)===99&&spec.entry?.id==='scene:99'&&index<3&&text===spec.entry.paragraphs?.[index];
      if(exactArrival){
        const authored=SUMMIT_ACTING[index],tracks=[];
        if(heroModel)tracks.push(Object.freeze({actor:heroModel,identity:'hero',performance:'thoughtful',personality:id,speechAnimation:false,beats:authored.hero}));
        if(authored.eve&&npc?.visible&&name==='伊芙')tracks.push(Object.freeze({actor:npc,identity:'伊芙',performance:index===1?'guide':'reflective',personality:id,speechAnimation:false,beats:authored.eve}));
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
