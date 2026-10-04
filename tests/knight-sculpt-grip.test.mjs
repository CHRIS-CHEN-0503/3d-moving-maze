import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),H=require('../story/tower-heroes-core.js'),M=require('../story/tower-combat-motion.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),source=html.slice(start,html.indexOf('\n}',start)+2);
function environment(){const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,TowerHeroes:H,TowerCombatMotion:M});e.window=e;vm.runInContext(source,e);vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),e);return e;}
const env=environment(),V=env.TowerHeroVisuals;
const item=(kind,slot)=>({kind,slot,durability:100,maxDurability:100});
function figure(kind='longsword',tier=1,sex='male'){const model=V.base('swordsman',env.buildCharacter,'hero',sex);V.dress(T,model,{weapon:item(H.tierKind(kind,tier),'weapon'),armor:item(H.tierKind('heavy_armor',tier),'armor'),helmet:item(H.tierKind('heavy_helm',tier),'helmet'),shield:kind==='longsword'?item(H.tierKind('round_shield',tier),'shield'):null},()=>{});return {model,weapon:model.userData.heroPieces.find(p=>p.userData.baseKind===kind)};}
function frame(f,variant=0,time=1){M.begin(f.model,'attack',1);Object.assign(M.state(f.model),{variant,elapsed:time});f.model.userData.legL.rotation.x=f.model.userData.legR.rotation.x=0;V.pose(f.model,0,1,false,0);f.model.updateMatrixWorld(true);return {grip:f.weapon.localToWorld(new T.Vector3(...f.weapon.userData.contact.grip)),hand:f.model.userData.knightRightHand?.getWorldPosition(new T.Vector3())||f.model.userData.armR.localToWorld(new T.Vector3(0,-.36,.13)),edge:new T.Vector3(...f.weapon.userData.contact.normal).applyNormalMatrix(new T.Matrix3().getNormalMatrix(f.weapon.matrixWorld)),flat:new T.Vector3(0,0,1).applyNormalMatrix(new T.Matrix3().getNormalMatrix(f.weapon.matrixWorld))};}
function budget(model){let triangles=0,meshes=0;model.traverse(p=>{if(p.isMesh&&p.visible){for(let parent=p.parent;parent;parent=parent.parent)if(!parent.visible)return;triangles+=(p.geometry.index?.count||p.geometry.attributes.position.count)/3;meshes++;}assert.ok(!p.isLight);});return {triangles,meshes};}
function surfaceProbe(geometry){const skin=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster();skin.updateMatrixWorld(true);return {at(x,y){ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));const hit=ray.intersectObject(skin,false)[0];assert.ok(hit,`face surface exists at ${x}, ${y}`);return hit.point.z;},dispose(){skin.material.dispose();}};}
function frontSectionWidth(geometry,y){const p=geometry.attributes.position,index=geometry.index.array,xs=[];for(let i=0;i<index.length;i+=3)for(let j=0;j<3;j++){const a=index[i+j],b=index[i+(j+1)%3],ay=p.getY(a),by=p.getY(b);if((ay-y)*(by-y)>0||ay===by)continue;const t=(y-ay)/(by-ay),z=p.getZ(a)+(p.getZ(b)-p.getZ(a))*t;if(z>=-.001)xs.push(p.getX(a)+(p.getX(b)-p.getX(a))*t);}assert.ok(xs.length>2,'horizontal triangle section intersects the face');return Math.max(...xs)-Math.min(...xs);}

