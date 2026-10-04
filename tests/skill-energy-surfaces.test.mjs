import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js');
function api(){const e=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8'),e);return e.TowerSkillEffects;}
test('every spell stage gains filled local energy without adding a draw, light, texture or per-frame geometry',()=>{
  const V=api();
  for(const reducedMotion of [false,true]){
    const world=new T.Group(),fx=V.create(T,{world:()=>world,reducedMotion});
    for(const skill of Object.values(H.SKILLS))for(const options of [{},{stage:'charge',duration:1.5},{stage:'land'},{impact:true}]){
      fx.reset();const f=fx.emit(skill,{x:0,z:0},0,options),ground=f.group.getObjectByName('spell-contact-light'),g=ground.geometry,phase=ground.material.userData.energyPhase;
      assert.equal(g.attributes.position.count,reducedMotion?6:102);assert.equal(g.attributes.energyLayer.count,g.attributes.position.count);assert.equal(phase.quiet.value,reducedMotion?1:0);
      assert.ok(Object.hasOwn(V.ACCENTS,ground.userData.accent));assert.ok(f.group.children.length<=8);assert.equal(fx.stats().textureBytes,49152);
      const refs=Object.values(g.attributes).map(a=>a.array);for(const dt of [.02,.03,.1])fx.tick(dt);
      assert.equal(ground.geometry,g);assert.ok(Object.values(g.attributes).every((a,i)=>a.array===refs[i]));assert.ok(phase.age.value>0&&phase.age.value<1);
      f.group.traverse(n=>assert.ok(!n.isLight&&!n.isLine));
      for(const a of Object.values(g.attributes))assert.ok(a.array.every(Number.isFinite));
    }
    fx.destroy();assert.equal(world.children.length,0);
  }
});
test('local energy has separate phases and uniform styles, but shares the compiled program key',()=>{
  const V=api(),world=new T.Group(),fx=V.create(T,{world:()=>world}),a=fx.emit(H.SKILLS.thunder_wave,{x:0,z:0});fx.tick(.12);const b=fx.emit(H.SKILLS.herbal_heal,{x:2,z:0});fx.tick(.03);
  const x=a.group.getObjectByName('spell-contact-light'),y=b.group.getObjectByName('spell-contact-light');
  assert.equal(x.userData.accent,'arcane');assert.equal(y.userData.accent,'radiant');assert.equal(x.material.customProgramCacheKey(),y.material.customProgramCacheKey());
  assert.notEqual(x.material.userData.energyPhase,y.material.userData.energyPhase);assert.ok(x.material.userData.energyPhase.age.value>y.material.userData.energyPhase.age.value);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};x.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.energyAge,x.material.userData.energyPhase.age);assert.match(shader.vertexShader,/vEnergyLayer=energyLayer/);assert.match(shader.fragmentShader,/diffuseColor.a/);assert.doesNotMatch(shader.fragmentShader,/gl_FragCoord|screenTexture/);
  assert.match(shader.fragmentShader,/exp\(-rim\*rim\)/);assert.doesNotMatch(shader.fragmentShader,/pow\(\(er-edge\)/);
  fx.destroy();
});
test('mechanical fists retain authored steel sides and gold bevels',()=>{
  const V=api(),world=new T.Group(),fx=V.create(T,{world:()=>world}),f=fx.emit(H.SKILLS.flying_fist,{x:0,z:0}),fist=f.group.children.find(n=>n.material?.isMeshPhongMaterial);
  assert.ok(fist);const {normal,color}=fist.geometry.attributes,palette=V.colorsFor(H.SKILLS.flying_fist);
  for(let i=0;i<normal.count;i++){
    const facing=Math.abs(normal.getZ(i)),expected=new T.Color(facing>.95?palette[0]:facing>.15?palette[1]:0x456373);
    assert.ok(Math.abs(color.getX(i)-expected.r)<1e-6);assert.ok(Math.abs(color.getY(i)-expected.g)<1e-6);assert.ok(Math.abs(color.getZ(i)-expected.b)<1e-6);
  }
  fx.destroy();
});
test('profession-specific energies preserve spell meaning and never replace healing with an attack burst',()=>{
  const V=api(),pairs=[['wind_slash','physical'],['thorn_growth','botanical'],['herbal_heal','radiant'],['soup_splash','vapor'],['hammer_bash','physical'],['piercing_arrow','botanical'],['flying_fist','mechanical'],['thunder_wave','arcane']];
  for(const [id,style]of pairs)assert.equal(V.accentFor(H.SKILLS[id],V.familyFor(H.SKILLS[id])),style,id);
  assert.equal(V.accentFor({job:'mage'},'sun'),'radiant');
});
test('facet shield instances keep independent age/tint and restore the same shared program after reset',()=>{
  const V=api(),world=new T.Group(),fx=V.create(T,{world:()=>world}),a=fx.emit(H.SKILLS.guard_stance,{x:0,z:0});fx.tick(.2);const b=fx.emit(H.SKILLS.barrier,{x:2,z:0});fx.tick(.1);
  const x=a.group.children.find(n=>n.userData.filledShield),y=b.group.children.find(n=>n.userData.filledShield);assert.equal(x.material,y.material);x.onBeforeRender();const age=x.material.uniforms.age.value;y.onBeforeRender();assert.ok(age>y.material.uniforms.age.value);assert.match(y.material.fragmentShader,/facet/);
  const mat=x.material;let disposed=0;mat.addEventListener('dispose',()=>disposed++);fx.reset();assert.equal(disposed,0);fx.destroy();fx.destroy();assert.equal(disposed,1);
});
