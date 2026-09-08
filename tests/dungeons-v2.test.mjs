import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const C = require('../story/story-core.js');
const D = require('../story/tower-dungeons.js');
const S = require('../story/tower-side-stories.js');
const N = require('../story/tower-narrative.js');

function floorRun(floor, seed, version = 2) {
  const run = C.newRun({ seed });
  run.floor = floor; run.floorsCleared = 99 - floor;
  run.expedition = D.newExpedition(version);
  return run;
}
function fixture(kind, floor = S.get(kind)?.maxFloor ?? 95, version = 2) {
  for (let seed = 1; seed < 10000; seed += 1) {
    const run = floorRun(floor, seed, version), offer = D.offer(run);
    if (offer?.kind === kind) return { run, offer };
  }
  throw new Error(`No fixture for ${kind} at ${floor}`);
}
function enter(kind, floor, version) {
  const { run, offer } = fixture(kind, floor, version);
  const entered = D.enter(D.discover(run).run, offer.id, { x: 1, y: 2, shiftLeft: .5 });
  assert.equal(entered.ok, true);
  return { run: entered.run, offer };
}
function solve(kind) {
  let { run, offer } = enter(kind);
  const order = ['threads', 'stars'].includes(kind) ? offer.order : [0, 1, 2];
  for (const index of order) {
    if (kind === 'stars' && index !== 0 && run.expedition.active.shiftCount === 0) {
      run = D.tick(run, offer.shiftSeconds).run;
      run = D.observeShift(run).run;
    }
    const result = D.interact(run, index, run.revision, { choice: offer.steps[index].correctChoice });
    assert.equal(result.ok, true); assert.equal(result.effect.progress.includes(index), true);
    run = C.validateSave(JSON.stringify(result.run));
    assert.ok(run);
  }
  return { run, offer };
}

test('browser and Node generate identical new-story offers and validate each other\'s save data', () => {
  const context = vm.createContext({});
  for (const file of ['story-core.js', 'tower-narrative.js', 'tower-side-stories.js', 'tower-dungeons.js']) {
    vm.runInContext(readFileSync(new URL('../story/' + file, import.meta.url), 'utf8'), context);
  }
  for (const kind of Object.keys(S.STORIES)) {
    const { run, offer } = enter(kind);
    const restored = context.TowerCore.validateSave(JSON.stringify(run));
    assert.ok(restored);
    assert.equal(JSON.stringify(context.TowerDungeons.offer(restored)), JSON.stringify(offer));
    assert.deepEqual(C.validateSave(JSON.stringify(restored)), run);
  }
});

test('v1 catalog has the exact 9,900 offer bytes released in v1.22, including all rewards', () => {
  // Fingerprint generated from the v1.22 committed module, not the new implementation.
  const hash = createHash('sha256');
  let count = 0;
  for (let seed = 1; seed <= 100; seed += 1) for (let floor = 99; floor >= 1; floor -= 1) {
    const offer = D.offer({ floor, seed, expedition: D.newExpedition(1) });
    hash.update(JSON.stringify(offer) + '\n');
    if (offer) count += 1;
  }
  assert.equal(count, 2717);
  assert.equal(hash.digest('hex'), 'cebea53246144b013724d6c29463fa0b42d1c9843d0efcaddaa12c20d73351bf');
});

test('fresh games use v2 while absent and explicit legacy expedition data stay v1 until descent', () => {
  assert.equal(C.newRun({ seed: 1 }).expedition.version, 2);
  const old = floorRun(95, 1, 1);
  const expected = D.offer(old);
  for (const absent of [true, false]) {
    const copy = structuredClone(old);
    if (absent) delete copy.expedition;
    const restored = C.validateSave(JSON.stringify(copy));
    assert.equal(restored.expedition.version, 1);
    assert.deepEqual(D.offer(restored), expected);
    const lower = C.descend(restored);
    assert.equal(lower.ok, true);
    assert.equal(lower.run.floor, 94);
    assert.equal(lower.run.expedition.version, 2);
    assert.ok(C.validateSave(lower.run));
  }
});

