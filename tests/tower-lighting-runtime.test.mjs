import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-lighting-core.js'),E=require('../story/tower-encounters.js');
const source=readFileSync(new URL('../story/tower-lighting-runtime.js',import.meta.url),'utf8');
function harness(job='mage',modern=false){
  let run=P.enable(C.newRun({seed:1}),job).run,wall=false,failed=false,disposals=0,active=true,at=1;if(modern)run=H.enable(run).run;
  const world=new T.Group(),player=new T.Group(),camera=new T.PerspectiveCamera(),fog=new T.Fog(0x263d38,4,20),events=[];
  const G={px:0,pz:0,mazeW:7,mazeH:7,running:true,shifting:false,view:'tp'},merchant={...E.merchantOffers(run.floor,run.seed).find(m=>m.id==='suHe'),x:8,z:0,cx:2,cy:0};
  const button={dataset:{},style:{},setAttribute(k,v){this[k]=v;}},line={},context=vm.createContext({TowerLighting:L,TowerHeroes:H,document:{getElementById:id=>id==='towerLightBtn'?button:id==='towerLightStatus'?line:null}});vm.runInContext(source,context);
  const ui=context.TowerLightingRuntime.create({THREE:T,G,run:()=>run,active:()=>active,world:()=>world,player:()=>player,camera:()=>camera,
    traders:()=>[merchant],inDungeon:()=>!!run.expedition.active,environment:()=>({id:'echo',rig:{fog}}),clear:()=>!wall,
    cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),chooseCell:()=>({cx:at,cy:1,x:at++*4,z:4}),marker:()=>new T.Group(),bind(){},action:(label,key,id,disabled)=>'<button data-tower="'+key+'" data-item="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>',dialog(){events.push('dialog');},
    transact:result=>{if(!result.ok||failed)return false;run=result.run;return true;},toast:msg=>events.push(msg),audio:{sfxUse(){},sfxPickup(){}},close(){events.push('close');},trade(){events.push('trade');},dispose(){disposals++;},robotPanel(){events.push('robot-panel');},
  });
  const build=()=>{at=1;ui.build(()=>.5,new Set());};build();
  return {ui,G,world,player,camera,fog,merchant,events,button,line,build,get run(){return run;},set run(v){run=v;},set wall(v){wall=v;},set failed(v){failed=v;},set active(v){active=v;},get disposals(){return disposals;}};
}
test('original light models have bounded geometry, no textures or independent animation loops',()=>{
  const h=harness();let meshes=0,triangles=0,lights=0;
  h.world.traverse(o=>{if(o.isPointLight){lights++;assert.equal(o.castShadow,false);}if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null);}});
  // Three lamp slots plus the one skill-flash slot, all permanent and dark when idle.
  assert.equal(lights,4);assert.equal(h.world.getObjectByName('tower-light-slot-skill').intensity,0);assert.ok(meshes<100&&triangles<5000,{meshes,triangles});
  assert.doesNotMatch(source,/\b(setInterval|setTimeout|requestAnimationFrame|TextureLoader)\s*\(/);
  for(let i=0;i<4;i++)h.build();lights=0;h.world.traverse(o=>{if(o.isPointLight)lights++;});assert.equal(lights,4,'the light count never changes across rebuilds');assert.equal(h.disposals,4);
  h.ui.reset();assert.equal(h.world.children.length,0);
});
test('camp and every merchant have permanent light; intervening wall disables local light slots',()=>{
  const h=harness(),sources=h.ui.reserved().filter(s=>!s.id?.startsWith('light-supply'));
  assert.ok(sources.some(s=>s.name==='旅人營地'));assert.equal(sources.filter(s=>s.name==='行商營地').length,1);
  assert.ok(h.world.getObjectByName('tower-light-slot-1').intensity>0);
  h.wall=true;h.ui.updateVisual(0,true);assert.equal(h.world.getObjectByName('tower-light-slot-1').intensity,0);assert.equal(h.world.getObjectByName('tower-light-slot-2').intensity,0);
});
test('torch and daylight increase range and top-view fog compensates for camera height',()=>{
  const h=harness();h.G.px=200;h.ui.updateVisual(0,true);const unlit=h.ui.radius();h.run=L.torch(h.run).run;h.ui.updateVisual(0,true);assert.ok(h.ui.radius()>unlit);
  const torch=h.ui.radius();h.run=L.daylight(h.run).run;h.ui.updateVisual(0,true);assert.ok(h.ui.radius()>torch);assert.equal(h.world.getObjectByName('traveller-torch').visible,false);assert.equal(h.world.getObjectByName('daylight-orb').visible,true);
  h.G.view='top';h.camera.position.y=50;h.ui.updateVisual(0,true);assert.ok(h.fog.near>50&&h.fog.far>h.fog.near);h.active=false;assert.equal(h.ui.radius(),null);
});
test('unlit fog remains close without hiding the third-person hero at either camera distance',()=>{
  const h=harness();h.G.px=200;h.ui.updateVisual(0,true);assert.ok(h.ui.radius()<3.5);
  for(const d of [3,8,11]){
    h.camera.position.set(200,1.5,d);h.ui.updateVisual(0,true);
    assert.ok(h.fog.near>d);assert.ok(h.fog.far-d<6);
  }
  h.G.view='fp';h.ui.updateVisual(0,true);assert.ok(h.fog.near<2&&h.fog.far<6);
});
test('a faraway visible lamp does not grant a full camp sight radius',()=>{
  const h=harness();h.G.px=-7;h.G.pz=0;h.ui.updateVisual(0,true);
  assert.equal(h.ui.radius(),L.profile('echo').radius);
  assert.ok(h.world.getObjectByName('tower-light-slot-1').intensity>0,'the visible lamp remains a beacon');
  h.G.px=0;h.ui.updateVisual(0,true);assert.ok(h.ui.radius()>9);
});
test('failed or occluded material pickup leaves resources and model intact; reload cannot duplicate',()=>{
  const h=harness(),item=h.ui.reserved().find(s=>s.id?.startsWith('light-supply'));h.G.px=item.x;h.G.pz=item.z;
  h.wall=true;h.ui.tick(0);assert.equal(h.run.party.light.wood,2);h.wall=false;h.failed=true;h.ui.tick(0);assert.equal(h.run.party.light.wood,2);assert.equal(item.model.visible,true);
  h.failed=false;h.ui.tick(3);assert.equal(h.run.party.light.wood,3);assert.equal(item.model.visible,false);h.build();assert.equal(h.ui.reserved().find(s=>s.id?.startsWith('light-supply')).model.visible,false);h.ui.tick(10);assert.equal(h.run.party.light.wood,3);
});
test('craft and spell confirmations reject stale revisions and do not silence activation speech',()=>{
  const h=harness();h.ui.panel();h.run.revision++;h.ui.handle('light-craft');assert.equal(h.run.party.light.torches,2);
  h.ui.panel();h.ui.handle('light-daylight');assert.equal(h.run.party.light.daylight,600);assert.deepEqual(h.events.slice(-2),['close','施放 日光術']);assert.equal(h.run.party.cooldown,0);
});
test('torch shop actions require real proximity and line of sight, and survive storage failure',()=>{
  const h=harness(),id=h.merchant.id,start=h.run.coins;h.ui.handle('light-buy',id);assert.equal(h.run.coins,start);
  h.G.px=8;h.wall=true;h.ui.handle('light-buy',id);assert.equal(h.run.coins,start);h.wall=false;h.failed=true;h.ui.handle('light-buy',id);assert.equal(h.run.coins,start);
  h.failed=false;h.ui.handle('light-buy',id);assert.equal(h.run.coins,start-4);assert.equal(h.run.party.light.torches,3);
});
test('torch merchant uses a compact closed summary and keeps finite stock and purchase guards',()=>{
  const h=harness(),id=h.merchant.id,before=JSON.stringify(h.run),html=h.ui.merchantCard(id);
  assert.match(html,/<details class="trade-item-details"><summary>/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
  assert.match(html,/<h3>旅人火把<\/h3>/);assert.match(html,/<\/summary><p>照明五分鐘/);
  assert.match(html,/<div class="trade-card-actions"><button data-tower="light-buy" data-item="suHe">購買 4 幣/);
  assert.equal(JSON.stringify(h.run),before,'rendering stock is not a purchase');assert.equal(h.ui.merchantCard('jinHe'),'');
  h.run.coins=0;assert.match(h.ui.merchantCard(id),/data-item="suHe" disabled/);
  h.run.coins=100;h.run.party.light.bought[id]=L.SHOP_STOCK;assert.match(h.ui.merchantCard(id),/<small>持有 2 · 剩 0<\/small>/);assert.match(h.ui.merchantCard(id),/data-item="suHe" disabled/);
  h.run.party.light.bought[id]=0;h.run.party.light.torches=99;assert.match(h.ui.merchantCard(id),/data-item="suHe" disabled/);
});
test('world range follows single core < torch < dual core < daylight with no extra lights or leader-specific override',()=>{
  const h=harness('robot',true);h.G.px=200;h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),8);assert.equal(h.world.getObjectByName('tower-light-slot-0').color.getHex(),0x48a8ff);
  const m={id:'world-mage',profession:'mage',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};h.run.party.members.push(m);h.run.party.joined.push(m.id);H.addMember(h.run,m);h.run=L.torch(h.run).run;h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),10);assert.equal(h.world.getObjectByName('traveller-torch').visible,true);
  h.run.equipment.core2=C.createGear('robot_core',99,h.run.seed,'world-dual');h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),12);assert.equal(h.world.getObjectByName('traveller-torch').visible,false);
  h.run=H.switchActor(h.run,m.id).run;h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),12);assert.equal(h.world.getObjectByName('tower-light-slot-0').color.getHex(),0x48a8ff);
  h.run=L.daylight(h.run).run;h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),15);assert.equal(h.world.getObjectByName('daylight-orb').visible,true);assert.equal(h.world.getObjectByName('tower-light-slot-0').color.getHex(),0xfff2d1);
  H.state(h.run).switchLeft=0;h.run=H.switchActor(h.run,'hero').run;assert.equal(H.state(h.run).active,'hero');h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),15);assert.equal(h.world.getObjectByName('tower-light-slot-0').color.getHex(),0xfff2d1);assert.equal(h.world.getObjectByName('tower-light-slot-0').intensity,4.2);
  let lights=0;h.world.traverse(p=>{if(p.isPointLight)lights++;});assert.equal(lights,4,'robot cores add no light of their own');H.setHp(h.run,'hero',0);L.tick(h.run,601);h.ui.updateVisual(0,true);assert.equal(h.ui.radius(),10);
});
test('robot lighting quick button casts its living mage companion instead of opening the core panel',()=>{
  const h=harness('robot',true),m={id:'quick-mage',profession:'mage',sex:'male',level:1,hp:34,cooldown:0,hurtLeft:0};h.G.px=200;h.run.party.members.push(m);h.run.party.joined.push(m.id);H.addMember(h.run,m);h.ui.hud();assert.equal(h.button.dataset.icon,'daylight');assert.equal(h.button['aria-label'],'施放日光術');assert.equal(h.button.style.color,'');
  assert.equal(h.ui.quickUse(),true);assert.equal(h.run.party.light.daylight,600);assert.equal(h.ui.radius(),15);assert.ok(!h.events.includes('robot-panel'));assert.match(h.line.textContent,/日光術 10:00/);assert.equal(h.ui.quickUse(),false);assert.equal(h.run.party.light.daylight,600);
});
test('a robot without a mage can directly light a useful torch; dead companions cannot replace the quick action',()=>{
  const h=harness('robot',true),m={id:'quick-dead-mage',profession:'mage',sex:'male',level:1,hp:34,cooldown:0,hurtLeft:0};h.G.px=200;h.run.party.members.push(m);h.run.party.joined.push(m.id);H.addMember(h.run,m);H.setHp(h.run,m.id,0);h.ui.hud();assert.equal(h.button.dataset.icon,'core');assert.equal(h.button['aria-label'],'使用火把');assert.equal(h.ui.quickUse(),true);assert.equal(h.run.party.light.fuel,300);assert.equal(h.run.party.light.lit,true);assert.equal(h.ui.radius(),10);assert.ok(!h.events.includes('robot-panel'));
  const fuel=h.run.party.light.fuel;L.tick(h.run,3);assert.equal(h.run.party.light.fuel,fuel-3);assert.equal(h.ui.quickUse(),true);assert.equal(h.run.party.light.lit,false);assert.equal(h.ui.radius(),8);
});

