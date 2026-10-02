import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),comfort=require('../assets/camera-comfort.js');
function fixture(){
  const player=new T.Group(),head=new T.Group(),camera=new T.PerspectiveCamera();head.position.y=1.5;player.add(head);player.userData.head=head;
  const material=new T.MeshLambertMaterial({color:0x8866aa,transparent:true,opacity:.6}),body=new T.Mesh(new T.BoxGeometry(.6,.7,.4),material);player.add(body);body.position.y=1;
  camera.position.set(0,1.5,.8);return {player,head,camera,body,material};
}
const shown=(p,c,view='tp')=>comfort.render(p,c,view,()=>p.visible);
test('a nearby low third-person camera hides only during render, preserving the original model and material',()=>{
  const {player,camera,body,material}=fixture(),before=JSON.stringify({position:player.position,scale:player.scale,data:player.userData.head.uuid,body:body.position,material:material.toJSON()});
  const token={result:'drawn'};
  assert.equal(comfort.render(player,camera,'tp',()=>{assert.equal(player.visible,false);assert.equal(body.visible,true);return token;}),token);
  assert.equal(player.visible,true);assert.equal(JSON.stringify({position:player.position,scale:player.scale,data:player.userData.head.uuid,body:body.position,material:material.toJSON()}),before);
  camera.position.set(0,2.35,.1);assert.equal(shown(player,camera),false,'ordinary wall-compressed camera remains protected');
});
test('distance hysteresis prevents flicker and resets after another camera or view is selected',()=>{
  const {player,camera}=fixture();camera.position.z=1.1;assert.equal(shown(player,camera),true);
  camera.position.z=1.04;assert.equal(shown(player,camera),false);
  for(const distance of [1.06,1.2,1.33,1.1]){camera.position.z=distance;assert.equal(shown(player,camera),false);assert.equal(player.visible,true);}
  camera.position.z=1.36;assert.equal(shown(player,camera),true);camera.position.z=1.2;assert.equal(shown(player,camera),true);
  camera.position.z=.8;assert.equal(shown(player,camera),false);assert.equal(shown(player,camera,'top'),true);camera.position.z=1.2;assert.equal(shown(player,camera),true);
  camera.position.z=.8;assert.equal(shown(player,camera),false);const other=new T.PerspectiveCamera();other.position.set(0,1.5,1.2);assert.equal(shown(player,other),true);
});
test('first person, overhead, high-angle, far-away and initially hidden actors are not altered',()=>{
  const {player,camera}=fixture();for(const view of ['fp','top',null,'unknown'])assert.equal(shown(player,camera,view),true);
  camera.position.set(0,2.5,.05);assert.equal(shown(player,camera),true,'steep above-head camera is excluded even inside the near radius');
  camera.position.set(0,10,.1);assert.equal(shown(player,camera),true);camera.position.set(0,1.5,6);assert.equal(shown(player,camera),true);
  camera.position.set(0,1.5,.5);player.visible=false;assert.equal(shown(player,camera),false);assert.equal(player.visible,false);
});
test('exceptions and nested render passes restore exactly the prior visibility',()=>{
  const {player,camera}=fixture(),error=new Error('render failure');
  assert.throws(()=>comfort.render(player,camera,'tp',()=>{assert.equal(shown(player,camera),false);assert.equal(player.visible,false);throw error;}),value=>value===error);
  assert.equal(player.visible,true);camera.position.z=1.2;assert.equal(shown(player,camera),false,'nested render retains the hysteresis state');
  player.visible=false;assert.throws(()=>comfort.render(player,camera,'tp',()=>{throw error;}));assert.equal(player.visible,false);
});
test('world-space head position and character scale make translated, short and tall actors behave consistently',()=>{
  for(const size of [.8,1,1.2]){
    const {player,head,camera}=fixture(),parent=new T.Group();parent.position.set(20,4,-7);parent.rotation.y=.7;parent.scale.setScalar(size);parent.add(player);player.position.set(2,0,3);
    const target=head.getWorldPosition(new T.Vector3());camera.position.copy(target).add(new T.Vector3(.95*size,0,0));assert.equal(shown(player,camera),false,String(size));
    camera.position.copy(target).add(new T.Vector3(1.4*size,0,0));assert.equal(shown(player,camera),true);
  }
  const {player,camera}=fixture();delete player.userData.head;camera.position.set(0,1.5,.8);assert.equal(shown(player,camera),false,'plain character falls back to upper-body height');
});
test('browser export is dependency-free, runs the callback once and safely passes through absent scene actors',()=>{
  const source=readFileSync(new URL('../assets/camera-comfort.js',import.meta.url),'utf8'),context=vm.createContext({});vm.runInContext(source,context);
  assert.equal(typeof context.MazeCameraComfort.render,'function');let calls=0;
  assert.equal(context.MazeCameraComfort.render(null,null,'tp',()=>++calls),1);assert.equal(calls,1);
  const {player,camera}=fixture();camera.position.x=NaN;assert.equal(shown(player,camera),true);
  assert.doesNotMatch(source,/\b(setTimeout|setInterval|requestAnimationFrame|TextureLoader|Box3)\s*\(/);
});
const wall=(minX,maxX,minZ,maxZ)=>Object.freeze({minX,maxX,minZ,maxZ});
const point=(x,y,z)=>({x,y,z});
const almost=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('orbit constraint tests the full 3D line even when the final camera is above the wall',()=>{
  const target=Object.freeze(point(0,1.5,0)),candidate=point(0,5,6),boxes=Object.freeze([wall(-2,2,2,2.3)]),before=JSON.stringify(boxes);
  assert.equal(comfort.constrainOrbit(target,candidate,boxes,3),candidate,'reuse the supplied output vector');
  const length=Math.hypot(3.5,6),t=2/6-.18/length;
  almost(candidate.x,0);almost(candidate.y,1.5+3.5*t);almost(candidate.z,6*t);
  assert.ok(candidate.z<2&&candidate.y<3);assert.equal(JSON.stringify(boxes),before);assert.deepEqual(target,point(0,1.5,0));
});
test('genuinely clear high-angle lines and low shop shelves preserve the camera exactly',()=>{
  const boxes=Object.freeze([wall(-2,2,3,3.3)]),target=point(0,1.5,0);
  for(const [candidate,height]of [[point(0,6,5),3],[point(0,5,6),1.25],[point(0,1.5,6),1.25],[point(0,4,2),3],[point(5,4,0),3]]){
    const before={...candidate};comfort.constrainOrbit(target,candidate,boxes,height);assert.deepEqual(candidate,before);
  }
  const above=point(0,4,0),end=point(0,6,6);comfort.constrainOrbit(above,end,boxes,3);assert.deepEqual(end,point(0,6,6));
});
test('orbit takes the earliest wall independent of order and handles both signs and diagonal corner entry',()=>{
  const boxes=[wall(-1,1,4,4.3),wall(-1,1,2,2.3)],origin=point(0,1.5,0),a=point(0,1.5,8),b={...a};
  comfort.constrainOrbit(origin,a,boxes,3);comfort.constrainOrbit(origin,b,[...boxes].reverse(),3);assert.deepEqual(a,b);almost(a.z,1.82);
  const negative=point(-8,1.5,0);comfort.constrainOrbit(origin,negative,[wall(-2.3,-2,-1,1)],3);almost(negative.x,-1.82);
  const corner=point(8,1.5,8);comfort.constrainOrbit(origin,corner,[wall(2,2.3,2,2.3)],3);almost(corner.x,2-.18/Math.SQRT2);almost(corner.z,corner.x);
  const zeroMargin=point(0,1.5,8);comfort.constrainOrbit(origin,zeroMargin,boxes,3,0);almost(zeroMargin.z,2);
  const onFace=point(0,1.5,2);comfort.constrainOrbit(origin,onFace,boxes,3);almost(onFace.z,1.82,'a candidate exactly on the wall still needs padding');
});
test('near-plane and embedded-target degeneracies never reverse the camera or create invalid positions',()=>{
  const origin=point(0,1.5,0),touching=point(0,2,4);comfort.constrainOrbit(origin,touching,[wall(-1,1,.001,.3)],3);assert.deepEqual(touching,origin);
  const tiny=point(0,1.5,1e-12);comfort.constrainOrbit(origin,tiny,[wall(-1,1,1e-13,1)],3);assert.deepEqual(tiny,point(0,1.5,1e-12));
  const embedded=point(0,3,6);comfort.constrainOrbit(origin,embedded,[wall(-1,1,-1,1)],3);assert.deepEqual(embedded,point(0,3,6),'allow escape from a wall already containing the actor');
  const nextWall=point(0,1.5,6);comfort.constrainOrbit(origin,nextWall,[wall(-1,1,-1,1),wall(-1,1,3,3.3)],3);almost(nextWall.z,2.82);
  const boundary=wall(-1,1,0,1),away=point(0,1.5,-2),into=point(0,1.5,2);comfort.constrainOrbit(origin,away,[boundary],3);comfort.constrainOrbit(origin,into,[boundary],3);assert.deepEqual(away,point(0,1.5,-2));assert.deepEqual(into,origin);
  const same={...origin};comfort.constrainOrbit(origin,same,[wall(-1,1,2,2.3)],3);assert.deepEqual(same,origin);
  for(const bad of [undefined,null,NaN,-1,0]){const p=point(0,2,4);comfort.constrainOrbit(origin,p,[],bad);assert.deepEqual(p,point(0,2,4));}
  const malformed=point(0,2,4);comfort.constrainOrbit(origin,malformed,[null,{},wall(NaN,1,2,3),wall(2,-2,1,3)],3);assert.deepEqual(malformed,point(0,2,4));
});
test('3D slab test rejects walls above, below or behind the camera segment and remains stable on repeated frames',()=>{
  const origin=point(0,1.5,0),candidate=point(0,4,8),boxes=[wall(-1,1,-3,-2),wall(-1,1,2,2.3)];
  comfort.constrainOrbit(origin,candidate,boxes,3);const first={...candidate};
  for(let i=0;i<120;i++)comfort.constrainOrbit(origin,candidate,boxes,3);
  assert.deepEqual(candidate,first,'no repeated margin creep after collision was resolved');
  const below=point(0,-1,4);comfort.constrainOrbit(point(0,-2,0),below,boxes,3);assert.deepEqual(below,point(0,-1,4));
  const far=point(0,1.5,1);comfort.constrainOrbit(origin,far,boxes,3);assert.deepEqual(far,point(0,1.5,1));
  const source=readFileSync(new URL('../assets/camera-comfort.js',import.meta.url),'utf8'),helper=source.slice(source.indexOf('  function constrainOrbit'),source.indexOf('  function stateFor'));
  assert.doesNotMatch(helper,/\bnew\s|\.map\(|\.filter\(|\.slice\(|\bRaycaster\b/,'the per-frame constraint must not allocate scene objects or arrays');
});
