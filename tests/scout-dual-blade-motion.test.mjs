import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),M=require('../story/tower-combat-motion.js'),H=require('../story/tower-heroes-core.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),build=html.slice(start,html.indexOf('\n}',start)+2);
const env=vm.createContext({THREE:T,TowerHeroes:H,TowerCombatMotion:M,CharacterSculpt:require('../assets/character-sculpt.js'),window:{}});
vm.runInContext(build,env);
vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);
const V=env.TowerHeroVisuals;

function figure(sex,tier=1){
  const model=V.base('scout',env.buildCharacter,'hero',sex),kind='twin_daggers'+(tier>1?'_t'+tier:'');
  V.dress(T,model,{helmet:null,armor:null,shield:null,weapon:{kind,slot:'weapon',durability:10}},()=>{});
  const pieces=model.userData.heroPieces,arms=[model.userData.armR,model.userData.armL];
  const weapons=arms.map(arm=>pieces.find(p=>p.parent===arm));
  assert.ok(weapons.every(Boolean));
  // Exact authored blade endpoint, transformed through the actual dress/pose
  // hierarchy, rather than comparing abstract pose arrays.
  const tip=new T.Vector3(0,.14+.4*(1+(tier-1)*.045)+.11,0);
  return {model,arms,weapons,tip};
}
function pose(f,variant,time){
  M.begin(f.model,'attack',1);const state=M.state(f.model);state.variant=variant;state.elapsed=time;
  V.pose(f.model,1-time,1,false,0);f.model.updateMatrixWorld(true);
  const right=new T.Vector3(Math.cos(f.model.rotation.y),0,-Math.sin(f.model.rotation.y));
  const forward=new T.Vector3(Math.sin(f.model.rotation.y),0,Math.cos(f.model.rotation.y));
  const project=p=>{const d=p.sub(f.model.position);return {x:d.dot(right),z:d.dot(forward),y:d.y};};
  return {tips:f.weapons.map(w=>project(w.localToWorld(f.tip.clone()))),grips:f.weapons.map(w=>w.localToWorld(new T.Vector3())),hands:f.arms.map(a=>a.localToWorld(new T.Vector3(0,-.36,.13)))};
}

for(const sex of ['male','female'])for(let tier=1;tier<=5;tier++){
  test(`scout ${sex} tier ${tier}: combination has separate forward right / left strikes`,()=>{
    const f=figure(sex,tier),rest=pose(f,0,1),first=pose(f,0,.48),second=pose(f,0,.7);
    assert.ok(first.tips[0].z>first.tips[1].z+.35,'right blade attacks while left stays back');
    assert.ok(second.tips[1].z>second.tips[0].z+.35,'left blade attacks after right retracts');
    assert.ok(first.tips[0].z>rest.tips[0].z+.45);
    assert.ok(second.tips[1].z>rest.tips[1].z+.45);
    const frames=Array.from({length:101},(_,i)=>pose(f,0,i/100));
    const peaks=[0,1].map(hand=>frames.reduce((best,p,i)=>p.tips[hand].z>frames[best].tips[hand].z?i:best,0));
    assert.ok(peaks[0]>=40&&peaks[0]<=55&&peaks[1]>=63&&peaks[1]<=77,JSON.stringify(peaks));
  });
  test(`scout ${sex} tier ${tier}: both blades sweep inward and cross in front at any heading`,()=>{
    const f=figure(sex,tier),count=f.model.children.length;
    for(let turn=0;turn<8;turn++){
      f.model.position.set(7,0,-8);f.model.rotation.y=turn*Math.PI/4;
      const open=pose(f,1,.22),cross=pose(f,1,.48);
      assert.ok(open.tips[0].x<-.5&&open.tips[1].x>.5,'wind up at opposite outer sides');
      assert.ok(cross.tips[0].x>.1&&cross.tips[1].x<-.1,'tips cross the torso centerline');
      assert.ok(cross.tips.every(t=>t.z>.45),'cross must be in front of the body');
      for(let i=0;i<=100;i++){
        const p=pose(f,1,i/100);
        for(let hand=0;hand<2;hand++)assert.ok(p.grips[hand].distanceTo(p.hands[hand])<1e-6,'grip stays in actual hand');
        assert.ok(p.tips.every(t=>Object.values(t).every(Number.isFinite)));
        assert.equal(f.model.children.length,count);assert.equal(f.model.rotation.y,turn*Math.PI/4);
        assert.deepEqual(f.model.position.toArray(),[7,0,-8]);
      }
    }
  });
}
