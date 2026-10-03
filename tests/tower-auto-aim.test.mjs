import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),N=require('../story/tower-narrative.js'),R=require('../story/tower-hero-growth.js'),T=require('../lib/three.min.js');
function fixture(skill='arcane_bolt'){
  const job=H.SKILLS[skill].job;let seed=1;while(!H.draft(seed,job,'hero').skills.includes(skill))seed++;
  let run=H.enable(P.enable(C.newRun({seed}),job).run).run;run.floor=84;run.floorsCleared=15;run.chronicle=N.newChronicle(84);P.advance(run);
  const world=new T.Group(),player=new T.Group(),actors=[],monsters=P.monsterSpecs(run).map((m,i)=>({...m,alive:true,model:new T.Group()})),blocked=new Set(),hidden=new Set(),hits=[],sounds=[];
  assert.ok(monsters.length>=3);monsters.forEach((m,i)=>m.model.position.set(0,0,25+i));
  let on=false,paused=false,accepted=true;
  const env=vm.createContext({MazeCharacterVoices:require('../assets/character-voices.js'),TowerCombatIntent:require('../story/tower-combat-intent.js'),TowerHeroes:H,TowerHeroGrowth:R,TowerPartyCore:P,TowerHeroIcons:{svg:()=>''},TowerCombatMotion:require('../story/tower-combat-motion.js'),MazeSight:{active:()=>true,visible:(x,z)=>!monsters.some(m=>hidden.has(m.id)&&m.model.position.x===x&&m.model.position.z===z)},document:{getElementById:()=>null},Math});
  for(const file of ['tower-skill-effects','tower-growth-runtime','tower-heroes-runtime'])vm.runInContext(readFileSync(new URL('../story/'+file+'.js',import.meta.url),'utf8'),env);
  const G={running:true,shifting:false,px:0,pz:0,heading:0,tpYaw:.7},ctx={THREE:T,G,run:()=>run,core:C,world:()=>world,player:()=>player,actors:()=>actors,monsters:()=>monsters,hazards:()=>[],paused:()=>paused,autoAim:()=>on,text:s=>s,action:()=>'',portrait:()=>'',audio:{sfxAction(k){sounds.push(k);}},toast(){},save(){},dispose(){},clear:(x,z,nx,nz)=>!monsters.some(m=>blocked.has(m.id)&&m.model.position.x===nx&&m.model.position.z===nz),walkClear:()=>true,cell:(x,y)=>({x,z:y}),worldToCell:(x,z)=>({x:Math.floor(x),y:Math.floor(z)}),
    transact(res){if(!accepted||!res.ok)return false;run=res.run;return true;},hit(m,id,skillId,shot){const result=H.strike(run,m.id,{memberId:id,skillId,shot});if(result.ok){run=result.run;hits.push({id:m.id,skillId,shot});if(result.effect.dead)m.alive=false;}return result;}};
  const ui=env.TowerHeroesRuntime.create(ctx);ui.tick(0);
  return {ui,ctx,G,player,actors,monsters,world,blocked,hidden,hits,sounds,run:()=>run,toggle:v=>on=v,pause:v=>paused=v,accept:v=>accepted=v};
}
function position(f,i,x,z){f.monsters[i].model.position.set(x,0,z);return f.monsters[i];}

