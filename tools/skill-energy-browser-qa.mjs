// Isolated actual-module GPU proof; no saved games, rooms or remote mutations.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MAZE_QA_URL||'http://127.0.0.1:8798/',out=process.env.MAZE_QA_OUT||'.agent-run/skill-energy-qa',origin=new URL(base).origin;
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));await mkdir(out,{recursive:true});
const report={cases:[],showcases:[],errors:[],blocked:[],loaded:[],limitations:['Desktop software WebGL, not real iPhone performance evidence.','Isolated presentation rig with current source modules; gameplay numbers are not altered.']},pending=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']}),context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(new URL(r.url()).origin===origin&&/\.js(?:\?|$)/.test(r.url()))pending.push((async()=>report.loaded.push({url:r.url(),sha256:createHash('sha256').update(await r.body()).digest('hex')}))());});
await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())||new URL(r.request().url()).origin!==origin){report.blocked.push(r.request().url());return r.abort();}return r.continue();});
await page.route('**/api/runtime-config',r=>r.fulfill({json:{broker:'',apiUrl:''}}));await page.route('**/api/scores*',r=>r.fulfill({json:[]}));
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>typeof TowerSkillEffects==='object'&&typeof TowerHeroVisuals==='object');
  await page.evaluate(()=>{
    const T=THREE,H=TowerHeroes,scene=new T.Scene();scene.background=new T.Color(0x10222e);
    const camera=new T.PerspectiveCamera(40,1440/900,.1,100);camera.position.set(0,15,20);camera.lookAt(0,0,0);
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.setPixelRatio(1);renderer.outputEncoding=T.sRGBEncoding;
    Object.assign(renderer.domElement.style,{position:'fixed',inset:0,width:'100vw',height:'100vh',zIndex:99999});document.body.append(renderer.domElement);
    const labels=document.createElement('div');Object.assign(labels.style,{position:'fixed',inset:0,zIndex:100000,pointerEvents:'none'});document.body.append(labels);
    const floor=new T.Mesh(new T.PlaneGeometry(30,18),new T.MeshLambertMaterial({color:0x243b46}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
    scene.add(new T.HemisphereLight(0xdff5ff,0x304253,1));const light=new T.DirectionalLight(0xffe6bc,.8);light.position.set(-2,7,8);scene.add(light);
    const world=new T.Group();scene.add(world);const fx=TowerSkillEffects.create(T,{world:()=>world}),actors=[];
    function check(){renderer.render(scene,camera);const gl=renderer.getContext();for(const p of renderer.info.programs)if(!gl.getProgramParameter(p.program,gl.LINK_STATUS)||p.diagnostics?.runnable===false)throw Error('Shader link failed');return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,memory:{...renderer.info.memory},programs:renderer.info.programs.length};}
    function releaseActors(){for(const actor of actors){scene.remove(actor);const geometry=new Set(),materials=new Set(),textures=new Set();actor.traverse(n=>{if(n.geometry&&!n.isSprite)geometry.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const resource of [...geometry,...materials,...textures])resource.dispose();}actors.length=0;}
    window.__energyQA={
      compile(reduced){fx.reset();releaseActors();const manager=TowerSkillEffects.create(T,{world:()=>world,reducedMotion:reduced}),rows=[];
        const cases=Object.values(H.SKILLS).flatMap(skill=>[{},{impact:true},{stage:'charge',duration:1.9},{stage:'land'}].map(options=>({skill,options})));
        for(let i=0;i<cases.length;i+=12){manager.reset();const batch=cases.slice(i,i+12);for(const [n,{skill,options}]of batch.entries())manager.emit(skill,{x:(n%4-1.5)*4,z:Math.floor(n/4)*3-3},0,options);manager.tick(.12);const gpu=check(),stats=manager.stats();for(const row of batch)rows.push({id:row.skill.id,stage:row.options.stage||(row.options.impact?'impact':'cast'),gpu,stats});}
        manager.reset();check();const baseline={...renderer.info.memory};for(let n=0;n<12;n++){for(const skill of Object.values(H.SKILLS).slice(n,n+12))manager.emit(skill,{x:0,z:0});manager.tick(.3);check();manager.tick(5);check();if(renderer.info.memory.geometries!==baseline.geometries||renderer.info.memory.textures!==baseline.textures)throw Error('Recycled effects leaked');}manager.destroy();return {rows,reduced,recycle:baseline};
      },
      show(time,detail=false){fx.reset();releaseActors();labels.replaceChildren();const ids=detail?['thunder_wave','thorn_growth','starfall','guard_stance','herbal_heal','cleanse','iron_charge','parts_restore']:['whirlwind','thunder_wave','smoke','soup_splash','herbal_heal','hammer_bash','arrow_volley','flying_fist'];
        for(let i=0;i<ids.length;i++){const skill=H.SKILLS[ids[i]],x=(i%4-1.5)*5.2,z=i<4?-3.3:3.3,model=TowerHeroVisuals.base(skill.job,buildCharacter,'preview',i%2?'female':'male');model.position.set(x,0,z);model.rotation.y=.18;scene.add(model);actors.push(model);fx.emit(skill,{x,z},.18);const p=new T.Vector3(x,-.1,z+1.7).project(camera),label=document.createElement('span');label.textContent=H.JOBS[skill.job].name+' · '+skill.name;Object.assign(label.style,{position:'absolute',left:(p.x+1)*50+'%',top:(1-p.y)*50+'%',transform:'translateX(-50%)',color:'#ffe3a9',background:'#081722ce',borderRadius:'8px',padding:'5px 10px',font:'600 17px sans-serif',whiteSpace:'nowrap'});labels.append(label);}
        fx.tick(time);return {ids,time,detail,gpu:check(),stats:fx.stats()};
      },
      close(){fx.destroy();releaseActors();floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();labels.remove();}
    };check();
  });
  for(const reduced of [false,true]){const result=await page.evaluate(r=>__energyQA.compile(r),reduced);assert.equal(result.rows.length,72*4);for(const row of result.rows){assert.ok(row.stats.groups<=12&&row.stats.meshes<=96);assert.equal(row.stats.textureBytes,49152);assert.equal(row.gpu.points,row.stats.groups*(reduced?12:48));assert.ok(row.gpu.calls<=1+row.stats.groups*8);}report.cases.push(result);}
  for(const detail of [false,true])for(const time of [.12,.32,.62]){const row=await page.evaluate(o=>__energyQA.show(o.time,o.detail),{time,detail});report.showcases.push(row);await page.screenshot({path:out+'/'+(detail?'details':'eight-jobs')+'-'+Math.round(time*100)+'.png'});}
  await page.evaluate(()=>__energyQA.close());
  await Promise.all(pending);report.sourceHashes=[];for(const path of ['/story/tower-skill-effects.js','/story/tower-heroes-core.js','/story/tower-heroes-visuals.js']){const loaded=report.loaded.find(r=>new URL(r.url).pathname===path);assert.ok(loaded);const hash=createHash('sha256').update(await readFile(new URL('..'+path,import.meta.url))).digest('hex');assert.equal(hash,loaded.sha256);report.sourceHashes.push({path,sha256:hash});}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);report.pass=true;
}catch(e){report.failure=e.stack;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{await Promise.allSettled(pending);await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:!!report.pass,cases:report.cases.reduce((n,r)=>n+r.rows.length,0),screenshots:report.showcases.length,errors:report.errors,failure:report.failure}));}
