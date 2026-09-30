import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const fresh=(job='smith')=>H.enable(P.enable(C.newRun({seed:43}),job).run).run;
test('all weapon and armor multipliers match category; legacy damaged items upgrade once without healing',()=>{
  for(const [kind,def]of Object.entries(C.GEAR)){
    const expected=def.slot==='weapon'||def.type==='heavy'||['helmet','armor','shield','round_shield','tower_shield'].includes(def.baseKind||kind)?10:20/3;
    assert.equal(C.durabilityMultiplier(kind),expected);
    const gear=C.createGear(kind,49,13,'migration'),price=C.gearPrice(gear),old={...gear,durability:2,maxDurability:Math.round(gear.maxDurability/expected)};delete old.durabilityVersion;
    const upgraded=C.validateGear(old);assert.equal(upgraded.durability,Math.round(2*expected));assert.equal(upgraded.maxDurability,gear.maxDurability);assert.deepEqual(C.validateGear(upgraded),upgraded);assert.equal(C.gearPrice(upgraded),price);
  }
});
test('active, inactive and bag gear upgrade together and never multiply on later reloads',()=>{
  let r=fresh();r=P.recruit(r,P.recruitOffer(r).id).run;r.gearBag.push(C.createGear('robe',99,43,'bag'));
  for(const g of H.allGear(r)){const m=C.durabilityMultiplier(g.kind);g.durability=2;g.maxDurability=Math.round(g.maxDurability/m);delete g.durabilityVersion;}
  const restored=C.validateSave(r);assert.ok(restored);for(const g of H.allGear(restored))assert.equal(g.durability,Math.round(2*C.durabilityMultiplier(g.kind)));
  assert.deepEqual(C.validateSave(JSON.stringify(restored)),restored);
});
test('warnings turn orange at 20%, red at 10%, include broken pieces, and clear after repair',()=>{
  const r=fresh(),g=r.equipment.weapon;g.maxDurability=30;
  for(const [n,severity]of [[7,null],[6,'warning'],[3,'critical'],[0,'critical']]){g.durability=n;const w=H.durabilityWarnings(r).find(x=>x.slot==='weapon');assert.equal(w?.severity||null,severity);if(n===0)assert.equal(w.broken,true);}
  g.durability=30;assert.equal(H.durabilityWarnings(r).length,0);
});
test('zero durability is preserved but loses stats; smith rebuild costs materials and 1.5x normal coins',()=>{
  let r=fresh();r.coins=999;r.party.journey.scrap=99;const g=r.equipment.weapon;g.durability=0;
  const q=X.repairQuote(r,g.id);assert.equal(q.coins,Math.ceil(q.normalCoins*1.5));assert.equal(q.allowed,true);assert.ok(q.parts>0);
  const before=JSON.stringify(r),res=X.repair(r,g.id,r.revision);assert.ok(res.ok);assert.equal(JSON.stringify(r),before);
  assert.equal(res.run.equipment.weapon.durability,g.maxDurability);assert.equal(res.run.coins,r.coins-q.coins);assert.equal(res.run.party.journey.scrap,99-q.parts);assert.equal(X.repair(res.run,g.id,r.revision).ok,false);
  assert.ok(C.validateSave(r));assert.ok(C.validateSave(res.run));assert.ok(H.stats(res.run).damage>H.stats(r).damage);
  assert.equal(X.forge(r,g.id,'durable').ok,false);
});
test('no smith, downed smith, insufficient funds, or stale revision never partially repairs gear',()=>{
  for(const cause of ['no-smith','down','coins','parts','revision']){const r=fresh(cause==='no-smith'?'mage':'smith');r.coins=99;r.party.journey.scrap=99;r.equipment.weapon.durability=0;if(cause==='down')H.setHp(r,'hero',0);if(cause==='coins')r.coins=0;if(cause==='parts')r.party.journey.scrap=0;const before=JSON.stringify(r);assert.equal(X.repair(r,r.equipment.weapon.id,r.revision+(cause==='revision'?1:0)).ok,false,cause);assert.equal(JSON.stringify(r),before);}
});
