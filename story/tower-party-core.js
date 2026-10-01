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
  const Re=()=>typeof module==='object'&&module.exports?require('./tower-reinforcements.js'):globalThis.TowerReinforcements;
  const own=(o,k)=>Object.hasOwn(o,k), num=(v,a,b,int=false)=>Number.isFinite(v)&&v>=a&&v<=b&&(!int||Number.isInteger(v));
  const PROFESSIONS=Object.freeze({
    swordsman:{name:'劍士',person:'蒼衡',gender:'male',color:0x5594c1,skill:'守護架勢',description:'近戰傷害較高。技能：六秒內減傷一半；劍士隊友會替你攔下近身怪物。',cooldown:20},
    mage:{name:'術士',person:'露彌',gender:'female',color:0xb196e8,skill:'震盪結界',description:'技能：擊退附近怪物，使牠們短暫暈眩。另可在照明工具中施放十分鐘的日光術；術士隊友也能協助照明。',cooldown:22},
    scout:{name:'斥候',person:'巧栗',gender:'female',color:0x68bead,skill:'探路之眼',description:'探路與避險專家。技能：顯示出口路線十八秒，獲得六秒陷阱保護。隊中有斥候時，陷阱傷害減少四分之一。',cooldown:25},
    chef:{name:'廚師',person:'禾谷',gender:'male',color:0xe6ac65,skill:'隨手料理',description:'烹飪一次可做兩份。技能：用一份根莖恢復飽食度，照顧整支隊伍。',cooldown:25},
    healer:{name:'療癒師',person:'澄音',gender:'female',color:0x88c69f,skill:'草藥療癒',description:'技能：消耗一份香草恢復生命。隊友在你受重傷時也會使用香草救援。',cooldown:25},
    smith:{name:'鍛匠',person:'砧岳',gender:'male',color:0xbf936e,skill:'應急修補',description:'裝備修復專家。技能：用一份硬殼修復穿戴的裝備。隊中有鍛匠時，營地修理與鍛造費減半。',cooldown:25},
    archer:{name:'射手',person:'嵐羽',gender:'female',color:0xc8bc79,skill:'鷹眼巡望',description:'精靈弓手，擅長遠程射擊、牽制怪物與帶領隊伍穿行迷宮。弓是雙手武器，不能配盾。',cooldown:25},
  });
  const NAMES=Object.freeze({swordsman:{male:'蒼衡',female:'瑟琳'},mage:{male:'星嵐',female:'露彌'},scout:{male:'逐杉',female:'巧栗'},chef:{male:'禾谷',female:'杏桃'},healer:{male:'沐川',female:'澄音'},smith:{male:'砧岳',female:'鐵薇'},archer:{male:'風梢',female:'嵐羽'}});
  const person=(job,gender=PROFESSIONS[job]?.gender)=>NAMES[job]?.[gender]||PROFESSIONS[job]?.person||'旅人';
  const sex=(run,id='hero')=>id==='hero'?(run.party.sex||PROFESSIONS[run.party.profession].gender):run.party.members.find(m=>m.id===id)?.sex||PROFESSIONS[run.party.members.find(m=>m.id===id)?.profession]?.gender;
  const recruitLimit=run=>run.party?.loadouts?Math.min(3,H().level(run,'hero')):3;
  const INGREDIENTS=Object.freeze({root:'甜根莖',mushroom:'月傘菇',herb:'香草',nectar:'花蜜',meat:'蟹肉',shell:'硬殼'});
  const RECIPES=Object.freeze({
    stew:{name:'根莖菇菇燉鍋',cost:{root:2,mushroom:1},hp:8,hunger:35},
    broth:{name:'香草暖湯',cost:{herb:2,root:1},hp:24,hunger:15},
    skewer:{name:'蜜烤菇串',cost:{nectar:1,mushroom:2},hp:0,hunger:35,buff:'focus'},
    crab:{name:'香煎蟹肉',cost:{meat:2,herb:1},hp:10,hunger:40,buff:'guard'},
    soup:{name:'蜜根熱湯',cost:{root:2,nectar:1},hp:16,hunger:30},
    bento:{name:'旅人飯盒',cost:{root:2,meat:1},hp:0,hunger:55,team:10},
    salad:{name:'發光香草沙拉',cost:{herb:1,mushroom:1},hp:12,hunger:20,buff:'trail'},
    feast:{name:'團聚大餐',cost:{root:2,mushroom:2,meat:2,nectar:1},hp:25,hunger:60,team:35},
  });
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
  const has=(run,job)=>run.party&&(run.party.loadouts?H().ids(run).some(id=>H().job(run,id)===job&&H().hp(run,id)>0):run.party.profession===job||run.party.members.some(m=>m.profession===job&&m.hp>0));
  const memberMax=m=>m.id==='hero'?60:28+m.level*6;
  const newBoss=floor=>X().newBoss(floor);
  function enable(run,profession,gender=PROFESSIONS[profession]?.gender){
    const next=C().validateSave(run);if(!next||!own(PROFESSIONS,profession)||next.party||!['male','female'].includes(gender))return {ok:false,run,message:'請選擇有效的冒險職業與外觀。'};
    const guard=next.warrior;
    next.party={version:1,profession,sex:gender,members:[],joined:[],ingredients:{root:3,mushroom:2,herb:2,nectar:0,meat:0,shell:1},meals:emptyStock(RECIPES),buffs:[],cooldown:0,guardLeft:0,trapWard:0,slowLeft:0,health:{},poise:{},boss:newBoss(next.floor),journey:X().newJourney(next.floor)};
    if(L())next.party.light=L().newState();
    next.party.loot=Loot().fresh();next.party.reinforcements=Re().fresh();
    if(guard){const m={id:guard.offerId,profession:'swordsman',sex:'male',level:guard.strength,hp:28+guard.strength*6,cooldown:0,hurtLeft:0};next.party.members.push(m);next.party.joined.push(m.id);}
    next.warrior=null;next.revision++;
    return {ok:true,run:next,message:guard?'原有護衛已成為劍士隊友，不必重新支付費用。':'冒險職業已選定。'};
  }
  function validate(value,floor,defeated,contracts=[]){
    // v1.37 used guard.id rather than offerId during a legacy upgrade. Repair
    // only the unambiguous single-contract shape; never guess a missing party.
    if(value?.journey===undefined&&value?.members?.length===1&&value.members[0]?.profession==='swordsman'&&value.members[0].id==null&&value.joined?.length===1&&value.joined[0]===null&&contracts.length===1)value={...value,members:[{...value.members[0],id:contracts[0]}],joined:[contracts[0]]};
    if(!value||value.version!==1||!own(PROFESSIONS,value.profession)||value.sex!==undefined&&!['male','female'].includes(value.sex))return null;
    const gender=value.sex||PROFESSIONS[value.profession].gender;
    const stock=(v,defs)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===Object.keys(defs).length&&Object.keys(defs).every(k=>num(v[k],0,99,true));
    if(!stock(value.ingredients,INGREDIENTS)||!stock(value.meals,RECIPES))return null;
    if(!Array.isArray(value.joined)||value.joined.length>100||new Set(value.joined).size!==value.joined.length||!value.joined.every(id=>typeof id==='string'&&id.length>0&&id.length<=80))return null;
    if(!Array.isArray(value.members)||value.members.length>3||new Set(value.members.map(m=>m?.id)).size!==value.members.length)return null;
    const members=[];
    for(const m of value.members){if(!m||!value.joined.includes(m.id)||!own(PROFESSIONS,m.profession)||m.sex!==undefined&&!['male','female'].includes(m.sex)||!num(m.level,1,5,true)||!num(m.hp,0,memberMax(m))||!num(m.cooldown,0,30)||!num(m.hurtLeft,0,2))return null;members.push({id:m.id,profession:m.profession,sex:m.sex||PROFESSIONS[m.profession].gender,level:m.level,hp:m.hp,cooldown:m.cooldown,hurtLeft:m.hurtLeft});}
    if(!Array.isArray(value.buffs)||value.buffs.length>2||new Set(value.buffs.map(b=>b?.id)).size!==value.buffs.length||!value.buffs.every(b=>b&&own(BUFFS,b.id)&&num(b.floors,1,3,true)))return null;
    for(const k of ['cooldown','guardLeft','trapWard','slowLeft'])if(!num(value[k],0,30))return null;
    const dict=(v,max)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=C().MAX_MONSTERS&&Object.keys(v).every(id=>C().validMonsterId(id)&&!defeated.includes(id)&&num(v[id],0,max));
    if(!dict(value.health,240)||!dict(value.poise,5))return null;
    const loot=Loot()?.validate(value.loot,floor,defeated),reinforcements=Re()?.validate(value.reinforcements,floor);if(!loot||!reinforcements)return null;
    const boss=X().validateBoss(value.boss,floor,value.journey===undefined),journey=X().validateJourney(value.journey,floor);
    if(value.light!==undefined&&!L())return null; // Never silently discard saved fuel if a script failed to load.
    const light=L()?.validate(value.light,floor);
    if(boss===undefined||!journey||L()&&!light)return null;
    const loadouts=value.loadouts===undefined?undefined:H()?.validate(value.loadouts,{profession:value.profession,members});
    if(value.loadouts!==undefined&&!loadouts)return null;
    return {version:1,profession:value.profession,sex:gender,members,joined:[...value.joined],ingredients:{...value.ingredients},meals:{...value.meals},buffs:value.buffs.map(b=>({...b})),cooldown:value.cooldown,guardLeft:value.guardLeft,trapWard:value.trapWard,slowLeft:value.slowLeft,health:{...value.health},poise:{...value.poise},boss,journey,loot,reinforcements,...(light?{light}:{}),...(loadouts?{loadouts}:{})};
  }
  function transact(run,revision,fn){return C().transaction(run,revision,next=>!next.party?{ok:false,message:'尚未選擇冒險職業。'}:fn(next,next.party));}
  function recruitOffer(run){
    const modern=!!run.party?.loadouts,h=hash(run.seed,`recruit:${run.floor}`), early=modern?[99,97,95,93,91,89,87]:[99,97,95,93,91,89];
    if(!early.includes(run.floor)&&h%100>=45)return null;
    const jobs=Object.keys(PROFESSIONS).filter(j=>modern||j!=='archer'),job=jobs[early.includes(run.floor)?early.indexOf(run.floor):h%jobs.length],level=Math.min(5,1+Math.floor((99-run.floor)/22));
    const id=`companion:${run.floor}:${run.seed}`;
    // Each profession is one named traveller, not a new person on every floor.
    // Resting/downed members still belong to the party. Preserve the seeded
    // offer instead of rerolling it when the player recruits or dismisses someone.
    if(run.party?.joined.includes(id)||run.party?.members.some(m=>m.profession===job))return null;
    return {id,profession:job,sex:modern?(hash(run.seed,id+':sex')%2?'female':'male'):PROFESSIONS[job].gender,level,price:8+level*4};
  }
  function recruit(run,id,revision){return transact(run,revision,(n,p)=>{
    const offer=recruitOffer(n);if(!offer||offer.id!==id||p.joined.includes(id))return {ok:false,message:'這位旅人已經離開，或已受過你的邀請。'};
    if(p.members.length>=recruitLimit(n))return {ok:false,message:'目前可招募 '+recruitLimit(n)+' 人；主角一、二、三級分別開放一、二、三個隊友名額。'};
    if(p.members.some(m=>m.profession===offer.profession))return {ok:false,message:'隊伍已有這個職業的同伴，留個位置給不同專長的旅人吧。'};
    if(n.coins<offer.price)return {ok:false,message:'銅幣不足，先探索其他通道吧。'};
    n.coins-=offer.price;const member={id,profession:offer.profession,sex:offer.sex,level:offer.level,hp:28+offer.level*6,cooldown:0,hurtLeft:0};p.members.push(member);p.joined.push(id);if(p.loadouts)H().addMember(n,member);
    return {ok:true,message:`${person(offer.profession,offer.sex)}加入隊伍。`};
  });}
  function dismiss(run,id,revision){return transact(run,revision,(n,p)=>{const m=p.members.find(m=>m.id===id);if(!m)return {ok:false,message:'這位同伴不在隊伍中。'};if(p.loadouts){if(p.loadouts.active===id)return {ok:false,message:'先切換另一位隊員帶隊，再與他道別。'};const gear=Object.values(H().equipment(n,id)).filter(Boolean);if(n.gearBag.length+gear.length>24)return {ok:false,message:'先清出背包空間，保留同伴的裝備。'};n.gearBag.push(...gear);H().removeMember(n,id);}p.members=p.members.filter(m=>m.id!==id);return {ok:true,message:'與'+person(m.profession,m.sex)+'道別了。'};});}
  function gather(run,source,id,revision){return transact(run,revision,(n,p)=>{
    if(!/^s\d{1,2}$/.test(source)||!own(INGREDIENTS,id)||n.claimed.includes(source))return {ok:false,message:'這份材料已經採集過了。'};
    if(p.ingredients[id]>=99)return {ok:false,message:'材料袋已滿。'};p.ingredients[id]++;n.claimed.push(source);return {ok:true,message:`獲得${INGREDIENTS[id]}。`};
  });}
  function cook(run,id,revision){return transact(run,revision,(n,p)=>{
    if(!own(RECIPES,id))return {ok:false,message:'沒有這份食譜。'};const r=RECIPES[id],chance=p.loadouts?H().teamPassive(n,'double_portion'):0,amount=p.loadouts?(chance>0&&H().roll(n,p.loadouts.active,'cook')<chance?2:1):has(n,'chef')?2:1;
    if(p.meals[id]+amount>99)return {ok:false,message:'料理盒已滿。'};
    if(Object.entries(r.cost).some(([k,v])=>p.ingredients[k]<v))return {ok:false,message:'食材還不夠，再去找找吧。'};
    if(p.loadouts){const chef=H().ids(n).find(k=>H().hp(n,k)>0&&H().pv(n,'ingredient_care',k)>0)||p.loadouts.active;G().consumeCost(n,chef,r.cost);}else for(const[k,v]of Object.entries(r.cost))p.ingredients[k]-=v;p.meals[id]+=amount;return {ok:true,message:`完成${r.name}，共${amount}份。`};
  });}
  function eat(run,id,revision){return transact(run,revision,(n,p)=>{
    if(!own(RECIPES,id)||!p.meals[id])return {ok:false,message:'料理盒裡沒有這道料理。'};const r=RECIPES[id];
    n.hp=Math.min(p.loadouts?H().maxHp(n):C().MAX_HP,n.hp+r.hp);n.hunger=Math.min(100,n.hunger+r.hunger*(p.loadouts?1+H().teamPassive(n,'gourmet')/100:1));if(r.team){if(p.loadouts)H().ids(n).filter(k=>k!==p.loadouts.active&&H().hp(n,k)>0).forEach(k=>H().heal(n,k,r.team));else p.members.forEach(m=>m.hp=Math.min(memberMax(m),m.hp+r.team));}if(p.loadouts){H().food(n);G().recipe(n,id);}
    if(r.buff){p.buffs=p.buffs.filter(b=>b.id!==r.buff);p.buffs.push({id:r.buff,floors:3});if(p.buffs.length>2)p.buffs.shift();}
    p.meals[id]--;return {ok:true,message:`享用${r.name}。`};
  });}
  function camp(run,action,revision){return transact(run,revision,(n,p)=>{
    if(action==='rest'){
      if(p.loadouts?!H().ids(n).some(id=>H().hp(n,id)<H().maxHp(n,id)):!p.members.some(m=>m.hp<memberMax(m)))return {ok:false,message:'同伴們的狀態很好。'};
      if(n.bag.ration<1)return {ok:false,message:'休息需要一份乾糧。'};n.bag.ration--;if(p.loadouts)H().ids(n).forEach(id=>H().setHp(n,id,H().maxHp(n,id)));else p.members.forEach(m=>m.hp=memberMax(m));return {ok:true,message:'大家分享乾糧，恢復了精神。'};
    }
    if(action!=='repair')return {ok:false,message:'未知的營地服務。'};
    const cost=p.loadouts?Math.ceil(6*(1-H().teamPassive(n,'economy')/100)):has(n,'smith')?3:6;if(n.coins<cost)return {ok:false,message:'修理費不足。'};
    const gear=(p.loadouts?H().ids(n).flatMap(id=>Object.values(H().equipment(n,id)).filter(Boolean)):Object.values(n.equipment).filter(Boolean)).filter(g=>g.durability>0);if(!gear.some(g=>g.durability<g.maxDurability))return {ok:false,message:'沒有可保養的裝備；完全損壞請到鍛匠工坊修復。'};
    n.coins-=cost;gear.forEach(g=>g.durability=Math.min(g.maxDurability,g.durability+Math.round(4*C().durabilityMultiplier(g.kind))));return {ok:true,message:'已保養穿戴中的裝備，破損裝備需另行修復。'};
  });}
  function defs(){return {...C().MONSTERS,...MONSTERS,...B().defs()};}
  function monsterSpecs(run){
    const f=run.floor,config=C().floorConfig(f,run.seed),count=config.monsterCount;
    const pool=f>=90?['mushroom','clockmite']:f>=70?['mushroom','crab','moth','clockmite']:['mushroom','crab','moth','flower',...config.monsterTypes];
    const result=Array.from({length:count},(_,i)=>{const kind=pool[hash(run.seed,`monster:${f}:${i}`)%pool.length],def=defs()[kind],strength=Math.min(5,def.strength+config.monsterStrengthBonus);return {id:`monster-${i}`,kind,def,strength,maxHp:18+strength*8+Math.floor((99-f)/8)};});
    const lord=B().spec(run);if(lord)result.push(lord);return result.concat(Re().specs(run));
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
  function hurtMember(run,id,amount,revision){if(run.party?.loadouts)return transact(run,revision,n=>H().hurt(n,id,amount));return transact(run,revision,(n,p)=>{
    const m=p.members.find(x=>x.id===id);if(!m||m.hp<=0||!num(amount,0,100))return {ok:false,message:'無效的隊友傷害。'};
    if(m.hurtLeft>0)return {ok:true,message:'',effect:{target:'companion',damage:0}};const damage=Math.max(1,amount-m.level);m.hp=Math.max(0,m.hp-damage);m.hurtLeft=2;return {ok:true,message:m.hp===0?`${PROFESSIONS[m.profession].person}需要休息！帶他回營地或分享料理。`:'劍士擋下了攻擊。',effect:{target:'companion',damage,down:m.hp===0}};
  });}
  function skill(run,revision,skillId){if(run.party?.loadouts)return H().cast(run,skillId||H().actor(run).skills[0],{},revision);return transact(run,revision,(n,p)=>{
    if(p.cooldown>0)return {ok:false,message:'技能還在準備中。'};const j=p.profession;
    if(j==='chef'){if(!p.ingredients.root)return {ok:false,message:'需要一份甜根莖。'};if(n.hunger>=100)return {ok:false,message:'肚子還很飽。'};p.ingredients.root--;n.hunger=Math.min(100,n.hunger+25);}
    if(j==='healer'){if(!p.ingredients.herb)return {ok:false,message:'需要一份香草。'};if(n.hp>=C().MAX_HP)return {ok:false,message:'生命已滿。'};p.ingredients.herb--;n.hp=Math.min(C().MAX_HP,n.hp+20);}
    if(j==='smith'){const gear=Object.values(n.equipment).filter(g=>g&&g.durability<g.maxDurability);if(!gear.length)return {ok:false,message:'沒有需要修補的裝備。'};if(!p.ingredients.shell)return {ok:false,message:'需要一份硬殼。'};p.ingredients.shell--;gear.forEach(g=>g.durability=Math.min(g.maxDurability,g.durability+3));}
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
  function advance(next){if(!next.party)return;L()?.advance(next);if(next.party.loadouts)H().advance(next);const p=next.party;p.health={};p.poise={};p.loot=Loot().fresh();p.reinforcements=Re().fresh();p.boss=newBoss(next.floor);p.journey={...X().newJourney(next.floor),scrap:p.journey?.scrap||0};p.buffs=p.buffs.map(b=>({...b,floors:b.floors-1})).filter(b=>b.floors>0);p.slowLeft=0;}
  const canDescend=run=>(!run.party?.boss||run.party.boss.done)&&B().defeated(run);
  const bossPhase=run=>X().phase(run),mirrorTarget=(run,index)=>X().target(run,index),bossAction=(run,index,revision)=>X().bossAction(run,index,revision);
  return Object.freeze({PROFESSIONS,NAMES,person,sex,recruitLimit,INGREDIENTS,RECIPES,BUFFS,MONSTERS,BOSS_FLOORS,enable,validate,has,memberMax,recruitOffer,recruit,dismiss,gather,cook,eat,camp,defs,monsterSpecs,strike,hurtMember,skill,reduceDamage,tick,advance,canDescend,bossPhase,mirrorTarget,bossAction});
});
