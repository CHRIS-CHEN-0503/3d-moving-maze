import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/tactics-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={};
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});page.on('pageerror',e=>errors.push(e.stack));
 const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
 const bridge=`window.__tacticsQA={
 seed(){run=Heroes.enable(P.enable(C.newRun({seed:1,name:'測試'}),'mage').run).run;run.coins=999;run=P.recruit(run,P.recruitOffer(run).id).run;enter();closeDialog();G.frozen=true;for(const m of monsters){m.alive=false;m.model.visible=false;}partyUI.heroes.hud(true);return this.state();},
 state(){return {active:Heroes.state(run).active,ids:Heroes.ids(run),policies:TowerHeroGrowth.state(run).policies,valid:!!C.validateSave(run),alert:encounterAlert.state()};},
 redraw(){partyUI.heroes.hud(true);},
 unlockSwitch(){Heroes.state(run).switchLeft=0;},
 alert(threat,dt=.05){encounterAlert.update(threat,dt);return this.state();},
 floor(){loadFloor(false);closeDialog();G.frozen=true;return this.state();},
 reenter(){enter();closeDialog();G.frozen=true;return this.state();},
 dead(id){Heroes.setHp(run,id,0);partyUI.heroes.hud(true);},
 oldSave(){let n=Heroes.enable(P.enable(C.newRun({seed:2,name:'舊進度'}),'mage').run).run;Heroes.gainXp(n,1350);delete Heroes.state(n).xpScale;Heroes.state(n).xp=135;localStorage.setItem(SAVE,JSON.stringify(n));run=readSave();save();return {restored:Heroes.state(readSave()),backup:JSON.parse(localStorage.getItem(SAVE+'_before_xp10')).party.loadouts};}
 };`;
 await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
 await page.goto('http://127.0.0.1:8795',{waitUntil:'networkidle'});
 await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
 const seed=await page.evaluate(()=>__tacticsQA.seed()),id=seed.ids[1],card=page.locator('[data-hero-switch="'+id+'"]');
 await card.tap();await page.waitForTimeout(380);assert.equal(await page.locator('#heroTactics').isVisible(),true);assert.equal(await page.locator('[data-tactic]').count(),3);assert.equal((await page.evaluate(()=>__tacticsQA.state())).active,'hero');
 report.mobile=await page.locator('#heroTactics').boundingBox();assert.ok(report.mobile.x>=0&&report.mobile.y>=0&&report.mobile.x+report.mobile.width<=844&&report.mobile.y+report.mobile.height<=390);
 await page.screenshot({path:out+'/mobile-strategies.png'});
 for(const strategy of ['support','survive','attack']){if(!await page.locator('#heroTactics').isVisible()){await card.tap();await page.waitForTimeout(380);}await page.locator('[data-tactic="'+strategy+'"]').click();assert.equal((await page.evaluate(()=>__tacticsQA.state())).policies[id].strategy,strategy);}
 const touch=await card.boundingBox();await page.touchscreen.tap(touch.x+touch.width/2,touch.y+touch.height/2);await page.touchscreen.tap(touch.x+touch.width/2,touch.y+touch.height/2);await page.waitForTimeout(400);assert.equal((await page.evaluate(()=>__tacticsQA.state())).active,id);assert.equal(await page.locator('#heroTactics').isVisible(),false);
 await page.setViewportSize({width:568,height:320});await card.tap();await page.waitForTimeout(380);report.small=await page.locator('#heroTactics').boundingBox();assert.ok(report.small.x>=0&&report.small.y>=0&&report.small.x+report.small.width<=568&&report.small.y+report.small.height<=320);const heights=await page.locator('[data-tactic]').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=44));await page.screenshot({path:out+'/small-strategies.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#heroTactics').isVisible(),false);
 await page.setViewportSize({width:1180,height:700});await page.evaluate(()=>__tacticsQA.unlockSwitch());await page.waitForTimeout(400);await page.locator('[data-hero-switch="hero"]').dblclick({delay:80});assert.equal((await page.evaluate(()=>__tacticsQA.state())).active,'hero');
 await page.evaluate(id=>{__tacticsQA.unlockSwitch();const click=()=>document.querySelector('[data-hero-switch="'+id+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));click();__tacticsQA.redraw();click();},id);assert.equal((await page.evaluate(()=>__tacticsQA.state())).active,id);assert.equal(await page.locator('#heroTactics').isVisible(),false);
 await page.evaluate(()=>__tacticsQA.dead('hero'));assert.equal(await page.locator('[data-hero-switch="hero"]').isDisabled(),true);
 report.migration=await page.evaluate(()=>__tacticsQA.oldSave());assert.equal(report.migration.restored.xp,1350);assert.equal(report.migration.restored.xpScale,10);assert.equal(report.migration.backup.xp,135);assert.equal(report.migration.backup.xpScale,undefined);
 await page.evaluate(()=>{__tacticsQA.seed();window.monsterVoices=0;GameVoice.announceAsset=(key)=>{if(key==='alert.monster')window.monsterVoices++;};});
 assert.equal((await page.evaluate(()=>__tacticsQA.alert(true))).alert.visible,true);
 // The fixture freezes gameplay, so refresh the overhead marker while the camera settles.
 await page.evaluate(()=>{const draw=()=>{__tacticsQA.alert(true,0);window.qaAlertFrame=requestAnimationFrame(draw);};draw();});await page.waitForTimeout(300);await page.screenshot({path:out+'/encounter.png'});await page.evaluate(()=>cancelAnimationFrame(window.qaAlertFrame));
 await page.evaluate(()=>{__tacticsQA.alert(false,5);__tacticsQA.alert(true);__tacticsQA.floor();__tacticsQA.alert(true);});assert.equal(await page.evaluate(()=>monsterVoices),1);
 await page.evaluate(()=>{__tacticsQA.reenter();__tacticsQA.alert(true);});assert.equal(await page.evaluate(()=>monsterVoices),2);
 report.errors=errors;assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,...report},null,2));
}finally{await browser.close();}
