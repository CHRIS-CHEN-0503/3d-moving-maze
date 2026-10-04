import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url), C = require('../story/story-core.js');
const source = readFileSync(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
const bridge = `window.__musicTest = {
  setup(value) { run=value;active=true;paused=false;floorStarted=true;floorConfig=C.floorConfig(value.floor);partyUI=fakeParty; },
  monsters(value) { monsters=value; }, inactive() { active=false; },
  state() { return {campDialog,encounterHold,bossEncounterHold,paused}; },
  dialog,closeDialog,isCampMusicDialog,updateEncounterMusic,soundChanged,
};`;
assert.match(source, /  install\(\);\s*\}\)\(\);\s*$/);

function runtime() {
  const nodes = new Map(), calls = [];
  let safe = true;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, style: {}, focus() {}, isConnected: true,
      querySelector() { return null; }, classList: { toggle() {} } });
    return nodes.get(id);
  };
  const audio = Object.fromEntries(['configure', 'setEnvironment', 'setEncounter', 'setCamp', 'setPaused', 'setMuted', 'stop']
    .map(name => [name, (...args) => calls.push({ name, args })]));
  const context = vm.createContext({
    window: { TowerCore: C, TowerAudio: audio }, THREE: {},
    document: { getElementById: node, activeElement: node('focus') },
    performance: { now: () => 1000 }, localStorage: { getItem: () => null },
    G: { running: true, frozen: false, shifting: false, startTime: 0, effects: {}, muted: false },
    AudioEng: { ctx: {}, musicGain: {}, stopMusic() {}, resume() {} },
    keys: {}, joy: {}, escapeHtml: String,
    fakeParty: { safeCamp: () => safe, refreshWorkProgress() {}, hud() {} },
  });
  vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/, bridge), context, { filename: 'tower-mode.js' });
  const api = context.window.__musicTest, run = C.newRun({ seed: 123 }); api.setup(run);
  return { api, context, run, calls, safe(value) { safe = value; }, last(name) { return calls.filter(c => c.name === name).at(-1)?.args; } };
}

test('only safe camp cooking and the actual camp workshop select camp music', () => {
  const h = runtime();
  h.api.dialog('高塔遠征 · 暫停中', '旅人廚房', '', '', '', { commerce: 'camp', silent: true });
  assert.deepEqual(h.last('setCamp'), [true]); assert.equal(h.api.state().paused, true);
  h.api.closeDialog(); assert.deepEqual(h.last('setCamp'), [false]); assert.equal(h.api.state().paused, false);
  h.api.dialog('營地工坊 · 暫停中', '鍛匠工坊', '', '', '', { workshop: true, commerce: 'workshop', silent: true });
  assert.deepEqual(h.last('setCamp'), [true]);
  h.api.dialog('確認鍛造', '鍛造', '', '', '<button data-tower="party-forge-back">返回工坊</button>', { silent: true });
  assert.deepEqual(h.last('setCamp'), [true], 'An actual camp confirmation retains its camp music');
  h.api.closeDialog(); assert.deepEqual(h.last('setCamp'), [false]);
});

test('ordinary pauses, inventory, merchants and unavailable cooking do not become a camp', () => {
  const h = runtime();
  for (const [kicker, narration, actions] of [
    ['旅程已暫停', {}, ''], ['旅人背包 · 暫停中', {}, ''],
    ['蘇禾 · 行商營地', { commerce: 'grocery' }, ''],
    ['鐵嶺 · 專門維護 · 暫停中', { workshop: true, commerce: 'workshop' }, ''],
    ['委託料理確認', { commerce: 'grocery' }, '<button data-tower="commission-cooking">取消</button>'],
    ['確認鍛造', {}, '<button data-tower="party-forge-back">返回工坊</button>'],
  ]) {
    h.api.dialog(kicker, '面板', '', '', actions, { ...narration, silent: true });
    assert.deepEqual(h.last('setCamp'), [false], kicker);
  }
  h.safe(false);
  for (const [kicker, narration] of [['廚房', { commerce: 'camp' }], ['營地工坊 · 暫停中', { workshop: true }]]) {
    h.api.dialog(kicker, '需回到安全營地', '', '', '', { ...narration, silent: true });
    assert.deepEqual(h.last('setCamp'), [false]);
  }
});

test('leaving a camp panel for inventory clears camp music, and late confirmation cannot re-establish it', () => {
  const h = runtime();
  h.api.dialog('高塔遠征 · 暫停中', '旅人廚房', '', '', '', { commerce: 'camp', silent: true });
  h.api.dialog('旅人背包 · 暫停中', '背包', '', '', '', { silent: true });
  assert.deepEqual(h.last('setCamp'), [false]);
  h.api.dialog('確認鍛造', '確認', '', '', '<button data-tower="party-forge-back">返回</button>', { silent: true });
  assert.deepEqual(h.last('setCamp'), [false]);
});

test('core production is a camp service, while merchant robot upgrades remain merchant music', () => {
  const h = runtime();
  h.api.dialog('安全營地 · 動力核心', '核心工坊', '', '', '', { silent: true });
  assert.deepEqual(h.last('setCamp'), [true]);
  h.api.dialog('製作核心確認', '確認', '', '', '<button data-tower="hero-core-craft">取消</button>', { silent: true });
  assert.deepEqual(h.last('setCamp'), [true]);
  h.api.dialog('機體強化 · 暫停中', '機體', '', '', '<button data-tower="party-merchant-forge">修理機件</button>', { silent: true });
  assert.deepEqual(h.last('setCamp'), [false]);
});

