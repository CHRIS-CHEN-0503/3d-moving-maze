import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../assets/classic-tactics-core.js'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const maze=(w=5,h=5)=>({mazeW:w,mazeH:h,vWalls:Array.from({length:h},()=>Array(w-1).fill(false)),hWalls:Array.from({length:h-1},()=>Array(w).fill(false)),wallBoxes:[]});
function detour(){const m=maze();for(let y=0;y<4;y++)m.vWalls[y][0]=true;return m;}
test('一次廣度搜尋按實際通路挑近目標，隔牆近的商品與收銀機不再優先',()=>{
  const f=C.field(detour(),{x:0,y:0}),across={x:1,y:0},down={x:0,y:3};assert.equal(C.steps(f,across),9);assert.equal(C.steps(f,down),3);assert.equal(C.nearest(f,[across,down]),down);
  assert.deepEqual(C.route(f,across).map(p=>[p.x,p.y]),[[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[1,3],[1,2],[1,1],[1,0]]);
});
test('任務商品適度優先，但不為一件極遠商品繞完整張地圖；不選不可達目標',()=>{
  const m=detour(),f=C.field(m,{x:0,y:0}),a={x:1,y:0,needed:true},b={x:0,y:3,needed:false};assert.equal(C.nearest(f,[a,b],p=>p,p=>p.needed?.55:1),b);
  const near={x:0,y:2,needed:true};assert.equal(C.nearest(f,[near,b],p=>p,p=>p.needed?.55:1),near);m.hWalls[0][0]=true;const blocked=C.field(m,{x:0,y:0});assert.equal(C.nearest(blocked,[a,b]),null);
  assert.equal(C.field(m,{x:-1,y:0}),null);assert.equal(C.field(maze(100,100),{x:0,y:0}),null);
});
test('逃跑路線優先避開第一個轉角的追捕者，不為遠方角落穿過鬼',()=>{
  const m=maze(7,1),own=C.field(m,{x:3,y:0}),ghost=C.field(m,{x:4,y:0}),left={x:0,y:0},right={x:6,y:0};assert.equal(C.flee(own,ghost,[right,left]),left);
});
test('五模式下一步不公開隱藏位置，最後15秒提示原有五秒結帳且不改分數規則',()=>{
  const base={running:true,id:'me',hunger:100};for(const mode of ['classic','race','treasure','shop','tag','ctf'])assert.ok(C.hint({...base,mode}).text,mode);
  assert.match(C.hint({...base,mode:'shop',cart:12,left:15}).text,/結帳需5秒/);assert.equal(C.hint({...base,mode:'shop',cart:12,left:15}).urgent,true);assert.match(C.hint({...base,mode:'tag',ghost:true,left:15}).text,/攻擊/);
  assert.match(C.hint({...base,mode:'treasure',holder:'me',sealed:true}).text,/封印/);assert.match(C.hint({...base,mode:'ctf',carrier:true}).text,/3秒/);
  for(const flag of ['frozen','shifting','story','ended'])assert.equal(C.hint({...base,mode:'shop',[flag]:true}).text,'',flag);
});
function runtime(){let now=10000;const nodes=new Map(),walks=[],sent=[];const m=detour(),g={...m,startTime:1,running:true,px:0,pz:0,satiety:100,stunnedUntil:0},MP={on:true,started:true,ended:false,host:true,id:'human',seed:3,seriesRound:1,round:0,mode:'tag',taggedId:'ghost',tagImmuneUntil:Infinity,roster:[{id:'ghost'},{id:'human'},{id:'other'}],players:{},bots:[{id:'ghost',x:0,z:0}]};
  function node(id){if(!nodes.has(id))nodes.set(id,{id,style:{},hidden:false,textContent:'',setAttribute(){},appendChild(){},getBoundingClientRect:()=>({top:0,bottom:id==='hudInfo'?40:0,left:0,right:200,width:id==='hudInfo'?200:0})});return nodes.get(id);}
  const positions={human:{x:1,z:0},other:{x:0,z:3}};const c=vm.createContext({MP,G:g,ClassicTacticsCore:C,document:{createElement:()=>node('classicObjectiveHint')},performance:{now:()=>now},Date:{now:()=>now},innerHeight:320,ModeVariants:{frame(){},state:()=>null},mpLeave(){},$:node,worldToCell:(x,z)=>({x:Math.round(x),y:Math.round(z)}),botPosOf:id=>id==='ghost'?MP.bots[0]:positions[id],botWalk:(b,goal)=>walks.push({...goal}),randPower:()=>'',mpSend:m=>sent.push(m),matchRules:()=>({shopCollect:1}),cartLoad:()=>0,isCheckingOut:()=>false});c.window=c;
  vm.runInContext(readFileSync(new URL('../assets/classic-tactics.js',import.meta.url),'utf8'),c);vm.runInContext(html.slice(html.indexOf('function botSimTag('),html.indexOf('/* 尋寶 AI')),c);
  return {c,MP,g,positions,walks,sent,nodes,api:c.ClassicTactics,advance:ms=>now+=ms,now:()=>now};
}
test('距離場650ms／同格快取且最多12組，破牆、變形及新輪立即失效',()=>{
  const r=runtime();for(let i=0;i<100;i++)r.api.distances('b',{x:0,z:0},r.now());assert.equal(r.api.stats().builds,1);r.advance(650);r.api.distances('b',{x:0,z:0},r.now());assert.equal(r.api.stats().builds,2);
  r.g.vWalls[0][0]=false;r.g.wallBoxes.push({});r.api.distances('b',{x:0,z:0},r.now());assert.equal(r.api.stats().builds,3);assert.equal(C.steps(r.api.distances('b',{x:0,z:0},r.now()),{x:1,y:0}),1);
  r.g.hWalls=r.g.hWalls.map(row=>row.slice());r.api.distances('b',{x:0,z:0},r.now());assert.equal(r.api.stats().builds,4);r.MP.round++;r.api.distances('b',{x:0,z:0},r.now());assert.equal(r.api.stats().builds,5);
  for(let i=0;i<20;i++)r.api.distances('actor'+i,{x:0,z:0},r.now());assert.equal(r.api.stats().fields,12);r.api.reset();assert.equal(r.api.stats().fields,0);
});
test('五種既有地圖尺寸只計算當張有限距離場，所有格子皆能依牆線通行',()=>{
  for(const size of [11,13,15,19,25]){const m=maze(size,size),f=C.field(m,{x:0,y:0});assert.equal(f.distance.flat().filter(d=>d>=0).length,size*size);assert.equal(C.steps(f,{x:size-1,y:size-1}),2*(size-1));}
});
test('實際搶購AI對商品與收銀使用同一通路距離，不再選隔牆的直線近點',()=>{
  const r=runtime(),b=r.MP.bots[0];r.MP.mode='shop';r.MP.carts={ghost:250};r.MP.cartList={};r.g.roundEndsAt=r.now()+60000;r.g.registers=[{cx:1,cy:0,x:1,z:0},{cx:0,cy:3,x:0,z:3}];
  Object.assign(r.c,{CHECKOUT_RANGE:2.6,CHECKOUT_MS:5000,loadSpeed:()=>1,cartLoad:id=>(r.MP.carts[id]||0)/400,botTryRob(){}});vm.runInContext(html.slice(html.indexOf('function botSimShop('),html.indexOf('/* 鬼抓人 AI')),r.c);
  r.c.botSimShop(.05,r.now());assert.deepEqual(r.walks.at(-1),{x:0,y:3});assert.equal(b.coPending,undefined);
  r.MP.carts.ghost=0;r.g.goods=[{x:1,z:0,cx:1,cy:0,gi:0,spawnSerial:1},{x:0,z:3,cx:0,cy:3,gi:1,spawnSerial:1}];r.c.botSimShop(.05,r.now());assert.deepEqual(r.walks.at(-1),{x:0,y:3});
});
test('實際鬼AI選通路較短者；隱身後只搜尋最後看見位置，不能重新鎖定隱身者',()=>{
  const r=runtime(),b=r.MP.bots[0];r.c.botSimTag(.05,r.now());assert.equal(b.chaseId,'other');assert.deepEqual(r.walks.at(-1),{x:0,y:3});
  r.MP.players.other={invisUntil:r.now()+10000};r.positions.other={x:4,z:4};r.advance(200);r.c.botSimTag(.05,r.now());assert.deepEqual(r.walks.at(-1),{x:0,y:3});
  r.advance(5000);r.c.botSimTag(.05,r.now());assert.equal(b.chaseId,'human');
});
test('隱身仍可在近距離被偶然擊中，沒有增加無敵能力',()=>{
  const r=runtime();r.MP.tagImmuneUntil=0;r.positions.human={x:.4,z:0};r.positions.other={x:4,z:4};r.c.G.invisUntil=r.now()+5000;r.c.botSimTag(.05,r.now());assert.equal(r.sent[0].to,'human');assert.equal(r.sent[0].t,'tag');
});
test('換鬼後清除前任鬼的最後位置；新鬼隱身時不借舊位置追蹤',()=>{
  const r=runtime(),b=r.MP.bots[0];r.MP.taggedId='human';r.c.botSimTag(.05,r.now());assert.ok(b.threatLastSeen);r.MP.taggedId='other';r.MP.players.other={invisUntil:r.now()+5000};r.c.botSimTag(.05,r.now());assert.equal(b.threatLastSeen,null);
});
test('下一步提示只隨狀態改變更新，不播報、不新建timer，故事及停止時隱藏',()=>{
  const r=runtime();r.api.frame();const hint=r.nodes.get('classicObjectiveHint');assert.match(hint.textContent,/躲避/);const initial=hint.textContent;r.advance(250);r.api.frame();assert.equal(hint.textContent,initial);
  r.MP.taggedId='human';r.advance(250);r.api.frame();assert.match(hint.textContent,/按攻擊/);r.c.TowerMode={active:true};r.advance(250);r.api.frame();assert.equal(hint.hidden,true);
  const source=readFileSync(new URL('../assets/classic-tactics.js',import.meta.url),'utf8');assert.doesNotMatch(source,/setInterval|setTimeout|showToast|announce\(/);
});
test('HUD同分同名次、差額明確；未變動不重畫購物車，新模型仍刷新',()=>{
  const nodes=new Map();let refreshes=0,writes=0;const node=id=>{if(!nodes.has(id)){let value='';nodes.set(id,{style:{},get textContent(){return value;},set textContent(v){writes++;value=v;}});}return nodes.get(id);};
  const MP={id:'a',seed:1,seriesRound:1,started:true,ended:false,roster:[{id:'b'},{id:'a'}],cartList:{a:[1],b:[1]},carts:{a:100,b:100},banked:{},shopBonus:{},players:{}},G={startTime:1,myCart:{},goods:[{taken:false}]};
  const c=vm.createContext({MP,G,window:{ShopCollection:{render(){}}},$:node,isShop:()=>true,matchRules:()=>({unpaidRate:100,cartFull:400}),refreshCarts:()=>refreshes++,shopTotal:id=>MP.carts[id]+(MP.banked[id]||0),cartLoad:id=>MP.carts[id]/400});
  vm.runInContext(html.slice(html.indexOf('function updateShopHud('),html.indexOf('/* =====================================================\n   鬼的嗅覺')),c);c.updateShopHud();assert.match(node('cartRank').textContent,/第1名/);const firstWrites=writes;
  for(let i=0;i<50;i++)c.updateShopHud();assert.equal(refreshes,1);assert.equal(writes,firstWrites);MP.carts.b=130;c.updateShopHud();assert.match(node('cartRank').textContent,/差第一名 \$30/);assert.match(node('cartRank').textContent,/第2名/);
  G.myCart={};c.updateShopHud();assert.equal(refreshes,3);MP.ended=true;c.updateShopHud();assert.equal(node('cartWrap').style.display,'none');
});
