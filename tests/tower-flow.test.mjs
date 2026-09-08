import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const THREE = createRequire(import.meta.url)('../lib/three.min.js');
const narrativeSource = readFileSync(new URL('../story/tower-narrative.js', import.meta.url), 'utf8');
const dungeonsSource = readFileSync(new URL('../story/tower-dungeons.js', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../story/story-core.js', import.meta.url), 'utf8');
const encountersSource = readFileSync(new URL('../story/tower-encounters.js', import.meta.url), 'utf8');
const charactersSource = readFileSync(new URL('../story/tower-characters.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
const SAVE_KEY = 'maze3d_tower_v1';

// Only the DOM and original game-engine boundary are stubbed. The real core,
// runtime, events, storage and dialog rendering execute unmodified by default.
// Other runtime suites can explicitly request a test-only closure bridge.
function harness(initialSave, runtimeBridge = '') {
  const elements = new Map(), windowEvents = new Map(), storage = new Map(), toasts = [];
  let now = 10000;
  if (initialSave !== undefined) storage.set(SAVE_KEY, typeof initialSave === 'string' ? initialSave : JSON.stringify(initialSave));
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.style = {}; this.listeners = new Map(); this.children = []; this.dataset = {}; this.hidden = false; this.disabled = false; this.isConnected = true; this.value = ''; this.textContent = ''; this._html = ''; this._id = ''; this.classes = new Set(); this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) }; }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    set innerHTML(value) {
      this._html = String(value); this.buttons = [];
      for (const match of this._html.matchAll(/<([a-z]+)\b([^>]*)>/gi)) {
        const attrs = match[2], id = /\bid="([^"]+)"/.exec(attrs)?.[1];
        const child = id ? elements.get(id) || new Element(match[1]) : new Element(match[1]);
        if (id) child.id = id;
        if (match[1].toLowerCase() === 'button') {
          child.dataset.tower = /\bdata-tower="([^"]+)"/.exec(attrs)?.[1];
          child.dataset.item = /\bdata-item="([^"]+)"/.exec(attrs)?.[1];
          child.disabled = /\sdisabled(?:\s|$)/.test(attrs); this.buttons.push(child);
        }
      }
    }
    get innerHTML() { return this._html; }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(key, value) { this[key] = value; }
    getContext() { return { strokeText() {}, fillText() {} }; }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    closest(selector) { return selector === 'button[data-tower]' && this.dataset.tower ? this : null; }
    querySelectorAll() { return (this.buttons || []).filter(button => !button.disabled); }
    focus() { document.activeElement = this; }
  }
  const document = { body: new Element('body'), hidden: false, activeElement: null, getElementById: id => elements.get(id) || null, createElement: tag => new Element(tag), addEventListener() {} };
  for (const id of ['gameScreen', 'storyEntryBtn', 'joyBase', 'joyStick', 'playerName', 'profileTitle', 'profileNextBtn', 'hudLvlName', 'hudRound', 'shiftCountdown', 'preWarn', 'preWarnSec']) { const element = new Element(); element.id = id; }
  const buildCharacter = () => {
    const model = new THREE.Group();
    for (const name of ['body', 'armL', 'armR', 'legL', 'legR']) { const part = new THREE.Group(); model.userData[name] = part; model.add(part); }
    return model;
  };
  const surface = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
  const G = { charIdx: 0, view: 'tp', spMode: 'classic', lvlIdx: 0, effects: {}, running: false, frozen: false, shifting: false, startTime: now, satiety: 100, shovels: 1, kites: 0, whistles: 0, shovelRechargeAt: 0, skillCoolUntil: 0, px: 0, pz: 0, cell: 4, mazeW: 7, mazeH: 7, items: [], foods: [], exitCell: { x: 6, y: 6 } };
  const CFG = { mazeSize: 11, itemCount: 20, foodCount: 10 }, noop = () => {};
  const context = vm.createContext({
    console, document, THREE, G, CFG, keys: {}, joy: { active: false, dx: 0, dy: 0 }, MP: { on: false },
    performance: { now: () => now }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    scene: new THREE.Scene(), envGroup: null, playerGroup: buildCharacter(), wallMesh: surface(), floorMesh: surface(), CHARS: Array.from({ length: 6 }, (_, i) => ({ id: i })),
    escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
    bindActionBtn: (element, fn) => { element.onclick = fn; }, typingInField: () => false,
    getPlayerName: () => '測試冒險者', beginEntryFlow: mode => { context.entryFlow = mode; }, mpLeave: noop,
    buildCharacter, makeTextSprite: label => { const group = new THREE.Group(); group.userData.label = label; return group; }, makePickupMarker: () => new THREE.Group(), disposeSceneObject: noop,
    cellToWorld: (x, y) => ({ x: x * G.cell, z: y * G.cell }), worldToCell: (x, z) => ({ x: Math.max(0, Math.round(x / G.cell)), y: Math.max(0, Math.round(z / G.cell)) }),
    solveMaze: (x, y, endX = G.exitCell.x, endY = G.exitCell.y) => [[x, y], [x, Math.min(y + 1, G.mazeH - 1)], [endX, endY]],
    mulberry32: seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; },
    CH: () => ({}), shovelCdMs: () => 12000, updateShovelBtn: noop, updateKiteBtn: noop, updateWhistleBtn: noop,
    AudioEng: { sfxTick: noop, sfxPickup: noop, stopMusic: noop, stopItemLoop: noop }, showToast: message => toasts.push(message),
    playerInWall: () => false, doShift: () => { G.shifting = true; }, swingWeapon: noop, cancelSceneTransition: noop, switchScreen: screen => { context.screen = screen; },
    startGame: () => {
      context.lastStartSettings = { ...CFG };
      (context.startSettingsHistory ||= []).push(context.lastStartSettings);
      context.scene.clear(); context.envGroup = null; context.playerGroup = buildCharacter(); context.scene.add(context.playerGroup);
      G.items = []; G.foods = []; G.mazeW = G.mazeH = CFG.mazeSize; G.exitCell = { x: G.mazeW - 1, y: G.mazeH - 1 };
      G.running = true; G.frozen = G.shifting = false; G.px = G.pz = 0; G.startTime = now; context.TowerMode.scheduleShift();
    },
    addEventListener: (type, fn) => windowEvents.set(type, fn),
  });
  context.window = context;
  vm.runInContext(narrativeSource, context, { filename: 'tower-narrative.js' });
  vm.runInContext(dungeonsSource, context, { filename: 'tower-dungeons.js' });
  vm.runInContext(coreSource, context, { filename: 'story-core.js' });
  vm.runInContext(encountersSource, context, { filename: 'tower-encounters.js' });
  vm.runInContext(charactersSource, context, { filename: 'tower-characters.js' });
  const testedRuntime = runtimeBridge ? runtimeSource.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/, runtimeBridge + '\n  install();') : runtimeSource;
  assert.ok(!runtimeBridge || testedRuntime !== runtimeSource, 'The test-only bridge must be injected inside the runtime closure');
  vm.runInContext(testedRuntime, context, { filename: 'tower-mode.js' });
  const get = id => elements.get(id);
  function click(action, item) {
    const button = get('towerDialog').buttons.find(candidate => candidate.dataset.tower === action && (item === undefined || candidate.dataset.item === item));
    assert.ok(button, `Expected visible action ${action}${item ? `(${item})` : ''}; dialog=${get('towerDialog').innerHTML}`);
    assert.equal(button.disabled, false, `Action ${action} must be enabled`);
    get('towerOverlay').listeners.get('click')({ target: button });
  }
  function save() { const stored = storage.get(SAVE_KEY); return stored ? JSON.parse(stored) : null; }
  function tick(seconds) { now += seconds * 1000; context.TowerMode.tick(seconds, now); }
  return { context, get, click, save, tick, storage, toasts, emit: (type, event = {}) => windowEvents.get(type)?.(event) };
}

