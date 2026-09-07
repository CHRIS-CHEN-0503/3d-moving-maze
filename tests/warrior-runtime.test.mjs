import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../story/story-core.js');
const encounters = require('../story/tower-encounters.js');
const source = readFileSync(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
// This bridge exists only in tests. Production keeps its private state private.
const bridge = `window.__warriorTest = {
  setup(value) {
    run=value; active=true; paused=false; floorStarted=true;
    floorConfig=C.floorConfig(run.floor); hurtLeft=0;
    G.mazeW=G.mazeH=floorConfig.size;
    G.exitCell={x:G.mazeW-1,y:G.mazeH-1}; buildWorld();
  },
  state() { return {run,monsters,traders,loot,warriorNpc,nearestWarrior,escort,paused}; },
  clearScenery() { traders=[];loot=[];nearest=null;nearestWarrior=null;explorer=chest=relic=nearbyEncounter=null; },
  approachWarrior() { nearestWarrior=warriorNpc;nearest=null;G.px=warriorNpc.x;G.pz=warriorNpc.z; },
  replaceMonsters(value) { monsters=value; },
  shifted() { wasShifting=true;G.shifting=false; },
  updateWarrior,updateMonster,isHeld,warriorDialog,hireWarrior,trade,
  restoreWarriorPosition,dialog,closeDialog,save,readSave,attack,
};`;
assert.match(source, /  install\(\);\s*\}\)\(\);\s*$/);

function runtime(run) {
  let now = 1000;
  const nodes = new Map(), storage = new Map(), messages = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { style:{},hidden:true,textContent:'',innerHTML:'',isConnected:true,focus(){},classList:{add(){},remove(){},toggle(){}} });
    return nodes.get(id);
  };
  class Vector {
    constructor() { this.set(0,0,0); }
    set(x,y,z) { this.x=x;this.y=y;this.z=z;return this; }
    copy(v) { return this.set(v.x,v.y,v.z); }
    distanceTo(v) { return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z); }
    lerp(v,t) { this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this; }
  }
  class Object3D {
    constructor() { this.position=new Vector();this.rotation=new Vector();this.scale=new Vector().set(1,1,1);this.userData={};this.children=[];this.visible=true; }
    add(...items) { this.children.push(...items); }
    remove(item) { this.children=this.children.filter(child=>child!==item); }
  }
  class Color { constructor(value) { this.value=value; } setHex(value) { this.value=value; } }
  class Material { constructor(options={}) { Object.assign(this,options);this.color=new Color(options.color); } }
  class Mesh extends Object3D { constructor(geometry,material) { super();this.geometry=geometry;this.material=material; } }
  class Sprite extends Object3D { constructor(material) { super();this.material=material; } }
  class Geometry {}
  const character=()=>{const model=new Object3D();model.userData.legL=new Object3D();model.userData.legR=new Object3D();return model;};
  const THREE={Group:Object3D,Mesh,Sprite,Color,Vector3:Vector,MeshLambertMaterial:Material,MeshBasicMaterial:Material,SpriteMaterial:Material,CanvasTexture:Geometry};
  for(const id of ['CylinderGeometry','BoxGeometry','OctahedronGeometry','ConeGeometry','SphereGeometry','TorusGeometry'])THREE[id]=Geometry;
  const G={running:true,frozen:false,shifting:false,satiety:100,px:0,pz:0,startTime:100,shovels:1,kites:0,whistles:0,shovelRechargeAt:0,skillCoolUntil:0,effects:{},cell:4,mazeW:7,mazeH:7,invisUntil:0,items:[],foods:[]};
  const context=vm.createContext({
    window:{TowerCore:core,TowerEncounters:encounters,TowerCharacters:{buildMerchant:character,buildExplorer:character,buildChest:()=>new Object3D()}},THREE,G,scene:new Object3D(),wallMesh:new Mesh(new Geometry(),new Material()),
    document:{getElementById:node,activeElement:node('focus'),body:{classList:{add(){},remove(){},toggle(){}}},createElement:()=>({getContext:()=>({strokeText(){},fillText(){}})})},
    performance:{now:()=>now},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    keys:{},joy:{active:false,dx:0,dy:0},escapeHtml:value=>String(value),
    CHARS:Array.from({length:6},(_,id)=>({id})),buildCharacter:character,makeTextSprite:()=>new Object3D(),makePickupMarker:()=>new Object3D(),disposeSceneObject(){},
    mulberry32:seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;},
    cellToWorld:(x,y)=>({x:x*4,z:y*4}),worldToCell:(x,z)=>({x:Math.max(0,Math.min(G.mazeW-1,Math.round(x/4))),y:Math.max(0,Math.min(G.mazeH-1,Math.round(z/4)))}),
    solveMaze:(x,y,ex=G.mazeW-1,ey=G.mazeH-1)=>[[x,y],[x,Math.min(y+1,G.mazeH-1)],[ex,ey]],
    playerInWall:()=>false,showToast:message=>messages.push(message),AudioEng:{sfxTick(){},sfxPickup(){}},swingWeapon(){},
  });
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,bridge),context,{filename:'tower-mode.js'});
  const api=context.window.__warriorTest;
  api.setup(run);api.clearScenery();
  const tick=seconds=>{now+=seconds*1000;context.window.TowerMode.tick(seconds,now);};
  return {context,api,nodes,storage,messages,tick,now:()=>now};
}

