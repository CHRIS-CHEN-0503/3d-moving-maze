// Disposable browser fixtures; no test bridge is shipped with the game.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/target-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={};
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});page.on('pageerror',e=>errors.push(e.stack));page.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()?.errorText));
 const mode=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
 const bridge=`window.__targetQA={
 seed(){let n=Heroes.enable(P.enable(C.newRun({seed:1,name:'測試療癒師'}),'healer').run).run;n.coins=999;Heroes.gainXp(n,1800);for(const f of [99,95,91]){n.floor=f;n.floorsCleared=99-f;n.chronicle=N.newChronicle(f);P.advance(n);const o=P.recruitOffer(n);if(o)n=P.recruit(n,o.id).run;}n.floor=99;n.floorsCleared=0;n.chronicle=N.newChronicle(99);P.advance(n);n.party.ingredients.herb=30;const a=Heroes.actor(n,'hero');a.skills=['light_bolt','herbal_heal','revive'];a.cooldowns=Object.fromEntries(a.skills.map(id=>[id,0]));a.passives=['herbalism','purity'];run=n;enter();closeDialog();G.frozen=true;for(const m of monsters){m.alive=false;m.model.visible=false;}partyUI.heroes.tick(0);const models=world.getObjectByName('tower-party-scene').children.filter(m=>m.userData.companionId);models.forEach((m,i)=>m.position.set(G.px+.3*(i+1),0,G.pz));Heroes.ids(run).forEach(id=>Heroes.setHp(run,id,Heroes.maxHp(run,id)));Heroes.setHp(run,Heroes.ids(run)[1],1);partyUI.heroes.hud(true);return this.state();},
 state(){return {ids:Heroes.ids(run),active:Heroes.state(run).active,hp:Object.fromEntries(Heroes.ids(run).map(id=>[id,Heroes.hp(run,id)])),herb:run.party.ingredients.herb,cooldowns:Heroes.actor(run,'hero').cooldowns,valid:!!C.validateSave(run)};},
 hp(id,value){Heroes.setHp(run,id,value);partyUI.heroes.hud(true);},
 far(id){world.getObjectByName('tower-party-scene').children.find(m=>m.userData.companionId===id).position.set(G.px+50,0,G.pz);partyUI.heroes.hud(true);},
 release(){partyUI.heroes.tick(1.6);return this.state();},
 pause(){paused=true;partyUI.heroes.tick(0);partyUI.heroes.hud(true);},
 shifting(){G.shifting=true;partyUI.heroes.tick(0);partyUI.heroes.hud(true);}
 };`;
 await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:mode.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
 await page.goto('http://127.0.0.1:8795',{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
 const skill=id=>page.locator('[data-hero-skill="'+id+'"]'),card=id=>page.locator('[data-hero-switch="'+id+'"]'),prompt=page.locator('#heroTargetPrompt');
 let state=await page.evaluate(()=>__targetQA.seed()),id=state.ids[1];assert.equal(state.ids.length,4);assert.equal(state.valid,true);
 await skill('herbal_heal').tap();assert.equal(await prompt.isVisible(),true);assert.equal(await page.locator('#towerOverlay').isVisible(),false);assert.equal(await card(id).isDisabled(),false);assert.equal(await card('hero').isDisabled(),true);
 state=await page.evaluate(()=>__targetQA.state());assert.equal(state.herb,30);assert.equal(state.cooldowns.herbal_heal,0);
 report.mobile=await prompt.boundingBox();await page.screenshot({path:out+'/mobile-target.png'});
 // A rapid second tap must not open strategies or switch the controlled actor.
 const box=await card(id).boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(400);
 state=await page.evaluate(()=>__targetQA.state());assert.ok(state.hp[id]>1);assert.equal(state.active,'hero');assert.equal(state.herb,29);assert.equal(state.cooldowns.herbal_heal,25);assert.equal(await prompt.isVisible(),false);assert.equal(await page.locator('#heroTactics').isVisible(),false);assert.equal(state.valid,true);report.heal=state;
 for(const cancel of ['button','escape','same-skill']){await page.evaluate(()=>__targetQA.seed());await skill('herbal_heal').tap();if(cancel==='button')await prompt.locator('button').tap();else if(cancel==='escape')await page.keyboard.press('Escape');else await skill('herbal_heal').tap();assert.equal(await prompt.isVisible(),false);assert.equal((await page.evaluate(()=>__targetQA.state())).herb,30);}
 await page.evaluate(()=>__targetQA.seed());await page.evaluate(id=>__targetQA.hp(id,0),id);assert.equal(await card(id).isDisabled(),true);await skill('revive').tap();assert.equal(await card(id).isDisabled(),false);await card(id).tap();state=await page.evaluate(()=>__targetQA.state());assert.equal(state.hp[id],0);assert.equal(state.herb,30);state=await page.evaluate(()=>__targetQA.release());assert.ok(state.hp[id]>0);assert.equal(state.herb,28);assert.equal(state.cooldowns.revive,100);assert.equal(state.valid,true);report.revive=state;
 await page.evaluate(()=>__targetQA.seed());await skill('herbal_heal').tap();await page.evaluate(id=>__targetQA.far(id),id);assert.equal(await card(id).isDisabled(),true);assert.match(await prompt.innerText(),/靠近/);await prompt.locator('button').tap();assert.equal((await page.evaluate(()=>__targetQA.state())).herb,30);
 for(const action of ['pause','shifting']){await page.evaluate(()=>__targetQA.seed());await skill('herbal_heal').tap();await page.evaluate(action=>__targetQA[action](),action);assert.equal(await prompt.isVisible(),false);}
 report.layouts=[];for(const viewport of [{width:568,height:320},{width:1024,height:768}]){await page.setViewportSize(viewport);await page.evaluate(()=>__targetQA.seed());await skill('herbal_heal').tap();const p=await prompt.boundingBox(),t=await page.locator('#heroTeamBar').boundingBox();assert.ok(p.x>=0&&p.y>=0&&p.x+p.width<=viewport.width&&p.y+p.height<=viewport.height);assert.ok(t.y>=p.y+p.height);assert.ok(t.y+t.height<=viewport.height);report.layouts.push({viewport,prompt:p,team:t});await page.screenshot({path:out+'/'+viewport.width+'-target.png'});await prompt.locator('button').tap();}
 // Outside target selection, single tap still opens strategies and double tap still switches.
 await page.waitForTimeout(350);await card(id).tap();await page.waitForTimeout(380);assert.equal(await page.locator('#heroTactics').isVisible(),true);await page.keyboard.press('Escape');await card(id).dblclick({delay:70});assert.equal((await page.evaluate(()=>__targetQA.state())).active,id);
 report.errors=errors;assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,...report},null,2));
}finally{await browser.close();}
