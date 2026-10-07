import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js'),motion=require('../assets/character-motion.js'),Face=require('../assets/character-face.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const types=['boy','girl','boy','girl','robot','cat'];
function figure(index=0){
  const start=html.indexOf('function buildCharacter('),source=html.slice(start,html.indexOf('\n}',start)+2);
  const context=vm.createContext({THREE,window:{CharacterMotion:motion,CharacterFace:Face},CharacterFace:Face,CharacterMotion:motion,CharacterSculpt:require('../assets/character-sculpt.js')});
  vm.runInContext(source,context);
  return context.buildCharacter({type:types[index],shirt:0x345678,pants:0x293849,skin:0xd3ac88,hair:0x40302a});
}
function countMatrixRefreshes(run){
  const proto=THREE.Object3D.prototype,original=proto.updateMatrixWorld;let calls=0;
  proto.updateMatrixWorld=function(...args){calls++;return original.apply(this,args);};
  try{run();}finally{proto.updateMatrixWorld=original;}
  return calls;
}
const near=(a,b)=>a.distanceTo(b)<1e-9;

test('robot cheeks stay out of the draw list on every frame and mood; human and cat cheeks keep their rules',()=>{
  const robot=figure(4),face=robot.userData.face;
  assert.equal(face.robot,true);assert.equal(face.cheeks.length,2);assert.ok(face.cheeks.every(c=>!c.visible),'hidden at creation');
  let time=1;
  for(const mood of Face.moods)for(let frame=0;frame<8;frame++){Face.update(robot,time,mood);time+=.1;assert.ok(face.cheeks.every(c=>!c.visible),mood);}
  const human=figure(0);let t=1;Face.update(human,t,'calm');assert.ok(human.userData.face.cheeks.every(c=>c.visible));
  for(const mood of ['hurt','tired']){Face.update(human,t+=.3,mood);assert.ok(human.userData.face.cheeks.every(c=>!c.visible),mood);}
  Face.update(human,t+=.3,'happy');assert.ok(human.userData.face.cheeks.every(c=>c.visible));
  const cat=figure(5);Face.update(cat,2,'calm');assert.ok(cat.userData.face.cheeks.every(c=>!c.visible));
  let visibleDraws=0;robot.traverse(o=>{if(o.isMesh&&o.visible&&o.material.transparent&&o.material.opacity<=.12)visibleDraws++;});
  assert.equal(visibleDraws,0,'no transparent invisible blush draw remains on a robot');
});

test('an idle weapon and an idle first-person hand cost no pose and no matrix refresh',()=>{
  const model=figure(0),state=motion.prepare(model),scene=new THREE.Scene();
  state.weapon=motion.buildWeapon(THREE,0);state.weaponWorld=true;state.grabHand=motion.buildHand(THREE,0xcc9988);scene.add(model,state.weapon,state.grabHand);
  state.weapon.position.set(9,9,9);state.grabHand.position.set(8,8,8);
  const calls=countMatrixRefreshes(()=>{for(let i=0;i<120;i++){motion.update(model,1/60,i/60,0);motion.update(model,1/60,i/60,1,1,true);}});
  assert.equal(calls,0);assert.deepEqual(state.weapon.position.toArray(),[9,9,9]);assert.deepEqual(state.grabHand.position.toArray(),[8,8,8]);
  assert.equal(state.weapon.visible,false);assert.equal(state.grabHand.visible,false);
});

test('attack frames pose the weapon on the real right hand with only the arm chain refreshed',()=>{
  for(const index of [0,1,4]){
    const model=figure(index),state=motion.prepare(model),scene=new THREE.Scene(),parent=new THREE.Group();
    parent.position.set(-3,0,5);parent.rotation.y=.4;parent.updateMatrixWorld(true);scene.add(parent);parent.add(model);
    state.weapon=motion.buildWeapon(THREE,index);state.weaponWorld=true;scene.add(state.weapon);
    model.position.set(7,0,-4);model.rotation.y=1.1;motion.beginAction(model,'attack',.6);
    let frames=0;
    for(let i=0;i<20;i++){
      const calls=countMatrixRefreshes(()=>motion.update(model,1/30,i/30,1));
      assert.equal(calls,0,'no whole-tree refresh');
      if(state.action!=='attack'&&!state.weapon.visible)continue;
      frames++;
      const chain=model.userData.armR.matrixWorld.clone(),grip=state.weapon.position.clone();
      model.updateMatrixWorld(true);
      assert.ok(chain.equals(model.userData.armR.matrixWorld)||chain.elements.every((v,k)=>Math.abs(v-model.userData.armR.matrixWorld.elements[k])<1e-12),'chain matrix equals the full refresh');
      assert.ok(near(grip,model.userData.armR.localToWorld(new THREE.Vector3(0,-.36,.045))),'grip stays in the right hand');
    }
    assert.ok(frames>=10);
  }
});

test('worldWeaponPose still works for nested arms, and falls back to a full refresh for a foreign limb',()=>{
  const model=new THREE.Group(),shoulder=new THREE.Group(),arm=new THREE.Group(),weapon=motion.buildWeapon(THREE,0);
  model.position.set(2,0,1);model.rotation.y=.7;shoulder.position.set(-.4,1.3,0);shoulder.rotation.z=.2;arm.position.set(0,-.1,.05);arm.rotation.x=-.6;
  model.add(shoulder);shoulder.add(arm);model.userData={armR:arm};
  motion.worldWeaponPose(weapon,model,.5);
  model.updateMatrixWorld(true);assert.ok(near(weapon.position,arm.localToWorld(new THREE.Vector3(0,-.36,.045))));
  const stranger=new THREE.Group();stranger.position.set(5,5,5);model.userData={armR:stranger};
  const calls=countMatrixRefreshes(()=>motion.worldWeaponPose(weapon,model,.5));
  assert.equal(calls,3,'foreign limb takes the original whole-model refresh (model, shoulder, arm)');
  assert.ok(Number.isFinite(weapon.position.x));
});
