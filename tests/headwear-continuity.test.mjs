import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),H=require('../story/tower-heroes-core.js'),Actors=require('../story/tower-cinematic-actors.js'),Theater=require('../story/tower-story-theater.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),builder=html.slice(start,html.indexOf('\n}',start)+2),source=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
function environment(visual=source,motion=false){const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,TowerHeroes:H,...(motion?{TowerCombatMotion:require('../story/tower-combat-motion.js')}:{} )});e.window=e;vm.runInContext(builder,e);vm.runInContext(visual,e);return e;}
const env=environment(),V=env.TowerHeroVisuals,jobs=Object.keys(H.JOBS).filter(job=>job!=='robot'),sexes=['male','female'];
const item=(kind,slot='helmet')=>({id:kind,kind,slot,durability:100,maxDurability:100});
const headKind=job=>({heavy:'heavy_helm',light:'light_hood',robe:'rune_crown'})[H.JOBS[job].armor];
function figure(job,sex,tier=1,e=env){const model=e.TowerHeroVisuals.base(job,e.buildCharacter,'hero',sex),helmet=item(H.tierKind(headKind(job),tier));e.TowerHeroVisuals.dress(T,model,{helmet},release);return {model,helmet,hat:model.userData.heroPieces[0]};}
function resources(model){const set=new Set();model.traverse(n=>{if(n.geometry)set.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m){set.add(m);for(const v of Object.values(m))if(v?.isTexture)set.add(v);}});return set;}
function release(model){for(const r of resources(model))r.dispose();}
function used(geometry){const p=geometry.attributes.position;return geometry.index?[...new Set(geometry.index.array)]:Array.from({length:p.count},(_,i)=>i);}
function inHead(node,head){node.updateWorldMatrix(true,false);head.updateWorldMatrix(true,false);return new T.Matrix4().copy(head.matrixWorld).invert().multiply(node.matrixWorld);}
function seam(model){const head=model.userData.head,crown=head.children.find(n=>n.name==='hair-crown'),drape=head.children.find(n=>n.name==='profession-hair'&&n.userData.continuousHair),lower=new Set(used(drape.geometry));assert.ok(crown&&drape);const matrix=inHead(drape,head),ids=used(crown.geometry).filter(i=>lower.has(i));assert.equal(ids.length,28,'only the real indexed crown/drape boundary is sampled');return ids.map(i=>new T.Vector3().fromBufferAttribute(drape.geometry.attributes.position,i).applyMatrix4(matrix));}
function capProbe(hat,head){const cap=hat.children.find(n=>n.isMesh&&n.geometry.type==='SphereGeometry'&&n.geometry.parameters.thetaLength===Math.PI/2);assert.ok(cap,'a separately owned, indexed half-sphere forms the physical cap');const material=new T.MeshBasicMaterial({side:T.DoubleSide}),probe=new T.Mesh(cap.geometry,material);inHead(cap,head).decompose(probe.position,probe.quaternion,probe.scale);probe.updateMatrixWorld(true);return {probe,dispose:()=>material.dispose()};}
function radialCoverage(model,hat){const head=model.userData.head,drape=head.children.find(n=>n.name==='profession-hair'&&n.userData.continuousHair),points=seam(model),{probe,dispose}=capProbe(hat,head),ray=new T.Raycaster(),gaps=[];try{if(!drape.visible)return gaps;for(const point of points){const center=new T.Vector3(0,point.y,-.018),direction=point.clone().sub(center).normalize();ray.set(center,direction);const hit=ray.intersectObject(probe,false)[0],distance=center.distanceTo(point);if(!hit||hit.distance<distance-.001)gaps.push({at:point.toArray().map(v=>+v.toFixed(5)),clearance:hit?+(hit.distance-distance).toFixed(5):null});}}finally{dispose();}return gaps;}
function closeMatrix(a,b,label){for(let i=0;i<16;i++)assert.ok(Math.abs(a.elements[i]-b.elements[i])<1e-9,label+' matrix '+i);}

