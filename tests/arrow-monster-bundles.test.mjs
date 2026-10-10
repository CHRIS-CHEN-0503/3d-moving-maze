import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),L=require('../story/tower-loot.js'),E=require('../story/tower-encounters.js'),N=require('../story/tower-narrative.js');
const build=(job,seed)=>H.enable(P.enable(C.newRun({seed}),job).run).run;
// The first seed whose 99th floor has a monster that really drops an arrow bundle when shot.
function arrowDrop(run){for(const spec of P.monsterSpecs(run)){if(spec.lord||spec.elite)continue;const trial=structuredClone(run);trial.party.health[spec.id]=1;let shot=H.fireProjectile(trial,'hero',spec.id);if(!shot.ok)continue;shot=H.strike(shot.run,spec.id,{shot:true,lootCell:{x:2,y:2}});if(!shot.ok||!shot.effect.dead)continue;const entry=shot.run.party.loot.entries.find(e=>e.key==='arrow');if(entry)return {result:shot,entry};}return null;}
const ARROW_SEED=(()=>{for(let seed=1;seed<500;seed++)if(arrowDrop(build('archer',seed)))return seed;throw Error('no seed drops arrows');})();
const fresh=(job='archer',seed=ARROW_SEED)=>build(job,seed);
function add(run,job='archer',level=3,id='test-archer'){
  const member={id,profession:job,sex:'female',level,hp:28+level*6,cooldown:0,hurtLeft:0};
  run.party.members.push(member);run.party.joined.push(id);H.addMember(run,member);H.sync(run);assert.ok(C.validateSave(run));return member;
}
// The first monster on the floor whose real seeded kill drops an arrow bundle
// (the drop pool grew with new potions, so a fixed monster index is not stable).
function arrowKill(run=fresh()){
  const found=arrowDrop(run),result=found?.result,entry=found?.entry;
  assert.ok(entry,'a real seeded kill on this floor drops arrows');assert.equal(entry.quantity,50);assert.ok(C.validateSave(result.run));return {run:result.run,id:entry.id};
}
function underground(){
  const r=fresh();r.floor=1;r.floorsCleared=99;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);r.chronicle.ending='release';P.advance(r,{reward:false});
  const result=C.startUnderworld(r);assert.ok(result.ok,result.message);return result.run;
}

