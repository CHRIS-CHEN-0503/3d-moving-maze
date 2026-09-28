// Isolated, localhost-only regression for companions surviving real stair transitions.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795',out='.agent-run/queue-qa';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local QA only.');
const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__followQA={
  setup(seed){run=P.enable(C.newRun({seed,name:'同伴測試'}),'chef').run;run=P.recruit(run,P.recruitOffer(run).id).run;enter();closeDialog();},
  roster(jobs,seed=214,floor=99){run=P.enable(C.newRun({seed,name:'同伴測試'}),'chef').run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);run.party.members=jobs.map((profession,i)=>({id:'companion:test:'+profession,profession,level:i+1,hp:28+(i+1)*6,cooldown:0,hurtLeft:0}));run.party.joined=run.party.members.map(m=>m.id);enter();closeDialog();G.frozen=true;},
  state:()=>({run,world,partyUI}),closeDialog,save,
  models(){const result=[];world.traverse(o=>{if(o.userData.partyHp&&!o.userData.monsterId)result.push(o);});return result;},
  inspect(){const player={x:G.px,z:G.pz};let leader=player;return this.models().sort((a,b)=>followerDistance(a.position,player)-followerDistance(b.position,player)).map(o=>{const p=o.position,gap=Math.hypot(p.x-leader.x,p.z-leader.z),clear=followerClear(p,leader);leader=p;return {name:o.name,x:p.x,z:p.z,inWall:playerInWall(p.x,p.z,.28),distance:Math.hypot(p.x-G.px,p.z-G.pz),gap,clear,visible:o.visible};});},
  journey(fps=60,reverse=false){
    G.frozen=true;for(const m of monsters){m.alive=false;m.model.visible=false;}run.party.light.daylight=600;run.party.light.cooldown=600;
    const from=worldToCell(G.px,G.pz),path=solveMaze(from.x,from.y).slice(0,18);let frames=0,wallHits=0,minGap=Infinity;
    const step=()=>{partyUI.tick(1/fps,frames++*1000/fps);const models=this.models();for(const m of models){if(playerInWall(m.position.x,m.position.z,.28))wallHits++;for(const n of models)if(m!==n)minGap=Math.min(minGap,m.position.distanceTo(n.position));}};
    const walk=points=>{for(const [cx,cy]of points){const p=cellToWorld(cx,cy);while(Math.hypot(G.px-p.x,G.pz-p.z)>.001){const dx=p.x-G.px,dz=p.z-G.pz,d=Math.hypot(dx,dz),s=Math.min(d,5.2/fps);G.px+=dx/d*s;G.pz+=dz/d*s;G.heading=Math.atan2(dx,dz);playerGroup.position.set(G.px,0,G.pz);playerGroup.rotation.y=G.heading;step();}}};
    walk(path.slice(1));if(reverse)walk(path.slice().reverse().slice(1));for(let i=0;i<fps*10;i++)step();
    G.camPitch=.55;updateCamera(1);lightingUI.updateVisual(0,true);renderer.render(scene,camera);return {fps,frames,wallHits,minGap,cells:path.length,models:this.inspect()};
  },
  shifted(){const p=cellToWorld(0,0);G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);for(const m of this.models())m.position.set(p.x,0,p.z);setSeed(run.seed^run.floor^1024);genMaze(0,0);setSeed(null);buildWalls(LEVELS[G.lvlIdx]);partyUI.shift();return this.inspect();},
  stairs(){closeDialog();const p=cellToWorld(G.exitCell.x,G.exitCell.y);G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);reachExit(true);},
  follow(fps=60){const p=solveMaze(0,0)[Math.min(3,solveMaze(0,0).length-1)],target=cellToWorld(...p);G.px=target.x;G.pz=target.z;playerGroup.position.set(G.px,0,G.pz);let wallHits=0;for(let i=0;i<fps*15;i++){partyUI.tick(1/fps,i*1000/fps);for(const o of this.models())if(playerInWall(o.position.x,o.position.z,.28))wallHits++;}return {wallHits,models:this.inspect()};},
};`;
const injected=source.replace('  install();\n})();',`  install();\n${bridge}\n})();`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[],results=[],queues=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:injected}));
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  for(const seed of [7,31,214,31415]){
    await page.evaluate(s=>__followQA.setup(s),seed);
    for(const floor of [98,97,96]){
      await page.evaluate(()=>__followQA.stairs());await page.locator('[data-tower="descend"]').click();await page.evaluate(()=>__followQA.closeDialog());
      const state=await page.evaluate(()=>({floor:__followQA.state().run.floor,members:__followQA.state().run.party.members.map(m=>({id:m.id,hp:m.hp})),models:__followQA.inspect()}));
      results.push({seed,...state});assert.equal(state.floor,floor);assert.equal(state.members.length,1);assert.equal(state.models.length,1);
      assert.ok(state.models.every(m=>!m.inWall),JSON.stringify({seed,floor,reason:'companion spawned in wall',models:state.models}));
      assert.ok(state.models.every(m=>m.distance<=2));
      const followed=await page.evaluate(fps=>__followQA.follow(fps),{98:30,97:60,96:120}[floor]);assert.equal(followed.wallHits,0);assert.ok(followed.models.every(m=>m.gap<=1.81&&m.clear),JSON.stringify({seed,floor,reason:'not following',followed}));
    }
  }
  for(const jobs of [['swordsman','mage','scout'],['chef','healer','smith']]){
    await page.evaluate(j=>__followQA.roster(j),jobs);const before=await page.evaluate(()=>__followQA.state().run.party.members);
    await page.evaluate(()=>__followQA.stairs());await page.locator('[data-tower="descend"]').click();await page.evaluate(()=>__followQA.closeDialog());
    assert.deepEqual(await page.evaluate(()=>__followQA.state().run.party.members),before);
    const models=await page.evaluate(()=>__followQA.inspect());assert.equal(models.length,3);assert.ok(models.every(m=>!m.inWall&&m.distance<=2));
    const followed=await page.evaluate(()=>__followQA.follow());assert.equal(followed.wallHits,0);assert.ok(followed.models.every(m=>m.gap<=1.81&&m.gap>=1.14&&m.clear),JSON.stringify(followed));
  }
  await mkdir(out,{recursive:true});
  for(const [seed,floor,fps,reverse]of [[7,99,30,false],[31,79,60,true],[214,39,120,false],[31415,9,60,true]]){
    await page.evaluate(({seed,floor})=>__followQA.roster(['mage','scout','healer'],seed,floor),{seed,floor});
    const q=await page.evaluate(({fps,reverse})=>__followQA.journey(fps,reverse),{fps,reverse});queues.push({seed,floor,...q});
    assert.equal(q.wallHits,0,JSON.stringify(q));assert.ok(q.minGap>=1.148,JSON.stringify(q));assert.ok(q.models.every(m=>m.gap<=1.81&&m.gap>=1.14&&m.clear),JSON.stringify(q));
    await page.screenshot({path:out+'/queue-'+floor+'.png'});
    if(floor===99){await page.evaluate(()=>{G.view='top';G.topZoom=16;updateCamera(1);renderer.render(scene,camera);});await page.screenshot({path:out+'/queue-overhead.png'});await page.evaluate(()=>{G.view='tp';updateCamera(1);});}
    const shifted=await page.evaluate(()=>__followQA.shifted());assert.ok(shifted.every(m=>!m.inWall));
    for(let i=0;i<shifted.length;i++)for(let j=i+1;j<shifted.length;j++)assert.ok(Math.hypot(shifted[i].x-shifted[j].x,shifted[i].z-shifted[j].z)>=1.15);
    const after=await page.evaluate(()=>__followQA.journey());assert.equal(after.wallHits,0);assert.ok(after.minGap>=1.148);assert.ok(after.models.every(m=>m.gap<=1.81&&m.clear),JSON.stringify(after));
  }
  // Small default HUD; both expanded and collapsed state survive a real reload.
  await mkdir(out,{recursive:true});const details=page.locator('#towerHudDetails'),toggle=page.locator('#towerHudToggle');
  assert.equal(await details.isVisible(),false);assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  const compact=await page.locator('#towerHud').boundingBox();assert.ok(compact.height<=50&&compact.width<=290,JSON.stringify(compact));
  await page.screenshot({path:out+'/hud-collapsed-mobile.png'});await toggle.click();assert.equal(await details.isVisible(),true);assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  const expanded=await page.locator('#towerHud').boundingBox();assert.ok(expanded.height<180&&expanded.width<=340,JSON.stringify(expanded));
  await page.screenshot({path:out+'/hud-expanded-mobile.png'});
  await page.evaluate(()=>__followQA.save());const saved=await page.evaluate(()=>__followQA.state().run.party.members);
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;TowerMode.open(true);});await page.locator('[data-tower="continue"]').click();await page.evaluate(()=>__followQA.closeDialog());
  assert.equal(await details.isVisible(),true);assert.deepEqual(await page.evaluate(()=>__followQA.state().run.party.members),saved);assert.ok((await page.evaluate(()=>__followQA.inspect())).every(m=>!m.inWall&&m.distance<=2));
  await toggle.focus();await page.keyboard.press('Enter');assert.equal(await details.isVisible(),false);
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;TowerMode.open(true);});await page.locator('[data-tower="continue"]').click();await page.evaluate(()=>__followQA.closeDialog());assert.equal(await details.isVisible(),false);
  for(const viewport of [{width:667,height:375},{width:844,height:390},{width:1280,height:800}]){
    await page.setViewportSize(viewport);await toggle.tap();assert.equal(await details.isVisible(),true);await toggle.tap();assert.equal(await details.isVisible(),false);
    const bounds=await page.locator('#towerHud').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<viewport.width&&bounds.height<=52);
  }
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:out+'/companions-after-stairs.png'});
  assert.deepEqual(errors,[]);const result={ok:true,transitions:results,queues,allProfessions:6,rosterLimit:3,hud:{compact,expanded,reload:true},errors};await writeFile(out+'/companions-readback.json',JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,transitions:results.length,queues:queues.map(q=>({seed:q.seed,floor:q.floor,fps:q.fps,wallHits:q.wallHits,minGap:q.minGap})),allProfessions:6,hud:result.hud,errors},null,2));
}finally{await browser.close();}
