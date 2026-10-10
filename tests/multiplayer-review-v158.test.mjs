import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const require=createRequire(import.meta.url),GameRules=require('../assets/game-rules.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);let depth=0,at=html.indexOf('{',start);for(;at<html.length;at++){if(html[at]==='{')depth++;else if(html[at]==='}'&&--depth===0)break;}return html.slice(start,at+1);}

// The real message handler and treasure helpers run in an isolated room with a
// local loop-back transport, standing in for the host-relayed broker.
function room({host=true,id=host?'host':'guest'}={}){
  const toasts=[],sent=[],G={mazeW:5,mazeH:5,cell:4,px:0,pz:0,wallBoxes:[],running:true};
  const MP={on:true,started:true,ended:false,host,id,mode:'treasure',seriesRound:1,round:0,order:['host','guest'],roster:[{id:'host',name:'房主'},{id:'guest',name:'客人'},{id:'gone',name:'離開者'}],players:{guest:{tx:0,tz:0,lastSeen:1000,mesh:{position:{x:0,z:0},visible:true}},gone:{tx:4,tz:4,lastSeen:1000,mesh:{position:{x:4,z:4},visible:true}}},outs:{},finishers:[],treasure:{holder:null,cell:{x:2,y:2},lastPing:null,nextPingAt:0},bots:[]};
  const nodes=new Map();const c=vm.createContext({MP,G,CHARS:[{emoji:''}],GameRules,GAME_VERSION:'1.59.0',clearInterval(){},MP_ROUND_EVENTS:new Set(),performance:{now:()=>1000},
    $:id=>{if(!nodes.has(id))nodes.set(id,{style:{},textContent:'',disabled:true});return nodes.get(id);},showToast:s=>toasts.push(s),AudioEng:{sfxUse(){},sfxHit(){},stopMusic(){},stopItemLoop(){}},updateAtkBtn(){},escapeHtml:s=>String(s),CaptureFlag:{leave(){}},
    mpBroadcastLobby(){},mpRenderLobby(){},mpEndRace(){c.ended=(c.ended||0)+1;},mpSend:m=>{const packet={...m,f:MP.id,sr:1};sent.push(packet);c.mpHandle(packet);}});
  vm.runInContext([fn('cellToWorld'),fn('worldToCell'),fn('botPosOf'),fn('mpName'),fn('raceSettledCount'),fn('dropTreasure'),fn('syncTreasure'),fn('mpVersionMismatch'),fn('setTreasureHolder'),block('function mpHandle(', 'function mpAfterStart(')].join('\n'),c);
  // cellToWorld/worldToCell in index.html read G; centre the 5x5 grid like the game.
  return {c,MP,G,toasts,sent,nodes};
}

test('treasure pickup is a claim the host arbitrates once; guests never flip the holder on their own',()=>{
  const guest=room({host:false,id:'guest'});guest.c.mpHandle({t:'tres',holder:'guest',f:'guest',sr:1});assert.equal(guest.MP.treasure.holder,null,'a guest ignores raw claims');
  guest.c.mpHandle({t:'tresok',holder:'host',f:'host',sr:1});assert.equal(guest.MP.treasure.holder,'host');
  guest.c.mpHandle({t:'tresok',holder:'guest',f:'host',sr:1});assert.equal(guest.MP.treasure.holder,'host','a later verdict cannot steal a held gem');
  const host=room();const at=host.c.cellToWorld(2,2);host.G.px=at.x;host.G.pz=at.z;
  host.MP.players.guest.mesh.position={x:at.x+.5,z:at.z};host.c.mpHandle({t:'tres',holder:'guest',f:'guest',sr:1});
  assert.equal(host.MP.treasure.holder,'guest');assert.deepEqual(host.sent.filter(m=>m.t==='tresok').map(m=>m.holder),['guest']);
  host.c.mpHandle({t:'tres',holder:'host',f:'host',sr:1});assert.equal(host.MP.treasure.holder,'guest','second claimant loses');
  const far=room();far.MP.players.guest.mesh.position={x:8,z:8};far.c.mpHandle({t:'tres',holder:'guest',f:'guest',sr:1});assert.equal(far.MP.treasure.holder,null,'a claim from across the maze is refused');
});

test('when the holder leaves, the host returns the gem to their last cell instead of freezing the round',()=>{
  const h=room();h.MP.treasure.holder='gone';const last=h.c.cellToWorld(4,0);h.MP.players.gone.mesh.position={x:last.x,z:last.z};
  h.c.mpHandle({t:'bye',f:'gone',sr:1});
  assert.equal(h.MP.treasure.holder,null);assert.deepEqual({...h.MP.treasure.cell},{x:4,y:0});assert.ok(h.sent.some(m=>m.t==='tresdrop'&&m.from==='gone'));
  const guest=room({host:false,id:'guest'});guest.MP.treasure.holder='gone';guest.c.mpHandle({t:'tresdrop',x:9,y:1,from:'gone',f:'host',sr:1});assert.equal(guest.MP.treasure.holder,'gone','out-of-maze drops are ignored');
  const lifecycle=read('assets/room-lifecycle.js');assert.match(lifecycle,/'roompulse','tresok','tresdrop'\]\.includes\(m\.t\)&&owner&&m\.f!==owner\)return;/,'only the host may announce verdicts');
  assert.match(lifecycle,/const critical=new Set\(\[[^\]]*'tresok','tresdrop'\]\)/);
});

