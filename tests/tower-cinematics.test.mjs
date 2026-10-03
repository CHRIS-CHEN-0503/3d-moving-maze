import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/tower-cinematics.js'),comfort=require('../assets/camera-comfort.js');
function fixture({enabled=true,reduced=false}={}){
  const nodes=new Map(),events={},keys={},calls=[];let held=false,released=0,speaking=false,valid=true,done=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},hidden:false,textContent:'',isConnected:true,setAttribute(){},addEventListener(){},focus(){doc.activeElement=this;},querySelector:s=>node(s)});return nodes.get(id);};
  const doc={hidden:false,activeElement:null,createElement:()=>node('overlay'),addEventListener:(name,fn)=>events[name]=fn,body:{appendChild(){},classList:{add(){},remove(){}}}};
  const env={document:doc,innerHeight:390,innerWidth:844,addEventListener:(name,fn)=>keys[name]=fn};
  const camera=new T.PerspectiveCamera(70,2,.1,200);camera.position.set(5,6,7);camera.lookAt(0,0,0);const original={p:camera.position.clone(),q:camera.quaternion.clone(),f:camera.fov};
  const world=new T.Group(),target=new T.Group();world.add(target);const voice={status:()=>({enabled,supported:true,speaking,failure:''}),stop(){speaking=false;},announceAsset(...args){calls.push(args);speaking=enabled;return enabled;}};
  const foreground=new T.Group();world.add(foreground);
  const director=C.create({THREE:T,env,camera:()=>camera,player:()=>({x:0,z:4}),voice:()=>voice,foreground:()=>[foreground],available:()=>!held,valid:()=>valid,reduced:()=>reduced,hold:()=>{held=true;},release:()=>{held=false;released++;},constrain:(focus,goal)=>comfort.constrainOrbit(focus,goal,[{minX:-2,maxX:2,minZ:2,maxZ:2.7}],4)});
  const spec={target,title:'樓層主',text:'你來到了守門人的領地。先聽完我的話，再準備迎接挑戰。',asset:'lord.spire.encounter',done:()=>done++};
  const advance=seconds=>{for(let i=0;i<Math.ceil(seconds/.05);i++)director.frame(.05);};
  return {director,camera,world,target,foreground,voice,spec,advance,env,doc,events,keys,nodes,calls,original,get held(){return held;},get released(){return released;},get done(){return done;},endVoice(){speaking=false;},invalidate(){valid=false;}};
}
test('director holds combat through the actual voice, clips the camera before walls and restores exact camera state',()=>{
  const f=fixture();assert.ok(f.director.start(f.spec));assert.equal(f.held,true);f.advance(8);assert.equal(f.calls.length,1);assert.equal(f.director.active,true);assert.ok(f.camera.position.z<2);assert.ok(f.camera.position.distanceTo(f.original.p)>1);
  f.endVoice();f.advance(.1);assert.equal(f.held,false);assert.equal(f.done,1);assert.equal(f.released,1);assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());assert.deepEqual(f.camera.quaternion.toArray(),f.original.q.toArray());assert.equal(f.camera.fov,f.original.f);
});
test('voice off keeps readable subtitles then resumes, and a stalled voice has a bounded escape',()=>{
  const f=fixture({enabled:false});f.director.start(f.spec);f.advance(2);assert.ok(f.director.active);f.advance(14);assert.equal(f.done,1);
  const s=fixture();s.director.start(s.spec);s.advance(46);assert.equal(s.done,1);assert.equal(s.director.active,false);
});
test('skip completes exactly once, cancel never awards a moment and removed target restores safety',()=>{
  const f=fixture();f.director.start(f.spec);assert.equal(f.director.start(f.spec),false);f.advance(.5);f.director.skip();f.director.skip();assert.equal(f.done,1);assert.equal(f.released,1);
  f.director.start(f.spec);f.director.cancel();assert.equal(f.done,1);assert.equal(f.released,2);
  f.director.start(f.spec);f.world.remove(f.target);f.advance(.1);assert.equal(f.done,1);assert.equal(f.held,false);assert.deepEqual(f.camera.position,f.original.p);
});
test('hidden/portrait cannot silently start combat; explicit resume restarts the interrupted line',()=>{
  const f=fixture();f.director.start(f.spec);f.advance(1);f.doc.hidden=true;f.events.visibilitychange();f.advance(50);assert.equal(f.director.active,true);assert.equal(f.done,0);
  f.doc.hidden=false;f.advance(50);assert.equal(f.director.suspended,true);f.nodes.get('[data-cinema="resume"]').onclick();f.advance(1);assert.equal(f.calls.length,2);f.endVoice();f.advance(1);assert.equal(f.done,1);
  f.director.start(f.spec);f.advance(1);f.env.innerHeight=900;f.advance(50);assert.ok(f.director.suspended);f.env.innerHeight=390;f.advance(50);assert.ok(f.director.active);f.nodes.get('[data-cinema="resume"]').onclick();f.advance(1);f.endVoice();f.advance(1);assert.equal(f.done,2);
});
test('reduced motion and repeated scenes create no scene objects, loops or timers; Escape skips while other shortcuts are intercepted',()=>{
  const f=fixture({reduced:true});for(let n=0;n<50;n++){f.director.start(f.spec);f.advance(.05);assert.equal(f.nodes.get('.cinema-veil').style.opacity,'0');f.director.skip();}assert.equal(f.world.children.length,2);assert.equal(f.released,50);
  f.director.start(f.spec);let stopped=0,prevented=0;f.keys.keydown({code:'KeyX',stopImmediatePropagation(){stopped++;},preventDefault(){prevented++;}});assert.equal(stopped,1);assert.equal(prevented,1);
  f.keys.keydown({code:'Escape',stopImmediatePropagation(){},preventDefault(){}});assert.equal(f.director.active,false);
  assert.doesNotMatch(readFileSync(new URL('../story/tower-cinematics.js',import.meta.url),'utf8'),/requestAnimationFrame\s*\(|set(?:Timeout|Interval)\s*\(|new T\.(?:.*Light|WebGLRenderer|.*Geometry|.*Material)/);
});
test('foreground actors and labels are hidden only during rendering, restored even on render errors',()=>{
  const f=fixture();f.director.start(f.spec);f.director.render(()=>{assert.equal(f.foreground.visible,false);assert.equal(f.target.visible,true);});assert.equal(f.foreground.visible,true);
  assert.throws(()=>f.director.render(()=>{throw Error('render failed');}));assert.equal(f.foreground.visible,true);f.foreground.visible=false;f.director.render(()=>{});assert.equal(f.foreground.visible,false);f.director.cancel();f.director.render(()=>assert.equal(f.target.visible,true));
});
test('lord faces the shot then restores orientation; slow frame rates cannot extend the watchdog',()=>{
  const f=fixture();let now=1000;f.env.performance={now:()=>now};f.target.rotation.y=2;f.director.start({...f.spec,faceTarget:true});assert.equal(f.target.rotation.y,0);now+=500;f.director.frame(.05);assert.equal(f.calls.length,1);now+=45000;f.director.frame(.05);assert.equal(f.done,1);assert.equal(f.target.rotation.y,2);
});
