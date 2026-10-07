import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js');
test('all active skills have bounded visible geometry; private resources are released once, recycled materials stay with the manager until destroy',()=>{
  for(const reducedMotion of [false,true]){const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8'),c);const world=new T.Group(),fx=c.TowerSkillEffects.create(T,{world:()=>world,limit:12,reducedMotion}),resources=new Map();
    const watch=r=>{if(resources.has(r))return;resources.set(r,0);r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1));};
    for(const s of Object.values(H.SKILLS)){const f=fx.emit(s,{x:0,z:0});assert.ok(f,s.id);for(const m of f.mats)watch(m);f.group.traverse(o=>{if(o.isMesh&&o.geometry)watch(o.geometry);});assert.ok(fx.stats().groups<=12);assert.ok(fx.stats().meshes<=96);fx.tick(.04);}
    const pooled=[...resources.keys()].filter(r=>r.userData?.sharedResource);assert.ok(pooled.length>0&&pooled.every(r=>r.isMaterial));
    fx.tick(5);fx.reset();assert.equal(world.children.length,0);assert.equal(fx.stats().groups,0);
    for(const [r,n] of resources)assert.equal(n,pooled.includes(r)?0:1,'after reset a private resource is released once and a recycled material not at all');
    fx.destroy();assert.ok([...resources.values()].every(v=>v===1),'destroy releases every recycled material exactly once');
  }
});
