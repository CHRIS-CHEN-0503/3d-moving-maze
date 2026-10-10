import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../story/tower-materials.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),L=require('../story/tower-loot.js'),R=require('../story/tower-reinforcements.js');
function fresh(floor=99,seed=31){let r=H.enable(P.enable(C.newRun({seed}),'swordsman','male').run).run;
  if(floor<0){r.floor=1;r.floorsCleared=99;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.ending='release';r.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);P.advance(r,{reward:false});const entered=C.startUnderworld(r);assert.ok(entered.ok,entered.message);r=entered.run;}
  r.floor=floor;r.floorsCleared=floor<0?99-floor-1:99-floor;r.chronicle=N.newChronicle(floor);if(floor<0)r.chronicle.ending=r.underworld.surfaceEnding;r.expedition=D.newExpedition();r.defeatedMonsters=[];P.advance(r,{reward:false});return r;
}
const floors=M.ECOLOGIES.map(e=>e.high),cells=[{x:2,y:2},{x:3,y:3},{x:4,y:4}];
test('all 149 floors map to exactly one regional food web, with distinct signatures',()=>{
  assert.equal(M.ECOLOGIES.length,15);assert.equal(Object.keys(M.INGREDIENTS).length,58);assert.equal(Object.keys(M.MATERIALS).length,6);
  const seen=new Set();for(const e of M.ECOLOGIES){assert.equal(M.ecology(e.high),e);assert.equal(M.ecology(e.low),e);const signature=M.signature(e.high);assert.ok(M.INGREDIENTS[signature]);assert.ok(!seen.has(signature));seen.add(signature);for(let floor=e.high;floor>=e.low;floor--){assert.equal(M.ECOLOGIES.filter(x=>floor<=x.high&&floor>=x.low).length,1);assert.equal(C.floorConfig(floor).name,e.name);}assert.ok(Object.isFrozen(e.variants));}
  for(const floor of [0,100,-51,NaN,undefined])assert.throws(()=>M.ecology(floor),RangeError);
});
test('each catalog source is an actual local species and every new ingredient is obtainable',()=>{
  const observed={ingredient:new Set(),material:new Set()};for(const e of M.ECOLOGIES)for(const [kind,variant]of Object.entries(e.variants)){
    assert.ok(P.defs()[kind]);const drops=M.dropPool(e.high,{kind,def:P.defs()[kind]});assert.equal(new Set(drops.map(d=>d.type+':'+d.key)).size,drops.length);
    for(const d of drops){observed[d.type].add(d.key);const meta=(d.type==='ingredient'?M.INGREDIENT_META:M.MATERIAL_META)[d.key];assert.ok(meta.sources.some(s=>s.includes(e.name)&&s.includes(variant.name)));assert.ok(L.CHANCES[d.rarity]);assert.ok(d.quantity>=1&&d.quantity<=2);if(d.key==='meat'||d.key==='shell')assert.equal(kind,'crab');if(['starore','abyssalloy'].includes(d.key))assert.ok(e.underground);}
  }
  assert.deepEqual([...observed.ingredient].sort(),Object.keys(M.INGREDIENTS).filter(k=>!require('../story/tower-recipe-lab.js').EXOTIC.includes(k)).sort(),'every ingredient except the hunter-only exotics drops from a creature');assert.deepEqual([...observed.material].sort(),Object.keys(M.MATERIALS).sort());
  assert.ok(M.INGREDIENT_META.meat.sources.every(s=>s.includes('蟹')));assert.ok(!M.INGREDIENT_META.meat.sources.some(s=>s.includes('雲頂')||s.includes('熔火爐心')));
});
test('regional decorations are immutable copies and preserve canonical sensing and combat stats',()=>{
  const before=JSON.stringify(P.defs());for(const e of M.ECOLOGIES)for(const kind of M.monsterTypes(e.high)){
    const base=P.defs()[kind],d=M.decorate(e.high,base,kind);assert.notEqual(d,base);assert.equal(d.id,base.id);for(const key of ['speed','damage','strength','shape','ranged','sight'])assert.equal(d[key],base[key]);assert.equal(d.name,e.variants[kind].name);assert.equal(d.color,e.variants[kind].color);assert.equal(Object.keys(d.drop).length,e.variants[kind].ingredients.length);
  }assert.equal(JSON.stringify(P.defs()),before);
});
test('opening enemies and shift reinforcements use the same current ecology, with original counts and caps',()=>{
  for(const floor of floors){let r=fresh(floor),pool=M.monsterTypes(r),specs=P.monsterSpecs(r);assert.equal(specs.filter(s=>!s.lord&&!s.elite&&!s.reinforcement).length,C.floorConfig(floor,r.seed).monsterCount);for(const s of specs.filter(s=>!s.lord&&!s.elite)){assert.ok(pool.includes(s.kind));assert.equal(s.def.name,M.ecology(r).variants[s.kind].name);assert.equal(s.strength,Math.min(5,P.defs()[s.kind].strength+C.floorConfig(floor).monsterStrengthBonus));}
    // A mini lord is one of the same region's creatures, one strength step above its ordinary kin.
    for(const s of specs.filter(s=>s.elite)){assert.ok(pool.includes(s.kind),floor+' '+s.kind);assert.match(s.def.name,/^小樓主・/);assert.equal(s.strength,Math.min(5,P.defs()[s.kind].strength+C.floorConfig(floor).monsterStrengthBonus+1));}
    assert.deepEqual(P.monsterSpecs(r),P.monsterSpecs(structuredClone(r)));for(let i=0;i<15;i++){const add=R.spawn(r,cells);assert.ok(add.ok,add.message);r=add.run;for(const m of add.effect.reinforcements)assert.ok(pool.includes(m.kind));assert.ok(P.monsterSpecs(r).filter(s=>!r.defeatedMonsters.includes(s.id)).length<=R.limit(C.floorConfig(floor).size));}assert.ok(C.validateSave(r));
  }
});
test('regional signature ingredients stop appearing after changing ecology; equivalent old species remain compatible',()=>{
  for(const origin of M.ECOLOGIES){const key=M.signature(origin.high);for(const region of M.ECOLOGIES){const drops=M.monsterTypes(region.high).flatMap(kind=>M.dropPool(region.high,{kind}));assert.equal(drops.some(d=>d.key===key),region===origin);}}
  const r=fresh(99);r.party.reinforcements={version:1,shift:1,monsters:[{id:'monster-r-1-0',kind:'crab',cx:2,cy:2}]};assert.ok(C.validateSave(r));assert.equal(R.specs(r)[0].kind,'crab');assert.deepEqual(M.dropPool(r,R.specs(r)[0]).map(d=>d.key),['meat','shell']);assert.deepEqual(M.dropPool(r,{kind:'not-real'}),[]);assert.deepEqual(M.dropPool(r,{lord:true,kind:'crab'}),[]);
});
test('weighted pool preserves rarity odds, does not create universal shell, and returns unshared candidates',()=>{
  assert.deepEqual(L.CHANCES,{common:20,uncommon:12,rare:6,legendary:3});for(const floor of floors){const r=fresh(floor);for(const kind of M.monsterTypes(r)){
    const pool=L.pool(r,{kind,def:P.defs()[kind]}),regional=pool.filter(p=>p.type==='ingredient'||p.type==='material'),supplies=pool.filter(p=>p.type==='item'||p.type==='fuel');assert.ok(regional.length>=supplies.length);if(kind!=='crab')assert.ok(!regional.some(d=>d.key==='meat'||d.key==='shell'));assert.ok(pool.every(d=>L.CHANCES[d.rarity]));
  }}const pool=M.dropPool(99,{kind:'mushroom'});pool[0].quantity=99;assert.equal(M.dropPool(99,{kind:'mushroom'})[0].quantity,2);
});
test('material and regional food drops are deterministic, one roll per killed enemy and never rerolled on shift',()=>{
  const found=new Set();for(let seed=1;seed<=1800&&found.size<2;seed++){const r=fresh(99,seed),s=P.monsterSpecs(r)[0];r.defeatedMonsters.push(s.id);const out=L.recordKill(r,s,{x:2,y:3});assert.deepEqual(L.recordKill(r,s),[]);const clone=fresh(99,seed);clone.defeatedMonsters.push(s.id);assert.deepEqual(L.recordKill(clone,P.monsterSpecs(clone)[0],{x:2,y:3}),out);for(const e of out)if(['ingredient','material'].includes(e.type)){found.add(e.type);const saved=C.validateSave(r);assert.ok(saved);const shifted=R.spawn(saved,cells);assert.ok(shifted.ok);assert.deepEqual(shifted.run.party.loot.entries,out);}}
  assert.deepEqual([...found].sort(),['ingredient','material']);
});
function ground(run,type,key,quantity=2){run.defeatedMonsters.push('monster-0');run.party.loot={version:1,rolled:['monster-0'],entries:[{id:run.floor+':monster-0:item',source:'monster-0',type,key,quantity,rarity:'common',cx:1,cy:2}]};return run.party.loot.entries[0].id;}
test('new material claim is atomic, capacity safe, saved exactly once and source receipts survive',()=>{
  let r=fresh(99);const id=ground(r,'material','ironore');assert.ok(C.validateSave(r));r.party.journey.materials.ironore=98;const before=JSON.stringify(r);assert.equal(L.claim(r,id).ok,false);assert.equal(JSON.stringify(r),before);assert.equal(r.party.loot.entries.length,1);r.party.journey.materials.ironore=97;const got=L.claim(r,id);assert.ok(got.ok,got.message);assert.equal(got.run.party.journey.materials.ironore,99);assert.match(got.message,/精鐵礦/);assert.equal(got.run.party.loot.entries.length,0);assert.equal(L.claim(got.run,id).ok,false);assert.deepEqual(got.run.party.loot.rolled,['monster-0']);assert.ok(C.validateSave(got.run));
});
test('new food claims reach ingredient stock, never forging or ordinary item bags',()=>{
  const r=fresh(99),id=ground(r,'ingredient','cloudcap');const got=L.claim(r,id);assert.ok(got.ok,got.message);assert.equal(got.run.party.ingredients.cloudcap,2);assert.equal(got.run.bag.cloudcap,undefined);assert.equal(got.run.party.journey.materials.cloudcap,undefined);assert.ok(C.validateSave(got.run));
});
test('unknown/future material ground records are rejected while original food drops stay compatible',()=>{
  for(const [floor,type,key,valid]of [[99,'material','ironore',true],[99,'ingredient','meat',true],[99,'material','unknown',false],[99,'material','starore',false],[-1,'material','starore',true],[-1,'material','abyssalloy',true],[99,'ingredient','fake',false]]){
    const r=fresh(floor);ground(r,type,key);assert.equal(!!C.validateSave(r),valid,`${floor}/${type}/${key}`);
  }
});
