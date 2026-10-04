import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),CM=require('../assets/character-motion.js'),H=require('../story/tower-heroes-core.js'),M=require('../story/tower-combat-motion.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),builder=html.slice(start,html.indexOf('\n}',start)+2),visualSource=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
const proportionCall="if(job==='smith')smithDwarfBody(T,m);",beardCall="if(job==='smith')smithLongBeard(T,beard);";
assert.ok(visualSource.includes(proportionCall)&&visualSource.includes(beardCall),'the new dwarf construction must be present before creating the pre-change control');
// Restore only the two smith-specific construction calls. All real current
// sculpture, material ownership, unrelated models and motion remain in place.
const previousSource=visualSource.replace(proportionCall,'').replace(beardCall,'');
assert.notEqual(previousSource,visualSource,'the pre-change control must actually disable the dwarf construction');
function environment(source){const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,CharacterMotion:CM,TowerHeroes:H,TowerCombatMotion:M});e.window=e;vm.runInContext(builder,e);vm.runInContext(source,e);return e;}
const env=environment(visualSource),beforeEnv=environment(previousSource),V=env.TowerHeroVisuals,previousV=beforeEnv.TowerHeroVisuals;
function figure(sex='male',identity='hero',previous=false){const e=previous?beforeEnv:env;return e.TowerHeroVisuals.base('smith',e.buildCharacter,identity,sex);}
function close(actual,expected,label){assert.ok(Math.abs(actual-expected)<1e-6,`${label}: ${actual} should be ${expected}`);}
function geometryDigest(g){const h=createHash('sha256');h.update(g.type);for(const [key,a]of Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b))){h.update(key+':'+a.itemSize);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(g.index)h.update(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));return h.digest('hex');}
function snapshot(group,excludeBeard=false){const parts=[];group.traverse(o=>{if(excludeBeard&&o.name==='profession-beard')return;parts.push({name:o.name,position:o===group?null:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray(),visible:o.visible,geometry:o.geometry?geometryDigest(o.geometry):null,color:o.material?.color?.getHex()});});return parts;}
function resources(m){const refs=[];m.traverse(o=>refs.push([o,o.geometry,o.material,o.material?.map]));return refs;}
function release(m){const geometries=new Set(),materials=new Set(),textures=new Set();m.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])if(material){materials.add(material);for(const v of Object.values(material))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
function metrics(m){let meshes=0,triangles=0;m.traverse(o=>{assert.equal(!!o.isLight,false,'dwarf styling must reuse the game lighting');if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}for(const key of ['position','normal'])if(o.geometry?.attributes[key])assert.ok(Array.from(o.geometry.attributes[key].array).every(Number.isFinite),o.name+' '+key);});return {meshes,triangles};}
function visibleBounds(m){m.updateMatrixWorld(true);const box=new T.Box3(),p=new T.Vector3();m.traverse(o=>{if(!o.isMesh)return;for(let ancestor=o;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;const a=o.geometry.attributes.position,used=o.geometry.index?new Set(o.geometry.index.array):Array.from({length:a.count},(_,i)=>i);for(const i of used)box.expandByPoint(p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));});return box;}
const item=(kind,slot)=>({id:slot,kind,slot,durability:100,maxDurability:100});
function equipment(tier,heavy=false){return {weapon:item(H.tierKind(heavy?'warhammer':'smith_hammer',tier),'weapon'),armor:item(H.tierKind('heavy_armor',tier),'armor'),helmet:item(H.tierKind('heavy_helm',tier),'helmet'),shield:heavy?null:item(H.tierKind('round_shield',tier),'shield')};}

test('both adult dwarf smiths shorten only their legs by 20 percent, preserving soles, body scale and hero/recruit identity',t=>{
  for(const sex of ['male','female'])for(const identity of ['hero','traveller']){
    const m=figure(sex,identity),before=figure(sex,identity,true);
    assert.deepEqual(m.scale.toArray(),before.scale.toArray(),'the character is not uniformly shrunk');assert.equal(m.userData.adultDesign,true);assert.equal(m.userData.smithLegTrim,.11);assert.equal(m.userData.heroIdentityStyle,before.userData.heroIdentityStyle);
    for(const key of ['legL','legR']){
      const leg=m.userData[key],old=before.userData[key];leg.geometry.computeBoundingBox();old.geometry.computeBoundingBox();
      close(leg.geometry.boundingBox.getSize(new T.Vector3()).y,.44,'local leg height');close(old.geometry.boundingBox.getSize(new T.Vector3()).y,.55,'pre-change leg height');close(leg.position.y,.51,'leg joint');close(leg.geometry.boundingBox.max.y,old.geometry.boundingBox.max.y,'hip seam');
      assert.equal(leg.geometry.index.count,old.geometry.index.count);assert.equal(leg.geometry.attributes.position.count,old.geometry.attributes.position.count);assert.deepEqual(leg.scale.toArray(),old.scale.toArray());
      const p=leg.geometry.attributes.position,q=old.geometry.attributes.position;for(let i=0;i<p.count;i++){close(p.getX(i),q.getX(i),'original leg width');close(p.getZ(i),q.getZ(i),'original leg depth');}
      for(let i=0;i<leg.children.length;i++){const a=leg.children[i],b=old.children[i];assert.equal(geometryDigest(a.geometry),geometryDigest(b.geometry),'existing footwear sculpture retained');assert.deepEqual(a.scale.toArray(),b.scale.toArray());close(a.position.y,b.position.y+.11,'footwear compensation');m.updateMatrixWorld(true);before.updateMatrixWorld(true);close(new T.Box3().setFromObject(a).min.y,new T.Box3().setFromObject(b).min.y,'original world foot contact');}
    }
    const oldBounds=visibleBounds(before),bounds=visibleBounds(m);close(bounds.min.y,oldBounds.min.y,'contact-shadow/foot floor');close(bounds.getSize(new T.Vector3()).y,oldBounds.getSize(new T.Vector3()).y-.11*m.scale.y,'actual visible height decrease');
    t.diagnostic(`${sex} ${identity}: bare height ${oldBounds.getSize(new T.Vector3()).y.toFixed(6)} -> ${bounds.getSize(new T.Vector3()).y.toFixed(6)}, floor ${bounds.min.y.toFixed(6)}, budget ${JSON.stringify(metrics(m))}`);release(m);release(before);
  }
});

