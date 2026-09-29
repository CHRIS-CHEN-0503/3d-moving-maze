// New disposable browser profile; fixture bridge never ships in game code.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:8795',out='.agent-run/heroes-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={};
try{
 const page=await browser.newPage({viewport:{width:1180,height:700},hasTouch:true});page.on('pageerror',e=>errors.push(e.stack));
 const mode=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
 const bridge=`window.__heroesQA={
  seed(job='mage',floor=99){let n=Heroes.enable(P.enable(C.newRun({name:'測試冒險者',seed:1}),job).run).run;n.coins=999;n.floor=floor;n.floorsCleared=99-floor;n.chronicle=N.newChronicle(floor);P.advance(n);for(const f of [99,95,91]){n.floor=f;n.floorsCleared=99-f;n.chronicle=N.newChronicle(f);P.advance(n);const o=P.recruitOffer(n);if(o){const joined=P.recruit(n,o.id);if(!joined.ok)throw Error(joined.message);n=joined.run;}}n.floor=floor;n.chronicle=N.newChronicle(floor);n.floorsCleared=99-floor;P.advance(n);n.party.ingredients={root:30,herb:30,shell:30,mushroom:30,nectar:30,meat:30};if(!C.validateSave(n))throw Error('Bad test save');run=n;enter();closeDialog();return snapshot();},
  close(){closeDialog();},snapshot,manage(){partyUI.heroes.panel();},catalog(job){partyUI.heroes.catalog(job);},
  switch(id){handleAction('hero-switch',id);return snapshot();},
  equip(kind){const g=C.createGear(kind,run.floor,run.seed,'qa:'+kind);if(!transact(C.grantGear(run,g)))throw Error('grant');if(!transact(Heroes.equip(run,Heroes.state(run).active,g.id)))throw Error('equip');return snapshot();},
  level(){Heroes.gainXp(run,6000);save();return snapshot();},
  tick(dt){tick(dt,performance.now());return snapshot();},
  cast(id){partyUI.heroes.cast(id,Heroes.state(run).active);return snapshot();},
  next(){const before=run.floor;const result=C.descend(run);if(!result.ok)throw Error(result.message);run=result.run;loadFloor(false);closeDialog();return {before,after:run.floor,...snapshot()};},
  reload(){loadFloor(false);closeDialog();return snapshot();},
  attack(){attack();return snapshot();},
  probeAttack(){const id=Heroes.actor(run).skills.find(k=>Heroes.SKILLS[k].attack),m=monsters.find(m=>m.alive);if(!m)throw Error('No fixture monster');for(const k of Heroes.ids(run).filter(k=>k!=='hero'))Heroes.setHp(run,k,0);Heroes.actor(run).attack=0;Heroes.actor(run).cooldowns[id]=0;const before=run.party.health[m.id]??P.monsterSpecs(run).find(s=>s.id===m.id).maxHp;m.model.position.set(G.px,0,G.pz+.9);playerGroup.rotation.y=0;partyUI.heroes.cast(id,'hero');for(let i=0;i<35;i++){Heroes.tick(run,.04);partyUI.heroes.tick(.04);}const result={id,before,after:run.defeatedMonsters.includes(m.id)?0:run.party.health[m.id]??before,valid:!!C.validateSave(run)};if(!result.valid)throw Error('Attack invalid '+id);return result;},
  probeTool(){Heroes.actor(run).passives=['tool_supply','care'];G.shovels=run.engine.shovels=1;Heroes.actor(run).tool=0;let found=false;for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){playerGroup.rotation.y=angle;if(findWallAhead()){found=true;break;}}if(!found)throw Error('No nearby test wall');useShovel();tick(.05,performance.now());return {tools:G.shovels,cooldown:Heroes.actor(run).tool,valid:!!C.validateSave(run)};},
  fp(){G.view='fp';updateHeroFirstPerson();return {count:heroFp.children.length,visible:heroFp.visible};},
 };
 function snapshot(){return {run:C.validateSave(run),active:run?.party?.loadouts?.active,player:{x:G.px,z:G.pz,job:playerGroup?.userData.heroJob,weapon:playerGroup?.userData.heroWeapon,pieces:playerGroup?.userData.heroPieces?.map(p=>p.name)},actors:world?.children.find(g=>g.name==='tower-party-scene')?.children.filter(m=>m.userData.companionId).map(m=>({id:m.userData.companionId,x:m.position.x,z:m.position.z,weapon:m.userData.heroWeapon,pieces:m.userData.heroPieces?.map(p=>p.name)})),dialog:!el('towerOverlay').hidden,stats:renderer.info.render};}
 `;
 assert.ok(mode.includes('  install();\n})();'));
 await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:mode.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(()=>{localStorage.setItem('qa-setting-preserve','yes');const old=TowerCore.newRun({seed:99,name:'旧檔保存'});localStorage.setItem('maze3d_tower_v1',JSON.stringify(old));TowerMode.open();});
 await page.locator('[data-tower="new"]').click();await page.locator('[data-tower="new-confirm"]').click();
 assert.equal(await page.locator('[data-tower="profession"]').count(),6);
 await page.locator('#heroNameInput').fill('星光旅人');await page.locator('[data-tower="profession"][data-item="mage"]').click();
 await page.evaluate(()=>__heroesQA.close());
 report.start=await page.evaluate(()=>({save:__heroesQA.snapshot().run,backups:Object.keys(localStorage).filter(k=>k.startsWith('maze3d_tower_v1_before_heroes_')).map(k=>JSON.parse(localStorage[k])),setting:localStorage.getItem('qa-setting-preserve')}));
 assert.equal(report.start.save.name,'星光旅人');assert.equal(report.start.save.party.loadouts.actors.hero.skills.length,3);assert.ok(report.start.backups.some(s=>s.name==='旧檔保存'));assert.equal(report.start.setting,'yes');
 report.jobs=[];
 for(const job of ['swordsman','mage','scout','chef','healer','smith']){
   const state=await page.evaluate(job=>__heroesQA.seed(job,84),job);assert.ok(state.run,job+' invalid runtime state');assert.equal(state.player.job,job);assert.equal(state.actors.length,3);assert.equal(new Set(state.actors.map(a=>a.id)).size,3);assert.equal(await page.locator('#heroSkillBar button').count(),3);
   await page.screenshot({path:out+'/'+job+'.png'});const combat=await page.evaluate(()=>__heroesQA.probeAttack());assert.ok(combat.after<combat.before,job+' actual skill hit');report.jobs.push({job,weapon:state.player.weapon,actors:state.actors.length,stats:state.stats,combat});
 }
 await page.evaluate(()=>__heroesQA.seed('swordsman'));let state=await page.evaluate(()=>__heroesQA.equip('greatsword'));assert.equal(state.run.equipment.shield,null);assert.equal(state.player.weapon,'greatsword');
 await page.evaluate(()=>__heroesQA.seed('smith'));state=await page.evaluate(()=>__heroesQA.equip('warhammer'));assert.equal(state.player.weapon,'warhammer');assert.equal(state.run.equipment.shield,null);report.tool=await page.evaluate(()=>__heroesQA.probeTool());assert.equal(report.tool.tools,0);assert.ok(report.tool.cooldown>89);assert.ok(report.tool.valid);
 await page.evaluate(()=>__heroesQA.seed('swordsman'));state=await page.evaluate(()=>__heroesQA.equip('greatsword'));
 const switched=await page.evaluate(()=>{const before=__heroesQA.snapshot(),target=before.actors[1],state=__heroesQA.switch(target.id);return {before,target,state};});const from=switched.before.active,id=switched.target.id,target=switched.target;
 state=switched.state;assert.equal(state.active,id);assert.equal(state.actors.length,3);assert.ok(state.actors.some(a=>a.id===from));assert.ok(!state.actors.some(a=>a.id===id));assert.ok(Math.hypot(state.player.x-target.x,state.player.z-target.z)<.1);report.switch=state;
 state=await page.evaluate(()=>__heroesQA.next());assert.equal(state.after,98);assert.equal(state.active,id);assert.equal(state.actors.length,3);assert.ok(state.run);
 await page.evaluate(()=>__heroesQA.manage());await page.screenshot({path:out+'/equipment.png'});assert.equal(await page.locator('.hero-equipped').count(),4);
 await page.evaluate(()=>__heroesQA.catalog('smith'));await page.screenshot({path:out+'/catalog.png'});assert.ok(await page.locator('.hero-catalog .hero-icon').count()>=9);
 await page.evaluate(()=>__heroesQA.close());await page.setViewportSize({width:844,height:390});await page.evaluate(()=>__heroesQA.seed('mage'));await page.waitForTimeout(500);
 const boxes=await page.locator('#heroSkillBar button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));assert.ok(boxes.every(b=>b.x>=0&&b.x+b.w<=844&&b.y>=0&&b.y+b.h<=390));report.mobileButtons=boxes;
 await page.screenshot({path:out+'/mobile.png'});await page.evaluate(()=>__heroesQA.manage());await page.screenshot({path:out+'/mobile-equipment.png'});await page.locator('[data-tower="hero-tab"][data-item="skills"]').click();assert.equal(await page.locator('.hero-skill-list article').count(),5);await page.screenshot({path:out+'/mobile-skills.png'});await page.locator('[data-tower="hero-tab"][data-item="bag"]').click();assert.match(await page.locator('#towerDialog').innerText(),/裝備背包/);
 await page.evaluate(()=>__heroesQA.close());report.firstPerson=await page.evaluate(()=>__heroesQA.fp());assert.equal(report.firstPerson.visible,true);assert.equal(report.firstPerson.count,1);
 const guide=await browser.newPage({viewport:{width:1180,height:900}});guide.on('pageerror',e=>errors.push(e.stack));await guide.goto(base+'/docs/'+encodeURIComponent('職業裝備圖鑑.html'));assert.equal(await guide.locator('.hero-icon').count(),71);await guide.screenshot({path:out+'/full-guide.png'});await guide.close();
 report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,jobs:report.jobs,mobileButtons:boxes,errors},null,2));
}finally{await browser.close();}