test('male knight face is longer with a tapered jaw while keeping the original surface budget and upper-head fit',()=>{
  const previous=S.head(T,.54,.55,.48,{jaw:1.06,cheek:1.12,chin:1.04,detail:'hero'}),model=V.base('swordsman',env.buildCharacter,'hero','male'),current=model.userData.headMesh.geometry;
  assert.equal(current.userData.knightFace,true);assert.equal(current.index.count,previous.index.count);assert.equal(current.attributes.position.count,previous.attributes.position.count);
  previous.computeBoundingBox();current.computeBoundingBox();const oldSize=previous.boundingBox.getSize(new T.Vector3()),size=current.boundingBox.getSize(new T.Vector3());
  assert.ok(size.y/size.x>oldSize.y/oldSize.x*1.12,'the face has a noticeably longer height-to-width ratio, not a uniformly smaller round head');
  assert.ok(frontSectionWidth(current,-.17)<frontSectionWidth(previous,-.17)*.9,'the lower jaw is slimmer rather than simply stretching the old sphere');
  assert.ok(current.boundingBox.min.y<previous.boundingBox.min.y-.025,'the chin extends downward');
  assert.ok(Math.abs(current.boundingBox.max.y-previous.boundingBox.max.y)<1e-6,'the scalp apex stays under the existing hair and helmet');
  const p=current.attributes.position,n=current.attributes.normal,old=previous.attributes.position;
  for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)assert.ok(Number.isFinite(p.array[i*3+axis])&&Number.isFinite(n.array[i*3+axis]));
  for(let i=0;i<p.count;i++)if(old.getY(i)>.10)assert.ok(new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3().fromBufferAttribute(old,i))<.004,'upper forehead and hairline remain fitted');
  assert.ok(budget(model).triangles<7000&&budget(model).meshes<65);previous.dispose();
});

test('slender male face anchors eyes, lips and expressions on its real triangle surface without extra frame resources',()=>{
  const model=V.base('swordsman',env.buildCharacter,'hero','male'),face=model.userData.face,probe=surfaceProbe(model.userData.headMesh.geometry);
  for(const part of [...face.eyes,...face.whites,...face.lids,...face.brows,face.mouth,...face.lips,...face.corners,...face.cheeks,face.teeth]){
    const {x,y,z}=part.position,surface=probe.at(x,y),gap=z-surface;
    assert.ok(gap>=-.012&&gap<=.020,`${part.name||'facial anchor'} fits the face surface, gap=${gap}`);
    assert.ok(Math.abs(face.surface(x,y)-surface)<=.008,`animated facial surface follows the remodeled face at ${x}, ${y}`);
  }
  const resources=[];model.traverse(p=>resources.push([p,p.geometry,p.material]));const shapes=new Set();
  for(let i=0;i<160;i++){F.update(model,i/30,F.moods[i%F.moods.length]);shapes.add(JSON.stringify([face.eyes[0].scale.y,face.brows[0].rotation.z,face.mouth.scale.toArray()]));for(const part of [...face.eyes,...face.brows,face.mouth,...face.lips])assert.ok([...part.position.toArray(),...part.scale.toArray(),...part.quaternion.toArray()].every(Number.isFinite));}
  assert.ok(shapes.size>8,'expressions still blink, speak and react on the new face');const after=[];model.traverse(p=>after.push([p,p.geometry,p.material]));assert.deepEqual(after,resources,'face expression updates do not allocate new meshes, geometry or materials');probe.dispose();
});

test('male-knight side-part hair leaves both eyebrows readable in calm and fully blended focus expressions',()=>{
  const model=V.base('swordsman',env.buildCharacter,'hero','male'),face=model.userData.face,hair=model.userData.head.children.filter(p=>['hair-crown','hair-fringe','profession-hair'].includes(p.name)),ray=new T.Raycaster();
  assert.equal(hair.length,2);assert.ok(hair.every(p=>p.visible));let time=0;
  for(const mood of ['calm','focus']){
    for(let step=0;step<10;step++){F.update(model,time,mood);time+=.25;}model.updateMatrixWorld(true);
    if(mood==='focus')assert.ok(face.brows.every(b=>Math.abs(b.rotation.z)>.23),'the test samples the real settled focus pose, not only its initial calm frame');
    for(let side=0;side<face.brows.length;side++)for(const u of [-.75,-.4,0,.4,.75]){
      const point=face.brows[side].localToWorld(new T.Vector3(u*.087/2,0,0));ray.set(new T.Vector3(point.x,point.y,point.z+1),new T.Vector3(0,0,-1));
      assert.equal(ray.intersectObjects(hair,false).find(hit=>hit.distance<1-.001),undefined,`${mood} eyebrow ${side}, span ${u}: actual hair triangles must not cover the brow centerline`);
    }
  }
});

