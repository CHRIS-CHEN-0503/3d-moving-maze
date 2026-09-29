import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795';
const production=base==='https://3d-moving-maze.pages.dev';
assert.ok(production||base==='http://127.0.0.1:8795');
const out='.agent-run/'+(production?'production-v1422':'durability-v3-qa');await mkdir(out,{recursive:true});
const assets=[];
if(process.env.MAZE_RELEASE_ROOT){
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const file of ['index.html','story/story-core.js','story/tower-mode.js','docs/職業裝備圖鑑.html']){
    const response=await fetch(base+'/'+file,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,file);
    const sha256=hash(Buffer.from(await response.arrayBuffer()));
    assert.equal(sha256,hash(await readFile(process.env.MAZE_RELEASE_ROOT+'/'+file)),file);
    assets.push({file,sha256});
  }
}
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#splashVersion').innerText(),'1.42.2');
  const fixture=await page.evaluate(()=>{
    const C=TowerCore,P=TowerPartyCore,H=TowerHeroes;
    let r=H.enable(P.enable(C.newRun({seed:43,name:'耐久換算測試'}),'smith').run).run;
    r=P.recruit(r,P.recruitOffer(r).id).run;
    r.gearBag.push(C.createGear('robe',99,43,'broken'));
    const expected={};
    H.allGear(r).forEach((g,i)=>{
      g.durabilityVersion=2;g.maxDurability/=5;g.durability=i%2?0:Math.floor(g.maxDurability/2);
      expected[g.id]={durability:g.durability*5,maxDurability:g.maxDurability*5};
    });
    if(!C.validateSave(r))throw Error('invalid old-save fixture');
    const raw=JSON.stringify(r);localStorage.setItem('maze3d_tower_v1',raw);
    GameVoice.configure({enabled:false});G.muted=true;
    return {raw,expected};
  });
  for(let reload=0;reload<2;reload++){
    if(reload){await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});}
    await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();
    const result=await page.evaluate(()=>({backup:localStorage.getItem('maze3d_tower_v1_before_durability3'),gear:TowerHeroes.allGear(JSON.parse(localStorage.getItem('maze3d_tower_v1')))}));
    assert.equal(result.backup,fixture.raw,'first raw backup survives later loads');
    assert.equal(result.gear.length,Object.keys(fixture.expected).length);
    for(const g of result.gear){assert.equal(g.durabilityVersion,3);assert.deepEqual({durability:g.durability,maxDurability:g.maxDurability},fixture.expected[g.id]);}
  }
  await page.screenshot({path:out+'/migration.png'});
  assert.deepEqual(errors,[]);
  const report={url:base,version:'1.42.2',assets,gearCount:Object.keys(fixture.expected).length,firstMigration:true,reloadIdempotent:true,backupExact:true,errors};
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
