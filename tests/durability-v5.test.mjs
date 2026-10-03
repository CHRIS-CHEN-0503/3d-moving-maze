import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {provisionTravellers} from './recruit-fixtures.mjs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js'),N=require('../story/tower-narrative.js'),E=require('../story/tower-encounters.js');
const ordinaryKinds=Object.entries(C.GEAR).filter(([,def])=>!def.integrated&&!def.core).map(([kind])=>kind);
function fresh(floor=99,seed=43){const r=C.newRun({seed});r.floor=floor;r.floorsCleared=99-floor;r.chronicle=N.newChronicle(floor);return H.enable(P.enable(r,'smith').run).run;}
function currentRoll(g){return Array.from({length:21},(_,i)=>i).find(n=>n>=(g.bonus?10:C.durabilityMinimumRoll(g.kind))&&C.durabilityForRoll(g.kind,n)===g.maxDurability);}
function v4(g,left){const maximum=Math.round(currentRoll(g)*C.originalDurabilityMultiplier(g.kind)/2);return {...g,durabilityVersion:4,maxDurability:maximum,durability:left??Math.round(g.durability*maximum/g.maxDurability)};}
function groundGear(run){const g=C.createGear('heavy_armor',run.floor,run.seed,'lord-drop',true),source='monster-11';run.defeatedMonsters.push(source);run.party.loot={version:1,rolled:[source],entries:[{id:run.floor+':'+source+':gear',source,type:'gear',key:g.kind,rarity:'rare',quantity:1,cx:0,cy:0,gear:g}]};return g;}
function allIncludingGround(run){return [...H.allGear(run),...(run.party.loot?.entries||[]).filter(e=>e.type==='gear').map(e=>e.gear)];}
test('all 96 weapon/armor kinds retain historical v4 provenance, rounded light rolls and current category increases',()=>{
  assert.equal(ordinaryKinds.length,96);const lightRolls=new Set();for(const kind of ordinaryKinds)for(const floor of [99,49,1,-1,-21])for(const enhanced of [false,true])for(let seed=1;seed<=32;seed++){
    const g=C.createGear(kind,floor,seed,'v5-source',enhanced),before=v4(g),ratio=C.durabilityMultiplier(kind)/C.originalDurabilityMultiplier(kind);assert.equal(g.durabilityVersion,6);assert.ok(C.validateGear(before),kind);assert.equal(g.maxDurability,Math.round(before.maxDurability*2*ratio));assert.equal(g.durability,g.maxDurability);assert.deepEqual(C.validateGear(g),g);assert.equal(C.gearPrice(g),C.gearPrice(before));if(kind==='robe'&&!enhanced)lightRolls.add(g.maxDurability);
  }
  assert.deepEqual([...lightRolls].sort((a,b)=>a-b),[40,54,66,80,94,106,120,134]);
});
test('worn, broken, forged and partly repaired v4 gear migrate proportionally once while stats remain unchanged',()=>{
  assert.equal(ordinaryKinds.length,96);for(const kind of ordinaryKinds)for(const enhanced of [false,true]){
    const now=C.createGear(kind,1,43,'v5-migrate',enhanced),source=v4(now);
    for(const left of [0,1,Math.floor(source.maxDurability*.1),Math.floor(source.maxDurability*.2),Math.floor(source.maxDurability*.55),source.maxDurability]){
      const old={...source,durability:left},before=JSON.stringify(old),g=C.validateGear(old);assert.ok(g,kind);assert.equal(JSON.stringify(old),before);assert.equal(g.maxDurability,now.maxDurability);assert.equal(g.durability,left===0?0:Math.max(1,Math.round(left*g.maxDurability/old.maxDurability)));assert.equal(g.defense,old.defense);assert.equal(g.bonus,old.bonus);assert.ok(Math.abs(g.durability/g.maxDurability-old.durability/old.maxDurability)<=.5/g.maxDurability+1e-12);let reloaded=g;for(let i=0;i<5;i++)reloaded=C.validateGear(JSON.parse(JSON.stringify(reloaded)));assert.deepEqual(reloaded,g);
    }
  }
  const r=fresh();r.coins=999;r.party.journey.scrap=99;r.party.journey.materials.ironore=3;const forged=X.forge(r,r.equipment.weapon.id,'durable');assert.ok(forged.ok);const g=forged.run.equipment.weapon;g.forge.reserve=1;g.durability=0;const migrated=C.validateGear(v4(g));assert.equal(migrated.durability,0);assert.deepEqual(migrated.forge,g.forge,'independent protection charges are not reset or doubled');
});
test('active, switched-away, bag and still-ground equipment all upgrade on loading without duplicate items or repeat growth',()=>{
  let r=fresh(90);for(let floor=90;floor>75&&!P.recruitOffer(r);floor--){r=fresh(floor);}const offer=P.recruitOffer(r);assert.ok(offer);const joined=P.recruit(provisionTravellers(r),offer.id);assert.ok(joined.ok,joined.message);r=joined.run;assert.equal(r.party.members.length,1);r.gearBag.push(C.createGear('robe',r.floor,r.seed,'v5-bag'));groundGear(r);const ids=allIncludingGround(r).map(g=>g.id).sort(),expected=new Map();
  allIncludingGround(r).forEach((g,i)=>{Object.assign(g,v4(g));g.durability=i%3===0?0:Math.max(1,Math.floor(g.maxDurability*.4));const migrated=C.validateGear(g);expected.set(g.id,{durability:migrated.durability,maxDurability:migrated.maxDurability});});
  const raw=JSON.stringify(r);for(let i=0;i<5;i++){r=C.validateSave(i?JSON.stringify(r):raw);assert.ok(r);assert.deepEqual(allIncludingGround(r).map(g=>g.id).sort(),ids);for(const g of allIncludingGround(r)){assert.equal(g.durabilityVersion,6);assert.deepEqual({durability:g.durability,maxDurability:g.maxDurability},expected.get(g.id));}}
});
test('initial loadouts, merchant offers and rewards share doubled rolls while purchase and full repair base price units are unchanged',()=>{
  for(const job of Object.keys(H.JOBS)){const r=H.enable(P.enable(C.newRun({seed:43}),job).run).run;for(const g of H.allGear(r))assert.equal(g.durabilityVersion,6);}
  for(const floor of [99,69,39,-1,-21])for(const m of E.merchantOffers(floor,43,true))for(const row of m.gear){assert.equal(row.gear.durabilityVersion,6);assert.deepEqual(C.validateGear(v4(row.gear)),row.gear);assert.ok(C.validateGear(row.gear));}
  const r=fresh();r.coins=999;r.party.journey.scrap=99;r.equipment.weapon.durability=0;const q=X.repairQuote(r,r.equipment.weapon.id);assert.equal(q.normalCoins,Math.ceil(Math.ceil(r.equipment.weapon.maxDurability/(4*C.durabilityMultiplier(r.equipment.weapon.kind)))*6*(1-H.teamPassive(r,'economy')/100)));assert.equal(q.coins,Math.ceil(q.normalCoins*1.5));const repaired=X.repair(r,r.equipment.weapon.id,r.revision);assert.ok(repaired.ok);assert.equal(repaired.run.equipment.weapon.durability,r.equipment.weapon.maxDurability);assert.ok(C.validateSave(repaired.run));
});
test('v5 source lattice rejects forged maxima or unknown versions while legacy and all historical versions preserve zero and ratios',()=>{
  for(const kind of ['longsword','robe','buckler','heavy_armor_t5'])for(const bonus of [false,true]){
    const g=C.createGear(kind,-21,35,'v5-bounds',bonus),roll=currentRoll(g),sourceMult=C.originalDurabilityMultiplier(kind)/2;
    for(const version of [undefined,2,3,4]){const mult=version===undefined?1:version===2?sourceMult*.3:version===3?sourceMult*1.5:sourceMult,old={...g,maxDurability:Math.round(roll*mult),durability:0};if(version===undefined)delete old.durabilityVersion;else old.durabilityVersion=version;assert.equal(C.validateGear(old).durability,0);old.durability=Math.floor(old.maxDurability*.37);const migrated=C.validateGear(old);assert.ok(migrated);assert.equal(migrated.durability,Math.round(old.durability*g.maxDurability/old.maxDurability));assert.equal(migrated.maxDurability,g.maxDurability);assert.equal(C.validateGear({...old,maxDurability:version===undefined?(bonus?21:11):old.maxDurability+1}),null);}
    for(const change of [{durability:-1},{durability:g.maxDurability+1},{maxDurability:g.maxDurability+1},{durabilityVersion:7},{durabilityVersion:'5'}])assert.equal(C.validateGear({...g,...change}),null);
  }
});
test('the original v4 save backs up once before overwrite, including ground-only old gear; backup failure retains the exact original',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),save=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal')),SAVE='maze3d_tower_v1',backup=SAVE+'_before_durability5';
  for(const groundOnly of [false,true]){
    const old=fresh(90);if(groundOnly){Object.assign(groundGear(old),v4(old.party.loot.entries[0].gear));}else for(const g of H.allGear(old))Object.assign(g,v4(g));const raw=JSON.stringify(old),run=C.validateSave(raw),stored=new Map([[SAVE,raw]]);assert.ok(run);let fail=true;
    const e=vm.createContext({C,run,SAVE,saveFailed:false,syncEngine(){},showToast(){},localStorage:{getItem:k=>stored.get(k)||null,setItem(k,v){if(fail&&k===backup)throw Error('quota');stored.set(k,v);}}});vm.runInContext(save,e);assert.equal(e.save(),false);assert.equal(stored.get(SAVE),raw);assert.equal(stored.has(backup),false);
    fail=false;assert.equal(e.save(),true);assert.equal(stored.get(backup),raw);assert.equal(stored.has(SAVE+'_before_durability4'),false,'current v5 does not create an unrelated historical backup');const first=stored.get(SAVE);assert.ok(C.validateSave(first));assert.equal(e.save(),true);assert.equal(stored.get(SAVE),first);assert.equal(stored.get(backup),raw);
  }
});
