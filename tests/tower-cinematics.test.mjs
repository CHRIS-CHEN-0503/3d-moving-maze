import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/tower-cinematics.js'),comfort=require('../assets/camera-comfort.js');
function fixture({enabled=true,reduced=false}={}){
  const nodes=new Map(),events={},keys={},calls=[];let held=false,released=0,speaking=false,valid=true,done=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},attributes:{},hidden:false,textContent:'',isConnected:true,setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name];},addEventListener(){},focus(){doc.activeElement=this;},querySelector:s=>node(s)});return nodes.get(id);};
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
test('director drives the actor only with actual speech, closes on suspension and restores on every completion path',()=>{
  const f=fixture(),samples=[];let restored=0,playing=false,loading=true;
  f.env.TowerCinematicActors={create:()=>({sample:(time,status)=>samples.push({time,...status}),restore:()=>restored++})};
  f.voice.status=()=>({speaking:true,playing,loadingAudio:loading});
  f.director.start(f.spec);f.advance(1);assert.equal(samples.at(-1).speaking,false);assert.equal(samples.at(-1).loading,true);
  playing=true;loading=false;f.advance(.05);assert.equal(samples.at(-1).speaking,true);
  f.env.innerHeight=900;f.advance(.05);assert.equal(samples.at(-1).phase,'suspended');assert.equal(samples.at(-1).speaking,false);
  f.director.skip();assert.equal(restored,1);f.env.innerHeight=390;f.director.start(f.spec);f.director.cancel();assert.equal(restored,2);
  f.director.start({...f.spec,speechAnimation:false});f.advance(1);assert.equal(samples.at(-1).speaking,false);f.director.cancel();
});
test('animated story pages navigate without claiming completion; only skip or completion finishes, while a later action cancels',()=>{
  const f=fixture(),events=[];let frames=0,draws=0;
  const spec={...f.spec,sequence:true,caption:'只顯示故事正文，不重複標題',frame:()=>frames++,render:()=>draws++,previous:()=>events.push('prev'),next:()=>events.push('next'),leave:()=>events.push('later'),done:result=>events.push(result.skipped?'skip':'done'),shot:{focus:new T.Vector3(0,1,0),goal:new T.Vector3(0,2,6)}};
  f.director.start(spec);f.advance(1);assert.equal(f.nodes.get('p').textContent,spec.caption);assert.equal(f.calls[0][1],spec.text);f.director.render(()=>assert.fail('The independent story stage owns this draw'));assert.ok(frames>0);assert.equal(draws,1);
  f.nodes.get('[data-cinema="next"]').onclick();assert.deepEqual(events,['next']);assert.equal(f.director.active,false);assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());
  f.director.start(spec);f.nodes.get('[data-cinema="previous"]').onclick();assert.deepEqual(events,['next','prev']);
  f.director.start(spec);f.nodes.get('[data-cinema="later"]').onclick();assert.deepEqual(events,['next','prev','later']);
  f.director.start(spec);f.director.skip();assert.deepEqual(events,['next','prev','later','skip']);
  f.director.start(spec);f.advance(2);f.endVoice();f.advance(.1);assert.equal(events.at(-1),'done');
});
test('story narration off or unavailable never silently advances or marks a page complete',()=>{
  for(const unavailable of ['off','failure','stalled']){
    const f=fixture({enabled:unavailable!=='off'});let finished=0;
    if(unavailable==='failure')f.voice.status=()=>({enabled:true,supported:true,speaking:false,failure:'unavailable'});
    f.director.start({...f.spec,sequence:true,next:()=>{},done:()=>finished++});f.advance(180);
    assert.equal(f.director.active,true,unavailable);assert.equal(finished,0,unavailable);
    f.director.skip();assert.equal(finished,1);assert.equal(f.held,false);
  }
});
test('story shots use a dedicated lens and eased dolly, remain still for reduced motion, and restore the gameplay lens exactly',()=>{
  for(const reduced of [false,true]){
    const f=fixture({enabled:false,reduced}),from=new T.Vector3(-.4,2.2,6),to=new T.Vector3(.1,2,5.4),look=new T.Vector3(0,1.3,0);
    f.director.start({...f.spec,sequence:true,shot:{edition:'preview',goal:from,focus:look,goalTo:to,focusTo:new T.Vector3(.2,1.4,-.1),fov:48,duration:10}});
    f.advance(.5);const first=f.camera.position.clone();assert.equal(f.camera.fov,48);assert.deepEqual(from.toArray(),[-.4,2.2,6]);assert.deepEqual(look.toArray(),[0,1.3,0]);
    f.advance(5);assert.equal(f.camera.fov,48);
    if(reduced)assert.deepEqual(f.camera.position.toArray(),first.toArray());else{assert.ok(f.camera.position.distanceTo(first)>.1);assert.ok(f.camera.position.distanceTo(to)<first.distanceTo(to));}
    f.advance(30);assert.ok(f.camera.position.distanceTo(reduced?from:to)<1e-12);assert.ok(f.director.active);
    f.director.cancel();assert.equal(f.camera.fov,f.original.f);assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());assert.deepEqual(f.camera.quaternion.toArray(),f.original.q.toArray());
  }
});
test('short landscape framing stays above the reading panel without changing the supplied shot, and does not affect regular world moments',()=>{
  for(const height of [320,390,900]){
    const f=fixture({enabled:false,reduced:true});f.env.innerHeight=height;f.env.innerWidth=1440;
    const focus=new T.Vector3(0,1.3,0),goal=new T.Vector3(0,2.1,6);f.director.start({...f.spec,sequence:true,shot:{edition:'preview',focus,goal,fov:50}});f.advance(.5);
    const expected=new T.PerspectiveCamera(50,2,.1,200);expected.position.copy(goal);expected.lookAt(new T.Vector3(0,1.3+(height<=340?-.24:height<=420?-.13:0),0));
    assert.ok(expected.quaternion.angleTo(f.camera.quaternion)<1e-7);assert.equal(focus.y,1.3);f.director.cancel();
    f.director.start(f.spec);f.advance(.5);assert.equal(f.camera.fov,f.original.f);f.director.cancel();
  }
});
test('unapproved story environments retain the previous gameplay lens and camera composition',()=>{
  const f=fixture({enabled:false,reduced:true}),focus=new T.Vector3(0,1.35,-.1),goal=new T.Vector3(0,2.08,5.6);
  f.director.start({...f.spec,sequence:true,shot:{focus,goal,fov:48,goalTo:new T.Vector3(1,2,5)}});f.advance(8);
  assert.equal(f.camera.fov,f.original.f);assert.deepEqual(f.camera.position.toArray(),goal.toArray());f.director.cancel();
});
function film(f,cuts){return {...f.spec,sequence:true,shot:{edition:'preview',focus:new T.Vector3(0,1.3,0),goal:new T.Vector3(0,2,6),fov:48,duration:10,cuts}};}
function cuts(){return [0,4,8,11.5].map((at,index)=>({id:['wide','side','medium','face'][index],at,duration:3,goal:new T.Vector3(index*.7,2.3,7-index),goalTo:new T.Vector3(index*.7+.1,2.2,6.8-index),focus:new T.Vector3(-.9,1.6,.4),focusTo:new T.Vector3(-.8,1.6,.4),fov:56-index*4,subjects:['hero']}));}
test('a slow first stage frame cannot spend the opening action before narration starts',()=>{
  const f=fixture(),times=[];let now=1000;f.env.performance={now:()=>now};
  f.director.start({...film(f,cuts()),frame:time=>times.push(time)});
  const tick=seconds=>{now+=seconds*1000;f.director.frame(.05);};
  tick(2.8);assert.equal(f.calls.length,1);assert.equal(times.at(-1),0);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'wide');
  tick(3.95);assert.equal(times.at(-1),3.95);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'wide');
  tick(.06);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'side');assert.equal(f.calls.length,1);f.director.cancel();
});
test('loading and queued-to-playing edges anchor the film without consuming their previous waiting interval',()=>{
  const f=fixture(),times=[];let now=1000,loading=true,playing=false;
  f.env.performance={now:()=>now};f.voice.status=()=>({speaking:true,playing,loadingAudio:loading});
  f.director.start({...film(f,cuts()),frame:time=>times.push(time)});
  const tick=seconds=>{now+=seconds*1000;f.director.frame(.05);};
  tick(.5);tick(6);assert.equal(times.at(-1),0);loading=false;playing=true;tick(2.4);assert.equal(times.at(-1),0);
  tick(.8);assert.equal(times.at(-1),.8);loading=true;playing=false;tick(8);assert.equal(times.at(-1),.8);
  loading=false;tick(6);assert.equal(times.at(-1),.8);playing=true;tick(5);assert.equal(times.at(-1),.8);
  tick(3.25);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'side');assert.equal(f.calls.length,1);f.director.cancel();
});
test('approved story cast shares one narration clock, suspends both roles and restores each exactly once',()=>{
  const f=fixture(),partner=new T.Group(),roles=[];f.world.add(partner);let now=1000,loading=true,playing=false;
  f.env.performance={now:()=>now};f.voice.status=()=>({speaking:true,playing,loadingAudio:loading});
  f.env.TowerCinematicActors={create:spec=>{const role={actor:spec.actor,spec,samples:[],restored:0};roles.push(role);return {sample:(time,status)=>role.samples.push({time,...status}),restore:()=>role.restored++};}};
  const tracks=[{actor:f.target,beats:[{at:0,duration:3,gesture:'wake',mood:'reveal'}]},{actor:partner,beats:[{at:0,duration:3,gesture:'listen',mood:'thoughtful'}]}];
  const before=JSON.stringify(tracks.map(t=>t.beats));f.director.start({...film(f,cuts()),scene:f.world,actorTracks:tracks});assert.equal(roles.length,2);for(const r of roles)assert.equal(r.spec.speechAnimation,false);
  const tick=seconds=>{now+=seconds*1000;f.director.frame(.05);};tick(.5);tick(5);
  for(const r of roles){assert.equal(r.samples.at(-1).time,0);assert.equal(r.samples.at(-1).loading,true);}
  loading=false;playing=true;tick(.8);for(const r of roles)assert.equal(r.samples.at(-1).time,0);tick(.8);assert.ok(roles[0].samples.at(-1).time>.7);assert.equal(roles[0].samples.at(-1).time,roles[1].samples.at(-1).time);assert.equal(f.calls.length,1);
  f.env.innerHeight=900;tick(.1);const frozen=roles[0].samples.at(-1).time;tick(120);
  for(const r of roles){assert.equal(r.samples.at(-1).time,frozen);assert.equal(r.samples.at(-1).phase,'suspended');assert.equal(r.samples.at(-1).speaking,false);}
  f.env.innerHeight=390;f.nodes.get('[data-cinema="resume"]').onclick();tick(.5);assert.equal(f.calls.length,2);for(const r of roles)assert.ok(r.samples.at(-1).time<.2);
  f.director.cancel();f.director.cancel();for(const r of roles)assert.equal(r.restored,1);assert.equal(JSON.stringify(tracks.map(t=>t.beats)),before);assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());assert.deepEqual(f.camera.quaternion.toArray(),f.original.q.toArray());
});
test('malformed or foreign story casts deterministically fall back to the original featured role',()=>{
  for(const type of ['empty','too-many','duplicate','foreign','unattached','missing']){
    const f=fixture(),other=new T.Group(),foreign=new T.Group();f.world.add(other);foreign.add(new T.Group());let created=0,received;
    f.env.TowerCinematicActors={create:spec=>{created++;received=spec;return {sample(){},restore(){}};}};
    const roles=type==='empty'?[]:type==='too-many'?[{actor:f.target},{actor:other},{actor:foreign.children[0]}]:type==='duplicate'?[{actor:f.target},{actor:f.target}]:type==='foreign'?[{actor:foreign.children[0]}]:type==='unattached'?[{actor:foreign}]:[{}];
    f.director.start({...film(f,cuts()),scene:f.world,actorTracks:roles});assert.equal(created,1,type);assert.equal(received.target,f.target,type);f.director.cancel();
  }
});
test('unapproved story stages and ordinary lord dialogue do not use preview cast tracks',()=>{
  for(const sequence of [false,true]){
    const f=fixture(),received=[];f.env.TowerCinematicActors={create:spec=>{received.push(spec);return {sample(){},restore(){}};}};
    f.director.start({...f.spec,sequence,actorTracks:[{actor:f.target,beats:[{at:0,duration:3,gesture:'wake'}]}],shot:{focus:new T.Vector3(0,1.3,0),goal:new T.Vector3(0,2,6)}});
    assert.equal(received.length,1);assert.equal(received[0].target,f.target);assert.equal(received[0].speechAnimation,undefined);f.director.cancel();
  }
});
test('four authored film angles cut at the beat, ease only within a shot, and keep one unchanged narration',()=>{
  const f=fixture({enabled:false}),sequence=cuts(),before=JSON.stringify(sequence);f.director.start(film(f,sequence));
  const overlay=f.nodes.get('overlay');f.advance(.5);assert.equal(overlay.getAttribute('data-shot'),'wide');assert.equal(f.camera.fov,56);assert.equal(overlay.getAttribute('data-shot-subjects'),'hero');
  f.advance(3.8);assert.equal(overlay.getAttribute('data-shot-index'),'0');const preceding=f.camera.position.clone();f.advance(.2);
  assert.equal(overlay.getAttribute('data-shot'),'side');assert.equal(f.camera.fov,52);assert.ok(f.camera.position.distanceTo(preceding)>.6,'hard edit, not a flight between angles');
  f.advance(4);assert.equal(overlay.getAttribute('data-shot'),'medium');assert.equal(f.camera.fov,48);f.advance(3.5);assert.equal(overlay.getAttribute('data-shot'),'face');assert.equal(f.camera.fov,44);
  f.advance(20);assert.ok(f.camera.position.distanceTo(sequence[3].goalTo)<1e-10);assert.equal(f.calls.length,1);assert.equal(f.calls[0][1],f.spec.text);assert.equal(f.done,0);assert.equal(JSON.stringify(sequence),before);
  f.director.cancel();assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());assert.deepEqual(f.camera.quaternion.toArray(),f.original.q.toArray());assert.equal(f.camera.fov,f.original.f);
});
test('buffering and queued voice cannot silently consume film angles before actual speech; manual silent reading still permits the edits',()=>{
  const f=fixture(),actorTimes=[],environmentTimes=[];let loading=true,playing=false;f.env.TowerCinematicActors={create:()=>({sample(time){actorTimes.push(time);},restore(){}})};f.voice.status=()=>({speaking:true,loadingAudio:loading,playing});f.director.start({...film(f,cuts()),frame:time=>environmentTimes.push(time)});
  f.advance(6);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'wide');assert.equal(actorTimes.at(-1),0);assert.equal(environmentTimes.at(-1),0);const pending=f.camera.position.clone();loading=false;f.advance(4);assert.deepEqual(f.camera.position.toArray(),pending.toArray(),'queued, not actually speaking');assert.equal(actorTimes.at(-1),0);
  playing=true;f.advance(4.1);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'side');assert.ok(actorTimes.at(-1)>=4);assert.equal(actorTimes.at(-1),environmentTimes.at(-1));assert.equal(f.calls.length,1);f.director.skip();assert.equal(f.released,1);
});
test('reduced motion freezes the first authored angle through all beats and does not change source vectors',()=>{
  const f=fixture({enabled:false,reduced:true}),sequence=cuts(),before=JSON.stringify(sequence);f.director.start(film(f,sequence));f.advance(.5);const first={p:f.camera.position.toArray(),q:f.camera.quaternion.toArray(),f:f.camera.fov};f.advance(180);
  assert.deepEqual({p:f.camera.position.toArray(),q:f.camera.quaternion.toArray(),f:f.camera.fov},first);assert.equal(f.nodes.get('overlay').getAttribute('data-shot-index'),'0');assert.equal(f.done,0);assert.equal(JSON.stringify(sequence),before);f.director.skip();assert.equal(f.released,1);
});
test('background and portrait freeze all edits and explicit resume restarts the film and narration together',()=>{
  for(const mode of ['background','portrait']){
    const f=fixture();f.director.start(film(f,cuts()));f.advance(5);assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'side');
    if(mode==='background'){f.doc.hidden=true;f.events.visibilitychange();}else f.env.innerHeight=900;
    f.advance(.05);const held={p:f.camera.position.toArray(),q:f.camera.quaternion.toArray(),f:f.camera.fov};f.advance(100);assert.deepEqual({p:f.camera.position.toArray(),q:f.camera.quaternion.toArray(),f:f.camera.fov},held);assert.equal(f.done,0);
    f.doc.hidden=false;f.env.innerHeight=390;f.advance(5);assert.ok(f.director.suspended);f.nodes.get('[data-cinema="resume"]').onclick();f.advance(.6);
    assert.equal(f.nodes.get('overlay').getAttribute('data-shot'),'wide');assert.equal(f.calls.length,2);f.director.cancel();assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());assert.equal(f.camera.fov,f.original.f);
  }
});
test('invalid shot timelines fall back safely and other environments ignore preview-only edits',()=>{
  for(const mutate of [list=>list[0].at=1,list=>list[1].at=0,list=>list[1].at=-2,list=>list[1].at=Infinity,list=>list[1].goal.x=NaN,list=>list[1].focusTo={x:0,y:1,z:0},list=>list[1].goal.copy(list[1].focus),list=>list[1].fov='wide',list=>list[1].duration=0,list=>list.push(...cuts(),...cuts())]){
    const f=fixture({enabled:false,reduced:true}),sequence=cuts();mutate(sequence);f.director.start(film(f,sequence));f.advance(1);assert.equal(f.nodes.get('overlay').getAttribute('data-shot-index'),'-1');assert.deepEqual(f.camera.position.toArray(),[0,2,6]);assert.equal(f.camera.fov,48);f.director.cancel();
  }
  const f=fixture({enabled:false,reduced:true}),spec=film(f,cuts());delete spec.shot.edition;f.director.start(spec);f.advance(20);assert.equal(f.camera.fov,f.original.f);assert.deepEqual(f.camera.position.toArray(),[0,2,6]);assert.equal(f.nodes.get('overlay').getAttribute('data-shot-index'),'-1');f.director.cancel();
  const code=readFileSync(new URL('../story/tower-cinematics.js',import.meta.url),'utf8');assert.doesNotMatch(code.slice(code.indexOf('    function frame(dt)'),code.indexOf('    function render(draw)')),/\bnew\s|\.map\(|\.filter\(/,'shot sampling has no allocations');
});
test('authored handheld sway breathes only within polished cuts, stays within a few centimetres, is off for reduced motion and restores exactly',()=>{
  const swaying=()=>cuts().map(cut=>({...cut,sway:.03})),reference=fixture({enabled:false}),steady=fixture({enabled:false}),calm=fixture({enabled:false,reduced:true});
  reference.director.start(film(reference,swaying()));steady.director.start(film(steady,cuts()));calm.director.start(film(calm,swaying()));
  let largest=0,moved=false;
  for(let n=0;n<60;n++){for(const f of [reference,steady,calm])f.advance(.2);const offset=reference.camera.position.distanceTo(steady.camera.position);largest=Math.max(largest,offset);if(offset>.005)moved=true;assert.equal(reference.nodes.get('overlay').getAttribute('data-shot'),steady.nodes.get('overlay').getAttribute('data-shot'));}
  assert.ok(moved,'the lens breathes');assert.ok(largest<=.03*Math.hypot(1,.6)+1e-9,'sway is bounded: '+largest);
  const still=calm.camera.position.clone();calm.advance(3);assert.deepEqual(calm.camera.position.toArray(),still.toArray(),'reduced motion stays locked');
  const invalid=fixture({enabled:false});invalid.director.start(film(invalid,cuts().map(cut=>({...cut,sway:Infinity}))));invalid.advance(.5);for(let n=0;n<20;n++)invalid.advance(.2);assert.ok(invalid.camera.position.toArray().every(Number.isFinite));
  for(const f of [reference,steady,calm,invalid]){f.director.cancel();assert.deepEqual(f.camera.position.toArray(),f.original.p.toArray());assert.deepEqual(f.camera.quaternion.toArray(),f.original.q.toArray());assert.equal(f.camera.fov,f.original.f);}
});
