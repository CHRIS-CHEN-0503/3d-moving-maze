/* Deterministic tower shops, chests and optional explorer errands. */
(function (root, factory) {
  const api = factory(() => typeof module === 'object' && module.exports ? require('./story-core.js') : root.TowerCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerEncounters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  const GROCERY = Object.freeze({ merchantId: 'suHe', chance: .4, commonIngredients: Object.freeze(['root', 'mushroom', 'herb', 'nectar']), commonPrice: 2, specialtyPrice: 5, minStock: 1, maxStock: 5 });
  const MERCHANTS = Object.freeze({
    tieLing: Object.freeze({ id: 'tieLing', name: '鐵嶺', title: '鐵匠', greeting: '我是鐵匠鐵嶺。頭盔與近戰武器，交給我就放心。', equipmentKinds: Object.freeze(['helmet', 'bat']), supplies: Object.freeze([]) }),
    jinHe: Object.freeze({ id: 'jinHe', name: '錦禾', title: '裁甲師', greeting: '我是裁甲師錦禾。合身的盔甲，會陪你走得更遠。', equipmentKinds: Object.freeze(['armor', 'pan']), supplies: Object.freeze([]) }),
    lanZhou: Object.freeze({ id: 'lanZhou', name: '嵐舟', title: '盾匠', greeting: '我是盾匠嵐舟。盾牌與遠行武器，都在這裡。', equipmentKinds: Object.freeze(['shield', 'staff']), supplies: Object.freeze([]) }),
    suHe: Object.freeze({ id: 'suHe', name: '蘇禾', title: '雜貨商', sex: 'female', greeting: '我是雜貨商蘇禾。藥水、食材和旅途補給，都替你備好了。', equipmentKinds: Object.freeze([]), get supplies() { return Object.freeze(Object.keys(core().ITEMS).filter(id => id !== 'coin' && core().ITEMS[id].buyPrice != null)); } }),
  });
  // The same catalogue drives sales and professional maintenance. Every base
  // weapon belongs to exactly one merchant, across all five equipment tiers.
  const MERCHANT_SERVICES=Object.freeze({
    tieLing:Object.freeze({slot:'helmet',weaponKinds:Object.freeze(['longsword','greatsword','smith_hammer','warhammer']),legacyWeapons:Object.freeze(['bat'])}),
    jinHe:Object.freeze({slot:'armor',weaponKinds:Object.freeze(['cooking_pan','twin_daggers']),legacyWeapons:Object.freeze(['pan'])}),
    lanZhou:Object.freeze({slot:'shield',weaponKinds:Object.freeze(['arcane_staff','spellbook','elven_bow']),legacyWeapons:Object.freeze(['staff'])}),
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
  const COUNTS = { 7: [1, 1, 2], 9: [1, 2, 3], 11: [2, 2, 4], 13: [2, 3, 5], 15: [3, 3, 6], 17: [3, 4, 7], 19: [4, 4, 8], 21: [4, 5, 9] };
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  const validFloor = floor => integer(floor, 1, 99) || integer(floor, -50, -1);
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 96;
  const uniqueIds = (value, max) => Array.isArray(value) && value.length <= max && value.every(validId) && new Set(value).size === value.length;
  function randomFor(floor, seed, salt) {
    if (!validFloor(floor) || !integer(seed, 1, 0xffffffff)) throw new RangeError('無效的樓層或旅程種子。');
    let state = (seed ^ Math.imul(floor, 7919) ^ salt) >>> 0;
    return () => { state = (state + 0x6d2b79f5) >>> 0; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function explorerIdentity(floor, seed) {
    // Identity has its own stream: do not consume the encounter or quest draws.
    const random = randomFor(floor, seed, 0x683f47), ids = Object.keys(EXPLORERS);
    return { ...EXPLORERS[ids[Math.floor(random() * ids.length)]] };
  }
  const materials = () => typeof module === 'object' && module.exports ? require('./tower-materials.js') : globalThis.TowerMaterials;
  function groceryCatalogue(floor, seed) {
    // Independent stream: adding a grocery never changes the three equipment vendors.
    const random = randomFor(floor, seed, 0x6a09e667);
    if (random() >= GROCERY.chance) return null;
    const roll = Math.floor(random() * (floor < 0 ? 149 : 99)), sourceFloor = roll < 99 ? roll + 1 : 98 - roll;
    const M = materials(), specialty = M.signature(sourceFloor), stock = () => 1 + Math.floor(random() * GROCERY.maxStock);
    return [
      ...GROCERY.commonIngredients.map(ingredientId => ({ id: `grocery:${floor}:common:${ingredientId}`, ingredientId, name: M.INGREDIENTS[ingredientId], sourceFloor: null, sourceName: '常備食材', specialty: false, price: GROCERY.commonPrice, stock: stock() })),
      { id: `grocery:${floor}:special:${sourceFloor}:${specialty}`, ingredientId: specialty, name: M.INGREDIENTS[specialty], sourceFloor, sourceName: M.ecology(sourceFloor).name, specialty: true, price: GROCERY.specialtyPrice, stock: stock() },
    ];
  }
  function groceryPurchases(value, floor, seed) {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > GROCERY.commonIngredients.length + 1) return null;
    const result = {}, ingredients = materials().INGREDIENTS;
    let specials = 0;
    for (const [id, count] of Object.entries(value)) {
      const match = /^grocery:(-?\d+):(common|special):(?:(-?\d+):)?([a-z]+)$/.exec(id);
      if (!match || !validFloor(Number(match[1])) || String(Number(match[1])) !== match[1] || floor !== undefined && Number(match[1]) !== floor || !integer(count, 0, GROCERY.maxStock) || !Object.hasOwn(ingredients, match[4])) return null;
      if (match[2] === 'common') { if (match[3] || !GROCERY.commonIngredients.includes(match[4])) return null; }
      else {
        const source = Number(match[3]);
        if (++specials > 1 || !validFloor(source) || String(source) !== match[3] || Number(match[1]) > 0 && source < 0 || materials().signature(source) !== match[4]) return null;
      }
      result[id] = count;
    }
    if (seed !== undefined && Object.keys(result).length) {
      if (!validFloor(floor) || !integer(seed, 1, 0xffffffff)) return null;
      const offers = groceryCatalogue(floor, seed) || [];
      if (Object.entries(result).some(([id, count]) => !offers.some(offer => offer.id === id && count <= offer.stock))) return null;
    }
    return result;
  }
  function groceryOffers(run) {
    if (!run || run.expedition?.active) return [];
    const purchases = groceryPurchases(run.adventure?.groceryPurchases, run.floor, run.seed);
    if (!purchases) return [];
    return (groceryCatalogue(run.floor, run.seed) || []).map(offer => ({ ...offer, purchased: purchases[offer.id] || 0, remaining: Math.max(0, offer.stock - (purchases[offer.id] || 0)) }));
  }
  function newAdventure() { return { version: 1, claimed: [], quest: null, groceryPurchases: {} }; }
  function validateAdventure(value, floor, seed) {
    if (floor !== undefined && !validFloor(floor)) return null;
    if (value === undefined) return newAdventure();
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !uniqueIds(value.claimed, 128)) return null;
    const purchases = groceryPurchases(value.groceryPurchases, floor, seed);
    if (!purchases) return null;
    let quest = null;
    if (value.quest !== null) {
      const q = value.quest;
      if (!q || typeof q !== 'object' || Array.isArray(q) || !validId(q.id) || !validId(q.target) || !validFloor(q.floor) || (floor !== undefined && q.floor !== floor)) return null;
      if (!QUEST_TYPES.includes(q.type) || !['active', 'ready', 'claimed'].includes(q.status) || !integer(q.goal, 1, 3) || !integer(q.progress, 0, q.goal) || !uniqueIds(q.events, 32)) return null;
      if ((q.status === 'active' && q.progress >= q.goal) || (q.status !== 'active' && q.progress !== q.goal)) return null;
      quest = { id: q.id, floor: q.floor, type: q.type, status: q.status, target: q.target, goal: q.goal, progress: q.progress, events: [...q.events] };
    }
    const Events=typeof module==='object'&&module.exports?require('./tower-adventure-events.js'):globalThis.TowerAdventureEvents,events=value.events===undefined?undefined:Events?.validate(value.events,{floor,seed});
    if(events===null||value.events!==undefined&&!events)return null;
    return { version: 1, claimed: [...value.claimed], quest, groceryPurchases: purchases,...(events?{events}:{}) };
  }
  function floorLootCounts(size) {
    if (!Object.hasOwn(COUNTS, size)) throw new RangeError('未知的迷宮尺寸。');
    const [itemCount, foodCount, storyCount] = COUNTS[size];
    return { itemCount, foodCount, storyCount, total: itemCount + foodCount + storyCount };
  }
  function arrowLoot(run,size=core().floorConfig(run.floor).size){
    if(!Object.hasOwn(COUNTS,size)||!run.party?.loadouts||!(run.party.profession==='archer'||run.party.members.some(m=>m.profession==='archer')))return [];
    // Separate from ordinary items and deterministic across reloads/maze shifts.
    const count=Math.ceil((size-5)/4);
    return Array.from({length:count},(_,i)=>({id:'arrows:'+run.floor+':'+i,kind:'arrow',quantity:10}));
  }
  function merchantOffers(floor, seed, modern=false) {
    const C = core(), random = randomFor(floor, seed, 0x24181), ids = Object.keys(MERCHANT_SERVICES);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const count = floor < 70 && random() < .45 ? 2 : 1;
    const shops = ids.slice(0, count).map(id => {
      const H=typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
      const old=MERCHANTS[id],entry=modern?{...old,equipmentKinds:H.gearPool(floor).filter(kind=>merchantHandles(id,kind))}:old;
      return { ...entry, equipmentKinds: [...entry.equipmentKinds], supplies: [], gear: entry.equipmentKinds.map(kind => {
        const gear = C.createGear(kind, floor, seed, `shop:${floor}:${id}:${kind}`, false);
        return { kind, gear, price: C.gearPrice(gear) };
      }) };
    });
    const ingredientOffers = groceryCatalogue(floor, seed);
    if (ingredientOffers) shops.push({ ...MERCHANTS.suHe, equipmentKinds: [], supplies: [...MERCHANTS.suHe.supplies].filter(key=>C.ITEMS[key]?.buyPrice!=null&&C.potionAvailable(key,floor)), gear: [], ingredientOffers });
    return shops;
  }
  function merchant(run, merchantId) { return merchantOffers(run.floor, run.seed,!!run.party?.loadouts).find(entry => entry.id === merchantId); }
  function merchantHandles(merchantId,gear){
    const rules=Object.hasOwn(MERCHANT_SERVICES,merchantId)?MERCHANT_SERVICES[merchantId]:null,kind=typeof gear==='string'?gear:gear?.kind,definition=core().GEAR[kind];
    if(!rules||!definition)return false;
    if(definition.integrated||definition.core)return merchantId==='tieLing';
    return definition.slot===rules.slot||definition.slot==='weapon'&&(rules.weaponKinds.includes(definition.baseKind||kind)||rules.legacyWeapons.includes(kind));
  }
  function serviceContext(run,merchantId){return run&&Object.hasOwn(MERCHANT_SERVICES,merchantId)&&merchant(run,merchantId)?{kind:'merchant',merchantId,floor:run.floor,seed:run.seed}:null;}
  function serviceAvailable(run,service,gear){
    return !!(run&&service?.kind==='merchant'&&service.floor===run.floor&&service.seed===run.seed&&merchant(run,service.merchantId)&&merchantHandles(service.merchantId,gear));
  }
  function failure(run, message) { return { ok: false, run, message }; }
  function transaction(run, expectedRevision, fn) {
    return core().transaction(run, expectedRevision, next => {
      const adventure = validateAdventure(next.adventure, next.floor, next.seed);
      if (!adventure) return { ok: false, message: '奇遇進度有誤，請重新讀取存檔。' };
      next.adventure = adventure;
      const result = fn(next);
      if (result.ok && !validateAdventure(next.adventure, next.floor, next.seed)) return { ok: false, message: '本層奇遇紀錄已滿，無法保存這次操作。' };
      return result;
    });
  }
  function buySupply(run, merchantId, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), shop = merchant(next, merchantId), item = C.ITEMS[itemId];
      if (next.expedition?.active || !shop || !shop.supplies.includes(itemId) || !item || !integer(quantity, 1, C.itemLimit(itemId,next))) return { ok: false, message: '這位商人沒有出售這件補給。' };
      const cost = C.supplyPrice(itemId, quantity);
      if (next.coins < cost || next.bag[itemId] + quantity > C.itemLimit(itemId,next)) return { ok: false, message: next.coins < cost ? '銅幣不足。' : '補給背包已滿。' };
      next.coins -= cost; next.bag[itemId] += quantity;
      return { ok: true, message: `向${shop.name}購買${item.name} × ${quantity}。` };
    });
  }
  function sellSupply(run, merchantId, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const C = core(), shop = merchant(next, merchantId), item = C.ITEMS[itemId];
      if (next.expedition?.active || !shop || !shop.supplies.includes(itemId) || !item || !(item.sellPrice > 0) || !integer(quantity, 1, C.itemStorageLimit(itemId))) return { ok: false, message: '這位商人不收購這件補給。' };
      if (next.bag[itemId] < quantity || next.coins + item.sellPrice * quantity > 999999) return { ok: false, message: '物資不足或銅幣已達上限。' };
      next.bag[itemId] -= quantity; next.coins += item.sellPrice * quantity;
      return { ok: true, message: `向${shop.name}出售${item.name} × ${quantity}。` };
    });
  }
  function buyIngredient(run, merchantId, offerId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      if (!next.party || merchantId !== GROCERY.merchantId || !integer(quantity, 1, GROCERY.maxStock)) return { ok: false, message: '這位商人沒有出售這份食材。' };
      const offers = groceryOffers(next), offer = offers.find(entry => entry.id === offerId);
      if (!offer) return { ok: false, message: '本層沒有這份食材，請重新確認攤位。' };
      if (quantity > offer.remaining) return { ok: false, message: '這份食材的本層庫存不足。' };
      if (next.party.ingredients[offer.ingredientId] + quantity > 99) return { ok: false, message: '食材袋已滿。' };
      const cost = offer.price * quantity;
      if (next.coins < cost) return { ok: false, message: '銅幣不足。' };
      next.coins -= cost; next.party.ingredients[offer.ingredientId] += quantity;
      next.adventure.groceryPurchases[offer.id] = offer.purchased + quantity;
      return { ok: true, message: `向蘇禾購買${offer.name} × ${quantity}。`, effect: { ingredient: offer.ingredientId, quantity, sourceFloor: offer.sourceFloor } };
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
  function chestOffer(floor, seed, modern=false) {
    const C = core(), random = randomFor(floor, seed, 0x74e12);
    if (random() >= .2) return null;
    const id = `chest:${floor}:${seed}`;
    if (random() < .35) return { id, outcome: 'trap', damage: 12 + Math.floor((99 - floor) / 10), gear: null };
    const H=modern?(typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes):null;
    const pool=modern?H.gearPool(floor):GEAR_KINDS,kind=pool[Math.floor(random()*pool.length)];
    return { id, outcome: 'gear', damage: 0, gear: C.createGear(kind, floor, seed, id, true) };
  }
  function openChest(run, chestId, expectedRevision, invulnerable = false) {
    return transaction(run, expectedRevision, next => {
      const C = core(), offer = chestOffer(next.floor, next.seed,!!next.party?.loadouts);
      if (!offer || offer.id !== chestId) return { ok: false, message: '這個樓層沒有這只寶箱。' };
      if (next.adventure.claimed.includes(offer.id)) return { ok: false, message: '寶箱已經開啟。' };
      const result = offer.outcome === 'gear' ? C.receiveGear(next, offer.gear) : C.applyDamage(next, offer.damage, 'trap', invulnerable);
      if (!result.ok) return result;
      next.adventure.claimed.push(offer.id);
      return { ok: true, message: offer.outcome === 'gear' ? '寶箱中藏著強化裝備。' : '寶箱觸發陷阱！', effect: { ...result.effect, outcome: offer.outcome, gear: offer.gear, damage: offer.outcome === 'trap' ? result.effect.damage : 0 } };
    });
  }
  function questReward(floor, seed, modern=false) {
    const C = core(), random = randomFor(floor, seed, 0x257ca), coins = 12 + Math.floor((99 - floor) / 6);
    if (random() < .45) {
      const H=modern?(typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes):null;
      const pool=modern?H.gearPool(floor):GEAR_KINDS,kind=pool[Math.floor(random()*pool.length)];
      return { coins, items: {}, gear: C.createGear(kind, floor, seed, `quest-reward:${floor}:${seed}`, true) };
    }
    const id = ['heal', 'ration', 'shield', 'hourglass'][Math.floor(random() * 4)];
    return { coins, items: { [id]: id === 'ration' ? 2 : 1 }, gear: null };
  }
  // Survey: the maze is split into 3 x 3 blocks; the commission marks three of
  // them, pairwise far apart and never the starting block, and each must be
  // entered in person. Older saved surveys (target 'cells') keep three cells.
  const SURVEY_ZONES = 3;
  const SURVEY_SETS = (() => { const all = []; for (let y = 0; y < SURVEY_ZONES; y++) for (let x = 0; x < SURVEY_ZONES; x++) if (x || y) all.push([x, y]); const sets = [];
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) for (let c = b + 1; c < all.length; c++) { const set = [all[a], all[b], all[c]]; if (set.every((p, i) => set.every((q, j) => i === j || Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1])) >= 2))) sets.push(set); }
    return Object.freeze(sets.map(Object.freeze)); })();
  const surveyZones = q => q?.type === 'survey' && typeof q.target === 'string' && q.target.startsWith('zones:') ? q.target.slice(6).split('_').map(z => z.split('-').map(Number)) : null;
  const zoneOf = (x, y, size) => [Math.min(SURVEY_ZONES - 1, Math.floor(x * SURVEY_ZONES / size)), Math.min(SURVEY_ZONES - 1, Math.floor(y * SURVEY_ZONES / size))];
  // The centre cell of a block, for the map beacon.
  const zoneCenter = ([zx, zy], size) => ({ x: Math.min(size - 1, Math.floor((zx + .5) * size / SURVEY_ZONES)), y: Math.min(size - 1, Math.floor((zy + .5) * size / SURVEY_ZONES)) });
  const surveyKey = ([zx, zy]) => `zone:${zx}-${zy}`;
  // Blocks still to visit, with their beacon cells (empty for older cell surveys).
  function surveyTargets(run) { const q = run?.adventure?.quest, zones = surveyZones(q); if (!zones || q.status !== 'active') return []; const size = core().floorConfig(run.floor).size; return zones.filter(z => !q.events.includes(surveyKey(z))).map(z => ({ zone: z, ...zoneCenter(z, size) })); }
  function describeQuest(q, run) {
    const C = core(), types = {
      defeat: ['清除路障', run.party?.loadouts?'與隊友擊敗指定的守路怪物，再回來領取報酬。':'讓護衛擊敗指定的守路怪物，再回來領取報酬。'], escort: ['護送迷途旅人', '帶我到本層出口，在樓梯旁等我跟上。領取報酬後再下樓。'],
      relic: ['遺失的記憶', '找到本層的委託記憶碎片，靠近拾取後回來交件；不是章節主線印記。'], donate: ['旅人的急需', `備齊 ${q.goal} 份${C.ITEMS[q.target]?.name || '補給'}，回到我身旁交付。`],
      survey: ['繪製迷宮', surveyZones(q) ? '接下委託後，走進小地圖上「測」標出的三個區塊，替我畫下那裡的路，再回來告訴我。' : '接下委託後，走訪三個不同的迷宮格，再回來告訴我。'], shift: ['觀察高塔心跳', '接下委託後，安全經歷一次迷宮變形，再回來領取報酬。'], stun: ['爭取逃脫時間', run.party?.loadouts?'擊敗指定怪物，或用技能擊暈、束縛牠，再回來領取報酬。':'用武器擊暈指定怪物一次，再回來領取報酬。'],
    };
    const explorer=explorerIdentity(run.floor,run.seed),nextStep=q.status==='ready'?'到'+explorer.name+'身旁領取報酬。':q.status==='claimed'?'報酬已領取，可以繼續探索。':types[q.type][1];
    return { ...q, title: types[q.type][0], description: types[q.type][1], nextStep,leaveWarning:'委託與尚未領取的報酬，只保留在目前這一層。', reward: questReward(run.floor, run.seed,!!run.party?.loadouts), explorer };
  }
  function explorerOffer(run) {
    const C = core(), random = randomFor(run.floor, run.seed, 0x5b31e);
    if (random() >= .2) return null;
    const adventure = validateAdventure(run.adventure, run.floor, run.seed);
    if (!adventure) return null;
    if (adventure.quest) return describeQuest(adventure.quest, run);
    if (adventure.claimed.includes(`abandoned:${run.floor}`)) return null;
    const config = C.floorConfig(run.floor,run.seed);
    const party = run.party ? (typeof module === 'object' && module.exports ? require('./tower-party-core.js') : globalThis.TowerPartyCore) : null;
    const roster = party ? party.monsterSpecs(run) : Array.from({length:config.monsterCount},(_,i)=>({id:`monster-${i}`,kind:run.floor<=54&&i===config.monsterCount-1?'shardseer':config.monsterTypes[i%config.monsterTypes.length]}));
    const alive = roster.filter(m => !run.defeatedMonsters.includes(m.id));
    const donations = DONATIONS.filter(id => run.bag[id] > 0);
    const candidates = ['escort', 'relic', 'survey', 'shift'];
    if (donations.length) candidates.push('donate');
    const defeatable = party ? alive[0] : run.warrior && run.warrior.mode === 'escort' ? alive.find(m => C.monsterStrength(m.kind, run.floor) < run.warrior.strength) : null;
    if (defeatable) candidates.push('defeat');
    if (!run.party?.loadouts && alive.length && run.equipment && run.equipment.weapon) candidates.push('stun');
    const type = candidates[Math.floor(random() * candidates.length)], target = type === 'defeat' ? defeatable.id : type === 'stun' ? alive[0].id : type === 'donate' ? donations[Math.floor(random() * donations.length)] : type === 'relic' ? `relic:${run.floor}:${run.seed}` : type === 'escort' ? 'exit' : type === 'survey' ? 'cells' : 'walls';
    const goal = type === 'donate' ? Math.min(run.bag[target], 1 + Math.floor(random() * 3)) : type === 'survey' ? 3 : 1;
    const marked = type === 'survey' ? 'zones:' + SURVEY_SETS[Math.floor(random() * SURVEY_SETS.length)].map(z => z.join('-')).join('_') : target;
    const id = `quest:${run.floor}:${run.seed}:${type}:${marked}:${goal}`;
    return describeQuest({ id, floor: run.floor, type, status: 'active', target: marked, goal, progress: 0, events: [] }, run);
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
    const modernControl=run.party?.loadouts&&existing?.type==='stun'&&['defeat','root'].includes(event);
    if (!existing || existing.status !== 'active' || (event !== existing.type&&!modernControl)) return failure(run, '目前沒有符合的進行中委託。');
    return transaction(run, undefined, next => {
      const q = next.adventure.quest;
      let key;
      if (event === 'defeat' || event === 'stun' || event==='root') {
        if ((data.monsterId || data.id) !== q.target || (event === 'defeat' && !next.defeatedMonsters.includes(q.target))) return { ok: false, message: '這不是委託指定的怪物。' };
        if (event === 'stun' && !(next.monsterStuns && next.monsterStuns[q.target] > 0)) return { ok: false, message: '指定怪物尚未被擊暈。' };
        if(event==='root'&&!(next.party?.loadouts?.enemy[q.target]?.root>0))return {ok:false,message:'指定怪物尚未被束縛。'};
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
        const zones = surveyZones(q);
        if (zones) { const zone = zoneOf(data.x, data.y, size); if (!zones.some(z => z[0] === zone[0] && z[1] === zone[1])) return { ok: false, message: '這個區塊不在委託標出的範圍。' }; key = surveyKey(zone); }
        else key = `${data.x},${data.y}`;
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
      const reward = questReward(next.floor, next.seed,!!next.party?.loadouts);
      if (next.coins + reward.coins > 999999 || Object.entries(reward.items).some(([id, amount]) => next.bag[id] + amount > C.itemLimit(id,next))) return { ok: false, message: '請先整理背包或銅幣，再領取報酬。' };
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
  return Object.freeze({ MERCHANTS, MERCHANT_SERVICES, GROCERY, groceryOffers, buyIngredient, validateGroceryPurchases: groceryPurchases, merchantHandles, serviceContext, serviceAvailable, EXPLORERS, QUEST_TYPES, SURVEY_ZONES, SURVEY_SETS, surveyTargets, newAdventure, validateAdventure, floorLootCounts, arrowLoot, merchantOffers, buySupply, sellSupply, buyMerchantGear, chestOffer, openChest, questReward, explorerIdentity, explorerOffer, acceptQuest, questProgress, claimQuestReward, abandonQuest });
});
