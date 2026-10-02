import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js'),M=require('../story/tower-materials.js'),Icons=require('../story/tower-resource-icons.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
function harness(){
  const run=P.enable(C.newRun({seed:91}),'mage').run,context={TowerPartyCore:P,TowerExpedition:X,TowerMaterials:M,TowerResourceIcons:Icons};
  vm.runInNewContext(source,context);let dialog;
  const ui=context.TowerPartyRuntime.create({THREE:T,run:()=>run,text:String,action:(label,key)=>'<button data-tower="'+key+'">'+label+'</button>',dialog:(...args)=>dialog=args,inDungeon:()=>false,traders:()=>[],monsters:()=>[],G:{px:0,pz:0},world:()=>new T.Group()});
  return {run,ui,art:context.TowerPartyRuntime,get dialog(){return dialog;}};
}
test('all regional foods, meals and forge materials have distinct complete shared vector icons',()=>{
  const {art}=harness();
  for(const [keys,draw]of [[Object.keys(M.INGREDIENTS),art.foodArt],[Object.keys(P.RECIPES),art.dishArt],[Object.keys(M.MATERIALS),Icons.svg]]){
    const output=keys.map(draw);assert.equal(new Set(output).size,keys.length);
    for(const svg of output){assert.match(svg,/^<svg /);assert.match(svg,/<path|<ellipse|<circle/);assert.doesNotMatch(svg,/undefined|NaN|<script|<image|(?:href|src)=/);}
  }
});
test('all new pickups have bounded native three-dimensional geometry without lights or image downloads',()=>{
  const {ui}=harness();
  for(const [keys,build]of [[Object.keys(M.INGREDIENTS),ui.ingredientModel],[Object.keys(M.MATERIALS),ui.materialModel]])for(const key of keys){
    const model=build(key);let meshes=0,triangles=0;
    model.traverse(o=>{assert.ok(!o.isLight,key);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null,key);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),key);}});
    assert.ok(meshes>0&&meshes<=9,key+' meshes '+meshes);assert.ok(triangles<1800,key+' triangles '+triangles);
  }
});
test('expanded kitchen inventory includes only held stock, remains collapsed and cost shortages are explicit',()=>{
  const h=harness();h.run.party.ingredients.cloudcap=2;h.ui.panel('cook',true);
  const body=h.dialog[3],stocks=body.slice(0,body.indexOf('</details>'));
  assert.match(stocks,/<details class="party-stock-panel">/);assert.doesNotMatch(stocks,/<details[^>]*open/);
  assert.ok(stocks.includes('雲絨菇'));assert.ok(!stocks.includes('星髓凝露'));
  assert.match(body,/party-cost missing/);assert.match(body,/缺 /);assert.ok(body.includes('查看庫存'));
  assert.equal(h.dialog[5].silent,true);assert.equal(h.dialog[5].summary,'旅人廚房。選擇烹飪，或享用料理。');
});
