import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Look=require('../story/tower-cinematic-look.js');
const source=readFileSync(new URL('../story/tower-cinematic-look.js',import.meta.url),'utf8');
function resources(model){const all=new Set();model.traverse(node=>{if(node.geometry&&!node.isSprite)all.add(node.geometry);for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat){all.add(mat);for(const v of Object.values(mat))if(v?.isTexture)all.add(v);}});return all;}
function watch(all){const counts=new Map();for(const r of all){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}return counts;}
function rows(model){const list=[];model.traverse(n=>list.push({n,geometry:n.geometry,material:n.material,position:n.position.toArray(),rotation:n.rotation.toArray(),scale:n.scale.toArray(),visible:n.visible,children:[...n.children]}));return list;}
function assertRows(list){for(const r of list){assert.equal(r.n.geometry,r.geometry);assert.equal(r.n.material,r.material);assert.deepEqual(r.n.position.toArray(),r.position);assert.deepEqual(r.n.rotation.toArray(),r.rotation);assert.deepEqual(r.n.scale.toArray(),r.scale);assert.equal(r.n.visible,r.visible);assert.deepEqual(r.n.children,r.children);}}
function fixture(){
  const model=new T.Group(),materials={},mesh=(name,mat,geometry=new T.BoxGeometry(.4,.6,.3))=>{const node=new T.Mesh(geometry,mat);node.name=name;model.add(node);return node;};
  for(const kind of ['cloth','hair','metal','skin','gem']){const mat=new T.MeshLambertMaterial({color:kind==='hair'?0x593b2d:0x638698});mat.userData.surface=kind;materials[kind]=mat;}
  const body=mesh('shirt',materials.cloth),head=mesh('sculpted-head',materials.skin),hair=mesh('hair-crown',materials.hair),plate=mesh('armor-plate',materials.metal),gem=mesh('tier-inlaid-gem',materials.gem);
  const eye=mesh('eye',new T.MeshLambertMaterial({color:0x346654})),mouth=mesh('mouth',new T.MeshBasicMaterial({color:0x241a19})),sprite=new T.Sprite(new T.SpriteMaterial({color:0x45b1ff}));model.add(sprite);
  model.userData={body,headMesh:head,face:{eyes:[eye],mouth},hp:42,owner:model};return {model,body,head,hair,plate,gem,eye,mouth,sprite,materials};
}
function trueHeroes(){const env=vm.createContext({THREE:T,CharacterSculpt:require('../assets/character-sculpt.js'),CharacterFace:require('../assets/character-face.js'),TowerHeroes:require('../story/tower-heroes-core.js')});env.window=env;const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter(cd)'),end=html.indexOf('\n}',start)+2;vm.runInContext(html.slice(start,end),env);vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);return env;}