function hiredRun(strength=1,floor=60) {
  const hireFloor=strength===1?99:19;
  let seed=1,offer;
  while(seed<10000){offer=core.warriorOffer(hireFloor,seed);if(offer?.strength===strength)break;seed++;}
  assert.ok(offer?.strength===strength,'Test must use a real generated contract');
  const original=core.newRun({seed});original.floor=hireFloor;original.floorsCleared=99-hireFloor;
  original.coins=999;for(const id of Object.keys(original.bag))original.bag[id]=10;
  const result=core.hireWarrior(original,offer.id);assert.equal(result.ok,true);
  result.run.floor=floor;result.run.floorsCleared=99-floor;
  return result.run;
}

function positionThreat(h,kind='sentinel',id='monster-0',distance=1.4) {
  const def=core.MONSTERS[kind],model=new h.context.THREE.Group();model.position.set(distance,0,0);
  model.userData.body={position:{}};model.userData.ring={material:{}};
  return {id,kind,def,strength:core.monsterStrength(kind,h.api.state().run.floor),phase:Number(id.split('-').at(-1))||0,hp:60,alive:true,path:[],pathLeft:1,cooldown:0,windup:0,model,cx:0,cy:0,x:distance,z:0};
}

test('戰士報價與取消不收費，確認委託只支付一次',()=>{
  const h=runtime(core.newRun({seed:123}));h.api.approachWarrior();
  const before=JSON.stringify(h.api.state().run);h.api.trade();
  assert.match(h.nodes.get('towerDialog').innerHTML,/戰士|護路劍士/);
  assert.equal(JSON.stringify(h.api.state().run),before);
  h.api.closeDialog();assert.equal(JSON.stringify(h.api.state().run),before);
  const id=h.api.state().warriorNpc.offer.id;h.api.trade();h.api.hireWarrior(id);
  assert.equal(h.api.state().run.bag.ration,1);assert.equal(h.api.state().run.warrior.strength,1);
  const after=JSON.stringify(h.api.state().run);h.api.hireWarrior(id);
  assert.equal(JSON.stringify(h.api.state().run),after,'重複點擊不能再扣款');
});

