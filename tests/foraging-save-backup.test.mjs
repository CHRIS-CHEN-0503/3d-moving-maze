import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),F=require('../story/tower-foraging.js');
test('foraging upgrade backs up the exact old save once and fails closed if backup fails',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),save=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal'));
  const old=H.enable(P.enable(C.newRun({seed:35}),'chef').run).run;delete old.party.foraging;
  const raw=JSON.stringify(old),run=C.validateSave(raw),SAVE='maze3d_tower_v1',backup=SAVE+'_before_foraging_v1',storage=new Map([[SAVE,raw]]);
  assert.ok(run);assert.equal(run.party.foraging.seed,35);let fail=true;
  const ctx=vm.createContext({C,run,SAVE,saveFailed:false,syncEngine(){},showToast(){},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(fail&&k===backup)throw Error('quota');storage.set(k,v);}}});
  vm.runInContext(save,ctx);assert.equal(ctx.save(),false);assert.equal(storage.get(SAVE),raw);assert.equal(storage.has(backup),false);
  fail=false;assert.equal(ctx.save(),true);assert.equal(storage.get(backup),raw);
  const entry=F.specs(run)[0];assert.ok(entry);const result=F.claim(run,entry.id);assert.ok(result.ok);ctx.run=result.run;
  assert.equal(ctx.save(),true);assert.equal(storage.get(backup),raw);assert.ok(C.validateSave(storage.get(SAVE)).party.foraging.claimed.includes(entry.id));
  assert.ok(!F.specs(C.validateSave(storage.get(SAVE))).some(s=>s.id===entry.id));
});
test('v1, v2 and v3 upgrades preserve exact original backups, resources and receipts across read/write failures',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),save=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal'));
  const SAVE='maze3d_tower_v1',backup=SAVE+'_before_foraging_v4';
  for(const version of [1,2,3])for(const failure of ['read-main','read-backup','write-backup','write-main','none']){
    const original=H.enable(P.enable(C.newRun({seed:35,name:'舊採集備份'}),'robot').run).run,context={floor:original.floor,seed:original.seed},harvestRule=version===3?2:1,powerRule=version===1?1:version===2?2:3,counts=F.drawCounts(context,harvestRule),power=F.drawPowerDeposit(context,powerRule),claimed=[];
    if(counts.herb)claimed.push(`foraging:${original.floor}:herb:0`);if(power)claimed.push(`foraging:${original.floor}:power:0`);
    original.party.foraging=version===1?{version,...context,claimed}:version===2?{version,...context,claimed,powerRule,power}:{version,...context,claimed,harvestRule,counts,powerRule,power};
    const raw=JSON.stringify(original,null,2),run=C.validateSave(raw);assert.ok(run,`v${version}`);assert.equal(run.party.foraging.version,4);
    const remaining=F.specs(run),storage=new Map([[SAVE,raw]]);let fail=failure!=='none';
    const ctx=vm.createContext({C,run,SAVE,saveFailed:false,syncEngine(){},showToast(){},localStorage:{getItem(k){if(fail&&(failure==='read-main'&&k===SAVE||failure==='read-backup'&&k===backup))throw Error('storage read');return storage.get(k)||null;},setItem(k,v){if(fail&&(failure==='write-backup'&&k===backup||failure==='write-main'&&k===SAVE))throw Error('quota');storage.set(k,v);}}});
    vm.runInContext(save,ctx);
    assert.equal(ctx.save(),failure==='none',`v${version}/${failure}`);
    if(failure!=='none'){assert.equal(storage.get(SAVE),raw);assert.equal(storage.get(backup),failure==='write-main'?raw:undefined);assert.deepEqual(ctx.run,run);}
    fail=false;assert.equal(ctx.save(),true);assert.equal(storage.get(backup),raw);const restored=C.validateSave(storage.get(SAVE));assert.ok(restored);assert.deepEqual(restored.party.foraging,run.party.foraging);assert.deepEqual(F.specs(restored),remaining);assert.deepEqual(restored.bag,original.bag);assert.deepEqual(restored.party.ingredients,original.party.ingredients);assert.deepEqual(restored.party.journey.materials,original.party.journey.materials);
    assert.equal(ctx.save(),true);assert.equal(storage.get(backup),raw,'Second save cannot replace the original backup');
    const reloaded=F.validate(restored.party.foraging,restored.floor,restored.seed);assert.deepEqual(reloaded,run.party.foraging);assert.deepEqual(reloaded.counts,counts);assert.deepEqual(reloaded.power,power);assert.deepEqual(reloaded.claimed,claimed);
  }
});
test('already-current saves never create or overwrite historical foraging backups',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),save=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal'));
  const run=H.enable(P.enable(C.newRun({seed:35}),'robot').run).run,SAVE='maze3d_tower_v1',backup=SAVE+'_before_foraging_v4';
  for(const previousBackup of [null,'Original previous-generation raw']){
    const storage=new Map([[SAVE,JSON.stringify(run)]]);if(previousBackup!==null)storage.set(backup,previousBackup);
    const ctx=vm.createContext({C,run,SAVE,saveFailed:false,syncEngine(){},showToast(){},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);}}});
    vm.runInContext(save,ctx);assert.equal(ctx.save(),true);assert.equal(storage.get(backup),previousBackup??undefined);
  }
});
test('historical browser fixtures close the active tab before reload autosave can overwrite their old raw snapshot',()=>{
  const source=readFileSync(new URL('../tools/tower-foraging-browser-qa.mjs',import.meta.url),'utf8'),start=source.indexOf('    legacy(version){'),end=source.indexOf('    storage(){',start);assert.ok(start>=0&&end>start);
  const method=source.slice(start,end),SAVE='maze3d_tower_v1';
  for(const version of [1,2,3]){
    const run=H.enable(P.enable(C.newRun({seed:35}),'robot').run).run,before=structuredClone(run),storage=new Map([[SAVE,JSON.stringify(run)]]);let ctx;
    ctx=vm.createContext({C,Foraging:F,run,SAVE,version,active:true,floorStarted:true,structuredClone,save(){storage.set(SAVE,JSON.stringify(ctx.run));},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);},removeItem(k){storage.delete(k);}}});
    const old=vm.runInContext('({'+method+'}).legacy(version)',ctx);assert.equal(ctx.active,false);assert.equal(ctx.floorStarted,false);assert.deepEqual(run,before);assert.equal(JSON.parse(old.raw).party.foraging.version,version);assert.ok(C.validateSave(old.raw));
    vm.runInContext('if(active)save()',ctx);assert.equal(storage.get(SAVE),old.raw,'The genuine pagehide save gate must leave the historical raw untouched');
  }
});
test('foraging is loaded before party rules on game and atlas pages',()=>{
  for(const name of ['index.html','docs/職業裝備圖鑑.html']){
    const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');
    assert.ok(html.includes('tower-foraging.js?v='));
    assert.ok(html.indexOf('tower-foraging.js?v=')<html.indexOf('tower-party-core.js?v='));
  }
  const runtime=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(runtime,/Foraging\.plan\(run,G,\{excludeCells:excluded\}\)/);
  assert.match(runtime,/Foraging\.claim\(run,item\.id\)/);
  assert.match(runtime,/if\(!item\.foraging\)/,'natural resources stay rooted instead of floating like combat loot');
});
