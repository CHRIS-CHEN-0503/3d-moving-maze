import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {provisionTravellers} from './recruit-fixtures.mjs';

const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js');
const fresh=seed=>provisionTravellers(H.enable(P.enable(C.newRun({seed,name:'地下招募測試'}),'mage','female').run).run);
const valid=run=>{const saved=C.validateSave(JSON.stringify(run));assert.ok(saved,'recruited party must remain saveable');return saved;};

function atFloor(run,floor){
  run.floor=floor;run.floorsCleared=floor<0?99+(-floor-1):99-floor;
  run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=C.newAdventure();run.expedition=D.newExpedition();
  if(floor>0)run.chronicle=N.newChronicle(floor);
  P.advance(run,{reward:false});return run;
}
function underground(seed=1){
  const run=atFloor(fresh(seed),1);run.chronicle.ending='keeper';run.chronicle.clues.push(N.chapterForFloor(1).clueId);
  run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push('monster-11');
  const ended=C.descend(run);assert.ok(ended.ok,ended.message);
  const entered=C.startUnderworld(ended.run);assert.ok(entered.ok,entered.message);entered.run.coins=99999;
  return valid(entered.run);
}
function recruitNext(run){
  for(let floor=-1;floor>=-50;floor--){atFloor(run,floor);const offer=P.recruitOffer(run);if(!offer)continue;const result=P.recruit(run,offer.id,run.revision);assert.ok(result.ok,result.message);return {run:result.run,id:offer.id,offer};}
  assert.fail('fixture seed must expose an eligible recruit');
}
function ordinary(run,id){const actor=H.actor(run,id);return Object.values({...H.SKILLS,...H.PASSIVES}).find(s=>s.job===H.job(run,id)&&!s.unique&&![...actor.skills,...actor.passives].includes(s.id)).id;}
function removeRecruitBonus(run,id){const a=H.actor(run,id),key=a.learned;a.skills=a.skills.filter(k=>k!==key);a.passives=a.passives.filter(k=>k!==key);delete a.cooldowns[key];a.learned=null;G.record(run,id).choices=[];}

test('every underground floor recruits level-five travellers across seeds and all sixteen appearances',t=>{
  const floors=new Set(),appearances=new Set(),rewardKinds=new Set(),jobRewards=new Map();let count=0;
  for(let seed=1;seed<=64;seed++){
    const entered=underground(seed);
    for(let floor=-1;floor>=-50;floor--){
      const run=atFloor(structuredClone(entered),floor),offer=P.recruitOffer(run);if(!offer)continue;
      assert.equal(offer.level,5,`offer at ${floor}, seed ${seed}`);
      const before=structuredClone(H.actor(run,'hero')),xp=H.experience(run,'hero'),base=H.preview(run,offer),result=P.recruit(run,offer.id,run.revision);assert.ok(result.ok,result.message);
      const member=result.run.party.members.find(m=>m.id===offer.id);
      const bodyBonus=member.profession==='robot'&&H.actor(result.run,member.id).passives.includes('robot_body')?25:0;
      assert.equal(member.level,5);assert.equal(member.xp,G.XP[4]);const vit=H.attr(result.run,member.id,'vit');assert.equal(H.unspentPoints(result.run,member.id),0,'a new companion arrives with its free points spent');assert.equal(member.hp,P.vitalHp(member.profession,5,false,vit)+bodyBonus,'and at full life');assert.equal(H.maxHp(result.run,member.id),P.vitalHp(member.profession,5,false,vit)+bodyBonus);
      assert.equal(H.level(result.run,'hero'),1);assert.equal(H.experience(result.run,'hero'),xp);assert.deepEqual(H.actor(result.run,'hero'),before);
      const a=H.actor(result.run,member.id),all=[...a.skills,...a.passives],reward=H.SKILLS[a.learned]||H.PASSIVES[a.learned];
      assert.equal(all.length,6);assert.equal(new Set(all).size,6);assert.ok([...base.skills,...base.passives].every(k=>all.includes(k)));
      assert.ok(reward);assert.equal(reward.job,member.profession);assert.ok(!reward.unique);assert.ok(![...base.skills,...base.passives].includes(a.learned));
      assert.deepEqual(G.record(result.run,member.id).choices,[a.learned]);assert.equal(G.available(result.run,member.id),0);assert.equal(G.availableUltimate(result.run,member.id),false);
      if(reward.attack!==undefined)assert.equal(a.cooldowns[reward.id],0);
      rewardKinds.add(reward.attack!==undefined?'active':'passive');if(!jobRewards.has(member.profession))jobRewards.set(member.profession,new Set());jobRewards.get(member.profession).add(reward.id);
      valid(result.run);floors.add(floor);appearances.add(member.profession+':'+member.sex);count++;
    }
  }
  assert.equal(floors.size,50);assert.deepEqual([...appearances].sort(),Object.keys(H.JOBS).flatMap(job=>[job+':female',job+':male']).sort());
  assert.deepEqual([...rewardKinds].sort(),['active','passive']);for(const values of jobRewards.values())assert.ok(values.size>1,'each job has more than one possible random reward');
  t.diagnostic(JSON.stringify({successfulRecruitments:count,floors:floors.size,appearances:appearances.size}));
});

