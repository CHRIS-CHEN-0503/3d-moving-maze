// Natural entry flows in isolated local profiles. Never connects a room or writes an API.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795/',out='.agent-run/v151-entry-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));await mkdir(out,{recursive:true});
const report={views:[],errors:[],blocked:[]},browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
try{
 for(const [width,height,job]of [[1440,900,'mage'],[844,390,'smith'],[568,320,'archer']]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(16000);page.on('pageerror',e=>report.errors.push(e.stack));
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){report.blocked.push(r.request().url());return r.abort();}return r.continue();});
  await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  await page.addInitScript(()=>{window.__roomAttempts=[];window.WebSocket=class{constructor(url){window.__roomAttempts.push(url);throw Error('No room connections in entry tests');}};});
  const home=async()=>{await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>GAME_VERSION),'1.51.0');await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});await page.locator('#enterMenuBtn').tap();assert.equal(await page.locator('#homePanel .home-action').count(),6);};
  const close=async()=>{const b=page.locator('[data-tower="close"]').first();if(await b.isVisible())await b.tap();};
  await home();await page.screenshot({path:out+'/'+width+'-home.png'});
  await page.locator('#mpBtn').tap();await page.locator('#playerName').fill('介面驗證');await page.locator('#profileNextBtn').tap();await page.locator('#startBtn').tap();assert.ok(await page.locator('#mpCreate').isVisible());assert.ok(await page.locator('#mpJoin').isVisible());assert.deepEqual(await page.evaluate(()=>({on:MP.on,sockets:__roomAttempts.length})),{on:false,sockets:0});await page.screenshot({path:out+'/'+width+'-multiplayer-entry.png'});await page.locator('#mpClose').tap();
  await home();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="new"]').tap();assert.equal(await page.locator('[data-tower="profession"]').count(),7);assert.equal(await page.locator('.hero-skill-list').count(),0);
  await page.locator('#heroNameInput').fill('交易外觀驗證');await page.locator('[data-tower="hero-sex"][data-item="female"]').tap();await page.locator('[data-tower="profession"][data-item="'+job+'"]').tap();assert.equal(await page.locator('.hero-skill-list article').count(),5);await page.locator('[data-tower="hero-create-start"]').tap();await close();await page.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running);
  const snapshot=()=>page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r.floor,seed:r.seed,job:r.party.profession,sex:r.party.sex,skills:r.party.loadouts.actors.hero.skills,gear:Object.values(r.equipment).filter(Boolean).map(g=>({kind:g.kind,max:g.maxDurability}))};});
  const first=await snapshot();assert.ok(first.valid);assert.equal(first.floor,99);assert.equal(first.job,job);assert.equal(first.sex,'female');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:out+'/'+width+'-story.png'});
  await page.locator('#towerBagBtn').tap();assert.ok(await page.locator('#towerDialog').isVisible());await page.screenshot({path:out+'/'+width+'-equipment.png'});await close();
  await page.locator('#actionsToggle').tap();assert.equal(await page.locator('[data-audio-mix]').count(),2);await close();
  await home();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await close();await page.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running);assert.deepEqual(await snapshot(),first,'reload preserves gear and progression');
  // Downgrade only this disposable profile to v4, then use the natural Continue
  // flow: the real save path must back up and migrate once, never heal damage.
  const old=await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('maze3d_tower_v1')),gear=[...Object.values(r.equipment),...(r.gearBag||[]),...Object.values(r.party.loadouts.actors).flatMap(a=>Object.values(a.equipment||{}))].filter(Boolean);for(const g of new Set(gear)){g.durabilityVersion=4;g.maxDurability/=2;g.durability=Math.floor(g.maxDurability/2);}return JSON.stringify(r);});
  // Install after the old page's pagehide save; writing beforehand would test
  // that old live run's final save, rather than actual v4 Continue migration.
  await page.addInitScript(raw=>{if(!sessionStorage.getItem('__v4_fixture_installed')){localStorage.setItem('maze3d_tower_v1',raw);sessionStorage.setItem('__v4_fixture_installed','1');}},old);
  await home();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await close();await page.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running);
  const upgraded=await page.evaluate(()=>({backup:localStorage.getItem('maze3d_tower_v1_before_durability5'),gear:Object.values(JSON.parse(localStorage.getItem('maze3d_tower_v1')).equipment).filter(Boolean).map(g=>({kind:g.kind,version:g.durabilityVersion,max:g.maxDurability,left:g.durability}))}));
  assert.equal(upgraded.backup,old);const oldGear=Object.values(JSON.parse(old).equipment).filter(Boolean);assert.deepEqual(upgraded.gear,oldGear.map(g=>({kind:g.kind,version:5,max:g.maxDurability*2,left:g.durability*2})));
  await home();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await close();await page.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running);assert.deepEqual(await snapshot(),first,'migration reload does not double again');assert.equal(await page.evaluate(()=>localStorage.getItem('maze3d_tower_v1_before_durability5')),old);
  report.views.push({width,height,job,roomChooser:true,story:true,reload:true,v4Backup:true,exactDouble:true,repeatMigration:false,gear:first.gear});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});page=await context.newPage();await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));await page.goto(base,{waitUntil:'networkidle'});assert.ok(await page.locator('#landscapeGate').isVisible());await page.screenshot({path:out+'/390-portrait-gate.png'});
 await page.goto(new URL('docs/'+encodeURIComponent('職業裝備圖鑑.html'),base).href,{waitUntil:'networkidle'});await page.waitForSelector('html[data-atlas-ready="true"]');assert.match(await page.locator('body').innerText(),/1\.51\.0/);await page.locator('#readingRules summary').tap();assert.match(await page.locator('#readingRules').innerText(),/細節貼圖/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/390-atlas-rules.png'});await context.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);report.pass=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
