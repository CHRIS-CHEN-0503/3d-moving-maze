import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),A=require('../story/tower-environment-life.js');
test('ten environments have distinct coherent life without added textures, lights or collisions',()=>{
  assert.equal(Object.keys(A.PROFILES).length,10);for(const style of Object.keys(A.PROFILES)){const world=new T.Group(),a=A.create(T,{style,seed:17,world:()=>world,player:()=>({x:0,z:0}),visible:x=>x>0,clear:()=>true});assert.equal(a.cloud.isPoints,true);assert.equal(a.cloud.userData.role,'scenery');a.tick(.016);assert.equal(a.stats().drawCalls,1);assert.equal(a.stats().points,24);assert.equal(a.stats().textureBytes,0);assert.ok(Array.from(a.cloud.geometry.attributes.position.array).every(Number.isFinite));assert.ok(a.cloud.geometry.attributes.visible.array.some(n=>n===0)&&a.cloud.geometry.attributes.visible.array.some(n=>n===1));assert.equal(world.children.length,1);a.destroy();assert.equal(world.children.length,0);}
});
test('world samples are stable, capped at ten Hz and remain behind LOS and wall gates',()=>{
  const world=new T.Group(),a=A.create(T,{style:'fire',seed:12,world:()=>world,player:()=>({x:2,z:4}),visible:()=>true,clear:()=>false});a.tick(.001);const initial=Array.from(a.cloud.geometry.attributes.position.array);assert.ok(a.cloud.geometry.attributes.visible.array.every(n=>n===0));const checks=a.stats().checks;for(let n=0;n<5;n++)a.tick(.016);assert.equal(a.stats().checks,checks);a.tick(.04);assert.equal(a.stats().checks,checks+24);assert.deepEqual(Array.from(a.cloud.geometry.attributes.position.array),initial);a.destroy();
});
test('reduced motion, battery budget, invalid clocks and exact disposal are honored',()=>{
  let reduced=true;const world=new T.Group(),a=A.create(T,{style:'books',seed:2,world:()=>world,player:()=>({x:0,z:0}),reduced:()=>reduced,quality:()=> 'battery'});let geometry=0,material=0;a.cloud.geometry.addEventListener('dispose',()=>geometry++);a.cloud.material.addEventListener('dispose',()=>material++);
  a.tick(.1);assert.equal(a.cloud.visible,false);assert.equal(a.stats().checks,0);reduced=false;a.tick(.1);assert.equal(a.cloud.geometry.attributes.visible.array.reduce((n,a)=>n+a,0),8);const time=a.cloud.material.uniforms.age.value;for(const dt of [0,-1,NaN,Infinity])a.tick(dt);assert.equal(a.cloud.material.uniforms.age.value,time);a.destroy();a.destroy();a.tick(.1);assert.equal(geometry,1);assert.equal(material,1);assert.equal(a.stats().drawCalls,0);
});
test('the root follows the observer for main-view visibility while point gates retain world coordinates',()=>{
  let p={x:22,z:-18},checks=[];const world=new T.Group(),a=A.create(T,{style:'garden',seed:2,world:()=>world,player:()=>p,visible:(x,z)=>{checks.push([x,z]);return Math.hypot(x-p.x,z-p.z)<3;},clear:()=>true});
  a.tick(.1);assert.deepEqual(a.cloud.position.toArray(),[22,0,-18]);world.updateMatrixWorld(true);
  const offsets=Array.from(a.cloud.geometry.attributes.position.array);for(let i=0;i<24;i++){const sample=new T.Vector3(offsets[i*3],offsets[i*3+1],offsets[i*3+2]);a.cloud.localToWorld(sample);assert.ok(Math.abs(sample.x-checks[i][0])<1e-5);assert.ok(Math.abs(sample.z-checks[i][1])<1e-5);}
  p={x:20,z:-16};a.tick(.01);assert.deepEqual(a.cloud.position.toArray(),[20,0,-16]);assert.deepEqual(Array.from(a.cloud.geometry.attributes.position.array),offsets);
  p=null;a.tick(.1);assert.equal(a.cloud.visible,false);a.destroy();
});
test('real main-view filtering preserves nearby atmosphere even when the maze centre is hidden',()=>{
  const ctx=vm.createContext({MazeSightCore:require('../assets/maze-sight-core.js'),performance:{now:()=>1000}});vm.runInContext(readFileSync(new URL('../assets/maze-sight.js',import.meta.url),'utf8'),ctx);const sight=ctx.MazeSight;
  const g={mazeW:3,mazeH:3,cell:4,wallH:3,wallT:.3,wallBoxes:[],hWalls:Array.from({length:2},()=>Array(3).fill(false)),vWalls:Array.from({length:3},()=>[true,false]),view:'tp',px:-4,pz:0},scene=new T.Scene(),wall=new T.InstancedMesh(new T.BoxGeometry(1,3,1),new T.MeshBasicMaterial(),2);scene.add(wall);
  const a=A.create(T,{style:'crystal',seed:17,world:()=>scene,player:()=>({x:g.px,z:g.pz}),visible:(x,z)=>sight.visible(x,z)}),frame={T,g,scene,wall,radius:8,force:true,objects:()=>[a.cloud]};
  sight.update(frame);assert.equal(sight.visible(0,0),false);a.tick(.1);scene.updateMatrixWorld(true);let renders=0;
  sight.render(frame,{render(){renders++;assert.equal(a.cloud.visible,true);assert.ok(a.cloud.geometry.attributes.visible.array.some(n=>n===1));}},null);
  assert.equal(renders,1);a.destroy();sight.reset();wall.geometry.dispose();wall.material.dispose();wall.dispose();
});