test('story menu routes new players through the existing character creation flow', () => {
  const h = harness(); h.get('storyEntryBtn').onclick();
  assert.match(h.get('towerDialog').innerHTML, /建立主角/);
  h.click('new');
  assert.equal(h.context.entryFlow, 'story');
  assert.equal(h.get('profileTitle').textContent, '建立高塔主角');
  assert.equal(h.context.TowerMode.active, false);
});

test('beginNew creates a valid save and renders opening prose rather than an object', () => {
  const h = harness();
  assert.equal(h.context.TowerMode.preserveFloorPickups(), false);
  h.context.TowerMode.beginNew();
  assert.equal(h.context.TowerMode.active, true); assert.equal(h.context.TowerMode.paused, true);
  assert.equal(h.save().floor, 99); assert.ok(h.context.TowerCore.validateSave(h.save()));
  assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(h.context.TowerNarrative.scenesForFloor(99)[0].paragraphs[0])));
  assert.doesNotMatch(h.get('towerDialog').innerHTML, /\[object Object\]/);
  assert.equal(h.context.CFG.mazeSize, 11, 'Temporary story settings must restore normal-mode configuration');
  assert.equal(h.context.TowerMode.preserveFloorPickups(), true, 'The live runtime must protect pickups after the floor has started');
  assert.equal(h.context.lastStartSettings.itemCount, 1);
  assert.equal(h.context.lastStartSettings.foodCount, 1);
  assert.equal(h.context.TowerMode.itemConfig().total, 4, 'Floor 99 has two original and two story pickups, not the old 16+ drops');
});

