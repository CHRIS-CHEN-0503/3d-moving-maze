import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const C = require('../story/story-core.js');
const E = require('../story/tower-encounters.js');
const clone = value => JSON.parse(JSON.stringify(value));
function runAt(floor = 99, seed = 1) { const run=C.newRun({seed});run.floor=floor;run.floorsCleared=99-floor;return run; }
function findRun(predicate, floor = 99) {
  for(let seed=1;seed<10000;seed++){const run=runAt(floor,seed);if(predicate(run))return run;}
  assert.fail('Deterministic fixture must exist within bounded seed search');
}
function questRun(type, floor = 99) {
  const run=findRun(r=>E.explorerOffer(r)?.type===type,floor);
  const result=E.acceptQuest(run,E.explorerOffer(run).id);assert.equal(result.ok,true);return result.run;
}
function completeSimple(run) {
  const q=run.adventure.quest;
  if(q.type==='survey')for(const [x,y] of [[0,0],[1,0],[2,0]])run=E.questProgress(run,'survey',{x,y}).run;
  else if(q.type==='shift')run=E.questProgress(run,'shift',{id:'shift-1'}).run;
  else if(q.type==='escort')run=E.questProgress(run,'escort',{atExit:true,distance:1}).run;
  else if(q.type==='relic')run=E.questProgress(run,'relic',{id:q.target}).run;
  else if(q.type==='donate'){run.bag[q.target]=q.goal;run=E.questProgress(run,'donate').run;}
  assert.equal(run.adventure.quest.status,'ready');return run;
}

test('三位商人的裝備與補給專業互不混淆，每層只出現一或兩位',()=>{
  const expected={tieLing:['helmet','bat'],jinHe:['armor','pan'],lanZhou:['shield','staff']},seen=new Set();
  assert.equal(new Set(Object.values(E.MERCHANTS).flatMap(m=>m.supplies)).size,7);
  for(const floor of [99,69,19])for(let seed=1;seed<=35;seed++){
    const shops=E.merchantOffers(floor,seed);assert.ok(shops.length>=1&&shops.length<=2);if(floor===99)assert.equal(shops.length,1);
    assert.deepEqual(shops,E.merchantOffers(floor,seed));
    for(const shop of shops){seen.add(shop.id);assert.deepEqual(shop.equipmentKinds,expected[shop.id]);assert.deepEqual(shop.gear.map(g=>g.kind),expected[shop.id]);for(const entry of shop.gear){assert.equal(entry.gear.bonus,0);assert.equal(entry.price,C.gearPrice(entry.gear));}}
  }
  assert.equal(seen.size,3);
});

test('物資總數隨迷宮擴大由四件漸增，頂層不再擁擠',()=>{
  const sizes=[7,9,11,13,15,17,19];
  assert.deepEqual(sizes.map(size=>E.floorLootCounts(size).total),[4,6,8,10,12,14,16]);
  assert.deepEqual(E.floorLootCounts(7),{itemCount:1,foodCount:1,storyCount:2,total:4});
  assert.throws(()=>E.floorLootCounts(8),RangeError);
});

test('商店驗證在場商人與供貨，不接受任意物品、價錢或重複裝備購買',()=>{
  const run=runAt();run.coins=999;const shop=E.merchantOffers(run.floor,run.seed)[0],kind=shop.gear[0].kind;
  const before=clone(run),missing=Object.keys(E.MERCHANTS).find(id=>id!==shop.id);
  assert.equal(E.buySupply(run,missing,'heal').ok,false);assert.deepEqual(run,before);
  assert.equal(E.buySupply(run,shop.id,'coin').ok,false);assert.equal(E.buySupply(run,shop.id,shop.supplies[0],-1).ok,false);
  const bought=E.buyMerchantGear(run,shop.id,kind,run.revision);assert.equal(bought.ok,true);assert.equal(bought.run.coins,999-shop.gear[0].price);assert.equal(bought.run.gearBag.length,1);
  const duplicate=E.buyMerchantGear(bought.run,shop.id,kind);assert.equal(duplicate.ok,false);assert.deepEqual(duplicate.run,bought.run);
  const otherkind=Object.keys(C.GEAR).find(id=>!shop.equipmentKinds.includes(id));assert.equal(E.buyMerchantGear(run,shop.id,otherkind).ok,false);
  const supplies=E.buySupply(run,shop.id,shop.supplies[0],2);assert.equal(supplies.ok,true);assert.equal(supplies.run.bag[shop.supplies[0]],run.bag[shop.supplies[0]]+2);
  assert.equal(E.buySupply(supplies.run,shop.id,shop.supplies[0],1,run.revision).ok,false);
  const sold=E.sellSupply(supplies.run,shop.id,shop.supplies[0]);assert.equal(sold.ok,true);assert.ok(C.validateSave(sold.run));
});

