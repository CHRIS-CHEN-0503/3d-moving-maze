import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const THREE = require('../lib/three.min.js');
const C = require('../story/story-core.js'), N = require('../story/tower-narrative.js');
const E = require('../story/tower-encounters.js'), D = require('../story/tower-dungeons.js');
const read = name => readFileSync(new URL('../story/' + name, import.meta.url), 'utf8');
const sources = { coreSource: read('story-core.js'), narrativeSource: read('tower-narrative.js'), dungeonsSource: read('tower-dungeons.js'), encountersSource: read('tower-encounters.js'), charactersSource: read('tower-characters.js'), runtimeSource: read('tower-mode.js') };
const flowSource = readFileSync(new URL('./tower-flow.test.mjs', import.meta.url), 'utf8');
const factoryStart = flowSource.indexOf('function harness('), factoryEnd = flowSource.indexOf('\ntest(', factoryStart);
assert.ok(factoryStart >= 0 && factoryEnd > factoryStart);
// Reuse the exact DOM / real-Three.js harness without importing and re-registering
// the flow suite. Only this copied runtime receives the read-only inspection bridge.
const factory = vm.runInNewContext('(' + flowSource.slice(factoryStart, factoryEnd).trim() + ')', { vm, assert, THREE, console, SAVE_KEY: 'maze3d_tower_v1', ...sources });
const bridge = `window.__journeyTest = {
  state(){return {run,paused,floorConfig,mainClue,rift,explorer,dungeonObjects,loot,traders,monsters,shiftLeft,reader};},
  handleAction
};`;
const plain = value => JSON.parse(JSON.stringify(value));
function harness(run) {
  const h = factory(run, bridge); h.api = h.context.__journeyTest;
  const saved = h.save; h.save = () => plain(saved()); // Normalize data across the two VM realms, not production state.
  h.state = () => h.api.state();
  h.start = () => { h.context.TowerMode.open(); h.click('continue'); if (h.context.TowerMode.paused) h.click('close'); };
  h.approach = model => { h.context.G.px = model.position.x + .6; h.context.G.pz = model.position.z; h.tick(.2); };
  h.interact = model => { h.approach(model); assert.equal(h.get('towerTalkBtn').disabled, false); h.get('towerTalkBtn').onclick(); };
  h.exit = () => { const g = h.context.G, p = h.context.cellToWorld(g.exitCell.x, g.exitCell.y); g.px = p.x; g.pz = p.z; h.context.TowerMode.reachExit(); };
  h.finishReader = () => { for (let page = 0; page < 3 && h.get('towerDialog').buttons.some(b => b.dataset.tower === 'story-next'); page++) h.click('story-next'); h.click('story-finish'); };
  return h;
}
function runAt(floor = 99, seed = 1) {
  const run = C.newRun({ seed }); run.floor = floor; run.floorsCleared = 99 - floor; run.chronicle = N.newChronicle(floor); return run;
}
function findRun(predicate, floor = 99) {
  for (let seed = 1; seed <= 5000; seed++) { const run = runAt(floor, seed); if (predicate(run)) return run; }
  assert.fail('A deterministic fixture must exist within the bounded search');
}
function readyRift(kind = 'archive', questType) {
  let run = questType ? findRun(r => D.offer(r)?.kind === kind && E.explorerOffer(r)?.type === questType, 95) : runAt(95, { archive: 1, lantern: 17, bells: 45 }[kind]);
  assert.equal(D.offer(run).kind, kind);
  if (questType) { const accepted = E.acceptQuest(run, E.explorerOffer(run).id); assert.equal(accepted.ok, true); run = accepted.run; }
  run.claimed = ['s0', 'item-0']; run.chronicle.read = ['scene:99']; run.chronicle.clues = ['clue:summoning'];
  run.equipment.weapon.durability = Math.max(1, Math.min(4, run.equipment.weapon.maxDurability - 1));
  const discovered = D.discover(run); assert.equal(discovered.ok, true); return discovered.run;
}
function enterRift(h) {
  const portal = h.state().rift; assert.ok(portal?.model.visible);
  const returnPosition = { x: portal.x, z: portal.z };
  h.interact(portal.model); h.click('dungeon-enter', portal.offer.id);
  assert.ok(h.state().run.expedition.active); assert.equal(h.context.TowerMode.paused, true);
  return returnPosition;
}
function finishObjectives(h) {
  const offer = D.offer(h.state().run), order = offer.kind === 'bells' ? offer.order : [0, 1, 2];
  for (const index of order) {
    const entity = h.state().dungeonObjects.find(item => item.index === index);
    h.interact(entity.model); h.click('dungeon-interact', String(index));
    assert.equal(h.context.TowerMode.paused, false);
  }
  assert.equal(h.state().run.expedition.active.progress.length, 3);
}

