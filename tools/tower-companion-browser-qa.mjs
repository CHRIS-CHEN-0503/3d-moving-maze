// Isolated, localhost-only regression for companions surviving real stair transitions.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795',out='.agent-run/party-qa';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local QA only.');
const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__followQA={
  setup(seed){run=P.enable(C.newRun({seed,name:'同伴測試'}),'chef').run;run=P.recruit(run,P.recruitOffer(run).id).run;enter();closeDialog();},
  roster(jobs){run=P.enable(C.newRun({seed:214,name:'同伴測試'}),'chef').run;run.party.members=jobs.map((profession,i)=>({id:'companion:test:'+profession,profession,level:i+1,hp:28+(i+1)*6,cooldown:0,hurtLeft:0}));run.party.joined=run.party.members.map(m=>m.id);enter();closeDialog();},
  state:()=>({run,world,partyUI}),closeDialog,save,
  models(){const result=[];world.traverse(o=>{if(o.userData.partyHp&&!o.userData.monsterId)result.push(o);});return result;},
  inspect(){return this.models().map(o=>({name:o.name,x:o.position.x,z:o.position.z,inWall:playerInWall(o.position.x,o.position.z,.28),distance:Math.hypot(o.position.x-G.px,o.position.z-G.pz),visible:o.visible}));},
  stairs(){closeDialog();const p=cellToWorld(G.exitCell.x,G.exitCell.y);G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);reachExit(true);},
  follow(fps=60){const p=solveMaze(0,0)[Math.min(3,solveMaze(0,0).length-1)],target=cellToWorld(...p);G.px=target.x;G.pz=target.z;playerGroup.position.set(G.px,0,G.pz);let wallHits=0;for(let i=0;i<fps*15;i++){partyUI.tick(1/fps,i*1000/fps);for(const o of this.models())if(playerInWall(o.position.x,o.position.z,.28))wallHits++;}return {wallHits,models:this.inspect()};},
};`;
const injected=source.replace('  install();\n})();',`  install();\n${bridge}\n})();`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[],results=[];
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
      const followed=await page.evaluate(fps=>__followQA.follow(fps),{98:30,97:60,96:120}[floor]);assert.equal(followed.wallHits,0);assert.ok(followed.models.every(m=>m.distance<=1.8),JSON.stringify({seed,floor,reason:'not following',followed}));
    }
  }
  for(const jobs of [['swordsman','mage','scout'],['chef','healer','smith']]){
    await page.evaluate(j=>__followQA.roster(j),jobs);const before=await page.evaluate(()=>__followQA.state().run.party.members);
    await page.evaluate(()=>__followQA.stairs());await page.locator('[data-tower="descend"]').click();await page.evaluate(()=>__followQA.closeDialog());
    assert.deepEqual(await page.evaluate(()=>__followQA.state().run.party.members),before);
    const models=await page.evaluate(()=>__followQA.inspect());assert.equal(models.length,3);assert.ok(models.every(m=>!m.inWall&&m.distance<=2));
    const followed=await page.evaluate(()=>__followQA.follow());assert.equal(followed.wallHits,0);assert.ok(followed.models.every(m=>m.distance<=1.8));
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
  assert.deepEqual(errors,[]);const result={ok:true,transitions:results,allProfessions:6,rosterLimit:3,hud:{compact,expanded,reload:true},errors};await writeFile(out+'/companions-readback.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
