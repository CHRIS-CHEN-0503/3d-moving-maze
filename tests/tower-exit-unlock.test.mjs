import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),N=require('../story/tower-narrative.js'),P=require('../story/tower-party-core.js'),D=require('../story/tower-dungeons.js'),E=require('../story/tower-encounters.js'),L=require('../story/tower-floor-lords.js'),T=require('../lib/three.min.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
// Only expose closure state to this isolated test VM. Both production entry
// points and every completion rule run from the actual, unmodified module.
const bridge=`window.__exitTest={
  setup(value,enabled=true){run=value;active=enabled;paused=false;floorStarted=!!value;floorConfig=value?C.floorConfig(value.floor):null;exitDeclined=false;},
  state(){return {run,paused,exitDeclined};},handleAction,closeDialog,
};`;
assert.match(source,/  install\(\);\s*\}\)\(\);\s*$/);
function fresh(floor=99,party=true,seed=123){
  let r=C.newRun({seed});if(party)r=P.enable(r,'swordsman').run;
  r.floor=floor;r.floorsCleared=floor<0?99+(-floor-1):99-floor;r.chronicle=N.newChronicle(floor);r.expedition=D.newExpedition();
  if(floor<0){r.chronicle.ending='release';r.chronicle.read=N.SCENES.map(s=>s.id);r.underworld={version:1,departed:null,surfaceEnding:'release'};}
  if(party)P.advance(r);return r;
}
function runtime(run=fresh()){
  const nodes=new Map(),storage=new Map();let now=1000;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:true,textContent:'',innerHTML:'',focus(){},isConnected:true,querySelector(){return null;},classList:{add(){},remove(){},toggle(){}}});return nodes.get(id);};
  const context=vm.createContext({
    window:{TowerCore:C,TowerEncounters:E,TowerNarrative:N,TowerDungeons:D,TowerPartyCore:P,TowerFloorLords:L},THREE:T,
    document:{getElementById:node,activeElement:node('focus'),body:{classList:{add(){},remove(){},toggle(){}}}},
    performance:{now:()=>now},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    G:{running:true,frozen:false,shifting:false,satiety:100,px:0,pz:0,startTime:100,shovels:1,kites:0,whistles:0,shovelRechargeAt:0,skillCoolUntil:0,effects:{},mazeW:7,mazeH:7,exitCell:{x:6,y:6}},
    keys:{},joy:{active:false,dx:0,dy:0},showToast(){},AudioEng:{sfxTick(){},sfxPickup(){}},escapeHtml:String,
    playerInWall:()=>false,worldToCell:()=>({x:0,y:0}),cellToWorld:(x,y)=>({x:x*4,z:y*4}),solveMaze:()=>[[0,0]],
  });
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,bridge),context,{filename:'tower-mode.js'});
  context.window.__exitTest.setup(run);
  return {context,api:context.window.TowerMode,bridge:context.window.__exitTest,nodes,storage,at:value=>{now=value;}};
}
function clue(r){const out=N.collectClue(r);assert.ok(out.ok,out.message);return out.run;}
function seal(r){r.party.boss.started=true;r.party.boss.done=true;r.party.boss.seals.fill(true);return r;}
function defeated(r){r.defeatedMonsters.push(r.floor<0?L.UNDERWORLD_ID:L.ID);return r;}
function archive(){
  for(let seed=1;seed<1000;seed++){
    const r=fresh(95,false,seed),offer=D.offer(r);if(offer?.kind!=='archive')continue;
    const discovered=D.discover(r);assert.ok(discovered.ok);
    const entered=D.enter(discovered.run,offer.id,{x:0,y:0,shiftLeft:120});assert.ok(entered.ok,entered.message);return entered.run;
  }
  assert.fail('An archive dungeon fixture must exist');
}

