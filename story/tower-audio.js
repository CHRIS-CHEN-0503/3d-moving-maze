/* Streamlined score controller using the game's existing Web Audio context. */
(function (root, factory) {
  const audio = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = audio;
  root.TowerAudio = audio;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const ENVIRONMENTS = new Set(['summoning', 'garden', 'roots', 'echo', 'library', 'mist', 'frost', 'clockwork', 'furnace', 'heart']);
  const FADE_SECONDS = 1, VOLUME = 0.78, CACHE_LIMIT = 3;
  // Formal loop files omit the audition's four-second fading room tail.
  const TRACKS = Object.freeze({
    'orchestra-summit': Object.freeze({ loopStart: 0, loopEnd: 50.526326530612245, sha256: 'd0973461fce0cf30ad55974ac59a8893877793ceb4d41fccdf6d1adde16182e2' }),
    'orchestra-boss': Object.freeze({ loopStart: 0, loopEnd: 49.41176870748299, sha256: 'f8f3a2d14f920dc9cee9f576079e3497d7fd843c7a92abc3d65bcdf20d8d9f48' }),
    'orchestra-camp': Object.freeze({ loopStart: 0, loopEnd: 49.23077097505669, sha256: '57802bd99ebf7249140cfac061f9cad5c573a1ca49e358a793cc9da03f59d72d' }),
  });
  let context = null, output = null, environment = null, encounter = false, bossEncounter = false, camp = false, paused = false, muted = false;
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

  function environmentTrack() { return environment === 'summoning' ? 'orchestra-summit' : environment; }
  function targetTrack() { return camp ? 'orchestra-camp' : bossEncounter ? 'orchestra-boss' : encounter ? 'combat' : environmentTrack(); }
  function pruneCache() {
    const allowed = new Set([environmentTrack(), 'combat', 'orchestra-boss', 'orchestra-camp']);
    for (const id of cache.keys()) if (!allowed.has(id)) cache.delete(id);
    for (const id of cache.keys()) {
      if (cache.size <= CACHE_LIMIT) break;
      if (id !== targetTrack() && id !== current?.id) cache.delete(id);
    }
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
    if (cache.has(id)) {
      const buffer = cache.get(id); cache.delete(id); cache.set(id, buffer);
      return buffer;
    }
    const controller = new root.AbortController();
    const request = { controller };
    requests.set(id, request);
    try {
      const revision = TRACKS[id] ? '?v=' + TRACKS[id].sha256.slice(0, 12) : '';
      const response = await root.fetch('assets/music/' + id + '.m4a' + revision, { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted || epoch !== requestEpoch) return null;
      const buffer = await context.decodeAudioData(bytes);
      if (controller.signal.aborted || epoch !== requestEpoch || requests.get(id) !== request) return null;
      if (id !== targetTrack()) return null;
      cache.set(id, buffer); pruneCache();
      return buffer;
    } finally {
      if (requests.get(id) === request) requests.delete(id);
    }
  }

  function play(id, buffer) {
    if (current && !current.disposed && !current.fading && current.id === id) return;
    const loop = TRACKS[id];
    if (loop && !(Number.isFinite(buffer.duration) && buffer.duration >= loop.loopEnd - .06)) throw new Error('循環音檔長度不足：' + id);
    // Only one old voice may overlap the new voice during a crossfade.
    for (const voice of [...voices]) if (voice !== current) dispose(voice);
    const previous = current;
    const source = context.createBufferSource(), gain = context.createGain();
    const voice = { id, source, gain, fading: false, disposed: false };
    source.buffer = buffer; source.loop = true;
    if (loop) {
      source.loopStart = loop.loopStart; source.loopEnd = Math.min(loop.loopEnd, buffer.duration);
    }
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
    const id = targetTrack(), requestEpoch = epoch;
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

  function setEncounter(value, boss = false) {
    const next = Boolean(value), nextBoss = next && Boolean(boss);
    if (encounter === next && bossEncounter === nextBoss) return;
    encounter = next; bossEncounter = nextBoss; transition();
  }

  function setCamp(value) {
    const next = Boolean(value);
    if (camp === next) return;
    camp = next; transition();
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
    environment = null; encounter = false; bossEncounter = false; camp = false; paused = false;
  }

  function snapshot() {
    const live = [...voices].filter(voice => !voice.disposed).map(voice => Object.freeze({
      id: voice.id, fading: voice.fading,
      loopStart: voice.source.loopStart || 0, loopEnd: voice.source.loopEnd || voice.source.buffer.duration,
    }));
    return Object.freeze({ environment, encounter, bossEncounter, camp, paused, muted,
      target: environment ? targetTrack() : null, current: current && !current.disposed ? current.id : null,
      activeCount: live.length, voices: Object.freeze(live), cacheIDs: Object.freeze([...cache.keys()]),
      requestIDs: Object.freeze([...requests.keys()]),
      expectedSha256: current && !current.disposed ? TRACKS[current.id]?.sha256 || null : null,
      loopStart: current && !current.disposed ? current.source.loopStart || 0 : null,
      loopEnd: current && !current.disposed ? current.source.loopEnd || current.source.buffer.duration : null,
    });
  }

  return Object.freeze({ configure, setEnvironment, setEncounter, setCamp, setPaused, setMuted, stop, snapshot });
});