for (const id of ['eve', 'rowan', 'mira', 'oren', 'sena']) {
  test(`真實場景建出 ${id} 的人物／姓名／對話，讀檔仍是同一探索者`, () => {
    const run = findRun(r => E.explorerOffer(r)?.explorer.id === id), h = harness(run); h.start();
    const person = h.state().explorer, identity = E.explorerIdentity(run.floor, run.seed);
    assert.equal(person.model.userData.explorerId, id); assert.equal(person.model.name, 'tower-explorer-' + id);
    let meshCount = 0; person.model.traverse(object => { if (object.isMesh) meshCount++; });
    assert.ok(meshCount >= 26, 'The runtime must use the original geometry builder, not a placeholder');
    assert.ok(person.model.children.some(child => child.userData.label === identity.title + '・' + identity.name));
    h.interact(person.model);
    assert.ok(h.get('towerDialog').innerHTML.includes(identity.name)); assert.ok(h.get('towerDialog').innerHTML.includes(identity.greeting));
    h.emit('pagehide'); const resumed = harness(h.save()); resumed.start();
    assert.equal(resumed.state().explorer.model.userData.explorerId, id);
  });
}

test('故事三頁可前後閱讀，不推進樓層／取得印記，已讀故事重讀能正常回日誌', () => {
  const h = harness(); h.context.TowerMode.beginNew();
  const initial = plain(h.state().run), scene = N.scenesForFloor(99)[0];
  assert.equal(h.state().reader.page, 0); assert.equal(h.state().reader.id, scene.id);
  h.tick(30); assert.equal(h.state().run.floorElapsed, initial.floorElapsed);
  h.get('towerDialog').scrollTop = 180;
  h.click('story-next'); assert.equal(h.state().reader.page, 1);
  assert.equal(h.get('towerDialog').scrollTop, 0, 'A new story page must begin at its heading, not the previous scroll offset');
  h.get('towerDialog').scrollTop = 220;
  h.click('story-prev'); assert.equal(h.state().reader.page, 0);
  assert.equal(h.get('towerDialog').scrollTop, 0);
  h.click('story-next'); h.click('story-next'); assert.equal(h.state().reader.page, 2);
  assert.ok(!h.state().run.chronicle.read.includes(scene.id), 'Only finishing the reader marks a scene as read');
  h.click('story-finish'); assert.equal(h.context.TowerMode.paused, false);
  assert.equal(h.state().run.floor, 99); assert.deepEqual(plain(h.state().run.chronicle.clues), []);
  assert.ok(h.save().chronicle.read.includes(scene.id));
  h.emit('keydown', { code: 'KeyJ' }); h.click('story-read', scene.id);
  h.click('story-next'); h.click('story-next'); h.click('story-finish');
  assert.match(h.get('towerDialog').innerHTML, /旅人的手記/);
  assert.equal(h.state().run.chronicle.read.filter(id => id === scene.id).length, 1);
  assert.equal(h.state().run.floor, 99);
});

test('非章末可以正常下降，章末未取得印記不能靠重複碰門或確認跳過', () => {
  const normal = harness(runAt(94)); normal.start(); normal.exit(); assert.equal(normal.save().floor, 93);
  const gated = harness(runAt(90)); gated.start(); gated.exit();
  assert.equal(gated.state().run.floor, 90); assert.match(gated.get('towerDialog').innerHTML, /門上缺少一枚印記/);
  gated.click('close'); gated.exit(); gated.api.handleAction('exit-confirm');
  assert.equal(gated.state().run.floor, 90); assert.equal(gated.save().floor, 90);
});

