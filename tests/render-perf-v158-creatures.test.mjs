import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Art=require('../story/tower-creature-art.js'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const geometryIds=()=>new T.BufferGeometry().id;
// Every geometry object created while running fn (primitives, temporaries and the final merged ones alike).
const created=fn=>{const before=geometryIds();const result=fn();return {result,count:geometryIds()-before-1,get cached(){return this.count===this.result.userData.art.drawCalls;}};};
function snapshot(model){
  const nodes=[];model.traverse(o=>{const node={name:o.name,type:o.type,parent:o.parent?.name||'',position:o.position.toArray(),visible:o.visible};
    if(o.isMesh){node.material=[o.material.type,o.material.vertexColors,o.material.transparent,o.material.opacity,o.material.color.getHex()].join();node.geometry=o.geometry.type;for(const key of ['position','normal','color']){const a=o.geometry.attributes[key];node[key]=a?Array.from(a.array):null;}const s=o.geometry.boundingSphere;node.sphere=s?[...s.center.toArray(),s.radius]:null;}
    nodes.push(node);});
  return nodes;
}
function resources(model){const set=new Set();model.traverse(o=>{if(o.geometry)set.add(o.geometry);if(o.material)set.add(o.material);});return set;}

test('the second monster of a kind and colour is vertex-for-vertex identical but sculpts nothing again',()=>{
  Art.release();
  for(const kind of Art.kinds)for(const def of [{},{color:0x728596,name:'x'}]){
    const first=created(()=>Art.build(T,kind,def)),second=created(()=>Art.build(T,kind,def));
    assert.deepEqual(snapshot(second.result),snapshot(first.result),kind);
    assert.deepEqual(second.result.userData.art,first.result.userData.art);
    assert.ok(first.count>=15,kind+' sculpted from primitives: '+first.count+' geometries');
    assert.ok(second.cached,kind+' rebuilt from cached vertex data: exactly one geometry per draw, '+second.count+' for '+second.result.userData.art.drawCalls);
  }
});

test('cached data never aliases a monster: arrays, geometry, materials and rings stay private',()=>{
  Art.release();
  for(const kind of Art.kinds){
    const a=Art.build(T,kind),b=Art.build(T,kind),ra=resources(a),rb=resources(b);
    for(const r of ra)assert.equal(rb.has(r),false,kind);
    const arrays=new Set();a.traverse(o=>{if(o.geometry)for(const attribute of Object.values(o.geometry.attributes))arrays.add(attribute.array);});
    b.traverse(o=>{if(o.geometry)for(const attribute of Object.values(o.geometry.attributes))assert.equal(arrays.has(attribute.array),false,kind+' shares a typed array');});
    const before=snapshot(b);
    a.traverse(o=>{if(o.isMesh&&o.name==='creature-sculpture')o.geometry.scale(3,3,3);});
    assert.deepEqual(snapshot(b),before,kind+': editing one monster in place cannot change another');
    const c=Art.build(T,kind);assert.deepEqual(snapshot(c),before,kind+': nor the next monster built from the cache');
  }
});

test('colour keys the cache: a different tint sculpts afresh, an explicit default tint reuses the default entry',()=>{
  Art.release();
  const base=created(()=>Art.build(T,'hound')),explicit=created(()=>Art.build(T,'hound',{color:0xff9868})),other=created(()=>Art.build(T,'hound',{color:0x2255aa}));
  assert.ok(base.count>=15&&explicit.cached&&other.count>=15);
  const colors=model=>{let out;model.traverse(o=>{if(o.name==='creature-sculpture')out=Array.from(o.geometry.attributes.color.array);});return out;};
  assert.notDeepEqual(colors(other.result),colors(base.result));assert.deepEqual(colors(explicit.result),colors(base.result));
  assert.ok(created(()=>Art.build(T,'hound',{color:0x2255aa})).cached);
  assert.ok(created(()=>Art.build(T,'wisp',{color:0xff9868})).count>=15,'another kind never reuses a hound');
});

test('the cache is bounded and evicts the least recently used colour',()=>{
  Art.release();
  const colors=Array.from({length:30},(_,i)=>0x100000+i*0x010203),hit=color=>created(()=>Art.build(T,'crab',{color})).cached;
  for(const color of colors.slice(0,24))Art.build(T,'crab',{color});
  assert.equal(hit(colors[0]),true,'the oldest entry is still there and is now the most recent');
  Art.build(T,'crab',{color:colors[24]});
  assert.equal(hit(colors[0]),true,'recently used entries survive');assert.equal(hit(colors[1]),false,'the least recently used one was evicted');
  for(const color of colors.slice(25))Art.build(T,'crab',{color});
  assert.equal(hit(colors[29]),true);assert.equal(hit(colors[2]),false,'thirty colours never keep more than the limit');
});

test('release() empties the cache for floor or tower exit without touching live monsters or the cache contract',()=>{
  Art.release();
  const live=Art.build(T,'moth'),liveShape=snapshot(live),warm=created(()=>Art.build(T,'moth'));assert.ok(warm.cached);
  Art.release();Art.release();
  const cold=created(()=>Art.build(T,'moth'));assert.ok(cold.count>=15,'the next monster sculpts again');assert.deepEqual(snapshot(cold.result),liveShape);assert.deepEqual(snapshot(live),liveShape,'a monster built earlier is untouched');
  assert.equal(typeof Art.release,'function');assert.equal(Object.isFrozen(Art),true);
});

test('scene teardown disposes a monster exactly once and cannot blacken or break its siblings or later monsters',()=>{
  Art.release();
  const c=vm.createContext({_texCache:{},spriteCache:{},makePickupMarker:{ringGeom:null,beamGeom:null,materials:{}}}),start=html.indexOf('function disposeSceneObject(root)');vm.runInContext(html.slice(start,html.indexOf('\nlet sceneEpoch=',start)),c);
  const a=Art.build(T,'mushroom'),b=Art.build(T,'mushroom'),counts=new Map();
  for(const model of [a,b])for(const r of resources(model)){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
  const world=new T.Group();world.add(a,b);world.remove(a);c.disposeSceneObject(a);
  for(const r of resources(a))assert.equal(counts.get(r),1);for(const r of resources(b))assert.equal(counts.get(r),0,'the sibling keeps every resource');
  const shape=snapshot(b),after=Art.build(T,'mushroom');assert.deepEqual(snapshot(after),shape);
  for(const r of resources(after))assert.equal(r.isBufferGeometry?r.attributes.position.count>0:true,true);
  world.remove(b);c.disposeSceneObject(b);for(const r of resources(b))assert.equal(counts.get(r),1,'no resource is released twice');
});

test('the moth keeps two independent wing nodes, in the same order, on both the first and cached builds',()=>{
  Art.release();
  for(let round=0;round<2;round++){
    const moth=Art.build(T,'moth'),wings=moth.userData.body.children.filter(o=>o.name==='party-wing');
    assert.equal(wings.length,2);assert.deepEqual(wings.map(w=>w.position.toArray()),[[-.14,.03,-.03],[.14,.03,-.03]]);
    assert.ok(wings.every(w=>w.children.length===1&&w.children[0].isMesh));assert.notEqual(wings[0].children[0].geometry,wings[1].children[0].geometry);
    assert.deepEqual(moth.userData.body.children.map(o=>o.name),['party-wing','party-wing','creature-sculpture','creature-eye-light']);
  }
});
