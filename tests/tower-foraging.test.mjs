import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const F=require('../story/tower-foraging.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js');
const M=require('../story/tower-materials.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),R=require('../story/tower-reinforcements.js');

function fresh(floor=99,seed=31){
  let run=P.enable(C.newRun({seed,name:'採集旅人'}),'swordsman').run;
  if(floor<0){
    run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);
    run.chronicle.ending='release';run.chronicle.clues=N.CHAPTERS.map(chapter=>chapter.clueId);
    P.advance(run,{reward:false});
    const entered=C.startUnderworld(run);assert.ok(entered.ok,entered.message);run=entered.run;
  }
  run.floor=floor;run.floorsCleared=floor<0?99-floor-1:99-floor;
  run.chronicle=N.newChronicle(floor);if(floor<0)run.chronicle.ending=run.underworld.surfaceEnding;
  run.expedition=D.newExpedition();run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};
  P.advance(run,{reward:false});run.party.foraging=F.fresh(run);
  assert.ok(C.validateSave(run));return run;
}
function withResources(floor=99,predicate=amount=>amount.herb>0&&amount.ore>0){
  // The reduced appearance rate makes two simultaneous three-unit deposits
  // uncommon. Keep full-density placement coverage with a finite seed search.
  for(let seed=1;seed<=12000;seed++)if(predicate(F.counts({floor,seed})))return fresh(floor,seed);
  throw new Error('No finite seeded foraging fixture found');
}
function grid(size=9,solid=false){
  return {size,hWalls:Array.from({length:size-1},()=>Array(size).fill(solid)),vWalls:Array.from({length:size},()=>Array(size-1).fill(solid))};
}

test('all 149 valid floors have explicit profiles and deterministic independent resource draws',()=>{
  assert.equal(Object.keys(F.REGIONS).length,15);
  assert.deepEqual(Object.keys(F.REGIONS).sort(),M.ECOLOGIES.map(region=>region.id).sort());
  assert.deepEqual(F.LEGACY_PROFILES,{suitable:{0:0,1:40,2:35,3:25},neutral:{0:30,1:30,2:25,3:15},unsuitable:{0:60,1:20,2:15,3:5}});
  assert.equal(F.FORMAT_VERSION,4);assert.equal(F.HARVEST_RULE,3);assert.equal(F.POWER_RULE,4);assert.equal(F.POWER_DEPOSIT_QUANTITY,1);
  assert.equal(F.BASE_APPEARANCE,40);assert.equal(F.ENVIRONMENT_BONUS,20);
  assert.deepEqual(F.APPEARANCE,{suitable:60,neutral:40,unsuitable:20});
  assert.deepEqual(F.V3_APPEARANCE,{suitable:50,neutral:30,unsuitable:10});
  for(const [name,weights]of Object.entries(F.PROFILES)){
    assert.equal(weights[0],100-F.APPEARANCE[name]);assert.ok(Math.abs(Object.values(weights).reduce((sum,chance)=>sum+chance,0)-100)<1e-10);
    for(const quantity of [1,2,3])assert.ok(Math.abs(weights[quantity]/F.APPEARANCE[name]-F.LEGACY_PROFILES[name][quantity]/(100-F.LEGACY_PROFILES[name][0]))<1e-10);
  }
  const floors=[...Array.from({length:99},(_,index)=>index+1),...Array.from({length:50},(_,index)=>-index-1)];
  for(const floor of floors)for(const seed of [1,31,9987,0xffffffff]){
    const run={floor,seed,party:{foraging:F.fresh({floor,seed})}},before=structuredClone(run),amount=F.counts(run);
    assert.deepEqual(F.counts(run),amount);assert.deepEqual(F.specs(run),F.specs(structuredClone(run)));
    assert.ok([0,1,2,3].includes(amount.herb)&&[0,1,2,3].includes(amount.ore));
    assert.equal(F.specs(run).filter(entry=>entry.kind==='herb').length,amount.herb);
    assert.equal(F.specs(run).filter(entry=>entry.kind==='ore').length,amount.ore);
    assert.ok(F.specs(run).filter(entry=>entry.kind==='power').length<=1);
    assert.equal(new Set(F.specs(run).map(entry=>entry.id)).size,F.specs(run).length);
    assert.ok(F.specs(run).every(entry=>entry.quantity===1));assert.deepEqual(run,before);
  }
  for(const floor of [0,100,-51,NaN])assert.throws(()=>F.fresh({floor,seed:31}),RangeError);
  for(const seed of [0,-1,0x100000000,1.5])assert.equal(F.validate(undefined,99,seed),null);
  for(const rule of [0,4,NaN])assert.throws(()=>F.drawCounts({floor:99,seed:31},rule),RangeError);
});

