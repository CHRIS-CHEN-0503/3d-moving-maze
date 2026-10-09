import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
// PARTY_PERF_STORY points the same checks at another copy of story/ (for before/after comparison).
const STORY=process.env.PARTY_PERF_STORY||fileURLToPath(new URL('../story/',import.meta.url));
const require=createRequire(import.meta.url),mod=name=>require(path.join(STORY,name)),source=name=>readFileSync(path.join(STORY,name),'utf8');
const T=require('../lib/three.min.js'),C=mod('story-core.js'),P=mod('tower-party-core.js'),H=mod('tower-heroes-core.js'),R=mod('tower-hero-growth.js'),X=mod('tower-expedition-core.js'),V=mod('tower-characters.js'),N=mod('tower-narrative.js'),F=mod('tower-affixes.js');
const REPORT=!!process.env.PARTY_PERF_REPORT,say=(label,value)=>{if(REPORT)console.log('[perf] '+label+' = '+value);};

// Counts every call made through a module facade, without changing results.
function counted(api,counts,names){const copy={...api};for(const name of names)copy[name]=(...args)=>{counts[name]=(counts[name]||0)+1;return api[name](...args);};return copy;}

function element(registry){
  let html='';const el={hidden:false,id:'',writes:0,dataset:{},style:{},listeners:{},attrs:{},queried:new Map(),
    classes:new Set(),classList:{add:k=>el.classes.add(k),remove:k=>el.classes.delete(k),contains:k=>el.classes.has(k)},
    setAttribute(k,v){el.attrs[k]=String(v);},getAttribute:k=>el.attrs[k]??null,addEventListener(type,fn){(el.listeners[type]||=[]).push(fn);},
    appendChild(child){child.parent=el;if(child.id)registry[child.id]=child;},contains:other=>other===el||other?.parent===el,
    // Children are created on demand and survive until innerHTML is written again, like real DOM nodes.
    querySelector(selector){if(!el.queried.has(selector))el.queried.set(selector,element(registry));return el.queried.get(selector);},querySelectorAll:()=>[],textContent:''};
  Object.defineProperty(el,'innerHTML',{get:()=>html,set(value){html=value;el.writes++;el.queried=new Map();}});
  return el;
}

// A modern party (hero + companions) running the real party, heroes and growth runtimes.
function fixture(options={}){
  const jobs=options.jobs||['swordsman','archer','mage'],floor=options.floor||84,strategy=options.strategy||'attack',counts={},dressed=[],dialogs=[];let nextCell=1;
  let run=H.enable(P.enable(C.newRun({seed:71,name:'隊伍效能'}),options.hero||'chef').run).run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);
  for(const job of jobs){const member={id:'perf:'+job,profession:job,sex:'male',level:2,hp:40,cooldown:0,hurtLeft:0};run.party.members.push(member);run.party.joined.push(member.id);H.addMember(run,member);R.state(run).policies[member.id].strategy=strategy;}
  for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=20;run.bag.arrow=50;run.party.journey.scrap=20;
  const registry={};registry.gameScreen=element(registry);registry.towerLeftHud=element(registry);
  const document={hidden:false,getElementById:id=>options.dom?registry[id]||null:null,createElement:()=>element(registry),addEventListener(){}};
  const HC=counted(H,counts,['followerRecords','stats','hp','actor']),RC=counted(R,counts,['aiChoice']),FC=counted(F,counts,['list']);
  const env=vm.createContext({TowerPartyCore:P,TowerHeroes:HC,TowerHeroGrowth:RC,TowerExpedition:X,TowerCharacters:V,TowerAffixes:FC,TowerHeroIcons:{svg:()=>'<i></i>'},
    TowerHeroVisuals:{dress:(...args)=>{counts.dress=(counts.dress||0)+1;dressed.push(args[1]);},pose(){}},TowerCombatMotion:mod('tower-combat-motion.js'),TowerCombatIntent:mod('tower-combat-intent.js'),MazeCharacterVoices:require('../assets/character-voices.js'),
    CombatAudio:require('../assets/combat-audio.js'),MazeSight:{active:()=>false,visible:()=>true},document,Math});
  for(const file of ['tower-skill-effects','tower-growth-runtime','tower-heroes-runtime','tower-party-runtime'])vm.runInContext(source(file+'.js'),env);
  const world=new T.Group(),player=new T.Group(),G={px:0,pz:0,running:true,shifting:false,heading:0};let paused=false;
  const monsters=[],hits=[],effects={clear:0,camera:0,disposed:[],rays:[]},log={casts:{},hits:0,damage:0};
  const clear=(ax,az,bx,bz)=>{effects.clear++;effects.rays.push([bx,bz]);return !effects.block?.(ax,az,bx,bz);};
  const ctx={THREE:T,G,core:C,text:String,action:(label,key,id)=>'['+label+'|'+key+'|'+id+']',dialog:(...args)=>dialogs.push(args),save(){},toast(){},quest(){},damage(){},bind(){},swing(){},help:undefined,
    audio:{sfxAction(){},sfxHit(){},sfxUse(){},sfxSwing(){},sfxGuardBlock(){},sfxGuardDefeat(){}},dispose:object=>effects.disposed.push(object),
    run:()=>run,paused:()=>paused,inDungeon:()=>!options.outdoors,chooseCell:()=>({cx:nextCell,cy:0,x:nextCell++*4,z:0}),world:()=>world,player:()=>player,monsters:()=>monsters,traders:()=>[],hazards:()=>[],autoAim:()=>false,
    cell:(x,y)=>({x:x*4,z:y*4,cx:x,cy:y}),worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),makeHero:()=>new T.Group(),makeText:()=>new T.Group(),
    camera:options.camera?()=>{effects.camera++;return options.camera;}:undefined,
    clear:(ax,az,bx,bz)=>clear(ax,az,bx,bz),followClear:clear,walkClear:clear,
    transact(result){if(!result.ok)return false;const e=result.effect;if(e?.skill)log.casts[e.skill]=(log.casts[e.skill]||0)+1;if(e?.target==='monster'){log.hits++;log.damage+=e.damage||0;}run=result.run;ui.refreshActors();return true;},
    follow(a,dt,speed,stop,target){if(options.still)return false;const p=a.model.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),step=Math.min(Math.max(0,d-stop),speed*Math.min(dt,.1));if(!step)return false;p.x+=dx/d*step;p.z+=dz/d*step;return true;},
    monsterDefeated(m){hits.push({defeated:m.id});}};
  const ui=env.TowerPartyRuntime.create(ctx);ui.build(()=>.5,new Set());if(options.dom)ui.install();ui.heroes.tick(0);
  const models=world.children.find(o=>o.name==='tower-party-scene').children.filter(o=>o.userData.companionId);
  // Spread companions out of each other's way, beside the hero at the origin.
  models.forEach((m,i)=>m.position.set(-1.5-i*1.4,0,0));
  const enemies=options.enemies||[];
  P.monsterSpecs(run).slice(0,enemies.length).forEach((spec,i)=>{const model=new T.Group(),at=enemies[i];model.position.set(at[0],0,at[1]);monsters.push({...spec,alive:true,windup:0,cooldown:2,model});});
  ui.refreshMonsters();
  const step=(dt=1/60,now=1000)=>ui.tick(dt,now);
  function advance(seconds,fps=60){const dt=1/fps;let t=0;for(let i=0;i<Math.round(seconds*fps);i++){if(options.tickCore)H.tick(run,dt);step(dt,1000+(t+=dt)*1000);}}
  return {ui,log,dialogs,run:()=>run,setRun:value=>run=value,G,world,player,models,monsters,counts,effects,hits,dressed,registry,paused:value=>paused=value,step,advance,heroes:ui.heroes,env,HC,RC,
    actor:id=>H.actor(run,id),own(id,keys){const a=H.actor(run,id);a.skills=[...keys];a.cooldowns=Object.fromEntries(keys.map(k=>[k,0]));}};
}
const skillsOf=(job,keys)=>{for(let seed=1;seed<400;seed++){const draw=H.draft(seed,job,job);if(keys.every(k=>draw.skills.includes(k)))return draw;}throw Error('no draft for '+job);};

