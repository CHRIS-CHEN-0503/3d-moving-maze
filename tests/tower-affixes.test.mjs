import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),F=require('../story/tower-affixes.js');
const fresh=(job='smith',seed=31)=>H.enable(P.enable(C.newRun({seed,name:'附魔測試'}),job).run).run;
const valid=r=>assert.ok(C.validateSave(r));
test('six original icons and independent affixes validate without changing ordinary forge',()=>{let r=fresh();assert.equal(Object.keys(F.EFFECTS).length,6);for(const key of Object.keys(F.EFFECTS)){assert.match(F.svg(key),/^<svg/);r.equipment.weapon.affix={id:key,power:1};r.equipment.weapon.affixRoll=2;valid(r);assert.equal(C.validateSave(r).equipment.weapon.affix.id,key);}const bad=structuredClone(r);bad.equipment.weapon.affix.id='__proto__';assert.equal(C.validateSave(bad),null);});
test('quotes consume nothing; confirmed deterministic attempts cost once, preserve failures and reject stale revisions',()=>{let r=fresh();r.coins=1000;r.party.journey.materials.embercore=20;const id=r.equipment.weapon.id,before=JSON.stringify(r),q=F.quote(r,id,'burn');assert.ok(q.allowed&&q.affordable);assert.equal(JSON.stringify(r),before);const result=F.forge(r,id,'burn');assert.ok(result.ok,result.message);assert.equal(result.run.coins,r.coins-q.coins);assert.equal(result.run.party.journey.materials.embercore,18);assert.equal(result.run.equipment.weapon.affixRoll,1);assert.deepEqual(F.forge(r,id,'burn'),result);valid(result.run);assert.equal(F.forge(result.run,id,'burn',r.revision).ok,false);let failed;for(let seed=1;seed<100;seed++){const n=fresh('smith',seed);n.equipment.weapon.affix={id:'slow',power:1};n.coins=1000;n.party.journey.materials.embercore=2;const x=F.forge(n,n.equipment.weapon.id,'burn');if(!x.effect.affix){failed=x;break;}}assert.ok(failed);assert.equal(failed.run.equipment.weapon.affix.id,'slow');});
test('broken gear, wrong merchants, no smith, robot parts and surface-only restrictions do not charge',()=>{let r=fresh('mage');r.coins=999;r.party.journey.materials.embercore=9;const before=JSON.stringify(r);assert.equal(F.forge(r,r.equipment.weapon.id,'burn').ok,false);assert.equal(JSON.stringify(r),before);r=fresh();r.coins=999;r.party.journey.materials.starore=5;assert.equal(F.quote(r,r.equipment.weapon.id,'curse').allowed,false);r.equipment.weapon.durability=0;assert.equal(F.quote(r,r.equipment.weapon.id,'burn').allowed,false);r=fresh('robot');assert.equal(F.quote(r,r.equipment.weapon.id,'burn'),null);});
test('status duration survives save, paused clocks do not advance, refresh never stacks power',()=>{const r=fresh();assert.ok(F.apply(r,'hero','burn'));H.tick(r,1);assert.equal(F.has(r,'hero','burn').left,5);const reload=C.validateSave(r);assert.equal(F.has(reload,'hero','burn').left,5);const hp=H.hp(r,'hero');assert.equal(H.hp(reload,'hero'),hp);F.apply(r,'hero','burn');assert.equal(F.list(r,'hero').length,1);H.tick(r,2);assert.equal(H.hp(r,'hero'),hp-2);valid(r);});
test('defensive affix, ward, purification and one-use meals counter the same enemy status',()=>{const r=fresh();r.equipment.armor.affix={id:'burn',power:1};F.apply(r,'hero','burn');assert.equal(F.has(r,'hero','burn').left,3.9);F.clear(r,'hero');H.setBuff(r,'hero','ward',10,1);assert.equal(F.apply(r,'hero','poison'),false);H.setBuff(r,'hero','meal_burn',300,1);assert.equal(F.apply(r,'hero','burn'),false);assert.ok(F.apply(r,'hero','burn'));const healer=fresh('healer',1);H.actor(healer).skills=['cleanse','herbal_heal','light_bolt'];H.actor(healer).cooldowns={cleanse:0,herbal_heal:0,light_bolt:0};F.apply(healer,'hero','poison');const clean=H.cast(healer,'cleanse');assert.ok(clean.ok,clean.message);assert.equal(F.list(clean.run,'hero').length,0);valid(clean.run);});
test('ailment movement and offense are real, shock blocks attacks, invalid serialized states fail closed',()=>{const r=fresh(),st=H.stats(r).damage;F.apply(r,'hero','curse');assert.equal(H.stats(r).damage,st*.8);F.apply(r,'hero','slow');assert.equal(H.speed(r),.7);F.apply(r,'hero','shock');assert.equal(H.speed(r),0);assert.equal(H.strike(r,P.monsterSpecs(r)[0].id).ok,false);valid(r);for(const mutation of [n=>F.state(n).actors.hero[0].left=999,n=>F.state(n).actors.unknown=[],n=>F.state(n).enemies['monster-999']=[]]){const bad=structuredClone(r);mutation(bad);assert.equal(C.validateSave(bad),null);}});
test('ongoing effects finish kills and award loot/xp only once',()=>{const r=fresh(),m=P.monsterSpecs(r)[0];r.party.health[m.id]=1;F.apply(r,m.id,'burn',{enemy:true,owner:'hero'});const coins=r.coins;H.tick(r,2);assert.ok(r.defeatedMonsters.includes(m.id));assert.equal(r.coins,coins+8+m.strength*2);const xp=H.experience(r);H.tick(r,8);assert.equal(H.experience(r),xp);assert.equal(r.party.loot.rolled.filter(id=>id===m.id).length,1);valid(r);});
test('monster contact attaches only after real damage and cannot spam during invulnerability',()=>{let found;for(let seed=1;seed<100;seed++){const r=fresh('smith',seed),m=P.monsterSpecs(r).find(m=>m.kind==='mushroom');if(!m)continue;const hit=C.takeDamage(r,5,'monster',m.id);if(F.has(hit.run,'hero','poison')){found={run:hit.run,m};break;}}assert.ok(found);const {run,m}=found,before=JSON.stringify(F.list(run,'hero'));const immune=C.takeDamage(run,5,'monster',m.id);assert.equal(immune.effect.damage,0);assert.equal(JSON.stringify(F.list(immune.run,'hero')),before);valid(immune.run);});
test('malformed statuses cannot crash validation or make curse offense negative',()=>{
  const r=fresh();F.apply(r,'hero','curse');for(const change of [n=>F.state(n).actors.hero[0].power=8,n=>F.state(n).actors.hero[0]=null,n=>F.state(n).actors.hero[0].left=7]){const bad=structuredClone(r);change(bad);assert.equal(C.validateSave(bad),null);}
  assert.equal(F.quote(r,r.equipment.weapon.id,'burn',{kind:'invalid'}).allowed,false);
});
test('fractional damage clocks remain serializable through long runs and refreshes',()=>{
  const r=fresh(),m=P.monsterSpecs(r)[0],id=m.id,before=m.maxHp;r.party.health[id]=before;for(let i=0;i<40;i++){F.apply(r,id,'burn',{enemy:true,owner:'hero'});H.tick(r,.1);valid(r);}
  assert.ok(F.has(r,id,'burn',true).clock>=0);assert.equal(r.party.health[id],before-4);
});

