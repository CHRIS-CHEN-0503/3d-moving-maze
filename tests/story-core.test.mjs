import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../story/story-core.js');
const fresh = () => core.newRun({ name: '尋路人', charIdx: 4, seed: 12345 });

test('browser script exposes the same standalone TowerCore contract', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../story/story-core.js', import.meta.url), 'utf8'), context);
  assert.equal(context.TowerCore.floorConfig(99).size, 7);
  assert.equal(context.TowerCore.newRun({ seed: 1 }).stateVersion, 1);
});

test('all 99 floors grow toward the bottom while walls change progressively faster', () => {
  let previous = core.floorConfig(99);
  assert.equal(previous.size, 7);
  assert.equal(previous.shiftSeconds, 65);
  for (let floor = 98; floor >= 1; floor -= 1) {
    const current = core.floorConfig(floor);
    assert.ok(current.size >= previous.size && current.size <= 19);
    assert.equal(current.size % 2, 1);
    assert.ok(current.shiftSeconds < previous.shiftSeconds);
    assert.ok(current.monsterCount <= 6);
    assert.ok(current.themeIndex >= 0 && current.themeIndex <= 5);
    assert.ok(current.monsterTypes.every((id) => Object.hasOwn(core.MONSTERS, id)));
    previous = current;
  }
  assert.equal(previous.size, 19);
  assert.equal(previous.shiftSeconds, 18);
  for (const invalid of [0, 100, 1.5, NaN, '50']) assert.throws(() => core.floorConfig(invalid), RangeError);
});

test('early floors are safe, occasional monsters are introduced before crowded lower floors', () => {
  for (let floor = 99; floor >= 85; floor -= 1) assert.equal(core.floorConfig(floor).monsterCount, 0);
  const early = Array.from({ length: 15 }, (_, index) => core.floorConfig(84 - index));
  assert.equal(early.filter((floor) => floor.monsterCount).length, 3);
  assert.equal(core.floorConfig(69).monsterCount, 2);
  assert.equal(core.floorConfig(1).monsterCount, 6);
  assert.equal(core.floorConfig(1).monsterTypes.length, 4);
});

test('ten distinct environments change at 89, 79 and every following ten-floor boundary', () => {
  const expected = [
    [99, 90, 'summoning', '雲頂召喚台', 7],
    [89, 80, 'garden', '空中庭園', 9],
    [79, 70, 'roots', '倒生之森', 9],
    [69, 60, 'echo', '回聲水晶窟', 11],
    [59, 50, 'library', '失落圖書館', 13],
    [49, 40, 'mist', '霧水迴廊', 13],
    [39, 30, 'frost', '霜封迴廊', 15],
    [29, 20, 'clockwork', '齒輪工坊', 17],
    [19, 10, 'furnace', '熔火爐心', 17],
    [9, 1, 'heart', '歸途塔心', 19],
  ];
  assert.equal(core.CHAPTERS.length, 10);
  assert.equal(new Set(core.CHAPTERS.map(chapter => chapter.id)).size, 10);
  let covered = 0;
  for (const [index, [high, low, environmentId, name, size]] of expected.entries()) {
    const entry = core.floorConfig(high);
    assert.ok(entry.narrative, `New environment on floor ${high} must introduce its story`);
    assert.equal(entry.merchant, true);
    if (high < 99) assert.notEqual(entry.environmentId, core.floorConfig(high + 1).environmentId);
    for (let floor = high; floor >= low; floor -= 1) {
      const config = core.floorConfig(floor);
      assert.equal(config.chapter, index + 1);
      assert.equal(config.environmentId, environmentId);
      assert.equal(config.name, name);
      assert.equal(config.size, size);
      if (floor !== high) assert.equal(config.narrative, '');
      covered += 1;
    }
  }
  assert.equal(covered, 99);
});

test('saves roundtrip without retaining unknown properties or shared mutable references', () => {
  const run = fresh();
  const saved = core.validateSave(JSON.stringify({ ...run, injected: true }));
  assert.deepEqual(saved, run);
  assert.equal(saved.injected, undefined);
  saved.bag.heal = 90;
  assert.equal(run.bag.heal, 2);
  for (const corrupt of [null, '{', [], { ...run, stateVersion: 999 }, { ...run, coins: -1 }, { ...run, hp: NaN }, { ...run, floor: 0 }, { ...run, status: 'won' }, { ...run, revision: Infinity }, { ...run, floorsCleared: 5 }, { ...run, bag: { ...run.bag, heal: -1 } }, { ...run, bag: { ...run.bag, invented: 2 } }]) {
    assert.equal(core.validateSave(corrupt), null);
  }
});

test('buying is immutable, uses catalog prices and rejects stale duplicate submissions', () => {
  const run = fresh();
  const before = JSON.stringify(run);
  const first = core.buy(run, 'heal', 1, run.revision);
  assert.equal(first.ok, true);
  assert.equal(first.run.coins, 10);
  assert.equal(first.run.bag.heal, 3);
  assert.equal(JSON.stringify(run), before);
  const duplicate = core.buy(first.run, 'ration', 1, run.revision);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.run, first.run);
  assert.equal(core.buy(first.run, 'heal').ok, false);
  for (const quantity of [-1, 0, 1.5, Infinity, '1']) assert.equal(core.buy(run, 'heal', quantity).ok, false);
  for (const item of ['coin', 'missing', '__proto__', 'constructor']) assert.equal(core.buy(run, item).ok, false);
});

