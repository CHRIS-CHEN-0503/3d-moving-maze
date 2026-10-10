import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),M=require('../story/tower-materials.js'),Lab=require('../story/tower-recipe-lab.js'),Loot=require('../story/tower-loot.js');
const stock=run=>{for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=12;return run;};
const legacy=(job,seed=21)=>stock(P.enable(C.newRun({seed,name:'研發測試'}),job).run);
const modern=(job,seed=21)=>stock(H.enable(P.enable(C.newRun({seed,name:'研發測試'}),job).run).run);
const buffed=(run,id)=>{run.party.buffs.push({id,floors:3});return run;};
test('one hundred hidden dishes: unique ids, names and ingredient sets of two to four types, every key real, effects above the base menu',()=>{
  assert.equal(Lab.COUNT,100);assert.equal(Object.keys(M.INGREDIENTS).length,58);
  const ids=new Set(),names=new Set(),costs=new Set();let stronger=0,shared=0;const profiles=new Map();
  for(const r of Lab.HIDDEN){ids.add(r.id);names.add(r.name);costs.add(Lab.key(r.cost));const types=Object.keys(r.cost);assert.ok(types.length>=2&&types.length<=4,r.id);assert.ok(Object.values(r.cost).reduce((a,b)=>a+b,0)<=8,r.id);for(const k of types)assert.ok(M.INGREDIENTS[k],k);
    assert.ok(P.RECIPES[r.id]?.hidden,r.id+' is registered as a hidden recipe');assert.ok(r.buff||r.ward,r.id+' carries an effect');if(r.buff)assert.ok(P.BUFFS[r.buff],r.buff);if(r.ward)assert.ok(Lab.WARDS[r.ward],r.ward);
    if(r.hp+r.hunger+(r.team||0)>=34||r.buff&&!['focus','guard','trail'].includes(r.buff))stronger++;const profile=[r.hp,r.hunger,r.team||0,r.buff||'',r.ward||''].join('/');if(profiles.has(profile))shared++;profiles.set(profile,r.id);}
  assert.equal(ids.size,100);assert.equal(names.size,100);assert.equal(costs.size,100,'no two dishes share an ingredient set');assert.ok(stronger>=90,'hidden dishes mostly beat the open menu');assert.ok(shared>=10,'some different dishes land the same effect');
  for(const key of Lab.EXOTIC)assert.equal(M.INGREDIENT_META[key].sources.length,0,key+' is hunter-only');assert.ok(Object.keys(M.INGREDIENTS).filter(k=>!Lab.EXOTIC.includes(k)&&!['root','mushroom','herb','nectar','meat','shell','dew'].includes(k)).every(k=>M.INGREDIENT_META[k].sources.length>0),'every regional ingredient drops somewhere');
});
test('a chef learns a hidden dish by matching its ingredients exactly; misses spend ingredients, hint the direction and leave a medley half the time',()=>{
  let run=legacy('chef');const herb=run.party.ingredients.herb,dew=run.party.ingredients.dew;assert.equal(P.research(legacy('swordsman'),{herb:2,dew:2}).ok,false,'no chef, no research');
  for(const bad of [{herb:9},{herb:1,dew:1,root:1,meat:1,shell:1},{herb:5,dew:4},{nothing:2,herb:1}])assert.equal(P.research(run,bad).ok,false,JSON.stringify(bad));
  let r=P.research(run,{herb:2,dew:2});assert.ok(r.ok,r.message);run=r.run;assert.equal(r.effect.discovered,'dew_herb_broth');assert.match(r.message,/研發成功/);assert.deepEqual(run.party.discoveries,['dew_herb_broth']);assert.equal(run.party.ingredients.herb,herb-2);assert.equal(run.party.ingredients.dew,dew-2);assert.equal(run.party.meals.dew_herb_broth,2,'the chef makes two portions');assert.equal(run.party.specials.dew_herb_broth,2);assert.ok(C.validateSave(JSON.stringify(run)));
  assert.ok(P.recipeAvailable(run,'dew_herb_broth'));assert.ok(P.availableRecipes(run).dew_herb_broth);assert.equal(P.availableRecipes(run).medley,undefined);assert.equal(P.cook(run,'medley').ok,false);
  r=P.cook(run,'dew_herb_broth');assert.ok(r.ok,r.message);run=r.run;assert.equal(run.party.meals.dew_herb_broth,4);r=P.research(run,{herb:2,dew:2});assert.ok(r.ok);assert.equal(r.effect.discovered,null);assert.match(r.message,/已知/);run=r.run;
  const before=run.hp=20;r=P.eat(run,'dew_herb_broth');assert.ok(r.ok);assert.ok(r.run.party.buffs.some(b=>b.id==='rejuvenate'));assert.equal(r.run.hp,Math.min(C.MAX_HP,before+Math.round(20*1.3)));
  const cold=legacy('swordsman');assert.equal(P.recipeAvailable(cold,'dew_herb_broth'),false,'undiscovered dishes stay hidden');const stolen=structuredClone(run);stolen.party.discoveries=['not-a-dish'];assert.equal(C.validateSave(JSON.stringify(stolen)),null);
  let medley=0,empty=0,hinted=0;for(let i=0;i<24;i++){const probe=stock(legacy('chef',100+i));probe.revision+=i;const miss=P.research(probe,{meat:1,herb:1,root:1});assert.ok(miss.ok,miss.message);assert.equal(miss.effect.discovered,null);if(miss.effect.medley){medley++;assert.equal(miss.run.party.meals.medley,1);}else{empty++;assert.equal(miss.run.party.meals.medley,0);}if(miss.effect.closest>0)hinted++;assert.equal(miss.run.party.ingredients.meat,11);assert.ok(C.validateSave(JSON.stringify(miss.run)));}
  assert.ok(medley>=6&&empty>=6,'about half the misses leave a medley: '+medley+'/'+empty);assert.equal(hinted,24,'the hint counts shared ingredient types');
  const hero=modern('chef');const fresh=P.research(hero,{windbell:2,dew:1});assert.ok(fresh.ok,fresh.message);assert.equal(fresh.effect.discovered,'windbell_tea');assert.ok(C.validateSave(JSON.stringify(fresh.run)));
});
test('the eleven meal buffs change real numbers and the vigor bonus survives save validation',()=>{
  const base=modern('swordsman'),vig=buffed(modern('swordsman'),'vigor');assert.equal(H.maxHp(vig,'hero'),Math.round(H.maxHp(base,'hero')*1.1));H.setHp(vig,'hero',H.maxHp(vig,'hero'));assert.ok(C.validateSave(JSON.stringify(vig)),'full vigor health validates');const over=structuredClone(vig);over.party.buffs=[];assert.equal(C.validateSave(JSON.stringify(over)),null,'without the buff the same health is rejected');
  vig.floor=98;vig.floorsCleared=1;P.advance(vig,{reward:false});P.advance(vig,{reward:false});P.advance(vig,{reward:false});assert.ok(!vig.party.buffs.some(b=>b.id==='vigor'));assert.ok(H.hp(vig,'hero')<=H.maxHp(vig,'hero'),'health is clamped when the buff expires');
  assert.ok(H.speed(buffed(modern('scout'),'swift'))>H.speed(modern('scout'))*1.09);assert.equal(H.critChance(buffed(modern('scout'),'keen')),H.critChance(modern('scout'))+5);
  assert.equal(H.stats(buffed(modern('swordsman'),'ironskin')).armor,H.stats(modern('swordsman')).armor+2);assert.ok(Math.abs(H.mpRegen(buffed(modern('mage'),'spirittide'),'hero')-H.mpRegen(modern('mage'),'hero')*1.3)<1e-9);
  assert.ok(Math.abs(H.hungerScale(buffed(modern('chef'),'warmth'))-H.hungerScale(modern('chef'))*.7)<1e-9);assert.equal(Loot.chance({type:'ingredient',key:'meat',rarity:'common'},buffed(modern('chef'),'lucky')),Loot.chance({type:'ingredient',key:'meat',rarity:'common'})+10);
  const spec=P.monsterSpecs(base)[0];const plain=structuredClone(base),might=buffed(structuredClone(base),'might');H.actor(plain).attack=0;H.actor(might).attack=0;assert.ok(H.strike(might,spec.id).effect.damage>H.strike(plain,spec.id).effect.damage,'might adds attack');
  const wall=buffed(modern('swordsman'),'bulwark'),soft=modern('swordsman');H.setHp(wall,'hero',50);H.setHp(soft,'hero',50);H.hurt(wall,'hero',20,'monster');H.hurt(soft,'hero',20,'monster');const lossWall=50-H.hp(wall,'hero'),lossSoft=50-H.hp(soft,'hero');assert.ok(lossSoft-lossWall>=3&&lossSoft-lossWall<=4,'bulwark shaves about four points before mitigation: '+lossSoft+' vs '+lossWall);const feather=buffed(modern('swordsman'),'featherstep');H.setHp(feather,'hero',50);H.hurt(feather,'hero',20,'trap');assert.equal(H.hp(feather,'hero'),50,'featherstep ignores trap damage');
  const rej=buffed(modern('healer'),'rejuvenate');H.setHp(rej,'hero',10);H.tick(rej,2);assert.ok(H.hp(rej,'hero')>10&&H.hp(rej,'hero')<=11.01,'half a point per second');
  const old=legacy('swordsman');assert.equal(P.reduceDamage(buffed(old,'featherstep'),9,'trap'),0);assert.equal(P.reduceDamage(buffed(legacy('swordsman'),'bulwark'),9,'monster'),Math.max(0,P.reduceDamage(legacy('swordsman'),9,'monster')-4));
});
