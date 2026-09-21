/* 原創完整物件圖：單張透明圖集，按需載入；畫布貼圖沿用既有快取。 */
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
  const listeners=new Set();let image=null,loaded=false;
  const normalize=s=>s.replace(/[\uFE0F\u200D]/g,'');
  function load(){
    if(image)return;image=new Image();image.decoding='async';
    image.onload=()=>{loaded=true;for(const fn of listeners)fn();listeners.clear();};
    image.onerror=()=>{listeners.clear();};
    image.src='assets/pickup-objects-v1.webp';
  }
  function draw(c,key,x,y,size){
    const frame=frames[normalize(key)];if(!frame)return false;load();if(!loaded)return false;
    const [sx,sy,sw,sh]=frame,scale=size/Math.max(sw,sh),w=sw*scale,h=sh*scale;
    c.drawImage(image,sx,sy,sw,sh,x-w/2,y-h/2,w,h);return true;
  }
  root.PickupObjects={has:key=>!!frames[normalize(key)],draw,onReady:fn=>loaded?fn():listeners.add(fn),frames};
})(window);
