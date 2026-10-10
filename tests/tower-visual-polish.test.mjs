import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),H=require('../story/tower-heroes-core.js'),F=require('../assets/character-face.js');
function environment(){
  const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,TowerHeroes:H});e.window=e;
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter(cd)'),end=html.indexOf('\n}',start)+2;
  vm.runInContext(html.slice(start,end),e);
  for(const file of ['tower-heroes-visuals.js','tower-skill-effects.js','tower-characters.js'])vm.runInContext(readFileSync(new URL('../story/'+file,import.meta.url),'utf8'),e);
  return e;
}
function finiteGeometry(model){model.traverse(o=>{for(const name of ['position','normal'])if(o.geometry?.attributes[name])assert.ok(Array.from(o.geometry.attributes[name].array).every(Number.isFinite),o.name+' '+name);});}
function release(model){const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.isMesh||o.isPoints)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}

test('all fourteen hairstyles have a continuous crown/drape seam with identical normals and finite surfaces',()=>{
  for(const job of Object.keys(H.JOBS).filter(job=>job!=='robot'))for(const sex of ['male','female']){
    const hair=S.hair(T,{job,sex}),a=hair.crown,b=hair.drape,ai=new Set(a.index.array),bi=new Set(b.index.array),shared=[...ai].filter(i=>bi.has(i));
    assert.equal(shared.length,28,job+':'+sex);assert.ok(a.userData.continuousHair&&b.userData.continuousHair);
    for(const i of shared)for(const key of ['position','normal'])for(let axis=0;axis<3;axis++)assert.equal(a.attributes[key].array[i*3+axis],b.attributes[key].array[i*3+axis]);
    for(const g of [a,b,...hair.braids.map(b=>b.geometry)]){finiteGeometry(new T.Mesh(g));assert.ok(g.index.count>0);g.dispose();}
    for(const braid of hair.braids){assert.equal(braid.geometry.type,'TubeGeometry');const root=braid.geometry.parameters.path.getPoint(0);assert.ok(Math.abs(root.x)<.29&&root.y>-.1&&root.z>-.15);}
  }
});

test('every job/sex/tier hides all old waist trim under live armor and restores it after removal or breakage',()=>{
  const e=environment();let variants=0;
  for(const job of Object.keys(H.JOBS).filter(job=>job!=='robot'))for(const sex of ['male','female'])for(const tier of [1,2,3]){
    const family=H.JOBS[job].armor,armor=family==='heavy'?'heavy_armor':family==='robe'?'robe':'light_armor',helmet=family==='heavy'?'heavy_helm':family==='robe'?'rune_crown':'light_hood';
    const model=e.TowerHeroVisuals.base(job,e.buildCharacter,'hero',sex),belt=model.userData.baseClothing.find(p=>p.name==='base-belt');
    assert.equal(belt.geometry.type,'TorusGeometry');belt.updateMatrixWorld(true);const beltBox=new T.Box3().setFromObject(belt);assert.ok(beltBox.max.z-beltBox.min.z<.48);
    const equipment={armor:{id:'armor',kind:H.tierKind(armor,tier),slot:'armor',durability:20},helmet:{id:'helmet',kind:H.tierKind(helmet,tier),slot:'helmet',durability:20},weapon:null,shield:null},before=JSON.stringify(equipment);
    for(const showHelmet of [true,false]){e.TowerHeroVisuals.dress(T,model,equipment,release,{showHelmet});assert.ok(model.userData.baseClothing.every(p=>!p.visible));assert.equal(model.userData.heroPieces.filter(p=>p.userData.baseKind===helmet).length,showHelmet?1:0);finiteGeometry(model);}
    assert.equal(JSON.stringify(equipment),before);
    e.TowerHeroVisuals.dress(T,model,{...equipment,armor:{...equipment.armor,durability:0}},release);assert.ok(model.userData.baseClothing.every(p=>p.visible));
    e.TowerHeroVisuals.dress(T,model,{armor:null,helmet:null,weapon:null,shield:null},release);assert.ok(model.userData.baseClothing.every(p=>p.visible));assert.equal(model.userData.heroPieces.length,0);release(model);variants++;
  }
  assert.equal(variants,48);
});

test('classic human hairstyles share the continuous sculpt; robot and cat silhouettes retain their special features',()=>{
  const e=environment();for(const type of ['boy','girl','robot','cat']){const m=e.buildCharacter({type,shirt:0x337799,pants:0x445566,hair:0x785034,skin:0xd7aa87});finiteGeometry(m);const cap=m.userData.head.children.find(o=>o.name==='hair-crown');assert.equal(!!cap,['boy','girl'].includes(type));if(cap)assert.ok(cap.userData.continuousHair);release(m);}
});

test('four merchants, five explorers and five guards keep unique props while removing box hair and flat rear belts',()=>{
  const e=environment(),V=e.TowerCharacters,deps={THREE:T},models=[...Object.keys(V.MERCHANT_STYLES).map(id=>V.buildMerchant(id,deps)),...Object.keys(V.EXPLORER_STYLES).map(id=>V.buildExplorer(id,deps)),...[1,2,3,4,5].map(rank=>V.buildWarrior(rank,deps))];
  assert.equal(models.length,14);
  for(const model of models){finiteGeometry(model);let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.userData.contouredBelt){assert.equal(o.geometry.type,'TorusGeometry');assert.ok(o.scale.y<1);}if(o.userData.continuousHair)assert.equal(o.geometry.type==='BoxGeometry'||o.geometry.type==='ExtrudeGeometry',false);});assert.ok(triangles<9000,model.name+':'+triangles);assert.ok(model.userData.armL&&model.userData.armR);assert.ok(new T.Box3().setFromObject(model).max.y<2.7);release(model);}
  assert.ok(V.buildMerchant('jinHe',deps).getObjectByName('sewing-pouch'));assert.equal(V.buildExplorer('eve',deps).getObjectByName('traveler-braid').geometry.type,'TubeGeometry');assert.ok(V.buildExplorer('mira',deps).getObjectByName('round-double-bun'));assert.ok(V.buildExplorer('sena',deps).getObjectByName('comet-hairpin-star'));
});

