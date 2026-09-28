// Local-only fixtures drive the real renderer/UI; the test bridge is never deployed.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795',out='.agent-run/lighting-qa';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local QA only.');
const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__lightQA={
 setup(floor=99,job='scout'){run=P.enable(C.newRun({seed:31415,name:'照明測試'}),job).run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);run.coins=100;enter();closeDialog();G.frozen=true;updateCamera(1);},
 state:()=>({run,active,paused,range:lightingUI.radius(),camera:camera.position.toArray(),fog:{near:scene.fog.near,far:scene.fog.far},render:renderer.info.render,lights:(()=>{const a=[];scene.traverse(o=>{if(o.isPointLight)a.push({name:o.name,intensity:o.intensity,shadow:o.castShadow});});return a;})()}),
 move(x,z){G.px=x;G.pz=z;playerGroup.position.set(x,0,z);lightingUI.updateVisual(0,true);updateCamera(1);renderer.render(scene,camera);},
 remote(){const sources=lightingUI.reserved().filter(p=>!p.id?.startsWith('light-supply'));let best=null,score=-1;for(let y=1;y<G.mazeH;y++)for(let x=1;x<G.mazeW;x++){const p=cellToWorld(x,y),d=Math.min(...sources.map(s=>Math.hypot(s.x-p.x,s.z-p.z)));if(d>score){score=d;best=p;}}this.move(best.x,best.z);return score;},
 supplies:()=>lightingUI.reserved().filter(p=>p.id?.startsWith('light-supply')).map(p=>({id:p.id,x:p.x,z:p.z,visible:p.model.visible})),
 gather(){const p=lightingUI.reserved().find(p=>p.id?.startsWith('light-supply')&&p.model.visible);if(!p)return false;this.move(p.x,p.z);lightingUI.tick(0);return p.id;},
 merchant(){const m=traders[0];this.move(m.x,m.z);nearest=m;nearbyEncounter=nearbyJourney=nearestWarrior=null;partyUI.reset();trade();return m.id;},
 migrate(){const old=structuredClone(run);delete old.party.light;active=false;localStorage.setItem(SAVE,JSON.stringify(old));return old;},
 raw:()=>localStorage.getItem(SAVE),save,closeDialog,
 freeze(){G.frozen=true;},
 tick(dt){tick(dt,performance.now());},
 elapse(dt){while(dt>0){const slice=Math.min(60,dt);run=C.tickEffects(run,slice).run;dt-=slice;}lightingUI.tick(0);updateHud();},
 shift(){wasShifting=true;G.shifting=false;G.frozen=false;tick(0,performance.now());G.frozen=true;},
 rebuild(){loadFloor(false);closeDialog();G.frozen=true;},
 dungeon(){let offer=D.offer(run);if(!offer)return false;run=D.discover(run).run;run=D.enter(run,offer.id,{x:0,y:0,shiftLeft:100}).run;loadFloor(false);closeDialog();G.frozen=true;return true;},
 leaveDungeon(){const result=D.finish(run,'abandoned',run.revision);if(!result.ok)throw Error(result.message);run=result.run;loadFloor(false);closeDialog();G.frozen=true;},
 view(v){G.view=v;updateCamera(1);lightingUI.updateVisual(0,true);updateTopMask();renderer.render(scene,camera);},
 failSave(on){if(on){this.setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE||k===SAVE+'_before_lighting')throw Error('QA quota');return __lightQA.setItem.call(this,k,v);};}else Storage.prototype.setItem=this.setItem;},
 stop,rawGroup:()=>world.getObjectByName('tower-lighting')
};`;
const injected=source.replace('  install();\n})();',`  install();\n${bridge}\n})();`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:injected}));
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;__lightQA.setup();});
  await mkdir(out,{recursive:true});
  const state=()=>page.evaluate(()=>__lightQA.state()),freeze=()=>page.evaluate(()=>__lightQA.freeze());
  const click=async selector=>{await page.locator(selector).click();await freeze();};
  await click('#towerLightBtn');assert.equal(await page.locator('#towerDialogTitle').textContent(),'帶著光繼續前進');
  assert.equal(await page.locator('[data-tower="light-daylight"]').isDisabled(),true);
  await page.screenshot({path:out+'/lighting-panel-mobile.png'});
  await click('[data-tower="light-craft"]');assert.equal((await state()).run.party.light.torches,3);
  await page.evaluate(()=>__lightQA.failSave(true));await click('[data-tower="light-craft"]');assert.equal((await state()).run.party.light.torches,3);await page.evaluate(()=>__lightQA.failSave(false));
  await click('[data-tower="light-torch"]');assert.equal((await state()).run.party.light.lit,true);
  assert.ok((await state()).run.party.light.fuel>299);assert.equal(await page.locator('#towerOverlay').isVisible(),false);
  await click('#towerLightBtn');const pausedFuel=(await state()).run.party.light.fuel;await page.evaluate(()=>__lightQA.tick(60));assert.equal((await state()).run.party.light.fuel,pausedFuel);
  await click('[data-tower="light-torch"]');const fuel=(await state()).run.party.light.fuel;await page.evaluate(()=>__lightQA.elapse(30));assert.equal((await state()).run.party.light.fuel,fuel);
  const supplier=await page.evaluate(()=>__lightQA.gather());assert.ok(supplier);assert.deepEqual((await state()).run.party.light.gathered,[supplier]);
  await page.evaluate(()=>__lightQA.shift());assert.deepEqual((await state()).run.party.light.gathered,[supplier]);
  await page.evaluate(()=>__lightQA.rebuild());assert.equal((await page.evaluate(()=>__lightQA.supplies()))[0].visible,false);
  const merchant=await page.evaluate(()=>__lightQA.merchant()),coins=(await state()).run.coins;
  await click('[data-tower="light-buy"]');assert.equal((await state()).run.coins,coins-4);assert.equal((await state()).run.party.light.bought[merchant],1);
  // Reject stale/out-of-range shop interaction, even when the old panel is still visible.
  await page.evaluate(()=>__lightQA.remote());const snapshot=(await state()).run.party.light;
  await click('[data-tower="light-buy"]');assert.deepEqual((await state()).run.party.light,snapshot);
  await page.evaluate(()=>{__lightQA.closeDialog();__lightQA.freeze();__lightQA.save();});const stored=(await state()).run.party.light;
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;TowerMode.open(true);});await click('[data-tower="continue"]');await page.evaluate(()=>{__lightQA.closeDialog();__lightQA.freeze();});
  assert.deepEqual((await state()).run.party.light,stored);
  const old=await page.evaluate(()=>__lightQA.migrate());
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;TowerMode.open(true);});await click('[data-tower="continue"]');await page.evaluate(()=>{__lightQA.closeDialog();__lightQA.freeze();});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('maze3d_tower_v1_before_lighting'))),old);
  assert.equal((await state()).run.party.light.torches,2);
  await page.evaluate(()=>__lightQA.setup(69,'mage'));await click('#towerLightBtn');await click('[data-tower="light-daylight"]');
  assert.ok((await state()).run.party.light.daylight>599);assert.equal((await state()).run.party.cooldown,0);
  await page.evaluate(()=>__lightQA.elapse(599));assert.ok((await state()).run.party.light.daylight>0);await page.evaluate(()=>__lightQA.elapse(2));assert.equal((await state()).run.party.light.daylight,0);
  for(const floor of [99,89,79,69,59,49,39,29,19,9]){
    await page.evaluate(f=>__lightQA.setup(f,'mage'),floor);const camp=(await state()).range;assert.ok(camp>=11);
    await page.screenshot({path:out+'/region-'+floor+'-camp.png'});
    await page.evaluate(()=>__lightQA.remote());await page.screenshot({path:out+'/region-'+floor+'-unlit.png'});const unlit=await state();
    await click('#towerLightBtn');await click('[data-tower="light-torch"]');await page.screenshot({path:out+'/region-'+floor+'-torch.png'});const torch=await state();
    await click('#towerLightBtn');await click('[data-tower="light-daylight"]');await page.screenshot({path:out+'/region-'+floor+'-daylight.png'});const sun=await state();
    assert.ok(sun.camera.every(Number.isFinite));assert.ok(sun.range>torch.range&&torch.range>=unlit.range);assert.equal(sun.lights.filter(l=>l.name.startsWith('tower-light-slot')).length,3);assert.ok(sun.lights.every(l=>!l.shadow));
    results.push({floor,camp,unlit:unlit.range,torch:torch.range,daylight:sun.range,pointLights:sun.lights,drawCalls:sun.render.calls,triangles:sun.render.triangles});
  }
  for(const view of ['fp','tp','top']){await page.evaluate(v=>__lightQA.view(v),view);await page.screenshot({path:out+'/view-'+view+'.png'});}
  for(const viewport of [{width:667,height:375},{width:844,height:390},{width:1280,height:800}]){
    await page.setViewportSize(viewport);await page.locator('#towerHudToggle').tap();await page.locator('#towerHudToggle').tap();const bounds=await page.locator('#towerHud').boundingBox();assert.ok(bounds.width<=290&&bounds.height<=52&&bounds.x>=0&&bounds.x+bounds.width<viewport.width,JSON.stringify(bounds));
  }
  for(let f=99;f>1;f--){await page.evaluate(f=>__lightQA.setup(f,'mage'),f);const found=await page.evaluate(()=>__lightQA.dungeon());if(found)break;if(f===2)assert.fail('no dungeon fixture');}
  await click('#towerLightBtn');await click('[data-tower="light-daylight"]');await page.evaluate(()=>__lightQA.elapse(20));const remaining=(await state()).run.party.light.daylight;
  assert.ok(remaining>579);assert.equal((await page.evaluate(()=>__lightQA.supplies())).length,0);await page.evaluate(()=>__lightQA.leaveDungeon());assert.equal((await state()).run.party.light.daylight,remaining);
  await page.evaluate(()=>{__lightQA.stop();G.spMode='classic';startGame();});assert.equal(await page.locator('#towerHud').isVisible(),false);
  assert.equal(await page.evaluate(()=>TowerMode.lightRadius()??null),null);
  assert.deepEqual(errors,[]);const result={ok:true,torchSeconds:300,daylightSeconds:600,pause:true,craft:true,saveRollback:true,merchantProximity:true,claimedAfterShift:true,saveMigrationBackup:true,dungeon:true,classicUnchanged:true,regions:results,errors};
  await writeFile(out+'/readback.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
