import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),S=require('../assets/character-sculpt.js'),A=require('../assets/equipment-surfaces.js');
const source=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function canvasDocument(){
  let canvases=0;
  return {get count(){return canvases;},createElement(tag){assert.equal(tag,'canvas');canvases++;const commands=[],ctx=new Proxy({}, {get(target,key){if(key==='createLinearGradient')return (...args)=>{commands.push([key,...args]);return {addColorStop(...a){commands.push(['color',...a]);}};};if(key in target)return target[key];return (...args)=>commands.push([key,...args]);},set(target,key,value){target[key]=value;commands.push([key,value]);return true;}});return {width:0,height:0,commands,getContext(mode){assert.equal(mode,'2d');return ctx;}};}};
}
function env(document=canvasDocument()){
  const e=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:S,EquipmentSurfaces:A,document,_texCache:{},spriteCache:{},makePickupMarker:{}});vm.runInContext(source,e);
  const start=html.indexOf('function disposeSceneObject(root)'),end=html.indexOf('\nlet sceneEpoch=',start);vm.runInContext(html.slice(start,end),e);return e;
}
function resources(model){const maps=new Set(),materials=new Set(),geometries=new Set();model.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);materials.add(o.material);if(o.material.map)maps.add(o.material.map);});return {maps,materials,geometries};}
test('one small original atlas covers metal, leather and fabric across all 180 gender/tier equipment variants',t=>{
  const e=env();let maxDraws=0,maxTriangles=0;
  for(const kind of Object.keys(H.GEAR))for(const sex of ['male','female']){
    const g=e.TowerHeroVisuals.gear(T,kind,{sex}),{maps}=resources(g);assert.equal(maps.size,1,kind+':'+sex);const map=[...maps][0];assert.equal(map.image.width,128);assert.equal(map.image.height,128);assert.equal(map.userData.equipmentOwned,true);assert.equal(map.userData.bytes,65536);assert.equal(map.userData.tier,H.GEAR[kind].tier);assert.equal(map.colorSpace,T.SRGBColorSpace);assert.equal(map.anisotropy,1);assert.ok(map.image.commands.length>200);let triangles=0;
    g.traverse(o=>{assert.ok(!o.isLight);if(!o.isMesh)return;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.ok(!o.castShadow);const mat=o.material;if(!mat.map)return;assert.equal(mat.bumpMap,map);assert.ok(mat.bumpScale<=.006);const uv=o.geometry.attributes.uv,rect=A.REGIONS[mat.userData.surface];assert.ok(rect);assert.equal(uv.count,o.geometry.attributes.position.count);for(let i=0;i<uv.count;i++){assert.ok(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i)));assert.ok(uv.getX(i)>=rect[0]-.000001&&uv.getX(i)<=rect[0]+rect[2]+.000001);assert.ok(uv.getY(i)>=rect[1]-.000001&&uv.getY(i)<=rect[1]+rect[3]+.000001);}});
    maxDraws=Math.max(maxDraws,g.children.length);maxTriangles=Math.max(maxTriangles,triangles);assert.ok(g.children.length<=8,kind+':'+sex);assert.ok(triangles<5000,kind+':'+sex);assert.equal(g.userData.detailEdition,2);e.disposeSceneObject(g);
  }
  assert.ok(maxDraws<=8);assert.ok(maxTriangles<5000);assert.equal(e.document.count,180);t.diagnostic('180 gear variants: max '+maxDraws+' draws, '+maxTriangles+' triangles, 65536 atlas bytes each before mipmaps');
});
test('all five grades have original finish detail and each job has a raised maker crest',()=>{
  const e=env(),signatures=[];for(let tier=1;tier<=5;tier++){const g=e.TowerHeroVisuals.gear(T,H.tierKind('heavy_armor',tier),{job:'smith',sex:'female'});signatures.push(JSON.stringify([...resources(g).maps][0].image.commands));assert.ok(g.userData.authoredParts.includes('profession-raised-heraldry')||g.userData.authoredParts.includes('female-leaf-crest'));}
  assert.equal(new Set(signatures).size,5);const atlasSigns=[];for(const job of Object.keys(H.JOBS)){const g=e.TowerHeroVisuals.gear(T,'robe_t3',{job});atlasSigns.push(JSON.stringify([...resources(g).maps][0].image.commands));}assert.equal(new Set(atlasSigns).size,7);
});
test('repeated dressing retains the current texture and disposes replaced atlases exactly once with the engine lifecycle',()=>{
  const e=env(),model=new T.Group();model.userData={heroJob:'scout',heroSex:'female',heroPieces:[],armR:new T.Group(),armL:new T.Group()};model.add(model.userData.armR,model.userData.armL);const equipment={helmet:null,armor:{kind:'light_armor',slot:'armor'},shield:null,weapon:{kind:'twin_daggers',slot:'weapon'}},seen=new Map(),textureDispose=T.Texture.prototype.dispose;
  T.Texture.prototype.dispose=function(){seen.set(this,(seen.get(this)||0)+1);return textureDispose.call(this);};
  try{
    const live=[];for(let tier=1;tier<=5;tier++){equipment.armor.kind=H.tierKind('light_armor',tier);equipment.weapon.kind=H.tierKind('twin_daggers',tier);e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);const maps=resources(model).maps;assert.equal(maps.size,3);for(const texture of maps){assert.equal(seen.get(texture)||0,0);live.push(texture);}const before=e.document.count;e.TowerHeroVisuals.dress(T,model,equipment,e.disposeSceneObject);assert.equal(e.document.count,before);}
    const other=e.TowerHeroVisuals.gear(T,'light_armor_t5',{sex:'female'}),otherMap=[...resources(other).maps][0];e.TowerHeroVisuals.dress(T,model,{helmet:null,armor:null,shield:null,weapon:null},e.disposeSceneObject);for(const texture of live)assert.equal(seen.get(texture),1);assert.equal(seen.get(otherMap)||0,0);e.disposeSceneObject(other);assert.equal(seen.get(otherMap),1);
  }finally{T.Texture.prototype.dispose=textureDispose;}
});
test('surface atlas generation falls back safely when a 2d context is unavailable',()=>{
  assert.equal(A.create(T,{},null),null);assert.equal(A.create(T,{}, {createElement(){return {getContext(){return null;}};}}),null);const e=env(undefined);e.document={createElement(){return {getContext(){return null;}};}};const g=e.TowerHeroVisuals.gear(T,'heavy_armor');assert.equal(resources(g).maps.size,0);assert.ok(g.children.length<=8);
});