test('slender face keeps both eyes and mouth unobstructed by every heavy-helmet tier, with safe display toggling',()=>{
  for(let tier=1;tier<=5;tier++){
    const model=V.base('swordsman',env.buildCharacter,'hero','male'),face=model.userData.face,head=model.userData.head,geometry=model.userData.headMesh.geometry,equipment={helmet:item(H.tierKind('heavy_helm',tier),'helmet')};
    V.dress(T,model,equipment,()=>{});model.updateMatrixWorld(true);const helmet=model.userData.heroPieces[0],ray=new T.Raycaster(),box=new T.Box3().setFromObject(model);
    for(const part of [...face.eyes,face.mouth]){const target=part.getWorldPosition(new T.Vector3()),from=new T.Vector3(target.x,target.y,box.max.z+1);ray.set(from,new T.Vector3(0,0,-1));const obstruction=ray.intersectObject(helmet,true).find(hit=>hit.distance<from.distanceTo(target)-.01);assert.equal(obstruction,undefined,`tier ${tier} helmet leaves ${part.name||'face'} visible`);}
    assert.equal(head.children.find(p=>p.name==='hair-crown').visible,false);assert.ok(budget(model).triangles<8000&&budget(model).meshes<75);
    V.dress(T,model,equipment,()=>{},{showHelmet:false});assert.equal(model.userData.heroPieces.length,0);assert.equal(head.children.find(p=>p.name==='hair-crown').visible,true);assert.equal(model.userData.headMesh.geometry,geometry);assert.equal(model.userData.face,face);assert.equal(equipment.helmet.durability,100);
  }
});

test('male-knight face correction leaves female swordsman and every other organic profession head unchanged',()=>{
  const snapshots=[];for(const job of Object.keys(H.JOBS).filter(j=>j!=='robot'))for(const sex of ['male','female']){if(job==='swordsman'&&sex==='male')continue;const m=V.base(job,env.buildCharacter,'hero',sex),head=m.userData.headMesh;snapshots.push({job,sex,head:Array.from(head.geometry.attributes.position.array),normal:Array.from(head.geometry.attributes.normal.array),scale:m.userData.head.scale.toArray(),position:m.userData.head.position.toArray(),ears:m.userData.head.children.filter(p=>p.name==='human-ear').map(p=>({at:p.position.toArray(),scale:p.scale.toArray(),visible:p.visible}))});assert.notEqual(head.geometry.userData.knightFace,true);}
  assert.equal(snapshots.length,13);assert.equal(createHash('sha256').update(JSON.stringify(snapshots)).digest('hex'),'75038bc22c2ce8b418506906b27eb41a90b6264c0e62c33d07a30e897e9061eb','non-target head surfaces, normals, mounts and ear silhouettes retain the pre-correction geometry');
});

test('male knight has ear-above short side hair and a small rear nape, with the same hero and NPC surface budget',()=>{
  for(const detail of ['hero','npc']){
    const h=S.hair(T,{job:'swordsman',sex:'male',detail}),p=h.drape.attributes.position,used=[...new Set(h.drape.index.array)],side=used.filter(i=>Math.abs(p.getX(i))>.15&&p.getZ(i)>-.04),rear=used.filter(i=>p.getZ(i)<-.23);
    assert.ok(side.length>10&&rear.length>10);assert.ok(Math.min(...side.map(i=>p.getY(i)))>.055,'no lower-hair surface extends to the cheek or in front of the ear');
    const nape=Math.min(...rear.map(i=>p.getY(i)));assert.ok(nape>-.005&&nape<.025,'a short rear nape remains, not the former cheek-length side locks');
    assert.equal(h.crown.attributes.position.count,detail==='hero'?393:181);assert.deepEqual([h.crown.index.count/3,h.drape.index.count/3],detail==='hero'?[364,392]:[162,180]);assert.equal(h.braids.length,0);
    const a=new Set(h.crown.index.array),b=new Set(h.drape.index.array),seam=[...a].filter(i=>b.has(i));assert.equal(seam.length,detail==='hero'?28:18);
    for(const i of seam)for(const attribute of ['position','normal'])for(let axis=0;axis<3;axis++)assert.equal(h.crown.attributes[attribute].array[i*3+axis],h.drape.attributes[attribute].array[i*3+axis]);
    for(const geometry of [h.crown,h.drape])for(const attribute of ['position','normal'])assert.ok(Array.from(geometry.attributes[attribute].array).every(Number.isFinite));
    h.crown.dispose();h.drape.dispose();
  }
});

