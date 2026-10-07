// 逃生梯（GM）入口：本機隔離瀏覽器驗證。不連房間、不寫任何 API，只用測試專用的瀏覽器存檔。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795/',out=process.env.MAZE_QA_OUT||'.agent-run/gm-ladder-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'local QA only');await mkdir(out,{recursive:true});
const report={views:[],errors:[],blocked:[]},browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const ladder=base.replace(/\/?$/,'/')+'#'+encodeURIComponent('逃生梯');
try{
  for(const [width,height]of [[844,390],[1440,900]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(20000);
    page.on('pageerror',e=>report.errors.push(width+': '+e.stack));
    await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())||new URL(r.request().url()).origin!==new URL(base).origin){report.blocked.push(r.request().url());return r.abort();}return r.continue();});
    await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));
    await page.addInitScript(()=>{window.WebSocket=class{constructor(){throw Error('No room connections in ladder tests');}};});
    // 1. The normal address shows nothing and keeps the real save key.
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#gmLadderBtn').count(),0,'no ladder on the normal address');assert.equal(await page.evaluate(()=>TowerGM.active()),false);
    const official=await page.evaluate(()=>{const run=TowerCore.newRun({seed:4242,name:'正式旅人'});localStorage.setItem('maze3d_tower_v1',JSON.stringify(run));return localStorage.getItem('maze3d_tower_v1');});
    // 2. The ladder address opens the panel on its own.
    await page.goto('about:blank');await page.goto(ladder,{waitUntil:'networkidle'});
    await page.locator('#gmLadderPanel:not([hidden])').waitFor();assert.ok(await page.locator('#gmLadderBtn').isVisible());
    assert.equal(await page.locator('#gmLadderPanel [data-gm="floor"] option').count(),149);
    await page.locator('#gmLadderPanel [data-gm="floor"]').selectOption('-10');
    assert.equal(await page.locator('#gmLadderPanel [data-gm-member="3"]').getAttribute('aria-disabled'),'false','four companions underground');
    await page.locator('#gmLadderPanel [data-gm="job"]').selectOption('archer');await page.locator('#gmLadderPanel [data-gm="level"]').fill('12');
    await page.locator('#gmLadderPanel [data-gm-mjob="0"]').selectOption('mage');await page.locator('#gmLadderPanel [data-gm-mlevel="0"]').fill('8');
    await page.locator('#gmLadderPanel [data-gm-act="full"]').tap();await page.evaluate(()=>{document.getElementById('gmLadderPanel').scrollTop=0;});await page.screenshot({path:out+'/'+width+'-panel.png'});
    const labels=await page.$$eval('#gmLadderPanel .gm-items label span',spans=>spans.map(s=>s.textContent));assert.ok(labels.every(text=>!/^[a-z_]+$/.test(text)),'every item shows its Chinese name: '+labels.filter(text=>/^[a-z_]+$/.test(text)).join(','));
    report.views.push({width,height,panelOverflow:await page.evaluate(()=>document.getElementById('gmLadderPanel').scrollWidth>innerWidth+1)});
    await page.locator('#gmLadderPanel [data-gm-act="go"]').tap();
    await page.waitForFunction(()=>TowerMode.active&&document.getElementById('towerFloor')?.textContent==='B10');
    for(let i=0;i<6&&await page.locator('[data-tower="close"]:visible').count();i++)await page.locator('[data-tower="close"]:visible').first().tap();
    const deep=await page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem(TowerGM.GM_SAVE)));return {valid:!!r,floor:r.floor,job:r.party.profession,level:TowerHeroes.level(r,'hero'),members:r.party.members.map(m=>m.profession),arrows:r.bag.arrow,coins:r.coins,heal:r.bag.heal,scrap:r.party.journey.scrap,official:localStorage.getItem('maze3d_tower_v1')};});
    assert.equal(deep.valid,true);assert.equal(deep.floor,-10);assert.equal(deep.job,'archer');assert.equal(deep.level,12);assert.deepEqual(deep.members,['mage']);assert.equal(deep.heal,99);assert.equal(deep.scrap,99);assert.equal(deep.coins,9999);
    assert.equal(deep.official,official,'the real journey is untouched');
    await page.waitForTimeout(600);await page.screenshot({path:out+'/'+width+'-b10.png'});
    // 3. During play the ladder pauses the floor and a new jump reloads straight into it.
    await page.locator('#gmLadderBtn').tap();await page.locator('#gmLadderPanel:not([hidden])').waitFor();
    assert.equal(await page.evaluate(()=>TowerMode.paused),true,'the floor waits while the panel is open');
    assert.equal(await page.locator('#gmLadderPanel [data-gm="job"]').inputValue(),'archer','the last setup is remembered');
    await page.locator('#gmLadderPanel [data-gm="floor"]').selectOption('55');
    assert.equal(await page.locator('#gmLadderPanel [data-gm-member="3"]').getAttribute('aria-disabled'),'true','three companions on the surface');
    const prompts=[];page.on('dialog',d=>{prompts.push(d.type());d.dismiss();});
    await Promise.all([page.waitForEvent('load'),page.locator('#gmLadderPanel [data-gm-act="go"]').tap()]);
    assert.deepEqual(prompts,[],'no leave-page prompt interrupts the jump');
    try{await page.waitForFunction(()=>window.TowerMode?.active&&document.getElementById('towerFloor')?.textContent==='55 F',null,{timeout:30000});}
    catch(error){report.diagnostic=await page.evaluate(()=>({hash:location.hash,active:window.TowerMode?.active,floor:document.getElementById('towerFloor')?.textContent,panelHidden:document.getElementById('gmLadderPanel')?.hidden,splash:document.getElementById('splashScreen')?.classList.contains('active'),dialog:document.getElementById('towerDialog')?.innerText?.slice(0,300),flag:sessionStorage.getItem(TowerGM.AUTOSTART),save:!!localStorage.getItem(TowerGM.GM_SAVE)}));throw error;}
    const surface=await page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem(TowerGM.GM_SAVE)));return {floor:r.floor,level:TowerHeroes.level(r,'hero'),panelHidden:document.getElementById('gmLadderPanel').hidden,official:localStorage.getItem('maze3d_tower_v1')};});
    assert.equal(surface.floor,55);assert.equal(surface.level,10,'the hero level is clamped to the surface cap');assert.equal(surface.panelHidden,true,'a reload with a prepared journey starts it directly');assert.equal(surface.official,official);
    await page.waitForTimeout(600);await page.screenshot({path:out+'/'+width+'-55f.png'});
    // Skip the floor brief and look at live play: the ladder button must not cover the story HUD.
    for(let i=0;i<4&&await page.locator('#towerCinema [data-cinema="skip"]:visible').count();i++){await page.locator('#towerCinema [data-cinema="skip"]:visible').tap();await page.waitForTimeout(250);}
    for(let i=0;i<4&&await page.locator('[data-tower="close"]:visible').count();i++)await page.locator('[data-tower="close"]:visible').first().tap();
    await page.waitForTimeout(500);await page.screenshot({path:out+'/'+width+'-play.png'});
    const overlap=await page.evaluate(()=>{const b=document.getElementById('gmLadderBtn').getBoundingClientRect();return [...document.querySelectorAll('#gameScreen *')].filter(el=>el!==document.getElementById('gmLadderBtn')&&!el.closest('#towerCinema')&&el.children.length===0).filter(el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden')return false;return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;}).map(el=>el.id||el.className).slice(0,6);});
    report.views.at(-1).overlap=overlap;
    report.views.at(-1).deep=deep;report.views.at(-1).surface=surface;
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);
  report.pass=true;
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,1));await browser.close();}
console.log(JSON.stringify({pass:report.pass===true,views:report.views.map(v=>({width:v.width,overflow:v.panelOverflow,deep:v.deep?.floor,surface:v.surface?.floor})),errors:report.errors.length}));
