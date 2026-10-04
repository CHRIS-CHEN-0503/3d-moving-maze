// Local-only visual/runtime QA. Run through Process Guard against a managed server.
// Reuses the game's existing WebGL renderer, character builder, equipment and motion.
// Any private bridge below is injected into an isolated response, never a source file.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8798/';
const out=process.env.MAZE_QA_OUT||'.agent-run/knight-healing-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'fixtures must stay local');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const mode=await readFile(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const bridge=`window.__knightHealingQA={
  seed(){
    let found=null;
    for(let seed=1;seed<=64&&!found;seed++){
      const n=Heroes.enable(P.enable(C.newRun({seed,name:'隔離療癒驗證'}),'swordsman').run).run;
      // Early surface recruits follow a fixed profession order, not the seed:
      // 99F is always swordsman, while 91F is a real level-one healer offer.
      // Match the existing recruitment-test floor fixture and validate it.
      n.floor=91;n.floorsCleared=8;n.chronicle=N.newChronicle(91);
      n.claimed=[];n.defeatedMonsters=[];n.monsterStuns={};
      n.adventure=C.newAdventure();n.expedition=D.newExpedition();P.advance(n,{reward:false});
      if(!C.validateSave(n))throw Error('Invalid floor-91 fixture');
      const offer=P.recruitOffer(n);if(offer?.profession!=='healer')continue;
      const quote=P.recruitQuote(n,offer.id);
      for(const cost of quote.list){
        if(cost.type==='coins')n.coins=Math.max(n.coins,cost.count);
        else if(cost.type==='scrap')n.party.journey.scrap=Math.max(n.party.journey.scrap,cost.count);
        else if(cost.type==='materials')n.party.journey.materials[cost.id]=Math.max(n.party.journey.materials[cost.id],cost.count);
        else if(cost.type==='bag')n.bag[cost.id]=Math.max(n.bag[cost.id],cost.count);
        else n.party[cost.type][cost.id]=Math.max(n.party[cost.type][cost.id],cost.count);
      }
      // Three extra herbs remain after the genuine recruitment payment.
      n.party.ingredients.herb+=3;
      if(!C.validateSave(n))throw Error('Invalid provisioned recruitment fixture');
      const result=P.recruit(n,offer.id);if(!result.ok)continue;
      if(!Heroes.actor(result.run,offer.id).skills.includes('herbal_heal'))continue;
      if(!C.validateSave(result.run))throw Error('Real recruited output is invalid');
      found={run:result.run,id:offer.id,seed,quote:{offer,list:quote.list}};
    }
    if(!found)throw Error('No valid level-one healer fixture');
    run=found.run;this.id=found.id;this.seedValue=found.seed;this.recruitment=found.quote;
    const a=Heroes.actor(run,this.id),policy=TowerHeroGrowth.state(run).policies[this.id];
    for(const key of a.skills)a.cooldowns[key]=key==='herbal_heal'?0:Heroes.SKILLS[key].cooldown;
    policy.strategy='support';policy.materials=false;policy.thinkLeft=0;
    policy.heal.enabled=false;Heroes.setHp(run,'hero',1);
    if(!C.validateSave(run))throw Error('Invalid healer fixture before enter');
    enter();clearStoryTheater();closeDialog();G.frozen=true;G.running=true;
    GameVoice.configure({enabled:false});G.muted=true;
    for(const m of monsters){m.alive=false;m.model.visible=false;}
    hazards=[];
    const model=world.getObjectByName('tower-party-scene')?.children.find(m=>m.userData.companionId===this.id);
    if(!model)throw Error('Missing actual healer companion model');
    model.position.set(G.px,0,G.pz);partyUI.heroes.hud(true);
    const quote=Heroes.cast(run,'herbal_heal',{actorId:this.id,targetId:'hero',nearby:Heroes.ids(run)},run.revision);
    if(!quote.ok)throw Error('Invalid healing quote: '+quote.message);
    this.expected={hp:Heroes.hp(quote.run,'hero'),herb:quote.run.party.ingredients.herb,cooldown:Heroes.actor(quote.run,this.id).cooldowns.herbal_heal,power:quote.effect.power};
    return this.state();
  },
  state(){const p=TowerHeroGrowth.state(run).policies[this.id];return {floor:run.floor,seed:this.seedValue,id:this.id,recruitment:this.recruitment,hp:Heroes.hp(run,'hero'),maxHp:Heroes.maxHp(run,'hero'),herb:run.party.ingredients.herb,cooldown:Heroes.actor(run,this.id).cooldowns.herbal_heal,policy:{strategy:p.strategy,materials:p.materials,potionEnabled:p.heal.enabled},expected:this.expected,valid:!!C.validateSave(run),running:G.running,frozen:G.frozen,paused};},
  tick(){partyUI.heroes.tick(.4);return this.state();},
  resume(){clearStoryTheater();closeDialog();G.frozen=true;G.running=true;TowerHeroGrowth.state(run).policies[this.id].thinkLeft=0;return this.state();}
};`;
assert.ok(mode.includes('  install();\n})();'),'private bridge anchor remains exact');
await mkdir(out,{recursive:true});
const report={version,base,localFixture:true,renderer:'existing #c3d game renderer',entry:[],models:[],frames:[],faces:[],healing:[],atlas:[],loaded:[],errors:[],blocked:[],sockets:[],limitations:['Desktop Chrome software WebGL is functional evidence, not physical iPhone performance.','The isolated healing bridge freezes world simulation and manually ticks the real companion runtime.','Armor tier zero is base clothing with a tier-one sword; no nonexistent tier-zero item is fabricated.']};
const responseWork=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
async function makePage(viewport,{fixture=false,atlas=false}={}){
  const c=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block'}),p=await c.newPage();p.setDefaultTimeout(20000);
  p.on('pageerror',e=>report.errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  p.on('response',r=>{const u=new URL(r.url());if(u.origin===new URL(base).origin&&(/\.(js|html|css)(?:\?|$)/.test(r.url())||u.pathname==='/'))responseWork.push((async()=>{const body=await r.body();report.loaded.push({url:r.url(),fixture:fixture&&u.pathname==='/story/tower-mode.js',sha256:createHash('sha256').update(body).digest('hex'),status:r.status()});})().catch(e=>report.errors.push(e.message)));});
  await c.route('**/*',r=>{const q=r.request();if(!['GET','HEAD'].includes(q.method())||new URL(q.url()).origin!==new URL(base).origin){report.blocked.push(q.url());return r.abort();}return r.continue();});
  await p.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));await p.route('**/api/scores*',r=>r.fulfill({json:[]}));
  await p.addInitScript(()=>{window.__roomAttempts=[];window.WebSocket=class{constructor(url){window.__roomAttempts.push(url);throw Error('Room connections are forbidden in isolated QA');}};});
  if(fixture)await p.route('**/story/tower-mode.js*',r=>r.fulfill({contentType:'application/javascript',body:mode.replace('  install();\n})();','  install();\n'+bridge+'\n})();')}));
  await p.goto(atlas?new URL('docs/職業裝備圖鑑.html',base).href:base,{waitUntil:'domcontentloaded',timeout:60000});
  if(atlas){await p.waitForFunction(()=>document.documentElement.dataset.atlasReady==='true',null,{timeout:60000});assert.ok((await p.locator('.topbar').innerText()).includes('v'+version));return {c,p};}
  await p.waitForFunction(()=>typeof TowerMode==='object'&&typeof TowerHeroVisuals==='object'&&typeof GAME_VERSION==='string',null,{timeout:60000});
  assert.equal(await p.evaluate(()=>GAME_VERSION),version);await p.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  return {c,p};
}
async function resumeNatural(p){
  const skip=p.locator('[data-cinema="skip"]');if(await skip.isVisible())await skip.tap();
  const close=p.locator('[data-tower="close"]').first();if(await close.isVisible())await close.tap();
  await p.waitForFunction(()=>TowerMode.active&&!TowerMode.paused&&G.running&&!G.frozen,null,{timeout:15000});
}
async function screenshot(p,name){await p.screenshot({path:out+'/'+name+'.png'});return name+'.png';}
try{
  for(const [width,height]of [[1440,900],[844,390],[568,320]]){
    const {c,p}=await makePage({width,height});page=p;report.currentCase={case:'natural-entry',width,height};
    await p.locator('#enterMenuBtn').tap();assert.ok(await p.locator('#storyEntryBtn').isVisible());await screenshot(p,width+'-home');
    await p.locator('#mpBtn').tap();await p.locator('#playerName').fill('隔離畫面驗證');await p.locator('#profileNextBtn').tap();await p.locator('#startBtn').tap();
    assert.ok(await p.locator('#mpCreate').isVisible());assert.ok(await p.locator('#mpJoin').isVisible());assert.deepEqual(await p.evaluate(()=>({on:MP.on,sockets:__roomAttempts.length})),{on:false,sockets:0});await screenshot(p,width+'-multiplayer-entry');
    await p.locator('#mpClose').tap();await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof TowerMode==='object'&&typeof TowerHeroes==='object');await p.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
    await p.locator('#enterMenuBtn').tap();await p.locator('#storyEntryBtn').tap();await p.locator('[data-tower="new"]').tap();
    const jobs=await p.locator('[data-tower="profession"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item));report.currentCase.jobs=jobs;
    assert.equal(jobs.length,8);assert.equal(new Set(jobs).size,8);assert.ok(jobs.includes('swordsman'));assert.equal(await p.locator('.hero-skill-list').count(),0);await screenshot(p,width+'-eight-professions');
    await p.locator('#heroNameInput').fill('劍士自然入口');await p.locator('[data-tower="profession"][data-item="swordsman"]').tap();assert.equal(await p.locator('.hero-skill-list article').count(),5);await screenshot(p,width+'-skill-reveal');
    await p.locator('[data-tower="hero-create-start"]').tap();await resumeNatural(p);
    const save=await p.evaluate(()=>{const r=TowerCore.validateSave(JSON.parse(localStorage.getItem('maze3d_tower_v1')));return {valid:!!r,floor:r?.floor,job:r?.party.profession,running:G.running,frozen:G.frozen,active:TowerMode.active,paused:TowerMode.paused,sockets:__roomAttempts.length};});
    report.currentCase.save=save;assert.deepEqual(save,{valid:true,floor:99,job:'swordsman',running:true,frozen:false,active:true,paused:false,sockets:0});await screenshot(p,width+'-natural-new-game');
    await p.locator('#towerBagBtn').tap();assert.ok(await p.locator('#towerDialog').isVisible());await screenshot(p,width+'-bag');await resumeNatural(p);
    await p.locator('#towerJournalBtn').tap();assert.ok(await p.locator('#towerDialog').isVisible());await screenshot(p,width+'-journal');await resumeNatural(p);
    const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);report.entry.push({width,height,jobs,save,bag:true,journal:true,multiplayerChooser:true,overflow});report.sockets.push(...await p.evaluate(()=>__roomAttempts));await c.close();
  }
  {const {c,p}=await makePage({width:390,height:844});page=p;report.currentCase={case:'portrait-gate'};assert.ok(await p.locator('#landscapeGate').isVisible());await screenshot(p,'390-portrait-gate');report.entry.push({width:390,height:844,portraitGate:true});await c.close();}
  {
    const {c,p}=await makePage({width:1440,height:900});page=p;report.currentCase={case:'actual-renderer-studio'};
    await p.evaluate(()=>{
      const T=THREE,canvas=renderer.domElement,original={parent:canvas.parentNode,next:canvas.nextSibling,style:canvas.getAttribute('style'),pixelRatio:renderer.getPixelRatio(),size:renderer.getSize(new T.Vector2()).toArray()};
      if(document.getElementById('gameScreen').classList.contains('active'))throw Error('Studio must not compete with active game rendering');
      document.body.append(canvas);Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'2147483645'});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight,false);
      const scene=new T.Scene();scene.background=new T.Color(0x182734);scene.add(new T.HemisphereLight(0xfff5e5,0x48667b,1.35));
      const key=new T.DirectionalLight(0xffe9cf,1.8);key.position.set(-4,6,7);scene.add(key);const rim=new T.DirectionalLight(0x90cdff,1.2);rim.position.set(3,4,-4);scene.add(rim);
      const camera=new T.OrthographicCamera(-4,4,3.6,-.6,.1,40);camera.position.set(0,2,9);camera.lookAt(0,1.3,0);
      const overlay=document.createElement('div');Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483646',color:'#fff4d8',fontFamily:'system-ui,sans-serif',pointerEvents:'none'});document.body.append(overlay);
      const title=document.createElement('div');Object.assign(title.style,{position:'absolute',left:'32px',top:'22px',fontSize:'25px',fontWeight:'650',textShadow:'0 2px 4px #000'});overlay.append(title);
      const labels=['男劍士','女劍士'].map((text,i)=>{const label=document.createElement('div');label.textContent=text;Object.assign(label.style,{position:'absolute',left:(i?75:25)+'%',bottom:'28px',transform:'translateX(-50%)',fontSize:'24px',padding:'8px 18px',background:'#0b182bdd',borderRadius:'12px'});overlay.append(label);return label;});
      renderer.render(scene,camera);const baseline={...renderer.info.memory};
      const snapshot=m=>{let meshes=0,triangles=0;const geometries=new Set(),allocated=new Set(),materials=new Set();m.traverse(o=>{if(o.isMesh){allocated.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);}});m.traverseVisible(o=>{if(o.isMesh){meshes++;geometries.add(o.geometry);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {meshes,triangles,visibleGeometry:geometries.size,allocatedGeometry:allocated.size,materials:materials.size};};
      async function fingerprint(m){const geometries=new Set();m.traverseVisible(o=>{if(o.isMesh)geometries.add(o.geometry);});const chunks=[];let bytes=0;const add=b=>{chunks.push(b);bytes+=b.byteLength;};for(const g of geometries){for(const name of Object.keys(g.attributes).sort()){const a=g.attributes[name];add(new TextEncoder().encode(name+':'+a.itemSize+':'+a.count+':'));add(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(g.index)add(new Uint8Array(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));}const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}const hash=await crypto.subtle.digest('SHA-256',buffer);return {sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),bytes};}
      window.__knightStudio={scene,camera,renderer,models:[],baseline,original,canvas,overlay,labels,title,snapshot,
        clear(){for(const m of this.models){scene.remove(m);disposeSceneObject(m);}this.models=[];},
        async build(kind,tier){this.clear();const H=TowerHeroes,V=TowerHeroVisuals,item=(base,slot,t=tier)=>({kind:H.tierKind(base,t),slot,durability:100,maxDurability:100});
          for(let i=0;i<2;i++){const m=V.base('swordsman',buildCharacter,'hero',i?'female':'male');m.position.x=i?1.25:-1.25;
            const eq={weapon:item(kind,'weapon',Math.max(1,tier))};if(tier){eq.armor=item('heavy_armor','armor');eq.helmet=item('heavy_helm','helmet');}if(kind==='longsword')eq.shield=item('round_shield','shield',Math.max(1,tier));
            V.dress(T,m,eq,disposeSceneObject,{showHelmet:false});TowerCombatMotion.cancel(m);V.pose(m,0,1,false,0);scene.add(m);this.models.push(m);
            m.userData.qaEquipment=eq;
          }
          return await Promise.all(this.models.map(async m=>{const box=new T.Box3().setFromObject(m),size=box.getSize(new T.Vector3());return {kind,tier,sex:m.userData.heroSex,bodyBounds:size.toArray(),scale:m.scale.toArray(),...snapshot(m),geometry:await fingerprint(m)};}));
        },
        frame(kind,tier,view,variant=null,progress=0,skillId=null){const angles={front:0,side:Math.PI/2,back:Math.PI},skill=skillId?TowerHeroes.SKILLS[skillId]:null;
          if(skillId&&!skill)throw Error('Unknown real skill '+skillId);
          for(const m of this.models){m.rotation.y=angles[view];if(variant===null&&!skill)TowerCombatMotion.cancel(m);else{TowerCombatMotion.begin(m,skill?'skill':'attack',1,skill);const state=TowerCombatMotion.state(m);state.variant=variant??0;state.elapsed=progress;}TowerHeroVisuals.pose(m,0,1,false,0);}
          scene.updateMatrixWorld(true);const bounds=new T.Box3();for(const m of this.models)bounds.union(new T.Box3().setFromObject(m));
          const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),height=Math.max(size.y+1.2,(size.x+1.1)*innerHeight/innerWidth),width=height*innerWidth/innerHeight;
          camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.position.set(center.x,center.y,9);camera.lookAt(center.x,center.y,0);camera.updateProjectionMatrix();
          title.textContent=(kind==='longsword'?'長劍與盾':'雙手劍')+' · '+(tier?'第 '+tier+' 階':'基礎服裝')+' · '+({front:'正面',side:'側面',back:'背面'}[view])+(skill?'／'+skill.name+' · '+Math.round(progress*100)+'%':variant===null?'／自然握劍':'／動作 '+(variant+1)+' · '+Math.round(progress*100)+'%');
          renderer.compile(scene,camera);renderer.render(scene,camera);
          return this.models.map(m=>{const w=m.userData.heroPieces.find(p=>p.userData.baseKind===m.userData.heroWeapon),contact=w?.userData.contact;
            if(!contact)throw Error('Sword lacks actual contact metadata');const physicalHand=!!m.userData.knightRightHand,hand=physicalHand?m.userData.knightRightHand.getWorldPosition(new T.Vector3()):m.userData.armR.localToWorld(new T.Vector3(...(m.userData.heroGrip||[0,-.36,.13]))),grip=w.localToWorld(new T.Vector3(...contact.grip));
            const normal=new T.Vector3(...contact.normal).applyNormalMatrix(new T.Matrix3().getNormalMatrix(w.matrixWorld));const axis=new T.Vector3(...contact.axis).transformDirection(w.matrixWorld);let supportError=null;
            if(contact.supportGrip&&m.userData.swordSupportArm?.hand){const support=w.localToWorld(new T.Vector3(...contact.supportGrip));supportError=support.distanceTo(m.userData.swordSupportArm.hand.getWorldPosition(new T.Vector3()));}
            let finite=true;m.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))finite=false;});const shaders=(renderer.info.programs||[]).map(p=>({linked:renderer.getContext().getProgramParameter(p.program,renderer.getContext().LINK_STATUS),log:renderer.getContext().getProgramInfoLog(p.program)}));
            return {sex:m.userData.heroSex,kind,tier,view,variant,progress,skillId,family:skill?TowerCombatMotion.familyFor(skill):null,physicalHand,gripError:hand.distanceTo(grip),supportError,edgeNormal:normal.toArray(),bladeAxis:axis.toArray(),finite,shaders,...snapshot(m),draw:{...renderer.info.render}};
          });
        },
        face(view,helmet=false){
          const m=this.models[0];this.models[1].visible=false;m.position.x=0;m.rotation.y=({front:0,threequarter:.6,side:Math.PI/2})[view];
          TowerHeroVisuals.dress(THREE,m,m.userData.qaEquipment,disposeSceneObject,{showHelmet:helmet});TowerCombatMotion.cancel(m);TowerHeroVisuals.pose(m,0,1,false,0);CharacterFace.update(m,1,'calm');
          scene.updateMatrixWorld(true);const head=new T.Box3().setFromObject(m.userData.headMesh),center=head.getCenter(new T.Vector3()),h=.58;
          camera.left=-h*innerWidth/innerHeight;camera.right=h*innerWidth/innerHeight;camera.top=h;camera.bottom=-h;camera.position.set(center.x,center.y,9);camera.lookAt(center.x,center.y,0);camera.updateProjectionMatrix();
          for(const label of labels)label.style.display='none';title.textContent='男劍士 · 無鬢邊短髮 · '+({front:'正面',threequarter:'斜側面',side:'側面'})[view]+(helmet?' · 戴上頭盔':' · 隱藏頭盔');
          renderer.compile(scene,camera);renderer.render(scene,camera);const size=head.getSize(new T.Vector3());
          return {view,helmet,knightFace:!!m.userData.headMesh.geometry.userData.knightFace,headBounds:size.toArray(),...snapshot(m)};
        },
        close(){this.clear();renderer.render(scene,camera);const after={...renderer.info.memory};overlay.remove();original.parent.insertBefore(canvas,original.next);if(original.style===null)canvas.removeAttribute('style');else canvas.setAttribute('style',original.style);renderer.setPixelRatio(original.pixelRatio);renderer.setSize(...original.size,false);return {baseline,after,delta:{geometries:after.geometries-baseline.geometries,textures:after.textures-baseline.textures},restored:canvas.parentNode===original.parent};}
      };
    });
    for(const kind of ['longsword','greatsword'])for(const tier of [0,1,2,3,4,5]){
      report.currentCase={case:'build',kind,tier};const models=await p.evaluate(([k,t])=>__knightStudio.build(k,t),[kind,tier]);report.models.push(...models);report.currentCase.models=models;
      assert.ok(models.every(m=>m.meshes<90&&m.triangles<11500),'visible character budget');assert.notEqual(models[0].geometry.sha256,models[1].geometry.sha256,'male/female must use different actual geometry');
      for(const view of ['front','side','back']){
        const records=await p.evaluate(([k,t,v])=>__knightStudio.frame(k,t,v),[kind,tier,view]);report.currentCase={case:'rest',kind,tier,view,records};
        assert.ok(records.every(m=>m.finite&&m.gripError<1e-6&&m.shaders.every(s=>s.linked)));if(kind==='greatsword')assert.ok(records.filter(m=>m.sex==='male').every(m=>m.supportError!==null&&m.supportError<1e-6),'actual redesigned second-hand grip contact');
        if(view==='front')assert.ok(records.every(m=>Math.abs(m.edgeNormal[2])>.8),'sword cutting faces point forward/back at rest');
        report.frames.push({kind,tier,view,records,screenshot:await screenshot(p,kind+'-t'+tier+'-rest-'+view)});
      }
      for(const variant of [0,1])for(const progress of [.22,.48,.7]){
        const records=await p.evaluate(([k,t,v,pr])=>__knightStudio.frame(k,t,'front',v,pr),[kind,tier,variant,progress]);report.currentCase={case:'attack',kind,tier,variant,progress,records};
        assert.ok(records.every(m=>m.finite&&m.shaders.every(s=>s.linked)));assert.ok(records.filter(m=>m.sex==='male').every(m=>m.physicalHand&&m.gripError<1e-6));if(kind==='greatsword')assert.ok(records.filter(m=>m.sex==='male').every(m=>m.supportError!==null&&m.supportError<1e-6));
        assert.ok(records.every((m,i)=>m.allocatedGeometry===models[i].allocatedGeometry),'animation must not allocate extra geometry');
        report.frames.push({kind,tier,view:'front',variant,progress,records,screenshot:await screenshot(p,kind+'-t'+tier+'-attack'+variant+'-'+Math.round(progress*100))});
      }
      if(kind==='greatsword')for(const skillId of ['whirlwind','guard_stance','rally'])for(const progress of [.22,.48,.7]){
        const records=await p.evaluate(([k,t,id,pr])=>__knightStudio.frame(k,t,'front',0,pr,id),[kind,tier,skillId,progress]);report.currentCase={case:'greatsword-skill',kind,tier,skillId,progress,records};
        assert.ok(records.every(m=>m.finite&&m.shaders.every(s=>s.linked)));assert.ok(records.filter(m=>m.sex==='male').every(m=>m.physicalHand&&m.gripError<1e-6&&m.supportError!==null&&m.supportError<1e-6),'redesigned skill support grip stays on hilt');
        assert.ok(records.every((m,i)=>m.allocatedGeometry===models[i].allocatedGeometry),'skill motion must not allocate extra geometry');
        report.frames.push({kind,tier,view:'front',skillId,progress,records,screenshot:await screenshot(p,kind+'-t'+tier+'-skill-'+skillId+'-'+Math.round(progress*100))});
      }
    }
    for(const tier of [1,2,3,4,5]){
      await p.evaluate(t=>__knightStudio.build('longsword',t),tier);
      for(const view of ['front','threequarter','side'])for(const helmet of [false,true]){
        report.currentCase={case:'face-closeup',tier,view,helmet};const result=await p.evaluate(([v,h])=>__knightStudio.face(v,h),[view,helmet]);
        assert.ok(result.knightFace);if(view==='front')assert.ok(result.headBounds[1]/result.headBounds[0]>1.3);assert.ok(result.meshes<90&&result.triangles<11500);
        report.faces.push({tier,...result,screenshot:await screenshot(p,'face-t'+tier+'-'+view+'-'+(helmet?'helmet':'hair'))});
      }
    }
    report.memory=await p.evaluate(()=>__knightStudio.close());assert.deepEqual(report.memory.delta,{geometries:0,textures:0});assert.equal(report.memory.restored,true);await c.close();
  }
  {
    const {c,p}=await makePage({width:844,height:390},{fixture:true});page=p;report.currentCase={case:'healing-material-permission'};
    const initial=await p.evaluate(()=>__knightHealingQA.seed());report.currentCase.initial=initial;assert.ok(initial.valid&&initial.running&&!initial.paused);assert.equal(initial.policy.materials,false);assert.equal(initial.expected.cooldown,5);assert.equal(initial.expected.power,30);
    const disabled=await p.evaluate(()=>__knightHealingQA.tick());report.currentCase.disabled=disabled;assert.equal(disabled.hp,initial.hp);assert.equal(disabled.herb,initial.herb);assert.equal(disabled.cooldown,0);report.healing.push({case:'materials-off',initial,after:disabled});await screenshot(p,'healing-materials-disabled');
    // Walk the player's real settings path. The bridge controls world timing,
    // but does not toggle permission or open the management panel for us.
    await p.locator('#towerBagBtn').tap();await p.locator('[data-tower="hero-panel"]').first().tap();
    await p.locator('#towerDialog .hero-tabs [data-tower="hero-panel"][data-item="'+initial.id+'"]').tap();
    await p.locator('[data-tower="hero-policy"][data-item="'+initial.id+'"]').tap();
    const permission=p.locator('[data-growth="materials"]');assert.ok(await permission.isVisible());assert.equal(await permission.isChecked(),false);await permission.check();assert.equal(await permission.isChecked(),true);
    await screenshot(p,'healing-materials-setting');report.healing.push({case:'actual-policy-ui-path',path:['背包','队伍與逐人裝備','療癒師','自動行動／快捷欄','允許技能消耗食材／零件'],visible:true,checked:true});
    const allowed=await p.evaluate(()=>__knightHealingQA.resume());report.currentCase.allowed=allowed;assert.equal(allowed.policy.materials,true);const healed=await p.evaluate(()=>__knightHealingQA.tick());report.currentCase.healed=healed;
    assert.equal(healed.hp,initial.expected.hp);assert.equal(healed.herb,initial.expected.herb);assert.equal(healed.cooldown,5);assert.ok(healed.valid);assert.equal(healed.policy.potionEnabled,false);report.healing.push({case:'materials-on-real-companion-runtime',before:allowed,after:healed});await screenshot(p,'healing-materials-enabled');
    report.sockets.push(...await p.evaluate(()=>__roomAttempts));await c.close();
  }
  for(const [width,height]of [[844,390],[568,320],[390,844]]){
    const {c,p}=await makePage({width,height},{atlas:true});page=p;
    for(const [name,id]of [['草藥療癒','herbal_heal'],['黎明聖域','dawn_sanctuary']]){
      report.currentCase={case:'natural-atlas-search',width,height,name};await p.locator('#search').fill(name);
      const card=p.locator('#entry-skills-'+id);assert.ok(await card.isVisible());await card.locator('summary').tap();
      const actual=await card.evaluate(node=>({name:node.querySelector('h3').textContent,rankOne:node.querySelector('.rank-table td')?.textContent,facts:Object.fromEntries([...node.querySelectorAll('.facts>div')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])),open:node.querySelector('details').open,icon:!!node.querySelector('.art svg'),overflow:node.scrollWidth>node.clientWidth+1,documentOverflow:document.documentElement.scrollWidth>innerWidth}));report.currentCase.actual=actual;
      assert.equal(actual.name,name);assert.ok(actual.open&&actual.icon);assert.equal(actual.overflow,false);assert.equal(actual.documentOverflow,false);
      if(id==='herbal_heal'){assert.equal(actual.facts['冷卻'],'5 秒');assert.equal(Number.parseFloat(actual.rankOne),30);}
      else{assert.ok(actual.facts['持續／附帶效果'].includes('60%'));assert.ok(actual.facts['持續／附帶效果'].includes('45%'));}
      const shot=width+'-atlas-'+id;await screenshot(p,shot);await card.screenshot({path:out+'/'+shot+'-complete-card.png'});report.atlas.push({width,height,id,...actual,screenshot:shot+'.png',completeCard:shot+'-complete-card.png'});
    }
    report.sockets.push(...await p.evaluate(()=>__roomAttempts));await c.close();
  }
  await Promise.all(responseWork);assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.sockets,[]);
  report.sourceHashes=[];
  for(const path of ['/','/assets/character-sculpt.js','/assets/character-face.js','/story/tower-heroes-visuals.js','/story/tower-combat-motion.js','/story/tower-heroes-core.js','/story/tower-hero-growth.js','/story/tower-heroes-runtime.js','/story/tower-mode.js','/story/tower-ascension-catalog.js','/story/tower-cooperation-core.js','/story/tower-growth-runtime.js','/docs/職業裝備圖鑑.html','/docs/story-atlas-rules.js']){
    const loaded=report.loaded.filter(r=>decodeURIComponent(new URL(r.url).pathname)===path&&r.status===200&&!r.fixture).at(-1);assert.ok(loaded,'missing natural response '+path);
    const sha256=createHash('sha256').update(await readFile(new URL(path==='/'?'../index.html':'..'+path,import.meta.url))).digest('hex');assert.equal(loaded.sha256,sha256,'source changed after actual browser load '+path);report.sourceHashes.push({path,sha256,url:loaded.url});
  }
  report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await Promise.allSettled(responseWork);await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,entry:report.entry.length,models:report.models.length,frames:report.frames.length,faces:report.faces.length,healing:report.healing.length,atlas:report.atlas.length,memory:report.memory,errors:report.errors,failure:report.failure,report:out+'/report.json'}));}
