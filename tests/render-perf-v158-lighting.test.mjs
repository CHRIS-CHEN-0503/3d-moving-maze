import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),L=require('../story/tower-lighting-core.js'),E=require('../story/tower-encounters.js'),R=H.ROBOT;
const runtimeSource=readFileSync(new URL('../story/tower-lighting-runtime.js',import.meta.url),'utf8'),coreSource=readFileSync(new URL('../story/tower-lighting-core.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function realDisposer(){
  const c=vm.createContext({_texCache:{},spriteCache:{},makePickupMarker:{ringGeom:null,beamGeom:null,materials:{}}}),start=html.indexOf('function disposeSceneObject(root)');
  vm.runInContext(html.slice(start,html.indexOf('\nlet sceneEpoch=',start)),c);return c.disposeSceneObject;
}
function harness({envId='echo',mazeW=7,button,line,job='mage',modern=false,dispose=()=>{}}={}){
  let run=P.enable(C.newRun({seed:1}),job).run,at=1;if(modern)run=H.enable(run).run;
  const world=new T.Group(),player=new T.Group(),camera=new T.PerspectiveCamera(),fog=new T.Fog(0x263d38,4,20);
  const G={px:200,pz:0,mazeW,mazeH:mazeW,running:true,shifting:false,view:'tp'},merchant={...E.merchantOffers(run.floor,run.seed).find(m=>m.id==='suHe'),x:8,z:0,cx:2,cy:0};
  button=button||{dataset:{},style:{},setAttribute(k,v){this[k]=v;}};line=line||{};
  const context=vm.createContext({TowerLighting:L,TowerHeroes:H,document:{getElementById:id=>id==='towerLightBtn'?button:id==='towerLightStatus'?line:null}});vm.runInContext(runtimeSource,context);
  const ui=context.TowerLightingRuntime.create({THREE:T,G,run:()=>run,active:()=>true,world:()=>world,player:()=>player,camera:()=>camera,traders:()=>[merchant],inDungeon:()=>false,environment:()=>({id:envId,rig:{fog}}),clear:()=>true,
    cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),chooseCell:()=>({cx:at,cy:1,x:at++*4,z:4}),marker:()=>new T.Group(),bind(){},action:()=>'',dialog(){},transact:result=>{if(!result.ok)return false;run=result.run;return true;},toast(){},audio:{sfxUse(){},sfxPickup(){}},close(){},trade(){},dispose});
  const build=()=>{at=1;ui.build(()=>.5,new Set());};build();
  return {ui,G,world,build,button,line,get run(){return run;},set run(v){run=v;}};
}
function meshes(root){const list=[];root.traverse(o=>{if(o.isMesh)list.push(o);});return list;}

test('lamps bake into at most two meshes each and share one geometry per identical lamp and two floor-wide materials',()=>{
  const h=harness({mazeW:25}),group=h.world.getObjectByName('tower-lighting'),all=meshes(group);
  assert.ok(all.length<=24,'a 25-cell floor drew 59 lamp meshes before; now '+all.length);
  const materials=new Set(all.map(m=>m.material));assert.ok(materials.size<=2);
  for(const m of materials)assert.equal(m.vertexColors,true);assert.ok([...materials].every(m=>m.isMeshLambertMaterial||m.isMeshBasicMaterial));
  const lanterns=group.children.filter(o=>o.name==='light-lantern');assert.ok(lanterns.length>=2);
  for(const lantern of lanterns){assert.ok(lantern.children.filter(o=>o.isMesh).length<=2);assert.equal(lantern.children[0].geometry,lanterns[0].children[0].geometry);}
  const geometries=new Set(all.map(m=>m.geometry));assert.ok(geometries.size<=8,'one baked geometry per lit/glow face of each distinct model, not per primitive');
  let lights=0;group.traverse(o=>{if(o.isPointLight)lights++;});assert.equal(lights,4,'three lamp slots and one skill-flash slot');
});

