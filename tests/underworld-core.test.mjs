import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {provisionTravellers} from './recruit-fixtures.mjs';
const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),B=require('../story/tower-floor-lords.js'),L=require('../story/tower-loot.js'),R=require('../story/tower-reinforcements.js');
const clone=structuredClone;
const M=require('../story/tower-materials.js');
function fresh(seed=31){return provisionTravellers(H.enable(P.enable(C.newRun({seed,name:'地下旅人'}),'mage','female').run).run);}
function move(run,floor){run.floor=floor;run.floorsCleared=floor>0?99-floor:99+(-floor-1);run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=C.newAdventure();run.expedition=D.newExpedition();if(floor>0)run.chronicle=N.newChronicle(floor);P.advance(run,{reward:false});return run;}
function clearGate(run){const chapter=N.chapterForFloor(run.floor);if(run.floor<=chapter.mid&&!run.chronicle.clues.includes(chapter.clueId))run.chronicle.clues.push(chapter.clueId);if(run.party?.boss){run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);}const lord=B.spec(run);if(lord&&!run.defeatedMonsters.includes(lord.id))run.defeatedMonsters.push(lord.id);}
function surfaceWinner(seed=31,count=3){let run=fresh(seed);H.gainXp(run,2000);run.coins=1000;for(const floor of [99,97,95].slice(0,count)){move(run,floor);const result=P.recruit(run,P.recruitOffer(run).id);assert.ok(result.ok,result.message);run=result.run;}move(run,1);clearGate(run);run.chronicle.ending='keeper';H.setHp(run,'hero',17);run.party.members.forEach((m,i)=>H.setHp(run,m.id,9+i));const result=C.descend(run);assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run));return result.run;}
function underground(seed=31,count=3){const result=C.startUnderworld(surfaceWinner(seed,count));assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run));return result.run;}

test('underground entry requires a completed surface ending and matching revision, never floor zero',()=>{
  assert.equal(C.startUnderworld(fresh()).ok,false);
  const won=surfaceWinner(),before=clone(won);
  assert.equal(C.startUnderworld(won,won.revision-1).ok,false);
  assert.deepEqual(won,before);
  const entered=C.startUnderworld(won,won.revision);assert.ok(entered.ok,entered.message);
  assert.equal(entered.run.floor,-1);assert.equal(entered.run.status,'playing');assert.equal(entered.run.floorsCleared,99);assert.equal(entered.run.revision,won.revision+1);
  assert.equal(C.startUnderworld(entered.run).ok,false);
  for(const f of [0,-51,100,-1.5,NaN,'-1'])assert.throws(()=>C.floorConfig(f),RangeError);
});

test('farewell is seeded, order independent, recorded once and never selects the hero',()=>{
  const won=surfaceWinner(),saved=JSON.stringify(won),one=C.startUnderworld(won),two=C.startUnderworld(JSON.parse(saved));
  const reversed=clone(won);reversed.party.members.reverse();const three=C.startUnderworld(reversed);
  assert.ok(one.ok&&two.ok&&three.ok);assert.deepEqual(one.run.underworld,two.run.underworld);assert.deepEqual(one.run.underworld,three.run.underworld);
  const d=one.run.underworld.departed;assert.notEqual(d.id,'hero');assert.ok(won.party.members.some(m=>m.id===d.id));assert.ok(!one.run.party.members.some(m=>m.id===d.id));assert.equal(d.name,P.person(d.profession,d.sex));
  assert.equal(one.run.underworld.surfaceEnding,'keeper');assert.deepEqual(one.run.chronicle,won.chronicle);assert.equal(JSON.stringify(won),saved);
  assert.deepEqual(C.validateSave(JSON.stringify(one.run)),one.run);
  assert.equal(underground(31,0).underworld.departed,null);
  const identities=new Set();for(let seed=1;seed<=12;seed++)identities.add(underground(seed).underworld.departed.profession);assert.ok(identities.size>1);
});

test('entry keeps progression, wounds, equipment and resources; full bags retain every returned item',()=>{
  const won=surfaceWinner();for(let i=0;i<24;i++)won.gearBag.push(C.createGear('longsword',1,won.seed,'full-'+i));
  const prior=H.allGear(won).map(g=>g.id).sort(),ids=H.ids(won),wounds=Object.fromEntries(ids.map(id=>[id,H.hp(won,id)])),hero=clone(H.actor(won,'hero')),xp=H.state(won).xp,level=H.level(won,'hero');
  const result=C.startUnderworld(won);assert.ok(result.ok,result.message);const n=result.run,d=n.underworld.departed;
  assert.deepEqual(H.allGear(n).map(g=>g.id).sort(),prior);assert.equal(n.gearBag.length,24+Object.values(H.equipment(won,d.id)).filter(Boolean).length);assert.ok(n.gearBag.length<=28);
  for(const key of ['bag','coins','hunger','elapsed'])assert.deepEqual(n[key],won[key]);assert.deepEqual(n.party.ingredients,won.party.ingredients);assert.deepEqual(n.party.meals,won.party.meals);
  assert.equal(H.state(n).xp,xp);assert.equal(H.level(n,'hero'),level);assert.deepEqual(H.actor(n,'hero').skills,hero.skills);assert.deepEqual(H.actor(n,'hero').passives,hero.passives);
  for(const id of H.ids(n))assert.equal(H.hp(n,id),wounds[id]);assert.ok(C.validateSave(n));
  assert.equal(C.grantGear(n,C.createGear('longsword',-1,n.seed,'overflow')).ok,false);
  assert.equal(n.party.loadouts.actors[d.id],undefined);assert.equal(G.state(n).policies[d.id],undefined);
});

