import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const THREE = require('../lib/three.min.js');
const C = require('../story/story-core.js'), N = require('../story/tower-narrative.js');
const D = require('../story/tower-dungeons.js'), S = require('../story/tower-side-stories.js');
const read = name => readFileSync(new URL('../story/' + name, import.meta.url), 'utf8');
const sources = { coreSource: read('story-core.js'), narrativeSource: read('tower-narrative.js'), sideStoriesSource: read('tower-side-stories.js'), dungeonsSource: read('tower-dungeons.js'), encountersSource: read('tower-encounters.js'), charactersSource: read('tower-characters.js'), runtimeSource: read('tower-mode.js') };
const flowSource = readFileSync(new URL('./tower-flow.test.mjs', import.meta.url), 'utf8');
const factoryStart = flowSource.indexOf('function harness('), factoryEnd = flowSource.indexOf('\ntest(', factoryStart);
assert.ok(factoryStart >= 0 && factoryEnd > factoryStart);
const factory = vm.runInNewContext('(' + flowSource.slice(factoryStart, factoryEnd).trim() + ')', { vm, assert, THREE, console, SAVE_KEY: 'maze3d_tower_v1', ...sources });
const bridge = `window.__sideTest = {
  state(){return {run,paused,floorConfig,mainClue,rift,explorer,dungeonObjects,loot,traders,monsters,shiftLeft,reader};},
  handleAction
};`;
const plain = value => JSON.parse(JSON.stringify(value));
const kinds = ['threads', 'mirrors', 'clockwork', 'tribunal', 'stars', 'supper'];
const fixtures = new Map();

function runAt(floor, seed) {
  const run = C.newRun({ seed }); run.floor = floor; run.floorsCleared = 99 - floor;
  run.chronicle = N.newChronicle(floor); return run;
}
function fixture(kind) {
  if (fixtures.has(kind)) return plain(fixtures.get(kind));
  for (const floor of [95, 89, 79, 69, 59, 49, 39, 29, 19, 9]) {
    for (let seed = 1; seed <= 500; seed++) {
      const run = runAt(floor, seed);
      if (D.offer(run)?.kind !== kind) continue;
      const discovered = D.discover(run); assert.equal(discovered.ok, true);
      fixtures.set(kind, discovered.run); return plain(discovered.run);
    }
  }
  assert.fail('No bounded, legal fixture found for ' + kind);
}
function harness(run) {
  const h = factory(run, bridge); h.api = h.context.__sideTest;
  h.state = () => h.api.state();
  const saved = h.save; h.save = () => plain(saved());
  h.start = () => { h.context.TowerMode.open(); h.click('continue'); if (h.context.TowerMode.paused) h.click('close'); };
  h.approach = model => { h.context.G.px = model.position.x + .6; h.context.G.pz = model.position.z; h.tick(.2); };
  h.interact = model => { h.approach(model); assert.equal(h.get('towerTalkBtn').disabled, false); h.get('towerTalkBtn').onclick(); };
  h.enter = () => {
    h.start(); const rift = h.state().rift; assert.ok(rift?.model.visible);
    h.interact(rift.model); h.click('dungeon-enter', rift.offer.id);
    assert.ok(h.state().run.expedition.active); assert.equal(h.context.TowerMode.paused, true);
  };
  h.exit = () => {
    const g = h.context.G, point = h.context.cellToWorld(g.exitCell.x, g.exitCell.y);
    g.px = point.x; g.pz = point.z; h.context.TowerMode.reachExit();
  };
  return h;
}
function choose(h, index, choice) {
  const node = h.state().dungeonObjects.find(item => item.index === index); h.interact(node.model);
  const step = S.get(h.state().run.expedition.active.kind).steps[index];
  assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(step.title)));
  if (choice === undefined && step.options?.length) choice = step.correctChoice;
  if (choice === undefined) h.click('dungeon-interact', String(index));
  else h.click('dungeon-choice', index + ':' + choice);
}
function completeShift(h) {
  for (let frame = 0; frame < 70 && !h.context.G.shifting; frame++) {
    h.tick(1); h.context.TowerMode.updateShift();
  }
  assert.equal(h.context.G.shifting, true, 'The normal runtime countdown must initiate an actual maze shift');
  const elapsed = h.state().run.expedition.active.elapsed;
  h.tick(3); assert.equal(h.state().run.expedition.active.elapsed, elapsed);
  // The original maze engine calls scheduleShift after its animation; the
  // following frame is the production runtime's single completion boundary.
  h.context.G.shifting = false; h.context.TowerMode.scheduleShift(); h.tick(.01);
}
function complete(h) {
  const offer = D.offer(h.state().run), order = ['threads', 'stars'].includes(offer.kind) ? offer.order : [0, 1, 2];
  for (const index of order) {
    choose(h, index);
    assert.equal(h.context.TowerMode.paused, false);
    if (offer.kind === 'stars' && index === 0) completeShift(h);
  }
  assert.equal(h.state().run.expedition.active.progress.length, 3);
}

