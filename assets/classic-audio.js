/* 一般版關卡配樂：沿用高塔已生成的原創音軌，依需要只載入目前環境。 */
(function (root, factory) {
  const audio = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = audio;
  root.ClassicAudio = audio;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const TRACKS = Object.freeze([
    'summoning', // 神祕城堡
    'garden',    // 陽光草原
    'echo',      // 幽暗山洞
    'roots',     // 綠色森林
    'mist',      // 迷霧沼澤
    'furnace',   // 火山熔岩
    'clockwork', // 搶購賣場
  ]);
  const VOLUME = 0.9;
  let context = null, output = null, target = null, current = null;
  let epoch = 0, request = null;
  const cache = new Map(), warned = new Set();

  function warnOnce(id, error) {
    if (warned.has(id)) return;
    warned.add(id);
    if (root.console && typeof root.console.warn === 'function') root.console.warn('一般版配樂無法載入：' + id, error && error.message ? error.message : error);
  }

  function dispose() {
    if (!current) return;
    current.source.onended = null;
    try { current.source.stop(); } catch (_) { /* 音源可能已停止。 */ }
    try { current.source.disconnect(); } catch (_) { /* 音源可能已斷線。 */ }
    try { current.gain.disconnect(); } catch (_) { /* 音量節點可能已斷線。 */ }
    current = null;
  }

  function cancel() {
    epoch += 1;
    if (request) request.controller.abort();
    request = null;
  }

  function configure(options) {
    if (!options || !options.context || !options.output || typeof options.context.createBufferSource !== 'function' || typeof options.context.createGain !== 'function' || typeof options.context.decodeAudioData !== 'function') return false;
    if (context === options.context && output === options.output) return true;
    cancel(); dispose(); cache.clear();
    context = options.context; output = options.output;
    return true;
  }

  async function load(id, requestEpoch) {
    if (cache.has(id)) return cache.get(id);
    const controller = new root.AbortController();
    request = { id, controller };
    const response = await root.fetch('assets/music/' + id + '.m4a', { signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const bytes = await response.arrayBuffer();
    if (controller.signal.aborted || requestEpoch !== epoch) return null;
    const buffer = await context.decodeAudioData(bytes);
    if (controller.signal.aborted || requestEpoch !== epoch || !request || request.id !== id) return null;
    cache.clear(); cache.set(id, buffer);
    request = null;
    return buffer;
  }

  async function play(index) {
    const id = TRACKS[index];
    if (!id || !context || !output) return false;
    cancel(); target = id;
    if (current && current.id === id) return true;
    const requestEpoch = epoch;
    // 必須在點擊事件仍有效時立刻要求解鎖；檔案下載完成後才建立循環音源。
    const ready = context.state === 'suspended' && typeof context.resume === 'function' ? context.resume() : Promise.resolve();
    try {
      const [buffer] = await Promise.all([load(id, requestEpoch), ready]);
      if (!buffer || requestEpoch !== epoch || target !== id) return false;
      dispose();
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.setValueAtTime(VOLUME, context.currentTime);
      source.connect(gain); gain.connect(output);
      source.start(); current = { id, source, gain };
      source.onended = () => { if (current && current.source === source) current = null; };
      return true;
    } catch (error) {
      if (requestEpoch !== epoch || (error && error.name === 'AbortError')) return false;
      request = null; warnOnce(id, error); return false;
    }
  }

  function stop() {
    target = null; cancel(); dispose();
  }

  return Object.freeze({ configure, play, stop, tracks: TRACKS });
});
