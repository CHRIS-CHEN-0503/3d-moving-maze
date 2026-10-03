import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),N=require('../story/tower-narrative.js');
const fresh=(seed=31415,job='chef')=>P.enable(C.newRun({seed,name:'同行者測試'}),job).run;
function setFloor(run,floor){run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);return run;}
function withMember(run,profession,hp=20){const id='companion:earlier:'+profession;run.party.members=[{id,profession,sex:P.PROFESSIONS[profession].gender,level:2,hp,cooldown:0,hurtLeft:0}];run.party.joined=[id];return run;}

test('all seven named travellers cannot appear again while already in the party, including downed members',()=>{
  const jobs=new Set();let checked=0;
  for(const seed of [7,31,214,31415])for(let floor=99;floor>=1;floor--){
    const run=setFloor(fresh(seed),floor),offer=P.recruitOffer(run);if(!offer)continue;
    jobs.add(offer.profession);
    for(const hp of [0,20]){
      withMember(run,offer.profession,hp);const before=JSON.stringify(run);
      assert.equal(P.recruitOffer(run),null,`${floor}: ${offer.profession}, hp ${hp}`);
      assert.equal(JSON.stringify(run),before);checked++;
    }
  }
  assert.equal(jobs.size,6);assert.ok(checked>200); // Legacy journeys retain their six seeded travellers.
});

test('old saves retain the original traveller, health, coins and items while suppressing their duplicate offer',()=>{
  const run=withMember(setFloor(fresh(),91),'healer',13),before=JSON.stringify(run);
  const restored=C.validateSave(before);assert.ok(restored);assert.deepEqual(restored,run);
  assert.equal(P.recruitOffer(restored),null);assert.equal(JSON.stringify(run),before);
  const staleId=`companion:${run.floor}:${run.seed}`,result=P.recruit(restored,staleId,restored.revision);
  assert.equal(result.ok,false);assert.deepEqual(result.run,restored);
});

test('successful invitation consumes the scene offer and dismissal cannot respawn it on the same floor',()=>{
  const run=fresh(),offer=P.recruitOffer(run),result=P.recruit(run,offer.id,run.revision);
  assert.equal(result.ok,true);assert.equal(result.run.coins,run.coins-offer.price);
  assert.equal(P.recruitOffer(result.run),null);
  const dismissed=P.dismiss(result.run,offer.id,result.run.revision);assert.equal(dismissed.ok,true);
  assert.equal(P.recruitOffer(dismissed.run),null);assert.equal(P.recruit(dismissed.run,offer.id).ok,false);
});

test('the player profession is not a named companion; other travellers and later reunions remain available',()=>{
  const run=fresh(31415,'swordsman');assert.equal(P.recruitOffer(run).profession,'swordsman');
  withMember(run,'healer');assert.equal(P.recruitOffer(run).profession,'swordsman');
  setFloor(run,91);assert.equal(P.recruitOffer(run),null);
  const dismissed=P.dismiss(run,run.party.members[0].id,run.revision);assert.equal(dismissed.ok,true);
  assert.equal(P.recruitOffer(dismissed.run),null,'the same floor cannot respawn a dismissed identity');
  let reunion=null;for(let f=90;f>=1&&!reunion;f--){setFloor(dismissed.run,f);const next=P.recruitOffer(dismissed.run);if(next?.returning)reunion=next;}
  assert.ok(reunion);assert.equal(reunion.profession,'healer');assert.equal(reunion.id,'companion:earlier:healer');
});