test('none of the five heavy-helmet tiers exposes male-knight side locks in the cheek and ear-front zone',()=>{
  for(let tier=1;tier<=5;tier++){
    const model=V.base('swordsman',env.buildCharacter,'hero','male'),head=model.userData.head;V.dress(T,model,{helmet:item(H.tierKind('heavy_helm',tier),'helmet')},()=>{});model.updateMatrixWorld(true);
    const surfaces=head.children.filter(p=>['hair-crown','hair-fringe','profession-hair'].includes(p.name));assert.equal(surfaces.length,2);assert.ok(surfaces.every(p=>!p.visible),'the full helmet contains both segments of the cropped male-knight hair');const hair=surfaces.filter(p=>p.visible);assert.equal(hair.length,0,'no visible lower fringe remains beside the brow or cheek guards');
    const ray=new T.Raycaster(),direction=new T.Vector3(0,0,-1).transformDirection(head.matrixWorld);
    for(const side of [-1,1])for(const x of [.18,.215,.25,.285,.31])for(const y of [-.12,-.06,0,.045]){
      ray.set(head.localToWorld(new T.Vector3(side*x,y,.5)),direction);const locks=ray.intersectObjects(hair,false).filter(hit=>head.worldToLocal(hit.point.clone()).z>-.045);assert.equal(locks.length,0,`tier ${tier}: no forward side lock at ${side*x}, ${y}`);
    }
    assert.ok(budget(model).triangles<8000&&budget(model).meshes<75);
  }
});

test('all five male-knight helmets restore the same cropped hair after hiding, breaking or removal, while circlets keep it visible',()=>{
  for(let tier=1;tier<=5;tier++){
    const model=V.base('swordsman',env.buildCharacter,'hero','male'),head=model.userData.head,surfaces=head.children.filter(p=>['hair-crown','hair-fringe','profession-hair'].includes(p.name)),geometries=surfaces.map(p=>p.geometry),helmet=item(H.tierKind('heavy_helm',tier),'helmet'),before=JSON.stringify(helmet);
    const check=visible=>{assert.equal(surfaces.length,2);for(let i=0;i<surfaces.length;i++){assert.equal(surfaces[i].visible,visible);assert.equal(surfaces[i].geometry,geometries[i]);assert.equal(surfaces[i].parent,head);}assert.equal(head.children.filter(p=>['hair-crown','hair-fringe','profession-hair'].includes(p.name)).length,2);};
    check(true);V.dress(T,model,{helmet},()=>{});check(false);V.dress(T,model,{helmet},()=>{},{showHelmet:false});check(true);
    V.dress(T,model,{helmet},()=>{});check(false);V.dress(T,model,{helmet:{...helmet,durability:0}},()=>{});check(true);
    V.dress(T,model,{helmet},()=>{});check(false);V.dress(T,model,{helmet:null},()=>{});check(true);
    V.dress(T,model,{helmet:item(H.tierKind('rune_crown',tier),'helmet')},()=>{});check(true);V.dress(T,model,{helmet},()=>{});check(false);
    assert.equal(JSON.stringify(helmet),before,'appearance toggles do not alter the owned helmet or durability');
  }
});

test('removing male-knight side locks leaves every other profession and female swordsman hair surface unchanged',()=>{
  const pack=g=>({position:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal.array),index:Array.from(g.index.array)}),snapshots=[];
  for(const job of Object.keys(H.JOBS).filter(j=>j!=='robot'))for(const sex of ['male','female']){if(job==='swordsman'&&sex==='male')continue;for(const detail of ['hero','npc']){const h=S.hair(T,{job,sex,detail});snapshots.push({job,sex,detail,crown:pack(h.crown),drape:pack(h.drape),braids:h.braids.map(b=>({side:b.side,geometry:pack(b.geometry)})),long:h.long,braided:h.braided});h.crown.dispose();h.drape.dispose();for(const b of h.braids)b.geometry.dispose();}}
  assert.equal(snapshots.length,26);assert.equal(createHash('sha256').update(JSON.stringify(snapshots)).digest('hex'),'5bd38d7b0ac264de6bab5e7803a61a0797855e804dccd7654d31c519644de1bf','all non-target crown/drape positions, normals, topology, braids and hairstyle flags retain their pre-trim values');
});