test('護行者只攔截一隻怪物，且不會隔牆觸發委託',()=>{
  const h=runtime(hiredRun()),first=positionThreat(h),second=positionThreat(h,'sentinel','monster-1',1.7);
  h.api.replaceMonsters([first,second]);h.context.playerInWall=()=>true;h.api.updateWarrior(.05,h.now());
  assert.equal(h.api.state().run.warrior.mode,'escort');
  h.context.playerInWall=()=>false;h.api.updateWarrior(.05,h.now());
  assert.equal(h.api.state().run.warrior.mode,'holding');assert.equal(h.api.isHeld(first),true);assert.equal(h.api.isHeld(second),false);
  first.windup=.01;second.windup=.01;h.api.updateMonster(first,.05,h.now());
  assert.equal(h.api.state().run.hp,100,'牽制中的怪物不可攻擊主角');
  h.api.updateMonster(second,.05,h.now());assert.equal(h.api.state().run.hp,85,'另一隻怪物仍能攻擊，護衛不是全域無敵');
});

test('一分戰士牽制三分怪物一分鐘，到期後怪物恢復行動',()=>{
  const h=runtime(hiredRun()),monster=positionThreat(h);h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  assert.equal(h.api.state().run.warrior.remaining,60);
  for(let second=0;second<59;second++)h.tick(1);
  assert.equal(h.api.state().run.warrior.remaining,1);assert.equal(h.api.state().run.hp,100);
  h.tick(1);assert.equal(h.api.state().run.warrior,null);assert.equal(h.api.isHeld(monster),false);assert.equal(monster.alive,true);
});

test('牽制倒數在背包與迷宮變形期間停止，保存後仍保留剩餘秒數',()=>{
  const h=runtime(hiredRun()),monster=positionThreat(h,'sentinel','monster-1');h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  h.tick(7);h.api.dialog('背包','暫停','','','');h.tick(30);
  assert.equal(h.api.state().run.warrior.remaining,53);
  h.api.closeDialog();h.context.G.shifting=true;h.tick(20);assert.equal(h.api.state().run.warrior.remaining,53);
  h.api.shifted();h.tick(0);assert.equal(h.api.isHeld(monster),true);assert.equal(h.api.state().run.warrior.remaining,53);
  assert.equal(h.api.save(),true);const saved=h.api.readSave();assert.equal(saved.warrior.remaining,53);
  const restored=runtime(saved);const matching=restored.api.state().monsters.find(m=>m.id===saved.warrior.targetId);
  assert.ok(matching);assert.equal(restored.api.isHeld(matching),true);assert.equal(restored.api.state().run.warrior.remaining,53);
});

test('同分持續抵抗但下降後留在原層，不把牽制狀態帶到下一層',()=>{
  const h=runtime(hiredRun(3)),monster=positionThreat(h);h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  assert.equal(h.api.state().run.warrior.remaining,null);
  for(let second=0;second<65;second++)h.tick(1);
  assert.equal(h.api.isHeld(monster),true);assert.equal(h.api.state().run.hp,100);
  h.context.window.TowerMode.reachExit();assert.equal(h.api.state().run.floor,59);assert.equal(h.api.state().run.warrior,null);
});

test('五分戰士立即解決三分怪物，剩餘二分續行且怪物不會復活或重複領賞',()=>{
  const h=runtime(hiredRun(5,19)),monster=positionThreat(h,'wisp');h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  assert.equal(monster.alive,false);assert.equal(monster.model.visible,false);
  assert.equal(h.api.state().run.warrior.strength,2);assert.equal(h.api.state().run.warrior.mode,'escort');
  assert.ok(h.api.state().run.defeatedMonsters.includes(monster.id));
  const coins=h.api.state().run.coins;h.api.updateWarrior(.05,h.now());assert.equal(h.api.state().run.coins,coins);
  h.api.save();const restored=runtime(h.api.readSave());
  assert.equal(restored.api.state().monsters.find(m=>m.id===monster.id).alive,false,'讀檔後也不能再領同一隻怪物的獎勵');
  h.context.window.TowerMode.reachExit();assert.equal(h.api.state().run.floor,18);assert.equal(h.api.state().run.warrior.strength,2);
});

