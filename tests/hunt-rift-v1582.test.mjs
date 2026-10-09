import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),D=require('../story/tower-dungeons.js'),B=require('../story/tower-floor-lords.js'),GM=require('../story/tower-gm.js');
const at=(floor,seed=9,level=6,companions=[{job:'healer',level:5}])=>GM.build({floor,job:'swordsman',level,seed,companions}).run;
const lordFloor=f=>!!B.allLords()[f];
const huntFloor=(seed=9,kind=null,from=98,to=-49)=>{for(let f=from;f>=to;f--){if(f===0)continue;const run=at(f,seed);const offer=D.huntOffer(run);if(offer&&(!kind||offer.kind===kind))return {run,offer,floor:f};}return null;};
const enter=(run,offer)=>{const r=D.enter(run,offer.id,{x:0,y:0,shiftLeft:5},run.revision);assert.equal(r.ok,true,r.message);return r.run;};

test('about two thirds of the floors without a chapter lord offer a hunt rift, surface and underground, independent of the puzzle rift',()=>{
  let eligible=0,offered=0,both=0;const kinds=new Set();
  for(const seed of [3,9,27])for(let f=98;f>=-49;f--){if(f===0||lordFloor(f))continue;const run=at(f,seed,1,[]);eligible++;const offer=D.huntOffer(run);
    if(offer){offered++;kinds.add(offer.kind);assert.equal(offer.id,'hunt:'+f+':'+seed);assert.deepEqual(D.huntOffer(structuredClone(run)),offer,'deterministic');if(D.offer(run))both++;
      assert.ok(offer.count>=3&&offer.count<=8&&offer.required.length>=1&&offer.required.every(i=>i<offer.count));assert.ok(offer.reward.items.heal>=1&&offer.reward.items.ration===1);}}
  assert.equal(D.HUNT_CHANCE,65);assert.ok(offered/eligible>.58&&offered/eligible<.72,'about two thirds: '+offered+'/'+eligible);assert.deepEqual([...kinds].sort(),['hunt-champion','hunt-purge','hunt-shards']);assert.ok(both>0,'a floor can have both rifts');
  for(const f of [99,90,80,50,10,1,-10,-30,-50])for(const seed of [3,9,27])assert.equal(D.huntOffer(at(f,seed,1,[])),null,f+' has a chapter lord or is the first floor');
  const legacy=P.enable(C.newRun({seed:9}),'swordsman').run;for(let f=98;f>40;f--){legacy.floor=f;legacy.floorsCleared=99-f;assert.equal(D.huntOffer(legacy),null,'journeys without hero loadouts have none');}
});

test('entering needs no discovery; inside, only the rift\'s own combatants exist and the floor roster waits untouched',()=>{
  for(const kind of ['hunt-purge','hunt-champion','hunt-shards']){
    const {run,offer}=huntFloor(9,kind),floorRoster=P.monsterSpecs(run);run.defeatedMonsters.push(floorRoster[0].id);
    assert.equal(run.expedition.discovered,false);const inside=enter(run,offer);
    const specs=P.monsterSpecs(inside);assert.equal(specs.length,offer.count);assert.deepEqual(specs.map(s=>s.id),Array.from({length:offer.count},(_,i)=>'monster-h-'+i));assert.ok(specs.every(s=>s.hunt));
    assert.ok(C.validateSave(JSON.stringify(inside)),kind+' saves while inside');assert.ok(inside.defeatedMonsters.includes(floorRoster[0].id),'floor progress kept');
    if(kind==='hunt-champion'){const champion=specs[0],others=specs.slice(1);assert.equal(champion.champion,true);assert.match(champion.def.name,/^裂隙首領・/);assert.ok(champion.maxHp>Math.max(...others.map(s=>s.maxHp)));}
    if(kind==='hunt-shards'){assert.deepEqual(specs.filter(s=>s.carrier).map(s=>s.id),['monster-h-0','monster-h-1','monster-h-2']);assert.ok(specs.filter(s=>s.carrier).every(s=>s.def.name.startsWith('帶晶・')));}
    assert.deepEqual([...(()=>{const r=structuredClone(inside);return H.applyTaunt(r,'hero',{monsters:specs.map((s,i)=>({id:s.id,alive:true,x:0,z:1+i*.2})),origin:{x:0,z:0},clear:()=>true,seconds:3,radius:9});})()].every(id=>id.startsWith('monster-h-')),true,'taunts reach the rift combatants');
  }
});

