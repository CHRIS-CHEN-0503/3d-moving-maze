import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js');
const Core=require('../story/story-core.js'),Party=require('../story/tower-party-core.js'),Expedition=require('../story/tower-expedition-core.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
const modeSource=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
function tradeDialog(){
  const nodes=new Map(),node=id=>{
    if(!nodes.has(id))nodes.set(id,{style:{},hidden:true,innerHTML:'',focus(){},setAttribute(key,value){this[key]=value;},classList:{toggle(){}},querySelector:()=>({scrollTop:0})});
    return nodes.get(id);
  };
  const root=vm.createContext({window:{TowerCore:Core,TowerEncounters:require('../story/tower-encounters.js'),TowerResourceIcons:require('../story/tower-resource-icons.js')},
    document:{getElementById:node,activeElement:node('focus')},escapeHtml:String,performance:{now:()=>1000},localStorage:{getItem:()=>null},keys:{},joy:{},
    G:{running:true,shifting:false,satiety:100,shovels:0,kites:0,whistles:0,shovelRechargeAt:0,skillCoolUntil:0},
  });
  vm.runInContext(modeSource.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,`window.__tradeUI={dialog,trade,setup(value,shop){run=value;nearest=shop;active=true;floorStarted=true;}};`),root);
  return {api:root.window.__tradeUI,node};
}
function workshop(){
  let run=Party.enable(Core.newRun({seed:31415}),'smith').run,dialog=null,nextCell=1;
  run.coins=100;run.party.journey.scrap=30;run.party.journey.materials.ironore=5;run.equipment.weapon.durability=1;
  const world=new THREE.Group(),player=new THREE.Group(),G={px:0,pz:0,running:true,shifting:false};
  const root=vm.createContext({TowerPartyCore:Party,TowerExpedition:Expedition,TowerMaterials:require('../story/tower-materials.js'),TowerCharacters:require('../story/tower-characters.js'),document:{getElementById:()=>null}});
  vm.runInContext(source,root);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ui=root.TowerPartyRuntime.create({THREE,G,core:Core,run:()=>run,world:()=>world,player:()=>player,paused:()=>false,inDungeon:()=>false,monsters:()=>[],traders:()=>[],text:esc,
    action:(label,key,id,disabled)=>'<button data-tower="'+key+'" data-item="'+esc(id||'')+'"'+(disabled?' disabled':'')+'>'+esc(label)+'</button>',dialog:(...args)=>dialog=args,
    transact:r=>{if(!r.ok)return false;run=r.run;return true;},save:()=>true,toast(){},audio:{sfxAction(){}},clear:()=>true,dispose(){},quest(){},bind(){},swing(){},damage(){},follow:()=>false,
    cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),chooseCell:()=>({cx:nextCell,cy:0,x:nextCell++*4,z:0}),makeText:()=>new THREE.Group(),
  });
  ui.build(()=>.5,new Set());
  return {ui,get run(){return run;},get dialog(){return dialog;}};
}

test('list and single-item navigation preserve inventory, resource counts, and the selected repair target',()=>{
  const h=workshop(),before=JSON.stringify(h.run),gear=h.run.equipment.weapon;
  h.ui.handle('party-forge');assert.equal(h.dialog[5].commerce,'workshop');assert.match(h.dialog[3],/data-forge-page="list"/);
  h.ui.handle('party-forge-select',gear.id);assert.match(h.dialog[3],/data-forge-page="detail"/);
  assert.ok(h.dialog[3].includes('data-tower="party-mend-ask" data-item="'+gear.id+'"'));
  assert.ok(h.dialog[3].includes('data-tower="party-forge-list"'));
  h.ui.handle('party-forge-list');assert.match(h.dialog[3],/data-forge-page="list"/);
  h.ui.handle('party-forge-select',gear.id);assert.match(h.dialog[3],/data-forge-page="detail"/);
  assert.equal(JSON.stringify(h.run),before,'browsing and changing pages must never spend or equip');
});

test('returning to the item list cancels a pending forge; reconfirming cannot execute that abandoned request',()=>{
  const h=workshop(),id=h.run.equipment.weapon.id,key='durable|'+id,before=JSON.stringify(h.run);
  h.ui.handle('party-forge');h.ui.handle('party-forge-select',id);h.ui.handle('party-forge-ask',key);
  assert.equal(h.dialog[0],'確認鍛造');assert.equal(JSON.stringify(h.run),before);
  h.ui.handle('party-forge-list');h.ui.handle('party-forge-confirm',key);
  assert.equal(JSON.stringify(h.run),before);
  h.ui.handle('party-forge-select',id);h.ui.handle('party-forge-ask',key);h.ui.handle('party-forge-confirm',key);
  assert.equal(h.run.equipment.weapon.forge.level,1);assert.ok(h.run.coins<100);assert.ok(Core.validateSave(h.run));
  const charged=JSON.stringify(h.run);h.ui.handle('party-forge-confirm',key);assert.equal(JSON.stringify(h.run),charged,'repeated confirmation does not charge twice');
});

test('shop wallet is live header content, including zero coins, without another body row',()=>{
  const h=tradeDialog();
  h.api.dialog('行商','商品','', '<article>商品列</article>','',{commerce:'grocery',wallet:0,silent:true});
  const html=h.node('towerDialog').innerHTML,[header,content]=html.split('</header>');
  assert.match(header,/tower-titles-with-wallet/);assert.match(header,/aria-label="持有銅幣 0"/);assert.match(header,/resource-icon/);
  assert.doesNotMatch(content,/tower-trade-wallet|tower-copy/);
  h.api.dialog('背包','裝備','生命 60','物品','',{silent:true});
  assert.doesNotMatch(h.node('towerDialog').innerHTML,/tower-trade-wallet|tower-titles-with-wallet/,'other dialogs must not retain the shop wallet');
});

test('reopening an actual shop refreshes header coins and preserves every gear offer and action',()=>{
  const h=tradeDialog(),run=Core.newRun({seed:1}),offer=require('../story/tower-encounters.js').merchantOffers(run.floor,run.seed)[0];
  run.coins=999;h.api.setup(run,{id:offer.id,name:offer.name,offer});h.api.trade();
  let html=h.node('towerDialog').innerHTML;assert.match(html,/aria-label="持有銅幣 999"/);assert.doesNotMatch(html,/<p class="tower-copy">銅幣/);
  for(const entry of offer.gear){assert.ok(html.includes('data-tower="buy-gear" data-item="'+entry.kind+'"'));assert.ok(html.includes(entry.gear.name));}
  run.coins=17;h.api.trade(true);html=h.node('towerDialog').innerHTML;assert.match(html,/aria-label="持有銅幣 17"/);
  assert.equal(h.node('towerDialog')['data-commerce'],'merchant');
});
