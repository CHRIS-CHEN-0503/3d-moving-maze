// v1.61.1 · review round: the fixes below are wired into the browser runtimes, which the node suites
// cannot execute, so each one is pinned at its source and, where possible, exercised directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mode=read('story/tower-mode.js'),party=read('story/tower-party-runtime.js'),index=read('index.html');

test('chapter lords play their attack poses in the live tick and rest while stunned, held or guarded',()=>{
  assert.doesNotMatch(mode,/if\(!cinema\)Lords\?\.pose/,'the director object always exists, so this guard disabled the poses');
  assert.match(mode,/Lords\?\.pose\?\.\(m\.model,\{windup:m\.windup,total:m\.windupTotal,strike:m\.strikeLeft\}\)/);
  assert.match(mode,/const restLord=m=>\{if\(m\.lord&&m\.model\)\{m\.strikeLeft=0;Lords\?\.pose\?\.\(m\.model,\{\}\);\}\};/);
  assert.equal((mode.match(/restLord\(m\);return;\}/g)||[]).length,3,'stunned, held and guarded branches all rest the lord');
  assert.match(mode,/if\(event==='defeat'&&m\?\.model\)\{window\.TowerCombatReadability\?\.update\?\.\(THREE,m,\{visible:false\}\);restLord\(m\);/,'the farewell close-up starts from a clean pose');
  assert.match(mode,/m\.def\.name\+\(m\.lord\?'・樓層主':''\)\+\(stunned\?'（暈）':''\)/,'the lord suffix survives a tag rebuild');
});

