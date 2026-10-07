import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {grocerySeed} from './grocery-fixtures.mjs';

const require=createRequire(import.meta.url),C=require('../story/story-core.js'),E=require('../story/tower-encounters.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const partyRun=(coins=40)=>{const run=P.enable(C.newRun({seed:grocerySeed(99)}),'swordsman').run;run.coins=coins;return run;};

test('the grocer sells a few metal parts per floor: price, stock, bag cap, coins and saves are enforced',()=>{
  const offer=X.scrapOffer(partyRun());assert.deepEqual({...offer},{merchantId:'suHe',price:X.SCRAP_SHOP.price,stock:X.SCRAP_SHOP.stock,bought:0,remaining:X.SCRAP_SHOP.stock,owned:0,room:99});
  let r=X.buyScrap(partyRun(),'suHe',2);assert.equal(r.ok,true);assert.equal(r.run.party.journey.scrap,2);assert.equal(r.run.coins,40-2*X.SCRAP_SHOP.price);assert.equal(r.run.party.journey.scrapBought,2);
  const saved=C.validateSave(JSON.stringify(r.run));assert.ok(saved);assert.equal(saved.party.journey.scrapBought,2);assert.equal(X.scrapOffer(saved).remaining,X.SCRAP_SHOP.stock-2);
  assert.equal(X.buyScrap(r.run,'suHe',X.SCRAP_SHOP.stock).ok,false,'cannot exceed this floor’s stock');
  r=X.buyScrap(r.run,'suHe',X.SCRAP_SHOP.stock-2);assert.equal(r.ok,true);assert.equal(X.scrapOffer(r.run).remaining,0);assert.match(X.buyScrap(r.run,'suHe',1).message,/賣完/);
  const full=partyRun();full.party.journey.scrap=98;assert.match(X.buyScrap(full,'suHe',2).message,/最多 99/);assert.equal(X.buyScrap(full,'suHe',1).ok,true);
  assert.match(X.buyScrap(partyRun(4),'suHe',1).message,/銅幣不足/);
  for(const bad of [0,-1,1.5,X.SCRAP_SHOP.stock+1,'2'])assert.equal(X.buyScrap(partyRun(),'suHe',bad).ok,false,String(bad));
  assert.equal(X.buyScrap(partyRun(),'tieLing',1).ok,false,'only the grocer sells parts');
  assert.equal(X.scrapOffer(C.newRun({seed:grocerySeed(99)})),null,'legacy journeys without a party have no parts stall');
  let absent=1;while(E.merchantOffers(99,absent).some(m=>m.id==='suHe'))absent++;const away=P.enable(C.newRun({seed:absent}),'swordsman').run;away.coins=99;assert.equal(X.scrapOffer(away),null);assert.equal(X.buyScrap(away,'suHe',1).ok,false);
  const rift=partyRun();rift.expedition={...rift.expedition,active:true};assert.equal(X.scrapOffer(rift),null,'no trading inside a rift');
});

test('the per-floor parts counter is optional, validated and reset on descent without touching old saves',()=>{
  const run=partyRun();assert.equal('scrapBought' in run.party.journey,false);assert.equal('scrapBought' in C.validateSave(JSON.stringify(run)).party.journey,false,'old saves keep their exact shape');
  for(const bad of [-1,1.5,X.SCRAP_SHOP.stock+1,'2',null]){const copy=JSON.parse(JSON.stringify(run));copy.party.journey.scrapBought=bad;assert.equal(C.validateSave(JSON.stringify(copy)),null,String(bad));}
  const bought=X.buyScrap(run,'suHe',3).run;P.advance(bought);assert.equal(bought.party.journey.scrap,3,'parts are kept');assert.equal(bought.party.journey.scrapBought,undefined,'the stall restocks on the next floor');
});

function harness(run){
  const nodes=new Map(),storage=new Map(),messages=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:true,textContent:'',innerHTML:'',dataset:{},isConnected:true,focus(){},querySelector(selector){return selector==='.tower-dialog-content'?(this.content||={scrollTop:0}):null;},classList:{add(){},remove(){},toggle(){},contains:()=>false}});return nodes.get(id);};
  class Vector{constructor(){this.set(0,0,0);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){return this.set(v.x,v.y,v.z);}}
  class Group{constructor(){this.position=new Vector();this.rotation=new Vector();this.scale=new Vector().set(1,1,1);this.userData={};this.children=[];this.visible=true;}add(item){this.children.push(item);}remove(item){this.children=this.children.filter(c=>c!==item);}}
  const G={running:true,frozen:false,shifting:false,satiety:run.hunger,px:0,pz:0,startTime:100,shovels:1,kites:0,whistles:0,shovelRechargeAt:0,skillCoolUntil:0,effects:{},invisUntil:0,mazeW:7,mazeH:7,cell:4,exitCell:{x:6,y:6}};
  const context=vm.createContext({window:{TowerCore:C,TowerEncounters:E,TowerPartyCore:P,TowerExpedition:X},THREE:{Group,Sprite:Group,SpriteMaterial:class{},CanvasTexture:class{}},G,
    document:{getElementById:node,activeElement:node('focus'),body:{classList:{add(){},remove(){},toggle(){}}},createElement:()=>({getContext:()=>({strokeText(){},fillText(){}})})},
    keys:{},joy:{active:false,dx:0,dy:0},performance:{now:()=>1000},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    escapeHtml:value=>String(value),showToast:value=>messages.push(value),AudioEng:{sfxPickup(){},sfxTick(){},stopMusic(){},stopItemLoop(){}},
    playerInWall:()=>false,worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),cellToWorld:(x,y)=>({x:x*4,z:y*4}),solveMaze:(x,y,ex=x,ey=y)=>[[x,y],[ex,ey]],swingWeapon(){},disposeSceneObject(){},cancelSceneTransition(){},switchScreen(){}});
  const bridge='window.__shop={setup(value){run=value;active=true;paused=false;floorStarted=true;floorConfig=C.floorConfig(run.floor);world=new THREE.Group();},near(value){nearest=value;},state(){return run;},handleAction,trade,closeDialog};';
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,bridge),context,{filename:'tower-mode.js'});
  const api=context.window.__shop;api.setup(run);const offer=E.merchantOffers(run.floor,run.seed,false).find(m=>m.id==='suHe');
  api.near({x:1,z:0,cx:0,cy:0,model:new Group(),id:offer.id,name:offer.name,offer});
  return {api,G,html:()=>node('towerDialog').innerHTML,messages};
}

