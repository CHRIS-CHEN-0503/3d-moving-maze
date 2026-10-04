import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),C=require('../assets/shop-claims-core.js');
const good=()=>({x:0,z:0,gi:2,spawnSerial:1,taken:false,sprite:{visible:true},tag:{visible:true},marker:{visible:true}});
test('兩人同時撿同一商品只有一份回條，重送同一申請返回原回條但不重複計分',()=>{
  const s=C.create('e'),g=good(),r=C.claim(s,{epoch:'e',slot:0,spawn:1,id:'h'},g,{x:0,z:0});assert.ok(r);
  assert.equal(C.claim(s,{epoch:'e',slot:0,spawn:1,id:'g'},g,{x:0,z:0}),null);assert.equal(C.claim(s,{epoch:'e',slot:0,spawn:1,id:'h'},g,{x:0,z:0}),r);
  const seen=new Set(),credits=[];assert.equal(C.apply(seen,r,'e',['h','g'],10,x=>credits.push(x)),true);assert.equal(C.apply(seen,r,'e',['h','g'],10,x=>credits.push(x)),false);assert.equal(credits.length,1);
});
test('前一布局、前次補貨、遠距離、結帳／暈眩等不可拾取狀態拒絕',()=>{
  const s=C.create('e'),request={epoch:'e',slot:0,spawn:1,id:'h'};
  for(const [r,p,eligible]of [[{...request,epoch:'old'},{x:0,z:0},true],[{...request,spawn:0},{x:0,z:0},true],[request,{x:2,z:0},true],[request,{x:0,z:0},false]])assert.equal(C.claim(s,r,good(),p,eligible),null);
  assert.equal(s.receipts.length,0);
});
test('拾取回條重播批次上限24並輪替，遺失的早期回條仍會補送',()=>{
  const s=C.create('e');for(let i=0;i<30;i++)C.claim(s,{epoch:'e',slot:i,spawn:1,id:'h'},good(),{x:0,z:0});
  const a=C.batch(s),b=C.batch(s,a.next),c=C.batch(s,b.next);assert.equal(a.rows.length,24);assert.equal(b.rows.length,6);assert.deepEqual(c.rows,a.rows);
});
function room(){
  let time=10000;const packets=[],peers=[];
  function peer(id,host){const roster=[{id:'h'},{id:'g'}],MP={on:true,started:true,ended:false,host,id,mode:'shop',seed:31,seriesRound:1,round:0,roster,players:{},cartList:{},carts:{},banked:{},coUntil:{},bots:[]},G={goods:[good()],shifting:false,frozen:false,stunnedUntil:0,registers:[{x:0,z:0}]};
    const c=vm.createContext({MP,G,ShopClaimsCore:C,window:{GameplayRules:require('../assets/gameplay-rules.js')},performance:{now:()=>time},GOODS:Array.from({length:10},(_,i)=>({price:10+i,name:'商品'+i})),SHOP_RESTOCK_MS:6000,CHECKOUT_RANGE:2,CHECKOUT_MS:5000,
      RoomLifecycle:{sendLocal:m=>{const packet=JSON.parse(JSON.stringify({...m,f:'h',sr:1}));c.mpHandle(packet);packets.push(packet);}},
      cartAdd:(actor,gi)=>{(MP.cartList[actor]??=[]).push(gi);MP.carts[actor]=(MP.carts[actor]||0)+10+gi;},
      botPosOf:()=>({x:0,z:0}),isCheckingOut:actor=>time<(MP.coUntil[actor]||0),AudioEng:{sfxCoin(){}},showToast(){},updateShopHud(){},mpFrame(){},mpLeave(){},
      mpSend:m=>packets.push(JSON.parse(JSON.stringify({...m,f:m.f||id,sr:1}))),
      mpHandle:m=>{if(m.t==='codone'){MP.coUntil[m.f]=0;MP.banked[m.f]=(MP.banked[m.f]||0)+MP.carts[m.f];MP.cartList[m.f]=[];MP.carts[m.f]=0;}}});
    vm.runInContext(readFileSync(new URL('../assets/shop-claims.js',import.meta.url),'utf8'),c);const p={c,api:c.window.ShopClaims};peers.push(p);return p;}
  const host=peer('h',true),guest=peer('g',false);function flush(){let max=100;while(packets.length&&max--){const m=packets.shift();for(const p of peers)p.c.mpHandle(m);}assert.ok(max>0);}return {host,guest,packets,flush,advance:ms=>time+=ms,now:()=>time,checkout(id){host.c.mpHandle({t:'costart',f:id,ms:5000,sr:1});time+=5000;}};
}
test('房主本地先裁定，不需要房主自收封包；遺失訪客回條由有限批次重送恢復',()=>{
  const r=room();assert.equal(r.host.api.request('h',0),true);assert.deepEqual(Array.from(r.host.c.MP.cartList.h),[2]);assert.equal(r.guest.api.request('g',0),true);r.flush();assert.equal(r.host.c.MP.carts.g||0,0);assert.equal(r.guest.c.MP.carts.h,12);
  const s=room();s.host.api.request('h',0);s.packets.length=0;assert.equal(s.guest.c.MP.carts.h||0,0);s.advance(400);s.host.api.tick();s.flush();assert.equal(s.guest.c.MP.carts.h,12);s.advance(400);s.host.api.tick();s.flush();assert.equal(s.guest.c.MP.carts.h,12);
});
test('房主在背景仍可依遠端最新位置裁定撿物，不讀取未插值的舊模型位置',()=>{
  const r=room();r.host.c.G.goods[0].x=10;r.host.c.MP.players.g={tx:10,tz:0};assert.equal(r.host.api.request('g',0),true);assert.equal(r.host.c.MP.carts.g,12);
});
test('付款以房主購物車清單確認，較晚到達的拾取回條不把已付款商品重新塞回車',()=>{
  const r=room();r.host.api.request('g',0);const receipt=r.packets.shift();r.checkout('g');r.host.c.mpSend({t:'codone',f:'g',v:999});const payment=r.packets.shift();r.guest.c.mpHandle(payment);r.guest.c.mpHandle(receipt);
  assert.equal(r.host.c.MP.banked.g,12);assert.equal(r.guest.c.MP.banked.g,12);assert.equal(r.guest.c.MP.carts.g,0);assert.deepEqual(Array.from(r.guest.c.MP.cartList.g),[]);r.guest.c.mpHandle(payment);assert.equal(r.guest.c.MP.banked.g,12);
  r.guest.c.mpHandle({t:'codone',f:'g',v:999,sr:1});assert.equal(r.guest.c.MP.banked.g,12);
});
test('兩次付款封包逆序收到仍依各玩家付款序號結算一次',()=>{
  const r=room(),base={t:'goodpaid',f:'h',sr:1,key:'31:1',epoch:'31:1:0',id:'g',cut:0};
  r.guest.c.mpHandle({...base,list:[3],payNo:2,token:'second'});assert.equal(r.guest.c.MP.banked.g||0,0);
  r.guest.c.mpHandle({...base,list:[2],payNo:1,token:'first'});assert.equal(r.guest.c.MP.banked.g,25);r.guest.c.mpHandle({...base,list:[3],payNo:2,token:'second'});assert.equal(r.guest.c.MP.banked.g,25);
});
test('最新房主購物車快照修復付款／撿物跨序；較舊付款不會清掉後來的新商品',()=>{
  const r=room();r.host.api.request('g',0);r.checkout('g');r.host.c.mpSend({t:'codone',f:'g',v:999});const old=r.packets.find(m=>m.t==='goodpaid');
  const newer=good();newer.spawnSerial=2;newer.gi=3;r.host.c.G.goods[0]=newer;r.guest.c.G.goods[0]={...newer,sprite:{},marker:{},tag:{}};r.host.api.request('g',0);
  r.packets.length=0;r.advance(400);r.host.api.tick();const snapshot=r.packets.find(m=>m.t==='goodcartstate');r.guest.c.mpHandle(snapshot);r.guest.c.mpHandle(old);
  assert.equal(r.guest.c.MP.banked.g,12);assert.equal(r.guest.c.MP.carts.g,13);assert.deepEqual(Array.from(r.guest.c.MP.cartList.g),[3]);r.guest.c.mpHandle({...snapshot,seq:snapshot.seq-1,lists:{h:[],g:[]}});assert.equal(r.guest.c.MP.carts.g,13);
});
test('搶購同分共勝，排名不由名字決勝，付款不能由舊直接宣告繞過',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/最高分相同，共同獲勝/);assert.match(html,/win:r.v===topScore&&topScore>0/);assert.match(html,/rows.filter\(p=>p.v>r.v\).length\+1/);
});
test('房主拒絕隔牆、非法時長、空車及未開始收銀的付款',()=>{
  for(const reason of ['wall','short','long','empty','not-started','stale']){
    const r=room();r.host.api.request('g',0);r.packets.length=0;
    if(reason==='wall'){r.host.c.MP.players.g={tx:1,tz:0};r.host.c.G.wallBoxes=[{minX:.4,maxX:.6,minZ:-1,maxZ:1}];}
    if(reason==='empty'){r.host.c.MP.carts.g=0;r.host.c.MP.cartList.g=[];}
    if(reason!=='not-started')r.host.c.mpHandle({t:'costart',f:'g',ms:reason==='short'?1:reason==='long'?60000:5000,sr:reason==='stale'?0:1});
    assert.equal(r.host.c.MP.coUntil.g||0,0,reason);r.advance(60000);r.host.c.mpSend({t:'codone',f:'g',v:999});assert.equal(r.host.c.MP.banked.g||0,0,reason);
  }
});
test('有效收銀必須完整五秒，重送不能延長，完成只入帳一次',()=>{
  const r=room();r.host.api.request('g',0);r.host.c.mpHandle({t:'costart',f:'g',ms:5000,sr:1});const until=r.host.c.MP.coUntil.g;
  r.advance(2000);r.host.c.mpHandle({t:'costart',f:'g',ms:5000,sr:1});assert.equal(r.host.c.MP.coUntil.g,until);
  r.advance(2999);r.host.c.mpSend({t:'codone',f:'g',v:999});assert.equal(r.host.c.MP.banked.g||0,0);r.advance(1);r.host.c.mpSend({t:'codone',f:'g',v:999});assert.equal(r.host.c.MP.banked.g,12);
  r.host.c.mpSend({t:'codone',f:'g',v:999});assert.equal(r.host.c.MP.banked.g,12);
});
test('收銀中離開／變形／暈眩會取消房主保護，回來不能沿用舊等待付款',()=>{
  for(const reason of ['move','shift','stun']){const r=room();r.host.api.request('g',0);r.host.c.mpHandle({t:'costart',f:'g',ms:5000,sr:1});
    if(reason==='move')r.host.c.MP.players.g={tx:10,tz:0};if(reason==='shift')r.host.c.G.shifting=true;if(reason==='stun')r.host.c.MP.players.g={stunnedUntil:r.now()+5000};
    r.host.api.tick();assert.equal(r.host.c.MP.coUntil.g,0,reason);assert.ok(r.packets.some(m=>m.t==='coend'&&m.f==='g'));
    r.host.c.MP.players.g={tx:0,tz:0};r.host.c.G.shifting=false;r.advance(5000);r.host.c.mpSend({t:'codone',f:'g',v:12});assert.equal(r.host.c.MP.banked.g||0,0,reason);
  }
});
test('背景房主用最新遠端位置開始並完成正常收銀',()=>{
  const r=room();r.host.api.request('g',0);r.host.c.G.registers=[{x:10,z:0}];r.host.c.MP.players.g={tx:10,tz:0};r.checkout('g');r.host.c.mpSend({t:'codone',f:'g',v:12});assert.equal(r.host.c.MP.banked.g,12);
});
test('收銀取消立即清訪客本機等待與待付款重試；舊輪不能取消當前收銀',()=>{
  const r=room();r.guest.api.tick();r.guest.c.G.coUntil=r.now()+5000;r.guest.c.MP.coUntil.g=r.now()+5000;
  r.guest.c.mpHandle({t:'coend',f:'g',sr:0});assert.ok(r.guest.c.G.coUntil>r.now());
  r.guest.c.mpSend({t:'codone',v:12});r.packets.length=0;r.guest.c.mpHandle({t:'coend',f:'g',sr:1});
  assert.equal(r.guest.c.G.coUntil,0);assert.equal(r.guest.c.MP.coUntil.g,0);r.advance(1000);r.guest.api.tick();assert.equal(r.packets.filter(m=>m.t==='goodpay').length,0);
});
test('付款與暈眩／暫停／離開同時到達時不必等下個frame才取消保護',()=>{
  for(const reason of ['stun','frozen','move']){const r=room();r.host.api.request('g',0);r.checkout('g');r.packets.length=0;
    if(reason==='stun')r.host.c.MP.players.g={stunnedUntil:r.now()+1000};if(reason==='frozen')r.host.c.G.frozen=true;if(reason==='move')r.host.c.MP.players.g={tx:10,tz:0};
    r.host.c.mpSend({t:'codone',f:'g',v:12});assert.equal(r.host.c.MP.banked.g||0,0,reason);assert.equal(r.host.c.MP.coUntil.g,0,reason);assert.ok(r.packets.some(m=>m.t==='coend'&&m.f==='g'));
    r.host.c.MP.players.g={tx:0,tz:0};r.host.c.G.frozen=false;r.advance(1000);r.host.c.mpSend({t:'codone',f:'g',v:12});assert.equal(r.host.c.MP.banked.g||0,0,reason);
  }
});
