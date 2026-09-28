/* Original profession loadouts. Pure rules; no DOM, clocks, storage or network. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerHeroes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const X=()=>typeof module==='object'&&module.exports?require('./tower-expedition-core.js'):globalThis.TowerExpedition;
  const own=(o,k)=>Object.hasOwn(o,k),num=(n,a,b,int=false)=>Number.isFinite(n)&&n>=a&&n<=b&&(!int||Number.isInteger(n));
  const clone=v=>JSON.parse(JSON.stringify(v)),SLOTS=Object.freeze(['helmet','armor','weapon','shield']);
  const JOBS=Object.freeze({
    swordsman:{name:'劍士',armor:'heavy',starter:'longsword',color:'#89bce1',charIdx:2},
    mage:{name:'術士',armor:'robe',starter:'arcane_staff',color:'#c5a7f7',charIdx:3},
    scout:{name:'斥候',armor:'light',starter:'twin_daggers',color:'#8fdec4',charIdx:1},
    chef:{name:'廚師',armor:'light',starter:'cooking_pan',color:'#ffd09b',charIdx:0},
    healer:{name:'療癒師',armor:'robe',starter:'spellbook',color:'#b6e5b8',charIdx:1},
    smith:{name:'鍛匠',armor:'heavy',starter:'smith_hammer',color:'#d7ab83',charIdx:4},
  });
  const gear=(kind,name,slot,type,jobs,hands,damage,interval,reach,defense,price)=>Object.freeze({kind,name,slot,type,jobs:Object.freeze(jobs),hands,damage,interval,reach,defense,buyPrice:price,stunSeconds:0});
  const GEAR=Object.freeze(Object.fromEntries([
    gear('longsword','巡塔長劍','weapon','blade',['swordsman'],1,12,.7,2.7,0,18),
    gear('greatsword','破陣雙手劍','weapon','blade',['swordsman'],2,20,1.15,3.2,0,28),
    gear('arcane_staff','星紋法杖','weapon','staff',['mage'],2,12,.95,8,0,22),
    gear('spellbook','晨光法書','weapon','book',['healer'],2,5,1,7,0,18),
    gear('smith_hammer','鍛鐵短鎚','weapon','hammer',['smith'],1,8,.9,2.5,0,17),
    gear('warhammer','山岩重錘','weapon','hammer',['smith'],2,13,1.45,3,0,26),
    gear('cooking_pan','旅人鐵鍋','weapon','pan',['chef'],1,6,.85,2.5,0,16),
    gear('twin_daggers','逐風雙短刃','weapon','daggers',['scout'],2,8,.75,2.4,0,21),
    gear('heavy_helm','鉚釘重盔','helmet','heavy',['swordsman','smith'],0,0,0,0,3,18),
    gear('heavy_armor','分層板甲','armor','heavy',['swordsman','smith'],0,0,0,0,6,28),
    gear('light_hood','旅行皮帽','helmet','light',['chef','scout'],0,0,0,0,2,14),
    gear('light_armor','遊俠輕甲','armor','light',['chef','scout'],0,0,0,0,4,21),
    gear('rune_crown','星線法冠','helmet','robe',['mage','healer'],0,0,0,0,1,14),
    gear('robe','織光法袍','armor','robe',['mage','healer'],0,0,0,0,2,20),
    gear('buckler','木紋小圓盾','shield','shield',['swordsman','smith','chef'],1,0,0,0,2,13),
    gear('round_shield','包鐵圓盾','shield','shield',['swordsman','smith','chef'],1,0,0,0,3,19),
    gear('tower_shield','守門塔盾','shield','shield',['swordsman','smith','chef'],1,0,0,0,5,28),
  ].map(g=>[g.kind,g])));
  const skill=(id,job,name,attack,power,cooldown,effect,description,cost={})=>Object.freeze({id,job,name,attack,power:Object.freeze(power),cooldown,effect,description,cost:Object.freeze(cost)});
  const SKILLS=Object.freeze(Object.fromEntries([
    skill('wind_slash','swordsman','裂風斬',true,[140,160,180,200,220],8,'cleave','向前扇形揮砍，不能穿過牆壁。'),
    skill('stance_bash','swordsman','破勢擊',true,[80,90,100,110,120],12,'stun','盾撞或劍柄重擊，短暫擊暈。'),
    skill('whirlwind','swordsman','旋風連斬',true,[180,205,230,255,280],16,'circle','旋身連斬附近怪物；倍率是整次合計。'),
    skill('guard_stance','swordsman','守護架勢',false,[25,30,35,40,45],25,'guard','八秒內降低自身受到的傷害。'),
    skill('taunt','swordsman','挑釁護衛',false,[3,4,5,6,7],22,'taunt','吸引身旁怪物，替隊友爭取時間。'),
    skill('rally','swordsman','戰意鼓舞',false,[5,8,11,14,18],35,'rally','附近隊友十秒內攻擊增強。'),
    skill('arcane_bolt','mage','奧能飛彈',true,[150,175,200,225,250],8,'bolt','向前發射不能穿牆的奧能光彈。'),
    skill('thunder_wave','mage','雷光震盪',true,[70,85,100,115,130],18,'shock','周圍小範圍傷害與短暫暈眩。'),
    skill('starfall','mage','星隕術',true,[200,225,250,275,300],25,'starfall','蓄力後轟擊前方可見的小範圍。'),
    skill('frost_field','mage','寒霜結界',false,[20,25,30,35,40],26,'frost','六秒內使附近怪物緩速。'),
    skill('barrier','mage','護身結界',false,[10,15,20,25,30],30,'barrier','替指定隊友吸收傷害，最多十秒。'),
    skill('daylight','mage','日光術',false,[3,3.5,4,4.5,5],600,'daylight','照亮迷宮十分鐘，等級提升照明範圍。'),
    skill('backstab','scout','背身突襲',true,[70,80,90,100,110],10,'blind','干擾怪物轉向；背後命中可中斷蓄力。'),
    skill('throw_blade','scout','牽制飛刃',true,[45,55,65,75,85],10,'slow','投出飛刃，使怪物短暫緩速。'),
    skill('path_eye','scout','探路之眼',false,[3,4,5,6,7],25,'reveal','短暫看見附近陷阱與通道，不永久揭露地圖。'),
    skill('disarm','scout','拆解陷阱',false,[3,2.6,2.2,1.8,1.4],12,'disarm','靠近一般陷阱後拆除，受傷或移動會中斷。'),
    skill('stealth','scout','潛行步',false,[6,8,10,12,14],30,'stealth','降低被察覺距離，攻擊後解除。'),
    skill('smoke','scout','煙幕掩護',false,[3,4,5,6,7],30,'smoke','煙幕降低附近怪物的視野。'),
    skill('pan_bash','chef','平底鍋敲擊',true,[50,60,70,80,90],13,'stun','向前敲擊，使怪物短暫暈眩。'),
    skill('soup_splash','chef','熱湯潑灑',true,[30,40,50,60,70],13,'splash','前方小範圍潑灑，傷害並使怪物緩速。'),
    skill('quick_meal','chef','隨手料理',false,[18,22,26,30,35],25,'meal','甜根莖補充全隊飽食度。',{root:1}),
    skill('warm_soup','chef','暖胃濃湯',false,[6,9,12,15,18],40,'soup','恢復附近隊員的生命。',{root:1,herb:1}),
    skill('snack','chef','打氣點心',false,[4,6,8,10,12],40,'speed','附近隊員二十秒內移動加快。',{root:1,nectar:1}),
    skill('stomach_meal','chef','養胃餐',false,[15,20,25,30,35],45,'stomach','三十秒內減少全隊飽食消耗。',{root:1,mushroom:1}),
    skill('light_bolt','healer','淨光彈',true,[50,60,70,80,90],10,'weak','光彈使怪物下一次攻擊變弱。'),
    skill('repel_wave','healer','驅散震波',true,[30,40,50,60,70],18,'repel','推開身邊怪物，不能推穿牆壁。'),
    skill('herbal_heal','healer','草藥療癒',false,[20,25,30,35,40],25,'heal','一份香草治療指定隊友。',{herb:1}),
    skill('cleanse','healer','淨化之手',false,[30,27,24,21,18],30,'cleanse','解除一般緩速與異常，不移除必要機關。'),
    skill('revive','healer','援起夥伴',false,[15,20,25,30,35],100,'revive','扶起一名附近倒地隊友。',{herb:2}),
    skill('blessing','healer','庇護祝福',false,[12,16,20,24,28],40,'ward','抵擋下一次一般異常，不能抵消直接傷害。'),
    skill('hammer_bash','smith','鍛錘重擊',true,[80,90,100,110,120],12,'stagger','使怪物失衡，延後下一次出手。'),
    skill('weak_pin','smith','破綻飛釘',true,[30,40,50,60,70],12,'mark','留下弱點，讓後續攻擊更有效。'),
    skill('repair','smith','應急修補',false,[2,3,4,5,6],30,'repair','修復指定隊員的一件裝備。',{shell:1}),
    skill('reinforce','smith','臨時加固',false,[1,2,3,4,5],40,'fortify','三十秒內抵銷數次裝備耐久消耗。',{shell:1}),
    skill('barricade','smith','架設路障',false,[20,28,36,44,52],35,'barricade','放置怪物可擊破的臨時路障，最多一座。',{shell:1}),
    skill('polish','smith','武器磨礪',false,[8,11,14,17,20],40,'polish','指定隊友的武器二十秒內增傷。',{shell:1}),
  ].map(s=>[s.id,s])));
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
    passive('nourishment','chef','慢火養生',[2,3,4,5,6],'本人進食後十秒內緩慢恢復生命。'),
    passive('herbalism','healer','草藥專精',[5,10,15,20,25],'本人施放的治療更有效。'),
    passive('rescue','healer','救援本能',[80,70,60,50,40],'可自動施放自己擁有的治療或扶起技能；仍需材料。'),
    passive('purity','healer','淨化體質',[10,15,20,25,30],'本人受到的緩速等負面狀態較短。'),
    passive('tool_supply','smith','工具補給',[90,75,65,55,45],'補充一個普通破障工具，不能破壞章末封印。'),
    passive('economy','smith','節省工料',[10,20,30,40,50],'營地修理與鍛造較便宜。'),
    passive('care','smith','精工養護',[10,15,20,25,30],'本人裝備有機會不消耗耐久。'),
  ].map(s=>[s.id,s])));
  function scale(skill){const s=typeof skill==='string'?(SKILLS[skill]||PASSIVES[skill]):skill;if(s.attack)return {label:'傷害倍率',unit:'%'};const units={guard:['減傷','%'],taunt:['持續','秒'],rally:['增傷','%'],frost:['緩速','%'],barrier:['吸收傷害','點'],daylight:['照明半徑','格'],reveal:['探查半徑','格'],disarm:['拆除作業','秒'],stealth:['持續','秒'],smoke:['持續','秒'],meal:['恢復飽食','點'],soup:['恢復生命','點'],speed:['加速','%'],stomach:['降低飽食消耗','%'],weak:['弱化','%'],heal:['恢復生命','點'],cleanse:['冷卻','秒'],revive:['恢復最大生命','%'],ward:['保護時限','秒'],repair:['恢復耐久','點'],fortify:['保護耐久消耗','次'],barricade:['路障生命','點'],polish:['增傷','%']},special={intuition:['路線提示','秒'],rescue:['自動救援間隔','秒'],tool_supply:['工具補充間隔','秒'],nourishment:['十秒合計恢復生命','點']};const v=units[s.effect]||special[s.id]||['效果','%'];return {label:v[0],unit:v[1]};}
  const state=run=>run?.party?.loadouts||null,enabled=run=>!!state(run);
  const ids=run=>['hero',...run.party.members.map(m=>m.id)];
  const job=(run,id=state(run)?.active||'hero')=>id==='hero'?run.party.profession:run.party.members.find(m=>m.id===id)?.profession;
  const level=(run,id=state(run)?.active||'hero')=>id==='hero'?state(run)?.level||1:run.party.members.find(m=>m.id===id)?.level||1;
  const actor=(run,id=state(run)?.active)=>state(run)?.actors[id];
  const maxHp=(run,id=state(run)?.active||'hero')=>id==='hero'?C().MAX_HP:28+level(run,id)*6;
  const hp=(run,id)=>id===state(run)?.active?run.hp:id==='hero'?state(run).heroHp:run.party.members.find(m=>m.id===id)?.hp||0;
  const equipment=(run,id=state(run)?.active)=>id===state(run)?.active?run.equipment:actor(run,id)?.equipment;
  const pv=(run,key,id=state(run)?.active)=>actor(run,id)?.passives.includes(key)?PASSIVES[key].power[level(run,id)-1]:0;
  const teamPassive=(run,key)=>enabled(run)?Math.max(0,...ids(run).filter(id=>hp(run,id)>0).map(id=>pv(run,key,id))):0;
  const buff=(run,key,id=state(run)?.active)=>actor(run,id)?.buffs.find(b=>b.id===key&&b.left>0)||null;
  function setBuff(run,id,key,left,power=0){const a=actor(run,id),old=buff(run,key,id);if(old&&['rally','speed','polish','barrier','fortify','stomach','ward','path_eye','daylight'].includes(key)){left=Math.max(left,old.left);power=Math.max(power,old.power);}a.buffs=a.buffs.filter(b=>b.id!==key);a.buffs.push({id:key,left,power});}
  function hash(seed,text){let h=seed>>>0;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  function roll(run,id,salt){const a=actor(run,id);return hash(run.seed,id+':'+salt+':'+a.roll++)%100;}
  function draft(seed,profession,identity){
    const skills=Object.values(SKILLS).filter(s=>s.job===profession),sets=[];
    for(let i=0;i<skills.length;i++)for(let j=i+1;j<skills.length;j++)for(let k=j+1;k<skills.length;k++){
      const group=[skills[i],skills[j],skills[k]];
      if(group.some(s=>s.attack)&&group.some(s=>!s.attack)&&(profession!=='healer'||group.some(s=>['herbal_heal','revive'].includes(s.id))))sets.push(group.map(s=>s.id));
    }
    const passives=Object.values(PASSIVES).filter(s=>s.job===profession).map(s=>s.id),omit=hash(seed,identity+':passives')%3;
    return {skills:sets[hash(seed,identity+':skills')%sets.length],passives:passives.filter((_,i)=>i!==omit)};
  }
  function makeActor(run,id,profession){
    const draw=draft(run.seed,profession,id==='hero'?'hero':profession),j=JOBS[profession],head={heavy:'heavy_helm',light:'light_hood',robe:'rune_crown'}[j.armor],body={heavy:'heavy_armor',light:'light_armor',robe:'robe'}[j.armor];
    const make=kind=>C().createGear(kind,run.floor,run.seed,id+':starter:'+kind);
    return {...draw,equipment:{helmet:make(head),armor:make(body),weapon:make(j.starter),shield:GEAR[j.starter].hands===1?make('buckler'):null},cooldowns:Object.fromEntries(draw.skills.map(s=>[s,0])),buffs:[],attack:0,hurt:0,tool:0,autoLeft:0,autoRescue:false,roll:0,pending:null};
  }
  function preview(run,offer){return makeActor(run,offer.id,offer.profession);}
  function enable(run){return C().transaction(run,run.revision,n=>{
    if(!n.party||state(n))return {ok:false,message:'請先選職業，或繼續既有職業旅程。'};
    n.party.loadouts={version:1,active:'hero',level:1,xp:0,heroHp:n.hp,switchLeft:0,actors:{},enemy:{},removedTraps:[]};
    for(const id of ids(n))state(n).actors[id]=makeActor(n,id,job(n,id));
    n.equipment=actor(n,'hero').equipment;actor(n,'hero').equipment=null;n.charIdx=JOBS[job(n)].charIdx;
    n.gearBag=[];n.engine.shovels=0;n.engine.shovelCooldownMs=0;
    return {ok:true,message:'三個主動、兩個被動技能已確定。',effect:{loadouts:true}};
  });}
  function addMember(run,member){if(enabled(run))state(run).actors[member.id]=makeActor(run,member.id,member.profession);}
  function removeMember(run,id){if(!enabled(run))return true;if(id===state(run).active)return false;delete state(run).actors[id];for(const e of Object.values(state(run).enemy))if(e.tauntId===id){delete e.tauntId;delete e.tauntLeft;}return true;}
  function sync(run){if(!enabled(run))return;const s=state(run);run.hp=Math.min(maxHp(run),run.hp);if(s.active==='hero')s.heroHp=run.hp;else{const m=run.party.members.find(m=>m.id===s.active);if(m)m.hp=run.hp;}}
  function setHp(run,id,value){value=Math.max(0,Math.min(maxHp(run,id),value));if(id===state(run).active)run.hp=value;if(id==='hero')state(run).heroHp=value;else run.party.members.find(m=>m.id===id).hp=value;}
  function switchRaw(run,id){const s=state(run);sync(run);const nextHp=hp(run,id);actor(run).equipment=run.equipment;run.equipment=actor(run,id).equipment;actor(run,id).equipment=null;s.active=id;run.hp=nextHp;run.charIdx=JOBS[job(run,id)].charIdx;s.switchLeft=1;sync(run);}
  function switchActor(run,id,revision){return C().transaction(run,revision,n=>{
    if(!enabled(n)||!ids(n).includes(id)||id===state(n).active||hp(n,id)<=0)return {ok:false,message:'請選擇仍能行動的其他隊友。'};
    if(state(n).switchLeft>0)return {ok:false,message:'正在交接隊伍，稍等一下。'};
    const from=state(n).active;switchRaw(n,id);return {ok:true,message:'改由'+JOBS[job(n)].name+'帶隊。',effect:{switched:true,from,to:id}};
  });}
  function followerRecords(run){if(!enabled(run))return run.party.members;return ids(run).filter(id=>id!==state(run).active).map(id=>({id,profession:job(run,id),level:level(run,id),hp:hp(run,id),cooldown:actor(run,id).attack,hurtLeft:actor(run,id).hurt}));}
  function allGear(run){return [...run.gearBag,...Object.values(run.equipment).filter(Boolean),...(enabled(run)?Object.values(state(run).actors).flatMap(a=>Object.values(a.equipment||{}).filter(Boolean)):[])];}
  function canEquip(run,id,gear){
    const d=GEAR[gear?.kind];if(!d||!actor(run,id)||!d.jobs.includes(job(run,id)))return false;
    return !(d.slot==='shield'&&GEAR[equipment(run,id)?.weapon?.kind]?.hands===2);
  }
  function equip(run,id,gearId,revision){return C().transaction(run,revision,n=>{
    if(!enabled(n)||!ids(n).includes(id))return {ok:false,message:'找不到這位隊員。'};
    const g=allGear(n).find(g=>g.id===gearId);if(!g||!canEquip(n,id,g))return {ok:false,message:'這個職業或雙手武器無法配戴這件裝備。'};
    const target=equipment(n,id);if(target[g.slot]?.id===g.id)return {ok:false,message:'已經穿戴這件裝備。'};
    const bagIndex=n.gearBag.findIndex(x=>x.id===gearId),owner=ids(n).find(k=>equipment(n,k)?.[g.slot]?.id===gearId);
    const returned=[target[g.slot],...(g.slot==='weapon'&&GEAR[g.kind].hands===2?[target.shield]:[])].filter(Boolean);
    if(n.gearBag.length-(bagIndex>=0?1:0)+returned.length>24)return {ok:false,message:'背包空間不足，先留位置放回原裝備與盾牌。'};
    if(bagIndex>=0)n.gearBag.splice(bagIndex,1);else if(owner)equipment(n,owner)[g.slot]=null;else return {ok:false,message:'裝備已被移動，請重新查看。'};
    n.gearBag.push(...returned);if(g.slot==='weapon'&&GEAR[g.kind].hands===2)target.shield=null;target[g.slot]=g;
    return {ok:true,message:'已裝備 '+g.name,effect:{equipped:g,actorId:id}};
  });}
  function unequip(run,id,slot,revision){return C().transaction(run,revision,n=>{
    if(!enabled(n)||!ids(n).includes(id)||!SLOTS.includes(slot)||!equipment(n,id)[slot])return {ok:false,message:'這個位置沒有裝備。'};
    if(n.gearBag.length>=24)return {ok:false,message:'裝備背包已滿。'};
    const gear=equipment(n,id)[slot];n.gearBag.push(gear);equipment(n,id)[slot]=null;return {ok:true,message:'卸下 '+gear.name};
  });}
  function stats(run,id=state(run)?.active){
    const e=equipment(run,id)||{},w=e.weapon,d=GEAR[w?.kind],armor=Object.values(e).filter(Boolean).reduce((n,g)=>n+g.defense,0),robes=Object.values(e).filter(g=>g&&GEAR[g.kind]?.type==='robe').length;
    return {damage:(d?.damage||3)+(w?.bonus||0)*2,interval:Math.max(.35,(d?.interval||.9)-(w?.forge?.trait==='light'?w.forge.level*.08:0)),reach:d?.reach||2.3,hands:d?.hands||0,armor,mitigation:Math.min(.45,armor/(armor+20)),magic:robes*.04,heal:robes*.05,weapon:w};
  }
  function wear(run,id,g){if(!g)return;const protect=buff(run,'fortify',id);if(protect?.power>0){protect.power--;return;}if(roll(run,id,'wear')<pv(run,'care',id))return;X().wear(run,g);if(g.durability<=0)equipment(run,id)[g.slot]=null;}
  function damageReduction(run,id,amount,source){
    if(source==='hunger')return amount;let reduction=stats(run,id).mitigation;
    if(id===state(run).active&&run.effects.shield>0)reduction=1-(1-reduction)*.35;
    if(buff(run,'intercept',id))reduction=1-(1-reduction)*(1-pv(run,'guard_instinct',id)/100);
    if(buff(run,'guard',id))reduction=1-(1-reduction)*(1-buff(run,'guard',id).power/100);
    if(source==='trap')amount=Math.max(0,amount-Object.values(equipment(run,id)).filter(g=>g?.forge?.trait==='grip').reduce((s,g)=>s+g.forge.level,0));
    if(source==='trap')reduction=1-(1-reduction)*(1-teamPassive(run,'trap_sense')/100)*(run.party.buffs.some(b=>b.id==='trail')?.5:1);
    if(run.party.buffs.some(b=>b.id==='guard'))amount=Math.max(0,amount-2);
    let result=Math.max(amount>0?1:0,Math.ceil(amount*(1-Math.min(.65,reduction))));
    const shield=buff(run,'barrier',id);if(shield){const absorbed=Math.min(result,shield.power);result-=absorbed;shield.power-=absorbed;}
    return result;
  }
  function hurt(run,id,amount,source='monster'){
    const a=actor(run,id);if(!a||!num(amount,0,10000))return {ok:false,message:'無效的受傷目標。'};
    if(a.hurt>0||hp(run,id)<=0)return {ok:true,message:'',effect:{damage:0,broken:[],source}};
    const damage=damageReduction(run,id,amount,source),before=Object.values(equipment(run,id)).filter(Boolean),broken=[];
    if(damage>0){a.hurt=2;setHp(run,id,hp(run,id)-damage);if(source!=='hunger')for(const slot of ['helmet','armor','shield']){const g=equipment(run,id)[slot];if(g){wear(run,id,g);if(!g.durability)broken.push(g);}}}
    let revived=false,switched=false;
    if(hp(run,id)===0&&id===state(run).active){
      if(run.bag.feather>0){run.bag.feather--;setHp(run,id,Math.min(40,maxHp(run,id)));revived=true;}
      else {const next=ids(run).find(k=>k!==id&&hp(run,k)>0);if(next){switchRaw(run,next);switched=true;}else run.status='dead';}
    }
    return {ok:true,message:hp(run,id)===0?'隊友倒下了，靠近後可以救援。':'受到攻擊。',effect:{damage,broken,source,revived,switched,from:id,to:state(run).active,target:id===state(run).active?'player':'companion',defense:before.reduce((n,g)=>n+g.defense,0)}};
  }
  function heal(run,id,amount){const before=hp(run,id);setHp(run,id,before+amount);return hp(run,id)-before;}
  function gainXp(run,amount){const s=state(run);s.xp=Math.min(100000,s.xp+amount);const next=[0,70,180,350,580].filter(x=>s.xp>=x).length;s.level=Math.max(s.level,next);for(const m of run.party.members){const old=m.level,before=hp(run,m.id);m.level=Math.max(m.level,next);if(before>0)setHp(run,m.id,before+(m.level-old)*6);}sync(run);}
  function strike(run,monsterId,options={},revision){return C().transaction(run,revision,n=>{
    const id=options.memberId||state(n)?.active,a=actor(n,id),spec=P().monsterSpecs(n).find(m=>m.id===monsterId);
    if(!a||hp(n,id)<=0||!spec||n.defeatedMonsters.includes(monsterId))return {ok:false,message:'前方沒有可攻擊的怪物。'};
    const skill=options.skillId?SKILLS[options.skillId]:null;
    if(options.skillId&&!skill)return {ok:false,message:'不存在的技能。'};
    if(skill&&(!a.skills.includes(skill.id)||!skill.attack))return {ok:false,message:'沒有這個攻擊技能。'};
    if(skill&&(!a.pending||a.pending.id!==skill.id||a.pending.left<=0||a.pending.targets.includes(monsterId)))return {ok:false,message:'請先施放技能，同一次施放不能重複命中。'};
    if(!skill&&a.attack>0)return {ok:false,message:'正在收招。'};
    const st=stats(n,id),l=level(n,id),status=state(n).enemy[monsterId]||{},boost=(buff(n,'rally',id)?.power||0)+(buff(n,'polish',id)?.power||0);
    let damage=((skill?a.pending.damage:st.damage)+(n.party.buffs.some(b=>b.id==='focus')?3:0))*(skill?skill.power[l-1]/100:1+pv(n,'might',id)/100)*(1+boost/100)*(1+(status.mark>0?.1:0));
    if(['mage','healer'].includes(job(n,id)))damage*=1+st.magic;
    if(spec.kind==='crab'&&options.front===true)damage*=.55;
    if(skill?.effect==='blind'&&options.front===false)damage*=1.25;
    damage=Math.max(1,Math.round(damage));a.attack=st.interval;a.buffs=a.buffs.filter(b=>b.id!=='stealth');
    const w=st.weapon;if(w&&(!skill||!a.pending.worn))wear(n,id,w);if(skill){a.pending.worn=true;a.pending.targets.push(monsterId);}
    const remaining=Math.max(0,(n.party.health[monsterId]??spec.maxHp)-damage);n.party.health[monsterId]=remaining;
    let stunned=false;const effect=skill?.effect;
    if(['stun','shock','stagger'].includes(effect)&&!n.party.poise[monsterId]){
      n.monsterStuns[monsterId]=Math.min(2.4,1+l*.25);n.party.poise[monsterId]=Math.min(5,n.monsterStuns[monsterId]+3);stunned=true;
    }
    const enemy=state(n).enemy[monsterId]||(state(n).enemy[monsterId]={}),duration=(2+l*.4)*(1+pv(n,'resonance',id)/100);
    if(['slow','splash'].includes(effect)){enemy.slow=duration;enemy.slowPower=.2+l*.04;}
    if(effect==='blind')enemy.blind=duration;if(effect==='weak')enemy.weak=.15+l*.04;if(effect==='mark')enemy.mark=6;
    if(remaining===0){n.defeatedMonsters.push(monsterId);delete n.party.health[monsterId];delete n.party.poise[monsterId];delete n.monsterStuns[monsterId];delete state(n).enemy[monsterId];n.coins=Math.min(999999,n.coins+8+spec.strength*2);for(const[k,v]of Object.entries(P().MONSTERS[spec.kind]?.drop||{shell:1}))n.party.ingredients[k]=Math.min(99,n.party.ingredients[k]+v);gainXp(n,5+spec.strength*2);}
    return {ok:true,message:remaining===0?'擊敗 '+spec.def.name:'命中 '+spec.def.name,effect:{target:'monster',targetId:monsterId,damage,hp:remaining,dead:remaining===0,stunned,repel:effect==='repel',broken:w?.durability===0?w:null}};
  });}
  function cast(run,skillId,options={},revision){return C().transaction(run,revision,n=>{
    const id=options.actorId||state(n)?.active,a=actor(n,id),s=SKILLS[skillId];
    if(!a||hp(n,id)<=0||!s||!a.skills.includes(skillId))return {ok:false,message:'這位人物沒有這個技能。'};
    if(s.attack&&a.attack>0)return {ok:false,message:'正在收招，稍等一下。'};
    if(a.cooldowns[skillId]>0)return {ok:false,message:'技能還在準備中。'};
    const l=level(n,id),power=s.power[l-1],near=(options.nearby||ids(n)).filter(k=>ids(n).includes(k)),target=options.targetId||id;
    if(!near.includes(target))return {ok:false,message:'隊友太遠，請先靠近。'};
    if(s.attack&&!stats(n,id).weapon)return {ok:false,message:'武器已損壞，先換上專用武器。'};
    if(Object.entries(s.cost).some(([k,v])=>n.party.ingredients[k]<v))return {ok:false,message:'材料不足：'+Object.entries(s.cost).map(([k,v])=>P().INGREDIENTS[k]+' '+v).join('、')};
    const effect={skill:skillId,kind:s.effect,actorId:id,targetId:target,power,level:l,attack:s.attack};
    if(['heal','barrier','ward','fortify','polish','repair'].includes(s.effect)&&hp(n,target)<=0)return {ok:false,message:'這位隊友需要先被扶起。'};
    if(s.effect==='meal'&&n.hunger>=100)return {ok:false,message:'大家還很飽，先留著食材。'};
    if(s.effect==='heal'&&hp(n,target)>=maxHp(n,target))return {ok:false,message:'生命已滿，不需要消耗香草。'};
    if(s.effect==='revive'&&hp(n,target)>0)return {ok:false,message:'這位隊友沒有倒下。'};
    if(s.effect==='daylight'&&n.party.light.cooldown>0)return {ok:false,message:'日光術仍在持續。'};
    let repairGear=null;if(s.effect==='repair'){repairGear=Object.values(equipment(n,target)).filter(g=>g&&g.durability<g.maxDurability).sort((a,b)=>a.durability/a.maxDurability-b.durability/b.maxDurability)[0];if(!repairGear)return {ok:false,message:'沒有需要修補的裝備。'};}
    if(s.effect==='polish'&&!stats(n,target).weapon)return {ok:false,message:'請先裝備武器。'};
    if(s.effect==='soup'&&!near.some(k=>hp(n,k)>0&&hp(n,k)<maxHp(n,k)))return {ok:false,message:'附近隊友的生命都已全滿。'};
    for(const[k,v]of Object.entries(s.cost))n.party.ingredients[k]-=v;
    a.cooldowns[skillId]=s.effect==='daylight'?600:(s.effect==='cleanse'?power:s.cooldown)*(1-pv(n,'recovery',id)/100);
    if(s.attack){a.pending={id:skillId,left:3,damage:stats(n,id).damage,targets:[],worn:false};a.attack=stats(n,id).interval;}
    const healing=1+pv(n,'herbalism',id)/100+stats(n,id).heal;
    if(s.effect==='guard')setBuff(n,id,'guard',8,power);
    if(s.effect==='barrier')setBuff(n,target,'barrier',10,power);
    if(s.effect==='ward')setBuff(n,target,'ward',power,1);
    if(s.effect==='rally')near.filter(k=>hp(n,k)>0).forEach(k=>setBuff(n,k,'rally',10,power));
    if(s.effect==='speed')near.filter(k=>hp(n,k)>0).forEach(k=>setBuff(n,k,'speed',20,power));
    if(s.effect==='polish')setBuff(n,target,'polish',20,power);
    if(s.effect==='fortify')setBuff(n,target,'fortify',30,power);
    if(['stealth','smoke'].includes(s.effect))setBuff(n,id,s.effect,power,power);
    if(s.effect==='stomach')setBuff(n,id,'stomach',30,power);
    if(s.effect==='meal'){n.hunger=Math.min(100,n.hunger+power*(1+teamPassive(n,'gourmet')/100));food(n,id);}
    if(s.effect==='heal')heal(n,target,power*healing);
    if(s.effect==='soup')near.filter(k=>hp(n,k)>0).forEach(k=>heal(n,k,power*healing));
    if(s.effect==='revive')setHp(n,target,Math.ceil(maxHp(n,target)*power/100));
    if(s.effect==='repair')repairGear.durability=Math.min(repairGear.maxDurability,repairGear.durability+power);
    if(s.effect==='reveal')setBuff(n,id,'path_eye',8,power);
    if(s.effect==='cleanse'){actor(n,target).buffs=actor(n,target).buffs.filter(b=>b.id!=='slow');setBuff(n,target,'ward',3,1);if(target===state(n).active)n.party.slowLeft=0;}
    if(s.effect==='daylight'){n.party.light.daylight=600;n.party.light.cooldown=600;setBuff(n,id,'daylight',600,power);}
    sync(n);return {ok:true,message:s.name,effect};
  });}
  function food(run,id=state(run)?.active){const power=pv(run,'nourishment',id);if(power)setBuff(run,id,'regen',10,power/10);}
  function speed(run,id=state(run)?.active){return (1+pv(run,'fleet',id)/100+(buff(run,'speed',id)?.power||0)/100)*(buff(run,'slow',id)?.power||1);}
  function inflict(run,id,key,seconds,power){const ward=buff(run,'ward',id);if(ward?.power>0){ward.power=0;ward.left=0;return false;}setBuff(run,id,key,seconds*(1-pv(run,'purity',id)/100),power);return true;}
  function hungerScale(run){return Math.max(.4,(1-teamPassive(run,'endurance')/100)*(1-Math.max(0,...ids(run).filter(id=>hp(run,id)>0).map(id=>buff(run,'stomach',id)?.power||0))/100));}
  function toolSpent(run){if(!enabled(run))return;run.engine.shovels=Math.max(0,run.engine.shovels-1);for(const id of ids(run)){const cd=pv(run,'tool_supply',id);if(cd)actor(run,id).tool=cd;}}
  function rescueChoice(run,id,nearby=ids(run)){const a=actor(run,id);if(!a?.autoRescue||!pv(run,'rescue',id)||a.autoLeft>0||hp(run,id)<=0)return null;for(const skill of ['revive','herbal_heal']){if(!a.skills.includes(skill)||a.cooldowns[skill]>0||Object.entries(SKILLS[skill].cost).some(([k,v])=>run.party.ingredients[k]<v))continue;const target=nearby.find(k=>ids(run).includes(k)&&(skill==='revive'?hp(run,k)===0:hp(run,k)>0&&hp(run,k)<maxHp(run,k)*.5));if(target)return {skill,target};}return null;}
  function tick(run,dt){if(!enabled(run))return;const s=state(run);s.switchLeft=Math.max(0,s.switchLeft-dt);
    for(const id of ids(run)){const a=actor(run,id);if(a.pending){a.pending.left-=dt;if(a.pending.left<=0)a.pending=null;}for(const key of ['attack','hurt','tool','autoLeft'])a[key]=Math.max(0,a[key]-dt);for(const key of a.skills)a.cooldowns[key]=Math.max(0,a.cooldowns[key]-dt);for(const b of a.buffs){if(b.id==='regen'&&hp(run,id)>0)heal(run,id,Math.min(dt,b.left)*b.power);b.left=Math.max(0,b.left-dt);}a.buffs=a.buffs.filter(b=>b.left>0);
      if(pv(run,'tool_supply',id)&&hp(run,id)>0&&a.tool===0&&run.engine.shovels<1){run.engine.shovels=1;a.tool=pv(run,'tool_supply',id);}
    }
    for(const e of Object.values(s.enemy))for(const key of ['slow','blind','mark','tauntLeft'])if(e[key])e[key]=Math.max(0,e[key]-dt);sync(run);
  }
  function advance(run){if(!enabled(run))return;state(run).enemy={};state(run).removedTraps=[];gainXp(run,8);}
  const BUFFS=['guard','barrier','ward','rally','speed','polish','fortify','stealth','smoke','stomach','regen','daylight','slow','intercept','path_eye'];
  function validate(value,party){
    if(!value||value.version!==1||!num(value.level,1,5,true)||!num(value.xp,0,100000,true)||!num(value.heroHp,0,60)||!num(value.switchLeft,0,1))return null;
    const expected=['hero',...party.members.map(m=>m.id)];if(!expected.includes(value.active)||!value.actors||Array.isArray(value.actors)||Object.keys(value.actors).length!==expected.length)return null;
    const actors={};for(const id of expected){
      const a=value.actors[id],profession=id==='hero'?party.profession:party.members.find(m=>m.id===id).profession;
      if(!a||!Array.isArray(a.skills)||a.skills.length!==3||new Set(a.skills).size!==3||!a.skills.every(s=>own(SKILLS,s)&&SKILLS[s].job===profession)||!a.skills.some(s=>SKILLS[s].attack)||!a.skills.some(s=>!SKILLS[s].attack))return null;
      if(profession==='healer'&&!a.skills.some(s=>['herbal_heal','revive'].includes(s)))return null;
      if(!Array.isArray(a.passives)||a.passives.length!==2||new Set(a.passives).size!==2||!a.passives.every(s=>own(PASSIVES,s)&&PASSIVES[s].job===profession))return null;
      if(!a.cooldowns||Object.keys(a.cooldowns).length!==3||!a.skills.every(s=>own(a.cooldowns,s)&&num(a.cooldowns[s],0,600)))return null;
      if(!num(a.attack,0,5)||!num(a.hurt,0,2)||!num(a.tool,0,90)||!num(a.autoLeft,0,180)||!num(a.roll,0,Number.MAX_SAFE_INTEGER-1,true)||typeof a.autoRescue!=='boolean')return null;
      if(!Array.isArray(a.buffs)||a.buffs.length>BUFFS.length||new Set(a.buffs.map(b=>b.id)).size!==a.buffs.length||!a.buffs.every(b=>BUFFS.includes(b.id)&&num(b.left,0,600)&&num(b.power,0,100)))return null;
      let gear=null;if(id!==value.active){if(!a.equipment||Object.keys(a.equipment).length!==4)return null;gear={};for(const slot of SLOTS){const g=a.equipment[slot];if(g===null)gear[slot]=null;else{const v=C().validateGear(g),d=GEAR[v?.kind];if(!v||v.slot!==slot||!d?.jobs.includes(profession))return null;gear[slot]=v;}}if(GEAR[gear.weapon?.kind]?.hands===2&&gear.shield)return null;}else if(a.equipment!==null)return null;
      const p=a.pending;if(p&&(!a.skills.includes(p.id)||!SKILLS[p.id].attack||!num(p.left,0,3)||!num(p.damage,0,100)||typeof p.worn!=='boolean'||!Array.isArray(p.targets)||p.targets.length>6||new Set(p.targets).size!==p.targets.length||!p.targets.every(t=>/^monster-[0-5]$/.test(t))))return null;
      actors[id]={skills:[...a.skills],passives:[...a.passives],equipment:gear,cooldowns:{...a.cooldowns},buffs:a.buffs.map(b=>({id:b.id,left:b.left,power:b.power})),attack:a.attack,hurt:a.hurt,tool:a.tool,autoLeft:a.autoLeft,autoRescue:a.autoRescue,roll:a.roll,pending:p?clone(p):null};
    }
    if(!value.enemy||Array.isArray(value.enemy)||Object.keys(value.enemy).length>6)return null;
    const enemy={};for(const[k,e]of Object.entries(value.enemy)){if(!/^monster-[0-5]$/.test(k)||!e||Object.keys(e).some(key=>!['slow','slowPower','blind','weak','mark','tauntLeft','tauntId'].includes(key))||Object.entries(e).some(([key,v])=>key==='tauntId'?!expected.includes(v):!num(v,0,60)))return null;enemy[k]={...e};}
    if(!Array.isArray(value.removedTraps)||value.removedTraps.length>30||!value.removedTraps.every(s=>typeof s==='string'&&s.length<100))return null;
    return {removedTraps:[...value.removedTraps],version:1,active:value.active,level:value.level,xp:value.xp,heroHp:value.heroHp,switchLeft:value.switchLeft,actors,enemy};
  }
  function validEquipment(run){if(!enabled(run))return true;const seen=new Set();for(const g of allGear(run)){if(seen.has(g.id))return false;seen.add(g.id);}const e=run.equipment,j=job(run);return Object.values(e).filter(Boolean).every(g=>GEAR[g.kind]?.jobs.includes(j))&&!(GEAR[e.weapon?.kind]?.hands===2&&e.shield);}
  return Object.freeze({JOBS,GEAR,SKILLS,PASSIVES,SLOTS,scale,state,enabled,ids,job,level,actor,maxHp,hp,equipment,pv,teamPassive,buff,setBuff,draft,preview,enable,addMember,removeMember,sync,setHp,switchActor,followerRecords,allGear,canEquip,equip,unequip,stats,wear,hurt,heal,gainXp,strike,cast,food,speed,inflict,hungerScale,toolSpent,rescueChoice,tick,advance,validate,validEquipment,roll});
});