const GOLDEN={"light-lantern":{"lit":{"corners":288,"centroid":[0.351,1.098,0],"normalMean":[0,-0.139,0],"min":[-0.07,0,-0.3],"max":[0.69,1.445,0.3],"colors":["0.095/0.125/0.144","0.153/0.093/0.051"]},"glow":{"corners":72,"centroid":[0.43,1.12,0],"normalMean":[0,0,0],"min":[0.231,0.89,-0.23],"max":[0.629,1.35,0.23],"colors":["1/0.644/0.258"]}},"light-crystal":{"glow":{"corners":72,"centroid":[0,0.65,0],"normalMean":[0,0,0],"min":[-0.538,0.131,-0.36],"max":[0.538,1.698,0.36],"colors":["0.279/0.665/1"]},"lit":{"corners":72,"centroid":[0,0.15,0],"normalMean":[0,0.199,0],"min":[-0.459,0,-0.53],"max":[0.459,0.3,0.53],"colors":["0.1/0.133/0.175"]}},"supply":{"lit":{"corners":252,"centroid":[0.034,0.63,0.01],"normalMean":[-0.008,0,0],"min":[-0.325,0.52,-0.2],"max":[0.415,0.755,0.23],"colors":["0.503/0.279/0.133","0.687/0.584/0.371","0.807/0.723/0.515"]}},"torch":{"glow":{"corners":48,"centroid":[0,1.09,0.03],"normalMean":[0,0,0],"min":[-0.16,0.836,-0.16],"max":[0.16,1.364,0.16],"colors":["1/0.462/0.063","1/0.839/0.402"]},"lit":{"corners":156,"centroid":[0,0.653,0],"normalMean":[0,-0.023,0],"min":[-0.093,0,-0.086],"max":[0.093,0.985,0.095],"colors":["0.216/0.087/0.04","0.738/0.591/0.323"]}},"orb":{"glow":{"corners":444,"centroid":[0,0,0],"normalMean":[0,0,0],"min":[-0.278,-0.119,-0.278],"max":[0.278,0.119,0.278],"colors":["1/0.761/0.356","1/0.905/0.597"]}},"light-rune":{"lit":{"corners":360,"centroid":[0,0.87,0],"normalMean":[0,0.04,0],"min":[-0.545,0,-0.53],"max":[0.545,1.528,0.53],"colors":["0.1/0.133/0.175","0.402/0.352/0.242"]},"glow":{"corners":24,"centroid":[0,1.05,0],"normalMean":[0,0,0],"min":[-0.36,0.69,-0.36],"max":[0.36,1.41,0.36],"colors":["0.328/0.784/0.913"]}},"light-fungus":{"glow":{"corners":504,"centroid":[-0.023,0.987,0.1],"normalMean":[0,0.579,0],"min":[-0.566,0.6,-0.396],"max":[0.55,1.496,0.47],"colors":["0.361/0.791/0.381"]},"lit":{"corners":180,"centroid":[-0.023,0.408,0.1],"normalMean":[0,0.032,0],"min":[-0.445,0,-0.081],"max":[0.375,1.1,0.3],"colors":["0.323/0.423/0.246"]}},"light-brazier":{"lit":{"corners":96,"centroid":[0,0.3,0],"normalMean":[0,-0.197,0],"min":[-0.45,0.125,-0.45],"max":[0.45,0.475,0.45],"colors":["0.12/0.093/0.082"]},"glow":{"corners":72,"centroid":[0,0.65,0],"normalMean":[0,0.0,0],"min":[-0.4,0.29,-0.2],"max":[0.4,1.01,0.2],"colors":["1/0.539/0.205"]}}};
// Measured once on the pre-bake implementation (one mesh per primitive): triangle corners, centroid, mean normal,
// bounds and the exact vertex colours of every lit (Lambert) and self-lit (Basic) surface of each lamp model.
function surfaceStats(model){
  model.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(model.matrixWorld).invert(),classes={};
  model.traverse(o=>{if(!o.isMesh)return;
    const m=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),nm=new T.Matrix3().getNormalMatrix(m),g=o.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,base=o.material.color,name=o.material.isMeshBasicMaterial?'glow':'lit',
      s=classes[name]||(classes[name]={corners:0,sum:[0,0,0],nsum:[0,0,0],min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9],colors:new Set()}),v=new T.Vector3(),nv=new T.Vector3();
    for(let i=0,count=g.index?g.index.count:p.count;i<count;i++){const j=g.index?g.index.getX(i):i;v.fromBufferAttribute(p,j).applyMatrix4(m);nv.fromBufferAttribute(n,j).applyMatrix3(nm).normalize();
      s.corners++;for(let k=0;k<3;k++){s.sum[k]+=v.getComponent(k);s.nsum[k]+=nv.getComponent(k);s.min[k]=Math.min(s.min[k],v.getComponent(k));s.max[k]=Math.max(s.max[k],v.getComponent(k));}
      const col=c?[c.getX(j)*base.r,c.getY(j)*base.g,c.getZ(j)*base.b]:[base.r,base.g,base.b];s.colors.add(col.map(x=>Math.round(x*1e3)/1e3).join('/'));}
  });
  return Object.fromEntries(Object.entries(classes).map(([name,s])=>[name,{corners:s.corners,centroid:s.sum.map(x=>x/s.corners),normalMean:s.nsum.map(x=>x/s.corners),min:s.min,max:s.max,colors:[...s.colors].sort()}]));
}
function assertSameLook(actual,expected,label){
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),label+' lit/glow split');
  for(const name of Object.keys(expected)){const a=actual[name],e=expected[name];
    assert.equal(a.corners,e.corners,label+' '+name+' triangles');assert.deepEqual(a.colors,e.colors,label+' '+name+' colours');
    for(const key of ['centroid','normalMean','min','max'])a[key].forEach((v,i)=>assert.ok(Math.abs(v-e[key][i])<2e-3,label+' '+name+' '+key+'['+i+'] '+v+' vs '+e[key][i]));}
}
test('every baked lamp, supply bundle, torch and daylight orb matches the pre-bake geometry, normals, colours and glow split',()=>{
  const seen=new Set();
  for(const envId of ['echo','summoning','roots','clockwork','garden']){
    const h=harness({envId});
    for(const source of h.ui.reserved()){const name=source.model.name;if(source.id?.startsWith('light-supply'))continue;if(seen.has(name))continue;seen.add(name);assertSameLook(surfaceStats(source.model),GOLDEN[name],name);}
    if(!seen.has('supply')){seen.add('supply');assertSameLook(surfaceStats(h.ui.reserved().find(s=>s.id?.startsWith('light-supply')).model),GOLDEN.supply,'supply');}
    if(!seen.has('torch')){seen.add('torch');assertSameLook(surfaceStats(h.world.getObjectByName('traveller-torch')),GOLDEN.torch,'torch');assertSameLook(surfaceStats(h.world.getObjectByName('daylight-orb')),GOLDEN.orb,'orb');}
  }
  assert.deepEqual([...seen].sort(),['light-brazier','light-crystal','light-fungus','light-lantern','light-rune','supply','torch']);
});

