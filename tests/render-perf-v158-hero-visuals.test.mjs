import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),R=require('../story/tower-robot-core.js'),S=require('../assets/character-sculpt.js'),A=require('../assets/equipment-surfaces.js'),F=require('../assets/character-face.js'),M=require('../story/tower-combat-motion.js');
const source=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function canvasDocument(){
  let canvases=0;
  return {get count(){return canvases;},createElement(tag){assert.equal(tag,'canvas');canvases++;const commands=[],ctx=new Proxy({},{get(target,key){if(key==='createLinearGradient')return (...args)=>{commands.push([key,...args]);return {addColorStop(...a){commands.push(['color',...a]);}};};if(key in target)return target[key];return (...args)=>commands.push([key,...args]);},set(target,key,value){target[key]=value;commands.push([key,value]);return true;}});return {width:0,height:0,commands,getContext(){return ctx;}};}};
}
function env(document=canvasDocument()){
  const e=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:S,CharacterFace:F,CharacterMotion:require('../assets/character-motion.js'),TowerCombatMotion:M,EquipmentSurfaces:A,document,_texCache:{},spriteCache:{},makePickupMarker:{}});vm.runInContext(source,e);
  const start=html.indexOf('function disposeSceneObject(root)');vm.runInContext(html.slice(start,html.indexOf('\nlet sceneEpoch=',start)),e);return e;
}
const textures=model=>{const set=new Set();model.traverse(o=>{if(o.isMesh&&o.material.map)set.add(o.material.map);});return set;};

test('pieces of one grade and job draw the atlas once and share one image source, yet keep their own texture objects',()=>{
  const e=env(),model=new T.Group();model.userData={heroJob:'scout',heroSex:'female',heroPieces:[],armR:new T.Group(),armL:new T.Group()};model.add(model.userData.armR,model.userData.armL);
  const equipment={helmet:null,armor:{kind:'light_armor_t3',slot:'armor'},shield:null,weapon:{kind:'twin_daggers_t3',slot:'weapon'}};
  e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);
  const maps=[...textures(model)];assert.equal(maps.length,3,'armor + two daggers: three texture objects');
  assert.equal(e.document.count,1,'the artwork was painted once, not three times');
  assert.ok(maps.every(map=>map.source===maps[0].source),'one shared image source, so the renderer keeps one GPU copy');
  assert.ok(maps.every(map=>map.image===maps[0].image&&map.image.width===128&&map.image.height===128));
  assert.ok(maps.every(map=>map.anisotropy===1&&map.colorSpace===T.SRGBColorSpace&&map.userData.bytes===65536&&map.userData.tier===3&&map.userData.job==='scout'));
  assert.equal(new Set(maps).size,3);
  for(const map of maps){const uses=new Set();model.traverse(o=>{if(o.isMesh&&(o.material.map===map||o.material.bumpMap===map))uses.add(o.material.map===o.material.bumpMap);});assert.ok(!uses.has(false),'map and bump map of a piece are the same texture');}
  const other=e.TowerHeroVisuals.gear(T,'robe_t3',{job:'mage',sex:'male'}),otherMap=[...textures(other)][0];assert.notEqual(otherMap.source,maps[0].source,'another job gets its own artwork');assert.equal(e.document.count,2);
  const tier5=e.TowerHeroVisuals.gear(T,'light_armor_t5',{job:'scout',sex:'female'}),tier5Map=[...textures(tier5)][0];assert.notEqual(tier5Map.source,maps[0].source,'another grade gets its own artwork');assert.equal(e.document.count,3);
  for(const g of [other,tier5])e.disposeSceneObject(g);
});

test('the shared atlas is released with its last texture: no early release, no double count, no leak',()=>{
  const e=env(),seen=new Map(),original=T.Texture.prototype.dispose;
  T.Texture.prototype.dispose=function(){seen.set(this,(seen.get(this)||0)+1);return original.call(this);};
  try{
    const make=()=>e.TowerHeroVisuals.gear(T,'light_armor_t2',{job:'archer',sex:'male'});
    const a=make(),b=make(),c=make();assert.equal(e.document.count,1);const sourceA=[...textures(a)][0].source;
    e.disposeSceneObject(a);const d=make();assert.equal(e.document.count,1,'still shared after one holder left');assert.equal([...textures(d)][0].source,sourceA);
    e.disposeSceneObject(b);e.disposeSceneObject(b);assert.equal(e.document.count,1);
    const stillThere=make();assert.equal(e.document.count,1,'disposing the same piece twice must not release the atlas for the others');
    for(const g of [c,d,stillThere])e.disposeSceneObject(g);
    const fresh=make();assert.equal(e.document.count,2,'once every texture is gone the artwork is drawn afresh');assert.notEqual([...textures(fresh)][0].source,sourceA);
    const twice=[...seen.entries()].filter(([,n])=>n>1);assert.equal(twice.length,1,'only the piece this test disposed twice, itself, counts twice');assert.ok([...seen.values()].every(n=>n>=1));
    e.disposeSceneObject(fresh);
  }finally{T.Texture.prototype.dispose=original;}
});

