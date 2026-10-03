// Disposable local browser contexts only. All fixtures stay in this test bridge.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const before=process.env.MARKET_ART_BEFORE==='1',base=process.env.MARKET_ART_URL||'http://127.0.0.1:8795/';
const galleryOnly=process.env.MARKET_ART_GALLERY_ONLY==='1';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Test fixtures must remain local');
const out='.agent-run/market-art-qa/'+(before?'before':'after');await mkdir(out,{recursive:true});
const report={before,layouts:[],transactions:[],art:[],errors:[],limitations:'Chrome with touch emulation; not physical-device performance. Isolated fixtures set resources/positions, and transactions use real UI buttons.'};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});let page;
try {
 let context;
 const old=path=>execFileSync('git',['show','HEAD:'+path],{maxBuffer:12e6}).toString();
 const fixtures=await readFile(new URL('./tower-camp-services-browser-qa.mjs',import.meta.url),'utf8'),bridge=fixtures.match(/const bridge=`([\s\S]*?)`;/)?.[1];assert.ok(bridge);
 const mode=before?old('story/tower-mode.js'):await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
 const anchor='  install();\n})();';assert.ok(mode.includes(anchor));
 async function openContext(width,height){
  if(context)await context.close();context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.stack));
  await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:mode.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  if(before)for(const path of ['story/tower-party.css','story/tower-mobile.css','story/tower-heroes.css','story/tower-party-runtime.js','story/tower-heroes-visuals.js','assets/character-sculpt.js','assets/character-face.js'])await page.route('**/'+path+'*',r=>r.fulfill({contentType:path.endsWith('.css')?'text/css':'application/javascript',body:old(path)}));
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();await page.waitForTimeout(700);
 }
 await openContext(844,390);
 const load=options=>page.evaluate(o=>__campQA.load(o),options),state=()=>page.evaluate(()=>__campQA.state());
 const button=(key,id)=>page.locator('[data-tower="'+key+'"]'+(id?'[data-item="'+id+'"]':''));
 const shot=label=>page.screenshot({path:out+'/'+label+'.png'});
 async function layout(label){const l=await page.evaluate(()=>{const d=document.querySelector('#towerDialog'),c=d.querySelector('.tower-dialog-content'),r=d.getBoundingClientRect(),cr=c.getBoundingClientRect(),cards=[...d.querySelectorAll('.tower-item,.forge-pick,.grocery-ingredient')];return {width:innerWidth,height:innerHeight,root:document.documentElement.scrollWidth,scroll:c.scrollWidth,client:c.clientWidth,contentHeight:c.clientHeight,scrollHeight:c.scrollHeight,visibleCards:cards.filter(el=>{const b=el.getBoundingClientRect();return b.top>=cr.top-1&&b.bottom<=cr.bottom+1;}).length,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};});assert.ok(l.root<=l.width+1&&l.scroll<=l.client+2,label+JSON.stringify(l));assert.ok(l.rect.x>=-1&&l.rect.y>=-1&&l.rect.right<=l.width+1&&l.rect.bottom<=l.height+1,label);if(!before)assert.ok(l.contentHeight>=75,label+' content vanished');report.layouts.push({label,...l});return l;}
 async function swipeMain(label){
  const content=page.locator('.tower-dialog-content');await content.evaluate(el=>{el.scrollTop=0;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.waitForTimeout(100);
  const box=await content.boundingBox(),initial=await content.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));if(initial.max<25)return;
  const session=await context.newCDPSession(page),x=box.x+box.width*.68,start=box.y+box.height-14,end=box.y+14;
  const target=await page.evaluate(({x,y})=>{const el=document.elementFromPoint(x,y);return {tag:el?.tagName,className:el?.className,action:el?.closest('button')?.dataset.tower,touchAction:getComputedStyle(el).touchAction};},{x,y:start});
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]});for(let i=1;i<=12;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*i/12}]});await page.waitForTimeout(25);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);await session.detach();
  const now=await content.evaluate(el=>el.scrollTop);report.transactions.push({action:'touch-scroll',label,delta:now-initial.top,initial,target});assert.ok(now>initial.top+15,label+' actual touch swipe failed '+JSON.stringify({initial,now,target,box}));
 }
 if(!galleryOnly)for(const [width,height]of [[844,390],[667,375],[568,320],[1024,768],[1440,900]]){
  // Fresh touch context: Chromium's compositor can retain the prior gesture
  // viewport after resize, although all DOM metrics already show the new size.
  await openContext(width,height);
  for(const merchant of ['jinHe','tieLing','lanZhou','suHe']){
   await load({merchant,job:'smith'});await page.evaluate(id=>__campQA.shop(id),merchant);const shopLayout=await layout(width+'-'+merchant+'-shop');if(!before&&width===844&&merchant==='suHe')assert.ok(shopLayout.visibleCards>=6,'six complete phone stock cards must fit');if(merchant==='suHe'||merchant==='jinHe')await shot(width+'-'+merchant+'-shop');
   if(merchant==='suHe'){
    const initial=await state(),price=await page.evaluate(()=>TowerCore.supplyPrice('heal',1)),supply=button('buy','heal');await supply.scrollIntoViewIfNeeded();await supply.tap();const next=await state();assert.equal(next.coins,initial.coins-price);report.transactions.push({width,merchant,action:'heal',valid:next.valid});
    continue;
   }
   await button('party-merchant-forge',merchant).tap();await layout(width+'-'+merchant+'-maintenance-list');if(merchant==='jinHe')await shot(width+'-'+merchant+'-maintenance-list');
   if(before)continue;
   if(width<=844)await swipeMain(width+'-'+merchant+' list');
   const initial=await state(),eligible=await page.evaluate(id=>__campQA.eligible(id),merchant),last=eligible.at(-1);assert.ok(last);
   const pick=button('party-forge-select',last);await pick.scrollIntoViewIfNeeded();await pick.tap();
   await layout(width+'-'+merchant+'-maintenance-detail');if(merchant==='jinHe')await shot(width+'-'+merchant+'-maintenance-detail');
   if(width<=844){await swipeMain(width+'-'+merchant+' detail');const lower=button('party-dismantle-ask',last);await lower.scrollIntoViewIfNeeded();const b=await lower.boundingBox(),c=await page.locator('.tower-dialog-content').boundingBox();assert.ok(b.y>=c.y-1&&b.y+b.height<=c.y+c.height+1,'last maintenance action must be reachable');if(merchant==='jinHe')await shot(width+'-'+merchant+'-maintenance-detail-bottom');}
   const mend=button('party-mend-ask',last);await mend.scrollIntoViewIfNeeded();await mend.tap();assert.deepEqual(await state(),initial,'opening repair confirmation must not charge');await button('party-mend-confirm',last).tap();
   const repaired=await state();assert.ok(repaired.valid);const g=repaired.gear.find(g=>g.id===last);assert.equal(g.durability,g.maxDurability);assert.ok(repaired.coins<initial.coins);report.transactions.push({width,merchant,action:'last-item-repair',valid:true});
  }
  if(!before&&width<=844){
   await page.evaluate(()=>{GameVoice.configure({enabled:true});__campQA.shop('suHe');});assert.equal(await page.locator('.tower-dialog-header [data-voice-action]').count(),2);await layout(width+'-voice-controls');
   const sizes=await page.locator('#towerDialog button:visible').evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return {action:el.dataset.tower||el.dataset.voiceAction,w:b.width,h:b.height};}));assert.ok(sizes.every(b=>b.w>=43.5&&b.h>=43.5),'touch targets must remain 44px');
   await shot(width+'-voice-controls');await page.evaluate(()=>{GameVoice.configure({enabled:false});GameVoice.stop();});
  }
 }
 // Every model uses the same neutral studio lighting, camera and source build.
 await page.setViewportSize({width:1680,height:960});
 await page.evaluate(()=>{
  __campQA.close();G.frozen=true;
  const T=THREE,H=TowerHeroes,V=TowerHeroVisuals;const s=new T.Scene();s.background=new T.Color(0x17242c);s.add(new T.HemisphereLight(0xf9f4e8,0x516a7d,1.1));const sun=new T.DirectionalLight(0xffe6c4,1.25);sun.position.set(-5,7,9);s.add(sun);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);Object.assign(renderer.domElement.style,{position:'fixed',inset:0,zIndex:100000,width:'100vw',height:'100vh'});document.body.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-8.7,8.7,5.6,-.45,.1,60);camera.position.set(0,0,18);camera.lookAt(0,0,0);
  window.__marketGallery={s,renderer,camera,models:[],clear(){for(const m of this.models){s.remove(m);disposeSceneObject(m);}this.models=[];},build(tier=1,faces=false){this.clear();const rows=[];for(const [i,job]of Object.keys(H.JOBS).entries())for(const [j,sex]of ['male','female'].entries()){
   const m=V.base(job,buildCharacter,'preview',sex),d=H.JOBS[job],kind=d.armor==='heavy'?'heavy_armor':d.armor==='robe'?'robe':'light_armor',helmet=d.armor==='heavy'?'heavy_helm':d.armor==='robe'?'rune_crown':'light_hood';
   const gear=(base,slot)=>({kind:H.tierKind(base,tier),slot,durability:50,maxDurability:50});
   V.dress(T,m,{armor:gear(kind,'armor'),weapon:gear(d.starter,'weapon'),helmet:gear(helmet,'helmet'),shield:d.armor==='heavy'?gear('round_shield','shield'):null},disposeSceneObject,{showHelmet:false});
   m.position.set((i-3)*2.36,j===0?2.95:0,0);m.rotation.y=.14;CharacterFace.update(m,.7,'calm');s.add(m);this.models.push(m);
   let triangles=0,meshes=0;const maps=new Set();m.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat?.map)maps.add(mat.map);}});rows.push({job,sex,tier,triangles,meshes,maps:maps.size,bytes:[...maps].reduce((n,t)=>n+t.image.width*t.image.height*4,0)});
  }renderer.render(s,camera);return rows;},close(){this.clear();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
 });
 for(const tier of [1,3,5]){const rows=await page.evaluate(t=>__marketGallery.build(t),tier);assert.equal(rows.length,14);assert.ok(rows.every(r=>r.triangles<13000&&r.meshes<100));report.art.push(...rows);await shot('characters-tier-'+tier);}
 // Tightly framed pairs expose skin, eyes, hair seams and armor ornaments.
 for(const job of ['swordsman','smith','mage','archer']){await page.evaluate(job=>{const g=__marketGallery;g.build(3);for(const m of g.models){m.visible=m.userData.heroJob===job;if(m.visible){m.position.set(m.userData.heroSex==='male'?-1.15:1.15,0,0);m.rotation.y=.12;}}g.camera.left=-2.4;g.camera.right=2.4;g.camera.top=2.6;g.camera.bottom=.55;g.camera.position.set(0,0,12);g.camera.lookAt(0,0,0);g.camera.updateProjectionMatrix();g.renderer.render(g.s,g.camera);},job);await shot('closeup-'+job);}
 const memory=await page.evaluate(()=>{const g=__marketGallery;Object.assign(g.camera,{left:-8.7,right:8.7,top:5.6,bottom:-.45});g.camera.position.set(0,0,18);g.camera.lookAt(0,0,0);g.camera.updateProjectionMatrix();for(let i=0;i<8;i++)g.build(i%2?5:1);const live={...g.renderer.info.memory};g.clear();g.renderer.render(g.s,g.camera);return {live,after:{...g.renderer.info.memory}};});
 if(!before){assert.equal(memory.after.textures,0,'textures must release after model disposal');assert.equal(memory.after.geometries,0,'geometry must release after model disposal');}report.memory=memory;await page.evaluate(()=>__marketGallery.close());
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#landscapeGate').isVisible());await shot('portrait-gate');
 assert.deepEqual(report.errors,[]);report.pass=true;await context.close();
}catch(e){report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,before,layouts:report.layouts.length,transactions:report.transactions.length,art:report.art.length,memory:report.memory,errors:report.errors,failure:report.failure}));}
