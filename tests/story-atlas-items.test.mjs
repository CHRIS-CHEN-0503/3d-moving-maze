import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js');
const N=require('../story/tower-narrative.js'),L=require('../story/tower-lighting-core.js'),Loot=require('../story/tower-loot.js');
const Atlas=require('../docs/story-atlas-items.js'),Icons=require('../story/tower-resource-icons.js');
const Materials=require('../story/tower-materials.js'),Foraging=require('../story/tower-foraging.js');
const Robot=require('../story/tower-robot-core.js'),HeroIcons=require('../story/tower-heroes-icons.js');
const Affixes=require('../story/tower-affixes.js'),Events=require('../story/tower-adventure-events.js'),Landmarks=require('../story/tower-landmarks.js'),Expedition=require('../story/tower-expedition-core.js');
require('../story/tower-party-runtime.js');require('../story/tower-lighting-runtime.js');
const entries=Atlas.records(),find=id=>entries.find(r=>r.id===id),fresh=()=>H.enable(P.enable(C.newRun({seed:71}),'mage').run).run;

test('atlas derives every current inventory item, ingredient, recipe and all 15 chapter tokens',()=>{
  assert.deepEqual(entries.filter(e=>e.id.startsWith('item:')).map(e=>e.key).sort(),Object.keys(C.ITEMS).sort());
  assert.deepEqual(entries.filter(e=>e.id.startsWith('ingredient:')).map(e=>e.key).sort(),Object.keys(P.INGREDIENTS).sort());
  assert.deepEqual(entries.filter(e=>e.id.startsWith('meal:')).map(e=>e.key).sort(),Object.keys(P.RECIPES).sort());
  assert.equal(N.allChapters().length,15);
  for(const chapter of N.allChapters()){const item=find(chapter.clueId);assert.equal(item.name,chapter.clueName);assert.equal(item.midFloor,chapter.mid);assert.equal(item.gateFloor,chapter.low);assert.equal(item.spoiler,true);}
  assert.equal(entries.length,Object.keys(C.ITEMS).length+Object.keys(P.INGREDIENTS).length+Object.keys(Materials.MATERIALS).length+Object.keys(P.RECIPES).length+N.allChapters().length+8+Object.keys(Events.KINDS).length+Object.keys(Landmarks.NAMES).length+Object.keys(Expedition.SITES).length+2);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
  for(const e of entries){for(const field of ['id','name','category','description','effect','acquisition'])assert.ok(e[field]?.length,e.id+' '+field);assert.ok(e.sources.length);for(const source of e.sources)assert.ok(fs.existsSync(path.join(base,source)),source);assert.ok(Object.isFrozen(e));}
});

test('all inventory illustrations resolve to the exact shared game provider or original shovel frame',()=>{
  const context={};context.window=context;vm.runInNewContext(fs.readFileSync(path.join(base,'assets/pickup-objects.js'),'utf8'),context);
  for(const e of entries){
    assert.ok(fs.existsSync(path.join(base,e.icon.source)),e.id);
    if(e.icon.provider==='pickup'){assert.equal(e.icon.key,'⛏');assert.ok(context.PickupObjects.frames[e.icon.key]);continue;}
    const svg=Atlas.iconHtml(e);assert.match(svg,/^<svg /,e.id);assert.doesNotMatch(svg,/undefined|NaN|<script|<image|(?:href|src)=/i,e.id);
    if(e.icon.provider==='party-food')assert.equal(svg,globalThis.TowerPartyRuntime.foodArt(e.key));
    if(e.icon.provider==='party-dish')assert.equal(svg,globalThis.TowerPartyRuntime.dishArt(e.key));
    if(e.icon.provider==='lighting')assert.equal(svg,globalThis.TowerLightingRuntime.icon(e.icon.key));
    if(e.icon.provider==='resource')assert.equal(svg,Icons.svg(e.icon.key));
    if(e.icon.provider==='event')assert.equal(svg,Events.svg(e.icon.key));
    if(e.icon.provider==='landmark')assert.equal(svg,Landmarks.svg(e.icon.key));
    if(e.icon.provider==='portrait')assert.equal(svg,globalThis.TowerPartyRuntime.portrait(e.icon.key));
  }
  assert.equal(Icons.svg('not-an-item'),'');assert.equal(Atlas.iconHtml({icon:{provider:'unknown',key:'unsafe'}}),'');
});

