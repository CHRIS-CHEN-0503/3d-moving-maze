import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),F=require('../story/tower-foraging.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-encounters.js');
const fresh=seed=>H.enable(P.enable(C.newRun({seed,name:'動力石採集'}),'robot').run).run;
test('power absence is 50/70/90 percent with the confirmed twenty-point environment modifier and unchanged grade ratios',()=>{
  assert.equal(F.POWER_BASE_APPEARANCE,30);assert.equal(F.POWER_ENVIRONMENT_BONUS,20);
  assert.deepEqual(F.POWER_APPEARANCE,{suitable:50,neutral:30,unsuitable:10});
  assert.deepEqual(Object.fromEntries(Object.entries(F.POWER_PROFILES).map(([name,weights])=>[name,weights[0]])),{suitable:50,neutral:70,unsuitable:90});
  assert.deepEqual(F.POWER_PROFILES,F.PROFILES);
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
    assert.deepEqual([...quantities].sort(),[1,2,3]);
  }
});
test('power draws remain independent of seeded herb and mineral draws under the shared new appearance rule',()=>{
  for(const floor of [...Array.from({length:99},(_,i)=>i+1),...Array.from({length:50},(_,i)=>-i-1)])for(const seed of [1,31,9987,0xffffffff]){
    const run={floor,seed},before=F.drawCounts(run);
    F.powerDeposit(run);assert.deepEqual(F.counts(run),before);
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
    assert.equal(migrated.party.foraging.version,3);assert.equal(migrated.party.foraging.harvestRule,1);assert.equal(migrated.party.foraging.powerRule,1);assert.deepEqual(migrated.party.foraging.counts,F.drawCounts(before,1));
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
    assert.ok(migrated,`Legacy floor ${floor}/${seed}`);assert.equal(migrated.version,3);assert.equal(migrated.harvestRule,1);assert.deepEqual(migrated.counts,amount);assert.equal(migrated.powerRule,1);assert.deepEqual(migrated.power,power);assert.deepEqual(migrated.claimed,claimed);
    assert.deepEqual(F.specs({...context,party:{foraging:migrated}}),[]);assert.deepEqual(F.validate(migrated,floor,seed),migrated);assert.deepEqual(old,copy);
  }
});
test('v2 provisional saves retain original herb/ore counts and their saved legacy, ten-point or twenty-point power snapshot',()=>{
  for(const floor of [99,89,39])for(const seed of [1,31,1024])for(const rule of [1,2,3]){
    const context={floor,seed},amount=F.drawCounts(context,1),power=F.drawPowerDeposit(context,rule),claimed=['herb','ore'].flatMap(kind=>Array.from({length:amount[kind]},(_,index)=>`foraging:${floor}:${kind}:${index}`));
    if(power)claimed.push(`foraging:${floor}:power:0`);
    const old={version:2,floor,seed,claimed,powerRule:rule===1?1:2,power},copy=structuredClone(old),migrated=F.validate(old,floor,seed);
    assert.ok(migrated,`Draft v2 ${floor}/${seed}/${rule}`);assert.equal(migrated.version,3);assert.equal(migrated.harvestRule,1);assert.deepEqual(migrated.counts,amount);assert.deepEqual(migrated.power,power);assert.deepEqual(migrated.claimed,claimed);
    assert.deepEqual(F.counts({...context,party:{foraging:migrated}}),amount);assert.deepEqual(F.specs({...context,party:{foraging:migrated}}),[]);assert.deepEqual(F.validate(migrated,floor,seed),migrated);assert.deepEqual(old,copy);
  }
});
test('new floor power snapshots are seeded, bounded, independently copied and reject forged grade/quantity changes',()=>{
  let r;for(let seed=1;seed<512;seed++)if(F.powerDeposit({floor:99,seed})){r=fresh(seed);break;}assert.ok(r);
  const state=r.party.foraging;assert.equal(state.version,3);assert.equal(state.harvestRule,2);assert.equal(state.powerRule,3);assert.deepEqual(state.counts,F.drawCounts(r));assert.deepEqual(state.power,F.powerDeposit(r));
  const copy=F.validate(state,r.floor,r.seed);copy.power.quantity=99;assert.notEqual(state.power.quantity,99);assert.equal(F.validate(copy,r.floor,r.seed),null);
  for(const change of [s=>s.powerRule=4,s=>s.power=null,s=>s.power.key='power_fake',s=>s.power.tier=6,s=>s.power.quantity=0,s=>delete s.power]){
    const altered=structuredClone(r);change(altered.party.foraging);assert.equal(C.validateSave(altered),null);
  }
  const descended=C.descend(r,r.revision);assert.ok(descended.ok,descended.message);
  assert.equal(descended.run.party.foraging.harvestRule,2);assert.equal(descended.run.party.foraging.powerRule,3);assert.deepEqual(descended.run.party.foraging,F.fresh(descended.run));
});
test('one wall-side cluster holds 1–3 same-grade stones and never becomes several scattered points',()=>{
  for(let seed=1;seed<=120;seed++){
    const r=fresh(seed),maze={size:9,hWalls:Array.from({length:8},()=>Array(9).fill(true)),vWalls:Array.from({length:9},()=>Array(8).fill(true))},d=F.powerDeposit(r),points=F.plan(r,maze).filter(e=>e.kind==='power');
    assert.equal(points.length,d?1:0);if(!d)continue;
    assert.equal(points[0].quantity,d.quantity);assert.equal(points[0].key,d.key);assert.ok(points[0].wallSides.length);assert.equal(points[0].type,'item');
  }
});
test('cluster collection is atomic, preserves a full cluster on insufficient space, and cannot refill on reload or layout changes',()=>{
  let r;for(let seed=1;seed<512;seed++)if(F.powerDeposit({floor:99,seed})?.quantity===3){r=fresh(seed);break;}assert.ok(r);
  const entry=F.specs(r).find(e=>e.kind==='power');assert.ok(entry);r.bag[entry.key]=98;const raw=JSON.stringify(r);
  assert.equal(F.claim(r,entry.id).ok,false);assert.equal(JSON.stringify(r),raw);assert.equal(F.claim(r,entry.id,r.revision-1).ok,false);
  r.bag[entry.key]=96;const collected=F.claim(r,entry.id);assert.ok(collected.ok,collected.message);assert.equal(collected.run.bag[entry.key],99);
  for(let i=0;i<5;i++){const saved=C.validateSave(JSON.stringify(collected.run));assert.ok(saved);assert.equal(F.claim(saved,entry.id).ok,false);assert.ok(!F.specs(saved).some(e=>e.kind==='power'));assert.ok(!F.plan(saved,{size:9}).some(e=>e.kind==='power'));}
});
test('grocery sells only 25-percent stones; high tiers cannot be bought through either purchase entry',()=>{
  let r;for(let seed=1;seed<512;seed++)if(E.merchantOffers(99,seed,true).some(m=>m.id==='suHe')){r=fresh(seed);break;}assert.ok(r);r.coins=999;
  const shop=E.merchantOffers(r.floor,r.seed,true).find(m=>m.id==='suHe');assert.ok(shop.supplies.includes('power_glimmer'));
  assert.ok(!shop.supplies.includes('power_starlight')&&!shop.supplies.includes('power_sunheart'));
  const purchased=E.buySupply(r,'suHe','power_glimmer');assert.ok(purchased.ok,purchased.message);assert.equal(purchased.run.bag.power_glimmer,1);
  for(const id of ['power_starlight','power_sunheart']){assert.equal(E.buySupply(r,'suHe',id).ok,false);assert.equal(C.buy(r,id).ok,false);}
});
