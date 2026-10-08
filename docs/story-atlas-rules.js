/* Read-only atlas adapter: catalog values always come from the shipped game rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StoryAtlasRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const moduleFor=(file,name)=>{
    if(typeof module==='object'&&module.exports){const value=require('../story/'+file+'.js');return value[name]||globalThis[name]||value;}
    return globalThis[name];
  };
  const H=()=>moduleFor('tower-heroes-core','TowerHeroes'),C=()=>moduleFor('story-core','TowerCore'),P=()=>moduleFor('tower-party-core','TowerPartyCore');
  const G=()=>moduleFor('tower-hero-growth','TowerHeroGrowth'),A=()=>moduleFor('tower-ascension-catalog','TowerAscensionCatalog');
  const F=()=>moduleFor('tower-field-guide','TowerFieldGuide'),I=()=>moduleFor('tower-heroes-icons','TowerHeroIcons'),R=()=>moduleFor('tower-party-runtime','TowerPartyRuntime');
  const E=()=>moduleFor('tower-encounters','TowerEncounters'),X=()=>moduleFor('tower-expedition-core','TowerExpedition');
  const FI=()=>moduleFor('tower-forge-icons','TowerForgeIcons');
  const TR=()=>moduleFor('tower-recruitment','TowerRecruitment');
  const Robot=()=>moduleFor('tower-robot-core','TowerRobotCore');
  const Affixes=()=>moduleFor('tower-affixes','TowerAffixes');
  const row=(label,value)=>({label,value:String(value)}),fmt=n=>Number(n.toFixed(2)).toString(),series=(a,unit)=>a.map(fmt).join('／')+unit;
  const valid=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
  const armorNames={heavy:'重裝',light:'輕裝',robe:'法袍',shield:'盾牌',robot:'一體式機殼',robot_core:'動力核心'},slotNames={helmet:'頭部',armor:'身體',shield:'副手盾牌',weapon:'武器',core:'動力核心'};
  const targetEffects=['heal','revive','barrier','ward','repair','fortify','polish','cleanse'];
  function skillAccess(s){
    if(s.ascension)return '僅地下篇主角 '+s.ascension.level+' 級，自動沿「'+(H().SKILLS[s.ascension.base]||H().PASSIVES[s.ascension.base]).name+'」路線獲得；同伴不會取得。';
    if(s.unique)return '十級覺醒：地上主角隨機獲得本職業兩招之一；地下未覺醒主角與十級同伴二選一。地上已覺醒者不重抽。';
    return '普通技能池：新角色隨機帶三個主動、兩個被動；主角四／六／八級可增加普通技能。地下新隊友五級加入，另隨機帶一招四級追加技能；之後依成長規則學習。';
  }
  function scale(s){
    const current=H().scale(s);
    if(s.modifiers)return {label:'分支效果增幅',unit:'%'};
    if(s.id==='double_portion'||s.id==='ingredient_care'||s.id==='care')return {label:'觸發機率',unit:'%'};
    if(s.id==='artisan_soul')return {label:'裝備耐久護層',unit:'%'};
    if(s.id==='robot_body')return {label:'最大生命增加',unit:'點'};
    if(s.id==='many_flavors'||s.id==='life_covenant'||s.id==='unyielding')return {label:'最大生命護盾',unit:'%'};
    return current;
  }
  function skillTarget(s){
    if(s.job==='robot'){
      const p=s.params||{};
      if(s.attack)return (p.radius?'自身周圍 '+p.radius:'前方 '+(p.reach||6))+' 個世界距離單位內，最多 '+(p.maxTargets||1)+' 隻可見怪物；牆壁會阻擋，不能推動樓層主。';
      if(s.effect==='mech_aid')return '施放者與一名四個世界距離單位內可見隊友；先點技能，再點左側職業卡選人。';
      return '施放者自身。';
    }
    if(targetEffects.includes(s.effect))return '先點技能，再點左側隊友；需在六個世界距離單位內，且牆壁不阻擋視線。';
    if(s.attack){
      if(s.job==='archer')return (s.effect==='volley'?'前方最多三隻怪物':'前方最近一隻怪物')+'；射程沿用已裝備弓，不穿牆。';
      if(['starfall','star_ring'].includes(s.effect))return '前方可見區域蓄力落點，落點周圍三個世界距離單位內；攻擊者到怪物不得超過九，牆壁阻擋。';
      if(s.effect==='decisive')return '前方三點五個世界距離單位內，斬擊落點周圍的可見敵人；牆壁阻擋。';
      if(['circle','shock','repel'].includes(s.effect))return '自身周圍三點五個世界距離單位內的可見怪物，不穿牆。';
      if(['bolt','weak','slow','mark','thorns'].includes(s.effect))return '前方最近一隻可見怪物，射程八個世界距離單位，不穿牆。';
      return ['cleave','splash'].includes(s.effect)?'前方三點五個世界距離單位內的可見怪物。':'前方最近一隻可見怪物，距離三點五個世界距離單位內。';
    }
    if(['rally','speed','soup','feast','sanctuary'].includes(s.effect))return '附近六個世界距離單位內、未被牆隔開的隊友。';
    if(['taunt','fortress'].includes(s.effect))return '自身周圍五個世界距離單位內、未被牆隔開的怪物；優先最近目標，數量依技能等級。'+(s.effect==='fortress'?'仍在範圍內的目標優先保留，不逐幀輪換累積。':'');
    if(['frost','smoke'].includes(s.effect))return '自身周圍五個世界距離單位內、未被牆隔開的怪物。';
    if(s.effect==='disarm')return '距離二點五個世界距離單位內的一般陷阱；移動或受傷會中斷作業。';
    if(s.effect==='meal'||s.effect==='stomach')return '全隊共用的飽食度／飽食消耗。';
    if(s.effect==='escape')return '已探索通道中的六格引路線，沿線隊友受益。';
    return '施放者自身。';
  }
  function timing(s){
    const p=s.params||{},a=Array.from({length:6},(_,i)=>i+1);
    if(s.job==='robot'){
      if(s.effect==='mech_aid')return '吸收型護盾最多五分鐘；受傷耗盡會提早消失，不與同類護盾相加。';
      if(p.knockback)return '命中擊退 '+p.knockback+' 個世界距離單位；不可穿牆，不推動樓層主。';
      if(p.duration)return '持續 '+p.duration+' 秒。';
    }
    if(s.effect==='barrier')return '護盾最多五分鐘；先被傷害耗盡就立即失效，不等於無敵。';
    if(s.effect==='fortress')return '護盾五分鐘；挑釁及四次耐久保護十五秒，三者不是同一時限。';
    if(s.effect==='sanctuary')return '領域十秒，合計恢復最大生命'+fmt(s.power[0])+'%；施放時扶起一人至'+G().HEALING.sanctuaryRevivePercent+'%生命。';
    if(s.effect==='feast')return '十秒恢復最大生命'+G().HEALING.feastPercent+'%；全隊增傷15%持續四十五秒。';
    if(s.effect==='escape')return '引路線十二秒，沿線免一般陷阱。';
    const durations={guard:8,rally:10,speed:20,polish:20,fortify:30,reveal:8,stomach:30,barricade:25,frost:6};
    if(Object.hasOwn(durations,s.effect))return '基礎持續 '+(p.duration??durations[s.effect])+' 秒。'+(s.effect==='barricade'?'場上最多一座，生命歸零會提早消失。':'');
    if(['taunt','stealth','smoke','ward','disarm'].includes(s.effect))return '持續／作業時間隨技能等級，見下方數值。'+(s.effect==='ward'?'只抵擋一次一般異常，不抵擋直接傷害。':'');
    if(s.effect==='cleanse')return '立即清除一般緩速，並給三秒一次異常保護；必要機關不取消。';
    if(['stun','shock','stagger'].includes(s.effect))return '暈眩 '+(p.stunSeconds?fmt(p.stunSeconds):series(a.map(l=>Math.min(2.4,1+l*.25)),''))+' 秒；怪物的抗連控期間不能重複暈眩。';
    if(s.effect==='thorns')return '束縛三秒，只限制移動，怪物仍可攻擊。';
    if(p.rootSeconds||p.slowSeconds)return (p.rootSeconds?'束縛 '+p.rootSeconds+' 秒；':'')+(p.slowSeconds?'緩速 '+p.slowPower*100+'% 持續 '+p.slowSeconds+' 秒。':'');
    if(['slow','splash','binding','great_arrow'].includes(s.effect))return '一至六級緩速 '+series(a.map(l=>20+l*4),'%')+'；持續 '+series(a.map(l=>2+l*.4),' 秒')+'，元素共鳴可延長。';
    if(s.effect==='blind')return '干擾轉向 '+series(a.map(l=>2+l*.4),' 秒')+'，元素共鳴可延長；背後命中另增傷25%。';
    if(s.effect==='weak')return '使下一次攻擊傷害降低 '+series(a.map(l=>15+l*4),'%')+'；攻擊後消耗，不是固定持續秒數。';
    if(s.effect==='mark')return '弱點標記 '+(p.markSeconds??6)+' 秒，後續命中增傷10%。';
    if(s.effect==='repel')return '立即向外推開一點七個世界距離單位；不能推穿牆壁。';
    return '立即結算；冷卻結束後才能再次施放。';
  }
  function skill(id){
    const h=H(),active=valid(h.SKILLS,id),s=active?h.SKILLS[id]:valid(h.PASSIVES,id)?h.PASSIVES[id]:null;if(!s)return null;
    const unit=scale(s),levels=s.power.map((value,i)=>({level:i+1,label:unit.label,value,unit:unit.unit}));
    const details=[row('職業',h.JOBS[s.job].name),row('種類',active?(s.attack?'主動・攻擊':'主動・輔助'):'被動'),row('取得方式',skillAccess(s))];
    const notes=[];
    let description=s.description;
    if(s.effect==='barrier'&&!s.ascension)description='替指定隊友吸收傷害，護盾最多維持五分鐘；用盡會提早消失。';
    if(active){
      const prep=h.preparationSeconds(s.id),materials=Object.entries(s.cost).map(([key,n])=>P().INGREDIENTS[key]+' ×'+n);
      if(s.effect==='fortress')materials.push('金屬零件 ×2');
      if(s.effect==='feast')materials.push('三種不同食材各一份');
      if(s.ammo)materials.push('箭矢 ×'+s.ammo);
      if(s.scrapCost)materials.push('金屬零件 ×'+s.scrapCost);
      details.push(row('冷卻',s.effect==='cleanse'?'一至六級：'+series(s.power,' 秒'):s.cooldown+' 秒'),row('準備時間',prep?prep+' 秒':s.effect==='disarm'?'依下方作業秒數；本身無額外蓄力':'立即施放'),row('消耗',materials.join('、')||'不耗食材或箭矢'),row('作用對象',skillTarget(s)),row('持續／附帶效果',timing(s)));
      if(['taunt','fortress'].includes(s.effect))details.push(row('挑釁數量上限','技能一至六級：'+series(Array.from({length:6},(_,i)=>h.tauntTargetLimit(i+1)),' 隻')+'；每名施放者分開計算，主角與同伴遵循同一規則。'));
      if(s.effect==='repair')details.push(row('修補上限','從指定角色尚未損壞、非核心的裝備中，優先修補剩餘比例最低的一件，恢復最大耐久 '+series(s.power,'%')+'；每次最多30點，不超過全滿。無法重建破損裝備，也不會恢復核心耐久。'));
      if(s.attack)notes.push(['mage','healer','archer'].includes(s.job)?'施放攻擊技能就扣一次武器耐久，空放或撞牆不退；同次命中不再重扣。':'近戰攻擊技能確認命中才扣一次武器耐久；同次多目標不重扣。');
      notes.push('所列為未計裝備、被動與地下分支精通的基礎數值；實際效果會受其加成。');
    }else{
      if(s.modifiers)details.push(row('強化對象',s.modifiers.targets.map(k=>(h.SKILLS[k]||h.PASSIVES[k]).name).join('、')),row('冷卻縮短',s.modifiers.cooldownPct+'%'));
      notes.push('必須實際學會才生效；職業相同不代表必然擁有。倒地者不提供全隊被動。');
      if(['endurance','gourmet','trap_sense','double_portion','economy','steadfast','food_sharing'].includes(id))notes.push('同名全隊被動採目前存活成員中的最高效果，不相加。');
    }
    return {id,name:s.name,category:'skills',job:s.job,jobs:[s.job],description,iconHtml:I().svg(id),tags:[h.JOBS[s.job].name,active?'主動':'被動',s.ascension?'地下主角進階':s.unique?'十級覺醒':'普通技能'],details,notes,levels,skillType:active?'active':'passive',unique:!!s.unique,ascension:s.ascension?{...s.ascension}:null};
  }
  function gear(kind){
    const h=H(),c=C();if(!valid(h.GEAR,kind))return null;const d=h.GEAR[kind];if(d.integrated)return robotGear(d);if(d.core){const entry=robotCore(d);entry.details.find(r=>r.label==='恢復方式').value+=' 每次先由低階核心修復；傷口已補滿，高階核心不再消耗。';return entry;}const guide=F().gear(kind),mult=c.durabilityMultiplier(kind),normal=[c.durabilityMinimumRoll(kind),10].map(n=>c.durabilityForRoll(kind,n));
    const sourceFloors=[99,69,39,-1,-21].filter(f=>h.gearPool(f).includes(kind));
    const floor=d.tier<=3?[99,69,39][d.tier-1]:d.tier===4?-1:-21;
    const merchants=E().merchantOffers(floor,17,true),merchant=merchants.find(m=>m.equipmentKinds.includes(kind))?.name||({longsword:'鐵嶺',greatsword:'鐵嶺',smith_hammer:'鐵嶺',warhammer:'鐵嶺',heavy_helm:'鐵嶺',light_hood:'鐵嶺',rune_crown:'鐵嶺',heavy_armor:'錦禾',light_armor:'錦禾',robe:'錦禾',cooking_pan:'錦禾',twin_daggers:'錦禾'}[d.baseKind]||'嵐舟');
    const sample=c.createGear(kind,floor,17,'atlas-price'),minimum={...sample,durability:normal[0],maxDurability:normal[0]},maximum={...sample,durability:normal[1],maxDurability:normal[1]};
    const enhancedBands=[...(d.tier===1?[['99～70層',13,1]]:[]),...(d.tier<=2?[['69～40層',16,2]]:[]),[d.tier<=3?'39～1層與地下':'地下',20,3]];
    const details=[row('階級／需求','第 '+d.tier+' 階，人物 '+d.requiredLevel+' 級可用'),row('適用職業',d.jobs.map(j=>h.JOBS[j].name).join('、')),row('部位／類型',slotNames[d.slot]+'／'+(armorNames[d.type]||guide.role))];
    if(d.slot==='weapon')details.push(row('物理基礎威力',d.damage),row('法術基礎威力',d.magicDamage||'無專有法術數值'),row('攻擊間隔',d.interval+' 秒／次'),row('攻擊距離',fmt(d.reach)+' 個世界距離單位（不是迷宮格數）'),row('持握',d.hands===2?'雙手，不能配盾':'單手，可以配盾'),row('輔助加成',Math.round(d.support*100)+'%'),row('普通攻擊',['staff','book'].includes(d.type)?'遠程光彈；按法術基礎威力計算':d.type==='bow'?'遠程箭矢，每射一支耗箭矢一支':'近戰揮擊，不是舊版固定擊暈'));
    else details.push(row('基礎防禦',d.defense),row('防禦換算','穿戴總防禦 ÷（總防禦 +20）換成減傷，裝備防禦本身最高45%；並非直接扣除相同點數傷害。'),row('持握限制',d.slot==='shield'?'只可配單手武器；雙手武器會卸下盾牌':'獨立防具欄位'),row('造型',d.slot==='helmet'||d.slot==='armor'?'依人物顯示男裝／女裝，能力相同；頭部可隱藏外觀，不影響能力。':'盾牌外觀與強度跟隨階級。'));
    if(d.type==='robe')details.push(row('法袍額外效益','每件未損壞的法冠／法袍：法術增傷4%、治療加成5%。'));
    details.push(row('普通初始耐久',normal.join('～')),row('強化初始耐久',enhancedBands.map(([label,max])=>label+' '+[10,max].map(n=>c.durabilityForRoll(kind,n)).join('～')).join('；')),row('強化加成',enhancedBands.map(([label,max,bonus])=>label+' +1'+(bonus>1?'～'+bonus:'')).join('；')+'。武器每 +1 加物理／法術基礎威力2；防具每 +1 加防禦1。'),row('一般商店價格',c.gearPrice(minimum)+'～'+c.gearPrice(maximum)+' 枚銅幣（按隨機耐久；強化品另計）'),row('行商',merchant+'固定經營此裝備類型，是否遇見及庫存依樓層決定'),row('進入獎勵池',d.tier===1?'自99層起':d.tier===2?'69層以下及地下':d.tier===3?'39層以下及地下':d.tier===4?'地下B1起':'地下B21起'),row('耐久消耗',guide.wear));
    const notes=[guide.handling,'裝備可來自行商、寶箱、委託、'+(d.tier<=3?'副本及':'')+'樓層主掉落；依當前樓層獎勵池抽取。樓層主裝備掉落率50%，不是每一件各50%。','耐久20%橘色提醒、10%紅色；圖示在職業卡片下方半透明顯示。一般裝備歸零能力停止但保留物件，動力核心則歸零立即消失。營地基本保養每層限一次，6幣恢復全隊穿戴中未損壞裝備最大耐久的'+Math.round(P().CAMP_MAINTENANCE_RATIO*100)+'%；變形或讀檔不重置。完整修復、重建與強化需能行動的鍛匠，或找對應商人；商人銅幣費加20%、材料不加價，可一鍵修理全隊及背包中其專長裝備；確認總費用與零件後一併修復，資源不足不局部扣款。破損重建費先乘1.5倍。','工坊可選一種特性，最高兩級：'+Object.values(X().TRAITS).map(t=>t.name+'（'+t.description+'）').join('、')];
    notes.push('商人維修可選「優先修理」只修低於70%的裝備，或另選「小損保養」將耐久至少70%、尚未破損的專長裝備合批計費修滿；原「全部修理」仍按逐件完整修理費加總，不自動改價。','材料附魔與原有工藝分開：每件普通裝備各保留一種附魔；武器命中有25%機率施加對應異常，防具抵抗同一異常。材料、成功率與效果請查「材料附魔」鍛造卡。');
    if(['spellbook','cooking_pan'].includes(d.baseKind))notes.push('耐久格式六：法書與料理鍋比原格式五提高25%，維持原本損耗比例；破損仍為零。');
    if(d.tier>1)notes.push('高階裝備提高普通初始耐久下限，不提高相同類型的最高隨機品質；舊存檔低品質裝備會按原剩餘比例遷移一次。');
    if(d.tier>3)notes.push('第四、第五階僅地下篇可取得與穿用。');
    return {id:kind,name:d.name,category:d.slot==='weapon'?'weapons':'armor',jobs:[...d.jobs],description:guide.role+'。'+guide.handling,iconHtml:I().svg(kind),tags:['第'+d.tier+'階',d.requiredLevel+'級',...d.jobs.map(j=>h.JOBS[j].name)],details,notes,tier:d.tier,requiredLevel:d.requiredLevel,baseKind:d.baseKind,rawStats:{damage:d.damage,magicDamage:d.magicDamage,defense:d.defense,support:d.support,interval:d.interval,reach:d.reach,hands:d.hands,normalDurability:normal,durabilityMultiplier:mult},sourceFloors};
  }
  function profession(id){
    const h=H();if(!valid(h.JOBS,id))return null;const j=h.JOBS[id],guide=F().profession(id),skills=Object.values(h.SKILLS).filter(s=>s.job===id),passives=Object.values(h.PASSIVES).filter(s=>s.job===id),weapons=Object.values(h.GEAR).filter(g=>g.tier===1&&g.slot==='weapon'&&g.jobs.includes(id));
    const terms=sex=>Object.entries(TR().TERMS[id+':'+sex].costs).flatMap(([type,value])=>typeof value==='number'?[TR().label(type,type)+' ×'+value]:Object.entries(value).map(([key,n])=>TR().label(type,key)+' ×'+n)).join('、');
    return {id,name:j.name,category:'jobs',job:id,jobs:[id],description:guide.innate,iconHtml:R().portrait(id),tags:[armorNames[j.armor],...weapons.map(w=>w.name)],details:[...(guide.rules?[row('機體規則',guide.rules)]:[]),row('造型','男女各一種；外觀不同，職業能力相同。'),...(j.description?[row('人物設定',j.description)]:[]),row('旅人姓名',P().NAMES[id].male+'／'+P().NAMES[id].female),row('男旅人首次同行',terms('male')),row('女旅人首次同行',terms('female')),row('防具',armorNames[j.armor]),row('專有武器',weapons.map(w=>w.name+'（'+(w.integrated?'一體式拳臂，不可配盾':w.hands===2?'雙手':'單手，可配盾')+'）').join('、')),row('初始武器',h.GEAR[j.starter].name),row('初始技能','隨機三個主動、兩個被動；至少有攻擊與輔助招式。療癒師必有治療或援起。'),row('普通技能池',skills.filter(s=>!s.unique).length+' 主動／'+passives.filter(s=>!s.unique).length+' 被動'),row('全部技能',skills.length+' 主動／'+passives.length+' 被動（含覺醒與地下主角進階）'),row('職業本領',guide.innate)],notes:[guide.note,'新人物的技能在出發前才揭曉；圖鑑列出的是可獲得清單，不代表一人全部擁有。','地下新招募固定五級，額外隨機獲得四級追加技能；原有隊員不重設。',id==='robot'?'機器人離隊保留等級、經驗、技能、成長及原機件；不把機殼或拳臂放入共用背包。重招沿用原機件，不重送。':'離隊保留等級、經驗、技能與已選成長；裝備退回背包，重招不重送裝備或箭矢。','本層不能重招，後續樓層隨機重逢；每次離隊後重新邀請，基礎需求多50%並逐項向上取整，單項物資最多99。地下重逢至少五級，不降低原有較高等級。'],skillIds:[...skills,...passives].map(s=>s.id),weaponIds:weapons.map(w=>w.kind)};
  }
  function robotGear(d){
    const weapon=d.slot==='weapon',guide=F().gear(d.kind),details=[row('階級／需求','第 '+d.tier+' 階，人物 '+d.requiredLevel+' 級可用'),row('適用職業','機器人'),row('部位／類型',weapon?'一體式雙拳':'一體式機殼'),row(weapon?'物理基礎威力':'基礎防禦',weapon?d.damage:d.defense),row('普通初始耐久',d.maxDurability+'～'+d.maxDurability),row('耐久消耗',guide.wear),row('行商','鐵嶺可維護及進階；不出售或收購一體式機件'),row('取得方式',d.tier===1?'機器人初始配備，不出現在普通裝備掉落池。':'由上一階原機件進階，不更換人物或重抽。'),row('持握限制','不能卸下、移交、出售、拆解或裝入共用背包；不能穿一般防具或配盾。')];
    if(weapon)details.push(row('攻擊間隔',d.interval+' 秒／次'),row('攻擊距離',d.reach+' 個世界距離單位'),row('普通攻擊','左右拳輪替，近身命中；揮空不消耗耐久。'),row('背面造型','拳臂後側有關節接頭。'+(d.tier>=3?'另有散熱槽。':'')+(d.tier>=4?'增加能量針。':'')+'外觀依拳臂本身階級，與機殼獨立。'));
    else details.push(row('怪物原始傷害抵銷',d.monsterFlat+' 點；不抵銷陷阱或飢餓，與鎮淵抵銷共用上限。'),row('防禦換算','與普通裝備相同：防禦換算減傷最多45%，所有減傷合計最多65%。'),row('背面造型','貼合曲面的'+(d.tier>=5?'五':d.tier>=3?'四':'三')+'節金屬背脊裝甲，左右各'+(d.tier>=5?'五':d.tier>=3?'四':'三')+'片斜向散熱格柵與兩條弧形管線。'+(d.tier>=2?'下背甲增加接縫。':'')+(d.tier>=3?'中央核心護蓋：男型六角、女型八角。':'')+(d.tier>=4?'加入核心能量雕紋與肩背紋章。':'')+(d.tier>=5?'增加鎮淵箭形下背鑲片。':'')+'外觀依本件機殼階級。'));
    if(!weapon)details.push(row('抗控制','緩速、電麻與束縛的持續時間與效果額外減少 '+fmt((d.tier-1)*5)+'%；與防具附魔／被動合計最高65%，不是一般傷害減傷，也不減少灼傷、中毒或詛咒。機殼損壞後失效。'));
    return {id:d.kind,name:d.name,category:weapon?'weapons':'armor',jobs:['robot'],description:guide.role+'。'+guide.handling,iconHtml:I().svg(d.kind),tags:['第'+d.tier+'階',d.requiredLevel+'級','一體式機件'],details,notes:[guide.handling,'營地基本保養每層限一次，6幣恢復未破損機件最大耐久的'+Math.round(P().CAMP_MAINTENANCE_RATIO*100)+'%；完整修復需鍛匠或鐵嶺。','進階消耗銅幣、金屬零件與指定礦材，保留原耐久比例，不免費補滿；破損先修復。',...(d.tier>3?['第四、第五階僅地下篇可取得與穿用。']:[])],tier:d.tier,requiredLevel:d.requiredLevel,baseKind:d.baseKind,integrated:true,rawStats:{damage:d.damage,magicDamage:d.magicDamage,defense:d.defense,support:d.support,interval:d.interval,reach:d.reach,hands:d.hands,normalDurability:[d.maxDurability,d.maxDurability],durabilityMultiplier:C().durabilityMultiplier(d.kind)},sourceFloors:[]};
  }
  function robotUpgrade(tier){
    const robot=Robot(),cost=robot.COSTS[tier],labels=moduleFor('tower-materials','TowerMaterials').MATERIALS,parts=['robot_shell','robot_fists'].map(base=>H().GEAR[robot.kind(base,tier)]),text=price=>price+' 銅幣／'+cost.scrap+' 金屬零件／'+Object.entries(cost.materials).map(([id,n])=>labels[id]+' ×'+n).join('／');
    return {id:'robot-upgrade-t'+tier,name:'機件進階・第'+tier+'階',category:'forging',jobs:['robot'],description:'將原機殼或拳臂進階；防護與攻擊成長，但保留耐久比例，不免費修復。',iconHtml:I().svg(parts[0].kind),tags:['機器人專用','人物'+robot.GATES[tier-1]+'級',tier>3?'地下限定':'地上／地下'],details:[row('開放條件','人物 '+robot.GATES[tier-1]+' 級；'+(tier>3?'僅地下篇；':'')+'安全營地有能行動的鍛匠，或本層鐵嶺。'),row('上一階',parts.map(part=>H().GEAR[robot.kind(part.baseKind,tier-1)].name).join('／')),row('完成機件',parts.map(part=>part.name).join('／')),row('每件隊內費用',text(cost.coins)),row('每件商人費用',text(Math.ceil(cost.coins*1.2))),row('防護／威力',parts[0].defense+' 防禦／'+parts[1].damage+' 拳力'),row('耐久',parts[0].maxDurability+' 機殼／'+parts[1].maxDurability+' 拳臂')],notes:['兩個部位分開進階並各付一次費用，材料不加價；資源不足不扣款。','機件破損時必須先修復，再進阶。'.replace('阶','階'),'只有五階，不可无限強化。'.replace('无限','無限')],underground:tier>3,robotUpgrade:true};
  }
  function robotCore(d){
    const robot=Robot(),cost=robot.CORE_COSTS[d.tier],materials=moduleFor('tower-materials','TowerMaterials').MATERIALS;
    return {id:d.kind,name:d.name,category:'armor',jobs:['robot'],description:'機器人專用可替換動力核心；每 '+robot.REPAIR_SECONDS+' 秒自我修復 '+d.tier+' 點生命，附加防禦 '+d.defense+'。',iconHtml:I().svg(d.kind),tags:['第'+d.tier+'階',d.requiredLevel+'級','雙核心槽'],details:[row('階級／需求','第 '+d.tier+' 階，人物 '+d.requiredLevel+' 級可用'),row('適用職業','機器人'),row('部位／類型','核心一／核心二；同時最多兩顆，可不同階'),row('基礎防禦',d.defense),row('普通初始耐久',d.maxDurability+'～'+d.maxDurability),row('耐久消耗','每 '+robot.REPAIR_SECONDS+' 秒，有缺血且實際參與修復的核心消耗 1 耐久；滿血不消耗，不因受擊消耗。'),row('恢復方式','每次各核心按其階級恢復生命，兩顆加總但不超過最大生命；不復活倒地機器人。'),row('內建光源','依已安裝核心數量：單核心小於火把、雙核心大於火把且小於日光術。全隊採最強光源，已施放日光術優先，不因切換領隊變換；階級只決定光色。無核／單核／雙核範圍 '+robot.CORE_LIGHT_RADII.join('／')+'（遊戲世界距離）。永久照明，不扣核心耐久或能源；能源耗盡仍照亮。'),row('核心光色','#'+d.color.toString(16).padStart(6,'0')),row('取得方式','本人在安全營地以 '+cost.scrap+' 金屬零件'+Object.entries(cost.materials).map(([id,n])=>'／'+materials[id]+' ×'+n).join('')+' 製作；不是普通怪物裝備掉落或商店販售。'),row('行商','不販售動力核心；不能修理或套用一般裝備特性，耗盡需回安全營地重新製作。')],notes:['新機器人配備第一階核心；舊機器人只在格式升級時補一顆，不重複贈送。','兩個核心槽可個別安裝或卸下，核心獨立於機殼與拳臂階級；不能裝到其他職業。','耐久耗盡立即消失，不能由鍛匠、商人、技能或營地保養修復，只能重新製作。照明立即依剩餘核心重算範圍與光色；沒有核心時保留較弱內建微光。',...(d.tier>3?['第四、第五階核心僅地下篇可製作及安裝。']:[])],tier:d.tier,requiredLevel:d.requiredLevel,baseKind:d.baseKind,core:true,rawStats:{damage:d.damage,magicDamage:d.magicDamage,defense:d.defense,support:d.support,interval:d.interval,reach:d.reach,hands:d.hands,normalDurability:[d.maxDurability,d.maxDurability],durabilityMultiplier:C().durabilityMultiplier(d.kind)},sourceFloors:[]};
  }
  function robotCoreCraft(tier){
    const robot=Robot(),d=robot.CORES[robot.kind('robot_core',tier)],cost=robot.CORE_COSTS[tier],materials=moduleFor('tower-materials','TowerMaterials').MATERIALS;
    return {id:'robot-core-craft-t'+tier,name:'核心製作・'+d.name,category:'forging',jobs:['robot'],description:'機器人在安全營地自行製作一顆動力核心，不需鍛匠；放入共用裝備背包，再指定安裝位置。',iconHtml:I().svg(d.kind),tags:['機器人專用','人物'+d.requiredLevel+'級',tier>3?'地下限定':'地上／地下'],details:[row('開放條件','能行動的機器人、人物 '+d.requiredLevel+' 級，在安全營地；'+(tier>3?'僅地下篇。':'地上與地下皆可。')),row('成品',d.name+' ×1'),row('材料',cost.scrap+' 金屬零件'+Object.entries(cost.materials).map(([id,n])=>'／'+materials[id]+' ×'+n).join('')),row('銅幣費用',cost.coins+' 幣'),row('修復／防禦','每 '+robot.REPAIR_SECONDS+' 秒自修 '+tier+' 點生命／防禦 '+d.defense),row('固定耐久',d.maxDurability)],notes:['與原機殼／拳臂進階分開，不消耗或改造已安裝核心。','需有裝備背包空位（上限 24 件；地下篇解散隊友退還裝備而暫時超過時，先整理回 24 件以下才能製作或卸下核心），確認前不扣材料；物資或作業位置改變時重新檢查。'],underground:tier>3,robotCoreCraft:true};
  }
  function forging(id){
    const x=X();if(!valid(x.TRAITS,id))return null;const trait=x.TRAITS[id],affected=Object.values(H().GEAR).filter(g=>x.traitFits(id,g));
    const labels=moduleFor('tower-materials','TowerMaterials').MATERIALS,materialText=level=>Object.entries(trait.materialCost||{}).map(([key,n])=>'／'+labels[key]+' ×'+n*level).join('');
    const effects={durable:['持續節省耐久損耗',10,'%'],light:['武器攻擊間隔縮短',.08,'秒'],grip:['一般陷阱傷害減少',1,'點'],sharp:['物理傷害增加',trait.effects.physicalPct*100,'%'],plated:['這件防具增加防禦',trait.effects.defense,'點'],starvein:['法術傷害增加',trait.effects.spellPct*100,'%'],abyssward:['怪物原始傷害抵銷',trait.effects.monsterFlat,'點']},[label,value,unit]=effects[id];
    return {id,name:trait.name,category:'forging',jobs:[...new Set(affected.flatMap(g=>g.jobs))],description:trait.description,iconHtml:FI().svg(trait.icon),tags:[trait.underground?'地下限定':'地上／地下','最高二級'],details:[row('開放條件',(trait.underground?'正式進入地下篇後；':'')+'需鍛匠同行並在安全營地，或找負責這種裝備的專門商人。'),row('適用部位',trait.slots.map(s=>slotNames[s]).join('、')),row('可用武器／防具類型',H().BASE_GEAR.filter(g=>x.traitFits(id,g)).map(g=>g.name).join('、')),row('一級消耗',trait.parts+' 金屬零件／'+trait.coins+' 銅幣'+materialText(1)),row('升二級消耗',trait.parts*2+' 金屬零件／'+trait.coins*2+' 銅幣'+materialText(2)),row('折扣','存活隊員的「節省工料」降低銅幣費用，零件與素材不打折；顯示上述為未折扣的隊內鍛匠費用；商人按同條件銅幣費再加20%，向上取整，材料不加價。'),...(id==='starvein'?[row('治療與輔助加成','一／二級額外增加5／10個百分點。')]:[]),...(id==='light'?[row('防具作用','每件每級移速增加3%，全身最多6%。')]:[])],levels:[1,2].map(level=>({level,label,value:Number((value*level).toFixed(2)),unit})),notes:['每件裝備只能選一種特性，選定後不能替換；最多強化兩次。','需先修復已損壞裝備。確認才扣款，裝備或資源已改變時會重新驗證，不照過期報價扣款。',id==='durable'?'依實際耐久損耗決定性累計：一級每十次省一次，二級每五次省一次。修理、讀檔與升級不重置累計；旧存檔尚未用完的耐用保護次數會先消耗，不重送。'.replace('旧','舊'):'裝備損壞後，本特性停止提供能力；修復裝備後恢復。'],underground:!!trait.underground};
  }
  function affixing(id){
    const a=Affixes();if(!valid(a.EFFECTS,id))return null;const d=a.EFFECTS[id],labels=moduleFor('tower-materials','TowerMaterials').MATERIALS;
    // Quote against an isolated read-only inventory, without creating a game,
    // recruiting a character, touching saves or requiring dungeon rendering.
    const run={floor:d.underground?-21:99,seed:17,coins:999,hp:60,gearBag:[],equipment:{},party:{profession:'smith',members:[],journey:{materials:Object.fromEntries(Object.keys(labels).map(key=>[key,99]))},loadouts:{active:'hero',actors:{}}}};
    const quotes=[1,2,3,4,5].map(tier=>{const g=C().createGear(H().tierKind('longsword',tier),run.floor,run.seed,'atlas-affix-'+tier);run.gearBag=[g];return a.quote(run,g.id,id);});
    return {id:'affix:'+id,affixId:id,affix:true,name:'材料附魔・'+d.name,category:'forging',jobs:Object.keys(H().JOBS).filter(j=>j!=='robot'),description:d.description+' 對應武器附加異常，防具減輕同種異常。',iconHtml:a.svg(id),tags:['材料附魔',d.underground?'地下限定':'地上／地下'],details:[row('異常效果',d.description),row('基礎時限',d.duration+' 秒；同種效果刷新而不累加多份。'),row('適用裝備','普通武器、頭部、身體與盾牌；排除機器人機件及動力核心。'),row('每次材料',labels[d.material]+' ×'+quotes[0].count),row('隊內費用','裝備一至五階：'+series(quotes.map(q=>q.coins),' 銅幣')),row('成功率','裝備一至五階：'+series(quotes.map(q=>q.chance),'%')+'；最高85%。'),row('武器作用','有效命中時25%機率附加對應異常；同種不堆疊多份。'),row('防具作用','同種異常的持續時間與效果減少35%；多件同種取最高，不相加，與其他抗性合計最高65%。'),row('作業條件',(d.underground?'地下篇限定；':'')+'有能行動的鍛匠，或本層能承作此裝備的專門商人；裝備未損壞。')],notes:['材料附魔獨立於原工坊特性；每件裝備各留一種附魔，可重新嘗試更換；原耐用、星脈等工藝不被刪除。','確認嘗試後扣除材料與銅幣。失敗保留原附魔；商人銅幣費按隊內費用加20%，向上取整，素材數量不變。','樓層主對電麻、束縛只受較短緩速，不會被永久控制；異常不是普通攻擊的必然結果。'],underground:!!d.underground,effectId:id,material:d.material,quotes:quotes.map(q=>({coins:q.coins,count:q.count,chance:q.chance}))};
  }
  function build(){
    const h=H(),jobs=Object.keys(h.JOBS).map(profession),skills=[...Object.keys(h.SKILLS),...Object.keys(h.PASSIVES)].map(skill),allGear=Object.keys(h.GEAR).map(gear),forgingEntries=[...Object.keys(X().TRAITS).map(forging),...[2,3,4,5].map(robotUpgrade),...Object.values(Robot().CORES).map(d=>robotCoreCraft(d.tier)),...Object.keys(Affixes().EFFECTS).map(affixing)];
    return {jobs,skills,weapons:allGear.filter(g=>g.category==='weapons'),armor:allGear.filter(g=>g.category==='armor'),gear:allGear,forging:forgingEntries,entries:[...jobs,...skills,...allGear,...forgingEntries],progression:{xp:[...G().XP],skillLevels:'人物一至五級對應技能一至五級；人物六至九級技能維持五級，十級起技能六級。',surface:'地上主角上限十級、同伴五級；主角一／二／三級分別可帶一／二／三名同伴。',underworld:'通關後地下篇主角十五級、同伴十級，最多四名同伴；地下新隊友五級加入並隨機帶四級追加技能。',branches:Object.values(A().BRANCHES).map(b=>({...b,steps:b.steps.map(s=>({...s}))}))},notes:['所有圖示直接沿用遊戲的職業、技能、裝備與鍛造圖示。','技能表為六級基礎數值；技能倍率不是固定傷害。裝備、人物成長、被動、目標減傷會影響最後結果。','此頁列目前 '+jobs.length+' 職業的 '+allGear.length+' 件武器、防具與一體式機件；舊存檔中的球棒、平底鍋、木杖與無職業通用防具屬已退役系統，不能當作目前職業武器規則。']};
  }
  return Object.freeze({build,skill,gear,profession,forging,affixing,robotUpgrade,robotCoreCraft,scale});
});