test('item guide uses current actor combat values, not the retired feather and shield rules',()=>{
  const run=fresh();run.bag.feather=1;H.setHp(run,'hero',1);H.hurt(run,'hero',100,'monster');
  assert.equal(run.bag.feather,0);assert.equal(H.hp(run,'hero'),40);assert.match(find('item:feather').effect,/40/);assert.match(find('item:feather').effect,/目前操控者/);
  const before=fresh();before.bag.shield=1;const after=C.useItem(before,'shield',before.revision);assert.equal(after.ok,true);const barrier=H.buff(after.run,'barrier');
  assert.equal(barrier.left,300);assert.equal(barrier.power,H.maxHp(before)*.35);assert.match(find('item:shield').effect,/35%/);assert.match(find('item:shield').effect,/300/);
});

test('drop percentages are conditional and arrow bundles differ from shop quantities',()=>{
  for(const e of entries.filter(e=>e.drop))assert.equal(e.drop.conditionalPercent,Loot.chance({type:e.id.startsWith('ingredient:')?'ingredient':e.id.startsWith('material:')?'material':'item',key:e.key,rarity:e.drop.rarity}));
  for(const key of Loot.COMMON_FOOD){assert.equal(find('ingredient:'+key).drop.conditionalPercent,25);assert.match(find('ingredient:'+key).acquisition,/候選後.*25%/);}
  assert.deepEqual(Loot.CHANCES,{common:20,uncommon:12,rare:6,legendary:3});assert.equal(find('ingredient:meat').drop.conditionalPercent,20);assert.equal(find('item:ration').drop.conditionalPercent,20);
  assert.equal(find('item:arrow').drop.quantity,Loot.ARROW_DROP_QUANTITY);assert.equal(find('item:arrow').drop.quantity,50);assert.match(find('item:arrow').acquisition,/10 支/);assert.match(find('item:arrow').acquisition,/50 支/);
  assert.equal(find('item:arrow').stackLimit,null);assert.match(find('item:arrow').capacityRule,/所有射手/);assert.match(find('item:arrow').capacityRule,/300 支/);assert.match(find('item:arrow').effect,/每一名射手累加/);
  assert.match(Atlas.dropExplanation,/先.*抽一種/);assert.match(Atlas.dropExplanation,/不是每件/);
  assert.match(find('item:map').effect,/18 秒/);assert.match(find('item:map').effect,/下一次變形/);
  assert.match(Atlas.scope.notes.join(' '),/12 秒/);assert.match(Atlas.scope.notes.join(' '),/不是第二件劇情道具/);
  assert.ok(!entries.some(e=>['speed','superspeed','ghost','kite','whistle','egg','pathMap'].includes(e.key)));
});

test('cooking cards preserve real costs and distinguish self, party healing and limited buffs',()=>{
  for(const [id,recipe]of Object.entries(P.RECIPES)){const entry=find('meal:'+id);assert.deepEqual(entry.recipe.cost,recipe.cost);assert.equal(entry.recipe.hp,recipe.hp);assert.equal(entry.recipe.hunger,recipe.hunger);assert.equal(entry.requiredDepth,recipe.requiredDepth||0);assert.equal(entry.underground,!!recipe.requiredDepth);if(recipe.team)assert.match(entry.effect,new RegExp(recipe.team+' 點'));if(recipe.buff)assert.match(entry.effect,/3 層.*2 種/);}
  assert.match(find('meal:stew').description,/任何職業/);assert.match(find('meal:stew').notes.join(' '),/不是有廚師就必定雙倍/);
  const run=fresh(),snapshot=JSON.stringify(run);Atlas.records();assert.equal(JSON.stringify(run),snapshot);
  const Commission=require('../story/tower-commission-cooking.js');for(const[id]of Object.entries(P.RECIPES)){const entry=find('meal:'+id);assert.deepEqual(entry.commission,{fee:Commission.fee(id),category:Commission.category(id),quantity:1});assert.match(entry.acquisition,new RegExp('費用 '+Commission.fee(id)+' 幣'));assert.match(entry.notes.join(' '),/固定一份.*按原配方扣料/);assert.ok(entry.sources.includes(Atlas.SOURCES.commission));}
});

