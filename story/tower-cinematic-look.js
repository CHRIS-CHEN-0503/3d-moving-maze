/* Stage-only close-up surfaces. No canvas, downloads, renderer or game state.
   Borrowed actors keep their source GPU resources; restoring a handle must run
   before the stage's normal owned-NPC disposer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerCinematicLook=api;})(globalThis,function(){
  'use strict';
  const SIZE=128,NO_HANDLE=Object.freeze({restore:()=>false});
  const SURFACES=Object.freeze({
    cloth:Object.freeze({texture:'cloth',specular:0x323c43,shininess:11,bump:.0022}),
    leather:Object.freeze({texture:'cloth',specular:0x493e34,shininess:21,bump:.003}),
    hair:Object.freeze({texture:'hair',specular:0x6e6267,shininess:47,bump:.0025}),
    metal:Object.freeze({texture:'metal',specular:0xc4d0da,shininess:91,bump:.0018}),
    skin:Object.freeze({texture:null,specular:0x483735,shininess:23,bump:0}),
    gem:Object.freeze({texture:null,specular:0xdce8ef,shininess:112,bump:0})
  });
  const VALUES=['opacity','transparent','side','shadowSide','alphaTest','alphaToCoverage','depthTest','depthWrite','depthFunc','colorWrite','blending','blendSrc','blendDst','blendEquation','blendSrcAlpha','blendDstAlpha','blendEquationAlpha','premultipliedAlpha','dithering','vertexColors','flatShading','fog','visible','toneMapped','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','stencilWrite','stencilWriteMask','stencilFunc','stencilRef','stencilFuncMask','stencilFail','stencilZFail','stencilZPass','wireframe','wireframeLinewidth','wireframeLinecap','wireframeLinejoin','emissiveIntensity','lightMapIntensity','aoMapIntensity','bumpScale','displacementScale','displacementBias','reflectivity','refractionRatio','combine','forceSinglePass','skinning','morphTargets','morphNormals'];
  const MAPS=['map','bumpMap','normalMap','normalMapType','displacementMap','emissiveMap','lightMap','aoMap','alphaMap','specularMap','envMap'];
  const integer=(x,y)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+31,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;};
  function texture(T,kind){
    const pixels=new Uint8Array(SIZE*SIZE*4);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const noise=integer(x,y)%5;let shade;
      if(kind==='cloth'){const warp=x%8<2?13:0,weft=y%8<2?10:0,cross=((x>>3)+(y>>3))%2?4:0;shade=249-warp-weft-cross-noise;}
      else if(kind==='hair'){const strand=.5+.5*Math.cos(x*Math.PI/4+.24*Math.sin(y*Math.PI/32)),fine=x%3===0?3:0;shade=Math.round(250-strand*24-fine-noise);}
      else{const grain=integer(x>>2,y>>2)%13,scratch=y%29===0&&x%11<8?8:0;shade=251-grain-scratch-noise;}
      shade=Math.max(210,Math.min(255,shade));const at=(y*SIZE+x)*4;pixels[at]=pixels[at+1]=pixels[at+2]=shade;pixels[at+3]=255;
    }
    const map=new T.DataTexture(pixels,SIZE,SIZE,T.RGBAFormat);map.name='cinematic-original-'+kind;map.wrapS=map.wrapT=T.RepeatWrapping;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;
    if('colorSpace' in map&&T.LinearSRGBColorSpace!==undefined)map.colorSpace=T.LinearSRGBColorSpace;
    else if(T.LinearEncoding!==undefined)map.encoding=T.LinearEncoding;
    map.needsUpdate=true;map.userData={owner:'tower-cinematic-look',originalArt:true,byteBudget:pixels.byteLength};return map;
  }
  function faceNodes(model){
    const face=model.userData?.face||{},parts=new Set();for(const key of ['mouth','teeth'])if(face[key])parts.add(face[key]);
    for(const key of ['eyes','pupils','whites','lids','lips','brows','corners','cheeks'])for(const node of face[key]||[])parts.add(node);
    for(const node of model.userData?.cinemaRig?.eyes||[])parts.add(node);return parts;
  }
  function surface(node,source,model,face,skin){
    if(!source?.isMaterial||source.isMeshBasicMaterial||source.isSpriteMaterial||source.isLineBasicMaterial||source.isLineDashedMaterial||source.isPointsMaterial||face.has(node)||source.userData?.robotEnergy||source.userData?.robotGlow)return null;
    if(!source.isMeshLambertMaterial&&!source.isMeshPhongMaterial)return null;
    const explicit=source.userData?.surface;
    if(explicit==='robot-energy')return null;
    if(explicit==='fabric'||explicit==='woven'||explicit==='cloth')return 'cloth';
    if(SURFACES[explicit])return explicit;
    const name=String(node.name||'').toLowerCase();
    if(/(?:^|[-_ ])(?:eye|pupil|iris|mouth|lip|teeth|brow|eyelid|cheek)(?:$|[-_ ])/.test(name))return null;
    if(node.userData?.continuousHair||node.geometry?.userData?.continuousHair||/hair|braid|bun|beard|fringe|whisker/.test(name))return 'hair';
    if(/robot|forged|metal|armor|armour|plate|blade|rivet|buckle|clasp|helm|crown|hammer.*(?:head|face)|shield|spectacle|goggle/.test(name))return 'metal';
    if(/gem|jewel|crystal|inlay.*stone/.test(name))return 'gem';
    if(node===model.userData?.headMesh||/skin|sculpted-head|anatomical-neck|nose|human-ear|hand|finger|thumb|palm/.test(name))return 'skin';
    if(/leather|boot|belt|pouch|pack|strap|handle|wood|bow-limb|walking-stick/.test(name))return 'leather';
    // The old rigs share unnamed skin materials between arms, legs and head.
    // Identity comparison keeps exposed limbs from receiving woven cloth.
    if(skin.has(source))return 'skin';
    return 'cloth';
  }
  function uvCopy(T,original,kind){
    const p=original?.attributes?.position;if(!p||!original.clone||!T.Float32BufferAttribute)return null;
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);}
    const sx=Math.max(.0001,maxX-minX),sy=Math.max(.0001,maxY-minY),sz=Math.max(.0001,maxZ-minZ),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,n=original.attributes.normal,coords=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let u,v;
      if(kind==='hair'){u=(Math.atan2(x-cx,z-cz)+Math.PI)/(Math.PI*2);v=(y-minY)/sy;}
      else if(n&&Math.abs(n.getY(i))>Math.max(Math.abs(n.getX(i)),Math.abs(n.getZ(i)))){u=(x-minX)/sx;v=(z-minZ)/sz;}
      else if(n&&Math.abs(n.getX(i))>Math.abs(n.getZ(i))){u=(z-minZ)/sz;v=(y-minY)/sy;}
      else{u=(x-minX)/sx;v=(y-minY)/sy;}
      coords[i*2]=u;coords[i*2+1]=v;
    }
    const copy=original.clone();copy.setAttribute('uv',new T.Float32BufferAttribute(coords,2));return copy;
  }
  function create({THREE:T}={}){
    if(!T?.MeshPhongMaterial||!T.DataTexture)return null;
    const textures={cloth:texture(T,'cloth'),hair:texture(T,'hair'),metal:texture(T,'metal')},handles=new Set(),byModel=new WeakMap();let active=true;
    function apply(model){
      if(!active||!model?.isObject3D||typeof model.traverse!=='function')return NO_HANDLE;
      const existing=byModel.get(model);if(existing)return existing;
      const records=[],materials=new Set(),geometries=new Set(),cache=new Map(),geometryCache=new Map(),face=faceNodes(model),head=model.userData?.headMesh||model.userData?.head,skin=new Set(head?.isMesh?(Array.isArray(head.material)?head.material:[head.material]):[]);let live=true;
      function replacement(source,kind){
        if(!cache.has(source))cache.set(source,new Map());const family=cache.get(source);if(family.has(kind))return family.get(kind);
        const look=SURFACES[kind],material=new T.MeshPhongMaterial();
        if(source.color)material.color.copy(source.color);if(source.emissive)material.emissive.copy(source.emissive);
        for(const key of VALUES)if(source[key]!==undefined)material[key]=source[key];for(const key of MAPS)if(source[key]!==undefined)material[key]=source[key];
        if(source.normalScale&&material.normalScale)material.normalScale.copy(source.normalScale);
        material.specular.setHex(look.specular);material.shininess=look.shininess;
        if(look.texture){const micro=textures[look.texture];if(!material.map)material.map=micro;if(!material.bumpMap&&!material.normalMap){material.bumpMap=micro;material.bumpScale=look.bump;}}
        material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;material.name='cinematic-'+kind+'-'+(source.name||source.id);material.userData={...source.userData,cinematicSurface:kind};
        family.set(kind,material);materials.add(material);return material;
      }
      model.traverse(node=>{
        if(!node.isMesh||node.isSprite||!node.material)return;
        const original=node.material,list=Array.isArray(original)?original:[original],kinds=list.map(source=>surface(node,source,model,face,skin));if(!kinds.some(Boolean))return;
        const changed=list.map((source,index)=>kinds[index]?replacement(source,kinds[index]):source),material=Array.isArray(original)?changed:changed[0],geometry=node.geometry;
        let copy=geometry;
        if(geometry?.isBufferGeometry&&!geometry.attributes?.uv&&changed.some(m=>m?.map||m?.bumpMap||m?.normalMap||m?.alphaMap)){
          const kind=kinds.find(Boolean)||'cloth';if(!geometryCache.has(geometry))geometryCache.set(geometry,new Map());const family=geometryCache.get(geometry);
          if(!family.has(kind)){const made=uvCopy(T,geometry,kind);family.set(kind,made||geometry);if(made)geometries.add(made);}copy=family.get(kind);
        }
        records.push({node,material:original,geometry});node.material=material;node.geometry=copy;
      });
      const handle=Object.freeze({restore(){
        if(!live)return false;live=false;
        for(const record of records){record.node.material=record.material;record.node.geometry=record.geometry;}
        for(const material of materials)material.dispose();for(const geometry of geometries)geometry.dispose();
        records.length=0;materials.clear();geometries.clear();cache.clear();geometryCache.clear();handles.delete(handle);byModel.delete(model);return true;
      }});
      handles.add(handle);byModel.set(model,handle);return handle;
    }
    function dispose(){if(!active)return false;active=false;for(const handle of [...handles])handle.restore();for(const map of Object.values(textures))map.dispose();return true;}
    return Object.freeze({apply,dispose});
  }
  return Object.freeze({create,SURFACES,SIZE});
});
