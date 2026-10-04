import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),Theater=require('../story/tower-story-theater.js');
const Narration=require('../story/tower-narrative.js'),opening=Narration.SCENES.find(entry=>entry.floor===99);
function resources(root){const all=new Set();root.traverse(node=>{if(node.geometry&&!node.isSprite)all.add(node.geometry);for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat){all.add(mat);for(const value of Object.values(mat))if(value?.isTexture)all.add(value);}});return all;}
function fingerprint(stage){
  const hash=createHash('sha256'),set=stage.scene.getObjectByName('story-theater-environment');
  set.traverse(node=>{
    hash.update(JSON.stringify([node.name,node.type,node.position.toArray(),node.rotation.toArray(),node.scale.toArray()]));
    if(node.geometry){for(const name of ['position','normal','color','uv'])if(node.geometry.attributes[name])hash.update(Buffer.from(node.geometry.attributes[name].array.buffer));if(node.geometry.index)hash.update(Buffer.from(node.geometry.index.array.buffer));}
    if(node.material){const mat=node.material;hash.update(JSON.stringify([mat.type,mat.color?.getHex(),mat.opacity,mat.side,mat.transparent,mat.shininess]));if(mat.map?.image?.data)hash.update(Buffer.from(mat.map.image.data));}
  });return hash.digest('hex');
}
function actor(){const group=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.4,.7,.25),new T.MeshLambertMaterial()),head=new T.Group(),armL=new T.Group(),armR=new T.Group();head.position.y=1.7;group.add(body,head,armL,armR);group.userData={body,head,armL,armR,heroPieces:[]};return group;}

test('all cloud-region floors share the exact refined summit scenery instead of reverting to a dark prototype',()=>{
  let reference;
  for(const floor of [99,98,95,94,91,90]){
    const stage=Theater.create({THREE:T,floor}),scene=stage.scene,set=scene.getObjectByName('story-theater-environment'),nodes=[];set.traverse(node=>nodes.push(node));
    assert.equal(scene.userData.environment,'cloud');assert.equal(scene.userData.storyArtDirection,'cloud-summit');assert.equal(set.userData.storyArtDirection,'cloud-summit');
    assert.deepEqual(set.userData.storyLandmarks,['carved-altar','inlaid-processional-path','fluted-pillars','wind-banners','blue-sky','green-mountain-ridges']);assert.ok(Object.isFrozen(set.userData.storyLandmarks));
    const signature=fingerprint(stage);reference??=signature;assert.equal(signature,reference,'floor '+floor+' shares actual geometry/materials/textures, not only a theme label');
    assert.equal(scene.background.getHex(),0xb6d8e7);assert.equal(scene.fog.color.getHex(),0xb6d8e7);assert.equal(scene.children.filter(node=>node.isLight).length,3);assert.ok(scene.children.filter(node=>node.isLight).every(light=>!light.castShadow));
    assert.ok(scene.getObjectByName('story-gradient-sky'));assert.equal(nodes.filter(node=>node.name==='story-layered-mountain-ridge').length,3);
    const budget=scene.userData.storySceneryBudget;assert.ok(budget.drawables<=50);assert.ok(budget.triangles<=80000);assert.equal(budget.textures,4);assert.ok(budget.textureBytes<1024*1024);
    stage.dispose();assert.equal(scene.children.length,0);
  }
});

test('cloud objective, chapter and journal pages reuse the stage without inventing opening props or NPC identities',()=>{
  const made=[],stage=Theater.create({THREE:T,floor:94,buildActor(spec){made.push(spec);return actor();}}),set=stage.scene.getObjectByName('story-theater-environment'),signature=fingerprint(stage);
  const rows=[
    {entry:{id:'floor-brief:94',floor:94,title:'雲頂召喚台',paragraphs:['已取得回聲銅扣，繼續前往第 90 層章末門。']},page:0},
    {entry:{id:'scene:95',floor:95,title:'回聲留下的名字',paragraphs:['伊芙指向石台，請你觀察留下的刻痕。']},page:0},
    {entry:{id:'journal:95',floor:95,title:'回聲留下的名字',paragraphs:['你看著石台，回想走過的路。']},page:0},
    {entry:opening,page:1}
  ];
  for(const spec of rows){
    const page=stage.page(spec);assert.equal(page.text,spec.entry.paragraphs[spec.page]);assert.equal(page.title,spec.entry.title);assert.equal(stage.scene.getObjectByName('story-theater-environment'),set);assert.equal(fingerprint(stage),signature);
    assert.equal(stage.scene.getObjectByName('story-film-prop-prewarm'),undefined);stage.scene.traverse(node=>assert.equal(node.userData.storyFilmProp,undefined,'map/copper films belong only to the actual floor-99 arrival'));
    const visible=stage.scene.children.filter(node=>node.userData.storyIdentity&&node.visible).map(node=>node.userData.storyIdentity);assert.deepEqual(visible,page.text.includes('伊芙')?['伊芙']:[]);
  }
  assert.equal(made.filter(spec=>spec.name==='伊芙').length,1);stage.dispose();
});