test('grocery supplies and regional ingredients document the same prices, haste duration and availability',()=>{
  const E=require('../story/tower-encounters.js');
  for(const id of Object.keys(C.ITEMS).filter(id=>id!=='coin'&&!(Robot.FUEL_ITEMS[id]?.fuel>25))){assert.match(find('item:'+id).acquisition,/雜貨商・蘇禾/);assert.doesNotMatch(find('item:'+id).acquisition,/鐵匠・鐵嶺|裁甲師・錦禾|盾匠・嵐舟/);}
  assert.match(find('item:haste').effect,new RegExp(C.HASTE_DURATION+' 秒'));assert.match(find('item:haste').effect,new RegExp(C.HASTE_PERCENT+'%'));assert.equal(find('item:haste').drop,null);assert.match(find('item:haste').effect,/不疊加/);
  for(const key of E.GROCERY.commonIngredients)assert.match(find('ingredient:'+key).notes.join(' '),/雜貨商販售常用食材/);
  assert.match(find('ingredient:frostberry').notes.join(' '),/可早於原產地/);assert.match(find('light:torch').acquisition,/雜貨商/);assert.doesNotMatch(find('light:torch').acquisition,/三位行商皆售/);
});

test('torch, raw materials, daylight and tools are current obtainable resources without old spawn promises',()=>{
  assert.match(find('light:torch').effect,new RegExp(L.TORCH_SECONDS+' 秒'));
  assert.match(find('light:daylight').effect,new RegExp(L.DAYLIGHT_SECONDS+' 秒'));
  assert.match(find('light:torch').acquisition,new RegExp('每支 '+L.TORCH_PRICE+' 幣'));
  assert.match(find('light:wood').effect,/木枝 1 份＋布條 1 份/);
  assert.match(find('light:cloth').effect,/木枝 1 份＋布條 1 份/);
  assert.match(find('tool:shovel').acquisition,new RegExp(H.PASSIVES.tool_supply.power.join('／')));
  assert.match(find('material:scrap').effect,/1\.5 倍/);
  assert.match(find('material:scrap').effect,new RegExp('恢復最大耐久'+Math.round(P.CAMP_MAINTENANCE_RATIO*100)+'%'));assert.match(find('material:scrap').effect,/商人銅幣再加20%/);
  assert.match(find('quest:memory').effect,/回原探索者/);
  assert.match(Atlas.scope.notes.join(' '),/不會在開局或變形時自然散放/);
});

test('portable lighting guide matches the live radius ordering, shared party priority and torch fuel rules',()=>{
  const core=find('light:robot-core'),torch=find('light:torch'),daylight=find('light:daylight');
  assert.ok(Robot.CORE_LIGHT_RADII[1]<L.TORCH_RADIUS&&L.TORCH_RADIUS<Robot.CORE_LIGHT_RADII[2]&&Robot.CORE_LIGHT_RADII[2]<L.DAYLIGHT_RADIUS);
  assert.ok(core.effect.includes('無核／單核／雙核範圍 '+Robot.CORE_LIGHT_RADII.join('／')));assert.ok(core.effect.includes('火把 '+L.TORCH_RADIUS+'、日光術 '+L.DAYLIGHT_RADIUS));
  assert.ok(daylight.effect.includes('光照範圍為 '+L.DAYLIGHT_RADIUS));assert.ok(daylight.effect.includes('火把為 '+L.TORCH_RADIUS));assert.match(core.effect,/全隊採最強來源.*日光術優先.*切換領隊不改光源/);
  assert.match(daylight.effect,/日光術優先於核心.*切換領隊不改變光照/);assert.match(daylight.acquisition,/隊伍有仍能行動的術士.*按 L/);assert.match(torch.effect,/日光術或雙核心.*暫停燃料消耗.*單核心期間火把正常燃燒/);
});

