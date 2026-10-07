import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), A = require('../assets/combat-audio.js');
const towerSource = readFileSync(new URL('../story/tower-audio.js', import.meta.url), 'utf8');
const combatSource = readFileSync(new URL('../assets/combat-audio.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

// ---------------------------------------------------------------- orchestral cache

function harness({ deferDecode = false, coarse, configure: extra = {} } = {}) {
  const fetches = [], decoded = [], sources = [], gains = [];
  class Parameter {
    constructor() { this.value = 0; this.events = []; }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  }
  function makeContext() {
    const context = {
      currentTime: 5,
      createGain() { const gain = { gain: new Parameter(), disconnect() { this.disconnected = true; }, connect(target) { this.connected = target; } }; gains.push(gain); return gain; },
      createBufferSource() { const voice = { started: false, stopped: false, stops: [], connect() {}, start() { this.started = true; }, stop(time) { this.stops.push(time); if (time === undefined || time <= context.currentTime) this.stopped = true; }, disconnect() { this.disconnected = true; } }; sources.push(voice); return voice; },
      decodeAudioData(bytes) { const task = deferred(); decoded.push({ id: bytes.id, task }); if (!deferDecode) task.resolve({ id: bytes.id, duration: 70 }); return task.promise; },
    };
    return context;
  }
  const context = makeContext(), output = {};
  const globals = { AbortController, console: { warn() {} }, fetch: (url) => {
    const id = new URL(url, 'https://maze-audio.test/').pathname.split('/').at(-1).replace('.m4a', '');
    fetches.push(id);
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => ({ id }) });
  } };
  if (coarse !== undefined) globals.matchMedia = query => ({ matches: coarse && query === '(pointer:coarse)' });
  const root = vm.createContext(globals);
  vm.runInContext(towerSource, root, { filename: 'tower-audio.js' });
  const audio = root.TowerAudio;
  assert.equal(audio.configure({ context, output, ...extra }), true);
  const playing = () => sources.filter(voice => voice.started && !voice.stopped).map(voice => voice.buffer.id);
  const advance = seconds => { context.currentTime += seconds; for (const voice of sources) if (!voice.stopped && voice.stops.some(time => time !== undefined && time <= context.currentTime)) { voice.stopped = true; voice.onended?.(); } };
  return { audio, context, output, fetches, decoded, sources, gains, playing, advance, makeContext };
}

test('decoded cache cap: three by default, two under a coarse pointer, and an injected flag overrides detection', () => {
  assert.equal(harness().audio.snapshot().cacheLimit, 3);
  assert.equal(harness({ coarse: false }).audio.snapshot().cacheLimit, 3);
  assert.equal(harness({ coarse: true }).audio.snapshot().cacheLimit, 2);
  assert.equal(harness({ coarse: true, configure: { lowMemory: false } }).audio.snapshot().cacheLimit, 3);
  assert.equal(harness({ coarse: false, configure: { lowMemory: true } }).audio.snapshot().cacheLimit, 2);
  assert.equal(harness({ configure: { lowMemory: true } }).audio.snapshot().cacheLimit, 2);
});

test('with a coarse pointer no more than two buffers stay decoded, the target and current voice are protected, and two voices remain the ceiling', async () => {
  const h = harness({ coarse: true }); h.audio.setEnvironment('summoning'); await flush();
  for (const apply of [() => h.audio.setEncounter(true), () => h.audio.setEncounter(true, true),
    () => h.audio.setCamp(true), () => h.audio.setCamp(false), () => h.audio.setEncounter(false),
    () => h.audio.setEnvironment('library'), () => h.audio.setEncounter(true), () => h.audio.setCamp(true)]) {
    apply(); await flush(); h.advance(1);
    const state = h.audio.snapshot();
    assert.ok(state.cacheIDs.length <= 2, state.cacheIDs.join());
    assert.ok(state.cacheIDs.includes(state.target), 'the target stays cached');
    assert.equal(state.current, state.target);
    assert.ok(h.playing().length <= 2); assert.equal(state.activeCount, h.playing().length);
  }
});