test('environment classifications follow plant growth and mineral-friendly regions',()=>{
  for(const region of ['garden','roots','mist','underworld:roots','underworld:mist'])assert.equal(F.REGIONS[region].herb,'suitable');
  for(const region of ['frost','furnace','underworld:furnace'])assert.equal(F.REGIONS[region].herb,'unsuitable');
  for(const region of ['echo','clockwork','furnace',...M.ECOLOGIES.filter(region=>region.underground).map(region=>region.id)])assert.equal(F.REGIONS[region].ore,'suitable');
  for(const region of ['garden','roots'])assert.equal(F.REGIONS[region].ore,'unsuitable');
  assert.ok(Object.isFrozen(F.PROFILES.suitable)&&Object.isFrozen(F.REGIONS.garden));
});

test('seed batches follow each exact quantity profile with independent herb and ore rolls',()=>{
  const batches=12000;
  for(const [kind,floor,name] of [['herb',89,'suitable'],['herb',99,'neutral'],['herb',39,'unsuitable'],['ore',69,'suitable'],['ore',99,'neutral'],['ore',89,'unsuitable']]){
    const totals=[0,0,0,0];for(let seed=1;seed<=batches;seed++)totals[F.counts({floor,seed})[kind]]++;
    for(let quantity=0;quantity<=3;quantity++)assert.ok(Math.abs(totals[quantity]/batches-F.PROFILES[name][quantity]/100)<.02,`${kind}/${name}/${quantity}: ${totals[quantity]}`);
  }
  const joint=Array.from({length:4},()=>[0,0,0,0]);
  for(let seed=1;seed<=batches;seed++){const amount=F.counts({floor:99,seed});joint[amount.herb][amount.ore]++;}
  for(let herb=0;herb<=3;herb++)for(let ore=0;ore<=3;ore++)assert.ok(Math.abs(joint[herb][ore]/batches-F.PROFILES.neutral[herb]*F.PROFILES.neutral[ore]/10000)<.015,`${herb}/${ore} count rolls correlate`);
});

test('deposits use local natural minerals, never body parts or surface-only rare promotions',()=>{
  assert.deepEqual(F.NATURAL_ORES,['ironore','crystalshard','starore']);
  const seen=new Set();
  for(const ecology of M.ECOLOGIES){
    const local=[...new Set(Object.values(ecology.variants).flatMap(variant=>variant.materials))].filter(key=>F.NATURAL_ORES.includes(key));
    assert.deepEqual([...F.orePool({floor:ecology.high})].sort(),(local.length?local:['ironore']).sort());
    for(let seed=1;seed<=100;seed++){
      const run={floor:ecology.high,seed,party:{foraging:F.fresh({floor:ecology.high,seed})}};
      for(const entry of F.specs(run)){
        if(entry.kind==='power'){assert.ok(F.POWER_STONES.includes(entry.key));assert.equal(entry.type,'item');continue;}
        assert.equal(entry.quantity,1);
        if(entry.kind==='herb'){assert.equal(entry.key,'herb');assert.equal(entry.type,'ingredient');}
        else{seen.add(entry.key);assert.equal(entry.type,'material');assert.ok(F.NATURAL_ORES.includes(entry.key));if(!ecology.underground)assert.notEqual(entry.rarity,'rare');}
      }
    }
  }
  assert.deepEqual([...seen].sort(),[...F.NATURAL_ORES].sort());
});

