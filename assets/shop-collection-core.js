(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ShopCollectionCore=api;})(globalThis,function(){
  'use strict';
  const BONUS=300;
  function create(seed,count,enabled=true){
    let state=(seed^0x51c011ec)>>>0;const pool=Array.from({length:count},(_,i)=>i);
    for(let i=pool.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=Math.floor(state/4294967296*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return{seed:seed>>>0,count,targets:enabled?pool.slice(0,5):[],players:Object.create(null)};
  }
  function progress(mission,id){return mission.players[id]||(mission.players[id]={paid:[],awarded:false,orders:0,order:null,orderPaid:[]});}
  function offers(mission,id){const p=progress(mission,id);if(!p.awarded||p.order||p.orders>=3)return [];const source=create((mission.seed^Math.imul(p.orders+1,0x731f))>>>0,mission.count).targets;return [{index:0,targets:source.slice(0,2),bonus:80},{index:1,targets:source.slice(2,5),bonus:150}];}
  function choose(mission,id,index){const p=progress(mission,id),offer=offers(mission,id).find(o=>o.index===index);if(!offer)return false;p.order={...offer,targets:offer.targets.slice(),number:p.orders+1};p.orderPaid=[];return true;}
  function checkoutOrder(mission,id,goods){const p=progress(mission,id);if(!p.order)return 0;for(const gi of goods)if(p.order.targets.includes(gi)&&!p.orderPaid.includes(gi))p.orderPaid.push(gi);if(!p.order.targets.every(i=>p.orderPaid.includes(i)))return 0;const bonus=p.order.bonus;p.orders++;p.order=null;p.orderPaid=[];return bonus;}
  function checkout(mission,id,goods){
    const p=progress(mission,id);if(!mission.targets.length||p.awarded)return 0;
    for(const gi of goods)if(mission.targets.includes(gi)&&!p.paid.includes(gi))p.paid.push(gi);
    if(mission.targets.every(gi=>p.paid.includes(gi))){p.awarded=true;return BONUS;}
    return 0;
  }
  return{BONUS,create,progress,checkout,offers,choose,checkoutOrder};
});
