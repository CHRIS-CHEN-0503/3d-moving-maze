import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),A=require('../story/tower-alchemy.js'),M=require('../story/tower-materials.js'),E=require('../story/tower-encounters.js'),X=require('../story/tower-expedition-core.js'),N=require('../story/tower-narrative.js');
const stock=run=>{for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=10;return run;};
const modern=(job,seed=5)=>stock(H.enable(P.enable(C.newRun({seed,name:'藥坊測試'}),job).run).run);
const legacy=(job,seed=5)=>stock(P.enable(C.newRun({seed,name:'藥坊測試'}),job).run);
function underground(run){run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);run.chronicle.ending='release';run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);P.advance(run,{reward:false});const v=C.startUnderworld(run);assert.ok(v.ok,v.message);return stock(v.run);}
test('herbs are now 藥草 everywhere the player reads them, and dew is a real common ingredient with sources',()=>{
  assert.equal(P.INGREDIENTS.herb,'藥草');assert.equal(M.INGREDIENTS.dew,'清露');assert.equal(P.RECIPES.broth.name,'藥草暖湯');assert.equal(P.RECIPES.salad.name,'發光藥草沙拉');
  assert.ok(E.GROCERY.commonIngredients.includes('dew'));assert.ok(M.INGREDIENT_META.dew.sources.length>=4);assert.ok(M.INGREDIENT_META.dew.description.includes('露水'));
  const run=modern('healer');assert.equal(C.newRun({seed:5,name:'x'}).party,undefined);assert.equal(P.enable(C.newRun({seed:5,name:'x'}),'healer').run.party.ingredients.dew,2,'new journeys start with two dew');
  for(const text of [JSON.stringify(Object.values(P.RECIPES).map(r=>r.name+(r.description||''))),JSON.stringify(H.SKILLS.herbal_heal.description)])assert.doesNotMatch(text,/香草/);
  assert.ok(C.validateSave(JSON.stringify(run)));
});
test('every recipe maps to a shop potion, a real maker and real ingredient keys; gates mirror the shop floors',()=>{
  for(const [id,r] of Object.entries(A.RECIPES)){assert.ok(C.ITEMS[id],id);assert.ok(A.MAKERS[r.maker],id);assert.ok(r.cost.herb>=1&&r.cost.dew>=1,id+' uses herb and dew');for(const k of Object.keys(r.cost))assert.ok(Object.hasOwn(M.INGREDIENTS,k),k);}
  assert.deepEqual(Object.keys(A.RECIPES).filter(id=>A.RECIPES[id].maker==='healer'),['heal','heal_mid','heal_high','spirit']);assert.deepEqual(Object.keys(A.RECIPES).filter(id=>A.RECIPES[id].maker==='cleric'),['haste','shield','courage','arcane']);
  const run=modern('healer');assert.equal(A.quote(run,'heal_mid').allowed,false);assert.match(A.quote(run,'heal_mid').reason,/第 60 層起/);assert.match(A.quote(run,'heal_high').reason,/地下/);
  run.floor=60;run.floorsCleared=39;P.advance(run,{reward:false});stock(run);assert.equal(A.quote(run,'heal_mid').allowed,true);assert.equal(A.unlocked(run,'heal_high'),false);
});
test('a healer brews restoratives at camp, consuming ingredients and never exceeding the bag limit; nobody else can',()=>{
  let run=legacy('healer');const before=run.bag.heal,herb=run.party.ingredients.herb,dew=run.party.ingredients.dew;
  const r=A.brew(run,'heal');assert.ok(r.ok,r.message);run=r.run;assert.equal(run.bag.heal,before+1);assert.equal(run.party.ingredients.herb,herb-2);assert.equal(run.party.ingredients.dew,dew-1);assert.ok(C.validateSave(JSON.stringify(run)));
  assert.equal(A.brew(run,'haste').ok,false);assert.match(A.brew(run,'haste').message,/神職/);assert.equal(A.brew(run,'not-a-potion').ok,false);
  run.party.ingredients.dew=0;assert.match(A.brew(run,'spirit').message,/材料還不夠/);run.party.ingredients.dew=5;run.bag.spirit=C.itemLimit('spirit',run);assert.match(A.brew(run,'spirit').message,/上限/);
  const hero=modern('healer');const q=A.quote(hero,'spirit');assert.ok(q.allowed&&q.affordable);const brewed=A.brew(hero,'spirit');assert.ok(brewed.ok,brewed.message);assert.equal(brewed.run.bag.spirit,hero.bag.spirit+1);assert.ok(brewed.run.party.ingredients.herb<=hero.party.ingredients.herb,'herb spent or saved by ingredient care, never gained');assert.ok(C.validateSave(JSON.stringify(brewed.run)));
  const sword=modern('swordsman');assert.equal(A.makers(sword).length,0);assert.match(A.quote(sword,'heal').reason,/療癒師/);
  const downed=modern('healer');H.setHp(downed,'hero',0);assert.equal(A.quote(downed,'heal').allowed,false);
});
test('a cleric brews tonics, underground potions open only below ground, and the purified spring hands back dew',()=>{
  let run=modern('cleric');assert.deepEqual(A.makers(run),['cleric']);assert.ok(A.available(run).includes('haste')&&A.available(run).includes('shield'));assert.ok(!A.available(run).includes('courage'));
  const shield=A.brew(run,'shield');assert.ok(shield.ok,shield.message);assert.equal(shield.run.bag.shield,run.bag.shield+1);assert.ok(C.validateSave(JSON.stringify(shield.run)));
  run=underground(modern('cleric'));assert.ok(A.available(run).includes('courage')&&A.available(run).includes('arcane'));const courage=A.brew(run,'courage');assert.ok(courage.ok,courage.message);assert.ok(C.validateSave(JSON.stringify(courage.run)));
  const spring=modern('healer');spring.party.ingredients.dew=0;const site=X.SITES.healer;assert.match(site.reward,/清露/);
});
