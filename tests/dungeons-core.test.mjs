import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const C = require('../story/story-core.js');
const D = require('../story/tower-dungeons.js');

function fixture(kind, enhanced, floor = 95) {
  for (let seed = 1; seed < 10000; seed += 1) {
    const candidate = D.offer({ floor, seed, expedition: D.newExpedition(1) });
    if (candidate && (!kind || candidate.kind === kind) && (enhanced === undefined || !!candidate.reward.gear === enhanced)) {
      const run = C.newRun({ seed }); run.floor = floor; run.floorsCleared = 99 - floor;
      run.expedition = D.newExpedition(1);
      return { run, offer: candidate };
    }
  }
  throw new Error('No deterministic dungeon fixture found');
}
function entered(kind, enhanced, floor) {
  const { run, offer } = fixture(kind, enhanced, floor);
  const discovered = D.discover(run);
  assert.equal(discovered.ok, true);
  const result = D.enter(discovered.run, offer.id, { x: 1, y: 2, shiftLeft: 0.25 }, discovered.run.revision);
  assert.equal(result.ok, true);
  return { run: result.run, offer };
}
function solved(kind, enhanced, floor) {
  let { run, offer } = entered(kind, enhanced, floor);
  for (const index of kind === 'bells' ? offer.order : [2, 0, 1]) {
    const result = D.interact(run, index, run.revision);
    assert.equal(result.ok, true); run = result.run;
  }
  return { run, offer };
}

test('browser loading core then narrative, side stories and dungeons has no eager dependency cycle', () => {
  const context = vm.createContext({});
  for (const file of ['story-core.js', 'tower-narrative.js', 'tower-side-stories.js', 'tower-dungeons.js']) {
    vm.runInContext(readFileSync(new URL('../story/' + file, import.meta.url), 'utf8'), context);
  }
  const run = context.TowerCore.newRun({ seed: 1 });
  assert.equal(run.expedition.version, 2);
  assert.equal(run.chronicle.version, 1);
  assert.equal(context.TowerCore.validateSave(run).floor, 99);
});

test('rift offers start at floor 95 with independent deterministic 28% occurrence and all three variants', () => {
  let offers = 0, gearRewards = 0;
  const kinds = new Set();
  for (let seed = 1; seed <= 100; seed += 1) {
    for (let floor = 99; floor >= 1; floor -= 1) {
      const run = { floor, seed, expedition: D.newExpedition(1) }, offer = D.offer(run);
      if (floor > 95) { assert.equal(offer, null); continue; }
      assert.deepEqual(D.offer(run), offer);
      if (!offer) continue;
      offers += 1; kinds.add(offer.kind); if (offer.reward.gear) gearRewards += 1;
      assert.equal(offer.id, `rift:${floor}:${seed}`);
      assert.ok([7, 9].includes(offer.size));
      assert.deepEqual([...offer.order].sort(), [0, 1, 2]);
      const unaffected = D.offer({ ...run, bag: { heal: 99 }, coins: 0, revision: 9999 });
      assert.deepEqual(unaffected, offer);
    }
  }
  assert.ok(offers > 2300 && offers < 3000);
  assert.ok(gearRewards / offers > .3 && gearRewards / offers < .4);
  assert.deepEqual([...kinds].sort(), ['archive', 'bells', 'lantern']);
  assert.deepEqual(Object.values(D.TYPES).map(kind => [kind.timeLimit, kind.shiftSeconds]), [[150, 30], [120, 24], [90, 20]]);
});

