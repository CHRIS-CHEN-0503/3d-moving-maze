import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-gear-tiers.js');
test('all eighteen original equipment families gain individually named fourth and fifth grades',()=>{
  assert.equal(H.BASE_GEAR.length,18);assert.equal(Object.keys(G.TIER_NAMES).length,18);const before=JSON.stringify(H.BASE_GEAR),names=[];
  for(const base of H.BASE_GEAR)for(const tier of [4,5]){
    const d=G.definition(base,tier),c=G.TIERS[tier];names.push(d.name);assert.equal(d.kind,base.kind+'_t'+tier);assert.equal(d.baseKind,base.kind);assert.equal(d.tier,tier);assert.equal(d.requiredLevel,tier===4?8:10);assert.deepEqual(d.jobs,base.jobs);assert.equal(d.hands,base.hands);assert.equal(d.interval,base.interval);assert.equal(d.damage,Math.round(base.damage*c.factor));assert.equal(d.magicDamage,Math.round(base.magicDamage*c.factor));assert.equal(d.support,Math.round(base.support*c.factor*100)/100);assert.equal(d.defense,base.defense?Math.max(Math.round(base.defense*c.factor),base.defense+tier-1):0);assert.equal(d.buyPrice,Math.round(base.buyPrice*c.priceFactor));assert.equal(d.durabilityMultiplier,undefined);assert.ok(Object.isFrozen(d));
  }
  assert.equal(new Set(names).size,36);assert.equal(JSON.stringify(H.BASE_GEAR),before);assert.ok(Object.isFrozen(G.TIERS[4]));assert.ok(Object.isFrozen(G.TIER_NAMES.longsword));
});
test('first three equipment grades retain their exact original formulas and identity',()=>{
  for(const base of H.BASE_GEAR)for(const tier of [1,2,3]){
    const d=H.GEAR[H.tierKind(base.kind,tier)],factor=[0,1,1.5,2.1][tier];assert.equal(d.requiredLevel,[0,1,3,5][tier]);assert.equal(d.damage,Math.round(base.damage*factor));assert.equal(d.magicDamage,Math.round(base.magicDamage*factor));assert.equal(d.support,Math.round(base.support*factor*100)/100);assert.equal(d.defense,base.defense?Math.max(Math.round(base.defense*factor),base.defense+tier-1):0);assert.equal(d.buyPrice,Math.round(base.buyPrice*[0,1,2.2,3.6][tier]));assert.equal(d.name,tier===1?base.name:H.TIER_NAMES[base.kind][tier-2]);
  }
});
test('late-grade metadata is dependency-free and rejects unknown kinds or invalid grades',()=>{
  const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-gear-tiers.js',import.meta.url),'utf8'),context);assert.equal(context.TowerGearTiers.definition(H.BASE_GEAR[0],4).name,G.definition(H.BASE_GEAR[0],4).name);
  for(const tier of [undefined,0,1,3,6,4.5,'4',NaN,Infinity])assert.equal(G.definition(H.BASE_GEAR[0],tier),null);
  for(const base of [null,undefined,{}, {kind:'constructor'},{kind:'unknown'}])assert.equal(G.definition(base,4),null);
});
