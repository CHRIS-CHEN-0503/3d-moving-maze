import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Actors=require('../story/tower-cinematic-actors.js');
const source=readFileSync(new URL('../story/tower-cinematic-actors.js',import.meta.url),'utf8');
function model({authored=true}={}){
  const actor=new T.Group(),head=new T.Group(),body=new T.Group(),arms=[new T.Group(),new T.Group()],legs=[new T.Group(),new T.Group()],mouth=new T.Mesh(new T.PlaneGeometry(.12,.02),new T.MeshBasicMaterial());
  actor.add(body);body.add(head,...arms,...legs);head.add(mouth);
  head.position.set(.02,1.8,.04);head.rotation.set(.12,.21,-.05,'YXZ');head.scale.set(1.1,.8,1.2);body.position.set(.01,.9,.02);body.scale.y=.92;
  arms[0].position.x=.6;arms[1].position.x=-.6;legs[0].position.x=.2;legs[1].position.x=-.2;
  mouth.position.set(0,-.1,.3);mouth.scale.set(.85,1.12,1);mouth.visible=false;
  const eyes=[new T.Group(),new T.Group()],brows=[new T.Group(),new T.Group()],lips=[new T.Group(),new T.Group()],whites=[new T.Group(),new T.Group()],lids=[new T.Group(),new T.Group()],pupils=[new T.Group(),new T.Group()],corners=[new T.Group(),new T.Group()],teeth=new T.Group();
  for(const group of [eyes,brows,lips,whites,lids,pupils,corners])head.add(...group);head.add(teeth);
  corners[0].position.set(-.056,-.08,.3);corners[1].position.set(.056,-.08,.3);teeth.visible=false;
  actor.position.set(10,.7,-6);actor.rotation.set(.3,2.4,-.15,'ZYX');actor.scale.set(2.3,1.8,1.4);
  Object.assign(actor.userData,{head,body,armL:arms[0],armR:arms[1],legL:legs[0],legR:legs[1],face:{mouth,eyes,brows,lips,whites,lids,pupils,corners,teeth,mood:'hurt',time:101,left:1.7,reaction:'hurt'},hp:77,motion:{action:'attack',elapsed:.2,duration:.8}});
  if(authored)actor.userData.cinemaRig={head,torso:body,arms,legs,mouth,eyes,brows};
  return {actor,head,body,arms,legs,mouth,eyes,brows,lips,whites,lids,pupils,corners,teeth};
}
function snapshot(actor){const rows=[];actor.traverse(n=>rows.push({node:n,p:n.position.toArray(),r:n.rotation.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray(),visible:n.visible,children:[...n.children]}));return rows;}
function assertSnapshot(rows){for(const row of rows){assert.deepEqual(row.node.position.toArray(),row.p);assert.deepEqual(row.node.rotation.toArray(),row.r);assert.deepEqual(row.node.quaternion.toArray(),row.q);assert.deepEqual(row.node.scale.toArray(),row.s);assert.equal(row.node.visible,row.visible);assert.deepEqual(row.node.children,row.children);}}
function resources(actor){const all=new Set();actor.traverse(node=>{if(node.geometry)all.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){all.add(material);for(const value of Object.values(material))if(value?.isTexture)all.add(value);}});return all;}
function heroEnvironment(){
  const env=vm.createContext({THREE:T,CharacterSculpt:require('../assets/character-sculpt.js'),CharacterFace:require('../assets/character-face.js'),TowerHeroes:require('../story/tower-heroes-core.js')});env.window=env;
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter(cd)'),end=html.indexOf('\n}',start)+2;
  vm.runInContext(html.slice(start,end),env);vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);return env;
}

