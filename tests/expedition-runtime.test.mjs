import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),E=require('../story/tower-encounters.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__expedition = {
  setup(value) { run=value;active=true;paused=false;floorStarted=true;floorConfig=C.floorConfig(run.floor);hurtLeft=0;world=new THREE.Group(); },
  entities(value) { if('explorer'in value)explorer=value.explorer;if('chest'in value)chest=value.chest;if('relic'in value)relic=value.relic;if('monsters'in value)monsters=value.monsters;if('nearest'in value)nearest=value.nearest; },
  state(){return {run,paused,explorer,chest,relic,exitDeclined};},
  questEvent,questDialog,nearExplorer,updateExplorer,openChest,chestDialog,
  handleAction,closeDialog,save,readSave,attack,inventory,trade,requestQuit,
};`;

function runAt(floor=99,seed=1){const run=C.newRun({seed});run.floor=floor;run.floorsCleared=99-floor;return run;}
function findRun(predicate,floor=99){for(let seed=1;seed<10000;seed++){const run=runAt(floor,seed);if(predicate(run))return run;}assert.fail('Fixture seed not found');}
function accepted(type,floor=99){const run=findRun(r=>E.explorerOffer(r)?.type===type,floor);return E.acceptQuest(run,E.explorerOffer(run).id).run;}
function harness(run){
  let now=1000;
  const nodes=new Map(),storage=new Map(),messages=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:true,textContent:'',innerHTML:'',isConnected:true,focus(){},classList:{add(){},remove(){},toggle(){}}});return nodes.get(id);};
  class Vector{constructor(){this.set(0,0,0);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){return this.set(v.x,v.y,v.z);}}
  class Group{constructor(){this.position=new Vector();this.rotation=new Vector();this.scale=new Vector().set(1,1,1);this.userData={};this.children=[];this.visible=true;}add(item){this.children.push(item);}remove(item){this.children=this.children.filter(c=>c!==item);}}
  class Material{constructor(options={}){Object.assign(this,options);this.color={setHex(){}};}}
  class Sprite extends Group{constructor(material){super();this.material=material;}}
  const G={running:true,frozen:false,shifting:false,satiety:run.hunger,px:0,pz:0,startTime:100,shovels:1,kites:0,whistles:0,shovelRechargeAt:0,skillCoolUntil:0,effects:{},invisUntil:0,mazeW:C.floorConfig(run.floor).size,mazeH:C.floorConfig(run.floor).size,cell:4,exitCell:{x:6,y:6}};
  const context=vm.createContext({
    window:{TowerCore:C,TowerEncounters:E},THREE:{Group,Sprite,SpriteMaterial:Material,CanvasTexture:class{}},G,
    document:{getElementById:node,activeElement:node('focus'),body:{classList:{add(){},remove(){},toggle(){}}},createElement:()=>({getContext:()=>({strokeText(){},fillText(){}})})},
    keys:{},joy:{active:false,dx:0,dy:0},performance:{now:()=>now},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    escapeHtml:value=>String(value),showToast:value=>messages.push(value),AudioEng:{sfxPickup(){},sfxTick(){},stopMusic(){},stopItemLoop(){}},
    playerInWall:()=>false,worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),cellToWorld:(x,y)=>({x:x*4,z:y*4}),solveMaze:(x,y,ex=x,ey=y)=>[[x,y],[ex,ey]],
    swingWeapon(){},disposeSceneObject(){},cancelSceneTransition(){},switchScreen:screen=>{context.screen=screen;},
  });
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,bridge),context,{filename:'tower-mode.js'});
  const api=context.window.__expedition;api.setup(run);
  const actor=(x=0,z=0)=>{const model=new Group();model.position.set(x,0,z);model.userData.legL=new Group();model.userData.legR=new Group();return {x,z,cx:x/4,cy:z/4,model,path:[],pathLeft:0};};
  if(E.explorerOffer(run))api.entities({explorer:{...actor(1,0),offer:E.explorerOffer(run)}});
  const tick=seconds=>{now+=seconds*1000;context.window.TowerMode.tick(seconds,now);};
  return {api,context,nodes,storage,messages,actor,tick,now:()=>now};
}

test('任務對話只顯示條件，接受按鈕才建立委託且不能遠距接受',()=>{
  const run=findRun(r=>E.explorerOffer(r)?.type==='survey'),h=harness(run);
  h.api.questDialog();assert.match(h.nodes.get('towerDialog').innerHTML,/接受委託/);assert.equal(h.api.state().run.adventure.quest,null);
  h.api.closeDialog();assert.equal(h.api.state().run.adventure.quest,null);
  const id=E.explorerOffer(run).id;h.context.G.px=100;h.api.handleAction('quest-accept',id);assert.equal(h.api.state().run.adventure.quest,null);
  h.context.G.px=0;h.api.questDialog();h.api.handleAction('quest-accept',id);assert.equal(h.api.state().run.adventure.quest.type,'survey');assert.ok(C.validateSave(h.api.state().run));
});

test('實際走入三個格子更新探索任務，站著不動不重複計算',()=>{
  const h=harness(accepted('survey'));h.tick(.1);assert.equal(h.api.state().run.adventure.quest.progress,1);
  h.tick(.1);assert.equal(h.api.state().run.adventure.quest.progress,1);
  h.context.G.px=4;h.tick(.1);h.context.G.px=8;h.tick(.1);assert.equal(h.api.state().run.adventure.quest.status,'ready');
  h.api.save();assert.equal(h.api.readSave().adventure.quest.progress,3);
});

test('拾取任務遺物使目標消失並保存完成狀態，領賞須回到旅人身邊',()=>{
  const run=accepted('relic'),h=harness(run),relic=h.actor(0,0);h.api.entities({relic});
  h.tick(.1);assert.equal(h.api.state().run.adventure.quest.status,'ready');assert.equal(relic.model.visible,false);
  const coins=h.api.state().run.coins;h.context.G.px=100;h.api.handleAction('quest-reward');assert.equal(h.api.state().run.coins,coins);assert.equal(h.api.state().run.adventure.quest.status,'ready');
  h.context.G.px=0;h.api.handleAction('quest-reward');assert.equal(h.api.state().run.adventure.quest.status,'claimed');assert.ok(h.api.state().run.coins>coins);
  const after=JSON.stringify(h.api.state().run);h.api.handleAction('quest-reward');assert.equal(JSON.stringify(h.api.state().run),after);
  h.api.save();assert.equal(h.api.readSave().adventure.quest.status,'claimed');
});

test('未結案委託到出口先確認，取消與重複碰門不得偷偷下降',()=>{
  const h=harness(accepted('relic')),floor=h.api.state().run.floor;
  h.context.window.TowerMode.reachExit();assert.equal(h.api.state().run.floor,floor);assert.equal(h.api.state().paused,true);
  assert.match(h.nodes.get('towerDialog').innerHTML,/放棄|未完成|未結/);
  h.api.closeDialog();h.context.window.TowerMode.reachExit();assert.equal(h.api.state().run.floor,floor);
  h.api.handleAction('exit-confirm');assert.equal(h.api.state().run.floor,floor-1);assert.equal(h.api.state().run.adventure.quest,null);
  h.api.handleAction('exit-confirm');assert.equal(h.api.state().run.floor,floor-1);
});

test('護送者會沿通道跟隨，但隔牆或未跟到出口不能完成',()=>{
  const h=harness(accepted('escort')),explorer=h.api.state().explorer;explorer.model.position.set(8,0,0);
  const before=explorer.model.position.x;h.api.updateExplorer(.1,h.now());assert.ok(explorer.model.position.x<before);
  h.context.playerInWall=()=>true;const blocked=explorer.model.position.x;h.api.updateExplorer(.1,h.now());assert.equal(explorer.model.position.x,blocked);
  const portal=h.context.cellToWorld(h.context.G.exitCell.x,h.context.G.exitCell.y);
  h.context.G.px=portal.x;h.context.G.pz=portal.z;explorer.model.position.set(portal.x+1,0,portal.z);
  h.context.window.TowerMode.reachExit();assert.equal(h.api.state().run.adventure.quest.status,'active');assert.equal(h.api.state().run.floor,99);
  h.api.closeDialog();h.context.playerInWall=()=>false;h.context.G.px=portal.x-4;h.tick(0);h.context.G.px=portal.x;explorer.model.position.set(portal.x+1,0,portal.z);
  h.context.window.TowerMode.reachExit();assert.equal(h.api.state().run.adventure.quest.status,'ready');assert.equal(h.api.state().run.floor,99);
});

test('陷阱開箱先確認，防具減傷耗耐久且保存後無法重開',()=>{
  const run=findRun(r=>E.chestOffer(r.floor,r.seed)?.outcome==='trap'),helmet=C.createGear('helmet',99,run.seed,'test-helmet');run.equipment.helmet=helmet;
  const h=harness(run),offer=E.chestOffer(run.floor,run.seed),chest={...h.actor(0,0),offer};h.api.entities({chest});
  h.api.chestDialog();assert.equal(h.api.state().run.hp,100);assert.equal(h.api.state().run.equipment.helmet.durability,helmet.durability);
  h.api.openChest(offer.id);assert.equal(h.api.state().run.hp,100-offer.damage+helmet.defense);assert.equal(h.api.state().run.equipment.helmet.durability,helmet.durability-1);assert.equal(chest.model.visible,false);
  h.api.save();const saved=h.api.readSave();assert.ok(saved.adventure.claimed.includes(offer.id));assert.equal(E.openChest(saved,offer.id).ok,false);
});

test('裝備商店購買進行囊，不自動替換武器，確認裝備才穿戴',()=>{
  const run=runAt();run.coins=999;const h=harness(run),offer=E.merchantOffers(run.floor,run.seed)[0],shop={...h.actor(1,0),id:offer.id,name:offer.name,offer};h.api.entities({nearest:shop});
  const originalWeapon=run.equipment.weapon.id;h.api.trade();h.api.handleAction('buy-gear',offer.gear[1].kind);
  assert.equal(h.api.state().run.gearBag.length,1);assert.equal(h.api.state().run.equipment.weapon.id,originalWeapon);
  const bought=h.api.state().run.gearBag[0];h.api.handleAction('equip',bought.id);assert.equal(h.api.state().run.equipment.weapon.id,bought.id);assert.ok(h.api.state().run.gearBag.some(g=>g.id===originalWeapon));
  assert.ok(C.validateSave(h.api.state().run));
});

test('保存回首頁失敗時保留委託，真正保存成功才解除並退出',()=>{
  const h=harness(accepted('relic')),quest=JSON.stringify(h.api.state().run.adventure.quest);
  h.api.requestQuit();assert.equal(JSON.stringify(h.api.state().run.adventure.quest),quest);
  const write=h.context.localStorage.setItem;h.context.localStorage.setItem=()=>{throw new Error('quota');};
  h.api.handleAction('home');assert.equal(h.context.window.TowerMode.active,true);assert.equal(JSON.stringify(h.api.state().run.adventure.quest),quest);
  h.context.localStorage.setItem=write;h.api.handleAction('home');
  assert.equal(h.context.window.TowerMode.active,false);assert.equal(h.api.readSave().adventure.quest,null);assert.equal(h.context.screen,'titleScreen');
});

test('戰鬥委託說明指定怪名與強度，只標記目標且完成後取消標記',()=>{
  const run=accepted('stun',60),h=harness(run),config=C.floorConfig(run.floor);
  const monsters=Array.from({length:config.monsterCount},(_,i)=>{
    const actor=h.actor(32+i*4,32),kind=config.monsterTypes[i%config.monsterTypes.length],def=C.MONSTERS[kind];
    actor.model.userData.body={position:{}};actor.model.userData.ring={material:{}};
    actor.model.userData.tag=new h.context.THREE.Sprite({});actor.model.add(actor.model.userData.tag);
    return {...actor,id:'monster-'+i,kind,def,strength:C.monsterStrength(kind,run.floor),alive:true,hp:60,phase:i,cooldown:2,windup:0};
  });
  h.api.entities({monsters});h.api.questDialog();
  const target=monsters.find(m=>m.id===run.adventure.quest.target),other=monsters.find(m=>m!==target);
  assert.ok(other);assert.match(h.nodes.get('towerDialog').innerHTML,new RegExp('目標：'+target.def.name));
  assert.match(h.nodes.get('towerDialog').innerHTML,new RegExp('原始強度 '+target.strength+'/5'));
  h.api.closeDialog();h.tick(.05);assert.equal(target.questLabel,true);assert.equal(other.questLabel,false);
  const tag=target.model.userData.tag;h.tick(.05);assert.equal(target.model.userData.tag,tag,'狀態未變時不可每影格重畫頭頂標籤');
  h.api.state().run.monsterStuns[target.id]=10;assert.equal(h.api.questEvent('stun',{monsterId:target.id}),true);
  h.tick(.05);assert.equal(h.api.state().run.adventure.quest.status,'ready');assert.equal(target.questLabel,false);assert.equal(other.questLabel,false);assert.notEqual(target.model.userData.tag,tag);
});
