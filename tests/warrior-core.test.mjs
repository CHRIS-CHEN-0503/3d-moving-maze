import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const core = createRequire(import.meta.url)('../story/story-core.js');
const fresh = (seed = 321) => core.newRun({ name: '護行測試', charIdx: 0, seed });
const atFloor = (run, floor) => ({ ...run, floor, floorsCleared: 99 - floor });
const rich = (run) => ({ ...run, coins: 1000, bag: Object.fromEntries(Object.keys(run.bag).map(id => [id, 30])) });
function escort(strength = 1) {
  const run = fresh();
  const hired = core.hireWarrior(run, core.warriorOffer(run.floor, run.seed).id).run;
  hired.warrior.strength = strength;
  return hired;
}

test('old v1 saves migrate optional contract fields without resetting progress', () => {
  const old = atFloor(fresh(), 69);
  old.coins = 100; old.bag.heal = 5; old.claimed = ['story-2'];
  delete old.warrior; delete old.hiredWarriors; delete old.defeatedMonsters;
  const migrated = core.validateSave(JSON.stringify(old));
  assert.equal(migrated.floor, 69);
  assert.equal(migrated.coins, 100);
  assert.equal(migrated.bag.heal, 5);
  assert.deepEqual(migrated.claimed, ['story-2']);
  assert.equal(migrated.warrior, null);
  assert.deepEqual(migrated.hiredWarriors, []);
  assert.deepEqual(migrated.defeatedMonsters, []);
});

test('offers are deterministic, occasional, depth-bound, and always teach at floor 99', () => {
  let appearances = 0;
  const strengths = new Set(), costKinds = new Set();
  for (let seed = 1; seed <= 100; seed += 1) {
    const tutorial = core.warriorOffer(99, seed);
    assert.equal(tutorial.strength, 1);
    assert.deepEqual(tutorial.cost, { ration: 1 });
    for (let floor = 98; floor >= 1; floor -= 1) {
      const offer = core.warriorOffer(floor, seed);
      assert.deepEqual(core.warriorOffer(floor, seed), offer);
      if (!offer) continue;
      appearances += 1; strengths.add(offer.strength);
      costKinds.add(Object.keys(offer.cost).join(','));
      assert.ok(offer.strength >= 1 && offer.strength <= Math.min(5, 1 + Math.floor((99 - floor) / 20)));
      assert.equal(offer.id, `warrior:${floor}:${seed}`);
      assert.ok(Object.entries(offer.cost).every(([id, quantity]) => core.ITEMS[id] && Number.isInteger(quantity) && quantity > 0));
    }
  }
  assert.ok(appearances > 2500 && appearances < 3500);
  assert.deepEqual([...strengths].sort(), [1, 2, 3, 4, 5]);
  assert.equal(costKinds.size, 4);
  for (const floor of [0, 100, NaN, 1.5]) assert.throws(() => core.warriorOffer(floor, 1), RangeError);
  for (const seed of [0, -1, Infinity, 0x100000000, '1']) assert.throws(() => core.warriorOffer(99, seed), RangeError);
});

test('monster ratings are 1..5 and stronger variants occur only below floor 20', () => {
  const bases = { clockmite: 1, sentinel: 3, wisp: 2, hound: 4 };
  for (const [kind, strength] of Object.entries(bases)) {
    assert.equal(core.MONSTERS[kind].strength, strength);
    assert.equal(core.monsterStrength(kind, 20), strength);
    assert.equal(core.monsterStrength(kind, 19), Math.min(5, strength + 1));
    for (let floor = 99; floor >= 1; floor -= 1) assert.ok(core.monsterStrength(kind, floor) >= 1 && core.monsterStrength(kind, floor) <= 5);
  }
  for (const kind of ['unknown', '__proto__', 'constructor']) assert.throws(() => core.monsterStrength(kind, 50), RangeError);
  assert.throws(() => core.monsterStrength('hound', 0), RangeError);
});

test('hiring consumes catalog-derived costs atomically and never mutates input', () => {
  const original = fresh();
  const snapshot = JSON.stringify(original);
  const offer = core.warriorOffer(99, original.seed);
  offer.cost.ration = 0; offer.strength = 5;
  const hired = core.hireWarrior(original, offer.id, original.revision);
  assert.equal(hired.ok, true);
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(hired.run.bag.ration, 1);
  assert.equal(hired.run.warrior.strength, 1);
  assert.equal(hired.run.revision, original.revision + 1);
  assert.deepEqual(hired.run.hiredWarriors, [offer.id]);
  assert.deepEqual(core.validateSave(JSON.stringify(hired.run)), hired.run);
  assert.equal(core.hireWarrior(hired.run, offer.id, original.revision).ok, false);
  assert.equal(core.hireWarrior(hired.run, offer.id).ok, false);
  const departed = { ...hired.run, warrior: null };
  assert.equal(core.hireWarrior(departed, offer.id).ok, false);
  assert.equal(core.hireWarrior(original, 'warrior:98:321').ok, false);
  assert.equal(core.hireWarrior(original, { id: offer.id, cost: {} }).ok, false);
  const full = { ...original, hiredWarriors: Array.from({ length: 99 }, (_, i) => `old-${i}`) };
  assert.equal(core.hireWarrior(full, offer.id).ok, false);
});

