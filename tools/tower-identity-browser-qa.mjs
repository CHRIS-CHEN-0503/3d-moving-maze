// Disposable profile only. Production uses the unmodified website; fault
// injection and the private test bridge are strictly limited to localhost.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795',production=base==='https://3d-moving-maze.pages.dev';
assert.ok(production||base==='http://127.0.0.1:8795');
const out='.agent-run/identity-qa',prefix=production?'production':'local',assets=[];
if(process.env.MAZE_RELEASE_ROOT){
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const file of ['index.html','story/tower-party-runtime.js','story/tower-party-core.js','story/tower-mode.js']){
    const response=await fetch(base+'/'+file,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),sha256=hash(bytes);assert.equal(sha256,hash(await readFile(process.env.MAZE_RELEASE_ROOT+'/'+file)),file);assets.push({file,sha256});
  }
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1180,height:680},hasTouch:true}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));await mkdir(out,{recursive:true});
  if(!production){
    // Reproduce an old candidate generator even with the current HTML version.
    const core=await readFile(new URL('../story/tower-party-core.js',import.meta.url),'utf8');
    const guard='    if(run.party?.joined.includes(id)||run.party?.members.some(m=>m.profession===job))return null;';assert.ok(core.includes(guard));
    await page.route('**/story/tower-party-core.js*',route=>route.fulfill({contentType:'application/javascript',body:core.replace(guard,'')}));
    const mode=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
    const bridge=`window.__identityQA={
      rebuild(){partyUI.build(()=>.5,new Set(['0,0']));},
      staleRecruit(){
        const model=V.buildExplorer('mira',{THREE});model.userData.partyProfession='healer';
        const p=cellPoint(0,0);model.position.set(p.x+1,0,p.z);const ownGroup=world.children.find(o=>o.name==='tower-party-scene');ownGroup.add(model);
        const offer={id:'companion:'+run.floor+':'+run.seed,profession:'healer',level:1,price:12};
        partyUI.reserved().push({...p,kind:'recruit',offer,model});
        const before=ownGroup.children.filter(o=>o.userData.partyProfession==='healer').length;
        partyUI.tick(.016,performance.now());
        return {before,after:ownGroup.children.filter(o=>o.userData.partyProfession==='healer').length,removed:!model.parent,markers:partyUI.markers().filter(m=>m.label==='友').length};
      },
      snapshot:()=>JSON.parse(JSON.stringify(run.party.members)),
    };`;
    const end='  install();\n})();';assert.ok(mode.includes(end));
    await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:mode.replace(end,'  install();\n'+bridge+'\n})();')}));
  }
  await page.goto(base,{waitUntil:'networkidle'});
  const seedSave=await page.evaluate(()=>{
    const C=TowerCore,P=TowerPartyCore,N=TowerNarrative;let run=P.enable(C.newRun({seed:1,name:'滿隊驗證'}),'swordsman').run;
    for(let floor=98;floor>=91;floor--){const result=C.descend(run);if(!result.ok)throw Error(result.message);run=result.run;}
    run.party.members=['healer','scout','chef'].map((profession,i)=>({id:'companion:'+([96,95,93][i])+':1',profession,level:1,hp:34,cooldown:0,hurtLeft:0}));run.party.joined=run.party.members.map(m=>m.id);
    run=N.collectClue(run).run;run.hp=47;run.coins=31;
    const save=C.validateSave(run);if(!save)throw Error('Invalid fixture');localStorage.setItem('maze3d_tower_v1',JSON.stringify(save));return save;
  });
  const inspect=()=>page.evaluate(()=>{
    const models=[];let groups=0;scene.traverse(o=>{if(o.name==='tower-party-scene')groups++;if(o.userData.partyProfession)models.push({profession:o.userData.partyProfession,id:o.userData.companionId||null});});
    return {models,groups,version:document.getElementById('splashVersion').innerText,save:JSON.parse(localStorage.getItem('maze3d_tower_v1')).party.members};
  });
  const check=async(step)=>{const state=await inspect();results.push({step,...state});assert.equal(state.models.length,3);assert.equal(state.groups,1);assert.equal(state.models.filter(m=>m.profession==='healer').length,1);assert.ok(state.models.every(m=>m.id));assert.deepEqual(state.save,seedSave.party.members);};
  const resume=async()=>{await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await page.locator('#towerDialog button[data-tower="close"]').first().tap();};
  await page.reload({waitUntil:'networkidle'});await resume();await check('continue-91-full-team');
  await page.locator('#towerObjective').waitFor({state:'hidden',timeout:9000});
  let stress=null;
  if(!production){
    const before=await page.evaluate(()=>__identityQA.snapshot());
    stress=await page.evaluate(()=>__identityQA.staleRecruit());assert.deepEqual(stress,{before:2,after:1,removed:true,markers:0});
    await page.evaluate(()=>{__identityQA.rebuild();__identityQA.rebuild();});await check('rebuild-twice-with-stale-rules');
    assert.deepEqual(await page.evaluate(()=>__identityQA.snapshot()),before);
  }
  await page.evaluate(()=>{G.view='top';G.topZoom=12;updateCamera(1);renderer.render(scene,camera);});await page.screenshot({path:out+'/'+prefix+'-full-team.png'});
  await page.evaluate(()=>TowerMode.requestQuit());await page.locator('[data-tower="home"]').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await page.locator('#towerDialog button[data-tower="close"]').first().tap();await check('home-resume-same-document');
  await page.reload({waitUntil:'networkidle'});await resume();await check('reload-91-full-team');
  await page.evaluate(()=>{const p=cellToWorld(G.exitCell.x,G.exitCell.y);G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);TowerMode.reachExit(true);});
  await page.locator('[data-tower="descend"]').tap();await check('stairs-to-90');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('maze3d_tower_v1')).floor),90);assert.deepEqual(errors,[]);
  const result={ok:true,base,results,stress,assets,errors};await writeFile(out+'/'+prefix+'-readback.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
