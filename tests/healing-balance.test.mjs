import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {add,ownSkill,fixture as comboFixture} from './tower-cooperation-fixtures.mjs';
import {provisionTravellers} from './recruit-fixtures.mjs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),A=require('../story/tower-ascension-catalog.js'),Co=require('../story/tower-cooperation-core.js'),T=require('../lib/three.min.js');
const close=(actual,wanted)=>assert.ok(Math.abs(actual-wanted)<1e-8,`${actual} != ${wanted}`);
function fresh(key){const s=H.SKILLS[key]||H.PASSIVES[key];let r=H.enable(P.enable(C.newRun({seed:53,name:'治療驗證'}),s.job).run).run;if(H.SKILLS[key]&&!s.unique)ownSkill(r,'hero',key);provisionTravellers(r);return r;}
function underground(base,level=12){let r=fresh(base);r.floor=1;r.floorsCleared=99;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);r.chronicle.ending='release';P.advance(r,{reward:false});r=C.startUnderworld(r).run;H.gainXp(r,G.XP[level-1]);const result=G.chooseUltimate(r,'hero',base);assert.ok(result.ok,result.message);r=result.run;assert.ok(C.validateSave(r));return r;}
function growthRuntime(initial,{positions,blocked=false,paused=false}={}){let run=initial;const casts=[],at=positions||Object.fromEntries(H.ids(run).map((id,i)=>[id,{x:i,z:0}])),actors=H.ids(run).map(id=>({id,model:new T.Group()}));let wall=blocked,stop=paused;
  const env=vm.createContext({TowerHeroes:H,TowerHeroGrowth:G,TowerPartyCore:P,TowerHeroIcons:{svg:()=>''},document:{getElementById:()=>null},Math});vm.runInContext(readFileSync(new URL('../story/tower-growth-runtime.js',import.meta.url),'utf8'),env);
  const ui=env.TowerGrowthRuntime.create({G:{running:true,shifting:false},THREE:T,core:C,run:()=>run,paused:()=>stop,pos:id=>at[id],clear:()=>!wall,actors:()=>actors,monsters:()=>[],text:String,action:()=>'',toast(){},save(){},dispose(){},audio:{sfxAction(){}},
    transact(result){if(!result.ok)return false;run=result.run;return true;},cast(skill,target,actor){const result=H.cast(run,skill,{actorId:actor,targetId:target,nearby:H.ids(run)});if(!result.ok)return false;run=result.run;casts.push({skill,target,actor});return true;}});
  return {ui,casts,at,get run(){return run;},wall(value){wall=value;},pause(value){stop=value;}};
}

test('restoration metadata is increased once at all six ranks; herbal healing cooldown is five seconds, halved with every move',()=>{
  assert.equal(G.HEALING.multiplier,1.5);assert.equal(H.COOLDOWN_SCALE,.5);assert.equal(H.SKILLS.herbal_heal.cooldown,5*H.COOLDOWN_SCALE);assert.deepEqual(H.SKILLS.herbal_heal.cost,{herb:1});
  for(const [key,old]of Object.entries({herbal_heal:[20,25,30,35,40,45],warm_soup:[6,9,12,15,18,21],revive:[15,20,25,30,35,40]}))assert.deepEqual(H.SKILLS[key].power,old.map(n=>n*1.5),key);
  assert.deepEqual(H.PASSIVES.nourishment.power,[3,4.5,6,7.5,9,10.5]);assert.deepEqual(H.PASSIVES.food_sharing.power,[1.5,3,4.5,6,7.5,9]);assert.deepEqual(H.PASSIVES.gentle_care.power,[1.5,3,4.5,6,7.5,9]);
  assert.ok(H.SKILLS.dawn_sanctuary.power.every(n=>n===60));assert.ok(H.SKILLS.banquet_broth.power.every(n=>n===120));assert.ok(H.SKILLS.dawn_return.power.every(n=>n===90));
  assert.match(H.SKILLS.dawn_sanctuary.description,/60%.*45%/);assert.match(A.SKILLS.banquet_broth.description,/120生命/);assert.match(A.SKILLS.dawn_return.description,/90%/);
  assert.deepEqual(H.SKILLS.barrier.power,[10,15,20,25,30,35]);assert.deepEqual(H.SKILLS.repair.power,[8,10,12,14,16,18]);assert.deepEqual(H.SKILLS.parts_restore.power,H.ROBOT.actives.find(s=>s.id==='parts_restore').power);
});

