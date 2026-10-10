/* Original tower expedition rules. No rendering, timers or network side effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerPartyCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const X=()=>typeof module==='object'&&module.exports?require('./tower-expedition-core.js'):globalThis.TowerExpedition;
  const L=()=>typeof module==='object'&&module.exports?require('./tower-lighting-core.js'):globalThis.TowerLighting;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const G=()=>typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;
  const B=()=>typeof module==='object'&&module.exports?require('./tower-floor-lords.js'):globalThis.TowerFloorLords;
  const Loot=()=>typeof module==='object'&&module.exports?require('./tower-loot.js'):globalThis.TowerLoot;
  const Foraging=()=>typeof module==='object'&&module.exports?require('./tower-foraging.js'):globalThis.TowerForaging;
  const Re=()=>typeof module==='object'&&module.exports?require('./tower-reinforcements.js'):globalThis.TowerReinforcements;
  const Materials=()=>typeof module==='object'&&module.exports?require('./tower-materials.js'):globalThis.TowerMaterials;
  const R=()=>typeof module==='object'&&module.exports?require('./tower-recruitment.js'):globalThis.TowerRecruitment;
  const own=(o,k)=>Object.hasOwn(o,k), num=(v,a,b,int=false)=>Number.isFinite(v)&&v>=a&&v<=b&&(!int||Number.isInteger(v));
  const PROFESSIONS=Object.freeze({
    swordsman:{name:'劍士',person:'蒼衡',gender:'male',color:0x5594c1,skill:'守護架勢',description:'近戰傷害較高。技能：六秒內減傷一半；劍士隊友會替你攔下近身怪物。',cooldown:20},
    mage:{name:'術士',person:'露彌',gender:'female',color:0xb196e8,skill:'震盪結界',description:'技能：擊退附近怪物，使牠們短暫暈眩。另可在照明工具中施放十分鐘的日光術；術士隊友也能協助照明。',cooldown:22},
    scout:{name:'遊俠',person:'巧栗',gender:'female',color:0x68bead,skill:'探路之眼',description:'探路與避險專家。技能：顯示出口路線十八秒，獲得六秒陷阱保護。隊中有遊俠時，陷阱傷害減少四分之一。',cooldown:25},
    chef:{name:'廚師',person:'禾谷',gender:'male',color:0xe6ac65,skill:'隨手料理',description:'烹飪一次可做兩份。技能：用一份根莖恢復飽食度，照顧整支隊伍。',cooldown:25},
    healer:{name:'療癒師',person:'澄音',gender:'female',color:0x88c69f,skill:'草藥療癒',description:'技能：消耗一份香草恢復生命。隊友在你受重傷時也會使用香草救援。',cooldown:25},
    smith:{name:'鍛匠',person:'砧岳',gender:'male',color:0xbf936e,skill:'應急修補',description:'矮人族裝備修復專家。技能：用一份硬殼修復穿戴的裝備。隊中有鍛匠時，營地修理與鍛造費減半。',cooldown:25},
    archer:{name:'射手',person:'嵐羽',gender:'female',color:0xc8bc79,skill:'鷹眼巡望',description:'精靈弓手，擅長遠程射擊、牽制怪物與帶領隊伍穿行迷宮。弓是雙手武器，不能配盾。',cooldown:25},
    robot:{name:'機器人',person:'鐵衡',gender:'male',color:0x9dc5d7,skill:'摺甲防禦',description:'重防禦拳鬥者，以飛拳與衝撞替隊伍開路；不穿一般裝備，可用礦石和零件進階自身機殼、拳臂。',cooldown:28},
    cleric:{name:'神職',person:'緋鈴',gender:'female',color:0xe6a3a3,skill:'結界',description:'神社神職：神主與巫女。以弓箭附加詛咒，並手持大幣祈禱為隊友加持與結界。弓是雙手武器，不能配盾。',cooldown:24},
  });
  const NAMES=Object.freeze({swordsman:{male:'蒼衡',female:'瑟琳'},mage:{male:'星嵐',female:'露彌'},scout:{male:'逐杉',female:'巧栗'},chef:{male:'禾谷',female:'杏桃'},healer:{male:'沐川',female:'澄音'},smith:{male:'砧岳',female:'鐵薇'},archer:{male:'風梢',female:'嵐羽'},cleric:{male:'伊吹',female:'緋鈴'},robot:{male:'鐵衡',female:'鈴芯'}});
  const person=(job,gender=PROFESSIONS[job]?.gender)=>NAMES[job]?.[gender]||PROFESSIONS[job]?.person||'旅人';
  const sex=(run,id='hero')=>id==='hero'?(run.party.sex||PROFESSIONS[run.party.profession].gender):run.party.members.find(m=>m.id===id)?.sex||PROFESSIONS[run.party.members.find(m=>m.id===id)?.profession]?.gender;
  const recruitLimit=run=>C().isUnderworld(run)?4:run.party?.loadouts?Math.min(3,H().level(run,'hero')):3;
  const INGREDIENTS=Materials().INGREDIENTS;
  const LEGACY_INGREDIENTS=Object.freeze(['root','mushroom','herb','nectar','meat','shell']);
  const BASIC_RECIPES=Object.freeze(['stew','broth','skewer','soup','bento','salad']);
  const RECIPES=Object.freeze(Object.fromEntries(Object.entries({
    stew:{name:'根莖菇菇燉鍋',cost:{root:2,mushroom:1},hp:8,hunger:35},
    broth:{name:'香草暖湯',cost:{herb:2,root:1},hp:24,hunger:15},
    skewer:{name:'蜜烤菇串',cost:{nectar:1,mushroom:2},hp:0,hunger:35,buff:'focus'},
    crab:{name:'香煎蟹肉',cost:{meat:2,herb:1},hp:10,hunger:40,buff:'guard'},
    soup:{name:'蜜根熱湯',cost:{root:2,nectar:1},hp:16,hunger:30},
    bento:{name:'旅人飯盒',cost:{root:2,herb:1},hp:0,hunger:55,team:10},
    salad:{name:'發光香草沙拉',cost:{herb:1,mushroom:1},hp:12,hunger:20,buff:'trail'},
    feast:{name:'團聚大餐',cost:{root:2,mushroom:2,meat:2,nectar:1},hp:25,hunger:60,team:35},
    trail_bread:{name:'雲絨菇烤餅',cost:{cloudcap:1,root:1},hp:6,hunger:40,buff:'trail',description:'雲頂菇怪的柔軟傘蓋與甜根莖烤成薄餅；離開雲頂後，需要保留的雲絨菇才能再做。'},
    honey_roast:{name:'向陽蜜籽盤',cost:{sunseed:1,nectar:1},hp:12,hunger:30,buff:'focus',description:'庭園的日輪籽裹上蛾蜜烘烤，香氣讓出手更專注。'},
    crab_pot:{name:'蓮心蟹肉煲',cost:{lotus:1,meat:1},hp:18,hunger:45,buff:'guard',description:'霧河蓮心與真正蟹類掉落的蟹肉同煮；其他怪物不會憑空提供蟹肉。'},
    herbal_platter:{name:'墨香菇燴盤',cost:{inkcap:1,mushroom:1},hp:18,hunger:25,team:8,description:'藏書區的墨菇與月傘菇慢燴，分成小盤分享給同伴。'},
    crystal_pudding:{name:'共鳴晶凍',cost:{crystaljelly:2},hp:16,hunger:30,buff:'guard',ward:'shock',description:'回聲石窟的晶凍經溫熱凝成甜點。享用後五分鐘內，可抵擋一次電麻。'},
    forest_roast:{name:'森果根莖燴',cost:{forestnut:1,root:1},hp:10,hunger:45,team:8,description:'根林的堅果與甜根莖一起燜熟，是適合隊伍分享的耐餓料理。'},
    ember_skewer:{name:'餘火椒根串',cost:{emberpepper:1,root:1},hp:12,hunger:40,buff:'focus',ward:'burn',description:'熔爐怪物帶出的餘火椒為根莖串添上辛香。享用後五分鐘內，可抵擋一次灼傷。'},
    frost_compote:{name:'霜莓蜜煮',cost:{frostberry:1,nectar:1},hp:28,hunger:20,buff:'trail',ward:'poison',description:'霜地莓果以雪蜜蛾的花蜜慢煮。享用後五分鐘內，可抵擋一次中毒。'},
    copper_flatbread:{name:'米香齒輪餅',cost:{coppergrain:1,root:1},hp:10,hunger:50,buff:'guard',description:'工坊的銅穗米磨粉烤成齒輪形狀；名字像金屬，實際上是可食穀物。'},
    heart_jam:{name:'塔心蜜果醬',cost:{heartfruit:1,nectar:1},hp:24,hunger:30,team:12,description:'塔心怪物攜帶的心燈果熬成蜜醬，為最後幾層的同行者補充力量。'},
    root_banquet:{name:'根脈遠征鍋',cost:{deeproot:2,herb:1},hp:26,hunger:55,team:16,buff:'trail',requiredDepth:1,description:'地下根脈特有的深根與香草燉成大鍋；地上甜根莖不能取代主材料。'},
    mist_broth:{name:'渡渠鮮蝦湯',cost:{blindshrimp:2,herb:1},hp:34,hunger:25,team:18,requiredDepth:11,description:'無名渡渠的盲蝦與香草熬出鮮湯，不再依賴每一區都出現蟹肉。'},
    // Keep the previous B21 meal identifier and unlock floor so saved cooked
    // portions and the chef's recipe history remain valid after recipe revision.
    ember_crab:{name:'沉頁夜菇燴',cost:{nighttruffle:2,mushroom:1},hp:22,hunger:60,buff:'focus',requiredDepth:21,description:'沉頁藏書庫的夜松露與菇類慢燴，濃郁香氣讓隊伍更專注。'},
    ash_stew:{name:'灰香燉根',cost:{ashspice:2,root:1},hp:30,hunger:55,team:20,buff:'guard',requiredDepth:31,description:'無火深井的灰香料煨入甜根莖；耐熱的香氣替地下遠征暖胃。'},
    gate_feast:{name:'歸途星露宴',cost:{starjelly:3,nectar:1},hp:38,hunger:75,team:45,buff:'guard',requiredDepth:41,description:'原初門庭的星露凝晶與花蜜製成盛宴，珍貴主材料只在最後一區取得。'},
  }).map(([id,recipe])=>[id,Object.freeze({...recipe,requiresChef:!BASIC_RECIPES.includes(id)})])));
  const LEGACY_RECIPES=Object.freeze(['stew','broth','skewer','crab','soup','bento','salad','feast']);
  const recipeFloorAllowed=(floor,id)=>own(RECIPES,id)&&(!RECIPES[id].requiredDepth||floor<0&&-floor>=RECIPES[id].requiredDepth);
  const recipeUnlocked=(run,id)=>!!run&&recipeFloorAllowed(run.floor,id)&&(!RECIPES[id].requiredDepth||C().isUnderworld(run));
  const recipeAvailable=(run,id)=>recipeUnlocked(run,id)&&(!RECIPES[id].requiresChef||has(run,'chef'));
  const availableRecipes=run=>Object.fromEntries(Object.entries(RECIPES).filter(([id])=>recipeAvailable(run,id)));
  function mealStock(value,floor){
    if(!value||typeof value!=='object'||Array.isArray(value)||!LEGACY_RECIPES.every(id=>own(value,id))||Object.keys(value).some(id=>!own(RECIPES,id))||Object.values(value).some(v=>!num(v,0,99,true)))return null;
    const result=Object.fromEntries(Object.keys(RECIPES).map(id=>[id,value[id]??0]));
    return Object.entries(result).some(([id,count])=>count>0&&!recipeFloorAllowed(floor,id))?null:result;
  }
  function ingredientStock(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||!LEGACY_INGREDIENTS.every(k=>own(value,k))||Object.keys(value).some(k=>!own(INGREDIENTS,k))||Object.values(value).some(v=>!num(v,0,99,true)))return null;
    // Original six-key saves gain empty regional slots, never free ingredients.
    return Object.fromEntries(Object.keys(INGREDIENTS).map(k=>[k,value[k]??0]));
  }
  const BUFFS=Object.freeze({focus:'專注：攻擊 +3',guard:'暖胃：受到傷害 -2',trail:'輕盈：陷阱傷害減半'});
  const MONSTERS=Object.freeze({
    mushroom:{id:'mushroom',name:'蒲傘菇',strength:1,speed:1.05,damage:6,sight:7,color:0xcf95bc,shape:'mushroom',description:'傘蓋膨脹時準備噴孢子；拉開距離，避免短暫緩速。',drop:{mushroom:2}},
    crab:{id:'crab',name:'岩殼蟹',strength:2,speed:1.2,damage:10,sight:8,color:0xc28c62,shape:'crab',description:'正面硬殼擋下部分傷害；趁牠攻擊後，繞到側面出手。',drop:{meat:2,shell:1}},
    moth:{id:'moth',name:'蜜囊蛾',strength:2,speed:1.9,damage:7,sight:9,color:0xdfcc79,shape:'moth',description:'振翅時發出警訊，附近怪物會暫時更容易發現你。',drop:{nectar:2}},
    flower:{id:'flower',name:'蔓嘴花',strength:3,speed:0,damage:10,sight:10,color:0x96bb70,shape:'flower',ranged:true,description:'根留在原地，蓄力後吐出種子；利用牆壁擋住飛行物。',drop:{herb:2,root:1}},
  });
  const BOSS_FLOORS=X().BOSSES;
  function hash(seed,text){let h=seed>>>0;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  const emptyStock=keys=>Object.fromEntries(Object.keys(keys).map(k=>[k,0]));
  const has=(run,job)=>run.party&&(run.party.loadouts?H().ids(run).some(id=>H().job(run,id)===job&&H().hp(run,id)>0):run.party.profession===job&&run.hp>0||run.party.members.some(m=>m.profession===job&&m.hp>0));
  const memberMax=m=>m.id==='hero'?60:28+m.level*6;
  // Hero-journey life: sturdy front-liners carry more, and companions start
  // closer to the protagonist (a level-10 companion still matches a level-10
  // hero, as before). Every value is at least the earlier formula (60+3/level
  // hero, 28+6/level companion, levels 1-10), so no saved health exceeds its cap.
  const VITALITY=Object.freeze({swordsman:1.35,smith:1.3,robot:1.2,chef:1.15,scout:1.05,archer:1,healer:1,cleric:1,mage:1});
  // Each free constitution point adds 2% life; free points per ability score stop at ATTRIBUTE_CAP.
  const ATTRIBUTE_CAP=10,VIT_HP_STEP=.02,vitPoints=v=>Number.isInteger(v)?Math.max(0,Math.min(ATTRIBUTE_CAP,v)):0;
  const vitalHp=(profession,level,hero,vit=0)=>Math.round((hero?60+(level-1)*3:40+level*5)*(VITALITY[profession]||1)*(1+VIT_HP_STEP*vitPoints(vit)));
  const newBoss=floor=>X().newBoss(floor);
  function enable(run,profession,gender=PROFESSIONS[profession]?.gender){
    const next=C().validateSave(run);if(!next||!own(PROFESSIONS,profession)||next.party||!['male','female'].includes(gender))return {ok:false,run,message:'請選擇有效的冒險職業與外觀。'};
    const guard=next.warrior;
    next.party={version:1,profession,sex:gender,members:[],joined:[],travellers:[],ingredients:{...emptyStock(INGREDIENTS),root:3,mushroom:2,herb:2,shell:1},meals:emptyStock(RECIPES),buffs:[],cooldown:0,guardLeft:0,trapWard:0,slowLeft:0,health:{},poise:{},boss:newBoss(next.floor),journey:X().newJourney(next.floor)};
    if(L())next.party.light=L().newState();
    next.party.loot=Loot().fresh();next.party.reinforcements=Re().fresh();next.party.foraging=Foraging().fresh(next);
    if(guard){const m={id:guard.offerId,profession:'swordsman',sex:'male',level:guard.strength,hp:28+guard.strength*6,cooldown:0,hurtLeft:0};next.party.members.push(m);next.party.joined.push(m.id);}
    next.warrior=null;next.revision++;
    return {ok:true,run:next,message:guard?'原有護衛已成為劍士隊友，不必重新支付費用。':'冒險職業已選定。'};
  }
  function validate(value,floor,defeated,contracts=[],seed=value?.foraging?.seed){
    // v1.37 used guard.id rather than offerId during a legacy upgrade. Repair
    // only the unambiguous single-contract shape; never guess a missing party.
    if(value?.journey===undefined&&value?.members?.length===1&&value.members[0]?.profession==='swordsman'&&value.members[0].id==null&&value.joined?.length===1&&value.joined[0]===null&&contracts.length===1)value={...value,members:[{...value.members[0],id:contracts[0]}],joined:[contracts[0]]};
    if(!value||value.version!==1||!own(PROFESSIONS,value.profession)||value.sex!==undefined&&!['male','female'].includes(value.sex))return null;
    const gender=value.sex||PROFESSIONS[value.profession].gender;
    const ingredients=ingredientStock(value.ingredients),meals=mealStock(value.meals,floor);if(!ingredients||!meals)return null;
    if(!Array.isArray(value.joined)||value.joined.length>150||new Set(value.joined).size!==value.joined.length||!value.joined.every(id=>typeof id==='string'&&id.length>0&&id.length<=80))return null;
    if(!Array.isArray(value.members)||value.members.length>(floor<0?4:3)||new Set(value.members.map(m=>m?.id)).size!==value.members.length)return null;
    const members=[];
    for(const m of value.members){const bonus=m?.profession==='robot'&&value.loadouts?.actors?.[m.id]?.passives?.includes('robot_body')?5*(m.level>=10?6:Math.min(5,m.level)):0;if(!m||!value.joined.includes(m.id)||!own(PROFESSIONS,m.profession)||m.sex!==undefined&&!['male','female'].includes(m.sex)||!num(m.level,1,floor<0&&value.loadouts?10:5,true)||!num(m.hp,0,(value.loadouts?vitalHp(m.profession,m.level,false,value.loadouts.actors?.[m.id]?.attrs?.vit):memberMax(m))+bonus)||!num(m.cooldown,0,30)||!num(m.hurtLeft,0,2))return null;const xp=m.xp===undefined?G().XP[m.level-1]:G().migrateXp(m.xp,m.level,value.loadouts?.xpCurve);if(value.loadouts&&!num(xp,G().XP[m.level-1],G().XP[floor<0?9:4],true))return null;members.push({id:m.id,profession:m.profession,sex:m.sex||PROFESSIONS[m.profession].gender,level:m.level,...(value.loadouts?{xp}:{}),hp:m.hp,cooldown:m.cooldown,hurtLeft:m.hurtLeft});}
    if(!Array.isArray(value.buffs)||value.buffs.length>2||new Set(value.buffs.map(b=>b?.id)).size!==value.buffs.length||!value.buffs.every(b=>b&&own(BUFFS,b.id)&&num(b.floors,1,3,true)))return null;
    for(const k of ['cooldown','guardLeft','trapWard','slowLeft'])if(!num(value[k],0,30))return null;
    const dict=(v,max)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=C().MAX_MONSTERS&&Object.keys(v).every(id=>C().validMonsterId(id,floor)&&!defeated.includes(id)&&num(v[id],0,max));
    if(!dict(value.health,floor<0?1560:312)||!dict(value.poise,5))return null;
    // Ordinary deep monsters stay within 258; the chapter lord within its own maximum and a mini lord (free lord slot) within 258 x MINI_HP.
    if(floor<0){const lord=B().spec({floor,party:value});for(const [id,hp]of Object.entries(value.health))if(hp>(id===lord?.id?lord.maxHp:!lord&&id===B().UNDERWORLD_ID?Math.round(258*B().MINI_HP):/^monster-h-/.test(id)?Math.round(258*B().CHAMPION_HP):258))return null;}
    const loot=Loot()?.validate(value.loot,floor,defeated),reinforcements=Re()?.validate(value.reinforcements,floor),foraging=Foraging()?.validate(value.foraging,floor,seed);if(!loot||!reinforcements||!foraging)return null;
    const boss=X().validateBoss(value.boss,floor,value.journey===undefined),journey=X().validateJourney(value.journey,floor);
    if(value.light!==undefined&&!L())return null; // Never silently discard saved fuel if a script failed to load.
    const light=L()?.validate(value.light,floor);
    if(boss===undefined||!journey||L()&&!light)return null;
    const loadouts=value.loadouts===undefined?undefined:H()?.validate(value.loadouts,{profession:value.profession,members,floor});
    if(value.loadouts!==undefined&&!loadouts)return null;
    const travellers=R().validate(value.travellers,{...value,members,loadouts},floor);if(!travellers)return null;
    return {version:1,profession:value.profession,sex:gender,members,joined:[...value.joined],travellers,ingredients,meals,buffs:value.buffs.map(b=>({...b})),cooldown:value.cooldown,guardLeft:value.guardLeft,trapWard:value.trapWard,slowLeft:value.slowLeft,health:{...value.health},poise:{...value.poise},boss,journey,loot,reinforcements,foraging,...(light?{light}:{}),...(loadouts?{loadouts}:{})};
  }
  function transact(run,revision,fn){return C().transaction(run,revision,next=>!next.party?{ok:false,message:'尚未選擇冒險職業。'}:fn(next,next.party));}
  function recruitOffer(run){
    const modern=!!run.party?.loadouts,h=hash(run.seed,`recruit:${run.floor}`), early=modern?[99,97,95,93,91,89,87,85,83]:[99,97,95,93,91,89];
    if(!early.includes(run.floor)&&h%100>=45)return null;
    const jobs=Object.keys(PROFESSIONS).filter(j=>modern||!['archer','cleric','robot'].includes(j)),job=jobs[early.includes(run.floor)?early.indexOf(run.floor):h%jobs.length];
    // Underground recruits always start at five, independent of depth or leader level.
    // Existing members keep their earned levels; the original surface scaling is unchanged.
    const level=C().isUnderworld(run)?5:Math.min(5,1+Math.floor((99-run.floor)/22));
    const id=`companion:${run.floor}:${run.seed}`;
    if(!run.party)return null;
    const selected=R().select(run,{id,profession:job,sex:modern?(hash(run.seed,id+':sex')%2?'female':'male'):PROFESSIONS[job].gender,level},hash(run.seed,`reunion:${run.floor}`));
    return selected?{...selected,price:R().quote(run,selected).costs.coins||0}:null;
  }
  function recruitQuote(run,id){const offer=recruitOffer(run);return R().quote(run,offer&&(!id||offer.id===id)?offer:null);}
  const archiveMember=(run,member)=>R().remember(run,member);
  function recruit(run,id,revision){return transact(run,revision,(n,p)=>{
    const q=recruitQuote(n,id),offer=q.offer;if(!offer||offer.id!==id)return {ok:false,message:'這位旅人目前不在附近。'};if(!q.affordable)return {ok:false,message:q.reason};
    R().pay(n,q);let member;
    if(offer.returning){member=R().restore(n,offer);if(!member)return {ok:false,message:'這位旅人尚未準備好再次同行。'};}
    else{member={id,profession:offer.profession,sex:offer.sex,level:offer.level,hp:p.loadouts?vitalHp(offer.profession,offer.level,false):28+offer.level*6,cooldown:0,hurtLeft:0};p.members.push(member);p.joined.push(id);if(p.loadouts)H().addMember(n,member);}
    let learned=null;
    if(p.loadouts&&C().isUnderworld(n)&&!H().actor(n,id).learned){
      // Only a newly paid underground recruit gets this automatic fourth-level
      // reward. Record the consumed choice so reloads and later levels cannot
      // grant it twice; a separate seed keeps combat rolls and the base draft intact.
      const h=H(),a=h.actor(n,id),known=[...a.skills,...a.passives],pool=Object.values({...h.SKILLS,...h.PASSIVES}).filter(s=>s.job===member.profession&&!s.unique&&!known.includes(s.id)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      if(!pool.length||G().available(n,id)<1)return {ok:false,message:'這位旅人的技能資料尚未就緒，請重新確認招募。'};
      learned=pool[hash(n.seed,id+':recruit-level-four')%pool.length];
      (learned.attack!==undefined?a.skills:a.passives).push(learned.id);if(learned.attack!==undefined)a.cooldowns[learned.id]=0;
      a.learned=learned.id;G().record(n,id).choices.push(learned.id);
      // The random fourth-level reward may be the robot's maximum-HP talent.
      // New recruits arrive healthy; reunions keep the existing health rules.
      if(!offer.returning&&member.profession==='robot')h.setHp(n,id,h.maxHp(n,id));
    }
    return {ok:true,message:`${person(offer.profession,offer.sex)}${offer.returning?'再次':'已'}加入隊伍。${learned?'隨機習得 '+learned.name+'。':''}`,effect:{recruited:id,returning:offer.returning}};
  });}
  function dismiss(run,id,revision){return transact(run,revision,(n,p)=>{const m=p.members.find(m=>m.id===id);if(!m)return {ok:false,message:'這位同伴不在隊伍中。'};if(p.loadouts){if(p.loadouts.active===id)return {ok:false,message:'先切換另一位隊員帶隊，再與他道別。'};const gear=m.profession==='robot'?[]:Object.values(H().equipment(n,id)).filter(Boolean);if(n.gearBag.length+gear.length>24)return {ok:false,message:'先清出背包空間，保留同伴的裝備。'};archiveMember(n,m);n.gearBag.push(...gear);H().removeMember(n,id);}else archiveMember(n,m);p.members=p.members.filter(m=>m.id!==id);return {ok:true,message:'與'+person(m.profession,m.sex)+'道別了。之後的樓層仍有機會重逢。'};});}
  function gather(run,source,id,revision){return transact(run,revision,(n,p)=>{
    if(!/^s\d{1,2}$/.test(source)||!own(INGREDIENTS,id)||n.claimed.includes(source))return {ok:false,message:'這份材料已經採集過了。'};
    if(p.ingredients[id]>=99)return {ok:false,message:'材料袋已滿。'};p.ingredients[id]++;n.claimed.push(source);return {ok:true,message:`獲得${INGREDIENTS[id]}。`};
  });}
  function cook(run,id,revision){return transact(run,revision,(n,p)=>{
    if(!recipeUnlocked(n,id))return {ok:false,message:own(RECIPES,id)?'這份地下料理需抵達地下 B'+RECIPES[id].requiredDepth+' 後才能烹飪。':'沒有這份食譜。'};
    if(!recipeAvailable(n,id))return {ok:false,message:'這道高階料理需要隊伍中仍能行動的廚師調理。'};
    const r=RECIPES[id],chance=p.loadouts?H().teamPassive(n,'double_portion'):0,amount=p.loadouts?(chance>0&&H().roll(n,p.loadouts.active,'cook')<chance?2:1):has(n,'chef')?2:1;
    if(p.meals[id]+amount>99)return {ok:false,message:'料理盒已滿。'};
    if(Object.entries(r.cost).some(([k,v])=>p.ingredients[k]<v))return {ok:false,message:'食材還不夠，再去找找吧。'};
    if(p.loadouts){const chef=H().ids(n).find(k=>H().hp(n,k)>0&&H().pv(n,'ingredient_care',k)>0)||p.loadouts.active;G().consumeCost(n,chef,r.cost);}else for(const[k,v]of Object.entries(r.cost))p.ingredients[k]-=v;p.meals[id]+=amount;return {ok:true,message:`完成${r.name}，共${amount}份。`};
  });}
  function eat(run,id,revision){return transact(run,revision,(n,p)=>{
    if(p.loadouts&&H().job(n)==='robot')return {ok:false,message:'機器人不能享用料理，請使用動力核心或零件回補修復。'};
    if(!recipeUnlocked(n,id)||!p.meals[id])return {ok:false,message:'料理盒裡沒有可享用的這道料理。'};const r=RECIPES[id];
    if(p.loadouts)H().heal(n,p.loadouts.active,r.hp);else n.hp=Math.min(C().MAX_HP,n.hp+r.hp);n.hunger=Math.min(100,n.hunger+r.hunger*(p.loadouts?1+H().teamPassive(n,'gourmet')/100:1));if(r.team){if(p.loadouts)H().ids(n).filter(k=>k!==p.loadouts.active&&H().hp(n,k)>0).forEach(k=>H().heal(n,k,r.team));else p.members.forEach(m=>m.hp=Math.min(memberMax(m),m.hp+r.team));}if(p.loadouts){H().food(n);G().recipe(n,id);}
    if(r.buff){p.buffs=p.buffs.filter(b=>b.id!==r.buff);p.buffs.push({id:r.buff,floors:3});if(p.buffs.length>2)p.buffs.shift();}
    if(r.ward&&p.loadouts)H().setBuff(n,p.loadouts.active,'meal_'+r.ward,300,1);
    p.meals[id]--;return {ok:true,message:`享用${r.name}。`};
  });}
  const CAMP_MAINTENANCE_RATIO=.1;
  const campGear=run=>(run.party?.loadouts?H().ids(run).flatMap(id=>Object.values(H().equipment(run,id)).filter(Boolean)):Object.values(run.equipment||{}).filter(Boolean)).filter(g=>!H().ROBOT.isCore(g)&&g.durability>0&&g.durability<g.maxDurability);
  function campMaintenanceQuote(run){
    const cost=6,used=!!run?.party?.journey?.maintenance?.includes(run.floor),gear=run?.party?campGear(run):[];
    const reason=!run?.party?'尚未選擇冒險職業。':used?'本層已進行過營地保養，下一層才能再次保養。':!gear.length?'沒有可保養的裝備；破損裝備需請鍛匠或對應商人修復。':'';
    return {cost,used,allowed:!reason,reason,affordable:!!run&&run.coins>=cost,ratio:CAMP_MAINTENANCE_RATIO,gearIds:gear.map(g=>g.id)};
  }
  function camp(run,action,revision){return transact(run,revision,(n,p)=>{
    if(action==='rest')return {ok:false,message:'營地不再提供乾糧全隊恢復，請烹飪或享用已備好的料理。'};
    if(action!=='repair')return {ok:false,message:'未知的營地服務。'};
    const q=campMaintenanceQuote(n);if(!q.allowed)return {ok:false,message:q.reason};if(!q.affordable)return {ok:false,message:'維護費不足。'};
    n.coins-=q.cost;campGear(n).forEach(g=>g.durability=Math.min(g.maxDurability,g.durability+Math.ceil(g.maxDurability*q.ratio)));p.journey.maintenance.push(n.floor);return {ok:true,message:'本層保養完成：穿戴中的裝備恢復最大耐久的'+Math.round(q.ratio*100)+'%，破損裝備需請鍛匠或對應商人修復。'};
  });}
  const Mat=()=>typeof module==='object'&&module.exports?require('./tower-materials.js'):globalThis.TowerMaterials;
  function defs(){return {...C().MONSTERS,...MONSTERS,...B().defs()};}
  // Use a private definition for every underground combatant. Never mutate the
  // shared species catalogue, which is also used by surface saves and previews.
  function monsterPower(floor,def,strength){
    const baseHp=18+strength*8+Math.floor((99-Math.max(1,floor))/8);
    // Boost new maximums, not saved remaining HP: ongoing wounded enemies are
    // never healed on load and defeated enemies keep their existing dead IDs.
    if(floor>0)return {def,maxHp:Math.round(baseHp*1.15)};
    const step=Math.floor((-floor-1)/10);
    return {def:{...def,damage:Math.round(def.damage*(1.25+step*.1))},maxHp:Math.round(Math.round(baseHp*(2+step*.3))*1.15)};
  }
  const Dg=()=>typeof module==='object'&&module.exports?require('./tower-dungeons.js'):globalThis.TowerDungeons;
  // Inside a hunt rift only its own combatants exist (monster-h-N): this region's creatures, a mini-lord-grade
  // champion or three crystal carriers. The floor's own roster waits untouched for the return.
  function huntSpecs(run,hunt){
    const f=run.floor,config=C().floorConfig(f,run.seed),pool=Mat().monsterTypes(run),region=Mat().ecology(run)?.id;
    const pick=text=>{let h=run.seed>>>0;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
    return Array.from({length:hunt.count},(_,i)=>{
      const champion=hunt.champion===i,carrier=hunt.carriers.includes(i),entry=champion?(B().MINI_LORDS[region]||[])[pick('hunt-champion:'+f)%2]:null;
      const kind=entry&&defs()[entry.kind]?entry.kind:pool[pick('hunt-monster:'+f+':'+i)%pool.length],base=Mat().decorate(run,defs()[kind],kind);
      const strength=Math.min(5,base.strength+config.monsterStrengthBonus+(champion?1:0)),power=monsterPower(f,base,strength);
      if(!champion)return {id:'monster-h-'+i,kind,strength,hunt:true,...(carrier?{carrier:true}:{}),maxHp:power.maxHp,def:carrier?{...power.def,name:'帶晶・'+power.def.name}:power.def};
      const chapterLord=B().allLords()[f>0?Math.max(1,Math.floor(f/10)*10):-Math.ceil(-f/10)*10],cap=chapterLord?chapterLord.damage-1:Infinity;
      // A little tougher than a floor mini lord: more health and harder hits, still capped below the chapter lord.
      return {id:'monster-h-'+i,kind,strength,hunt:true,elite:true,champion:true,maxHp:Math.round(power.maxHp*B().CHAMPION_HP),
        def:{...power.def,name:'裂隙首領・'+(entry?.name||power.def.name),color:entry?.color??power.def.color,damage:Math.min(cap,Math.round(power.def.damage*B().CHAMPION_DAMAGE)),speed:Math.min(3.2,(power.def.speed??2.1)*1.08),sight:(power.def.sight||8)+2,elite:true}};
    });
  }
  function monsterSpecs(run){
    const hunt=run.expedition?.active&&Dg()?.isHuntId?.(run.expedition.active.id)?Dg().activeOffer(run):null;if(hunt)return huntSpecs(run,hunt);
    const f=run.floor,config=C().floorConfig(f,run.seed),count=config.monsterCount;
    const pool=Mat().monsterTypes(run);
    const result=Array.from({length:count},(_,i)=>{const kind=pool[hash(run.seed,`monster:${f}:${i}`)%pool.length],def=Mat().decorate(run,defs()[kind],kind),strength=Math.min(5,def.strength+config.monsterStrengthBonus);return {id:`monster-${i}`,kind,strength,...monsterPower(f,def,strength)};});
    const lord=B().spec(run);if(lord)result.push(lord);
    // One regional mini lord on every other floor of a modern journey, in the free lord ID slot.
    const mini=B().miniFor?.(run,Mat().ecology(run)?.id),miniId=f<0?B().UNDERWORLD_ID:B().ID;
    if(mini&&defs()[mini.kind]&&!result.some(m=>m.id===miniId)){
      const base=Mat().decorate(run,defs()[mini.kind],mini.kind),strength=Math.min(5,base.strength+config.monsterStrengthBonus+1),power=monsterPower(f,base,strength);
      // Never hits as hard as the lord waiting at the end of this chapter.
      const chapterLord=B().allLords()[f>0?Math.max(1,Math.floor(f/10)*10):-Math.ceil(-f/10)*10],cap=chapterLord?chapterLord.damage-1:Infinity;
      result.push({id:miniId,kind:mini.kind,strength,elite:true,mini:mini.id,maxHp:Math.round(power.maxHp*B().MINI_HP),
        def:{...power.def,name:'小樓主・'+mini.name,color:mini.color,damage:Math.min(cap,Math.round(power.def.damage*B().MINI_DAMAGE)),speed:Math.min(3.2,(power.def.speed??2.1)*1.08),sight:(power.def.sight||8)+2,elite:true}});
    }
    return result.concat(Re().specs(run));
  }
  function strike(run,id,options={},revision){if(run.party?.loadouts)return H().strike(run,id,options,revision);return transact(run,revision,(n,p)=>{
    const spec=monsterSpecs(n).find(m=>m.id===id);if(!spec||n.defeatedMonsters.includes(id))return {ok:false,message:'這隻怪物已經倒下了。'};
    const member=options.memberId?p.members.find(m=>m.id===options.memberId&&m.hp>0):null;
    if(options.memberId&&(!member||member.cooldown>0))return {ok:false,message:'同伴正在調整呼吸。'};
    const w=n.equipment.weapon;let damage=member?6+member.level*2+(member.profession==='mage'?3:0):(w?{bat:15,pan:13,staff:11}[w.kind]+w.bonus*2:7)+(p.profession==='swordsman'?4:0);
    damage+=p.buffs.some(b=>b.id==='focus')?3:0;
    if(spec.kind==='crab'&&options.front===true)damage=Math.max(1,Math.round(damage*.55));
    if(member)member.cooldown=member.profession==='mage'?3:1.8;
    let broken=null;if(!member&&w){X().wear(n,w);if(w.durability===0){broken=w;n.equipment.weapon=null;}}
    const hp=Math.max(0,(p.health[id]??spec.maxHp)-damage);p.health[id]=hp;
    let stunned=false;if(!member&&w&&!p.poise[id]){n.monsterStuns[id]=Math.min(2,.7+w.bonus*.3);p.poise[id]=4;stunned=true;}
    let drops=[];if(hp===0){n.defeatedMonsters.push(id);delete p.health[id];delete p.poise[id];delete n.monsterStuns[id];n.coins=Math.min(999999,n.coins+8+spec.strength*2);drops=Loot().recordKill(n,spec,options.lootCell);}
    return {ok:true,message:hp===0?`擊敗${spec.def.name}。`:`命中${spec.def.name}。`,effect:{target:'monster',damage,hp,dead:hp===0,broken,stunned,drops,lord:!!spec.lord}};
  });}
  function hurtMember(run,id,amount,revision,monsterId=null){if(run.party?.loadouts)return transact(run,revision,n=>H().hurt(n,id,amount,'monster',monsterId));return transact(run,revision,(n,p)=>{
    const m=p.members.find(x=>x.id===id);if(!m||m.hp<=0||!num(amount,0,100))return {ok:false,message:'無效的隊友傷害。'};
    if(m.hurtLeft>0)return {ok:true,message:'',effect:{target:'companion',damage:0}};const damage=Math.max(1,amount-m.level);m.hp=Math.max(0,m.hp-damage);m.hurtLeft=2;return {ok:true,message:m.hp===0?`${PROFESSIONS[m.profession].person}需要休息！帶他回營地或分享料理。`:'劍士擋下了攻擊。',effect:{target:'companion',damage,down:m.hp===0}};
  });}
  function skill(run,revision,skillId){if(run.party?.loadouts)return H().cast(run,skillId||H().actor(run).skills[0],{},revision);return transact(run,revision,(n,p)=>{
    if(p.cooldown>0)return {ok:false,message:'技能還在準備中。'};const j=p.profession;
    if(j==='chef'){if(!p.ingredients.root)return {ok:false,message:'需要一份甜根莖。'};if(n.hunger>=100)return {ok:false,message:'肚子還很飽。'};p.ingredients.root--;n.hunger=Math.min(100,n.hunger+25);}
    if(j==='healer'){if(!p.ingredients.herb)return {ok:false,message:'需要一份香草。'};if(n.hp>=C().MAX_HP)return {ok:false,message:'生命已滿。'};p.ingredients.herb--;n.hp=Math.min(C().MAX_HP,n.hp+20);}
    if(j==='smith'){const gear=Object.values(n.equipment).filter(g=>g&&!H().ROBOT.isCore(g)&&g.durability<g.maxDurability);if(!gear.length)return {ok:false,message:'沒有需要修補的裝備。'};if(!p.ingredients.shell)return {ok:false,message:'需要一份硬殼。'};p.ingredients.shell--;gear.forEach(g=>g.durability=Math.min(g.maxDurability,g.durability+3));}
    if(j==='swordsman')p.guardLeft=6;
    if(j==='scout'){p.trapWard=6;n.effects.reveal=Math.max(18,n.effects.reveal);}
    p.cooldown=PROFESSIONS[j].cooldown;return {ok:true,message:PROFESSIONS[j].skill,effect:{skill:j}};
  });}
  function reduceDamage(run,amount,source){const p=run.party;if(!p||source==='hunger')return amount;if(source==='trap'&&p.trapWard>0)return 0;let result=Math.max(0,amount-(p.buffs.some(b=>b.id==='guard')?2:0)-(source==='trap'?X().traits(run).grip:0));if(p.guardLeft>0)result*=.5;if(source==='trap'&&p.buffs.some(b=>b.id==='trail'))result*=.5;if(source==='trap'&&has(run,'scout'))result*=.75;return Math.ceil(result);}
  function tick(next,dt){const p=next.party;if(!p)return;L()?.tick(next,dt);if(p.loadouts)H().tick(next,dt);for(const k of ['cooldown','guardLeft','trapWard','slowLeft'])p[k]=Math.max(0,p[k]-dt);if(next.expedition.active)return;
    for(const m of p.members){m.cooldown=Math.max(0,m.cooldown-dt);m.hurtLeft=Math.max(0,m.hurtLeft-dt);}
    for(const k of Object.keys(p.poise)){p.poise[k]=Math.max(0,p.poise[k]-dt);if(!p.poise[k])delete p.poise[k];}
    if(p.boss?.started&&!p.boss.done)p.boss.clock+=dt;
  }
  function advance(next,options){if(!next.party)return;L()?.advance(next);if(next.party.loadouts)H().advance(next,options);const p=next.party;p.health={};p.poise={};p.loot=Loot().fresh();p.reinforcements=Re().fresh();p.foraging=Foraging().fresh(next);p.boss=newBoss(next.floor);p.journey={...X().newJourney(next.floor),scrap:p.journey?.scrap||0,maintenance:[...(p.journey?.maintenance||[])],...(p.journey?.materials?{materials:{...p.journey.materials}}:{})};p.buffs=p.buffs.map(b=>({...b,floors:b.floors-1})).filter(b=>b.floors>0);p.slowLeft=0;}
  const canDescend=run=>(!run.party?.boss||run.party.boss.done)&&B().defeated(run);
  const bossPhase=run=>X().phase(run),mirrorTarget=(run,index)=>X().target(run,index),bossAction=(run,index,revision)=>X().bossAction(run,index,revision);
  return Object.freeze({PROFESSIONS,NAMES,person,sex,recruitLimit,INGREDIENTS,RECIPES,BASIC_RECIPES,LEGACY_RECIPES,recipeUnlocked,recipeAvailable,availableRecipes,BUFFS,MONSTERS,BOSS_FLOORS,enable,validate,has,memberMax,VITALITY,ATTRIBUTE_CAP,VIT_HP_STEP,vitalHp,recruitOffer,recruitQuote,archiveMember,recruit,dismiss,gather,cook,eat,CAMP_MAINTENANCE_RATIO,campMaintenanceQuote,camp,defs,monsterPower,monsterSpecs,strike,hurtMember,skill,reduceDamage,tick,advance,canDescend,bossPhase,mirrorTarget,bossAction});
});
