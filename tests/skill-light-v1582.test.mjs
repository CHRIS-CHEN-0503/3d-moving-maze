import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),Art=require('../story/tower-creature-art.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const load=()=>{const c=vm.createContext({});vm.runInContext(read('story/tower-skill-effects.js'),c);return c.TowerSkillEffects;};
const V=load(),S=H.SKILLS;
function manager(options={}){const world=new T.Group(),flashes=[],kicks=[];const fx=V.create(T,{world:()=>world,limit:12,flash:(at,color,power,seconds)=>flashes.push({at:{...at},color,power,seconds}),kick:(amount,seconds)=>kicks.push({amount,seconds}),...options});return {fx,world,flashes,kicks};}

test('casting and landing light the floor in the skill colour through the flash slot, strongest where something lands',()=>{
  const {fx,flashes,kicks}=manager(),colors=s=>V.colorsFor(s);
  fx.emit(S.arcane_bolt,{x:2,z:-1});assert.deepEqual(flashes.at(-1),{at:{x:2,y:1.4,z:-1},color:colors(S.arcane_bolt)[1],power:3.2,seconds:.34});
  fx.emit(S.wind_slash,{x:0,z:0},0,{impact:true,weapon:'blade'});assert.deepEqual([flashes.at(-1).power,flashes.at(-1).seconds,flashes.at(-1).at.y],[2.4,.2,1.15],'a landed hit is a short burst at chest height');
  fx.emit(S.herbal_heal,{x:0,z:0});assert.deepEqual([flashes.at(-1).power,flashes.at(-1).seconds],[2,.75],'support light is gentle and lingers');
  const before=flashes.length;fx.emit(S.starfall,{x:0,z:0},0,{stage:'charge',duration:1.5});assert.equal(flashes.length,before,'gathering power does not flash');
  fx.emit(S.decisive_slash,{x:0,z:0},0,{stage:'land'});assert.deepEqual([flashes.at(-1).power,flashes.at(-1).seconds],[6,.55]);assert.deepEqual(kicks.at(-1),{amount:.14,seconds:.3},'a landing shakes the view');
  fx.emit({id:'monster-defeat',job:'mage',effect:'stun',presentation:{colors:[0xfff4dc,0xcf95bc]}},{x:1,z:1},0,{stage:'land',defeat:true});
  assert.deepEqual([flashes.at(-1).color,flashes.at(-1).power],[0xcf95bc,3],'a defeat glows in the enemy colour');assert.equal(kicks.length,1,'and does not shake the view');
  assert.equal(flashes.every(f=>f.power>0&&f.power<=8&&f.seconds<=1.2),true);fx.destroy();
});

test('only heavy moments kick the view: landings, quakes and unique attacks; never ordinary hits or reduced motion',()=>{
  const {fx,kicks}=manager();
  for(const s of [S.wind_slash,S.arcane_bolt,S.piercing_arrow,S.herbal_heal])fx.emit(s,{x:0,z:0});fx.emit(S.hammer_bash,{x:0,z:0},0,{impact:true});assert.equal(kicks.length,0);
  fx.emit(S.worldtree_arrow,{x:0,z:0});assert.deepEqual(kicks.at(-1),{amount:.08,seconds:.22},'a unique attack cast gives a light kick');
  fx.emit(S.shoulder_quake,{x:0,z:0});assert.equal(kicks.at(-1).amount,.14,'the robot quake lands where it is cast');fx.destroy();
  const calm=manager({reducedMotion:true});calm.fx.emit(S.decisive_slash,{x:0,z:0},0,{stage:'land'});calm.fx.emit(S.worldtree_arrow,{x:0,z:0});
  assert.equal(calm.kicks.length,0,'reduced motion never moves the view');assert.equal(calm.flashes[0].power,6*.6,'and dims the flash');calm.fx.destroy();
  const bare=V.create(T,{world:()=>new T.Group()});assert.doesNotThrow(()=>{bare.emit(S.decisive_slash,{x:0,z:0},0,{stage:'land'});bare.tick(1);});bare.destroy();
});

test('a falling star lands within a third of a second of its damage, and lights the room and shakes the view as it lands, once',()=>{
  const {fx,flashes,kicks}=manager(),f=fx.emit(S.starfall,{x:0,z:0},0,{stage:'land'});assert.equal(f.family,'meteor');assert.equal(flashes.length,0,'nothing while it is still high up');
  const landing=V.METEOR_FALL,rock=f.group.children.find(o=>o.isMesh&&o.geometry.type==='DodecahedronGeometry');
  fx.tick(landing-.05);assert.equal(flashes.length,0);assert.ok(rock.position.y>.2,'still falling');
  fx.tick(.06);assert.equal(flashes.length,1);assert.equal(kicks.length,1);assert.ok(rock.position.y<.2,'the light comes as the rock lands');assert.ok(V.METEOR_FALL<=.35);
  fx.tick(.2);assert.equal(flashes.length,1,'only once');fx.destroy();
});

test('a blade arc is a coloured afterimage: bright leading tip, fading tail, gone in about a third of a second',()=>{
  const {fx}=manager(),f=fx.emit(S.wind_slash,{x:0,z:0}),sweeps=f.group.children.filter(o=>o.isMesh&&o.geometry.userData.shapeKey==='sweep');
  assert.equal(sweeps.length,2);
  for(const sweep of sweeps){const c=sweep.geometry.attributes.color,p=sweep.geometry.attributes.position;assert.equal(c.itemSize,4);
    let head=0,tail=1,minX=Infinity,maxX=-Infinity;for(let v=0;v<p.count;v++){if(p.getX(v)<minX){minX=p.getX(v);head=c.getW(v);}if(p.getX(v)>maxX){maxX=p.getX(v);tail=c.getW(v);}}
    assert.ok(head>.95&&tail<.35,'leading tip '+head+', trailing tip '+tail);assert.equal(sweep.material.userData.envelope,'slash');}
  const main=sweeps.find(s=>s.material.userData.baseOpacity===1),ground=f.group.getObjectByName('spell-contact-light');assert.ok(main,'the main arc is fully opaque at its peak');
  fx.tick(.12);assert.ok(main.material.opacity>.9,'bright while swinging');
  fx.tick(.45);assert.equal(main.material.opacity,0,'gone by about half a second');assert.ok(ground.material.opacity>0,'while the floor glow lingers');fx.destroy();
  // The body colour is the skill's saturated tone, not a pale silhouette that additive blending washes to white.
  const ink=sweeps[0].geometry.attributes.color,[pale,deep]=V.colorsFor(S.wind_slash).map(n=>new T.Color(n));let bodies=0;
  for(let v=0;v<ink.count;v++)if(Math.abs(ink.getX(v)-ink.getZ(v))>.2)bodies++;assert.ok(bodies>ink.count*.4,'most of the arc carries colour');assert.ok(deep.b<pale.b);
});

test('impact cores burst at their largest first, and solid bodies keep their colour with normal blending',()=>{
  for(const [skill,options]of [[S.hammer_bash,{impact:true}],[S.decisive_slash,{stage:'land'}],[S.flying_fist,{impact:true}]]){
    const {fx}=manager(),f=fx.emit(skill,{x:0,z:0},0,options),core=f.parts.find(p=>p.mode==='pop');assert.ok(core,skill.id+' '+f.family);
    fx.tick(.01);const early=core.m.scale.x;fx.tick(.3);assert.ok(core.m.scale.x<early*.75,skill.id+' shrinks after the burst');fx.destroy();
  }
  const solids={starfall:[{stage:'land'},'DodecahedronGeometry'],herbal_heal:[{},'ShapeGeometry'],arcane_bolt:[{},'IcosahedronGeometry']};
  for(const [id,[options,type]]of Object.entries(solids)){const {fx}=manager(),f=fx.emit(S[id],{x:0,z:0},0,options),body=f.group.children.find(o=>o.isMesh&&o.geometry.type===type&&o.material.vertexColors);
    assert.ok(body,id);assert.equal(body.material.blending,T.NormalBlending,id+' is not washed out by additive stacking');fx.destroy();}
});

test('a landed hit brightens the enemy for a moment and restores every material exactly, even across repeated hits or a defeat',()=>{
  const c=vm.createContext({});vm.runInContext(read('story/tower-combat-readability.js'),c);const R=c.TowerCombatReadability;
  const model=Art.build(T,'mushroom',{color:0xcf95bc}),lit=[];model.traverse(o=>{if(o.material?.emissive)lit.push(o.material);});assert.ok(lit.length>0);
  const shared=new T.MeshLambertMaterial({emissive:0x112233});shared.userData.sharedResource=true;model.add(new T.Mesh(new T.BoxGeometry(),shared));
  const original=lit.map(m=>[m.emissive.getHex(),m.emissiveIntensity]),m={model,alive:true,def:{ranged:false},windup:0};
  R.update(T,m,{dt:0});R.hit(T,model,0xffffff);R.update(T,m,{dt:.02});
  assert.ok(lit.every((mat,i)=>mat.emissive.getHex()!==original[i][0]),'the enemy flashes');assert.equal(shared.emissive.getHex(),0x112233,'shared materials are never touched');
  R.update(T,m,{dt:.05});R.hit(T,model,0xffaa66);R.update(T,m,{dt:.02});
  for(let i=0;i<20;i++)R.update(T,m,{dt:.02});assert.deepEqual(lit.map(mat=>[mat.emissive.getHex(),mat.emissiveIntensity]),original,'a second hit mid-flash still restores the true originals');
  R.hit(T,model,0xffffff);R.update(T,m,{dt:.02});m.alive=false;R.update(T,m,{dt:.02});assert.deepEqual(lit.map(mat=>[mat.emissive.getHex(),mat.emissiveIntensity]),original,'a defeat restores at once');
  // The recoil squash respects reduced motion.
  const body=new T.Group(),squash=new T.Group();squash.userData.body=body;body.scale.set(1,1,1);squash.add(new T.Mesh(new T.BoxGeometry(),new T.MeshLambertMaterial()));const live={model:squash,alive:true,def:{},windup:0};
  R.update(T,live,{dt:0});R.hit(T,squash);R.update(T,live,{dt:.08});assert.ok(body.scale.y<1,'a hit squashes the body');
  for(let i=0;i<10;i++)R.update(T,live,{dt:.05});assert.equal(body.scale.y,1);
  R.hit(T,squash);R.update(T,live,{dt:.08,reducedMotion:true});assert.equal(body.scale.y,1,'no squash with reduced motion');
});

test('the story runtime wires light, view kick, enemy flash and defeat bursts without new lights or timers',()=>{
  const heroes=read('story/tower-heroes-runtime.js'),party=read('story/tower-party-runtime.js'),tower=read('story/tower-mode.js'),fx=read('story/tower-skill-effects.js');
  assert.match(heroes,/flash:ctx\.skillFlash,kick:\(amount,seconds\)=>root\.kickCamera\?\.\(amount,seconds\)/);
  assert.match(heroes,/root\.TowerCombatReadability\?\.hit\(T,m\.model,/);assert.match(heroes,/function defeat\(m,id=H\.state\(r\(\)\)\.active\)\{/);
  assert.match(party,/if\(result\.effect\.dead\)\{if\(modern\(\)\)heroes\.defeat\?\.\(m,memberId\|\|H\.state\(r\(\)\)\.active\);m\.alive=false;m\.model\.visible=false;/,'the burst starts before the enemy is hidden');
  assert.match(tower,/skillFlash:\(at,color,power,seconds\)=>lightingUI\?\.flash\?\.\(at,color,power,seconds\)/);
  assert.doesNotMatch(fx,/new T\.(?:Point|Spot|Directional|Ambient|Hemisphere)Light|setTimeout|setInterval|requestAnimationFrame/,'the effects still own no lights or timers');
});

test('the view kick turns the look direction only, fades, and is off in first person and with reduced motion',()=>{
  const html=read('index.html'),block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,a);return html.slice(i,j);};
  let now=1000,reduced=false;const looks=[];
  const camera={position:new T.Vector3(0,3,6),userData:{},lookAt(x,y,z){looks.push([x,y,z]);}},G={view:'tp',px:0,pz:0,camYaw:0,camPitch:0,wallH:3,wallBoxes:[],topZoom:20,owlUntil:0,visionUntil:0};
  const c=vm.createContext({G,camera,CFG:{cameraDistance:6},envGroup:null,scene:null,V3:T.Vector3,performance:{now:()=>now},window:{matchMedia:()=>({matches:reduced})},
    cameraDistance:d=>d,cameraClearDist:(x,z,d)=>d,updateTopMask(){},isShop:()=>false,LEVELS:[]});
  vm.runInContext(block('function updateCamera(dt)','\n</script>'),c);
  c.updateCamera(1);const rest=looks.at(-1),position=camera.position.clone();
  assert.equal(c.kickCamera(.14,.3),true);now+=40;c.updateCamera(0);const kicked=looks.at(-1);
  assert.ok(Math.hypot(kicked[0]-rest[0],kicked[1]-rest[1],kicked[2]-rest[2])>.01,'the view turns');assert.ok(camera.position.distanceTo(position)<1e-9,'the camera itself does not move');
  assert.equal(c.kickCamera(.05,.3),false,'a weaker kick does not cut a strong one short');
  now+=400;c.updateCamera(0);assert.deepEqual(looks.at(-1),rest,'and settles back');
  G.view='fp';assert.equal(c.kickCamera(.14),false,'never in first person');G.view='tp';
  reduced=true;assert.equal(c.kickCamera(.14),false,'never with reduced motion');
});