test('discovery persists and entering requires the matching discovered rift and valid return data', () => {
  const { run, offer } = fixture('archive');
  const point = { x: 1, y: 2, shiftLeft: 0 };
  assert.equal(D.enter(run, offer.id, point).ok, false);
  const discovered = D.discover(run);
  assert.equal(run.expedition.discovered, false);
  assert.equal(discovered.run.expedition.discovered, true);
  assert.equal(C.validateSave(JSON.stringify(discovered.run)).expedition.discovered, true);
  assert.equal(D.discover(discovered.run).ok, false);
  assert.equal(D.enter(discovered.run, 'other-rift', point).ok, false);
  for (const bad of [{ x: -1, y: 2, shiftLeft: 1 }, { x: 7, y: 2, shiftLeft: 1 }, { x: 1.5, y: 2, shiftLeft: 1 }, { x: 1, y: 2, shiftLeft: 66 }, { x: 1, y: 2, shiftLeft: NaN }]) assert.equal(D.enter(discovered.run, offer.id, bad).ok, false);
  const result = D.enter(discovered.run, offer.id, { ...point, shiftLeft: 65 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.run.expedition.active.returnCell, { x: 1, y: 2 });
  assert.equal(result.run.expedition.active.returnShift, 65);
  assert.equal(D.enter(result.run, offer.id, point).ok, false);
  assert.equal(C.descend(result.run).ok, false);
  assert.equal(D.offer(result.run).id, offer.id);
});

test('archive and lantern accept unordered goals only once without changing the input run', () => {
  for (const kind of ['archive', 'lantern']) {
    const { run } = entered(kind);
    const before = JSON.stringify(run);
    const first = D.interact(run, 2, run.revision);
    assert.equal(first.ok, true);
    assert.equal(JSON.stringify(run), before);
    assert.equal(D.interact(first.run, 2).ok, false);
    assert.equal(D.interact(first.run, 0, run.revision).ok, false);
    const second = D.interact(first.run, 0).run;
    const third = D.interact(second, 1);
    assert.equal(third.effect.completed, true);
    assert.deepEqual(third.run.expedition.active.progress, [2, 0, 1]);
    assert.equal(D.interact(third.run, 0).ok, false);
    assert.equal(third.run.hp, 100);
  }
});

test('bells enforce the generated order, reset wrong progress, and wear armor for trap hits', () => {
  let { run, offer } = entered('bells');
  const gear = C.createGear('armor', run.floor, run.seed, 'test-armor'); gear.durability = 1;
  run = C.equipGear(C.grantGear(run, gear).run, gear.id).run;
  run = D.interact(run, offer.order[0]).run;
  const wrong = D.interact(run, offer.order[0]);
  assert.equal(wrong.ok, true);
  assert.equal(wrong.effect.wrongOrder, true);
  assert.equal(wrong.effect.damage, 4);
  assert.equal(wrong.effect.broken.length, 1);
  assert.equal(wrong.run.equipment.armor, null);
  assert.deepEqual(wrong.run.expedition.active.progress, []);
  assert.equal(wrong.run.expedition.active.mistakes, 1);
  assert.equal(wrong.run.hp, 96);
  let current = wrong.run;
  for (const index of offer.order) current = D.interact(current, index).run;
  assert.deepEqual(current.expedition.active.progress, offer.order);
  assert.ok(C.validateSave(current));
});

test('dungeon clocks cap at the time limit, survive reload, and do not silently leave the dungeon', () => {
  let { run, offer } = entered('lantern');
  run = D.tick(run, 60).run;
  const saved = C.validateSave(JSON.stringify(run));
  assert.equal(saved.expedition.active.elapsed, 60);
  assert.equal(D.offer(saved).id, offer.id);
  const last = D.tick(saved, 29.75);
  assert.equal(last.effect.expired, false);
  assert.equal(last.effect.remaining, .25);
  const expired = D.tick(last.run, 1);
  assert.equal(expired.effect.expired, true);
  assert.equal(expired.run.expedition.active.elapsed, 90);
  assert.equal(expired.run.floor, run.floor);
  assert.equal(D.tick(C.validateSave(expired.run), 0).effect.expired, true);
  assert.equal(D.interact(expired.run, 0).ok, false);
  for (const dt of [-1, 61, Infinity, NaN, '1']) assert.equal(D.tick(run, dt).ok, false);
});

test('dungeons freeze the main-floor guard and monster stun timers without freezing general effects', () => {
  const { run: original, offer } = fixture('archive');
  let run = C.newRun({ seed: original.seed });
  run.expedition = D.newExpedition(1);
  run = C.hireWarrior(run, C.warriorOffer(99, run.seed).id).run;
  run = C.interceptMonster(run, 'monster-0', 3).run;
  run = C.hitMonster(run, 'monster-0', 3).run;
  run.floor = original.floor; run.floorsCleared = original.floorsCleared;
  run.effects.shield = 25;
  run = D.enter(D.discover(run).run, offer.id, { x: 0, y: 0, shiftLeft: 20 }).run;
  const ticked = C.tickEffects(run, 10).run;
  assert.equal(ticked.warrior.remaining, 60);
  assert.equal(ticked.monsterStuns['monster-0'], 10);
  assert.equal(ticked.effects.shield, 15);
  assert.equal(ticked.elapsed, 10);
  const exited = D.finish(ticked, 'abandoned').run;
  const resumed = C.tickEffects(exited, 1).run;
  assert.equal(resumed.warrior.remaining, 59);
  assert.equal(resumed.monsterStuns['monster-0'], 9);
});

test('finishing awards only once and returns to the saved main-floor location without descending', () => {
  for (const kind of ['archive', 'bells', 'lantern']) {
    const { run, offer } = solved(kind, false);
    const original = JSON.stringify(run), coins = run.coins;
    const result = D.finish(run, 'completed', run.revision);
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(run), original);
    assert.equal(result.run.floor, run.floor);
    assert.equal(result.run.coins, coins + offer.reward.coins);
    assert.equal(result.run.bag.heal, run.bag.heal + offer.reward.items.heal);
    assert.equal(result.run.expedition.active, null);
    assert.equal(result.run.expedition.history[0].outcome, 'completed');
    assert.deepEqual(result.effect.returnCell, { x: 1, y: 2 });
    assert.equal(result.effect.returnShift, .25);
    assert.deepEqual(result.effect.reward, offer.reward);
    const saved = C.validateSave(JSON.stringify(result.run));
    assert.equal(D.offer(saved), null);
    assert.equal(D.finish(saved, 'completed').ok, false);
    assert.equal(D.enter(saved, offer.id, { x: 0, y: 0, shiftLeft: 0 }).ok, false);
    const lower = C.descend(saved).run;
    assert.equal(lower.expedition.discovered, false);
    assert.deepEqual(lower.expedition.history, saved.expedition.history);
  }
});

