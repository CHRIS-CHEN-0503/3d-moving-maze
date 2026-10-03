import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),F=require('../story/tower-foraging.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-encounters.js');
const fresh=seed=>H.enable(P.enable(C.newRun({seed,name:'動力石採集'}),'robot').run).run;
test('power deposits follow herb region probabilities, independently of existing herb and ore draws',()=>{
  for(const [floor,profile]of [[99,'neutral'],[89,'suitable'],[39,'unsuitable']]){
    const totals=[0,0,0,0],quantities=new Set();
    for(let seed=1;seed<=12000;seed++){const run={floor,seed},d=F.powerDeposit(run);totals[d?.tier||0]++;if(d){quantities.add(d.quantity);assert.equal(d.key,F.POWER_STONES[d.tier-1]);assert.deepEqual(F.powerDeposit(run),d);}}
    for(let tier=0;tier<=3;tier++)assert.ok(Math.abs(totals[tier]/12000-F.PROFILES[profile][tier]/100)<.02);
    assert.deepEqual([...quantities].sort(),[1,2,3]);
  }
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
