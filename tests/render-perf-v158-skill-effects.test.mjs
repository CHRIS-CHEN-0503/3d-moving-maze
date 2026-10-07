import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js');
const source=readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8');
const api=()=>{const c=vm.createContext({});vm.runInContext(source,c);return c.TowerSkillEffects;};
const V=api(),skills=Object.values(H.SKILLS);
const OPTIONS=[{},{impact:true},{stage:'charge',duration:1.5},{stage:'land'},{impact:true,weapon:'blade'}];
const create=(extra={},world=new T.Group())=>({world,fx:api().create(T,{world:()=>world,limit:12,...extra})});
const geometryIds=()=>new T.BufferGeometry().id,materialIds=()=>new T.MeshBasicMaterial().id;

// SUMMARY-BEGIN
const fixed=n=>Math.round(n*1000)/1000+0;
function summary(f){
  const out=[f.family,f.total,f.parts.map(p=>p.mode).join()];
  f.group.traverse(o=>{
    const row=[o.name,o.type,o.position.toArray().map(fixed),o.scale.toArray().map(fixed),[o.rotation.x,o.rotation.y,o.rotation.z].map(fixed),o.visible];
    if(o.isMesh||o.isPoints){
      const g=o.geometry,p=g.attributes.position,box=[1e9,1e9,1e9,-1e9,-1e9,-1e9],sums={};
      for(let i=0;i<p.count;i++)for(const [k,v]of [p.getX(i),p.getY(i),p.getZ(i)].entries()){box[k]=Math.min(box[k],v);box[k+3]=Math.max(box[k+3],v);}
      for(const name of Object.keys(g.attributes).sort()){if(o.isPoints&&(name==='color'||name==='tone')||o.isMesh&&o.material.isShaderMaterial&&name==='color')continue;const a=g.attributes[name];let sum=0;for(let i=0;i<a.array.length;i++)sum+=a.array[i]*((i%7)+1);sums[name]=fixed(sum);}
      row.push(g.type,p.count,g.index?.count??0,box.map(fixed),sums,g.boundingSphere?[...g.boundingSphere.center.toArray(),g.boundingSphere.radius].map(fixed):null);
      if(o.isPoints){const ph=o.userData.phase,tone=g.attributes.tone?.array,color=g.attributes.color?.array,tints=[];for(let i=0;i<p.count;i++){if(color)tints.push(color[i*3],color[i*3+1],color[i*3+2]);else{const c=tone[i]?ph.tintB:ph.tintA;tints.push(c.r,c.g,c.b);}}row.push(ph.duration,ph.flow,ph.shape,fixed(tints.reduce((n,v,i)=>n+v*((i%5)+1),0)));}
    }
    for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])row.push(m.isShaderMaterial?'shader':[m.type,m.color?.getHex(),fixed(m.opacity),m.userData.baseOpacity===undefined?'':fixed(m.userData.baseOpacity),m.blending,m.side,m.vertexColors,!!m.map,m.transparent,m.depthWrite,m.userData.envelope||'',m.isMeshPhongMaterial?[m.emissive.getHex(),m.emissiveIntensity,m.shininess].join('/'):''].join());
    out.push(row);
  });
  return out;
}
// SUMMARY-END
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,12);
function familyDigest(Effects,representative){
  const parts=[];
  for(const reducedMotion of [false,true])for(const options of OPTIONS){
    const world=new T.Group(),fx=Effects.create(T,{world:()=>world,limit:12,reducedMotion}),f=fx.emit(representative,{x:1,z:2},.3,options);
    if(!f){parts.push(null);continue;}fx.tick(.1);parts.push(summary(f));fx.destroy();
  }
  return digest(parts);
}
// Measured once on the previous implementation (one representative skill per visual family; five stage/impact variants;
// normal and reduced motion): every node, silhouette, vertex colour, material setting and opacity after one tick.
const GOLDEN={"slash":"823dfdc4f788","impact":"5821b7bc24e8","spin":"1cdeb67dcffe","shield":"4b65284776d9","wave":"ccbc2e518583","aura":"55e0bda05001","cast":"72c10524ab49","storm":"0b82f63f0f78","meteor":"c194deaa4bde","frost":"495051251ee8","thorns":"b76dd8b87528","scan":"4a02dfd7141a","smoke":"b691fe36dcc3","splash":"19a62b25e057","steam":"9f0450432248","heal":"4134fcccaef2","cleanse":"c50e84282fd8","forge":"c96624c39879","arrow":"262e466c3fc4","rocket_fist":"e85ba2a32880","ram":"5578f4b507e3","quake":"daf0c5c3133e","lubricate":"c7f9b11470dc","rebuild":"7229596a4c2e","twin_fist":"7f0fa0e0a47b"};
const byFamily=new Map();for(const skill of skills){const family=V.familyFor(skill);if(family&&!byFamily.has(family))byFamily.set(family,skill);}
test('every visual family renders exactly what the previous implementation rendered',()=>{
  assert.deepEqual([...byFamily.keys()].sort(),Object.keys(GOLDEN).sort());
  for(const [family,skill]of byFamily)assert.equal(familyDigest(V,skill),GOLDEN[family],family+' ('+skill.id+') changed its silhouette, colours, materials or opacity');
});