test('cutscenes own the keyboard and the dungeon clock commits four times a second',()=>{
  assert.match(mode,/if \(cinema\?\.active\) return;\n      if \(!overlay\.hidden\) \{/);
  assert.match(mode,/dungeonClock\+=dt;\n    if\(dungeonClock>=\.25\)\{const seconds=dungeonClock;dungeonClock=0;const result=D\.tick\(run,seconds\);/);
  assert.match(mode,/function finishDungeon\(outcome\) \{\n    dungeonClock=0;/);
});

test('hunt rifts get health bars, lab picks reset with the party and a gather releases its members',()=>{
  assert.match(party,/if\(ctx\.inDungeon\(\)\)\{syncActors\(\);if\(ctx\.inHunt\?\.\(\)\)refreshMonsters\(\);return;\}/);
  assert.match(party,/worldSeed=null;working=null;labPick=\{\};/);
  assert.match(party,/function releaseAssembly\(ids\)\{for\(const a of actors\)if\(a\.assembly&&\(!ids\|\|ids\.includes\(a\.id\)\)\)a\.assembly=null;\}/);
  assert.match(party,/assemble,release:releaseAssembly,/);
  assert.match(read('story/tower-cooperation-runtime.js'),/const members=gather\.members;gather=null;last='';ctx\.release\?\.\(members\);/);
  assert.match(party,/heroes\?\.reset\(\{keepUpgrades:true\}\)/,'a maze shift keeps the better-gear prompt');
  assert.match(read('story/tower-heroes-runtime.js'),/function reset\(options\)\{if\(!options\?\.keepUpgrades\)\{upgrades=\[\];upgradeAlert\(\);\}/);
});

test('the GM ladder lists every profession',()=>{
  const GM=require('../story/tower-gm.js'),P=require('../story/tower-party-core.js');
  assert.match(read('story/tower-gm.js'),/JOB_ORDER=\[[^\]]*'cleric'\]/);
  for(const job of Object.keys(P.PROFESSIONS))assert.ok(GM.build({floor:90,job,level:3,seed:1}).run,job+' builds');
});

test('the prayer wand counts game seconds',()=>{
  const visuals=read('story/tower-heroes-visuals.js');
  assert.doesNotMatch(visuals,/prayerUntil/);
  assert.match(visuals,/model\.userData\.prayerLeft=Math\.max\(\.2,seconds\);return wand;/);
  assert.match(visuals,/praying=\(model\.userData\.prayerLeft=Math\.max\(0,\(model\.userData\.prayerLeft\|\|0\)-Math\.max\(0,Number\(dt\)\|\|0\)\)\)>0/);
});

test('service merchants are found without building the whole shop, and the roster matches the offers',()=>{
  const E=require('../story/tower-encounters.js');
  for(let floor=99;floor>=1;floor-=7)for(const seed of [1,2,3]){const offers=E.merchantOffers(floor,seed,true).map(o=>o.id).filter(id=>Object.hasOwn(E.MERCHANT_SERVICES||{},id)||!['suHe','hunter'].includes(id));
    for(const id of offers)assert.ok(E.serviceContext({floor,seed,party:{}},id),floor+':'+seed+' '+id+' present');}
  assert.match(read('story/tower-encounters.js'),/const hasServiceMerchant=\(run,merchantId\)=>!!run&&merchantRoster\(run\.floor,run\.seed\)\.includes\(merchantId\);/);
});

test('story stage pixels are generated once per region',()=>{
  const theater=read('story/tower-story-theater.js');
  assert.match(theater,/const SURFACE_PIXELS=new Map\(\);/);
  assert.match(theater,/let pixels=SURFACE_PIXELS\.get\(cacheKey\);\n      if\(!pixels\)\{pixels=new Uint8Array\(size\*size\*4\);/);
  assert.match(theater,/SURFACE_PIXELS\.set\(cacheKey,pixels\);\}/);
});

test('room packets are validated and the reconnect counter survives the lifecycle wrapper',()=>{
  assert.match(read('assets/room-lifecycle.js'),/mpConnect=async function\(\.\.\.args\)\{await connect\(\.\.\.args\);ensureTimer\(\);\};/);
  assert.match(index,/if\(p&&\[m\.x,m\.z,m\.h\]\.every\(Number\.isFinite\)&&Math\.abs\(m\.x\)<=G\.mazeW\*G\.cell\/2&&Math\.abs\(m\.z\)<=G\.mazeH\*G\.cell\/2\)\{p\.tx=m\.x;/);
  assert.match(index,/const dh=Math\.atan2\(Math\.sin\(p\.th-p\.mesh\.rotation\.y\),Math\.cos\(p\.th-p\.mesh\.rotation\.y\)\);/);
  assert.doesNotMatch(index,/while\(dh>Math\.PI\)/,'no unbounded wrap loop on remote headings');
  assert.match(index,/case 'prank':\n      if\(!MP\.started\|\|MP\.ended\|\|!MP\.roster\.some\(r=>r\.id===m\.f\)\)break;/);
  assert.match(index,/case 'gather':\n      if\(!MP\.started\|\|MP\.ended\|\|!MP\.roster\.some\(r=>r\.id===m\.f\)\|\|!Number\.isFinite\(m\.x\)/);
  assert.match(index,/if\(!Array\.isArray\(m\.players\)\|\|!m\.players\.some\(p=>p\?\.id===MP\.id\)\)break;/,'lobby packets need the device in the list');
  assert.match(index,/if\(!MP\.host&&!\(Array\.isArray\(m\.order\)&&m\.order\.includes\(MP\.id\)\)\)break;/,'start packets need the device in the order');
  assert.match(index,/case 'reach':\n      if\(!MP\.started\|\|MP\.mode!=='race'\|\|MP\.ended\|\|!MP\.roster\.some\(r=>r\.id===m\.f\)\)break;/);
  assert.match(index,/case 'out':\n      if\(MP\.outs\[m\.f\]\|\|!MP\.roster\.some\(r=>r\.id===m\.f\)\)break;/);
  assert.match(index,/if\(p\.mesh\)\{scene\.remove\(p\.mesh\);disposeSceneObject\(p\.mesh\);\}/,'leaving a room disposes the other characters');
});

test('classic HUD and storage hardening',()=>{
  assert.match(index,/startItemLoop\(\)\{\n   if\(this\.itemLoopTimer\|\|G\.muted\) return;/);
  assert.match(index,/function storageGet\(key\)\{try\{return localStorage\.getItem\(key\);\}catch\(_\)\{return null;\}\}/);
  assert.match(index,/function storageSet\(key,value\)\{try\{localStorage\.setItem\(key,value\);\}catch\(_\)\{\}\}/);
  assert.doesNotMatch(index.replace(/function storageGet[^\n]*\n/,'').replace(/function storageSet[^\n]*\n/,''),/^[^\n]*localStorage\.setItem/m,'every write goes through storageSet');
  assert.match(index,/timeSec:Math\.max\(1,Math\.round\(timeSec\)\)/);
  assert.match(index,/if\(updateSatietyBar\.caption!==caption\)\{\$\('satietyPct'\)\.textContent=caption;updateSatietyBar\.caption=caption;\}/);
  assert.match(index,/function setHudClock\(text\)\{if\(setHudClock\.last===text\)return;setHudClock\.last=text;/);
  assert.match(index,/if\(updateSmell\.last!==smell\)\{\$\('smellTxt'\)\.textContent=smell;updateSmell\.last=smell;\}/);
  assert.match(index,/if\(renderChips\.signature!==signature\)\{renderChips\.signature=signature;/);
  assert.match(index,/if\(preWarnTimer\)\{clearInterval\(preWarnTimer\);preWarnTimer=0;\$\('preWarn'\)\.style\.display='none';G\.preWarned=false;\}/);
});

test('the score API refuses oversized bodies and clamps impossible scores',async()=>{
  const api=await import('../functions/api/scores.js');
  let stored=null;
  const call=(body,headers={})=>api.onRequestPost({request:new Request('https://x/api/scores',{method:'POST',headers:{'content-type':'text/plain',...headers},body:JSON.stringify(body)}),env:{SCORES:{get:async()=>'[]',put:async(key,value)=>{stored=JSON.parse(value);}}}});
  const ok={name:'a',char:'🐱',level:'indoor',timeSec:30,score:5550,date:'2026-10-11'};
  assert.equal((await call(ok)).status,200);assert.equal(stored[0].score,5550);
  assert.equal((await call({...ok,score:9000})).status,200);assert.equal(stored[0].score,Math.max(100,6000-30*15)+3000,'score beyond the formula plus stars is clamped');
  assert.equal((await call(ok,{'content-length':'5000'})).status,413);
});

test('phone item views use the compact row layout',()=>{
  const css=read('story/tower-mobile.css');
  assert.match(css,/#towerDialog \.tower-grid>\.supply-card\{display:grid;grid-template-columns:34px minmax\(0,1fr\) auto;grid-template-areas:"icon title button" "icon text button" "guide guide guide"/);
  assert.match(css,/#towerDialog \.hero-equipped\{display:grid;grid-template-columns:40px minmax\(0,1fr\);grid-auto-flow:dense/);
  assert.match(css,/#towerDialog \.tower-grid>\.party-recipe,#towerDialog \.tower-grid>\.party-prepared-meal\{padding:7px 9px;gap:4px\}/);
});