test('browser and common module expose the same bounded render-only API, without audio, loops, geometry or per-frame random draws',()=>{
  const context=vm.createContext({});vm.runInContext(source,context);assert.equal(typeof context.TowerCinematicActors.create,'function');
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|set(?:Timeout|Interval)\s*\(|new\s+(?:T|THREE)\.|Math\.random\s*\(|\.userData\.[\w]+\s*=|(?:CharacterFace|CharacterMotion)\.(?:react|update|begin)/);
  for(const target of [null,{},new T.Group()]){const session=Actors.create({target});assert.equal(session.sample(1,{speaking:true}),false);assert.equal(session.restore(),false);}
});
test('speech animates authored head, torso, arms and mouth while root transform, health and gameplay motion never change',()=>{
  const f=model(),base=snapshot(f.actor),root=base[0],face={...f.actor.userData.face},motion={...f.actor.userData.motion};
  const session=Actors.create({target:f.actor,performance:'challenge',personality:'furnace'});
  const mouths=new Set(),heads=new Set(),arms=new Set();for(let n=0;n<90;n++){session.sample(n/30,{speaking:true,phase:'playing'});mouths.add(f.mouth.scale.y);heads.add(f.head.rotation.x);arms.add(f.arms[1].rotation.x);assert.deepEqual(f.actor.position.toArray(),root.p);assert.deepEqual(f.actor.quaternion.toArray(),root.q);}
  assert.ok(mouths.size>30&&heads.size>30&&arms.size>30);assert.notEqual(f.body.scale.y,base[1].s[1]);assert.equal(f.mouth.visible,true);assert.equal(f.actor.userData.hp,77);assert.deepEqual(f.actor.userData.face,face);assert.deepEqual(f.actor.userData.motion,motion);
  assert.ok(session.restore());assertSnapshot(base);assert.equal(session.restore(),false);assert.equal(session.sample(5,{speaking:true}),false);assertSnapshot(base);
});
test('no voice, buffering, loading or silent phase never open the mouth; suspension freezes joints and closes speech',()=>{
  const f=model(),base=snapshot(f.actor),session=Actors.create({target:f.actor,performance:'guide'}),original=f.mouth.scale.toArray();
  for(const state of [{speaking:false},{speaking:true,loading:true},{speaking:true,phase:'loading'},{speaking:true,phase:'silent'}]){session.sample(1.7,state);assert.deepEqual(f.mouth.scale.toArray(),original);assert.equal(f.mouth.visible,false);}
  session.sample(2,{speaking:true});const head=f.head.quaternion.toArray(),arm=f.arms[0].quaternion.toArray();assert.notDeepEqual(f.mouth.scale.toArray(),original);
  session.sample(500,{speaking:true,phase:'suspended'});assert.deepEqual(f.head.quaternion.toArray(),head);assert.deepEqual(f.arms[0].quaternion.toArray(),arm);assert.deepEqual(f.mouth.scale.toArray(),original);assert.equal(f.mouth.visible,false);
  session.sample(2.1,{speaking:true});assert.notDeepEqual(f.mouth.scale.toArray(),original);session.restore();assertSnapshot(base);
});
test('reduced motion scales down the same performance, with no camera/root shake or unsupported scenery animation',()=>{
  const f=model(),normal=Actors.create({target:f.actor,performance:'challenge'});normal.sample(1.5,{speaking:false});const armAmplitude=Math.abs(f.arms[1].rotation.x);normal.restore();
  const gentle=Actors.create({target:f.actor,performance:'challenge'},{reduced:true});gentle.sample(1.5,{speaking:false});assert.ok(Math.abs(f.arms[1].rotation.x)<armAmplitude*.3);gentle.restore();
  const scenery=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());scenery.add(mesh);const before=snapshot(scenery),inert=Actors.create({target:scenery,text:'挑戰守門人'});assert.equal(inert.sample(2,{speaking:true}),false);inert.restore();assertSnapshot(before);
});
test('challenge, guide, wounded and farewell use distinct performances, resolved once, with environment temperament',()=>{
  const f=model(),poses=[];for(const performance of ['challenge','guide','hurt','farewell']){const session=Actors.create({target:f.actor,performance});session.sample(2.3,{speaking:true});poses.push([f.head.rotation.x,f.body.rotation.x,f.arms[0].rotation.x,f.arms[1].rotation.z]);assert.equal(session.performance,performance);session.restore();}
  assert.equal(new Set(poses.map(JSON.stringify)).size,4);
  const spec={target:f.actor,text:'跟我來，前方有希望。'},once=Actors.create(spec);spec.text='受傷疼痛';assert.equal(once.performance,'guide');once.restore();
  const gentle=Actors.create({target:f.actor,performance:'challenge',personality:'library'});gentle.sample(1.9,{speaking:true});const quiet=f.arms[1].rotation.x;gentle.restore();const strong=Actors.create({target:f.actor,performance:'challenge',personality:'furnace'});strong.sample(1.9,{speaking:true});assert.ok(Math.abs(f.arms[1].rotation.x)>Math.abs(quiet));strong.restore();
});
test('legacy hero rig, facial blinking and lip motion restore exactly, including non-default Euler orders and quaternion-authored bones',()=>{
  const f=model({authored:false});f.arms[1].quaternion.setFromAxisAngle(new T.Vector3(.3,.4,.5).normalize(),1.1);f.lips[0].position.set(.01,-.115,.3);f.lips[1].position.set(-.01,-.132,.3);f.eyes[0].scale.set(.61,.64,.55);const base=snapshot(f.actor),session=Actors.create({actor:f.actor,profile:'farewell'});
  const eyeHeights=new Set();for(let n=0;n<200;n++){session.sample(n/30,{speaking:n%3!==0});eyeHeights.add(f.eyes[0].scale.y);}
  assert.ok(eyeHeights.size>1);assert.notEqual(f.lips[0].position.y,base.find(s=>s.node===f.lips[0]).p[1]);session.restore();assertSnapshot(base);
});
test('negative and invalid times, foreign or root bones, repeated scenes and long playback stay finite without accumulating transforms or resources',()=>{
  const f=model(),outside=new T.Group();f.actor.userData.cinemaRig.arms[0]=outside;f.actor.userData.cinemaRig.torso=f.actor;const before=snapshot(f.actor),foreign=snapshot(outside);
  for(let repeat=0;repeat<50;repeat++){const session=Actors.create({target:f.actor,performance:'hurt'});for(const time of [-30,0,1,300,36000,NaN,Infinity,-Infinity])session.sample(time,{speaking:true});f.actor.traverse(n=>{for(const axis of ['x','y','z']){assert.ok(Number.isFinite(n.position[axis]));assert.ok(Number.isFinite(n.rotation[axis]));assert.ok(Number.isFinite(n.scale[axis]));}});session.restore();assertSnapshot(before);assertSnapshot(foreign);}
  const stable=Actors.create({target:f.actor,performance:'challenge'});stable.sample(2,{speaking:true});const once=snapshot(f.actor);stable.sample(2,{speaking:true});assertSnapshot(once);stable.restore();assertSnapshot(before);
});
test('all fifteen real surface/underground guardians animate their original sculpture without changing geometry, materials, ring or gameplay root',()=>{
  const Lords=require('../story/tower-floor-lords.js');assert.equal(Object.values(Lords.allLords()).length,15);
  for(const def of Object.values(Lords.allLords())){
    const actor=Lords.build(T,def),rig=actor.userData.cinemaRig,base=snapshot(actor),before=resources(actor);assert.ok(rig?.head&&rig.mouth,def.name);
    for(const performance of ['challenge','hurt','farewell']){
      const scene=Actors.create({target:actor,performance,personality:def.environment});scene.sample(1.7,{speaking:true});assert.ok(rig.mouth.scale.y>1,def.name);assert.notEqual(rig.head.rotation.x,0,def.name);assert.deepEqual(resources(actor),before);assert.deepEqual(actor.userData.ring.quaternion.toArray(),base.find(row=>row.node===actor.userData.ring).q);
      scene.sample(1.8,{speaking:false});assert.equal(rig.mouth.scale.y,1);scene.restore();assertSnapshot(base);
    }
    before.forEach(resource=>resource.dispose());
  }
});
test('all eight real professions and both sexes reuse their existing face/limb rigs and return to their exact pre-dialogue pose',()=>{
  const env=heroEnvironment(),jobs=Object.keys(env.TowerHeroes.JOBS);assert.equal(jobs.length,8);
  for(const job of jobs)for(const sex of ['male','female']){
    const actor=env.TowerHeroVisuals.base(job,env.buildCharacter,'hero',sex),base=snapshot(actor),before=resources(actor),face=actor.userData.face,faceState={mood:face.mood,time:face.time,left:face.left,reaction:face.reaction};
    const scene=Actors.create({target:actor,performance:'guide'});for(let frame=0;frame<90;frame++)scene.sample(frame/30,{speaking:true});
    assert.ok(face.mouth.scale.y>1,job+':'+sex);assert.deepEqual(resources(actor),before);assert.deepEqual({mood:face.mood,time:face.time,left:face.left,reaction:face.reaction},faceState);scene.restore();assertSnapshot(base);before.forEach(resource=>resource.dispose());
  }
});
test('an emphatic gesture anticipates, holds, recovers and leaves a long listening interval instead of swinging continuously',()=>{
  const f=model(),before=snapshot(f.actor),session=Actors.create({target:f.actor,performance:'challenge'});
  const pose=time=>{session.sample(time,{speaking:false});return f.arms[1].rotation.x;};
  const initial=pose(0),anticipation=pose(.55),held=pose(1.25),holdAgain=pose(1.75),recovering=pose(2.55),rest=pose(3.5),listen=pose(5.2);
  assert.equal(initial,0);assert.ok(Math.abs(anticipation)<Math.abs(held)*.8);assert.equal(held,holdAgain);
  assert.ok(Math.abs(recovering)<Math.abs(held)&&Math.abs(recovering)>Math.abs(rest));assert.equal(rest,listen);assert.ok(Math.abs(rest)<Math.abs(held)*.08);
  session.restore();assertSnapshot(before);
});
test('gesture curves are continuous at entry, holds, release and recurring cycle boundaries, with grounded safe joint bounds',()=>{
  const f=model(),before=snapshot(f.actor);
  for(const [performance,profile]of Object.entries(Actors.PROFILES)){
    const session=Actors.create({target:f.actor,performance}),period=profile.period+((f.actor.id%17)*.17)*.12;
    for(const boundary of [.22,.22+profile.rise,.22+profile.rise+profile.hold,.22+profile.rise+profile.hold+profile.fall,period,period+.22]){
      session.sample(boundary-.0001,{speaking:false});const left=f.arms[0].rotation.toArray().slice(0,3),right=f.arms[1].rotation.toArray().slice(0,3);
      session.sample(boundary+.0001,{speaking:false});for(let axis=0;axis<3;axis++){assert.ok(Math.abs(f.arms[0].rotation.toArray()[axis]-left[axis])<.001,performance);assert.ok(Math.abs(f.arms[1].rotation.toArray()[axis]-right[axis])<.001,performance);}
    }
    for(let frame=0;frame<600;frame++){
      session.sample(frame/30,{speaking:false});for(const arm of f.arms){assert.ok(Math.abs(arm.rotation.x)<.94,performance);assert.ok(Math.abs(arm.rotation.y)<.1,performance);assert.ok(Math.abs(arm.rotation.z)<.29,performance);}
      for(const leg of f.legs){assert.ok(Math.abs(leg.rotation.x)<.05,performance);assert.ok(Math.abs(leg.rotation.z)<.01,performance);}
      assert.deepEqual(f.actor.position.toArray(),before[0].p);assert.deepEqual(f.actor.quaternion.toArray(),before[0].q);
    }
    session.restore();assertSnapshot(before);
  }
});
test('thoughtful, reveal and excited are distinct bounded emotional profiles, resolved once without inventing narration lip motion',()=>{
  const f=model(),before=snapshot(f.actor),poses=[];
  for(const performance of ['thoughtful','reveal','excited']){
    const session=Actors.create({target:f.actor,performance});assert.equal(session.performance,performance);session.sample(1.65,{speaking:false});
    poses.push([f.head.rotation.x,f.body.rotation.x,f.arms[0].rotation.x,f.arms[1].rotation.x,f.brows[0].rotation.z,f.pupils[0].position.y]);
    assert.equal(f.mouth.visible,false);assert.deepEqual(f.mouth.scale.toArray(),before.find(row=>row.node===f.mouth).s);session.restore();assertSnapshot(before);
  }
  assert.equal(new Set(poses.map(JSON.stringify)).size,3);
  for(const [text,expected]of [['我正在思考這段記憶。','thoughtful'],['石台顯現，召喚陣浮現。','reveal'],['太好了！終於成功！','excited']]){const spec={target:f.actor,text},session=Actors.create(spec);spec.text='入侵者，休想通過';assert.equal(session.performance,expected);session.restore();}
});
test('idle remains understated, loading softens gestures and breath, and reduced motion removes blink across every emotional profile',()=>{
  const f=model(),before=snapshot(f.actor);
  const idle=Actors.create({target:f.actor,performance:'idle'});let biggest=0;for(let frame=0;frame<300;frame++){idle.sample(frame/30,{speaking:false});biggest=Math.max(biggest,Math.abs(f.arms[1].rotation.x));}assert.ok(biggest<=.091);idle.restore();
  const regular=Actors.create({target:f.actor,performance:'reveal'});regular.sample(1.6,{speaking:true});const arm=Math.abs(f.arms[1].rotation.x),breath=Math.abs(f.body.scale.y-before.find(row=>row.node===f.body).s[1]);regular.restore();
  const loading=Actors.create({target:f.actor,performance:'reveal'});loading.sample(1.6,{speaking:true,phase:'loading'});assert.ok(Math.abs(f.arms[1].rotation.x)<arm*.2);assert.ok(Math.abs(f.body.scale.y-before.find(row=>row.node===f.body).s[1])<breath*.3);assert.equal(f.mouth.visible,false);loading.restore();
  for(const performance of Object.keys(Actors.PROFILES)){
    const reduced=Actors.create({target:f.actor,performance},{reduced:true});for(let frame=0;frame<400;frame++){reduced.sample(frame/30,{speaking:false});for(const eye of [...f.eyes,...f.whites])assert.equal(eye.scale.y,before.find(row=>row.node===eye).s[1]);assert.equal(f.mouth.visible,false);}
    reduced.restore();assertSnapshot(before);
  }
});
test('paused, suspended and silent freeze expression and gestures, close actual speech and exactly restore every owned node',()=>{
  const f=model(),before=snapshot(f.actor);
  for(const phase of ['paused','suspended','silent']){
    const session=Actors.create({target:f.actor,performance:'excited'});session.sample(1.6,{speaking:true});assert.equal(f.mouth.visible,true);
    session.sample(1.61,{speaking:true,phase});const frozen=snapshot(f.actor);for(const time of [8,20,36000]){session.sample(time,{speaking:true,phase});assertSnapshot(frozen);assert.equal(f.mouth.visible,false);}
    session.restore();assertSnapshot(before);
  }
});
test('a narrative-only shot does not invent character speech even when the narration player reports actual voice playback',()=>{
  const f=model(),before=snapshot(f.actor),spec={target:f.actor,performance:'reveal',speechAnimation:false},session=Actors.create(spec);
  spec.speechAnimation=true;
  for(let frame=0;frame<400;frame++){session.sample(frame/30,{speaking:true,phase:'active'});assert.equal(f.mouth.visible,false);assert.deepEqual(f.mouth.scale.toArray(),before.find(row=>row.node===f.mouth).s);}
  assert.notEqual(f.body.scale.y,before.find(row=>row.node===f.body).s[1]);session.restore();assertSnapshot(before);
});
test('authored story beats cover the entire narration with distinct, non-looping actions, including late dialogue after fifteen seconds',()=>{
  const f=model(),before=snapshot(f.actor),beats=[
    {at:0,duration:3.3,mood:'thoughtful',gesture:'listen',gaze:'partner-right'},
    {at:3.3,duration:5,mood:'thoughtful',gesture:'inspect',gaze:'down'},
    {at:8.3,duration:2.7,mood:'thoughtful',gesture:'listen',gaze:'partner-right'},
    {at:11,duration:4,mood:'guide',gesture:'receive',gaze:'partner-right'},
    {at:15,duration:6,mood:'thoughtful',gesture:'inspect',gaze:'palm'},
    {at:21,duration:3.24,mood:'reflective',gesture:'turn',gaze:'altar'}
  ],session=Actors.create({actor:f.actor,performance:'idle',beats,speechAnimation:false});
  assert.equal(session.beatCount,6);assert.ok(Math.abs(session.timelineDuration-24.24)<1e-8);
  const poses=[];for(const time of [1.6,5.6,9.6,12.8,18.1,22.4]){session.sample(time,{speaking:true});poses.push([f.head.rotation.x,f.head.rotation.y,f.arms[1].rotation.x,f.arms[1].rotation.z]);assert.equal(f.mouth.visible,false);}
  assert.ok(new Set(poses.map(JSON.stringify)).size>=5);assert.ok(Math.abs(poses[4][2])>.2);assert.ok(Math.abs(poses[5][1]-before.find(row=>row.node===f.head).r[1])>.15);
  session.sample(25,{speaking:false});assert.equal(f.arms[1].rotation.x,before.find(row=>row.node===f.arms[1]).r[0]);session.restore();assertSnapshot(before);
});
test('all story gesture names have readable safe joint poses without root motion, new resources or detached equipment',()=>{
  const f=model(),attachment=new T.Group();f.arms[1].add(attachment);attachment.position.set(.01,-.35,.12);const before=snapshot(f.actor),resourceSet=resources(f.actor),poses=[];
  for(const gesture of ['wake','inspect','point','warn','offer','receive','palm','recollect','turn','listen','settle']){
    const session=Actors.create({actor:f.actor,beats:[{at:0,duration:4,mood:'thoughtful',gesture,gaze:'front'}],speechAnimation:false});session.sample(1.8,{speaking:true});
    poses.push([f.head.rotation.x,f.head.rotation.y,f.arms[0].rotation.x,f.arms[1].rotation.x,f.arms[1].rotation.z]);
    assert.equal(attachment.parent,f.arms[1]);assert.deepEqual(attachment.position.toArray(),[.01,-.35,.12]);assert.deepEqual(resources(f.actor),resourceSet);
    assert.deepEqual(f.actor.position.toArray(),before[0].p);assert.deepEqual(f.actor.quaternion.toArray(),before[0].q);
    for(const arm of f.arms){assert.ok(Math.abs(arm.rotation.x)<1.15);assert.ok(Math.abs(arm.rotation.y)<.1);assert.ok(Math.abs(arm.rotation.z)<.3);}
    session.restore();assertSnapshot(before);
  }
  assert.equal(new Set(poses.map(JSON.stringify)).size,11);
});
test('surprise transitions into recollection with a genuinely closed neutral mouth and lowered smile corners, not fake narration speech',()=>{
  const f=model();f.mouth.visible=true;f.mouth.scale.y=1.6;f.teeth.visible=true;const before=snapshot(f.actor),session=Actors.create({actor:f.actor,speechAnimation:false,beats:[
    {at:0,duration:4,mood:'surprised',gesture:'recollect',gaze:'partner-left'},
    {at:4,duration:5,mood:'reflective',gesture:'recollect',gaze:'front'}
  ]});
  session.sample(1.7,{speaking:true});const surprised=f.brows[0].rotation.z;assert.ok(f.eyes[0].scale.y>before.find(row=>row.node===f.eyes[0]).s[1]);assert.ok(f.mouth.scale.y<1.6);
  session.sample(6,{speaking:true});assert.notEqual(f.brows[0].rotation.z,surprised);assert.ok(f.mouth.scale.y<.8);assert.ok(f.corners.every(c=>c.position.y<-.095));assert.equal(f.teeth.visible,false);
  const remembered=snapshot(f.actor);for(const phase of ['paused','suspended','silent']){session.sample(200,{speaking:true,phase});assertSnapshot(remembered);}
  session.restore();assertSnapshot(before);
});
test('recollection keeps the withdrawn smile and gaze across adjacent action boundaries instead of smiling or facing front between beats',()=>{
  const f=model();f.mouth.visible=true;f.mouth.scale.y=1.6;f.teeth.visible=true;const before=snapshot(f.actor),session=Actors.create({actor:f.actor,speechAnimation:false,beats:[
    {at:0,duration:4,mood:'surprised',gesture:'recollect',gaze:'partner-left'},
    {at:4,duration:5,mood:'reflective',gesture:'recollect',gaze:'front'}
  ]});
  session.sample(3.99,{speaking:true});const near=[f.mouth.scale.y,f.head.rotation.y,f.pupils[0].position.x,f.brows[0].rotation.z];assert.ok(near[0]<1);
  session.sample(4.01,{speaking:true});const after=[f.mouth.scale.y,f.head.rotation.y,f.pupils[0].position.x,f.brows[0].rotation.z];assert.ok(after[0]<1);for(let n=0;n<near.length;n++)assert.ok(Math.abs(near[n]-after[n])<.001,String(n));
  const remembered=snapshot(f.actor);session.sample(50,{phase:'suspended',speaking:true});assertSnapshot(remembered);session.restore();assertSnapshot(before);
});
test('absolute beat timing and fixed local gaze are captured once, cannot be changed by caller mutations, and do not follow temperament pace',()=>{
  const f=model(),before=snapshot(f.actor),gaze={x:-.18,y:.02,z:0},beats=[{at:0,duration:4,mood:'reveal',gesture:'inspect',gaze},{at:4,duration:4,mood:'reflective',gesture:'recollect',gaze:'down'}],session=Actors.create({actor:f.actor,beats,personality:'library',speechAnimation:false});
  session.sample(1.5,{speaking:false});const once=snapshot(f.actor);gaze.x=100;beats[0].at=100;beats[0].gesture='warn';beats[0].mood='hurt';beats.push({at:0,duration:20,gesture:'turn'});
  session.sample(1.5,{speaking:false});assertSnapshot(once);session.sample(5.5,{speaking:false});assert.ok(f.mouth.scale.y<before.find(row=>row.node===f.mouth).s[1]);assert.equal(session.timelineDuration,8);session.restore();assertSnapshot(before);
});
test('beat entry, held pose, recovery and adjacent emotion changes are continuous and deterministic, without a recurring gesture loop',()=>{
  const f=model(),before=snapshot(f.actor),session=Actors.create({actor:f.actor,speechAnimation:false,beats:[{at:0,duration:3.5,mood:'guide',gesture:'warn',gaze:'partner-left'},{at:3.5,duration:5,mood:'reflective',gesture:'recollect',gaze:'front'}]});
  session.sample(.15);const rising=Math.abs(f.arms[1].rotation.x);session.sample(1.5);const held=Math.abs(f.arms[1].rotation.x);session.sample(2.3);assert.equal(Math.abs(f.arms[1].rotation.x),held);session.sample(3.3);assert.ok(Math.abs(f.arms[1].rotation.x)<held*.2);assert.ok(rising<held*.2);
  for(const at of [0,.7,2.7,3.5,4.2,7.7,8.5]){
    session.sample(Math.max(0,at-.0001),{speaking:false});const left=[...f.head.rotation.toArray().slice(0,3),...f.arms[1].rotation.toArray().slice(0,3),f.mouth.scale.y];
    session.sample(at+.0001,{speaking:false});const right=[...f.head.rotation.toArray().slice(0,3),...f.arms[1].rotation.toArray().slice(0,3),f.mouth.scale.y];for(let n=0;n<left.length;n++)assert.ok(Math.abs(left[n]-right[n])<.001,String(at));
  }
  session.sample(5.5,{speaking:false});const same=snapshot(f.actor);session.sample(5.5,{speaking:false});assertSnapshot(same);session.sample(500,{speaking:false});assert.equal(f.arms[1].rotation.x,0);session.restore();assertSnapshot(before);
});
test('invalid, inherited, overlapping or excessive beat data safely retains the existing emotional performance without corrupting transforms',()=>{
  const f=model(),before=snapshot(f.actor),valid={at:0,duration:4,mood:'reveal',gesture:'point',gaze:'front'};
  for(const beats of [undefined,null,[],{},'wake',[{...valid,at:NaN}],[{...valid,duration:Infinity}],[{...valid,duration:-1}],[{...valid,gesture:'constructor'}],[valid,{...valid,at:2}],Array.from({length:25},(_,n)=>({...valid,at:n*4}))]){
    const session=Actors.create({actor:f.actor,performance:'guide',beats});assert.equal(session.beatCount,0);assert.equal(session.performance,'guide');session.sample(1.5,{speaking:true});assert.ok(f.mouth.scale.y>1);session.restore();assertSnapshot(before);
  }
  const bounded=Actors.create({actor:f.actor,beats:[{...valid,gaze:{x:Infinity,y:0,z:0},mood:'constructor'}],performance:'idle'});assert.equal(bounded.beatCount,1);for(const time of [-1,1,NaN,Infinity,500])bounded.sample(time);f.actor.traverse(n=>assert.ok(n.rotation.toArray().slice(0,3).every(Number.isFinite)));bounded.restore();assertSnapshot(before);
});
test('authored beats soften buffering and reduced motion, freeze on pause, and still respect direct-speech and narration mouth gating',()=>{
  const f=model(),before=snapshot(f.actor),beats=[{at:0,duration:5,mood:'reflective',gesture:'warn',gaze:'partner-left'}];
  const regular=Actors.create({actor:f.actor,beats});regular.sample(1.6,{speaking:true});const arm=Math.abs(f.arms[1].rotation.x);assert.ok(f.mouth.scale.y>before.find(row=>row.node===f.mouth).s[1]);regular.sample(20,{speaking:true,phase:'paused'});assert.ok(f.mouth.scale.y<before.find(row=>row.node===f.mouth).s[1]);regular.restore();
  const loading=Actors.create({actor:f.actor,beats});loading.sample(1.6,{speaking:true,loading:true});assert.ok(Math.abs(f.arms[1].rotation.x)<arm*.2);assert.equal(f.mouth.visible,false);loading.restore();
  const reduced=Actors.create({actor:f.actor,beats,speechAnimation:false},{reduced:true});for(const time of [1.1,1.6,2.2,3]){reduced.sample(time,{speaking:true});assert.ok(Math.abs(f.arms[1].rotation.x)<arm*.3);for(const eye of f.eyes)assert.equal(eye.scale.y,before.find(row=>row.node===eye).s[1]);assert.equal(f.mouth.visible,false);}reduced.restore();assertSnapshot(before);
});
test('two independent actor timelines share an absolute story clock and restore separately, including all sixteen equipped hero variants',()=>{
  const first=model(),second=model(),firstBase=snapshot(first.actor),secondBase=snapshot(second.actor),beats=[{at:0,duration:4,mood:'guide',gesture:'offer',gaze:'partner-left'},{at:4,duration:5,mood:'reflective',gesture:'recollect',gaze:'front'}];
  const a=Actors.create({actor:first.actor,beats,speechAnimation:false}),b=Actors.create({actor:second.actor,beats:[{...beats[0],gesture:'receive',gaze:'partner-right'},beats[1]],speechAnimation:false});a.sample(2);b.sample(2);assert.notEqual(first.arms[1].rotation.x,second.arms[1].rotation.x);const secondActive=snapshot(second.actor);a.restore();assertSnapshot(firstBase);assertSnapshot(secondActive);b.restore();assertSnapshot(secondBase);
  const env=heroEnvironment();for(const job of Object.keys(env.TowerHeroes.JOBS))for(const sex of ['male','female']){
    const actor=env.TowerHeroVisuals.base(job,env.buildCharacter,'hero',sex),base=snapshot(actor),before=resources(actor),session=Actors.create({actor,beats,speechAnimation:false});
    for(const time of [0,1,2,3.9,4,5.5,8.9,9,24.24]){session.sample(time,{speaking:true});assert.deepEqual(resources(actor),before);assert.deepEqual(actor.position.toArray(),base[0].p);assert.deepEqual(actor.quaternion.toArray(),base[0].q);}
    session.restore();assertSnapshot(base);before.forEach(resource=>resource.dispose());
  }
});
