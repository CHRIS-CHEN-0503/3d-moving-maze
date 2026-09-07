/* The descending tower: deterministic rules shared by the browser and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATE_VERSION = 1;
  const MAX_COINS = 999999;
  const MAX_STACK = 99;
  const ITEMS = Object.freeze({
    heal: Object.freeze({ id: 'heal', name: '療癒藥', description: '恢復 35 點生命。', buyPrice: 14, sellPrice: 6, color: '#ff7889' }),
    ration: Object.freeze({ id: 'ration', name: '乾糧', description: '恢復 45 點飽食度。', buyPrice: 8, sellPrice: 3, color: '#efc073' }),
    shield: Object.freeze({ id: 'shield', name: '星紋護盾', description: '25 秒內受到的傷害減少 65%。', buyPrice: 18, sellPrice: 8, color: '#70bfff' }),
    hourglass: Object.freeze({ id: 'hourglass', name: '定牆沙漏', description: '暫停迷宮變形 25 秒。', buyPrice: 20, sellPrice: 9, color: '#ffd36f' }),
    bell: Object.freeze({ id: 'bell', name: '驅怪鈴', description: '讓怪物退避 20 秒。', buyPrice: 18, sellPrice: 8, color: '#bda2ff' }),
    map: Object.freeze({ id: 'map', name: '回聲地圖', description: '顯示出口方向與路線 18 秒。', buyPrice: 12, sellPrice: 5, color: '#6de5d7' }),
    feather: Object.freeze({ id: 'feather', name: '復甦羽', description: '受到致命傷時自動消耗，恢復 50 點生命。', buyPrice: 45, sellPrice: 20, color: '#fff1bb' }),
    coin: Object.freeze({ id: 'coin', name: '銅幣', description: '與塔中的冒險者購買物資。', buyPrice: null, sellPrice: null, color: '#efc05e' }),
  });

  const MONSTERS = Object.freeze({
    clockmite: Object.freeze({ id: 'clockmite', name: '齒輪遊蟲', description: '緩慢巡邏的發條生物，靠近才會追逐；轉入岔路就能甩開。', speed: 1.25, damage: 8, sight: 7, color: 0xdba65f, shape: 'beetle' }),
    sentinel: Object.freeze({ id: 'sentinel', name: '石甲守衛', description: '腳步沉重、接觸傷害高，留意它把守的通道。', speed: 1.6, damage: 15, sight: 8, color: 0x839cae, shape: 'golem' }),
    wisp: Object.freeze({ id: 'wisp', name: '迷光幽靈', description: '在岔路間快速游移的幽光；驅怪鈴可以讓它遠離。', speed: 2.35, damage: 10, sight: 10, color: 0xa6a0ff, shape: 'wisp' }),
    hound: Object.freeze({ id: 'hound', name: '燼火獵犬', description: '塔底的敏捷獵手，追蹤範圍大；善用護盾與變形的圍牆。', speed: 2.75, damage: 18, sight: 12, color: 0xff9868, shape: 'hound' }),
  });

  const CHAPTERS = Object.freeze([
    Object.freeze({ id: 'summoning', chapter: 1, name: '雲頂召喚台', high: 99, low: 90, themeIndex: 0, size: 7, narrative: '你在陌生的石台醒來，雲海就在腳下。一道聲音說：「第九十九層，召喚完成。」回家的路不在塔頂，而在向下的樓梯。牆面第一次移動時，你明白這座塔仍然活著。' }),
    Object.freeze({ id: 'garden', chapter: 2, name: '空中庭園', high: 89, low: 80, themeIndex: 1, size: 9, narrative: '第八十九層的門打開，石室忽然讓位給陽光與草地。背著行囊的旅人告訴你，每下降十層，高塔就換上一副面貌。他願意交換補給，也提醒你留意花園深處偶爾傳出的齒輪聲。' }),
    Object.freeze({ id: 'roots', chapter: 3, name: '倒生之森', high: 79, low: 70, themeIndex: 3, size: 9, narrative: '巨木的根朝著天空生長，樹冠卻沉入樓梯下方。你在樹根間找到一頁日誌：歷代召喚者都在尋找塔心的門。樹影中的齒輪遊蟲還很稀少，正適合儲備糧食、記住迷宮改變前的徵兆。' }),
    Object.freeze({ id: 'echo', chapter: 4, name: '回聲水晶窟', high: 69, low: 60, themeIndex: 2, size: 11, narrative: '水晶把你的腳步傳向更寬廣的洞窟，石甲守衛在回聲間甦醒。透過一道裂開的水晶，你看見許多世界的門，卻沒有自己的家。旅人留下新的線索：下一區的圖書館，記錄著高塔最初的用途。' }),
    Object.freeze({ id: 'library', chapter: 5, name: '失落圖書館', high: 59, low: 50, themeIndex: 0, size: 13, narrative: '移動的書架圍成迷宮，沒有人讀過的書仍在自行翻頁。你終於找到建塔者的手稿：高塔原本是一座歸途裝置，不是牢籠。文字間浮起迷光幽靈，那是被困太久、逐漸失去名字的回聲。' }),
    Object.freeze({ id: 'mist', chapter: 6, name: '霧水迴廊', high: 49, low: 40, themeIndex: 4, size: 13, narrative: '淺水倒映著不屬於你的故鄉，霧氣使每條岔路看起來都很熟悉。你再次遇見交換物資的旅人，他還認得你，卻忘了自己的來處。他請你帶上一枚記憶碎片，別讓塔心忘記「回家」的意思。' }),
    Object.freeze({ id: 'frost', chapter: 7, name: '霜封迴廊', high: 39, low: 30, themeIndex: 2, size: 15, narrative: '薄霜封住了古老的鐘，圍牆卻移動得比上層更快。冰中凍結著無數未送達的求救訊號。你收集旅人的記憶，發現只有把這些願望送回塔心，才能讓歸途裝置重新認出真正的目的地。' }),
    Object.freeze({ id: 'clockwork', chapter: 8, name: '齒輪工坊', high: 29, low: 20, themeIndex: 0, size: 17, narrative: '巨大的齒輪牽動牆壁，工坊裡仍有無人照料的機械忙碌著。你讀懂了失控的指令：每個求救訊號，都被塔當成一次新的召喚。工坊深處的熔熱腳印指向爐心，也警告你有更敏捷的獵手守在下方。' }),
    Object.freeze({ id: 'furnace', chapter: 9, name: '熔火爐心', high: 19, low: 10, themeIndex: 5, size: 17, narrative: '熔光照亮能量管道，燼火獵犬在爐心巡守。高塔的心跳急促得幾乎蓋過你的腳步。你帶著十幾位旅人交付的記憶穿過火光，讓求救訊號不再召來陌生人，而是指向所有人真正的家。' }),
    Object.freeze({ id: 'heart', chapter: 10, name: '歸途塔心', high: 9, low: 1, themeIndex: 0, size: 19, narrative: '最寬廣的迷宮也最不安定。你帶著旅人的記憶走向塔心，身後是無數尚未找到出口的人。這次，你不只為自己尋路：第一層的門，必須為所有人打開。' }),
  ]);

  const OPENING = Object.freeze({ title: '第九十九層 · 雲頂召喚台', text: CHAPTERS[0].narrative, objective: '活著向下走，找到第一層的歸途之門。每十層進入新環境；越往下，迷宮越大、變形越快。' });
  const ENDING = Object.freeze({ title: '歸途之門', text: '你把旅人留下的記憶放入塔心。急促移動的圍牆終於停下，九十九層的門依序亮起。熟悉與陌生的冒險者走進晨光，而那道聲音第一次不再呼喚新人：「歸途，已開啟。」你帶著這趟旅程留下的勇氣，回到了自己的世界。' });
  const EXCHANGES = Object.freeze([
    Object.freeze({ id: 'ration_for_heal', name: '旅人的急救', give: Object.freeze({ ration: 2 }), receive: Object.freeze({ heal: 1 }) }),
    Object.freeze({ id: 'coin_for_feather', name: '守望者的祝福', give: Object.freeze({ coin: 40, map: 1 }), receive: Object.freeze({ feather: 1 }) }),
    Object.freeze({ id: 'map_for_bell', name: '巡路人的交換', give: Object.freeze({ map: 1, ration: 1 }), receive: Object.freeze({ bell: 1 }) }),
  ]);

  function floorConfig(floor) {
    if (!Number.isInteger(floor) || floor < 1 || floor > 99) throw new RangeError('樓層必須是 1 至 99 的整數。');
    const chapter = CHAPTERS.find((entry) => floor <= entry.high && floor >= entry.low);
    const depth = 99 - floor;
    let monsterTypes = [];
    let monsterCount = 0;
    if (floor <= 84 && floor >= 70 && floor % 5 === 0) {
      monsterTypes = ['clockmite']; monsterCount = 1;
    } else if (floor < 70) {
      monsterTypes = ['clockmite', 'sentinel'];
      if (floor <= 54) monsterTypes.push('wisp');
      if (floor <= 24) monsterTypes.push('hound');
      monsterCount = Math.min(6, 2 + Math.floor((69 - floor) / 14));
    }
    return {
      floor, size: chapter.size, shiftSeconds: Math.round((65 - depth * 47 / 98) * 10) / 10,
      themeIndex: chapter.themeIndex, environmentId: chapter.id, chapter: chapter.chapter, name: chapter.name,
      monsterTypes, monsterCount, count: monsterCount,
      merchant: floor === 99 || floor === chapter.high || floor % 5 === 0,
      rewardCoins: 6 + Math.floor(depth / 12), narrative: floor === chapter.high ? chapter.narrative : '',
      floorTitle: `第 ${floor} 層 · ${chapter.name}`,
    };
  }

  function newRun(options) {
    const opts = options || {};
    const seed = Number.isInteger(opts.seed) && opts.seed > 0 && opts.seed <= 0xffffffff ? opts.seed : ((Date.now() >>> 0) || 1);
    return {
      stateVersion: STATE_VERSION, mode: 'tower', floor: 99, hp: 100, hunger: 100, coins: 24,
      bag: { heal: 2, ration: 2, shield: 0, hourglass: 0, bell: 0, map: 1, feather: 0 },
      effects: { shield: 0, freeze: 0, repel: 0, reveal: 0 },
      engine: { shovels: 1, kites: 0, whistles: 0, shovelCooldownMs: 0, skillCooldownMs: 0 },
      claimed: [], floorElapsed: 0,
      revision: 0, seed, name: typeof opts.name === 'string' ? opts.name.trim().slice(0, 24) || '冒險者' : '冒險者',
      charIdx: Number.isInteger(opts.charIdx) && opts.charIdx >= 0 && opts.charIdx < 6 ? opts.charIdx : 0,
      status: 'playing', elapsed: 0, floorsCleared: 0,
    };
  }

  function validNumber(value, low, high, integer) {
    return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high && (!integer || Number.isInteger(value));
  }

  function validateSave(value) {
    let run = value;
    if (typeof run === 'string') { try { run = JSON.parse(run); } catch (_) { return null; } }
    if (!run || typeof run !== 'object' || Array.isArray(run) || run.stateVersion !== STATE_VERSION || run.mode !== 'tower') return null;
    if (!validNumber(run.floor, 1, 99, true) || !validNumber(run.hp, 0, 100) || !validNumber(run.hunger, 0, 100) || !validNumber(run.coins, 0, MAX_COINS, true)) return null;
    if (!validNumber(run.seed, 1, 0xffffffff, true) || !validNumber(run.revision, 0, Number.MAX_SAFE_INTEGER - 1, true) || !validNumber(run.charIdx, 0, 5, true)) return null;
    if (typeof run.name !== 'string' || !run.name.trim() || run.name.length > 24 || !['playing', 'won', 'dead'].includes(run.status)) return null;
    if (!validNumber(run.elapsed, 0, 315360000) || !validNumber(run.floorsCleared, 0, 99, true)) return null;
    if (run.status === 'dead' && run.hp !== 0 || run.status === 'playing' && run.hp <= 0 || run.status === 'won' && (run.floor !== 1 || run.hp <= 0)) return null;
    if (run.floorsCleared !== (run.status === 'won' ? 99 : 99 - run.floor)) return null;
    if (!run.bag || typeof run.bag !== 'object' || Array.isArray(run.bag) || !run.effects || typeof run.effects !== 'object' || Array.isArray(run.effects)) return null;
    const bag = {};
    for (const id of Object.keys(ITEMS).filter((key) => key !== 'coin')) {
      if (!Object.hasOwn(run.bag, id) || !validNumber(run.bag[id], 0, MAX_STACK, true)) return null;
      bag[id] = run.bag[id];
    }
    if (Object.keys(run.bag).some((id) => !Object.hasOwn(bag, id))) return null;
    const effects = {};
    for (const id of ['shield', 'freeze', 'repel', 'reveal']) {
      if (!Object.hasOwn(run.effects, id) || !validNumber(run.effects[id], 0, 120)) return null;
      effects[id] = run.effects[id];
    }
    if (!run.engine || typeof run.engine !== 'object' || Array.isArray(run.engine)) return null;
    const engine = {};
    for (const id of ['shovels', 'kites', 'whistles']) {
      if (!validNumber(run.engine[id], 0, MAX_STACK, true)) return null;
      engine[id] = run.engine[id];
    }
    for (const id of ['shovelCooldownMs', 'skillCooldownMs']) {
      if (!validNumber(run.engine[id], 0, 600000)) return null;
      engine[id] = run.engine[id];
    }
    if (!Array.isArray(run.claimed) || run.claimed.length > 128 || run.claimed.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 80) || new Set(run.claimed).size !== run.claimed.length) return null;
    if (!validNumber(run.floorElapsed, 0, 315360000)) return null;
    return {
      stateVersion: STATE_VERSION, mode: 'tower', floor: run.floor, hp: run.hp, hunger: run.hunger,
      coins: run.coins, bag, effects, revision: run.revision, seed: run.seed, name: run.name,
      charIdx: run.charIdx, status: run.status, elapsed: run.elapsed, floorsCleared: run.floorsCleared,
      engine, claimed: [...run.claimed], floorElapsed: run.floorElapsed,
    };
  }

  function failure(run, message) { return { ok: false, run, message }; }
  function transaction(run, expectedRevision, action) {
    const next = validateSave(run);
    if (!next) return failure(run, '旅程資料不完整，請重新載入存檔。');
    if (next.status !== 'playing') return failure(run, '這趟旅程已經結束。');
    if (expectedRevision !== undefined && expectedRevision !== next.revision) return failure(run, '背包已更新，請重新確認交易。');
    const result = action(next);
    if (!result.ok) return failure(run, result.message);
    next.revision += 1;
    return { ...result, run: next };
  }

  function buy(run, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
      if (!item || !validNumber(item.buyPrice, 1, MAX_COINS, true) || !validNumber(quantity, 1, MAX_STACK, true)) return { ok: false, message: '無效的購買項目或數量。' };
      const cost = item.buyPrice * quantity;
      if (next.coins < cost) return { ok: false, message: '銅幣不足。' };
      if (next.bag[itemId] + quantity > MAX_STACK) return { ok: false, message: '這種道具的背包數量已滿。' };
      next.coins -= cost; next.bag[itemId] += quantity;
      return { ok: true, message: `獲得 ${item.name} × ${quantity}。` };
    });
  }

  function sell(run, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
      if (!item || !validNumber(item.sellPrice, 1, MAX_COINS, true) || !validNumber(quantity, 1, MAX_STACK, true)) return { ok: false, message: '無效的出售項目或數量。' };
      if (next.bag[itemId] < quantity) return { ok: false, message: '背包裡沒有足夠的道具。' };
      if (next.coins + item.sellPrice * quantity > MAX_COINS) return { ok: false, message: '銅幣已達上限。' };
      next.bag[itemId] -= quantity; next.coins += item.sellPrice * quantity;
      return { ok: true, message: `售出 ${item.name}，獲得 ${item.sellPrice * quantity} 枚銅幣。` };
    });
  }

  function exchange(run, tradeId, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      const trade = EXCHANGES.find((entry) => entry.id === tradeId);
      if (!trade) return { ok: false, message: '找不到這項交換。' };
      for (const [id, count] of Object.entries(trade.give)) {
        if ((id === 'coin' ? next.coins : next.bag[id]) < count) return { ok: false, message: '交換所需的物資不足。' };
      }
      for (const [id, count] of Object.entries(trade.receive)) {
        if (next.bag[id] - (trade.give[id] || 0) + count > MAX_STACK) return { ok: false, message: '背包數量已滿，無法交換。' };
      }
      for (const [id, count] of Object.entries(trade.give)) {
        if (id === 'coin') next.coins -= count; else next.bag[id] -= count;
      }
      for (const [id, count] of Object.entries(trade.receive)) next.bag[id] += count;
      return { ok: true, message: `完成「${trade.name}」。` };
    });
  }

  function useItem(run, itemId, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      if (!Object.hasOwn(next.bag, itemId) || next.bag[itemId] < 1) return { ok: false, message: '背包裡沒有這件道具。' };
      if (itemId === 'feather') return { ok: false, message: '復甦羽會在受到致命傷時自動保護你。' };
      if (itemId === 'heal' && next.hp >= 100) return { ok: false, message: '生命已滿，先把療癒藥留著吧。' };
      if (itemId === 'ration' && next.hunger >= 100) return { ok: false, message: '飽食度已滿，暫時不需要乾糧。' };
      const effect = { id: itemId };
      if (itemId === 'heal') { effect.healed = Math.min(35, 100 - next.hp); next.hp += effect.healed; }
      if (itemId === 'ration') { effect.fed = Math.min(45, 100 - next.hunger); next.hunger += effect.fed; }
      const timed = { shield: ['shield', 25], hourglass: ['freeze', 25], bell: ['repel', 20], map: ['reveal', 18] };
      if (timed[itemId]) {
        const [key, seconds] = timed[itemId];
        if (next.effects[key] > 0) return { ok: false, message: '這個效果仍在持續，不需重複使用。' };
        next.effects[key] = seconds; effect.duration = seconds;
      }
      next.bag[itemId] -= 1;
      return { ok: true, message: `使用${ITEMS[itemId].name}。`, effect };
    });
  }

  function collect(run, itemId, quantity = 1) {
    return transaction(run, undefined, (next) => {
      if (!Object.hasOwn(ITEMS, itemId) || !validNumber(quantity, 1, MAX_COINS, true)) return { ok: false, message: '無效的拾取物。' };
      if (itemId === 'coin') {
        if (next.coins + quantity > MAX_COINS) return { ok: false, message: '銅幣已達上限。' };
        next.coins += quantity;
      } else {
        if (next.bag[itemId] + quantity > MAX_STACK) return { ok: false, message: '背包數量已滿。' };
        next.bag[itemId] += quantity;
      }
      return { ok: true, message: `拾取${ITEMS[itemId].name} × ${quantity}。` };
    });
  }

  function takeDamage(run, amount) {
    return transaction(run, undefined, (next) => {
      if (!validNumber(amount, 0, 10000)) return { ok: false, message: '無效的傷害數值。' };
      const damage = amount === 0 ? 0 : (next.effects.shield > 0 ? Math.max(1, Math.round(amount * 0.35)) : amount);
      next.hp = Math.max(0, next.hp - damage);
      let revived = false;
      if (next.hp === 0 && next.bag.feather > 0) {
        next.bag.feather -= 1; next.hp = 50; next.effects.shield = Math.max(5, next.effects.shield); revived = true;
      } else if (next.hp === 0) next.status = 'dead';
      return { ok: true, message: revived ? '復甦羽化作光芒，讓你重新站起。' : next.status === 'dead' ? '旅程暫時停在這裡。' : '受到傷害。', effect: { damage, revived } };
    });
  }

  function tickEffects(run, seconds) {
    return transaction(run, undefined, (next) => {
      if (!validNumber(seconds, 0, 60)) return { ok: false, message: '無效的時間間隔。' };
      for (const id of Object.keys(next.effects)) next.effects[id] = Math.max(0, next.effects[id] - seconds);
      next.elapsed += seconds;
      next.floorElapsed += seconds;
      return { ok: true, message: '' };
    });
  }

  function descend(run, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      next.coins = Math.min(MAX_COINS, next.coins + floorConfig(next.floor).rewardCoins);
      next.floorsCleared += 1;
      next.effects = { shield: 0, freeze: 0, repel: 0, reveal: 0 };
      next.claimed = []; next.floorElapsed = 0;
      if (next.floor === 1) {
        next.status = 'won';
        return { ok: true, message: ENDING.text, effect: { ending: true } };
      }
      next.floor -= 1;
      return { ok: true, message: `抵達第 ${next.floor} 層。`, effect: { floor: next.floor } };
    });
  }

  return Object.freeze({ STATE_VERSION, ITEMS, MONSTERS, CHAPTERS, OPENING, ENDING, EXCHANGES, floorConfig, newRun, validateSave, buy, sell, exchange, useItem, collect, takeDamage, tickEffects, descend });
});
