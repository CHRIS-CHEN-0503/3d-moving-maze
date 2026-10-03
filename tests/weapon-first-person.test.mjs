import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),M=require('../story/tower-combat-motion.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),build=html.slice(start,html.indexOf('\n}',start)+2);
const mode=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
// Execute the shipping standalone FP renderer, not a replacement or the
// hidden character's fp flag alone (the two were previously different paths).
const fp=mode.slice(mode.indexOf('  function updateHeroFirstPerson(){'),mode.indexOf('  function gearDescription('));
function fixture(baseKind='smith_hammer',sex='male',tier=1){
  const kind=H.tierKind(baseKind,tier),job=H.GEAR[kind].jobs[0],scene=new T.Scene(),world=new T.Group(),disposals=[];
  scene.add(world);world.position.set(.2,0,-3);world.scale.setScalar(.9);
  const env=vm.createContext({THREE:T,TowerHeroes:H,TowerCombatMotion:M,CharacterSculpt:require('../assets/character-sculpt.js'),window:{}});
  vm.runInContext(build,env);vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);
  const V=env.TowerHeroVisuals,model=V.base(job,env.buildCharacter,'hero',sex);scene.add(model);model.position.set(4,0,-7);
  env.G={view:'fp'};env.world=world;env.playerGroup=model;env.HeroVisual=V;
  env.run={job,sex,equipment:{weapon:{kind,slot:'weapon',durability:100}}};
  env.Heroes={GEAR:H.GEAR,job:r=>r.job,sex:r=>r.sex};
  env.disposeSceneObject=o=>{assert.ok(!disposals.includes(o),'old FP group disposed only once');disposals.push(o);};
  vm.runInContext('let heroFp=null,heroFpKind="";\n'+fp+'\nglobalThis.syncFP=updateHeroFirstPerson;globalThis.readFP=()=>heroFp;',env);
  V.dress(T,model,env.run.equipment,()=>{});
  return {env,V,model,world,scene,disposals};
}
function sameMatrix(actual,expected,label){
  for(let i=0;i<16;i++)assert.ok(Math.abs(actual.elements[i]-expected.elements[i])<1e-8,`${label} matrix element ${i}`);
}
const kinds=['longsword','greatsword','smith_hammer','warhammer','cooking_pan','twin_daggers','arcane_staff','spellbook','elven_bow'];
for(const kind of kinds)test(`standalone first-person ${kind} retains real contact face, both variants, sex, tiers and heading`,()=>{
  for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
    const {env,V,model,scene}=fixture(kind,sex,tier);
    for(let heading=0;heading<8;heading++)for(const variant of [0,1])for(const time of [.22,.48,.70]){
      model.rotation.y=heading*Math.PI/4;M.begin(model,'attack',1);const state=M.state(model);state.variant=variant;state.elapsed=time;
      V.pose(model,0,1,true,0);model.visible=false;env.syncFP();scene.updateMatrixWorld(true);
      const sources=model.userData.heroPieces.filter(p=>p.userData.baseKind===kind),pieces=env.readFP().children;
      assert.equal(pieces.length,kind==='twin_daggers'?2:1);assert.equal(state.elapsed,time,'no second motion tick');
      assert.ok(env.readFP().getWorldPosition(new T.Vector3()).distanceTo(model.getWorldPosition(new T.Vector3()))<1e-8,'FP sight origin follows its owner');
      for(let i=0;i<sources.length;i++){
        const expected=sources[i].matrixWorld.clone();expected.elements[13]+=.32;
        sameMatrix(pieces[i].matrixWorld,expected,kind+' '+sex+' '+tier+' '+variant+' '+heading+' '+time);
        assert.equal(pieces[i].visible,true);
      }
    }
  }
});
test('FP shares charge / skill poses, hides on exit, reuses matrices and recreates only when appearance changes',()=>{
  const {env,V,model,scene,disposals}=fixture('elven_bow','female',5);
  for(const family of ['bow','cast','support','deploy']){
    M.begin(model,'skill',1,{presentation:{motion:family}});M.state(model).elapsed=.48;V.pose(model,0,1,true,0);env.syncFP();scene.updateMatrixWorld(true);
    const source=model.userData.heroPieces[0],expected=source.matrixWorld.clone();expected.elements[13]+=.32;sameMatrix(env.readFP().children[0].matrixWorld,expected,family);
  }
  const original=env.readFP(),matrix=original.userData.poseMatrix,inverse=original.userData.parentInverse,geometry=original.children[0].children[0].geometry;
  for(let i=0;i<100;i++)env.syncFP();assert.equal(env.readFP(),original);assert.equal(original.userData.poseMatrix,matrix);assert.equal(original.userData.parentInverse,inverse);assert.equal(original.children[0].children[0].geometry,geometry);
  env.G.view='tp';env.syncFP();assert.equal(original.visible,false);assert.equal(disposals.length,0);
  env.G.view='fp';env.syncFP();assert.equal(original.visible,true);assert.equal(env.readFP(),original);
  env.run.sex='male';env.syncFP();assert.notEqual(env.readFP(),original);assert.equal(disposals.length,1);
  env.run.equipment.weapon.durability=0;V.dress(T,model,env.run.equipment,()=>{});env.syncFP();assert.equal(env.readFP().children.length,0);assert.equal(disposals.length,2);
  env.run.equipment.weapon.durability=10;V.dress(T,model,env.run.equipment,()=>{});env.syncFP();assert.equal(env.readFP().children.length,1);assert.equal(disposals.length,3);
  env.world.remove(env.readFP());env.syncFP();assert.equal(env.readFP().parent,env.world,'world reset rebuilds detached FP');
});