test('upper body, head, neck, shoulder and clothing mounts descend together without changing their existing sculpture',()=>{
  for(const sex of ['male','female']){
    const m=figure(sex),before=figure(sex,'hero',true);
    for(const key of ['body','armL','armR','head']){const a=m.userData[key],b=before.userData[key];close(a.position.y,b.position.y-.11,key+' follows shortened hips');close(a.position.x,b.position.x,key+' horizontal mount');close(a.position.z,b.position.z,key+' depth mount');assert.deepEqual(snapshot(a,key==='head'),snapshot(b,key==='head'),key+' retains every original triangle, material color and expression mount');}
    const neck=m.getObjectByName('anatomical-neck'),oldNeck=before.getObjectByName('anatomical-neck');close(neck.position.y,oldNeck.position.y-.11,'neck mount');assert.equal(geometryDigest(neck.geometry),geometryDigest(oldNeck.geometry));
    for(let i=0;i<m.userData.baseClothing.length;i++){const a=m.userData.baseClothing[i],b=before.userData.baseClothing[i];close(a.position.y,b.position.y-.11,'uniform mount');assert.equal(geometryDigest(a.geometry),geometryDigest(b.geometry));}
    assert.deepEqual(m.userData.face.profile,before.userData.face.profile);const braids=[];m.userData.head.traverse(o=>{if(o.userData.braidSide)braids.push(o.userData.braidSide);});assert.deepEqual(braids.sort(),sex==='female'?[-1,1]:[],'female smith retains exactly her two connected braids');release(m);release(before);
  }
});

