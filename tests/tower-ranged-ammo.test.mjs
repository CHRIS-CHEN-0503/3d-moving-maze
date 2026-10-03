import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),E=require('../story/tower-encounters.js'),R=require('../story/tower-hero-growth.js'),M=require('../story/tower-combat-motion.js'),T=require('../lib/three.min.js');
const fresh=(job='mage',seed=43)=>H.enable(P.enable(C.newRun({seed}),job).run).run;

for(const job of ['mage','healer','archer'])test(job+' normal shot pays at launch, even without a target; impact never pays twice',()=>{
  let r=fresh(job);r.equipment.weapon.durability=1;const m=P.monsterSpecs(r)[0],ammo=r.bag.arrow,damage=job==='archer'?H.stats(r).damage:H.stats(r).spellDamage;
  assert.equal(H.strike(r,m.id).ok,false);
  const result=H.fireProjectile(r,'hero');assert.ok(result.ok);r=result.run;
  assert.equal(r.equipment.weapon.durability,0);assert.equal(r.bag.arrow,ammo-(job==='archer'?1:0));assert.equal(H.actor(r).shot.damage,damage);assert.equal(H.actor(r).shot.kind,job==='archer'?'arrow':'orb');assert.ok(C.validateSave(r));
  H.tick(r,.1);const cd=H.actor(r).attack,hit=H.strike(r,m.id,{shot:true});assert.ok(hit.ok);assert.ok(hit.effect.damage>=damage);assert.equal(H.actor(hit.run).attack,cd);assert.equal(hit.run.equipment.weapon.durability,0);assert.equal(hit.run.bag.arrow,r.bag.arrow);assert.equal(H.strike(hit.run,m.id,{shot:true}).ok,false);assert.equal(H.fireProjectile(hit.run,'hero').ok,false);assert.ok(C.validateSave(hit.run));
});
test('invalid actor, no ammo, broken weapon, cooldown and stale revision reject without mutations',()=>{
  for(const reason of ['actor','ammo','broken','cooldown','revision']){const r=fresh('archer');if(reason==='ammo')r.bag.arrow=0;if(reason==='broken')r.equipment.weapon.durability=0;if(reason==='cooldown')H.actor(r).attack=1;const before=JSON.stringify(r);assert.equal(H.fireProjectile(r,reason==='actor'?'missing':'hero',null,reason==='revision'?r.revision-1:r.revision).ok,false);assert.equal(JSON.stringify(r),before);assert.equal(H.fireArrow(r,'missing').ok,false);}
});
test('all archer attack skills spend arrows and durability once, auxiliary skills never spend arrows',()=>{
  for(const s of Object.values(H.SKILLS).filter(s=>s.job==='archer'&&!s.unique)){
    let seed=1;while(!H.draft(seed,'archer','hero').skills.includes(s.id))seed++;
    let r=fresh('archer',seed);const ammo=r.bag.arrow,dur=r.equipment.weapon.durability,result=H.cast(r,s.id);assert.ok(result.ok,s.id);r=result.run;
    assert.equal(r.bag.arrow,ammo-s.ammo,s.id);assert.equal(r.equipment.weapon.durability,dur-(s.attack?1:0),s.id);
    if(s.attack){const hit=H.strike(r,P.monsterSpecs(r)[0].id,{skillId:s.id});assert.ok(hit.ok);assert.equal(hit.run.equipment.weapon.durability,dur-1);r=fresh('archer',seed);r.bag.arrow=s.ammo-1;const before=JSON.stringify(r);assert.equal(H.cast(r,s.id).ok,false);assert.equal(JSON.stringify(r),before);}
  }
  assert.equal(H.SKILLS.arrow_volley.ammo,3);assert.equal(H.SKILLS.worldtree_arrow.ammo,3);
});
test('legacy saves migrate ammo once; explicit zero remains empty and corrupt counts are rejected',()=>{
  for(const job of ['mage','archer']){const r=fresh(job);delete r.bag.arrow;const restored=C.validateSave(r);assert.ok(restored);assert.equal(restored.bag.arrow,job==='archer'?30:0);assert.deepEqual(C.validateSave(restored),restored);restored.bag.arrow=0;assert.equal(C.validateSave(restored).bag.arrow,0);for(const v of [-1,3001,1.5,null]){restored.bag.arrow=v;assert.equal(C.validateSave(restored),null);}}
  const legacy=C.newRun({seed:43});delete legacy.bag.arrow;assert.equal(C.validateSave(legacy).bag.arrow,0);
});
test('AI never selects unaffordable arrow skills; recruiting brings ammunition only on the confirmed join',()=>{
  const archer=fresh('archer');R.state(archer).policies.hero.strategy='attack';for(const key of H.actor(archer).skills)if(!H.SKILLS[key].attack)H.actor(archer).cooldowns[key]=99;
  archer.bag.arrow=0;assert.equal(R.aiChoice(archer,'hero',['hero'],true),null);archer.bag.arrow=1;const choice=R.aiChoice(archer,'hero',['hero'],true);if(choice)assert.equal(H.SKILLS[choice.skill].ammo,1);
  const N=require('../story/tower-narrative.js');let r=fresh('chef');r.floor=87;r.floorsCleared=12;r.chronicle=N.newChronicle(87);P.advance(r);r.coins=99;r.party.meals.salad=1;const offer=P.recruitOffer(r);assert.equal(offer.profession,'archer');assert.equal(r.bag.arrow,0);assert.equal(H.preview(r,offer).equipment.weapon.kind,'elven_bow');assert.equal(r.bag.arrow,0);const result=P.recruit(r,offer.id);assert.ok(result.ok);assert.equal(result.run.bag.arrow,15);assert.equal(P.recruit(result.run,offer.id).ok,false);assert.equal(result.run.bag.arrow,15);assert.deepEqual(C.validateSave(result.run),result.run);
});
test('arrow bundles remain modern-only and map-size scaled; arrow sales belong exclusively to the grocer',()=>{
  let r=fresh('archer',1);assert.equal(E.arrowLoot(fresh('mage'),7).length,0);assert.equal(E.arrowLoot(P.enable(C.newRun({seed:43}),'archer').run,7).length,0);
  for(const [size,count]of [[7,1],[9,1],[11,2],[13,2],[15,3],[17,3],[19,4]]){const a=E.arrowLoot(r,size);assert.equal(a.length,count);assert.ok(a.every(v=>v.quantity===10));assert.deepEqual(E.arrowLoot(C.validateSave(r),size),a);}
  const normal=E.floorLootCounts(7),shop=E.merchantOffers(r.floor,r.seed,true).find(m=>m.id==='suHe');assert.ok(shop.supplies.includes('arrow'));assert.ok(E.merchantOffers(r.floor,r.seed).filter(m=>m.id!=='suHe').every(m=>!m.supplies.includes('arrow')));r.coins=50;const result=E.buySupply(r,shop.id,'arrow',10);assert.ok(result.ok);assert.equal(result.run.bag.arrow,r.bag.arrow+10);assert.equal(result.run.coins,49);assert.deepEqual(E.floorLootCounts(7),normal);r.bag.arrow=95;assert.equal(E.buySupply(r,shop.id,'arrow',10).ok,false);assert.ok(E.buySupply(r,shop.id,'arrow',4).ok);assert.equal(C.useItem(r,'arrow').ok,false);
});

