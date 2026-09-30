import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/shop-sight-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;Object.assign(MP,{on:true,mode:'shop',host:false,id:'qa-shop',seed:77,size:13,started:true,ended:false,shiftMs:60000,order:['qa-shop','qa-other'],roster:[{id:'qa-shop',name:'測試',charIdx:0},{id:'qa-other',name:'另一位玩家',charIdx:1}]});startGame();G.roundEndsAt=performance.now()+MP.roundMs;G.frozen=true;clearInterval(MP.posTimer);});
 const checks=[];
 for(const view of ['tp','top','fp']){
  const state=await page.evaluate(view=>{G.view=view;const b=G.wallBoxes.find(b=>!b.boundary&&b.gx>0&&b.gy>0),a=cellToWorld(b.gx,b.gy),other=cellToWorld(b.gx+(b.type==='v'?1:0),b.gy+(b.type==='h'?1:0));G.px=a.x;G.pz=a.z;playerGroup.position.set(a.x,0,a.z);const target=MP.players['qa-other'].mesh;target.position.set(other.x,0,other.z);MP.players['qa-other'].tx=other.x;MP.players['qa-other'].tz=other.z;const f={...sightFrame(),force:true};let captured;const render=renderer.render;renderer.render=function(...args){captured={target:target.visible,wall:wallMesh.visible,fog:scene.fog===null};return render.apply(this,args);};MazeSight.render(f,renderer,camera);renderer.render=render;return {view,captured,visible:MazeSight.visible(other.x,other.z),active:MazeSight.active(),layer:!!scene.getObjectByName('maze-sight-layer'),mapFog:magicMapEnabled(),stats:MazeSight.stats(),goods:G.goods.length,wallHeight:G.wallH};},view);
  assert.deepEqual(state.captured,{target:true,wall:true,fog:true});assert.equal(state.visible,true);assert.equal(state.active,false);assert.equal(state.layer,false);assert.equal(state.mapFog,false);assert.equal(state.stats,null);assert.ok(state.goods>0);assert.equal(state.wallHeight,1.25);checks.push(state);await page.waitForTimeout(200);await page.screenshot({path:out+'/'+view+'.png'});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({pass:true,checks,errors}));
}finally{await browser.close();}
