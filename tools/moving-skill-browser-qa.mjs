// Local-only input fixtures. Run through Process Guard against a managed server.
// Chrome input dispatch uses two live touch contacts; no real room is opened.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8797/',out=process.env.MAZE_QA_OUT||'.agent-run/moving-skill-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'fixtures are local only');
const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const bridge=`window.__movingSkillQA={
  seed(job='mage',companion=false){
    const wanted=job==='healer'?['light_bolt','herbal_heal','revive']:['arcane_bolt','starfall','barrier'];
    for(let seed=1;seed<=1000;seed++){
      const n=Heroes.enable(P.enable(C.newRun({seed,name:'移動施法驗證'}),job).run).run;
      if(!wanted.every(id=>Heroes.actor(n).skills.includes(id)))continue;
      if(companion&&P.recruitOffer(n)?.profession==='robot')continue;
      run=n;break;
    }
    if(!wanted.every(id=>Heroes.actor(run).skills.includes(id)))throw Error('Missing valid skill draft');
    for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=30;
    // Surface saves reject underground-only dishes, even in a local fixture.
    for(const k of Object.keys(run.party.meals))run.party.meals[k]=P.recipeUnlocked(run,k)?30:0;
    run.party.journey.scrap=30;run.coins=1000;
    if(companion){const result=P.recruit(run,P.recruitOffer(run).id);if(!result.ok)throw Error(result.message);run=result.run;}
    if(!C.validateSave(run))throw Error('Invalid fixture inventory before entering game');
    enter();clearStoryTheater();closeDialog();GameVoice.configure({enabled:false});G.muted=true;
    for(const m of monsters){m.alive=false;m.model.visible=false;}
    hazards=[];G.baseSpeed=2;G.frozen=false;G.stunnedUntil=0;
    let lane=null;
    for(let cy=0;cy<G.mazeH&&!lane;cy++)for(let cx=0;cx<G.mazeW&&!lane;cx++)for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const at=cellToWorld(cx,cy),to={x:at.x+Math.sin(angle)*8,z:at.z+Math.cos(angle)*8};
      if(hasClearPath(at.x,at.z,to.x,to.z)&&Math.hypot(at.x-cellToWorld(G.exitCell.x,G.exitCell.y).x,at.z-cellToWorld(G.exitCell.x,G.exitCell.y).z)>5)lane={at,angle};
    }
    if(!lane)throw Error('Missing clear fixture lane');
    G.px=lane.at.x;G.pz=lane.at.z;G.heading=lane.angle;G.camYaw=lane.angle-Math.PI;
    playerGroup.position.set(G.px,0,G.pz);playerGroup.rotation.y=G.heading;
    for(const [i,id]of Heroes.ids(run).filter(id=>id!=='hero').entries()){
      const model=world.getObjectByName('tower-party-scene').children.find(m=>m.userData.companionId===id);
      model.position.set(G.px+Math.sin(lane.angle)*(1+i*.3),0,G.pz+Math.cos(lane.angle)*(1+i*.3));
      TowerHeroGrowth.state(run).policies[id].strategy='survive';
      Heroes.setHp(run,id,Heroes.maxHp(run,id));
    }
    partyUI.heroes.hud(true);save();const state=this.state();if(!state.valid||state.paused||state.frozen)throw Error('Fixture must be playable: '+JSON.stringify(state));return state;
  },
  state(){return {x:G.px,z:G.pz,heading:G.heading,joy:{active:joy.active,id:joy.id,x:joy.dx,y:joy.dy},keys:{...keys},locked:TowerMode.movementLocked(),preparing:partyUI.heroes.preparing()?.left||0,attack:Heroes.actor(run).attack,active:Heroes.state(run).active,ids:Heroes.ids(run),hp:Object.fromEntries(Heroes.ids(run).map(id=>[id,Heroes.hp(run,id)])),herb:run.party.ingredients.herb,cooldowns:{...Heroes.actor(run,'hero').cooldowns},frozen:G.frozen,paused,valid:!!C.validateSave(run),inputEvents:__inputTrace.slice(-12)};},
  hurt(id,hp){Heroes.setHp(run,id,hp);partyUI.heroes.hud(true);return this.state();},
  clearSwitch(){Heroes.state(run).switchLeft=0;},
  redraw(){partyUI.heroes.hud(true);},
  samples(count=8){return new Promise(resolve=>{const result=[];const next=()=>{result.push(this.state());if(result.length>=count)resolve(result);else requestAnimationFrame(next);};requestAnimationFrame(next);});}
};`;
assert.ok(source.includes('  install();\n})();'),'private bridge anchor remains exact');
await mkdir(out,{recursive:true});
const report={version,base,localFixture:true,cdpMultiTouch:true,cases:[],entry:[],loaded:[],errors:[],blocked:[],sockets:[],touchCommands:[]},responseWork=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
async function makePage(viewport,{fixture=false}={}){
  const c=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block'}),p=await c.newPage();p.setDefaultTimeout(20000);
  p.on('pageerror',e=>report.errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  p.on('response',r=>{if(new URL(r.url()).origin===new URL(base).origin&&(/\.(?:js|html|css)(?:\?|$)/.test(r.url())||new URL(r.url()).pathname==='/'))responseWork.push((async()=>{const body=await r.body();report.loaded.push({url:r.url(),fixture:fixture&&new URL(r.url()).pathname==='/story/tower-mode.js',sha256:createHash('sha256').update(body).digest('hex'),status:r.status()});})().catch(e=>report.errors.push(e.message)));});
  await c.route('**/*',r=>{const request=r.request();if(!['GET','HEAD'].includes(request.method())||new URL(request.url()).origin!==new URL(base).origin){report.blocked.push(request.url());return r.abort();}return r.continue();});
  await p.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));await p.route('**/api/scores*',r=>r.fulfill({json:[]}));
  await p.addInitScript(()=>{window.__roomAttempts=[];window.WebSocket=class{constructor(url){window.__roomAttempts.push(url);throw Error('Real room connections are forbidden in local QA');}};window.__inputTrace=[];for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{const target=e.target;__inputTrace.push({type,at:performance.now(),target:target.id||target.closest?.('[id]')?.id||target.tagName,skill:target.closest?.('[data-hero-skill]')?.dataset.heroSkill,actor:target.closest?.('[data-hero-switch]')?.dataset.heroSwitch,touches:[...e.touches].map(t=>t.identifier),changed:[...e.changedTouches].map(t=>t.identifier)});if(__inputTrace.length>100)__inputTrace.shift();},{capture:true,passive:true});});
  if(fixture)await p.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
  await p.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>typeof TowerMode==='object'&&typeof TowerHeroes==='object'&&typeof GAME_VERSION==='string',null,{timeout:60000});
  assert.equal(await p.evaluate(()=>GAME_VERSION),version);await p.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});return {c,p};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const state=p=>p.evaluate(()=>__movingSkillQA.state());
