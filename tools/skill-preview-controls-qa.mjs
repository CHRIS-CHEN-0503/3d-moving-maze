// Finite, local-only acceptance of the actual public skill preview controls.
// No private bridge, source replacement, saved games or gameplay writes.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8798/',out=process.env.MAZE_QA_OUT||'.agent-run/skill-preview-controls-qa',origin=new URL(base).origin;
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local server only');await mkdir(out,{recursive:true});
const target=new URL('docs/技能光影預覽.html',base).href,report={base,target,views:[],loaded:[],errors:[],blocked:[],sockets:[],limitations:['Desktop Chrome touch/software WebGL simulation, not physical iPhone performance evidence.','Actual page and public controls, deliberately silent. Only optional local favicon is mocked.']},pending=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});let page;
try{
  for(const [width,height]of [[844,390],[568,320],[390,844]]){
    report.currentCase={width,height};const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(20000);
    page.on('pageerror',error=>report.errors.push(error.stack));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});page.on('websocket',socket=>report.sockets.push(socket.url()));
    page.on('response',response=>{const url=new URL(response.url());if(url.origin===origin&&(/\.js$/.test(url.pathname)||decodeURIComponent(url.pathname)==='/docs/技能光影預覽.html'))pending.push((async()=>report.loaded.push({width,height,url:response.url(),status:response.status(),sha256:createHash('sha256').update(await response.body()).digest('hex')}))().catch(error=>report.errors.push(error.message)));});
    await context.route('**/*',route=>{const request=route.request();if(!['GET','HEAD'].includes(request.method())||new URL(request.url()).origin!==origin){report.blocked.push({url:request.url(),method:request.method()});return route.abort();}return route.continue();});
    await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
    await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.skillPreview?.skills.length>0);assert.equal(await page.locator('#error').isVisible(),false,'WebGL initialized');
    const catalog=await page.evaluate(()=>({jobs:Object.entries(TowerHeroes.JOBS).map(([id,job])=>({id,name:job.name,skills:Object.values(TowerHeroes.SKILLS).filter(skill=>skill.job===id).map(skill=>({id:skill.id,name:skill.name}))})),skills:skillPreview.skills.slice(),representatives:{...skillPreview.representatives}}));
    assert.equal(catalog.jobs.length,8);assert.equal(catalog.skills.length,72);assert.equal(await page.locator('#choices button').count(),8);assert.equal(await page.locator('#count').textContent(),'8 職業 · 72 招');
    const optionsSeen=[],selections=[];
    for(const job of catalog.jobs){
      const card=page.locator('#choices button[data-job="'+job.id+'"]');assert.equal(await card.count(),1);await card.tap();assert.equal(await card.getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>skillPreview.current),catalog.representatives[job.id]);
      const options=await page.locator('#skill-select option').evaluateAll(nodes=>nodes.map(node=>({id:node.value,name:node.textContent})));assert.deepEqual(options.map(row=>row.id),job.skills.map(skill=>skill.id));assert.ok(options.every((row,i)=>row.name.includes(job.skills[i].name)));optionsSeen.push(...options.map(row=>row.id));
      for(const skill of [job.skills[0],job.skills.at(-1)]){await page.locator('#skill-select').selectOption(skill.id);assert.equal(await page.evaluate(()=>skillPreview.current),skill.id);assert.equal(await page.locator('#caption').textContent(),job.name+' · '+skill.name);selections.push(skill.id);}
    }
    assert.equal(new Set(optionsSeen).size,72);assert.deepEqual(optionsSeen.slice().sort(),catalog.skills.slice().sort());assert.ok(!optionsSeen.includes('daylight'));
    // The longest ordinary support effect makes the pause test insensitive to
    // event dispatch latency; time is not replaced or artificially advanced.
    await page.locator('#choices button[data-job="healer"]').tap();await page.locator('#skill-select').selectOption('herbal_heal');await page.locator('#replay').tap();await page.locator('#play').tap();
    const frozen=await page.evaluate(()=>({paused:skillPreview.paused,stats:skillPreview.stats()}));assert.equal(frozen.paused,true);assert.ok(frozen.stats.groups>0,'pause catches a live effect');assert.equal(await page.locator('#play').textContent(),'繼續動畫');
    await page.waitForTimeout(2100);assert.deepEqual(await page.evaluate(()=>({paused:skillPreview.paused,stats:skillPreview.stats()})),frozen,'paused effect does not expire');
    await page.locator('#play').tap();await page.waitForFunction(()=>!skillPreview.paused&&skillPreview.stats().groups===0);await page.locator('#replay').tap();assert.equal(await page.evaluate(()=>skillPreview.paused),false);assert.ok((await page.evaluate(()=>skillPreview.stats())).groups>0,'replay emits the selected effect again');
    const layout=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,targets:[...document.querySelectorAll('#choices button,.controls button,.controls select,#auto-label')].map(node=>{const r=node.getBoundingClientRect();return {label:node.getAttribute('aria-label')||node.textContent.trim(),width:r.width,height:r.height};})}));
    assert.ok(layout.scrollWidth<=layout.clientWidth,'no horizontal overflow');assert.equal(layout.targets.length,12);for(const rect of layout.targets){assert.ok(rect.width>=44,'touch width: '+rect.label);assert.ok(rect.height>=44,'touch height: '+rect.label);}
    await page.locator('#stage').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+width+'x'+height+'-preview.png',fullPage:true});report.views.push({width,height,jobs:8,skills:optionsSeen,selectionChanges:selections.length,pause:true,replay:true,layout});await context.close();console.log('skill preview controls passed',width,height);
  }
  await Promise.all(pending);report.sourceHashes=[];
  for(const path of ['/docs/技能光影預覽.html','/story/tower-skill-effects.js','/story/tower-heroes-core.js','/story/tower-heroes-icons.js']){
    const rows=report.loaded.filter(row=>decodeURIComponent(new URL(row.url).pathname)===path);assert.equal(rows.length,3,'actual source loaded in all viewports '+path);const hash=createHash('sha256').update(await readFile(new URL('..'+path,import.meta.url))).digest('hex');for(const row of rows){assert.equal(row.status,200);assert.equal(row.sha256,hash,'loaded bytes match current source '+path);}report.sourceHashes.push({path,sha256:hash,loads:rows.length});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.sockets,[]);report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await Promise.allSettled(pending);await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:!!report.pass,views:report.views.length,errors:report.errors,failure:report.failure,report:out+'/report.json',contextsClosed:true}));}
