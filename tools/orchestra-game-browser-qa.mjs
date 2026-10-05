// Finite browser regression. Uses native audio, public UI and isolated legal saves.
// Run against a managed local server, or an explicitly supplied public HTTPS URL.
// No room, remote write, replaced audio response or private game bridge is allowed.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = resolve(process.env.MAZE_QA_SOURCE || fileURLToPath(new URL('..', import.meta.url)));
const base = process.env.MAZE_QA_URL || 'http://127.0.0.1:8798/';
const out = resolve(process.env.MAZE_QA_OUT || '.agent-run/orchestra-game-browser-qa');
const address = new URL(base), origin = address.origin;
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname);
assert.ok(local || (process.env.MAZE_QA_URL && address.protocol === 'https:'), 'Public runs require an explicit HTTPS MAZE_QA_URL');
assert.ok(['http:', 'https:'].includes(address.protocol));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(join(source, 'assets/music/orchestra-manifest.json'), 'utf8'));
assert.equal(manifest.originalScore, true);
assert.deepEqual(manifest.tracks.slice(0,3).map(t => t.id), ['summit', 'boss', 'camp']);
const regions = [['garden',89],['roots',79],['echo',69],['library',59],['mist',49],['frost',39],['clockwork',29],['furnace',19],['heart',9],
  ['underworld-roots',-1],['underworld-mist',-11],['underworld-library',-21],['underworld-furnace',-31],['underworld-heart',-41]];
