import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),R=require('../story/tower-robot-core.js'),M=require('../story/tower-combat-motion.js'),I=require('../story/tower-heroes-icons.js'),F=require('../assets/character-face.js');
const env=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:require('../assets/character-sculpt.js'),CharacterFace:F,CharacterMotion:require('../assets/character-motion.js'),TowerCombatMotion:M});
for(const file of ['tower-heroes-visuals.js','tower-skill-effects.js'])vm.runInContext(readFileSync(new URL('../story/'+file,import.meta.url),'utf8'),env);
const V=env.TowerHeroVisuals;
function release(model){const gs=new Set(),ms=new Set();model.traverse(o=>{if(o.geometry&&(o.isMesh||o.isPoints))gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
const equipment=t=>Object.fromEntries(['armor','weapon'].map(slot=>{const kind=R.kind(slot==='armor'?'robot_shell':'robot_fists',t);return [slot,{kind,slot,durability:100}];}));
function figure(sex,tier=1){const m=V.base('robot',()=>{throw Error('human builder must not run');},'hero',sex);V.dress(T,m,equipment(tier),release);return m;}
function metrics(m){let meshes=0,triangles=0;m.traverse(o=>{assert.equal(!!o.isLight,false);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}for(const key of ['position','normal'])if(o.geometry?.attributes[key])assert.ok(Array.from(o.geometry.attributes[key].array).every(Number.isFinite));});return {meshes,triangles};}
test('male/female integrated robots have different proportions and faces, smooth pelvis and no human hair or weapons',()=>{
 for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  const m=figure(sex,tier),size=metrics(m),names=[];m.traverse(o=>names.push(...(o.userData.authoredParts||[]),o.name));
  assert.equal(m.userData.robotLook,sex==='female'?'鈴芯':'鐵衡');assert.ok(size.meshes<85&&size.triangles<16000,JSON.stringify(size));
  assert.ok(names.includes('robot-rounded-pelvis'));assert.ok(names.includes('robot-seamless-cranium'));assert.ok(names.includes('robot-forward-knuckle'));assert.ok(names.includes('robot-flush-engraving'));
  assert.equal(names.some(n=>/hair|base-belt|skirt|shield|sword|hammer/.test(n)),false);
  assert.equal(m.userData.heroPieces.length,3);assert.equal(m.userData.heroPieces.filter(p=>p.userData.baseKind==='robot_fists').length,2);assert.equal(m.userData.hasShield,false);
  assert.ok(m.userData.face.robot);const before=m.userData.face.brows[0].rotation.z;F.react(m,'focus',2);F.update(m,1);assert.notEqual(m.userData.face.brows[0].rotation.z,before);
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
test('mechanical expressions and inlaid metal surfaces stay texture-free and reuse their resources',()=>{
 for(const sex of ['male','female']){const m=figure(sex,5),references=[];m.traverse(o=>{references.push([o,o.geometry,o.material]);assert.equal(o.material?.map||null,null);});let t=.2;for(const mood of F.moods){F.react(m,mood,.1);F.update(m,t,mood);t+=.3;metrics(m);}for(const time of [NaN,Infinity,-Infinity])F.update(m,time,'hurt');const after=[];m.traverse(o=>after.push([o,o.geometry,o.material]));assert.deepEqual(after,references);release(m);}
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