test('finishing floor one retains v1 catalog identity and same-floor history because there is no lower floor', () => {
  for (const outcome of ['completed', 'abandoned', 'expired']) {
    let { run, offer } = enter('archive', 1, 1);
    if (outcome === 'completed') for (const index of [0, 1, 2]) run = D.interact(run, index).run;
    if (outcome === 'expired') while (run.expedition.active.elapsed < offer.timeLimit) run = D.tick(run, 60).run;
    run = D.finish(run, outcome).run;
    run = N.collectClue(run).run;
    run = N.chooseEnding(run, 'release').run;
    const history = structuredClone(run.expedition.history);
    assert.equal(history[0].floor, 1);
    assert.equal(history[0].catalogVersion, undefined);
    const ending = C.descend(run, run.revision);
    assert.equal(ending.ok, true);
    assert.equal(ending.effect.ending, true);
    assert.equal(ending.run.status, 'won');
    assert.equal(ending.run.floor, 1);
    assert.equal(ending.run.expedition.version, 1);
    assert.deepEqual(ending.run.expedition.history, history);
    assert.deepEqual(C.validateSave(JSON.stringify(ending.run)), ending.run);
    assert.equal(D.offer(ending.run), null);
    assert.equal(C.descend(ending.run).ok, false);
  }
});

test('v1 active progress resumes unchanged, cannot reroll its reward, and settles into mixed version history', () => {
  let { run, offer } = enter('bells', 95, 1);
  run = D.interact(run, offer.order[0]).run;
  run = D.tick(run, 9.5).run;
  const snapshot = JSON.stringify(run);
  const restored = C.validateSave(snapshot);
  assert.deepEqual(restored, run);
  assert.deepEqual(D.offer(restored), offer);
  assert.equal(restored.expedition.active.catalogVersion, undefined);
  assert.equal(C.validateSave({ ...run, expedition: { ...run.expedition, version: 2 } }), null);
  for (const index of offer.order.slice(1)) run = D.interact(run, index).run;
  const settled = D.finish(run, 'completed').run;
  const history = structuredClone(settled.expedition.history);
  assert.equal(history[0].catalogVersion, undefined);
  assert.equal(D.offer(settled), null);
  run = C.descend(settled).run;
  assert.equal(run.expedition.version, 2);
  assert.deepEqual(run.expedition.history, history);
  while (!D.offer(run) && run.floor > 91) run = C.descend(run).run;
  if (!D.offer(run)) {
    run.floor = 89; run.floorsCleared = 10;
    while (!D.offer(run) && run.floor > 81) { run.floor -= 1; run.floorsCleared += 1; }
  }
  const nextOffer = D.offer(run);
  assert.ok(nextOffer);
  run = D.enter(D.discover(run).run, nextOffer.id, { x: 0, y: 0, shiftLeft: 12 }).run;
  run = D.finish(run, 'abandoned').run;
  assert.equal(run.expedition.history[1].catalogVersion, 2);
  assert.deepEqual(C.validateSave(JSON.stringify(run)).expedition.history, run.expedition.history);
  assert.equal(JSON.stringify(restored), snapshot);
});

test('v2 adds six floor-gated stories without changing the seeded 28 percent occurrence or reward draw', () => {
  const seen = new Set(); let count = 0;
  for (let seed = 1; seed <= 100; seed += 1) for (let floor = 99; floor >= 1; floor -= 1) {
    const old = D.offer({ floor, seed, expedition: D.newExpedition(1) });
    const offer = D.offer({ floor, seed, expedition: D.newExpedition() });
    assert.equal(!!offer, !!old);
    if (!offer) continue;
    count += 1; seen.add(offer.kind);
    assert.equal(offer.catalogVersion, 2);
    assert.deepEqual(offer.reward, old.reward, 'Expanding the pool must not reroll reward quality');
    if (S.get(offer.kind)) assert.ok(floor <= S.get(offer.kind).maxFloor);
    assert.deepEqual([...offer.order].sort(), [0, 1, 2]);
    if (offer.kind === 'stars') assert.equal(offer.order[0], 0);
  }
  assert.equal(count, 2717);
  assert.deepEqual([...seen].sort(), [...Object.keys(D.TYPES), ...Object.keys(S.STORIES)].sort());
});

test('all six stories complete with reloads, retain main quest clues, and grant rewards exactly once', () => {
  for (const kind of Object.keys(S.STORIES)) {
    const { run, offer } = solve(kind);
    assert.equal(run.expedition.active.progress.length, 3);
    const chronicle = structuredClone(run.chronicle), coins = run.coins;
    const done = D.finish(run, 'completed');
    assert.equal(done.ok, true);
    assert.equal(done.run.floor, run.floor);
    assert.equal(done.run.coins, coins + offer.reward.coins);
    assert.deepEqual(done.run.chronicle, chronicle, 'Side stories never invent a main-line clue');
    assert.deepEqual(done.effect.returnCell, { x: 1, y: 2 });
    assert.equal(done.effect.returnShift, .5);
    assert.equal(done.run.expedition.history[0].catalogVersion, 2);
    const saved = C.validateSave(JSON.stringify(done.run));
    assert.ok(saved);
    assert.equal(D.offer(saved), null);
    assert.equal(D.finish(saved, 'completed').ok, false);
    assert.equal(D.enter(saved, offer.id, { x: 0, y: 0, shiftLeft: 1 }).ok, false);
  }
});

