import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js');
const fresh=(job='swordsman')=>P.enable(C.newRun({seed:31415,name:'遠征者'}),job).run;
function floor(run,f){run.floor=f;run.floorsCleared=99-f;run.chronicle=N.newChronicle(f);run.expedition=D.newExpedition();run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};P.advance(run);assert.ok(C.validateSave(run));return run;}
test('six professions upgrade once and preserve paid guard as one of three companions',()=>{
  assert.equal(Object.keys(P.PROFESSIONS).length,6);
  let old=C.newRun({seed:31415});old=C.hireWarrior(old,C.warriorOffer(99,old.seed).id).run;
  const before=JSON.stringify(old),next=P.enable(old,'chef');assert.equal(next.ok,true);assert.equal(JSON.stringify(old),before);
  assert.equal(next.run.party.members.length,1);assert.equal(next.run.party.members[0].profession,'swordsman');assert.equal(next.run.party.members[0].level,old.warrior.strength);assert.equal(next.run.warrior,null);
  for(const key of ['hp','coins','bag','equipment','chronicle','expedition','floor'])assert.deepEqual(next.run[key],old[key]);
  assert.equal(P.enable(next.run,'mage').ok,false);assert.equal(C.newRun().party,undefined);
});
test('party roundtrips and rejects malformed, duplicate, oversized or prototype-shaped state',()=>{
  const original=fresh();assert.deepEqual(C.validateSave(JSON.stringify(original)),original);
  const mutations=[r=>r.party.profession='admin',r=>r.party.ingredients.root=-1,r=>r.party.meals.stew=Infinity,r=>r.party.health=JSON.parse('{"__proto__":{"polluted":true}}'),r=>r.party.poise['constructor']=3,r=>r.party.boss={floor:90},r=>r.party.cooldown=31,r=>r.party.joined=['x','x']];
  for(const mutate of mutations){const r=structuredClone(original);mutate(r);assert.equal(C.validateSave(r),null);}
});
test('recruitment is deterministic, revision-checked, paid once, and capped at four total',()=>{
  let r=fresh();r.coins=200;for(const f of [99,97,95]){r=floor(r,f);const o=P.recruitOffer(r),rev=r.revision;assert.deepEqual(o,P.recruitOffer(r));const result=P.recruit(r,o.id,rev);assert.equal(result.ok,true);assert.equal(P.recruit(result.run,o.id,rev).ok,false);r=result.run;}
  assert.equal(r.party.members.length,3);r=floor(r,93);assert.equal(P.recruit(r,P.recruitOffer(r).id).ok,false);
  const id=r.party.members[0].id;r=P.dismiss(r,id).run;assert.equal(r.party.members.length,2);assert.ok(r.party.joined.includes(id));
  assert.equal(P.recruit(r,P.recruitOffer(r).id).ok,true);
});
test('eight recipes debit ingredients, give chef two portions, cap stacks and prevent stale spending',()=>{
  assert.equal(Object.keys(P.RECIPES).length,8);
  for(const id of Object.keys(P.RECIPES)){let r=fresh('chef');for(const k of Object.keys(r.party.ingredients))r.party.ingredients[k]=30;const before=structuredClone(r);const result=P.cook(r,id,r.revision);assert.equal(result.ok,true);assert.equal(result.run.party.meals[id],2);for(const[k,n]of Object.entries(P.RECIPES[id].cost))assert.equal(result.run.party.ingredients[k],30-n);assert.deepEqual(r,before);assert.equal(P.cook(result.run,id,r.revision).ok,false);result.run.party.meals[id]=99;assert.equal(P.cook(result.run,id).ok,false);}
  const r=fresh();r.party.ingredients.root=0;assert.equal(P.cook(r,'stew').ok,false);
});
test('food buffs refresh without stacking, expire after three descents and can revive companions',()=>{
  let r=fresh();r.party.meals={...r.party.meals,skewer:2,crab:1,salad:1,feast:1};r.hp=10;r.hunger=10;
  const o=P.recruitOffer(r);r=P.recruit(r,o.id).run;r.party.members[0].hp=0;
  for(const id of ['skewer','skewer','crab','salad'])r=P.eat(r,id).run;
  assert.deepEqual(r.party.buffs.map(b=>b.id),['guard','trail']);r=P.eat(r,'feast').run;assert.ok(r.party.members[0].hp>0);assert.equal(r.hp,57);
  P.advance(r);P.advance(r);assert.equal(r.party.buffs.length,2);P.advance(r);assert.equal(r.party.buffs.length,0);
});
test('gathered ingredients are part of existing floor loot and do not duplicate on reload',()=>{
  let r=fresh();const original=r.party.ingredients.root;r=P.gather(r,'s0','root').run;assert.equal(r.party.ingredients.root,original+1);r=C.validateSave(JSON.stringify(r));assert.equal(P.gather(r,'s0','root').ok,false);assert.equal(P.gather(r,'invalid','root').ok,false);
});
test('direct attacks wear weapon, have bounded stun and award monster ingredients only once',()=>{
  let r=floor(fresh(),84),spec=P.monsterSpecs(r)[0];assert.ok(spec);const durability=r.equipment.weapon.durability;
  let hit=P.strike(r,spec.id);assert.equal(hit.ok,true);assert.equal(hit.run.equipment.weapon?.durability??0,durability-1);assert.ok(hit.run.monsterStuns[spec.id]<=2);assert.ok(hit.effect.stunned);r=hit.run;
  hit=P.strike(r,spec.id);assert.equal(hit.effect.stunned,false);r=hit.run;
  for(let i=0;i<40&&!r.defeatedMonsters.includes(spec.id);i++){r=C.tickEffects(r,1).run;r=P.strike(r,spec.id).run;}
  assert.ok(r.defeatedMonsters.includes(spec.id));assert.equal(P.strike(r,spec.id).ok,false);assert.equal(r.party.health[spec.id],undefined);assert.ok(C.validateSave(r));
});
test('broken weapons allow unarmed finishing and monster HP survives save/reload',()=>{
  let r=floor(fresh('mage'),84);r.equipment.weapon=null;const spec=P.monsterSpecs(r)[0];r=P.strike(r,spec.id).run;assert.equal(r.party.health[spec.id],spec.maxHp-7);assert.deepEqual(C.validateSave(JSON.stringify(r)).party.health,r.party.health);assert.equal(r.monsterStuns[spec.id],undefined);
});
test('companion attacks respect cooldown, guard takes damage with two-second invulnerability',()=>{
  let r=fresh();r=P.recruit(r,P.recruitOffer(r).id).run;const id=r.party.members[0].id;r=floor(r,84);const spec=P.monsterSpecs(r)[0];r=P.strike(r,spec.id,{memberId:id}).run;assert.equal(P.strike(r,spec.id,{memberId:id}).ok,false);
  r=P.hurtMember(r,id,10).run;const hp=r.party.members[0].hp;r=P.hurtMember(r,id,10).run;assert.equal(r.party.members[0].hp,hp);r=C.tickEffects(r,2).run;r=P.hurtMember(r,id,10).run;assert.ok(r.party.members[0].hp<hp);
});
test('profession abilities require resources and persist cooldown; reductions do not affect hunger',()=>{
  for(const job of Object.keys(P.PROFESSIONS)){let r=fresh(job);r.hp=20;r.hunger=20;r.equipment.weapon.durability=1;const result=P.skill(r);assert.equal(result.ok,true,job);assert.ok(result.run.party.cooldown>0);assert.equal(P.skill(result.run).ok,false);assert.ok(C.validateSave(result.run));}
  let r=P.skill(fresh()).run;assert.equal(C.takeDamage(r,10).run.hp,55);assert.equal(C.takeDamage(r,10,'hunger').run.hp,50);
});
test('all floors keep timing formula and bounded deterministic nine-monster roster',()=>{
  const kinds=new Set();for(let f=99;f>=1;f--){const r=floor(fresh(),f),spec=P.monsterSpecs(r);assert.ok(spec.length<=6);assert.equal(C.floorConfig(f).shiftSeconds,150-(99-f));assert.deepEqual(spec,P.monsterSpecs(r));spec.forEach(m=>kinds.add(m.kind));if(f>84)assert.equal(spec.length,0);}assert.equal(Object.keys(P.defs()).length,9);assert.ok([...Object.keys(P.MONSTERS)].every(k=>kinds.has(k)));
});
test('90/80 maze bosses need telegraphed cycles and two seals; rewards are idempotent',()=>{
  for(const f of [90,80]){let r=floor(fresh(),f);assert.equal(P.canDescend(r),false);r=P.bossAction(r,0).run;assert.equal(P.bossPhase(r),'warning');assert.equal(P.bossAction(r,0).ok,false);r=C.tickEffects(r,9).run;assert.equal(P.bossPhase(r),'rest');
    for(let i=0;i<2;i++)for(let turn=0;turn<4&&!r.party.boss.seals[i];turn++){const result=P.bossAction(r,i);assert.equal(result.ok,true);r=result.run;}
    assert.equal(r.party.boss.done,true);assert.ok(P.canDescend(r));const money=r.coins;assert.equal(P.bossAction(r,1).ok,false);assert.equal(r.coins,money);assert.ok(C.validateSave(r));
  }
});
test('legacy saves and active dungeons keep old state; parent boss clock pauses in dungeon',()=>{
  assert.equal(C.validateSave(C.newRun()).party,undefined);let r=floor(fresh(),90);r=P.bossAction(r,0).run;const before=r.party.boss.clock;r.expedition.active={};P.tick(r,10);assert.equal(r.party.boss.clock,before);
});
