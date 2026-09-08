/* 高塔裂隙副本：獨立亂數、可續讀進度、一次性結案與報酬。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerDungeons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const getCore = () => typeof module === 'object' && module.exports ? require('./story-core.js') : globalThis.TowerCore;
  const getStories = () => typeof module === 'object' && module.exports ? require('./tower-side-stories.js') : globalThis.TowerSideStories;
  const CATALOG_VERSION = 2;
  const TYPES = Object.freeze({
    archive: Object.freeze({ title: '無聲信庫', description: '被高塔遺忘的信件仍在等待收信人。穿過移動書架，帶回三封未寄出的家書。', objective: '找回三封家書，順序不限。', size: 7, timeLimit: 150, shiftSeconds: 30 }),
    bells: Object.freeze({ title: '逆時鐘室', description: '鐘擺向後擺動，三枚符印維繫著裂隙。依照門上的順序敲響它們；錯誤會觸發陷阱。', objective: '依照提示順序敲響三枚符印。', size: 7, timeLimit: 120, shiftSeconds: 24 }),
    lantern: Object.freeze({ title: '餘燼渡廊', description: '最後一段歸途沉在暗影裡。迷宮即將封閉，點亮三盞守路燈，讓迷失的人看見回家的方向。', objective: '點亮三盞守路燈，順序不限。', size: 9, timeLimit: 90, shiftSeconds: 20 }),
  });
  const number = (value, low, high, integer = false) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high && (!integer || Number.isInteger(value));
  const validFloor = floor => number(floor, 1, 99, true);
  const validSeed = seed => number(seed, 1, 0xffffffff, true);
  function randomSource(floor, seed) {
    let value = (seed ^ Math.imul(floor, 0x7f4a7c15) ^ 0x49fc2397) >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(value ^ value >>> 15, value | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }
  function rawOffer(floor, seed, catalogVersion = CATALOG_VERSION) {
    if (!validFloor(floor) || !validSeed(seed) || floor > 95) return null;
    const random = randomSource(floor, seed);
    if (random() >= 0.28) return null;
    // Version 1 keeps its original pool, draw count, order, rewards and geometry seed.
    const stories = catalogVersion === 2 ? getStories() : null;
    if (catalogVersion === 2 && !stories) return null;
    const pool = [...Object.entries(TYPES).map(([kind, spec]) => ({ kind, ...spec })), ...(stories ? stories.eligible(floor) : [])];
    const spec = pool[Math.floor(random() * pool.length)], kind = spec.kind;
    const id = `rift:${floor}:${seed}`, order = [0, 1, 2];
    for (let index = 2; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    if (spec.orderMode === 'seeded-tail') order.splice(0, 3, 0, ...order.filter(index => index !== 0));
    const C = getCore(), enhanced = random() < 0.35;
    const gearKind = Object.keys(C.GEAR)[Math.floor(random() * Object.keys(C.GEAR).length)];
    const reward = { coins: 22 + Math.floor((99 - floor) / 10) * 3, items: enhanced ? {} : { heal: 1, ration: floor < 40 ? 2 : 1 }, gear: enhanced ? C.createGear(gearKind, floor, seed, id, true) : null };
    // Do not add fields to a v1 offer; saved v1 sessions remain byte-for-byte stable.
    if (catalogVersion === 1) return { id, kind, ...TYPES[kind], order, reward };
    return { id, kind, ...spec, order, reward, catalogVersion };
  }
  function newExpedition(version = CATALOG_VERSION) { return { version, discovered: false, history: [], active: null }; }
  function catalogVersion(value) { return value === undefined ? 1 : value; }
  function maxObservedShifts(active, generated) { return Math.floor((active.elapsed + 0.25) / generated.shiftSeconds); }
  function validateExpedition(value, floor, seed) {
    if (!validFloor(floor) || !validSeed(seed)) return null;
    if (value === undefined) return newExpedition(1);
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, 2].includes(value.version) || typeof value.discovered !== 'boolean' || !Array.isArray(value.history) || value.history.length > 99) return null;
    const history = [], ids = new Set();
    for (const item of value.history) {
      if (!item || !validFloor(item.floor) || item.floor < floor || !['completed', 'abandoned', 'expired'].includes(item.outcome)) return null;
      const version = catalogVersion(item.catalogVersion);
      if (![1, 2].includes(version) || version > value.version || item.floor === floor && version !== value.version) return null;
      const generated = rawOffer(item.floor, seed, version);
      if (!generated || generated.id !== item.id || generated.kind !== item.kind || ids.has(item.id)) return null;
      ids.add(item.id); history.push({ id: item.id, kind: item.kind, floor: item.floor, outcome: item.outcome, ...(version === 2 ? { catalogVersion: version } : {}) });
    }
    const generated = rawOffer(floor, seed, value.version);
    if (value.discovered && !generated) return null;
    let active = null;
    if (value.active !== null) {
      const a = value.active, config = getCore().floorConfig(floor);
      if (!a || typeof a !== 'object' || Array.isArray(a) || !generated || !value.discovered || ids.has(a.id) || a.id !== generated.id || a.kind !== generated.kind || a.floor !== floor || !number(a.elapsed, 0, generated.timeLimit) || !number(a.mistakes, 0, 10000, true)) return null;
      if (catalogVersion(a.catalogVersion) !== value.version) return null;
      if (!Array.isArray(a.progress) || a.progress.length > 3 || a.progress.some(index => !number(index, 0, 2, true)) || new Set(a.progress).size !== a.progress.length) return null;
      if (['bells', 'threads', 'stars'].includes(a.kind) && a.progress.some((index, step) => generated.order[step] !== index)) return null;
      if (['repair', 'evidence'].includes(generated.mechanic) && a.progress.includes(2) && (a.progress.length !== 3 || a.progress[2] !== 2)) return null;
      if (a.kind === 'stars') {
        if (!number(a.shiftCount, 0, maxObservedShifts(a, generated), true) || !(a.shiftAtStart === null || number(a.shiftAtStart, 0, a.shiftCount, true))) return null;
        if ((a.progress.length === 0) !== (a.shiftAtStart === null) || a.progress.length > 1 && a.shiftCount <= a.shiftAtStart) return null;
      }
      if (!a.returnCell || !number(a.returnCell.x, 0, config.size - 1, true) || !number(a.returnCell.y, 0, config.size - 1, true) || !number(a.returnShift, 0, 65)) return null;
      active = { id: a.id, kind: a.kind, floor, elapsed: a.elapsed, progress: [...a.progress], mistakes: a.mistakes, returnCell: { x: a.returnCell.x, y: a.returnCell.y }, returnShift: a.returnShift, ...(value.version === 2 ? { catalogVersion: 2 } : {}), ...(a.kind === 'stars' ? { shiftCount: a.shiftCount, shiftAtStart: a.shiftAtStart } : {}) };
    }
    return { version: value.version, discovered: value.discovered, history, active };
  }
  function offer(run) {
    if (!run || !validFloor(run.floor) || !validSeed(run.seed)) return null;
    const version = run.expedition ? run.expedition.version : CATALOG_VERSION;
    if (![1, 2].includes(version)) return null;
    const generated = rawOffer(run.floor, run.seed, version);
    if (!generated || run.expedition && (!Array.isArray(run.expedition.history) || run.expedition.history.some(entry => entry.id === generated.id))) return null;
    return generated;
  }
  function discover(run) {
    return getCore().transaction(run, undefined, next => {
      const generated = offer(next);
      if (!generated) return { ok: false, message: '這一層沒有尚未探索的裂隙。' };
      if (next.expedition.discovered) return { ok: false, message: '已經發現這道裂隙。' };
      next.expedition.discovered = true;
      return { ok: true, message: `發現裂隙：${generated.title}。`, effect: { discovered: true, id: generated.id } };
    });
  }
  function enter(run, id, returnPoint, expectedRevision) {
    return getCore().transaction(run, expectedRevision, next => {
      const generated = offer(next), config = getCore().floorConfig(next.floor);
      if (!generated || generated.id !== id || !next.expedition.discovered || next.expedition.active) return { ok: false, message: '目前無法進入這道裂隙。' };
      if (!returnPoint || !number(returnPoint.x, 0, config.size - 1, true) || !number(returnPoint.y, 0, config.size - 1, true) || !number(returnPoint.shiftLeft, 0, 65)) return { ok: false, message: '無效的返回位置。' };
      next.expedition.active = { id, kind: generated.kind, floor: next.floor, elapsed: 0, progress: [], mistakes: 0, returnCell: { x: returnPoint.x, y: returnPoint.y }, returnShift: returnPoint.shiftLeft, ...(next.expedition.version === 2 ? { catalogVersion: 2 } : {}), ...(generated.kind === 'stars' ? { shiftCount: 0, shiftAtStart: null } : {}) };
      return { ok: true, message: `進入${generated.title}。`, effect: { entered: true, offer: generated } };
    });
  }
  function interact(run, index, expectedRevision, details) {
    return getCore().transaction(run, expectedRevision, next => {
      const a = next.expedition.active, generated = offer(next);
      if (!a || !generated || a.elapsed >= generated.timeLimit || !number(index, 0, 2, true)) return { ok: false, message: '目前無法啟動這個副本目標。' };
      if (a.progress.length === 3) return { ok: false, message: '目標已完成，請返回裂隙出口。' };
      if (a.kind === 'bells' && generated.order[a.progress.length] !== index) {
        a.progress = []; a.mistakes = Math.min(10000, a.mistakes + 1);
        const damage = getCore().applyDamage(next, 8, 'trap');
        return { ...damage, message: '符印順序錯誤！鐘聲引發陷阱，進度已重設。', effect: { ...damage.effect, wrongOrder: true, progress: [], completed: false } };
      }
      if (a.progress.includes(index)) return { ok: false, message: '這個目標已經完成。' };
      const step = generated.steps && generated.steps[index];
      if (a.kind === 'stars' && a.progress.length > 0 && a.shiftCount <= a.shiftAtStart) return { ok: false, message: '觀星儀已啟動，請先等迷宮完成一次變形，再辨認移動後的星路。' };
      if (['repair', 'evidence'].includes(generated.mechanic) && index === 2 && (!a.progress.includes(0) || !a.progress.includes(1))) return { ok: false, message: '請先完成前兩個線索目標，再回來做最後的決定。' };
      const wrongOrder = ['threads', 'stars'].includes(a.kind) && generated.order[a.progress.length] !== index;
      const needsChoice = !!(step && step.options);
      if (needsChoice && (!details || !number(details.choice, 0, step.options.length - 1, true))) return { ok: false, message: '請先選擇一個答案。' };
      const wrongChoice = needsChoice && details.choice !== step.correctChoice;
      if (wrongOrder || wrongChoice) {
        if (a.kind === 'threads') a.progress = [];
        a.mistakes = Math.min(10000, a.mistakes + 1);
        const damage = getCore().applyDamage(next, 5, 'trap');
        return { ...damage, message: step && step.failure || '線索尚未接起來。陷阱被觸動，請重新確認提示。', effect: { ...damage.effect, wrongOrder, wrongChoice, progress: [...a.progress], completed: false } };
      }
      a.progress.push(index);
      if (a.kind === 'stars' && index === 0) a.shiftAtStart = a.shiftCount;
      return { ok: true, message: a.progress.length === 3 ? '裂隙目標全部完成，回到出口領取報酬。' : step && step.success || `副本進度 ${a.progress.length} / 3。`, effect: { index, progress: [...a.progress], completed: a.progress.length === 3 } };
    });
  }
  function observeShift(run) {
    return getCore().transaction(run, undefined, next => {
      const a = next.expedition.active, generated = offer(next);
      if (!a || a.kind !== 'stars' || !generated || a.elapsed >= generated.timeLimit || a.shiftCount >= maxObservedShifts(a, generated)) return { ok: false, message: '目前沒有新的星路變形可記錄。' };
      a.shiftCount += 1;
      return { ok: true, message: a.shiftAtStart !== null && a.shiftCount > a.shiftAtStart ? '牆壁已移動，新的星路可以辨認了。' : '', effect: { shiftObserved: true, shiftCount: a.shiftCount } };
    });
  }
  function tick(run, seconds) {
    return getCore().transaction(run, undefined, next => {
      const a = next.expedition.active, generated = offer(next);
      if (!a || !generated || !number(seconds, 0, 60)) return { ok: false, message: '無效的副本時間更新。' };
      a.elapsed = Math.min(generated.timeLimit, a.elapsed + seconds);
      const expired = a.elapsed >= generated.timeLimit;
      return { ok: true, message: expired ? '裂隙即將封閉，這次探索已到時限。' : '', effect: { expired, remaining: Math.max(0, generated.timeLimit - a.elapsed) } };
    });
  }
  function finish(run, outcome, expectedRevision) {
    const C = getCore();
    const settle = next => {
      const a = next.expedition.active, generated = offer(next);
      if (!a || !generated || !['completed', 'abandoned', 'expired'].includes(outcome)) return { ok: false, message: '沒有可結案的副本。' };
      if (outcome === 'expired' && a.elapsed < generated.timeLimit) return { ok: false, message: '副本尚未到時限。' };
      if (outcome === 'completed' && (next.status !== 'playing' || a.progress.length !== 3 || a.elapsed >= generated.timeLimit)) return { ok: false, message: '尚未在時限內完成副本目標。' };
      if (next.expedition.history.length >= 99) return { ok: false, message: '副本歷史紀錄已滿。' };
      const reward = outcome === 'completed' ? generated.reward : null;
      if (reward) {
        if (next.coins + reward.coins > 999999 || Object.entries(reward.items).some(([id, count]) => next.bag[id] + count > 99)) return { ok: false, message: '補給或銅幣已滿，請整理背包後領取；副本尚未結案。' };
        if (reward.gear) { const granted = C.receiveGear(next, reward.gear); if (!granted.ok) return granted; }
        next.coins += reward.coins;
        for (const [id, count] of Object.entries(reward.items)) next.bag[id] += count;
      }
      const effect = { outcome, returnCell: { ...a.returnCell }, returnShift: a.returnShift, reward };
      next.expedition.history.push({ id: a.id, kind: a.kind, floor: a.floor, outcome, ...(next.expedition.version === 2 ? { catalogVersion: 2 } : {}) });
      next.expedition.active = null;
      return { ok: true, message: outcome === 'completed' ? `${generated.title}探索完成，報酬已收下。` : '返回原本樓層，這道裂隙已經關閉。', effect };
    };
    if (run && run.status === 'dead') {
      const next = C.validateSave(run);
      if (!next || expectedRevision !== undefined && expectedRevision !== next.revision || outcome === 'completed') return { ok: false, run, message: '這次探索已中止，無法領取完成報酬。' };
      const result = settle(next);
      if (!result.ok) return { ...result, run };
      next.revision += 1;
      return { ...result, run: next };
    }
    return C.transaction(run, expectedRevision, settle);
  }
  return Object.freeze({ TYPES, CATALOG_VERSION, newExpedition, validateExpedition, offer, discover, enter, interact, observeShift, tick, finish });
});