test('new level-five companion receives its fourth-level random skill once, surviving reload',()=>{
  const recruited=recruitNext(underground(11));let run=recruited.run;const id=recruited.id,first=H.actor(run,id).learned,initial=structuredClone(H.actor(run,id));
  assert.ok(first);for(let i=0;i<4;i++){run=valid(run);H.gainXp(run,0);assert.deepEqual(H.actor(run,id),initial);}
  assert.equal(G.available(run,id),0);assert.equal(H.actor(run,id).learned,first);assert.deepEqual(G.record(run,id).choices,[first]);
  assert.equal(G.choose(run,ordinary(run,id),id).ok,false);assert.equal(H.actor(run,id).skills.length+H.actor(run,id).passives.length,6);
  for(const level of [6,8]){H.gainXp(run,G.XP[level-1]-H.experience(run,id));assert.equal(H.level(run,id),level);assert.equal(G.available(run,id),1);const key=ordinary(run,id),chosen=G.choose(run,key,id);assert.ok(chosen.ok,chosen.message);run=valid(chosen.run);assert.equal(G.available(run,id),0);assert.ok(G.record(run,id).choices.includes(key));assert.equal(H.actor(run,id).learned,first);}
});

test('underground bonus is stable before payment and recruitment is one atomic transaction',()=>{
  const source=underground(12);let offer;
  for(let floor=-1;floor>=-50&&!offer;floor--){atFloor(source,floor);offer=P.recruitOffer(source);}
  assert.ok(offer);const snapshot=structuredClone(source),a=P.recruit(source,offer.id,source.revision),b=P.recruit(structuredClone(source),offer.id,source.revision);
  assert.ok(a.ok,a.message);assert.deepEqual(a,b);assert.deepEqual(source,snapshot);assert.equal(a.run.revision,source.revision+1);assert.equal(a.run.coins,source.coins-offer.price);
  assert.match(a.message,/隨機習得/);assert.equal(P.recruit(a.run,offer.id,a.run.revision).ok,false);assert.deepEqual(valid(a.run),a.run);
  const stale=P.recruit(source,offer.id,source.revision-1);assert.equal(stale.ok,false);assert.deepEqual(stale.run,snapshot);
});

