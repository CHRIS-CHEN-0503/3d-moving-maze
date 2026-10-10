import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-encounters.js'),N=require('../story/tower-narrative.js'),K=require('../story/tower-commission-cooking.js');
const ok=result=>{assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run));return result.run;};
function fresh(job='swordsman',grocer=true){for(let seed=1;seed<200;seed++){const run=ok(H.enable(ok(P.enable(C.newRun({seed}),job))));if(E.merchantOffers(99,seed,true).some(m=>m.id==='suHe')===grocer){run.coins=999;for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=40;return run;}}throw Error('Missing bounded shop fixture');}
function unchanged(run,action){const raw=JSON.stringify(run),result=action();assert.equal(result.ok,false);assert.equal(JSON.stringify(run),raw);return result;}
function underground(floor=-1){let run=fresh();run.floor=1;run.floorsCleared=99;run.chronicle=N.newChronicle(1);run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);run.chronicle.ending='release';run.adventure=E.newAdventure();P.advance(run,{reward:false});run.status='won';run=ok(C.startUnderworld(run,run.revision));run.floor=floor;run.floorsCleared=99-floor-1;run.chronicle=N.newChronicle(floor);run.chronicle.ending=run.underworld.surfaceEnding;run.adventure=E.newAdventure();P.advance(run,{reward:false});for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=40;for(let seed=1;seed<200;seed++)if(E.merchantOffers(floor,seed,true).some(m=>m.id==='suHe')){run.seed=seed;P.advance(run,{reward:false});break;}assert.ok(C.validateSave(run));return run;}

test('commission fees derive transparent basic, advanced, feast and underground recipe tiers',()=>{
  assert.deepEqual(K.FEES,{basic:2,advanced:5,feast:8,underground:12});
  for(const [id,r]of Object.entries(P.RECIPES)){if(r.hidden||r.research){assert.equal(K.category(id),null,id+' is never commissioned');assert.equal(K.fee(id),null);continue;}const category=r.requiredDepth?'underground':r.requiresChef&&(id==='feast'||r.team>=30)?'feast':r.requiresChef?'advanced':'basic';assert.equal(K.category(id),category);assert.equal(K.fee(id),K.FEES[category]);}
  for(const id of ['__proto__','constructor','missing']){assert.equal(K.category(id),null);assert.equal(K.fee(id),null);}
});

test('grocer cooks advanced recipes without an actionable chef, consumes exact ingredients and one fee',()=>{
  let run=fresh();assert.equal(P.has(run,'chef'),false);assert.equal(P.recipeAvailable(run,'crab'),false);
  for(const id of ['stew','crab','feast']){const before=structuredClone(run),q=K.quote(run,id);assert.ok(q.allowed&&q.affordable);assert.equal(q.quantity,1);run=ok(K.cook(run,id,run.revision));assert.equal(run.coins,before.coins-K.fee(id));assert.equal(run.party.meals[id],before.party.meals[id]+1);for(const key of Object.keys(P.INGREDIENTS))assert.equal(run.party.ingredients[key],before.party.ingredients[key]-(P.RECIPES[id].cost[key]||0));}
});

test('commission never triggers double portion or ingredient conservation even with skilled chefs',()=>{
  let run=fresh('chef');const a=H.actor(run);a.passives=['double_portion','ingredient_care'];assert.ok(C.validateSave(run));
  for(let i=0;i<25;i++){const before=structuredClone(run);run=ok(K.cook(run,'crab',run.revision));assert.equal(run.party.meals.crab,before.party.meals.crab+1);assert.equal(run.party.ingredients.meat,before.party.ingredients.meat-2);assert.equal(run.party.ingredients.herb,before.party.ingredients.herb-1);run.party.ingredients.meat=40;run.party.ingredients.herb=40;}
});

test('missing materials, no funds, full stock, wrong merchant, no grocer and stale request cannot spend',()=>{
  for(const tweak of [r=>r.coins=0,r=>r.party.ingredients.meat=0,r=>r.party.meals.crab=99]){const run=fresh();tweak(run);unchanged(run,()=>K.cook(run,'crab',run.revision));}
  const run=fresh();unchanged(run,()=>K.cook(run,'crab',run.revision+1));unchanged(run,()=>K.cook(run,'crab',run.revision,'tieLing'));unchanged(run,()=>K.cook(run,'__proto__',run.revision));
  const absent=fresh('swordsman',false);assert.equal(K.quote(absent,'crab').allowed,false);unchanged(absent,()=>K.cook(absent,'crab',absent.revision));
  const full=fresh();full.party.meals.crab=98;const cooked=ok(K.cook(full,'crab'));assert.equal(cooked.party.meals.crab,99);unchanged(cooked,()=>K.cook(cooked,'crab'));
});

test('underground recipes retain depth gates and ready-made quantities remain valid on reload',()=>{
  const surface=fresh();assert.equal(K.quote(surface,'root_banquet').allowed,false);unchanged(surface,()=>K.cook(surface,'root_banquet'));
  let run=underground(-1);assert.equal(K.quote(run,'root_banquet').allowed,true);assert.equal(K.quote(run,'mist_broth').allowed,false);assert.ok(K.recipes(run).some(q=>q.recipeId==='root_banquet'));assert.ok(!K.recipes(run).some(q=>q.recipeId==='mist_broth'));
  const before=run.coins;run=ok(K.cook(run,'root_banquet'));assert.equal(run.coins,before-12);const reload=C.validateSave(JSON.stringify(run));assert.equal(reload.party.meals.root_banquet,run.party.meals.root_banquet);assert.equal(reload.coins,run.coins);
  run=underground(-41);assert.equal(K.recipes(run).length,Object.values(P.RECIPES).filter(r=>!r.hidden&&!r.research).length,'hidden dishes and the medley are never commissioned');run=ok(K.cook(run,'gate_feast'));assert.equal(run.party.meals.gate_feast,1);
});
