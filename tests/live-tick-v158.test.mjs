import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js');

function journeys(){
  const legacy=C.newRun({seed:11});legacy.effects.haste=40;legacy.monsterStuns={'monster-1':3};
  const party=P.enable(C.newRun({seed:12}),'mage').run;party.effects.haste=12;
  const heroes=H.enable(P.enable(C.newRun({seed:13}),'robot','female').run).run;
  return [legacy,party,heroes];
}
test('the live frame tick does exactly the bookkeeping of the validating tick, in place and without copying the save',()=>{
  for(const start of journeys()){
    let pure=JSON.parse(JSON.stringify(start)),live=JSON.parse(JSON.stringify(start));const liveRef=live;
    for(const dt of [.016,.016,.033,.5,1,.016,2.25,.05,3,.016]){const a=C.tickEffects(pure,dt),b=C.tickEffectsLive(live,dt);assert.equal(a.ok,b.ok);assert.equal(a.message,b.message);assert.deepEqual(a.effect,b.effect);pure=a.run;live=b.run;}
    assert.equal(live,liveRef,'the live run object is updated in place');assert.deepEqual(JSON.parse(JSON.stringify(live)),JSON.parse(JSON.stringify(pure)));assert.ok(C.validateSave(JSON.stringify(live)));
  }
  const bad=C.newRun({seed:1});assert.equal(C.tickEffectsLive(bad,-1).ok,false);assert.equal(C.tickEffectsLive(bad,NaN).ok,false);bad.status='won';assert.equal(C.tickEffectsLive(bad,1).ok,false);
});
test('the engine re-validates at least once per second of play and resets the clock with each floor',()=>{
  const mode=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(mode,/const validateNow = liveValidateClock >= 1 \|\| !C\.tickEffectsLive; if \(validateNow\) liveValidateClock = 0;/);
  assert.match(mode,/const ticked = validateNow \? C\.tickEffects\(run, dt\) : C\.tickEffectsLive\(run, dt\);/);
  assert.match(mode,/hiddenDuringShift = 0; liveValidateClock = 0;/);
});
