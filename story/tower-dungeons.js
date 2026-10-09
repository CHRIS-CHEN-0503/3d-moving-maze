/* 高塔裂隙副本：獨立亂數、可續讀進度、一次性結案與報酬。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerDungeons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const getCore = () => typeof module === 'object' && module.exports ? require('./story-core.js') : globalThis.TowerCore;
  const getStories = () => typeof module === 'object' && module.exports ? require('./tower-side-stories.js') : globalThis.TowerSideStories;
  const CATALOG_VERSION = 4;
  const SHIFT_INTERVAL_BONUS = 10;
  const TYPES = Object.freeze({
    archive: Object.freeze({ title: '無聲信庫', description: '被高塔遺忘的信件仍在等待收信人。穿過移動書架，帶回三封未寄出的家書。', objective: '找回三封家書，順序不限。', size: 7, timeLimit: 150, shiftSeconds: 30 }),
    bells: Object.freeze({ title: '逆時鐘室', description: '鐘擺向後擺動，三枚符印維繫著裂隙。依照門上的順序敲響它們；錯誤會觸發陷阱。', objective: '依照提示順序敲響三枚符印。', size: 7, timeLimit: 120, shiftSeconds: 24 }),
    lantern: Object.freeze({ title: '餘燼渡廊', description: '最後一段歸途沉在暗影裡。迷宮即將封閉，點亮三盞守路燈，讓迷失的人看見回家的方向。', objective: '點亮三盞守路燈，順序不限。', size: 9, timeLimit: 90, shiftSeconds: 20 }),
  });
  const number = (value, low, high, integer = false) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high && (!integer || Number.isInteger(value));
  const towerFloor = floor => number(floor, 1, 99, true);
  const validFloor = floor => towerFloor(floor) || number(floor, -50, -1, true);
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
  // 每個存檔種子只有一張固定行程表：讀檔、跳過裂隙都不能重抽。
  // 優先輪到尚未出現的種類，並避開最近兩次；新解鎖的故事先補進輪替。
  let planSeed = null, plan = null;
  function varietyPlan(seed) {
    if (seed === planSeed) return plan;
    const result = {}, counts = {}, recent = [];
    for (let floor = 95; floor >= 1; floor--) {
      const random = randomSource(floor, seed);
      if (random() >= .28) continue;
      const pool = [...Object.entries(TYPES).map(([kind, spec]) => ({kind, ...spec})), ...getStories().eligible(floor)];
      const available = pool.filter(spec => !recent.includes(spec.kind));
      const least = Math.min(...available.map(spec => counts[spec.kind] || 0));
      const candidates = available.filter(spec => (counts[spec.kind] || 0) === least);
      const selected = candidates[Math.floor(random() * candidates.length)];
      result[floor] = selected; counts[selected.kind] = (counts[selected.kind] || 0) + 1;
      recent.push(selected.kind); if (recent.length > 2) recent.shift();
    }
    planSeed = seed; plan = result; return result;
  }
  function difficulty(floor, spec) {
    const tier = Math.min(5, 1 + Math.floor((99 - floor) / 20));
    const size = spec.size + (tier >= 3 ? 2 : 0);
    return { tier, size, trapCount: tier, mistakeDamage: 5 + (tier - 1) * 2,
      timeLimit: Math.round(spec.timeLimit * (size / spec.size) ** 2 * (1 - (tier - 1) * .04)),
      shiftSeconds: Math.max(14, Math.round(spec.shiftSeconds * (1 - (tier - 1) * .08))) };
  }
  function rawOffer(floor, seed, catalogVersion = CATALOG_VERSION) {
    // Underground chapters have their own main-line journey. The old tower
    // rifts stay in their original catalogue; never index its plan at -1.
    if (!towerFloor(floor) || !validSeed(seed) || floor > 95) return null;
    const random = randomSource(floor, seed);
    if (random() >= 0.28) return null;
    // Version 1 keeps its original pool, draw count, order, rewards and geometry seed.
    const stories = catalogVersion >= 2 ? getStories() : null;
    if (catalogVersion >= 2 && !stories) return null;
    const pool = [...Object.entries(TYPES).map(([kind, spec]) => ({ kind, ...spec })), ...(stories ? stories.eligible(floor) : [])];
    const draw = random();
    const spec = catalogVersion >= 3 ? varietyPlan(seed)[floor] : pool[Math.floor(draw * pool.length)], kind = spec.kind;
    const id = `rift:${floor}:${seed}`, order = [0, 1, 2];
    for (let index = 2; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    if (spec.orderMode === 'seeded-tail') order.splice(0, 3, 0, ...order.filter(index => index !== 0));
    const C = getCore(), enhanced = random() < 0.35;
    const legacyKinds=['helmet','armor','shield','bat','pan','staff'];
    const gearKind = legacyKinds[Math.floor(random() * legacyKinds.length)];
    const reward = { coins: 22 + Math.floor((99 - floor) / 10) * 3, items: enhanced ? {} : { heal: 1, ration: floor < 40 ? 2 : 1 }, gear: enhanced ? C.createGear(gearKind, floor, seed, id, true) : null };
    // Do not add fields to a v1 offer; saved v1 sessions remain byte-for-byte stable.
    if (catalogVersion === 1) return { id, kind, ...TYPES[kind], order, reward };
    if (catalogVersion >= 3) {
      const scaled = difficulty(floor, spec);
      // Only new catalogue sessions change timing. Saved star-shift checkpoints
      // retain their original interval until this floor is left, without rerolls.
      if (catalogVersion >= 4) scaled.shiftSeconds += SHIFT_INTERVAL_BONUS;
      reward.coins += (scaled.tier - 1) * 5;
      return { id, kind, ...spec, ...scaled, order, reward, catalogVersion };
    }
    return { id, kind, ...spec, order, reward, catalogVersion };
  }
  // Hunt rifts: optional battle trials. Half of the floors without a chapter lord (surface and underground,
  // never floor 99) offer one, independent of the puzzle rift. Fighting is the task itself: clear every
  // enemy, defeat the rift champion, or take the three crystal shards from their carriers.
  const HUNT_KINDS = Object.freeze({
    'hunt-purge': Object.freeze({ title: '討伐裂隙・殲滅', description: '裂隙另一頭聚集了一群躁動的怪物。全部擊倒，讓這道裂縫安靜下來。', objective: '擊敗裂隙中的全部怪物。' }),
    'hunt-champion': Object.freeze({ title: '討伐裂隙・首領', description: '一隻強大的裂隙首領帶著部下守在深處。擊敗首領，部下就會散去。', objective: '擊敗裂隙首領；其他怪物可以避開。' }),
    'hunt-shards': Object.freeze({ title: '討伐裂隙・碎晶', description: '三隻怪物吞下了發光的裂晶，正四處遊走。擊倒牠們，取回三枚裂晶。', objective: '擊敗三隻帶晶的怪物，取回裂晶。' }),
  });
  // Raised from 50% (v1.58.7): about two thirds of the eligible floors offer a hunt.
  const HUNT_CHANCE = 65;
  const isHuntId = id => typeof id === 'string' && id.startsWith('hunt:');
  const lordFloor = floor => floor > 0 ? floor === 1 || floor % 10 === 0 : floor % 10 === 0;
  function huntHash(seed, text) { let h = seed >>> 0; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; }
  // Depth tier 1-5: every 20 surface floors, and the whole underground at 5.
  const huntTier = floor => floor < 0 ? 5 : Math.min(5, 1 + Math.floor((99 - floor) / 20));
  // The size, targets, time and reward of one hunt kind at one tier; shared with the detailed atlas.
  function huntShape(kind, tier) {
    const count = kind === 'hunt-purge' ? 3 + tier : kind === 'hunt-champion' ? 2 + Math.ceil(tier / 2) : 4 + Math.ceil(tier / 2);
    const champion = kind === 'hunt-champion' ? 0 : null, carriers = kind === 'hunt-shards' ? [0, 1, 2] : [];
    const required = kind === 'hunt-purge' ? Array.from({ length: count }, (_, i) => i) : kind === 'hunt-champion' ? [0] : carriers;
    const reward = { coins: 12 + count * 4 + tier * 4, items: { heal: tier >= 4 ? 2 : 1, ration: 1 }, gear: null };
    return { size: tier >= 3 ? 9 : 7, count, champion, carriers, required, timeLimit: 120 + count * 15, shiftSeconds: 45, reward };
  }
  function rawHunt(floor, seed) {
    if (!validFloor(floor) || !validSeed(seed) || floor === 99 || lordFloor(floor) || huntHash(seed, 'hunt:' + floor) % 100 >= HUNT_CHANCE) return null;
    const kinds = Object.keys(HUNT_KINDS), kind = kinds[huntHash(seed, 'hunt-kind:' + floor) % kinds.length], tier = huntTier(floor);
    return { id: `hunt:${floor}:${seed}`, kind, hunt: true, ...HUNT_KINDS[kind], tier, ...huntShape(kind, tier) };
  }
  function huntOffer(run) {
    if (!run || !validFloor(run.floor) || !validSeed(run.seed) || !run.party?.loadouts) return null;
    const generated = rawHunt(run.floor, run.seed);
    if (!generated || run.expedition?.history?.some(entry => entry.id === generated.id)) return null;
    return generated;
  }
  // The offer behind the active expedition, puzzle or hunt.
  function activeOffer(run) { const id = run?.expedition?.active?.id; return isHuntId(id) ? huntOffer(run) : offer(run); }
  const huntDone = (run, generated) => !!generated?.hunt && generated.required.every(index => (run.defeatedMonsters || []).includes('monster-h-' + index));
  function newExpedition(version = CATALOG_VERSION) { return { version, discovered: false, history: [], active: null }; }
  function catalogVersion(value) { return value === undefined ? 1 : value; }
  function maxObservedShifts(active, generated) { return Math.floor((active.elapsed + 0.25) / generated.shiftSeconds); }
  function validateExpedition(value, floor, seed) {
    if (!validFloor(floor) || !validSeed(seed)) return null;
    if (value === undefined) return newExpedition(1);
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, 2, 3, 4].includes(value.version) || typeof value.discovered !== 'boolean' || !Array.isArray(value.history) || value.history.length > 99) return null;
    const history = [], ids = new Set();
    for (const item of value.history) {
      if (item && isHuntId(item.id)) {
        const hunt = validFloor(item.floor) && item.floor >= floor ? rawHunt(item.floor, seed) : null;
        if (!hunt || hunt.id !== item.id || hunt.kind !== item.kind || !['completed', 'abandoned', 'expired'].includes(item.outcome) || ids.has(item.id) || item.catalogVersion !== undefined) return null;
        ids.add(item.id); history.push({ id: item.id, kind: item.kind, floor: item.floor, outcome: item.outcome }); continue;
      }
      if (!item || !towerFloor(item.floor) || item.floor < floor || !['completed', 'abandoned', 'expired'].includes(item.outcome)) return null;
      const version = catalogVersion(item.catalogVersion);
      if (![1, 2, 3, 4].includes(version) || version > value.version || item.floor === floor && version !== value.version) return null;
      const generated = rawOffer(item.floor, seed, version);
      if (!generated || generated.id !== item.id || generated.kind !== item.kind || ids.has(item.id)) return null;
      ids.add(item.id); history.push({ id: item.id, kind: item.kind, floor: item.floor, outcome: item.outcome, ...(version >= 2 ? { catalogVersion: version } : {}) });
    }
    const generated = rawOffer(floor, seed, value.version);
    if (value.discovered && !generated) return null;
    let active = null;
    if (value.active !== null && isHuntId(value.active?.id)) {
      const a = value.active, config = getCore().floorConfig(floor), hunt = rawHunt(floor, seed);
      if (!hunt || ids.has(a.id) || a.id !== hunt.id || a.kind !== hunt.kind || a.floor !== floor || !number(a.elapsed, 0, hunt.timeLimit) || a.mistakes !== 0 || !Array.isArray(a.progress) || a.progress.length) return null;
      if (catalogVersion(a.catalogVersion) !== value.version) return null;
      if (!a.returnCell || !number(a.returnCell.x, 0, config.size - 1, true) || !number(a.returnCell.y, 0, config.size - 1, true) || !number(a.returnShift, 0, config.shiftSeconds)) return null;
      return { version: value.version, discovered: value.discovered, history, active: { id: a.id, kind: a.kind, floor, elapsed: a.elapsed, progress: [], mistakes: 0, returnCell: { x: a.returnCell.x, y: a.returnCell.y }, returnShift: a.returnShift, ...(value.version >= 2 ? { catalogVersion: value.version } : {}) } };
    }
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
      if (!a.returnCell || !number(a.returnCell.x, 0, config.size - 1, true) || !number(a.returnCell.y, 0, config.size - 1, true) || !number(a.returnShift, 0, config.shiftSeconds)) return null;
      active = { id: a.id, kind: a.kind, floor, elapsed: a.elapsed, progress: [...a.progress], mistakes: a.mistakes, returnCell: { x: a.returnCell.x, y: a.returnCell.y }, returnShift: a.returnShift, ...(value.version >= 2 ? { catalogVersion: value.version } : {}), ...(a.kind === 'stars' ? { shiftCount: a.shiftCount, shiftAtStart: a.shiftAtStart } : {}) };
    }
    return { version: value.version, discovered: value.discovered, history, active };
  }
  function offer(run) {
    if (!run || !validFloor(run.floor) || !validSeed(run.seed)) return null;
    const version = run.expedition ? run.expedition.version : CATALOG_VERSION;
    if (![1, 2, 3, 4].includes(version)) return null;
    const generated = rawOffer(run.floor, run.seed, version);
    if (!generated || run.expedition && (!Array.isArray(run.expedition.history) || run.expedition.history.some(entry => entry.id === generated.id))) return null;
    if(run.party?.loadouts&&generated.reward.gear){const C=getCore(),kinds=Object.keys(C.GEAR).filter(k=>C.GEAR[k].tier<=(run.floor>=70?1:run.floor>=40?2:3)),kind=kinds[(run.seed+run.floor*7)%kinds.length];generated.reward.gear=C.createGear(kind,run.floor,run.seed,generated.id,true);}
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
      const hunting = isHuntId(id), generated = hunting ? huntOffer(next) : offer(next), config = getCore().floorConfig(next.floor);
      if (!generated || generated.id !== id || !hunting && !next.expedition.discovered || next.expedition.active) return { ok: false, message: '目前無法進入這道裂隙。' };
      if (!returnPoint || !number(returnPoint.x, 0, config.size - 1, true) || !number(returnPoint.y, 0, config.size - 1, true) || !number(returnPoint.shiftLeft, 0, config.shiftSeconds)) return { ok: false, message: '無效的返回位置。' };
      next.expedition.active = { id, kind: generated.kind, floor: next.floor, elapsed: 0, progress: [], mistakes: 0, returnCell: { x: returnPoint.x, y: returnPoint.y }, returnShift: returnPoint.shiftLeft, ...(next.expedition.version >= 2 ? { catalogVersion: next.expedition.version } : {}), ...(generated.kind === 'stars' ? { shiftCount: 0, shiftAtStart: null } : {}) };
      return { ok: true, message: `進入${generated.title}。`, effect: { entered: true, offer: generated } };
    });
  }
  function interact(run, index, expectedRevision, details) {
    return getCore().transaction(run, expectedRevision, next => {
      const a = next.expedition.active, generated = offer(next);
      if (!a || isHuntId(a.id) || !generated || a.elapsed >= generated.timeLimit || !number(index, 0, 2, true)) return { ok: false, message: '目前無法啟動這個副本目標。' };
      if (a.progress.length === 3) return { ok: false, message: '目標已完成，請返回裂隙出口。' };
      if (a.kind === 'bells' && generated.order[a.progress.length] !== index) {
        a.progress = []; a.mistakes = Math.min(10000, a.mistakes + 1);
        const damage = getCore().applyDamage(next, generated.mistakeDamage ? generated.mistakeDamage + 3 : 8, 'trap', details?.invulnerable===true);
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
        const damage = getCore().applyDamage(next, generated.mistakeDamage || 5, 'trap', details?.invulnerable===true);
        return { ...damage, message: step && step.failure || '線索尚未接起來。陷阱被觸動，請重新確認提示。', effect: { ...damage.effect, wrongOrder, wrongChoice, progress: [...a.progress], completed: false } };
      }
      a.progress.push(index);
      if (a.kind === 'stars' && index === 0) a.shiftAtStart = a.shiftCount;
      return { ok: true, message: a.progress.length === 3 ? '裂隙目標全部完成，回到出口領取報酬。' : step && step.success || `副本進度 ${a.progress.length} / 3。`, effect: { index, progress: [...a.progress], completed: a.progress.length === 3 } };
    });
  }
  function observeShift(run) {
    return getCore().transaction(run, undefined, next => {
      const a = next.expedition.active, generated = activeOffer(next);
      if (!a || a.kind !== 'stars' || !generated || a.elapsed >= generated.timeLimit || a.shiftCount >= maxObservedShifts(a, generated)) return { ok: false, message: '目前沒有新的星路變形可記錄。' };
      a.shiftCount += 1;
      return { ok: true, message: a.shiftAtStart !== null && a.shiftCount > a.shiftAtStart ? '牆壁已移動，新的星路可以辨認了。' : '', effect: { shiftObserved: true, shiftCount: a.shiftCount } };
    });
  }
  function tick(run, seconds) {
    return getCore().transaction(run, undefined, next => {
      const a = next.expedition.active, generated = activeOffer(next);
      if (!a || !generated || !number(seconds, 0, 60)) return { ok: false, message: '無效的副本時間更新。' };
      a.elapsed = Math.min(generated.timeLimit, a.elapsed + seconds);
      const expired = a.elapsed >= generated.timeLimit;
      return { ok: true, message: expired ? '裂隙即將封閉，這次探索已到時限。' : '', effect: { expired, remaining: Math.max(0, generated.timeLimit - a.elapsed) } };
    });
  }
  function finish(run, outcome, expectedRevision) {
    const C = getCore();
    const settle = next => {
      const a = next.expedition.active, generated = activeOffer(next);
      if (!a || !generated || !['completed', 'abandoned', 'expired'].includes(outcome)) return { ok: false, message: '沒有可結案的副本。' };
      if (outcome === 'expired' && a.elapsed < generated.timeLimit) return { ok: false, message: '副本尚未到時限。' };
      if (outcome === 'completed' && (next.status !== 'playing' || (generated.hunt ? !huntDone(next, generated) : a.progress.length !== 3) || a.elapsed >= generated.timeLimit)) return { ok: false, message: '尚未在時限內完成副本目標。' };
      if (next.expedition.history.length >= 99) return { ok: false, message: '副本歷史紀錄已滿。' };
      const reward = outcome === 'completed' ? generated.reward : null;
      if (reward) {
        if (next.coins + reward.coins > 999999 || Object.entries(reward.items).some(([id, count]) => next.bag[id] + count > 99)) return { ok: false, message: '補給或銅幣已滿，請整理背包後領取；副本尚未結案。' };
        if (reward.gear) { const granted = C.receiveGear(next, reward.gear); if (!granted.ok) return granted; }
        next.coins += reward.coins;
        for (const [id, count] of Object.entries(reward.items)) next.bag[id] += count;
      }
      const effect = { outcome, returnCell: { ...a.returnCell }, returnShift: a.returnShift, reward };
      // A hunt record only matters on its own floor (it stops a second entry there), so earlier ones are dropped
      // instead of filling the 99-entry history.
      if (generated.hunt) next.expedition.history = next.expedition.history.filter(entry => !isHuntId(entry.id) || entry.floor === a.floor);
      next.expedition.history.push({ id: a.id, kind: a.kind, floor: a.floor, outcome, ...(next.expedition.version >= 2 && !generated.hunt ? { catalogVersion: next.expedition.version } : {}) });
      next.expedition.active = null;
      if (generated.hunt) C.clearHunt(next);
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
  return Object.freeze({ TYPES, HUNT_KINDS, HUNT_CHANCE, huntTier, huntShape, CATALOG_VERSION, SHIFT_INTERVAL_BONUS, newExpedition, validateExpedition, offer, huntOffer, activeOffer, huntDone, isHuntId, discover, enter, interact, observeShift, tick, finish });
});