test('herbal healing increases its full formula by fifty percent, preserves bonuses, costs and HP cap',()=>{
  let r=fresh('herbal_heal');H.actor(r).passives=['herbalism','gentle_care'];H.setHp(r,'hero',1);
  const old=(20*(1+H.pv(r,'herbalism')/100+H.stats(r).heal)+1),herbs=r.party.ingredients.herb,result=H.cast(r,'herbal_heal');assert.ok(result.ok,result.message);r=result.run;
  close(H.hp(r,'hero'),Math.min(H.maxHp(r),1+old*1.5));assert.equal(H.actor(r).cooldowns.herbal_heal,5*H.COOLDOWN_SCALE);assert.equal(r.party.ingredients.herb,herbs-1);assert.ok(C.validateSave(r));
  H.tick(r,5);H.setHp(r,'hero',H.maxHp(r)-1);r=H.cast(r,'herbal_heal').run;assert.equal(H.hp(r,'hero'),H.maxHp(r));assert.equal(H.cast(r,'herbal_heal').ok,false);
});

test('group soup uses increased skill healing but cannot heal robots or resurrect fallen allies',()=>{
  let r=fresh('warm_soup');const organic=add(r,'swordsman','guard_stance','organic'),robot=add(r,'robot','flying_fist','machine');H.setHp(r,'hero',1);H.setHp(r,organic,0);H.setHp(r,robot,1);
  const healing=1+H.stats(r).heal,before=r.party.ingredients.herb,result=H.cast(r,'warm_soup');assert.ok(result.ok);r=result.run;close(H.hp(r,'hero'),1+9*healing);assert.equal(H.hp(r,organic),0);assert.equal(H.hp(r,robot),1);assert.equal(r.party.ingredients.herb,before-1);assert.ok(C.validateSave(r));
});

test('ordinary revival restores the increased percentage and still spends exactly two herbs',()=>{
  let r=fresh('revive');const id=add(r,'swordsman','guard_stance');H.setHp(r,id,0);const herbs=r.party.ingredients.herb,result=H.cast(r,'revive',{targetId:id});assert.ok(result.ok);r=result.run;
  assert.equal(H.hp(r,id),Math.ceil(H.maxHp(r,id)*.225));assert.equal(r.party.ingredients.herb,herbs-2);assert.ok(C.validateSave(r));assert.equal(H.cast(r,'revive',{targetId:id}).ok,false);
});

test('dawn sanctuary restores sixty percent over ten seconds and revives one ally to forty-five percent',()=>{
  let r=underground('dawn_sanctuary',10);const id=add(r,'swordsman','guard_stance'),machine=add(r,'robot','flying_fist');H.setHp(r,'hero',1);H.setHp(r,id,0);H.setHp(r,machine,1);
  r=H.cast(r,'dawn_sanctuary').run;close(H.hp(r,id),H.maxHp(r,id)*.45);const h=growthRuntime(r),before=H.hp(r,'hero'),wanted=H.maxHp(r)*.6*(1+.02*(H.level(r)-1));
  for(let i=0;i<100;i++){h.ui.tick(.1);H.tick(h.run,.1);}close(H.hp(h.run,'hero'),Math.min(H.maxHp(h.run),before+wanted));assert.equal(H.hp(h.run,machine),1+3,'only three independent core ticks, never organic sanctuary healing');assert.ok(C.validateSave(h.run));
});

test('sanctuary mastery multiplies boosted healing once, keeps LOS/range/pause restrictions',()=>{
  let r=underground('dawn_sanctuary',15);const near=add(r,'swordsman','guard_stance','near'),far=add(r,'scout','throw_blade','far');H.setHp(r,'hero',1);H.setHp(r,near,1);H.setHp(r,far,1);r=H.cast(r,'dawn_sanctuary').run;
  const h=growthRuntime(r,{positions:{hero:{x:0,z:0},near:{x:1,z:0},far:{x:7,z:0}}});h.pause(true);h.ui.tick(.1);assert.equal(H.hp(h.run,near),1);h.pause(false);h.wall(true);h.ui.tick(.1);assert.equal(H.hp(h.run,near),1);
  h.wall(false);h.ui.tick(.1);close(H.hp(h.run,near),1+H.maxHp(h.run,near)*.6/10*1.25*1.28*.1);assert.equal(H.hp(h.run,far),1);assert.ok(C.validateSave(h.run));
});

