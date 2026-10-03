// Isolated local browser fixtures. No production APIs or player storage.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/arrow-cap-qa',report={shops:[],screenshots:[],errors:[],limitations:'Desktop Chrome touch emulation, not physical iPhone performance. Fixtures set levels/inventory; purchases use actual UI, drops use the real combat kill transaction and physical runtime pickup.'};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
try{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`window.__arrowQA={
    load({hero='mage',level=3,archerLevel=1,merchant=true,secondArcher=false}={}){
      closeDialog();let seed=22;if(merchant)for(seed=1;seed<1000;seed++)if(E.merchantOffers(99,seed,true).some(m=>m.id==='suHe'))break;
      let n=Heroes.enable(P.enable(C.newRun({seed,name:'箭袋驗證'}),hero,'female').run).run;
      Heroes.gainXp(n,TowerHeroGrowth.XP[level-1]);
      if((hero!=='archer'||secondArcher)&&archerLevel){const m={id:'qa-archer',profession:'archer',sex:'male',level:archerLevel,hp:34,cooldown:0,hurtLeft:0};n.party.members.push(m);n.party.joined.push(m.id);Heroes.addMember(n,m);}
      n.coins=500;n.bag.arrow=0;if(!C.validateSave(n))throw Error('Invalid arrow fixture');
      run=n;floorStarted=false;enter();closeDialog();G.frozen=true;G.muted=true;GameVoice.configure({enabled:false});this.peace();save();return this.state();
    },
    peace(){for(const m of monsters){m.alive=false;m.model.visible=false;}hazardGrace=10;hurtLeft=10;},
    state(){return {valid:!!C.validateSave(run),seed:run.seed,level:Heroes.level(run,'hero'),members:run.party.members.map(m=>({id:m.id,level:m.level,hp:m.hp})),active:Heroes.state(run).active,arrows:run.bag.arrow,cap:C.itemLimit('arrow',run),coins:run.coins,map:run.bag.map,otherCap:C.itemLimit('map',run),dropQuantity:Loot.ARROW_DROP_QUANTITY,ground:run.party.loot.entries.map(e=>({...e})),models:loot.filter(l=>l.entry).map(l=>({id:l.id,visible:l.model.visible})),defeated:[...run.defeatedMonsters]};},
    inventory(arrow,map){run.bag.arrow=arrow;if(map!==undefined)run.bag.map=map;save();},
    close(){closeDialog();G.frozen=true;},
    shop(){closeDialog();this.peace();const t=traders.find(t=>t.id==='suHe');if(!t)throw Error('Merchant absent');G.px=t.x;G.pz=t.z;playerGroup.position.set(t.x,0,t.z);nearest=t;nearestWarrior=nearbyJourney=nearbyEncounter=null;trade();},
    panel(id){closeDialog();Heroes.tick(run,3);partyUI.handle('hero-panel',id);G.frozen=true;},
    down(){Heroes.setHp(run,'qa-archer',0);save();return this.state();},
    restore(){Heroes.setHp(run,'qa-archer',Heroes.maxHp(run,'qa-archer'));save();},
    kill(){
      closeDialog();const id='monster-3',spec=P.monsterSpecs(run).find(m=>m.id===id);if(!spec)throw Error('Expected real monster spec');
      run.party.health[id]=1;Heroes.actor(run,'hero').attack=0;
      let v=Heroes.fireProjectile(run,'hero',id);if(!v.ok)throw Error(v.message);run=v.run;
      v=Heroes.strike(run,id,{memberId:'hero',shot:true,lootCell:{x:2,y:2}});if(!v.ok||!v.effect.dead)throw Error('Combat kill failed');run=v.run;
      this.peace();restoreDrops();save();return {effect:v.effect,...this.state()};
    },
    pickup(){closeDialog();this.peace();const drop=loot.find(l=>l.entry?.key==='arrow');if(!drop)throw Error('Physical arrow drop absent');G.px=drop.x;G.pz=drop.z;playerGroup.position.set(drop.x,0,drop.z);drop.model.visible=true;drop.retry=0;G.frozen=false;tick(.01,performance.now());G.frozen=true;return this.state();},
    resume(){closeDialog();G.frozen=true;this.peace();return this.state();},
    levelUp(){Heroes.gainXp(run,TowerHeroGrowth.XP[Heroes.level(run,'hero')]-Heroes.experience(run,'hero'));partyUI.heroes.hud(true);save();return this.state();},
    fireEmpty(count){for(let i=0;i<count;i++){Heroes.tick(run,3);const v=Heroes.fireProjectile(run,'hero',null);if(!v.ok)throw Error(v.message);run=v.run;}Heroes.tick(run,3);save();return this.state();},
    bag(){closeDialog();document.getElementById('towerBagBtn').click();},
    save(){save();}
  };`;
  await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  const button=(key,id)=>page.locator('[data-tower="'+key+'"]'+(id?'[data-item="'+id+'"]':''));
  const state=()=>page.evaluate(()=>__arrowQA.state());
  const load=o=>page.evaluate(o=>__arrowQA.load(o),o);
  const shot=async name=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const path=out+'/'+name+'.png';await page.screenshot({path});report.screenshots.push(path);};
  async function reload(){await page.evaluate(()=>__arrowQA.save());await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>GameVoice.configure({enabled:false}));await page.locator('#enterMenuBtn').tap();await page.locator('#storyEntryBtn').tap();await button('continue').tap();return page.evaluate(()=>__arrowQA.resume());}
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();
  for(const archerLevel of [1,2,3]){
    let s=await load({archerLevel});const cap=100+(archerLevel-1)*50;assert.ok(s.valid);assert.equal(s.cap,cap);assert.equal(s.level,3,'capacity must not follow higher level non-archer hero');assert.equal(s.otherCap,99);assert.equal(s.dropQuantity,50);
    for(const from of [0,cap-5]){await page.evaluate(n=>{__arrowQA.inventory(n);__arrowQA.shop();},from);assert.match(await button('buy','arrow').innerText(),from===0?/買 10 支 · 1 幣/:/補滿 5 支 · 1 幣/);const before=await state();await button('buy','arrow').tap();const after=await state();assert.equal(after.arrows,Math.min(cap,from+10));assert.equal(after.coins,before.coins-1);assert.ok(after.valid);report.shops.push({archerLevel,cap,from,to:after.arrows,cost:before.coins-after.coins});}
    assert.ok(await button('buy','arrow').isDisabled());assert.match(await button('buy','arrow').innerText(),/箭袋已滿|已達容量上限/);await button('buy','arrow').scrollIntoViewIfNeeded();await shot('shop-archer-'+archerLevel+'-full');
  }
  report.combined=[];
  for(const [level,cap]of [[1,300],[2,350]]){const both=await load({hero:'archer',level,archerLevel:3,secondArcher:true});assert.ok(both.valid);assert.equal(both.cap,cap);await page.evaluate(n=>{__arrowQA.inventory(n);__arrowQA.shop();},cap-5);assert.match(await button('buy','arrow').innerText(),/補滿 5 支 · 1 幣/);const before=await state();await button('buy','arrow').tap();const after=await state();assert.equal(after.arrows,cap);assert.equal(after.coins,before.coins-1);assert.ok(await button('buy','arrow').isDisabled());const down=await page.evaluate(()=>__arrowQA.down());assert.equal(down.cap,cap);assert.equal(down.arrows,cap);report.combined.push({heroLevel:level,companionLevel:3,cap,downedStillCounts:true});}
  await load({archerLevel:2});await page.evaluate(()=>__arrowQA.inventory(145,99));await page.evaluate(()=>__arrowQA.panel('qa-archer'));await button('hero-switch','qa-archer').tap();let switched=await state();assert.equal(switched.active,'qa-archer');assert.equal(switched.cap,150);await page.evaluate(()=>__arrowQA.panel('hero'));await button('hero-switch','hero').tap();assert.equal((await state()).cap,150);const down=await page.evaluate(()=>__arrowQA.down());assert.equal(down.cap,150);assert.equal(down.arrows,145);assert.ok(down.valid);report.controlAndDowned={cap:150,retained:145};
  await page.evaluate(()=>{__arrowQA.restore();__arrowQA.panel('qa-archer');});await button('party-dismiss-ask','qa-archer').tap();await button('party-dismiss','qa-archer').tap();const left=await state();assert.equal(left.cap,100);assert.equal(left.arrows,145);assert.equal(left.members.length,0);assert.ok(left.valid);const persisted=await reload();assert.equal(persisted.arrows,145);assert.equal(persisted.cap,100);assert.ok(persisted.valid);await page.evaluate(()=>__arrowQA.shop());assert.ok(await button('buy','arrow').isDisabled());report.departureRetainsExcess=true;
  const beforeOther=await state();const mapButton=button('buy','map');assert.equal(await mapButton.count(),1);if(!await mapButton.isDisabled())await mapButton.tap();const afterOther=await state();assert.equal(afterOther.map,99);assert.equal(afterOther.coins,beforeOther.coins);report.otherSuppliesRemain99=true;
  await load({hero:'archer',level:2,merchant:false});await page.evaluate(()=>__arrowQA.inventory(96));const killed=await page.evaluate(()=>__arrowQA.kill());assert.ok(killed.effect.dead);assert.ok(killed.valid);assert.equal(killed.arrows,95);assert.deepEqual(killed.ground.map(e=>[e.id,e.quantity]),[['99:monster-3:item',50]]);const cross=await page.evaluate(()=>__arrowQA.pickup());assert.equal(cross.arrows,145);assert.equal(cross.cap,150);assert.equal(cross.ground.length,0);assert.equal(cross.models.length,0);assert.ok(cross.valid);assert.equal((await reload()).arrows,145);report.cross99={before:95,drop:50,after:145,realCombat:true,physicalPickup:true,reloaded:true};
  await page.evaluate(()=>__arrowQA.bag());const supply=page.locator('.supply-card').filter({has:button('use','arrow')});assert.match(await supply.innerText(),/145/);await supply.scrollIntoViewIfNeeded();await shot('bag-arrow-145');
  await load({hero:'archer',level:1,merchant:false});await page.evaluate(()=>__arrowQA.inventory(96));await page.evaluate(()=>__arrowQA.kill());let blocked=await page.evaluate(()=>__arrowQA.pickup());assert.equal(blocked.arrows,95);assert.equal(blocked.ground.length,1);assert.equal(blocked.ground[0].quantity,50);assert.ok(blocked.models[0].visible);const groundId=blocked.ground[0].id;blocked=await reload();assert.equal(blocked.ground[0].id,groundId);assert.equal(blocked.ground[0].quantity,50);assert.equal(blocked.arrows,95);const grown=await page.evaluate(()=>__arrowQA.levelUp());assert.equal(grown.level,2);assert.equal(grown.cap,150);const grownPickup=await page.evaluate(()=>__arrowQA.pickup());assert.equal(grownPickup.arrows,145);assert.equal(grownPickup.ground.length,0);assert.ok(grownPickup.valid);report.upgradeUnblocks={capBefore:100,capAfter:150,savedGroundId:groundId,after:145};
  await load({hero:'archer',level:3,merchant:false});await page.evaluate(()=>__arrowQA.inventory(171));await page.evaluate(()=>__arrowQA.kill());blocked=await page.evaluate(()=>__arrowQA.pickup());assert.equal(blocked.arrows,170);assert.equal(blocked.ground.length,1);assert.equal((await reload()).ground[0].quantity,50);const emptied=await page.evaluate(()=>__arrowQA.fireEmpty(20));assert.equal(emptied.arrows,150);const filled=await page.evaluate(()=>__arrowQA.pickup());assert.equal(filled.arrows,200);assert.equal(filled.ground.length,0);assert.ok(filled.valid);report.roomUnblocks={before:170,spent:20,drop:50,after:200,reloadedGround:true};
  await page.setViewportSize({width:667,height:375});await page.evaluate(()=>__arrowQA.bag());await page.locator('.supply-card').filter({has:button('use','arrow')}).scrollIntoViewIfNeeded();await shot('667-bag-arrow-200');
  await page.goto('http://127.0.0.1:8795/docs/'+encodeURIComponent('職業裝備圖鑑.html'),{waitUntil:'networkidle'});await page.waitForSelector('html[data-atlas-ready="true"]');await page.locator('#categories [data-category="items"]').tap();await page.locator('#search').fill('箭矢');await page.locator('#expand').tap();const atlasCard=page.locator('.entry').filter({has:page.locator('h3',{hasText:/^箭矢$/})});assert.equal(await atlasCard.count(),1);const atlasText=await atlasCard.innerText();assert.match(atlasText,/300/);assert.match(atlasText,/50/);assert.match(atlasText,/相加|累加|加總/);assert.doesNotMatch(atlasText,/上限\s*99|最多\s*99/);await atlasCard.scrollIntoViewIfNeeded();await shot('667-atlas-arrow-rule');report.atlas={text:atlasText};
  assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