test('selling cannot mint money without inventory or produce buy/sell arbitrage', () => {
  const run = fresh();
  assert.equal(core.sell(run, 'heal', 3).ok, false);
  assert.equal(core.sell(run, 'heal', -1).ok, false);
  const sold = core.sell(run, 'heal', 2, 0);
  assert.equal(sold.run.coins, 36);
  assert.equal(sold.run.bag.heal, 0);
  assert.equal(core.sell(sold.run, 'heal').ok, false);
  for (const item of Object.values(core.ITEMS).filter((item) => item.buyPrice !== null)) assert.ok(item.sellPrice < item.buyPrice);
});

test('exchange consumes all costs atomically and refuses unavailable or full inventory', () => {
  const run = fresh();
  const trade = core.exchange(run, 'ration_for_heal', run.revision);
  assert.equal(trade.ok, true);
  assert.equal(trade.run.bag.ration, 0);
  assert.equal(trade.run.bag.heal, 3);
  assert.equal(core.exchange(trade.run, 'ration_for_heal').ok, false);
  assert.equal(core.exchange(trade.run, 'map_for_bell').ok, false);
  assert.equal(trade.run.bag.map, 1);
  assert.equal(core.exchange(run, '__proto__').ok, false);
  const full = { ...run, bag: { ...run.bag, heal: 99 } };
  assert.equal(core.exchange(full, 'ration_for_heal').ok, false);
  assert.equal(full.bag.ration, 2);
});

test('healing, food and temporary tools are useful without consuming redundant items', () => {
  const run = fresh();
  assert.equal(core.useItem(run, 'heal').ok, false);
  assert.equal(core.useItem(run, 'ration').ok, false);
  const injured = { ...run, hp: 80, hunger: 30 };
  const healed = core.useItem(injured, 'heal');
  assert.equal(healed.run.hp, 100);
  assert.equal(healed.effect.healed, 20);
  const fed = core.useItem(healed.run, 'ration');
  assert.equal(fed.run.hunger, 75);
  const map = core.useItem(fed.run, 'map');
  assert.equal(map.run.effects.reveal, 18);
  const withMoreMaps = core.collect(map.run, 'map').run;
  assert.equal(core.useItem(withMoreMaps, 'map').ok, false);
  const elapsed = core.tickEffects(withMoreMaps, 20);
  assert.equal(elapsed.run.effects.reveal, 0);
  assert.equal(elapsed.run.elapsed, 20);
  assert.equal(core.useItem(elapsed.run, 'map').ok, true);
});

test('shield reduces damage and revival feathers protect once before death ends transactions', () => {
  const run = fresh();
  const guarded = { ...run, hp: 20, bag: { ...run.bag, feather: 1 }, effects: { ...run.effects, shield: 10 } };
  assert.equal(core.takeDamage(guarded, 20).run.hp, 13);
  const revived = core.takeDamage(guarded, 100);
  assert.equal(revived.effect.revived, true);
  assert.equal(revived.run.hp, 50);
  assert.equal(revived.run.bag.feather, 0);
  assert.equal(core.validateSave(revived.run).status, 'playing');
  const dead = core.takeDamage(revived.run, 1000);
  assert.equal(dead.run.hp, 0);
  assert.equal(dead.run.status, 'dead');
  assert.equal(core.validateSave(dead.run).status, 'dead');
  assert.equal(core.useItem(dead.run, 'heal').ok, false);
  assert.equal(core.takeDamage(run, -1).ok, false);
});

test('a complete 99-floor journey saves at each boundary and reaches the ending once', () => {
  let run = fresh();
  for (let floor = 99; floor >= 1; floor -= 1) {
    assert.equal(run.floor, floor);
    const result = core.descend(run, run.revision);
    assert.equal(result.ok, true);
    assert.ok(core.validateSave(result.run));
    if (floor === 1) assert.equal(result.effect.ending, true);
    run = result.run;
  }
  assert.equal(run.status, 'won');
  assert.equal(run.floorsCleared, 99);
  assert.equal(core.descend(run).ok, false);
  assert.equal(core.collect(run, 'coin', 10).ok, false);
  assert.match(core.OPENING.text, /第九十九層/);
  assert.ok(core.CHAPTERS.every((chapter) => core.floorConfig(chapter.high).narrative));
});

test('engine inventory, cooldowns and claimed pickups persist and only floor-local claims reset', () => {
  const run = fresh();
  run.engine = { shovels: 3, kites: 2, whistles: 1, shovelCooldownMs: 4500, skillCooldownMs: 19000 };
  run.claimed = ['base-1', 'story-2'];
  run.floorElapsed = 68;
  const saved = core.validateSave(JSON.stringify(run));
  assert.deepEqual(saved.engine, run.engine);
  assert.deepEqual(saved.claimed, run.claimed);
  saved.claimed.push('story-3');
  assert.equal(run.claimed.length, 2);
  const next = core.descend(saved).run;
  assert.deepEqual(next.engine, run.engine);
  assert.deepEqual(next.claimed, []);
  assert.equal(next.floorElapsed, 0);
  for (const corrupt of [{ ...run, engine: { ...run.engine, shovels: -1 } }, { ...run, engine: { ...run.engine, skillCooldownMs: Infinity } }, { ...run, claimed: ['x', 'x'] }, { ...run, claimed: [null] }, { ...run, floorElapsed: -1 }]) assert.equal(core.validateSave(corrupt), null);
});
