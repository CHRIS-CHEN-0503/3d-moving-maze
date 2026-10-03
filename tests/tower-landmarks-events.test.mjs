import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-landmarks.js'),E=require('../story/tower-adventure-events.js'),T=require('../lib/three.min.js');
const copy=v=>JSON.parse(JSON.stringify(v));
function fresh(floor=99,seed=31415){const run=H.enable(P.enable(C.newRun({seed,name:'小事件測試'}),'swordsman').run).run;run.floor=floor;run.floorsCleared=99-floor;P.advance(run);assert.ok(C.validateSave(run),'floor fixture');return run;}
function eventRun(kind){for(let f=99;f>2;f--){const run=fresh(f);if(E.offer(run)?.kind===kind&&f%10>2){E.ensure(run);return run;}}throw Error('no event '+kind);}
// Connected spanning tree, with random edge changes outside the fixed island.
function maze(size,variant){const m={width:size,height:size,hWalls:Array.from({length:size-1},()=>Array(size).fill(true)),vWalls:Array.from({length:size},()=>Array(size-1).fill(false))};for(let y=0;y<size-1;y++)m.hWalls[y][variant%2?size-1-y%(size-1):y%(size-1)]=false;return m;}
function reachable(m,start={x:0,y:0}){const queue=[start],seen=new Set([L.key(start)]);for(let i=0;i<queue.length;i++){const {x,y}=queue[i],next=[];if(x>0&&!m.vWalls[y][x-1])next.push({x:x-1,y});if(x<m.width-1&&!m.vWalls[y][x])next.push({x:x+1,y});if(y>0&&!m.hWalls[y-1][x])next.push({x,y:y-1});if(y<m.height-1&&!m.hWalls[y][x])next.push({x,y:y+1});for(const p of next)if(!seen.has(L.key(p))){seen.add(L.key(p));queue.push(p);}}return seen;}
test('every ground and underground landscape has one deterministic interior 3x3 island',()=>{
  for(const floor of [...Array.from({length:99},(_,i)=>i+1),...Array.from({length:50},(_,i)=>-i-1)])for(const seed of [1,17,31415,2147483647]){
    const run={floor,seed,party:{},expedition:{active:null}},size=C.floorConfig(floor,seed).size,p=L.plan(run,size);
    assert.equal(p.cells.length,9);assert.deepEqual(L.plan(copy(run),size),p);assert.ok(p.cells.every(c=>c.x>0&&c.y>0&&c.x<size-1&&c.y<size-1));assert.ok(!p.cells.some(c=>c.x===0&&c.y===0||c.x===size-1&&c.y===size-1));
    const a=maze(size,0),b=maze(size,1),before=copy(a);L.prepareMaze(run,a,{x:p.x,y:p.y});L.prepareMaze(run,b,{x:0,y:0});
    for(let y=p.y;y<p.y+3;y++)for(let x=p.x;x<p.x+2;x++){assert.equal(a.vWalls[y][x],false);assert.equal(b.vWalls[y][x],false);}
    for(let y=p.y;y<p.y+2;y++)for(let x=p.x;x<p.x+3;x++){assert.equal(a.hWalls[y][x],false);assert.equal(b.hWalls[y][x],false);}
    for(let y=0;y<size-1;y++)for(let x=0;x<size;x++)if(!before.hWalls[y][x])assert.equal(a.hWalls[y][x],false,'never closes a generated corridor');
    assert.equal(reachable(a,{x:p.x,y:p.y}).size,size*size);assert.equal(reachable(b).size,size*size);
  }
});
test('landscapes preserve mode scope, reject malformed wall arrays and add no light budget',()=>{
  const run=fresh(88),base=maze(7,0);assert.equal(L.plan({...run,party:null},7),null);assert.equal(L.plan({...run,expedition:{active:{id:'test'}}},7),null);assert.throws(()=>L.prepareMaze(run,{...base,hWalls:[]}),RangeError);
  for(const kind of Object.keys(L.NAMES)){const model=L.build(T,{kind,id:'fixture'},4);let draws=0;model.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh)draws++;});assert.ok(draws<=12);assert.match(L.svg(kind),/^<svg/);assert.equal(model.userData.landmarkId,'fixture');}
});
test('event offers are seed-stable, only in three intended environments and spaced two or three floors',()=>{
  const seen=new Set();for(const seed of [1,2,3,31,31415]){const byKind={};for(let f=99;f>0;f--){const run={floor:f,seed,party:{},expedition:{active:null}},q=E.offer(run);assert.deepEqual(E.offer(copy(run)),q);if(!q)continue;seen.add(q.kind);assert.ok(![90,80,70,60,50,40,30,20,10,1].includes(f));assert.equal(E.offer({...run,expedition:{active:{}}}),null);assert.equal(E.offer({...run,party:null}),null);(byKind[q.kind]??=[]).push(f);}for(const floors of Object.values(byKind))for(let i=1;i<floors.length;i++)if(floors[i-1]-floors[i]<10)assert.ok([2,3,4,6].includes(floors[i-1]-floors[i]));}
  assert.deepEqual([...seen].sort(),['forest','river','workshop']);
});
test('both alternatives are committed once; next-floor benefits persist across readback',()=>{
  for(const kind of ['forest','workshop','river'])for(const choice of [0,1]){
    let run=eventRun(kind),q=E.offer(run);const before=copy(run),r=E.choose(run,q.id,choice);assert.ok(r.ok,r.message);run=r.run;
    assert.ok(C.validateSave(run));assert.equal(run.adventure.events.current.choice,choice);assert.equal(E.choose(run,q.id,choice).ok,false);assert.equal(E.choose(run,q.id,1-choice).ok,false);assert.deepEqual(run.adventure.events.history,[q.id]);
    run=C.validateSave(copy(run));assert.ok(run);if(choice===1){if(kind==='forest')assert.equal(run.party.journey.materials.toughfiber,before.party.journey.materials.toughfiber+2);if(kind==='workshop')assert.equal(run.party.journey.scrap,before.party.journey.scrap+3);if(kind==='river')assert.equal(run.party.ingredients.lotus,before.party.ingredients.lotus+2);}
    const descent=C.descend(run,run.revision);assert.ok(descent.ok,descent.message);run=descent.run;assert.ok(C.validateSave(run));assert.equal(run.adventure.events.pending,null);
    if(choice===0){if(kind==='forest'){assert.equal(run.party.ingredients.herb,before.party.ingredients.herb+1);assert.equal(run.party.ingredients.root,before.party.ingredients.root+1);}if(kind==='workshop'){assert.equal(E.senseScale(run),.7);E.tick(run,60);assert.equal(E.senseScale(run),1);}if(kind==='river')assert.equal(run.effects.freeze,20);}
    const snapshot=copy(run);E.ensure(run);assert.deepEqual(run,snapshot,'reload/ensure never repeats resources');
  }
});
test('follow-up needs two actual descents, has clear next step, never gates descent, pays once',()=>{
  let run=eventRun('forest'),q=E.offer(run);run=E.choose(run,q.id,1).run;assert.equal(E.inspect(run).ok,false);assert.equal(E.settle(run).ok,false);assert.match(E.brief(run).next,/前往/);
  run=C.descend(run,run.revision).run;assert.equal(E.inspect(run).ok,false);run=C.descend(run,run.revision).run;assert.equal(run.floor,q.floor-2);assert.ok(E.brief(run));const inspect=E.inspect(run);assert.ok(inspect.ok);run=inspect.run;assert.equal(E.inspect(run).ok,false);const before=run.coins;run=E.settle(run).run;assert.equal(run.coins,before+12);assert.equal(E.settle(run).ok,false);assert.equal(E.brief(run),null);assert.ok(C.validateSave(run));
});
test('abandoning or walking past a follow-up costs nothing and leaves the main-line available',()=>{
  let run=eventRun('workshop'),q=E.offer(run);run=E.choose(run,q.id,0).run;const coins=run.coins;const abandoned=E.settle(run,true);assert.ok(abandoned.ok);assert.equal(abandoned.run.coins,coins);assert.equal(E.brief(abandoned.run),null);assert.ok(C.descend(abandoned.run,abandoned.run.revision).ok);
  for(let i=0;i<3;i++){const result=C.descend(run,run.revision);assert.ok(result.ok,result.message);run=result.run;}assert.equal(run.adventure.events.chain.status,'abandoned');assert.equal(E.brief(run),null);
});
test('strict event validation rejects invented rewards, identities, excess fields and duplicate history',()=>{
  const run=E.choose(eventRun('forest'),E.offer(eventRun('forest')).id,0).run,ctx={floor:run.floor,seed:run.seed};assert.ok(E.validate(run.adventure.events,ctx));
  const cases=[s=>s.history.push(s.history[0]),s=>s.current.extraReward=99,s=>s.current.choice=null,s=>s.pending.targetFloor-=1,s=>s.history[0]=s.history[0].replace(':'+run.seed+':',':12:'),s=>s.chain.status='rewarded',s=>s.benefit={floor:run.floor,kind:'quiet',left:999}];for(const mutate of cases){const bad=copy(run.adventure.events);mutate(bad);assert.equal(E.validate(bad,ctx),null);}
  assert.deepEqual(E.validate(undefined,ctx),E.fresh());
});
test('both lords stop at half health once and cannot be damaged until their actual counterplay completes',()=>{
  for(const floor of [80,60]){const run=fresh(floor);E.ensure(run);run.party.health['monster-11']=200;const damage=E.limitLordDamage(run,'monster-11',1000,200);assert.equal(damage,100);run.party.health['monster-11']-=damage;assert.equal(E.lordState(run).phase,'guarded');assert.equal(E.limitLordDamage(run,'monster-11',100,200),0);assert.equal(E.limitLordDamage(run,'monster-0',100,200),100);let state=run;
    if(floor===60){assert.equal(E.counter(state,0).ok,false);state=E.armCounter(state).run;}
    for(let i=0;i<(floor===80?2:1);i++){const r=E.counter(state,i);assert.ok(r.ok,r.message);state=r.run;assert.equal(E.counter(state,i).ok,false);if(i===0&&floor===80)assert.equal(E.limitLordDamage(state,'monster-11',100,200),0);}
    assert.equal(E.lordState(state).phase,'exposed');assert.equal(E.limitLordDamage(state,'monster-11',100,200),100);assert.ok(C.validateSave(state));
  }
});
test('echo reflector window expires and garden cannot use it; original lord guards remain independent',()=>{
  const run=fresh(60);E.ensure(run);assert.equal(E.armCounter(run).ok,false);run.party.health['monster-11']=200;E.limitLordDamage(run,'monster-11',200,200);const armed=E.armCounter(run);assert.ok(armed.ok);assert.equal(armed.run.adventure.events.lord.armed,8);E.tick(armed.run,8);assert.equal(armed.run.adventure.events.lord.armed,0);assert.equal(armed.run.adventure.events.lord.phase,'guarded');assert.equal(P.canDescend(armed.run),false);
  const garden=fresh(80);E.ensure(garden);E.limitLordDamage(garden,'monster-11',999,200);assert.equal(E.armCounter(garden).ok,false);
});
test('shared original icons are safe, text-free drawings for all events and counter objects',()=>{for(const kind of [...Object.keys(E.KINDS),'rootCounter','crystalCounter']){assert.match(E.svg(kind),/^<svg/);assert.ok(!E.svg(kind).includes('<text'));}assert.equal(E.svg('not-an-event'),'');});
