import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),N=require('../story/tower-narrative.js'),R=require('../story/tower-reinforcements.js'),B=require('../story/tower-floor-lords.js');

const floors=[...Array.from({length:99},(_,i)=>99-i),...Array.from({length:50},(_,i)=>-i-1)];
const originalHp=(floor,strength)=>{
  const hp=18+strength*8+Math.floor((99-Math.max(1,floor))/8);
  return floor>0?hp:Math.round(hp*(2+Math.floor((-floor-1)/10)*.3));
};
function fresh(floor=99){
  let r=H.enable(P.enable(C.newRun({seed:97,name:'生命平衡'}),'scout').run).run;
  if(floor<0){
    r.floor=1;r.floorsCleared=99;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);r.chronicle.ending='release';P.advance(r,{reward:false});
    const result=C.startUnderworld(r);assert.ok(result.ok,result.message);r=result.run;
  }
  r.floor=floor;r.floorsCleared=floor>0?99-floor:99+(-floor-1);if(floor>0)r.chronicle=N.newChronicle(floor);P.advance(r,{reward:false});
  assert.ok(C.validateSave(r),'fixture '+floor);return r;
}

test('ordinary monster HP is exactly +15% rounded from prior HP across 149 floors and strengths 1–5',()=>{
  const defs=P.defs();
  for(const floor of floors)for(let strength=1;strength<=5;strength++)for(const def of Object.values(defs).filter(d=>!d.id?.startsWith('lord-'))){
    const frozen=JSON.stringify(def),power=P.monsterPower(floor,def,strength);
    assert.equal(power.maxHp,Math.round(originalHp(floor,strength)*1.15));
    assert.equal(power.def.damage,floor>0?def.damage:Math.round(def.damage*(1.25+Math.floor((-floor-1)/10)*.1)));
    for(const k of ['speed','sight','strength','ranged'])assert.equal(power.def[k],def[k]);
    assert.equal(JSON.stringify(def),frozen,'shared species must not mutate');
  }
});
test('ten surface and five underground lords get only +30%, not compounded with ordinary +15%',()=>{
  for(const floor of [...Object.keys(B.LORDS),...Object.keys(B.UNDERWORLD_LORDS)].map(Number)){
    const spec=B.spec(fresh(floor)),before=floor>0?Math.min(240,85+Math.round((99-floor)*1.5)):450+Math.abs(floor)*15;
    assert.equal(spec.maxHp,Math.round(before*1.3));
    assert.notEqual(spec.maxHp,Math.round(before*1.15*1.3));
    assert.equal(P.monsterSpecs(fresh(floor)).find(m=>m.lord).maxHp,spec.maxHp);
  }
  assert.equal(B.spec(fresh(1)).maxHp,302);
  assert.equal(B.spec(fresh(-50)).maxHp,1560);
});
test('generated monsters and shift reinforcements share the new maximum and save validly',()=>{
  for(const floor of floors){
    let r=fresh(floor);const spawned=R.spawn(r,[{x:2,y:2},{x:3,y:3},{x:4,y:4}]);assert.ok(spawned.ok,spawned.message);r=spawned.run;
    const specs=P.monsterSpecs(r);assert.ok(specs.some(m=>m.reinforcement));
    for(const m of specs){
      // Ordinary monsters and reinforcements keep the shared maximum; a mini lord is that maximum x MINI_HP.
      if(!m.lord&&!m.elite)assert.equal(m.maxHp,Math.round(originalHp(floor,m.strength)*1.15));
      if(m.elite)assert.equal(m.maxHp,Math.round(P.monsterPower(floor,P.defs()[m.kind],m.strength).maxHp*1.8),'mini lord at '+floor);
      r.party.health[m.id]=m.maxHp;
    }
    const restored=C.validateSave(JSON.stringify(r));assert.ok(restored,'new max HP must not be rejected at '+floor);
    assert.deepEqual(restored.party.health,r.party.health);
  }
});
test('loading and shifting retain old wounds and dead IDs without healing or resurrecting',()=>{
  for(const floor of [99,90,1,-1,-10,-50]){
    const r=fresh(floor),[wounded,dead]=P.monsterSpecs(r);r.party.health[wounded.id]=7;r.defeatedMonsters.push(dead.id);
    const lord=B.spec(r);if(lord&&lord.id!==dead.id)r.party.health[lord.id]=11;
    const health=structuredClone(r.party.health),restored=C.validateSave(JSON.stringify(r));assert.ok(restored);
    assert.deepEqual(restored.party.health,health);
    assert.ok(restored.defeatedMonsters.includes(dead.id));
    const shifted=R.spawn(restored,[{x:2,y:2},{x:3,y:3},{x:4,y:4}]);assert.ok(shifted.ok);
    assert.deepEqual(shifted.run.party.health,health);assert.ok(shifted.run.defeatedMonsters.includes(dead.id));
    const again=C.validateSave(JSON.stringify(shifted.run));assert.deepEqual(again.party.health,health);
    assert.ok(!P.monsterSpecs(again).filter(m=>!again.defeatedMonsters.includes(m.id)).some(m=>m.id===dead.id));
  }
});
test('updated saved-health limits still reject impossible HP values and preserve zero',()=>{
  for(const [floor,cap]of [[99,312],[-1,258],[-50,258]]){
    const r=fresh(floor),ordinary=P.monsterSpecs(r).find(m=>!m.lord);
    r.party.health[ordinary.id]=cap+1;assert.equal(C.validateSave(r),null);
    r.party.health[ordinary.id]=0;assert.equal(C.validateSave(r).party.health[ordinary.id],0);
  }
  const r=fresh(-50);r.party.health[B.UNDERWORLD_ID]=1561;assert.equal(C.validateSave(r),null);
});
