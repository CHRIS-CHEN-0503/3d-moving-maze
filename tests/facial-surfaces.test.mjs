import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),H=require('../story/tower-heroes-core.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function canvasDocument(){
  const canvases=[];
  return {canvases,createElement(type){assert.equal(type,'canvas');const trace=[],canvas={width:0,height:0,trace};const context=new Proxy({createRadialGradient(...args){trace.push(['gradient',...args]);return {addColorStop(...args){trace.push(['stop',...args]);}};}},{get(o,key){if(key in o)return o[key];return(...args)=>trace.push([key,...args]);},set(o,key,value){trace.push([key,value]);o[key]=value;return true;}});canvas.getContext=type=>type==='2d'?context:null;canvases.push(canvas);return canvas;}};
}
function environment(){
  const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,TowerHeroes:H});e.window=e;
  const start=html.indexOf('function buildCharacter(cd)'),end=html.indexOf('\n}',start)+2;vm.runInContext(html.slice(start,end),e);
  vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),e);
  vm.runInContext(readFileSync(new URL('../story/tower-characters.js',import.meta.url),'utf8'),e);
  return e;
}
function withCanvas(work){const old=globalThis.document;globalThis.document=canvasDocument();try{return work(globalThis.document);}finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}}
function resources(model){const geometries=new Set(),materials=new Set(),textures=new Set();model.traverse(o=>{if(o.geometry&&!o.isSprite)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});return {geometries,materials,textures};}
function dispose(model){const r=resources(model);r.geometries.forEach(x=>x.dispose());r.materials.forEach(x=>x.dispose());r.textures.forEach(x=>x.dispose());}

test('sixteen profession faces own a single original 128-square complexion map, never mapped onto hands or body',()=>withCanvas(doc=>{
  const e=environment(),textures=new Set();
  for(const job of Object.keys(H.JOBS).filter(job=>job!=='robot'))for(const sex of ['male','female']){
    const model=e.TowerHeroVisuals.base(job,e.buildCharacter,'hero',sex),face=model.userData.face,head=model.userData.headMesh;
    assert.ok(head.material.map?.isCanvasTexture,job+':'+sex);assert.equal(head.material.map,face.skinTexture);textures.add(head.material.map);
    assert.equal(head.material.type,'MeshPhongMaterial');assert.deepEqual(head.material.map.userData,{originalArt:true,owner:'character',byteBudget:65536,kind:'complexion'});
    assert.deepEqual(face.profile,{job,sex,originalArt:true,mapSize:128});assert.equal(face.skinTexture.image.width,128);assert.equal(face.skinTexture.image.height,128);
    model.traverse(o=>{if(o!==head&&o.material)assert.equal(o.material.map,null,o.name);assert.ok(!o.isLight);});
    assert.notEqual(face.brows[0].material,face.mouth.material,'changing hair colour must not recolour lips');
    assert.equal(face.mouth.geometry.type,'BufferGeometry');assert.ok(face.mouth.geometry.attributes.position.count<=24);
    dispose(model);
  }
  assert.equal(textures.size,16);assert.equal(doc.canvases.length,16,'style refinement must reuse its own map, not create another');
}));

test('native authored maps differ by sex and include original scout freckles and smith scar without external image access',()=>withCanvas(()=>{
  const maps=[['mage','male'],['mage','female'],['scout','female'],['smith','male']].map(([job,sex])=>F.skinSurface(T,{job,sex}));
  assert.equal(new Set(maps.map(m=>JSON.stringify(m.image.trace))).size,4);
  for(const map of maps){assert.ok(map.image.trace.some(t=>t[0]==='gradient'));assert.equal(map.minFilter,T.LinearMipmapLinearFilter);assert.equal(map.magFilter,T.LinearFilter);assert.equal(map.generateMipmaps,true);map.dispose();}
}));

test('one character scene disposal releases only its own skin texture and does not invalidate another character',()=>withCanvas(()=>{
  const e=environment(),a=e.TowerHeroVisuals.base('mage',e.buildCharacter,'hero','female'),b=e.TowerHeroVisuals.base('mage',e.buildCharacter,'hero','female');
  let first=0,second=0;a.userData.face.skinTexture.addEventListener('dispose',()=>first++);b.userData.face.skinTexture.addEventListener('dispose',()=>second++);
  assert.notEqual(a.userData.face.skinTexture,b.userData.face.skinTexture);dispose(a);assert.equal(first,1);assert.equal(second,0);
  F.update(b,.5,'happy');assert.equal(b.userData.face.mood,'happy');dispose(b);assert.equal(second,1);
}));