test('main-floor unlock requires the narrative clue, maze seal and floor-lord defeat together',()=>{
  const r=fresh(90),h=runtime(r);
  assert.equal(h.api.exitUnlocked(),false);assert.equal(N.canDescend(r),false);assert.equal(P.canDescend(r),false);
  h.bridge.setup(seal(defeated(structuredClone(r))));assert.equal(h.api.exitUnlocked(),false,'A solved fight cannot replace the story clue');
  h.bridge.setup(clue(structuredClone(r)));assert.equal(h.api.exitUnlocked(),false,'The clue cannot replace the maze or lord');
  h.bridge.setup(seal(clue(structuredClone(r))));assert.equal(h.api.exitUnlocked(),false,'The maze cannot replace the living lord');
  h.bridge.setup(defeated(clue(structuredClone(r))));assert.equal(h.api.exitUnlocked(),false,'Defeating the lord cannot replace the maze seal');
  const done=seal(defeated(clue(structuredClone(r))));h.bridge.setup(done);
  const before=JSON.stringify(done);assert.equal(h.api.exitUnlocked(),true);
  for(let i=0;i<20;i++)assert.equal(h.api.exitUnlocked(),true);
  assert.equal(JSON.stringify(done),before,'Unlock checks are pure and never grant completion');
  assert.equal(h.storage.size,0);
});

test('ordinary floors and legacy journeys retain their actual narrative/party completion rules',()=>{
  for(const floor of [99,98,91,89,81,71,61,51,41,31,21,11,9,2]){
    const r=fresh(floor),h=runtime(r);assert.equal(h.api.exitUnlocked(),N.canDescend(r)&&P.canDescend(r),String(floor));
  }
  const legacy=fresh(90,false),h=runtime(legacy);assert.equal(h.api.exitUnlocked(),false);
  h.bridge.setup(clue(legacy));assert.equal(h.api.exitUnlocked(),true,'Legacy journeys have no new party-boss requirements');
});

test('all five underground finales require their own clue, mechanism and underground lord ID',()=>{
  for(const floor of [-10,-20,-30,-40,-50]){
    const r=fresh(floor),h=runtime(r);assert.equal(h.api.exitUnlocked(),false,String(floor));
    const wrongLord=seal(clue(structuredClone(r)));wrongLord.defeatedMonsters.push(L.ID);
    h.bridge.setup(wrongLord);assert.equal(h.api.exitUnlocked(),false,'A surface-lord ID cannot defeat a basement lord');
    h.bridge.setup(seal(defeated(structuredClone(r))));assert.equal(h.api.exitUnlocked(),false,'The basement clue remains required');
    h.bridge.setup(defeated(clue(structuredClone(r))));assert.equal(h.api.exitUnlocked(),false,'The basement mechanism remains required');
    const done=seal(defeated(clue(structuredClone(r))));h.bridge.setup(done);assert.equal(h.api.exitUnlocked(),true,String(floor));
    const before=JSON.stringify(done);h.api.exitUnlocked();assert.equal(JSON.stringify(done),before);
  }
});

test('inactive, missing, dead or completed journeys never expose an actionable stair',()=>{
  const h=runtime(fresh());assert.equal(h.api.exitUnlocked(),true);
  h.bridge.setup(fresh(),false);assert.equal(h.api.exitUnlocked(),false);
  h.bridge.setup(null);assert.equal(h.api.exitUnlocked(),false);
  for(const status of ['dead','won','abandoned']){const r=fresh();r.status=status;h.bridge.setup(r);assert.equal(h.api.exitUnlocked(),false,status);}
});

test('a dungeon stair depends on three actual objectives rather than its parent floor gates',()=>{
  let r=archive(),h=runtime(r);assert.equal(h.api.exitUnlocked(),false);
  for(let i=0;i<3;i++){
    const out=D.interact(r,i);assert.ok(out.ok,out.message);r=out.run;h.bridge.setup(r);
    assert.equal(h.api.exitUnlocked(),i===2,'Completed objectives: '+(i+1));
  }
  assert.ok(C.validateSave(r));assert.equal(h.storage.size,0);
});

