/* Original expedition chapter mechanisms, optional field work and bounded forging. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerExpedition=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const own=(o,k)=>Object.hasOwn(o,k),number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
  const integer=(n,min,max)=>number(n,min,max)&&Number.isInteger(n);
  const BOSSES=Object.freeze({
    90:{name:'甦醒石陣',kind:'stone',count:2,cycle:14,warning:3,strike:3,damage:12,color:0x9bc9d0,description:'地面發亮時先退開；石柱收回後，解除兩座封印。'},
    80:{name:'吞光庭園',kind:'mirror',count:2,cycle:14,warning:3,strike:3,damage:15,color:0x87bf91,description:'藤蔓收回後，轉動兩座光鏡，讓光束對準旁邊的金色根芽。'},
    70:{name:'追獵迴廊',kind:'chase',count:3,cycle:16,warning:4,strike:4,damage:16,color:0xc5a17a,order:[0,1,2],description:'牆陣會逐輪向外推進。退到警戒圈外，平息時依序啟動一、二、三號定錨器。'},
    60:{name:'潮汐水閘',kind:'tide',count:3,cycle:18,warning:4,strike:5,damage:14,color:0x65bad0,order:[2,0,1],description:'水位會週期上升。退水後依序打開三、一、二號排水閘；每開一閘，危險範圍就會縮小。'},
    50:{name:'蒸汽熔爐',kind:'steam',count:3,cycle:17,warning:5,strike:4,damage:18,color:0xdc986b,description:'先在黃光預警時打開二號洩壓閥。蒸汽散去後，再關閉一號與三號爐心。'},
    40:{name:'逆光鏡廳',kind:'reverse',count:3,cycle:16,warning:4,strike:4,damage:16,color:0xb899d4,description:'三面鏡子會逆向轉動。等光刃收回，將光束逐一對準金色標記。'},
    30:{name:'脈動水道',kind:'pulse',count:3,cycle:15,warning:4,strike:4,damage:18,color:0x76d4c7,description:'每輪只有一座浮標亮起白光。水波退去後，操作當輪亮起的浮標；錯過就等下一輪。'},
    20:{name:'永凍迴廊',kind:'frost',count:3,cycle:18,warning:5,strike:4,damage:17,color:0xb4e7ee,description:'冰刺融化時，為每座暖爐添火兩次；同一座暖爐每輪只能添火一次。'},
    10:{name:'齒輪迷城',kind:'gear',count:3,cycle:16,warning:4,strike:4,damage:20,color:0xd8b071,description:'等齒輪停穩，再將指針轉到金色標記。一、二、三號齒輪每次分別轉一、二、三格。'},
    1:{name:'塔心・歸途試煉',kind:'heart',count:3,cycle:18,warning:5,strike:4,damage:20,color:0xe5b7be,description:'平息時先解除一號石印，再將二號光鏡對準金色標記；最後分兩輪替三號塔心充能。完成後仍須作出故事的最後選擇。'},
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
  function target(run,index){if(run.floor===10&&index===1)return 2;return 1+hash(run.seed,`mirror:${index}`)%3;}
  function hint(run){const b=run.party?.boss,d=BOSSES[run.floor];if(!b)return '';if(b.done)return '機關已解除，尋找主線印記與出口。';
    if(d.order)return '啟動順序：'+d.order.map(i=>i+1).join(' → ')+'；目前完成 '+b.seals.filter(Boolean).length+'/'+d.count;
    if(d.kind==='pulse')return '本輪白光浮標：'+(cycle(run)%3+1)+' 號';
    if(d.kind==='frost')return '添火進度：'+b.charges.map((v,i)=>`${i+1} 號 ${v}/2`).join(' · ');
    if(d.kind==='steam')return b.seals[1]?'已洩壓，平息時關閉一、三號爐心。':'黃光預警時，先操作二號洩壓閥。';
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
    scout:{name:'被掩蓋的暗門',verb:'找出暗扣',description:'牆邊有不自然的接縫。斥候能直接找到暗扣；也可以仔細敲查石壁。',reward:'開通附近一道內牆，顯示十八秒出口路線。'},
    chef:{name:'棘殼食材箱',verb:'處理食材',description:'食材藏在帶刺硬殼裡。廚師能快速處理；也可以慢慢去除外殼。',reward:'取得兩份甜根莖與兩份花蜜。'},
    healer:{name:'受污染的泉眼',verb:'淨化泉水',description:'泉水混著灰色雜質。療癒師能淨化；也可以反覆過濾。',reward:'恢復主角十二點生命、同伴十點生命。'},
    smith:{name:'損壞的機關箱',verb:'修復機關',description:'齒輪箱裡的卡榫斷了。鍛匠能修復；也可以慢慢拆開重組。',reward:'取得四份金屬零件，穿戴裝備恢復兩點耐久。'},
  });
  function newJourney(floor){return {version:1,scrap:0,site:{floor,progress:0,done:false,method:null}};}
  function validateJourney(value,floor){if(value===undefined)return newJourney(floor);const v=value,s=v?.site;
    if(!v||v.version!==1||!integer(v.scrap,0,99)||!s||s.floor!==floor||!number(s.progress,0,12)||typeof s.done!=='boolean'||![null,'profession','work'].includes(s.method)||s.done!==(s.method!==null)||s.done&&s.progress!==12)return null;
    return {version:1,scrap:v.scrap,site:{floor,progress:s.progress,done:s.done,method:s.method}};
  }
  function siteOffer(run){if(!run.party||BOSSES[run.floor])return null;const job=Object.keys(SITES)[hash(run.seed,`site:${run.floor}`)%6];return {id:`site:${run.floor}:${run.seed}`,job,...SITES[job]};}
  function explore(run,id,method,revision){return C().transaction(run,revision,n=>{
    const offer=siteOffer(n),s=n.party?.journey.site;if(n.expedition.active||!offer||id!==offer.id||s.done)return {ok:false,message:'這處探索已完成，或不在當前樓層。'};
    if(method==='profession'){if(!P().has(n,offer.job))return {ok:false,message:'隊伍目前沒有能出手的對應職業。'};}
    else if(method!=='work'||s.progress<12)return {ok:false,message:'還需要一些時間，請留在機關旁完成處理。'};
    s.done=true;s.progress=12;s.method=method;n.coins=Math.min(999999,n.coins+8);
    if(offer.job==='swordsman')n.effects.shield=Math.max(n.effects.shield,12);
    if(offer.job==='mage')n.effects.freeze=Math.max(n.effects.freeze,20);
    if(offer.job==='scout')n.effects.reveal=Math.max(n.effects.reveal,18);
    if(offer.job==='chef'){for(const k of ['root','nectar'])n.party.ingredients[k]=Math.min(99,n.party.ingredients[k]+2);}
    if(offer.job==='healer'){if(n.party.loadouts)H().ids(n).forEach(id=>H().heal(n,id,id==='hero'?12:10));else{n.hp=Math.min(C().MAX_HP,n.hp+12);n.party.members.forEach(m=>m.hp=Math.min(P().memberMax(m),m.hp+10));}}
    if(offer.job==='smith'){n.party.journey.scrap=Math.min(99,n.party.journey.scrap+4);Object.values(n.equipment).filter(g=>g&&g.durability>0).forEach(g=>g.durability=Math.min(g.maxDurability,g.durability+2));}
    return {ok:true,message:'完成探索，獲得八枚銅幣。'+offer.reward,effect:{passage:['swordsman','scout'].includes(offer.job)}};
  });}
  const TRAITS=Object.freeze({durable:{name:'耐用',description:'每級多承受兩次耐久消耗；修理不會補回這層保護。'},light:{name:'輕巧',description:'武器每級縮短揮擊間隔 0.08 秒；防具每級移速增加 3%，全身最高 6%。'},grip:{name:'防滑',description:'僅防具：每級降低一點陷阱傷害，全身最多四點，並減輕緩速。'}});
  function validateForge(value,slot){if(value===undefined)return undefined;if(!value||!own(TRAITS,value.trait)||!integer(value.level,1,2)||!integer(value.reserve,0,value.trait==='durable'?value.level*2:0)||value.trait==='grip'&&slot==='weapon')return null;return {trait:value.trait,level:value.level,reserve:value.reserve};}
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const allGear=run=>run.party?.loadouts?H().allGear(run):[...run.gearBag,...Object.values(run.equipment).filter(Boolean)];
  const salvageValue=g=>Math.min(6,1+g.bonus+Math.floor(g.durability/(4*C().durabilityMultiplier(g.kind))));
  function repairQuote(run,id){
    const g=allGear(run).find(g=>g.id===id);if(!run.party||!g||g.durability===g.maxDurability)return null;
    const broken=g.durability===0,units=Math.ceil((g.maxDurability-g.durability)/(4*C().durabilityMultiplier(g.kind)));
    const discount=run.party.loadouts?H().teamPassive(run,'economy'):P().has(run,'smith')?50:0;
    const normalCoins=Math.ceil(units*6*(1-discount/100)),coins=broken?Math.ceil(normalCoins*1.5):normalCoins,parts=Math.max(1,Math.ceil(units/2));
    return {broken,normalCoins,coins,parts,allowed:!broken||!!P().has(run,'smith')};
  }
  function repair(run,id,revision){return C().transaction(run,revision,n=>{
    const q=repairQuote(n,id);if(!q)return {ok:false,message:'這件裝備不需要修理，或已經被移走。'};
    if(!q.allowed)return {ok:false,message:'完全損壞的裝備，需要隊伍中仍能行動的鍛匠才能修復。'};
    if(n.coins<q.coins||n.party.journey.scrap<q.parts)return {ok:false,message:`需要 ${q.coins} 枚銅幣與 ${q.parts} 份金屬零件。`};
    const g=allGear(n).find(g=>g.id===id);n.coins-=q.coins;n.party.journey.scrap-=q.parts;g.durability=g.maxDurability;
    return {ok:true,message:'修復 '+g.name+'，耐久已補滿。',effect:{repaired:g.id,broken:q.broken}};
  });}
  function dismantle(run,id,revision){return C().transaction(run,revision,n=>{
    if(!n.party)return {ok:false,message:'請先選擇冒險職業。'};const g=allGear(n).find(g=>g.id===id);if(!g)return {ok:false,message:'裝備已不在背包裡。'};
    const value=salvageValue(g);if(n.party.journey.scrap+value>99)return {ok:false,message:'零件袋放不下，請先使用零件。'};
    n.party.journey.scrap+=value;n.gearBag=n.gearBag.filter(x=>x.id!==id);if(n.equipment[g.slot]?.id===id)n.equipment[g.slot]=null;if(n.party.loadouts)for(const id of H().ids(n)){const e=H().equipment(n,id);if(e[g.slot]?.id===g.id)e[g.slot]=null;}
    return {ok:true,message:`拆解${g.name}，獲得${value}份金屬零件。`};
  });}
  function forge(run,id,trait,revision){return C().transaction(run,revision,n=>{
    if(!n.party||!own(TRAITS,trait))return {ok:false,message:'無效的鍛造選項。'};
    const g=allGear(n).find(g=>g.id===id);if(!g||g.durability===0||g.forge?.level===2||g.forge&&g.forge.trait!==trait||trait==='grip'&&g.slot==='weapon')return {ok:false,message:'先修復破損裝備；每件裝備只能選一種特性，最多強化兩次。'};
    const level=(g.forge?.level||0)+1,parts=level*3,coins=n.party.loadouts?Math.ceil(level*8*(1-H().teamPassive(n,'economy')/100)):P().has(n,'smith')?level*4:level*8;
    if(n.party.journey.scrap<parts||n.coins<coins)return {ok:false,message:`需要${parts}份金屬零件與${coins}枚銅幣。`};
    n.party.journey.scrap-=parts;n.coins-=coins;g.forge={trait,level,reserve:(g.forge?.reserve||0)+(trait==='durable'?2:0)};
    return {ok:true,message:`${g.name}獲得${TRAITS[trait].name}，第${level}級。`};
  });}
  function wear(run,g){if(g.durability<=0)return;if(g.forge?.reserve>0)g.forge.reserve--;else g.durability--;if(g.durability===0&&run.party&&!run.party.loadouts)run.party.journey.scrap=Math.min(99,run.party.journey.scrap+1);}
  function traits(run){let light=0,grip=0;for(const g of Object.values(run.equipment||{}).filter(g=>g&&g.durability>0&&g.slot!=='weapon')){if(g.forge?.trait==='light')light+=g.forge.level;if(g.forge?.trait==='grip')grip+=g.forge.level;}return {speed:1+Math.min(2,light)*.03,grip:Math.min(4,grip)};}
  function attackInterval(run){const f=run.equipment.weapon?.forge;return .8-(f?.trait==='light'?f.level*.08:0);}
  return Object.freeze({BOSSES,SITES,TRAITS,newBoss,validateBoss,phase,cycle,target,hint,bossAction,danger,newJourney,validateJourney,siteOffer,explore,validateForge,allGear,salvageValue,dismantle,repairQuote,repair,forge,wear,traits,attackInterval});
});