// ---------------------------------------------------------------- 1. wantsSkill
test('companions facing an enemy outside their reach no longer run the full AI decision every frame',()=>{
  const f=fixture({jobs:['swordsman','mage','archer'],enemies:[[-3,6.5]],still:true});
  // Every skill is cooling down, so nothing is ever cast and the enemy stays out of reach: pure per-frame cost.
  for(const id of H.ids(f.run()))for(const k of f.actor(id).skills)f.actor(id).cooldowns[k]=300;
  f.advance(2);
  const frames=120,decisions=f.counts.aiChoice||0;say('out-of-reach: aiChoice calls in 2 s (3 companions)',decisions);
  // Only the 0.35 s growth tick may still decide: ~6 ticks per companion, never one per frame.
  assert.ok(decisions<=3*8,'aiChoice ran '+decisions+' times in '+frames+' frames');
});

test('a skill the AI wants still suppresses the basic attack, so attack skills are not starved',()=>{
  const draw=skillsOf('swordsman',['stance_bash']),f=fixture({jobs:['swordsman'],enemies:[[-1.5,.9]],still:true});
  const id='perf:swordsman',a=f.actor(id);a.skills=[...draw.skills];a.cooldowns=Object.fromEntries(a.skills.map(k=>[k,0]));
  R.state(f.run()).policies[id].strategy='attack';f.models[0].position.set(-1.5,0,0);
  let cast=false;
  for(let i=0;i<180&&!cast;i++){f.step(1/60,1000+i*16);cast=Object.values(f.actor(id).cooldowns).some(v=>v>0);}
  say('companion cast its ready attack skill within 3 s',cast);assert.ok(cast,'the companion never cast its ready attack skill');
});

