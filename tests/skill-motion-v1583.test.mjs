import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url),M=require('../story/tower-combat-motion.js');
const GESTURES=['cast','heal','ward','rally','cook','scout','thrust'],at=(family,t,kind='arcane_staff')=>M.sample(kind,'skill',0,t,false,family);
const base=M.sample('arcane_staff','attack',0,1);

test('every human gesture family moves the whole body: it gathers into the wind-up and commits at the release',()=>{
  for(const family of GESTURES){
    const windup=at(family,.22),release=at(family,.48),moved=p=>Math.abs(p.lean)+Math.abs(p.tilt)+Math.abs(p.knee);
    assert.ok(moved(windup)>=.05,family+' wind-up uses lean, roll or stance');assert.ok(moved(release)>=.06,family+' release uses lean, roll or stance');
    assert.ok(windup.lean*release.lean+windup.tilt*release.tilt<0,family+' the body swings the other way between gathering and release');
  }
});

test('instant casts: a small counter-move, a front-loaded strike that never reverses, then post-release momentum',()=>{
  for(const family of GESTURES){
    const windup=at(family,.22),early=at(family,.06);
    // Anticipation: the body first dips slightly opposite to where the wind-up goes.
    const k=['lean','tilt','knee'].find(k=>Math.abs(windup[k])>.03);assert.ok(k,family);assert.ok(Math.sign(early[k]-base[k])!==Math.sign(windup[k]-base[k])||Math.abs(early[k]-base[k])<1e-9,family+' '+k+' counter-moves before the wind-up');
    // The strike bursts out: by 30% of the strike segment the arm has covered at least half its swing, and it never turns back.
    const release=at(family,.48),arm=Math.abs(release.rx-windup.rx)>.05?'rx':'lx',span=release[arm]-windup[arm];
    if(Math.abs(span)>.05){assert.ok((at(family,.22+.26*.3)[arm]-windup[arm])/span>=.5,family+' front-loaded strike');
      let previous=windup[arm];for(let i=1;i<=26;i++){const v=at(family,.22+i/100)[arm];assert.ok((v-previous)*Math.sign(span)>=-1e-9,family+' strike never reverses');previous=v;}}
    // Momentum: just after the release the body keeps going past the release pose before the follow-through.
    const after=at(family,.55),follow=at(family,.7),body=['lean','tilt','knee'].find(k=>Math.abs(release[k]-windup[k])>.03);
    if(body){const dir=Math.sign(release[body]-windup[body]),linear=release[body]+(follow[body]-release[body])*((.55-.48)/(.7-.48));assert.ok((after[body]-linear)*dir>0,family+' '+body+' carries past the release');}
  }
  // Twin daggers keep their two-hand timing: the follow-through is the off-hand's own cut, without extra body carry.
  const d=t=>M.sample('twin_daggers','skill',0,t,false,'scout');assert.ok(Object.values(d(.6)).every(Number.isFinite));
});

test('preparation keeps gathering and breathing, holds briefly past its end, then rests if never released',()=>{
  const model={userData:{heroWeapon:'arcane_staff'}},skill={effect:'bolt'},poses=[];M.begin(model,'charge',1,skill);
  for(let i=0;i<60;i++)poses.push({...M.update(model,1/60)});
  const windup=at('cast',.22),reached=poses.findIndex(p=>Math.abs(p.rx-windup.rx)<.02);assert.ok(reached>0&&reached<20,'reaches its wind-up early');
  assert.ok(new Set(poses.slice(25).map(p=>p.rx.toFixed(4))).size>10,'the gathered pose keeps breathing instead of freezing');
  assert.ok(poses.at(-1).knee>windup.knee&&poses.at(-1).lean<windup.lean,'a wider stance and a little more lean-back as power gathers');
  M.update(model,.2);assert.equal(M.state(model).action,'charge','still holding just after the nominal end, so the release can take over');
  for(let i=0;i<10;i++)M.update(model,.1);assert.equal(M.state(model).action,'');assert.deepEqual({...M.update(model,0)},{...base},'an unreleased preparation returns to rest');
});

test('the runtime prepares with "charge" and releases with "skill" on the same model, which is what makes the release seamless',()=>{
  const runtime=readFileSync(new URL('../story/tower-heroes-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/motion\(actorId,'charge',seconds,s\)/);assert.match(runtime,/motion\(actorId,e\.kind==='disarm'\?'charge':'skill',e\.kind==='disarm'\?e\.power:\.85,s\)/);
  assert.match(runtime,/function cancelPreparation\(p\)\{[^}]*TowerCombatMotion\?\.cancel/,'a cancelled preparation still clears its pose');
});
