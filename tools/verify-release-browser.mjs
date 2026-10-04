// Read back the real fixed production domain. No response fixtures, private
// runtime bridge, personal browser profile, room connection or external writes.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [base,releaseDir,version,sha,outArg]=process.argv.slice(2);
assert.match(version,/^\d+\.\d+\.\d+$/,'release version');
const out=outArg||'.agent-run/releases/v'+version;
assert.equal(new URL(base).href,'https://3d-moving-maze.pages.dev/','fixed HTTPS production root without credentials, port or query');assert.match(sha,/^[a-f0-9]{40}$/);assert.ok(path.isAbsolute(releaseDir));
await mkdir(out,{recursive:true});
const report={base,version,sha,hashes:[],services:[],views:[],modules:[],loadedModules:[],loadedFailures:[],atlases:[],errors:[],blocked:[]};
const digest=b=>createHash('sha256').update(b).digest('hex');
const modules=[
 ['TowerCinematics','story/tower-cinematics.js','create'],
 ['TowerCinematicActors','story/tower-cinematic-actors.js','create'],
 ['TowerCinematicLook','story/tower-cinematic-look.js','create'],
 ['TowerStoryTheater','story/tower-story-theater.js','create'],
 ['TowerStoryDirection','story/tower-story-direction.js','plan'],
 ['TowerSkillEffects','story/tower-skill-effects.js','create'],
 ['CombatAudio','assets/combat-audio.js','create'],
 ['TowerAudio','story/tower-audio.js','setCamp'],
 ['TowerHeroVisuals','story/tower-heroes-visuals.js','base'],
 ['TowerStoryInsights','story/tower-story-insights.js','journal'],
 ['TowerEnvironmentLife','story/tower-environment-life.js','create']
];
const moduleFiles=new Set(modules.map(([,file])=>file)),expectedHashes=new Map(),loadedChecks=[];
// Public release UI helpers. They tap shipped controls, never patch runtime state.
async function resume(page){
 const actions=[];
 for(let step=0;step<6;step++){
  await page.waitForFunction(()=>{
   const visible=selector=>{const node=document.querySelector(selector);return !!(node?.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');};
   return visible('#towerCinema [data-cinema="skip"]')||visible('#towerOverlay [data-tower="close"]')||TowerMode.active&&!TowerMode.paused&&G.running&&!TowerMode.cinematicActive;
  });
  const skip=page.locator('#towerCinema [data-cinema="skip"]');
  if(await skip.isVisible()){await skip.tap();actions.push('skip');continue;}
  const close=page.locator('#towerOverlay [data-tower="close"]').first();
  if(await close.isVisible()){await close.tap();actions.push('close');continue;}
  await page.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running&&!TowerMode.cinematicActive);
  return actions;
 }
 throw Error('Story did not resume after six public skip/close actions');
}
async function setView(page,target){
 assert.ok(['tp','fp','top'].includes(target),'supported camera target');
 const before=await page.evaluate(()=>G.view);let taps=0;
 while(await page.evaluate(()=>G.view)!==target&&taps<3){
  await page.locator('#viewToggle').tap();taps++;
 }
 assert.equal(await page.evaluate(()=>G.view),target,'public camera cycle reaches target');
 await page.waitForFunction(view=>G.view===view&&(view!=='fp'||TowerMode.sightRoot()?.getObjectByName('hero-first-person-weapon')?.visible),target);
 return {before,view:target,taps};
}
// End public release UI helpers.
// Wrangler creates its compile cache after the clean git archive. Its Pages
// asset validator explicitly excludes .wrangler; never inspect that cache.
const roots=(await readdir(releaseDir)).filter(name=>name!=='.wrangler');assert.deepEqual(roots.sort(),['assets','docs','functions','index.html','lib','manifest.webmanifest','package.json','story','wrangler.toml'].sort());
const index=await readFile(path.join(releaseDir,'index.html'),'utf8');assert.match(index,new RegExp("GAME_VERSION='"+version.replaceAll('.','\\.')+"'"));
const coreSource=await readFile(path.join(releaseDir,'story/story-core.js'),'utf8');
const durabilityDefinition=coreSource.match(/const\s+DURABILITY_VERSION\s*=\s*(\d+)\s*;/);
assert.ok(durabilityDefinition,'fixed source defines durability format');
const durabilityVersion=Number(durabilityDefinition[1]);report.durabilityVersion=durabilityVersion;
assert.ok(durabilityVersion>0,'fixed source durability format is valid');
const files=new Set(['index.html','manifest.webmanifest','package.json','assets/equipment-surfaces.js','assets/character-face.js','assets/character-sculpt.js','assets/character-motion.js','story/story-core.js','story/tower-combat-motion.js','story/tower-heroes-visuals.js','story/tower-characters.js','story/tower-party-runtime.js','story/tower-lighting-runtime.js','story/tower-party.css','story/tower-mobile.css','story/tower-mode.js','docs/職業裝備圖鑑.html','docs/story-atlas-rules.js','docs/story-atlas-items.js','docs/story-atlas-cooperation.js','story/tower-affixes.js','story/tower-adventure-events.js','story/tower-landmarks.js','story/tower-cooperation-core.js','story/tower-cooperation-runtime.js','assets/mode-variants-core.js','assets/mode-variants.js','assets/shop-claims-core.js','assets/shop-claims.js']);
for(const file of moduleFiles)files.add(file);files.add('story/tower-cinematics.css');
for(const file of ['orchestra-manifest.json','orchestra-summit.m4a','orchestra-boss.m4a','orchestra-camp.m4a'])files.add('assets/music/'+file);
for(const m of index.matchAll(/(?:src|href)="([^"#]+)"/g)){
 if(/^(?:https?:|data:|\/\/)/.test(m[1]))continue;
 const name=m[1].split(/[?#]/)[0].replace(/^\.\//,'');
 if(!name||name.startsWith('/')||name.includes('..'))continue;
 if(await stat(path.join(releaseDir,name)).then(s=>s.isFile()).catch(()=>false))files.add(name);
}
// Also verify dependencies used only by the atlas, including cooperative rules.
const atlas=await readFile(path.join(releaseDir,'docs/職業裝備圖鑑.html'),'utf8');
for(const m of atlas.matchAll(/(?:src|href)="([^"#]+)"/g)){
 if(/^(?:https?:|data:|\/\/)/.test(m[1]))continue;
 const name=path.posix.normalize('docs/'+m[1].split(/[?#]/)[0]);
 if(name.startsWith('/')||name.startsWith('../'))continue;
 if(await stat(path.join(releaseDir,name)).then(s=>s.isFile()).catch(()=>false))files.add(name);
}
let browser;
try{
 for(const name of files){
  const expected=await readFile(path.join(releaseDir,name)),url=new URL(name,base);url.searchParams.set('release',sha);
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200,name+' HTTP status');
  const actual=Buffer.from(await response.arrayBuffer());assert.equal(digest(actual),digest(expected),name+' differs from fixed release');
  expectedHashes.set(name,digest(expected));report.hashes.push({path:name,sha256:digest(actual),bytes:actual.length});
 }
 for(const name of ['api/runtime-config','api/scores']){
  const response=await fetch(new URL(name,base),{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,name);await response.json();report.services.push({path:name,status:response.status,json:true});
 }
 const excluded=await fetch(new URL('.agent-run/releases/v'+version+'/report.json',base),{signal:AbortSignal.timeout(20000)});
 // Pages can serve the SPA index for an unknown path. It must never serve a
 // development report; the clean archive and exact root allowlist are primary.
 if(excluded.ok)assert.equal(digest(Buffer.from(await excluded.arrayBuffer())),digest(Buffer.from(index)),'development report was published');
 const graphicsBackend=process.env.MAZE_QA_GL||'swiftshader';assert.ok(['swiftshader','metal'].includes(graphicsBackend));report.graphicsBackend=graphicsBackend;
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle='+graphicsBackend,'--enable-webgl']});
 for(const [width,height,job]of [[1440,900,'scout'],[844,390,'robot'],[568,320,'mage'],[390,844,'']]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>report.errors.push(e.stack));
  const currentLoads=[];
  page.on('response',response=>{
   const url=new URL(response.url()),file=decodeURIComponent(url.pathname).replace(/^\//,'');if(url.origin!==new URL(base).origin||!moduleFiles.has(file))return;
   loadedChecks.push((async()=>{assert.equal(response.status(),200,file+' live browser status');const body=Buffer.from(await response.body()),hash=digest(body);const loaded={width,height,path:file,url:response.url(),sha256:hash,bytes:body.length};report.loadedModules.push(loaded);currentLoads.push(loaded);assert.equal(hash,expectedHashes.get(file),file+' actual browser response differs from fixed release');})().catch(error=>report.loadedFailures.push(error.stack)));
  });
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){report.blocked.push(r.request().url());return r.abort();}return r.continue();});
  await page.addInitScript(()=>{window.__releaseSockets=[];window.WebSocket=class{constructor(url){window.__releaseSockets.push(url);throw Error('Room connections disabled during release readback');}};});
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>GAME_VERSION),version);
  await page.waitForFunction(rows=>rows.every(([name,,method])=>typeof globalThis[name]?.[method]==='function'),modules);
  const moduleState=await page.evaluate(rows=>Object.fromEntries(rows.map(([name,,method])=>[name,typeof globalThis[name]?.[method]==='function'])),modules);report.modules.push({width,height,...moduleState});
  await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  if(!job){assert.ok(await page.locator('#landscapeGate').isVisible());await page.screenshot({path:out+'/390-portrait.png'});}
  else{
   await page.locator('#enterMenuBtn').tap();assert.equal(await page.locator('#homePanel .home-action').count(),6);await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('homePanel')).opacity)>.99);await page.screenshot({path:out+'/'+width+'-home.png'});
   await page.locator('#mpBtn').tap();await page.locator('#playerName').fill('發布檢查');await page.locator('#profileNextBtn').tap();await page.locator('#startBtn').tap();assert.ok(await page.locator('#mpCreate').isVisible());assert.ok(await page.locator('#mpJoin').isVisible());assert.equal(await page.evaluate(()=>MP.on),false);assert.deepEqual(await page.evaluate(()=>__releaseSockets),[]);await page.locator('#mpClose').tap();
   await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="new"]').tap();assert.equal(await page.locator('[data-tower="profession"]').count(),8);assert.equal(await page.locator('.hero-skill-list').count(),0);
   await page.locator('#heroNameInput').fill('發布檢查');await page.locator('[data-tower="hero-sex"][data-item="female"]').tap();await page.locator('[data-tower="profession"][data-item="'+job+'"]').tap();assert.equal(await page.locator('.hero-skill-list article').count(),5);await page.locator('[data-tower="hero-create-start"]').tap();await page.locator('#towerCinema').waitFor({state:'visible'});await page.waitForTimeout(500);await page.screenshot({path:out+'/'+width+'-opening.png'});const opening=await resume(page);assert.ok(opening.includes('skip'),'new story opening naturally skips the shipped animated scene');await page.waitForTimeout(1400);
   const state=await page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r.floor,job:r.party.profession,sex:r.party.sex,gear:Object.values(r.equipment).filter(Boolean).map(g=>({kind:g.kind,version:g.durabilityVersion,max:g.maxDurability})),durabilityVersion:TowerCore.DURABILITY_VERSION,model:playerGroup.userData.heroJob};});assert.ok(state.valid);assert.equal(state.floor,99);assert.equal(state.job,job);assert.equal(state.sex,'female');assert.equal(state.model,job);assert.equal(state.durabilityVersion,durabilityVersion,'live rules match fixed durability format');assert.ok(state.gear.every(g=>g.version===durabilityVersion),'new equipment uses fixed source durability format');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:out+'/'+width+'-story.png'});
   const progress=()=>page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return JSON.stringify({read:r.chronicle.read,clues:r.chronicle.clues,ending:r.chronicle.ending,events:r.adventure?.events});});const beforeJournal=await progress();
   await page.locator('#towerJournalBtn').tap();const folds=page.locator('#towerDialog details.story-insights'),titles=await folds.locator(':scope > summary > span').allTextContents();assert.deepEqual(titles.slice(0,2),['把線索連起來','同行者的心事']);assert.ok(titles.length===2||titles.length===3&&titles[2]==='選擇留下的餘波');assert.ok((await folds.evaluateAll(nodes=>nodes.map(node=>node.open))).every(open=>!open));
   for(let i=0;i<await folds.count();i++){const fold=folds.nth(i),summary=fold.locator(':scope > summary');await summary.scrollIntoViewIfNeeded();await summary.tap();assert.equal(await fold.getAttribute('open'),'');assert.ok(await summary.evaluate(node=>node.getBoundingClientRect().height)>=44,'journal fold remains touch sized');}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+width+'-journal.png'});assert.equal(await progress(),beforeJournal,'public journal folding does not write story or event progress');await resume(page);
   await page.locator('#towerBagBtn').tap();assert.ok(await page.locator('#towerDialog').isVisible());await page.screenshot({path:out+'/'+width+'-equipment.png'});await resume(page);
   const cameraViews=[];for(const view of ['tp','top','fp']){cameraViews.push(await setView(page,view));await page.waitForTimeout(350);await page.screenshot({path:out+'/'+width+'-'+(view==='fp'?'first-person':view+'-camera')+'.png'});}const firstPersonAgain=await setView(page,'fp');assert.equal(firstPersonAgain.taps,0,'first-person target is idempotent');
   await page.locator('#actionsToggle').tap();await page.locator('[data-tower="quit"]').tap();await page.locator('[data-tower="home"]').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();const continued=await resume(page);const resumed=await page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r?.floor,job:r?.party.profession,sex:r?.party.sex};});assert.deepEqual(resumed,{valid:true,floor:99,job,sex:'female'});await setView(page,'fp');
   const environment=await page.evaluate(()=>{let clouds=0;TowerMode.sightRoot().traverse(node=>{if(node.name.startsWith('local-environment-'))clouds++;});return {clouds,profiles:Object.keys(TowerEnvironmentLife.PROFILES).length};});assert.equal(environment.clouds,1,'one real local environment cloud after continue');assert.equal(environment.profiles,10);
   report.views.push({width,height,home:true,multiplayerEntry:true,story:state,opening,journal:{titles,folding:true,progressUnchanged:true},cameraViews,firstPerson:true,firstPersonIdempotent:true,continue:{...resumed,actions:continued},environment});
  }
  if(!job)report.views.push({width,height,portraitGate:true});
  assert.deepEqual(await page.evaluate(()=>__releaseSockets),[],'whole game path never attempts a real room connection');
  await page.goto(new URL('docs/'+encodeURIComponent('職業裝備圖鑑.html'),base).href,{waitUntil:'networkidle'});await page.waitForSelector('html[data-atlas-ready="true"]');assert.match(await page.locator('body').innerText(),new RegExp(version.replaceAll('.','\\.')));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const reading=page.locator('#readingRules');if(!await reading.evaluate(node=>node.open))await reading.locator(':scope > summary').tap();for(const title of ['把線索連起來','隊友戰術與演出']){const heading=page.getByRole('heading',{name:title,exact:true});await heading.scrollIntoViewIfNeeded();assert.ok(await heading.isVisible());assert.ok((await heading.locator('..').textContent()).length>180);}assert.match(await reading.textContent(),/事件紀錄未保存選項時會明示/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('heading',{name:'把線索連起來',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+width+'-atlas.png'});report.atlases.push({width,height,ready:true,version,newStoryAndTacticsRules:true,eventChoiceWording:true,noHorizontalOverflow:true});
  assert.deepEqual(await page.evaluate(()=>__releaseSockets),[],'atlas never attempts a room connection');await Promise.all(loadedChecks);assert.deepEqual(new Set(currentLoads.map(row=>row.path)),moduleFiles,'all required presentation modules actually loaded in this browser context');await context.close();
 }
 assert.deepEqual(report.loadedFailures,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;throw e;}finally{
 await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:!!report.pass,version,sha,hashes:report.hashes.length,services:report.services,views:report.views.map(v=>({width:v.width,height:v.height,story:!!v.story,portraitGate:!!v.portraitGate})),errors:report.errors,failure:report.failure}));
}