test('wantsSkill answers from a cache until the actor readiness changes, and never when paused, dead or floor-reset',()=>{
  const draw=skillsOf('swordsman',['stance_bash']),f=fixture({jobs:['swordsman'],enemies:[[-1.5,.9]],still:true});
  const id='perf:swordsman',a=f.actor(id);a.skills=[...draw.skills];a.cooldowns=Object.fromEntries(a.skills.map(k=>[k,0]));
  R.state(f.run()).policies[id].strategy='attack';f.models[0].position.set(-1.5,0,0);
  const asks=()=>f.counts.aiChoice||0,wants=()=>f.heroes.wantsSkill(id);
  f.counts.aiChoice=0;const first=wants();assert.equal(first,true,'a ready attack skill in reach is wanted');const base=asks();
  for(let i=0;i<50;i++)assert.equal(wants(),true);assert.equal(asks(),base,'repeated asks with unchanged state must be answered from the cache');
  // Casting spends the cooldown: the cached "yes" must not outlive it.
  const key=a.skills[0];f.actor(id).cooldowns[key]=5;f.actor(id).cooldowns[a.skills[1]]=5;f.actor(id).cooldowns[a.skills[2]]=5;
  assert.equal(wants(),false,'cooldown flipped, so the cache must be re-evaluated');assert.ok(asks()>base);
  const after=asks();for(let i=0;i<20;i++)wants();assert.equal(asks(),after,'the new answer is cached too');
  // Attack recovery is part of readiness: skills that need the weapon are blocked while it runs.
  for(const k of a.skills)f.actor(id).cooldowns[k]=0;assert.equal(wants(),true);f.actor(id).attack=1;const during=asks();wants();assert.ok(asks()>during,'attack recovery changes the answer');f.actor(id).attack=0;
  // Pause, death and floor change are read live or cleared, never served from the cache.
  const stable=asks();f.paused(true);assert.equal(wants(),false);assert.equal(asks(),stable,'paused: no decision at all');f.paused(false);
  assert.equal(wants(),true);H.setHp(f.run(),id,0);const dead=asks();assert.equal(wants(),false);assert.equal(asks(),dead,'dead: no decision');H.setHp(f.run(),id,30);
  assert.equal(wants(),true);const warm=asks();wants();assert.equal(asks(),warm);
  f.run().floor=83;f.heroes.tick(.01);const reset=asks();assert.equal(wants(),true);assert.ok(asks()>reset,'a floor change clears the cache');
});

test('an archer whose basic attack keeps failing is asked about skills once, not every frame',()=>{
  const f=fixture({jobs:['archer'],enemies:[[-1.5,4]],still:true}),id='perf:archer';
  for(const k of f.actor(id).skills)f.actor(id).cooldowns[k]=300;f.run().bag.arrow=0;
  f.advance(2);const decisions=f.counts.aiChoice||0;say('failing basic attack: aiChoice calls in 2 s',decisions);
  // At most two per 0.35 s growth tick: the tick's own choice, then one re-ask keyed on the
  // enemy the basic attack is aimed at (HEAD asked about 125 times).
  assert.ok(decisions<=12,'aiChoice ran '+decisions+' times');
});

// ---------------------------------------------------------------- 3. team adjacency record
test('the saved adjacency record is refreshed a few times a second, and at once when the roster changes',()=>{
  const f=fixture({jobs:['swordsman','archer','mage']});f.models.forEach((m,i)=>m.position.set(-1-i,0,0));f.effects.clear=0;
  for(let i=0;i<60;i++)f.heroes.tick(1/60);
  say('ctx.clear calls from 60 growth ticks (4 members)',f.effects.clear);assert.ok(f.effects.clear<=6*4*3+4,'adjacency ran '+f.effects.clear+' ray tests in 60 frames');
  const nearby=R.state(f.run()).nearby;assert.deepEqual(Object.keys(nearby).sort(),H.ids(f.run()).sort());assert.deepEqual([...nearby.hero].sort(),H.ids(f.run()).sort(),'everyone is within six metres in view');
  // A new member must be known on the very next tick, not up to a refresh later.
  const member={id:'perf:newcomer',profession:'scout',sex:'male',level:1,hp:34,cooldown:0,hurtLeft:0};f.run().party.members.push(member);f.run().party.joined.push(member.id);H.addMember(f.run(),member);
  f.ui.refreshActors();f.heroes.tick(1/60);assert.ok(Object.hasOwn(R.state(f.run()).nearby,member.id));assert.ok(R.state(f.run()).nearby.hero.includes(member.id));
});

