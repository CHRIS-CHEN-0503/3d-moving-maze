import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),R=require('../story/tower-robot-core.js'),M=require('../story/tower-combat-motion.js'),I=require('../story/tower-heroes-icons.js'),F=require('../assets/character-face.js'),CM=require('../assets/character-motion.js');
const visualSource=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
function collisionRanges(source){
 // Test-only provenance: preserve the original component triangle ranges
 // inside each real static batch. No triangles, normals or draws change.
 return source.replace('const position=[],normal=[],color=[],uv=[];','const position=[],normal=[],color=[],uv=[],collisionParts=[];').replace('const xyz=geo.attributes.position,norm=geo.attributes.normal,c=p.material.color;','const xyz=geo.attributes.position,norm=geo.attributes.normal,c=p.material.color;collisionParts.push({start:position.length/3,count:xyz.count,name:p.name,closed:p.geometry.type!==\'BufferGeometry\'});').replace('m.userData.staticBatch=true;g.add(m);','m.userData.staticBatch=true;m.userData.testCollisionParts=collisionParts;g.add(m);');
}
const env=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:require('../assets/character-sculpt.js'),CharacterFace:F,CharacterMotion:require('../assets/character-motion.js'),TowerCombatMotion:M});
for(const file of ['tower-heroes-visuals.js','tower-skill-effects.js'])vm.runInContext(file==='tower-heroes-visuals.js'?collisionRanges(visualSource):readFileSync(new URL('../story/'+file,import.meta.url),'utf8'),env);
const V=env.TowerHeroVisuals;
function release(model){const gs=new Set(),ms=new Set(),ts=new Set();model.traverse(o=>{if(o.geometry&&(o.isMesh||o.isPoints))gs.add(o.geometry);if(o.material){ms.add(o.material);for(const v of Object.values(o.material))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
const equipment=t=>Object.fromEntries(['armor','weapon'].map(slot=>{const kind=R.kind(slot==='armor'?'robot_shell':'robot_fists',t);return [slot,{kind,slot,durability:100}];}));
function figure(sex,tier=1){const m=V.base('robot',()=>{throw Error('human builder must not run');},'hero',sex);V.dress(T,m,equipment(tier),release);return m;}
function metrics(m){let meshes=0,triangles=0;m.traverse(o=>{assert.equal(!!o.isLight,false);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}for(const key of ['position','normal'])if(o.geometry?.attributes[key])assert.ok(Array.from(o.geometry.attributes[key].array).every(Number.isFinite));});return {meshes,triangles};}
function oldNeckVisuals(){
 // Restore the pre-trim mounts and remove both construction-time corrections,
 // retaining the production sculpture, batching, face rig and other gear.
 const source=visualSource.replace(/\s*\/\/ ROBOT_NECK_CLEARANCE_BEGIN[\s\S]*?\/\/ ROBOT_NECK_CLEARANCE_END/,'').replace(/\s*\/\/ ROBOT_NECK_FOOT_BEGIN[\s\S]*?\/\/ ROBOT_NECK_FOOT_END/,'').replace(/head\.position\.y=female\?[\d.]+:[\d.]+;m\.add\(head\);/,'head.position.y=female?1.665:1.72;m.add(head);').replace(/new T\.CylinderGeometry\(\.12,\.12,[\d.]+,12\)/,'new T.CylinderGeometry(.12,.12,.16,12)').replace(/c\.dark,0,[\d.]+,-\.012,'robot-neck-joint'/,"c.dark,0,1.405,-.012,'robot-neck-joint'");
 assert.notEqual(source,visualSource,'the robot neck is actually shortened');
 const context=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:require('../assets/character-sculpt.js'),CharacterFace:F,CharacterMotion:CM,TowerCombatMotion:M});vm.runInContext(collisionRanges(source),context);return context.TowerHeroVisuals;
}
const previousV=oldNeckVisuals();
function previousFigure(sex,tier){const m=previousV.base('robot',()=>{throw Error('human builder must not run');},'hero',sex);previousV.dress(T,m,equipment(tier),release);return m;}
function geometryDigest(g){
 const hash=createHash('sha256');hash.update(g.type);for(const [key,a]of Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b))){hash.update(key+':'+a.itemSize);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(g.index)hash.update(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));return hash.digest('hex');
}
function sculptureSnapshot(group){const snapshot=[];group.traverse(o=>snapshot.push({name:o.name,position:o===group?null:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray(),visible:o.visible,geometry:o.geometry?geometryDigest(o.geometry):null,material:o.material?{color:o.material.color?.getHex(),emissive:o.material.emissive?.getHex(),intensity:o.material.emissiveIntensity,opacity:o.material.opacity,map:o.material.map?.image?{width:o.material.map.image.width,height:o.material.map.image.height,data:Array.from(o.material.map.image.data||[])}:null}:null}));return snapshot;}
function resourceReferences(m){const refs=[];m.traverse(o=>refs.push([o,o.geometry,o.material,o.material?.map]));return refs;}
function penetratingHeadVertices(m,pitch){
 m.userData.head.rotation.x=pitch;m.updateMatrixWorld(true);
 const shell=m.userData.heroPieces.find(p=>p.userData.baseKind==='robot_shell'),meshes=[],heads=[];
 // Glow sprites are intentionally excluded: they are not physical armor,
 // and Sprite.raycast requires a camera unrelated to this surface test.
 shell.traverse(o=>{if(o.isMesh)meshes.push(o);});m.userData.head.traverse(o=>{if(o.isMesh)heads.push(o);});
 const armorBounds=new T.Box3(),components=[];
 for(const mesh of meshes){
  const source=mesh.geometry,ranges=mesh.userData.testCollisionParts||[{start:0,count:source.index?.count||source.attributes.position.count,name:mesh.name,closed:true}];
  for(const range of ranges){if(!range.closed)continue;const geometry=new T.BufferGeometry();geometry.setAttribute('position',source.attributes.position);if(source.index)geometry.setIndex(source.index);geometry.setDrawRange(range.start,range.count);const bounds=new T.Box3(),point=new T.Vector3();for(let i=range.start;i<range.start+range.count;i++)bounds.expandByPoint(point.fromBufferAttribute(source.attributes.position,source.index?source.index.getX(i):i));geometry.boundingBox=bounds;geometry.boundingSphere=bounds.getBoundingSphere(new T.Sphere());const physical=new T.Mesh(geometry,mesh.material);physical.matrixAutoUpdate=false;physical.matrixWorld.copy(mesh.matrixWorld);const worldBounds=bounds.clone().applyMatrix4(mesh.matrixWorld).expandByScalar(1e-6);components.push({mesh:physical,bounds:worldBounds,name:range.name});armorBounds.union(worldBounds);}
 }
 const sides=meshes.map(o=>[o.material,o.material.side]);for(const [material]of sides)material.side=T.DoubleSide;
 const rays=[new T.Vector3(1,.073,.041).normalize(),new T.Vector3(-1,-.053,-.037).normalize()],ray=new T.Raycaster(),point=new T.Vector3(),found=new Set();
 try{for(let j=0;j<heads.length;j++){const o=heads[j],a=o.geometry.attributes.position,visited=new Set();for(let i=0;i<a.count;i++){
  const key=j+':'+[a.getX(i),a.getY(i),a.getZ(i)].join(',');if(visited.has(key))continue;visited.add(key);point.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(!armorBounds.containsPoint(point))continue;
  // Parity is checked per closed authored component, not across a batch of
  // separate shoulder volumes or open rear ornamental faces. Both directions
  // must agree; coincident triangle-edge hits count as one surface crossing.
  const inside=components.some(component=>component.bounds.containsPoint(point)&&rays.every(direction=>{ray.set(point,direction);const hits=ray.intersectObject(component.mesh,false);let crossings=0,last=-Infinity;for(const hit of hits)if(hit.distance>1e-5&&hit.distance-last>1e-5){crossings++;last=hit.distance;}return crossings%2===1;}));
  if(inside)found.add(key);
 }}return found;}finally{for(const [material,side]of sides)material.side=side;for(const component of components)component.mesh.geometry.dispose();}
}
test('short robot neck connects the unchanged head to the chassis in both sexes and all shell grades',()=>{
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const before=previousFigure(sex,tier),m=figure(sex,tier),neck=m.getObjectByName('robot-neck-joint'),oldNeck=before.getObjectByName('robot-neck-joint');
  assert.ok(neck&&oldNeck);neck.geometry.computeBoundingBox();oldNeck.geometry.computeBoundingBox();assert.ok(neck.geometry.boundingBox.getSize(new T.Vector3()).y<oldNeck.geometry.boundingBox.getSize(new T.Vector3()).y*.94,'the real joint remains shorter even with its embedded foot');assert.ok(Math.abs(neck.geometry.boundingBox.getSize(new T.Vector3()).y-.1475)<1e-6);assert.ok(m.userData.head.position.y<before.userData.head.position.y,'the head descends with the shortened joint');assert.equal(neck.position.y,1.37);
  m.updateMatrixWorld(true);const jointBounds=new T.Box3().setFromObject(neck),headBounds=new T.Box3().setFromObject(m.userData.headMesh),base=m.userData.body.getObjectByName('robot-base-chassis'),baseBounds=new T.Box3().setFromObject(base);
  assert.ok(jointBounds.min.y<=baseBounds.max.y+1e-6,'neck overlaps the bare chassis, including after armor breaks');assert.ok(jointBounds.max.y>=headBounds.min.y-1e-6,'neck overlaps the head instead of floating below the chin');
  assert.deepEqual(sculptureSnapshot(m.userData.head),sculptureSnapshot(before.userData.head),'all head triangles and expression mounts are preserved');assert.deepEqual(metrics(m),metrics(before));
  for(const key of ['body','armR','armL','legR','legL']){assert.deepEqual(m.userData[key].position.toArray(),before.userData[key].position.toArray(),key+' stays at its existing mount');assert.deepEqual(sculptureSnapshot(m.userData[key]),sculptureSnapshot(before.userData[key]),key+' sculpture and equipped parts stay unchanged');}
  assert.deepEqual(Array.from(m.userData.heroPieces.filter(p=>p.userData.baseKind==='robot_fists'),sculptureSnapshot),Array.from(before.userData.heroPieces.filter(p=>p.userData.baseKind==='robot_fists'),sculptureSnapshot),'fist equipment is not changed to hide the neck fit');assert.deepEqual(m.scale.toArray(),before.scale.toArray());release(m);release(before);
 }
});
test('neck saddles change only the inner upper shell surface, keeping tier width/depth, topology, articulation and light hardware',()=>{
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const old=previousV.gear(T,R.kind('robot_shell',tier),{sex}),now=V.gear(T,R.kind('robot_shell',tier),{sex}),before=[],after=[];old.updateMatrixWorld(true);now.updateMatrixWorld(true);old.traverse(o=>before.push(o));now.traverse(o=>after.push(o));assert.equal(after.length,before.length);assert.equal(now.userData.robotNeckClearance,true);let changed=0;
  const a=new T.Vector3(),b=new T.Vector3();
  for(let j=0;j<after.length;j++){
   const previous=before[j],current=after[j];assert.equal(current.name,previous.name);assert.deepEqual(current.position.toArray(),previous.position.toArray());assert.deepEqual(current.quaternion.toArray(),previous.quaternion.toArray());assert.deepEqual(current.scale.toArray(),previous.scale.toArray());
   if(current.isSprite){assert.deepEqual(sculptureSnapshot(current),sculptureSnapshot(previous),'glow color, radius, texture and socket positions do not change');continue;}if(!current.geometry)continue;
   const p=previous.geometry.attributes.position,q=current.geometry.attributes.position;assert.equal(q.count,p.count);assert.equal(current.geometry.index?.count,previous.geometry.index?.count);if(current.geometry.index)assert.deepEqual(Array.from(current.geometry.index.array),Array.from(previous.geometry.index.array),'neck clearance retains every original face');
   for(let i=0;i<p.count;i++){a.fromBufferAttribute(p,i).applyMatrix4(previous.matrixWorld);b.fromBufferAttribute(q,i).applyMatrix4(current.matrixWorld);assert.ok(Math.abs(a.x-b.x)<1e-6&&Math.abs(a.z-b.z)<1e-6,'the shell is not made narrower or thinner');assert.ok(b.y<=a.y+1e-6,'only the top-facing neck/shoulder corner descends');if(a.y-b.y>1e-6){changed++;assert.ok(Math.abs(a.x)<.355+1e-6&&a.y>1.27,'no legs, lower chest or outboard shoulder are reshaped');}}
  }
  assert.ok(changed>10,'the head has a real sculpted opening, not a hidden/intersecting armor surface');const aBox=new T.Box3().setFromObject(old),bBox=new T.Box3().setFromObject(now);for(const key of ['min','max'])for(const axis of ['x','z'])assert.ok(Math.abs(aBox[key][axis]-bBox[key][axis])<1e-6,'original tier width and depth are preserved');assert.ok(Math.abs(aBox.min.y-bBox.min.y)<1e-6,'the feet and shin armor stay at their existing level');assert.ok(bBox.max.y<=aBox.max.y+1e-6&&aBox.max.y-bBox.max.y<.03,'only the original inner shoulder crest peak may descend slightly');assert.deepEqual(metrics(now),metrics(old));release(now);release(old);
 }
});
test('short-neck robots retain every facial expression and reuse all resources while walking and attacking',()=>{
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const before=previousFigure(sex,tier),m=figure(sex,tier);before.userData.face.phase=m.userData.face.phase=0;before.userData.motion.phase=m.userData.motion.phase=0;
  for(const model of [before,m]){CM.update(model,1/30,0,false);V.pose(model,0,1,false,0);F.update(model,0);}
  const references=resourceReferences(m),count=metrics(m),headY=m.userData.head.position.y,neckY=m.getObjectByName('robot-neck-joint').position.y,expressions=new Set();
  for(let frame=1;frame<=160;frame++){
   const time=frame/30,mood=F.moods[Math.floor((frame-1)/20)%F.moods.length],moving=frame%24<12;
   if(frame%24===0)for(const model of [before,m])M.begin(model,'attack',1);
   for(const model of [before,m]){model.userData.mood=mood;CM.update(model,1/30,time,moving);V.pose(model,1/30,1,moving,time);F.update(model,time,mood);}
   const face=model=>[...model.userData.face.eyes,...model.userData.face.brows,model.userData.face.mouth].map(o=>({position:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray()}));assert.deepEqual(face(m),face(before),'the same expression still produces the same face pose');expressions.add(JSON.stringify(face(m)));
   assert.equal(m.userData.head.position.y,headY);assert.equal(m.getObjectByName('robot-neck-joint').position.y,neckY);
  }
  assert.ok(expressions.size>30,'the shortened robot still blinks, emotes and speaks');assert.deepEqual(resourceReferences(m),references,'walking, expressions and fist motion allocate no frame meshes, geometry, materials or textures');assert.deepEqual(metrics(m),count);release(m);release(before);
 }
});
test('component triangle probes detect a known head/armor overlap and reject an empty neck gap',()=>{
 const m=previousFigure('female',5);
 try{m.userData.head.position.y=1.54;assert.ok(penetratingHeadVertices(m,0).size>4,'the probe must detect genuine cranium/ear penetration, not always report an empty set');m.userData.head.position.y=3;assert.equal(penetratingHeadVertices(m,0).size,0,'a separated head cannot be inside the disjoint shoulder volumes');const batches=[];for(const piece of m.userData.heroPieces)piece.traverse(o=>{if(o.userData.testCollisionParts){batches.push(o);assert.equal(o.userData.testCollisionParts.reduce((n,p)=>n+p.count,0),o.geometry.attributes.position.count,'test provenance partitions every unchanged production batch triangle exactly once');}});assert.ok(batches.some(o=>o.userData.staticBatch&&o.userData.testCollisionParts.filter(p=>p.closed&&p.name==='robot-overlapping-pauldron').length===2),'the provenance instrumentation must actually partition both separate closed shoulders in the same real static batch, not silently fall back to whole-batch parity');}finally{release(m);}
});
test('short-neck robot head and ears introduce no additional real-triangle penetration into any shell tier',t=>{
 let original=0,current=0;
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const before=previousFigure(sex,tier),m=figure(sex,tier);
  try{for(const pitch of [0,-.035,.045,.12]){const old=penetratingHeadVertices(before,pitch),now=penetratingHeadVertices(m,pitch),added=[...now].filter(key=>!old.has(key));original+=old.size;current+=now.size;assert.equal(added.length,0,`${sex} tier ${tier}, pitch ${pitch}: neck trim adds ${added.length} head/ear surface penetrations beyond the pre-trim armor fit; local samples=${added.slice(0,3).join(';')}`);}}finally{release(m);release(before);}
 }
 t.diagnostic(`40 sex/tier/pose cases, original penetrations=${original}, short-neck penetrations=${current}, additional=0; test-only closed component triangle partitions, no sprite raycasts`);
});
test('male/female integrated robots have different proportions and faces, smooth pelvis and no human hair or weapons',()=>{
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const m=figure(sex,tier),size=metrics(m),names=[];m.traverse(o=>names.push(...(o.userData.authoredParts||[]),o.name));
  assert.equal(m.userData.robotLook,sex==='female'?'鈴芯':'鐵衡');assert.ok(size.meshes<85&&size.triangles<16000,JSON.stringify(size));
  assert.ok(names.includes('robot-rounded-pelvis'));assert.ok(names.includes('robot-seamless-cranium'));assert.ok(names.includes('robot-forward-knuckle'));assert.ok(names.includes('robot-flush-engraving'));
  assert.equal(names.some(n=>/hair|base-belt|skirt|shield|sword|hammer/.test(n)),false);
  assert.equal(m.userData.heroPieces.length,3);assert.equal(m.userData.heroPieces.filter(p=>p.userData.baseKind==='robot_fists').length,2);assert.equal(m.userData.hasShield,false);
  assert.ok(m.userData.face.robot);F.update(m,.8);const before=m.userData.face.brows[0].rotation.z;F.react(m,'focus',2);F.update(m,1);assert.notEqual(m.userData.face.brows[0].rotation.z,before);
  for(const p of m.userData.heroPieces)assert.ok(p.userData.integratedRobotPart);m.updateMatrixWorld(true);assert.ok(new T.Box3().setFromObject(m).max.y<2.25);release(m);
 }
 const male=figure('male'),female=figure('female');assert.ok(new T.Box3().setFromObject(male).max.y>new T.Box3().setFromObject(female).max.y+.1);assert.notEqual(V.portrait('robot','male'),V.portrait('robot','female'));release(male);release(female);
});
test('fists alternate leading hands, aim knuckles forwards and preserve location/heading across every compass direction',()=>{
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const m=figure(sex,tier);m.position.set(3,0,-5);const pieces=m.userData.heroPieces.slice();
  for(let heading=0;heading<8;heading++)for(const variant of [0,1]){
   m.rotation.y=heading*Math.PI/4;M.begin(m,'attack',1);Object.assign(M.state(m),{variant,elapsed:.48});V.pose(m,0,1,false,0);m.updateMatrixWorld(true);
   const forward=new T.Vector3(Math.sin(m.rotation.y),0,Math.cos(m.rotation.y)),right=pieces.find(p=>p.parent===m.userData.armR),left=pieces.find(p=>p.parent===m.userData.armL);
   const point=p=>p.localToWorld(new T.Vector3(...p.userData.contact.center)).sub(m.position).dot(forward);
   assert.ok(point(variant?left:right)>point(variant?right:left)+.25,'strike hand leads');
   for(const p of [right,left]){const normal=new T.Vector3(...p.userData.contact.normal).applyNormalMatrix(new T.Matrix3().getNormalMatrix(p.matrixWorld));assert.ok(normal.dot(forward)>.95);}
   assert.deepEqual(m.position.toArray(),[3,0,-5]);assert.equal(m.rotation.y,heading*Math.PI/4);assert.deepEqual(m.userData.heroPieces,pieces);
  }release(m);
 }
});
test('broken integrated parts restore the bare machine, repeated dressing preserves face and joint identities',()=>{
 const m=figure('female',5),face=m.userData.face,arms=[m.userData.armR,m.userData.armL],eq=equipment(5);const max=m.children.length;
 for(let i=0;i<10;i++){V.dress(T,m,{...eq,armor:{...eq.armor,durability:0},weapon:{...eq.weapon,durability:0}},release);assert.equal(m.userData.heroPieces.length,0);assert.ok(m.userData.baseClothing.every(p=>p.visible));assert.equal(m.userData.armRBareFist.visible,true);assert.equal(m.userData.heroWeapon,'robot_fists');V.dress(T,m,eq,release,{showHelmet:i%2===0});assert.equal(m.children.length,max);assert.equal(m.userData.face,face);assert.deepEqual([m.userData.armR,m.userData.armL],arms);}
 release(m);
});
test('shell grades visibly thicken chest, shoulders, knees and shins; armor and fists upgrade independently',()=>{
 const bounds=g=>{g.updateMatrixWorld(true);return new T.Box3().setFromObject(g).getSize(new T.Vector3());};
 for(const sex of ['male','female']){
  let previous=null;const signatures=[];
  for(let tier=1;tier<=5;tier++){
   const shell=V.gear(T,R.kind('robot_shell',tier),{sex}),size=bounds(shell),leg=shell.children.find(p=>p.userData.robotJoint==='legR'),legSize=bounds(leg),names=[];shell.traverse(p=>names.push(p.name,...(p.userData.authoredParts||[])));
   if(previous){assert.ok(size.x>previous.x+.04,'shoulder width increases every grade');assert.ok(size.z>previous.z+.025,'armor depth increases every grade');assert.ok(legSize.x>previous.legX+.01,'knees/shins increase every grade');}
   previous={x:size.x,z:size.z,legX:legSize.x};signatures.push(JSON.stringify(size.toArray()));assert.ok(names.includes('robot-tier-knee-plate')&&names.includes('robot-tier-shin-plate'));if(tier>=4)assert.ok(names.includes('robot-fortress-shoulder-guard')&&names.includes('robot-energy-knee-inlay'));release(shell);
  }assert.equal(new Set(signatures).size,5);
  const m=figure(sex,1),face=m.userData.face,eq=equipment(1),s1=m.userData.heroPieces.find(p=>p.userData.baseKind==='robot_shell'),baseShell=bounds(s1).toArray();
  eq.weapon=equipment(5).weapon;V.dress(T,m,eq,release);const s2=m.userData.heroPieces.find(p=>p.userData.baseKind==='robot_shell');assert.equal(s2.userData.tier,1);assert.deepEqual(bounds(s2).toArray(),baseShell);assert.ok(m.userData.heroPieces.filter(p=>p.userData.baseKind==='robot_fists').every(p=>p.userData.tier===5));
  eq.armor=equipment(5).armor;eq.weapon=equipment(1).weapon;V.dress(T,m,eq,release);const s3=m.userData.heroPieces.find(p=>p.userData.baseKind==='robot_shell');assert.equal(s3.userData.tier,5);assert.ok(bounds(s3).x>baseShell[0]+.2);assert.ok(m.userData.heroPieces.filter(p=>p.userData.baseKind==='robot_fists').every(p=>p.userData.tier===1));assert.equal(m.userData.face,face);
  m.userData.legR.rotation.x=.4;m.userData.legL.rotation.x=-.3;V.pose(m,0,1,false,0);for(const p of s3.children)if(p.userData.robotJoint){assert.deepEqual(p.quaternion.toArray(),m.userData[p.userData.robotJoint].quaternion.toArray());assert.deepEqual(p.position.toArray(),m.userData[p.userData.robotJoint].position.toArray());}
  assert.equal(m.userData.heroPieces.length,3);metrics(m);release(m);
 }
});
test('mechanical expressions reuse surfaces and only own bounded original 32-square core halos',()=>{
 for(const sex of ['male','female']){const m=figure(sex,5),references=[];m.traverse(o=>{references.push([o,o.geometry,o.material]);if(o.isSprite){assert.equal(o.material.map.isDataTexture,true);assert.equal(o.material.map.userData.byteBudget,4096);assert.equal(o.material.userData.robotGlow,true);}else assert.equal(o.material?.map||null,null);});let t=.2;for(const mood of F.moods){F.react(m,mood,.1);F.update(m,t,mood);t+=.3;metrics(m);}for(const time of [NaN,Infinity,-Infinity])F.update(m,time,'hurt');const after=[];m.traverse(o=>after.push([o,o.geometry,o.material]));assert.deepEqual(after,references);release(m);}
});
test('all core colors follow highest unexpired installed grade; expiry never rebuilds armor or fists',()=>{
 assert.deepEqual([...V.ROBOT_CORE_COLORS],[...R.CORE_COLORS]);
 for(const sex of ['male','female']){
  const m=figure(sex,5),eq=equipment(5),pieces=m.userData.heroPieces.slice(),refs=[];m.traverse(p=>refs.push([p,p.geometry,p.material]));let disposed=0;
  for(const [first,second,broken]of [[1,0,false],[2,1,false],[2,3,false],[4,2,false],[2,5,true],[0,0,false]]){
   eq.core1=first?{kind:R.kind('robot_core',first),slot:'core',durability:broken?0:10}:null;eq.core2=second?{kind:R.kind('robot_core',second),slot:'core',durability:broken?0:10}:null;
   const expected=R.coreLight(eq);V.dress(T,m,eq,()=>disposed++);assert.equal(disposed,0);assert.deepEqual(m.userData.heroPieces,pieces);assert.equal(m.userData.heroPieces.length,3);assert.equal(m.userData.robotLightTier,expected.tier);assert.equal(m.userData.robotLightColor,expected.color);
   let lit=0;m.traverse(p=>{if(p.material?.userData.robotEnergy){lit++;assert.equal(p.material.color.getHex(),expected.color);assert.equal(p.material.emissive.getHex(),expected.color);assert.ok(p.material.emissiveIntensity>.5);}if(p.material?.userData.robotGlow)assert.equal(p.material.color.getHex(),expected.color);assert.equal(!!p.isLight,false);});assert.ok(lit>=4);
   for(let i=0;i<5;i++){if(eq.core1)eq.core1.durability=Math.max(0,eq.core1.durability-1);V.dress(T,m,eq,()=>disposed++);}assert.equal(disposed,0);
  }
  const after=[];m.traverse(p=>after.push([p,p.geometry,p.material]));assert.deepEqual(after,refs);metrics(m);
  const broken=figure(sex,1),none={armor:null,weapon:null,core1:{kind:'robot_core_t5',slot:'core',durability:0},core2:null};V.dress(T,broken,none,release);assert.ok(broken.userData.body.visible);assert.equal(broken.userData.robotLightTier,1);assert.equal(broken.userData.heroPieces.length,0);assert.ok(broken.userData.body.children.some(p=>p.material?.userData.robotEnergy&&p.material.color.getHex()===R.CORE_COLORS[0]));release(broken);release(m);
 }
});
test('five socketed core models own finite native crystal geometry and release their resources exactly once',()=>{
 const silhouettes=[];
 for(let tier=1;tier<=5;tier++){
  const kind=R.kind('robot_core',tier),g=V.gear(T,kind),held=new Set(),counts=new Map();g.traverse(p=>{if(p.geometry)held.add(p.geometry);if(p.material){held.add(p.material);assert.equal(p.material.map||null,null);}});
  assert.equal(g.userData.baseKind,'robot_core');assert.equal(g.userData.tier,tier);assert.ok(g.children.length<=8);assert.ok(metrics(g).triangles<1500);assert.notEqual(I.svg(kind),'');
  g.updateMatrixWorld(true);silhouettes.push(JSON.stringify(new T.Box3().setFromObject(g).getSize(new T.Vector3()).toArray()));
  for(const r of held){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}release(g);assert.ok([...counts.values()].every(n=>n===1));
 }
 assert.equal(new Set(silhouettes).size,5);
});
test('rear engineering is flush, separately graded and visible from behind without a backpack or new lights',()=>{
 const names=g=>{const list=[];g.traverse(p=>list.push(p.name,...(p.userData.authoredParts||[])));return list;},count=(g,name)=>names(g).filter(n=>n===name).length;
 for(const sex of ['male','female']){
  const low=V.gear(T,'robot_shell',{sex}),high=V.gear(T,'robot_shell_t5',{sex});
  for(const shell of [low,high]){
   assert.equal(count(shell,'robot-rear-vent-recess'),2);assert.equal(count(shell,'robot-rear-energy-pipe'),2);assert.ok(count(shell,'robot-rear-spine-segment')>=3);
   let rearFaces=0;shell.traverse(p=>{assert.equal(!!p.isLight,false);if(p.userData.staticBatch){const a=p.geometry.attributes.position,n=p.geometry.attributes.normal;for(let i=0;i<a.count;i++)if(a.getZ(i)<-.22&&n.getZ(i)<-.2)rearFaces++;}});assert.ok(rearFaces>90,'back-facing engineered plates survive static batching');
   shell.updateMatrixWorld(true);assert.ok(new T.Box3().setFromObject(shell).min.z>-.44,'no detached backpack or rear pelvis block');
  }
  assert.ok(count(high,'robot-rear-cooling-slat')>count(low,'robot-rear-cooling-slat'));assert.ok(count(high,'robot-rear-spine-segment')>count(low,'robot-rear-spine-segment'));
  assert.equal(count(low,'robot-rear-core-cover'),0);assert.equal(count(high,'robot-rear-core-cover'),1);assert.equal(count(high,'robot-rear-core-engraving'),2);assert.equal(count(high,'robot-rear-abyss-chevron'),1);
  for(let tier=1;tier<=5;tier++){const shell=V.gear(T,R.kind('robot_shell',tier),{sex}),list=names(shell);assert.equal(list.includes('robot-rear-core-cover'),tier>=3);assert.equal(list.includes('robot-rear-shoulder-crest'),tier>=4);assert.equal(list.includes('robot-rear-abyss-chevron'),tier===5);release(shell);}
  const fist1=V.gear(T,'robot_fists',{sex}),fist5=V.gear(T,'robot_fists_t5',{sex});assert.equal(count(fist1,'robot-fist-rear-coupling'),1);assert.equal(count(fist1,'robot-fist-rear-power-pin'),0);assert.equal(count(fist5,'robot-fist-rear-power-pin'),1);assert.equal(count(fist5,'robot-fist-rear-vent'),2);
  const m=figure(sex,5);assert.ok(metrics(m).triangles<16000);release(m);for(const piece of [low,high,fist1,fist5])release(piece);
 }
});
test('every robot ability and integrated part has its own original icon and finite dedicated motion',()=>{
 const ids=[...R.actives,...R.passives].map(s=>s.id).concat(['steel_meteor_fist','explosive_fists','mech_aid','kinetic_core','molten_drive','core_resonance','robot','job_robot',...Object.keys(R.GEAR)]);
 for(const id of ids){assert.ok(I.ids.includes(id),id);assert.match(I.svg(id),/viewBox="0 0 64 64"/);assert.doesNotMatch(I.svg(id),/<image|href=|<text|undefined|NaN/);}
 for(const id of Object.keys(M.ROBOT_FAMILIES))for(const sex of ['male','female']){const m=figure(sex);M.begin(m,'skill',1,{id});assert.equal(M.state(m).family,M.ROBOT_FAMILIES[id]);for(let i=0;i<30;i++)assert.ok(Object.values(M.update(m,1/30)).every(Number.isFinite));release(m);}
});
test('robot filled effects are bounded, visibility gated, own no new lights and release all resources',()=>{
 for(const reducedMotion of [false,true]){const world=new T.Group(),fx=env.TowerSkillEffects.create(T,{world:()=>world,reducedMotion,visible:at=>at.x!==99});
  for(const id of Object.keys(M.ROBOT_FAMILIES)){const s=H.SKILLS[id]||{id,job:'robot',effect:id};assert.equal(fx.emit(s,{x:99,z:0}),null);for(const options of [{},{impact:true},{stage:'charge',duration:1.5},{stage:'land'}]){const f=fx.emit(s,{x:0,z:0},0,options);assert.ok(f,id);assert.ok(f.group.children.length<=8);f.group.traverse(o=>{assert.ok(!o.isLight&&!o.isLine);assert.ok(!['TorusGeometry','RingGeometry'].includes(o.geometry?.type));});fx.tick(.05);assert.ok(fx.stats().groups<=12&&fx.stats().meshes<=96);}}
  fx.destroy();assert.equal(world.children.length,0);assert.equal(fx.stats().textureBytes,0);
 }
});
