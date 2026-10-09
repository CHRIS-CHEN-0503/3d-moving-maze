import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {C,P,H,G,Co,fixture,add,ownSkill} from './tower-cooperation-fixtures.mjs';
const require=createRequire(import.meta.url),Atlas=require('../docs/story-atlas-rules.js');
const taunted=(run,id='hero')=>Object.entries(H.state(run).enemy).filter(([,s])=>s.tauntId===id&&s.tauntLeft>0).map(([key])=>key).sort();
const crowd=run=>P.monsterSpecs(run).map((m,i)=>({id:m.id,alive:true,x:0,z:1+i*.35,model:{position:{x:0,z:1+i*.35}}}));
const apply=(run,monsters,options={})=>H.applyTaunt(run,'hero',{monsters,origin:{x:0,z:0},clear:()=>true,seconds:3,...options});

test('lightweight legal IDs match full monster definitions across every floor and seed without retaining old floor IDs',()=>{
  const {run}=fixture('dawn_breach'),floors=[...Array.from({length:99},(_,i)=>99-i),...Array.from({length:50},(_,i)=>-1-i)];
  for(const floor of floors)for(const seed of [1,53,907]){
    run.floor=floor;run.seed=seed;run.defeatedMonsters=[];run.party.health={};run.party.reinforcements={version:1,shift:0,monsters:[]};
    const valid=new Set(P.monsterSpecs(run).map(m=>m.id));
    for(let i=0;i<14;i++){const id='monster-'+i,chosen=apply(run,[{id,alive:true,x:0,z:1}]);assert.equal(chosen.includes(id),valid.has(id),'floor '+floor+' seed '+seed+' '+id);}
  }
});
test('legal IDs follow in-place shift reinforcement changes, deaths and a separate saved run immediately',()=>{
  const {run}=fixture('dawn_breach'),id='monster-r-1-0',monster={id,alive:true,x:0,z:1};
  assert.deepEqual(apply(run,[monster]),[]);
  run.party.reinforcements.shift=1;run.party.reinforcements.monsters.push({id,kind:'clockmite',cx:1,cy:1});
  assert.deepEqual(apply(run,[monster]),[id]);run.defeatedMonsters.push(id);assert.deepEqual(apply(run,[monster]),[]);
  run.defeatedMonsters=[];assert.deepEqual(apply(run,[monster]),[id]);
  const independent=structuredClone(run);independent.party.reinforcements.monsters=[];assert.deepEqual(apply(independent,[monster]),[]);assert.deepEqual(apply(run,[monster]),[id]);
  run.party.reinforcements.monsters[0]={id:'monster-r-2-0',kind:'clockmite',cx:1,cy:1};run.party.reinforcements.shift=2;
  assert.deepEqual(apply(run,[monster]),[]);assert.deepEqual(apply(run,[{...monster,id:'monster-r-2-0'}]),['monster-r-2-0']);
});
test('entering any puzzle rift drops tower targets and leaving restores only the current tower roster',()=>{
  const {run}=fixture('dawn_breach');run.floor=90;run.defeatedMonsters=[];run.party.health={};const monsters=[{id:'monster-11',alive:true,x:0,z:1},{id:'monster-0',alive:true,x:0,z:2}];
  assert.deepEqual(apply(run,monsters),['monster-11']);
  for(const kind of ['bells','archive','lantern','threads']){run.expedition.active={id:'rift-'+kind,kind};assert.deepEqual(apply(run,monsters),[]);assert.deepEqual(taunted(run),[]);}
  run.expedition.active=null;assert.deepEqual(apply(run,monsters),['monster-11']);
  // On floor 89 the lord slot belongs to that floor's mini lord, so it is a real target; an ID that no
  // monster on this floor can have (monster-12 on the surface) is still never chosen, even when nearest.
  run.floor=89;assert.deepEqual(apply(run,monsters),['monster-11']);
  assert.deepEqual(apply(run,[{id:'monster-12',alive:true,x:0,z:.5},{id:'monster-0',alive:true,x:0,z:2}]),['monster-0']);
});
test('repeated aura refreshes never reconstruct full monster specs, even when ticks replace the run object',()=>{
  let {run}=fixture('dawn_breach');const monsters=crowd(run),sandbox={TowerCore:C,TowerRobotCore:require('../story/tower-robot-core.js'),TowerPartyCore:{...P,monsterSpecs(){throw Error('full monster reconstruction is forbidden in aura refresh');}},TowerFloorLords:require('../story/tower-floor-lords.js'),TowerHeroGrowth:G,TowerAscensionCatalog:require('../story/tower-ascension-catalog.js'),TowerGearTiers:require('../story/tower-gear-tiers.js')};
  vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../story/tower-heroes-core.js',import.meta.url),'utf8'),sandbox);
  for(let frame=0;frame<120;frame++){run=structuredClone(run);const ids=sandbox.TowerHeroes.applyTaunt(run,'hero',{monsters,origin:{x:0,z:0},clear:()=>true,seconds:.35,retain:true});assert.equal(ids.length,1);}
  const source=readFileSync(new URL('../story/tower-heroes-core.js',import.meta.url),'utf8'),prune=source.slice(source.indexOf('function pruneTaunts'),source.indexOf('function setBuff'));
  assert.equal((prune.match(/\.sort\(/g)||[]).length,1);assert.ok(prune.indexOf('.sort(')<prune.indexOf('for(const id of ids(run))'));
});

test('taunt skill ranks 1 through 6 have 1,1,2,2,3,3 target budgets',()=>{
  assert.deepEqual([1,2,3,4,5,6].map(H.tauntTargetLimit),[1,1,2,2,3,3]);
  assert.equal(H.tauntTargetLimit(99),3);assert.equal(H.tauntTargetLimit(0),1);assert.equal(H.tauntTargetLimit(NaN),1);
});
test('hero and companion use their own skill ranks, not player level or party level',()=>{
  for(const [level,count] of [[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[9,3],[10,3],[15,3]]){
    const {run}=fixture('dawn_breach'),ally=add(run,'swordsman','taunt');H.gainXp(run,G.XP[level-1]);
    const monsters=crowd(run).slice(0,6);assert.ok(monsters.length>=5);
    const chosen=apply(run,[...monsters].reverse());assert.equal(chosen.length,count,'hero '+level);
    const result=H.applyTaunt(run,ally,{monsters,origin:{x:0,z:0},clear:()=>true,seconds:4});
    assert.equal(result.length,H.tauntTargetLimit(G.skillLevel(run,ally)),'companion '+level);
    assert.ok(C.validateSave(run),'taunt fields remain compatible with saves');
  }
});
test('selection is nearest-first with deterministic tie breaks, never behind walls or on dead/unknown monsters',()=>{
  const {run}=fixture('dawn_breach');H.gainXp(run,G.XP[4]);const monsters=crowd(run);
  monsters[0].alive=false;run.defeatedMonsters.push(monsters[1].id);run.party.health[monsters[2].id]=0;
  monsters[3].model.position.x=20;const blocked=monsters[4].model.position;
  const chosen=apply(run,[{id:'intruder',alive:true,model:{position:{x:0,z:.1}}},...monsters],{clear:(a,b)=>b!==blocked});
  const expected=monsters.slice(5).filter(m=>m.model.position.z<=5).slice(0,3).map(m=>m.id);
  assert.deepEqual(chosen,expected);assert.deepEqual(taunted(run),expected.slice().sort());
  const {run:other}=fixture('dawn_breach'),ties=crowd(other).slice(0,3);for(const m of ties)m.model.position={x:0,z:1};
  assert.deepEqual(apply(other,ties.reverse()),[ties.map(m=>m.id).sort()[0]]);
});
test('recasting replaces prior ownership targets without clearing unrelated debuffs',()=>{
  const {run}=fixture('dawn_breach'),monsters=crowd(run);apply(run,monsters);
  H.state(run).enemy[monsters[0].id].slow=6;monsters[0].model.position.z=4;
  assert.deepEqual(apply(run,monsters),[monsters[1].id]);
  assert.equal(H.state(run).enemy[monsters[0].id].slow,6);assert.equal(H.state(run).enemy[monsters[0].id].tauntId,undefined);assert.equal(taunted(run).length,1);
});
test('moving aura retains valid targets and releases stale ones before replacing them, never accumulating',()=>{
  const {run}=fixture('dawn_breach'),monsters=crowd(run),options={retain:true,seconds:.35};
  apply(run,monsters,options);const initial=monsters[0].id;
  monsters[0].model.position.z=4.9;assert.deepEqual(apply(run,monsters.slice().reverse(),options),[initial]);
  for(let step=0;step<100;step++){
    const old=taunted(run)[0],m=monsters.find(m=>m.id===old);m.model.position.x=20;
    const next=monsters.find(m=>m.id!==old);next.model.position={x:0,z:1};
    const selected=apply(run,monsters,options);assert.equal(selected.length,1);assert.notEqual(selected[0],old);assert.equal(taunted(run).length,1);
  }
  assert.deepEqual(apply(run,monsters,{...options,clear:()=>false}),[]);assert.equal(taunted(run).length,0);
});
test('multiple fortresses do not steal each others held targets on every tick',()=>{
  const {run}=fixture('dawn_breach'),id=add(run,'smith','hammer_bash'),monsters=crowd(run),options={monsters,origin:{x:0,z:0},clear:()=>true,seconds:.35,retain:true};
  for(let n=0;n<30;n++){H.applyTaunt(run,'hero',options);H.applyTaunt(run,id,options);assert.deepEqual(taunted(run,'hero'),[monsters[0].id]);assert.deepEqual(taunted(run,id),[monsters[1].id]);}
});
test('old unlimited statuses are safely capped and dead owners, dead monsters and expiry clear only taunt',()=>{
  const {run}=fixture('dawn_breach'),monsters=crowd(run);for(const m of monsters)H.state(run).enemy[m.id]={tauntId:'hero',tauntLeft:3,slow:4};
  H.tick(run,.1);assert.equal(taunted(run).length,1);assert.ok(Object.values(H.state(run).enemy).every(s=>s.slow===3.9));
  H.setHp(run,'hero',0);H.tick(run,.1);assert.equal(taunted(run).length,0);
  H.setHp(run,'hero',1);apply(run,monsters);H.tick(run,3);assert.equal(taunted(run).length,0);assert.ok(Object.values(H.state(run).enemy).every(s=>s.tauntId===undefined));
});
test('cooperative dawn breach scales taunt only; attack remains one target with original cooldown and payment',()=>{
  for(const [level,count]of [[1,1],[3,2],[5,3],[10,3]]){
    const {run,space}=fixture('dawn_breach');H.gainXp(run,G.XP[level-1]);
    space.monsters=P.monsterSpecs(run).slice(0,6).map((m,i)=>({id:m.id,alive:true,x:i*.1,z:2.5}));
    const result=Co.cast(run,'dawn_breach',space);assert.ok(result.ok,result.message);
    assert.equal(result.effect.casts.find(c=>c.kind==='taunt').targets.length,count);assert.equal(result.effect.targets.length,1);
    assert.equal(result.run.bag.arrow,run.bag.arrow-1);assert.equal(H.actor(result.run,'hero').cooldowns.taunt,Co.DEFINITIONS.find(d=>d.id==='dawn_breach').cooldown);assert.equal(Co.DEFINITIONS.find(d=>d.id==='dawn_breach').cooldown,48*.5,'combos recover twice as fast too');assert.ok(C.validateSave(result.run));
  }
});
test('actual fortress runtime uses bounded stable selection and stops when its buff ends',()=>{
  const {run}=fixture('dawn_breach');H.gainXp(run,G.XP[4]);const monsters=crowd(run),positions=Object.fromEntries(H.ids(run).map(id=>[id,{x:0,z:0}]));
  for(const p of Object.values(G.state(run).policies))p.strategy='manual';
  H.setBuff(run,'hero','fortress',15,1);const sandbox={TowerHeroGrowth:G,TowerHeroes:H,TowerHeroIcons:{},document:{getElementById:()=>null}};
  vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../story/tower-growth-runtime.js',import.meta.url),'utf8'),sandbox);
  const ui=sandbox.TowerGrowthRuntime.create({run:()=>run,text:String,action(){},G:{running:true,shifting:false},paused:()=>false,pos:id=>positions[id],clear:()=>true,monsters:()=>monsters,actors:()=>[],cast(){},audio:{}});
  ui.tick(.1);assert.equal(taunted(run).length,3);const initial=taunted(run);
  monsters[0].model.position.z=4.9;ui.tick(.1);assert.deepEqual(taunted(run),initial);
  monsters[0].model.position.x=20;ui.tick(.1);assert.equal(taunted(run).length,3);assert.ok(!taunted(run).includes(monsters[0].id));
  H.tick(run,15);ui.tick(.1);assert.equal(taunted(run).length,0);
});
test('native runtime routes only taunt through the cap, preserving unrelated area spells',()=>{
  const source=readFileSync(new URL('../story/tower-heroes-runtime.js',import.meta.url),'utf8');
  assert.match(source,/e.kind==='taunt'[\s\S]*?H.applyTaunt/);assert.match(source,/\['frost','smoke'\]\.includes\(e.kind\)/);
  assert.doesNotMatch(source,/\['frost','taunt','smoke'\]\.includes\(e.kind\)/);
});
function runtimeHarness(skill){
  let run=skill==='taunt'?fixture('dawn_breach').run:H.enable(P.enable(C.newRun({seed:53}),H.SKILLS[skill].job).run).run;
  ownSkill(run,'hero',skill);let paused=false;const monsters=crowd(run).map(m=>({...m,windup:1})),trap={id:'taunt-test-trap',x:0,z:1,model:{visible:true}},g={running:true,shifting:false,px:0,pz:0},player={rotation:{y:0}},noop=()=>{};
  const sandbox={TowerHeroes:H,TowerHeroGrowth:G,TowerPartyCore:P,TowerHeroIcons:{svg:()=>''},document:{getElementById:()=>null},
    TowerSkillEffects:{create:()=>({emit:noop,tick:noop,reset:noop,cancel:noop,stats:()=>({groups:0})})},
    TowerGrowthRuntime:{create:()=>({hud:noop,tick:noop,reset:noop,wantsSkill:()=>false})},
    TowerCombatIntent:{create:()=>({engage:noop,tick:noop,reset:noop,target:()=>null})},
    MazeCharacterVoices:{create:()=>({say:noop,tick:noop,reset:noop})}};
  vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../story/tower-heroes-runtime.js',import.meta.url),'utf8'),sandbox);
  const runtime=sandbox.TowerHeroesRuntime.create({G:g,run:()=>run,core:C,world:()=>({}),player:()=>player,actors:()=>[],monsters:()=>monsters,hazards:()=>[trap],paused:()=>paused,text:String,action:()=>'',audio:{sfxAction:noop},toast:noop,save:noop,clear:()=>true,
    transact:result=>{if(!result.ok)return false;run=result.run;return true;}});
  runtime.tick(0);return {runtime,monsters,trap,g,run:()=>run,pause:v=>paused=v};
}
test('actual manual taunt runtime applies capped statuses and interrupts only its chosen targets',()=>{
  for(const [level,count] of [[1,1],[3,2],[5,3]]){const f=runtimeHarness('taunt');H.gainXp(f.run(),G.XP[level-1]);assert.equal(f.runtime.cast('taunt'),true);assert.equal(taunted(f.run()).length,count);assert.equal(f.monsters.filter(m=>m.windup===0).length,count);assert.ok(C.validateSave(f.run()));f.runtime.reset();}
});
test('disarm exposes ratio-only progress, freezes on pause, and clears on completion or interruption',()=>{
  const f=runtimeHarness('disarm');assert.equal(f.runtime.workProgress(),null);assert.equal(f.runtime.cast('disarm'),true);assert.deepEqual(JSON.parse(JSON.stringify(f.runtime.workProgress())),{label:'拆解陷阱',ratio:0});
  f.runtime.tick(1);const progress=f.runtime.workProgress();assert.ok(progress.ratio>0&&progress.ratio<1);assert.deepEqual(Object.keys(progress).sort(),['label','ratio']);f.pause(true);f.runtime.tick(5);assert.equal(f.runtime.workProgress().ratio,progress.ratio);f.pause(false);f.runtime.tick(4);assert.equal(f.runtime.workProgress(),null);assert.equal(f.trap.heroRemoved,true);
  for(const cancel of [f=>f.g.px=1,f=>H.actor(f.run()).hurt=1,f=>f.g.shifting=true]){const interrupted=runtimeHarness('disarm');interrupted.runtime.cast('disarm');interrupted.runtime.tick(.3);cancel(interrupted);interrupted.runtime.tick(.1);assert.equal(interrupted.runtime.workProgress(),null);assert.equal(interrupted.trap.heroRemoved,undefined);interrupted.runtime.reset();}
  const source=readFileSync(new URL('../story/tower-heroes-runtime.js',import.meta.url),'utf8');assert.match(source,/prep===channel\?'拆解中':'準備 '/);
});
test('game descriptions and shared atlas expose all six capped ranks for both taunts',()=>{
  for(const id of ['taunt','moving_fortress']){assert.match(H.SKILLS[id].description,/一～二級一隻、三～四級兩隻、五～六級三隻/);const entry=Atlas.skill(id);assert.match(entry.details.find(v=>v.label==='挑釁數量上限').value,/1／1／2／2／3／3/);}
  assert.match(Co.DEFINITIONS.find(s=>s.id==='dawn_breach').description,/五～六級三隻/);
  assert.equal(H.SKILLS.taunt.cooldown,22*H.COOLDOWN_SCALE);assert.deepEqual(H.SKILLS.taunt.power,[3,4,5,6,7,8]);assert.equal(H.SKILLS.moving_fortress.cooldown,90*H.COOLDOWN_SCALE);
});
