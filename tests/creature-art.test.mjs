import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Art=require('../story/tower-creature-art.js');
function dispose(model){const resources=new Set();model.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});for(const r of resources)r.dispose();return resources;}
test('九種普通怪物保留戰鬥動畫介面，含兩個可獨立振翅節點，不覆寫樓層主',()=>{
  const browser=vm.createContext({});vm.runInContext(readFileSync(new URL('../story/tower-creature-art.js',import.meta.url),'utf8'),browser);
  assert.equal(typeof browser.TowerCreatureArt.build,'function');assert.equal(Art.kinds.length,9);assert.equal(Art.build(T,'lord_spire'),null);assert.equal(Art.build(null,'hound'),null);
  for(const kind of Art.kinds){const def={color:0x728596,name:'test'},before=structuredClone(def),model=Art.build(T,kind,def),{body,ring}=model.userData;
    assert.deepEqual(def,before);assert.equal(body.parent,model);assert.equal(body.position.y,kind==='clockmite'?.6:1);assert.equal(ring.parent,model);assert.ok(ring.isMesh&&ring.material.transparent);ring.material.opacity=.65;body.position.y+=.1;body.scale.setScalar(.91);model.updateMatrixWorld(true);
    const wings=body.children.filter(o=>o.name==='party-wing');assert.equal(wings.length,kind==='moth'?2:0);for(const [i,wing]of wings.entries()){wing.rotation.z=(i?1:-1)*.5;assert.ok(wing.children.length>0);}
    dispose(model);
  }
});
test('九種完整模型含威脅圈低於3500三角面與10次繪製，不使用燈光、外部圖或逐元件材質',()=>{
  for(const kind of Art.kinds){const model=Art.build(T,kind),materials=new Set();let triangles=0,draws=0;const normal=new T.Vector3();
    model.traverse(o=>{assert.equal(!!o.isLight,false);assert.equal(!!o.isSprite,false);if(!o.isMesh)return;draws++;materials.add(o.material);assert.equal(o.material.map,null);assert.equal(o.castShadow,false);const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;triangles+=(o.geometry.index?.count||p.count)/3;
      for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));normal.fromBufferAttribute(n,i);assert.ok(normal.length()>.98&&normal.length()<1.02,'有效的曲面法線');}
    });
    assert.ok(triangles<3500,kind+' '+triangles);assert.ok(draws<10,kind+' '+draws);assert.ok(materials.size<=3);assert.equal(triangles,model.userData.art.triangles);assert.equal(draws,model.userData.art.drawCalls);
    const box=new T.Box3().setFromObject(model);assert.ok(box.max.y<2.25,'預留 2.35 高的姓名牌');assert.ok(box.min.y>-.035,'足部不穿入地板');assert.ok(box.max.x-box.min.x<2.5,'造型不可橫跨整条走廊');dispose(model);
  }
});
test('怪物個體的幾何與材質不共用可誤釋放資源，合併後仍各自可清理',()=>{
  for(const kind of Art.kinds){const a=Art.build(T,kind),b=Art.build(T,kind),first=dispose(a),second=new Set();b.traverse(o=>{if(o.geometry)second.add(o.geometry);if(o.material)second.add(o.material);});for(const resource of first)assert.equal(second.has(resource),false);let released=0;for(const resource of second)resource.addEventListener('dispose',()=>released++);dispose(b);assert.equal(released,second.size);}
});
