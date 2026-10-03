import test from 'node:test';
import assert from 'node:assert/strict';
import {C,P,H,G,Co,fixture,add} from './tower-cooperation-fixtures.mjs';

test('eight read-only cooperative definitions preserve the seven original jobs and reuse real owned skill icons',()=>{
  assert.equal(Co.DEFINITIONS.length,8);assert.equal(Co.DEFINITIONS.filter(d=>d.underground&&d.participants.length===3).length,2);
  assert.deepEqual([...new Set(Co.DEFINITIONS.flatMap(d=>d.participants.map(p=>p.job)))].sort(),Object.keys(H.JOBS).filter(job=>job!=='robot').sort());
  for(const d of Co.DEFINITIONS){assert.ok(Object.isFrozen(d));assert.ok(Object.isFrozen(d.participants));assert.equal(d.iconKeys.length,d.participants.length);assert.ok(d.preparation>=.8&&d.cooldown<=55);for(const p of d.participants)assert.equal(H.SKILLS[p.skill].job,p.job);}
});
for(const d of Co.DEFINITIONS)test(d.name+' has atomic real skill costs, shared cooldowns and valid persistence',()=>{
  const {run,space,ids}=fixture(d.id),before=structuredClone(run),result=Co.cast(run,d.id,space,run.revision);
  assert.ok(Co.evaluate(run,d.id,space).ok);assert.ok(result.ok,result.message);assert.deepEqual(run,before);assert.equal(result.run.revision,run.revision+1);
  assert.equal(result.run.bag.arrow,run.bag.arrow-d.costs.arrows);for(const[k,n]of Object.entries(d.costs.ingredients))assert.equal(result.run.party.ingredients[k],run.party.ingredients[k]-n);
  for(let i=0;i<ids.length;i++)assert.ok(H.actor(result.run,ids[i]).cooldowns[d.participants[i].skill]>=d.cooldown);
  const restored=C.validateSave(JSON.stringify(result.run));assert.ok(restored);assert.equal(Co.cast(restored,d.id,space).ok,false);
  if(d.effect.shieldPercent)for(const id of ids)assert.ok(H.buff(restored,'barrier',id)?.left===300&&H.buff(restored,'barrier',id).power>=H.maxHp(restored,id)*d.effect.shieldPercent/100);
  if(d.effect.injured)assert.ok(ids.some(id=>H.hp(restored,id)>H.hp(run,id)));
  if(d.effect.attack){let damaged=restored;for(const cast of result.effect.casts.filter(c=>c.attack)){if(damaged.defeatedMonsters.includes(space.monsters[0].id))break;const hit=H.strike(damaged,space.monsters[0].id,{memberId:cast.actorId,skillId:cast.skill},damaged.revision);assert.ok(hit.ok,hit.message);assert.ok(hit.effect.damage>0);damaged=hit.run;}assert.ok(C.validateSave(damaged));}
});
test('unready, missing skills, downed, blocked, busy, damaged weapons and scarce resources do not mutate anything',()=>{
  for(const mutate of [f=>f.space.ready=false,f=>f.space.clear=()=>false,f=>f.space.positions[f.ids[1]].z=100,f=>f.space.blocked=[f.ids[1]],f=>H.setHp(f.run,f.ids[1],0),f=>H.actor(f.run,f.ids[1]).cooldowns.piercing_arrow=3,f=>H.actor(f.run,f.ids[1]).attack=1,f=>H.actor(f.run,f.ids[1]).hurt=1,f=>H.equipment(f.run,f.ids[1]).weapon.durability=0,f=>f.run.bag.arrow=0]){
    const f=fixture('cross_hunt');mutate(f);const before=structuredClone(f.run);assert.equal(Co.evaluate(f.run,'cross_hunt',f.space).ok,false);assert.equal(Co.cast(f.run,'cross_hunt',f.space).ok,false);assert.deepEqual(f.run,before);
  }
  const f=fixture('starforge_guard');f.run.party.ingredients.shell=0;const before=structuredClone(f.run);assert.equal(Co.cast(f.run,f.def.id,f.space).ok,false);assert.deepEqual(f.run,before);
});
test('front line and pincer really require relative positions, not just proximity',()=>{
  const front=fixture('forged_opening');assert.ok(Co.evaluate(front.run,front.def.id,front.space).ok);front.space.positions.hero.z=2;assert.equal(Co.evaluate(front.run,front.def.id,front.space).ok,false);
  const pincer=fixture('cross_hunt');assert.ok(Co.evaluate(pincer.run,pincer.def.id,pincer.space).ok);pincer.space.positions[pincer.ids[1]]={x:-.8,z:.8};assert.equal(Co.evaluate(pincer.run,pincer.def.id,pincer.space).ok,false);
});
test('duplicate-profession candidates choose a valid alternate, including blocked and distant first candidates',()=>{
  for(const kind of ['distant','formation','cooldown']){const f=fixture('thunder_blades'),id=add(f.run,'swordsman','wind_slash','other-sword');f.space.positions[id]={x:.5,z:1};
    if(kind==='distant')f.space.positions.hero={x:0,z:-4};if(kind==='formation'){f.space.positions.hero={x:0,z:-2};f.space.positions[f.ids[1]]={x:0,z:3};}if(kind==='cooldown')H.actor(f.run,'hero').cooldowns.wind_slash=2;
    const p=Co.evaluate(f.run,f.def.id,f.space);assert.ok(p.ok,kind+':'+p.message);assert.equal(p.members[0],id);
  }
});
test('underground triples cannot be invoked on the surface and party members are distinct',()=>{
  for(const d of Co.DEFINITIONS.filter(d=>d.underground)){const f=fixture(d.id,false);assert.equal(Co.cast(f.run,d.id,f.space).ok,false);}
  const f=fixture('dawn_breach');assert.equal(new Set(Co.evaluate(f.run,f.def.id,f.space).members).size,3);
});
test('healing offers require the advertised injured count and never revive or overfill',()=>{
  const f=fixture('warm_radiance');H.setHp(f.run,'hero',H.maxHp(f.run,'hero'));assert.equal(Co.evaluate(f.run,f.def.id,f.space).ok,false);
  H.setHp(f.run,'hero',H.maxHp(f.run,'hero')-1);H.setHp(f.run,f.ids[1],H.maxHp(f.run,f.ids[1])-1);const r=Co.cast(f.run,f.def.id,f.space);assert.ok(r.ok,r.message);for(const id of f.ids)assert.equal(H.hp(r.run,id),H.maxHp(r.run,id));
  const heal=fixture('forest_recovery'),id=add(heal.run,'smith','hammer_bash','downed');H.setHp(heal.run,id,0);heal.space.positions[id]={x:.3,z:.3};H.setBuff(heal.run,'hero','slow',5,.5);heal.run.party.slowLeft=3;
  const v=Co.cast(heal.run,heal.def.id,heal.space);assert.ok(v.ok,v.message);assert.equal(H.hp(v.run,id),0);assert.equal(H.buff(v.run,'slow','hero'),null);assert.equal(v.run.party.slowLeft,0);assert.ok(C.validateSave(v.run));
});
test('dead, unknown or wall-hidden targets never enable attack or accept arbitrary enemy IDs',()=>{
  for(const change of [f=>f.space.monsters[0].alive=false,f=>f.space.monsters[0].id='intruder',f=>f.space.clear=(a,b)=>b!==f.space.monsters[0],f=>f.space.monsters=[]]){const f=fixture('thunder_blades');change(f);assert.equal(Co.evaluate(f.run,f.def.id,f.space).ok,false);}
});
test('unknown and inherited object keys are rejected without throwing or consuming resources',()=>{
  const f=fixture('thunder_blades'),before=structuredClone(f.run);for(const key of ['missing','__proto__','constructor','toString']){assert.equal(Co.evaluate(f.run,key,f.space).ok,false);assert.equal(Co.cast(f.run,key,f.space).ok,false);}assert.deepEqual(f.run,before);
});
test('cooperative smoke preserves the original full five-metre area with valid living visible targets',()=>{
  const f=fixture('forest_recovery'),specs=P.monsterSpecs(f.run);assert.ok(specs.length>=5);
  f.space.monsters=specs.map((m,i)=>({id:m.id,alive:true,x:i*.1,z:1}));
  f.space.monsters.push({id:'intruder',alive:true,x:0,z:1});
  f.space.monsters.at(-2).alive=false;const deadId=f.space.monsters.at(-2).id;
  const blockedId=f.space.monsters.at(-3).id;f.space.clear=(a,b)=>b.id!==blockedId;
  const result=Co.cast(f.run,f.def.id,f.space);assert.ok(result.ok,result.message);
  const smoke=result.effect.casts.find(c=>c.kind==='smoke');assert.equal(smoke.targets.length,specs.length-2);assert.ok(smoke.targets.length>3);
  for(const id of smoke.targets)assert.ok(H.state(result.run).enemy[id].blind>0);for(const id of [deadId,blockedId,'intruder'])assert.equal(H.state(result.run).enemy[id],undefined);assert.ok(C.validateSave(result.run));
});
test('stale revision and invalid geometry preserve all resources and cooldowns',()=>{
  const f=fixture('warm_radiance'),snapshot=structuredClone(f.run);assert.equal(Co.cast(f.run,f.def.id,f.space,f.run.revision-1).ok,false);assert.deepEqual(f.run,snapshot);
  const bad=fixture('starforge_guard');bad.space.positions[bad.ids[1]].x=NaN;const before=structuredClone(bad.run);assert.equal(Co.cast(bad.run,bad.def.id,bad.space).ok,false);assert.deepEqual(bad.run,before);
});
test('successful combo persists only existing schema fields and is unavailable until skills recover',()=>{
  const f=fixture('leaf_return'),out=Co.cast(f.run,f.def.id,f.space);assert.ok(out.ok);assert.deepEqual(Object.keys(out.run).sort(),Object.keys(f.run).sort());assert.deepEqual(Object.keys(H.state(out.run)).sort(),Object.keys(H.state(f.run)).sort());
  let run=C.validateSave(out.run);assert.equal(Co.available(run,f.space).some(o=>o.definition.id===f.def.id),false);H.tick(run,60);run=C.validateSave(run);assert.ok(run);assert.ok(Co.evaluate(run,f.def.id,f.space).ok);
});