test('every profession and active skill has batched particles, bounded draws, and safe shader source',()=>{
  const e=environment(),jobs=new Set();for(const reducedMotion of [false,true]){
    const world=new T.Group(),fx=e.TowerSkillEffects.create(T,{world:()=>world,reducedMotion}),expected=reducedMotion?12:48;
    for(const skill of Object.values(H.SKILLS))for(const options of [{},{impact:true},{stage:'charge',duration:1.9},{stage:'land'}]){
      const f=fx.emit(skill,{x:0,z:0},0,options);assert.ok(f,skill.id);jobs.add(skill.job);assert.ok(f.group.children.length<=8,skill.id+':'+f.family);
      const cloud=f.group.children.find(o=>o.isPoints);assert.equal(cloud.geometry.attributes.position.count,expected);assert.equal(cloud.geometry.boundingSphere.radius,6);finiteGeometry(f.group);
      assert.ok(cloud.material.vertexShader.includes('\n'));assert.ok(!cloud.material.vertexShader.includes('\\n'));
      f.group.traverse(o=>assert.ok(!o.isLine&&!o.isLight&&!['RingGeometry','TorusGeometry'].includes(o.geometry?.type)));
      const stats=fx.stats();assert.ok(stats.groups<=12&&stats.meshes<=96&&stats.particles<=expected*12);assert.equal(stats.textureBytes,49152);
      fx.tick(.035);
    }
    fx.destroy();assert.equal(world.children.length,0);assert.equal(fx.stats().textureBytes,0);
  }assert.equal(jobs.size,Object.keys(H.JOBS).length);
});

test('spell visibility, frozen time, eviction, reset and destruction dispose owned particles and recycled materials without harming shared sprites',()=>{
  const e=environment(),world=new T.Group();let visible=false;const fx=e.TowerSkillEffects.create(T,{world:()=>world,limit:2,visible:()=>visible}),skill=H.SKILLS.guard_stance;
  assert.equal(fx.emit(skill,{x:0,z:0}),null);visible=true;
  const f=fx.emit(skill,{x:0,z:0}),resources=new Map(),textures=new Map();let spriteDisposals=0;
  f.group.traverse(o=>{if(o.isMesh||o.isPoints){resources.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>resources.set(o.geometry,resources.get(o.geometry)+1));}if(o.isSprite)o.geometry.addEventListener('dispose',()=>spriteDisposals++);});
  for(const m of f.mats){resources.set(m,0);m.addEventListener('dispose',()=>resources.set(m,resources.get(m)+1));if(m.map&&!textures.has(m.map)){textures.set(m.map,0);m.map.addEventListener('dispose',()=>textures.set(m.map,textures.get(m.map)+1));}}
  const cloud=f.group.children.find(o=>o.isPoints),left=f.left;for(const dt of [0,-1,NaN,Infinity])fx.tick(dt);assert.equal(f.left,left);assert.equal(cloud.material.uniforms.age.value,0);
  visible=false;fx.tick(.1);assert.equal(f.group.visible,false);visible=true;fx.tick(.1);assert.equal(f.group.visible,true);
  fx.emit(skill,{x:0,z:0});fx.emit(skill,{x:0,z:0});assert.equal(f.group.parent,null);
  const pooled=[...resources.keys()].filter(r=>r.userData?.sharedResource);assert.ok(pooled.length>0&&pooled.every(r=>r.isMaterial));
  for(const [r,n] of resources)assert.equal(n,pooled.includes(r)?0:1,'eviction releases the private resources once; recycled materials return to the pool');
  fx.cancel(f);fx.reset();assert.equal(world.children.length,0);assert.ok([...textures.values()].every(n=>n===0));for(const r of pooled)assert.equal(resources.get(r),0);fx.destroy();fx.destroy();assert.ok([...textures.values()].every(n=>n===1));assert.ok([...resources.values()].every(n=>n===1),'destroy releases each recycled material exactly once');assert.equal(spriteDisposals,0);assert.equal(fx.emit(skill,{x:0,z:0}),null);
});

test('simultaneous spells upload independent phases to one warm particle program, retained across floor resets',()=>{
  const e=environment(),world=new T.Group(),fx=e.TowerSkillEffects.create(T,{world:()=>world}),a=fx.emit(H.SKILLS.smoke,{x:0,z:0});fx.tick(.2);const b=fx.emit(H.SKILLS.herbal_heal,{x:2,z:0});fx.tick(.1);
  const p=a.group.children.find(o=>o.isPoints),q=b.group.children.find(o=>o.isPoints),material=p.material;assert.equal(q.material,material);let disposed=0;material.addEventListener('dispose',()=>disposed++);
  p.onBeforeRender();assert.ok(Math.abs(material.uniforms.age.value-.3)<1e-9);assert.equal(material.uniforms.flow.value,3);assert.equal(material.uniforms.shape.value,0);
  q.onBeforeRender();assert.ok(Math.abs(material.uniforms.age.value-.1)<1e-9);assert.equal(material.uniforms.flow.value,1);assert.equal(material.uniforms.shape.value,1);
  fx.reset();assert.equal(disposed,0);assert.equal(fx.emit(H.SKILLS.thunder_wave,{x:0,z:0}).group.children.find(o=>o.isPoints).material,material);fx.destroy();fx.destroy();assert.equal(disposed,1);
});