test('NPC head-only skin maps remain isolated from the shared skin on hands and preserve hats and props',()=>withCanvas(()=>{
  const e=environment(),V=e.TowerCharacters,models=[...Object.keys(V.MERCHANT_STYLES).map(id=>V.buildMerchant(id,{THREE:T})),...Object.keys(V.EXPLORER_STYLES).map(id=>V.buildExplorer(id,{THREE:T})),...[1,2,3,4,5].map(rank=>V.buildWarrior(rank,{THREE:T}))];
  for(const model of models){const r=resources(model);assert.equal(r.textures.size,1,model.name);assert.ok(model.userData.head.material.map?.userData.originalArt);model.traverse(o=>{if(o!==model.userData.head&&o.material)assert.equal(o.material.map,null,o.name);});F.update(model,.8,'talk');assert.ok(Number.isFinite(model.userData.face.mouth.scale.y));dispose(model);}
  assert.equal(models.length,15);
}));

test('the original human cast receives refined faces while robot and cat retain their special appearance',()=>withCanvas(()=>{
  const e=environment();for(const type of ['boy','girl','robot','cat']){
    const model=e.buildCharacter({type,shirt:0x337799,pants:0x445566,hair:0x785034,skin:0xd7aa87});
    assert.equal(!!model.userData.headMesh.material.map,['boy','girl'].includes(type),type);F.update(model,.4,'alert');F.update(model,.8,'hurt');assert.ok(model.userData.face.eyes.every(eye=>Number.isFinite(eye.scale.y)));dispose(model);
  }
}));

test('expression animation reuses resources and remains finite for every mood, blink and invalid time',()=>withCanvas(()=>{
  const e=environment(),model=e.TowerHeroVisuals.base('healer',e.buildCharacter,'hero','female'),before=resources(model);
  for(const mood of F.moods)for(let i=0;i<80;i++)F.update(model,i/30,mood);
  for(const time of [NaN,Infinity,-Infinity])F.update(model,time,'hurt');
  const after=resources(model);assert.deepEqual(after,before);model.traverse(o=>{for(const key of ['position','scale','rotation'])assert.ok(['x','y','z'].every(axis=>Number.isFinite(o[key][axis])));});dispose(model);
}));

test('refined connected head sculpture has UVs, finite normals and a bounded detailed triangle count',()=>{
  for(const detail of ['shared','hero'])for(const jaw of [.8,1,1.2]){
    const head=S.head(T,.54,.55,.48,{jaw,cheek:1.3,chin:.9,detail});assert.ok(head.attributes.uv);assert.ok(head.index.count/3<1000);
    for(const key of ['position','normal','uv'])assert.ok(Array.from(head.attributes[key].array).every(Number.isFinite));head.computeBoundingBox();assert.ok(head.boundingBox.max.z<.3&&head.boundingBox.min.z>-.3);head.dispose();
  }
});

test('calm faces smile softly below visible brows; nose remains one continuous sculpt rather than detached pellets',()=>{
  const e=environment();for(const job of Object.keys(H.JOBS).filter(job=>job!=='robot'))for(const sex of ['male','female']){
    const model=e.TowerHeroVisuals.base(job,e.buildCharacter,'hero',sex),face=model.userData.face;F.update(model,.6,'calm');
    const p=face.mouth.geometry.attributes.position,edgeY=(p.getY(0)+p.getY(1))/2,centerY=(p.getY(10)+p.getY(11))/2;assert.ok(edgeY>centerY,'mouth corners must turn upward in the calm pose');
    for(let i=0;i<2;i++){assert.ok(face.brows[i].position.y>face.eyes[i].position.y+.028);assert.ok(face.brows[i].position.y<.08,'brows must remain below the front fringe');}
    for(const name of ['sculpted-nose','nose-bridge','nostril'])for(const part of model.userData.head.children.filter(o=>o.name===name))assert.equal(part.visible,false,name);
    dispose(model);
  }
});

test('every adult profession has a short sculpted neck that overlaps both chin and upper torso without extending beyond the silhouette',()=>{
  const e=environment();for(const job of Object.keys(H.JOBS).filter(job=>job!=='robot'))for(const sex of ['male','female']){
    const model=e.TowerHeroVisuals.base(job,e.buildCharacter,'hero',sex),neck=model.getObjectByName('anatomical-neck');assert.ok(neck,job+':'+sex);assert.equal(neck.geometry.type,'LatheGeometry');model.updateMatrixWorld(true);
    const n=new T.Box3().setFromObject(neck),head=new T.Box3().setFromObject(model.userData.headMesh),body=new T.Box3().setFromObject(model.userData.body);assert.ok(n.max.y>head.min.y);assert.ok(n.min.y<body.max.y);assert.ok(n.max.x<head.max.x&&n.min.x>head.min.x);
    dispose(model);
  }
});