test('module is standalone without canvas, renderer, audio, timer, network, storage, randomness or game writes',()=>{
  const env=vm.createContext({});vm.runInContext(source,env);assert.equal(typeof env.TowerCinematicLook.create,'function');assert.equal(Look.create({}),null);
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|set(?:Timeout|Interval)\s*\(|(?:fetch|WebSocket|Audio)\s*\(|localStorage|document\.|Canvas|Math\.random\s*\(|new\s+T\.(?:WebGLRenderer|Light)|\b(?:run|G)\.[\w]+\s*=/);
  const session=Look.create({THREE:T});for(const value of [null,{},false])assert.equal(session.apply(value).restore(),false);assert.equal(session.dispose(),true);assert.equal(session.dispose(),false);assert.equal(session.apply(new T.Group()).restore(),false);
});
test('stage Phong surfaces preserve all original colors, maps, alpha/depth flags and emissive properties without changing source resources',()=>{
  const f=fixture(),originalMap=new T.DataTexture(new Uint8Array([240,240,240,255]),1,1,T.RGBAFormat),normalMap=new T.DataTexture(new Uint8Array([127,127,255,255]),1,1,T.RGBAFormat);
  Object.assign(f.materials.cloth,{map:originalMap,normalMap,opacity:.71,transparent:true,side:T.DoubleSide,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,alphaTest:.13,vertexColors:true,emissiveIntensity:.37});f.materials.cloth.emissive.setHex(0x235987);
  const before=rows(f.model),owned=resources(f.model),counts=watch(owned),colors=new Map(Object.values(f.materials).map(m=>[m,m.color.getHex()])),session=Look.create({THREE:T}),handle=session.apply(f.model);
  assert.notEqual(f.body.material,f.materials.cloth);assert.equal(f.body.material.type,'MeshPhongMaterial');assert.equal(f.body.material.map,originalMap);assert.equal(f.body.material.normalMap,normalMap);assert.equal(f.body.material.bumpMap,null);
  for(const key of ['opacity','transparent','side','depthWrite','depthTest','blending','alphaTest','vertexColors','emissiveIntensity'])assert.equal(f.body.material[key],f.materials.cloth[key],key);
  assert.equal(f.body.material.emissive.getHex(),f.materials.cloth.emissive.getHex());for(const node of [f.body,f.head,f.hair,f.plate,f.gem])assert.equal(node.material.color.getHex(),before.find(row=>row.n===node).material.color.getHex());
  for(const[m,color]of colors)assert.equal(m.color.getHex(),color);assert.equal(f.model.userData.hp,42);assert.equal(f.model.userData.owner,f.model);assert.equal(f.materials.cloth.userData.cinematicSurface,undefined);
  handle.restore();assertRows(before);session.dispose();assert.ok([...counts.values()].every(n=>n===0));for(const resource of owned)resource.dispose();
});
test('three 128-square white-gray micro textures are deterministic and shared across actors, not copied per body part',()=>{
  const a=fixture(),b=fixture(),session=Look.create({THREE:T}),handles=[session.apply(a.model),session.apply(b.model)],maps=new Set();
  for(const f of [a,b])for(const node of [f.body,f.hair,f.plate]){const map=node.material.map;assert.equal(map.image.width,128);assert.equal(map.image.height,128);assert.equal(map.image.data.byteLength,65536);assert.equal(map.wrapS,T.RepeatWrapping);assert.equal(map.wrapT,T.RepeatWrapping);assert.equal(map.generateMipmaps,true);maps.add(map);for(let i=0;i<map.image.data.length;i+=4){assert.ok(map.image.data[i]>=210&&map.image.data[i]<=255);assert.equal(map.image.data[i],map.image.data[i+1]);assert.equal(map.image.data[i],map.image.data[i+2]);assert.equal(map.image.data[i+3],255);}}
  assert.equal(maps.size,3);assert.equal(a.body.material.map,b.body.material.map);assert.equal(a.hair.material.map,b.hair.material.map);assert.equal(a.plate.material.map,b.plate.material.map);const counts=watch(maps);handles[0].restore();assert.ok([...counts.values()].every(n=>n===0));handles[1].restore();assert.ok([...counts.values()].every(n=>n===0));session.dispose();assert.ok([...counts.values()].every(n=>n===1));session.dispose();assert.ok([...counts.values()].every(n=>n===1));
  const again=Look.create({THREE:T}),c=fixture(),last=again.apply(c.model);assert.deepEqual(c.body.material.map.image.data,a.body.material.map?.image?.data||[...maps][0].image.data);last.restore();again.dispose();for(const f of [a,b,c])for(const resource of resources(f.model))resource.dispose();
});
test('source-plus-surface cache preserves existing render batches, while different source families remain independent',()=>{
  const f=fixture(),second=new T.Mesh(f.body.geometry,f.materials.cloth);second.name='shirt';f.model.add(second);const hairSameSource=new T.Mesh(f.body.geometry,f.materials.cloth);hairSameSource.name='hair-fringe';delete f.materials.cloth.userData.surface;f.model.add(hairSameSource);
  const before=rows(f.model),meshCount=before.filter(row=>row.n.isMesh).length,session=Look.create({THREE:T}),handle=session.apply(f.model);assert.equal(f.body.material,second.material);assert.notEqual(f.body.material,hairSameSource.material);assert.equal(hairSameSource.material.userData.cinematicSurface,'hair');assert.equal(rows(f.model).filter(row=>row.n.isMesh).length,meshCount);assert.notEqual(f.body.material,f.hair.material);
  assert.equal(session.apply(f.model),handle);handle.restore();assertRows(before);session.dispose();for(const resource of resources(f.model))resource.dispose();
});
test('unnamed exposed limbs sharing head skin keep their skin surface after the head has already been replaced',()=>{
  const f=fixture();delete f.materials.skin.userData.surface;const limb=new T.Mesh(new T.CylinderGeometry(.1,.1,.5),f.materials.skin);f.model.add(limb);const before=rows(f.model),session=Look.create({THREE:T}),handle=session.apply(f.model);
  assert.equal(limb.material.userData.cinematicSurface,'skin');assert.equal(limb.material,f.head.material);assert.equal(limb.material.map,null);assert.equal(limb.material.bumpMap,null);handle.restore();assertRows(before);session.dispose();for(const resource of resources(f.model))resource.dispose();
});
test('missing UV coordinates are generated only on owned geometry copies and copied geometry is reused within its surface family',()=>{
  const f=fixture(),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-.2,0,0,.2,0,0,0,.7,.1],3));geometry.computeVertexNormals();f.body.geometry=geometry;const second=new T.Mesh(geometry,f.materials.cloth);second.name='shirt';f.model.add(second);
  const originalAttributes={...geometry.attributes},positions=geometry.attributes.position.array.slice(),counts=watch([geometry]),session=Look.create({THREE:T}),handle=session.apply(f.model),copy=f.body.geometry,copies=watch([copy]);assert.notEqual(copy,geometry);assert.equal(second.geometry,copy);assert.equal(copy.attributes.uv.count,3);assert.ok([...copy.attributes.uv.array].every(n=>Number.isFinite(n)&&n>=0&&n<=1));assert.deepEqual(geometry.attributes,originalAttributes);assert.deepEqual(geometry.attributes.position.array,positions);assert.equal(geometry.attributes.uv,undefined);
  handle.restore();assert.equal(f.body.geometry,geometry);assert.equal(second.geometry,geometry);assert.equal(counts.get(geometry),0);assert.equal(copies.get(copy),1);handle.restore();session.dispose();assert.equal(copies.get(copy),1);assert.equal(counts.get(geometry),0);for(const resource of resources(f.model))resource.dispose();
});
test('material arrays retain source identities and protected face, basic materials and sprites remain original',()=>{
  const f=fixture(),basic=new T.MeshBasicMaterial({color:0xaaf3f8}),array=[f.materials.metal,basic],mixed=new T.Mesh(new T.BoxGeometry(),array);mixed.name='armor-plate';f.model.add(mixed);const before=rows(f.model),session=Look.create({THREE:T}),handle=session.apply(f.model);
  assert.notEqual(mixed.material,array);assert.notEqual(mixed.material[0],array[0]);assert.equal(mixed.material[1],basic);assert.equal(f.eye.material,before.find(row=>row.n===f.eye).material);assert.equal(f.mouth.material,before.find(row=>row.n===f.mouth).material);assert.equal(f.sprite.material,before.find(row=>row.n===f.sprite).material);
  handle.restore();assert.equal(mixed.material,array);assertRows(before);session.dispose();for(const resource of resources(f.model))resource.dispose();
});
test('twenty apply/restore cycles leave no private material or UV geometry alive and dispose session textures only once',()=>{
  const f=fixture(),geometry=f.hair.geometry.clone();geometry.deleteAttribute('uv');f.hair.geometry=geometry;const before=rows(f.model),borrowed=resources(f.model),borrowedCounts=watch(borrowed),session=Look.create({THREE:T}),maps=new Set();
  for(let repeat=0;repeat<20;repeat++){
    const handle=session.apply(f.model),privateResources=[...resources(f.model)].filter(r=>!borrowed.has(r)&&!r.isTexture),counts=watch(privateResources);for(const r of resources(f.model))if(r.isTexture&&!borrowed.has(r))maps.add(r);
    assert.equal(handle.restore(),true);assert.equal(handle.restore(),false);assert.ok([...counts.values()].every(n=>n===1));assertRows(before);assert.ok([...borrowedCounts.values()].every(n=>n===0));
  }
  assert.equal(maps.size,3);const mapCounts=watch(maps),pending=session.apply(f.model),privateCounts=watch([...resources(f.model)].filter(r=>!borrowed.has(r)&&!r.isTexture));assert.equal(session.dispose(),true);assert.equal(session.dispose(),false);assert.equal(pending.restore(),false);assertRows(before);assert.ok([...mapCounts.values()].every(n=>n===1));assert.ok([...privateCounts.values()].every(n=>n===1));assert.ok([...borrowedCounts.values()].every(n=>n===0));for(const resource of borrowed)resource.dispose();
});
test('all sixteen true profession/sex actor variants preserve original sculpture and face while stage surfaces restore safely',()=>{
  const env=trueHeroes(),jobs=Object.keys(env.TowerHeroes.JOBS);assert.equal(jobs.length,8);const session=Look.create({THREE:T});
  for(const job of jobs)for(const sex of ['male','female']){
    const actor=env.TowerHeroVisuals.base(job,env.buildCharacter,'hero',sex),before=rows(actor),original=resources(actor),counts=watch(original),face=actor.userData.face,eyeMaterials=face.eyes.map(node=>node.material),mouth=face.mouth.material,handle=session.apply(actor);
    for(let i=0;i<face.eyes.length;i++)assert.equal(face.eyes[i].material,eyeMaterials[i],job+sex+' eye');assert.equal(face.mouth.material,mouth);assert.equal(actor.userData.heroJob,job);assert.equal(actor.userData.heroSex,sex);
    for(const row of before){assert.deepEqual(row.n.position.toArray(),row.position);assert.deepEqual(row.n.rotation.toArray(),row.rotation);assert.deepEqual(row.n.scale.toArray(),row.scale);assert.equal(row.n.visible,row.visible);if(row.geometry?.attributes.position)assert.deepEqual(row.n.geometry.attributes.position.array,row.geometry.attributes.position.array);}
    handle.restore();assertRows(before);assert.ok([...counts.values()].every(n=>n===0));for(const resource of original)resource.dispose();
  }
  session.dispose();
});
test('robot energy cores, glowing eye/sprite materials and selected core color are never replaced or altered',()=>{
  const env=trueHeroes();for(const sex of ['male','female']){
    const actor=env.TowerHeroVisuals.base('robot',env.buildCharacter,'hero',sex);env.TowerHeroVisuals.syncRobotLight(actor,{tier:4,color:0xa7eeee});const energy=[];actor.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:[node.material])if(material?.userData.robotEnergy||material?.userData.robotGlow)energy.push({node,material,color:material.color.getHex(),emissive:material.emissive?.getHex(),intensity:material.emissiveIntensity,map:material.map});});assert.ok(energy.length>=2);
    const before=rows(actor),session=Look.create({THREE:T}),handle=session.apply(actor);for(const item of energy){assert.equal(item.node.material,item.material);assert.equal(item.material.color.getHex(),item.color);assert.equal(item.material.emissive?.getHex(),item.emissive);assert.equal(item.material.emissiveIntensity,item.intensity);assert.equal(item.material.map,item.map);}assert.equal(actor.userData.robotLightColor,0xa7eeee);handle.restore();assertRows(before);session.dispose();for(const resource of resources(actor))resource.dispose();
  }
});
test('restoring before the existing owned-NPC disposer keeps its source resources exactly-once owned outside the cinematic session',()=>{
  const f=fixture(),original=resources(f.model),counts=watch(original),session=Look.create({THREE:T}),handle=session.apply(f.model),privateResources=[...resources(f.model)].filter(r=>!original.has(r)),privateCounts=watch(privateResources);
  handle.restore();for(const resource of resources(f.model))resource.dispose();session.dispose();assert.ok([...counts.values()].every(n=>n===1));assert.ok([...privateCounts.values()].every(n=>n===1));assert.equal(handle.restore(),false);assert.equal(session.dispose(),false);
});