test('feast regeneration increases while satiety, attack boost and material count remain unchanged',()=>{
  let r=underground('hero_feast',15);H.setHp(r,'hero',1);r.hunger=10;const before=Object.values(r.party.ingredients).reduce((a,b)=>a+b,0);r=H.cast(r,'hero_feast').run;
  close(H.buff(r,'regen').power,H.maxHp(r)*.03*1.25*1.28);close(r.hunger,10+35*1.25);close(H.buff(r,'rally').power,15*1.25);assert.equal(before-Object.values(r.party.ingredients).reduce((a,b)=>a+b,0),3);assert.equal(H.buff(r,'regen').left,10);assert.ok(C.validateSave(r));
});

test('underground healing continuations retain original mastery/costs and never exceed maximum HP',()=>{
  for(const level of [12,15]){let r=underground('dawn_sanctuary',level);const id=add(r,'swordsman','guard_stance');H.setHp(r,id,0);const herbs=r.party.ingredients.herb;r=H.cast(r,'dawn_return',{targetId:id}).run;assert.equal(H.hp(r,id),Math.min(H.maxHp(r,id),Math.ceil(H.maxHp(r,id)*.9*(level===15?1.25:1))));assert.equal(r.party.ingredients.herb,herbs-3);assert.ok(C.validateSave(r));}
  let r=underground('hero_feast',15);H.setHp(r,'hero',1);const herbs=r.party.ingredients.herb,root=r.party.ingredients.root;r=H.cast(r,'banquet_broth').run;assert.equal(H.hp(r,'hero'),H.maxHp(r));assert.ok(r.party.ingredients.herb>=herbs-2&&r.party.ingredients.herb<=herbs);assert.ok(r.party.ingredients.root>=root-1&&r.party.ingredients.root<=root);assert.ok(C.validateSave(r));
});

test('food-triggered skill restoration increases separately; base food HP and potion HP do not',()=>{
  let r=fresh('warm_soup');H.actor(r).passives=['gourmet','double_portion'];H.setHp(r,'hero',1);r.party.meals.stew=1;r=P.eat(r,'stew').run;close(H.hp(r,'hero'),1+P.RECIPES.stew.hp);assert.equal(H.buff(r,'regen'),null);
  r=fresh('warm_soup');H.actor(r).passives=['nourishment','food_sharing'];H.setHp(r,'hero',1);r.party.meals.stew=1;r=P.eat(r,'stew').run;close(H.hp(r,'hero'),1+P.RECIPES.stew.hp+1.5);close(H.buff(r,'regen').power,.3);const before=H.hp(r,'hero');H.tick(r,10);close(H.hp(r,'hero'),before+3);assert.ok(C.validateSave(r));
  r=fresh('herbal_heal');H.setHp(r,'hero',1);r=G.use(r,'heal').run;assert.equal(H.hp(r,'hero'),36);assert.ok(C.validateSave(r));
});

test('many flavors increases only its healing, not its thirty percent shield or ninety-second interval',()=>{
  const r=underground('many_flavors',15),a=H.actor(r);if(a.passives.includes('food_sharing')){const replacement=Object.values(H.PASSIVES).find(s=>s.job==='chef'&&!s.unique&&s.id!=='food_sharing'&&!a.passives.includes(s.id));a.passives=a.passives.map(key=>key==='food_sharing'?replacement.id:key);}const id=add(r,'swordsman','guard_stance');H.setHp(r,id,1);G.recipe(r,'stew');assert.equal(H.hp(r,id),1);G.recipe(r,'broth');close(H.hp(r,id),1+H.maxHp(r,id)*.375*1.35);close(H.buff(r,'barrier',id).power,H.maxHp(r,id)*.3*1.35);assert.equal(G.record(r).tasteLeft,72);assert.ok(C.validateSave(r));
});

