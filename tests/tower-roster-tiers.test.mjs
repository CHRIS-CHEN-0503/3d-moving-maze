import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),T=require('../lib/three.min.js');
const fresh=(job='swordsman',seed=43,sex='male')=>H.enable(P.enable(C.newRun({seed}),job,sex).run).run;
const floor=(r,f)=>{r.floor=f;r.floorsCleared=99-f;r.chronicle=N.newChronicle(f);P.advance(r);return r;};
test('18 gear types retain three surface tiers, requirements 1/3/5 and category-correct durability',()=>{
  assert.equal(Object.values(H.GEAR).filter(g=>!g.integrated&&!g.core).length,90);assert.equal(Object.values(H.GEAR).filter(g=>g.integrated).length,10);assert.equal(Object.values(H.GEAR).filter(g=>g.core).length,5);
  for(const base of H.BASE_GEAR){let strength=0;for(const tier of [1,2,3]){const d=H.GEAR[H.tierKind(base.kind,tier)];assert.equal(d.requiredLevel,[0,1,3,5][tier]);assert.equal(d.baseKind,base.kind);const power=d.damage+d.magicDamage+d.defense;assert.ok(power>strength);strength=power;assert.equal(C.durabilityMultiplier(d.kind),base.slot==='weapon'||base.type==='heavy'||['round_shield','tower_shield'].includes(base.kind)?20:40/3);const item=C.createGear(d.kind,49,43,'tiers');assert.ok(C.validateGear(item));}}
  assert.deepEqual(H.gearPool(99).map(k=>H.GEAR[k].tier),Array(18).fill(1));assert.equal(H.gearPool(60).length,36);assert.equal(H.gearPool(20).length,54);
});
test('equipment level gates reject without mutations and also validate active/inactive saved loadouts',()=>{
  for(const tier of [2,3]){let r=fresh();const gear=C.createGear(H.tierKind('longsword',tier),49,r.seed,'level');r=C.grantGear(r,gear).run;const before=JSON.stringify(r);assert.equal(H.equip(r,'hero',gear.id).ok,false);assert.equal(JSON.stringify(r),before);const bad=structuredClone(r);bad.gearBag=[];bad.equipment.weapon=gear;assert.equal(C.validateSave(bad),null);H.gainXp(r,G.XP[tier===2?2:4]);const result=H.equip(r,'hero',gear.id);assert.ok(result.ok);assert.ok(C.validateSave(result.run));}
});
test('recruit limits grow 1/2/3, preserve old larger parties, and random sex survives save loads',()=>{
  let r=fresh();r.coins=999;for(const [level,f]of [[1,99],[2,97],[3,95]]){floor(r,f);if(level>1)H.gainXp(r,G.XP[level-1]-H.state(r).xp);assert.equal(P.recruitLimit(r),level);r=P.recruit(r,P.recruitOffer(r).id).run;const denied=floor(structuredClone(r),f-2),offer=P.recruitOffer(denied);if(offer)assert.equal(P.recruit(denied,offer.id).ok,false);assert.deepEqual(C.validateSave(r),r);}
  H.state(r).level=1;H.state(r).xp=0;H.setHp(r,'hero',60);assert.ok(C.validateSave(r));assert.equal(r.party.members.length,3);
  const sexes=new Set();for(let seed=1;seed<=30;seed++){const offer=P.recruitOffer(fresh('chef',seed));sexes.add(offer.sex);assert.deepEqual(P.recruitOffer(fresh('chef',seed)),offer);}assert.deepEqual([...sexes].sort(),['female','male']);
});
test('every companion can choose exactly one new ordinary active or passive at level four',()=>{
  for(const category of ['active','passive']){let r=fresh('mage');r=P.recruit(r,P.recruitOffer(r).id).run;const id=r.party.members[0].id;assert.equal(H.canLearn(r,id),false);H.gainXp(r,G.XP[3]);assert.equal(H.canLearn(r,id),true);const a=H.actor(r,id),pool=category==='active'?H.SKILLS:H.PASSIVES,key=Object.keys(pool).find(k=>pool[k].job===H.job(r,id)&&!pool[k].unique&&![...a.skills,...a.passives].includes(k)),result=H.learnCompanion(r,id,key);assert.ok(result.ok);r=result.run;assert.equal(H.actor(r,id).learned,key);assert.equal(H.actor(r,id).skills.length+H.actor(r,id).passives.length,6);assert.equal(H.learnCompanion(r,id,key).ok,false);assert.deepEqual(C.validateSave(r),r);const tampered=structuredClone(r);H.actor(tampered,id).learned=null;assert.equal(C.validateSave(tampered),null);}
});
test('male/female appearances never change abilities or reroll skills; legacy identities remain fixed',()=>{
  for(const job of Object.keys(H.JOBS)){const male=fresh(job,43,'male'),female=fresh(job,43,'female');assert.deepEqual(H.stats(male),H.stats(female));assert.deepEqual(H.actor(male).skills,H.actor(female).skills);assert.equal(H.sex(C.validateSave(female)),'female');const old=structuredClone(male);delete old.party.sex;assert.equal(H.sex(C.validateSave(old)),P.PROFESSIONS[job].gender);}
  const c=vm.createContext({TowerHeroes:H,TowerPartyCore:P});vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),c);const portraits=new Set();for(const job of Object.keys(H.JOBS))for(const sex of ['male','female'])portraits.add(c.TowerHeroVisuals.portrait(job,sex));assert.equal(portraits.size,16);
});
test('staff/book physical damage is low; higher tiers strengthen spell damage and support',()=>{
  for(const job of ['mage','healer']){let r=fresh(job);H.gainXp(r,G.XP[4]);const base=H.stats(r);assert.ok(base.damage<5);assert.ok(base.spellDamage>base.damage);const kind=H.tierKind(H.JOBS[job].starter,3),gear=C.createGear(kind,49,r.seed,'magic');r=C.grantGear(r,gear).run;r=H.equip(r,'hero',gear.id).run;assert.ok(H.stats(r).spellDamage>base.spellDamage);assert.ok(H.stats(r).support>base.support);}
});
test('bow release consumes durability only once; impact requires a valid unexpired shot and does not restart recovery',()=>{
  let r=fresh('archer');const m=P.monsterSpecs(r)[0],before=r.equipment.weapon.durability;assert.equal(H.strike(r,m.id,{shot:true}).ok,false);let result=H.fireArrow(r,'hero',m.id);assert.ok(result.ok);r=result.run;assert.equal(r.equipment.weapon.durability,before-1);assert.equal(H.fireArrow(r,'hero',m.id).ok,false);H.tick(r,.3);const cooldown=H.actor(r).attack;result=H.strike(r,m.id,{shot:true});assert.ok(result.ok);assert.equal(H.actor(result.run).attack,cooldown);assert.equal(result.run.equipment.weapon.durability,before-1);assert.equal(H.strike(result.run,m.id,{shot:true}).ok,false);r=fresh('archer');r=H.fireArrow(r,'hero',P.monsterSpecs(r)[0].id).run;H.tick(r,2.1);assert.equal(H.actor(r).shot,null);assert.ok(C.validateSave(r));
});
test('new skill particles have no line geometry, obey visibility, and do not dispose shared sprite geometry',()=>{
  const c=vm.createContext({}),world=new T.Group();vm.runInContext(readFileSync(new URL('../story/tower-skill-effects.js',import.meta.url),'utf8'),c);const fx=c.TowerSkillEffects.create(T,{world:()=>world}),f=fx.emit({id:'innate-daylight',job:'mage',effect:'daylight'},{x:0,z:0});let sharedDisposed=0;f.group.traverse(o=>{assert.equal(!!o.isLine,false);assert.ok(!['RingGeometry','TorusGeometry'].includes(o.geometry?.type));if(o.isSprite)o.geometry.addEventListener('dispose',()=>sharedDisposed++);});for(const s of Object.values(H.SKILLS))fx.emit(s,{x:0,z:0});assert.ok(fx.stats().groups<=12);assert.ok(fx.stats().meshes<=96);fx.reset();assert.equal(sharedDisposed,0);assert.equal(world.children.length,0);
});