test('simultaneous lethal enemy ailments stop immediately and leave a valid save with one reward',()=>{
  const r=fresh(),m=P.monsterSpecs(r)[0],coins=r.coins;r.party.health[m.id]=1;
  F.apply(r,m.id,'burn',{enemy:true,owner:'hero'});F.apply(r,m.id,'poison',{enemy:true,owner:'hero'});
  H.tick(r,2);assert.ok(r.defeatedMonsters.includes(m.id));assert.equal(r.party.health[m.id],undefined);assert.equal(F.state(r).enemies[m.id],undefined);
  assert.equal(r.coins,coins+8+m.strength*2);assert.equal(r.party.loot.rolled.filter(id=>id===m.id).length,1);const xp=H.experience(r);valid(r);
  H.tick(r,8);assert.equal(H.experience(r),xp);assert.equal(r.coins,coins+8+m.strength*2);valid(r);
});

test('periodic actor damage consumes shields without wearing equipment or granting contact immunity',()=>{
  const r=fresh(),before=H.hp(r,'hero'),gear=Object.values(r.equipment).filter(Boolean).map(g=>[g.id,g.durability]);
  H.setBuff(r,'hero','barrier',300,3);F.apply(r,'hero','poison');H.tick(r,2);
  assert.equal(H.hp(r,'hero'),before);assert.equal(H.buff(r,'barrier').power,1);assert.equal(H.actor(r).hurt,0);
  H.tick(r,2);assert.equal(H.hp(r,'hero'),before-1);assert.equal(H.buff(r,'barrier').power,0);
  assert.deepEqual(Object.values(r.equipment).filter(Boolean).map(g=>[g.id,g.durability]),gear);assert.equal(H.actor(r).hurt,0);valid(r);
  // Existing collision invulnerability does not stop an already-running poison.
  H.actor(r).hurt=2;H.hurt(r,'hero',2,'status');assert.equal(H.hp(r,'hero'),before-3);assert.equal(H.actor(r).hurt,2);valid(r);
});