test('forest recovery adds eighteen percent once while ordinary combo healing and mechanical recovery stay independent',()=>{
  const f=comboFixture('forest_recovery');for(const id of f.ids)H.setHp(f.run,id,1);const target=f.ids[2],soup=H.SKILLS.warm_soup.power[0]*(1+H.stats(f.run).heal),result=Co.cast(f.run,f.def.id,f.space);assert.ok(result.ok,result.message);close(H.hp(result.run,target),1+soup+H.maxHp(result.run,target)*.18);assert.equal(Co.DEFINITIONS.find(d=>d.id==='forest_recovery').effect.healPercent,18);assert.ok(C.validateSave(result.run));
  const m=comboFixture('core_reconstruction');assert.equal(m.def.effect.mechanicalHealPercent,12);const before=H.hp(m.run,'hero'),power=H.SKILLS.parts_restore.power[G.skillLevel(m.run)-1];const out=Co.cast(m.run,m.def.id,m.space);assert.ok(out.ok,out.message);close(H.hp(out.run,'hero'),Math.min(H.maxHp(out.run),before+power+H.maxHp(out.run)*.12));assert.ok(C.validateSave(out.run));
});

test('existing saves keep cooldowns, learned skills and already-granted regeneration without migration',()=>{
  const r=fresh('herbal_heal');H.actor(r).cooldowns.herbal_heal=24;H.setBuff(r,'hero','regen',9,.2);const saved=JSON.stringify(r),restored=C.validateSave(saved);assert.ok(restored);assert.equal(H.actor(restored).cooldowns.herbal_heal,24);assert.equal(H.buff(restored,'regen').power,.2);assert.deepEqual(H.actor(restored).skills,H.actor(r).skills);assert.equal(JSON.stringify(r),saved);
});

function healerAI({materials=false,hp=.4,herbs=30,x=1,blocked=false,active=false,ready=true}={}){const r=fresh('guard_stance'),id=add(r,'healer','herbal_heal','healer');G.state(r).policies[id].materials=materials;for(const skill of H.actor(r,id).skills)H.actor(r,id).cooldowns[skill]=skill==='herbal_heal'?0:300;if(!ready)H.actor(r,id).cooldowns.herbal_heal=300;r.party.ingredients.herb=herbs;H.setHp(r,'hero',H.maxHp(r)*hp);if(active)H.switchRaw(r,id);assert.ok(C.validateSave(r));return growthRuntime(r,{positions:{hero:{x:0,z:0},healer:{x,z:0}},blocked});}

test('support AI intentionally skips herb healing without material permission; permission alone does not remove other checks',()=>{
  for(const [options,shouldHeal]of [[{},false],[{materials:true},true],[{materials:true,hp:.5},false],[{materials:true,hp:.499},true],[{materials:true,herbs:0},false],[{materials:true,x:6},true],[{materials:true,x:6.01},false],[{materials:true,blocked:true},false],[{materials:true,active:true},false],[{materials:true,ready:false},false]]){const h=healerAI(options);const before=H.hp(h.run,'hero');h.ui.tick(.36);assert.equal(h.casts.length>0,shouldHeal,JSON.stringify(options));if(shouldHeal){assert.equal(h.casts[0].skill,'herbal_heal');assert.equal(h.casts[0].target,'hero');assert.ok(H.hp(h.run,'hero')>before);}else assert.equal(H.hp(h.run,'hero'),before);assert.equal(G.policy().materials,false);assert.ok(C.validateSave(h.run));}
});

test('AI cannot substitute organic healing for an injured robot or a skill it never learned',()=>{
  const h=healerAI({materials:true});const id=add(h.run,'robot','flying_fist','robot');H.setHp(h.run,'hero',H.maxHp(h.run));H.setHp(h.run,id,1);h.at[id]={x:1,z:1};h.ui.tick(.36);assert.equal(h.casts.length,0);assert.equal(H.hp(h.run,id),1);
  const r=fresh('guard_stance'),healer=add(r,'healer','revive','healer'),a=H.actor(r,healer);if(a.skills.includes('herbal_heal')){const replacement=Object.values(H.SKILLS).find(s=>s.job==='healer'&&!s.unique&&s.id!=='herbal_heal'&&!a.skills.includes(s.id));a.skills=a.skills.map(key=>key==='herbal_heal'?replacement.id:key);delete a.cooldowns.herbal_heal;a.cooldowns[replacement.id]=0;}G.state(r).policies[healer].materials=true;H.setHp(r,'hero',1);assert.ok(C.validateSave(r));const before=JSON.stringify(r),unlearned=H.cast(r,'herbal_heal',{actorId:healer,targetId:'hero'});assert.equal(unlearned.ok,false);assert.equal(JSON.stringify(r),before);const only=growthRuntime(r);only.ui.tick(.36);assert.ok(only.casts.every(c=>c.skill!=='herbal_heal'));assert.ok(C.validateSave(only.run));
});