test('optional explorer commissions never become mandatory staircase completion conditions',()=>{
  let accepted;
  for(let seed=1;seed<1000;seed++){
    const r=fresh(99,false,seed),offer=E.explorerOffer(r);if(offer?.type!=='survey')continue;
    const out=E.acceptQuest(r,offer.id);assert.ok(out.ok);accepted=out.run;break;
  }
  assert.ok(accepted);const h=runtime(accepted);assert.equal(h.api.exitUnlocked(),true);
  h.api.reachExit();assert.match(h.nodes.get('towerDialog').innerHTML,/放棄委託並下降/);
  assert.equal(h.bridge.state().run.floor,99);assert.equal(h.bridge.state().run.adventure.quest.status,'active');
  h.bridge.closeDialog();assert.equal(h.api.exitUnlocked(),true);
});

test('locked stairs cannot open a modal or descend, even through a confirmed exit call',()=>{
  for(const r of [fresh(90),archive()]){
    const h=runtime(r),before=JSON.stringify(r);
    h.api.reachExit();h.api.reachExit(true);
    assert.equal(h.nodes.has('towerDialog'),false);assert.equal(h.bridge.state().paused,false);
    assert.equal(h.bridge.state().exitDeclined,false);assert.equal(JSON.stringify(h.bridge.state().run),before);assert.equal(h.storage.size,0);
  }
});

test('an unlocked but emerging staircase blocks both automatic and confirmed exit attempts',()=>{
  const h=runtime(fresh(99,false)),before=JSON.stringify(h.bridge.state().run);
  h.context.towerStairReveal={revealing:true};assert.equal(h.api.exitUnlocked(),true,'Completion is independent of a cosmetic animation');
  h.api.reachExit();h.api.reachExit(true);
  assert.equal(h.nodes.has('towerDialog'),false);assert.equal(JSON.stringify(h.bridge.state().run),before);assert.equal(h.storage.size,0);
  h.context.towerStairReveal.revealing=false;h.api.reachExit();
  assert.match(h.nodes.get('towerDialog').innerHTML,/留在本層/);assert.match(h.nodes.get('towerDialog').innerHTML,/exit-confirm/);
});

test('after the reveal, remain preserves progress and explicit confirmation retains descent',()=>{
  const h=runtime(fresh(99,false));h.context.towerStairReveal={revealing:false};h.api.reachExit();
  assert.equal(h.bridge.state().paused,true);assert.equal(h.bridge.state().run.floor,99);
  assert.match(h.nodes.get('towerDialog').innerHTML,/留在本層/);
  h.bridge.handleAction('close');assert.equal(h.bridge.state().paused,false);assert.equal(h.bridge.state().run.floor,99);
  h.api.reachExit();assert.equal(h.bridge.state().run.floor,99,'Staying at the same stair never reopens or auto-confirms');
  h.bridge.setup(h.bridge.state().run);h.api.reachExit();h.bridge.handleAction('exit-confirm');
  assert.equal(h.bridge.state().run.floor,98);assert.match(h.nodes.get('towerDialog').innerHTML,/繼續下降/);
  assert.ok(C.validateSave(h.bridge.state().run));
});

test('a completed dungeon also retains stay/return choices only after its stairs settle',()=>{
  let r=archive();for(let i=0;i<3;i++)r=D.interact(r,i).run;
  const h=runtime(r);h.context.towerStairReveal={revealing:true};h.api.reachExit();assert.equal(h.nodes.has('towerDialog'),false);
  h.context.towerStairReveal.revealing=false;h.api.reachExit();
  assert.match(h.nodes.get('towerDialog').innerHTML,/留在本層/);assert.match(h.nodes.get('towerDialog').innerHTML,/返回主塔並領獎/);
  const before=JSON.stringify(h.bridge.state().run);h.bridge.handleAction('close');assert.equal(JSON.stringify(h.bridge.state().run),before);
  assert.equal(h.api.exitUnlocked(),true);
});
