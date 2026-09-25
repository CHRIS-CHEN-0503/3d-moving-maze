import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const audio=createRequire(import.meta.url)('../assets/combat-audio.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('破風與命中原創波形不同、短促不削波、首尾平滑',()=>{
  for(const kind of ['swing','hit']){
    const data=audio.render(kind);assert.deepEqual(data,audio.render(kind));
    assert.ok(data.length<=audio.RATE*.25);assert.equal(data[0],0);assert.equal(data.at(-1),0);
    let sum=0,peak=0;for(const n of data){assert.ok(Number.isFinite(n));sum+=n*n;peak=Math.max(peak,Math.abs(n));}
    assert.ok(peak<.9&&peak>.1);assert.ok(Math.sqrt(sum/data.length)>.025);
  }
  assert.notDeepEqual(audio.render('swing'),audio.render('hit'));
});
test('兩份音效只合成一次、最多四個聲源、結束和停止確實斷線',()=>{
  let buffers=0;const sources=[],output={};
  const context={createBuffer(c,n,r){buffers++;assert.equal(c,1);assert.equal(r,audio.RATE);return {getChannelData:()=>new Float32Array(n)};},createBufferSource(){const s={connect:o=>assert.equal(o,output),start(){},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};sources.push(s);return s;}};
  const player=audio.create(context,output);assert.equal(buffers,0);
  for(let i=0;i<10;i++)player.play(i%2?'hit':'swing');
  assert.equal(buffers,2);assert.equal(sources.filter(s=>!s.disconnected).length,4);
  assert.equal(sources[0].buffer,sources[2].buffer);assert.equal(sources[0].stopped,true);
  sources[9].onended();assert.equal(sources[9].disconnected,true);
  player.stop();player.stop();assert.ok(sources.every(s=>s.disconnected));
});
test('尊重靜音、無音效環境及停止場景；接入原有音效匯流排',()=>{
  const start=html.indexOf('const AudioEng={'),script=html.slice(start,html.indexOf('</script>',start));
  const played=[];let stopped=0;
  const c=vm.createContext({window:{},G:{muted:false},sound:{play:kind=>played.push(kind),stop:()=>stopped++}});
  vm.runInContext(script+'\nAudioEng.combatSound=sound;AudioEng.sfxSwing();AudioEng.sfxHit();',c);assert.deepEqual(played,[]);
  vm.runInContext('AudioEng.ctx={};AudioEng.sfxSwing();AudioEng.sfxHit()',c);assert.deepEqual(played,['swing','hit']);
  c.G.muted=true;vm.runInContext('AudioEng.sfxSwing();AudioEng.sfxHit();AudioEng.stopMusic()',c);assert.equal(played.length,2);assert.equal(stopped,1);
  assert.match(html,/CombatAudio\?\.create\(this.ctx,this.fxGain\)/);
  assert.match(html,/visibilitychange[^\n]*combatSound\?\.stop/);
  assert.match(html,/pagehide[^\n]*combatSound\?\.stop/);
});
test('一般空揮只播破風，命中包含自己與其他玩家但結束後不播',()=>{
  let swing=0,hit=0;const c=vm.createContext({AudioEng:{sfxSwing:()=>swing++,sfxHit:()=>hit++},window:{},MP:{started:true,ended:false,mode:'treasure',id:'me',roster:[],treasure:null},applyStun(){},showToast(){},mpName:()=>'',CHARS:[]});
  const start=html.indexOf('function swingWeapon()'),end=html.indexOf('\nfunction applyStun',start);
  vm.runInContext(html.slice(start,end),c);c.swingWeapon();assert.equal(swing,1);assert.equal(hit,0);
  const a=html.indexOf("    case 'hit':{"),b=html.indexOf("    case 'prank':",a);
  vm.runInContext("function handle(m){switch(m.t){"+html.slice(a,b)+'}}',c);
  c.handle({t:'hit',f:'me',to:'other'});c.handle({t:'hit',f:'other',to:'me'});assert.equal(hit,2);
  c.MP.ended=true;c.handle({t:'hit',f:'me',to:'other'});assert.equal(hit,2);
});
