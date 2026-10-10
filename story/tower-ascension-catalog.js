/* Underground hero continuations. Pure data; no engine imports or saved state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerAscensionCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  const ranks=power=>Array(6).fill(power);
  const actives=[],passives=[],BRANCHES={},BY_JOB={};
  function branch(base,job,kind,name,active,mastery){
    const [id,skillName,effect,attack,power,cooldown,description,extra={}]=active;
    const [passiveId,passiveName,powerPct,cooldownPct,passiveDescription]=mastery;
    actives.push({id,job,name:skillName,effect,attack,power:ranks(power),cooldown,cost:{},description,unique:true,ascension:{base,level:12},...extra});
    passives.push({id:passiveId,job,name:passiveName,effect:'branch_mastery',power:ranks(powerPct),description:passiveDescription,unique:true,ascension:{base,level:15},modifiers:{targets:[base,id],powerPct,cooldownPct}});
    const entry={id:base,ultimate:base,job,kind,name,steps:[{level:12,id},{level:15,id:passiveId}]};
    BRANCHES[base]=entry;(BY_JOB[job]||(BY_JOB[job]={}))[kind]=entry;
  }
  // Presentation chooses existing, bounded effect families. It never changes
  // collision, target count or combat rules; params below are read by the core.
  const look=(family,sound,motion,a,b)=>({family,sound,motion,colors:[a,b]});
  branch('decisive_slash','swordsman','active','破陣劍路',
    ['rift_cleaver','斷城追斬','decisive',true,560,42,'向前蓄力斬擊560%，擊中處波及附近敵人，打斷一般怪物蓄力；牆壁可阻擋。',{preparation:1.3,presentation:look('slash','slash','heavy',0xffb65c,0xfff2b0)}],
    ['warbreaker_soul','破軍劍魂',30,15,'破陣決斬、斷城追斬的傷害提高30%，兩招的冷卻縮短15%。打斷效果不重複觸發。']);
  branch('unyielding','swordsman','passive','守誓劍路',
    ['oath_counter','守誓反攻','stagger',true,340,30,'奮力反擊一名敵人，造成340%傷害並使一般怪物暈眩3秒，替重整隊伍爭取時間。',{params:{stunSeconds:3},presentation:look('impact','metal','heavy',0xffa757,0xffe8a0)}],
    ['undying_heart','不屈戰心',30,20,'不退之誓的護盾與增傷提高30%，觸發間隔縮短20%；守誓反攻的傷害提高30%、冷卻縮短20%。暈眩時間不變。']);
  branch('star_ring','mage','active','墜星術路',
    ['comet_cascade','群星墜境','starfall',true,680,62,'隕星砸向可見區域，造成680%範圍傷害；受擊怪物緩速45%，持續4秒。不能穿牆。',{preparation:1.9,params:{slowSeconds:4,slowPower:.45},presentation:look('meteor','meteor','cast',0xffaf70,0xc4a2ff)}],
    ['celestial_resonance','天穹共鳴',25,15,'星環轟擊、群星墜境的傷害提高25%，兩招的冷卻縮短15%。緩速強度與時間不變。']);
  branch('twin_stars','mage','passive','共鳴術路',
    ['prism_resonance','稜星震盪','shock',true,380,28,'向周圍放出稜星衝擊，造成380%傷害並使一般怪物暈眩2.8秒；可累積雙星共鳴。',{preparation:.8,params:{stunSeconds:2.8},presentation:look('storm','thunder','cast',0xafbaff,0xf1c0ff)}],
    ['triune_stars','三曜協奏',35,10,'雙星共鳴的追加傷害提高35%；稜星震盪的傷害提高35%、冷卻縮短10%。仍每三次有效攻擊技能觸發一次共鳴。']);
  branch('escape_line','scout','active','引路疾行',
    ['windward_march','逐風行軍','speed',false,40,55,'讓附近存活隊友移速提高40%，持續20秒。可接在安全撤離線後，幫隊伍離開危險區。',{params:{duration:20},presentation:look('aura','scan','scout',0x7ef3d5,0xc4f5ff)}],
    ['farstrider_pact','無痕遠行',30,15,'安全撤離線與逐風行軍的加速效果提高30%、冷卻縮短15%。引路線長度、持續時間與避陷阱規則不變。']);
  branch('relay_opening','scout','passive','破綻獵陣',
    ['rift_mark','裂隙標記','mark',true,290,28,'刺出290%傷害，標記敵人破綻10秒。標記期間隊伍命中更痛；背後命中也能接續破綻接力。',{params:{markSeconds:10},presentation:look('cast','metal','thrust',0xffaa80,0x91efdc)}],
    ['hunt_chain','獵陣接力',30,15,'破綻接力的隊友追加傷害提高30%、同一敵人的觸發間隔縮短15%；裂隙標記的傷害提高30%、冷卻縮短15%。']);
  branch('hero_feast','chef','active','盛宴廚路',
    ['banquet_broth','百席暖宴','soup',false,120,52,'消耗2份藥草與1份甜根莖，立刻為附近存活隊友各恢復120生命。可在盛宴的緩慢恢復之外，救急補血。',{cost:{herb:2,root:1},preparation:1,presentation:look('steam','cook','cook',0xffca6b,0xffecb6)}],
    ['lasting_banquet','餘香長宴',25,15,'迷宮盛宴的飽食、恢復與增傷效果提高25%；百席暖宴的恢復量提高25%。兩招冷卻縮短15%，持續時間不變。']);
  branch('many_flavors','chef','passive','養生廚路',
    ['nourishing_brew','暖胃護湯','barrier',false,65,40,'消耗1份藥草與1份甜根莖，給一位隊友65點護盾，最多維持五分鐘。這碗護湯不算料理食譜，不累積百味養生。',{cost:{herb:1,root:1},presentation:look('shield','cook','cook',0xffd588,0xa9edb8)}],
    ['hundred_flavor_heart','百味長養',35,20,'百味養生的恢復量與護盾提高35%、觸發間隔縮短20%；暖胃護湯的護盾提高35%、冷卻縮短20%。仍需兩種不同料理。']);
  branch('dawn_sanctuary','healer','active','曙光聖路',
    ['dawn_return','曙光續命','revive',false,90,70,'消耗3份藥草，扶起一位倒地隊友，恢復其90%最大生命。與黎明聖域搭配，先救人、再持續治療。',{cost:{herb:3},preparation:1.5,presentation:look('heal','heal','heal',0xffe9a3,0xfffbdb)}],
    ['endless_dawn','長明聖域',25,15,'黎明聖域與曙光續命的恢復量提高25%，冷卻縮短15%。不會讓聖域額外扶起第二位隊友。']);
  branch('life_covenant','healer','passive','守命聖路',
    ['covenant_ward','約定守護','ward',false,10,55,'消耗1份藥草，給一位隊友十秒守護，擋下一次一般異常狀態。這不是傷害無敵，也不取代守命之約的救命效果。',{cost:{herb:1},presentation:look('shield','shield','ward',0x92e8ed,0xe5fffa)}],
    ['eternal_covenant','不滅之約',35,20,'守命之約的救命護盾提高35%、觸發間隔縮短20%；約定守護的等待時間縮短20%、守護時間提高35%。仍只抵擋一次異常。']);
  branch('moving_fortress','smith','active','城塞鍛路',
    ['citadel_plating','要塞鍍層','fortify',false,8,65,'消耗2份硬殼，替一位隊友鍍上耐久護層，三十秒內抵銷接下來8次裝備耐久消耗。不修復已損壞裝備。',{cost:{shell:2},params:{duration:30},preparation:1.1,presentation:look('forge','forge','forge',0xffb467,0xffe2aa)}],
    ['walking_citadel','行走城塞',25,15,'移動堡壘的護盾與耐久保護次數提高25%；要塞鍍層的保護次數提高25%。兩招冷卻縮短15%，挑釁與保護時間不變。']);
  branch('artisan_soul','smith','passive','匠魂鍛路',
    ['soul_temper','鍛魂回火','repair',false,45,40,'消耗1份硬殼，修理指定隊友最耗損、但尚未損壞的一件裝備，恢復45點耐久。刻印護層不會補回；損壞裝備仍須到營地修復。',{cost:{shell:1},presentation:look('forge','forge','forge',0xffae7e,0xa6d9ff)}],
    ['masterwork_legacy','神工傳承',30,15,'匠魂刻印的耐久護層與裝備加成提高30%；鍛魂回火的修理量提高30%、冷卻縮短15%。每人仍只能保留一件刻印裝備。']);
  branch('worldtree_arrow','archer','active','世界樹弓路',
    ['worldroot_arrow','世界樹根矢','binding',true,420,35,'消耗1支箭，造成420%傷害。樹根束縛2秒，並緩速60%、持續8秒，讓隊伍有空間重整。不能穿牆。',{params:{rootSeconds:2,slowSeconds:8,slowPower:.6},preparation:1,presentation:look('thorns','thorns','bow',0x78d592,0xe0f4a0)}],
    ['evergreen_bow','永茂神弓',30,15,'世界樹之箭、世界樹根矢的傷害提高30%，冷卻縮短15%。束縛與緩速時間不變，箭矢消耗不變。']);
  branch('forest_echo','archer','passive','森影追獵',
    ['pursuit_volley','追獵三連矢','volley',true,360,30,'消耗3支箭，向前方最多三名敵人各射一箭，造成360%傷害，緩速35%、持續4秒。對已緩速敵人可接續森靈追擊。',{params:{slowSeconds:4,slowPower:.35},presentation:look('arrow','bow','bow',0x9ee6b4,0xe8fac9)}],
    ['forest_symphony','森影合奏',35,15,'森靈追擊的額外增傷提高35%；追獵三連矢的傷害提高35%、冷卻縮短15%。不增加射擊目標數，也不重複緩速。']);
  branch('hamaya','cleric','active','破魔弓路',
    ['kagura_volley','神樂連矢','volley',true,560,40,'連射三支神樂詛咒箭，合計560%，最多擊中三隻怪物並使牠們弱化；不能穿牆。',{params:{weak:1,maxTargets:3},presentation:look('arrow','bow','bow',0xf6e8ff,0xb77be6)}],
    ['hamaya_mastery','破魔奧義',30,15,'破魔矢、神樂連矢的傷害提高30%，兩招的冷卻縮短15%。詛咒效果不變。']);
  branch('shrine_favor','cleric','passive','祈願之路',
    ['kami_descent','神降','kami',false,25,70,'請神降臨：祓除附近隊友的異常，並各授予最大生命25%的護盾。',{preparation:1.3,presentation:look('shield','heal','pray',0xfff6e8,0xe0a26a)}],
    ['shrine_heart','神心',30,20,'神籤加護的減免提高30%；神降的護盾提高30%、冷卻縮短20%。']);
  branch('steel_meteor_fist','robot','active','巨拳突破',
    ['explosive_fists','爆裂雙拳','robot_double',true,560,45,'雙拳連續轟擊同一名可見敵人，合計560%傷害；僅一次耐久消耗與擊退，不穿牆。',{preparation:1.3,params:{reach:3,maxTargets:1,knockback:1.2},presentation:look('twin_fist','metal','double_punch',0x8dddf6,0xffce83)}],
    ['molten_drive','熔核動力',25,15,'鋼鐵隕拳、爆裂雙拳傷害提高25%、冷卻縮短15%；不增加目標數或控制時間。']);
  branch('kinetic_core','robot','passive','蓄能守護',
    ['mech_aid','機甲援護','mech_aid',false,35,55,'為自身提供35%最大生命護盾，並為附近指定隊友提供20%最大生命護盾；持續五分鐘，被打破提前消失，不疊加。',{params:{radius:4,shieldDuration:300,allyShield:20},presentation:look('shield','shield','core_aid',0x8adaeb,0xffdd99)}],
    ['core_resonance','護核共振',30,20,'動能護核與機甲援護的護盾、反擊傷害提高30%，触發間隔與冷卻縮短20%；不增加儲能、目標數或持續時間。']);
  const SKILLS=Object.fromEntries(actives.map(s=>[s.id,s])),PASSIVES=Object.fromEntries(passives.map(s=>[s.id,s]));
  function forJob(job){return BY_JOB[job]?Object.values(BY_JOB[job]):[];}
  function earned(base,level){return (BRANCHES[base]?.steps||[]).filter(step=>Number.isFinite(level)&&level>=step.level).map(step=>SKILLS[step.id]||PASSIVES[step.id]);}
  return freeze({version:1,actives,passives,SKILLS,PASSIVES,BRANCHES,BY_JOB,forJob,earned});
});
