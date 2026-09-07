import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const C = createRequire(import.meta.url)('../story/story-core.js');
const fresh = () => C.newRun({ seed: 12345, name: '裝備測試', charIdx: 0 });
function wear(run, kind, { enhanced = false, durability, floor = 1, source = kind } = {}) {
  const gear = C.createGear(kind, floor, run.seed, source, enhanced);
  if (durability !== undefined) gear.durability = durability;
  const received = C.grantGear(run, gear);
  assert.equal(received.ok, true);
  const equipped = C.equipGear(received.run, gear.id);
  assert.equal(equipped.ok, true);
  return equipped.run;
}
function withGuard(strength) {
  const run = fresh();
  const hired = C.hireWarrior(run, C.warriorOffer(99, run.seed).id).run;
  hired.warrior.strength = strength;
  return hired;
}

test('six gear kinds have only three armor slots and one nonlethal weapon slot', () => {
  assert.deepEqual(Object.keys(C.GEAR), ['helmet', 'armor', 'shield', 'bat', 'pan', 'staff']);
  assert.deepEqual(Object.keys(fresh().equipment), ['helmet', 'armor', 'shield', 'weapon']);
  assert.deepEqual(['bat', 'pan', 'staff'].map(kind => C.GEAR[kind].stunSeconds), [15, 20, 10]);
  assert.deepEqual(['helmet', 'armor', 'shield'].map(kind => C.GEAR[kind].defense), [2, 4, 3]);
  const run = fresh();
  assert.equal(run.equipment.weapon.kind, 'staff');
  assert.ok(run.equipment.weapon.durability >= 3 && run.equipment.weapon.durability <= 10);
  assert.equal(run.bag.shield, 0);
  assert.equal(run.equipment.shield, null);
});

test('normal equipment rolls 3..10 durability deterministically; enhanced rolls progress in three tiers', () => {
  const ordinary = new Set(), deepBonus = new Set(), deepDurability = new Set();
  for (let seed = 1; seed <= 100; seed += 1) {
    for (const kind of Object.keys(C.GEAR)) {
      const plain = C.createGear(kind, 99, seed, 'supply');
      ordinary.add(plain.durability);
      assert.deepEqual(C.createGear(kind, 99, seed, 'supply'), plain);
      assert.ok(plain.durability >= 3 && plain.durability <= 10);
      assert.equal(plain.durability, plain.maxDurability);
      assert.equal(plain.bonus, 0);
      for (const [floor, maxDurability, maxBonus] of [[99, 13, 1], [70, 13, 1], [69, 16, 2], [40, 16, 2], [39, 20, 3], [1, 20, 3]]) {
        const improved = C.createGear(kind, floor, seed, 'chest', true);
        assert.ok(improved.maxDurability >= 10 && improved.maxDurability <= maxDurability);
        assert.ok(improved.bonus >= 1 && improved.bonus <= maxBonus);
        assert.ok(C.validateGear(improved));
        if (floor === 1) { deepBonus.add(improved.bonus); deepDurability.add(improved.maxDurability); }
      }
    }
  }
  assert.equal(ordinary.size, 8);
  assert.deepEqual([...deepBonus].sort(), [1, 2, 3]);
  assert.equal(deepDurability.size, 11);
  assert.throws(() => C.createGear('knife', 99, 1, 'invalid'), RangeError);
});

test('legacy saves receive a starter once; discarded or broken weapons do not respawn on reload', () => {
  const legacy = fresh();
  delete legacy.equipment; delete legacy.gearBag; delete legacy.monsterStuns; delete legacy.adventure;
  const restored = C.validateSave(JSON.stringify(legacy));
  assert.equal(restored.equipment.weapon.kind, 'staff');
  assert.deepEqual(restored.adventure, C.newAdventure());
  const discarded = C.discardGear(restored, restored.equipment.weapon.id).run;
  for (let reload = 0; reload < 3; reload += 1) assert.equal(C.validateSave(JSON.stringify(discarded)).equipment.weapon, null);
  const fragile = wear(fresh(), 'staff', { durability: 1 });
  const broken = C.hitMonster(fragile, 'monster-0', 2).run;
  assert.equal(C.validateSave(JSON.stringify(broken)).equipment.weapon, null);
});

