// Isolated local-only fixtures. Does not touch player saves or production services.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/work-progress-qa',report={sites:[],layouts:[],screenshots:[],errors:[]};await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',e=>report.errors.push(e.stack));
 const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
 const bridge=`window.__workQA={
  load(job='healer'){
   closeDialog();let chosen;for(let seed=1;seed<1000;seed++){const n=Heroes.enable(P.enable(C.newRun({seed,name:'作業驗證'}),job==='swordsman'?'mage':'swordsman').run).run;if(TowerExpedition.siteOffer(n)?.job===job){chosen=n;break;}}
   if(!chosen||!C.validateSave(chosen))throw Error('No valid work fixture');run=chosen;floorStarted=false;enter();closeDialog();setHudExpanded(false);G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});hurtLeft=0;
   for(const m of monsters){m.alive=false;m.model.visible=false;}
   const s=partyUI.reserved().find(s=>s.kind==='site');G.px=s.x;G.pz=s.z;playerGroup.position.set(s.x,0,s.z);partyUI.tick(0,performance.now());partyUI.hud();return {job:s.offer.job,label:s.offer.verb};
  },
  freeze(){G.frozen=true;},
  fullTeam(){Heroes.gainXp(run,TowerHeroGrowth.XP[2]);for(const profession of ['scout','chef','smith']){const m={id:'qa-'+profession,profession,sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(m);run.party.joined.push(m.id);Heroes.addMember(run,m);}if(!C.validateSave(run))throw Error('Invalid full team');partyUI.refreshActors();partyUI.hud();},
  expanded(value){setHudExpanded(value);},
  interact(){partyUI.interact();},
  step(dt){G.frozen=true;partyUI.tick(dt,performance.now());partyUI.hud();return this.state();},
  state(){return {progress:run.party.journey.site.progress,done:run.party.journey.site.done,coins:run.coins,valid:!!C.validateSave(run),hidden:el('towerWorkProgress').hidden,bar:el('towerWorkProgress').querySelector('progress').value,text:el('towerWorkProgress').textContent};},
  hurt(){hurtLeft=1;partyUI.tick(.01,performance.now());hurtLeft=0;partyUI.hud();return this.state();},
  away(){G.px+=12;playerGroup.position.x=G.px;partyUI.tick(.01,performance.now());return this.state();},
  returnToSite(){const s=partyUI.reserved().find(s=>s.kind==='site');G.px=s.x;G.pz=s.z;playerGroup.position.set(s.x,0,s.z);partyUI.tick(0,performance.now());return this.state();},
  shift(){G.shifting=true;partyUI.tick(.1,performance.now());G.shifting=false;partyUI.shift();return this.state();},
  close(){closeDialog();G.frozen=true;},
  save(){save();}
 };`;
 await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
 await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:r.request().url().includes('runtime-config')?'{}':'[]'}));
 await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();assert.equal(await page.locator('#homePanel .home-action').count(),6);
 const bar=page.locator('#towerWorkProgress');
 async function start(){await page.evaluate(()=>__workQA.interact());assert.doesNotMatch(await page.locator('.tower-site-progress').innerText(),/秒|\d/);assert.doesNotMatch(await page.locator('#towerDialog').innerText(),/十二秒|12\s*秒|已完成\s*\d+\s*秒/);await page.locator('[data-tower="party-explore-work"]').tap();await page.evaluate(()=>__workQA.freeze());assert.ok(await bar.isVisible());}
 for(const job of process.env.WORK_LAYOUT_ONLY==='1'?[]:['swordsman','mage','scout','chef','healer','smith']){
  const fixture=await page.evaluate(j=>__workQA.load(j),job);await start();const half=await page.evaluate(()=>__workQA.step(5));assert.ok(half.valid&&!half.done&&half.bar>=40&&half.bar<60);assert.match(half.text,new RegExp(fixture.label));assert.doesNotMatch(half.text,/秒|\d/);
  const interrupted=await page.evaluate(()=>__workQA.hurt());assert.equal(interrupted.progress,half.progress);assert.match(interrupted.text,/暫停/);assert.ok(!interrupted.hidden);
  assert.ok((await page.evaluate(()=>__workQA.away())).hidden);assert.ok(!(await page.evaluate(()=>__workQA.returnToSite())).hidden);
  await start();const done=await page.evaluate(()=>__workQA.step(8));assert.ok(done.done&&done.hidden&&done.valid);const repeat=await page.evaluate(()=>__workQA.step(20));assert.equal(done.coins,repeat.coins);report.sites.push({job,half,done});
 }
 for(const [width,height]of [[1440,900],[844,390],[568,320]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>__workQA.load('healer'));await start();await page.evaluate(()=>__workQA.step(4));
  await page.waitForFunction(()=>document.getElementById('towerObjective').hidden,null,{timeout:10000});assert.ok(await bar.isVisible(),'work is independent from three-second story hint');
  const state=await page.evaluate(()=>__workQA.state());assert.ok(state.bar>=33&&state.bar<45);
  const box=await bar.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);for(const id of ['towerHud','heroTeamBar','heroSkillBar','heroQuickBar','towerTalkBtn']){const b=await page.locator('#'+id).boundingBox();if(b)assert.ok(Math.min(box.x+box.width,b.x+b.width)-Math.max(box.x,b.x)<1||Math.min(box.y+box.height,b.y+b.height)-Math.max(box.y,b.y)<1,'work overlaps '+id);}
  const file=out+'/'+width+'-purify.png';await page.screenshot({path:file});report.screenshots.push(file);report.layouts.push({width,height,box});
  await page.evaluate(()=>{__workQA.fullTeam();__workQA.expanded(true);});const expanded=await bar.boundingBox(),dock=await page.locator('#battleDock').boundingBox();await page.screenshot({path:out+'/'+width+'-expanded.png'});report.layouts.push({width,height,expanded:true,box:expanded,dock});assert.ok(expanded.y+expanded.height<dock.y,'expanded work row must remain above battle dock');await page.evaluate(()=>__workQA.expanded(false));
  await page.locator('#actionsToggle').tap();assert.equal(await bar.isVisible(),false);const before=await page.evaluate(()=>__workQA.state());await page.evaluate(()=>__workQA.step(2));assert.equal((await page.evaluate(()=>__workQA.state())).progress,before.progress);await page.evaluate(()=>__workQA.close());assert.ok(await bar.isVisible());
 }
 await page.evaluate(()=>__workQA.save());await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();if(await page.locator('[data-tower="close"]').first().isVisible())await page.locator('[data-tower="close"]').first().tap();await page.evaluate(()=>__workQA.freeze());
 const reloaded=await page.evaluate(()=>__workQA.returnToSite());assert.ok(reloaded.progress>=4&&!reloaded.done);assert.match(reloaded.text,/暫停/);report.reloaded=true;
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#landscapeGate').isVisible());await page.screenshot({path:out+'/390-portrait.png'});report.screenshots.push(out+'/390-portrait.png');
 await page.setViewportSize({width:844,height:390});await page.goto('http://127.0.0.1:8795/?qa=multiplayer#home',{waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));if(await page.locator('#enterMenuBtn').isVisible())await page.locator('#enterMenuBtn').tap();await page.locator('#mpBtn').tap();await page.locator('#playerName').fill('介面驗證');await page.locator('#profileNextBtn').tap();await page.locator('#startBtn').tap();assert.ok(await page.locator('#mpJoin').isVisible());assert.equal(await bar.isVisible(),false);report.multiplayerEntry=true;
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;throw error;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