test('actual cap triangles cover every visible indexed hair seam and fit the scalp of all five male and female leather and heavy headgear tiers',()=>{
  let checked=0;
  for(const job of jobs.filter(j=>headKind(j)!=='rune_crown'))for(const sex of sexes)for(let tier=1;tier<=5;tier++){
    const {model,hat}=figure(job,sex,tier),label=`${job} ${sex} tier ${tier}`;assert.equal(hat.parent,model.userData.head,label+' follows the head bone');
    assert.deepEqual(radialCoverage(model,hat),[],label+' cap must hide the complete real visible hair boundary');const head=model.userData.head,skin=model.userData.headMesh,skinMatrix=inHead(skin,head),skinTop=Math.max(...used(skin.geometry).map(i=>new T.Vector3().fromBufferAttribute(skin.geometry.attributes.position,i).applyMatrix4(skinMatrix).y)),{probe,dispose}=capProbe(hat,head),top=Math.max(...used(probe.geometry).map(i=>probe.localToWorld(new T.Vector3().fromBufferAttribute(probe.geometry.attributes.position,i)).y));assert.ok(top>skinTop&&top<skinTop+.13,label+' cap contains the actual scalp without floating high above it');dispose();checked++;release(model);
  }
  assert.equal(checked,50);
});

test('all seventy organic headgear variants follow four animated head orientations without moving relative to hair or allocating surfaces',()=>{
  let checked=0;
  for(const job of jobs)for(const sex of sexes)for(let tier=1;tier<=5;tier++){
    const {model,hat}=figure(job,sex,tier),head=model.userData.head,baseline=inHead(hat,head),original=resources(model),label=`${job} ${sex} tier ${tier}`,session=Actors.create({actor:model,performance:'guide',speechAnimation:false});
    for(const [x,y,z]of [[0,0,0],[.24,.35,.06],[-.20,-.34,-.07],[.12,-.28,.03]]){head.rotation.set(x,y,z);closeMatrix(inHead(hat,head),baseline,label);if(headKind(job)!=='rune_crown')assert.deepEqual(radialCoverage(model,hat),[],label+' turning keeps cap seam covered');}
    for(const seconds of [.5,1.8,3.6,6.9]){session.sample(seconds,{phase:'playing',speaking:false});closeMatrix(inHead(hat,head),baseline,label+' cinema');}
    assert.deepEqual(resources(model),original,label+' gestures allocate no mesh resources');session.restore();checked++;release(model);
  }
  assert.equal(checked,70);
});

test('physical headgear leaves both eyes and mouth visible from the local front at every profession, sex and tier',()=>{
  const ray=new T.Raycaster();
  for(const job of jobs)for(const sex of sexes)for(let tier=1;tier<=5;tier++){
    const {model,hat}=figure(job,sex,tier),head=model.userData.head;model.updateMatrixWorld(true);
    for(const part of [...model.userData.face.eyes,model.userData.face.mouth]){const target=part.getWorldPosition(new T.Vector3()),local=head.worldToLocal(target.clone()),origin=head.localToWorld(new T.Vector3(local.x,local.y,1)),direction=target.clone().sub(origin).normalize();ray.set(origin,direction);const hits=ray.intersectObject(hat,true).filter(hit=>hit.distance<origin.distanceTo(target)-.001);assert.equal(hits.length,0,`${job} ${sex} tier ${tier}: ${part.name||'face'} visible through actual hat triangles`);}
    release(model);
  }
});

test('hiding, removing and breaking every headgear tier restores the identical hairstyle and retires replaced hat resources once',()=>{
  for(const job of jobs)for(const sex of sexes)for(let tier=1;tier<=5;tier++){
    const {model,hat,helmet}=figure(job,sex,tier),head=model.userData.head,hair=head.children.filter(n=>/hair|braid|bun/.test(n.name)),original=hair.map(n=>({n,g:n.geometry,m:n.material,p:n.position.toArray(),s:n.scale.toArray()})),input=JSON.stringify(helmet),old=resources(hat),counts=new Map([...old].map(r=>[r,0]));for(const r of old)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
    const full=()=>{for(const r of original){assert.ok(r.n.visible,job+' '+sex+' restores original hair');assert.equal(r.n.geometry,r.g);assert.equal(r.n.material,r.m);assert.deepEqual(r.n.position.toArray(),r.p);assert.deepEqual(r.n.scale.toArray(),r.s);}};
    const hats=()=>model.userData.heroPieces.filter(n=>H.GEAR[helmet.kind].baseKind===n.userData.baseKind);
    V.dress(T,model,{helmet},release,{showHelmet:false});assert.equal(hats().length,0);assert.equal(hat.parent,null);full();for(const count of counts.values())assert.equal(count,1,'each replaced hat-owned GPU resource retired once');
    V.dress(T,model,{helmet},release);V.dress(T,model,{helmet:{...helmet,durability:0}},release);assert.equal(hats().length,0);full();
    V.dress(T,model,{helmet},release);V.dress(T,model,{helmet:null},release);assert.equal(hats().length,0);full();assert.equal(JSON.stringify(helmet),input,'display and break simulation never mutate equipment');release(model);
  }
});

