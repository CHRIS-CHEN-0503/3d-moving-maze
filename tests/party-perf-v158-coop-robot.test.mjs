import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
// PARTY_PERF_STORY points the same checks at another copy of story/ (for before/after comparison).
const STORY=process.env.PARTY_PERF_STORY||fileURLToPath(new URL('../story/',import.meta.url));
const require=createRequire(import.meta.url),mod=name=>require(path.join(STORY,name)),source=name=>readFileSync(path.join(STORY,name),'utf8');
const C=mod('story-core.js'),P=mod('tower-party-core.js'),H=mod('tower-heroes-core.js'),G=mod('tower-hero-growth.js'),F=mod('tower-affixes.js'),N=mod('tower-narrative.js'),D=mod('tower-dungeons.js'),L=mod('tower-floor-lords.js'),R=H.ROBOT;
const REPORT=!!process.env.PARTY_PERF_REPORT,say=(label,value)=>{if(REPORT)console.log('[perf] '+label+' = '+value);};
const provision=run=>{for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=30;run.party.journey.scrap=30;for(const key of Object.keys(run.party.journey.materials))run.party.journey.materials[key]=30;run.bag.ration=30;run.bag.arrow=30;return run;};

// The cooperation core is loaded as a browser script so that monsterSpecs() can be counted.
function loadCooperation(counts){
  const asked={...P,monsterSpecs:(...args)=>{counts.monsterSpecs=(counts.monsterSpecs||0)+1;return P.monsterSpecs(...args);}};
  const context=vm.createContext({TowerHeroes:H,TowerCore:C,TowerHeroGrowth:G,TowerPartyCore:asked,TowerAffixes:F});vm.runInContext(source('tower-cooperation-core.js'),context);return context.TowerCooperation;
}
function ownSkill(run,id,key){const a=H.actor(run,id),job=H.job(run,id);let draw;for(let seed=1;seed<10000;seed++){draw=H.draft(seed,job,job);if(draw.skills.includes(key))break;}assert.ok(draw.skills.includes(key));a.skills=[...draw.skills];a.passives=Object.values(H.PASSIVES).filter(p=>p.job===job&&!p.unique&&!['ingredient_care','care','recovery'].includes(p.id)).slice(0,2).map(p=>p.id);a.cooldowns=Object.fromEntries(a.skills.map(k=>[k,0]));a.learned=null;G.record(run,id).choices=[];}
function add(run,job,key,id='ally-'+job){const m={id,profession:job,sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(m);run.party.joined.push(id);H.addMember(run,m);ownSkill(run,id,key);return id;}
function coopFixture(Co,key,monsterCount=1){
  const def=Co.DEFINITIONS.find(d=>d.id===key);let run=H.enable(P.enable(C.newRun({seed:53,name:'合作效能'}),def.participants[0].job).run).run;
  if(def.underground){run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);run.chronicle.ending='release';run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);P.advance(run,{reward:false});const v=C.startUnderworld(run);assert.ok(v.ok,v.message);run=v.run;}
  ownSkill(run,'hero',def.participants[0].skill);const ids=['hero',...def.participants.slice(1).map(p=>add(run,p.job,p.skill))];
  for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=20;run.bag.arrow=50;run.party.journey.scrap=20;
  const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:i*.8,z:0}])),specs=P.monsterSpecs(run),monsters=specs.slice(0,monsterCount).map((spec,i)=>({id:spec.id,alive:true,x:i*.3,z:2.5+i*.2}));
  if(def.formation.kind==='front'){for(const id of ids)positions[id]={x:0,z:0};positions[ids[def.formation.front]]={x:0,z:1.2};}
  if(def.formation.kind==='pincer'){positions[ids[0]]={x:-1,z:1};positions[ids[1]]={x:1,z:1};monsters[0]={...monsters[0],x:0,z:1};}
  if(def.effect.injured)for(const id of ids)H.setHp(run,id,Math.max(1,H.maxHp(run,id)-20));
  if(def.effect.mechanicalHealPercent){const id=ids[def.effect.targetMember];H.setHp(run,id,Math.max(1,H.maxHp(run,id)-30));H.equipment(run,id).armor.durability-=10;}
  return {run,ids,def,space:{ready:true,positions,monsters,clear:()=>true,blocked:[]}};
}

