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
require('../story/tower-party-runtime.js');require('../story/tower-lighting-runtime.js');
const entries=Atlas.records(),find=id=>entries.find(r=>r.id===id),fresh=()=>H.enable(P.enable(C.newRun({seed:71}),'mage').run).run;

test('atlas derives every current inventory item, ingredient, recipe and all 15 chapter tokens',()=>{
  assert.deepEqual(entries.filter(e=>e.id.startsWith('item:')).map(e=>e.key).sort(),Object.keys(C.ITEMS).sort());
  assert.deepEqual(entries.filter(e=>e.id.startsWith('ingredient:')).map(e=>e.key).sort(),Object.keys(P.INGREDIENTS).sort());
  assert.deepEqual(entries.filter(e=>e.id.startsWith('meal:')).map(e=>e.key).sort(),Object.keys(P.RECIPES).sort());
  assert.equal(N.allChapters().length,15);
  for(const chapter of N.allChapters()){const item=find(chapter.clueId);assert.equal(item.name,chapter.clueName);assert.equal(item.midFloor,chapter.mid);assert.equal(item.gateFloor,chapter.low);assert.equal(item.spoiler,true);}
  assert.equal(entries.length,82);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
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
  for(const id of Object.keys(C.ITEMS).filter(id=>id!=='coin')){assert.match(find('item:'+id).acquisition,/雜貨商・蘇禾/);assert.doesNotMatch(find('item:'+id).acquisition,/鐵匠・鐵嶺|裁甲師・錦禾|盾匠・嵐舟/);}
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

test('natural herb and ore records derive independent corner harvesting rules without replenishment',()=>{
  assert.deepEqual(entries.filter(e=>e.foraging).map(e=>e.key).sort(),['herb',...Foraging.NATURAL_ORES].sort());
  assert.match(Atlas.scope.notes.join(' '),/不是自然散放補給/);assert.match(Atlas.foragingExplanation,/株數與礦石堆數獨立/);assert.match(Atlas.foragingExplanation,/靠牆角落/);assert.match(Atlas.foragingExplanation,/同層變形與讀檔不補回已採集/);
  for(const weights of Object.values(Foraging.PROFILES))assert.ok(Atlas.foragingExplanation.includes([1,2,3].map(n=>weights[n]+'%').join('／')));
  for(const e of entries.filter(e=>e.foraging)){
    assert.equal(e.foraging.quantity,1);assert.deepEqual(e.foraging.profiles,Foraging.PROFILES);assert.ok(e.sources.includes(Atlas.SOURCES.foraging));assert.match(e.acquisition,/靠牆角落/);assert.match(e.acquisition,/每株 1 份|每堆 1 份/);
    const regions=Materials.ECOLOGIES.filter(region=>e.key==='herb'||Foraging.orePool({floor:region.high}).includes(e.key));
    assert.deepEqual(e.foraging.regions,regions.map(region=>({id:region.id,name:region.name,profile:Foraging.REGIONS[region.id][e.foraging.kind]})));
  }
  assert.equal(find('ingredient:herb').drop.quantity,2);assert.equal(find('material:ironore').drop.quantity,2);assert.ok(find('material:starore').foraging.regions.every(region=>region.id.startsWith('underworld:')));assert.match(find('material:starore').acquisition,/僅地下出現/);
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
  const host={TowerRobotCore:require('../story/tower-robot-core.js'),TowerCommissionCooking:require('../story/tower-commission-cooking.js'),TowerMaterials:Materials,TowerForaging:Foraging,TowerCore:C,TowerPartyCore:P,TowerHeroes:H,TowerLighting:L,TowerEncounters:require('../story/tower-encounters.js'),TowerNarrative:N,TowerLoot:Loot,TowerExpedition:require('../story/tower-expedition-core.js'),TowerFieldGuide:require('../story/tower-field-guide.js'),TowerHeroIcons:require('../story/tower-heroes-icons.js'),TowerResourceIcons:Icons,TowerPartyRuntime:globalThis.TowerPartyRuntime,TowerLightingRuntime:globalThis.TowerLightingRuntime};
  host.globalThis=host;vm.runInNewContext(fs.readFileSync(path.join(base,'docs/story-atlas-items.js'),'utf8'),host);
  assert.deepEqual(JSON.parse(JSON.stringify(host.StoryAtlasItems.records())),JSON.parse(JSON.stringify(entries)));
  assert.equal(host.StoryAtlasItems.iconHtml(find('item:heal')),Atlas.iconHtml(find('item:heal')));
  assert.equal(host.StoryAtlasItems.iconHtml(find('material:scrap')),Icons.svg('scrap'));
});
