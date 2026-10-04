import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),S=require('../story/tower-side-stories.js'),E=require('../story/tower-encounters.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__storyTest={
  setup(value,enabled=true){run=value;active=enabled;paused=false;floorStarted=enabled;floorConfig=C.floorConfig(value.floor);exitDeclined=false;cinema=fakeCinema;},
  state(){return {run,paused,reader,sideReader,storyTheater,storyTheaterKey,storyPreviewScreen};},
  readStory,readSideStory,playStoryPage,finishStoryReader,handleAction,closeDialog,dialog,
};`;
assert.match(source,/  install\(\);\s*\}\)\(\);\s*$/);
function fresh(floor=99,seed=123){const r=C.newRun({seed});r.floor=floor;r.floorsCleared=99-floor;r.chronicle=N.newChronicle(floor);r.expedition=D.newExpedition();return r;}
function runtime(run=fresh(),active=true){
  const nodes=new Map(),storage=new Map(),starts=[],stages=[],screens=[],theaters=[],renders=[];
  let current=null,screen='titleScreen',rejectStart=false,cancels=0,now=1000;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:true,textContent:'',innerHTML:'',focus(){},isConnected:true,querySelector(){return null;},classList:{add(){},remove(){},toggle(){}}});return nodes.get(id);};
  const movie={
    start(spec){
      if(current||rejectStart)return false;current=spec;starts.push(spec);
      context.window.__storyTest.dialog('重要時刻','演出中','','','',{silent:true});node('towerOverlay').hidden=true;return true;
    },
    cancel(){cancels++;if(current){current=null;context.window.__storyTest.closeDialog();}},
    get active(){return !!current;},
  };
  const fakeTheater={create(options){
    const t={options,disposed:0,page(value){stages.push(value);return {scene:{theater:t},target:{position:{x:0,y:0,z:0},rotation:{y:0}},height:2};},dispose(){t.disposed++;}};
    theaters.push(t);return t;
  }};
  const context=vm.createContext({
    window:{TowerCore:C,TowerEncounters:E,TowerNarrative:N,TowerDungeons:D,TowerSideStories:S,TowerStoryTheater:fakeTheater,TowerHeroVisuals:{base:(...args)=>({args})}},TowerStoryTheater:fakeTheater,fakeCinema:movie,THREE:{},
    document:{getElementById:node,querySelector:()=>({id:screen}),activeElement:node('focus'),body:{classList:{add(){},remove(){},toggle(){}}}},
    performance:{now:()=>now},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    G:{running:true,frozen:false,shifting:false,satiety:100,px:0,pz:0,startTime:100,shovels:1,kites:0,whistles:0,shovelRechargeAt:0,skillCoolUntil:0,effects:{},mazeW:7,mazeH:7,exitCell:{x:6,y:6}},
    playerGroup:{userData:{}},camera:{},renderer:{render(scene,camera){renders.push({scene,camera});}},buildCharacter(){return {};},disposeSceneObject(){},switchScreen(value){screen=value;screens.push(value);},
    keys:{},joy:{active:false,dx:0,dy:0},showToast(){},AudioEng:{sfxTick(){},sfxPickup(){}},escapeHtml:String,
    playerInWall:()=>false,worldToCell:()=>({x:0,y:0}),cellToWorld:(x,y)=>({x:x*4,z:y*4}),solveMaze:()=>[[0,0]],
  });
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,bridge),context,{filename:'tower-mode.js'});
  const api=context.window.__storyTest;api.setup(run,active);
  // The real cinematic controller releases its pause before invoking navigation
  // or completion callbacks. Simulate that boundary only, without any renderer.
  function invoke(key,arg){const spec=current;assert.ok(spec,'A cinematic page must be active');const callback=spec[key];assert.equal(typeof callback,'function',key);current=null;api.closeDialog();callback(arg);}
  return {context,api,nodes,storage,starts,stages,screens,theaters,renders,get current(){return current;},get screen(){return screen;},get cancels(){return cancels;},next:()=>invoke('next'),previous:()=>invoke('previous'),complete:()=>invoke('done',{}),skip:()=>invoke('done',{skipped:true}),later:()=>invoke('leave'),reject:()=>{rejectStart=true;}};
}
function atClue(floor){const out=N.collectClue(fresh(floor));assert.ok(out.ok,out.message);return out.run;}
function sideFixture(completed=false){
  for(let seed=1;seed<=1000;seed++){
    const r=fresh(89,seed),offer=D.offer(r);if(offer?.kind!=='threads')continue;
    const discovered=D.discover(r),entered=D.enter(discovered.run,offer.id,{x:0,y:0,shiftLeft:120});assert.ok(entered.ok,entered.message);
    if(!completed)return entered.run;
    let finished=entered.run;for(const index of offer.order){const result=D.interact(finished,index);assert.ok(result.ok,result.message);finished=result.run;}
    const out=D.finish(finished,'completed');assert.ok(out.ok,out.message);assert.ok(S.collectedStories(out.run).some(s=>s.kind==='threads'));return out.run;
  }
  assert.fail('A real threads side-story fixture must exist');
}

test('floor 99 opens a staged three-page sequence using the exact existing recording per page',()=>{
  const h=runtime(),entry=N.availableScenes(h.api.state().run).find(s=>s.id==='scene:99');assert.equal(entry.paragraphs.length,3);
  h.api.readStory(entry.id,true);
  assert.equal(h.current.sequence,true);assert.equal(h.current.asset,'story.scene99.1');assert.equal(h.current.text,entry.paragraphs[0]);
  assert.equal(h.current.previous,null);assert.match(h.current.kicker,/第 99 層 · 1 \/ 3/);assert.equal(h.stages[0].entry.id,entry.id);
  h.current.render();assert.equal(h.renders.length,1,'The page delegates to the existing renderer, not a new GPU context');
  h.next();assert.equal(h.current.asset,'story.scene99.2');assert.equal(h.api.state().reader.page,1);
  h.previous();assert.equal(h.current.asset,'story.scene99.1');assert.equal(h.api.state().reader.page,0);
  h.complete();assert.equal(h.current.asset,'story.scene99.2','Speech completion advances rather than ending the whole story');
  h.complete();assert.equal(h.current.asset,'story.scene99.3');assert.equal(h.api.state().run.chronicle.read.includes(entry.id),false);
  assert.equal(h.theaters.length,1,'Adjacent pages reuse the staged theater');
});

test('unrecorded chapter narration includes its title once; next/previous only read page text',()=>{
  const r=atClue(95),entry=N.availableScenes(r).find(s=>s.id==='scene:95'),h=runtime(r);
  h.api.readStory(entry.id,true);assert.equal(h.current.text,entry.title+'。'+entry.paragraphs[0]);assert.equal(h.current.asset,'');
  assert.equal(h.current.caption,entry.paragraphs[0],'The caption body does not repeat its separate heading');
  h.next();assert.equal(h.current.text,entry.paragraphs[1]);assert.equal(h.current.title,entry.title);
  h.previous();assert.equal(h.current.text,entry.paragraphs[0]);assert.equal(h.current.title,entry.title);
  assert.equal(h.api.state().run.chronicle.read.includes(entry.id),false);assert.equal(h.storage.size,0);
});

test('only completing the final page records the scene and closes an entry sequence without descending',()=>{
  const h=runtime(),before=h.api.state().run.revision;h.api.readStory('scene:99',true);
  h.complete();h.complete();assert.equal(h.storage.size,0);assert.equal(h.api.state().run.revision,before);
  h.complete();const state=h.api.state();assert.ok(state.run.chronicle.read.includes('scene:99'));
  assert.equal(state.run.revision,before+1);assert.equal(state.run.floor,99);assert.equal(state.reader,null);assert.equal(state.storyTheater,null);
  assert.equal(state.paused,false);assert.equal(h.nodes.get('towerOverlay').hidden,true);assert.equal(h.theaters[0].disposed,1);
  assert.ok(C.validateSave(JSON.parse(h.storage.get('maze3d_tower_v1'))));
});

test('skip explicitly records the current scene once and never auto-descends an entry story',()=>{
  const h=runtime();h.api.readStory('scene:99',true);h.skip();
  assert.equal(h.api.state().run.floor,99);assert.equal(h.api.state().run.chronicle.read.filter(id=>id==='scene:99').length,1);
  const saved=JSON.stringify(h.api.state().run);h.api.finishStoryReader();assert.equal(JSON.stringify(h.api.state().run),saved);
  assert.equal(h.api.state().paused,false);assert.equal(h.theaters[0].disposed,1);
});

test('later exits a story without marking it read, changing revision or writing the save',()=>{
  const h=runtime(),before=JSON.stringify(h.api.state().run);h.api.readStory('scene:99',true);h.next();h.later();
  assert.equal(JSON.stringify(h.api.state().run),before);assert.equal(h.storage.size,0);assert.equal(h.api.state().reader,null);
  assert.equal(h.api.state().storyTheater,null);assert.equal(h.api.state().paused,false);assert.equal(h.nodes.get('towerOverlay').hidden,true);
});

test('an exit scene must finish its reading transaction before the real descent flow resumes',()=>{
  const h=runtime(atClue(90));assert.equal(h.context.window.TowerMode.exitUnlocked(),true);h.api.readStory('scene:90',false,0,true);
  h.complete();h.complete();assert.equal(h.api.state().run.floor,90);assert.equal(h.api.state().run.chronicle.read.includes('scene:90'),false);
  h.complete();assert.equal(h.api.state().run.floor,89);assert.ok(h.api.state().run.chronicle.read.includes('scene:90'));
  assert.equal(h.api.state().reader,null);assert.match(h.nodes.get('towerDialog').innerHTML,/本層探索完成|繼續下降/);
  assert.ok(C.validateSave(h.api.state().run));
});

test('leaving an exit scene preserves the current floor and unfinished reading',()=>{
  const h=runtime(atClue(90)),before=JSON.stringify(h.api.state().run);h.api.readStory('scene:90',false,0,true);h.later();
  assert.equal(h.api.state().run.floor,90);assert.equal(JSON.stringify(h.api.state().run),before);assert.equal(h.storage.size,0);
});

test('inactive journal replay uses the game-screen preview and restores the original screen after finishing',()=>{
  const r=fresh(),read=N.readScene(r,'scene:99');assert.ok(read.ok);const h=runtime(read.run,false),before=JSON.stringify(read.run);
  h.api.readStory('scene:99');assert.equal(h.screen,'gameScreen');assert.deepEqual(h.screens,['gameScreen']);
  assert.equal(h.theaters[0].options.hero,null,'An inactive replay never borrows a live player mesh');
  const actor=h.theaters[0].options.buildActor({job:'healer',sex:'female',name:'米菈'});
  assert.equal(actor.args[0],'healer');assert.equal(actor.args[1],h.context.buildCharacter);
  assert.equal(actor.args[2],'米菈');assert.equal(actor.args[3],'female','Staged actors use the real profession builder argument order');
  h.complete();h.complete();h.complete();assert.equal(h.screen,'titleScreen');assert.deepEqual(h.screens,['gameScreen','titleScreen']);
  assert.equal(JSON.stringify(h.api.state().run),before);assert.equal(h.storage.size,0);assert.match(h.nodes.get('towerDialog').innerHTML,/旅人的手記/);
});

test('later from an inactive unread journal scene restores the screen and returns to the journal without progress',()=>{
  const h=runtime(fresh(),false),before=JSON.stringify(h.api.state().run);h.api.readStory('scene:99');h.later();
  assert.equal(h.screen,'titleScreen');assert.equal(JSON.stringify(h.api.state().run),before);assert.equal(h.storage.size,0);
  assert.match(h.nodes.get('towerDialog').innerHTML,/旅人的手記/);
});

test('failed cinematic start falls back to the original readable page with unchanged narration and actions',()=>{
  const h=runtime();h.reject();h.api.readStory('scene:99',true);
  assert.equal(h.current,null);assert.equal(h.api.state().storyTheater,null);assert.equal(h.theaters[0].disposed,1);
  const panel=h.nodes.get('towerDialog');assert.match(panel.innerHTML,/下一頁/);assert.match(panel.innerHTML,/稍後在日誌閱讀/);assert.equal(panel.voiceAsset,'story.scene99.1');
  assert.equal(h.api.state().run.chronicle.read.includes('scene:99'),false);assert.equal(h.storage.size,0);
});

test('side-story introduction uses the same animated paging and returns to dungeon objectives without granting completion',()=>{
  const r=sideFixture(),h=runtime(r),story=S.get('threads'),before=JSON.stringify(r);
  h.api.readSideStory('threads',0,'intro');assert.equal(h.current.text,story.title+'。'+story.intro[0]);assert.equal(h.stages[0].entry.side,true);
  h.next();assert.equal(h.current.text,story.intro[1]);h.previous();assert.equal(h.current.text,story.intro[0]);
  h.complete();h.complete();h.complete();assert.equal(h.api.state().sideReader,null);assert.equal(JSON.stringify(h.api.state().run),before);
  assert.equal(h.api.state().run.expedition.active.progress.length,0);assert.equal(h.storage.size,0);
});

test('side-story outro and collected record preserve rewards and choose continue/journal respectively',()=>{
  for(const source of ['outro','record']){
    const r=sideFixture(true),h=runtime(r),story=S.get('threads'),before=JSON.stringify(r);
    h.api.readSideStory('threads',0,source);assert.equal(h.current.title,source==='record'?story.record.title:story.title);
    h.complete();h.complete();h.complete();assert.equal(h.api.state().sideReader,null);assert.equal(JSON.stringify(h.api.state().run),before);assert.equal(h.storage.size,0);
    if(source==='outro'){assert.equal(h.nodes.get('towerOverlay').hidden,true);assert.equal(h.api.state().paused,false);}
    else assert.match(h.nodes.get('towerDialog').innerHTML,/旅人的手記/);
    assert.equal(h.theaters[0].disposed,1);
  }
});

test('uncollected side-story records and unrelated dungeon introductions cannot create a cinematic preview',()=>{
  const h=runtime();h.api.readSideStory('threads',0,'record');h.api.readSideStory('threads',0,'outro');h.api.readSideStory('threads',0,'intro');
  assert.equal(h.theaters.length,0);assert.equal(h.current,null);assert.equal(h.storage.size,0);
});

test('all thirty surface and fifteen underground story scenes use the animated reader with every original paragraph intact',()=>{
  const surface=fresh(1);surface.status='won';surface.floorsCleared=99;surface.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);surface.chronicle.ending='release';
  const entered=C.startUnderworld(surface);assert.ok(entered.ok,entered.message);
  const underground=entered.run;underground.floor=-50;underground.floorsCleared=148;underground.chronicle=N.newChronicle(-50);
  underground.chronicle.clues=N.allChapters().map(c=>c.clueId);underground.chronicle.ending='release';
  for(const [run,count] of [[surface,30],[underground,45]]){
    const scenes=N.availableScenes(run);assert.equal(scenes.length,count);run.chronicle.read=scenes.map(s=>s.id);assert.ok(C.validateSave(run));
    const h=runtime(run,false),before=JSON.stringify(run);
    for(const entry of scenes){
      h.api.readStory(entry.id);assert.equal(h.current.sequence,true,entry.id);assert.equal(h.current.title,entry.title);
      for(let page=0;page<entry.paragraphs.length;page++){
        assert.equal(h.current.caption,entry.paragraphs[page],entry.id+' page '+page);assert.equal(h.stages.at(-1).text,entry.paragraphs[page]);
        h.complete();
      }
      assert.equal(h.current,null);assert.equal(h.api.state().storyTheater,null);assert.equal(h.screen,'titleScreen');
    }
    assert.equal(JSON.stringify(h.api.state().run),before);assert.equal(h.storage.size,0);
    assert.ok(h.theaters.every(t=>t.disposed===1),'Every repeated archive stage is disposed exactly once');
  }
});
