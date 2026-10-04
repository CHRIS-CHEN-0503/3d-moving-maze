import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),M=require('../story/tower-combat-motion.js'),H=require('../story/tower-heroes-core.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),build=html.slice(start,html.indexOf('\n}',start)+2);
const env=vm.createContext({THREE:T,TowerHeroes:H,TowerCombatMotion:M,CharacterSculpt:require('../assets/character-sculpt.js'),window:{}});
vm.runInContext(build,env);vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);
const V=env.TowerHeroVisuals;

function figure(baseKind,sex,tier){
  const kind=H.tierKind(baseKind,tier),definition=H.GEAR[kind],job=definition.jobs[0],model=V.base(job,env.buildCharacter,'hero',sex);
  const item=(kind,slot)=>({kind,slot,durability:100}),equipment={weapon:item(kind,'weapon'),helmet:null,armor:item(H.JOBS[job].armor==='robe'?'robe':H.JOBS[job].armor+'_armor','armor'),shield:definition.hands===1?item('round_shield','shield'):null};
  V.dress(T,model,equipment,()=>{});model.position.set(4,0,-7);
  const weapon=model.userData.heroPieces.find(p=>p.userData.baseKind===baseKind),contact=weapon.userData.contact;
  assert.ok(contact,kind+' has an authored physical contact/emission point');
  assert.equal(weapon.parent,baseKind==='elven_bow'?model.userData.bowArms.right.hand:model.userData.armR);
  return {model,weapon,contact,kind};
}
function frame(f,variant,time,family=''){
  M.begin(f.model,family?'skill':'attack',1,family?{presentation:{motion:family}}:undefined);const state=M.state(f.model);state.variant=variant;state.elapsed=time;
  f.model.userData.legR.rotation.x=f.model.userData.legL.rotation.x=0;V.pose(f.model,0,1,false,0);f.model.updateMatrixWorld(true);
  // Follow the actual dressed hierarchy, including sex-specific body scale,
  // heading and body lean. Normals use inverse-transpose for nonuniform scale.
  const point=p=>f.weapon.localToWorld(new T.Vector3(...p)),normal=p=>new T.Vector3(...p).applyNormalMatrix(new T.Matrix3().getNormalMatrix(f.weapon.matrixWorld));
  const bow=f.model.userData.bowArms,hand=bow?.right.hand,leftHand=bow?.left.hand;
  return {point:point(f.contact.center),normal:normal(f.contact.normal),flat:normal([0,0,1]),axis:new T.Vector3(...f.contact.axis).transformDirection(f.weapon.matrixWorld),grip:point(f.contact.grip),hand:hand?hand.getWorldPosition(new T.Vector3()):f.model.userData.armR.localToWorld(new T.Vector3(0,-.36,.13)),leftHand:leftHand?leftHand.getWorldPosition(new T.Vector3()):f.model.userData.armL.localToWorld(new T.Vector3(0,-.36,.13)),tip:f.contact.tip?point(f.contact.tip):null,nock:f.contact.nock?point(f.contact.nock):null};
}
function sweep(f,variant,time,family=''){
  const a=frame(f,variant,time-.003,family),b=frame(f,variant,time+.003,family),p=frame(f,variant,time,family);
  p.velocity=b.point.sub(a.point);assert.ok(p.velocity.length()>.001,'strike is moving');p.velocity.normalize();if(p.tip)p.tipVelocity=b.tip.sub(a.tip).normalize();return p;
}
const strikeTimes=[.30,.34,.38,.42,.46];

