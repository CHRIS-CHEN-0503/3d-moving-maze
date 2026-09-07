import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../story/tower-audio.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

function harness({ deferFetch = false, deferDecode = false, failFetch = false } = {}) {
  const fetches = [], decoded = [], sources = [], gains = [], warnings = [];
  class Parameter {
    constructor() { this.value = 0; this.events = []; }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  }
  const context = {
    currentTime: 5,
    createGain() { const gain = { gain: new Parameter(), connected: null, disconnected: false, connect(target) { this.connected = target; }, disconnect() { this.disconnected = true; } }; gains.push(gain); return gain; },
    createBufferSource() { const voice = { started: false, stopped: false, disconnected: false, stops: [], connect(target) { this.connected = target; }, start() { this.started = true; }, stop(time) { this.stops.push(time); if (time === undefined || time <= context.currentTime) this.stopped = true; }, disconnect() { this.disconnected = true; } }; sources.push(voice); return voice; },
    decodeAudioData(bytes) { const task = deferred(), item = { id: bytes.id, task }; decoded.push(item); if (!deferDecode) task.resolve({ id: bytes.id }); return task.promise; },
  };
  const output = {};
  const root = vm.createContext({ AbortController, console: { warn: (...args) => warnings.push(args) }, fetch: (url, { signal }) => {
    const task = deferred(), id = url.split('/').at(-1).replace('.m4a', ''), item = { id, url, signal, task }; fetches.push(item);
    if (!deferFetch) task.resolve({ ok: !failFetch, status: failFetch ? 404 : 200, arrayBuffer: async () => ({ id }) });
    return task.promise;
  } });
  vm.runInContext(source, root, { filename: 'tower-audio.js' });
  const audio = root.TowerAudio;
  assert.equal(audio.configure({ context, output }), true);
  const respond = item => item.task.resolve({ ok: true, status: 200, arrayBuffer: async () => ({ id: item.id }) });
  const playing = () => sources.filter(voice => voice.started && !voice.stopped).map(voice => voice.buffer.id);
  function advance(seconds) { context.currentTime += seconds; for (const voice of sources) if (!voice.stopped && voice.stops.some(time => time !== undefined && time <= context.currentTime)) { voice.stopped = true; voice.onended?.(); } }
  return { audio, context, output, fetches, decoded, sources, gains, warnings, respond, playing, advance };
}

test('rapid environment change aborts old fetch and a stale successful response cannot play', async () => {
  const h = harness({ deferFetch: true });
  h.audio.setEnvironment('summoning'); const old = h.fetches[0];
  h.audio.setEnvironment('garden'); const latest = h.fetches[1];
  assert.equal(old.signal.aborted, true);
  h.respond(latest); await flush(); assert.deepEqual(h.playing(), ['garden']);
  h.respond(old); await flush(); assert.deepEqual(h.playing(), ['garden']);
  assert.equal(h.decoded.length, 1);
});

test('already decoding stale audio is discarded after a newer environment wins', async () => {
  const h = harness({ deferDecode: true });
  h.audio.setEnvironment('summoning'); await flush();
  h.audio.setEnvironment('garden'); await flush();
  h.decoded[1].task.resolve({ id: 'garden' }); await flush();
  h.decoded[0].task.resolve({ id: 'summoning' }); await flush();
  assert.deepEqual(h.playing(), ['garden']);
  assert.equal(h.sources.length, 1);
});

test('encounter crossfades in one second and reuses only current environment plus combat cache', async () => {
  const h = harness();
  h.audio.setEnvironment('summoning'); await flush();
  assert.deepEqual(h.fetches.map(item => item.id), ['summoning'], 'Combat is not downloaded until an encounter');
  assert.equal(h.sources[0].loop, true);
  assert.equal(h.gains[0].connected, h.output);
  assert.deepEqual(h.gains[0].gain.events.at(-1), ['ramp', 0.78, 6]);
  h.audio.setEncounter(true); await flush();
  assert.deepEqual(h.playing(), ['summoning', 'combat']);
  assert.deepEqual(h.gains[0].gain.events.at(-1), ['ramp', 0, 6]);
  h.advance(1); assert.deepEqual(h.playing(), ['combat']);
  h.audio.setEncounter(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['summoning']);
  assert.equal(h.fetches.length, 2, 'Returning from combat reuses the current environment buffer');
  h.audio.setEnvironment('garden'); await flush(); h.advance(1);
  h.audio.setEncounter(true); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['combat']);
  assert.equal(h.fetches.filter(item => item.id === 'combat').length, 1, 'The combat buffer remains cached');
  h.audio.setEncounter(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['garden']);
  h.audio.setEnvironment('summoning'); await flush(); h.advance(1);
  assert.equal(h.fetches.filter(item => item.id === 'summoning').length, 2, 'Leaving an environment evicts it instead of accumulating decoded buffers');
  assert.deepEqual(h.playing(), ['summoning']);
});

test('mute stops sources and blocks loading, unmute restores the current target, pause uses 20 percent volume', async () => {
  const h = harness(); h.audio.setEnvironment('summoning'); await flush();
  h.audio.setPaused(true);
  assert.ok(Math.abs(h.gains[0].gain.events.at(-1)[1] - 0.78 * 0.2) < 1e-9);
  h.audio.setMuted(true); assert.deepEqual(h.playing(), []);
  assert.equal(h.sources[0].disconnected, true); assert.equal(h.gains[0].disconnected, true);
  h.audio.setEnvironment('garden'); h.audio.setEncounter(true); await flush();
  assert.equal(h.fetches.length, 1, 'Muted state cannot create a new music source or fetch');
  h.audio.setMuted(false); await flush(); assert.deepEqual(h.playing(), ['combat']);
  assert.ok(Math.abs(h.gains.at(-1).gain.events.at(-1)[1] - 0.78 * 0.2) < 1e-9);
  h.audio.setPaused(false); assert.equal(h.gains.at(-1).gain.events.at(-1)[1], 0.78);
});

test('stop cancels fetches, stale callbacks do not start sound, and cache is cleared', async () => {
  const loading = harness({ deferFetch: true }); loading.audio.setEnvironment('roots');
  loading.audio.stop(); assert.equal(loading.fetches[0].signal.aborted, true);
  loading.respond(loading.fetches[0]); await flush(); assert.deepEqual(loading.playing(), []);
  const h = harness(); h.audio.setEnvironment('garden'); await flush();
  h.audio.stop(); assert.deepEqual(h.playing(), []); assert.equal(h.sources[0].disconnected, true);
  h.audio.setEnvironment('garden'); await flush();
  assert.equal(h.fetches.length, 2, 'Stopping releases previously decoded audio');
});

test('a missing audio file warns once without throwing or starting a source', async () => {
  const h = harness({ failFetch: true }); h.audio.setEnvironment('garden'); await flush();
  h.audio.setEncounter(true); await flush(); h.audio.setEncounter(false); await flush();
  assert.equal(h.warnings.filter(args => args[0].endsWith('garden')).length, 1);
  assert.deepEqual(h.playing(), []);
});
