// v1.61.1 · saves must stay readable after ordinary play: rift rewards, chef specials, meal buffs,
// ward dishes, the traveller archive, the smith barrier and recipe research all once produced
// states that validateSave rejected, which the game can never repair because every later action
// is itself a validated transaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),GM=require('../story/tower-gm.js'),D=require('../story/tower-dungeons.js'),R=require('../story/tower-recruitment.js'),G=require('../story/tower-hero-growth.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('rift rewards never hand out built-in robot parts or craft-only cores',()=>{
  let withGear=0;
  for(let seed=1;seed<=120;seed++){const run=GM.build({floor:53,job:'swordsman',level:5,seed}).run;const offer=D.offer(run);if(!offer?.reward?.gear)continue;withGear++;
    const def=C.GEAR[offer.reward.gear.kind];assert.ok(def,'reward kind exists');assert.ok(!def.integrated&&!def.craftOnly&&!def.core,'seed '+seed+' rewarded '+offer.reward.gear.kind);}
  assert.ok(withGear>0,'some rifts reward gear');
});

test('a save that already holds a robot part in the bag is repaired instead of rejected',()=>{
  const run=GM.build({floor:53,job:'swordsman',level:5,seed:2}).run;
  run.gearBag.push(C.createGear('robot_fists',53,run.seed,'rift:53:2',true));
  const valid=C.validateSave(run);assert.ok(valid,'save loads');assert.equal(valid.gearBag.some(g=>g.kind==='robot_fists'),false,'the part is dropped');
});

test('paying a recruit with a special meal keeps specials within meals',()=>{
  let run=GM.build({floor:90,job:'chef',level:3,seed:5,companions:[{job:'swordsman',level:3}]}).run;run.party.ingredients.herb=9;run.party.ingredients.mushroom=9;
  const cooked=P.cook(run,'salad');assert.equal(cooked.ok,true,cooked.message);run=cooked.run;assert.equal(run.party.specials.salad,run.party.meals.salad,'chef portions are special');
  R.pay(run,{list:[{type:'meals',id:'salad',count:1}]});
  assert.equal(run.party.meals.salad,0);assert.equal(run.party.specials.salad,0);assert.ok(C.validateSave(run),'save still loads');
  const stale=JSON.parse(JSON.stringify(run));stale.party.meals.salad=1;stale.party.specials.salad=3;
  const repaired=C.validateSave(stale);assert.ok(repaired,'a v1.61.0 save with more specials than meals loads');assert.equal(repaired.party.specials.salad,1,'specials clamp to meals');
});

test('losing the 強身 buff to a third meal clamps every actor to the lower cap',()=>{
  let run=GM.build({floor:90,job:'chef',level:3,seed:7,companions:[{job:'swordsman',level:3}]}).run;
  const vigor=Object.entries(P.RECIPES).find(([,r])=>r.buff==='vigor')[0],others=Object.entries(P.RECIPES).filter(([,r])=>r.buff&&r.buff!=='vigor').slice(0,3).map(([id])=>id);
  run.party.discoveries=[vigor,...others].filter(id=>P.RECIPES[id].hidden);for(const id of [vigor,...others])run.party.meals[id]=1;
  let r=P.eat(run,vigor);assert.equal(r.ok,true,r.message);run=r.run;for(const id of H.ids(run))H.setHp(run,id,H.maxHp(run,id));
  const boosted=H.ids(run).map(id=>H.hp(run,id));
  for(const id of others){r=P.eat(run,id);assert.equal(r.ok,true,r.message);run=r.run;}
  assert.equal(run.party.buffs.some(b=>b.id==='vigor'),false,'vigor was pushed out');
  for(const id of H.ids(run))assert.ok(H.hp(run,id)<=H.maxHp(run,id),id+' is within the cap');
  assert.ok(boosted.some((hp,i)=>hp>H.hp(run,H.ids(run)[i])),'at least one actor was clamped down');
  assert.ok(C.validateSave(run),'save still loads');
});

test('slow, curse and root ward dishes leave a loadable save',()=>{
  for(const id of ['nimble_porridge','blessed_rice','unbound_salad']){
    let run=GM.build({floor:90,job:'chef',level:3,seed:9}).run;run.party.discoveries=[id];run.party.meals[id]=1;
    const r=P.eat(run,id);assert.equal(r.ok,true,r.message);
    assert.ok(r.run.party.loadouts.actors.hero.buffs.some(b=>b.id==='meal_'+P.RECIPES[id].ward),id+' grants its ward');
    assert.ok(C.validateSave(r.run),id+' save loads');
  }
});

test('the traveller archive accepts one record per identity',()=>{
  assert.match(read('story/tower-recruitment.js'),/value\.length>Object\.keys\(TERMS\)\.length/);
  assert.ok(Object.keys(R.TERMS).length>16,'more identities than the old fixed limit');
});

test('a barrier never exceeds the power the validator allows',()=>{
  const run=GM.build({floor:90,job:'smith',level:3,seed:3}).run;G.shield(run,'hero',250);
  const barrier=run.party.loadouts.actors.hero.buffs.find(b=>b.id==='barrier');assert.equal(barrier.power,200);assert.ok(C.validateSave(run));
});

test('research refuses a full meal box before spending ingredients',()=>{
  const run=GM.build({floor:90,job:'chef',level:3,seed:4}).run;run.party.discoveries=['dew_herb_broth'];run.party.meals.dew_herb_broth=99;run.party.ingredients.dew=5;run.party.ingredients.herb=5;
  const r=P.research(run,P.RECIPES.dew_herb_broth.cost);assert.equal(r.ok,false);assert.match(r.message,/已滿/);assert.equal(run.party.ingredients.dew,5);assert.equal(run.party.ingredients.herb,5);
});
