/* Only gameplay fields cross the room boundary. Technical endpoints are never player preferences. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GameRules=api;})(globalThis,function(){
  'use strict';
  const FIELDS=Object.freeze({
    mazeSize:{label:'迷宮大小',value:13,choices:[11,13,15,19,25]},
    teamSize:{label:'每隊人數（缺額電腦補位）',value:2,choices:[2,3,4,5],modes:['ctf']},
    shiftMin:{label:'迷宮變換間隔（分鐘）',value:3,min:.5,max:10,step:.5},
    itemCount:{label:'每次出現的道具',value:6,min:3,max:12,step:1},
    foodCount:{label:'每次出現的食物',value:4,min:2,max:10,step:1,modes:['classic','tag']},
    hungerMin:{label:'飽足感持續（分鐘）',value:3,min:1,max:10,step:.5,modes:['classic','tag']},
    stunSec:{label:'攻擊暈眩（秒）',value:3,min:1,max:10,step:.5,modes:['treasure']},
    pingSec:{label:'寶藏位置更新（秒）',value:3,min:1,max:10,step:1,modes:['treasure']},
    smellCells:{label:'鬼的嗅覺範圍（格）',value:3,min:1,max:8,step:1,modes:['tag']},
    goodsCount:{label:'架上商品數量',value:16,min:6,max:60,step:1,modes:['shop']},
    shopMin:{label:'每輪時間（分鐘）',value:2.5,min:1,max:10,step:.5,modes:['shop']},
    cartFull:{label:'購物車滿載金額',value:400,min:100,max:2000,step:50,modes:['shop']},
  });
  function normalize(input={}){
    const result={};
    for(const [key,def] of Object.entries(FIELDS)){
      const n=Number(input?.[key]);
      result[key]=def.choices?(def.choices.includes(n)?n:def.value):Number.isFinite(n)&&input?.[key]!==''&&input?.[key]!=null?Math.max(def.min,Math.min(def.max,Math.round(n/def.step)*def.step)):def.value;
    }
    const v=input?.views||{tp:1,fp:1,top:1};result.views={tp:v.tp===1||v.tp===true?1:0,fp:v.fp===1||v.fp===true?1:0,top:v.top===1||v.top===true?1:0};
    if(!Object.values(result.views).some(Boolean))result.views={tp:1,fp:1,top:1};
    return result;
  }
  function visible(mode){return Object.keys(FIELDS).filter(key=>!FIELDS[key].modes||FIELDS[key].modes.includes(mode==='race'?'classic':mode));}
  return Object.freeze({FIELDS,normalize,visible});
});
