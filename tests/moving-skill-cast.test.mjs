import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {add, ownSkill, fixture as cooperationFixture} from './tower-cooperation-fixtures.mjs';
import {provisionTravellers} from './recruit-fixtures.mjs';

const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),R=require('../story/tower-hero-growth.js'),T=require('../lib/three.min.js');
const code=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=code('index.html');
function functionSource(name,text=html){const start=text.indexOf('function '+name+'('),end=text.indexOf('\n}',start);assert.ok(start>=0&&end>start,name);return text.slice(start,end+2);}
function node(nodes){const classes=new Set();return {hidden:false,innerHTML:'',listeners:{},dataset:{},style:{},classList:{add:key=>classes.add(key),remove:key=>classes.delete(key),contains:key=>classes.has(key)},setAttribute(){},addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);},appendChild(el){el.parent=this;nodes[el.id]=el;},contains(el){return el===this||el.parent===this;},querySelector(selector){return selector==='span'?this.span||=({textContent:''}):this.button||=node(nodes);}};}

function harness(skillId,options={}){
  const skill=H.SKILLS[skillId];let run=options.run||H.enable(P.enable(C.newRun({seed:53,name:'移動施法'}),skill.job).run).run;
  if(!options.run)ownSkill(run,'hero',skillId);
  if(options.companion){add(run,options.companion.job,options.companion.skill,'ally');}
  provisionTravellers(run);H.setHp(run,'hero',Math.max(1,H.maxHp(run)-10));
  const nodes={};for(const id of ['gameScreen','towerLeftHud'])nodes[id]=node(nodes);
  let paused=false,accept=true,now=1000,tactics=null,cooperation=null,steps=0;
  const world=new T.Group(),player=new T.Group(),actors=H.ids(run).filter(id=>id!=='hero').map((id,i)=>{const model=new T.Group();model.position.set((i+1)*.8,0,0);return {id,model};});
  const monster={...P.monsterSpecs(run)[0],alive:true,windup:0,model:new T.Group()};monster.model.position.set(0,0,2);
  const trap={id:'test-trap',x:0,z:1,model:new T.Group()},moves=[],animations=[],hits=[],sounds=[];
  const G={running:true,shifting:false,frozen:false,stunnedUntil:0,px:0,pz:0,heading:0,camYaw:0,view:'tp',satiety:100,effects:{},baseSpeed:3,items:[],foods:[],exitCell:{x:100,y:100}};
  const joy={active:true,id:9,dx:0,dy:-1},keys={};
  const env=vm.createContext({TowerHeroes:H,TowerPartyCore:P,TowerHeroGrowth:R,TowerHeroIcons:{svg:()=>''},CombatAudio:require('../assets/combat-audio.js'),TowerCombatMotion:require('../story/tower-combat-motion.js'),TowerCombatIntent:require('../story/tower-combat-intent.js'),MazeCharacterVoices:require('../assets/character-voices.js'),
    TowerGrowthRuntime:{create:()=>({hud(){},tick(){},reset(){},install(){},wantsSkill:()=>false})},
    TowerTeamTactics:{create:config=>{tactics=config;return {close(){},refresh(){},install(){}};}},
    document:{createElement:()=>node(nodes),getElementById:id=>nodes[id]||null,addEventListener(){}},Math,performance:{now:()=>now},setTimeout(){},navigator:{vibrate(){}},
    G,joy,keys,playerGroup:player,MP:{id:'self',on:false},isCheckingOut:()=>false,isShop:()=>false,jobPerk:()=>1,shopSpeed:()=>1,cellToWorld:()=>({x:1000,z:1000}),winGame(){throw Error('unexpected exit');},
    CharacterMotion:{update:(model,dt,t,magnitude)=>animations.push(magnitude)},AudioEng:{sfxStep:()=>steps++},
    collideMove(x,z){moves.push({x,z});G.px=x;G.pz=z;}
  });env.window=env;
  vm.runInContext('let stepAcc=0;\n'+functionSource('bindActionBtn')+'\n'+functionSource('updatePlayer'),env);
  vm.runInContext(code('story/tower-skill-effects.js'),env);
  if(options.cooperation){env.TowerCooperation=require('../story/tower-cooperation-core.js');vm.runInContext(code('story/tower-cooperation-runtime.js'),env);const create=env.TowerCooperationRuntime.create;env.TowerCooperationRuntime.create=ctx=>(cooperation=create(ctx));}
  vm.runInContext(code('story/tower-heroes-runtime.js'),env);
  let runtime;
  const ctx={THREE:T,G,core:C,run:()=>run,world:()=>world,player:()=>player,actors:()=>actors,monsters:()=>[monster],hazards:()=>[trap],paused:()=>paused,text:String,action:()=>'',portrait:()=>'',clear:()=>true,walkClear:()=>true,
    audio:{sfxAction:kind=>{sounds.push(kind);},sfxHit(){}},toast(){},save(){},swing(){},close(){},dialog(){},dispose(){},cell:(x,y)=>({x,z:y}),worldToCell:(x,z)=>({x,y:z}),
    transact(result){if(!accept||!result.ok)return false;run=result.run;return true;},
    hit(enemy,memberId,key){const result=H.strike(run,enemy.id,{memberId,skillId:key},run.revision);if(result.ok){run=result.run;hits.push(result.effect);if(result.effect.dead)enemy.alive=false;}return result;}
  };
  runtime=env.TowerHeroesRuntime.create(ctx);runtime.tick(0);
  env.TowerMode={movementLocked:()=>runtime.movementLocked(),movementScale:()=>1,robotEnergy:()=>H.job(run)==='robot'};
  return {runtime,env,G,joy,keys,player,actors,monster,trap,moves,animations,hits,sounds,nodes,get run(){return run;},get tactics(){return tactics;},get cooperation(){return cooperation;},get steps(){return steps;},pause(value){paused=value;},accept(value){accept=value;},time(value){now=value;},move(dt=.1){env.updatePlayer(dt,now/1000);},install(){runtime.install();},switch(id){const result=H.switchActor(run,id);assert.ok(result.ok,result.message);run=result.run;}};
}

