import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),L=require('../story/tower-lighting-core.js'),E=require('../story/tower-encounters.js');
const source=readFileSync(new URL('../story/tower-lighting-runtime.js',import.meta.url),'utf8');
function harness(){
  let run=P.enable(C.newRun({seed:31415}),'mage').run,wall=false,failed=false,disposals=0,active=true,at=1;
  const world=new T.Group(),player=new T.Group(),camera=new T.PerspectiveCamera(),fog=new T.Fog(0x263d38,4,20),events=[];
  const G={px:0,pz:0,mazeW:7,mazeH:7,running:true,shifting:false,view:'tp'},merchant={...E.merchantOffers(run.floor,run.seed)[0],x:8,z:0,cx:2,cy:0};
  const context=vm.createContext({TowerLighting:L,document:{getElementById:()=>null}});vm.runInContext(source,context);
  const ui=context.TowerLightingRuntime.create({THREE:T,G,run:()=>run,active:()=>active,world:()=>world,player:()=>player,camera:()=>camera,
    traders:()=>[merchant],inDungeon:()=>!!run.expedition.active,environment:()=>({id:'echo',rig:{fog}}),clear:()=>!wall,
    cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),chooseCell:()=>({cx:at,cy:1,x:at++*4,z:4}),marker:()=>new T.Group(),bind(){},action:()=>'',dialog(){events.push('dialog');},
    transact:result=>{if(!result.ok||failed)return false;run=result.run;return true;},toast:msg=>events.push(msg),audio:{sfxUse(){},sfxPickup(){}},close(){events.push('close');},trade(){events.push('trade');},dispose(){disposals++;},
  });
  const build=()=>{at=1;ui.build(()=>.5,new Set());};build();
  return {ui,G,world,player,camera,fog,merchant,events,build,get run(){return run;},set run(v){run=v;},set wall(v){wall=v;},set failed(v){failed=v;},set active(v){active=v;},get disposals(){return disposals;}};
}
test('original light models have bounded geometry, no textures or independent animation loops',()=>{
  const h=harness();let meshes=0,triangles=0,lights=0;
  h.world.traverse(o=>{if(o.isPointLight){lights++;assert.equal(o.castShadow,false);}if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null);}});
  assert.equal(lights,3);assert.ok(meshes<100&&triangles<5000,{meshes,triangles});
  assert.doesNotMatch(source,/\b(setInterval|setTimeout|requestAnimationFrame|TextureLoader)\s*\(/);
  for(let i=0;i<4;i++)h.build();lights=0;h.world.traverse(o=>{if(o.isPointLight)lights++;});assert.equal(lights,3);assert.equal(h.disposals,4);
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
