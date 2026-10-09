import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(base,'docs/職業裝備圖鑑.html'),'utf8');
const sources=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
function load(){
  const context=vm.createContext({});context.window=context;
  for(const key of ['document','localStorage','sessionStorage','fetch','setTimeout','setInterval','requestAnimationFrame'])Object.defineProperty(context,key,{get(){throw Error('Read-only data touched '+key);}});
  for(const source of sources){
    if(source.startsWith('story-atlas.js'))continue;
    const file=resolve(base,'docs',source.split('?')[0]);
    assert.ok(file.startsWith(base+'/'),source);assert.ok(existsSync(file),source);
    vm.runInContext(readFileSync(file,'utf8'),context,{filename:source});
  }
  return context;
}

test('reference page loads its real script order without starting timers, graphics, storage or network',()=>{
  const c=load();assert.equal(c.THREE,undefined);
  assert.equal(c.StoryAtlasRules.build().jobs.length,Object.keys(c.TowerHeroes.JOBS).length);assert.equal(c.StoryAtlasRules.build().jobs.length,8);
  assert.ok(c.StoryAtlasItems.records().length);
  assert.ok(c.StoryAtlasCooperation.records().length);
  assert.ok(sources.every(s=>!/^https?:/.test(s)));
});

test('reference page covers every cooperation with shared game art, skills, conditions and costs',()=>{
  const c=load(),records=c.StoryAtlasCooperation.records();
  assert.equal(records.length,c.TowerCooperation.DEFINITIONS.length);
  assert.equal(new Set(records.map(r=>r.id)).size,records.length);
  for(const def of c.TowerCooperation.DEFINITIONS){
    const r=records.find(r=>r.id===def.id);assert.ok(r,def.id);
    assert.equal(r.iconHtml,c.TowerCooperationRuntime.icon(def.id));assert.match(r.iconHtml,/^<svg /);
    assert.equal(r.underground,def.underground);assert.equal(r.description,def.description);
    const details=r.details.map(d=>d.value).join(' ');
    for(const p of def.participants){assert.ok(details.includes(c.TowerHeroes.JOBS[p.job].name));assert.ok(details.includes(c.TowerHeroes.SKILLS[p.skill].name));}
    assert.ok(details.includes(def.formation.description));assert.ok(details.includes(def.preparation+' 秒'));assert.ok(details.includes(def.cooldown+' 秒'));
    for(const [key,amount]of Object.entries(def.costs.ingredients))assert.ok(details.includes(c.TowerPartyCore.INGREDIENTS[key]+' × '+amount));
  }
});

test('all new recipes and forge traits are synchronized with current actual icons and underground gates',()=>{
  const c=load(),items=c.StoryAtlasItems.records(),rules=c.StoryAtlasRules.build();
  for(const [id,recipe]of Object.entries(c.TowerPartyCore.RECIPES)){
    const record=items.find(r=>r.key===id&&r.recipe);assert.ok(record,id);
    assert.equal(record.icon.provider,'party-dish');assert.equal(c.StoryAtlasItems.iconHtml(record),c.TowerPartyRuntime.dishArt(id));
    assert.equal(!!record.requiredDepth,!!recipe.requiredDepth,id);
  }
  for(const [id,trait]of Object.entries(c.TowerExpedition.TRAITS)){
    const r=rules.forging.find(r=>r.id===id);assert.ok(r,id);
    assert.equal(r.iconHtml,c.TowerForgeIcons.svg(trait.icon));assert.equal(!!r.underground,!!trait.underground,id);
  }
});

test('atlas IDs and icons are complete and descriptions have no unresolved values',()=>{
  const c=load(),rules=c.StoryAtlasRules.build(),items=c.StoryAtlasItems.records(),cooperation=c.StoryAtlasCooperation.records();
  const records=[...rules.entries,...items.map(r=>({...r,category:r.recipe?'cooking':'items'})),...cooperation];
  assert.equal(new Set(records.map(r=>r.category+':'+r.id)).size,records.length);
  for(const r of records){assert.ok(r.name);assert.ok(r.description);assert.doesNotMatch(JSON.stringify(r),/undefined|NaN/);}
  assert.equal(records.length,rules.entries.length+items.length+cooperation.length);assert.ok(records.some(record=>record.id==='robot'));assert.ok(records.some(record=>record.id==='robot_body'));
});

test('current game and read-only reference share the release version and accessible entry links',()=>{
  const index=readFileSync(resolve(base,'index.html'),'utf8'),pkg=JSON.parse(readFileSync(resolve(base,'package.json'),'utf8'));
  assert.ok(index.includes("const GAME_VERSION='"+pkg.version+"'"));assert.ok(html.includes('v'+pkg.version+' 圖鑑'));
  assert.match(index,/href="docs\/職業裝備圖鑑.html"[^>]*rel="noopener"/);
  assert.match(readFileSync(resolve(base,'story/tower-mode.js'),'utf8'),/docs\/職業裝備圖鑑.html/);
  for(const file of ['tower-cooperation-core.js','tower-cooperation-runtime.js','tower-forge-icons.js','tower-resource-icons.js','tower-materials.js','tower-robot-core.js','tower-commission-cooking.js']){
    assert.ok(index.includes('story/'+file));assert.ok(html.includes('../story/'+file));
  }
});

