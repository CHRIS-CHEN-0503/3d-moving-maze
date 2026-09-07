import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const coreSource = readFileSync(new URL('../story/story-core.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
const SAVE_KEY = 'maze3d_tower_v1';

// Only the DOM and original game-engine boundary are stubbed. The real core,
// runtime, events, storage and dialog rendering execute without source rewriting.
function harness(initialSave) {
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
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    closest(selector) { return selector === 'button[data-tower]' && this.dataset.tower ? this : null; }
    querySelectorAll() { return (this.buttons || []).filter(button => !button.disabled); }
    focus() { document.activeElement = this; }
  }
  const document = { body: new Element('body'), hidden: false, activeElement: null, getElementById: id => elements.get(id) || null, createElement: tag => new Element(tag), addEventListener() {} };
  for (const id of ['gameScreen', 'storyEntryBtn', 'joyBase', 'joyStick', 'playerName', 'profileTitle', 'profileNextBtn', 'hudLvlName', 'hudRound', 'shiftCountdown', 'preWarn', 'preWarnSec']) { const element = new Element(); element.id = id; }
  class Vector { constructor() { this.set(0, 0, 0); } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { return this.set(v.x, v.y, v.z); } }
  class Object3D { constructor() { this.position = new Vector(); this.rotation = new Vector(); this.scale = new Vector().set(1, 1, 1); this.userData = {}; this.children = []; this.visible = true; } add(...objects) { this.children.push(...objects); } remove(object) { this.children = this.children.filter(child => child !== object); } }
  class Color { constructor(value) { this.value = value; } setHex(value) { this.value = value; } }
  class Material { constructor(options = {}) { Object.assign(this, options); this.color = new Color(options.color); } }
  class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
  class Geometry {}
  const THREE = { Group: Object3D, Mesh, Color, Fog: Geometry, HemisphereLight: Object3D, AmbientLight: Object3D, DirectionalLight: Object3D, MeshLambertMaterial: Material, MeshBasicMaterial: Material };
  for (const name of ['CylinderGeometry', 'BoxGeometry', 'OctahedronGeometry', 'ConeGeometry', 'SphereGeometry', 'TorusGeometry']) THREE[name] = Geometry;
  const G = { charIdx: 0, view: 'tp', spMode: 'classic', lvlIdx: 0, effects: {}, running: false, frozen: false, shifting: false, startTime: now, satiety: 100, shovels: 1, kites: 0, whistles: 0, shovelRechargeAt: 0, skillCoolUntil: 0, px: 0, pz: 0, cell: 3, mazeW: 7, mazeH: 7, exitCell: { x: 6, y: 6 } };
  const CFG = { mazeSize: 11, itemCount: 20, foodCount: 10 }, noop = () => {};
  const context = vm.createContext({
    console, document, THREE, G, CFG, keys: {}, joy: { active: false, dx: 0, dy: 0 }, MP: { on: false },
    performance: { now: () => now }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    scene: new Object3D(), envGroup: null, wallMesh: new Mesh(new Geometry(), new Material()), floorMesh: new Mesh(new Geometry(), new Material()), CHARS: Array.from({ length: 6 }, (_, i) => ({ id: i })),
    escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
    bindActionBtn: (element, fn) => { element.onclick = fn; }, typingInField: () => false,
    getPlayerName: () => '測試冒險者', beginEntryFlow: mode => { context.entryFlow = mode; }, mpLeave: noop,
    buildCharacter: () => new Object3D(), makeTextSprite: () => new Object3D(), makePickupMarker: () => new Object3D(), disposeSceneObject: noop,
    cellToWorld: (x, y) => ({ x: x * 3, z: y * 3 }), worldToCell: (x, z) => ({ x: Math.max(0, Math.round(x / 3)), y: Math.max(0, Math.round(z / 3)) }),
    solveMaze: (x, y, endX = G.exitCell.x, endY = G.exitCell.y) => [[x, y], [x, Math.min(y + 1, G.mazeH - 1)], [endX, endY]],
    mulberry32: seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; },
    CH: () => ({}), shovelCdMs: () => 12000, updateShovelBtn: noop, updateKiteBtn: noop, updateWhistleBtn: noop,
    AudioEng: { sfxTick: noop, sfxPickup: noop, stopMusic: noop, stopItemLoop: noop }, showToast: message => toasts.push(message),
    playerInWall: () => false, doShift: () => { G.shifting = true; }, swingWeapon: noop, cancelSceneTransition: noop, switchScreen: screen => { context.screen = screen; },
    startGame: () => { G.mazeW = G.mazeH = CFG.mazeSize; G.exitCell = { x: G.mazeW - 1, y: G.mazeH - 1 }; G.running = true; G.frozen = G.shifting = false; G.px = G.pz = 0; G.startTime = now; context.TowerMode.scheduleShift(); },
    addEventListener: (type, fn) => windowEvents.set(type, fn),
  });
  context.window = context;
  vm.runInContext(coreSource, context, { filename: 'story-core.js' });
  vm.runInContext(runtimeSource, context, { filename: 'tower-mode.js' });
  const get = id => elements.get(id);
  function click(action, item) {
    const button = get('towerDialog').buttons.find(candidate => candidate.dataset.tower === action && (item === undefined || candidate.dataset.item === item));
    assert.ok(button, `Expected visible action ${action}${item ? `(${item})` : ''}; dialog=${get('towerDialog').innerHTML}`);
    assert.equal(button.disabled, false, `Action ${action} must be enabled`);
    get('towerOverlay').listeners.get('click')({ target: button });
  }
  function save() { const stored = storage.get(SAVE_KEY); return stored ? JSON.parse(stored) : null; }
  function tick(seconds) { now += seconds * 1000; context.TowerMode.tick(seconds, now); }
  return { context, get, click, save, tick, storage, toasts, emit: type => windowEvents.get(type)?.() };
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
  const h = harness(); h.context.TowerMode.beginNew();
  assert.equal(h.context.TowerMode.active, true); assert.equal(h.context.TowerMode.paused, true);
  assert.equal(h.save().floor, 99); assert.ok(h.context.TowerCore.validateSave(h.save()));
  assert.match(h.get('towerDialog').innerHTML, /你在陌生的石台醒來/);
  assert.doesNotMatch(h.get('towerDialog').innerHTML, /\[object Object\]/);
  assert.equal(h.context.CFG.mazeSize, 11, 'Temporary story settings must restore normal-mode configuration');
});

