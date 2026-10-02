// Local, isolated previews only. No production bridge, network writes or player saves.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),out='.agent-run/visual-polish-qa';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1260,height:680},hasTouch:true}),errors=[],report={models:[],effects:[],viewports:[]};
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());if(errors.length<=3)console.error(m.text());}});
  // A static preview server has no cloud functions. This local fixture is not
  // backend/production evidence, and avoids unrelated missing-route console noise.
  await page.route('**/api/runtime-config',route=>route.fulfill({contentType:'application/json',body:'{"broker":"","apiUrl":""}'}));report.configFixture=true;
  await page.goto('http://127.0.0.1:8795/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    const T=THREE,H=TowerHeroes,V=TowerHeroVisuals;
    const cleanup=s=>{const geometries=new Set(),materials=new Set(),textures=new Set();s.traverse(o=>{if(o.isMesh||o.isPoints)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
    function setup(width,height,angled=false){const scene=new T.Scene();scene.background=new T.Color(0x10212d);scene.add(new T.HemisphereLight(0xf0f4ff,0x344b58,1.2));const sun=new T.DirectionalLight(0xffe4bb,1.15);sun.position.set(-5,8,10);scene.add(sun);const camera=new T.OrthographicCamera(-8,8,angled?5.8:6,-.7,.1,60);camera.position.set(0,angled?5:0,18);camera.lookAt(0,0,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(width,height);renderer.domElement.id='visual-polish-preview';Object.assign(renderer.domElement.style,{position:'fixed',inset:0,zIndex:999999,width:'100vw',height:'100vh'});document.body.append(renderer.domElement);return {scene,camera,renderer};}
    function item(kind,slot){return {id:'preview-'+kind,kind,slot,durability:40,maxDurability:40};}
    function equipment(job,tier){const family=H.JOBS[job].armor,armor=family==='heavy'?'heavy_armor':family==='robe'?'robe':'light_armor',helmet=family==='heavy'?'heavy_helm':family==='robe'?'rune_crown':'light_hood';return {armor:item(H.tierKind(armor,tier),'armor'),helmet:item(H.tierKind(helmet,tier),'helmet'),weapon:item(H.tierKind(H.JOBS[job].starter,tier),'weapon'),shield:null};}
    function label(scene,text,x,y,z=0,size=1.55){const tag=makeTextSprite(text);tag.position.set(x,y,z);tag.scale.set(size,.25,1);scene.add(tag);}
    window.__visualPolish={
      close(){this.active?.fx?.destroy();if(this.active){cleanup(this.active.scene);this.active.renderer.dispose();this.active.renderer.forceContextLoss();this.active.renderer.domElement.remove();this.active.labels?.remove();this.active=null;}},
      models({tier=1,view='back',showHelmet=false}={}){
        this.close();const active=setup(1260,680),rows=[];this.active=active;
        for(const [i,job]of Object.keys(H.JOBS).entries())for(const [row,sex]of ['male','female'].entries()){
          const m=V.base(job,buildCharacter,'preview',sex);if(tier)V.dress(T,m,equipment(job,tier),cleanup,{showHelmet});
          m.position.set((i-3)*2.08,row===0?3.08:0,0);m.rotation.y=view==='back'?Math.PI+.35:view==='side'?Math.PI/2:.25;CharacterFace.update(m,.7,'focus');active.scene.add(m);
          label(active.scene,H.JOBS[job].name+' · '+(sex==='male'?'男':'女'),m.position.x,m.position.y-.18);
          let triangles=0,meshes=0;m.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes++;}for(const key of ['position','normal'])if(o.geometry?.attributes[key]&&!Array.from(o.geometry.attributes[key].array).every(Number.isFinite))throw Error('Nonfinite '+job+sex+key);});
          rows.push({job,sex,tier,view,showHelmet,triangles,meshes,oldTrimVisible:m.userData.baseClothing.filter(o=>o.visible).length});
        }active.renderer.render(active.scene,active.camera);return rows;
      },
      closeups(){this.close();const active=setup(1260,480),jobs=['mage','mage','healer','smith'];this.active=active;active.camera.left=-3.9;active.camera.right=3.9;active.camera.top=2.7;active.camera.bottom=-.3;active.camera.updateProjectionMatrix();
        for(const [i,job]of jobs.entries()){const m=V.base(job,buildCharacter,'preview','female');V.dress(T,m,equipment(job,1),cleanup,{showHelmet:false});m.position.x=(i-1.5)*1.8;m.rotation.y=i===0?Math.PI+.25:Math.PI/2;active.scene.add(m);label(active.scene,H.JOBS[job].name+' · '+(i===0?'背面':'側面'),m.position.x,-.17,0,1.3);}active.renderer.render(active.scene,active.camera);return 4;
      },
      npcs(view='back'){this.close();const active=setup(1260,680),V=TowerCharacters,deps={THREE:T},models=[...Object.keys(V.MERCHANT_STYLES).map(id=>V.buildMerchant(id,deps)),...Object.keys(V.EXPLORER_STYLES).map(id=>V.buildExplorer(id,deps)),...[1,2,3,4,5].map(rank=>V.buildWarrior(rank,deps))],rows=[];this.active=active;
        for(const [i,m]of models.entries()){m.position.set((i%7-3)*2.08,i<7?3.08:0,0);m.rotation.y=view==='back'?Math.PI+.35:Math.PI/2;active.scene.add(m);label(active.scene,m.userData.style.name,m.position.x,m.position.y-.2);let triangles=0;m.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const key of ['position','normal'])if(o.geometry?.attributes[key]&&!Array.from(o.geometry.attributes[key].array).every(Number.isFinite))throw Error('Nonfinite '+m.name);});rows.push({name:m.name,view,triangles});}active.renderer.render(active.scene,active.camera);return rows;
      },
      compile(reducedMotion=false){this.close();const active=setup(320,180);this.active=active;const fx=TowerSkillEffects.create(T,{world:()=>active.scene,reducedMotion}),rows=[];active.fx=fx;
        const cases=Object.values(H.SKILLS).flatMap(skill=>[{},{impact:true},{stage:'charge',duration:1.9},{stage:'land'}].map(options=>({skill,options})));
        for(let start=0;start<cases.length;start+=12){fx.reset();const batch=cases.slice(start,start+12);for(const [i,{skill,options}]of batch.entries())fx.emit(skill,{x:(i%3-1)*4.5,z:Math.floor(i/3)*3-4.5},0,options);fx.tick(.15);active.renderer.render(active.scene,active.camera);for(const {skill,options}of batch)rows.push({id:skill.id,job:skill.job,stage:options.stage|| (options.impact?'impact':'release'),reducedMotion,draws:active.renderer.info.render.calls,points:active.renderer.info.render.points,stats:fx.stats()});}return rows;
      },
      effects({time=.35,reducedMotion=false}={}){
        this.close();const active=setup(1260,680,true);this.active=active;const fx=TowerSkillEffects.create(T,{world:()=>active.scene,reducedMotion});active.fx=fx;
        const selected=['whirlwind','thunder_wave','smoke','soup_splash','herbal_heal','hammer_bash','arrow_volley'],rows=[];
        for(const [i,id]of selected.entries()){
          const skill=H.SKILLS[id],x=(i%4-1.5)*3.65,y=i<4?3.15:0,z=0,m=V.base(skill.job,buildCharacter,'preview',i%2?'female':'male');V.dress(T,m,equipment(skill.job,1),cleanup,{showHelmet:false});m.position.set(x,y,z);CharacterFace.update(m,.7,skill.attack?'focus':'cast');active.scene.add(m);
          const stage=new T.Mesh(new T.PlaneGeometry(3.35,3.5),new T.MeshLambertMaterial({color:0x1c3540}));stage.rotation.x=-Math.PI/2;stage.position.set(x,y-.01,z+.35);active.scene.add(stage);
          const f=fx.emit(skill,{x,z:z+.35});f.group.position.y+=y;rows.push({id,job:skill.job,x,y});
        }fx.tick(time);active.renderer.render(active.scene,active.camera);const labels=document.createElement('div');Object.assign(labels.style,{position:'fixed',inset:0,zIndex:1000000,pointerEvents:'none'});active.labels=labels;document.body.append(labels);for(const row of rows){const anchor=new T.Vector3(row.x,row.y+2.65,0).project(active.camera),tag=document.createElement('div');tag.textContent=H.JOBS[row.job].name+' · '+H.SKILLS[row.id].name;Object.assign(tag.style,{position:'absolute',left:((anchor.x+1)*50)+'%',top:((1-anchor.y)*50)+'%',transform:'translate(-50%,-50%)',whiteSpace:'nowrap',color:'#f5e2b5',font:'700 19px sans-serif'});labels.append(tag);}return {skills:rows,stats:fx.stats(),render:active.renderer.info.render};
      },
      loadouts(){return Object.entries(H.JOBS).map(([job,d])=>({job,name:d.name}));}
    };
  });
  for(const tier of [0,1,2,3])for(const view of ['back','side']){
    const rows=await page.evaluate(options=>__visualPolish.models(options),{tier,view,showHelmet:tier===2});assert.equal(rows.length,14);
    for(const row of rows){assert.ok(row.triangles<11500&&row.meshes<90,JSON.stringify(row));assert.equal(row.oldTrimVisible===0,tier>0);}
    report.models.push(...rows);await page.screenshot({path:out+'/tier-'+tier+'-'+view+'.png'});
  }
  await page.setViewportSize({width:1260,height:480});assert.equal(await page.evaluate(()=>__visualPolish.closeups()),4);await page.screenshot({path:out+'/hair-waist-closeups.png'});
  await page.setViewportSize({width:1260,height:680});
  report.npcs=[];for(const view of ['back','side']){const rows=await page.evaluate(view=>__visualPolish.npcs(view),view);assert.equal(rows.length,13);assert.ok(rows.every(r=>r.triangles<9000));report.npcs.push(...rows);await page.screenshot({path:out+'/merchants-explorers-guards-'+view+'.png'});}
  for(const reduced of [false,true]){
    const rows=await page.evaluate(value=>__visualPolish.compile(value),reduced);assert.equal(rows.length,196);
    for(const row of rows){assert.ok(row.draws<=row.stats.groups*8);assert.equal(row.points,(reduced?12:48)*row.stats.groups);assert.ok(row.stats.groups<=12&&row.stats.meshes<=96);}
    report.effects.push(...rows);
  }
  report.showcases=[];for(const time of [.15,.35,.65]){const v=await page.evaluate(time=>__visualPolish.effects({time}),time);assert.equal(new Set(v.skills.map(s=>s.job)).size,7);report.showcases.push({time,...v});await page.screenshot({path:out+'/seven-professions-'+Math.round(time*100)+'.png'});}
  await page.evaluate(()=>__visualPolish.close());
  // The isolated gallery makes no UI mutations outside its disposable preview canvas.
  for(const [width,height]of [[568,320],[844,390],[1024,768]]){await page.setViewportSize({width,height});await page.locator('#enterMenuBtn').tap();const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(scroll<=width);report.viewports.push({width,height,scroll});await page.screenshot({path:out+'/'+width+'-menu.png'});await page.evaluate(()=>document.querySelector('#homeBackBtn')?.click());await page.reload({waitUntil:'networkidle'});}
  assert.deepEqual(errors,[]);report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,models:report.models.length,npcPoses:report.npcs.length,skillStages:report.effects.length,professions:7,viewports:report.viewports.length,errors}));
}finally{await browser.close();}
