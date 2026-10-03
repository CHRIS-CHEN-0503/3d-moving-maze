// Isolated local studio. Uses the actual character, equipment and pose hierarchy.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8795/';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const allKinds=['smith_hammer','warhammer','longsword','greatsword','cooking_pan','twin_daggers','arcane_staff','spellbook','elven_bow'],kinds=process.env.STUDIO_WEAPONS?process.env.STUDIO_WEAPONS.split(','):allKinds;
assert.ok(kinds.length&&kinds.every(k=>allKinds.includes(k)));
const out='.agent-run/weapon-contact-qa';await mkdir(out,{recursive:true});
const report={models:[],frames:[],firstPerson:[],errors:[],limitations:'Local studio renders with real game models; desktop Chrome, not physical-device performance.'};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:600},hasTouch:true});page.on('pageerror',e=>report.errors.push(e.stack));
 await page.route('**/api/runtime-config',r=>r.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));
 await page.route('**/api/scores*',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 const mode=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
 const bridge=`window.__weaponFPQA={
  seed(kind){const job=Heroes.GEAR[kind].jobs[0];run=Heroes.enable(P.enable(C.newRun({name:'武器視角驗證',seed:43}),job).run).run;run.equipment.weapon=C.createGear(kind,99,43,'fp-qa');if(Heroes.GEAR[kind].hands===2)run.equipment.shield=null;enter();closeDialog();G.running=false;return !!C.validateSave(run);},
  frame(variant){G.view='fp';G.camYaw=Math.PI;G.camPitch=0;G.frozen=true;playerGroup.visible=false;playerGroup.rotation.y=G.heading=0;TowerCombatMotion.begin(playerGroup,'attack',1);const s=TowerCombatMotion.state(playerGroup);s.variant=variant;s.elapsed=.48;HeroVisual.pose(playerGroup,0,1,true,0);updateHeroFirstPerson();scene.updateMatrixWorld(true);camera.position.set(G.px,1.6,G.pz);camera.lookAt(G.px,1.6,G.pz+4);renderMaze();let error=0;const src=playerGroup.userData.heroPieces.filter(p=>p.userData.baseKind===playerGroup.userData.heroWeapon);for(let i=0;i<src.length;i++){const expected=src[i].matrixWorld.clone();expected.elements[13]+=.32;for(let n=0;n<16;n++)error=Math.max(error,Math.abs(expected.elements[n]-heroFp.children[i].matrixWorld.elements[n]));}return {variant,error,count:heroFp.children.length,visible:heroFp.visible,finite:heroFp.children.every(p=>p.matrixWorld.elements.every(Number.isFinite)),elapsed:s.elapsed,anchor:heroFp.getWorldPosition(new THREE.Vector3()).toArray(),player:playerGroup.getWorldPosition(new THREE.Vector3()).toArray()};}
 };`;
 assert.ok(mode.includes('  install();\n})();'));
 await page.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:mode.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  const T=THREE,s=new T.Scene();s.background=new T.Color(0x17242c);s.add(new T.HemisphereLight(0xfaf3e4,0x53677b,1.15));const key=new T.DirectionalLight(0xffe8c8,1.2);key.position.set(-4,6,7);s.add(key);
  const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(innerWidth,innerHeight);Object.assign(r.domElement.style,{position:'fixed',inset:0,zIndex:100000});document.body.append(r.domElement);
  const c=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,40);c.position.set(0,2.9,6.9);c.lookAt(0,1,0);
  window.__weaponStudio={s,r,c,models:[],clear(){for(const m of this.models){s.remove(m);disposeSceneObject(m);}this.models=[];},build(kind,tier=1){this.clear();const H=TowerHeroes,V=TowerHeroVisuals,d=H.GEAR[kind],job=d.jobs[0];for(let i=0;i<2;i++){
   const m=V.base(job,buildCharacter,'preview',i?'female':'male');m.position.x=i?1.12:-1.12;m.rotation.y=-.24;const gear=(base,slot)=>({kind:H.tierKind(base,tier),slot,durability:100,maxDurability:100});
   const eq={weapon:gear(kind,'weapon'),armor:gear(H.JOBS[job].armor==='robe'?'robe':H.JOBS[job].armor+'_armor','armor')};if(d.hands===1)eq.shield=gear('round_shield','shield');V.dress(T,m,eq,disposeSceneObject,{showHelmet:false});s.add(m);this.models.push(m);
  }return this.models.map(m=>{let triangles=0,meshes=0;m.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {kind,tier,sex:m.userData.heroSex,triangles,meshes};});},frame(progress){const data=[];for(let i=0;i<this.models.length;i++){
   const m=this.models[i];TowerCombatMotion.begin(m,'attack',1);const state=TowerCombatMotion.state(m);state.variant=i;state.elapsed=progress;TowerHeroVisuals.pose(m,0,1,false,0);m.updateMatrixWorld(true);
   const w=m.userData.heroPieces.find(p=>p.userData.baseKind===m.userData.heroWeapon),contact=w?.userData.contact;data.push({sex:m.userData.heroSex,variant:i,progress,contact:contact||null,finite:m.matrixWorld.elements.every(Number.isFinite)});
  }r.render(s,c);return data;},close(){this.clear();r.render(s,c);const memory={...r.info.memory};r.dispose();r.forceContextLoss();r.domElement.remove();return memory;}};
 });
 for(const kind of kinds){
  for(const tier of [1,5]){const models=await page.evaluate(([k,t])=>__weaponStudio.build(k,t),[kind,tier]);assert.ok(models.every(m=>m.triangles<13000&&m.meshes<100));report.models.push(...models);
   for(const progress of [.22,.48,.7]){const data=await page.evaluate(p=>__weaponStudio.frame(p),progress);assert.ok(data.every(p=>p.finite));report.frames.push({kind,tier,progress,data});await page.screenshot({path:out+'/'+kind+'-t'+tier+'-'+Math.round(progress*100)+'.png'});
    if(kind==='elven_bow'){
     await page.evaluate(()=>{const g=__weaponStudio;g.c.position.set(4,2.4,5.8);g.c.lookAt(0,1,0);g.r.render(g.s,g.c);});await page.screenshot({path:out+'/'+kind+'-t'+tier+'-'+Math.round(progress*100)+'-side.png'});
     await page.evaluate(()=>{const g=__weaponStudio;g.c.position.set(0,2.9,6.9);g.c.lookAt(0,1,0);g.r.render(g.s,g.c);});
    }
   }
  }
 }
 report.memory=await page.evaluate(()=>__weaponStudio.close());assert.equal(report.memory.geometries,0);assert.equal(report.memory.textures,0);
 await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
 for(const kind of kinds){assert.ok(await page.evaluate(k=>__weaponFPQA.seed(k),kind));for(const variant of [0,1]){const data=await page.evaluate(v=>__weaponFPQA.frame(v),variant);assert.ok(data.visible&&data.finite&&data.error<1e-8);assert.equal(data.count,kind==='twin_daggers'?2:1);assert.equal(data.elapsed,.48);report.firstPerson.push({kind,...data});await page.screenshot({path:out+'/'+kind+'-fp-'+variant+'.png'});}}
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,models:report.models.length,frames:report.frames.length,firstPerson:report.firstPerson.length,memory:report.memory,errors:report.errors,failure:report.failure}));}
