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