test('a victorious companion hands control and gear back to the hero, without healing the party',()=>{
  const won=surfaceWinner(),departed=C.startUnderworld(won).run.underworld.departed.id;
  won.status='playing';won.floorsCleared=98;H.state(won).switchLeft=0;
  const switched=H.switchActor(won,departed);assert.ok(switched.ok);const r=switched.run;r.status='won';r.floorsCleared=99;H.setHp(r,'hero',0);
  const before=H.allGear(r).map(g=>g.id).sort(),result=C.startUnderworld(r);assert.ok(result.ok,result.message);
  assert.equal(H.state(result.run).active,'hero');assert.equal(result.run.hp,1);assert.deepEqual(H.allGear(result.run).map(g=>g.id).sort(),before);
  for(const m of result.run.party.members)assert.equal(m.hp,r.party.members.find(k=>k.id===m.id).hp);
  assert.ok(C.validateSave(result.run));
});

test('surface recruit limits remain 1/2/3 and underground admits four companions with five loadouts',()=>{
  const surface=fresh();for(let level=1;level<=5;level++){H.state(surface).level=level;assert.equal(P.recruitLimit(surface),Math.min(3,level));}
  let run=underground(51,0);assert.equal(P.recruitLimit(run),4);run.coins=9999;
  for(let floor=-1;floor>=-50&&run.party.members.length<4;floor--){move(run,floor);const offer=P.recruitOffer(run);if(offer){const result=P.recruit(run,offer.id);assert.ok(result.ok,result.message);run=result.run;}}
  assert.equal(run.party.members.length,4);assert.equal(H.ids(run).length,5);assert.equal(Object.keys(H.state(run).actors).length,5);
  const g=G.state(run);for(const id of H.ids(run)){g.nearby[id]=H.ids(run);g.imprints[id]={gearId:H.equipment(run,id).weapon.id,left:1};}
  assert.ok(C.validateSave(JSON.stringify(run)));
  for(let floor=-1;floor>=-50;floor--){move(run,floor);const offer=P.recruitOffer(run);if(offer){assert.equal(P.recruit(run,offer.id).ok,false);break;}}
});

test('negative floors keep 19 / 21 dimensions and finish exactly once after fifty descents',()=>{
  let run=underground(18,0);for(let depth=1;depth<=50;depth++){
    const cfg=C.floorConfig(-depth,run.seed);assert.equal(cfg.size,depth<=40?19:21);assert.deepEqual(cfg,C.floorConfig(-depth,run.seed));assert.equal(run.floorsCleared,99+depth-1);
    clearGate(run);assert.ok(C.validateSave(run),'before '+run.floor);const result=C.descend(run,run.revision);assert.ok(result.ok,result.message);run=result.run;assert.ok(C.validateSave(JSON.stringify(run)),'after '+depth);
    if(depth<50){assert.equal(run.floor,-depth-1);assert.equal(run.status,'playing');}else{assert.equal(run.floor,-50);assert.equal(run.status,'won');assert.equal(run.floorsCleared,149);assert.equal(result.effect.underworld,true);}
  }assert.equal(C.descend(run).ok,false);assert.equal(C.startUnderworld(run).ok,false);
});

test('descending clears floor-specific map knowledge, but keeps tool inventories and cooldowns',()=>{
  const run=underground(18,0);run.engine.mapKnowledge={w:1,h:1,key:'a',revealed:true,seen:'1'};Object.assign(run.engine,{shovels:2,kites:1,whistles:3,shovelCooldownMs:4500,skillCooldownMs:1200});
  const result=C.descend(run);assert.ok(result.ok,result.message);assert.equal(result.run.engine.mapKnowledge,undefined);assert.equal(result.run.engine.sightMemory,undefined);assert.equal(run.engine.mapKnowledge.revealed,true);
  for(const key of ['shovels','kites','whistles','shovelCooldownMs','skillCooldownMs'])assert.equal(result.run.engine[key],run.engine[key]);
});

