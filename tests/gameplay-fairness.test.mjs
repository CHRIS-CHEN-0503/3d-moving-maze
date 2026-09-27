import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),Rules=require('../assets/gameplay-rules.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const wall={minX:-.18,maxX:.18,minZ:-2,maxZ:2};
test('直線碰撞檢查擋實牆、不擋平行走廊，沒有有效位置即拒絕',()=>{
  const a={x:-.8,z:0},b={x:.8,z:0};
  assert.equal(Rules.clear(a,b,[wall]),false);assert.equal(Rules.clear(b,a,[wall]),false);
  assert.equal(Rules.clear({...a,z:3},{...b,z:3},[wall]),true);assert.equal(Rules.clear(a,{x:-.8,z:3},[wall]),true);
  assert.equal(Rules.clear(a,b,[]),true);assert.equal(Rules.clear(null,b,[wall]),false);
  assert.equal(Rules.contact(a,{x:Infinity,z:0},[],3),false);assert.equal(Rules.contact(a,b,[],1),false);
});
function runtime(){
  const packets=[],c=vm.createContext({GameplayRules:Rules,performance:{now:()=>10000},
    MP:{on:true,started:true,ended:false,id:'a',mode:'treasure',treasure:{holder:'b'},players:{b:{mesh:{position:{x:.8,z:0}},lastSeen:10000}},roster:[{id:'a'},{id:'b'}],cartList:{b:[1]}},
    G:{px:-.8,pz:0,frozen:false,atkCoolUntil:0,stunnedUntil:0,wallBoxes:[wall]},SHOP_ROB_RANGE:2.4,MP_ROUND_EVENTS:new Set(),
    skillsAllowed:()=>true,swingWeapon(){},showToast(){},mpSend:m=>packets.push(m),isShop:()=>c.MP.mode==='shop',isCheckingOut:()=>false,
    botPosOf:id=>id==='a'?{x:c.G.px,z:c.G.pz}:{x:.8,z:0}});
  c.window=c;vm.runInContext(block('function doAttack(', '/* 技能鍵')+block('function robTarget(', 'function updateRobBtn(')+block('function botTryRob(', '/* 🛒 補貨')+block('function mpHandle(', 'function mpAfterStart('),c);
  return{c,packets};
}
test('實際真人揮擊與搶奪選人不能穿牆；拆牆後恢復作用',()=>{
  const {c,packets}=runtime();c.doAttack();assert.equal(packets.length,0);
  c.G.wallBoxes=[];c.G.atkCoolUntil=0;c.doAttack();assert.equal(packets[0].t,'hit');assert.equal(packets[0].to,'b');
  c.MP.mode='shop';c.G.wallBoxes=[wall];assert.equal(c.robTarget(),null);c.G.wallBoxes=[];assert.equal(c.robTarget(),'b');
});
test('電腦搶奪及接收命中／搶奪封包也拒絕隔牆，不只修正按鈕',()=>{
  const {c,packets}=runtime();const b={id:'a',x:-.8,z:0};c.botTryRob(b,10000);assert.equal(packets.length,0);
  for(const type of ['hit','rob','tag']){c.MP.mode=type==='rob'?'shop':type==='tag'?'tag':'treasure';c.MP.taggedId='a';assert.doesNotThrow(()=>c.mpHandle({t:type,f:'a',to:'b',idx:0,gi:1}));}
  assert.equal(c.MP.treasure.holder,'b');assert.equal(c.MP.cartList.b.length,1);assert.equal(c.MP.taggedId,'a');
  c.G.wallBoxes=[];c.botTryRob(b,10000);assert.equal(packets[0].t,'rob');
});
test('未結帳折算只影響車上價值，已結帳與任務獎勵不縮水',()=>{
  const c=vm.createContext({MP:{banked:{a:100},carts:{a:51},shopBonus:{a:300}},matchRules:()=>({unpaidRate:50})});
  vm.runInContext(html.match(/function shopTotal\([^\n]+/)[0],c);assert.equal(c.shopTotal('a'),425);
  c.matchRules=()=>({unpaidRate:100});assert.equal(c.shopTotal('a'),451);
});
test('原創材質圖集小於 500 KB、懶載入一次、下載失敗保留程序材質',()=>{
  const src=readFileSync(new URL('../assets/maze-materials.js',import.meta.url),'utf8'),images=[],calls=[];
  const c=vm.createContext({Image:class{constructor(){images.push(this);this.naturalWidth=1254;}},window:{}});vm.runInContext(src,c);
  const make=()=>({width:128,height:128,getContext:()=>({drawImage:(...a)=>calls.push(a)})}),a=make(),b=make(),t={};
  assert.equal(images.length,0);c.window.MazeMaterials.enhance(a,t,'brick');c.window.MazeMaterials.enhance(b,{},'tile');assert.equal(images.length,1);
  images[0].onload();assert.equal(a.width,128,'已配置的 GPU 貼圖尺寸不可在載入後改變');assert.equal(calls.length,2);assert.equal(t.needsUpdate,true);assert.equal(t.anisotropy,2);
  assert.match(block('function makeTex(', 'const spriteCache='),/cv\.width=cv\.height=256/);
  assert.ok(statSync(new URL('../assets/maze-materials-v1.webp',import.meta.url)).size<500000);
  const failImages=[],fail=vm.createContext({Image:class{constructor(){failImages.push(this);}},window:{}});vm.runInContext(src,fail);const original=make();fail.window.MazeMaterials.enhance(original,{},'rock');failImages[0].onerror();assert.equal(original.width,128);
  for(let i=0;i<20;i++)fail.window.MazeMaterials.enhance(make(),{},'rock');assert.equal(failImages.length,1,'失敗後不反覆下載或保留新場景貼圖');
});
