import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-lighting-core.js'),R=H.ROBOT;
const fresh=()=>H.enable(P.enable(C.newRun({seed:371,name:'內建光源'}),'robot').run).run;
test('a robot-only party never drains an invisible food bar; living organic companions retain the shared food rule',()=>{
  const r=fresh();assert.equal(H.hungerScale(r),0);const m={id:'food-human',profession:'scout',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);assert.ok(H.hungerScale(r)>=.4);H.setHp(r,m.id,0);assert.equal(H.hungerScale(r),0);
});
test('robot illumination uses the highest installed core, including an empty or exhausted core',()=>{
  const r=fresh();for(let tier=1;tier<=5;tier++){
    r.equipment.core2=C.createGear(R.kind('robot_core',tier),99,r.seed,'light-'+tier);r.equipment.core2.durability=0;H.actor(r).robot.fuel=0;
    assert.deepEqual(L.robotLight(r),{tier,color:R.CORE_COLORS[tier-1],mode:tier<=3?'torch':'daylight',radius:tier<=3?10:15});assert.equal(L.portable(r),tier<=3?'torch':'daylight');
  }
  r.equipment.core1=r.equipment.core2=null;assert.deepEqual(L.robotLight(r),{tier:1,color:R.CORE_COLORS[0],mode:'torch',radius:10});
});
test('controlled robot conserves a lit human torch but still advances the existing daylight timer',()=>{
  const r=fresh();Object.assign(r.party.light,{lit:true,fuel:230,daylight:5,cooldown:5});L.tick(r,10);assert.equal(r.party.light.fuel,230);assert.equal(r.party.light.daylight,0);assert.equal(r.party.light.cooldown,0);assert.equal(r.party.light.lit,true);
});
test('robot light is actor-local, dead robots have no light, and switching restores human torch rules',()=>{
  const r=fresh(),m={id:'light-human',profession:'scout',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};H.setHp(r,'hero',0);assert.equal(L.robotLight(r),null);H.setHp(r,'hero',H.maxHp(r));r.party.members.push(m);r.party.joined.push(m.id);H.addMember(r,m);Object.assign(r.party.light,{lit:true,fuel:230});const switched=H.switchActor(r,m.id).run;assert.ok(switched);assert.equal(L.robotLight(switched),null);assert.equal(L.robotLight(switched,'hero').color,R.CORE_COLORS[0]);L.tick(switched,10);assert.equal(switched.party.light.fuel,220);
});