// A full roster with every skill the eleven combinations need, so that most definitions pass the cheap checks.
function wideFixture(Co,monsterCount=6){
  const f=coopFixture(Co,'dawn_breach',monsterCount),run=f.run,skills={hero:['wind_slash','taunt','guard_stance'],[f.ids[1]]:['thunder_wave','thorn_growth','barrier'],[f.ids[2]]:['piercing_arrow','woodland_stride']};
  for(const [job,keys]of [['smith',['weak_pin','reinforce','repair']],['healer',['herbal_heal','blessing']],['chef',['warm_soup']],['scout',['throw_blade','smoke']],['robot',['flying_fist','folded_guard','parts_restore']]]){const id=add(run,job,keys[0],'wide-'+job);skills[id]=keys;f.ids.push(id);}
  for(const [id,keys]of Object.entries(skills)){const a=H.actor(run,id);a.skills=[...keys];a.cooldowns=Object.fromEntries(keys.map(k=>[k,0]));}
  f.ids.forEach((id,i)=>{f.space.positions[id]={x:i*.45,z:0};H.setHp(run,id,Math.max(1,H.maxHp(run,id)-15));});return f;
}

// ---------------------------------------------------------------- 4. cooperation scans
test('available() offers exactly what evaluate() accepts, for all eleven definitions',()=>{
  const counts={},Co=loadCooperation(counts);
  for(const def of Co.DEFINITIONS){
    const f=coopFixture(Co,def.id),single=Co.evaluate(f.run,def.id,f.space),offers=Co.available(f.run,f.space);
    assert.ok(single.ok,def.id+': '+single.message);const offered=offers.find(o=>o.definition.id===def.id);assert.ok(offered,def.id+' is offered');
    assert.deepEqual(JSON.parse(JSON.stringify(offered)),JSON.parse(JSON.stringify(single)),def.id+': the shared scan must give the same plan');
    for(const other of offers)assert.deepEqual(JSON.parse(JSON.stringify(other)),JSON.parse(JSON.stringify(Co.evaluate(f.run,other.definition.id,f.space))));
  }
});
test('hints() agrees with evaluate() when the party is out of formation',()=>{
  const counts={},Co=loadCooperation(counts);
  for(const key of ['thunder_blades','cross_hunt','warm_radiance','steel_oath']){
    const f=coopFixture(Co,key);f.ids.forEach((id,i)=>{f.space.positions[id]={x:i*9,z:0};});
    const near=Co.evaluate(f.run,key,f.space);assert.equal(near.ok,false,key+' needs regrouping');
    const hint=Co.hints(f.run,f.space).find(h=>h.definition.id===key);assert.ok(hint,key+' suggests gathering');assert.equal(hint.message,near.message);assert.deepEqual([...hint.members].sort(),[...f.ids].sort());
  }
});
for(const label of ['available','hints'])test('one '+label+'() scan computes the monster id set once and never asks the same two points about their line twice',()=>{
  const counts={},Co=loadCooperation(counts),f=wideFixture(Co),seen=new Map();let rays=0,repeats=0;
  f.space.clear=(a,b)=>{rays++;const row=seen.get(a)||seen.set(a,new Map()).get(a);if(row.has(b))repeats++;row.set(b,true);return true;};
  // Spread the party so that hints() has to look at every definition rather than stop at an offer.
  if(label==='hints')f.ids.forEach((id,i)=>{f.space.positions[id]={x:i*9,z:0};});
  counts.monsterSpecs=0;const result=label==='hints'?Co.hints(f.run,f.space):Co.available(f.run,f.space);
  say(label+' ('+result.length+' results, 9 members, 6 monsters): monsterSpecs() calls / line-of-sight tests / repeated tests',counts.monsterSpecs+' / '+rays+' / '+repeats);
  assert.ok(result.length>=3,label+' found several combinations to compare');assert.ok(counts.monsterSpecs<=1,label+' rebuilt the monster list '+counts.monsterSpecs+' times');assert.equal(repeats,0,label+' asked an identical line-of-sight question twice');
});
test('a cooperation scan sees a changed world on the next call: nothing is cached between calls',()=>{
  const counts={},Co=loadCooperation(counts),f=coopFixture(Co,'thunder_blades');assert.ok(Co.evaluate(f.run,'thunder_blades',f.space).ok);
  f.space.clear=()=>false;assert.equal(Co.evaluate(f.run,'thunder_blades',f.space).ok,false);assert.equal(Co.available(f.run,f.space).length,0);
  f.space.clear=()=>true;assert.ok(Co.available(f.run,f.space).length>=1);f.space.monsters[0].alive=false;assert.equal(Co.evaluate(f.run,'thunder_blades',f.space).ok,false);
});

