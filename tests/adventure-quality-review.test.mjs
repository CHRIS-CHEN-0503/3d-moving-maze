import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),Compare=require('../story/tower-equipment-compare.js'),Cue=require('../story/tower-combat-readability.js');
const fresh=job=>H.enable(P.enable(C.newRun({seed:31415,name:'review'}),job).run).run;
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}
function quality(){const e=vm.createContext({});vm.runInContext(readFileSync(new URL('../assets/render-quality.js',import.meta.url),'utf8'),e);return e.MazeQuality;}
test('automatic quality is bounded and hysteretic, and paused/background samples cannot degrade the image',()=>{
  const Q=quality(),ratios=[],control=Q.connect({setPixelRatio:r=>ratios.push(r)},{mobile:true,dpr:3});assert.equal(control.status().ratio,1.5);
  for(let i=0;i<2000;i++)control.frame(45,false);assert.equal(control.status().ratio,1.5);
  for(let i=0;i<14;i++)control.frame(100);assert.equal(control.status().ratio,1.5);
  for(let i=0;i<500;i++)control.frame(40);assert.ok(control.status().ratio<1.5);assert.ok(control.status().ratio>=.85);
  const low=control.status().ratio;for(let i=0;i<400;i++)control.frame(16.6);assert.equal(control.status().ratio,low,'recovery should not immediately bounce quality');
  for(let i=0;i<2500;i++)control.frame(16.6);assert.ok(control.status().ratio>low);assert.ok(control.status().ratio<=1.5);assert.ok(ratios.every(r=>r>=.85&&r<=1.5));
  Q.set('battery');assert.equal(control.status().ratio,1);for(let i=0;i<500;i++)control.frame(60);assert.equal(control.status().ratio,1);
  Q.set('detail');assert.equal(control.status().ratio,1.75);assert.equal(Q.set('arbitrary'),false);
});
test('equipment preview is read-only and agrees with actual two-handed equip for active and non-active actors',()=>{
  for(const activeTarget of [true,false]){
    let run=fresh('swordsman');run=P.recruit(run,P.recruitOffer(run).id).run;const id=activeTarget?'hero':run.party.members[0].id,item=C.createGear('greatsword',99,run.seed,'compare-'+id);run=C.grantGear(run,item).run;
    assert.ok(H.canEquip(run,id,item));const before=H.stats(run,id),saved=JSON.stringify(run),result=Compare.compare(H,freeze(run),id,item);assert.equal(JSON.stringify(run),saved);assert.ok(result.removesShield);
    const equipped=H.equip(run,id,item.id);assert.ok(equipped.ok,equipped.message);assert.equal(H.equipment(equipped.run,id).shield,null);const after=H.stats(equipped.run,id);
    for(const d of result.deltas){const precision=d.key==='interval'||d.key==='heal'?100:d.key==='reach'?10:1;let expected=Math.round((after[d.key]-before[d.key])*precision)/precision;if(d.key==='heal')expected=Math.round(expected*100);assert.equal(d.delta,expected,d.key);assert.equal(d.good,d.key==='interval'?expected<0:expected>0);}
  }
});
test('broken gear comparison removes its numerical effects but does not repair or alter inventory',()=>{
  const run=fresh('mage'),item={...run.equipment.weapon,id:'broken-replacement',durability:0},saved=JSON.stringify(run),result=Compare.compare(H,freeze(run),'hero',item);
  assert.equal(result.broken,true);assert.equal(result.same,false);assert.ok(result.deltas.some(d=>d.key==='spellDamage'&&d.delta<0));assert.equal(JSON.stringify(run),saved);
});
function monster(){const model=new T.Group(),body=new T.Mesh(new T.SphereGeometry(.6,8,6),new T.MeshLambertMaterial());body.scale.set(.8,1.1,.9);model.userData.body=body;model.add(body);return {alive:true,model,windup:.8,awarenessLeft:2,def:{ranged:false}};}
test('attack cues reuse their two draws and never reveal an invisible or dead monster',()=>{
  const m=monster(),a=Cue.update(T,m,{dt:.02,visible:true});assert.equal(a.group.children.length,2);const count=m.model.children.length;for(let i=0;i<100;i++)assert.equal(Cue.update(T,m,{dt:.02,visible:true}),a);assert.equal(m.model.children.length,count);
  Cue.update(T,m,{dt:.02,visible:false});assert.equal(a.group.visible,false);m.alive=false;Cue.update(T,m,{dt:.02,visible:true});assert.equal(a.group.visible,false);
  a.group.traverse(o=>{assert.ok(!o.isLight);if(o.material)assert.equal(o.material.depthWrite,false);});
});
test('hiding or killing a charging monster restores its original body proportions',()=>{
  for(const cause of ['hidden','dead']){const m=monster(),original=m.model.userData.body.scale.clone();Cue.update(T,m,{dt:.02,visible:true});assert.notDeepEqual(m.model.userData.body.scale.toArray(),original.toArray());if(cause==='dead')m.alive=false;Cue.update(T,m,{dt:.02,visible:cause!=='hidden'});assert.deepEqual(m.model.userData.body.scale.toArray(),original.toArray());}
});
test('canceled windups do not flash a fake attack and floor cues are clipped to the visible cell',()=>{
  const m=monster(),bounds={minX:-2,minZ:-2,maxX:2,maxZ:2},cue=Cue.update(T,m,{dt:.02,bounds});
  m.windup=0;Cue.update(T,m,{dt:.02,bounds});assert.equal(cue.impact,0);assert.equal(cue.group.visible,false);
  m.cueRelease=1;Cue.update(T,m,{dt:.02,bounds});assert.ok(cue.impact>0);assert.equal(cue.group.visible,true);
  assert.deepEqual(cue.material.uniforms.bounds.value.toArray(),[-2,-2,2,2]);assert.match(cue.material.fragmentShader,/worldXZ.*discard/);
});
