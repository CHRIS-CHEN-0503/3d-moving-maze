import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),A=require('../story/tower-ascension-catalog.js'),G=require('../story/tower-hero-growth.js'),M=require('../story/tower-combat-motion.js'),Audio=require('../assets/combat-audio.js'),T=require('../lib/three.min.js');
const fxContext=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8'),fxContext);const V=fxContext.TowerSkillEffects;

test('nine professions continue both actual level-ten ultimates with 36 unique, branch-bound skills',()=>{
  const bases=[...G.actives,...G.passives.filter(s=>s.unique)];
  assert.equal(bases.length,18);assert.equal(Object.keys(A.BY_JOB).length,9);
  assert.equal(A.actives.length,18);assert.equal(A.passives.length,18);
  const ids=new Set();
  for(const base of bases){
    const b=A.BRANCHES[base.id];assert.ok(b,base.id);assert.equal(b.job,base.job);
    assert.equal(b.kind,base.attack===undefined?'passive':'active');
    assert.equal(A.BY_JOB[base.job][b.kind],b);
    assert.deepEqual(b.steps.map(s=>s.level),[12,15]);
    for(const step of b.steps){const s=A.SKILLS[step.id]||A.PASSIVES[step.id];assert.ok(s);assert.equal(s.job,base.job);assert.equal(s.unique,true);assert.deepEqual(s.ascension,{base:base.id,level:step.level});assert.equal(s.power.length,6);assert.ok(s.power.every(v=>Number.isFinite(v)&&v>0));assert.equal(ids.has(s.id),false);ids.add(s.id);}
  }
  assert.equal(ids.size,36);for(const job of Object.keys(A.BY_JOB))assert.equal(A.forJob(job).length,2);
});

test('catalog is independent of engine state, immutable, and threshold queries cannot grant the other branch',()=>{
  const browser=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-ascension-catalog.js',import.meta.url),'utf8'),browser);
  const standalone=browser.TowerAscensionCatalog;assert.equal(Object.keys(standalone.SKILLS).length,18);
  for(const b of Object.values(A.BRANCHES)){
    assert.deepEqual(A.earned(b.id,10),[]);assert.deepEqual(A.earned(b.id,11),[]);
    assert.deepEqual(A.earned(b.id,12).map(s=>s.id),[b.steps[0].id]);
    assert.deepEqual(A.earned(b.id,14).map(s=>s.id),[b.steps[0].id]);
    assert.deepEqual(A.earned(b.id,15).map(s=>s.id),b.steps.map(s=>s.id));
    assert.ok(A.earned(b.id,15).every(s=>s.ascension.base===b.id));
  }
  assert.deepEqual(A.earned('not-a-branch',15),[]);assert.deepEqual(A.earned('star_ring',NaN),[]);assert.deepEqual(A.forJob('unknown'),[]);
  assert.throws(()=>{A.SKILLS.worldroot_arrow.params.rootSeconds=60;},TypeError);
  assert.throws(()=>A.BRANCHES.star_ring.steps.push({level:1,id:'invalid'}),TypeError);
});

test('active skills use implemented effect families and control durations stay within saved-state bounds',()=>{
  const supported=new Set(['decisive','stagger','starfall','shock','speed','mark','soup','barrier','revive','ward','fortify','repair','binding','volley','robot_double','mech_aid','kami']);
  const limits={duration:[0,30],stunSeconds:[0,3],slowSeconds:[0,60],slowPower:[0,1],rootSeconds:[0,3],markSeconds:[0,60],weak:[0,1],blindSeconds:[0,10],reach:[0,8],maxTargets:[0,3],knockback:[0,1.5],radius:[0,4],shieldDuration:[0,300],allyShield:[0,20]};
  for(const s of A.actives){
    assert.ok(supported.has(s.effect),s.id);assert.equal(typeof s.attack,'boolean');assert.ok(s.cooldown>=20&&s.cooldown<=120);
    for(const [param,value] of Object.entries(s.params||{})){assert.ok(limits[param],param);assert.ok(Number.isFinite(value)&&value>limits[param][0]&&value<=limits[param][1],s.id+':'+param);}
    assert.ok(Object.entries(s.cost).every(([key,count])=>['shell','herb','root','nectar','meat','mushroom'].includes(key)&&Number.isInteger(count)&&count>0));
    if(s.preparation!==undefined)assert.ok(s.preparation>0&&s.preparation<=4);
    assert.ok(s.description.length<110,s.id);
  }
});

