import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js'),Rules=require('../assets/gameplay-rules.js');
const read=name=>readFileSync(new URL('../assets/'+name,import.meta.url),'utf8');
const json=value=>JSON.parse(JSON.stringify(value));
const count=(list,type)=>list.filter(m=>m.t===type).length;

// ===== 搶購：房主回條／付款／購物車快照 =====
const Claims=require('../assets/shop-claims-core.js');
function shopRoom(){
  let time=10000;const packets=[],log=[],peers=[];
  const good=()=>({x:0,z:0,gi:2,spawnSerial:1,taken:false,sprite:{visible:true},tag:{visible:true},marker:{visible:true}});
  function peer(id,host){
    const roster=[{id:'h'},{id:'g'}],MP={on:true,started:true,ended:false,host,id,mode:'shop',seed:31,seriesRound:1,round:0,roster,players:{},cartList:{},carts:{},banked:{},coUntil:{},bots:[]},G={goods:Array.from({length:40},good),shifting:false,frozen:false,stunnedUntil:0,registers:[{x:0,z:0}]};
    const c=vm.createContext({MP,G,ShopClaimsCore:Claims,window:{GameplayRules:Rules},performance:{now:()=>time},GOODS:Array.from({length:10},(_,i)=>({price:10+i,name:'商品'+i})),SHOP_RESTOCK_MS:6000,CHECKOUT_RANGE:2,CHECKOUT_MS:5000,
      RoomLifecycle:{sendLocal:m=>{const packet=json({...m,f:'h',sr:1});if(host)log.push({...packet,at:time});c.mpHandle(packet);packets.push(packet);}},
      cartAdd:(actor,gi)=>{(MP.cartList[actor]??=[]).push(gi);MP.carts[actor]=(MP.carts[actor]||0)+10+gi;},
      botPosOf:()=>({x:0,z:0}),isCheckingOut:actor=>time<(MP.coUntil[actor]||0),AudioEng:{sfxCoin(){}},showToast(){},updateShopHud(){},mpFrame(){},mpLeave(){},
      mpSend:m=>packets.push(json({...m,f:m.f||id,sr:1})),
      mpHandle:m=>{if(m.t==='codone'){MP.coUntil[m.f]=0;MP.banked[m.f]=(MP.banked[m.f]||0)+MP.carts[m.f];MP.cartList[m.f]=[];MP.carts[m.f]=0;}}});
    vm.runInContext(read('shop-claims.js'),c);const p={c,api:c.window.ShopClaims};peers.push(p);return p;}
  const host=peer('h',true),guest=peer('g',false);
  const flush=()=>{let budget=200;while(packets.length&&budget--){const m=packets.shift();for(const p of peers)p.c.mpHandle(m);}assert.ok(budget>0);};
  return {host,guest,packets,log,flush,advance:ms=>{time+=ms;},now:()=>time,
    run(ms,step=16){for(let spent=0;spent<ms;spent+=step){time+=step;host.api.tick();}},
    pay(id){host.c.mpHandle({t:'costart',f:id,ms:5000,sr:1});time+=5000;host.c.mpSend({t:'codone',f:id,v:0});}};
}
test('房主靜止時只剩心跳：回條與付款重播有限次，購物車快照每1.5秒一份',()=>{
  const r=shopRoom();for(let i=0;i<30;i++)assert.equal(r.host.api.request('h',i),true);assert.equal(r.host.api.request('g',30),true);r.pay('g');
  const start=r.now();r.run(25000);
  const quiet=r.log.filter(m=>m.at>=start+5000),beats=quiet.filter(m=>m.t==='goodcartstate');
  assert.equal(count(quiet,'goodreceipt'),0,'五秒後不再重播回條');assert.equal(count(quiet,'goodpaid'),0,'五秒後不再重播付款');
  assert.ok(beats.length>=12&&beats.length<=14,'20秒內心跳份數：'+beats.length);
  for(let i=1;i<beats.length;i++){const gap=beats[i].at-beats[i-1].at;assert.ok(gap>=1500&&gap<=1900,'心跳間隔：'+gap);assert.equal(beats[i].seq,beats[i-1].seq+1);}
  const perToken=new Map();for(const m of r.log.filter(x=>x.t==='goodreceipt'))for(const row of m.rows)perToken.set(row.token,(perToken.get(row.token)||0)+1);
  assert.equal(perToken.size,31);for(const [token,n] of perToken)assert.ok(n<=4,token+' 共送出 '+n+' 次（首次＋至多3次重播）');
  assert.ok(r.log.filter(m=>m.t==='goodpaid').length<=4,'付款首次＋至多3次重播');
  const total=r.log.filter(m=>m.at>start).length;assert.ok(total<=30,'25秒內房主封包總數：'+total);
});
test('購物車快照有變化才送，且最慢一個350ms時槽內送出；內容不變不重送',()=>{
  const r=shopRoom();r.run(400);const first=r.log.filter(m=>m.t==='goodcartstate');assert.equal(first.length,1);
  r.run(1000);assert.equal(r.log.filter(m=>m.t==='goodcartstate').length,1,'1.4秒內沒有變化就不再送');
  const before=r.log.length;r.host.api.request('h',0);r.run(400);
  const changed=r.log.slice(before).filter(m=>m.t==='goodcartstate');assert.equal(changed.length,1);assert.deepEqual(changed[0].lists.h,[2]);assert.equal(changed[0].cut,0);assert.equal(changed[0].seq,first[0].seq+1);
  r.host.c.MP.banked.h=30;r.run(400);assert.equal(r.log.filter(m=>m.t==='goodcartstate').at(-1).banked.h,30,'存款改變也會送');
});
test('封包格式相容：goodcartstate／goodreceipt／goodpaid 欄位不變，回條每包不超過24筆',()=>{
  const r=shopRoom();for(let i=0;i<30;i++)r.host.api.request('h',i);r.host.api.request('g',30);r.pay('g');r.run(2000);
  const state=r.log.find(m=>m.t==='goodcartstate'),receipt=r.log.find(m=>m.t==='goodreceipt'),paid=r.log.find(m=>m.t==='goodpaid');
  assert.deepEqual(Object.keys(state).filter(k=>!['f','sr','mid','at'].includes(k)).sort(),['banked','bonus','cut','epoch','lists','payNo','seq','t']);
  assert.deepEqual(Object.keys(receipt).filter(k=>!['f','sr','mid','at'].includes(k)).sort(),['epoch','rows','t']);
  assert.deepEqual(Object.keys(receipt.rows[0]).sort(),['epoch','gi','id','seq','slot','spawn','token']);
  assert.deepEqual(Object.keys(paid).filter(k=>!['f','sr','mid','at'].includes(k)).sort(),['cut','epoch','id','key','list','payNo','t','token']);
  assert.ok(r.log.filter(m=>m.t==='goodreceipt').every(m=>m.rows.length<=24));
  const ids=['h','g'];assert.deepEqual(Object.keys(state.lists),ids);assert.deepEqual(Object.keys(state.payNo),ids);
});
test('遺失恢復：初次送出的回條全部遺失，限次重播仍補上拾取、商品隱藏與購物車',()=>{
  const r=shopRoom();r.host.api.request('h',0);r.packets.length=0;assert.equal(r.guest.c.MP.carts.h||0,0);
  r.advance(400);r.host.api.tick();const replay=r.packets.filter(m=>m.t==='goodreceipt');assert.equal(replay.length,1);
  r.packets.length=0;r.guest.c.mpHandle(replay[0]);
  assert.equal(r.guest.c.G.goods[0].taken,true);assert.deepEqual(Array.from(r.guest.c.MP.cartList.h),[2]);assert.equal(r.guest.c.MP.carts.h,12);
  r.guest.c.mpHandle(replay[0]);assert.equal(r.guest.c.MP.carts.h,12,'重播不重複計入購物車');
});
test('遺失恢復：重播耗盡後，心跳快照補購物車、被拒絕的申請會重新收到擁有者回條',()=>{
  const r=shopRoom();r.host.api.request('h',0);r.packets.length=0;r.run(6000);r.packets.length=0;assert.equal(r.guest.c.G.goods[0].taken,false);
  r.run(1600);const beat=r.packets.filter(m=>m.t==='goodcartstate').at(-1);r.packets.length=0;assert.ok(beat);
  r.guest.c.mpHandle(beat);assert.equal(r.guest.c.MP.carts.h,12,'心跳補回購物車');
  assert.equal(r.guest.api.request('g',0),true);r.flush();
  assert.equal(r.guest.c.G.goods[0].taken,true,'申請被拒後房主重發擁有者回條，幽靈商品消失');assert.equal(r.host.c.MP.carts.g||0,0,'房主仍只讓第一位拿到');
  const answered=r.log.filter(m=>m.t==='goodreceipt').at(-1);assert.equal(answered.rows.length,1);assert.equal(answered.rows[0].id,'h');
});
test('遺失恢復：付款封包遺失後由最近幾筆付款重播補上，不會一直重播所有舊付款',()=>{
  const r=shopRoom();r.host.api.request('g',0);r.flush();r.pay('g');const first=r.packets.filter(m=>m.t==='goodpaid');assert.equal(first.length,1);r.packets.length=0;
  r.advance(400);r.host.api.tick();const replay=r.packets.filter(m=>m.t==='goodpaid');assert.equal(replay.length,1);
  r.guest.c.mpHandle(replay[0]);assert.equal(r.guest.c.MP.banked.g,12);r.guest.c.mpHandle(replay[0]);assert.equal(r.guest.c.MP.banked.g,12,'重播不重複入帳');
  r.packets.length=0;r.host.api.request('g',1);r.flush();r.pay('g');r.packets.length=0;r.run(10000);
  const later=r.log.filter(m=>m.t==='goodpaid');assert.ok(later.length<=8,'兩筆付款加重播總共：'+later.length);
  const lastTen=r.log.filter(m=>m.at>=r.now()-6000);assert.equal(count(lastTen,'goodpaid'),0);
});
test('換牆新局清空舊局回條重播，快照序號重新開始',()=>{
  const r=shopRoom();r.host.api.request('h',0);r.run(400);const old=r.log.length;r.host.c.MP.round=1;r.run(400);
  const fresh=r.log.slice(old);assert.equal(count(fresh,'goodreceipt'),0,'舊局回條不再重播');
  const state=fresh.find(m=>m.t==='goodcartstate');assert.equal(state.epoch,'31:1:1');assert.equal(state.seq,1);assert.equal(state.cut,-1);
});