test('a sweep that hits a pack in one frame draws only the first three impacts; the budget renews every frame',()=>{
  const {fx,world}=create(),skill=H.SKILLS.wind_slash;
  const results=Array.from({length:10},(_,i)=>fx.emit(skill,{x:i,z:0},0,{impact:true}));
  assert.equal(results.filter(Boolean).length,3);assert.ok(results.slice(0,3).every(Boolean)&&results.slice(3).every(r=>r===null));assert.equal(fx.stats().groups,3);
  const casts=Array.from({length:4},()=>fx.emit(skill,{x:0,z:0}));assert.ok(casts.every(Boolean),'ordinary casts and charges are never throttled');
  fx.tick(.016);assert.equal(Array.from({length:5},()=>fx.emit(skill,{x:0,z:0},0,{impact:true})).filter(Boolean).length,3,'a new frame, a new budget');
  fx.tick(0);assert.ok(fx.emit(skill,{x:0,z:0},0,{impact:true}));fx.tick(NaN);assert.ok(fx.emit(skill,{x:0,z:0},0,{impact:true}),'even an invalid tick starts a new frame');
  fx.reset();for(let i=0;i<3;i++)assert.ok(fx.emit(skill,{x:0,z:0},0,{impact:true}));assert.equal(fx.emit(skill,{x:0,z:0},0,{impact:true}),null);fx.reset();assert.ok(fx.emit(skill,{x:0,z:0},0,{impact:true}),'reset renews it as well');
  fx.destroy();assert.equal(world.children.length,0);
});
test('hidden impacts do not spend the budget, and the budget is independent of the effect limit',()=>{
  let visible=false;const {fx}=create({visible:at=>visible||at.x>=100,limit:2}),skill=H.SKILLS.hammer_bash;
  for(let i=0;i<8;i++)assert.equal(fx.emit(skill,{x:i,z:0},0,{impact:true}),null);
  visible=true;const shown=Array.from({length:5},(_,i)=>fx.emit(skill,{x:i,z:0},0,{impact:true}));assert.equal(shown.filter(Boolean).length,3,'the eight hidden hits cost nothing');
  assert.equal(fx.stats().groups,2,'the 2-effect cap still evicts the oldest');fx.destroy();
});