test('head-mounted hats stay hidden in first person and are restored on return for legacy and current combat motion',()=>{
  for(const motion of [false,true])for(const job of jobs)for(const sex of sexes){const e=environment(source,motion),{model,hat}=figure(job,sex,3,e),weapon=item(H.JOBS[job].starter,'weapon'),helmet=item(H.tierKind(headKind(job),3));e.TowerHeroVisuals.dress(T,model,{helmet,weapon},release);const fitted=model.userData.heroPieces.find(n=>n.userData.baseKind===headKind(job));e.TowerHeroVisuals.pose(model,0,1,true,0);assert.equal(fitted.visible,false,job+' '+sex+' headwear cannot block the first-person camera');e.TowerHeroVisuals.pose(model,0,1,false,0);assert.equal(fitted.visible,true);assert.equal(fitted.parent,model.userData.head);assert.equal(hat.parent,null);release(model);}
});

test('cinematic clones keep all fitted headwear attached without modifying or retiring borrowed game resources',()=>{
  for(const job of jobs)for(const sex of sexes){const {model}=figure(job,sex,5),original=resources(model),counts=new Map([...original].map(r=>[r,0]));for(const r of original)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));const sourceHead=model.userData.head,sourcePose=sourceHead.quaternion.toArray(),stage=Theater.create({THREE:T,hero:model}),copy=stage.hero,hat=copy.userData.heroPieces[0],session=Actors.create({actor:copy,performance:'challenge',speechAnimation:false}),baseline=inHead(hat,copy.userData.head);assert.equal(hat.parent,copy.userData.head);for(const seconds of [0,.8,2.1,4.5]){session.sample(seconds,{phase:'playing',speaking:false});closeMatrix(inHead(hat,copy.userData.head),baseline,job+' '+sex+' borrowed costume');}session.restore();stage.dispose();assert.deepEqual(sourceHead.quaternion.toArray(),sourcePose);assert.equal(model.userData.heroPieces[0].parent,sourceHead);for(const count of counts.values())assert.equal(count,0,'cinema never disposes original equipped resources');release(model);}
});

test('robot head articulation and five integrated shell tiers do not gain organic hats or hair',()=>{
  for(const sex of sexes)for(let tier=1;tier<=5;tier++){const model=V.base('robot',env.buildCharacter,'hero',sex),head=model.userData.head,parts=head.children.slice(),before=parts.map(n=>({n,g:n.geometry,p:n.position.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray()})),equipment={helmet:null,armor:item(H.tierKind('robot_shell',tier),'armor'),weapon:item(H.tierKind('robot_fists',tier),'weapon')};V.dress(T,model,equipment,release);assert.deepEqual(head.children,parts);for(const r of before){assert.equal(r.n.geometry,r.g);assert.deepEqual(r.n.position.toArray(),r.p);assert.deepEqual(r.n.quaternion.toArray(),r.q);assert.deepEqual(r.n.scale.toArray(),r.s);}assert.ok(model.userData.heroPieces.every(n=>n.parent!==head));assert.equal(head.children.some(n=>/hair|hat|helm/.test(n.name)),false);release(model);}
});

test('the indexed geometric detector rejects the previous floating root-mounted female ranger hat',()=>{
  const {model,hat}=figure('scout','female');assert.deepEqual(radialCoverage(model,hat),[]);model.userData.head.remove(hat);model.add(hat);hat.position.set(0,0,0);hat.quaternion.identity();hat.scale.set(1,1,1);assert.ok(radialCoverage(model,hat).length>=20,'real former mounting has a missing physical bridge, not just a changed parent name');const relative=inHead(hat,model.userData.head);model.userData.head.rotation.y=.3;assert.throws(()=>closeMatrix(inHead(hat,model.userData.head),relative,'root-mounted negative control'));release(model);
});