test('equipping swaps safely even with a full bag and rejects stale duplicate commands', () => {
  let run = fresh();
  for (let index = 0; index < 24; index += 1) run = C.grantGear(run, C.createGear('bat', 99, run.seed, `bag-${index}`)).run;
  assert.equal(run.gearBag.length, 24);
  const original = JSON.stringify(run), chosen = run.gearBag[0];
  const equipped = C.equipGear(run, chosen.id, run.revision);
  assert.equal(equipped.ok, true);
  assert.equal(equipped.run.gearBag.length, 24);
  assert.equal(equipped.run.equipment.weapon.id, chosen.id);
  assert.equal(JSON.stringify(run), original);
  assert.equal(C.equipGear(equipped.run, chosen.id, run.revision).ok, false);
  assert.equal(C.grantGear(run, C.createGear('helmet', 99, run.seed, 'overflow')).ok, false);
  const discarded = C.discardGear(equipped.run, chosen.id).run;
  assert.equal(discarded.equipment.weapon, null);
  assert.equal(C.discardGear(discarded, chosen.id).ok, false);
});

test('gear purchases use catalog prices without partial debit or duplicate inventory entries', () => {
  const run = fresh(), gear = C.createGear('pan', 99, run.seed, 'shop');
  const price = C.gearPrice(gear);
  assert.ok(price > 0);
  assert.equal(C.buyGear(run, gear, price).ok, false);
  const funded = { ...run, coins: 1000 };
  assert.equal(C.buyGear(funded, gear, 0).ok, false);
  const bought = C.buyGear(funded, gear, price, funded.revision);
  assert.equal(bought.ok, true);
  assert.equal(bought.run.coins, 1000 - price);
  assert.equal(bought.run.gearBag[0].id, gear.id);
  assert.equal(bought.run.equipment.weapon.kind, 'staff');
  assert.equal(C.buyGear(bought.run, gear, price).ok, false);
  assert.equal(bought.run.coins, 1000 - price);
});

test('three worn armors each lose one durability while only their summed defense reduces incoming damage', () => {
  let run = fresh();
  for (const kind of ['helmet', 'armor', 'shield']) run = wear(run, kind);
  const original = JSON.stringify(run), beforeWeapon = run.equipment.weapon.durability;
  const hit = C.takeDamage(run, 15, 'monster');
  assert.equal(hit.effect.defense, 9);
  assert.equal(hit.effect.damage, 6);
  assert.equal(hit.run.hp, 94);
  assert.equal(JSON.stringify(run), original);
  for (const slot of ['helmet', 'armor', 'shield']) assert.equal(hit.run.equipment[slot].durability, run.equipment[slot].durability - 1);
  assert.equal(hit.run.equipment.weapon.durability, beforeWeapon);
  const trap = C.takeDamage(run, 7, 'trap');
  assert.equal(trap.effect.damage, 0);
  for (const slot of ['helmet', 'armor', 'shield']) assert.equal(trap.run.equipment[slot].durability, run.equipment[slot].durability - 1);
});

test('the final durability point protects the same hit before all broken armor is removed', () => {
  let run = fresh();
  for (const kind of ['helmet', 'armor', 'shield']) run = wear(run, kind, { durability: 1 });
  const hit = C.takeDamage(run, 15, 'trap');
  assert.equal(hit.effect.damage, 6);
  assert.equal(hit.effect.broken.length, 3);
  for (const slot of ['helmet', 'armor', 'shield']) assert.equal(hit.run.equipment[slot], null);
  assert.ok(C.validateSave(hit.run));
  assert.equal(C.takeDamage(hit.run, 15).effect.damage, 15);
  assert.equal(C.equipmentStats(hit.run).defense, 0);
});

