// Isolated browser fixtures only. Never modifies shipped source or real player saves.
// Run through tools/run-tower-party-qa.sh; no server is started by this file.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/crafting-qa',report={gates:[],cooked:[],forged:[],layouts:[],screenshots:[],errors:[],limitations:'Desktop Chrome touch emulation. Not a physical iPhone performance measurement.'};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`
  window.__craftingQA={
    load(floor=99){
      closeDialog();let n=Heroes.enable(P.enable(C.newRun({seed:43,name:'料理鍛造驗證'}),'mage','female').run).run;
      if(floor<0){n.floor=1;n.floorsCleared=99;n.status='won';n.chronicle=N.newChronicle(1);n.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);n.chronicle.ending='release';P.advance(n,{reward:false});const v=C.startUnderworld(n,n.revision);if(!v.ok)throw Error(v.message);n=v.run;n.floor=floor;n.floorsCleared=99+(-floor-1);n.adventure=E.newAdventure();n.expedition=TowerDungeons.newExpedition();n.claimed=[];n.defeatedMonsters=[];n.monsterStuns={};P.advance(n,{reward:false});}
      Object.keys(n.party.ingredients).forEach(k=>n.party.ingredients[k]=50);n.coins=5000;n.party.journey.scrap=99;Object.keys(n.party.journey.materials).forEach(k=>n.party.journey.materials[k]=50);
      if(!C.validateSave(n))throw Error('Invalid crafting fixture at '+floor);
      run=n;floorStarted=false;enter();closeDialog();G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});
      for(const m of monsters){m.alive=false;m.model.visible=false;}
      const camp=partyUI.reserved().find(s=>s.kind==='camp');if(!camp)throw Error('Missing real camp');G.px=camp.x;G.pz=camp.z;playerGroup.position.set(camp.x,0,camp.z);
      Heroes.setHp(run,'hero',10);run.hunger=G.satiety=20;updateHud();save();
      if(!partyUI.safeCamp())throw Error('Fixture is not at a safe camp');return this.state();
    },
    panel(kind){if(kind==='cook')partyUI.panel('cook');else partyUI.handle('party-forge');},
    state(){return {floor:run.floor,valid:!!C.validateSave(run),hp:Heroes.hp(run,'hero'),maxHp:Heroes.maxHp(run,'hero'),hunger:run.hunger,ingredients:{...run.party.ingredients},meals:{...run.party.meals},coins:run.coins,scrap:run.party.journey.scrap,materials:{...run.party.journey.materials},recipes:Object.keys(P.availableRecipes(run)),gear:TowerExpedition.allGear(run).map(g=>({id:g.id,kind:g.kind,slot:g.slot,forge:g.forge||null})),buffs:run.party.buffs.map(b=>({...b}))};},
    recipe(id){return {...P.RECIPES[id],cost:{...P.RECIPES[id].cost}};},
    quote(id,trait){return TowerExpedition.forgeQuote(run,id,trait);},
    resetHealth(){Heroes.setHp(run,'hero',10);run.hunger=G.satiety=20;save();},
    close(){closeDialog();G.frozen=true;},
    reopen(){open(true);},
    art(){
      return [...Object.keys(P.INGREDIENTS).map(key=>({type:'ingredient',key})),...Object.keys(TowerMaterials.MATERIALS).map(key=>({type:'material',key}))].map(({type,key})=>{
        const node=type==='ingredient'?partyUI.ingredientModel(key):partyUI.materialModel(key);let meshes=0,triangles=0;
        node.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
        const box=new THREE.Box3().setFromObject(node),size=box.getSize(new THREE.Vector3()).toArray();disposeSceneObject(node);return {type,key,meshes,triangles,size};
      });
    },
    sampleMaterial(){
      const id='monster-0',prefix=run.floor+':'+id,key='ironore';run.defeatedMonsters=[...new Set([...run.defeatedMonsters,id])];
      run.party.loot={version:1,rolled:[id],entries:[{id:prefix+':item',source:id,type:'material',key,quantity:2,rarity:'common',cx:0,cy:0}]};
      if(!C.validateSave(run))throw Error('Invalid material drop fixture');restoreDrops();const exists=loot.some(l=>l.id===prefix+':item'&&l.model.name==='combat-drop'),before=run.party.journey.materials[key];
      if(!transact(Loot.claim(run,prefix+':item',run.revision)))throw Error('Could not collect material');return {exists,before,after:run.party.journey.materials[key],valid:!!C.validateSave(run)};
    }
  };`;
  await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();
  async function shot(target,name){await target.screenshot({path:out+'/'+name+'.png'});report.screenshots.push(out+'/'+name+'.png');}
  async function layout(label){const b=await page.evaluate(()=>{const d=document.getElementById('towerDialog'),c=d.querySelector('.tower-dialog-content'),r=d.getBoundingClientRect();return {width:innerWidth,height:innerHeight,root:document.documentElement.scrollWidth,scroll:c.scrollWidth,client:c.clientWidth,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});assert.ok(b.root<=b.width+1&&b.scroll<=b.client+2,label+JSON.stringify(b));assert.ok(b.x>=-1&&b.y>=-1&&b.right<=b.width+1&&b.bottom<=b.height+1,label);report.layouts.push({label,...b});}
  for(const [floor,count,ids]of [[99,18,['trail_bread','honey_roast','crab_pot','herbal_platter','crystal_pudding','forest_roast','ember_skewer','frost_compote','copper_flatbread','heart_jam']],[-1,19,['root_banquet']],[-11,20,['mist_broth']],[-21,21,['ember_crab']],[-31,22,['ash_stew']],[-41,23,['gate_feast']]]){
    const state=await page.evaluate(f=>__craftingQA.load(f),floor);assert.ok(state.valid);assert.equal(state.recipes.length,count);await page.evaluate(()=>__craftingQA.panel('cook'));
    assert.equal(await page.locator('.party-recipe').count(),count);assert.deepEqual((await page.locator('[data-tower="party-cook"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item))).sort(),state.recipes.sort());
    await layout('cook '+floor);report.gates.push({floor,count});
    for(const id of ids){
      await page.evaluate(()=>__craftingQA.resetHealth());const recipe=await page.evaluate(id=>__craftingQA.recipe(id),id),before=await page.evaluate(()=>__craftingQA.state());
      const button=page.locator('[data-tower="party-cook"][data-item="'+id+'"]');assert.equal(await button.isDisabled(),false);await button.tap();
      const cooked=await page.evaluate(()=>__craftingQA.state());assert.ok(cooked.valid);assert.equal(cooked.meals[id],before.meals[id]+1);for(const [key,value]of Object.entries(recipe.cost))assert.equal(cooked.ingredients[key],before.ingredients[key]-value,id+' cost '+key);
      await page.locator('[data-tower="party-eat"][data-item="'+id+'"]').tap();const eaten=await page.evaluate(()=>__craftingQA.state());assert.ok(eaten.valid);assert.equal(eaten.meals[id],before.meals[id]);assert.equal(eaten.hp,Math.min(eaten.maxHp,10+recipe.hp));assert.equal(eaten.hunger,Math.min(100,20+recipe.hunger));if(recipe.buff)assert.ok(eaten.buffs.some(b=>b.id===recipe.buff&&b.floors===3));
      const exactIcon=await page.locator('.party-recipe').filter({has:page.locator('[data-item="'+id+'"][data-tower="party-cook"]')}).evaluate((article,key)=>{const t=document.createElement('template');t.innerHTML=TowerPartyRuntime.dishArt(key);return article.querySelector('svg')?.outerHTML===t.content.firstChild.outerHTML;},id);assert.ok(exactIcon,id+' must show exact game dish art');report.cooked.push({floor,id,cost:recipe.cost,hp:eaten.hp,hunger:eaten.hunger});
    }
    if(floor===99||floor===-41){await page.locator('[data-tower="party-cook"][data-item="'+ids.at(-1)+'"]').scrollIntoViewIfNeeded();await shot(page,'cook-'+(floor<0?'b'+-floor:'surface'));}
  }
  async function selectGear(slot){const state=await page.evaluate(()=>__craftingQA.state()),gear=state.gear.find(g=>g.slot===slot);assert.ok(gear,'fixture '+slot);await page.evaluate(()=>__craftingQA.panel('forge'));await page.locator('[data-tower="party-forge-select"][data-item="'+gear.id+'"]').tap();return gear;}
  async function forge(gear,trait){
    const before=await page.evaluate(()=>__craftingQA.state()),q=await page.evaluate(({id,trait})=>__craftingQA.quote(id,trait),{id:gear.id,trait});assert.ok(q.allowed&&q.affordable);
    const item=trait+'|'+gear.id,button=page.locator('[data-tower="party-forge-ask"][data-item="'+item+'"]');assert.equal(await button.isDisabled(),false);await button.tap();
    assert.deepEqual(await page.evaluate(()=>__craftingQA.state()),before,'opening confirmation must not consume ingredients');await layout('confirm '+trait);await page.locator('[data-tower="party-forge-confirm"][data-item="'+item+'"]').tap();
    const after=await page.evaluate(()=>__craftingQA.state());assert.ok(after.valid);assert.equal(after.scrap,before.scrap-q.parts);assert.equal(after.coins,before.coins-q.coins);for(const [key,amount]of Object.entries(q.materialCost))assert.equal(after.materials[key],before.materials[key]-amount);assert.deepEqual(after.gear.find(g=>g.id===gear.id).forge,{trait,level:q.level,reserve:trait==='durable'?q.level*2:0});report.forged.push({floor:after.floor,trait,level:q.level,parts:q.parts,coins:q.coins});
  }
  await page.evaluate(()=>__craftingQA.load(99));report.materialArt=await page.evaluate(()=>__craftingQA.art());assert.equal(report.materialArt.length,27);for(const a of report.materialArt){assert.ok(a.meshes>0&&a.meshes<30&&a.triangles<5000,a.key);assert.ok(a.size.every(n=>Number.isFinite(n)&&n>0),a.key);}report.materialPickup=await page.evaluate(()=>__craftingQA.sampleMaterial());assert.ok(report.materialPickup.exists&&report.materialPickup.valid);assert.equal(report.materialPickup.after,report.materialPickup.before+2);let weapon=await selectGear('weapon');assert.equal(await page.locator('[data-tower="party-forge-ask"][data-item="starvein|'+weapon.id+'"]').isDisabled(),true);
  let armor=await selectGear('armor');assert.equal(await page.locator('[data-tower="party-forge-ask"][data-item="abyssward|'+armor.id+'"]').isDisabled(),true);await forge(armor,'plated');await layout('surface forge');await shot(page,'forge-surface');
  await page.evaluate(()=>__craftingQA.load(-1));weapon=await selectGear('weapon');await forge(weapon,'starvein');await forge(weapon,'starvein');assert.equal(await page.locator('[data-tower="party-forge-ask"][data-item="starvein|'+weapon.id+'"]').isDisabled(),true);armor=await selectGear('armor');await forge(armor,'abyssward');await layout('underground forge');await shot(page,'forge-underground');
  const gameIcons=await page.locator('.party-forge-traits section').evaluateAll(sections=>sections.every(section=>{const key=section.querySelector('[data-tower="party-forge-ask"]').dataset.item.split('|')[0],t=document.createElement('template');t.innerHTML=TowerForgeIcons.svg(TowerExpedition.TRAITS[key].icon);return section.querySelector('svg')?.outerHTML===t.content.firstChild.outerHTML;}));assert.ok(gameIcons,'forge uses shared illustration provider');
  // Existing gameplay landscape-only rule is preserved, not bypassed by the new panels.
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#landscapeGate').isVisible(),true);await shot(page,'game-portrait-rotation-gate');await page.setViewportSize({width:844,height:390});assert.equal(await page.locator('#landscapeGate').isVisible(),false);await layout('landscape restored');
  const saved=await page.evaluate(()=>__craftingQA.state());await page.reload({waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();await page.evaluate(()=>__craftingQA.reopen());await page.locator('#towerDialog [data-tower="continue"]').tap();await page.evaluate(()=>__craftingQA.close());const loaded=await page.evaluate(()=>__craftingQA.state());assert.ok(loaded.valid);assert.deepEqual(loaded.gear,saved.gear);assert.deepEqual(loaded.meals,saved.meals);assert.deepEqual(loaded.ingredients,saved.ingredients);assert.deepEqual(loaded.materials,saved.materials);report.reload=true;
  const atlasContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),atlas=await atlasContext.newPage();atlas.setDefaultTimeout(12000);atlas.on('pageerror',e=>report.errors.push(e.stack));
  await atlas.goto('http://127.0.0.1:8795/docs/'+encodeURIComponent('職業裝備圖鑑.html'),{waitUntil:'networkidle'});await atlas.waitForSelector('html[data-atlas-ready="true"]');await atlas.locator('#categories [data-category="cooking"]').click();assert.equal(await atlas.locator('.entry').count(),23);
  const atlasIcons=await atlas.evaluate(()=>Object.entries(TowerPartyCore.RECIPES).every(([key,recipe])=>{const card=[...document.querySelectorAll('.entry')].find(c=>c.querySelector('h3').textContent===recipe.name),t=document.createElement('template');t.innerHTML=TowerPartyRuntime.dishArt(key);return !!card&&card.querySelector('.art svg')?.outerHTML===t.content.firstChild.outerHTML;}));assert.ok(atlasIcons,'all 23 atlas meals must reuse actual game art');
  await atlas.locator('#scope').selectOption('surface');assert.equal(await atlas.locator('.entry').count(),18);await atlas.locator('#scope').selectOption('underground');assert.equal(await atlas.locator('.entry').count(),5);await shot(atlas,'atlas-underground-meals-portrait');
  await atlas.locator('#scope').selectOption('');await atlas.locator('#categories [data-category="forging"]').click();assert.equal(await atlas.locator('.entry').count(),7);
  const atlasForgeIcons=await atlas.evaluate(()=>Object.values(TowerExpedition.TRAITS).every(trait=>{const card=[...document.querySelectorAll('.entry')].find(c=>c.querySelector('h3').textContent===trait.name),t=document.createElement('template');t.innerHTML=TowerForgeIcons.svg(trait.icon);return !!card&&card.querySelector('.art svg')?.outerHTML===t.content.firstChild.outerHTML;}));assert.ok(atlasForgeIcons,'all atlas forge traits must reuse actual game art');
  assert.ok(await atlas.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await atlas.evaluate(()=>localStorage.length),0,'atlas must not write player saves');assert.equal(await atlas.evaluate(()=>typeof THREE),'undefined');await shot(atlas,'atlas-forging-portrait');report.atlas={recipes:23,surface:18,underground:5,forging:7,exactIcons:true,noGameEngine:true};
  assert.deepEqual(report.errors,[]);report.pass=true;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,gates:report.gates,cooked:report.cooked.length,forged:report.forged.length,layouts:report.layouts.length,atlas:report.atlas,screenshots:report.screenshots}));
}catch(e){report.failure=e.stack;await writeFile(out+'/report.json',JSON.stringify(report,null,2));throw e;}finally{await browser.close();}
