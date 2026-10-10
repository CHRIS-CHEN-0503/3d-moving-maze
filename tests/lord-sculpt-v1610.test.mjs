import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),L=require('../story/tower-floor-lords.js');
const budget=m=>{let meshes=0,triangles=0;m.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {meshes,triangles};};
const signature=m=>{const parts=[];m.traverse(o=>{if(o.isMesh)parts.push(o.geometry.type+':'+Object.values(o.geometry.parameters||{}).filter(v=>typeof v==='number').map(v=>v.toFixed(2)).join(','));});return parts.sort().join('|');};
const snapshot=m=>{const rows=[];m.traverse(o=>rows.push([o.name,o.position.toArray().map(v=>+v.toFixed(6)),o.rotation.toArray().slice(0,3).map(v=>+v.toFixed(6)),o.visible]));return JSON.stringify(rows);};
test('fifteen lords each build their own hall silhouette with the cinematic rig, gameplay ring and a hidden strike flash',()=>{
  const lords=Object.values(L.allLords()),signatures=new Map();assert.equal(lords.length,15);
  for(const d of lords){const m=L.build(T,d),rig=m.userData.cinemaRig,b=budget(m);
    assert.equal(m.userData.environment,d.environment);assert.ok(b.meshes<=40&&b.triangles<1600,d.name+' '+JSON.stringify(b));
    assert.ok(rig.head&&rig.torso&&rig.arms.length===2&&rig.legs.length===2&&rig.mouth&&rig.eyes.length===2,d.name+' rig');
    assert.equal(rig.mouth.name,'cinema-mouth');assert.ok(rig.mouth.parent===rig.head,'mouth rides on the head joint');for(const eye of rig.eyes)assert.equal(eye.parent,rig.head);
    for(const j of [rig.head,rig.torso,...rig.arms,...rig.legs]){assert.ok(j.name.startsWith('cinema-'));assert.ok(j.children.length>=1,d.name+' '+j.name+' owns meshes');}
    assert.ok(m.userData.ring&&m.userData.ring.parent===m);assert.equal(m.userData.flash.visible,false);assert.equal(m.userData.flash.name,'lord-strike-flash');
    m.updateMatrixWorld(true);const box=new T.Box3().setFromObject(m);assert.ok(box.max.y>2.2&&box.max.y<3,d.name+' height '+box.max.y.toFixed(2));assert.ok(box.min.y>=-.05,d.name+' feet on the floor');
    if(!d.underworld){const sig=signature(m);assert.ok(!signatures.has(sig),d.name+' repeats '+signatures.get(sig));signatures.set(sig,d.name);}
  }
  assert.equal(signatures.size,10,'ten halls, ten silhouettes');
});
test('the attack pose charges the weapon arm, releases with a lunge and flash, and returns exactly to the rest pose',()=>{
  for(const d of Object.values(L.allLords())){const m=L.build(T,d),rig=m.userData.cinemaRig,rest=snapshot(m),style=L.STYLE[d.environment];
    const charged=L.pose(m,{windup:.1,total:.8});assert.equal(charged.kind,style);assert.ok(charged.charge>.8);assert.notEqual(rig.arms[1].rotation.x,0,d.name+' raises the weapon arm');assert.equal(m.userData.flash.visible,false);
    const released=L.pose(m,{windup:0,total:0,strike:.4});assert.equal(released.hit,1);assert.ok(m.userData.body.position.z>0,d.name+' lunges');assert.equal(m.userData.flash.visible,true);assert.ok(m.userData.flash.material.opacity>.4);
    L.pose(m,{windup:0,total:0,strike:.1});assert.ok(m.userData.flash.material.opacity<.2,'flash fades');
    L.pose(m,{});assert.equal(snapshot(m),rest,d.name+' returns to its authored rest pose');assert.equal(m.userData.ring.rotation.x,-Math.PI/2);
  }
  assert.equal(L.pose(new T.Group(),{windup:1,total:1}),null,'a model without a rig is ignored');
});