test('male knight is tall and balanced without changing female or other professions',()=>{
  const male=V.base('swordsman',env.buildCharacter,'hero','male'),female=V.base('swordsman',env.buildCharacter,'hero','female');male.updateMatrixWorld(true);female.updateMatrixWorld(true);
  const a=new T.Box3().setFromObject(male),b=new T.Box3().setFromObject(female),head=new T.Box3().setFromObject(male.userData.headMesh),height=a.max.y-a.min.y;
  assert.ok(height>2.15&&height<2.5);assert.ok(height>b.max.y-b.min.y+.12);assert.ok(head.max.x-head.min.x<.55);assert.ok((head.max.y-head.min.y)/height<.29);assert.ok((head.max.x-head.min.x)/(head.max.y-head.min.y)<.8,'the longer chin stays balanced with a narrow face, not a larger round head');
  assert.equal(male.userData.body.geometry.userData.knightSculpt,true);assert.deepEqual(Array.from(male.userData.heroGrip),[0,-.46,.10]);assert.equal(female.userData.knightSculpt,undefined);
  assert.deepEqual(female.scale.toArray(),[1.07*.9,1.08*1.05,.96]);assert.equal(female.userData.head.position.y,1.62);assert.equal(female.userData.armR.position.y,1.12);assert.equal(female.userData.legR.position.y,.62);
  for(const job of Object.keys(H.JOBS).filter(j=>!['robot','swordsman'].includes(j)))for(const sex of ['male','female']){const m=V.base(job,env.buildCharacter,'hero',sex);assert.equal(m.userData.knightSculpt,undefined);assert.equal(m.userData.heroGrip,undefined);assert.equal(m.userData.armR.position.y,1.12);assert.equal(m.userData.legR.position.y,.62);assert.equal(m.userData.body.geometry.parameters.segments,12);}
  const before=budget(male);assert.ok(before.triangles<7000&&before.meshes<65);
});

test('knight sculpture and side-part hair retain the existing mesh segment budget and continuous seams',()=>{
  const ordinary=S.torso(T,.66,.73,.38),knight=S.knightTorso(T,.66,.73,.38);assert.equal(knight.index.count,ordinary.index.count);assert.equal(knight.attributes.position.count,ordinary.attributes.position.count);
  const hair=S.hair(T,{job:'swordsman',sex:'male'}),left=new Set(hair.crown.index.array),right=new Set(hair.drape.index.array),shared=[...left].filter(v=>right.has(v));assert.equal(shared.length,28);
  for(const i of shared)for(const attribute of ['position','normal'])for(let axis=0;axis<3;axis++)assert.equal(hair.crown.attributes[attribute].array[i*3+axis],hair.drape.attributes[attribute].array[i*3+axis]);
  assert.ok(S.gripHand(T).userData.closedGrip);
});

for(const kind of ['longsword','greatsword'])for(let tier=1;tier<=5;tier++){
  test(`male knight ${kind} tier ${tier}: rest, both attacks and every heading keep hand and cutting edge functional`,()=>{
    const f=figure(kind,tier),owned=[];frame(f);f.model.traverse(p=>owned.push([p,p.geometry,p.material]));
    for(let heading=0;heading<8;heading++){
      f.model.rotation.y=heading*Math.PI/4;
      const forward=new T.Vector3(Math.sin(f.model.rotation.y),0,Math.cos(f.model.rotation.y)),rest=frame(f);
      assert.ok(Math.abs(rest.edge.dot(forward))>.94,'the cutting edge faces forward at rest, not the broad flat');assert.ok(Math.abs(rest.flat.dot(forward))<.08);
      for(const variant of [0,1])for(let phase=0;phase<=100;phase++){
        const current=frame(f,variant,phase/100);assert.ok(current.grip.distanceTo(current.hand)<1e-6,'right palm remains on the handle');
        if(kind==='greatsword'){const rig=f.model.userData.swordSupportArm,support=f.weapon.localToWorld(new T.Vector3(...f.weapon.userData.contact.supportGrip));assert.ok(rig.active);assert.ok(support.distanceTo(rig.hand.getWorldPosition(new T.Vector3()))<1e-6,`left hand remains on second grip ${variant}:${phase} reach ${rig.target.distanceTo(rig.upper.position)}`);}
      }
    }
    const after=[];f.model.traverse(p=>after.push([p,p.geometry,p.material]));assert.deepEqual(after,owned,'posing does not create more meshes, materials or geometry');const visible=budget(f.model);assert.ok(visible.triangles<11500&&visible.meshes<90,JSON.stringify(visible));
    const sword=f.weapon.userData.contact;assert.equal(sword.kind,'blade-edge');assert.deepEqual(Array.from(sword.axis),[0,1,0]);assert.ok(sword.tip[1]>.8);
  });
}