test('fresh recruits advance using their own XP up to ten, never copying a level-fifteen hero',()=>{
  let run=underground(17);H.gainXp(run,G.XP[14]);const result=recruitNext(run);run=result.run;const id=result.id;
  assert.equal(H.level(run,'hero'),15);assert.equal(H.level(run,id),5);assert.equal(H.experience(run,id),G.XP[4]);
  H.gainXp(run,100);assert.equal(H.level(run,id),5);assert.equal(H.experience(run,id),G.XP[4]+100);assert.equal(H.level(run,'hero'),15);
  for(let level=6;level<=10;level++){H.gainXp(run,G.XP[level-1]-H.experience(run,id));assert.equal(H.level(run,id),level);assert.equal(H.experience(run,id),G.XP[level-1]);valid(run);}
  assert.equal(H.maxHp(run,id),P.vitalHp(H.job(run,id),10,false));assert.equal(G.available(run,id),2);assert.equal(G.availableUltimate(run,id),true);
  H.gainXp(run,100000);assert.equal(H.level(run,id),10);assert.equal(H.experience(run,id),G.XP[9]);valid(run);
});

test('surface recruitment keeps its original floor-based levels one through five',t=>{
  const levels=new Set();let count=0;
  for(let seed=1;seed<=16;seed++)for(let floor=1;floor<=99;floor++){
    const run=atFloor(fresh(seed),floor);run.coins=99999;const offer=P.recruitOffer(run);if(!offer)continue;
    const expected=Math.min(5,1+Math.floor((99-floor)/22));assert.equal(offer.level,expected);
    const result=P.recruit(run,offer.id,run.revision);assert.ok(result.ok,result.message);const member=result.run.party.members[0];
    const bodyBonus=member.profession==='robot'&&H.actor(result.run,member.id).passives.includes('robot_body')?5*expected:0;
    assert.equal(member.level,expected);assert.equal(member.xp,G.XP[expected-1]);assert.equal(member.hp,P.vitalHp(member.profession,expected,false,H.attr(result.run,member.id,'vit'))+bodyBonus);assert.equal(H.unspentPoints(result.run,member.id),0);assert.equal(H.actor(result.run,member.id).learned,null);assert.deepEqual(G.record(result.run,member.id).choices,[]);assert.equal(G.available(result.run,member.id),expected>=4?1:0);valid(result.run);levels.add(expected);count++;
  }
  assert.deepEqual([...levels].sort(),[1,2,3,4,5]);t.diagnostic(JSON.stringify({surfaceRecruitments:count}));
});

test('loading and recruiting preserve existing lower- and higher-level companions and wounds',()=>{
  let first=recruitNext(underground(23)),run=first.run,second=recruitNext(run);run=second.run;
  const low=run.party.members.find(m=>m.id===first.id),high=run.party.members.find(m=>m.id===second.id);
  // These records model valid pre-change saves, not newly issued offers.
  removeRecruitBonus(run,low.id);
  Object.assign(low,{level:2,xp:G.XP[1]+120,hp:13});Object.assign(high,{level:9,xp:G.XP[8]+100,hp:47});
  for(const m of [low,high])H.actor(run,m.id).attrs=H.autoSpend({},m.profession,m.level);
  const before=Object.fromEntries([low,high].map(m=>[m.id,{member:structuredClone(m),actor:structuredClone(H.actor(run,m.id)),growth:structuredClone(G.record(run,m.id))}]));
  run=valid(run);H.gainXp(run,0);run=valid(run);
  const third=recruitNext(run);run=third.run;assert.equal(H.level(run,third.id),5);
  for(const [id,prior]of Object.entries(before)){assert.deepEqual(run.party.members.find(m=>m.id===id),prior.member);assert.deepEqual(H.actor(run,id),prior.actor);assert.deepEqual(G.record(run,id),prior.growth);}
  valid(run);
});

test('legacy lower-level XP migration preserves level rather than applying the new recruit default',()=>{
  const recruited=recruitNext(underground(31)),run=recruited.run,id=recruited.id,member=run.party.members[0];
  removeRecruitBonus(run,id);
  member.level=3;member.hp=21;delete member.xp;H.actor(run,id).attrs=H.autoSpend({},member.profession,3);G.state(run).version=1;delete G.state(run).members;
  const restored=valid(run);assert.equal(H.level(restored,id),3);assert.equal(H.experience(restored,id),G.XP[2]);assert.equal(H.hp(restored,id),21);assert.deepEqual(H.actor(restored,id),H.actor(run,id));
});
