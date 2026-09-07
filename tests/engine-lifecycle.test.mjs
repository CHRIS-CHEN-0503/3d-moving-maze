import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const slice = (start, end) => {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `找不到引擎區段：${start}`);
  return html.slice(from, to);
};

test('場景重建釋放私有貼圖、材質和幾何，只處理一次，保留共用資源', () => {
  const resource = (isTexture = false) => ({ isTexture, count: 0, dispose() { this.count++; } });
  const wallTexture = resource(true);
  const spriteTexture = resource(true);
  const floorTexture = resource(true);
  const emissiveTexture = resource(true);
  const textTexture = resource(true);
  const geometry = resource();
  const spriteGeometry = resource();
  const markerGeometry = resource();
  const markerMaterial = resource();
  const floorMaterial = Object.assign(resource(), { map: floorTexture, emissiveMap: emissiveTexture });
  const wallMaterial = Object.assign(resource(), { map: wallTexture });
  const spriteMaterial = Object.assign(resource(), { map: spriteTexture });
  const textMaterial = Object.assign(resource(), { map: textTexture });
  const objects = [
    { geometry, material: floorMaterial },
    { geometry, material: [floorMaterial, wallMaterial] },
    { isSprite: true, geometry: spriteGeometry, material: spriteMaterial },
    { isSprite: true, geometry: spriteGeometry, material: textMaterial },
    { geometry: markerGeometry, material: markerMaterial },
  ];
  const context = vm.createContext({
    _texCache: { wallTexture }, spriteCache: { spriteTexture },
    makePickupMarker: { ringGeom: markerGeometry, materials: { gold: { ring: markerMaterial } } },
    root: { traverse(fn) { objects.forEach(fn); } },
  });
  vm.runInContext(slice('function disposeSceneObject(root)', 'let sceneEpoch='), context);
  vm.runInContext('disposeSceneObject(root)', context);
  for (const owned of [floorTexture, emissiveTexture, textTexture, geometry, floorMaterial, wallMaterial, spriteMaterial, textMaterial]) {
    assert.equal(owned.count, 1, '私有資源必須且只能釋放一次');
  }
  for (const shared of [wallTexture, spriteTexture, markerGeometry, markerMaterial, spriteGeometry]) {
    assert.equal(shared.count, 0, '共用資源仍由後續樓層或預覽場景使用');
  }
});

function lifecycle() {
  let now = 0;
  let nextId = 0;
  const frames = new Map();
  const delays = new Map();
  const intervals = new Map();
  const nodes = new Map();
  const calls = { build: 0, spawn: 0, alarm: 0, tick: 0, maze: 0 };
  const context = vm.createContext({
    window: {},
    performance: { now: () => now },
    requestAnimationFrame: fn => { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { const id = ++nextId; delays.set(id, fn); return id; },
    clearTimeout: id => delays.delete(id),
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    $: id => { if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '' }); return nodes.get(id); },
    G: { running: true, frozen: false, shifting: false, wallH: 3, px: 1, pz: 1, lvlIdx: 0, nextShiftAt: 3000 },
    MP: { on: false, host: false }, CFG: { shiftMin: 1 }, LEVELS: [{}],
    AudioEng: { sfxAlarm: () => calls.alarm++, sfxTick: () => calls.tick++ },
    wallMesh: { position: { y: 0 } }, playerGroup: { position: { set() {} } },
    worldToCell: () => ({ x: 0, y: 0 }), cellToWorld: () => ({ x: 0, z: 0 }),
    genMaze: () => calls.maze++, relocateExit() {}, spawnItems: () => calls.spawn++,
    buildWalls: () => { calls.build++; context.wallMesh = { position: { y: 0 } }; },
    isShop: () => false, CH: () => ({}), showToast() {},
  });
  vm.runInContext(slice('let sceneEpoch=', 'let _vpW='), context);
  vm.runInContext(slice('function scheduleNextShift()', '/* 迷宮變形時出口搬家'), context);
  return {
    context, frames, delays, intervals, calls, nodes,
    run: source => vm.runInContext(source, context),
    at: time => { now = time; },
    frame() { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(); },
  };
}

test('變形降牆途中離開，已排入的舊畫面不重建迷宮或解除新場景凍結', () => {
  const h = lifecycle();
  h.run('doShift()');
  const pendingFrame = [...h.frames.values()][0];
  const alarm = [...h.delays.values()][0];
  h.run('cancelSceneTransition()');
  h.context.G.frozen = true;
  h.at(1000);
  pendingFrame(); alarm();
  assert.equal(h.calls.build, 0);
  assert.equal(h.calls.alarm, 1);
  assert.equal(h.context.G.frozen, true);
  assert.equal(h.context.wallMesh.position.y, 0);
  assert.equal(h.frames.size + h.delays.size + h.intervals.size, 0);
});

