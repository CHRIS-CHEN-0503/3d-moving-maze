import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/classic-audio.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

function harness({ deferredFetch = false, failFetch = false } = {}) {
  const fetches = [], sources = [], gains = [], warnings = [];
  const context = {
    state: 'suspended', currentTime: 4, resumeCalls: 0,
    resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); },
    decodeAudioData(bytes) { return Promise.resolve({ id: bytes.id }); },
    createGain() { const gain = { gain: { setValueAtTime(value, time) { gain.value = value; gain.time = time; } }, connect(target) { gain.target = target; }, disconnect() { gain.disconnected = true; } }; gains.push(gain); return gain; },
    createBufferSource() { const sourceNode = { started: false, stopped: false, connect(target) { this.target = target; }, disconnect() { this.disconnected = true; }, start() { this.started = true; }, stop() { this.stopped = true; } }; sources.push(sourceNode); return sourceNode; },
  };
  const root = vm.createContext({ AbortController, console: { warn: (...args) => warnings.push(args) }, fetch: (url, { signal }) => {
    const id = url.split('/').at(-1).replace('.m4a', ''), task = deferred();
    const item = { id, url, signal, task }; fetches.push(item);
    signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; task.reject(error); }, { once: true });
    if (!deferredFetch) task.resolve({ ok: !failFetch, status: failFetch ? 404 : 200, arrayBuffer: async () => ({ id }) });
    return task.promise;
  } });
  vm.runInContext(source, root, { filename: 'classic-audio.js' });
  const audio = root.ClassicAudio, output = {};
  assert.equal(audio.configure({ context, output }), true);
  return { audio, context, output, fetches, sources, gains, warnings };
}

test('六個迷宮環境與搶購賣場都有不同的完整配樂檔', () => {
  const h = harness();
  assert.deepEqual([...h.audio.tracks], ['summoning', 'garden', 'echo', 'roots', 'mist', 'furnace', 'clockwork']);
  for (const id of h.audio.tracks) {
    const file = new URL('../assets/music/' + id + '.m4a', import.meta.url);
    assert.ok(statSync(file).size > 100000, id + ' 配樂檔不存在或內容異常');
  }
  const levelMusic = [...html.matchAll(/\bmusic:(\d),\s*\n?\s*wallTex:/g)].map(match => Number(match[1]));
  assert.deepEqual(levelMusic, [0, 1, 2, 3, 4, 5, 6], '六個關卡與賣場必須逐一對應七首曲目');
  assert.match(html, /<script src="assets\/classic-audio\.js"><\/script>/, '首頁沒有載入一般版配樂控制器');
});

test('開始一般版時解鎖音訊、延遲載入目前曲目並循環播放', async () => {
  const h = harness();
  const result = h.audio.play(3); await flush();
  assert.equal(await result, true);
  assert.equal(h.context.resumeCalls, 1);
  assert.deepEqual(h.fetches.map(item => item.id), ['roots']);
  assert.equal(h.sources[0].buffer.id, 'roots');
  assert.equal(h.sources[0].loop, true);
  assert.equal(h.sources[0].started, true);
  assert.equal(h.gains[0].value, 0.9);
  assert.equal(h.gains[0].target, h.output);
});

test('快速切換環境會取消舊下載，只播放最後選定的曲目', async () => {
  const h = harness({ deferredFetch: true });
  const oldPlay = h.audio.play(0), old = h.fetches[0];
  const newPlay = h.audio.play(5), latest = h.fetches[1];
  assert.equal(old.signal.aborted, true);
  latest.task.resolve({ ok: true, status: 200, arrayBuffer: async () => ({ id: latest.id }) });
  await flush();
  assert.equal(await newPlay, true);
  assert.deepEqual(h.sources.filter(node => node.started).map(node => node.buffer.id), ['furnace']);
  assert.equal(await oldPlay, false);
});

test('音檔無法載入時回報失敗，交由遊戲切換合成配樂備援', async () => {
  const h = harness({ failFetch: true });
  assert.equal(await h.audio.play(2), false); await flush();
  assert.equal(h.sources.length, 0);
  assert.equal(h.warnings.length, 1);
});