test('quiver capacity adds each archer level, ignores other jobs and retains a baseline without archers',()=>{
  const r=fresh('mage');H.gainXp(r,G.XP[9]);assert.equal(C.itemLimit('arrow',r),100);
  const a=add(r,'archer',1);assert.equal(C.itemLimit('arrow',r),100);
  a.level=3;a.xp=G.XP[2];assert.equal(C.itemLimit('arrow',r),200);
  const own=fresh();add(own,'archer',3);assert.equal(C.itemLimit('arrow',own),300);assert.ok(C.validateSave(own));
  for(let level=1;level<=10;level++){const one=fresh();H.gainXp(one,G.XP[level-1]);assert.equal(C.itemLimit('arrow',one),100+50*(level-1));}
  for(const id of Object.keys(C.ITEMS).filter(id=>id!=='arrow'&&id!=='shovel'))assert.equal(C.itemLimit(id,own),99);assert.equal(C.itemLimit('shovel',own),C.SHOVEL_SPARES,'spare shovels are capped');assert.equal(C.SHOVEL_SPARES,3);
  assert.equal(C.itemLimit('arrow'),100);assert.equal(C.itemStorageLimit('arrow'),3000);assert.equal(C.itemStorageLimit('ration'),99);
});
test('control changes and downed archers never shrink quivers; leaving retains over-cap saved arrows',()=>{
  let r=fresh('mage');add(r,'archer',3);r.bag.arrow=190;const switched=H.switchActor(r,'test-archer');assert.ok(switched.ok,switched.message);r=switched.run;assert.equal(C.itemLimit('arrow',r),200);
  H.state(r).switchLeft=0;r=H.switchActor(r,'hero').run;H.setHp(r,'test-archer',0);assert.equal(C.itemLimit('arrow',r),200);assert.equal(C.validateSave(r).bag.arrow,190);
  const left=P.dismiss(r,'test-archer');assert.ok(left.ok,left.message);r=left.run;assert.equal(C.itemLimit('arrow',r),100);assert.equal(r.bag.arrow,190);assert.equal(C.validateSave(JSON.stringify(r)).bag.arrow,190);
  const before=JSON.stringify(r);assert.equal(C.buy(r,'arrow',1).ok,false);assert.equal(C.collect(r,'arrow',1).ok,false);assert.equal(JSON.stringify(r),before);
  const newcomer=fresh('mage');newcomer.bag.arrow=190;add(newcomer,'archer',1,'another-archer');assert.equal(newcomer.bag.arrow,190,'starter ammo cannot truncate over-cap stock');assert.equal(C.itemLimit('arrow',newcomer),100);assert.ok(C.validateSave(newcomer));
});
test('underground hero and four companion level bounds fit the hard storage limit without truncation',()=>{
  const r=underground();for(let i=0;i<4;i++)add(r,'archer',5,'archer-'+i);H.gainXp(r,G.XP[14]);
  assert.equal(H.level(r,'hero'),15);assert.ok(r.party.members.every(m=>m.level===10));assert.equal(C.itemLimit('arrow',r),800+4*550);assert.ok(C.validateSave(r));
  r.bag.arrow=3000;assert.equal(C.validateSave(r).bag.arrow,3000);r.bag.arrow=3001;assert.equal(C.validateSave(r),null);
});
test('real monster arrow drops are 50, keep their rarity and archer gate, and do not reroll',()=>{
  const {run,id}=arrowKill();assert.equal(L.ARROW_DROP_QUANTITY,50);assert.deepEqual(L.CHANCES,{common:20,uncommon:12,rare:6,legendary:3});
  const entry=run.party.loot.entries.find(e=>e.id===id),spec=P.monsterSpecs(run).find(m=>m.id===entry.source);
  assert.equal(entry.rarity,'common');assert.equal(entry.type,'item');assert.deepEqual(L.recordKill(run,spec,{x:2,y:2}),[]);
  const mage=fresh('mage');assert.ok(!L.pool(mage,P.monsterSpecs(mage)[0]).some(e=>e.key==='arrow'));
  assert.equal(L.pool(run,spec).find(e=>e.key==='arrow').quantity,50);
});
test('whole arrow bundles use level capacity, persist when full, and can be claimed once after making room',()=>{
  const initial=fresh();H.gainXp(initial,G.XP[1]);const {run,id}=arrowKill(initial);run.bag.arrow=95;
  let claim=L.claim(run,id);assert.ok(claim.ok,claim.message);assert.equal(claim.run.bag.arrow,145);assert.equal(claim.run.party.loot.entries.some(e=>e.id===id),false);
  const blocked=structuredClone(run);blocked.bag.arrow=101;const before=JSON.stringify(blocked);claim=L.claim(blocked,id);assert.equal(claim.ok,false);assert.match(claim.message,/整束箭矢留在原地/);assert.equal(JSON.stringify(blocked),before);
  const reload=C.validateSave(JSON.stringify(blocked));assert.ok(reload);assert.equal(reload.party.loot.entries.find(e=>e.id===id).quantity,50);assert.equal(L.claim(reload,id).ok,false);
  reload.bag.arrow=100;claim=L.claim(reload,id);assert.ok(claim.ok,claim.message);assert.equal(claim.run.bag.arrow,150);assert.equal(L.claim(claim.run,id).ok,false);assert.equal(L.claim(reload,id,reload.revision-1).ok,false);assert.ok(C.validateSave(claim.run));
  const levelOne=arrowKill();levelOne.run.bag.arrow=50;assert.equal(L.claim(levelOne.run,levelOne.id).run.bag.arrow,100);levelOne.run.bag.arrow=51;assert.equal(L.claim(levelOne.run,levelOne.id).ok,false);
});
test('legacy 12-arrow ground piles and over-cap bags survive reload while malformed item quantities fail',()=>{
  const {run,id}=arrowKill();run.party.loot.entries.find(e=>e.id===id).quantity=12;run.bag.arrow=80;
  const old=C.validateSave(JSON.stringify(run));assert.ok(old);assert.equal(old.party.loot.entries.find(e=>e.id===id).quantity,12);assert.equal(L.claim(old,id).run.bag.arrow,92);
  for(const bad of [0,51,100,1.5]){const corrupt=structuredClone(run);corrupt.party.loot.entries[0].quantity=bad;assert.equal(C.validateSave(corrupt),null);}
  const corrupt=structuredClone(run);Object.assign(corrupt.party.loot.entries[0],{key:'ration',quantity:50});assert.equal(C.validateSave(corrupt),null);
  for(const count of [99,100,200,800,3000]){const r=fresh();r.bag.arrow=count;assert.equal(C.validateSave(r).bag.arrow,count);if(count>=100)assert.equal(C.buy(r,'arrow',1).ok,false);}
  const over=fresh();over.bag.arrow=200;const shot=H.fireProjectile(over,'hero');assert.ok(shot.ok);assert.equal(shot.run.bag.arrow,199);
});
test('merchant and direct purchases share variable limits and ten-arrows-per-coin prices; other items stay 99',()=>{
  for(const level of [1,2,3]){const r=fresh('archer',1);H.gainXp(r,G.XP[level-1]);const cap=C.itemLimit('arrow',r),shop=E.merchantOffers(r.floor,r.seed,true).find(m=>m.id==='suHe');r.bag.arrow=cap-10;r.coins=2;
    for(const result of [C.buy(r,'arrow',10),E.buySupply(r,shop.id,'arrow',10)]){assert.ok(result.ok,result.message);assert.equal(result.run.bag.arrow,cap);assert.equal(result.run.coins,1);assert.ok(C.validateSave(result.run));}
    r.bag.arrow=cap-5;assert.equal(E.buySupply(r,shop.id,'arrow',10).ok,false);const top=E.buySupply(r,shop.id,'arrow',5);assert.ok(top.ok);assert.equal(top.run.bag.arrow,cap);assert.equal(top.run.coins,1);
  }
  const r=fresh();r.coins=999;r.bag.ration=99;assert.equal(C.buy(r,'ration',1).ok,false);assert.ok(C.validateSave(r));r.bag.ration=100;assert.equal(C.validateSave(r),null);
});