test('switching, breaking and removing the greatsword restore the left arm and keep geometry owned for scene disposal',()=>{
  const f=figure('greatsword'),rig=f.model.userData.swordSupportArm;frame(f,0,.48);const upper=rig.upperGeometry,idle=rig.idleGeometry;
  V.dress(T,f.model,{weapon:item('longsword','weapon'),shield:item('round_shield','shield')},()=>{});assert.equal(rig.active,false);assert.equal(rig.elbow.visible,false);assert.equal(rig.upper.geometry,idle);assert.equal(rig.owner.geometry,upper);assert.ok(f.model.userData.armL.children.some(p=>p.userData.baseKind==='round_shield'));
  V.dress(T,f.model,{weapon:item('greatsword','weapon')},()=>{});assert.equal(rig.active,true);assert.equal(rig.upper.geometry,upper);assert.equal(rig.owner.geometry,idle);
  V.dress(T,f.model,{weapon:{...item('greatsword','weapon'),durability:0}},()=>{});assert.equal(rig.active,false);assert.equal(f.model.userData.hasWeapon,false);assert.equal(f.model.userData.heroPieces.length,0);
  const owned=new Set();f.model.traverse(p=>{if(p.geometry)owned.add(p.geometry);});assert.ok(owned.has(upper)&&owned.has(idle));
});

test('female sword posture uses forward cutting edges while her body, hands and shield mount remain unchanged',()=>{
  for(const kind of ['longsword','greatsword'])for(let tier=1;tier<=5;tier++){const f=figure(kind,tier,'female'),p=frame(f);assert.equal(f.model.userData.heroGrip,undefined);assert.equal(f.model.userData.swordSupportArm,undefined);assert.ok(p.grip.distanceTo(p.hand)<1e-6);assert.ok(Math.abs(p.edge.z)>.94);assert.deepEqual(f.model.userData.armR.position.toArray(),[-.42,1.12,0]);if(kind==='longsword')assert.ok(f.model.userData.armL.children.some(g=>g.userData.baseKind==='round_shield'));}
});

test('every swordsman skill preparation and release retains both greatsword grips through the entire animation',()=>{
  for(const skill of Object.values(H.SKILLS).filter(s=>s.job==='swordsman'))for(const action of ['charge','skill']){
    const f=figure('greatsword',5),rig=f.model.userData.swordSupportArm;
    for(let phase=0;phase<=100;phase++){
      M.begin(f.model,action,1,skill);M.state(f.model).elapsed=phase/100;f.model.userData.legL.rotation.x=f.model.userData.legR.rotation.x=0;V.pose(f.model,0,1,false,0);f.model.updateMatrixWorld(true);
      assert.ok(f.weapon.localToWorld(new T.Vector3(...f.weapon.userData.contact.grip)).distanceTo(f.model.userData.knightRightHand.getWorldPosition(new T.Vector3()))<1e-6,skill.id+': right hand');
      const support=f.weapon.localToWorld(new T.Vector3(...f.weapon.userData.contact.supportGrip));assert.ok(support.distanceTo(rig.hand.getWorldPosition(new T.Vector3()))<1e-6,`${skill.id} ${action}:${phase} has reachable two-hand support`);
    }
  }
});
