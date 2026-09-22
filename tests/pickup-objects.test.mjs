import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,statSync} from 'node:fs';
const src=readFileSync(new URL('../assets/pickup-objects.js',import.meta.url),'utf8');
function setup(){
  const images=[],calls=[];
  const c=vm.createContext({window:{},Image:class{constructor(){images.push(this);}}});vm.runInContext(src,c);
  return{api:c.window.PickupObjects,images,ctx:{drawImage:(...args)=>calls.push(args)},calls};
}
test('全部可拾取道具、食物、商品均有完整物件圖且裁切在圖集內',()=>{
  const {api}=setup(),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const definitions=html.slice(html.indexOf("{id:'speed'"),html.indexOf('const G='));
  for(const [,symbol] of definitions.matchAll(/emoji:'([^']+)'/g))if(symbol!=='🛒')assert.ok(api.has(symbol),symbol); // 賣場環境標題不是拾取物。
  for(const [key,[x,y,w,h]] of Object.entries(api.frames)){
    const sheet=api.sheets[api.sheetFor[key]];
    assert.ok(x>=0&&y>=0&&w>0&&h>0);assert.ok(x+w<=sheet.width&&y+h<=sheet.height,key);
  }
  assert.ok(statSync(new URL('../assets/pickup-objects-v1.webp',import.meta.url)).size<500000);
  assert.ok(statSync(new URL('../assets/shop-household-v1.webp',import.meta.url)).size<250000);
});
test('僅載入一張圖，完成解碼通知一次並用透明物件繪圖，不畫底框或文字',()=>{
  const h=setup();let ready=0;h.api.onReady(()=>ready++);
  assert.equal(h.api.draw(h.ctx,'🍎',64,64,120),false);assert.equal(h.api.draw(h.ctx,'⛏️',64,64,120),false);
  assert.equal(h.images.length,1);h.images[0].onload();assert.equal(ready,1);
  assert.equal(h.api.draw(h.ctx,'🍎',64,64,120),true);assert.equal(h.calls.length,1);assert.equal(h.calls[0].length,9);
  assert.equal(h.api.draw(h.ctx,'☁',64,64,120),false);
});
test('下載失敗仍可使用可辨識的完整物件回退圖',()=>{
  const h=setup();h.api.draw(h.ctx,'🍎',0,0,120);h.images[0].onerror();assert.equal(h.api.draw(h.ctx,'🍎',0,0,120),false);
});
test('生活用品圖集獨立懶載入；任意完成順序均通知，不把尚未就緒的貼圖清空',()=>{
  for(const order of [[0,1],[1,0]]){
    const h=setup(),notifications=[];
    h.api.onReady(()=>notifications.push([h.api.isReady('🍎'),h.api.isReady('☂️')]));
    assert.equal(h.images.length,0);
    h.api.draw(h.ctx,'🍎',0,0,120);assert.equal(h.images.length,1);
    h.api.draw(h.ctx,'☂️',0,0,120);h.api.draw(h.ctx,'🧼',0,0,120);assert.equal(h.images.length,2);
    assert.equal(h.images[1].src,'assets/shop-household-v1.webp');
    h.images[order[0]].onload();assert.deepEqual(notifications[0],order[0]===0?[true,false]:[false,true]);
    h.images[order[1]].onload();assert.deepEqual(notifications[1],[true,true]);
    assert.equal(h.api.draw(h.ctx,'☂️',0,0,120),true);assert.equal(h.calls[0][0],h.images[1]);
  }
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/if\(PickupObjects\.isReady\(symbol\)\)\{\s*const canvas=texture.image/);
});
test('一張圖集失敗不阻斷另一張圖集；晚訂閱也收到通知且可取消',()=>{
  const h=setup();let ready=0;
  h.api.onReady(()=>ready++);
  h.api.draw(h.ctx,'🍎',0,0,120);h.images[0].onerror();
  h.api.draw(h.ctx,'🧼',0,0,120);h.images[1].onload();assert.equal(ready,1);
  assert.equal(h.api.isReady('🍎'),false);assert.equal(h.api.isReady('🧼'),true);
  let late=0;const unsubscribe=h.api.onReady(()=>late++);assert.equal(late,1);unsubscribe();
  h.images[0].onload();assert.equal(late,1);assert.equal(ready,2);
});
test('收合規則只隱藏輔助按鈕，不包含技能道具與劇情揮擊',()=>{
  const css=readFileSync(new URL('../assets/play-controls.css',import.meta.url),'utf8');
  const rule=css.match(/#gameScreen:not\(\.actions-open\)[^{]+\{visibility:hidden;pointer-events:none;\}/)[0];
  assert.ok(rule.includes('#towerBagBtn'));assert.ok(rule.includes('#towerJournalBtn'));
  assert.doesNotMatch(rule,/game-action-btn|#skillBtn|#towerAttackBtn|#captureRelay|#towerActionRail/);
});