test('trading uses real catalog rules, pauses game time, and keeps the saved run valid', () => {
  const h = harness(); h.context.TowerMode.beginNew(); h.click('close');
  h.context.G.px = 0; h.context.G.pz = 3; h.tick(0.2); h.get('towerTalkBtn').onclick();
  assert.equal(h.context.TowerMode.paused, true); assert.equal(h.context.G.frozen, true);
  h.click('buy', 'heal'); assert.equal(h.save().coins, 10); assert.equal(h.save().bag.heal, 3);
  h.click('sell', 'ration'); assert.equal(h.save().coins, 13);
  h.click('exchange', 'map_for_bell'); assert.equal(h.save().bag.map, 0); assert.equal(h.save().bag.ration, 0); assert.equal(h.save().bag.bell, 1);
  const before = h.save(); h.click('exchange', 'map_for_bell');
  assert.deepEqual(h.save(), before, 'Failed exchange cannot consume any inventory');
  h.tick(5); h.emit('pagehide');
  assert.equal(h.save().elapsed, before.elapsed, 'Time cannot advance while trading'); assert.ok(h.context.TowerCore.validateSave(h.save()));
  h.click('close'); assert.equal(h.context.G.frozen, false); assert.equal(h.context.TowerMode.paused, false);
});

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

test('repeated stair contact descends once, and floor 1 produces the core ending', () => {
  const original = harness().context.TowerCore.newRun({ seed: 765 }); original.floor = 2; original.floorsCleared = 97;
  const h = harness(original); h.context.TowerMode.open(); h.click('continue'); h.click('close'); h.context.TowerMode.reachExit();
  assert.equal(h.save().floor, 1); assert.equal(h.save().floorsCleared, 98);
  const before = h.save(); h.context.TowerMode.reachExit(); h.context.TowerMode.reachExit();
  assert.deepEqual(h.save(), before, 'Repeated collision callbacks must not advance more than one floor');
  h.click('descend'); if (h.context.TowerMode.paused) h.click('close'); h.context.TowerMode.reachExit();
  assert.equal(h.save().status, 'won'); assert.equal(h.save().floorsCleared, 99); assert.ok(h.context.TowerCore.validateSave(h.save()));
  assert.match(h.get('towerDialog').innerHTML, /你把旅人留下的記憶放入塔心/); assert.doesNotMatch(h.get('towerDialog').innerHTML, /\[object Object\]|data-tower="descend"/);
  h.click('home'); assert.equal(h.context.TowerMode.active, false); assert.equal(h.context.screen, 'titleScreen');
});

test('resuming a defeated journey retries with the saved character and pays only the recovery cost', () => {
  const original = harness().context.TowerCore.newRun({ seed: 991, charIdx: 4, name: '工程師旅人' });
  original.floor = 80; original.floorsCleared = 19; original.hp = 0; original.hunger = 12; original.status = 'dead'; original.claimed = ['s0'];
  const h = harness(original); h.context.TowerMode.open(); h.click('continue');
  assert.match(h.get('towerDialog').innerHTML, /重整後再挑戰/); h.click('retry');
  assert.equal(h.save().status, 'playing'); assert.equal(h.save().coins, 12); assert.equal(h.save().hp, 100); assert.equal(h.save().hunger, 65); assert.deepEqual(h.save().claimed, ['s0']);
  assert.equal(h.context.G.charIdx, 4, 'Loading a defeated save must restore its original profession'); assert.equal(h.get('playerName').value, '工程師旅人'); assert.ok(h.context.TowerCore.validateSave(h.save()));
});
