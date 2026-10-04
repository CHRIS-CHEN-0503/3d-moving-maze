// Finite, local-only natural entry regression for the profession proportions.
// Run through Process Guard against a managed local server. No room is opened.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8798/';
const out=process.env.MAZE_QA_OUT||'.agent-run/profession-proportions-entry-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'entry regression must stay local');
const origin=new URL(base).origin;
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
await mkdir(out,{recursive:true});
const report={version,base,localOnly:true,entry:[],layouts:[],loaded:[],errors:[],blocked:[],sockets:[],limitations:['Real browser natural-entry regression using touch emulation, not physical iPhone performance.','Read-only configuration and score responses are isolated local mocks.','Multiplayer stops at the room chooser; no real room or network write is permitted.']};
const responseWork=[],contexts=new Set();
const graphicsBackend=process.env.MAZE_QA_GL||'swiftshader';
assert.ok(['swiftshader','metal'].includes(graphicsBackend));report.graphicsBackend=graphicsBackend;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle='+graphicsBackend,'--enable-webgl']});
let page;
async function makePage(width,height){
  const c=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});contexts.add(c);
  const p=await c.newPage();p.setDefaultTimeout(20000);
  p.on('pageerror',e=>report.errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  p.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&(u.pathname==='/'||/\.(?:js|html|css)$/.test(u.pathname)))responseWork.push((async()=>{const body=await r.body();report.loaded.push({url:r.url(),status:r.status(),sha256:createHash('sha256').update(body).digest('hex')});})().catch(e=>report.errors.push(e.message)));});
  await c.route('**/*',r=>{const q=r.request();if(!['GET','HEAD'].includes(q.method())||new URL(q.url()).origin!==origin){report.blocked.push({url:q.url(),method:q.method()});return r.abort();}return r.continue();});
  await p.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));await p.route('**/api/scores*',r=>r.fulfill({json:[]}));
  await p.addInitScript(()=>{window.__roomAttempts=[];window.WebSocket=class{constructor(url){window.__roomAttempts.push(url);throw Error('Real room connections are forbidden in local entry QA');}};});
  await home(p);return {c,p};
}
async function home(p){
  await p.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>typeof TowerMode==='object'&&typeof TowerHeroVisuals==='object'&&typeof TowerHeroes==='object'&&typeof GAME_VERSION==='string',null,{timeout:60000});
  assert.equal(await p.evaluate(()=>GAME_VERSION),version);await p.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
}
async function shot(p,name){const layout=await p.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(layout.overflow,false,'horizontal overflow at '+name);report.layouts.push({stage:name,...layout});await p.screenshot({path:out+'/'+name+'.png'});return name+'.png';}
async function resume(p){
  const skip=p.locator('[data-cinema="skip"]');if(await skip.isVisible())await skip.tap();
  const close=p.locator('[data-tower="close"]').first();if(await close.isVisible())await close.tap();
  await p.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running&&!G.frozen,null,{timeout:15000});
}
async function cameraView(p,target){
  assert.ok(['fp','tp','top'].includes(target));const before=await p.evaluate(()=>G.view);let taps=0;
  while(await p.evaluate(()=>G.view)!==target&&taps<3){await p.locator('#viewToggle').tap();taps++;}
  assert.equal(await p.evaluate(()=>G.view),target,'public camera cycle must reach '+target);
  await p.waitForFunction(view=>G.view===view&&(view==='fp'?!playerGroup.visible&&TowerMode.sightRoot()?.getObjectByName('hero-first-person-weapon')?.visible:playerGroup.visible),target);
  const actual=await p.evaluate(()=>{
    const headwear=playerGroup.userData.heroPieces.filter(p=>['heavy_helm','light_hood','rune_crown'].includes(p.userData.baseKind)),fp=TowerMode.sightRoot()?.getObjectByName('hero-first-person-weapon');
    const visible=o=>{for(let node=o;node;node=node.parent)if(!node.visible)return false;return true;};
    const hats=headwear.map(h=>{let visibleMeshes=0;h.traverse(o=>{if(o.isMesh&&visible(o))visibleMeshes++;});return {kind:h.userData.baseKind,parentIsHead:h.parent===playerGroup.userData.head,effectivelyVisible:visible(h),visibleMeshes};});
    let fpVisibleMeshes=0;fp?.traverse(o=>{if(o.isMesh&&visible(o))fpVisibleMeshes++;});
    return {view:G.view,bodyVisible:playerGroup.visible,headwear:hats,fpVisible:!!fp&&visible(fp),fpVisibleMeshes,fpKinds:fp?.children.map(p=>p.userData.baseKind)||[]};
  });
  assert.equal(actual.headwear.length,1,'new game must equip an actual headpiece');assert.ok(actual.headwear.every(h=>h.parentIsHead),'headpiece remains attached to its animated head');
  if(target==='fp'){assert.equal(actual.bodyVisible,false);assert.ok(actual.fpVisible&&actual.fpVisibleMeshes>0,'first person renders the actual weapon meshes');assert.ok(actual.headwear.every(h=>!h.effectivelyVisible&&h.visibleMeshes===0),'headwear has no actually visible mesh in first person');assert.ok(actual.fpKinds.every(k=>!['heavy_helm','light_hood','rune_crown'].includes(k)),'first-person weapon group must not clone hats');}
  else{assert.equal(actual.bodyVisible,true);assert.ok(actual.headwear.every(h=>h.effectivelyVisible&&h.visibleMeshes>0),'headwear restores in third-person and top views');assert.equal(actual.fpVisible,false);}
  return {before,taps,...actual};
}
async function closeContext(c,p){report.sockets.push(...await p.evaluate(()=>__roomAttempts));await Promise.all(responseWork);await c.close();contexts.delete(c);}
try{
  for(const [width,height]of [[1440,900],[844,390],[568,320]]){
    const selectedJob=width===1440?'smith':width===844?'scout':'healer',selectedSex=width===844?'female':'male';
    const {c,p}=await makePage(width,height);page=p;report.currentCase={width,height,stage:'home'};
    await p.locator('#enterMenuBtn').tap();assert.ok(await p.locator('#storyEntryBtn').isVisible());const screenshots={home:await shot(p,width+'-home')};
    report.currentCase.stage='multiplayer-chooser';await p.locator('#mpBtn').tap();await p.locator('#playerName').fill('本機比例驗證');await p.locator('#profileNextBtn').tap();await p.locator('#startBtn').tap();
    assert.ok(await p.locator('#mpCreate').isVisible());assert.ok(await p.locator('#mpJoin').isVisible());assert.deepEqual(await p.evaluate(()=>({on:MP.on,sockets:__roomAttempts.length})),{on:false,sockets:0});screenshots.multiplayer=await shot(p,width+'-multiplayer-chooser');
    await p.locator('#mpClose').tap();await home(p);await p.locator('#enterMenuBtn').tap();await p.locator('#storyEntryBtn').tap();await p.locator('[data-tower="new"]').tap();
    report.currentCase.stage='profession-selection';const jobs=await p.locator('[data-tower="profession"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item));assert.equal(jobs.length,8);assert.equal(new Set(jobs).size,8);assert.ok(jobs.includes('robot')&&jobs.includes('swordsman'));assert.equal(await p.locator('.hero-skill-list').count(),0);screenshots.professions=await shot(p,width+'-eight-professions');
    const jobNames=await p.locator('[data-tower="profession"]').allTextContents();assert.ok(jobNames.some(n=>n.includes('遊俠')));assert.ok(jobNames.every(n=>!n.includes('斥候')));await p.locator('#heroNameInput').fill('本機造型確認');if(selectedSex==='female')await p.locator('[data-tower="hero-sex"][data-item="female"]').tap();await p.locator('[data-tower="profession"][data-item="'+selectedJob+'"]').tap();assert.equal(await p.locator('.hero-skill-list article').count(),5);screenshots.skills=await shot(p,width+'-five-skill-reveal');
    report.currentCase.stage='natural-new-game';await p.locator('[data-tower="hero-create-start"]').tap();
    let cinema=null;if(width===844){await p.locator('#towerCinema').waitFor({state:'visible'});await p.waitForTimeout(500);screenshots.cinema=await shot(p,width+'-female-scout-cloud-opening');cinema={floor:99,job:selectedJob,sex:selectedSex,visible:await p.locator('#towerCinema').isVisible(),screenshot:screenshots.cinema};assert.ok(cinema.visible);}
    await resume(p);
    const save=await p.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r?.floor,job:r?.party.profession,sex:r?.party.sex,running:G.running,frozen:G.frozen,active:TowerMode.active,paused:TowerMode.paused,sockets:__roomAttempts.length};});
    assert.deepEqual(save,{valid:true,floor:99,job:selectedJob,sex:selectedSex,running:true,frozen:false,active:true,paused:false,sockets:0});screenshots.game=await shot(p,width+'-natural-new-game');
    report.currentCase.stage='bag';await p.locator('#towerBagBtn').tap();assert.ok(await p.locator('#towerDialog').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);screenshots.bag=await shot(p,width+'-bag');await resume(p);
    report.currentCase.stage='journal';await p.locator('#towerJournalBtn').tap();assert.ok(await p.locator('#towerDialog').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);screenshots.journal=await shot(p,width+'-journal');await resume(p);
    report.currentCase.stage='camera-restoration';const cameraViews=[];for(const target of ['fp','tp','top']){cameraViews.push(await cameraView(p,target));screenshots[target]=await shot(p,width+'-'+target+'-camera');}
    const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);report.entry.push({width,height,selectedJob,selectedSex,jobs,skillsBeforeSelection:0,revealedSkills:5,save,cinema,cameraViews,multiplayerChooser:true,bag:true,journal:true,overflow,screenshots});await closeContext(c,p);console.log('natural entry passed',width,height);
  }
  {
    const {c,p}=await makePage(390,844);page=p;report.currentCase={width:390,height:844,stage:'portrait-gate'};assert.ok(await p.locator('#landscapeGate').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.entry.push({width:390,height:844,portraitGate:true,overflow:false,screenshot:await shot(p,'390-portrait-gate')});await closeContext(c,p);
  }
  await Promise.all(responseWork);report.sourceHashes=[];
  for(const path of ['/','/story/tower-heroes-visuals.js','/assets/character-sculpt.js','/assets/character-face.js','/assets/character-motion.js','/story/tower-heroes-core.js','/story/tower-combat-motion.js','/story/tower-mode.js','/story/tower-party-core.js','/story/tower-cooperation-core.js','/story/tower-expedition-core.js','/story/tower-field-guide.js']){
    const loaded=report.loaded.filter(r=>decodeURIComponent(new URL(r.url).pathname)===path&&r.status===200).at(-1);assert.ok(loaded,'missing actual natural source '+path);
    const sha256=createHash('sha256').update(await readFile(new URL(path==='/'?'../index.html':'..'+path,import.meta.url))).digest('hex');assert.equal(loaded.sha256,sha256,'source changed after actual browser load '+path);report.sourceHashes.push({path,sha256,url:loaded.url});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.sockets,[]);report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await Promise.allSettled(responseWork);await Promise.allSettled(Array.from(contexts,c=>c.close()));await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:!!report.pass,entry:report.entry.length,sourceHashes:report.sourceHashes?.length||0,errors:report.errors,failure:report.failure,report:out+'/report.json',contextsClosed:true}));}