test('underground combat scales HP and attack per ten floors without changing global definitions',()=>{
  const original=clone(P.defs());let previous=0;
  for(const floor of [-1,-11,-21,-31,-41]){const base=P.defs().clockmite,p=P.monsterPower(floor,base,5);assert.notEqual(p.def,base);assert.equal(p.def.damage,Math.round(base.damage*(1.25+Math.floor((-floor-1)/10)*.1)));assert.ok(p.maxHp>previous);previous=p.maxHp;}
  let run=underground(29,0);move(run,-41);for(let i=0;i<50;i++){const result=R.spawn(run,[{x:18,y:18},{x:19,y:19},{x:20,y:20}]);assert.ok(result.ok,result.message);run=result.run;assert.ok(P.monsterSpecs(run).filter(m=>!run.defeatedMonsters.includes(m.id)).length<=20);assert.ok(C.validateSave(run));}
  const specs=P.monsterSpecs(run);assert.ok(specs.some(s=>s.reinforcement));for(const spec of specs.filter(s=>!s.lord)){
    assert.ok(spec.strength>=1&&spec.strength<=5);const base=P.defs()[spec.kind],regional=M.decorate(run,base,spec.kind),originalPower=P.monsterPower(run.floor,base,spec.strength);
    assert.deepEqual({def:spec.def,maxHp:spec.maxHp},P.monsterPower(run.floor,regional,spec.strength));
    assert.equal(spec.maxHp,originalPower.maxHp);for(const key of ['damage','speed','strength','sight','shape','ranged','id'])assert.equal(spec.def[key],originalPower.def[key],key+' still follows original combat scaling');
    assert.equal(spec.def.name,M.ecology(run).variants[spec.kind].name);
  }
  assert.deepEqual(P.defs(),original);
});

test('twelve originals have unique IDs beside the underground lord and far-edge loot survives saves',()=>{
  let run=underground(3,0),found=false;for(let seed=1;seed<=80;seed++)if(C.floorConfig(-50,seed).monsterCount===12){run=underground(seed,0);found=true;break;}assert.ok(found);move(run,-50);
  const specs=P.monsterSpecs(run),lord=specs.find(s=>s.lord);assert.ok(lord);assert.equal(lord.id,'monster-12');assert.equal(new Set(specs.map(s=>s.id)).size,specs.length);assert.ok(specs.some(s=>s.id==='monster-11'&&!s.lord));
  const spec=specs.find(s=>!s.lord);run.defeatedMonsters.push(spec.id);run.party.loot.rolled.push(spec.id);run.party.loot.entries.push({type:'item',key:'heal',rarity:'uncommon',quantity:1,id:`-50:${spec.id}:item`,source:spec.id,cx:20,cy:20});
  assert.ok(C.validateSave(JSON.stringify(run)));const bad=clone(run);bad.party.loot.entries[0].cx=21;assert.equal(C.validateSave(bad),null);
  const claimed=L.claim(run,run.party.loot.entries[0].id);assert.ok(claimed.ok);assert.equal(claimed.run.bag.heal,run.bag.heal+1);
});

test('underworld metadata, bounds and counters cannot be omitted or forged',()=>{
  const run=underground();for(const mutate of [r=>delete r.underworld,r=>r.floor=0,r=>r.floor=-51,r=>r.floorsCleared=98,r=>r.underworld.surfaceEnding='unknown',r=>r.underworld.departed.id='hero',r=>r.underworld.departed.sex='unknown',r=>r.underworld.departed.name='not-the-person',r=>r.status='won']){const bad=clone(run);mutate(bad);assert.equal(C.validateSave(bad),null);}
});

test('the thirteenth monster identity is underground-only, including every saved combat channel',()=>{
  assert.equal(C.validMonsterId('monster-12'),false);assert.equal(C.validMonsterId('monster-12',-50),true);assert.equal(C.validMonsterId('monster-13',-50),false);
  const surface=fresh();for(const mutate of [r=>r.defeatedMonsters.push('monster-12'),r=>r.monsterStuns['monster-12']=1,r=>r.party.health['monster-12']=1,r=>r.party.poise['monster-12']=1,r=>H.state(r).enemy['monster-12']={slow:1}]){const bad=clone(surface);mutate(bad);assert.equal(C.validateSave(bad),null);}
  const run=underground();move(run,-50);run.party.health['monster-12']=300;run.party.poise['monster-12']=1;H.state(run).enemy['monster-12']={slow:1};run.monsterStuns['monster-12']=1;assert.ok(C.validateSave(run));
});

test('legacy completed journeys enter without erasing their old equipment or adding loadouts',()=>{
  for(const withParty of [false,true]){
    let run=C.newRun({seed:59,name:'舊旅人'});if(withParty){run=P.enable(run,'chef').run;run=P.recruit(run,P.recruitOffer(run).id).run;}
    run.floor=1;run.floorsCleared=98;run.chronicle=N.newChronicle(1);run.chronicle.clues.push('clue:heart');run.chronicle.ending='release';if(withParty)P.advance(run,{reward:false});clearGate(run);
    run.hp=19;run.gearBag.push(C.createGear('bat',1,run.seed,'old-bat'));const won=C.descend(run);assert.ok(won.ok,won.message);const before=clone(won.run);
    const result=C.startUnderworld(won.run);assert.ok(result.ok,result.message);assert.equal(result.run.hp,19);assert.deepEqual(result.run.equipment,before.equipment);assert.deepEqual(result.run.gearBag,before.gearBag);assert.equal(result.run.party?.loadouts,undefined);assert.equal(result.run.underworld.departed===null,!withParty);assert.ok(C.validateSave(result.run));
  }
});
