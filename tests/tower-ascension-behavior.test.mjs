import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {provisionTravellers} from './recruit-fixtures.mjs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),B=require('../story/tower-floor-lords.js'),A=require('../story/tower-ascension-catalog.js');
const expectOk=result=>{assert.ok(result.ok,result.message);assert.ok(C.validateSave(JSON.stringify(result.run)),'action must produce a valid save');return result.run;};
const fresh=(job,seed=31)=>expectOk(H.enable(expectOk(P.enable(C.newRun({seed,name:'進階實測'}),job))));
const approx=(value,wanted)=>assert.ok(Math.abs(value-wanted)<1e-7,`${value} != ${wanted}`);
// Fixture supplies the completed world checkpoint, not a forged character:
// every actor, skill, level, awakening and continuation is earned through APIs.
function underground(job,seed=31){
  let r=fresh(job,seed);r.floor=1;r.floorsCleared=98;r.chronicle=N.newChronicle(1);P.advance(r,{reward:false});
  r=expectOk(N.collectClue(r));r=expectOk(N.chooseEnding(r,'keeper'));
  r.party.boss.started=true;r.party.boss.done=true;r.party.boss.seals.fill(true);r.defeatedMonsters.push(B.spec(r).id);
  r=expectOk(C.descend(r));return expectOk(C.startUnderworld(r));
}
function companion(job,desired=job){for(let seed=1;seed<=300;seed++){
  let r=underground(job,seed),offer=P.recruitOffer(r);if(offer?.profession!==desired)continue;r.coins=1000;provisionTravellers(r);return expectOk(P.recruit(r,offer.id));
}throw Error('No recruit fixture for '+desired);}
function awaken(base,level=12,withCompanion=false){
  const b=A.BRANCHES[base];let r=withCompanion?companion(b.job):underground(b.job);
  H.gainXp(r,G.XP[9]);assert.equal(G.availableUltimate(r),true);r=expectOk(G.chooseUltimate(r,'hero',base));
  H.gainXp(r,G.XP[level-1]-H.experience(r,'hero'));assert.equal(H.level(r,'hero'),level);assert.ok(C.validateSave(r));return r;
}
function supply(r){for(const k of Object.keys(r.party.ingredients))r.party.ingredients[k]=30;r.party.journey.scrap=20;r.bag.arrow=99;r.hunger=10;return r;}
function bossArena(r){while(r.floor>-10)r=expectOk(C.descend(r));const m=P.monsterSpecs(r).find(m=>m.lord);assert.ok(m);return {run:r,id:m.id};}
function cast(r,key,options={}){const result=H.cast(r,key,options);expectOk(result);return result;}
function targetFor(r,s){if(s.effect==='revive'){const id=r.party.members[0].id;H.setHp(r,id,0);return id;}if(s.effect==='soup')H.setHp(r,'hero',1);if(s.effect==='repair'){const g=H.equipment(r,'hero').weapon,wanted=Math.max(1,g.maxDurability-20);for(let i=0;i<200&&g.durability>wanted;i++)H.wear(r,'hero',g);assert.ok(g.durability<g.maxDurability);}return 'hero';}

test('all 14 underground branches earn only their own skills at 12 and 15 and survive save reload',()=>{
  for(const b of Object.values(A.BRANCHES)){
    let r=awaken(b.id,12);assert.ok(H.actor(r).skills.includes(b.steps[0].id));assert.ok(!H.actor(r).passives.includes(b.steps[1].id));
    assert.equal(G.chooseUltimate(r,'hero',A.BY_JOB[b.job][b.kind==='active'?'passive':'active'].id).ok,false);
    H.gainXp(r,G.XP[14]-H.experience(r));r=C.validateSave(JSON.stringify(r));assert.ok(r,b.id);assert.equal(H.level(r),15);
    assert.ok(H.actor(r).passives.includes(b.steps[1].id));
    for(const s of [...A.actives,...A.passives])assert.equal([...H.actor(r).skills,...H.actor(r).passives].includes(s.id),s.ascension.base===b.id,s.id);
    const snapshot=JSON.stringify(r);H.gainXp(r,1);assert.equal(JSON.stringify(r),snapshot,'reaching cap cannot grant duplicates');
  }
});

