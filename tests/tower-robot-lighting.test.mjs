import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-lighting-core.js'),R=H.ROBOT;
const fresh=()=>H.enable(P.enable(C.newRun({seed:371,name:'內建光源'}),'robot').run).run;
test('a robot-only party never drains an invisible food bar; living organic companions retain the shared food rule',()=>{
  const r=fresh();assert.equal(H.hungerScale(r),0);const m={id:'food-human',profession:'scout',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);assert.ok(H.hungerScale(r)>=.4);H.setHp(r,m.id,0);assert.equal(H.hungerScale(r),0);
});
test('usable slot count sets core reach and color with empty energy, while expired cores provide neither',()=>{
  const r=fresh();for(let tier=1;tier<=5;tier++){
    r.equipment.core1=C.createGear(R.kind('robot_core',tier),99,r.seed,'light-'+tier);r.equipment.core2=null;H.actor(r).robot.fuel=0;
    assert.deepEqual(L.robotLight(r),{tier,color:R.CORE_COLORS[tier-1],cores:1,mode:'core',radius:8});assert.equal(L.portable(r),'core');
    r.equipment.core2=C.createGear('robot_core',99,r.seed,'light-extra-'+tier);
    assert.deepEqual(L.robotLight(r),{tier,color:R.CORE_COLORS[tier-1],cores:2,mode:'core',radius:12});
    r.equipment.core1.durability=0;assert.deepEqual(L.robotLight(r),{tier:1,color:R.CORE_COLORS[0],cores:1,mode:'core',radius:8});r.equipment.core2.durability=0;assert.deepEqual(L.robotLight(r),{tier:1,color:R.CORE_COLORS[0],cores:0,mode:'core',radius:6});
  }
  r.equipment.core1=r.equipment.core2=null;assert.deepEqual(L.robotLight(r),{tier:1,color:R.CORE_COLORS[0],cores:0,mode:'core',radius:6});
});
test('torch burns while stronger than a single core; daylight expiration only burns the uncovered time',()=>{
  const r=fresh();Object.assign(r.party.light,{lit:true,fuel:230,daylight:5,cooldown:5});L.tick(r,10);assert.equal(r.party.light.fuel,225);assert.equal(r.party.light.daylight,0);assert.equal(r.party.light.cooldown,0);assert.equal(r.party.light.lit,true);
  r.equipment.core2=C.createGear('robot_core',99,r.seed,'conserve');L.tick(r,10);assert.equal(r.party.light.fuel,225);H.setHp(r,'hero',0);L.tick(r,10);assert.equal(r.party.light.fuel,215);
});
test('robotLight remains actor-local while party selection and torch consumption are independent of the leader',()=>{
  const r=fresh(),m={id:'light-human',profession:'scout',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};H.setHp(r,'hero',0);assert.equal(L.robotLight(r),null);H.setHp(r,'hero',H.maxHp(r));r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);Object.assign(r.party.light,{lit:true,fuel:230});const switched=H.switchActor(r,m.id).run;assert.ok(switched);assert.equal(L.robotLight(switched),null);assert.equal(L.robotLight(switched,'hero').color,R.CORE_COLORS[0]);L.tick(switched,10);assert.equal(switched.party.light.fuel,220);
  const info=L.portableInfo(switched);H.state(switched).switchLeft=0;const back=H.switchActor(switched,'hero').run;assert.deepEqual(L.portableInfo(back),info);assert.equal(info.mode,'torch');assert.equal(info.radius,10);
  back.equipment.core2=C.createGear('robot_core',99,back.seed,'party-light');H.state(back).switchLeft=0;const dual=L.portableInfo(back),human=H.switchActor(back,m.id).run;assert.deepEqual(L.portableInfo(human),dual);assert.equal(dual.radius,12);assert.equal(dual.actorId,'hero');L.tick(human,10);assert.equal(human.party.light.fuel,220);
});
test('a cast daylight always wins over both core slots, even while a robot leads or the caster later leaves',()=>{
  const r=fresh(),m={id:'light-mage',profession:'mage',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);r.equipment.core2=C.createGear('robot_core',99,r.seed,'highest');H.actor(r).robot.fuel=0;Object.assign(r.party.light,{lit:true,fuel:230});
  assert.ok(L.canCast(r));const cast=L.daylight(r);assert.ok(cast.ok,cast.message);let next=cast.run;assert.deepEqual(L.portableInfo(next),{mode:'daylight',radius:15,color:0xfff2d1});assert.equal(L.robotLight(next).color,R.CORE_COLORS[0]);assert.ok(L.DAYLIGHT_RADIUS>R.CORE_LIGHT_RADII[2]&&R.CORE_LIGHT_RADII[2]>L.TORCH_RADIUS&&L.TORCH_RADIUS>R.CORE_LIGHT_RADII[1]);
  const switched=H.switchActor(next,m.id);assert.ok(switched.ok);next=switched.run;assert.equal(L.portable(next),'daylight');assert.deepEqual(L.portableInfo(next),L.portableInfo(cast.run));H.setHp(next,m.id,0);assert.equal(L.canCast(next),false);assert.equal(L.portable(next),'daylight');L.tick(next,600);assert.equal(L.portableInfo(next).radius,12);assert.equal(next.party.light.fuel,230);
});
test('strongest living robot is selected deterministically rather than whichever actor leads',()=>{
  const r=fresh(),m={id:'light-robot',profession:'robot',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);H.equipment(r,m.id).core2=C.createGear('robot_core',99,r.seed,'dual-companion');const strongest=L.portableInfo(r);assert.equal(strongest.radius,12);assert.equal(strongest.actorId,m.id);const switched=H.switchActor(r,m.id).run;assert.deepEqual(L.portableInfo(switched),strongest);H.setHp(switched,m.id,0);assert.equal(L.portableInfo(switched).radius,8);assert.equal(L.portableInfo(switched).actorId,'hero');
});