test('effects share identical surfaces: about half the materials per hit, each released exactly once (private at the end, recycled at destroy)',()=>{
  const {fx}=create(),f=fx.emit(H.SKILLS.hammer_bash,{x:0,z:0},0,{impact:true});
  assert.ok(f.mats.length<=3,'ground, glow and one shared shard surface: '+f.mats.length);assert.equal(new Set(f.mats).size,f.mats.length);
  const shards=f.group.children.filter(o=>o.name==='impact-metal-spark');assert.equal(shards.length,4);assert.equal(new Set(shards.map(o=>o.material)).size,1);assert.ok(f.mats.includes(shards[0].material));
  const second=fx.emit(H.SKILLS.hammer_bash,{x:1,z:0},0,{impact:true});for(const m of second.mats)assert.equal(f.mats.includes(m),false,'nothing is shared between two effects');
  const owners=new Map();for(const effect of [f,second])for(const m of effect.mats){owners.set(m,0);m.addEventListener('dispose',()=>owners.set(m,owners.get(m)+1));}
  fx.reset();for(const [m,n]of owners)assert.equal(n,m.userData.sharedResource?0:1,'a private material is released once; a recycled one stays with the manager');fx.destroy();assert.ok([...owners.values()].every(n=>n===1),'destroy releases each recycled material exactly once');
  let total=0,count=0;for(const reducedMotion of [false,true]){const {fx:other}=create({reducedMotion});for(const skill of skills)for(const options of OPTIONS){const e=other.emit(skill,{x:0,z:0},0,options);if(e){total+=e.mats.length;count++;other.tick(1);}}other.destroy();}
  assert.ok(total/count<3.5,'the previous build averaged 4.98 materials per effect; now '+(total/count).toFixed(2));
});
test('shared surfaces never leak mutations between the parts that use them',()=>{
  const {fx}=create();
  const thorns=fx.emit(H.SKILLS.thorn_growth,{x:0,z:0},0,{impact:true}),vine=thorns.group.children.find(o=>o.geometry?.type==='TubeGeometry'),cone=thorns.group.children.find(o=>o.geometry?.type==='ConeGeometry');
  assert.equal(vine.material.blending,T.NormalBlending);assert.equal(cone.material.blending,T.AdditiveBlending);assert.notEqual(vine.material,cone.material);
  const steam=fx.emit(H.SKILLS.quick_meal,{x:0,z:0}),warm=steam.group.children.filter(o=>o.isSprite);assert.ok(warm.length>=2);assert.ok(warm.every(o=>o.material.userData.baseOpacity===.46&&o.name.startsWith('culinary-warmth-')));
  const fist=fx.emit(H.SKILLS.flying_fist,{x:0,z:0}),exhaust=fist.group.children.find(o=>o.isSprite);assert.equal(exhaust.material.userData.baseOpacity,.45);assert.equal(exhaust.material.opacity,.45);
  const twin=fx.emit(H.SKILLS.explosive_fists,{x:0,z:0}),fists=twin.group.children.filter(o=>o.name==='robot-propelled-fist');assert.equal(fists.length,2);assert.equal(fists[0].material,fists[1].material);assert.ok(fists[0].material.isMeshPhongMaterial);assert.equal(twin.mats.filter(m=>m.isMeshPhongMaterial).length,1);
  const shield=fx.emit(H.SKILLS.guard_stance,{x:0,z:0}),dome=shield.group.children.find(o=>o.userData.filledShield);assert.ok(dome.material.isShaderMaterial);assert.equal(shield.mats.includes(dome.material),false,'the shared shield shader is not an effect-owned material');assert.ok(shield.mats.every(m=>!m.isShaderMaterial));
  const ground=fx.emit(H.SKILLS.wind_slash,{x:0,z:0}),a=ground.group.getObjectByName('spell-contact-light').material,b=fx.emit(H.SKILLS.wind_slash,{x:3,z:0}).group.getObjectByName('spell-contact-light').material;assert.notEqual(a,b);assert.notEqual(a.userData.energyPhase,b.userData.energyPhase);
  fx.tick(.1);const opacities=new Set(ground.mats.map(m=>m.opacity));assert.ok(opacities.size>=2,'each surface still follows its own envelope');
  for(const part of ground.parts)if(part.m.material&&part.m.material.userData.baseOpacity!==undefined){const m=part.m.material,kind=m.userData.envelope||'body';assert.ok(Math.abs(m.opacity-m.userData.baseOpacity*V.envelope(1-ground.left/ground.total,ground.signature,kind))<1e-12);}
  fx.destroy();
});

