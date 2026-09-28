// Real browser input, no modified production responses or private test bridge.
// Uses a new disposable browser profile: only local saves, never account data.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795',production=base==='https://3d-moving-maze.pages.dev';
if(!production&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Unapproved QA URL');
const out='.agent-run/objective-qa',prefix=production?'production':'local',assets=[];
if(process.env.MAZE_RELEASE_ROOT){
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const file of ['index.html','assets/game-polish.css','story/tower-mode.js','story/tower-party-core.js','story/tower-party-runtime.js']){
    const response=await fetch(base+'/'+file,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),sha256=hash(bytes);assert.equal(sha256,hash(await readFile(process.env.MAZE_RELEASE_ROOT+'/'+file)),file);assets.push({file,sha256});
  }
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="new"]').tap();await page.locator('#playerName').fill('提示驗證旅人');await page.locator('#profileNextBtn').tap();
  await page.locator('[data-tower="profession"][data-item="mage"]').tap();
  const hint=page.locator('#towerObjective'),control=page.locator('#hudRoundControl');
  assert.equal(await hint.isVisible(),false,'opening reader must not consume preview');
  await page.locator('#towerDialog button[data-tower="close"]').first().tap();
  const started=Date.now();assert.equal(await hint.isVisible(),true);assert.match(await hint.innerText(),/召喚陣.*聲音.*95.*回聲銅扣/);
  await hint.waitFor({state:'hidden',timeout:9000});const previewMs=Date.now()-started;assert.ok(previewMs>=2700&&previewMs<8000,String(previewMs));
  await mkdir(out,{recursive:true});await page.screenshot({path:out+'/'+prefix+'-hidden.png'});
  const cdp=await page.context().newCDPSession(page);
  const point=async()=>{const b=await control.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,id:8};};
  const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  let p=await point();await touch('touchStart',[p]);assert.equal(await hint.isVisible(),true);assert.match(await hint.innerText(),/回聲銅扣/);
  const yaw=await page.evaluate(()=>G.camYaw);await touch('touchMove',[{...p,x:p.x+40,y:p.y+55}]);assert.equal(await hint.isVisible(),true);assert.equal(await page.evaluate(()=>G.camYaw),yaw);
  await page.screenshot({path:out+'/'+prefix+'-held.png'});await touch('touchEnd',[]);assert.equal(await hint.isVisible(),false);
  await touch('touchStart',[p]);assert.equal(await hint.isVisible(),true);await touch('touchCancel',[]);assert.equal(await hint.isVisible(),false);
  // Hold the label with a second finger while the movement joystick is active.
  const move={x:80,y:270,id:1};await touch('touchStart',[move]);await touch('touchMove',[{...move,x:105}]);assert.equal(await page.evaluate(()=>joy.active),true);
  await touch('touchStart',[{...move,x:105},p]);assert.equal(await hint.isVisible(),true);assert.equal(await page.evaluate(()=>joy.active),true);
  await touch('touchEnd',[{...move,x:105}]);assert.equal(await hint.isVisible(),true);await touch('touchEnd',[]);assert.equal(await hint.isVisible(),false);
  // Mouse capture releases outside the button. Keyboard hold must not swing tools.
  await page.mouse.move(p.x,p.y);await page.mouse.down();assert.equal(await hint.isVisible(),true);await page.mouse.move(500,220);await page.mouse.up();assert.equal(await hint.isVisible(),false);
  await control.focus();const toolsBefore=await page.evaluate(()=>G.shovels);await page.keyboard.down('Space');assert.equal(await hint.isVisible(),true);await page.keyboard.up('Space');assert.equal(await hint.isVisible(),false);assert.equal(await page.evaluate(()=>G.shovels),toolsBefore);
  await page.keyboard.down('Enter');assert.equal(await hint.isVisible(),true);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await hint.isVisible(),false);await page.keyboard.up('Enter');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await hint.isVisible(),false);
  // Opening another panel cancels a held peek. Closing it must not retrigger it.
  await control.focus();await page.keyboard.down('Space');await page.keyboard.press('KeyB');assert.equal(await hint.isVisible(),false);await page.keyboard.up('Space');
  await page.locator('#towerDialog button[data-tower="close"]').first().tap();assert.equal(await hint.isVisible(),false);
  const layouts=[];
  for(const viewport of [{width:667,height:375},{width:844,height:390},{width:1280,height:800}]){
    await page.setViewportSize(viewport);const b=await control.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width&&b.y+b.height<=viewport.height,JSON.stringify(b));
    p=await point();await touch('touchStart',[p]);assert.equal(await hint.isVisible(),true);await touch('touchEnd',[]);assert.equal(await hint.isVisible(),false);layouts.push({viewport,bounds:b});
  }
  await page.evaluate(()=>TowerMode.requestQuit());await page.locator('[data-tower="home"]').tap();assert.equal(await control.isDisabled(),true);assert.equal(await control.getAttribute('role'),null);
  await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await page.locator('#towerDialog button[data-tower="close"]').first().tap();assert.equal(await hint.isVisible(),true);await hint.waitFor({state:'hidden',timeout:9000});
  // Load a valid, isolated older save whose floor offers the healer already in
  // the party. Verify the actual rendered scene, not only the core offer rule.
  await page.evaluate(()=>TowerMode.requestQuit());await page.locator('[data-tower="home"]').tap();
  const identityFixture=await page.evaluate(()=>{
    const C=TowerCore,P=TowerPartyCore;let run=null;
    for(let seed=1;seed<=1000;seed++){
      const trial=P.enable(C.newRun({seed,name:'角色驗證旅人'}),'swordsman').run;
      for(let floor=98;floor>=96;floor--)Object.assign(trial,C.descend(trial).run);
      if(P.recruitOffer(trial)?.profession==='healer'){run=trial;break;}
    }
    if(!run)throw Error('Missing healer duplicate fixture');
    const id='companion:earlier:healer';run.party.members=[{id,profession:'healer',level:1,hp:34,cooldown:0,hurtLeft:0}];run.party.joined=[id];
    const save=C.validateSave(run);if(!save)throw Error('Invalid identity fixture');
    localStorage.setItem('maze3d_tower_v1',JSON.stringify(save));return {seed:save.seed,floor:save.floor,id};
  });
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await page.locator('[data-tower="continue"]').tap();await page.locator('#towerDialog button[data-tower="close"]').first().tap();
  await page.setViewportSize({width:844,height:390});
  const identity=await page.evaluate(()=>{
    const models=[];scene.traverse(o=>{if(o.name==='tower-explorer-mira'&&o.children.some(c=>c.name==='profession-mantle'))models.push({name:o.name,id:o.userData.companionId||null});});
    G.view='top';G.topZoom=12;updateCamera(1);renderer.render(scene,camera);
    return {models,save:JSON.parse(localStorage.getItem('maze3d_tower_v1')).party.members};
  });
  assert.equal(identity.models.length,1,'one named healer in the rendered scene');assert.equal(identity.models[0].id,identityFixture.id);assert.equal(identity.save.length,1);
  await page.screenshot({path:out+'/'+prefix+'-unique-healer.png'});
  assert.deepEqual(errors,[]);
  const result={ok:true,url:base,version:await page.locator('#splashVersion').innerText(),previewMs,actualTouch:true,secondFinger:true,releaseOutside:true,cancel:true,keyboard:true,blur:true,dialog:true,reentry:true,uniqueHealer:{...identityFixture,...identity},layouts,assets,errors};
  await writeFile(out+'/'+prefix+'-readback.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
