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
  const fieldGuide = () => moduleFor('tower-field-guide', 'TowerFieldGuide');
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const icon = (provider, key, source, extra = {}) => ({provider, key, source, ...extra});
  const filename = 'story/';
  const SOURCES = freeze({core: filename + 'story-core.js', party: filename + 'tower-party-core.js', heroes: filename + 'tower-heroes-core.js', growth: filename + 'tower-hero-growth.js', lighting: filename + 'tower-lighting-core.js', encounters: filename + 'tower-encounters.js', loot: filename + 'tower-loot.js', expedition: filename + 'tower-expedition-core.js', narrative: filename + 'tower-narrative.js', runtime: filename + 'tower-mode.js'});
  const rarity = {heal:'uncommon', ration:'common', shield:'rare', hourglass:'rare', bell:'rare', map:'rare', feather:'legendary', arrow:'common'};
  const rarityNames = {common:'普通', uncommon:'少見', rare:'稀有', legendary:'珍稀'};
  const dropExplanation = '有生態素材的怪物先以一半機率選素材、一半選補給，再從該組候選物資中抽一種，依該物的稀有度判定；不是每件物品都獨立抽一次。沒有素材的怪物只抽補給。落地後需靠近拾取，未拾取物跨存檔與同層變形保留。';
  const scope = freeze({
    title:'目前職業版劇情模式：地上高塔與地下五十層',
    notes:[
      '劇情模式不會在開局或變形時自然散放補給；來源為商人、料理、委託、討伐掉落及主線互動。',
      '雜貨商・蘇禾每層有 40% 機率出現，販售藥品、消耗道具、箭矢、火把、四種常用食材及一種隨機樓層特產。食材各限 1～5 份，同層變形／讀檔不補貨；地上可買其他地上樓層特產，地下可另抽到地下特產。三位裝備商只販售裝備並提供對應維護服務。',
      dropExplanation,
      '主線印記與委託碎片是任務進度，不是可使用或販售的普通背包物品；固定機關、營地、陷阱與故事日誌紀念文字不算消耗道具。',
      '一般模式的短效加速藥水、穿牆斗篷、風箏、集合口哨、超市商品與雞蛋不屬於目前劇情物資來源，因此不混列；劇情模式另有持續五分鐘的加速藥水。',
      '魔法地圖只有一種背包道具：揭露本次迷宮，並另給 18 秒出口路線。一般模式的 12 秒路線地圖，以及技能的暫時探路，不是第二件劇情道具。',
      '數值為未套用角色被動前的基礎效果；隨機被動、技能等級與穿戴裝備可進一步調整。'
    ]
  });
  function supplyRecords() {
    const C = core(), E = encounters(), L = loot();
    const effects = {
      heal:'為使用者恢復 35 點生命，不超過個人生命上限；滿血不能使用。',
      haste:'為使用者提高移動速度與普通攻擊速度各 '+C.HASTE_PERCENT+'%，持續 '+C.HASTE_DURATION+' 秒（五分鐘）。不縮短技能冷卻或準備時間；同效果不疊加、不刷新，仍在生效時不消耗第二瓶。不因延效被動延長，切換角色也不會轉給別人；暫停、閱讀與離線不扣時間。可放入快捷欄，或在自動道具設定中允許隊友遇敵時使用（預設關閉）。',
      ration:'恢復全隊共用飽食度 45 點，上限 100；不會恢復生命。營地不再提供乾糧全隊回滿的休息捷徑。',
      shield:'提供使用者最大生命 35% 的可消耗護盾，持續最多 300 秒（五分鐘）。護盾吸收傷害後會減少，不是五分鐘無敵。',
      hourglass:'暫停迷宮變形 25 秒。怪物、陷阱與戰鬥仍然繼續。',
      bell:'使怪物退避 20 秒；不等同無敵，仍須避免接觸傷害。',
      map:'完整揭露當下迷宮至下一次變形；同時顯示出口路線 18 秒。迷宮變形後重新探索，不揭露隔牆角色的即時行動。',
      feather:'目前操控者受到致命傷時自動消耗一片，恢復最多 40 點生命（不超過個人上限）；不能手動使用，也不會自動替未操控的倒地隊友消耗。',
      arrow:'全隊共用箭袋，容量由每一名射手累加：每人 1 級 100 支，每升一級增加 50 支。主角若為射手也計入，倒地不減少容量，切換操控角色不改變容量。普通弓射及一般攻擊技能每次發射消耗 1 支；群星箭雨、世界樹之箭等標示 3 支的招式消耗 3 支；射空、撞牆也消耗。',
      coin:'共用貨幣，最高 999,999 枚。用於招募同伴、購買裝備／補給、修理與鍛造；不是可按下使用的消耗道具。'
    };
    return Object.entries(C.ITEMS).map(([key, def]) => {
      const sellers = Object.values(E.MERCHANTS).filter(m => m.supplies.includes(key)).map(m => m.title + '・' + m.name);
      const drop = rarity[key] ? {rarity:rarity[key],label:rarityNames[rarity[key]],conditionalPercent:L.CHANCES[rarity[key]],quantity:key === 'arrow' ? L.ARROW_DROP_QUANTITY : 1} : null;
      const acquisition = [];
      if (sellers.length) acquisition.push(sellers.join('、') + '販售；' + (key === 'arrow' ? '每包 10 支只需 1 幣；剩餘空間不足 10 支時補滿仍收 1 幣，不回收。射手離隊造成容量下降時，已有箭矢保留，超過容量則不能補充。' : '購買 ' + def.buyPrice + ' 幣／售回 ' + def.sellPrice + ' 幣。'));
      if (drop) acquisition.push((key === 'arrow' ? '隊伍有能行動的射手時，' : '') + '被抽為討伐候選物資後，' + drop.label + '掉落判定 ' + drop.conditionalPercent + '%，每堆 ' + drop.quantity + (key === 'arrow' ? ' 支。' : ' 份。'));
      if (['heal','ration','shield','hourglass'].includes(key)) acquisition.push('探索者委託的隨機補給報酬；乾糧為 2 份，其餘 1 份。');
      if (['heal','ration'].includes(key)) acquisition.push('開局各 2 份；地上裂隙完成時也可能取得補給。');
      if (key === 'map') acquisition.push('開局 1 張。');
      if (key === 'arrow') acquisition.push('射手主角開局帶 30 支；首次招募射手補充 15 支，不超過當前容量，重招不重送。沒有射手時保留 100 支基礎容量。怪物掉落箭束需有足夠空間整堆拾取，否則留在地上。目前不再自然生成地面箭束。');
      if (key === 'coin') acquisition.push('開局 24 枚；討伐、下樓、探索點、章末機關、委託／裂隙報酬，以及售出補給或裝備。');
      const guide = fieldGuide().item(key, {party:{loadouts:{}}});
      return {
        id:'item:' + key, key, name:def.name, category:key === 'coin' ? '貨幣' : key === 'arrow' ? '彈藥' : '生存補給',
        description:effects[key], effect:effects[key], acquisition:acquisition.join(' '),
        notes:[guide?.when,guide?.caution, key === 'feather' ? '舊版通用描述的 50 點不適用目前逐人裝備／職業戰鬥；本頁以實際角色受傷程式的 40 點為準。' : null, key === 'shield' ? '未列入舊旅程的 25 秒減傷規則；護盾專精可提高護盾量。' : null, ['hourglass','bell','map'].includes(key) ? '道具延效被動可延長計時；重複使用仍在生效的同類計時道具會被阻止。' : null].filter(Boolean),
        stackLimit:key === 'arrow' ? null : key === 'coin' ? 999999 : 99, capacityRule:key === 'arrow' ? '所有射手各自的「100＋50×（等級－1）」支相加；例如 1 級＋3 級射手合計 300 支。無射手時為 100 支。' : null, buyPrice:def.buyPrice, buyQuantity:def.buyQuantity||1, sellPrice:key === 'arrow' ? null : def.sellPrice, drop,
        icon:key === 'coin' ? icon('resource','coin',filename + 'tower-resource-icons.js') : icon('hero','item_' + key,filename + 'tower-heroes-icons.js'),
        sources:[SOURCES.core,SOURCES.growth,SOURCES.heroes,SOURCES.encounters,SOURCES.loot,SOURCES.runtime]
      };
    });
  }
  function ingredientRecords() {
    const P = party(), H = heroes(), L = loot(), M = materials();
    return Object.entries(P.INGREDIENTS).map(([key,name]) => {
      const meta = M.INGREDIENT_META[key], sources = meta.sources, type = meta.rarity;
      const recipes = Object.values(P.RECIPES).filter(r => Object.hasOwn(r.cost,key)).map(r => r.name + ' ×' + r.cost[key]);
      const skills = Object.values(H.SKILLS).filter(s => Object.hasOwn(s.cost || {},key)).map(s => s.name + ' ×' + s.cost[key]);
      const signature=M.ECOLOGIES.filter(e=>M.signature(e.high)===key).map(e=>e.name),grocery=encounters().GROCERY,common=grocery.commonIngredients.includes(key),grocerySource=common?'雜貨商販售常用食材，每份 '+grocery.commonPrice+' 幣（香草也作藥草使用），本層每種限 1～5 份。':signature.length?'可能成為雜貨商的隨機樓層特產，每份 '+grocery.specialtyPrice+' 幣，本層限 1～5 份；可早於原產地樓層買到，地上不抽地下特產。':'';
      return {id:'ingredient:' + key,key,name,category:key === 'shell' ? '製作材料' : '料理食材',description:meta.description+' 整隊共用，持有上限 99 份；在營地料理或技能消耗時使用。',effect:[recipes.length ? '食譜用量：' + recipes.join('、') + '。' : '',skills.length ? '技能材料：' + skills.join('、') + '。' : ''].filter(Boolean).join(' ')||'可作料理或製作材料，實際用途依持有技能與食譜。',
        acquisition:sources.join('；')+'。被抽為素材候選後，以'+rarityNames[type]+' '+L.CHANCES[type]+'%判定；每堆 '+(key==='shell'?1:2)+' 份。'+(key==='shell'?'完成章末迷宮機關另外給 3 份。':'')+(signature.length?'「棘殼食材箱」在'+signature.join('、')+'完成時另給此食材 2 份。':''),
        notes:['開局食材：甜根莖 3、月傘菇 2、香草 2、硬殼 1；其他為 0。','已收集食材隨隊保留；自然掉落仍需遇到相應怪物，並非每層都有蟹肉。',grocerySource,'食材不會隨迷宮變形在地面重新生成；雜貨商的庫存與特產也不因變形或讀檔重抽。'].filter(Boolean),stackLimit:99,underground:sources.every(s=>s.includes('地下 B')),drop:{rarity:type,conditionalPercent:L.CHANCES[type],quantity:key==='shell'?1:2},
        recipes,skills,icon:icon('party-food',key,filename + 'tower-party-runtime.js'),sources:[filename+'tower-materials.js',SOURCES.party,SOURCES.heroes,SOURCES.loot,SOURCES.expedition]};
    });
  }
  function materialRecords(){
    const M=materials(),X=moduleFor('tower-expedition-core','TowerExpedition'),L=loot();
    return Object.entries(M.MATERIALS).map(([key,name])=>{const meta=M.MATERIAL_META[key],uses=Object.values(X.TRAITS).filter(t=>t.materialCost?.[key]).map(t=>t.name+'：一級 '+t.materialCost[key]+'／升二級 '+(t.materialCost[key]*2)+' 份'),quantity=['ironore','toughfiber'].includes(key)?2:1;return {
      id:'material:'+key,key,name,category:'鍛造材料',description:meta.description+' 整隊共用，持有上限 99 份；與食材、金屬零件分開存放。',effect:'鍛造需求：'+uses.join('；')+'。不當成料理食材或隨機宴席耗料。',
      acquisition:meta.sources.join('；')+'。被抽為素材候選後，以'+rarityNames[meta.rarity]+' '+L.CHANCES[meta.rarity]+'%判定；每堆 '+quantity+' 份。',notes:['所有新鍛造素材初始為零；舊存檔不補送稀有材料。','換層保留已收集材料；普通修理仍只需原有零件和銅幣，不額外消耗新礦材。'],stackLimit:99,underground:['starore','abyssalloy'].includes(key),drop:{rarity:meta.rarity,conditionalPercent:L.CHANCES[meta.rarity],quantity},icon:icon('resource',key,filename+'tower-resource-icons.js'),sources:[filename+'tower-materials.js',SOURCES.loot,SOURCES.expedition]};});
  }
  function mealRecords() {
    const P = party();
    return Object.entries(P.RECIPES).map(([key,r]) => ({id:'meal:' + key,key,name:r.name,category:r.requiredDepth?'地下料理':'料理',
      description:(r.description?r.description+' ':'')+(P.BASIC_RECIPES.includes(key)?'基本料理：任何職業的隊伍皆可在安全營地烹飪。':'廚師料理：隊中有能行動的廚師才會顯示菜譜，且需在安全營地烹飪。'),
      effect:[r.hp ? '恢復目前操控者生命 ' + r.hp + ' 點。' : '不直接恢復目前操控者生命。','恢復全隊共用飽食度 ' + r.hunger + ' 點。',r.team ? '其他仍能行動的隊友各恢復生命 ' + r.team + ' 點，不復活倒地成員。' : '',r.buff ? P.BUFFS[r.buff] + '；維持 3 層，同時最多保留 2 種料理增益。重吃同種會刷新持續樓層。' : ''].filter(Boolean).join(' '),
      acquisition:(r.requiredDepth?'地下 B'+r.requiredDepth+' 起解鎖；地上及尚未抵達的地下層不能烹飪或享用。':'地上與地下皆可烹飪。')+'材料：' + Object.entries(r.cost).map(([id,n]) => P.INGREDIENTS[id] + ' ×' + n).join(' ＋ ') + '。烹飪基礎產量 1 份。',
      notes:['沒有廚師時只顯示六道基本菜譜；原先做好的高階成品仍能享用，不會隨廚師離隊消失。商人處不能烹飪。','一料雙份、食材保鮮、食療與分享等效果必須實際學會相應被動才生效；不是有廚師就必定雙倍。','生命與飽食恢復不超過上限；料理欄每種最多 99 份。'],
      recipe:{...r,cost:{...r.cost}},requiredDepth:r.requiredDepth||0,underground:!!r.requiredDepth,stackLimit:99,icon:icon('party-dish',key,filename + 'tower-party-runtime.js'),sources:[SOURCES.party,SOURCES.heroes,SOURCES.growth]}));
  }
  function toolRecords() {
    const L = light(), supply = heroes().PASSIVES.tool_supply.power;
    const forgeCosts = Object.values(moduleFor('tower-expedition-core','TowerExpedition').TRAITS).map(t => t.name + '第一、二級各用 ' + t.parts + '／' + (t.parts * 2) + ' 份').join('；');
    const torchIcon = icon('lighting','torch',filename + 'tower-lighting-runtime.js');
    return [
      {id:'light:torch',name:'火把',category:'照明工具',description:'可切換點燃與熄滅，照亮附近通道。',effect:'一支可燃燒 ' + L.TORCH_SECONDS + ' 秒（五分鐘）；熄滅保留餘火。有日光術照明時暫停燃料消耗；暫停／閱讀／離線不扣時間。',acquisition:'開局 2 支。雜貨商以每支 ' + L.TORCH_PRICE + ' 幣販售，每層限 ' + L.SHOP_STOCK + ' 支，裝備商不再販售。沒有現成火把且燃料用盡時，直接消耗木枝、布條各 1 份點燃，不必先製作。',icon:torchIcon,stackLimit:99,sources:[SOURCES.lighting,filename + 'tower-lighting-runtime.js']},
      ...[['wood','木枝'],['cloth','布條']].map(([key,name]) => ({id:'light:' + key,key,name,category:'照明材料',description:'與另一份照明材料配合，直接點燃五分鐘火把。',effect:'沒有現成火把與餘火時，每次點燃消耗木枝 1 份＋布條 1 份。',acquisition:'開局各 2 份；討伐候選「火把材料」被抽中後，作普通 20%判定，掉一組木枝 1 份＋布條 1 份。',notes:['木枝與布條在迷宮中以同一束材料掉落；此處使用照明面板的物件小圖。'],stackLimit:99,icon:icon('resource',key,filename + 'tower-resource-icons.js'),sources:[SOURCES.lighting,SOURCES.loot,SOURCES.runtime]})),
      {id:'light:daylight',name:'日光術',category:'職業本領',description:'術士的照明本領，不是消耗品，也不占主動技能欄。',effect:'持續 ' + L.DAYLIGHT_SECONDS + ' 秒（十分鐘），同時冷卻 ' + L.DAYLIGHT_COOLDOWN + ' 秒。光照範圍依隊伍術士等級提升，12 起、最高 20；火把照明範圍為 10（遊戲世界距離）。',acquisition:'隊伍有仍能行動的術士即可點左上照明鍵或按 L 施放；照明鍵會由火把換成日光術。',icon:icon('lighting','daylight',filename + 'tower-lighting-runtime.js'),sources:[SOURCES.lighting,filename + 'tower-lighting-runtime.js']},
      {id:'material:scrap',name:'金屬零件',category:'製作材料',description:'鍛匠工坊修理、強化與部分高階技能使用的共用材料，上限 99。',effect:'修理依損耗計價。'+forgeCosts+'。完全損壞的裝備需有能行動的鍛匠，或找負責這類裝備的商人。破損費為原修理費的 1.5 倍，商人銅幣再加20%，零件不加倍。營地基本保養每層僅一次、6幣、恢復最大耐久20%，不消耗零件，也不能重建破損裝備。',acquisition:'拆解裝備每件取得 1～6 份（依裝備加成與餘下耐久）；完成損壞機關箱探索點取得 4 份。',notes:['這不是背包中可直接使用的療傷道具。'],stackLimit:99,icon:icon('resource','scrap',filename + 'tower-resource-icons.js'),sources:[SOURCES.expedition,SOURCES.growth]},
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
  function records() { return freeze([...supplyRecords(),...ingredientRecords(),...materialRecords(),...mealRecords(),...toolRecords(),...clueRecords()]); }
  function iconHtml(record) {
    const value = record?.icon;
    if (!value) return '';
    if (value.provider === 'hero') return moduleFor('tower-heroes-icons','TowerHeroIcons').svg(value.key);
    if (value.provider === 'resource') return moduleFor('tower-resource-icons','TowerResourceIcons').svg(value.key);
    if (value.provider === 'party-food') return root.TowerPartyRuntime?.foodArt?.(value.key) || '';
    if (value.provider === 'party-dish') return root.TowerPartyRuntime?.dishArt?.(value.key) || '';
    if (value.provider === 'lighting') return root.TowerLightingRuntime?.icon?.(value.key) || '';
    // The original complete shovel sprite is rendered by the atlas host.
    return '';
  }
  return Object.freeze({records,iconHtml,scope,dropExplanation,SOURCES});
});
