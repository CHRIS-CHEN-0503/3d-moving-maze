(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ShopCollectionCore=api;})(globalThis,function(){
  'use strict';
  const BONUS=300;
  function create(seed,count,enabled=true){
    let state=(seed^0x51c011ec)>>>0;const pool=Array.from({length:count},(_,i)=>i);
    for(let i=pool.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=Math.floor(state/4294967296*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return{targets:enabled?pool.slice(0,5):[],players:Object.create(null)};
  }
  function progress(mission,id){return mission.players[id]||(mission.players[id]={paid:[],awarded:false});}
  function checkout(mission,id,goods){
    const p=progress(mission,id);if(!mission.targets.length||p.awarded)return 0;
    for(const gi of goods)if(mission.targets.includes(gi)&&!p.paid.includes(gi))p.paid.push(gi);
    if(mission.targets.every(gi=>p.paid.includes(gi))){p.awarded=true;return BONUS;}
    return 0;
  }
  return{BONUS,create,progress,checkout};
});