test('every variant rejects missing resources without partially deducting others', () => {
  const offers = new Map();
  for (let seed = 1; seed < 100 && offers.size < 4; seed += 1) {
    for (let floor = 98; floor > 0; floor -= 1) {
      const offer = core.warriorOffer(floor, seed);
      if (offer) offers.set(Object.keys(offer.cost).join(','), { offer, seed, floor });
    }
  }
  assert.equal(offers.size, 4);
  for (const { offer, seed, floor } of offers.values()) {
    const funded = rich(atFloor(fresh(seed), floor));
    const result = core.hireWarrior(funded, offer.id);
    assert.equal(result.ok, true);
    for (const [id, quantity] of Object.entries(offer.cost)) {
      assert.equal(id === 'coin' ? result.run.coins : result.run.bag[id], (id === 'coin' ? funded.coins : funded.bag[id]) - quantity);
      const missing = structuredClone(funded);
      if (id === 'coin') missing.coins = quantity - 1; else missing.bag[id] = quantity - 1;
      const snapshot = JSON.stringify(missing);
      const failure = core.hireWarrior(missing, offer.id);
      assert.equal(failure.ok, false);
      assert.equal(failure.run, missing);
      assert.equal(JSON.stringify(missing), snapshot);
    }
  }
});

test('all 25 warrior/monster matchups obey strength subtraction, ties and timed resistance', async (t) => {
  for (let strength = 1; strength <= 5; strength += 1) {
    for (let monsterStrength = 1; monsterStrength <= 5; monsterStrength += 1) {
      await t.test(`warrior ${strength} vs monster ${monsterStrength}`, () => {
        const run = escort(strength);
        const snapshot = JSON.stringify(run);
        const result = core.interceptMonster(run, 'monster-0', monsterStrength, run.revision);
        assert.equal(result.ok, true);
        assert.equal(JSON.stringify(run), snapshot);
        assert.ok(core.validateSave(result.run));
        assert.equal(result.effect.monsterId, 'monster-0');
        if (strength > monsterStrength) {
          assert.equal(result.effect.outcome, 'defeat');
          assert.equal(result.run.warrior.strength, strength - monsterStrength);
          assert.equal(result.run.warrior.mode, 'escort');
          assert.equal(result.run.warrior.targetId, null);
          assert.deepEqual(result.run.defeatedMonsters, ['monster-0']);
        } else {
          const seconds = strength === monsterStrength ? null : strength * 60;
          assert.equal(result.effect.outcome, 'hold');
          assert.equal(result.effect.seconds, seconds);
          assert.equal(result.run.warrior.mode, 'holding');
          assert.equal(result.run.warrior.targetId, 'monster-0');
          assert.equal(result.run.warrior.remaining, seconds);
          assert.deepEqual(result.run.defeatedMonsters, []);
        }
      });
    }
  }
});

test('one-point warrior holds a three-point monster exactly 60 active seconds', () => {
  const held = core.interceptMonster(escort(1), 'monster-3', 3).run;
  assert.equal(held.warrior.remaining, 60);
  const beforeExpiry = core.tickEffects(held, 59.75).run;
  assert.equal(beforeExpiry.warrior.remaining, 0.25);
  const restored = core.validateSave(JSON.stringify(beforeExpiry));
  assert.equal(restored.warrior.remaining, 0.25);
  const paused = core.tickEffects(restored, 0);
  assert.equal(paused.run.warrior.remaining, 0.25);
  const expired = core.tickEffects(paused.run, 0.25);
  assert.equal(expired.run.warrior, null);
  assert.equal(expired.effect.warriorReleased, true);
  assert.equal(expired.effect.targetId, 'monster-3');
  assert.deepEqual(expired.run.defeatedMonsters, []);
  assert.equal(expired.run.hiredWarriors.length, 1);
  assert.equal(core.hireWarrior(expired.run, expired.run.hiredWarriors[0]).ok, false);
});