test('hunger bypasses all armor and temporary shields without wearing equipment; zero damage also does not wear', () => {
  let run = wear(fresh(), 'armor');
  run.effects.shield = 25;
  const hunger = C.takeDamage(run, 3, 'hunger');
  assert.equal(hunger.effect.damage, 3);
  assert.equal(hunger.run.hp, 97);
  assert.equal(hunger.run.equipment.armor.durability, run.equipment.armor.durability);
  assert.equal(C.takeDamage(run, 0).run.equipment.armor.durability, run.equipment.armor.durability);
  assert.equal(C.takeDamage(run, 10, 'undefined-source').ok, false);
});

test('temporary shield and revival feather retain their behavior together with equipment', () => {
  const run = wear(fresh(), 'armor');
  run.effects.shield = 25; run.bag.feather = 1; run.hp = 5;
  const blocked = C.takeDamage(run, 14);
  assert.equal(blocked.effect.damage, 4);
  assert.equal(blocked.run.hp, 1);
  const revived = C.takeDamage(run, 100);
  assert.equal(revived.effect.revived, true);
  assert.equal(revived.run.hp, 50);
  assert.equal(revived.run.bag.feather, 0);
  assert.ok(C.validateSave(revived.run));
});

test('weapons stun for the specified base durations without killing and wear only on a successful hit', () => {
  for (const [kind, seconds] of [['bat', 15], ['pan', 20], ['staff', 10]]) {
    const run = wear(fresh(), kind);
    const missed = C.hitMonster(run, null, 2);
    assert.equal(missed.ok, false);
    assert.equal(missed.run.equipment.weapon.durability, run.equipment.weapon.durability);
    const hit = C.hitMonster(run, 'monster-0', 2);
    assert.equal(hit.ok, true);
    assert.equal(hit.effect.stunSeconds, seconds);
    assert.equal(hit.run.monsterStuns['monster-0'], seconds);
    assert.equal(hit.run.equipment.weapon.durability, run.equipment.weapon.durability - 1);
    assert.deepEqual(hit.run.defeatedMonsters, []);
    assert.equal(C.effectiveMonsterStrength(hit.run, 'monster-0', 2), 1);
    assert.equal(C.effectiveMonsterStrength(hit.run, 'other-monster', 2), 2);
  }
});

test('enhancement on every worn armor and weapon adds ten seconds per point, reaching 140 seconds', () => {
  let run = fresh();
  for (const kind of ['helmet', 'armor', 'shield', 'pan']) {
    let gear;
    for (let seed = 1; seed <= 100; seed += 1) {
      gear = C.createGear(kind, 1, seed, kind, true);
      if (gear.bonus === 3) break;
    }
    assert.equal(gear.bonus, 3);
    run = C.equipGear(C.grantGear(run, gear).run, gear.id).run;
  }
  assert.deepEqual(C.equipmentStats(run), { defense: 18, bonus: 12, stunSeconds: 140 });
  const hit = C.hitMonster(run, 'monster-0', 5);
  assert.equal(hit.effect.stunSeconds, 140);
  assert.equal(hit.run.monsterStuns['monster-0'], 140);
  assert.ok(C.validateSave(hit.run));
});

test('stun clocks persist, count down while held, expire exactly and clear on descent', () => {
  let run = C.interceptMonster(withGuard(2), 'monster-0', 3).run;
  run = C.hitMonster(run, 'monster-0', 3).run;
  const restored = C.validateSave(JSON.stringify(run));
  assert.equal(restored.monsterStuns['monster-0'], 10);
  const ticked = C.tickEffects(restored, 9.5).run;
  assert.equal(ticked.monsterStuns['monster-0'], 0.5);
  assert.equal(ticked.warrior.remaining, 110.5);
  const expired = C.tickEffects(ticked, 0.5).run;
  assert.equal(expired.monsterStuns['monster-0'], undefined);
  assert.equal(C.effectiveMonsterStrength(expired, 'monster-0', 3), 3);
  const lower = C.descend(run).run;
  assert.deepEqual(lower.monsterStuns, {});
  assert.deepEqual(lower.equipment, run.equipment);
});

