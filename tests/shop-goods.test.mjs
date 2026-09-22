import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function functionSource(name){
  const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);
  let depth=0;for(let i=html.indexOf('{',start);i<html.length;i++){
    if(html[i]==='{')depth++;if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error('Unclosed function: '+name);
}
function setup(){
  const context=vm.createContext({MP:{carts:{},cartList:{},banked:{}},Math});
  const defs=html.slice(html.indexOf('const GOODS=['),html.indexOf('const CHECKOUT_MS='));
  vm.runInContext(defs+';this.goods=GOODS;'+['pickGood','cartAdd','shopTotal'].map(functionSource).join('\n'),context);
  return context;
}
test('20 種商品且原本八種編號不變，12 種生活用品皆有獨立圖與有效價格',()=>{
  const {goods}=setup();assert.equal(goods.length,20);
  assert.equal(goods.slice(0,8).map(g=>g.name).join(','),'糖果,麵包,牛奶,果汁,巧克力,起司,大肉排,龍蝦');
  assert.equal(new Set(goods.map(g=>g.emoji)).size,20);assert.equal(new Set(goods.map(g=>g.name)).size,20);
  for(const g of goods){assert.ok(g.price>=10&&g.price<=120);assert.ok(g.weight>0);assert.ok(Number.isInteger(g.color));}
  const avg=list=>list.reduce((s,g)=>s+g.price*g.weight,0)/list.reduce((s,g)=>s+g.weight,0);
  assert.ok(Math.abs(avg(goods)/avg(goods.slice(0,8))-1)<.1,'新增商品的平均價值偏移低於 10%');
});
test('加權抽樣與補貨可選到每一種新商品，所有商品均可入車並正確計分',()=>{
  const c=setup(),total=c.goods.reduce((s,g)=>s+g.weight,0);let cursor=0,expected=0;
  c.goods.forEach((g,i)=>{
    assert.equal(c.pickGood(()=>(cursor+g.weight/2)/total),g);
    cursor+=g.weight;c.cartAdd('player',i);expected+=g.price;
    assert.equal(c.MP.cartList.player.at(-1),i);assert.equal(c.MP.carts.player,expected);
  });
  c.MP.banked.player=175;assert.equal(c.shopTotal('player'),expected+175);
  assert.match(html,/gi:GOODS\.indexOf\(pickGood\(Math.random\)\)/);
  assert.match(html,/const SHOP_RESTOCK_MS=6000/);
});