// ---------------------------------------------------------------- 2. HUD rebuilds
const barOf=(f,id)=>f.registry[id],buttonOf=(bar,skill)=>bar.queried.get('[data-hero-skill="'+skill+'"]');
test('skill buttons keep their DOM while cooling down: only the ring and the countdown change',()=>{
  const f=fixture({jobs:['swordsman'],dom:true,tickCore:true,hero:'mage'}),hero=f.actor('hero'),key=hero.skills[0];
  f.advance(.5);const bar=barOf(f,'heroSkillBar'),team=barOf(f,'heroTeamBar'),writesBefore=[bar.writes,team.writes];
  assert.ok(bar.writes>=1&&team.writes>=1);assert.match(bar.innerHTML,new RegExp('data-hero-skill="'+key+'"'));assert.match(team.innerHTML,/data-hero-switch="hero"/);assert.match(team.innerHTML,/data-hero-switch="perf:swordsman"/);
  const sample=()=>{const b=buttonOf(bar,key);return b&&{disabled:b.disabled,style:b.attrs.style,text:b.queried.get('small')?.textContent};};
  f.actor('hero').cooldowns[key]=3;f.advance(.4);const mid=sample(),left=f.actor('hero').cooldowns[key];f.advance(3);const end=sample();
  const rebuilds=[bar.writes-writesBefore[0],team.writes-writesBefore[1]];say('3.4 s of cooldown: skill bar rebuilds / team bar rebuilds',rebuilds.join(' / '));
  assert.equal(rebuilds[0],0,'the skill bar must not be rebuilt while a cooldown counts down');assert.equal(rebuilds[1],0,'the team bar has nothing new to show');
  const ring=Number(mid.style.split(':')[1]),exact=left/H.SKILLS[key].cooldown;
  assert.equal(mid.disabled,true,'a cooling skill is disabled');assert.ok(ring>0&&Math.abs(ring-exact)<=.25/H.SKILLS[key].cooldown,'the ring tracks the remaining cooldown');assert.match(mid.text,/^\d秒$/);
  assert.equal(end.disabled,false,'ready again');assert.match(end.style,/--skill-wait:0$/);assert.equal(end.text,'C','the key hint returns');
});
test('the team row redraws only for health, status, level or target changes; the skill row only for a changed skill list',()=>{
  const f=fixture({jobs:['swordsman'],dom:true,tickCore:true,hero:'mage'});f.advance(.5);const bar=barOf(f,'heroSkillBar'),team=barOf(f,'heroTeamBar'),at=()=>[bar.writes,team.writes];
  let was=at();H.setHp(f.run(),'perf:swordsman',10);f.advance(.3);assert.deepEqual([bar.writes-was[0],team.writes-was[1]],[0,1],'health changed: team row only');assert.match(team.innerHTML,/value="10"/);
  was=at();assert.ok(F.apply(f.run(),'perf:swordsman','poison'));f.advance(.3);assert.deepEqual([bar.writes-was[0],team.writes-was[1]],[0,1],'new status: team row only');assert.match(team.innerHTML,/hero-status/);
  was=at();f.advance(1.5);assert.equal(bar.writes-was[0],0);assert.ok(team.writes-was[1]<=2,'a status countdown redraws about once a second, not five times');
  was=at();const order=[...f.actor('hero').skills].reverse(),result=H.reorderSkills(f.run(),'hero',order);assert.ok(result.ok,result.message);f.setRun(result.run);f.advance(.3);
  assert.equal(bar.writes-was[0],1,'a reordered skill list rebuilds the skill row once');assert.ok(bar.innerHTML.indexOf('data-hero-skill="'+order[0]+'"')<bar.innerHTML.indexOf('data-hero-skill="'+order[1]+'"'));
});
test('a preparing skill gets its class and disables the row without rebuilding it',()=>{
  const f=fixture({jobs:['swordsman'],dom:true,tickCore:true,hero:'mage',enemies:[[0,4]]}),hero=f.actor('hero'),skills=skillsOf('mage',['starfall']).skills;hero.skills=[...skills];hero.cooldowns=Object.fromEntries(skills.map(k=>[k,0]));
  f.advance(.4);const bar=barOf(f,'heroSkillBar'),writes=bar.writes;assert.ok(f.heroes.cast('starfall'));f.advance(.2);
  const button=buttonOf(bar,'starfall');assert.equal(button.classes.has('is-preparing'),true);assert.match(button.queried.get('small').textContent,/^準備 /);assert.equal(button.disabled,true);
  f.advance(2);assert.equal(button.classes.has('is-preparing'),false);assert.equal(bar.writes,writes,'preparation and release never rebuild the skill row');
});