test('主印記只可近距離通路互動，保存成功後才隱藏與解鎖章末', () => {
  const h = harness(runAt(90)); h.start(); const clue = h.state().mainClue, chapter = N.chapterForFloor(90);
  assert.ok(clue?.model.visible);
  h.context.G.px = -100; h.context.G.pz = -100; h.tick(.2); h.get('towerTalkBtn').onclick();
  assert.equal(N.canDescend(h.state().run), false);
  h.context.playerInWall = () => true; h.approach(clue.model); h.get('towerTalkBtn').onclick();
  assert.equal(N.canDescend(h.state().run), false); assert.equal(clue.model.visible, true);
  h.context.playerInWall = () => false;
  const setItem = h.context.localStorage.setItem;
  h.context.localStorage.setItem = () => { throw new Error('Storage full fixture'); };
  h.interact(clue.model);
  assert.equal(N.canDescend(h.state().run), false, 'A failed durable save must not unlock the chapter gate');
  assert.equal(clue.model.visible, true); assert.ok(!h.save().chronicle.clues.includes(chapter.clueId));
  h.context.localStorage.setItem = setItem;
  if (h.context.TowerMode.paused) h.click('close');
  h.interact(clue.model);
  assert.ok(h.save().chronicle.clues.includes(chapter.clueId)); assert.equal(clue.model.visible, false);
  assert.equal(N.canDescend(h.state().run), true);
  h.click('close'); h.exit();
  if (h.state().reader?.exit) h.finishReader();
  assert.equal(h.save().floor, 89);
});

test('章中故事在拾取印記後才閱讀，章末故事三頁讀完後才下降', () => {
  const middle = harness(runAt(95)); middle.start();
  assert.equal(middle.state().reader, null, 'Reaching the middle floor alone must not claim the story pickup in prose');
  middle.interact(middle.state().mainClue.model);
  assert.equal(middle.state().reader.id, 'scene:95'); assert.equal(middle.state().run.floor, 95);
  middle.finishReader(); assert.ok(middle.save().chronicle.read.includes('scene:95')); assert.equal(middle.save().floor, 95);
  const run = runAt(90); run.chronicle.clues.push('clue:summoning');
  const end = harness(run); end.start(); end.exit();
  assert.equal(end.state().reader.id, 'scene:90'); assert.equal(end.state().reader.exit, true); assert.equal(end.save().floor, 90);
  end.tick(30); end.click('story-next'); end.click('story-next'); assert.equal(end.save().floor, 90);
  end.click('story-finish'); assert.equal(end.save().floor, 89); assert.ok(end.save().chronicle.read.includes('scene:90'));
  end.context.TowerMode.reachExit(); assert.equal(end.save().floor, 89, 'Completing the reader cannot trigger duplicate descent');
});

test('沒有主線／副本欄位的舊存檔可續玩，保留職業裝備並在本章補取印記', () => {
  const old = runAt(80, 444); old.charIdx = 4; old.claimed = ['s0', 'item-0']; old.hunger = 43;
  delete old.chronicle; delete old.expedition;
  const h = harness(old); h.start();
  assert.equal(h.context.G.charIdx, 4); assert.equal(h.context.G.satiety, 43); assert.equal(h.save().floor, 80);
  assert.deepEqual(h.save().equipment, old.equipment); assert.deepEqual(h.save().claimed, old.claimed);
  assert.deepEqual(h.save().expedition, D.newExpedition());
  assert.ok(h.save().chronicle.clues.includes('clue:summoning'), 'Legacy descent through the previous chapter must remain valid');
  assert.ok(!h.save().chronicle.clues.includes('clue:garden')); assert.ok(h.state().mainClue?.model.visible);
  assert.equal(N.canDescend(h.state().run), false); assert.ok(C.validateSave(h.save()));
});