test('the lower cap trades one extra download for memory: desktop returns to its environment from cache, a coarse pointer fetches it again', async () => {
  const run = async options => {
    const h = harness(options); h.audio.setEnvironment('summoning'); await flush();
    h.audio.setEncounter(true); await flush(); h.advance(1);
    h.audio.setEncounter(true, true); await flush(); h.advance(1);
    const before = h.fetches.length;
    h.audio.setEncounter(false); await flush(); h.advance(1);
    assert.deepEqual(h.playing(), ['orchestra-summit']);
    return h.fetches.length - before;
  };
  assert.equal(await run({}), 0);
  assert.equal(await run({ coarse: true }), 1);
});

test('a decode that finishes after the scene moved on is kept for combat instead of being discarded', async () => {
  const h = harness({ deferDecode: true }); h.audio.setEnvironment('garden'); await flush();
  h.decoded[0].task.resolve({ id: 'orchestra-garden', duration: 70 }); await flush();
  h.audio.setEncounter(true); await flush(); const combat = h.decoded.at(-1); assert.equal(combat.id, 'combat');
  h.audio.setEncounter(false); await flush();
  assert.equal(h.audio.snapshot().target, 'orchestra-garden');
  combat.task.resolve({ id: 'combat', duration: 70 }); await flush();
  assert.deepEqual([...h.audio.snapshot().cacheIDs].sort(), ['combat', 'orchestra-garden']);
  assert.deepEqual(h.playing(), ['orchestra-garden'], 'A kept late buffer does not start a voice');
  assert.equal(h.sources.length, 1);
  const fetches = h.fetches.length, decodes = h.decoded.length;
  h.audio.setEncounter(true); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['combat']);
  assert.equal(h.fetches.length, fetches, 'Combat starts from the retained buffer without another download');
  assert.equal(h.decoded.length, decodes, 'and without another decode');
});

test('a late decode of the current environment is kept, so returning from combat needs no download', async () => {
  const h = harness({ deferDecode: true }); h.audio.setEnvironment('summoning'); await flush();
  const summit = h.decoded[0]; h.audio.setEncounter(true); await flush(); const combat = h.decoded.at(-1);
  assert.equal(h.fetches.filter(id => id === 'orchestra-summit').length, 1);
  summit.task.resolve({ id: 'orchestra-summit', duration: 70 }); await flush();
  assert.deepEqual([...h.audio.snapshot().cacheIDs], ['orchestra-summit']);
  assert.deepEqual(h.playing(), [], 'The late environment buffer does not play while combat is the target');
  combat.task.resolve({ id: 'combat', duration: 70 }); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['combat']);
  const fetches = h.fetches.length;
  h.audio.setEncounter(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['orchestra-summit']);
  assert.equal(h.fetches.length, fetches);
});

test('a kept late buffer still obeys the coarse cap and never evicts the target', async () => {
  const h = harness({ deferDecode: true, coarse: true }); h.audio.setEnvironment('garden'); await flush();
  h.decoded[0].task.resolve({ id: 'orchestra-garden', duration: 70 }); await flush();
  h.audio.setEncounter(true); await flush(); const combat = h.decoded.at(-1); h.audio.setEncounter(false); await flush();
  combat.task.resolve({ id: 'combat', duration: 70 }); await flush();
  assert.deepEqual([...h.audio.snapshot().cacheIDs].sort(), ['combat', 'orchestra-garden']);
  h.audio.setCamp(true); await flush(); h.decoded.at(-1).task.resolve({ id: 'orchestra-camp', duration: 70 }); await flush(); h.advance(1);
  const state = h.audio.snapshot();
  assert.equal(state.current, 'orchestra-camp'); assert.ok(state.cacheIDs.length <= 2); assert.ok(state.cacheIDs.includes('orchestra-camp'));
});

