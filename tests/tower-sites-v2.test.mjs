import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const fresh=(job,seed)=>H.enable(P.enable(C.newRun({seed}),job).run).run;
function fixture(job){for(let seed=1;seed<=100;seed++){const run=fresh(job,seed);if(X.siteOffer(run).job===job)return run;}assert.fail('Missing '+job+' site seed');}
function hash(seed,text){let n=seed>>>0;for(const ch of text)n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;return n;}
test('old six-profession site seeds and unfinished work survive migration; new floors use all eight',()=>{
  for(let seed=1;seed<=100;seed++){const run=fresh('swordsman',seed),site=run.party.journey.site;delete site.catalogVersion;site.progress=7;const restored=C.validateSave(run);assert.ok(restored);assert.equal(restored.party.journey.site.catalogVersion,1);assert.equal(restored.party.journey.site.progress,7);assert.equal(X.siteOffer(restored).job,Object.keys(X.SITES)[hash(seed,'site:99')%6]);assert.deepEqual(C.validateSave(restored),restored);restored.floor=98;P.advance(restored);assert.equal(restored.party.journey.site.catalogVersion,2);}
  const bad=fresh('swordsman',1);bad.party.journey.site.catalogVersion=3;assert.equal(C.validateSave(bad),null);
});
test('archer site grants capped arrows and a short route reveal only once, without deleting overflow',()=>{
  for(const stock of [0,90,100,130]){const run=fixture('archer');run.bag.arrow=stock;const offer=X.siteOffer(run),before=structuredClone(run),out=X.explore(run,offer.id,'profession',run.revision);assert.ok(out.ok,out.message);assert.deepEqual(run,before);assert.equal(out.run.bag.arrow,Math.max(stock,Math.min(100,stock+30)));assert.equal(out.run.effects.reveal,12);assert.equal(out.run.coins,run.coins+8);assert.equal(X.explore(out.run,offer.id,'profession').ok,false);assert.ok(C.validateSave(out.run));}
});
test('robot site recharges living robots and grants parts without consuming power stones',()=>{
  const run=fixture('robot');H.actor(run).robot.fuel=40;const member={id:'site-robot',profession:'robot',sex:'female',level:1,hp:1,cooldown:0,hurtLeft:0};run.party.members.push(member);run.party.joined.push(member.id);H.addMember(run,member);H.actor(run,member.id).robot.fuel=30;H.setHp(run,member.id,0);H.sync(run);run.bag.power_glimmer=2;const offer=X.siteOffer(run),out=X.explore(run,offer.id,'profession',run.revision);assert.ok(out.ok,out.message);assert.equal(H.actor(out.run,'hero').robot.fuel,65);assert.equal(H.actor(out.run,member.id).robot.fuel,30);assert.equal(out.run.bag.power_glimmer,2);assert.equal(out.run.party.journey.scrap,2);assert.ok(C.validateSave(out.run));
});
test('archer and robot sites permit slower work without that profession, but cannot be claimed early',()=>{
  for(const job of ['archer','robot']){const seed=fixture(job).seed,run=fresh('swordsman',seed),offer=X.siteOffer(run);assert.equal(X.explore(run,offer.id,'profession').ok,false);assert.equal(X.explore(run,offer.id,'work').ok,false);run.party.journey.site.progress=12;const out=X.explore(run,offer.id,'work');assert.ok(out.ok,out.message);assert.ok(C.validateSave(out.run));}
});