test('surface retains level-ten deterministic awakening, never offers choice or underground skills',()=>{
  for(const job of Object.keys(H.JOBS)){
    const r=fresh(job);H.gainXp(r,100000);assert.equal(H.level(r),10);assert.ok(G.state(r).awakening);assert.equal(G.availableUltimate(r),false);
    for(const s of A.forJob(job).flatMap(b=>A.earned(b.id,15))){assert.equal(G.choose(r,s.id).ok,false);assert.equal(H.cast(r,s.id).ok,false);assert.ok(![...H.actor(r).skills,...H.actor(r).passives].includes(s.id));}
    assert.ok(C.validateSave(r));
  }
});

test('every level-twelve active is castable through actual progression; its mastery changes power and cooldown at fifteen',()=>{
  for(const s of A.actives)for(const level of [12,15]){
    let r=supply(awaken(s.ascension.base,level,s.effect==='revive'));const target=targetFor(r,s),before=H.hp(r,target),gear=H.equipment(r,target).weapon,durability=gear?.durability;
    const result=cast(r,s.id,{targetId:target}),n=result.run,m=level===15?A.PASSIVES[A.BRANCHES[s.ascension.base].steps[1].id].modifiers:{powerPct:0,cooldownPct:0},power=s.power[5]*(1+m.powerPct/100);
    approx(result.effect.power,power);approx(H.actor(n).cooldowns[s.id],s.cooldown*(1-H.pv(n,'recovery')/100)*(1-m.cooldownPct/100));
    if(s.attack)assert.equal(H.actor(n).pending.id,s.id);
    if(s.effect==='speed'){approx(H.buff(n,'speed').power,power);assert.equal(H.buff(n,'speed').left,20);}
    if(s.effect==='ward'){approx(H.buff(n,'ward').left,power*(1+H.stats(n).support));assert.equal(H.buff(n,'ward').power,1);}
    if(s.effect==='fortify'){approx(H.buff(n,'fortify').power,power);assert.equal(H.buff(n,'fortify').left,30);}
    if(s.effect==='barrier'){assert.equal(H.buff(n,'barrier').left,300);assert.ok(H.buff(n,'barrier').power>=power);}
    if(s.effect==='revive')assert.equal(H.hp(n,target),Math.ceil(H.maxHp(n,target)*power/100));
    if(s.effect==='soup')assert.ok(H.hp(n,target)>before);
    if(s.effect==='repair')approx(H.equipment(n,target).weapon.durability,Math.min(gear.maxDurability,durability+power));
    if(s.job==='archer')assert.equal(n.bag.arrow,r.bag.arrow-(s.effect==='volley'?3:1));
    assert.equal(H.cast(n,s.id,{targetId:target}).ok,false,'cooldown/recovery prevents immediate reuse');
  }
});

test('offensive continuations really apply their declared stun, root, slow and mark rather than only text',()=>{
  for(const s of A.actives.filter(s=>s.attack)){
    let {run:r,id}=bossArena(supply(awaken(s.ascension.base,12)));r=cast(r,s.id).run;
    const result=H.strike(r,id,{skillId:s.id});r=expectOk(result);assert.ok(result.effect.damage>0,s.id);assert.equal(result.effect.dead,false,s.id+' fixture must survive');
    const state=H.state(r).enemy[id];
    if(s.params?.stunSeconds){approx(r.monsterStuns[id],s.params.stunSeconds);assert.equal(result.effect.stunned,true);}
    if(s.params?.slowSeconds){approx(state.slow,s.params.slowSeconds);approx(state.slowPower,s.params.slowPower);}
    if(s.params?.rootSeconds){approx(state.root,s.params.rootSeconds);assert.equal(result.effect.rooted,true);}
    if(s.params?.markSeconds)approx(state.mark,s.params.markSeconds);
    assert.equal(H.strike(r,id,{skillId:s.id}).ok,false,'same cast cannot hit the same monster twice');
  }
});

