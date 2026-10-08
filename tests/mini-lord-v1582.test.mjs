import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js');
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),B=require('../story/tower-floor-lords.js'),M=require('../story/tower-materials.js'),GM=require('../story/tower-gm.js');
const SURFACE=Array.from({length:99},(_,i)=>99-i),DEEP=Array.from({length:50},(_,i)=>-1-i),lordFloor=f=>!!B.allLords()[f];
const at=(floor,seed=9,level=5)=>GM.build({floor,job:'swordsman',level,seed}).run;

test('every other floor of a modern journey has exactly one regional mini lord in the free lord slot; lord floors, rifts and legacy journeys have none',()=>{
  for(const floor of [...SURFACE,...DEEP])for(const seed of [9,4242]){
    const run=at(floor,seed),minis=P.monsterSpecs(run).filter(s=>s.elite);
    if(lordFloor(floor)){assert.equal(minis.length,0,floor+' is a chapter lord floor');continue;}
    assert.equal(minis.length,1,'floor '+floor);const m=minis[0];
    assert.equal(m.id,floor<0?'monster-12':'monster-11');assert.ok(C.validMonsterId(m.id,floor));assert.equal(m.lord,undefined,'not a chapter lord: no cutscene, voice, gear drop or descent gate');
    const entry=B.MINI_LORDS[M.ecology(run).id].find(e=>e.id===m.mini);assert.ok(entry,'from this region');assert.equal(m.def.name,'小樓主・'+entry.name);assert.equal(m.kind,entry.kind);assert.equal(m.def.color,entry.color);
    assert.ok(M.monsterTypes(run).includes(m.kind),'a creature of this region');
    assert.deepEqual(P.monsterSpecs(structuredClone(run)).find(s=>s.elite),m,'deterministic for the floor');
    assert.equal(P.monsterSpecs(run).filter(s=>s.id===m.id).length,1,'never collides with an ordinary monster');
  }
  const rift=at(85);rift.expedition={...rift.expedition,active:{id:'rift-test',kind:'bells'}};assert.equal(B.miniFor(rift,'garden'),null);
  const legacy=P.enable(C.newRun({seed:9}),'swordsman').run;legacy.floor=85;legacy.floorsCleared=14;P.advance(legacy,{reward:false});assert.equal(P.monsterSpecs(legacy).some(s=>s.elite),false,'journeys without hero loadouts keep their original roster');
});

test('each region has two mini lords, both met across its floors, built from that region\'s own creatures',()=>{
  assert.deepEqual(Object.keys(B.MINI_LORDS).sort(),M.ECOLOGIES.map(e=>e.id).sort());
  for(const e of M.ECOLOGIES){const list=B.MINI_LORDS[e.id];assert.equal(list.length,2);assert.equal(new Set(list.map(m=>m.name)).size,2);
    for(const m of list)assert.ok(M.monsterTypes(e.high).includes(m.kind),e.id+' '+m.kind);
    const met=new Set();for(let floor=e.high;floor>=e.low;floor--)for(const seed of [1,2,3,4,5,6,7,8])if(!lordFloor(floor)){const s=P.monsterSpecs(at(floor,seed)).find(x=>x.elite);if(s)met.add(s.mini);}
    assert.equal(met.size,2,e.id+' repeats both of its mini lords across floors');}
});

test('a mini lord is tougher than its kin and gentler than the chapter lord, and its full or wounded health saves validly',()=>{
  for(const floor of [...SURFACE,...DEEP].filter(f=>!lordFloor(f))){
    const run=at(floor),specs=P.monsterSpecs(run),m=specs.find(s=>s.elite),kin=specs.filter(s=>!s.elite&&!s.lord&&!s.reinforcement),lord=B.allLords()[floor>0?Math.max(1,Math.floor(floor/10)*10):-Math.ceil(-floor/10)*10];
    assert.ok(m.maxHp>Math.max(...kin.map(s=>s.maxHp)),floor+' tougher than its kin');assert.ok(m.def.damage<lord.damage,floor+' hits softer than the chapter lord');
    const lordHp=B.spec({...run,floor:lord.floor,party:run.party})?.maxHp;if(lordHp)assert.ok(m.maxHp<lordHp,floor+' less health than the chapter lord');
    for(const hp of [m.maxHp,Math.ceil(m.maxHp/2)]){const copy=structuredClone(run);copy.party.health[m.id]=hp;assert.ok(C.validateSave(JSON.stringify(copy)),floor+' saves at '+hp);}
  }
});