test('lethal periodic damage uses feathers and then the same living-actor handoff as combat',()=>{
  const revived=fresh();H.setHp(revived,'hero',1);revived.bag.feather=1;F.apply(revived,'hero','poison');H.tick(revived,2);
  assert.equal(revived.bag.feather,0);assert.equal(H.hp(revived,'hero'),40);assert.equal(revived.status,'playing');valid(revived);
  const r=fresh(),member={id:'dot-survivor',profession:'mage',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};r.party.members.push(member);r.party.joined.push(member.id);H.addMember(r,member);
  const survivorGear=structuredClone(H.equipment(r,member.id));H.setHp(r,'hero',1);F.apply(r,'hero','burn');F.apply(r,'hero','poison');H.tick(r,2);
  assert.equal(H.hp(r,'hero'),0);assert.equal(H.state(r).active,member.id);assert.equal(r.hp,34);assert.deepEqual(r.equipment,survivorGear);assert.equal(F.state(r).actors.hero,undefined);assert.equal(r.status,'playing');valid(r);
  H.setHp(r,member.id,1);F.apply(r,member.id,'poison');H.tick(r,2);assert.equal(r.status,'dead');valid(r);
});

test('the last durable melee hit can proc an affix but subsequent bare-handed hits cannot',()=>{
  let found;
  for(let seed=1;seed<100;seed++){
    const r=fresh('smith',seed),m=P.monsterSpecs(r)[0];r.equipment.weapon.affix={id:'shock',power:1};r.equipment.weapon.durability=1;
    const hit=H.strike(r,m.id);if(hit.ok&&hit.run.equipment.weapon.durability===0&&F.has(hit.run,m.id,'shock',true)){found={run:hit.run,m};break;}
  }
  assert.ok(found,'a last legal hit retains its pre-wear attunement');let {run,m}=found;valid(run);delete F.state(run).enemies[m.id];H.tick(run,2);
  const next=H.strike(run,m.id);assert.ok(next.ok);assert.equal(next.effect.damage,3);assert.equal(F.has(next.run,m.id,'shock',true),null);valid(next.run);
  assert.equal(F.weaponHit(next.run,'hero',m),false,'direct proc calls also reject broken equipment');
});

test('last-durability ranged and paid skill attacks preserve launch attunement through save and impact',()=>{
  for(const job of ['mage','healer','archer']){
    let found;
    for(let seed=1;seed<100;seed++){
      const r=fresh(job,seed),m=P.monsterSpecs(r)[0];r.equipment.weapon.affix={id:'shock',power:1};r.equipment.weapon.durability=1;
      const fired=H.fireProjectile(r,'hero',m.id);assert.ok(fired.ok);assert.equal(fired.run.equipment.weapon.durability,0);
      const saved=C.validateSave(fired.run);assert.ok(saved);assert.equal(H.actor(saved).shot.attunement.id,'shock');
      saved.equipment.weapon.affix={id:'poison',power:1};const hit=H.strike(saved,m.id,{shot:true});
      if(hit.ok&&F.has(hit.run,m.id,'shock',true)){found=hit.run;break;}
    }
    assert.ok(found,job+' launch must not lose its last valid attunement');assert.equal(found.equipment.weapon.durability,0);valid(found);
  }
  let found;
  for(let seed=1;seed<100;seed++){
    const r=fresh('mage',seed),m=P.monsterSpecs(r)[0],skill=H.actor(r).skills.find(id=>H.SKILLS[id].attack);r.equipment.weapon.affix={id:'shock',power:1};r.equipment.weapon.durability=1;
    const cast=H.cast(r,skill);if(!cast.ok)continue;assert.equal(cast.run.equipment.weapon.durability,0);const saved=C.validateSave(cast.run);assert.ok(saved);
    const hit=H.strike(saved,m.id,{skillId:skill});if(hit.ok&&F.has(hit.run,m.id,'shock',true)){found=hit.run;break;}
  }
  assert.ok(found,'paid attack skill retains the pre-launch snapshot');valid(found);
});

test('serialized projectile attunements reject malformed snapshots without breaking old absent fields',()=>{
  const r=fresh('mage');r.equipment.weapon.affix={id:'burn',power:1};const fired=H.fireProjectile(r,'hero',P.monsterSpecs(r)[0].id);assert.ok(fired.ok);valid(fired.run);
  for(const mutate of [s=>s.power=4,s=>s.id='invalid',s=>s.weaponId='',s=>s.extra=1]){const bad=structuredClone(fired.run);mutate(H.actor(bad).shot.attunement);assert.equal(C.validateSave(bad),null);}
  const legacy=structuredClone(fired.run);delete H.actor(legacy).shot.attunement;valid(legacy);
});
