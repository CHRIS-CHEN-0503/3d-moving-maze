import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),G=require('../story/tower-hero-growth.js');
require('../story/tower-party-runtime.js');
const fresh=()=>{const run=H.enable(P.enable(C.newRun({seed:72,name:'料理測試'}),'chef').run).run;H.actor(run).passives=['gourmet','nourishment'];return run;};
function atFloor(run,floor){run.floor=floor;run.floorsCleared=floor<0?99+(-floor-1):99-floor;run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=C.newAdventure();run.expedition=D.newExpedition();if(floor>0)run.chronicle=N.newChronicle(floor);P.advance(run,{reward:false});return run;}
function underground(floor=-1){const run=atFloor(fresh(),1);run.chronicle.ending='keeper';run.chronicle.clues.push('clue:heart');run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push('monster-11');const ended=C.descend(run);assert.ok(ended.ok);const entered=C.startUnderworld(ended.run);assert.ok(entered.ok);const next=atFloor(entered.run,floor);assert.ok(C.validateSave(next));return next;}
const fill=run=>{Object.keys(run.party.ingredients).forEach(k=>run.party.ingredients[k]=30);run.hp=10;run.hunger=0;return run;};

test('twenty-three recipes include eighteen shared meals and five regional underground meals',()=>{
  assert.equal(Object.keys(P.RECIPES).length,23);assert.equal(Object.keys(P.availableRecipes(fresh())).length,18);
  assert.deepEqual(Object.values(P.RECIPES).filter(r=>r.requiredDepth).map(r=>r.requiredDepth),[1,11,21,31,41]);
  for(const [floor,count]of [[-1,19],[-10,19],[-11,20],[-20,20],[-21,21],[-30,21],[-31,22],[-40,22],[-41,23],[-50,23]])assert.equal(Object.keys(P.availableRecipes(underground(floor))).length,count);
  for(const [id,r]of Object.entries(P.RECIPES)){assert.ok(r.name);assert.ok(Object.entries(r.cost).every(([k,n])=>Object.hasOwn(P.INGREDIENTS,k)&&Number.isInteger(n)&&n>0));}
});

test('older eight-meal saves add zero-count new recipes without changing earned ingredients, dishes, party or equipment',()=>{
  for(const source of [fresh(),underground(-1)]){
    source.party.meals.stew=4;source.party.meals.feast=3;const old=structuredClone(source);for(const id of Object.keys(old.party.meals))if(!P.LEGACY_RECIPES.includes(id))delete old.party.meals[id];
    const serialized=JSON.stringify(old),loaded=C.validateSave(serialized);assert.ok(loaded);assert.equal(JSON.stringify(old),serialized);assert.equal(loaded.party.meals.stew,4);assert.equal(loaded.party.meals.feast,3);
    for(const id of Object.keys(P.RECIPES).filter(id=>!P.LEGACY_RECIPES.includes(id)))assert.equal(loaded.party.meals[id],0);
    const expected=structuredClone(source);assert.deepEqual(loaded,expected);assert.deepEqual(C.validateSave(JSON.stringify(loaded)),loaded);
  }
  for(const change of [r=>delete r.party.meals.stew,r=>r.party.meals.unknown=1,r=>r.party.meals.trail_bread=-1,r=>r.party.meals.trail_bread=1.5,r=>r.party.meals.mist_broth=1]){const run=fresh();change(run);assert.equal(C.validateSave(run),null);}
});

