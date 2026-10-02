import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),E=require('../story/tower-encounters.js'),A=require('../story/tower-ascension-catalog.js'),F=require('../story/tower-field-guide.js'),L=require('../story/tower-floor-lords.js');
const fresh=(job='mage')=>H.enable(P.enable(C.newRun({seed:47,name:'地下成長整合'}),job).run).run;
function won(job='mage',level=9){const run=fresh(job);H.gainXp(run,G.XP[level-1]);run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);run.chronicle.ending='release';P.advance(run,{reward:false});assert.ok(C.validateSave(run));return run;}
function under(job='mage'){const result=C.startUnderworld(won(job));assert.ok(result.ok,result.message);return result.run;}
test('surface growth remains capped and cannot select underground ultimates or wear new tiers',()=>{
  let run=fresh();run.coins=999;run=P.recruit(run,P.recruitOffer(run).id).run;H.gainXp(run,100000);
  assert.equal(H.level(run,'hero'),10);assert.equal(H.level(run,run.party.members[0].id),5);
  assert.equal(H.maxLevel(run,'hero'),10);assert.equal(H.maxLevel(run,run.party.members[0].id),5);
  assert.equal(G.availableUltimate(run,'hero'),false);assert.equal(G.chooseUltimate(run,'hero','star_ring').ok,false);
  assert.ok(G.record(run,'hero').awakening);assert.equal(G.available(run,run.party.members[0].id),1);
  const gear=C.createGear('arcane_staff_t4',-1,run.seed,'locked');assert.equal(H.canEquip(run,'hero',gear),false);
  assert.equal(F.progression(run).nextLevelXp,null);assert.equal(F.progression(run).milestones.at(-1).level,10);
  assert.ok(C.validateSave(run));
});
test('crossing the hidden staircase retains awakening but does not spend old level-ten overflow as new training',()=>{
  const surface=won('mage',10);H.state(surface).xp=99999;assert.ok(C.validateSave(surface));const saved=JSON.stringify(surface),awakening=G.record(surface).awakening;
  const result=C.startUnderworld(surface);assert.ok(result.ok,result.message);assert.equal(JSON.stringify(surface),saved);
  assert.equal(H.level(result.run,'hero'),10);assert.equal(H.experience(result.run,'hero'),G.XP[9]);assert.equal(G.record(result.run).awakening,awakening);
  H.gainXp(result.run,0);assert.equal(H.level(result.run,'hero'),10);assert.ok(C.validateSave(result.run));
});
test('late underground choice grants only the selected two continuation skills and survives persistence',()=>{
  for(const job of Object.keys(H.JOBS))for(const branch of A.forJob(job)){
    let run=under(job);H.gainXp(run,100000);assert.equal(H.level(run,'hero'),15);assert.equal(G.record(run).awakening,null);
    const choice=G.chooseUltimate(run,'hero',branch.id);assert.ok(choice.ok,branch.id+': '+choice.message);run=choice.run;
    const actor=H.actor(run);for(const step of branch.steps)assert.ok([...actor.skills,...actor.passives].includes(step.id));
    const other=A.forJob(job).find(b=>b.id!==branch.id);assert.ok(![...actor.skills,...actor.passives].includes(other.id));
    for(const step of other.steps)assert.ok(![...actor.skills,...actor.passives].includes(step.id));
    assert.equal(G.chooseUltimate(run,'hero',other.id).ok,false);assert.ok(C.validateSave(JSON.stringify(run)));
    const guide=F.progression(run);assert.equal(guide.nextLevelXp,null);assert.equal(guide.milestones.at(-1).level,15);
  }
});
test('all merchant, chest and commission gear pools follow the underground tier gates',()=>{
  const seen=new Set();for(const floor of [99,69,39,-1,-20,-21,-50]){
    const cap=floor>0?(floor>=70?1:floor>=40?2:3):floor>=-20?4:5;
    for(let seed=1;seed<=90;seed++){
      const gear=[...E.merchantOffers(floor,seed,true).flatMap(m=>m.gear.map(o=>o.gear)),E.chestOffer(floor,seed,true)?.gear,E.questReward(floor,seed,true).gear].filter(Boolean);
      for(const item of gear){assert.ok(C.validateGear(item));assert.ok(H.GEAR[item.kind].tier<=cap);seen.add(H.GEAR[item.kind].tier);}
    }
  }
  assert.deepEqual([...seen].sort(),[1,2,3,4,5]);
});
test('underground final floor grants its clear XP once, while keeping the original tower ending separate',()=>{
  const run=under();run.floor=-50;run.floorsCleared=148;P.advance(run,{reward:false});
  run.chronicle.clues=N.allChapters().map(c=>c.clueId);run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push(L.spec(run).id);
  const xp=H.experience(run,'hero'),result=C.descend(run);assert.ok(result.ok,result.message);assert.equal(H.experience(result.run,'hero'),xp+360);assert.equal(result.run.status,'won');assert.equal(C.descend(result.run).ok,false);assert.ok(C.validateSave(result.run));
});
test('new pure catalogues load before their consumers in the game and standalone previews',()=>{
  for(const path of ['index.html','docs/職業裝備圖鑑.html','docs/技能光影預覽.html','docs/戰鬥回饋預覽.html']){
    const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    assert.ok(source.indexOf('tower-ascension-catalog.js')<source.indexOf('tower-hero-growth.js'),path);
    assert.ok(source.indexOf('tower-gear-tiers.js')<source.indexOf('tower-heroes-core.js'),path);
  }
});