test('寶箱與探險者各自約二成出現，種子固定且互相獨立',()=>{
  let chests=0,explorers=0,both=0,traps=0;
  for(let seed=1;seed<=2000;seed++){
    const run=runAt(69,seed),chest=E.chestOffer(69,seed),explorer=E.explorerOffer(run);
    if(chest){chests++;if(chest.outcome==='trap')traps++;assert.deepEqual(chest,E.chestOffer(69,seed));}
    if(explorer)explorers++;if(chest&&explorer)both++;
  }
  assert.ok(chests>300&&chests<500);assert.ok(explorers>300&&explorers<500);assert.ok(both>40&&both<130);assert.ok(traps/chests>.25&&traps/chests<.45);
});

test('五位探索者有固定身分與個性台詞，回傳資料不會污染角色目錄',()=>{
  const names={eve:'伊芙',rowan:'洛恩',mira:'米菈',oren:'奧倫',sena:'星奈'},seen=new Set();
  assert.deepEqual(Object.keys(E.EXPLORERS),Object.keys(names));
  assert.ok(Object.isFrozen(E.EXPLORERS));
  assert.equal(new Set(Object.values(E.EXPLORERS).map(entry=>entry.greeting)).size,5);
  for(let seed=1;seed<=300;seed++){
    const identity=E.explorerIdentity(60,seed);seen.add(identity.id);
    assert.deepEqual(Object.keys(identity).sort(),['greeting','id','name','title']);
    assert.equal(identity.name,names[identity.id]);assert.equal(identity.title,'探索者');assert.ok(identity.greeting.length>=12);
    assert.ok(Object.isFrozen(E.EXPLORERS[identity.id]));assert.deepEqual(identity,E.explorerIdentity(60,seed));
    assert.notStrictEqual(identity,E.explorerIdentity(60,seed));
    const expected=clone(identity);identity.name='被改掉的名字';identity.greeting='外部改動';
    assert.deepEqual(E.explorerIdentity(60,seed),expected);
  }
  assert.deepEqual([...seen].sort(),Object.keys(names).sort());
  assert.ok(Array.from({length:99},(_,i)=>E.explorerIdentity(i+1,25).id).some(id=>id!==E.explorerIdentity(99,25).id));
});

test('探索者身分沿用樓層與種子，存讀檔、庫存改變及委託進度皆不換人',()=>{
  for(const id of Object.keys(E.EXPLORERS)){
    let run=findRun(r=>E.explorerOffer(r)?.explorer.id===id),identity=E.explorerIdentity(run.floor,run.seed);
    const before=clone(run);assert.deepEqual(E.explorerOffer(run).explorer,identity);assert.deepEqual(run,before);
    run.bag.heal=run.bag.ration=run.bag.map=0;run.equipment.weapon=null;
    assert.deepEqual(E.explorerOffer(run).explorer,identity);
    const accepted=E.acceptQuest(run,E.explorerOffer(run).id);assert.equal(accepted.ok,true);run=accepted.run;
    assert.deepEqual(Object.keys(run.adventure.quest).sort(),['events','floor','goal','id','progress','status','target','type']);
    const saved=C.validateSave(JSON.stringify(run));assert.ok(saved);
    assert.deepEqual(E.explorerOffer(saved).explorer,identity);
    assert.deepEqual(E.explorerOffer(completeSimple(saved)).explorer,identity);
    const legacy=clone(saved);delete legacy.adventure;
    const restored=C.validateSave(legacy);assert.ok(restored);assert.deepEqual(E.explorerOffer(restored).explorer,identity);
  }
});

