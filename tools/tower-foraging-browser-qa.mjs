// Isolated browser fixtures; drive the real floor build, proximity pickup and camp UI.
// Run through tools/run-tower-party-qa.sh. This file never starts a server.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/foraging-qa',report={regions:[],pickups:[],layouts:[],dom:[],screenshots:[],errors:[],limitations:'Desktop Chrome touch emulation, not physical phone performance. Isolated fixtures position the real player; resources are claimed through the actual proximity update and camp maintenance through the actual UI button. Resource screenshots use the real first-person camera after a real tick initializes lighting.'};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
try{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>report.errors.push(error.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`
  window.__foragingQA={
    load({floor=89,seed:requestedSeed=null,maximum=false}={}){
      closeDialog();let seed=requestedSeed;
      if(seed===null){for(seed=1;seed<=5000;seed++){const count=Foraging.counts({floor,seed});if(maximum?count.herb===3&&count.ore===3:count.herb>0&&count.ore>0)break;}if(seed>5000)throw Error('No finite forage fixture');}
      let n=Heroes.enable(P.enable(C.newRun({seed,name:'牆角採集驗證'}),'mage','female').run).run;
      if(floor<0){n.floor=1;n.floorsCleared=99;n.status='won';n.chronicle=N.newChronicle(1);n.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);n.chronicle.ending='release';P.advance(n,{reward:false});const v=C.startUnderworld(n,n.revision);if(!v.ok)throw Error(v.message);n=v.run;}
      n.floor=floor;n.floorsCleared=floor<0?99-floor-1:99-floor;n.chronicle=N.newChronicle(floor);if(floor<0)n.chronicle.ending=n.underworld.surfaceEnding;
      n.adventure=E.newAdventure();n.expedition=D.newExpedition();n.claimed=[];n.defeatedMonsters=[];n.monsterStuns={};P.advance(n,{reward:false});
      n.party.ingredients.herb=0;Object.keys(n.party.journey.materials).forEach(key=>n.party.journey.materials[key]=0);n.coins=1000;
      const daylight=TowerLighting.daylight(n,n.revision);if(!daylight.ok)throw Error(daylight.message);n=daylight.run;
      for(const gear of TowerExpedition.allGear(n))gear.durability=Math.max(1,Math.floor(gear.maxDurability*.4));
      if(!C.validateSave(n))throw Error('Invalid forage fixture '+floor);
      run=n;floorStarted=false;enter();closeDialog();G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});this.peace();save();return this.state();
    },
    peace(){for(const monster of monsters){monster.alive=false;monster.model.visible=false;}},
    locate(point){G.px=point.x;G.pz=point.z;playerGroup.position.set(point.x,0,point.z);G.heading=playerGroup.rotation.y=0;G.camYaw=.6;G.camPitch=.4;G.view='tp';G.frozen=true;updateHud();},
    focus(id){
      closeDialog();this.peace();const item=loot.find(item=>item.foraging&&item.id===id&&item.model.visible);if(!item)throw Error('Forage missing '+id);
      this.locate(cellPoint(item.cx,item.cy));const target=new THREE.Box3().setFromObject(item.model).getCenter(new THREE.Vector3()),dx=target.x-G.px,dz=target.z-G.pz,distance=Math.hypot(dx,dz);
      G.view='fp';G.heading=playerGroup.rotation.y=Math.atan2(dx,dz);G.camYaw=G.heading-Math.PI;G.camPitch=(target.y-1.6)/(Math.max(.1,distance)*3.2);
      G.frozen=false;updatePlayer(0,performance.now()/1000);tick(.016,performance.now());G.frozen=true;updateCamera(1);renderer.render(scene,camera);
      const projected=target.clone().project(camera);this.focusEvidence={id,distance,target:target.toArray(),camera:camera.position.toArray(),projected:projected.toArray(),clear:hasClearPath(G.px,G.pz,target.x,target.z)};return this.state();
    },
    collect(id){closeDialog();this.peace();const item=loot.find(item=>item.foraging&&item.id===id&&item.model.visible);if(!item)throw Error('Forage missing '+id);item.retry=0;this.locate(item);G.frozen=false;tick(.016,performance.now());G.frozen=true;return this.state();},
    stock(id,quantity){const item=loot.find(item=>item.foraging&&item.id===id);if(!item)throw Error('Forage missing '+id);const stock=item.foraging.type==='ingredient'?run.party.ingredients:run.party.journey.materials;stock[item.foraging.key]=quantity;save();},
    state(){
      const occupied=[...traders,...dungeonObjects,...hazards,...(partyUI?.reserved()||[]),...(lightingUI?.reserved()||[]),...[warriorNpc,explorer,chest,relic,mainClue,rift].filter(Boolean),...loot.filter(item=>!item.foraging)].map(item=>item.cx+','+item.cy);
      return {floor:run.floor,seed:run.seed,valid:!!C.validateSave(run),counts:Foraging.counts(run),specs:Foraging.specs(run),receipt:structuredClone(run.party.foraging),ingredients:{...run.party.ingredients},materials:{...run.party.journey.materials},coins:run.coins,shifting:G.shifting||wasShifting,maintenance:P.campMaintenanceQuote(run),gear:TowerExpedition.allGear(run).map(gear=>({id:gear.id,durability:gear.durability,maxDurability:gear.maxDurability})),occupied,focus:this.focusEvidence,
        objects:loot.filter(item=>item.foraging&&item.model.visible).map(item=>{const center=cellPoint(item.cx,item.cy),offsetX=(item.x-center.x)/G.cell,offsetY=(item.z-center.z)/G.cell,walls=Foraging.wallsAt(item.cx,item.cy,G.mazeW,G.mazeH,G.hWalls,G.vWalls),sides=[offsetX<0?3:1,offsetY<0?0:2];let meshes=0,triangles=0,lights=0;item.model.traverse(object=>{if(object.isLight)lights++;if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;}});return {id:item.id,key:item.foraging.key,kind:item.foraging.kind,type:item.foraging.type,quantity:item.foraging.quantity,cx:item.cx,cy:item.cy,x:item.x,z:item.z,offsetX,offsetY,support:sides.filter(side=>walls[side]),inWall:playerInWall(item.x,item.z,.35),meshes,triangles,lights,name:item.model.name};})};
    },
    shift(){closeDialog();this.peace();G.frozen=false;wasShifting=true;doShift();},
    freeze(){G.frozen=true;this.peace();save();return this.state();},
    next(){closeDialog();syncEngine();const result=C.descend(run,run.revision);if(!result.ok)throw Error(result.message);run=result.run;floorStarted=false;enter();closeDialog();G.frozen=true;this.peace();save();return this.state();},
    kitchen(){closeDialog();this.peace();const camp=partyUI.reserved().find(point=>point.kind==='camp');if(!camp)throw Error('Camp missing');this.locate(camp);if(!partyUI.safeCamp())throw Error('Unsafe test camp');partyUI.panel('cook');return this.state();},
    close(){closeDialog();G.frozen=true;this.peace();save();return this.state();}
  };`;
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',route=>route.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.route('**/api/scores*',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  const state=()=>page.evaluate(()=>__foragingQA.state());
  const load=options=>page.evaluate(options=>__foragingQA.load(options),options);
  const shot=async name=>{
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForTimeout(120);
    const dom=await page.evaluate(()=>{
      const rect=node=>{const box=node.getBoundingClientRect(),style=getComputedStyle(node);return {left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height,display:style.display,visibility:style.visibility,hidden:node.hidden,visible:box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&!node.closest('[hidden]')};};
      const overlays=[...document.querySelectorAll('#towerOverlay')].map(rect),dialogs=[...document.querySelectorAll('#towerDialog')].map(rect),titles=[...document.querySelectorAll('#towerDialogTitle')].map(node=>({text:node.textContent,...rect(node)}));
      return {overlays,dialogs,titles,headings:[...document.querySelectorAll('h2')].filter(node=>rect(node).visible).map(node=>({text:node.textContent,...rect(node)})),drawingBuffer:{width:renderer.domElement.width,height:renderer.domElement.height},viewport:{width:innerWidth,height:innerHeight},focus:__foragingQA.state().focus};
    });
    assert.equal(dom.overlays.length,1,name+' unique overlay');assert.equal(dom.dialogs.length,1,name+' unique dialog');assert.equal(dom.titles.length,1,name+' unique title');
    assert.ok(dom.titles.filter(title=>title.visible).length<=1,name+' no duplicated visible title');
    report.dom.push({name,...dom});const path=out+'/'+name+'.png';await page.screenshot({path});report.screenshots.push(path);
  };
  const button=key=>page.locator('[data-tower="'+key+'"]');
  async function resume(){await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await button('continue').tap();return page.evaluate(()=>__foragingQA.close());}
  function placement(actual,label){
    assert.ok(actual.valid,label+' valid save');assert.equal(actual.objects.length,actual.specs.length,label+' complete visible build');
    assert.equal(new Set(actual.objects.map(object=>object.id)).size,actual.objects.length);
    for(const object of actual.objects){
      assert.equal(object.quantity,1);assert.equal(object.inWall,false,object.id+' intersects wall');assert.ok(object.support.length>0,object.id+' needs a real adjacent wall');
      assert.ok(Math.abs(Math.abs(object.offsetX)-.3)<1e-6&&Math.abs(Math.abs(object.offsetY)-.3)<1e-6,object.id+' floor-corner offset');
      assert.equal(actual.occupied.includes(object.cx+','+object.cy),false,object.id+' overlaps NPC/site/hazard');
      assert.equal(object.lights,0);assert.ok(object.meshes>0&&object.meshes<30&&object.triangles<5000,object.id+' bounded shared resource art');
      assert.equal(object.name,'floor-'+object.kind);
    }
  }
  async function layout(label){const actual=await page.evaluate(()=>{const panel=document.getElementById('towerDialog'),content=panel.querySelector('.tower-dialog-content'),box=panel.getBoundingClientRect();return {width:innerWidth,height:innerHeight,root:document.documentElement.scrollWidth,scroll:content.scrollWidth,client:content.clientWidth,left:box.left,top:box.top,right:box.right,bottom:box.bottom};});assert.ok(actual.root<=actual.width+1&&actual.scroll<=actual.client+2,label);assert.ok(actual.left>=-1&&actual.top>=-1&&actual.right<=actual.width+1&&actual.bottom<=actual.height+1,label);report.layouts.push({label,...actual});}
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();
  for(const floor of [99,89,79,69,59,49,39,29,19,9,-1,-11,-21,-31,-41]){
    const actual=await load({floor});placement(actual,'floor '+floor);assert.equal(actual.objects.filter(object=>object.kind==='herb').length,actual.counts.herb);assert.equal(actual.objects.filter(object=>object.kind==='ore').length,actual.counts.ore);
    if(floor>0)assert.ok(actual.objects.filter(object=>object.kind==='ore').every(object=>object.key!=='starore'));
    report.regions.push({floor,seed:actual.seed,counts:actual.counts,objects:actual.objects});
  }
  let actual=await load({floor:89,maximum:true});assert.deepEqual(actual.counts,{herb:3,ore:3});placement(actual,'six resources');
  const herb=actual.objects.find(object=>object.kind==='herb'),ore=actual.objects.find(object=>object.kind==='ore');
  await page.evaluate(id=>__foragingQA.focus(id),herb.id);await page.waitForTimeout(250);await shot('garden-herb-wall-corner');
  for(const object of [herb,ore]){
    const before=await state(),after=await page.evaluate(id=>__foragingQA.collect(id),object.id),stock=object.type==='ingredient'?'ingredients':'materials';
    assert.equal(after[stock][object.key],before[stock][object.key]+1);assert.equal(after.objects.length,before.objects.length-1);assert.ok(after.receipt.claimed.includes(object.id));assert.ok(!after.objects.some(item=>item.id===object.id));assert.ok(after.valid);report.pickups.push({kind:object.kind,key:object.key,quantity:1,id:object.id});
  }
  const fullObject=(await state()).objects.find(object=>object.kind==='herb');await page.evaluate(id=>__foragingQA.stock(id,99),fullObject.id);
  const fullBefore=await state(),fullAfter=await page.evaluate(id=>__foragingQA.collect(id),fullObject.id);assert.deepEqual(fullAfter.receipt,fullBefore.receipt);assert.equal(fullAfter.ingredients.herb,99);assert.ok(fullAfter.objects.some(object=>object.id===fullObject.id));report.fullStackPreserved=true;
  await page.evaluate(id=>__foragingQA.stock(id,98),fullObject.id);actual=await page.evaluate(id=>__foragingQA.collect(id),fullObject.id);assert.equal(actual.ingredients.herb,99);assert.ok(actual.receipt.claimed.includes(fullObject.id));
  const saved=await state(),reloaded=await resume();placement(reloaded,'reload');assert.deepEqual(reloaded.receipt,saved.receipt);assert.deepEqual(reloaded.ingredients,saved.ingredients);assert.deepEqual(reloaded.materials,saved.materials);assert.deepEqual(reloaded.objects.map(object=>object.id).sort(),saved.objects.map(object=>object.id).sort());report.reload=true;
  await page.evaluate(()=>__foragingQA.shift());await page.waitForFunction(()=>!__foragingQA.state().shifting);actual=await page.evaluate(()=>__foragingQA.freeze());placement(actual,'real shift');assert.deepEqual(actual.receipt,saved.receipt);assert.deepEqual(actual.counts,saved.counts);assert.deepEqual(actual.objects.map(object=>object.id).sort(),saved.objects.map(object=>object.id).sort());report.realShift=true;
  actual=await page.evaluate(()=>__foragingQA.next());assert.equal(actual.floor,88);assert.deepEqual(actual.receipt.claimed,[]);placement(actual,'new floor');assert.ok(actual.objects.every(object=>object.id.startsWith('foraging:88:')));report.newFloor={floor:actual.floor,counts:actual.counts};
  await load({floor:89});const beforeCamp=await page.evaluate(()=>__foragingQA.kitchen());assert.equal(beforeCamp.maintenance.ratio,.1);assert.equal(beforeCamp.maintenance.cost,6);assert.match(await page.locator('.camp-service-strip').innerText(),/耐久\s*\+10%/);assert.equal(await button('party-repair').isDisabled(),false);
  await button('party-repair').tap();const afterCamp=await state();assert.equal(afterCamp.coins,beforeCamp.coins-6);assert.ok(afterCamp.maintenance.used);assert.equal(await button('party-repair').isDisabled(),true);
  for(const gear of beforeCamp.gear){const repaired=afterCamp.gear.find(item=>item.id===gear.id);assert.equal(repaired.durability,Math.min(gear.maxDurability,gear.durability+Math.ceil(gear.maxDurability*.1)),gear.id+' exactly ten percent');}
  report.maintenance={ratio:.1,cost:6,oncePerFloor:true,gear:afterCamp.gear};
  for(const [width,height] of [[844,390],[568,320],[1280,720]]){await page.setViewportSize({width,height});await page.evaluate(()=>__foragingQA.kitchen());await layout('camp ten percent '+width);await shot(width+'-camp-ten-percent');await page.evaluate(()=>__foragingQA.close());const object=(await state()).objects[0];if(object){await page.evaluate(id=>__foragingQA.focus(id),object.id);await page.waitForTimeout(200);await shot(width+'-wall-resources');}}
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#landscapeGate').isVisible(),true);await shot('portrait-rotation-gate');report.portraitGate=true;
  assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,failure:report.failure,regions:report.regions.length,pickups:report.pickups,maintenance:report.maintenance,reload:report.reload,realShift:report.realShift,newFloor:report.newFloor,errors:report.errors,screenshots:report.screenshots}));}