test('full gear bags or supply stacks preserve completion and all rewards until there is capacity', () => {
  let { run, offer } = solved('archive', true, 19);
  for (let i = 0; i < 24; i += 1) run = C.grantGear(run, C.createGear('staff', 19, run.seed, `filler-${i}`)).run;
  const before = JSON.stringify(run);
  assert.equal(D.finish(run, 'completed').ok, false);
  assert.equal(JSON.stringify(run), before);
  assert.equal(run.expedition.active.progress.length, 3);
  assert.equal(run.expedition.history.length, 0);
  run = C.discardGear(run, run.gearBag[0].id).run;
  const finished = D.finish(run, 'completed');
  assert.equal(finished.ok, true);
  assert.ok(finished.run.gearBag.some(gear => gear.id === offer.reward.gear.id));
  assert.equal(finished.run.coins, run.coins + offer.reward.coins);
  const supplies = solved('lantern', false);
  supplies.run.bag.heal = 99;
  assert.equal(D.finish(supplies.run, 'completed').ok, false);
  assert.equal(supplies.run.expedition.history.length, 0);
  assert.equal(supplies.run.expedition.active.progress.length, 3);
});

test('abandonment, expiry and death produce no reward and close a rift permanently for this floor', () => {
  for (const outcome of ['abandoned', 'expired']) {
    let { run } = entered('bells');
    if (outcome === 'expired') { run = D.tick(run, 60).run; run = D.tick(run, 60).run; }
    const coins = run.coins, result = D.finish(run, outcome);
    assert.equal(result.ok, true);
    assert.equal(result.effect.reward, null);
    assert.equal(result.run.coins, coins);
    assert.equal(D.offer(C.validateSave(result.run)), null);
    assert.equal(result.run.expedition.history[0].outcome, outcome);
  }
  let { run, offer } = entered('bells');
  run.hp = 1;
  const wrong = (offer.order[0] + 1) % 3;
  run = D.interact(run, wrong).run;
  assert.equal(run.status, 'dead');
  assert.equal(D.finish(run, 'completed').ok, false);
  const exited = D.finish(run, 'abandoned', run.revision);
  assert.equal(exited.ok, true);
  assert.equal(exited.run.status, 'dead'); assert.equal(exited.run.hp, 0);
  assert.equal(exited.run.expedition.active, null);
  assert.equal(exited.effect.reward, null);
  assert.ok(C.validateSave(exited.run));
});

