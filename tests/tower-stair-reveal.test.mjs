import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),St=require('../story/tower-stairs.js'),T=require('../lib/three.min.js');
const snapshot=model=>model.children.map(n=>({position:n.position.toArray(),scale:n.scale.toArray(),visible:n.visible,geometry:n.geometry,material:n.material}));
const settle=c=>{for(let i=0;i<30&&c.revealing;i++)c.frame(.05);};

test('legacy stairs remain visible until a render-only reveal controller is installed',()=>{
  const model=St.build(T),before=snapshot(model);
  assert.equal(model.visible,true);assert.equal(model.children.length,25);
  const c=St.createReveal(model);
  assert.ok(Object.isFrozen(c));assert.equal(model.visible,false);
  assert.equal(c.unlocked,false);assert.equal(c.revealing,false);assert.equal(c.progress,0);
  assert.equal(model.userData.stairUnlocked,false);assert.equal(model.userData.stairRevealProgress,0);
  assert.deepEqual(snapshot(model),before);
  assert.equal(c.frame(.1),false);assert.deepEqual(snapshot(model),before);
});

test('an unlock reveals all seven treads in sequence and settles to the exact original model',()=>{
  const model=St.build(T),before=snapshot(model),c=St.createReveal(model);
  assert.equal(St.REVEAL_SECONDS,1.2);assert.equal(c.setUnlocked(true),true);
  assert.equal(model.visible,true);assert.equal(c.progress,0);assert.equal(c.revealing,true);
  c.frame(.1);
  const steps=model.children.filter(n=>Number.isInteger(n.userData.stairStep));
  assert.equal(steps.length,14);assert.ok(steps.find(n=>n.userData.stairStep===0).visible);
  assert.equal(steps.find(n=>n.userData.stairStep===6).visible,false);
  c.frame(.25);c.frame(.25);c.frame(.15);
  assert.ok(steps.find(n=>n.userData.stairStep===6).visible);
  assert.ok(steps.find(n=>n.userData.stairStep===6).scale.y<1);
  assert.equal(steps.find(n=>n.userData.stairStep===0).scale.y,1);
  settle(c);assert.equal(c.progress,1);assert.equal(c.revealing,false);
  assert.equal(model.userData.stairRevealProgress,1);assert.deepEqual(snapshot(model),before);
});

test('reload or same-floor maze rebuild uses immediate reveal without replaying emergence',()=>{
  const model=St.build(T),before=snapshot(model),c=St.createReveal(model);
  assert.equal(c.setUnlocked(true,{immediate:true}),true);
  assert.equal(c.progress,1);assert.equal(c.revealing,false);assert.equal(model.visible,true);
  for(let i=0;i<10;i++)assert.equal(c.setUnlocked(true),false);
  assert.deepEqual(snapshot(model),before);assert.equal(c.progress,1);
  assert.equal(c.frame(.1),false);
});

test('repeated completion signals cannot restart an in-flight reveal',()=>{
  const model=St.build(T),c=St.createReveal(model);c.setUnlocked(true);c.frame(.2);
  const progress=c.progress,partial=snapshot(model);
  assert.equal(c.setUnlocked(true),false);assert.equal(c.progress,progress);
  assert.deepEqual(snapshot(model),partial);
  assert.equal(c.setUnlocked(true,{immediate:true}),false);
  assert.equal(c.revealing,false);assert.equal(c.progress,1);
  assert.ok(model.children.every(n=>n.visible&&n.scale.y===1));
});

test('reduced motion displays the completed staircase immediately and keeps its original geometry',()=>{
  const model=St.build(T),before=snapshot(model),c=St.createReveal(model,{reduced:true});
  c.setUnlocked(true);assert.equal(c.revealing,false);assert.equal(c.progress,1);
  assert.equal(model.visible,true);assert.deepEqual(snapshot(model),before);
  assert.equal(c.frame(.2),false);
});

test('invalid or paused frame deltas do not advance reveal; a long frame is bounded',()=>{
  const model=St.build(T),c=St.createReveal(model);c.setUnlocked(true);
  for(const dt of [0,-1,NaN,Infinity,-Infinity,undefined,'1'])assert.equal(c.frame(dt),false);
  assert.equal(c.progress,0);assert.equal(c.revealing,true);
  c.frame(20);assert.equal(c.progress,.25/St.REVEAL_SECONDS);
  settle(c);assert.equal(c.progress,1);
});

test('locking restores every partial transform and does not alter group placement or orientation',()=>{
  const model=St.build(T),before=snapshot(model),c=St.createReveal(model);
  model.position.set(12,0,-8);model.rotation.y=1.2;model.scale.set(1.1,1.1,1.1);
  const placement=[model.position.toArray(),model.rotation.toArray(),model.scale.toArray()];
  c.setUnlocked(true);c.frame(.25);assert.equal(c.setUnlocked(false),true);
  assert.equal(model.visible,false);assert.equal(c.progress,0);assert.equal(c.revealing,false);
  assert.deepEqual(snapshot(model),before);
  assert.deepEqual([model.position.toArray(),model.rotation.toArray(),model.scale.toArray()],placement);
  c.setUnlocked(true);assert.equal(c.progress,0);settle(c);
  assert.deepEqual(snapshot(model),before);
});

test('only a literal true unlocks; the controller cannot write completion, floor or save data',()=>{
  const model=St.build(T),c=St.createReveal(model);
  for(const value of [1,'true',null,undefined,{},false]){c.setUnlocked(value);assert.equal(model.visible,false);}
  const source=readFileSync(new URL('../story/tower-stairs.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/localStorage|setTimeout|setInterval|requestAnimationFrame|new\s+T\.(?:.*Light|Texture|CanvasTexture)/);
  assert.deepEqual(Object.keys(c).sort(),['dispose','frame','progress','revealing','setUnlocked','unlocked']);
  assert.throws(()=>St.createReveal(null),TypeError);
});

test('bounded reveal reuses the same 25 nodes, 25 geometries and three shared materials',()=>{
  const model=St.build(T),before=snapshot(model),c=St.createReveal(model);
  const geometries=new Set(model.children.map(n=>n.geometry)),materials=new Set(model.children.map(n=>n.material));
  assert.equal(materials.size,3);assert.equal(geometries.size,25);
  for(let cycle=0;cycle<50;cycle++){
    c.setUnlocked(true);settle(c);c.setUnlocked(false);
    assert.deepEqual(snapshot(model),before);assert.equal(model.children.length,25);
  }
  model.traverse(n=>assert.ok(!n.isLight));
  assert.deepEqual(new Set(model.children.map(n=>n.geometry)),geometries);
  assert.deepEqual(new Set(model.children.map(n=>n.material)),materials);
});

test('dispose is idempotent, settles transforms, and does not dispose scene-owned resources',()=>{
  const model=St.build(T),before=snapshot(model),c=St.createReveal(model);let disposed=0;
  model.children.forEach(n=>{n.geometry.addEventListener('dispose',()=>disposed++);n.material.addEventListener('dispose',()=>disposed++);});
  c.setUnlocked(true);c.frame(.15);c.dispose();c.dispose();
  assert.deepEqual(snapshot(model),before);assert.equal(c.progress,1);assert.equal(c.revealing,false);
  assert.equal(c.frame(.1),false);assert.equal(c.setUnlocked(false),false);assert.equal(disposed,0);
});