test('separate documents never share drawn atlases and a failed 2d context leaves no cache entry behind',()=>{
  const one=canvasDocument(),two=canvasDocument(),a=A.create(T,{tier:2,job:'smith'},one),b=A.create(T,{tier:2,job:'smith'},two),c=A.create(T,{tier:2,job:'smith'},one);
  assert.notEqual(a.source,b.source);assert.equal(a.source,c.source);assert.equal(one.count,1);assert.equal(two.count,1);
  const noContext={createElement(){return {getContext(){return null;}};}};assert.equal(A.create(T,{tier:2,job:'smith'},noContext),null);assert.equal(A.create(T,{tier:2,job:'smith'},noContext),null);
  for(const t of [a,b,c])t.dispose();
});

test('dressing an unchanged outfit costs no signature strings, filters or entries, but every real change is still noticed',()=>{
  const e=env(),model=new T.Group(),calls={entries:0,fromEntries:0},Obj=vm.runInContext('Object',e);
  model.userData={heroJob:'swordsman',heroSex:'male',heroPieces:[],armR:new T.Group(),armL:new T.Group()};model.add(model.userData.armR,model.userData.armL);
  const gear=(kind,slot,extra={})=>({kind,slot,durability:50,...extra}),equipment={helmet:gear('heavy_helm','helmet'),armor:gear('heavy_armor','armor'),weapon:gear('longsword','weapon'),shield:null};
  let disposed=0;const dispose=piece=>{disposed++;e.disposeSceneObject(piece);},dress=(options)=>e.TowerHeroVisuals.dress(T,model,equipment,dispose,options);
  dress();const pieces=model.userData.heroPieces,count=pieces.length;assert.equal(count,3);
  const entries=Obj.entries,fromEntries=Obj.fromEntries;Obj.entries=(...a)=>{calls.entries++;return entries(...a);};Obj.fromEntries=(...a)=>{calls.fromEntries++;return fromEntries(...a);};
  try{for(let i=0;i<500;i++)dress();assert.deepEqual(calls,{entries:0,fromEntries:0});assert.equal(model.userData.heroPieces,pieces);assert.equal(disposed,0);
    // a changed piece, a broken piece, a repaired piece, an in-place kind swap and the helmet toggle each rebuild exactly what changed
    equipment.weapon=gear('greatsword','weapon');dress();assert.equal(model.userData.heroWeaponKind,'greatsword');assert.notEqual(model.userData.heroPieces,pieces);assert.equal(model.userData.heroPieces.length,3);
    equipment.weapon.durability=0;dress();assert.equal(model.userData.heroPieces.length,2);assert.equal(model.userData.hasWeapon,false);
    equipment.weapon.durability=10;dress();assert.equal(model.userData.heroPieces.length,3);assert.equal(model.userData.hasWeapon,true);
    equipment.armor.kind='heavy_armor_t2';dress();assert.ok(model.userData.heroPieces.some(p=>p.name==='hero-gear-heavy_armor_t2'));
    dress({showHelmet:false});assert.equal(model.userData.heroPieces.length,2);dress({showHelmet:true});assert.equal(model.userData.heroPieces.length,3);
    equipment.shield=gear('buckler','shield');dress();assert.equal(model.userData.hasShield,true);equipment.shield=null;dress();assert.equal(model.userData.hasShield,false);
    model.userData.heroDress='';const before=model.userData.heroPieces;dress();assert.equal(model.userData.heroPieces,before,'an invalidated signature falls back to the full comparison, with the same result');
  }finally{Obj.entries=entries;Obj.fromEntries=fromEntries;}
  assert.ok(calls.entries>0,'the changed outfits did take the full path');
});

