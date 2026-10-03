import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {provisionTravellers} from './recruit-fixtures.mjs';
const require=createRequire(import.meta.url),A=require('../assets/combat-audio.js'),H=require('../story/tower-heroes-core.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),R=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),T=require('../lib/three.min.js');
const code=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('all 72 surface and underground active skills map to bounded audio; sound families are distinct',()=>{
  assert.equal(Object.keys(H.SKILLS).length,72);
  for(const s of Object.values(H.SKILLS)){assert.ok(A.SKILL_SOUNDS[s.effect],s.id);assert.ok(A.ACTIONS[A.skillKind(s)],s.id);}
  for(const id of R.itemIds)assert.ok(A.ACTIONS[A.itemKind(id)],id);
  const waves=[];
  for(const kind of Object.keys(A.ACTIONS)){
    const data=A.render(kind);assert.deepEqual(data,A.render(kind));
    assert.equal(data[0],0);assert.equal(data.at(-1),0);assert.ok(data.length<=A.RATE*.81);
    let sum=0;for(const v of data){assert.ok(Number.isFinite(v)&&Math.abs(v)<.73);sum+=v*v;}
    assert.ok(Math.sqrt(sum/data.length)>.035,kind);waves.push(Buffer.from(data.buffer).toString('base64'));
  }
  assert.equal(new Set(waves).size,waves.length);
  assert.equal(A.hitKind(H.GEAR.arcane_staff),'hit-magic');assert.equal(A.hitKind(H.GEAR.cooking_pan),'hit-metal');
});
test('area hits are rate-limited, four voices maximum, buffers reused, reset permits the next hit',()=>{
  let count=0;const sources=[],context={currentTime:1,createBuffer(c,n){count++;return {getChannelData:()=>new Float32Array(n)};},createBufferSource(){const s={connect(){},start(){},stop(){},disconnect(){this.done=true;}};sources.push(s);return s;}};
  const player=A.create(context,{});
  for(let i=0;i<10;i++)player.play('hit-metal');assert.equal(sources.length,1);
  context.currentTime+=.07;player.play('hit-metal');assert.equal(count,1);
  for(const kind of ['magic','heal','forge','cook','burst'])player.play(kind);
  assert.equal(sources.filter(s=>!s.done).length,4);
  player.stop();player.play('hit-metal');assert.equal(sources.filter(s=>!s.done).length,1);player.stop();
});

function fixture(skill,options={}){
  let run;
  for(let seed=1;seed<500;seed++){
    run=H.enable(P.enable(C.newRun({seed}),skill.job,options.sex||'male').run).run;
    if(skill.ascension){
      H.gainXp(run,R.XP[8]);run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);run.chronicle.ending='release';P.advance(run,{reward:false});
      run=C.startUnderworld(run).run;H.gainXp(run,100000);const result=R.chooseUltimate(run,'hero',skill.ascension.base);assert.ok(result.ok);run=result.run;break;
    }
    if(skill.unique)H.gainXp(run,28100);
    if(H.actor(run).skills.includes(skill.id))break;
  }
  assert.ok(H.actor(run).skills.includes(skill.id),skill.id);
  let target='hero',actors=[];
  if(skill.effect==='revive'){
    run.coins=9999;
    if(C.isUnderworld(run))for(let floor=-1;floor>=-50;floor--){run.floor=floor;run.floorsCleared=99+(-floor-1);P.advance(run,{reward:false});if(P.recruitOffer(run))break;}
    provisionTravellers(run);run=P.recruit(run,P.recruitOffer(run).id).run;target=run.party.members[0].id;H.setHp(run,target,0);
    const model=new T.Group();model.position.set(1,0,0);actors=[{id:target,model}];
  }
  run.hunger=10;H.setHp(run,'hero',10);run.equipment.weapon.durability--;
  for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=30;run.party.journey.scrap=30;
  const sounds=[],voiceCalls=[],world=new T.Group(),player=new T.Group(),m={...P.monsterSpecs(run)[0],alive:true,model:new T.Group()};m.model.position.set(0,0,1.5);
  const trap={x:0,z:1,id:'test-trap',model:new T.Group()},g={running:true,shifting:false,px:0,pz:0};let runtime,paused=false,blocked=false,hits=0;
  let voiceEnabled=false,speaking=false;const voice={status:()=>({enabled:voiceEnabled,supported:true,speaking}),announceAsset:id=>voiceCalls.push(id)};
  const env=vm.createContext({TowerHeroes:H,TowerAffixes:require('../story/tower-affixes.js'),TowerPartyCore:P,TowerHeroGrowth:R,GameVoice:voice,TowerHeroIcons:{svg:()=>''},TowerCombatMotion:require('../story/tower-combat-motion.js'),CombatAudio:A,document:{getElementById:()=>null},Math});
  for(const file of ['assets/character-voices.js','story/tower-combat-intent.js','story/tower-skill-effects.js','story/tower-growth-runtime.js','story/tower-heroes-runtime.js'])vm.runInContext(code(file),env);
  const ctx={THREE:T,G:g,core:C,run:()=>run,world:()=>world,player:()=>player,actors:()=>actors,monsters:()=>[m],hazards:()=>[trap],paused:()=>paused,text:s=>s,action:()=>'',portrait:()=>'',clear:()=>!blocked,walkClear:()=>true,
    audio:{sfxAction:k=>{sounds.push(k);},sfxHit(){}},toast(message,ms,read=true){if(voiceEnabled&&read)speaking=true;},save(){},swing(){},close(){},dialog(){},dispose(){},
    cell:(x,y)=>({x,z:y}),worldToCell:(x,z)=>({x:Math.floor(x),y:Math.floor(z)}),
    transact(result){if(!result.ok)return false;run=result.run;return true;},
    hit(enemy,memberId,skillId){const res=H.strike(run,enemy.id,{memberId,skillId},run.revision);if(res.ok){run=res.run;hits++;runtime.impact(enemy,memberId||H.state(run).active,skillId);if(res.effect.dead)enemy.alive=false;}return res;}
  };
  runtime=env.TowerHeroesRuntime.create(ctx);runtime.tick(0);
  return {runtime,monster:m,sounds,voiceCalls,enableVoice:()=>{voiceEnabled=true;},world,g,target,trap,motion:()=>player.userData.combatMotion,run:()=>run,hits:()=>hits,block:v=>blocked=v,pause:v=>paused=v};
}
test('electric ailment stops barricade attacks until it expires',()=>{
  const f=fixture(H.SKILLS.barricade);assert.ok(f.runtime.cast('barricade'));for(let i=0;i<15;i++)f.runtime.tick(.1);f.monster.model.position.set(0,0,1.1);f.monster.def={...f.monster.def,damage:10000};const F=require('../story/tower-affixes.js');F.apply(f.run(),f.monster.id,'shock',{enemy:true});
  assert.equal(f.runtime.blocker(f.monster,.1),true);assert.equal(f.runtime.blocker(f.monster,.1),true,'stunned strikes cannot destroy the barricade');F.state(f.run()).enemies[f.monster.id]=[];assert.equal(f.runtime.blocker(f.monster,.1),true);assert.equal(f.runtime.blocker(f.monster,.1),false,'unstunned real strike destroys the barrier');f.runtime.reset();
});
test('every successful active skill emits action audio and geometry; failed repeat casts stay silent',()=>{
  for(const s of Object.values(H.SKILLS)){
    const f=fixture(s);assert.equal(f.runtime.cast(s.id,f.target),true,s.id);
    assert.ok(f.sounds.includes(H.preparationSeconds(s.id)?'charge':A.skillKind(s)),s.id);
    assert.equal(f.motion().action,H.preparationSeconds(s.id)||s.effect==='disarm'?'charge':'skill',s.id);
    assert.equal(f.motion().family,s.presentation?.motion||require('../story/tower-combat-motion.js').FAMILIES[s.effect],s.id);
    assert.ok(f.runtime.effectStats().groups>0,s.id);assert.ok(C.validateSave(f.run()),s.id);
    const before=f.sounds.length;f.runtime.cast(s.id,f.target);assert.equal(f.sounds.length,before,s.id+' failed cast');
    f.runtime.reset();assert.equal(f.runtime.effectStats().groups,0);
  }
});
test('projectile impact is emitted only on a confirmed hit, never when occluded; pause freezes the pending hit',()=>{
  for(const blocked of [false,true]){
    const f=fixture(H.SKILLS.arcane_bolt);f.runtime.cast('arcane_bolt','hero');f.block(blocked);
    f.pause(true);f.runtime.tick(.3);assert.equal(f.hits(),0);f.pause(false);f.runtime.tick(.3);
    assert.equal(f.hits(),blocked?0:1);assert.equal(f.sounds.includes('hit-magic'),!blocked);
    f.runtime.reset();
  }
});
test('every approved ordinary or awakened preparation is 0.3 seconds shorter, defers costs, and freezes while paused',()=>{
  const expected={starfall:1.2,star_ring:1.6,decisive_slash:1,whirlwind:.5,dawn_sanctuary:1,revive:1.2,moving_fortress:.8,barricade:.7,hero_feast:1,worldtree_arrow:1.2,iron_charge:.8,shoulder_quake:.8,steel_meteor_fist:1.2};
  assert.deepEqual(H.PREPARATION,expected);
  for(const [id,seconds] of Object.entries(expected)){
    const f=fixture(H.SKILLS[id]),before=JSON.stringify(f.run());
    assert.equal(f.runtime.cast(id,f.target),true,id);assert.equal(JSON.stringify(f.run()),before,id+' no early transaction');
    assert.equal(f.runtime.preparing().total,seconds);assert.ok(f.runtime.wantsSkill('hero'));
    f.pause(true);f.runtime.tick(5);assert.equal(f.runtime.preparing().left,seconds);f.pause(false);
    f.runtime.tick(seconds-.01);assert.equal(H.actor(f.run()).cooldowns[id],0,id);assert.equal(f.hits(),0);
    f.runtime.tick(.02);assert.equal(f.runtime.preparing(),null);assert.ok(H.actor(f.run()).cooldowns[id]>0,id);assert.ok(C.validateSave(f.run()),id);
    if(['worldtree_arrow','steel_meteor_fist','iron_charge'].includes(id)){assert.equal(f.hits(),0);f.runtime.tick(.2);}
    if(H.SKILLS[id].attack)assert.equal(f.hits(),1,id);
    if(id==='daylight')assert.equal(f.run().party.light.daylight,600);
    if(id==='revive')assert.ok(H.hp(f.run(),f.target)>0);
    if(id==='barricade')assert.ok(f.runtime.blocker({model:{position:{x:0,z:1.1}},def:{}},0));
    f.runtime.reset();
  }
  assert.equal(H.preparationSeconds('arcane_bolt'),0);
});
test('preparation cancellation and release validation never grant effects or spend materials',()=>{
  for(const reason of ['reset','shift','death','materials']){
    const f=fixture(H.SKILLS.moving_fortress);f.runtime.cast('moving_fortress','hero');
    if(reason==='reset')f.runtime.reset();if(reason==='shift')f.g.shifting=true;if(reason==='death'){H.setHp(f.run(),'hero',0);f.run().status='dead';}if(reason==='materials')f.run().party.ingredients.shell=0;
    f.runtime.tick(2);assert.equal(f.runtime.preparing(),null);assert.equal(H.actor(f.run()).cooldowns.moving_fortress,0);assert.equal(f.run().party.journey.scrap,30);assert.ok(C.validateSave(f.run()),reason);f.runtime.reset();
  }
});
test('disarm work is 0.3 seconds shorter at every tier and remains interruptible',()=>{
  assert.deepEqual(H.SKILLS.disarm.power,[3.2,2.8,2.4,2,1.6,1.2]);
  const f=fixture(H.SKILLS.disarm);f.runtime.cast('disarm','hero');assert.equal(f.runtime.preparing().total,3.2);
  f.runtime.tick(3.19);assert.equal(f.trap.heroRemoved,undefined);f.runtime.tick(.02);assert.equal(f.trap.heroRemoved,true);f.runtime.reset();
  const g=fixture(H.SKILLS.disarm);g.runtime.cast('disarm','hero');H.actor(g.run()).hurt=1;g.runtime.tick(.1);assert.equal(g.runtime.preparing(),null);assert.equal(g.trap.heroRemoved,undefined);g.runtime.reset();
});
test('all underground preparations also shorten exactly 0.3 and canonical skill metadata matches execution',()=>{
  const catalog=require('../story/tower-ascension-catalog.js');assert.equal(H.PREPARATION_REDUCTION,.3);
  for(const s of Object.values(H.SKILLS)){assert.equal(s.preparation,H.preparationSeconds(s.id),s.id);assert.ok(s.preparation>=0,s.id);if(s.preparation)assert.ok(s.description.endsWith('準備 '+s.preparation+' 秒後生效。'),s.id);}
  for(const s of catalog.actives){const seconds=Math.max(0,Math.round(((s.preparation||0)-.3)*10)/10);assert.equal(H.preparationSeconds(s.id),seconds,s.id);if(!seconds)continue;const f=fixture(H.SKILLS[s.id]),before=JSON.stringify(f.run());assert.equal(f.runtime.cast(s.id,f.target),true,s.id);assert.equal(f.runtime.preparing().total,seconds);assert.equal(JSON.stringify(f.run()),before);f.runtime.tick(seconds-.01);assert.equal(H.actor(f.run()).cooldowns[s.id],0);f.runtime.tick(.02);assert.equal(f.runtime.preparing(),null);assert.ok(H.actor(f.run()).cooldowns[s.id]>0);assert.ok(C.validateSave(f.run()));f.runtime.reset();}
  for(const id of ['arcane_bolt','flying_fist','parts_restore','mech_aid','not-a-skill'])assert.equal(H.preparationSeconds(id),0);
});
test('successful guard, healing and completed disarm play the acting gender specialty, not generic overlapping narration',()=>{
  for(const sex of ['male','female'])for(const skill of ['guard_stance','herbal_heal','disarm']){
    const f=fixture(H.SKILLS[skill],{sex});H.setHp(f.run(),'hero',H.maxHp(f.run())*.5);f.enableVoice();f.runtime.cast(skill,'hero');if(skill==='disarm')f.runtime.tick(3.51);
    assert.deepEqual(f.voiceCalls,['character.'+H.SKILLS[skill].job+'.'+sex+'.specialty'],sex+' '+skill);f.runtime.reset();
  }
  for(const sex of ['male','female'])for(const job of ['mage','archer']){
    const f=fixture(H.SKILLS[job==='mage'?'arcane_bolt':'piercing_arrow'],{sex});H.setHp(f.run(),'hero',H.maxHp(f.run())*.5);f.enableVoice();assert.equal(job==='mage'?f.runtime.daylight():f.runtime.shoot(),true);assert.equal(f.voiceCalls.length,1);assert.ok(['character.'+job+'.'+sex+'.specialty',...(job==='mage'?['character.mage.'+sex+'.specialty.hope']:[])].includes(f.voiceCalls[0]));f.runtime.reset();
  }
});
test('equipment descriptions show the selected wearer clothing variant without changing stats or durability',()=>{
  for(const sex of ['male','female']){const f=fixture(H.SKILLS.guard_stance,{sex}),r=f.run(),before=JSON.stringify(r),fit=sex==='female'?'女裝版型':'男裝版型';for(const slot of ['helmet','armor'])assert.ok(f.runtime.info(r.equipment[slot],'hero').startsWith(fit));assert.doesNotMatch(f.runtime.info(r.equipment.weapon,'hero'),/男裝|女裝/);assert.equal(JSON.stringify(f.run()),before);f.runtime.reset();}
});
test('charge waveforms and visual duration match every approved preparation',()=>{
  for(const seconds of Object.values(H.PREPARATION)){const wave=A.render('charge',seconds);assert.equal(wave.length,Math.round(A.RATE*seconds));assert.equal(wave.at(-1),0);assert.ok(wave.every(v=>Number.isFinite(v)&&Math.abs(v)<.73));}
  const env=vm.createContext({}),world=new T.Group();vm.runInContext(code('story/tower-skill-effects.js'),env);const fx=env.TowerSkillEffects.create(T,{world:()=>world});
  const effect=fx.emit(H.SKILLS.star_ring,{x:0,z:0},0,{stage:'charge',duration:1.9});assert.equal(effect.total,1.9);fx.tick(1.89);assert.equal(fx.stats().groups,1);fx.tick(.02);assert.equal(fx.stats().groups,0);
});
test('impact geometry obeys visibility and cleans up both short bursts and charge glows',()=>{
  let visible=false;const world=new T.Group(),env=vm.createContext({});vm.runInContext(code('story/tower-skill-effects.js'),env);
  const fx=env.TowerSkillEffects.create(T,{world:()=>world,visible:()=>visible,limit:4});
  assert.equal(fx.emit(H.SKILLS.wind_slash,{x:0,z:0},0,{impact:true}),null);
  visible=true;const hit=fx.emit(H.SKILLS.wind_slash,{x:0,z:0},0,{impact:true});assert.equal(hit.family,'hit');assert.ok(hit.parts.some(p=>p.base.y>=1));
  visible=false;fx.tick(.05);assert.equal(hit.group.visible,false);visible=true;fx.tick(.05);assert.equal(hit.group.visible,true);
  fx.tick(.4);assert.equal(fx.stats().groups,0);fx.emit(H.SKILLS.starfall,{x:0,z:0},0,{stage:'charge'});fx.reset();assert.equal(world.children.length,0);
});
