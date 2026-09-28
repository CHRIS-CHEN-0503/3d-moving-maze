import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js'),V=require('../story/tower-characters.js'),N=require('../story/tower-narrative.js');
const partySource=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
const towerSource=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const gameSource=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const followSource=towerSource.slice(towerSource.indexOf('  function followerClear('),towerSource.indexOf('  function floorSeed('));
function generatedMaze(seed,size){
  const G={cell:4,wallT:.7,mazeW:size,mazeH:size,exitCell:{x:size-1,y:size-1}},g=vm.createContext({G,window:{},isShop:()=>false});
  vm.runInContext(gameSource.slice(gameSource.indexOf('let RNG='),gameSource.indexOf('/* =====================================================\n   牆壁'))+gameSource.slice(gameSource.indexOf('function solveMaze('),gameSource.indexOf('/* 從某格做 BFS'))+gameSource.slice(gameSource.indexOf('function playerInWall('),gameSource.indexOf('function unstuckPlayer(')),g);
  g.setSeed(seed);g.genMaze(0,0);
  vm.runInContext(gameSource.slice(gameSource.indexOf('  G.wallBoxes=[];',gameSource.indexOf('function buildWalls(')),gameSource.indexOf('  const geo=new THREE.BoxGeometry(1,h,1);')),g);
  return {cell:g.cellToWorld,worldToCell:g.worldToCell,blocked:g.playerInWall,solve:g.solveMaze,route:g.solveMaze(0,0).slice(0,18)};
}
function fixture(route,jobs=['mage','scout','healer'],floor=99,geometry=null){
  let run=P.enable(C.newRun({seed:31415}),'chef').run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);
  run.party.members=jobs.map(profession=>({id:'companion:'+profession,profession,level:2,hp:40,cooldown:99,hurtLeft:0}));run.party.joined=run.party.members.map(m=>m.id);
  let paused=false,now=0,solves=0;const G={px:0,pz:0,running:true,shifting:false},world=new T.Group(),player=new T.Group(),monsters=[],calls=[],actors=new Map();
  const inside=(x,z)=>route.slice(1).some((b,i)=>{const a=route[i];return x>=Math.min(a[0],b[0])*4-1.65&&x<=Math.max(a[0],b[0])*4+1.65&&z>=Math.min(a[1],b[1])*4-1.65&&z<=Math.max(a[1],b[1])*4+1.65;});
  const blocked=geometry?((x,z,r=.28)=>geometry.blocked(x,z,r)):((x,z,r=.28)=>![[x-r,z-r],[x+r,z-r],[x-r,z+r],[x+r,z+r]].every(([a,b])=>inside(a,b)));
  const cell=geometry?.cell||((x,y)=>({x:x*4,z:y*4,cx:x,cy:y})),worldToCell=geometry?.worldToCell||((x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}));
  const solve=(x,y,ex,ey)=>{solves++;if(geometry)return geometry.solve(x,y,ex,ey);const a=route.findIndex(p=>p[0]===x&&p[1]===y),b=route.findIndex(p=>p[0]===ex&&p[1]===ey);if(a<0||b<0)return [];return a<=b?route.slice(a,b+1):route.slice(b,a+1).reverse();};
  const start=cell(0,0);G.px=start.x;G.pz=start.z;
  const context=vm.createContext({TowerPartyCore:P,TowerExpedition:X,TowerCharacters:V,G,cellToWorld:cell,worldToCell,solveMaze:solve,playerInWall:blocked,document:{getElementById:()=>null}});
  vm.runInContext(followSource+partySource.replace('return {enabled,live,portrait,','return {queueForTest:()=>queue,enabled,live,portrait,'),context);
  const ui=context.TowerPartyRuntime.create({THREE:T,G,core:C,text:String,action:()=>'',dialog(){},transact:result=>{if(!result.ok)return false;run=result.run;return true;},save(){},toast(){},audio:{sfxHit(){},sfxUse(){},sfxSwing(){}},quest(){},
    run:()=>run,paused:()=>paused,inDungeon:()=>false,world:()=>world,monsters:()=>monsters,traders:()=>[],player:()=>player,
    clear:(x,z,bx,bz)=>context.followerClear({x,z},{x:bx,z:bz}),followClear:context.followerClear,followDistance:context.followerDistance,cell,worldToCell,chooseCell:()=>cell(...route.at(-1)),makeText:()=>new T.Group(),
    follow:(a,dt,speed,stop,target,options)=>{actors.set(a.id,a);calls.push({id:a.id,target:{x:target.x,z:target.z},leader:a.queueLeader,speed});return context.followNpc(a,dt,speed,stop,target,options);},dispose(){},damage(){},bind(){},swing(){},
  });
  ui.build(()=>.5,new Set());
  const models=()=>world.children.at(-1).children.filter(m=>m.userData.companionId);
  let minGap=Infinity,wallHits=0;
  function step(fps){now+=1000/fps;ui.tick(1/fps,now);const ms=models();for(const a of ms){if(blocked(a.position.x,a.position.z))wallHits++;for(const b of ms)if(a!==b)minGap=Math.min(minGap,a.position.distanceTo(b.position));}}
  function wait(seconds,fps){for(let i=0;i<seconds*fps;i++)step(fps);}
  function walk(points,fps){for(const [cx,cy]of points){const q=cell(cx,cy);let safety=0;while(Math.hypot(q.x-G.px,q.z-G.pz)>.001){assert.ok(++safety<fps*20,'walking fixture stalled');const dx=q.x-G.px,dz=q.z-G.pz,d=Math.hypot(dx,dz),s=Math.min(d,5.2/fps);G.px+=dx/d*s;G.pz+=dz/d*s;step(fps);}}}
  return {ui,G,player,models,monsters,calls,actors,walk,wait,step,blocked,clear:context.followerClear,routeDistance:context.followerDistance,get run(){return run;},get wallHits(){return wallHits;},get minGap(){return minGap;},get solves(){return solves;},set paused(value){paused=value;}};
}
const straight=Array.from({length:9},(_,i)=>[i,0]);
const corners=[[0,0],[1,0],[2,0],[2,1],[2,2],[1,2],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4]];
function assertQueue(h){const player={x:h.G.px,z:h.G.pz};let leader=player;for(const a of h.models().sort((a,b)=>h.routeDistance(a.position,player)-h.routeDistance(b.position,player))){const d=Math.hypot(a.position.x-leader.x,a.position.z-leader.z),actor=h.actors.get(a.userData.companionId);assert.ok(d<=1.81&&d>=1.14,JSON.stringify({reason:'queue gap',leader,p:a.position,d,path:actor?.path,clear:h.clear(a.position,leader),wall:h.wallHits}));assert.ok(h.clear(a.position,leader),'queue must remain connected by a safe path');leader=a.position;}assert.equal(h.wallHits,0);assert.ok(h.minGap>=1.148,`minimum pair gap ${h.minGap}`);}
for(const fps of [10,30,60,120])test(`three companions queue without overlap or wall cutting at ${fps} fps`,()=>{
  const h=fixture(corners);h.walk(corners.slice(1),fps);h.wait(8,fps);assertQueue(h);
  assert.ok(h.solves<300,'path searches remain bounded, not every frame');
});
test('straight-line stopping keeps all three distinct, then a U-turn reforms the queue without changing the roster',()=>{
  const h=fixture(straight);h.walk(straight.slice(1),60);h.wait(3,60);assertQueue(h);
  const ids=h.run.party.members.map(m=>m.id);
  h.walk(straight.slice().reverse().slice(1),60);h.wait(8,60);assertQueue(h);
  assert.deepEqual(h.run.party.members.map(m=>m.id),ids);
});
test('maze shifts distribute companions sharing a cell, then resume a separated queue',()=>{
  const h=fixture(corners);for(const m of h.models())m.position.set(0,0,0);h.ui.shift();
  const ms=h.models();for(let i=0;i<ms.length;i++){assert.ok(!h.blocked(ms[i].position.x,ms[i].position.z));for(let j=i+1;j<ms.length;j++)assert.ok(ms[i].position.distanceTo(ms[j].position)>=1.15);}
  h.walk(corners.slice(1),60);h.wait(8,60);assertQueue(h);
});
test('a downed leader is skipped, revival rejoins, and pause cannot move the queue',()=>{
  const h=fixture(straight);h.run.party.members[0].hp=0;h.walk(straight.slice(1,5),60);h.wait(3,60);
  assert.ok(h.calls.every(c=>c.leader!=='companion:mage'));assert.ok(h.calls.some(c=>c.leader==='player'));
  assert.equal(h.wallHits,0);assert.ok(h.minGap>=1.148);
  h.run.party.members[0].hp=40;h.walk(straight.slice(5),60);h.wait(12,60);assertQueue(h);
  const positions=h.models().map(m=>m.position.toArray());h.paused=true;h.G.px+=3;h.wait(2,60);assert.deepEqual(h.models().map(m=>m.position.toArray()),positions);
});
test('a swordfighter leaves the queue to intercept; others follow the player, then reunite after combat',()=>{
  const h=fixture(straight,['swordsman','mage','scout'],84),guard=h.models()[0];
  const spec=P.monsterSpecs(h.run)[0],model=new T.Group();model.position.set(guard.position.x,0,guard.position.z+.7);
  const enemy={...spec,model,alive:true,windup:0,cooldown:2};h.monsters.push(enemy);h.step(60);
  assert.equal(h.calls.find(c=>c.id==='companion:swordsman').leader,'enemy:'+enemy.id);
  assert.equal(h.calls.find(c=>c.id==='companion:swordsman').speed,3.6);
  assert.ok(h.calls.filter(c=>c.id!=='companion:swordsman').every(c=>c.leader!=='companion:swordsman'));assert.ok(h.calls.some(c=>c.leader==='player'));
  enemy.alive=false;h.walk(straight.slice(1),60);h.wait(8,60);assertQueue(h);
});
test('generated mazes retain a moving queue after re-forming at a crowded entry',()=>{
  for(let seed=1;seed<=20;seed++)for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const geometry=generatedMaze(seed,7),h=fixture(geometry.route,undefined,99,geometry);
    h.player.rotation.y=yaw;for(const m of h.models())m.position.set(h.G.px,0,h.G.pz);h.ui.shift();const q=h.ui.queueForTest(),old=q.slice();q.splice(0,3,...order.map(i=>old[i]));
    h.walk(geometry.route.slice(1),60);h.wait(10,60);
    try{assertQueue(h);}catch(error){error.message='seed '+seed+' yaw '+yaw+' order '+order+' '+error.message+' '+JSON.stringify([...h.actors].map(([id,a])=>({id,p:a.model.position,leader:a.queueLeader,path:a.path,safeTurn:a.safeTurn})));throw error;}
  }
});