test('kill experience: mini lords and surface chapter lords add their bonus, deeper surface floors pay more, the deep keeps x5',()=>{
  const depth=f=>1+(99-f)/H.SURFACE_XP_DEPTH;
  const xpFor=(floor,pick)=>{const run=at(floor,9,1),spec=P.monsterSpecs(run).find(pick),before=H.state(run).xp;H.finishMonster(run,spec);return [H.state(run).xp-before,spec];};
  let [xp,spec]=xpFor(85,s=>s.elite);assert.equal(xp,Math.round((5+spec.strength*2+B.MINI_XP.surface)*depth(85)));
  [xp,spec]=xpFor(85,s=>!s.elite&&!s.lord);assert.equal(xp,Math.round((5+spec.strength*2)*depth(85)));
  [xp,spec]=xpFor(5,s=>!s.elite&&!s.lord);assert.equal(xp,Math.round((5+spec.strength*2)*depth(5)),'x2.81 near the top of the tower');
  [xp,spec]=xpFor(80,s=>s.lord);assert.equal(xp,Math.round((5+spec.strength*2+B.LORD_XP)*depth(80)));
  [xp,spec]=xpFor(-15,s=>s.elite);assert.equal(xp,(5+spec.strength*2+B.MINI_XP.underworld)*5);
  [xp,spec]=xpFor(-20,s=>s.lord);assert.equal(xp,(5+spec.strength*2)*5,'deep chapter lords keep their reward');
  assert.deepEqual([B.MINI_XP.surface,B.MINI_XP.underworld,B.LORD_XP,H.SURFACE_XP_DEPTH,H.HUNT_XP],[40,20,100,52,.5]);
});

// Arrive at each floor having defeated a share of ordinary monsters plus every mini lord and chapter lord.
function surfaceLevels(share,seed=777){
  const run=at(99,seed,1),levels={};let acc=0;
  for(let floor=99;floor>=1;floor--){
    if(floor<99){run.floor=floor;run.floorsCleared=99-floor;run.defeatedMonsters=[];P.advance(run,{reward:false});H.gainXp(run,8);}
    levels[floor]=H.level(run,'hero');if(floor===1)break;
    for(const spec of P.monsterSpecs(run)){if(spec.elite||spec.lord){H.finishMonster(run,spec);continue;}acc+=share;if(acc>=1){acc-=1;H.finishMonster(run,spec);}}
  }
  return levels;
}
// The first floor reached at the surface cap of level 10.
const capFloor=levels=>{for(let floor=99;floor>=1;floor--)if(levels[floor]===10)return floor;return 0;};
test('pacing: clearing 85% of the tower reaches level 10 around floor 10; full clears a little sooner, 60% only near the end; the early chapters keep their pace',()=>{
  for(const seed of [777,1031,4242,90210,31337]){
    const all=surfaceLevels(1,seed),most=surfaceLevels(.85,seed),some=surfaceLevels(.6,seed);
    const at=capFloor(most);assert.ok(at>=8&&at<=13,seed+': 85% clear reaches the surface cap around floor 10, not '+at);
    assert.ok(capFloor(all)>at&&capFloor(all)<=17,seed+': a full clear gets there a few floors sooner');assert.ok(capFloor(some)<at&&capFloor(some)<=5,seed+': 60% clear only near the end');
    for(const levels of [most,some]){assert.ok(levels[90]>=2&&levels[85]<=3,seed+' early');assert.ok(levels[80]>=3,seed+': three companions for the floor 80 queen');}
  }
});
test('pacing: the underground from level 10 reaches level 15 by its last floor at 85% clear',()=>{
  const run=at(-1,777,10);let acc=0,top=null;
  for(let floor=-1;floor>=-50;floor--){
    if(floor<-1){run.floor=floor;run.floorsCleared=98-floor;run.defeatedMonsters=[];P.advance(run,{reward:false});H.gainXp(run,360);}
    if(top===null&&H.level(run,'hero')===15)top=floor;
    for(const spec of P.monsterSpecs(run)){if(spec.elite||spec.lord){H.finishMonster(run,spec);continue;}acc+=.85;if(acc>=1){acc-=1;H.finishMonster(run,spec);}}
  }
  assert.ok(top!==null&&top>=-50,'level 15 at '+top);
});

