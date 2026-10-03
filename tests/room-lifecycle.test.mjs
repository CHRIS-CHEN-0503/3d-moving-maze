import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const GameplayRules=createRequire(import.meta.url)('../assets/gameplay-rules.js');
const src=readFileSync(new URL('../assets/room-lifecycle.js',import.meta.url),'utf8');
function room(){
  let time=100000;const packets=[],peers=[];
  function peer(id,host){
    const nodes=new Map(),ends=[],starts=[],contacts=[];
    const MP={on:true,id,host,net:{},mode:'shop',seriesRound:1,order:['h','g'],roster:[{id:'h',name:'主'},{id:'g',name:'客',ready:true}],started:false,ended:false,roundMs:10000};
    const G={roundEndsAt:0,running:false},SERIES={kind:'multi',current:0,total:2};
    const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:true,textContent:'',onclick(){}});return nodes.get(id);};
    const c=vm.createContext({MP,G,SERIES,$,Date:{now:()=>time},performance:{now:()=>time},window:{addEventListener(){}},document:{hidden:false},
      setInterval:()=>1,clearInterval(){},AudioEng:{stopMusic(){},stopItemLoop(){}},
      mpSend:m=>packets.push(JSON.parse(JSON.stringify({...m,f:m.f||id}))),
      mpHandle:m=>{if(m.t==='start'){MP.started=true;MP.ended=false;MP.seriesRound=m.seriesRound||1;G.running=true;G.roundEndsAt=time+10000;starts.push(m);}
        if(['shopend','end','twin'].includes(m.t)&&MP.started&&!MP.ended){MP.started=false;MP.ended=true;ends.push(m);}
        if(['hit','tag','rob'].includes(m.t))contacts.push(m);
        if(m.t==='lobby'&&!host)MP.roster=m.players;
        if(m.t==='bye')MP.roster=MP.roster.filter(r=>r.id!==m.f);},
      bindActionBtn:(node,fn)=>node.onclick=fn,showToast(){},
      mpLeave(){MP.on=false;},mpConnect:async()=>{},mpRenderLobby(){},mpBroadcastLobby(){packets.push(JSON.parse(JSON.stringify({t:'lobby',f:id,players:MP.roster})));},mpLobbyPlan:()=>({ready:MP.roster.filter(r=>r.id!=='h').every(r=>r.ready)&&MP.roster.length===2}),
      mpRoundPlayers:()=>MP.roster,mpEndRace(){MP.started=false;MP.ended=true;ends.push('race');},showMPResults(){},resetSeries(){},selectedRoundTotal:()=>2,sendMpRoundStart(){}});
    vm.runInContext(src,c);const p={c,nodes,ends,starts,contacts};peers.push(p);return p;
  }
  const host=peer('h',true),guest=peer('g',false);
  const flush=()=>{let limit=100;while(packets.length&&limit--){const p=packets.shift();for(const peer of peers)peer.c.mpHandle(p);}assert.ok(limit>0);};
  const start=()=>{host.c.mpSend({t:'start',seriesRound:1,roundMs:10000});flush();};
  const advance=ms=>{time+=ms;for(const p of peers)p.c.window.RoomLifecycle.tick();};
  return {host,guest,packets,flush,start,advance};
}
test('等待五秒才開始，重送或回送開始封包不會重建遊戲',()=>{
  const r=room();r.start();assert.equal(r.host.starts.length,0);r.advance(4999);r.flush();assert.equal(r.guest.starts.length,0);
  r.advance(1);r.flush();assert.equal(r.host.starts.length,1);assert.equal(r.guest.starts.length,1);
  r.advance(1000);r.flush();assert.equal(r.host.starts.length,1);assert.equal(r.guest.starts.length,1);
});
test('背景分頁沿用既有房間計時更新新地標與回條，不新增計時器；前景與已結束不重複跑',()=>{
  const r=room();let variants=0,claims=0;r.host.c.window.ModeVariants={frame:()=>variants++};r.host.c.window.ShopClaims={tick:()=>claims++};r.start();r.advance(5000);r.flush();assert.equal(variants,0);assert.equal(claims,0);
  r.host.c.document.hidden=true;r.advance(250);assert.equal(variants,1);assert.equal(claims,1);r.host.c.MP.ended=true;r.advance(250);assert.equal(variants,1);assert.equal(claims,1);
  assert.equal((src.match(/setInterval\(/g)||[]).length,1);
});
test('房主不收到自己結束封包仍準時完成，遺失的訪客結果在下一次心跳補送',()=>{
  const r=room();r.start();r.advance(5000);r.flush();r.advance(10000);
  assert.equal(r.host.ends.length,1);assert.equal(r.guest.ends.length,0);r.packets.length=0;
  r.advance(1100);r.flush();assert.equal(r.guest.ends.length,1);r.advance(1100);r.flush();assert.equal(r.guest.ends.length,1);
});
test('偽造結束封包無效；房主逾時清楚中止且不捏造勝負',()=>{
  const r=room();r.start();r.advance(5000);r.flush();r.guest.c.mpHandle({t:'shopend',f:'stranger',sr:1});assert.equal(r.guest.ends.length,0);
  r.advance(16000);assert.equal(r.guest.c.MP.started,false);assert.equal(r.guest.nodes.get('mpResultTitle').textContent,'連線中止');assert.equal(r.guest.ends.length,0);
});
test('倒數中離開會取消兩端開始；尚未準備的玩家不能啟動',()=>{
  const r=room();r.host.c.MP.roster[1].ready=false;r.host.c.mpSend({t:'start',seriesRound:1,roundMs:10000});r.flush();r.advance(6000);assert.equal(r.host.starts.length,0);assert.equal(r.guest.starts.length,0);assert.equal(r.host.nodes.get('roomCountdown')?.hidden??true,true);
  const s=room();s.start();s.host.c.mpHandle({t:'bye',f:'g'});s.flush();s.advance(5000);assert.equal(s.host.starts.length,0);assert.equal(s.guest.starts.length,0);
});
test('準備狀態只由房主更新名單，未知玩家不能插入',()=>{
  const r=room();r.host.c.mpHandle({t:'ready',f:'g',ready:false});assert.equal(r.host.c.MP.roster[1].ready,false);
  r.host.c.mpHandle({t:'ready',f:'g',ready:true});assert.equal(r.host.c.MP.roster[1].ready,true);
  r.host.c.mpHandle({t:'ready',f:'stranger',ready:true});assert.equal(r.host.c.MP.roster.length,2);
});
test('訪客按一次準備立即顯示傳送中，遺失封包重送直到房主確認',()=>{
  const r=room();r.host.c.MP.roster[1].ready=false;r.guest.c.MP.roster[1].ready=false;
  r.guest.nodes.get('mpReady').onclick();assert.equal(r.guest.nodes.get('mpReady').disabled,true);
  assert.match(r.guest.nodes.get('mpReady').textContent,/傳送中/);r.packets.length=0;
  r.advance(801);r.flush();assert.equal(r.host.c.MP.roster[1].ready,true);assert.equal(r.guest.nodes.get('mpReady').disabled,false);
  r.guest.nodes.get('mpReady').onclick();r.flush();assert.equal(r.host.c.MP.roster[1].ready,false);
  r.host.c.mpHandle({t:'ready',f:'g',ready:true,readySeq:1});assert.equal(r.host.c.MP.roster[1].ready,false);
});
test('準備確認逾時解鎖重試；離開清除待送狀態',()=>{
  const r=room();r.guest.nodes.get('mpReady').onclick();r.packets.length=0;r.advance(10001);
  assert.equal(r.guest.nodes.get('mpReady').disabled,false);assert.match(r.guest.nodes.get('mpStatus').textContent,/再按一次/);
  r.guest.nodes.get('mpReady').onclick();r.guest.c.mpLeave();r.packets.length=0;r.advance(1000);assert.equal(r.packets.some(m=>m.t==='ready'),false);
});
test('尋寶無人持有時到期平手；結果遺失會補送且拒絕偽造超時',()=>{
  const r=room();for(const p of [r.host,r.guest]){p.c.MP.mode='treasure';p.c.MP.treasure={holder:null};}
  r.start();r.advance(5000);r.flush();r.guest.c.mpHandle({t:'twin',timeout:true,f:'g',sr:1});assert.equal(r.guest.ends.length,0);
  r.advance(10000);assert.equal(r.host.ends[0].timeout,true);r.packets.length=0;r.advance(1100);r.flush();
  assert.equal(r.guest.ends.length,1);assert.equal(r.guest.ends[0].winner,null);r.advance(1100);r.flush();assert.equal(r.guest.ends.length,1);
});
test('尋寶持有者獲一次 30 秒延長，心跳同步訪客且不提前結束',()=>{
  const r=room();for(const p of [r.host,r.guest]){p.c.MP.mode='treasure';p.c.MP.treasure={holder:'g'};}
  r.start();r.advance(5000);r.flush();r.advance(10000);r.flush();
  assert.equal(r.host.ends.length,0);assert.equal(r.guest.c.MP.duelOvertime,true);assert.equal(r.guest.c.G.roundEndsAt,r.host.c.G.roundEndsAt);
  for(let i=0;i<29;i++){r.advance(1000);r.flush();}assert.equal(r.host.ends.length,0);
  r.advance(1000);r.flush();assert.equal(r.host.ends.length,1);assert.equal(r.guest.ends.length,1);
});
test('命中由房主裁定，隔牆拒絕；接收端位置落後仍套用同一結果且重送不重複',()=>{
  const r=room(),wall={minX:-.2,maxX:.2,minZ:-2,maxZ:2};
  for(const p of [r.host,r.guest]){
    p.c.window.GameplayRules=p.c.GameplayRules=GameplayRules;p.c.MP.mode='treasure';p.c.G.wallBoxes=[wall];
    p.c.botPosOf=id=>({x:id==='h'?-.8:.8,z:0});
  }
  r.start();r.advance(5000);r.flush();r.guest.c.mpSend({t:'hit',to:'h',sr:1});r.flush();
  assert.equal(r.host.contacts.length,0);assert.equal(r.guest.contacts.length,0);
  r.host.c.G.wallBoxes=[];r.guest.c.botPosOf=()=>null;r.guest.c.mpSend({t:'hit',to:'h',sr:1});r.flush();
  assert.equal(r.host.contacts.length,1);assert.equal(r.guest.contacts.length,1);assert.equal(r.guest.contacts[0].f,'g');
  r.advance(500);r.flush();assert.equal(r.host.contacts.length,1);assert.equal(r.guest.contacts.length,1);
  r.guest.c.mpHandle({t:'contact',f:'g',sr:1,event:{t:'hit',f:'g',to:'h'}});assert.equal(r.guest.contacts.length,1);
});