for (const ending of N.ENDINGS) {
  test(`選擇 ${ending.id} 結局後保存正確故事，重複動作不能改寫結局`, () => {
    const run = runAt(1, 765); run.chronicle.clues.push('clue:heart'); run.chronicle.read.push('scene:1');
    const h = harness(run); h.start(); h.exit();
    assert.equal(h.state().run.status, 'playing'); assert.equal(h.state().run.chronicle.ending, null);
    h.click('ending', ending.id);
    assert.equal(h.save().status, 'won'); assert.equal(h.save().chronicle.ending, ending.id);
    assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(ending.paragraphs[0])));
    const previous = h.save(); h.api.handleAction('ending', N.ENDINGS.find(item => item.id !== ending.id).id);
    h.context.TowerMode.reachExit(); h.emit('pagehide');
    assert.deepEqual(h.save(), previous); assert.ok(C.validateSave(h.save()));
  });
}

test('通關回首頁可回顧已完成故事與自己的結局，不開新遊戲或改寫存檔', () => {
  const run = runAt(1, 765); run.chronicle.clues.push('clue:heart'); run.chronicle.read.push('scene:1');
  const h = harness(run), ending = N.ENDINGS.find(entry => entry.id === 'bridge');
  h.start(); h.exit(); h.click('ending', ending.id);
  const won = h.save(); assert.equal(won.status, 'won');
  h.click('home'); assert.equal(h.context.TowerMode.active, false); assert.equal(h.context.G.running, false);
  assert.deepEqual(h.save(), won);
  const buildCount = h.context.startSettingsHistory.length, setItem = h.context.localStorage.setItem;
  let writes = 0;
  h.context.localStorage.setItem = (key, value) => { writes++; setItem(key, value); };
  h.context.TowerMode.open(); h.click('story-archive');
  assert.match(h.get('towerDialog').innerHTML, /旅人的手記|回首頁/);
  assert.ok(!h.get('towerDialog').buttons.some(button => button.dataset.tower === 'quest'));
  h.click('ending-read');
  assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(ending.title)));
  assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(ending.paragraphs[0])));
  h.tick(30); h.emit('pagehide'); h.click('journal'); h.click('close');
  assert.equal(h.context.TowerMode.active, false); assert.equal(h.context.G.running, false);
  assert.equal(h.context.startSettingsHistory.length, buildCount); assert.equal(h.context.entryFlow, undefined);
  assert.equal(h.state().run.status, 'won'); assert.equal(h.state().run.chronicle.ending, ending.id);
  assert.deepEqual(h.save(), won); assert.deepEqual(plain(h.state().run), won);
  assert.equal(writes, 0, 'Archive reading must be read-only, including pagehide and return home');
});

test('裂隙需探索三格才顯示，遠距或隔牆無法進入', () => {
  const h = harness(runAt(95, 1)); h.start(); const portal = h.state().rift;
  assert.ok(portal); assert.equal(portal.model.visible, false);
  for (const x of [0, 4, 8]) { h.context.G.px = x; h.context.G.pz = 0; h.tick(.2); }
  assert.equal(portal.model.visible, true); assert.equal(h.save().expedition.discovered, true);
  h.context.G.px = -100; h.context.G.pz = -100;
  h.api.handleAction('dungeon-enter', portal.offer.id); assert.equal(h.state().run.expedition.active, null);
  h.context.playerInWall = () => true; h.approach(portal.model); h.api.handleAction('dungeon-enter', portal.offer.id);
  assert.equal(h.state().run.expedition.active, null);
  h.context.playerInWall = () => false; enterRift(h);
  assert.equal(h.context.startSettingsHistory.length, 2);
});