test('threads enforce the seeded sequence and wrong order resets only its own progress', () => {
  let { run, offer } = enter('threads');
  run = D.interact(run, offer.order[0]).run;
  const wrong = D.interact(run, offer.order[2]);
  assert.equal(wrong.ok, true);
  assert.equal(wrong.effect.wrongOrder, true);
  assert.equal(wrong.effect.damage, 5);
  assert.deepEqual(wrong.run.expedition.active.progress, []);
  assert.equal(wrong.run.expedition.active.mistakes, 1);
  assert.equal(run.expedition.active.progress.length, 1);
  assert.ok(C.validateSave(wrong.run));
});

test('mirror and supper choices reject malformed input and wrong choices wear armor without consuming supplies', () => {
  for (const kind of ['mirrors', 'supper']) {
    let { run, offer } = enter(kind);
    const armor = C.createGear('armor', run.floor, run.seed, 'choice-armor');
    armor.durability = 1;
    run = C.equipGear(C.grantGear(run, armor).run, armor.id).run;
    for (const details of [undefined, {}, { choice: -1 }, { choice: 3 }, { choice: .5 }, { choice: '1' }, { choice: NaN }]) {
      const invalid = D.interact(run, 0, run.revision, details);
      assert.equal(invalid.ok, false); assert.equal(invalid.run, run);
    }
    run = D.interact(run, 1, run.revision, { choice: offer.steps[1].correctChoice }).run;
    const bag = structuredClone(run.bag), coins = run.coins;
    const wrong = D.interact(run, 0, run.revision, { choice: (offer.steps[0].correctChoice + 1) % 3 });
    assert.equal(wrong.ok, true);
    assert.equal(wrong.effect.wrongChoice, true);
    assert.equal(wrong.effect.damage, 1);
    assert.equal(wrong.effect.broken.length, 1);
    assert.deepEqual(wrong.run.expedition.active.progress, [1]);
    assert.deepEqual(wrong.run.bag, bag);
    assert.equal(wrong.run.coins, coins);
    const right = D.interact(wrong.run, 0, wrong.run.revision, { choice: offer.steps[0].correctChoice });
    assert.equal(right.ok, true);
    assert.deepEqual(right.run.expedition.active.progress, [1, 0]);
    assert.deepEqual(right.run.bag, bag);
    assert.equal(D.interact(right.run, 0, right.run.revision, { choice: offer.steps[0].correctChoice }).ok, false);
  }
});

test('repair and tribunal require both prerequisite nodes, and the tribunal then checks the verdict', () => {
  for (const kind of ['clockwork', 'tribunal']) {
    let { run, offer } = enter(kind);
    assert.equal(D.interact(run, 2, run.revision, { choice: offer.steps[2].correctChoice }).ok, false);
    run = D.interact(run, 1).run;
    assert.equal(D.interact(run, 2, run.revision, { choice: offer.steps[2].correctChoice }).ok, false);
    run = D.interact(run, 0).run;
    if (kind === 'tribunal') {
      assert.equal(D.interact(run, 2).ok, false);
      const wrong = D.interact(run, 2, run.revision, { choice: (offer.steps[2].correctChoice + 1) % 3 });
      assert.equal(wrong.effect.wrongChoice, true);
      assert.deepEqual(wrong.run.expedition.active.progress, [1, 0]);
      run = wrong.run;
    }
    const done = D.interact(run, 2, run.revision, { choice: offer.steps[2].correctChoice });
    assert.equal(done.effect.completed, true);
    assert.deepEqual(done.run.expedition.active.progress, [1, 0, 2]);
  }
});

test('stars require a new post-activation shift, reject repeated shift reports, and retain their observation across reload', () => {
  let { run, offer } = enter('stars');
  assert.equal(D.observeShift(run).ok, false);
  run = D.tick(run, offer.shiftSeconds).run;
  run = D.observeShift(run).run;
  assert.equal(run.expedition.active.shiftCount, 1);
  assert.equal(D.observeShift(run).ok, false);
  run = D.interact(run, 0).run;
  assert.equal(run.expedition.active.shiftAtStart, 1);
  assert.equal(D.interact(run, offer.order[1]).ok, false, 'A shift before activation must not satisfy the puzzle');
  run = D.tick(run, offer.shiftSeconds).run;
  run = D.observeShift(run).run;
  assert.equal(run.expedition.active.shiftCount, 2);
  run = C.validateSave(JSON.stringify(run));
  assert.equal(run.expedition.active.shiftAtStart, 1);
  const wrong = D.interact(run, offer.order[2]);
  assert.equal(wrong.effect.wrongOrder, true);
  assert.deepEqual(wrong.run.expedition.active.progress, [0]);
  run = D.interact(wrong.run, offer.order[1]).run;
  run = D.interact(run, offer.order[2]).run;
  assert.equal(D.finish(run, 'completed').ok, true);
  assert.equal(D.observeShift(enter('supper').run).ok, false);
});

