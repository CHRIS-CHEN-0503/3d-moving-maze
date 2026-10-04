import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Direction=require('../story/tower-story-direction.js'),Actors=require('../story/tower-cinematic-actors.js'),Director=require('../story/tower-cinematics.js');
const source=readFileSync(new URL('../story/tower-story-direction.js',import.meta.url),'utf8');
const BRIEF='已取得回聲銅扣，繼續前往第 90 層章末門。';
function actor(x=-.9,z=.45,height=1.9){
  const root=new T.Group(),head=new T.Group(),body=new T.Group(),left=new T.Group(),right=new T.Group(),legL=new T.Group(),legR=new T.Group();
  root.add(head,body,left,right,legL,legR);head.position.y=height;
  const mouth=new T.Group(),eyes=[new T.Group(),new T.Group()],brows=[new T.Group(),new T.Group()];head.add(mouth,...eyes,...brows);mouth.scale.set(.3,.012,.2);
  root.position.set(x,.2,z);Object.assign(root.userData,{head,body,armL:left,armR:right,legL,legR,face:{mouth,eyes,brows},hp:60});return root;
}
function cast(){const scene=new T.Scene(),hero=actor(),npc=actor(.95,-.05,1.72);scene.add(hero,npc);return {scene,hero,npc};}
function positions(root){const result=[];root.traverse(n=>result.push([n,n.position.toArray(),n.quaternion.toArray(),n.scale.toArray(),n.visible]));return result;}
function unchanged(before){for(const[n,p,q,s,v]of before){assert.deepEqual(n.position.toArray(),p);assert.deepEqual(n.quaternion.toArray(),q);assert.deepEqual(n.scale.toArray(),s);assert.equal(n.visible,v);}}
function serialized(plan){return JSON.stringify({shot:plan.shot,plan:plan.actionPlan,tracks:plan.actorTracks.map(({actor,...rest})=>rest)});}