test('mastered fortress, feast, sanctuary, wards and imprints have actual boosted effects',()=>{
  let r=supply(awaken('moving_fortress',15));r=cast(r,'moving_fortress').run;
  approx(H.buff(r,'barrier').power,H.maxHp(r)*1.25);assert.equal(H.buff(r,'fortify').power,5);assert.equal(H.buff(r,'fortress').left,15);assert.equal(H.buff(r,'barrier').left,300);
  r=supply(awaken('hero_feast',15));H.setHp(r,'hero',1);r=cast(r,'hero_feast').run;
  approx(r.hunger,10+35*1.25);approx(H.buff(r,'rally').power,15*1.25);approx(H.buff(r,'regen').power,H.maxHp(r)*.02*1.25*1.28);assert.equal(H.buff(r,'regen').left,10);
  r=supply(awaken('dawn_sanctuary',15,true));const ally=r.party.members[0].id;H.setHp(r,ally,0);r=cast(r,'dawn_sanctuary',{targetId:'hero'}).run;
  approx(H.hp(r,ally),H.maxHp(r,ally)*.3*1.25);assert.equal(H.buff(r,'sanctuary').left,10);
  r=supply(awaken('life_covenant',15));r=cast(r,'covenant_ward').run;assert.equal(H.inflict(r,'hero','slow',5,.3),false);assert.equal(H.inflict(r,'hero','slow',5,.3),true,'only one state is blocked');assert.ok(C.validateSave(r));
  r=supply(awaken('artisan_soul',15));const weapon=H.equipment(r).weapon,baseDamage=H.stats(r).damage;r=expectOk(G.imprint(r,'hero',weapon.id,true));
  const mark=G.imprintFor(r,'hero',H.equipment(r).weapon);assert.equal(mark.left,Math.ceil(weapon.maxDurability*.26));assert.equal(mark.boost,1.3);assert.ok(H.stats(r).damage>baseDamage);
  const left=mark.left,original=H.equipment(r).weapon.durability;H.wear(r,'hero',H.equipment(r).weapon);assert.equal(H.equipment(r).weapon.durability,original);assert.equal(mark.left,left-1);assert.ok(C.validateSave(r));
});

test('hero and companion keep independent awakening choices, rescue counters and taste records',()=>{
  for(const base of ['unyielding','life_covenant','many_flavors']){
    let r=supply(awaken(base,15,true)),id=r.party.members[0].id;r=expectOk(G.chooseUltimate(r,id,base));
    assert.equal(H.level(r,id),10);assert.equal(G.record(r,id).awakening,base);assert.equal(A.earned(base,15).some(s=>[...H.actor(r,id).skills,...H.actor(r,id).passives].includes(s.id)),false);
    if(base==='unyielding'){
      H.setHp(r,'hero',20);H.hurt(r,'hero',1);assert.equal(G.record(r).defiance,72);assert.equal(G.record(r,id).defiance,0);approx(H.buff(r,'oath_power').power,32.5);
      H.setHp(r,id,20);H.hurt(r,id,1);assert.equal(G.record(r,id).defiance,90);assert.equal(G.record(r).defiance,72);approx(H.buff(r,'oath_power',id).power,25);
    }else if(base==='life_covenant'){
      H.hurt(r,'hero',1000);assert.equal(H.hp(r,'hero'),1);assert.equal(G.record(r).covenant,144);assert.equal(G.record(r,id).covenant,0);
      H.hurt(r,id,1000);assert.equal(H.hp(r,id),1);assert.equal(G.record(r,id).covenant,180);assert.equal(G.record(r).covenant,144);
    }else{
      H.setHp(r,id,0);r.party.meals.stew=1;r.party.meals.broth=2;r=expectOk(P.eat(r,'stew'));r=expectOk(P.eat(r,'broth'));
      assert.equal(G.record(r).tasteLeft,72);assert.equal(G.record(r,id).tasteLeft,0);assert.deepEqual(G.record(r,id).tastes,[]);
      H.setHp(r,id,1);r=expectOk(P.eat(r,'broth'));assert.deepEqual(G.record(r,id).tastes,['broth']);assert.equal(G.record(r).tasteLeft,72);
    }
    assert.deepEqual(C.validateSave(JSON.stringify(r)),r);
  }
});

test('companion AI may use its chosen ultimate but honors materials and action strategy',()=>{
  let r=supply(awaken('moving_fortress',15,true)),id=r.party.members[0].id;r=expectOk(G.chooseUltimate(r,id,'moving_fortress'));r=expectOk(G.setStrategy(r,id,'support'));
  G.state(r).policies[id].materials=false;assert.notEqual(G.aiChoice(r,id,H.ids(r),true)?.skill,'moving_fortress');
  G.state(r).policies[id].materials=true;assert.equal(G.aiChoice(r,id,H.ids(r),true)?.skill,'moving_fortress');
  r=cast(r,'moving_fortress',{actorId:id,nearby:H.ids(r)}).run;assert.equal(H.buff(r,'fortify',id).power,4,'companion did not inherit hero mastery');assert.notEqual(G.aiChoice(r,id,H.ids(r),true)?.skill,'moving_fortress');
  assert.ok(C.validateSave(r));
});

