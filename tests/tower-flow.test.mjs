import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), THREE = require('../lib/three.min.js');
const narrativeSource = readFileSync(new URL('../story/tower-narrative.js', import.meta.url), 'utf8');
const sideStoriesSource = readFileSync(new URL('../story/tower-side-stories.js', import.meta.url), 'utf8');
const dungeonsSource = readFileSync(new URL('../story/tower-dungeons.js', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../story/story-core.js', import.meta.url), 'utf8');
const encountersSource = readFileSync(new URL('../story/tower-encounters.js', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../story/tower-materials.js', import.meta.url), 'utf8');
const lightingRuntimeSource = readFileSync(new URL('../story/tower-lighting-runtime.js', import.meta.url), 'utf8');
const charactersSource = readFileSync(new URL('../story/tower-characters.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
const SAVE_KEY = 'maze3d_tower_v1';

// Only the DOM and original game-engine boundary are stubbed. The real core,
// runtime, events, storage and dialog rendering execute unmodified by default.
// Other runtime suites can explicitly request a test-only closure bridge.
function harness(initialSave, runtimeBridge = '',preferences = {}) {
  const elements = new Map(), windowEvents = new Map(), documentEvents = new Map(), storage = new Map(), toasts = [];
  let now = 10000;
  if (initialSave !== undefined) storage.set(SAVE_KEY, typeof initialSave === 'string' ? initialSave : JSON.stringify(initialSave));
  for(const [key,value] of Object.entries(preferences))storage.set(key,value);
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
    insertBefore(child,before) { const at=this.children.indexOf(before);if(at<0)this.children.push(child);else this.children.splice(at,0,child);return child; }
    setAttribute(key, value) { this[key] = value; }
    removeAttribute(key) { delete this[key]; }
    getContext() { return { strokeText() {}, fillText() {} }; }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    closest(selector) { return selector === 'button[data-tower]' && this.dataset.tower ? this : null; }
    querySelectorAll() { return (this.buttons || []).filter(button => !button.disabled); }
    querySelector(selector) { return selector === '.tower-dialog-content' ? (this.content ||= {scrollTop:0}) : null; }
    focus() { document.activeElement = this; }
  }
  const document = { body: new Element('body'), hidden: false, activeElement: null, getElementById: id => elements.get(id) || null, querySelector: selector=>selector==='#towerHud .tower-hud-summary'?elements.get('towerHud'):null, createElement: tag => new Element(tag), addEventListener(type, fn) { if (!documentEvents.has(type)) documentEvents.set(type, []); documentEvents.get(type).push(fn); } };
  for (const id of ['gameScreen', 'hudRightBtns', 'storyEntryBtn', 'joyBase', 'joyStick', 'playerName', 'profileTitle', 'profileNextBtn', 'hudLvlName', 'hudRound', 'hudRoundControl', 'shiftCountdown', 'preWarn', 'preWarnSec']) { const element = new Element(); element.id = id; }
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
  // Ingredient purchases need a real profession inventory, but old-flow tests
  // deliberately retain their legacy character-creation path and equipment.
  const storedRun=typeof initialSave==='string'?null:initialSave;
  if(storedRun?.party){
    context.TowerPartyCore=require('../story/tower-party-core.js');context.TowerExpedition=require('../story/tower-expedition-core.js');
    context.TowerLighting=require('../story/tower-lighting-core.js');context.TowerFloorLords=require('../story/tower-floor-lords.js');context.TowerLoot=require('../story/tower-loot.js');context.TowerForaging=require('../story/tower-foraging.js');context.TowerReinforcements=require('../story/tower-reinforcements.js');
    context.TowerCreatureArt=require('../story/tower-creature-art.js');
    context.camera=new THREE.PerspectiveCamera();
    vm.runInContext(lightingRuntimeSource,context,{filename:'tower-lighting-runtime.js'});
  }
  vm.runInContext(coreSource, context, { filename: 'story-core.js' });
  vm.runInContext(materialsSource, context, { filename: 'tower-materials.js' });
  vm.runInContext(narrativeSource, context, { filename: 'tower-narrative.js' });
  vm.runInContext(sideStoriesSource, context, { filename: 'tower-side-stories.js' });
  vm.runInContext(dungeonsSource, context, { filename: 'tower-dungeons.js' });
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
  return { context, get, click, save, tick, storage, toasts, emit: (type, event = {}) => windowEvents.get(type)?.(event), emitDocument: (type, event = {}) => (documentEvents.get(type) || []).forEach(fn => fn(event)), document };
}

test('story menu no longer opens the regular character creation flow', () => {
  const h = harness(); h.get('storyEntryBtn').onclick();
  assert.match(h.get('towerDialog').innerHTML, /建立主角/);
  h.click('new');
  assert.equal(h.context.entryFlow, undefined);
  assert.notEqual(h.get('profileTitle').textContent, '高塔主角 · 先選外觀');
  assert.equal(h.context.TowerMode.active, true); // This legacy harness deliberately has no party module.
});

test('survival HUD is compact by default, remembers expansion, and never changes the journey',()=>{
  const key='maze3d_tower_hud_expanded',h=harness(undefined,'window.__hudTest={setHp(value){run.hp=value;updateHud();}};');
  assert.equal(h.get('towerHudDetails').hidden,true);assert.equal(h.get('towerHudToggle')['aria-expanded'],'false');
  h.context.TowerMode.beginNew();h.click('close');const saved=JSON.stringify(h.save());
  h.get('towerHudToggle').onclick();assert.equal(h.get('towerHudDetails').hidden,false);assert.equal(h.get('towerHudToggle')['aria-expanded'],'true');assert.equal(h.storage.get(key),'1');
  assert.equal(h.context.TowerMode.paused,false);assert.equal(JSON.stringify(h.save()),saved);
  const reloaded=harness(h.save(),'',{[key]:h.storage.get(key)});assert.equal(reloaded.get('towerHudDetails').hidden,false);
  h.get('towerHudToggle').onclick();h.context.__hudTest.setHp(12);
  assert.equal(h.get('towerHudDetails').hidden,true);assert.equal(h.get('towerHealth').textContent,'12 / 60');assert.equal(h.get('towerHp').value,12);assert.ok(h.context.document.body.classes.has('tower-danger'));
  h.context.localStorage.setItem=()=>{throw Error('Storage blocked');};assert.doesNotThrow(()=>h.get('towerHudToggle').onclick());assert.equal(h.get('towerHudDetails').hidden,false);
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
  assert.equal(h.context.lastStartSettings.itemCount, 0);
  assert.equal(h.context.lastStartSettings.foodCount, 0);
  assert.equal(h.context.TowerMode.itemConfig().total, 0, 'Story floors contain no naturally scattered pickups');
});

for (const merchantId of ['tieLing', 'jinHe', 'lanZhou']) {
  test(`${merchantId} keeps exclusive equipment, real purchase/equip controls, no supplies, and paused trading time`, () => {
    const catalog = harness().context;
    let seed = 1;
    while (seed < 1000 && catalog.TowerEncounters.merchantOffers(99, seed)[0].id !== merchantId) seed++;
    assert.ok(seed < 1000, `A seed must select ${merchantId}`);
    const startingRun = catalog.TowerCore.newRun({ seed }); startingRun.coins = 250;
    const h = harness(startingRun);
    h.context.TowerMode.open(); h.click('continue'); h.click('close');
    const merchants = [];
    h.context.scene.traverse(object => { if (object.userData.role === 'merchant') merchants.push(object); });
    const offers=catalog.TowerEncounters.merchantOffers(99,seed);
    assert.equal(merchants.length, offers.length);
    assert.deepEqual(merchants.map(m=>m.userData.merchantId).sort(),Array.from(offers,o=>o.id).sort());
    assert.equal(merchants.filter(m=>m.userData.merchantId!=='suHe').length,1);
    const merchant = merchants.find(m=>m.userData.merchantId===merchantId);
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
    assert.deepEqual(Array.from(offer.supplies),[]);
    assert.equal(buttons.some(b=>['buy-ingredient','light-buy'].includes(b.dataset.tower)),false);
    // Stock is grouped by body slot (weapon, head, body, shield), keeping catalogue order inside each group.
    const slotRank = slot => { const at = ['weapon', 'helmet', 'armor', 'shield'].indexOf(slot); return at < 0 ? 4 : at; };
    const grouped = Array.from(offer.gear, (item, index) => ({ item, index })).sort((a, b) => slotRank(a.item.gear.slot) - slotRank(b.item.gear.slot) || a.index - b.index).map(({ item }) => item.kind);
    assert.deepEqual(buttons.filter(b => b.dataset.tower === 'buy-gear').map(b => b.dataset.item), grouped);
    assert.equal(new Set(grouped).size, offer.gear.length, 'every offer appears exactly once');
    assert.doesNotMatch(h.get('towerDialog').innerHTML, /data-tower="exchange"/);
    h.emit('pagehide');const before = h.save(); h.tick(5); h.emit('pagehide');
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

function visitMerchant(h,id){
  const models=[];h.context.scene.traverse(model=>{if(model.userData.role==='merchant')models.push(model);});
  const merchant=models.find(model=>model.userData.merchantId===id);assert.ok(merchant,`Actual merchant model ${id} must exist`);
  h.context.G.px=merchant.position.x;h.context.G.pz=merchant.position.z;h.tick(.2);
  assert.equal(h.get('towerTalkBtn').disabled,false);h.get('towerTalkBtn').onclick();return merchant;
}

test('grocer exposes every supply, buys and sells medicine, charges ten arrows per coin, and never offers equipment services',()=>{
  const catalog=harness().context,run=catalog.TowerCore.newRun({seed:1});run.coins=250;
  const h=harness(run);h.context.TowerMode.open();h.click('continue');h.click('close');visitMerchant(h,'suHe');
  const shop=h.context.TowerEncounters.merchantOffers(99,1).find(m=>m.id==='suHe'),buttons=h.get('towerDialog').buttons;
  assert.deepEqual(buttons.filter(b=>b.dataset.tower==='buy').map(b=>b.dataset.item),Array.from(shop.supplies));
  assert.deepEqual(buttons.filter(b=>b.dataset.tower==='sell').map(b=>b.dataset.item),Array.from(shop.supplies).filter(id=>h.context.TowerCore.ITEMS[id].sellPrice>0));
  assert.equal(buttons.some(b=>['buy-gear','party-merchant-forge'].includes(b.dataset.tower)),false);
  assert.match(h.get('towerDialog').innerHTML,/蘇禾|旅行雜貨與遠方食材/);
  const initial=h.save(),content=h.get('towerDialog').querySelector('.tower-dialog-content');content.scrollTop=155;
  h.click('buy','heal');assert.equal(h.save().coins,initial.coins-14);assert.equal(h.save().bag.heal,initial.bag.heal+1);assert.equal(content.scrollTop,155);
  h.click('sell','heal');assert.equal(h.save().coins,initial.coins-14+6);assert.equal(h.save().bag.heal,initial.bag.heal);
  const arrowBefore=h.save();h.click('buy','arrow');assert.equal(h.save().bag.arrow,arrowBefore.bag.arrow+10);assert.equal(h.save().coins,arrowBefore.coins-1);
  const hasteBefore=h.save();h.click('buy','haste');assert.equal(h.save().bag.haste,hasteBefore.bag.haste+1);assert.equal(h.save().coins,hasteBefore.coins-h.context.TowerCore.ITEMS.haste.buyPrice);
  const before=h.save();h.tick(5);h.emit('pagehide');assert.equal(h.save().elapsed,before.elapsed);assert.ok(h.context.TowerCore.validateSave(h.save()));
});

test('grocer ingredient UI buys exact limited stock, disables sold out shelves and preserves purchases after reload',()=>{
  const Core=require('../story/story-core.js'),Party=require('../story/tower-party-core.js'),Narrative=require('../story/tower-narrative.js');
  const run=Party.enable(Core.newRun({seed:37}),'mage').run;run.floor=92;run.floorsCleared=7;run.chronicle=Narrative.newChronicle(92);Party.advance(run);run.coins=250;
  let h=harness(run);h.context.TowerMode.open();h.click('continue');h.click('close');visitMerchant(h,'suHe');
  const offers=Array.from(h.context.TowerEncounters.groceryOffers(h.save())),special=offers.find(o=>o.specialty);
  assert.equal(special.sourceFloor,30);assert.equal(special.stock,2);assert.equal(special.ingredientId,'frostberry');
  assert.deepEqual(h.get('towerDialog').buttons.filter(b=>b.dataset.tower==='buy-ingredient').map(b=>b.dataset.item),offers.map(o=>o.id));
  assert.match(h.get('towerDialog').innerHTML,/30|霜封迴廊/);
  const initial=h.save();h.click('buy-ingredient',special.id);assert.equal(h.save().coins,initial.coins-5);assert.equal(h.save().party.ingredients.frostberry,initial.party.ingredients.frostberry+1);assert.equal(h.save().adventure.groceryPurchases[special.id],1);
  h.click('buy-ingredient',special.id);const purchased=h.save();assert.equal(purchased.adventure.groceryPurchases[special.id],2);assert.equal(purchased.coins,initial.coins-10);
  const soldOut=()=>h.get('towerDialog').buttons.find(b=>b.dataset.tower==='buy-ingredient'&&b.dataset.item===special.id);
  assert.equal(soldOut().disabled,true);assert.match(h.get('towerDialog').innerHTML,/本層已售完/);
  h.get('towerOverlay').listeners.get('click')({target:soldOut()});assert.deepEqual(h.save(),purchased,'Disabled stale requests never deduct currency or duplicate ingredients');
  h=harness(purchased);h.context.TowerMode.open();h.click('continue');h.click('close');visitMerchant(h,'suHe');assert.equal(soldOut().disabled,true);assert.equal(h.context.TowerEncounters.groceryOffers(h.save()).find(o=>o.id===special.id).remaining,0);
  const common=offers.find(o=>!o.specialty),before=h.save();h.click('buy-ingredient',common.id);assert.equal(h.save().coins,before.coins-common.price);assert.equal(h.save().party.ingredients[common.ingredientId],before.party.ingredients[common.ingredientId]+1);assert.ok(h.context.TowerCore.validateSave(h.save()));
  const stale=h.get('towerDialog').buttons.find(b=>b.dataset.tower==='buy-ingredient'&&b.dataset.item===common.id),beforeDistance=h.save();h.context.G.px=h.context.G.pz=0;
  h.get('towerOverlay').listeners.get('click')({target:stale});assert.deepEqual(h.save(),beforeDistance,'Leaving the actual grocery prevents a pending ingredient purchase');
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

test('repeated stair contact descends once, and floor 1 produces the chosen story ending', () => {
  const catalog = harness().context;
  const original = catalog.TowerCore.newRun({ seed: 765 }); original.floor = 2; original.floorsCleared = 97;
  original.chronicle = catalog.TowerNarrative.newChronicle(2); original.chronicle.clues.push('clue:heart');
  const h = harness(original); h.context.TowerMode.open(); h.click('continue'); h.click('close'); h.context.TowerMode.reachExit();
  assert.equal(h.save().floor,2,'Entering the stairs asks before leaving');h.click('exit-confirm');
  assert.equal(h.save().floor, 1); assert.equal(h.save().floorsCleared, 98);
  assert.equal(h.context.TowerMode.preserveFloorPickups(), false, 'The next floor must be allowed to create its initial pickups');
  const before = h.save(); h.context.TowerMode.reachExit(); h.context.TowerMode.reachExit();
  assert.deepEqual(h.save(), before, 'Repeated collision callbacks must not advance more than one floor');
  h.click('descend'); if (h.context.TowerMode.paused) h.click('close'); h.context.TowerMode.reachExit();
  h.click('exit-confirm');
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
  assert.equal(h.save().status, 'playing'); assert.equal(h.save().coins, 12); assert.equal(h.save().hp, 60); assert.equal(h.save().hunger, 65); assert.deepEqual(h.save().claimed, ['s0']);
  assert.equal(h.context.G.charIdx, 4, 'Loading a defeated save must restore its original profession'); assert.equal(h.get('playerName').value, '工程師旅人'); assert.ok(h.context.TowerCore.validateSave(h.save()));
});