test('stunning a tied monster lets the warrior finish it and spend only its reduced strength', () => {
  for (let strength = 1; strength <= 5; strength += 1) {
    let run = C.interceptMonster(withGuard(strength), 'monster-0', strength).run;
    run = C.hitMonster(run, 'monster-0', strength).run;
    const result = C.resolveHeldMonster(run, 'monster-0', strength);
    assert.equal(result.ok, true);
    assert.equal(result.effect.outcome, 'defeat');
    assert.equal(result.run.warrior.mode, 'escort');
    assert.equal(result.run.warrior.strength, 1);
    assert.equal(result.run.monsterStuns['monster-0'], undefined);
    assert.deepEqual(result.run.defeatedMonsters, ['monster-0']);
    assert.ok(C.validateSave(result.run));
  }
});

test('zero-strength interception is allowed only for a stunned monster, and spent weapons cannot hit again', () => {
  const run = withGuard(1);
  assert.equal(C.interceptMonster(run, 'monster-0', 0).ok, false);
  const stunned = C.hitMonster(run, 'monster-0', 1).run;
  const killed = C.interceptMonster(stunned, 'monster-0', C.effectiveMonsterStrength(stunned, 'monster-0', 1));
  assert.equal(killed.effect.outcome, 'defeat');
  assert.equal(killed.run.warrior.strength, 1);
  assert.equal(C.hitMonster(killed.run, 'monster-0', 1).ok, false);
  const fragile = wear(fresh(), 'bat', { durability: 1 });
  const broken = C.hitMonster(fragile, 'monster-1', 5);
  assert.equal(broken.effect.broken.length, 1);
  assert.equal(broken.run.equipment.weapon, null);
  assert.equal(broken.run.monsterStuns['monster-1'], 15);
  assert.equal(C.hitMonster(broken.run, 'monster-2', 1).ok, false);
});

test('a temporary stun-created tie becomes timed when the monster recovers without resetting existing countdowns', () => {
  let run = C.hitMonster(withGuard(2), 'monster-0', 3).run;
  run = C.interceptMonster(run, 'monster-0', C.effectiveMonsterStrength(run, 'monster-0', 3)).run;
  assert.equal(run.warrior.remaining, null);
  run = C.tickEffects(run, 10).run;
  const reassessed = C.resolveHeldMonster(run, 'monster-0', 3);
  assert.equal(reassessed.effect.changed, true);
  assert.equal(reassessed.effect.outcome, 'hold');
  assert.equal(reassessed.effect.seconds, 120);
  run = C.tickEffects(reassessed.run, 40).run;
  assert.equal(C.resolveHeldMonster(run, 'monster-0', 3).run.warrior.remaining, 80);
  const equal = C.interceptMonster(withGuard(3), 'monster-0', 3).run;
  assert.equal(C.resolveHeldMonster(equal, 'monster-0', 3).run.warrior.remaining, null);
  let originallyWeak = C.interceptMonster(withGuard(2), 'monster-0', 3).run;
  originallyWeak = C.tickEffects(originallyWeak, 40).run;
  originallyWeak = C.hitMonster(originallyWeak, 'monster-0', 3).run;
  assert.equal(C.resolveHeldMonster(originallyWeak, 'monster-0', 3).run.warrior.remaining, 80);
  originallyWeak = C.tickEffects(originallyWeak, 10).run;
  assert.equal(C.resolveHeldMonster(originallyWeak, 'monster-0', 3).run.warrior.remaining, 70);
});

