// Regression for the actual shared world-nameplate shader and natural entry.
// Run through Process Guard against an owned local static server on port 8797.
// Kept separate from the completed, much larger upgrade GPU gallery evidence.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const gpuOnly=process.argv.includes('--gpu-only'),base=process.env.MAZE_QA_URL||'http://127.0.0.1:8797/',out=gpuOnly?'.agent-run/world-nameplate-gpu-qa':'.agent-run/world-nameplate-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
await mkdir(out,{recursive:true});
const report={base,gpuOnly,loaded:[],errors:[],blocked:[],pixels:[],viewports:[]},responses=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
async function context(viewport){
  const c=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block'}),p=await c.newPage();p.setDefaultTimeout(20000);
  p.on('pageerror',e=>report.errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  p.on('response',r=>{if((/\.(?:js|html|css)(?:\?|$)/.test(r.url())||new URL(r.url()).pathname==='/')&&new URL(r.url()).origin===new URL(base).origin)responses.push((async()=>{const body=await r.body();report.loaded.push({url:r.url(),status:r.status(),sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length});})().catch(e=>report.errors.push('response evidence: '+e.message)));});
  await c.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())||new URL(r.request().url()).origin!==new URL(base).origin){report.blocked.push(r.request().url());return r.abort();}return r.continue();});
  await p.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));await p.route('**/api/scores*',r=>r.fulfill({json:[]}));
  await p.addInitScript(()=>{window.__roomAttempts=[];window.WebSocket=class{constructor(url){window.__roomAttempts.push(url);throw Error('Real room connections are forbidden in local QA');}};});
  return {c,p};
}
async function home(p){await p.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>typeof makeTextSprite==='function'&&typeof TowerMode==='object'&&typeof TowerEnvironmentLife==='object',{},{timeout:60000});}
async function resume(p){const skip=p.locator('[data-cinema="skip"]');if(await skip.isVisible())await skip.tap();const close=p.locator('[data-tower="close"]').first();if(await close.isVisible())await close.tap();await p.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running);}
try{
  const first=await context({width:844,height:390});page=first.p;await home(page);
  await page.evaluate(()=>{
    const T=THREE,scene=new T.Scene();scene.background=new T.Color(0x000000);
    const camera=new T.PerspectiveCamera(60,844/390,.01,100);camera.position.set(0,0,1);
    const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(844,390);renderer.debug.checkShaderErrors=true;
    Object.assign(renderer.domElement.style,{position:'fixed',inset:0,zIndex:999999,width:'100vw',height:'100vh'});document.body.append(renderer.domElement);
    const sprite=makeTextSprite('歸途高塔補給商店'),originalMap=sprite.material.map,guardMaterial=sprite.material,plainMaterial=new T.SpriteMaterial({map:originalMap,transparent:true,depthWrite:false});scene.add(sprite);
    const canvas=originalMap.image,context=canvas.getContext('2d'),textImage=context.getImageData(0,0,256,64),originalScale=sprite.scale.clone();
    function read(){const gl=renderer.getContext(),w=renderer.domElement.width,h=renderer.domElement.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(const p of renderer.info.programs||[])if(!gl.getProgramParameter(p.program,gl.LINK_STATUS)||p.diagnostics?.runnable===false)throw Error('Nameplate shader failed to link');return pixels;}
    function bounds(pixels){const w=renderer.domElement.width,h=renderer.domElement.height;let minX=w,minY=h,maxX=-1,maxY=-1,bright=0,max=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,l=Math.max(pixels[i],pixels[i+1],pixels[i+2]);max=Math.max(l,max);if(l>8){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(l>128)bright++;}return {width:Math.max(0,maxX-minX+1),height:Math.max(0,maxY-minY+1),minX,minY,maxX,maxY,bright,max};}
    function render(guard=true){sprite.material=guard?guardMaterial:plainMaterial;sprite.onBeforeRender(renderer);renderer.render(scene,window.__nameplateQA.camera);return read();}
    window.__nameplateQA={renderer,scene,camera,
      measure({width,height,near=true,rotation=0,center=0,axis='x',solid=false,ortho=false}={}){
        renderer.setSize(width,height);this.camera=ortho?new T.OrthographicCamera(-width/height,width/height,1,-1,.01,100):camera;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.camera.position.set(0,0,near?1:18);this.camera.updateMatrixWorld();
        sprite.position.set(0,0,0);const depth=this.camera.position.z;if(axis==='y')sprite.position.y=center*(ortho?1:depth/this.camera.projectionMatrix.elements[5]);else sprite.position.x=center*(ortho?width/height:depth/this.camera.projectionMatrix.elements[0]);
        if(solid){context.clearRect(0,0,256,64);context.fillStyle='#fff';context.fillRect(0,0,256,64);}else context.putImageData(textImage,0,0);originalMap.needsUpdate=true;
        guardMaterial.rotation=plainMaterial.rotation=rotation;
        const plain=render(false),guard=render(true),a=bounds(plain),b=bounds(guard);let different=0;for(let i=0;i<plain.length;i++)if(plain[i]!==guard[i])different++;
        const gl=renderer.getContext(),program=gl.getParameter(gl.CURRENT_PROGRAM),location=gl.getUniformLocation(program,'worldLabelLimits'),uploaded=location?Array.from(gl.getUniform(program,location)):null,expected=makeTextSprite.screenGuard.limits.toArray();
        if(!uploaded||uploaded.some((n,i)=>Math.abs(n-expected[i])>1e-6))throw Error('Stale screen-size uniform after resize: '+JSON.stringify({uploaded,expected}));
        if(!sprite.scale.equals(originalScale)||sprite.visible!==true||guardMaterial.opacity!==1||guardMaterial.map!==originalMap)throw Error('Nameplate shader mutated game-visible sprite state');
        const ratio=renderer.getPixelRatio();return {width,height,near,rotation,center,axis,solid,ortho,plain:a,guard:b,guardCSS:{width:b.width/ratio,height:b.height/ratio},different,cap:{width:Math.min(width*.36,240),height:Math.max(36,Math.min(44,height*.11))},uploaded,expected,ratio,gpu:{calls:renderer.info.render.calls,programs:renderer.info.programs.length,memory:{...renderer.info.memory}}};
      },
      fade(){const full=this.measure({width:844,height:390,solid:true,center:0}),edge=this.measure({width:844,height:390,solid:true,center:.94}),outside=this.measure({width:844,height:390,solid:true,center:1.04}),top=this.measure({width:844,height:390,solid:true,center:1.04,axis:'y'});return {full,edge,outside,top};},
      quality(){const old=MazeQuality.mode(),q=MazeQuality.create(renderer,{mobile:true,dpr:2}),rows=[];for(const mode of ['detail','auto','battery']){MazeQuality.set(mode);q.configure();rows.push({mode,status:q.status(),pixels:this.measure({width:568,height:320,solid:true})});}MazeQuality.set(old);renderer.setPixelRatio(1);return rows;},
      stability(){this.measure({width:568,height:320,solid:true});const memory={...renderer.info.memory},programs=renderer.info.programs.length,size=makeTextSprite.screenGuard.size,limit=makeTextSprite.screenGuard.limits;for(let n=0;n<50;n++){renderer.render(scene,this.camera);if(makeTextSprite.screenGuard.size!==size||makeTextSprite.screenGuard.limits!==limit||guardMaterial.map!==originalMap||renderer.info.memory.textures!==memory.textures||renderer.info.memory.geometries!==memory.geometries||renderer.info.programs.length!==programs)throw Error('Nameplate per-frame resource allocation');}return {frames:50,memory,programs};},
      close(){guardMaterial.dispose();plainMaterial.dispose();originalMap.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
    };
  });
  for(const [width,height]of [[1440,900],[844,390],[568,320],[390,844]]){
    await page.setViewportSize({width,height});
    for(const rotation of [0,.7])for(const ortho of [false,true]){const r=await page.evaluate(o=>__nameplateQA.measure(o),{width,height,rotation,ortho,near:true,solid:true});assert.ok(r.guard.width<=Math.ceil(r.cap.width)+1&&r.guard.height<=Math.ceil(r.cap.height)+1,JSON.stringify(r));assert.ok(r.guard.width>0&&r.guard.height>0);assert.ok(r.gpu.calls===1&&r.gpu.memory.textures===1);report.pixels.push(r);}
    const text=await page.evaluate(o=>__nameplateQA.measure(o),{width,height,near:true});assert.ok(text.guard.height>=12,'actual Chinese glyphs must remain legible: '+JSON.stringify(text));assert.ok(text.guard.bright>250);report.pixels.push(text);await page.screenshot({path:out+'/'+width+'-near-chinese.png'});
    const far=await page.evaluate(o=>__nameplateQA.measure(o),{width,height,near:false});assert.equal(far.different,0,'normal distant pixels must remain identical to the original material');report.pixels.push(far);console.log('nameplate GPU pixels verified',width,height);
  }
  report.fade=await page.evaluate(()=>__nameplateQA.fade());assert.equal(report.fade.full.guard.max,255);assert.ok(report.fade.edge.guard.max>0&&report.fade.edge.guard.max<240);assert.equal(report.fade.outside.guard.bright,0);assert.equal(report.fade.outside.guard.width,0);assert.ok(report.fade.outside.plain.width>0,'the old near-camera label must reproduce the offscreen spill');
  assert.equal(report.fade.top.guard.width,0);assert.ok(report.fade.top.plain.width>0,'the real above-screen giant label must reproduce without the guard');
  report.quality=await page.evaluate(()=>__nameplateQA.quality());assert.deepEqual(report.quality.map(r=>r.pixels.ratio),[1.75,1.5,1]);for(const row of report.quality)assert.ok(row.pixels.guardCSS.width<=row.pixels.cap.width+1&&row.pixels.guardCSS.height<=row.pixels.cap.height+1,'quality resolution must not change the CSS cap');
  report.stability=await page.evaluate(()=>__nameplateQA.stability());await page.evaluate(()=>__nameplateQA.close());await first.c.close();
  if(!gpuOnly){for(const [width,height,job]of [[1440,900,'mage'],[844,390,'robot'],[568,320,'healer']]){
    const {c,p}=await context({width,height});page=p;await home(page);await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="new"]').tap();assert.equal(await page.locator('[data-tower="profession"]').count(),8);assert.equal(await page.locator('.hero-skill-list').count(),0);await page.locator('#heroNameInput').fill('名牌顯示驗證');await page.locator('[data-tower="hero-sex"][data-item="female"]').tap();await page.locator('[data-tower="profession"][data-item="'+job+'"]').tap();assert.equal(await page.locator('.hero-skill-list article').count(),5);await page.locator('[data-tower="hero-create-start"]').tap();await resume(page);
    const snapshot=()=>page.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,seed:r?.seed,floor:r?.floor,job:r?.party.profession,sex:r?.party.sex,skills:r?.party.loadouts.actors.hero.skills,scroll:document.documentElement.scrollWidth,width:innerWidth,roomAttempts:__roomAttempts};});
    const save=await snapshot();assert.ok(save.valid);assert.equal(save.floor,99);assert.equal(save.job,job);assert.equal(save.scroll,width);assert.deepEqual(save.roomAttempts,[]);
    const currentScene=await page.evaluate(()=>{const labels=[];scene.traverse(o=>{if(o.isSprite&&o.material?.userData.worldNameplate)labels.push(o);});const previous=MazeQuality.mode(),rows=[];for(const mode of ['auto','detail','battery']){MazeQuality.set(mode);MazeSight.render(sightFrame(),renderer,camera);const size=renderer.getSize(new THREE.Vector2()),buffer=renderer.getDrawingBufferSize(new THREE.Vector2()),rect=renderer.domElement.getBoundingClientRect();rows.push({mode,ratio:renderer.getPixelRatio(),rendererCSS:size.toArray(),buffer:buffer.toArray(),actualCSS:[rect.width,rect.height],limit:{width:makeTextSprite.screenGuard.limits.x*rect.width/2,height:makeTextSprite.screenGuard.limits.y*rect.height/2}});}MazeQuality.set(previous);MazeSight.render(sightFrame(),renderer,camera);const gl=renderer.getContext();return {labels:labels.length,shaderLinked:renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)),quality:rows,sight:true};});assert.ok(currentScene.labels>0&&currentScene.shaderLinked);for(const row of currentScene.quality){assert.deepEqual(row.rendererCSS,[width,height]);assert.deepEqual(row.actualCSS,[width,height]);assert.ok(Math.abs(row.buffer[0]-width*row.ratio)<1&&Math.abs(row.buffer[1]-height*row.ratio)<1);assert.ok(Math.abs(row.limit.width-Math.min(width*.36,240))<.001&&Math.abs(row.limit.height-Math.max(36,Math.min(44,height*.11)))<.001);}await page.screenshot({path:out+'/'+width+'-natural-story.png'});
    await page.locator('#towerJournalBtn').tap();assert.match(await page.locator('#towerDialog').innerText(),/歸途|旅人|高塔/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await resume(page);
    await page.locator('#towerBagBtn').tap();assert.ok(await page.locator('#towerDialog').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await resume(page);
    await page.locator('#actionsToggle').tap();await page.locator('[data-tower="quit"]').tap();await page.locator('[data-tower="home"]').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await resume(page);assert.deepEqual(await snapshot(),save);report.viewports.push({width,height,job,...save,scene:currentScene,journal:true,bag:true,continue:true});await c.close();console.log('natural nameplate entry verified',width,height);
  }
  const {c,p}=await context({width:390,height:844});page=p;await home(page);assert.ok(await page.locator('#landscapeGate').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:out+'/390-portrait-gate.png'});report.viewports.push({width:390,height:844,portraitGate:true});await c.close();}
  await Promise.all(responses);assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);
  const loaded=report.loaded.filter(r=>new URL(r.url).pathname==='/'&&r.status===200&&r.bytes>0).at(-1);assert.ok(loaded,'actual index response missing');const local=createHash('sha256').update(await readFile(new URL('../index.html',import.meta.url))).digest('hex');assert.equal(loaded.sha256,local,'index changed after final browser load');report.currentSourceHashes=[{path:'/index.html',sha256:local,loaded:loaded.url}];report.pass=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{await Promise.allSettled(responses);await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,pixelCases:report.pixels.length,viewports:report.viewports.length,loadedHashes:report.loaded.length,errors:report.errors,failure:report.failure}));}
