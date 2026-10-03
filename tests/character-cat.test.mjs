import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const cd={id:'cat',name:'喵喵',type:'cat',skin:0xffa040,hair:0xef6c00,shirt:0xffb74d,pants:0xef6c00,job:'尋路貓',pathOnShift:6,gender:'f'};
function figure(){const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F});e.window=e;const start=html.indexOf('function buildCharacter(cd)'),end=html.indexOf('\n}',start)+2;vm.runInContext(html.slice(start,end),e);return e.buildCharacter({...cd});}
function resources(m){const geometries=new Set(),materials=new Set();m.traverse(p=>{if(p.geometry&&!p.isSprite)geometries.add(p.geometry);if(p.material)materials.add(p.material);});return {geometries,materials};}
function release(m){const r=resources(m);for(const g of r.geometries)g.dispose();for(const mat of r.materials)mat.dispose();}
test('classic cat has a connected feline head, soft muzzle, cupped ears, triangular nose and six whiskers',()=>{
 const m=figure(),names=[];let triangles=0,meshes=0;m.traverse(p=>{names.push(p.name);assert.equal(!!p.isLight,false);assert.equal(p.material?.map||null,null);if(p.isMesh){meshes++;triangles+=(p.geometry.index?.count??p.geometry.attributes.position.count)/3;}if(p.geometry)for(const a of Object.values(p.geometry.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));});
 assert.equal(m.userData.headMesh.geometry.userData.catSculpt,true);assert.equal(m.userData.face.cat,true);assert.equal(names.filter(n=>n==='cat-continuous-ear').length,2);assert.equal(names.filter(n=>n==='cat-cupped-inner-ear').length,2);assert.equal(names.filter(n=>n==='cat-whisker').length,6);assert.ok(names.includes('cat-connected-muzzle')&&names.includes('cat-rounded-nose')&&names.includes('cat-tail'));assert.ok(!m.userData.head.children.some(p=>p.geometry?.type==='ConeGeometry'));assert.ok(meshes<85&&triangles<9000,JSON.stringify({meshes,triangles}));m.updateMatrixWorld(true);const b=new T.Box3().setFromObject(m);assert.ok(b.max.y<2.25&&b.min.y>-.05);release(m);
});
test('cat eyes have green irises, vertical pupils and a feline smile while all original expressions remain animated',()=>{
 const m=figure(),f=m.userData.face,shapes=new Set();for(const eye of f.eyes)assert.equal(eye.material.color.getHex(),0x78a64a);for(const pupil of f.pupils)assert.ok(pupil.scale.y>pupil.scale.x*2);assert.equal(f.mouth.name,'cat-smile');assert.equal(f.teeth.material.color.getHex(),0xffedc6);assert.notEqual(f.teeth.material,f.whites[0].material);assert.ok(f.lips.every(p=>!p.visible));
 let time=1;for(const mood of F.moods){F.update(m,time,mood);time+=.31;shapes.add(JSON.stringify([f.eyes[0].scale.y,f.brows[0].rotation.z,f.mouth.scale.toArray(),f.teeth.visible]));assert.ok(f.cheeks.every(p=>!p.visible));}assert.ok(shapes.size>=7);assert.equal(F.react(m,'alert',.5),true);F.update(m,time);assert.equal(f.mood,'alert');release(m);
});
test('cat animation and refinement reuse geometry/materials and preserve ordinary character identity data',()=>{
 const m=figure(),before=resources(m),face=m.userData.face,at=m.position.toArray(),heading=m.rotation.y;for(let i=0;i<300;i++)F.update(m,i/60,F.moods[i%F.moods.length]);for(const time of [NaN,Infinity,-Infinity])F.update(m,time,'hurt');assert.equal(F.refineCat(T,m,cd),true);assert.deepEqual(resources(m),before);assert.equal(m.userData.face,face);assert.deepEqual(m.position.toArray(),at);assert.equal(m.rotation.y,heading);assert.equal(cd.id,'cat');assert.equal(cd.pathOnShift,6);assert.equal(cd.gender,'f');release(m);
});
test('cat models own and release their own resources exactly once without invalidating another cat',()=>{
 const a=figure(),b=figure(),ra=resources(a),rb=resources(b),counts=new Map();for(const r of [...ra.geometries,...ra.materials]){assert.ok(!rb.geometries.has(r)&&!rb.materials.has(r));counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}release(a);assert.ok([...counts.values()].every(v=>v===1));F.update(b,.6,'happy');assert.equal(b.userData.face.mood,'happy');release(b);
});
