import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {grocerySeed,groceryShop} from './grocery-fixtures.mjs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),E=require('../story/tower-encounters.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-lighting-core.js'),M=require('../story/tower-materials.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js');
function fresh(floor=99,seed=grocerySeed(floor)){
  let r=H.enable(P.enable(C.newRun({seed}),'mage').run).run;
  if(floor<0){r.floor=1;r.floorsCleared=99;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);r.chronicle.ending='release';P.advance(r);r=C.startUnderworld(r).run;}
  r.floor=floor;r.floorsCleared=floor>0?99-floor:99+(-floor-1);r.chronicle=N.newChronicle(floor<0?1:floor);r.adventure=E.newAdventure();P.advance(r);r.coins=999;assert.ok(C.validateSave(r));return r;
}
function originalProfessionals(floor,seed){
  let state=(seed^Math.imul(floor,7919)^0x24181)>>>0;
  const rng=()=>{state=(state+0x6d2b79f5)>>>0;let n=Math.imul(state^state>>>15,state|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
  const ids=['tieLing','jinHe','lanZhou'];for(let i=ids.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids.slice(0,floor<70&&rng()<.45?2:1);
}
test('independent grocery draw keeps all three professional merchant identities and equipment streams unchanged',()=>{
  for(const floor of [99,92,69,30,1,-1,-41,-50])for(let seed=1;seed<=40;seed++)for(const modern of [false,true]){
    const shops=E.merchantOffers(floor,seed,modern),pro=shops.filter(m=>m.id!=='suHe');assert.deepEqual(pro.map(m=>m.id),originalProfessionals(floor,seed));
    for(const shop of pro){assert.deepEqual(shop.supplies,[]);const kinds=modern?H.gearPool(floor).filter(k=>E.merchantHandles(shop.id,k)):E.MERCHANTS[shop.id].equipmentKinds;assert.deepEqual(shop.equipmentKinds,[...kinds]);for(const x of shop.gear)assert.deepEqual(x.gear,C.createGear(x.kind,floor,seed,`shop:${floor}:${shop.id}:${x.kind}`,false));}
    assert.deepEqual(E.merchantOffers(floor,seed,modern),shops);
  }
});
test('grocery appears around forty percent independently and sells all purchasable supplies but no higher fuel grades, gear or forge services',()=>{
  let count=0;for(let seed=1;seed<=2000;seed++){const m=E.merchantOffers(92,seed,true).find(m=>m.id==='suHe');if(!m)continue;count++;assert.deepEqual(m.supplies,Object.keys(C.ITEMS).filter(k=>C.ITEMS[k].buyPrice>0));assert.ok(m.supplies.includes('power_glimmer'));assert.ok(!m.supplies.includes('power_starlight'));assert.ok(!m.supplies.includes('power_sunheart'));assert.deepEqual(m.gear,[]);assert.equal(m.ingredientOffers.length,5);}
  assert.ok(count>720&&count<880,count);const r=fresh();assert.equal(E.serviceContext(r,'suHe'),null);assert.equal(E.merchantHandles('suHe','longsword'),false);assert.equal(E.buyMerchantGear(r,'suHe','longsword').ok,false);
});
test('each shelf has four common ingredients and one geographically correct limited specialty',()=>{
  const underground=new Set();for(const floor of [92,-1])for(let seed=1;seed<=1000;seed++)for(const o of E.groceryOffers({floor,seed})){
    assert.ok(o.stock>=1&&o.stock<=5);assert.equal(o.remaining,o.stock);assert.equal(o.purchased,0);assert.equal(o.name,M.INGREDIENTS[o.ingredientId]);
    if(!o.specialty){assert.ok(E.GROCERY.commonIngredients.includes(o.ingredientId));assert.equal(o.sourceFloor,null);assert.equal(o.price,2);}
    else{assert.equal(o.ingredientId,M.signature(o.sourceFloor));assert.equal(o.sourceName,M.ecology(o.sourceFloor).name);assert.equal(o.price,5);if(floor>0)assert.ok(o.sourceFloor>0);else underground.add(o.sourceFloor<0?'below':'above');}
    assert.ok(!['meat','shell'].includes(o.ingredientId));
  }
  assert.deepEqual([...underground].sort(),['above','below']);const rare=E.groceryOffers({floor:92,seed:37}).at(-1);assert.equal(rare.sourceFloor,30);assert.equal(rare.ingredientId,'frostberry');assert.equal(rare.stock,2);
});
test('ingredient purchase charges exact price, persists real transactions and stock never refreshes on reload or maze shifts',()=>{
  let r=fresh(92,37);const o=E.groceryOffers(r).at(-1),before=structuredClone(r),n=r.party.ingredients[o.ingredientId];const bought=E.buyIngredient(r,'suHe',o.id,o.stock,r.revision);assert.ok(bought.ok,bought.message);assert.deepEqual(r,before);r=bought.run;
  assert.equal(r.coins,before.coins-o.price*o.stock);assert.equal(r.party.ingredients[o.ingredientId],n+o.stock);assert.equal(r.adventure.groceryPurchases[o.id],o.stock);
  for(let i=0;i<3;i++){r=C.tickEffects(r,1).run;r=C.validateSave(JSON.stringify(r));assert.ok(r);r.party.reinforcements.shifts++;assert.equal(E.groceryOffers(r).at(-1).remaining,0);assert.equal(E.buyIngredient(r,'suHe',o.id).ok,false);}
  const next=C.descend(r);assert.ok(next.ok,next.message);assert.deepEqual(next.run.adventure.groceryPurchases,{});assert.equal(E.buyIngredient(next.run,'suHe',o.id).ok,false);
});
test('all five ingredient stock counters remain independent and each shelf can sell exactly its bounded stock',()=>{
  let r=fresh();for(const offer of E.groceryOffers(r)){const before=r.party.ingredients[offer.ingredientId],result=E.buyIngredient(r,'suHe',offer.id,offer.stock);assert.ok(result.ok,result.message);r=result.run;assert.equal(r.party.ingredients[offer.ingredientId],before+offer.stock);assert.equal(E.buyIngredient(r,'suHe',offer.id).ok,false);assert.ok(C.validateSave(r));}
  assert.equal(Object.keys(r.adventure.groceryPurchases).length,5);assert.ok(E.groceryOffers(r).every(o=>o.remaining===0));
});
test('stale, absent, wrong merchant, exhausted, malformed, full and unaffordable purchases are atomic',()=>{
  const r=fresh(),o=E.groceryOffers(r)[0];for(const [id,offer,n,rev]of [['tieLing',o.id,1,r.revision],['suHe','grocery:98:common:root',1,r.revision],['suHe',o.id,0,r.revision],['suHe',o.id,6,r.revision],['suHe',o.id,1.5,r.revision],['suHe',o.id,1,r.revision-1]]){const before=JSON.stringify(r),result=E.buyIngredient(r,id,offer,n,rev);assert.equal(result.ok,false);assert.equal(JSON.stringify(r),before);assert.strictEqual(result.run,r);}
  for(const mutate of [n=>n.coins=0,n=>n.party.ingredients[o.ingredientId]=99]){const n=structuredClone(r);mutate(n);const before=JSON.stringify(n);assert.equal(E.buyIngredient(n,'suHe',o.id).ok,false);assert.equal(JSON.stringify(n),before);}
  let absent=1;while(E.groceryOffers({floor:99,seed:absent}).length)absent++;const missing=fresh(99,absent);assert.equal(E.buyIngredient(missing,'suHe',o.id).ok,false);
});
test('legacy saves migrate empty counters once, strict purchase validation rejects fabricated or oversold shelf records',()=>{
  const r=fresh(92,37);delete r.adventure.groceryPurchases;delete r.party.light.bought.suHe;r.party.light.bought.tieLing=2;const loaded=C.validateSave(r);assert.ok(loaded);assert.deepEqual(loaded.adventure.groceryPurchases,{});assert.equal(loaded.party.light.bought.tieLing,2);assert.equal(loaded.party.light.bought.suHe,0);
  const o=E.groceryOffers(loaded).at(-1);for(const record of [null,[],{'grocery:91:common:root':1},{'grocery:092:common:root':1},{'grocery:92:common:meat':1},{'grocery:92:special:-1:deeproot':1},{'grocery:92:special:30:frostberry':3},{'grocery:92:special:31:frostberry':1},{[o.id]:-1},{[o.id]:.5},JSON.parse('{"__proto__":1}')]){const bad=structuredClone(loaded);bad.adventure.groceryPurchases=record;assert.equal(C.validateSave(bad),null,JSON.stringify(record));}
  assert.deepEqual(C.validateSave(loaded),loaded);
});
test('grocery supplies have unlimited merchant stock but obey backpack caps and exact original prices',()=>{
  let r=fresh();const shop=groceryShop(r);for(const id of shop.supplies){const quantity=id==='arrow'?10:1,previous=r.bag[id],coins=r.coins,result=E.buySupply(r,'suHe',id,quantity,r.revision);assert.ok(result.ok,result.message);r=result.run;assert.equal(r.bag[id],previous+quantity);assert.equal(r.coins,coins-C.supplyPrice(id,quantity));}
  for(const id of ['tieLing','jinHe','lanZhou'])for(const item of shop.supplies){assert.equal(E.buySupply(r,id,item).ok,false);assert.equal(E.sellSupply(r,id,item).ok,false);}
  const before=r.adventure.groceryPurchases;assert.deepEqual(before,{});assert.equal(E.sellSupply(r,'suHe','arrow').ok,false);assert.ok(E.sellSupply(r,'suHe','heal').ok);
});
test('only the grocery sells three torches for four coins each, preserving historical counters without offering professional stock',()=>{
  let r=fresh();r.party.light.bought.tieLing=1;for(const shop of E.merchantOffers(r.floor,r.seed).filter(m=>m.id!=='suHe'))assert.equal(L.buy(r,shop.id).ok,false);
  const coins=r.coins;for(let i=0;i<3;i++){const result=L.buy(r,'suHe',r.revision);assert.ok(result.ok,result.message);r=C.validateSave(JSON.stringify(result.run));}assert.equal(r.coins,coins-12);assert.equal(r.party.light.bought.suHe,3);assert.equal(r.party.light.bought.tieLing,1);assert.equal(L.buy(r,'suHe').ok,false);
});
test('side dungeons cannot invoke a hidden main-floor grocery; existing stock returns unchanged',()=>{
  let r,offer;for(let seed=1;seed<300;seed++){const candidate=fresh(95,seed);offer=D.offer(candidate);if(offer&&groceryShop(candidate)){r=candidate;break;}}assert.ok(r);
  const item=E.groceryOffers(r)[0];r=E.buyIngredient(r,'suHe',item.id).run;const saved=structuredClone(r.adventure.groceryPurchases);r=D.discover(r).run;r=D.enter(r,offer.id,{x:0,y:0,shiftLeft:100}).run;assert.ok(r.expedition.active);assert.deepEqual(E.groceryOffers(r),[]);assert.equal(E.buyIngredient(r,'suHe',item.id).ok,false);assert.equal(E.buySupply(r,'suHe','heal').ok,false);assert.equal(L.buy(r,'suHe').ok,false);assert.deepEqual(r.adventure.groceryPurchases,saved);
});
