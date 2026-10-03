/* Only gameplay fields cross the room boundary. Technical endpoints are never player preferences. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GameRules=api;})(globalThis,function(){
  'use strict';
  const FIELDS=Object.freeze({
    mazeSize:{label:'迷宮大小',value:13,choices:[11,13,15,19,25]},
    magicMap:{label:'魔法地圖（探索迷霧）',value:0,choices:[0,1],labels:{0:'關閉：維持完整地圖',1:'開啟：探索後才顯示'},modes:['classic','treasure','tag','ctf']},
    duelMin:{label:'尋寶／奪旗時間（分鐘）',value:5,min:2,max:10,step:1,modes:['treasure','ctf']},
    unpaidRate:{label:'未結帳商品計分',value:100,choices:[100,50],labels:{100:'原規則：全額計分',50:'挑戰：只計一半'},modes:['shop']},
    teamSize:{label:'每隊人數',value:2,choices:[2,3,4,5],modes:['ctf']},
    shiftMin:{label:'迷宮變換間隔（分鐘）',value:3,min:.5,max:10,step:.5},
    itemCount:{label:'每次出現的道具',value:6,min:3,max:12,step:1},
    foodCount:{label:'每次出現的食物',value:4,min:2,max:10,step:1,modes:['classic','tag']},
    hungerMin:{label:'飽足感持續（分鐘）',value:3,min:1,max:10,step:.5,modes:['classic','tag']},
    stunSec:{label:'攻擊暈眩（秒）',value:3,min:1,max:10,step:.5,modes:['treasure']},
    pingSec:{label:'寶藏位置更新（秒）',value:3,min:1,max:10,step:1,modes:['treasure']},
    smellCells:{label:'鬼的嗅覺範圍（格）',value:3,min:1,max:8,step:1,modes:['tag']},
    goodsCount:{label:'架上商品數量',value:16,min:6,max:60,step:1,modes:['shop']},
    shopCollect:{label:'五樣商品蒐集任務',value:1,choices:[1,0],labels:{1:'開啟：集齊結帳加 300 分',0:'關閉：只比購物金額'},modes:['shop']},
    raceCheckpoint:{label:'中途地標挑戰',value:0,choices:[0,1],labels:{0:'原版：直接前往出口',1:'挑戰：先到中途地標'},modes:['classic']},
    treasureSeal:{label:'寶藏解封挑戰',value:0,choices:[0,1],labels:{0:'原版：持寶前往出口',1:'挑戰：持寶先到任一封印點'},modes:['treasure']},
    ctfShortcut:{label:'側翼捷徑挑戰',value:0,choices:[0,1],labels:{0:'原版：傳旗與護送',1:'挑戰：站定符文開十秒捷徑'},modes:['ctf']},
    shopOrders:{label:'追加訂單挑戰',value:0,choices:[0,1],labels:{0:'原版：完成五樣蒐集',1:'挑戰：完成後選追加訂單'},modes:['shop']},
    tagBells:{label:'安全鐘計分挑戰',value:0,choices:[0,1],labels:{0:'原版：躲避追捕',1:'挑戰：輪流抵達安全鐘加分'},modes:['tag']},
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
    if(!result.shopCollect)result.shopOrders=0;
    return result;
  }
  function visible(mode){return Object.keys(FIELDS).filter(key=>!FIELDS[key].modes||FIELDS[key].modes.includes(mode==='race'?'classic':mode));}
  return Object.freeze({FIELDS,normalize,visible});
});