const samples=(p,n=8)=>p.evaluate(n=>__movingSkillQA.samples(n),n);
const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return {x:b.x+b.width/2,y:b.y+b.height/2};};
async function resumeNatural(p){
  const skip=p.locator('[data-cinema="skip"]');if(await skip.isVisible())await skip.tap();
  const close=p.locator('[data-tower="close"]').first();if(await close.isVisible())await close.tap();
  await p.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running&&!G.frozen,null,{timeout:15000});
}
function touchSession(cdp){let held=[];const point=(id,p)=>({id,x:p.x,y:p.y,radiusX:2,radiusY:2,force:1}),dispatch=async(type,touchPoints)=>{const command={type,touchPoints:touchPoints.map(p=>({...p}))};report.touchCommands.push(command);await cdp.send('Input.dispatchTouchEvent',command);};return {
  async hold(p){held=[point(1,p)];await dispatch('touchStart',held);held=[point(1,{x:p.x,y:p.y-32})];await dispatch('touchMove',held);},
  // Current Chrome treats nonempty touchEnd points as contacts to release.
  // The isolated protocol probe verifies changedTouches [2], touches [1].
  // Passing held [1] here ends the joystick instead of lifting the skill finger.
  async tap(p){const tapped=point(2,p);await dispatch('touchStart',[...held,tapped]);await dispatch('touchEnd',[tapped]);},
  async release(){held=[];await dispatch('touchEnd',[]);}
};}
async function joyPoint(p){const box=await p.locator('#joyZone').boundingBox();return {x:Math.min(100,box.x+box.width*.3),y:box.y+box.height*.6};}
try{
  for(const [width,height]of [[1440,900],[844,390],[568,320]]){
    const {c,p}=await makePage({width,height});page=p;await p.locator('#enterMenuBtn').tap();assert.ok(await p.locator('#storyEntryBtn').isVisible());await p.screenshot({path:out+'/'+width+'-home.png'});
    await p.locator('#mpBtn').tap();await p.locator('#playerName').fill('本地輸入驗證');await p.locator('#profileNextBtn').tap();await p.locator('#startBtn').tap();assert.ok(await p.locator('#mpCreate').isVisible());assert.ok(await p.locator('#mpJoin').isVisible());assert.deepEqual(await p.evaluate(()=>({on:MP.on,sockets:__roomAttempts.length})),{on:false,sockets:0});await p.screenshot({path:out+'/'+width+'-multiplayer-entry.png'});
    await p.locator('#mpClose').tap();await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof TowerMode==='object'&&typeof TowerHeroes==='object');await p.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
    await p.locator('#enterMenuBtn').tap();await p.locator('#storyEntryBtn').tap();await p.locator('[data-tower="new"]').tap();assert.equal(await p.locator('[data-tower="profession"]').count(),8);assert.equal(await p.locator('.hero-skill-list').count(),0);await p.locator('#heroNameInput').fill('自然入口驗證');await p.locator('[data-tower="profession"][data-item="mage"]').tap();assert.equal(await p.locator('.hero-skill-list article').count(),5);await p.locator('[data-tower="hero-create-start"]').tap();await resumeNatural(p);
    const actualSave=await p.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r?.floor,job:r?.party.profession,running:G.running,frozen:G.frozen,active:TowerMode.active,paused:TowerMode.paused,sockets:__roomAttempts.length};});assert.deepEqual(actualSave,{valid:true,floor:99,job:'mage',running:true,frozen:false,active:true,paused:false,sockets:0});await p.screenshot({path:out+'/'+width+'-natural-new-game.png'});
    await p.locator('#towerJournalBtn').tap();assert.ok(await p.locator('#towerDialog').isVisible());await p.screenshot({path:out+'/'+width+'-journal.png'});await resumeNatural(p);await p.locator('#towerBagBtn').tap();assert.ok(await p.locator('#towerDialog').isVisible());await p.screenshot({path:out+'/'+width+'-bag.png'});await resumeNatural(p);
    report.entry.push({width,height,home:true,multiplayerChooser:true,newGame:actualSave,journal:true,bag:true,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});assert.equal(report.entry.at(-1).overflow,false);await c.close();
  }
  {const {c,p}=await makePage({width:390,height:844});page=p;assert.ok(await p.locator('#landscapeGate').isVisible());await p.screenshot({path:out+'/390-portrait-gate.png'});report.entry.push({width:390,height:844,portraitGate:true});await c.close();}
  for(const [width,height]of [[844,390],[568,320]]){
    const {c,p}=await makePage({width,height},{fixture:true});page=p;const cdp=await c.newCDPSession(p),touch=touchSession(cdp);
    let initial=await p.evaluate(()=>__movingSkillQA.seed());report.currentCase={width,height,case:'instant-two-finger',initial};assert.ok(initial.valid&&!initial.paused&&!initial.frozen);await touch.hold(await joyPoint(p));let before=(await samples(p)).at(-1);report.currentCase.before=before;assert.ok(distance(initial,before)>.05);assert.ok(before.joy.active);
    await touch.tap(await center(p.locator('[data-hero-skill="arcane_bolt"]')));const instant=await samples(p);report.currentCase.instant=instant;assert.ok(instant.every(s=>s.joy.active&&!s.locked&&s.valid));assert.ok(instant[0].cooldowns.arcane_bolt>0);assert.ok(distance(instant[0],instant.at(-1))>.03,'instant skill must preserve held movement');await touch.release();report.cases.push({width,height,case:'instant-two-finger',before,samples:instant});
    initial=await p.evaluate(()=>__movingSkillQA.seed());report.currentCase={width,height,case:'charge-stop-and-resume',initial};await touch.hold(await joyPoint(p));before=(await samples(p,3)).at(-1);report.currentCase.before=before;await touch.tap(await center(p.locator('[data-hero-skill="starfall"]')));const charge=await samples(p,5);report.currentCase.charge=charge;assert.ok(charge.every(s=>s.locked&&s.joy.active&&s.preparing>0));assert.ok(charge.every(s=>distance(charge[0],s)<1e-8),'preparation must hold position');assert.ok(charge.every(s=>s.heading===charge[0].heading),'preparation must hold facing');assert.equal(charge[0].cooldowns.starfall,0,'cost and cooldown commit only at release');await p.screenshot({path:out+'/'+width+'-held-charge.png'});await p.waitForFunction(()=>!__movingSkillQA.state().locked,null,{timeout:15000});const resume=await samples(p,7);report.currentCase.resume=resume;assert.ok(resume.every(s=>s.joy.active&&!s.locked));assert.ok(distance(resume[0],resume.at(-1))>.03,'held joystick resumes after release');assert.ok(resume[0].cooldowns.starfall>0);await touch.release();report.cases.push({width,height,case:'charge-stop-and-resume',before,charge,resume});
    initial=await p.evaluate(()=>__movingSkillQA.seed());report.currentCase={width,height,case:'release-stick-during-preparation',initial};await touch.hold(await joyPoint(p));report.currentCase.before=(await samples(p,3)).at(-1);await touch.tap(await center(p.locator('[data-hero-skill="starfall"]')));const pending=await state(p);report.currentCase.pending=pending;assert.ok(pending.locked);await touch.release();await p.waitForFunction(()=>!__movingSkillQA.state().locked,null,{timeout:15000});const stopped=await samples(p,7);report.currentCase.stopped=stopped;assert.ok(stopped.every(s=>!s.joy.active&&!s.locked));assert.ok(stopped.every(s=>distance(stopped[0],s)<1e-8),'released joystick must not resume');report.cases.push({width,height,case:'release-stick-during-preparation',samples:stopped});
    initial=await p.evaluate(()=>__movingSkillQA.seed('healer',true));report.currentCase={width,height,case:'heal-second-finger-target',initial};const id=initial.ids[1];await p.evaluate(id=>__movingSkillQA.hurt(id,1),id);await touch.hold(await joyPoint(p));await touch.tap(await center(p.locator('[data-hero-skill="herbal_heal"]')));report.currentCase.targeting=await state(p);assert.ok(await p.locator('#heroTargetPrompt').isVisible());const selected=await samples(p,3);report.currentCase.selected=selected;assert.ok(selected.every(s=>s.joy.active&&!s.locked));assert.ok(distance(selected[0],selected.at(-1))>.01,'choosing an ally must not stop movement');await touch.tap(await center(p.locator('[data-hero-switch="'+id+'"]')));const healed=await state(p);report.currentCase.healed=healed;assert.ok(healed.hp[id]>1);assert.equal(healed.herb,initial.herb-1);assert.equal(healed.active,'hero');assert.ok(healed.joy.active&&!healed.locked);assert.equal(await p.locator('#heroTargetPrompt').isVisible(),false);assert.equal(await p.locator('#heroTactics').isVisible(),false);await touch.release();report.cases.push({width,height,case:'heal-second-finger-target',selected,healed});
    // Target selection does not consume the cast until the actual ally tap.
    initial=await p.evaluate(()=>__movingSkillQA.seed('healer',true));report.currentCase={width,height,case:'revive-target-then-charge',initial};const dead=initial.ids[1];await p.evaluate(id=>__movingSkillQA.hurt(id,0),dead);await touch.hold(await joyPoint(p));await touch.tap(await center(p.locator('[data-hero-skill="revive"]')));const targeting=await state(p);report.currentCase.targeting=targeting;assert.equal(targeting.locked,false);await touch.tap(await center(p.locator('[data-hero-switch="'+dead+'"]')));const revive=await samples(p,4);report.currentCase.revive=revive;assert.ok(revive.every(s=>s.locked&&s.joy.active&&s.hp[dead]===0));await p.waitForFunction(()=>!__movingSkillQA.state().locked,null,{timeout:15000});const revived=await state(p);report.currentCase.revived=revived;assert.ok(revived.hp[dead]>0&&revived.joy.active);assert.equal(revived.herb,initial.herb-2);await touch.release();report.cases.push({width,height,case:'revive-target-then-charge',charge:revive,revived});
    // Fresh fixture avoids the deliberate target-selection anti-double-tap delay.
    initial=await p.evaluate(()=>__movingSkillQA.seed('healer',true));report.currentCase={width,height,case:'touch-strategy-and-double-switch',initial};const other=initial.ids[1];await touch.hold(await joyPoint(p));await touch.tap(await center(p.locator('[data-hero-switch="'+other+'"]')));report.currentCase.opening=await state(p);await p.waitForFunction(()=>!document.getElementById('heroTactics').hidden);assert.equal(await p.locator('[data-tactic]').count(),3);await touch.tap(await center(p.locator('[data-tactic="attack"]')));const strategy=await state(p);report.currentCase.strategy=strategy;assert.equal(await p.locator('#heroTactics').isVisible(),false);assert.ok(strategy.joy.active);await touch.release();await p.evaluate(()=>__movingSkillQA.clearSwitch());
    await p.waitForTimeout(750);const card=await center(p.locator('[data-hero-switch="'+other+'"]'));await touch.tap(card);await touch.tap(card);await p.waitForTimeout(350);const switched=await state(p);report.currentCase.switched=switched;assert.equal(switched.active,other);assert.equal(await p.locator('#heroTactics').isVisible(),false);report.cases.push({width,height,case:'touch-strategy-and-double-switch',active:other});
    report.sockets.push(...await p.evaluate(()=>__roomAttempts));await p.screenshot({path:out+'/'+width+'-touch-verification.png'});await c.close();
  }
  // Held keyboard keys and mouse skill clicks use the same movement rule.
  {
    const {c,p}=await makePage({width:1440,height:900},{fixture:true});page=p;
    const initial=await p.evaluate(()=>__movingSkillQA.seed());report.currentCase={case:'desktop-held-key',initial};
    await p.keyboard.down('KeyW');const before=(await samples(p,5)).at(-1);report.currentCase.before=before;
    await p.locator('[data-hero-skill="arcane_bolt"]').click();const instant=await samples(p,5);report.currentCase.instant=instant;
    assert.ok(instant.every(s=>s.keys.KeyW&&!s.locked&&s.valid));assert.ok(instant[0].cooldowns.arcane_bolt>0);assert.ok(distance(before,instant.at(-1))>.03);
    // Movement casting retains normal weapon recovery; wait for a ready attack
    // instead of treating the next correctly rejected attack as preparation.
    await p.waitForFunction(()=>__movingSkillQA.state().attack===0,null,{timeout:10000});
    report.currentCase.ready=await state(p);assert.ok(report.currentCase.ready.keys.KeyW);
    await p.locator('[data-hero-skill="starfall"]').click();const charge=await samples(p,4);report.currentCase.charge=charge;
    assert.ok(charge.every(s=>s.keys.KeyW&&s.locked&&s.valid&&distance(charge[0],s)<1e-8));
    assert.ok(charge.every(s=>s.heading===charge[0].heading));assert.equal(charge[0].cooldowns.starfall,0);
    await p.waitForFunction(()=>!__movingSkillQA.state().locked);const resume=await samples(p,6);report.currentCase.resume=resume;
    assert.ok(resume.every(s=>s.keys.KeyW&&!s.locked&&s.valid));assert.ok(resume[0].cooldowns.starfall>0);assert.ok(distance(resume[0],resume.at(-1))>.03);
    await p.keyboard.up('KeyW');report.cases.push({case:'desktop-held-key',before,instant,charge,resume});
    await p.screenshot({path:out+'/desktop-cast.png'});await c.close();
  }
  await Promise.all(responseWork);assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.sockets,[]);
  report.sourceHashes=[];for(const path of ['/','/story/tower-mode.js','/story/tower-team-tactics.js','/story/tower-heroes-runtime.js','/story/tower-party-runtime.js','/story/tower-cooperation-runtime.js']){const loaded=report.loaded.filter(r=>new URL(r.url).pathname===path&&r.status===200&&!r.fixture).at(-1);assert.ok(loaded,'natural source response missing '+path);const localPath=path==='/'?'../index.html':'..'+path,hash=createHash('sha256').update(await readFile(new URL(localPath,import.meta.url))).digest('hex');assert.equal(loaded.sha256,hash,'source changed after browser load '+path);report.sourceHashes.push({path,sha256:hash,url:loaded.url});}
  report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await Promise.allSettled(responseWork);await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,cases:report.cases.length,entry:report.entry.length,errors:report.errors,failure:report.failure,report:out+'/report.json'}));}
