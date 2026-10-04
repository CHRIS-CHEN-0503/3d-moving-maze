// Finite, local-only audition-page regression. Browser playback is muted:
// decoding/playback checks are not a human subjective listening review.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ORCHESTRA_QA_URL||'http://127.0.0.1:8798/.agent-run/scene-orchestra-previews-audition-20261005/';
const source=resolve(process.env.ORCHESTRA_QA_SOURCE||'.agent-run/scene-orchestra-previews-audition-20261005');
const out=resolve(process.env.ORCHESTRA_QA_OUT||'.agent-run/scene-orchestra-preview-browser-qa');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.ok(source.startsWith(resolve('.agent-run')+'/')&&out.startsWith(resolve('.agent-run')+'/'));
const expected=JSON.parse(await readFile(source+'/report.json','utf8'));
assert.equal(expected.pass,true);assert.equal(expected.officialMusicChanged,false);assert.equal(expected.tracks.length,3);
await mkdir(out,{recursive:true});
const origin=new URL(base).origin,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={base,localOnly:true,pass:false,cases:[],loaded:[],errors:[],blocked:[],limitations:['Muted browser decoding and media playback checks, not a subjective listening review.','Touch-emulated viewports, not physical iPhone speakers or performance.','No room, production network or game-music mutation.']};
const work=[],contexts=new Set();let page;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
try{
  for(const [width,height]of [[1440,900],[844,390],[390,844]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});contexts.add(context);
    page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',e=>report.errors.push(e.stack));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('response',r=>{if(r.status()===200&&new URL(r.url()).origin===origin)work.push((async()=>{const bytes=await r.body();report.loaded.push({url:r.url(),status:r.status(),sha256:sha(bytes)});})().catch(e=>report.errors.push(e.message)));});
    await context.route('**/*',r=>{const q=r.request();if(new URL(q.url()).origin!==origin||!['GET','HEAD'].includes(q.method())){report.blocked.push({url:q.url(),method:q.method()});return r.abort();}return r.continue();});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('article').count(),3);assert.equal(await page.locator('audio[autoplay]').count(),0);
    assert.ok(await page.getByText('尚未替換正式遊戲音樂',{exact:false}).isVisible());
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,players:[...document.querySelectorAll('audio')].map(a=>({paused:a.paused,preload:a.preload,controls:a.controls,width:a.getBoundingClientRect().width}))}));
    assert.ok(layout.scrollWidth<=width);assert.ok(layout.players.every(a=>a.paused&&a.preload==='none'&&a.controls&&a.width>=240));
    const tracks=[];
    for(let i=0;i<3;i++){
      const control=page.locator('audio').nth(i),track=expected.tracks[i];
      await control.scrollIntoViewIfNeeded();await control.tap({position:{x:25,y:27}});
      await page.waitForFunction(index=>{const a=document.querySelectorAll('audio')[index];return !a.paused&&a.currentTime>.2&&a.readyState>=2;},i);
      const playing=await control.evaluate(a=>({duration:a.duration,currentTime:a.currentTime,paused:a.paused,error:a.error?.code||null,source:decodeURIComponent(new URL(a.currentSrc).pathname)}));
      assert.equal(playing.error,null);assert.equal(playing.paused,false);assert.ok(Math.abs(playing.duration-track.seconds)<.15);assert.equal(basename(playing.source),track.filename);
      await control.tap({position:{x:25,y:27}});assert.equal(await control.evaluate(a=>a.paused),true);
      const frozen=await control.evaluate(a=>a.currentTime);await page.waitForTimeout(220);assert.ok(Math.abs((await control.evaluate(a=>a.currentTime))-frozen)<.05);
      tracks.push({title:track.title,...playing,pauseStable:true});
    }
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+width+'-preview.png',fullPage:true});
    report.cases.push({width,height,layout,tracks,screenshot:width+'-preview.png'});
    await Promise.all(work);await context.close();contexts.delete(context);
  }
  const paths=['index.html',...expected.tracks.map(t=>t.filename)];report.sourceHashes=[];
  for(const name of paths){const loaded=report.loaded.filter(row=>decodeURIComponent(new URL(row.url).pathname)===new URL(base).pathname+name||(name==='index.html'&&new URL(row.url).pathname===new URL(base).pathname)).at(-1);assert.ok(loaded,'source was actually loaded: '+name);const digest=sha(await readFile(source+'/'+name));assert.equal(loaded.sha256,digest);report.sourceHashes.push({name,sha256:digest});}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await Promise.allSettled(work);await Promise.allSettled([...contexts].map(c=>c.close()));await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,cases:report.cases.length,sourceHashes:report.sourceHashes?.length,errors:report.errors,failure:report.failure,report:out+'/report.json',contextsClosed:true}));}
