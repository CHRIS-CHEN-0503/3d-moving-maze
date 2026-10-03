import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),M=require('../assets/character-motion.js');
const S=require('../assets/character-sculpt.js'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function buildCharacter('),build=html.slice(start,html.indexOf('\n}',start)+2);
const env=vm.createContext({THREE:T,CharacterSculpt:S,CharacterMotion:M,window:{CharacterMotion:M}});
vm.runInContext(build,env);
vm.runInContext(readFileSync(new URL('../story/tower-characters.js',import.meta.url),'utf8'),env);
const V=env.TowerCharacters,close=(a,b,note='')=>assert.ok(Math.abs(a-b)<1e-6,`${note}: ${a} != ${b}`);
const figure=()=>env.buildCharacter({type:'boy',shirt:0x345678,pants:0x293849,skin:0xd3ac88,hair:0x40302a});
const strikeTimes=[.30,.34,.38,.42,.46];

// Resolve the physical mesh face in the authored weapon frame, including
// child-mesh rotations. This also works for the guard's mounted hammer.
function physicalContact(weapon,origin,direction){
  weapon.updateWorldMatrix(true,true);
  const ray=new T.Raycaster(weapon.localToWorld(new T.Vector3(...origin)),new T.Vector3(...direction).transformDirection(weapon.matrixWorld));
  const hit=ray.intersectObject(weapon,true)[0];assert.ok(hit,'the ray must meet a real weapon surface');
  const relative=new T.Matrix4().copy(weapon.matrixWorld).invert().multiply(hit.object.matrixWorld);
  return {point:weapon.worldToLocal(hit.point.clone()),normal:hit.face.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(relative)),object:hit.object};
}
function budget(model){
  let meshes=0,triangles=0;
  model.traverse(p=>{assert.ok(!p.isLight&&!p.isSprite);if(p.isMesh){meshes++;triangles+=(p.geometry.index?.count||p.geometry.attributes.position.count)/3;assert.equal(p.material.map,null);assert.equal(p.castShadow,false);}});
  return {meshes,triangles};
}
function frame(weapon,model,contact,time,firstPerson){
  M.worldWeaponPose(weapon,model,time,firstPerson);weapon.updateMatrixWorld(true);
  return {point:weapon.localToWorld(contact.point.clone()),normal:contact.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(weapon.matrixWorld)),flat:new T.Vector3(0,0,1).transformDirection(weapon.matrixWorld)};
}
function sweep(weapon,model,contact,time,firstPerson){
  const before=frame(weapon,model,contact,time-.001,firstPerson),after=frame(weapon,model,contact,time+.001,firstPerson),current=frame(weapon,model,contact,time,firstPerson);
  current.velocity=after.point.sub(before.point);assert.ok(current.velocity.length()>1e-5,'the striking surface must move');current.velocity.normalize();return current;
}

test('classic wooden sword has two real narrow cutting edges and pans expose their solid rear bottom',()=>{
  const sword=M.buildWeapon(T,0);assert.equal(sword.userData.weaponKind,'wood_sword');
  for(const side of [-1,1]){
    const hit=physicalContact(sword,[side,.48,0],[-side,0,0]);
    close(hit.point.x,side*.0525,'wood blade edge');close(hit.point.y,.48);close(hit.point.z,0);close(hit.normal.x,side);
  }
  close(sword.userData.contact.center[0],.0525);assert.deepEqual(Array.from(sword.userData.contact.oppositeNormal),[-1,0,0]);
  for(const [weapon,y,z]of [[M.buildWeapon(T,1),.51,-.0325],[V.buildGear('pan',{THREE:T}),.5,-.0225]]){
    assert.equal(weapon.userData.weaponKind,'pan');const hit=physicalContact(weapon,[0,y,-1],[0,0,1]);
    close(hit.point.z,z,'solid pan bottom');close(hit.normal.z,-1);close(hit.normal.x,0);close(hit.normal.y,0);
    close(weapon.userData.contact.center[2],hit.point.z);assert.deepEqual(Array.from(weapon.userData.contact.normal),[0,0,-1]);
    assert.notEqual(hit.object.name,'pan-cooking-surface');
  }
});

