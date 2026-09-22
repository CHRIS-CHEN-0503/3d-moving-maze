import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js');
const shop=readFileSync(new URL('../assets/shop-chaos.js',import.meta.url),'utf8'),rage=readFileSync(new URL('../assets/tag-rage.js',import.meta.url),'utf8');
function harness(mode='shop'){
  let time=100000;const nodes=new Map(),sent=[],messages=[];
  const c=vm.createContext({THREE,window:{},scene:new THREE.Scene(),playerGroup:new THREE.Group(),performance:{now:()=>time},Date:{now:()=>time},
    G:{mazeW:13,mazeH:13,cell:4,px:0,pz:0,heading:0,wallBoxes:[],startCells:[{x:0,y:0}],registers:[],stunnedUntil:0,atkCoolUntil:0},
    MP:{mode,on:true,host:true,id:'h',started:true,ended:false,seed:71,seriesRound:1,round:0,order:['h','g'],roster:[{id:'h'},{id:'g'}],players:{g:{mesh:new THREE.Group(),th:0}},taggedId:'h',bots:[]},
    $:id=>{if(!nodes.has(id))nodes.set(id,{style:{},textContent:'',onclick(){},setAttribute(k,v){this[k]=v;}});return nodes.get(id);},
    matchRules:()=>({itemCount:6}),isCheckingOut:()=>false,
    isShop:()=>mode==='shop',cellToWorld:(x,y)=>({x:(x-6)*4,z:(y-6)*4}),
    makeTextSprite:()=>new THREE.Group(),disposeSceneObject(){},mpFrame(){},mpHandle(){},botWalk(){},playerInWall:()=>false,bindActionBtn:(el,fn)=>{el.onclick=fn;},
    cancelCheckout(){},addEffect(){},showToast:s=>messages.push(s),mpSend:m=>sent.push(m),
    mpName:id=>id,mpUpdateTagVisuals(){},mpLeave(){},swingWeapon(){},doAttack(){},AudioEng:{sfxBreak(){}},burstParticles(){}});
  c.botPosOf=id=>id==='h'?{x:c.G.px,z:c.G.pz}:id==='g'?{x:50,z:50}:null;
  c.removeWallBox=w=>c.G.wallBoxes.splice(c.G.wallBoxes.indexOf(w),1);
  c.RoomLifecycle={sendLocal:m=>{const packet={...m,f:'h',sr:1};sent.push(packet);c.mpHandle(packet);}};
  vm.runInContext(mode==='shop'?shop:rage,c);
  return {c,nodes,sent,messages,advance:ms=>time+=ms};
}
test('油漬精確反向十秒、黏板定身五秒，不可由訪客偽造效果',()=>{
  const h=harness();h.c.window.ShopChaos.start();
  h.c.mpHandle({t:'chaoseffect',f:'g',sr:1,round:0,trap:0,id:'h',kind:'oil'});assert.equal(h.c.window.ShopChaos.input(1,0,'h').x,1);
  h.c.mpHandle({t:'chaoseffect',f:'h',sr:1,round:0,trap:0,id:'h',kind:'oil'});assert.equal(h.c.window.ShopChaos.input(1,-1,'h').x,-1);
  h.advance(10000);assert.equal(h.c.window.ShopChaos.input(1,0,'h').x,1);
  h.c.mpHandle({t:'chaoseffect',f:'h',sr:1,round:0,trap:1,id:'h',kind:'glue'});assert.equal(h.c.window.ShopChaos.speed('h'),0);
  assert.equal(h.messages.at(-1),'踩到黏鼠板，走不動了！');assert.doesNotMatch(h.messages.at(-1),/定身|秒/);
  h.advance(5000);assert.equal(h.c.window.ShopChaos.speed('h'),1);
});
test('陷阱重播不延長效果；新回合重建，離開會釋放場景',()=>{
  const h=harness();h.c.window.ShopChaos.start();const p={t:'chaoseffect',f:'h',sr:1,round:0,trap:0,id:'h',kind:'oil'};
  h.c.mpHandle(p);h.advance(9000);h.c.mpHandle(p);h.advance(1000);assert.equal(h.c.window.ShopChaos.input(1,0,'h').x,1);
  h.c.window.ShopChaos.start();assert.equal(h.c.scene.children.length,1);h.c.window.ShopChaos.stop();assert.equal(h.c.scene.children.length,0);
});
test('同種子地面配置一致、所有陷阱與出生區保持安全距離',()=>{
  const a=harness(),b=harness();a.c.window.ShopChaos.start();b.c.window.ShopChaos.start();
  const positions=h=>h.c.scene.children[0].children.map(x=>x.position.toArray());
  assert.deepEqual(positions(a),positions(b));assert.ok(positions(a).length>=6);
  for(const [x,,z] of positions(a))assert.ok(Math.hypot(x+24,z+24)>=6);
});
function loot(h,box=0,kind='boost',id='h',from='h',round=0){h.c.mpHandle({t:'chaosloot',f:from,sr:1,round,box,kind,id});}
function drop(h){h.c.mpHandle({t:'chaosdrop',f:'h',sr:1,round:h.c.MP.round});}
test('空手開局，不可免費放陷阱；道具箱限三個、不可重複領取或由訪客偽造',()=>{
  const h=harness();h.c.window.ShopChaos.start();assert.equal(h.nodes.get('shopTrapBtn').style.display,'none');drop(h);assert.equal(h.sent.length,0);
  loot(h,0,'boost','h','g');assert.equal(h.nodes.get('shopTrapBtn').style.display,'none');
  loot(h);loot(h);assert.equal(h.nodes.get('shopTrapCount').textContent,1);
  loot(h,1);loot(h,2);loot(h,3);assert.equal(h.nodes.get('shopTrapCount').textContent,3);
  drop(h);assert.equal(h.c.window.ShopChaos.speed('h'),1.5);const first=h.sent.at(-1);h.c.mpHandle(first);drop(h);assert.equal(h.sent.length,1);
  h.advance(5000);assert.equal(h.c.window.ShopChaos.speed('h'),1);drop(h);assert.equal(h.sent.length,2);
});
test('實際走近問號箱由房主抽取一次，滿背包不吃掉道具箱',()=>{
  const h=harness();h.c.window.ShopChaos.start();const box=h.c.scene.children[0].children.find(x=>x.userData.shopBox===0);
  h.c.G.px=box.position.x;h.c.G.pz=box.position.z;h.c.window.ShopChaos.tick(.2);
  assert.equal(h.sent.filter(x=>x.t==='chaosloot').length,1);assert.equal(box.visible,false);
  h.c.window.ShopChaos.tick(.2);assert.equal(h.sent.filter(x=>x.t==='chaosloot').length,1);
});
test('迷宮變形改變配置、保留取得的道具，不接受舊地圖封包；新輪清空',()=>{
  const h=harness(),api=h.c.window.ShopChaos;api.start();loot(h);
  const positions=()=>JSON.stringify(h.c.scene.children[0].children.map(x=>x.position.toArray())),before=positions();
  h.c.MP.round=1;api.rebuild();assert.notEqual(positions(),before);assert.equal(h.c.scene.children.length,1);
  loot(h,1,'boost','h','h',0);api.tick(.2);assert.equal(h.nodes.get('shopTrapCount').textContent,1);
  drop(h);assert.equal(api.speed('h'),1.5);api.start();assert.equal(h.nodes.get('shopTrapBtn').style.display,'none');assert.equal(api.speed('h'),1);
});
test('雞蛋朝前命中且不可穿牆、不可在結帳時使用',()=>{
  for(const blocked of [false,true]){
    const h=harness();h.c.botPosOf=id=>id==='h'?{x:0,z:0}:{x:0,z:5};h.c.playerInWall=(x,z)=>blocked&&z>2;
    h.c.window.ShopChaos.start();loot(h,0,'egg');h.c.isCheckingOut=()=>true;drop(h);assert.equal(h.sent.length,0);
    h.c.isCheckingOut=()=>false;drop(h);const packet=h.sent.at(-1);assert.equal(packet.kind,'egg');assert.equal(packet.target,blocked?'':'g');assert.ok(packet.ez>0);
    const guest=harness();guest.c.MP.id='g';guest.c.MP.host=false;guest.c.window.ShopChaos.start();loot(guest,0,'egg');guest.c.mpHandle(packet);
    guest.advance(350);guest.c.window.ShopChaos.tick(.01);assert.equal(guest.nodes.get('shopEggSplat').hidden,blocked);
    guest.advance(5000);guest.c.window.ShopChaos.tick(.01);assert.equal(guest.nodes.get('shopEggSplat').hidden,true);
  }
});
test('鬼連續一分鐘沒抓人變身，地圖越大越久，到期恢复身形',()=>{
  const h=harness('tag'),api=h.c.window.TagRage;api.tick();h.advance(59999);api.tick();assert.equal(api.raging('h'),false);
  h.advance(201);api.tick();assert.equal(api.raging('h'),true);assert.equal(h.c.playerGroup.scale.x,1.5);
  assert.equal(api.duration(11),30000);assert.equal(api.duration(13),45000);assert.equal(api.duration(15),45000);assert.equal(api.duration(19),60000);assert.equal(api.duration(25),60000);
  h.advance(45000);api.tick();assert.equal(api.raging('h'),false);assert.equal(h.c.playerGroup.scale.x,1);
});
test('換鬼重算六十秒；狼牙棒只移除房主確認的同回合內牆',()=>{
  const h=harness('tag'),api=h.c.window.TagRage;api.tick();h.advance(60000);api.tick();
  const inner={type:'v',gx:1,gy:2,minX:-1,maxX:1,minZ:1,maxZ:1.5},outer={...inner,boundary:true,gx:0};h.c.G.wallBoxes=[inner,outer];
  h.c.mpHandle({t:'ragewall',f:'g',sr:1,round:0,id:'h',wall:inner});assert.equal(h.c.G.wallBoxes.length,2);
  h.c.mpHandle({t:'rageswing',f:'h',sr:1});assert.equal(h.c.G.wallBoxes.length,1);assert.equal(h.c.G.wallBoxes[0].boundary,true);
  h.c.MP.taggedId='g';h.advance(250);api.tick();assert.equal(api.raging('h'),false);assert.equal(api.raging('g'),false);
  h.advance(60000);api.tick();assert.equal(api.raging('g'),true);
});
test('賣場內牆大幅減少且各格仍連通',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),src=html.match(/function genMaze\(fromX,fromY\)\{[\s\S]*?\n\}/)[0];
  for(const size of [9,13,19]){let s=71;const c=vm.createContext({G:{mazeW:size,mazeH:size},isShop:()=>true,RNG:()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}});vm.runInContext(src,c);c.genMaze(0,0);
    const walls=c.G.hWalls.flat().filter(Boolean).length+c.G.vWalls.flat().filter(Boolean).length;assert.ok(walls<size*size*.35);
    const seen=new Set(['0,0']),todo=[[0,0]];
    while(todo.length){const[x,y]=todo.pop();for(const [nx,ny,blocked] of [[x+1,y,c.G.vWalls[y]?.[x]],[x-1,y,c.G.vWalls[y]?.[x-1]],[x,y+1,c.G.hWalls[y]?.[x]],[x,y-1,c.G.hWalls[y-1]?.[x]]]){const k=nx+','+ny;if(nx<0||ny<0||nx>=size||ny>=size||blocked||seen.has(k))continue;seen.add(k);todo.push([nx,ny]);}}
    assert.equal(seen.size,size*size);
  }
});