test('rebuilding a floor and leaving the tower release every baked geometry and material exactly once, never early',()=>{
  const counts=new Map(),dispose=realDisposer(),track=group=>{group.traverse(o=>{if(!o.isMesh)return;for(const resource of [o.geometry,o.material])if(!counts.has(resource)){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}});};
  const h=harness({mazeW:13,dispose:group=>{dispose(group);}});
  track(h.world.getObjectByName('tower-lighting'));const first=[...counts.keys()];assert.ok(first.length>=4);assert.ok([...counts.values()].every(n=>n===0),'nothing is released while the floor is live');
  h.build();assert.ok(first.every(r=>counts.get(r)===1),'the previous floor is released once when rebuilt');
  track(h.world.getObjectByName('tower-lighting'));const second=[...counts.keys()].filter(r=>!first.includes(r));assert.ok(second.length>=4);assert.ok(second.every(r=>counts.get(r)===0),'a rebuilt floor starts from fresh resources');
  h.ui.reset();assert.equal(h.world.children.length,0);assert.ok([...counts.values()].every(n=>n===1),'leaving releases the rest, once');
  h.ui.reset();assert.ok([...counts.values()].every(n=>n===1),'a second reset releases nothing again');
});

function writeLog(){
  const writes=[],watch=(node,name)=>new Proxy(node,{set(target,key,value){writes.push(name+'.'+String(key));target[key]=value;return true;}}),
    button=watch({dataset:watch({},'button.dataset'),style:watch({},'button.style'),setAttribute(key,value){writes.push('button.attr.'+key);this[key]=value;}},'button'),line=watch({},'line');
  return {writes,button,line};
}
test('the lighting HUD touches the DOM only for the values that actually changed',()=>{
  const log=writeLog(),h=harness({button:log.button,line:log.line});
  h.ui.hud();assert.ok(log.writes.length>=8,'the first call paints every field');
  log.writes.length=0;for(let i=0;i<120;i++)h.ui.hud();assert.deepEqual(log.writes,[],'120 identical refreshes write nothing');
  h.run=L.torch(h.run).run;log.writes.length=0;h.ui.hud();
  assert.ok(log.writes.includes('button.dataset.light')&&log.writes.includes('button.title')&&log.writes.includes('line.textContent'));
  assert.ok(!log.writes.includes('button.innerHTML')&&!log.writes.includes('button.style.color')&&!log.writes.includes('button.disabled'),log.writes.join());
  log.writes.length=0;L.tick(h.run,1.5);h.ui.hud();assert.deepEqual([...log.writes].sort(),['button.title','line.textContent'],'only the countdown text changes');
  log.writes.length=0;h.G.shifting=true;h.ui.hud();assert.deepEqual(log.writes,['button.disabled']);h.G.shifting=false;h.ui.hud();
  assert.equal(h.button.disabled,false);assert.equal(h.button.dataset.icon,'daylight');assert.match(h.line.textContent,/^火把 /);
});
test('the HUD hides and shows with the tower and repaints after its nodes are replaced',()=>{
  let active=true;const log=writeLog();
  const context=vm.createContext({TowerLighting:L,TowerHeroes:H,document:{getElementById:id=>id==='towerLightBtn'?log.button:id==='towerLightStatus'?log.line:null}});vm.runInContext(runtimeSource,context);
  const run=P.enable(C.newRun({seed:2}),'mage').run,world=new T.Group(),G={px:0,pz:0,mazeW:7,mazeH:7,running:true,shifting:false,view:'tp'};
  const ui=context.TowerLightingRuntime.create({THREE:T,G,run:()=>run,active:()=>active,world:()=>world,player:()=>null,camera:()=>new T.PerspectiveCamera(),traders:()=>[],inDungeon:()=>false,environment:()=>({id:'echo',rig:{}}),clear:()=>true,cell:(cx,cy)=>({cx,cy,x:0,z:0}),chooseCell:()=>({x:4,z:4}),marker:()=>new T.Group(),dispose(){}});
  ui.hud();assert.equal(log.button.hidden,false);active=false;log.writes.length=0;ui.hud();assert.deepEqual(log.writes,['button.hidden','line.hidden']);ui.hud();assert.equal(log.writes.length,2);
  active=true;log.writes.length=0;ui.hud();assert.equal(log.button.hidden,false);assert.ok(log.writes.includes('button.hidden'));
});

