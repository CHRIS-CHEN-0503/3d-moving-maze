import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/maze-materials.js',import.meta.url),'utf8');
function harness(){
  const images=[],canvases=[];
  const context=vm.createContext({window:{},Math:Object.assign(Object.create(Math),{random(){throw new Error('材質不應消耗遊戲亂數');}}),Image:class{constructor(){images.push(this);this.naturalWidth=1254;}},scene:{traverse(visitor){for(const canvas of canvases)visitor({material:{map:canvas.clone,emissiveMap:canvas.emissive}});}}});
  vm.runInContext(source,context);
  function canvas(){
    const operations=[],ctx={};for(const method of ['save','restore','setTransform','drawImage','beginPath','moveTo','lineTo','stroke','bezierCurveTo','quadraticCurveTo','ellipse','fill','fillRect'])ctx[method]=(...args)=>operations.push([method,...args]);
    const result={width:256,height:256,operations,getContext:()=>ctx,clone:{isTexture:true},emissive:{isTexture:true}};result.clone.image=result;result.emissive.image=result;canvases.push(result);return result;
  }
  return {images,canvas,enhance:context.window.MazeMaterials.enhance};
}
test('原創表面收邊覆用既有貼圖並同步共用地板來源，無額外下載或尺寸變動',()=>{
  const h=harness(),textures=[];
  for(const kind of ['brick','tile','hedge','rock','wood','grass','lavacrack','ice','books']){
    const a=h.canvas(),texture={};h.enhance(a,texture,kind);textures.push({a,texture,kind});
  }
  assert.equal(h.images.length,1);h.images[0].onload();
  for(const {a,texture,kind}of textures){assert.equal(a.width,256);assert.equal(a.height,256);assert.equal(texture.needsUpdate,true);assert.equal(a.clone.needsUpdate,true);assert.equal(a.emissive.needsUpdate,true);assert.equal(a.operations.filter(o=>o[0]==='drawImage').length,1);assert.ok(a.operations.some(o=>o[0]==='stroke'||o[0]==='fill'),kind+' material finishing');
    const b=h.canvas();h.enhance(b,{},kind);assert.deepEqual(b.operations,a.operations,kind+' repeatable finishing');}
  assert.equal(h.images.length,1);
});
test('圖集失敗仍將表面細節加在原程序材質，不重試下載且不改快取共享來源',()=>{
  const h=harness(),a=h.canvas(),texture={};h.enhance(a,texture,'brick');h.images[0].onerror();
  assert.equal(a.operations.some(o=>o[0]==='drawImage'),false);assert.ok(a.operations.length>90);assert.equal(texture.needsUpdate,true);
  const b=h.canvas();h.enhance(b,{},'brick');assert.deepEqual(a.operations,b.operations);assert.equal(h.images.length,1);
  const unknown=h.canvas();h.enhance(unknown,{},'unknown');assert.equal(unknown.operations.length,0);
});