// ===== 搶購：訂單板 =====
const OrderCore=require('../assets/shop-collection-core.js');
function orderBoard(host){
  let time=1000;const sent=[],stats={rebuilds:0,draws:0,layouts:0},elements=new Map();
  const element=(tag,id)=>({tag,id,hidden:false,children:[],dataset:{},textContent:'',style:{cssText:'',getPropertyValue:()=>'',setProperty(){}},classList:{toggle(){},remove(){},contains:()=>true},
    append(...kids){this.children.push(...kids);},appendChild(kid){this.children.push(kid);},setAttribute(){},getContext:()=>({clearRect(){}}),getBoundingClientRect(){stats.layouts++;return {top:0,bottom:10,height:20};},
    replaceChildren(...kids){if(this.id==='shopMissionItems')stats.rebuilds++;this.children=kids;},
    querySelectorAll(){const out=[],walk=node=>{for(const kid of node.children){if(kid.tag==='canvas')out.push(kid);walk(kid);}};walk(this);return out;}});
  const MP={on:true,host,id:host?'a':'b',started:true,ended:false,seed:71,seriesRound:1,roster:[{id:'a'},{id:'b'}],cartList:{},carts:{},shopBonus:{}};
  const c=vm.createContext({MP,GOODS:Array.from({length:20},(_,i)=>({name:'商品'+i,emoji:'*'})),ShopCollectionCore:OrderCore,NativeSymbols:{draw(){stats.draws++;}},isShop:()=>true,matchRules:()=>({shopCollect:1,shopOrders:1}),showToast(){},
    $:id=>{if(!elements.has(id))elements.set(id,element('div',id));return elements.get(id);},document:{createElement:tag=>element(tag)},window:{addEventListener(){}},requestAnimationFrame:fn=>fn(),
    performance:{now:()=>time},RoomLifecycle:{sendLocal:m=>sent.push(json({...m,f:'a',sr:1,at:time}))},mpSend:m=>sent.push(json({...m,at:time})),mpHandle(){}});
  vm.runInContext(read('shop-collection.js'),c);const api=c.window.ShopCollection;api.start();
  return {c,api,MP,sent,stats,advance:ms=>{time+=ms;},now:()=>time,
    run(ms,step=16){for(let spent=0;spent<ms;spent+=step){time+=step;api.sync();}},
    state:(revision,players,bonus={a:0,b:0})=>({t:'orderstate',f:'a',sr:1,seed:71,revision,players:json(players),bonus})};
}
const idle={paid:[],awarded:false,orders:0,order:null,orderPaid:[]};
test('房主訂單狀態有變化才送，否則每1.5秒一次心跳；封包格式不變',()=>{
  const r=orderBoard(true);r.api.progress('a');r.api.progress('b');r.run(20000);
  const beats=r.sent.filter(m=>m.t==='orderstate');assert.ok(beats.length>=10&&beats.length<=14,'20秒內訂單狀態份數：'+beats.length);
  for(let i=1;i<beats.length;i++)assert.ok(beats[i].at-beats[i-1].at>=1500,'間隔：'+(beats[i].at-beats[i-1].at));
  assert.deepEqual(Object.keys(beats[0]).filter(k=>!['f','sr','at'].includes(k)).sort(),['bonus','players','revision','seed','t']);
  const before=r.sent.length;r.api.checkout('a',r.api.targets());r.run(600);
  const changed=r.sent.slice(before).filter(m=>m.t==='orderstate');assert.equal(changed.length,1,'結帳後 500ms 內送出一份新狀態');assert.equal(changed[0].revision,1);assert.equal(changed[0].players.a.awarded,true);assert.equal(changed[0].bonus.a,300);
  r.run(1400);assert.equal(r.sent.filter(m=>m.t==='orderstate').length,beats.length+1,'變化後1.4秒內沒有新封包');
});
test('訪客收到重複的訂單狀態不重建任務面板，只在revision變大或內容改變時重繪',()=>{
  const r=orderBoard(false),first=r.state(1,{a:idle,b:idle});r.c.mpHandle(first);
  const rebuilds=r.stats.rebuilds,draws=r.stats.draws,layouts=r.stats.layouts;assert.equal(rebuilds,1);assert.equal(draws,5,'五個目標各畫一次 emoji');
  for(let i=0;i<20;i++){r.advance(500);r.c.mpHandle(json(first));}
  assert.equal(r.stats.rebuilds,rebuilds,'20次心跳沒有重建按鈕');assert.equal(r.stats.draws,draws,'沒有重畫 canvas emoji');assert.equal(r.stats.layouts,layouts,'沒有強制排版');
  const [target]=r.api.targets();r.c.mpHandle(r.state(2,{a:{...idle,paid:[target]},b:idle}));assert.equal(r.stats.rebuilds,rebuilds+1,'revision變大且內容改變：重繪一次');
  r.c.mpHandle(r.state(2,{a:{...idle,paid:[target]},b:idle}));assert.equal(r.stats.rebuilds,rebuilds+1);
  r.c.mpHandle(r.state(1,{a:idle,b:idle}));assert.equal(r.stats.rebuilds,rebuilds+1,'較舊revision被拒絕');
  r.c.mpHandle(r.state(2,{a:{...idle,paid:[target,r.api.targets()[1]]},b:idle}));assert.equal(r.stats.rebuilds,rebuilds+2,'同revision但內容不同：重繪');
  r.c.mpHandle(r.state(3,{a:{...idle,paid:[target,r.api.targets()[1]]},b:idle}));assert.equal(r.stats.rebuilds,rebuilds+3,'revision變大：重繪');
  assert.equal(r.api.progress('a').paid.length,2);
});
test('訪客重複狀態仍同步積分加成，且待送的追加訂單選擇照舊重送直到房主確認',()=>{
  const r=orderBoard(false),requests=()=>r.sent.filter(m=>m.t==='orderrequest').length;
  const done={...idle,awarded:true,paid:r.api.targets()};r.c.mpHandle(r.state(1,{a:idle,b:done},{a:0,b:300}));
  assert.equal(r.MP.shopBonus.b,300);r.c.mpHandle(r.state(1,{a:idle,b:done},{a:0,b:380}));assert.equal(r.MP.shopBonus.b,380,'內容相同的心跳也更新加成');
  r.api.choose(0);assert.equal(requests(),1);r.advance(800);r.api.sync();assert.equal(requests(),2,'未確認前每700ms重送');
  r.c.mpHandle(r.state(1,{a:idle,b:done}));r.advance(800);r.api.sync();assert.equal(requests(),3,'重複的未選擇狀態不取消重送');
  const offer=r.api.offers('b')[0],chosen={...done,order:{...offer,targets:offer.targets.slice(),number:1}};
  r.c.mpHandle(r.state(2,{a:idle,b:chosen}));r.advance(800);r.api.sync();assert.equal(requests(),3,'房主確認後停止重送');
});

