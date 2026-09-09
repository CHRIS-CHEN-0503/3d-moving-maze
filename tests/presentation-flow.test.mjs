import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/game-polish.css', import.meta.url), 'utf8');

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `找不到實際函式 ${name}`);
  // Engine functions have an unindented closing brace; inner blocks are indented.
  const end = html.indexOf('\n}', start);
  assert.ok(end > start, `找不到函式結尾 ${name}`);
  return html.slice(start, end + 2);
}

function openingTag(id) {
  return [...html.matchAll(/<([a-z]+)\b([^>]*)>/gi)].find(match => new RegExp(`\\bid=["']${id}["']`).test(match[2]));
}

function harness() {
  const elements = new Map(), events = new Map(), storage = new Map([
    ['maze3d_tower_v1', '{"floor":67,"sentinel":"existing journey"}'],
    ['maze3d_name', '原本的冒險者'], ['maze3d_cfg', '{"rounds":8}'],
  ]);
  const writes = [], calls = { cancel: 0, audioInit: 0, audioResume: 0, landscape: 0, attack: 0, shovel: 0, starts: 0 };
  let activeElement = null;
  class Element {
    constructor(id = '', classes = []) {
      this.id = id; this.tagName = 'DIV'; this.classes = new Set(classes); this.dataset = {};
      this.style = { setProperty() {} }; this.listeners = new Map(); this.children = []; this.scrollTop = 51;
      this.value = ''; this.textContent = ''; this.disabled = false;
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        contains: name => this.classes.has(name),
        toggle: (name, enabled) => { const on = enabled ?? !this.classes.has(name); if (on) this.classes.add(name); else this.classes.delete(name); return on; },
      };
    }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
    emit(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn({ target: this, ...event }); }
    click() { if (!this.disabled) { this.onclick?.({ target: this }); this.emit('click'); } }
    focus() { activeElement = this; }
    blur() { activeElement = null; }
    setAttribute(key, value) { this[key] = value; }
    querySelector() { return new Element(); }
    closest() { return null; }
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  for (const match of html.matchAll(/<([a-z]+)\b([^>]*)>/gi)) {
    const id = /\bid="([^"]+)"/.exec(match[2])?.[1];
    if (!id) continue;
    const element = get(id); element.tagName = match[1].toUpperCase();
    for (const name of /\bclass="([^"]*)"/.exec(match[2])?.[1]?.split(/\s+/) || []) if (name) element.classes.add(name);
  }
  const entryShell = new Element(); entryShell.dataset.panel = 'homePanel';
  const document = {
    get activeElement() { return activeElement; },
    getElementById: get,
    querySelector: selector => selector === '#titleScreen .entry-shell' ? entryShell : new Element(),
    querySelectorAll: selector => {
      if (selector === '.screen') return [...elements.values()].filter(element => element.classes.has('screen'));
      if (selector === '#titleScreen .flow-panel') return [...elements.values()].filter(element => element.classes.has('flow-panel'));
      return [];
    },
  };
  const noop = () => {};
  const context = vm.createContext({
    document, $: get, console, Math, performance: { now: () => 10000 },
    G: { running: false, frozen: false, charIdx: 0, view: 'tp', spMode: 'classic' },
    MP: { on: false, started: false }, CFG: { rounds: 8 }, SERIES: { current: 0, total: 8 },
    keys: {}, joy: { active: false, dx: 0, dy: 0 }, location: { hash: '#unchanged' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes.push([key, value]); storage.set(key, String(value)); }, removeItem: key => { writes.push([key]); storage.delete(key); } },
    cancelSceneTransition: () => calls.cancel++, requestLandscapeLock: () => calls.landscape++,
    AudioEng: { init: () => calls.audioInit++, resume: () => calls.audioResume++, stopMusic: noop, stopItemLoop: noop },
    confirm: () => true, confirmSeriesExit: () => true, typingInField: () => false,
    bindActionBtn: (element, fn) => element.addEventListener('click', fn),
    continueToSetup: () => calls.starts++, continueSingleSeries: () => calls.starts++,
    startSingleSeries: () => calls.starts++, useShovel: () => calls.shovel++, doAttack: () => calls.attack++,
    useKite: noop, useWhistle: noop, doRob: noop, startCheckout: noop, useSkill: noop,
    selectedRoundTotal: () => 8, saveCfg: noop, allowedViews: () => ['tp', 'fp', 'top'],
    openMultiplayerRoom: noop, updateSoundBtn: noop, showToast: noop, renderLeaderboard: noop,
    mpLeave: noop, sizeBigMap: noop, drawMap: noop, isShop: () => false,
    addEventListener: (type, fn) => { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); },
    removeEventListener: noop,
  });
  context.window = context;
  vm.runInContext(['let entryMode="single";', ...['switchScreen', 'setFlowPanel', 'enterMainMenu', 'beginEntryFlow', 'wireUI', 'setupTouch'].map(functionSource)].join('\n'), context);
  const keyboardStart = html.indexOf("window.addEventListener('keydown',e=>{", html.indexOf('const keys='));
  const keyboardEnd = html.indexOf('const joy=', keyboardStart);
  assert.ok(keyboardStart > 0 && keyboardEnd > keyboardStart);
  vm.runInContext(html.slice(keyboardStart, keyboardEnd), context);
  vm.runInContext('wireUI(); setupTouch();', context);
  return {
    context, get, storage, writes, calls, entryShell,
    run: source => vm.runInContext(source, context),
    activeScreens: () => [...elements.values()].filter(element => element.classes.has('screen') && element.classes.has('active')).map(element => element.id),
    key(code, key = code) { let prevented = false; for (const fn of events.get('keydown') || []) fn({ code, key, preventDefault() { prevented = true; } }); return prevented; },
  };
}