for (const kind of ['archive', 'bells', 'lantern']) {
  test(`${kind} 進入獨立小迷宮，三目標完成後回原層且不重設物資、裝備與主線`, () => {
    const run = readyRift(kind), h = harness(run); h.start();
    const original = plain(h.state().run), normalPlayer = h.context.playerGroup, returnPosition = enterRift(h);
    const offer = D.offer(h.state().run);
    assert.equal(h.context.G.mazeW, offer.size); assert.notEqual(h.context.playerGroup, normalPlayer);
    assert.equal(h.context.lastStartSettings.itemCount, 0); assert.equal(h.context.lastStartSettings.foodCount, 0);
    assert.equal(h.context.TowerMode.itemConfig().total, 0); assert.equal(h.context.G.items.length + h.context.G.foods.length, 0);
    assert.equal(h.state().dungeonObjects.length, 3); assert.equal(h.state().loot.length + h.state().traders.length + h.state().monsters.length, 0);
    assert.equal(h.state().explorer, null); assert.equal(h.state().mainClue, null); assert.equal(h.state().rift, null);
    h.click('close');
    h.context.G.px = -100; h.context.G.pz = -100; h.api.handleAction('dungeon-interact', '0');
    assert.equal(h.state().run.expedition.active.progress.length, 0);
    h.context.playerInWall = () => true; h.approach(h.state().dungeonObjects[0].model); h.api.handleAction('dungeon-interact', '0');
    assert.equal(h.state().run.expedition.active.progress.length, 0); h.context.playerInWall = () => false;
    finishObjectives(h); h.exit();
    assert.equal(h.state().run.expedition.active, null); assert.equal(h.save().floor, 95); assert.equal(h.save().floorsCleared, 4);
    assert.equal(h.context.G.mazeW, C.floorConfig(95).size); assert.equal(h.context.startSettingsHistory.length, 3);
    assert.equal(h.context.G.px, returnPosition.x); assert.equal(h.context.G.pz, returnPosition.z);
    assert.equal(h.save().expedition.history.at(-1).outcome, 'completed');
    assert.equal(h.save().coins, original.coins + offer.reward.coins);
    assert.deepEqual(h.save().claimed, original.claimed); assert.deepEqual(h.save().equipment, original.equipment); assert.deepEqual(h.save().chronicle, original.chronicle);
    assert.ok(C.validateSave(h.save()));
    h.click('close'); h.api.handleAction('dungeon-abandon'); assert.equal(h.save().expedition.history.length, 1);
  });
}

test('副本暫停與變形不扣時間，也不推進原層探索者委託；重新讀檔保留進度', () => {
  const h = harness(readyRift('archive', 'survey')); h.start(); enterRift(h);
  const quest = plain(h.state().run.adventure.quest), initial = h.state().run.expedition.active.elapsed;
  h.tick(30); assert.equal(h.state().run.expedition.active.elapsed, initial);
  h.click('close'); h.tick(1); const advanced = h.state().run.expedition.active.elapsed; assert.ok(advanced > initial);
  h.get('towerBagBtn').onclick(); h.tick(30); assert.equal(h.state().run.expedition.active.elapsed, advanced); h.click('close');
  h.tick(31); h.context.TowerMode.updateShift(); assert.equal(h.context.G.shifting, true);
  const beforeShift = h.state().run.expedition.active.elapsed; h.tick(5); assert.equal(h.state().run.expedition.active.elapsed, beforeShift);
  h.context.G.shifting = false; h.tick(.2);
  h.interact(h.state().dungeonObjects[0].model); h.click('dungeon-interact', '0');
  assert.deepEqual(plain(h.state().run.adventure.quest), quest, 'Dungeon walking and objects do not count toward the original quest');
  h.emit('pagehide'); const saved = h.save(), resumed = harness(saved); resumed.start();
  assert.equal(resumed.context.G.mazeW, D.offer(saved).size); assert.deepEqual(plain(resumed.state().run.expedition.active.progress), saved.expedition.active.progress);
  assert.equal(resumed.state().run.expedition.active.elapsed, saved.expedition.active.elapsed);
  assert.deepEqual(plain(resumed.state().run.adventure.quest), quest);
});

for (const outcome of ['abandoned', 'expired']) {
  test(`副本 ${outcome} 回原層但不領獎，也不能重新進入已結案裂隙`, () => {
    const h = harness(readyRift('lantern')); h.start(); const before = plain(h.state().run); enterRift(h);
    if (outcome === 'abandoned') { h.click('dungeon-leave'); h.click('dungeon-abandon'); }
    else { h.click('close'); for (let second = 0; second < 100 && h.state().run.expedition.active; second++) h.tick(1); }
    assert.equal(h.state().run.expedition.active, null); assert.equal(h.save().floor, before.floor);
    assert.equal(h.save().expedition.history.at(-1).outcome, outcome); assert.equal(h.save().coins, before.coins);
    assert.deepEqual(h.save().bag, before.bag); assert.deepEqual(h.save().gearBag, before.gearBag); assert.equal(h.state().rift, null);
    assert.ok(C.validateSave(h.save()));
  });
}