// ===== 模式變體 =====
const Variants=require('../assets/mode-variants-core.js');
function variants(mode='race',host=true){
  let now=10000,ticks=0,finds=0;const nodes=new Map(),sent=[],roster=['a','b','c','d'].map(id=>({id,name:id}));
  const node=()=>({style:{},hidden:false,children:[],setAttribute(){},appendChild(child){this.children.push(child);if(child.id)nodes.set(child.id,child);}});
  const bots=[{id:'c',x:12,z:20},{id:'d',x:16,z:20}];for(const name of ['find','some'])bots[name]=function(...args){finds++;return Array.prototype[name].apply(this,args);};
  const MP={on:true,host,id:host?'a':'b',mode,started:true,ended:false,seed:31,seriesRound:1,round:0,roster,order:roster.map(r=>r.id),players:{},bots,outs:{},treasure:{holder:'a'},taggedId:'d'},G={running:true,startTime:5000,mazeW:13,mazeH:13,cell:4,exitCell:{x:6,y:6},px:-24,pz:-24,shifting:false,frozen:false,lvlIdx:0,stunnedUntil:0,hWalls:Array.from({length:12},()=>Array(13).fill(false)),vWalls:Array.from({length:13},()=>Array(12).fill(false)),wallBoxes:[]};
  const pos={a:{x:-24,z:-24},b:{x:20,z:20},c:{x:12,z:20},d:{x:16,z:20}},view={members:Object.fromEntries(roster.map((r,i)=>[r.id,{team:i%2}])),flag:{holder:null},walls:[]};
  const ctx=vm.createContext({ModeVariantsCore:{...Variants,tick:(...args)=>{ticks++;return Variants.tick(...args);}},THREE,MP,G,window:{CaptureFlag:{view:()=>view}},document:{createElement:node},scene:new THREE.Scene(),Date:{now:()=>now},performance:{now:()=>now},LEVELS:[{}],
    $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},matchRules:()=>({raceCheckpoint:1,treasureSeal:1,ctfShortcut:1,tagBells:1}),
    cellToWorld:(x,y)=>({x:(x-6)*4,z:(y-6)*4}),worldToCell:(x,z)=>({x:Math.round(x/4+6),y:Math.round(z/4+6)}),botPosOf:id=>id===MP.id?{x:G.px,z:G.pz}:pos[id],makeTextSprite:()=>new THREE.Group(),showToast(){},disposeSceneObject(){},escapeHtml:s=>s,
    solveMaze:(fx,fy,tx,ty)=>Array(Math.abs(fx-tx)+Math.abs(fy-ty)+1).fill([tx,ty]),removeWallBox(){},buildWalls(){},
    RoomLifecycle:{sendLocal:m=>{const packet=json({...m,f:'a',sr:1});ctx.mpHandle(packet);sent.push(packet);}},mpSend:m=>sent.push({...m,f:m.f||MP.id,sr:1}),mpHandle(){},mpLeave(){},showMPResults(){}});
  vm.runInContext(read('mode-variants.js'),ctx);const api=ctx.window.ModeVariants;api.frame();
  return {api,ctx,sent,pos,MP,ticks:()=>ticks,finds:()=>finds,now:()=>now,
    foreground(ms,step=16){for(let spent=0;spent<ms;spent+=step){now+=step;api.frame(step/1000);}},
    background(calls,gap=250){for(let i=0;i<calls;i++){now+=gap;api.frame();}},
    place:(actor,p)=>{pos[actor]={...p};}};
}
test('房主站定判定節流到約10Hz，背景250ms計時器（不帶dt）不被節流',()=>{
  const r=variants(),base=r.ticks();r.foreground(2000);const frames=Math.ceil(2000/16),ran=r.ticks()-base;
  assert.ok(ran>=18&&ran<=22,'2秒60fps共 '+frames+' 幀，判定 '+ran+' 次');
  const timer=variants(),start=timer.ticks();timer.background(8);assert.equal(timer.ticks()-start,8,'每次無dt呼叫都判定一次');
  const fast=variants(),from=fast.ticks();fast.background(8,30);assert.equal(fast.ticks()-from,8,'即使間隔很短，帶不帶dt才是節流依據');
});
test('節流後站定仍以時間戳完成：0.8秒地標最多只多等兩個節流週期（開始與完成各一）',()=>{
  const r=variants(),spot=r.api.state().points[0];r.place('c',spot);const start=r.now();let done=0;
  for(let spent=0;spent<2000&&!done;spent+=16){r.foreground(16);if(r.api.state().progress.c.checkpoint)done=r.now()-start;}
  assert.ok(done>=800&&done<=800+2*96+16,'完成時間 '+done+'ms（原每幀判定約 816ms）');assert.equal(r.api.botGoal(r.ctx.MP.bots[0],r.ctx.G.exitCell,'exit',r.now()),null);
  const interrupted=variants();interrupted.place('c',interrupted.api.state().points[0]);interrupted.foreground(500);interrupted.place('c',{x:12,z:20});interrupted.foreground(1000);assert.equal(interrupted.api.state().progress.c.checkpoint,false,'離開後重新計時');
});
test('variantsync只在狀態或站定進度改變時送，另加1.5秒心跳；封包欄位不變',()=>{
  const r=variants();r.foreground(30000);const idle=r.sent.filter(m=>m.t==='variantsync');
  assert.ok(idle.length>=18&&idle.length<=22,'30秒閒置份數：'+idle.length);assert.deepEqual(Object.keys(idle[0]).sort(),['at','f','key','sr','state','t']);
  const spot=r.api.state().points[0],before=r.sent.length;r.place('c',spot);r.foreground(1000);
  const burst=r.sent.slice(before).filter(m=>m.t==='variantsync');
  assert.ok(burst.length>=2&&burst.length<=3,'0.8秒站定期間份數：'+burst.length);
  assert.ok(burst[0].state.progress.c.channel&&burst[0].state.progress.c.channel.since>0,'站定開始立即同步，訪客可畫進度環');
  assert.equal(burst.at(-1).state.progress.c.checkpoint,true);
  const guest=variants('race',false);guest.ctx.mpHandle({...burst.at(-1),state:{...burst.at(-1).state,epoch:guest.api.state().epoch},key:guest.api.state().epoch});
  assert.equal(guest.api.state().progress.c.checkpoint,true,'訪客仍接受房主快照');
});
test('每個角色的機器人查找改用Map：判定期間不呼叫MP.bots.find／some',()=>{
  for(const mode of ['race','tag','ctf']){const r=variants(mode);r.foreground(2000);assert.equal(r.finds(),0,mode);}
  const r=variants('tag');r.place('c',r.api.state().points[0]);r.MP.bots[0].stunnedUntil=r.now()+5000;r.foreground(1500);assert.equal(r.api.state().progress.c.score,0,'暈眩中的機器人仍不會觸發安全鐘');
});

