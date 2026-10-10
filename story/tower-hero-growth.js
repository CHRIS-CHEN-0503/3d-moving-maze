/* Story hero progression and companion policies. Pure, saved rules; no timers or DOM. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerHeroGrowth=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const F=()=>typeof module==='object'&&module.exports?require('./tower-affixes.js'):globalThis.TowerAffixes;
  const copy=v=>JSON.parse(JSON.stringify(v)),num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
  const A=()=>typeof module==='object'&&module.exports?require('./tower-ascension-catalog.js'):globalThis.TowerAscensionCatalog;
  // Only skill restoration is rebalanced. Potions, recipe base HP, shields and
  // mechanical/equipment repairs still use their original independent rules.
  const HEALING=Object.freeze({multiplier:1.5,herbalCooldown:5,feastPercent:30,sanctuaryPercent:60,sanctuaryRevivePercent:45,manyFlavorsPercent:37.5,forestRecoveryPercent:18});
  const healingRanks=values=>values.map(value=>value*HEALING.multiplier);
  const XP_SCALE=7.5,XP=Object.freeze([... [0,70,180,350,580,860,1220,1660,2190,2810].map(n=>Math.round(n*XP_SCALE)),27500,35000,43500,53000,63000]);
  const STRATEGIES=Object.freeze({attack:{name:'積極攻擊',description:'優先輸出技能，必要時救援或治療。'},support:{name:'優先輔助',description:'優先治療、護盾與增益，再找機會攻擊。'},survive:{name:'保命優先',description:'優先救援、自保與牽制，再進行攻擊。'}});
  function setStrategy(run,id,strategy){return C().transaction(run,run.revision,n=>{const p=state(n).policies[id];if(!p||!Object.hasOwn(STRATEGIES,strategy))return {ok:false,message:'請選擇有效的隊員與策略。'};p.strategy=strategy;p.thinkLeft=0;return {ok:true,message:'戰鬥策略：'+STRATEGIES[strategy].name};});}
  const active=(id,job,name,attack,power,cooldown,effect,description,cost={})=>({id,job,name,attack,power:Array(6).fill(power),cooldown,effect,description,cost,unique:true});
  const passive=(id,job,name,power,description,unique=false)=>({id,job,name,power,description,unique});
  const actives=[
    active('decisive_slash','swordsman','破陣決斬',true,450,60,'decisive','蓄力後向前斬擊450%，中斷一般怪物蓄力；不能穿牆。'),
    active('star_ring','mage','星環轟擊',true,540,75,'star_ring','三道星光轟擊可見區域，合計540%；牆壁可阻擋。'),
    active('escape_line','scout','安全撤離線',false,25,75,'escape','已探索走道鋪六格引路線，十二秒內沿線加速25%、免一般陷阱。'),
    active('hero_feast','chef','迷宮盛宴',false,35,120,'feast','三種不同食材各一份：飽食+35、十秒恢復30%生命、全隊增傷15%四十五秒。'),
    active('dawn_sanctuary','healer','黎明聖域',false,HEALING.sanctuaryPercent,120,'sanctuary','十秒治療領域恢復60%生命，施放時扶起一位隊友至45%生命。',{herb:3}),
    active('moving_fortress','smith','移動堡壘',false,100,90,'fortress','自身100%生命護盾五分鐘；十五秒持續挑釁、抵銷四次耐久消耗。挑釁上限依技能等級：一～二級一隻、三～四級兩隻、五～六級三隻；目標離開可見近處才補選。',{shell:2}),
    active('worldtree_arrow','archer','世界樹之箭',true,480,65,'great_arrow','凝聚精靈之力射出強力箭，傷害480%，並使怪物緩速；不能穿牆。'),
    {...active('steel_meteor_fist','robot','鋼鐵隕拳',true,450,65,'robot_meteor','巨拳轟向前方八公尺內可見敵人，最多波及三體，擊退1.5公尺；樓層主不被推動。'),params:{reach:8,radius:2.4,maxTargets:3,knockback:1.5},presentation:{family:'quake',sound:'metal',motion:'ground_slam',colors:[0x93dafa,0xffc784]}},
  ];
  const passives=[
    passive('iron_wall','swordsman','鐵壁',[1,1.5,2,2.5,3,3.5],'本人防禦增加。'),
    passive('last_stand','swordsman','逆境斬擊',[5,8,11,14,17,20],'生命低於一半時，本人傷害增加百分比。'),
    passive('spell_precision','mage','法術精準',[3,6,9,12,15,18],'本人魔法傷害增加百分比。'),
    passive('shield_mastery','mage','護盾專精',[5,10,15,20,25,30],'本人提供的護盾增加百分比。'),
    passive('hunter_eye','scout','獵手之眼',[5,10,15,20,25,30],'背後命中傷害增加百分比。'),
    passive('quick_hands','scout','迅捷雙手',[2,4,6,8,10,12],'普通攻擊間隔縮短百分比。'),
    passive('ingredient_care','chef','珍惜食材',[5,10,15,20,25,30],'料理或耗材技能有機會省下一份食材，機率為百分比。'),
    passive('food_sharing','chef','餐桌分享',healingRanks([1,2,3,4,5,6]),'食用料理時，每位存活隊友額外恢復生命。'),
    passive('gentle_care','healer','溫柔照護',healingRanks([1,2,3,4,5,6]),'本人治療技能額外恢復生命。'),
    passive('steadfast','healer','堅韌祝福',[.5,1,1.5,2,2.5,3],'持有者存活時，全隊防禦增加。'),
    passive('tempered_edge','smith','淬刃',[2,4,6,8,10,12],'本人武器傷害增加百分比。'),
    passive('sturdy_gear','smith','厚實護具',[1,1.5,2,2.5,3,3.5],'穿戴未損壞防具時，本人防禦增加。'),
    passive('longshot','archer','追獵',[5,8,11,14,17,20],'從怪物背後命中時傷害增加。'),
    passive('forest_cover','archer','林地庇蔭',[5,10,15,20,25,30],'本人受到一般陷阱傷害減少。'),
    passive('unyielding','swordsman','不退之誓',Array(6).fill(25),'生命降至30%以下：25%生命護盾五分鐘、增傷25%八秒；間隔90秒。',true),
    passive('twin_stars','mage','雙星共鳴',Array(6).fill(45),'每第三次有效攻擊技能追加45%傷害回響，不重複控制效果。',true),
    passive('relay_opening','scout','破綻接力',Array(6).fill(60),'背後命中標記六秒；下一位隊友命中增傷60%，敵人弱化四秒；每敵間隔20秒。',true),
    passive('many_flavors','chef','百味養生',Array(6).fill(30),'吃兩種不同料理：全隊回復37.5%生命、30%生命護盾五分鐘；間隔90秒。',true),
    passive('life_covenant','healer','守命之約',Array(6).fill(30),'附近隊友受致命怪物或一般陷阱傷害：保留1生命、30%護盾五分鐘；間隔180秒。',true),
    passive('artisan_soul','smith','匠魂刻印',Array(6).fill(20),'營地對修滿裝備花兩零件刻印：20%耐久護層；武器增傷15%或防具防禦+2。每人限一件。',true),
    passive('forest_echo','archer','森靈追擊',Array(6).fill(40),'射擊已被緩速的怪物額外增傷40%；纏枝箭與隊友的緩速都能觸發。',true),
    passive('kinetic_core','robot','動能護核',Array(6).fill(60),'實際承受怪物傷害後儲能八秒；下次普通拳擊追加60%傷害與20%最大生命護盾五分鐘。間隔三十秒；陷阱、飢餓及完全吸收的傷害不觸發。',true),
  ];
  const itemIds=['heal','heal_mid','heal_high','spirit','forget','ration','shield','hourglass','bell','map','haste','haste_strong','arcane','courage','power_glimmer','power_starlight','power_sunheart'];
  const HEALS=['heal','heal_mid','heal_high'];
  function policy(){return {strategy:'support',materials:false,heal:{enabled:false,threshold:30,reserve:2},fuel:{enabled:false,threshold:25,reserve:0},spirit:{enabled:false,threshold:25,reserve:0},shield:false,bell:false,hourglass:false,map:false,haste:false,itemLeft:0,thinkLeft:0};}
  function freshRecord(){return {choices:[],awakening:null,tastes:[],tasteLeft:0,echo:0,defiance:0,covenant:0};}
  function fresh(ids=['hero']){return {version:2,...freshRecord(),members:Object.fromEntries(ids.filter(id=>id!=='hero').map(id=>[id,freshRecord()])),quick:['heal','ration','shield','bell'],useActive:false,food:{enabled:false,threshold:20,reserve:2},policies:Object.fromEntries(ids.map(id=>[id,policy()])),imprints:{},route:null,nearby:{}};}
  const state=run=>H().state(run).growth||(H().state(run).growth=fresh(H().ids(run)));
  const has=(run,key,id='hero')=>H().hp(run,id)>0&&H().actor(run,id)?.passives.includes(key);
  const record=(run,id='hero')=>id==='hero'?state(run):state(run).members?.[id]||null;
  const skillLevel=(run,id='hero')=>H().level(run,id)>=10?6:Math.min(5,H().level(run,id));
  function sixth(s){if(s.power.length===6)return s;const p=s.power,last=p[4],step=last-p[3];let v=last+step;if(s.id==='double_portion')v=100;if(s.id==='rescue')v=35;if(s.id==='tool_supply')v=35;if(s.effect==='disarm')v=1;if(s.effect==='cleanse')v=15;return {...s,power:[...p,v]};}
  function branches(key,level,id='hero'){return id==='hero'?(A()?.BRANCHES[key]?.steps||[]).filter(s=>level>=s.level).map(s=>s.id):[];}
  function addSkill(run,id,key){const h=H(),a=h.actor(run,id),s=h.SKILLS[key]||h.PASSIVES[key];if(!s||[...a.skills,...a.passives].includes(key))return; (s.attack!==undefined?a.skills:a.passives).push(key);if(s.attack!==undefined)a.cooldowns[key]=0;}
  // The original tower keeps its deterministic awakening; only the underground
  // campaign unlocks companion growth and player-selected ultimate branches.
  function awaken(run){const g=state(run);if(!C().isUnderworld(run)&&H().level(run,'hero')>=10&&!g.awakening){const pool=ultimateOptions(run,'hero');let n=run.seed>>>0;for(const c of 'awakening:'+H().job(run,'hero'))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;g.awakening=pool[n%2].id;addSkill(run,'hero',g.awakening);}if(C().isUnderworld(run))for(const id of H().ids(run)){const r=record(run,id);if(r?.awakening)for(const key of branches(r.awakening,H().level(run,id),id))addSkill(run,id,key);}}
  function available(run,id='hero'){const g=record(run,id),steps=id!=='hero'&&!C().isUnderworld(run)?[4]:[4,6,8];return g?Math.max(0,steps.filter(l=>H().level(run,id)>=l).length-g.choices.length):0;}
  function choose(run,key,id='hero'){return C().transaction(run,run.revision,n=>{const h=H(),s=h.SKILLS[key]||h.PASSIVES[key],a=h.actor(n,id);if(!a||!s||s.unique||s.job!==h.job(n,id)||available(n,id)<=0||[...a.skills,...a.passives].includes(key))return {ok:false,message:'請選擇尚未學會的普通職業技能。'};addSkill(n,id,key);record(n,id).choices.push(key);if(id!=='hero'&&!a.learned)a.learned=key;return {ok:true,message:'學會 '+s.name};});}
  function ultimateOptions(run,id='hero'){return H().actor(run,id)?[...actives,...passives.filter(s=>s.unique)].filter(s=>s.job===H().job(run,id)):[];}
  function availableUltimate(run,id='hero'){return C().isUnderworld(run)&&!!record(run,id)&&H().level(run,id)>=10&&!record(run,id).awakening;}
  function chooseUltimate(run,id,key){return C().transaction(run,run.revision,n=>{const s=ultimateOptions(n,id).find(s=>s.id===key);if(!availableUltimate(n,id)||!s)return {ok:false,message:'十級可選一次本職業絕技，選定後不能更換分支。'};record(n,id).awakening=key;addSkill(n,id,key);awaken(n);return {ok:true,message:'領悟 '+s.name};});}
  function modifiers(run,id,key){let power=1,cooldown=1;for(const k of H().actor(run,id)?.passives||[]){const m=H().PASSIVES[k]?.modifiers;if(m?.targets.includes(key)){power*=1+m.powerPct/100;cooldown*=1-m.cooldownPct/100;}}return {power,cooldown};}
  const power=(run,id,s)=>s.power[skillLevel(run,id)-1]*modifiers(run,id,s.id).power;
  function shield(run,id,amount,source=id){const h=H();h.setBuff(run,id,'barrier',300,amount*(1+h.pv(run,'shield_mastery',source)/100));}
  function afterDamage(run,id,damage=0,source='monster'){const h=H(),g=record(run,id);if(has(run,'unyielding',id)&&h.hp(run,id)<=h.maxHp(run,id)*.3&&g.defiance<=0){const m=modifiers(run,id,'unyielding');shield(run,id,h.maxHp(run,id)*.25*m.power);h.setBuff(run,id,'oath_power',8,25*m.power);g.defiance=90*m.cooldown;}const robot=h.actor(run,id)?.robot;if(robot&&has(run,'kinetic_core',id)&&source==='monster'&&damage>0&&robot.energyCooldown<=0){robot.energyLeft=8;robot.energyCooldown=30*modifiers(run,id,'kinetic_core').cooldown;}}
  function beforeDamage(run,id,damage,source){const h=H(),g=state(run);if(source==='trap'&&h.buff(run,'escape',id))return 0;if(damage>=h.hp(run,id)&&h.hp(run,id)>0&&['monster','trap'].includes(source)){const owner=h.ids(run).find(k=>has(run,'life_covenant',k)&&record(run,k).covenant<=0&&(id===k||g.nearby[k]?.includes(id)));if(owner){const m=modifiers(run,owner,'life_covenant');record(run,owner).covenant=180*m.cooldown;shield(run,id,h.maxHp(run,id)*.3*m.power,owner);return Math.max(0,h.hp(run,id)-1);}}return damage;}
  function strikeMultiplier(run,id,monsterId,skill,front){const h=H(),g=record(run,id),a=h.actor(run,id),e=h.state(run).enemy[monsterId]||(h.state(run).enemy[monsterId]={});let mult=1;
    if(front===false)mult*=1+(h.pv(run,'hunter_eye',id)+h.pv(run,'longshot',id))/100;
    if(has(run,'forest_echo',id)&&e.slow>0)mult*=1+.4*modifiers(run,id,'forest_echo').power;
    if(e.relay>0&&e.relayOwner!==id){mult*=1+.6*modifiers(run,e.relayOwner,'relay_opening').power;e.relay=0;e.relayWeak=4;}
    if(has(run,'relay_opening',id)&&front===false&&!e.relayCooldown){e.relay=6;e.relayOwner=id;e.relayCooldown=20*modifiers(run,id,'relay_opening').cooldown;}
    if(skill&&has(run,'twin_stars',id)){if(a.pending.echo===undefined){g.echo=(g.echo+1)%3;a.pending.echo=g.echo===0;}if(a.pending.echo)mult*=1+.45*modifiers(run,id,'twin_stars').power;}
    return mult;
  }
  function consumeCost(run,id,cost){const h=H();let saved=false;for(const[k,v]of Object.entries(cost)){let count=v;if(!saved&&h.roll(run,id,'ingredient-care')<h.pv(run,'ingredient_care',id)){count--;saved=true;}run.party.ingredients[k]-=count;}}
  function afterCast(run,id,s,near){const h=H(),m=modifiers(run,id,s.id);if(s.effect==='fortress'){shield(run,id,h.maxHp(run,id)*power(run,id,s)/100);h.setBuff(run,id,'fortress',s.params?.duration||15,1);h.setBuff(run,id,'fortify',s.params?.duration||15,Math.round(4*m.power));run.party.journey.scrap-=2;}
    if(s.effect==='feast'){const keys=Object.keys(run.party.ingredients).filter(k=>run.party.ingredients[k]>0).slice(0,3);keys.forEach(k=>run.party.ingredients[k]--);run.hunger=Math.min(100,run.hunger+power(run,id,s));near.filter(k=>h.hp(run,k)>0).forEach(k=>{h.setBuff(run,k,'regen',10,h.maxHp(run,k)*HEALING.feastPercent/100/10*m.power*(id==='hero'?1+.02*(h.level(run,id)-1):1));h.setBuff(run,k,'rally',45,15*m.power);});}
    if(s.effect==='sanctuary'){const down=near.find(k=>h.organicHealable(run,k)&&h.hp(run,k)<=0);if(down)h.setHp(run,down,h.maxHp(run,down)*HEALING.sanctuaryRevivePercent/100*m.power);h.setBuff(run,id,'sanctuary',10,1);}
  }
  function recipe(run,key){const h=H();for(const owner of h.ids(run).filter(k=>has(run,'many_flavors',k))){const g=record(run,owner),m=modifiers(run,owner,'many_flavors');if(!g.tastes.includes(key))g.tastes.push(key);if(g.tastes.length>=2&&g.tasteLeft<=0){h.ids(run).filter(id=>h.hp(run,id)>0).forEach(id=>{h.heal(run,id,h.maxHp(run,id)*HEALING.manyFlavorsPercent/100*m.power);shield(run,id,h.maxHp(run,id)*.3*m.power,owner);});g.tastes=[];g.tasteLeft=90*m.cooldown;}}
    const bonus=h.teamPassive(run,'food_sharing');if(bonus)h.ids(run).filter(id=>h.hp(run,id)>0).forEach(id=>h.heal(run,id,bonus));
  }
  function imprint(run,id,gearId,safe){return C().transaction(run,run.revision,n=>{const h=H(),owner=h.ids(n).find(k=>has(n,'artisan_soul',k)),g=h.equipment(n,id)&&Object.values(h.equipment(n,id)).find(g=>g?.id===gearId);if(!safe||!owner||!g||h.ROBOT.isCore(g)||g.durability!==g.maxDurability||n.party.journey.scrap<2)return {ok:false,message:'需要營地、存活的刻印鍛匠、修滿的普通裝備及兩份零件。'};n.party.journey.scrap-=2;const boost=modifiers(n,owner,'artisan_soul').power;state(n).imprints[id]={gearId,left:Math.ceil(g.maxDurability*.2*boost),boost};return {ok:true,message:'完成匠魂刻印'};});}
  function imprintFor(run,id,gear){const mark=state(run).imprints[id];return mark?.left>0&&mark.gearId===gear?.id?mark:null;}
  function use(run,key,id=H().state(run).active,automatic=false,revision=run.revision){return C().transaction(run,revision,n=>{const h=H(),g=state(n),p=g.policies[id];if(!p||!itemIds.includes(key)||h.hp(n,id)<=0||p.itemLeft>0||n.bag[key]<=0)return {ok:false,message:'道具不足、人物倒地或正在使用道具。'};
    const fuel=h.ROBOT.fuelItemIds.includes(key);
    if([...HEALS,'ration'].includes(key)&&!h.organicHealable(n,id))return {ok:false,message:'食物與療癒藥不能修復機器人，請使用動力核心或零件回補。'};
    if(key==='spirit'&&!h.maxMp(n,id))return {ok:false,message:'機器人沒有 MP，請用動力石補充能源。'};
    const heals=HEALS.reduce((t,k)=>t+(n.bag[k]||0),0);
    if(automatic){if(id===h.state(n).active&&!g.useActive)return {ok:false,message:'目前操控人物未啟用自動道具。'};if(HEALS.includes(key)&&(!p.heal.enabled||heals<=p.heal.reserve||h.hp(n,id)/h.maxHp(n,id)*100>p.heal.threshold))return {ok:false};if(key==='spirit'&&(!p.spirit.enabled||n.bag.spirit<=p.spirit.reserve||h.mp(n,id)/h.maxMp(n,id)*100>p.spirit.threshold))return {ok:false};if(key==='ration'&&(!g.food.enabled||n.bag.ration<=g.food.reserve||n.hunger>g.food.threshold))return {ok:false};if(fuel&&(!p.fuel.enabled||n.bag[key]<=p.fuel.reserve||h.actor(n,id)?.robot?.fuel>p.fuel.threshold))return {ok:false};if(![...HEALS,'ration','spirit'].includes(key)&&!fuel&&!p[key])return {ok:false};}
    if(fuel){const filled=h.ROBOT.fillFuel(n,key,id);if(!filled.ok)return filled;}
    if(HEALS.includes(key)){if(h.hp(n,id)>=h.maxHp(n,id))return {ok:false,message:'生命已滿。'};h.heal(n,id,C().HEAL_POTIONS[key]);}
    if(key==='spirit'){if(h.mp(n,id)>=h.maxMp(n,id))return {ok:false,message:'MP 已滿。'};h.restoreMp(n,id,C().SPIRIT_MP);}
    let refunded=0;if(key==='forget'){if(automatic)return {ok:false};refunded=h.forgetAttributes(n,id);if(!refunded)return {ok:false,message:'這位隊員還沒有分配任何自由點數。'};}
    if(key==='haste_strong'){if(h.buff(n,'haste',id)?.power>=C().HASTE_STRONG_PERCENT)return {ok:false,message:'強力加速仍在生效，不需重複使用。'};h.actor(n,id).buffs=h.actor(n,id).buffs.filter(b=>b.id!=='haste');h.setBuff(n,id,'haste',C().HASTE_DURATION,C().HASTE_STRONG_PERCENT);}
    if(key==='arcane'||key==='courage'){if(h.buff(n,key,id))return {ok:false,message:C().ITEMS[key].name+'仍在生效，不需重複使用。'};h.setBuff(n,id,key,C().POTION_BUFF_SECONDS,C().POTION_BUFF_PERCENT);}
    if(key==='ration'){if(n.hunger>=100)return {ok:false,message:'飽食度已滿。'};n.hunger=Math.min(100,n.hunger+45*(1+h.teamPassive(n,'gourmet')/100));h.food(n,id);}
    if(key==='shield'){if(h.buff(n,'barrier',id)?.power>=h.maxHp(n,id)*.35)return {ok:false,message:'護盾仍充足。'};shield(n,id,h.maxHp(n,id)*.35);}
    if(key==='haste'){if(h.buff(n,'haste',id))return {ok:false,message:'加速藥水仍在生效，不需重複使用。'};h.setBuff(n,id,'haste',C().HASTE_DURATION,C().HASTE_PERCENT);}
    const timed={hourglass:['freeze',25],bell:['repel',20],map:['reveal',18]};if(timed[key]){const [k,t]=timed[key];if(n.effects[k]>0)return {ok:false,message:'效果仍在持續。'};n.effects[k]=t*(1+h.pv(n,'extension',id)/100);}
    n.bag[key]--;p.itemLeft=automatic?5:1;return {ok:true,message:refunded?'退回 '+refunded+' 點自由點數，請重新分配能力值。':'使用 '+C().ITEMS[key].name,effect:{item:key,actorId:id,...(refunded?{refunded}:{})}};});}
  function autoItems(run,threats=[]){const h=H(),g=state(run),order=h.ids(run).filter(id=>h.hp(run,id)>0&&(id!==h.state(run).active||g.useActive)).sort((a,b)=>h.hp(run,a)/h.maxHp(run,a)-h.hp(run,b)/h.maxHp(run,b));
    for(const id of order){const p=g.policies[id];if(p.itemLeft>0)continue;if(h.job(run,id)==='robot'&&p.fuel.enabled&&h.actor(run,id).robot.fuel<=p.fuel.threshold){const key=h.ROBOT.fuelItemIds.find(key=>run.bag[key]>p.fuel.reserve);if(key)return {id,key};}
      // The smallest draught that covers most of the wound, else the strongest one in the bag.
      if(h.organicHealable(run,id)&&p.heal.enabled&&HEALS.reduce((t,k)=>t+(run.bag[k]||0),0)>p.heal.reserve&&h.hp(run,id)/h.maxHp(run,id)*100<=p.heal.threshold){const missing=h.maxHp(run,id)-h.hp(run,id),have=HEALS.filter(k=>run.bag[k]>0);const key=have.find(k=>C().HEAL_POTIONS[k]>=missing*.8)||have.at(-1);if(key)return {id,key};}
      if(h.maxMp(run,id)&&p.spirit?.enabled&&run.bag.spirit>p.spirit.reserve&&h.mp(run,id)/h.maxMp(run,id)*100<=p.spirit.threshold)return {id,key:'spirit'};
      if(h.organicHealable(run,id)&&g.food.enabled&&run.hunger<=g.food.threshold&&run.bag.ration>g.food.reserve)return {id,key:'ration'};
      if(threats.includes(id)){if(p.shield&&run.bag.shield&&h.hp(run,id)<h.maxHp(run,id)*.5&&!h.buff(run,'barrier',id)?.power)return {id,key:'shield'};for(const [key,e]of [['bell','repel'],['hourglass','freeze']])if(p[key]&&run.bag[key]&&h.hp(run,id)<h.maxHp(run,id)*.3&&!run.effects[e])return {id,key};if(p.haste&&run.bag.haste&&!h.buff(run,'haste',id))return {id,key:'haste'};if(p.map&&run.bag.map&&!run.effects.reveal&&!run.engine.mapKnowledge?.revealed)return {id,key:'map'};}
    }return null;
  }
  function skillRange(run,id,s){return s.params?.reach||s.params?.radius||(s.job==='archer'?H().stats(run,id).reach:['bolt','weak','slow','mark','thorns','starfall','star_ring'].includes(s.effect)?8:3.5);}
  function ailmentWeight(run,id){return (H().buff(run,'slow',id)?1:0)+(id===H().state(run).active&&run.party.slowLeft>0?1:0)+(F()?.list(run,id)||[]).reduce((n,s)=>n+(['burn','poison','shock'].includes(s.id)?3:2),0);}
  // Observations come from nearby unobstructed enemies. They are transient and
  // never scan the saved floor for enemies the companion cannot see.
  function usefulAttack(run,id,s,enemy){
    if(!enemy)return true;const h=H(),e=h.state(run).enemy[enemy.id]||{},f=F(),slow=e.slow>0||!!f?.has(run,enemy.id,'slow',true),root=e.root>0||!!f?.has(run,enemy.id,'root',true),stunned=run.monsterStuns[enemy.id]>0||!!f?.attackBlocked(run,enemy.id,true);
    if(!Number.isFinite(enemy.distance)||enemy.distance>skillRange(run,id,s))return false;
    if(['stun','shock','stagger'].includes(s.effect)&&(stunned||run.party.poise[enemy.id]>0))return false;
    if(['slow','binding'].includes(s.effect)&&(slow||root||enemy.stationary))return false;
    if(s.effect==='thorns'&&(root||enemy.stationary))return false;
    if(s.effect==='weak'&&(e.weak>0||e.relayWeak>0))return false;
    if((s.effect==='mark'&&e.mark>0)||(s.effect==='blind'&&e.blind>0))return false;
    return true;
  }
  function interrupts(run,id,s,enemy){return !!enemy&&enemy.windup>0&&enemy.windup>H().preparationSeconds(s.id)+(skillRange(run,id,s)>4?enemy.distance/16:0)&&(['stun','shock','stagger','decisive'].includes(s.effect)||s.effect==='blind'&&enemy.behind);}
  function aiChoice(run,id,near,threat,combat={}){const h=H(),a=h.actor(run,id),p=state(run).policies[id];if(!p||p.strategy==='manual'||p.thinkLeft>0||h.hp(run,id)<=0)return null;
    if(h.job(run,id)==='robot'&&!h.ROBOT.powered(run,id))return null;
    const low=near.filter(k=>h.organicHealable(run,k)&&h.hp(run,k)>0&&h.hp(run,k)<h.maxHp(run,k)*.5).sort((a,b)=>h.hp(run,a)/h.maxHp(run,a)-h.hp(run,b)/h.maxHp(run,b))[0],down=near.find(k=>h.organicHealable(run,k)&&h.hp(run,k)===0);
    const priorities=p.strategy==='attack'?['revive','heal','robot_restore','attack','cleanse','barrier','guard','robot_guard','mech_aid']:p.strategy==='survive'?['revive','heal','robot_restore','cleanse','sanctuary','barrier','mech_aid','guard','robot_guard','robot_speed','ward','escape','smoke','stealth','attack']:['revive','heal','robot_restore','soup','sanctuary','cleanse','barrier','mech_aid','fortress','guard','robot_guard','ward','rally','polish','fortify','repair','daylight','feast','meal','stomach','speed','robot_speed','frost','taunt','attack'];
    const skills=[...a.skills].sort((x,y)=>Number(interrupts(run,id,h.SKILLS[y],combat.enemy))-Number(interrupts(run,id,h.SKILLS[x],combat.enemy))||Number(!!h.SKILLS[y].unique)-Number(!!h.SKILLS[x].unique));
    for(const kind of priorities)for(const key of skills){const s=h.SKILLS[key];if((kind==='attack'?!s.attack:s.effect!==kind)||s.attack&&a.attack>0||a.cooldowns[key]>0||!h.mpReady(run,id,key)||Object.keys(s.cost).length&&!p.materials||['feast','fortress'].includes(s.effect)&&!p.materials)continue;
      let target=id;if(kind==='revive'){if(!down)continue;target=down;}else if(kind==='cleanse'){target=near.filter(k=>h.hp(run,k)>0&&ailmentWeight(run,k)>0).sort((x,y)=>ailmentWeight(run,y)-ailmentWeight(run,x)||h.hp(run,x)/h.maxHp(run,x)-h.hp(run,y)/h.maxHp(run,y))[0];if(!target)continue;}else if(kind==='robot_restore'){if(!p.materials||h.hp(run,id)>=h.maxHp(run,id)*.5)continue;}else if(kind==='mech_aid'){if(!threat&&!low)continue;const aid=Array.isArray(combat.aidNear)?combat.aidNear:near;target=(low&&aid.includes(low)?low:null)||aid.find(k=>k!==id&&h.hp(run,k)>0&&!h.buff(run,'barrier',k))||id;if(h.buff(run,'barrier',target)?.power>=h.maxHp(run,target)*.2&&h.buff(run,'barrier',id)?.power>=h.maxHp(run,id)*.35)continue;}else if(['heal','soup','sanctuary'].includes(kind)){if(!low&&!(kind==='sanctuary'&&down))continue;target=low||down;}else if(kind==='repair'){target=near.find(k=>Object.values(h.equipment(run,k)).some(g=>g&&!h.ROBOT.isCore(g)&&g.durability>0&&g.durability<g.maxDurability*.5));if(!target)continue;}else if(kind==='daylight'){if(run.party.light.daylight>0||run.party.light.cooldown>0)continue;}else if(kind==='meal'){if(run.hunger>40)continue;}else {if(!threat)continue;if(kind==='attack'&&(!h.stats(run,id).weapon||!usefulAttack(run,id,s,combat.enemy)))continue;const keyBuff={polish:'polish',fortify:'fortify',barrier:'barrier',guard:'guard',robot_guard:'robot_guard',robot_speed:'robot_speed',ward:'ward',rally:'rally',stomach:'stomach',stealth:'stealth',smoke:'smoke'}[kind];if(['barrier','ward','polish','fortify'].includes(kind)&&combat.threatened){const candidates=near.filter(k=>h.hp(run,k)>0&&!h.buff(run,keyBuff,k)&&(combat.threatened.includes(k)||h.hp(run,k)<h.maxHp(run,k)*.5)&&(kind!=='polish'||h.stats(run,k).weapon));target=candidates.sort((x,y)=>Number(combat.threatened.includes(y))-Number(combat.threatened.includes(x))||h.hp(run,x)/h.maxHp(run,x)-h.hp(run,y)/h.maxHp(run,y))[0];if(!target)continue;}else if(keyBuff&&h.buff(run,keyBuff,id))continue;if(['frost','smoke'].includes(kind)&&combat.enemies&&!combat.enemies.some(e=>e.distance<=5&&!(h.state(run).enemy[e.id]?.[kind==='frost'?'slow':'blind']>0)))continue;if(kind==='taunt'&&combat.enemies&&!combat.enemies.some(e=>e.distance<=5&&!(h.state(run).enemy[e.id]?.tauntLeft>0)))continue;}
      if(s.effect==='fortress'&&run.party.journey.scrap<2||s.effect==='feast'&&(run.hunger>65||Object.values(run.party.ingredients).filter(v=>v>0).length<3))continue;
      if(s.scrapCost&&(!p.materials||run.party.journey.scrap<s.scrapCost)||(s.ammo&&run.bag.arrow<s.ammo)||Object.entries(s.cost).some(([k,v])=>run.party.ingredients[k]<v))continue;return {skill:key,target};
    }return null;
  }
  function tick(run,dt){const h=H(),g=state(run);for(const id of h.ids(run))for(const key of ['tasteLeft','defiance','covenant'])record(run,id)[key]=Math.max(0,record(run,id)[key]-dt);for(const p of Object.values(g.policies)){p.itemLeft=Math.max(0,p.itemLeft-dt);p.thinkLeft=Math.max(0,p.thinkLeft-dt);}if(g.route){g.route.left=Math.max(0,g.route.left-dt);if(!g.route.left)g.route=null;}}
  function validate(value,party){const ids=['hero',...party.members.map(m=>m.id)];if(value===undefined)return fresh(ids);const g=copy(value);if(!g||![1,2].includes(g.version))return null;
    const validRecord=r=>r&&Array.isArray(r.choices)&&r.choices.length<=3&&new Set(r.choices).size===r.choices.length&&r.choices.every(k=>typeof k==='string'&&k.length<80)&&(r.awakening===null||typeof r.awakening==='string'&&r.awakening.length<80)&&Array.isArray(r.tastes)&&r.tastes.length<=Object.keys(P().RECIPES).length&&r.tastes.every(k=>Object.hasOwn(P().RECIPES,k)&&(!P().RECIPES[k].requiredDepth||party.floor<0&&-party.floor>=P().RECIPES[k].requiredDepth))&&new Set(r.tastes).size===r.tastes.length&&['tasteLeft','defiance','covenant'].every(k=>num(r[k],0,180))&&Number.isInteger(r.echo)&&num(r.echo,0,2);
    if(!validRecord(g))return null;
    if(g.version===1)g.members=Object.fromEntries(ids.filter(id=>id!=='hero').map(id=>[id,freshRecord()]));
    if(!g.members||Array.isArray(g.members)||Object.keys(g.members).length!==ids.length-1||!ids.filter(id=>id!=='hero').every(id=>Object.hasOwn(g.members,id)&&validRecord(g.members[id])))return null;
    g.version=2;
    if(!Array.isArray(g.quick)||g.quick.length!==4||!g.quick.every(k=>itemIds.includes(k)||k===null)||typeof g.useActive!=='boolean')return null;
    const recovery=p=>p&&typeof p.enabled==='boolean'&&Number.isInteger(p.threshold)&&p.threshold>=10&&p.threshold<=90&&p.threshold%5===0&&Number.isInteger(p.reserve)&&num(p.reserve,0,99);
    const fuelRecovery=p=>recovery(p)&&Object.keys(p).length===3&&Object.keys(p).every(k=>['enabled','threshold','reserve'].includes(k));
    if(!recovery(g.food)||!g.policies||typeof g.policies!=='object')return null;for(const id of ids){const p=g.policies[id];if(p&&p.haste===undefined)p.haste=false;if(p&&p.fuel===undefined)p.fuel={enabled:false,threshold:25,reserve:0};if(p&&p.spirit===undefined)p.spirit={enabled:false,threshold:25,reserve:0};if(!p||!['manual','attack','support','survive'].includes(p.strategy)||!recovery(p.heal)||!fuelRecovery(p.fuel)||!fuelRecovery(p.spirit)||typeof p.materials!=='boolean'||!['shield','bell','hourglass','map','haste'].every(k=>typeof p[k]==='boolean')||!num(p.itemLeft,0,5)||!num(p.thinkLeft,0,5))return null;}
    g.policies=Object.fromEntries(ids.map(id=>[id,g.policies[id]]));if(!g.imprints||typeof g.imprints!=='object'||Object.keys(g.imprints).length>5)return null;for(const [id,m]of Object.entries(g.imprints))if(!ids.includes(id)||typeof m.gearId!=='string'||m.gearId.length>160||!num(m.left,0,200)||m.boost!==undefined&&!num(m.boost,1,1.3))return null;
    if(g.route!==null&&(!g.route||!num(g.route.left,0,12)||!C().isFloor(g.route.floor)||g.route.power!==undefined&&!num(g.route.power,0,100)||!Array.isArray(g.route.points)||g.route.points.length>6||!g.route.points.every(p=>num(p.x,-1000,1000)&&num(p.z,-1000,1000))))return null;
    if(!g.nearby||typeof g.nearby!=='object'||Object.entries(g.nearby).some(([id,list])=>!ids.includes(id)||!Array.isArray(list)||list.length>5||!list.every(k=>ids.includes(k))))return null;return g;
  }
  return {HEALING,healingRanks,XP,XP_SCALE,STRATEGIES,setStrategy,actives,passives,itemIds,policy,freshRecord,fresh,state,record,progression:record,has,skillLevel,sixth,awaken,available,choose,ultimateOptions,availableUltimate,chooseUltimate,branches,modifiers,power,shield,afterDamage,beforeDamage,strikeMultiplier,consumeCost,afterCast,recipe,imprint,imprintFor,use,autoItems,skillRange,aiChoice,tick,validate};
});
