/* Grocery commissioned cooking. Exact one-portion transaction; no renderer or timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerCommissionCooking=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const get=(file,name)=>typeof module==='object'&&module.exports?require('./'+file+'.js'):globalThis[name];
  const C=()=>get('story-core','TowerCore'),P=()=>get('tower-party-core','TowerPartyCore'),E=()=>get('tower-encounters','TowerEncounters');
  const FEES=Object.freeze({basic:2,advanced:5,feast:8,underground:12}),LABELS=Object.freeze({basic:'基本料理',advanced:'精製料理',feast:'盛宴料理',underground:'地下料理'});
  function category(recipeId){const recipe=P().RECIPES[recipeId];if(!Object.hasOwn(P().RECIPES,recipeId)||recipe.hidden||recipe.research)return null;return recipe.requiredDepth?'underground':recipe.requiresChef&&(recipeId==='feast'||recipe.team>=30)?'feast':recipe.requiresChef?'advanced':'basic';}
  function fee(recipeId){const type=category(recipeId);return type?FEES[type]:null;}
  function quote(run,recipeId,merchantId='suHe'){
    const recipe=typeof recipeId==='string'&&Object.hasOwn(P().RECIPES,recipeId)?P().RECIPES[recipeId]:null,type=recipe?category(recipeId):null,cost=recipe?{coins:FEES[type],ingredients:{...recipe.cost}}:null;
    const merchant=run?.party&&E().merchantOffers(run.floor,run.seed,!!run.party.loadouts).find(shop=>shop.id===merchantId&&shop.id===E().GROCERY.merchantId);
    let reason=!run?.party||run.status!=='playing'?'請在進行中的劇情樓層委託料理。':!recipe?'沒有這份食譜。':run.expedition?.active?'裂隙副本中無法委託雜貨商料理。':!merchant?'本層沒有可委託的雜貨商蘇禾。':!P().recipeUnlocked(run,recipeId)?'尚未抵達這份地下食譜的開放樓層。':run.party.meals[recipeId]>=99?'這道料理已達九十九份，尚未扣款。':'';
    const missing=cost?Object.entries(cost.ingredients).filter(([id,n])=>(run?.party?.ingredients?.[id]||0)<n).map(([id,n])=>({id,need:n,have:run?.party?.ingredients?.[id]||0})):[];
    const affordable=!!cost&&Number.isInteger(run?.coins)&&run.coins>=cost.coins&&!missing.length;
    return {allowed:!reason,reason,affordable,recipeId,name:recipe?.name,merchantId,category:type,categoryName:type?LABELS[type]:null,fee:cost?.coins,costs:cost,quantity:1,owned:run?.party?.meals?.[recipeId]||0,missing};
  }
  function recipes(run,merchantId='suHe'){return Object.keys(P().RECIPES).filter(id=>category(id)&&P().recipeUnlocked(run,id)).map(id=>quote(run,id,merchantId));}
  function cook(run,recipeId,expectedRevision=run?.revision,merchantId='suHe'){
    return C().transaction(run,expectedRevision,next=>{
      const q=quote(next,recipeId,merchantId);if(!q.allowed)return {ok:false,message:q.reason};if(!q.affordable)return {ok:false,message:'食材或代煮費不足，尚未扣款。'};
      next.coins-=q.costs.coins;for(const[id,n]of Object.entries(q.costs.ingredients))next.party.ingredients[id]-=n;
      next.party.meals[recipeId]+=1;
      return {ok:true,message:'蘇禾完成 '+q.name+'，獲得一份。',effect:{commissionCooking:true,recipe:recipeId,quantity:1,fee:q.fee,merchantId}};
    });
  }
  return Object.freeze({FEES,LABELS,category,fee,quote,recipes,cook});
});
