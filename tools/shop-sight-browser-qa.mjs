import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/shop-sight-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/api/runtime-config',route=>route.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
 await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;Object.assign(MP,{on:true,mode:'shop',host:false,id:'qa-shop',seed:77,size:13,started:true,ended:false,shiftMs:60000,order:['qa-shop','qa-other'],roster:[{id:'qa-shop',name:'測試',charIdx:0},{id:'qa-other',name:'另一位玩家',charIdx:1}]});startGame();G.roundEndsAt=performance.now()+MP.roundMs;G.frozen=true;clearInterval(MP.posTimer);});
 const checks=[];
 for(const view of ['tp','top','fp']){
  const state=await page.evaluate(view=>{G.view=view;const b=G.wallBoxes.find(b=>!b.boundary&&b.gx>0&&b.gy>0),a=cellToWorld(b.gx,b.gy),other=cellToWorld(b.gx+(b.type==='v'?1:0),b.gy+(b.type==='h'?1:0));G.px=a.x;G.pz=a.z;playerGroup.position.set(a.x,0,a.z);const target=MP.players['qa-other'].mesh;target.position.set(other.x,0,other.z);MP.players['qa-other'].tx=other.x;MP.players['qa-other'].tz=other.z;const f={...sightFrame(),force:true};let captured;const render=renderer.render;renderer.render=function(...args){captured={target:target.visible,wall:wallMesh.visible,fog:scene.fog===null};return render.apply(this,args);};MazeSight.render(f,renderer,camera);renderer.render=render;return {view,captured,visible:MazeSight.visible(other.x,other.z),active:MazeSight.active(),layer:!!scene.getObjectByName('maze-sight-layer'),mapFog:magicMapEnabled(),stats:MazeSight.stats(),goods:G.goods.length,wallHeight:G.wallH};},view);
  assert.deepEqual(state.captured,{target:true,wall:true,fog:true});assert.equal(state.visible,true);assert.equal(state.active,false);assert.equal(state.layer,false);assert.equal(state.mapFog,false);assert.equal(state.stats,null);assert.ok(state.goods>0);assert.equal(state.wallHeight,1.25);checks.push(state);await page.waitForTimeout(200);await page.screenshot({path:out+'/'+view+'.png'});
 }
 const entry=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});entry.on('pageerror',e=>errors.push(e.stack));
 await entry.route('**/api/runtime-config',route=>route.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
 await entry.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await entry.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
 await entry.locator('#enterMenuBtn').tap();await entry.locator('#singleBtn').tap();await entry.locator('#playerName').fill('環境巡查');await entry.locator('#profileNextBtn').tap();await entry.locator('#startBtn').tap();assert.ok(await entry.locator('#gameScreen.active').count());
 const classics=[];
 for(let i=0;i<6;i++){
  const s=await entry.evaluate(i=>{G.lvlIdx=i;G.spMode='classic';MP.on=false;startGame();G.frozen=true;G.camPitch=.48;G.camYaw=2.2;updateCamera(1);renderMaze();return {name:LEVELS[i].name,atmosphere:!!mazeAtmosphere,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,ratio:renderer.getPixelRatio(),overflow:document.documentElement.scrollWidth>innerWidth};},i);
  assert.ok(s.atmosphere&&s.draws>0&&s.triangles>0);assert.equal(s.overflow,false);classics.push(s);if(i===0||i===3)await entry.screenshot({path:out+'/classic-'+i+'.png'});
 }
 await entry.locator('#actionsToggle').tap();assert.equal(await entry.locator('#battleSettings[open]').count(),1);await entry.locator('#battleSettings [data-maze-quality="battery"]').tap();assert.equal(await entry.evaluate(()=>MazeQuality.mode()),'battery');await entry.locator('#battleSettings [data-battle="close"]').tap();
 // Only inspect the multiplayer entry UI: never contact a broker or create a public room.
 await entry.evaluate(()=>{G.running=false;switchScreen('titleScreen');setFlowPanel('homePanel');});await entry.locator('#mpBtn').tap();await entry.locator('#playerName').fill('多人入口巡查');await entry.locator('#profileNextBtn').tap();await entry.locator('#startBtn').tap();assert.equal(await entry.locator('#mpModal').isVisible(),true);assert.equal(await entry.locator('#mpCreate').isVisible(),true);assert.equal(await entry.locator('#mpJoin').isVisible(),true);await entry.screenshot({path:out+'/multiplayer-entry.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({checks,classics,multiplayerEntry:true,errors},null,2));console.log(JSON.stringify({pass:true,checks,classics,multiplayerEntry:true,errors}));
}finally{await browser.close();}