// ===== 搶旗 =====
const CaptureCore=require('../assets/capture-core.js');
const captureSource=read('capture-mode.js');
function captureRoom(){
  let time=10000,timeouts=0;const queue=[],peers=[];
  function peer(id,host){
    const nodes=new Map(),writes=new Map(),intervals=new Map(),results=[];
    const node=()=>{const n={style:{},_text:'',_hidden:false,appendChild(child){if(child.id)nodes.set(child.id,child);},setAttribute(){}},tally=key=>writes.set(n,{...(writes.get(n)||{}),[key]:((writes.get(n)||{})[key]||0)+1});
      Object.defineProperty(n,'textContent',{get:()=>n._text,set:v=>{n._text=v;tally('text');}});Object.defineProperty(n,'hidden',{get:()=>n._hidden,set:v=>{n._hidden=v;tally('hidden');}});return n;};
    const roster=Array.from({length:4},(_,i)=>({id:'p'+i,name:'玩家'+i,charIdx:i})),MP={on:true,mode:'ctf',started:true,ended:false,id,host,round:0,order:roster.map(r=>r.id),roster,outs:{},players:{}};
    for(const r of roster)if(r.id!==id)MP.players[r.id]={mesh:new THREE.Group(),lastSeen:time,tx:0,tz:0};
    const c=vm.createContext({THREE,CaptureCore:{...CaptureCore,timeout:(...args)=>{if(host)timeouts++;return CaptureCore.timeout(...args);}},MP,window:{addEventListener(){},GameplayRules:Rules},document:{createElement:node},scene:new THREE.Scene(),playerGroup:new THREE.Group(),
      G:{mazeW:13,mazeH:13,cell:4,wallBoxes:[],items:[],px:-24,pz:-24,stunnedUntil:0,atkCoolUntil:0},SERIES:{stats:{}},console,matchRules:()=>({duelMin:5}),fmtTime:seconds=>String(Math.ceil(seconds)),Date:{now:()=>time},performance:{now:()=>time},
      setInterval:fn=>{intervals.set(1,fn);return 1;},clearInterval:key=>intervals.delete(key),$:key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);},
      cellToWorld:(x,y)=>({x:(x-6)*4,z:(y-6)*4}),worldToCell:(x,z)=>({x:Math.round(x/4+6),y:Math.round(z/4+6)}),
      botPosOf:who=>who===id?{x:c.G.px,z:c.G.pz}:MP.players[who]?{x:MP.players[who].mesh.position.x,z:MP.players[who].mesh.position.z}:null,
      makeTextSprite:()=>new THREE.Group(),bindActionBtn(){},showToast(){},updateAtkBtn(){},swingWeapon(){},disposeSceneObject(){},removeWallBox(){},
      AudioEng:{stopMusic(){},stopItemLoop(){},sfxWin(){},sfxLose(){},sfxHit(){}},mpName:who=>who,escapeHtml:s=>s,seriesSummaryHtml:()=>'',applyStun(){},showMPResults:(title,html,rows)=>results.push({title,rows}),
      mpSend:message=>queue.push(json({...message,f:message.f||id}))});
    vm.runInContext(captureSource,c);peers.push({c,api:c.window.CaptureFlag,nodes,writes,intervals,results});return peers.at(-1);
  }
  const host=peer('p0',true),client=peer('p1',false);
  const flush=()=>{let budget=100;while(queue.length&&budget--){const m=queue.shift();for(const p of peers)p.api.handle(m);}assert.ok(budget>0);};
  function place(id,x,z){for(const p of peers){if(p.c.MP.id===id){p.c.G.px=x;p.c.G.pz=z;}else{const pl=p.c.MP.players[id];pl.mesh.position.set(x,0,z);pl.lastSeen=time;}}}
  for(const p of peers)p.api.start('p0');for(let i=0;i<4;i++)place('p'+i,-24+i*12,20);
  return {host,client,flush,place,queue,now:()=>time,advance:ms=>{time+=ms;},timeouts:()=>timeouts,
    tick(ms){time+=ms;for(const p of peers)for(const pl of Object.values(p.c.MP.players))pl.lastSeen=time;host.api.frame(.1,time);flush();client.api.frame(.1,time);}};
}
function extractClear(){
  const match=captureSource.match(/ {2}function clear\(a,b\)\{.*\}\n/);assert.ok(match,'capture-mode.js 仍有 clear(a,b)');
  const ctx=vm.createContext({G:{wallBoxes:[]},window:{GameplayRules:Rules}});vm.runInContext(match[0],ctx);return (a,b,walls)=>{ctx.G.wallBoxes=walls;return ctx.clear(a,b);};
}
// The original 0.2 m sampling, kept here only as the reference the new test compares against.
function sampledClear(a,b,walls){if(!a||!b)return false;return !walls.some(w=>{
  const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.2));
  for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps;if(x>w.minX&&x<w.maxX&&z>w.minZ&&z<w.maxZ)return true;}return false;
});}
function chord(a,b,w,step=.001){let inside=0;const length=Math.hypot(a.x-b.x,a.z-b.z),steps=Math.max(1,Math.ceil(length/step));
  for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps;if(x>w.minX&&x<w.maxX&&z>w.minZ&&z<w.maxZ)inside++;}return inside*length/steps;}