function fixture(job='mage'){
  let run=fresh(job),runtime,blocked=false,wallZ=Infinity,paused=false,hits=0,saves=0;const world=new T.Group(),player=new T.Group(),monster={...P.monsterSpecs(run)[0],alive:true,model:new T.Group()};monster.model.position.set(0,0,3);
  const env=vm.createContext({MazeCharacterVoices:require('../assets/character-voices.js'),TowerCombatIntent:require('../story/tower-combat-intent.js'),TowerHeroes:H,TowerHeroGrowth:R,TowerPartyCore:P,TowerHeroIcons:{svg:()=>''},TowerCombatMotion:M,document:{getElementById:()=>null},Math});for(const file of ['tower-skill-effects','tower-growth-runtime','tower-heroes-runtime'])vm.runInContext(readFileSync(new URL('../story/'+file+'.js',import.meta.url),'utf8'),env);
  const ctx={THREE:T,G:{running:true,shifting:false,px:0,pz:0},run:()=>run,core:C,world:()=>world,player:()=>player,actors:()=>[],monsters:()=>[monster],hazards:()=>[],paused:()=>paused,text:s=>s,action:()=>'',portrait:()=>'',audio:{sfxAction(){}},toast(){},save(){saves++;},dispose(){},clear:(x,z,nx,nz)=>!blocked&&Math.max(z,nz)<wallZ,walkClear:()=>true,cell:(x,y)=>({x,z:y}),worldToCell:(x,z)=>({x:Math.floor(x),y:Math.floor(z)}),
    transact(result){if(!result.ok)return false;run=result.run;return true;},hit(m,memberId,skillId,shot){const result=H.strike(run,m.id,{memberId,skillId,shot});if(result.ok){run=result.run;hits++;if(result.effect.dead)m.alive=false;}return result;}};
  runtime=env.TowerHeroesRuntime.create(ctx);runtime.tick(0);return {runtime,world,monster,run:()=>run,hits:()=>hits,saves:()=>saves,block:v=>blocked=v,wall:v=>wallZ=v,pause:v=>paused=v};
}
test('ordinary light orbs travel, pause, hit once, and stop at walls without durability refunds',()=>{
  for(const job of ['mage','healer','archer']){const f=fixture(job),dur=f.run().equipment.weapon.durability;assert.ok(f.runtime.shoot(f.monster));assert.equal(f.hits(),0);assert.equal(f.run().equipment.weapon.durability,dur-1);assert.ok(f.saves()>0);f.pause(true);f.runtime.tick(.4);assert.equal(f.hits(),0);f.pause(false);f.runtime.tick(.2);assert.equal(f.hits(),1);assert.equal(f.run().equipment.weapon.durability,dur-1);f.runtime.tick(.2);assert.equal(f.hits(),1);assert.equal(f.world.children.length,0);}
  const f=fixture();f.runtime.shoot(f.monster);f.block(true);f.runtime.tick(.3);assert.equal(f.hits(),0);assert.equal(H.actor(f.run()).shot,null);assert.equal(f.world.children.length,0);
});
test('empty fire is a real projectile, costs resources, never homes backwards or reaches beyond weapon range',()=>{
  const f=fixture('archer'),ammo=f.run().bag.arrow;f.monster.model.position.set(0,0,30);assert.ok(f.runtime.shoot());assert.equal(f.run().bag.arrow,ammo-1);assert.ok(f.world.children.some(g=>g.name==='elven-arrow-projectile'));for(let i=0;i<30;i++)f.runtime.tick(.05);assert.equal(f.hits(),0);assert.equal(H.actor(f.run()).shot,null);assert.equal(f.world.children.length,0);
  const side=fixture();side.monster.model.position.set(3,0,0);side.runtime.shoot();side.runtime.tick(.3);assert.equal(side.hits(),0);
});
test('a close monster before the wall is hit even if the frame segment would end behind that wall',()=>{
  for(const job of ['mage','healer','archer']){const f=fixture(job);f.monster.model.position.z=.9;f.wall(1.5);assert.ok(f.runtime.shoot(f.monster));f.runtime.tick(.1);assert.equal(f.hits(),1,job);assert.equal(f.world.children.length,0);}
});
test('sword alternatives are high diagonal cut and level forward thrust with different hand travel',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),env=vm.createContext({THREE:T,TowerHeroes:H,TowerCombatMotion:M,CharacterSculpt:require('../assets/character-sculpt.js'),window:{}});
  vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),env);vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);
  const V=env.TowerHeroVisuals,model=V.base('swordsman',env.buildCharacter),item=(kind,slot)=>({kind,slot,durability:10});V.dress(T,model,{weapon:item('longsword','weapon'),armor:item('heavy_armor','armor'),shield:item('round_shield','shield')},()=>{});
  const blade=model.userData.heroPieces.find(p=>p.userData.baseKind==='longsword'),contact=blade.userData.contact;
  const frame=(variant,time)=>{M.begin(model,'attack',1);const s=M.state(model);s.variant=variant;s.elapsed=time;V.pose(model,0,1,false,0);model.updateMatrixWorld(true);return {tip:blade.localToWorld(new T.Vector3(...contact.tip)),edge:new T.Vector3(...contact.normal).applyNormalMatrix(new T.Matrix3().getNormalMatrix(blade.matrixWorld)),axis:new T.Vector3(...contact.axis).transformDirection(blade.matrixWorld),hand:model.userData.armR.localToWorld(new T.Vector3(0,-.36,.13))};};
  const prep=frame(0,.22),hit=frame(0,.48),cut=hit.tip.clone().sub(prep.tip);assert.ok(prep.tip.y>hit.tip.y+.6,'cut starts high and drops toward the target');assert.ok(Math.abs(cut.x)>.3,'cut crosses a diagonal plane');
  const before=frame(0,.357),after=frame(0,.363),mid=frame(0,.36);assert.ok(Math.abs(mid.edge.dot(after.tip.sub(before.tip).normalize()))>.85,'actual sharp edge leads the cut');
  const thrustPrep=frame(1,.22),thrustHit=frame(1,.48);assert.ok(thrustHit.axis.dot(new T.Vector3(0,0,1))>.95,'point faces the target');assert.ok(thrustHit.tip.z>thrustPrep.tip.z+.45,'point advances forward');assert.ok(Math.abs(thrustHit.tip.y-thrustHit.hand.y)<.3,'thrust stays level at hand height');
  assert.ok(M.sample('longsword','attack',1,.48).wpz>M.sample('longsword','attack',0,.48).wpz+.3);assert.deepEqual(M.sample('longsword','attack',1,1),M.sample('longsword','attack',0,1));
});
test('thrust extends forward in model space rather than rotating the offset upwards, with no cumulative drift',()=>{
  const env=vm.createContext({THREE:T,TowerHeroes:H,TowerCombatMotion:M});vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);const V=env.TowerHeroVisuals,model=new T.Group();for(const key of ['armR','armL']){model.userData[key]=new T.Group();model.userData[key].position.set(key==='armR'?.4:-.4,1.4,0);model.add(model.userData[key]);}
  V.dress(T,model,{weapon:{kind:'longsword',slot:'weapon',durability:10}},()=>{});M.begin(model,'attack',1);M.begin(model,'attack',1);M.state(model).elapsed=.48;V.pose(model,0,1,false,0);model.updateMatrixWorld(true);const piece=model.userData.heroPieces[0],p=piece.position.clone().applyQuaternion(model.userData.armR.quaternion),expected=new T.Vector3(0,-.36,.13).applyQuaternion(model.userData.armR.quaternion).add(new T.Vector3(0,0,.5));assert.ok(p.distanceTo(expected)<1e-8);const old=piece.position.clone();for(let i=0;i<30;i++)V.pose(model,0,1,false,0);assert.ok(piece.position.distanceTo(old)<1e-8);
});
