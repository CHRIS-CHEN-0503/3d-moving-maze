import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const require=createRequire(import.meta.url),GameRules=require('../assets/game-rules.js');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
function peer(host=true){
  const nodes=new Map(),sent=[],messages=[];
  const c=vm.createContext({MP:{host,id:host?'host':'guest',mode:'race',maxPlayers:5,fillBots:false,roster:[{id:'host',charIdx:0,name:'房主'}]},
    CFG:{mazeSize:13,shiftMin:3,hungerMin:3},G:{lvlIdx:0},SERIES:{total:3},GameRules,CHARS:Array.from({length:6},()=>({emoji:''})),
    clearInterval(){},escapeHtml:s=>s,modeLabel:m=>m,performance:{now:()=>1000},MP_ROUND_EVENTS:new Set(),
    $:id=>{if(!nodes.has(id))nodes.set(id,{style:{},checked:false});return nodes.get(id);},
    mpSend:m=>sent.push({...m,f:'host'}),showToast:s=>messages.push(s),randPower:()=>null});
  vm.runInContext(block('function makeBots(', 'function mpSend(')+block('function mpLobbyPlan(', 'function mpLeave(')+block('function sendMpRoundStart(', '/* ---- 按鈕 ---- */')+block('function mpHandle(', 'function mpAfterStart('),c);
  return {c,nodes,sent,messages};
}
for(const mode of ['race','tag','treasure','shop','ctf'])test(mode+'：補位開關依人數生效，滿房不加電腦',()=>{
  const h=peer();h.c.MP.mode=mode;h.c.MP.maxPlayers=mode==='ctf'?8:5;
  assert.equal(h.c.mpLobbyPlan().ready,false);h.c.MP.fillBots=true;
  const players=h.c.mpRoundPlayers();assert.equal(players.length,h.c.MP.maxPlayers);assert.equal(players.filter(p=>p.bot).length,players.length-1);
  assert.equal(new Set(players.map(p=>p.id)).size,players.length);
  h.c.MP.roster=players.map((p,i)=>({...p,id:'human'+i,bot:false}));assert.equal(h.c.mpLobbyPlan().bots,0);
  h.c.MP.fillBots=false;assert.equal(h.c.mpLobbyPlan().ready,true);
});
test('房主補位設定同步到訪客，訪客只讀且看不到開始鍵；下一輪不重複加電腦',()=>{
  const h=peer(),guest=peer(false);h.c.MP.fillBots=true;h.c.mpBroadcastLobby();guest.c.mpHandle(h.sent.at(-1));
  assert.equal(guest.c.MP.fillBots,true);assert.equal(guest.nodes.get('mpBotOptions').hidden,true);assert.equal(guest.nodes.get('mpStart').style.display,'none');
  assert.match(guest.nodes.get('mpBotSummary').textContent,/加入 4 位電腦/);
  h.c.MP.roster=h.c.mpRoundPlayers();assert.equal(h.c.mpRoundPlayers().length,5);
  h.c.sendMpRoundStart(h.c.mpRoundPlayers(),2);assert.equal(h.sent.at(-1).fillBots,true);assert.equal(h.sent.at(-1).seriesRound,2);
  h.c.MP.fillBots=false;h.c.mpBroadcastLobby();guest.c.mpHandle(h.sent.at(-1));assert.equal(guest.c.MP.fillBots,false);
});
test('真人離開後重新計算空位；不補位時禁止不足人數的合作賽',()=>{
  const h=peer();h.c.MP.mode='ctf';h.c.MP.maxPlayers=4;h.c.MP.roster=Array.from({length:4},(_,i)=>({id:'p'+i,disconnected:i===3}));
  assert.equal(h.c.mpRoundPlayers(),null);h.c.MP.fillBots=true;assert.equal(h.c.mpRoundPlayers().filter(p=>p.bot).length,1);
});
test('比賽電腦到終點只送一次完成，已出局的不再移動',()=>{
  const events=[],MP={bots:[{id:'bot1',x:0,z:0},{id:'bot2',x:0,z:0}],outs:{bot2:1},finishers:[],round:0};
  const c=vm.createContext({MP,G:{exitCell:{x:4,y:4}},cellToWorld:(x,y)=>({x,z:y}),botWalk:b=>{b.x=4;b.z=4;},mpSend:m=>events.push(m)});
  vm.runInContext(block('function botSimRace(', 'function botTryRob('),c);
  c.botSimRace(.1,1000);c.botSimRace(.1,1100);assert.equal(events.length,1);assert.equal(events[0].f,'bot1');assert.equal(MP.bots[1].x,0);
  assert.match(html,/MP.mode==='race'&&MP.started&&MP.host&&!G.shifting&&\(!G.frozen\|\|MP.meFinished\|\|MP.meOut\)/);
});
test('第三人稱距離預設稍遠，縮放有限度且不影響第一人稱',()=>{
  const c=vm.createContext({G:{view:'tp',topZoom:22},CFG:{cameraDistance:5.8},localStorage:{getItem:()=>null}});
  vm.runInContext(block('function cameraDistance(', 'const runtimeConfigReady='),c);
  assert.equal(c.cameraDistance(undefined),5.8);assert.equal(c.cameraDistance(Infinity),5.8);
  c.zoomCamera(1000);assert.equal(c.CFG.cameraDistance,7);c.zoomCamera(-1000);assert.equal(c.CFG.cameraDistance,3);
  c.G.view='fp';c.zoomCamera(100);assert.equal(c.CFG.cameraDistance,3);
  c.G.view='top';c.zoomCamera(100);assert.equal(c.G.topZoom,48);
});
test('第三人稱近牆可縮至設定下限內，不強行維持最小 1.1 距離穿牆',()=>{
  const c=vm.createContext({G:{px:0,pz:0,wallBoxes:[{minX:-2,maxX:2,minZ:.7,maxZ:1.3}]}});
  vm.runInContext(block('function cameraClearDist(', '/* 身體正前方'),c);
  assert.ok(c.cameraClearDist(0,1,7)<.52);assert.equal(c.cameraClearDist(0,-1,7),7);
});
