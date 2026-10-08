import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),M=require('../story/tower-combat-motion.js'),H=require('../story/tower-heroes-core.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),build=html.slice(start,html.indexOf('\n}',start)+2);
const source=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
function visuals(modern=true){const env=vm.createContext({THREE:T,TowerHeroes:H,...(modern?{TowerCombatMotion:M}:{}),CharacterSculpt:require('../assets/character-sculpt.js'),window:{}});vm.runInContext(build,env);vm.runInContext(source,env);return env;}
function figure(env,sex,tier){const V=env.TowerHeroVisuals,model=V.base('scout',env.buildCharacter,'hero',sex);V.dress(T,model,{weapon:{kind:H.tierKind('twin_daggers',tier),slot:'weapon',durability:10}},()=>{});return {V,model,weapons:[model.userData.armR,model.userData.armL].map(a=>model.userData.heroPieces.find(w=>w.parent===a))};}
function points(f){f.model.updateMatrixWorld(true);const forward=new T.Vector3(Math.sin(f.model.rotation.y),0,Math.cos(f.model.rotation.y));return f.weapons.map(w=>({axis:new T.Vector3(...w.userData.contact.axis).transformDirection(w.matrixWorld),tip:w.localToWorld(new T.Vector3(...w.userData.contact.tip)),grip:w.localToWorld(new T.Vector3(...w.userData.contact.grip)),hand:w.parent.localToWorld(new T.Vector3(0,-.36,.13)),forward}));}
function pose(f,action,skill,time,variant=0){M.begin(f.model,action,1,skill);Object.assign(M.state(f.model),{elapsed:time,variant});f.V.pose(f.model,0,1,false,0);return points(f);}
const references=model=>{const out=[];model.traverse(p=>out.push([p,p.geometry,p.material]));return out;};

for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  test(`ranger ${sex} tier ${tier}: initial dress, guarded gestures and recovery genuinely point behind`,()=>{
    const env=visuals(),f=figure(env,sex,tier),original=references(f.model);
    for(let heading=0;heading<8;heading++){
      f.model.position.set(5,0,-9);f.model.rotation.y=heading*Math.PI/4;
      for(const p of points(f))assert.ok(p.axis.dot(p.forward)<-.999,'initial dress must already show a reverse grip');
      for(const family of ['scout','reveal','deploy','ward','heal'])for(const time of [.22,.48,.70])for(const p of pose(f,'skill',{presentation:{motion:family}},time)){
        assert.ok(p.axis.dot(p.forward)<-.97,'non-cutting gestures must retain rearward blades');assert.ok(p.grip.distanceTo(p.hand)<1e-6,'true authored grip remains in its hand');
      }
      for(const variant of [0,1])for(const p of pose(f,'attack',null,1,variant))assert.ok(p.axis.dot(p.forward)<-.999,'both attack recoveries return to reverse guard');
      assert.deepEqual(f.model.position.toArray(),[5,0,-9]);assert.equal(f.model.rotation.y,heading*Math.PI/4);
    }
    assert.deepEqual(references(f.model),original,'posing must reuse the existing meshes, geometries and materials');
    for(const w of f.weapons){assert.equal(w.userData.gripStyle,'reverse');assert.deepEqual(Array.from(w.userData.contact.axis),[0,-1,0]);let triangles=0;w.traverse(p=>{assert.ok(!p.isLight);if(p.isMesh)triangles+=(p.geometry.index?.count||p.geometry.attributes.position.count)/3;});assert.ok(w.children.length<=8&&triangles<=2700,'reverse construction retains the existing mobile weapon budget');}
  });
  test(`ranger ${sex} tier ${tier}: thrown knife winds back, points forward at release and regains reverse guard`,()=>{
    const f=figure(visuals(),sex,tier),skill=H.SKILLS.throw_blade,refs=references(f.model);assert.equal(M.familyFor(skill),'knife_throw');
    { const prepared=pose(f,'charge',skill,1);assert.ok(prepared[0].axis.dot(prepared[0].forward)<-.8,'preparation holds the real rearward throwing windup');assert.ok(prepared[1].axis.dot(prepared[1].forward)<-.99,'offhand keeps its reverse guard while preparing (the body leans back as it gathers)');M.cancel(f.model); }
    for(let heading=0;heading<8;heading++){
      f.model.rotation.y=heading*Math.PI/4;
      const windup=pose(f,'skill',skill,.22),release=pose(f,'skill',skill,.48),recover=pose(f,'skill',skill,1);
      assert.ok(windup[0].axis.dot(windup[0].forward)<-.8,'throw starts from a rearward reverse hold');
      assert.ok(release[0].axis.dot(release[0].forward)>.999,'real thrown tip, not its hilt, points toward the target');
      assert.ok(release[0].tip.clone().sub(release[0].grip).dot(release[0].forward)>.5,'release tip is ahead of the hand');
      assert.ok(release[1].axis.dot(release[1].forward)<-.999,'offhand stays in reverse guard');
      assert.ok(recover.every(p=>p.axis.dot(p.forward)<-.999),'throw recovers its reverse hold');
      for(let step=0;step<=50;step++)for(const p of pose(f,'skill',skill,step/50))assert.ok(p.grip.distanceTo(p.hand)<1e-6,'both handles remain held during the throwing gesture');
    }
    assert.deepEqual(references(f.model),refs,'no frame-time resource replacement for the thrown gesture');
  });
}

test('legacy dagger posing retains a rearward reverse grip and both actual hand mounts',()=>{
  const env=visuals(false);for(const sex of ['male','female'])for(const tier of [1,5]){
    const f=figure(env,sex,tier);for(const p of points(f))assert.ok(p.axis.dot(p.forward)<-.98,'initial legacy dress must point rearward');
    for(let step=0;step<=50;step++){f.V.pose(f.model,1-step/50,1,false,0);for(const p of points(f))assert.ok(p.grip.distanceTo(p.hand)<1e-6);}
    f.V.pose(f.model,0,1,false,0);for(const p of points(f))assert.ok(p.axis.dot(p.forward)<-.98,'fallback swing returns to reverse guard');
  }
});
