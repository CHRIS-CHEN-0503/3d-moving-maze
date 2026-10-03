import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),X=require('../story/tower-expedition-core.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),M=require('../story/tower-materials.js');
const legacyIngredients=['root','mushroom','herb','nectar','meat','shell'];
const previousRecipes=['stew','broth','skewer','crab','soup','bento','salad','feast','trail_bread','honey_roast','crab_pot','herbal_platter','root_banquet','mist_broth','ember_crab','gate_feast'];
const fresh=(job='mage')=>H.enable(P.enable(C.newRun({seed:82,name:'地方食譜'}),job).run).run;
function move(run,floor){run.floor=floor;run.floorsCleared=floor>0?99-floor:99+(-floor-1);run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=C.newAdventure();run.expedition=D.newExpedition();if(floor>0)run.chronicle=N.newChronicle(floor);P.advance(run,{reward:false});return run;}
function underground(job='mage'){const run=move(fresh(job),1);run.chronicle.ending='keeper';run.chronicle.clues.push('clue:heart');run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push('monster-11');const ended=C.descend(run);assert.ok(ended.ok);const entered=C.startUnderworld(ended.run);assert.ok(entered.ok);return entered.run;}

test('regional ingredients and minerals start empty, preserve the six original supplies and stay separate',()=>{
  const run=fresh();assert.equal(Object.keys(P.INGREDIENTS).length,21);assert.equal(Object.keys(M.MATERIALS).length,6);assert.deepEqual(P.INGREDIENTS,M.INGREDIENTS);
  assert.deepEqual(Object.fromEntries(legacyIngredients.map(k=>[k,run.party.ingredients[k]])),{root:3,mushroom:2,herb:2,nectar:0,meat:0,shell:1});
  for(const key of Object.keys(P.INGREDIENTS).filter(k=>!legacyIngredients.includes(k)))assert.equal(run.party.ingredients[key],0);
  assert.deepEqual(run.party.journey.materials,Object.fromEntries(Object.keys(M.MATERIALS).map(k=>[k,0])));
  for(const key of Object.keys(M.MATERIALS))assert.equal(Object.hasOwn(run.party.ingredients,key),false,'metals cannot be eaten as a skill ingredient');
  assert.deepEqual(C.validateSave(JSON.stringify(run)),run);
});

test('legacy six-ingredient and sixteen-meal saves migrate losslessly and without gifting resources',()=>{
  const source=move(underground(),-50);source.party.ingredients.meat=9;source.party.ingredients.shell=11;source.party.journey.scrap=17;source.coins=412;
  for(const key of previousRecipes)source.party.meals[key]=2;source.equipment.weapon.forge={trait:'durable',level:1,reserve:1,wearCredit:0};
  const old=structuredClone(source);old.party.ingredients=Object.fromEntries(legacyIngredients.map(k=>[k,old.party.ingredients[k]]));old.party.meals=Object.fromEntries(previousRecipes.map(k=>[k,old.party.meals[k]]));delete old.party.journey.materials;delete old.equipment.weapon.forge.wearCredit;
  const raw=JSON.stringify(old),migrated=C.validateSave(raw);assert.ok(migrated);assert.equal(JSON.stringify(old),raw);assert.deepEqual(migrated,source);
  assert.equal(migrated.party.meals.ember_crab,2,'B21 recipe retains the historical identity');assert.deepEqual(C.validateSave(JSON.stringify(migrated)),migrated);
});

test('malformed regional ingredient and mineral stocks fail closed instead of discarding values',()=>{
  const mutations=[r=>delete r.party.ingredients.root,r=>r.party.ingredients.cloudcap=-1,r=>r.party.ingredients.inkcap=100,r=>r.party.ingredients.sunseed=1.5,r=>r.party.ingredients.starjelly='2',r=>r.party.ingredients.unknown=1,r=>r.party.ingredients=JSON.parse('{"__proto__":1}'),r=>r.party.journey.materials=null,r=>r.party.journey.materials=[],r=>delete r.party.journey.materials.ironore,r=>r.party.journey.materials.ironore=-1,r=>r.party.journey.materials.toughfiber=100,r=>r.party.journey.materials.starore=NaN,r=>r.party.journey.materials.unknown=1,r=>r.party.journey.materials=JSON.parse('{"__proto__":1}')];
  for(const mutate of mutations){const run=fresh();mutate(run);const before=structuredClone(run);assert.equal(C.validateSave(run),null);assert.deepEqual(run,before);}
  const partial=fresh();delete partial.party.ingredients.cloudcap;const saved=C.validateSave(partial);assert.ok(saved);assert.equal(saved.party.ingredients.cloudcap,0,'optional new ingredient slots migrate to zero');
});

test('ingredients, prepared food and new forging materials survive environment changes and the hidden staircase',()=>{
  let run=fresh();Object.keys(run.party.ingredients).forEach((k,i)=>run.party.ingredients[k]=i+1);Object.keys(run.party.journey.materials).forEach((k,i)=>run.party.journey.materials[k]=i+3);run.party.meals.trail_bread=3;run.party.journey.scrap=21;
  const ingredients=structuredClone(run.party.ingredients),materials=structuredClone(run.party.journey.materials),meals=structuredClone(run.party.meals);
  for(const floor of [89,79,69,59,49,39,29,19,9,1]){move(run,floor);assert.deepEqual(run.party.ingredients,ingredients);assert.deepEqual(run.party.journey.materials,materials);assert.deepEqual(run.party.meals,meals);assert.equal(run.party.journey.scrap,21);assert.ok(C.validateSave(run));}
  run.chronicle.ending='keeper';run.chronicle.clues.push('clue:heart');run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push('monster-11');run=C.descend(run).run;const entered=C.startUnderworld(run);assert.ok(entered.ok);run=entered.run;
  for(const floor of [-1,-11,-21,-31,-41,-50]){move(run,floor);assert.deepEqual(run.party.ingredients,ingredients);assert.deepEqual(run.party.journey.materials,materials);assert.deepEqual(run.party.meals,meals);assert.ok(C.validateSave(run));}
});

test('all fifteen regional ingredients have recipes and region-exclusive recipes cannot use old ingredients as substitutes',()=>{
  const regionKeys=Object.keys(P.INGREDIENTS).filter(k=>!legacyIngredients.includes(k));assert.equal(regionKeys.length,15);
  for(const key of regionKeys){const matches=Object.entries(P.RECIPES).filter(([,r])=>r.cost[key]);assert.ok(matches.length>0,key);for(const[id,recipe]of matches){const run=move(underground('chef'),-50);for(const key of legacyIngredients)run.party.ingredients[key]=99;const before=JSON.stringify(run);assert.equal(P.cook(run,id).ok,false,id);assert.equal(JSON.stringify(run),before);for(const[k,v]of Object.entries(recipe.cost))run.party.ingredients[k]=v;const cooked=P.cook(run,id);assert.ok(cooked.ok,id+': '+cooked.message);assert.equal(cooked.run.party.ingredients[key],0);assert.ok(C.validateSave(cooked.run));}}
});

test('all seven forge treatments consume scaled regional material costs atomically, never by repair',()=>{
  const used=new Set();for(const t of Object.values(X.TRAITS))for(const[key,count]of Object.entries(t.materialCost)){assert.ok(Object.hasOwn(M.MATERIALS,key));assert.ok(Number.isInteger(count)&&count>0);used.add(key);}assert.deepEqual([...used].sort(),Object.keys(M.MATERIALS).sort());
  let run=fresh('smith');run.coins=999;run.party.journey.scrap=99;const id=run.equipment.weapon.id,missing=X.forgeQuote(run,id,'durable');assert.equal(missing.allowed,true);assert.equal(missing.affordable,false);assert.deepEqual(missing.materialCost,{ironore:1});
  const before=JSON.stringify(run),failed=X.forge(run,id,'durable',run.revision);assert.equal(failed.ok,false);assert.match(failed.message,/精鐵礦/);assert.equal(JSON.stringify(run),before);
  run.party.journey.materials.ironore=3;let forged=X.forge(run,id,'durable',run.revision);assert.ok(forged.ok);run=forged.run;assert.equal(run.party.journey.materials.ironore,2);assert.deepEqual(X.forgeQuote(run,id,'durable').materialCost,{ironore:2});
  forged=X.forge(run,id,'durable',run.revision);assert.ok(forged.ok);run=forged.run;assert.equal(run.party.journey.materials.ironore,0);assert.equal(run.equipment.weapon.forge.level,2);assert.ok(C.validateSave(run));
  run.equipment.weapon.durability=0;const stock=structuredClone(run.party.journey.materials),repair=X.repair(run,id,run.revision);assert.ok(repair.ok,repair.message);assert.deepEqual(repair.run.party.journey.materials,stock);assert.equal(repair.run.equipment.weapon.durability,repair.run.equipment.weapon.maxDurability);
});