test('a racer who finished and then left counts once; the grace period ends even with the host in the background',()=>{
  const h=room();h.MP.mode='race';h.MP.roster=[{id:'host'},{id:'guest'},{id:'third'}];
  h.c.mpHandle({t:'reach',f:'guest',tm:20,sr:1});h.c.mpHandle({t:'bye',f:'guest',sr:1});
  assert.equal(h.c.raceSettledCount(),1);assert.equal(h.c.ended||0,0,'third racer is still running');
  assert.match(read('assets/room-lifecycle.js'),/if\(MP\.mode==='race'&&MP\.raceEndAt&&now>MP\.raceEndAt&&typeof mpEndRace==='function'\)mpEndRace\(\);/);
});

test('a lobby keeps seats for connected people only and joining twice never keeps two live connections',()=>{
  const h=room();h.MP.started=false;h.MP.mode='race';h.MP.maxPlayers=3;h.MP.roster=[{id:'host'},{id:'bot1',bot:true},{id:'bot2',bot:true},{id:'old',disconnected:true}];
  h.c.mpHandle({t:'hello',f:'friend',name:'朋友',charIdx:0,ver:'1.59.0'});
  assert.deepEqual(h.MP.roster.map(r=>r.id),['host','friend']);assert.equal(h.sent.some(m=>m.t==='full'),false);
  const join=html.slice(html.indexOf("$('mpJoin').onclick="),html.indexOf("$('mpStart').onclick="));assert.match(join,/MP\.net\.close\(\);MP\.net=null;/);assert.match(join,/\$\('mpJoin'\)\.disabled=true;/);
  const connect=fn('mpConnect');assert.match(connect,/if\(MP\.net!==net\)return;/);assert.match(connect,/Math\.min\(8000,1000\*2\*\*tries\)/);
  const lobby=html.slice(html.indexOf('<div id="mpLobby"'),html.indexOf('id="mpClose"'));assert.equal((lobby.match(/id="mpStatus"/g)||[]).length,1);assert.ok(lobby.indexOf('id="mpStatus"')>lobby.lastIndexOf('</div>',lobby.indexOf('id="mpStatus"')),'status sits outside the hidden lobby panel');
});

