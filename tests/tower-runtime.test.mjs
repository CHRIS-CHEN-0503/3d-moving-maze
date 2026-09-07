import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../story/story-core.js');
const source = await readFile(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
// 注入只存在於測試的介面；正式程式沒有測試用全域或捷徑。
const bridge = `window.__test = {
  setState(value) { run=value.run;active=true;floorStarted=true;floorConfig=C.floorConfig(run.floor);hurtLeft=0; },
  state() { return {run,paused,shiftLeft,attackLeft,hurtLeft}; },
  dialog,closeDialog,readSave,save,updateMonster,hasClearPath,
};`;
assert.match(source, /  install\(\);\s*\}\)\(\);\s*$/);

function runtime() {
  let now = 1000;
  const storage = new Map();
  const nodes = new Map();
  const messages = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { style: {}, hidden: true, textContent: '', innerHTML: '', focus() {}, isConnected: true, classList: { add() {}, remove() {}, toggle() {} } });
    return nodes.get(id);
  };
  const context = vm.createContext({
    window: { TowerCore: core }, escapeHtml: value => String(value),
    document: { getElementById: node, activeElement: node('focus'), body: { classList: { add() {}, remove() {}, toggle() {} } } },
    performance: { now: () => now },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    G: { running: true, frozen: false, shifting: false, satiety: 100, px: 0, pz: 0, startTime: 100, shovels: 1, kites: 0, whistles: 0, shovelRechargeAt: 5000, skillCoolUntil: 0, effects: {}, mazeW: 7, mazeH: 7 },
    keys: { KeyW: true }, joy: { active: true, dx: 1, dy: 0 },
    showToast: message => messages.push(message), AudioEng: { sfxTick() {}, sfxPickup() {} },
    playerInWall: () => false, worldToCell: () => ({ x: 0, y: 0 }), cellToWorld: (x,y) => ({ x: x*4, z:y*4 }), solveMaze: () => [[0,0]],
  });
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/, bridge), context);
  context.window.__test.setState({ run: core.newRun({ seed: 123, name: '測試旅人' }) });
  return { context, api: context.window.TowerMode, testApi: context.window.__test, nodes, storage, messages, at: value => { now = value; } };
}

test('背包對話真正暫停劇情與原道具時限，恢復時保留剩餘秒數', () => {
  const h = runtime();
  h.context.G.ghostUntil = 9000;
  h.context.G.effects.speed = { until: 10000 };
  h.testApi.dialog('背包', '暫停', '', '', '');
  assert.equal(h.context.G.frozen, true);
  assert.deepEqual(Object.keys(h.context.keys), []);
  assert.equal(h.context.joy.active, false);
  const before = JSON.stringify(h.testApi.state().run);
  h.at(21000); h.api.tick(.05, 21000);
  assert.equal(JSON.stringify(h.testApi.state().run), before);
  h.testApi.closeDialog();
  assert.equal(h.context.G.shovelRechargeAt, 25000);
  assert.equal(h.context.G.ghostUntil, 29000);
  assert.equal(h.context.G.effects.speed.until, 30000);
  assert.equal(h.context.G.startTime, 20100);
  assert.equal(h.context.G.frozen, false);
});

test('存檔保存當前庫存與剩餘冷卻；破損或儲存額滿不冒充成功', () => {
  const h = runtime();
  h.context.G.shovels = 3; h.context.G.satiety = 45;
  assert.equal(h.testApi.save(), true);
  const saved = h.testApi.readSave();
  assert.equal(saved.engine.shovels, 3);
  assert.equal(saved.engine.shovelCooldownMs, 4000);
  assert.equal(saved.hunger, 45);
  h.storage.set('maze3d_tower_v1', '{broken');
  assert.equal(h.testApi.readSave(), null);
  h.context.localStorage.setItem = () => { throw new Error('quota'); };
  assert.equal(h.testApi.save(), false);
  assert.equal(h.testApi.save(), false);
  assert.equal(h.messages.length, 1);
});

test('怪物蓄力攻擊不能穿牆，命中後給予短暫保護避免多怪瞬間連殺', () => {
  const h = runtime();
  h.context.G.px = 1;
  const monster = () => ({ alive: true, cooldown: 0, pathLeft: 1, windup: .1, phase: 0, kind: 'clockmite', def: core.MONSTERS.clockmite,
    model: { position: { x: 0, z: 0 }, userData: { body: { position: {} }, ring: { material: {} } } } });
  h.context.playerInWall = () => true;
  h.testApi.updateMonster(monster(), .2, 1000);
  assert.equal(h.testApi.state().run.hp, 100);
  h.context.playerInWall = () => false;
  h.testApi.updateMonster(monster(), .2, 1000);
  assert.equal(h.testApi.state().run.hp, 92);
  h.testApi.updateMonster(monster(), .2, 1000);
  assert.equal(h.testApi.state().run.hp, 92);
});

test('抵達第一層正確結束旅程，重複出口判定不重複獎勵', () => {
  const h = runtime();
  const run = core.newRun({ seed: 123 });
  run.floor = 1; run.floorsCleared = 98;
  h.testApi.setState({ run });
  h.api.reachExit();
  const completed = h.testApi.state().run;
  assert.equal(completed.status, 'won');
  assert.equal(completed.floorsCleared, 99);
  assert.match(h.nodes.get('towerDialog').innerHTML, /歸途|回家/);
  assert.doesNotMatch(h.nodes.get('towerDialog').innerHTML, /\[object Object\]|第 0 層|繼續下降/);
  const coins = completed.coins;
  h.api.reachExit();
  assert.equal(h.testApi.state().run.coins, coins);
});