// Real runtime: a preparing combination is re-validated every frame; that must build the world snapshot once per frame.
function runtimeHarness(){
  const counts={},Co=loadCooperation(counts),f=coopFixture(Co,'thunder_blades',3);let run=f.run;const nodes={},calls={monsters:0};
  const element=()=>({hidden:false,innerHTML:'',listeners:{},writes:0,addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(){},appendChild(el){nodes[el.id]=el;}});nodes.gameScreen=element();
  const world=f.space.monsters.map(m=>({...m,model:{position:{x:m.x,z:m.z},rotation:{y:0}}}));
  const sandbox={TowerHeroes:H,TowerCooperation:Co,TowerHeroIcons:mod('tower-heroes-icons.js'),document:{createElement:element,getElementById:id=>nodes[id]}};vm.createContext(sandbox);vm.runInContext(source('tower-cooperation-runtime.js'),sandbox);
  const ui=sandbox.TowerCooperationRuntime.create({run:()=>run,ready:()=>true,pos:id=>f.space.positions[id],clear:()=>true,visible:()=>true,busy:()=>false,monsters:()=>{calls.monsters++;return world;},text:String,toast(){},motion(){},glow:()=>0,sound:()=>()=>{},cancelGlow(){},cancelMotion(){},cancelTarget(){},clearSlow(){},save(){},
    transact:result=>{if(!result.ok)return false;run=result.run;return true;},hit:(m,id,skill)=>{const result=H.strike(run,m.id,{memberId:id,skillId:skill},run.revision);if(result.ok)run=result.run;return result;}});
  ui.install();return {ui,nodes,counts,calls,get run(){return run;}};
}
test('while a combination charges, each frame builds one world snapshot, and the bar still counts down',()=>{
  const h=runtimeHarness();h.ui.hud();assert.equal(h.nodes.heroCooperationBar.hidden,false);assert.equal(h.ui.start('thunder_blades'),true);
  const before=h.nodes.heroCooperationBar.innerHTML;let frames=0,worst=0,specs=0;
  while(h.ui.preparing('hero')&&frames<20){const monsters=h.calls.monsters,made=h.counts.monsterSpecs||0;h.ui.tick(.05);frames++;
    // The frame that releases the combination also applies its hits, so it is not a steady-state frame.
    if(h.ui.preparing('hero')){worst=Math.max(worst,h.calls.monsters-monsters);specs=Math.max(specs,(h.counts.monsterSpecs||0)-made);}}
  say('charging, worst steady frame: monsters() calls / monsterSpecs() calls',worst+' / '+specs);
  assert.ok(frames>=2);assert.ok(worst<=1,'a charging frame built the world snapshot '+worst+' times');assert.ok(specs<=1,'a charging frame rebuilt the monster list '+specs+' times');
  assert.equal(h.ui.preparing('hero'),null,'the combination released');assert.notEqual(h.nodes.heroCooperationBar.innerHTML,before);
});
test('an idle cooperation bar builds one snapshot and one monster list per refresh',()=>{
  const h=runtimeHarness();h.ui.hud();h.calls.monsters=0;h.counts.monsterSpecs=0;for(let i=0;i<10;i++)h.ui.tick(.2);
  say('idle refresh: monsters() / monsterSpecs() calls per 0.2 s',(h.calls.monsters/10).toFixed(2)+' / '+(h.counts.monsterSpecs/10).toFixed(2));
  assert.ok(h.calls.monsters<=10,'monsters() ran '+h.calls.monsters+' times');assert.ok(h.counts.monsterSpecs<=10*2,'monsterSpecs() ran '+h.counts.monsterSpecs+' times');
});

