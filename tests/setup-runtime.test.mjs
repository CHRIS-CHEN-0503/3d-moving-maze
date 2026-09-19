import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Face=require('../assets/character-face.js');
test('靜態元素識別碼唯一，事件處理器的固定查詢都有對應元素',()=>{
  const markup=html.replace(/<script\b[\s\S]*?<\/script>/g,'');
  const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const missing=[...html.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]).filter(id=>!ids.includes(id));assert.deepEqual([...new Set(missing)],[]);
});
test('一般公開設定不再包含連線網址輸入，角色表情重用幾何且動畫數值有效',()=>{
  assert.doesNotMatch(html, /id="cfg(?:Broker|Api)"/);
  const model=new T.Group(),head=new T.Group(),eyes=[new T.Mesh(),new T.Mesh()];model.add(head);Face.attach(T,model,head,eyes);
  const count=head.children.length;
  for(const mood of ['calm','happy','focus','hurt'])for(let i=0;i<100;i++){Face.update(model,i/30,mood);assert.ok(eyes.every(e=>Number.isFinite(e.scale.y)));}
  assert.equal(head.children.length,count);assert.equal(model.userData.face.mood,'hurt');assert.equal(model.userData.face.corners[0].visible,false);
});
