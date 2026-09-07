/* Streamlined score controller using the game's existing Web Audio context. */
(function (root, factory) {
  const audio = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = audio;
  root.TowerAudio = audio;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const ENVIRONMENTS = new Set(['summoning', 'garden', 'roots', 'echo', 'library', 'mist', 'frost', 'clockwork', 'furnace', 'heart']);
  const FADE_SECONDS = 1, VOLUME = 0.78;
  let context = null, output = null, environment = null, encounter = false, paused = false, muted = false;
  let epoch = 0, current = null;
  const cache = new Map(), requests = new Map(), voices = new Set(), warned = new Set();

  function warnOnce(id, error) {
    if (warned.has(id)) return;
    warned.add(id);
    if (root.console && typeof root.console.warn === 'function') root.console.warn('高塔音樂無法載入：' + id, error && error.message ? error.message : error);
  }

  function dispose(voice) {
    if (!voice || voice.disposed) return;
    voice.disposed = true;
    voice.source.onended = null;
    try { voice.source.stop(); } catch (_) { /* A source may already have ended. */ }
    try { voice.source.disconnect(); } catch (_) { /* Disconnected by the host. */ }
    try { voice.gain.disconnect(); } catch (_) { /* Disconnected by the host. */ }
    voices.delete(voice);
    if (current === voice) current = null;
  }

  function cancelRequests() {
    epoch += 1;
    for (const request of requests.values()) request.controller.abort();
    requests.clear();
  }

  function pruneCache() {
    for (const id of cache.keys()) if (id !== environment && id !== 'combat') cache.delete(id);
  }

  function ramp(voice, target) {
    if (voice.disposed) return;
    const parameter = voice.gain.gain, now = context.currentTime;
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
    else { const value = parameter.value; parameter.cancelScheduledValues(now); parameter.setValueAtTime(value, now); }
    parameter.linearRampToValueAtTime(target, now + FADE_SECONDS);
  }

  function fadeOut(voice) {
    if (!voice || voice.disposed || voice.fading) return;
    voice.fading = true;
    ramp(voice, 0);
    try { voice.source.stop(context.currentTime + FADE_SECONDS); } catch (_) { dispose(voice); }
  }

  function silence() {
    for (const voice of [...voices]) dispose(voice);
    current = null;
  }

  async function load(id, requestEpoch) {
    if (cache.has(id)) return cache.get(id);
    const controller = new root.AbortController();
    const request = { controller };
    requests.set(id, request);
    try {
      const response = await root.fetch('assets/music/' + id + '.m4a', { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted || epoch !== requestEpoch) return null;
      const buffer = await context.decodeAudioData(bytes);
      if (controller.signal.aborted || epoch !== requestEpoch || requests.get(id) !== request) return null;
      if (id !== environment && id !== 'combat') return null;
      pruneCache(); cache.set(id, buffer);
      return buffer;
    } finally {
      if (requests.get(id) === request) requests.delete(id);
    }
  }

  function play(id, buffer) {
    if (current && !current.disposed && !current.fading && current.id === id) return;
    // Only one old voice may overlap the new voice during a crossfade.
    for (const voice of [...voices]) if (voice !== current) dispose(voice);
    const previous = current;
    const source = context.createBufferSource(), gain = context.createGain();
    const voice = { id, source, gain, fading: false, disposed: false };
    source.buffer = buffer; source.loop = true;
    gain.gain.setValueAtTime(0, context.currentTime);
    source.connect(gain); gain.connect(output);
    source.onended = () => dispose(voice);
    voices.add(voice); current = voice;
    try {
      source.start();
      ramp(voice, VOLUME * (paused ? 0.2 : 1));
      fadeOut(previous);
    } catch (error) {
      dispose(voice); current = previous && !previous.disposed ? previous : null;
      throw error;
    }
  }

  function transition() {
    cancelRequests(); pruneCache();
    if (!context || !output || !environment || muted) return;
    const id = encounter ? 'combat' : environment, requestEpoch = epoch;
    if (current && !current.disposed && !current.fading && current.id === id) return;
    load(id, requestEpoch).then(buffer => {
      if (!buffer || epoch !== requestEpoch || muted || !environment) return;
      play(id, buffer);
    }).catch(error => {
      if (epoch !== requestEpoch || muted || (error && error.name === 'AbortError')) return;
      warnOnce(id, error);
      fadeOut(current);
    });
  }

  function configure(options) {
    if (!options || !options.context || !options.output || typeof options.context.createBufferSource !== 'function' || typeof options.context.createGain !== 'function' || typeof options.context.decodeAudioData !== 'function') {
      warnOnce('configuration', new Error('需要遊戲既有的音訊 context 與 output。'));
      return false;
    }
    if (context === options.context && output === options.output) return true;
    cancelRequests(); silence(); cache.clear();
    context = options.context; output = options.output;
    transition(); return true;
  }

  function setEnvironment(id) {
    if (!ENVIRONMENTS.has(id)) { warnOnce('environment:' + id, new Error('未知的環境音樂。')); return; }
    if (environment === id) return;
    environment = id; transition();
  }

  function setEncounter(value) {
    const next = Boolean(value);
    if (encounter === next) return;
    encounter = next; transition();
  }

  function setPaused(value) {
    const next = Boolean(value);
    if (paused === next) return;
    paused = next;
    if (current && !muted && !current.fading) ramp(current, VOLUME * (paused ? 0.2 : 1));
  }

  function setMuted(value) {
    const next = Boolean(value);
    if (muted === next) return;
    muted = next;
    if (muted) { cancelRequests(); silence(); }
    else transition();
  }

  function stop() {
    cancelRequests(); silence(); cache.clear();
    environment = null; encounter = false; paused = false;
  }

  return Object.freeze({ configure, setEnvironment, setEncounter, setPaused, setMuted, stop });
});