for (const outcome of ['completed', 'expired']) {
  test(`副本 ${outcome} 結算保存失敗會原地暫停，修復後明確重試只結算一次`, () => {
    const h = harness(readyRift('lantern')); h.start(); enterRift(h); h.click('close');
    const offer = D.offer(h.state().run);
    if (outcome === 'completed') finishObjectives(h);
    else {
      // Move to the last second while storage is healthy; only settlement fails.
      for (let left = offer.timeLimit - h.state().run.expedition.active.elapsed - 1; left > 0;) {
        const seconds = Math.min(60, left); h.tick(seconds); left -= seconds;
      }
    }
    h.emit('pagehide');
    const before = plain(h.state().run), durableBefore = h.save(), player = h.context.playerGroup;
    const buildCount = h.context.startSettingsHistory.length, setItem = h.context.localStorage.setItem;
    let failedWrites = 0;
    h.context.localStorage.setItem = () => { failedWrites++; throw new Error('Settlement storage full fixture'); };
    h.get('towerDialog').scrollTop = 190;
    if (outcome === 'completed') h.exit(); else h.tick(1);

    assert.equal(failedWrites, 1, 'A settlement makes one durable save attempt');
    assert.match(h.get('towerDialog').innerHTML, /請重試保存結算/);
    assert.equal(h.get('towerDialog').scrollTop, 0);
    assert.equal(h.context.TowerMode.paused, true); assert.equal(h.context.G.frozen, true);
    assert.equal(h.state().run.expedition.active.id, before.expedition.active.id);
    assert.deepEqual(plain(h.state().run.expedition.history), before.expedition.history);
    assert.equal(h.state().run.coins, before.coins); assert.deepEqual(plain(h.state().run.bag), before.bag);
    assert.deepEqual(plain(h.state().run.gearBag), before.gearBag);
    assert.equal(h.context.playerGroup, player); assert.equal(h.context.startSettingsHistory.length, buildCount);
    assert.deepEqual(h.save(), durableBefore, 'Failure must leave the last durable save intact');
    const failedState = plain(h.state().run), elapsed = failedState.expedition.active.elapsed;
    for (let frame = 0; frame < 12; frame++) { h.tick(1); h.context.TowerMode.reachExit(); }
    assert.equal(failedWrites, 1, 'Paused timeout must not retry saving on every frame');
    assert.equal(h.state().run.expedition.active.elapsed, elapsed);
    assert.deepEqual(plain(h.state().run), failedState);

    h.click('dungeon-settle', outcome);
    assert.equal(failedWrites, 2, 'Only an explicit retry requests another write');
    assert.equal(h.context.TowerMode.paused, true); assert.equal(h.context.playerGroup, player);
    assert.deepEqual(plain(h.state().run), failedState);
    h.context.localStorage.setItem = setItem;
    h.click('dungeon-settle', outcome);
    const settled = h.save();
    assert.equal(settled.expedition.active, null); assert.equal(settled.floor, before.floor);
    assert.equal(settled.expedition.history.length, before.expedition.history.length + 1);
    assert.equal(settled.expedition.history.at(-1).outcome, outcome);
    assert.equal(settled.coins, before.coins + (outcome === 'completed' ? offer.reward.coins : 0));
    for (const id of Object.keys(before.bag)) {
      assert.equal(settled.bag[id], before.bag[id] + (outcome === 'completed' ? offer.reward.items[id] || 0 : 0));
    }
    assert.notEqual(h.context.playerGroup, player); assert.equal(h.context.startSettingsHistory.length, buildCount + 1);
    assert.deepEqual(settled.claimed, before.claimed); assert.deepEqual(settled.equipment, before.equipment);
    assert.deepEqual(settled.chronicle, before.chronicle); assert.ok(C.validateSave(settled));
    h.api.handleAction('dungeon-settle', outcome); h.api.handleAction('dungeon-settle', 'completed');
    h.context.TowerMode.reachExit(); h.emit('pagehide');
    assert.deepEqual(h.save(), settled, 'Stale retry actions cannot duplicate rewards or settlement history');
    assert.equal(h.context.startSettingsHistory.length, buildCount + 1);
  });
}
