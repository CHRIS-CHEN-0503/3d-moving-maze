import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
const seeds={};
const siteJobs=Object.keys(X.SITES);
for(let seed=1;seed<200&&Object.keys(seeds).length<siteJobs.length;seed++){
  const run=P.enable(C.newRun({seed}),'swordsman').run;seeds[X.siteOffer(run).job]??=seed;
}
assert.deepEqual(Object.keys(seeds).sort(),siteJobs.sort(),'fixture uses actual version-two site offers for every profession');

function harness(job,save){
  let run=save?C.validateSave(JSON.stringify(save)):P.enable(C.newRun({seed:seeds[job]}),job).run,failSave=false,cell=0;
  assert.equal(X.siteOffer(run).job,job,'seed must represent the requested site, including archer and robot');
  const world=new T.Group(),player=new T.Group(),G={px:0,pz:0,running:true,shifting:false},passages=[],disposed=[];
  const context=vm.createContext({TowerPartyCore:P,TowerExpedition:X,TowerCharacters:require('../story/tower-characters.js'),TowerMaterials:require('../story/tower-materials.js'),document:{hidden:false,getElementById(){return null;}}});
  vm.runInContext(source,context);
  const ui=context.TowerPartyRuntime.create({THREE:T,G,core:C,text:String,action:String,
    run:()=>run,paused:()=>false,hurt:()=>false,inDungeon:()=>false,world:()=>world,player:()=>player,monsters:()=>[],traders:()=>[],
    cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),chooseCell:()=>({cx:++cell,cy:0,x:cell*4,z:0}),
    clear:()=>true,makeText:text=>{const label=new T.Group();label.userData.textLabel=text;return label;},dispose:obj=>disposed.push(obj),bind(){},
    passage:(station,probe)=>{if(!probe)passages.push(station);return true;},audio:{sfxAction(){},sfxHit(){},sfxUse(){}},dialog(){},close(){},toast(){},
    transact:result=>{if(!result.ok||failSave)return false;run=result.run;return true;},save:()=>!failSave,
  });
  ui.build(()=>.5,new Set());
  const station=()=>ui.reserved().find(s=>s.kind==='site');
  const atSite=()=>{const s=station();G.px=s.x;G.pz=s.z;ui.tick(0,0);return s;};
  return {ui,G,world,passages,disposed,station,atSite,get run(){return run;},set run(v){run=v;},set failSave(v){failSave=v;}};
}

function state(h,done){
  const s=h.station(),v=s.model.userData.siteVisual,labels=[];
  assert.equal(v.done,done);assert.equal(v.pending.visible,!done);assert.equal(v.resolved.visible,done);
  s.model.traverseVisible(node=>{if(node.userData.textLabel)labels.push(node.userData.textLabel);});
  assert.equal(labels.length,1,'only the correct status label is visible');
  if(done){assert.match(labels[0],/已/);assert.equal(v.marker.material.color.getHex(),0x79bba0);assert.equal(v.marker.material.opacity,.35);}
  else assert.equal(labels[0],X.SITES[s.offer.job].name);
  return v;
}

for(const job of Object.keys(X.SITES)){
  test(job+' direct profession completion immediately replaces the unfinished appearance and grants rewards once',()=>{
    const h=harness(job),s=h.atSite(),coins=h.run.coins;state(h,false);
    h.ui.handle('party-explore-job',s.offer.id);state(h,true);
    assert.equal(h.run.party.journey.site.method,'profession');assert.equal(h.run.coins,coins+8);
    const saved=JSON.stringify(h.run);h.ui.handle('party-explore-job',s.offer.id);h.ui.tick(1,1000);
    assert.equal(h.run.coins,coins+8);assert.equal(h.run.party.journey.site.done,true);assert.ok(C.validateSave(saved));state(h,true);
  });

  test(job+' gradual work stays unfinished until committed and survives save, reload and maze rebuilding',()=>{
    const h=harness(job),s=h.atSite();h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(6,6000);
    assert.equal(h.run.party.journey.site.progress,6);state(h,false);
    const partial=harness(job,h.run);state(partial,false);
    h.ui.tick(6,12000);state(h,true);assert.equal(h.run.party.journey.site.method,'work');
    const restored=harness(job,h.run);state(restored,true);
    restored.ui.shift();state(restored,true);
    const previous=restored.station().model;restored.ui.build(()=>.5,new Set());state(restored,true);
    assert.equal(restored.world.children.filter(node=>node.name==='tower-party-scene').length,1);
    assert.ok(restored.disposed.some(group=>group.children.includes(previous)),'old scene is disposed rather than duplicated');
    const rebuilt=restored.atSite(),coins=restored.run.coins;restored.ui.handle('party-explore-work',rebuilt.offer.id);restored.ui.tick(20,20000);state(restored,true);assert.equal(restored.run.coins,coins);
    if(['swordsman','scout'].includes(job))assert.equal(restored.passages.length,2,'restored passage remains open after each rebuilding');
  });
}

test('completed station silhouettes match the work: raised door, open latch and crate, stable crystal, clean water and repaired gears',()=>{
  const shapes={swordsman:'raised-stone-door',scout:'opened-secret-door',mage:'anchored-rune',chef:'opened-clean-crate',healer:'clear-spring-water',smith:'repaired-gear'};
  for(const [job,name] of Object.entries(shapes)){
    const h=harness(job),s=h.atSite();h.ui.handle('party-explore-job',s.offer.id);const v=state(h,true),shape=v.resolved.getObjectByName(name);
    assert.ok(shape,job+' has a distinct finished construction');assert.equal(v.pending.visible,false);
    if(job==='healer'){assert.equal(shape.material.color.getHex(),0x61c7d7);assert.equal(v.pending.getObjectByName('polluted-water').material.color.getHex(),0x75734e);}
    if(job==='swordsman')assert.ok(shape.position.y>1);
    if(job==='scout')assert.ok(Math.abs(shape.rotation.y)>1);
    if(job==='chef')assert.ok(Math.abs(shape.rotation.x)>1);
    if(job==='mage')assert.equal(shape.rotation.z,0);
  }
});

test('failed transaction cannot falsely show repaired geometry, even when work progress has reached 100 percent',()=>{
  const h=harness('healer'),s=h.atSite(),coins=h.run.coins;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(6,6000);h.failSave=true;h.ui.tick(6,12000);
  assert.equal(h.run.party.journey.site.progress,12);assert.equal(h.run.coins,coins);state(h,false);h.ui.hud();state(h,false);
  h.failSave=false;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(.1,12100);state(h,true);assert.equal(h.run.coins,coins+8);
});

test('HUD synchronization can restore state without allocating additional geometry, lights or repeated labels',()=>{
  for(const job of Object.keys(X.SITES)){
    const h=harness(job),s=h.atSite(),objects=[],geometry=[];let triangles=0;
    s.model.traverse(node=>{objects.push(node);assert.equal(!!node.isLight,false);if(node.isMesh){geometry.push(node.geometry);triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});
    assert.ok(geometry.length<40,job+' remains bounded native geometry');assert.ok(triangles<4500,job+' remains a small scene prop');
    h.run=X.explore(h.run,s.offer.id,'profession',h.run.revision).run;h.ui.hud();state(h,true);
    for(let i=0;i<30;i++){h.ui.hud();h.ui.tick(0,i);}
    const after=[];s.model.traverse(node=>after.push(node));assert.deepEqual(after,objects,'repeated updates only toggle existing groups');
  }
});