test('a robot notices core grade and spent-core changes without rebuilding its shell, and ignores unchanged cores',()=>{
  const e=env(),model=e.TowerHeroVisuals.base('robot',()=>{throw Error('no human');},'hero','female'),core=(tier,durability=100)=>({kind:R.kind('robot_core',tier),slot:'core',durability});
  const equipment={helmet:null,armor:{kind:R.kind('robot_shell',2),slot:'armor',durability:100},weapon:{kind:R.kind('robot_fists',2),slot:'weapon',durability:100},shield:null,core1:core(1),core2:null};
  e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);const pieces=model.userData.heroPieces;assert.equal(model.userData.robotLightTier,1);
  for(let i=0;i<50;i++)e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.equal(model.userData.heroPieces,pieces);
  equipment.core2=core(4);e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.equal(model.userData.robotLightTier,4);assert.equal(model.userData.heroPieces,pieces,'recolouring the energy parts needs no new pieces');
  equipment.core2.durability=0;e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.equal(model.userData.robotLightTier,1);
  equipment.core1=core(3);e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.equal(model.userData.robotLightTier,3);
  equipment.core1.kind=R.kind('robot_core',5);e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.equal(model.userData.robotLightTier,5,'an in-place kind change is seen');
  equipment.armor.durability=0;e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.ok(!model.userData.heroPieces.some(p=>p.userData.baseKind==='robot_shell'));
});

const release=model=>{const gs=new Set(),ms=new Set();model.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());};
const equipmentOf=tier=>Object.fromEntries(['armor','weapon'].map(slot=>{const kind=R.kind(slot==='armor'?'robot_shell':'robot_fists',tier);return [slot,{kind,slot,durability:100}];}));
function robot(sex,tier){const e=env(),V=e.TowerHeroVisuals,m=V.base('robot',()=>{throw Error('human');},'hero',sex);V.dress(T,m,equipmentOf(tier),release);return m;}
function draws(model){let meshes=0,rendered=0,triangles=0;model.traverse(o=>{if(!o.isMesh)return;meshes++;let shown=true;for(let p=o;p;p=p.parent)if(!p.visible)shown=false;if(shown)rendered++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return {meshes,rendered,triangles};}
test('a robot figure renders eleven fewer meshes per frame with identical triangles',()=>{
  // Measured on the previous build: [meshes, meshes actually drawn (incl. two invisible blush draws), triangles].
  const before={male:{1:[43,35,12174],3:[45,37,13930],5:[47,39,15694]},female:{1:[43,35,12078],3:[45,37,13848],5:[47,39,15612]}};
  for(const sex of ['male','female'])for(const tier of [1,3,5]){
    const m=robot(sex,tier);F.update(m,1.3,'calm');const now=draws(m),[meshes,rendered,triangles]=before[sex][tier];
    assert.equal(now.triangles,triangles,sex+tier+' same geometry');assert.equal(now.meshes,meshes-9,sex+tier+' nine draws merged away');assert.equal(now.rendered,rendered-11,sex+tier+' plus two blush draws no longer issued');
  }
});
test('merged robot parts keep exact colours, and the chassis and cranium remain individually addressable',()=>{
  const m=robot('male',1),shell=m.userData.heroPieces.find(p=>p.userData.baseKind==='robot_shell'),batch=shell.children.find(o=>o.userData.staticBatch&&o.material.userData.surface==='metal');
  assert.ok(batch,'the shell metal batch exists');
  const chest=new T.SphereGeometry(1,12,8).toNonIndexed().attributes.position.count,metal=new T.Color(0x687c88),color=batch.geometry.attributes.color;
  for(let i=0;i<chest;i++){assert.ok(Math.abs(color.getX(i)-metal.r)<1e-6&&Math.abs(color.getY(i)-metal.g)<1e-6&&Math.abs(color.getZ(i)-metal.b)<1e-6,'the former stand-alone chest shell is not darkened by batch shading');}
  assert.ok(shell.children.every(o=>!o.isMesh||o.userData.staticBatch||o.name!=='robot-continuous-chest-shell'),'the chest shell no longer costs its own draw');
  const head=m.userData.headMesh;let under=false;for(let p=head.parent;p;p=p.parent)if(p===m.userData.head)under=true;assert.ok(under&&head.parent&&head.name==='robot-seamless-cranium','the cranium handle stays attached to the head rig');
  assert.ok(m.userData.body.getObjectByName('robot-base-chassis'));
  assert.equal(m.userData.body.userData.robotPart,true);
  assert.ok(m.userData.armR.children.every(o=>!o.isMesh||o.userData.staticBatch||o.name!=='robot-shoulder-ball'),'limb joints batch their spheres too');
});
