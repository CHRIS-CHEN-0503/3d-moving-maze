/* Original profession loadouts. Pure rules; no DOM, clocks, storage or network. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerHeroes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const B=()=>typeof module==='object'&&module.exports?require('./tower-floor-lords.js'):globalThis.TowerFloorLords;
  const Dg=()=>typeof module==='object'&&module.exports?require('./tower-dungeons.js'):globalThis.TowerDungeons;
  const X=()=>typeof module==='object'&&module.exports?require('./tower-expedition-core.js'):globalThis.TowerExpedition;
  const R=()=>typeof module==='object'&&module.exports?require('./tower-recruitment.js'):globalThis.TowerRecruitment;
  const F=()=>typeof module==='object'&&module.exports?require('./tower-affixes.js'):globalThis.TowerAffixes;
  const Events=()=>typeof module==='object'&&module.exports?require('./tower-adventure-events.js'):globalThis.TowerAdventureEvents;
  const G=typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;
  const A=typeof module==='object'&&module.exports?require('./tower-ascension-catalog.js'):globalThis.TowerAscensionCatalog;
  const GT=typeof module==='object'&&module.exports?require('./tower-gear-tiers.js'):globalThis.TowerGearTiers;
  const ROBOT=typeof module==='object'&&module.exports?require('./tower-robot-core.js'):globalThis.TowerRobotCore;
  const own=(o,k)=>Object.hasOwn(o,k),num=(n,a,b,int=false)=>Number.isFinite(n)&&n>=a&&n<=b&&(!int||Number.isInteger(n));
  const clone=v=>JSON.parse(JSON.stringify(v)),SLOTS=Object.freeze(['helmet','armor','weapon','shield']);
  // Shorten every existing preparation by 0.3 seconds; instant skills stay instant.
  const PREPARATION_REDUCTION=.3,shorterPreparation=n=>Math.max(0,Math.round((n-PREPARATION_REDUCTION)*10)/10);
  const PREPARATION=Object.freeze(Object.fromEntries(Object.entries({starfall:1.5,star_ring:1.9,decisive_slash:1.3,whirlwind:.8,dawn_sanctuary:1.3,revive:1.5,moving_fortress:1.1,barricade:1,hero_feast:1.3,worldtree_arrow:1.5,iron_charge:1.1,shoulder_quake:1.1,steel_meteor_fist:1.5}).map(([id,seconds])=>[id,shorterPreparation(seconds)])));
  const preparationSeconds=id=>PREPARATION[id]??shorterPreparation(A.SKILLS[id]?.preparation||0);
  const JOBS=Object.freeze({
    swordsman:{name:'劍士',armor:'heavy',starter:'longsword',color:'#89bce1',charIdx:2},
    mage:{name:'術士',armor:'robe',starter:'arcane_staff',color:'#c5a7f7',charIdx:3},
    scout:{name:'遊俠',armor:'light',starter:'twin_daggers',color:'#8fdec4',charIdx:1},
    chef:{name:'廚師',armor:'light',starter:'cooking_pan',color:'#ffd09b',charIdx:0},
    healer:{name:'療癒師',armor:'robe',starter:'spellbook',color:'#b6e5b8',charIdx:1},
    smith:{name:'鍛匠',description:'矮人族鍛匠；男女均為矮人族，外觀不同，職業能力相同。',armor:'heavy',starter:'smith_hammer',color:'#d7ab83',charIdx:4},
    archer:{name:'射手',armor:'light',starter:'elven_bow',color:'#e4d796',charIdx:1},
    robot:{name:'機器人',armor:'robot',starter:'robot_fists',color:'#a7dce8',charIdx:4},
  });
  const gear=(kind,name,slot,type,jobs,hands,damage,interval,reach,defense,price,magicDamage=0,support=0)=>Object.freeze({kind,name,slot,type,jobs:Object.freeze(jobs),hands,damage,interval,reach,defense,buyPrice:price,magicDamage,support,stunSeconds:0});
  const BASE_GEAR=Object.freeze([
    gear('longsword','巡塔長劍','weapon','blade',['swordsman'],1,12,.7,2.7,0,18),
    gear('greatsword','破陣雙手劍','weapon','blade',['swordsman'],2,20,1.15,3.2,0,28),
    gear('arcane_staff','星紋法杖','weapon','staff',['mage'],2,3,.95,8,0,22,12,.08),
    gear('spellbook','晨光法書','weapon','book',['healer'],2,2,1,7.5,0,18,6,.15),
    gear('smith_hammer','鍛鐵短鎚','weapon','hammer',['smith'],1,8,.9,2.5,0,17),
    gear('warhammer','山岩重錘','weapon','hammer',['smith'],2,13,1.45,3,0,26),
    gear('cooking_pan','旅人鐵鍋','weapon','pan',['chef'],1,6,.85,2.5,0,16),
    gear('twin_daggers','逐風雙短刃','weapon','daggers',['scout'],2,8,.75,2.4,0,21),
    gear('elven_bow','青葉獵弓','weapon','bow',['archer'],2,11,.95,9.5,0,22),
    gear('heavy_helm','鉚釘重盔','helmet','heavy',['swordsman','smith'],0,0,0,0,3,18),
    gear('heavy_armor','分層板甲','armor','heavy',['swordsman','smith'],0,0,0,0,6,28),
    gear('light_hood','旅行皮帽','helmet','light',['chef','scout','archer'],0,0,0,0,2,14),
    gear('light_armor','遊俠輕甲','armor','light',['chef','scout','archer'],0,0,0,0,4,21),
    gear('rune_crown','星線法冠','helmet','robe',['mage','healer'],0,0,0,0,1,14),
    gear('robe','織光法袍','armor','robe',['mage','healer'],0,0,0,0,2,20),
    gear('buckler','木紋小圓盾','shield','shield',['swordsman','smith','chef'],1,0,0,0,2,13),
    gear('round_shield','包鐵圓盾','shield','shield',['swordsman','smith','chef'],1,0,0,0,3,19),
    gear('tower_shield','守門塔盾','shield','shield',['swordsman','smith','chef'],1,0,0,0,5,28),
  ]);
  const TIER_NAMES=Object.freeze({longsword:['銀鋒長劍','黎明誓劍'],greatsword:['裂岩雙手劍','王庭巨劍'],arcane_staff:['月晶法杖','星穹法杖'],spellbook:['曙光法典','聖樹法典'],smith_hammer:['精鋼短鎚','匠魂短鎚'],warhammer:['震地重錘','熔心重錘'],cooking_pan:['銅心鐵鍋','百味御鍋'],twin_daggers:['銀影雙刃','夜羽雙刃'],elven_bow:['月桂長弓','星枝靈弓'],heavy_helm:['銀鋼重盔','王庭重盔'],heavy_armor:['精鋼板甲','王庭戰甲'],light_hood:['疾風皮帽','翠羽兜帽'],light_armor:['游風輕甲','精靈葉甲'],rune_crown:['月晶法冠','星穹法冠'],robe:['月紗法袍','星織法袍'],buckler:['銀木圓盾','聖樹圓盾'],round_shield:['銀鋼圓盾','晨星圓盾'],tower_shield:['城壁塔盾','不屈塔盾']});
  const tierKind=(kind,tier=1)=>tier===1?kind:kind+'_t'+tier;
  const GEAR=Object.freeze({...Object.fromEntries(BASE_GEAR.flatMap(g=>[1,2,3,4,5].map(tier=>{
    if(tier>3){const def=GT.definition(g,tier);return [def.kind,def];}
    const factor=[0,1,1.5,2.1][tier],kind=tierKind(g.kind,tier);
    return [kind,Object.freeze({...g,kind,baseKind:g.kind,tier,requiredLevel:[0,1,3,5][tier],name:tier===1?g.name:TIER_NAMES[g.kind][tier-2],damage:Math.round(g.damage*factor),magicDamage:Math.round(g.magicDamage*factor),support:Math.round(g.support*factor*100)/100,defense:g.defense?Math.max(Math.round(g.defense*factor),g.defense+tier-1):0,reach:g.type==='bow'?g.reach+(tier-1)*1.2:g.reach,buyPrice:Math.round(g.buyPrice*[0,1,2.2,3.6][tier])})];
  }))),...ROBOT.GEAR});
  const gearPool=floor=>Object.values(GEAR).filter(g=>!g.integrated&&!g.craftOnly&&g.tier<=(floor<0?(floor<=-21?5:4):floor>=70?1:floor>=40?2:3)).map(g=>g.kind);
  const skill=(id,job,name,attack,power,cooldown,effect,description,cost={})=>Object.freeze({id,job,name,attack,power:Object.freeze(power),cooldown,effect,description,cost:Object.freeze(cost)});
  // Every move recovers twice as fast as originally authored (combos too). MP now
  // paces the extra casts: each costs 4 + half its ORIGINAL cooldown (capped), so a full
  // bar allows a burst at the new pace and regeneration settles back near the old.
  // Robots spend their power-stone energy instead; the mage's innate daylight is free.
  const COOLDOWN_SCALE=.5,SPIRIT=Object.freeze({mage:1.4,healer:1.35,archer:1.1,chef:1.05,scout:1,smith:.95,swordsman:.9,robot:0});
  // Ability scores. Every level past the first adds three automatic points by profession (the
  // life, MP and attack growth the professions already had) and two free points. Only free
  // points change numbers, each by a small step, at most ATTRIBUTE_CAP per score, so a journey
  // that never spends one keeps today's balance. Robots have no MP or spells: no intellect.
  const ATTRIBUTES=Object.freeze(['str','int','vit','agi','luk']),ATTRIBUTE_NAMES=Object.freeze({str:'力量',int:'智力',vit:'體質',agi:'敏捷',luk:'幸運'});
  const FREE_POINTS_PER_LEVEL=2,AUTO_POINTS_PER_LEVEL=3,ATTRIBUTE_STEP=Object.freeze({str:.015,int:.015,intMp:.02,intHeal:.01,vit:.02,agi:.01,luk:1});
  const deep=o=>Object.freeze(Object.fromEntries(Object.entries(o).map(([k,v])=>[k,Object.freeze(v)])));
  const ATTRIBUTE_BASE=deep({swordsman:{str:7,int:2,vit:7,agi:5,luk:4},smith:{str:6,int:3,vit:8,agi:3,luk:5},robot:{str:6,int:0,vit:9,agi:5,luk:5},archer:{str:5,int:3,vit:4,agi:8,luk:5},scout:{str:4,int:3,vit:4,agi:8,luk:6},mage:{str:2,int:9,vit:4,agi:4,luk:6},healer:{str:2,int:8,vit:6,agi:4,luk:5},chef:{str:5,int:5,vit:6,agi:4,luk:5}});
  const ATTRIBUTE_GROWTH=deep({swordsman:{str:2,vit:1},smith:{vit:2,str:1},robot:{vit:2,agi:1},archer:{agi:2,str:1},scout:{agi:2,luk:1},mage:{int:2,luk:1},healer:{int:2,vit:1},chef:{vit:1,int:1,luk:1}});
  // Automatic spending follows this repeating order, skipping a full or unusable score.
  const ATTRIBUTE_PLAN=deep({swordsman:['str','vit','str','agi'],smith:['vit','str','vit','agi'],robot:['vit','str','agi','vit'],archer:['agi','str','agi','luk'],scout:['agi','luk','agi','str'],mage:['int','luk','int','agi'],healer:['int','vit','int','agi'],chef:['vit','int','luk','agi']});
  // Luck: a critical hit deals 1.5x; each free luck point adds 1 percentage point to the job's base chance.
  const CRIT_BASE=Object.freeze({scout:8,archer:6,robot:3}),CRIT_DEFAULT=4,CRIT_MULTIPLIER=1.5;
  // Saved preparation and flight damage stay below the old 250 bound times the strongest free-point bonus.
  const DAMAGE_RECORD_LIMIT=250*(1+ATTRIBUTE_STEP.str*10);
  // Capped (30, or 45 for awakening and advanced moves) so a long-cooldown rescue such as revive stays castable early.
  const mpCostFor=(s,base)=>s.job==='robot'||s.effect==='daylight'?0:Math.min(s.unique?45:30,Math.round(4+base/2));
  const SKILLS=Object.freeze(Object.fromEntries([
    skill('wind_slash','swordsman','裂風斬',true,[140,160,180,200,220],8,'cleave','向前扇形揮砍，不能穿過牆壁。'),
    skill('stance_bash','swordsman','破勢擊',true,[80,90,100,110,120],12,'stun','盾撞或劍柄重擊，短暫擊暈。'),
    skill('whirlwind','swordsman','旋風連斬',true,[180,205,230,255,280],16,'circle','旋身連斬附近怪物；倍率是整次合計。'),
    skill('guard_stance','swordsman','守護架勢',false,[25,30,35,40,45],25,'guard','八秒內降低自身受到的傷害。'),
    skill('taunt','swordsman','挑釁護衛',false,[3,4,5,6,7],22,'taunt','優先吸引身旁最近且無牆阻擋的怪物，替隊友爭取時間。技能一～二級一隻、三～四級兩隻、五～六級三隻。'),
    skill('rally','swordsman','戰意鼓舞',false,[5,8,11,14,18],35,'rally','附近隊友十秒內攻擊增強。'),
    skill('arcane_bolt','mage','奧能飛彈',true,[150,175,200,225,250],8,'bolt','向前發射不能穿牆的奧能光彈。'),
    skill('thunder_wave','mage','雷光震盪',true,[70,85,100,115,130],18,'shock','周圍小範圍傷害與短暫暈眩。'),
    skill('starfall','mage','星隕術',true,[200,225,250,275,300],25,'starfall','蓄力後轟擊前方可見的小範圍。'),
    skill('frost_field','mage','寒霜結界',false,[20,25,30,35,40],26,'frost','六秒內使附近怪物緩速。'),
    skill('barrier','mage','護身結界',false,[10,15,20,25,30],30,'barrier','替指定隊友吸收傷害，最多十秒。'),
    skill('thorn_growth','mage','棘蔓生長',true,[90,110,130,150,170],20,'thorns','前方棘蔓刺傷一隻可見怪物，束縛移動三秒；怪物仍可攻擊。'),
    skill('backstab','scout','背身突襲',true,[70,80,90,100,110],10,'blind','干擾怪物轉向；背後命中可中斷蓄力。'),
    skill('throw_blade','scout','牽制飛刃',true,[45,55,65,75,85],10,'slow','投出飛刃，使怪物短暫緩速。'),
    skill('path_eye','scout','探路之眼',false,[3,4,5,6,7],25,'reveal','短暫看見附近陷阱與通道，不永久揭露地圖。'),
    skill('disarm','scout','拆解陷阱',false,[3,2.6,2.2,1.8,1.4],12,'disarm','靠近一般陷阱後拆除，受傷或移動會中斷。'),
    skill('stealth','scout','潛行步',false,[6,8,10,12,14],30,'stealth','降低被察覺距離，攻擊後解除。'),
    skill('smoke','scout','煙幕掩護',false,[3,4,5,6,7],30,'smoke','煙幕降低附近怪物的視野。'),
    skill('pan_bash','chef','平底鍋敲擊',true,[50,60,70,80,90],13,'stun','向前敲擊，使怪物短暫暈眩。'),
    skill('soup_splash','chef','熱湯潑灑',true,[30,40,50,60,70],13,'splash','前方小範圍潑灑，傷害並使怪物緩速。'),
    skill('quick_meal','chef','隨手料理',false,[18,22,26,30,35],25,'meal','甜根莖補充全隊飽食度。',{root:1}),
    skill('warm_soup','chef','暖胃濃湯',false,G.healingRanks([6,9,12,15,18]),40,'soup','恢復附近隊員的生命。',{root:1,herb:1}),
    skill('snack','chef','打氣點心',false,[4,6,8,10,12],40,'speed','附近隊員二十秒內移動加快。',{root:1,nectar:1}),
    skill('stomach_meal','chef','養胃餐',false,[15,20,25,30,35],45,'stomach','三十秒內減少全隊飽食消耗。',{root:1,mushroom:1}),
    skill('light_bolt','healer','淨光彈',true,[50,60,70,80,90],10,'weak','光彈使怪物下一次攻擊變弱。'),
    skill('repel_wave','healer','驅散震波',true,[30,40,50,60,70],18,'repel','推開身邊怪物，不能推穿牆壁。'),
    skill('herbal_heal','healer','草藥療癒',false,G.healingRanks([20,25,30,35,40]),G.HEALING.herbalCooldown,'heal','一份香草治療指定隊友。',{herb:1}),
    skill('cleanse','healer','淨化之手',false,[30,27,24,21,18],30,'cleanse','解除一般緩速與異常，不移除必要機關。'),
    skill('revive','healer','援起夥伴',false,G.healingRanks([15,20,25,30,35]),100,'revive','扶起一名附近倒地隊友。',{herb:2}),
    skill('blessing','healer','庇護祝福',false,[12,16,20,24,28],40,'ward','抵擋下一次一般異常，不能抵消直接傷害。'),
    skill('hammer_bash','smith','鍛錘重擊',true,[80,90,100,110,120],12,'stagger','使怪物失衡，延後下一次出手。'),
    skill('weak_pin','smith','破綻飛釘',true,[30,40,50,60,70],12,'mark','留下弱點，讓後續攻擊更有效。'),
    skill('repair','smith','應急修補',false,[8,10,12,14,16],30,'repair','修復指定隊員一件未破損、非核心裝備最大耐久的8～18%；每次最多30耐久。',{shell:1}),
    skill('reinforce','smith','臨時加固',false,[1,2,3,4,5],40,'fortify','三十秒內抵銷數次裝備耐久消耗。',{shell:1}),
    skill('barricade','smith','架設路障',false,[20,28,36,44,52],35,'barricade','放置怪物可擊破的臨時路障，最多一座。',{shell:1}),
    skill('polish','smith','武器磨礪',false,[8,11,14,17,20],40,'polish','指定隊友的武器二十秒內增傷。',{shell:1}),
    skill('piercing_arrow','archer','穿風箭',true,[150,175,200,225,250],9,'arrow','射出一支強力箭，不能穿牆。'),
    skill('binding_arrow','archer','纏枝箭',true,[80,95,110,125,140],14,'binding','箭矢使目標短暫緩速。'),
    skill('arrow_volley','archer','群星箭雨',true,[190,220,250,280,310],22,'volley','向前射出散射箭，最多擊中三隻怪物。'),
    skill('keen_sight','archer','鷹眼巡望',false,[3,4,5,6,7],25,'reveal','短暫辨識附近陷阱與路徑。'),
    skill('woodland_stride','archer','林間疾步',false,[8,11,14,17,20],35,'speed','附近隊友二十秒內移動加快。'),
    skill('ranger_ward','archer','葉幕守護',false,[15,20,25,30,35],35,'guard','八秒內以葉幕減輕自己受到的傷害。'),
  ].concat(ROBOT.actives,G.actives,A.actives).map(s=>{const value=G.sixth(s),seconds=preparationSeconds(s.id),ammo=s.job==='archer'&&s.attack?(['volley','great_arrow'].includes(s.effect)?3:1):0;return [s.id,Object.freeze({...value,preparation:seconds,ammo,cooldown:value.cooldown*COOLDOWN_SCALE,mp:mpCostFor(value,value.cooldown),power:s.effect==='disarm'?Object.freeze(value.power.map(n=>shorterPreparation(n+.5))):s.effect==='cleanse'?Object.freeze(value.power.map(n=>n*COOLDOWN_SCALE)):value.power,description:value.description+(ammo?' 消耗箭矢 '+ammo+' 支。':'')+(seconds?' 準備 '+seconds+' 秒後生效。':'')})];})));
  const passive=(id,job,name,power,description)=>Object.freeze({id,job,name,power:Object.freeze(power),description});
  const PASSIVES=Object.freeze(Object.fromEntries([
    passive('might','swordsman','剛力',[4,6,8,10,12],'本人的普通攻擊更有力。'),
    passive('endurance','swordsman','耐力',[15,20,25,30,35],'全隊的飽食度消耗較慢。'),
    passive('guard_instinct','swordsman','護衛本能',[10,15,20,25,30],'自動攔截近身威脅，攔截時減傷。'),
    passive('extension','mage','魔力延續',[10,20,30,40,50],'一般計時道具延長；不延長火把或日光術。'),
    passive('recovery','mage','奧能調息',[4,6,8,10,12],'主動技能冷卻縮短；日光術仍為十分鐘。'),
    passive('resonance','mage','元素共鳴',[5,10,15,20,25],'緩速與弱化較持久，不延長暈眩。'),
    passive('fleet','scout','輕足',[4,6,8,10,12],'本人移動更輕快。'),
    passive('intuition','scout','迷宮直覺',[2,3,4,5,6],'變形後短暫顯示出口路線。'),
    passive('trap_sense','scout','避險本能',[5,10,15,20,25],'減少隊伍承受的一般陷阱傷害。'),
    passive('gourmet','chef','美食品鑑',[10,20,30,40,50],'食物恢復更多飽食度。'),
    passive('double_portion','chef','一料雙份',[20,35,50,70,100],'營地料理有機會多做一份。'),
    passive('nourishment','chef','慢火養生',G.healingRanks([2,3,4,5,6]),'本人進食後十秒內緩慢恢復生命。'),
    passive('herbalism','healer','草藥專精',[5,10,15,20,25],'本人施放的治療更有效。'),
    passive('rescue','healer','救援本能',[80,70,60,50,40],'可自動施放自己擁有的治療或扶起技能；仍需材料。'),
    passive('purity','healer','淨化體質',[10,15,20,25,30],'本人受到的緩速等負面狀態較短。'),
    passive('tool_supply','smith','工具補給',[90,75,65,55,45],'補充一個普通破障工具，不能破壞章末封印。'),
    passive('economy','smith','節省工料',[10,20,30,40,50],'營地修理與鍛造較便宜。'),
    passive('care','smith','精工養護',[10,15,20,25,30],'本人裝備有機會不消耗耐久。'),
    passive('steady_aim','archer','穩弦',[4,7,10,13,16],'弓箭與射手攻擊技能傷害增加。'),
    passive('nimble_shot','archer','快箭',[3,5,7,9,11],'弓箭普通攻擊間隔縮短。'),
    passive('leaf_steps','archer','輕葉步',[3,5,7,9,11],'本人移動速度增加。'),
  ].concat(ROBOT.passives,G.passives,A.passives).map(s=>[s.id,Object.freeze(G.sixth(s))])));
  function scale(skill){const s=typeof skill==='string'?(SKILLS[skill]||PASSIVES[skill]):skill;if(s.attack)return {label:'傷害倍率',unit:'%'};const units={escape:['沿線加速','%'],feast:['恢復飽食','點'],sanctuary:['恢復最大生命','%'],fortress:['最大生命護盾','%'],guard:['減傷','%'],taunt:['持續','秒'],rally:['增傷','%'],frost:['緩速','%'],barrier:['吸收傷害','點'],daylight:['照明半徑','格'],reveal:['探查半徑','格'],disarm:['拆除作業','秒'],stealth:['持續','秒'],smoke:['持續','秒'],meal:['恢復飽食','點'],soup:['恢復生命','點'],speed:['加速','%'],stomach:['降低飽食消耗','%'],weak:['弱化','%'],heal:['恢復生命','點'],cleanse:['冷卻','秒'],revive:['恢復最大生命','%'],ward:['保護時限','秒'],repair:['恢復耐久','點'],fortify:['保護耐久消耗','次'],barricade:['路障生命','點'],polish:['增傷','%']},special={iron_wall:['增加防禦','點'],sturdy_gear:['增加防禦','點'],steadfast:['全隊防禦','點'],gentle_care:['增加治療','點'],food_sharing:['全隊恢復生命','點'],intuition:['路線提示','秒'],rescue:['自動救援間隔','秒'],tool_supply:['工具補充間隔','秒'],nourishment:['十秒合計恢復生命','點']};const v=units[s.effect]||special[s.id]||['效果','%'];return {label:v[0],unit:v[1]};}
  const robotScale=s=>({robot_body:['最大生命增加','點'],robot_restore:['恢復生命','點'],robot_guard:['減傷','%'],robot_speed:['自身加速','%'],mech_aid:['最大生命護盾','%']})[s.id]||({robot_restore:['恢復生命','點'],robot_guard:['減傷','%'],robot_speed:['自身加速','%'],mech_aid:['最大生命護盾','%']})[s.effect];
  const readScale=s=>{const def=typeof s==='string'?(SKILLS[s]||PASSIVES[s]):s,robot=robotScale(def);return def.id==='repair'?{label:'恢復最大耐久',unit:'%'}:robot?{label:robot[0],unit:robot[1]}:scale(def);};
  const state=run=>run?.party?.loadouts||null,enabled=run=>!!state(run);
  const ids=run=>['hero',...run.party.members.map(m=>m.id)];
  const job=(run,id=state(run)?.active||'hero')=>id==='hero'?run.party.profession:run.party.members.find(m=>m.id===id)?.profession;
  const sex=(run,id=state(run)?.active||'hero')=>P().sex(run,id);
  const level=(run,id=state(run)?.active||'hero')=>id==='hero'?state(run)?.level||1:run.party.members.find(m=>m.id===id)?.level||1;
  const maxLevel=(run,id='hero')=>id==='hero'?(C().isUnderworld(run)?15:10):(C().isUnderworld(run)?10:5);
  const experience=(run,id='hero')=>id==='hero'?state(run)?.xp||0:run.party.members.find(m=>m.id===id)?.xp??G.XP[level(run,id)-1];
  // Progress toward the next level, 0-1 (1 at the level cap). Surface companions
  // level up together with the protagonist, so their bar follows the hero's;
  // underground companions earn their own experience.
  function xpProgress(run,id='hero'){
    if(!enabled(run))return 0;const l=level(run,id);if(l>=maxLevel(run,id))return 1;
    if(id!=='hero'&&!C().isUnderworld(run))return xpProgress(run,'hero');
    const lo=G.XP[l-1],hi=G.XP[l];return Math.max(0,Math.min(1,(experience(run,id)-lo)/(hi-lo)));
  }
  const actor=(run,id=state(run)?.active)=>state(run)?.actors[id];
  // Free ability points; a missing record (a save from before ability scores) counts as none spent.
  const NO_ATTRIBUTES=Object.freeze(Object.fromEntries(ATTRIBUTES.map(k=>[k,0])));
  const attrs=(run,id=state(run)?.active)=>actor(run,id)?.attrs||NO_ATTRIBUTES,attr=(run,id,key)=>attrs(run,id)[key]||0;
  const freePoints=lvl=>FREE_POINTS_PER_LEVEL*(Math.max(1,lvl)-1),spentPoints=a=>ATTRIBUTES.reduce((n,k)=>n+(a?.[k]||0),0);
  const attributeAllowed=(profession,key)=>ATTRIBUTES.includes(key)&&!(profession==='robot'&&key==='int');
  const unspentPoints=(run,id=state(run)?.active)=>Math.max(0,freePoints(level(run,id))-spentPoints(attrs(run,id)));
  const critChance=(run,id=state(run)?.active)=>(CRIT_BASE[job(run,id)]??CRIT_DEFAULT)+attr(run,id,'luk')*ATTRIBUTE_STEP.luk;
  // MP: (40 + 5 per level) x the job's spirit, +2% per free intellect point; robots have none. A missing value means full.
  const mpMax=(profession,lvl,int=0)=>Math.round((40+5*lvl)*(SPIRIT[profession]??1)*(1+ATTRIBUTE_STEP.intMp*(Number.isInteger(int)?Math.max(0,Math.min(P().ATTRIBUTE_CAP,int)):0)));
  const maxMp=(run,id=state(run)?.active||'hero')=>mpMax(job(run,id),level(run,id),attr(run,id,'int'));
  const mp=(run,id=state(run)?.active||'hero')=>{const a=actor(run,id);return a?Math.min(maxMp(run,id),a.mp??maxMp(run,id)):0;};
  const mpRegen=(run,id)=>maxMp(run,id)?1.2+maxMp(run,id)*.015:0;
  const mpReady=(run,id,skillId)=>mp(run,id)>=(SKILLS[skillId]?.mp||0);
  function restoreMp(run,id,amount){const a=actor(run,id),max=maxMp(run,id);if(!a||!max)return 0;const before=mp(run,id),next=Math.min(max,before+Math.max(0,amount));if(next>=max)delete a.mp;else a.mp=next;return next-before;}
  const maxHp=(run,id=state(run)?.active||'hero')=>P().vitalHp(job(run,id),level(run,id),id==='hero',attr(run,id,'vit'))+pv(run,'robot_body',id);
  const hp=(run,id)=>id===state(run)?.active?run.hp:id==='hero'?state(run).heroHp:run.party.members.find(m=>m.id===id)?.hp||0;
  const equipment=(run,id=state(run)?.active)=>id===state(run)?.active?run.equipment:actor(run,id)?.equipment;
  const pv=(run,key,id=state(run)?.active)=>actor(run,id)?.passives.includes(key)?PASSIVES[key].power[G.skillLevel(run,id)-1]:0;
  const teamPassive=(run,key)=>enabled(run)?Math.max(0,...ids(run).filter(id=>hp(run,id)>0).map(id=>pv(run,key,id))):0;
  const buff=(run,key,id=state(run)?.active)=>actor(run,id)?.buffs.find(b=>b.id===key&&b.left>0)||null;
  const tauntTargetLimit=skillLevel=>Math.ceil(Math.max(1,Math.min(6,Math.floor(Number(skillLevel)||1)))/2);
  function tauntMonsterIds(run){
    // tickEffects clones the run every frame, so a per-run cache would miss on
    // every refresh. Derive only cheap stable IDs, not full species/drop data.
    // Puzzle rifts have no combatants and a hunt rift only its own; never carry the tower roster into either.
    const valid=new Set();if(run.expedition?.active){const hunt=Dg()?.isHuntId?.(run.expedition.active.id)?Dg().activeOffer(run):null;for(let i=0;i<(hunt?.count||0);i++)valid.add('monster-h-'+i);return valid;}
    const count=C().floorConfig(run.floor,run.seed).monsterCount;
    for(let i=0;i<count;i++)valid.add('monster-'+i);
    const lord=B().spec(run);if(lord)valid.add(lord.id);
    if(B().hasMini?.(run))valid.add(C().isUnderworld(run)?B().UNDERWORLD_ID:B().ID);
    for(const m of run.party.reinforcements?.monsters||[])valid.add(m.id);
    return valid;
  }
  // Share one target budget across instant taunts, cooperation and aura refreshes.
  // Refreshes retain valid targets instead of flickering between nearby enemies.
  function applyTaunt(run,id,{monsters=[],origin,clear,seconds=0,radius=5,retain=false}={}){
    if(!enabled(run)||!actor(run,id))return [];
    const enemy=state(run).enemy,point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z),validIds=tauntMonsterIds(run);
    const candidates=new Map();
    if(hp(run,id)>0&&point(origin)&&typeof clear==='function'&&Number.isFinite(seconds)&&seconds>0){
      for(const m of monsters){const p=m?.model?.position||m,st=enemy[m?.id];
        if(!m||m.alive===false||!validIds.has(m.id)||run.defeatedMonsters.includes(m.id)||run.party.health[m.id]===0||!point(p)||retain&&st?.tauntLeft>0&&st.tauntId!==id)continue;
        const distance=Math.hypot(p.x-origin.x,p.z-origin.z);if(distance>radius)continue;
        let visible=false;try{visible=clear(origin,p)===true;}catch{}if(!visible)continue;
        candidates.set(m.id,{id:m.id,distance,retained:retain&&st?.tauntId===id&&st.tauntLeft>0});
      }
    }
    const chosen=[...candidates.values()].sort((a,b)=>Number(b.retained)-Number(a.retained)||a.distance-b.distance||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,tauntTargetLimit(G.skillLevel(run,id))).map(m=>m.id),selected=new Set(chosen);
    for(const [key,st]of Object.entries(enemy))if(st.tauntId===id&&!selected.has(key)){delete st.tauntId;delete st.tauntLeft;}
    for(const key of chosen){const st=enemy[key]||(enemy[key]={});st.tauntId=id;st.tauntLeft=Math.min(60,seconds);}
    return chosen;
  }
  function pruneTaunts(run){
    const enemy=state(run).enemy,keys=Object.keys(enemy).sort();
    for(const id of ids(run)){let count=0;const alive=hp(run,id)>0,limit=tauntTargetLimit(G.skillLevel(run,id));for(const key of keys){const st=enemy[key];if(st.tauntId!==id)continue;if(!alive||run.defeatedMonsters.includes(key)||run.party.health[key]===0||!(st.tauntLeft>0)||++count>limit){delete st.tauntId;delete st.tauntLeft;}}}
  }
  function setBuff(run,id,key,left,power=0){const a=actor(run,id),old=buff(run,key,id);if(old&&['rally','speed','polish','barrier','fortify','stomach','ward','path_eye','daylight'].includes(key)){left=Math.max(left,old.left);power=Math.max(power,old.power);}a.buffs=a.buffs.filter(b=>b.id!==key);a.buffs.push({id:key,left,power});}
  function hash(seed,text){let h=seed>>>0;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  const mix=h=>{h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;};
  function roll(run,id,salt){const a=actor(run,id);return hash(run.seed,id+':'+salt+':'+a.roll++)%100;}
  function draft(seed,profession,identity){
    const skills=Object.values(SKILLS).filter(s=>s.job===profession&&!s.unique),sets=[];
    for(let i=0;i<skills.length;i++)for(let j=i+1;j<skills.length;j++)for(let k=j+1;k<skills.length;k++){
      const group=[skills[i],skills[j],skills[k]];
      if(group.some(s=>s.attack)&&group.some(s=>!s.attack)&&(profession!=='healer'||group.some(s=>['herbal_heal','revive'].includes(s.id))))sets.push(group.map(s=>s.id));
    }
    const passives=Object.values(PASSIVES).filter(s=>s.job===profession&&!s.unique).map(s=>s.id),first=hash(seed,identity+':passives')%passives.length,second=(first+1+hash(seed,identity+':passives2')%(passives.length-1))%passives.length;
    return {skills:sets[hash(seed,identity+':skills')%sets.length],passives:[passives[first],passives[second]]};
  }
  function reorderSkills(run,id,order,revision=run.revision){return C().transaction(run,revision,n=>{const a=actor(n,id);if(!a||!Array.isArray(order)||order.length!==a.skills.length||new Set(order).size!==order.length||!order.every(k=>a.skills.includes(k)))return {ok:false,message:'只能排列這位人物已擁有的技能。'};a.skills=[...order];return {ok:true};});}
  function showHeadgear(run,id,visible,revision=run.revision){return C().transaction(run,revision,n=>{const a=actor(n,id);if(!a||typeof visible!=='boolean')return {ok:false,message:'找不到這位隊員。'};a.showHelmet=visible;return {ok:true,message:visible?'顯示頭部裝備':'顯示原本髮型，裝備防禦仍保留。'};});}
  function makeActor(run,id,profession){
    const draw=draft(run.seed,profession,id==='hero'?'hero':profession),j=JOBS[profession],head={heavy:'heavy_helm',light:'light_hood',robe:'rune_crown'}[j.armor],body={heavy:'heavy_armor',light:'light_armor',robe:'robe'}[j.armor];
    const make=kind=>C().createGear(kind,run.floor,run.seed,id+':starter:'+kind);
    return {...draw,learned:null,showHelmet:true,attrs:{...NO_ATTRIBUTES},attrAuto:id!=='hero',equipment:profession==='robot'?{helmet:null,armor:make('robot_shell'),weapon:make('robot_fists'),shield:null,core1:make('robot_core'),core2:null}:{helmet:make(head),armor:make(body),weapon:make(j.starter),shield:GEAR[j.starter].hands===1?make('buckler'):null},cooldowns:Object.fromEntries(draw.skills.map(s=>[s,0])),buffs:[],attack:0,hurt:0,tool:0,autoLeft:0,autoRescue:false,roll:0,pending:null,shot:null,...(profession==='robot'?{robot:ROBOT.freshState()}:{} )};
  }
  function preview(run,offer){if(offer.returning){const saved=R().remembered(run,offer.profession,offer.sex)?.loadout;return {...(saved?clone(saved):draft(run.seed,offer.profession,offer.profession)),equipment:offer.profession==='robot'&&saved?.robotEquipment?clone(saved.robotEquipment):Object.fromEntries(SLOTS.map(k=>[k,null]))};}return makeActor(run,offer.id,offer.profession);}
  function enable(run){return C().transaction(run,run.revision,n=>{
    if(!n.party||state(n))return {ok:false,message:'請先選職業，或繼續既有職業旅程。'};
    n.party.loadouts={version:1,xpScale:G.XP_SCALE,active:'hero',level:1,xp:0,heroHp:n.hp,switchLeft:0,actors:{},enemy:{},removedTraps:[]};
    for(const id of ids(n))state(n).actors[id]=makeActor(n,id,job(n,id));
    state(n).growth=G.fresh(ids(n));
    n.equipment=actor(n,'hero').equipment;actor(n,'hero').equipment=null;n.charIdx=JOBS[job(n)].charIdx;
    if(job(n)==='robot')setHp(n,'hero',maxHp(n,'hero'));
    n.gearBag=[];n.engine.shovels=0;n.engine.shovelCooldownMs=0;
    if(ids(n).some(id=>job(n,id)==='archer'))n.bag.arrow=Math.max(n.bag.arrow,30);
    return {ok:true,message:'三個主動、兩個被動技能已確定。',effect:{loadouts:true}};
  });}
  function addMember(run,member){if(enabled(run)){member.xp=G.XP[member.level-1];state(run).actors[member.id]=makeActor(run,member.id,member.profession);G.state(run).policies[member.id]=G.policy();G.state(run).members[member.id]=G.freshRecord();if(member.profession==='robot')member.hp=maxHp(run,member.id);settleAttributes(run,member.id);if(member.profession==='archer')run.bag.arrow=Math.max(run.bag.arrow,Math.min(C().itemLimit('arrow',run),run.bag.arrow+15));}}
  // Returning travellers keep learned talents, not a second starter kit or
  // expired combat effects. The save validator below shares the live rules.
  function recruitSnapshot(run,id){const a=actor(run,id),g=G.record(run,id);return a?{skills:[...a.skills],passives:[...a.passives],learned:a.learned??null,showHelmet:a.showHelmet!==false,roll:a.roll,growth:{choices:[...g.choices],awakening:g.awakening},attrs:{...attrs(run,id)},attrAuto:a.attrAuto===true,...(job(run,id)==='robot'?{robotEquipment:clone(equipment(run,id)),robotResources:{fuel:a.robot.fuel,repairClock:a.robot.repairClock}}:{} )}:null;}
  function restoreMember(run,member,snapshot){if(!enabled(run))return;
    const saved=snapshot||{...draft(run.seed,member.profession,member.profession),learned:null,showHelmet:true,roll:0,growth:{choices:[],awakening:null}},a={skills:[...saved.skills],passives:[...saved.passives],learned:saved.learned,showHelmet:saved.showHelmet,roll:saved.roll,attrs:{...NO_ATTRIBUTES},attrAuto:saved.attrAuto??true,equipment:Object.fromEntries(SLOTS.map(k=>[k,null])),cooldowns:Object.fromEntries(saved.skills.map(k=>[k,0])),buffs:[],attack:0,hurt:0,tool:0,autoLeft:0,autoRescue:false,pending:null,shot:null};
    if(member.profession==='robot'){a.equipment=saved.robotEquipment?clone(saved.robotEquipment):ROBOT.normalizeEquipment({helmet:null,armor:C().createGear('robot_shell',run.floor,run.seed,member.id+':restored-shell'),weapon:C().createGear('robot_fists',run.floor,run.seed,member.id+':restored-fists'),shield:null});a.robot={...ROBOT.freshState(),...(saved.robotResources||{})};}
    state(run).actors[member.id]=a;G.state(run).policies[member.id]=G.policy();G.state(run).members[member.id]={...G.freshRecord(),choices:[...saved.growth.choices],awakening:saved.growth.awakening};
    if(saved.attrs)withLife(run,member.id,()=>{a.attrs={...saved.attrs};});settleAttributes(run,member.id);
  }
  function validateRecruitSnapshot(value,profession,actorLevel,floor){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['skills','passives','learned','showHelmet','roll','growth','attrs','attrAuto','robotEquipment','robotResources'].includes(k))||typeof value.showHelmet!=='boolean'||!num(value.roll,0,Number.MAX_SAFE_INTEGER-1,true))return null;
    const g=value.growth;if(!g||typeof g!=='object'||Array.isArray(g)||Object.keys(g).some(k=>!['choices','awakening'].includes(k))||!Array.isArray(g.choices)||g.choices.length>3||new Set(g.choices).size!==g.choices.length||!(g.awakening===null||typeof g.awakening==='string'))return null;
    if(!validTalents(value,profession,actorLevel,g,'returning',floor))return null;
    const remembered=value.attrs===undefined?null:validAttrs(value.attrs,profession,actorLevel);if(value.attrs!==undefined&&!remembered||value.attrAuto!==undefined&&typeof value.attrAuto!=='boolean')return null;
    let robotEquipment,robotResources;if(profession==='robot'){robotEquipment=validateActorEquipment(value.robotEquipment,profession,actorLevel,floor);if(!robotEquipment)return null;const old=Object.keys(value.robotEquipment).length===4;robotResources=value.robotResources??(old?{fuel:100,repairClock:0}:null);if(!robotResources||Object.keys(robotResources).length!==2||!num(robotResources.fuel,0,100)||!num(robotResources.repairClock,0,ROBOT.REPAIR_SECONDS)||robotResources.repairClock===ROBOT.REPAIR_SECONDS)return null;robotResources={...robotResources};}else if(value.robotEquipment!==undefined||value.robotResources!==undefined)return null;
    return {skills:[...value.skills],passives:[...value.passives],learned:value.learned??null,showHelmet:value.showHelmet,roll:value.roll,growth:{choices:[...g.choices],awakening:g.awakening},...(remembered?{attrs:remembered}:{}),...(value.attrAuto!==undefined?{attrAuto:value.attrAuto}:{}),...(robotEquipment?{robotEquipment,robotResources}:{} )};
  }
  function removeMember(run,id){if(!enabled(run))return true;if(id===state(run).active)return false;F()?.clear(run,id);for(const list of Object.values(F()?.state(run)?.enemies||{}))for(const s of list)if(s.owner===id)s.owner=null;delete state(run).actors[id];const growth=G.state(run);delete growth.policies[id];delete growth.members[id];delete growth.imprints[id];delete growth.nearby[id];for(const k of Object.keys(growth.nearby))growth.nearby[k]=growth.nearby[k].filter(x=>x!==id);for(const e of Object.values(state(run).enemy)){if(e.tauntId===id){delete e.tauntId;delete e.tauntLeft;}if(e.relayOwner===id){delete e.relayOwner;delete e.relay;}}return true;}
  function sync(run){if(!enabled(run))return;for(const id of ids(run))settleAttributes(run,id);const s=state(run);run.hp=Math.min(maxHp(run),run.hp);if(s.active==='hero')s.heroHp=run.hp;else{const m=run.party.members.find(m=>m.id===s.active);if(m)m.hp=run.hp;}}
  function setHp(run,id,value){value=Math.max(0,Math.min(maxHp(run,id),value));if(id===state(run).active)run.hp=value;if(id==='hero')state(run).heroHp=value;else run.party.members.find(m=>m.id===id).hp=value;}
  // Pure: spend every unspent free point along the profession's plan (used for automatic actors and old saves).
  function autoSpend(free,profession,lvl){
    const out={...NO_ATTRIBUTES,...free},plan=ATTRIBUTE_PLAN[profession]||ATTRIBUTES,open=k=>attributeAllowed(profession,k)&&out[k]<P().ATTRIBUTE_CAP;
    for(let left=freePoints(lvl)-spentPoints(out);left>0;left--){const start=spentPoints(out)%plan.length,key=[...plan.slice(start),...plan.slice(0,start)].find(open)||ATTRIBUTES.find(open);if(!key)break;out[key]++;}
    return out;
  }
  function validAttrs(value,profession,lvl){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==ATTRIBUTES.length||!ATTRIBUTES.every(k=>num(value[k],0,attributeAllowed(profession,k)?P().ATTRIBUTE_CAP:0,true))||spentPoints(value)>freePoints(lvl))return null;
    return Object.fromEntries(ATTRIBUTES.map(k=>[k,value[k]]));
  }
  // A raised life ceiling raises current life by the same amount, exactly like a level up.
  function withLife(run,id,change){const before=hp(run,id),max=maxHp(run,id);change();if(before>0)setHp(run,id,before+maxHp(run,id)-max);}
  function settleAttributes(run,id){const a=actor(run,id);if(!a)return;if(!a.attrs)a.attrs={...NO_ATTRIBUTES};if(typeof a.attrAuto!=='boolean')a.attrAuto=id!=='hero';if(a.attrAuto&&unspentPoints(run,id)>0)withLife(run,id,()=>{a.attrs=autoSpend(a.attrs,job(run,id),level(run,id));});}
  function allocate(run,id,key,revision=run.revision){return C().transaction(run,revision,n=>{
    const a=actor(n,id);if(!a||!ATTRIBUTES.includes(key))return {ok:false,message:'找不到這位隊員或能力值。'};
    if(!attributeAllowed(job(n,id),key))return {ok:false,message:'機器人沒有 MP 與法術，不能分配智力。'};
    if(unspentPoints(n,id)<=0)return {ok:false,message:'沒有可分配的自由點數；每升一級可得 '+FREE_POINTS_PER_LEVEL+' 點。'};
    if(attr(n,id,key)>=P().ATTRIBUTE_CAP)return {ok:false,message:ATTRIBUTE_NAMES[key]+'的自由點數已達上限 '+P().ATTRIBUTE_CAP+' 點。'};
    withLife(n,id,()=>{a.attrs={...attrs(n,id),[key]:attr(n,id,key)+1};});
    return {ok:true,message:ATTRIBUTE_NAMES[key]+' +1',effect:{attribute:key,actorId:id}};
  });}
  function setAttributeAuto(run,id,on,revision=run.revision){return C().transaction(run,revision,n=>{const a=actor(n,id);if(!a||typeof on!=='boolean')return {ok:false,message:'找不到這位隊員。'};a.attrAuto=on;settleAttributes(n,id);return {ok:true,message:on?'自動配點：開，剩餘與之後的點數依職業建議分配。':'自動配點：關，之後的點數由你分配。'};});}
  // The forgetting draught returns every free point; the actor then waits for a manual choice.
  function forgetAttributes(run,id){const a=actor(run,id);if(!a||spentPoints(attrs(run,id))<=0)return 0;const refunded=spentPoints(attrs(run,id));a.attrs={...NO_ATTRIBUTES};a.attrAuto=false;setHp(run,id,hp(run,id));if(a.mp!==undefined&&a.mp>=maxMp(run,id))delete a.mp;return refunded;}
  function attributeSheet(run,id=state(run)?.active){
    const profession=job(run,id),lvl=level(run,id),base=ATTRIBUTE_BASE[profession],growth=ATTRIBUTE_GROWTH[profession],free=attrs(run,id);
    return {points:freePoints(lvl),unspent:unspentPoints(run,id),auto:actor(run,id)?.attrAuto===true,crit:critChance(run,id),cap:P().ATTRIBUTE_CAP,
      scores:ATTRIBUTES.map(key=>{const natural=base[key]+(growth[key]||0)*(lvl-1);return {key,name:ATTRIBUTE_NAMES[key],natural,free:free[key]||0,total:natural+(free[key]||0),allowed:attributeAllowed(profession,key)};})};
  }
  function switchRaw(run,id){const s=state(run);sync(run);const nextHp=hp(run,id);actor(run).equipment=run.equipment;run.equipment=actor(run,id).equipment;actor(run,id).equipment=null;s.active=id;run.hp=nextHp;run.charIdx=JOBS[job(run,id)].charIdx;s.switchLeft=1;sync(run);}
  function returnToHero(run){if(!enabled(run))return;if(state(run).active!=='hero')switchRaw(run,'hero');state(run).switchLeft=0;setHp(run,'hero',Math.max(1,hp(run,'hero')));sync(run);}
  function switchActor(run,id,revision){return C().transaction(run,revision,n=>{
    if(!enabled(n)||!ids(n).includes(id)||id===state(n).active||hp(n,id)<=0)return {ok:false,message:'請選擇仍能行動的其他隊友。'};
    if(state(n).switchLeft>0)return {ok:false,message:'正在交接隊伍，稍等一下。'};
    const from=state(n).active;switchRaw(n,id);return {ok:true,message:'改由'+JOBS[job(n)].name+'帶隊。',effect:{switched:true,from,to:id}};
  });}
  function followerRecords(run){if(!enabled(run))return run.party.members;return ids(run).filter(id=>id!==state(run).active).map(id=>({id,profession:job(run,id),sex:sex(run,id),level:level(run,id),hp:hp(run,id),cooldown:actor(run,id).attack,hurtLeft:actor(run,id).hurt}));}
  const canLearn= (run,id)=>enabled(run)&&id!=='hero'&&ids(run).includes(id)&&G.available(run,id)>0;
  function learnCompanion(run,id,key,revision=run.revision){if(id==='hero'||revision!==run.revision)return {ok:false,run,message:'請重新查看隊員技能。'};return G.choose(run,key,id);}
  function allGear(run){return [...run.gearBag,...Object.values(run.equipment).filter(Boolean),...(enabled(run)?Object.values(state(run).actors).flatMap(a=>Object.values(a.equipment||{}).filter(Boolean)):[])];}
  function canEquip(run,id,gear){
    const d=GEAR[gear?.kind];if(!d||!actor(run,id)||!d.jobs.includes(job(run,id))||level(run,id)<d.requiredLevel||d.tier>3&&!C().isUnderworld(run))return false;
    if(d.integrated||d.core||job(run,id)==='robot')return false;
    return !(d.slot==='shield'&&GEAR[equipment(run,id)?.weapon?.kind]?.hands===2);
  }
  function equip(run,id,gearId,revision){return C().transaction(run,revision,n=>{
    if(!enabled(n)||!ids(n).includes(id))return {ok:false,message:'找不到這位隊員。'};
    const g=allGear(n).find(g=>g.id===gearId);if(!g||!canEquip(n,id,g))return {ok:false,message:GEAR[g?.kind]?.requiredLevel>level(n,id)?'這件裝備需要等級 '+GEAR[g.kind].requiredLevel+'。':'這個職業或雙手武器無法配戴這件裝備。'};
    const target=equipment(n,id);if(target[g.slot]?.id===g.id)return {ok:false,message:'已經穿戴這件裝備。'};
    const bagIndex=n.gearBag.findIndex(x=>x.id===gearId),owner=ids(n).find(k=>equipment(n,k)?.[g.slot]?.id===gearId);
    const returned=[target[g.slot],...(g.slot==='weapon'&&GEAR[g.kind].hands===2?[target.shield]:[])].filter(Boolean);
    if(n.gearBag.length-(bagIndex>=0?1:0)+returned.length>24)return {ok:false,message:'背包空間不足，先留位置放回原裝備與盾牌。'};
    if(bagIndex>=0)n.gearBag.splice(bagIndex,1);else if(owner)equipment(n,owner)[g.slot]=null;else return {ok:false,message:'裝備已被移動，請重新查看。'};
    n.gearBag.push(...returned);if(g.slot==='weapon'&&GEAR[g.kind].hands===2)target.shield=null;target[g.slot]=g;
    return {ok:true,message:'已裝備 '+g.name,effect:{equipped:g,actorId:id}};
  });}
  // Would someone in the party be stronger wearing this bag item? Measured with
  // the real equip transaction on a copy, so bonuses, forging, broken gear and
  // the shield a two-hand weapon displaces all count. Read only: nothing changes.
  // An outer bound on anyone's life in a hero journey (the exact cap per actor is maxHp):
  // the sturdiest hero or companion at the level cap, plus the robot body talent's 30.
  function hpCeiling(under){const jobs=Object.keys(P().VITALITY),vit=P().ATTRIBUTE_CAP;return Math.max(...jobs.map(j=>P().vitalHp(j,under?15:10,true,vit)),...jobs.map(j=>P().vitalHp(j,under?10:5,false,vit)))+30;}
  // Any rise counts: suggest it whenever attack per second or defense goes up,
  // even if the other one drops (a two-hand weapon displacing a shield); the
  // comparison shows both. Only floating-point noise is ignored.
  const UPGRADE_EPSILON=1e-6,offenseOf=s=>Math.max(s.damage,s.spellDamage)*(1+s.support)/s.interval;
  function upgradeGain(before,after){
    const offense=after.offense/before.offense-1,armor=(after.armor-before.armor)/Math.max(4,before.armor);
    if(offense<=UPGRADE_EPSILON&&armor<=UPGRADE_EPSILON)return null;
    return {offense,armor,gain:Math.max(offense,armor),tradeoff:offense<-UPGRADE_EPSILON||armor<-UPGRADE_EPSILON};
  }
  function upgradeFor(run,gearId){
    if(!enabled(run))return null;const g=run.gearBag.find(x=>x.id===gearId),d=GEAR[g?.kind];if(!g||!d||g.durability<=0)return null;
    let best=null;
    for(const id of ids(run)){
      if(!canEquip(run,id,g))continue;const trial=equip(run,id,gearId,run.revision);if(!trial.ok)continue;
      const s0=stats(run,id),s1=stats(trial.run,id),before={offense:offenseOf(s0),armor:s0.armor},after={offense:offenseOf(s1),armor:s1.armor},rise=upgradeGain(before,after);
      if(!rise)continue;
      const candidate={gearId,actorId:id,slot:d.slot,gear:g,worn:equipment(run,id)[d.slot]||null,...rise,before,after,shieldOff:d.slot==='weapon'&&!!equipment(run,id).shield&&!equipment(trial.run,id).shield};
      // A pure improvement beats a trade-off; then the larger rise; ties go to the leader.
      const better=!best||(best.tradeoff&&!candidate.tradeoff)||best.tradeoff===candidate.tradeoff&&(candidate.gain>best.gain+1e-9||Math.abs(candidate.gain-best.gain)<=1e-9&&id===state(run).active);
      if(better)best=candidate;
    }
    return best;
  }
  function unequip(run,id,slot,revision){return C().transaction(run,revision,n=>{
    if(job(n,id)==='robot')return {ok:false,message:'機殼與拳臂是一體機件，不能卸下或轉交；可到營地進階。'};
    if(!enabled(n)||!ids(n).includes(id)||!SLOTS.includes(slot)||!equipment(n,id)[slot])return {ok:false,message:'這個位置沒有裝備。'};
    if(n.gearBag.length>=24)return {ok:false,message:'裝備背包已滿。'};
    const gear=equipment(n,id)[slot];n.gearBag.push(gear);equipment(n,id)[slot]=null;return {ok:true,message:'卸下 '+gear.name};
  });}
  function stats(run,id=state(run)?.active){
    const e=equipment(run,id)||{},w=e.weapon?.durability>0?e.weapon:null,d=GEAR[w?.kind],armor=Object.values(e).filter(g=>g&&g.durability>0).reduce((n,g)=>n+g.defense+X().traitPower(g,'defense'),0)+(job(run,id)==='robot'&&!(e.armor?.durability>0)?4:0),robes=Object.values(e).filter(g=>g&&g.durability>0&&GEAR[g.kind]?.type==='robe').length;
    const mark=G.imprintFor(run,id,w),bonusArmor=pv(run,'iron_wall',id)+(armor?pv(run,'sturdy_gear',id):0)+teamPassive(run,'steadfast')+Object.values(e).filter(g=>g&&g.slot!=='weapon').reduce((n,g)=>{const m=G.imprintFor(run,id,g);return n+(m?2*(m.boost||1):0);},0),totalArmor=armor+bonusArmor;
    const growth=(id==='hero'?1+.02*(level(run,id)-1):1)*(F()?.offense(run,id)??1),offense=1+(pv(run,'tempered_edge',id)+pv(run,'steady_aim',id)+pv(run,'fist_drive',id)+(hp(run,id)<maxHp(run,id)*.5?pv(run,'last_stand',id):0))/100,bonus=w?.bonus||0,imprint=mark?1+.15*(mark.boost||1):1;
    // Courage and arcane draughts: +30% physical / spell attack while they last.
    const courage=1+(buff(run,'courage',id)?.power||0)/100,arcane=1+(buff(run,'arcane',id)?.power||0)/100;
    // Free ability points: strength and intellect raise physical and spell attack, agility shortens the swing.
    const might=1+attr(run,id,'str')*ATTRIBUTE_STEP.str,wits=1+attr(run,id,'int')*ATTRIBUTE_STEP.int,quick=1-attr(run,id,'agi')*ATTRIBUTE_STEP.agi;
    return {damage:((d?.damage||3)+bonus*2)*growth*offense*imprint*(1+X().traitPower(w,'physicalPct'))*courage*might,spellDamage:((d?.magicDamage||d?.damage||3)+bonus*2)*growth*(1+pv(run,'spell_precision',id)/100)*imprint*(1+X().traitPower(w,'spellPct'))*arcane*wits,interval:Math.max(.35,((d?.interval||.9)-(w?.forge?.trait==='light'?w.forge.level*.08:0))*(1-(pv(run,'quick_hands',id)+pv(run,'nimble_shot',id))/100)*quick)/C().hasteMultiplier(run,id),reach:d?.reach||2.3,hands:d?.hands||0,armor:totalArmor,mitigation:Math.min(.45,totalArmor/(totalArmor+20)),magic:robes*.04,heal:robes*.05+(d?.support||0)+X().traitPower(w,'support')+attr(run,id,'int')*ATTRIBUTE_STEP.intHeal,support:(d?.support||0)+X().traitPower(w,'support'),weapon:w};
  }
  function wear(run,id,g){if(!g||g.durability<=0)return;const protect=buff(run,'fortify',id);if(protect?.power>0){protect.power--;return;}const imprint=G.imprintFor(run,id,g);if(imprint){imprint.left--;return;}if(roll(run,id,'wear')<pv(run,'care',id))return;if(GEAR[g.kind]?.baseKind==='robot_shell'&&roll(run,id,'robot-shell-wear')<pv(run,'shock_absorber',id))return;X().wear(run,g);}
  function durabilityWarnings(run,id){return equipmentSlots(run,id).map(slot=>equipment(run,id)?.[slot]).filter(g=>g&&g.durability/g.maxDurability<=.2).map(g=>({kind:g.kind,name:g.name,slot:g.slot,durability:g.durability,maxDurability:g.maxDurability,severity:g.durability/g.maxDurability<=.1?'critical':'warning',broken:g.durability===0}));}
  function damageReduction(run,id,amount,source){
    if(source==='hunger')return amount;let reduction=stats(run,id).mitigation;
    if(id===state(run).active&&run.effects.shield>0)reduction=1-(1-reduction)*.35;
    if(buff(run,'intercept',id))reduction=1-(1-reduction)*(1-pv(run,'guard_instinct',id)/100);
    if(buff(run,'guard',id))reduction=1-(1-reduction)*(1-buff(run,'guard',id).power/100);
    if(buff(run,'robot_guard',id))reduction=1-(1-reduction)*(1-buff(run,'robot_guard',id).power/100);
    if(source==='monster'&&amount>0)amount=Math.max(1,amount-Math.min(4,Object.values(equipment(run,id)).reduce((sum,g)=>sum+X().traitPower(g,'monsterFlat')+(g?.durability>0?GEAR[g.kind]?.monsterFlat||0:0),0)));
    if(source==='trap')amount=Math.max(0,amount-Object.values(equipment(run,id)).filter(g=>g?.durability>0&&g.forge?.trait==='grip').reduce((s,g)=>s+g.forge.level,0));
    if(source==='trap')reduction=1-(1-reduction)*(1-teamPassive(run,'trap_sense')/100)*(1-pv(run,'forest_cover',id)/100)*(run.party.buffs.some(b=>b.id==='trail')?.5:1);
    if(run.party.buffs.some(b=>b.id==='guard'))amount=Math.max(0,amount-2);
    let result=Math.max(amount>0?1:0,Math.ceil(amount*(1-Math.min(.65,reduction))));
    const shield=buff(run,'barrier',id);if(shield){const absorbed=Math.min(result,shield.power);result-=absorbed;shield.power-=absorbed;}
    return result;
  }
  function hurt(run,id,amount,source='monster',monsterId=null){
    const a=actor(run,id);if(!a||!num(amount,0,10000))return {ok:false,message:'無效的受傷目標。'};
    if(source==='hunger'&&job(run,id)==='robot')return {ok:true,message:'',effect:{damage:0,broken:[],source}};
    if(source!=='status'&&a.hurt>0||hp(run,id)<=0)return {ok:true,message:'',effect:{damage:0,broken:[],source}};
    if(source==='trap'&&buff(run,'escape',id))return {ok:true,effect:{damage:0,broken:[],source}};
    // Ailment potency already includes its matching resistance. Shield and
    // lethal-save rules still apply, but periodic damage does not re-wear gear
    // or create contact invulnerability that would protect against monsters.
    let incoming;if(source==='status'){incoming=Math.max(0,Math.round(amount));const shield=buff(run,'barrier',id);if(shield){const absorbed=Math.min(incoming,shield.power);incoming-=absorbed;shield.power-=absorbed;}}else incoming=damageReduction(run,id,amount,source);
    const damage=G.beforeDamage(run,id,incoming,source==='status'?'monster':source),before=Object.values(equipment(run,id)).filter(Boolean),broken=[];
    if(damage>0){if(source!=='status')a.hurt=2;setHp(run,id,hp(run,id)-damage);if(!['hunger','status'].includes(source))for(const slot of ['helmet','armor','shield']){const g=equipment(run,id)[slot];if(g?.durability>0){wear(run,id,g);if(!g.durability)broken.push(g);}}}
    if(damage>0&&source==='monster'&&monsterId&&hp(run,id)>0)F()?.enemyHit(run,id,P().monsterSpecs(run).find(m=>m.id===monsterId));
    let revived=false,switched=false;
    G.afterDamage(run,id,damage,source);
    if(hp(run,id)===0&&id===state(run).active){
      if(run.bag.feather>0&&job(run,id)!=='robot'){run.bag.feather--;setHp(run,id,Math.min(40,maxHp(run,id)));revived=true;}
      else {const next=ids(run).find(k=>k!==id&&hp(run,k)>0);if(next){switchRaw(run,next);switched=true;}else run.status='dead';}
    }
    return {ok:true,message:hp(run,id)===0?'隊友倒下了，靠近後可以救援。':'受到攻擊。',effect:{damage,broken,source,revived,switched,from:id,to:state(run).active,target:id===state(run).active?'player':'companion',defense:before.reduce((n,g)=>n+g.defense,0)}};
  }
  const organicHealable=(run,id)=>!!actor(run,id)&&job(run,id)!=='robot';
  function heal(run,id,amount,options={}){if(!actor(run,id)||!Number.isFinite(amount)||amount<=0||hp(run,id)<=0||!organicHealable(run,id)&&options.mechanical!==true)return 0;const before=hp(run,id);setHp(run,id,before+amount*(F()?.offense(run,id)??1));return hp(run,id)-before;}
  function finishMonster(run,spec,lootCell){if(run.defeatedMonsters.includes(spec.id))return [];run.defeatedMonsters.push(spec.id);delete run.party.health[spec.id];delete run.party.poise[spec.id];delete run.monsterStuns[spec.id];delete state(run).enemy[spec.id];if(F()?.state(run))delete F().state(run).enemies[spec.id];if(!spec.hunt)run.coins=Math.min(999999,run.coins+8+spec.strength*2);const Loot=typeof module==='object'&&module.exports?require('./tower-loot.js'):globalThis.TowerLoot,drops=spec.hunt?(spec.champion?Loot.huntSpoils(run,spec):[]):Loot.recordKill(run,spec,lootCell);gainXp(run,killXp(run,spec));return drops;}
  // Kill experience. Deeper surface floors pay more (x1 at 99F to x2.4 at 1F), so a hero who clears about 85% of
  // the tower reaches level 10 by the last floor; the underground keeps its own x5. Hunt rift foes give half.
  const SURFACE_XP_DEPTH=52,HUNT_XP=.5;
  function killXp(run,spec){const under=C().isUnderworld(run),lords=B(),base=5+spec.strength*2+(spec.elite?lords.MINI_XP[under?'underworld':'surface']:spec.lord&&!under?lords.LORD_XP:0),scaled=under?base*5:base*(1+(99-run.floor)/SURFACE_XP_DEPTH);return Math.round(scaled*(spec.hunt?HUNT_XP:1));}
  function gainXp(run,amount){if(!enabled(run)||!Number.isFinite(amount)||amount<0)return;if(amount===0){G.awaken(run);sync(run);return;}const s=state(run),heroLevel=s.level,beforeHero=hp(run,'hero'),heroMax=maxHp(run,'hero'),memberMax=Object.fromEntries(run.party.members.map(m=>[m.id,maxHp(run,m.id)])),gain=Math.floor(amount),under=C().isUnderworld(run);s.xp=Math.min(G.XP[maxLevel(run)-1],s.xp+gain);const next=Math.min(maxLevel(run),G.XP.filter(x=>s.xp>=x).length);s.level=Math.max(s.level,next);// A level up raises current life by exactly the maximum it adds, and refills MP.
    if(beforeHero>0)setHp(run,'hero',beforeHero+maxHp(run,'hero')-heroMax);for(const m of run.party.members){const old=m.level,before=hp(run,m.id);if(under){m.xp=Math.min(G.XP[9],experience(run,m.id)+gain);m.level=Math.max(old,Math.min(10,G.XP.filter(x=>m.xp>=x).length));}else{m.level=Math.max(old,Math.min(5,next));m.xp=G.XP[m.level-1];}if(before>0&&m.level!==old)setHp(run,m.id,before+maxHp(run,m.id)-memberMax[m.id]);if(m.level!==old)delete actor(run,m.id)?.mp;}if(s.level!==heroLevel)delete actor(run,'hero')?.mp;G.awaken(run);sync(run);}
  const ranged=(run,id=state(run)?.active)=>!!actor(run,id)&&['bow','staff','book'].includes(GEAR[stats(run,id).weapon?.kind]?.type);
  function fireProjectile(run,id,monsterId=null,revision=run.revision){return C().transaction(run,revision,n=>{
    const a=actor(n,id),st=a?stats(n,id):null,type=GEAR[st?.weapon?.kind]?.type;
    if(!a||hp(n,id)<=0||a.attack>0||a.shot||F()?.attackBlocked(n,id)||!['bow','staff','book'].includes(type)||monsterId!==null&&(!P().monsterSpecs(n).some(m=>m.id===monsterId)||n.defeatedMonsters.includes(monsterId)))return {ok:false,message:'遠程攻擊尚未就緒。'};
    if(type==='bow'&&n.bag.arrow<1)return {ok:false,message:'箭袋空了！撿取箭矢或向商人補貨。'};
    if(type==='bow')n.bag.arrow--;
    a.attack=st.interval;a.shot={kind:type==='bow'?'arrow':'orb',target:monsterId,left:2,damage:type==='bow'?st.damage:st.spellDamage,attunement:F()?.attunement(st.weapon)||null};wear(n,id,st.weapon);
    return {ok:true,effect:{arrow:type==='bow',orb:type!=='bow',actorId:id,targetId:monsterId}};
  });}
  function fireArrow(run,id,monsterId=null,revision=run.revision){if(!actor(run,id)||GEAR[stats(run,id).weapon?.kind]?.type!=='bow')return {ok:false,run,message:'請先裝備弓。'};return fireProjectile(run,id,monsterId,revision);}
  function strike(run,monsterId,options={},revision){return C().transaction(run,revision,n=>{
    const id=options.memberId||state(n)?.active,a=actor(n,id),spec=P().monsterSpecs(n).find(m=>m.id===monsterId);
    if(!a||hp(n,id)<=0||!spec||n.defeatedMonsters.includes(monsterId))return {ok:false,message:'前方沒有可攻擊的怪物。'};
    // A shot already left the bow (and spent its arrow) when the shooter could act;
    // a shock that lands during its flight must not cancel the hit.
    // Likewise an attack skill was checked and paid for when it was cast (its pending
    // record below); a shock or an empty battery during the flight cannot cancel it.
    const paid=!!options.skillId&&a.pending?.id===options.skillId&&a.pending.left>0;
    if(!options.shot&&!paid&&F()?.attackBlocked(n,id))return {ok:false,message:'還在電麻中，稍後再出手。'};
    if(job(n,id)==='robot'&&!paid&&!ROBOT.powered(n,id))return {ok:false,message:'能源耗盡，先使用動力石補能。'};
    const skill=options.skillId?SKILLS[options.skillId]:null;
    if(options.skillId&&!skill)return {ok:false,message:'不存在的技能。'};
    if(skill&&(!a.skills.includes(skill.id)||!skill.attack))return {ok:false,message:'沒有這個攻擊技能。'};
    if(skill&&(!a.pending||a.pending.id!==skill.id||a.pending.left<=0||a.pending.targets.includes(monsterId)))return {ok:false,message:'請先施放技能，同一次施放不能重複命中。'};
    if(skill?.params?.maxTargets&&a.pending.targets.length>=skill.params.maxTargets)return {ok:false,message:'這次施放已達命中上限。'};
    if(options.shot&&(!a.shot||a.shot.target!==null&&a.shot.target!==monsterId||a.shot.left<=0))return {ok:false,message:'這次遠程攻擊已經失效。'};
    if(!skill&&!options.shot&&ranged(n,id))return {ok:false,message:'請先發射，再由光彈或箭矢命中。'};
    if(!skill&&!options.shot&&a.attack>0)return {ok:false,message:'正在收招。'};
    const st=stats(n,id),imprint=skill?a.pending.attunement===undefined?F()?.attunement(st.weapon):a.pending.attunement:options.shot?a.shot.attunement===undefined?F()?.attunement(st.weapon):a.shot.attunement:F()?.attunement(st.weapon),l=G.skillLevel(n,id),status=state(n).enemy[monsterId]||{},boost=(buff(n,'rally',id)?.power||0)+(buff(n,'polish',id)?.power||0)+(buff(n,'oath_power',id)?.power||0);
    let damage=((skill?a.pending.damage:options.shot?a.shot.damage:st.damage)+(n.party.buffs.some(b=>b.id==='focus')?3:0))*(skill?G.power(n,id,skill)/100:1+pv(n,'might',id)/100)*(1+boost/100)*(1+(status.mark>0?.1:0));
    if(!skill&&!options.shot&&a.robot?.calibrationReady&&a.robot.calibrationLeft<=0){damage*=1+pv(n,'power_calibration',id)/100;a.robot.calibrationReady=false;a.robot.stationary=0;a.robot.calibrationLeft=6;}
    let kinetic=false;if(!skill&&!options.shot&&a.robot?.energyLeft>0&&a.passives.includes('kinetic_core')){const m=G.modifiers(n,id,'kinetic_core');damage+=st.damage*.6*m.power;G.shield(n,id,maxHp(n,id)*.2*m.power);a.robot.energyLeft=0;kinetic=true;}
    if(skill&&['mage','healer'].includes(job(n,id))||options.shot&&a.shot.kind==='orb')damage*=1+st.magic;
    if(spec.kind==='crab'&&options.front===true)damage*=.55;
    if(skill?.effect==='blind'&&options.front===false)damage*=1.25;
    damage*=G.strikeMultiplier(n,id,monsterId,skill,options.front);
    // Luck: the critical roll comes from this exact attack, so reloading or replaying it never rerolls.
    const crit=mix(hash(n.seed,id+':crit:'+monsterId+':'+n.revision+':'+(skill?skill.id:options.shot?'shot':'swing')))%100<critChance(n,id);if(crit)damage*=CRIT_MULTIPLIER;
    damage=Events()?.limitLordDamage?.(n,monsterId,Math.max(1,Math.round(damage)),spec.maxHp)??Math.max(1,Math.round(damage));if(!options.shot)a.attack=st.interval;a.buffs=a.buffs.filter(b=>b.id!=='stealth');
    const w=st.weapon;if(w&&!options.shot&&(!skill||!a.pending.worn)){if(!skill&&job(n,id)==='robot'){a.robot.fistHits=(a.robot.fistHits+1)%4;if(a.robot.fistHits===0)wear(n,id,w);}else wear(n,id,w);}if(skill){a.pending.worn=true;a.pending.targets.push(monsterId);}if(options.shot)a.shot=null;
    const remaining=Math.max(0,(n.party.health[monsterId]??spec.maxHp)-damage);n.party.health[monsterId]=remaining;
    let stunned=false;const effect=skill?.effect;
    if(['stun','shock','stagger'].includes(effect)&&!n.party.poise[monsterId]){
      n.monsterStuns[monsterId]=skill.params?.stunSeconds??Math.min(2.4,1+l*.25);n.party.poise[monsterId]=Math.min(5,n.monsterStuns[monsterId]+3);stunned=true;
    }
    const enemy=state(n).enemy[monsterId]||(state(n).enemy[monsterId]={}),duration=(2+l*.4)*(1+pv(n,'resonance',id)/100);
    if(['slow','splash','binding','great_arrow'].includes(effect)||skill?.params?.slowSeconds){enemy.slow=skill?.params?.slowSeconds??duration;enemy.slowPower=skill?.params?.slowPower??(.2+l*.04);}
    if(effect==='thorns'||skill?.params?.rootSeconds)enemy.root=skill?.params?.rootSeconds??3;
    if(effect==='blind')enemy.blind=duration;if(effect==='weak')enemy.weak=.15+l*.04;if(effect==='mark')enemy.mark=skill.params?.markSeconds??6;
    let drops=[];if(remaining===0)drops=finishMonster(n,spec,options.lootCell);else if(damage>0)F()?.weaponHit(n,id,spec,imprint||null);
    const spoils=drops.filter(d=>d.direct).map(d=>d.label);
    return {ok:true,message:remaining===0?'擊敗 '+spec.def.name+(spoils.length?'，獲得 '+spoils.join('、'):''):'命中 '+spec.def.name,effect:{target:'monster',targetId:monsterId,damage,hp:remaining,dead:remaining===0,drops,lord:!!spec.lord,stunned,rooted:enemy.root>0&&remaining>0,repel:!spec.lord&&(effect==='repel'||skill?.params?.knockback>0),knockback:!spec.lord?skill?.params?.knockback||0:0,kinetic,crit,broken:w?.durability===0?w:null}};
  });}
  function cast(run,skillId,options={},revision){return C().transaction(run,revision,n=>{
    const id=options.actorId||state(n)?.active,a=actor(n,id),s=SKILLS[skillId];
    if(!a||hp(n,id)<=0||!s||!a.skills.includes(skillId))return {ok:false,message:'這位人物沒有這個技能。'};
    if(F()?.attackBlocked(n,id))return {ok:false,message:'電麻中，稍後再施放。'};
    if(job(n,id)==='robot'&&!ROBOT.powered(n,id))return {ok:false,message:'能源耗盡，先使用動力石補能。'};
    if(s.attack&&a.attack>0)return {ok:false,message:'正在收招，稍等一下。'};
    if(a.cooldowns[skillId]>0)return {ok:false,message:'技能還在準備中。'};
    if(!mpReady(n,id,skillId))return {ok:false,message:'MP 不足：需要 '+s.mp+' 點，目前 '+Math.floor(mp(n,id))+' 點。'};
    const l=G.skillLevel(n,id),power=G.power(n,id,s),near=(options.nearby||ids(n)).filter(k=>ids(n).includes(k)),target=options.targetId||id;
    if(!near.includes(target))return {ok:false,message:'隊友太遠，請先靠近。'};
    if(s.attack&&!stats(n,id).weapon)return {ok:false,message:'武器已損壞，先換上專用武器。'};
    if(s.ammo&&n.bag.arrow<s.ammo)return {ok:false,message:'需要 '+s.ammo+' 支箭矢，先補滿箭袋吧。'};
    if(Object.entries(s.cost).some(([k,v])=>n.party.ingredients[k]<v))return {ok:false,message:'材料不足：'+Object.entries(s.cost).map(([k,v])=>P().INGREDIENTS[k]+' '+v).join('、')};
    const effect={skill:skillId,kind:s.effect,actorId:id,targetId:target,power,level:l,attack:s.attack};
    if(['heal','barrier','ward','fortify','polish','repair','mech_aid'].includes(s.effect)&&hp(n,target)<=0)return {ok:false,message:'這位隊友需要先被扶起。'};
    if(['heal','revive'].includes(s.effect)&&!organicHealable(n,target))return {ok:false,message:'機器人不能接受一般治療，請使用動力核心或零件回補。'};
    if(s.effect==='meal'&&!organicHealable(n,id))return {ok:false,message:'機器人不需要食物。'};
    if(s.effect==='meal'&&n.hunger>=100)return {ok:false,message:'大家還很飽，先留著食材。'};
    if(s.effect==='heal'&&hp(n,target)>=maxHp(n,target))return {ok:false,message:'生命已滿，不需要消耗香草。'};
    if(s.effect==='revive'&&hp(n,target)>0)return {ok:false,message:'這位隊友沒有倒下。'};
    if(s.effect==='daylight'&&n.party.light.cooldown>0)return {ok:false,message:'日光術仍在持續。'};
    let repairGear=null;if(s.effect==='repair'){repairGear=Object.values(equipment(n,target)).filter(g=>g&&!ROBOT.isCore(g)&&g.durability>0&&g.durability<g.maxDurability).sort((a,b)=>a.durability/a.maxDurability-b.durability/b.maxDurability)[0];if(!repairGear)return {ok:false,message:'沒有可應急修補的裝備；完全損壞需到營地工坊修復，動力核心只能重新製作。'};}
    if(s.effect==='polish'&&!stats(n,target).weapon)return {ok:false,message:'請先裝備武器。'};
    if(s.effect==='soup'&&!near.some(k=>organicHealable(n,k)&&hp(n,k)>0&&hp(n,k)<maxHp(n,k)))return {ok:false,message:'附近沒有需要治療的隊友。'};
    if(s.effect==='sanctuary'&&!near.some(k=>organicHealable(n,k)&&hp(n,k)<maxHp(n,k)))return {ok:false,message:'附近沒有需要治療的隊友。'};
    if(s.effect==='fortress'&&n.party.journey.scrap<2)return {ok:false,message:'還需要兩份零件。'};
    if(s.scrapCost&&n.party.journey.scrap<s.scrapCost)return {ok:false,message:'需要 '+s.scrapCost+' 份金屬零件。'};
    if(s.effect==='robot_restore'&&hp(n,id)>=maxHp(n,id))return {ok:false,message:'機體生命已滿，不需要消耗零件。'};
    if(s.effect==='feast'&&Object.values(n.party.ingredients).filter(v=>v>0).length<3)return {ok:false,message:'需要三種不同食材各一份。'};
    G.consumeCost(n,id,s.cost);
    if(s.mp){const left=mp(n,id)-s.mp;a.mp=left;}
    if(s.scrapCost)n.party.journey.scrap-=s.scrapCost;
    if(s.ammo)n.bag.arrow-=s.ammo;
    a.cooldowns[skillId]=s.effect==='daylight'?600:(s.effect==='cleanse'?power:s.cooldown)*(1-pv(n,'recovery',id)/100)*G.modifiers(n,id,s.id).cooldown;
    if(s.attack){const st=stats(n,id),paid=['mage','healer','archer'].includes(job(n,id));a.pending={id:skillId,left:3,damage:['mage','healer'].includes(job(n,id))?st.spellDamage:st.damage,targets:[],worn:paid,attunement:F()?.attunement(st.weapon)||null};a.attack=st.interval;if(paid)wear(n,id,st.weapon);}
    const healing=(1+pv(n,'herbalism',id)/100+stats(n,id).heal)*(id==='hero'?1+.02*(level(n,id)-1):1);
    const support=1+stats(n,id).support;
    if(s.effect==='guard')setBuff(n,id,'guard',s.params?.duration??8,power*support);
    if(s.effect==='robot_guard')setBuff(n,id,'robot_guard',6,power);
    if(s.effect==='robot_speed')setBuff(n,id,'robot_speed',8,power);
    if(s.effect==='robot_restore')heal(n,id,power,{mechanical:true});
    if(s.effect==='mech_aid'){G.shield(n,id,maxHp(n,id)*.35*G.modifiers(n,id,s.id).power,id);if(target!==id)G.shield(n,target,maxHp(n,target)*.2*G.modifiers(n,id,s.id).power,id);}
    if(s.effect==='barrier')G.shield(n,target,power*support*(id==='hero'?1+.02*(level(n,id)-1):1),id);
    if(s.effect==='ward')setBuff(n,target,'ward',power*support,1);
    if(s.effect==='rally')near.filter(k=>hp(n,k)>0).forEach(k=>setBuff(n,k,'rally',s.params?.duration??10,power));
    if(s.effect==='speed')near.filter(k=>hp(n,k)>0).forEach(k=>setBuff(n,k,'speed',s.params?.duration??20,power));
    if(s.effect==='polish')setBuff(n,target,'polish',s.params?.duration??20,power);
    if(s.effect==='fortify')setBuff(n,target,'fortify',s.params?.duration??30,power);
    if(['stealth','smoke'].includes(s.effect))setBuff(n,id,s.effect,power,power);
    if(s.effect==='stomach')setBuff(n,id,'stomach',30,power);
    if(s.effect==='meal'){n.hunger=Math.min(100,n.hunger+power*(1+teamPassive(n,'gourmet')/100));food(n,id);}
    if(s.effect==='heal')heal(n,target,power*healing+pv(n,'gentle_care',id));
    if(s.effect==='soup')near.filter(k=>hp(n,k)>0).forEach(k=>heal(n,k,power*healing+pv(n,'gentle_care',id)));
    if(s.effect==='revive')setHp(n,target,Math.ceil(maxHp(n,target)*power/100));
    if(s.effect==='repair')repairGear.durability=Math.min(repairGear.maxDurability,repairGear.durability+(s.id==='repair'?X().emergencyRepairAmount(repairGear,8+2*(l-1)):Math.round(power)));
    if(s.effect==='reveal')setBuff(n,id,'path_eye',8,power);
    if(s.effect==='cleanse'){actor(n,target).buffs=actor(n,target).buffs.filter(b=>b.id!=='slow');F()?.clear(n,target);setBuff(n,target,'ward',3,1);if(target===state(n).active)n.party.slowLeft=0;}
    if(s.effect==='daylight'){n.party.light.daylight=600;n.party.light.cooldown=600;setBuff(n,id,'daylight',600,power);}
    G.afterCast(n,id,s,near);
    sync(n);return {ok:true,message:s.name,effect};
  });}
  function food(run,id=state(run)?.active){const power=pv(run,'nourishment',id);if(power)setBuff(run,id,'regen',10,power/10);}
  function speed(run,id=state(run)?.active){const light=Object.values(equipment(run,id)||{}).filter(g=>g&&g.durability>0&&g.slot!=='weapon'&&g.forge?.trait==='light').reduce((sum,g)=>sum+g.forge.level,0);return (job(run,id)==='robot'?.9*(ROBOT.powered(run,id)?1:ROBOT.EMPTY_SPEED):1)*(buff(run,'robot_guard',id)?.5:1)*(1+(pv(run,'fleet',id)+pv(run,'leaf_steps',id))/100+(buff(run,'speed',id)?.power||0)/100+(buff(run,'robot_speed',id)?.power||0)/100+(buff(run,'escape',id)?.power||0)/100)*(buff(run,'slow',id)?.power||1)*(1+Math.min(2,light)*.03)*C().hasteMultiplier(run,id)*(F()?.movement(run,id)??1);}
  function inflict(run,id,key,seconds,power){const ward=buff(run,'ward',id);if(ward?.power>0){ward.power=0;ward.left=0;return false;}setBuff(run,id,key,seconds*(1-(pv(run,'purity',id)+(key==='slow'?pv(run,'stable_feet',id):0))/100),power);return true;}
  function noteMovement(run,id,moving,dt){const a=actor(run,id);if(!a?.robot||!Number.isFinite(dt)||dt<0||dt>.5)return;if(moving||hp(run,id)<=0){a.robot.stationary=0;a.robot.calibrationReady=false;}else if(pv(run,'power_calibration',id)&&a.robot.calibrationLeft<=0){a.robot.stationary=Math.min(1,a.robot.stationary+dt);if(a.robot.stationary>=1)a.robot.calibrationReady=true;}}
  function hungerScale(run){if(ids(run).every(id=>job(run,id)==='robot'||hp(run,id)<=0))return 0;return Math.max(.4,(1-teamPassive(run,'endurance')/100)*(1-Math.max(0,...ids(run).filter(id=>hp(run,id)>0).map(id=>buff(run,'stomach',id)?.power||0))/100));}
  function toolSpent(run){if(!enabled(run))return;run.engine.shovels=Math.max(0,run.engine.shovels-1);for(const id of ids(run)){const cd=pv(run,'tool_supply',id);if(cd)actor(run,id).tool=cd;}}
  function rescueChoice(run,id,nearby=ids(run)){const a=actor(run,id);if(!a?.autoRescue||!pv(run,'rescue',id)||a.autoLeft>0||hp(run,id)<=0)return null;for(const skill of ['revive','herbal_heal']){if(!a.skills.includes(skill)||a.cooldowns[skill]>0||!mpReady(run,id,skill)||Object.entries(SKILLS[skill].cost).some(([k,v])=>run.party.ingredients[k]<v))continue;const target=nearby.find(k=>ids(run).includes(k)&&organicHealable(run,k)&&(skill==='revive'?hp(run,k)===0:hp(run,k)>0&&hp(run,k)<maxHp(run,k)*.5));if(target)return {skill,target};}return null;}
  function tick(run,dt,options={}){if(!enabled(run)||!Number.isFinite(dt)||dt<0||dt>ROBOT.FUEL_SECONDS)return;G.tick(run,dt);const s=state(run);s.switchLeft=Math.max(0,s.switchLeft-dt);
    for(const id of ids(run)){const a=actor(run,id);if(a.robot){ROBOT.tick(run,id,dt,options);for(const key of ['calibrationLeft','energyLeft','energyCooldown'])a.robot[key]=Math.max(0,a.robot[key]-dt);if(hp(run,id)<=0){a.robot.stationary=0;a.robot.calibrationReady=false;a.robot.energyLeft=0;}}if(a.pending){a.pending.left-=dt;if(a.pending.left<=0)a.pending=null;}if(a.shot){a.shot.left-=dt;if(a.shot.left<=0)a.shot=null;}for(const key of ['attack','hurt','tool','autoLeft'])a[key]=Math.max(0,a[key]-dt);for(const key of a.skills)a.cooldowns[key]=Math.max(0,a.cooldowns[key]-dt);if(a.mp!==undefined&&hp(run,id)>0)restoreMp(run,id,mpRegen(run,id)*dt);for(const b of a.buffs){if(b.id==='regen'&&hp(run,id)>0)heal(run,id,Math.min(dt,b.left)*b.power);b.left=Math.max(0,b.left-dt);}a.buffs=a.buffs.filter(b=>b.left>0);
      if(pv(run,'tool_supply',id)&&hp(run,id)>0&&a.tool===0&&run.engine.shovels<1){run.engine.shovels=1;a.tool=pv(run,'tool_supply',id);}
    }
    for(const e of Object.values(s.enemy))for(const key of ['slow','root','blind','mark','tauntLeft','relay','relayCooldown','relayWeak'])if(e[key])e[key]=Math.max(0,e[key]-dt);F()?.tick(run,dt);pruneTaunts(run);sync(run);
  }
  function advance(run,{reward=true}={}){if(!enabled(run))return;state(run).enemy={};if(F()?.state(run))F().state(run).enemies={};state(run).removedTraps=[];for(const a of Object.values(state(run).actors)){a.shot=null;a.pending=null;if(a.robot){a.robot.stationary=0;a.robot.calibrationReady=false;a.robot.energyLeft=0;}}G.state(run).route=null;G.state(run).nearby={};if(reward)gainXp(run,C().isUnderworld(run)?360:8);}
  const BUFFS=['guard','barrier','ward','rally','speed','polish','fortify','stealth','smoke','stomach','regen','daylight','slow','intercept','path_eye','oath_power','fortress','sanctuary','escape','haste','robot_guard','robot_speed','meal_burn','meal_poison','meal_shock','arcane','courage'];
  function validTalents(a,profession,actorLevel,progress,id,floor){
    if(!a||!Array.isArray(a.skills)||a.skills.length<3||a.skills.length>(id==='hero'?8:7)||new Set(a.skills).size!==a.skills.length||!a.skills.every(s=>own(SKILLS,s)&&SKILLS[s].job===profession)||!a.skills.some(s=>SKILLS[s].attack)||profession!=='mage'&&!a.skills.some(s=>!SKILLS[s].attack))return false;
    if(profession==='healer'&&!a.skills.some(s=>['herbal_heal','revive'].includes(s)))return false;
    if(!Array.isArray(a.passives)||a.passives.length<2||a.passives.length>(id==='hero'?7:6)||new Set(a.passives).size!==a.passives.length||!a.passives.every(s=>own(PASSIVES,s)&&PASSIVES[s].job===profession))return false;
    const learned=a.learned??null;
    if(id==='hero'){if(learned!==null)return false;}else{const s=SKILLS[learned]||PASSIVES[learned];if(learned&&(!s||s.unique||s.job!==profession||![...a.skills,...a.passives].includes(learned)||actorLevel<4))return false;if(learned!==(progress.choices[0]??null))return false;}
    const all=[...a.skills,...a.passives],continuation=floor<0?G.branches(progress.awakening,actorLevel,id):[],bonus=[...progress.choices,...(progress.awakening?[progress.awakening]:[]),...continuation],steps=id!=='hero'&&floor>0?[4]:[4,6,8];
    return !(all.length!==5+bonus.length||progress.choices.length>steps.filter(l=>actorLevel>=l).length||!progress.choices.every(k=>all.includes(k)&&(SKILLS[k]||PASSIVES[k])?.job===profession&&!(SKILLS[k]||PASSIVES[k]).unique)||progress.awakening&&(!all.includes(progress.awakening)||![...G.actives,...G.passives.filter(s=>s.unique)].some(s=>s.id===progress.awakening&&s.job===profession)||actorLevel<10||id!=='hero'&&floor>0)||!continuation.every(k=>all.includes(k))||all.filter(k=>(SKILLS[k]||PASSIVES[k]).unique).some(k=>!bonus.includes(k))||new Set(bonus).size!==bonus.length);
  }
  const equipmentSlots=(run,id=state(run)?.active)=>job(run,id)==='robot'?[...SLOTS,...ROBOT.CORE_SLOTS]:[...SLOTS];
  function validateActorEquipment(source,profession,actorLevel,floor){
    const e=profession==='robot'?ROBOT.normalizeEquipment(source):source,slots=profession==='robot'?[...SLOTS,...ROBOT.CORE_SLOTS]:SLOTS;
    if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).length!==slots.length||!slots.every(k=>Object.hasOwn(e,k)))return null;
    const result={},seen=new Set();for(const slot of slots){const g=e[slot];if(g===null){result[slot]=null;continue;}const item=C().validateGear(g),d=GEAR[item?.kind];if(!item||item.slot!==(ROBOT.CORE_SLOTS.includes(slot)?'core':slot)||!d?.jobs.includes(profession)||d.requiredLevel>actorLevel||d.tier>3&&floor>0||seen.has(item.id))return null;seen.add(item.id);result[slot]=item;}
    if(GEAR[result.weapon?.kind]?.hands===2&&result.shield)return null;
    if(profession==='robot'&&(result.helmet!==null||result.shield!==null||!ROBOT.isPart(result.armor)||!ROBOT.isPart(result.weapon)||ROBOT.CORE_SLOTS.some(slot=>result[slot]&&!ROBOT.isCore(result[slot]))))return null;
    return result;
  }
  function validate(value,party){
    const bodyBonus=party.profession==='robot'&&value?.actors?.hero?.passives?.includes('robot_body')?5*(value.level>=10?6:Math.min(5,value.level)):0;
    if(!value||value.version!==1||!(value.xpScale===undefined||value.xpScale===10||value.xpScale===G.XP_SCALE)||!num(value.level,1,party.floor<0?15:10,true)||!num(value.xp,0,100000,true)||!num(value.heroHp,0,P().vitalHp(party.profession,value.level,true,value.actors?.hero?.attrs?.vit)+bodyBonus)||!num(value.switchLeft,0,1))return null;
    // Replace the retired random skill without deleting a save, changing order,
    // refunding resources or retaining its old ten-minute skill cooldown.
    value=clone(value);
    for(const a of Object.values(value.actors||{}))if(Array.isArray(a?.skills)&&a.skills.includes('daylight')){
      if(a.skills.includes('thorn_growth'))return null;
      a.skills=a.skills.map(k=>k==='daylight'?'thorn_growth':k);
      a.cooldowns={...a.cooldowns,thorn_growth:0};delete a.cooldowns.daylight;
      if(a.learned==='daylight')a.learned='thorn_growth';
    }
    if(value.growth?.choices!==undefined){if(!Array.isArray(value.growth.choices))return null;value.growth.choices=value.growth.choices.map(k=>k==='daylight'?'thorn_growth':k);}
    const legacyGrowth=value.growth?.version!==2,growth=G.validate(value.growth,party);if(!growth)return null;
    const expected=['hero',...party.members.map(m=>m.id)];if(expected.length>5||!expected.includes(value.active)||!value.actors||Array.isArray(value.actors)||Object.keys(value.actors).length!==expected.length)return null;
    const actors={};for(const id of expected){
      const a=value.actors[id],profession=id==='hero'?party.profession:party.members.find(m=>m.id===id).profession;
      if(a&&a.showHelmet!==undefined&&typeof a.showHelmet!=='boolean')return null;
      const learned=a?.learned??null;
      const progress=id==='hero'?growth:growth.members[id],actorLevel=id==='hero'?value.level:party.members.find(m=>m.id===id).level;
      if(id!=='hero'&&legacyGrowth&&learned)progress.choices=[learned];
      if(!validTalents(a,profession,actorLevel,progress,id,party.floor))return null;
      if(!a.cooldowns||Object.keys(a.cooldowns).length!==a.skills.length||!a.skills.every(s=>own(a.cooldowns,s)&&num(a.cooldowns[s],0,600)))return null;
      // Saves from before ability scores have none spent; automatic companions spend theirs at the next sync,
      // where the higher ceilings also lift current life exactly as a level up does.
      const spent=a.attrs===undefined?{...NO_ATTRIBUTES}:validAttrs(a.attrs,profession,actorLevel);if(!spent||a.attrAuto!==undefined&&typeof a.attrAuto!=='boolean')return null;
      const attrAuto=a.attrAuto??id!=='hero';
      if(a.mp!==undefined&&(profession==='robot'||!num(a.mp,0,mpMax(profession,actorLevel,spent.int))))return null;
      if(!num(a.attack,0,5)||!num(a.hurt,0,2)||!num(a.tool,0,90)||!num(a.autoLeft,0,180)||!num(a.roll,0,Number.MAX_SAFE_INTEGER-1,true)||typeof a.autoRescue!=='boolean')return null;
      if(!Array.isArray(a.buffs)||a.buffs.length>BUFFS.length||new Set(a.buffs.map(b=>b.id)).size!==a.buffs.length||!a.buffs.every(b=>BUFFS.includes(b.id)&&num(b.left,0,600)&&num(b.power,0,200)))return null;
      if(a.buffs.some(b=>b.id==='haste'&&(b.left>C().HASTE_DURATION||![C().HASTE_PERCENT,C().HASTE_STRONG_PERCENT].includes(b.power))))return null;
      if(a.buffs.some(b=>['arcane','courage'].includes(b.id)&&(b.left>C().POTION_BUFF_SECONDS||b.power!==C().POTION_BUFF_PERCENT)))return null;
      if(a.buffs.some(b=>b.id==='robot_guard'&&(profession!=='robot'||b.left>6||b.power>50)||b.id==='robot_speed'&&(profession!=='robot'||b.left>8||b.power>27)))return null;
      const robot=profession==='robot'?ROBOT.validateState(a.robot):null;if(profession==='robot'&&!robot||profession!=='robot'&&a.robot!==undefined)return null;
      let gear=null;if(id!==value.active){gear=validateActorEquipment(a.equipment,profession,actorLevel,party.floor);if(!gear)return null;}else if(a.equipment!==null)return null;
      if(profession==='robot'&&gear&&(gear.helmet!==null||gear.shield!==null||!ROBOT.isPart(gear.armor)||!ROBOT.isPart(gear.weapon)))return null;
      const p=a.pending;if(p&&(!a.skills.includes(p.id)||!SKILLS[p.id].attack||!num(p.left,0,3)||!num(p.damage,0,DAMAGE_RECORD_LIMIT)||typeof p.worn!=='boolean'||!F()?.validAttunement(p.attunement)||!Array.isArray(p.targets)||p.targets.length>(SKILLS[p.id].params?.maxTargets||C().MAX_MONSTERS)||new Set(p.targets).size!==p.targets.length||!p.targets.every(id=>C().validMonsterId(id,party.floor))))return null;
      const shot=a.shot?{...a.shot,kind:a.shot.kind??'arrow'}:null;if(shot&&(!(shot.target===null||C().validMonsterId(shot.target,party.floor))||!num(shot.left,0,2)||!num(shot.damage,0,DAMAGE_RECORD_LIMIT)||!F()?.validAttunement(shot.attunement)||!['arrow','orb'].includes(shot.kind)||(shot.kind==='arrow'?profession!=='archer':!['mage','healer'].includes(profession))))return null;
      actors[id]={skills:[...a.skills],passives:[...a.passives],learned,showHelmet:a.showHelmet!==false,equipment:gear,cooldowns:{...a.cooldowns},buffs:a.buffs.map(b=>({id:b.id,left:b.left,power:b.power})),attack:a.attack,hurt:a.hurt,tool:a.tool,autoLeft:a.autoLeft,autoRescue:a.autoRescue,roll:a.roll,attrs:spent,attrAuto,pending:p?clone(p):null,shot:shot?clone(shot):null,...(a.mp!==undefined?{mp:a.mp}:{}),...(robot?{robot}:{})};
    }
    if(!value.enemy||Array.isArray(value.enemy)||Object.keys(value.enemy).length>C().MAX_MONSTERS)return null;
    const enemy={};for(const[k,e]of Object.entries(value.enemy)){if(!C().validMonsterId(k,party.floor)||!e||Object.keys(e).some(key=>!['slow','slowPower','root','blind','weak','mark','tauntLeft','tauntId','relay','relayCooldown','relayWeak','relayOwner'].includes(key))||Object.entries(e).some(([key,v])=>['tauntId','relayOwner'].includes(key)?!expected.includes(v):!num(v,0,key==='root'?3:60)))return null;enemy[k]={...e};}
    if(!Array.isArray(value.removedTraps)||value.removedTraps.length>30||!value.removedTraps.every(s=>typeof s==='string'&&s.length<100))return null;
    // Migrate existing progress once; preserve levels/skills and fractional progress.
    const xp=Math.min(100000,value.xp*(value.xpScale===undefined?10:1));
    const afflictions=F()?.validate(value.afflictions,{actors:expected,floor:party.floor});if(afflictions===null)return null;
    return {removedTraps:[...value.removedTraps],version:1,xpScale:G.XP_SCALE,active:value.active,level:value.level,xp,heroHp:value.heroHp,switchLeft:value.switchLeft,actors,enemy,growth,...(afflictions?{afflictions}:{})};
  }
  function validEquipment(run){if(!enabled(run))return true;const seen=new Set();for(const g of allGear(run)){if(seen.has(g.id)||(GEAR[g.kind]?.tier>3||X().TRAITS[g.forge?.trait]?.underground)&&!C().isUnderworld(run))return false;seen.add(g.id);}if(run.gearBag.some(ROBOT.isPart)||Object.values(G.state(run).imprints).some(mark=>ROBOT.isCore(allGear(run).find(g=>g.id===mark.gearId))))return false;return ids(run).every(id=>!!validateActorEquipment(equipment(run,id),job(run,id),level(run,id),run.floor));}
  return Object.freeze({ATTRIBUTES,ATTRIBUTE_NAMES,FREE_POINTS_PER_LEVEL,AUTO_POINTS_PER_LEVEL,ATTRIBUTE_STEP,ATTRIBUTE_BASE,ATTRIBUTE_GROWTH,ATTRIBUTE_PLAN,CRIT_BASE,CRIT_DEFAULT,CRIT_MULTIPLIER,DAMAGE_RECORD_LIMIT,attrs,attr,freePoints,unspentPoints,attributeAllowed,critChance,autoSpend,validAttrs,settleAttributes,allocate,setAttributeAuto,forgetAttributes,attributeSheet,COOLDOWN_SCALE,SPIRIT,mpMax,maxMp,mp,mpRegen,mpReady,restoreMp,xpProgress,hpCeiling,upgradeFor,upgradeGain,finishMonster,killXp,SURFACE_XP_DEPTH,HUNT_XP,switchRaw,ROBOT,robotUpgradeQuote:ROBOT.upgradeQuote,upgradeRobot:ROBOT.upgrade,JOBS,GEAR,BASE_GEAR,TIER_NAMES,tierKind,gearPool,SKILLS,PASSIVES,SLOTS,PREPARATION,PREPARATION_REDUCTION,preparationSeconds,scale:readScale,state,enabled,ids,job,sex,level,maxLevel,experience,actor,maxHp,hp,equipment,equipmentSlots,validateActorEquipment,pv,teamPassive,buff,tauntTargetLimit,applyTaunt,setBuff,draft,reorderSkills,showHeadgear,preview,enable,addMember,recruitSnapshot,restoreMember,validateRecruitSnapshot,removeMember,sync,setHp,returnToHero,switchActor,followerRecords,canLearn,learnCompanion,allGear,canEquip,equip,unequip,stats,wear,durabilityWarnings,hurt,heal,organicHealable,gainXp,ranged,fireProjectile,fireArrow,strike,cast,food,speed,inflict,noteMovement,hungerScale,toolSpent,rescueChoice,tick,advance,validate,validEquipment,roll});
});