test('五位探索者都能給出七種委託，不把任務綁定角色',()=>{
  const seen=Object.fromEntries(Object.keys(E.EXPLORERS).map(id=>[id,new Set()]));
  for(let seed=1;seed<=10000&&!Object.values(seen).every(types=>types.size===7);seed++){
    const run=runAt(60,seed);run.hiredWarriors=['fixture'];run.warrior={offerId:'fixture',strength:5,mode:'escort',targetId:null,remaining:null};
    const offer=E.explorerOffer(run);if(offer)seen[offer.explorer.id].add(offer.type);
  }
  for(const [id,types] of Object.entries(seen))assert.deepEqual([...types].sort(),[...E.QUEST_TYPES].sort(),id);
});

test('加入身分前後出現率與原任務抽選完全相同，不消耗原本的隨機序列',()=>{
  // Verified using the pre-identity HEAD core and encounter sources in an isolated VM, with legal strength 5.
  const fixtures=[
    {floor:99,count:405,sha256:'439a2dfdc2f04c1b2933e14e3be6a13f45b4168f2fc935922567bdba2d801eb4'},
    {floor:60,count:390,sha256:'48fec897071b2fc87a0764774d08d1071feb669205ceac6051158e5551177a2b'},
    {floor:1,count:368,sha256:'0a4992b06602bc467c057f63564bdc1ac6496b1742d8635e64d2114c6afe76cc'},
  ];
  for(const fixture of fixtures){
    const rows=[];let count=0;
    for(let seed=1;seed<=2000;seed++){
      const run=runAt(fixture.floor,seed);
      if(fixture.floor!==99){run.hiredWarriors=['fixture'];run.warrior={offerId:'fixture',strength:5,mode:'escort',targetId:null,remaining:null};}
      E.explorerIdentity(run.floor,run.seed);E.explorerIdentity(run.floor,run.seed);
      const offer=E.explorerOffer(run);if(offer)count++;
      rows.push([seed,offer?[offer.type,offer.target,offer.goal]:null]);
    }
    assert.equal(count,fixture.count);assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),fixture.sha256);
  }
});

test('探索者身分拒絕無效樓層或種子，邊界輸入仍可穩定產生',()=>{
  for(const floor of [undefined,null,'60',0,100,-1,1.5,NaN,Infinity])assert.throws(()=>E.explorerIdentity(floor,1),RangeError);
  for(const seed of [undefined,null,'1',0,-1,0x100000000,1.5,NaN,Infinity])assert.throws(()=>E.explorerIdentity(60,seed),RangeError);
  for(const floor of [1,99])for(const seed of [1,0xffffffff])assert.deepEqual(E.explorerIdentity(floor,seed),E.explorerIdentity(floor,seed));
});

test('陷阱與強化寶物只能開一次，重試或讀檔不能重抽',()=>{
  for(const outcome of ['trap','gear']){
    const run=findRun(r=>E.chestOffer(r.floor,r.seed)?.outcome===outcome),offer=E.chestOffer(run.floor,run.seed),before=clone(run);
    const opened=E.openChest(run,offer.id);assert.equal(opened.ok,true);assert.deepEqual(run,before);
    assert.ok(opened.run.adventure.claimed.includes(offer.id));assert.ok(C.validateSave(opened.run));
    if(outcome==='trap'){assert.equal(opened.effect.outcome,'trap');assert.ok(opened.run.hp<run.hp);assert.equal(opened.run.gearBag.length,0);}
    else{assert.equal(opened.run.gearBag.length,1);assert.ok(opened.run.gearBag[0].bonus>=1);assert.ok(opened.run.gearBag[0].maxDurability>=10);}
    const saved=C.validateSave(JSON.stringify(opened.run));assert.equal(E.openChest(saved,offer.id).ok,false);assert.deepEqual(E.chestOffer(saved.floor,saved.seed),offer);
    assert.equal(E.openChest(run,'forged').ok,false);
  }
});

