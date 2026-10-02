import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),V=require('../story/tower-characters.js'),N=require('../story/tower-narrative.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
function harness(floor=84,options={}){
  let run=P.enable(C.newRun({seed:31415}),'swordsman').run;run.floor=floor;run.floorsCleared=99-floor;run.chronicle=N.newChronicle(floor);P.advance(run);
  let paused=false,failSave=false,wall=false,swings=0,hits=0,world=new T.Group(),monsters=[],messages=[],dialog=null,followTargets=[],labels=[];
  const player=new T.Group(),G={px:0,pz:0,running:true,shifting:false};
  const context=vm.createContext({TowerMaterials:Object.hasOwn(options,'materials')?options.materials:require('../story/tower-materials.js'),TowerResourceIcons:require('../story/tower-resource-icons.js'),TowerPartyCore:options.partyCore||P,TowerExpedition:require('../story/tower-expedition-core.js'),TowerCharacters:V,TowerMonsterSense:require('../story/tower-monster-sense.js'),TowerFieldGuide:Object.hasOwn(options,'fieldGuide')?options.fieldGuide:require('../story/tower-field-guide.js'),document:{getElementById:()=>null}});vm.runInContext(source,context);
  let nextCell=1;
  const ui=context.TowerPartyRuntime.create({THREE:T,G,core:C,text:options.text||String,action:(label,key,id,disabled)=>`${label}|${key}|${id}|${disabled}`,dialog:(...args)=>dialog=args,
    transact:result=>{if(!result.ok||failSave)return false;run=result.run;return true;},save:()=>!failSave,toast:message=>messages.push(message),audio:{sfxHit:()=>hits++,sfxSwing(){},sfxUse(){},sfxGuardBlock(){}},quest(){},
    run:()=>run,paused:()=>paused,inDungeon:()=>false,world:()=>world,monsters:()=>monsters,traders:()=>[],player:()=>player,camera:options.camera,
    clear:()=>!wall,followClear:options.followClear,cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),chooseCell:()=>({cx:nextCell,cy:0,x:nextCell++*4,z:0}),makeText:name=>{labels.push(name);return new T.Group();},follow:(a,dt,speed,stop,target)=>{followTargets.push(target);return false;},dispose:()=>{},damage:()=>{},bind:()=>{},swing:()=>swings++,
  });
  // Early-floor non-combat fixtures keep enemies outside the camp; combat tests use 84F.
  const spec=P.monsterSpecs(run)[0];if(spec){const model=ui.monsterModel(spec.kind,spec.strength)||new T.Group();if(!model.userData.body)model.userData.body=new T.Group();model.position.set(0,0,floor>84?24:2);monsters=[{...spec,model,alive:true,windup:0,cooldown:2}];}
  ui.build(()=>.5,new Set());
  return {ui,G,player,world,monsters,messages,followTargets,labels,get run(){return run;},set run(value){run=value;},get dialog(){return dialog;},get swings(){return swings;},get hits(){return hits;},set paused(v){paused=v;},set failSave(v){failSave=v;},set wall(v){wall=v;}};
}
test('bestiary keeps every creature in a closed compact card with actionable advice and no extra narration',()=>{
  const h=harness(99),F=require('../story/tower-field-guide.js'),defs=P.defs(),before=JSON.stringify(h.run);
  h.ui.panel('bestiary');const body=h.dialog[3];
  assert.equal((body.match(/<details\b/g)||[]).length,Object.keys(defs).length);
  assert.doesNotMatch(body,/<details[^>]*\bopen\b/);
  for(const def of Object.values(defs)){const guide=F.monster(def);assert.ok(body.includes(guide.role),def.id);assert.ok(body.includes(guide.tell),def.id);assert.ok(body.includes(guide.counter),def.id);}
  assert.equal(h.dialog[5].summary,'迷宮生物誌。了解怪物，收集材料。');assert.equal(h.messages.length,0);
  assert.equal(JSON.stringify(h.run),before);
  const fallback=harness(99,{fieldGuide:null});fallback.ui.panel('bestiary');
  assert.ok(fallback.dialog[3].includes(Object.values(defs)[0].description));
});
test('bestiary escapes guide metadata, creature names and drop names before rendering',()=>{
  const text=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unsafe='<img src=x onerror=alert(1)>',names={...P.INGREDIENTS,shell:unsafe};
  const defs=Object.fromEntries(Object.entries(P.defs()).map(([id,def])=>[id,{...def,name:unsafe}]));
  const partyCore={...P,INGREDIENTS:names,defs:()=>defs},fieldGuide={monster:()=>({role:unsafe,tell:unsafe,counter:unsafe,range:unsafe,personality:unsafe,sensing:unsafe,gate:unsafe})};
  const materials={...require('../story/tower-materials.js'),MATERIALS:{ironore:unsafe},ecology:()=>({name:unsafe,variants:Object.fromEntries(Object.keys(defs).map(id=>[id,{name:unsafe}]))}),dropPool:()=>[{type:'ingredient',key:'shell'},{type:'material',key:'ironore'}]};
  const h=harness(99,{partyCore,fieldGuide,materials,text});h.ui.panel('bestiary');const body=h.dialog[3];
  assert.doesNotMatch(body,/<img\b/);assert.ok(body.includes(text(unsafe)));
  assert.ok(body.includes('可能掉落：'+text(unsafe)));assert.ok(body.includes('<b>前兆</b> '+text(unsafe)));assert.ok(body.includes('<b>應對</b> '+text(unsafe)));
  assert.ok(body.includes('素材來自 '+text(unsafe)));assert.ok(body.includes(text(unsafe)+'、'+text(unsafe)),'both food and forge drop names escaped');
});
test('chapter mechanism scene labels use the same environment-specific names as their instructions',()=>{
  const X=require('../story/tower-expedition-core.js');
  for(const [floor,def] of Object.entries(X.BOSSES).filter(([f])=>Number(f)>0)){const h=harness(Number(floor));for(let i=0;i<def.count;i++)assert.ok(h.labels.includes(def.nodeName+' '+(i+1)),floor+' / '+i);}
});
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
test('camera obstruction preserves soft cheeks and transparent detail materials after returning to view',()=>{
  const camera={position:new T.Vector3(0,1,0)},h=harness(99,{camera:()=>camera}),station=h.ui.reserved().find(s=>s.kind==='recruit');
  const material=new T.MeshLambertMaterial({color:0xce8877,transparent:true,opacity:.48,depthWrite:false}),cheek=new T.Mesh(new T.SphereGeometry(.03,6,4),material);station.model.add(cheek);
  camera.position.copy(station.model.position);camera.position.y=1;h.ui.tick(.01,100);assert.equal(material.opacity,.48*.16);assert.equal(material.depthWrite,false);
  camera.position.set(0,8,-20);h.ui.tick(.01,200);assert.equal(material.opacity,.48);assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);
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
  for(const floor of Object.keys(X.BOSSES).map(Number).filter(f=>f>0)){const h=harness(floor),bosses=h.ui.reserved().filter(x=>x.kind==='boss');assert.equal(bosses.length,X.BOSSES[floor].count);
    h.run.party.boss.started=true;h.run.party.boss.clock=X.BOSSES[floor].warning+.1;h.ui.tick(.01,100);
    for(const s of bosses){let meshes=0,triangles=0;s.model.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null);}});assert.ok(meshes<32,`${floor}: ${meshes}`);assert.ok(triangles<5000,`${floor}: ${triangles}`);assert.equal(s.model.children.find(o=>o.name==='boss-warning').scale.x,X.danger(h.run,s.index).radius);}
  }
});
test('forge confirmations cannot spend from afar, through a wall, twice, or when durable save fails',()=>{
  const h=harness(99);h.run.party.journey.scrap=30;h.run.party.journey.materials.ironore=3;h.run.coins=100;const id=h.run.equipment.weapon.id,key='durable|'+id;
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
test('six companion professions survive stairs and rebuild outside the full walking collision margin',()=>{
  const jobs=Object.keys(P.PROFESSIONS),safe=p=>Math.abs(p.x)+.28<1.65&&Math.abs(p.z)+.28<1.65;
  for(let offset=0;offset<jobs.length;offset+=3){
    const h=harness(99,{followClear:(a,b)=>safe(a)&&safe(b)});
    h.run.party.members=jobs.slice(offset,offset+3).map((profession,i)=>({id:'companion:test:'+profession,profession,sex:P.PROFESSIONS[profession].gender,level:i+1,hp:i?20:0,cooldown:0,hurtLeft:0}));h.run.party.joined=h.run.party.members.map(m=>m.id);
    const before=JSON.parse(JSON.stringify(h.run.party.members));
    for(let i=0;i<3;i++){
      const result=C.descend(h.run);assert.ok(result.ok);h.run=C.validateSave(JSON.stringify(result.run));assert.deepEqual(h.run.party.members,before);
      h.ui.build(()=>.5,new Set());const models=h.world.children.at(-1).children.filter(m=>m.userData.companionId);
      assert.equal(models.length,before.length);assert.equal(new Set(models.map(m=>m.userData.companionId)).size,before.length);
      for(const model of models)assert.ok(safe(model.position),model.userData.companionId);
      for(let a=0;a<models.length;a++)for(let b=a+1;b<models.length;b++)assert.ok(models[a].position.distanceTo(models[b].position)>.55);
    }
  }
});
test('scene rebuild never spawns a named recruit already following the player, including old saves and downed members',()=>{
  for(const floor of [99,97,95,93,91,89])for(const hp of [0,20]){
    const h=harness(floor),offer=P.recruitOffer(h.run),id='companion:earlier:'+offer.profession;
    h.run.party.members=[{id,profession:offer.profession,level:2,hp,cooldown:0,hurtLeft:0}];h.run.party.joined=[id];
    h.run=C.validateSave(JSON.stringify(h.run));assert.ok(h.run);const before=JSON.stringify(h.run);
    h.ui.build(()=>.5,new Set());
    assert.equal(h.ui.reserved().filter(s=>s.kind==='recruit').length,0,offer.profession);
    assert.equal(h.ui.markers().filter(s=>s.label==='友').length,0);
    const models=h.world.children.at(-1).children.filter(m=>m.userData.companionId);assert.equal(models.length,1);assert.equal(models[0].userData.companionId,id);
    h.ui.shift();h.ui.tick(.01,100);assert.equal(h.ui.reserved().filter(s=>s.kind==='recruit').length,0);
    assert.equal(JSON.stringify(h.run),before);
  }
});
test('successful recruitment removes the idle NPC, interaction and map marker only after durable save',()=>{
  const h=harness(99),station=h.ui.reserved().find(s=>s.kind==='recruit'),offer=P.recruitOffer(h.run),before=JSON.stringify(h.run);
  h.G.px=station.x;h.G.pz=station.z;h.ui.tick(.01,100);
  h.failSave=true;h.ui.handle('party-recruit',offer.id);
  assert.equal(JSON.stringify(h.run),before);assert.ok(station.model.parent);assert.ok(h.ui.reserved().includes(station));assert.ok(h.ui.markers().some(s=>s.label==='友'));
  h.failSave=false;h.ui.handle('party-recruit',offer.id);
  assert.equal(h.run.party.members.length,1);assert.equal(station.model.parent,null);
  assert.equal(h.ui.reserved().filter(s=>s.kind==='recruit').length,0);assert.equal(h.ui.markers().filter(s=>s.label==='友').length,0);assert.equal(h.ui.nearby,null);
  h.ui.shift();h.ui.tick(.01,200);assert.equal(h.ui.interact(),false);
  h.ui.build(()=>.5,new Set());assert.equal(h.ui.reserved().filter(s=>s.kind==='recruit').length,0);
});
test('scene ownership cleanup removes the previous group before rebuilding on the same world',()=>{
  const h=harness(91),oldGroup=h.world.children.at(-1),merchant=new T.Group();merchant.name='unrelated-merchant';h.world.add(merchant);
  h.ui.build(()=>.5,new Set());
  assert.equal(h.world.children.length,2);assert.equal(!!oldGroup.parent,false);assert.equal(merchant.parent===h.world,true);
  h.ui.reset();h.ui.build(()=>.5,new Set());
  assert.equal(h.world.children.length,2);assert.equal(merchant.parent===h.world,true);
});
test('renderer independently rejects duplicate offers even when a stale rules module still returns them',()=>{
  const legacy={...P,recruitOffer:run=>P.recruitOffer({...run,party:{...run.party,members:[],joined:[]}})};
  for(const hp of [0,34]){
    const h=harness(91,{partyCore:legacy});
    h.run.party.members=['healer','scout','chef'].map((profession,i)=>({id:'prior:'+profession,profession,level:1,hp:i?34:hp,cooldown:0,hurtLeft:0}));h.run.party.joined=h.run.party.members.map(m=>m.id);
    const before=JSON.stringify(h.run);assert.equal(legacy.recruitOffer(h.run).profession,'healer');
    h.ui.build(()=>.5,new Set());
    assert.equal(h.ui.reserved().some(s=>s.kind==='recruit'),false);
    assert.equal(h.ui.markers().some(s=>s.label==='友'),false);assert.equal(JSON.stringify(h.run),before);
    let healers=0;h.world.traverse(m=>{if(m.name==='tower-explorer-mira'&&m.children.some(c=>c.name==='profession-mantle'))healers++;});assert.equal(healers,1);
  }
});
test('an already drawn stale recruit is pruned on update without altering the saved companion or charging again',()=>{
  const h=harness(91),station=h.ui.reserved().find(s=>s.kind==='recruit');
  h.G.px=station.x;h.G.pz=station.z;h.ui.tick(.01,0);assert.equal(h.ui.nearby,station);
  h.run.party.members=[{id:'companion:96:31415',profession:'healer',level:1,hp:34,cooldown:0,hurtLeft:0}];h.run.party.joined=h.run.party.members.map(m=>m.id);
  const before=JSON.stringify(h.run);h.ui.tick(.01,100);
  assert.equal(!!station.model.parent,false);assert.equal(h.ui.nearby,null);
  assert.equal(h.ui.interact(),false);assert.equal(h.ui.markers().some(s=>s.label==='友'),false);assert.equal(h.ui.reserved().includes(station),false);
  h.ui.handle('party-recruit',`companion:91:${h.run.seed}`);assert.equal(JSON.stringify(h.run),before);
  h.ui.shift();assert.equal(!!station.model.parent,false);
});
test('interaction and map queries discard stale recruits even before the next animation frame',()=>{
  for(const check of ['interact','markers','reserved','nearby']){
    const h=harness(91),station=h.ui.reserved().find(s=>s.kind==='recruit');h.G.px=station.x;h.ui.tick(.01,0);
    h.run.party.members=[{id:'prior:healer',profession:'healer',level:1,hp:34,cooldown:0,hurtLeft:0}];h.run.party.joined=['prior:healer'];
    if(check==='nearby')assert.equal(h.ui.nearby,null);else h.ui[check]();
    assert.equal(!!station.model.parent,false,check);
  }
});