test('legacy bat and staff contact points lie on their actual authored model surface',()=>{
  for(const [kind,y,z,name]of [['bat',.485,.066,'bat-barrel'],['staff',.677,.059,'staff-stone']]){
    const weapon=V.buildGear(kind,{THREE:T}),hit=physicalContact(weapon,[0,y,1],[0,0,-1]);
    assert.equal(weapon.userData.weaponKind,kind);assert.equal(hit.object.name,name);close(hit.point.z,z);close(weapon.userData.contact.center[2],hit.point.z);
    assert.ok(hit.normal.z>.55,'the functional side is on the authored front of the weapon');
  }
});

test('classic and legacy weapons use their physical contact surface during the strike in all eight headings and both views',()=>{
  const cases=[
    {name:'wooden sword',weapon:M.buildWeapon(T,0),origin:[-1,.48,0],direction:[1,0,0],min:.85,blade:true},
    {name:'classic pan',weapon:M.buildWeapon(T,1),origin:[0,.51,-1],direction:[0,0,1],min:.90},
    {name:'legacy pan',weapon:V.buildGear('pan',{THREE:T}),origin:[0,.5,-1],direction:[0,0,1],min:.90},
    {name:'legacy bat',weapon:V.buildGear('bat',{THREE:T}),origin:[0,.485,1],direction:[0,0,-1],min:.85},
  ];
  for(const {name,weapon,origin,direction,min,blade}of cases){
    const model=figure(),contact=physicalContact(weapon,origin,direction),initialBudget=budget(weapon),references=[];
    weapon.traverse(p=>references.push([p,p.geometry,p.material]));model.position.set(11,0,-7);
    for(let heading=0;heading<8;heading++)for(const firstPerson of [false,true]){
      model.rotation.y=heading*Math.PI/4;const forward=new T.Vector3(Math.sin(model.rotation.y),0,Math.cos(model.rotation.y));
      for(const time of strikeTimes){
        const p=sweep(weapon,model,contact,time,firstPerson),label=`${name}, heading ${heading}, first person ${firstPerson}, time ${time}`;
        assert.ok(p.normal.dot(p.velocity)>min,`${label}: the physical striking face must lead (${p.normal.dot(p.velocity)})`);
        assert.ok(p.point.clone().sub(model.position).dot(forward)>.3,`${label}: contact stays ahead of the actor`);
        if(blade)assert.ok(Math.abs(p.flat.dot(p.velocity))<.45,`${label}: the blade flat must not slap`);
        if(!firstPerson){const hand=model.userData.armR.localToWorld(new T.Vector3(0,-.36,.045));assert.ok(weapon.position.distanceTo(hand)<1e-6,'the weapon remains held at the real right hand');}
        assert.deepEqual(model.position.toArray(),[11,0,-7]);assert.equal(model.rotation.y,heading*Math.PI/4);
      }
    }
    const after=[];weapon.traverse(p=>after.push([p,p.geometry,p.material]));assert.deepEqual(after,references);assert.deepEqual(budget(weapon),initialBudget);
  }
});

test('the five-rank legacy guard has two gold end faces on the hammer axis, not its decorated side',()=>{
  const guard=V.buildWarrior(5,{THREE:T}),weapon=guard.userData.guardBlade;
  for(const side of [-1,1]){
    const hit=physicalContact(weapon,[0,.64,side], [0,0,-side]);
    assert.equal(hit.object.name,'hammer-gold-cap');assert.equal(hit.object.material.color.getHex(),V.WARRIOR_STYLES[5].metal);
    close(hit.point.z,side*.28,'gold striking face');close(hit.normal.z,side);close(hit.normal.x,0);close(hit.normal.y,0);
  }
  assert.deepEqual(Array.from(weapon.userData.contact.center),[0,.64,.28]);assert.deepEqual(Array.from(weapon.userData.contact.normal),[0,0,1]);
  const decoration=weapon.getObjectByName('hammer-star');assert.ok(decoration.position.x>.15);close(decoration.position.z,0);
});