test('missing old-save state is safely normalized without free stock or reused ground receipts',()=>{
  const original=withResources(),old=structuredClone(original);delete old.party.foraging;
  const restored=C.validateSave(JSON.stringify(old));assert.ok(restored);
  assert.deepEqual(restored.party.foraging,F.fresh(original));
  assert.deepEqual(restored.party.ingredients,original.party.ingredients);
  assert.deepEqual(restored.party.journey.materials,original.party.journey.materials);
  assert.deepEqual(restored.party.loot,original.party.loot);
  assert.deepEqual(C.validateSave(restored),restored);
  assert.deepEqual(F.specs(restored),F.specs(original));
});

test('surface and underground harvest records survive the real save validator on every floor',()=>{
  for(const floor of [...Array.from({length:99},(_,index)=>index+1),...Array.from({length:50},(_,index)=>-index-1)]){
    const original=fresh(floor,31),entry=F.specs(original)[0],result=entry?F.claim(original,entry.id):{ok:true,run:original};
    assert.ok(result.ok,result.message);const restored=C.validateSave(JSON.stringify(result.run));
    assert.ok(restored,'floor '+floor);assert.deepEqual(restored.party.foraging,result.run.party.foraging);
    assert.deepEqual(F.specs(restored),F.specs(result.run));if(entry)assert.equal(F.claim(restored,entry.id).ok,false);
  }
});

test('forged, duplicate, future-floor and foreign-seed harvest receipts are rejected',()=>{
  const run=withResources(),first=F.specs(run)[0];
  const changes=[
    state=>state.version=5,state=>state.floor=98,state=>state.seed++,state=>state.claimed=null,
    state=>state.harvestRule=4,state=>delete state.counts,state=>state.counts.herb=4,state=>state.counts.ore=-1,
    state=>state.claimed=['foraging:99:herb:999'],state=>state.claimed=['foraging:98:herb:0'],
    state=>state.claimed=['foraging:99:ore:999'],state=>state.claimed=[first.id,first.id],
    state=>state.claimed=[{}],state=>state.claimed=Array(7).fill(first.id),
  ];
  for(const change of changes){const bad=structuredClone(run);change(bad.party.foraging);assert.equal(F.validate(bad.party.foraging,bad.floor,bad.seed),null);assert.equal(C.validateSave(bad),null);}
  const claimed=structuredClone(run.party.foraging);claimed.claimed.push(first.id);
  const normalized=F.validate(claimed,run.floor,run.seed);assert.deepEqual(normalized,claimed);
  normalized.claimed.length=0;assert.equal(claimed.claimed.length,1);
});

test('each plant and deposit grants exactly one unit atomically, once, with stale revisions rejected',()=>{
  let run=withResources();const entries=F.specs(run),original=structuredClone(run);
  for(const kind of ['herb','ore']){
    const beforeRun=structuredClone(run);
    const entry=entries.find(entry=>entry.kind===kind),stock=entry.type==='ingredient'?run.party.ingredients:run.party.journey.materials,before=stock[entry.key],revision=run.revision;
    const stale=F.claim(run,entry.id,revision-1);assert.equal(stale.ok,false);assert.equal(stale.run,run);
    const result=F.claim(run,entry.id,revision);assert.ok(result.ok,result.message);assert.deepEqual(result.effect.pickup,entry);assert.match(result.message,new RegExp(F.label(entry)));
    const updated=entry.type==='ingredient'?result.run.party.ingredients:result.run.party.journey.materials;
    assert.equal(updated[entry.key],before+1);assert.equal(result.run.revision,revision+1);
    assert.ok(result.run.party.foraging.claimed.includes(entry.id));assert.equal(F.claim(result.run,entry.id).ok,false);
    assert.ok(!F.specs(result.run).some(spec=>spec.id===entry.id));assert.deepEqual(run,beforeRun);
    run=C.validateSave(JSON.stringify(result.run));assert.ok(run);assert.equal(F.claim(run,entry.id).ok,false);
  }
  assert.deepEqual(run.party.loot,original.party.loot);assert.deepEqual(run.claimed,original.claimed);
  assert.equal(F.claim(run,'foraging:99:ore:999').ok,false);
});