test('強化寶箱背包已滿時不吞裝備、不消耗開箱機會',()=>{
  const run=findRun(r=>E.chestOffer(r.floor,r.seed)?.outcome==='gear');
  for(let i=0;i<24;i++)assert.equal(C.receiveGear(run,C.createGear('bat',run.floor,run.seed,'test-bag-'+i)).ok,true);
  const before=clone(run),offer=E.chestOffer(run.floor,run.seed),result=E.openChest(run,offer.id);
  assert.equal(result.ok,false);assert.deepEqual(result.run,before);assert.equal(result.run.adventure.claimed.length,0);
});

test('不存在怪物的樓層不會提供戰鬥委託，已接受委託不因庫存改變重抽',()=>{
  for(let seed=1;seed<400;seed++){const offer=E.explorerOffer(runAt(99,seed));if(offer)assert.ok(!['defeat','stun'].includes(offer.type));}
  const accepted=questRun('survey'),offer=E.explorerOffer(accepted);accepted.bag.heal=90;accepted.equipment.weapon=null;
  assert.deepEqual(E.explorerOffer(accepted),offer);assert.equal(E.acceptQuest(accepted,offer.id).ok,false);
  const pending=findRun(r=>!!E.explorerOffer(r));const before=clone(pending);assert.equal(E.acceptQuest(pending,'forged').ok,false);assert.deepEqual(pending,before);
});

test('探索三格必須不同且在地圖內，重複事件不能刷進度或領兩次報酬',()=>{
  let run=questRun('survey');assert.equal(E.claimQuestReward(run).ok,false);
  assert.equal(E.questProgress(run,'survey',{x:-1,y:0}).ok,false);
  run=E.questProgress(run,'survey',{x:0,y:0}).run;assert.equal(run.adventure.quest.progress,1);
  const duplicate=E.questProgress(run,'survey',{x:0,y:0});assert.equal(duplicate.ok,false);assert.equal(duplicate.run.adventure.quest.progress,1);
  run=E.questProgress(run,'survey',{x:1,y:0}).run;run=E.questProgress(run,'survey',{x:2,y:0}).run;
  assert.equal(run.adventure.quest.status,'ready');const before=clone(run),claim=E.claimQuestReward(run);
  assert.equal(claim.ok,true);assert.deepEqual(run,before);assert.equal(claim.run.adventure.quest.status,'claimed');assert.ok(C.validateSave(claim.run));
  assert.equal(E.claimQuestReward(C.validateSave(claim.run)).ok,false);
});

test('護送必須旅人靠近出口，找物必須指定物件，變形必須有效事件',()=>{
  let escort=questRun('escort');assert.equal(E.questProgress(escort,'escort',{atExit:true,distance:10}).ok,false);assert.equal(E.questProgress(escort,'escort',{atExit:false,distance:1}).ok,false);
  escort=E.questProgress(escort,'escort',{atExit:true,distance:2}).run;assert.equal(escort.adventure.quest.status,'ready');
  const relic=questRun('relic');assert.equal(E.questProgress(relic,'relic',{id:'fake'}).ok,false);assert.equal(E.questProgress(relic,'relic',{id:relic.adventure.quest.target}).run.adventure.quest.status,'ready');
  const shift=questRun('shift');assert.equal(E.questProgress(shift,'shift',{}).ok,false);assert.equal(E.questProgress(shift,'shift',{id:'floor99-shift1'}).run.adventure.quest.status,'ready');
});

test('交付補給不足時不扣款，交足一至三份後不能再扣',()=>{
  let run=questRun('donate');const q=run.adventure.quest;assert.ok(q.goal>=1&&q.goal<=3);
  run.bag[q.target]=0;const before=clone(run);assert.equal(E.questProgress(run,'donate').ok,false);assert.deepEqual(run,before);
  run.bag[q.target]=q.goal;const paid=E.questProgress(run,'donate');assert.equal(paid.ok,true);assert.equal(paid.run.bag[q.target],0);assert.equal(paid.run.adventure.quest.status,'ready');
  assert.equal(E.questProgress(paid.run,'donate').ok,false);
});

