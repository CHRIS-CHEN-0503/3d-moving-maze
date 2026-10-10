import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-adventure-events.js');
function fresh(floor,seed=31415){const run=H.enable(P.enable(C.newRun({seed,name:'護罩提示測試'}),'swordsman').run).run;run.floor=floor;run.floorsCleared=99-floor;P.advance(run);assert.ok(C.validateSave(run));return run;}
test('the garden queen shield notice counts vines, repeats the hint text and disappears once exposed',()=>{
  const run=fresh(80);E.ensure(run);assert.equal(E.guardNotice(run),null,'no notice before the shield');
  run.party.health['monster-11']=200;assert.equal(E.limitLordDamage(run,'monster-11',150,200),100);run.party.health['monster-11']=100;
  let notice=E.guardNotice(run);assert.ok(notice);assert.match(notice.objective,/供能藤 0\/2/);assert.match(notice.hint,/還剩 2 根/);assert.equal(notice.color,0x78a768);assert.equal(notice.help,'樓主護罩說明');
  assert.equal(E.limitLordDamage(run,'monster-11',50,200),0,'guarded hits deal nothing');
  let state=E.counter(run,0).run;notice=E.guardNotice(state);assert.match(notice.objective,/供能藤 1\/2/);assert.match(notice.hint,/還剩 1 根/);
  state=E.counter(state,1).run;assert.equal(E.lordState(state).phase,'exposed');assert.equal(E.guardNotice(state),null);assert.equal(E.limitLordDamage(state,'monster-11',50,200),50);assert.ok(C.validateSave(state));
});
test('the crystal count notice switches wording once the pillar is armed and other floors never report a shield',()=>{
  const run=fresh(60);E.ensure(run);run.party.health['monster-11']=200;E.limitLordDamage(run,'monster-11',200,200);run.party.health['monster-11']=100;
  assert.match(E.guardNotice(run).objective,/轉動晶柱/);const armed=E.armCounter(run).run;assert.match(E.guardNotice(armed).objective,/躲到它後面/);assert.match(E.guardNotice(armed).hint,/躲到晶柱後面/);assert.equal(E.guardNotice(armed).color,0x89d6e1);
  for(const floor of [90,70,50]){const other=fresh(floor);E.ensure(other);other.party.health['monster-11']=10;E.limitLordDamage(other,'monster-11',100,200);assert.equal(E.guardNotice(other),null,'floor '+floor);}
});
