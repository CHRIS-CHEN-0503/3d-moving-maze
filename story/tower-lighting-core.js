/* Portable light, simple crafting and persistent per-floor supplies. Rendering-free. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerLighting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const E=()=>typeof module==='object'&&module.exports?require('./tower-encounters.js'):globalThis.TowerEncounters;
  const TORCH_SECONDS=300,DAYLIGHT_SECONDS=600,DAYLIGHT_COOLDOWN=600,TORCH_PRICE=4,SHOP_STOCK=3;
  const SHOPS=['tieLing','jinHe','lanZhou'];
  const PROFILES=Object.freeze(Object.fromEntries(Object.entries({
    summoning:{name:'雲間石燈',style:'rune',color:0x9be5f5,sky:0x637e94,ambient:.46,hemi:.62,sun:.55,radius:9},
    garden:{name:'花園燈籠',style:'lantern',color:0xffd88a,sky:0x76958b,ambient:.5,hemi:.65,sun:.6,radius:10},
    roots:{name:'螢光菌叢',style:'fungus',color:0xa2e6a6,sky:0x263d38,ambient:.28,hemi:.4,sun:.3,radius:6},
    echo:{name:'共鳴晶簇',style:'crystal',color:0x90d5ff,sky:0x242e47,ambient:.27,hemi:.4,sun:.27,radius:6},
    library:{name:'閱讀燈籠',style:'lantern',color:0xffcc83,sky:0x393442,ambient:.29,hemi:.4,sun:.28,radius:6.5},
    mist:{name:'引路水燈',style:'rune',color:0x88e8dc,sky:0x30484f,ambient:.3,hemi:.43,sun:.28,radius:6},
    frost:{name:'冰脈晶石',style:'crystal',color:0xb3e8ff,sky:0x415e70,ambient:.35,hemi:.5,sun:.4,radius:7},
    clockwork:{name:'工坊爐燈',style:'brazier',color:0xffc27d,sky:0x3d3631,ambient:.29,hemi:.4,sun:.3,radius:6.5},
    furnace:{name:'熔火石爐',style:'brazier',color:0xff9f66,sky:0x55352d,ambient:.35,hemi:.45,sun:.35,radius:7.5},
    heart:{name:'歸途符燈',style:'rune',color:0xd5c4ff,sky:0x2d334b,ambient:.28,hemi:.42,sun:.3,radius:6.5},
  }).map(([id,p])=>[id,Object.freeze(p)])));
  const profile=id=>Object.hasOwn(PROFILES,id)?PROFILES[id]:PROFILES.echo;
  const supplyCount=size=>size<=9?1:size<=13?2:3;
  const newState=()=>({version:1,torches:2,wood:2,cloth:2,fuel:0,lit:false,daylight:0,cooldown:0,gathered:[],bought:Object.fromEntries(SHOPS.map(k=>[k,0]))});
  function validate(value,floor){
    if(value===undefined)return newState(); // One-time migration; future saves persist spent supplies.
    if(!value||value.version!==1||typeof value.lit!=='boolean')return null;
    const number=(v,max,int=false)=>Number.isFinite(v)&&v>=0&&v<=max&&(!int||Number.isInteger(v));
    if(!['torches','wood','cloth'].every(k=>number(value[k],99,true))||!number(value.fuel,TORCH_SECONDS)||!number(value.daylight,DAYLIGHT_SECONDS)||!number(value.cooldown,DAYLIGHT_COOLDOWN)||value.lit&&value.fuel===0||value.cooldown<value.daylight)return null;
    const count=supplyCount(C().floorConfig(floor).size);
    if(!Array.isArray(value.gathered)||value.gathered.length>count||new Set(value.gathered).size!==value.gathered.length||!value.gathered.every(id=>typeof id==='string'&&Array.from({length:count},(_,i)=>'light-supply-'+i).includes(id)))return null;
    if(!value.bought||Object.keys(value.bought).length!==SHOPS.length||!SHOPS.every(k=>Object.hasOwn(value.bought,k)&&number(value.bought[k],SHOP_STOCK,true)))return null;
    return {version:1,torches:value.torches,wood:value.wood,cloth:value.cloth,fuel:value.fuel,lit:value.lit,daylight:value.daylight,cooldown:value.cooldown,gathered:[...value.gathered],bought:{...value.bought}};
  }
  const canCast=run=>!!run.party&&(run.party.profession==='mage'||run.party.members.some(m=>m.profession==='mage'&&m.hp>0));
  const tx=(run,revision,fn)=>C().transaction(run,revision,n=>n.party?fn(n,n.party.light):{ok:false,message:'請先選擇冒險職業。'});
  function craft(run,revision){return tx(run,revision,(n,l)=>{
    if(!l.wood||!l.cloth)return {ok:false,message:'需要一份木枝和一份布條。'};
    if(l.torches>=99)return {ok:false,message:'火把袋已滿。'};
    l.wood--;l.cloth--;l.torches++;return {ok:true,message:'製作 火把'};
  });}
  function torch(run,revision){return tx(run,revision,(n,l)=>{
    if(l.lit){l.lit=false;return {ok:true,message:'熄滅火把，保留剩餘燃料。'};}
    if(l.daylight>0)return {ok:false,message:'日光術正在照明，先節省火把。'};
    if(!l.fuel){if(!l.torches)return {ok:false,message:'沒有火把了，可以製作或找商人購買。'};l.torches--;l.fuel=TORCH_SECONDS;}
    l.lit=true;return {ok:true,message:'使用 火把'};
  });}
  function daylight(run,revision){return tx(run,revision,(n,l)=>{
    if(!canCast(n))return {ok:false,message:'需要主角或仍能行動的術士同伴。'};
    if(l.cooldown>0)return {ok:false,message:'日光術尚未結束，無須重複施放。'};
    l.daylight=DAYLIGHT_SECONDS;l.cooldown=DAYLIGHT_COOLDOWN;
    return {ok:true,message:'施放 日光術'};
  });}
  function buy(run,id,revision){return tx(run,revision,(n,l)=>{
    if(n.expedition.active||!E().merchantOffers(n.floor,n.seed).some(m=>m.id===id))return {ok:false,message:'這位商人不在此處。'};
    if(l.bought[id]>=SHOP_STOCK)return {ok:false,message:'本層的火把已售完。'};
    if(n.coins<TORCH_PRICE||l.torches>=99)return {ok:false,message:n.coins<TORCH_PRICE?'銅幣不足。':'火把袋已滿。'};
    n.coins-=TORCH_PRICE;l.bought[id]++;l.torches++;return {ok:true,message:'獲得 火把'};
  });}
  function gather(run,id,revision){return tx(run,revision,(n,l)=>{
    const count=supplyCount(C().floorConfig(n.floor).size);
    if(n.expedition.active||!Array.from({length:count},(_,i)=>'light-supply-'+i).includes(id)||l.gathered.includes(id))return {ok:false,message:'這份材料已經拿過了。'};
    if(l.wood===99&&l.cloth===99)return {ok:false,message:'照明材料已滿。'};
    l.wood=Math.min(99,l.wood+1);l.cloth=Math.min(99,l.cloth+1);l.gathered.push(id);return {ok:true,message:'獲得 木枝和布條'};
  });}
  function tick(next,dt){
    const l=next.party?.light;if(!l||!Number.isFinite(dt)||dt<0)return;
    const burn=Math.max(0,dt-l.daylight);
    l.daylight=Math.max(0,l.daylight-dt);l.cooldown=Math.max(0,l.cooldown-dt);
    if(l.lit){l.fuel=Math.max(0,l.fuel-burn);if(!l.fuel)l.lit=false;}
  }
  function advance(next){const l=next.party?.light;if(l){l.gathered=[];l.bought=Object.fromEntries(SHOPS.map(k=>[k,0]));}}
  const portable=run=>run?.party?.light?.daylight>0?'daylight':run?.party?.light?.lit?'torch':'none';
  return Object.freeze({TORCH_SECONDS,DAYLIGHT_SECONDS,DAYLIGHT_COOLDOWN,TORCH_PRICE,SHOP_STOCK,PROFILES,profile,supplyCount,newState,validate,canCast,craft,torch,daylight,buy,gather,tick,advance,portable});
});