test('a 99-unit stack keeps the resource and receipt untouched until one space opens',()=>{
  for(const kind of ['herb','ore']){
    let run=withResources();const entry=F.specs(run).find(entry=>entry.kind===kind),stock=entry.type==='ingredient'?run.party.ingredients:run.party.journey.materials;
    stock[entry.key]=99;const before=structuredClone(run),blocked=F.claim(run,entry.id);
    assert.equal(blocked.ok,false);assert.match(blocked.message,/已滿/);assert.equal(blocked.run,run);assert.deepEqual(run,before);
    assert.ok(F.specs(C.validateSave(run)).some(spec=>spec.id===entry.id));
    stock[entry.key]=98;const result=F.claim(run,entry.id);assert.ok(result.ok,result.message);
    assert.equal((entry.type==='ingredient'?result.run.party.ingredients:result.run.party.journey.materials)[entry.key],99);
    assert.equal(F.claim(result.run,entry.id).ok,false);
  }
});

test('reloads and repeated maze shifts preserve fixed counts and collected resources',()=>{
  let run=withResources();const before=F.counts(run),entry=F.specs(run)[0],result=F.claim(run,entry.id);assert.ok(result.ok,result.message);run=result.run;
  const receipt=structuredClone(run.party.foraging),remaining=F.specs(run);
  for(let shift=0;shift<30;shift++){
    run=R.spawn(run,[{x:2,y:2},{x:3,y:3},{x:4,y:4}]).run;run=C.validateSave(JSON.stringify(run));
    assert.ok(run);assert.deepEqual(run.party.foraging,receipt);assert.deepEqual(F.counts(run),before);assert.deepEqual(F.specs(run),remaining);
  }
});

test('subquest entry and return preserve parent-floor harvest with no dungeon resources',()=>{
  let run,offer;
  for(let seed=1;seed<=512;seed++){
    const candidate=D.offer({floor:95,seed,expedition:D.newExpedition()});
    if(candidate&&F.counts({floor:95,seed}).herb>0){run=fresh(95,seed);offer=candidate;break;}
  }
  assert.ok(run&&offer);const harvested=F.claim(run,F.specs(run)[0].id);assert.ok(harvested.ok,harvested.message);run=harvested.run;
  const receipt=structuredClone(run.party.foraging),remaining=F.specs(run);
  const discovered=D.discover(run);assert.ok(discovered.ok,discovered.message);
  const entered=D.enter(discovered.run,offer.id,{x:1,y:2,shiftLeft:23},discovered.run.revision);assert.ok(entered.ok,entered.message);
  assert.deepEqual(F.specs(entered.run),[]);assert.deepEqual(F.plan(entered.run,grid()),[]);
  assert.equal(F.claim(entered.run,remaining[0]?.id||'foraging:95:ore:0').ok,false);
  const returned=D.finish(entered.run,'abandoned',entered.run.revision);assert.ok(returned.ok,returned.message);
  assert.deepEqual(returned.run.party.foraging,receipt);assert.deepEqual(F.specs(returned.run),remaining);
});

test('a real floor advance starts only the new floor resources and preserves carried materials',()=>{
  const run=withResources(),entry=F.specs(run)[0],result=F.claim(run,entry.id);assert.ok(result.ok,result.message);
  const stock=structuredClone(result.run.party.journey.materials),ingredients=structuredClone(result.run.party.ingredients);
  const descended=C.descend(result.run,result.run.revision);assert.ok(descended.ok,descended.message);assert.equal(descended.run.floor,98);
  assert.deepEqual(descended.run.party.foraging,F.fresh(descended.run));assert.deepEqual(descended.run.party.journey.materials,stock);assert.deepEqual(descended.run.party.ingredients,ingredients);
  assert.ok(F.specs(descended.run).every(spec=>spec.id.startsWith('foraging:98:')));
});

