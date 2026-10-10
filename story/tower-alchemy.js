/* Camp potion brewing: healers brew restoratives, clerics brew tonics; herbs (藥草) and dew (清露) are the base. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerAlchemy=api;})(globalThis,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const G=()=>typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;
  const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const MAKERS=freeze({healer:{name:'療癒師',kind:'恢復型',verb:'調製'},cleric:{name:'神職',kind:'強化型',verb:'祈願'}});
  // Brewed potions are the very items the grocer sells; only the way to get them is new.
  // Floor gates follow the shop (POTION_FLOORS), so brewing never hands out a potion early.
  const RECIPES=freeze({
    heal:{maker:'healer',cost:{herb:2,dew:1}},
    heal_mid:{maker:'healer',cost:{herb:3,mushroom:1,dew:1}},
    heal_high:{maker:'healer',cost:{herb:4,lotus:1,dew:2}},
    spirit:{maker:'healer',cost:{herb:1,nectar:1,dew:1}},
    haste:{maker:'cleric',cost:{herb:2,sunseed:1,dew:1}},
    shield:{maker:'cleric',cost:{herb:2,shell:1,dew:1}},
    courage:{maker:'cleric',cost:{herb:3,emberpepper:1,dew:1}},
    arcane:{maker:'cleric',cost:{herb:3,crystaljelly:1,dew:1}},
  });
  const unlocked=(run,id)=>!!run&&Object.hasOwn(RECIPES,id)&&C().potionAvailable(id,run.floor);
  const makerReady=(run,job)=>!!run?.party&&P().has(run,job);
  const gateText=id=>{const floor=C().POTION_FLOORS[id];return floor<0?'這種藥水要到地下才調得出來。':'第 '+floor+' 層起才能調製。';};
  function quote(run,id){const r=RECIPES[id];if(!r||!run?.party||!run.bag)return null;const item=C().ITEMS[id],limit=C().itemLimit(id,run),have=run.bag[id]||0;
    const reason=!unlocked(run,id)?gateText(id):!makerReady(run,r.maker)?'需要隊伍中仍能行動的'+MAKERS[r.maker].name+'。':have>=limit?'背包裡的這種藥水已達上限。':'';
    const affordable=Object.entries(r.cost).every(([k,v])=>(run.party.ingredients[k]||0)>=v);
    return {id,name:item.name,description:item.description,maker:r.maker,makerName:MAKERS[r.maker].name,kind:MAKERS[r.maker].kind,verb:MAKERS[r.maker].verb,cost:{...r.cost},allowed:!reason,reason,affordable,have,limit};}
  const available=run=>Object.keys(RECIPES).filter(id=>quote(run,id)?.allowed);
  const makers=run=>Object.keys(MAKERS).filter(job=>makerReady(run,job));
  function brew(run,id,revision=run?.revision){return C().transaction(run,revision,n=>{
    const q=quote(n,id);if(!q)return {ok:false,message:'沒有這種藥水的配方。'};if(!q.allowed)return {ok:false,message:q.reason};
    if(!q.affordable)return {ok:false,message:'材料還不夠，先去採集或向雜貨商補貨。'};
    const p=n.party;
    // A hero-system healer brews with her own ingredient-care passive; legacy journeys pay the listed cost.
    if(p.loadouts){const maker=H().ids(n).find(k=>H().job(n,k)===q.maker&&H().hp(n,k)>0);G().consumeCost(n,maker,q.cost);}else for(const [k,v]of Object.entries(q.cost))p.ingredients[k]-=v;
    n.bag[id]=(n.bag[id]||0)+1;return {ok:true,message:'完成'+q.name+'。',effect:{potion:id,maker:q.maker}};
  });}
  return freeze({MAKERS,RECIPES,unlocked,quote,available,makers,brew});
});
