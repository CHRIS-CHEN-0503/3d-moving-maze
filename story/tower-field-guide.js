/* Read-only, concise expedition advice. No render loop, save migration or RNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerFieldGuide=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const moduleFor=(file,name)=>typeof module==='object'&&module.exports?require('./'+file+'.js'):globalThis[name];
  const own=(object,key)=>!!object&&typeof key==='string'&&Object.hasOwn(object,key);
  const C=()=>moduleFor('story-core','TowerCore'),H=()=>moduleFor('tower-heroes-core','TowerHeroes'),P=()=>moduleFor('tower-party-core','TowerPartyCore');
  const S=()=>moduleFor('tower-monster-sense','TowerMonsterSense'),G=()=>moduleFor('tower-hero-growth','TowerHeroGrowth');
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const LORE=freeze({
    mushroom:'躲在陰暗石縫裡的小菇。不是每個靠近的人都讓牠放心。',
    crab:'把石屑黏在殼上當盔甲，最在乎自己的那一小塊地盤。',
    moth:'會把受驚的振翅聲傳給附近同類，是迷宮裡的小小警報員。',
    flower:'花根扎在地板裡；看似安靜的花嘴，其實正等人走進射程。',
    clockmite:'高塔留下的發條小工，仍沿著早就改變的通道巡查。',
    sentinel:'一板一眼地守住路口，似乎還在等待很久以前的交班人。',
    shardseer:'身上的晶簇能聚成光彈，也讓每次蓄力都很容易被看見。',
    wisp:'像在尋找失散旅人的燈火，靠近時卻會灼傷碰到它的人。',
    hound:'把腳步聲當成追逐邀請，轉過一道牆還不能讓牠死心。',
  });
  function monster(def){
    if(typeof def==='string'){const defs=P()?.defs();def=own(defs,def)?defs[def]:null;}
    if(!def||typeof def.id!=='string')return null;
    const sense=S()?.profile(def)||{range:def.sight||8,hearing:false,personality:def.personality||'警戒旅人'};
    const tactics=S()?.tactics(def)||{role:def.ranged?'遠程攻擊':'近身攻擊',threat:def.description||'',tell:'出手前留意腳下警示。',counter:'留好退路，避免貼身碰撞。'};
    return {...tactics,id:def.id,name:def.name,range:sense.range,hearing:sense.hearing,personality:sense.personality,lore:LORE[def.id]||def.personality||'',
      sensing:sense.hearing?'會循聲找人；牆能擋攻擊，卻不能隔絕牠的察覺。':'看見你才會追蹤；轉角和牆壁能幫你躲開視線。',
      lord:def.id.startsWith('lord-'),gate:def.id.startsWith('lord-')?'本層印記、迷宮機關與樓層主都完成後，才會開放出口。':null};
  }
  const ITEM_TIPS=freeze({
    heal:{when:'生命變低時使用，也可放進快捷欄。',caution:'隊友自動喝藥需先開啟，並設定生命門檻與保留數量。'},
    ration:{when:'飽食度偏低時先補充，別等肚子餓到受傷。',caution:'飽食度是全隊共用；療癒藥不能代替食物。'},
    haste:{when:'交戰前喝下，可更快移動及普通攻擊；也能放進快捷欄。',caution:'只作用於喝下的角色，切換領隊不轉移；效果期間不能重複喝，不縮短技能冷卻或準備時間。'},
    shield:{when:'準備接戰，或需要護著受傷隊員撤退時。',caution:'護盾會被傷害消耗，不代表五分鐘內都不會受傷。'},
    hourglass:{when:'快走到出口、護送旅人或正在交戰時。',caution:'停的是迷宮牆壁，怪物仍然會行動。'},
    bell:{when:'被多隻怪物包圍，或需要回營地整理隊伍時。',caution:'讓怪物退開不等於無敵，仍要避開身體和陷阱。'},
    map:{when:'道路不熟、想找出口，或牆壁剛變形後。',caution:'只揭露當下迷宮；下一次變形後要重新探索。'},
    feather:{when:'放在背包裡備用，遇到致命傷時自動生效。',caution:'不是可以無限復活的技能，用過就會消耗。'},
    arrow:{when:'射手出發前補好，全隊射手共用箭袋。',caution:'發射就消耗，射空也不會退回；箭雨與世界樹之箭一次要三支。'},
    coin:{when:'向行商購買合用裝備、補給，或在營地修理。',caution:'先確認職業、等級與單雙手限制，再決定買哪一件。'},
  });
  function item(id,run){
    const defs=C()?.ITEMS;if(!own(defs,id)||!own(ITEM_TIPS,id))return null;const def=defs[id],tip=ITEM_TIPS[id];
    const modern=!!run?.party?.loadouts;
    const effect=id==='shield'?(modern?'最大生命35%的護盾，最多五分鐘。':'25秒內減少65%受到的傷害。'):def.description;
    return {id,name:def.name,effect,...tip};
  }
  const GEAR_ROLES=freeze({
    longsword:{role:'攻守平衡',handling:'斬擊較快，可配盾；適合貼近後打一擊再退開。'},
    greatsword:{role:'重型輸出',handling:'單次傷害較高、出手較慢，需雙手持握，不能配盾。'},
    arcane_staff:{role:'法術輸出',handling:'物理威力低，但會提高法術與輔助效果；普通攻擊是遠程光彈。'},
    spellbook:{role:'治療與弱化',handling:'物理威力低，重點是法術與輔助；普通攻擊是遠程光彈。'},
    smith_hammer:{role:'修補與近戰',handling:'單手短鎚可配盾，適合保護隊伍並找機會補上一擊。'},
    warhammer:{role:'重型鍛擊',handling:'比短鎚更重、更有力，出手較慢，不能配盾。'},
    cooking_pan:{role:'近戰牽制',handling:'單手鐵鍋可配盾；配合擊暈技能替隊友爭取空檔。'},
    twin_daggers:{role:'側背突襲',handling:'雙手都持短刃，不能配盾；繞到背後可配合遊俠的突襲本領。'},
    elven_bow:{role:'遠程輸出',handling:'需要箭矢並占用雙手；拉開距離射擊，牆壁會擋住箭。'},
    heavy_helm:{role:'重裝防護',handling:'劍士與鍛匠的頭部防具，重點是防禦與耐用。'},
    heavy_armor:{role:'重裝防護',handling:'劍士與鍛匠的主防具，適合承受近身壓力。'},
    light_hood:{role:'輕裝防護',handling:'廚師、遊俠與射手的頭部防具。'},
    light_armor:{role:'輕裝防護',handling:'廚師、遊俠與射手的主防具；仍要避開怪物蓄力攻擊。'},
    rune_crown:{role:'施法者防護',handling:'術士與療癒師的頭飾；可以隱藏外觀，能力不受影響。'},
    robe:{role:'施法者防護',handling:'術士與療癒師穿用；防禦較薄，與怪物保持距離。'},
    buckler:{role:'單手搭配',handling:'和單手武器一起使用；雙手武器不能同時配盾。'},
    round_shield:{role:'單手搭配',handling:'和單手武器一起使用，提高防禦。'},
    tower_shield:{role:'單手搭配',handling:'和單手武器一起使用，提供較多防禦。'},
    robot_fists:{role:'機器人拳擊',handling:'一體式雙拳，左右拳輪替；不能配盾、卸下或移交，揮空不消耗耐久。'},
    robot_shell:{role:'機器人防護',handling:'一體式機殼，不能穿一般防具或卸下；以礦材與零件進階，保留原耐久比例。背脊裝甲、斜向散熱格柵與弧形管線隨機殼階級加細；三階增加中央核心護蓋，四階加入能量雕紋與肩背紋章，五階增加鎮淵箭形下背鑲片。'},
    robot_core:{role:'機體自修與照明',handling:'兩個可替換核心槽，各自按階級提供自修與防禦；單核心光源小於火把、雙核心大於火把且小於日光術。最高核心階級只決定光色；全隊採最強光源，不消耗能源或核心耐久。'},
  });
  function gear(value,run,actorId){
    const h=H(),kind=typeof value==='string'?value:value?.kind;if(!own(h?.GEAR,kind))return null;const def=h.GEAR[kind];
    const role=GEAR_ROLES[def.baseKind]||{role:'職業裝備',handling:'依職業與等級選用。'};
    const modern=!!run?.party?.loadouts,id=actorId||run?.party?.loadouts?.active;
    const validActor=modern&&h.ids(run).includes(id),job=validActor?h.job(run,id):null,level=validActor?h.level(run,id):null;
    const fit=!validActor?'適用：'+def.jobs.map(j=>h.JOBS[j].name).join('、'):!def.jobs.includes(job)?'這件裝備不適合目前選取的職業。':level<def.requiredLevel?'還需要升到 '+def.requiredLevel+' 級才能穿戴。':'符合目前角色的職業與等級。';
    const pct=typeof value==='object'&&Number.isFinite(value?.durability)&&Number.isFinite(value?.maxDurability)&&value.maxDurability>0?Math.max(0,Math.min(100,Math.ceil(value.durability/value.maxDurability*100))):null;
    const severity=pct===null?'unknown':pct===0?'broken':pct<=10?'critical':pct<=20?'warning':'good';
    const condition=severity==='broken'?def.core?'核心耐久耗盡即消失，不能修復；請在安全營地重新製作，沒有核心時保留較弱內建微光。':'已損壞，能力暫停；有能行動的鍛匠可在營地付費重建，否則找專門商人，銅幣另加20%。':severity==='critical'?'耐久快用完了，先換備用品；一般裝備可修理，動力核心只能再製作。':severity==='warning'?'耐久偏低，下次經過營地記得維護；動力核心不能修理。':'裝備未損壞時才提供能力。';
    return {name:def.name,tier:def.tier,requiredLevel:def.requiredLevel,...role,fit,condition,severity,durabilityPercent:pct,
      wear:def.core?'每三秒實際參與生命自修的核心消耗一耐久；滿血不消耗，受擊或照明不耗核心耐久。耐久歸零立即消失，不能修理，需重新製作。':def.integrated?(def.slot==='weapon'?'普通拳擊每四次有效命中消耗一次耐久；攻擊技能首次有效命中消耗一次，同次多目標不重扣，揮空不扣。':'受到有效傷害消耗一次機殼耐久；飢餓或護盾完全吸收時不消耗，緩震結構可免除此消耗。'):def.slot!=='weapon'?'受到有效傷害時，穿戴中的每件防具各消耗耐久。':['bow','staff','book'].includes(def.type)?'遠程攻擊發射就消耗武器耐久，射空也會消耗。':'近戰命中才消耗武器耐久，揮空不扣。'};
  }
  function progression(run){
    const loadouts=run?.party?.loadouts,h=H(),growth=G();if(!loadouts||!h||!growth)return null;
    const underground=C().isUnderworld(run),level=h.level(run,'hero'),maxLevel=h.maxLevel(run,'hero'),nextLevelXp=level<maxLevel?growth.XP[level]:null,choices=loadouts.growth?.choices?.length||0;
    const milestones=[{level:2,text:'可帶兩名同伴。'},{level:3,text:'可帶三名同伴，能穿二階裝備。'},{level:4,text:'主角選一個新技能；四級隊友也能另學一個。'},{level:5,text:'能穿三階裝備。'},{level:6,text:underground?'主角與同伴各選一個新技能。':'主角再選一個新技能。'},{level:8,text:underground?'主角與同伴各選一個新技能，能穿四階裝備。':'主角再選一個新技能。'},{level:10,text:underground?'同伴覺醒二選一；能穿五階裝備，技能提升到六級。':'主角隨機獲得一個獨有技能，技能提升到六級。'},...(underground?[{level:12,text:'主角學會原有覺醒路線的進階主動招式。'},{level:15,text:'主角學會所選覺醒路線的精通被動。'}]:[])].map(m=>({...m,reached:level>=m.level}));
    const ready=[4,6,8].filter(l=>level>=l).length-choices;
    return {level,recruitLimit:P().recruitLimit(run),nextLevelXp,remainingXp:nextLevelXp===null?0:Math.max(0,nextLevelXp-loadouts.xp),milestones,ready:Math.max(0,ready),next:milestones.find(m=>!m.reached)?.text||(underground?'地下遠征可帶四名同伴；搭配照明、裝備與技能，繼續深入五十層。':'已達最高等級，繼續搭配技能與裝備完成旅程。')};
  }
  const PROFESSIONS=freeze({
    swordsman:{innate:'能穿重裝，使用長劍配盾或雙手劍。卡住的石門可用職業本領快速處理。',examples:['guard_instinct','endurance']},
    mage:{innate:'法杖發射遠程光彈。隊中有能行動的術士，就能使用十分鐘日光術，不占技能欄。',examples:['recovery','extension']},
    scout:{innate:'使用雙短刃與輕裝。可提前辨認附近陷阱線索，遇到被掩蓋的暗門，可用職業本領快速找出暗扣。',examples:['trap_sense','intuition']},
    chef:{innate:'使用鐵鍋、輕裝與盾。遇到棘殼食材箱，可用職業本領快速處理。六道基本菜任何隊伍都能烹飪；有能行動的廚師，才顯示並可烹飪高階菜譜。',examples:['double_portion','gourmet']},
    healer:{innate:'法書發射遠程光彈。遇到受污染的泉眼，可用職業本領快速淨化。',examples:['herbalism','rescue']},
    smith:{innate:'矮人族鍛匠，能穿重裝，使用短鎚配盾或重錘。隊中有能行動的鍛匠，營地才可完整修理、重建破損（耐久歸零）與鍛造強化；否則需找專門商人，銅幣另加20%。',examples:['economy','care']},
    archer:{innate:'精靈長弓進行遠程攻擊，使用輕裝與全隊共用箭袋；發射會消耗箭矢。',examples:['steady_aim','nimble_shot']},
    // The card face stays as short as the other professions; the full machine rules live in `rules`.
    robot:{innate:'重防禦拳鬥者，以飛拳與衝撞替隊伍開路。自帶一體式機殼與拳臂，不能穿一般防具或配盾；靠動力核心自修生命與照明。',rules:'移動速度為一般人物九成。不能更換普通武器；以銅幣、零件與礦材進階。兩個動力核心自修生命並提供永久照明：單核心小於火把，雙核心大於火把、小於日光術；最高核心階級決定光色。全隊採最強來源，日光術優先，不因切換領隊改變。動力能源滿額十分鐘，耗盡慢行且不能攻擊或施放技能，不損失生命，仍保留光源；以動力石補充。一般料理、療癒藥與療癒魔法不能修復機體。',examples:['robot_body','fist_drive']},
  });
  function profession(job,run,actorId){
    const h=H();if(!own(PROFESSIONS,job)||!h)return null;const spec=PROFESSIONS[job];
    const id=actorId||run?.party?.loadouts?.active,actor=run?.party?.loadouts&&h.ids(run).includes(id)&&h.job(run,id)===job?h.actor(run,id):null;
    return {job,name:h.JOBS[job].name,innate:spec.innate,...(spec.rules?{rules:spec.rules}:{}),
      random:spec.examples.map(key=>({id:key,name:h.PASSIVES[key].name,description:h.PASSIVES[key].description,learned:actor?actor.passives.includes(key):null})),
      note:'以下效果需要角色實際學會對應被動才會生效。'+(job==='chef'?'多做一份的機率由「一料雙份」等級決定。':job==='smith'?'修理折扣由「節省工料」等級決定。':'')+'倒地隊員的全隊被動會暫停。'};
  }
  return Object.freeze({monster,item,gear,progression,profession});
});