test('instant skills cast while moving without changing held input, facing or movement state',()=>{
  const h=harness('arcane_bolt'),input=structuredClone(h.joy);
  h.move();const at={x:h.G.px,z:h.G.pz},facing=h.G.heading;
  assert.equal(h.runtime.cast('arcane_bolt'),true);assert.equal(h.runtime.movementLocked(),false);
  assert.deepEqual(h.joy,input);assert.equal(h.G.heading,facing);assert.equal(h.G.frozen,false);
  h.move();assert.ok(Math.hypot(h.G.px-at.x,h.G.pz-at.z)>.1);assert.equal(h.animations.at(-1),1);
  const paid=JSON.stringify(h.run);assert.equal(h.runtime.cast('arcane_bolt'),undefined);assert.equal(JSON.stringify(h.run),paid);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

test('a preparation rejected during normal attack recovery never locks held movement or spends costs',()=>{
  const h=harness('starfall');H.actor(h.run).attack=.6;const before=JSON.stringify(h.run),held=structuredClone(h.joy);
  assert.equal(h.runtime.cast('starfall'),undefined);assert.equal(h.runtime.preparing(),null);assert.equal(h.runtime.movementLocked(),false);
  assert.equal(JSON.stringify(h.run),before);h.move();assert.ok(h.moves.length);assert.deepEqual(h.joy,held);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

for(const input of ['joystick','keyboard'])test(`${input} remains held during preparation, stops walking and resumes immediately on release`,()=>{
  const h=harness('starfall');if(input==='keyboard'){h.joy.active=false;h.keys.KeyW=true;}
  const held=structuredClone({joy:h.joy,keys:h.keys});h.move();
  const at={x:h.G.px,z:h.G.pz},before=JSON.stringify(h.run),facing=h.G.heading,steps=h.steps;
  assert.equal(h.runtime.cast('starfall'),true);assert.equal(h.runtime.movementLocked(),true);assert.equal(JSON.stringify(h.run),before);
  for(let i=0;i<6;i++){h.move(.1);h.runtime.tick(.1);assert.equal(h.G.px,at.x);assert.equal(h.G.pz,at.z);assert.equal(h.G.heading,facing);assert.equal(h.animations.at(-1),0);}
  assert.equal(h.steps,steps);assert.equal(h.G.frozen,false);assert.deepEqual({joy:h.joy,keys:h.keys},held);
  h.runtime.tick(H.preparationSeconds('starfall'));assert.equal(h.runtime.movementLocked(),false);assert.ok(H.actor(h.run).cooldowns.starfall>0);
  h.move();assert.ok(Math.hypot(h.G.px-at.x,h.G.pz-at.z)>.1);assert.equal(h.animations.at(-1),1);assert.deepEqual({joy:h.joy,keys:h.keys},held);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

test('releasing the movement control while charging does not force movement after the skill finishes',()=>{
  const h=harness('starfall');h.runtime.cast('starfall');h.joy.active=false;h.joy.dx=h.joy.dy=0;const at={x:h.G.px,z:h.G.pz};
  h.runtime.tick(H.preparationSeconds('starfall')+.01);h.move();assert.equal(h.runtime.movementLocked(),false);assert.equal(h.G.px,at.x);assert.equal(h.G.pz,at.z);assert.equal(h.animations.at(-1),0);h.runtime.reset();
});

test('pause keeps preparation locked without charging time or clearing movement input',()=>{
  const h=harness('starfall');h.runtime.cast('starfall');const seconds=h.runtime.preparing().left,input=structuredClone(h.joy);h.pause(true);h.runtime.tick(20);
  assert.equal(h.runtime.preparing().left,seconds);assert.equal(h.runtime.movementLocked(),true);assert.deepEqual(h.joy,input);
  h.pause(false);h.runtime.tick(seconds+.01);assert.equal(h.runtime.movementLocked(),false);h.move();assert.ok(h.moves.length);h.runtime.reset();
});

test('cancelled or rejected preparations release movement without spending costs or resetting held input',()=>{
  for(const reason of ['reset','shift','death','switch','save-failure']){
    const h=harness('starfall',{companion:{job:'swordsman',skill:'guard_stance'}}),held=structuredClone(h.joy);assert.ok(h.runtime.cast('starfall'));assert.ok(h.runtime.movementLocked());
    if(reason==='reset')h.runtime.reset();if(reason==='shift')h.G.shifting=true;if(reason==='death'){H.setHp(h.run,'hero',0);h.run.status='dead';}if(reason==='switch')h.switch('ally');if(reason==='save-failure')h.accept(false);
    h.runtime.tick(H.preparationSeconds('starfall')+.01);assert.equal(h.runtime.movementLocked(),false,reason);assert.equal(H.actor(h.run,'hero').cooldowns.starfall,0,reason);assert.deepEqual(h.joy,held,reason);
    if(reason!=='death'){h.G.shifting=false;h.move();assert.ok(h.moves.length,reason);}assert.ok(C.validateSave(h.run),reason);h.runtime.reset();
  }
  const h=harness('starfall');H.actor(h.run).cooldowns.starfall=5;assert.equal(h.runtime.cast('starfall'),undefined);assert.equal(h.runtime.movementLocked(),false);h.move();assert.ok(h.moves.length);h.runtime.reset();
});

test('companion preparation locks only its own actor, never the moving leader',()=>{
  const h=harness('guard_stance',{companion:{job:'mage',skill:'starfall'}});assert.equal(h.runtime.cast('starfall','ally','ally'),true);
  assert.equal(h.runtime.movementLocked('ally'),true);assert.equal(h.runtime.movementLocked(),false);h.move();assert.ok(h.moves.length);assert.equal(h.animations.at(-1),1);
  h.runtime.tick(H.preparationSeconds('starfall')+.01);assert.equal(h.runtime.movementLocked('ally'),false);assert.ok(H.actor(h.run,'ally').cooldowns.starfall>0);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

test('choosing an ally for an instant support skill does not lock movement before or after selection',()=>{
  const h=harness('barrier',{companion:{job:'swordsman',skill:'guard_stance'}}),before=JSON.stringify(h.run);assert.equal(h.runtime.cast('barrier'),true);
  assert.equal(h.runtime.preparing(),null);assert.equal(h.runtime.movementLocked(),false);assert.equal(JSON.stringify(h.run),before);
  h.move();assert.ok(h.moves.length);h.tactics.selectTarget('ally');assert.ok(H.buff(h.run,'barrier','ally'));assert.equal(h.runtime.movementLocked(),false);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

test('prepared ally support stays mobile while selecting, then locks only while the actual spell prepares',()=>{
  const h=harness('revive',{companion:{job:'swordsman',skill:'guard_stance'}});H.setHp(h.run,'ally',0);assert.equal(h.runtime.cast('revive'),true);assert.equal(h.runtime.movementLocked(),false);
  h.move();const at={x:h.G.px,z:h.G.pz};h.tactics.selectTarget('ally');assert.equal(h.runtime.movementLocked(),true);h.move();assert.equal(h.G.px,at.x);assert.equal(h.G.pz,at.z);
  h.runtime.tick(H.preparationSeconds('revive')+.01);assert.ok(H.hp(h.run,'ally')>0);assert.equal(h.runtime.movementLocked(),false);h.move();assert.ok(Math.hypot(h.G.px-at.x,h.G.pz-at.z)>.1);h.runtime.reset();
});

test('disarm work locks movement until completion, and injury cancels without clearing the joystick',()=>{
  for(const interrupt of [false,true]){const h=harness('disarm'),held=structuredClone(h.joy);assert.equal(h.runtime.cast('disarm'),true);assert.equal(h.runtime.movementLocked(),true);h.move();assert.equal(h.moves.length,0);
    if(interrupt)H.actor(h.run).hurt=1;h.runtime.tick(H.SKILLS.disarm.power[0]+.01);assert.equal(h.runtime.movementLocked(),false);assert.equal(!!h.trap.heroRemoved,!interrupt);assert.deepEqual(h.joy,held);h.move();assert.ok(h.moves.length);h.runtime.reset();}
});

test('robot charge owns movement through preparation and dash, then returns to the held control',()=>{
  const h=harness('iron_charge');assert.equal(h.runtime.cast('iron_charge'),true);assert.ok(h.runtime.movementLocked());h.move();assert.equal(h.moves.length,0);
  h.runtime.tick(H.preparationSeconds('iron_charge')+.01);assert.equal(h.runtime.preparing(),null);assert.equal(h.runtime.dashing('hero'),true);assert.equal(h.runtime.movementLocked(),true);h.move();assert.equal(h.moves.length,0);
  for(let i=0;i<30&&h.runtime.dashing('hero');i++)h.runtime.tick(.1);assert.equal(h.runtime.movementLocked(),false);const z=h.G.pz;assert.ok(z>1,'dash advances on its own path');h.move();assert.notEqual(h.G.pz,z);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

test('cooperation preparation locks participating actors and unlocks after release or cancellation',()=>{
  for(const cancel of [false,true]){const f=cooperationFixture('thunder_blades'),h=harness('wind_slash',{run:f.run,cooperation:true});h.monster.model.position.set(0,0,2.5);assert.ok(h.cooperation.start('thunder_blades'));
    assert.equal(h.runtime.movementLocked(),true);assert.ok(f.ids.every(id=>h.runtime.movementLocked(id)));h.move();assert.equal(h.moves.length,0);
    if(cancel)h.cooperation.cancel();else for(let i=0;i<12;i++)h.runtime.tick(.1);assert.equal(h.runtime.movementLocked(),false);h.move();assert.ok(h.moves.length);assert.ok(C.validateSave(h.run));h.runtime.reset();}
});

test('cooperation touch start and cancellation preserve a held joystick and suppress duplicate click',()=>{
  const f=cooperationFixture('thunder_blades'),h=harness('wind_slash',{run:f.run,cooperation:true});h.monster.model.position.set(0,0,2.5);h.install();
  const bar=h.nodes.heroCooperationBar,button=Object.assign(node(h.nodes),{dataset:{cooperation:'thunder_blades'},disabled:false,parent:bar,closest(){return this;}}),event={target:button,preventDefault(){},stopPropagation(){}};
  assert.ok(bar.listeners.touchstart?.length);for(const fn of bar.listeners.touchstart)fn(event);assert.equal(h.runtime.movementLocked(),true);const sounds=h.sounds.length,total=h.cooperation.preparing('hero').total;
  h.time(1001);for(const fn of bar.listeners.click)fn(event);assert.equal(h.sounds.length,sounds);assert.equal(h.cooperation.preparing('hero').total,total);
  h.time(1100);button.dataset.cooperation='cancel';for(const fn of bar.listeners.touchstart)fn(event);assert.equal(h.runtime.movementLocked(),false);assert.equal(h.joy.active,true);assert.equal(h.joy.id,9);h.move();assert.ok(h.moves.length);assert.ok(C.validateSave(h.run));h.runtime.reset();
});

test('delegated skill touchstart works with a held joystick and the subsequent click cannot cast twice',()=>{
  const h=harness('starfall');h.install();const bar=h.nodes.heroSkillBar,button=Object.assign(node(h.nodes),{dataset:{heroSkill:'starfall'},disabled:false,parent:bar,closest(){return this;}});
  const event={target:button,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
  assert.ok(bar.listeners.touchstart?.length);for(const fn of bar.listeners.touchstart)fn(event);assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(h.runtime.movementLocked(),true);assert.equal(h.joy.active,true);assert.equal(h.joy.id,9);assert.equal(button.classList.contains('pressing'),true);assert.equal(bar.classList.contains('pressing'),false,'touch feedback belongs only to the tapped button, not the entire skill bar');
  const sounds=h.sounds.length;h.time(1001);for(const fn of bar.listeners.click)fn(event);assert.equal(h.sounds.length,sounds);assert.equal(h.runtime.preparing().total,H.preparationSeconds('starfall'));
  h.runtime.reset();h.time(2000);button.disabled=true;for(const fn of bar.listeners.touchstart)fn(event);assert.equal(h.runtime.movementLocked(),false);assert.equal(h.sounds.length,sounds);
  h.time(3000);button.disabled=false;for(const fn of bar.listeners.click)fn(event);assert.equal(h.runtime.movementLocked(),true);assert.ok(h.sounds.length>sounds);h.runtime.reset();
});

test('action binding forwards each event and allows the first mouse click before any touch',()=>{
  const h=harness('arcane_bolt'),el=node(h.nodes),events=[];h.time(0);h.env.bindActionBtn(el,event=>events.push(event));
  const click={type:'click'};for(const fn of el.listeners.click)fn(click);assert.deepEqual(events,[click]);
  const touch={type:'touchstart',preventDefault(){},stopPropagation(){}};for(const fn of el.listeners.touchstart)fn(touch);assert.deepEqual(events,[click,touch]);
  h.time(200);for(const fn of el.listeners.click)fn(click);assert.equal(events.length,2);h.time(701);for(const fn of el.listeners.click)fn(click);assert.deepEqual(events,[click,touch,click]);h.runtime.reset();
});

test('legacy bag and talk bindings do not interpret forwarded input events as their quiet flag',()=>{
  const mode=code('story/tower-mode.js'),bindings=new Map(),calls=[];
  const lines=mode.split('\n').filter(line=>/bindActionBtn\(el\('tower(?:Bag|Talk)Btn'\)/.test(line));assert.equal(lines.length,2);
  const env=vm.createContext({el:id=>id,bindActionBtn:(id,callback)=>bindings.set(id,callback),inventory(...args){calls.push({action:'bag',args});},trade(quiet=false,...extra){calls.push({action:'talk',quiet,extra});}});vm.runInContext(lines.join('\n'),env);
  for(const type of ['click','touchstart']){const event={type,target:{id:'input'}};bindings.get('towerBagBtn')(event);bindings.get('towerTalkBtn')(event);}
  assert.deepEqual(calls,[{action:'bag',args:[]},{action:'talk',quiet:false,extra:[]},{action:'bag',args:[]},{action:'talk',quiet:false,extra:[]}]);
});

test('movement locking is a story-only state forwarding API, not a global freeze or speed change',()=>{
  const party=code('story/tower-party-runtime.js'),mode=code('story/tower-mode.js');
  assert.match(party,/movementLocked:\s*\(\)=>modern\(\)&&!!heroes\?\.movementLocked\(\)/);
  assert.match(mode,/function movementLocked\(\)/);assert.match(mode,/movementLocked,\s*movementScale/);
  assert.doesNotMatch(code('story/tower-heroes-runtime.js'),/joy\.(?:active|dx|dy)\s*=|keys\.[A-Za-z]+\s*=|G\.frozen\s*=/);
});