test('natural herb and ore records derive independent corner harvesting rules without replenishment',()=>{
  assert.deepEqual(entries.filter(e=>e.foraging&&e.foraging.kind!=='power').map(e=>e.key).sort(),['herb',...Foraging.NATURAL_ORES].sort());
  assert.match(Atlas.scope.notes.join(' '),/不是自然散放補給/);assert.match(Atlas.foragingExplanation,/株數與自然礦石堆數獨立/);assert.match(Atlas.foragingExplanation,/靠牆角落/);assert.match(Atlas.foragingExplanation,/同層變形與讀檔不補回已採集/);
  for(const weights of Object.values(Foraging.PROFILES)){
    assert.ok(Atlas.foragingExplanation.includes([1,2,3].map(n=>Number(weights[n].toFixed(2))+'%').join('／')));
    assert.ok(Atlas.foragingExplanation.includes((100-weights[0])+'% 出現、'+weights[0]+'% 不出現'));
  }
  for(const e of entries.filter(e=>e.foraging&&e.foraging.kind!=='power')){
    assert.equal(e.foraging.quantity,1);assert.deepEqual(e.foraging.profiles,Foraging.PROFILES);assert.ok(e.sources.includes(Atlas.SOURCES.foraging));assert.match(e.acquisition,/靠牆角落/);assert.match(e.acquisition,/每株 1 份|每堆 1 份/);
    const regions=Materials.ECOLOGIES.filter(region=>e.key==='herb'||Foraging.orePool({floor:region.high}).includes(e.key));
    assert.deepEqual(e.foraging.regions,regions.map(region=>({id:region.id,name:region.name,profile:Foraging.REGIONS[region.id][e.foraging.kind]})));
  }
  assert.equal(find('ingredient:herb').drop.quantity,2);assert.equal(find('material:ironore').drop.quantity,2);assert.ok(find('material:starore').foraging.regions.every(region=>region.id.startsWith('underworld:')));assert.match(find('material:starore').acquisition,/僅地下出現/);
});

test('robot fuel stones derive real recovery, rarity, exclusive merchant rules and atomic corner deposits',()=>{
  assert.deepEqual(entries.filter(e=>e.fuel).map(e=>e.key),Robot.fuelItemIds);
  for(const [key,def]of Object.entries(Robot.FUEL_ITEMS)){
    const e=find('item:'+key);assert.equal(e.name,def.name);assert.equal(e.fuel,def.fuel);assert.match(e.effect,new RegExp(def.fuel+'% 能源'));assert.match(e.effect,new RegExp(Robot.FUEL_SECONDS+' 秒'));assert.match(e.effect,/不能攻擊或施放技能.*內建光源與核心自修仍保留/);
    assert.equal(e.buyPrice,def.buyPrice);assert.equal(e.sellPrice,def.sellPrice);assert.equal(e.drop.rarity,def.dropRarity);assert.equal(e.drop.conditionalPercent,Loot.CHANCES[def.dropRarity]);assert.equal(e.drop.quantity,1);
    assert.equal(e.foraging.tier,Foraging.POWER_STONES.indexOf(key)+1);assert.equal(e.foraging.cluster,true);assert.deepEqual(e.foraging.quantity,[1,1]);assert.deepEqual(e.foraging.profiles,Foraging.POWER_PROFILES);
    assert.match(e.acquisition,/靠牆角落.*新樓層每處 1 顆.*初始持有零/);assert.match(e.acquisition,/有能行動的機器人.*候選/);assert.ok(e.sources.includes(Atlas.SOURCES.robot));assert.ok(e.sources.includes(Atlas.SOURCES.foraging));
    assert.equal(Atlas.iconHtml(e),HeroIcons.svg(key));assert.equal(HeroIcons.svg(key),HeroIcons.svg('item_'+key));
    if(def.fuel===25)assert.match(e.acquisition,/雜貨商・蘇禾.*購買 6 幣/);else{assert.doesNotMatch(e.acquisition,/雜貨商・蘇禾/);assert.match(e.acquisition,/商人不販售/);assert.equal(e.buyPrice,null);assert.equal(e.sellPrice,null);}
  }
  for(const [profile,weights]of Object.entries(Foraging.POWER_PROFILES)){
    assert.ok(Atlas.powerForagingExplanation.includes([1,2,3].map(n=>Number(weights[n].toFixed(2))+'%').join('／')));
    assert.ok(Atlas.powerForagingExplanation.includes(weights[0]+'% 不出現'));assert.equal(weights[0],100-Foraging.POWER_APPEARANCE[profile]);
    assert.ok(Math.abs(Object.values(weights).reduce((sum,n)=>sum+n,0)-100)<1e-9);
  }
  assert.match(Atlas.powerForagingExplanation,/每層至多一處礦簇/);assert.match(Atlas.powerForagingExplanation,/新樓層每處只有 1 顆動力石/);assert.match(Atlas.powerForagingExplanation,/同層變形與讀檔不補回/);
  const light=find('light:robot-core');assert.equal(Atlas.iconHtml(light),HeroIcons.svg('robot_core'));assert.match(light.effect,/單核心小於火把.*雙核心大於火把且小於日光術/);assert.doesNotMatch(light.effect,/一至三階.*四五階/);assert.match(light.effect,/能源耗盡仍保留照明/);assert.match(light.notes.join(' '),/眼睛.*身份色/);
  assert.match(find('item:heal').effect,/機器人不能/);assert.match(find('item:feather').effect,/機器人不適用/);for(const r of entries.filter(e=>e.recipe))assert.match(r.notes.join(' '),/一般治療不會修復機器人/);
  for(const [tier,cost]of Object.entries(Robot.CORE_COSTS))for(const key of Object.keys(cost.materials))assert.match(find('material:'+key).effect,new RegExp(Robot.CORES[Robot.kind('robot_core',Number(tier))].name+'製作'));
});