for (const kind of kinds) {
  test(`${kind} 真實副本場景、三個專用互動物、獨立玩法與一次性完成保存`, () => {
    const run = fixture(kind), h = harness(run), original = plain(run), spec = S.get(kind);
    h.enter();
    assert.equal(h.state().run.expedition.version, 2);
    assert.equal(h.context.G.mazeW, D.offer(h.state().run).size);
    assert.equal(h.state().dungeonObjects.length, 3);
    assert.equal(h.state().loot.length + h.state().traders.length + h.state().monsters.length, 0);
    assert.equal(h.state().explorer, null); assert.equal(h.state().mainClue, null);
    assert.equal(h.context.lastStartSettings.itemCount, 0); assert.equal(h.context.lastStartSettings.foodCount, 0);
    assert.deepEqual(Array.from(h.state().dungeonObjects, node => node.label), Array.from(spec.steps, step => step.title));
    for (const node of h.state().dungeonObjects) {
      let meshes = 0;
      node.model.traverse(object => {
        assert.equal(!!object.isLight, false, 'Side-story objects do not add dynamic lights');
        if (!object.isMesh) return;
        meshes++;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          assert.equal(!!material.map, false, 'Objects use original geometry, not extra raster textures');
        }
      });
      assert.ok(meshes >= 2 && meshes <= 20, 'Three low-poly objectives must remain bounded');
    }
    const pausedElapsed = h.state().run.expedition.active.elapsed;
    h.tick(20); assert.equal(h.state().run.expedition.active.elapsed, pausedElapsed);
    h.click('close'); complete(h); h.exit();
    assert.equal(h.save().floor, original.floor); assert.equal(h.save().expedition.active, null);
    assert.equal(h.save().expedition.history.length, 1); assert.equal(h.save().expedition.history[0].kind, kind);
    assert.equal(h.save().expedition.history[0].outcome, 'completed');
    assert.deepEqual(h.save().claimed, original.claimed); assert.deepEqual(h.save().chronicle, original.chronicle);
    assert.ok(C.validateSave(h.save())); assert.ok(S.collectedStories(h.save()).some(entry => entry.kind === kind));
    const settled = h.save(); h.api.handleAction('dungeon-settle', 'completed'); h.emit('pagehide');
    assert.deepEqual(h.save(), settled, 'Stale settlement must not pay twice or alter main-story clues');
  });
}

test('六種新副本物件不只是改字與換色，幾何造型皆可區分', () => {
  const signatures = new Set();
  for (const kind of kinds) {
    const h = harness(fixture(kind)); h.enter();
    const geometry = [];
    for (const node of h.state().dungeonObjects) node.model.traverse(object => {
      if (object.isMesh) geometry.push([object.geometry.type, object.geometry.parameters, object.position.toArray(), object.rotation.toArray()]);
    });
    signatures.add(JSON.stringify(geometry));
  }
  assert.equal(signatures.size, kinds.length);
});

