// Local-only actual-model previews. Run through Process Guard against a managed
// server. Uses the game's existing #c3d renderer; never opens a room or publishes.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8798/';
const out=process.env.MAZE_QA_OUT||'.agent-run/profession-lineup-qa';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'preview must stay on the local managed server');
const origin=new URL(base).origin;
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
await mkdir(out,{recursive:true});
const report={version,base,renderer:'existing #c3d game renderer',projection:'fixed horizontal orthographic',localOnly:true,models:[],previews:[],loaded:[],errors:[],blocked:[],sockets:[],limitations:['These are the actual game meshes, not concept art.','Model heights use the live indexed vertices, not unused vertex-buffer extents.','Desktop software WebGL proves rendering and layout, not physical iPhone performance.','Only first-tier equipment is shown; robot cores are not fabricated or granted to a save.']};
const responseWork=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
let page;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{
  const context=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.stack));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&(u.pathname==='/'||/\.(?:js|html|css)$/.test(u.pathname)))responseWork.push((async()=>{const body=await r.body();report.loaded.push({url:r.url(),status:r.status(),sha256:createHash('sha256').update(body).digest('hex')});})().catch(e=>report.errors.push(e.message)));});
  await context.route('**/*',r=>{const q=r.request();if(!['GET','HEAD'].includes(q.method())||new URL(q.url()).origin!==origin){report.blocked.push({url:q.url(),method:q.method()});return r.abort();}return r.continue();});
  await page.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));
  await page.route('**/api/scores*',r=>r.fulfill({json:[]}));
  await page.addInitScript(()=>{window.__roomAttempts=[];window.WebSocket=class{constructor(url){window.__roomAttempts.push(url);throw Error('No room connection is permitted in isolated previews');}};});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof renderer==='object'&&renderer?.domElement&&typeof TowerHeroVisuals==='object'&&typeof TowerHeroes==='object'&&typeof buildCharacter==='function',null,{timeout:60000});
  assert.equal(await page.evaluate(()=>GAME_VERSION),version);
  await page.evaluate(()=>{GameVoice.configure({enabled:false});G.muted=true;});
  report.setup=await page.evaluate(()=>{
    const T=THREE,H=TowerHeroes,V=TowerHeroVisuals,canvas=renderer.domElement;
    if(canvas.id!=='c3d')throw Error('The preview must reuse the game canvas');
    if(document.getElementById('gameScreen').classList.contains('active'))throw Error('Do not compete with an active game render loop');
    const original={parent:canvas.parentNode,next:canvas.nextSibling,style:canvas.getAttribute('style'),size:renderer.getSize(new T.Vector2()).toArray(),pixelRatio:renderer.getPixelRatio()};
    document.body.append(canvas);Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'2147483645'});
    renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight,false);
    const scene=new T.Scene();scene.background=new T.Color(0x142431);
    scene.add(new T.HemisphereLight(0xfff5e8,0x567287,1.35));
    const key=new T.DirectionalLight(0xffead3,1.65);key.position.set(-4,6,9);scene.add(key);
    const fill=new T.DirectionalLight(0xb5dbef,.75);fill.position.set(5,3,8);scene.add(fill);
    const rim=new T.DirectionalLight(0x95cffa,1.05);rim.position.set(3,4,-5);scene.add(rim);
    // Horizontal optical axis, one projection for all sixteen characters.
    // Do not fit a camera to each person's height, scale or equipment bounds.
    const camera=new T.OrthographicCamera(-2.925,2.925,1.95,-1.95,.1,40);
    camera.position.set(0,1.3,10);camera.lookAt(0,1.3,0);camera.updateProjectionMatrix();
    const overlay=document.createElement('div');Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483646',pointerEvents:'none',fontFamily:'system-ui,sans-serif',color:'#f8e9cc'});document.body.append(overlay);
    const title=document.createElement('div');Object.assign(title.style,{position:'absolute',top:'27px',left:'32px',fontSize:'32px',fontWeight:'750',letterSpacing:'.03em'});overlay.append(title);
    const subtitle=document.createElement('div');Object.assign(subtitle.style,{position:'absolute',top:'77px',left:'33px',fontSize:'20px',color:'#b8cfdf'});overlay.append(subtitle);
    const labels=['male','female'].map((sex,i)=>{const n=document.createElement('div');Object.assign(n.style,{position:'absolute',left:(i?73.932:26.068)+'%',top:'704px',transform:'translateX(-50%)',textAlign:'center',whiteSpace:'nowrap'});overlay.append(n);return n;});
    const groundGeo=new T.BoxGeometry(5.62,.009,.006),groundMat=new T.MeshBasicMaterial({color:0x658a9f});
    const ground=new T.Mesh(groundGeo,groundMat);ground.position.set(0,0,-.6);scene.add(ground);
    // THREE.Sprite owns one library-wide geometry, not one per character.
    // The production disposer intentionally leaves that shared geometry alive.
    // Warm the real shared buffer before the baseline (no cloned geometry or
    // texture), then prove every actual robot sprite uses this same identity.
    const warmMaterial=new T.SpriteMaterial({color:0xffffff}),warmSprite=new T.Sprite(warmMaterial),sharedSpriteGeometry=warmSprite.geometry;
    warmSprite.position.set(0,1,0);scene.add(warmSprite);renderer.render(scene,camera);scene.remove(warmSprite);warmMaterial.dispose();
    const sharedSpriteCache={uuid:sharedSpriteGeometry.uuid,ownedByModel:false,warmedBeforeBaseline:true,textureAllocation:0,actualModelSprites:0};
    renderer.render(scene,camera);const baseline={...renderer.info.memory};
    // Box3.setFromObject includes unused vertex-buffer points and invisible
    // objects. Measure only the positions that the actual index draws.
    const bounds=(root,filter=()=>true)=>{const result=new T.Box3(),v=new T.Vector3();root.updateWorldMatrix(true,true);root.traverseVisible(o=>{
      const p=o.geometry?.attributes?.position;if(!o.isMesh||!p||!filter(o))return;
      const index=o.geometry.index,count=index?index.count:p.count;
      for(let i=0;i<count;i++){const n=index?index.getX(i):i;v.set(p.getX(n),p.getY(n),p.getZ(n)).applyMatrix4(o.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('Nonfinite visible indexed vertex '+o.name);result.expandByPoint(v);}
    });if(result.isEmpty())throw Error('No visible geometry for indexed bounds');return result;};
    const bodyBounds=m=>{const pieces=new Set(m.userData.heroPieces||[]);return bounds(m,o=>{for(let n=o;n&&n!==m;n=n.parent)if(pieces.has(n))return false;return true;});};
    const equipment=(job,tier=1)=>{
      const def=H.JOBS[job],item=(kind,slot)=>({id:'preview-'+job+'-'+slot,kind:H.tierKind(kind,tier),slot,durability:100,maxDurability:100});
      if(job==='robot')return {weapon:item('robot_fists','weapon'),armor:item('robot_shell','armor')};
      const armor=def.armor==='heavy'?'heavy_armor':def.armor==='robe'?'robe':'light_armor';
      const helmet=def.armor==='heavy'?'heavy_helm':def.armor==='robe'?'rune_crown':'light_hood';
      const e={weapon:item(def.starter,'weapon'),armor:item(armor,'armor'),helmet:item(helmet,'helmet')};
      if(H.GEAR[e.weapon.kind].hands===1)e.shield=item('round_shield','shield');return e;
    };
    const finite=m=>m.traverse(o=>{for(const a of Object.values(o.geometry?.attributes||{}))if(!Array.from(a.array).every(Number.isFinite))throw Error('Nonfinite geometry '+o.name);if(!o.matrixWorld.elements.every(Number.isFinite))throw Error('Nonfinite transform '+o.name);});
    const snapshot=m=>{let meshes=0,triangles=0;const geo=new Set();m.traverseVisible(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geo.add(o.geometry);}});return {visibleMeshes:meshes,visibleTriangles:triangles,visibleGeometry:geo.size};};
    const cameraState=()=>({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,pixelsPerWorldUnit:innerHeight/(camera.top-camera.bottom),opticalAxis:camera.getWorldDirection(new T.Vector3()).toArray()});
    const fixedCamera=JSON.stringify(cameraState());
    window.__professionLineup={scene,camera,models:[],baseline,original,overlay,labels,title,subtitle,bodyBounds,bounds,sharedSpriteCache,
      clear(){for(const m of this.models){scene.remove(m);disposeSceneObject(m);}this.models=[];renderer.render(scene,camera);const now={...renderer.info.memory};if(now.geometries!==baseline.geometries||now.textures!==baseline.textures)throw Error('Model recycle resource mismatch '+JSON.stringify({baseline,now}));return now;},
      build(job,helmet=false,tier=1){this.clear();if(!H.JOBS[job])throw Error('Unknown actual profession '+job);const rows=[];
        for(const [i,sex]of ['male','female'].entries()){
          const m=V.base(job,buildCharacter,'hero',sex),eq=equipment(job,tier);V.dress(T,m,eq,disposeSceneObject,{showHelmet:helmet});TowerCombatMotion.cancel(m);V.pose(m,0,1,false,0);m.rotation.y=0;
          for(let n=0;n<16;n++)CharacterFace.update(m,.55+n*.016,'calm');
          m.updateMatrixWorld(true);const feet=new T.Box3();for(const key of ['legL','legR'])feet.union(bounds(m.userData[key]));
          // Translation only: every person's actual body scale is retained.
          m.position.set(i?1.4:-1.4,-feet.min.y,0);scene.add(m);m.updateMatrixWorld(true);this.models.push(m);finite(m);
          m.traverse(o=>{if(o.isSprite){if(o.geometry!==sharedSpriteGeometry)throw Error('Actual model unexpectedly owns a different Sprite geometry');sharedSpriteCache.actualModelSprites++;}});
          const alignedFeet=new T.Box3();for(const key of ['legL','legR'])alignedFeet.union(bounds(m.userData[key]));
          const body=bodyBounds(m),all=bounds(m),head=bounds(m.userData.headMesh),size=all.getSize(new T.Vector3());
          const row={job,name:H.JOBS[job].name,sex,helmet,tier,scale:m.scale.toArray(),groundY:alignedFeet.min.y,bodyHeight:body.max.y,headHeight:head.max.y-head.min.y,headTop:head.max.y,bodyBounds:{min:body.min.toArray(),max:body.max.toArray()},visibleBounds:{min:all.min.toArray(),max:all.max.toArray()},visibleSize:size.toArray(),equipment:Object.values(eq).map(e=>({slot:e.slot,kind:e.kind,name:H.GEAR[e.kind].name})),...snapshot(m)};
          if(Math.abs(row.groundY)>1e-7)throw Error('Feet failed to align to the common zero baseline');
          const clip=new T.Vector3(all.max.x,all.max.y,0).project(camera),low=new T.Vector3(all.min.x,all.min.y,0).project(camera);if(Math.max(Math.abs(clip.x),Math.abs(low.x))>.99||clip.y>.80||low.y<-.86)throw Error('Actual model was clipped by the fixed camera '+job+' '+sex);
          labels[i].innerHTML='<div style="font-size:28px;font-weight:750">'+H.JOBS[job].name+' · '+(sex==='female'?'女':'男')+'</div><div style="font-size:18px;color:#bed3e2;margin-top:8px">模型高度 '+row.bodyHeight.toFixed(3)+' · 第一階裝備</div>';rows.push(row);
        }
        title.textContent='八職業造型 · '+H.JOBS[job].name;subtitle.textContent=(helmet?'顯示頭部裝備':'露髮造型')+' · 平視正面 · 同一比例／腳底對齊';
        scene.updateMatrixWorld(true);renderer.compile(scene,camera);renderer.render(scene,camera);
        if(JSON.stringify(cameraState())!==fixedCamera)throw Error('A profession changed the common camera');
        const gl=renderer.getContext(),shaders=(renderer.info.programs||[]).map(p=>({linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),runnable:p.diagnostics?.runnable!==false}));if(shaders.some(p=>!p.linked||!p.runnable))throw Error('GPU shader failed');
        return {job,helmet,rows,camera:cameraState(),draw:{...renderer.info.render},memory:{...renderer.info.memory},shaders};
      },
      robotDetail(sex,view){const pair=this.build('robot',false,5),m=this.models[sex==='female'?1:0];for(const model of this.models)model.visible=model===m;m.position.x=0;m.rotation.y=view==='side'?Math.PI/2:0;
        // A separately named close-up camera never mutates the common lineup
        // projection. Both genders use this same fixed close-up framing.
        const detail=new T.OrthographicCamera(-1.35,1.35,.9,-.9,.1,40);detail.position.set(0,1.48,10);detail.lookAt(0,1.48,0);detail.updateProjectionMatrix();
        for(const label of labels)label.style.display='none';title.textContent='機器人 · '+(sex==='female'?'女性':'男性')+' · 第五階機殼';subtitle.textContent=(view==='side'?'側面':'正面')+'近景 · 實際頭部、頸部與肩甲接合';renderer.compile(scene,detail);renderer.render(scene,detail);
        const gl=renderer.getContext(),shaders=(renderer.info.programs||[]).map(p=>({linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),runnable:p.diagnostics?.runnable!==false}));if(shaders.some(p=>!p.linked||!p.runnable))throw Error('Robot close-up shader failed');
        const head=bounds(m.userData.headMesh);finite(m);return {sex,view,tier:5,model:pair.rows[sex==='female'?1:0],headPosition:m.userData.head.position.toArray(),headBounds:{min:head.min.toArray(),max:head.max.toArray()},closeupCamera:{position:detail.position.toArray(),opticalAxis:detail.getWorldDirection(new T.Vector3()).toArray(),left:detail.left,right:detail.right,top:detail.top,bottom:detail.bottom},shaders,draw:{...renderer.info.render}};
      },
      professionDetail(job,sex,view,action='rest',variant=0){const pair=this.build(job,false,1),m=this.models[sex==='female'?1:0];for(const model of this.models)model.visible=model===m;m.position.x=0;m.rotation.y=view==='side'?Math.PI/2:view==='diagonal'?Math.PI/4:0;
        if(action!=='rest'){TowerCombatMotion.begin(m,action,1,action==='skill'?{presentation:{motion:'heal'}}:undefined);Object.assign(TowerCombatMotion.state(m),{elapsed:.48,variant});V.pose(m,0,1,false,0);}m.updateWorldMatrix(true,true);
        const detail=new T.OrthographicCamera(-1.95,1.95,1.3,-1.3,.1,40);detail.position.set(0,1.15,10);detail.lookAt(0,1.15,0);detail.updateProjectionMatrix();
        for(const label of labels)label.style.display='none';title.textContent=H.JOBS[job].name+' · '+(sex==='female'?'女性':'男性');subtitle.textContent=(view==='side'?'側面':view==='diagonal'?'斜側面':'正面')+' · '+(action==='rest'?'平時握持':action==='skill'?'施放療癒':'攻擊動作 '+(variant+1))+' · 遊戲實際模型';renderer.compile(scene,detail);renderer.render(scene,detail);finite(m);
        const pieces=m.userData.heroPieces.filter(p=>p.userData.baseKind===m.userData.heroWeapon),forward=new T.Vector3(Math.sin(m.rotation.y),0,Math.cos(m.rotation.y));
        const weapons=pieces.map(p=>{const axis=new T.Vector3(...p.userData.contact.axis).transformDirection(p.matrixWorld),hand=p.parent.localToWorld(new T.Vector3(0,-.36,.13)),grip=p.localToWorld(new T.Vector3(...p.userData.contact.grip));return {kind:p.userData.baseKind,parentIsHand:p.parent===m.userData.armR||p.parent===m.userData.armL,axis:axis.toArray(),forwardDot:axis.dot(forward),gripGap:hand.distanceTo(grip),bookOpen:p.userData.bookOpen??null};});
        if(job==='scout'&&action==='rest'&&weapons.some(p=>p.forwardDot>-.99))throw Error('Actual dagger point must face backward at rest');
        if(job==='healer'&&(weapons.length!==1||weapons[0].gripGap>1e-7||weapons[0].bookOpen!==(action==='rest'?0:1)))throw Error('Actual healer book is not closed/open and held by one hand');
        const gl=renderer.getContext(),shaders=(renderer.info.programs||[]).map(p=>({linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),runnable:p.diagnostics?.runnable!==false}));if(shaders.some(p=>!p.linked||!p.runnable))throw Error('Profession detail shader failed');return {job,sex,view,action,variant,model:pair.rows[sex==='female'?1:0],weapons,smithLegTrim:m.userData.smithLegTrim??0,beard:!!m.getObjectByName('profession-beard'),camera:{position:detail.position.toArray(),opticalAxis:detail.getWorldDirection(new T.Vector3()).toArray()},shaders,draw:{...renderer.info.render}};
      },
      close(){this.clear();if(!sharedSpriteCache.actualModelSprites)throw Error('Shared Sprite baseline was not confirmed by actual model sprites');scene.remove(ground);groundGeo.dispose();groundMat.dispose();renderer.render(scene,camera);const after={...renderer.info.memory},emptyBaseline={geometries:baseline.geometries-1,textures:baseline.textures};overlay.remove();original.parent.insertBefore(canvas,original.next);if(original.style===null)canvas.removeAttribute('style');else canvas.setAttribute('style',original.style);renderer.setPixelRatio(original.pixelRatio);renderer.setSize(...original.size,false);return {baseline:emptyBaseline,after,delta:{geometries:after.geometries-emptyBaseline.geometries,textures:after.textures-emptyBaseline.textures},sharedSpriteCache:{...sharedSpriteCache},restored:canvas.parentNode===original.parent,existingRenderer:renderer.domElement.id==='c3d'};}
    };
    return {jobs:Object.entries(H.JOBS).map(([id,j])=>({id,name:j.name})),camera:cameraState(),baseline,sharedSpriteCache:{...sharedSpriteCache}};
  });
  assert.equal(report.setup.jobs.length,8);assert.equal(new Set(report.setup.jobs.map(j=>j.id)).size,8);
  assert.ok(Math.abs(report.setup.camera.opticalAxis[1])<1e-10,'the camera is eye-level, not looking down');
  const crops={male:[],female:[]};
  for(const job of report.setup.jobs){
    for(const helmet of [false,true]){
      report.currentCase={job:job.id,helmet};const result=await page.evaluate(([j,h])=>__professionLineup.build(j,h),[job.id,helmet]);
      assert.equal(result.rows.length,2);assert.deepEqual(result.camera,report.setup.camera);assert.ok(result.shaders.every(p=>p.linked&&p.runnable));
      for(const row of result.rows){assert.ok(row.visibleTriangles<(row.job==='robot'?16000:11500));assert.ok(row.visibleMeshes<(row.job==='robot'?85:90));assert.ok(Math.abs(row.groundY)<1e-7);}
      const name=job.id+'-'+(helmet?'helmet':'hair')+'.png';await page.screenshot({path:out+'/'+name});report.previews.push({...result,screenshot:name});report.models.push(...result.rows);
      if(!helmet)for(const [i,sex]of ['male','female'].entries()){
        const crop=await page.screenshot({clip:{x:i*600,y:110,width:600,height:690},path:out+'/'+job.id+'-'+sex+'.png'});
        crops[sex].push({job:job.id,name:job.name,height:result.rows[i].bodyHeight,image:'data:image/png;base64,'+crop.toString('base64')});
      }
      console.log('actual-model eye-level preview',job.id,helmet?'helmet':'hair');
    }
  }
  report.robotDetails=[];
  for(const sex of ['male','female'])for(const view of ['front','side']){
    report.currentCase={job:'robot',tier:5,sex,view};const detail=await page.evaluate(([s,v])=>__professionLineup.robotDetail(s,v),[sex,view]);assert.ok(detail.shaders.every(p=>p.linked&&p.runnable));assert.ok(Math.abs(detail.closeupCamera.opticalAxis[1])<1e-10);const name='robot-t5-'+sex+'-'+view+'-closeup.png';await page.screenshot({path:out+'/'+name});report.robotDetails.push({...detail,screenshot:name});
  }
  report.professionDetails=[];
  for(const job of ['smith','scout','healer'])for(const sex of ['male','female'])for(const [view,action,variant]of job==='smith'?[['diagonal','rest',0]]:job==='scout'?[['side','rest',0],['diagonal','attack',0],['diagonal','attack',1]]:[['diagonal','rest',0],['diagonal','skill',0]]){
    report.currentCase={job,sex,view,action,variant};const detail=await page.evaluate(args=>__professionLineup.professionDetail(...args),[job,sex,view,action,variant]);assert.ok(detail.shaders.every(p=>p.linked&&p.runnable));const name=job+'-'+sex+'-'+view+'-'+action+'-'+variant+'-detail.png';await page.screenshot({path:out+'/'+name});report.professionDetails.push({...detail,screenshot:name});console.log('profession detail passed',job,sex,view,action,variant);
  }
  report.memory=await page.evaluate(()=>__professionLineup.close());assert.deepEqual(report.memory.delta,{geometries:0,textures:0});assert.ok(report.memory.restored&&report.memory.existingRenderer);
  report.sockets=await page.evaluate(()=>__roomAttempts);assert.deepEqual(report.sockets,[]);
  await Promise.all(responseWork);report.sourceHashes=[];
  for(const path of ['/','/lib/three.min.js','/assets/character-sculpt.js','/assets/character-face.js','/assets/character-motion.js','/story/tower-heroes-core.js','/story/tower-heroes-visuals.js','/story/tower-combat-motion.js','/story/tower-robot-core.js']){
    const loaded=report.loaded.filter(r=>decodeURIComponent(new URL(r.url).pathname)===path&&r.status===200).at(-1);assert.ok(loaded,'missing natural source '+path);
    const sha256=createHash('sha256').update(await readFile(new URL(path==='/'?'../index.html':'..'+path,import.meta.url))).digest('hex');assert.equal(loaded.sha256,sha256,'source changed after actual browser load '+path);report.sourceHashes.push({path,sha256,url:loaded.url});
  }
  await context.close();
  // A two-by-four contact sheet per gender. Images retain the identical pixel
  // scale used in the paired previews, so height comparisons remain truthful.
  const sheets=await browser.newContext({viewport:{width:1200,height:2900},deviceScaleFactor:1,serviceWorkers:'block'}),sheet=await sheets.newPage();
  sheet.on('pageerror',e=>report.errors.push(e.stack));sheet.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  for(const sex of ['male','female']){
    await sheet.setContent('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#142431;color:#f8e9cc;font-family:system-ui,sans-serif}header{height:140px;padding:24px 32px}h1{font-size:36px;margin:0 0 14px}p{font-size:20px;margin:0;color:#bed3e2}.grid{display:grid;grid-template-columns:repeat(2,600px)}img{display:block;width:600px;height:690px}</style><header><h1>八職業'+(sex==='female'?'女性':'男性')+' · 平視正面</h1><p>實際遊戲人物 · 第一階裝備 · 露髮造型 · 所有人物同一比例、腳底對齊</p></header><main class="grid">'+crops[sex].map(r=>'<img alt="'+escape(r.name)+'" src="'+r.image+'">').join('')+'</main></html>',{waitUntil:'load'});
    await sheet.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth===600));const name=sex+'-eight-jobs.png';await sheet.screenshot({path:out+'/'+name,fullPage:true});report.overviews??=[];report.overviews.push({sex,screenshot:name,columns:2,rows:4,pixelsPerWorldUnit:report.setup.camera.pixelsPerWorldUnit});
  }
  await sheets.close();
  const cards=report.setup.jobs.map(j=>'<section><h2>'+escape(j.name)+'</h2><a href="'+j.id+'-hair.png"><img src="'+j.id+'-hair.png" alt="'+escape(j.name)+'男女平視露髮造型"></a><p><a href="'+j.id+'-helmet.png">查看戴上頭部裝備</a></p><p>'+report.professionDetails.filter(d=>d.job===j.id).map(d=>'<a href="'+d.screenshot+'">'+(d.sex==='female'?'女':'男')+' · '+(d.action==='rest'?'平時握持':d.action==='skill'?'施法展開':'攻擊'+(d.variant+1))+'</a>').join(' · ')+'</p></section>').join('');
  await writeFile(out+'/index.html','<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>八職業平視造型預覽</title><style>*{box-sizing:border-box}body{margin:0;padding:18px;background:#101e2b;color:#f8e9cc;font-family:system-ui,sans-serif}header{max-width:1200px;margin:auto}h1{font-size:24px}p{line-height:1.6;color:#bdd1e0}a{color:#c6e5ff}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;max-width:1200px;margin:24px auto}section{border:1px solid #416078;border-radius:14px;overflow:hidden;background:#142431}h2,section p{padding:0 16px}h2{font-size:21px}img{width:100%;display:block}@media(max-width:700px){.grid{grid-template-columns:1fr;gap:14px}}</style><header><h1>八職業平視造型預覽 · v'+escape(version)+'</h1><p>實際遊戲模型與第一階專用裝備。所有角色保留原始比例、使用同一正交平視相機並讓腳底對齊。點圖可看完整尺寸；機器人沒有頭盔，所以兩種展示會相同。這是本機預覽，尚未部署。</p><p><a href="male-eight-jobs.png">男性八職業總覽</a> · <a href="female-eight-jobs.png">女性八職業總覽</a></p></header><main class="grid">'+cards+'</main></html>');
  assert.equal(new Set(report.models.filter(m=>!m.helmet).map(m=>m.job+'-'+m.sex)).size,16);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);report.pass=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await Promise.allSettled(responseWork);await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,models:report.models.length,previews:report.previews.length,overviews:report.overviews?.length||0,sourceHashes:report.sourceHashes?.length||0,memory:report.memory,errors:report.errors,failure:report.failure,report:out+'/report.json',gallery:out+'/index.html'}));}