test('變形等待升牆時換層，舊延遲不能碰觸新樓層或排入動畫', () => {
  const h = lifecycle();
  h.run('doShift()');
  h.at(900); h.frame();
  assert.equal(h.calls.build, 1);
  const hold = [...h.delays.values()].at(-1);
  h.run('cancelSceneTransition()');
  h.context.wallMesh = { position: { y: 77 } };
  h.context.G.frozen = true;
  h.at(1500); hold();
  assert.equal(h.context.wallMesh.position.y, 77);
  assert.equal(h.context.G.frozen, true);
  assert.equal(h.frames.size, 0);
});

test('單次變形完成只建立一次迷宮，解除凍結並重新安排下一次', () => {
  const h = lifecycle();
  h.run('doShift();doShift()');
  h.at(900); h.frame();
  const holdEntry = [...h.delays.entries()].at(-1);
  h.delays.delete(holdEntry[0]);
  h.at(1400); holdEntry[1]();
  h.at(2300); h.frame();
  assert.deepEqual(h.calls, { build: 1, spawn: 1, alarm: 1, tick: 0, maze: 1 });
  assert.equal(h.context.G.frozen, false);
  assert.equal(h.context.G.shifting, false);
  assert.equal(h.context.G.nextShiftAt, 62300);
  assert.equal(h.context.wallMesh.position.y, 0);
});

test('暫停不觸發變形；預警計時在離開時清除且舊回呼不發聲', () => {
  const h = lifecycle();
  h.context.G.frozen = true;
  h.at(4000); h.run('updateShiftTimer();doShift()');
  assert.equal(h.calls.alarm, 0);
  assert.equal(h.intervals.size, 0);
  h.context.G.frozen = false;
  h.at(0); h.run('updateShiftTimer()');
  const warn = [...h.intervals.values()][0];
  assert.equal(h.calls.tick, 1);
  h.context.G.frozen = true;
  warn();
  assert.equal(h.calls.tick, 1);
  h.run('cancelSceneTransition()');
  warn();
  assert.equal(h.intervals.size, 0);
  assert.equal(h.calls.tick, 1);
  assert.equal(h.nodes.get('preWarn').style.display, 'none');
});

test('舊預警即使已進事件佇列，也不能取消新樓層的預警計時', () => {
  const h = lifecycle();
  h.run('updateShiftTimer()');
  const oldWarn = [...h.intervals.values()][0];
  h.run('cancelSceneTransition();updateShiftTimer()');
  const newWarn = [...h.intervals.values()][0];
  oldWarn();
  assert.equal(h.intervals.size, 1);
  newWarn();
  assert.equal(h.nodes.get('preWarnSec').textContent, 2);
});

test('多人主機先過關仍會廣播變形，變形後保持已完成者凍結', () => {
  const h = lifecycle();
  h.context.MP = { on: true, host: true, ended: false, round: 0, seed: 1, shiftMs: 60000 };
  h.context.G.frozen = true;
  const sent = [];
  h.context.mpSend = message => sent.push(message);
  h.at(3000); h.run('updateShiftTimer()');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].t, 'shift');
  h.run('doShift()');
  h.at(3900); h.frame();
  const hold = [...h.delays.values()].at(-1);
  h.at(4400); hold();
  h.at(5300); h.frame();
  assert.equal(h.context.G.shifting, false);
  assert.equal(h.context.G.frozen, true);
  assert.equal(h.calls.build, 1);
});

test('粒子逐顆消失時釋放材質，共用幾何等最後一顆消失才釋放', () => {
  const geometry = { count: 0, dispose() { this.count++; } };
  const batch = { geometry, remaining: 2 };
  const material = () => ({ count: 0, dispose() { this.count++; } });
  const a = material(), b = material();
  const mesh = mat => ({ material: mat, userData: { v: { y: 1 } }, position: { y: 1, addScaledVector() {} }, rotation: { x: 0, z: 0 } });
  const context = vm.createContext({ particles: [{ life: .1, batch, m: mesh(a) }, { life: 1, batch, m: mesh(b) }], scene: { remove() {} } });
  vm.runInContext(slice('function updateParticles(dt)', '/* =====================================================\n   玩家移動'), context);
  vm.runInContext('updateParticles(.2)', context);
  assert.equal(a.count, 1); assert.equal(b.count, 0); assert.equal(geometry.count, 0);
  vm.runInContext('updateParticles(1)', context);
  assert.equal(b.count, 1); assert.equal(geometry.count, 1);
  assert.equal(context.particles.length, 0);
});

