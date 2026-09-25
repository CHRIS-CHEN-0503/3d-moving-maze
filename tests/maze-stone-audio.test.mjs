import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sound=createRequire(import.meta.url)('../assets/maze-stone-audio.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('原創石牆聲固定長度、無削波、首尾無突跳且可重建',()=>{
  const a=sound.render(),b=sound.render();assert.deepEqual(a,b);assert.equal(a.length,sound.RATE*sound.DURATION);
  let peak=0,sum=0;for(const x of a){assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));sum+=x*x;}
  assert.ok(peak<=.72&&peak>.3);assert.ok(Math.sqrt(sum/a.length)>.035);
  assert.equal(a[0],0);assert.equal(a.at(-1),0);
});
test('只生成一次緩衝，重播停止舊聲源，停止與自然結束都釋放連線',()=>{
  const sources=[];let buffers=0;const output={};
  const context={createBuffer(ch,n,rate){buffers++;assert.equal(ch,1);assert.equal(rate,22050);return{getChannelData:()=>new Float32Array(n)};},createBufferSource(){const s={connect(out){assert.equal(out,output);},start(){this.started=true;},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};sources.push(s);return s;}};
  const player=sound.create(context,output);player.play();const oldEnd=sources[0].onended;player.play();
  assert.equal(buffers,1);assert.equal(sources[0].stopped,true);assert.equal(sources[0].disconnected,true);assert.equal(sources[0].buffer,sources[1].buffer);
  oldEnd();player.stop();assert.equal(sources[1].stopped,true);assert.equal(sources[1].disconnected,true);player.stop();
  player.play();sources[2].onended();assert.equal(sources[2].disconnected,true);player.stop();
});
test('變形入口使用石牆聲，其他警報不變，尊重靜音與語音音量匯流排',()=>{
  const script=html.slice(html.indexOf('const AudioEng={'),html.indexOf('</script>',html.indexOf('const AudioEng={')));
  let played=0,stopped=0;const c=vm.createContext({window:{},G:{muted:true}});vm.runInContext(script,c);
  c.player={play:()=>played++,stop:()=>stopped++};vm.runInContext('AudioEng.ctx={};AudioEng.shiftSound=player;AudioEng.sfxShift()',c);assert.equal(played,0);
  c.G.muted=false;vm.runInContext('AudioEng.sfxShift();AudioEng.stopMusic()',c);assert.equal(played,1);assert.equal(stopped,1);
  const shift=html.slice(html.indexOf('function doShift()'),html.indexOf('/* 迷宮變形時出口搬家'));
  assert.match(shift,/AudioEng\.sfxShift\(\)/);assert.doesNotMatch(shift,/sfxAlarm/);
  assert.equal((shift.match(/announceAsset\('maze\.shift\.deep'/g)||[]).length,1);
  assert.match(shift,/showToast\('🌀 新迷宮出現了！道具和食物也重新出現囉',1800,false\)/);
  assert.match(html,/MazeStoneAudio\?\.create\(this.ctx,this.fxGain\)/);
  assert.match(html,/case 'tag':[\s\S]*?AudioEng\.sfxAlarm\(\)/);
});