test('equal ratings remain locked indefinitely and cannot claim a second monster or warrior', () => {
  let run = core.interceptMonster(escort(3), 'monster-0', 3).run;
  const hiredCount = run.hiredWarriors.length;
  for (let minute = 0; minute < 120; minute += 1) run = core.tickEffects(run, 60).run;
  assert.equal(run.warrior.mode, 'holding');
  assert.equal(run.warrior.remaining, null);
  assert.equal(core.interceptMonster(run, 'monster-1', 1).ok, false);
  assert.equal(core.hireWarrior(run, core.warriorOffer(run.floor, run.seed).id).ok, false);
  assert.equal(run.hiredWarriors.length, hiredCount);
});

test('strong warriors spend points per kill and cannot defeat an already resolved target twice', () => {
  const first = core.interceptMonster(escort(5), 'monster-1', 2);
  assert.equal(first.run.warrior.strength, 3);
  assert.equal(core.interceptMonster(first.run, 'monster-1', 2).ok, false);
  const second = core.interceptMonster(first.run, 'monster-2', 1);
  assert.equal(second.run.warrior.strength, 2);
  assert.deepEqual(second.run.defeatedMonsters, ['monster-1', 'monster-2']);
  const third = core.interceptMonster(second.run, 'monster-3', 2);
  assert.equal(third.run.warrior.mode, 'holding');
  assert.equal(third.run.warrior.remaining, null);
  assert.equal(core.interceptMonster(second.run, 'monster-4', 1, first.run.revision).ok, false);
});

test('descending keeps an escort but leaves timed and indefinite duels on the old floor', () => {
  const escorting = core.interceptMonster(escort(5), 'monster-1', 1).run;
  const descended = core.descend(escorting).run;
  assert.equal(descended.warrior.mode, 'escort');
  assert.equal(descended.warrior.strength, 4);
  assert.equal(descended.floor, 98);
  assert.deepEqual(descended.defeatedMonsters, []);
  assert.deepEqual(descended.hiredWarriors, escorting.hiredWarriors);
  for (const monsterStrength of [2, 3]) {
    const held = core.interceptMonster(escort(2), 'monster-0', monsterStrength).run;
    const lower = core.descend(held).run;
    assert.equal(lower.warrior, null);
    assert.equal(lower.hiredWarriors.length, 1);
    assert.ok(core.validateSave(lower));
  }
});

test('contract saves deeply clone mutable state and reject corrupt or impossible engagement fields', () => {
  const run = core.interceptMonster(escort(2), 'monster-0', 3).run;
  const saved = core.validateSave(run);
  saved.warrior.remaining = 1;
  saved.hiredWarriors.push('other-contract'); saved.defeatedMonsters.push('other-monster');
  assert.equal(run.warrior.remaining, 120);
  assert.equal(run.hiredWarriors.length, 1);
  assert.equal(run.defeatedMonsters.length, 0);
  const invalidGuards = [
    [], 'warrior', { ...run.warrior, strength: 0 }, { ...run.warrior, strength: 6 },
    { ...run.warrior, strength: 1.5 }, { ...run.warrior, mode: 'fighting' },
    { ...run.warrior, targetId: '' }, { ...run.warrior, targetId: null },
    { ...run.warrior, remaining: -1 }, { ...run.warrior, remaining: 0 },
    { ...run.warrior, remaining: 121 }, { ...run.warrior, remaining: Infinity },
    { ...run.warrior, offerId: 'never-hired' }, { ...run.warrior, mode: 'escort' },
  ];
  for (const warrior of invalidGuards) assert.equal(core.validateSave({ ...run, warrior }), null);
  for (const corrupt of [
    { ...run, hiredWarriors: null }, { ...run, hiredWarriors: ['duplicate', 'duplicate'] },
    { ...run, defeatedMonsters: ['monster-0'] }, { ...run, defeatedMonsters: ['duplicate', 'duplicate'] },
    { ...run, defeatedMonsters: Array(129).fill(0).map((_, i) => `monster-${i}`) },
  ]) assert.equal(core.validateSave(corrupt), null);
});

test('invalid interceptions and finished journeys cannot consume contract strength or resources', () => {
  const run = escort(5);
  const before = JSON.stringify(run);
  for (const strength of [0, 6, NaN, Infinity, 1.5, '1']) assert.equal(core.interceptMonster(run, 'monster-0', strength).ok, false);
  for (const id of [null, '', {}, 'x'.repeat(81)]) assert.equal(core.interceptMonster(run, id, 1).ok, false);
  assert.equal(JSON.stringify(run), before);
  assert.equal(core.interceptMonster(fresh(), 'monster-0', 1).ok, false);
  const dead = { ...run, status: 'dead', hp: 0 };
  assert.equal(core.interceptMonster(dead, 'monster-0', 1).ok, false);
  assert.equal(core.hireWarrior(dead, run.hiredWarriors[0]).ok, false);
});
