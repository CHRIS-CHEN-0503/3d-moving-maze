// Local-only fixtures in a fresh browser context. Never a production bridge.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/adventure-quality-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={layouts:[],quality:[],screenshots:[],limitations:'Desktop Chrome SwiftShader with touch viewports. Draw counts are fixed-scene load evidence, not iPhone frame-rate measurements.'};
try{
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8'),anchor='  install();\n})();';assert.ok(source.includes(anchor));
  const bridge=`window.__adventureQA={
    seed(){
      let n=Heroes.enable(P.enable(C.newRun({seed:43,name:'品質測試'}),'swordsman','male').run).run;
      n=C.grantGear(n,C.createGear('greatsword',99,n.seed,'qa-greatsword')).run;
      n.bag.heal=3;n.bag.ration=2;n.bag.hourglass=0;n.party.light.torches=3;run=n;enter();closeDialog();G.frozen=true;G.muted=true;
      GameVoice.configure({enabled:false});for(const m of monsters){m.alive=false;m.model.visible=false;}
      partyUI.heroes.tick(0);partyUI.heroes.hud(true);lightingUI.hud();G.view='tp';return this.state();
    },
    state(){return {valid:!!C.validateSave(run),paused,overlay:!el('towerOverlay').hidden,equipment:Heroes.equipment(run,'hero'),bag:run.gearBag,quality:MazeQuality.status()};},
    bestiary(){partyUI.handle('party-bestiary');},
    reenter(){
      this.seed();for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=20;
      const skill=Heroes.actor(run).skills[0];partyUI.heroes.cast(skill,'hero');
      for(let i=0;i<80&&partyUI.heroes.preparing();i++){Heroes.tick(run,.05);partyUI.heroes.tick(.05);}
      Heroes.tick(run,.2);partyUI.heroes.tick(.2);paused=true;updateCamera(1);lightingUI.updateVisual(0,true);MazeSight.update({...sightFrame(),force:true});renderMaze();
      return {skill,valid:!!C.validateSave(run),fx:partyUI.heroes.effectStats(),memory:{...renderer.info.memory},calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    },
    creatureBudgets(){return TowerCreatureArt.kinds.map(kind=>{const model=monsterModel(kind,3),row={name:model.name,...model.userData.art};disposeSceneObject(model);return row;});},
    combat(){
      const m=monsters[0];if(!m)throw Error('fixture needs a monster');
      const angle=[0,Math.PI/2,Math.PI,Math.PI*1.5].find(a=>hasClearPath(G.px,G.pz,G.px+Math.sin(a)*1.6,G.pz+Math.cos(a)*1.6));
      if(angle===undefined)throw Error('fixture needs a visible lane');
      m.alive=true;m.model.visible=true;m.model.position.set(G.px+Math.sin(angle)*1.6,0,G.pz+Math.cos(angle)*1.6);m.cooldown=100;m.windup=0;
      run.effects.repel=20;G.frozen=false;tick(.016,performance.now());G.frozen=true;
      const cell=worldToCell(m.model.position.x,m.model.position.z),center=cellToWorld(cell.x,cell.y),half=G.cell/2-.08;
      const bounds={minX:center.x-half,minZ:center.z-half,maxX:center.x+half,maxZ:center.z+half};
      const cue=m.model.userData.combatReadability;if(!cue)throw Error('main loop did not attach combat cue');
      const actualBounds=cue.material.uniforms.bounds.value.toArray(),base=cue.baseScale.toArray();
      const update=opts=>TowerCombatReadability.update(THREE,m,{dt:0,visible:true,bounds,...opts});
      m.windup=.7;update();const charging=m.model.userData.body.scale.toArray();m.windup=0;update();
      const canceled={impact:cue.impact,visible:cue.group.visible,scale:m.model.userData.body.scale.toArray()};
      m.windup=.7;update();update({visible:false});const hidden={visible:cue.group.visible,scale:m.model.userData.body.scale.toArray()};
      m.alive=false;update();const dead={visible:cue.group.visible,scale:m.model.userData.body.scale.toArray()};
      m.alive=true;m.windup=0;update();m.cueRelease=(m.cueRelease||0)+1;update({dt:.01});const impact=cue.impact;
      MazeSight.update({...sightFrame(),force:true});
      let occluded=null;for(let y=0;y<G.mazeH&&!occluded;y++)for(let x=0;x<G.mazeW&&!occluded;x++){
        const p=cellToWorld(x,y),distance=Math.hypot(p.x-G.px,p.z-G.pz);
        if(distance>G.cell&&distance<G.cell*3&&!hasClearPath(G.px,G.pz,p.x,p.z)&&!MazeSight.visible(p.x,p.z))occluded=p;
      }
      if(!occluded)throw Error('fixture needs an occluded cell');
      m.windup=.7;update({visible:MazeSight.visible(occluded.x,occluded.z)});const wallHidden=cue.group.visible===false;
      m.windup=.5;update();paused=true;G.view='tp';G.camPitch=.48;G.camYaw=2.2;updateCamera(1);lightingUI.updateVisual(0,true);MazeSight.update({...sightFrame(),force:true});drawMap(document.getElementById('minimap'),false);renderMaze();
      const draws={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,ratio:renderer.getPixelRatio()};
      return {name:m.model.name,art:m.model.userData.art,base,charging,canceled,hidden,dead,impact,wallHidden,actualBounds,expectedBounds:[bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ],fragmentClips:/worldXZ.*discard/.test(cue.material.fragmentShader),draws};
    }
  };`;
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:source.replace(anchor,'  install();\n'+bridge+'\n})();')}));
  await page.route('**/api/runtime-config',route=>route.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();assert.ok((await page.evaluate(()=>__adventureQA.seed())).valid);
  async function screenshot(name){await page.screenshot({path:out+'/'+name+'.png'});report.screenshots.push(out+'/'+name+'.png');}
  async function close(){await page.locator('#towerDialog .tower-close[data-tower="close"]').tap();assert.equal((await page.evaluate(()=>__adventureQA.state())).overlay,false);}
  async function layout(kind,width,height){
    const result=await page.evaluate(()=>{const d=document.getElementById('towerDialog'),c=d.querySelector('.tower-dialog-content'),r=d.getBoundingClientRect();return {rootWidth:document.documentElement.scrollWidth,dialog:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},content:{width:c.clientWidth,scroll:c.scrollWidth}};});
    assert.ok(result.rootWidth<=width+1,kind+' root overflow: '+JSON.stringify(result));assert.ok(result.content.scroll<=result.content.width+2,kind+' content overflow: '+JSON.stringify(result));
    assert.ok(result.dialog.left>=-1&&result.dialog.top>=-1&&result.dialog.right<=width+1&&result.dialog.bottom<=height+1,kind+' dialog bounds');report.layouts.push({kind,width,height,...result});
  }
  for(const [width,height]of [[568,320],[844,390],[1024,768]]){
    await page.setViewportSize({width,height});
    await page.locator('#towerJournalBtn').tap();assert.equal(await page.locator('.adventure-brief').count(),1);assert.match(await page.locator('.adventure-brief').textContent(),/目前線索.*接下來/s);assert.ok((await page.locator('.adventure-brief p').allTextContents()).every(t=>t.length>8));await layout('journal',width,height);if(width===568)await screenshot('568-journal');await close();
    await page.locator('#towerBagBtn').tap();const supplies=await page.locator('.supply-card').evaluateAll(cards=>cards.map(c=>({empty:c.classList.contains('is-empty'),name:c.querySelector('h3').textContent,effect:c.querySelector(':scope > p').textContent,guide:!!c.querySelector('details')})));
    assert.ok(supplies.length>5);let empty=false;for(const s of supplies){if(s.empty)empty=true;else assert.equal(empty,false,'owned supplies must precede empty ones');assert.ok(s.effect.length>4);assert.ok(s.guide);}
    const hint=page.locator('.supply-card:not(.is-empty) details').first();await hint.locator('summary').tap();assert.equal(await hint.getAttribute('open'),'');await layout('supplies',width,height);if(width===844)await screenshot('844-supplies');
    const before=await page.evaluate(()=>__adventureQA.state());await page.locator('[data-tower="hero-panel"]').tap();await page.locator('[data-tower="hero-tab"][data-item="skills"]').tap();assert.match(await page.locator('.adventure-brief').textContent(),/職業自帶本領.*被動需要實際學會/s);await page.locator('[data-tower="hero-tab"][data-item="gear"]').tap();assert.ok(await page.locator('.gear-comparison').count());assert.match(await page.locator('.gear-warning').first().textContent(),/盾牌會放回背包/);
    const after=await page.evaluate(()=>__adventureQA.state());assert.deepEqual(after.equipment,before.equipment);assert.deepEqual(after.bag,before.bag);await layout('equipment',width,height);
    await page.locator('.gear-comparison').first().scrollIntoViewIfNeeded();if(width===844)await screenshot('844-equipment');await close();
    await page.locator('#actionsToggle').tap();await layout('settings',width,height);assert.equal(await page.locator('[data-maze-quality]').count(),3);
    for(const [mode,ratio]of [['detail',1.75],['battery',1],['auto',1.5]]){await page.locator('[data-maze-quality="'+mode+'"]').tap();const status=await page.evaluate(()=>MazeQuality.status());assert.equal(status.mode,mode);assert.equal(status.ratio,ratio);assert.equal(await page.locator('[data-maze-quality="'+mode+'"]').getAttribute('aria-pressed'),'true');report.quality.push({width,...status});}
    if(width===568)await screenshot('568-settings');await close();
  }
  // Complete the comparison contract with a real tap; two-handed equipment must stow the shield.
  await page.setViewportSize({width:844,height:390});await page.locator('#towerBagBtn').tap();await page.locator('[data-tower="hero-panel"]').tap();const beforeEquip=await page.evaluate(()=>__adventureQA.state());
  assert.ok(beforeEquip.equipment.shield);await page.locator('[data-tower="hero-equip"][data-item*="qa-greatsword"]').tap();const equipped=await page.evaluate(()=>__adventureQA.state());assert.ok(equipped.valid);assert.equal(equipped.equipment.weapon.kind,'greatsword');assert.equal(equipped.equipment.shield,null);assert.ok(equipped.bag.some(g=>g.id===beforeEquip.equipment.shield.id));report.twoHandedEquip=true;await close();
  await page.evaluate(()=>__adventureQA.bestiary());assert.ok(await page.locator('.tower-bestiary-card').count());await page.locator('.tower-bestiary-card summary').first().tap();assert.equal(await page.locator('.tower-bestiary-card').first().getAttribute('open'),'');await layout('bestiary',844,390);await close();
  report.creatures=await page.evaluate(()=>__adventureQA.creatureBudgets());assert.equal(report.creatures.length,9);for(const m of report.creatures){assert.equal(m.name,'tower-creature-'+m.kind);assert.ok(m.triangles>100&&m.triangles<6000);assert.ok(m.drawCalls<=5);}
  await page.locator('#towerLightBtn').tap();
  report.combat=await page.evaluate(()=>__adventureQA.combat());const c=report.combat;assert.match(c.name,/^tower-creature-/);assert.notDeepEqual(c.charging,c.base);assert.equal(c.canceled.impact,0);assert.equal(c.canceled.visible,false);for(const state of [c.canceled,c.hidden,c.dead])assert.deepEqual(state.scale,c.base);assert.equal(c.hidden.visible,false);assert.equal(c.dead.visible,false);assert.ok(c.impact>0);assert.ok(c.wallHidden&&c.fragmentClips);assert.deepEqual(c.actualBounds,c.expectedBounds);assert.ok(c.draws.calls>0&&c.draws.triangles>0);await screenshot('844-monster-telegraph');
  report.reloads=[];for(let i=0;i<4;i++){const row=await page.evaluate(()=>__adventureQA.reenter());assert.ok(row.valid);assert.ok(row.fx.groups>0&&row.calls>0);report.reloads.push(row);}
  const warm=report.reloads[1].memory,last=report.reloads.at(-1).memory;assert.ok(last.geometries<=warm.geometries+3,'same-floor geometry growth '+JSON.stringify(report.reloads));assert.ok(last.textures<=warm.textures+1,'same-floor texture growth '+JSON.stringify(report.reloads));
  assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,layouts:report.layouts.length,quality:report.quality.length,creatures:report.creatures.length,combat:c,screenshots:report.screenshots,errors}));
}catch(error){report.errors=errors;report.failure=error.stack;await writeFile(out+'/report.json',JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
