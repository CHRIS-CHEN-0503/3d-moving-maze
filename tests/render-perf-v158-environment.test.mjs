import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),A=require('../story/tower-environment-life.js');

function life(extra={}){
  let gate=true;const world=new T.Group(),player={x:3,z:-2},
    a=A.create(T,{style:'garden',seed:41,world:()=>world,player:()=>player,visible:()=>gate,clear:()=>true,...extra});
  return {a,world,player,set gate(v){gate=v;}};
}

test('observer-local vertices are written once at creation and never re-uploaded',()=>{
  const h=life(),position=h.a.cloud.geometry.attributes.position,before=Array.from(position.array);
  assert.ok(before.some(n=>n!==0),'offsets exist before the first 10 Hz sample, so the first upload is already final');
  assert.equal(position.version,0);
  for(let i=0;i<200;i++)h.a.tick(.05);
  assert.equal(position.version,0,'200 ticks / 100 samples never flag the constant position buffer');
  assert.deepEqual(Array.from(position.array),before);
  h.a.destroy();
});

test('the gate buffer is re-uploaded only when at least one point flips between visible and hidden',()=>{
  const h=life(),gates=h.a.cloud.geometry.attributes.visible;
  h.a.tick(.2);const first=gates.version;assert.ok(first>=1);assert.ok(gates.array.every(n=>n===1));
  for(let i=0;i<30;i++)h.a.tick(.11);
  assert.equal(gates.version,first,'identical samples leave the buffer untouched');
  h.gate=false;h.a.tick(.11);assert.equal(gates.version,first+1);assert.ok(gates.array.every(n=>n===0));
  for(let i=0;i<10;i++)h.a.tick(.11);assert.equal(gates.version,first+1);
  h.gate=true;h.a.tick(.11);assert.equal(gates.version,first+2);
  assert.equal(gates.usage,T.DynamicDrawUsage);
  h.a.destroy();
});

test('sampling cadence, budgets and world-space gates are unchanged by the upload diet',()=>{
  const seen=[],h=life({visible:(x,z)=>{seen.push([x,z]);return true;},quality:()=> 'battery'});
  h.a.tick(.001);assert.equal(h.a.stats().checks,24);
  for(let i=0;i<5;i++)h.a.tick(.016);assert.equal(h.a.stats().checks,24,'no extra samples inside the 100 ms window');
  h.a.tick(.04);assert.equal(h.a.stats().checks,48);
  const gates=h.a.cloud.geometry.attributes.visible.array;assert.equal(gates.reduce((n,v)=>n+v,0),8,'battery quality still lights 8 of 24 points');assert.equal(seen.length,16,'only budgeted points ask the world for visibility');
  const positions=h.a.cloud.geometry.attributes.position.array;
  for(let i=0;i<8;i++){assert.ok(Math.abs(seen[i][0]-(h.player.x+positions[i*3]))<1e-5);assert.ok(Math.abs(seen[i][1]-(h.player.z+positions[i*3+2]))<1e-5);}
  h.a.destroy();
});
