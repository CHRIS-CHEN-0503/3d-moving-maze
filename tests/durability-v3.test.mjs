import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const fresh=()=>H.enable(P.enable(C.newRun({seed:43}),'smith').run).run;
// Real source units: v2 weapon/heavy 3x, light/robe 2x; v3 was 5x v2.
const source=g=>C.durabilityMultiplier(g.kind)*.75;
const oldGear=(g,v,left)=>{const mult=v===4?C.durabilityMultiplier(g.kind)/2:source(g)/(v===2?5:1),base=Math.round(g.maxDurability/C.durabilityMultiplier(g.kind)),maxDurability=Math.round(base*mult);return {...g,durability:left??maxDurability,maxDurability,durabilityVersion:v};};
test('all old source versions and categories migrate once to current doubled durability, preserving broken gear',()=>{
  for(const kind of Object.keys(C.GEAR))for(const enhanced of [false,true])for(const floor of [99,49,1])for(const version of [2,3]){
    const generated=C.createGear(kind,floor,43,'migration',enhanced);assert.equal(generated.durabilityVersion,5);
    const old=oldGear(generated,version),ratio=generated.maxDurability/old.maxDurability;
    for(const left of [0,1,Math.floor(old.maxDurability/2),old.maxDurability]){
      const migrated=C.validateGear({...old,durability:left});assert.ok(migrated,kind);
      assert.equal(migrated.durability,left===0?0:Math.max(1,Math.round(left*ratio)));
      assert.equal(migrated.maxDurability,generated.maxDurability);
      assert.equal(migrated.defense,old.defense);assert.equal(migrated.bonus,old.bonus);
      assert.equal(C.gearPrice(migrated),C.gearPrice(generated));assert.deepEqual(C.validateGear(migrated),migrated);
    }
  }
});
test('mixed v2, v3 and v4 active, inactive and inventory gear never multiply on later save loads',()=>{
  let run=fresh();run=P.recruit(run,P.recruitOffer(run).id).run;
  run.gearBag.push(C.createGear('robe',99,43,'bag'),C.createGear('tower_shield',49,43,'broken',true));
  const expected=new Map();H.allGear(run).forEach((g,i)=>{
    const version=[2,3,4][i%3];Object.assign(g,oldGear(g,version));g.durability=i%2?0:Math.floor(g.maxDurability/2);
    const migrated=C.validateGear(g);expected.set(g.id,{durability:migrated.durability,maxDurability:migrated.maxDurability});
  });
  for(let n=0;n<5;n++){run=C.validateSave(JSON.stringify(run));assert.ok(run);for(const g of H.allGear(run)){assert.equal(g.durabilityVersion,5);assert.deepEqual({durability:g.durability,maxDurability:g.maxDurability},expected.get(g.id));}}
});
test('source bounds stay strict; unknown versions and off-lattice maximums cannot bypass validation',()=>{
  const gear=C.createGear('longsword',49,43,'bounds');assert.ok(C.validateGear(gear));
  for(const durabilityVersion of [0,1,6,'3',null])assert.equal(C.validateGear({...gear,durabilityVersion}),null);
  for(const g of [gear,oldGear(gear,2),oldGear(gear,3)])for(const delta of [{durability:g.maxDurability+1},{durability:-1},{maxDurability:g.maxDurability+1}])assert.equal(C.validateGear({...g,...delta}),null);
});
test('migration retains forge traits and base repair price units, including broken rebuild surcharge',()=>{
  const run=fresh();run.coins=999;run.party.journey.scrap=99;const gear=run.equipment.weapon;gear.durability=0;
  const q=X.repairQuote(run,gear.id),healthy=fresh();healthy.coins=999;healthy.party.journey.scrap=99;healthy.party.journey.materials.ironore=3;
  const forged=X.forge(healthy,healthy.equipment.weapon.id,'durable');assert.ok(forged.ok);
  const old=oldGear(forged.run.equipment.weapon,2),migrated=C.validateGear(old);assert.deepEqual(migrated.forge,old.forge);
  assert.equal(q.coins,Math.ceil(q.normalCoins*1.5));
  const units=Math.ceil(gear.maxDurability/(4*C.durabilityMultiplier(gear.kind)));
  assert.equal(q.normalCoins,Math.ceil(units*6*(1-H.teamPassive(run,'economy')/100)));assert.equal(q.parts,Math.max(1,Math.ceil(units/2)));
  const repaired=X.repair(run,gear.id,run.revision);assert.ok(repaired.ok);assert.equal(repaired.run.equipment.weapon.durability,gear.maxDurability);
});
