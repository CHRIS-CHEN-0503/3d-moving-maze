import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),V=require('../story/tower-characters.js'),N=require('../story/tower-narrative.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
function harness(floor=84){
  let run=P.enable(C.newRun({seed:31415}),'swordsman').run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);
  let paused=false,failSave=false,wall=false,swings=0,hits=0,world=new T.Group(),monsters=[],messages=[],dialog=null,followTargets=[];
  const player=new T.Group(),G={px:0,pz:0,running:true,shifting:false};
  const context=vm.createContext({TowerPartyCore:P,TowerExpedition:require('../story/tower-expedition-core.js'),TowerCharacters:V,document:{getElementById:()=>null}});vm.runInContext(source,context);
  let nextCell=1;
  const ui=context.TowerPartyRuntime.create({THREE:T,G,core:C,text:String,action:(label,key,id,disabled)=>`${label}|${key}|${id}|${disabled}`,dialog:(...args)=>dialog=args,
    transact:result=>{if(!result.ok||failSave)return false;run=result.run;return true;},save:()=>!failSave,toast:message=>messages.push(message),audio:{sfxHit:()=>hits++,sfxSwing(){},sfxUse(){},sfxGuardBlock(){}},quest(){},
    run:()=>run,paused:()=>paused,inDungeon:()=>false,world:()=>world,monsters:()=>monsters,traders:()=>[],player:()=>player,
    clear:()=>!wall,cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),chooseCell:()=>({cx:nextCell,cy:0,x:nextCell++*4,z:0}),makeText:()=>new T.Group(),follow:(a,dt,speed,stop,target)=>{followTargets.push(target);return false;},dispose:()=>{},damage:()=>{},bind:()=>{},swing:()=>swings++,
  });
  const spec=P.monsterSpecs(run)[0];if(spec){const model=ui.monsterModel(spec.kind,spec.strength)||new T.Group();if(!model.userData.body)model.userData.body=new T.Group();model.position.set(0,0,2);monsters=[{...spec,model,alive:true,windup:0,cooldown:2}];}
  ui.build(()=>.5,new Set());
  return {ui,G,player,world,monsters,messages,followTargets,get run(){return run;},set run(value){run=value;},get dialog(){return dialog;},get swings(){return swings;},get hits(){return hits;},set paused(v){paused=v;},set failSave(v){failSave=v;},set wall(v){wall=v;}};
}
test('four original silhouettes stay within mesh budgets without lights, textures or independent timers',()=>{
  const h=harness();assert.doesNotMatch(source,/\b(setInterval|setTimeout|requestAnimationFrame|TextureLoader)\s*\(/);
  for(const kind of Object.keys(P.MONSTERS)){const model=h.ui.monsterModel(kind,2);let meshes=0,triangles=0;model.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null);}});assert.ok(meshes<30,kind);assert.ok(triangles<5000,kind);assert.ok(model.userData.body);assert.ok(model.userData.ring);}
});
test('attacks face forward, stop at walls, do not run paused, and swing once per cooldown',()=>{
  const h=harness(),m=h.monsters[0];h.wall=true;h.ui.attack();assert.equal(h.swings,1);assert.equal(h.hits,0);h.ui.attack();assert.equal(h.swings,1);h.ui.tick(1,1000);h.wall=false;h.player.rotation.y=Math.PI;h.ui.attack();assert.equal(h.hits,0);h.ui.tick(1,2000);h.player.rotation.y=0;h.ui.attack();assert.equal(h.hits,1);assert.ok(h.run.party.health[m.id]>0);assert.equal(h.run.hp,60);h.ui.tick(1,3000);h.paused=true;h.ui.attack();assert.equal(h.hits,1);
});
test('failed durable combat commit cannot hide enemy, charge durability or award ingredients',()=>{
  const h=harness(),m=h.monsters[0];h.run.party.health[m.id]=1;const before=JSON.stringify(h.run);h.failSave=true;h.ui.attack();assert.equal(JSON.stringify(h.run),before);assert.ok(m.alive&&m.model.visible);assert.equal(h.hits,0);
});
test('camp cooking is unavailable away from camp or through walls, meals remain usable',()=>{
  const h=harness(99);h.G.px=40;const before=h.run.party.ingredients.root;h.ui.handle('party-cook','stew');assert.equal(h.run.party.ingredients.root,before);h.G.px=0;h.wall=true;h.ui.handle('party-cook','stew');assert.equal(h.run.party.ingredients.root,before);h.wall=false;h.ui.handle('party-cook','stew');assert.equal(h.run.party.meals.stew,1);h.G.px=40;h.ui.handle('party-eat','stew');assert.equal(h.run.party.meals.stew,0);
});
test('boss stations and recruitment have reserved cells, map coordinates and proximity gates',()=>{
  const h=harness(90);assert.equal(h.ui.reserved().filter(x=>x.kind==='boss').length,2);assert.ok(h.ui.markers().every(m=>Number.isInteger(m.cx)&&Number.isInteger(m.cy)));assert.equal(h.ui.interact(),false);
  const station=h.ui.reserved().find(s=>s.kind==='boss');h.G.px=station.x;h.G.pz=station.z;h.ui.tick(.01,100);h.ui.interact();assert.equal(h.run.party.boss.started,true);assert.equal(h.run.party.boss.done,false);
});
test('recruited swordfighter follows target and intercepts with own health, not an extra guard slot',()=>{
  const h=harness(99),offer=P.recruitOffer(h.run);h.run=P.recruit(h.run,offer.id).run;
  h.run.floor=84;h.run.floorsCleared=15;h.run.chronicle=N.newChronicle(84);P.advance(h.run);
  h.ui.build(()=>.5,new Set());const companion=h.world.children.at(-1).children.find(m=>m.name==='tower-warrior-1');assert.ok(companion);assert.ok(Math.hypot(companion.position.x,companion.position.z)>1);
  const spec=P.monsterSpecs(h.run)[0],model=h.ui.monsterModel(spec.kind,spec.strength)||new T.Group();model.position.copy(companion.position);model.position.z+=1;const m={...spec,model,alive:true,windup:.01,cooldown:0};
  h.monsters.push(m);h.ui.tick(.01,100);assert.ok(h.followTargets.some(t=>t===model.position));const hp=h.run.party.members[0].hp;assert.ok(h.ui.guard(m,.02));assert.ok(h.run.party.members[0].hp<hp);assert.equal(h.run.hp,60);assert.equal(h.run.warrior,null);
});
test('floor transitions invalidate old boss interactions before rebuilding the scene',()=>{
  const h=harness(90),station=h.ui.reserved().find(s=>s.kind==='boss');h.G.px=station.x;h.G.pz=station.z;h.ui.tick(.01,100);assert.ok(h.ui.nearby);
  h.run.floor=89;h.run.floorsCleared=10;h.run.chronicle=N.newChronicle(89);P.advance(h.run);
  assert.equal(h.ui.live(),false);assert.equal(h.ui.nearby,null);assert.equal(h.ui.markers().length,0);assert.equal(h.ui.reserved().length,0);assert.doesNotThrow(()=>h.ui.hud());assert.equal(h.ui.interact(),false);
});
test('all chapter stations have bounded native geometry and scale their warning to the true damage radius',()=>{
  const X=require('../story/tower-expedition-core.js');
  for(const floor of Object.keys(X.BOSSES).map(Number)){const h=harness(floor),bosses=h.ui.reserved().filter(x=>x.kind==='boss');assert.equal(bosses.length,X.BOSSES[floor].count);
    h.run.party.boss.started=true;h.run.party.boss.clock=X.BOSSES[floor].warning+.1;h.ui.tick(.01,100);
    for(const s of bosses){let meshes=0,triangles=0;s.model.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null);}});assert.ok(meshes<32,`${floor}: ${meshes}`);assert.ok(triangles<5000,`${floor}: ${triangles}`);assert.equal(s.model.children.find(o=>o.name==='boss-warning').scale.x,X.danger(h.run,s.index).radius);}
  }
});
test('forge confirmations cannot spend from afar, through a wall, twice, or when durable save fails',()=>{
  const h=harness(99);h.run.party.journey.scrap=30;h.run.coins=100;const id=h.run.equipment.weapon.id,key='durable|'+id;
  h.ui.handle('party-forge-confirm',key);assert.equal(h.run.party.journey.scrap,30);
  h.G.px=40;h.ui.handle('party-forge-ask',key);h.ui.handle('party-forge-confirm',key);assert.equal(h.run.party.journey.scrap,30);
  h.G.px=0;h.wall=true;h.ui.handle('party-forge-ask',key);h.wall=false;h.ui.handle('party-forge-confirm',key);assert.equal(h.run.party.journey.scrap,30);
  h.ui.handle('party-forge-ask',key);h.failSave=true;h.ui.handle('party-forge-confirm',key);assert.equal(h.run.party.journey.scrap,30);
  h.failSave=false;h.ui.handle('party-forge-confirm',key);assert.equal(h.run.equipment.weapon.forge.level,1);h.ui.handle('party-forge-confirm',key);assert.equal(h.run.equipment.weapon.forge.level,1);
  h.ui.handle('party-dismantle-ask',id);h.ui.handle('party-forge');h.ui.handle('party-dismantle',id);assert.ok(h.run.equipment.weapon);
});
test('ordinary exploration advances only nearby while running and persists completion without another reward',()=>{
  const h=harness(99),s=h.ui.reserved().find(x=>x.kind==='site');h.G.px=s.x;h.G.pz=s.z;h.ui.tick(.01,0);
  h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(4,100);assert.equal(h.run.party.journey.site.progress,4);h.paused=true;h.ui.tick(4,200);assert.equal(h.run.party.journey.site.progress,4);
  h.paused=false;h.wall=true;h.ui.tick(4,300);assert.equal(h.run.party.journey.site.progress,4);h.wall=false;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(8,400);assert.equal(h.run.party.journey.site.done,true);
  const coins=h.run.coins;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(12,500);assert.equal(h.run.coins,coins);assert.ok(C.validateSave(h.run));
});