test('the actual legacy holding update drives the gold hammer face toward the monster with a slower recovery',()=>{
  const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),start=tower.indexOf('  function updateWarrior(dt,now)'),end=tower.indexOf('\n  function ',start+5);
  assert.ok(start>=0&&end>start);const source=tower.slice(start,end);
  for(let heading=0;heading<8;heading++)for(const wallBlocksOffset of [false,true]){
    const scene=new T.Group(),model=V.buildWarrior(5,{THREE:T}),monster=new T.Group();scene.add(model,monster);scene.rotation.y=heading*Math.PI/4;scene.position.set(11,0,-7);monster.position.set(2,0,3);
    const weapon=model.userData.guardBlade,contact=physicalContact(weapon,[0,.64,1],[0,0,-1]);
    const run={warrior:{mode:'holding',strength:5},monsterStuns:{monster:1}},context=vm.createContext({escort:{model},run,monsters:[{id:'monster',alive:true,model:monster}],isHeld:()=>true,playerInWall:()=>wallBlocksOffset,guardClashAt:Infinity,AudioEng:{},G:{px:0,pz:0}});
    vm.runInContext(source,context);
    function sample(now){context.updateWarrior(1/60,now);scene.updateMatrixWorld(true);return {point:weapon.localToWorld(contact.point.clone()),normal:contact.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(weapon.matrixWorld))};}
    for(const phase of [.08,.16,.24,.32,.39]){
      const now=phase*1400,before=sample(now-1),after=sample(now+1),p=sample(now),velocity=after.point.sub(before.point).normalize();
      assert.ok(p.normal.dot(velocity)>.90,'the physical gold face leads the clash');
      const towardMonster=monster.getWorldPosition(new T.Vector3()).sub(model.getWorldPosition(new T.Vector3())).normalize(),actorForward=new T.Vector3(0,0,1).transformDirection(model.matrixWorld);
      assert.ok(actorForward.dot(towardMonster)>.9999,'the guard faces the held monster');assert.ok(p.point.clone().sub(model.getWorldPosition(new T.Vector3())).dot(towardMonster)>.3,'the gold face reaches the monster side of the guard');
      assert.ok(velocity.dot(towardMonster)>0,'the whole impact stroke advances toward the held monster');
      assert.equal(weapon.parent,model.userData.armR);assert.deepEqual(weapon.position.toArray(),[0,-.35,.13]);
    }
    const impactSpeed=sample(1400*.16+1).point.sub(sample(1400*.16-1).point).length(),recoverySpeed=sample(1400*(1-.16/.42*.58)+1).point.sub(sample(1400*(1-.16/.42*.58)-1).point).length();
    assert.ok(impactSpeed>recoverySpeed*1.3,'recovery is slower than impact at the same angle');
  }
});

test('classic and legacy contact corrections stay within their existing mobile mesh budgets',t=>{
  let classicMax=0,legacyMax=0;
  for(let index=0;index<6;index++){const b=budget(M.buildWeapon(T,index));assert.ok(b.meshes<=7&&b.triangles<350);classicMax=Math.max(classicMax,b.triangles);}
  for(const kind of ['bat','pan','staff']){const b=budget(V.buildGear(kind,{THREE:T}));assert.ok(b.meshes<=8&&b.triangles<900,`${kind}: ${JSON.stringify(b)}`);legacyMax=Math.max(legacyMax,b.triangles);}
  const hammer=budget(V.buildWarrior(5,{THREE:T}).userData.guardBlade);assert.ok(hammer.meshes<=5&&hammer.triangles<800,JSON.stringify(hammer));
  t.diagnostic(`classic max ${classicMax} triangles; legacy max ${legacyMax}; guard hammer ${hammer.triangles}; no textures, lights or shadow draws`);
});
