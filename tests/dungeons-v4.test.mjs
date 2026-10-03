import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),D=require('../story/tower-dungeons.js');
function at(floor,seed,version){const r=C.newRun({seed});r.floor=floor;r.floorsCleared=99-floor;r.expedition=D.newExpedition(version);return r;}
function stars(version){for(let seed=1;seed<1000;seed++){const r=at(29,seed,version),o=D.offer(r);if(o?.kind==='stars')return {r,o};}throw Error('Missing stars fixture');}
test('v4 adds exactly ten seconds to every scaled rift interval, without changing generation or rewards',()=>{
  const kinds=new Set(),tiers=new Set();
  for(let seed=1;seed<=30;seed++)for(let floor=99;floor>=1;floor--){
    const old=D.offer(at(floor,seed,3)),next=D.offer(at(floor,seed,4));
    assert.equal(!!next,!!old);if(!old)continue;
    assert.equal(next.shiftSeconds,old.shiftSeconds+10);
    assert.deepEqual({...next,shiftSeconds:old.shiftSeconds,catalogVersion:3},old);
    kinds.add(next.kind);tiers.add(next.tier);
  }
  assert.equal(kinds.size,9);assert.equal(tiers.size,5);assert.equal(D.SHIFT_INTERVAL_BONUS,10);
});
test('v3 in-progress star shifts retain identity and timing; descent enables v4 without losing history',()=>{
  let {r,o}=stars(3);r=D.enter(D.discover(r).run,o.id,{x:0,y:0,shiftLeft:10}).run;
  r=D.interact(r,0).run;r=D.tick(r,o.shiftSeconds).run;r=D.observeShift(r).run;
  assert.equal(r.expedition.active.shiftCount,1);assert.deepEqual(C.validateSave(JSON.stringify(r)),r);
  assert.equal(D.offer(r).shiftSeconds,o.shiftSeconds);
  r=D.finish(r,'abandoned').run;r=C.descend(r).run;
  assert.equal(r.expedition.version,4);assert.equal(r.expedition.history[0].catalogVersion,3);assert.ok(C.validateSave(r));
});
test('v4 star progress requires the longer interval and survives reload and completion',()=>{
  let {r,o}=stars(4);r=D.enter(D.discover(r).run,o.id,{x:0,y:0,shiftLeft:10}).run;
  r=D.interact(r,0).run;r=D.tick(r,o.shiftSeconds-1).run;
  assert.equal(D.observeShift(r).ok,false);
  const forged=structuredClone(r);forged.expedition.active.shiftCount=1;assert.equal(C.validateSave(forged),null);
  r=D.tick(r,1).run;r=D.observeShift(r).run;assert.equal(r.expedition.active.shiftCount,1);
  for(const index of o.order.slice(1))r=D.interact(r,index,r.revision,{choice:o.steps[index].correctChoice}).run;
  assert.equal(r.expedition.active.progress.length,3);assert.ok(C.validateSave(r));
  r=D.finish(r,'completed').run;assert.equal(r.expedition.history[0].catalogVersion,4);assert.ok(C.validateSave(r));
});
