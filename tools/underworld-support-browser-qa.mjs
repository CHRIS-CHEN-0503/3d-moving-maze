// Isolated endgame fixtures only; never inject this bridge into the shipped game.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/underworld-support-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={layouts:[],floors:[],screenshots:[],limitations:'Desktop Chrome touch viewports; not an iPhone hardware frame-rate test.'};
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`window.__underworldQA={
    completed(){
      let n=Heroes.enable(P.enable(C.newRun({seed:43,name:'地下驗證'}),'mage','female').run).run;Heroes.gainXp(n,100000);n.coins=5000;
      for(const floor of [99,97,95]){n.floor=floor;n.floorsCleared=99-floor;n.chronicle=N.newChronicle(floor);P.advance(n);const o=P.recruitOffer(n);if(o){const v=P.recruit(n,o.id,n.revision);if(!v.ok)throw Error(v.message);n=v.run;}}
      n.floor=1;n.floorsCleared=99;n.status='won';n.chronicle=N.newChronicle(1);n.chronicle.clues=N.CHAPTERS.filter(c=>c.low>0).map(c=>c.clueId);n.chronicle.ending='release';P.advance(n);
      if(!C.validateSave(n))throw Error('invalid surface fixture');localStorage.setItem(SAVE,JSON.stringify(n));GameVoice.configure({enabled:false});open(true);return {raw:localStorage.getItem(SAVE),members:n.party.members.length};
    },
    state(){return {valid:!!C.validateSave(run),floor:run?.floor,status:run?.status,underworld:run?.underworld,members:run?.party?.members.map(m=>m.id),rift:!!rift,raw:localStorage.getItem(SAVE),surface:localStorage.getItem(SURFACE_CLEAR),backup:localStorage.getItem(SAVE+'_before_underworld'),size:G.mazeW,monsters:monsters.length,limit:run?.party?P.recruitLimit(run):null,boss:run?.party?.boss,lord:run?.party?Lords.spec(run):null,lordDefeated:run?.party?Lords.defeated(run):null};},
    freeze(){closeDialog();G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});partyUI.heroes.tick(0);partyUI.heroes.hud(true);lightingUI.hud();return this.state();},
    prepareFloor(floor,allies=false){
      const move=f=>{run.floor=f;run.floorsCleared=99+(-f-1);run.claimed=[];run.floorElapsed=0;run.defeatedMonsters=[];run.monsterStuns={};run.adventure=E.newAdventure();delete run.engine.mapKnowledge;delete run.engine.sightMemory;P.advance(run);};
      if(allies)for(let f=-1;f>=-50&&run.party.members.length<4;f--){move(f);const o=P.recruitOffer(run);if(o){const v=P.recruit(run,o.id,run.revision);if(v.ok)run=v.run;}}
      move(floor);if(!C.validateSave(run))throw Error('invalid basement fixture');enter();return this.freeze();
    },
    surfaceFinal(){
      run=JSON.parse(localStorage.getItem(SURFACE_CLEAR));run.status='playing';run.floorsCleared=98;run.chronicle.ending=null;run.chronicle.read=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=E.newAdventure();P.advance(run);localStorage.removeItem(SURFACE_CLEAR);
      if(!C.validateSave(run))throw Error('surface final fixture');enter();return this.freeze();
    },
    view(){G.view='tp';G.camPitch=.48;G.camYaw=2.2;updateCamera(1);lightingUI.updateVisual(0,true);MazeSight.update({...sightFrame(),force:true});drawMap(document.getElementById('minimap'),false);renderMaze();return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ratio:renderer.getPixelRatio()};},
    reopen(){open(true);},
    exit(){closeDialog();exitDeclined=false;G.frozen=true;reachExit();return this.state();},
    clue(){if(!transact(N.collectClue(run)))throw Error('clue fixture failed');return this.state();},
    solveBoss(){
      closeDialog();G.frozen=true;const X=TowerExpedition,d=P.BOSS_FLOORS[run.floor];
      const interact=index=>{const node=partyUI.reserved().find(s=>s.kind==='boss'&&s.index===index);if(!node)throw Error('missing live boss node');G.px=node.x;G.pz=node.z;playerGroup.position.set(node.x,0,node.z);node.model.visible=true;partyUI.tick(0,performance.now());const revision=run.revision;if(!partyUI.interact()||run.revision===revision)throw Error('live boss interaction rejected');};
      interact(0);for(let i=0;i<20&&!run.party.boss.done;i++){const b=run.party.boss,index=d.order?d.order.find(k=>!b.seals[k]):b.seals.findIndex(v=>!v);b.clock=Math.floor(b.clock/d.cycle)*d.cycle+d.warning+d.strike+.2;if(b.lastCycles[index]===X.cycle(run))b.clock+=d.cycle;interact(index);}
      if(!run.party.boss.done)throw Error('boss fixture not solved');save();return this.state();
    },
    finishLord(){
      const spec=Lords.spec(run),m=monsters.find(m=>m.id===spec.id);run.party.health[spec.id]=1;Heroes.actor(run,Heroes.state(run).active).attack=0;
      const fired=Heroes.fireProjectile(run,Heroes.state(run).active,spec.id,run.revision);if(!transact(fired))throw Error('lord shot rejected');
      const hit=P.strike(run,spec.id,{shot:true,lootCell:worldToCell(m.model.position.x,m.model.position.z)},run.revision);if(!transact(hit)||!hit.effect.dead)throw Error('lord hit rejected');m.alive=false;m.model.visible=false;save();return this.state();
    },
  };`;
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',route=>route.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();const surface=await page.evaluate(()=>__underworldQA.completed());assert.equal(surface.members,3);
  await page.locator('[data-tower="underworld-intro"]').tap();assert.match(await page.locator('#towerDialog').textContent(),/自己|好奇/);await page.locator('[data-tower="underworld-cancel"]').tap();assert.equal((await page.evaluate(()=>__underworldQA.state())).raw,surface.raw,'cancel must not replace the cleared save');
  await page.locator('[data-tower="underworld-intro"]').tap();const newer=await page.evaluate(()=>{const n=JSON.parse(localStorage.getItem('maze3d_tower_v1'));n.coins++;n.revision++;const raw=JSON.stringify(n);localStorage.setItem('maze3d_tower_v1',raw);return raw;});await page.locator('[data-tower="underworld-start"]').tap();assert.equal((await page.evaluate(()=>__underworldQA.state())).raw,newer,'stale entry must preserve the other tab save');assert.notEqual((await page.evaluate(()=>__underworldQA.state())).floor,-1);assert.equal(await page.locator('[data-tower="underworld-start"]').count(),0);report.staleEntrySafe=true;assert.equal((await page.evaluate(()=>__underworldQA.completed())).raw,surface.raw);
  await page.locator('[data-tower="underworld-intro"]').tap();
  await page.evaluate(()=>{window.__qaStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='maze3d_tower_v1')throw new DOMException('Fixture: storage is full','QuotaExceededError');return window.__qaStorageSet.call(this,key,value);};});
  try{await page.locator('[data-tower="underworld-start"]').tap();const failed=await page.evaluate(()=>__underworldQA.state());assert.equal(failed.raw,surface.raw);assert.notEqual(failed.floor,-1);assert.ok(await page.locator('[data-tower="underworld-start"]').isVisible());report.storageFailureSafe=true;}
  finally{await page.evaluate(()=>{Storage.prototype.setItem=window.__qaStorageSet;delete window.__qaStorageSet;});}
