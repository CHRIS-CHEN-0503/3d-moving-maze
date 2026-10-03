/* The descending tower: deterministic rules shared by the browser and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATE_VERSION = 2;
  const MAX_HP = 60;
  const MAX_MONSTERS = 32; // Stable original/lord IDs plus the finite reinforcement roster; live caps are 10/15/20.
  const validMonsterId = (id, floor = 99) => typeof id === 'string' && (/^monster-(0|[1-9]\d*)$/.test(id) && Number(id.slice(8)) < (floor < 0 ? 13 : 12) || /^monster-r-[1-9]\d{0,5}-[0-2]$/.test(id));
  const isFloor = floor => Number.isInteger(floor) && (floor >= 1 && floor <= 99 || floor >= -50 && floor <= -1);
  const isUnderworld = run => !!run && run.floor < 0 && run.underworld?.version === 1;
  const MAX_COINS = 999999;
  const MAX_STACK = 99;
  const HASTE_DURATION = 300, HASTE_PERCENT = 20;
  function hasteMultiplier(run,id=run?.party?.loadouts?.active){
    const loadouts=run?.party?.loadouts,active=loadouts?loadouts.actors?.[id]?.buffs?.some(b=>b.id==='haste'&&b.left>0):run?.effects?.haste>0;
    return active?1+HASTE_PERCENT/100:1;
  }
  // Every archer contributes a quiver, even while downed or not controlled.
  // Storage validation is deliberately wider: an archer leaving never deletes arrows.
  const itemStorageLimit = id => id === 'arrow' ? 3000 : MAX_STACK;
  function itemLimit(id,run){
    if(id!=='arrow')return MAX_STACK;
    const p=run?.party,capacity=(level,max)=>100+50*((Number.isInteger(level)?Math.max(1,Math.min(max,level)):1)-1);
    let total=p?.profession==='archer'?capacity(p.loadouts?.level,15):0;
    if(Array.isArray(p?.members))for(const m of p.members)if(m.profession==='archer')total+=capacity(m.level,10);
    return Math.max(100,Math.min(itemStorageLimit(id),total));
  }
  // Late lookup keeps the browser's core → narrative → dungeons loading order safe.
  const narrativeRules = () => typeof module === 'object' && module.exports ? require('./tower-narrative.js') : globalThis.TowerNarrative;
  const dungeonRules = () => typeof module === 'object' && module.exports ? require('./tower-dungeons.js') : globalThis.TowerDungeons;
  const partyRules = () => typeof module === 'object' && module.exports ? require('./tower-party-core.js') : globalThis.TowerPartyCore;
  const heroRules = () => typeof module === 'object' && module.exports ? require('./tower-heroes-core.js') : globalThis.TowerHeroes;
  const expeditionRules = () => typeof module === 'object' && module.exports ? require('./tower-expedition-core.js') : globalThis.TowerExpedition;
  const underworldRules = () => typeof module === 'object' && module.exports ? require('./tower-underworld.js') : globalThis.TowerUnderworld;
  function adventureEventRules(){if(typeof module!=='object'||!module.exports)return globalThis.TowerAdventureEvents;try{return require('./tower-adventure-events.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;return undefined;}}
  function validateGearAffixes(value){let rules=globalThis.TowerAffixes;if(typeof module==='object'&&module.exports){try{rules=require('./tower-affixes.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}return rules?rules.validateGear(value):value.affix===undefined&&value.affixRoll===undefined?{}:null;}
  const GEAR = Object.freeze({
    helmet: Object.freeze({ kind: 'helmet', slot: 'helmet', name: '頭盔', defense: 2, stunSeconds: 0, buyPrice: 14 }),
    armor: Object.freeze({ kind: 'armor', slot: 'armor', name: '盔甲', defense: 4, stunSeconds: 0, buyPrice: 22 }),
    shield: Object.freeze({ kind: 'shield', slot: 'shield', name: '盾牌', defense: 3, stunSeconds: 0, buyPrice: 18 }),
    bat: Object.freeze({ kind: 'bat', slot: 'weapon', name: '球棒', defense: 0, stunSeconds: 15, buyPrice: 16 }),
    pan: Object.freeze({ kind: 'pan', slot: 'weapon', name: '平底鍋', defense: 0, stunSeconds: 20, buyPrice: 20 }),
    staff: Object.freeze({ kind: 'staff', slot: 'weapon', name: '木杖', defense: 0, stunSeconds: 10, buyPrice: 12 }),
    ...(heroRules()?.GEAR||{}),
  });
  const EQUIPMENT_SLOTS = ['helmet', 'armor', 'shield', 'weapon'];
  // Supply identities must remain available in the standalone/legacy browser
  // core too. Optional profession scripts must not make valid saved inventory
  // look like unknown keys or silently discard it. The full bundle uses the
  // robot catalogue; parity tests keep this compatibility copy exact.
  const ROBOT_FUEL_COMPAT = Object.freeze({
    power_glimmer:Object.freeze({id:'power_glimmer',name:'微光動力石',description:'只供機器人使用，補充25%能源。',fuel:25,dropRarity:'common',buyPrice:6,sellPrice:2,color:'#48a8ff'}),
    power_starlight:Object.freeze({id:'power_starlight',name:'星輝動力石',description:'只供機器人使用，補充50%能源；只可由怪物掉落或採集獲得。',fuel:50,dropRarity:'uncommon',buyPrice:null,sellPrice:null,color:'#a7eeee'}),
    power_sunheart:Object.freeze({id:'power_sunheart',name:'曜心動力石',description:'只供機器人使用，補滿100%能源；只可由怪物掉落或採集獲得。',fuel:100,dropRarity:'rare',buyPrice:null,sellPrice:null,color:'#ffd04d'}),
  });
  const ITEMS = Object.freeze({
    ...(heroRules()?.ROBOT?.FUEL_ITEMS||ROBOT_FUEL_COMPAT),
    heal: Object.freeze({ id: 'heal', name: '療癒藥', description: '恢復 35 點生命。', buyPrice: 14, sellPrice: 6, color: '#ff7889' }),
    ration: Object.freeze({ id: 'ration', name: '乾糧', description: '恢復 45 點飽食度。', buyPrice: 8, sellPrice: 3, color: '#efc073' }),
    haste: Object.freeze({ id: 'haste', name: '加速藥水', description: '使用者的移動速度與普通攻擊速度提高 '+HASTE_PERCENT+'%，持續五分鐘。不能疊加或刷新，不縮短技能冷卻與準備時間。', buyPrice: 24, sellPrice: 10, color: '#f3bc57' }),
    shield: Object.freeze({ id: 'shield', name: '星紋護盾', description: '職業旅程：最大生命35%的護盾，持續五分鐘。舊旅程：25秒減傷65%。', buyPrice: 18, sellPrice: 8, color: '#70bfff' }),
    hourglass: Object.freeze({ id: 'hourglass', name: '定牆沙漏', description: '暫停迷宮變形 25 秒。', buyPrice: 20, sellPrice: 9, color: '#ffd36f' }),
    bell: Object.freeze({ id: 'bell', name: '驅怪鈴', description: '讓怪物退避 20 秒。', buyPrice: 18, sellPrice: 8, color: '#bda2ff' }),
    map: Object.freeze({ id: 'map', name: '魔法地圖', description: '完整揭露當下迷宮直到變形，之後重新探索；出口路線額外指引 18 秒。', buyPrice: 12, sellPrice: 5, color: '#6de5d7' }),
    feather: Object.freeze({ id: 'feather', name: '復甦羽', description: '受到致命傷時自動消耗，恢復 50 點生命。', buyPrice: 45, sellPrice: 20, color: '#fff1bb' }),
    arrow: Object.freeze({ id: 'arrow', name: '箭矢', description: '共用箭袋累加每位射手的容量：每人1級100支，每級增加50支；無射手時100支。商店每包十支一枚銅幣；怪物若掉箭，每束50支。普通弓射消耗一支，箭雨與世界樹之箭消耗三支。', buyPrice: 1, buyQuantity: 10, sellPrice: 0, color: '#b3d79b' }),
    coin: Object.freeze({ id: 'coin', name: '銅幣', description: '與塔中的冒險者購買物資。', buyPrice: null, sellPrice: null, color: '#efc05e' }),
  });

  const MONSTERS = Object.freeze({
    shardseer: Object.freeze({id:'shardseer',name:'晶簇術士',strength:3,description:'先蓄力再射出晶光彈；側移閃避或躲到牆後，擊暈可中斷施法。',speed:1.45,damage:12,sight:11,color:0x63dbe9,shape:'caster',ranged:true}),
    clockmite: Object.freeze({ id: 'clockmite', name: '齒輪遊蟲', strength: 1, description: '緩慢巡邏的發條生物，靠近才會追逐；轉入岔路就能甩開。', speed: 1.25, damage: 8, sight: 7, color: 0xdba65f, shape: 'beetle' }),
    sentinel: Object.freeze({ id: 'sentinel', name: '石甲守衛', strength: 3, description: '腳步沉重、接觸傷害高，留意它把守的通道。', speed: 1.6, damage: 15, sight: 8, color: 0x839cae, shape: 'golem' }),
    wisp: Object.freeze({ id: 'wisp', name: '迷光幽靈', strength: 2, description: '在岔路間快速游移的幽光；驅怪鈴可以讓它遠離。', speed: 2.35, damage: 10, sight: 10, color: 0xa6a0ff, shape: 'wisp' }),
    hound: Object.freeze({ id: 'hound', name: '燼火獵犬', strength: 4, description: '塔底的敏捷獵手，追蹤範圍大；善用護盾與變形的圍牆。', speed: 2.75, damage: 18, sight: 12, color: 0xff9868, shape: 'hound' }),
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

  function floorConfig(floor, seed = 1) {
    if (!isFloor(floor)) throw new RangeError('樓層必須是地上 1 至 99 或地下 1 至 50 的整數，不存在第零層。');
    if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new RangeError('無效的旅程種子。');
    if (floor < 0) return underworldRules().floorConfig(floor, seed);
    const chapter = CHAPTERS.find((entry) => floor <= entry.high && floor >= entry.low);
    const depth = 99 - floor;
    // Roll once per journey/floor, never per render, maze shift or reload.
    const sizeStep = (chapter.size - 7) / 2;
    const monsterMin = 1 + sizeStep, monsterMax = 5 + sizeStep;
    let roll = (seed ^ Math.imul(floor, 0x9e3779b9)) >>> 0;
    roll = Math.imul(roll ^ roll >>> 16, 0x21f0aaad);
    roll = Math.imul(roll ^ roll >>> 15, 0x735a2d97);
    const monsterCount = monsterMin + ((roll ^ roll >>> 15) >>> 0) % (monsterMax - monsterMin + 1);
    const monsterTypes = ['clockmite'];
    if (floor < 70) {
      monsterTypes.push('sentinel');
      if (floor <= 54) monsterTypes.push('wisp');
      if (floor <= 24) monsterTypes.push('hound');
      if (floor <= 54) monsterTypes.push('shardseer');
    }
    return {
      floor, size: chapter.size, shiftSeconds: 150 - depth,
      themeIndex: chapter.themeIndex, environmentId: chapter.id, chapter: chapter.chapter, name: chapter.name,
      monsterTypes, monsterCount, count: monsterCount, monsterMin, monsterMax,
      monsterStrengthBonus: Math.floor(depth / 25),
      merchant: floor === 99 || floor === chapter.high || floor % 5 === 0,
      rewardCoins: 6 + Math.floor(depth / 12), narrative: floor === chapter.high ? chapter.narrative : '',
      floorTitle: `第 ${floor} 層 · ${chapter.name}`,
    };
  }

  function newRun(options) {
    const opts = options || {};
    const seed = Number.isInteger(opts.seed) && opts.seed > 0 && opts.seed <= 0xffffffff ? opts.seed : ((Date.now() >>> 0) || 1);
    return {
      stateVersion: STATE_VERSION, mode: 'tower', floor: 99, hp: MAX_HP, hunger: 100, coins: 24,
      bag: { heal: 2, ration: 2, haste: 0, shield: 0, hourglass: 0, bell: 0, map: 1, feather: 0, arrow: 0, ...Object.fromEntries(Object.keys(ITEMS).filter(k=>ITEMS[k].fuel).map(k=>[k,0])) },
      effects: { shield: 0, freeze: 0, repel: 0, reveal: 0, haste: 0 },
      engine: { shovels: 1, kites: 0, whistles: 0, shovelCooldownMs: 0, skillCooldownMs: 0 },
      claimed: [], floorElapsed: 0, warrior: null, hiredWarriors: [], defeatedMonsters: [],
      equipment: { helmet: null, armor: null, shield: null, weapon: createGear('staff', 99, seed, 'starter') },
      gearBag: [], monsterStuns: {}, adventure: newAdventure(),
      chronicle: narrativeRules().newChronicle(99), expedition: dungeonRules().newExpedition(),
      revision: 0, seed, name: typeof opts.name === 'string' ? opts.name.trim().slice(0, 24) || '冒險者' : '冒險者',
      charIdx: Number.isInteger(opts.charIdx) && opts.charIdx >= 0 && opts.charIdx < 6 ? opts.charIdx : 0,
      status: 'playing', elapsed: 0, floorsCleared: 0,
    };
  }

  function validNumber(value, low, high, integer) {
    return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high && (!integer || Number.isInteger(value));
  }

  function validIds(ids, limit) {
    return Array.isArray(ids) && ids.length <= limit && ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 80) && new Set(ids).size === ids.length;
  }

  function newAdventure() { return { version: 1, claimed: [], quest: null, groceryPurchases: {} }; }

  function validateAdventure(value, floor, seed) {
    if (value === undefined) return newAdventure();
    const ids = (list, limit) => Array.isArray(list) && list.length <= limit && list.every(id => typeof id === 'string' && id.length > 0 && id.length <= 96) && new Set(list).size === list.length;
    if (!value || value.version !== 1 || !ids(value.claimed, 128)) return null;
    const encounters = typeof module === 'object' && module.exports ? require('./tower-encounters.js') : globalThis.TowerEncounters;
    // The original standalone core/dungeon bundle has no merchant module.
    // It can migrate an empty ledger, but must never trust or discard purchases.
    const rawPurchases=value.groceryPurchases,emptyPurchases=rawPurchases===undefined||rawPurchases&&Object.prototype.toString.call(rawPurchases)==='[object Object]'&&Object.keys(rawPurchases).length===0;
    const purchases = typeof encounters?.validateGroceryPurchases==='function'?encounters.validateGroceryPurchases(rawPurchases,floor,seed):emptyPurchases?{}:null;
    if (!purchases) return null;
    const events=value.events===undefined?undefined:adventureEventRules()?.validate(value.events,{floor,seed});
    if(value.events!==undefined&&!events)return null;
    let quest = null;
    if (value.quest !== null) {
      const q = value.quest;
      if (!q || !ids([q.id], 1) || !ids([q.target], 1) || q.floor !== floor || !['defeat', 'escort', 'relic', 'donate', 'survey', 'shift', 'stun'].includes(q.type) || !['active', 'ready', 'claimed'].includes(q.status) || !validNumber(q.goal, 1, 3, true) || !validNumber(q.progress, 0, q.goal, true) || !ids(q.events, 32)) return null;
      if ((q.status === 'active' && q.progress >= q.goal) || (q.status !== 'active' && q.progress !== q.goal)) return null;
      quest = { id: q.id, floor: q.floor, type: q.type, status: q.status, target: q.target, goal: q.goal, progress: q.progress, events: [...q.events] };
    }
    return { version: 1, claimed: [...value.claimed], quest, groceryPurchases: purchases,...(events?{events}:{}) };
  }

  function originalDurabilityMultiplier(kind) {
    const robot=heroRules()?.ROBOT;
    if(robot?.isPart(kind))return robot.repairMultiplier(kind);
    const item=GEAR[kind];
    return (item?.slot==='weapon'||item?.type==='heavy'||['helmet','armor','shield','round_shield','tower_shield'].includes(item?.baseKind||kind)?15:10)*4/3;
  }
  const DURABILITY_VERSION=6;
  function durabilityMultiplier(kind) {const item=GEAR[kind],base=item?.baseKind||kind;return originalDurabilityMultiplier(kind)*(['spellbook','cooking_pan'].includes(base)?1.25:1);}
  function durabilityMinimumRoll(kind) {return Math.min(7,Math.max(3,2+(GEAR[kind]?.tier||1)));}
  // Higher ranks improve minimum workmanship, without inflating the upper end.
  // Version five's double-rounded light values remain the migration source.
  function durabilityForRoll(kind,roll) {const base=originalDurabilityMultiplier(kind),v5=Math.round(Math.max(durabilityMinimumRoll(kind),roll)*(base/2))*2;return Math.round(v5*durabilityMultiplier(kind)/base);}
  function createGear(kind, floor, seed, sourceId, enhanced = false) {
    floorConfig(floor);
    if (!Object.hasOwn(GEAR, kind) || !validNumber(seed, 1, 0xffffffff, true) || typeof sourceId !== 'string' || !sourceId || sourceId.length > 96 || typeof enhanced !== 'boolean') throw new RangeError('無效的裝備來源。');
    if(heroRules()?.ROBOT?.definition(kind))return heroRules().ROBOT.createGear(kind,floor,seed,sourceId);
    let hash = (seed ^ Math.imul(floor, 0x9e3779b9)) >>> 0;
    for (const char of `${sourceId}:${kind}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    const tier = floor >= 70 ? 1 : floor >= 40 ? 2 : 3;
    const bonus = enhanced ? 1 + hash % tier : 0;
    const maximum = [0, 13, 16, 20][tier];
    const minimum=durabilityMinimumRoll(kind);
    const maxDurability = durabilityForRoll(kind,enhanced ? 10 + (hash >>> 8) % (maximum - 9) : minimum + (hash >>> 8) % (11-minimum));
    const item = GEAR[kind];
    return { id: `gear:${floor}:${seed}:${sourceId}:${kind}`, kind, slot: item.slot, name: item.name + (bonus ? ` +${bonus}` : ''), durability: maxDurability, maxDurability, durabilityVersion:DURABILITY_VERSION, defense: item.slot === 'weapon' ? 0 : item.defense + bonus, bonus };
  }

  function validateGear(value) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(GEAR, value.kind) || typeof value.id !== 'string' || !value.id || value.id.length > 160) return null;
    if(heroRules()?.ROBOT?.definition(value.kind))return heroRules().ROBOT.validateGear(value);
    const item = GEAR[value.kind];
    const legacy=value.durabilityVersion===undefined,priorMultiplier=originalDurabilityMultiplier(value.kind)/2;
    if(!legacy&&![2,3,4,5,DURABILITY_VERSION].includes(value.durabilityVersion))return null;
    // Validate in the source version's units before upgrading, exactly once.
    const mult=legacy?1:value.durabilityVersion===2?priorMultiplier*1.5/5:value.durabilityVersion===3?priorMultiplier*1.5:priorMultiplier;
    if (value.slot !== item.slot || !validNumber(value.bonus, 0, 3, true) || !validNumber(value.maxDurability, 1, 800, true) || !validNumber(value.durability, 0, value.maxDurability, true)) return null;
    const start=value.bonus?10:value.durabilityVersion===DURABILITY_VERSION?durabilityMinimumRoll(value.kind):3,rolls=Array.from({length:value.bonus?11:11-start},(_,i)=>i+start),sourceMax=rolls.map(n=>value.durabilityVersion===DURABILITY_VERSION?durabilityForRoll(value.kind,n):value.durabilityVersion===5?Math.round(n*priorMultiplier)*2:Math.round(n*mult)),roll=rolls[sourceMax.indexOf(value.maxDurability)];
    if(roll===undefined)return null;
    const name = item.name + (value.bonus ? ` +${value.bonus}` : '');
    const defense = item.slot === 'weapon' ? 0 : item.defense + value.bonus;
    if (value.name !== name || value.defense !== defense) return null;
    const forge=value.forge===undefined?undefined:expeditionRules()?.validateForge(value.forge,item.slot,item);
    if(value.forge!==undefined&&!forge)return null;
    const affixes=validateGearAffixes(value);if(!affixes)return null;
    const maxDurability=durabilityForRoll(value.kind,roll),durability=value.durability===0?0:Math.max(1,Math.min(maxDurability,Math.round(value.durability*maxDurability/value.maxDurability)));
    return { id: value.id, kind: value.kind, slot: item.slot, name, durability, maxDurability, durabilityVersion:DURABILITY_VERSION, defense, bonus: value.bonus,...(forge?{forge}:{}),...affixes };
  }

  function gearPrice(gear) {
    const item = validateGear(gear);
    if (!item) throw new RangeError('無效的裝備報價。');
    return GEAR[item.kind].buyPrice + Math.round(item.maxDurability / durabilityMultiplier(item.kind)) * 2 + item.bonus * 16;
  }

  function equipmentStats(run) {
    const worn = Object.values(run.equipment || {}).filter(g=>g&&g.durability>0);
    const defense = worn.reduce((sum, gear) => sum + gear.defense, 0);
    const bonus = worn.reduce((sum, gear) => sum + gear.bonus, 0);
    const weapon = run.equipment?.weapon?.durability>0?run.equipment.weapon:null;
    return { defense, bonus, stunSeconds: weapon ? GEAR[weapon.kind].stunSeconds + bonus * 10 : 0 };
  }

  function monsterStrength(kind, floor) {
    if (!Object.hasOwn(MONSTERS, kind)) throw new RangeError('找不到這種怪物。');
    return Math.min(5, MONSTERS[kind].strength + floorConfig(floor).monsterStrengthBonus);
  }

  function warriorOffer(floor, seed) {
    floorConfig(floor);
    if (!validNumber(seed, 1, 0xffffffff, true)) throw new RangeError('無效的旅程種子。');
    let state = (seed ^ Math.imul(floor, 0x9e3779b9)) >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    if (floor !== 99 && random() >= 0.3) return null;
    const maximum = Math.min(5, 1 + Math.floor((99 - floor) / 20));
    const strength = floor === 99 ? 1 : 1 + Math.floor(random() * maximum);
    const costs = [
      { coin: strength * 12 },
      { coin: strength * 6, ration: strength },
      { heal: Math.ceil(strength / 2), ration: strength },
      { coin: strength * 8, map: 1 },
    ];
    return {
      id: `warrior:${floor}:${seed}`, strength,
      name: ['護路劍士', '巡塔衛士', '鋼盾戰士', '誓約騎士', '曙光劍聖'][strength - 1],
      cost: floor === 99 ? { ration: 1 } : costs[Math.floor(random() * costs.length)],
    };
  }

  function validateSave(value) {
    let run = value;
    if (typeof run === 'string') { try { run = JSON.parse(run); } catch (_) { return null; } }
    if (!run || typeof run !== 'object' || Array.isArray(run) || ![1, STATE_VERSION].includes(run.stateVersion) || run.mode !== 'tower') return null;
    const legacyHealth = run.stateVersion === 1;
    // Broad first-pass bound includes robot_body; the validated actor's exact
    // maximum is checked below, so ordinary professions cannot gain extra HP.
    if (!isFloor(run.floor) || !validNumber(run.hp, 0, legacyHealth ? 100 : run.party?.loadouts?(isUnderworld(run)?132:117):MAX_HP) || !validNumber(run.hunger, 0, 100) || !validNumber(run.coins, 0, MAX_COINS, true)) return null;
    let underworld;
    if (run.floor < 0) {
      const u = run.underworld, departed = u?.departed, P = partyRules();
      if (!u || u.version !== 1 || !narrativeRules().ENDINGS.some(e => e.id === u.surfaceEnding) || run.chronicle?.ending !== u.surfaceEnding) return null;
      if (departed !== null && (!departed || !validIds([departed.id], 1) || departed.id === 'hero' || !Object.hasOwn(P.PROFESSIONS, departed.profession) || !['male', 'female'].includes(departed.sex) || departed.name !== P.person(departed.profession, departed.sex) || !run.party?.joined?.includes(departed.id))) return null;
      // The farewell remains part of the ending even after a later reunion.
      // Require a matching archived identity before accepting that return;
      // old saves with no traveller archive still retain their original ending.
      if (departed && run.party?.members?.some(m=>m.id===departed.id) && !run.party?.travellers?.some(t=>t.id===departed.id&&t.profession===departed.profession&&t.sex===departed.sex&&t.departedFloor>run.floor)) return null;
      underworld = { version: 1, departed: departed === null ? null : { id: departed.id, profession: departed.profession, sex: departed.sex, name: departed.name }, surfaceEnding: u.surfaceEnding };
    } else if (run.underworld !== undefined) return null;
    if (!validNumber(run.seed, 1, 0xffffffff, true) || !validNumber(run.revision, 0, Number.MAX_SAFE_INTEGER - 1, true) || !validNumber(run.charIdx, 0, 5, true)) return null;
    if (typeof run.name !== 'string' || !run.name.trim() || run.name.length > 24 || !['playing', 'won', 'dead'].includes(run.status)) return null;
    if (!validNumber(run.elapsed, 0, 315360000) || !validNumber(run.floorsCleared, 0, 149, true)) return null;
    if (run.status === 'dead' && run.hp !== 0 || run.status === 'playing' && run.hp <= 0 || run.status === 'won' && (run.floor !== (underworld ? -50 : 1) || run.hp <= 0)) return null;
    if (run.floorsCleared !== (underworld ? run.status === 'won' ? 149 : 99 + (-run.floor - 1) : run.status === 'won' ? 99 : 99 - run.floor)) return null;
    if (!run.bag || typeof run.bag !== 'object' || Array.isArray(run.bag) || !run.effects || typeof run.effects !== 'object' || Array.isArray(run.effects)) return null;
    const bag = {};
    for (const id of Object.keys(ITEMS).filter((key) => key !== 'coin')) {
      // Old journeys get their initial quiver once, without resetting other inventory.
      if (id === 'arrow' && !Object.hasOwn(run.bag,id)) { bag.arrow=run.party?.loadouts&&(run.party.profession==='archer'||run.party.members?.some(m=>m.profession==='archer'))?30:0; continue; }
      if (id === 'haste' && !Object.hasOwn(run.bag,id)) { bag.haste=0; continue; }
      if (ITEMS[id].fuel && !Object.hasOwn(run.bag,id)) { bag[id]=0; continue; }
      if (!Object.hasOwn(run.bag, id) || !validNumber(run.bag[id], 0, itemStorageLimit(id), true)) return null;
      bag[id] = run.bag[id];
    }
    if (Object.keys(run.bag).some((id) => !Object.hasOwn(bag, id))) return null;
    const effects = {};
    for (const id of ['shield', 'freeze', 'repel', 'reveal']) {
      if (!Object.hasOwn(run.effects, id) || !validNumber(run.effects[id], 0, 120)) return null;
      effects[id] = run.effects[id];
    }
    if (run.effects.haste !== undefined && !validNumber(run.effects.haste,0,HASTE_DURATION)) return null;
    effects.haste = run.effects.haste ?? 0;
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
    // Optional exploration checkpoint; old saves remain valid. A changed layout rejects it at runtime.
    const map = run.engine.mapKnowledge;
    const sightRules=typeof module==='object'&&module.exports?require('../assets/maze-sight-core.js'):globalThis.MazeSightCore;
    if(run.engine.sightMemory&&sightRules){const seen=sightRules.restore(run.engine.sightMemory);if(seen&&typeof run.engine.sightMemory.key==='string'&&/^[a-f0-9]{1,8}$/.test(run.engine.sightMemory.key))engine.sightMemory={...sightRules.snapshot(seen),key:run.engine.sightMemory.key};}
    if (map && validNumber(map.w, 1, 25, true) && validNumber(map.h, 1, 25, true) && typeof map.key === 'string' && /^[a-f0-9]{1,8}$/.test(map.key) && typeof map.revealed === 'boolean' && typeof map.seen === 'string' && map.seen.length === map.w * map.h && !/[^01]/.test(map.seen)) {
      engine.mapKnowledge = { w: map.w, h: map.h, key: map.key, seen: map.seen, revealed: map.revealed };
    }
    if (!Array.isArray(run.claimed) || run.claimed.length > 128 || run.claimed.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 80) || new Set(run.claimed).size !== run.claimed.length) return null;
    if (!validNumber(run.floorElapsed, 0, 315360000)) return null;
    // Missing optional fields are v1 saves created before warrior contracts existed.
    const hiredWarriors = run.hiredWarriors === undefined ? [] : run.hiredWarriors;
    const defeatedMonsters = run.defeatedMonsters === undefined ? [] : run.defeatedMonsters;
    if (!validIds(hiredWarriors, 149) || !validIds(defeatedMonsters, 128)) return null;
    if (defeatedMonsters.some(id => /^monster-\d+$/.test(id) && !validMonsterId(id, run.floor))) return null;
    let warrior = null;
    if (run.warrior !== undefined && run.warrior !== null) {
      const guard = run.warrior;
      if (typeof guard !== 'object' || Array.isArray(guard) || typeof guard.offerId !== 'string' || !hiredWarriors.includes(guard.offerId) || !validNumber(guard.strength, 1, 5, true)) return null;
      if (!['escort', 'holding'].includes(guard.mode)) return null;
      if (guard.mode === 'escort' && (guard.targetId !== null || guard.remaining !== null)) return null;
      if (guard.mode === 'holding' && (!validIds([guard.targetId], 1) || defeatedMonsters.includes(guard.targetId) || !(guard.remaining === null || validNumber(guard.remaining, Number.MIN_VALUE, guard.strength * 60)))) return null;
      warrior = { offerId: guard.offerId, strength: guard.strength, mode: guard.mode, targetId: guard.targetId, remaining: guard.remaining };
    }
    const legacyEquipment = run.equipment === undefined && run.gearBag === undefined;
    const activeJob=run.party?.loadouts?.active==='hero'?run.party.profession:(Array.isArray(run.party?.members)?run.party.members:[]).find(m=>m?.id===run.party?.loadouts?.active)?.profession;
    const rawEquipment = legacyEquipment ? { helmet: null, armor: null, shield: null, weapon: createGear('staff', 99, run.seed, 'starter') } : activeJob==='robot'?heroRules().ROBOT.normalizeEquipment(run.equipment):run.equipment;
    const slots=activeJob==='robot'?[...EQUIPMENT_SLOTS,...heroRules().ROBOT.CORE_SLOTS]:EQUIPMENT_SLOTS;
    const rawBag = legacyEquipment ? [] : run.gearBag;
    if (!rawEquipment || Array.isArray(rawEquipment) || Object.keys(rawEquipment).length !== slots.length || !Array.isArray(rawBag) || rawBag.length > (underworld ? 28 : 24)) return null;
    const equipment = {}, gearBag = [], gearIds = new Set();
    for (const slot of slots) {
      if (!Object.hasOwn(rawEquipment, slot)) return null;
      const gear = rawEquipment[slot] === null ? null : validateGear(rawEquipment[slot]);
      if (rawEquipment[slot] !== null && (!gear || gear.slot !== (heroRules()?.ROBOT?.CORE_SLOTS.includes(slot)?'core':slot) || gearIds.has(gear.id))) return null;
      equipment[slot] = gear;
      if (gear) gearIds.add(gear.id);
    }
    for (const value of rawBag) {
      const gear = validateGear(value);
      if (!gear || gearIds.has(gear.id)) return null;
      gearIds.add(gear.id); gearBag.push(gear);
    }
    const rawStuns = run.monsterStuns === undefined ? {} : run.monsterStuns;
    if (!rawStuns || typeof rawStuns !== 'object' || Array.isArray(rawStuns) || Object.keys(rawStuns).length > 128) return null;
    const monsterStuns = {};
    for (const [id, seconds] of Object.entries(rawStuns)) {
      if (!validIds([id], 1) || /^monster-\d+$/.test(id) && !validMonsterId(id, run.floor) || ['__proto__', 'constructor', 'prototype'].includes(id) || defeatedMonsters.includes(id) || !validNumber(seconds, Number.MIN_VALUE, 140)) return null;
      monsterStuns[id] = seconds;
    }
    const adventure = validateAdventure(run.adventure, run.floor, run.seed);
    if (!adventure) return null;
    const chronicle = narrativeRules().validateChronicle(run.chronicle, run.floor);
    const expedition = dungeonRules().validateExpedition(run.expedition, run.floor, run.seed);
    if (!chronicle || !expedition) return null;
    const party = run.party === undefined ? undefined : partyRules()?.validate(run.party, run.floor, defeatedMonsters,hiredWarriors,run.seed);
    if (run.party !== undefined && !party) return null;
    if(party?.loadouts&&!heroRules().validEquipment({party,equipment,gearBag,floor:run.floor,underworld}))return null;
    if(party?.loadouts&&run.hp>heroRules().maxHp({party}))return null;
    const validated = {
      // Preserve the old health percentage once; subsequent reads are already v2.
      stateVersion: STATE_VERSION, mode: 'tower', floor: run.floor, hp: legacyHealth ? run.hp * MAX_HP / 100 : run.hp, hunger: run.hunger,
      coins: run.coins, bag, effects, revision: run.revision, seed: run.seed, name: run.name,
      charIdx: run.charIdx, status: run.status, elapsed: run.elapsed, floorsCleared: run.floorsCleared,
      engine, claimed: [...run.claimed], floorElapsed: run.floorElapsed,
      warrior, hiredWarriors: [...hiredWarriors], defeatedMonsters: [...defeatedMonsters],
      equipment, gearBag, monsterStuns, adventure,
      chronicle, expedition, ...(party ? { party } : {}), ...(underworld ? { underworld } : {}),
    };
    // Only strictly validated gear may be pruned. Do not hide malformed or
    // duplicate cores, and never replace an expired six-slot core with a gift.
    heroRules()?.ROBOT?.pruneExpiredCores(validated);
    return validated;
  }

  function failure(run, message) { return { ok: false, run, message }; }
  function transaction(run, expectedRevision, action) {
    const next = validateSave(run);
    if (!next) return failure(run, '旅程資料不完整，請重新載入存檔。');
    if (next.status !== 'playing') return failure(run, '這趟旅程已經結束。');
    if (expectedRevision !== undefined && expectedRevision !== next.revision) return failure(run, '背包已更新，請重新確認交易。');
    const result = action(next);
    if (!result.ok) return failure(run, result.message);
    if(next.party?.loadouts)heroRules().sync(next);
    next.revision += 1;
    return { ...result, run: next };
  }

  // These helpers mutate only a transaction's private, validated copy.
  function receiveGear(next, value) {
    const gear = validateGear(value);
    if (!gear || heroRules()?.ROBOT?.isExpiredCore(gear)) return { ok: false, message: '無效或已耗盡的裝備。' };
    if (next.gearBag.length >= 24) return { ok: false, message: '裝備行囊已滿，請先捨棄不需要的裝備。' };
    if ((next.party?.loadouts?heroRules().allGear(next):[...next.gearBag, ...Object.values(next.equipment).filter(Boolean)]).some(item => item.id === gear.id)) return { ok: false, message: '你已經擁有這件裝備。' };
    next.gearBag.push(gear);
    return { ok: true, message: `${gear.name}已放入裝備行囊，記得穿戴。`, effect: { gear } };
  }

  function grantGear(run, gear, expectedRevision) {
    return transaction(run, expectedRevision, next => receiveGear(next, gear));
  }

  function equipGear(run, gearId, expectedRevision) {
    if(run.party?.loadouts)return heroRules().equip(run,run.party.loadouts.active,gearId,expectedRevision);
    return transaction(run, expectedRevision, next => {
      const index = next.gearBag.findIndex(gear => gear.id === gearId);
      if (index < 0) return { ok: false, message: '行囊裡沒有這件裝備。' };
      const [gear] = next.gearBag.splice(index, 1);
      const previous = next.equipment[gear.slot];
      if (previous) next.gearBag.push(previous);
      next.equipment[gear.slot] = gear;
      return { ok: true, message: `已裝備${gear.name}。`, effect: { equipped: gear, previous } };
    });
  }

  function discardGear(run, gearId, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const integrated=heroRules()?.allGear(next).find(g=>g.id===gearId);
      if(heroRules()?.ROBOT?.isPart(integrated?.kind))return {ok:false,message:'機殼與雙拳是機體的一部分，不能捨棄。'};
      const index = next.gearBag.findIndex(gear => gear.id === gearId);
      let removed;
      if (index >= 0) [removed] = next.gearBag.splice(index, 1);
      else {
        const slot = EQUIPMENT_SLOTS.find(key => next.equipment[key] && next.equipment[key].id === gearId);
        if (!slot) return { ok: false, message: '找不到這件裝備。' };
        removed = next.equipment[slot]; next.equipment[slot] = null;
      }
      return { ok: true, message: `已捨棄${removed.name}。`, effect: { discarded: removed } };
    });
  }

  function buyGear(run, gear, cost, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      const item = validateGear(gear);
      if (!item || cost !== gearPrice(item)) return { ok: false, message: '裝備報價已變更，請重新確認。' };
      if (next.coins < cost) return { ok: false, message: '銅幣不足。' };
      const received = receiveGear(next, item);
      if (!received.ok) return received;
      next.coins -= cost;
      return received;
    });
  }

  function effectiveMonsterStrength(run, monsterId, baseStrength) {
    if (!validNumber(baseStrength, 1, 5, true) || !validIds([monsterId], 1)) throw new RangeError('無效的怪物強度。');
    return Math.max(0, baseStrength - (run.monsterStuns && run.monsterStuns[monsterId] > 0 ? 1 : 0));
  }

  function hitMonster(run, monsterId, baseStrength, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      if(next.party?.loadouts&&heroRules().job(next)==='robot'&&!heroRules().ROBOT.powered(next))return {ok:false,message:'能源耗盡，先使用動力石補能。'};
      if (!validIds([monsterId], 1) || ['__proto__', 'constructor', 'prototype'].includes(monsterId) || !validNumber(baseStrength, 1, 5, true)) return { ok: false, message: '這次沒有擊中怪物。' };
      if (next.defeatedMonsters.includes(monsterId)) return { ok: false, message: '這隻怪物已經被擊敗。' };
      const weapon = next.equipment.weapon;
      if (!weapon) return { ok: false, message: '請先裝備球棒、平底鍋或木杖。' };
      if (!Object.hasOwn(next.monsterStuns, monsterId) && Object.keys(next.monsterStuns).length >= 128) return { ok: false, message: '目前樓層的戰鬥紀錄已滿。' };
      const stunSeconds = equipmentStats(next).stunSeconds;
      next.monsterStuns[monsterId] = Math.max(next.monsterStuns[monsterId] || 0, stunSeconds);
      weapon.durability -= 1;
      const broken = weapon.durability === 0 ? [weapon] : [];
      if (broken.length) next.equipment.weapon = null;
      return { ok: true, message: `怪物被擊暈 ${stunSeconds} 秒，暈眩期間強度降低 1 分。${broken.length ? `${weapon.name}已損壞。` : ''}`, effect: { monsterId, stunSeconds, effectiveStrength: baseStrength - 1, broken } };
    });
  }

  function defeatWithWarrior(next, monsterId, strength) {
    if (next.defeatedMonsters.length >= 128) return { ok: false, message: '目前樓層的戰鬥紀錄已滿。' };
    const guard = next.warrior;
    guard.strength -= strength; guard.mode = 'escort'; guard.targetId = null; guard.remaining = null;
    next.defeatedMonsters.push(monsterId);
    delete next.monsterStuns[monsterId];
    return { ok: true, message: `戰士立即擊敗怪物，剩餘 ${guard.strength} 分戰力繼續護行。`, effect: { outcome: 'defeat', monsterId, seconds: 0, remainingStrength: guard.strength } };
  }

  function resolveHeldMonster(run, monsterId, baseStrength, expectedRevision) {
    return transaction(run, expectedRevision, next => {
      if (!validIds([monsterId], 1) || !validNumber(baseStrength, 1, 5, true)) return { ok: false, message: '無效的怪物資料。' };
      const guard = next.warrior;
      if (!guard || guard.mode !== 'holding' || guard.targetId !== monsterId) return { ok: false, message: '這隻怪物沒有正在與戰士交戰。' };
      const strength = effectiveMonsterStrength(next, monsterId, baseStrength);
      if (guard.strength > strength) return defeatWithWarrior(next, monsterId, strength);
      if (guard.strength < strength && guard.remaining === null) {
        guard.remaining = guard.strength * 60;
        return { ok: true, message: `怪物恢復戰力，戰士還能抵禦 ${guard.remaining} 秒。`, effect: { outcome: 'hold', monsterId, seconds: guard.remaining, changed: true } };
      }
      return { ok: true, message: '戰士仍在牽制怪物。', effect: { outcome: 'hold', monsterId, seconds: guard.remaining } };
    });
  }

  function hireWarrior(run, offerId, expectedRevision, replaceOfferId = null) {
    return transaction(run, expectedRevision, (next) => {
      const offer = warriorOffer(next.floor, next.seed);
      if (!offer || offer.id !== offerId) return { ok: false, message: '這位戰士不在目前樓層。' };
      if (next.warrior && next.warrior.offerId !== replaceOfferId) return { ok: false, message: '目前已有戰士，請先確認解聘並改聘。' };
      if (replaceOfferId !== null && (!next.warrior || next.warrior.offerId !== replaceOfferId)) return { ok: false, message: '原護衛契約已改變，請重新確認。' };
      if (next.hiredWarriors.includes(offer.id)) return { ok: false, message: '這位戰士已履行過這趟旅程的委託。' };
      if (next.hiredWarriors.length >= 99) return { ok: false, message: '這趟旅程的委託紀錄已滿。' };
      for (const [id, count] of Object.entries(offer.cost)) {
        if ((id === 'coin' ? next.coins : next.bag[id]) < count) return { ok: false, message: '委託所需的物資不足。' };
      }
      for (const [id, count] of Object.entries(offer.cost)) {
        if (id === 'coin') next.coins -= count; else next.bag[id] -= count;
      }
      const dismissed = next.warrior;
      next.hiredWarriors.push(offer.id);
      next.warrior = { offerId: offer.id, strength: offer.strength, mode: 'escort', targetId: null, remaining: null };
      return { ok: true, message: `${offer.name}接受委託，將替你迎戰一隻靠近的怪物。`, effect: { hired: true, strength: offer.strength, dismissedOfferId: dismissed?.offerId || null, releasedMonsterId: dismissed?.targetId || null } };
    });
  }

  function interceptMonster(run, monsterId, strength, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      if (!validIds([monsterId], 1) || !validNumber(strength, 0, 5, true) || strength === 0 && !(next.monsterStuns[monsterId] > 0)) return { ok: false, message: '無效的怪物資料。' };
      if (!next.warrior || next.warrior.mode !== 'escort') return { ok: false, message: '沒有可迎戰的護行戰士。' };
      if (next.defeatedMonsters.includes(monsterId)) return { ok: false, message: '這隻怪物已經被擊敗。' };
      const guard = next.warrior;
      if (guard.strength > strength) return defeatWithWarrior(next, monsterId, strength);
      guard.mode = 'holding'; guard.targetId = monsterId;
      guard.remaining = guard.strength === strength ? null : guard.strength * 60;
      return { ok: true, message: guard.remaining === null ? '戰士與怪物勢均力敵，將持續牽制，快趁現在前進！' : `戰士替你抵禦 ${guard.remaining} 秒，快趁現在前進！`, effect: { outcome: 'hold', monsterId, seconds: guard.remaining } };
    });
  }

  function supplyPrice(itemId, quantity = 1) {
    const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
    if (!item || !validNumber(item.buyPrice, 1, MAX_COINS, true) || !validNumber(quantity, 1, itemStorageLimit(itemId), true)) return null;
    // Coins stay integral, including a partial arrow bundle when filling a nearly full bag.
    return Math.ceil(quantity / (item.buyQuantity || 1)) * item.buyPrice;
  }
  function buy(run, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
      if (!item || !validNumber(item.buyPrice, 1, MAX_COINS, true) || !validNumber(quantity, 1, itemLimit(itemId,next), true)) return { ok: false, message: '無效的購買項目或數量。' };
      const cost = supplyPrice(itemId, quantity);
      if (next.coins < cost) return { ok: false, message: '銅幣不足。' };
      if (next.bag[itemId] + quantity > itemLimit(itemId,next)) return { ok: false, message: '這種道具的背包數量已滿。' };
      next.coins -= cost; next.bag[itemId] += quantity;
      return { ok: true, message: `獲得 ${item.name} × ${quantity}。` };
    });
  }

  function sell(run, itemId, quantity = 1, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
      if (!item || !validNumber(item.sellPrice, 1, MAX_COINS, true) || !validNumber(quantity, 1, itemStorageLimit(itemId), true)) return { ok: false, message: '無效的出售項目或數量。' };
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
        if (next.bag[id] - (trade.give[id] || 0) + count > itemLimit(id,next)) return { ok: false, message: '背包數量已滿，無法交換。' };
      }
      for (const [id, count] of Object.entries(trade.give)) {
        if (id === 'coin') next.coins -= count; else next.bag[id] -= count;
      }
      for (const [id, count] of Object.entries(trade.receive)) next.bag[id] += count;
      return { ok: true, message: `完成「${trade.name}」。` };
    });
  }

  function useItem(run, itemId, expectedRevision) {
    if(run.party?.loadouts){const growth=typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;return growth.use(run,itemId,undefined,false,expectedRevision);}
    return transaction(run, expectedRevision, (next) => {
      if (!Object.hasOwn(next.bag, itemId) || next.bag[itemId] < 1) return { ok: false, message: '背包裡沒有這件道具。' };
      if (itemId === 'feather') return { ok: false, message: '復甦羽會在受到致命傷時自動保護你。' };
      if (itemId === 'arrow') return { ok: false, message: '箭矢會在弓射時自動使用，不需要手動使用。' };
      if (ITEMS[itemId]?.fuel) return {ok:false,message:'動力石只供職業旅程中的機器人使用。'};
      const maximum=next.party?.loadouts?heroRules().maxHp(next):MAX_HP;
      if (itemId === 'heal' && next.hp >= maximum) return { ok: false, message: '生命已滿，先把療癒藥留著吧。' };
      if (itemId === 'ration' && next.hunger >= 100) return { ok: false, message: '飽食度已滿，暫時不需要乾糧。' };
      const effect = { id: itemId };
      if (itemId === 'haste') {
        if (next.effects.haste > 0) return {ok:false,message:'加速藥水仍在生效，不需重複使用。'};
        next.effects.haste=HASTE_DURATION; effect.duration=HASTE_DURATION;
      }
      if (itemId === 'heal') { effect.healed = Math.min(35, maximum - next.hp); next.hp += effect.healed; }
      if (itemId === 'ration') { effect.fed = Math.min(45*(next.party?.loadouts?1+heroRules().teamPassive(next,'gourmet')/100:1), 100 - next.hunger); next.hunger += effect.fed;if(next.party?.loadouts)heroRules().food(next); }
      const timed = { shield: ['shield', 25], hourglass: ['freeze', 25], bell: ['repel', 20], map: ['reveal', 18] };
      if (timed[itemId]) {
        const [key, seconds] = timed[itemId];
        if (next.effects[key] > 0) return { ok: false, message: '這個效果仍在持續，不需重複使用。' };
        next.effects[key] = seconds*(next.party?.loadouts?1+heroRules().pv(next,'extension')/100:1); effect.duration = next.effects[key];
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
        if (next.bag[itemId] + quantity > itemLimit(itemId,next)) return { ok: false, message: '背包數量已滿。' };
        next.bag[itemId] += quantity;
      }
      return { ok: true, message: `拾取${ITEMS[itemId].name} × ${quantity}。` };
    });
  }

  function applyDamage(next, amount, source = 'monster', invulnerable = false, monsterId = null) {
    if (!validNumber(amount, 0, 10000) || !['monster', 'trap', 'hunger'].includes(source)) return { ok: false, message: '無效的傷害數值或來源。' };
    if(invulnerable===true)return {ok:true,message:'受傷保護中。',effect:{damage:0,revived:false,defense:0,broken:[],source,protected:true}};
    if(next.party?.loadouts)return heroRules().hurt(next,next.party.loadouts.active,amount,source,monsterId);
    if (next.party) amount = partyRules().reduceDamage(next, amount, source);
    const defense = source === 'hunger' ? 0 : equipmentStats(next).defense;
    const reduced = Math.max(0, amount - defense);
    const damage = source === 'hunger' ? amount : reduced === 0 ? 0 : next.effects.shield > 0 ? Math.max(1, Math.round(reduced * 0.35)) : reduced;
    const broken = [];
    if (amount > 0 && source !== 'hunger') {
      for (const slot of ['helmet', 'armor', 'shield']) {
        const gear = next.equipment[slot];
        if (!gear) continue;
        if(next.party)expeditionRules().wear(next,gear);else gear.durability -= 1;
        if (gear.durability === 0) { broken.push(gear); next.equipment[slot] = null; }
      }
    }
    next.hp = Math.max(0, next.hp - damage);
    let revived = false;
    if (next.hp === 0 && next.bag.feather > 0) {
      next.bag.feather -= 1; next.hp = Math.min(50, MAX_HP); next.effects.shield = Math.max(5, next.effects.shield); revived = true;
    } else if (next.hp === 0) next.status = 'dead';
    return { ok: true, message: revived ? '復甦羽化作光芒，讓你重新站起。' : next.status === 'dead' ? '旅程暫時停在這裡。' : damage === 0 ? '防具擋住了這次攻擊。' : '受到傷害。', effect: { damage, revived, defense, broken, source } };
  }

  function takeDamage(run, amount, source = 'monster', monsterId = null) {
    return transaction(run, undefined, next => applyDamage(next, amount, source, false, monsterId));
  }

  function tickEffects(run, seconds) {
    return transaction(run, undefined, (next) => {
      if (!validNumber(seconds, 0, 60)) return { ok: false, message: '無效的時間間隔。' };
      for (const id of Object.keys(next.effects)) next.effects[id] = Math.max(0, next.effects[id] - seconds);
      if (!next.expedition.active) for (const id of Object.keys(next.monsterStuns)) {
          next.monsterStuns[id] = Math.max(0, next.monsterStuns[id] - seconds);
          if (next.monsterStuns[id] === 0) delete next.monsterStuns[id];
        }
      next.elapsed += seconds;
      next.floorElapsed += seconds;
      if (next.party) partyRules().tick(next, seconds);
      if (!next.expedition.active && next.warrior && next.warrior.mode === 'holding' && next.warrior.remaining !== null) {
        next.warrior.remaining = Math.max(0, next.warrior.remaining - seconds);
        if (next.warrior.remaining === 0) {
          const targetId = next.warrior.targetId;
          next.warrior = null;
          return { ok: true, message: '戰士已用盡力量撤離，怪物恢復行動。', effect: { warriorReleased: true, targetId } };
        }
      }
      return { ok: true, message: '' };
    });
  }

  function startUnderworld(run, expectedRevision) {
    const next = validateSave(run);
    if (!next) return failure(run, '旅程資料不完整，請重新載入存檔。');
    if (expectedRevision !== undefined && expectedRevision !== next.revision) return failure(run, '旅程已更新，請重新確認。');
    if (next.underworld || next.status !== 'won' || next.floor !== 1 || !next.chronicle.ending || next.expedition.active) return failure(run, '請先完成地上高塔的結局，再開始地下遠征。');
    const P = partyRules(), H = heroRules();
    // The seed and sorted saved identities fix the choice before any scene or
    // animation runs. Reloading the same ending can never reroll the farewell.
    const candidates = [...(next.party?.members || [])].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    let choice = next.seed >>> 0;
    for (const char of 'underworld:departure') choice = Math.imul(choice ^ char.charCodeAt(0), 16777619) >>> 0;
    const companion = candidates.length ? candidates[choice % candidates.length] : null;
    const departed = companion ? { id: companion.id, profession: companion.profession, sex: companion.sex, name: P.person(companion.profession, companion.sex) } : null;
    const returned = [];
    if (next.party?.loadouts) {
      // A companion may have led the victorious party. Preserve each person's
      // own equipment and HP before removing anyone; only a fallen hero gets 1 HP.
      H.returnToHero(next);
      // A completed tower's old overflow is not underground training. The
      // separate surface snapshot still retains the original saved XP.
      if(H.level(next,'hero')===10){const growth=typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;H.state(next).xp=Math.min(H.state(next).xp,growth.XP[9]);}
      if (companion) { P.archiveMember(next, companion); if(companion.profession!=='robot')returned.push(...Object.values(H.equipment(next, companion.id)).filter(Boolean)); next.gearBag.push(...returned); H.removeMember(next, companion.id); }
    }
    if (companion && !next.party?.loadouts) P.archiveMember(next, companion);
    if (companion) next.party.members = next.party.members.filter(m => m.id !== companion.id);
    next.underworld = { version: 1, departed, surfaceEnding: next.chronicle.ending };
    next.floor = -1; next.status = 'playing'; next.floorsCleared = 99;
    next.claimed = []; next.floorElapsed = 0; next.defeatedMonsters = []; next.monsterStuns = {}; next.adventure = newAdventure();
    next.effects = { shield: 0, freeze: 0, repel: 0, reveal: 0, haste: next.effects.haste || 0 };
    delete next.engine.sightMemory; delete next.engine.mapKnowledge;
    next.expedition.discovered = false; next.expedition.active = null;
    if (next.warrior?.mode === 'holding') next.warrior = null;
    if (next.party) P.advance(next, { reward: false });
    next.revision += 1;
    const checked = validateSave(next);
    if (!checked) return failure(run, '地下遠征資料尚未準備完成，原旅程已保留。');
    return { ok: true, run: checked, message: departed ? `${departed.name}決定留下守望歸途，將裝備交還給你。地下遠征開始。` : '地下遠征開始。', effect: { underworld: true, departed, returnedGear: returned.map(g => g.id), floor: -1 } };
  }

  function descend(run, expectedRevision) {
    return transaction(run, expectedRevision, (next) => {
      const previousFloor=next.floor,events=next.adventure.events;
      if (next.expedition.active) return { ok: false, message: '請先離開裂隙副本，再繼續往下探索。' };
      if (next.party && !partyRules().canDescend(next)) return { ok: false, message: '請先解除迷宮封印並擊敗樓層主，才能往下走。' };
      if (!narrativeRules().canDescend(next)) return { ok: false, message: '章末之門尚未開啟，請先找到本章主線印記。' };
      if (next.floor === 1 && next.chronicle.ending === null) return { ok: false, message: '請先在塔心選擇高塔的未來，再踏出歸途之門。' };
      next.coins = Math.min(MAX_COINS, next.coins + floorConfig(next.floor).rewardCoins);
      next.floorsCleared += 1;
      next.effects = { shield: 0, freeze: 0, repel: 0, reveal: 0, haste: next.effects.haste || 0 };
      next.claimed = []; next.floorElapsed = 0; next.defeatedMonsters = [];
      delete next.engine.sightMemory; delete next.engine.mapKnowledge;
      next.monsterStuns = {}; next.adventure = newAdventure();
      if(events)next.adventure.events=events;
      next.expedition.discovered = false;
      if (next.warrior && next.warrior.mode === 'holding') next.warrior = null;
      if (next.floor === 1 || next.floor === -50) {
        if(next.party){next.party.loot={version:1,rolled:[],entries:[]};next.party.reinforcements={version:1,shift:0,monsters:[]};next.party.health={};next.party.poise={};if(next.party.loadouts)next.party.loadouts.enemy={};}
        if(next.floor===-50&&next.party?.loadouts)heroRules().gainXp(next,360);
        next.status = 'won';
        return { ok: true, message: next.floor < 0 ? '你們走完地下五十層，讓深處的回聲也找到了歸途。' : ENDING.text, effect: { ending: true, ...(next.floor < 0 ? { underworld: true } : {}) } };
      }
      next.floor -= 1;
      if (next.party) partyRules().advance(next);
      if(events)adventureEventRules()?.advance(next,previousFloor);
      next.expedition.version = dungeonRules().CATALOG_VERSION;
      return { ok: true, message: next.floor < 0 ? `抵達地下第 ${-next.floor} 層。` : `抵達第 ${next.floor} 層。`, effect: { floor: next.floor } };
    });
  }

  return Object.freeze({ STATE_VERSION, MAX_HP, MAX_MONSTERS, HASTE_DURATION, HASTE_PERCENT, hasteMultiplier, validMonsterId, isFloor, isUnderworld, ITEMS, itemLimit, itemStorageLimit, GEAR, MONSTERS, CHAPTERS, OPENING, ENDING, EXCHANGES, floorConfig, newRun, validateSave, supplyPrice, buy, sell, exchange, useItem, collect, takeDamage, tickEffects, startUnderworld, descend, monsterStrength, warriorOffer, hireWarrior, interceptMonster, createGear, validateGear, originalDurabilityMultiplier, durabilityMultiplier, durabilityMinimumRoll, durabilityForRoll, DURABILITY_VERSION, gearPrice, equipmentStats, receiveGear, grantGear, equipGear, discardGear, buyGear, effectiveMonsterStrength, hitMonster, resolveHeldMonster, transaction, applyDamage, newAdventure, validateAdventure });
});