test('hunt foes give half experience and no coins or ground drops; the champion counts as a mini lord and its 1-3 spoils go straight into the bag',()=>{
  const {run,offer}=huntFloor(9,'hunt-champion'),inside=enter(run,offer),specs=P.monsterSpecs(inside);
  const stock=r=>[r.bag,r.party.ingredients,r.party.journey.materials].reduce((n,o)=>n+Object.values(o).reduce((a,b)=>a+b,0),0)+(r.party.light?r.party.light.wood:0);
  for(const spec of specs){const coins=inside.coins,xp=H.state(inside).xp,before=stock(inside),drops=H.finishMonster(inside,spec,{x:1,y:1});
    assert.equal(inside.coins,coins);if(spec.champion){assert.ok(drops.length>=1&&drops.length<=3,'champion spoils');assert.ok(drops.every(d=>d.direct&&d.label));assert.equal(stock(inside)-before,drops.reduce((n,d)=>n+d.quantity,0),'every spoil lands in the bag');}else assert.deepEqual(drops,[]);
    const full=Math.round((5+spec.strength*2+(spec.elite?B.MINI_XP[inside.floor<0?'underworld':'surface']:0))*(inside.floor<0?5:1+(99-inside.floor)/H.SURFACE_XP_DEPTH));
    assert.equal(H.state(inside).xp-xp,Math.round(full*H.HUNT_XP),spec.id);}
  assert.deepEqual(inside.party.loot.entries.filter(e=>e.source.startsWith('monster-h-')),[]);
});

test('completing pays the reward once, leaves no trace of the rift, keeps only this floor\'s hunt record and never reopens it',()=>{
  const {run,offer,floor}=huntFloor(9,'hunt-purge'),inside=enter(run,offer);
  assert.equal(D.finish(inside,'completed',inside.revision).ok,false,'not before the targets fall');
  for(const spec of P.monsterSpecs(inside))if(offer.required.includes(+spec.id.slice(10))){H.finishMonster(inside,spec,{x:1,y:1});inside.party.health[spec.id]=undefined;delete inside.party.health[spec.id];}
  inside.party.poise['monster-h-0']=undefined;delete inside.party.poise['monster-h-0'];inside.monsterStuns={};
  assert.equal(D.huntDone(inside,offer),true);const coins=inside.coins,heal=inside.bag.heal,ration=inside.bag.ration;
  const done=D.finish(inside,'completed',inside.revision);assert.equal(done.ok,true,done.message);const out=done.run;
  assert.equal(out.coins,coins+offer.reward.coins);assert.equal(out.bag.heal,heal+offer.reward.items.heal);assert.equal(out.bag.ration,ration+1);
  assert.equal(out.expedition.active,null);assert.deepEqual(out.defeatedMonsters.filter(id=>C.HUNT_ID.test(id)),[]);assert.ok(C.validateSave(JSON.stringify(out)));
  assert.equal(D.huntOffer(out),null,'one hunt per floor');assert.deepEqual(out.expedition.history.filter(e=>D.isHuntId(e.id)).map(e=>e.floor),[floor]);
  // A later floor's hunt drops the earlier record instead of growing the history.
  let later=null;for(let f=floor-1;f>=-49&&!later;f--){if(f===0)continue;const r=structuredClone(out);r.floor=f;r.floorsCleared=f>0?99-f:98-f;r.chronicle=require('../story/tower-narrative.js').newChronicle(f);if(f<0)continue;r.adventure=C.newAdventure();r.claimed=[];r.defeatedMonsters=[];P.advance(r,{reward:false});if(C.validateSave(JSON.stringify(r))&&D.huntOffer(r))later=r;}
  assert.ok(later);const next=enter(later,D.huntOffer(later)),gone=D.finish(next,'abandoned',next.revision);assert.equal(gone.ok,true);
  assert.deepEqual(gone.run.expedition.history.filter(e=>D.isHuntId(e.id)).map(e=>e.floor),[later.floor]);assert.ok(C.validateSave(JSON.stringify(gone.run)));
});