// Wraps THREE so that every constructor call is counted by name.
function counting(){
  const counts={},cache=new Map(),handler={get(target,key){const value=target[key];if(typeof value!=='function'||!/^[A-Z]/.test(String(key))||!/(Geometry|Shape|Curve3|Color)$/.test(String(key)))return value;if(!cache.has(key))cache.set(key,class extends value{constructor(...args){super(...args);counts[key]=(counts[key]||0)+1;}});return cache.get(key);}};
  return {counts,T:new Proxy(T,handler)};
}
test('after the first cast of a silhouette nothing is tessellated, triangulated or recoloured again',()=>{
  const spy=counting(),world=new T.Group(),fx=V.create(spy.T,{world:()=>world,limit:12});
  const stamp=skill=>{const before={...spy.counts};const f=fx.emit(skill,{x:0,z:0},0,{impact:true});fx.tick(1);return {f,delta:Object.fromEntries(Object.keys(spy.counts).map(k=>[k,spy.counts[k]-(before[k]||0)]).filter(([,n])=>n))};};
  for(const id of ['hammer_bash','thunder_wave','thorn_growth','wind_slash','soup_splash','flying_fist','shoulder_quake']){
    const skill=H.SKILLS[id]||{id,job:'robot',effect:id},first=stamp(skill),second=stamp(skill);
    const forbidden=['SphereGeometry','OctahedronGeometry','DodecahedronGeometry','ShapeGeometry','TubeGeometry','ConeGeometry','IcosahedronGeometry','ExtrudeGeometry','CatmullRomCurve3','Shape'];
    for(const key of forbidden)assert.ok(!(second.delta[key]>0&&id!=='flying_fist'),id+' rebuilt '+key+' '+JSON.stringify(second.delta));
    assert.equal(summary(first.f).length,summary(second.f).length);
  }
  const colors=spy.counts.Color;fx.emit(H.SKILLS.hammer_bash,{x:0,z:0},0,{impact:true});fx.tick(1);const after=spy.counts.Color;
  fx.emit(H.SKILLS.hammer_bash,{x:0,z:0},0,{impact:true});assert.ok(spy.counts.Color-after<=6,'repeat casts allocate only the handful of colours the effect itself needs: '+(spy.counts.Color-after));
  fx.destroy();assert.ok(colors>0);
});
test('a repeated impact costs a fraction of the CPU of the first, with the same number of geometry objects per effect',()=>{
  const {fx}=create(),skill=H.SKILLS.hammer_bash;
  const gid=geometryIds();fx.emit(skill,{x:0,z:0},0,{impact:true});const firstGeometries=geometryIds()-gid-1;fx.tick(1);
  const g2=geometryIds();fx.emit(skill,{x:0,z:0},0,{impact:true});const repeat=geometryIds()-g2-1;assert.equal(repeat,6,'ground, four sparks, one particle cloud');assert.ok(firstGeometries>repeat,'the first cast also builds the shared templates');
  fx.destroy();
});

test('each effect keeps private geometry: arrays are never aliased and releasing one cannot disturb a sibling',()=>{
  const {fx}=create({limit:3}),skill=H.SKILLS.herbal_heal,a=fx.emit(skill,{x:0,z:0}),b=fx.emit(skill,{x:1,z:0}),events=new Map();
  const geometries=effect=>{const set=new Set();effect.group.traverse(o=>{if((o.isMesh||o.isPoints)&&o.geometry)set.add(o.geometry);});return set;};
  const ga=geometries(a),gb=geometries(b);for(const g of ga)assert.equal(gb.has(g),false);
  const arrays=new Set();for(const g of ga)for(const attribute of Object.values(g.attributes))arrays.add(attribute.array);for(const g of gb)for(const attribute of Object.values(g.attributes))assert.equal(arrays.has(attribute.array),false,'a typed array is shared between effects');
  const before=summary(b);for(const g of ga)for(const attribute of Object.values(g.attributes))attribute.array.fill(0);assert.deepEqual(summary(b),before,'zeroing one effect leaves its sibling intact');
  for(const g of [...ga,...gb])g.addEventListener('dispose',()=>events.set(g,(events.get(g)||0)+1));
  fx.cancel(a);assert.ok([...ga].every(g=>events.get(g)===1)&&[...gb].every(g=>!events.has(g)));
  const c=fx.emit(skill,{x:2,z:0});assert.deepEqual(summary(c).slice(0,3),summary(b).slice(0,3));assert.ok(c.group.children.length>0);
  fx.reset();assert.ok([...gb].every(g=>events.get(g)===1));fx.destroy();
});

