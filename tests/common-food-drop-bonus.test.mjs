import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-loot.js');
function fresh(seed){return H.enable(P.enable(C.newRun({seed}),'swordsman','male').run).run;}
test('only the four common food candidates gain five percentage points',()=>{
  assert.deepEqual(L.COMMON_FOOD,['root','mushroom','herb','nectar']);
  for(const key of L.COMMON_FOOD)assert.equal(L.chance({type:'ingredient',key,rarity:'common'}),25);
  for(const key of ['meat','shell','cloudcap','sunseed','emberpepper'])assert.equal(L.chance({type:'ingredient',key,rarity:'common'}),20);
  for(const type of ['item','fuel','material','gear'])for(const rarity of Object.keys(L.CHANCES))assert.equal(L.chance({type,key:'herb',rarity}),L.CHANCES[rarity]);
  assert.equal(L.COMMON_FOOD_BONUS,5);assert.ok(Object.isFrozen(L.COMMON_FOOD));
});
test('real seeded kills add only the 20-to-24 common food rolls and remain one-shot across saving',()=>{
  let additions=0,ordinary=0;
  for(let seed=1;seed<=1200;seed++){
    const run=fresh(seed),spec=P.monsterSpecs(run)[0],prefix=run.floor+':'+spec.id,pool=L.pool(run,spec),pick=pool[L.hash(seed,prefix+':kind')%pool.length],roll=L.hash(seed,prefix+':item')%100;
    run.defeatedMonsters.push(spec.id);const out=L.recordKill(run,spec,{x:1,y:1});
    assert.equal(out.length,roll<L.chance(pick)?1:0);
    if(out.length){assert.equal(out[0].key,pick.key);assert.equal(out[0].quantity,pick.quantity);ordinary++;}
    if(roll>=20&&roll<25&&pick.type==='ingredient'&&L.COMMON_FOOD.includes(pick.key)){assert.equal(out.length,1);additions++;}
    assert.deepEqual(L.recordKill(run,spec),[]);const saved=C.validateSave(run);assert.ok(saved);assert.deepEqual(L.recordKill(saved,spec),[]);assert.deepEqual(saved.party.loot.entries,out);
  }
  assert.ok(additions>0);assert.ok(ordinary>additions);
});
