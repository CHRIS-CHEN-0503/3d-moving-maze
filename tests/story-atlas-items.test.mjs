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
const Materials=require('../story/tower-materials.js');
require('../story/tower-party-runtime.js');require('../story/tower-lighting-runtime.js');
const entries=Atlas.records(),find=id=>entries.find(r=>r.id===id),fresh=()=>H.enable(P.enable(C.newRun({seed:71}),'mage').run).run;

test('atlas derives every current inventory item, ingredient, recipe and all 15 chapter tokens',()=>{
  assert.deepEqual(entries.filter(e=>e.id.startsWith('item:')).map(e=>e.key).sort(),Object.keys(C.ITEMS).sort());
  assert.deepEqual(entries.filter(e=>e.id.startsWith('ingredient:')).map(e=>e.key).sort(),Object.keys(P.INGREDIENTS).sort());
  assert.deepEqual(entries.filter(e=>e.id.startsWith('meal:')).map(e=>e.key).sort(),Object.keys(P.RECIPES).sort());
  assert.equal(N.allChapters().length,15);
  for(const chapter of N.allChapters()){const item=find(chapter.clueId);assert.equal(item.name,chapter.clueName);assert.equal(item.midFloor,chapter.mid);assert.equal(item.gateFloor,chapter.low);assert.equal(item.spoiler,true);}
  assert.equal(entries.length,81);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
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
  for(const e of entries.filter(e=>e.drop))assert.equal(e.drop.conditionalPercent,Loot.CHANCES[e.drop.rarity]);
  assert.equal(find('item:arrow').drop.quantity,12);assert.match(find('item:arrow').acquisition,/10 支/);assert.match(find('item:arrow').acquisition,/12 支/);
  assert.match(Atlas.dropExplanation,/先.*抽一種/);assert.match(Atlas.dropExplanation,/不是每件/);
  assert.match(find('item:map').effect,/18 秒/);assert.match(find('item:map').effect,/下一次變形/);
  assert.match(Atlas.scope.notes.join(' '),/12 秒/);assert.match(Atlas.scope.notes.join(' '),/不是第二件劇情道具/);
  assert.ok(!entries.some(e=>['speed','superspeed','ghost','kite','whistle','egg','pathMap'].includes(e.key)));
});

test('cooking cards preserve real costs and distinguish self, party healing and limited buffs',()=>{
  for(const [id,recipe]of Object.entries(P.RECIPES)){const entry=find('meal:'+id);assert.deepEqual(entry.recipe.cost,recipe.cost);assert.equal(entry.recipe.hp,recipe.hp);assert.equal(entry.recipe.hunger,recipe.hunger);assert.equal(entry.requiredDepth,recipe.requiredDepth||0);assert.equal(entry.underground,!!recipe.requiredDepth);if(recipe.team)assert.match(entry.effect,new RegExp(recipe.team+' 點'));if(recipe.buff)assert.match(entry.effect,/3 層.*2 種/);}
  assert.match(find('meal:stew').description,/任何職業/);assert.match(find('meal:stew').notes.join(' '),/不是有廚師就必定雙倍/);
  const run=fresh(),snapshot=JSON.stringify(run);Atlas.records();assert.equal(JSON.stringify(run),snapshot);
});

test('torch, raw materials, daylight and tools are current obtainable resources without old spawn promises',()=>{
  assert.match(find('light:torch').effect,new RegExp(L.TORCH_SECONDS+' 秒'));
  assert.match(find('light:daylight').effect,new RegExp(L.DAYLIGHT_SECONDS+' 秒'));
  assert.match(find('light:torch').acquisition,new RegExp('每支 '+L.TORCH_PRICE+' 幣'));
  assert.match(find('light:wood').effect,/木枝 1 份＋布條 1 份/);
  assert.match(find('light:cloth').effect,/木枝 1 份＋布條 1 份/);
  assert.match(find('tool:shovel').acquisition,new RegExp(H.PASSIVES.tool_supply.power.join('／')));
  assert.match(find('material:scrap').effect,/1\.5 倍/);
  assert.match(find('quest:memory').effect,/回原探索者/);
  assert.match(Atlas.scope.notes.join(' '),/不會在開局或變形時自然散放/);
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
  const host={TowerMaterials:Materials,TowerCore:C,TowerPartyCore:P,TowerHeroes:H,TowerLighting:L,TowerEncounters:require('../story/tower-encounters.js'),TowerNarrative:N,TowerLoot:Loot,TowerExpedition:require('../story/tower-expedition-core.js'),TowerFieldGuide:require('../story/tower-field-guide.js'),TowerHeroIcons:require('../story/tower-heroes-icons.js'),TowerResourceIcons:Icons,TowerPartyRuntime:globalThis.TowerPartyRuntime,TowerLightingRuntime:globalThis.TowerLightingRuntime};
  host.globalThis=host;vm.runInNewContext(fs.readFileSync(path.join(base,'docs/story-atlas-items.js'),'utf8'),host);
  assert.deepEqual(JSON.parse(JSON.stringify(host.StoryAtlasItems.records())),JSON.parse(JSON.stringify(entries)));
  assert.equal(host.StoryAtlasItems.iconHtml(find('item:heal')),Atlas.iconHtml(find('item:heal')));
  assert.equal(host.StoryAtlasItems.iconHtml(find('material:scrap')),Icons.svg('scrap'));
});
