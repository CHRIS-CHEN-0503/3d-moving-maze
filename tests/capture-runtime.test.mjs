import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js'),CaptureCore=require('../assets/capture-core.js');
const source=await readFile(new URL('../assets/capture-mode.js',import.meta.url),'utf8');
function room(){
  let time=10000;const queue=[],peers=[];
  function peer(id,host){
    const nodes=new Map(),results=[],stuns=[],intervals=new Map();const node=()=>({style:{},hidden:false,appendChild(child){if(child.id)nodes.set(child.id,child);},setAttribute(){}});
    const roster=Array.from({length:4},(_,i)=>({id:'p'+i,name:'玩家'+i,charIdx:i}));
    const MP={on:true,mode:'ctf',started:true,ended:false,id,host,round:0,order:roster.map(r=>r.id),roster,outs:{},players:{}};
    for(const r of roster)if(r.id!==id)MP.players[r.id]={mesh:new THREE.Group(),lastSeen:time,tx:0,tz:0};
    const c=vm.createContext({THREE,CaptureCore,MP,window:{addEventListener(){}},document:{createElement:node},scene:new THREE.Scene(),playerGroup:new THREE.Group(),
      G:{mazeW:13,mazeH:13,cell:4,wallBoxes:[],items:[],px:-24,pz:-24,stunnedUntil:0,atkCoolUntil:0},SERIES:{stats:{}},
      Date:{now:()=>time},performance:{now:()=>time},console,
      setInterval:fn=>{intervals.set(1,fn);return 1;},clearInterval:id=>intervals.delete(id),
      $:key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);},
      cellToWorld:(x,y)=>({x:(x-6)*4,z:(y-6)*4}),worldToCell:(x,z)=>({x:Math.round(x/4+6),y:Math.round(z/4+6)}),
      botPosOf:who=>who===id?{x:c.G.px,z:c.G.pz}:MP.players[who]?{x:MP.players[who].mesh.position.x,z:MP.players[who].mesh.position.z}:null,
      makeTextSprite:()=>new THREE.Group(),bindActionBtn(){},showToast(){},updateAtkBtn(){},swingWeapon(){},disposeSceneObject(){},
      removeWallBox:wb=>{const i=c.G.wallBoxes.indexOf(wb);if(i>=0)c.G.wallBoxes.splice(i,1);},
      AudioEng:{stopMusic(){},stopItemLoop(){},sfxWin(){},sfxLose(){},sfxHit(){this.hits=(this.hits||0)+1;}},
      mpName:who=>who,escapeHtml:s=>s,seriesSummaryHtml:()=>'',
      applyStun:(who,ms)=>stuns.push([who,ms]),showMPResults:(title,html,rows)=>results.push({title,rows}),
      mpSend:message=>queue.push(JSON.parse(JSON.stringify({...message,f:message.f||id}))),
    });vm.runInContext(source,c);peers.push({c,api:c.window.CaptureFlag,results,stuns,nodes,intervals});return peers.at(-1);
  }
  const host=peer('p0',true),client=peer('p1',false);
  const flush=()=>{let budget=100;while(queue.length&&budget--){const m=queue.shift();for(const p of peers)p.api.handle(m);}assert.ok(budget>0);};
  function place(id,x,z){for(const p of peers){if(p.c.MP.id===id){p.c.G.px=x;p.c.G.pz=z;}else {const pl=p.c.MP.players[id];pl.mesh.position.set(x,0,z);pl.lastSeen=time;}}}
  for(const p of peers)p.api.start('p0');
  for(let i=0;i<4;i++)place('p'+i,-24+i*12,20);
  const tick=ms=>{time+=ms;for(const p of peers)for(const pl of Object.values(p.c.MP.players))pl.lastSeen=time;host.api.frame(.1,time);flush();client.api.frame(.1,time);};
  return {host,client,flush,place,tick,queue,now:()=>time,advance:ms=>{time+=ms;}};
}
test('兩個獨立客戶端：搶旗、敵人擊退、重新拾取、佔領和重播封包不重複計分',()=>{
  const r=room();r.place('p0',0,0);r.tick(4000);assert.equal(r.host.api.speed(),.82);
  r.place('p1',1,0);r.client.api.attack();r.flush();r.tick(200);assert.equal(r.host.api.speed(),1);assert.equal(r.host.c.G.px,-24);assert.equal(r.host.stuns.length,1);
  assert.equal(r.host.c.AudioEng.hits,1);assert.equal(r.client.c.AudioEng.hits,1);
  r.tick(1000);assert.equal(r.host.c.AudioEng.hits,1);assert.equal(r.client.c.AudioEng.hits,1,'重送快照不重播命中');
  r.tick(6100);r.place('p1',0,0);r.tick(100);assert.equal(r.client.api.speed(),.82);
  r.place('p1',-24,-24);r.place('p0',0,20);r.tick(100);r.tick(3100);
  assert.equal(r.host.results.length,1);assert.equal(r.client.results.length,1);
  assert.equal(r.host.results[0].rows.filter(x=>x.win).length,2);assert.equal(r.client.results[0].rows[1].points,1575);
  r.tick(5000);assert.equal(r.host.results.length,1);
});
test('偽造非房主快照不接受；房主離開中止且不記勝場',()=>{
  const r=room();r.client.api.handle({t:'ctfstate',f:'p2',at:r.now(),state:{winner:1,members:{}}});assert.equal(r.client.results.length,0);
  r.client.api.leave('p0');assert.equal(r.client.c.MP.started,false);assert.equal(r.client.results.length,0);assert.equal(r.client.nodes.get('mpResultTitle').textContent,'合作賽中止');
});
test('停止模式後清除旗幟場景與介面，不殘留於一般遊戲',()=>{
  const r=room();assert.equal(r.host.intervals.size,1);assert.equal(r.host.c.scene.children.length,1);r.host.api.stop();assert.equal(r.host.intervals.size,0);assert.equal(r.host.c.scene.children.length,0);assert.equal(r.host.nodes.get('captureHud').hidden,true);assert.equal(r.host.nodes.get('captureRelay').hidden,true);
});
test('房主停止畫面更新但背景計時仍持續，接收端不誤判斷線',()=>{
  const r=room();
  for(let i=0;i<20;i++){r.advance(1000);r.host.intervals.get(1)();r.flush();r.client.api.frame(.1,r.now());}
  assert.equal(r.client.c.MP.started,true);assert.equal(r.client.c.MP.ended,false);
});
test('隊友敲牆同步到兩端，拒絕外牆與前一輪牆壁訊息',()=>{
  const r=room(),wall={type:'v',gx:0,gy:0,minX:-22.3,maxX:-21.7,minZ:-26,maxZ:-22};
  r.place('p1',-24,-24);r.host.c.G.wallBoxes.push({...wall});r.client.c.G.wallBoxes.push({...wall});
  r.client.api.wall(wall);r.flush();assert.equal(r.host.c.G.wallBoxes.length,0);assert.equal(r.client.c.G.wallBoxes.length,0);
  r.host.c.G.wallBoxes.push({...wall});r.host.api.handle({t:'ctfwall',f:'p1',round:99,wall});r.flush();assert.equal(r.host.c.G.wallBoxes.length,1);
});