test('masteries strengthen only their selected ultimate and continuation without granting or chaining mastery',()=>{
  for(const p of A.passives){const b=A.BRANCHES[p.ascension.base],m=p.modifiers;
    assert.equal(p.attack,undefined);assert.equal(p.effect,'branch_mastery');
    assert.deepEqual(m.targets,[b.ultimate,b.steps[0].id]);assert.equal(m.targets.includes(p.id),false);
    assert.ok(m.powerPct>=25&&m.powerPct<=35);assert.ok(m.cooldownPct>=10&&m.cooldownPct<=20);
    assert.ok(m.targets.every(key=>!A.PASSIVES[key]));
  }
});

test('continuation visuals keep class-specific palettes and bounded geometry in normal and reduced modes',()=>{
  for(const reducedMotion of [false,true]){
    const world=new T.Group(),fx=V.create(T,{world:()=>world,reducedMotion,limit:12});
    for(const s of A.actives){
      const f=fx.emit(s,{x:2,z:3});assert.ok(f,s.id);assert.equal(f.family,s.presentation.family);
      assert.deepEqual([...V.colorsFor(s)],s.presentation.colors);
      assert.ok(f.mats.some(m=>m.color?.getHex()===s.presentation.colors[0]||m.color?.getHex()===s.presentation.colors[1]));
      f.group.traverse(o=>{assert.notEqual(o.isLight,true);assert.notEqual(o.isLine,true);});
      fx.tick(.03);assert.ok(fx.stats().groups<=12);assert.ok(fx.stats().meshes<=96);assert.ok(fx.stats().particles<=12*(reducedMotion?12:48));
    }
    fx.tick(5);assert.equal(fx.stats().groups,0);assert.equal(world.children.length,0);fx.destroy();assert.equal(fx.stats().textureBytes,0);
  }
  assert.equal(V.familyFor(A.SKILLS.nourishing_brew),'shield');assert.equal(V.familyFor(A.SKILLS.worldroot_arrow),'thorns');
  const invalid={effect:'heal',job:'healer',presentation:{family:'fullscreen',colors:[NaN,Infinity]}};
  assert.equal(V.familyFor(invalid),'heal');assert.ok([...V.colorsFor(invalid)].every(Number.isInteger));
});

test('new actions have corresponding finite, audible, short synth effects and intentional motion tracks',()=>{
  for(const s of A.actives){
    assert.equal(Audio.skillKind(s),s.id==='explosive_fists'?'robot':s.presentation.sound);const data=Audio.render(Audio.skillKind(s));
    assert.ok(data.length>0&&data.length<=Audio.RATE);assert.ok(data.every(v=>Number.isFinite(v)&&Math.abs(v)<1));assert.ok(data.some(v=>Math.abs(v)>.1));assert.equal(data[0],0);assert.equal(data.at(-1),0);
    const model={userData:{heroWeapon:s.job==='archer'?'elven_bow_t5':s.job==='healer'?'spellbook_t5':'longsword_t5'}};
    M.begin(model,'skill',.8,s);assert.equal(M.state(model).family,s.presentation.motion);
    for(let i=0;i<12;i++)assert.ok(Object.values(M.update(model,.08)).every(Number.isFinite));
  }
  assert.equal(Audio.skillKind({effect:'soup',presentation:{sound:'unknown'}}),'heal');assert.equal(M.familyFor({effect:'speed',presentation:{motion:'unknown'}}),M.FAMILIES.speed);
  assert.equal(M.familyFor(A.SKILLS.windward_march),'scout');assert.equal(M.familyFor(A.SKILLS.nourishing_brew),'cook');
});

test('fourth and fifth weapon tiers preserve their weapon motion rather than falling back to bare hands',()=>{
  for(const weapon of Object.keys(M.WEAPONS).filter(k=>k!=='unarmed'))for(const tier of [4,5])for(const variant of [0,1]){
    for(const action of ['attack','charge','skill'])for(const phase of [.15,.35,.6,.9,1])assert.deepEqual(M.sample(weapon+'_t'+tier,action,variant,phase,false,'heavy'),M.sample(weapon,action,variant,phase,false,'heavy'),weapon+':'+tier+':'+action);
  }
});
