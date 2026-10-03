import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),X=require('../story/tower-expedition-core.js'),E=require('../story/tower-encounters.js');
function fixture(){let r=H.enable(P.enable(C.newRun({seed:1}),'swordsman').run).run;r.coins=999;r.party.journey.scrap=99;const shop=E.merchantOffers(r.floor,r.seed,true)[0];for(const [i,kind]of ['heavy_helm','light_armor','arcane_staff','longsword','twin_daggers','buckler'].entries()){r=C.grantGear(r,C.createGear(kind,99,1,'repair-all-'+i)).run;}
  for(const [i,g]of X.allGear(r).entries())g.durability=i%2?0:1;
  assert.ok(C.validateSave(r));return {r,service:E.serviceContext(r,shop.id)};
}
test('repair all charges the sum of individual specialist quotes and never repairs other merchants gear',()=>{
  const {r,service}=fixture(),before=structuredClone(r),q=X.repairAllQuote(r,service);assert.ok(q.allowed&&q.affordable);assert.ok(q.entries.length>1);
  assert.equal(q.coins,q.entries.reduce((sum,e)=>sum+X.repairQuote(r,e.id,service).coins,0));assert.equal(q.parts,q.entries.reduce((sum,e)=>sum+X.repairQuote(r,e.id,service).parts,0));
  const result=X.repairAll(r,r.revision,service);assert.ok(result.ok,result.message);const next=result.run;assert.ok(C.validateSave(next));assert.equal(next.coins,r.coins-q.coins);assert.equal(next.party.journey.scrap,r.party.journey.scrap-q.parts);
  for(const g of X.allGear(next)){const old=X.allGear(before).find(a=>a.id===g.id);assert.equal(g.durability,E.merchantHandles(service.merchantId,g)?g.maxDurability:old.durability);}
  assert.deepEqual(r,before);assert.equal(X.repairAllQuote(next,service).allowed,false);assert.deepEqual(next.party.journey.maintenance,[]);
});
test('short funds, short materials, stale revision and expired merchant context cannot partially repair or charge',()=>{
  for(const fault of ['money','parts','revision','floor','seed','vendor']){const {r,service}=fixture();if(fault==='money')r.coins=0;if(fault==='parts')r.party.journey.scrap=0;if(fault==='floor')service.floor=98;if(fault==='seed')service.seed++;if(fault==='vendor')service.merchantId='missing';const before=structuredClone(r),result=X.repairAll(r,fault==='revision'?r.revision+1:r.revision,service);assert.equal(result.ok,false,fault);assert.deepEqual(r,before,fault);}
});
test('batch repair includes another equipped actor once and keeps forge reserve unchanged',()=>{
  const {r,service}=fixture();const m={id:'repair-swordsman',profession:'swordsman',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);
  const gear=H.equipment(r,m.id).weapon;gear.durability=0;gear.forge={trait:'durable',level:1,reserve:0};assert.ok(C.validateSave(r));assert.equal(E.merchantHandles(service.merchantId,gear),true);
  const q=X.repairAllQuote(r,service);assert.equal(q.entries.filter(e=>e.id===gear.id).length,1);const result=X.repairAll(r,r.revision,service);assert.ok(result.ok,result.message);assert.equal(H.equipment(result.run,m.id).weapon.durability,gear.maxDurability);assert.equal(H.equipment(result.run,m.id).weapon.forge.reserve,0);
});