assert.deepEqual(manifest.tracks.slice(3).map(t => t.id), regions.map(([id]) => id));
const expected = new Map();
for (const track of manifest.tracks) {
  assert.equal(track.file, 'assets/music/orchestra-' + track.id + '.m4a');
  const body = await readFile(join(source, track.file));
  assert.equal(sha(body), track.sha256, 'Manifest matches local exported music ' + track.id);
  assert.equal(body.length, track.bytes);
  assert.equal(track.loopStart, 0);
  assert.ok(Math.abs(track.loopEnd - track.frames / track.sampleRate) < 1e-8);
  expected.set('/' + track.file, {...track, sha256: sha(body)});
}
const originalCombat = await readFile(join(source, 'assets/music/combat.m4a'));
const knownBuffers = [...expected.values()].map(t => [t.sha256, 'orchestra-' + t.id]);
knownBuffers.push([sha(originalCombat), 'combat']);
const sourcePaths = ['/', '/story/tower-audio.js', '/story/tower-mode.js', '/assets/audio-settings.js', '/assets/music/orchestra-manifest.json'];
const sourceHashes = new Map();
for (const path of sourcePaths) sourceHashes.set(path, sha(await readFile(join(source, path === '/' ? 'index.html' : path.slice(1)))));
const html = await readFile(join(source, 'index.html'), 'utf8');
const version = html.match(/(?:const|let|var)\s+GAME_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(version, 'Version is read from the exact export being verified');
await mkdir(out, {recursive: true});
const report = {
  version, base, source, graphicsBackend: 'metal', hardwareMuted: true,
  isolatedSaveFixtures: true, realPlayerProgressUsed: false,
  stages: [], loaded: [], audioHTTP: [], requestFailures: [], errors: [], blocked: [], sockets: [],
  limitations: [
    'Fresh isolated Chrome context; fixture progress belongs only to this browser regression, not a real player.',
    'Runtime configuration and score-list reads are isolated empty responses; all music and game source bodies are real HTTP responses.',
    'Native decode and source observations prove playback configuration and execution, not an audible speaker recording or subjective musical quality.',
  ],
};
const responseWork = [], contexts = new Set();
let browser, page, currentStage = 'bootstrap', delayedCamp = false;
let deadline;

function instrumentNativeAudio({knownBuffers}) {
  const known = new Map(knownBuffers), buffers = new WeakMap(), nativeNodes = [], decoded = [], events = [], visibility = [];
  let bufferSerial = 0, sourceSerial = 0, maxMusicVoices = 0;
  const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const bufferInfo = buffer => {
    if (!buffer) return null;
    if (!buffers.has(buffer)) buffers.set(buffer, {bufferId: ++bufferSerial, duration: buffer.duration, frames: buffer.length, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels});
    return buffers.get(buffer);
  };
  const actual = node => {
    const b = bufferInfo(node.source.buffer), now = node.context.currentTime;
    const active = node.started && !node.ended && !node.disconnected && now >= node.startAt && (node.stopAt === null || now < node.stopAt);
    return {sourceId: node.id, contextTime: now, contextState: node.context.state, startAt: node.startAt, stopAt: node.stopAt,
      ended: node.ended, disconnected: node.disconnected, active, loop: node.source.loop, loopStart: node.source.loopStart, loopEnd: node.source.loopEnd,
      ...b, track: b?.sha256 ? known.get(b.sha256) || null : null};
  };
  const measure = () => {
    const sources = nativeNodes.map(actual), count = sources.filter(s => s.active && s.track).length;
    maxMusicVoices = Math.max(maxMusicVoices, count);
    return {sources, activeMusicCount: count, maxMusicVoices};
  };
  const constructors = [...new Set([window.AudioContext, window.webkitAudioContext].filter(Boolean))];
  for (const Constructor of constructors) {
    const proto = Constructor.prototype, decode = proto.decodeAudioData, create = proto.createBufferSource;
    proto.decodeAudioData = function(bytes, success, failure) {
      const digest = hash(bytes.slice(0));
      const record = buffer => {
        const b = bufferInfo(buffer);
        digest.then(sha256 => {if (!b.sha256) {b.sha256 = sha256; decoded.push({...b, contextTime: this.currentTime, contextState: this.state, contextSampleRate: this.sampleRate}); measure();}});
        return buffer;
      };
      const args = [bytes];
      if (typeof success === 'function') args.push(buffer => {record(buffer); success(buffer);});
      else if (arguments.length > 1) args.push(success);
      if (arguments.length > 2) args.push(failure);
      const result = Reflect.apply(decode, this, args);
      if (result && typeof result.then === 'function') result.then(record, error => events.push({kind: 'decode-error', name: error.name, message: error.message}));
      return result;
    };
    proto.createBufferSource = function(...args) {
      const source = Reflect.apply(create, this, args);
      const node = {id: ++sourceSerial, source, context: this, started: false, ended: false, disconnected: false, startAt: null, stopAt: null};
      nativeNodes.push(node);
      events.push({kind: 'createBufferSource', sourceId: node.id, contextTime: this.currentTime});
      source.addEventListener('ended', () => {node.ended = true; events.push({kind: 'ended', sourceId: node.id, contextTime: this.currentTime}); measure();});
      for (const name of ['start', 'stop', 'disconnect']) {
        const native = source[name];
        source[name] = (...values) => {
          const result = Reflect.apply(native, source, values);
          if (name === 'start') {node.started = true; node.startAt = Math.max(this.currentTime, Number(values[0]) || 0);}
          if (name === 'stop') node.stopAt = Math.max(this.currentTime, Number(values[0]) || 0);
          if (name === 'disconnect') node.disconnected = true;
          events.push({kind: name, sourceId: node.id, args: values.map(v => typeof v === 'number' ? v : typeof v), ...actual(node)});
          measure();
          return result;
        };
      }
      return source;
    };
  }
  document.addEventListener('visibilitychange', () => visibility.push({state: document.visibilityState, at: performance.now()}));
  window.__orchestraAudioQA = {capture: () => ({...measure(), decoded: decoded.map(d => ({...d})), events: events.map(e => ({...e})), visibility: visibility.map(v => ({...v}))})};
  window.__roomAttempts = [];
  window.WebSocket = class {constructor(url) {window.__roomAttempts.push(String(url)); throw Error('No real room or socket is allowed in orchestral QA');}};
}

async function capture(p = page) {
  return p.evaluate(() => ({snapshot: TowerAudio.snapshot(), native: __orchestraAudioQA.capture(), visibility: document.visibilityState,
    runtime: {active: TowerMode.active, paused: TowerMode.paused, running: G.running, frozen: G.frozen, muted: G.muted,
      floor: TowerCore.validateSave(localStorage.getItem('maze3d_tower_v1'))?.floor, settings: MazeAudioSettings.get(),
      musicGain: AudioEng.musicGain?.gain.value, effectsGain: AudioEng.fxGain?.gain.value, contextState: AudioEng.ctx?.state, contextTime: AudioEng.ctx?.currentTime,
      contextSampleRate: AudioEng.ctx?.sampleRate, player: {x: G.px, z: G.pz}, view: G.view}}));
}
async function checkpoint(name, {target, screenshot = true} = {}) {
  currentStage = name;
  const state = await capture();
  assert.ok(state.native.activeMusicCount <= 2, 'At most one old and one new music source at ' + name);
  assert.ok(state.snapshot.activeCount <= 2);
  if (target) assert.equal(state.snapshot.target, target, 'Controller target at ' + name);
  const image = screenshot ? name + '.png' : null;
  if (image) await page.screenshot({path: join(out, image)});
  report.stages.push({name, ...state, screenshot: image});
  return state;
}
async function waitMusic(id, timeout = 20000) {
  await page.waitForFunction(id => {
    const s = TowerAudio.snapshot(), n = __orchestraAudioQA.capture();
    return s.target === id && s.current === id && n.sources.some(v => v.active && v.track === id && v.contextState === 'running');
  }, id, {timeout});
}
async function settle(id) {await waitMusic(id); await page.waitForTimeout(1150); return checkpoint(currentStage + '-settled', {target: id, screenshot: false});}
async function closeDialog() {
  const button = page.locator('[data-tower="close"]').first();
  if (await button.isVisible()) await button.click();
  await page.waitForFunction(() => TowerMode.active && !TowerMode.paused && G.running && !G.frozen, null, {timeout: 15000});
}
async function resume() {
  for (let tries = 0; tries < 8; tries++) {
    if (await page.evaluate(() => TowerMode.active && !TowerMode.paused && G.running && !G.frozen)) return;
    const skip = page.locator('[data-cinema="skip"]');
    if (await skip.isVisible()) {await skip.click(); await page.waitForTimeout(120); continue;}
    const close = page.locator('[data-tower="close"]').first();
    if (await close.isVisible()) {await close.click(); await page.waitForTimeout(120); continue;}
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => TowerMode.active && !TowerMode.paused && G.running && !G.frozen, null, {timeout: 15000});
}
async function home() {
  await page.goto(base, {waitUntil: 'domcontentloaded', timeout: 60000});
  await page.waitForFunction(() => typeof TowerMode === 'object' && typeof TowerAudio?.snapshot === 'function' && typeof TowerHeroes === 'object', null, {timeout: 60000});
  assert.equal(await page.evaluate(() => GAME_VERSION), version);
  await page.evaluate(() => GameVoice.configure({enabled: false}));
  await page.evaluate(async () => {const response = await fetch('assets/music/orchestra-manifest.json'); if (!response.ok) throw Error('Missing actual HTTP music manifest'); await response.json();});
  await page.locator('#enterMenuBtn').click();
}
async function leaveGame() {
  await resume();
  await page.locator('#actionsToggle').click();
  await page.locator('[data-tower="quit"]').click();
  await page.locator('[data-tower="home"]').click();
  await page.waitForFunction(() => !TowerMode.active && !G.running);
  await page.waitForTimeout(150);
  const state = await checkpoint(currentStage + '-left-game', {screenshot: false});
  assert.equal(state.snapshot.activeCount, 0);
  assert.equal(state.native.activeMusicCount, 0);
}
async function fixture(kind, regionFloor = null) {
  assert.equal(await page.evaluate(() => TowerMode.active), false, 'Fixture never replaces a live game');
  const prepared = await page.evaluate(({kind, regionFloor}) => {
    let run = TowerCore.newRun({seed: 31, name: '隔離配樂驗證'});
    run.floor = kind === 'region' ? regionFloor : kind === 'boss' ? 90 : 99;
    run.floorsCleared = run.floor < 0 ? 99 + (-run.floor - 1) : 99 - run.floor;
    run.chronicle = TowerNarrative.newChronicle(run.floor);
    run.chronicle.read = TowerNarrative.unlockedScenes(run.floor).map(s => s.id);
    if (run.floor < 0) {
      run.chronicle.ending = TowerNarrative.ENDINGS[0].id;
      run.underworld = {version: 1, departed: null, surfaceEnding: run.chronicle.ending};
    }
    const selected = TowerPartyCore.enable(run, 'smith', 'male');
    if (!selected.ok) throw Error('Public profession preparation failed');
    const modern = TowerHeroes.enable(selected.run);
    if (!modern.ok) throw Error('Public modern-save preparation failed');
    run = modern.run;
    TowerPartyCore.advance(run, {reward: false});
    const specs = TowerPartyCore.monsterSpecs(run), live = kind === 'boss' ? specs.find(s => s.lord) : kind === 'ordinary' ? specs.find(s => !s.lord) : null;
    if (!['camp','region'].includes(kind) && !live) throw Error('Missing real encounter specification');
    run.defeatedMonsters = specs.filter(s => s.id !== live?.id).map(s => s.id);
    run.effects.freeze = 120; // A valid existing potion effect keeps the path stable.
    const validated = TowerCore.validateSave(run);
    if (!validated) throw Error('Fixture rejected by the production save validator');
    localStorage.setItem('maze3d_tower_v1', JSON.stringify(validated));
    return {kind, valid: true, floor: validated.floor, seed: validated.seed, liveMonster: live ? {id: live.id, kind: live.kind, lord: !!live.lord} : null,
      monstersDefeatedForIsolation: validated.defeatedMonsters, realPlayerProgress: false};
  }, {kind, regionFloor});
  report.stages.push({name: 'legal-' + kind + '-save-fixture', fixture: prepared});
  await home();
  await page.locator('#storyEntryBtn').click();
  await page.locator('[data-tower="continue"]').click();
  await resume();
  assert.equal(await page.evaluate(() => TowerCore.validateSave(localStorage.getItem('maze3d_tower_v1'))?.floor), prepared.floor);
  return prepared;
}
async function topView() {
  for (let tries = 0; tries < 3 && await page.evaluate(() => G.view) !== 'top'; tries++) await page.locator('#viewToggle').click();
  assert.equal(await page.evaluate(() => G.view), 'top');
}
async function approachMonster(prepared) {
  await topView();
  let introduction = false;
  const maxSteps = await page.evaluate(() => G.mazeW * G.mazeH * 3 + 24);
  const trace = {kind: prepared.kind, maxSteps, steps: []};
  (report.navigation ||= []).push(trace);
  // Read the real public scene and maze. Move only with normal arrow controls.
  // No actor positions, damage flags, hidden run variables or game clocks change.
  for (let steps = 0; steps < maxSteps; steps++) {
    if (await page.evaluate(() => TowerMode.cinematicActive)) {
      introduction = true;
      await checkpoint(prepared.kind + '-real-introduction', {screenshot: true});
      await page.locator('[data-cinema="skip"]').click();
      await resume();
      await page.waitForTimeout(180);
    }
    const state = await page.evaluate(id => {
      let target = null;
      TowerMode.sightRoot()?.traverse(o => {if (o.userData.monsterId === id && o.visible) target = o;});
      if (!target) throw Error('Expected live monster is not in the real scene');
      const point = {x: target.position.x, z: target.position.z}, player = worldToCell(G.px, G.pz), cell = worldToCell(point.x, point.z);
      const path = solveMaze(player.x, player.y, cell.x, cell.y);
      const samples = Math.ceil(Math.hypot(G.px - point.x, G.pz - point.z) / .3);
      let clear = true;
      for (let i = 1; i <= samples; i++) if (playerInWall(G.px + (point.x - G.px) * i / samples, G.pz + (point.z - G.pz) * i / samples, .1)) {clear = false; break;}
      return {point, player: {x: G.px, z: G.pz}, distance: Math.hypot(G.px - point.x, G.pz - point.z),
        clear, path, sightVisible: !window.MazeSight?.active() || MazeSight.visible(point.x, point.z), lightingRadius: TowerMode.lightRadius(),
        snapshot: TowerAudio.snapshot(), paused: TowerMode.paused, typingField: document.activeElement?.tagName};
    }, prepared.liveMonster.id);
    trace.steps.push({step: steps, ...state});
    const desired = prepared.kind === 'boss' ? 'orchestra-boss' : 'combat';
    if (state.snapshot.target === desired) {
      await waitMusic(desired);
      if (prepared.kind === 'boss') assert.ok(introduction, 'A real floor-lord introduction precedes the boss battle');
      return {steps, introduction, reached: state};
    }
    if (state.paused) {await resume(); continue;}
    // A four-metre distance alone does not imply that an unlit/fogged lord
    // is visible. Keep approaching until the real encounter actually starts.
    if (state.distance < .65 && state.clear && state.sightVisible) {await page.waitForTimeout(200); continue;}
    assert.ok(state.path.length > 0, 'Actual maze offers a reachable path');
    const next = state.path.length > 1 ? state.path[1] : state.path[0];
    const target = state.path.length === 1 ? state.point : await page.evaluate(([x, y]) => cellToWorld(x, y), next);
    const dx = target.x - state.player.x, dz = target.z - state.player.z;
    const horizontal = Math.abs(dx) > Math.abs(dz), delta = horizontal ? dx : dz;
    if (Math.abs(delta) < .12) {await page.waitForTimeout(150); continue;}
    const axis = horizontal ? 'px' : 'pz', key = horizontal ? delta > 0 ? 'ArrowRight' : 'ArrowLeft' : delta > 0 ? 'ArrowDown' : 'ArrowUp';
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(({axis, value, sign}) => TowerMode.paused || sign * (G[axis] - value) >= -.10,
        {axis, value: horizontal ? target.x : target.z, sign: Math.sign(delta)}, {timeout: 4500, polling: 30});
    } finally {await page.keyboard.up(key);}
  }
  throw Error('Could not reach the real encounter with public movement controls');
}
async function assertLoops(state, id) {
  const spec = expected.get('/assets/music/' + id + '.m4a');
  assert.ok(spec, 'Expected manifest row for ' + id);
  const voices = state.native.sources.filter(s => s.active && s.track === id);
  assert.equal(voices.length, 1, 'One actual current source for ' + id);
  for (const voice of voices) {
    assert.equal(voice.sha256, spec.sha256);
    assert.equal(voice.loop, true);
    assert.equal(voice.loopStart, spec.loopStart);
    assert.ok(Math.abs(voice.loopEnd - Math.min(voice.duration, spec.loopEnd)) < 1 / 44100, 'Native loopEnd matches exact exported music');
  }
  assert.equal(state.snapshot.loopStart, spec.loopStart);
  assert.ok(Math.abs(state.snapshot.loopEnd - voices[0].loopEnd) < 1e-8);
  return voices[0];
}