test('particle colour is two uniforms per cloud and one shared program: no colour attribute is built or uploaded',()=>{
  const {fx}=create(),a=fx.emit(H.SKILLS.thunder_wave,{x:0,z:0}),b=fx.emit(H.SKILLS.herbal_heal,{x:1,z:0}),clouds=[a,b].map(f=>f.group.children.find(o=>o.isPoints));
  const material=clouds[0].material;assert.equal(clouds[1].material,material);assert.equal(material.vertexColors,false);assert.match(material.vertexShader,/uniform vec3 tintA; uniform vec3 tintB/);assert.match(material.vertexShader,/tint=mix\(tintA,tintB,tone\)/);assert.doesNotMatch(material.vertexShader,/tint=color/);
  for(const cloud of clouds){const attributes=cloud.geometry.attributes;assert.deepEqual(Object.keys(attributes).sort(),['pointSize','position','seed','tone','velocity']);assert.equal(attributes.color,undefined);
    assert.deepEqual(Array.from(attributes.tone.array,(v,i)=>v===i%2),Array(48).fill(true));}
  const palettes=[V.colorsFor(H.SKILLS.thunder_wave),V.colorsFor(H.SKILLS.herbal_heal)];assert.notDeepEqual(palettes[0],palettes[1]);
  clouds.forEach((cloud,i)=>{cloud.onBeforeRender();assert.equal(material.uniforms.tintA.value.getHex(),palettes[i][0]);assert.equal(material.uniforms.tintB.value.getHex(),palettes[i][1]);});
  clouds[0].onBeforeRender();assert.equal(material.uniforms.tintA.value.getHex(),palettes[0][0],'each draw restores its own tint');
  const reduced=create({reducedMotion:true}).fx.emit(H.SKILLS.thunder_wave,{x:0,z:0}).group.children.find(o=>o.isPoints);assert.equal(reduced.geometry.attributes.position.count,12);
  fx.destroy();
});

// ---- recycled materials ----
const MISC_OPTIONS=[{},{impact:true},{stage:'charge',duration:1.2},{stage:'land'}];
function watcher(){
  const counts=new Map(),watch=r=>{if(!counts.has(r)){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}return r;};
  return {counts,watch,watchEffect(f){for(const m of f.mats)watch(m);f.group.traverse(o=>{if((o.isMesh||o.isPoints)&&o.geometry)watch(o.geometry);});return f;},
    get pooled(){return [...counts.keys()].filter(r=>r.userData?.sharedResource);},get privates(){return [...counts.keys()].filter(r=>!r.userData?.sharedResource);}};
}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function realDisposer(){const c=vm.createContext({_texCache:{},spriteCache:{},makePickupMarker:{ringGeom:null,beamGeom:null,materials:{}}}),from=html.indexOf('function disposeSceneObject(root)');vm.runInContext(html.slice(from,html.indexOf('\nlet sceneEpoch=',from)),c);return c.disposeSceneObject;}