test('finishing rejects incomplete, expired, stale or invented outcomes', () => {
  const { run } = entered('archive');
  assert.equal(D.finish(run, 'completed').ok, false);
  assert.equal(D.finish(run, 'expired').ok, false);
  assert.equal(D.finish(run, 'unknown').ok, false);
  const complete = solved('lantern').run;
  assert.equal(D.finish(complete, 'completed', complete.revision - 1).ok, false);
  let late = D.tick(complete, 60).run; late = D.tick(late, 30).run;
  assert.equal(D.finish(late, 'completed').ok, false);
  assert.equal(D.finish(late, 'expired').ok, true);
});

test('expedition save validation deeply clones data and rejects invalid identity, duplicates and timing', () => {
  const { run, offer } = entered('bells');
  const advanced = D.interact(run, offer.order[0]).run;
  const saved = C.validateSave(JSON.stringify(advanced));
  assert.deepEqual(saved.expedition, advanced.expedition);
  saved.expedition.active.progress.push(offer.order[1]); saved.expedition.active.returnCell.x = 0;
  assert.equal(advanced.expedition.active.progress.length, 1);
  assert.equal(advanced.expedition.active.returnCell.x, 1);
  const invalid = [
    { ...advanced.expedition, discovered: false },
    ...[{ id: 'rift:95:999999' }, { kind: 'archive' }, { floor: 94 }, { elapsed: -1 }, { elapsed: offer.timeLimit + 1 }, { progress: [offer.order[0], offer.order[0]] }, { progress: [offer.order[1]] }, { mistakes: -1 }, { returnCell: { x: 7, y: 0 } }, { returnShift: 66 }].map(change => ({ ...advanced.expedition, active: { ...advanced.expedition.active, ...change } })),
  ];
  for (const expedition of invalid) assert.equal(C.validateSave({ ...advanced, expedition }), null);
  const finished = D.finish(advanced, 'abandoned').run;
  const record = finished.expedition.history[0];
  assert.equal(D.validateExpedition({ ...finished.expedition, history: [record, record] }, finished.floor, finished.seed), null);
  assert.equal(D.validateExpedition({ ...finished.expedition, history: [{ ...record, outcome: 'invented' }] }, finished.floor, finished.seed), null);
  assert.equal(D.validateExpedition({ ...finished.expedition, active: advanced.expedition.active }, finished.floor, finished.seed), null);
});

test('legacy save migration initializes expedition without disturbing existing inventory and quest progress', () => {
  const run = C.newRun({ seed: 1 });
  run.floor = 59; run.floorsCleared = 40; run.coins = 70;
  delete run.expedition; delete run.chronicle;
  const saved = C.validateSave(JSON.stringify(run));
  assert.ok(saved);
  assert.deepEqual(saved.expedition, D.newExpedition(1));
  assert.equal(saved.coins, 70);
  assert.deepEqual(saved.bag, run.bag);
  assert.equal(saved.chronicle.version, 1);
});