test('v2 saves reject forged version identity, prerequisite progress and impossible star counters', () => {
  for (const kind of Object.keys(S.STORIES)) {
    const { run } = enter(kind);
    const base = run.expedition, active = base.active;
    for (const change of [{ catalogVersion: 1 }, { catalogVersion: undefined }, { catalogVersion: 3 }, { kind: '__proto__' }, { progress: [3] }, { progress: [1, 1] }]) {
      assert.equal(C.validateSave({ ...run, expedition: { ...base, active: { ...active, ...change } } }), null);
    }
    if (['clockwork', 'tribunal'].includes(kind)) for (const progress of [[2], [0, 2], [2, 0, 1]]) {
      assert.equal(C.validateSave({ ...run, expedition: { ...base, active: { ...active, progress } } }), null);
    }
  }
  const { run, offer } = enter('stars');
  for (const change of [{ shiftCount: -1 }, { shiftCount: 1 }, { shiftCount: Infinity }, { shiftAtStart: 0 }, { progress: [0], shiftAtStart: null }, { progress: offer.order.slice(0, 2), shiftAtStart: 0 }]) {
    assert.equal(C.validateSave({ ...run, expedition: { ...run.expedition, active: { ...run.expedition.active, ...change } } }), null);
  }
});

test('story hazards can revive or kill, and aborting never grants lore/rewards or resets the main floor', () => {
  for (const feather of [0, 1]) {
    let { run, offer } = enter('mirrors');
    run.hp = 1; run.bag.feather = feather;
    const wrong = D.interact(run, 0, run.revision, { choice: (offer.steps[0].correctChoice + 1) % 3 });
    assert.equal(wrong.effect.revived, feather === 1);
    assert.equal(wrong.run.status, feather ? 'playing' : 'dead');
    assert.equal(wrong.run.bag.feather, 0);
    const abandoned = D.finish(wrong.run, 'abandoned');
    assert.equal(abandoned.ok, true);
    assert.equal(abandoned.effect.reward, null);
    assert.equal(abandoned.run.floor, run.floor);
    assert.equal(abandoned.run.coins, run.coins);
    assert.equal(abandoned.run.expedition.history[0].outcome, 'abandoned');
    assert.equal(D.offer(C.validateSave(abandoned.run)), null);
  }
});

test('the real maze generator keeps every dungeon cell reachable at entry and after a player-centered reshuffle', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.match(/function genMaze\(fromX,fromY\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'Read the real shipped generator, never a stubbed open grid');
  const sizes = [...new Set([...Object.values(D.TYPES), ...Object.values(S.STORIES)].map(story => story.size))];
  assert.deepEqual(sizes.sort(), [7, 9], 'More story types must not grow the original lightweight dungeon bounds');
  for (const size of sizes) for (let seed = 1; seed <= 100; seed += 1) {
    let state = seed;
    const context = vm.createContext({ G: { mazeW: size, mazeH: size }, RNG: () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; } });
    vm.runInContext(source, context);
    for (const [startX, startY] of [[0, 0], [size - 1, Math.floor(size / 2)]]) {
      context.genMaze(startX, startY);
      const { hWalls, vWalls } = context.G, seen = new Set([`${startX},${startY}`]), queue = [[startX, startY]];
      for (let offset = 0; offset < queue.length; offset += 1) {
        const [x, y] = queue[offset], neighbours = [];
        if (x > 0 && !vWalls[y][x - 1]) neighbours.push([x - 1, y]);
        if (x < size - 1 && !vWalls[y][x]) neighbours.push([x + 1, y]);
        if (y > 0 && !hWalls[y - 1][x]) neighbours.push([x, y - 1]);
        if (y < size - 1 && !hWalls[y][x]) neighbours.push([x, y + 1]);
        for (const [nx, ny] of neighbours) if (!seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); queue.push([nx, ny]); }
      }
      assert.equal(seen.size, size * size, `All nodes and the exit must remain reachable: size ${size}, seed ${seed}, origin ${startX}/${startY}`);
    }
  }
});
