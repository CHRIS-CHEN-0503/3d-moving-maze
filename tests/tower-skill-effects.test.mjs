import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js');
test('all 49 active skills have bounded visible geometry and release all owned resources',()=>{
  for(const reducedMotion of [false,true]){const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8'),c);const world=new T.Group(),fx=c.TowerSkillEffects.create(T,{world:()=>world,limit:12,reducedMotion}),resources=new Map();
    for(const s of Object.values(H.SKILLS)){const f=fx.emit(s,{x:0,z:0});assert.ok(f,s.id);for(const m of f.mats){resources.set(m,0);m.addEventListener('dispose',()=>resources.set(m,resources.get(m)+1));}f.group.traverse(o=>{if(o.isMesh&&o.geometry){const g=o.geometry;resources.set(g,0);g.addEventListener('dispose',()=>resources.set(g,resources.get(g)+1));}});assert.ok(fx.stats().groups<=12);assert.ok(fx.stats().meshes<=96);fx.tick(.04);}
    fx.tick(5);fx.reset();assert.equal(world.children.length,0);assert.equal(fx.stats().groups,0);assert.ok([...resources.values()].every(v=>v===1));
  }
});