test('the mini lord can be taunted, is marked larger with a crown and a halo, and announces itself once',()=>{
  const run=at(85),m=P.monsterSpecs(run).find(s=>s.elite);
  assert.deepEqual(H.applyTaunt(run,'hero',{monsters:[{id:m.id,alive:true,x:0,z:1}],origin:{x:0,z:0},clear:()=>true,seconds:3}),[m.id]);
  const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),start=tower.indexOf('  let crownParts=null;'),end=tower.indexOf('  function strengthTag(',start);
  const c=vm.createContext({THREE:T});vm.runInContext(tower.slice(start,end),c);const model=new T.Group();c.markMiniLord(model);
  assert.equal(model.scale.x,1.35);assert.ok(model.getObjectByName('mini-lord-crown'));assert.ok(model.getObjectByName('mini-lord-halo'));assert.equal(model.userData.miniLord,true);
  const other=c.markMiniLord(new T.Group());assert.equal(other.getObjectByName('mini-lord-halo').geometry,model.getObjectByName('mini-lord-halo').geometry,'crown parts are shared');
  model.traverse(o=>{if(o.isMesh){assert.equal(o.geometry.userData.sharedResource,true);assert.equal(o.material.userData.sharedResource,true);}});
  assert.match(tower,/if\(spec\?\.elite\)markMiniLord\(model\);/);assert.match(tower,/if\(detected&&m\.elite&&!m\.announced\)\{m\.announced=true;showToast\(m\.def\.name\+' 出現了！/);
});

test('a defeated mini lord always leaves one healing draught; forged bonus drops are rejected',()=>{
  const L=require('../story/tower-loot.js');
  for(const floor of [95,85,45,5,-15,-35]){const run=at(floor),m=P.monsterSpecs(run).find(s=>s.elite),drops=H.finishMonster(run,m,{x:1,y:1}),bonus=drops.find(d=>d.id.endsWith(':bonus'));
    assert.ok(bonus,floor+' guaranteed');assert.deepEqual([bonus.type,bonus.key,bonus.quantity,bonus.source],['item','heal',1,m.id]);
    const saved=C.validateSave(JSON.stringify(run));assert.ok(saved,floor+' saves');const heal=saved.bag.heal,claimed=L.claim(saved,bonus.id);assert.equal(claimed.ok,true);assert.equal(claimed.run.bag.heal,heal+1);}
  // Ordinary monsters and chapter lords never leave a bonus draught.
  const ordinary=at(85),o=P.monsterSpecs(ordinary).find(s=>!s.elite&&!s.lord);assert.equal(H.finishMonster(ordinary,o,{x:1,y:1}).some(d=>d.id.endsWith(':bonus')),false);
  const lordRun=at(80,9,3),lord=P.monsterSpecs(lordRun).find(s=>s.lord);assert.equal(H.finishMonster(lordRun,lord,{x:1,y:1}).some(d=>d.id.endsWith(':bonus')),false);
  // Only the exact mini lord draught validates.
  const run=at(85),m=P.monsterSpecs(run).find(s=>s.elite);H.finishMonster(run,m,{x:1,y:1});
  const forge=change=>{const copy=structuredClone(run);change(copy.party.loot.entries.find(e=>e.id.endsWith(':bonus')),copy);return C.validateSave(JSON.stringify(copy));};
  assert.ok(forge(()=>{}));
  for(const change of [e=>e.key='feather',e=>e.quantity=2,e=>e.rarity='legendary',e=>{e.source='monster-0';e.id='85:monster-0:bonus';},(e,r)=>{r.floor=80;r.floorsCleared=19;e.id='80:monster-11:bonus';}])assert.equal(forge(change),null,String(change));
});