test('補給委託只要求目前能交出的物資，避免小地圖出現無解的需求',()=>{
  for(let seed=1;seed<=300;seed++){
    const run=runAt(99,seed),offer=E.explorerOffer(run);
    if(offer?.type==='donate'){assert.ok(offer.goal<=run.bag[offer.target]);assert.ok(offer.goal>=1);}
    run.bag.heal=run.bag.ration=run.bag.map=0;
    assert.notEqual(E.explorerOffer(run)?.type,'donate');
  }
});

test('擊敗任務只指向護衛有能力戰勝的怪物，死亡紀錄才能完成委託',()=>{
  let found;
  for(let seed=1;seed<10000;seed++){
    const run=runAt(60,seed);run.hiredWarriors=['fixture'];run.warrior={offerId:'fixture',strength:3,mode:'escort',targetId:null,remaining:null};
    const offer=E.explorerOffer(run);
    if(offer?.type==='defeat'){found={run,offer};break;}
  }
  assert.ok(found);assert.equal(found.offer.target,'monster-0');
  const accepted=E.acceptQuest(found.run,found.offer.id).run;
  assert.equal(E.questProgress(accepted,'defeat',{monsterId:found.offer.target}).ok,false);
  accepted.defeatedMonsters.push(found.offer.target);
  assert.equal(E.questProgress(accepted,'defeat',{monsterId:found.offer.target}).run.adventure.quest.status,'ready');
});

test('擊暈任務須真實的指定怪物暈眩狀態，不能僅回報一個事件',()=>{
  const run=questRun('stun',60),id=run.adventure.quest.target;
  assert.equal(E.questProgress(run,'stun',{monsterId:id}).ok,false);
  run.monsterStuns[id]=10;assert.equal(E.questProgress(run,'stun',{monsterId:'monster-99'}).ok,false);
  const result=E.questProgress(run,'stun',{monsterId:id});assert.equal(result.ok,true);assert.equal(result.run.adventure.quest.status,'ready');
});

test('放棄或下降清除當層委託，保存的版本與進度形狀受到驗證',()=>{
  const run=questRun('relic'),abandoned=E.abandonQuest(run);assert.equal(abandoned.ok,true);assert.equal(abandoned.run.adventure.quest,null);assert.equal(E.explorerOffer(abandoned.run),null);
  const descended=C.descend(run);assert.equal(descended.ok,true);assert.deepEqual(descended.run.adventure,E.newAdventure());
  const saved=clone(run);delete saved.adventure;assert.deepEqual(C.validateSave(saved).adventure,E.newAdventure());
  assert.equal(E.validateAdventure({version:2,claimed:[],quest:null},99),null);
  const invalid=clone(run.adventure);invalid.quest.progress=invalid.quest.goal;assert.equal(E.validateAdventure(invalid,run.floor),null);
  assert.equal(E.validateAdventure(run.adventure,98),null);
});

test('報酬由樓層種子固定，背包滿不遺失完成狀態與獎勵',()=>{
  let run=findRun(r=>E.explorerOffer(r)&&!['defeat','stun'].includes(E.explorerOffer(r).type)&&E.questReward(r.floor,r.seed).gear);
  run=E.acceptQuest(run,E.explorerOffer(run).id).run;run=completeSimple(run);
  for(let i=0;i<24;i++)C.receiveGear(run,C.createGear('pan',run.floor,run.seed,'full-'+i));
  const before=clone(run),failed=E.claimQuestReward(run);assert.equal(failed.ok,false);assert.deepEqual(failed.run,before);assert.equal(failed.run.adventure.quest.status,'ready');
  assert.deepEqual(E.questReward(run.floor,run.seed),E.explorerOffer(run).reward);
});