for (const kind of ['mirrors', 'tribunal', 'supper']) {
  test(`${kind} 選項必須近距離作答，錯誤可重試、不扣餐點背包，重複正解不重複計數`, () => {
    const h = harness(fixture(kind)); h.enter(); h.click('close');
    if (kind === 'tribunal') { choose(h, 0); choose(h, 1); }
    const index = kind === 'tribunal' ? 2 : 0, step = S.get(kind).steps[index];
    const before = plain(h.state().run), wrong = (step.correctChoice + 1) % step.options.length;
    h.context.G.px = -100; h.context.G.pz = -100;
    h.api.handleAction('dungeon-choice', index + ':' + step.correctChoice);
    assert.deepEqual(plain(h.state().run.expedition.active.progress), before.expedition.active.progress);
    h.context.playerInWall = () => true; h.approach(h.state().dungeonObjects[index].model);
    h.api.handleAction('dungeon-choice', index + ':' + step.correctChoice);
    assert.deepEqual(plain(h.state().run.expedition.active.progress), before.expedition.active.progress);
    h.context.playerInWall = () => false;
    choose(h, index, wrong);
    assert.equal(h.state().run.expedition.active.mistakes, before.expedition.active.mistakes + 1);
    assert.deepEqual(plain(h.state().run.expedition.active.progress), before.expedition.active.progress);
    assert.deepEqual(plain(h.state().run.bag), before.bag);
    choose(h, index); const solved = plain(h.state().run.expedition.active.progress);
    assert.ok(solved.includes(index));
    h.api.handleAction('dungeon-choice', index + ':' + step.correctChoice);
    assert.deepEqual(plain(h.state().run.expedition.active.progress), solved);
  });
}

for (const kind of ['clockwork', 'tribunal']) {
  test(`${kind} 未完成兩個前置目標不能提前啟動最後裝置`, () => {
    const h = harness(fixture(kind)); h.enter(); h.click('close');
    const before = plain(h.state().run), step = S.get(kind).steps[2];
    h.approach(h.state().dungeonObjects[2].model);
    h.api.handleAction(step.options ? 'dungeon-choice' : 'dungeon-interact', step.options ? '2:' + step.correctChoice : '2');
    assert.deepEqual(plain(h.state().run.expedition.active.progress), []); assert.equal(h.state().run.hp, before.hp);
    choose(h, 1); choose(h, 0); choose(h, 2);
    assert.deepEqual(plain(h.state().run.expedition.active.progress), [1, 0, 2]);
  });
}

test('星圖必須校準後才計一次真實變形，排程／讀檔不能偷算且後續幀不重算', () => {
  const h = harness(fixture('stars')); h.enter(); h.click('close');
  const offer = D.offer(h.state().run);
  h.context.TowerMode.scheduleShift(); h.tick(.1);
  assert.equal(h.state().run.expedition.active.shiftCount, 0);
  choose(h, 0);
  const second = offer.order[1]; h.approach(h.state().dungeonObjects[second].model);
  h.api.handleAction('dungeon-interact', String(second));
  assert.deepEqual(plain(h.state().run.expedition.active.progress), [0]);
  h.emit('pagehide'); const saved = h.save(), resumed = harness(saved); resumed.start();
  assert.equal(resumed.state().run.expedition.active.shiftCount, 0);
  completeShift(resumed);
  assert.equal(resumed.state().run.expedition.active.shiftCount, 1);
  for (let frame = 0; frame < 5; frame++) resumed.tick(.01);
  assert.equal(resumed.state().run.expedition.active.shiftCount, 1);
  choose(resumed, second); choose(resumed, offer.order[2]);
  assert.deepEqual(plain(resumed.state().run.expedition.active.progress), Array.from(offer.order));
  resumed.emit('pagehide'); const restored = harness(resumed.save()); restored.start();
  assert.equal(restored.state().run.expedition.active.shiftCount, 1);
  assert.deepEqual(plain(restored.state().run.expedition.active.progress), Array.from(offer.order));
});

test('星圖校準前發生的變形不能充作校準後的星路證據', () => {
  const h = harness(fixture('stars')); h.enter(); h.click('close');
  completeShift(h); assert.equal(h.state().run.expedition.active.shiftCount, 1);
  choose(h, 0); assert.equal(h.state().run.expedition.active.shiftAtStart, 1);
  const second = D.offer(h.state().run).order[1]; h.approach(h.state().dungeonObjects[second].model);
  h.api.handleAction('dungeon-interact', String(second));
  assert.deepEqual(plain(h.state().run.expedition.active.progress), [0]);
  completeShift(h); assert.equal(h.state().run.expedition.active.shiftCount, 2);
  choose(h, second); assert.equal(h.state().run.expedition.active.progress.length, 2);
});