test('主角擊暈同分對手，護衛以減少後的分數擊殺並保留一分續行',()=>{
  const h=runtime(hiredRun(3)),monster=positionThreat(h);h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  assert.equal(h.api.state().run.warrior.remaining,null);
  const durability=h.api.state().run.equipment.weapon.durability;h.api.attack();
  assert.equal(monster.alive,false);assert.equal(h.api.state().run.warrior.mode,'escort');
  assert.equal(h.api.state().run.warrior.strength,1);assert.equal(h.api.state().run.warrior.targetId,null);
  assert.equal(h.api.state().run.equipment.weapon.durability,durability-1);
  assert.equal(h.api.state().run.monsterStuns[monster.id],undefined);
  assert.equal(h.api.save(),true);assert.ok(h.api.readSave(),'解除牽制後保存可讀取的護行狀態');
});

test('武器只會擊暈；一分護衛無法因三分怪被擊暈就直接擊殺',()=>{
  const h=runtime(hiredRun()),monster=positionThreat(h);h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  monster.hp=1;const durability=h.api.state().run.equipment.weapon.durability;h.api.attack();
  assert.equal(monster.alive,true);assert.equal(monster.hp,1,'劇情武器不能扣怪物生命值');
  assert.equal(h.api.state().run.monsterStuns[monster.id],10);
  assert.equal(h.api.state().run.warrior.mode,'holding');assert.equal(h.api.state().run.warrior.remaining,60);
  assert.equal(h.api.state().run.equipment.weapon.durability,durability-1);
  assert.equal(h.api.save(),true);assert.ok(h.api.readSave());
});

test('怪物暈眩期間不能移動或攻擊，且主角空揮不消耗耐久',()=>{
  const run=hiredRun();run.warrior=null;
  const h=runtime(run),monster=positionThreat(h);h.api.replaceMonsters([monster]);
  h.context.playerInWall=()=>true;
  const durability=h.api.state().run.equipment.weapon.durability;
  h.api.attack();assert.equal(h.api.state().run.equipment.weapon.durability,durability);
  h.context.playerInWall=()=>false;h.tick(.8);h.api.attack();
  const position={x:monster.model.position.x,z:monster.model.position.z};
  monster.windup=.01;monster.path=[[2,0]];monster.pathLeft=2;
  h.api.updateMonster(monster,.2,h.now());
  assert.equal(h.api.state().run.hp,100);
  assert.deepEqual({x:monster.model.position.x,z:monster.model.position.z},position);
  assert.equal(monster.windup,0);assert.equal(monster.path.length,0);
  assert.equal(monster.alive,true);
  assert.equal(h.api.state().run.equipment.weapon.durability,durability-1);
});

test('暈眩造成的暫時同分在恢復後轉限時，已開始的倒數不會刷新',()=>{
  let run=core.hitMonster(hiredRun(2),'monster-0',3).run;
  const h=runtime(run),monster=positionThreat(h);h.api.replaceMonsters([monster]);h.api.updateWarrior(.05,h.now());
  assert.equal(h.api.state().run.warrior.remaining,null);
  h.api.updateMonster(monster,.05,h.now());
  for(let second=0;second<10;second++)h.tick(1);
  assert.equal(h.api.state().run.monsterStuns[monster.id],undefined);
  assert.equal(h.api.state().run.warrior.remaining,120);
  h.tick(20);assert.equal(h.api.state().run.warrior.remaining,100);
  h.api.updateMonster(monster,.05,h.now());assert.equal(h.api.state().run.warrior.remaining,100);
  h.api.save();assert.equal(h.api.readSave().warrior.remaining,100);
});

test('續讀時重評已恢復強度的怪物，不能留下永久牽制漏洞',()=>{
  let run=core.hitMonster(hiredRun(2),'monster-0',3).run;
  run=core.interceptMonster(run,'monster-0',2).run;
  run=core.tickEffects(run,10).run;
  assert.equal(run.warrior.remaining,null);
  const h=runtime(run),monster=positionThreat(h);h.api.replaceMonsters([monster]);
  h.api.updateMonster(monster,.05,h.now());
  assert.equal(h.api.state().run.warrior.remaining,120);
  assert.equal(monster.alive,true);
});
