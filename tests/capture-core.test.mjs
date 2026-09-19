import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../assets/capture-core.js'),R=require('../assets/game-rules.js');
const roster=n=>Array.from({length:n},(_,i)=>({id:'p'+i}));
const make=()=>C.create(roster(4),{x:0,z:0},[{x:-20,z:0},{x:20,z:0}],0);
test('兩隊各 2～5 人、固定交錯分隊，拒絕不完整或重複名單',()=>{
  for(const n of [4,6,8,10]){const s=C.create(roster(n),{},[],0);for(const team of [0,1])assert.equal(Object.values(s.members).filter(m=>m.team===team).length,n/2);}
  for(const n of [0,2,3,5,11,12])assert.throws(()=>C.create(roster(n),{},[]));
  assert.throws(()=>C.create([{id:'a'},{id:'b'},{id:'a'},{id:'c'}],{},[]));
});
test('搶旗到敌方基地必須連續佔領三秒，勝利只結算一次',()=>{
  const s=make(),p={p0:{x:0,z:0}};C.tick(s,p,100);assert.equal(s.flag.holder,'p0');
  p.p0={x:-20,z:0};C.tick(s,p,200);assert.equal(s.channel,null,'自己基地不可得分');
  p.p0={x:20,z:0};C.tick(s,p,1000);C.tick(s,p,3999);assert.equal(s.winner,null);
  C.tick(s,p,4000);assert.equal(s.winner,0);assert.equal(s.members.p0.points,1500);assert.equal(s.members.p2.points,1000);
  C.tick(s,p,9000);assert.equal(s.members.p0.points,1500);
});
test('敵人守基地中斷佔領，離开後重新倒數；隔牆敵人不干擾',()=>{
  const s=make(),p={p0:{x:0,z:0}};C.tick(s,p,10);p.p0={x:20,z:0};C.tick(s,p,1000);
  p.p1={x:20,z:1};C.tick(s,p,3000);assert.equal(s.channel,null);
  C.tick(s,p,3100,()=>false);assert.equal(s.channel.since,3100);
  p.p1={x:30,z:0};C.tick(s,p,6100);assert.equal(s.winner,0);
});
test('遠處隊友互相交戰不會中斷持旗者佔領',()=>{
  const s=make(),p={p0:{x:0,z:0},p1:{x:0,z:20},p2:{x:1,z:20}};C.tick(s,p,100);p.p0={x:20,z:0};C.tick(s,p,4000);
  assert.equal(C.attack(s,'p2','p1',p,5000),true);assert.equal(s.channel.since,4000);C.tick(s,p,7000);assert.equal(s.winner,0);
});
test('近距離同隊接力、不穿牆、有冷卻，不可傳給敵隊或離線者',()=>{
  const s=make(),p={p0:{x:0,z:0},p2:{x:3,z:0},p1:{x:1,z:0}};C.tick(s,p,10);
  assert.equal(C.pass(s,'p0','p2',p,500),false);
  assert.equal(C.pass(s,'p0','p1',p,2000),false);
  assert.equal(C.pass(s,'p0','p2',p,2000,()=>false),false);
  assert.equal(C.pass(s,'p0','p2',p,2000),true);assert.equal(s.flag.holder,'p2');assert.equal(s.members.p0.passes,1);
  assert.equal(C.pass(s,'p2','p0',p,2500),false);assert.equal(s.members.p0.points,0,'接力不能刷分');
});
test('敵隊受擊掉旗、回城序號與保護，隊友不誤傷，攻擊不能連發',()=>{
  const s=make(),p={p0:{x:0,z:0},p1:{x:1,z:0},p2:{x:0,z:1}};C.tick(s,p,10);
  assert.equal(C.attack(s,'p1','p0',p,1000),false,'開場保護');
  assert.equal(C.attack(s,'p2','p0',p,4000),false,'友軍');
  assert.equal(C.attack(s,'p1','p0',p,4000,()=>false),false,'牆壁');
  assert.equal(C.attack(s,'p1','p0',p,4000),true);assert.equal(s.flag.holder,null);assert.equal(s.members.p0.respawn,1);assert.equal(s.members.p0.stun,7000);
  assert.equal(C.attack(s,'p1','p0',p,4100),false);assert.equal(s.members.p1.points,75);
  C.tick(s,{p0:p.p0},6000);assert.equal(s.flag.holder,null,'暈眩不能搶旗');
});
test('無人拾取 20 秒歸中央；掉線也會掉旗，不能再參賽',()=>{
  const s=make(),p={p0:{x:0,z:0}};C.tick(s,p,100);p.p0={x:9,z:8};C.disconnect(s,'p0',p,1000);
  assert.equal(s.flag.x,9);assert.equal(s.members.p0.offline,true);C.tick(s,{},20999);assert.equal(s.flag.x,9);C.tick(s,{},21000);assert.equal(s.flag.x,0);
  C.tick(s,{p0:{x:0,z:0}},23000);assert.equal(s.flag.holder,null);
});
test('規則白名單拒絕技術網址、限制數值且至少保留一種視角',()=>{
  const r=R.normalize({teamSize:99,mazeSize:500,broker:'evil',apiUrl:'evil',views:{},itemCount:-9});
  assert.equal(r.teamSize,2);assert.equal(r.mazeSize,13);assert.equal(r.itemCount,3);assert.equal(r.broker,undefined);assert.equal(r.apiUrl,undefined);assert.ok(r.views.tp);
  assert.ok(R.visible('ctf').includes('teamSize'));assert.ok(!R.visible('classic').includes('teamSize'));assert.ok(!R.visible('ctf').includes('foodCount'));assert.ok(R.visible('race').includes('hungerMin'));
});
