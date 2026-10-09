import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),GM=require('../story/tower-gm.js');
const build=(floor,level,companions)=>GM.build({floor,job:'archer',level,seed:4,companions}).run;

test('experience progress runs from 0 to 1 within each level and is full at the cap',()=>{
  const run=build(80,3,[{job:'swordsman',level:3}]),ally=H.ids(run)[1];assert.equal(H.xpProgress(run,'hero'),0);
  H.gainXp(run,Math.round((G.XP[3]-G.XP[2])*.45));assert.ok(Math.abs(H.xpProgress(run,'hero')-.45)<.01);
  H.gainXp(run,G.XP[3]-H.state(run).xp);assert.equal(H.level(run,'hero'),4);assert.equal(H.xpProgress(run,'hero'),0,'a new level starts empty');
  const top=build(5,10,[{job:'mage',level:5}]);assert.equal(H.xpProgress(top,'hero'),1);assert.equal(H.xpProgress(top,H.ids(top)[1]),1,'level-5 surface companions are at their cap');
});

test('surface companions follow the protagonist; underground companions show their own experience',()=>{
  const surface=build(80,3,[{job:'swordsman',level:3}]),ally=H.ids(surface)[1];H.gainXp(surface,Math.round((G.XP[3]-G.XP[2])*.3));
  assert.equal(H.xpProgress(surface,ally),H.xpProgress(surface,'hero'),'they level up together with the hero');
  const deep=build(-10,12,[{job:'mage',level:7}]),member=H.ids(deep)[1];H.gainXp(deep,1000);
  const own=(H.experience(deep,member)-G.XP[6])/(G.XP[7]-G.XP[6]);assert.equal(H.level(deep,member),7);assert.ok(Math.abs(H.xpProgress(deep,member)-own)<1e-9);assert.notEqual(H.xpProgress(deep,member),H.xpProgress(deep,'hero'));
});