await page.locator('[data-tower="underworld-start"]').tap();let current=await page.evaluate(()=>__underworldQA.freeze());assert.ok(current.valid);assert.equal(current.floor,-1);assert.equal(current.size,19);assert.equal(current.members.length,2);assert.ok(current.underworld.departed);assert.deepEqual(JSON.parse(current.surface),JSON.parse(surface.raw),'validated surface snapshot preserves values; property order may normalize');assert.equal(current.backup,surface.raw);assert.equal(current.rift,false);assert.equal(current.limit,4);report.entry=current;
  async function screenshot(name){await page.screenshot({path:out+'/'+name+'.png'});report.screenshots.push(out+'/'+name+'.png');}
  async function layout(kind,width,height){const r=await page.evaluate(()=>{const d=document.getElementById('towerDialog'),c=d.querySelector('.tower-dialog-content'),b=d.getBoundingClientRect();return {root:document.documentElement.scrollWidth,content:c.scrollWidth,client:c.clientWidth,left:b.left,top:b.top,right:b.right,bottom:b.bottom};});assert.ok(r.root<=width+1&&r.content<=r.client+2,kind+' overflow '+JSON.stringify(r));assert.ok(r.left>=-1&&r.top>=-1&&r.right<=width+1&&r.bottom<=height+1);report.layouts.push({kind,width,height,...r});}
  await page.locator('#towerLightBtn').tap();await page.evaluate(()=>__underworldQA.view());await screenshot('844-basement-1');
  for(const [width,height,floor]of [[568,320,-1],[844,390,-41],[1024,768,-50]]){
    await page.setViewportSize({width,height});current=await page.evaluate(([floor,allies])=>__underworldQA.prepareFloor(floor,allies),[floor,true]);assert.ok(current.valid);assert.equal(current.members.length,4);assert.equal(current.size,floor>=-40?19:21);assert.equal(current.rift,false);assert.ok(current.monsters>=7);report.floors.push({...current,raw:undefined,surface:undefined,backup:undefined});
    await page.locator('#towerJournalBtn').tap();assert.match(await page.locator('.adventure-brief').textContent(),/地下|返程|同行/);await layout('journal',width,height);if(width===568)await screenshot('568-basement-journal');await page.locator('#towerDialog .tower-close').tap();
    await page.locator('#towerBagBtn').tap();assert.ok(await page.locator('.supply-card').count());await layout('supplies',width,height);await page.locator('[data-tower="hero-panel"]').tap();assert.equal(await page.locator('.hero-tabs [data-tower="hero-panel"]').count(),5);await layout('five-heroes',width,height);if(width===844)await screenshot('844-five-heroes');await page.locator('#towerDialog .tower-close').tap();
    await page.locator('#towerLightBtn').tap();await page.evaluate(()=>__underworldQA.view());if(width===844)await screenshot('844-basement-41');
  }
  const departure=current.underworld.departed;await page.reload({waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();await page.evaluate(()=>__underworldQA.reopen());await page.locator('#towerDialog .tower-actions [data-tower="continue"]').tap();const resumed=await page.evaluate(()=>__underworldQA.freeze());assert.ok(resumed.valid);assert.deepEqual(resumed.underworld.departed,departure);assert.equal(resumed.members.length,4);assert.equal(resumed.floor,-50);assert.equal(resumed.rift,false);report.resumed={floor:resumed.floor,members:resumed.members.length,departed:departure};
  report.gates=[];
  for(const floor of [-10,-50]){
    await page.setViewportSize({width:844,height:390});let state=await page.evaluate(f=>__underworldQA.prepareFloor(f),floor);assert.ok(state.lord&&state.boss);assert.equal(state.boss.done,false);assert.equal(state.lordDefeated,false);
    await page.evaluate(()=>__underworldQA.exit());assert.match(await page.locator('#towerDialog').textContent(),/門上缺少一枚印記/);await page.locator('#towerDialog .tower-close').tap();await page.evaluate(()=>__underworldQA.clue());
    await page.evaluate(()=>__underworldQA.exit());assert.match(await page.locator('#towerDialog').textContent(),/需要先解除/);assert.equal((await page.evaluate(()=>__underworldQA.state())).floor,floor);assert.equal(await page.locator('[data-tower="exit-confirm"]').count(),0);
    await page.locator('#towerDialog .tower-close').tap();state=await page.evaluate(()=>__underworldQA.solveBoss());assert.ok(state.valid&&state.boss.done);await page.evaluate(()=>__underworldQA.exit());assert.match(await page.locator('#towerDialog').textContent(),/還要擊敗樓層主/);assert.equal(await page.locator('[data-tower="exit-confirm"]').count(),0);
    await page.locator('#towerDialog .tower-close').tap();state=await page.evaluate(()=>__underworldQA.finishLord());assert.ok(state.valid&&state.lordDefeated);await page.evaluate(()=>__underworldQA.exit());assert.ok(await page.locator('[data-tower="exit-confirm"]').isVisible());await page.locator('#towerDialog .tower-actions [data-tower="close"]').tap();state=await page.evaluate(()=>__underworldQA.state());assert.equal(state.floor,floor);assert.equal(state.status,'playing');
    await page.evaluate(()=>__underworldQA.exit());await page.locator('[data-tower="exit-confirm"]').tap();assert.ok(await page.locator('[data-tower="story-next"]').isVisible());await page.locator('[data-tower="story-next"]').tap();await page.locator('[data-tower="story-finish"]').tap();state=await page.evaluate(()=>__underworldQA.state());assert.ok(state.valid);assert.equal(state.floor,floor===-50?-50:-11);assert.equal(state.status,floor===-50?'won':'playing');
    if(floor===-50){assert.match(await page.locator('#towerDialog').textContent(),/地下篇完成/);await layout('basement-ending',844,390);await screenshot('844-basement-ending');assert.deepEqual(JSON.parse(state.surface),JSON.parse(surface.raw));}else await page.locator('[data-tower="descend"]').tap();
    report.gates.push({floor,sealRequired:true,lordRequired:true,canStay:true,result:state.status,nextFloor:state.floor});
  }
  await page.evaluate(()=>__underworldQA.surfaceFinal());await page.evaluate(()=>__underworldQA.solveBoss());await page.evaluate(()=>__underworldQA.finishLord());await page.evaluate(()=>__underworldQA.exit());await page.locator('[data-tower="exit-confirm"]').tap();
  for(let i=0;i<5&&await page.locator('[data-tower="story-next"]').count();i++)await page.locator('[data-tower="story-next"]').tap();
  await page.locator('[data-tower="story-finish"]').tap();await page.locator('[data-tower="ending"][data-item="release"]').tap();
  const cleared=await page.evaluate(()=>__underworldQA.state());assert.ok(cleared.valid);assert.equal(cleared.status,'won');assert.equal(cleared.floor,1);assert.equal(JSON.parse(cleared.surface).status,'won');assert.match(await page.locator('#towerDialog').textContent(),/地上篇完成/);
  await page.locator('[data-tower="home"]').tap();assert.equal(await page.evaluate(()=>TowerMode.active),false);await page.evaluate(()=>__underworldQA.reopen());assert.ok(await page.locator('[data-tower="underworld-intro"]').isVisible());assert.equal((await page.evaluate(()=>__underworldQA.state())).floor,1);await screenshot('844-underground-unlock');
  report.surfaceCompletion={won:true,stopsBeforeUnderground:true,menuUnlock:true,snapshotSaved:true};
  assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;delete report.entry.raw;delete report.entry.surface;delete report.entry.backup;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,floors:report.floors.map(f=>({floor:f.floor,size:f.size,members:f.members.length})),layouts:report.layouts.length,screenshots:report.screenshots,errors}));
}catch(error){report.failure=error.stack;report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
