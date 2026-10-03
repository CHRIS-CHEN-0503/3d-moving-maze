import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),H=require('../story/tower-heroes-core.js'),C=require('../story/story-core.js'),G=require('../story/tower-hero-growth.js'),P=require('../story/tower-party-core.js'),E=require('../story/tower-encounters.js'),I=require('../story/tower-heroes-icons.js'),FI=require('../story/tower-forge-icons.js'),X=require('../story/tower-expedition-core.js'),D=require('../docs/story-atlas-rules.js');
require('../story/tower-party-runtime.js');
const detail=(record,key)=>record.details.find(d=>d.label===key)?.value||'';

test('profession invitations and repair-all documentation use the current shared recruitment costs',()=>{
  const R=require('../story/tower-recruitment.js');
  for(const [identity,terms]of Object.entries(R.TERMS)){
    const [job,sex]=identity.split(':'),text=detail(D.profession(job),sex==='male'?'男旅人首次同行':'女旅人首次同行');
    for(const[type,value]of Object.entries(terms.costs))for(const[key,n]of typeof value==='number'?[[type,value]]:Object.entries(value))assert.ok(text.includes(R.label(type,key)+' ×'+n),identity);
    assert.match(D.profession(job).notes.join(''),/本層不能重招.*50%/);
  }
  assert.match(D.gear('longsword').notes.join(''),/一鍵修理.*資源不足不局部扣款/);
});

test('atlas covers every current job, weapon, armor and skill exactly once with its real game icon',()=>{
  const data=D.build();assert.equal(data.jobs.length,7);assert.equal(data.skills.length,119);assert.equal(data.weapons.length,45);assert.equal(data.armor.length,45);assert.equal(data.forging.length,7);assert.equal(data.entries.length,223);
  assert.equal(new Set(data.entries.map(e=>e.category+':'+e.id)).size,223);
  assert.deepEqual(data.skills.map(s=>s.id).sort(),[...Object.keys(H.SKILLS),...Object.keys(H.PASSIVES)].sort());
  assert.deepEqual(data.gear.map(s=>s.id).sort(),Object.keys(H.GEAR).sort());
  for(const entry of data.entries){
    assert.ok(entry.description.length>5,entry.id);assert.ok(entry.details.length>=3,entry.id);assert.ok(entry.notes.length,entry.id);assert.match(entry.iconHtml,/^<svg /,entry.id);
    assert.equal(entry.iconHtml,entry.category==='jobs'?globalThis.TowerPartyRuntime.portrait(entry.id):entry.category==='forging'?FI.svg(X.TRAITS[entry.id].icon):I.svg(entry.id));
    assert.ok(entry.details.every(d=>d.label&&d.value&&!/undefined|NaN/.test(d.value)),entry.id);
  }
});

test('all six skill ranks, cooldowns, preparation and consumables match the shipped definitions',()=>{
  for(const skill of D.build().skills){
    const spec=H.SKILLS[skill.id]||H.PASSIVES[skill.id];assert.deepEqual(skill.levels.map(l=>l.value),spec.power);assert.deepEqual(skill.levels.map(l=>l.level),[1,2,3,4,5,6]);
    if(H.SKILLS[skill.id]){
      if(spec.effect!=='cleanse')assert.equal(detail(skill,'冷卻'),spec.cooldown+' 秒');
      if(H.preparationSeconds(skill.id))assert.equal(detail(skill,'準備時間'),H.preparationSeconds(skill.id)+' 秒');
      for(const [key,value]of Object.entries(spec.cost))assert.ok(detail(skill,'消耗').includes(P.INGREDIENTS[key]+' ×'+value));
      if(spec.ammo)assert.ok(detail(skill,'消耗').includes('箭矢 ×'+spec.ammo));
    }
  }
  assert.equal(D.skill('iron_wall').levels[0].unit,'點');assert.equal(D.skill('food_sharing').levels[0].unit,'點');
  assert.equal(D.skill('intuition').levels[0].unit,'秒');assert.equal(D.skill('tool_supply').levels[0].unit,'秒');assert.equal(D.skill('rescue').levels[0].unit,'秒');
  assert.equal(D.skill('disarm').levels[0].value,3.5);assert.equal(D.skill('disarm').levels[5].value,1.5);
  assert.match(detail(D.skill('moving_fortress'),'消耗'),/硬殼 ×2.*金屬零件 ×2/);
  assert.match(detail(D.skill('hero_feast'),'消耗'),/三種不同食材各一份/);
  assert.equal(D.skill('daylight'),null,'Innate daylight is not a random skill');
});

test('documentation separates five-minute shields from much shorter taunt and immunity effects',()=>{
  assert.match(D.skill('barrier').description,/五分鐘/);assert.doesNotMatch(D.skill('barrier').description,/十秒/);
  assert.match(detail(D.skill('moving_fortress'),'持續／附帶效果'),/護盾五分鐘.*挑釁.*十五秒/);
  assert.match(detail(D.skill('covenant_ward'),'持續／附帶效果'),/一次一般異常.*不抵擋直接傷害/);
  assert.match(D.skill('many_flavors').description,/兩種不同料理/);assert.match(D.skill('many_flavors').description,/五分鐘/);
  assert.match(detail(D.skill('soul_temper'),'作用對象'),/左側隊友/);
  assert.match(detail(D.skill('worldroot_arrow'),'持續／附帶效果'),/束縛 2 秒.*緩速 60% 持續 8 秒/);
});

