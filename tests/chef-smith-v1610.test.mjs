import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),X=require('../story/tower-expedition-core.js'),A=require('../story/tower-affixes.js');
const stock=run=>{for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=10;return run;};
const legacy=(job,seed=9)=>stock(P.enable(C.newRun({seed,name:'廚鍛測試'}),job).run);
const modern=(job,seed=9)=>stock(H.enable(P.enable(C.newRun({seed,name:'廚鍛測試'}),job).run).run);
test('a chef cooks special portions that heal and feed more; without a chef the same dish stays plain',()=>{
  let run=legacy('chef');run.hp=20;let r=P.cook(run,'stew');assert.ok(r.ok,r.message);run=r.run;assert.equal(run.party.meals.stew,2);assert.equal(run.party.specials.stew,2);assert.match(r.message,/廚師特製/);assert.equal(r.effect.special,true);
  assert.equal(P.chefLevel(run),3);assert.equal(P.specialBonus(run),30);r=P.eat(run,'stew');assert.ok(r.ok);assert.equal(r.run.hp,20+Math.round(8*1.3));assert.match(r.message,/廚師特製 \+30%/);assert.equal(r.run.party.specials.stew,1);assert.equal(r.run.party.meals.stew,1);assert.ok(C.validateSave(JSON.stringify(r.run)));
  let plain=legacy('swordsman');plain.hp=20;r=P.cook(plain,'stew');assert.ok(r.ok);assert.equal(r.run.party.specials.stew,0);assert.equal(r.effect.special,false);r=P.eat(r.run,'stew');assert.equal(r.run.hp,28);assert.doesNotMatch(r.message,/特製/);
  const broken=structuredClone(run);broken.party.specials.stew=9;const repaired=C.validateSave(JSON.stringify(broken));assert.ok(repaired,'v1.61.1: an overcounted special is clamped on load instead of rejecting the save');assert.equal(repaired.party.specials.stew,repaired.party.meals.stew,'specials never exceed the dish count');
  const old=structuredClone(run);delete old.party.specials;const migrated=C.validateSave(JSON.stringify(old));assert.ok(migrated);assert.deepEqual(migrated.party.specials,Object.fromEntries(Object.keys(P.RECIPES).map(id=>[id,0])));
});
test('the chef bonus follows the travelling chef level, at least ten percent and at most fifty',()=>{
  const run=modern('chef');assert.equal(P.chefLevel(run),1);assert.equal(P.specialBonus(run),10);H.state(run).level=4;assert.equal(P.specialBonus(run),40);H.state(run).level=9;assert.equal(P.specialBonus(run),50);
  const r=P.cook(run,'broth');assert.ok(r.ok,r.message);assert.equal(r.run.party.specials.broth,r.run.party.meals.broth);assert.ok(C.validateSave(JSON.stringify(r.run)));
  const none=modern('healer');assert.equal(P.chefLevel(none),0);assert.equal(P.specialBonus(none),10,'a chef-made portion eaten after the chef left keeps the minimum bonus');
});
test('a smith patches worn gear anywhere for metal parts, repeatedly, while broken gear and partyless runs are refused',()=>{
  let run=modern('smith');run.party.journey.scrap=5;const gear=H.equipment(run,'hero').weapon;gear.durability=Math.max(1,gear.durability-10);const before=gear.durability,q=P.fieldRepairQuote(run);
  assert.ok(q.allowed&&q.affordable);assert.equal(q.parts,2);let r=P.fieldRepair(run);assert.ok(r.ok,r.message);run=r.run;const after=H.equipment(run,'hero').weapon;assert.equal(after.durability,Math.min(after.maxDurability,before+Math.ceil(after.maxDurability*.2)));assert.equal(run.party.journey.scrap,3);assert.ok(C.validateSave(JSON.stringify(run)));
  H.equipment(run,'hero').weapon.durability-=5;r=P.fieldRepair(run);assert.ok(r.ok,'repeatable while parts last');assert.equal(r.run.party.journey.scrap,1);const low=r.run;H.equipment(low,'hero').weapon.durability-=5;assert.match(P.fieldRepair(low,low.revision).message,/金屬零件不足/);
  const sword=modern('swordsman');H.equipment(sword,'hero').weapon.durability-=5;assert.match(P.fieldRepairQuote(sword).reason,/鍛匠/);assert.equal(P.fieldRepair(sword).ok,false);
});
test('second-level crafts belong to the smith, smith work leaves a mark that slows wear, and camp enchanting beats the merchants by fifteen points',()=>{
  let run=modern('smith');run.party.journey.scrap=30;run.coins=200;run.party.journey.materials.ironore=6;run.party.journey.materials.toughfiber=6;const id=H.equipment(run,'hero').weapon.id;
  let r=X.forge(run,id,'durable',run.revision);assert.ok(r.ok,r.message);run=r.run;let g=H.equipment(run,'hero').weapon;assert.equal(g.forge.smith,true);assert.equal(g.forge.level,1);assert.match(r.message,/匠印/);assert.ok(C.validateSave(JSON.stringify(run)));
  assert.match(X.forgeQuote(run,id,'durable',{kind:'merchant',merchantId:'tieLing'}).reason,/第二級工藝只有隊內鍛匠/);assert.equal(X.forgeQuote(run,id,'durable').allowed,true);
  const hits=g.durability;for(let i=0;i<10;i++)X.wear(run,g);assert.equal(g.durability,hits-8,'durable level one plus the smith mark saves two of ten wears');
  const marked={trait:'light',level:1,reserve:0,smith:true,wearCredit:3};assert.deepEqual(X.validateForge(marked,'weapon'),marked);assert.equal(X.validateForge({...marked,smith:false},'weapon'),null);assert.equal(X.validateForge({trait:'light',level:1,reserve:0,wearCredit:3},'weapon'),null);
  const plain=modern('smith');const pg=H.equipment(plain,'hero').weapon;pg.forge={trait:'light',level:1,reserve:0,smith:true,wearCredit:0};const d=pg.durability;for(let i=0;i<10;i++)X.wear(plain,pg);assert.equal(pg.durability,d-9);
  const key=Object.keys(A.EFFECTS).find(k=>!A.EFFECTS[k].underground);const camp=A.quote(run,id,key),merchant=A.quote(run,id,key,{kind:'merchant',merchantId:'tieLing'});assert.equal(camp.chance-merchant.chance,A.SMITH_AFFIX_BONUS);assert.equal(camp.chance,65+3+15);
});