// ---------------------------------------------------------------- 5. party runtime per-frame work
test('companions are re-dressed when their equipment changes, not once per companion per frame',()=>{
  const idle=fixture({jobs:['swordsman','archer','mage']});idle.counts.dress=0;idle.advance(1);
  say('dress() calls in 60 idle frames (3 companions, no robot)',idle.counts.dress);assert.equal(idle.counts.dress,0,'idle frames must not touch the equipment visuals');
  // Every state transaction (a strike wears the weapon, equip, repair, ...) refreshes the actors, which dresses them.
  const f=fixture({hero:'swordsman',jobs:['swordsman','archer','mage'],enemies:[[0,1]],still:true});f.counts.dress=0;f.ui.attack();
  assert.ok(f.run().party.health[f.monsters[0].id]!==undefined,'the strike was committed');assert.equal(f.counts.dress,3,'one dress per companion after a state change');
  f.counts.dress=0;f.ui.refreshActors();assert.equal(f.counts.dress,3,'and on an explicit refresh');
});
test('a robot companion is still re-dressed every frame: core wear changes its glow without any transaction',()=>{
  const f=fixture({jobs:['robot','mage']});f.counts.dress=0;f.advance(1);
  const by=id=>f.dressed.filter(model=>model.userData.companionId===id).length;say('dress() calls in 60 frames: robot / mage',by('perf:robot')+' / '+by('perf:mage'));
  assert.ok(by('perf:robot')>=60,'the robot keeps the live check');assert.ok(by('perf:mage')<=2,'the mage is dressed only by a state refresh');
});
test('the floating status text is rebuilt a few times a second while a defeat is still noticed at once',()=>{
  const f=fixture({jobs:['swordsman'],enemies:[[20,20],[22,20],[24,20]],still:true});f.counts.list=0;f.advance(1);
  say('affix list() calls in 60 frames (3 monsters)',f.counts.list);assert.ok(f.counts.list<=3*5,'F.list ran '+f.counts.list+' times');
  // A new status shows up within a quarter second.
  const target=f.monsters[0];assert.ok(F.apply(f.run(),target.id,'burn',{enemy:true}));f.advance(.3);assert.match(target.model.userData.affixText||'',/./,'the label reflects the new status');
  // A defeat is never delayed by the throttle.
  const victim=f.monsters[1],next=structuredClone(f.run());next.defeatedMonsters.push(victim.id);f.setRun(next);f.step(1/60,5000);
  assert.equal(victim.alive,false);assert.equal(victim.model.visible,false);assert.ok(f.hits.some(h=>h.defeated===victim.id),'monsterDefeated fired in the same frame');
});
test('the follower list is built once per frame, not once per monster and companion',()=>{
  const f=fixture({jobs:['swordsman','archer','mage'],enemies:[[30,30],[32,30],[34,30],[36,30],[38,30],[40,30]],still:true});f.counts.followerRecords=0;
  for(let i=0;i<60;i++){f.step(1/60,1000+i*16);for(const m of f.monsters)assert.equal(f.ui.guard(m,1/60),false);}
  const perFrame=f.counts.followerRecords/60;say('followerRecords() calls per frame (6 monsters, 3 companions)',perFrame.toFixed(2));
  assert.ok(perFrame<=2,'followerRecords ran '+perFrame+' times per frame');
});
test('moth wings are looked up once per monster instead of filtering the body every frame',()=>{
  const f=fixture({jobs:['swordsman'],enemies:[[30,30]],still:true}),moth=f.monsters[0];moth.kind='moth';
  const model=f.ui.monsterModel('moth',2);assert.ok(model);moth.model=model;model.position.set(30,0,30);
  const body=model.userData.body;let filters=0;const original=body.children.filter.bind(body.children);body.children.filter=(...args)=>{filters++;return original(...args);};
  f.advance(1);say('body.children.filter calls in 60 frames',filters);assert.ok(filters<=1,'wings were searched '+filters+' times');
  const wings=body.children.filter(()=>true).filter(x=>x.name==='party-wing');assert.equal(wings.length,2);assert.notEqual(wings[0].rotation.z,wings[1].rotation.z,'the two wings still flap in opposite directions');
  assert.ok(wings[0].rotation.z*wings[1].rotation.z<=0);
});
test('a camera that can hide a companion is consulted once per companion per frame, and occlusion still works',()=>{
  const camera={position:new T.Vector3(0,2,6)},f=fixture({jobs:['swordsman','archer'],camera});f.G.px=0;f.G.pz=0;
  f.models[0].position.set(0,0,3);f.models[1].position.set(8,0,3);f.effects.camera=0;f.advance(1);
  const perFrame=f.effects.camera/60;say('camera() calls per frame (2 companions)',perFrame.toFixed(2));assert.ok(perFrame<=2.01,'camera() ran '+perFrame+' times per frame');
  assert.equal(f.models[0].userData.partyOccludes,true,'the companion between the camera and the player fades');assert.equal(f.models[1].userData.partyOccludes,false);
  // A downed companion is still handled, even though the rest of the loop skips it.
  const down=structuredClone(f.run());down.party.loadouts.actors['perf:swordsman'].hp=0;f.setRun(down);f.models[0].userData.partyOccludes=undefined;f.advance(.1);
  assert.equal(f.models[0].userData.partyOccludes,true,'downed companions keep the visibility rule');
});
test('the nearest interaction station is found in one pass and far stations are not ray-tested',()=>{
  const f=fixture({jobs:['swordsman'],outdoors:true,floor:99}),stations=f.ui.reserved();assert.ok(stations.length>=2,'camp and at least one more station');
  const [first,second]=stations;for(const s of stations.slice(2))s.model.visible=false;
  first.x=0;first.z=0;second.x=3;second.z=0;const near=(x,z=0)=>{f.G.px=x;f.G.pz=z;f.advance(.05);return f.ui.nearby;};
  assert.equal(near(1.2),first,'the closer station wins');assert.equal(near(1.8),second);assert.equal(near(1.5),first,'equal distances keep the earlier station');
  f.effects.block=(ax,az,bx)=>bx===0;assert.equal(near(1.2),second,'a walled-off station is skipped for the next nearest');f.effects.block=null;
  second.model.visible=false;assert.equal(near(2.9),null,'a hidden station is ignored (the camp is beyond reach)');assert.equal(near(1.8),first);second.model.visible=true;
  assert.equal(near(50),null);f.effects.rays.length=0;near(50);const tested=f.effects.rays.filter(([x,z])=>stations.some(s=>s.x===x&&s.z===z)).length;say('station ray tests while far from every station (3 frames)',tested);assert.equal(tested,0,'far stations are never ray-tested');
});
test('boss mechanisms look their parts up once and recolour only when the phase changes',()=>{
  const f=fixture({jobs:['swordsman'],outdoors:true,floor:90}),bosses=f.ui.reserved().filter(s=>s.kind==='boss');assert.ok(bosses.length>=2);
  for(const s of f.ui.reserved())s.x=s.z=1e4;f.G.px=-1e3;
  let recolours=0;const colours=[];for(const s of bosses)s.model.traverse(o=>{if(o.isMesh&&o.material?.color){const c=o.material.color,set=c.setHex.bind(c);c.setHex=value=>{recolours++;return set(value);};colours.push(c);}});
  const materials=colours.length;assert.ok(materials>=bosses.length*2);f.advance(1);
  say('boss colour writes in 60 frames ('+materials+' materials)',recolours);assert.ok(recolours<=materials,'colours were written '+recolours+' times for '+materials+' materials');
  const settled=recolours;f.advance(1);assert.equal(recolours,settled,'an unchanged phase writes nothing');
  f.run().party.boss.seals[0]=true;f.advance(.1);assert.ok(recolours>settled,'solving a seal recolours its mechanism');
  const parts=bosses[0].parts;assert.equal(parts.warning.material.color.getHex(),0x83ccac);for(const material of parts.sealMaterials)assert.equal(material.color.getHex(),0x83ccac);
  assert.notEqual(bosses[1].parts.warning.material.color.getHex(),0x83ccac,'the other seal keeps its own colour');
});

