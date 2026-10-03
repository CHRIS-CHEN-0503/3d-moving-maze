import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-encounters.js');
const fresh=()=>H.enable(P.enable(C.newRun({seed:1}),'archer').run).run;
test('arrow bundle prices are integer coins, ten arrows for one coin; other supplies unchanged',()=>{
  for(const [n,cost]of [[1,1],[4,1],[10,1],[11,2],[20,2],[99,10],[100,10],[3000,300]])assert.equal(C.supplyPrice('arrow',n),cost);
  for(const n of [0,-1,3001,1.5,NaN])assert.equal(C.supplyPrice('arrow',n),null);
  assert.equal(C.supplyPrice('coin'),null);assert.equal(C.supplyPrice('__proto__'),null);
  for(const [id,item]of Object.entries(C.ITEMS).filter(([id])=>!['arrow','coin'].includes(id)))assert.equal(C.supplyPrice(id,3),item.buyPrice*3);
});
test('merchant arrow bundle and nearly-full top-up use the same quote and persist without fractions',()=>{
  let r=fresh();r.coins=2;r.bag.arrow=86;const shop=E.merchantOffers(r.floor,r.seed,true).find(m=>m.id==='suHe');
  let result=E.buySupply(r,shop.id,'arrow',10,r.revision);assert.ok(result.ok,result.message);r=result.run;assert.equal(r.coins,1);assert.equal(r.bag.arrow,96);
  assert.equal(E.buySupply(r,shop.id,'arrow',10,r.revision).ok,false);
  result=E.buySupply(r,shop.id,'arrow',4,r.revision);assert.ok(result.ok,result.message);r=result.run;assert.equal(r.coins,0);assert.equal(r.bag.arrow,100);assert.deepEqual(C.validateSave(r),r);
  const before=JSON.stringify(r);assert.equal(E.buySupply(r,shop.id,'arrow',1,r.revision).ok,false);assert.equal(JSON.stringify(r),before);
});
test('generic purchase path agrees, and insufficient coins, stale quote or wrong merchant does not mutate',()=>{
  const r=fresh();r.coins=1;const shop=E.merchantOffers(r.floor,r.seed,true).find(m=>m.id==='suHe');
  const direct=C.buy(r,'arrow',10,r.revision);assert.ok(direct.ok);assert.equal(direct.run.coins,0);assert.equal(direct.run.bag.arrow,r.bag.arrow+10);
  const before=JSON.stringify(r);for(const result of [E.buySupply(r,shop.id,'arrow',20,r.revision),E.buySupply(r,shop.id,'arrow',10,r.revision-1),E.buySupply(r,'unknown','arrow',10,r.revision)])assert.equal(result.ok,false);assert.equal(JSON.stringify(r),before);
});
