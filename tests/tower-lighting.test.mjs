import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),L=require('../story/tower-lighting-core.js'),E=require('../story/tower-encounters.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js');
const fresh=(job='scout')=>P.enable(C.newRun({seed:31415}),job).run;
const advanceTime=(run,seconds)=>{while(seconds>0){const dt=Math.min(seconds,60),result=C.tickEffects(run,dt);assert.ok(result.ok,result.message);run=result.run;seconds-=dt;}return run;};
test('old party saves receive a one-time lighting kit without changing gameplay state',()=>{
  const original=fresh();delete original.party.light;const copy=structuredClone(original),loaded=C.validateSave(original);
  assert.deepEqual(original,copy);assert.deepEqual(loaded.party.light,L.newState());delete loaded.party.light;assert.deepEqual(loaded,original);
  assert.equal(C.validateSave(C.newRun()).party,undefined);
  let r=L.torch(fresh()).run;r=advanceTime(r,120);assert.equal(r.party.light.fuel,180);
  assert.deepEqual(C.validateSave(JSON.stringify(r)),r);assert.equal(C.validateSave(r).party.light.torches,1);
});
test('lighting schema rejects corrupt fuel, stock, claims, timers and prototype keys',()=>{
  for(const mutate of [l=>l.fuel=301,l=>l.daylight=601,l=>l.cooldown=601,l=>{l.daylight=5;l.cooldown=4;},l=>l.lit=true,l=>l.wood=-1,l=>l.cloth=.5,l=>l.torches=100,l=>l.gathered=['light-supply-0','light-supply-0'],l=>l.gathered=['light-supply-2'],l=>l.bought.tieLing=4,l=>l.bought=JSON.parse('{"__proto__":3}'),l=>l.fuel=NaN]){const r=fresh();mutate(r.party.light);assert.equal(C.validateSave(r),null);}
  const r=fresh();r.party.light=null;assert.equal(C.validateSave(r),null);
});
test('simple torch recipe charges exactly one wood and cloth and respects revision and caps',()=>{
  const r=fresh(),before=structuredClone(r),result=L.craft(r,r.revision);assert.ok(result.ok);assert.deepEqual(r,before);
  assert.equal(result.run.party.light.torches,3);assert.equal(result.run.party.light.wood,1);assert.equal(result.run.party.light.cloth,1);
  assert.equal(L.craft(result.run,r.revision).ok,false);result.run.party.light.wood=0;assert.equal(L.craft(result.run).ok,false);
  r.party.light.torches=99;assert.equal(L.craft(r).ok,false);
});
test('torch lasts exactly five minutes, extinguish retains fuel, empty torch never auto-spends a new one',()=>{
  let r=L.torch(fresh()).run;assert.equal(r.party.light.fuel,300);assert.equal(r.party.light.torches,1);
  r=advanceTime(r,20);r=L.torch(r).run;r=advanceTime(r,60);assert.equal(r.party.light.fuel,280);assert.equal(r.party.light.lit,false);
  r=L.torch(r).run;assert.equal(r.party.light.torches,1);r=advanceTime(r,279.75);assert.equal(r.party.light.fuel,.25);assert.equal(L.portable(r),'torch');
  r=advanceTime(r,.25);assert.equal(r.party.light.fuel,0);assert.equal(r.party.light.lit,false);assert.equal(r.party.light.torches,1);
  r=L.torch(r).run;assert.equal(r.party.light.torches,0);r=advanceTime(r,300);assert.equal(L.torch(r).ok,false);
});
test('daylight lasts ten minutes with independent cooldown and conserves torch fuel',()=>{
  let r=L.torch(fresh('mage')).run;r=L.daylight(r).run;assert.equal(r.party.light.daylight,600);assert.equal(r.party.cooldown,0);assert.equal(L.portable(r),'daylight');
  assert.equal(L.daylight(r).ok,false);r=P.skill(r).run;assert.equal(r.party.cooldown,22);
  r=advanceTime(r,599.5);assert.equal(r.party.light.fuel,300);assert.equal(r.party.light.daylight,.5);
  r=advanceTime(r,1);assert.equal(r.party.light.fuel,299.5);assert.equal(L.portable(r),'torch');assert.ok(L.daylight(r).ok);
  r=L.torch(r).run;assert.equal(r.party.light.lit,false);r=L.daylight(r).run;assert.equal(L.torch(r).ok,false);
});
test('living mage companion can cast; absent, dismissed or downed mage cannot; existing spell remains',()=>{
  let r=fresh();assert.equal(L.daylight(r).ok,false);
  r.party.members=[{id:'companion:mage',profession:'mage',level:1,hp:34,cooldown:0,hurtLeft:0}];r.party.joined=['companion:mage'];assert.ok(L.daylight(r).ok);
  r.party.members[0].hp=0;assert.equal(L.daylight(r).ok,false);r.party.members[0].hp=34;r=L.daylight(r).run;
  r=P.dismiss(r,'companion:mage').run;assert.equal(L.canCast(r),false);assert.equal(r.party.light.daylight,600);assert.equal(advanceTime(r,600).party.light.daylight,0);
});
test('merchant torches are real finite stock, charge coins, cannot be farmed by reload',()=>{
  let r=fresh();r.coins=100;const id=E.merchantOffers(r.floor,r.seed)[0].id;
  const before=r.revision;r=L.buy(r,id,before).run;assert.equal(r.coins,96);assert.equal(r.party.light.torches,3);assert.equal(L.buy(r,id,before).ok,false);
  for(let i=0;i<2;i++)r=L.buy(C.validateSave(JSON.stringify(r)),id).run;
  assert.equal(r.coins,88);assert.equal(L.buy(r,id).ok,false);assert.equal(L.buy(r,'not-here').ok,false);
  const poor=fresh();poor.coins=0;assert.equal(L.buy(poor,id).ok,false);
});
test('material quantity scales with floor size, claims survive shifts/reloads and reset on descent only',()=>{
  assert.deepEqual([7,9,11,13,15,17,19].map(L.supplyCount),[1,1,2,2,3,3,3]);
  let r=fresh();r=L.gather(r,'light-supply-0').run;assert.equal(r.party.light.wood,3);assert.equal(r.party.light.cloth,3);
  r=C.validateSave(JSON.stringify(r));assert.equal(L.gather(r,'light-supply-0').ok,false);assert.equal(L.gather(r,'light-supply-1').ok,false);
  r=L.torch(r).run;r=advanceTime(r,30);const before=structuredClone(r.party.light);r=C.descend(r).run;assert.equal(r.floor,98);
  assert.deepEqual(r.party.light,{...before,gathered:[],bought:L.newState().bought});assert.ok(L.gather(r,'light-supply-0').ok);
});
test('portable light continues inside side dungeons, without new merchant stock or materials',()=>{
  let r=fresh('mage');for(let floor=99;floor>=1;floor--){r.floor=floor;r.floorsCleared=99-floor;r.chronicle=N.newChronicle(floor);P.advance(r);if(D.offer(r))break;}
  r=D.discover(r).run;const offer=D.offer(r);r=D.enter(r,offer.id,{x:0,y:0,shiftLeft:100}).run;assert.ok(r.expedition.active);
  r=L.daylight(r).run;r=advanceTime(r,30);assert.equal(r.party.light.daylight,570);assert.equal(L.gather(r,'light-supply-0').ok,false);assert.equal(L.buy(r,'tieLing').ok,false);
  assert.ok(C.validateSave(JSON.stringify(r)));
});
test('all ten regions require light beyond the immediate surroundings while retaining distinct palettes',()=>{
  assert.equal(Object.keys(L.PROFILES).length,10);const styles=new Set();
  for(const c of C.CHAPTERS){const p=L.profile(c.id);assert.ok(p.radius>=2.5&&p.radius<=3.5);assert.ok(p.ambient>=.02&&p.hemi>=.045&&p.sun>0);assert.ok(p.ambient+p.hemi+p.sun<.17);assert.ok(Math.max(p.sky>>16,(p.sky>>8)&255,p.sky&255)<30);styles.add(p.style);}
  assert.ok(styles.size>=5);assert.ok(L.profile('garden').radius>L.profile('echo').radius);assert.equal(L.profile('__proto__'),L.PROFILES.echo);
});