test('the skill-flash slot lights where a skill lands, fades by the frame clock, keeps the stronger burst, and battery mode builds none',()=>{
  const h=harness('mage',true),slot=h.world.getObjectByName('tower-light-slot-skill');assert.ok(slot);assert.equal(slot.intensity,0);
  assert.equal(h.ui.flash({x:3,z:-2},0x86e4ff,4,.5),true);assert.equal(slot.intensity,4);assert.deepEqual([slot.position.x,slot.position.z],[3,-2]);assert.equal(slot.color.getHex(),0x86e4ff);
  assert.equal(h.ui.flash({x:9,z:9},0xffffff,1,.2),false,'a weaker burst does not cut a strong one short');assert.equal(slot.position.x,3);
  h.ui.tick(.25);assert.ok(slot.intensity>0&&slot.intensity<4,'fades');h.ui.tick(.3);assert.equal(slot.intensity,0,'dark again when done');
  assert.equal(h.ui.flash({x:1,z:1},0xffaa66,2,.3),true,'a new burst after the fade takes over');
  for(const bad of [null,{x:NaN,z:0},{x:0,z:0}])assert.equal(h.ui.flash(bad,0xffffff,bad?.x===0?0:2,.2),false);
  let lights=0;h.world.traverse(o=>{if(o.isPointLight)lights++;});assert.equal(lights,4,'flashing never adds a light');
  h.ui.build();assert.equal(h.world.getObjectByName('tower-light-slot-skill').intensity,0,'a new floor starts dark');
  const source=readFileSync(new URL('../story/tower-lighting-runtime.js',import.meta.url),'utf8');assert.match(source,/if\(root\.MazeQuality\?\.mode\?\.\(\)!=='battery'\)\{flashLight=new T\.PointLight/);
});