for (const merchantId of ['tieLing', 'jinHe', 'lanZhou']) {
  test(`${merchantId} has exclusive stock, real buy/sell/equip controls, and paused trading time`, () => {
    const catalog = harness().context;
    let seed = 1;
    while (seed < 1000 && catalog.TowerEncounters.merchantOffers(99, seed)[0].id !== merchantId) seed++;
    assert.ok(seed < 1000, `A seed must select ${merchantId}`);
    const startingRun = catalog.TowerCore.newRun({ seed }); startingRun.coins = 250;
    const h = harness(startingRun);
    h.context.TowerMode.open(); h.click('continue'); h.click('close');
    const merchants = [];
    h.context.scene.traverse(object => { if (object.userData.role === 'merchant') merchants.push(object); });
    assert.equal(merchants.length, 1);
    const merchant = merchants[0];
    assert.equal(merchant.userData.merchantId, merchantId);
    assert.ok(merchant.position.x + merchant.position.z >= h.context.G.cell * 2, 'Merchants must not occupy the floor entrance');
    assert.equal(h.get('towerTalkBtn').disabled, true, 'Entry is not a fixed merchant interaction zone');
    h.context.G.px = merchant.position.x; h.context.G.pz = merchant.position.z;
    h.tick(0.2); h.get('towerTalkBtn').onclick();
    assert.equal(h.context.TowerMode.paused, true); assert.equal(h.context.G.frozen, true);
    const offer = h.context.TowerEncounters.merchantOffers(99, seed)[0];
    const buttons = h.get('towerDialog').buttons;
    assert.deepEqual(buttons.filter(b => b.dataset.tower === 'buy').map(b => b.dataset.item), Array.from(offer.supplies));
    assert.deepEqual(buttons.filter(b => b.dataset.tower === 'sell').map(b => b.dataset.item), Array.from(offer.supplies));
    assert.deepEqual(buttons.filter(b => b.dataset.tower === 'buy-gear').map(b => b.dataset.item), Array.from(offer.gear, item => item.kind));
    assert.doesNotMatch(h.get('towerDialog').innerHTML, /data-tower="exchange"/);
    const itemId = offer.supplies[0], item = h.context.TowerCore.ITEMS[itemId], initial = h.save();
    h.click('buy', itemId);
    assert.equal(h.save().coins, initial.coins - item.buyPrice); assert.equal(h.save().bag[itemId], initial.bag[itemId] + 1);
    h.click('sell', itemId);
    assert.equal(h.save().coins, initial.coins - item.buyPrice + item.sellPrice); assert.equal(h.save().bag[itemId], initial.bag[itemId]);
    const before = h.save(); h.tick(5); h.emit('pagehide');
    assert.equal(h.save().elapsed, before.elapsed, 'Time cannot advance while trading'); assert.ok(h.context.TowerCore.validateSave(h.save()));
    const stock = offer.gear[0]; h.click('buy-gear', stock.kind);
    assert.equal(h.save().coins, before.coins - stock.price);
    assert.equal(h.save().gearBag.length, 1); assert.equal(h.save().gearBag[0].id, stock.gear.id);
    assert.equal(h.get('towerDialog').buttons.find(b => b.dataset.tower === 'buy-gear' && b.dataset.item === stock.kind).disabled, true, 'Sold stock cannot be purchased twice');
    h.click('bag'); h.click('equip', stock.gear.id);
    assert.equal(h.save().equipment[stock.gear.slot].id, stock.gear.id);
    assert.equal(h.save().gearBag.length, 0);
    const worn = [];
    h.context.playerGroup.traverse(object => { if (object.userData.role === 'gear') worn.push(object.userData.kind); });
    assert.ok(worn.includes(stock.kind), 'Equipping a purchased item must attach its original 3D model to the player');
    assert.ok(h.context.TowerCore.validateSave(h.save()));
    h.click('close'); assert.equal(h.context.G.frozen, false); assert.equal(h.context.TowerMode.paused, false);
  });
}

