/* Deterministic combat-only drops. Persisted until picked up; shifts never reroll. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerLoot=api;})(globalThis,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const num=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
  const CHANCES=Object.freeze({common:20,uncommon:12,rare:6,legendary:3}),MAX_GROUND=96;
  function hash(seed,text){let h=seed>>>0;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  const fresh=()=>({version:1,rolled:[],entries:[]});
  function pool(run,spec){const ingredients=Object.keys(spec.def.drop||{shell:1}).filter(k=>Object.hasOwn(P().INGREDIENTS,k));return [...ingredients.map(key=>({type:'ingredient',key,rarity:'common',quantity:2})),{type:'item',key:'ration',rarity:'common',quantity:1},{type:'fuel',key:'kit',rarity:'common',quantity:1},{type:'item',key:'heal',rarity:'uncommon',quantity:1},...['shield','map','bell','hourglass'].map(key=>({type:'item',key,rarity:'rare',quantity:1})),{type:'item',key:'feather',rarity:'legendary',quantity:1},...(P().has(run,'archer')?[{type:'item',key:'arrow',rarity:'common',quantity:12}]:[])];}
  function label(entry){return entry.type==='gear'?entry.gear.name:entry.type==='ingredient'?P().INGREDIENTS[entry.key]:entry.type==='fuel'?'火把材料':C().ITEMS[entry.key]?.name;}
  function recordKill(run,spec,cell={x:0,y:0}){
    const state=run.party.loot||(run.party.loot=fresh());if(state.rolled.includes(spec.id))return [];
    state.rolled.push(spec.id);const prefix=run.floor+':'+spec.id,cx=num(cell?.x,0,18)?cell.x:0,cy=num(cell?.y,0,18)?cell.y:0,entries=[];
    const choices=pool(run,spec),pick=choices[hash(run.seed,prefix+':kind')%choices.length];
    if(hash(run.seed,prefix+':item')%100<CHANCES[pick.rarity])entries.push({...pick,id:prefix+':item',source:spec.id,cx,cy});
    if(spec.lord&&hash(run.seed,prefix+':gear')%100<50){const kinds=run.party.loadouts?H().gearPool(run.floor):['helmet','armor','shield','bat','pan','staff'],kind=kinds[hash(run.seed,prefix+':gear-kind')%kinds.length];entries.push({type:'gear',key:kind,rarity:'rare',quantity:1,id:prefix+':gear',source:spec.id,cx,cy,gear:C().createGear(kind,run.floor,run.seed,'lord-drop',true)});}
    // Preserve every existing ground drop. Stop adding piles when the finite
    // floor storage is full; never let long-running reinforcement farming
    // invalidate the player's save or discard an uncollected rare item.
    const accepted=entries.slice(0,Math.max(0,MAX_GROUND-state.entries.length));
    state.entries.push(...accepted);compact(run);return accepted;
  }
  function compact(run){
    const state=run.party?.loot;if(!state)return;
    const protectedIds=new Set(state.entries.map(e=>e.source)),expired=new Set();
    let excess=Math.max(0,run.defeatedMonsters.length-112);
    for(const id of run.defeatedMonsters)if(excess>0&&/^monster-r-/.test(id)&&!protectedIds.has(id)){expired.add(id);excess--;}
    run.defeatedMonsters=run.defeatedMonsters.filter(id=>!expired.has(id));state.rolled=state.rolled.filter(id=>!expired.has(id));
    // A forgotten receipt must not resurrect its saved reinforcement record.
    if(run.party.reinforcements)run.party.reinforcements.monsters=run.party.reinforcements.monsters.filter(m=>!expired.has(m.id));
  }
  function validate(value,floor,defeated){
    if(value===undefined)return fresh();if(!value||value.version!==1||!Array.isArray(value.rolled)||value.rolled.length>128||new Set(value.rolled).size!==value.rolled.length||!value.rolled.every(id=>C().validMonsterId(id)&&defeated.includes(id))||!Array.isArray(value.entries)||value.entries.length>128||new Set(value.entries.map(e=>e?.id)).size!==value.entries.length)return null;
    const entries=[];for(const e of value.entries){if(!e||!value.rolled.includes(e.source)||!['item','ingredient','fuel','gear'].includes(e.type)||!Object.hasOwn(CHANCES,e.rarity)||!num(e.quantity,1,20)||!num(e.cx,0,18)||!num(e.cy,0,18)||e.id!==floor+':'+e.source+':'+(e.type==='gear'?'gear':'item'))return null;
      if(e.type==='item'&&(!Object.hasOwn(C().ITEMS,e.key)||e.key==='coin')||e.type==='ingredient'&&!Object.hasOwn(P().INGREDIENTS,e.key)||e.type==='fuel'&&e.key!=='kit')return null;
      const gear=e.type==='gear'?C().validateGear(e.gear):undefined;if(e.type==='gear'&&(!gear||gear.kind!==e.key||e.quantity!==1||e.source!=='monster-11'))return null;
      entries.push({id:e.id,source:e.source,type:e.type,key:e.key,quantity:e.quantity,rarity:e.rarity,cx:e.cx,cy:e.cy,...(gear?{gear}:{})});
    }return {version:1,rolled:[...value.rolled],entries};
  }
  function claim(run,id,revision=run.revision){return C().transaction(run,revision,n=>{const state=n.party?.loot,e=state?.entries.find(e=>e.id===id);if(!e)return {ok:false,message:'這件掉落物已被拾取。'};
    if(e.type==='gear'){const result=C().receiveGear(n,e.gear);if(!result.ok)return result;}
    else if(e.type==='fuel'){if(!n.party.light||n.party.light.wood+e.quantity>99||n.party.light.cloth+e.quantity>99)return {ok:false,message:'火把材料已滿，物品留在原地。'};n.party.light.wood+=e.quantity;n.party.light.cloth+=e.quantity;}
    else{const stock=e.type==='ingredient'?n.party.ingredients:n.bag;if(stock[e.key]+e.quantity>99)return {ok:false,message:'這種物品已滿，掉落物留在原地。'};stock[e.key]+=e.quantity;}
    state.entries=state.entries.filter(x=>x.id!==id);compact(n);return {ok:true,message:'獲得 '+label(e),effect:{pickup:e}};
  });}
  return Object.freeze({CHANCES,MAX_GROUND,fresh,pool,recordKill,compact,validate,claim,label,hash});
});