function legacyPartyRobotLight(run){if(!H.enabled(run))return null;return H.ids(run).map(id=>{const power=L.robotLight(run,id);return power?{...power,actorId:id}:null;}).filter(Boolean).sort((a,b)=>b.radius-a.radius||b.tier-a.tier)[0]||null;}
test('the single-pass party robot light picks exactly what the former map/filter/sort chain picked',()=>{
  let seed=20260507;const random=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296,pick=list=>list[Math.floor(random()*list.length)];
  let withLight=0,ties=0;
  for(let round=0;round<160;round++){
    let run=H.enable(P.enable(C.newRun({seed:900+round}),pick(['robot','mage','scout'])).run).run;const ids=['hero'];
    for(let i=0;i<Math.floor(random()*5);i++){const m={id:'rand-'+round+'-'+i,profession:pick(['robot','robot','robot','scout','mage']),sex:pick(['male','female']),level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(m);run.party.joined.push(m.id);H.addMember(run,m);ids.push(m.id);}
    for(const id of ids){const equipment=H.equipment(run,id);if(H.job(run,id)==='robot'&&equipment){for(const slot of ['core1','core2']){const roll=random();equipment[slot]=roll<(slot==='core2'?.7:.15)?null:C.createGear(R.kind('robot_core',pick([1,1,2,3])),99,run.seed,id+slot);if(equipment[slot]&&random()<.2)equipment[slot].durability=0;}}if(random()<.2)H.setHp(run,id,0);}
    const expected=legacyPartyRobotLight(run),actual=L.partyRobotLight(run);assert.deepEqual(actual,expected,'round '+round);
    if(actual){withLight++;if(ids.filter(id=>L.robotLight(run,id)?.radius===actual.radius&&L.robotLight(run,id)?.tier===actual.tier).length>1)ties++;}
  }
  assert.ok(withLight>80&&ties>5,withLight+' parties with a robot light, '+ties+' exact ties');
  assert.equal(L.partyRobotLight({party:{}}),null);
});
test('lighting rules ask the party for a robot light only when the answer is used',()=>{
  const calls={ids:0},stub={...H,ids:run=>{calls.ids++;return H.ids(run);}},context=vm.createContext({TowerHeroes:stub,TowerCore:C,TowerEncounters:E});vm.runInContext(coreSource,context);
  const lighting=context.TowerLighting;let run=H.enable(P.enable(C.newRun({seed:77}),'robot').run).run;
  Object.assign(run.party.light,{daylight:30,cooldown:30});assert.equal(lighting.portableInfo(run).mode,'daylight');assert.equal(calls.ids,0,'daylight outranks every core, so none is consulted');
  Object.assign(run.party.light,{daylight:0,cooldown:0,lit:false,fuel:0});lighting.tick(run,.016);assert.equal(calls.ids,0,'an unlit torch burns nothing, so the tick skips the lookup');
  run.party.light.lit=true;run.party.light.fuel=100;lighting.tick(run,.016);assert.equal(calls.ids,1);
  run.party.light.lit=false;assert.equal(lighting.portableInfo(run).mode,'core');assert.equal(calls.ids,2);
});
