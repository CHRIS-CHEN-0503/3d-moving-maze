import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const fresh=()=>H.enable(P.enable(C.newRun({seed:43}),'smith').run).run;
const asV2=g=>({...g,durability:g.durability/5,maxDurability:g.maxDurability/5,durabilityVersion:2});

test('v2 gear of every category and quality gains exactly 5x remaining and maximum durability',()=>{
  for(const kind of Object.keys(C.GEAR))for(const enhanced of [false,true])for(const floor of [99,49,1]){
    const generated=C.createGear(kind,floor,43,'fivefold',enhanced);
    assert.equal(generated.durabilityVersion,3);
    const old=asV2(generated);
    for(const left of [0,1,Math.floor(old.maxDurability/2),old.maxDurability]){
      old.durability=left;
      const migrated=C.validateGear(old);
      assert.ok(migrated,kind);
      assert.equal(migrated.durability,left*5);
      assert.equal(migrated.maxDurability,old.maxDurability*5);
      assert.equal(migrated.defense,old.defense);
      assert.equal(migrated.bonus,old.bonus);
      assert.equal(C.gearPrice(migrated),C.GEAR[kind].buyPrice+old.maxDurability/(C.durabilityMultiplier(kind)/5)*2+old.bonus*16);
      assert.deepEqual(C.validateGear(migrated),migrated);
    }
  }
});

test('mixed v2 and v3 active gear, companions and inventory migrate once across repeated save loads',()=>{
  let run=fresh();run=P.recruit(run,P.recruitOffer(run).id).run;
  run.gearBag.push(C.createGear('robe',99,43,'bag'),C.createGear('tower_shield',49,43,'broken',true));
  const expected=new Map();
  H.allGear(run).forEach((g,i)=>{
    g.durability=i%2?0:Math.floor(g.maxDurability/10)*5;
    expected.set(g.id,{durability:g.durability,maxDurability:g.maxDurability});
    if(i%3!==0)Object.assign(g,asV2(g));
  });
  for(let n=0;n<5;n++){
    run=C.validateSave(JSON.stringify(run));assert.ok(run);
    for(const g of H.allGear(run)){
      assert.equal(g.durabilityVersion,3);
      assert.deepEqual({durability:g.durability,maxDurability:g.maxDurability},expected.get(g.id));
    }
  }
});

test('source version bounds remain strict and unknown versions cannot bypass validation',()=>{
  const gear=C.createGear('longsword',49,43,'bounds');
  assert.ok(C.validateGear(gear));
  for(const durabilityVersion of [0,1,4,'3',null])assert.equal(C.validateGear({...gear,durabilityVersion}),null);
  for(const g of [gear,asV2(gear)]){
    assert.equal(C.validateGear({...g,durability:g.maxDurability+1}),null);
    assert.equal(C.validateGear({...g,durability:-1}),null);
    assert.equal(C.validateGear({...g,maxDurability:g.maxDurability+1}),null);
  }
});

test('migration preserves forged equipment data and repair price units, including broken rebuild surcharge',()=>{
  const run=fresh();run.coins=999;run.party.journey.scrap=99;
  const gear=run.equipment.weapon;
  gear.durability=0;
  const q=X.repairQuote(run,gear.id);
  // Use the canonical forge representation produced by the rules.
  const healthy=fresh();healthy.coins=999;healthy.party.journey.scrap=99;
  const forged=X.forge(healthy,healthy.equipment.weapon.id,'durable');
  assert.ok(forged.ok);
  const forgedGear=forged.run.equipment.weapon;
  const v2=asV2(forgedGear),migrated=C.validateGear(v2);
  assert.deepEqual(migrated.forge,v2.forge);
  assert.equal(q.coins,Math.ceil(q.normalCoins*1.5));
  const priorMaximum=gear.maxDurability/5,priorMultiplier=C.durabilityMultiplier(gear.kind)/5;
  const units=Math.ceil(priorMaximum/(4*priorMultiplier));
  assert.equal(q.normalCoins,Math.ceil(units*6*(1-H.teamPassive(run,'economy')/100)));
  assert.equal(q.parts,Math.max(1,Math.ceil(units/2)));
  const repaired=X.repair(run,gear.id,run.revision);assert.ok(repaired.ok);
  assert.equal(repaired.run.equipment.weapon.durability,gear.maxDurability);
});
