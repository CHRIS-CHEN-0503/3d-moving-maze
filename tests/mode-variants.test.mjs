import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),V=require('../assets/mode-variants-core.js'),S=require('../assets/shop-collection-core.js'),R=require('../assets/game-rules.js');
const points=[{x:0,z:0},{x:20,z:0}],make=mode=>V.create(mode,31,'31:1',points,['a','b','c','d']);
test('五個新變體皆預設關閉，原版與房主的共享規則保留',()=>{
  const r=R.normalize({});for(const mode of ['race','treasure','ctf','shop','tag'])assert.equal(V.enabled(mode,r),false);
  for(const [mode,key]of [['race','raceCheckpoint'],['treasure','treasureSeal'],['ctf','ctfShortcut'],['shop','shopOrders'],['tag','tagBells']])assert.equal(V.enabled(mode,R.normalize({[key]:1})),true);
  assert.equal(R.normalize({shopCollect:0,shopOrders:1}).shopOrders,0);
});
test('每輪地標由種子決定，避開起點出口且位置分散',()=>{
  const a=V.cells(31,13,13,2,[{x:0,y:0},{x:6,y:6}]);assert.deepEqual(a,V.cells(31,13,13,2,[{x:0,y:0},{x:6,y:6}]));assert.equal(a.length,2);
  assert.ok(a.every(p=>p.x>0&&p.y>0&&p.x<12&&p.y<12));assert.ok(a.every(p=>Math.abs(p.x-6)+Math.abs(p.y-6)>=2));assert.notDeepEqual(a,V.cells(32,13,13));
});
test('競速必須站定地標才可完成，移動、暈眩、變形會中斷蓄進度',()=>{
  const s=make('race');assert.equal(V.canFinish(s,'a'),false);V.tick(s,{a:points[0]},0);assert.ok(s.progress.a.channel);
  V.tick(s,{a:{x:10,z:10}},700);assert.equal(s.progress.a.channel,null);V.tick(s,{a:points[0]},800);V.tick(s,{a:points[0]},1599);assert.equal(V.canFinish(s,'a'),false);
  V.tick(s,{a:points[0]},1600,{stunned:{a:true}});assert.equal(s.progress.a.channel,null);V.tick(s,{a:points[0]},1700);V.tick(s,{a:points[0]},1800,{shifting:true});assert.equal(s.progress.a.channel,null);
  V.tick(s,{a:points[0]},2000);assert.equal(V.tick(s,{a:points[0]},2800)[0].kind,'checkpoint');assert.equal(V.canFinish(s,'a'),true);assert.equal(V.canFinish(s,'b'),false);
});
test('尋寶只有持寶者能在任一公開封印點解封，離開後要重新站定',()=>{
  const s=make('treasure');V.tick(s,{a:points[0]},0,{holder:'b'});assert.equal(s.progress.a.channel,null);
  V.tick(s,{a:points[1]},0,{holder:'a'});V.tick(s,{a:points[1]},1400,{holder:'b'});assert.equal(s.progress.a.channel,null);
  V.tick(s,{b:points[0]},1500,{holder:'b'});assert.equal(V.tick(s,{b:points[0]},3000,{holder:'b'})[0].kind,'seal');assert.equal(V.canFinish(s,'b'),true);
});
test('安全鐘交替、僅逃跑者可計分、有冷卻且上限150，不取代原勝負',()=>{
  const s=make('tag');V.tick(s,{a:points[0]},0,{ghost:'a'});V.tick(s,{a:points[0]},2000,{ghost:'a'});assert.equal(s.progress.a.score,0);
  V.tick(s,{a:points[0]},3000,{ghost:'b'});V.tick(s,{a:points[0]},4000,{ghost:'b'});assert.equal(s.progress.a.score,25);
  V.tick(s,{a:points[1]},5000,{ghost:'b'});assert.equal(s.progress.a.channel,null);
  for(let n=1;n<6;n++){const at=4000+n*17000,p=points[n%2];V.tick(s,{a:p},at,{ghost:'b'});V.tick(s,{a:p},at+1000,{ghost:'b'});}
  assert.equal(s.progress.a.score,150);assert.equal(s.progress.a.bell,6);assert.equal(V.canFinish(s,'a'),true);
});
test('奪旗每隊側翼符文站定兩秒打開十秒；隊友不互相清掉站定進度',()=>{
  const s=make('ctf'),ctx={teams:{a:0,b:0,c:1,d:1}};V.tick(s,{a:points[0],b:{x:5,z:5}},0,ctx);assert.ok(s.shortcut[0].channel);
  assert.equal(V.tick(s,{a:points[0],b:{x:5,z:5}},2000,ctx)[0].kind,'shortcut');assert.equal(s.shortcut[0].until,12000);assert.equal(s.shortcut[0].cool,17000);
  V.tick(s,{c:points[1]},3000,ctx);V.tick(s,{c:points[1]},3500,{...ctx,shifting:true});assert.equal(s.shortcut[1].channel,null);
  V.tick(s,{c:points[1]},4000,ctx);assert.equal(V.tick(s,{c:points[1]},6000,ctx)[0].team,1);
});
test('追加訂單完成五樣後才能二選一，同時一單，所有商品結帳後才得分',()=>{
  const m=S.create(99,30);assert.deepEqual(S.offers(m,'a'),[]);assert.equal(S.choose(m,'a',0),false);assert.equal(S.checkout(m,'a',m.targets),300);
  const offers=S.offers(m,'a');assert.equal(offers[0].targets.length,2);assert.equal(offers[1].targets.length,3);
  const copy=S.create(99,30);S.checkout(copy,'a',copy.targets);assert.deepEqual(offers,S.offers(copy,'a'));
  assert.equal(S.choose(m,'a',1),true);assert.equal(S.choose(m,'a',0),false);const order=S.progress(m,'a').order;
  assert.equal(S.checkoutOrder(m,'a',[order.targets[0],order.targets[0]]),0);assert.equal(S.checkoutOrder(m,'a',order.targets.slice(1)),150);assert.equal(S.checkoutOrder(m,'a',order.targets),0);
  for(let i=0;i<2;i++){assert.equal(S.choose(m,'a',0),true);assert.equal(S.checkoutOrder(m,'a',S.progress(m,'a').order.targets),80);}assert.equal(S.progress(m,'a').orders,3);assert.deepEqual(S.offers(m,'a'),[]);
});
test('變體使用既有botWalk碰撞尋路，不瞬移；新地標在公開地圖上而非透視敵人',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),runtime=readFileSync(new URL('../assets/mode-variants.js',import.meta.url),'utf8');
  assert.match(html,/ModeVariants\?\.botGoal\(b,goal,goalKey,now\)/);assert.match(html,/ModeVariants\.canFinish\(b.id\)/);assert.match(runtime,/solveMaze\(/);assert.ok(html.indexOf('ModeVariants.map(ctx,big,pad,cw,ch)')>html.indexOf('window.MazeSight?.map(ctx,pad,cw,ch)'));
  assert.match(runtime,/Never close a gate through an actor/);assert.ok(!runtime.includes('b.x='));
});