// ---------------------------------------------------------------- 8. underground robot bag limit
function underground(run){
  run.floor=1;run.floorsCleared=98;run.chronicle=N.newChronicle(1);run.expedition=D.newExpedition();run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};P.advance(run,{reward:false});
  run.chronicle.ending='keeper';run.chronicle.clues.push(N.chapterForFloor(1).clueId);run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push(L.spec(run).id);
  const end=C.descend(run);assert.ok(end.ok,end.message);const next=C.startUnderworld(end.run);assert.ok(next.ok,next.message);return next.run;
}
const robotRun=()=>provision(underground(provision(H.enable(P.enable(C.newRun({seed:123,name:'背包上限'}),'robot').run).run)));
const filler=(run,count,tag='fill')=>Array.from({length:count},(_,i)=>C.createGear('longsword',1,run.seed,tag+i));
test('underground robot operations that store an item stop at 24 slots, like ordinary equipment',()=>{
  const run=robotRun();assert.ok(C.isUnderworld(run),'underground fixture');
  // Crafting a core adds one item: allowed up to 24, refused beyond.
  run.gearBag=filler(run,23);let quote=R.craftCoreQuote(run,'hero',1,{safe:true});assert.equal(quote.allowed,true,'23 items: one more fits');
  const crafted=R.craftCore(run,'hero',1,{safe:true},run.revision);assert.ok(crafted.ok,crafted.message);assert.equal(crafted.run.gearBag.length,24);
  quote=R.craftCoreQuote(crafted.run,'hero',1,{safe:true});say('craft with 24 items: allowed',quote.allowed);assert.equal(quote.allowed,false,'24 items: the bag is full');assert.equal(quote.reason,'裝備背包已滿。');
  const full=R.craftCore(crafted.run,'hero',1,{safe:true},crafted.run.revision);assert.equal(full.ok,false);
  // Taking a core off also stores an item.
  const worn=structuredClone(crafted.run);worn.gearBag=filler(worn,24,'worn');const refused=R.unequipCore(worn,'hero','core1',worn.revision);say('unequip with 24 items: ok',refused.ok);assert.equal(refused.ok,false,'no room to store the removed core');assert.equal(refused.message,'裝備背包已滿。');
  const room=structuredClone(worn);room.gearBag=filler(room,23,'room');const removed=R.unequipCore(room,'hero','core1',room.revision);assert.ok(removed.ok,removed.message);assert.equal(removed.run.gearBag.length,24);
});
test('swapping a core is refused only when the bag would end above 24, and never invents room',()=>{
  const run=robotRun();H.gainXp(run,G.XP[4]);const spare=C.createGear('robot_core_t3',99,run.seed,'spare');
  // Equipping a bag core over an installed one returns the old core: net zero, so a full 24-item bag still works.
  run.gearBag=[spare,...filler(run,23)];const swap=R.equipCore(run,'hero',spare.id,'core1');assert.ok(swap.ok,'swap in a full bag: '+swap.message);assert.equal(swap.run.gearBag.length,24);
  // A temporarily overfull underground bag (validation tolerates up to 28) must be tidied before anything new is stored.
  const over=structuredClone(run);over.gearBag=[spare,...filler(over,25)];assert.equal(over.gearBag.length,26);assert.ok(C.validateSave(JSON.stringify(over)),'28 is still a valid saved state');
  const blocked=R.equipCore(over,'hero',spare.id,'core1');say('swap with 26 items: ok',blocked.ok);assert.equal(blocked.ok,false,'a 26-item bag cannot take the returned core');assert.equal(blocked.message,'背包空間不足，無法放回原核心。');
  assert.equal(R.craftCore(over,'hero',1,{safe:true},over.revision).ok,false);assert.equal(R.unequipCore(over,'hero','core1',over.revision).ok,false);
  const tidy=structuredClone(over);tidy.gearBag=tidy.gearBag.slice(0,23);assert.ok(R.craftCore(tidy,'hero',1,{safe:true},tidy.revision).ok,'once tidied to 23 there is room again');
});
test('surface runs keep the same 24-slot limit',()=>{
  const run=provision(H.enable(P.enable(C.newRun({seed:124,name:'地上背包'}),'robot').run).run);run.gearBag=filler(run,24);
  assert.equal(R.craftCoreQuote(run,'hero',1,{safe:true}).allowed,false);assert.equal(R.unequipCore(run,'hero','core1',run.revision).ok,false);
});
test('the party management bag header shows the 24 limit underground, matching ordinary equipment',()=>{
  const sandbox=vm.createContext({TowerHeroes:H,TowerPartyCore:P,TowerHeroGrowth:G,TowerHeroIcons:{svg:()=>''},TowerCombatMotion:mod('tower-combat-motion.js'),TowerCombatIntent:mod('tower-combat-intent.js'),MazeCharacterVoices:require('../assets/character-voices.js'),CombatAudio:require('../assets/combat-audio.js'),document:{getElementById:()=>null},Math,
    TowerGrowthRuntime:{create:()=>({hud(){},tick(){},reset(){},install(){},wantsSkill:()=>false,progression(){},handle:()=>false})}});
  vm.runInContext(source('tower-skill-effects.js'),sandbox);vm.runInContext(source('tower-heroes-runtime.js'),sandbox);
  const run=robotRun();run.gearBag=filler(run,26,'tidy');let dialog=null;const T=require('../lib/three.min.js');
  const ui=sandbox.TowerHeroesRuntime.create({THREE:T,G:{running:true,shifting:false,px:0,pz:0},run:()=>run,core:C,text:String,action:(label,key,id)=>'['+label+']',portrait:()=>'',world:()=>new T.Group(),player:()=>new T.Group(),actors:()=>[],monsters:()=>[],hazards:()=>[],paused:()=>false,audio:{},toast(){},save(){},dispose(){},clear:()=>true,walkClear:()=>true,cell:(x,y)=>({x,z:y}),worldToCell:(x,z)=>({x,y:z}),dialog:(...args)=>{dialog=args;},transact:()=>true,hit(){}});
  ui.handle('hero-tab','bag');assert.match(dialog[3],/裝備背包 26／24/,'a temporary overflow is visible as more than the 24 limit');
  assert.doesNotMatch(dialog[3],/／28/);
});

test('benchmark: one hundred cooperation scans of a full roster',{skip:!REPORT},()=>{
  const Co=loadCooperation({}),f=wideFixture(Co);const rounds=[];for(let i=0;i<5;i++){const start=process.hrtime.bigint();for(let k=0;k<100;k++){const offers=Co.available(f.run,f.space);if(!offers.length)Co.hints(f.run,f.space);}rounds.push(Number(process.hrtime.bigint()-start)/1e6);}
  rounds.sort((a,b)=>a-b);say('100 available()+hints() scans, 9 members, 6 monsters',rounds[2].toFixed(2)+' ms (median of 5)');
  f.ids.forEach((id,i)=>{f.space.positions[id]={x:i*9,z:0};});const spread=[];for(let i=0;i<5;i++){const start=process.hrtime.bigint();for(let k=0;k<100;k++){if(!Co.available(f.run,f.space).length)Co.hints(f.run,f.space);}spread.push(Number(process.hrtime.bigint()-start)/1e6);}
  spread.sort((a,b)=>a-b);say('100 scans while out of formation (offers none, so hints() runs too)',spread[2].toFixed(2)+' ms (median of 5)');
});
