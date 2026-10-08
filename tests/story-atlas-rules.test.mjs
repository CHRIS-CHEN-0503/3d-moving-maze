import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),H=require('../story/tower-heroes-core.js'),C=require('../story/story-core.js'),G=require('../story/tower-hero-growth.js'),P=require('../story/tower-party-core.js'),E=require('../story/tower-encounters.js'),I=require('../story/tower-heroes-icons.js'),FI=require('../story/tower-forge-icons.js'),X=require('../story/tower-expedition-core.js'),A=require('../story/tower-affixes.js'),D=require('../docs/story-atlas-rules.js');
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
  const data=D.build();assert.equal(data.jobs.length,Object.keys(H.JOBS).length);assert.equal(data.jobs.length,8);assert.equal(data.skills.length,Object.keys(H.SKILLS).length+Object.keys(H.PASSIVES).length);assert.equal(data.weapons.length,Object.values(H.GEAR).filter(g=>g.slot==='weapon').length);assert.equal(data.armor.length,Object.values(H.GEAR).filter(g=>g.slot!=='weapon').length);assert.equal(data.forging.length,Object.keys(X.TRAITS).length+4+Object.keys(H.ROBOT.CORES).length+Object.keys(A.EFFECTS).length);
  assert.equal(data.entries.length,data.jobs.length+data.skills.length+data.gear.length+data.forging.length);assert.equal(new Set(data.entries.map(e=>e.category+':'+e.id)).size,data.entries.length);
  assert.deepEqual(data.skills.map(s=>s.id).sort(),[...Object.keys(H.SKILLS),...Object.keys(H.PASSIVES)].sort());
  assert.deepEqual(data.gear.map(s=>s.id).sort(),Object.keys(H.GEAR).sort());
  for(const entry of data.entries){
    assert.ok(entry.description.length>5,entry.id);assert.ok(entry.details.length>=3,entry.id);assert.ok(entry.notes.length,entry.id);assert.match(entry.iconHtml,/^<svg /,entry.id);
    assert.equal(entry.iconHtml,entry.category==='jobs'?globalThis.TowerPartyRuntime.portrait(entry.id):entry.affix?A.svg(entry.affixId):entry.robotUpgrade?I.svg(H.ROBOT.kind('robot_shell',Number(entry.id.at(-1)))):entry.robotCoreCraft?I.svg(H.ROBOT.kind('robot_core',Number(entry.id.at(-1)))):entry.category==='forging'?FI.svg(X.TRAITS[entry.id].icon):I.svg(entry.id));
    assert.ok(entry.details.every(d=>d.label&&d.value&&!/undefined|NaN/.test(d.value)),entry.id);
  }
});

