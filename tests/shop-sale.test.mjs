import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js');
const source=readFileSync(new URL('../assets/shop-sale.js',import.meta.url),'utf8');
function harness(size=13,host=true){
  let time=100000;const nodes=new Map(),sent=[],spoken=[],walked=[];
  const chaos={start(){},stop(){},rebuild(){},reserved:()=>false,speed:()=>1};
  const c=vm.createContext({THREE,window:{ShopChaos:chaos,GameVoice:{announceAssets:(...x)=>spoken.push(x)}},performance:{now:()=>time},Date:{now:()=>time},scene:new THREE.Scene(),
    G:{mazeW:size,mazeH:size,cell:4,px:0,pz:0,goods:[],registers:[],roundEndsAt:300000,nextShiftAt:300000},
    MP:{host,on:true,id:host?'h':'g',started:true,ended:false,seed:71,seriesRound:1,round:0,order:['h','g'],roster:[{id:'h'},{id:'g'}],bots:[],cartList:{},carts:{}},
    GOODS:Array.from({length:20},(_,i)=>({name:'商品'+i,emoji:'圖'+i,price:10+i})),CHARS:[{}],
    $:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:''});return nodes.get(id);},
    isShop:()=>true,cellToWorld:(x,y)=>({x:(x-(size-1)/2)*4,z:(y-(size-1)/2)*4}),playerInWall:()=>false,
    makeTextSprite:()=>new THREE.Group(),makeEmojiSprite:()=>new THREE.Group(),buildCharacter:()=>new THREE.Group(),disposeSceneObject(){},updateShopHud(){},showToast(){},mpFrame(){},mpHandle(){},isCheckingOut:()=>false,
    botWalk:(...args)=>walked.push(args)});
  c.botPosOf=id=>id===c.MP.id?{x:c.G.px,z:c.G.pz}:{x:999,z:999};
  c.cartAdd=(id,gi)=>{(c.MP.cartList[id]??=[]).push(gi);c.MP.carts[id]=(c.MP.carts[id]||0)+c.GOODS[gi].price;};
  c.RoomLifecycle={sendLocal:m=>{const p=structuredClone({...m,f:'h',sr:c.MP.seriesRound});sent.push(p);c.mpHandle(p);}};
  vm.runInContext(source,c);chaos.start();
  return {c,sent,spoken,nodes,walked,api:c.window.ShopSale,advance(ms){time+=ms;c.window.ShopSale.tick(.2);},get stall(){return c.scene.getObjectByName('flash-sale');},get packet(){return sent.at(-1);}};
}
test('每張地圖只出現一次，六件同品、三種尺寸正確時間、到期收攤',()=>{
  for(const [size,ms] of [[11,15000],[13,20000],[15,20000],[19,25000],[25,25000]]){
    const h=harness(size);h.advance(7999);assert.equal(h.stall,undefined);h.advance(12001);
    assert.ok(h.stall);assert.equal(h.packet.left,ms);assert.equal(h.stall.children.filter(x=>Number.isInteger(x.userData.saleSlot)).length,6);
    assert.equal(h.spoken.length,1);assert.equal(h.spoken[0][0][1],'shop.sale.limit.'+ms/1000);
    h.advance(ms-1);assert.ok(h.stall);h.advance(1);assert.equal(h.stall,undefined);
    h.advance(5000);assert.equal(h.stall,undefined);assert.equal(h.spoken.length,1);
    h.c.MP.round++;h.c.window.ShopChaos.rebuild();h.advance(20000);assert.ok(h.stall);assert.equal(h.spoken.length,2);
  }
});
test('靠近領商品、每人間隔1.4秒、六件共享且不補貨；收銀與暈眩不能領',()=>{
  const h=harness();h.advance(20000);const {x,z,gi}=h.packet;h.c.G.px=x;h.c.G.pz=z;
  h.c.isCheckingOut=()=>true;h.advance(100);assert.equal(h.c.MP.carts.h,undefined);
  h.c.isCheckingOut=()=>false;h.c.G.stunnedUntil=130000;h.advance(100);assert.equal(h.c.MP.carts.h,undefined);
  h.c.G.stunnedUntil=0;h.advance(100);assert.equal(h.c.MP.cartList.h.length,1);
  h.advance(1399);assert.equal(h.c.MP.cartList.h.length,1);h.advance(1);assert.equal(h.c.MP.cartList.h.length,2);
  for(let i=0;i<4;i++)h.advance(1400);
  assert.equal(h.c.MP.cartList.h.length,6);assert.equal(h.c.MP.carts.h,6*h.c.GOODS[gi].price);assert.equal(h.stall,undefined);
  h.advance(2000);assert.equal(h.c.MP.cartList.h.length,6);
});
test('累積同步去重並補齊漏包，訪客與舊地圖封包不能開攤或領貨',()=>{
  const a=harness(),b=harness(13,false);a.advance(20000);b.advance(20000);const initial=structuredClone(a.packet);
  b.c.mpHandle({...initial,f:'g'});assert.equal(b.stall,undefined);b.c.mpHandle(initial);assert.ok(b.stall);
  a.c.G.px=initial.x;a.c.G.pz=initial.z;a.advance(100);a.advance(1400);const latest=structuredClone(a.packet);
  b.c.mpHandle(latest);b.c.mpHandle(latest);b.c.mpHandle(initial);assert.equal(b.c.MP.cartList.h.length,2);assert.equal(b.spoken.length,1);
  b.c.MP.round++;b.c.window.ShopChaos.rebuild();b.c.mpHandle(latest);assert.equal(b.stall,undefined);assert.equal(b.c.MP.cartList.h.length,2);
  b.c.MP.seriesRound++;b.c.mpHandle({...initial,round:1});assert.equal(b.stall,undefined);
});
test('電腦前往附近攤位、變形及離開清場、不拖延結算',()=>{
  const h=harness();h.advance(20000);const p=h.packet;
  assert.equal(h.api.collectForBot({id:'g',x:p.x+2,z:p.z},.2,120000,1),true);assert.equal(h.walked.length,1);
  h.c.MP.round++;h.c.window.ShopChaos.rebuild();assert.equal(h.stall,undefined);h.advance(20000);assert.ok(h.stall);
  h.c.MP.ended=true;h.advance(100);assert.equal(h.stall,undefined);assert.equal(h.nodes.get('shopSaleHud').hidden,true);
  const late=harness();late.c.G.roundEndsAt=125000;late.advance(20000);assert.equal(late.stall,undefined);
});
test('無空位先等待，不在牆內、玩家身上或商品中硬放攤位',()=>{
  const h=harness();h.c.playerInWall=()=>true;h.advance(20000);assert.equal(h.stall,undefined);
  h.c.playerInWall=()=>false;h.advance(1000);assert.ok(h.stall);assert.ok(Math.hypot(h.packet.x,h.packet.z)>=6);
});
