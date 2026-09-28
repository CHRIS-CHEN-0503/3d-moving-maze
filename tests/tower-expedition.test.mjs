import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js'),N=require('../story/tower-narrative.js');
function fresh(floor=99,job='swordsman',seed=31415){const r=P.enable(C.newRun({seed}),job).run;r.floor=floor;r.floorsCleared=99-floor;r.chronicle=N.newChronicle(floor);P.advance(r);return r;}
function complete(r){r=X.bossAction(r,0).run;const d=X.BOSSES[r.floor];for(let round=0;round<8&&!r.party.boss.done;round++)for(const t of [1,d.warning+d.strike+1]){r.party.boss.clock=round*d.cycle+t;for(let tries=0;tries<4;tries++)for(let i=0;i<d.count;i++){const result=X.bossAction(r,i);if(result.ok)r=result.run;}}return r;}
test('all ten boss floors are solvable by all six professions, preserve timing and pay once',()=>{
  assert.deepEqual(Object.keys(X.BOSSES).map(Number),[1,10,20,30,40,50,60,70,80,90]);
  for(const floor of Object.keys(X.BOSSES).map(Number))for(const job of Object.keys(P.PROFESSIONS)){
    const r=fresh(floor,job),coins=r.coins;assert.equal(P.canDescend(r),false);const done=complete(r);
    assert.equal(done.party.boss.done,true,`${floor}/${job}`);assert.equal(done.coins,coins+35);assert.equal(P.canDescend(done),true);assert.ok(C.validateSave(done));
    assert.equal(X.bossAction(done,0).ok,false);assert.equal(C.floorConfig(floor).shiftSeconds,150-(99-floor));
    assert.equal(C.descend(done).ok,false,'boss does not bypass main story mark / final choice');
    let marked=N.collectClue(done).run;if(floor===1)marked=N.chooseEnding(marked,'release').run;
    const next=C.descend(marked);assert.equal(next.ok,true,`exit ${floor}/${job}`);assert.ok(C.validateSave(next.run));
    if(floor===1)assert.equal(next.run.status,'won');else{assert.equal(next.run.floor,floor-1);assert.equal(next.run.party.journey.site.progress,0);}
  }
});
test('mechanisms enforce order, pressure warning, beacon turn, charge cycles and direction',()=>{
  let r=X.bossAction(fresh(70),0).run;r.party.boss.clock=9;assert.equal(X.bossAction(r,2).ok,false);assert.equal(X.bossAction(r,0).ok,true);
  r=X.bossAction(fresh(60),0).run;r.party.boss.clock=10;assert.equal(X.bossAction(r,0).ok,false);assert.equal(X.bossAction(r,2).ok,true);
  r=X.bossAction(fresh(50),0).run;assert.equal(X.bossAction(r,0).ok,false);assert.equal(X.bossAction(r,1).ok,true);r.party.boss.clock=10;assert.equal(X.bossAction(r,1).ok,false);
  r=X.bossAction(fresh(30),0).run;r.party.boss.clock=9;assert.equal(X.bossAction(r,1).ok,false);assert.equal(X.bossAction(r,0).ok,true);
  r=X.bossAction(fresh(20),0).run;r.party.boss.clock=10;r=X.bossAction(r,0).run;assert.equal(r.party.boss.charges[0],1);assert.equal(X.bossAction(r,0).ok,false);assert.equal(r.party.boss.seals[0],false);
  r=X.bossAction(fresh(40),0).run;r.party.boss.clock=9;r=X.bossAction(r,0).run;assert.equal(r.party.boss.angles[0],3);
});
test('telegraphs, hazard footprints and parent clocks respect phases, seals and dungeons',()=>{
  let r=X.bossAction(fresh(70),0).run;assert.equal(X.danger(r,0).active,false);r.party.boss.clock=5;assert.equal(X.danger(r,0).active,true);r.party.boss.seals[0]=true;assert.equal(X.danger(r,0).active,false);
  r.party.boss.clock=1605;assert.ok(X.danger(r,1).radius<=2.6);const time=r.party.boss.clock;r.expedition.active={};P.tick(r,10);assert.equal(r.party.boss.clock,time);
});
test('v1.37 party migration preserves every old resource and unfinished 90/80 seals',()=>{
  for(const f of [99,90,80,70,60,1]){
    const r=fresh(f,'scout');r.party.ingredients.nectar=7;r.party.journey.scrap=0;
    delete r.party.journey;
    if([90,80].includes(f)){r.party.boss.started=true;r.party.boss.seals[0]=true;delete r.party.boss.charges;delete r.party.boss.lastCycles;}
    else r.party.boss=null;
    const migrated=C.validateSave(r);assert.ok(migrated,String(f));assert.equal(migrated.party.ingredients.nectar,7);assert.equal(migrated.party.profession,'scout');assert.equal(migrated.floor,f);assert.deepEqual(migrated.equipment,r.equipment);
    if([90,80].includes(f))assert.equal(migrated.party.boss.seals[0],true);
    assert.deepEqual(C.validateSave(migrated),migrated);
  }
});
test('malformed journey, boss charge and forged gear fail closed',()=>{
  for(const change of [r=>r.party.journey.scrap=-1,r=>r.party.journey.site.done=true,r=>r.party.journey.site.progress=13,r=>r.party.boss=null,r=>r.party.boss.charges[0]=3,r=>r.party.boss.lastCycles[0]=10]){const r=fresh(20);change(r);assert.equal(C.validateSave(r),null);}
  for(const f of [{trait:'grip',level:1,reserve:0},{trait:'__proto__',level:1,reserve:0},{trait:'durable',level:3,reserve:6},{trait:'durable',level:1,reserve:3}]){const r=fresh();r.equipment.weapon.forge=f;assert.equal(C.validateSave(r),null);}
});
test('all six optional sites have profession and no-cost time alternatives; rewards never repeat',()=>{
  const seen=new Set();for(let seed=1;seed<60;seed++){
    let r=fresh(99,'swordsman',seed),site=X.siteOffer(r);seen.add(site.job);r.party.profession=site.job;
    const result=X.explore(r,site.id,'profession',r.revision);assert.equal(result.ok,true);assert.equal(result.run.party.journey.site.done,true);assert.equal(X.explore(result.run,site.id,'profession').ok,false);
    r=fresh(99,site.job==='mage'?'chef':'mage',seed);assert.equal(X.explore(r,site.id,'profession').ok,false);assert.equal(X.explore(r,site.id,'work').ok,false);
    r.party.journey.site.progress=12;assert.equal(X.explore(r,site.id,'work').ok,true);assert.equal(r.party.journey.site.done,false);assert.equal(X.siteOffer(fresh(90)),null);
  }assert.equal(seen.size,6);
});
test('forging is revision guarded, class-discounted, one immutable trait and two ranks only',()=>{
  let r=fresh(99,'smith');r.coins=100;r.party.journey.scrap=30;const id=r.equipment.weapon.id,rev=r.revision;
  r=X.forge(r,id,'durable',rev).run;assert.equal(r.coins,96);assert.equal(r.party.journey.scrap,27);assert.equal(X.forge(r,id,'durable',rev).ok,false);assert.equal(X.forge(r,id,'light').ok,false);
  r=X.forge(r,id,'durable').run;assert.equal(r.equipment.weapon.forge.level,2);assert.equal(X.forge(r,id,'durable').ok,false);assert.ok(C.validateSave(r));
  let other=fresh();other.coins=100;other.party.journey.scrap=30;other=X.forge(other,other.equipment.weapon.id,'light').run;assert.equal(other.coins,92);assert.ok(Math.abs(X.attackInterval(other)-.72)<1e-9);
});
test('durable gear consumes reserve first, repairs do not refill it; broken gear yields one scrap',()=>{
  let r=fresh(84,'smith');r.coins=100;r.party.journey.scrap=30;const id=r.equipment.weapon.id;r=X.forge(r,id,'durable').run;
  const g=r.equipment.weapon,before=g.durability;X.wear(r,g);X.wear(r,g);assert.equal(g.durability,before);assert.equal(g.forge.reserve,0);X.wear(r,g);assert.equal(g.durability,before-1);
  r=P.camp(r,'repair').run;assert.equal(r.equipment.weapon.forge.reserve,0);
  r.equipment.weapon.durability=1;const scrap=r.party.journey.scrap;r=P.strike(r,P.monsterSpecs(r)[0].id).run;assert.equal(r.equipment.weapon,null);assert.equal(r.party.journey.scrap,scrap+1);
});
test('armor traits cap movement and trap mitigation without changing hunger damage',()=>{
  const r=fresh();for(const kind of ['helmet','armor','shield']){const g=C.createGear(kind,99,4,kind);g.forge={trait:'light',level:2,reserve:0};r.equipment[kind]=g;}assert.equal(X.traits(r).speed,1.06);
  Object.values(r.equipment).filter(g=>g.slot!=='weapon').forEach(g=>g.forge={trait:'grip',level:2,reserve:0});assert.equal(X.traits(r).grip,4);assert.equal(P.reduceDamage(r,10,'trap'),6);assert.equal(P.reduceDamage(r,10,'hunger'),10);
  const g=r.equipment.helmet;g.forge={trait:'durable',level:1,reserve:2};C.applyDamage(r,30,'monster');assert.equal(g.forge.reserve,1);assert.ok(C.validateSave(r));
});
test('dismantling handles equipped and stored gear once, including stale confirmations',()=>{
  let r=fresh();const id=r.equipment.weapon.id,rev=r.revision,value=X.salvageValue(r.equipment.weapon);r=X.dismantle(r,id,rev).run;assert.equal(r.equipment.weapon,null);assert.equal(r.party.journey.scrap,value);assert.equal(X.dismantle(r,id).ok,false);assert.ok(C.validateSave(r));
  const g=C.createGear('helmet',99,1,'spare');r=C.grantGear(r,g).run;assert.ok(r);r=X.dismantle(r,g.id).run;assert.equal(r.gearBag.length,0);
});
test('names and browser loading order use the expansion without changing classic modes',()=>{
  assert.equal(P.PROFESSIONS.scout.name,'斥候');assert.equal(P.PROFESSIONS.smith.name,'鍛匠');assert.equal(C.newRun().party,undefined);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.indexOf('src="story/tower-expedition-core.js')<html.indexOf('src="story/tower-party-core.js'));
});
test('unambiguous older paid-guard conversion is repaired without granting a new companion',()=>{
  let old=C.newRun({seed:7});old=C.hireWarrior(old,C.warriorOffer(old.floor,old.seed).id).run;const id=old.warrior.offerId;
  const r=P.enable(old,'chef').run;delete r.party.journey;delete r.party.members[0].id;r.party.joined=[null];
  const repaired=C.validateSave(r);assert.ok(repaired);assert.equal(repaired.party.members[0].id,id);assert.equal(repaired.coins,old.coins);
  r.hiredWarriors=[];assert.equal(C.validateSave(r),null);
});
test('runtime save backs up v1.37 before upgrade and never overwrites it when backup fails',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');const save=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal'));
  const old=fresh(70);delete old.party.journey;old.party.boss=null;const raw=JSON.stringify(old),upgraded=C.validateSave(old),storage=new Map([['maze3d_tower_v1',raw]]);let fail=false;
  const context=vm.createContext({C,run:upgraded,SAVE:'maze3d_tower_v1',saveFailed:false,syncEngine(){},showToast(){},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(fail&&k.endsWith('_before_expedition2'))throw Error('full');storage.set(k,v);}}});vm.runInContext(save,context);
  fail=true;assert.equal(context.save(),false);assert.equal(storage.get('maze3d_tower_v1'),raw);
  fail=false;assert.equal(context.save(),true);assert.equal(storage.get('maze3d_tower_v1_before_expedition2'),raw);assert.ok(JSON.parse(storage.get('maze3d_tower_v1')).party.journey);
  context.run.party.journey.scrap=8;context.save();assert.equal(storage.get('maze3d_tower_v1_before_expedition2'),raw);
  storage.set('maze3d_tower_v1','invalid JSON');assert.equal(context.save(),true,'new game can replace unreadable old data');
});
