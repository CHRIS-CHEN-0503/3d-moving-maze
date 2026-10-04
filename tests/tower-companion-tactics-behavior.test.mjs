import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {provisionTravellers} from './recruit-fixtures.mjs';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),R=require('../story/tower-hero-growth.js'),F=require('../story/tower-affixes.js'),N=require('../story/tower-narrative.js'),T=require('../lib/three.min.js');
function fresh(job,skills=[]){for(let seed=1;seed<300;seed++)if(skills.every(s=>H.draft(seed,job,'hero').skills.includes(s)))return H.enable(P.enable(C.newRun({seed,name:'戰術測試'}),job).run).run;throw Error('missing hero draft');}
function floor(run,n){run.floor=n;run.floorsCleared=99-n;run.chronicle=N.newChronicle(n);P.advance(run);return run;}
function only(run,id,skills){for(const key of H.actor(run,id).skills)H.actor(run,id).cooldowns[key]=skills.includes(key)?0:300;}
function durableSnapshot(run){const snapshot=structuredClone(run);delete snapshot.party.loadouts.growth.nearby;return JSON.stringify(snapshot);}
function companion(job,skills=[]){
  for(let seed=1;seed<300;seed++)for(const n of [99,97,95,93,91,89,87,85]){
    let run=floor(H.enable(P.enable(C.newRun({seed,name:'同行戰術'}),'chef').run).run,n),offer=P.recruitOffer(run);
    if(offer?.profession!==job||!skills.every(s=>H.draft(seed,job,job).skills.includes(s)))continue;
    provisionTravellers(run);run.coins=1000;const recruited=P.recruit(run,offer.id);assert.ok(recruited.ok,recruited.message);return {run:floor(recruited.run,84),id:offer.id};
  }throw Error('missing companion draft '+job);
}
test('AI skips unreachable first skill and uses an owned ranged candidate without mutating the save',()=>{
  const run=floor(fresh('mage',['thunder_wave','arcane_bolt']),84),a=H.actor(run);a.skills.sort((x,y)=>Number(y==='thunder_wave')-Number(x==='thunder_wave'));only(run,'hero',['thunder_wave','arcane_bolt']);R.state(run).policies.hero.strategy='attack';const enemy=P.monsterSpecs(run)[0],before=JSON.stringify(run);
  assert.equal(R.aiChoice(run,'hero',['hero'],true,{enemy:{id:enemy.id,distance:6,windup:0}}).skill,'arcane_bolt');assert.equal(JSON.stringify(run),before);assert.ok(C.validateSave(run));
  assert.equal(R.aiChoice(run,'hero',['hero'],true,{enemy:{id:enemy.id,distance:20,windup:1}}),null);
});
test('support and survival cleanse a genuinely afflicted nearby ally, never a healthy or downed target',()=>{
  let run=fresh('healer',['cleanse']);provisionTravellers(run);run.coins=1000;run=P.recruit(run,P.recruitOffer(run).id).run;const id=run.party.members[0].id;only(run,'hero',['cleanse']);
  for(const strategy of ['support','survive']){H.tick(run,3.1);H.actor(run).cooldowns.cleanse=0;R.state(run).policies.hero.strategy=strategy;assert.equal(R.aiChoice(run,'hero',H.ids(run),true),null);assert.ok(F.apply(run,id,'poison'));const choice=R.aiChoice(run,'hero',H.ids(run),false);assert.equal(choice.skill,'cleanse');assert.equal(choice.target,id);assert.equal(R.aiChoice(run,'hero',['hero'],true),null);const result=H.cast(run,choice.skill,{targetId:choice.target,nearby:H.ids(run)});assert.ok(result.ok,result.message);run=result.run;assert.equal(F.list(run,id).length,0);H.actor(run).cooldowns.cleanse=0;}
  F.apply(run,id,'slow');H.setHp(run,id,0);assert.equal(R.aiChoice(run,'hero',H.ids(run),true),null);assert.ok(C.validateSave(run));
});
test('AI uses interruption during a readable attack and avoids repeating stun, slow, marks and roots',()=>{
  const stun=floor(fresh('swordsman',['wind_slash','stance_bash']),84),m=P.monsterSpecs(stun)[0];only(stun,'hero',['wind_slash','stance_bash']);R.state(stun).policies.hero.strategy='attack';H.actor(stun).skills.sort((x,y)=>Number(y==='wind_slash')-Number(x==='wind_slash'));
  assert.equal(R.aiChoice(stun,'hero',['hero'],true,{enemy:{id:m.id,distance:2,windup:1}}).skill,'stance_bash');stun.monsterStuns[m.id]=1;assert.equal(R.aiChoice(stun,'hero',['hero'],true,{enemy:{id:m.id,distance:2,windup:1}}).skill,'wind_slash');
  for(const [job,skill,state] of [['scout','throw_blade','slow'],['smith','weak_pin','mark'],['mage','thorn_growth','root']]){const run=floor(fresh(job,[skill]),84),enemy=P.monsterSpecs(run)[0];only(run,'hero',[skill]);R.state(run).policies.hero.strategy='attack';H.state(run).enemy[enemy.id]={[state]:3};assert.equal(R.aiChoice(run,'hero',['hero'],true,{enemy:{id:enemy.id,distance:2,windup:0}}),null,skill);}
  const root=floor(fresh('mage',['thorn_growth']),84);only(root,'hero',['thorn_growth']);R.state(root).policies.hero.strategy='attack';assert.equal(R.aiChoice(root,'hero',['hero'],true,{enemy:{id:P.monsterSpecs(root)[0].id,distance:4,stationary:true}}),null);
});
test('support shields an exposed ally before a healthy protected caster and still respects material permission',()=>{
  let run=fresh('mage',['barrier']);provisionTravellers(run);run.coins=1000;run=P.recruit(run,P.recruitOffer(run).id).run;const id=run.party.members[0].id;only(run,'hero',['barrier']);R.state(run).policies.hero.strategy='support';const choice=R.aiChoice(run,'hero',H.ids(run),true,{threatened:[id]});assert.equal(choice.skill,'barrier');assert.equal(choice.target,id);H.setBuff(run,id,'barrier',300,10);assert.equal(R.aiChoice(run,'hero',H.ids(run),true,{threatened:[id]}),null,'do not shield an unthreatened healthy caster');
  const healer=fresh('healer',['herbal_heal']);only(healer,'hero',['herbal_heal']);H.setHp(healer,'hero',1);R.state(healer).policies.hero.strategy='support';assert.equal(R.aiChoice(healer,'hero',['hero'],true),null);R.state(healer).policies.hero.materials=true;assert.equal(R.aiChoice(healer,'hero',['hero'],true).skill,'herbal_heal');
});
function runtime(job,skills){
  const initial=companion(job,skills);let run=initial.run,paused=false,hidden=new Set(),blocked=new Set(),accept=true;const id=initial.id,world=new T.Group(),player=new T.Group(),actors=[{id,model:new T.Group()}],hits=[];
  const monsters=P.monsterSpecs(run).map((s,i)=>({...s,alive:true,windup:0,model:new T.Group()}));monsters.forEach((m,i)=>m.model.position.set(30+i,0,30));only(run,id,skills);R.state(run).policies[id].strategy='attack';
  const env=vm.createContext({TowerHeroes:H,TowerHeroGrowth:R,TowerPartyCore:P,TowerHeroIcons:{svg:()=>''},TowerCombatMotion:require('../story/tower-combat-motion.js'),TowerCombatIntent:require('../story/tower-combat-intent.js'),MazeCharacterVoices:require('../assets/character-voices.js'),MazeSight:{active:()=>true,visible:(x,z)=>!monsters.some(m=>hidden.has(m.id)&&m.model.position.x===x&&m.model.position.z===z)},document:{getElementById:()=>null},Math});
  for(const file of ['tower-skill-effects','tower-growth-runtime','tower-heroes-runtime'])vm.runInContext(readFileSync(new URL('../story/'+file+'.js',import.meta.url),'utf8'),env);
  const G={px:-4,pz:0,running:true,shifting:false,heading:.4},ctx={THREE:T,G,run:()=>run,core:C,world:()=>world,player:()=>player,actors:()=>actors,monsters:()=>monsters,hazards:()=>[],paused:()=>paused,autoAim:()=>false,text:String,action:()=>'',portrait:()=>'',audio:{sfxAction(){}},toast(){},save(){},dispose(){},clear:(x,z,bx,bz)=>!monsters.some(m=>blocked.has(m.id)&&m.model.position.x===bx&&m.model.position.z===bz),walkClear:()=>true,cell:(x,y)=>({x,z:y}),worldToCell:(x,z)=>({x,y:z}),
    transact(result){if(!accept||!result.ok)return false;run=result.run;return true;},hit(m,who,skill,shot){const result=H.strike(run,m.id,{memberId:who,skillId:skill,shot});if(result.ok){run=result.run;hits.push({id:m.id,skill,result:result.effect});if(result.effect.stunned)m.windup=0;if(result.effect.dead)m.alive=false;}return result;}};
  const ui=env.TowerHeroesRuntime.create(ctx);ui.tick(0);return {ui,id,actors,monsters,hits,G,hidden,blocked,get run(){return run;},control(){const result=H.switchActor(run,id);assert.ok(result.ok);run=result.run;},pause:value=>paused=value,accept:value=>accept=value};
}
test('companion actually interrupts its selected charging enemy instead of the nearer calm monster',()=>{
  const h=runtime('swordsman',['wind_slash','stance_bash']),near=h.monsters[0],charging=h.monsters[1];near.model.position.set(0,0,1.1);charging.model.position.set(.8,0,2);charging.windup=1.1;h.ui.tick(.36);assert.equal(h.hits.length,1);assert.equal(h.hits[0].id,charging.id);assert.equal(h.hits[0].skill,'stance_bash');assert.equal(charging.windup,0);assert.equal(h.G.heading,.4);assert.ok(C.validateSave(h.run));
});
test('AI ignores hidden/walled charging enemies and preserves manual controlled-actor facing',()=>{
  const h=runtime('swordsman',['stance_bash']),hidden=h.monsters[0],walled=h.monsters[1],valid=h.monsters[2];hidden.model.position.set(0,0,1);walled.model.position.set(.5,0,1);valid.model.position.set(0,0,2);hidden.windup=walled.windup=1;h.hidden.add(hidden.id);h.blocked.add(walled.id);h.ui.tick(.36);assert.equal(h.hits.length,1);assert.ok(h.hits.every(hit=>hit.id===valid.id));assert.equal(h.G.heading,.4);
});
test('prepared companion ground spell keeps the chosen landing point when a nearer monster arrives',()=>{
  const h=runtime('mage',['starfall']),target=h.monsters[1],near=h.monsters[0];target.model.position.set(0,0,6);target.windup=2;h.ui.tick(.36);const preparation=h.ui.preparing(h.id);assert.equal(preparation.enemyId,target.id);assert.equal(preparation.at.z,6);near.model.position.set(0,0,1);h.ui.tick(1.21);assert.ok(h.hits.some(hit=>hit.id===target.id));assert.ok(!h.hits.some(hit=>hit.id===near.id),'landing area must not jump to the new nearest enemy');assert.ok(C.validateSave(h.run));
});
test('lost, hidden, walled, out-of-range or newly controlled AI targets cancel preparation without spending',()=>{
  for(const change of [h=>h.monsters[0].alive=false,h=>h.hidden.add(h.monsters[0].id),h=>h.blocked.add(h.monsters[0].id),h=>h.monsters[0].model.position.z=20,h=>h.control()]){
    const h=runtime('mage',['starfall']),target=h.monsters[0];target.model.position.set(0,0,2);h.ui.tick(.36);assert.ok(h.ui.preparing(h.id));change(h);const before=durableSnapshot(h.run),paused=JSON.stringify(h.run);h.pause(true);h.ui.tick(.2);assert.equal(JSON.stringify(h.run),paused);h.pause(false);h.ui.tick(1.21);assert.equal(h.ui.preparing(h.id),null);assert.equal(h.hits.length,0);assert.equal(durableSnapshot(h.run),before);assert.ok(C.validateSave(h.run));
  }
});
test('failed save does not turn a companion decision into paid cooldown or attack damage',()=>{const h=runtime('mage',['starfall']);h.monsters[0].model.position.set(0,0,2);h.ui.tick(.36);h.accept(false);const before=JSON.stringify(h.run);h.ui.tick(1.21);assert.equal(JSON.stringify(h.run),before);assert.equal(h.hits.length,0);});