test('twin-star echoes count actual casts per actor and are not shared with a companion or area targets',()=>{
  let r=supply(awaken('twin_stars',15,true)),ally=r.party.members[0].id;r=expectOk(G.chooseUltimate(r,ally,'twin_stars'));r=bossArena(r).run;
  for(let i=1;i<=3;i++){
    H.tick(r,120);r=cast(r,'prism_resonance').run;const targets=P.monsterSpecs(r).filter(m=>!r.defeatedMonsters.includes(m.id)).sort((a,b)=>b.maxHp-a.maxHp);
    let result=H.strike(r,targets[0].id,{skillId:'prism_resonance'});r=expectOk(result);
    assert.equal(G.record(r).echo,i%3);assert.equal(G.record(r,ally).echo,0);assert.equal(H.actor(r).pending.echo,i===3);
    result=H.strike(r,targets[1].id,{skillId:'prism_resonance'});r=expectOk(result);assert.equal(G.record(r).echo,i%3,'area victims do not count as new casts');
  }
  const attack=H.actor(r,ally).skills.find(key=>H.SKILLS[key].attack),target=P.monsterSpecs(r).find(m=>!r.defeatedMonsters.includes(m.id));
  r=cast(r,attack,{actorId:ally}).run;r=expectOk(H.strike(r,target.id,{memberId:ally,skillId:attack}));
  assert.equal(G.record(r,ally).echo,1);assert.equal(G.record(r).echo,0);assert.deepEqual(C.validateSave(JSON.stringify(r)),r);
});

test('mastered relay rewards another actor and forest pursuit increases actual ranged hit damage',()=>{
  let r=supply(awaken('relay_opening',15,true)),ally=r.party.members[0].id,arena=bossArena(r);r=arena.run;
  r=expectOk(H.strike(r,arena.id,{memberId:'hero',front:false}));assert.equal(H.state(r).enemy[arena.id].relayCooldown,17);
  const damage=H.stats(r,ally).damage,result=H.strike(r,arena.id,{memberId:ally,front:true});r=expectOk(result);
  assert.equal(result.effect.damage,Math.round(damage*1.78));assert.equal(H.state(r).enemy[arena.id].relay,0);assert.equal(H.state(r).enemy[arena.id].relayWeak,4);
  arena=bossArena(supply(awaken('forest_echo',15)));r=cast(arena.run,'pursuit_volley').run;r=expectOk(H.strike(r,arena.id,{skillId:'pursuit_volley'}));
  H.tick(r,H.stats(r).interval+.01);assert.ok(H.state(r).enemy[arena.id].slow>0);const stats=H.stats(r);
  r=expectOk(H.fireProjectile(r,'hero',arena.id));const hit=H.strike(r,arena.id,{shot:true});r=expectOk(hit);
  assert.equal(hit.effect.damage,Math.round(stats.damage*1.54));assert.ok(C.validateSave(r));
});

test('mastered repair works on deeply worn gear and never creates fractional durability in a save',()=>{
  let r=supply(awaken('artisan_soul',15)),gear;
  for(let i=0;i<100;i++){const candidate=C.createGear('smith_hammer',r.floor,r.seed,'repair-proof-'+i);if(candidate.maxDurability>=80){gear=candidate;break;}}
  assert.ok(gear);r=expectOk(C.grantGear(r,gear));r=expectOk(H.equip(r,'hero',gear.id));gear=H.equipment(r).weapon;
  for(let i=0;i<500&&gear.durability>1;i++)H.wear(r,'hero',gear);assert.equal(gear.durability,1);assert.ok(C.validateSave(r));
  const repaired=cast(r,'soul_temper').run;assert.ok(Number.isInteger(H.equipment(repaired).weapon.durability));assert.ok(H.equipment(repaired).weapon.durability>=59);assert.ok(C.validateSave(JSON.stringify(repaired)));
});

test('support AI considers covenant ward before attacking but never spends materials without consent',()=>{
  let r=supply(awaken('life_covenant',15));r=expectOk(G.setStrategy(r,'hero','support'));const near=H.ids(r);
  G.state(r).policies.hero.materials=false;assert.notEqual(G.aiChoice(r,'hero',near,true)?.skill,'covenant_ward');
  G.state(r).policies.hero.materials=true;assert.equal(G.aiChoice(r,'hero',near,true)?.skill,'covenant_ward');
  r=cast(r,'covenant_ward').run;assert.ok(H.buff(r,'ward'));assert.notEqual(G.aiChoice(r,'hero',near,true)?.skill,'covenant_ward');
});