test('every recipe cooks and eats using real transaction rules with accurate costs and effects',()=>{
  for(const [id,recipe]of Object.entries(P.RECIPES)){
    const run=fill(recipe.requiredDepth?underground(-recipe.requiredDepth):fresh()),before=JSON.stringify(run),cooked=P.cook(run,id,run.revision);assert.ok(cooked.ok,id+': '+cooked.message);assert.equal(JSON.stringify(run),before);assert.equal(cooked.run.party.meals[id],1,id);
    for(const key of Object.keys(P.INGREDIENTS))assert.equal(cooked.run.party.ingredients[key],30-(recipe.cost[key]||0));
    assert.equal(P.cook(cooked.run,id,run.revision).ok,false,'stale revision cannot double spend');const eaten=P.eat(cooked.run,id,cooked.run.revision);assert.ok(eaten.ok,eaten.message);assert.equal(eaten.run.party.meals[id],0);assert.equal(eaten.run.hp,Math.min(H.maxHp(eaten.run),10+recipe.hp));assert.equal(eaten.run.hunger,Math.min(100,recipe.hunger*(1+H.teamPassive(eaten.run,'gourmet')/100)));
    if(recipe.buff)assert.ok(eaten.run.party.buffs.some(b=>b.id===recipe.buff&&b.floors===3));assert.ok(C.validateSave(JSON.stringify(eaten.run)),id);
  }
});

test('underground recipe gates are enforced by cooking, eating and save validation, not just hidden buttons',()=>{
  for(const [id,recipe]of Object.entries(P.RECIPES).filter(([,r])=>r.requiredDepth)){
    const early=fill(recipe.requiredDepth===1?fresh():underground(-(recipe.requiredDepth-1))),snapshot=JSON.stringify(early);
    assert.equal(P.recipeAvailable(early,id),false);assert.equal(P.cook(early,id,early.revision).ok,false);assert.equal(JSON.stringify(early),snapshot);
    const forged=structuredClone(early);forged.party.meals[id]=1;assert.equal(C.validateSave(forged),null);assert.equal(P.eat(forged,id,forged.revision).ok,false);
    const ready=fill(underground(-recipe.requiredDepth));assert.ok(P.recipeAvailable(ready,id));const cooked=P.cook(ready,id);assert.ok(cooked.ok);assert.ok(P.eat(cooked.run,id).ok);
  }
});

test('cooking still refuses insufficient ingredients and full meal stacks without mutating resources',()=>{
  for(const id of Object.keys(P.RECIPES)){
    const run=fill(underground(-50)),recipe=P.RECIPES[id];run.party.meals[id]=99;const full=JSON.stringify(run);assert.equal(P.cook(run,id).ok,false);assert.equal(JSON.stringify(run),full);run.party.meals[id]=0;run.party.ingredients[Object.keys(recipe.cost)[0]]=0;const empty=JSON.stringify(run);assert.equal(P.cook(run,id).ok,false);assert.equal(JSON.stringify(run),empty);
  }
});

test('each new dish has a distinct real game illustration and extended flavour history validates without truncation',()=>{
  const icons=Object.keys(P.RECIPES).map(id=>globalThis.TowerPartyRuntime.dishArt(id));assert.equal(new Set(icons).size,Object.keys(P.RECIPES).length);for(const svg of icons){assert.match(svg,/^<svg/);assert.doesNotMatch(svg,/undefined|NaN|<image|<script/);}
  const saved=G.fresh(),names=Object.keys(P.RECIPES);saved.tastes=names;saved.tasteLeft=80;const read=G.validate(saved,{members:[],floor:-50});assert.ok(read);assert.deepEqual(read.tastes,names);assert.equal(G.validate(saved,{members:[],floor:99}),null);saved.tastes=[...names,names[0]];assert.equal(G.validate(saved,{members:[],floor:-50}),null);
});

test('new cooking buff combinations respect the existing two-buff limit and three-floor decay',()=>{
  let run=fill(underground(-50));for(const id of ['root_banquet','ember_crab','gate_feast']){run.party.meals[id]=1;const ate=P.eat(run,id);assert.ok(ate.ok);run=ate.run;}
  assert.deepEqual(run.party.buffs.map(b=>b.id),['focus','guard']);P.advance(run,{reward:false});P.advance(run,{reward:false});assert.equal(run.party.buffs.length,2);P.advance(run,{reward:false});assert.equal(run.party.buffs.length,0);
});