test('rage timing travels as time remaining and approved wall breaks are applied regardless of local clocks',()=>{
  const rage=read('assets/tag-rage.js');
  assert.match(rage,/left:state\.until\?Math\.max\(0,state\.until-Date\.now\(\)\):0/);
  assert.match(rage,/until:!m\.state\.until\?0:Number\.isFinite\(left\)\?\(left>0\?Date\.now\(\)\+Math\.min\(left,120000\):0\):m\.state\.until/);
  const wall=rage.slice(rage.indexOf("if(m.t==='ragewall')"),rage.indexOf("handle(m);"));assert.doesNotMatch(wall,/raging\(/);
  assert.match(read('assets/shop-claims.js'),/if\(m\.t==='start'&&!MP\.started\)reset\(\);baseHandle\(m\);/);
});

test('maze shifts are retried until delivered, and the owl flight really reveals the whole maze',()=>{
  assert.match(read('assets/room-lifecycle.js'),/'contact','tresok','tresdrop','shift'\]\.includes\(m\.t\)\)outbox\.push/);
  assert.match(html,/f\.fullVision=isShop\(\);f\.overview=performance\.now\(\)<G\.owlUntil;/);
});

test('the host reports every computer in its own position packet, and idle positions fall back to a 1 s heartbeat',()=>{
  const h=room({host:false,id:'guest'});h.MP.order=['host','guest'];h.MP.roster=[{id:'host'},{id:'guest'},{id:'bot1',bot:true}];
  h.MP.players.host={mesh:{visible:false}};h.MP.players.bot1={mesh:{visible:false}};
  h.c.mpHandle({t:'pos',f:'host',x:1,z:2,h:0,bots:[{id:'bot1',x:3,z:-4,h:1},{id:'guest',x:9,z:9,h:0},{id:'ghost',x:0,z:0,h:0}],sr:1});
  assert.deepEqual([h.MP.players.host.tx,h.MP.players.bot1.tx,h.MP.players.bot1.tz],[1,3,-4]);assert.equal(h.MP.players.bot1.mesh.visible,true);
  assert.equal(h.MP.players.guest.tx,0,'only computer seats can be moved by the host packet');
  h.c.mpHandle({t:'pos',f:'guest2',x:0,z:0,h:0,bots:[{id:'bot1',x:-3,z:0,h:0}],sr:1});assert.equal(h.MP.players.bot1.tx,3,'a guest cannot move computers');
  h.c.mpHandle({t:'pos',f:'host',x:1,z:2,h:0,bots:[{id:'bot1',x:999,z:0,h:0}],sr:1});assert.equal(h.MP.players.bot1.tx,3,'out-of-maze poses are refused');
  // Run the real broadcast timer with a fake clock.
  const start=html.indexOf('  let lastPose=\'\',lastPoseAt=0;'),end=html.indexOf("},MP.mode==='ctf'?200:120);",start);assert.ok(start>0&&end>start);
  let time=0,tickFn=null;const sent=[];const MP={started:true,ended:false,host:true,mode:'treasure',bots:[{id:'bot1',x:1,z:1,h:0},{id:'bot2',x:2,z:2,h:0}]},G={px:0,pz:0,heading:0};
  vm.runInContext(html.slice(start,end)+"},120);",vm.createContext({MP,G,performance:{now:()=>time},setInterval:fn=>{tickFn=fn;return 1;},mpSend:m=>sent.push(m)}));
  for(let i=0;i<9;i++){time+=120;tickFn();}
  assert.equal(sent.length,1,'nothing moved: one packet carries the host and both computers');assert.deepEqual(sent[0].bots.map(b=>b.id),['bot1','bot2']);
  time+=1000;tickFn();assert.equal(sent.length,2,'heartbeat after one second');
  for(let i=0;i<8;i++){time+=120;MP.bots[0].x+=.1;tickFn();}assert.equal(sent.length,10,'moving: one packet per 120 ms tick instead of one per actor');
});