for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  test(`${sex} tier ${tier}: both hammer swings and forge skills lead with their gold face`,()=>{
    for(const kind of ['smith_hammer','warhammer']){
      const f=figure(kind,sex,tier),count=f.model.children.length;
      for(let heading=0;heading<8;heading++){
        f.model.rotation.y=heading*Math.PI/4;
        for(const [variant,family] of [[0,''],[1,''],[0,'heavy'],[1,'heavy'],[0,'forge'],[0,'deploy']])for(const time of strikeTimes){
          const p=sweep(f,variant,time,family);
          assert.ok(p.normal.dot(p.velocity)>.85,`${kind} ${family||'attack'} ${variant} gold face must lead at ${time}: ${p.normal.dot(p.velocity)} heading ${heading}`);
          assert.ok(p.grip.distanceTo(p.hand)<1e-6,'hammer stays held by its handle');
          assert.equal(f.model.children.length,count);assert.equal(f.model.rotation.y,heading*Math.PI/4);
          assert.deepEqual(f.model.position.toArray(),[4,0,-7]);
        }
      }
    }
  });
  test(`${sex} tier ${tier}: pan attacks slap with the solid bottom`,()=>{
    const f=figure('cooking_pan',sex,tier);
    for(let heading=0;heading<8;heading++){
      f.model.rotation.y=heading*Math.PI/4;
      for(const [variant,family]of [[0,''],[1,''],[0,'heavy']])for(const time of strikeTimes){const p=sweep(f,variant,time,family);assert.ok(p.normal.dot(p.velocity)>.90,`pan bottom must lead ${variant} at ${time}`);assert.ok(p.grip.distanceTo(p.hand)<1e-6);}
    }
  });
  test(`${sex} tier ${tier}: sword cuts lead with a blade edge, and thrusts with the tip`,()=>{
    for(const kind of ['longsword','greatsword']){
      const f=figure(kind,sex,tier);
      for(let heading=0;heading<8;heading++){
        f.model.rotation.y=heading*Math.PI/4;
        for(const [variant,family]of [[0,''],...(kind==='greatsword'?[[1,'']]:[]),[0,'slash'],[0,'spin']])for(const time of strikeTimes){
          const p=sweep(f,variant,time,family);
          assert.ok(Math.abs(p.normal.dot(p.velocity))>.85,`${kind} ${family||'cut'} must use the sharp edge at ${time}`);
          assert.ok(Math.abs(p.flat.dot(p.velocity))<.40,'blade flat must not slap the target');
        }
        for(const family of kind==='longsword'?['','thrust']:['thrust'])for(const time of strikeTimes){
          const p=sweep(f,1,time,family);assert.ok(p.axis.dot(p.tipVelocity)>.85,`${kind} forward thrust follows the point at ${time}: ${p.axis.dot(p.tipVelocity)}`);
          const forward=new T.Vector3(Math.sin(f.model.rotation.y),0,Math.cos(f.model.rotation.y));assert.ok(p.axis.dot(forward)>.95,'tip points toward the target');
        }
      }
    }
  });
  test(`${sex} tier ${tier}: ranged equipment aims its authored emission axis forward`,()=>{
    for(const kind of ['arcane_staff','spellbook','elven_bow']){
      const f=figure(kind,sex,tier);
      for(let heading=0;heading<8;heading++){
        f.model.rotation.y=heading*Math.PI/4;const forward=new T.Vector3(Math.sin(f.model.rotation.y),0,Math.cos(f.model.rotation.y));
        for(const [variant,family] of [[0,''],[1,''],[0,kind==='elven_bow'?'bow':'cast']]){
          const p=frame(f,variant,.48,family);assert.ok(p.axis.dot(forward)>.95,kind+' emits toward the target');
          assert.ok(p.point.clone().sub(f.model.position).dot(forward)>.5,'source is in front of the actor');
        }
      }
    }
  });
  test(`${sex} tier ${tier}: both dagger combinations cut with edges while preserving their two-hand timing`,()=>{
    const f=figure('twin_daggers',sex,tier),right=f.weapon,left=f.model.userData.heroPieces.find(p=>p!==right&&p.userData.baseKind==='twin_daggers');assert.equal(left.parent,f.model.userData.armL);
    for(let heading=0;heading<8;heading++){
      f.model.rotation.y=heading*Math.PI/4;
      for(const [weapon,times]of [[right,strikeTimes],[left,[.52,.56,.60,.64,.68]]]){
        f.weapon=weapon;f.contact=weapon.userData.contact;
        // Short knives combine the shoulder's forward reach with slicing
        // along their length. Their edge must lead the lateral part, while
        // essentially all movement stays in the thin blade plane, not flat.
        for(const family of ['', 'thrust'])for(const time of times){const p=sweep(f,0,time,family);assert.ok(Math.abs(p.normal.dot(p.tipVelocity))>.85,'knife tip cuts along the sharp-edge direction');assert.ok(Math.abs(p.normal.dot(p.velocity))>.45,'middle of the short blade retains an edge-cut component as the hand reaches forward');assert.ok(Math.abs(p.flat.dot(p.velocity))<.30,`alternating cut must not slap with the blade flat: ${weapon===right?'R':'L'} ${family} ${time} ${p.flat.dot(p.velocity)} heading ${heading}`);}
      }
      for(const weapon of [right,left]){
        f.weapon=weapon;f.contact=weapon.userData.contact;
        for(const time of strikeTimes){const p=sweep(f,1,time);assert.ok(Math.abs(p.normal.dot(p.velocity))>.8,'inward X cut retains its leading edges');const forward=new T.Vector3(Math.sin(f.model.rotation.y),0,Math.cos(f.model.rotation.y));assert.ok(p.point.clone().sub(f.model.position).dot(forward)>.4,'crossed blades stay in front');}
      }
    }
    f.model.rotation.y=0;f.weapon=right;f.contact=right.userData.contact;const r=frame(f,0,.48);f.weapon=left;f.contact=left.userData.contact;const l=frame(f,0,.48),lFinish=frame(f,0,.70);
    assert.ok(r.tip.z>l.tip.z+.3,'right blade leads the first cut');assert.ok(lFinish.tip.z>l.tip.z+.3,'left blade follows for the second cut');
    for(const weapon of [right,left]){
      f.weapon=weapon;f.contact=weapon.userData.contact;
      const idle=frame(f,0,1),windup=frame(f,0,.22),release=frame(f,0,weapon===right?.48:.70);
      assert.ok(idle.axis.z<-.95,'reverse blade points behind the actor at rest');
      assert.ok(windup.tip.z<windup.grip.z,'windup retains a rearward reverse grip');
      assert.ok(release.tip.z>release.grip.z,'reverse cut drives its real tip forward');
      assert.ok(release.tip.y<release.grip.y,'downward cut finishes below the held handle');
    }
    f.weapon=right;f.contact=right.userData.contact;const rightCross=frame(f,1,.48);f.weapon=left;f.contact=left.userData.contact;const leftCross=frame(f,1,.48);assert.ok(rightCross.tip.x>leftCross.tip.x+.3,'second combination retains its inward crossed tips');
  });
  test(`${sex} tier ${tier}: the bow is held in the right hand and its left hand draws the rear string`,()=>{
    const f=figure('elven_bow',sex,tier);
    for(let heading=0;heading<8;heading++){
      f.model.rotation.y=heading*Math.PI/4;
      for(const [variant,family] of [[0,''],[1,''],[0,'bow']])for(const time of [.22,.48]){
        const p=frame(f,variant,time,family);assert.ok(p.grip.distanceTo(p.hand)<1e-6,'right hand holds the bow grip');
        assert.ok(p.leftHand.distanceTo(p.nock)<.12,`left draw hand ${p.leftHand.distanceTo(p.nock)} from the nock`);
        assert.ok(p.leftHand.y>f.model.position.y+1,'draw hand reaches chest level');
        assert.ok(f.model.worldToLocal(p.grip.clone()).z>.65,'bow grip is well ahead of chest armor');
        const rig=f.model.userData.bowArms;
        for(const arm of [rig.right,rig.left]){
          const nodes=[arm.upper,arm.elbow,arm.hand].map(n=>f.model.worldToLocal(n.getWorldPosition(new T.Vector3())));
          for(let bone=0;bone<2;bone++){
            assert.ok(Math.abs(nodes[bone].distanceTo(nodes[bone+1])-.42)<1e-6,'bone length stays constant');
            for(let i=0;i<=12;i++){const point=nodes[bone].clone().lerp(nodes[bone+1],i/12);assert.ok(Math.abs(point.x)>.34||point.z>.29,`arms must stay outside the inflated chest volume: ${arm.side} ${variant} ${time} bone ${bone} point ${point.toArray()} nodes ${nodes.map(n=>n.toArray())}`);}
          }
        }
      }
    }
  });
}

