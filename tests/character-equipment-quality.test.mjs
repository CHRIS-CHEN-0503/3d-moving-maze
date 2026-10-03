import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),S=require('../assets/character-sculpt.js');
function visuals(){const e=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:S});vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),e);return e.TowerHeroVisuals;}
test('all gender and tier equipment batches have finite positions, color and normals within mobile draw budget',()=>{
  const V=visuals();let source=0,draws=0,variants=0;
  for(const kind of Object.keys(H.GEAR))for(const sex of ['male','female']){
    const m=V.gear(T,kind,{sex});variants++;source+=m.userData.sourceParts;draws+=m.userData.renderParts;assert.ok(m.children.length<=8,kind+':'+sex);m.updateMatrixWorld(true);
    m.traverse(o=>{assert.ok(!o.isLight);if(!o.isMesh)return;assert.equal(o.material.map,null);for(const key of ['position','normal','color'])if(o.geometry.attributes[key])assert.ok(Array.from(o.geometry.attributes[key].array).every(Number.isFinite));if(o.userData.staticBatch){assert.ok(o.material.vertexColors);assert.equal(o.geometry.attributes.position.count,o.geometry.attributes.color.count);}});
    const bounds=new T.Box3().setFromObject(m);assert.ok(bounds.max.y<2.4&&bounds.min.y>-.85,kind);
  }
  assert.equal(variants,210);assert.ok(draws/source<.65,'static gear must save at least 35 percent of authored part draws');
});
test('weapon tiers gain functional silhouette geometry instead of only recoloring identical shapes',()=>{
  const V=visuals();for(const base of Object.keys(H.GEAR).filter(k=>H.GEAR[k].slot==='weapon'&&H.GEAR[k].tier===1)){
    const signatures=[1,2,3,4,5].map(tier=>{const g=V.gear(T,H.tierKind(base,tier)),values=[];g.traverse(o=>{if(o.isMesh)values.push(Array.from(o.geometry.attributes.position.array));});return JSON.stringify(values);});assert.equal(new Set(signatures).size,5,base);
  }
});
test('fourth and fifth grades use no more draw parts than third grade, including fitted helmets and robes',()=>{
  const V=visuals();for(const base of H.BASE_GEAR)for(const sex of ['male','female']){
    const old=V.gear(T,H.tierKind(base.kind,3),{sex}),colors=[];
    for(const tier of [4,5]){const m=V.gear(T,H.tierKind(base.kind,tier),{sex});assert.ok(m.children.length<=old.children.length,base.kind+':'+sex+':'+tier);assert.equal(m.userData.adultDesign,true);assert.equal(m.userData.wearVariant,sex);assert.equal(m.userData.tier,tier);m.updateMatrixWorld(true);const b=new T.Box3().setFromObject(m);if(base.slot==='helmet')assert.ok(b.max.y<2.1,'no oversized crown spikes');if(base.slot==='armor')assert.ok(b.max.x<.65&&b.min.x>-.65,'no large hip/waist projections');const values=[];m.traverse(o=>{if(o.isMesh){values.push(o.material.color.getHex(),...(o.geometry.attributes.color?Array.from(o.geometry.attributes.color.array):[]));}});colors.push(JSON.stringify(values));}
    assert.notEqual(colors[0],colors[1],'purple-silver and dawn-gold grades must be visually distinct');
  }
});
test('batched equipment retains no references to disposed source geometries or materials',()=>{
  const V=visuals(),disposed=new Set(),oldGeometry=T.BufferGeometry.prototype.dispose,oldMaterial=T.Material.prototype.dispose;
  T.BufferGeometry.prototype.dispose=function(){disposed.add(this);return oldGeometry.call(this);};T.Material.prototype.dispose=function(){disposed.add(this);return oldMaterial.call(this);};
  try{for(const kind of Object.keys(H.GEAR)){const g=V.gear(T,kind);g.traverse(o=>{if(o.isMesh){assert.ok(!disposed.has(o.geometry),kind);assert.ok(!disposed.has(o.material),kind);}});}}finally{T.BufferGeometry.prototype.dispose=oldGeometry;T.Material.prototype.dispose=oldMaterial;}
  assert.ok(disposed.size>0);
});
