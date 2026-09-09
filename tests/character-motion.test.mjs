import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js');
const motion=require('../assets/character-motion.js'),characters=require('../story/tower-characters.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../assets/character-motion.js',import.meta.url),'utf8');
function functionSource(name,text=html){const start=text.indexOf('function '+name+'(');assert.ok(start>=0);return text.slice(start,text.indexOf('\n}',start)+2);}
const types=['boy','girl','boy','girl','robot','cat'];
function figure(index=0){
  const context=vm.createContext({THREE,window:{CharacterMotion:motion},CharacterMotion:motion});
  vm.runInContext(functionSource('buildCharacter'),context);
  return context.buildCharacter({type:types[index],shirt:0x345678,pants:0x293849,skin:0xd3ac88,hair:0x40302a});
}
const forward=(point,model)=>{const yaw=model.rotation.y;return (point.x-model.position.x)*Math.sin(yaw)+(point.z-model.position.z)*Math.cos(yaw);};
function meshBudget(model){let meshes=0,triangles=0;model.traverse(node=>{assert.ok(!node.isLight&&!node.isSprite);if(node.isMesh){meshes++;triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;assert.equal(node.material.map,null);}});return {meshes,triangles};}

test('共用姿態以瀏覽器與模組兩種方式提供，無自建計時器或動畫迴圈',()=>{
  const context=vm.createContext({});vm.runInContext(source,context);
  for(const name of ['prepare','beginAction','update','weaponPose','worldWeaponPose','buildWeapon','buildHand'])assert.equal(typeof context.CharacterMotion[name],'function');
  assert.doesNotMatch(source,/\b(?:setInterval|setTimeout|requestAnimationFrame|CanvasTexture|TextureLoader)\s*\(/);
  assert.equal(motion.prepare(null),null);assert.equal(motion.beginAction(null,'attack'),false);
});

for(let index=0;index<6;index++)test(`職業 ${index+1} 保留前向五官，增加頭部樞紐且只重用姿態物件`,()=>{
  const model=figure(index),head=model.userData.head;
  assert.equal(model.userData.frontAxis,'+Z');assert.equal(head.position.y,1.55);
  assert.ok(head.children.some(child=>child.position.z>=.25));
  const state=motion.prepare(model),budget=meshBudget(model),count=model.children.length;
  model.position.x=12;model.position.z=-7;model.rotation.y=1.7;
  for(let i=0;i<180;i++)assert.equal(motion.update(model,1/60,i/60,1,1.6),state);
  assert.equal(model.children.length,count);assert.deepEqual(meshBudget(model),budget);
  assert.equal(model.position.x,12);assert.equal(model.position.z,-7);assert.equal(model.rotation.y,1.7);
  assert.ok(Math.abs(model.userData.legL.rotation.x+model.userData.legR.rotation.x)<1e-9);
  assert.ok(Math.abs(model.rotation.z)<=.025);assert.ok(model.position.y>=0&&model.position.y<.05);
  for(let i=0;i<120;i++)motion.update(model,1/60,3+i/60,0);
  assert.ok(state.stride<1e-8);assert.ok(Math.abs(model.userData.body.scale.y-1)<.009);
});

for(const kind of ['bat','pan','staff'])test(`${kind} 揮擊全程朝模型 +Z，八種面向皆向世界正前方揮`,()=>{
  const model=figure(),weapon=characters.buildGear(kind,{THREE});
  for(let direction=0;direction<8;direction++){
    model.rotation.y=direction*Math.PI/4;model.position.set(11,0,-7);
    for(let frame=0;frame<=40;frame++){
      motion.worldWeaponPose(weapon,model,frame/40);weapon.updateMatrixWorld(true);
      const handle=weapon.localToWorld(new THREE.Vector3(0,0,0));
      const tip=weapon.localToWorld(new THREE.Vector3(0,.7,0));
      assert.ok(forward(handle,model)>.17);
      assert.ok(forward(tip,model)>forward(handle,model),`${kind} ${direction} ${frame}: 不得往背後轉`);
    }
  }
});

test('攻擊與搶奪時，垂於肩膀下方的右手確实抬向正前方',()=>{
  for(const action of ['attack','grab']){
    const model=figure();motion.beginAction(model,action,.8);
    for(let i=0;i<4;i++)motion.update(model,.1,i*.1,0);
    model.updateMatrixWorld(true);
    const hand=model.userData.armR.localToWorld(new THREE.Vector3(0,-.42,0));
    assert.ok(model.userData.armR.rotation.x<-.9);
    assert.ok(forward(hand,model)>.3);
    assert.ok(model.rotation.x>.04,'身體配合向前移重心');
    for(let i=0;i<5;i++)motion.update(model,.1,1+i*.1,0);
    assert.equal(model.userData.motion.action,'');assert.equal(model.userData.motion.strength,0);
  }
});

test('空間中武器不繼承第一人稱的隱藏狀態，仍跟隨角色且不影響面向或位置',()=>{
  const scene=new THREE.Scene(),model=figure(),state=motion.prepare(model);
  state.weapon=motion.buildWeapon(THREE,0);state.weaponWorld=true;scene.add(model,state.weapon);
  model.visible=false;model.position.set(7,0,9);model.rotation.y=Math.PI/2;
  motion.beginAction(model,'attack',.8);for(let i=0;i<4;i++)motion.update(model,.1,i*.1,0);
  assert.equal(state.weapon.parent,scene);assert.equal(state.weapon.visible,true);assert.equal(model.visible,false);
  assert.ok(state.weapon.position.x>7);assert.equal(model.position.x,7);assert.equal(model.position.z,9);
  for(let i=0;i<5;i++)motion.update(model,.1,1+i*.1,0);
  assert.equal(state.weapon.visible,false);
});

test('第一人稱抓取手只有抓取時顯示，第三人稱沿用角色的真實手臂',()=>{
  const model=figure(),state=motion.prepare(model);state.grabHand=motion.buildHand(THREE,0xcc9988);
  const scene=new THREE.Scene();scene.add(state.grabHand);
  motion.beginAction(model,'grab',.28);motion.update(model,.1,1,0,1,true);assert.equal(state.grabHand.visible,true);
  motion.update(model,.01,1.01,0,1,false);assert.equal(state.grabHand.visible,false);
  motion.update(model,.1,1.1,0,1,true);motion.update(model,.1,1.2,0,1,true);assert.equal(state.grabHand.visible,false);
  assert.ok(meshBudget(state.grabHand).meshes<=2);
});

test('第一人稱揮擊抬離畫面下緣，不改武器水平位置、方向或第三人稱姿態',()=>{
  const model=figure(),weapon=characters.buildGear('staff',{THREE});
  const camera=new THREE.PerspectiveCamera(70,844/390,.1,300);
  camera.position.set(0,1.6,0);camera.lookAt(0,1.6,1);camera.updateMatrixWorld(true);
  motion.worldWeaponPose(weapon,model,.5);const original=weapon.position.clone(),rotation=weapon.quaternion.clone();
  motion.worldWeaponPose(weapon,model,.5,true);weapon.updateMatrixWorld(true);
  assert.equal(weapon.position.x,original.x);assert.equal(weapon.position.z,original.z);
  assert.ok(Math.abs(weapon.position.y-original.y-.32)<1e-9);assert.ok(weapon.quaternion.equals(rotation));
  const tip=weapon.localToWorld(new THREE.Vector3(0,.7,0)).project(camera);
  assert.ok(tip.y>-.7&&tip.y<.3,'武器尖端需留在畫面內，而非藏在下緣');
  assert.ok(Math.abs(tip.x)<.8);
  motion.worldWeaponPose(weapon,model,.5,false);assert.ok(weapon.position.equals(original));
});

test('六職業揮擊武器有不同幾何，最多四個網格及低於二百個三角形',()=>{
  const fingerprints=new Set();
  for(let index=0;index<6;index++){
    const weapon=motion.buildWeapon(THREE,index),budget=meshBudget(weapon);
    assert.ok(budget.meshes<=4);assert.ok(budget.triangles<200);
    assert.equal(weapon.userData.shaftAxis,'+Y');assert.equal(weapon.visible,false);
    fingerprints.add(JSON.stringify(weapon.children.map(p=>[p.geometry.type,p.geometry.parameters,p.position.toArray()])));
  }
  assert.equal(fingerprints.size,6);
});

test('一般揮擊與搶奪不另外排動畫或配置重複武器，完成後隱藏可供重用',()=>{
  const model=figure(4),scene=new THREE.Scene(),context=vm.createContext({window:{CharacterMotion:motion},CharacterMotion:motion,THREE,playerGroup:model,scene,G:{charIdx:4,view:'tp'},AudioEng:{sfxHit(){}},CH:()=>({skin:0x998877})});
  vm.runInContext(functionSource('swingWeapon')+'\n'+functionSource('swingRob'),context);
  context.swingWeapon();const weapon=model.userData.motion.weapon;
  context.swingWeapon();assert.equal(scene.children.length,1);assert.equal(model.userData.motion.weapon,weapon);
  context.swingRob();assert.equal(model.userData.motion.action,'grab');
  assert.doesNotMatch(functionSource('swingWeapon')+functionSource('swingRob'),/requestAnimationFrame|setTimeout|makeEmojiSprite/);
  for(let i=0;i<10;i++)motion.update(model,.1,i*.1,0);
  assert.equal(weapon.visible,false);assert.equal(scene.children.length,1);
});

test('劇情冷卻與距離維持原規則，打空同樣啟動朝前揮擊',()=>{
  const start=tower.indexOf('  function attack()'),end=tower.indexOf('  function defeatMonster',start);
  const attackSource=tower.slice(start,end),model=figure();
  const context=vm.createContext({window:{CharacterMotion:motion},playerGroup:model,active:true,paused:false,G:{frozen:false,running:true,px:0,pz:0},run:{equipment:{weapon:{}}},attackLeft:0,monsters:[],inDungeon:()=>false,showToast(){}});
  vm.runInContext(attackSource,context);context.attack();
  assert.equal(context.attackLeft,.8);assert.equal(model.userData.motion.duration,.8);
  context.attackLeft=.4;context.attack();assert.equal(context.attackLeft,.4);
  assert.match(attackSource,/<2\.8&&hasClearPath/);assert.doesNotMatch(attackSource,/G\.heading\s*=|G\.px\s*=|G\.pz\s*=/);
  const d=html.slice(html.indexOf('function doAttack()'),html.indexOf('function myInvisSecs()'));
  assert.match(d,/meIt\?750:1500/);assert.match(d,/bd=1\.9\*1\.9/);
});

test('副本提前返回之前更新武器位置，暫停期間保持既有姿態',()=>{
  const tick=tower.slice(tower.indexOf('  function tick(dt, now)'),tower.indexOf('  function hasClearPath'));
  const pose=tick.indexOf('worldWeaponPose');assert.ok(pose>tick.indexOf('if (paused ||'));
  assert.ok(pose<tick.indexOf('if(inDungeon()){tickDungeon'),'副本移動不可將武器留在入口');
});

test('預覽只在選角頁繪製，換角色釋放前一個模型的資源',()=>{
  assert.match(functionSource('initPreview'),/profilePanel.*classList\.contains\('active'\)/);
  assert.match(functionSource('updatePreview'),/disposeSceneObject\(previewChar\)/);
});

test('劇情武器只持有一份模型；更新耐久時重用，卸下與換裝確實釋放',()=>{
  const model=figure(),scene=new THREE.Scene(),gear={id:'staff-1',slot:'weapon',kind:'staff',durability:5};scene.add(model);
  const context=vm.createContext({THREE,window:{CharacterMotion:motion},V:characters,scene,G:{view:'tp'},playerGroup:model,gearVisual:null,gearSignature:'',attackLeft:0,active:true,run:{equipment:{weapon:gear}},_texCache:{},spriteCache:{},makePickupMarker:{}});
  vm.runInContext(functionSource('disposeSceneObject'),context);
  const start=tower.indexOf('  function refreshGear()'),end=tower.indexOf('\n  }',start)+4;
  vm.runInContext(tower.slice(start,end),context);context.refreshGear();
  const weapon=context.gearVisual.userData.weapon,counts=new Map();assert.equal(weapon.parent,scene);
  weapon.traverse(object=>{for(const resource of [object.geometry,object.material])if(resource&&!counts.has(resource)){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}});
  gear.durability=4;context.refreshGear();assert.equal(context.gearVisual.userData.weapon,weapon);assert.ok([...counts.values()].every(n=>n===0));
  context.run.equipment.weapon=null;context.refreshGear();assert.equal(weapon.parent,null);assert.ok([...counts.values()].every(n=>n===1));
  context.run.equipment.weapon={...gear,id:'staff-2'};context.refreshGear();assert.notEqual(context.gearVisual.userData.weapon,weapon);assert.equal(context.gearVisual.userData.weapon.parent,scene);
});
