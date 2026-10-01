/* Personality-based awareness, independent of floor difficulty. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerMonsterSense=api;})(globalThis,function(){
  'use strict';
  const PERSONALITIES=Object.freeze({
    mushroom:{range:5,personality:'膽小，只保護自己的傘蓋',hearing:false},crab:{range:7,personality:'守地盤，靠近才追趕',hearing:false},moth:{range:10,personality:'警覺，振翅呼叫同類',hearing:false},flower:{range:9,personality:'伏擊，等待進入射程',hearing:false},
    clockmite:{range:6,personality:'遲鈍巡邏，貼近才察覺',hearing:false},sentinel:{range:8,personality:'守衛通道，盡忠但不遠追',hearing:false},shardseer:{range:13,personality:'主動尋敵，以晶光遠攻',hearing:false},wisp:{range:12,personality:'好奇而敏銳，追逐陌生氣息',hearing:false},hound:{range:18,personality:'積極獵殺，能循聲追蹤',hearing:true},
  });
  const profile=def=>PERSONALITIES[def.id]||{range:def.sight||8,personality:def.personality||'警戒旅人',hearing:['lord-furnace','lord-clockwork'].includes(def.id)};
  function detect(def,{distance,line,hidden=false,alert=0}){const p=profile(def),range=(hidden?Math.min(2,p.range):p.range)+Math.min(4,Math.max(0,alert));return Number.isFinite(distance)&&distance<=range&&(line===true||p.hearing&&!hidden);}
  return Object.freeze({PERSONALITIES,profile,detect});
});
