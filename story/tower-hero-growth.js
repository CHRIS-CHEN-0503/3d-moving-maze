/* Story hero progression and companion policies. Pure, saved rules; no timers or DOM. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerHeroGrowth=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const copy=v=>JSON.parse(JSON.stringify(v)),num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
  const A=()=>typeof module==='object'&&module.exports?require('./tower-ascension-catalog.js'):globalThis.TowerAscensionCatalog;
  const XP_SCALE=7.5,XP=Object.freeze([... [0,70,180,350,580,860,1220,1660,2190,2810].map(n=>Math.round(n*XP_SCALE)),27500,35000,43500,53000,63000]);
  const STRATEGIES=Object.freeze({attack:{name:'積極攻擊',description:'優先輸出技能，必要時救援或治療。'},support:{name:'優先輔助',description:'優先治療、護盾與增益，再找機會攻擊。'},survive:{name:'保命優先',description:'優先救援、自保與牽制，再進行攻擊。'}});
  function setStrategy(run,id,strategy){return C().transaction(run,run.revision,n=>{const p=state(n).policies[id];if(!p||!Object.hasOwn(STRATEGIES,strategy))return {ok:false,message:'請選擇有效的隊員與策略。'};p.strategy=strategy;p.thinkLeft=0;return {ok:true,message:'戰鬥策略：'+STRATEGIES[strategy].name};});}
  const active=(id,job,name,attack,power,cooldown,effect,description,cost={})=>({id,job,name,attack,power:Array(6).fill(power),cooldown,effect,description,cost,unique:true});
  const passive=(id,job,name,power,description,unique=false)=>({id,job,name,power,description,unique});
  const actives=[
    active('decisive_slash','swordsman','破陣決斬',true,450,60,'decisive','蓄力後向前斬擊450%，中斷一般怪物蓄力；不能穿牆。'),
    active('star_ring','mage','星環轟擊',true,540,75,'star_ring','三道星光轟擊可見區域，合計540%；牆壁可阻擋。'),
    active('escape_line','scout','安全撤離線',false,25,75,'escape','已探索走道鋪六格引路線，十二秒內沿線加速25%、免一般陷阱。'),
    active('hero_feast','chef','迷宮盛宴',false,35,120,'feast','三種不同食材各一份：飽食+35、十秒恢復20%生命、全隊增傷15%四十五秒。'),
    active('dawn_sanctuary','healer','黎明聖域',false,40,120,'sanctuary','十秒治療領域恢復40%生命，施放時扶起一位隊友至30%生命。',{herb:3}),
    active('moving_fortress','smith','移動堡壘',false,100,90,'fortress','自身100%生命護盾五分鐘；十五秒持續挑釁、抵銷四次耐久消耗。挑釁上限依技能等級：一～二級一隻、三～四級兩隻、五～六級三隻；目標離開可見近處才補選。',{shell:2}),
    active('worldtree_arrow','archer','世界樹之箭',true,480,65,'great_arrow','凝聚精靈之力射出強力箭，傷害480%，並使怪物緩速；不能穿牆。'),
  ];
  const passives=[
    passive('iron_wall','swordsman','鐵壁',[1,1.5,2,2.5,3,3.5],'本人防禦增加。'),
    passive('last_stand','swordsman','逆境斬擊',[5,8,11,14,17,20],'生命低於一半時，本人傷害增加百分比。'),
    passive('spell_precision','mage','法術精準',[3,6,9,12,15,18],'本人魔法傷害增加百分比。'),
    passive('shield_mastery','mage','護盾專精',[5,10,15,20,25,30],'本人提供的護盾增加百分比。'),
    passive('hunter_eye','scout','獵手之眼',[5,10,15,20,25,30],'背後命中傷害增加百分比。'),
    passive('quick_hands','scout','迅捷雙手',[2,4,6,8,10,12],'普通攻擊間隔縮短百分比。'),
    passive('ingredient_care','chef','珍惜食材',[5,10,15,20,25,30],'料理或耗材技能有機會省下一份食材，機率為百分比。'),
    passive('food_sharing','chef','餐桌分享',[1,2,3,4,5,6],'食用料理時，每位存活隊友額外恢復生命。'),
    passive('gentle_care','healer','溫柔照護',[1,2,3,4,5,6],'本人治療技能額外恢復生命。'),
    passive('steadfast','healer','堅韌祝福',[.5,1,1.5,2,2.5,3],'持有者存活時，全隊防禦增加。'),
    passive('tempered_edge','smith','淬刃',[2,4,6,8,10,12],'本人武器傷害增加百分比。'),
    passive('sturdy_gear','smith','厚實護具',[1,1.5,2,2.5,3,3.5],'穿戴未損壞防具時，本人防禦增加。'),
    passive('longshot','archer','追獵',[5,8,11,14,17,20],'從怪物背後命中時傷害增加。'),
    passive('forest_cover','archer','林地庇蔭',[5,10,15,20,25,30],'本人受到一般陷阱傷害減少。'),
    passive('unyielding','swordsman','不退之誓',Array(6).fill(25),'生命降至30%以下：25%生命護盾五分鐘、增傷25%八秒；間隔90秒。',true),
    passive('twin_stars','mage','雙星共鳴',Array(6).fill(45),'每第三次有效攻擊技能追加45%傷害回響，不重複控制效果。',true),
    passive('relay_opening','scout','破綻接力',Array(6).fill(60),'背後命中標記六秒；下一位隊友命中增傷60%，敵人弱化四秒；每敵間隔20秒。',true),
    passive('many_flavors','chef','百味養生',Array(6).fill(30),'吃兩種不同料理：全隊回復25%生命、30%生命護盾五分鐘；間隔90秒。',true),
    passive('life_covenant','healer','守命之約',Array(6).fill(30),'附近隊友受致命怪物或一般陷阱傷害：保留1生命、30%護盾五分鐘；間隔180秒。',true),
    passive('artisan_soul','smith','匠魂刻印',Array(6).fill(20),'營地對修滿裝備花兩零件刻印：20%耐久護層；武器增傷15%或防具防禦+2。每人限一件。',true),
    passive('forest_echo','archer','森靈追擊',Array(6).fill(40),'射擊已被緩速的怪物額外增傷40%；纏枝箭與隊友的緩速都能觸發。',true),
  ];
  const itemIds=['heal','ration','shield','hourglass','bell','map','haste'];
  function policy(){return {strategy:'support',materials:false,heal:{enabled:false,threshold:30,reserve:2},shield:false,bell:false,hourglass:false,map:false,haste:false,itemLeft:0,thinkLeft:0};}
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
  function afterDamage(run,id){const h=H(),g=record(run,id);if(has(run,'unyielding',id)&&h.hp(run,id)<=h.maxHp(run,id)*.3&&g.defiance<=0){const m=modifiers(run,id,'unyielding');shield(run,id,h.maxHp(run,id)*.25*m.power);h.setBuff(run,id,'oath_power',8,25*m.power);g.defiance=90*m.cooldown;}}
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
    if(s.effect==='feast'){const keys=Object.keys(run.party.ingredients).filter(k=>run.party.ingredients[k]>0).slice(0,3);keys.forEach(k=>run.party.ingredients[k]--);run.hunger=Math.min(100,run.hunger+power(run,id,s));near.filter(k=>h.hp(run,k)>0).forEach(k=>{h.setBuff(run,k,'regen',10,h.maxHp(run,k)*.02*m.power*(id==='hero'?1+.02*(h.level(run,id)-1):1));h.setBuff(run,k,'rally',45,15*m.power);});}
    if(s.effect==='sanctuary'){const down=near.find(k=>h.hp(run,k)<=0);if(down)h.setHp(run,down,h.maxHp(run,down)*.3*m.power);h.setBuff(run,id,'sanctuary',10,1);}
  }
  function recipe(run,key){const h=H();for(const owner of h.ids(run).filter(k=>has(run,'many_flavors',k))){const g=record(run,owner),m=modifiers(run,owner,'many_flavors');if(!g.tastes.includes(key))g.tastes.push(key);if(g.tastes.length>=2&&g.tasteLeft<=0){h.ids(run).filter(id=>h.hp(run,id)>0).forEach(id=>{h.heal(run,id,h.maxHp(run,id)*.25*m.power);shield(run,id,h.maxHp(run,id)*.3*m.power,owner);});g.tastes=[];g.tasteLeft=90*m.cooldown;}}
    const bonus=h.teamPassive(run,'food_sharing');if(bonus)h.ids(run).filter(id=>h.hp(run,id)>0).forEach(id=>h.heal(run,id,bonus));
  }
  function imprint(run,id,gearId,safe){return C().transaction(run,run.revision,n=>{const h=H(),owner=h.ids(n).find(k=>has(n,'artisan_soul',k)),g=h.equipment(n,id)&&Object.values(h.equipment(n,id)).find(g=>g?.id===gearId);if(!safe||!owner||!g||g.durability!==g.maxDurability||n.party.journey.scrap<2)return {ok:false,message:'需要營地、存活的刻印鍛匠、修滿的裝備及兩份零件。'};n.party.journey.scrap-=2;const boost=modifiers(n,owner,'artisan_soul').power;state(n).imprints[id]={gearId,left:Math.ceil(g.maxDurability*.2*boost),boost};return {ok:true,message:'完成匠魂刻印'};});}
  function imprintFor(run,id,gear){const mark=state(run).imprints[id];return mark?.left>0&&mark.gearId===gear?.id?mark:null;}
  function use(run,key,id=H().state(run).active,automatic=false,revision=run.revision){return C().transaction(run,revision,n=>{const h=H(),g=state(n),p=g.policies[id];if(!p||!itemIds.includes(key)||h.hp(n,id)<=0||p.itemLeft>0||n.bag[key]<=0)return {ok:false,message:'道具不足、人物倒地或正在使用道具。'};
    if(automatic){if(id===h.state(n).active&&!g.useActive)return {ok:false,message:'目前操控人物未啟用自動道具。'};if(key==='heal'&&(!p.heal.enabled||n.bag.heal<=p.heal.reserve||h.hp(n,id)/h.maxHp(n,id)*100>p.heal.threshold))return {ok:false};if(key==='ration'&&(!g.food.enabled||n.bag.ration<=g.food.reserve||n.hunger>g.food.threshold))return {ok:false};if(!['heal','ration'].includes(key)&&!p[key])return {ok:false};}
    if(key==='heal'){if(h.hp(n,id)>=h.maxHp(n,id))return {ok:false,message:'生命已滿。'};h.heal(n,id,35);}
    if(key==='ration'){if(n.hunger>=100)return {ok:false,message:'飽食度已滿。'};n.hunger=Math.min(100,n.hunger+45*(1+h.teamPassive(n,'gourmet')/100));h.food(n,id);}
    if(key==='shield'){if(h.buff(n,'barrier',id)?.power>=h.maxHp(n,id)*.35)return {ok:false,message:'護盾仍充足。'};shield(n,id,h.maxHp(n,id)*.35);}
    if(key==='haste'){if(h.buff(n,'haste',id))return {ok:false,message:'加速藥水仍在生效，不需重複使用。'};h.setBuff(n,id,'haste',C().HASTE_DURATION,C().HASTE_PERCENT);}
    const timed={hourglass:['freeze',25],bell:['repel',20],map:['reveal',18]};if(timed[key]){const [k,t]=timed[key];if(n.effects[k]>0)return {ok:false,message:'效果仍在持續。'};n.effects[k]=t*(1+h.pv(n,'extension',id)/100);}
    n.bag[key]--;p.itemLeft=automatic?5:1;return {ok:true,message:'使用 '+C().ITEMS[key].name,effect:{item:key,actorId:id}};});}
  function autoItems(run,threats=[]){const h=H(),g=state(run),order=h.ids(run).filter(id=>h.hp(run,id)>0&&(id!==h.state(run).active||g.useActive)).sort((a,b)=>h.hp(run,a)/h.maxHp(run,a)-h.hp(run,b)/h.maxHp(run,b));
    for(const id of order){const p=g.policies[id];if(p.itemLeft>0)continue;if(p.heal.enabled&&run.bag.heal>p.heal.reserve&&h.hp(run,id)/h.maxHp(run,id)*100<=p.heal.threshold)return {id,key:'heal'};
      if(g.food.enabled&&run.hunger<=g.food.threshold&&run.bag.ration>g.food.reserve)return {id,key:'ration'};
      if(threats.includes(id)){if(p.shield&&run.bag.shield&&h.hp(run,id)<h.maxHp(run,id)*.5&&!h.buff(run,'barrier',id)?.power)return {id,key:'shield'};for(const [key,e]of [['bell','repel'],['hourglass','freeze']])if(p[key]&&run.bag[key]&&h.hp(run,id)<h.maxHp(run,id)*.3&&!run.effects[e])return {id,key};if(p.haste&&run.bag.haste&&!h.buff(run,'haste',id))return {id,key:'haste'};if(p.map&&run.bag.map&&!run.effects.reveal&&!run.engine.mapKnowledge?.revealed)return {id,key:'map'};}
    }return null;
  }
  function aiChoice(run,id,near,threat){const h=H(),a=h.actor(run,id),p=state(run).policies[id];if(!p||p.strategy==='manual'||p.thinkLeft>0||h.hp(run,id)<=0)return null;
    const low=near.filter(k=>h.hp(run,k)>0&&h.hp(run,k)<h.maxHp(run,k)*.5).sort((a,b)=>h.hp(run,a)/h.maxHp(run,a)-h.hp(run,b)/h.maxHp(run,b))[0],down=near.find(k=>h.hp(run,k)===0);
    const priorities=p.strategy==='attack'?['revive','heal','attack','barrier','guard']:p.strategy==='survive'?['revive','heal','sanctuary','barrier','guard','ward','cleanse','escape','smoke','stealth','attack']:['revive','heal','soup','sanctuary','barrier','fortress','guard','ward','rally','polish','fortify','repair','daylight','feast','meal','stomach','speed','frost','taunt','attack'];
    const skills=[...a.skills].sort((a,b)=>Number(!!h.SKILLS[b].unique)-Number(!!h.SKILLS[a].unique));
    for(const kind of priorities)for(const key of skills){const s=h.SKILLS[key];if((kind==='attack'?!s.attack:s.effect!==kind)||s.attack&&a.attack>0||a.cooldowns[key]>0||Object.keys(s.cost).length&&!p.materials||['feast','fortress'].includes(s.effect)&&!p.materials)continue;
      let target=id;if(kind==='revive'){if(!down)continue;target=down;}else if(['heal','soup','sanctuary'].includes(kind)){if(!low&&!(kind==='sanctuary'&&down))continue;target=low||down;}else if(kind==='repair'){target=near.find(k=>Object.values(h.equipment(run,k)).some(g=>g&&g.durability>0&&g.durability<g.maxDurability*.5));if(!target)continue;}else if(kind==='daylight'){if(run.party.light.daylight>0||run.party.light.cooldown>0)continue;}else if(kind==='meal'){if(run.hunger>40)continue;}else {if(!threat)continue;if(kind==='attack'&&!h.stats(run,id).weapon)continue;const keyBuff={polish:'polish',fortify:'fortify',barrier:'barrier',guard:'guard',ward:'ward',rally:'rally',stomach:'stomach',stealth:'stealth',smoke:'smoke'}[kind];if(keyBuff&&h.buff(run,keyBuff,id))continue;}
      if(s.effect==='fortress'&&run.party.journey.scrap<2||s.effect==='feast'&&(run.hunger>65||Object.values(run.party.ingredients).filter(v=>v>0).length<3))continue;
      if((s.ammo&&run.bag.arrow<s.ammo)||Object.entries(s.cost).some(([k,v])=>run.party.ingredients[k]<v))continue;return {skill:key,target};
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
    if(!recovery(g.food)||!g.policies||typeof g.policies!=='object')return null;for(const id of ids){const p=g.policies[id];if(p&&p.haste===undefined)p.haste=false;if(!p||!['manual','attack','support','survive'].includes(p.strategy)||!recovery(p.heal)||typeof p.materials!=='boolean'||!['shield','bell','hourglass','map','haste'].every(k=>typeof p[k]==='boolean')||!num(p.itemLeft,0,5)||!num(p.thinkLeft,0,5))return null;}
    g.policies=Object.fromEntries(ids.map(id=>[id,g.policies[id]]));if(!g.imprints||typeof g.imprints!=='object'||Object.keys(g.imprints).length>5)return null;for(const [id,m]of Object.entries(g.imprints))if(!ids.includes(id)||typeof m.gearId!=='string'||m.gearId.length>160||!num(m.left,0,200)||m.boost!==undefined&&!num(m.boost,1,1.3))return null;
    if(g.route!==null&&(!g.route||!num(g.route.left,0,12)||!C().isFloor(g.route.floor)||g.route.power!==undefined&&!num(g.route.power,0,100)||!Array.isArray(g.route.points)||g.route.points.length>6||!g.route.points.every(p=>num(p.x,-1000,1000)&&num(p.z,-1000,1000))))return null;
    if(!g.nearby||typeof g.nearby!=='object'||Object.entries(g.nearby).some(([id,list])=>!ids.includes(id)||!Array.isArray(list)||list.length>5||!list.every(k=>ids.includes(k))))return null;return g;
  }
  return {XP,XP_SCALE,STRATEGIES,setStrategy,actives,passives,itemIds,policy,freshRecord,fresh,state,record,progression:record,has,skillLevel,sixth,awaken,available,choose,ultimateOptions,availableUltimate,chooseUltimate,branches,modifiers,power,shield,afterDamage,beforeDamage,strikeMultiplier,consumeCost,afterCast,recipe,imprint,imprintFor,use,autoItems,aiChoice,tick,validate};
});
