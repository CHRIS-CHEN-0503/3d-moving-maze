import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../story/tower-audio.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

function harness({ deferFetch = false, deferDecode = false, failFetch = false, bufferDuration = 70 } = {}) {
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
    decodeAudioData(bytes) { const task = deferred(), item = { id: bytes.id, task }; decoded.push(item); if (!deferDecode) task.resolve({ id: bytes.id, duration: bufferDuration }); return task.promise; },
  };
  const output = {};
  const root = vm.createContext({ AbortController, console: { warn: (...args) => warnings.push(args) }, fetch: (url, { signal }) => {
    const task = deferred(), id = new URL(url,'https://maze-audio.test/').pathname.split('/').at(-1).replace('.m4a', ''), item = { id, url, signal, task }; fetches.push(item);
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

test('orchestral requests use actual recording revisions; ordinary combat URL remains unchanged', async()=>{
  const h=harness(),manifest=JSON.parse(readFileSync(new URL('../assets/music/orchestra-manifest.json',import.meta.url),'utf8'));
  h.audio.setEnvironment('summoning');await flush();h.audio.setCamp(true);await flush();h.audio.setCamp(false);h.audio.setEncounter(true,true);await flush();h.audio.setEncounter(true,false);await flush();
  for(const track of manifest.tracks){const request=h.fetches.find(row=>row.id==='orchestra-'+track.id);assert.ok(request);assert.equal(request.url,'assets/music/orchestra-'+track.id+'.m4a?v='+track.sha256.slice(0,12));}
  assert.equal(h.fetches.find(row=>row.id==='combat').url,'assets/music/combat.m4a');
});

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
  assert.deepEqual(h.fetches.map(item => item.id), ['orchestra-summit'], 'Combat is not downloaded until an encounter');
  assert.equal(h.sources[0].loop, true);
  assert.equal(h.gains[0].connected, h.output);
  assert.deepEqual(h.gains[0].gain.events.at(-1), ['ramp', 0.78, 6]);
  h.audio.setEncounter(true); await flush();
  assert.deepEqual(h.playing(), ['orchestra-summit', 'combat']);
  assert.deepEqual(h.gains[0].gain.events.at(-1), ['ramp', 0, 6]);
  h.advance(1); assert.deepEqual(h.playing(), ['combat']);
  h.audio.setEncounter(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['orchestra-summit']);
  assert.equal(h.fetches.length, 2, 'Returning from combat reuses the current environment buffer');
  h.audio.setEnvironment('garden'); await flush(); h.advance(1);
  h.audio.setEncounter(true); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['combat']);
  assert.equal(h.fetches.filter(item => item.id === 'combat').length, 1, 'The combat buffer remains cached');
  h.audio.setEncounter(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['garden']);
  h.audio.setEnvironment('summoning'); await flush(); h.advance(1);
  assert.equal(h.fetches.filter(item => item.id === 'orchestra-summit').length, 2, 'Leaving an environment evicts it instead of accumulating decoded buffers');
  assert.deepEqual(h.playing(), ['orchestra-summit']);
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

test('summoning lazily selects the authored summit loop on the existing context and output', async () => {
  const h = harness();
  assert.equal(h.fetches.length, 0);
  h.audio.setEnvironment('summoning'); await flush();
  const manifest = JSON.parse(readFileSync(new URL('../assets/music/orchestra-manifest.json', import.meta.url), 'utf8'));
  assert.equal(h.fetches[0].url, 'assets/music/orchestra-summit.m4a?v=' + manifest.tracks.find(t=>t.id==='summit').sha256.slice(0,12));
  assert.equal(h.sources[0].loopStart, 0);
  assert.equal(h.sources[0].loopEnd, 50.526326530612245);
  assert.equal(h.gains[0].connected, h.output);
  const state = h.audio.snapshot();
  assert.equal(state.environment, 'summoning'); assert.equal(state.target, 'orchestra-summit');
  assert.equal(state.current, 'orchestra-summit'); assert.equal(state.activeCount, h.playing().length);
  assert.deepEqual([...state.cacheIDs], ['orchestra-summit']);
  assert.equal(state.loopEnd, h.sources[0].loopEnd);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.voices) && Object.isFrozen(state.voices[0]) && Object.isFrozen(state.cacheIDs));
  assert.ok(!('buffer' in state.voices[0]) && !('source' in state.voices[0]));
});

test('ordinary combat never selects boss music, lord engagement does, and rapid changes never exceed two voices', async () => {
  const h = harness(); h.audio.setEnvironment('garden'); await flush();
  h.audio.setEncounter(true); await flush();
  assert.equal(h.audio.snapshot().target, 'combat');
  assert.equal(h.fetches.some(item => item.id === 'orchestra-boss'), false);
  h.audio.setEncounter(true, true); await flush();
  assert.equal(h.audio.snapshot().current, 'orchestra-boss');
  assert.equal(h.sources.at(-1).loopEnd, 49.41176870748299);
  assert.ok(h.playing().length <= 2); assert.equal(h.audio.snapshot().activeCount, h.playing().length);
  h.audio.setEncounter(true, false); await flush();
  assert.equal(h.audio.snapshot().current, 'combat'); assert.ok(h.playing().length <= 2);
  h.audio.setEncounter(false, true); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['garden'], 'An inactive encounter cannot select boss music');
});

