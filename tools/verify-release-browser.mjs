// Read back the real fixed production domain. No response fixtures, private
// runtime bridge, personal browser profile, room connection or external writes.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [base,releaseDir,version,sha,out='.agent-run/releases/v1.51.0']=process.argv.slice(2);
assert.equal(new URL(base).hostname,'3d-moving-maze.pages.dev');assert.match(sha,/^[a-f0-9]{40}$/);assert.ok(path.isAbsolute(releaseDir));
await mkdir(out,{recursive:true});
const report={base,version,sha,hashes:[],services:[],views:[],errors:[],blocked:[]};
const digest=b=>createHash('sha256').update(b).digest('hex');
// Wrangler creates its compile cache after the clean git archive. Its Pages
// asset validator explicitly excludes .wrangler; never inspect that cache.
const roots=(await readdir(releaseDir)).filter(name=>name!=='.wrangler');assert.deepEqual(roots.sort(),['assets','docs','functions','index.html','lib','manifest.webmanifest','package.json','story','wrangler.toml'].sort());
const index=await readFile(path.join(releaseDir,'index.html'),'utf8');assert.match(index,new RegExp("GAME_VERSION='"+version.replaceAll('.','\\.')+"'"));
const files=new Set(['index.html','manifest.webmanifest','package.json','assets/equipment-surfaces.js','assets/character-face.js','assets/character-sculpt.js','assets/character-motion.js','story/story-core.js','story/tower-combat-motion.js','story/tower-heroes-visuals.js','story/tower-characters.js','story/tower-party-runtime.js','story/tower-lighting-runtime.js','story/tower-party.css','story/tower-mobile.css','story/tower-mode.js','docs/職業裝備圖鑑.html','docs/story-atlas-rules.js']);
for(const m of index.matchAll(/(?:src|href)="([^"#]+)"/g)){
 if(/^(?:https?:|data:|\/\/)/.test(m[1]))continue;
 const name=m[1].split(/[?#]/)[0].replace(/^\.\//,'');
 if(!name||name.startsWith('/')||name.includes('..'))continue;
 if(await stat(path.join(releaseDir,name)).then(s=>s.isFile()).catch(()=>false))files.add(name);
}
let browser;
try{
 for(const name of files){
  const expected=await readFile(path.join(releaseDir,name)),url=new URL(name,base);url.searchParams.set('release',sha);
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200,name+' HTTP status');
  const actual=Buffer.from(await response.arrayBuffer());assert.equal(digest(actual),digest(expected),name+' differs from fixed release');
  report.hashes.push({path:name,sha256:digest(actual),bytes:actual.length});
 }
 for(const name of ['api/runtime-config','api/scores']){
  const response=await fetch(new URL(name,base),{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,name);await response.json();report.services.push({path:name,status:response.status,json:true});
 }
 const excluded=await fetch(new URL('.agent-run/releases/v1.51.0/report.json',base),{signal:AbortSignal.timeout(20000)});
 // Pages can serve the SPA index for an unknown path. It must never serve a
 // development report; the clean archive and exact root allowlist are primary.
 if(excluded.ok)assert.equal(digest(Buffer.from(await excluded.arrayBuffer())),digest(Buffer.from(index)),'development report was published');
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
 for(const [width,height,job]of [[1440,900,'scout'],[844,390,'smith'],[568,320,'mage'],[390,844,'']]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.stack));
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){report.blocked.push(r.request().url());return r.abort();}return r.continue();});
  await page.addInitScript(()=>{window.__releaseSockets=[];window.WebSocket=class{constructor(url){window.__releaseSockets.push(url);throw Error('Room connections disabled during release readback');}};});
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>GAME_VERSION),version);
  await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  if(!job){assert.ok(await page.locator('#landscapeGate').isVisible());await page.screenshot({path:out+'/390-portrait.png'});}
  else{
   await page.locator('#enterMenuBtn').tap();assert.equal(await page.locator('#homePanel .home-action').count(),6);await page.screenshot({path:out+'/'+width+'-home.png'});
   await page.locator('#mpBtn').tap();await page.locator('#playerName').fill('發布檢查');await page.locator('#profileNextBtn').tap();await page.locator('#startBtn').tap();assert.ok(await page.locator('#mpCreate').isVisible());assert.ok(await page.locator('#mpJoin').isVisible());assert.equal(await page.evaluate(()=>MP.on),false);assert.deepEqual(await page.evaluate(()=>__releaseSockets),[]);await page.locator('#mpClose').tap();
   await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="new"]').tap();assert.equal(await page.locator('[data-tower="profession"]').count(),7);assert.equal(await page.locator('.hero-skill-list').count(),0);
   await page.locator('#heroNameInput').fill('發布檢查');await page.locator('[data-tower="hero-sex"][data-item="female"]').tap();await page.locator('[data-tower="profession"][data-item="'+job+'"]').tap();assert.equal(await page.locator('.hero-skill-list article').count(),5);await page.locator('[data-tower="hero-create-start"]').tap();const close=page.locator('[data-tower="close"]').first();if(await close.isVisible())await close.tap();await page.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running);await page.waitForTimeout(1400);
   const state=await page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r.floor,job:r.party.profession,sex:r.party.sex,gear:Object.values(r.equipment).filter(Boolean).map(g=>({kind:g.kind,version:g.durabilityVersion,max:g.maxDurability})),model:playerGroup.userData.heroJob};});assert.ok(state.valid);assert.equal(state.floor,99);assert.equal(state.job,job);assert.equal(state.sex,'female');assert.equal(state.model,job);assert.ok(state.gear.every(g=>g.version===5));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:out+'/'+width+'-story.png'});
   await page.locator('#towerBagBtn').tap();assert.ok(await page.locator('#towerDialog').isVisible());await page.screenshot({path:out+'/'+width+'-equipment.png'});await page.locator('[data-tower="close"]').first().tap();
   await page.locator('#viewToggle').tap();await page.waitForFunction(()=>G.view==='fp'&&TowerMode.sightRoot()?.getObjectByName('hero-first-person-weapon')?.visible);await page.waitForTimeout(350);await page.screenshot({path:out+'/'+width+'-first-person.png'});
   report.views.push({width,height,home:true,multiplayerEntry:true,story:state,firstPerson:true});
  }
  if(!job)report.views.push({width,height,portraitGate:true});
  await page.goto(new URL('docs/'+encodeURIComponent('職業裝備圖鑑.html'),base).href,{waitUntil:'networkidle'});await page.waitForSelector('html[data-atlas-ready="true"]');assert.match(await page.locator('body').innerText(),new RegExp(version.replaceAll('.','\\.')));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+width+'-atlas.png'});await context.close();
 }
 assert.deepEqual(report.blocked,[]);assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;throw e;}finally{
 await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:!!report.pass,version,sha,hashes:report.hashes.length,services:report.services,views:report.views.map(v=>({width:v.width,height:v.height,story:!!v.story,portraitGate:!!v.portraitGate})),errors:report.errors,failure:report.failure}));
}
