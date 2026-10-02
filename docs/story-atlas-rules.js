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
  const row=(label,value)=>({label,value:String(value)}),fmt=n=>Number(n.toFixed(2)).toString(),series=(a,unit)=>a.map(fmt).join('／')+unit;
  const valid=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
  const armorNames={heavy:'重裝',light:'輕裝',robe:'法袍',shield:'盾牌'},slotNames={helmet:'頭部',armor:'身體',shield:'副手盾牌',weapon:'武器'};
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
    if(s.id==='many_flavors'||s.id==='life_covenant'||s.id==='unyielding')return {label:'最大生命護盾',unit:'%'};
    return current;
  }
  function skillTarget(s){
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
    if(['frost','taunt','smoke'].includes(s.effect))return '自身周圍五個世界距離單位內、未被牆隔開的怪物。';
    if(s.effect==='disarm')return '距離二點五個世界距離單位內的一般陷阱；移動或受傷會中斷作業。';
    if(s.effect==='meal'||s.effect==='stomach')return '全隊共用的飽食度／飽食消耗。';
    if(s.effect==='escape')return '已探索通道中的六格引路線，沿線隊友受益。';
    return '施放者自身。';
  }
  function timing(s){
    const p=s.params||{},a=Array.from({length:6},(_,i)=>i+1);
    if(s.effect==='barrier')return '護盾最多五分鐘；先被傷害耗盡就立即失效，不等於無敵。';
    if(s.effect==='fortress')return '護盾五分鐘；挑釁及四次耐久保護十五秒，三者不是同一時限。';
    if(s.effect==='sanctuary')return '領域十秒，合計恢復最大生命40%；施放時扶起一人至30%生命。';
    if(s.effect==='feast')return '十秒恢復最大生命20%；全隊增傷15%持續四十五秒。';
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
      details.push(row('冷卻',s.effect==='cleanse'?'一至六級：'+series(s.power,' 秒'):s.cooldown+' 秒'),row('準備時間',prep?prep+' 秒':s.effect==='disarm'?'依下方作業秒數；本身無額外蓄力':'立即施放'),row('消耗',materials.join('、')||'不耗食材或箭矢'),row('作用對象',skillTarget(s)),row('持續／附帶效果',timing(s)));
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
    const h=H(),c=C();if(!valid(h.GEAR,kind))return null;const d=h.GEAR[kind],guide=F().gear(kind),mult=c.durabilityMultiplier(kind),normal=[3,10].map(n=>Math.round(n*mult));
    const sourceFloors=[99,69,39,-1,-21].filter(f=>h.gearPool(f).includes(kind));
    const floor=d.tier<=3?[99,69,39][d.tier-1]:d.tier===4?-1:-21;
    const merchants=E().merchantOffers(floor,17,true),merchant=merchants.find(m=>m.equipmentKinds.includes(kind))?.name||({longsword:'鐵嶺',greatsword:'鐵嶺',smith_hammer:'鐵嶺',warhammer:'鐵嶺',heavy_helm:'鐵嶺',light_hood:'鐵嶺',rune_crown:'鐵嶺',heavy_armor:'錦禾',light_armor:'錦禾',robe:'錦禾',cooking_pan:'錦禾',twin_daggers:'錦禾'}[d.baseKind]||'嵐舟');
    const sample=c.createGear(kind,floor,17,'atlas-price'),minimum={...sample,durability:normal[0],maxDurability:normal[0]},maximum={...sample,durability:normal[1],maxDurability:normal[1]};
    const enhancedBands=[...(d.tier===1?[['99～70層',13,1]]:[]),...(d.tier<=2?[['69～40層',16,2]]:[]),[d.tier<=3?'39～1層與地下':'地下',20,3]];
    const details=[row('階級／需求','第 '+d.tier+' 階，人物 '+d.requiredLevel+' 級可用'),row('適用職業',d.jobs.map(j=>h.JOBS[j].name).join('、')),row('部位／類型',slotNames[d.slot]+'／'+(armorNames[d.type]||guide.role))];
    if(d.slot==='weapon')details.push(row('物理基礎威力',d.damage),row('法術基礎威力',d.magicDamage||'無專有法術數值'),row('攻擊間隔',d.interval+' 秒／次'),row('攻擊距離',fmt(d.reach)+' 個世界距離單位（不是迷宮格數）'),row('持握',d.hands===2?'雙手，不能配盾':'單手，可以配盾'),row('輔助加成',Math.round(d.support*100)+'%'),row('普通攻擊',['staff','book'].includes(d.type)?'遠程光彈；按法術基礎威力計算':d.type==='bow'?'遠程箭矢，每射一支耗箭矢一支':'近戰揮擊，不是舊版固定擊暈'));
    else details.push(row('基礎防禦',d.defense),row('防禦換算','穿戴總防禦 ÷（總防禦 +20）換成減傷，裝備防禦本身最高45%；並非直接扣除相同點數傷害。'),row('持握限制',d.slot==='shield'?'只可配單手武器；雙手武器會卸下盾牌':'獨立防具欄位'),row('造型',d.slot==='helmet'||d.slot==='armor'?'依人物顯示男裝／女裝，能力相同；頭部可隱藏外觀，不影響能力。':'盾牌外觀與強度跟隨階級。'));
    if(d.type==='robe')details.push(row('法袍額外效益','每件未損壞的法冠／法袍：法術增傷4%、治療加成5%。'));
    details.push(row('普通初始耐久',normal.join('～')),row('強化初始耐久',enhancedBands.map(([label,max])=>label+' '+[10,max].map(n=>Math.round(n*mult)).join('～')).join('；')),row('強化加成',enhancedBands.map(([label,max,bonus])=>label+' +1'+(bonus>1?'～'+bonus:'')).join('；')+'。武器每 +1 加物理／法術基礎威力2；防具每 +1 加防禦1。'),row('一般商店價格',c.gearPrice(minimum)+'～'+c.gearPrice(maximum)+' 枚銅幣（按隨機耐久；強化品另計）'),row('行商',merchant+'固定經營此裝備類型，是否遇見及庫存依樓層決定'),row('進入獎勵池',d.tier===1?'自99層起':d.tier===2?'69層以下及地下':d.tier===3?'39層以下及地下':d.tier===4?'地下B1起':'地下B21起'),row('耐久消耗',guide.wear));
    const notes=[guide.handling,'裝備可來自行商、寶箱、委託、'+(d.tier<=3?'副本及':'')+'樓層主掉落；依當前樓層獎勵池抽取。樓層主裝備掉落率50%，不是每一件各50%。','耐久20%橘色提醒、10%紅色；歸零能力停止，但保留物件。隊中有能行動的鍛匠，才能在工坊重建已損壞裝備，銅幣為一般修理費1.5倍。','工坊可選一種特性，最高兩級：'+Object.values(X().TRAITS).map(t=>t.name+'（'+t.description+'）').join('、')];
    if(d.tier>3)notes.push('第四、第五階僅地下篇可取得與穿用；不提高原有耐久倍率。');
    return {id:kind,name:d.name,category:d.slot==='weapon'?'weapons':'armor',jobs:[...d.jobs],description:guide.role+'。'+guide.handling,iconHtml:I().svg(kind),tags:['第'+d.tier+'階',d.requiredLevel+'級',...d.jobs.map(j=>h.JOBS[j].name)],details,notes,tier:d.tier,requiredLevel:d.requiredLevel,baseKind:d.baseKind,rawStats:{damage:d.damage,magicDamage:d.magicDamage,defense:d.defense,support:d.support,interval:d.interval,reach:d.reach,hands:d.hands,normalDurability:normal,durabilityMultiplier:mult},sourceFloors};
  }
  function profession(id){
    const h=H();if(!valid(h.JOBS,id))return null;const j=h.JOBS[id],guide=F().profession(id),skills=Object.values(h.SKILLS).filter(s=>s.job===id),passives=Object.values(h.PASSIVES).filter(s=>s.job===id),weapons=h.BASE_GEAR.filter(g=>g.slot==='weapon'&&g.jobs.includes(id));
    return {id,name:j.name,category:'jobs',job:id,jobs:[id],description:guide.innate,iconHtml:R().portrait(id),tags:[armorNames[j.armor],...weapons.map(w=>w.name)],details:[row('造型','男女各一種；外觀不同，職業能力相同。'),row('旅人姓名',P().NAMES[id].male+'／'+P().NAMES[id].female),row('防具',armorNames[j.armor]),row('專有武器',weapons.map(w=>w.name+'（'+(w.hands===2?'雙手':'單手，可配盾')+'）').join('、')),row('初始武器',h.GEAR[j.starter].name),row('初始技能','隨機三個主動、兩個被動；至少有攻擊招式。療癒師必有治療或援起。'),row('普通技能池',skills.filter(s=>!s.unique).length+' 主動／'+passives.filter(s=>!s.unique).length+' 被動'),row('全部技能',skills.length+' 主動／'+passives.length+' 被動（含覺醒與地下主角進階）'),row('職業本領',guide.innate)],notes:[guide.note,'新人物的技能在出發前才揭曉；圖鑑列出的是可獲得清單，不代表一人全部擁有。','地下新招募固定五級，額外隨機獲得四級追加技能；原有隊員不重設。'],skillIds:[...skills,...passives].map(s=>s.id),weaponIds:weapons.map(w=>w.kind)};
  }
  function forging(id){
    const x=X();if(!valid(x.TRAITS,id))return null;const trait=x.TRAITS[id],affected=Object.values(H().GEAR).filter(g=>x.traitFits(id,g));
    const labels=moduleFor('tower-materials','TowerMaterials').MATERIALS,materialText=level=>Object.entries(trait.materialCost||{}).map(([key,n])=>'／'+labels[key]+' ×'+n*level).join('');
    const effects={durable:['額外耐久保護',2,'次'],light:['武器攻擊間隔縮短',.08,'秒'],grip:['一般陷阱傷害減少',1,'點'],sharp:['物理傷害增加',trait.effects.physicalPct*100,'%'],plated:['這件防具增加防禦',trait.effects.defense,'點'],starvein:['法術傷害增加',trait.effects.spellPct*100,'%'],abyssward:['怪物原始傷害抵銷',trait.effects.monsterFlat,'點']},[label,value,unit]=effects[id];
    return {id,name:trait.name,category:'forging',jobs:[...new Set(affected.flatMap(g=>g.jobs))],description:trait.description,iconHtml:FI().svg(trait.icon),tags:[trait.underground?'地下限定':'地上／地下','最高二級'],details:[row('開放條件',trait.underground?'正式進入地下篇後，安全營地或行商旁。':'安全營地或行商旁。'),row('適用部位',trait.slots.map(s=>slotNames[s]).join('、')),row('可用武器／防具類型',H().BASE_GEAR.filter(g=>x.traitFits(id,g)).map(g=>g.name).join('、')),row('一級消耗',trait.parts+' 金屬零件／'+trait.coins+' 銅幣'+materialText(1)),row('升二級消耗',trait.parts*2+' 金屬零件／'+trait.coins*2+' 銅幣'+materialText(2)),row('折扣','存活隊員的「節省工料」降低銅幣費用，零件與素材不打折；顯示上述為未折扣費用。'),...(id==='starvein'?[row('治療與輔助加成','一／二級額外增加5／10個百分點。')]:[]),...(id==='light'?[row('防具作用','每件每級移速增加3%，全身最多6%。')]:[])],levels:[1,2].map(level=>({level,label,value:Number((value*level).toFixed(2)),unit})),notes:['每件裝備只能選一種特性，選定後不能替換；最多強化兩次。','需先修復已損壞裝備。確認才扣款，裝備或資源已改變時會重新驗證，不照過期報價扣款。',id==='durable'?'耐用護層被消耗後不會因修理而恢復。':'裝備損壞後，本特性停止提供能力；修復裝備後恢復。'],underground:!!trait.underground};
  }
  function build(){
    const h=H(),jobs=Object.keys(h.JOBS).map(profession),skills=[...Object.keys(h.SKILLS),...Object.keys(h.PASSIVES)].map(skill),allGear=Object.keys(h.GEAR).map(gear),forgingEntries=Object.keys(X().TRAITS).map(forging);
    return {jobs,skills,weapons:allGear.filter(g=>g.category==='weapons'),armor:allGear.filter(g=>g.category==='armor'),gear:allGear,forging:forgingEntries,entries:[...jobs,...skills,...allGear,...forgingEntries],progression:{xp:[...G().XP],skillLevels:'人物一至五級對應技能一至五級；人物六至九級技能維持五級，十級起技能六級。',surface:'地上主角上限十級、同伴五級；主角一／二／三級分別可帶一／二／三名同伴。',underworld:'通關後地下篇主角十五級、同伴十級，最多四名同伴；地下新隊友五級加入並隨機帶四級追加技能。',branches:Object.values(A().BRANCHES).map(b=>({...b,steps:b.steps.map(s=>({...s}))}))},notes:['所有圖示直接沿用遊戲的職業、技能、裝備與鍛造圖示。','技能表為六級基礎數值；技能倍率不是固定傷害。裝備、人物成長、被動、目標減傷會影響最後結果。','此頁只列目前七職業系統的90件裝備；舊存檔中的球棒、平底鍋、木杖與無職業通用防具屬已退役系統，不能當作目前職業武器規則。']};
  }
  return Object.freeze({build,skill,gear,profession,forging,scale});
});
