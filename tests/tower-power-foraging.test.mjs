import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),F=require('../story/tower-foraging.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-encounters.js'),M=require('../story/tower-materials.js');
const fresh=seed=>H.enable(P.enable(C.newRun({seed,name:'動力石採集'}),'robot').run).run;
const floors=[...Array.from({length:99},(_,i)=>i+1),...Array.from({length:50},(_,i)=>-i-1)];
test('historical rule draws match their fixed published intervals rather than the current appearance table',()=>{
  const original={suitable:{0:0,1:40,2:35,3:25},neutral:{0:30,1:30,2:25,3:15},unsuitable:{0:60,1:20,2:15,3:5}},draft={suitable:40,neutral:30,unsuitable:20},published={suitable:50,neutral:30,unsuitable:10};
  const draw=(at,kind,chance=null)=>{const region=F.REGIONS[M.ecology(at).id][kind==='power'?'herb':kind],weights=original[region],range=chance?100*(100-weights[0]):100;let roll=F.hash(at.seed,`foraging:${at.floor}:${kind}:count`)%range;for(const quantity of [1,2,3]){const weight=weights[quantity]*(chance?chance[region]:1);if(roll<weight)return quantity;roll-=weight;}return 0;};
  for(const floor of floors)for(const seed of [1,31,0xffffffff]){
    const at={floor,seed};for(const rule of [1,2])assert.deepEqual(F.drawCounts(at,rule),Object.fromEntries(['herb','ore'].map(kind=>[kind,draw(at,kind,rule===1?null:published)])));
    for(const rule of [1,2,3]){const tier=draw(at,'power',rule===1?null:rule===2?draft:published),expected=tier?{tier,key:F.POWER_STONES[tier-1],quantity:1+F.hash(seed,`foraging:${floor}:power:quantity`)%3}:null;assert.deepEqual(F.drawPowerDeposit(at,rule),expected);}
  }
});
test('power appearance rises ten points to 60/40/20 percent without changing relative grade weights',()=>{
  assert.equal(F.POWER_BASE_APPEARANCE,40);assert.equal(F.POWER_ENVIRONMENT_BONUS,20);
  assert.deepEqual(F.POWER_APPEARANCE,{suitable:60,neutral:40,unsuitable:20});
  assert.deepEqual(Object.fromEntries(Object.entries(F.POWER_PROFILES).map(([name,weights])=>[name,weights[0]])),{suitable:40,neutral:60,unsuitable:80});
  assert.deepEqual(F.POWER_PROFILES,F.PROFILES);
  for(const name of ['suitable','neutral','unsuitable'])assert.equal(F.POWER_APPEARANCE[name]-F.V3_APPEARANCE[name],10);
  for(const [name,weights]of Object.entries(F.LEGACY_PROFILES)){
    const power=F.POWER_PROFILES[name],original=100-weights[0],appearance=F.POWER_APPEARANCE[name];
    assert.equal(power[0],100-appearance);
    assert.ok(Math.abs([0,1,2,3].reduce((sum,tier)=>sum+power[tier],0)-100)<1e-10);
    for(const tier of [1,2,3])assert.ok(Math.abs(power[tier]/appearance-weights[tier]/original)<1e-10);
    assert.ok(Object.isFrozen(power));
  }
  for(const [floor,profile]of [[99,'neutral'],[89,'suitable'],[39,'unsuitable']]){
    const totals=[0,0,0,0],quantities=new Set();
    for(let seed=1;seed<=12000;seed++){const run={floor,seed},d=F.powerDeposit(run);totals[d?.tier||0]++;if(d){quantities.add(d.quantity);assert.equal(d.key,F.POWER_STONES[d.tier-1]);assert.deepEqual(F.powerDeposit(run),d);}}
    assert.deepEqual(F.powerProfile({floor}),F.POWER_PROFILES[profile]);
    for(let tier=0;tier<=3;tier++)assert.ok(Math.abs(totals[tier]/12000-F.POWER_PROFILES[profile][tier]/100)<.02);
    assert.deepEqual([...quantities],[1]);
  }
  for(const rule of [0,5,NaN])assert.throws(()=>F.drawPowerDeposit({floor:99,seed:31},rule),RangeError);
});
test('power draws remain independent of seeded herb and mineral draws under the shared new appearance rule',()=>{
  for(const floor of [...Array.from({length:99},(_,i)=>i+1),...Array.from({length:50},(_,i)=>-i-1)])for(const seed of [1,31,9987,0xffffffff]){
    const run={floor,seed},before=F.drawCounts(run);
    F.powerDeposit(run);assert.deepEqual(F.counts(run),before);
  }
  const joint=Array.from({length:2},()=>Array.from({length:2},()=>[0,0]));
  for(let seed=1;seed<=12000;seed++){const at={floor:99,seed},amount=F.drawCounts(at);joint[+(amount.herb>0)][+(amount.ore>0)][+!!F.drawPowerDeposit(at)]++;}
  for(let herb=0;herb<=1;herb++)for(let ore=0;ore<=1;ore++)for(let power=0;power<=1;power++){
    const probability=[herb,ore,power].reduce((product,present)=>product*(present ? .4 : .6),1);
    assert.ok(Math.abs(joint[herb][ore][power]/12000-probability)<.015,`${herb}/${ore}/${power} resource rolls correlate`);
  }
});
test('existing v1 deposits and collected receipts migrate once without grade, quantity or stock changes',()=>{
  let changedSeed;
  for(let seed=1;seed<4096;seed++)if(F.rollCount(seed,99,'power',F.LEGACY_PROFILES.neutral)&&!F.powerDeposit({floor:99,seed})){changedSeed=seed;break;}
  assert.ok(changedSeed,'Fixture must lose its old deposit under new-floor rules');
  for(const claimed of [[],['foraging:99:power:0']]){
    const r=fresh(changedSeed),old={version:1,floor:99,seed:changedSeed,claimed};r.party.foraging=old;
    const before=structuredClone(r),tier=F.rollCount(changedSeed,99,'power',F.LEGACY_PROFILES.neutral),expected={tier,key:F.POWER_STONES[tier-1],quantity:1+F.hash(changedSeed,'foraging:99:power:quantity')%3};
    const migrated=C.validateSave(JSON.stringify(r));assert.ok(migrated);
    assert.equal(migrated.party.foraging.version,4);assert.equal(migrated.party.foraging.harvestRule,1);assert.equal(migrated.party.foraging.powerRule,1);assert.deepEqual(migrated.party.foraging.counts,F.drawCounts(before,1));
    assert.deepEqual(migrated.party.foraging.power,expected);assert.deepEqual(F.powerDeposit(migrated),expected);
    assert.deepEqual(migrated.bag,before.bag);assert.deepEqual(migrated.party.ingredients,before.party.ingredients);assert.deepEqual(migrated.party.journey.materials,before.party.journey.materials);
    assert.equal(F.specs(migrated).filter(e=>e.kind==='power').length,claimed.length?0:1);
    assert.deepEqual(C.validateSave(migrated),migrated);assert.deepEqual(r,before);
    const claimedRun=claimed.length?migrated:F.claim(migrated,'foraging:99:power:0').run;
    assert.ok(claimedRun);assert.equal(F.claim(claimedRun,'foraging:99:power:0').ok,false);
    assert.deepEqual(F.specs(C.validateSave(JSON.stringify(claimedRun))).filter(e=>e.kind==='power'),[]);
  }
});
test('v1 harvest receipts for all 149 floors retain every original herb, ore and power allocation',()=>{
  for(const floor of [...Array.from({length:99},(_,i)=>i+1),...Array.from({length:50},(_,i)=>-i-1)])for(const seed of [1,31,0xffffffff]){
    const context={floor,seed},amount=F.drawCounts(context,1),power=F.drawPowerDeposit(context,1);
    const claimed=['herb','ore'].flatMap(kind=>Array.from({length:amount[kind]},(_,index)=>`foraging:${floor}:${kind}:${index}`));
    if(power)claimed.push(`foraging:${floor}:power:0`);
    const old={version:1,floor,seed,claimed},copy=structuredClone(old),migrated=F.validate(old,floor,seed);
    assert.ok(migrated,`Legacy floor ${floor}/${seed}`);assert.equal(migrated.version,4);assert.equal(migrated.harvestRule,1);assert.deepEqual(migrated.counts,amount);assert.equal(migrated.powerRule,1);assert.deepEqual(migrated.power,power);assert.deepEqual(migrated.claimed,claimed);
    assert.deepEqual(F.specs({...context,party:{foraging:migrated}}),[]);assert.deepEqual(F.validate(migrated,floor,seed),migrated);assert.deepEqual(old,copy);
  }
});
test('v2 provisional saves retain original herb/ore counts and their saved legacy, ten-point or twenty-point power snapshot',()=>{
  for(const floor of floors)for(const seed of [1,31,0xffffffff])for(const rule of [1,2,3]){
    const context={floor,seed},amount=F.drawCounts(context,1),power=F.drawPowerDeposit(context,rule),claimed=['herb','ore'].flatMap(kind=>Array.from({length:amount[kind]},(_,index)=>`foraging:${floor}:${kind}:${index}`));
    if(power)claimed.push(`foraging:${floor}:power:0`);
    const old={version:2,floor,seed,claimed,powerRule:rule===1?1:2,power},copy=structuredClone(old),migrated=F.validate(old,floor,seed);
    assert.ok(migrated,`Draft v2 ${floor}/${seed}/${rule}`);assert.equal(migrated.version,4);assert.equal(migrated.harvestRule,1);assert.deepEqual(migrated.counts,amount);assert.deepEqual(migrated.power,power);assert.deepEqual(migrated.claimed,claimed);
    assert.deepEqual(F.counts({...context,party:{foraging:migrated}}),amount);assert.deepEqual(F.specs({...context,party:{foraging:migrated}}),[]);assert.deepEqual(F.validate(migrated,floor,seed),migrated);assert.deepEqual(old,copy);
  }
});
test('v3 snapshots on all 149 floors preserve historical counts, full stone clusters and both claimed and remaining slots',()=>{
  const quantities=new Set(),maze={size:9,hWalls:Array.from({length:8},()=>Array(9).fill(true)),vWalls:Array.from({length:9},()=>Array(8).fill(true))};
  for(const floor of floors)for(const seed of [1,31,0xffffffff])for(const harvestRule of [1,2])for(const powerRule of [1,2,3]){
    const context={floor,seed},amount=F.drawCounts(context,harvestRule),power=F.drawPowerDeposit(context,powerRule);
    if(power)quantities.add(power.quantity);
    const ids=['herb','ore'].flatMap(kind=>Array.from({length:amount[kind]},(_,index)=>`foraging:${floor}:${kind}:${index}`));if(power)ids.push(`foraging:${floor}:power:0`);
    const claimed=ids.filter((_,i)=>i%2===0),old={version:3,floor,seed,claimed,harvestRule,counts:amount,powerRule,power},before=structuredClone(old),run={...context,party:{foraging:old}},beforeSpecs=F.specs(run),beforePlan=F.plan(run,maze),migrated=F.validate(old,floor,seed);
    assert.ok(migrated,`v3 ${floor}/${seed}/${harvestRule}/${powerRule}`);assert.equal(migrated.version,4);assert.equal(migrated.harvestRule,harvestRule);assert.equal(migrated.powerRule,powerRule);assert.deepEqual(migrated.counts,amount);assert.deepEqual(migrated.power,power);assert.deepEqual(migrated.claimed,claimed);
    const restored={...context,party:{foraging:migrated}};assert.deepEqual(F.counts(restored),amount);assert.deepEqual(F.powerDeposit(restored),power);assert.deepEqual(F.specs(restored),beforeSpecs);assert.deepEqual(F.plan(restored,maze),beforePlan);assert.deepEqual(F.validate(migrated,floor,seed),migrated);assert.deepEqual(old,before);
    assert.deepEqual(F.specs(restored).map(entry=>entry.id),ids.filter(id=>!claimed.includes(id)));
  }
  assert.deepEqual([...quantities].sort(),[1,2,3]);
});
test('v3 production clusters still collect atomically at their original quantity and never respawn',()=>{
  let r;for(let seed=1;seed<4096;seed++)if(F.drawPowerDeposit({floor:99,seed},3)?.quantity===3){r=fresh(seed);break;}assert.ok(r);
  const snapshot={version:3,floor:r.floor,seed:r.seed,claimed:[],harvestRule:2,counts:F.drawCounts(r,2),powerRule:3,power:F.drawPowerDeposit(r,3)};r.party.foraging=snapshot;
  const entry=F.specs(r).find(e=>e.kind==='power');assert.ok(entry);assert.equal(entry.quantity,3);r.bag[entry.key]=98;const before=structuredClone(r);
  const blocked=F.claim(r,entry.id);assert.equal(blocked.ok,false);assert.equal(blocked.run,r);assert.deepEqual(r,before);assert.equal(F.claim(r,entry.id,r.revision-1).ok,false);
  r.bag[entry.key]=96;const collected=F.claim(r,entry.id);assert.ok(collected.ok,collected.message);assert.equal(collected.run.bag[entry.key],99);assert.equal(collected.run.party.foraging.version,4);assert.equal(collected.run.party.foraging.powerRule,3);assert.deepEqual(collected.run.party.foraging.power,snapshot.power);
  let saved=collected.run;for(let i=0;i<10;i++){saved=C.validateSave(JSON.stringify(saved));assert.ok(saved);assert.equal(F.claim(saved,entry.id).ok,false);assert.ok(!F.specs(saved).some(e=>e.id===entry.id));assert.ok(!F.plan(saved,{size:9}).some(e=>e.id===entry.id));assert.equal(saved.bag[entry.key],99);}
});
test('historical v3 snapshots cannot be forged to use the new harvest or single-stone rule',()=>{
  const at={floor:99,seed:31},old={version:3,...at,claimed:[],harvestRule:2,counts:F.drawCounts(at,2),powerRule:3,power:F.drawPowerDeposit(at,3)};
  assert.ok(F.validate(old,at.floor,at.seed));
  for(const patch of [{harvestRule:3,counts:F.drawCounts(at,3)},{powerRule:4,power:F.drawPowerDeposit(at,4)}])assert.equal(F.validate({...old,...patch},at.floor,at.seed),null);
});
test('new floor power snapshots are seeded, bounded, independently copied and reject forged grade/quantity changes',()=>{
  let r;for(let seed=1;seed<512;seed++)if(F.powerDeposit({floor:99,seed})){r=fresh(seed);break;}assert.ok(r);
  const state=r.party.foraging;assert.equal(state.version,4);assert.equal(state.harvestRule,3);assert.equal(state.powerRule,4);assert.deepEqual(state.counts,F.drawCounts(r));assert.deepEqual(state.power,F.powerDeposit(r));
  const copy=F.validate(state,r.floor,r.seed);copy.power.quantity=99;assert.notEqual(state.power.quantity,99);assert.equal(F.validate(copy,r.floor,r.seed),null);
  for(const change of [s=>s.powerRule=5,s=>s.power=null,s=>s.power.key='power_fake',s=>s.power.tier=6,s=>s.power.quantity=0,s=>s.power.quantity=2,s=>delete s.power]){
    const altered=structuredClone(r);change(altered.party.foraging);assert.equal(C.validateSave(altered),null);
  }
  const descended=C.descend(r,r.revision);assert.ok(descended.ok,descended.message);
  assert.equal(descended.run.party.foraging.harvestRule,3);assert.equal(descended.run.party.foraging.powerRule,4);assert.deepEqual(descended.run.party.foraging,F.fresh(descended.run));
});
test('each new floor has at most one wall-side power deposit containing exactly one stone',()=>{
  for(let seed=1;seed<=120;seed++){
    const r=fresh(seed),maze={size:9,hWalls:Array.from({length:8},()=>Array(9).fill(true)),vWalls:Array.from({length:9},()=>Array(8).fill(true))},d=F.powerDeposit(r),points=F.plan(r,maze).filter(e=>e.kind==='power');
    assert.equal(points.length,d?1:0);if(!d)continue;
    assert.equal(d.quantity,1);assert.equal(points[0].quantity,1);assert.equal(points[0].key,d.key);assert.ok(points[0].wallSides.length);assert.equal(points[0].type,'item');
  }
});
test('single-stone collection is atomic, waits at full stock, and cannot refill on reload or layout changes',()=>{
  let r;for(let seed=1;seed<512;seed++)if(F.powerDeposit({floor:99,seed})){r=fresh(seed);break;}assert.ok(r);
  const entry=F.specs(r).find(e=>e.kind==='power');assert.ok(entry);r.bag[entry.key]=99;const raw=JSON.stringify(r);
  assert.equal(F.claim(r,entry.id).ok,false);assert.equal(JSON.stringify(r),raw);assert.equal(F.claim(r,entry.id,r.revision-1).ok,false);
  r.bag[entry.key]=98;const before=structuredClone(r),collected=F.claim(r,entry.id);assert.ok(collected.ok,collected.message);assert.deepEqual(r,before);assert.equal(collected.run.bag[entry.key],99);assert.equal(collected.run.revision,r.revision+1);assert.equal(collected.effect.pickup.quantity,1);
  for(let i=0;i<5;i++){const saved=C.validateSave(JSON.stringify(collected.run));assert.ok(saved);assert.equal(F.claim(saved,entry.id).ok,false);assert.ok(!F.specs(saved).some(e=>e.kind==='power'));assert.ok(!F.plan(saved,{size:9}).some(e=>e.kind==='power'));}
});
test('grocery sells only 25-percent stones; high tiers cannot be bought through either purchase entry',()=>{
  let r;for(let seed=1;seed<512;seed++)if(E.merchantOffers(99,seed,true).some(m=>m.id==='suHe')){r=fresh(seed);break;}assert.ok(r);r.coins=999;
  const shop=E.merchantOffers(r.floor,r.seed,true).find(m=>m.id==='suHe');assert.ok(shop.supplies.includes('power_glimmer'));
  assert.ok(!shop.supplies.includes('power_starlight')&&!shop.supplies.includes('power_sunheart'));
  const purchased=E.buySupply(r,'suHe','power_glimmer');assert.ok(purchased.ok,purchased.message);assert.equal(purchased.run.bag.power_glimmer,1);
  for(const id of ['power_starlight','power_sunheart']){assert.equal(E.buySupply(r,'suHe',id).ok,false);assert.equal(C.buy(r,id).ok,false);}
});