test('once every effect is gone the next hit leases the very same pooled materials, restated for its own colours',()=>{
  const {fx}=create(),w=watcher(),a=w.watchEffect(fx.emit(H.SKILLS.hammer_bash,{x:0,z:0},0,{impact:true})),first=[...a.mats],phase=a.group.getObjectByName('spell-contact-light').material.userData.energyPhase;
  assert.ok(first.every(m=>m.userData.sharedResource),'a hit uses only recycled surfaces: '+first.length);
  fx.tick(5);assert.equal(fx.stats().groups,0);
  const b=w.watchEffect(fx.emit(H.SKILLS.hammer_bash,{x:0,z:0},0,{impact:true}));assert.equal(b.mats.length,first.length);
  for(const m of b.mats)assert.ok(first.includes(m),'the same object, not an equivalent new one');
  fx.tick(5);const other=w.watchEffect(fx.emit(H.SKILLS.herbal_heal,{x:0,z:0})),ground=other.group.getObjectByName('spell-contact-light').material;
  assert.equal(ground.userData.energyPhase,phase,'the ground surface keeps its compiled phase uniforms');assert.equal(phase.age.value,0);assert.equal(phase.style.value,V.ACCENTS.radiant);assert.equal(phase.tint.value.getHex(),V.colorsFor(H.SKILLS.herbal_heal)[0]);assert.equal(ground.color.getHex(),V.colorsFor(H.SKILLS.herbal_heal)[1]);
  assert.ok(first.includes(ground)&&other.mats.filter(m=>first.includes(m)).length>=2,'a different spell draws on the same pooled surfaces');
  assert.ok(w.pooled.every(m=>w.counts.get(m)===0));fx.destroy();
});
test('a leased material belongs to one effect at a time; colour, opacity and envelope never leak between spells',()=>{
  const {fx}=create(),a=fx.emit(H.SKILLS.thunder_wave,{x:0,z:0}),b=fx.emit(H.SKILLS.herbal_heal,{x:2,z:0}),keep=[...a.mats];
  for(const m of b.mats)assert.equal(a.mats.includes(m),false,'two live effects never hold the same pooled material');
  fx.tick(.2);const snapshot=b.mats.map(m=>[m.color.getHex(),m.opacity,m.userData.baseOpacity,m.userData.envelope]);
  fx.cancel(a);const c=fx.emit(H.SKILLS.soup_splash,{x:4,z:0});assert.ok(c.mats.some(m=>keep.includes(m)),'the cancelled spell surfaces are recycled at once');
  for(const m of c.mats){assert.equal(m.opacity,m.userData.baseOpacity,'a fresh lease starts at its own base opacity');if(m.userData.envelope==='ground')assert.equal(m.color.getHex(),V.colorsFor(H.SKILLS.soup_splash)[1]);}
  fx.tick(.1);assert.deepEqual(b.mats.map(m=>m.userData.baseOpacity),snapshot.map(r=>r[2]),'the sibling is untouched by the recycled materials');
  const palettes=new Set([...c.mats].filter(m=>m.userData.envelope!=='ground'&&m.color.getHex()!==0xffffff).map(m=>m.color.getHex()));for(const hex of palettes)assert.ok(V.colorsFor(H.SKILLS.soup_splash).includes(hex));
  fx.destroy();
});
test('recycled materials are never disposed by an effect ending, eviction, cancel or reset, and destroy releases each exactly once',()=>{
  const {fx,world}=create({limit:3}),w=watcher();
  for(const skill of skills.filter((_,i)=>i%2===0))for(const options of MISC_OPTIONS){const f=fx.emit(skill,{x:0,z:0},0,options);if(!f)continue;w.watchEffect(f);fx.tick(.3);if(f.skill.length%5===0)fx.cancel(f);}
  fx.tick(9);fx.reset();assert.equal(world.children.length,0);
  assert.ok(w.pooled.length>=5&&w.pooled.length<=7*16,'a handful of pooled variants: '+w.pooled.length);assert.ok(w.pooled.every(m=>w.counts.get(m)===0),'nothing recycled was disposed while the manager lived');
  assert.ok(w.privates.every(r=>w.counts.get(r)===1),'every private geometry was released exactly once, by its own effect');
  const live=fx.emit(H.SKILLS.hammer_bash,{x:0,z:0},0,{impact:true});w.watchEffect(live);
  fx.destroy();assert.ok([...w.counts.values()].every(n=>n===1),'destroy: each recycled material once, private ones not again');
  fx.destroy();assert.ok([...w.counts.values()].every(n=>n===1),'a second destroy releases nothing');assert.equal(fx.emit(H.SKILLS.hammer_bash,{x:0,z:0}),null);assert.equal(world.children.length,0);
});
test('the pool is bounded per shader variant: overflow gets private materials that the effect releases itself',()=>{
  const {fx}=create({limit:12}),w=watcher(),slash=H.SKILLS.wind_slash,live=[];
  for(let i=0;i<12;i++)live.push(w.watchEffect(fx.emit(slash,{x:i,z:0})));
  const sprites=live.flatMap(f=>f.mats.filter(m=>m.isSpriteMaterial));assert.equal(new Set(sprites).size,24,'twelve slashes want twenty-four glow sprites at once');
  const pooledSprites=sprites.filter(m=>m.userData.sharedResource),privateSprites=sprites.filter(m=>!m.userData.sharedResource);assert.equal(pooledSprites.length,16);assert.equal(privateSprites.length,8);
  fx.tick(5);assert.equal(fx.stats().groups,0);
  assert.ok(pooledSprites.every(m=>w.counts.get(m)===0)&&privateSprites.every(m=>w.counts.get(m)===1),'pooled stay, overflow released once');
  const again=[];for(let i=0;i<12;i++)again.push(w.watchEffect(fx.emit(slash,{x:i,z:0})));
  const second=again.flatMap(f=>f.mats.filter(m=>m.isSpriteMaterial&&m.userData.sharedResource));assert.equal(new Set(second).size,16);for(const m of second)assert.ok(pooledSprites.includes(m),'the same sixteen are leased again, none created');
  const every=new Set(w.pooled.filter(m=>m.isSpriteMaterial));assert.equal(every.size,16,'the pool never grows past its cap, however many casts');
  fx.destroy();assert.ok([...w.counts.values()].every(n=>n===1));
});
test('the real floor teardown (disposeSceneObject) skips pooled materials, whether it runs before or after the manager resets',()=>{
  const dispose=realDisposer(),{fx,world}=create(),w=watcher(),events=new Map();
  const a=w.watchEffect(fx.emit(H.SKILLS.herbal_heal,{x:0,z:0})),b=w.watchEffect(fx.emit(H.SKILLS.hammer_bash,{x:2,z:0},0,{impact:true})),pooled=[...a.mats,...b.mats].filter(m=>m.userData.sharedResource),maps=new Set(pooled.map(m=>m.map).filter(Boolean));
  for(const map of maps){events.set(map,0);map.addEventListener('dispose',()=>events.set(map,events.get(map)+1));}
  assert.ok(pooled.length>=4&&maps.size>=1);
  dispose(world);assert.ok(pooled.every(m=>w.counts.get(m)===0),'teardown first: pooled materials untouched');assert.ok([...events.values()].every(n=>n===0),'and so are their textures');
  fx.reset();assert.ok(pooled.every(m=>w.counts.get(m)===0));
  const next=fx.emit(H.SKILLS.herbal_heal,{x:0,z:0});assert.ok(next.mats.some(m=>pooled.includes(m)),'the next floor still draws on the same pooled materials');
  fx.reset();const fresh=new T.Group();
  const second=create({},fresh),w2=watcher();w2.watchEffect(second.fx.emit(H.SKILLS.herbal_heal,{x:0,z:0}));second.fx.reset();dispose(fresh);
  assert.ok(w2.pooled.length>0&&w2.pooled.every(m=>w2.counts.get(m)===0),'reset first, teardown second: also untouched');
  second.fx.destroy();assert.ok(w2.pooled.every(m=>w2.counts.get(m)===1));fx.destroy();assert.ok(pooled.every(m=>w.counts.get(m)===1));assert.ok([...events.values()].every(n=>n===1));
});
test('a recycled pool renders every family exactly like a brand-new manager',()=>{
  for(const reducedMotion of [false,true]){
    const world=new T.Group(),fx=V.create(T,{world:()=>world,limit:12,reducedMotion});
    for(const skill of skills)for(const options of OPTIONS){fx.emit(skill,{x:0,z:0},0,options);fx.tick(.2);}fx.tick(20);
    const digests={};
    for(const [family,skill]of byFamily){const parts=[];for(const options of OPTIONS){const f=fx.emit(skill,{x:1,z:2},.3,options);if(!f){parts.push(null);continue;}fx.tick(.1);parts.push(summary(f));fx.tick(20);}digests[family]=parts;}
    const fresh={};for(const [family,skill]of byFamily){const parts=[];for(const options of OPTIONS){const w=new T.Group(),m=V.create(T,{world:()=>w,limit:12,reducedMotion}),f=m.emit(skill,{x:1,z:2},.3,options);if(!f){parts.push(null);continue;}m.tick(.1);parts.push(summary(f));m.destroy();}fresh[family]=parts;}
    for(const family of byFamily.keys())assert.equal(digest(digests[family]),digest(fresh[family]),family+(reducedMotion?' (reduced)':''));
    fx.destroy();
  }
});
