/* Original expedition chapter mechanisms, optional field work and bounded forging. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerExpedition=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const E=()=>typeof module==='object'&&module.exports?require('./tower-encounters.js'):globalThis.TowerEncounters;
  const Materials=()=>typeof module==='object'&&module.exports?require('./tower-materials.js'):globalThis.TowerMaterials;
  const own=(o,k)=>Object.hasOwn(o,k),number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
  const integer=(n,min,max)=>number(n,min,max)&&Number.isInteger(n);
  const BOSSES=Object.freeze({
    90:{name:'雲門甦醒石陣',environmentId:'summoning',nodeName:'封印',kind:'stone',count:2,cycle:14,warning:3,strike:3,damage:12,color:0x9bc9d0,description:'雲門下的石柱開始移動。地面發亮時先退開；石柱收回後，解除兩座封印。'},
    80:{name:'吞光庭園',environmentId:'garden',nodeName:'光鏡',kind:'mirror',count:2,cycle:14,warning:3,strike:3,damage:15,color:0x87bf91,description:'藤蔓收回後，轉動兩座光鏡，讓光束對準旁邊的金色根芽。'},
    70:{name:'盤根追獵陣',environmentId:'roots',nodeName:'定錨器',kind:'chase',count:3,cycle:16,warning:4,strike:4,damage:16,color:0xc5a17a,order:[0,1,2],description:'樹根牽動牆陣，逐輪向外推進。退到警戒圈外，平息時依序啟動一、二、三號定錨器。'},
    60:{name:'晶音共鳴閘',environmentId:'echo',nodeName:'晶音閘',kind:'tide',count:3,cycle:18,warning:4,strike:5,damage:14,color:0x65bad0,order:[2,0,1],description:'水晶回聲會一波波爆發。平息後依序打開三、一、二號晶音閘；每開一閘，危險範圍就會縮小。'},
    50:{name:'書庫封頁風箱',environmentId:'library',nodeName:'風閥',kind:'steam',count:3,cycle:17,warning:5,strike:4,damage:18,color:0xdc986b,description:'書架後的風箱會噴出紙塵。先在黃光預警時打開二號洩壓閥；風停後，再關閉一號與三號風口。'},
    40:{name:'霧河引光陣',environmentId:'mist',nodeName:'光鏡',kind:'reverse',count:3,cycle:16,warning:4,strike:4,damage:16,color:0xb899d4,description:'霧中的三面鏡子會逆向轉動。等光刃收回，將光束逐一對準金色標記。'},
    30:{name:'霜晶脈陣',environmentId:'frost',nodeName:'霜晶柱',kind:'pulse',count:3,cycle:15,warning:4,strike:4,damage:18,color:0x76d4c7,description:'每輪只有一座霜晶柱亮起白光。寒氣退去後，操作當輪亮起的霜晶柱；錯過就等下一輪。'},
    20:{name:'工坊解凍閘',environmentId:'clockwork',nodeName:'暖爐',kind:'frost',count:3,cycle:18,warning:5,strike:4,damage:17,color:0xb4e7ee,description:'冷凝管道結冰，卡住了工坊齒輪。冰刺融化時，為每座暖爐添火兩次；同一座暖爐每輪只能添火一次。'},
    10:{name:'熔爐調壓盤',environmentId:'furnace',nodeName:'調壓盤',kind:'gear',count:3,cycle:16,warning:4,strike:4,damage:20,color:0xd8b071,description:'爐心熱壓推動齒輪。等齒輪停穩，再將指針轉到金色標記。一、二、三號調壓盤每次分別轉一、二、三格。'},
    1:{name:'塔心・歸途試煉',environmentId:'heart',nodeName:'塔心封印',kind:'heart',count:3,cycle:18,warning:5,strike:4,damage:20,color:0xe5b7be,description:'平息時先解除一號石印，再將二號光鏡對準金色標記；最後分兩輪替三號塔心充能。完成後仍須作出故事的最後選擇。'},
    '-10':{name:'根脈返程錨陣',environmentId:'roots',nodeName:'返程錨',kind:'chase',count:3,cycle:17,warning:4,strike:4,damage:22,color:0xb6c885,order:[0,1,2],description:'舊根牆會逐輪向外推進。退到警戒圈外，平息後依序啟動一、二、三號返程錨；保住路標，不必把離隊的人找回來。'},
    '-20':{name:'分途渡渠閘',environmentId:'mist',nodeName:'分途閘',kind:'tide',count:3,cycle:17,warning:4,strike:4,damage:24,color:0x79c6ca,order:[2,0,1],description:'水閘會依次湧出衝擊。平息時按三、一、二號開閘，讓渡船通往河底藏書庫。'},
    '-30':{name:'石頁映光陣',environmentId:'library',nodeName:'石頁光鏡',kind:'reverse',count:3,cycle:16,warning:4,strike:4,damage:26,color:0xbb9edb,description:'三面光鏡逆向旋轉。光刃收回後，讓鏡光對準金色標記，照亮被藏起的完整誓言。'},
    '-40':{name:'深井分流盤',environmentId:'furnace',nodeName:'分流盤',kind:'gear',count:3,cycle:15,warning:4,strike:4,damage:28,color:0xe4b37b,description:'熱壓升起時先退開，停穩後再轉向金色標記。一、二、三號盤每次轉一、二、三格；三條管線接好，回程燈就不會跟著舊機器熄滅。'},
    '-50':{name:'原初歸途誓陣',environmentId:'heart',nodeName:'歸途石印',kind:'heart',count:3,cycle:16,warning:4,strike:4,damage:30,color:0xe8d29c,description:'平息後先解除一號石印，再把二號光鏡對準金色標記；最後分兩輪為三號回程燈充能。帶齊同行歸印並擊敗守門者，才能完成地下旅程。'},
  });
  function hash(seed,text){let h=seed>>>0;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  function newBoss(floor){const d=BOSSES[floor];return d?{floor,clock:0,started:false,done:false,seals:Array(d.count).fill(false),angles:Array(d.count).fill(0),charges:Array(d.count).fill(0),lastCycles:Array(d.count).fill(-1)}:null;}
  function validateBoss(value,floor,legacy=false){
    const d=BOSSES[floor];if(!d)return value===null?null:undefined;
    if(value===null&&legacy)return newBoss(floor);
    const b=value;if(!b||b.floor!==floor||!number(b.clock,0,315360000)||typeof b.started!=='boolean'||typeof b.done!=='boolean')return undefined;
    if(!Array.isArray(b.seals)||b.seals.length!==d.count||!b.seals.every(v=>typeof v==='boolean')||!Array.isArray(b.angles)||b.angles.length!==d.count||!b.angles.every(v=>integer(v,0,3)))return undefined;
    const charges=b.charges===undefined&&legacy?Array(d.count).fill(0):b.charges,lastCycles=b.lastCycles===undefined&&legacy?Array(d.count).fill(-1):b.lastCycles;
    if(!Array.isArray(charges)||charges.length!==d.count||!charges.every(v=>integer(v,0,2))||!Array.isArray(lastCycles)||lastCycles.length!==d.count||!lastCycles.every(v=>integer(v,-1,Math.floor(b.clock/d.cycle))))return undefined;
    if(b.done!==b.seals.every(Boolean)||b.done&&!b.started)return undefined;
    return {floor,clock:b.clock,started:b.started,done:b.done,seals:[...b.seals],angles:[...b.angles],charges:[...charges],lastCycles:[...lastCycles]};
  }
  function phase(run){const b=run.party?.boss,d=BOSSES[run.floor];if(!b)return 'none';if(!b.started)return 'idle';if(b.done)return 'done';const t=b.clock%d.cycle;return t<d.warning?'warning':t<d.warning+d.strike?'strike':'rest';}
  const cycle=run=>Math.floor(run.party.boss.clock/BOSSES[run.floor].cycle);
  function target(run,index){if(BOSSES[run.floor]?.kind==='gear'&&index===1)return 2;return 1+hash(run.seed,`mirror:${index}`)%3;}
  function hint(run){const b=run.party?.boss,d=BOSSES[run.floor];if(!b)return '';if(b.done)return '機關已解除，尋找主線印記與出口。';
    if(d.order)return '啟動順序：'+d.order.map(i=>i+1).join(' → ')+'；目前完成 '+b.seals.filter(Boolean).length+'/'+d.count;
    if(d.kind==='pulse')return '本輪白光'+d.nodeName+'：'+(cycle(run)%3+1)+' 號';
    if(d.kind==='frost')return '添火進度：'+b.charges.map((v,i)=>`${i+1} 號 ${v}/2`).join(' · ');
    if(d.kind==='steam')return b.seals[1]?'已洩壓，平息時關閉一、三號風口。':'黃光預警時，先操作二號洩壓閥。';
    if(d.kind==='heart')return !b.seals[0]?'第一步：解除一號石印。':!b.seals[1]?'第二步：二號光鏡對準金色標記。':'第三步：三號塔心充能 '+b.charges[2]+'/2（每輪一次）。';
    return d.description;
  }
  function bossAction(run,index,revision){return C().transaction(run,revision,n=>{
    const b=n.party?.boss,d=BOSSES[n.floor];if(!b||!integer(index,0,d.count-1)||b.done)return {ok:false,message:'這座迷宮機關已經安靜下來。'};
    if(n.expedition.active)return {ok:false,message:'請先離開副本。'};
    if(!b.started){b.started=true;return {ok:true,message:d.description};}
    if(b.seals[index])return {ok:false,message:'這座機關已經解開。'};
    const current=phase(n),round=cycle(n);
    if(d.kind==='steam'&&!b.seals[1]){
      if(index!==1||current!=='warning')return {ok:false,message:'先趁黃光預警，打開二號洩壓閥。'};
      b.seals[1]=true;
    }else{
      if(current!=='rest')return {ok:false,message:'先退到警戒圈外，等機關平息再操作。'};
      if(d.order&&index!==d.order.find(i=>!b.seals[i]))return {ok:false,message:hint(n)};
      if(d.kind==='pulse'&&index!==round%3)return {ok:false,message:hint(n)};
      if(d.kind==='heart'&&index!==b.seals.findIndex(v=>!v))return {ok:false,message:hint(n)};
      if(d.kind==='frost'||d.kind==='heart'&&index===2){
        if(b.lastCycles[index]===round)return {ok:false,message:'這次能量還在流動，等下一輪平息後再補一次。'};
        b.lastCycles[index]=round;b.charges[index]++;b.seals[index]=b.charges[index]===2;
      }else if(['mirror','reverse','gear'].includes(d.kind)||d.kind==='heart'&&index===1){
        const step=d.kind==='reverse'?3:d.kind==='gear'?index+1:1;
        b.angles[index]=(b.angles[index]+step)%4;b.seals[index]=b.angles[index]===target(n,index);
      }else b.seals[index]=true;
    }
    b.done=b.seals.every(Boolean);
    if(b.done){n.coins=Math.min(999999,n.coins+35);n.party.ingredients.shell=Math.min(99,n.party.ingredients.shell+3);}
    return {ok:true,message:b.done?'迷宮平息了！獲得三十五枚銅幣與三份硬殼。':b.seals[index]?'這座機關解開了。'+hint(n):'機關有了反應。'+hint(n)};
  });}
  function danger(run,index){const d=BOSSES[run.floor],b=run.party.boss;
    let radius=d.kind==='chase'?Math.min(2.6,1.7+cycle(run)*.2):d.kind==='tide'?2.5-b.seals.filter(Boolean).length*.3:1.7;
    const active=phase(run)==='strike'&&!b.seals[index]&&(d.kind!=='pulse'||index===cycle(run)%3);
    return {radius,active,damage:d.damage,cycle:cycle(run)};
  }
  const SITES=Object.freeze({
    swordsman:{name:'卡住的石門',verb:'撐起石門',description:'石門卡住了一條捷徑。劍士能直接撐起；也可以一起慢慢清除碎石。',reward:'開通附近一道內牆，獲得短暫護盾。'},
    mage:{name:'失控的定牆符文',verb:'穩定符文',description:'古代符文正影響牆壁。術士能解讀；也可以慢慢比對碑文。',reward:'暫停迷宮變形二十秒。'},
    scout:{name:'被掩蓋的暗門',verb:'找出暗扣',description:'牆邊有不自然的接縫。遊俠能直接找到暗扣；也可以仔細敲查石壁。',reward:'開通附近一道內牆，顯示十八秒出口路線。'},
    chef:{name:'棘殼食材箱',verb:'處理食材',description:'當地食材藏在帶刺硬殼裡。廚師能快速處理；也可以慢慢去除外殼。',reward:'取得兩份當地特色食材。'},
    healer:{name:'受污染的泉眼',verb:'淨化泉水',description:'泉水混著灰色雜質。療癒師能淨化；也可以反覆過濾。',reward:'恢復主角十二點生命、同伴十點生命。'},
    smith:{name:'損壞的機關箱',verb:'修復機關',description:'齒輪箱裡的卡榫斷了。鍛匠能修復；也可以慢慢拆開重組。',reward:'取得四份金屬零件，穿戴裝備恢復兩點耐久。'},
    archer:{name:'斷索箭臺',verb:'重新繫索',description:'高處的箭臺斷了繩索。射手能以弓繩接回；也可以慢慢搬石搭梯。',reward:'取得三十支箭矢，顯示十二秒出口路線；箭袋放不下的部分不會加入。'},
    robot:{name:'沉睡動力閘',verb:'校準動力閘',description:'牆邊的動力閘失去了同步。機器人能重新校準；也可以慢慢調整轉輪。',reward:'取得兩份金屬零件，為所有能行動的機器人補充25%能源。'},
  });
  const emptyMaterials=()=>Object.fromEntries(Object.keys(Materials().MATERIALS).map(k=>[k,0]));
  function materialStock(value){
    if(value===undefined)return emptyMaterials();
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==Object.keys(Materials().MATERIALS).length||!Object.keys(Materials().MATERIALS).every(k=>own(value,k)&&integer(value[k],0,99)))return null;
    return {...value};
  }
  // 雜貨商蘇禾 sells a few metal parts per floor. The optional per-floor counter
  // lives on the journey (absent means none bought) and resets on every descent.
  const SCRAP_SHOP=Object.freeze({merchantId:'suHe',price:5,stock:5});
  function newJourney(floor){return {version:1,scrap:0,materials:emptyMaterials(),maintenance:[],site:{floor,progress:0,done:false,method:null,catalogVersion:2}};}
  function validateJourney(value,floor){if(value===undefined)return newJourney(floor);const v=value,s=v?.site;
    if(!v||v.version!==1||!integer(v.scrap,0,99)||!s||s.floor!==floor||!number(s.progress,0,12)||typeof s.done!=='boolean'||![null,'profession','work'].includes(s.method)||s.done!==(s.method!==null)||s.done&&s.progress!==12)return null;
    const materials=materialStock(v.materials),maintenance=v.maintenance===undefined?[]:v.maintenance;if(!materials||!Array.isArray(maintenance)||maintenance.length>149||new Set(maintenance).size!==maintenance.length||!maintenance.every(f=>integer(f,1,99)||integer(f,-50,-1)))return null;
    const catalogVersion=s.catalogVersion===undefined?1:s.catalogVersion;if(![1,2].includes(catalogVersion))return null;
    const bought=v.scrapBought===undefined?0:v.scrapBought;if(!integer(bought,0,SCRAP_SHOP.stock))return null;
    return {version:1,scrap:v.scrap,materials,maintenance:[...maintenance],site:{floor,progress:s.progress,done:s.done,method:s.method,catalogVersion},...(bought?{scrapBought:bought}:{})};
  }
  function scrapOffer(run){
    const p=run?.party;if(!p?.journey||run.expedition?.active||!E()?.merchantOffers?.(run.floor,run.seed,!!p.loadouts)?.some(m=>m.id===SCRAP_SHOP.merchantId))return null;
    const bought=p.journey.scrapBought||0;return {merchantId:SCRAP_SHOP.merchantId,price:SCRAP_SHOP.price,stock:SCRAP_SHOP.stock,bought,remaining:Math.max(0,SCRAP_SHOP.stock-bought),owned:p.journey.scrap,room:Math.max(0,99-p.journey.scrap)};
  }
  function buyScrap(run,merchantId,quantity=1,revision=run?.revision){return C().transaction(run,revision,n=>{
    const offer=scrapOffer(n);if(!offer||merchantId!==offer.merchantId)return {ok:false,message:'這位商人沒有出售金屬零件。'};
    if(!integer(quantity,1,SCRAP_SHOP.stock))return {ok:false,message:'購買數量無效，請重新選擇。'};
    if(quantity>offer.remaining)return {ok:false,message:offer.remaining?'本層只剩 '+offer.remaining+' 份金屬零件。':'本層的金屬零件已經賣完了，下一層再來看看。'};
    if(n.party.journey.scrap+quantity>99)return {ok:false,message:'零件袋放不下（最多 99 份）。'};
    const cost=offer.price*quantity;if(n.coins<cost)return {ok:false,message:'銅幣不足。'};
    n.coins-=cost;n.party.journey.scrap+=quantity;n.party.journey.scrapBought=offer.bought+quantity;
    return {ok:true,message:'向蘇禾購買金屬零件 × '+quantity+'。',effect:{scrap:quantity,cost}};
  });}
  function siteOffer(run){if(!run.party||BOSSES[run.floor])return null;const jobs=Object.keys(SITES),count=run.party.journey?.site?.catalogVersion===2?jobs.length:6,job=jobs[hash(run.seed,`site:${run.floor}`)%count];return {id:`site:${run.floor}:${run.seed}`,job,...SITES[job],...(job==='chef'?{reward:'取得兩份'+Materials().INGREDIENTS[Materials().signature(run)]+'。'}:{})};}
  function explore(run,id,method,revision){return C().transaction(run,revision,n=>{
    const offer=siteOffer(n),s=n.party?.journey.site;if(n.expedition.active||!offer||id!==offer.id||s.done)return {ok:false,message:'這處探索已完成，或不在當前樓層。'};
    if(method==='profession'){if(!P().has(n,offer.job))return {ok:false,message:'隊伍目前沒有能出手的對應職業。'};}
    else if(method!=='work'||s.progress<12)return {ok:false,message:'還需要一些時間，請留在機關旁完成處理。'};
    s.done=true;s.progress=12;s.method=method;n.coins=Math.min(999999,n.coins+8);
    if(offer.job==='swordsman')n.effects.shield=Math.max(n.effects.shield,12);
    if(offer.job==='mage')n.effects.freeze=Math.max(n.effects.freeze,20);
    if(offer.job==='scout')n.effects.reveal=Math.max(n.effects.reveal,18);
    if(offer.job==='chef'){const key=Materials().signature(n);n.party.ingredients[key]=Math.min(99,n.party.ingredients[key]+2);}
    if(offer.job==='healer'){if(n.party.loadouts)H().ids(n).forEach(id=>H().heal(n,id,id==='hero'?12:10));else{n.hp=Math.min(C().MAX_HP,n.hp+12);n.party.members.forEach(m=>m.hp=Math.min(P().memberMax(m),m.hp+10));}}
    if(offer.job==='smith'){n.party.journey.scrap=Math.min(99,n.party.journey.scrap+4);Object.values(n.equipment).filter(g=>g&&!H().ROBOT.isCore(g)&&g.durability>0).forEach(g=>g.durability=Math.min(g.maxDurability,g.durability+2));}
    if(offer.job==='archer'){n.bag.arrow=Math.max(n.bag.arrow,Math.min(C().itemLimit('arrow',n),n.bag.arrow+30));n.effects.reveal=Math.max(n.effects.reveal,12);}
    if(offer.job==='robot'){n.party.journey.scrap=Math.min(99,n.party.journey.scrap+2);if(n.party.loadouts)for(const actorId of H().ids(n))if(H().job(n,actorId)==='robot'&&H().hp(n,actorId)>0)H().ROBOT.fillFuel(n,'power_glimmer',actorId);}
    return {ok:true,message:'完成探索，獲得八枚銅幣。'+offer.reward,effect:{passage:['swordsman','scout'].includes(offer.job)}};
  });}
  const TRAITS=Object.freeze(Object.fromEntries(Object.entries({
    durable:{name:'耐用',description:'一級持續節省10%耐久損耗，二級20%；按實際損耗決定性累計，修理不重置進度。舊有未用完的保護次數保留。',parts:3,coins:8,materialCost:{ironore:1}},
    light:{name:'輕巧',description:'武器每級縮短揮擊間隔 0.08 秒；防具每級移速增加 3%，全身最高 6%。',parts:3,coins:8,materialCost:{toughfiber:1}},
    grip:{name:'防滑',description:'僅防具：每級降低一點陷阱傷害，全身最多四點，並減輕緩速。',parts:3,coins:8,materialCost:{toughfiber:1},slots:['helmet','armor','shield']},
    sharp:{name:'鋒銳',description:'物理武器每級增加 8% 傷害；可用於劍、鎚、鍋、雙短刃及弓，不適用法杖與法書。',parts:4,coins:10,materialCost:{ironore:2,embercore:1},modernOnly:true,slots:['weapon'],types:['blade','hammer','pan','daggers','bow'],effects:{physicalPct:.08}},
    plated:{name:'疊甲',description:'每級讓這件防具增加 2 點防禦；頭部、身體與盾牌可各自強化。裝備損壞時失效。',parts:4,coins:10,materialCost:{ironore:2,crystalshard:1},modernOnly:true,slots:['helmet','armor','shield'],effects:{defense:2}},
    starvein:{name:'星脈',description:'地下限定。法杖或法書每級增加 12% 法術傷害，並增加 5 個百分點的治療與輔助加成。',parts:6,coins:18,materialCost:{starore:2,crystalshard:1},modernOnly:true,underground:true,slots:['weapon'],types:['staff','book'],effects:{spellPct:.12,support:.05}},
    abyssward:{name:'鎮淵',description:'地下限定。每級在防禦減傷前抵銷 1 點怪物攻擊，全身最高 4 點；不抵銷陷阱或飢餓，仍至少承受 1 點原始攻擊。',parts:6,coins:18,materialCost:{abyssalloy:2,embercore:1},modernOnly:true,underground:true,slots:['helmet','armor','shield'],effects:{monsterFlat:1}},
  }).map(([id,t])=>[id,Object.freeze({...t,id,icon:'forge_'+id,maxLevel:2,materialCost:Object.freeze(t.materialCost),slots:Object.freeze(t.slots||['weapon','helmet','armor','shield']),...(t.types?{types:Object.freeze(t.types)}:{}),effects:Object.freeze(t.effects||{})})])));
  function traitFits(trait,definition){const t=TRAITS[trait];return !!t&&!!definition&&!definition.integrated&&!definition.core&&t.slots.includes(definition.slot)&&(!t.types||t.types.includes(definition.type));}
  function validateForge(value,slot,definition){if(value===undefined)return undefined;if(!value||!own(TRAITS,value.trait)||!integer(value.level,1,2)||!integer(value.reserve,0,value.trait==='durable'?value.level*2:0)||!TRAITS[value.trait].slots.includes(slot)||definition&&!traitFits(value.trait,definition)||value.wearCredit!==undefined&&(value.trait!=='durable'||!integer(value.wearCredit,0,9)))return null;return {trait:value.trait,level:value.level,reserve:value.reserve,...(value.trait==='durable'?{wearCredit:value.wearCredit??0}:{})};}
  const traitPower=(gear,key)=>gear?.durability>0?(TRAITS[gear.forge?.trait]?.effects[key]||0)*(gear.forge?.level||0):0;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const allGear=run=>run.party?.loadouts?H().allGear(run):[...run.gearBag,...Object.values(run.equipment).filter(Boolean)];
  const salvageValue=g=>Math.min(6,1+g.bonus+Math.floor(g.durability/(4*C().durabilityMultiplier(g.kind))));
  function serviceRule(run,gear,service){
    if(service===undefined||service?.kind==='camp')return {merchant:false,allowed:!!P().has(run,'smith'),reason:'完整修復與鍛造需要隊伍中仍能行動的鍛匠；也可尋找負責這類裝備的商人。'};
    const allowed=E().serviceAvailable(run,service,gear);
    return {merchant:service?.kind==='merchant',allowed,reason:'這位商人不在本層，或不承作這類裝備。'};
  }
  function repairQuote(run,id,service){
    const g=allGear(run).find(g=>g.id===id);if(!run.party||!g||H().ROBOT?.isCore(g)||g.durability===g.maxDurability)return null;
    const broken=g.durability===0,units=Math.ceil((g.maxDurability-g.durability)/(4*C().durabilityMultiplier(g.kind)));
    const discount=run.party.loadouts?H().teamPassive(run,'economy'):P().has(run,'smith')?50:0;
    const rule=serviceRule(run,g,service),normalCoins=Math.ceil(units*6*(1-discount/100)),baseCoins=broken?Math.ceil(normalCoins*1.5):normalCoins,coins=rule.merchant?Math.ceil(baseCoins*1.2):baseCoins,parts=Math.max(1,Math.ceil(units/2));
    return {broken,normalCoins,baseCoins,coins,parts,allowed:rule.allowed,reason:rule.allowed?'':rule.reason,merchant:rule.merchant};
  }
  function repair(run,id,revision,service){return C().transaction(run,revision,n=>{
    const q=repairQuote(n,id,service);if(!q)return {ok:false,message:'這件裝備不需要修理，或已經被移走。'};
    if(!q.allowed)return {ok:false,message:q.reason};
    if(n.coins<q.coins||n.party.journey.scrap<q.parts)return {ok:false,message:`需要 ${q.coins} 枚銅幣與 ${q.parts} 份金屬零件。`};
    const g=allGear(n).find(g=>g.id===id);n.coins-=q.coins;n.party.journey.scrap-=q.parts;g.durability=g.maxDurability;
    return {ok:true,message:'修復 '+g.name+'，耐久已補滿。',effect:{repaired:g.id,broken:q.broken}};
  });}
  function repairAllQuote(run,service,options={}){
    const valid=service?.kind==='merchant'&&E().serviceContext(run,service.merchantId);
    const below=options.below===undefined?1:options.below,validOptions=number(below,0,1);
    const entries=valid&&validOptions?allGear(run).map(g=>({gear:g,quote:repairQuote(run,g.id,service)})).filter(e=>e.quote?.allowed&&e.gear.durability/e.gear.maxDurability<below):[];
    const coins=entries.reduce((sum,e)=>sum+e.quote.coins,0),parts=entries.reduce((sum,e)=>sum+e.quote.parts,0);
    return {allowed:entries.length>0,affordable:!!run.party&&run.coins>=coins&&run.party.journey.scrap>=parts,coins,parts,below,entries:entries.map(({gear,quote})=>({id:gear.id,name:gear.name,kind:gear.kind,broken:quote.broken,coins:quote.coins,parts:quote.parts})),reason:entries.length?'':!validOptions?'維修門檻不合法。':below<1?'沒有低於指定耐久比例、且由這位商人負責的裝備。':'這位商人負責的裝備目前無需修理。'};
  }
  function repairAll(run,revision,service,options={}){return C().transaction(run,revision,n=>{
    const q=repairAllQuote(n,service,options);if(!q.allowed)return {ok:false,message:q.reason};
    if(!q.affordable)return {ok:false,message:`全部修復需 ${q.coins} 枚銅幣與 ${q.parts} 份金屬零件，尚未扣款或修理。`};
    const ids=new Set(q.entries.map(e=>e.id));for(const g of allGear(n))if(ids.has(g.id))g.durability=g.maxDurability;
    n.coins-=q.coins;n.party.journey.scrap-=q.parts;
    return {ok:true,message:`已修復 ${q.entries.length} 件裝備。`,effect:{repaired:[...ids],coins:q.coins,parts:q.parts}};
  });}
  // An explicit alternative to full repair: pool only small, non-broken losses.
  // Full/all repair above keeps its promised individual-quote pricing.
  function maintenanceAllQuote(run,service){
    const valid=service?.kind==='merchant'&&E().serviceContext(run,service.merchantId),entries=valid?allGear(run).filter(g=>g.durability>0&&g.durability<g.maxDurability&&g.durability/g.maxDurability>=.7&&!H().ROBOT.isCore(g)&&E().serviceAvailable(run,service,g)):[],units=entries.reduce((sum,g)=>sum+(g.maxDurability-g.durability)/(4*C().durabilityMultiplier(g.kind)),0),discount=run.party?.loadouts?H().teamPassive(run,'economy'):P().has(run,'smith')?50:0,coins=entries.length?Math.ceil(Math.ceil(Math.max(1,Math.ceil(units))*6*(1-discount/100))*1.2):0,parts=entries.length?Math.max(1,Math.ceil(units/2)):0;
    return {allowed:entries.length>0,affordable:!!run.party&&run.coins>=coins&&run.party.journey.scrap>=parts,coins,parts,entries:entries.map(g=>({id:g.id,name:g.name,kind:g.kind})),reason:entries.length?'':'沒有可合批保養的裝備；此服務只處理耐久至少70%、尚未損壞的專門裝備。'};
  }
  function maintenanceAll(run,revision,service){return C().transaction(run,revision,n=>{const q=maintenanceAllQuote(n,service);if(!q.allowed)return {ok:false,message:q.reason};if(!q.affordable)return {ok:false,message:`合批保養需 ${q.coins} 枚銅幣與 ${q.parts} 份金屬零件，尚未扣款。`};const selected=new Set(q.entries.map(e=>e.id));for(const g of allGear(n))if(selected.has(g.id))g.durability=g.maxDurability;n.coins-=q.coins;n.party.journey.scrap-=q.parts;return {ok:true,message:`已合批保養 ${q.entries.length} 件裝備。`,effect:{repaired:[...selected],coins:q.coins,parts:q.parts,maintenance:true}};});}
  function emergencyRepairAmount(gear,percent){return !gear||H().ROBOT.isCore(gear)||gear.durability<=0||!number(percent,0,100)||percent===0?0:Math.min(30,Math.max(1,Math.ceil(gear.maxDurability*percent/100)),gear.maxDurability-gear.durability);}
  function dismantle(run,id,revision,service){return C().transaction(run,revision,n=>{
    if(!n.party)return {ok:false,message:'請先選擇冒險職業。'};const g=allGear(n).find(g=>g.id===id);if(!g)return {ok:false,message:'裝備已不在背包裡。'};
    if(H().ROBOT?.isPart(g.kind))return {ok:false,message:'機殼與雙拳不能拆解，請使用機體強化。'};
    if(H().ROBOT?.isCore(g.kind))return {ok:false,message:'動力核心不能拆解或維修，耗盡後請重新製作。'};
    const access=serviceRule(n,g,service);if(!access.allowed)return {ok:false,message:access.reason};
    const value=salvageValue(g);if(n.party.journey.scrap+value>99)return {ok:false,message:'零件袋放不下，請先使用零件。'};
    n.party.journey.scrap+=value;n.gearBag=n.gearBag.filter(x=>x.id!==id);if(n.equipment[g.slot]?.id===id)n.equipment[g.slot]=null;if(n.party.loadouts)for(const id of H().ids(n)){const e=H().equipment(n,id);if(e[g.slot]?.id===g.id)e[g.slot]=null;}
    return {ok:true,message:`拆解${g.name}，獲得${value}份金屬零件。`};
  });}
  function forgeQuote(run,id,trait,service){
    const t=own(TRAITS,trait)?TRAITS[trait]:null,g=run?.party?allGear(run).find(g=>g.id===id):null;if(!t||!g||H().ROBOT?.isPart(g.kind)||H().ROBOT?.isCore(g.kind))return null;
    const definition=C().GEAR[g.kind],level=(g.forge?.level||0)+1,discount=run.party.loadouts?H().teamPassive(run,'economy'):P().has(run,'smith')?50:0,parts=level*t.parts,rule=serviceRule(run,g,service),baseCoins=Math.ceil(level*t.coins*(1-discount/100)),coins=rule.merchant?Math.ceil(baseCoins*1.2):baseCoins;
    const materialCost=Object.fromEntries(Object.entries(t.materialCost).map(([key,count])=>[key,count*level]));
    const reason=!traitFits(trait,definition)?'這種特性不適用目前裝備。':t.modernOnly&&!run.party.loadouts?'此特性需要職業裝備系統。':t.underground&&!C().isUnderworld(run)?'地下探索開放後才能進行這種鍛造。':g.durability===0?'請先修復損壞裝備。':g.forge&&g.forge.trait!==trait?'每件裝備只能保留一種特性，不能改選。':level>2?'這件裝備的特性已達二級。':!rule.allowed?rule.reason:'';
    return {trait,name:t.name,level,parts,baseCoins,coins,materialCost,allowed:!reason,reason,merchant:rule.merchant,affordable:run.party.journey.scrap>=parts&&run.coins>=coins&&Object.entries(materialCost).every(([key,count])=>(run.party.journey.materials?.[key]||0)>=count),underground:!!t.underground};
  }
  function forgeOptions(run,gear,service){if(!gear||!run?.party)return [];return Object.keys(TRAITS).filter(t=>genuine(t)&&(!gear.forge||gear.forge.trait===t)).map(t=>forgeQuote(run,gear.id,t,service)).filter(Boolean);
    function genuine(t){return traitFits(t,C().GEAR[gear.kind])&&(!TRAITS[t].modernOnly||!!run.party.loadouts);}
  }
  function forge(run,id,trait,revision,service){return C().transaction(run,revision,n=>{
    const q=forgeQuote(n,id,trait,service);if(!q)return {ok:false,message:'無效的鍛造選項。'};if(!q.allowed)return {ok:false,message:q.reason};
    if(!q.affordable)return {ok:false,message:`需要${q.parts}份金屬零件、${q.coins}枚銅幣，以及`+Object.entries(q.materialCost).map(([key,count])=>count+'份'+Materials().MATERIALS[key]).join('、')+'。'};
    const g=allGear(n).find(g=>g.id===id);n.party.journey.scrap-=q.parts;n.coins-=q.coins;for(const[key,count]of Object.entries(q.materialCost))n.party.journey.materials[key]-=count;g.forge={trait,level:q.level,reserve:g.forge?.reserve||0,...(trait==='durable'?{wearCredit:g.forge?.wearCredit||0}:{})};
    return {ok:true,message:`${g.name}獲得${TRAITS[trait].name}，第${q.level}級。`};
  });}
  function wear(run,g){if(g.durability<=0)return;if(g.forge?.reserve>0){g.forge.reserve--;return;}if(g.forge?.trait==='durable'){g.forge.wearCredit=(g.forge.wearCredit||0)+g.forge.level;if(g.forge.wearCredit>=10){g.forge.wearCredit-=10;return;}}g.durability--;if(g.durability===0&&run.party&&!run.party.loadouts)run.party.journey.scrap=Math.min(99,run.party.journey.scrap+1);}
  function traits(run){let light=0,grip=0;for(const g of Object.values(run.equipment||{}).filter(g=>g&&g.durability>0&&g.slot!=='weapon')){if(g.forge?.trait==='light')light+=g.forge.level;if(g.forge?.trait==='grip')grip+=g.forge.level;}return {speed:1+Math.min(2,light)*.03,grip:Math.min(4,grip)};}
  function attackInterval(run){const f=run.equipment.weapon?.forge;return .8-(f?.trait==='light'?f.level*.08:0);}
  return Object.freeze({BOSSES,SITES,TRAITS,newBoss,validateBoss,phase,cycle,target,hint,bossAction,danger,SCRAP_SHOP,newJourney,validateJourney,scrapOffer,buyScrap,siteOffer,explore,validateForge,traitFits,traitPower,allGear,salvageValue,dismantle,repairQuote,repair,repairAllQuote,repairAll,maintenanceAllQuote,maintenanceAll,emergencyRepairAmount,forgeQuote,forgeOptions,forge,wear,traits,attackInterval});
});