test('all six skill ranks, cooldowns, preparation and consumables match the shipped definitions',()=>{
  for(const skill of D.build().skills){
    const spec=H.SKILLS[skill.id]||H.PASSIVES[skill.id];assert.deepEqual(skill.levels.map(l=>l.value),spec.power);assert.deepEqual(skill.levels.map(l=>l.level),[1,2,3,4,5,6]);
    if(H.SKILLS[skill.id]){
      assert.equal(spec.preparation,H.preparationSeconds(skill.id),'Atlas and execution share canonical preparation metadata');
      if(spec.effect!=='cleanse')assert.equal(detail(skill,'冷卻'),spec.cooldown+' 秒');
      if(H.preparationSeconds(skill.id))assert.equal(detail(skill,'準備時間'),H.preparationSeconds(skill.id)+' 秒');
      for(const [key,value]of Object.entries(spec.cost))assert.ok(detail(skill,'消耗').includes(P.INGREDIENTS[key]+' ×'+value));
      if(spec.ammo)assert.ok(detail(skill,'消耗').includes('箭矢 ×'+spec.ammo));
      if(spec.scrapCost)assert.ok(detail(skill,'消耗').includes('金屬零件 ×'+spec.scrapCost));
    }
  }
  assert.equal(D.skill('iron_wall').levels[0].unit,'點');assert.equal(D.skill('food_sharing').levels[0].unit,'點');
  assert.equal(D.skill('intuition').levels[0].unit,'秒');assert.equal(D.skill('tool_supply').levels[0].unit,'秒');assert.equal(D.skill('rescue').levels[0].unit,'秒');
  assert.equal(D.skill('disarm').levels[0].value,3.2);assert.equal(D.skill('disarm').levels[5].value,1.2);
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

test('healing guide reads current shared skill numbers without stale percent descriptions',()=>{
  assert.equal(detail(D.skill('herbal_heal'),'冷卻'),G.HEALING.herbalCooldown+' 秒');
  assert.equal(D.skill('herbal_heal').levels[0].value,30);
  assert.equal(D.skill('banquet_broth').levels[0].value,120);
  assert.equal(D.skill('dawn_return').levels[0].value,90);
  assert.equal(detail(D.skill('dawn_sanctuary'),'持續／附帶效果'),'領域十秒，合計恢復最大生命'+H.SKILLS.dawn_sanctuary.power[0]+'%；施放時扶起一人至'+G.HEALING.sanctuaryRevivePercent+'%生命。');
  assert.equal(detail(D.skill('hero_feast'),'持續／附帶效果'),'十秒恢復最大生命'+G.HEALING.feastPercent+'%；全隊增傷15%持續四十五秒。');
  const html=readFileSync(new URL('../docs/職業裝備圖鑑.html',import.meta.url),'utf8');
  const section=html.match(/<section><h3>療癒與自動補血<\/h3>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section);
  for(const pattern of [/冷卻五秒/,/生命恢復量提高50%/,/料理與藥品本身.*不增加/,/允許技能消耗食材／零件/,/低於50%生命/,/不能隔牆.*機器人/,/自動喝療癒藥.*另行設定/])assert.match(section,pattern);
});

test('all gear stats, five tiers, wear and price ranges use game definitions rather than historical docs',()=>{
  for(const record of D.build().gear){
    const def=H.GEAR[record.id],m=C.durabilityMultiplier(record.id);
    assert.equal(record.tier,def.tier);assert.equal(record.requiredLevel,def.requiredLevel);assert.deepEqual(record.jobs,def.jobs);
    for(const key of ['damage','magicDamage','defense','support','interval','reach','hands'])assert.equal(record.rawStats[key],def[key]);
    if(!def.integrated&&!def.core)assert.equal(detail(record,'普通初始耐久'),[C.durabilityMinimumRoll(record.id),10].map(n=>C.durabilityForRoll(record.id,n)).join('～'));
    if(def.slot==='weapon')assert.match(detail(record,'耐久消耗'),['bow','staff','book'].includes(def.type)?/發射就消耗/:/揮空不扣/);
    if(def.tier>3)assert.match(record.notes.join(''),/僅地下篇/);
    if(def.integrated){assert.equal(detail(record,'普通初始耐久'),def.maxDurability+'～'+def.maxDurability);assert.equal(record.integrated,true);assert.deepEqual(record.sourceFloors,[]);assert.match(detail(record,'取得方式'),/初始配備|上一階/);continue;}
    if(def.core){assert.equal(detail(record,'普通初始耐久'),def.maxDurability+'～'+def.maxDurability);assert.equal(record.core,true);assert.deepEqual(record.sourceFloors,[]);assert.match(detail(record,'取得方式'),/安全營地.*製作/);assert.match(detail(record,'耐久消耗'),/3 秒.*1 耐久.*不因受擊/);continue;}
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
  for(const record of D.build().gear)if(record.integrated)assert.match(detail(record,'行商'),/^鐵嶺.*不出售/);else if(record.core)assert.match(detail(record,'行商'),/^不販售/);else assert.ok(detail(record,'行商').startsWith(shops.get(record.id)),record.id);
  assert.match(D.profession('chef').description,/六道基本菜任何隊伍都能烹飪.*有能行動的廚師.*高階菜譜/);assert.match(D.profession('chef').notes[0],/一料雙份.*等級/);
  assert.match(D.profession('mage').description,/日光術.*不占技能欄/);assert.match(D.profession('smith').description,/完整修理.*重建破損.*專門商人.*20%/);
  for(const job of D.build().jobs)assert.match(job.notes.join(''),/五級.*隨機/);
  assert.deepEqual(D.build().progression.xp,G.XP);assert.equal(D.build().progression.branches.length,Object.keys(require('../story/tower-ascension-catalog.js').BRANCHES).length);
  for(const key of ['undefined','__proto__','constructor','missing']){assert.equal(D.skill(key),null);assert.equal(D.gear(key),null);assert.equal(D.profession(key),null);}
});

test('robot dual cores mirror the actual five fixed durabilities, defense and material-only craft recipes',()=>{
  const R=H.ROBOT,M=require('../story/tower-materials.js');
  for(const d of Object.values(R.CORES)){
    const entry=D.gear(d.kind),craft=D.robotCoreCraft(d.tier),cost=R.CORE_COSTS[d.tier];assert.equal(entry.requiredLevel,d.requiredLevel);assert.equal(entry.rawStats.defense,d.defense);assert.deepEqual(entry.rawStats.normalDurability,[d.maxDurability,d.maxDurability]);assert.match(detail(entry,'內建光源'),/單核心小於火把.*雙核心大於火把且小於日光術.*全隊採最強光源.*已施放日光術優先.*不因切換領隊.*階級只決定光色.*永久.*能源耗盡/);assert.doesNotMatch(detail(entry,'內建光源'),/一至三階.*四五階/);assert.ok(detail(entry,'內建光源').includes('無核／單核／雙核範圍 '+R.CORE_LIGHT_RADII.join('／')),d.kind);assert.match(detail(entry,'恢復方式'),/两顆|兩顆/);assert.match(entry.description,new RegExp('每 '+R.REPAIR_SECONDS+' 秒自我修復 '+d.tier+' 點'));
    assert.equal(craft.underground,d.tier>3);assert.match(detail(craft,'銅幣費用'),new RegExp('^'+cost.coins+' 幣$'));assert.match(detail(craft,'材料'),new RegExp(cost.scrap+' 金屬零件'));for(const[key,n]of Object.entries(cost.materials))assert.ok(detail(craft,'材料').includes(M.MATERIALS[key]+' ×'+n));assert.equal(craft.iconHtml,I.svg(d.kind));
  }
  // The card face is a short summary like every profession; the full machine rules are one detail row.
  const robotJob=D.profession('robot');assert.ok(robotJob.description.length<70,'short card face');assert.doesNotMatch(robotJob.description,/九成|十分鐘|火把/);
  assert.match(robotJob.details.find(r=>r.label==='機體規則').value,/九成.*兩個動力核心.*永久照明.*十分鐘.*一般料理.*不能修復/);
});

test('browser adapter is read-only, needs no DOM or storage, and matches CommonJS output',()=>{
  const context=vm.createContext({});
  for(const forbidden of ['document','localStorage','sessionStorage','fetch','setTimeout','requestAnimationFrame'])Object.defineProperty(context,forbidden,{get(){throw new Error('Atlas must not touch '+forbidden);}});
  for(const name of ['tower-materials','tower-robot-core','tower-ascension-catalog','tower-hero-growth','tower-gear-tiers','tower-heroes-core','tower-expedition-core','tower-party-core','tower-recruitment','story-core','tower-underworld','tower-encounters','tower-field-guide','tower-heroes-icons','tower-forge-icons','tower-party-runtime','tower-affixes'])vm.runInContext(readFileSync(new URL('../story/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
  vm.runInContext(readFileSync(new URL('../docs/story-atlas-rules.js',import.meta.url),'utf8'),context);
  const before=JSON.stringify({jobs:H.JOBS,skills:H.SKILLS,passives:H.PASSIVES,gear:H.GEAR});
  const data=context.StoryAtlasRules.build();assert.deepEqual(JSON.parse(JSON.stringify(data)),JSON.parse(JSON.stringify(D.build())));
  data.skills[0].levels[0].value=-123;data.gear[0].jobs.length=0;data.progression.xp[0]=-123;
  assert.deepEqual(JSON.parse(JSON.stringify(context.StoryAtlasRules.build())),JSON.parse(JSON.stringify(D.build())));
  assert.equal(JSON.stringify({jobs:H.JOBS,skills:H.SKILLS,passives:H.PASSIVES,gear:H.GEAR}),before);
});

test('robot passive HP, five fixed parts and mineral advancement costs mirror actual rules',()=>{
  const Robot=require('../story/tower-robot-core.js'),Materials=require('../story/tower-materials.js');assert.deepEqual(D.skill('robot_body').levels.map(l=>l.value),[5,10,15,20,25,30]);assert.equal(D.skill('robot_body').levels[0].unit,'點');
  const job=D.profession('robot');assert.match(job.description,/一體式.*不能穿一般防具/);assert.match(detail(job,'旅人姓名'),/鐵衡.*鈴芯/);assert.equal(detail(job,'普通技能池'),'6 主動／5 被動');assert.deepEqual(job.weaponIds,['robot_fists']);assert.match(job.notes.join(''),/原機件.*不重送/);
  assert.equal(D.build().gear.filter(g=>g.integrated).length,10);
  for(const tier of [1,2,3,4,5]){const shell=D.gear(Robot.kind('robot_shell',tier)),back=detail(shell,'背面造型'),fists=detail(D.gear(Robot.kind('robot_fists',tier)),'背面造型');assert.match(back,/背脊裝甲.*斜向散熱格柵.*弧形管線/);assert.equal(back.includes('下背甲增加接縫'),tier>=2);assert.equal(back.includes('中央核心護蓋'),tier>=3);assert.equal(back.includes('核心能量雕紋'),tier>=4);assert.equal(back.includes('鎮淵箭形下背鑲片'),tier===5);assert.match(shell.description,/隨機殼階級加細/);assert.match(fists,/關節接頭.*與機殼獨立/);assert.equal(fists.includes('散熱槽'),tier>=3);assert.equal(fists.includes('能量針'),tier>=4);}
  for(const tier of [2,3,4,5]){const record=D.robotUpgrade(tier),cost=Robot.COSTS[tier];assert.ok(record.robotUpgrade);assert.equal(record.underground,tier>3);assert.match(detail(record,'開放條件'),new RegExp('人物 '+Robot.GATES[tier-1]+' 級'));assert.ok(detail(record,'每件隊內費用').includes(cost.coins+' 銅幣'));assert.ok(detail(record,'每件商人費用').includes(Math.ceil(cost.coins*1.2)+' 銅幣'));for(const[id,n]of Object.entries(cost.materials))assert.ok(detail(record,'每件隊內費用').includes(Materials.MATERIALS[id]+' ×'+n));}
});
