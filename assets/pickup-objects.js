/* 原創完整物件圖：兩張透明圖集各自按需載入；畫布貼圖沿用既有快取。 */
(function(root){
  'use strict';
  const keys=['⚡','🚀','⛏','🗺','🧭','👻','⏱','⭐','😜','📣','🗝','🪁','🔦','🦉','🌬','💥','🍬','🍪','🍎','🍙','🍜','🍗','🍱','🍞','🥛','🧃','🍫','🧀','🍖','🦞'];
  const columns=[0,229,458,690,923,1150,1374],rows=[0,249,484,704,912,1145];
  const frames=Object.fromEntries(keys.map((key,i)=>{
    const x=i%6,y=Math.floor(i/6);return[key,[columns[x],rows[y],columns[x+1]-columns[x],rows[y+1]-rows[y]]];
  }));
  // 展翅貓頭鷹比其他道具寬，保留完整羽翼；相鄰手電筒不取到羽毛。
  frames['🔦']=[0,484,206,220];frames['🦉']=[206,484,263,220];frames['🌬']=[474,484,216,220];
  frames['💎']=frames['⏱'];
  const householdKeys=['🧻','🧼','🪥','🧣','🧴','🧽','🩴','☂','☕','🫙','💡','🍳'];
  const householdFrames=[[0,0,362,346],[362,0,362,346],[724,0,344,346],[1068,0,380,346],
    [0,346,362,354],[362,346,362,332],[724,346,344,354],[1068,346,380,354],
    [0,700,362,386],[362,678,362,408],[724,700,344,386],[1068,700,380,386]];
  householdKeys.forEach((key,i)=>{frames[key]=householdFrames[i];});
  const sheets=[
    {src:'assets/pickup-objects-v1.webp',width:1374,height:1145,image:null,loaded:false},
    {src:'assets/shop-household-v1.webp',width:1448,height:1086,image:null,loaded:false}
  ];
  const sheetFor=Object.fromEntries(Object.keys(frames).map(key=>[key,householdKeys.includes(key)?1:0]));
  const listeners=new Set();
  const normalize=s=>s.replace(/[\uFE0F\u200D]/g,'');
  function load(sheet){
    if(sheet.image)return;const image=sheet.image=new Image();image.decoding='async';
    image.onload=()=>{sheet.loaded=true;for(const fn of listeners)fn();};
    image.onerror=()=>{}; // 失敗只影響這張圖集，不清掉另一張的就緒通知。
    image.src=sheet.src;
  }
  function draw(c,key,x,y,size){
    key=normalize(key);const frame=frames[key];if(!frame)return false;
    const sheet=sheets[sheetFor[key]];load(sheet);if(!sheet.loaded)return false;
    const [sx,sy,sw,sh]=frame,scale=size/Math.max(sw,sh),w=sw*scale,h=sh*scale;
    c.drawImage(sheet.image,sx,sy,sw,sh,x-w/2,y-h/2,w,h);return true;
  }
  root.PickupObjects={has:key=>!!frames[normalize(key)],draw,
    isReady:key=>!!sheets[sheetFor[normalize(key)]]?.loaded,
    onReady:fn=>{listeners.add(fn);if(sheets.some(s=>s.loaded))fn();return()=>listeners.delete(fn);},
    frames,sheetFor,sheets};
})(window);
