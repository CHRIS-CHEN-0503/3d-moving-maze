import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),E=require('../story/tower-encounters.js');
function standalone(){const env=vm.createContext({});for(const file of ['story-core','tower-narrative','tower-side-stories','tower-dungeons'])vm.runInContext(readFileSync(new URL('../story/'+file+'.js',import.meta.url),'utf8'),env);return env;}
test('standalone core still validates legacy saves with a missing or empty grocery ledger, without a merchant dependency',()=>{
  const env=standalone(),C=env.TowerCore,r=C.newRun({seed:1});assert.equal(env.TowerEncounters,undefined);
  for(const missing of [true,false]){if(missing)delete r.adventure.groceryPurchases;else r.adventure.groceryPurchases={};const restored=C.validateSave(JSON.stringify(r));assert.ok(restored);assert.equal(JSON.stringify(restored.adventure.groceryPurchases),'{}');assert.equal(restored.floor,99);assert.equal(JSON.stringify(C.validateSave(restored)),JSON.stringify(restored));}
});
test('missing merchant validation rejects nonempty and malformed ledgers instead of accepting them or silently clearing them',()=>{
  const env=standalone(),C=env.TowerCore,r=C.newRun({seed:1});
  for(const ledger of [{'grocery:99:common:root':0},{'grocery:99:common:root':1},{unknown:1},null,[],0,'']){r.adventure.groceryPurchases=ledger;const before=JSON.stringify(r);assert.equal(C.validateSave(r),null,JSON.stringify(ledger));assert.equal(JSON.stringify(r),before);}
});
test('when the merchant module is present core always checks real floor seed and stock, including zero-count forged offers',()=>{
  const env=standalone(),C=env.TowerCore;let seed=1;while(!E.groceryOffers({floor:99,seed}).length)seed++;const r=C.newRun({seed}),o=E.groceryOffers(r)[0];r.adventure.groceryPurchases={[o.id]:1};
  assert.equal(C.validateSave(r),null,'genuine nonempty purchases also need their validator');env.TowerEncounters=E;assert.ok(C.validateSave(r));
  for(const ledger of [{[o.id]:o.stock+1},{[o.id.replace(':99:',':98:')]:1},{'grocery:99:common:meat':0}]){r.adventure.groceryPurchases=ledger;assert.equal(C.validateSave(r),null);}
  r.adventure.groceryPurchases={[o.id]:1};let absentSeed=1;while(E.groceryOffers({floor:99,seed:absentSeed}).length)absentSeed++;r.seed=absentSeed;assert.equal(C.validateSave(r),null);
});
