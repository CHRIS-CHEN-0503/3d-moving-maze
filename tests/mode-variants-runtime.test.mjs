import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js'),C=require('../assets/mode-variants-core.js');
function fixture(mode='race',host=true){
  let now=10000,builds=0;const nodes=new Map(),sent=[],results=[],roster=['a','b','c','d'].map(id=>({id,name:id}));
  function node(){return {style:{},hidden:false,children:[],setAttribute(){},appendChild(child){this.children.push(child);if(child.id)nodes.set(child.id,child);}};}
  const MP={on:true,host,id:host?'a':'b',mode,started:true,ended:false,seed:31,seriesRound:1,round:0,roster,order:roster.map(r=>r.id),players:{},bots:[{id:'c',x:12,z:20},{id:'d',x:16,z:20}],outs:{},treasure:{holder:'a'},taggedId:'d'},G={running:true,startTime:5000,mazeW:13,mazeH:13,cell:4,exitCell:{x:6,y:6},px:-24,pz:-24,shifting:false,frozen:false,lvlIdx:0,stunnedUntil:0,hWalls:Array.from({length:12},()=>Array(13).fill(false)),vWalls:Array.from({length:13},()=>Array(12).fill(false)),wallBoxes:[]};
  const walls=[{type:'v',gx:1,gy:6,minX:-18.2,maxX:-17.8,minZ:-2,maxZ:2,boundary:false},{type:'v',gx:10,gy:6,minX:17.8,maxX:18.2,minZ:-2,maxZ:2,boundary:false}];
  for(const w of walls){G.vWalls[w.gy][w.gx]=true;G.wallBoxes.push({...w});}const pos={a:{x:-24,z:-24},b:{x:20,z:20},c:{x:12,z:20},d:{x:16,z:20}},view={members:Object.fromEntries(roster.map((r,i)=>[r.id,{team:i%2}])),flag:{holder:null},walls:[]};
  const ctx=vm.createContext({ModeVariantsCore:C,THREE,MP,G,window:{CaptureFlag:{view:()=>view}},document:{createElement:node},scene:new THREE.Scene(),Date:{now:()=>now},performance:{now:()=>now},LEVELS:[{}],
    $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},matchRules:()=>({raceCheckpoint:1,treasureSeal:1,ctfShortcut:1,tagBells:1}),
    cellToWorld:(x,y)=>({x:(x-6)*4,z:(y-6)*4}),worldToCell:(x,z)=>({x:Math.round(x/4+6),y:Math.round(z/4+6)}),botPosOf:id=>id===MP.id?{x:G.px,z:G.pz}:pos[id],makeTextSprite:()=>new THREE.Group(),showToast(){},disposeSceneObject(){},escapeHtml:s=>s,
    solveMaze:(fx,fy,tx,ty)=>Array(Math.abs(fx-tx)+Math.abs(fy-ty)+1).fill([tx,ty]),
    removeWallBox:w=>{G.vWalls[w.gy][w.gx]=false;G.wallBoxes.splice(G.wallBoxes.indexOf(w),1);},buildWalls:()=>{builds++;G.wallBoxes=walls.filter(w=>G.vWalls[w.gy][w.gx]).map(w=>({...w}));},
    RoomLifecycle:{sendLocal:m=>{const packet=JSON.parse(JSON.stringify({...m,f:'a',sr:1}));ctx.mpHandle(packet);sent.push(packet);}},mpSend:m=>sent.push({...m,f:m.f||MP.id,sr:1}),mpHandle(){},mpLeave(){MP.on=false;},showMPResults:(title,html,rows)=>results.push({title,html,rows})});
  vm.runInContext(readFileSync(new URL('../assets/mode-variants.js',import.meta.url),'utf8'),ctx);const api=ctx.window.ModeVariants;api.frame();
  return {ctx,api,view,pos,nodes,sent,results,builds:()=>builds,advance:ms=>{now+=ms;api.frame();},now:()=>now,place:(actor,p)=>{if(actor===MP.id){G.px=p.x;G.pz=p.z;}else pos[actor]={...p};}};
}
test('執行模組先引導AI去地標，抵達站定完成後才交回出口目標',()=>{
  const r=fixture(),p=r.api.state().points[0],bot=r.ctx.MP.bots[0];assert.deepEqual(JSON.parse(JSON.stringify(r.api.botGoal(bot,r.ctx.G.exitCell,'exit',r.now()).goal)),{x:p.cx,y:p.cy});
  r.place(bot.id,p);r.api.frame();r.advance(800);assert.equal(r.api.state().progress[bot.id].checkpoint,true);assert.equal(r.api.botGoal(bot,r.ctx.G.exitCell,'exit',r.now()),null);
});
test('經典單人地標不受上一場多人的結束旗標影響，未開啟前不改原遊戲',()=>{
  const r=fixture();r.ctx.MP.on=false;r.ctx.MP.ended=true;r.api.reset();r.api.frame();const p=r.api.state().points[0];assert.equal(r.api.canFinish(),false);r.ctx.G.px=p.x;r.ctx.G.pz=p.z;r.api.frame();r.advance(800);assert.equal(r.api.state().progress.solo.checkpoint,true);assert.equal(r.api.canFinish(),true);
});
test('訪客只接受房主當輪目標快照；不接受前輪或其他玩家的目標',()=>{
  const h=fixture(),g=fixture('race',false),state=h.api.state(),key=state.epoch;state.progress.b.checkpoint=true;state.rev++;
  g.ctx.mpHandle({t:'variantsync',f:'c',sr:1,key,state,at:h.now()});assert.equal(g.api.state().progress.b.checkpoint,false);
  g.ctx.mpHandle({t:'variantsync',f:'a',sr:0,key,state,at:h.now()});assert.equal(g.api.state().progress.b.checkpoint,false);
  g.ctx.mpHandle({t:'variantsync',f:'a',sr:1,key,state,at:h.now()});assert.equal(g.api.state().progress.b.checkpoint,true);
});
test('房主以遠端最新位置判定站定目標，不等待背景分頁的模型插值',()=>{
  const r=fixture(),p=r.api.state().points[0];r.ctx.MP.players.b={tx:p.x,tz:p.z};r.api.frame();r.advance(800);assert.equal(r.api.state().progress.b.checkpoint,true);assert.deepEqual(r.pos.b,{x:20,z:20},'模型位置未更新仍可裁定真實回報位置');
});
test('側翼捷徑真的開內牆，十秒後等穿越者離開才安全關閉；原來摧毀的牆不補回',()=>{
  const r=fixture('ctf'),p=r.api.state().points[0];r.place('a',p);r.api.frame();r.advance(2000);assert.equal(r.ctx.G.vWalls[6][1],false);
  r.place('a',{x:-18,z:0});r.advance(10001);assert.equal(r.ctx.G.vWalls[6][1],false);assert.equal(r.builds(),0);
  r.place('a',{x:-24,z:-24});r.advance(1);assert.equal(r.ctx.G.vWalls[6][1],true);assert.equal(r.builds(),1);
  const q=fixture('ctf');q.place('a',q.api.state().points[0]);q.api.frame();q.advance(2000);q.view.walls.push({type:'v',gx:1,gy:6});q.place('a',{x:-24,z:-24});q.advance(10001);assert.equal(q.ctx.G.vWalls[6][1],false);
});
test('安全鐘只增加小額積分、不把最後的鬼改成勝者；結束或離開清除HUD與場景',()=>{
  const r=fixture('tag'),p=r.api.state().points[0];r.place('a',p);r.api.frame();r.advance(1000);assert.equal(r.api.state().progress.a.score,25);
  r.ctx.showMPResults('結果','',r.ctx.MP.roster.map(x=>({...x,win:x.id!=='d',points:x.id==='d'?0:1000})));assert.equal(r.results[0].rows[0].points,1025);assert.equal(r.results[0].rows[3].win,false);assert.equal(r.nodes.get('modeObjective').hidden,true);r.ctx.mpLeave();assert.equal(r.ctx.scene.children.length,0);
});
