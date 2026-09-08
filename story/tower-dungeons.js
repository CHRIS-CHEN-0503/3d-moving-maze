/* 高塔裂隙副本：獨立亂數、可續讀進度、一次性結案與報酬。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerDungeons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const getCore = () => typeof module === 'object' && module.exports ? require('./story-core.js') : globalThis.TowerCore;
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
  function rawOffer(floor, seed) {
    if (!validFloor(floor) || !validSeed(seed) || floor > 95) return null;
    const random = randomSource(floor, seed);
    if (random() >= 0.28) return null;
    const kind = Object.keys(TYPES)[Math.floor(random() * 3)], spec = TYPES[kind];
    const id = `rift:${floor}:${seed}`, order = [0, 1, 2];
    for (let index = 2; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    const C = getCore(), enhanced = random() < 0.35;
    const gearKind = Object.keys(C.GEAR)[Math.floor(random() * Object.keys(C.GEAR).length)];
    const reward = { coins: 22 + Math.floor((99 - floor) / 10) * 3, items: enhanced ? {} : { heal: 1, ration: floor < 40 ? 2 : 1 }, gear: enhanced ? C.createGear(gearKind, floor, seed, id, true) : null };
    return { id, kind, ...spec, order, reward };
  }
  function newExpedition() { return { version: 1, discovered: false, history: [], active: null }; }
  function validateExpedition(value, floor, seed) {
    if (!validFloor(floor) || !validSeed(seed)) return null;
    if (value === undefined) return newExpedition();
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || typeof value.discovered !== 'boolean' || !Array.isArray(value.history) || value.history.length > 99) return null;
    const history = [], ids = new Set();
    for (const item of value.history) {
      if (!item || !validFloor(item.floor) || item.floor < floor || !['completed', 'abandoned', 'expired'].includes(item.outcome)) return null;
      const generated = rawOffer(item.floor, seed);
      if (!generated || generated.id !== item.id || generated.kind !== item.kind || ids.has(item.id)) return null;
      ids.add(item.id); history.push({ id: item.id, kind: item.kind, floor: item.floor, outcome: item.outcome });
    }
    const generated = rawOffer(floor, seed);
    if (value.discovered && !generated) return null;
    let active = null;
    if (value.active !== null) {
      const a = value.active, config = getCore().floorConfig(floor);
      if (!a || typeof a !== 'object' || Array.isArray(a) || !generated || !value.discovered || ids.has(a.id) || a.id !== generated.id || a.kind !== generated.kind || a.floor !== floor || !number(a.elapsed, 0, generated.timeLimit) || !number(a.mistakes, 0, 10000, true)) return null;
      if (!Array.isArray(a.progress) || a.progress.length > 3 || a.progress.some(index => !number(index, 0, 2, true)) || new Set(a.progress).size !== a.progress.length) return null;
      if (a.kind === 'bells' && a.progress.some((index, step) => generated.order[step] !== index)) return null;
      if (!a.returnCell || !number(a.returnCell.x, 0, config.size - 1, true) || !number(a.returnCell.y, 0, config.size - 1, true) || !number(a.returnShift, 0, 65)) return null;
      active = { id: a.id, kind: a.kind, floor, elapsed: a.elapsed, progress: [...a.progress], mistakes: a.mistakes, returnCell: { x: a.returnCell.x, y: a.returnCell.y }, returnShift: a.returnShift };
    }
    return { version: 1, discovered: value.discovered, history, active };
  }
  function offer(run) {
    if (!run || !validFloor(run.floor) || !validSeed(run.seed)) return null;
    const generated = rawOffer(run.floor, run.seed);
    if (!generated || run.expedition && run.expedition.history.some(entry => entry.id === generated.id)) return null;
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
      next.expedition.active = { id, kind: generated.kind, floor: next.floor, elapsed: 0, progress: [], mistakes: 0, returnCell: { x: returnPoint.x, y: returnPoint.y }, returnShift: returnPoint.shiftLeft };
      return { ok: true, message: `進入${generated.title}。`, effect: { entered: true, offer: generated } };
    });
  }
  function interact(run, index, expectedRevision) {
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
      a.progress.push(index);
      return { ok: true, message: a.progress.length === 3 ? '裂隙目標全部完成，回到出口領取報酬。' : `副本進度 ${a.progress.length} / 3。`, effect: { index, progress: [...a.progress], completed: a.progress.length === 3 } };
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
      next.expedition.history.push({ id: a.id, kind: a.kind, floor: a.floor, outcome });
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
  return Object.freeze({ TYPES, newExpedition, validateExpedition, offer, discover, enter, interact, tick, finish });
});