test('late decodes that no longer belong to the scene are still dropped: old environment, after stop, or on a replaced context', async () => {
  const old = harness({ deferDecode: true }); old.audio.setEnvironment('garden'); await flush();
  old.audio.setEnvironment('roots'); await flush();
  old.decoded[0].task.resolve({ id: 'orchestra-garden', duration: 70 }); await flush();
  assert.deepEqual([...old.audio.snapshot().cacheIDs], []); assert.deepEqual(old.playing(), []);

  const stopped = harness({ deferDecode: true }); stopped.audio.setEnvironment('garden'); await flush();
  stopped.audio.setEncounter(true); await flush(); stopped.audio.stop();
  for (const item of stopped.decoded) item.task.resolve({ id: item.id, duration: 70 });
  await flush();
  assert.deepEqual([...stopped.audio.snapshot().cacheIDs], []); assert.deepEqual(stopped.playing(), []);

  const replaced = harness({ deferDecode: true }); replaced.audio.setEnvironment('garden'); await flush();
  replaced.audio.setEncounter(true); await flush();
  assert.equal(replaced.audio.configure({ context: replaced.makeContext(), output: {} }), true);
  for (const item of replaced.decoded) item.task.resolve({ id: item.id, duration: 70 });
  await flush();
  assert.ok(!replaced.audio.snapshot().cacheIDs.includes('combat'), 'A buffer decoded by the previous context is not reused');
  assert.ok(!replaced.audio.snapshot().cacheIDs.includes('orchestra-garden'));
});

// ---------------------------------------------------------------- combat audio

// Reference fingerprints (sample count, RMS, mean |x|) of the pre-optimisation renderer.
const GOLDEN = {
  'slash': [6615, 0.134531, 0.089527], 'bow': [5513, 0.128267, 0.061313], 'metal': [5292, 0.090543, 0.048962],
  'magic': [10584, 0.181438, 0.12768], 'frost': [9923, 0.127837, 0.077756], 'heal': [12128, 0.165081, 0.102334],
  'shield': [8820, 0.19751, 0.13742], 'scan': [8820, 0.188645, 0.132314], 'smoke': [7056, 0.124946, 0.081155],
  'cook': [9923, 0.124872, 0.083944], 'forge': [9261, 0.077391, 0.034112], 'device': [8379, 0.060383, 0.025056],
  'drink': [7056, 0.101903, 0.06044], 'burst': [10584, 0.097616, 0.05315], 'thunder': [17640, 0.117056, 0.06851],
  'thorns': [14333, 0.132312, 0.088811], 'meteor': [16538, 0.08595, 0.050538], 'equip': [4410, 0.081611, 0.042563],
  'hit-metal': [5513, 0.080021, 0.037772], 'hit-magic': [7056, 0.140483, 0.09646], 'robot': [13230, 0.079496, 0.042151],
  'robot-impact': [11025, 0.097842, 0.046558], 'robot-drive': [15435, 0.132172, 0.089182], 'swing': [5292, 0.180001, 0.121185],
  'hit': [4410, 0.106608, 0.058399], 'hurt': [6615, 0.107173, 0.061202], 'block': [6174, 0.065592, 0.031518],
  'defeat': [12128, 0.072081, 0.042666],
};
const fingerprint = data => { let squares = 0, magnitude = 0; for (const value of data) { squares += value * value; magnitude += Math.abs(value); } return [data.length, Math.sqrt(squares / data.length), magnitude / data.length]; };

test('hoisting the helpers and cheaper powers leave every other waveform unchanged', () => {
  for (const [kind, [length, rms, magnitude]] of Object.entries(GOLDEN)) {
    const [n, r, m] = fingerprint(A.render(kind));
    assert.equal(n, length, kind); assert.ok(Math.abs(r - rms) < 1e-5, kind + ' RMS ' + r); assert.ok(Math.abs(m - magnitude) < 1e-5, kind + ' mean |x| ' + m);
  }
});

test('sample loops create no closures: tone and pulse are built once per sound', () => {
  assert.equal((combatSource.match(/\btone=/g) || []).length, 1); assert.equal((combatSource.match(/\bpulse=/g) || []).length, 1);
  let loops = 0;
  for (const marker of ['for(let i=0;i<data.length;i++){', 'for(let i=0;i<length;i++){']) {
    let from = 0;
    while ((from = combatSource.indexOf(marker, from)) !== -1) {
      let depth = 1, at = from + marker.length; const body = at;
      while (depth > 0) { const ch = combatSource[at++]; if (ch === '{') depth++; else if (ch === '}') depth--; }
      const text = combatSource.slice(body, at); loops++;
      assert.doesNotMatch(text, /=>|\bfunction\b/, 'a per-sample closure was reintroduced');
      from = at;
    }
  }
  assert.equal(loops, 3, 'the action, charge and legacy synthesis loops were inspected');
});

