/* Deterministic combat-only drops. Persisted until picked up; shifts never reroll. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerLoot=api;})(globalThis,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const M=()=>typeof module==='object'&&module.exports?require('./tower-materials.js'):globalThis.TowerMaterials;
  const num=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
  const CHANCES=Object.freeze({common:20,uncommon:12,rare:6,legendary:3}),MAX_GROUND=96,ARROW_DROP_QUANTITY=50;
  const COMMON_FOOD=Object.freeze(['root','mushroom','herb','nectar']),COMMON_FOOD_BONUS=5;
  // Only the selected common food candidate gets the extra percentage points.
  // Keep ecology, candidate weighting and all equipment/supply rolls intact.
  function chance(entry){return (CHANCES[entry?.rarity]||0)+(entry?.type==='ingredient'&&COMMON_FOOD.includes(entry.key)?COMMON_FOOD_BONUS:0);}
  function hash(seed,text){let h=seed>>>0;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
    // Mix all bits before modulo: power-of-two candidate pools otherwise make
    // FNV's low bits correlate the choice with its supposedly independent roll.
    h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;
  }
  const fresh=()=>({version:1,rolled:[],entries:[]});
  // The mini lord's guaranteed draught: exactly one healing item from the lord slot on a floor without a chapter lord.
  const Lords=()=>typeof module==='object'&&module.exports?require('./tower-floor-lords.js'):globalThis.TowerFloorLords;
  const bonusDrop=(e,floor)=>typeof e?.id==='string'&&e.id.endsWith(':bonus')&&e.type==='item'&&e.key==='heal'&&e.quantity===1&&e.rarity==='uncommon'&&e.source===(floor<0?'monster-12':'monster-11')&&!Lords()?.allLords()[floor];
  function pool(run,spec){
    const regional=M().dropPool(run,spec),supplies=[{type:'item',key:'ration',rarity:'common',quantity:1},{type:'fuel',key:'kit',rarity:'common',quantity:1},{type:'item',key:'heal',rarity:'uncommon',quantity:1},...['shield','map','bell','hourglass'].map(key=>({type:'item',key,rarity:'rare',quantity:1})),{type:'item',key:'feather',rarity:'legendary',quantity:1},...(P().has(run,'archer')?[{type:'item',key:'arrow',rarity:'common',quantity:ARROW_DROP_QUANTITY}]:[]),...(P().has(run,'robot')?H().ROBOT.fuelItemIds.map(key=>({type:'item',key,rarity:H().ROBOT.FUEL_ITEMS[key].dropRarity,quantity:1})):[])];
    // Weight ecology and ordinary supplies equally before the original rarity
    // roll. A region's only food must not be drowned out by eight rare supplies.
    const harvest=regional.length?Array.from({length:Math.max(supplies.length,regional.length)},(_,i)=>regional[i%regional.length]):[];
    return [...harvest,...supplies];
  }
  function label(entry){return entry.type==='gear'?entry.gear.name:entry.type==='ingredient'?P().INGREDIENTS[entry.key]:entry.type==='material'?M().MATERIALS[entry.key]:entry.type==='fuel'?'火把材料':C().ITEMS[entry.key]?.name;}
  function recordKill(run,spec,cell={x:0,y:0}){
    const state=run.party.loot||(run.party.loot=fresh());if(state.rolled.includes(spec.id))return [];
    state.rolled.push(spec.id);const maxCell=C().floorConfig(run.floor,run.seed).size-1,prefix=run.floor+':'+spec.id,cx=num(cell?.x,0,maxCell)?cell.x:0,cy=num(cell?.y,0,maxCell)?cell.y:0,entries=[];
    const choices=pool(run,spec),pick=choices[hash(run.seed,prefix+':kind')%choices.length];
    if(hash(run.seed,prefix+':item')%100<chance(pick))entries.push({...pick,id:prefix+':item',source:spec.id,cx,cy});
    // A mini lord always leaves one healing draught as well, so the harder fight pays for its own recovery.
    if(spec.elite)entries.push({type:'item',key:'heal',rarity:'uncommon',quantity:1,id:prefix+':bonus',source:spec.id,cx,cy});
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
    if(value===undefined)return fresh();if(!value||value.version!==1||!Array.isArray(value.rolled)||value.rolled.length>128||new Set(value.rolled).size!==value.rolled.length||!value.rolled.every(id=>C().validMonsterId(id,floor)&&defeated.includes(id))||!Array.isArray(value.entries)||value.entries.length>128||new Set(value.entries.map(e=>e?.id)).size!==value.entries.length)return null;
    const maxCell=C().floorConfig(floor).size-1,entries=[];for(const e of value.entries){if(!e||!value.rolled.includes(e.source)||!['item','ingredient','material','fuel','gear'].includes(e.type)||!Object.hasOwn(CHANCES,e.rarity)||!num(e.quantity,1,e.type==='item'&&e.key==='arrow'?ARROW_DROP_QUANTITY:20)||!num(e.cx,0,maxCell)||!num(e.cy,0,maxCell)||e.id!==floor+':'+e.source+':'+(e.type==='gear'?'gear':bonusDrop(e,floor)?'bonus':'item'))return null;
      if(e.type==='item'&&(!Object.hasOwn(C().ITEMS,e.key)||e.key==='coin')||e.type==='ingredient'&&!Object.hasOwn(P().INGREDIENTS,e.key)||e.type==='material'&&(!Object.hasOwn(M().MATERIALS,e.key)||floor>0&&['starore','abyssalloy'].includes(e.key))||e.type==='fuel'&&e.key!=='kit')return null;
      if(e.type==='item'&&C().ITEMS[e.key]?.fuel&&(e.quantity!==1||e.rarity!==C().ITEMS[e.key].dropRarity))return null;
      const gear=e.type==='gear'?C().validateGear(e.gear):undefined;if(e.type==='gear'&&(!gear||gear.kind!==e.key||e.quantity!==1||e.source!==(floor<0?'monster-12':'monster-11')))return null;
      // Expired cores vanish only after full entry validation. Keep the kill
      // receipt so loading or later claiming cannot roll a replacement drop.
      if(gear&&H().ROBOT.isExpiredCore(gear))continue;
      entries.push({id:e.id,source:e.source,type:e.type,key:e.key,quantity:e.quantity,rarity:e.rarity,cx:e.cx,cy:e.cy,...(gear?{gear}:{})});
    }return {version:1,rolled:[...value.rolled],entries};
  }
  function claim(run,id,revision=run.revision){return C().transaction(run,revision,n=>{const state=n.party?.loot,e=state?.entries.find(e=>e.id===id);if(!e)return {ok:false,message:'這件掉落物已被拾取。'};
    if(e.type==='gear'){const result=C().receiveGear(n,e.gear);if(!result.ok)return result;}
    else if(e.type==='fuel'){if(!n.party.light||n.party.light.wood+e.quantity>99||n.party.light.cloth+e.quantity>99)return {ok:false,message:'火把材料已滿，物品留在原地。'};n.party.light.wood+=e.quantity;n.party.light.cloth+=e.quantity;}
    else{const stock=e.type==='ingredient'?n.party.ingredients:e.type==='material'?n.party.journey.materials:n.bag,limit=e.type==='item'?C().itemLimit(e.key,n):99,storedLimit=e.type==='item'?C().itemStorageLimit(e.key):99;if(!stock||!num(stock[e.key],0,storedLimit))return {ok:false,message:'材料資料尚未就緒，掉落物留在原地。'};if(stock[e.key]+e.quantity>limit)return {ok:false,message:e.key==='arrow'?'箭袋空間不足，整束箭矢留在原地。':'這種物品已滿，掉落物留在原地。'};stock[e.key]+=e.quantity;}
    state.entries=state.entries.filter(x=>x.id!==id);compact(n);return {ok:true,message:'獲得 '+label(e),effect:{pickup:e}};
  });}
  return Object.freeze({CHANCES,COMMON_FOOD,COMMON_FOOD_BONUS,chance,MAX_GROUND,ARROW_DROP_QUANTITY,fresh,pool,recordKill,compact,validate,claim,label,hash});
});