test('continue restores tools, cooldowns and claimed drops at the saved floor entrance', () => {
  const original = harness().context.TowerCore.newRun({ seed: 444, charIdx: 4 });
  original.floor = 80; original.floorsCleared = 19; original.hunger = 43; original.claimed = ['s0']; original.floorElapsed = 31;
  original.engine = { shovels: 2, kites: 1, whistles: 3, shovelCooldownMs: 2500, skillCooldownMs: 1700 };
  const h = harness(original); h.context.TowerMode.open(); h.click('continue');
  assert.equal(h.context.G.mazeW, 9); assert.equal(h.context.G.satiety, 43); assert.equal(h.context.G.shovels, 2); assert.equal(h.context.G.kites, 1); assert.equal(h.context.G.whistles, 3);
  assert.equal(h.context.G.shovelRechargeAt, 12500); assert.equal(h.save().floor, 80); assert.deepEqual(h.save().claimed, ['s0']); assert.equal(h.save().floorElapsed, 31);
  assert.ok(h.context.TowerCore.validateSave(h.save()));
});

test('malformed and incompatible saves never offer a broken continue action', () => {
  for (const saved of ['{broken', { stateVersion: 900 }, { floor: 50 }]) {
    const h = harness(saved); h.context.TowerMode.open();
    assert.doesNotMatch(h.get('towerDialog').innerHTML, /data-tower="continue"/); assert.match(h.get('towerDialog').innerHTML, /建立主角/);
  }
});

test('repeated stair contact descends once, and floor 1 produces the chosen story ending', () => {
  const catalog = harness().context;
  const original = catalog.TowerCore.newRun({ seed: 765 }); original.floor = 2; original.floorsCleared = 97;
  original.chronicle = catalog.TowerNarrative.newChronicle(2); original.chronicle.clues.push('clue:heart');
  const h = harness(original); h.context.TowerMode.open(); h.click('continue'); h.click('close'); h.context.TowerMode.reachExit();
  assert.equal(h.save().floor, 1); assert.equal(h.save().floorsCleared, 98);
  assert.equal(h.context.TowerMode.preserveFloorPickups(), false, 'The next floor must be allowed to create its initial pickups');
  const before = h.save(); h.context.TowerMode.reachExit(); h.context.TowerMode.reachExit();
  assert.deepEqual(h.save(), before, 'Repeated collision callbacks must not advance more than one floor');
  h.click('descend'); if (h.context.TowerMode.paused) h.click('close'); h.context.TowerMode.reachExit();
  assert.equal(h.save().floor, 1); h.click('story-next'); h.click('story-next'); h.click('story-finish');
  const ending = h.context.TowerNarrative.ENDINGS[0]; h.click('ending', ending.id);
  assert.equal(h.save().status, 'won'); assert.equal(h.save().floorsCleared, 99); assert.ok(h.context.TowerCore.validateSave(h.save()));
  assert.ok(h.get('towerDialog').innerHTML.includes(h.context.escapeHtml(ending.paragraphs[0]))); assert.doesNotMatch(h.get('towerDialog').innerHTML, /\[object Object\]|data-tower="descend"/);
  h.click('home'); assert.equal(h.context.TowerMode.active, false); assert.equal(h.context.screen, 'titleScreen');
  assert.equal(h.context.TowerMode.preserveFloorPickups(), false);
});

test('resuming a defeated journey retries with the saved character and pays only the recovery cost', () => {
  const original = harness().context.TowerCore.newRun({ seed: 991, charIdx: 4, name: '工程師旅人' });
  original.floor = 80; original.floorsCleared = 19; original.hp = 0; original.hunger = 12; original.status = 'dead'; original.claimed = ['s0'];
  const h = harness(original); h.context.TowerMode.open(); h.click('continue');
  assert.match(h.get('towerDialog').innerHTML, /重整後再挑戰/); h.click('retry');
  assert.equal(h.save().status, 'playing'); assert.equal(h.save().coins, 12); assert.equal(h.save().hp, 100); assert.equal(h.save().hunger, 65); assert.deepEqual(h.save().claimed, ['s0']);
  assert.equal(h.context.G.charIdx, 4, 'Loading a defeated save must restore its original profession'); assert.equal(h.get('playerName').value, '工程師旅人'); assert.ok(h.context.TowerCore.validateSave(h.save()));
});