test('星路觀測保存失敗鎖住倒數與退出，明確重試後保留同一次變形且可續讀', () => {
  const h = harness(fixture('stars')); h.enter(); h.click('close'); choose(h, 0);
  for (let frame = 0; frame < 70 && !h.context.G.shifting; frame++) {
    h.tick(1); h.context.TowerMode.updateShift();
  }
  assert.equal(h.context.G.shifting, true);
  const elapsed = h.state().run.expedition.active.elapsed, durable = h.save();
  const setItem = h.context.localStorage.setItem;
  let writes = 0;
  h.context.localStorage.setItem = () => { writes++; throw new Error('Transient shift save failure'); };
  h.context.G.shifting = false; h.context.TowerMode.scheduleShift(); h.tick(.01);
  assert.equal(writes, 1); assert.equal(h.context.TowerMode.paused, true); assert.equal(h.context.G.frozen, true);
  assert.equal(h.state().run.expedition.active.shiftCount, 0);
  assert.equal(h.state().run.expedition.active.elapsed, elapsed);
  assert.deepEqual(h.save(), durable);
  assert.ok(h.get('towerDialog').buttons.some(button => button.dataset.tower === 'dungeon-shift-retry'));
  assert.ok(!h.get('towerDialog').buttons.some(button => button.dataset.tower === 'close'));
  const failed = plain(h.state().run);
  h.emit('keydown', { code: 'Escape' }); h.api.handleAction('close');
  assert.equal(h.context.TowerMode.paused, true); assert.equal(h.get('towerOverlay').hidden, false);
  for (let frame = 0; frame < 8; frame++) { h.tick(1); h.context.TowerMode.updateShift(); }
  assert.equal(writes, 1, 'Animation frames do not repeatedly retry storage');
  assert.deepEqual(plain(h.state().run), failed);
  h.click('dungeon-shift-retry'); assert.equal(writes, 2);
  assert.equal(h.context.TowerMode.paused, true); assert.deepEqual(plain(h.state().run), failed);
  h.context.localStorage.setItem = setItem; h.click('dungeon-shift-retry');
  assert.equal(h.context.TowerMode.paused, false); assert.equal(h.context.G.frozen, false);
  assert.equal(h.state().run.expedition.active.shiftCount, 1);
  assert.equal(h.state().run.expedition.active.elapsed, elapsed, 'The original observation resumes without another maze shift');
  assert.equal(h.save().expedition.active.shiftCount, 1);
  h.api.handleAction('dungeon-shift-retry'); h.tick(.2); h.emit('pagehide');
  assert.equal(h.state().run.expedition.active.shiftCount, 1);
  const resumed = harness(h.save()); resumed.start();
  assert.equal(resumed.state().run.expedition.active.shiftCount, 1);
  const second = D.offer(resumed.state().run).order[1]; choose(resumed, second);
  assert.equal(resumed.state().run.expedition.active.progress.length, 2);
});

test('新選項解謎保存失敗不綠燈、不加進度；明確重試才生效一次', () => {
  const h = harness(fixture('mirrors')); h.enter(); h.click('close');
  const node = h.state().dungeonObjects[0], step = S.get('mirrors').steps[0];
  h.interact(node.model); h.emit('pagehide');
  const before = h.save(), initialColor = node.icon.material.color.getHex();
  const setItem = h.context.localStorage.setItem;
  h.context.localStorage.setItem = () => { throw new Error('Choice storage fixture'); };
  h.click('dungeon-choice', '0:' + step.correctChoice);
  assert.deepEqual(plain(h.state().run.expedition.active.progress), []);
  assert.deepEqual(h.save(), before); assert.equal(node.icon.material.color.getHex(), initialColor);
  assert.equal(h.context.TowerMode.paused, true);
  h.context.localStorage.setItem = setItem; h.click('dungeon-choice', '0:' + step.correctChoice);
  assert.deepEqual(h.save().expedition.active.progress, [0]);
  assert.notEqual(node.icon.material.color.getHex(), initialColor);
  h.api.handleAction('dungeon-choice', '0:' + step.correctChoice);
  assert.deepEqual(h.save().expedition.active.progress, [0]);
});

