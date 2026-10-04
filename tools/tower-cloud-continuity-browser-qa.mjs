// Finite local-only cloud chapter acceptance. No source replacement/private bridge.
// Public factory observation records the actual scene created by natural UI actions.
// Floor 94/90 are clearly labelled disposable save fixtures, not walked playthroughs.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8798/',out=process.env.MAZE_QA_OUT||'.agent-run/cloud-continuity-qa';
const origin=new URL(base).origin;
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local server only');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
await mkdir(out,{recursive:true});
const report={version,base,localOnly:true,views:[],layouts:[],loaded:[],errors:[],blocked:[],sockets:[],limitations:['Desktop Chrome touch simulation, not a physical iPhone performance measurement.','Natural new-game / Continue / journal UI. Floor 94 and 90 use explicit disposable save fixtures built by actually loaded public rule modules.','Read-only public factory observation only; no module source substitution or private closure bridge. Audio disabled deliberately, so no audible voice quality claim.']};
const work=[],contexts=new Set(),browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});let page;
async function open(width,height){
  const c=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});contexts.add(c);const p=await c.newPage();page=p;p.setDefaultTimeout(60000);
  p.on('pageerror',e=>report.errors.push(e.stack));
  p.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&(u.pathname==='/'||/\.(?:js|css)$/.test(u.pathname)))work.push((async()=>{report.loaded.push({url:r.url(),status:r.status(),sha256:createHash('sha256').update(await r.body()).digest('hex')});})().catch(e=>report.errors.push(e.message)));});
  await c.route('**/*',r=>{const q=r.request();if(!['GET','HEAD'].includes(q.method())||new URL(q.url()).origin!==origin){report.blocked.push({url:q.url(),method:q.method()});return r.abort();}return r.continue();});
  await p.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));await p.route('**/api/scores*',r=>r.fulfill({json:[]}));
  await p.addInitScript(()=>{window.__cloudSocketAttempts=[];window.WebSocket=class{constructor(url){window.__cloudSocketAttempts.push(url);throw Error('No real room in cloud QA');}};});
  await p.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>typeof TowerStoryTheater==='object'&&typeof TowerMode==='object'&&typeof TowerHeroes==='object',null,{timeout:60000});
  assert.equal(await p.evaluate(()=>GAME_VERSION),version);
  await p.evaluate(()=>{
    GameVoice.configure({enabled:false});G.muted=true;
    const api=TowerStoryTheater;
    const resources=model=>{const rows=[];model?.traverse(n=>{if(n.geometry||n.material)rows.push({id:n.uuid,g:n.geometry?.uuid,m:(Array.isArray(n.material)?n.material:[n.material]).filter(Boolean).map(m=>({id:m.uuid,textures:Object.values(m).filter(t=>t?.isTexture).map(t=>t.uuid)}))});});return rows;};
    const pose=model=>{const rows=[];model?.traverse(n=>rows.push({id:n.uuid,p:n.position.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray(),visible:n.visible}));return rows;};
    const state=()=>({save:localStorage.getItem('maze3d_tower_v1'),satiety:G.satiety,position:[G.px,G.pz],heading:G.heading,shifting:G.shifting,running:G.running});
    window.__cloudObserve={stage:null,spec:null,history:[],released:[],resources,pose,state};
    window.TowerStoryTheater={...api,create(options){
      const source=options.hero,before={resources:resources(source),pose:pose(source),memory:{...renderer.info.memory}},stage=api.create(options);if(!stage)return stage;
      const record={floor:options.floor,environment:options.environment,before};__cloudObserve.stage=stage;__cloudObserve.record=record;__cloudObserve.history.push(record);
      return Object.freeze({scene:stage.scene,frame:stage.frame,get hero(){return stage.hero;},get active(){return stage.active;},page(spec){const result=stage.page(spec);__cloudObserve.spec=result;record.entryId=spec.entry?.id;record.page=spec.page;return result;},dispose(){const result=stage.dispose();__cloudObserve.released.push({entryId:record.entryId,before,after:{resources:resources(source),pose:pose(source),memory:{...renderer.info.memory}},active:stage.active});return result;}});
    }};
  });
  await p.locator('#enterMenuBtn').tap();return {c,p};
}
async function close(c,p){report.sockets.push(...await p.evaluate(()=>__cloudSocketAttempts));await Promise.allSettled(work);await c.close();contexts.delete(c);}
async function snap(p,label){
  const s=await p.evaluate(()=>{
    const o=__cloudObserve,scene=o.stage?.scene,spec=o.spec;if(!scene||!spec)throw Error('No actual story stage');
    const geometries=new Set(),textures=new Set(),materials=new Set(),surfaces=new Set(),colors=new Set(),nodes=[];let drawables=0,triangles=0,lights=0;
    scene.traverse(n=>{if(n.isLight)lights++;if(n.geometry){geometries.add(n.geometry.uuid);if(n.isMesh){drawables++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position?.count||0)/3;}}for(const m of Array.isArray(n.material)?n.material:[n.material])if(m){materials.add(m.uuid);if(m.color)colors.add(m.color.getHexString());if(m.userData.storySurface)surfaces.add(m.userData.storySurface);for(const t of Object.values(m))if(t?.isTexture)textures.add(t.uuid);}if(/cloud|banner|summon|mote|mist/.test(n.name))nodes.push({name:n.name,p:n.position.toArray(),q:n.quaternion.toArray()});});
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
    const caption=box(document.querySelector('.cinema-caption')),faces=[];scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    for(const actor of scene.children.filter(n=>n.visible&&n.userData.storyTheaterActor)){const h=actor.userData.headMesh||actor.userData.head;if(!h)continue;const v=h.getWorldPosition(new THREE.Vector3()).project(camera);faces.push({identity:actor.userData.storyIdentity||'hero',x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,depth:v.z});}
    return {entryId:spec.entry?.id,page:spec.page,title:spec.title,environment:scene.userData.environment,artDirection:scene.userData.storyArtDirection,background:scene.background?.getHexString?.(),polished:document.querySelector('#towerCinema').dataset.polished,shot:document.querySelector('#towerCinema').dataset.shot,shotIndex:Number(document.querySelector('#towerCinema').dataset.shotIndex),cuts:spec.shot?.cuts?.map(c=>({id:c.id,at:c.at,subjects:c.subjects}))||[],camera:{p:camera.position.toArray(),q:camera.quaternion.toArray(),fov:camera.fov},faces,nodes,budget:scene.userData.storySceneryBudget,surfaces:[...surfaces].sort(),colors:[...colors].sort(),memory:{...renderer.info.memory},resources:{geometries:geometries.size,textures:textures.size,materials:materials.size,drawables,triangles,lights},layout:{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,caption,buttons:[...document.querySelectorAll('#towerCinema button')].filter(b=>!b.hidden&&getComputedStyle(b).display!=='none').map(box)},game:o.state(),paused:TowerMode.paused,active:TowerMode.cinematicActive};
  });
  assert.equal(s.polished,'true',label+' must not use the legacy gray platform');assert.ok(s.surfaces.includes('stone')&&s.surfaces.includes('floor'),label+' has authored scene surfaces');
  assert.equal(s.environment,'cloud',label+' actual environment identity');assert.equal(s.artDirection,'cloud-summit',label+' shared summit art direction');
  assert.ok(s.background&&s.background!=='243449',label+' must keep the pale daytime sky');
  assert.ok(s.cuts.length>=3,label+' has multiple authored shots');assert.ok(s.active&&s.paused);
  assert.ok(s.layout.scroll<=s.layout.width);for(const box of [s.layout.caption,...s.layout.buttons])assert.ok(box.left>=-.5&&box.right<=s.layout.width+.5&&box.top>=-.5&&box.bottom<=s.layout.height+.5,label+' controls/caption on screen');
  for(const b of s.layout.buttons)assert.ok(b.height>=44,label+' touch targets');
  const visibleSubjects=await p.locator('#towerCinema').getAttribute('data-shot-subjects');for(const face of s.faces.filter(f=>!visibleSubjects||visibleSubjects.split(',').includes(f.identity)))assert.ok(face.depth>-1&&face.depth<1&&face.x>0&&face.x<s.layout.width&&face.y>0&&face.y<s.layout.caption.top-3,label+' featured face above subtitles');
  await p.screenshot({path:out+'/'+label+'.png'});report.layouts.push({label,...s.layout});return s;
}
async function waitStage(p,id){await p.waitForFunction(id=>TowerMode.cinematicActive&&window.__cloudObserve?.spec?.entry?.id===id&&document.querySelector('#towerCinema').dataset.shotIndex!=='-1',id,{timeout:30000});}
async function readJournalScene(p,id){
  // Notes may link to the same scene. Select the public chronological journal
  // entry by its heading, then its labelled Read button, never an arbitrary nth.
  const titles={'scene:95':'銅扣裡的回答','scene:90':'只向下開的門'},title=titles[id];assert.ok(title,'known journal scene '+id);
  const entry=p.locator('#towerDialog article.tower-journal-entry').filter({has:p.getByRole('heading',{name:title,exact:true})});await entry.waitFor({state:'visible'});assert.equal(await entry.count(),1,'one chronological journal entry '+id);
  const button=entry.getByRole('button',{name:'閱讀',exact:true});assert.equal(await button.count(),1,'one public Read button '+id);assert.equal(await button.getAttribute('data-tower'),'story-read');assert.equal(await button.getAttribute('data-item'),id);await button.tap();
}
async function naturalNew(p){await p.locator('#storyEntryBtn').tap();await p.locator('[data-tower="new"]').tap();await p.locator('#heroNameInput').fill('雲頂連續性確認');await p.locator('[data-tower="profession"][data-item="swordsman"]').tap();await p.locator('[data-tower="hero-create-start"]').tap();await waitStage(p,'scene:99');}
async function fixture(p,floor){
  const valid=await p.evaluate(floor=>{
    const r=TowerHeroes.enable(TowerPartyCore.enable(TowerCore.newRun({seed:31,name:'本機續章測試'}),'swordsman','male').run).run;
    r.floor=floor;r.floorsCleared=99-floor;r.chronicle=TowerNarrative.newChronicle(floor);r.chronicle.clues.push('clue:summoning');r.chronicle.read=TowerNarrative.unlockedScenes(floor).map(s=>s.id);r.adventure=TowerEncounters.newAdventure();r.expedition=TowerDungeons.newExpedition();TowerPartyCore.advance(r,{reward:false});
    const checked=TowerCore.validateSave(r);if(!checked)return false;localStorage.setItem('maze3d_tower_v1',JSON.stringify(checked));return true;
  },floor);assert.ok(valid,'valid disposable floor fixture');await p.locator('#storyEntryBtn').tap();await p.locator('[data-tower="continue"]').tap();await waitStage(p,'floor-brief:'+floor);
}
async function release(p,action='later'){
  await p.locator('[data-cinema="'+action+'"]').tap();await p.waitForFunction(()=>!TowerMode.cinematicActive);const r=await p.evaluate(()=>__cloudObserve.released.at(-1));assert.ok(r&&!r.active,'actual stage disposed');assert.deepEqual(r.after.resources,r.before.resources,'borrowed gameplay materials and textures restored');assert.deepEqual(r.after.pose,r.before.pose,'borrowed gameplay pose and visibility restored');return r;
}
try{
  for(const [width,height]of [[1440,900],[844,390],[568,320]]){
    report.currentCase={width,height,stage:'natural-99'};let {c,p}=await open(width,height);await naturalNew(p);const arrival=await snap(p,width+'-99-arrival');
    await p.locator('[data-cinema="next"]').tap();await p.waitForFunction(()=>__cloudObserve.spec.page===1);await p.locator('[data-cinema="previous"]').tap();await p.waitForFunction(()=>__cloudObserve.spec.page===0);const arrivalRelease=await release(p,'skip');assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('maze3d_tower_v1')).chronicle.read.includes('scene:99')));await close(c,p);
    ({c,p}=await open(width,height));report.currentCase.stage='actual-94-continue-fixture';await fixture(p,94);const establish=await snap(p,width+'-94-establish');
    assert.equal(establish.background,arrival.background,'same chapter keeps opening sky');assert.deepEqual(establish.surfaces,arrival.surfaces,'same chapter keeps opening surfaces');
    assert.match(await p.locator('.cinema-caption p').textContent(),/已取得回聲銅扣.*90/);
    const samples=[establish];
    for(const index of [1,Math.min(3,establish.cuts.length-1)]){await p.waitForFunction(index=>Number(document.querySelector('#towerCinema').dataset.shotIndex)>=index,index,{timeout:25000});samples.push(await snap(p,width+'-94-shot-'+index));}
    for(const sample of samples.slice(1)){assert.deepEqual(sample.game,establish.game,'cinematic holds gameplay and saved progress');assert.deepEqual(sample.resources,establish.resources,'no per-frame geometry or material allocation');assert.notDeepEqual(sample.camera,establish.camera,'authored camera angle changes');assert.equal(sample.entryId,establish.entryId);assert.equal(sample.page,0,'audio-off reading never auto-advances');}
    if(width===844){
      await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);assert.ok(await p.locator('#landscapeGate').isVisible());assert.ok(await p.evaluate(()=>document.elementFromPoint(100,100)?.closest('#landscapeGate')));const a=await p.evaluate(()=>({p:camera.position.toArray(),q:camera.quaternion.toArray()}));await p.waitForTimeout(450);assert.deepEqual(await p.evaluate(()=>({p:camera.position.toArray(),q:camera.quaternion.toArray()})),a);await p.screenshot({path:out+'/390-portrait-gate.png'});await p.setViewportSize({width,height});await p.locator('[data-cinema="resume"]').tap();await waitStage(p,'floor-brief:94');report.portraitSuspends=true;
    }
    const released=await release(p,'next');await p.locator('#towerJournalBtn').tap();await readJournalScene(p,'scene:95');await waitStage(p,'scene:95');const middle=await snap(p,width+'-95-journal');assert.equal(middle.background,arrival.background);
    await p.locator('[data-cinema="next"]').tap();await p.waitForFunction(()=>__cloudObserve.spec.page===1);await snap(p,width+'-95-eve');await p.locator('[data-cinema="previous"]').tap();await p.waitForFunction(()=>__cloudObserve.spec.page===0);const firstRelease=await release(p,'later');assert.ok(await p.locator('#towerDialog').isVisible());
    await readJournalScene(p,'scene:95');await waitStage(p,'scene:95');await p.locator('[data-cinema="next"]').tap();await p.waitForFunction(()=>__cloudObserve.spec.page===1);const secondRelease=await release(p,'later');assert.deepEqual(secondRelease.after.memory,firstRelease.after.memory,'repeated same journal stage does not accumulate GPU resources');
    report.views.push({width,height,arrival,arrivalRelease,establish,samples,middle,released,repeatedRelease:{first:firstRelease.after.memory,second:secondRelease.after.memory},naturalNewGame:true,naturalContinueWithExplicitFloor94Fixture:true,previousNext:true,skip:true,laterReturnsJournal:true,audioOffManualReading:true});await close(c,p);console.log('cloud continuity passed',width,height);
  }
  {
    report.currentCase={width:844,height:390,stage:'90-ending-journal'};const {c,p}=await open(844,390);await fixture(p,90);await release(p,'later');await p.locator('#towerJournalBtn').tap();await readJournalScene(p,'scene:90');await waitStage(p,'scene:90');const ending=[];
    for(let index=0;index<3;index++){if(index){await p.locator('[data-cinema="next"]').tap();await p.waitForFunction(i=>__cloudObserve.spec.page===i,index);}ending.push(await snap(p,'844-90-ending-page-'+index));}
    await release(p,'skip');report.ending={pages:ending,returnJournal:await p.locator('#towerDialog').isVisible()};await close(c,p);
  }
  await Promise.all(work);report.sourceHashes=[];
  for(const path of ['/','/story/tower-story-direction.js','/story/tower-story-theater.js','/story/tower-cinematics.js','/story/tower-cinematics.css','/story/tower-cinematic-actors.js','/story/tower-cinematic-look.js','/story/tower-mode.js','/story/tower-heroes-visuals.js','/story/tower-narrative.js']){
    const loaded=report.loaded.filter(r=>decodeURIComponent(new URL(r.url).pathname)===path&&r.status===200).at(-1);assert.ok(loaded,'actually loaded source '+path);const hash=createHash('sha256').update(await readFile(new URL(path==='/'?'../index.html':'..'+path,import.meta.url))).digest('hex');assert.equal(loaded.sha256,hash,'no source changed after browser loaded '+path);report.sourceHashes.push({path,sha256:hash,url:loaded.url});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.sockets,[]);report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await Promise.allSettled(work);await Promise.allSettled([...contexts].map(c=>c.close()));await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:!!report.pass,views:report.views.length,errors:report.errors,failure:report.failure,report:out+'/report.json',contextsClosed:true}));}