test('武器揮擊結束釋放資源，換層後的舊動畫不碰新場景', () => {
  const frames = [];
  let released = 0;
  const sprite = { parent: null, material: {}, position: { y: 1, set() {} } };
  const scene = { add(object) { object.parent = this; }, remove(object) { object.parent = null; } };
  const context = vm.createContext({
    sceneEpoch: 1, scene, G: { running: true, px: 0, pz: 0, heading: 0 }, AudioEng: { sfxHit() {} },
    CH: () => ({ weapon: 'sword' }), makeEmojiSprite: () => sprite,
    disposeSceneObject: () => released++, requestAnimationFrame: fn => frames.push(fn),
  });
  vm.runInContext(slice('function swingWeapon()', 'function applyStun('), context);
  vm.runInContext('swingWeapon()', context);
  while (frames.length) frames.shift()();
  assert.equal(released, 1);
  assert.equal(sprite.parent, null);
  vm.runInContext('swingWeapon()', context);
  const opacity = sprite.material.opacity;
  context.sceneEpoch++;
  context.scene = { remove() { throw new Error('不應移除新場景物件'); } };
  frames.shift()();
  assert.equal(sprite.material.opacity, opacity);
  assert.equal(released, 2);
  assert.equal(sprite.parent, null);
});

test('劇情重建隱藏已拿的原版道具，拾取效果先套用再保存；一般模式不受影響', () => {
  const claimed = new Set(['item-0', 'food-0']);
  const applied = [];
  const saved = [];
  let random = 7;
  const object = () => ({ visible: true, position: { set() {} } });
  const tower = {
    active: true,
    canCollectOriginal: id => !claimed.has(id),
    collectedOriginal: id => { assert.ok(applied.length > saved.length, '先套用道具再保存庫存'); claimed.add(id); saved.push(id); },
  };
  const limb = () => ({ rotation: { x: 0 } });
  const context = vm.createContext({
    window: { TowerMode: tower }, TowerMode: tower,
    G: { mazeW: 7, mazeH: 7, px: 0, pz: 0, lvlIdx: 0, exitCell: { x: 6, y: 6 }, frozen: false, stunnedUntil: 0, view: 'tp', heading: 0 },
    MP: { on: false }, CFG: { itemCount: 2, foodCount: 2 }, LEVELS: [{ id: 'test' }], ENV_ITEMS: {},
    THREE: { Group: class { add() {} } }, itemGroup: null, scene: { add() {}, remove() {} }, disposeSceneObject() {},
    RNG: () => ((random = (random * 16807) % 2147483647) - 1) / 2147483646,
    worldToCell: () => ({ x: 0, y: 0 }), cellToWorld: (x, y) => ({ x: x * 4, z: y * 4 }),
    makeEmojiSprite: object, makePickupMarker: object, pickItemType: () => ({ id: 'speed' }), pickFoodType: () => ({ id: 'ration' }),
    isShop: () => false, isCheckingOut: () => false, performance: { now: () => 100 }, keys: {}, joy: { active: false, dx: 0, dy: 0 },
    playerGroup: { userData: { armL: limb(), armR: limb(), legL: limb(), legR: limb() }, position: { set() {} }, rotation: {} },
    applyItem: () => applied.push('item'), applyFood: () => applied.push('food'), winGame() { throw new Error('不在出口'); },
  });
  vm.runInContext(slice('function spawnItems()', 'function pickFoodType()'), context);
  vm.runInContext(slice('function updatePlayer(dt,t)', '/* =====================================================\n   尋寶模式：攻擊'), context);
  vm.runInContext('spawnItems()', context);
  for (const list of [context.G.items, context.G.foods]) {
    assert.equal(list[0].taken, true); assert.equal(list[0].sprite.visible, false); assert.equal(list[0].marker.visible, false);
    assert.equal(list[1].taken, false); list[1].x = 0; list[1].z = 0;
  }
  vm.runInContext('updatePlayer(.016,1);updatePlayer(.016,2)', context);
  assert.deepEqual(saved, ['item-1', 'food-1']);
  assert.deepEqual(applied, ['item', 'food']);
  vm.runInContext('spawnItems()', context);
  assert.ok([...context.G.items, ...context.G.foods].every(pickup => pickup.taken));
  tower.active = false;
  vm.runInContext('spawnItems()', context);
  assert.ok([...context.G.items, ...context.G.foods].every(pickup => !pickup.taken));
});

test('鏡頭更新保留高塔霧距，一般山洞仍套用原本探照燈效果', () => {
  const tower = { active: true };
  const context = vm.createContext({
    window: { TowerMode: tower }, TowerMode: tower,
    G: { view: 'fp', px: 0, pz: 0, camYaw: 0, camPitch: 0, lvlIdx: 0, visionUntil: 2000 },
    camera: { position: { set() {} }, lookAt() {} }, envGroup: null,
    scene: { fog: { near: 28, far: 75 } }, LEVELS: [{ fog: [0, 2, 18] }],
    performance: { now: () => 1000 }, isShop: () => false, updateTopMask() {},
  });
  vm.runInContext(slice('function updateCamera(dt)', '</script>'), context);
  vm.runInContext('updateCamera(.016)', context);
  assert.deepEqual(context.scene.fog, { near: 28, far: 75 });
  tower.active = false;
  vm.runInContext('updateCamera(.016)', context);
  assert.deepEqual(context.scene.fog, { near: 18, far: 130 });
});
