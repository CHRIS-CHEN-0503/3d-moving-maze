import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),X=require('../story/tower-expedition-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),I=require('../story/tower-forge-icons.js');
const ok=result=>{assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run),'valid saved transaction');return result.run;};
function smithCrew(run){if(!P.has(run,'smith')){const departed=run.party.travellers.find(t=>t.profession==='smith'),member={id:'forge-specialist:'+run.floor,profession:'smith',sex:departed?.sex==='male'?'female':'male',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(member);if(!run.party.joined.includes(member.id))run.party.joined.push(member.id);H.addMember(run,member);H.sync(run);}return run;}
const fresh=(job='swordsman')=>{const r=smithCrew(ok(H.enable(ok(P.enable(C.newRun({seed:31}),job)))));r.coins=1000;r.party.journey.scrap=99;for(const key of Object.keys(r.party.journey.materials))r.party.journey.materials[key]=99;return r;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function under(job='swordsman'){
  let r=fresh(job);r.floor=1;r.floorsCleared=98;r.chronicle=N.newChronicle(1);P.advance(r,{reward:false});r=ok(N.collectClue(r));r=ok(N.chooseEnding(r,'keeper'));r.party.boss.started=true;r.party.boss.done=true;r.party.boss.seals.fill(true);r.defeatedMonsters.push('monster-11');r=ok(C.descend(r));r=smithCrew(ok(C.startUnderworld(r)));r.coins=1000;r.party.journey.scrap=99;return r;
}
const forge=(r,id,trait)=>ok(X.forge(r,id,trait,r.revision));
function equip(r,kind){const gear=C.createGear(kind,r.floor,r.seed,'forge-test-'+kind);r=ok(C.grantGear(r,gear));return ok(H.equip(r,'hero',gear.id));}

test('seven original forge icons map one-to-one to options with two actual underground locks',()=>{
  assert.equal(Object.keys(X.TRAITS).length,7);assert.equal(I.ids.length,7);assert.equal(new Set(I.ids.map(I.svg)).size,7);
  for(const t of Object.values(X.TRAITS)){assert.match(I.svg(t.icon),/^<svg /);assert.equal(t.maxLevel,2);assert.ok(t.parts>0&&t.coins>0);}
  assert.deepEqual(Object.values(X.TRAITS).filter(t=>t.underground).map(t=>t.id),['starvein','abyssward']);
  const mage=fresh('mage'),q=X.forgeQuote(mage,mage.equipment.weapon.id,'starvein');assert.equal(q.allowed,false);assert.match(q.reason,/地下/);
  const snapshot=JSON.stringify(mage);assert.equal(X.forge(mage,mage.equipment.weapon.id,'starvein').ok,false);assert.equal(JSON.stringify(mage),snapshot);
  assert.ok(X.forgeOptions(mage,mage.equipment.weapon).some(q=>q.trait==='starvein'&&!q.allowed));
  assert.ok(!X.forgeOptions(mage,mage.equipment.weapon).some(q=>q.trait==='sharp'));
});

test('quotes and commits share exact parts, discount, immutable trait, two rank and revision checks',()=>{
  for(const [trait,job,kind]of [['sharp','swordsman','longsword'],['plated','swordsman','heavy_armor'],['starvein','mage','arcane_staff'],['abyssward','swordsman','heavy_armor']]){
    let r=under(job);if(r.equipment.weapon?.kind!==kind)r=equip(r,kind);const item=H.allGear(r).find(g=>g.kind===kind),start=r.revision;
    for(let rank=1;rank<=2;rank++){const q=X.forgeQuote(r,item.id,trait),coins=r.coins,parts=r.party.journey.scrap,materials={...r.party.journey.materials};assert.equal(q.level,rank);assert.equal(q.allowed,true);assert.equal(q.coins,Math.ceil(X.TRAITS[trait].coins*rank*(1-H.teamPassive(r,'economy')/100)));assert.deepEqual(q.materialCost,Object.fromEntries(Object.entries(X.TRAITS[trait].materialCost).map(([key,count])=>[key,count*rank])));r=forge(r,item.id,trait);assert.equal(r.coins,coins-q.coins);assert.equal(r.party.journey.scrap,parts-q.parts);for(const key of Object.keys(materials))assert.equal(r.party.journey.materials[key],materials[key]-(q.materialCost[key]||0));}
    assert.equal(X.forge(r,item.id,trait).ok,false);assert.equal(X.forge(r,item.id,'durable').ok,false);assert.equal(X.forge(r,item.id,trait,start).ok,false);
    assert.deepEqual(C.validateSave(r),r);
  }
  let r=under('mage');const before=JSON.stringify(r);r.party.journey.scrap=0;const insufficient=JSON.stringify(r);assert.equal(X.forge(r,r.equipment.weapon.id,'starvein').ok,false);assert.equal(JSON.stringify(r),insufficient);assert.notEqual(before,insufficient);
});

test('sharp increases physical stats and real basic-hit damage while forged gear retains durability',()=>{
  for(const job of ['swordsman','scout','chef','smith','archer']){
    const base=fresh(job),stat=H.stats(base);let r=forge(base,base.equipment.weapon.id,'sharp');near(H.stats(r).damage,stat.damage*1.08);r=forge(r,r.equipment.weapon.id,'sharp');near(H.stats(r).damage,stat.damage*1.16);near(H.stats(r).interval,stat.interval);
    assert.equal(r.equipment.weapon.maxDurability,base.equipment.weapon.maxDurability);
    const m=P.monsterSpecs(r)[0];if(job!=='archer'){const raw=H.strike(base,m.id),hit=H.strike(r,m.id);assert.ok(raw.ok&&hit.ok);assert.ok(hit.effect.damage>raw.effect.damage);assert.ok(C.validateSave(hit.run));}
    else{const raw=H.fireArrow(base,'hero',m.id),shot=H.fireArrow(r,'hero',m.id);assert.ok(raw.ok&&shot.ok);assert.ok(H.actor(shot.run).shot.damage>H.actor(raw.run).shot.damage);}
    r.equipment.weapon.durability=0;assert.equal(X.traitPower(r.equipment.weapon,'physicalPct'),0);assert.ok(C.validateSave(r));
  }
});

test('plated changes defense, actual monster damage and stops when a piece breaks',()=>{
  let base=equip(fresh(),'heavy_armor');base=equip(base,'heavy_helm');const stat=H.stats(base),id=base.equipment.armor.id;
  let r=forge(base,id,'plated');near(H.stats(r).armor,stat.armor+2);r=forge(r,id,'plated');near(H.stats(r).armor,stat.armor+4);
  const raw=structuredClone(base),enhanced=structuredClone(r);const normalHit=H.hurt(raw,'hero',30,'monster'),armoredHit=H.hurt(enhanced,'hero',30,'monster');assert.ok(armoredHit.effect.damage<normalHit.effect.damage);
  r.equipment.armor.durability=0;assert.equal(X.traitPower(r.equipment.armor,'defense'),0);assert.ok(C.validateSave(r));
});

test('underground starvein really boosts spell projectiles, healing and support with no physical bonus',()=>{
  for(const job of ['mage','healer']){
    let base=under(job);const stat=H.stats(base),id=base.equipment.weapon.id;let r=forge(base,id,'starvein');r=forge(r,id,'starvein');const after=H.stats(r);
    near(after.spellDamage,stat.spellDamage*1.24);near(after.support,stat.support+.1);near(after.heal,stat.heal+.1);near(after.damage,stat.damage);
    const normal=H.fireProjectile(base,'hero'),boosted=H.fireProjectile(r,'hero');assert.ok(normal.ok&&boosted.ok);assert.ok(H.actor(boosted.run).shot.damage>H.actor(normal.run).shot.damage);assert.ok(C.validateSave(boosted.run));
    if(job==='mage'){
      H.gainXp(base,G.XP[3]);H.gainXp(r,G.XP[3]);if(!H.actor(base).skills.includes('barrier'))base=ok(G.choose(base,'barrier'));if(!H.actor(r).skills.includes('barrier'))r=ok(G.choose(r,'barrier'));
      const plain=ok(H.cast(base,'barrier')),shielded=ok(H.cast(r,'barrier'));assert.ok(H.buff(shielded,'barrier').power>H.buff(plain,'barrier').power);assert.equal(H.buff(shielded,'barrier').left,300);
    }
  }
});

test('abyssward caps at four pre-mitigation damage and cannot erase a hit or affect traps and hunger',()=>{
  let base=under();for(const kind of ['heavy_armor','heavy_helm','round_shield'])base=equip(base,kind);
  let r=base;for(const slot of ['helmet','armor','shield']){r=forge(r,r.equipment[slot].id,'abyssward');r=forge(r,r.equipment[slot].id,'abyssward');}
  near(H.stats(r).armor,H.stats(base).armor);assert.equal(Object.values(r.equipment).reduce((s,g)=>s+X.traitPower(g,'monsterFlat'),0),6);
  for(const source of ['monster','trap','hunger']){
    const plain=structuredClone(base),armored=structuredClone(r);const a=H.hurt(plain,'hero',20,source),b=H.hurt(armored,'hero',20,source);
    if(source==='monster'){const expected=H.hurt(structuredClone(base),'hero',16,'monster');assert.equal(b.effect.damage,expected.effect.damage);assert.ok(b.effect.damage<a.effect.damage);}else assert.equal(b.effect.damage,a.effect.damage);
  }
  assert.equal(H.hurt(structuredClone(r),'hero',1,'monster').effect.damage,1);
  const bad=structuredClone(fresh());bad.gearBag.push(structuredClone(r.equipment.armor));assert.equal(C.validateSave(bad),null,'Underground-only treatment cannot be carried in a surface save');
});

test('save validation rejects mismatched weapon types, old traits retain exact behavior and repeat reload is stable',()=>{
  const sword=fresh(),invalid=structuredClone(sword);invalid.equipment.weapon.forge={trait:'starvein',level:1,reserve:0};assert.equal(C.validateSave(invalid),null);
  const staff=under('mage');staff.equipment.weapon.forge={trait:'sharp',level:1,reserve:0};assert.equal(C.validateSave(staff),null);
  for(const trait of ['durable','light','grip']){
    let r=equip(fresh(),'heavy_armor'),id=r.equipment.armor.id,q=X.forgeQuote(r,id,trait);assert.equal(q.parts,3);assert.equal(q.coins,Math.ceil(8*(1-H.teamPassive(r,'economy')/100)));r=forge(r,id,trait);r=forge(r,id,trait);const restored=C.validateSave(r);assert.deepEqual(restored,r);assert.deepEqual(C.validateSave(restored),restored);
    if(trait==='durable'){assert.equal(r.equipment.armor.forge.reserve,4);const dur=r.equipment.armor.durability;X.wear(r,r.equipment.armor);assert.equal(r.equipment.armor.durability,dur);assert.equal(r.equipment.armor.forge.reserve,3);}
  }
  const legacy=P.enable(C.newRun({seed:22}),'smith').run;assert.ok(X.forgeOptions(legacy,legacy.equipment.weapon).every(q=>['durable','light','grip'].includes(q.trait)));
});

test('workshop uses shared eligibility, quote and exact original icons for both selection and confirmation',()=>{
  const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
  assert.match(source,/choices=X\.forgeOptions\(run,g,forgeService\)/);assert.match(source,/TowerForgeIcons\?\.svg\(X\.TRAITS\[q\.trait\]\.icon\)/);
  assert.match(source,/q=X\.forgeQuote\(r\(\),gearId,trait,forgeService\)/);assert.match(source,/X\.forge\(r\(\),gearId,trait,pendingForge\.revision,pendingForge\.service\)/);
});

test('light armor accelerates its actual wearer, caps at six percent, and is not counted twice for the leader',()=>{
  let r=fresh();const member={id:'light-companion',profession:'swordsman',sex:'female',level:1,hp:30,cooldown:0,hurtLeft:0};
  r.party.members.push(member);r.party.joined.push(member.id);H.addMember(r,member);H.sync(r);assert.ok(C.validateSave(r));
  for(const id of H.ids(r))for(const kind of ['heavy_armor','heavy_helm']){
    const g=C.createGear(kind,r.floor,r.seed,'light-'+id+'-'+kind);r=ok(C.grantGear(r,g));r=ok(H.equip(r,id,g.id));
  }
  const base=Object.fromEntries(H.ids(r).map(id=>[id,H.speed(r,id)]));
  for(const id of H.ids(r)){
    const armor=H.equipment(r,id).armor.id,helmet=H.equipment(r,id).helmet.id;
    r=forge(r,armor,'light');near(H.speed(r,id),base[id]*1.03);
    r=forge(r,armor,'light');near(H.speed(r,id),base[id]*1.06);
    r=forge(r,helmet,'light');near(H.speed(r,id),base[id]*1.06);
  }
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),movement=source.match(/function movementScale\(\)\{[^\n]+\}/)[0];
  const playerSpeed=(run,modern)=>vm.runInNewContext(movement+'; movementScale();',{C,run,active:true,paused:false,G:{shifting:false},hazardSlow:1,modern:()=>modern,Heroes:H,window:{TowerExpedition:X}});
  near(playerSpeed(r,true),base.hero*1.06);
  const beforeSwitch=H.speed(r,member.id);r=ok(H.switchActor(r,member.id,r.revision));near(H.speed(r,member.id),beforeSwitch);near(playerSpeed(r,true),beforeSwitch);
  H.equipment(r,member.id).armor.durability=0;near(H.speed(r,member.id),base[member.id]*1.03);
  H.equipment(r,member.id).helmet.durability=0;near(H.speed(r,member.id),base[member.id]);assert.ok(C.validateSave(r));
  const legacy=P.enable(C.newRun({seed:23}),'smith').run;legacy.equipment.armor=C.createGear('armor',99,23,'legacy-light');legacy.equipment.armor.forge={trait:'light',level:2,reserve:0};
  assert.ok(C.validateSave(legacy));near(playerSpeed(legacy,false),1.06);
});