// ---------------------------------------------------------------- 6. projectile resources
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function realDispose(){const start=html.indexOf('function disposeSceneObject(root){'),end=html.indexOf('\nlet sceneEpoch=',start);assert.ok(start>0&&end>start);const context=vm.createContext({_texCache:{},spriteCache:{},makePickupMarker:{materials:{}}});vm.runInContext(html.slice(start,end),context);return context.disposeSceneObject;}
function goFloor(f,n){const run=f.run();run.floor=n;run.floorsCleared=99-n;run.chronicle=N.newChronicle(n);P.advance(run);}
const projectiles=world=>{const found=[];world.traverse(o=>{if(/projectile|flying-fist/.test(o.name))found.push(o);});return found;};
const resourcesOf=models=>{const geometries=new Set(),materials=new Set();for(const model of models)model.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});return {geometries,materials};};
test('projectiles borrow one shared kit instead of building geometry and materials per shot',()=>{
  const f=fixture({hero:'archer',jobs:[],enemies:[[0,6]],tickCore:true}),seen={geometries:new Set(),materials:new Set()};f.monsters[0].model.position.set(0,0,40);
  for(let i=0;i<30;i++){assert.ok(f.heroes.shoot(null),'shot '+i);const live=resourcesOf(projectiles(f.world));live.geometries.forEach(g=>seen.geometries.add(g));live.materials.forEach(m=>seen.materials.add(m));f.advance(1.6);}
  say('distinct geometries / materials over 30 arrows',seen.geometries.size+' / '+seen.materials.size);
  assert.ok(seen.geometries.size<=8&&seen.materials.size<=8,'geometries '+seen.geometries.size+', materials '+seen.materials.size);
  for(const resource of [...seen.geometries,...seen.materials])assert.equal(resource.userData.sharedResource,true,'shared resources must be flagged for disposeSceneObject');
  assert.equal(f.effects.disposed.filter(o=>/projectile|flying-fist/.test(o.name)).length,0,'removing a projectile only detaches it');
  assert.equal(projectiles(f.world).length,0,'every arrow was removed from the scene');
});
test('disposing a scene with projectiles in flight leaves the shared kit alone; a runtime reset releases it once',()=>{
  const f=fixture({hero:'archer',jobs:[],tickCore:true}),disposeSceneObject=realDispose();assert.ok(f.heroes.shoot(null));
  const live=projectiles(f.world),{geometries,materials}=resourcesOf(live);let released=0;for(const resource of [...geometries,...materials]){const original=resource.dispose.bind(resource);resource.dispose=()=>{released++;return original();};}
  disposeSceneObject(f.world);assert.equal(released,0,'disposeSceneObject must skip shared projectile resources');
  const before=new Set([...geometries,...materials]);goFloor(f,83);f.heroes.tick(.01);
  assert.equal(released,before.size,'the floor reset releases each shared resource exactly once');assert.equal(projectiles(f.world).length,0);
  f.advance(2.5);assert.ok(f.heroes.shoot(null));const next=resourcesOf(projectiles(f.world));
  for(const g of next.geometries)assert.ok(!before.has(g),'a new kit is built after a release');for(const resource of [...next.geometries,...next.materials])assert.equal(resource.userData.sharedResource,true);
});
test('each projectile type keeps its original look: arrow shaft and tip, light orb with two halos, flying fist with knuckles and cuff',()=>{
  const bow=fixture({hero:'archer',jobs:[],tickCore:true});assert.ok(bow.heroes.shoot(null));const arrow=projectiles(bow.world)[0];
  assert.equal(arrow.name,'elven-arrow-projectile');assert.equal(arrow.children.length,2);assert.equal(arrow.children[0].geometry.type,'CylinderGeometry');assert.equal(arrow.children[1].geometry.type,'ConeGeometry');assert.equal(arrow.children[0].material.color.getHex(),0xead9a7);assert.equal(arrow.children[1].material.color.getHex(),0xc7ded7);
  const mage=fixture({hero:'mage',jobs:[],tickCore:true});assert.ok(mage.heroes.shoot(null));const orb=projectiles(mage.world)[0];
  assert.equal(orb.name,'light-orb-projectile');assert.equal(orb.children.length,3);assert.deepEqual(orb.children.slice(1).map(m=>m.material.opacity),[.32,.1]);assert.ok(orb.children.slice(1).every(m=>m.material.transparent&&!m.material.depthWrite&&m.material.blending===T.AdditiveBlending));assert.deepEqual(orb.children.slice(1).map(m=>m.geometry.parameters.radius),[.23,.34]);
  assert.equal(orb.children[0].material.color.getHex(),0xbcb3ff);
});

