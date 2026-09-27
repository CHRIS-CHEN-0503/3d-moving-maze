import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Map=require('../assets/magic-map.js'),Rules=require('../assets/game-rules.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const walls=(w,h)=>({hWalls:Array.from({length:h-1},()=>Array(w).fill(true)),vWalls:Array.from({length:h},()=>Array(w-1).fill(true))});
function canvas(){const rects=[];return{rects,save(){},restore(){},fillRect(...r){rects.push(r);}};}

test('劇情固定有迷霧；其他模式預設關閉，搶購不提供此設定',()=>{
  for(const mode of ['classic','race','tag','treasure','ctf']){
    assert.equal(Map.enabled(false,mode,Rules.normalize()),false);
    assert.equal(Map.enabled(false,mode,{magicMap:1}),true);
    assert.equal(Map.enabled(true,mode,{magicMap:0}),true);
    assert.ok(Rules.visible(mode).includes('magicMap'));
  }
  assert.equal(Map.enabled(false,'shop',{magicMap:1}),false);assert.equal(Map.enabled(true,'shop',{magicMap:1}),false);
  assert.ok(!Rules.visible('shop').includes('magicMap'));
});
test('探索沿走廊擴散兩格、不穿牆，已探索道路持續保留',()=>{
  const s=Map.create(5,5),w=walls(5,5);w.vWalls[0][0]=false;w.hWalls[0][1]=false;w.hWalls[1][1]=false;
  Map.explore(s,0,0,w.hWalls,w.vWalls);assert.deepEqual(Array.from(s.seen).flatMap((v,i)=>v?[i]:[]),[0,1,6]);
  Map.explore(s,4,4,w.hWalls,w.vWalls);assert.equal(s.seen[0],1);assert.equal(s.seen[24],1);assert.equal(s.seen[11],0);
});
test('拾取永久揭露當下迷宮，時間和路線倒數不影響；同尺寸變形也重置',()=>{
  const w=walls(5,5),options={w:5,h:5,x:0,y:0,...w,pad:12,cw:10,ch:10};
  Map.reset(5,5);let ctx=canvas();Map.mask(ctx,options);assert.equal(ctx.rects.length,24);
  Map.reveal();assert.equal(Map.isRevealed(),true);
  for(let i=0;i<100;i++){ctx=canvas();Map.mask(ctx,options);assert.equal(ctx.rects.length,0);}
  Map.reset(5,5);ctx=canvas();Map.mask(ctx,options);assert.equal(ctx.rects.length,24);assert.equal(Map.isRevealed(),false);
});
test('存檔保留相同迷宮的揭露，尺寸／牆面改變或損壞資料不能沿用',()=>{
  const w=walls(5,5);Map.reset(5,5);Map.reveal();const saved=Map.snapshot(w.hWalls,w.vWalls);
  Map.reset(5,5);assert.equal(Map.restore(saved,w.hWalls,w.vWalls),true);assert.equal(Map.isRevealed(),true);
  Map.reset(5,5);w.hWalls[0][0]=false;assert.equal(Map.restore(saved,w.hWalls,w.vWalls),false);assert.equal(Map.isRevealed(),false);
  for(const bad of [null,{...saved,w:6},{...saved,seen:'11'},{...saved,seen:'x'.repeat(25)},{...saved,revealed:'yes'}])assert.equal(Map.restore(bad,w.hWalls,w.vWalls),false);
  assert.throws(()=>Map.create(1e9,1e9),RangeError);
});

function spawning(size,enabled=true,story=false,shop=false){
  class Group{constructor(){this.children=[];}add(...a){this.children.push(...a);}remove(o){this.children=this.children.filter(c=>c!==o);}}
  const sprite=()=>({position:{set(){}},visible:true}),config={itemCount:6,foodCount:4,magicMap:enabled?1:0};let seed=17;
  const c=vm.createContext({THREE:{Group},MagicMap:Map,scene:new Group(),itemGroup:null,
    G:{mazeW:size,mazeH:size,exitCell:{x:size-1,y:size-1},px:0,pz:0,lvlIdx:0,items:[],foods:[],startCells:[{x:0,y:0}]},
    MP:{on:false,mode:'classic'},RNG:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},
    LEVELS:[{id:'castle'}],ENV_ITEMS:{castle:{id:'envkey',emoji:'key'}},ITEM_TYPES:[{id:'speed',emoji:'speed',weight:1},{id:'map',emoji:'map',weight:1}],FOOD_TYPES:[{id:'bread',emoji:'bread',weight:1}],
    isShop:()=>shop,matchRules:()=>config,worldToCell:(x,z)=>({x,y:z}),cellToWorld:(x,y)=>({x,z:y}),disposeSceneObject(){},makeEmojiSprite:sprite,makePickupMarker:sprite,
    TowerMode:{active:story,preserveFloorPickups:()=>false,itemConfig:()=>config,reservedCells:()=>[],canCollectOriginal:()=>true}});
  c.window=c;vm.runInContext(block('function pickItemType(', '/* 飽足感 */'),c);return{c,config};
}
for(const size of [7,9,11,13,15,19,25])test(size+' 格：魔法地圖額外生成，設定道具與食物數量不減少',()=>{
  const {c,config}=spawning(size);c.spawnItems();
  assert.equal(c.G.items.filter(i=>i.magicMap).length,size<=11?1:2);
  assert.equal(c.G.items.filter(i=>i.type.id==='speed').length,config.itemCount);
  assert.equal(c.G.items.filter(i=>i.type.id==='envkey').length,1);
  assert.equal(c.G.foods.length,config.foodCount);
  const positions=[...c.G.items,...c.G.foods].map(i=>i.x+','+i.z);assert.equal(new Set(positions).size,positions.length);
  assert.ok(!positions.includes('0,0'));assert.ok(!positions.includes((size-1)+','+(size-1)));
});
test('劇情變形只補額外魔法地圖，不重生普通道具／食物、不累積地圖模型',()=>{
  const {c}=spawning(13,false,true);c.spawnItems();
  const ordinary=c.G.items.filter(i=>!i.magicMap),foods=c.G.foods,oldMap=c.G.items.find(i=>i.magicMap);ordinary[0].taken=true;oldMap.taken=true;
  c.TowerMode.preserveFloorPickups=()=>true;
  const count=c.itemGroup.children.length;
  for(let i=0;i<4;i++){c.spawnItems();assert.equal(c.G.items.filter(i=>i.magicMap).length,2);assert.equal(c.itemGroup.children.length,count);}
  assert.ok(c.G.items.includes(ordinary[0]));assert.equal(ordinary[0].taken,true);assert.equal(c.G.foods,foods);assert.ok(!c.G.items.includes(oldMap));
});
test('道具數量的最小／最大設定均保留原配額，重建也只額外增加地圖',()=>{
  for(const size of [11,13,25])for(const amount of [3,6,12]){
    const {c,config}=spawning(size);config.itemCount=amount;
    for(let round=0;round<3;round++){
      c.spawnItems();assert.equal(c.G.items.filter(i=>i.type.id==='speed').length,amount);
      assert.equal(c.G.items.filter(i=>i.magicMap).length,size<=11?1:2);
    }
  }
});
test('單人魔法地圖不直接生成在目前站立格，副本物件也避開額外地圖',()=>{
  const {c}=spawning(13);c.G.px=6;c.G.pz=6;c.spawnItems();
  assert.ok(c.G.items.filter(i=>i.magicMap).every(i=>i.x!==6||i.z!==6));
  const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  const start=tower.indexOf('const originalPickups =');
  assert.ok(start>=0&&start<tower.indexOf('if(inDungeon()){buildDungeonWorld'));
});
test('關閉迷霧時保留原道具池，搶購不額外產生魔法地圖',()=>{
  const off=spawning(11,false);off.c.spawnItems();assert.equal(off.c.G.items.filter(i=>i.magicMap).length,0);
  const shop=spawning(13,true,false,true);shop.c.itemGroup=new shop.c.THREE.Group();shop.c.spawnMagicMaps();assert.equal(shop.c.G.items.length,0);
});
test('多人同種子相同地圖位置；個別玩家所在位置不改變額外生成結果',()=>{
  const a=spawning(13),b=spawning(13);a.c.MP.on=b.c.MP.on=true;b.c.G.px=8;b.c.G.pz=9;
  a.c.spawnItems();b.c.spawnItems();
  const layout=c=>JSON.stringify(c.G.items.map(i=>[i.type.id,i.x,i.z,!!i.magicMap]));assert.equal(layout(a.c),layout(b.c));
});
test('劇情交易與讀檔保留有效探索紀錄，舊存檔及損壞的可選紀錄可安全讀取',()=>{
  const Core=require('../story/story-core.js'),run=Core.newRun({seed:123}),w=walls(7,7);
  assert.ok(Core.validateSave(run));Map.reset(7,7);Map.reveal();run.engine.mapKnowledge=Map.snapshot(w.hWalls,w.vWalls);
  assert.equal(Core.validateSave(run).engine.mapKnowledge.revealed,true);
  assert.equal(Core.useItem(run,'map').run.engine.mapKnowledge.revealed,true);
  run.engine.mapKnowledge={w:1e9,h:1e9,seen:'bad'};const valid=Core.validateSave(run);assert.ok(valid);assert.equal(valid.engine.mapKnowledge,undefined);
});
test('拾取與劇情背包使用都揭露地圖；迷宮生成入口一律重置',()=>{
  assert.match(block('function applyItem(', '/* 城堡魔法鑰匙'),/MagicMap\.reveal\(\)/);
  assert.match(block('function genMaze(', 'function buildWalls('),/MagicMap\?\.reset\(W,H\)/);
  const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(tower,/if\(id==='map'\)\{window.MagicMap\?\.reveal\(\)/);
  assert.doesNotMatch(block('function drawMap(', 'const _projV'),/reveal:performance/);
});
