import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
function extract(name){const start=source.indexOf('  function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('\n  function ',start+1);return source.slice(start,end);}

test('the story HUD writes an element only when its shown value changes',()=>{
  const writes=[],nodes=new Map();
  const node=id=>{if(!nodes.has(id)){const state={};nodes.set(id,new Proxy(state,{set(target,key,value){writes.push(id+'.'+String(key));target[key]=value;return true;}}));}return nodes.get(id);};
  const c=vm.createContext({el:node});vm.runInContext(extract('hudSet'),c);
  c.hudSet('towerCoins','textContent',12);c.hudSet('towerCoins','textContent',12);c.hudSet('towerCoins','textContent','12');
  c.hudSet('towerTalkBtn','disabled',true);c.hudSet('towerTalkBtn','disabled',true);c.hudSet('towerTalkBtn','disabled',false);
  assert.deepEqual(writes,['towerCoins.textContent','towerTalkBtn.disabled','towerTalkBtn.disabled']);
  assert.equal(nodes.get('towerCoins').textContent,'12');
  const hud=extract('updateHud');for(const id of ['towerObjective','towerTalkBtn','towerFloor'])assert.doesNotMatch(hud,new RegExp("el\\('"+id+"'\\)\\.(?:textContent|disabled|ariaLabel|hidden)="),id+' goes through hudSet');
  assert.equal((hud.match(/hudSet\('towerObjective'/g)||[]).length,1,'the objective is decided first, then written once');
});

test('monster labels reuse one texture per caption on a floor and free them exactly once on the next floor',()=>{
  let canvases=0;const c=vm.createContext({THREE:T,run:{party:{}},document:{createElement:()=>{canvases++;return {width:0,height:0,getContext:()=>({strokeText(){},fillText(){}})};}}});
  vm.runInContext('const tagTextures=new Map();'+extract('clearTagTextures')+extract('strengthTag'),c);
  const a=c.strengthTag('火靈',3),b=c.strengthTag('火靈',3),stunned=c.strengthTag('火靈（暈）',3);
  assert.equal(a.material.map,b.material.map);assert.notEqual(a.material.map,stunned.material.map);assert.notEqual(a.material,b.material,'each sprite keeps its own material');
  assert.equal(canvases,2);assert.equal(a.material.map.userData.sharedResource,true,'scene teardown leaves the shared texture to the cache');
  let freed=0;a.material.map.addEventListener('dispose',()=>freed++);c.clearTagTextures();c.clearTagTextures();assert.equal(freed,1);
  c.strengthTag('火靈',3);assert.equal(canvases,3,'a new floor draws fresh labels');
  assert.match(source,/function buildWorld\(\) \{\n    clearBolts\(\);clearTagTextures\(\);/);assert.match(source,/clearBolts\(\);clearTagTextures\(\);\n    clearHurtFeedback/);
});

test('cheap per-frame guards: threat checks order, one trader test, fading glow, crystal glow, escort precheck, shared bolts',()=>{
  assert.match(source,/m\.alive&&\(m\.awarenessLeft>0\|\|m\.windup>0\)&&!isHeld\(m\)&&!\(run\.monsterStuns\[m\.id\]>0\)&&hasClearPath\(/,'line-of-sight is tested last');
  assert.match(extract('updateMonster'),/const safe=traderSafe;/);assert.doesNotMatch(extract('updateMonster'),/traders\.some/);
  assert.match(source,/updateWarrior\(dt,now\);\n    traderSafe=traders\.some\(n=>Math\.hypot\(G\.px-n\.x,G\.pz-n\.z\)<2\.6&&hasClearPath\(G\.px,G\.pz,n\.x,n\.z\)\);\n    if\(!updateMonsters\(dt,now\)\)return;/,'once per frame, after dashes and companions moved the player, before the shared monster loop');
  assert.match(extract('tickHunt'),/traderSafe=false;\n    if\(!updateMonsters\(dt,now\)\)return;/,'a hunt rift has no merchants');
  assert.match(source,/if\(hurtFlash>0\)\{hurtFlash=Math\.max\(0,hurtFlash-dt\);el\('towerHurtGlow'\)\.style\.opacity=String\(hurtFlash\/\.65\);\}/);
  assert.match(extract('refreshAdventureWorld'),/if\(item\.glow!==glow\)\{item\.glow=glow;item\.model\.traverse/);
  assert.match(extract('updateExplorer'),/distance<=2\.8&&[^\n]*questEvent\('escort',\{atExit:true,distance\}\)/);
  assert.match(extract('launchBolt'),/new THREE\.Mesh\(boltParts\.geometry,boltParts\.material\)/);
});