// ---------------------------------------------------------------- 7. bug: a paid-for skill projectile must still land
const smithSkills=draw=>{for(let seed=1;seed<3000;seed++){const d=H.draft(seed,'smith','smith');if(draw.every(k=>d.skills.includes(k)))return d.skills;}throw Error('no smith draft');};
test('a skill projectile still hits when its caster starts preparing another skill mid-flight',()=>{
  const f=fixture({hero:'smith',jobs:[],enemies:[[0,6]],tickCore:true});f.own('hero',smithSkills(['weak_pin','barricade']));
  const monster=f.monsters[0],full=P.monsterSpecs(f.run())[0].maxHp;
  assert.ok(f.heroes.cast('weak_pin'),'the first skill is cast and its projectile launched');assert.equal(projectiles(f.world).length,1);assert.ok(H.actor(f.run()).cooldowns.weak_pin>0,'the cast already spent its cooldown');
  assert.ok(f.heroes.cast('barricade'),'a second skill with a preparation time can start while the projectile flies');assert.ok(f.heroes.preparing(),'the caster is now preparing');
  // The core still sees the first cast: the second one was only validated and did not replace the pending hit.
  assert.equal(H.actor(f.run()).pending.id,'weak_pin');
  f.advance(.45);
  const health=f.run().party.health[monster.id];say('monster health after the in-flight projectile (full = '+full+')',health);
  assert.ok(health<full,'the projectile was paid for and must land, got '+health);
});
test('a second attack skill cannot replace the pending hit while the first projectile is in flight',()=>{
  // Documents why only the applyHit guard needed changing: weapon recovery outlasts any skill projectile flight.
  const flight=9.5/16,fastestWeapon=Math.min(...Object.values(H.GEAR).filter(g=>g.slot==='weapon'&&g.interval>0).map(g=>g.interval));
  assert.ok(fastestWeapon>flight,'weapon recovery '+fastestWeapon+'s must outlast a '+flight.toFixed(2)+'s flight');
  const f=fixture({hero:'smith',jobs:[],enemies:[[0,6]],tickCore:true});f.own('hero',smithSkills(['weak_pin','hammer_bash']));
  assert.ok(f.heroes.cast('weak_pin'));assert.ok(!f.heroes.cast('hammer_bash'),'the second attack skill is refused while the weapon recovers');assert.equal(H.actor(f.run()).pending.id,'weak_pin');
});
test('a fresh swing is still ignored while the caster is preparing',()=>{
  const f=fixture({hero:'smith',jobs:[],enemies:[[0,1]],tickCore:true});f.own('hero',smithSkills(['weak_pin','barricade']));const monster=f.monsters[0];
  assert.ok(f.heroes.cast('barricade'));assert.ok(f.heroes.preparing());f.ui.attack();assert.equal(f.run().party.health[monster.id],undefined,'no damage was dealt');
});

// ---------------------------------------------------------------- numbers for the before/after comparison (PARTY_PERF_REPORT=1 only)
test('benchmark: one second of an active fight with a full party',{skip:!REPORT},()=>{
  const timed=(label,run)=>{const rounds=[];for(let i=0;i<5;i++){const start=process.hrtime.bigint();run();rounds.push(Number(process.hrtime.bigint()-start)/1e6);}rounds.sort((a,b)=>a-b);say(label,rounds[2].toFixed(2)+' ms (median of 5)');};
  const scene=(dom)=>{const f=fixture({jobs:['swordsman','archer','mage'],enemies:[[-3,6.5],[-5,7],[2,7],[4,7.5],[-6,6],[6,6]],still:true,tickCore:true,dom,camera:{position:new T.Vector3(0,3,6)}});for(const id of H.ids(f.run()))for(const k of f.actor(id).skills)f.actor(id).cooldowns[k]=300;f.actor('hero').cooldowns[f.actor('hero').skills[0]]=60;return f;};
  const a=scene(false);a.advance(.5);timed('party tick: 60 frames, 3 companions + 6 monsters in view, no DOM',()=>a.advance(1));
  const b=scene(true);b.advance(.5);timed('party tick + HUD: 60 frames with a skill on cooldown',()=>b.advance(1));
  a.counts.aiChoice=0;a.counts.followerRecords=0;a.counts.stats=0;a.counts.hp=0;a.counts.actor=0;a.effects.clear=0;a.advance(1);
  say('one second, 3 companions + 6 monsters: aiChoice / ctx.clear / followerRecords / H.stats / H.hp / H.actor calls',[a.counts.aiChoice,a.effects.clear,a.counts.followerRecords,a.counts.stats,a.counts.hp,a.counts.actor].join(' / '));
  say('DOM innerHTML writes in 3 s (skill bar + team bar)',(()=>{const bar=b.registry.heroSkillBar,team=b.registry.heroTeamBar,start=bar.writes+team.writes;b.advance(3);return bar.writes+team.writes-start;})());
});

