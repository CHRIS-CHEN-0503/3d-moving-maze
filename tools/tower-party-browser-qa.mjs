// Local-only integration harness: the private bridge is injected into the served
// response, never into the deployed game. Uses an isolated browser profile.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('QA fixtures are restricted to localhost.');
const out='.agent-run/party-qa';await mkdir(out,{recursive:true});
const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__partyQA={state:()=>({run,monsters,loot,partyUI,hurtLeft,paused}),closeDialog,save,inventory,attack,setProtection:n=>hurtLeft=n,
 fixture(floor,job='swordsman',seed=31415){run=P.enable(C.newRun({seed,name:'試玩旅人'}),job).run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);enter();closeDialog();},
 step(dt){tick(dt,performance.now());},
 approach(kind,index=0){const target=partyUI.reserved().filter(s=>s.kind===kind)[index];G.px=target.x;G.pz=target.z;playerGroup.position.set(G.px,0,G.pz);partyUI.tick(.01,performance.now());return {cx:target.cx,cy:target.cy};},
 advanceBoss(){run.party.boss.clock=9;}, shift,};`;
// No production-only shortcuts; refer to existing real shift function explicitly.
const injected=source.replace('  install();\n})();',`  install();\n${bridge.replace('shift,','shift:()=>{wasShifting=true;G.shifting=false;},')}\n})();`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:injected}));
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
 await page.locator('#enterMenuBtn').click();await page.locator('#storyEntryBtn').click();await page.locator('[data-tower="new"]').click();await page.locator('#playerName').fill('試玩旅人');await page.locator('#profileNextBtn').click();
 assert.equal(await page.locator('[data-tower="profession"]').count(),6);await page.screenshot({path:out+'/professions.png'});
 await page.locator('[data-tower="profession"][data-item="swordsman"]').click();await page.evaluate(()=>__partyQA.closeDialog());
 assert.equal(await page.evaluate(()=>TowerMode.partyActive),true);assert.equal(await page.evaluate(()=>__partyQA.state().run.party.profession),'swordsman');
 await page.evaluate(()=>__partyQA.approach('camp'));await page.locator('#towerTalkBtn').click();assert.match(await page.locator('#towerDialogTitle').innerText(),/廚房/);
 await page.locator('[data-tower="party-cook"][data-item="stew"]').click();assert.equal(await page.evaluate(()=>__partyQA.state().run.party.meals.stew),1);
 await page.screenshot({path:out+'/kitchen.png'});await page.evaluate(()=>__partyQA.closeDialog());
 await page.evaluate(()=>__partyQA.approach('recruit'));await page.locator('#towerTalkBtn').click();await page.locator('[data-tower="party-recruit"]').click();assert.equal(await page.evaluate(()=>__partyQA.state().run.party.members.length),1);
 await page.evaluate(()=>__partyQA.closeDialog());await page.setViewportSize({width:844,height:390});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:out+'/mobile-party.png'});
 const boxes=await page.evaluate(()=>['towerProfessionBtn','towerAttackBtn','towerBagBtn','shovelBtn'].map(id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return {id,x:b.x,y:b.y,w:b.width,h:b.height,visible:getComputedStyle(e).display!=='none'};}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.visible&&b.visible)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`overlap: ${a.id}/${b.id}`);}
 const combat=await page.evaluate(()=>{__partyQA.fixture(84);__partyQA.setProtection(0);const s=__partyQA.state(),m=s.monsters[0];G.px=m.model.position.x;G.pz=m.model.position.z-1.8;playerGroup.position.set(G.px,0,G.pz);playerGroup.rotation.y=0;const hp=s.run.hp;__partyQA.attack();const after=__partyQA.state();return {hp,heroHp:after.run.hp,monsterHp:after.run.party.health[m.id],weapon:after.run.equipment.weapon?.durability,hurt:after.hurtLeft};});
 assert.equal(combat.hp,combat.heroHp);assert.equal(combat.hurt,0);assert.ok(combat.monsterHp>0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:out+'/combat.png'});
 for(const floor of [90,80,70,60,50,40,30,20,10,1]){
   await page.evaluate(f=>{__partyQA.fixture(f);__partyQA.approach('boss');__partyQA.state().partyUI.interact();__partyQA.setProtection(2);const d=TowerExpedition.BOSSES[f];__partyQA.state().run.party.boss.clock=d.warning+.1;__partyQA.state().partyUI.tick(.01,performance.now());__partyQA.state().partyUI.hud();G.view='top';G.topZoom=12;updateCamera(1);},floor);
   await page.screenshot({path:out+'/boss-'+floor+'-active.png'});
   const done=await page.evaluate(()=>{const d=TowerExpedition.BOSSES[__partyQA.state().run.floor];for(let round=0;round<8&&!__partyQA.state().run.party.boss.done;round++)for(const t of [1,d.warning+d.strike+1]){__partyQA.state().run.party.boss.clock=round*d.cycle+t;for(let turn=0;turn<4;turn++)for(let index=0;index<d.count;index++){__partyQA.approach('boss',index);if(!__partyQA.state().run.party.boss.seals[index])__partyQA.state().partyUI.interact();}}return __partyQA.state().run.party.boss.done;});
   assert.equal(done,true,'boss '+floor);await page.screenshot({path:out+'/boss-'+floor+'.png'});
 }
 // Real confirmation dialogs, camp-only fees, persistent gear traits.
 await page.evaluate(()=>{__partyQA.fixture(99,'smith');__partyQA.state().run.party.journey.scrap=30;__partyQA.state().run.coins=100;__partyQA.approach('camp');});
 await page.locator('#towerTalkBtn').click();await page.locator('[data-tower="party-forge"]').click();
 await page.screenshot({path:out+'/forge-mobile.png'});
 await page.locator('[data-tower="party-forge-ask"]').first().click();
 assert.match(await page.locator('#towerDialogTitle').innerText(),/耐用/);assert.equal(await page.evaluate(()=>__partyQA.state().run.party.journey.scrap),30);
 await page.locator('[data-tower="party-forge-confirm"]').click();assert.equal(await page.evaluate(()=>__partyQA.state().run.equipment.weapon.forge.level),1);
 await page.locator('[data-tower="party-dismantle-ask"]').click();assert.ok(await page.evaluate(()=>__partyQA.state().run.equipment.weapon));
 await page.locator('[data-tower="party-dismantle"]').click();assert.equal(await page.evaluate(()=>__partyQA.state().run.equipment.weapon),null);
 await page.evaluate(()=>{__partyQA.closeDialog();__partyQA.approach('site');__partyQA.setProtection(0);const s=__partyQA.state(),job=s.partyUI.reserved().find(x=>x.kind==='site').offer.job;s.run.party.profession=job==='mage'?'chef':'mage';});
 await page.locator('#towerTalkBtn').click();await page.screenshot({path:out+'/exploration-mobile.png'});
 assert.equal(await page.locator('[data-tower="party-explore-job"]').isDisabled(),true);
 await page.locator('[data-tower="party-explore-work"]').click();
 const work=await page.evaluate(()=>{const s=__partyQA.state();for(let i=0;i<120;i++)s.partyUI.tick(.1,performance.now());s.partyUI.tick(.2,performance.now());return __partyQA.state().run.party.journey.site.done;});assert.equal(work,true);
 // Render all four new silhouettes and the lower-floor bounded roster.
 await page.evaluate(()=>__partyQA.fixture(39));await page.screenshot({path:out+'/lower-floor.png'});
 const saved=await page.evaluate(()=>{__partyQA.state().run.party.ingredients.nectar=7;__partyQA.save();return JSON.parse(localStorage.getItem('maze3d_tower_v1'));});
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;TowerMode.open(true);});await page.locator('[data-tower="continue"]').click();await page.evaluate(()=>__partyQA.closeDialog());
 assert.equal(await page.evaluate(()=>__partyQA.state().run.party.ingredients.nectar),7);assert.equal(await page.evaluate(()=>__partyQA.state().run.floor),saved.floor);
 // Upgrade a genuine older paid-guard save without touching any user profile.
 const legacy=await page.evaluate(()=>{let old=TowerCore.newRun({seed:7});old=TowerCore.hireWarrior(old,TowerCore.warriorOffer(99,7).id).run;return JSON.stringify(old);});
 await page.reload({waitUntil:'networkidle'});await page.evaluate(old=>{localStorage.setItem('maze3d_tower_v1',old);GameVoice.configure({enabled:false});G.muted=true;TowerMode.open(true);},legacy);await page.locator('[data-tower="continue"]').click();assert.equal(await page.locator('[data-tower="profession"]').count(),6);await page.locator('[data-tower="profession"][data-item="chef"]').click();await page.evaluate(()=>__partyQA.closeDialog());assert.equal(await page.evaluate(()=>__partyQA.state().run.party.members[0].profession),'swordsman');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('maze3d_tower_v1_before_party')).warrior.offerId),JSON.parse(legacy).warrior.offerId);
 assert.equal(await page.evaluate(()=>!!TowerCore.validateSave(localStorage.getItem('maze3d_tower_v1'))),true);
 await page.evaluate(()=>{__partyQA.save();TowerMode.requestQuit();});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors,mobileBoxes:boxes,combat,screenshots:out},null,2));
}finally{await browser.close();}