test('power-stone guide separates paused inventory refills from live and automatic item cooldowns',()=>{
  for(const key of Robot.fuelItemIds){const text=find('item:'+key).notes.join(' ');assert.match(text,/暫停背包可連續補充.*滿能源不消耗.*戰鬥快捷欄間隔一秒.*自動使用間隔五秒/);assert.match(text,/同層變形與讀檔不補回/);assert.match(text,/舊旅程已生成的礦簇保留原狀.*新樓層才套用新出現率/);}
});

test('regional ingredient and forging records use real ecological sources, costs and rarity',()=>{
  const X=require('../story/tower-expedition-core.js');
  for(const [key,meta]of Object.entries(Materials.INGREDIENT_META)){
    const r=find('ingredient:'+key);assert.ok(r.description.includes(meta.description),key);
    for(const source of meta.sources)assert.ok(r.acquisition.includes(source),key+' '+source);
    assert.equal(r.drop.rarity,meta.rarity);assert.equal(r.drop.quantity,key==='shell'?1:2);
  }
  for(const [key,meta]of Object.entries(Materials.MATERIAL_META)){
    const r=find('material:'+key);assert.ok(r.description.includes(meta.description));
    for(const source of meta.sources)assert.ok(r.acquisition.includes(source));
    for(const trait of Object.values(X.TRAITS).filter(t=>t.materialCost[key]))assert.ok(r.effect.includes(trait.name));
    assert.match(r.effect,/不當成料理食材/);assert.equal(r.icon.provider,'resource');
    assert.equal(r.drop.conditionalPercent,Loot.CHANCES[meta.rarity]);
  }
  assert.doesNotMatch(find('ingredient:meat').acquisition,/所有怪物|未指定/);
  assert.match(find('ingredient:shell').acquisition,/機關另外給 3/);
  assert.match(Atlas.dropExplanation,/一半機率選素材、一半選補給/);
});

test('browser module can create the same catalogue without timers, storage or network',()=>{
  const host={TowerAffixes:Affixes,TowerAdventureEvents:Events,TowerLandmarks:Landmarks,TowerRobotCore:require('../story/tower-robot-core.js'),TowerCommissionCooking:require('../story/tower-commission-cooking.js'),TowerMaterials:Materials,TowerForaging:Foraging,TowerCore:C,TowerPartyCore:P,TowerHeroes:H,TowerLighting:L,TowerEncounters:require('../story/tower-encounters.js'),TowerNarrative:N,TowerLoot:Loot,TowerExpedition:require('../story/tower-expedition-core.js'),TowerFieldGuide:require('../story/tower-field-guide.js'),TowerHeroIcons:require('../story/tower-heroes-icons.js'),TowerResourceIcons:Icons,TowerPartyRuntime:globalThis.TowerPartyRuntime,TowerLightingRuntime:globalThis.TowerLightingRuntime};
  host.globalThis=host;vm.runInNewContext(fs.readFileSync(path.join(base,'docs/story-atlas-items.js'),'utf8'),host);
  assert.deepEqual(JSON.parse(JSON.stringify(host.StoryAtlasItems.records())),JSON.parse(JSON.stringify(entries)));
  assert.equal(host.StoryAtlasItems.iconHtml(find('item:heal')),Atlas.iconHtml(find('item:heal')));
  assert.equal(host.StoryAtlasItems.iconHtml(find('material:scrap')),Icons.svg('scrap'));
});
