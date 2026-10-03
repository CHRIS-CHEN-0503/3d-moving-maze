// Isolated browser fixtures only; never writes player saves or deployed services.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const combatOnly=process.env.CAMP_QA_COMBAT_ONLY==='1',out='.agent-run/'+(combatOnly?'camp-services-combat-qa':'camp-services-qa'),report={recipes:[],maintenance:[],merchants:[],layouts:[],screenshots:[],errors:[],limitations:'Desktop Chrome with touch emulation, not physical iPhone performance. Fixtures provide inventory and safely position actors; service mutations are verified through actual UI buttons. Scout motion preview renders the real player model after real attack input at exact animation peaks.'};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
try{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`
  window.__campQA={
    load({job='mage',members=[],floor=99,merchant=null,seed:requestedSeed=43}={}){
      closeDialog();let seed=requestedSeed;
      if(merchant){for(seed=1;seed<1000;seed++)if(E.merchantOffers(floor,seed,true).some(m=>m.id===merchant))break;}
      let n=Heroes.enable(P.enable(C.newRun({seed,name:'營地服務驗證'}),job,'female').run).run;
      if(floor<0){n.floor=1;n.floorsCleared=99;n.status='won';n.chronicle=N.newChronicle(1);n.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);n.chronicle.ending='release';P.advance(n,{reward:false});const v=C.startUnderworld(n,n.revision);if(!v.ok)throw Error(v.message);n=v.run;n.floor=floor;n.floorsCleared=99+(-floor-1);n.adventure=E.newAdventure();n.expedition=TowerDungeons.newExpedition();n.claimed=[];n.defeatedMonsters=[];n.monsterStuns={};P.advance(n,{reward:false});}
      if(members.length){Heroes.gainXp(n,TowerHeroGrowth.XP[2]);for(const profession of members){const m={id:'qa-'+profession,profession,sex:'male',level:1,hp:34,cooldown:0,hurtLeft:0};n.party.members.push(m);n.party.joined.push(m.id);Heroes.addMember(n,m);}}
      Object.keys(n.party.ingredients).forEach(k=>n.party.ingredients[k]=50);n.coins=5000;n.party.journey.scrap=99;Object.keys(n.party.journey.materials).forEach(k=>n.party.journey.materials[k]=50);
      n.gearBag=Object.values(Heroes.GEAR).filter(g=>g.tier===1).map(g=>C.createGear(g.kind,n.floor,n.seed,'qa-bag-'+g.kind));
      for(const g of TowerExpedition.allGear(n))g.durability=Math.max(1,Math.floor(g.maxDurability*.4));
      n.equipment.helmet.durability=0;n.party.meals.feast=1;Heroes.setHp(n,'hero',10);n.hunger=20;
      if(!C.validateSave(n))throw Error('Invalid camp fixture '+JSON.stringify({job,members,floor,merchant}));
      run=n;floorStarted=false;enter();closeDialog();G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});this.peace();this.camp();save();return this.state();
    },
    peace(){for(const m of monsters){m.alive=false;m.model.visible=false;}},
    locate(p){G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);partyUI.tick(0,performance.now());updateHud();G.frozen=true;},
    camp(){closeDialog();this.peace();const p=partyUI.reserved().find(s=>s.kind==='camp');if(!p)throw Error('Camp missing');this.locate(p);if(!partyUI.safeCamp())throw Error('Camp not safe');},
    kitchen(){partyUI.panel('cook');},
    forge(){partyUI.handle('party-forge');},
    shop(id){closeDialog();this.peace();const t=traders.find(t=>t.id===id);if(!t)throw Error('Merchant missing '+id);this.locate(t);nearest=t;nearestWarrior=nearbyJourney=nearbyEncounter=null;trade();},
    away(){G.px+=15;playerGroup.position.x=G.px;},
    arrows(n){run.bag.arrow=n;save();},
    quote(id,trait,merchant=null){const service=merchant?E.serviceContext(run,merchant):undefined;return trait?TowerExpedition.forgeQuote(run,id,trait,service):TowerExpedition.repairQuote(run,id,service);},
    quoteAll(merchant){return TowerExpedition.repairAllQuote(run,E.serviceContext(run,merchant));},
    state(){return {floor:run.floor,valid:!!C.validateSave(run),coins:run.coins,scrap:run.party.journey.scrap,materials:{...run.party.journey.materials},hp:Heroes.hp(run,'hero'),maxHp:Heroes.maxHp(run,'hero'),meals:{...run.party.meals},ingredients:{...run.party.ingredients},arrows:run.bag.arrow,maintenance:P.campMaintenanceQuote(run),shifting:G.shifting,autoAim,storedAim:localStorage.getItem(AUTO_AIM_SETTING),gear:TowerExpedition.allGear(run).map(g=>({id:g.id,kind:g.kind,slot:g.slot,durability:g.durability,maxDurability:g.maxDurability,forge:g.forge||null})),worn:Heroes.ids(run).flatMap(id=>Object.values(Heroes.equipment(run,id)).filter(Boolean).map(g=>g.id)),recipes:Object.keys(P.availableRecipes(run))};},
    eligible(id){return TowerExpedition.allGear(run).filter(g=>E.serviceAvailable(run,E.serviceContext(run,id),g)).map(g=>g.id);},
    shift(){closeDialog();G.frozen=false;wasShifting=true;doShift();},
    next(){closeDialog();syncEngine();const v=C.descend(run,run.revision);if(!v.ok)throw Error(v.message);run=v.run;floorStarted=false;enter();closeDialog();G.frozen=true;this.peace();this.camp();save();},
    freeze(){G.frozen=true;this.peace();},
    combat({job='mage',wall=false,skill=false}={}){
      this.load({job,seed:skill?3:43});closeDialog();this.peace();run.party.light.daylight=600;run.party.light.cooldown=600;Heroes.setHp(run,'hero',Heroes.maxHp(run,'hero'));
      const p=cellPoint(0,0),reach=job==='swordsman'?1.6:3;let angle=[0,Math.PI/2,Math.PI,-Math.PI/2].find(a=>hasClearPath(p.x,p.z,p.x+Math.sin(a)*4,p.z+Math.cos(a)*4));if(angle===undefined)throw Error('No test corridor');
      G.px=p.x;G.pz=p.z;const m=monsters[0];m.alive=true;m.model.visible=true;m.cooldown=99;m.windup=0;m.model.position.set(p.x+Math.sin(angle)*reach,0,p.z+Math.cos(angle)*reach);
      if(wall){const b=G.wallBoxes.find(b=>!b.boundary);if(!b)throw Error('No test wall');const x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2;G.px=x-(b.type==='v'?1:0);G.pz=z-(b.type==='h'?1:0);m.model.position.set(x+(b.type==='v'?1:0),0,z+(b.type==='h'?1:0));angle=b.type==='v'?Math.PI/2:0;}
      this.target=m.id;run.party.health[m.id]=P.monsterSpecs(run).find(s=>s.id===m.id).maxHp;playerGroup.position.set(G.px,0,G.pz);playerGroup.rotation.y=G.heading=angle+Math.PI;G.camYaw=angle+.4;G.camPitch=.3;Heroes.actor(run).attack=0;Heroes.actor(run).shot=null;
      if(skill){if(!Heroes.actor(run).skills.includes('thorn_growth'))throw Error('Expected fixture native thorn_growth');if(monsters[1]){const farther=monsters[1];farther.alive=true;farther.model.visible=true;farther.cooldown=99;farther.model.position.set(p.x+Math.sin(angle)*4,0,p.z+Math.cos(angle)*4);run.party.health[farther.id]=P.monsterSpecs(run).find(s=>s.id===farther.id).maxHp;}}
      partyUI.heroes.hud(true);G.frozen=true;G.view='tp';return this.combatState();
    },
    combatState(){return {aim:autoAim,heading:G.heading,x:G.px,z:G.pz,camYaw:G.camYaw,camPitch:G.camPitch,target:this.target,enemies:monsters.filter(m=>m.alive||m.id===this.target).map(m=>({id:m.id,hp:run.party.health[m.id],visible:MazeSight.visible(m.model.position.x,m.model.position.z),clear:hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)})),motion:TowerCombatMotion.state(playerGroup).action};},
    clickAttack(){G.frozen=false;document.getElementById('towerAttackBtn').click();G.frozen=true;return this.combatState();},
    flight(){for(let i=0;i<40;i++){Heroes.tick(run,.03);partyUI.heroes.tick(.03);}updateHud();return this.combatState();},
    motion(phase){
      this.peace();const m=TowerCombatMotion.state(playerGroup);if(m.action!=='attack')throw Error('Actual root attack motion missing');m.elapsed=m.duration*phase;HeroVisual.pose(playerGroup,0,1,false,0);
      if(!this.preview){const c=document.createElement('canvas');c.id='qaScoutPreview';c.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:99999';document.body.appendChild(c);this.preview=new THREE.WebGLRenderer({canvas:c,antialias:true,preserveDrawingBuffer:true});this.preview.setSize(844,390);this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x101e2c);this.scene.add(new THREE.HemisphereLight(0xf6f0df,0x65758b,1.6));const light=new THREE.DirectionalLight(0xffe6b5,1);light.position.set(2,5,5);this.scene.add(light);this.cam=new THREE.PerspectiveCamera(34,844/390,.1,100);this.cam.position.set(.8,2.1,5.8);this.cam.lookAt(0,1.15,0);}
      const parent=playerGroup.parent,p=playerGroup.position.clone(),rot=playerGroup.rotation.clone();this.scene.add(playerGroup);playerGroup.position.set(0,0,0);playerGroup.rotation.set(0,0,0);this.preview.render(this.scene,this.cam);parent.add(playerGroup);playerGroup.position.copy(p);playerGroup.rotation.copy(rot);return {variant:m.variant,phase,right:playerGroup.userData.armR.rotation.toArray(),left:playerGroup.userData.armL.rotation.toArray()};
    },
    motionNext(){document.getElementById('qaScoutPreview').hidden=true;Heroes.tick(run,3);Heroes.actor(run).attack=0;partyUI.heroes.hud(true);updateHud();this.clickAttack();document.getElementById('qaScoutPreview').hidden=false;},
    hidePreview(){document.getElementById('qaScoutPreview').remove();this.preview.dispose();},
    close(){closeDialog();G.frozen=true;},
    save(){save();}
  };`;
  await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  const openHome=async()=>{await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();assert.equal(await page.locator('#homePanel .home-action').count(),6);};
  const state=()=>page.evaluate(()=>__campQA.state());
  const button=(key,id)=>page.locator('[data-tower="'+key+'"]'+(id?'[data-item="'+id+'"]':''));
  const load=o=>page.evaluate(o=>__campQA.load(o),o);
  const shot=async name=>{const path=out+'/'+name+'.png';await page.screenshot({path});report.screenshots.push(path);};
  async function layout(label){const b=await page.evaluate(()=>{const d=document.getElementById('towerDialog'),c=d.querySelector('.tower-dialog-content'),r=d.getBoundingClientRect();return {width:innerWidth,height:innerHeight,root:document.documentElement.scrollWidth,scroll:c.scrollWidth,client:c.clientWidth,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});assert.ok(b.root<=b.width+1&&b.scroll<=b.client+2,label+JSON.stringify(b));assert.ok(b.x>=-1&&b.y>=-1&&b.right<=b.width+1&&b.bottom<=b.height+1,label);report.layouts.push({label,...b});}
  await openHome();report.home=true;
  if(!combatOnly){
  for(const [options,count]of [[{job:'mage'},6],[{job:'chef'},18],[{job:'mage',members:['chef']},18],[{job:'chef',floor:-41},23]]){
    await load(options);await page.evaluate(()=>__campQA.kitchen());assert.equal(await page.locator('.party-recipe').count(),count);assert.equal(await button('party-cook').count(),count);assert.equal(await button('party-rest').count(),0);await layout('recipe '+options.job+' '+(options.floor||99));report.recipes.push({options,count});
    if(count===6){assert.equal(await button('party-cook','feast').count(),0);assert.equal(await button('party-eat','feast').count(),1);const before=await state();await button('party-eat','feast').tap();const after=await state();assert.equal(after.meals.feast,before.meals.feast-1);assert.ok(after.hp>before.hp);report.preparedMealWithoutChef=true;}
    const before=await state();await button('party-cook',count===6?'stew':'crab').tap();const after=await state();assert.ok(after.meals[count===6?'stew':'crab']>before.meals[count===6?'stew':'crab']);assert.ok(after.valid);
  }
  await load({members:['scout']});await page.evaluate(()=>__campQA.kitchen());const before=await state();assert.equal(await button('party-forge').count(),0);await button('party-repair').tap();const maintained=await state();assert.equal(maintained.coins,before.coins-6);assert.ok(maintained.valid&&maintained.maintenance.used);
  for(const g of before.gear){const now=maintained.gear.find(x=>x.id===g.id),expected=before.worn.includes(g.id)&&g.durability>0?Math.min(g.maxDurability,g.durability+Math.ceil(g.maxDurability*.2)):g.durability;assert.equal(now.durability,expected,g.id);}
  assert.ok(await button('party-repair').isDisabled());report.maintenance.push({stage:'all-worn-two-actors',used:true});await shot('basic-cooking-maintained');
  await page.evaluate(()=>__campQA.forge());assert.match(await page.locator('#towerDialog').innerText(),/沒有能行動的鍛匠/);for(const b of await button('party-forge-ask').all())assert.ok(await b.isDisabled());for(const b of await button('party-mend-ask').all())assert.ok(await b.isDisabled());report.noSmithCampBlocked=true;
  await page.evaluate(()=>__campQA.shift());await page.waitForFunction(()=>!__campQA.state().shifting);await page.evaluate(()=>{__campQA.freeze();__campQA.camp();__campQA.kitchen();});assert.ok(await button('party-repair').isDisabled());report.maintenance.push({stage:'real-maze-shift',used:true});
  await page.evaluate(()=>__campQA.save());await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await button('continue').tap();await page.evaluate(()=>{__campQA.close();__campQA.camp();__campQA.kitchen();});assert.ok((await state()).maintenance.used);assert.ok(await button('party-repair').isDisabled());report.maintenance.push({stage:'save-reload',used:true});
  await page.evaluate(()=>{__campQA.next();__campQA.kitchen();});assert.equal((await state()).floor,98);assert.equal((await state()).maintenance.used,false);assert.equal(await button('party-repair').isDisabled(),false);await button('party-repair').tap();assert.ok((await state()).maintenance.used);report.maintenance.push({stage:'next-floor',used:true});
  async function serviceGear(gear,kind='repair',merchant=null,{away=false}={}){
    await button('party-forge-select',gear.id).tap();const trait=kind==='forge'?'durable':null,q=await page.evaluate(({id,trait,merchant})=>__campQA.quote(id,trait,merchant),{id:gear.id,trait,merchant});assert.ok(q.allowed);if(merchant)assert.equal(q.coins,Math.ceil(q.baseCoins*1.2));
    const before=await state(),key=kind==='forge'?'party-forge-':'party-mend-',item=kind==='forge'?trait+'|'+gear.id:gear.id;await button(key+'ask',item).tap();assert.deepEqual(await state(),before,'confirmation must not charge');await layout(kind+' confirm '+(merchant||'smith'));
    if(away)await page.evaluate(()=>__campQA.away());await button(key+'confirm',item).tap();const after=await state();
    if(away){assert.deepEqual(after,before,'out-of-range confirmation must not charge');return {blocked:true};}
    assert.ok(after.valid);assert.equal(after.coins,before.coins-q.coins);assert.equal(after.scrap,before.scrap-q.parts);
    const actual=after.gear.find(g=>g.id===gear.id);if(kind==='repair')assert.equal(actual.durability,actual.maxDurability);else{assert.equal(actual.forge.trait,trait);assert.equal(actual.forge.level,q.level);for(const [k,n]of Object.entries(q.materialCost))assert.equal(after.materials[k],before.materials[k]-n);}
    return {kind,gear:gear.kind,coins:q.coins,baseCoins:q.baseCoins,parts:q.parts};
  }
  await load({job:'smith'});await page.evaluate(()=>__campQA.kitchen());await button('party-forge').tap();let gear=(await state()).gear.find(g=>g.durability===0);await serviceGear(gear);gear=(await state()).gear.find(g=>g.id===gear.id);await serviceGear(gear,'forge');report.smithService=true;await shot('smith-full-repair-forge');
  for(const merchant of ['tieLing','jinHe','lanZhou']){
    await load({merchant});await page.evaluate(id=>__campQA.shop(id),merchant);await page.evaluate(()=>__campQA.kitchen());for(const b of await button('party-cook').all())assert.ok(await b.isDisabled());assert.ok(await button('party-repair').isDisabled());await page.evaluate(id=>__campQA.shop(id),merchant);assert.equal(await button('party-merchant-forge',merchant).count(),1);await button('party-merchant-forge',merchant).tap();const expected=await page.evaluate(id=>__campQA.eligible(id),merchant),shown=await button('party-forge-select').evaluateAll(nodes=>nodes.map(n=>n.dataset.item));assert.deepEqual(shown.sort(),expected.sort());assert.ok(expected.length>3);
    let gear=(await state()).gear.find(g=>expected.includes(g.id)&&g.slot===({tieLing:'helmet',jinHe:'armor',lanZhou:'shield'}[merchant]));const repair=await serviceGear(gear,'repair',merchant);gear=(await state()).gear.find(g=>g.id===gear.id);const forge=await serviceGear(gear,'forge',merchant);
    const next=(await state()).gear.find(g=>expected.includes(g.id)&&g.slot==='weapon'&&g.durability<g.maxDurability);assert.ok(next);const distance=await serviceGear(next,'repair',merchant,{away:true});report.merchants.push({merchant,visible:shown,repair,forge,distance});
  }
  await load({merchant:'tieLing',members:['scout']});await page.evaluate(()=>__campQA.shop('tieLing'));await button('party-merchant-forge','tieLing').tap();
  const bulkBefore=await state(),bulkQuote=await page.evaluate(()=>__campQA.quoteAll('tieLing'));assert.ok(bulkQuote.entries.length>1&&bulkQuote.affordable);await button('party-mend-all-ask').tap();assert.deepEqual(await state(),bulkBefore);await button('party-forge-back').tap();assert.deepEqual(await state(),bulkBefore,'cancel bulk repair is free');await button('party-mend-all-ask').tap();await button('party-mend-all-confirm').tap();const bulkAfter=await state();assert.ok(bulkAfter.valid);assert.equal(bulkAfter.coins,bulkBefore.coins-bulkQuote.coins);assert.equal(bulkAfter.scrap,bulkBefore.scrap-bulkQuote.parts);for(const g of bulkBefore.gear)assert.equal(bulkAfter.gear.find(x=>x.id===g.id).durability,bulkQuote.entries.some(e=>e.id===g.id)?g.maxDurability:g.durability);assert.ok(await button('party-mend-all-ask').isDisabled());report.bulkRepair={merchant:'tieLing',entries:bulkQuote.entries.length,coins:bulkQuote.coins,parts:bulkQuote.parts,cancelFree:true};
  await load({merchant:'suHe'});for(const [from,to,label]of [[0,10,/買 10 支 · 1 幣/],[95,100,/補滿 5 支 · 1 幣/]]){await page.evaluate(n=>__campQA.arrows(n),from);await page.evaluate(()=>__campQA.shop('suHe'));assert.match(await button('buy','arrow').innerText(),label);const before=await state();await button('buy','arrow').tap();const after=await state();assert.equal(after.arrows,to);assert.equal(after.coins,before.coins-1);}
  assert.ok(await button('buy','arrow').isDisabled());assert.match(await button('buy','arrow').innerText(),/箭袋已滿|已達容量上限/);report.arrows={bundle:10,price:1,partial:5,cap:100};
  for(const [width,height]of [[844,390],[667,375],[1440,900]]){
    await page.setViewportSize({width,height});await load({job:'chef',members:['smith']});await page.evaluate(()=>__campQA.kitchen());await layout('cooking '+width);await shot(width+'-cooking');await button('party-cook','crab').scrollIntoViewIfNeeded();await shot(width+'-recipe-scrolled');await button('party-forge').tap();await layout('forge '+width);await shot(width+'-forge');
    await load({merchant:'suHe'});await page.evaluate(()=>__campQA.shop('suHe'));await layout('shop '+width);await button('buy','arrow').scrollIntoViewIfNeeded();await shot(width+'-shop');await load({merchant:'lanZhou'});await page.evaluate(()=>__campQA.shop('lanZhou'));await button('party-merchant-forge','lanZhou').tap();await layout('merchant-forge '+width);await shot(width+'-merchant-forge');await button('party-mend-ask').scrollIntoViewIfNeeded();await shot(width+'-repair-scrolled');
  }
  await page.evaluate(()=>__campQA.close());await page.locator('#actionsToggle').tap();const toggle=button('battle-auto-aim');assert.equal(await toggle.getAttribute('aria-checked'),'false');await toggle.tap();assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal((await state()).storedAim,'on');await layout('settings auto aim');await shot('auto-aim-settings');await page.evaluate(()=>__campQA.save());
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await button('continue').tap();await page.evaluate(()=>__campQA.close());await page.locator('#actionsToggle').tap();assert.equal(await toggle.getAttribute('aria-checked'),'true');await toggle.tap();assert.equal((await state()).storedAim,'off');report.autoAimPersistence=true;
  }
  report.combat=[];await page.setViewportSize({width:844,height:390});
  async function setAim(on){await page.evaluate(()=>__campQA.close());await page.locator('#actionsToggle').tap();const aimToggle=button('battle-auto-aim');if((await aimToggle.getAttribute('aria-checked')==='true')!==on)await aimToggle.tap();await page.evaluate(()=>__campQA.close());}
  for(const scenario of [{job:'mage',aim:true},{job:'swordsman',aim:true},{job:'mage',aim:false},{job:'mage',aim:true,wall:true},{job:'mage',aim:true,skill:true}]){
    await page.evaluate(o=>__campQA.combat(o),scenario);await setAim(scenario.aim);await page.waitForTimeout(180);const before=await page.evaluate(()=>__campQA.combatState());if(!scenario.wall)assert.ok(before.enemies.find(m=>m.id===before.target).visible,'target must actually be visible');
    if(scenario.skill)await page.locator('[data-hero-skill="thorn_growth"]').tap();else await page.evaluate(()=>__campQA.clickAttack());
    const after=await page.evaluate(()=>__campQA.flight()),a=after.enemies.find(m=>m.id===before.target),b=before.enemies.find(m=>m.id===before.target);
    report.combat.push({scenario,before,after});
    assert.deepEqual([after.x,after.z,after.camYaw,after.camPitch],[before.x,before.z,before.camYaw,before.camPitch],'aim must not move actor or orbit controls');
    if(scenario.aim&&!scenario.wall){assert.ok(Math.abs(Math.sin((after.heading-before.heading)/2))>.9,'turn toward target');assert.ok(a.hp<b.hp,'actual button must hit target');}else{assert.equal(after.heading,before.heading);assert.equal(a.hp,b.hp);}
    if(scenario.skill){assert.ok(before.enemies.length>1&&before.enemies.every(m=>m.visible&&m.clear),'multiple visible targets required');for(const m of before.enemies.filter(m=>m.id!==before.target))assert.equal(after.enemies.find(e=>e.id===m.id).hp,m.hp,'single target skill must choose nearest visible enemy');}
    await shot('aim-'+scenario.job+'-'+(scenario.skill?'skill':scenario.wall?'wall':scenario.aim?'on':'off'));
  }
  await load({job:'scout'});await page.evaluate(()=>{__campQA.close();__campQA.peace();__campQA.clickAttack();});report.scoutMotion=[];
  for(const phase of [.48,.7]){report.scoutMotion.push(await page.evaluate(p=>__campQA.motion(p),phase));await shot('scout-alternate-'+phase);}
  await page.evaluate(()=>__campQA.motionNext());report.scoutMotion.push(await page.evaluate(()=>__campQA.motion(.48)));await shot('scout-cross');assert.notEqual(report.scoutMotion[0].variant,report.scoutMotion[2].variant);assert.notDeepEqual(report.scoutMotion[0].right,report.scoutMotion[1].right);await page.evaluate(()=>__campQA.hidePreview());
  await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#landscapeGate').isVisible());await shot('portrait-rotation-gate');report.portraitGate=true;
  await page.setViewportSize({width:844,height:390});await openHome();await page.locator('#singleBtn').tap();await page.locator('#playerName').fill('單人流程驗證');await page.locator('#profileNextBtn').tap();await page.locator('#startBtn').tap();assert.ok(await page.locator('#hudTop').isVisible());report.normalStart=true;
  await openHome();await page.locator('#mpBtn').tap();await page.locator('#playerName').fill('多人流程驗證');await page.locator('#profileNextBtn').tap();await page.locator('#startBtn').tap();assert.ok(await page.locator('#mpJoin').isVisible());report.multiplayerEntry=true;
  assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,failure:report.failure,recipes:report.recipes,maintenance:report.maintenance,merchants:report.merchants.length,layouts:report.layouts.length,errors:report.errors}));}
