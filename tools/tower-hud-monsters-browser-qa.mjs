// Local-only fixture bridge, injected into a disposable browser; never shipped.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='.agent-run/hud-monsters-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={layouts:[],floors:[]};
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});page.on('pageerror',e=>errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  const bridge=`window.__hudMonstersQA={
    seed(floor=97,modern=true){
      const seed=floor===1?Array.from({length:100},(_,i)=>i+1).find(s=>C.floorConfig(1,s).monsterCount===C.MAX_MONSTERS):31;
      let n=P.enable(C.newRun({name:'測試旅人',seed}),'mage').run;
      if(modern){n=Heroes.enable(n).run;n.coins=999;for(const f of [99,95,91]){n.floor=f;n.floorsCleared=99-f;n.chronicle=N.newChronicle(f);P.advance(n);const o=P.recruitOffer(n);if(o)n=P.recruit(n,o.id).run;}}
      n.floor=floor;n.floorsCleared=99-floor;n.chronicle=N.newChronicle(floor);P.advance(n);
      run=n;enter();closeDialog();G.frozen=true;partyUI?.hud();return this.snapshot();
    },
    snapshot(){return {floor:run.floor,valid:!!C.validateSave(run),expected:C.floorConfig(run.floor,run.seed).monsterCount,active:Heroes.state(run)?.active,
      monsters:monsters.map(m=>({id:m.id,kind:m.kind,strength:m.strength,alive:m.alive,cell:[m.cx,m.cy],distance:Math.hypot(m.x-G.px,m.z-G.pz)}))};},
    reload(){save();run=readSave();if(!run)throw Error('Unreadable save');loadFloor(false);closeDialog();G.frozen=true;partyUI?.hud();return this.snapshot();},
    defeatOne(){const id=monsters[0].id;run.defeatedMonsters.push(id);monsters[0].alive=false;monsters[0].model.visible=false;return id;},
    woundLast(){const id=monsters.at(-1).id;run.party.health[id]=2;run.party.poise[id]=3;if(modern())Heroes.state(run).enemy[id]={slow:4,slowPower:.3};return id;},
    shift(){G.frozen=false;run.effects.repel=30;doShift();},expanded(value){setHudExpanded(value);},
    stop(){stop();},
  };`;
  assert.ok(source.includes('  install();\n})();'));
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:source.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});
  if(process.env.HUD_LAYOUT_ONLY!=='1')for(const modern of [true,false])for(const floor of [99,97,89,79,69,59,49,39,29,19,9,1]){
    const state=await page.evaluate(args=>__hudMonstersQA.seed(...args),[floor,modern]);assert.ok(state.valid);assert.equal(state.monsters.length,state.expected,JSON.stringify({floor,modern}));assert.ok(state.monsters.length>=1&&state.monsters.length<=11);
    assert.equal(new Set(state.monsters.map(m=>m.cell.join(','))).size,state.monsters.length);assert.ok(state.monsters.every(m=>m.cell[0]+m.cell[1]>=6&&m.distance>=16),'Enemies must not spawn beside the entrance');
    const roster=state.monsters.map(({id,kind,strength})=>({id,kind,strength}));const dead=await page.evaluate(()=>__hudMonstersQA.defeatOne());
    if(floor===1){assert.equal(state.monsters.length,11);assert.equal(await page.evaluate(()=>__hudMonstersQA.woundLast()),'monster-10');}
    const restored=await page.evaluate(()=>__hudMonstersQA.reload());assert.ok(restored.valid);assert.deepEqual(restored.monsters.map(({id,kind,strength})=>({id,kind,strength})),roster);assert.equal(restored.monsters.find(m=>m.id===dead).alive,false);
    report.floors.push({floor,modern,count:state.expected,strengths:state.monsters.map(m=>m.strength)});
  }
  console.log('Verified floor scenes:',report.floors.length);
  await page.evaluate(()=>__hudMonstersQA.seed());
  await page.evaluate(()=>__hudMonstersQA.defeatOne());const beforeShift=await page.evaluate(()=>__hudMonstersQA.snapshot());
  await page.evaluate(()=>__hudMonstersQA.shift());await page.waitForFunction(()=>!G.shifting);await page.evaluate(()=>{G.frozen=true;});const afterShift=await page.evaluate(()=>__hudMonstersQA.snapshot());
  assert.deepEqual(afterShift.monsters.map(({id,kind,strength,alive})=>({id,kind,strength,alive})),beforeShift.monsters.map(({id,kind,strength,alive})=>({id,kind,strength,alive})));report.shift=true;
  await page.evaluate(()=>__hudMonstersQA.seed());
  const first=await page.locator('#heroTeamBar button').nth(1).getAttribute('data-hero-switch');await page.locator('#heroTeamBar button').nth(1).click();assert.equal((await page.evaluate(()=>__hudMonstersQA.snapshot())).active,first);
  // Simulate real effect chips without a timer while measuring the full stack.
  await page.evaluate(()=>{G.effects.speed={until:performance.now()+300000,label:'加速中'};renderChips();G.frozen=true;});
  for(const [width,height]of [[844,390],[667,375],[568,320],[1180,700]]){
    await page.setViewportSize({width,height});
    for(const expanded of [false,true]){
      await page.evaluate(v=>__hudMonstersQA.expanded(v),expanded);await page.waitForTimeout(80);
      const boxes=await page.evaluate(()=>Object.fromEntries(['towerHud','heroTeamBar','effectChips','hudInfo'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}];})));
      await page.screenshot({path:out+'/'+width+'x'+height+'-'+(expanded?'expanded':'collapsed')+'.png'});
      assert.ok(boxes.heroTeamBar.y>=boxes.towerHud.bottom+4,'Team row overlaps survival details');assert.ok(boxes.effectChips.y>=boxes.heroTeamBar.bottom+4,'Status chips overlap team');
      assert.ok(boxes.towerHud.y>=boxes.hudInfo.bottom,'Survival panel overlaps top timer');
      for(const [id,b]of Object.entries(boxes)){assert.ok(b.x>=0&&b.right<=width+1,JSON.stringify({id,width,height,expanded,b}));assert.ok(b.y>=0&&b.bottom<=height+1,JSON.stringify({id,width,height,expanded,b}));}
      assert.equal(await page.locator('#heroTeamBar button').count(),4);
      report.layouts.push({width,height,expanded,boxes});
    }
  }
  await page.evaluate(()=>__hudMonstersQA.expanded(false));await page.locator('#towerHudToggle').click();assert.equal(await page.locator('#towerHudToggle').getAttribute('aria-expanded'),'true');await page.locator('#towerHudToggle').click();assert.equal(await page.locator('#towerHudToggle').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>__hudMonstersQA.stop());
  const classic=await page.evaluate(()=>({wrapper:getComputedStyle(document.getElementById('towerLeftHud')).display,effects:getComputedStyle(document.getElementById('effectChips')).position,team:getComputedStyle(document.getElementById('heroTeamBar')).display}));assert.deepEqual(classic,{wrapper:'contents',effects:'absolute',team:'none'});report.classic=classic;
  assert.deepEqual(errors,[]);report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,floors:report.floors.length,layouts:report.layouts.length,errors}));
}finally{await browser.close();}