test('abandoning, running out of time or falling inside clears every hunt combatant from the save',()=>{
  const {run,offer}=huntFloor(9,'hunt-shards');
  for(const outcome of ['abandoned','expired','dead']){
    let inside=enter(structuredClone(run),offer);const spec=P.monsterSpecs(inside)[0];
    inside.party.health[spec.id]=Math.ceil(spec.maxHp/2);inside.monsterStuns[spec.id]=1;H.finishMonster(inside,P.monsterSpecs(inside)[1],{x:1,y:1});
    assert.ok(C.validateSave(JSON.stringify(inside)),'mid-fight state saves');
    if(outcome==='expired')inside.expedition.active.elapsed=offer.timeLimit;
    if(outcome==='dead'){inside.status='dead';inside.hp=0;H.setHp(inside,'hero',0);}
    const result=D.finish(inside,outcome==='dead'?'abandoned':outcome,inside.revision);assert.equal(result.ok,true,outcome+': '+result.message);
    const out=result.run;assert.equal(out.expedition.active,null);
    for(const ids of [out.defeatedMonsters,Object.keys(out.party.health),Object.keys(out.monsterStuns),Object.keys(out.party.loadouts.enemy)])assert.deepEqual(ids.filter(id=>C.HUNT_ID.test(id)),[],outcome);
    if(outcome!=='dead')assert.ok(C.validateSave(JSON.stringify(out)),outcome);
  }
});

test('hunt combatants never appear in a save outside their rift, and a deep champion fits its health cap',()=>{
  const plain=at(85);for(const change of [r=>r.defeatedMonsters.push('monster-h-0'),r=>r.party.health['monster-h-1']=10,r=>r.monsterStuns['monster-h-2']=1])
    {const copy=structuredClone(plain);change(copy);assert.equal(C.validateSave(JSON.stringify(copy)),null);}
  const deep=huntFloor(9,'hunt-champion',-1,-49);assert.ok(deep,'a deep champion hunt exists');const inside=enter(deep.run,deep.offer),champion=P.monsterSpecs(inside).find(s=>s.champion);
  assert.ok(champion.maxHp>258);inside.party.health[champion.id]=champion.maxHp;assert.ok(C.validateSave(JSON.stringify(inside)),'deep champion at full health saves');
  const chapterLord=B.allLords()[-Math.ceil(-inside.floor/10)*10];assert.ok(champion.def.damage<chapterLord.damage);
});

test('the story runtime builds the gate last, fights inside with companions, and uses the shared monster loop',()=>{
  const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(tower,/buildAdventureWorld\(random,used\);\n    buildHuntGate\(random,used\);\n  \}/,'the gate is placed after every other object, so nothing else moves');
  assert.match(tower,/if\(huntActive\(\)\)\{buildHuntWorld\(random,used\);partyUI\?\.build\(random,used\);lightingUI\?\.build\(random,used\);return;\}/);
  assert.match(tower,/if\(huntActive\(\)\)\{tickHunt\(dt,now\);return;\}/);assert.match(tower,/inDungeon\(\)&&!huntActive\(\)\|\|\(!run\?\.party\?\.loadouts&&attackLeft>0\)\)return;/,'attacks work inside a hunt');
  assert.match(tower,/if\(spec\.champion\)markMiniLord\(model\);if\(spec\.carrier\)markCarrier\(model\);/);assert.match(tower,/o===huntGate\?'獵'/);
  assert.match(readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8'),/\(!ctx\.inDungeon\(\)\|\|ctx\.inHunt\?\.\(\)\)/);
});

test('the hunt champion is a little tougher than a floor mini lord, still below the chapter lord, and saves at full health deep down',()=>{
  assert.deepEqual([B.CHAMPION_HP,B.CHAMPION_DAMAGE,B.MINI_HP,B.MINI_DAMAGE],[2.2,1.35,1.8,1.25]);
  for(const [from,to]of [[98,60],[59,20],[-1,-49]]){const found=huntFloor(9,'hunt-champion',from,to);if(!found)continue;const inside=enter(found.run,found.offer),champion=P.monsterSpecs(inside).find(s=>s.champion),mini=P.monsterSpecs(found.run).find(s=>s.elite);
    assert.ok(champion.maxHp>mini.maxHp,found.floor+' more health than the floor mini lord');assert.ok(champion.def.damage>=mini.def.damage);
    const lord=B.allLords()[found.floor>0?Math.max(1,Math.floor(found.floor/10)*10):-Math.ceil(-found.floor/10)*10];assert.ok(champion.def.damage<lord.damage,'below the chapter lord');
    inside.party.health[champion.id]=champion.maxHp;assert.ok(C.validateSave(JSON.stringify(inside)),found.floor+' saves at full health');}
});
