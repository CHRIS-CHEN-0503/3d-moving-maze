/* Personality-based awareness, independent of floor difficulty. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerMonsterSense=api;})(globalThis,function(){
  'use strict';
  const PERSONALITIES=Object.freeze({
    mushroom:{range:5,personality:'膽小，只保護自己的傘蓋',hearing:false},crab:{range:7,personality:'守地盤，靠近才追趕',hearing:false},moth:{range:10,personality:'警覺，振翅呼叫同類',hearing:false},flower:{range:9,personality:'伏擊，等待進入射程',hearing:false},
    clockmite:{range:6,personality:'遲鈍巡邏，貼近才察覺',hearing:false},sentinel:{range:8,personality:'守衛通道，盡忠但不遠追',hearing:false},shardseer:{range:13,personality:'主動尋敵，以晶光遠攻',hearing:false},wisp:{range:12,personality:'好奇而敏銳，追逐陌生氣息',hearing:false},hound:{range:18,personality:'積極獵殺，能循聲追蹤',hearing:true},
  });
  // These are player-facing observations of the actual combat rules, not a
  // second AI definition. Awareness distances and attack behavior stay above.
  const TACTICS=Object.freeze(Object.fromEntries(Object.entries({
    mushroom:{role:'孢子牽制',threat:'靠太近會受傷，孢子還會讓腳步變慢。',tell:'準備出手時，腳下的警示會變亮。',counter:'先退開一小段，等牠出手後再靠近；緩速時別硬擠過身旁。'},
    crab:{role:'正面防守',threat:'正面的岩殼能擋下不少傷害。',tell:'牠會轉身面向你，再準備鉗擊。',counter:'請一位隊友吸引牠，其他人繞到側面或背後攻擊。'},
    moth:{role:'呼叫同類',threat:'近身振翅示警，會讓附近怪物更容易發現你。',tell:'留意翅膀和腳下亮起的警示。',counter:'先把牠引離其他怪物，再出手；別在怪群中追著牠跑。'},
    flower:{role:'固定砲台',threat:'根不會移動，但會朝看見的人吐出種子。',tell:'先朝你瞄準，停一下才射擊。',counter:'利用轉角靠近，看到蓄力就側移；束縛不能阻止牠吐種子。'},
    clockmite:{role:'近身巡邏',threat:'反應範圍小，但擦身而過一樣會受傷。',tell:'靠近後會轉向追來，出手前警示變亮。',counter:'在岔路拉開距離，等牠出手落空再反擊。'},
    sentinel:{role:'通道守衛',threat:'移動慢，撞上或挨打都很痛。',tell:'靠近時會停步蓄力，準備揮擊。',counter:'留一條退路，利用攻擊間隔出手；不要從牠身體穿過。'},
    shardseer:{role:'遠程施法',threat:'在遠處瞄準，再射出晶光彈。',tell:'朝你轉身並蓄力，瞄準的是那一刻的位置。',counter:'看到蓄力就往側面走，或躲到牆後；擊暈可以中斷施法。'},
    wisp:{role:'快速追逐',threat:'忽快忽慢，容易從岔路追上來。',tell:'身體會浮動，追逐時速度並不固定。',counter:'保留轉角空間，搭配緩速或驅怪鈴拉開距離。'},
    hound:{role:'循聲獵手',threat:'遠處也能聽見你，隔著牆仍可能追蹤。',tell:'一察覺你，就會快速沿通道追來。',counter:'用緩速、擊暈或驅怪鈴爭取退路；只躲到薄牆後還不夠。'},
  }).map(([id,value])=>[id,Object.freeze(value)])));
  const profile=def=>Object.hasOwn(PERSONALITIES,def?.id)?PERSONALITIES[def.id]:{range:def?.sight||8,personality:def?.personality||'警戒旅人',hearing:['lord-furnace','lord-clockwork'].includes(def?.id)};
  function tactics(def){
    if(Object.hasOwn(TACTICS,def?.id))return TACTICS[def.id];
    return {role:def?.ranged?'遠程守門':'近身守門',threat:def?.ranged?'蓄力後射擊，近身碰撞也會受傷。':'近身重擊威力高，接觸身體也會受傷。',tell:def?.ranged?'轉向你並停步蓄力，腳下警示變亮。':'靠近後停步蓄力，腳下警示變亮。',counter:def?.ranged?'蓄力時側移，用牆壁擋住飛行物。':'先退開躲過重擊，再帶隊反擊；別堵住撤退路。',...def?.tactics};
  }
  function detect(def,{distance,line,hidden=false,alert=0}){const p=profile(def),range=(hidden?Math.min(2,p.range):p.range)+Math.min(4,Math.max(0,alert));return Number.isFinite(distance)&&distance<=range&&(line===true||p.hearing&&!hidden);}
  return Object.freeze({PERSONALITIES,TACTICS,profile,tactics,detect});
});