test('a camp service overrides encounter music and closes back to the correct live encounter', async () => {
  const h = harness(); h.audio.setEnvironment('summoning'); await flush();
  h.audio.setEncounter(true, true); await flush(); h.advance(1);
  h.audio.setPaused(true); h.audio.setCamp(true); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['orchestra-camp']);
  assert.equal(h.sources.at(-1).loopEnd, 49.23077097505669);
  assert.ok(Math.abs(h.gains.at(-1).gain.events.at(-1)[1] - .78 * .2) < 1e-9);
  h.audio.setCamp(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['orchestra-boss']);
  h.audio.setEncounter(true, false); await flush(); h.advance(1);
  h.audio.setCamp(true); await flush(); h.advance(1);
  h.audio.setCamp(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['combat']);
  h.audio.setEncounter(false); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['orchestra-summit']);
});

test('pause alone changes volume without selecting a camp or fetching another track', async () => {
  const h = harness(); h.audio.setEnvironment('roots'); await flush();
  h.audio.setPaused(true); await flush();
  assert.deepEqual(h.playing(), ['roots']); assert.equal(h.fetches.length, 1);
  assert.equal(h.audio.snapshot().camp, false); assert.equal(h.audio.snapshot().target, 'roots');
});

test('decoded cache remains capped at three buffers across environment, combat, boss, and camp', async () => {
  const h = harness(); h.audio.setEnvironment('summoning'); await flush();
  for (const apply of [() => h.audio.setEncounter(true), () => h.audio.setEncounter(true, true),
    () => h.audio.setCamp(true), () => h.audio.setCamp(false), () => h.audio.setEncounter(false),
    () => h.audio.setEnvironment('library'), () => h.audio.setEncounter(true), () => h.audio.setCamp(true)]) {
    apply(); await flush(); h.advance(1);
    assert.ok(h.audio.snapshot().cacheIDs.length <= 3);
    assert.equal(h.audio.snapshot().activeCount, h.playing().length);
    assert.equal(h.audio.snapshot().current, h.audio.snapshot().target);
  }
  assert.ok(!h.audio.snapshot().cacheIDs.includes('orchestra-summit'), 'An obsolete environment is evicted');
  h.audio.stop(); assert.deepEqual([...h.audio.snapshot().cacheIDs], []);
});

test('camp closing aborts its pending request and a late success cannot replace the boss track', async () => {
  const h = harness({ deferFetch: true }); h.audio.setEnvironment('summoning');
  h.audio.setEncounter(true, true); const boss = h.fetches.at(-1);
  h.audio.setCamp(true); const camp = h.fetches.at(-1);
  assert.equal(boss.signal.aborted, true);
  h.audio.setCamp(false); const latest = h.fetches.at(-1);
  assert.equal(camp.signal.aborted, true);
  h.respond(latest); await flush(); h.respond(camp); await flush(); h.respond(boss); await flush();
  assert.deepEqual(h.playing(), ['orchestra-boss']); assert.equal(h.decoded.length, 1);
});

test('stale camp decode is discarded when a newer boss target wins', async () => {
  const h = harness({ deferDecode: true }); h.audio.setEnvironment('garden'); await flush();
  h.decoded[0].task.resolve({ id: 'garden', duration: 70 }); await flush();
  h.audio.setCamp(true); await flush(); const camp = h.decoded.at(-1);
  h.audio.setEncounter(true, true); h.audio.setCamp(false); await flush();
  const boss = h.decoded.at(-1); assert.equal(boss.id, 'orchestra-boss');
  boss.task.resolve({ id: 'orchestra-boss', duration: 70 }); await flush();
  camp.task.resolve({ id: 'orchestra-camp', duration: 70 }); await flush(); h.advance(1);
  assert.deepEqual(h.playing(), ['orchestra-boss']);
  assert.equal(h.audio.snapshot().cacheIDs.includes('orchestra-camp'), false);
});

test('mute blocks camp loading, restores its current target, and stop clears special scene state', async () => {
  const h = harness(); h.audio.setEnvironment('garden'); await flush(); h.audio.setMuted(true);
  h.audio.setEncounter(true, true); h.audio.setCamp(true); await flush();
  assert.equal(h.fetches.length, 1); assert.deepEqual(h.playing(), []);
  h.audio.setMuted(false); await flush(); assert.deepEqual(h.playing(), ['orchestra-camp']);
  h.audio.stop(); const state = h.audio.snapshot();
  assert.equal(state.camp, false); assert.equal(state.bossEncounter, false);
  assert.equal(state.current, null); assert.equal(state.target, null); assert.equal(state.activeCount, 0);
  assert.deepEqual([...state.requestIDs], []); assert.deepEqual([...state.cacheIDs], []);
});

test('AAC loop metadata clamps to decoded duration and a substantially truncated file cannot start', async () => {
  const h = harness({ bufferDuration: 49.22 }); h.audio.setEnvironment('garden'); await flush();
  h.audio.setCamp(true); await flush(); assert.equal(h.sources.at(-1).loopEnd, 49.22);
  const short = harness({ bufferDuration: 10 }); short.audio.setEnvironment('summoning'); await flush();
  assert.deepEqual(short.playing(), []); assert.equal(short.warnings.length, 1);
  assert.equal(short.audio.snapshot().activeCount, 0);
});