test('新劇情副本完成前不授予逸聞；放棄也不出現主線回聲或結局回聲', () => {
  const h = harness(fixture('threads')); h.enter(); h.click('close');
  assert.deepEqual(S.collectedStories(h.state().run), []);
  complete(h);
  assert.deepEqual(S.collectedStories(h.state().run), [], 'Finishing objectives alone is not durable settlement');
  h.get('towerBagBtn').onclick(); h.click('dungeon-brief'); h.click('dungeon-leave'); h.click('dungeon-abandon');
  assert.equal(h.save().expedition.history[0].outcome, 'abandoned');
  assert.deepEqual(S.collectedStories(h.save()), []);
  for (const scene of N.SCENES) assert.deepEqual(S.echoesForScene(h.save(), scene.id), []);
  for (const ending of N.ENDINGS) assert.deepEqual(S.endingEchoes(h.save(), ending.id), []);
});

test('已完成副本進入逸聞日誌，重讀與再開日誌不重發報酬、不改主線印記', () => {
  const h = harness(fixture('supper')); h.enter(); h.click('close'); complete(h); h.exit(); h.click('close');
  h.emit('pagehide'); const before = h.save();
  h.emit('keydown', { code: 'KeyJ' });
  assert.match(h.get('towerDialog').innerHTML, /旅途逸聞/);
  h.click('side-story-read', 'supper');
  for (const [index, paragraph] of S.get('supper').record.paragraphs.entries()) {
    assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(paragraph)));
    if (index < 2) h.click('side-next');
  }
  h.tick(20); h.click('journal'); h.click('side-story-read', 'supper'); h.emit('pagehide');
  assert.deepEqual(h.save(), before);
  assert.deepEqual(S.endingEchoes(h.save(), 'bridge'), [], 'The supper memory is a self-contained side story');
});

test('已完成的紅線逸聞在對應主線末頁出現回聲，沒有完成紀錄就維持原故事', () => {
  const source = harness(fixture('threads')); source.enter(); source.click('close'); complete(source); source.exit();
  const completed = source.save(), story = S.get('threads'), floor = Number(story.links.sceneId.slice(6));
  for (const withHistory of [false, true]) {
    const run = runAt(floor, completed.seed);
    run.chronicle.clues.push(N.chapterForFloor(floor).clueId);
    if (withHistory) run.expedition.history = completed.expedition.history;
    assert.ok(C.validateSave(run));
    const h = harness(run); h.start(); h.emit('keydown', { code: 'KeyJ' }); h.click('story-read', story.links.sceneId);
    assert.doesNotMatch(h.get('towerDialog').innerHTML, /tower-story-echo/);
    h.click('story-next'); assert.doesNotMatch(h.get('towerDialog').innerHTML, /tower-story-echo/);
    h.click('story-next');
    assert.equal(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(story.links.chapterText)), withHistory);
    assert.equal(h.get('towerDialog').innerHTML.includes('tower-story-echo'), withHistory);
    const before = h.save(); h.tick(20); h.emit('pagehide'); assert.deepEqual(h.save(), before);
  }
});

test('完成支線只補充玩家實際選中的結局尾聲，三個主線結局都不會被替換', () => {
  const source = harness(fixture('clockwork')); source.enter(); source.click('close'); complete(source); source.exit();
  const completed = source.save(), story = S.get('clockwork');
  for (const ending of N.ENDINGS) {
    const run = runAt(1, completed.seed); run.chronicle.clues.push('clue:heart'); run.chronicle.read.push('scene:1');
    run.expedition.history = completed.expedition.history; assert.ok(C.validateSave(run));
    const h = harness(run); h.start(); h.exit();
    assert.doesNotMatch(h.get('towerDialog').innerHTML, /tower-story-echo/, 'Ending choice does not prematurely show an unchosen outcome');
    h.click('ending', ending.id);
    assert.equal(h.save().status, 'won'); assert.equal(h.save().chronicle.ending, ending.id);
    assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(ending.paragraphs[0])));
    assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(story.links.endings[ending.id])));
    for (const other of N.ENDINGS.filter(item => item.id !== ending.id)) {
      assert.ok(!h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(story.links.endings[other.id])));
    }
    assert.deepEqual(h.save().expedition.history, completed.expedition.history);
  }
});
