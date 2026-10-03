import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),I=require('../story/tower-heroes-icons.js'),F=require('../story/tower-field-guide.js');
const fresh=(job='mage')=>H.enable(P.enable(C.newRun({seed:22}),job).run).run;
function companion(run){const m={id:'haste-scout',profession:'scout',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(m);run.party.joined.push(m.id);H.addMember(run,m);H.sync(run);assert.ok(C.validateSave(run));return m.id;}
function used(run,id){run.bag.haste=3;const result=id?G.use(run,'haste',id):C.useItem(run,'haste');assert.ok(result.ok,result.message);return result.run;}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,actual+' vs '+expected);

test('haste gives every profession exact move and normal-attack speed for 300 seconds, with no damage or skill changes',()=>{
  assert.equal(C.HASTE_DURATION,300);assert.equal(C.HASTE_PERCENT,20);
  for(const job of Object.keys(H.JOBS)){
    const r=fresh(job),stats=H.stats(r),speed=H.speed(r),skills=structuredClone(H.actor(r).cooldowns),preparation={...H.PREPARATION},n=used(r);
    assert.deepEqual(H.buff(n,'haste'),{id:'haste',left:300,power:20});assert.equal(n.bag.haste,2);assert.equal(n.effects.haste,0);
    close(H.speed(n),speed*1.2);close(H.stats(n).interval,stats.interval/1.2);assert.equal(H.stats(n).damage,stats.damage);assert.equal(H.stats(n).spellDamage,stats.spellDamage);assert.deepEqual(H.actor(n).cooldowns,skills);assert.deepEqual(H.PREPARATION,preparation);assert.ok(C.validateSave(n));
  }
});
test('duration ignores extension; repeat use neither stacks, refreshes, consumes nor modifies the save',()=>{
  let r=fresh();H.actor(r).passives=['extension','recovery'];r=used(r);assert.equal(H.buff(r,'haste').left,300);
  r=C.tickEffects(r,25).run;const before=JSON.stringify(r);const result=C.useItem(r,'haste');assert.equal(result.ok,false);assert.match(result.message,/仍在生效/);assert.equal(JSON.stringify(r),before);assert.equal(H.buff(r,'haste').left,275);
  for(let i=0;i<4;i++)r=C.tickEffects(r,60).run;r=C.tickEffects(r,35).run;assert.equal(H.buff(r,'haste'),null);assert.equal(C.hasteMultiplier(r),1);
  const again=C.useItem(r,'haste');assert.ok(again.ok);assert.equal(again.run.bag.haste,1);assert.equal(H.buff(again.run,'haste').left,300);
});
test('the user retains haste through control changes and descent; another actor can drink independently',()=>{
  let r=fresh();const id=companion(r),otherSpeed=H.speed(r,id);r=used(r);const switched=H.switchActor(r,id);assert.ok(switched.ok);r=switched.run;
  assert.equal(C.hasteMultiplier(r),1);close(H.speed(r,id),otherSpeed);assert.equal(C.hasteMultiplier(r,'hero'),1.2);assert.equal(H.buff(r,'haste','hero').left,300);
  const ally=G.use(r,'haste',id);assert.ok(ally.ok,ally.message);r=ally.run;assert.equal(r.bag.haste,1);assert.ok(H.buff(r,'haste',id));assert.ok(H.buff(r,'haste','hero'));
  const down=C.descend(r);assert.ok(down.ok,down.message);assert.equal(down.run.floor,98);for(const who of ['hero',id])assert.equal(H.buff(down.run,'haste',who).left,300);
  assert.deepEqual(C.validateSave(JSON.stringify(down.run)),down.run,'save/load does not subtract offline time');
});
test('quick slots allow haste; autonomous allies require explicit opt-in and a nearby threat',()=>{
  let r=fresh();const id=companion(r);r.bag.haste=4;G.state(r).quick[0]='haste';assert.ok(C.validateSave(r));assert.ok(G.itemIds.includes('haste'));
  assert.equal(G.state(r).policies[id].haste,false);assert.equal(G.autoItems(r,[id]),null);assert.equal(G.use(r,'haste',id,true).ok,false);
  G.state(r).policies[id].haste=true;assert.equal(G.autoItems(r,[]),null);assert.deepEqual(G.autoItems(r,[id]),{id,key:'haste'});
  const applied=G.use(r,'haste',id,true);assert.ok(applied.ok);r=applied.run;assert.equal(r.bag.haste,3);assert.equal(H.buff(r,'haste',id).left,300);assert.equal(H.buff(r,'haste','hero'),null);
  H.tick(r,5);assert.equal(G.autoItems(r,[id]),null);assert.equal(G.use(r,'haste',id,true).ok,false);
  G.state(r).policies.hero.haste=true;assert.equal(G.use(r,'haste','hero',true).ok,false);G.state(r).useActive=true;assert.ok(G.use(r,'haste','hero',true).ok);
});
test('old save migrations add empty potion storage and disabled policies without resetting existing data',()=>{
  const r=fresh();companion(r);delete r.bag.haste;delete r.effects.haste;for(const p of Object.values(G.state(r).policies))delete p.haste;
  const old=JSON.stringify(r),n=C.validateSave(old);assert.ok(n);assert.equal(n.bag.haste,0);assert.equal(n.effects.haste,0);assert.ok(Object.values(G.state(n).policies).every(p=>p.haste===false));assert.equal(JSON.stringify(r),old);assert.deepEqual(C.validateSave(n),n);
  for(const value of [-1,100,1.5,null]){const bad=structuredClone(n);bad.bag.haste=value;assert.equal(C.validateSave(bad),null);}
  for(const value of [-1,301,NaN,null]){const bad=structuredClone(n);bad.effects.haste=value;assert.equal(C.validateSave(bad),null);}
  const buffed=used(n);for(const [key,value]of [['left',301],['power',21]]){const bad=structuredClone(buffed);H.buff(bad,'haste')[key]=value;assert.equal(C.validateSave(bad),null);}
});
test('legacy journeys can drink, retain across floors and expire without modern actor data',()=>{
  let r=C.newRun({seed:22});r.bag.haste=2;const result=C.useItem(r,'haste');assert.ok(result.ok);r=result.run;assert.equal(r.effects.haste,300);assert.equal(C.hasteMultiplier(r),1.2);
  const before=JSON.stringify(r);assert.equal(C.useItem(r,'haste').ok,false);assert.equal(JSON.stringify(r),before);
  r=C.descend(r).run;assert.equal(r.effects.haste,300);for(let i=0;i<5;i++)r=C.tickEffects(r,60).run;assert.equal(r.effects.haste,0);assert.equal(C.hasteMultiplier(r),1);assert.ok(C.useItem(r,'haste').ok);
});
test('haste keeps normal transaction guards and rejected uses never spend a bottle',()=>{
  const r=fresh(),id=companion(r);r.bag.haste=2;H.setHp(r,id,0);const before=JSON.stringify(r);
  for(const result of [G.use(r,'haste',id),G.use(r,'haste','missing'),C.useItem(r,'haste',r.revision-1)])assert.equal(result.ok,false);assert.equal(JSON.stringify(r),before);
  r.bag.haste=0;assert.equal(C.useItem(r,'haste').ok,false);
});
test('potion has its own original icon and concise guide; runtime pause gate precedes all buff timing',()=>{
  const icon=I.svg('item_haste');assert.match(icon,/<svg/);assert.notEqual(icon,I.svg('item_heal'));assert.doesNotMatch(icon,/<image|https?:\/\/(?!www.w3.org)/);assert.match(F.item('haste',fresh()).effect,/五分鐘/);
  assert.equal(require('../assets/combat-audio.js').itemKind('haste'),'drink');
  const mode=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8'),tick=mode.slice(mode.indexOf('  function tick(dt, now) {'));
  assert.ok(tick.indexOf('if (paused || !G.running || G.frozen || G.shifting')<tick.indexOf('C.tickEffects(run, dt)'));
  const ui=readFileSync(new URL('../story/tower-growth-runtime.js',import.meta.url),'utf8');assert.match(ui,/checkbox\('遇敵時：加速藥水','haste',p.haste\)/);assert.match(ui,/R\.itemIds\.map/);
});
test('actual legacy mode attack accepts another swing after the shortened interval instead of its former fixed 0.8-second gate',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  const bridge=`window.__hasteTest={attack,set(value){run=value;active=true;paused=false;floorStarted=true;attackLeft=0;},remaining:()=>attackLeft,advance(dt){attackLeft=Math.max(0,attackLeft-dt);}};`;
  assert.match(source,/  install\(\);\s*\}\)\(\);\s*$/);
  function fixture(haste){
    const motions=[],sounds=[];const env=vm.createContext({window:{TowerCore:C,TowerEncounters:require('../story/tower-encounters.js'),CharacterMotion:{beginAction(model,kind,seconds){motions.push({kind,seconds});}}},escapeHtml:String,localStorage:{getItem:()=>null},G:{running:true,frozen:false,shifting:false},AudioEng:{sfxSwing(){sounds.push('swing');}},playerGroup:{},showToast(){}});
    vm.runInContext(source.replace(/  install\(\);(?=\s*\}\)\(\);\s*$)/,bridge),env);
    let r=C.newRun({seed:22});if(haste){r.bag.haste=1;r=C.useItem(r,'haste').run;}env.window.__hasteTest.set(r);return {api:env.window.__hasteTest,motions,sounds};
  }
  const normal=fixture(false),fast=fixture(true);normal.api.attack();fast.api.attack();close(normal.api.remaining(),.8);close(fast.api.remaining(),.8/1.2);close(fast.motions[0].seconds,.8/1.2);
  normal.api.advance(.68);fast.api.advance(.68);normal.api.attack();fast.api.attack();assert.equal(normal.sounds.length,1);assert.equal(fast.sounds.length,2);close(fast.api.remaining(),.8/1.2);assert.ok(fast.motions.every(m=>m.kind==='attack'&&Math.abs(m.seconds-.8/1.2)<1e-10));
  fast.api.attack();assert.equal(fast.sounds.length,2,'repeated input before the accelerated interval is still blocked');
});