test('all gear stats, five tiers, wear and price ranges use game definitions rather than historical docs',()=>{
  for(const record of D.build().gear){
    const def=H.GEAR[record.id],m=C.durabilityMultiplier(record.id);
    assert.equal(record.tier,def.tier);assert.equal(record.requiredLevel,def.requiredLevel);assert.deepEqual(record.jobs,def.jobs);
    for(const key of ['damage','magicDamage','defense','support','interval','reach','hands'])assert.equal(record.rawStats[key],def[key]);
    assert.equal(detail(record,'普通初始耐久'),[3,10].map(n=>C.durabilityForRoll(record.id,n)).join('～'));
    if(def.slot==='weapon')assert.match(detail(record,'耐久消耗'),['bow','staff','book'].includes(def.type)?/發射就消耗/:/揮空不扣/);
    if(def.tier>3)assert.match(record.notes.join(''),/僅地下篇/);
    const floor=def.tier<=3?[99,69,39][def.tier-1]:def.tier===4?-1:-21;
    for(let seed=1;seed<=24;seed++){
      const gear=C.createGear(record.id,floor,seed,'atlas-check'),price=C.gearPrice(gear),range=detail(record,'一般商店價格').match(/^(\d+)～(\d+)/);
      assert.ok(price>=Number(range[1])&&price<=Number(range[2]),record.id);
      assert.ok(gear.maxDurability>=record.rawStats.normalDurability[0]&&gear.maxDurability<=record.rawStats.normalDurability[1],record.id);
    }
  }
  assert.equal(detail(D.gear('longsword'),'普通初始耐久'),'60～200');assert.equal(detail(D.gear('robe'),'普通初始耐久'),'40～134');
  assert.equal(detail(D.gear('buckler'),'普通初始耐久'),'40～134');assert.equal(detail(D.gear('round_shield'),'普通初始耐久'),'60～200');
  assert.match(detail(D.gear('arcane_staff_t5'),'普通攻擊'),/光彈.*法術/);assert.match(detail(D.gear('rune_crown'),'法袍額外效益'),/法術增傷4%.*治療加成5%/);
});

test('merchant, acquisition and profession notes reflect the modern rules',()=>{
  const shops=new Map();for(let seed=1;seed<=24;seed++)for(const m of E.merchantOffers(-21,seed,true))for(const kind of m.equipmentKinds)shops.set(kind,m.name);
  for(const record of D.build().gear)assert.ok(detail(record,'行商').startsWith(shops.get(record.id)),record.id);
  assert.match(D.profession('chef').description,/六道基本菜任何隊伍都能烹飪.*有能行動的廚師.*高階菜譜/);assert.match(D.profession('chef').notes[0],/一料雙份.*等級/);
  assert.match(D.profession('mage').description,/日光術.*不占技能欄/);assert.match(D.profession('smith').description,/完整修理.*重建破損.*專門商人.*20%/);
  for(const job of D.build().jobs)assert.match(job.notes.join(''),/五級.*隨機/);
  assert.deepEqual(D.build().progression.xp,G.XP);assert.equal(D.build().progression.branches.length,14);
  for(const key of ['undefined','__proto__','constructor','missing']){assert.equal(D.skill(key),null);assert.equal(D.gear(key),null);assert.equal(D.profession(key),null);}
});

test('browser adapter is read-only, needs no DOM or storage, and matches CommonJS output',()=>{
  const context=vm.createContext({});
  for(const forbidden of ['document','localStorage','sessionStorage','fetch','setTimeout','requestAnimationFrame'])Object.defineProperty(context,forbidden,{get(){throw new Error('Atlas must not touch '+forbidden);}});
  for(const name of ['tower-materials','tower-ascension-catalog','tower-hero-growth','tower-gear-tiers','tower-heroes-core','tower-expedition-core','tower-party-core','tower-recruitment','story-core','tower-underworld','tower-encounters','tower-field-guide','tower-heroes-icons','tower-forge-icons','tower-party-runtime'])vm.runInContext(readFileSync(new URL('../story/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
  vm.runInContext(readFileSync(new URL('../docs/story-atlas-rules.js',import.meta.url),'utf8'),context);
  const before=JSON.stringify({jobs:H.JOBS,skills:H.SKILLS,passives:H.PASSIVES,gear:H.GEAR});
  const data=context.StoryAtlasRules.build();assert.deepEqual(JSON.parse(JSON.stringify(data)),JSON.parse(JSON.stringify(D.build())));
  data.skills[0].levels[0].value=-123;data.gear[0].jobs.length=0;data.progression.xp[0]=-123;
  assert.deepEqual(JSON.parse(JSON.stringify(context.StoryAtlasRules.build())),JSON.parse(JSON.stringify(D.build())));
  assert.equal(JSON.stringify({jobs:H.JOBS,skills:H.SKILLS,passives:H.PASSIVES,gear:H.GEAR}),before);
});