test('camp core workshop does not carry its music into robot equipment, skills or shared inventory', () => {
  const h = runtime();
  const heroSource = readFileSync(new URL('../story/tower-heroes-runtime.js', import.meta.url), 'utf8');
  assert.match(heroSource, /act\('製作核心','hero-core-craft',id\)\+act\('機體強化','hero-robot-workshop',id\)/);
  const robotFooter = '<button data-tower="hero-core-craft" data-item="hero">製作核心</button>' +
    '<button data-tower="hero-robot-workshop" data-item="hero">機體強化</button>' +
    '<button data-tower="hero-growth" data-item="hero">角色成長／選技</button>';
  for (const tab of ['裝備', '技能', '共用背包']) {
    h.api.dialog('安全營地 · 動力核心', '核心工坊', '', '', '', { silent: true });
    assert.deepEqual(h.last('setCamp'), [true]);
    h.api.dialog('隊伍管理 · 暫停中', '機器人', '', '<section>' + tab + '</section>', robotFooter, { heroManagement: true, silent: true });
    assert.deepEqual(h.last('setCamp'), [false], tab);
    assert.equal(h.api.state().campDialog, false);
  }
});

test('only actual camp service confirmation kickers retain music with their exact return action', () => {
  const h = runtime();
  for (const [service, narration, confirmations] of [
    ['營地工坊 · 暫停中', { workshop: true }, [['確認修理', 'party-forge-back'], ['確認鍛造', 'party-forge-back'],
      ['確認材料附魔', 'party-forge-back'], ['拆解裝備確認', 'party-forge-back']]],
    ['安全營地 · 動力核心', {}, [['製作核心確認', 'hero-core-craft']]],
    ['機體強化 · 暫停中', {}, [['機體進階確認', 'hero-robot-workshop']]],
  ]) {
    for (const [kicker, returnAction] of confirmations) {
      h.api.dialog(service, '營地服務', '', '', '', { ...narration, silent: true });
      h.api.dialog(kicker, '確認', '', '', '<button data-tower="' + returnAction + '">返回</button>', { silent: true });
      assert.deepEqual(h.last('setCamp'), [true], kicker);
    }
  }
  h.api.dialog('安全營地 · 動力核心', '核心工坊', '', '', '', { silent: true });
  h.api.dialog('確認批次維護', '商人維護', '', '', '<button data-tower="party-forge-back">返回</button>', { silent: true });
  assert.deepEqual(h.last('setCamp'), [false], 'Batch maintenance is exclusively a merchant service');
  h.api.dialog('安全營地 · 動力核心', '核心工坊', '', '', '', { silent: true });
  h.api.dialog('製作核心確認', '錯誤返回目標', '', '', '<button data-tower="hero-robot-workshop">返回</button>', { silent: true });
  assert.deepEqual(h.last('setCamp'), [false]);
});

test('a living lord elsewhere is not an engaged lord, and ordinary threats keep the normal combat cue', () => {
  const h = runtime(); h.api.monsters([{ lord: true, alive: true }, { lord: false, alive: true }]);
  h.api.updateEncounterMusic(false, false, .1); assert.deepEqual(h.last('setEncounter'), [false, false]);
  h.api.updateEncounterMusic(true, false, .1); assert.deepEqual(h.last('setEncounter'), [true, false]);
  h.api.updateEncounterMusic(true, true, .1); assert.deepEqual(h.last('setEncounter'), [true, true]);
  h.api.updateEncounterMusic(false, false, 1); assert.deepEqual(h.last('setEncounter'), [true, true]);
  h.api.updateEncounterMusic(false, false, 4); assert.deepEqual(h.last('setEncounter'), [false, false]);
});

test('lord defeat removes boss music immediately even with an ordinary threat still engaged', () => {
  const h = runtime(); h.api.monsters([{ lord: true, alive: true }]);
  h.api.updateEncounterMusic(true, true, .1);
  h.api.monsters([{ lord: true, alive: false }, { lord: false, alive: true }]);
  h.api.updateEncounterMusic(true, false, .1); assert.deepEqual(h.last('setEncounter'), [true, false]);
  assert.equal(h.api.state().bossEncounterHold, 0);
});

test('music resynchronization uses the existing context and current real scene without treating pause as camp', () => {
  const h = runtime(); h.api.monsters([{ lord: true, alive: true }]);
  h.api.updateEncounterMusic(true, true, .1);
  h.api.dialog('旅程已暫停', '暫停', '', '', '', { silent: true });
  h.api.soundChanged();
  const [configuration] = h.last('configure');
  assert.equal(configuration.context, h.context.AudioEng.ctx); assert.equal(configuration.output, h.context.AudioEng.musicGain);
  assert.deepEqual(h.last('setEnvironment'), ['summoning']); assert.deepEqual(h.last('setEncounter'), [true, true]);
  assert.deepEqual(h.last('setCamp'), [false]); assert.deepEqual(h.last('setPaused'), [true]);
  h.api.inactive(); const count = h.calls.length; h.api.soundChanged(); assert.equal(h.calls.length, count);
});

test('loop constants and expected diagnostic hashes match the shipped manifest exactly', () => {
  const audio = readFileSync(new URL('../story/tower-audio.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../assets/music/orchestra-manifest.json', import.meta.url), 'utf8'));
  for (const track of manifest.tracks) {
    assert.ok(audio.includes(`loopEnd: ${track.loopEnd}`), track.id);
    assert.ok(audio.includes(`sha256: '${track.sha256}'`), track.id);
    assert.equal(track.loopStart, 0); assert.equal(track.frames / track.sampleRate, track.loopEnd);
  }
});
