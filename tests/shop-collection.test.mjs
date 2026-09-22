import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),core=require('../assets/shop-collection-core.js'),rules=require('../assets/game-rules.js');
test('每輪共享五樣不同目標，可重現且新種子會換任務',()=>{
  const a=core.create(71,20),b=core.create(71,20);assert.deepEqual(a.targets,b.targets);assert.equal(new Set(a.targets).size,5);
  assert.ok(a.targets.every(i=>i>=0&&i<20));assert.notDeepEqual(a.targets,core.create(72,20).targets);
});
test('分次結帳才算完成：重複商品不灌進度，領獎僅一次且各玩家獨立',()=>{
  const m=core.create(91,20),[a,b,c,d,e]=m.targets;
  assert.equal(core.checkout(m,'a',[a,a,b,c]),0);assert.equal(core.progress(m,'a').paid.length,3);
  assert.equal(core.checkout(m,'a',[d]),0);assert.equal(core.checkout(m,'a',[e]),300);
  assert.equal(core.checkout(m,'a',m.targets),0);assert.equal(core.checkout(m,'b',m.targets),300);
  assert.equal(core.progress(core.create(91,20),'a').paid.length,0);
});
test('空結帳、非任務商品與關閉蒐集不能領獎；搶購專用設定會同步',()=>{
  const m=core.create(91,20);assert.equal(core.checkout(m,'a',[]),0);
  assert.equal(core.checkout(m,'a',[...Array(20).keys()].filter(i=>!m.targets.includes(i))),0);
  assert.equal(core.progress(m,'a').paid.length,0);assert.equal(core.checkout(core.create(91,20,false),'a',[0,1,2,3,4]),0);
  assert.equal(rules.normalize({}).shopCollect,1);assert.equal(rules.normalize({shopCollect:0}).shopCollect,0);
  assert.ok(rules.visible('shop').includes('shopCollect'));assert.ok(!rules.visible('classic').includes('shopCollect'));
});
test('任務進度只記錄結帳清單，結算封包與名次包含獎勵，保留目標補貨槽',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),room=readFileSync(new URL('../assets/room-lifecycle.js',import.meta.url),'utf8');
  const checkout=html.slice(html.indexOf("case 'codone':"),html.indexOf("case 'restock':"));
  assert.ok(checkout.indexOf('ShopCollection?.checkout')<checkout.indexOf('MP.cartList[m.f]=[]'));
  assert.match(html,/goodForSlot\(slot,randomGood\)/);assert.match(html,/goodForSlot\(i,randomGood\)/);
  assert.match(room,/shopBonus:MP.shopBonus/);assert.match(html,/\(MP.shopBonus\?\.\[id\]\|\|0\)/);
  assert.match(html,/while\(!isShop\(\)&&G.items.length/);assert.match(html,/if\(isShop\(\)\)window.ShopChaos\?\.rebuild\(\)/);
});
test('手機任務以窄條顯示，完成後自動收成單行，商品名稱保留按鈕朗讀',()=>{
  const css=readFileSync(new URL('../assets/play-controls.css',import.meta.url),'utf8'),ui=readFileSync(new URL('../assets/shop-collection.js',import.meta.url),'utf8');
  assert.match(css,/#shopMission \{[^}]*width:220px/);assert.match(css,/#shopMission\.complete #shopMissionItems \{display:none;/);
  assert.match(ui,/classList.toggle\('complete',p.awarded\)/);assert.match(ui,/btn.onclick=\(\)=>showToast\(GOODS\[gi\].name/);
});