test('skill preparation holds the same authored windup used by its release',()=>{
  for(const kind of Object.keys(M.WEAPONS))for(const family of new Set(Object.values(M.FAMILIES))){
    assert.deepEqual(M.sample(kind,'charge',0,1,true,family),M.sample(kind,'skill',0,.22,true,family),`${kind} ${family}`);
  }
});

test('first-person posing preserves held equipment, heading and location, then restores torso rest',()=>{
  // Robot integrated fists use their own no-handle hierarchy and are covered
  // by tower-robot-visuals, rather than this humanoid armor fixture.
  for(const kind of Object.keys(M.WEAPONS).filter(k=>!['unarmed','robot_fists'].includes(k))){
    const f=figure(kind,'female',5),count=f.model.children.length;f.model.rotation.y=2.4;
    M.begin(f.model,'attack',.6);for(let i=0;i<35;i++){
      f.model.userData.legR.rotation.x=f.model.userData.legL.rotation.x=0;V.pose(f.model,0,.6,true,.02);f.model.updateMatrixWorld(true);
      assert.equal(f.model.rotation.y,2.4);assert.deepEqual(f.model.position.toArray(),[4,0,-7]);assert.equal(f.model.children.length,count);
      f.model.traverse(p=>assert.ok(p.matrixWorld.elements.every(Number.isFinite)));
      assert.equal(f.weapon.visible,true);assert.equal(f.weapon.parent,kind==='elven_bow'?f.model.userData.bowArms.right.hand:f.model.userData.armR);
    }
    assert.equal(M.state(f.model).action,'');assert.equal(f.model.rotation.x,0);assert.equal(f.model.rotation.z,0);
  }
});