test('male smith has one connected long tapered beard attached below the mouth, with the original mesh and triangle budget',()=>{
  const m=figure(),before=figure('male','hero',true),beard=m.getObjectByName('profession-beard'),old=before.getObjectByName('profession-beard'),female=figure('female');
  assert.ok(beard.geometry.userData.smithLongBeard);beard.geometry.computeBoundingBox();old.geometry.computeBoundingBox();const box=beard.geometry.boundingBox.clone().translate(beard.position);
  close(box.max.y,-.15,'beard root below lips');close(box.min.y,-.59,'tapered beard end');assert.ok(box.getSize(new T.Vector3()).y>old.geometry.boundingBox.getSize(new T.Vector3()).y*2.5);assert.equal(beard.geometry.attributes.position.count,old.geometry.attributes.position.count);assert.equal(beard.geometry.index.count,old.geometry.index.count);assert.equal(beard.material.color.getHex(),old.material.color.getHex());assert.equal(female.getObjectByName('profession-beard'),undefined);
  const p=beard.geometry.attributes.position,weld=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(','),links=new Map(),indices=beard.geometry.index.array;
  for(let i=0;i<indices.length;i+=3){const nodes=[indices[i],indices[i+1],indices[i+2]].map(weld);for(const a of nodes){if(!links.has(a))links.set(a,new Set());for(const b of nodes)links.get(a).add(b);}}
  const visited=new Set(),pending=[links.keys().next().value];while(pending.length){const vertex=pending.pop();if(visited.has(vertex))continue;visited.add(vertex);for(const neighbor of links.get(vertex))pending.push(neighbor);}assert.equal(visited.size,links.size,'all beard triangles join one welded continuous surface, not separate floating tufts');
  const probe=new T.Mesh(m.userData.headMesh.geometry,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster();probe.updateMatrixWorld(true);ray.set(new T.Vector3(0,-.15,1),new T.Vector3(0,0,-1));const scalp=ray.intersectObject(probe,false)[0];assert.ok(scalp);assert.ok(beard.position.z<=scalp.point.z+.015&&beard.position.z>=scalp.point.z-.06,'the single beard root overlaps the real chin rather than floating in front');probe.material.dispose();
  const meshCount=m.userData.head.children.filter(o=>o.name==='profession-beard').length;assert.equal(meshCount,1);assert.deepEqual(metrics(m),metrics(before),'the longer beard and short legs cost no additional rendered meshes or triangles');
  let time=0;for(const mood of ['calm','focus','hurt','happy','cast','talk']){for(let frame=0;frame<12;frame++){F.update(m,time,mood);time+=.2;}m.updateMatrixWorld(true);for(const part of [m.userData.face.mouth,...m.userData.face.lips,m.userData.face.teeth])for(const u of [-.8,-.4,0,.4,.8]){const point=part.localToWorld(new T.Vector3(u*.113/2,0,0));ray.set(new T.Vector3(point.x,point.y,point.z+1),new T.Vector3(0,0,-1));assert.equal(ray.intersectObject(beard,false).find(hit=>hit.distance<1-.001),undefined,mood+': beard cannot cover the expressive mouth');}}
  release(m);release(before);release(female);
});

test('all five smith armor and helmet tiers follow the new body while hammers and shields retain their hand mounts',t=>{
  for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++)for(const heavy of [false,true]){
    const m=figure(sex),before=figure(sex,'hero',true),eq=equipment(tier,heavy),input=JSON.stringify(eq);V.dress(T,m,eq,release);previousV.dress(T,before,eq,release);
    for(const kind of ['heavy_armor','heavy_helm']){const piece=m.userData.heroPieces.find(p=>p.userData.baseKind===kind),old=before.userData.heroPieces.find(p=>p.userData.baseKind===kind);close(piece.position.y,old.position.y-.11,kind+' mount compensation');assert.deepEqual(snapshot(piece),snapshot(old),kind+' sculpture is not resized');}
    for(const key of ['weapon','shield'])if(eq[key]){const kind=H.GEAR[eq[key].kind].baseKind,piece=m.userData.heroPieces.find(p=>p.userData.baseKind===kind),old=before.userData.heroPieces.find(p=>p.userData.baseKind===kind);assert.deepEqual(piece.position.toArray(),old.position.toArray(),key+' retains local palm mount');assert.deepEqual(piece.quaternion.toArray(),old.quaternion.toArray());assert.equal(piece.parent,m.userData[key==='weapon'?'armR':'armL']);}
    assert.equal(JSON.stringify(eq),input,'cosmetic proportion does not change equipped stats, durability or inventory');const currentBudget=metrics(m),previousBudget=metrics(before);assert.deepEqual(currentBudget,previousBudget,`${sex} tier ${tier} ${heavy?'warhammer':'hammer and shield'}: dwarf styling must add zero meshes or triangles to the same original equipped variant`);t.diagnostic(`${sex} tier ${tier} ${heavy?'warhammer':'hammer/shield'}: unchanged ${JSON.stringify(currentBudget)}`);release(m);release(before);
  }
});

test('dwarf styling reuses face, beard, motion and gear resources through walking and both hammer strikes',()=>{
  for(const sex of ['male','female'])for(const heavy of [false,true]){
    const m=figure(sex);V.dress(T,m,equipment(3,heavy),release);CM.update(m,0,0,false);V.pose(m,0,1,false,0);F.update(m,0);const refs=resources(m),count=metrics(m),legHeight=m.userData.legL.position.y;
    for(let i=1;i<=160;i++){const time=i/30;if(i%40===1){M.begin(m,'attack',1);M.state(m).variant=Math.floor(i/40)%2;}CM.update(m,1/30,time,i%20<10);V.pose(m,0,1,false,1/30);F.update(m,time,F.moods[Math.floor(i/20)%F.moods.length]);close(m.userData.legL.position.y,legHeight,'walking does not restore pre-dwarf hip height');}
    assert.deepEqual(resources(m),refs,'updates allocate no meshes, geometry, materials or textures');assert.deepEqual(metrics(m),count);release(m);
  }
});

test('smith-only construction leaves every other profession untouched and retires each original shared leg geometry once',()=>{
  for(const job of Object.keys(H.JOBS).filter(job=>job!=='smith'))for(const sex of ['male','female']){const a=V.base(job,env.buildCharacter,'hero',sex),b=previousV.base(job,beforeEnv.buildCharacter,'hero',sex);assert.deepEqual(snapshot(a),snapshot(b),job+' '+sex+' is outside dwarf scope');release(a);release(b);}
  let retired=0,original=null;const build=cd=>{const model=env.buildCharacter(cd);original=model.userData.legL.geometry;assert.equal(model.userData.legR.geometry,original,'the starting legs share an owned geometry');original.addEventListener('dispose',()=>retired++);return model;},m=V.base('smith',build,'hero','male');assert.equal(retired,1,'construction retires the shared original geometry exactly once');assert.notEqual(m.userData.legL.geometry,original);assert.notEqual(m.userData.legR.geometry,original);assert.notEqual(m.userData.legL.geometry,m.userData.legR.geometry);release(m);assert.equal(retired,1,'final disposal does not dispose the retired original again');
});
