import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),R=require('../story/tower-hero-growth.js'),E=require('../story/tower-encounters.js'),L=require('../story/tower-loot.js'),Co=require('../story/tower-cooperation-core.js'),A=require('../story/tower-ascension-catalog.js'),GM=require('../story/tower-gm.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const build=(floor,job,level,companions=[],seed=4)=>GM.build({floor,job,level,seed,companions}).run;
const NEW=['heal_mid','heal_high','spirit','haste_strong','arcane','courage'];

test('every move recovers twice as fast: skills, awakening and advanced moves, robot skills and combos; daylight is not a move',()=>{
  assert.equal(H.COOLDOWN_SCALE,.5);assert.equal(H.SKILLS.wind_slash.cooldown,4);assert.equal(H.SKILLS.taunt.cooldown,11);
  for(const s of A.actives)assert.equal(H.SKILLS[s.id].cooldown,s.cooldown*.5,s.id);
  assert.deepEqual([...H.SKILLS.cleanse.power],[15,13.5,12,10.5,9,7.5],'cleanse keeps its cooldown table in its ranks, halved too');
  assert.equal(Co.DEFINITIONS.find(d=>d.id==='dawn_breach').cooldown,24);assert.ok(Co.DEFINITIONS.every(d=>d.cooldown>0&&d.cooldown<=27.5));
  const mage=build(80,'mage',3),cast=H.cast(mage,'daylight');if(cast.ok)assert.equal(H.actor(cast.run,'hero').cooldowns.daylight,600);
});

test('MP: each job has its own pool, every move costs 4 + half its original cooldown (capped), robots run on energy instead',()=>{
  assert.deepEqual([...['mage','healer','archer','chef','scout','smith','swordsman'].map(j=>H.mpMax(j,1))],[63,61,50,47,45,43,41]);assert.equal(H.mpMax('robot',10),0);
  assert.equal(H.SKILLS.wind_slash.mp,8);assert.equal(H.SKILLS.revive.mp,30,'a long-cooldown rescue is capped so a level-one healer can still revive');
  for(const s of Object.values(H.SKILLS)){if(s.job==='robot'){assert.equal(s.mp,0,s.id);continue;}assert.ok(s.mp<=(s.unique?45:30)&&s.mp>=4,s.id);const earliest=s.ascension?12:s.unique?10:1;assert.ok(s.mp<=H.mpMax(s.job,earliest)*.6,s.id+' affordable when first learned');}
  const robot=build(80,'robot',3);assert.equal(H.maxMp(robot,'hero'),0);assert.equal(H.mp(robot,'hero'),0);
});

test('casting spends MP; too little blocks the cast with a clear message; it regenerates, refills on a level up and old saves load full',()=>{
  let run=build(85,'swordsman',3,[{job:'mage',level:3}]);const max=H.maxMp(run,'hero');assert.equal(H.mp(run,'hero'),max,'a journey saved before MP existed loads full');
  const cast=H.cast(run,'wind_slash',{},run.revision);assert.ok(cast.ok,cast.message);run=cast.run;assert.equal(H.mp(run,'hero'),max-8);assert.ok(C.validateSave(JSON.stringify(run)));
  H.actor(run,'hero').mp=3;H.actor(run,'hero').cooldowns.wind_slash=0;H.actor(run,'hero').attack=0;const blocked=H.cast(run,'wind_slash',{},run.revision);assert.equal(blocked.ok,false);assert.match(blocked.message,/MP 不足：需要 8 點，目前 3 點/);
  assert.equal(H.mpReady(run,'hero','wind_slash'),false);H.tick(run,2);assert.ok(Math.abs(H.mp(run,'hero')-(3+2*H.mpRegen(run,'hero')))<1e-9,'regenerates every second');
  H.actor(run,'hero').mp=1;H.gainXp(run,R.XP[3]-H.state(run).xp);assert.equal(H.level(run,'hero'),4);assert.equal(H.mp(run,'hero'),H.maxMp(run,'hero'),'a level up refills MP');
  // The save only accepts MP within the pool, and never on a robot.
  const bad=structuredClone(run);H.actor(bad,'hero').mp=H.maxMp(run,'hero')+1;assert.equal(C.validateSave(JSON.stringify(bad)),null);
  const robot=build(80,'robot',3);H.actor(robot,'hero').mp=5;assert.equal(C.validateSave(JSON.stringify(robot)),null);
});

test('companions and auto-rescue only choose moves they can pay for; the buttons say MP不足',()=>{
  const run=build(85,'archer',3,[{job:'healer',level:4}]),healer=H.ids(run)[1];R.state(run).policies[healer].strategy='support';R.state(run).policies[healer].materials=true;
  for(const k of H.actor(run,healer).skills)H.actor(run,healer).cooldowns[k]=0;H.actor(run,healer).mp=0;H.setHp(run,'hero',10);
  const choice=R.aiChoice(run,healer,H.ids(run),false,{});assert.ok(!choice||!choice.skillId||H.SKILLS[choice.skillId].mp===0,'no paid move without MP');
  assert.match(read('story/tower-hero-growth.js'),/a\.cooldowns\[key\]>0\|\|!h\.mpReady\(run,id,key\)/);assert.match(read('story/tower-heroes-core.js'),/a\.cooldowns\[skill\]>0\|\|!mpReady\(run,id,skill\)/);
  const runtime=read('story/tower-heroes-runtime.js');assert.match(runtime,/missingMp=!H\.mpReady\(r\(\),H\.state\(r\(\)\)\.active,id\)/);assert.match(runtime,/missingMp&&!preparingThis&&!\(a\.cooldowns\[id\]>0\)\?'MP不足'/);
  assert.match(runtime,/<span class="hero-mp" aria-hidden="true"><i style="width:'\+mpBar\[id\]\+'%"><\/i><\/span>/,'a blue MP bar on each card');assert.match(read('story/tower-heroes.css'),/#heroTeamBar \.hero-mp i\{[^}]*background:#4f9df0\}/);
});

test('the basic draught is renamed and six new potions arrive by depth: shop, drops and old saves',()=>{
  assert.equal(C.ITEMS.heal.name,'初級療癒藥');assert.deepEqual(NEW.map(k=>C.ITEMS[k].name),['中級療癒藥','高級療癒藥','精神藥水','強力加速藥水','魔力藥水','勇氣藥水']);
  for(const [key,floors]of [['spirit',[99,60,1,-1]],['heal_mid',[60,30,-1]],['heal_high',[-1,-50]],['arcane',[-1]],['courage',[-1]],['haste_strong',[-1]]])for(const floor of floors)assert.equal(C.potionAvailable(key,floor),true,key+' '+floor);
  for(const [key,floor]of [['heal_mid',61],['heal_high',1],['arcane',1],['courage',99],['haste_strong',60]])assert.equal(C.potionAvailable(key,floor),false,key+' '+floor);
  let shop=null;for(let seed=1;seed<500&&!shop;seed++)shop=E.merchantOffers(-3,seed,true).find(m=>m.id==='suHe');assert.ok(shop);for(const k of ['heal','spirit',...NEW])assert.ok(shop.supplies.includes(k),k+' sold underground');
  const pool=k=>L.pool(build(k,'swordsman',k<0?10:3),{id:'monster-0',kind:'mushroom'}).filter(e=>e.type==='item').map(e=>e.key);
  assert.ok(pool(90).includes('spirit')&&!pool(90).includes('heal_mid'));assert.ok(pool(60).includes('heal_mid'));for(const k of NEW)assert.ok(pool(-1).includes(k),k);
  const old=build(80,'swordsman',3);for(const k of NEW)delete old.bag[k];const loaded=C.validateSave(JSON.stringify(old));assert.ok(loaded);for(const k of NEW)assert.equal(loaded.bag[k],0,k);
  assert.equal(C.newRun({seed:2}).bag.spirit,0);
});

test('each potion does what it says, refuses to stack, and auto-heal picks a fitting draught',()=>{
  let run=build(-5,'swordsman',11,[{job:'mage',level:8}]);for(const k of ['heal',...NEW,'haste'])run.bag[k]=3;run=C.validateSave(JSON.stringify(run));
  const use=(k,id='hero')=>{R.state(run).policies[id].itemLeft=0;const u=R.use(run,k,id);if(u.ok)run=u.run;return u;};
  const physical=H.stats(run,'hero').damage;assert.ok(use('courage').ok);assert.ok(Math.abs(H.stats(run,'hero').damage/physical-1.3)<1e-9);assert.deepEqual([H.buff(run,'courage','hero').left,H.buff(run,'courage','hero').power],[180,30]);assert.equal(use('courage').ok,false);
  const mage=H.ids(run)[1],spell=H.stats(run,mage).spellDamage;assert.ok(use('arcane',mage).ok);assert.ok(Math.abs(H.stats(run,mage).spellDamage/spell-1.3)<1e-9);
  assert.ok(use('haste').ok);assert.ok(use('haste_strong').ok,'a strong draught replaces a normal haste');assert.equal(H.buff(run,'haste','hero').power,35);assert.equal(use('haste_strong').ok,false);assert.equal(use('haste').ok,false);
  H.actor(run,'hero').mp=1;assert.ok(use('spirit').ok);assert.equal(H.mp(run,'hero'),46);
  H.setHp(run,'hero',1);assert.ok(use('heal_mid').ok);assert.equal(H.hp(run,'hero'),71);H.setHp(run,'hero',1);assert.ok(use('heal_high').ok);assert.equal(H.hp(run,'hero'),Math.min(151,H.maxHp(run,'hero')));
  assert.ok(C.validateSave(JSON.stringify(run)),'all of it saves');
  // Auto-heal: the smallest draught that covers about 80% of the wound, else the strongest.
  R.state(run).useActive=true;R.state(run).policies[mage].heal={enabled:true,threshold:95,reserve:0};R.state(run).policies[mage].itemLeft=0;
  H.setHp(run,mage,H.maxHp(run,mage)-30);assert.equal(R.autoItems(run).key,'heal');H.setHp(run,mage,H.maxHp(run,mage)-75);assert.equal(R.autoItems(run).key,'heal_mid');
  run.bag.heal=run.bag.heal_mid=0;assert.equal(R.autoItems(run).key,'heal_high');
  // Spirit auto-use follows its own MP threshold.
  run.bag.heal_high=0;R.state(run).policies[mage].spirit={enabled:true,threshold:30,reserve:0};H.actor(run,mage).mp=5;assert.deepEqual({...R.autoItems(run)},{id:mage,key:'spirit'});
  // A robot cannot drink spirit; a legacy journey keeps buff potions for hero journeys.
  const robot=build(-5,'robot',11);robot.bag.spirit=1;R.state(robot).policies.hero.itemLeft=0;assert.match(R.use(robot,'spirit').message,/機器人沒有 MP/);
  const legacy=C.newRun({seed:5});legacy.bag.courage=1;assert.equal(C.useItem(legacy,'courage').ok,false);legacy.bag.heal_mid=1;legacy.hp=10;const drank=C.useItem(legacy,'heal_mid');assert.ok(drank.ok);assert.equal(drank.run.hp,60);
});

test('settings: 離開遊戲 sits right before 繼續遊戲 at the right end',()=>{
  assert.match(read('story/tower-mode.js'),/action\('離開遊戲','quit',null,false,'is-leave'\)\+action\('繼續遊戲','close'\)/);
  const css=read('story/tower-mobile.css');assert.match(css,/\.tower-btn\.is-leave\{margin-left:auto\}/);assert.match(css,/\.tower-btn\.is-leave\+\.tower-btn\.is-exit\{margin-left:0\}/);
});

test('bosses leave several different piles: chapter lords 2-5, floor mini lords 1-2 (the healing draught counts as one); only boss slots may hold extra piles',()=>{
  const Lt=require('../story/tower-loot.js'),counts={lord:new Set(),mini:new Set()};
  for(let seed=1;seed<=80;seed++)for(const [floor,kind]of [[80,'lord'],[85,'mini'],[-20,'lord'],[-15,'mini']]){
    const run=build(floor,'swordsman',floor<0?11:3,[],seed),spec=P.monsterSpecs(run).find(s=>kind==='lord'?s.lord:s.elite),drops=H.finishMonster(run,spec,{x:1,y:1});
    counts[kind].add(drops.length);assert.ok(kind==='lord'?drops.length>=2&&drops.length<=5:drops.length>=1&&drops.length<=2,kind+' '+floor+' '+seed);
    assert.equal(new Set(drops.map(d=>d.type+':'+d.key)).size,drops.length,'different kinds');if(kind==='mini')assert.ok(drops.some(d=>d.id.endsWith(':bonus')),'the draught is one of them');
    assert.ok(C.validateSave(JSON.stringify(run)),'saves');}
  assert.deepEqual([...counts.lord].sort(),[2,3,4,5]);assert.deepEqual([...counts.mini].sort(),[1,2]);
  // An ordinary monster can never claim an extra pile slot.
  const run=build(85,'swordsman',3),spec=P.monsterSpecs(run).find(s=>!s.elite&&!s.lord);H.finishMonster(run,spec,{x:1,y:1});
  run.party.loot.entries.push({id:'85:'+spec.id+':item2',source:spec.id,type:'item',key:'ration',rarity:'common',quantity:1,cx:1,cy:1});assert.equal(C.validateSave(JSON.stringify(run)),null);
  assert.deepEqual([...Lt.BOSS_PILES.lord],[2,5]);assert.deepEqual([...Lt.BOSS_PILES.mini],[1,2]);assert.deepEqual([...Lt.BOSS_PILES.champion],[1,3],'only the hunt-rift champion leaves up to three');
});