test('reading overview and resource cards share the current natural appearance and absence rules',()=>{
  const c=load(),overview=html.match(/<section><h3>靠牆採集資源<\/h3>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(overview);
  assert.deepEqual(JSON.parse(JSON.stringify(c.TowerForaging.APPEARANCE)),{suitable:60,neutral:40,unsuitable:20});
  for(const [profile,label]of [['neutral','一般（中性）'],['suitable','適合'],['unsuitable','不適合']]){
    const chance=c.TowerForaging.APPEARANCE[profile],absent=100-chance;
    assert.ok(overview.includes(label+'環境'+chance+'%出現、'+absent+'%不出現'));
    for(const weights of [c.TowerForaging.PROFILES,c.TowerForaging.POWER_PROFILES])assert.equal(weights[profile][0],absent);
  }
  assert.match(overview,/香草（藥草）、自然礦石與動力石各自獨立抽取/);
  assert.match(overview,/舊樓層的生成與已採紀錄保留，新樓層才套用新機率/);
  assert.match(overview,/每處只有\s*(?:1|一)\s*顆/);
  assert.doesNotMatch(overview,/30%／25%／15%|40%／35%／25%|20%／15%／5%/);
  for(const key of c.TowerForaging.POWER_STONES){
    const card=c.StoryAtlasItems.records().find(record=>record.key===key);assert.ok(card,key);
    assert.equal(c.TowerForaging.POWER_DEPOSIT_QUANTITY,1);assert.deepEqual(Array.from(card.foraging.quantity),[1,1]);
    assert.match(card.acquisition,/每處\s*1\s*顆/);assert.doesNotMatch(card.acquisition,/1～3\s*顆/);
    assert.ok(card.notes.some(note=>/新樓層每處只有\s*1\s*顆/.test(note)));assert.equal(card.drop.quantity,1,'Combat drops remain one and independent of ground harvest quantity');
  }
});

test('all six material affixes document shared art, actual tier quotes and separate forge ownership',()=>{
  const c=load(),rules=c.StoryAtlasRules.build(),materials=c.StoryAtlasItems.records();
  const entries=rules.forging.filter(r=>r.affix);
  assert.deepEqual(Array.from(entries,r=>r.affixId).sort(),Object.keys(c.TowerAffixes.EFFECTS).sort());
  assert.equal(entries.length,6);
  for(const [id,def] of Object.entries(c.TowerAffixes.EFFECTS)){
    const r=entries.find(r=>r.affixId===id),text=r.details.map(d=>d.value).join(' ');
    assert.equal(r.iconHtml,c.TowerAffixes.svg(id));assert.equal(r.material,def.material);assert.equal(r.underground,!!def.underground);
    assert.ok(text.includes(def.description));assert.ok(text.includes(c.TowerMaterials.MATERIALS[def.material]+' ×2'));
    assert.deepEqual(Array.from(r.quotes,q=>q.coins),[14,18,22,26,30]);
    assert.deepEqual(Array.from(r.quotes,q=>q.chance),[68,71,74,77,80]);
    assert.ok(r.quotes.every(q=>q.count===2));assert.match(text,/25%/);assert.match(text,/35%.*最高65%/);
    assert.match(text,/排除機器人機件及動力核心/);assert.match(r.notes.join(' '),/獨立於原工坊.*失敗保留原附魔.*加20%/);
    const material=materials.find(r=>r.id==='material:'+def.material);assert.ok(material.effect.includes(def.name+'材料附魔'));assert.ok(material.sources.includes(c.StoryAtlasItems.SOURCES.affixes));
  }
});

test('durability format six, sustained durable savings and percentage emergency repairs remain synchronized',()=>{
  const c=load(),rules=c.StoryAtlasRules.build(),detail=(r,label)=>r.details.find(d=>d.label===label)?.value;
  assert.equal(c.TowerCore.DURABILITY_VERSION,6);
  const durable=rules.forging.find(r=>r.id==='durable');
  assert.deepEqual(Array.from(durable.levels,l=>[l.value,l.unit]),[[10,'%'],[20,'%']]);assert.match(durable.notes.join(' '),/每十次省一次.*每五次省一次.*讀檔.*不重置.*舊存檔/);
  const repair=rules.skills.find(r=>r.id==='repair');
  assert.ok(repair);assert.deepEqual(Array.from(repair.levels,l=>l.value),[8,10,12,14,16,18]);assert.ok(repair.levels.every(l=>l.unit==='%'));
  assert.match(detail(repair,'修補上限'),/尚未損壞.*非核心.*剩餘比例最低的一件.*最多30點.*無法重建破損/);
  for(const base of ['spellbook','cooking_pan'])for(let tier=1;tier<=5;tier++){
    const kind=c.TowerHeroes.tierKind(base,tier),gear=rules.gear.find(r=>r.id===kind);
    assert.deepEqual(Array.from(gear.rawStats.normalDurability),[c.TowerCore.durabilityForRoll(kind,tier+2),c.TowerCore.durabilityForRoll(kind,10)]);
    assert.match(gear.notes.join(' '),/法書與料理鍋.*提高25%.*破損仍為零/);
    assert.match(gear.notes.join(' '),/優先修理.*低於70%.*小損保養.*至少70%.*全部修理.*逐件/);
    if(tier>1)assert.match(gear.notes.join(' '),/提高普通初始耐久下限.*原剩餘比例遷移一次/);
  }
  for(const gear of rules.gear.filter(r=>r.core))assert.match(detail(gear,'恢復方式'),/低階核心.*傷口已補滿.*高階核心不再消耗/);
  for(const gear of rules.gear.filter(r=>r.integrated&&r.id.startsWith('robot_shell')))assert.match(detail(gear,'抗控制'),/緩速、電麻與束縛.*不是一般傷害減傷.*不減少灼傷、中毒或詛咒/);
});

test('three ailment-protection meals keep actual recipe ingredients and protect only the consumer once',()=>{
  const c=load(),records=c.StoryAtlasItems.records(),wardRecipes=Object.entries(c.TowerPartyCore.RECIPES).filter(([,r])=>r.ward);
  assert.equal(wardRecipes.length,3);
  for(const [id,recipe] of wardRecipes){
    const card=records.find(r=>r.id==='meal:'+id);assert.equal(card.recipe.ward,recipe.ward);
    assert.deepEqual(JSON.parse(JSON.stringify(card.recipe.cost)),JSON.parse(JSON.stringify(recipe.cost)));
    assert.equal(c.StoryAtlasItems.iconHtml(card),c.TowerPartyRuntime.dishArt(id));
    assert.match(card.effect,/享用者五分鐘內抵擋一次.*觸發即消失.*不抵擋直接傷害/);
    assert.ok(card.effect.includes(c.TowerAffixes.EFFECTS[recipe.ward].name));assert.ok(card.sources.includes(c.StoryAtlasItems.SOURCES.affixes));
  }
});

test('event choices, six fixed landmarks and eight profession sites use current game catalogues and shared icons',()=>{
  const c=load(),records=c.StoryAtlasItems.records();
  assert.equal(records.filter(r=>r.category==='探索事件').length,Object.keys(c.TowerAdventureEvents.KINDS).length);
  for(const [id,d] of Object.entries(c.TowerAdventureEvents.KINDS)){
    const card=records.find(r=>r.id==='event:'+id);assert.equal(card.description,d.copy);assert.deepEqual(JSON.parse(JSON.stringify(card.choices)),JSON.parse(JSON.stringify(d.choices)));
    assert.equal(c.StoryAtlasItems.iconHtml(card),c.TowerAdventureEvents.svg(id));assert.ok(card.notes.includes(d.follow));assert.ok(card.notes.includes(d.reward));assert.match(card.notes.join(' '),/兩層後.*任務頁.*可以放棄/);
  }
  assert.equal(records.filter(r=>r.category==='固定場景').length,6);
  for(const [id,name]of Object.entries(c.TowerLandmarks.NAMES)){
    const card=records.find(r=>r.id==='landmark:'+id);assert.equal(card.name,name);assert.equal(c.StoryAtlasItems.iconHtml(card),c.TowerLandmarks.svg(id));assert.match(card.effect,/同層迷宮變形.*位置.*保持不變/);assert.match(card.acquisition,/裂隙副本不生成/);
  }
  assert.equal(records.filter(r=>r.category==='職業機關').length,8);
  for(const [job,d] of Object.entries(c.TowerExpedition.SITES)){
    const card=records.find(r=>r.id==='site:'+job);assert.equal(card.description,d.description);assert.ok(card.effect.endsWith(d.reward));assert.equal(c.StoryAtlasItems.iconHtml(card),c.TowerPartyRuntime.portrait(job));assert.match(card.notes.join(' '),/進度條.*已處理外觀.*新樓層才加入射手與機器人/);
  }
  for(const id of ['rootCounter','crystalCounter']){
    const card=records.find(r=>r.id==='lord-counter:'+id);assert.equal(c.StoryAtlasItems.iconHtml(card),c.TowerAdventureEvents.svg(id));assert.match(card.effect,/生命降至一半.*護罩/);assert.match(card.acquisition,/原先的迷宮封印與主線出口條件仍要完成/);
  }
});

test('new reference modules have release cache keys without importing live gameplay timers',()=>{
  for(const file of ['tower-affixes.js','tower-adventure-events.js','tower-landmarks.js'])assert.ok(sources.includes('../story/'+file+'?v='+(file==='tower-adventure-events.js'?'1.57.0':'1.55.0')),file);
  assert.ok(sources.includes('story-atlas-rules.js?v=1.58.7'));assert.ok(sources.includes('story-atlas-items.js?v=1.58.7'));
  assert.match(html,/持續.*10%.*20%|10%.*20%.*損耗/);assert.match(html,/供能藤.*晶柱/);
});