function countingModule() {
  const context = vm.createContext({}); vm.runInContext(combatSource, context, { filename: 'combat-audio.js' });
  const math = vm.runInContext('Math', context), original = math.sin; let calls = 0;
  math.sin = value => { calls++; return original(value); };
  return { audio: context.CombatAudio, calls: () => calls };
}

// The original charge renderer, kept as the reference: every length must still sweep 110 -> 480 Hz exactly as before.
function legacyCharge(seconds) {
  const duration = Number.isFinite(seconds) && seconds > 0 ? Math.min(4, Math.max(.1, Math.round(seconds * 10) / 10)) : .65;
  const data = new Float32Array(Math.round(22050 * duration)); let seed = 9143, low = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / 22050, p = i / (data.length - 1), tau = Math.PI * 2;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = seed / 2147483648 - 1; low += .08 * (n - low);
    const attack = Math.min(1, t / .004), tail = Math.pow(1 - p, 1.35), tone = f => Math.sin(tau * f * t);
    const sample = (Math.sin(tau * (110 * t + 185 * t * t / duration)) * .29 + tone(330) * .09 + low * .42) * Math.pow(p, .65) * (1 + .08 * Math.sin(tau * 6 * t));
    data[i] = sample * attack * tail;
  }
  const delay = Math.round(22050 * .037); let peak = 0;
  for (let i = data.length - 1; i >= 0; i--) { if (i >= delay) data[i] += data[i - delay] * .1 * (1 - i / data.length); peak = Math.max(peak, Math.abs(data[i])); }
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= .64 / peak;
  data[0] = data[data.length - 1] = 0; return data;
}

test('every charge length matches the original formula to better than 1e-6', () => {
  const lengths = [undefined, NaN, 0, -1, ...Array.from({ length: 40 }, (_, k) => (k + 1) / 10)];
  let worst = 0;
  for (const seconds of lengths) {
    const data = A.render('charge', seconds), reference = legacyCharge(seconds);
    assert.equal(data.length, reference.length, String(seconds));
    for (let i = 0; i < data.length; i++) worst = Math.max(worst, Math.abs(data[i] - reference[i]));
  }
  assert.ok(worst < 1e-6, 'max abs difference ' + worst);
});

test('a charge length is synthesized only the first time a player needs it, without a second sample cache', () => {
  const { audio, calls } = countingModule(), buffers = [];
  const context = { currentTime: 1, createBuffer(channels, length) { const data = new Float32Array(length); buffers.push(length); return { length, getChannelData: () => data }; },
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }, createBufferSource() { return { connect() {}, start() {}, stop() {}, disconnect() {} }; } };
  const player = audio.create(context, {});
  player.play('charge', 1.2); const first = calls();
  assert.ok(first > A.RATE * 1.2, 'the first request evaluates the oscillators');
  for (const seconds of [1.2, 1.24, 1.16]) { context.currentTime += .1; player.play('charge', seconds); }
  assert.equal(calls(), first, 'the same length, even spelled differently, reuses the player buffer');assert.equal(buffers.length, 1);
  context.currentTime += .1; player.play('charge', 1.6); assert.ok(calls() > first, 'a new length is synthesized'); assert.equal(buffers.length, 2);
  player.stop();
  assert.doesNotMatch(combatSource, /const charges=new Map\(\)/, 'no module-level copy of the samples');
  const copy = audio.render('charge', 1.2); copy.fill(0);
  assert.ok(audio.render('charge', 1.2).some(value => value !== 0), 'direct callers always receive their own samples');
});

function playbackContext() {
  const buffers = [], sources = [];
  return { buffers, sources, context: { currentTime: 1,
    createBuffer(channels, length, rate) { const data = new Float32Array(length), buffer = { channels, length, rate, data, getChannelData: () => data }; buffers.push(buffer); return buffer; },
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; },
    createBufferSource() { const source = { connect() {}, start(...args) { this.args = args; }, stop() {}, disconnect() { this.disconnected = true; } }; sources.push(source); return source; } } };
}