test('save validation clones equipment, stun and adventure state and rejects corrupt gear/duplicate IDs', () => {
  const run = C.hitMonster(fresh(), 'monster-0', 3).run;
  run.adventure = { version: 1, claimed: ['chest-0'], quest: { id: 'quest-0', floor: 99, type: 'stun', status: 'active', target: 'monster-0', goal: 2, progress: 1, events: ['monster-0'] } };
  const saved = C.validateSave(JSON.stringify(run));
  assert.deepEqual(saved, run);
  saved.equipment.weapon.durability = 1; saved.monsterStuns['monster-0'] = 1;
  saved.adventure.quest.events.push('monster-1');
  assert.equal(run.monsterStuns['monster-0'], 10);
  assert.equal(run.adventure.quest.events.length, 1);
  const gear = run.equipment.weapon;
  for (const mutation of [{ defense: 10000 }, { bonus: 4 }, { durability: 0 }, { maxDurability: 100 }, { slot: 'armor' }, { kind: '__proto__' }]) {
    assert.equal(C.validateSave({ ...run, equipment: { ...run.equipment, weapon: { ...gear, ...mutation } } }), null);
  }
  assert.equal(C.validateSave({ ...run, gearBag: [gear] }), null);
  assert.equal(C.validateSave({ ...run, monsterStuns: { 'monster-0': 141 } }), null);
  assert.equal(C.validateSave({ ...run, monsterStuns: { 'monster-0': 0 } }), null);
  assert.equal(C.validateSave({ ...run, adventure: { ...run.adventure, quest: { ...run.adventure.quest, floor: 98 } } }), null);
  assert.deepEqual(C.descend(run).run.adventure, C.newAdventure());
});

test('quest save status must agree with progress while completed and claimed records still roundtrip', () => {
  const run = fresh();
  const quest = { id: 'quest-0', floor: 99, type: 'stun', status: 'active', target: 'monster-0', goal: 2, progress: 1, events: ['monster-0'] };
  for (const [status, progress] of [['active', 2], ['active', 3], ['ready', 1], ['claimed', 1]]) {
    const invalid = { ...run, adventure: { version: 1, claimed: [], quest: { ...quest, status, progress } } };
    assert.equal(C.validateAdventure(invalid.adventure, 99), null, `${status} at ${progress}/2 is contradictory`);
    assert.equal(C.validateSave(JSON.stringify(invalid)), null);
  }
  for (const status of ['ready', 'claimed']) {
    const valid = { ...run, adventure: { version: 1, claimed: status === 'claimed' ? ['reward-0'] : [], quest: { ...quest, status, progress: 2, events: ['monster-0', 'monster-1'] } } };
    const saved = C.validateSave(JSON.stringify(valid));
    assert.deepEqual(saved, valid);
    assert.equal(saved.adventure.quest.status, status);
    assert.equal(saved.adventure.quest.progress, saved.adventure.quest.goal);
    saved.adventure.quest.events.push('independent-copy');
    assert.equal(valid.adventure.quest.events.length, 2);
  }
});

test('encounter rewards and trap damage can share one atomic revision without stripping quest state', () => {
  const run = fresh();
  const reward = C.createGear('helmet', 99, run.seed, 'chest-0', true);
  const result = C.transaction(run, run.revision, next => {
    const received = C.receiveGear(next, reward);
    if (!received.ok) return received;
    next.adventure.claimed.push('chest-0');
    return C.applyDamage(next, 5, 'trap');
  });
  assert.equal(result.ok, true);
  assert.equal(result.run.revision, run.revision + 1);
  assert.equal(result.run.hp, 95);
  assert.equal(result.run.gearBag.length, 1);
  assert.deepEqual(result.run.adventure.claimed, ['chest-0']);
  assert.deepEqual(run.adventure.claimed, []);
  assert.ok(C.validateSave(result.run));
});
