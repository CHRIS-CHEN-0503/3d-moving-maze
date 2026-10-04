import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),F=require('../assets/character-face.js');
function effects(){const e=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8'),e);return e.TowerSkillEffects;}
test('eight visual identities have bounded independent onset and recovery envelopes',()=>{
  const V=effects();assert.equal(Object.keys(V.SIGNATURES).length,8);
  for(const job of Object.keys(H.JOBS)){const p=V.signatureFor({job});assert.ok(p.name.length>3);for(const t of [0,.02,.1,.3,.6,1])for(const kind of ['body','spark','ground','charge'])assert.ok(V.envelope(t,p,kind)>=0&&V.envelope(t,p,kind)<=1);assert.ok(V.envelope(.2,p,'ground')>V.envelope(.85,p,'ground'));assert.ok(V.envelope(.1,p,'spark')>V.envelope(.7,p,'spark'));assert.equal(V.envelope(1,p),0);}
});
test('warm soup mist, cleansing petals, physical strike and arcane cores differ without more draw calls',()=>{
  const V=effects(),world=new T.Group(),fx=V.create(T,{world:()=>world});
  for(const id of ['stomach_meal','cleanse','arcane_bolt','weak_pin']){const f=fx.emit(H.SKILLS[id],{x:0,z:0});assert.ok(f.group.children.length<=8);assert.ok(f.group.userData.signature);if(id==='cleanse')assert.equal(f.parts.filter(p=>p.mode==='purify').length,3);if(id==='arcane_bolt'){const core=f.group.getObjectByName('arcane-condensed-core');assert.ok(core);fx.tick(.05);assert.ok(core.scale.z/core.scale.x>1.3);}if(id==='stomach_meal')assert.ok(f.group.children.some(o=>o.name==='culinary-warmth-0'));}
  const f=fx.emit(H.SKILLS.wind_slash,{x:0,z:0},0,{impact:true,weapon:'blade'});assert.ok(f.group.getObjectByName('blade-contact-fragment'));fx.destroy();assert.equal(world.children.length,0);
});
test('facial feelings ease into focus and injury, retain blink, and never move the actor',()=>{
  const model=new T.Group(),rig=new T.Group();model.add(rig);model.userData.sculpted=false;
  const eye=()=>new T.Mesh(new T.SphereGeometry(.02,6,4),new T.MeshLambertMaterial());const eyes=[eye(),eye()];eyes.forEach(e=>rig.add(e));F.attach(T,model,rig,eyes,0,true);
  const f=model.userData.face,position=model.position.toArray();F.update(model,1);F.update(model,1.016,'focus');const first=f.brows[0].rotation.z;assert.ok(first<0&&first>-.24);
  for(let n=2;n<=45;n++)F.update(model,1+n/60,'focus');assert.ok(Math.abs(f.brows[0].rotation.z+.24)<.02);
  F.update(model,1.8,'hurt');assert.ok(f.mouth.scale.y>1.6);assert.deepEqual(model.position.toArray(),position);const record=f.expression;
  for(let n=0;n<60;n++)F.update(model,2+n/60,'happy');assert.equal(f.expression,record);assert.ok(f.brows[0].rotation.z>.14);
  const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});
