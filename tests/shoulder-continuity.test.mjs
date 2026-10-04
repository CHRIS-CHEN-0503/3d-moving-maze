import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),CM=require('../assets/character-motion.js'),H=require('../story/tower-heroes-core.js'),M=require('../story/tower-combat-motion.js'),Actors=require('../story/tower-cinematic-actors.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),builder=html.slice(start,html.indexOf('\n}',start)+2),source=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
const call='    joinHumanShoulders(T,m);';assert.ok(source.includes(call));
function environment(code=source){const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,CharacterMotion:CM,TowerHeroes:H,TowerCombatMotion:M});e.window=e;vm.runInContext(builder,e);vm.runInContext(code,e);return e;}
const env=environment(),oldEnv=environment(source.replace(call,'')),V=env.TowerHeroVisuals,jobs=Object.keys(H.JOBS).filter(j=>j!=='robot');
const item=(kind,slot)=>({id:slot,kind,slot,durability:100,maxDurability:100});
function equipment(job,tier=1,alternate=false){const def=H.JOBS[job],armor=def.armor==='heavy'?'heavy_armor':def.armor==='robe'?'robe':'light_armor',weapon=({swordsman:alternate?'greatsword':'longsword',smith:alternate?'warhammer':'smith_hammer',scout:'twin_daggers',mage:'arcane_staff',healer:'spellbook',chef:'cooking_pan',archer:'elven_bow'})[job];return {armor:item(H.tierKind(armor,tier),'armor'),weapon:item(H.tierKind(weapon,tier),'weapon')};}
function figure(job,sex,tier=0,alternate=false,e=env){const m=e.TowerHeroVisuals.base(job,e.buildCharacter,'hero',sex);if(tier)e.TowerHeroVisuals.dress(T,m,equipment(job,tier,alternate),()=>{});return m;}
function release(m){const gs=new Set(),ms=new Set(),ts=new Set();m.traverse(p=>{if(p.geometry)gs.add(p.geometry);for(const mat of Array.isArray(p.material)?p.material:[p.material])if(mat){ms.add(mat);for(const v of Object.values(mat))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
function budget(m){let meshes=0,triangles=0;m.traverse(p=>{assert.ok(!p.isLight);if(p.isMesh){meshes++;triangles+=(p.geometry.index?.count??p.geometry.attributes.position.count)/3;}});return {meshes,triangles};}

// Intersect the actual indexed triangle surfaces, in character space. Bounds
// can overlap while leaving empty shoulders, so they are not success evidence.
const probeMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster(),inverse=new T.Matrix4(),relative=new T.Matrix4();
function interval(mesh,y,z,side=0){if(!mesh?.isMesh)return null;const probe=new T.Mesh(mesh.geometry,probeMaterial);probe.matrixWorld.copy(relative.multiplyMatrices(inverse,mesh.matrixWorld));ray.set(new T.Vector3(-2,y+.000007,z+.000011),new T.Vector3(1,0,0));const hits=ray.intersectObject(probe,false).map(h=>h.point.x).filter(x=>!side||Math.sign(x)===side).filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>1e-6);return hits.length>1?[Math.min(...hits),Math.max(...hits)]:null;}
const overlap=(a,b)=>a&&b?Math.min(a[1],b[1])-Math.max(a[0],b[0]):-Infinity;
function continuity(m){m.updateMatrixWorld(true);inverse.copy(m.matrixWorld).invert();const torso=m.userData.body.visible?[m.userData.body]:m.userData.heroPieces.filter(p=>p.userData.baseKind&&['heavy_armor','light_armor','robe'].includes(p.userData.baseKind)).flatMap(p=>p.children.filter(p=>p.isMesh&&p.geometry.type==='LatheGeometry'));assert.equal(torso.length,1,'test the actual closed torso, not the bounds of disconnected armor trim');const result=[];
  for(const [key,side]of [['armR',-1],['armL',1]]){const arm=m.userData[key],joint=m.userData.shoulderJoints?.[0],sleeve=arm.children.find(p=>p.name==='connected-shoulder-sleeve');
    for(const z of [-.045,0,.045]){const y=arm.position.y,body=torso.map(p=>interval(p,y,z)).filter(Boolean),outer=interval(sleeve,y,z),bridge=interval(joint,y,z,side),connected=bridge?body.some(inner=>overlap(inner,bridge)>.005)&&overlap(bridge,outer)>.005:body.some(inner=>overlap(inner,outer)>.005);result.push({key,z,connected,body,outer,bridge});}
  }return result;
}
function assertContinuity(m,label){for(const x of continuity(m))assert.ok(x.connected,`${label}: ${JSON.stringify(x)}`);}
function pose(m,action='attack',variant=0,time=1,family=''){M.begin(m,action,1,{effect:family});Object.assign(M.state(m),{variant,elapsed:time,family});V.pose(m,0,1,false,0);}

test('the photographed female ranger has real empty shoulders before the fix, and continuous fitted shoulders afterwards',()=>{
  const before=figure('scout','female',1,false,oldEnv),after=figure('scout','female',1);pose(before);pose(after);
  assert.ok(continuity(before).some(p=>!p.connected),'negative control must reproduce the separated sleeve/armor');assertContinuity(after,'female ranger');
  const sleeve=after.userData.armR.children.find(p=>p.name==='connected-shoulder-sleeve');before.userData.armR.geometry.computeBoundingBox();after.userData.armR.geometry.computeBoundingBox();assert.deepEqual(after.userData.armR.geometry.boundingBox,before.userData.armR.geometry.boundingBox);assert.equal(after.userData.shoulderJoints[0].material,sleeve.material,'joint uses the existing tailored sleeve surface');release(before);release(after);
});

test('seven human male/female professions retain shoulder overlap bare and in five armor tiers through walks, both strikes and skill gestures',t=>{
  let frames=0;for(const job of jobs)for(const sex of ['male','female'])for(let tier=0;tier<=5;tier++)for(const alternate of job==='swordsman'||job==='smith'?[false,true]:[false]){
    const m=figure(job,sex,tier,alternate),label=`${job} ${sex} tier ${tier} ${alternate?'two-hand':'default'}`;pose(m);assertContinuity(m,label+' rest');frames++;
    for(const variant of [0,1])for(const time of [0,.22,.48,.7,.9,1]){pose(m,'attack',variant,time);assertContinuity(m,label+` strike ${variant} ${time}`);frames++;}
    for(const family of ['cast','heal','ward','rally','cook','forge','deploy','scout','thrust','spin'])for(const time of [.22,.48,.7]){pose(m,'skill',0,time,family);assertContinuity(m,label+` ${family} ${time}`);frames++;}
    M.cancel(m);for(let i=0;i<20;i++){CM.update(m,.05,i*.05,true);assertContinuity(m,label+' walk');frames++;}release(m);
  }t.diagnostic(`${frames} frames, ${frames*6} actual triangle-line sections across 108 human/equipment variants; both shoulders at three depth sections`);
});

test('shoulder fitting preserves the actual arm pivots, hands, silhouettes, bow reach and two-hand sword support',()=>{
  for(const job of jobs)for(const sex of ['male','female'])for(const alternate of job==='swordsman'||job==='smith'?[false,true]:[false]){const m=figure(job,sex,3,alternate),before=figure(job,sex,3,alternate,oldEnv);assert.deepEqual(m.scale.toArray(),before.scale.toArray());for(const key of ['armR','armL'])assert.deepEqual(m.userData[key].position.toArray(),before.userData[key].position.toArray());
    for(const variant of [0,1])for(const time of [0,.22,.48,.7,.9,1]){pose(m,'attack',variant,time);pose(before,'attack',variant,time);m.updateMatrixWorld(true);before.updateMatrixWorld(true);for(const key of ['armR','armL'])assert.deepEqual(m.userData[key].matrixWorld.toArray(),before.userData[key].matrixWorld.toArray());for(let i=0;i<m.userData.heroPieces.length;i++)assert.deepEqual(m.userData.heroPieces[i].matrixWorld.toArray(),before.userData.heroPieces[i].matrixWorld.toArray(),'weapon and armor world mounts unchanged');}
    if(job==='archer'){assert.equal(m.userData.bowArms.right.upper,m.userData.armR);assert.equal(m.userData.bowArms.left.upper,m.userData.armL);}if(job==='swordsman'&&sex==='male'&&alternate)assert.equal(m.userData.swordSupportArm.active,true);release(m);release(before);
  }
});

test('fixed shoulder sockets share owned geometry, add no textures or lights and reuse all resources through walking and combat',()=>{
  for(const job of jobs)for(const sex of ['male','female']){const m=figure(job,sex),before=figure(job,sex,0,false,oldEnv),count=budget(m),oldCount=budget(before),joints=m.userData.shoulderJoints;assert.equal(joints.length,1);assert.equal(joints[0].parent,m);assert.equal(joints[0].userData.shoulderCenters.length,2);assert.equal(count.meshes-oldCount.meshes,1);assert.equal(count.triangles-oldCount.triangles,64);assert.ok(count.meshes<65&&count.triangles<7000,job+' '+sex+' '+JSON.stringify(count)+' fits existing budget');
    const refs=[];m.traverse(p=>refs.push([p,p.geometry,p.material,p.material?.map]));for(let i=0;i<80;i++){CM.update(m,.04,i*.04,true);if(i%20===0)M.begin(m,'attack',.6);V.pose(m,0,1,false,.04);}const after=[];m.traverse(p=>after.push([p,p.geometry,p.material,p.material?.map]));assert.deepEqual(after,refs);assert.deepEqual(budget(m),count);
    let disposed=0;joints[0].geometry.addEventListener('dispose',()=>disposed++);release(m);assert.equal(disposed,1,'shared socket geometry has exactly one owner disposal');release(before);
  }
  const robot=figure('robot','female');assert.equal(robot.userData.shoulderJoints,undefined,'robot already has a separately joined mechanical frame');release(robot);
});

test('real cinematic guide, challenge, injury and farewell gestures preserve shoulder connections and restore the original pose',()=>{
  for(const job of jobs)for(const sex of ['male','female'])for(const tier of [0,1,5]){const m=figure(job,sex,tier),nodes=[];m.traverse(p=>nodes.push([p,p.position.toArray(),p.quaternion.toArray(),p.scale.toArray(),p.geometry,p.material]));
    for(const performance of ['guide','challenge','hurt','farewell']){const scene=Actors.create({target:m,performance});for(const time of [.55,1.25,2.3,3.5]){scene.sample(time,{speaking:true});assertContinuity(m,`${job} ${sex} tier ${tier} movie ${performance} ${time}`);}scene.restore();for(const [p,position,quaternion,scale,geometry,material]of nodes){assert.deepEqual(p.position.toArray(),position);assert.deepEqual(p.quaternion.toArray(),quaternion);assert.deepEqual(p.scale.toArray(),scale);assert.equal(p.geometry,geometry);assert.equal(p.material,material);}}
    release(m);
  }
});
