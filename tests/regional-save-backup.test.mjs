import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js');
test('regional upgrade backs up the original stock before writing and fails closed when backup storage is full',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  const save=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal'));
  const old=H.enable(P.enable(C.newRun({seed:35}),'chef').run).run;
  old.party.ingredients=Object.fromEntries(['root','mushroom','herb','nectar','meat','shell'].map(key=>[key,old.party.ingredients[key]]));
  old.party.ingredients.meat=7;old.party.meals.crab=2;delete old.party.journey.materials;
  const raw=JSON.stringify(old),run=C.validateSave(raw),SAVE='maze3d_tower_v1',backup=SAVE+'_before_regional_crafting',storage=new Map([[SAVE,raw]]);
  assert.ok(run);let fail=true;
  const ctx=vm.createContext({C,run,SAVE,saveFailed:false,syncEngine(){},showToast(){},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(fail&&k===backup)throw Error('quota');storage.set(k,v);}}});
  vm.runInContext(save,ctx);assert.equal(ctx.save(),false);assert.equal(storage.get(SAVE),raw);assert.equal(storage.has(backup),false);
  fail=false;assert.equal(ctx.save(),true);assert.equal(storage.get(backup),raw);assert.equal(JSON.parse(storage.get(SAVE)).party.ingredients.meat,7);assert.equal(JSON.parse(storage.get(SAVE)).party.meals.crab,2);
  ctx.run.party.ingredients.meat=6;assert.equal(ctx.save(),true);assert.equal(storage.get(backup),raw,'never overwrite the original backup');
});
