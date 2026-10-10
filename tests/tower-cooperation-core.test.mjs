import test from 'node:test';
import assert from 'node:assert/strict';
import {C,P,H,G,Co,fixture,add} from './tower-cooperation-fixtures.mjs';
import F from '../story/tower-affixes.js';

test('twelve read-only cooperations retain the original eight and include all nine jobs with real owned skill icons',()=>{
  assert.equal(Co.DEFINITIONS.length,12);assert.equal(Co.DEFINITIONS.filter(d=>d.underground&&d.participants.length===3).length,3);
  assert.deepEqual(Co.DEFINITIONS.slice(0,8).map(d=>d.id),['thunder_blades','cross_hunt','forged_opening','warm_radiance','leaf_return','starforge_guard','dawn_breach','forest_recovery']);
  assert.deepEqual([...new Set(Co.DEFINITIONS.flatMap(d=>d.participants.map(p=>p.job)))].sort(),Object.keys(H.JOBS).sort());
  for(const d of Co.DEFINITIONS){assert.ok(Object.isFrozen(d));assert.ok(Object.isFrozen(d.participants));assert.equal(d.iconKeys.length,d.participants.length);assert.equal(d.preparation,d.participants.length===3?.9:.5);assert.ok(d.cooldown<=55);for(const p of d.participants)assert.equal(H.SKILLS[p.skill].job,p.job);}
});
for(const d of Co.DEFINITIONS)test(d.name+' has atomic real skill costs, shared cooldowns and valid persistence',()=>{
  const {run,space,ids}=fixture(d.id),before=structuredClone(run),result=Co.cast(run,d.id,space,run.revision);
  assert.ok(Co.evaluate(run,d.id,space).ok);assert.ok(result.ok,result.message);assert.deepEqual(run,before);assert.equal(result.run.revision,run.revision+1);
  assert.equal(result.run.bag.arrow,run.bag.arrow-d.costs.arrows);for(const[k,n]of Object.entries(d.costs.ingredients))assert.equal(result.run.party.ingredients[k],run.party.ingredients[k]-n);
  assert.equal(result.run.party.journey.scrap,run.party.journey.scrap-d.costs.scrap);
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

test('thunder fist amplifies both real attacks and preserves one-target, knockback and thunder poise rules',()=>{
  const f=fixture('thunder_fist'),out=Co.cast(f.run,f.def.id,f.space);assert.ok(out.ok,out.message);assert.equal(out.effect.targets.length,1);
  for(let i=0;i<f.ids.length;i++){const id=f.ids[i],key=f.def.participants[i].skill,solo=H.cast(f.run,key,{actorId:id,targetId:'hero',nearby:f.ids});assert.ok(solo.ok,solo.message);assert.equal(H.actor(out.run,id).pending.damage,H.actor(solo.run,id).pending.damage*1.25);}
  const fist=H.strike(out.run,f.space.monsters[0].id,{memberId:'hero',skillId:'flying_fist'});assert.ok(fist.ok);assert.equal(fist.effect.knockback,.8);assert.equal(H.strike(fist.run,f.space.monsters[0].id,{memberId:'hero',skillId:'flying_fist'}).ok,false);
  const shock=H.strike(fist.run,f.space.monsters[0].id,{memberId:f.ids[1],skillId:'thunder_wave'});assert.ok(shock.ok,shock.message);assert.ok(shock.effect.stunned||shock.effect.dead);assert.ok(C.validateSave(shock.run));
});

test('steel oath has real distinct self-guards and five-minute shields that reduce incoming damage',()=>{
  const f=fixture('steel_oath'),out=Co.cast(f.run,f.def.id,f.space);assert.ok(out.ok);
  assert.equal(H.buff(out.run,'robot_guard','hero').left,6);assert.equal(H.buff(out.run,'guard',f.ids[1]).left,8);assert.equal(H.speed(out.run,'hero'),.45);
  for(const id of f.ids){assert.equal(H.buff(out.run,'barrier',id).left,300);assert.ok(H.buff(out.run,'barrier',id).power>=H.maxHp(out.run,id)*.15);const baseline=structuredClone(f.run),protectedRun=structuredClone(out.run);assert.ok(H.hurt(protectedRun,id,40).effect.damage<H.hurt(baseline,id,40).effect.damage);}
  const retained=structuredClone(f.run);G.shield(retained,'hero',H.maxHp(retained,'hero')*.7);const repeat=Co.cast(retained,f.def.id,f.space);assert.ok(repeat.ok);assert.equal(H.buff(repeat.run,'barrier','hero').power,H.maxHp(retained,'hero')*.7);
});

test('underground reconstruction mechanically heals only its robot, repairs a real part and never fixes cores',()=>{
  const f=fixture('core_reconstruction'),robot='hero',smith=f.ids[1],gear=H.equipment(f.run,robot);gear.core1.durability=10;H.setHp(f.run,smith,1);const before=structuredClone(f.run),plan=Co.evaluate(f.run,f.def.id,f.space);assert.ok(plan.ok);assert.equal(plan.target,robot);
  assert.equal(H.heal(f.run,robot,10),0);assert.deepEqual(f.run,before);const out=Co.cast(f.run,f.def.id,f.space);assert.ok(out.ok,out.message);
  assert.equal(H.hp(out.run,robot),H.hp(before,robot)+G.power(before,robot,H.SKILLS.parts_restore)+H.maxHp(before,robot)*.12);assert.equal(H.hp(out.run,smith),1);assert.equal(H.equipment(out.run,robot).armor.durability,gear.armor.durability+Math.min(30,Math.ceil(gear.armor.maxDurability*H.SKILLS.repair.power[G.skillLevel(before,smith)-1]/100),gear.armor.maxDurability-gear.armor.durability));assert.equal(H.equipment(out.run,robot).core1.durability,10);
  assert.equal(out.run.party.journey.scrap,before.party.journey.scrap-1);assert.equal(out.run.party.ingredients.shell,before.party.ingredients.shell-1);assert.ok(H.buff(out.run,'ward',robot));assert.ok(C.validateSave(out.run));
});

test('reconstruction rejects full, downed, exhausted, core-only or broken-part robots without partial payment',()=>{
  for(const mutate of [f=>H.setHp(f.run,'hero',H.maxHp(f.run,'hero')),f=>H.setHp(f.run,'hero',0),f=>H.actor(f.run,'hero').robot.fuel=0,f=>{H.equipment(f.run,'hero').armor.durability=H.equipment(f.run,'hero').armor.maxDurability;H.equipment(f.run,'hero').core1.durability=10;},f=>H.equipment(f.run,'hero').armor.durability=0,f=>f.run.party.journey.scrap=0,f=>f.run.party.ingredients.shell=0]){const f=fixture('core_reconstruction');mutate(f);const before=structuredClone(f.run);assert.equal(Co.evaluate(f.run,f.def.id,f.space).ok,false);assert.equal(Co.cast(f.run,f.def.id,f.space).ok,false);assert.deepEqual(f.run,before);}
});

test('all three robot cooperations require fuel, owned skills, valid visible geometry and ready distinct actors',()=>{
  for(const key of ['thunder_fist','steel_oath','core_reconstruction'])for(const mutate of [f=>H.actor(f.run,'hero').robot.fuel=0,f=>f.space.clear=()=>false,f=>f.space.positions[f.ids[1]].x=20,f=>f.space.blocked=['hero'],f=>H.actor(f.run,'hero').cooldowns[f.def.participants[0].skill]=1]){const f=fixture(key);mutate(f);const before=structuredClone(f.run);assert.equal(Co.evaluate(f.run,key,f.space).ok,false);assert.equal(Co.cast(f.run,key,f.space).ok,false);assert.deepEqual(f.run,before);}
  for(const mutate of [f=>f.space.monsters[0].alive=false,f=>f.space.monsters[0].id='unknown',f=>f.space.monsters[0].z=3.6,f=>f.space.monsters=[],f=>f.run.defeatedMonsters.push(f.space.monsters[0].id)]){const f=fixture('thunder_fist');mutate(f);assert.equal(Co.evaluate(f.run,f.def.id,f.space).ok,false);}
});

test('organic support combinations choose a healable teammate even when a robot has the lowest life fraction',()=>{
  const f=fixture('warm_radiance'),robot=add(f.run,'robot','flying_fist','injured-machine');f.space.positions[robot]={x:.2,z:.1};H.setHp(f.run,robot,1);const plan=Co.evaluate(f.run,f.def.id,f.space);assert.ok(plan.ok);assert.notEqual(plan.target,robot);const out=Co.cast(f.run,f.def.id,f.space);assert.ok(out.ok,out.message);assert.equal(H.hp(out.run,robot),1);assert.ok(H.buff(out.run,'barrier',robot));assert.ok(C.validateSave(out.run));
});

test('regroup hints are only for distance, sight or formation failures and preserve the run',()=>{
  for(const [key,change]of [
    ['thunder_blades',f=>f.space.positions[f.ids[1]].x=10],
    ['thunder_blades',f=>f.space.clear=()=>false],
    ['forged_opening',f=>f.space.positions.hero.z=2],
    ['cross_hunt',f=>f.space.positions[f.ids[1]]={x:-.8,z:.8}],
    ['warm_radiance',f=>f.space.positions[f.ids[1]].x=10],
  ]){const f=fixture(key);change(f);const before=structuredClone(f.run);assert.equal(Co.evaluate(f.run,key,f.space).ok,false);const hint=Co.hints(f.run,f.space).find(v=>v.definition.id===key);assert.ok(hint,key);assert.deepEqual(hint.members,f.ids);assert.deepEqual(f.run,before);}
  const ready=fixture('thunder_blades');assert.equal(Co.hints(ready.run,ready.space).some(v=>v.definition.id===ready.def.id),false);
});

test('regroup hints exclude unavailable actors, equipment and resources even when distance also fails',()=>{
  for(const change of [
    f=>f.space.ready=false,f=>f.run.status='dead',f=>H.actor(f.run,f.ids[1]).skills.splice(H.actor(f.run,f.ids[1]).skills.indexOf('piercing_arrow'),1),
    f=>H.setHp(f.run,f.ids[1],0),f=>f.space.blocked=[f.ids[1]],f=>H.actor(f.run,f.ids[1]).cooldowns.piercing_arrow=3,
    f=>H.actor(f.run,f.ids[1]).attack=1,f=>H.actor(f.run,f.ids[1]).hurt=1,f=>H.actor(f.run,f.ids[1]).pending={id:'piercing_arrow'},
    f=>H.actor(f.run,f.ids[1]).shot={kind:'arrow'},f=>H.equipment(f.run,f.ids[1]).weapon.durability=0,f=>f.run.bag.arrow=0,
    f=>F.apply(f.run,f.ids[1],'shock'),f=>f.space.positions[f.ids[1]].x=NaN,
  ]){const f=fixture('cross_hunt');f.space.positions[f.ids[1]].x=10;change(f);const before=structuredClone(f.run);assert.equal(Co.hints(f.run,f.space).some(v=>v.definition.id===f.def.id),false);assert.deepEqual(f.run,before);}
  for(const [key,change]of [['starforge_guard',f=>f.run.party.ingredients.shell=0],['core_reconstruction',f=>f.run.party.journey.scrap=0],['thunder_fist',f=>H.actor(f.run,'hero').robot.fuel=0]]){const f=fixture(key);f.space.positions[f.ids[1]].x=10;change(f);assert.equal(Co.hints(f.run,f.space).some(v=>v.definition.id===key),false,key);}
  const alternate=fixture('thunder_blades');H.actor(alternate.run,'hero').cooldowns.wind_slash=3;const id=add(alternate.run,'swordsman','wind_slash','ready-sword');alternate.space.positions[id]={x:10,z:0};const hint=Co.hints(alternate.run,alternate.space).find(v=>v.definition.id===alternate.def.id);assert.ok(hint);assert.equal(hint.members[0],id);
});

test('regroup hints require a real living enemy or a healable and repairable target',()=>{
  for(const change of [f=>f.space.monsters=[],f=>f.space.monsters[0].alive=false,f=>f.space.monsters[0].id='intruder',f=>f.run.defeatedMonsters.push(f.space.monsters[0].id)]){const f=fixture('thunder_blades');f.space.positions[f.ids[1]].x=10;change(f);assert.equal(Co.hints(f.run,f.space).some(v=>v.definition.id===f.def.id),false);}
  const full=fixture('warm_radiance');full.space.positions[full.ids[1]].x=10;for(const id of full.ids)H.setHp(full.run,id,H.maxHp(full.run,id));assert.equal(Co.hints(full.run,full.space).some(v=>v.definition.id===full.def.id),false);
  H.setHp(full.run,'hero',H.maxHp(full.run,'hero')-1);assert.equal(Co.hints(full.run,full.space).some(v=>v.definition.id===full.def.id),false,'one injured teammate cannot satisfy a two-person meal');
  for(const change of [f=>H.setHp(f.run,'hero',H.maxHp(f.run,'hero')),f=>H.equipment(f.run,'hero').armor.durability=H.equipment(f.run,'hero').armor.maxDurability,f=>H.equipment(f.run,'hero').armor.durability=0]){const f=fixture('core_reconstruction');f.space.positions[f.ids[1]].x=10;change(f);assert.equal(Co.hints(f.run,f.space).some(v=>v.definition.id===f.def.id),false);}
});
