import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),html=readFileSync(new URL('index.html',root),'utf8'),mode=readFileSync(new URL('story/tower-mode.js',root),'utf8');
const tag=path=>html.indexOf('src="'+path+'?v=');
test('new read-only insight and environment providers load once before gameplay; tactics after mode variants',()=>{
  for(const path of ['story/tower-story-insights.js','story/tower-environment-life.js','assets/classic-tactics-core.js','assets/classic-tactics.js']){
    // The environment life provider changed again in the v1.58.0 performance round.
    assert.equal(html.split('src="'+path+'?v='+(path==='story/tower-environment-life.js'?'1.58.0':'1.57.0')+'"').length,2,path);
  }
  assert.ok(tag('story/tower-narrative.js')<tag('story/tower-story-insights.js'));
  assert.ok(tag('story/tower-adventure-events.js')<tag('story/tower-story-insights.js'));
  assert.ok(tag('story/tower-story-insights.js')<tag('story/tower-mode.js'));
  assert.ok(tag('story/tower-environment-life.js')<tag('story/tower-mode.js'));
  assert.ok(tag('assets/mode-variants.js')<tag('assets/classic-tactics-core.js'));
  assert.ok(tag('assets/classic-tactics-core.js')<tag('assets/classic-tactics.js'));
});
test('environment manager belongs to the existing gameplay clock and releases before loading another floor',()=>{
  const load=mode.slice(mode.indexOf('function loadFloor('),mode.indexOf('function buildWorld('));
  assert.ok(load.indexOf('environmentLife?.destroy()')>=0);
  assert.ok(load.indexOf('environmentLife?.destroy()')<load.indexOf('startGame()'));
  assert.match(mode,/environmentLife\?\.tick\(dt\)/);
  assert.match(mode,/clear:hasClearPath/);
  assert.match(mode,/reduced:\(\)=>!!reducedMotion\?\.matches/);
  assert.match(mode,/quality:\(\)=>window\.MazeQuality\?\.mode\(\)/);
});
test('late initial tag announcement cannot escape its mode, round, series or leave state',()=>{
  const start=html.indexOf('const tagRoundStart='),end=html.indexOf('\n          if(MP.taggedId',start),source=html.slice(start,end);
  assert.ok(source.length>100);
  const harness=()=>{let callback=null;const calls=[],ctx={MP:{on:true,started:true,ended:false,mode:'tag',seed:21,seriesRound:2,taggedId:'it'},G:{startTime:100},setTimeout(fn,ms){assert.equal(ms,600);callback=fn;},announceTag:(...a)=>calls.push(a),mpName:id=>id,genderOf:()=> 'm'};vm.runInNewContext(source,ctx);return {ctx,calls,fire:()=>callback()};};
  const normal=harness();normal.fire();assert.deepEqual(normal.calls,[['it','m']]);
  for(const mutate of [r=>r.MP.on=false,r=>r.MP.started=false,r=>r.MP.ended=true,r=>r.MP.mode='ctf',r=>r.MP.seed++,r=>r.MP.seriesRound++,r=>r.G.startTime++]){const h=harness();mutate(h.ctx);h.fire();assert.deepEqual(h.calls,[]);}
});
test('leaving a room clears visible old tag banner and its owned timeout',()=>{
  const start=html.indexOf('function mpLeave(){'),end=html.indexOf('\nfunction confirmMultiplayerExit',start),nodes=new Map(),timers=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{display:'block'},_tm:42});return nodes.get(id);};
  const ctx={window:{},MP:{players:{},net:null},G:{},scene:{remove(){}},$,mpSend(){},clearInterval(){},clearTimeout:id=>timers.push(id)};
  vm.runInNewContext(html.slice(start,end)+';mpLeave();',ctx);
  assert.deepEqual(timers,[42]);assert.equal($('tagAnnounce').style.display,'none');assert.equal(ctx.MP.on,false);
});
test('atlas explains new observed-only notes, safe companion tactics and effects without changing skill count',()=>{
  const atlas=readFileSync(new URL('docs/職業裝備圖鑑.html',root),'utf8');
  for(const text of ['把線索連起來','事件紀錄未保存選項時會明示','不猜測當時選擇','淨化會尋找真正需要','不穿牆、不擠到隊友','九職業特效','減少動態時隱藏'])assert.ok(atlas.includes(text),text);
});
