import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {grocerySeed,groceryShop} from './grocery-fixtures.mjs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),N=require('../story/tower-narrative.js'),E=require('../story/tower-encounters.js'),D=require('../story/tower-dungeons.js'),S=require('../story/tower-side-stories.js'),L=require('../story/tower-lighting-core.js'),Hazards=require('../story/tower-hazards.js'),F=require('../story/tower-field-guide.js');
const clone=v=>structuredClone(v);
function underground(floor=-1,seed=43,job='mage'){
  let r=H.enable(P.enable(C.newRun({seed,name:'地下支援測試'}),job).run).run;
  r.floor=1;r.floorsCleared=99;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.clues=N.CHAPTERS.filter(c=>c.low>0).map(c=>c.clueId);r.chronicle.ending='release';P.advance(r);
  const entered=C.startUnderworld(r,r.revision);assert.ok(entered.ok,entered.message);r=entered.run;
  if(floor!==-1){r.floor=floor;r.floorsCleared=99+(-floor-1);r.adventure=E.newAdventure();r.expedition.discovered=false;P.advance(r);}
  assert.ok(C.validateSave(r),'valid fixture '+floor);return r;
}
test('support validators accept exactly the 50 basement floors, never zero or an arbitrary negative floor',()=>{
  for(let floor=-1;floor>=-50;floor--){
    assert.deepEqual(E.validateAdventure(undefined,floor),E.newAdventure());
    assert.deepEqual(D.validateExpedition(D.newExpedition(),floor,1),D.newExpedition());
    assert.deepEqual(L.validate(L.newState(),floor),L.newState());
    assert.equal(C.floorConfig(floor).size,floor>=-40?19:21);
  }
  for(const floor of [0,-51,-100,100,-1.5,NaN,Infinity,'-1']){
    assert.equal(E.validateAdventure(undefined,floor),null);assert.equal(D.validateExpedition(undefined,floor,1),null);assert.equal(L.validate(undefined,floor),null);
    assert.throws(()=>E.merchantOffers(floor,43),RangeError);assert.deepEqual(Hazards.layout({floor,seed:43,size:19}),[]);
  }
});
test('underground disables all old rifts while preserving authentic completed tower recollections',()=>{
  let offer,seed;for(seed=1;seed<=1000;seed++){offer=D.offer({floor:95,seed,expedition:D.newExpedition()});if(offer&&S.get(offer.kind))break;}
  assert.ok(offer);const history={id:offer.id,kind:offer.kind,floor:95,outcome:'completed',catalogVersion:3};
  for(let floor=-1;floor>=-50;floor--){
    const expedition={...D.newExpedition(),history:[history]};const before=clone(expedition);
    assert.equal(D.offer({floor,seed,expedition,party:{loadouts:{}}}),null);assert.deepEqual(D.validateExpedition(expedition,floor,seed),expedition);assert.deepEqual(expedition,before);
    assert.deepEqual(S.eligible(floor),[]);assert.deepEqual(S.collectedStories({floor,expedition}).map(s=>s.kind),[offer.kind]);
    assert.equal(D.validateExpedition({...expedition,discovered:true},floor,seed),null);
    assert.equal(D.validateExpedition({...expedition,active:{}},floor,seed),null);
    assert.equal(D.validateExpedition({...expedition,history:[{...history,floor,id:'rift:'+floor+':'+seed}]},floor,seed),null);
  }
});
test('underground merchants, chests and rewards are deterministic, valid and do not reduce the three-tier catalogue',()=>{
  let chestCount=0,gearCount=0;const merchants=new Set();
  for(let floor=-1;floor>=-50;floor--)for(let seed=1;seed<=16;seed++){
    const shops=E.merchantOffers(floor,seed,true),professionals=shops.filter(m=>m.id!=='suHe');assert.deepEqual(E.merchantOffers(floor,seed,true),shops);assert.ok(professionals.length>=1&&professionals.length<=2);
    for(const shop of professionals){merchants.add(shop.id);assert.ok(shop.gear.some(g=>H.GEAR[g.kind].tier===3));assert.deepEqual(shop.supplies,[]);for(const entry of shop.gear){assert.ok(C.validateGear(entry.gear));assert.ok(entry.price>0&&Number.isFinite(entry.price));}}
    for(const shop of shops.filter(m=>m.id==='suHe')){assert.deepEqual(shop.gear,[]);assert.ok(shop.supplies.includes('arrow'));assert.equal(shop.ingredientOffers.length,5);}
    const chest=E.chestOffer(floor,seed,true);assert.deepEqual(E.chestOffer(floor,seed,true),chest);if(chest){chestCount++;if(chest.gear){gearCount++;assert.ok(C.validateGear(chest.gear));}else assert.ok(chest.damage>0&&Number.isFinite(chest.damage));}
    const reward=E.questReward(floor,seed,true);assert.deepEqual(E.questReward(floor,seed,true),reward);assert.ok(reward.coins>0&&Number.isFinite(reward.coins));if(reward.gear)assert.ok(C.validateGear(reward.gear));
  }
  assert.equal(merchants.size,3);assert.ok(chestCount>100&&chestCount<220);assert.ok(gearCount>60);
  assert.deepEqual(E.floorLootCounts(21),{itemCount:4,foodCount:5,storyCount:9,total:18});
});
test('basement torch stock, gathering and fuel survive reload and cannot be claimed twice',()=>{
  for(const floor of [-1,-10,-40,-41,-50]){
    let r=underground(floor,grocerySeed(floor));r.coins=100;const merchant=groceryShop(r).id;
    for(let i=0;i<3;i++){const bought=L.buy(r,merchant,r.revision);assert.ok(bought.ok,bought.message);r=C.validateSave(JSON.stringify(bought.run));assert.ok(r);}
    assert.equal(r.coins,88);assert.equal(L.buy(r,merchant).ok,false);
    const picked=L.gather(r,'light-supply-2');assert.ok(picked.ok,picked.message);r=picked.run;assert.equal(L.gather(r,'light-supply-2').ok,false);
    r=L.torch(r).run;assert.equal(r.party.light.fuel,300);r=L.daylight(r).run;L.tick(r,600);assert.equal(r.party.light.fuel,300);L.tick(r,30);assert.equal(r.party.light.fuel,270);assert.ok(C.validateSave(r));
    const before=clone(r.party.light);L.advance(r);assert.equal(r.party.light.fuel,before.fuel);assert.equal(r.party.light.torches,before.torches);assert.deepEqual(r.party.light.gathered,[]);assert.ok(Object.values(r.party.light.bought).every(n=>n===0));
  }
});
test('basement merchant purchases and chest settlement charge once and retain validated save data',()=>{
  for(const floor of [-1,-40,-41,-50]){
    let r=underground(floor,grocerySeed(floor));r.coins=5000;const shop=groceryShop(r),item=shop.supplies.find(id=>r.bag[id]<90),cost=C.ITEMS[item].buyPrice;
    const bought=E.buySupply(r,shop.id,item,1,r.revision);assert.ok(bought.ok,bought.message);assert.equal(bought.run.coins,r.coins-cost);assert.equal(bought.run.bag[item],r.bag[item]+1);assert.equal(E.buySupply(bought.run,shop.id,item,1,r.revision).ok,false);r=bought.run;
    const gearShop=E.merchantOffers(floor,r.seed,true)[0],gear=gearShop.gear[0],purchased=E.buyMerchantGear(r,gearShop.id,gear.kind,r.revision);assert.ok(purchased.ok,purchased.message);assert.ok(C.validateSave(purchased.run));assert.equal(E.buyMerchantGear(purchased.run,gearShop.id,gear.kind).ok,false);
  }
  for(const outcome of ['trap','gear']){
    let r,offer;for(let seed=1;seed<=150;seed++){offer=E.chestOffer(-41,seed,true);if(offer?.outcome===outcome){r=underground(-41,seed);break;}}
    assert.ok(r);const opened=E.openChest(r,offer.id,r.revision);assert.ok(opened.ok,opened.message);assert.ok(C.validateSave(opened.run));assert.equal(E.openChest(opened.run,offer.id).ok,false);
  }
});
test('basement lighting uses five bounded variants without mutating the ten tower profiles',()=>{
  assert.equal(Object.keys(L.PROFILES).length,10);assert.equal(Object.keys(L.UNDERWORLD_PROFILES).length,5);
  for(const id of Object.keys(L.UNDERWORLD_PROFILES)){const ground=L.profile(id),below=L.profile(id,true);assert.notEqual(ground,below);assert.equal(ground,L.PROFILES[id]);assert.ok(below.radius>=2.5&&below.radius<=3.5);assert.ok(below.ambient+below.hemi+below.sun<.17);assert.ok(Object.isFrozen(below));}
  assert.equal(L.profile('__proto__',true),L.PROFILES.echo);
});
test('all basement hazard layouts remain bounded, fair to reserved cells and deterministic',()=>{
  const kinds=new Set();for(let floor=-1;floor>=-50;floor--){const options={floor,seed:43,size:floor>=-40?19:21,blocked:['3,3','7,7']},rows=Hazards.layout(options);assert.deepEqual(Hazards.layout(options),rows);assert.equal(rows.length,8);
    for(const row of rows){assert.ok(row.cx>=0&&row.cx<options.size&&row.cy>=0&&row.cy<options.size);assert.equal(row.tier,5);assert.ok(Math.abs(row.cx-3)+Math.abs(row.cy-3)>1);assert.ok(Math.abs(row.cx-7)+Math.abs(row.cy-7)>1);assert.ok(row.damage>=0&&row.damage<=20);kinds.add(row.kind);for(const time of [0,1,10,120])assert.ok(Number.isFinite(Hazards.phase(row,time).progress));}
  }assert.equal(kinds.size,4);
});
test('basement explorer tasks can be accepted, completed and paid once, including escort and survey in 21-grid maps',()=>{
  const found=new Set();for(let seed=1;seed<=180&&found.size<5;seed++){
    let r=underground(-41,seed),offer=E.explorerOffer(r);if(!offer||found.has(offer.type)||!['escort','relic','survey','shift','donate'].includes(offer.type))continue;
    const original=clone(r);r=E.acceptQuest(r,offer.id).run;assert.deepEqual(original.adventure,E.newAdventure());assert.equal(r.adventure.quest.floor,-41);
    if(offer.type==='escort'){assert.equal(E.questProgress(r,'escort',{atExit:true,distance:3}).ok,false);r=E.questProgress(r,'escort',{atExit:true,distance:1}).run;}
    if(offer.type==='relic')r=E.questProgress(r,'relic',{id:offer.target}).run;
    if(offer.type==='survey'){assert.equal(E.questProgress(r,'survey',{x:21,y:20}).ok,false);for(const t of E.surveyTargets(r))r=E.questProgress(r,'survey',{x:t.x,y:t.y}).run;}
    if(offer.type==='shift')r=E.questProgress(r,'shift',{id:'shift-basement-1'}).run;
    if(offer.type==='donate')r=E.questProgress(r,'donate').run;
    assert.equal(r.adventure.quest.status,'ready');const result=E.claimQuestReward(r,r.revision);assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run));assert.equal(E.claimQuestReward(result.run).ok,false);found.add(offer.type);
  }assert.equal(found.size,5);
});
test('basement growth advice reflects four allies and remains read-only',()=>{
  for(const floor of [-1,-40,-41,-50]){const r=underground(floor),before=JSON.stringify(r),guide=F.progression(r);assert.equal(guide.recruitLimit,4);assert.equal(guide.recruitLimit,P.recruitLimit(r));assert.equal(JSON.stringify(r),before);assert.ok(guide.remainingXp>=0);}
});
