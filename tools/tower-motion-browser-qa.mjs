import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/motion-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[],report={menus:[],weapons:[]};page.on('pageerror',e=>errors.push(e.stack));
 const source=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
 const bridge=`window.__motionQA={calls:[],
 seed(){run=Heroes.enable(P.enable(C.newRun({seed:43,name:'動作測試'}),'healer').run).run;run.coins=999;run.party.journey.scrap=99;enter();closeDialog();for(const m of monsters){m.alive=false;m.model.visible=false;}G.frozen=true;GameVoice.configure({enabled:false});const self=this;GameVoice.readPanel=function(panel){self.calls.push({kind:'panel',text:panel.voiceSummary||panel.voiceText||panel.querySelector('h2').textContent});};GameVoice.announce=function(text){self.calls.push({kind:'label',text});};GameVoice.status=()=>({enabled:true,supported:true});return !!C.validateSave(run);},
 menu(kind){closeDialog();this.calls=[];if(kind==='cook')partyUI.panel('cook');if(kind==='forge')partyUI.handle('party-forge');if(kind==='gear')partyUI.heroes.panel();if(kind==='light')lightingUI.panel();if(kind==='bag')inventory();if(kind==='settings')openBattleSettings();if(kind==='read')readStory(N.availableScenes(run)[0].id);return this.calls;},
 callsReset(){this.calls=[];},
 runtimeAttack(){closeDialog();G.frozen=true;partyUI.heroes.tick(0);Heroes.actor(run).attack=0;partyUI.attack();return {...TowerCombatMotion.state(playerGroup)};},
 gallery(kind,phase=.48,family=''){
  closeDialog();G.frozen=true;
  if(!this.preview){const canvas=document.createElement('canvas');canvas.id='motionPreview';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:99999';document.body.appendChild(canvas);this.preview=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});this.preview.setSize(844,390);this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x101e2c);this.scene.add(new THREE.HemisphereLight(0xf6f0df,0x65758b,1.6));const key=new THREE.DirectionalLight(0xffe6b5,1);key.position.set(2,5,5);this.scene.add(key);this.cam=new THREE.PerspectiveCamera(36,844/390,.1,100);this.cam.position.set(.8,2.2,6.6);this.cam.lookAt(0,1.15,0);}
  for(const model of this.models||[]){this.scene.remove(model);disposeSceneObject(model);}this.models=[];
  const job=Heroes.GEAR[kind].jobs[0];
  for(let i=0;i<2;i++){const model=HeroVisual.base(job,buildCharacter);model.position.x=(i?1:-1)*1.25;model.rotation.y=i?-.2:.15;this.scene.add(model);this.models.push(model);
   const eq={weapon:{kind,slot:'weapon',durability:10},helmet:{kind:['mage','healer'].includes(job)?'rune_crown':Heroes.JOBS[job].armor==='heavy'?'heavy_helm':'light_hood',slot:'helmet',durability:10},armor:{kind:Heroes.JOBS[job].armor==='robe'?'robe':Heroes.JOBS[job].armor+'_armor',slot:'armor',durability:10}};
   if(Heroes.GEAR[kind].hands===1)eq.shield={kind:'round_shield',slot:'shield',durability:10};HeroVisual.dress(THREE,model,eq,disposeSceneObject);
   TowerCombatMotion.begin(model,'attack',1);if(i)TowerCombatMotion.begin(model,'attack',1);if(family)TowerCombatMotion.begin(model,'skill',1,{effect:family});
   const s=TowerCombatMotion.state(model);s.elapsed=phase;HeroVisual.pose(model,0,1,false,0);
  }
  this.preview.render(this.scene,this.cam);return this.models.map(m=>({variant:TowerCombatMotion.state(m).variant,right:m.userData.armR.rotation.toArray(),left:m.userData.armL.rotation.toArray()}));
 },hidePreview(){document.getElementById('motionPreview').hidden=true;}
 };`;
 await page.route('**/story/tower-mode.js*',route=>route.fulfill({contentType:'application/javascript',body:source.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
 await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});await page.locator('#enterMenuBtn').tap();assert.ok(await page.evaluate(()=>__motionQA.seed()));
 for(const kind of ['cook','forge','gear','light','bag','settings','cook']){assert.deepEqual(await page.evaluate(k=>__motionQA.menu(k),kind),[]);report.menus.push(kind);}
 await page.evaluate(()=>__motionQA.menu('cook'));await page.locator('[data-tower="party-forge"]').click();assert.deepEqual(await page.evaluate(()=>__motionQA.calls),[{kind:'label',text:'鍛匠工坊'}]);
 await page.evaluate(()=>__motionQA.callsReset());await page.locator('[data-tower="party-kitchen"]').click();assert.deepEqual(await page.evaluate(()=>__motionQA.calls),[{kind:'label',text:'料理'}]);await page.screenshot({path:out+'/mobile-camp.png'});
 // Manual replay must still read the current page, not the last story.
 await page.evaluate(()=>{__motionQA.callsReset();document.querySelector('[data-voice-action="replay"]').click();});assert.equal((await page.evaluate(()=>__motionQA.calls))[0].kind,'panel');
 const story=await page.evaluate(()=>__motionQA.menu('read'));assert.equal(story[0]?.kind,'panel');report.story=story;
 const first=await page.evaluate(()=>__motionQA.runtimeAttack()),second=await page.evaluate(()=>__motionQA.runtimeAttack());assert.equal(first.action,'attack');assert.equal(second.action,'attack');assert.notEqual(first.variant,second.variant);
 for(const kind of ['longsword','greatsword','smith_hammer','warhammer','cooking_pan','twin_daggers','arcane_staff','spellbook']){
  const poses=await page.evaluate(k=>__motionQA.gallery(k),kind);assert.notDeepEqual(poses[0].right,poses[1].right);await page.screenshot({path:out+'/'+kind+'.png'});report.weapons.push({kind,poses});
 }
 for(const [name,effect]of [['prepare',''],['healing','heal'],['ward','ward'],['casting','bolt'],['deploy','barricade']]){await page.evaluate(([name,effect])=>__motionQA.gallery(name==='deploy'?'warhammer':'spellbook',name==='prepare'?.22:.48,effect),[name,effect]);await page.screenshot({path:out+'/'+name+'.png'});}
 // An installed icon uses the same original asset, with a padded maskable export.
 const icons=await page.evaluate(async()=>{const m=await fetch(document.querySelector('link[rel="manifest"]').href).then(r=>r.json());return {manifest:m,apple:document.querySelector('link[rel="apple-touch-icon"]').href};});for(const i of icons.manifest.icons)assert.ok((await page.request.get(new URL(i.src,page.url()).href)).ok());assert.ok((await page.request.get(icons.apple)).ok());report.icons=icons;
 assert.deepEqual(errors,[]);report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,menus:report.menus.length,weapons:report.weapons.length,errors}));
}finally{await browser.close();}
