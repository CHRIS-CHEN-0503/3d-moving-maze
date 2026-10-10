import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),X=require('../story/tower-expedition-core.js'),E=require('../story/tower-encounters.js'),N=require('../story/tower-narrative.js');
const ok=result=>{assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run));return result.run;};
const fresh=(job='swordsman',seed=47)=>{const run=ok(H.enable(ok(P.enable(C.newRun({seed}),job))));run.coins=999;run.party.journey.scrap=99;for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=40;for(const k of Object.keys(run.party.journey.materials))run.party.journey.materials[k]=40;return run;};
function companion(run,profession){const member={id:'service-'+profession,profession,sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(member);run.party.joined.push(member.id);H.addMember(run,member);H.sync(run);assert.ok(C.validateSave(run));return member.id;}
function shopRun(merchantId,job='swordsman'){for(let seed=1;seed<100;seed++){const run=fresh(job,seed);if(E.serviceContext(run,merchantId))return run;}throw Error('missing shop');}
function stored(run,kind){const gear=C.createGear(kind,run.floor,run.seed,'service-gear-'+kind);run=ok(C.grantGear(run,gear));return [run,run.gearBag.find(g=>g.id===gear.id)];}
function unchanged(run,operation){const before=JSON.stringify(run),result=operation();assert.equal(result.ok,false,result.message);assert.equal(JSON.stringify(run),before);return result;}
function move(run,floor){run.floor=floor;run.floorsCleared=floor>0?99-floor:99+(-floor-1);run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=C.newAdventure();if(floor>0)run.chronicle=N.newChronicle(floor);P.advance(run,{reward:false});return run;}

test('six basic recipes stay available; seventeen advanced recipes require an actionable chef',()=>{
  const run=fresh();assert.equal(Object.values(P.RECIPES).filter(r=>!r.hidden&&!r.research).length,23);assert.equal(Object.values(P.RECIPES).filter(r=>r.requiresChef&&!r.hidden&&!r.research).length,17);assert.deepEqual(Object.keys(P.availableRecipes(run)),P.BASIC_RECIPES);
  for(const id of P.BASIC_RECIPES)assert.ok(P.cook(run,id).ok,id);
  for(const [id,r]of Object.entries(P.RECIPES).filter(([,r])=>r.requiresChef&&!r.requiredDepth)){unchanged(run,()=>P.cook(run,id,run.revision));assert.ok(!Object.hasOwn(P.availableRecipes(run),id));}
  const chef=companion(run,'chef');assert.equal(Object.keys(P.availableRecipes(run)).length,18);assert.ok(P.cook(run,'feast').ok);H.setHp(run,chef,0);assert.equal(P.recipeAvailable(run,'feast'),false);unchanged(run,()=>P.cook(run,'feast'));
});

test('chef may be leader or follower, but prepared advanced meals remain edible after leaving or falling',()=>{
  for(const hero of [true,false]){let run=fresh(hero?'chef':'swordsman');const id=hero?'hero':companion(run,'chef');run=ok(P.cook(run,'feast'));const count=run.party.meals.feast;assert.ok(count>=1);if(hero){const follower=companion(run,'swordsman');run=ok(H.switchActor(run,follower));H.setHp(run,'hero',0);}else run=ok(P.dismiss(run,id));assert.equal(P.recipeAvailable(run,'feast'),false);assert.ok(P.recipeUnlocked(run,'feast'));run=ok(P.eat(run,'feast'));assert.equal(run.party.meals.feast,count-1);}
});

test('camp maintenance restores 10 percent of maximum once per floor, excludes broken and stored gear',()=>{
  let run=fresh();const id=companion(run,'mage');[run]=stored(run,'heavy_helm');const worn=H.allGear(run).filter(g=>!run.gearBag.includes(g));for(const gear of worn)gear.durability=1;H.equipment(run,id).weapon.durability=0;const bag=run.gearBag[0];bag.durability=1;
  const before=structuredClone(run),quote=P.campMaintenanceQuote(run);assert.equal(quote.cost,6);assert.equal(P.CAMP_MAINTENANCE_RATIO,.1);assert.equal(quote.ratio,.1);assert.equal(quote.used,false);const result=P.camp(run,'repair',run.revision);assert.match(result.message,/最大耐久的10%/);run=ok(result);assert.equal(run.coins,before.coins-6);
  for(const gear of H.allGear(run)){const old=H.allGear(before).find(g=>g.id===gear.id),eligible=old.durability>0&&!before.gearBag.some(g=>g.id===old.id);assert.equal(gear.durability,eligible?Math.min(old.maxDurability,1+Math.ceil(old.maxDurability*.1)):old.durability);}
  assert.equal(P.campMaintenanceQuote(run).used,true);unchanged(run,()=>P.camp(run,'repair'));
});

test('maintenance cannot be reset by saving, maze seed changes, repeated advance, or side dungeon return',()=>{
  let run=fresh();run.equipment.weapon.durability=1;run=ok(P.camp(run,'repair'));run=C.validateSave(JSON.stringify(run));run.seed+=10;P.advance(run,{reward:false});assert.equal(P.campMaintenanceQuote(run).used,true);unchanged(run,()=>P.camp(run,'repair'));
  // Side dungeons use their parent floor; rebuilding its world cannot reset history.
  P.advance(run,{reward:false});assert.deepEqual(run.party.journey.maintenance,[99]);move(run,98);assert.equal(P.campMaintenanceQuote(run).used,false);run.equipment.weapon.durability=1;run=ok(P.camp(run,'repair'));assert.deepEqual(run.party.journey.maintenance,[99,98]);move(run,99);assert.equal(P.campMaintenanceQuote(run).used,true);
});

test('surface and underground maintenance histories do not collide, and legacy histories migrate without free resources',()=>{
  let run=fresh();run.equipment.weapon.durability=1;run=ok(P.camp(run,'repair'));move(run,1);run.chronicle.ending='keeper';run.chronicle.clues.push('clue:heart');run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push('monster-11');run.equipment.weapon.durability=1;run=ok(P.camp(run,'repair'));run=ok(C.descend(run));run=ok(C.startUnderworld(run));assert.equal(P.campMaintenanceQuote(run).used,false);run.equipment.weapon.durability=1;run=ok(P.camp(run,'repair'));assert.deepEqual(run.party.journey.maintenance,[99,1,-1]);assert.ok(C.validateSave(JSON.stringify(run)));
  const legacy=fresh();delete legacy.party.journey.maintenance;const migrated=C.validateSave(legacy);assert.deepEqual(migrated.party.journey.maintenance,[]);assert.equal(migrated.coins,legacy.coins);assert.deepEqual(migrated.equipment,legacy.equipment);
  for(const value of [null,{},[0],[100],[-51],[99,99],['99']]){const bad=fresh();bad.party.journey.maintenance=value;assert.equal(C.validateSave(bad),null);}
});

test('failed maintenance does not spend or consume the floor use, and camp ration-rest is removed',()=>{
  let run=fresh();unchanged(run,()=>P.camp(run,'repair'));assert.equal(P.campMaintenanceQuote(run).used,false);run.equipment.weapon.durability=1;run.coins=5;unchanged(run,()=>P.camp(run,'repair'));run.coins=99;unchanged(run,()=>P.camp(run,'repair',run.revision+1));assert.equal(P.campMaintenanceQuote(run).used,false);run.hp=10;run.bag.ration=3;unchanged(run,()=>P.camp(run,'rest'));run=ok(P.camp(run,'repair'));assert.equal(P.campMaintenanceQuote(run).used,true);
});

test('camp full repair, forge and dismantle all require an actionable smith, regardless of selected leader',()=>{
  let run=fresh();run.party.journey.scrap=50;run.equipment.weapon.durability=1;const id=run.equipment.weapon.id;for(const action of [()=>X.repair(run,id),()=>X.forge(run,id,'durable'),()=>X.dismantle(run,id)])unchanged(run,action);
  const smith=companion(run,'smith');assert.ok(X.repairQuote(run,id).allowed);assert.ok(X.forgeQuote(run,id,'durable').allowed);assert.ok(X.repair(run,id).ok);assert.ok(X.forge(run,id,'durable').ok);assert.ok(X.dismantle(run,id).ok);run=ok(H.switchActor(run,smith));assert.ok(X.repairQuote(run,id).allowed);run=ok(C.tickEffects(run,2));run=ok(H.switchActor(run,'hero'));H.setHp(run,smith,0);for(const action of [()=>X.repair(run,id),()=>X.forge(run,id,'durable'),()=>X.dismantle(run,id)])unchanged(run,action);
});

test('all 90 human equipment definitions, ten fixed robot parts and legacy items have exactly one specialist',()=>{
  assert.equal(Object.values(H.GEAR).filter(g=>!g.integrated&&!g.core).length,90);assert.equal(Object.values(H.GEAR).filter(g=>g.integrated).length,10);assert.equal(Object.values(H.GEAR).filter(g=>g.core).length,5);
  for(const kind of Object.keys(H.GEAR)){const merchants=Object.keys(E.MERCHANTS).filter(id=>E.merchantHandles(id,kind));assert.equal(merchants.length,1,kind);const owner=E.MERCHANT_SERVICES[merchants[0]],gear=H.GEAR[kind];if(gear.integrated||gear.core){assert.deepEqual(merchants,['tieLing']);assert.deepEqual(gear.jobs,['robot']);}else assert.ok(gear.slot===owner.slot||owner.weaponKinds.includes(gear.baseKind));}
  for(const kind of ['helmet','armor','shield','bat','pan','staff'])assert.equal(Object.keys(E.MERCHANTS).filter(id=>E.merchantHandles(id,kind)).length,1);
  for(const floor of [99,50,1,-1,-21,-50])for(let seed=1;seed<15;seed++)for(const shop of E.merchantOffers(floor,seed,true))for(const gear of shop.gear){assert.equal(E.merchantHandles(shop.id,gear.kind),true);assert.equal(H.GEAR[gear.kind].integrated,undefined,'fixed parts are serviced but never sold as loose equipment');}
  assert.equal(E.merchantHandles('__proto__','longsword'),false);assert.equal(E.merchantHandles('tieLing','unknown'),false);
});

test('specialists restore their damaged or broken gear without a party smith for the same quote plus 20 percent coins',()=>{
  for(const [merchantId,kind]of [['tieLing','longsword'],['jinHe','light_armor'],['lanZhou','arcane_staff']])for(const broken of [false,true]){let run=shopRun(merchantId);let gear;[run,gear]=stored(run,kind);gear.durability=broken?0:1;const service=E.serviceContext(run,merchantId),base=X.repairQuote(run,gear.id),q=X.repairQuote(run,gear.id,service),coins=run.coins,parts=run.party.journey.scrap;
    assert.equal(base.allowed,false);assert.ok(q.allowed);assert.equal(q.coins,Math.ceil(base.baseCoins*1.2));assert.equal(q.parts,base.parts);assert.equal(q.baseCoins,broken?Math.ceil(q.normalCoins*1.5):q.normalCoins);run=ok(X.repair(run,gear.id,run.revision,service));assert.equal(run.gearBag.find(g=>g.id===gear.id).durability,gear.maxDurability);assert.equal(run.coins,coins-q.coins);assert.equal(run.party.journey.scrap,parts-q.parts);assert.equal(P.campMaintenanceQuote(run).used,false);
  }
});

test('specialist forging consumes identical materials and 20 percent extra coins, with no invented profession discount',()=>{
  let run=shopRun('tieLing');const id=run.equipment.weapon.id,service=E.serviceContext(run,'tieLing'),base=X.forgeQuote(run,id,'durable'),q=X.forgeQuote(run,id,'durable',service);assert.equal(base.allowed,false);assert.ok(q.allowed);assert.equal(base.baseCoins,X.TRAITS.durable.coins);assert.equal(q.coins,Math.ceil(base.baseCoins*1.2));assert.deepEqual(q.materialCost,base.materialCost);assert.equal(q.parts,base.parts);const before=structuredClone(run);run=ok(X.forge(run,id,'durable',run.revision,service));assert.equal(run.coins,before.coins-q.coins);assert.equal(run.party.journey.scrap,before.party.journey.scrap-q.parts);for(const k of Object.keys(q.materialCost))assert.equal(run.party.journey.materials[k],before.party.journey.materials[k]-q.materialCost[k]);assert.equal(run.equipment.weapon.forge.level,1);
});

test('wrong specialist, absent shop, stale floor, changed seed, stale revision and missing resources fail atomically',()=>{
  let run=shopRun('tieLing');let gear;[run,gear]=stored(run,'light_armor');gear.durability=1;const service=E.serviceContext(run,'tieLing');for(const action of [()=>X.repair(run,gear.id,run.revision,service),()=>X.forge(run,gear.id,'durable',run.revision,service),()=>X.dismantle(run,gear.id,run.revision,service)])unchanged(run,action);
  const id=run.equipment.weapon.id;run.equipment.weapon.durability=1;for(const context of [{...service,floor:98},{...service,seed:run.seed+1},{...service,merchantId:'unknown'},{kind:'admin'},null])for(const action of [()=>X.repair(run,id,run.revision,context),()=>X.forge(run,id,'durable',run.revision,context),()=>X.dismantle(run,id,run.revision,context)])unchanged(run,action);
  unchanged(run,()=>X.repair(run,id,run.revision+1,service));unchanged(run,()=>X.forge(run,id,'durable',run.revision+1,service));run.coins=0;unchanged(run,()=>X.repair(run,id,run.revision,service));unchanged(run,()=>X.forge(run,id,'durable',run.revision,service));
});

test('paid smith repair remains unlimited by floor maintenance and preserves forge reserve',()=>{
  let run=fresh('smith');run.equipment.weapon.durability=1;run=ok(P.camp(run,'repair'));const id=run.equipment.weapon.id;run=ok(X.forge(run,id,'durable'));run.equipment.weapon.forge.reserve=0;
  for(let i=0;i<2;i++){run.equipment.weapon.durability=0;const quote=X.repairQuote(run,id);assert.equal(quote.coins,Math.ceil(quote.normalCoins*1.5));run=ok(X.repair(run,id,run.revision));assert.equal(run.equipment.weapon.durability,run.equipment.weapon.maxDurability);assert.equal(run.equipment.weapon.forge.reserve,0);assert.equal(P.campMaintenanceQuote(run).used,true);}
});
