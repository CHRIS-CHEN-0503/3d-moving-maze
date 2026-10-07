import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Theater=require('../story/tower-story-theater.js');
const REGIONS=[['garden',85],['roots',75],['echo',65],['library',55],['mist',45],['frost',35],['clockwork',25],['furnace',15],['heart',5]];
const DEEP=[['roots',-3],['mist',-13],['library',-23],['furnace',-33],['heart',-43]];
function resources(root){const all=new Set();root.traverse(node=>{if(node.geometry&&!node.isSprite)all.add(node.geometry);for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat){all.add(mat);for(const value of Object.values(mat))if(value?.isTexture)all.add(value);}});return all;}
function fingerprint(stage){
  const hash=createHash('sha256');stage.scene.getObjectByName('story-theater-environment').traverse(node=>{
    hash.update(JSON.stringify([node.name,node.type,node.position.toArray(),node.rotation.toArray(),node.scale.toArray(),node.visible]));
    if(node.geometry)for(const name of ['position','normal','color','uv'])if(node.geometry.attributes[name])hash.update(Buffer.from(node.geometry.attributes[name].array.buffer));
    if(node.material)hash.update(JSON.stringify([node.material.type,node.material.color?.getHex(),node.material.opacity,node.material.transparent,node.material.blending]));
  });for(const light of stage.scene.children.filter(n=>n.isLight))hash.update(String(light.intensity));return hash.digest('hex');
}

test('each region film set is deterministic per region, shared across its floors, and distinct underground',()=>{
  const seen=new Map();
  for(const [environment,floor] of REGIONS){
    const a=Theater.create({THREE:T,environment,floor}),b=Theater.create({THREE:T,environment,floor:floor-4}),print=fingerprint(a);
    assert.equal(fingerprint(b),print,environment+' floors share one set');assert.ok(!seen.has(print));seen.set(print,environment);
    assert.equal(a.scene.userData.underworld,false);a.dispose();b.dispose();
  }
  for(const [environment,floor] of DEEP){
    const deep=Theater.create({THREE:T,environment,floor}),surface=Theater.create({THREE:T,environment,floor:55});
    assert.equal(deep.scene.userData.environment,environment);assert.equal(deep.scene.userData.underworld,true);
    assert.notEqual(deep.scene.userData.storyArtDirection,surface.scene.userData.storyArtDirection);
    assert.notDeepEqual(deep.scene.getObjectByName('story-theater-environment').userData.storyLandmarks,surface.scene.getObjectByName('story-theater-environment').userData.storyLandmarks);
    deep.dispose();surface.dispose();
  }
});

test('region props animate from the absolute story clock without allocating, and reduced motion keeps every set still',()=>{
  for(const [environment,floor] of [...REGIONS,...DEEP]){
    const live=Theater.create({THREE:T,environment,floor}),still=Theater.create({THREE:T,environment,floor,reduced:true});
    const start=fingerprint(still),owned=resources(live.scene);
    live.frame(0);const zero=fingerprint(live);live.frame(4.7);const later=fingerprint(live);live.frame(0);
    assert.notEqual(later,zero,environment+floor+' scenery moves');assert.equal(fingerprint(live),zero,environment+floor+' motion is a pure function of story time');
    for(const time of [0,2.5,30,600])still.frame(time);assert.equal(fingerprint(still),start,environment+floor+' reduced motion is completely still');
    for(let frame=0;frame<300;frame++)live.frame(frame/30);assert.deepEqual(resources(live.scene),owned);
    live.dispose();still.dispose();
  }
});

test('atmosphere motes stay inside their authored band and key-light flicker stays subtle',()=>{
  for(const [environment,floor] of [...REGIONS,...DEEP]){
    const stage=Theater.create({THREE:T,environment,floor}),points=[],light=stage.scene.getObjectByName('story-key-light'),base=light.intensity;
    stage.scene.traverse(n=>{if(n.isPoints)points.push(n);});assert.equal(points.length,1,environment+' has one point cloud');
    const pos=points[0].geometry.attributes.position;assert.ok(pos.count<=48);
    let lowest=Infinity,highest=-Infinity,widest=0;
    for(let frame=0;frame<240;frame++){stage.frame(frame*.25);for(let i=0;i<pos.count;i++){lowest=Math.min(lowest,pos.getY(i));highest=Math.max(highest,pos.getY(i));widest=Math.max(widest,Math.abs(pos.getX(i)));}assert.ok(Math.abs(light.intensity-base)<=base*.11,environment+' flicker');}
    assert.ok(lowest>-.6&&highest<6.2&&widest<6,environment+' motes '+lowest+'..'+highest+' / '+widest);
    stage.dispose();
  }
});

test('every region and underground stage releases each owned resource exactly once and empties its scene',()=>{
  for(const [environment,floor] of [['cloud',99],...REGIONS,...DEEP]){
    const stage=Theater.create({THREE:T,environment,floor}),initial=resources(stage.scene),counts=new Map();
    for(const resource of initial){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
    stage.page({text:'旅人看向前方。'});for(let frame=0;frame<120;frame++)stage.frame(frame/24);
    assert.equal(stage.dispose(),true);assert.equal(stage.dispose(),false);for(const count of counts.values())assert.equal(count,1);assert.equal(stage.scene.children.length,0);
  }
});

test('baked batches are never baked again, so every authored colour survives (e.g. the furnace core cage)',()=>{
  for(const floor of [15,-33]){
    const stage=Theater.create({THREE:T,environment:'furnace',floor});let white=0,total=0;
    stage.scene.getObjectByName('story-theater-environment').traverse(node=>{if(!node.userData.storyBakedPieces)return;const color=node.geometry.attributes.color;for(let i=0;i<color.count;i++){total++;if(color.getX(i)===1&&color.getY(i)===1&&color.getZ(i)===1)white++;}});
    assert.ok(total>0);assert.equal(white,0,'no furnace piece is authored pure white, so a white vertex means a re-baked batch');stage.dispose();
  }
  for(const [environment,floor] of [...REGIONS,...DEEP,['cloud',99]]){const stage=Theater.create({THREE:T,environment,floor});stage.scene.traverse(node=>{if(node.userData.storyBakedPieces)assert.ok(node.material.vertexColors);});stage.dispose();}
});