test('首次載入只有獨立起始畫面顯示，角色與關卡選單尚未開啟', () => {
  const h = harness();
  assert.deepEqual(h.activeScreens(), ['splashScreen']);
  assert.equal(h.calls.starts, 0);
  assert.equal(h.context.G.running, false);
  assert.deepEqual(h.writes, []);
});

test('開始遊戲是原生可聚焦按鈕，保留鍵盤與觸控的標準啟動方式', () => {
  const tag = openingTag('enterMenuBtn');
  assert.ok(tag); assert.equal(tag[1], 'button');
  assert.doesNotMatch(tag[2], /\bdisabled\b|tabindex=["']-1["']/);
  const buttonStart = tag.index, buttonEnd = html.indexOf('</button>', buttonStart);
  assert.match(html.slice(buttonStart, buttonEnd), /開始遊戲/);
  const h = harness();
  h.get('enterMenuBtn').focus();
  for (const [code, key] of [['Enter', 'Enter'], ['Space', ' ']]) assert.equal(h.key(code, key), false, `${code} 不可被遊戲動作快捷鍵攔截`);
  assert.equal(h.calls.attack + h.calls.shovel, 0);
  h.get('enterMenuBtn').click();
  assert.deepEqual(h.activeScreens(), ['titleScreen']);
  assert.equal(h.context.document.activeElement?.id, 'storyEntryBtn');
});

test('開始遊戲只開啟既有主選單，不直接開始關卡或改寫存檔', () => {
  const h = harness(), before = [...h.storage];
  h.get('enterMenuBtn').click();
  assert.equal(h.entryShell.dataset.panel, 'homePanel');
  assert.equal(h.get('homePanel').classList.contains('active'), true);
  assert.equal(h.get('profilePanel').classList.contains('active'), false);
  assert.equal(h.get('setupPanel').classList.contains('active'), false);
  assert.equal(h.get('titleScreen').scrollTop, 0);
  assert.equal(h.calls.starts, 0); assert.equal(h.context.G.running, false);
  assert.deepEqual(h.writes, []); assert.deepEqual([...h.storage], before);
  assert.equal(h.context.location.hash, '#unchanged');
});

test('主選單仍能進入單人選角，返回時不再出現起始畫面', () => {
  const h = harness();
  h.get('enterMenuBtn').click(); h.get('singleBtn').click();
  assert.equal(h.entryShell.dataset.panel, 'profilePanel');
  assert.equal(h.get('profileTitle').textContent, '建立單人角色');
  assert.equal(h.get('profilePanel').classList.contains('active'), true);
  h.get('profileBackBtn').click();
  assert.equal(h.entryShell.dataset.panel, 'homePanel');
  assert.deepEqual(h.activeScreens(), ['titleScreen']);
  assert.deepEqual(h.writes, []);
});

test('過關、失敗與離開遊戲按鈕直接返回主選單，不重播起始畫面', () => {
  for (const button of ['winHomeBtn', 'failHomeBtn', 'quitBtn']) {
    const h = harness();
    h.get('enterMenuBtn').click();
    h.run("setFlowPanel('setupPanel'); switchScreen('gameScreen'); G.running=true;");
    h.get(button).click();
    assert.deepEqual(h.activeScreens(), ['titleScreen'], button);
    assert.equal(h.entryShell.dataset.panel, 'homePanel', button);
    assert.deepEqual(h.writes, [], button);
  }
});

test('多人建立角色與結算返回沿用同一主選單，不需再次按開始遊戲', () => {
  const h = harness();
  const entryBinding = html.match(/^\$\('mpBtn'\)\.onclick=.*;$/m)?.[0];
  const returnStart = html.indexOf("$('mpResultHome').onclick=()=>{");
  const returnEnd = html.indexOf('\n};', returnStart);
  assert.ok(entryBinding && returnStart > 0 && returnEnd > returnStart);
  h.run(entryBinding + '\n' + html.slice(returnStart, returnEnd + 3));
  h.get('enterMenuBtn').click(); h.get('mpBtn').click();
  assert.equal(h.entryShell.dataset.panel, 'profilePanel');
  assert.equal(h.get('profileTitle').textContent, '建立多人角色');
  h.run("switchScreen('gameScreen'); G.running=true;");
  h.get('mpResultHome').click();
  assert.deepEqual(h.activeScreens(), ['titleScreen']);
  assert.equal(h.entryShell.dataset.panel, 'homePanel');
  assert.equal(h.context.G.running, false);
  assert.deepEqual(h.writes, []);
});

test('重複點擊開始與返回選單不會覆蓋已存在的姓名、設定或劇情進度', () => {
  const h = harness(), before = [...h.storage];
  for (let i = 0; i < 4; i++) {
    h.get('enterMenuBtn').click();
    h.run("switchScreen('gameScreen'); switchScreen('titleScreen');");
  }
  assert.deepEqual(h.activeScreens(), ['titleScreen']);
  assert.equal(h.entryShell.dataset.panel, 'homePanel');
  assert.deepEqual(h.writes, []); assert.deepEqual([...h.storage], before);
  assert.equal(h.calls.starts, 0);
});

test('主選單的空白鍵不會觸發鐵鍬，進入遊戲後原快捷鍵仍可使用', () => {
  const h = harness(); h.get('enterMenuBtn').click();
  assert.equal(h.key('Space', ' '), false); assert.equal(h.calls.shovel, 0);
  h.run("switchScreen('gameScreen');");
  assert.equal(h.key('Space', ' '), true); assert.equal(h.calls.shovel, 1);
});

test('起始畫面沿用本機美術，沒有自動播放影片或另建即時三維場景', () => {
  const start = openingTag('splashScreen')?.index, end = openingTag('titleScreen')?.index;
  assert.ok(start >= 0 && end > start);
  const markup = html.slice(start, end);
  assert.doesNotMatch(markup, /<video|<iframe|<canvas|https?:\/\//i);
  assert.doesNotMatch(functionSource('enterMainMenu'), /new THREE|startGame\(|launchGame\(|setItem|removeItem|location\.|history\./);
  assert.match(css + html, /prefers-reduced-motion/);
});