test('only the exact floor-99 arrival keeps its authored wake-up, hand-off and recording clock; other cloud pages route solely their current paragraph',()=>{
  const before=globalThis.TowerStoryDirection,calls=[];
  globalThis.TowerStoryDirection={plan(options){calls.push(options);return {shot:{focus:new T.Vector3(),goal:new T.Vector3(0,2,6),edition:'preview'},actorTracks:Object.freeze(options.hero?[Object.freeze({actor:options.hero,identity:'hero',speechAnimation:false,beats:Object.freeze([])})]:[]),performance:'thoughtful',actionPlan:Object.freeze({props:Object.freeze([]),source:'current-paragraph'})};}};
  try{
    const stage=Theater.create({THREE:T,floor:94,buildActor:()=>actor()});
    for(const spec of [{text:'已取得回聲銅扣，繼續前往第 90 層章末門。',page:0},{entry:opening,page:1},{text:'你回想石台上的刻字。',page:2}]){
      const page=stage.page(spec),call=calls.at(-1);assert.equal(call.text,page.text);assert.equal(call.environment,'cloud');assert.equal(call.hero,stage.hero);assert.equal(page.performance,'thoughtful');assert.equal(stage.scene.userData.storyActionPlan.source,'current-paragraph');
      const npc=stage.scene.children.find(node=>node.userData.storyIdentity&&node.visible);assert.equal(call.npc,npc||null);assert.equal(call.name,npc?.userData.storyIdentity||'');assert.equal(stage.scene.getObjectByName('story-film-prop-prewarm'),undefined);
      const bodyScale=stage.hero.userData.body.scale.y;page.frame(3);assert.equal(stage.hero.userData.body.scale.y,bodyScale,'planner alone controls the actor');
    }
    assert.equal(calls.length,3);stage.dispose();
    const arrival=Theater.create({THREE:T,floor:99,buildActor:()=>actor()});for(let page=0;page<3;page++){arrival.page({entry:opening,page});assert.equal(calls.length,3);assert.equal(arrival.scene.userData.storyActionPlan.narrationRate,1.16);assert.equal(arrival.scene.userData.storyActionPlan.pageIndex,page);}arrival.dispose();
  }finally{if(before===undefined)delete globalThis.TowerStoryDirection;else globalThis.TowerStoryDirection=before;}
});

test('refined cloud scenery stays resource-bounded across objective/chapter/replay frames and releases all seen owned resources once',()=>{
  for(const floor of [99,95,94,90]){
    const stage=Theater.create({THREE:T,floor}),initial=resources(stage.scene),counts=new Map();for(const resource of initial){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
    for(const spec of [{text:'雲頂的風捲過石台。'},{text:'已取得回聲銅扣，繼續前往第 90 層章末門。',page:1},{entry:{id:'journal:94',paragraphs:['你決定沿著刻紋前進。']},page:0}]){stage.page(spec);for(let frame=0;frame<600;frame++)stage.frame(frame/30);assert.deepEqual(resources(stage.scene),initial);}
    assert.equal(stage.dispose(),true);assert.equal(stage.dispose(),false);for(const count of counts.values())assert.equal(count,1);assert.equal(stage.scene.children.length,0);
  }
});

test('summit banners flow as anchored cloth, reuse their vertex grids and stop completely for reduced motion',()=>{
  for(const reduced of [false,true]){
    const stage=Theater.create({THREE:T,floor:94,reduced}),banners=[];stage.scene.traverse(node=>{if(node.name==='story-summit-banner')banners.push(node);});assert.equal(banners.length,2);
    const before=banners.map(node=>({geometry:node.geometry,position:node.geometry.attributes.position,normal:node.geometry.attributes.normal,values:Array.from(node.geometry.attributes.position.array)})),owned=resources(stage.scene);
    stage.frame(2.5);for(let n=0;n<banners.length;n++){
      const node=banners[n],row=before[n],pos=node.geometry.attributes.position,normal=node.geometry.attributes.normal;assert.equal(node.geometry,row.geometry);assert.equal(pos,row.position);assert.equal(normal,row.normal);
      if(reduced)assert.deepEqual(Array.from(pos.array),row.values);else{assert.notDeepEqual(Array.from(pos.array),row.values);for(let i=0;i<pos.count;i++){if(pos.getY(i)>1.04)assert.ok(Math.abs(pos.getZ(i))<1e-12,'sewn top edge is fixed');assert.ok(Math.abs(pos.getZ(i))<=.075);assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5);}}
    }
    assert.deepEqual(resources(stage.scene),owned);stage.dispose();
  }
});
