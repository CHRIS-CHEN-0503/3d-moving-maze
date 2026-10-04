import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-adventure-events.js');
const copy=v=>structuredClone(v),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function eventRun(kind){for(let floor=99;floor>2;floor--){const run=H.enable(P.enable(C.newRun({seed:31415}),'swordsman').run).run;run.floor=floor;run.floorsCleared=99-floor;P.advance(run);if(E.offer(run)?.kind===kind&&floor%10>2){E.ensure(run);return run;}}throw Error('no event');}
test('recollections show the real current option and future consequence without mutating rewards or saves',()=>{
  for(const kind of ['forest','workshop','river'])for(const choice of [0,1]){
    let run=eventRun(kind),event=E.offer(run);assert.deepEqual(E.recollections(run),[]);run=E.choose(run,event.id,choice).run;
    const before=JSON.stringify(run),note=E.recollections(freeze(copy(run)))[0];assert.equal(note.choice,choice);assert.equal(note.choiceLabel,event.choices[choice].label);assert.equal(note.consequence,event.choices[choice].description);assert.equal(note.status,'後續待查');assert.equal(JSON.stringify(run),before);assert.deepEqual(E.recollections(run)[0],note);
  }
});
test('older history does not reconstruct a resource choice from a chain or elapsed benefit',()=>{
  for(const choice of [0,1]){
    let run=eventRun('workshop'),id=E.offer(run).id;run=E.choose(run,id,choice).run;run=C.descend(run).run;
    const before=JSON.stringify(run),note=E.recollections(freeze(copy(run)))[0];assert.equal(note.choice,null);assert.match(note.choiceLabel,/未保存/);assert.match(note.consequence,/不能.*反推/);assert.equal(note.status,'後續待查');assert.equal(JSON.stringify(run),before);
    if(choice===0){assert.equal(E.senseScale(run),.7);E.tick(run,60);assert.equal(E.recollections(run)[0].choice,null);}
  }
});
test('follow-up recap changes with the real two-floor inspect, claim or abandonment transaction',()=>{
  let run=eventRun('forest'),id=E.offer(run).id;run=E.choose(run,id,0).run;run=C.descend(run).run;run=C.descend(run).run;
  assert.equal(E.recollections(run)[0].status,'後續待查');run=E.inspect(run).run;assert.equal(E.recollections(run)[0].status,'回條已找到');assert.match(E.recollections(run)[0].next,/領取/);
  const coins=run.coins;run=E.settle(run).run;const before=JSON.stringify(run);assert.equal(E.recollections(run)[0].status,'答謝已領取');assert.equal(run.coins,coins+12);assert.equal(E.settle(run).ok,false);assert.equal(JSON.stringify(run),before);
  let abandoned=eventRun('river');abandoned=E.choose(abandoned,E.offer(abandoned).id,1).run;abandoned=E.settle(abandoned,true).run;assert.equal(E.recollections(abandoned)[0].status,'已放下後續');assert.match(E.recollections(abandoned)[0].next,/主線仍可繼續/);assert.ok(C.descend(abandoned).ok);
});
test('readbacks retain version-one structure and reject forged or future event identities',()=>{
  const run=E.choose(eventRun('forest'),E.offer(eventRun('forest')).id,1).run,keys=Object.keys(run.adventure.events).sort(),before=JSON.stringify(run);
  assert.ok(C.validateSave(run));assert.deepEqual(Object.keys(C.validateSave(run).adventure.events).sort(),keys);assert.equal(JSON.stringify(run),before);
  const bad=copy(run);bad.adventure.events.history.push('event:99:31415:forest');assert.deepEqual(E.recollections(bad),[]);assert.deepEqual(E.recollections({floor:99,seed:31415}),[]);assert.deepEqual(E.recollections(null),[]);
});
