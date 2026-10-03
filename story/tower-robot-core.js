/* Integrated robot parts and combat metadata. No renderer, storage or timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerRobotCore=api;})(globalThis,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const E=()=>typeof module==='object'&&module.exports?require('./tower-encounters.js'):globalThis.TowerEncounters;
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const DAMAGE=[12,18,25,32,41],DEFENSE=[14,21,29,38,48],GATES=[1,3,5,8,10],FISTS=[40,50,60,70,80],SHELL=[120,160,200,240,280];
  const NAMES={robot_fists:['鋼鑄拳臂','精鐵拳臂','晶核重拳','星脈動力拳','鎮淵巨拳'],robot_shell:['巡塔機殼','精鋼機殼','晶核守護殼','星脈堡壘殼','鎮淵不朽殼']};
  const kind=(base,tier)=>base+(tier===1?'':'_t'+tier);
  const GEAR=freeze(Object.fromEntries(Object.entries(NAMES).flatMap(([base,names])=>names.map((name,i)=>{const tier=i+1,weapon=base==='robot_fists';return [kind(base,tier),{kind:kind(base,tier),baseKind:base,tier,name,slot:weapon?'weapon':'armor',type:weapon?'fists':'robot',jobs:['robot'],hands:weapon?2:0,damage:weapon?DAMAGE[i]:0,interval:weapon?1:0,reach:weapon?2.3:0,defense:weapon?0:DEFENSE[i],buyPrice:0,magicDamage:0,support:0,stunSeconds:0,requiredLevel:GATES[i],integrated:true,maxDurability:(weapon?FISTS:SHELL)[i],monsterFlat:weapon?0:Math.max(0,tier-2)}];}))));
  const isPart=value=>Object.hasOwn(GEAR,typeof value==='string'?value:value?.kind);
  function createGear(part,floor,seed,sourceId){const d=GEAR[part];if(!d||!C().isFloor(floor)||!Number.isInteger(seed)||seed<1||seed>0xffffffff||typeof sourceId!=='string'||!sourceId||sourceId.length>96)throw new RangeError('無效的機器人零件來源。');return {id:`gear:${floor}:${seed}:${sourceId}:${part}`,kind:part,slot:d.slot,name:d.name,durability:d.maxDurability,maxDurability:d.maxDurability,durabilityVersion:C().DURABILITY_VERSION,defense:d.defense,bonus:0};}
  function validateGear(g){const d=GEAR[g?.kind];if(!d||typeof g.id!=='string'||!g.id||g.id.length>160||g.slot!==d.slot||g.name!==d.name||g.maxDurability!==d.maxDurability||!Number.isInteger(g.durability)||g.durability<0||g.durability>g.maxDurability||g.durabilityVersion!==C().DURABILITY_VERSION||g.defense!==d.defense||g.bonus!==0||g.forge!==undefined)return null;return {id:g.id,kind:g.kind,slot:d.slot,name:d.name,durability:g.durability,maxDurability:g.maxDurability,durabilityVersion:g.durabilityVersion,defense:d.defense,bonus:0};}
  const repairMultiplier=part=>GEAR[typeof part==='string'?part:part?.kind]?.slot==='armor'?8:4;
  const LOOK=(family,sound,motion)=>({family,sound,motion,colors:[0x85dafa,0xffd38a]});
  const PROFILE={flying_fist:LOOK('rocket_fist','metal','punch'),iron_charge:LOOK('ram','metal','charge_run'),shoulder_quake:LOOK('quake','metal','ground_slam'),folded_guard:LOOK('shield','shield','machine_guard'),joint_oil:LOOK('lubricate','forge','maintenance'),parts_restore:LOOK('rebuild','forge','maintenance')};
  const skill=(id,name,attack,power,cooldown,effect,description,params={},extra={})=>({id,job:'robot',name,attack,power,cooldown,effect,description,cost:{},params,presentation:PROFILE[id],...extra});
  const actives=freeze([
    skill('flying_fist','重擊飛拳',true,[150,170,190,210,230,250],12,'robot_fist','拳臂飛向前方六公尺內第一個可見敵人，擊退0.8公尺；不穿牆。',{reach:6,maxTargets:1,knockback:.8}),
    skill('iron_charge','鐵塊衝鋒',true,[170,190,210,230,250,270],20,'robot_charge','沿直線衝撞3.5公尺，最多撞擊兩隻敵人，每隻僅一次，推開1.2公尺；碰牆即停。',{reach:3.5,maxTargets:2,knockback:1.2}),
    skill('shoulder_quake','肩甲震擊',true,[100,120,140,160,180,200],22,'robot_quake','震擊身旁2.4公尺內最多三隻敵人，擊退0.6公尺；牆壁可阻擋。',{radius:2.4,reach:2.4,maxTargets:3,knockback:.6}),
    skill('folded_guard','摺甲防禦',false,[30,34,38,42,46,50],28,'robot_guard','機殼收攏六秒，降低自身傷害30%～50%；期間移動速度減半。',{duration:6}),
    skill('joint_oil','關節潤滑',false,[12,15,18,21,24,27],30,'robot_speed','八秒內只提高自己的移速，不縮短攻擊、技能冷卻或準備時間。',{duration:8}),
    skill('parts_restore','零件回補',false,[18,22,26,30,34,38],45,'robot_restore','消耗一份金屬零件恢復自身生命；不修機殼耐久，不扶起倒地角色。',{}, {scrapCost:1}),
  ]);
  const passive=(id,name,power,description)=>({id,job:'robot',name,power,description});
  const passives=freeze([
    passive('robot_body','鋼鑄機體',[5,10,15,20,25,30],'最大生命一級增加五點，每個技能等級再增加五點，六級增加三十點。'),
    passive('fist_drive','重拳傳動',[3,6,9,12,15,18],'拳擊與機器人攻擊技能傷害增加。'),
    passive('stable_feet','固定足架',[15,20,25,30,35,40],'減少一般緩速時間與被擊退距離，不跳過必要機關。'),
    passive('shock_absorber','緩震結構',[10,14,18,22,26,30],'受到傷害時有機會不消耗機殼耐久，不保護拳臂。'),
    passive('power_calibration','動力校準',[10,15,20,25,30,35],'靜止一秒後，下次有效普通拳擊增傷；每六秒一次，不疊加、不強化技能。'),
  ]);
  const COSTS=freeze({2:{coins:12,scrap:2,materials:{ironore:2}},3:{coins:24,scrap:4,materials:{ironore:3,crystalshard:2}},4:{coins:40,scrap:6,materials:{starore:2,embercore:1}},5:{coins:60,scrap:8,materials:{starore:3,abyssalloy:2,embercore:1}}});
  function upgradeQuote(run,id,slot,options={}){const h=H(),g=h.equipment(run,id)?.[slot],d=GEAR[g?.kind],next=d&&GEAR[kind(d.baseKind,d.tier+1)],base=next&&COSTS[next.tier];let reason=!h.enabled(run)||h.job(run,id)!=='robot'||!d?'只有機器人的機殼與拳臂可進階。':!next?'已達第五階，不能再強化。':h.level(run,id)<next.requiredLevel?'需要人物等級 '+next.requiredLevel+'。':next.tier>3&&!C().isUnderworld(run)?'第四、五階只在地下篇開放。':g.durability===0?'先修復破損機件，再進階。':'';
    let merchant=false;if(!reason){if(options.service?.kind==='merchant'){merchant=true;const ctx=E().serviceContext(run,options.service.merchantId);if(ctx?.merchantId!=='tieLing'||!E().serviceAvailable(run,options.service,g))reason='只能請本層鐵嶺進階機件。';}else if(options.safe!==true||!P().has(run,'smith'))reason='需要安全營地與能行動的鍛匠，或請鐵嶺處理。';}
    const costs=base?{...base,materials:{...base.materials},coins:merchant?Math.ceil(base.coins*1.2):base.coins}:null,affordable=!!costs&&run.coins>=costs.coins&&run.party.journey.scrap>=costs.scrap&&Object.entries(costs.materials).every(([k,v])=>run.party.journey.materials[k]>=v);
    return {allowed:!reason,reason,affordable,actorId:id,slot,gearId:g?.id,from:d?.tier,to:next?.tier,kind:next?.kind,name:next?.name,costs,merchant};}
  function upgrade(run,id,slot,options={},revision=run.revision){return C().transaction(run,revision,n=>{const q=upgradeQuote(n,id,slot,options);if(!q.allowed)return {ok:false,message:q.reason};if(!q.affordable)return {ok:false,message:'銅幣、零件或礦材不足，尚未扣款。'};const h=H(),g=h.equipment(n,id)[slot],ratio=g.durability/g.maxDurability,next=createGear(q.kind,n.floor,n.seed,id+':robot-upgrade:'+q.to+':'+slot);next.id=g.id;next.durability=Math.max(1,Math.round(next.maxDurability*ratio));n.coins-=q.costs.coins;n.party.journey.scrap-=q.costs.scrap;for(const[k,v]of Object.entries(q.costs.materials))n.party.journey.materials[k]-=v;h.equipment(n,id)[slot]=next;return {ok:true,message:'完成 '+q.name+'，保留原本耐久比例。',effect:{robotUpgrade:true,actorId:id,slot,tier:q.to}};});}
  const freshState=()=>({fistHits:0,stationary:0,calibrationLeft:0,calibrationReady:false,energyLeft:0,energyCooldown:0});
  function validateState(v){if(v===undefined)return freshState();const keys=Object.keys(freshState());if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k))||!Number.isInteger(v.fistHits)||v.fistHits<0||v.fistHits>3||typeof v.calibrationReady!=='boolean'||!Number.isFinite(v.stationary)||v.stationary<0||v.stationary>1||!Number.isFinite(v.calibrationLeft)||v.calibrationLeft<0||v.calibrationLeft>6||!Number.isFinite(v.energyLeft)||v.energyLeft<0||v.energyLeft>8||!Number.isFinite(v.energyCooldown)||v.energyCooldown<0||v.energyCooldown>30)return null;return {...v};}
  return freeze({GEAR,actives,passives,COSTS,DAMAGE,DEFENSE,GATES,FISTS,SHELL,NAMES,isPart,kind,createGear,validateGear,repairMultiplier,upgradeQuote,upgrade,freshState,validateState});
});