test('placement stays in walkable wall-side corners and excludes entrances, stairs and occupied cells',()=>{
  const run=withResources(89,amount=>amount.herb===3&&amount.ore===3),maze=grid(9,true),excluded=new Set(['1,1','2,2','3,3','4,4']);
  // Connected zigzag corridors provide real, reachable two-wall corners.
  maze.vWalls.forEach(row=>row.fill(false));maze.hWalls.forEach((row,index)=>{row[index%2?0:8]=false;});
  maze.blockedCells=[{x:5,y:5}];maze.entranceCell={x:0,y:0};maze.exitCell={x:8,y:8};
  const placements=F.plan(run,maze,{excludeCells:excluded});assert.equal(placements.length,6+(F.powerDeposit(run)?1:0));
  assert.deepEqual(placements,F.plan(structuredClone(run),maze,{excludeCells:excluded}));
  assert.equal(new Set(placements.map(point=>point.cx+','+point.cy)).size,placements.length);
  for(const point of placements){
    assert.ok(!excluded.has(point.cx+','+point.cy));assert.notDeepEqual([point.cx,point.cy],[0,0]);assert.notDeepEqual([point.cx,point.cy],[8,8]);assert.notDeepEqual([point.cx,point.cy],[5,5]);
    assert.ok(point.cx>=0&&point.cx<9&&point.cy>=0&&point.cy<9);
    assert.equal(Math.abs(point.offsetX),.30);assert.equal(Math.abs(point.offsetY),.30);
    assert.ok(point.wallSides.length===2);assert.ok(point.wallSides.every(side=>F.wallsAt(point.cx,point.cy,9,9,maze.hWalls,maze.vWalls)[side]));
    // At the game's 4-unit cell and .7-unit wall, a .25-radius plant/rock is clear.
    assert.ok(2-Math.abs(point.offsetX*4)>.7/2+.25);assert.ok(2-Math.abs(point.offsetY*4)>.7/2+.25);
  }
  const first=placements[0],claimed=structuredClone(run);claimed.party.foraging.claimed.push(first.id);
  assert.deepEqual(F.plan(claimed,maze,{excludeCells:excluded}),placements.slice(1),'Collecting a plant never reassigns remaining slots');
});

test('open cells use real boundary walls; sparse or changed mazes never fabricate a pickup',()=>{
  const run=withResources(89,amount=>amount.herb===3&&amount.ore===3),maze=grid(9),placements=F.plan(run,maze);
  assert.equal(placements.length,6+(F.powerDeposit(run)?1:0));assert.ok(placements.every(point=>point.wallSides.length>0));
  assert.ok(placements.every(point=>point.cx===0||point.cx===8||point.cy===0||point.cy===8));
  assert.deepEqual(F.plan(run,{...maze,walkableCells:[{x:4,y:4}]}),[],'An open corridor centre is not a forage site');
  const allowed=[{x:0,y:4},{x:8,y:4}];assert.equal(F.plan(run,{...maze,walkableCells:allowed}).length,2);
  const claimed=structuredClone(run);claimed.party.foraging.claimed.push(placements[0].id);
  const changed=F.plan(claimed,grid(9,true));assert.equal(changed.length,placements.length-1);
  assert.ok(!changed.some(point=>point.id===placements[0].id));assert.deepEqual(F.counts(claimed),F.counts(run));
  assert.deepEqual(F.plan(run,{size:NaN}),[]);assert.deepEqual(F.plan(run,{size:9},{excludeCells:Array.from({length:81},(_,index)=>[index%9,Math.floor(index/9)])}),[]);
});
