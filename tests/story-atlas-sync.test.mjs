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
  assert.equal(c.StoryAtlasRules.build().jobs.length,7);
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
  assert.equal(records.length,312);
});

test('current game and read-only reference share the release version and accessible entry links',()=>{
  const index=readFileSync(resolve(base,'index.html'),'utf8'),pkg=JSON.parse(readFileSync(resolve(base,'package.json'),'utf8'));
  assert.ok(index.includes("const GAME_VERSION='"+pkg.version+"'"));assert.ok(html.includes('v'+pkg.version+' 圖鑑'));
  assert.match(index,/href="docs\/職業裝備圖鑑.html"[^>]*rel="noopener"/);
  assert.match(readFileSync(resolve(base,'story/tower-mode.js'),'utf8'),/docs\/職業裝備圖鑑.html/);
  for(const file of ['tower-cooperation-core.js','tower-cooperation-runtime.js','tower-forge-icons.js','tower-resource-icons.js','tower-materials.js']){
    assert.ok(index.includes('story/'+file));assert.ok(html.includes('../story/'+file));
  }
});
