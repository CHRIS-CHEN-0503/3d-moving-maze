// Isolated saves and a test-only bridge. Never writes a player's storage.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fixture,Co} from '../tests/tower-cooperation-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/cooperation-qa';await mkdir(out,{recursive:true});
const report={casts:[],layouts:[],cancellations:[],errors:[],limitations:'Desktop Chrome touch emulation, not a physical iPhone performance claim.'};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`window.__cooperationQA={
    load(value,key){closeDialog();run=value;floorStarted=false;enter();closeDialog();G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});partyUI.heroes.tick(0);
      const d=TowerCooperation.DEFINITIONS.find(d=>d.id===key),ids=Heroes.ids(run),center={x:G.px,z:G.pz},models={hero:playerGroup};scene.traverse(o=>{if(o.userData.companionId)models[o.userData.companionId]=o;});
      const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:center.x+i*.2,z:center.z}]));
      if(d.formation.kind==='front'){for(const id of ids)positions[id]={x:center.x,z:center.z-.25};positions[ids[d.formation.front]]={x:center.x,z:center.z+.4};}
      if(d.formation.kind==='pincer'){positions[ids[0]]={x:center.x-.55,z:center.z+.7};positions[ids[1]]={x:center.x+.55,z:center.z+.7};}
      for(const id of ids){const p=positions[id];if(!models[id])throw Error('missing actor '+id);models[id].position.set(p.x,0,p.z);models[id].rotation.y=0;TowerHeroGrowth.state(run).policies[id].strategy='manual';if(id===Heroes.state(run).active){G.px=p.x;G.pz=p.z;}}
      const m=monsters.find(m=>m.alive);if(!m)throw Error('no target');m.model.position.set(center.x,0,center.z+(d.formation.kind==='pincer'?.7:1.1));m.model.rotation.y=Math.PI;this.target=m.id;this.key=key;this.before=JSON.stringify(run);this.beforeHp=run.party.health[m.id]??P.monsterSpecs(run).find(v=>v.id===m.id).maxHp;this.ids=ids;this.sounds=[];const sounds=this.sounds;AudioEng.sfxAction=kind=>{sounds.push(kind);return ()=>{};};G.view='third';G.camPitch=.5;G.camYaw=2.4;updateCamera(1);renderMaze();partyUI.heroes.hud(true);return this.state();
    },
    tick(){for(let i=0;i<16;i++)partyUI.heroes.tick(.1);partyUI.heroes.hud(true);return this.state();},
    move(){G.px+=1;playerGroup.position.x=G.px;partyUI.heroes.tick(.1);return this.state();},
    pause(){paused=true;partyUI.heroes.hud(true);return this.state();},
    state(){return {valid:!!C.validateSave(run),unchanged:JSON.stringify(run)===this.before,preparing:this.ids?.map(id=>partyUI.heroes.cooperating(id)),hp:run.defeatedMonsters.includes(this.target)?0:run.party.health[this.target]??this.beforeHp,beforeHp:this.beforeHp,arrow:run.bag.arrow,cooldowns:this.ids?.map(id=>Heroes.actor(run,id).cooldowns),buffs:this.ids?.map(id=>Heroes.actor(run,id).buffs),sounds:this.sounds,fx:partyUI.heroes.effectStats(),raw:JSON.stringify(run)};}
  };`;
  await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();
  async function load(key){const f=fixture(key,true);await page.evaluate(({run,key})=>__cooperationQA.load(run,key),{run:f.run,key});const button=page.locator('[data-cooperation="'+key+'"]');assert.equal(await button.count(),1,'eligible '+key);return {f,button};}
  for(const d of Co.DEFINITIONS){const {f,button}=await load(d.id);await button.tap();const pending=await page.evaluate(()=>__cooperationQA.state());assert.ok(pending.unchanged);assert.ok(pending.preparing.every(Boolean));const after=await page.evaluate(()=>__cooperationQA.tick());assert.ok(after.valid,d.id);assert.ok(after.preparing.every(v=>!v));assert.ok(after.sounds.length>=d.participants.length*2);assert.ok(after.fx.groups>0&&after.fx.groups<=12&&after.fx.meshes<=96);if(d.effect.attack)assert.ok(after.hp<after.beforeHp,d.id+' did not damage target');if(d.effect.shieldPercent)assert.ok(after.buffs.every(list=>list.some(b=>b.id==='barrier')));assert.equal(after.arrow,f.run.bag.arrow-d.costs.arrows);report.casts.push({id:d.id,hp:after.hp,beforeHp:after.beforeHp,sounds:after.sounds,fx:after.fx});}
  for(const [width,height]of [[568,320],[844,390],[1024,768]]){await page.setViewportSize({width,height});await load('dawn_breach');const layout=await page.evaluate(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {coop:box('heroCooperationBar'),dock:box('battleDock'),side:box('hudRightBtns'),scroll:document.documentElement.scrollWidth};});assert.ok(layout.scroll<=width+1);assert.ok(layout.coop.left>=0&&layout.coop.right<=width&&layout.coop.top>=0&&layout.coop.bottom<layout.dock.top,JSON.stringify(layout));assert.ok(layout.coop.right<=layout.side.left-1,JSON.stringify(layout));report.layouts.push({width,height,...layout});await page.screenshot({path:out+'/'+width+'-cooperation.png'});}
  for(const action of ['move','pause']){const {button}=await load('cross_hunt');await button.tap();const after=await page.evaluate(action=>__cooperationQA[action](),action);assert.ok(after.preparing.every(v=>!v));assert.ok(after.unchanged);report.cancellations.push(action);}
  assert.deepEqual(report.errors,[]);report.pass=true;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,casts:report.casts.length,layouts:report.layouts.length,cancellations:report.cancellations}));
}catch(e){report.failure=e.stack;await writeFile(out+'/report.json',JSON.stringify(report,null,2));throw e;}finally{await browser.close();}