try {
  browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--use-angle=metal', '--enable-webgl', '--mute-audio']});
  deadline = setTimeout(() => {report.deadlineExceeded = true; void browser.close();}, 480000);
  const context = await browser.newContext({viewport: {width: 844, height: 390}, hasTouch: true, serviceWorkers: 'block'});
  contexts.add(context);
  await context.addInitScript(instrumentNativeAudio, {knownBuffers});
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== origin) {
      report.blocked.push({url: request.url(), method: request.method(), stage: currentStage});
      return route.abort();
    }
    // Introduce latency for one real camp request to exercise cancellation.
    // Its body is never fulfilled or replaced: the genuine request is continued.
    if (url.pathname.endsWith('/assets/music/orchestra-camp.m4a') && !delayedCamp) {
      delayedCamp = true;
      await new Promise(resolve => setTimeout(resolve, 900));
    }
    await route.continue().catch(error => {if (!/closed|cancel|abort|handled/i.test(error.message)) throw error;});
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push({stage: currentStage, message: error.stack}));
  page.on('console', message => {if (message.type() === 'error') report.errors.push({stage: currentStage, message: message.text()});});
  page.on('requestfailed', request => report.requestFailures.push({url: request.url(), error: request.failure()?.errorText, stage: currentStage}));
  page.on('response', response => {
    const path = decodeURIComponent(new URL(response.url()).pathname), audio = /\/assets\/music\/[^/]+\.m4a$/.test(path);
    if (new URL(response.url()).origin !== origin || (!audio && !sourcePaths.includes(path))) return;
    const stage = currentStage;
    responseWork.push((async () => {
      const body = await response.body(), row = {path, url: response.url(), status: response.status(), bytes: body.length, sha256: sha(body), stage};
      (audio ? report.audioHTTP : report.loaded).push(row);
    })().catch(error => report.requestFailures.push({url: response.url(), stage, bodyReadFailure: error.message})));
  });
  await page.route('**/api/runtime-config', route => route.fulfill({json: {broker: '', apiUrl: ''}}));
  await page.route('**/api/scores*', route => route.fulfill({json: []}));

  currentStage = 'natural-99-entry';
  await home();
  await page.locator('#storyEntryBtn').click();
  await page.locator('[data-tower="new"]').click();
  await page.locator('#heroNameInput').fill('自然配樂驗證');
  await page.locator('[data-tower="profession"][data-item="smith"]').click();
  await page.locator('[data-tower="hero-create-start"]').click();
  await resume();
  await waitMusic('orchestra-summit');
  const natural = await checkpoint('natural-99-summit', {target: 'orchestra-summit'});
  assert.equal(natural.runtime.floor, 99);
  await assertLoops(natural, 'orchestra-summit');
  await page.locator('#towerBagBtn').click();
  const bag = await checkpoint('ordinary-bag-keeps-summit', {target: 'orchestra-summit'});
  assert.equal(bag.runtime.paused, true);
  await closeDialog();
  await leaveGame();

  currentStage = 'camp-fixture';
  await fixture('camp');
  await waitMusic('orchestra-summit');
  await page.waitForFunction(() => document.getElementById('towerTalkBtn')?.ariaLabel === '營地料理（R）');
  const cancelledBefore = await capture();
  await page.locator('#towerTalkBtn').click();
  await page.waitForFunction(() => TowerAudio.snapshot().requestIDs.includes('orchestra-camp'));
  await closeDialog();
  await page.waitForTimeout(1100);
  const cancelled = await checkpoint('camp-load-cancelled-on-dialog-close', {target: 'orchestra-summit'});
  assert.ok(!cancelled.snapshot.requestIDs.includes('orchestra-camp'));
  assert.ok(!cancelled.native.sources.some(s => s.active && s.track === 'orchestra-camp'));
  report.cancelledLoad = {before: cancelledBefore.snapshot, after: cancelled.snapshot, genuineRequestDelayedMilliseconds: 900};
  await page.locator('#towerTalkBtn').click();
  await waitMusic('orchestra-camp');
  const camp = await checkpoint('real-camp-dialog', {target: 'orchestra-camp'});
  assert.equal(camp.runtime.paused, true);
  assert.equal(await page.locator('#towerDialog').getAttribute('data-commerce'), 'camp');
  await assertLoops(camp, 'orchestra-camp');
  await page.locator('[data-tower="bag"]').click();
  await waitMusic('orchestra-summit');
  await checkpoint('camp-to-bag-restores-summit', {target: 'orchestra-summit'});
  await closeDialog();
  for (let i = 0; i < 6; i++) {
    await page.locator('#towerTalkBtn').click();
    await page.locator('[data-tower="close"]').first().click();
  }
  await settle('orchestra-summit');
  const rapid = await checkpoint('rapid-camp-dialog-switches', {target: 'orchestra-summit'});
  assert.equal(rapid.native.activeMusicCount, 1);
  assert.equal(rapid.snapshot.activeCount, 1);

  await page.locator('#actionsToggle').click();
  const volumeBefore = await capture();
  await page.locator('[data-audio-mix="music"]').press('Home');
  for (let i = 0; i < 35; i++) await page.locator('[data-audio-mix="music"]').press('ArrowRight');
  await page.waitForTimeout(450);
  const lowered = await checkpoint('music-volume-35', {target: 'orchestra-summit'});
  assert.equal(lowered.runtime.settings.music, 35);
  assert.ok(lowered.runtime.musicGain < volumeBefore.runtime.musicGain * .5);
  assert.ok(Math.abs(lowered.runtime.effectsGain - volumeBefore.runtime.effectsGain) < .002, 'Music slider leaves the effects bus alone');
  await page.locator('[data-audio-mix="music"]').press('Home');
  await page.waitForTimeout(650);
  const zero = await checkpoint('music-volume-zero', {target: 'orchestra-summit'});
  assert.equal(zero.runtime.settings.music, 0);
  assert.ok(zero.runtime.musicGain < .001);
  await page.locator('[data-audio-mix="music"]').press('End');
  await page.locator('[data-tower="battle-music"]').click();
  const disabled = await checkpoint('music-switch-off');
  assert.equal(disabled.runtime.muted, true);
  assert.equal(disabled.native.activeMusicCount, 0);
  assert.equal(disabled.snapshot.activeCount, 0);
  await page.locator('[data-tower="battle-music"]').click();
  await settle('orchestra-summit');
  await checkpoint('music-switch-on', {target: 'orchestra-summit'});
  await closeDialog();
  const beforeBackground = await capture();
  const background = await context.newPage();
  await background.goto('about:blank');
  await background.bringToFront();
  await page.waitForTimeout(700);
  const whileBackground = await capture();
  await page.bringToFront();
  await page.waitForTimeout(1200);
  const afterBackground = await checkpoint('background-and-return', {target: 'orchestra-summit'});
  await background.close();
  report.background = {before: beforeBackground.visibility, during: whileBackground.visibility, after: afterBackground.visibility,
    hiddenObserved: whileBackground.visibility === 'hidden', nativeBefore: beforeBackground.native.activeMusicCount,
    nativeDuring: whileBackground.native.activeMusicCount, nativeAfter: afterBackground.native.activeMusicCount};
  assert.ok(whileBackground.native.activeMusicCount <= 2);
  assert.equal(afterBackground.native.activeMusicCount, 1);
  if (!report.background.hiddenObserved) report.limitations.push('Headless Chrome did not expose a hidden page after activating another tab; actual background visibility was recorded without injecting a visibility event.');
  await leaveGame();

  currentStage = 'boss-fixture';
  const bossFixture = await fixture('boss');
  report.bossApproach = await approachMonster(bossFixture);
  const boss = await checkpoint('real-floor-lord-battle', {target: 'orchestra-boss'});
  const bossSource = await assertLoops(boss, 'orchestra-boss');
  assert.equal(boss.runtime.floor, 90);
  await page.locator('#towerBagBtn').click();
  await settle('orchestra-boss');
  let loopBefore = null, loopAfter = null;
  for (let polls = 0; polls < 60; polls++) {
    const state = await capture(), voice = state.native.sources.find(s => s.sourceId === bossSource.sourceId);
    assert.ok(voice?.active && voice.contextState === 'running', 'Real boss source remains active through the native loop');
    assert.equal(state.snapshot.current, 'orchestra-boss');
    const elapsed = voice.contextTime - voice.startAt;
    if (elapsed < voice.loopEnd && elapsed >= voice.loopEnd - 2) loopBefore = {elapsed, voice, snapshot: state.snapshot};
    if (elapsed > voice.loopEnd + .5) {loopAfter = {elapsed, voice, snapshot: state.snapshot}; break;}
    await page.waitForTimeout(elapsed > voice.loopEnd - 3 ? 350 : 1800);
  }
  assert.ok(loopBefore && loopAfter, 'Native context crossed one actual boss loop boundary');
  assert.equal(loopAfter.voice.sourceId, loopBefore.voice.sourceId);
  assert.equal(loopAfter.voice.loop, true);
  assert.equal(loopAfter.voice.ended, false);
  report.nativeBossLoopBoundary = {before: loopBefore, after: loopAfter, realContextTime: true, replacedClockOrSource: false};
  await checkpoint('boss-one-native-loop-completed', {target: 'orchestra-boss'});
  await closeDialog();
  await leaveGame();

  currentStage = 'ordinary-fixture';
  const ordinaryFixture = await fixture('ordinary');
  report.ordinaryApproach = await approachMonster(ordinaryFixture);
  const ordinary = await checkpoint('ordinary-monster-keeps-original-combat', {target: 'combat'});
  assert.equal(ordinary.snapshot.bossEncounter, false);
  assert.ok(ordinary.native.sources.some(s => s.active && s.track === 'combat' && s.sha256 === sha(originalCombat)));
  assert.ok(!ordinary.native.sources.some(s => s.active && s.track === 'orchestra-boss'));
  await leaveGame();

  report.regions = [];
  for (const [id,floor] of regions) {
    currentStage = 'region-' + id;
    await fixture('region', floor);
    const target = 'orchestra-' + id;
    await settle(target);
    const state = await checkpoint('region-' + id + '-natural-continue', {target});
    assert.equal(state.runtime.floor, floor);assert.equal(state.snapshot.environment, id);
    assert.ok(state.snapshot.cacheIDs.length <= 3);
    const source = await assertLoops(state, target);
    report.regions.push({id,floor,nativeSource:source,legalPublicContinue:true});
    if (id === 'garden') {
      await page.locator('#towerBagBtn').click();
      let before = null, after = null;
      for (let polls = 0; polls < 60; polls++) {
        const actual = await capture(), voice = actual.native.sources.find(s => s.sourceId === source.sourceId);
        assert.ok(voice?.active && voice.contextState === 'running');assert.equal(actual.snapshot.current,target);
        const elapsed = voice.contextTime - voice.startAt;
        if (elapsed < voice.loopEnd && elapsed >= voice.loopEnd - 2) before = {elapsed,voice};
        if (elapsed > voice.loopEnd + .5) {after = {elapsed,voice};break;}
        await page.waitForTimeout(elapsed > voice.loopEnd - 3 ? 350 : 1800);
      }
      assert.ok(before && after,'Actual three-beat region source crosses its native loop boundary');
      assert.equal(before.voice.sourceId,after.voice.sourceId);assert.equal(after.voice.ended,false);
      report.nativeRegionLoopBoundary = {id,before,after,realContextTime:true,replacedClockOrSource:false};
      await closeDialog();
    }
    await leaveGame();
    console.log('Native regional music passed: ' + id + ' at floor ' + floor);
  }

  await Promise.allSettled(responseWork);
  report.sourceHashes = sourcePaths.map(path => {
    const actual = report.loaded.filter(r => r.path === path && r.status === 200).at(-1);
    assert.ok(actual, 'Actual HTTP source was loaded: ' + path);
    assert.equal(actual.sha256, sourceHashes.get(path), 'Actual HTTP source matches the local export: ' + path);
    return {...actual, matchesLocalExport: true};
  });
  report.audioVerification = [];
  const allDecoded = report.stages.flatMap(s => s.native?.decoded || []);
  for (const [path, spec] of expected) {
    const actual = report.audioHTTP.find(r => r.path === path && r.status === 200 && r.sha256 === spec.sha256);
    assert.ok(actual, 'Actual HTTP body loaded for ' + path);
    assert.equal(actual.bytes, spec.bytes);
    const decoded = allDecoded.find(d => d.sha256 === actual.sha256);
    assert.ok(decoded, 'Same actual HTTP bytes reached native decodeAudioData: ' + path);
    assert.equal(decoded.channels, 2);
    assert.equal(decoded.sampleRate, decoded.contextSampleRate, 'Native decoding uses the actual browser context rate');
    assert.ok(Math.abs(decoded.frames - decoded.duration * decoded.sampleRate) < 1, 'Decoded frame count matches its native sample rate');
    assert.ok(Math.abs(decoded.duration - spec.loopEnd) < .12, 'Native decoded music duration is consistent with the exported loop body');
    report.audioVerification.push({id: spec.id, actualHTTP: actual, nativeDecoded: decoded, encodedSampleRate: spec.sampleRate,
      browserResampled: decoded.sampleRate !== spec.sampleRate, manifestSha256: spec.sha256, matchesLocalExport: true});
  }
  const cancellation = report.requestFailures.some(r => /orchestra-camp\.m4a/.test(r.url) && /abort|cancel/i.test(r.error || r.bodyReadFailure || ''));
  report.cancelledLoad.requestAbortObserved = cancellation;
  assert.ok(cancellation, 'Actual in-flight camp request was aborted by the controller');
  report.sockets = await page.evaluate(() => __roomAttempts);
  assert.deepEqual(report.sockets, []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.blocked, []);
  assert.ok(report.stages.every(s => !s.native || s.native.maxMusicVoices <= 2));
  report.pass = true;
} catch (error) {
  report.failure = {stage: currentStage, stack: error.stack};
  if (page) {
    await page.screenshot({path: join(out, 'failure.png')}).catch(() => {});
    report.failureState = await capture().catch(() => null);
  }
  throw error;
} finally {
  if (deadline) clearTimeout(deadline);
  await Promise.allSettled(responseWork);
  await Promise.allSettled([...contexts].map(context => context.close()));
  await browser?.close();
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({pass: !!report.pass, version, stages: report.stages.length, audio: report.audioVerification?.length || 0,
    loopObserved: !!report.nativeBossLoopBoundary, backgroundHiddenObserved: !!report.background?.hiddenObserved,
    failure: report.failure, report: join(out, 'report.json'), browserClosed: true}));
}
