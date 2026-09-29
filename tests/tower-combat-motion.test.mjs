import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),M=require('../story/tower-combat-motion.js'),Vox=require('../story/tower-menu-voice.js'),H=require('../story/tower-heroes-core.js'),T=require('../lib/three.min.js');
test('eight weapon types alternate two distinct bounded tracks and return to rest',()=>{
 for(const kind of Object.keys(H.GEAR).filter(k=>H.GEAR[k].slot==='weapon')){
  assert.equal(M.WEAPONS[kind].length,2);const model={userData:{heroWeapon:kind}},poses=[];
  for(let i=0;i<3;i++){
   M.begin(model,'attack',1);assert.equal(M.state(model).variant,i%2);
   const values=[];for(let f=0;f<30;f++){const p=M.update(model,1/30);assert.ok(Object.values(p).every(Number.isFinite));values.push({...p});}
   poses.push(values);M.update(model,.1);assert.equal(M.state(model).action,'');
   assert.deepEqual(M.update(model,0),M.sample(kind,'attack',0,1));
  }
  assert.notDeepEqual(poses[0],poses[1],kind);assert.deepEqual(poses[0],poses[2],kind);
 }
});
test('all active skills have a motion family, preparation cancels without changing weapon alternation',()=>{
 for(const s of Object.values(H.SKILLS)){
  assert.ok(M.FAMILIES[s.effect],s.id);const model={userData:{heroWeapon:Object.keys(H.GEAR).find(k=>H.GEAR[k].slot==='weapon'&&H.GEAR[k].jobs.includes(s.job))}};
  M.begin(model,'charge',1.5,s);M.update(model,.1);assert.equal(M.state(model).family,M.FAMILIES[s.effect]);
  M.cancel(model);assert.equal(M.state(model).action,'');M.begin(model,'skill',.85,s);
  for(let n=0;n<20;n++)assert.ok(Object.values(M.update(model,.05)).every(Number.isFinite),s.id);
  assert.deepEqual(M.state(model).counts,{});
 }
});
test('crown has no spikes; animated equipment does not accumulate models or change movement/heading',()=>{
 const env=vm.createContext({THREE:T,TowerHeroes:H,TowerCombatMotion:M});vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),env);const V=env.TowerHeroVisuals,crown=V.gear(T,'rune_crown');
 crown.traverse(p=>assert.notEqual(p.geometry?.type,'ConeGeometry'));crown.updateMatrixWorld(true);const box=new T.Box3().setFromObject(crown);assert.ok(box.max.y<1.9);assert.ok(box.max.z>.35);
 for(const kind of Object.keys(H.GEAR).filter(k=>H.GEAR[k].slot==='weapon')){
  const model=new T.Group();for(const part of ['armR','armL','legR','legL']){model.userData[part]=new T.Group();model.add(model.userData[part]);}model.position.set(2,0,3);model.rotation.y=.6;
  V.dress(T,model,{helmet:null,armor:null,shield:null,weapon:{kind,slot:'weapon',durability:10}},()=>{});const count=model.children.length;
  M.begin(model,'attack',.8);for(let f=0;f<50;f++){model.userData.legL.rotation.x=model.userData.legR.rotation.x=0;V.pose(model,0,.8,false,.02);model.updateMatrixWorld(true);assert.ok(model.matrixWorld.elements.every(Number.isFinite));}
  assert.equal(model.rotation.y,.6);assert.equal(model.position.x,2);assert.equal(model.position.z,3);assert.equal(model.children.length,count);
  assert.ok(Math.abs(model.rotation.x)<1e-8);assert.ok(Math.abs(model.rotation.z)<1e-8);
 }
});
test('routine menus are quiet, narrative and important confirmations remain readable',()=>{
 for(const k of ['高塔遠征 · 暫停中','營地工坊 · 暫停中','隊伍管理 · 暫停中','旅行商人 · 行商營地','旅人背包 · 暫停中','照明工具 · 暫停中','專屬圖鑑'])assert.equal(Vox.quiet(k),true,k);
 for(const k of ['出口確認','確認修理','離開確認','主線終章 · 由你決定','職業探索 · 暫停中','故事日誌'])assert.equal(Vox.quiet(k),false,k);
 assert.equal(Vox.quiet('高塔遠征 · 暫停中',{full:true}),false);
 assert.equal(Vox.label('party-kitchen'),'料理');assert.equal(Vox.label('party-forge'),'鍛匠工坊');assert.equal(Vox.label('hero-tab','gear'),'裝備');assert.equal(Vox.label('party-cook'),'');assert.equal(Vox.label('story-next'),'');
});
test('original phone icon assets have correct dimensions and maskable export; no service worker',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url))),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/rel="apple-touch-icon"/);assert.match(html,/rel="manifest"/);
 for(const [name,size]of [['apple-touch-icon',180],['icon-192',192],['icon-512',512],['icon-maskable-512',512],['favicon-48',48],['maze-tower-original',1024]]){const b=readFileSync(new URL('../assets/app-icon/'+name+'.png',import.meta.url));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);}
 assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));assert.doesNotMatch(html,/serviceWorker\.register/);
});
