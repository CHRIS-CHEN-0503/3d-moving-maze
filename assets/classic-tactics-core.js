/* Bounded maze-distance decisions; no simulation, scoring or room clocks here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ClassicTacticsCore=api;})(globalThis,function(){
  'use strict';
  const inside=(maze,p)=>!!p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<maze.mazeW&&p.y<maze.mazeH;
  function field(maze,origin){
    const w=maze.mazeW,h=maze.mazeH;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>2500||!inside(maze,origin))return null;
    const distance=Array.from({length:h},()=>Array(w).fill(-1)),previous=Array.from({length:h},()=>Array(w).fill(null)),queue=[origin];distance[origin.y][origin.x]=0;
    for(let i=0;i<queue.length;i++){
      const p=queue[i],push=(x,y,wall)=>{const next={x,y};if(wall||!inside(maze,next)||distance[y][x]>=0)return;distance[y][x]=distance[p.y][p.x]+1;previous[y][x]=p;queue.push(next);};
      push(p.x-1,p.y,p.x===0||maze.vWalls[p.y]?.[p.x-1]!==false);push(p.x+1,p.y,p.x===w-1||maze.vWalls[p.y]?.[p.x]!==false);
      push(p.x,p.y-1,p.y===0||maze.hWalls[p.y-1]?.[p.x]!==false);push(p.x,p.y+1,p.y===h-1||maze.hWalls[p.y]?.[p.x]!==false);
    }
    return {origin:{...origin},distance,previous};
  }
  function steps(view,p){return view&&p?view.distance[p.y]?.[p.x]??-1:-1;}
  function route(view,p){
    if(steps(view,p)<0)return [];const result=[];let current=p;
    while(current){result.push(current);current=view.previous[current.y]?.[current.x];}return result.reverse();
  }
  function nearest(view,candidates,cell=p=>p,weight=()=>1){
    let best=null,score=Infinity;
    for(const candidate of candidates){const d=steps(view,cell(candidate));if(d<0)continue;const next=(d+.2)*Math.max(.1,Number(weight(candidate))||1);if(next<score){score=next;best=candidate;}}
    return best;
  }
  function flee(own,threat,candidates){
    let best=null,score=-Infinity;
    for(const p of candidates){const distance=steps(own,p),danger=steps(threat,p);if(distance<=0||danger<0)continue;
      const first=route(own,p).slice(1,5),safe=Math.min(...first.map(c=>steps(threat,c)));
      // The next corridor matters more than a distant corner across the pursuer.
      const value=safe*5+danger-distance*.35;if(value>score){score=value;best=p;}
    }
    return best;
  }
  function hint(c){
    if(!c||!c.running||c.story||c.ended||c.frozen||c.shifting)return {text:'',urgent:false};
    const late=Number.isFinite(c.left)&&c.left<=15;
    if(c.mode==='shop'){
      if(c.checking)return {text:'結帳中 · 站穩等候，商品會安全入帳',urgent:late};
      if(late&&c.cart>0)return {text:c.left<5?'車上仍有商品 · 最後衝刺，結帳需要5秒':'最後15秒 · 車上有商品，找收銀結帳需5秒',urgent:true};
      if(c.orderReady)return {text:'目標商品已在車上 · 找收銀結帳完成任務',urgent:false};
      if(c.load>=60&&c.cart>0)return {text:'購物車變重了 · 結帳後恢復跑速',urgent:false};
      return {text:c.orderOffers?'追加訂單可選 · 看商品與分數再決定':c.collection?'先找任務商品 · 放進車後仍需結帳':'找商品裝車 · 已結帳金額不怕被搶',urgent:false};
    }
    if(c.mode==='tag')return {text:late?(c.ghost?'最後15秒 · 用攻擊抓到人才能卸下面具':'最後15秒 · 留意鬼與轉角，守住逃脫機會'):c.ghost?'追上後按攻擊抓人 · 觸碰不會換鬼':c.hunger<=25?'先找食物補充 · 肚子餓會跑得更慢':'沿通路躲避鬼 · 隱身會遮住氣味',urgent:late};
    if(c.mode==='treasure')return {text:c.holder===c.id?(c.sealed?'持寶中 · 到任一封印點站穩解封':'持寶中 · 前往出口，雙手抱寶不能攻擊'):c.holder?'追上持寶者再攻擊 · 牆壁會擋住搶奪':'先找寶藏 · 帶到出口才算獲勝',urgent:late};
    if(c.mode==='ctf')return {text:c.carrier?'持旗中 · 可接力給隊友，敵方基地守住3秒':c.allyCarrier?'隊友持旗 · 護送並阻擋敵隊':'搶中央金旗 · 送到敵方基地',urgent:late};
    return {text:c.hunger<=25?'飽足感偏低 · 找食物補充跑速':c.checkpoint?'先到中途地標站穩 · 再前往出口':'尋找出口 · 迷宮變形後重新確認路線',urgent:false};
  }
  return Object.freeze({field,steps,route,nearest,flee,hint});
});
