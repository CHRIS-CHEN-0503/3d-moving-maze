/* Streamlined score controller using the game's existing Web Audio context. */
(function (root, factory) {
  const audio = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = audio;
  root.TowerAudio = audio;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const ENVIRONMENTS = new Set(['summoning', 'garden', 'roots', 'echo', 'library', 'mist', 'frost', 'clockwork', 'furnace', 'heart',
    'underworld-roots', 'underworld-mist', 'underworld-library', 'underworld-furnace', 'underworld-heart']);
  // A decoded loop is about 20 MB; touch devices keep one fewer to stay clear of the tab memory ceiling.
  const FADE_SECONDS = 1, VOLUME = 0.78, CACHE_LIMIT = 3, COARSE_CACHE_LIMIT = 2;
  // Formal loop files omit the audition's four-second fading room tail.
  const TRACKS = Object.freeze({
    'orchestra-summit': Object.freeze({ loopStart: 0, loopEnd: 50.526326530612245, sha256: 'd0973461fce0cf30ad55974ac59a8893877793ceb4d41fccdf6d1adde16182e2' }),
    'orchestra-boss': Object.freeze({ loopStart: 0, loopEnd: 49.41176870748299, sha256: 'f8f3a2d14f920dc9cee9f576079e3497d7fd843c7a92abc3d65bcdf20d8d9f48' }),
    'orchestra-camp': Object.freeze({ loopStart: 0, loopEnd: 49.23077097505669, sha256: '57802bd99ebf7249140cfac061f9cad5c573a1ca49e358a793cc9da03f59d72d' }),
    'orchestra-garden': Object.freeze({ loopStart: 0, loopEnd: 48.46154195011338, sha256: 'e08c7f485c5380a81f075dba25e4df48bb6672622978b88c3ab1699ecdbdfbba' }),
    'orchestra-roots': Object.freeze({ loopStart: 0, loopEnd: 45, sha256: '33f96b5a039b47ea038d8fb47d8ad575a035fbd2c6d55d0eaad6182008edd42b' }),
    'orchestra-echo': Object.freeze({ loopStart: 0, loopEnd: 48, sha256: '88f5f41caf034379bf2c7e761660827939819780bf50a8653b932f9473d7e15c' }),
    'orchestra-library': Object.freeze({ loopStart: 0, loopEnd: 50.869569160997735, sha256: '8ae2622134b9a23ee989f0c75bc6c2d9d223d0a67b1e39172bfc1fdf951547a5' }),
    'orchestra-mist': Object.freeze({ loopStart: 0, loopEnd: 46.45160997732426, sha256: '75a768e35902c104acd453901c55ddcc55e0829f5758d8a8c87c40136eafcb54' }),
    'orchestra-frost': Object.freeze({ loopStart: 0, loopEnd: 43.636371882086166, sha256: '448de2133b4ccc62ca7d768528458fb6d26618d5e4d2b5d7d4a1e2b958336a32' }),
    'orchestra-clockwork': Object.freeze({ loopStart: 0, loopEnd: 48.75, sha256: '3094da23a2ca8fdc97b8b4ecd21b89800a83278516690c046abcf75212c1400c' }),
    'orchestra-furnace': Object.freeze({ loopStart: 0, loopEnd: 47.61904761904762, sha256: 'b09fc236206cc5101570a797ef8433e213f4f3794c862875316e8abd6ba4c473' }),
    'orchestra-heart': Object.freeze({ loopStart: 0, loopEnd: 45.714285714285715, sha256: 'f1821f2c47a6f7bd5309e6c1fa89c95028bed8e9cbdd26d69181cf4e4f7a2c30' }),
    'orchestra-underworld-roots': Object.freeze({ loopStart: 0, loopEnd: 48, sha256: '183d180bbf0471ff0991d26d2568be880d006e1b869a1b3e2124b48a03b895c8' }),
    'orchestra-underworld-mist': Object.freeze({ loopStart: 0, loopEnd: 52.5, sha256: '1e70a863f92df22c345076d68e4086fc80d6fe8771887e0148faa046b7a8bf78' }),
    'orchestra-underworld-library': Object.freeze({ loopStart: 0, loopEnd: 44.44444444444444, sha256: 'ee61bce1171c79893d3f1325494a8af00cea6a8b782a5c212e01883b6f64b281' }),
    'orchestra-underworld-furnace': Object.freeze({ loopStart: 0, loopEnd: 49.09090702947846, sha256: 'b853b15cba8d3239608d91a22c05c43c73a57232f634f2e8f26f2997ba41a6ae' }),
    'orchestra-underworld-heart': Object.freeze({ loopStart: 0, loopEnd: 46.666666666666664, sha256: '2249005f037a64f9bdd460f2dc8d42ec11c82e2d0b1e7cbace67ebe277e3fc48' }),
  });
  let context = null, output = null, environment = null, encounter = false, bossEncounter = false, camp = false, paused = false, muted = false;
  let epoch = 0, current = null, lowMemory = false;
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

  function environmentTrack() { return environment === 'summoning' ? 'orchestra-summit' : 'orchestra-' + environment; }
  function targetTrack() { return camp ? 'orchestra-camp' : bossEncounter ? 'orchestra-boss' : encounter ? 'combat' : environmentTrack(); }
  function cacheLimit() { return lowMemory ? COARSE_CACHE_LIMIT : CACHE_LIMIT; }
  function pruneCache() {
    const allowed = new Set([environmentTrack(), 'combat', 'orchestra-boss', 'orchestra-camp']);
    for (const id of cache.keys()) if (!allowed.has(id)) cache.delete(id);
    for (const id of cache.keys()) {
      if (cache.size <= cacheLimit()) break;
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
    const decoder = context, controller = new root.AbortController();
    const request = { controller };
    requests.set(id, request);
    try {
      const revision = TRACKS[id] ? '?v=' + TRACKS[id].sha256.slice(0, 12) : '';
      const response = await root.fetch('assets/music/' + id + '.m4a' + revision, { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted || epoch !== requestEpoch) return null;
      const buffer = await decoder.decodeAudioData(bytes);
      const wanted = !controller.signal.aborted && epoch === requestEpoch && requests.get(id) === request && id === targetTrack();
      // Decoding cannot be cancelled. When the scene moved on while it ran, keep the buffer for the
      // tracks that recur (the current environment and ordinary combat) instead of downloading it again.
      const recurring = decoder === context && environment !== null && (id === 'combat' || id === environmentTrack());
      if (!wanted && !recurring) return null;
      cache.set(id, buffer); pruneCache();
      return wanted ? buffer : null;
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
    lowMemory = typeof options.lowMemory === 'boolean' ? options.lowMemory
      : Boolean(typeof root.matchMedia === 'function' && root.matchMedia('(pointer:coarse)').matches);
    if (context === options.context && output === options.output) return true;
    cancelRequests(); silence(); cache.clear();
    context = options.context; output = options.output;
    transition(); return true;
  }

  function setEnvironment(id, underworld = false) {
    if (!ENVIRONMENTS.has(id)) { warnOnce('environment:' + id, new Error('未知的環境音樂。')); return; }
    // Underground areas deliberately have separate recordings. Side instances
    // without an underground counterpart retain their matching surface theme.
    const next = underworld === true && ENVIRONMENTS.has('underworld-' + id) ? 'underworld-' + id : id;
    if (environment === next) return;
    environment = next; transition();
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
      activeCount: live.length, voices: Object.freeze(live), cacheIDs: Object.freeze([...cache.keys()]), cacheLimit: cacheLimit(),
      requestIDs: Object.freeze([...requests.keys()]),
      expectedSha256: current && !current.disposed ? TRACKS[current.id]?.sha256 || null : null,
      loopStart: current && !current.disposed ? current.source.loopStart || 0 : null,
      loopEnd: current && !current.disposed ? current.source.loopEnd || current.source.buffer.duration : null,
    });
  }

  return Object.freeze({ configure, setEnvironment, setEncounter, setCamp, setPaused, setMuted, stop, snapshot });
});