test('the grocer stall shows a parts card with honest buttons and buys through the real dialog only when close',()=>{
  const h=harness(partyRun(40));h.api.trade();let html=h.html();
  assert.match(html,/<h3>金屬零件<\/h3>/);assert.match(html,/data-tower="buy-scrap" data-item="1"[^>]*>買 1 份 · 5 幣/);assert.match(html,new RegExp('data-tower="buy-scrap" data-item="'+X.SCRAP_SHOP.stock+'"'));
  assert.equal((html.match(/data-tower="buy-scrap" data-item="1"/g)||[]).length,1,'no duplicate action targets');
  h.api.handleAction('buy-scrap','1');assert.equal(h.api.state().party.journey.scrap,1);assert.equal(h.api.state().coins,35);
  h.G.px=30;h.api.handleAction('buy-scrap','1');assert.equal(h.api.state().party.journey.scrap,1,'walking away cancels the purchase');h.G.px=0;
  h.api.trade(true);html=h.html();assert.match(html,/本層剩 4\/5/);h.api.handleAction('buy-scrap','4');assert.equal(h.api.state().party.journey.scrap,5);
  html=h.html();assert.match(html,/data-tower="buy-scrap" data-item="1"[^>]*disabled>本層已售完/);assert.ok(C.validateSave(JSON.stringify(h.api.state())));
  const poor=harness(partyRun(3));poor.api.trade();assert.match(poor.html(),/data-tower="buy-scrap" data-item="1"[^>]*disabled>銅幣不足 · 5 幣/);
  const legacy=harness(C.newRun({seed:grocerySeed(99)}));legacy.api.trade();assert.doesNotMatch(legacy.html(),/buy-scrap/);
});

test('parts refusals say exactly why: invalid amount, partial stock or sold out',()=>{
  assert.match(X.buyScrap(partyRun(),'suHe',1.5).message,/數量無效/);
  const some=X.buyScrap(partyRun(),'suHe',3).run;assert.match(X.buyScrap(some,'suHe',3).message,/只剩 2 份/);
  const none=X.buyScrap(partyRun(),'suHe',X.SCRAP_SHOP.stock).run;assert.match(X.buyScrap(none,'suHe',1).message,/賣完/);
});
