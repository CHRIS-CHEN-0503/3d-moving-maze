/* Deterministic tower shops, chests and optional explorer errands. */
(function (root, factory) {
  const api = factory(() => typeof module === 'object' && module.exports ? require('./story-core.js') : root.TowerCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerEncounters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  const MERCHANTS = Object.freeze({
    tieLing: Object.freeze({ id: 'tieLing', name: '鐵嶺', title: '鐵匠', equipmentKinds: Object.freeze(['helmet', 'bat']), supplies: Object.freeze(['heal', 'shield']) }),
    jinHe: Object.freeze({ id: 'jinHe', name: '錦禾', title: '裁甲師', equipmentKinds: Object.freeze(['armor', 'pan']), supplies: Object.freeze(['ration', 'feather']) }),
    lanZhou: Object.freeze({ id: 'lanZhou', name: '嵐舟', title: '盾匠', equipmentKinds: Object.freeze(['shield', 'staff']), supplies: Object.freeze(['map', 'bell', 'hourglass']) }),
  });
  const EXPLORERS = Object.freeze({
    eve: Object.freeze({ id: 'eve', name: '伊芙', title: '探索者', greeting: '我的地圖又被高塔改寫了。沒關係，我們一起把路找回來。' }),
    rowan: Object.freeze({ id: 'rowan', name: '洛恩', title: '探索者', greeting: '繩索、睡墊都帶齊了！路再難走，歇一口氣就能繼續。' }),
    mira: Object.freeze({ id: 'mira', name: '米菈', title: '探索者', greeting: '小心別碰翻我的藥瓶。這座塔的苔蘚，說不定藏著救命的線索。' }),
    oren: Object.freeze({ id: 'oren', name: '奧倫', title: '探索者', greeting: '石壁上的古文還沒讀完，牆就搬走啦。年輕人，陪我找找下一句？' }),
    sena: Object.freeze({ id: 'sena', name: '星奈', title: '探索者', greeting: '從塔頂看過的流星，我一顆都記得。希望下一次，能站在塔外仰望。' }),
  });
  const GEAR_KINDS = ['helmet', 'armor', 'shield', 'bat', 'pan', 'staff'];
  const QUEST_TYPES = ['defeat', 'escort', 'relic', 'donate', 'survey', 'shift', 'stun'];
  const DONATIONS = ['heal', 'ration', 'map'];
  const COUNTS = { 7: [1, 1, 2], 9: [1, 2, 3], 11: [2, 2, 4], 13: [2, 3, 5], 15: [3, 3, 6], 17: [3, 4, 7], 19: [4, 4, 8] };
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 96;
  const uniqueIds = (value, max) => Array.isArray(value) && value.length <= max && value.every(validId) && new Set(value).size === value.length;
  function randomFor(floor, seed, salt) {
    if (!integer(floor, 1, 99) || !integer(seed, 1, 0xffffffff)) throw new RangeError('無效的樓層或旅程種子。');
    let state = (seed ^ Math.imul(floor, 7919) ^ salt) >>> 0;
    return () => { state = (state + 0x6d2b79f5) >>> 0; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function explorerIdentity(floor, seed) {
    // Identity has its own stream: do not consume the encounter or quest draws.
    const random = randomFor(floor, seed, 0x683f47), ids = Object.keys(EXPLORERS);
    return { ...EXPLORERS[ids[Math.floor(random() * ids.length)]] };
  }
  function newAdventure() { return { version: 1, claimed: [], quest: null }; }
  function validateAdventure(value, floor) {
    if (value === undefined) return newAdventure();
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !uniqueIds(value.claimed, 128)) return null;
    let quest = null;
    if (value.quest !== null) {
      const q = value.quest;
      if (!q || typeof q !== 'object' || Array.isArray(q) || !validId(q.id) || !validId(q.target) || !integer(q.floor, 1, 99) || (floor !== undefined && q.floor !== floor)) return null;
      if (!QUEST_TYPES.includes(q.type) || !['active', 'ready', 'claimed'].includes(q.status) || !integer(q.goal, 1, 3) || !integer(q.progress, 0, q.goal) || !uniqueIds(q.events, 32)) return null;
      if ((q.status === 'active' && q.progress >= q.goal) || (q.status !== 'active' && q.progress !== q.goal)) return null;
      quest = { id: q.id, floor: q.floor, type: q.type, status: q.status, target: q.target, goal: q.goal, progress: q.progress, events: [...q.events] };
    }
    return { version: 1, claimed: [...value.claimed], quest };
  }
  function floorLootCounts(size) {
    if (!Object.hasOwn(COUNTS, size)) throw new RangeError('未知的迷宮尺寸。');
    const [itemCount, foodCount, storyCount] = COUNTS[size];
    return { itemCount, foodCount, storyCount, total: itemCount + foodCount + storyCount };
  }
  function merchantOffers(floor, seed) {
    const C = core(), random = randomFor(floor, seed, 0x24181), ids = Object.keys(MERCHANTS);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const count = floor < 70 && random() < .45 ? 2 : 1;
    return ids.slice(0, count).map(id => {
      const entry = MERCHANTS[id];
      return { ...entry, equipmentKinds: [...entry.equipmentKinds], supplies: [...entry.supplies], gear: entry.equipmentKinds.map(kind => {
        const gear = C.createGear(kind, floor, seed, `shop:${floor}:${id}:${kind}`, false);
        return { kind, gear, price: C.gearPrice(gear) };
      }) };
    });
  }
  function merchant(run, merchantId) { return merchantOffers(run.floor, run.seed).find(entry => entry.id === merchantId); }
  function failure(run, message) { return { ok: false, run, message }; }
  function transaction(run, expectedRevision, fn) {
    return core().transaction(run, expectedRevision, next => {
      const adventure = validateAdventure(next.adventure, next.floor);
      if (!adventure) return { ok: false, message: '奇遇進度有誤，請重新讀取存檔。' };
      next.adventure = adventure;
      const result = fn(next);
      if (result.ok && !validateAdventure(next.adventure, next.floor)) return { ok: false, message: '本層奇遇紀錄已滿，無法保存這次操作。' };
      return result;
    });
  }
  function buySupply(run, merchantId, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), shop = merchant(next, merchantId), item = C.ITEMS[itemId];
      if (!shop || !shop.supplies.includes(itemId) || !item || !integer(quantity, 1, 99)) return { ok: false, message: '這位商人沒有出售這件補給。' };
      const cost = item.buyPrice * quantity;
      if (next.coins < cost || next.bag[itemId] + quantity > 99) return { ok: false, message: next.coins < cost ? '銅幣不足。' : '補給背包已滿。' };
      next.coins -= cost; next.bag[itemId] += quantity;
      return { ok: true, message: `向${shop.name}購買${item.name} × ${quantity}。` };
    });
  }
  function sellSupply(run, merchantId, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), shop = merchant(next, merchantId), item = C.ITEMS[itemId];
      if (!shop || !shop.supplies.includes(itemId) || !item || !integer(quantity, 1, 99)) return { ok: false, message: '這位商人不收購這件補給。' };
      if (next.bag[itemId] < quantity || next.coins + item.sellPrice * quantity > 999999) return { ok: false, message: '物資不足或銅幣已達上限。' };
      next.bag[itemId] -= quantity; next.coins += item.sellPrice * quantity;
      return { ok: true, message: `向${shop.name}出售${item.name} × ${quantity}。` };
    });
  }
  function buyMerchantGear(run, merchantId, kind, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), shop = merchant(next, merchantId), offer = shop && shop.gear.find(entry => entry.kind === kind), stock = `stock:${next.floor}:${merchantId}:${kind}`;
      if (!offer) return { ok: false, message: '這位商人沒有這件裝備。' };
      if (next.adventure.claimed.includes(stock)) return { ok: false, message: '本層這件裝備已售出。' };
      if (next.coins < offer.price) return { ok: false, message: '銅幣不足。' };
      const result = C.receiveGear(next, offer.gear);
      if (!result.ok) return result;
      next.coins -= offer.price; next.adventure.claimed.push(stock);
      return { ok: true, message: `取得${offer.gear.name || C.GEAR[kind].name}。`, effect: { gear: offer.gear } };
    });
  }
  function chestOffer(floor, seed) {
    const C = core(), random = randomFor(floor, seed, 0x74e12);
    if (random() >= .2) return null;
    const id = `chest:${floor}:${seed}`;
    if (random() < .35) return { id, outcome: 'trap', damage: 12 + Math.floor((99 - floor) / 10), gear: null };
    const kind = GEAR_KINDS[Math.floor(random() * GEAR_KINDS.length)];
    return { id, outcome: 'gear', damage: 0, gear: C.createGear(kind, floor, seed, id, true) };
  }
  function openChest(run, chestId, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), offer = chestOffer(next.floor, next.seed);
      if (!offer || offer.id !== chestId) return { ok: false, message: '這個樓層沒有這只寶箱。' };
      if (next.adventure.claimed.includes(offer.id)) return { ok: false, message: '寶箱已經開啟。' };
      const result = offer.outcome === 'gear' ? C.receiveGear(next, offer.gear) : C.applyDamage(next, offer.damage, 'trap');
      if (!result.ok) return result;
      next.adventure.claimed.push(offer.id);
      return { ok: true, message: offer.outcome === 'gear' ? '寶箱中藏著強化裝備。' : '寶箱觸發陷阱！', effect: { ...result.effect, outcome: offer.outcome, gear: offer.gear, damage: offer.outcome === 'trap' ? result.effect.damage : 0 } };
    });
  }
  function questReward(floor, seed) {
    const C = core(), random = randomFor(floor, seed, 0x257ca), coins = 12 + Math.floor((99 - floor) / 6);
    if (random() < .45) {
      const kind = GEAR_KINDS[Math.floor(random() * GEAR_KINDS.length)];
      return { coins, items: {}, gear: C.createGear(kind, floor, seed, `quest-reward:${floor}:${seed}`, true) };
    }
    const id = ['heal', 'ration', 'shield', 'hourglass'][Math.floor(random() * 4)];
    return { coins, items: { [id]: id === 'ration' ? 2 : 1 }, gear: null };
  }
  function describeQuest(q, run) {
    const C = core(), types = {
      defeat: ['清除路障', '請讓護衛擊敗指定的守路怪物。'], escort: ['護送迷途旅人', '帶我一起走到本層出口，請不要把我丟下。'],
      relic: ['遺失的記憶', '幫我找回散落在迷宮中的記憶碎片。'], donate: ['旅人的急需', `請交付 ${q.goal} 份${C.ITEMS[q.target]?.name || '補給'}，讓我能繼續走下去。`],
      survey: ['繪製迷宮', '走訪三個不同的迷宮格，替我記下道路。'], shift: ['觀察高塔心跳', '陪我安全經歷一次迷宮變形。'], stun: ['爭取逃脫時間', '用武器擊暈指定怪物一次，替旅人爭取空檔。'],
    };
    return { ...q, title: types[q.type][0], description: types[q.type][1], reward: questReward(run.floor, run.seed), explorer: explorerIdentity(run.floor, run.seed) };
  }
  function explorerOffer(run) {
    const C = core(), random = randomFor(run.floor, run.seed, 0x5b31e);
    if (random() >= .2) return null;
    const adventure = validateAdventure(run.adventure, run.floor);
    if (!adventure) return null;
    if (adventure.quest) return describeQuest(adventure.quest, run);
    if (adventure.claimed.includes(`abandoned:${run.floor}`)) return null;
    const config = C.floorConfig(run.floor), alive = Array.from({ length: config.monsterCount }, (_, i) => ({ id: `monster-${i}`, kind: config.monsterTypes[i % config.monsterTypes.length] })).filter(m => !run.defeatedMonsters.includes(m.id));
    const donations = DONATIONS.filter(id => run.bag[id] > 0);
    const candidates = ['escort', 'relic', 'survey', 'shift'];
    if (donations.length) candidates.push('donate');
    const defeatable = run.warrior && run.warrior.mode === 'escort' ? alive.find(m => C.monsterStrength(m.kind, run.floor) < run.warrior.strength) : null;
    if (defeatable) candidates.push('defeat');
    if (alive.length && run.equipment && run.equipment.weapon) candidates.push('stun');
    const type = candidates[Math.floor(random() * candidates.length)], target = type === 'defeat' ? defeatable.id : type === 'stun' ? alive[0].id : type === 'donate' ? donations[Math.floor(random() * donations.length)] : type === 'relic' ? `relic:${run.floor}:${run.seed}` : type === 'escort' ? 'exit' : type === 'survey' ? 'cells' : 'walls';
    const goal = type === 'donate' ? Math.min(run.bag[target], 1 + Math.floor(random() * 3)) : type === 'survey' ? 3 : 1;
    const id = `quest:${run.floor}:${run.seed}:${type}:${target}:${goal}`;
    return describeQuest({ id, floor: run.floor, type, status: 'active', target, goal, progress: 0, events: [] }, run);
  }
  function acceptQuest(run, offerId, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      if (next.adventure.quest) return { ok: false, message: '本層已經接受過旅人的委託。' };
      const offer = explorerOffer(next);
      if (!offer || offer.id !== offerId) return { ok: false, message: '旅人的委託已更新，請重新確認內容。' };
      const { id, floor, type, status, target, goal, progress, events } = offer;
      next.adventure.quest = { id, floor, type, status, target, goal, progress, events: [...events] };
      return { ok: true, message: `接受委託：${offer.title}。`, effect: { quest: next.adventure.quest } };
    });
  }
  function questProgress(run, event, data = {}) {
    const existing = run.adventure && run.adventure.quest;
    if (!existing || existing.status !== 'active' || event !== existing.type) return failure(run, '目前沒有符合的進行中委託。');
    return transaction(run, undefined, next => {
      const q = next.adventure.quest;
      let key;
      if (event === 'defeat' || event === 'stun') {
        if ((data.monsterId || data.id) !== q.target || (event === 'defeat' && !next.defeatedMonsters.includes(q.target))) return { ok: false, message: '這不是委託指定的怪物。' };
        if (event === 'stun' && !(next.monsterStuns && next.monsterStuns[q.target] > 0)) return { ok: false, message: '指定怪物尚未被擊暈。' };
        key = q.target;
      } else if (event === 'relic') {
        if (data.id !== q.target) return { ok: false, message: '這不是遺失的記憶碎片。' };
        key = q.target;
      } else if (event === 'escort') {
        if (data.atExit !== true || !Number.isFinite(data.distance) || data.distance < 0 || data.distance > 2.8) return { ok: false, message: '旅人還沒跟上，請在出口附近等他。' };
        key = 'exit';
      } else if (event === 'survey') {
        const size = core().floorConfig(next.floor).size;
        if (!integer(data.x, 0, size - 1) || !integer(data.y, 0, size - 1)) return { ok: false, message: '無效的探索位置。' };
        key = `${data.x},${data.y}`;
      } else if (event === 'shift') {
        if (!validId(data.id)) return { ok: false, message: '沒有新的迷宮變形紀錄。' };
        key = data.id;
      } else if (event === 'donate') {
        if (!DONATIONS.includes(q.target) || next.bag[q.target] < q.goal) return { ok: false, message: '所需補給尚未備齊。' };
        next.bag[q.target] -= q.goal; key = q.target;
      }
      if (q.events.includes(key)) return { ok: false, message: '這項進度已經記錄。' };
      q.events.push(key); q.progress = Math.min(q.goal, event === 'donate' ? q.goal : q.progress + 1);
      if (q.progress === q.goal) q.status = 'ready';
      return { ok: true, message: q.status === 'ready' ? '委託完成，回去向旅人領取報酬。' : `委託進度 ${q.progress} / ${q.goal}。`, effect: { ready: q.status === 'ready' } };
    });
  }
  function claimQuestReward(run, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), q = next.adventure.quest;
      if (!q || q.status !== 'ready' || next.adventure.claimed.includes(`reward:${q.id}`)) return { ok: false, message: '沒有尚未領取的委託報酬。' };
      const reward = questReward(next.floor, next.seed);
      if (next.coins + reward.coins > 999999 || Object.entries(reward.items).some(([id, amount]) => next.bag[id] + amount > 99)) return { ok: false, message: '請先整理背包或銅幣，再領取報酬。' };
      if (reward.gear) { const result = C.receiveGear(next, reward.gear); if (!result.ok) return result; }
      next.coins += reward.coins; for (const [id, amount] of Object.entries(reward.items)) next.bag[id] += amount;
      q.status = 'claimed'; next.adventure.claimed.push(`reward:${q.id}`);
      return { ok: true, message: '已領取委託報酬，謝謝你幫助旅人。', effect: { reward } };
    });
  }
  function abandonQuest(run, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const q = next.adventure.quest;
      if (!q || q.status === 'claimed') return { ok: false, message: '沒有需要放棄的委託。' };
      next.adventure.claimed.push(`abandoned:${next.floor}`); next.adventure.quest = null;
      return { ok: true, message: '已放棄本層委託，尚未領取的報酬不會保留。' };
    });
  }
  return Object.freeze({ MERCHANTS, EXPLORERS, QUEST_TYPES, newAdventure, validateAdventure, floorLootCounts, merchantOffers, buySupply, sellSupply, buyMerchantGear, chestOffer, openChest, questReward, explorerIdentity, explorerOffer, acceptQuest, questProgress, claimQuestReward, abandonQuest });
});
