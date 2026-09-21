/* 原創幾何圖示；固定快取至畫布貼圖，不依赖作業系統表情字型。 */
(function(root){
  const names={'⚡':'加速','🚀':'飛速','⛏':'鐵鍬','🗺':'地圖','🧭':'指南','👻':'穿牆','⏱':'時間','⭐':'幸運','😜':'換位','📣':'集合','🍬':'糖果','🍞':'麵包','🥛':'牛奶','🧃':'果汁','🍫':'巧克力','🧀':'起司','🍖':'肉排','🦞':'龍蝦','🍎':'蘋果','🍪':'餅乾','🍗':'雞腿','🍰':'蛋糕','🍌':'香蕉','🍉':'西瓜','💳':'結帳','🛒':'購物','🚩':'出口','💎':'寶藏','💫':'暈眩','👹':'鬼','👺':'疾風','🎭':'隱身','😈':'強韌','🎃':'持久','💀':'破牆','👁':'雷達'};
  function draw(c,s,x,y,size){
    if(root.PickupObjects?.has(s)){
      if(!root.PickupObjects.draw(c,s,x,y,size)){
        // 圖集下載失敗或尚未解碼時仍提供可辨識的完整物件，不畫徽章。
        c.save();c.font=(size*.8)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(s,x,y);c.restore();
      }
      return;
    }
    const key=s.replace(/[\uFE0F\u200D]/g,''),name=names[key]||({'🗝':'鑰匙','🪁':'風箏','🔦':'探照燈','🦉':'俯瞰','🌬':'驅霧','💥':'震波','🍙':'飯糰','🍜':'拉麵','🍱':'便當'})[key];
    c.save();c.translate(x,y);c.scale(size/128,size/128);c.lineWidth=6;c.lineJoin='round';c.lineCap='round';c.strokeStyle='#f8e9c0';
    if(['☀','🌕','☁','🔥','💠','🐦','🦇','🦋','💨','👣'].includes(key)){
      c.fillStyle=key==='🔥'?'#f8a352':key==='💠'?'#96dfe9':'#dfeaf4';c.beginPath();
      if(key==='☁'||key==='💨'){c.ellipse(0,6,51,22,0,0,Math.PI*2);c.ellipse(-15,-9,24,27,0,0,Math.PI*2);c.ellipse(14,-9,30,31,0,0,Math.PI*2);}
      else if(['🐦','🦇','🦋'].includes(key)){c.moveTo(-52,-20);c.quadraticCurveTo(-30,-42,0,6);c.quadraticCurveTo(30,-42,52,-20);c.lineTo(0,30);}
      else{c.arc(0,0,38,0,Math.PI*2);}c.fill();c.restore();return;
    }
    // 非拾取的場景標誌也不使用徽章底板，避免被誤認為另一種道具。
    c.scale(1.3,1.3);c.translate(0,18);
    c.fillStyle='#69d6d5';
    const line=(points)=>{c.beginPath();points.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.stroke();};
    const circle=(a,b,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(a,b,r,0,Math.PI*2);c.fill();};
    const box=(a,b,w,h,color)=>{c.fillStyle=color;c.fillRect(a,b,w,h);c.strokeRect(a,b,w,h);};
    if(key==='🛒'){line([[-34,-38],[-25,-38],[-15,0],[23,0]]);line([[-22,-29],[30,-29],[25,-8],[-18,-8]]);circle(-12,10,6,'#86bbcf');circle(21,10,6,'#86bbcf');}
    else if(key==='💳'){box(-31,-39,62,40,'#68b2cf');c.fillStyle='#254967';c.fillRect(-28,-29,56,9);box(-22,-12,12,7,'#f4d583');}
    else if(key==='🎈'){circle(0,-26,23,'#f398a9');line([[0,-3],[-5,4],[3,12]]);}
    else if(key==='🏷'){c.beginPath();c.moveTo(-31,-30);c.lineTo(-13,-44);c.lineTo(31,-17);c.lineTo(14,6);c.lineTo(-30,-21);c.closePath();c.fillStyle='#f4c768';c.fill();c.stroke();circle(-19,-30,3,'#365061');}
    else if(key==='⚡'||key==='🚀'){box(-18,-28,36,35,key==='⚡'?'#59dab3':'#ae88f7');box(-9,-42,18,12,'#e4ba65');line([[-6,-24],[5,-24],[-4,-12],[7,-12],[-3,0]]);if(key==='🚀'){line([[-29,-20],[-36,-8]]);line([[29,-20],[36,-8]]);}}
    else if(key==='⛏'){line([[-18,7],[15,-30]]);line([[-22,-23],[0,-37],[23,-30],[32,-15]]);}
    else if(key==='🗺'){box(-28,-38,56,42,'#c7d2a2');line([[-9,-37],[-9,3]]);line([[9,-37],[9,3]]);c.strokeStyle='#c8765e';line([[-20,-25],[0,-9],[20,-30]]);}
    else if(key==='🧭'||key==='⏱'){circle(0,-19,25,'#467ea8');c.stroke();if(key==='🧭'){c.beginPath();c.moveTo(0,-42);c.lineTo(10,-9);c.lineTo(0,-16);c.lineTo(-10,4);c.closePath();c.fillStyle='#f4aa74';c.fill();}else{line([[0,-36],[0,-18],[12,-12]]);line([[-8,-48],[8,-48]]);}}
    else if(key==='👻'){c.beginPath();c.moveTo(-25,7);c.quadraticCurveTo(-24,-51,0,-44);c.quadraticCurveTo(24,-51,25,7);c.lineTo(8,0);c.lineTo(0,7);c.lineTo(-8,0);c.closePath();c.fillStyle='#9fb9ed';c.fill();circle(-7,-24,3,'#19314a');circle(7,-24,3,'#19314a');}
    else if(key==='⭐'||key==='💥'){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?12:29;const px=Math.cos(a)*r,py=-19+Math.sin(a)*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fillStyle=key==='⭐'?'#f6d571':'#fc9476';c.fill();c.stroke();}
    else if(key==='🗝'){circle(-15,-30,13,'#d9b767');c.stroke();line([[-5,-21],[24,4],[24,-8]]);}
    else if(key==='🪁'){c.beginPath();c.moveTo(0,-46);c.lineTo(22,-23);c.lineTo(0,0);c.lineTo(-22,-23);c.closePath();c.fillStyle='#e79791';c.fill();c.stroke();line([[0,0],[9,5],[3,10]]);}
    else if(key==='🔦'){box(-10,-16,20,26,'#529bbe');c.beginPath();c.moveTo(-10,-16);c.lineTo(-21,-34);c.lineTo(21,-34);c.lineTo(10,-16);c.closePath();c.fill();c.stroke();line([[-18,-44],[-22,-49]]);line([[0,-44],[0,-52]]);line([[18,-44],[22,-49]]);}
    else if(key==='📣'||key==='🌬'){c.beginPath();c.moveTo(-26,-25);c.lineTo(18,-39);c.lineTo(18,1);c.lineTo(-26,-11);c.closePath();c.fillStyle='#e1ac74';c.fill();c.stroke();line([[28,-31],[34,-36]]);line([[28,-9],[34,-4]]);}
    else if(['👹','👺','🎭','😈','🎃','💀','👁','🦉','😜'].includes(key)){circle(0,-21,23,key==='🦉'?'#b4a57c':key==='👁'?'#92d2c5':'#ce8c9f');c.stroke();circle(-9,-24,6,'#fff0cb');circle(9,-24,6,'#fff0cb');circle(-9,-24,2,'#172d44');circle(9,-24,2,'#172d44');line([[-9,-7],[9,-7]]);if(['👹','👺','😈'].includes(key)){line([[-19,-34],[-26,-47]]);line([[19,-34],[26,-47]]);}}
    else if(key==='🍬'){box(-15,-32,30,27,'#e59eab');line([[-20,-29],[-31,-37],[-31,-2],[-20,-9]]);line([[20,-29],[31,-37],[31,-2],[20,-9]]);}
    else if(key==='🥛'||key==='🧃'){box(-18,-37,36,43,key==='🥛'?'#d8e9e4':'#e5b166');line([[9,-36],[13,-49],[25,-49]]);circle(0,-16,8,'#79b8cb');}
    else if(key==='🍪'){circle(0,-19,25,'#d5a469');c.stroke();for(const[a,b]of[[-9,-30],[11,-25],[-6,-11],[13,-5]])circle(a,b,3,'#604830');}
    else if(key==='🍫'||key==='🍱'){box(-27,-37,54,40,key==='🍫'?'#87604d':'#bf847d');line([[0,-35],[0,1]]);line([[-25,-17],[25,-17]]);if(key==='🍱'){circle(-13,-27,5,'#d5e7ac');circle(13,-7,6,'#e7c38c');}}
    else if(key==='🍙'||key==='🧀'){c.beginPath();c.moveTo(0,-43);c.lineTo(29,5);c.lineTo(-29,5);c.closePath();c.fillStyle=key==='🍙'?'#e4e5d8':'#f1d675';c.fill();c.stroke();if(key==='🍙')box(-8,-14,16,17,'#476b60');else{circle(-8,-9,4,'#d39a53');circle(4,-25,4,'#d39a53');}}
    else if(key==='🍜'){c.beginPath();c.arc(0,-23,27,0,Math.PI);c.fillStyle='#df9e91';c.fill();c.stroke();line([[-31,-25],[31,-25]]);line([[-12,-30],[-4,-39],[-12,-47]]);line([[12,-30],[20,-39],[12,-47]]);}
    else if(key==='🦞'){circle(0,-14,14,'#e39e86');circle(-24,-35,11,'#e39e86');circle(24,-35,11,'#e39e86');line([[-23,-25],[-12,-10],[12,-10],[23,-25]]);line([[0,-3],[0,7]]);}
    else if(key==='🚩'){c.beginPath();c.moveTo(-15,9);c.lineTo(-15,-37);c.lineTo(28,-29);c.lineTo(-15,-11);c.fill();c.stroke();}
    else if(key==='💎'){c.beginPath();c.moveTo(-26,-26);c.lineTo(0,-42);c.lineTo(26,-26);c.lineTo(0,9);c.closePath();c.fill();c.stroke();}
    else if(['🍬','🍞','🥛','🧃','🍫','🧀','🍖','🦞','🍎','🍪','🍗','🍰','🍌','🍉'].includes(key)){
      c.fillStyle=['🍎','🍖','🍗','🦞'].includes(key)?'#f19a79':'#f5cf85';c.beginPath();c.ellipse(0,-19,25,21,0,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.moveTo(-13,-29);c.lineTo(-5,-13);c.moveTo(4,-32);c.lineTo(12,-15);c.stroke();
    }else{c.beginPath();c.moveTo(0,-40);c.lineTo(20,-19);c.lineTo(0,3);c.lineTo(-20,-19);c.closePath();c.fill();c.stroke();}
    c.restore();
  }
  root.NativeSymbols={draw};
})(window);