test('each distinct charge length becomes its own buffer of exactly that length', () => {
  const h = playbackContext(), player = A.create(h.context, {});
  for (const seconds of [.7, 1.2, 1.6]) { h.context.currentTime += .1; player.play('charge', seconds); }
  assert.deepEqual(h.buffers.map(buffer => buffer.length), [.7, 1.2, 1.6].map(seconds => Math.round(A.RATE * seconds)));
  assert.ok(h.sources.every(source => source.args.length === 0), 'each buffer is played whole');
  h.context.currentTime += .1; player.play('charge', 1.2); assert.equal(h.buffers.length, 3, 'a repeated length reuses its buffer');
  player.stop();
});

// ---------------------------------------------------------------- idle warm-up

function idleScheduler() {
  const pending = []; const idle = callback => { pending.push(callback); return pending.length; };
  return { idle, pending, run(timeRemaining) { const callback = pending.shift(); callback({ timeRemaining: () => timeRemaining(), didTimeout: false }); } };
}

test('common sounds are warmed in idle slices only, never synchronously and only while time remains', () => {
  const h = playbackContext(), scheduler = idleScheduler(), player = A.create(h.context, {}, { idle: scheduler.idle });
  assert.equal(scheduler.pending.length, 1); assert.equal(h.buffers.length, 0, 'creating the player synthesizes nothing');
  scheduler.run(() => 1); assert.equal(h.buffers.length, 0, 'a slice that is too short does no work');
  assert.equal(scheduler.pending.length, 1, 'and asks to be called again');
  let budget = 2; scheduler.run(() => (budget-- > 0 ? 10 : 0));
  assert.equal(h.buffers.length, 2); assert.equal(scheduler.pending.length, 1);
  while (scheduler.pending.length) scheduler.run(() => 10);
  const warmed = h.buffers.length; assert.ok(warmed >= 12, 'warmed ' + warmed);
  for (const seconds of [.5, .7, .8, .9, 1, 1.2, 1.6]) assert.ok(h.buffers.some(buffer => buffer.length === Math.round(A.RATE * seconds)), 'in-game charge length ' + seconds);
  assert.equal(h.sources.length, 0, 'warming never creates a voice');
  for (const kind of ['swing', 'hit', 'slash', 'heal']) { h.context.currentTime += .1; player.play(kind); }
  for (const seconds of [.5, .9, 1.6]) { h.context.currentTime += .1; player.play('charge', seconds); }
  assert.equal(h.buffers.length, warmed, 'a warmed sound is played without synthesis');
  h.context.currentTime += .1; player.play('thunder'); assert.equal(h.buffers.length, warmed + 1, 'others are still created on first use');
  player.stop();
});

test('warming a sound that was already played is a no-op and the four-voice limit and merge window are unchanged', () => {
  const h = playbackContext(), scheduler = idleScheduler(), player = A.create(h.context, {}, { idle: scheduler.idle });
  const reference = playbackContext(), referenceScheduler = idleScheduler(); A.create(reference.context, {}, { idle: referenceScheduler.idle });
  while (referenceScheduler.pending.length) referenceScheduler.run(() => 10);
  player.play('swing'); const swing = h.buffers[0]; player.play('swing'); assert.equal(h.sources.length, 1, 'the 65 ms merge window still applies');
  while (scheduler.pending.length) scheduler.run(() => 10);
  assert.equal(h.buffers.length, reference.buffers.length, 'swing is not rebuilt by the warm-up');
  assert.equal(h.buffers[0], swing);
  for (const kind of ['hit', 'slash', 'bow', 'magic', 'metal']) { h.context.currentTime += .1; player.play(kind); }
  assert.equal(h.sources.length, 6);
  assert.equal(h.sources.filter(source => !source.disconnected).length, 4, 'at most four sources stay connected');
  player.stop();
});

test('without requestIdleCallback nothing is scheduled and the existing lazy behaviour applies', () => {
  assert.equal(typeof globalThis.requestIdleCallback, 'undefined');
  const h = playbackContext(), player = A.create(h.context, {});
  assert.equal(h.buffers.length, 0); player.play('hit'); assert.equal(h.buffers.length, 1); player.stop();
});
