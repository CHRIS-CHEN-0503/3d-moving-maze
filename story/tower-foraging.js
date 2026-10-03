/* Seeded wall-side herbs and natural mineral deposits, separate from combat loot. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TowerForaging=api;
})(globalThis,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const M=()=>typeof module==='object'&&module.exports?require('./tower-materials.js'):globalThis.TowerMaterials;
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  const validContext=(floor,seed)=>C().isFloor(floor)&&integer(seed,1,0xffffffff);
  const LEGACY_PROFILES=freeze({
    suitable:{0:0,1:40,2:35,3:25},
    neutral:{0:30,1:30,2:25,3:15},
    unsuitable:{0:60,1:20,2:15,3:5},
  });
  // All natural resources use the same overall appearance rate. Retain the
  // old conditional quantity/grade weights and their historical save rules.
  const ENVIRONMENT_BONUS=20,BASE_APPEARANCE=30;
  const APPEARANCE=freeze({suitable:BASE_APPEARANCE+ENVIRONMENT_BONUS,neutral:BASE_APPEARANCE,unsuitable:BASE_APPEARANCE-ENVIRONMENT_BONUS});
  const profilesFor=appearance=>freeze(Object.fromEntries(Object.entries(LEGACY_PROFILES).map(([name,weights])=>{
    const original=100-weights[0],chance=appearance[name];
    return [name,{0:100-chance,...Object.fromEntries([1,2,3].map(quantity=>[quantity,weights[quantity]*chance/original]))}];
  })));
  const PROFILES=profilesFor(APPEARANCE),POWER_PROFILES=PROFILES;
  const POWER_ENVIRONMENT_BONUS=ENVIRONMENT_BONUS,POWER_BASE_APPEARANCE=BASE_APPEARANCE,POWER_APPEARANCE=APPEARANCE;
  const DRAFT_POWER_APPEARANCE=freeze({suitable:40,neutral:30,unsuitable:20}),DRAFT_POWER_PROFILES=profilesFor(DRAFT_POWER_APPEARANCE);
  // Every existing surface and underground ecology has an explicit classification.
  const REGIONS=freeze({
    summoning:{herb:'neutral',ore:'neutral'},
    garden:{herb:'suitable',ore:'unsuitable'},
    roots:{herb:'suitable',ore:'unsuitable'},
    echo:{herb:'neutral',ore:'suitable'},
    library:{herb:'neutral',ore:'neutral'},
    mist:{herb:'suitable',ore:'neutral'},
    frost:{herb:'unsuitable',ore:'neutral'},
    clockwork:{herb:'neutral',ore:'suitable'},
    furnace:{herb:'unsuitable',ore:'suitable'},
    heart:{herb:'neutral',ore:'neutral'},
    'underworld:roots':{herb:'suitable',ore:'suitable'},
    'underworld:mist':{herb:'suitable',ore:'suitable'},
    'underworld:library':{herb:'neutral',ore:'suitable'},
    'underworld:furnace':{herb:'unsuitable',ore:'suitable'},
    'underworld:heart':{herb:'neutral',ore:'suitable'},
  });
  const NATURAL_ORES=freeze(['ironore','crystalshard','starore']);
  const POWER_STONES=freeze(['power_glimmer','power_starlight','power_sunheart']);
  const OFFSET=.30;
  function hash(seed,text){
    let h=seed>>>0;
    for(const char of String(text))h=Math.imul(h^char.charCodeAt(0),16777619)>>>0;
    h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);
    return (h^(h>>>16))>>>0;
  }
  function profileName(run,kind){
    const regional=REGIONS[M().ecology(run).id];
    if(!regional||!Object.hasOwn(regional,kind))throw new RangeError('無效的採集種類。');
    return regional[kind];
  }
  function profile(run,kind){return PROFILES[profileName(run,kind)];}
  function powerProfile(run){return POWER_PROFILES[profileName(run,'herb')];}
  function rollCount(seed,floor,kind,weights){
    let roll=hash(seed,`foraging:${floor}:${kind}:count`)%100;
    // The stated 1/2/3 percentages are evaluated first; the remainder is none.
    for(const count of [1,2,3]){if(roll<weights[count])return count;roll-=weights[count];}
    return 0;
  }
  function rollWeighted(seed,floor,kind,name,appearance){
    // Exact integer intervals avoid rounding fractional quantity probabilities.
    const weights=LEGACY_PROFILES[name],original=100-weights[0],chance=appearance[name];
    let roll=hash(seed,`foraging:${floor}:${kind}:count`)%(100*original);
    for(const count of [1,2,3]){const weight=weights[count]*chance;if(roll<weight)return count;roll-=weight;}
    return 0;
  }
  function drawCounts(run,rule=2){
    if(!validContext(run?.floor,run?.seed))throw new RangeError('無效的採集樓層或旅程種子。');
    return Object.fromEntries(['herb','ore'].map(kind=>{const name=profileName(run,kind);return [kind,rule===1?rollCount(run.seed,run.floor,kind,LEGACY_PROFILES[name]):rollWeighted(run.seed,run.floor,kind,name,APPEARANCE)];}));
  }
  function counts(run){
    if(!validContext(run?.floor,run?.seed))throw new RangeError('無效的採集樓層或旅程種子。');
    if(run.party?.foraging===undefined)return drawCounts(run);
    const state=validate(run.party.foraging,run.floor,run.seed);
    if(!state)throw new RangeError('採集紀錄不完整。');
    return {...state.counts};
  }
  function orePool(run){
    const ecology=M().ecology(run),local=new Set(Object.values(ecology.variants).flatMap(v=>v.materials));
    const ores=NATURAL_ORES.filter(key=>local.has(key)&&(key!=='starore'||ecology.underground));
    // A region without mineral-bearing creatures can still contain ordinary rock ore.
    return ores.length?ores:['ironore'];
  }
  function drawPowerDeposit(run,rule=3){
    if(!validContext(run?.floor,run?.seed))throw new RangeError('無效的動力石採集樓層。');
    const name=profileName(run,'herb');
    const tier=rule===1?rollCount(run.seed,run.floor,'power',LEGACY_PROFILES[name]):rollWeighted(run.seed,run.floor,'power',name,rule===2?DRAFT_POWER_APPEARANCE:APPEARANCE);
    return tier?{tier,key:POWER_STONES[tier-1],quantity:1+hash(run.seed,`foraging:${run.floor}:power:quantity`)%3}:null;
  }
  function powerDeposit(run){
    if(!validContext(run?.floor,run?.seed))throw new RangeError('無效的動力石採集樓層。');
    if(run.party?.foraging===undefined)return drawPowerDeposit(run);
    const state=validate(run.party.foraging,run.floor,run.seed);
    return state?.power?{...state.power}:null;
  }
  function resources(run,power=powerDeposit(run),amount=counts(run)){
    const ores=orePool(run),entries=[];
    for(const kind of ['herb','ore'])for(let index=0;index<amount[kind];index++){
      const id=`foraging:${run.floor}:${kind}:${index}`;
      const key=kind==='herb'?'herb':ores[hash(run.seed,id+':mineral')%ores.length];
      entries.push({id,kind,type:kind==='herb'?'ingredient':'material',key,quantity:1,rarity:kind==='herb'?'common':M().MATERIAL_META[key].rarity});
    }
    const deposit=power;
    if(deposit)entries.push({id:`foraging:${run.floor}:power:0`,kind:'power',type:'item',key:deposit.key,quantity:deposit.quantity,rarity:['common','uncommon','rare'][deposit.tier-1]});
    return entries;
  }
  function fresh(run){
    if(!validContext(run?.floor,run?.seed))throw new RangeError('無效的採集樓層或旅程種子。');
    return {version:3,floor:run.floor,seed:run.seed,claimed:[],harvestRule:2,counts:drawCounts(run),powerRule:3,power:drawPowerDeposit(run)};
  }
  function samePower(value,expected){return expected===null?value===null:!!value&&typeof value==='object'&&!Array.isArray(value)&&value.tier===expected.tier&&value.key===expected.key&&value.quantity===expected.quantity;}
  function validate(value,floor,seed){
    if(!validContext(floor,seed))return null;
    if(value===undefined)return fresh({floor,seed});
    if(!value||typeof value!=='object'||Array.isArray(value)||![1,2,3].includes(value.version)||value.floor!==floor||value.seed!==seed||!Array.isArray(value.claimed)||value.claimed.length>7||new Set(value.claimed).size!==value.claimed.length)return null;
    // Production v1 and provisional v2 both used the original herb/ore draws.
    // Freeze those counts and the old power allocation before changing rates.
    const harvestRule=value.version<3?1:value.harvestRule;
    if(![1,2].includes(harvestRule))return null;
    const amount=drawCounts({floor,seed},harvestRule);
    if(value.version===3&&(!value.counts||typeof value.counts!=='object'||Array.isArray(value.counts)||Object.keys(value.counts).length!==2||value.counts.herb!==amount.herb||value.counts.ore!==amount.ore))return null;
    let powerRule=value.version===1?1:value.powerRule;
    if(value.version===2&&powerRule===2){
      // v2 existed only locally while the environment modifier was confirmed.
      // Recognize both its ten-point draft and final twenty-point snapshot.
      if(samePower(value.power,drawPowerDeposit({floor,seed},2)))powerRule=2;
      else if(samePower(value.power,drawPowerDeposit({floor,seed},3)))powerRule=3;
      else return null;
    }
    if(![1,2,3].includes(powerRule))return null;
    const power=drawPowerDeposit({floor,seed},powerRule);
    if(value.version>1&&!samePower(value.power,power))return null;
    const allowed=new Set(resources({floor,seed},power,amount).map(entry=>entry.id));
    if(!value.claimed.every(id=>typeof id==='string'&&allowed.has(id)))return null;
    return {version:3,floor,seed,claimed:[...value.claimed],harvestRule,counts:{...amount},powerRule,power:power?{...power}:null};
  }
  function specs(run){
    if(!run?.party||run.expedition?.active)return [];
    const state=validate(run.party.foraging,run.floor,run.seed);
    return state?resources(run,state.power,state.counts).filter(entry=>!state.claimed.includes(entry.id)):[];
  }
  function label(entry){return entry?.type==='item'?C().ITEMS[entry.key]?.name:entry?.type==='ingredient'?M().INGREDIENTS[entry.key]:M().MATERIALS[entry?.key];}
  function claim(run,id,revision=run?.revision){
    return C().transaction(run,revision,next=>{
      if(!next.party||next.expedition.active)return {ok:false,message:'目前無法採集塔層資源。'};
      const state=validate(next.party.foraging,next.floor,next.seed);
      if(!state)return {ok:false,message:'採集紀錄不完整，資源留在原地。'};
      const entry=resources(next,state.power,state.counts).find(entry=>entry.id===id&&!state.claimed.includes(id));
      if(!entry)return {ok:false,message:'這處資源已經採集過了。'};
      const stock=entry.type==='item'?next.bag:entry.type==='ingredient'?next.party.ingredients:next.party.journey?.materials;
      if(!stock||!integer(stock[entry.key],0,99))return {ok:false,message:'材料資料尚未就緒，資源留在原地。'};
      if(stock[entry.key]+entry.quantity>99)return {ok:false,message:'背包已滿或剩餘空間不足，整簇資源留在原地。'};
      stock[entry.key]+=entry.quantity;state.claimed.push(entry.id);next.party.foraging=state;
      return {ok:true,message:'獲得 '+label(entry)+(entry.quantity>1?' ×'+entry.quantity:''),effect:{pickup:{...entry}}};
    });
  }
  function cellKey(cell){
    if(typeof cell==='string')return cell;
    if(Array.isArray(cell))return cell[0]+','+cell[1];
    if(cell&&typeof cell==='object')return (cell.cx??cell.x)+','+(cell.cy??cell.y);
    return '';
  }
  function wallsAt(cx,cy,width,height,hWalls,vWalls){
    // Engine horizontal walls sit below each cell; vertical walls sit to its right.
    return [cy===0||!!hWalls?.[cy-1]?.[cx],cx===width-1||!!vWalls?.[cy]?.[cx],cy===height-1||!!hWalls?.[cy]?.[cx],cx===0||!!vWalls?.[cy]?.[cx-1]];
  }
  function plan(run,maze,{excludeCells=[]}={}){
    if(!run?.party||run.expedition?.active)return [];
    const state=validate(run.party.foraging,run.floor,run.seed);
    const width=maze?.mazeW??maze?.width??maze?.size,height=maze?.mazeH??maze?.height??maze?.size;
    if(!state||!integer(width,1,99)||!integer(height,1,99))return [];
    const excluded=new Set(Array.from(excludeCells,cellKey));
    for(const cell of [maze.entranceCell||{x:0,y:0},maze.exitCell||{x:width-1,y:height-1},...(maze.blockedCells||[])])excluded.add(cellKey(cell));
    const walkable=maze.walkableCells?new Set(Array.from(maze.walkableCells,cellKey)):null,candidates=[];
    for(let cy=0;cy<height;cy++)for(let cx=0;cx<width;cx++){
      const key=cx+','+cy;if(excluded.has(key)||walkable&&!walkable.has(key))continue;
      const walls=wallsAt(cx,cy,width,height,maze.hWalls,maze.vWalls);
      if(!walls.some(Boolean))continue;
      const corners=[{x:1,y:-1,sides:[0,1]},{x:1,y:1,sides:[1,2]},{x:-1,y:1,sides:[2,3]},{x:-1,y:-1,sides:[3,0]}];
      const ranked=corners.map(corner=>({...corner,score:corner.sides.filter(side=>walls[side]).length,roll:hash(run.seed,`foraging:${run.floor}:${key}:${corner.sides.join('-')}`)})).sort((a,b)=>b.score-a.score||a.roll-b.roll);
      const corner=ranked[0];
      candidates.push({cx,cy,offsetX:corner.x*OFFSET,offsetY:corner.y*OFFSET,wallSides:corner.sides.filter(side=>walls[side]),score:corner.score,roll:hash(run.seed,`foraging:${run.floor}:cell:${key}`)});
    }
    candidates.sort((a,b)=>b.score-a.score||a.roll-b.roll||a.cy-b.cy||a.cx-b.cx);
    // Reserve the original slots including collected resources. Picking one must
    // not move its neighbours on reload while the current maze stays unchanged.
    return resources(run,state.power,state.counts).flatMap((entry,index)=>{
      const point=candidates[index];
      if(!point||state.claimed.includes(entry.id))return [];
      return [{...entry,cx:point.cx,cy:point.cy,offsetX:point.offsetX,offsetY:point.offsetY,wallSides:[...point.wallSides]}];
    });
  }
  return freeze({PROFILES,LEGACY_PROFILES,APPEARANCE,BASE_APPEARANCE,ENVIRONMENT_BONUS,POWER_PROFILES,POWER_APPEARANCE,POWER_BASE_APPEARANCE,POWER_ENVIRONMENT_BONUS,DRAFT_POWER_PROFILES,DRAFT_POWER_APPEARANCE,REGIONS,NATURAL_ORES,POWER_STONES,OFFSET,hash,profile,powerProfile,rollCount,rollWeighted,drawCounts,counts,orePool,drawPowerDeposit,powerDeposit,fresh,validate,specs,claim,label,wallsAt,plan});
});
