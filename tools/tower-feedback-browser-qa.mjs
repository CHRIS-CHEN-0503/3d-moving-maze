import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/feedback-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[],report={cases:[]};page.on('pageerror',e=>errors.push(e.stack));
  const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  const bridge=`window.__feedbackQA={sounds:[],
    seed(job,skill){
      for(let seed=1;seed<500;seed++){run=Heroes.enable(P.enable(C.newRun({seed,name:'動作測試'}),job).run).run;if(Heroes.SKILLS[skill]?.unique)Heroes.gainXp(run,TowerHeroGrowth.XP.at(-1));if(!skill||Heroes.actor(run).skills.includes(skill))break;}
      for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=30;
      run.party.journey.scrap=30;Heroes.setHp(run,'hero',10);run.hunger=10;run.equipment.weapon.durability--;
      enter();closeDialog();GameVoice.configure({enabled:false});G.frozen=true;G.muted=false;AudioEng.init();AudioEng.resume();
      const old=AudioEng.sfxAction;if(!this.wrapped){const self=this;AudioEng.sfxAction=function(kind,seconds){self.sounds.push(kind);return old.call(this,kind,seconds);};this.wrapped=true;}
      this.sounds=[];
      for(const m of monsters){m.alive=false;m.model.visible=false;}
      const m=monsters[0];if(!m)throw Error('missing monster');m.alive=true;m.model.visible=true;
      const angle=[0,Math.PI/2,Math.PI,Math.PI*1.5].find(a=>hasClearPath(G.px,G.pz,G.px+Math.sin(a)*1.6,G.pz+Math.cos(a)*1.6));
      if(angle===undefined)throw Error('missing open attack lane');
      playerGroup.rotation.y=angle;m.model.position.set(G.px+Math.sin(angle)*1.6,0,G.pz+Math.cos(angle)*1.6);m.windup=0;
      partyUI.heroes.tick(0);save();return {valid:!!C.validateSave(run),monster:m.id};
    },
    attack(){partyUI.attack();return this.state();},
    cast(id){const ok=partyUI.heroes.cast(id,'hero');return {...this.state(),ok};},
    lightShortcut(){lightingUI.panel();lightingUI.handle('light-daylight');return {...this.state(),light:run.party.light.daylight};},
    tick(dt){partyUI.heroes.tick(dt);return this.state();},
    state(){return {sounds:[...this.sounds],fx:partyUI.heroes.effectStats(),prep:partyUI.heroes.preparing()?.left||0,bar:document.getElementById('heroSkillBar').textContent,hp:run.party.health[monsters[0].id],dead:run.defeatedMonsters.includes(monsters[0].id),valid:!!C.validateSave(run)};}
  };`;
  // Local-only diagnostic bridge; production source and game rules are unchanged.
  await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:source.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();
  for(const job of ['swordsman','mage','smith']){
    assert.ok((await page.evaluate(job=>__feedbackQA.seed(job),job)).valid);await page.waitForTimeout(150);
    const result=await page.evaluate(()=>__feedbackQA.attack());assert.ok(result.valid);assert.ok(result.fx.groups>0);assert.ok(result.sounds.includes(job==='mage'?'hit-magic':'hit-metal'));
    await page.evaluate(()=>__feedbackQA.tick(.08));await page.screenshot({path:out+'/hit-'+job+'.png'});report.cases.push({job,...result});
  }
  for(const [job,skill]of [['mage','starfall'],['mage','star_ring'],['swordsman','decisive_slash'],['swordsman','whirlwind'],['healer','dawn_sanctuary'],['smith','moving_fortress'],['chef','hero_feast'],['mage','daylight'],['mage','barrier'],['chef','warm_soup'],['smith','barricade']]){
    await page.evaluate(([job,skill])=>__feedbackQA.seed(job,skill),[job,skill]);await page.waitForTimeout(150);
    const result=await page.evaluate(id=>__feedbackQA.cast(id),skill);assert.ok(result.ok&&result.valid);assert.ok(result.fx.groups>0);assert.ok(result.sounds.length>0);
    if(result.prep){const attack=await page.evaluate(()=>__feedbackQA.attack());assert.equal(attack.hp,result.hp);assert.deepEqual(attack.sounds,result.sounds);}
    await page.evaluate(()=>__feedbackQA.tick(.08));await page.screenshot({path:out+'/skill-'+skill+'.png'});
    if(result.prep){assert.match(result.bar,/準備/);const before=await page.evaluate(seconds=>__feedbackQA.tick(seconds),result.prep-.09);assert.ok(before.prep>0);assert.equal(before.sounds.includes('burst'),false);const after=await page.evaluate(()=>__feedbackQA.tick(.02));assert.equal(after.prep,0);assert.ok(after.valid);if(['starfall','star_ring','decisive_slash'].includes(skill)){assert.ok(after.sounds.includes('burst'));assert.ok(after.sounds.includes(skill==='decisive_slash'?'hit-metal':'hit-magic'));}}
    report.cases.push({skill,...result});
  }
  await page.evaluate(()=>__feedbackQA.seed('mage','daylight'));const shortcut=await page.evaluate(()=>__feedbackQA.lightShortcut());assert.equal(shortcut.prep,1.1);assert.equal(shortcut.light,0);await page.evaluate(()=>__feedbackQA.tick(1.11));report.lightShortcut=shortcut;
  const cleanup=await page.evaluate(()=>__feedbackQA.tick(4));assert.equal(cleanup.fx.groups,0);
  const preview=await browser.newPage({viewport:{width:844,height:390}});preview.on('pageerror',e=>errors.push(e.stack));
  await preview.goto('http://127.0.0.1:8795/docs/'+encodeURIComponent('戰鬥回饋預覽.html'),{waitUntil:'networkidle'});
  await preview.locator('#physical').click();await preview.waitForTimeout(80);await preview.screenshot({path:out+'/preview-hit.png'});
  await preview.locator('#other').selectOption('starfall');await preview.waitForTimeout(700);
  const previewState=await preview.evaluate(()=>({audio:audioContext.state,choices:document.querySelectorAll('#other option').length}));assert.equal(previewState.audio,'running');assert.equal(previewState.choices,43);
  report.preview=previewState;report.errors=errors;assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