test('bow elbows and wrists are built once, survive walking/first-person, and restore after drawing',()=>{
  const f=figure('elven_bow','female',5),rig=f.model.userData.bowArms,references=[],rest=[];
  frame(f,0,1);f.model.traverse(n=>references.push([n,n.geometry,n.material]));for(const arm of [rig.right,rig.left])rest.push(arm.upper.quaternion.clone(),arm.elbow.quaternion.clone(),arm.hand.quaternion.clone());
  for(let i=0;i<200;i++){f.model.userData.armR.rotation.x=Math.sin(i)*.2;f.model.userData.armL.rotation.x=-Math.sin(i)*.2;frame(f,i%2,(i%35)/35);V.pose(f.model,0,1,i%2===0,0);}
  frame(f,0,1);let index=0;for(const arm of [rig.right,rig.left])for(const node of [arm.upper,arm.elbow,arm.hand])assert.ok(node.quaternion.angleTo(rest[index++])<1e-7);
  const after=[];f.model.traverse(n=>after.push([n,n.geometry,n.material]));assert.deepEqual(after,references);
  assert.equal(figure('longsword','male',1).model.userData.bowArms,undefined,'other professions retain their existing arms');
});

test('bow lift and recovery take both arms around the chest, not straight through it',()=>{
  for(const sex of ['male','female']){
    const f=figure('elven_bow',sex,5);
    for(const variant of [0,1])for(let step=0;step<=100;step++){
      frame(f,variant,step/100);
      for(const arm of [f.model.userData.bowArms.right,f.model.userData.bowArms.left]){
        const nodes=[arm.upper,arm.elbow,arm.hand].map(n=>f.model.worldToLocal(n.getWorldPosition(new T.Vector3())));
        for(let bone=0;bone<2;bone++)for(let i=0;i<=12;i++){
          const point=nodes[bone].clone().lerp(nodes[bone+1],i/12);
          assert.ok(Math.abs(point.x)>.34||point.z>.29||point.y<.78,`${sex} ${variant} phase ${step/100}: arm segment must not enter chest ${point.toArray()}`);
        }
      }
    }
  }
});