test('behaviour check: fights produce the same skills and damage as before',{skip:!REPORT},()=>{
  for(const strategy of ['attack','support','survive'])for(const jobs of [['swordsman','archer','mage'],['scout','healer','smith'],['robot','chef','swordsman']]){
    const f=fixture({jobs,strategy,enemies:[[-2,2.2],[-4,2.4],[-6,2.6],[-3,4],[-5,4.2]],tickCore:true,camera:{position:new T.Vector3(0,3,6)}});
    f.advance(12);const casts=Object.entries(f.log.casts).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'x'+v).join(' ');
    say('12 s fight '+strategy+' '+jobs.join('+')+': hits / damage / defeated / skill casts',f.log.hits+' / '+f.log.damage+' / '+f.monsters.filter(m=>!m.alive).length+' / '+casts);
  }
});

test('a monster stepping out from behind a wall is a new question: the companion opens with its ready skill, not a basic attack',()=>{
  const draw=skillsOf('swordsman',['stance_bash']);
  for(const phase of [0,.1,.2,.3]){
    const f=fixture({jobs:['swordsman'],enemies:[[-1.5,4]],still:true}),id='perf:swordsman',a=f.actor(id);
    a.skills=[...draw.skills];a.cooldowns=Object.fromEntries(a.skills.map(k=>[k,0]));R.state(f.run()).policies[id].strategy='attack';f.models[0].position.set(-1.5,0,0);
    // A wall hides the monster while the growth tick runs and stores its answer.
    f.effects.block=()=>true;f.advance(.4+phase);assert.equal(Object.values(a.cooldowns).some(v=>v>0),false,'nothing to see yet');
    // It turns the corner straight into reach.
    f.effects.block=null;f.monsters[0].model.position.set(-1.5,0,1);
    assert.equal(f.heroes.wantsSkill(id,f.monsters[0]),true,'phase '+phase+': the visible enemy in skill range is asked about afresh');
    let skill=false,basic=false;for(let i=0;i<60&&!skill;i++){f.step(1/60,2000+i*16);skill=Object.values(f.actor(id).cooldowns).some(v=>v>0);if(!skill&&f.actor(id).attack>0)basic=true;}
    assert.equal(skill,true,'phase '+phase+': the skill is cast within one second');assert.equal(basic,false,'phase '+phase+': no basic attack comes first');
  }
});
test('each team card shows experience toward the next level as a plain bar (percent read aloud only), redrawing only when it changes',()=>{
  const f=fixture({jobs:['swordsman'],dom:true,tickCore:true,hero:'mage'});f.advance(.5);const team=barOf(f,'heroTeamBar'),G=require('../story/tower-hero-growth.js');
  const level=H.level(f.run(),'hero'),span=G.XP[level]-G.XP[level-1];H.gainXp(f.run(),G.XP[level-1]+Math.round(span*.45)-H.state(f.run()).xp);f.advance(.3);
  const percent=Math.floor(H.xpProgress(f.run(),'hero')*100);assert.ok(percent>=44&&percent<=45,String(percent));
  assert.equal((team.innerHTML.match(/class="hero-xp"/g)||[]).length,H.ids(f.run()).length,'one bar per card');assert.match(team.innerHTML,new RegExp('<span class="hero-xp" aria-hidden="true"><i style="width:'+percent+'%"></i></span>'),'a plain bar, no visible text');assert.doesNotMatch(team.innerHTML,/<b>經驗/);
  assert.match(team.innerHTML,new RegExp('aria-label="[^"]*經驗 '+percent+'%'),'the percent is read out with the card');
  const writes=team.writes;f.advance(1);assert.equal(team.writes,writes,'no redraw while the percent stays the same');
  H.gainXp(f.run(),Math.ceil(span*.02));f.advance(.3);assert.equal(team.writes,writes+1,'one redraw when it changes');
});
test('a real level up in play lights the leveled members and flashes their cards, but a new floor does not',()=>{
  const f=fixture({jobs:['swordsman'],dom:true,tickCore:true,hero:'mage'});f.advance(.5);const team=barOf(f,'heroTeamBar'),G=require('../story/tower-hero-growth.js');
  const vfx=()=>{let n=0;f.world.traverse(o=>{if(o.name==='skill-vfx-level-up')n++;});return n;};assert.equal(vfx(),0,'no celebration when the floor starts');
  const level=H.level(f.run(),'hero'),before=H.ids(f.run()).map(id=>H.level(f.run(),id));H.gainXp(f.run(),G.XP[level]-H.state(f.run()).xp);f.advance(.3);
  const risen=H.ids(f.run()).filter((id,i)=>H.level(f.run(),id)>before[i]).length;assert.ok(risen>=1);assert.equal(vfx(),risen,'one column of light per member who levelled');
  assert.equal((team.innerHTML.match(/just-leveled/g)||[]).length,risen);f.advance(2.2);assert.equal(vfx(),0,'the light ends');
  const next=structuredClone(f.run());next.floor-=1;next.floorsCleared+=1;H.gainXp(next,G.XP[H.level(next,'hero')]-H.state(next).xp);f.setRun(next);f.advance(.2);assert.equal(vfx(),0,'a different floor only re-baselines');
});