test('a guest that missed treasure verdicts adopts the host state carried by the room pulse',()=>{
  const host=room();host.c.setTreasureHolder('guest');host.c.setTreasureHolder(null);host.c.setTreasureHolder('host');assert.equal(host.MP.treasure.v,3,'each host verdict gets a new version');
  host.c.setTreasureHolder('host');assert.equal(host.MP.treasure.v,3,'no change, no new version');assert.equal(host.c.syncTreasure({holder:'guest',x:0,y:0,v:9}),false,'the host never adopts a pulse');
  const g=room({host:false,id:'guest'});
  // (a) the tresok was lost: the gem still looks free here, yet the host says it is held.
  assert.equal(g.c.syncTreasure({holder:'host',x:2,y:2,v:1}),true);assert.equal(g.MP.treasure.holder,'host');
  // (b) a later drop was lost too: the next pulse moves the gem and frees it.
  assert.equal(g.c.syncTreasure({holder:null,x:4,y:0,v:2}),true);assert.equal(g.MP.treasure.holder,null);assert.deepEqual({...g.MP.treasure.cell},{x:4,y:0});
  // Stale, forged or impossible pulses change nothing.
  for(const bad of [{holder:'host',x:2,y:2,v:2},{holder:'host',x:2,y:2,v:1},{holder:'stranger',x:1,y:1,v:5},{holder:'host',x:9,y:1,v:6},{holder:'host',x:1.5,y:1,v:7},{holder:'host',x:1,y:1,v:'8'}])assert.equal(g.c.syncTreasure(bad),false,JSON.stringify(bad));
  assert.equal(g.MP.treasure.holder,null);
  // (c) a guest that thinks it still holds the gem after a timeout drop is corrected, so it stops claiming the win.
  g.c.setTreasureHolder('guest');assert.equal(g.c.syncTreasure({holder:null,x:3,y:3,v:3}),true);assert.equal(g.MP.treasure.holder,null);
  const lifecycle=read('assets/room-lifecycle.js');
  assert.match(lifecycle,/tres:\{holder:MP\.treasure\.holder\|\|null,x:MP\.treasure\.cell\.x,y:MP\.treasure\.cell\.y,v:MP\.treasure\.v\|\|0\}/,'the host pulse carries the versioned state');
  assert.match(lifecycle,/if\(MP\.started&&MP\.mode==='treasure'&&m\.tres&&typeof syncTreasure==='function'\)syncTreasure\(m\.tres\);/,'guests apply it from the host pulse only');
});

test('rooms only admit the same release, and a newer guest leaves an older host with clear advice',()=>{
  assert.match(html,/const GAME_VERSION='1\.59\.0'/);
  const h=room();h.MP.started=false;h.MP.mode='race';h.MP.maxPlayers=4;h.MP.roster=[{id:'host'}];
  h.c.mpHandle({t:'hello',f:'old',name:'舊版',charIdx:0});h.c.mpHandle({t:'hello',f:'odd',name:'他版',charIdx:0,ver:'1.57.9'});
  assert.deepEqual(h.MP.roster.map(r=>r.id),['host'],'older or different clients get no seat');
  assert.deepEqual(h.sent.filter(m=>m.t==='full').map(m=>[m.to,m.reason,m.ver]),[['old','version','1.59.0'],['odd','version','1.59.0']]);
  h.c.mpHandle({t:'hello',f:'same',name:'同版',charIdx:0,ver:'1.59.0'});assert.deepEqual(h.MP.roster.map(r=>r.id),['host','same']);
  assert.match(fn('mpBroadcastLobby'),/fillBots:MP\.fillBots,ver:GAME_VERSION\}\)/,'the lobby announces the release');
  // A guest told its version differs leaves the room but keeps the join screen with the reason.
  const g=room({host:false,id:'guest'});g.MP.started=false;let closed=0;g.MP.net={close(){closed++;}};
  g.c.mpHandle({t:'full',to:'guest',reason:'version',ver:'1.59.1',f:'host'});
  assert.equal(closed,1);assert.equal(g.MP.on,false);assert.equal(g.MP.net,null);assert.match(g.nodes.get('mpStatus').textContent,/房主是 v1\.59\.1，你的是 v1\.59\.0/);assert.equal(g.nodes.get('mpJoin').disabled,false);
  const old=room({host:false,id:'guest'});old.MP.started=false;old.MP.net={close(){}};old.c.mpHandle({t:'lobby',f:'host',players:[{id:'host'}],mode:'race'});
  assert.equal(old.MP.on,false,'an older host (no version in its lobby) is left at once');assert.match(old.nodes.get('mpStatus').textContent,/版本與你不同/);
  assert.match(html,/const hello=\(\)=>mpSend\(\{t:'hello',name:getPlayerName\(\),charIdx:G\.charIdx,ver:GAME_VERSION\}\);/);
});
