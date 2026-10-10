/* Read-only story inventory catalogue. Effects describe the current profession journey,
 * not the retired pre-profession save format. Existing game catalogues are authoritative. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StoryAtlasItems = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const moduleFor = (file, name) => typeof module === 'object' && module.exports ? require('../story/' + file + '.js') : root[name];
  const core = () => moduleFor('story-core', 'TowerCore');
  const party = () => moduleFor('tower-party-core', 'TowerPartyCore');
  const materials = () => moduleFor('tower-materials', 'TowerMaterials');
  const heroes = () => moduleFor('tower-heroes-core', 'TowerHeroes');
  const light = () => moduleFor('tower-lighting-core', 'TowerLighting');
  const encounters = () => moduleFor('tower-encounters', 'TowerEncounters');
  const narrative = () => moduleFor('tower-narrative', 'TowerNarrative');
  const loot = () => moduleFor('tower-loot', 'TowerLoot');
  const foraging = () => moduleFor('tower-foraging', 'TowerForaging');
  const fieldGuide = () => moduleFor('tower-field-guide', 'TowerFieldGuide');
  const commission = () => moduleFor('tower-commission-cooking', 'TowerCommissionCooking');
  const robot = () => moduleFor('tower-robot-core', 'TowerRobotCore');
  const affixes = () => moduleFor('tower-affixes', 'TowerAffixes');
  const events = () => moduleFor('tower-adventure-events', 'TowerAdventureEvents');
  const landmarks = () => moduleFor('tower-landmarks', 'TowerLandmarks');
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const icon = (provider, key, source, extra = {}) => ({provider, key, source, ...extra});
  const filename = 'story/';
  const SOURCES = freeze({core: filename + 'story-core.js', party: filename + 'tower-party-core.js', heroes: filename + 'tower-heroes-core.js', growth: filename + 'tower-hero-growth.js', lighting: filename + 'tower-lighting-core.js', encounters: filename + 'tower-encounters.js', loot: filename + 'tower-loot.js', foraging: filename + 'tower-foraging.js', expedition: filename + 'tower-expedition-core.js', narrative: filename + 'tower-narrative.js', runtime: filename + 'tower-mode.js', commission:filename+'tower-commission-cooking.js',robot:filename+'tower-robot-core.js',affixes:filename+'tower-affixes.js',events:filename+'tower-adventure-events.js',landmarks:filename+'tower-landmarks.js'});
  const rarity = {heal:'uncommon', heal_mid:'uncommon', heal_high:'rare', spirit:'uncommon', haste_strong:'rare', arcane:'rare', courage:'rare', ration:'common', shield:'rare', hourglass:'rare', bell:'rare', map:'rare', feather:'legendary', arrow:'common'};
  const rarityNames = {common:'普通', uncommon:'少見', rare:'稀有', legendary:'珍稀'};
  const dropExplanation = '有生態素材的怪物先以一半機率選素材、一半選補給，再從該組候選物資中抽一種，依該物的稀有度判定；不是每件物品都獨立抽一次。四種常用食材（'+loot().COMMON_FOOD.map(key=>party().INGREDIENTS[key]).join('、')+'）被抽為候選後為普通 '+loot().chance({type:'ingredient',key:'herb',rarity:'common'})+'%；其他普通物資仍為 '+loot().CHANCES.common+'%。沒有素材的怪物只抽補給。落地後需靠近拾取，未拾取物跨存檔與同層變形保留。';
  const profileNames={neutral:'中性',suitable:'適合',unsuitable:'不適合'};
  const foragingExplanation='每層的香草（藥草）株數與自然礦石堆數獨立抽取，整體出現率依環境分類：'+Object.entries(profileNames).map(([id,name])=>name+'環境 '+(100-foraging().PROFILES[id][0])+'% 出現、'+foraging().PROFILES[id][0]+'% 不出現；1／2／3 處機率為 '+[1,2,3].map(n=>Number(foraging().PROFILES[id][n].toFixed(2))+'%').join('／')).join('；')+'。資源放在靠牆角落，每株或每堆採得 1 份；同層變形與讀檔不補回已採集資源，與討伐掉落分開計算。舊旅程已生成的株數與礦堆保留原狀，新樓層才套用新出現率。';
  const powerForagingExplanation='動力石採集獨立抽取每層至多一處礦簇，整體出現率依藥草的環境分類：'+Object.entries(profileNames).map(([id,name])=>name+'環境 '+(100-foraging().POWER_PROFILES[id][0])+'% 出現、'+foraging().POWER_PROFILES[id][0]+'% 不出現；微光／星輝／曜心機率為 '+[1,2,3].map(n=>Number(foraging().POWER_PROFILES[id][n].toFixed(2))+'%').join('／')).join('；')+'。新樓層每處只有 1 顆動力石，靠牆角落放置；背包已滿時不消耗它，同層變形與讀檔不補回已採集礦簇；舊旅程已生成的礦簇保留原狀，新樓層才套用新出現率。';
  function naturalSource(kind,key){
    const F=foraging(),regions=materials().ECOLOGIES.filter(e=>kind==='herb'||F.orePool({floor:e.high}).includes(key));
    return {kind,quantity:1,profiles:F.PROFILES,regions:regions.map(e=>({id:e.id,name:e.name,profile:F.REGIONS[e.id][kind]}))};
  }
  const naturalRegions=source=>source.regions.map(e=>e.name+'（'+profileNames[e.profile]+'）').join('、');
  const scope = freeze({
    title:'目前職業版劇情模式：地上高塔與地下五十層',
    notes:[
      '一般消耗補給不會在開局或變形時自然散放；來源為商人、料理、委託、討伐掉落及主線互動。靠牆角落的藥草與自然礦石是獨立採集資源，不是自然散放補給。',
      foragingExplanation,
      powerForagingExplanation,
      '自然礦堆依環境取得精鐵礦、共鳴晶片或星脈礦；星脈礦僅地下出現。藥草可作料理食材與藥草技能材料。',
      '雜貨商・蘇禾每層有 40% 機率出現，販售藥品、消耗道具、箭矢、火把、金屬零件（每層限量）、四種常用食材及一種隨機樓層特產。食材各限 1～5 份，同層變形／讀檔不補貨；地上可買其他地上樓層特產，地下可另抽到地下特產。三位裝備商只販售裝備並提供對應維護服務。',
      '蘇禾可代煮已解鎖食譜，沒有廚師也能委託。自備原配方全部食材，另付代煮費；每次固定一份，不觸發廚師的雙份或保鮮被動。',
      '共鳴晶凍、餘火椒根串與霜莓蜜煮另給享用者五分鐘單次異常保護，分別抵擋電麻、灼傷與中毒；不是五分鐘無敵，不為全隊同時套用。材料附魔的效果、成功率與費用可在鍛造分類查看。',
      '職業探索機關、固定景觀及兩選事件是地圖互動，不占背包。固定景觀的位置不隨同層迷宮變形移動；事件選擇會影響下一層，兩層後的後續留言可領取答謝或放棄，不阻擋主線。',
      '靠近且沒有牆遮擋的固定地標可按對話鈕觀察環境與下一步；人物對話與交易優先。日誌的線索手記、人物心事與選擇餘波只整理已讀故事、印記與事件紀錄，可重看原來源；事件紀錄未保存選項時會明示，不猜測。這些觀察不消耗、贈送資源或新增通關條件。',
      '生物誌先列當前環境的生態、可掉食材與應對，再收合其他已知生物；未遇見樓層主不提前顯示名字或故事。八職業的特效節奏及隊友選招、遠攻安全退步同步精修，不改原技能數值。',
      '動力石只供機器人補充能源：只有微光動力石可向蘇禾購買，星輝與曜心動力石只能採集或討伐取得。初始不贈送動力石；機器人滿能源可運作 '+robot().FUEL_SECONDS+' 秒，能源用盡仍保留內建照明與核心自修，但只能慢行，不能攻擊或施放技能。',
      dropExplanation,
      '主線印記與委託碎片是任務進度，不是可使用或販售的普通背包物品；固定機關、營地、陷阱與故事日誌紀念文字不算消耗道具。',
      '樓梯只在既有必要通關條件達成後顯示，未開啟時地板洞口、出口標記與路線也隱藏；七階石梯浮現後才可選擇下樓或留下。普通樓層不新增強制委託，裂隙需完成三段記憶。已開啟樓梯讀檔或同層變形不重播。',
      '一般模式的短效加速藥水、穿牆斗篷、風箏、集合口哨、超市商品與雞蛋不屬於目前劇情物資來源，因此不混列；劇情模式另有持續五分鐘的加速藥水。',
      '魔法地圖只有一種背包道具：揭露本次迷宮，並另給 18 秒出口路線。一般模式的 12 秒路線地圖，以及技能的暫時探路，不是第二件劇情道具。',
      '數值為未套用角色被動前的基礎效果；隨機被動、技能等級與穿戴裝備可進一步調整。'
    ]
  });
  function supplyRecords() {
    const C = core(), E = encounters(), L = loot(), R = robot();
    const effects = {
      heal:'為非機器人的使用者恢復 '+C.HEAL_POTIONS.heal+' 點生命，不超過個人生命上限；滿血不能使用。機器人不能用一般療癒藥恢復生命。',
      heal_mid:'為非機器人的使用者恢復 '+C.HEAL_POTIONS.heal_mid+' 點生命，不超過個人生命上限；滿血不能使用。自動喝藥時與其他療癒藥共用門檻與保留數量，依傷勢選用最合適的一瓶。',
      heal_high:'為非機器人的使用者恢復 '+C.HEAL_POTIONS.heal_high+' 點生命，不超過個人生命上限；滿血不能使用。',
      spirit:'為使用者恢復 '+C.SPIRIT_MP+' 點 MP，不超過個人上限；MP 已滿不能使用。機器人沒有 MP，技能改由動力石能源驅動。可放入快捷欄，或在自動行動設定中依 MP 門檻自動使用。',
      haste_strong:'為使用者提高移動速度與普通攻擊速度各 '+C.HASTE_STRONG_PERCENT+'%，持續 '+C.HASTE_DURATION+' 秒（五分鐘）；可取代仍在生效的一般加速藥水，強力加速仍在生效時不能再喝。不縮短技能冷卻或準備時間。',
      arcane:'使用者的法術攻擊力（法杖、法書光彈與法術技能）提高 '+C.POTION_BUFF_PERCENT+'%，持續 '+C.POTION_BUFF_SECONDS+' 秒（三分鐘）；仍在生效時不能再喝，切換角色不轉移。',
      shovel:'使用後裝上一把可用的鐵鍬（畫面上的鐵鍬鈕顯示數量），按鈕可敲開面前一面內牆；一次只能裝一把，背包最多帶 '+C.SHOVEL_SPARES+' 把備用。舊旅程也可使用。',
      forget:'退回一位隊員已分配的全部自由點數（每級 '+heroes().FREE_POINTS_PER_LEVEL+' 點），能力值回到職業基礎加等級成長，可立即重新分配；該隊員的自動配點同時關閉。沒有分配過點數時不能使用，也不會被自動喝下。請在隊伍管理的「能力值」分頁選擇隊員後使用。',
      courage:'使用者的物理攻擊力（近戰、弓箭與物理技能）提高 '+C.POTION_BUFF_PERCENT+'%，持續 '+C.POTION_BUFF_SECONDS+' 秒（三分鐘）；仍在生效時不能再喝，切換角色不轉移。',
      haste:'為使用者提高移動速度與普通攻擊速度各 '+C.HASTE_PERCENT+'%，持續 '+C.HASTE_DURATION+' 秒（五分鐘）。不縮短技能冷卻或準備時間；同效果不疊加、不刷新，仍在生效時不消耗第二瓶。不因延效被動延長，切換角色也不會轉給別人；暫停、閱讀與離線不扣時間。可放入快捷欄，或在自動道具設定中允許隊友遇敵時使用（預設關閉）。',
      ration:'恢復全隊共用飽食度 45 點，上限 100；不會恢復生命。營地不再提供乾糧全隊回滿的休息捷徑。',
      shield:'提供使用者最大生命 35% 的可消耗護盾，持續最多 300 秒（五分鐘）。護盾吸收傷害後會減少，不是五分鐘無敵。',
      hourglass:'暫停迷宮變形 25 秒。怪物、陷阱與戰鬥仍然繼續。',
      bell:'使怪物退避 20 秒；不等同無敵，仍須避免接觸傷害。',
      map:'完整揭露當下迷宮至下一次變形；同時顯示出口路線 18 秒。迷宮變形後重新探索，不揭露隔牆角色的即時行動。',
      feather:'非機器人的目前操控者受到致命傷時自動消耗一片，恢復最多 40 點生命（不超過個人上限）；不能手動使用，也不會自動替未操控的倒地隊友消耗。機器人不適用一般回復或復活效果。',
      arrow:'全隊共用箭袋，容量由每一名射手累加：每人 1 級 100 支，每升一級增加 50 支。主角若為射手也計入，倒地不減少容量，切換操控角色不改變容量。普通弓射及一般攻擊技能每次發射消耗 1 支；群星箭雨、世界樹之箭等標示 3 支的招式消耗 3 支；射空、撞牆也消耗。',
      coin:'共用貨幣，最高 999,999 枚。用於招募同伴、購買裝備／補給、修理與鍛造；不是可按下使用的消耗道具。'
    };
    return Object.entries(C.ITEMS).map(([key, def]) => {
      const fuel=R.FUEL_ITEMS[key],dropRarity=fuel?.dropRarity||rarity[key],fuelForaging=fuel?{kind:'power',tier:foraging().POWER_STONES.indexOf(key)+1,quantity:[foraging().POWER_DEPOSIT_QUANTITY,foraging().POWER_DEPOSIT_QUANTITY],profiles:foraging().POWER_PROFILES,regions:materials().ECOLOGIES.map(e=>({id:e.id,name:e.name,profile:foraging().REGIONS[e.id].herb})),cluster:true}:null;
      const sellers = Object.values(E.MERCHANTS).filter(m => m.supplies.includes(key)&&(!fuel||fuel.fuel===25)).map(m => m.title + '・' + m.name);
      const drop = dropRarity ? {rarity:dropRarity,label:rarityNames[dropRarity],conditionalPercent:L.CHANCES[dropRarity],quantity:key === 'arrow' ? L.ARROW_DROP_QUANTITY : 1} : null;
      const effect=fuel?'只供能行動的機器人使用，恢復 '+fuel.fuel+'% 能源，上限 100%；能源已滿時不消耗。滿能源可運作 '+R.FUEL_SECONDS+' 秒（十分鐘）；補充不延長核心耐久、不恢復生命，超過 100% 的部分不保留。能源用盡只可慢行，不能攻擊或施放技能，沒有額外生命損耗；內建光源與核心自修仍保留。':effects[key];
      const acquisition = [];
      if (sellers.length) acquisition.push(sellers.join('、') + '販售；' + (key === 'arrow' ? '每包 10 支只需 1 幣；剩餘空間不足 10 支時補滿仍收 1 幣，不回收。射手離隊造成容量下降時，已有箭矢保留，超過容量則不能補充。' : '購買 ' + def.buyPrice + ' 幣／售回 ' + def.sellPrice + ' 幣。'));
      if (drop) acquisition.push((key === 'arrow' ? '隊伍有能行動的射手時，' : fuel ? '隊伍有能行動的機器人時，' : '') + '被抽為討伐候選物資後，' + drop.label + '掉落判定 ' + drop.conditionalPercent + '%，每堆 ' + drop.quantity + (key === 'arrow' ? ' 支。' : fuel ? ' 顆。' : ' 份。'));
      if(fuel)acquisition.push((fuel.fuel>25?'商人不販售，只能靠討伐與採集取得。':'')+'另可採集靠牆角落的同階礦簇，新樓層每處 '+foraging().POWER_DEPOSIT_QUANTITY+' 顆；初始持有零顆。');
      if (Object.hasOwn(C.POTION_FLOORS,key)) acquisition.push(C.POTION_FLOORS[key] > 0 ? '第 ' + C.POTION_FLOORS[key] + ' 層（含）以下與地下才會在雜貨商販售或從討伐掉落。' : '地下第一層起才會在雜貨商販售或從討伐掉落。');
      if (['heal','ration','shield','hourglass'].includes(key)) acquisition.push('探索者委託的隨機補給報酬；乾糧為 2 份，其餘 1 份。');
      if (['heal','ration'].includes(key)) acquisition.push('開局各 2 份；地上裂隙完成時也可能取得補給。');
      if (key === 'map') acquisition.push('開局 1 張。');
      if (key === 'forget') acquisition.push('商店不販售。第 '+L.FORGET_FLOOR+' 層（含）之後的樓主與地下每一位樓主，擊敗時另外以 '+L.FORGET_CHANCE+'% 機率掉落 1 瓶，不佔樓主 2～5 樣掉落的名額；只在職業旅程出現，初始持有零瓶。');
      if (key === 'arrow') acquisition.push('射手或神職主角開局帶 50 支；首次招募射手或神職補充 15 支，不超過當前容量，重招不重送。沒有持弓職業時保留 100 支基礎容量。怪物掉落箭束需有足夠空間整堆拾取，否則留在地上。目前不再自然生成地面箭束。');
      if (key === 'coin') acquisition.push('開局 24 枚；討伐、下樓、探索點、章末機關、委託／裂隙報酬，以及售出補給或裝備。');
      const guide = fieldGuide().item(key, {party:{loadouts:{}}});
      return {
        id:'item:' + key, key, name:def.name, category:key === 'coin' ? '貨幣' : key === 'arrow' ? '彈藥' : fuel ? '動力石' : '生存補給',
        description:effect, effect, acquisition:acquisition.join(' '),
        notes:[guide?.when,guide?.caution, key === 'feather' ? '舊版通用描述的 50 點不適用目前逐人裝備／職業戰鬥；本頁以實際角色受傷程式的 40 點為準。' : null, key === 'shield' ? '未列入舊旅程的 25 秒減傷規則；護盾專精可提高護盾量。' : null, ['hourglass','bell','map'].includes(key) ? '道具延效被動可延長計時；重複使用仍在生效的同類計時道具會被阻止。' : null,...(fuel?[powerForagingExplanation,'採集礦簇依環境抽取，不必先有機器人；討伐掉落動力石則需隊伍有能行動的機器人。暫停、閱讀、迷宮變形過場與離線不消耗能源。暫停背包可連續補充，滿能源不消耗；戰鬥快捷欄間隔一秒，自動使用間隔五秒。']:[])].filter(Boolean),
        stackLimit:key === 'arrow' ? null : key === 'coin' ? 999999 : 99, capacityRule:key === 'arrow' ? '所有射手各自的「100＋50×（等級－1）」支相加；例如 1 級＋3 級射手合計 300 支。無射手時為 100 支。' : null, buyPrice:def.buyPrice, buyQuantity:def.buyQuantity||1, sellPrice:key === 'arrow' ? null : def.sellPrice, drop,
        ...(fuel?{fuel:fuel.fuel,foraging:fuelForaging}:{}),icon:key === 'coin' ? icon('resource','coin',filename + 'tower-resource-icons.js') : icon('hero',fuel?key:'item_' + key,filename + 'tower-heroes-icons.js'),
        sources:[SOURCES.core,SOURCES.growth,SOURCES.heroes,SOURCES.encounters,SOURCES.loot,SOURCES.runtime,...(fuel?[SOURCES.robot,SOURCES.foraging]:[])]
      };
    });
  }
  function ingredientRecords() {
    const P = party(), H = heroes(), L = loot(), M = materials();
    return Object.entries(P.INGREDIENTS).map(([key,name]) => {
      const meta = M.INGREDIENT_META[key], sources = meta.sources, type = meta.rarity,conditionalPercent=L.chance({type:'ingredient',key,rarity:type}),natural=key==='herb'?naturalSource('herb',key):null;
      const recipes = Object.values(P.RECIPES).filter(r => Object.hasOwn(r.cost,key)).map(r => r.name + ' ×' + r.cost[key]);
      const skills = Object.values(H.SKILLS).filter(s => Object.hasOwn(s.cost || {},key)).map(s => s.name + ' ×' + s.cost[key]);
      const signature=M.ECOLOGIES.filter(e=>M.signature(e.high)===key).map(e=>e.name),grocery=encounters().GROCERY,common=grocery.commonIngredients.includes(key),grocerySource=common?'雜貨商販售常用食材，每份 '+grocery.commonPrice+' 幣（香草也作藥草使用），本層每種限 1～5 份。':signature.length?'可能成為雜貨商的隨機樓層特產，每份 '+grocery.specialtyPrice+' 幣，本層限 1～5 份；可早於原產地樓層買到，地上不抽地下特產。':'';
      return {id:'ingredient:' + key,key,name,category:key === 'shell' ? '製作材料' : '料理食材',description:meta.description+' 整隊共用，持有上限 99 份；在營地料理或技能消耗時使用。',effect:[recipes.length ? '食譜用量：' + recipes.join('、') + '。' : '',skills.length ? '技能材料：' + skills.join('、') + '。' : ''].filter(Boolean).join(' ')||'可作料理或製作材料，實際用途依持有技能與食譜。',
        acquisition:sources.join('；')+'。被抽為素材候選後，以'+rarityNames[type]+' '+conditionalPercent+'%判定；每堆 '+(key==='shell'?1:2)+' 份。'+(natural?'另可採集靠牆角落的藥草，每株 1 份。':'')+(key==='shell'?'完成章末迷宮機關另外給 3 份。':'')+(signature.length?'「棘殼食材箱」在'+signature.join('、')+'完成時另給此食材 2 份。':''),
        notes:['開局食材：甜根莖 3、月傘菇 2、香草 2、硬殼 1；其他為 0。','已收集食材隨隊保留；討伐掉落仍需遇到相應怪物，並非每層都有蟹肉。',grocerySource,'食材不會隨迷宮變形在地面重新生成；雜貨商的庫存與特產也不因變形或讀檔重抽。',...(natural?[foragingExplanation,'藥草可生長環境：'+naturalRegions(natural)+'。']:[])].filter(Boolean),stackLimit:99,underground:sources.every(s=>s.includes('地下 B')),drop:{rarity:type,conditionalPercent,quantity:key==='shell'?1:2},...(natural?{foraging:natural}:{}),
        recipes,skills,icon:icon('party-food',key,filename + 'tower-party-runtime.js'),sources:[filename+'tower-materials.js',SOURCES.party,SOURCES.heroes,SOURCES.loot,SOURCES.expedition,...(natural?[SOURCES.foraging]:[])]};
    });
  }
  function materialRecords(){
    const M=materials(),X=moduleFor('tower-expedition-core','TowerExpedition'),L=loot();
    return Object.entries(M.MATERIALS).map(([key,name])=>{const meta=M.MATERIAL_META[key],uses=[...Object.values(X.TRAITS).filter(t=>t.materialCost?.[key]).map(t=>t.name+'：一級 '+t.materialCost[key]+'／升二級 '+(t.materialCost[key]*2)+' 份'),...Object.values(affixes().EFFECTS).filter(d=>d.material===key).map(d=>d.name+'材料附魔：每次 2 份'),...Object.entries(robot().COSTS).filter(([,cost])=>cost.materials[key]).map(([tier,cost])=>'機殼或拳臂進階第'+tier+'階：每件 '+cost.materials[key]+' 份'),...Object.entries(robot().CORE_COSTS).filter(([,cost])=>cost.materials[key]).map(([tier,cost])=>robot().CORES[robot().kind('robot_core',Number(tier))].name+'製作：每顆 '+cost.materials[key]+' 份')],quantity=['ironore','toughfiber'].includes(key)?2:1,natural=foraging().NATURAL_ORES.includes(key)?naturalSource('ore',key):null;return {
      id:'material:'+key,key,name,category:'鍛造材料',description:meta.description+' 整隊共用，持有上限 99 份；與食材、金屬零件分開存放。',effect:'鍛造需求：'+uses.join('；')+'。不當成料理食材或隨機宴席耗料。',
      acquisition:meta.sources.join('；')+'。被抽為素材候選後，以'+rarityNames[meta.rarity]+' '+L.CHANCES[meta.rarity]+'%判定；每堆 '+quantity+' 份。'+(natural?'另可採集靠牆角落的自然礦堆，每堆 1 份；出現環境：'+naturalRegions(natural)+'。'+(key==='starore'?'星脈礦僅地下出現。':''):''),notes:['所有新鍛造素材初始為零；舊存檔不補送稀有材料。','換層保留已收集材料；普通修理仍只需原有零件和銅幣，不額外消耗新礦材。',...(natural?[foragingExplanation]:[])],stackLimit:99,underground:['starore','abyssalloy'].includes(key),drop:{rarity:meta.rarity,conditionalPercent:L.CHANCES[meta.rarity],quantity},...(natural?{foraging:natural}:{}),icon:icon('resource',key,filename+'tower-resource-icons.js'),sources:[filename+'tower-materials.js',SOURCES.loot,SOURCES.expedition,SOURCES.robot,SOURCES.affixes,...(natural?[SOURCES.foraging]:[])]};});
  }
  function mealRecords() {
    const P = party();
    return Object.entries(P.RECIPES).map(([key,r]) => ({id:'meal:' + key,key,name:r.name,category:r.requiredDepth?'地下料理':'料理',
      description:(r.description?r.description+' ':'')+(P.BASIC_RECIPES.includes(key)?'基本料理：任何職業的隊伍皆可在安全營地烹飪。':'廚師料理：隊中有能行動的廚師才會顯示菜譜，且需在安全營地烹飪。'),
      effect:[r.hp ? '恢復目前操控者生命 ' + r.hp + ' 點。' : '不直接恢復目前操控者生命。','恢復全隊共用飽食度 ' + r.hunger + ' 點。',r.team ? '其他仍能行動的隊友各恢復生命 ' + r.team + ' 點，不復活倒地成員。' : '',r.buff ? P.BUFFS[r.buff] + '；維持 3 層，同時最多保留 2 種料理增益。重吃同種會刷新持續樓層。' : '',r.ward?'另給享用者五分鐘內抵擋一次'+affixes().EFFECTS[r.ward].name+'的保護；觸發即消失，不抵擋直接伤害。'.replace('伤','傷'):''].filter(Boolean).join(' '),
      acquisition:(r.requiredDepth?'地下 B'+r.requiredDepth+' 起解鎖；地上及尚未抵達的地下層不能烹飪或享用。':'地上與地下皆可烹飪。')+'材料：' + Object.entries(r.cost).map(([id,n]) => P.INGREDIENTS[id] + ' ×' + n).join(' ＋ ') + '。烹飪基礎產量 1 份。亦可在本層蘇禾處委託代煮，'+commission().LABELS[commission().category(key)]+'費用 '+commission().fee(key)+' 幣，仍需自備全部材料。',
      notes:['沒有廚師時營地只顯示六道基本菜譜；原先做好的高階成品仍能享用，不會隨廚師離隊消失。蘇禾代煮不需廚師，但不能跳過地下食譜深度限制；其他裝備商不提供料理。','一料雙份、食材保鮮、食療與分享等效果必須實際學會相應被動才生效；不是有廚師就必定雙倍。委託代煮固定一份、按原配方扣料，不觸發雙份或保鮮。','機器人不能享用料理；料理與一般治療不會修復機器人隊友。機體生命改由動力核心或機械修復技能恢復。','生命與飽食恢復不超過上限；料理欄每種最多 99 份。'],
      recipe:{...r,cost:{...r.cost}},commission:{fee:commission().fee(key),category:commission().category(key),quantity:1},requiredDepth:r.requiredDepth||0,underground:!!r.requiredDepth,stackLimit:99,icon:icon('party-dish',key,filename + 'tower-party-runtime.js'),sources:[SOURCES.party,SOURCES.heroes,SOURCES.growth,SOURCES.commission,...(r.ward?[SOURCES.affixes]:[])]}));
  }
  function toolRecords() {
    const L = light(), supply = heroes().PASSIVES.tool_supply.power;
    const forgeCosts = Object.values(moduleFor('tower-expedition-core','TowerExpedition').TRAITS).map(t => t.name + '第一、二級各用 ' + t.parts + '／' + (t.parts * 2) + ' 份').join('；');
    const torchIcon = icon('lighting','torch',filename + 'tower-lighting-runtime.js');
    return [
      {id:'light:torch',name:'火把',category:'照明工具',description:'可切換點燃與熄滅，照亮附近通道。',effect:'一支可燃燒 ' + L.TORCH_SECONDS + ' 秒（五分鐘）；熄滅保留餘火。有日光術或雙核心照明時暫停燃料消耗；單核心期間火把正常燃燒。暫停／閱讀／離線不扣時間。',acquisition:'開局 2 支。雜貨商以每支 ' + L.TORCH_PRICE + ' 幣販售，每層限 ' + L.SHOP_STOCK + ' 支，裝備商不再販售。沒有現成火把且燃料用盡時，直接消耗木枝、布條各 1 份點燃，不必先製作。',icon:torchIcon,stackLimit:99,sources:[SOURCES.lighting,filename + 'tower-lighting-runtime.js']},
      ...[['wood','木枝'],['cloth','布條']].map(([key,name]) => ({id:'light:' + key,key,name,category:'照明材料',description:'與另一份照明材料配合，直接點燃五分鐘火把。',effect:'沒有現成火把與餘火時，每次點燃消耗木枝 1 份＋布條 1 份。',acquisition:'開局各 2 份；討伐候選「火把材料」被抽中後，作普通 20%判定，掉一組木枝 1 份＋布條 1 份。',notes:['木枝與布條在迷宮中以同一束材料掉落；此處使用照明面板的物件小圖。'],stackLimit:99,icon:icon('resource',key,filename + 'tower-resource-icons.js'),sources:[SOURCES.lighting,SOURCES.loot,SOURCES.runtime]})),
      {id:'light:daylight',name:'日光術',category:'職業本領',description:'術士的照明本領，不是消耗品，也不占主動技能欄。',effect:'持續 ' + L.DAYLIGHT_SECONDS + ' 秒（十分鐘），同時冷卻 ' + L.DAYLIGHT_COOLDOWN + ' 秒。光照範圍為 ' + L.DAYLIGHT_RADIUS + '；火把為 ' + L.TORCH_RADIUS + '（遊戲世界距離）。日光術優先於核心，切換領隊不改變光照。',acquisition:'隊伍有仍能行動的術士即可點左上照明鍵或按 L 施放；照明鍵會由火把換成日光術。',icon:icon('lighting','daylight',filename + 'tower-lighting-runtime.js'),sources:[SOURCES.lighting,filename + 'tower-lighting-runtime.js']},
      {id:'light:robot-core',name:'機器人內建動力光源',category:'職業本領',description:'機器人的永久動力光源，不占技能格，不必點火。',effect:'依已安裝核心數量，單核心小於火把、雙核心大於火把且小於日光術。全隊採最強來源，日光術優先，切換領隊不改光源。無核／單核／雙核範圍 '+robot().CORE_LIGHT_RADII.join('／')+'，火把 '+L.TORCH_RADIUS+'、日光術 '+L.DAYLIGHT_RADIUS+'（遊戲世界距離）。持續照明，不消耗能源或核心耐久；能源耗盡仍保留照明；核心耐久歸零立即消失，依剩餘核心重新決定範圍與光色，無核心時保留較弱微光。最高核心階級也決定胸核、背部管線與拳臂能源的光色。',acquisition:'隊伍有能行動的機器人即可照亮；核心可在安全營地自行製作、安裝與換裝，第四五階只在地下開放。',notes:['核心不在時保留較弱內建微光。機殼、拳臂各自進階，核心階級不替代機件階級；眼睛仍保留人物身份色。'],icon:icon('hero','robot_core',filename+'tower-heroes-icons.js'),sources:[SOURCES.robot,SOURCES.lighting,filename+'tower-lighting-runtime.js']},
      {id:'material:scrap',name:'金屬零件',category:'製作材料',description:'鍛匠工坊修理、強化與部分高階技能使用的共用材料，上限 99。',effect:'修理依損耗計價。'+forgeCosts+'。完全損壞的裝備需有能行動的鍛匠，或找負責這類裝備的商人。破損費為原修理費的 1.5 倍，商人銅幣再加20%，零件不加倍。營地基本保養每層僅一次、6幣、恢復最大耐久'+Math.round(party().CAMP_MAINTENANCE_RATIO*100)+'%，不消耗零件，也不能重建破損裝備。',acquisition:'拆解裝備每件取得 1～6 份（依裝備加成與餘下耐久）；完成損壞機關箱探索點取得 4 份；雜貨商・蘇禾每層限購 '+moduleFor('tower-expedition-core','TowerExpedition').SCRAP_SHOP.stock+' 份，每份 '+moduleFor('tower-expedition-core','TowerExpedition').SCRAP_SHOP.price+' 幣（需有隊伍，副本內不交易）。',notes:['這不是背包中可直接使用的療傷道具。'],stackLimit:99,icon:icon('resource','scrap',filename + 'tower-resource-icons.js'),sources:[SOURCES.expedition,SOURCES.growth,SOURCES.party,SOURCES.encounters]},
      {id:'tool:shovel',name:'鐵鍬／破障工具',category:'探索工具',description:'敲掉面前一道可破壞的普通內牆。',effect:'成功破牆消耗 1 把；沒有可破牆時不消耗。不能破外圍牆，也不能跳過章末印記與機關條件。',acquisition:'學會鍛匠「工具補給」被動的存活角色可補充，至多保留 1 把；技能一至六級補充間隔為 ' + supply.join('／') + ' 秒。不是所有鍛匠都保證抽到這項被動。',icon:icon('pickup','⛏','assets/pickup-objects.js'),sources:[SOURCES.heroes,'index.html']}
    ];
  }
  function clueRecords() {
    const floor = n => n < 0 ? '地下 B' + -n : '第 ' + n + ' 層';
    return narrative().allChapters().map(c => ({id:c.clueId,name:c.clueName,category:c.low < 0 ? '地下主線印記' : '高塔主線印記',
      description:c.objective,effect:'取得後記入故事日誌，不占普通道具欄、不會耗盡，也不能出售。' + floor(c.low) + '出口必須有本章印記，並完成迷宮機關與擊敗樓層主。',
      acquisition:floor(c.mid) + '～' + floor(c.low) + '的本章迷宮中尋找金色主線印記，靠近並互動即可取得；變形不會把已取得印記取消。',
      notes:['地上與地下使用共用金色八面體主線標記；不同印記由名稱與章節區分。'],chapter:c.id,midFloor:c.mid,gateFloor:c.low,spoiler:true,
      icon:icon('resource','clue',filename + 'tower-resource-icons.js',{label:'主線印記',note:'依遊戲共用金色八面體與台座繪製。'}),sources:[SOURCES.narrative,filename + 'tower-underworld.js',SOURCES.runtime]})).concat([{id:'quest:memory',name:'委託記憶碎片',category:'探索者委託',description:'探索者「遺失的記憶」委託專用物件，與章節主線印記不同。',effect:'靠近拾取後，回原探索者身旁交件並領取報酬；不能拿來代替主線印記開門。',acquisition:'接受該樓層的尋物委託後才顯示；離開本層即解除未完成委託，不能帶到別層交件。',notes:['遊戲用小寶箱模型代表這份委託物，不是普通背包消耗品。'],icon:icon('resource','questFragment',filename + 'tower-resource-icons.js',{label:'委託物寶箱',note:'沿用遊戲實際小寶箱輪廓。'}),sources:[SOURCES.encounters,SOURCES.runtime]}]);
  }
  function explorationRecords(){
    const ev=events(),lm=landmarks(),x=moduleFor('tower-expedition-core','TowerExpedition');
    const choiceRecords=Object.entries(ev.KINDS).map(([key,d])=>({id:'event:'+key,key,name:d.name,category:'探索事件',description:d.copy,effect:d.choices.map((c,i)=>'選擇'+(i+1)+'「'+c.label+'」：'+c.description).join(' '),acquisition:'森林、工坊及霧河環境的非魔王樓層，每隔兩至三層依旅程種子安排一次兩選事件；不是每次變形重抽。',notes:[d.follow,d.reward,'後續留言於兩層後固定景觀旁查看，再到任務頁領取答謝；同時追蹤一條後續，可以放棄，不影響原主線。','已作出的選擇、領取紀錄與下一層效果隨存檔保留，不會重複贈送。'],icon:icon('event',key,SOURCES.events),sources:[SOURCES.events,SOURCES.runtime],choices:d.choices.map(c=>({...c}))}));
    const scenery=Object.entries(lm.NAMES).map(([key,name])=>({id:'landmark:'+key,key,name,category:'固定場景',description:'三乘三格的小型固定景觀區，提供辨認路線的地標，不是可帶走的道具。',effect:'同層迷宮變形時位置與開放區保持不變，周圍道路仍可能改變；不額外發送物品。部分後續留言在此查看。',acquisition:'職業版主迷宮依環境安排古樹、水池、晶簇、機組、爐石或路石；裂隙副本不生成。',notes:['不是安全營地，也不是能直接跳過出口條件的捷徑。','模型与原創小圖由固定景觀模組共用。'.replace('与','與')],icon:icon('landmark',key,SOURCES.landmarks),sources:[SOURCES.landmarks,SOURCES.runtime]}));
    const sites=Object.entries(x.SITES).map(([job,d])=>({id:'site:'+job,key:job,name:d.name,category:'職業機關',jobs:[job],description:d.description,effect:'完成後取得八枚銅幣。'+d.reward,acquisition:'非魔王主迷宮每層依種子挑選一種職業機關；對應職業仍能行動時可直接處理，沒有該職業也可留在機關旁慢慢作業。',notes:['操作顯示進度條；移開便停止作業，靠近後可繼續。完成後模型改為已處理外觀，不再重複發放獎勵。','舊存檔未完成的機關保留原六職種子；新樓層才加入射手與機器人的機關。','以遊戲內對應職業圖示表示，地圖上為立體機關模型。'],icon:icon('portrait',job,filename+'tower-party-runtime.js'),sources:[SOURCES.expedition,SOURCES.runtime]}));
    const counters=[{key:'rootCounter',name:'庭園樓主・供能藤',floor:80,effect:'樓主生命降至一半會形成護罩，必須靠近斬斷兩根供能藤才重新受到傷害。兩根藤長在園后附近，小地圖以「藤」標示，迷霧中也看得到。'},{key:'crystalCounter',name:'晶窟樓主・轉向晶柱',floor:60,effect:'樓主生命降至一半會形成護罩。轉向晶柱後，引導晶光攻擊擊中晶柱，護罩才解除。'}].map(d=>({id:'lord-counter:'+d.key,key:d.key,name:d.name,category:'樓主反制',description:d.effect,effect:d.effect,acquisition:'地上第'+d.floor+'層樓主戰鬥中啟動；原先的迷宮封印與主線出口條件仍要完成。',notes:['護罩不會被高傷害直接跳過；解除後可繼續正常戰鬥。','此處只說明戰鬥反制，不透露故事結局。'],icon:icon('event',d.key,SOURCES.events),sources:[SOURCES.events,SOURCES.heroes,SOURCES.runtime]}));
    return [...choiceRecords,...scenery,...sites,...counters];
  }
  function records() { return freeze([...supplyRecords(),...ingredientRecords(),...materialRecords(),...mealRecords(),...toolRecords(),...clueRecords(),...explorationRecords()]); }
  function iconHtml(record) {
    const value = record?.icon;
    if (!value) return '';
    if (value.provider === 'hero') return moduleFor('tower-heroes-icons','TowerHeroIcons').svg(value.key);
    if (value.provider === 'resource') return moduleFor('tower-resource-icons','TowerResourceIcons').svg(value.key);
    if (value.provider === 'party-food') return root.TowerPartyRuntime?.foodArt?.(value.key) || '';
    if (value.provider === 'party-dish') return root.TowerPartyRuntime?.dishArt?.(value.key) || '';
    if (value.provider === 'lighting') return root.TowerLightingRuntime?.icon?.(value.key) || '';
    if (value.provider === 'portrait') return root.TowerPartyRuntime?.portrait?.(value.key) || '';
    if (value.provider === 'event') return events().svg(value.key);
    if (value.provider === 'landmark') return landmarks().svg(value.key);
    // The original complete shovel sprite is rendered by the atlas host.
    return '';
  }
  return Object.freeze({records,iconHtml,scope,dropExplanation,foragingExplanation,powerForagingExplanation,SOURCES});
});