function mazeWalls(seed){
  let n=seed>>>0;const random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),walls=[],c=4,t=.7,at=(x,y)=>({x:(x-6)*c,z:(y-6)*c});
  const add=(x,z,lenX,lenZ)=>walls.push({minX:x-lenX/2,maxX:x+lenX/2,minZ:z-lenZ/2,maxZ:z+lenZ/2});
  for(let y=0;y<12;y++)for(let x=0;x<13;x++)if(random()<.5){const p=at(x,y);add(p.x,p.z+c/2,c+t,t);}
  for(let y=0;y<13;y++)for(let x=0;x<12;x++)if(random()<.5){const p=at(x,y);add(p.x+c/2,p.z,t,c+t);}
  for(let x=0;x<13;x++){const top=at(x,0),bottom=at(x,12);add(top.x,top.z-c/2,c+t,t);add(bottom.x,bottom.z+c/2,c+t,t);}
  for(let y=0;y<13;y++){const left=at(0,y),right=at(12,y);add(left.x-c/2,left.z,t,c+t);add(right.x+c/2,right.z,t,c+t);}
  return {walls,random};
}
test('搶旗視線改用GameplayRules線段對方塊判定，與原0.2m取樣在邊界一致',()=>{
  const clear=extractClear();assert.doesNotMatch(captureSource,/\/\.2\)/,'不再每0.2m取樣');
  const box={minX:-.5,maxX:.5,minZ:-2,maxZ:2},cases=[
    [{x:-2,z:0},{x:2,z:0},true],[{x:-2,z:3},{x:2,z:3},false],[{x:.5,z:-3},{x:.5,z:3},false],[{x:-.5,z:-3},{x:-.5,z:3},false],[{x:2,z:0},{x:.5,z:0},false],[{x:2,z:0},{x:.4,z:0},true],
    [{x:-.5,z:0},{x:.5,z:0},true],[{x:0,z:0},{x:0,z:0},true],[{x:.5,z:0},{x:.5,z:0},false],[{x:3,z:2},{x:1,z:2},false],[{x:3,z:2},{x:.5,z:2},false],[{x:-1,z:-2},{x:1,z:-2},false],[{x:-1,z:-1.5},{x:1,z:-2.5},true],
    [{x:1,z:-3},{x:-1,z:-1},true],[{x:.75,z:-2.25},{x:.25,z:-1.75},true],[{x:1,z:-2},{x:.5,z:-2},false]];
  for(const [a,b,blocked] of cases){assert.equal(!clear(a,b,[box]),blocked,JSON.stringify([a,b]));assert.equal(!sampledClear(a,b,[box]),blocked,'原判定：'+JSON.stringify([a,b]));}
  const [a,b]=[{x:.62,z:-1.78},{x:.28,z:-2.12}];assert.equal(sampledClear(a,b,[box]),true,'原取樣在牆角漏掉0.14m的擦過');assert.equal(clear(a,b,[box]),false,'新判定如實擋住');assert.ok(chord(a,b,box)<.2);
  assert.equal(clear(null,{x:0,z:0},[box]),false);assert.equal(clear({x:0,z:0},undefined,[box]),false);
});
test('隨機大量樣本：新判定不漏掉原判定擋住的牆，差異僅限原0.2m取樣漏掉的短於0.2m牆角擦過',()=>{
  const clear=extractClear();let samples=0,blocked=0,differences=0;
  for(const seed of [11,23,47]){
    const {walls,random}=mazeWalls(seed),faces=walls.flatMap(w=>[[w.minX,w.minZ],[w.maxX,w.maxZ],[w.minX,w.maxZ],[w.maxX,w.minZ]]);
    for(let i=0;i<8000;i++){
      const pick=()=>random()<.25?{x:faces[Math.floor(random()*faces.length)][0],z:faces[Math.floor(random()*faces.length)][1]}:{x:(random()-.5)*52,z:(random()-.5)*52};
      const a=pick(),angle=random()*Math.PI*2,length=random()<.2?0:random()*8,b=random()<.3?pick():{x:a.x+Math.cos(angle)*length,z:a.z+Math.sin(angle)*length};
      if(Math.hypot(a.x-b.x,a.z-b.z)>8)continue;
      const legacy=sampledClear(a,b,walls),next=clear(a,b,walls);samples++;if(!next)blocked++;
      if(legacy===next)continue;differences++;
      assert.equal(legacy,true,'新判定不得放行原本被擋的線：'+JSON.stringify([a,b]));
      const hit=walls.filter(w=>chord(a,b,w)>0);assert.ok(hit.length>0,'差異必須是真的穿過牆：'+JSON.stringify([a,b]));
      for(const w of hit)assert.ok(chord(a,b,w)<.2+1e-9,'原取樣只會漏掉短於0.2m的牆角：'+chord(a,b,w));
    }
  }
  assert.ok(samples>15000&&blocked>2000&&blocked<samples-2000,'樣本涵蓋被擋與通暢：'+blocked+'/'+samples);
  assert.ok(differences/samples<.02,'差異比例：'+differences+'/'+samples);
});
test('傳旗6公尺×約700面牆：每面牆只讀一次線段判定，不再逐0.2m取樣（讀取量降至1/5以下）',()=>{
  const reads={n:0},boxes=Array.from({length:900},(_,i)=>{const row=Math.floor(i/30),col=i%30,x=-29+col*2,z=-29+row*2;return {minX:x-.35,maxX:x+.35,minZ:z-1.2,maxZ:z+1.2};}).filter(b=>b.maxX<-1.5||b.minX>6.5||b.maxZ<-2||b.minZ>2).slice(0,700),
    tracked=boxes.map(box=>({get minX(){reads.n++;return box.minX;},get maxX(){reads.n++;return box.maxX;},get minZ(){reads.n++;return box.minZ;},get maxZ(){reads.n++;return box.maxZ;}}));
  assert.equal(tracked.length,700);
  const plain=tracked.map(w=>({minX:w.minX,maxX:w.maxX,minZ:w.minZ,maxZ:w.maxZ}));
  const r=captureRoom();r.place('p0',0,0);r.tick(4000);assert.equal(r.host.api.speed(),.82);r.place('p2',5,0);r.host.c.G.wallBoxes=tracked;
  reads.n=0;const send=r.queue.length;r.host.api.pass();const now=reads.n;assert.equal(r.queue.length,send+1,'沒有牆擋住時傳旗封包照常送出');
  reads.n=0;assert.equal(sampledClear({x:0,z:0},{x:5,z:0},tracked),true);const before=reads.n;
  assert.ok(now<=700*4,'新判定每面牆最多讀4個欄位：'+now);assert.ok(now*5<=before,'新判定讀取 '+now+'，原取樣 '+before);
  assert.equal(sampledClear({x:0,z:0},{x:5,z:0},plain),true);
});
test('搶旗攻擊仍被牆擋住，無牆時照常送出',()=>{
  const r=captureRoom();r.place('p0',0,0);r.place('p1',1,0);r.client.c.G.wallBoxes=[{minX:.15,maxX:.85,minZ:-2,maxZ:2}];
  r.client.api.attack();assert.equal(r.queue.filter(m=>m.t==='ctfattack').length,0,'隔牆不能擊退');
  r.client.c.G.wallBoxes=[];r.client.c.G.atkCoolUntil=0;r.client.api.attack();assert.equal(r.queue.filter(m=>m.t==='ctfattack').length,1);
});
test('搶旗HUD只在內容改變時寫入DOM；時鐘被主迴圈覆寫後仍會寫回倒數',()=>{
  const r=captureRoom(),clock=r.host.nodes.get('hudTime')||r.host.c.$('hudTime'),hud=r.host.nodes.get('captureHud'),relay=r.host.nodes.get('captureRelay'),tally=(node,key)=>r.host.writes.get(node)?.[key]||0;
  for(let i=0;i<60;i++)r.host.api.frame(.016,r.now());
  assert.equal(tally(clock,'text'),1,'60幀同一秒只寫一次時鐘');assert.equal(tally(hud,'text'),1,'HUD文字只寫一次');assert.ok(tally(relay,'hidden')<=1,'接力按鈕只在狀態改變時寫入');
  const countdown=clock.textContent;clock.textContent='0:07';const writes=tally(clock,'text');r.host.api.frame(.016,r.now());assert.equal(clock.textContent,countdown);assert.equal(tally(clock,'text'),writes+1);
  r.advance(1000);r.host.api.frame(.016,r.now());assert.notEqual(clock.textContent,countdown,'秒數改變時更新');
  r.place('p0',0,0);r.tick(4000);const hudWrites=tally(hud,'text'),relayWrites=tally(relay,'hidden');for(let i=0;i<30;i++)r.host.api.frame(.016,r.now());
  assert.match(hud.textContent,/持旗中/);assert.equal(tally(hud,'text'),hudWrites,'持旗後相同文字不重寫');assert.equal(tally(relay,'hidden'),relayWrites);assert.equal(relay.hidden,false);
});
test('房主背景100ms計時器：前景由畫面迴圈驅動時直接返回，背景或畫面迴圈停擺才接手',()=>{
  const fg=captureRoom(),pulse=fg.host.intervals.get(1),base=fg.timeouts();
  for(let i=0;i<62;i++){fg.advance(16);fg.host.api.frame(.016,fg.now());if(i%6===5)pulse();}
  assert.equal(fg.timeouts()-base,62,'前景只由畫面迴圈判定（計時器10次全部直接返回）');
  const bg=captureRoom(),timer=bg.host.intervals.get(1),start=bg.timeouts();
  for(let i=0;i<20;i++){bg.advance(1000);timer();bg.flush();bg.client.api.frame(.1,bg.now());}
  assert.equal(bg.timeouts()-start,20,'背景完全由計時器驅動');assert.equal(bg.client.c.MP.started,true);assert.equal(bg.client.results.length,0,'接收端不誤判斷線');
  const stalled=captureRoom(),resume=stalled.host.intervals.get(1),from=stalled.timeouts();stalled.host.api.frame(.016,stalled.now());
  stalled.advance(100);resume();assert.equal(stalled.timeouts()-from,1,'畫面迴圈剛跑過，計時器不重複');stalled.advance(300);resume();assert.equal(stalled.timeouts()-from,2,'畫面迴圈停擺超過250ms，計時器接手');
});