test('story direction is deterministic editorial data without renderer, resources, timers, writes or media',()=>{
  const env=vm.createContext({});vm.runInContext(source,env);assert.equal(typeof env.TowerStoryDirection.plan,'function');assert.equal(Direction.plan(),null);
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|set(?:Timeout|Interval)\s*\(|fetch\s*\(|localStorage|WebSocket|Math\.random\s*\(|new\s+T\.(?:.*Geometry|.*Material|.*Texture|.*Light|.*Renderer)|\.userData\.[\w]+\s*=/);
  const f=cast(),before=positions(f.scene),options={THREE:T,...f,text:BRIEF,environment:'cloud',page:0};
  const first=Direction.plan(options);for(let n=0;n<20;n++)assert.equal(serialized(Direction.plan(options)),serialized(first));unchanged(before);
  assert.equal(f.hero.userData.hp,60);assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(first.shot.cuts),true);assert.equal(Object.isFrozen(first.actorTracks),true);
});
test('floor 94 objective gets a proportionate three-angle progression without inventing a character, prop or spoken line',()=>{
  const f=cast(),plan=Direction.plan({THREE:T,...f,text:BRIEF,page:0});
  assert.ok(plan.duration>=6&&plan.duration<10);assert.equal(plan.shot.cuts.length,3);assert.equal(plan.actorTracks.length,1);assert.equal(plan.actorTracks[0].actor,f.hero);
  assert.deepEqual(plan.actionPlan.intents,['discover','resolve']);assert.deepEqual(plan.actionPlan.props,[]);assert.equal(plan.actionPlan.timing,'editorial-estimate');
  assert.deepEqual(plan.shot.cuts.map(c=>c.id),['story-establish','story-traveller-response','story-onward']);
  const track=plan.actorTracks[0];assert.equal(track.speechAnimation,false);assert.equal(track.beats.length,3);assert.equal(track.beats[1].gesture,'inspect');assert.equal(track.beats.at(-1).gesture,'turn');
  assert.equal('text' in plan,false);assert.equal('asset' in plan,false);assert.equal('done' in plan,false);
});
test('longer current paragraphs get four edits and at most five non-overlapping expressive beats, not an endless loop',()=>{
  const f=cast(),text='伊芙提醒你先觀察召喚台。你想起剛到高塔時聽見的聲音，走到石柱旁才發現銅扣微微發光。她指向刻著舊符號的石門，告訴你繼續前往下一層，也許就能找到聲音的來源。';
  const plan=Direction.plan({THREE:T,...f,text,name:'伊芙',environment:'cloud',page:1});
  assert.equal(plan.shot.cuts.length,4);assert.equal(plan.actorTracks.length,2);assert.ok(plan.duration>=16&&plan.duration<=24);
  for(const track of plan.actorTracks){assert.equal(track.beats.length,5);let end=0;for(const beat of track.beats){assert.ok(Math.abs(beat.at-end)<1e-8);end=beat.at+beat.duration;}assert.ok(Math.abs(end-plan.duration)<1e-8);}
  assert.deepEqual(plan.shot.cuts[1].subjects,['伊芙']);assert.deepEqual(plan.shot.cuts[2].subjects,['hero','伊芙']);
  assert.equal(plan.actorTracks[0].beats[1].gesture,'listen');assert.equal(plan.actorTracks[1].beats[2].gesture,'listen');
  assert.equal(plan.actorTracks[0].beats[0].gaze,'partner-right');assert.equal(plan.actorTracks[1].beats[0].gaze,'partner-left');
});
test('emotional direction follows only current text and does not celebrate missing clues or turn a farewell into an attack',()=>{
  const f=cast();for(const [text,expected]of [['尚未找到回聲銅扣。','observe'],['伊芙回憶那一年。','recall'],['傷口疼痛，手也在發抖。','hurt'],['守衛逼近，不准再向前。','danger'],['這次終於成功了，希望就在前方。','hope'],['伊芙告別，準備回家。','farewell']]){
    const p=Direction.plan({THREE:T,...f,text,name:'伊芙'});assert.equal(p.actionPlan.intents[0],expected,text);assert.ok(p.actorTracks.every(t=>t.speechAnimation===false));
  }
  const danger=Direction.plan({THREE:T,...f,text:'守衛逼近。'});assert.equal(danger.actorTracks[0].beats.at(-1).gesture,'warn');
  const goodbye=Direction.plan({THREE:T,...f,text:'伊芙告別。',name:'伊芙'});assert.equal(goodbye.performance,'farewell');assert.ok(goodbye.actorTracks.every(t=>t.beats.every(b=>b.gesture!=='warn')));
});
test('hidden, duplicate, unnamed and foreign actors are never added to the cast; a scenery-only plan remains safe',()=>{
  for(const kind of ['hidden','duplicate','unnamed','foreign']){const f=cast();let npc=f.npc,name='伊芙';if(kind==='hidden')npc.visible=false;if(kind==='duplicate')npc=f.hero;if(kind==='unnamed')name='';if(kind==='foreign')new T.Group().add(npc);
    const plan=Direction.plan({THREE:T,hero:f.hero,npc,text:'伊芙向你指路。',name});assert.equal(plan.actorTracks.length,1,kind);assert.equal(plan.target,f.hero);
  }
  const plan=Direction.plan({THREE:T,text:'石門靜靜地等待。'});assert.equal(plan.actorTracks.length,0);assert.equal(plan.target,null);assert.ok(plan.shot.cuts.every(c=>c.subjects.length===0));
  for(const text of ['',null,'短','長'.repeat(2000)]){const p=Direction.plan({THREE:T,text});assert.ok(p.duration>=6&&p.duration<=24);assert.ok(p.shot.cuts.every(c=>c.goal.toArray().every(Number.isFinite)));}
});
test('all cuts stay in front of the stage, use real head heights, and keep faces above phone subtitles without mutating camera data',()=>{
  for(const height of [1.3,1.7,2.1,2.5]){const f=cast();f.hero.userData.head.position.y=height;const p=Direction.plan({THREE:T,...f,text:BRIEF}),head=f.hero.userData.head.getWorldPosition(new T.Vector3());
    assert.equal(p.shot.cuts[1].focus.y,head.y-.42);
    for(const cut of p.shot.cuts){assert.ok(cut.goal.z>1.9&&cut.goalTo.z>1.9);assert.ok(cut.goal.distanceTo(cut.focus)>1.5);assert.ok(cut.fov>=42&&cut.fov<=56);
      for(const [width,pixels]of [[1440,900],[844,390],[568,320]])for(const endpoint of [false,true]){
        const camera=new T.PerspectiveCamera(cut.fov,width/pixels,.1,100),focus=(endpoint?cut.focusTo:cut.focus).clone();focus.y+=pixels<=340?-.24:pixels<=420?-.13:0;camera.position.copy(endpoint?cut.goalTo:cut.goal);camera.lookAt(focus);camera.updateMatrixWorld(true);const projected=head.clone().project(camera);assert.ok(projected.y>-.1&&projected.y<.94,`${height}/${cut.id}/${width}: head ${projected.y}`);assert.ok(Math.abs(projected.x)<.85);
      }
    }
  }
});
test('both actors perform changing joints and expressions without narrator lip-sync; suspension and cancellation restore all exact transforms',()=>{
  const f=cast(),before=positions(f.scene),p=Direction.plan({THREE:T,...f,text:'伊芙提醒你注意危險。你回憶沿途聽到的聲音，發現石柱上的符號與銅扣相同，決定繼續前往下一層。',name:'伊芙'}),sessions=p.actorTracks.map(t=>Actors.create(t));
  const mouthScale=f.hero.userData.face.mouth.scale.toArray(),poses=new Set(),expressions=new Set();
  for(let n=0;n<240;n++){sessions.forEach(s=>s.sample(n*p.duration/240,{speaking:true,phase:'active'}));poses.add(f.hero.userData.head.rotation.y.toFixed(4));expressions.add(f.hero.userData.face.brows[0].rotation.z.toFixed(4));const mouth=f.hero.userData.face.mouth.scale;assert.ok(mouth.y<=mouthScale[1]&&mouth.y>=mouthScale[1]*.4,'a reflective closed mouth may flatten, never open for narration');assert.equal(mouth.z,mouthScale[2]);}
  // Authored holds intentionally repeat a pose; require distinct, meaningful
  // gaze and brow transitions, not continuous motion for motion's sake.
  assert.ok(poses.size>12&&Math.max(...poses)-Math.min(...poses)>.08);assert.ok(expressions.size>12&&Math.max(...expressions)-Math.min(...expressions)>.03);const frozen=positions(f.scene);sessions.forEach(s=>s.sample(999,{speaking:true,phase:'suspended'}));unchanged(frozen);
  sessions.forEach(s=>{assert.equal(s.restore(),true);assert.equal(s.restore(),false);});unchanged(before);
  const normal=Actors.create(p.actorTracks[0]);normal.sample(2.2,{speaking:false});const full=Math.abs(f.hero.userData.head.rotation.y);normal.restore();
  const mild=Actors.create(p.actorTracks[0],{reduced:true});mild.sample(2.2,{speaking:false});assert.ok(Math.abs(f.hero.userData.head.rotation.y)<=full*.3);mild.restore();unchanged(before);
});

function playback({reduced=false,enabled=true}={}){
  const f=cast(),nodes=new Map(),events={},records=[];let now=0,playing=false,loading=true,stops=0,held=0,complete=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},attrs:{},isConnected:true,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},addEventListener(){},focus(){doc.activeElement=this;},querySelector:node});return nodes.get(id);};
  const doc={hidden:false,activeElement:null,createElement:()=>node('overlay'),addEventListener:(name,fn)=>events[name]=fn,body:{appendChild(){},classList:{add(){},remove(){}}}};
  const env={document:doc,innerWidth:844,innerHeight:390,addEventListener(){},performance:{now:()=>now},TowerCinematicActors:Actors};
  const camera=new T.PerspectiveCamera(70,844/390,.1,100);camera.position.set(3,4,5);camera.lookAt(0,0,0);const original={p:camera.position.toArray(),q:camera.quaternion.toArray(),fov:camera.fov};
  const voice={announceAsset(...args){records.push(args);return enabled;},stop(){stops++;},status:()=>({speaking:enabled&&(loading||playing),loadingAudio:enabled&&loading,playing:enabled&&playing})};
  const director=Director.create({THREE:T,env,camera:()=>camera,player:()=>({x:0,z:4}),voice:()=>voice,available:()=>!held,valid:()=>true,reduced:()=>reduced,hold(){held++;},release(){held--;}});
  const planned=Direction.plan({THREE:T,...f,text:BRIEF}),spec={...planned,target:f.hero,scene:f.scene,sequence:true,text:BRIEF,title:'雲頂召喚台',done(){complete++;}};
  return {...f,nodes,events,env,doc,camera,original,director,spec,records,tick(seconds){now+=seconds*1000;return director.frame(.05);},voice(value){loading=value.loading??loading;playing=value.playing??playing;},get complete(){return complete;},get held(){return held;},get stops(){return stops;}};
}
test('new floor direction uses the existing loading-aware clock, skips safely, and cannot finish while narration is queued',()=>{
  const f=playback(),before=positions(f.scene);assert.equal(f.director.start(f.spec),true);f.tick(.5);f.tick(9);assert.equal(f.records.length,1);assert.equal(f.nodes.get('overlay').attrs['data-shot'],'story-establish');assert.equal(f.complete,0);
  f.voice({loading:false,playing:true});f.tick(2);assert.equal(f.nodes.get('overlay').attrs['data-shot'],'story-establish');f.tick(2.3);assert.equal(f.nodes.get('overlay').attrs['data-shot'],'story-traveller-response');
  f.director.skip();f.director.skip();assert.equal(f.complete,1);assert.equal(f.held,0);unchanged(before);assert.deepEqual(f.camera.position.toArray(),f.original.p);assert.deepEqual(f.camera.quaternion.toArray(),f.original.q);assert.equal(f.camera.fov,f.original.fov);
});
test('silent reading never auto-completes; reduced motion freezes the establishing shot and explicit resume resets narration and edits',()=>{
  const silent=playback({enabled:false,reduced:true});silent.director.start(silent.spec);silent.tick(.5);const camera=silent.camera.position.toArray();silent.tick(130);assert.equal(silent.complete,0);assert.equal(silent.director.active,true);assert.deepEqual(silent.camera.position.toArray(),camera);silent.director.cancel();assert.equal(silent.held,0);
  const f=playback();f.director.start(f.spec);f.tick(.5);f.voice({loading:false,playing:true});f.tick(.1);f.tick(3);assert.notEqual(f.nodes.get('overlay').attrs['data-shot'],'story-establish');
  f.doc.hidden=true;f.events.visibilitychange();f.tick(99);assert.equal(f.complete,0);assert.equal(f.director.suspended,true);f.doc.hidden=false;f.nodes.get('[data-cinema="resume"]').onclick();f.tick(.5);assert.equal(f.nodes.get('overlay').attrs['data-shot'],'story-establish');assert.equal(f.records.length,2);f.director.cancel();assert.equal(f.held,0);
});