test('auto aim defaults off, opt-in selects nearest reachable visible enemy, and never moves camera or actor',()=>{
  const f=fixture(),behind=position(f,0,0,-2),front=position(f,1,0,3),blocked=position(f,2,.1,.1);f.blocked.add(blocked.id);
  const before={p:f.player.position.clone(),px:f.G.px,pz:f.G.pz,tpYaw:f.G.tpYaw};
  assert.equal(f.ui.aimTarget(8),null);assert.equal(f.G.heading,0);f.toggle(true);
  assert.equal(f.ui.aimTarget(8).id,behind.id);assert.equal(Math.abs(f.player.rotation.y),Math.PI);assert.equal(f.G.heading,f.player.rotation.y);
  f.hidden.add(behind.id);assert.equal(f.ui.aimTarget(8).id,front.id);assert.equal(f.G.heading,0);
  assert.ok(f.player.position.equals(before.p));for(const k of ['px','pz','tpYaw'])assert.equal(f.G[k],before[k]);
});
test('no target is selected out of range, through walls, outside live visibility, dead or at zero HP',()=>{
  const f=fixture();f.toggle(true);const m=position(f,0,1,0);
  for(const invalid of ['wall','hidden','dead','hp','defeated','range']){
    m.alive=true;f.blocked.clear();f.hidden.clear();delete f.run().party.health[m.id];f.run().defeatedMonsters=[];
    if(invalid==='wall')f.blocked.add(m.id);if(invalid==='hidden')f.hidden.add(m.id);if(invalid==='dead')m.alive=false;if(invalid==='hp')f.run().party.health[m.id]=0;if(invalid==='defeated')f.run().defeatedMonsters.push(m.id);
    f.G.heading=f.player.rotation.y=.4;assert.equal(f.ui.aimTarget(invalid==='range'?.5:8),null,invalid);assert.equal(f.G.heading,.4);
  }
});
test('valid manual offensive skill turns and hits behind; disabling aim preserves manual facing',()=>{
  for(const enabled of [false,true]){
    const f=fixture();f.toggle(enabled);const m=position(f,0,0,-3),dur=f.run().equipment.weapon.durability;
    assert.ok(f.ui.cast('arcane_bolt'));f.ui.tick(.3);
    assert.equal(f.hits.length,enabled?1:0);if(enabled)assert.equal(f.hits[0].id,m.id);
    assert.equal(f.G.heading,enabled?Math.PI:0);assert.equal(f.run().equipment.weapon.durability,dur-1);
  }
});
test('auto-aim does not let a nearer hidden enemy steal the aimed single-target skill',()=>{
  const f=fixture();f.toggle(true);const hidden=position(f,0,0,-1),target=position(f,1,0,-3);f.hidden.add(hidden.id);
  f.ui.cast('arcane_bolt');f.ui.tick(.3);assert.equal(f.hits.length,1);assert.equal(f.hits[0].id,target.id);
});
test('invalid cooldown, paused state or shifting never turn or spend additional resources',()=>{
  const f=fixture();f.toggle(true);position(f,0,0,-3);H.actor(f.run()).cooldowns.arcane_bolt=4;
  const dur=f.run().equipment.weapon.durability;f.ui.cast('arcane_bolt');assert.equal(f.G.heading,0);assert.equal(f.run().equipment.weapon.durability,dur);
  H.actor(f.run()).cooldowns.arcane_bolt=0;f.pause(true);f.ui.cast('arcane_bolt');assert.equal(f.ui.aimTarget(8),null);assert.equal(f.G.heading,0);
  f.pause(false);f.G.shifting=true;assert.equal(f.ui.aimTarget(8),null);f.ui.cast('arcane_bolt');assert.equal(f.G.heading,0);
});
test('prepared ground spell keeps its original telegraphed point, pays only at release, and checks walls again',()=>{
  for(const wallAfterCharge of [false,true]){
    const f=fixture('starfall');f.toggle(true);const m=position(f,0,-3,0),other=position(f,1,0,7),dur=f.run().equipment.weapon.durability;
    assert.ok(f.ui.cast('starfall'));assert.ok(f.ui.preparing());assert.equal(f.run().equipment.weapon.durability,dur);
    assert.ok(Math.abs(f.G.heading+Math.PI/2)<1e-9);
    const at={...f.ui.preparing().at};assert.equal(at.x,-3);assert.equal(at.z,0);
    other.model.position.set(0,0,1);if(wallAfterCharge)f.blocked.add(m.id);
    f.ui.tick(H.preparationSeconds('starfall')+.01);
    assert.equal(f.ui.preparing(),null);assert.equal(f.run().equipment.weapon.durability,dur-1);
    assert.equal(f.hits.length,wallAfterCharge?0:1);if(!wallAfterCharge)assert.equal(f.hits[0].id,m.id);
    assert.ok(Math.abs(f.G.heading+Math.PI/2)<1e-9,'does not chase new closer enemy during preparation');
  }
});
test('friend-target skills never turn toward enemies and continue using selected ally logic',()=>{
  const f=fixture('herbal_heal');f.toggle(true);position(f,0,0,-2);H.setHp(f.run(),'hero',20);
  assert.ok(f.ui.cast('herbal_heal','hero'));assert.equal(f.G.heading,0);assert.equal(f.player.rotation.y,0);assert.equal(f.hits.length,0);assert.ok(f.run().hp>20);
});
test('prepared ground spell does not lock a hidden monster after auto-aim selected a visible one',()=>{
  const f=fixture('starfall');f.toggle(true);position(f,0,-4,0);const hidden=position(f,1,-1,0);f.hidden.add(hidden.id);
  assert.ok(f.ui.cast('starfall'));assert.equal(f.ui.preparing().at.x,-4);assert.equal(f.ui.preparing().at.z,0);
});
test('short-range offensive control turns only toward targets inside the unchanged skill radius',()=>{
  for(const skill of ['taunt','frost_field','smoke']){
    const f=fixture(skill);f.toggle(true);position(f,0,0,-4.5);assert.ok(f.ui.cast(skill));assert.equal(Math.abs(f.G.heading),Math.PI);
    const outside=fixture(skill);outside.toggle(true);position(outside,0,0,-5.1);assert.ok(outside.ui.cast(skill));assert.equal(outside.G.heading,0);
  }
});
test('AI companion skill does not change player heading or borrow controlled auto aim',()=>{
  const f=fixture();f.toggle(true);f.run().coins=99;f.run().floor=97;f.run().floorsCleared=2;f.run().chronicle=N.newChronicle(97);P.advance(f.run());
  const offer=P.recruitOffer(f.run()),recruited=P.recruit(f.run(),offer.id);assert.ok(recruited.ok);assert.ok(f.ctx.transact(recruited));
  const id=offer.id,a=H.actor(f.run(),id);a.skills=['arcane_bolt','barrier','frost_field'];a.cooldowns={arcane_bolt:0,barrier:0,frost_field:0};
  const model=new T.Group();model.position.set(1,0,0);model.rotation.y=0;f.actors.push({id,model});position(f,0,0,-3);
  assert.equal(f.ui.aimTarget(8,id),null);assert.ok(C.validateSave(f.run()));assert.ok(f.ui.cast('arcane_bolt',undefined,id));
  assert.equal(f.G.heading,0);assert.equal(f.player.rotation.y,0);assert.equal(model.rotation.y,0);assert.equal(f.hits.length,0);
});
