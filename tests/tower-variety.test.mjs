import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),D=require('../story/tower-dungeons.js'),S=require('../story/tower-side-stories.js'),H=require('../story/tower-hazards.js'),V=require('../assets/game-voice.js'),THREE=require('../lib/three.min.js');
const read=name=>readFileSync(new URL('../story/'+name,import.meta.url),'utf8');
const sources={coreSource:read('story-core.js'),narrativeSource:read('tower-narrative.js'),sideStoriesSource:read('tower-side-stories.js'),dungeonsSource:read('tower-dungeons.js'),encountersSource:read('tower-encounters.js'),charactersSource:read('tower-characters.js'),runtimeSource:read('tower-mode.js')};
const flow=readFileSync(new URL('./tower-flow.test.mjs',import.meta.url),'utf8'),start=flow.indexOf('function harness('),end=flow.indexOf('\ntest(',start);
const factory=vm.runInNewContext('('+flow.slice(start,end).trim()+')',{vm,assert,THREE,console,SAVE_KEY:'maze3d_tower_v1',...sources});
const bridge=`window.TowerHazards=globalThis.__hazardModule;
window.__variety={state:()=>({run,hazards,hazardGrace,hazardSlow,dungeonObjects}),readStory,readSideStory,journal,handleAction,damage,tickHazards,buildWorld,
setShiftDue:()=>{shiftLeft=0;},setClock:(elapsed)=>{if(run.expedition.active)run.expedition.active.elapsed=elapsed;else run.floorElapsed=elapsed;hurtLeft=0;hazardGrace=0;}};`;
function runtime(run){
  const h=factory(run,bridge);h.context.TowerHazards=H;h.api=h.context.__variety;
  h.start=()=>{h.context.TowerMode.open();h.click('continue');if(h.context.TowerMode.paused)h.click('close');};
  return h;
}
function runAt(floor,seed=1,version=3){const r=C.newRun({seed});r.floor=floor;r.floorsCleared=99-floor;r.chronicle=require('../story/tower-narrative.js').newChronicle(floor);r.expedition=D.newExpedition(version);return r;}
const offer=(floor,seed=1,version=3)=>D.offer(runAt(floor,seed,version));
function fixture(kind,floor=55,version=3){for(let seed=1;seed<500;seed++){const run=runAt(floor,seed,version);if(D.offer(run)?.kind===kind)return run;}throw Error('fixture');}
function active(run){const o=D.offer(run);return D.enter(D.discover(run).run,o.id,{x:0,y:0,shiftLeft:10}).run;}

test('v2 的 9,900 個舊副本完整保留，既有存檔不重抽',()=>{
  const hash=createHash('sha256');
  for(let seed=1;seed<=100;seed++)for(let floor=99;floor>=1;floor--)hash.update(JSON.stringify(offer(floor,seed,2))+'\n');
  assert.equal(hash.digest('hex'),'d2ef9c807445a4939309cd996cd9a733595fe853600c0ef7d2904855ce54a6a5');
});
test('新行程保留出現機率，避開最近兩次種類，新解鎖種類優先輪替且讀檔不重抽',()=>{
  const all=new Set();
  for(let seed=1;seed<=100;seed++){
    const recent=[],counts={};
    for(let floor=99;floor>=1;floor--){
      const o=offer(floor,seed);assert.equal(!!o,!!offer(floor,seed,2));if(!o)continue;
      assert.ok(!recent.includes(o.kind));
      const pool=[...Object.keys(D.TYPES),...S.eligible(floor).map(s=>s.kind)].filter(k=>!recent.includes(k));
      assert.equal(counts[o.kind]||0,Math.min(...pool.map(k=>counts[k]||0)));
      counts[o.kind]=(counts[o.kind]||0)+1;recent.push(o.kind);if(recent.length>2)recent.shift();all.add(o.kind);
      assert.deepEqual(D.offer(C.validateSave(runAt(floor,seed))),o);
    }
  }
  assert.equal(all.size,9);
});
test('每種模式都有五級難度，擴大地圖時保留合理時限，機關與懲罰逐層提高',()=>{
  const rows=new Map();
  for(let seed=1;seed<200;seed++)for(let floor=95;floor>=1;floor--){
    const o=offer(floor,seed);if(!o)continue;
    const base=D.TYPES[o.kind]||S.get(o.kind);
    assert.equal(o.tier,Math.min(5,1+Math.floor((99-floor)/20)));
    assert.equal(o.trapCount,o.tier);assert.equal(o.mistakeDamage,5+2*(o.tier-1));
    assert.ok(o.shiftSeconds>=14&&o.shiftSeconds<=base.shiftSeconds);
    assert.ok(o.timeLimit>o.shiftSeconds*2);
    rows.set(o.kind+':'+o.tier,o);
  }
  for(const kind of ['archive','bells','lantern','supper'])for(let tier=2;tier<=5;tier++){
    const a=rows.get(kind+':'+(tier-1)),b=rows.get(kind+':'+tier);
    assert.ok(b.size>=a.size&&b.shiftSeconds<a.shiftSeconds&&b.mistakeDamage>a.mistakeDamage);
    assert.ok(b.timeLimit/b.size**2<a.timeLimit/a.size**2);
  }
});
test('v3 九種副本可續存、完成、一次性領獎；v2 中途進度不改，下一層才升級',()=>{
  for(const kind of [...Object.keys(D.TYPES),...Object.keys(S.STORIES)]){
    let r=active(fixture(kind)),o=D.offer(r);
    for(const i of ['bells','threads','stars'].includes(kind)?o.order:[0,1,2]){
      if(kind==='stars'&&i!==0&&!r.expedition.active.shiftCount){r=D.tick(r,o.shiftSeconds).run;r=D.observeShift(r).run;}
      const result=D.interact(r,i,r.revision,{choice:o.steps?.[i].correctChoice});assert.ok(result.ok);
      r=C.validateSave(JSON.stringify(result.run));assert.ok(r);
    }
    const done=D.finish(r,'completed');assert.ok(done.ok);assert.equal(done.run.coins,r.coins+o.reward.coins);
    assert.equal(done.run.expedition.history[0].catalogVersion,3);assert.ok(C.validateSave(done.run));assert.equal(D.finish(done.run,'completed').ok,false);
  }
  let r=active(fixture('archive',95,2));r=D.interact(r,0).run;r=D.tick(r,7).run;
  assert.deepEqual(C.validateSave(JSON.stringify(r)),r);assert.equal(D.offer(r).catalogVersion,2);
  r=D.finish(r,'abandoned').run;r=C.descend(r).run;assert.equal(r.expedition.version,3);assert.equal(r.expedition.history[0].catalogVersion,2);assert.ok(C.validateSave(r));
});
test('四種陷阱配置固定、有安全區、留繞行空間，數量與繪製成本有上限',()=>{
  assert.deepEqual(H.layout({floor:99,size:7,seed:1}),[]);
  const blocked=['4,4','6,8','0,0','12,12'],all=new Set();
  for(let floor=95;floor>=1;floor--){
    const traps=H.layout({floor,size:13,seed:123,blocked});assert.deepEqual(traps,H.layout({floor,size:13,seed:123,blocked}));assert.ok(traps.length<=8&&traps.length>0);
    for(const trap of traps){
      all.add(trap.kind);assert.ok(trap.cx+trap.cy>=4);assert.ok(24-trap.cx-trap.cy>=3);
      assert.ok(blocked.every(key=>{const [x,y]=key.split(',').map(Number);return Math.abs(x-trap.cx)+Math.abs(y-trap.cy)>1;}));
      let meshes=0;const model=H.build(THREE,trap);model.traverse(o=>{assert.ok(!o.isLight&&!o.isSprite);if(o.isMesh){meshes++;assert.ok(!o.material.map);}});assert.ok(meshes<=7);
      for(const state of ['idle','warning','active']){H.animate(model,{state,progress:.5},12);assert.ok(Number.isFinite(model.userData.moving.position.y));}
    }
  }
  assert.equal(all.size,4);
});
test('每個機關都有完整 1.8 秒預警，不因樓層加深縮短躲避時間',()=>{
  for(const kind of Object.keys(H.TYPES))for(const tier of [1,5]){
    const trap={kind,tier,offset:0},rest=6-(tier-1)*.4;
    assert.equal(H.phase(trap,rest-.01).state,'idle');assert.equal(H.phase(trap,rest).state,'warning');
    assert.equal(H.phase(trap,rest+1.79).state,'warning');assert.equal(H.phase(trap,rest+1.81).state,'active');
    assert.deepEqual(H.phase(trap,10),H.phase(trap,10));
  }
});
test('主線、逸聞翻頁和返回上一頁不重讀標題；新開故事與日誌全文仍可讀',()=>{
  const r=require('../story/tower-narrative.js').collectClue(runAt(65)).run;
  const h=runtime(r);h.start();const p=h.get('towerDialog'),N=h.context.TowerNarrative,entry=N.availableScenes(h.api.state().run).find(s=>s.floor===65);
  assert.ok(entry);h.api.readStory(entry.id);assert.ok(p.voiceText.startsWith(entry.title));
  h.click('story-next');assert.equal(p.voiceText,entry.paragraphs[1]);assert.equal(V.panelText(p),entry.paragraphs[1]);
  h.click('story-prev');assert.equal(p.voiceText,entry.paragraphs[0]);assert.ok(p.innerHTML.includes(entry.title));
  h.api.journal();assert.equal(p.voiceText,undefined);assert.equal(p.voiceScope,'full');
  h.api.readStory(entry.id);assert.ok(p.voiceText.startsWith(entry.title));
  const side=runtime(active(fixture('supper')));side.start();side.api.readSideStory('supper',0,'intro');
  side.click('side-next');assert.equal(side.get('towerDialog').voiceText,S.get('supper').intro[1]);
  side.click('side-prev');assert.equal(side.get('towerDialog').voiceText,S.get('supper').intro[0]);
});
test('真實場景機關接入：防具耗損、暫停與變形安全期、同波不連傷、藤蔓離開恢復',()=>{
  const h=runtime(runAt(35));h.start();const state=h.api.state(),spike=state.hazards.find(t=>t.kind==='spikes');assert.ok(spike);
  const traps=state.hazards;assert.ok(traps.length>0);assert.ok(h.context.TowerMode.reservedCells().includes(spike.cx+','+spike.cy));
  const elapsed=6-(spike.tier-1)*.4+1.9-spike.offset+20*(6-(spike.tier-1)*.4+1.8+1.2);
  h.api.setClock(elapsed);h.context.G.px=spike.x;h.context.G.pz=spike.z;
  const gear=C.createGear('armor',35,1,'hazard-test');h.api.state().run.equipment.armor=gear;
  const hp=h.api.state().run.hp,dur=gear.durability;h.api.tickHazards(.01);
  assert.ok(h.api.state().run.hp<hp);assert.equal(h.api.state().run.equipment.armor?.durability,dur-1);
  const after=h.api.state().run.hp;h.api.setClock(elapsed);h.api.tickHazards(.01);assert.equal(h.api.state().run.hp,after);
  h.api.journal();const frozen=JSON.stringify(h.api.state().run);h.tick(10);assert.equal(JSON.stringify(h.api.state().run),frozen);h.click('close');
  h.api.setShiftDue();h.context.TowerMode.updateShift();h.tick(.1);h.context.G.shifting=false;h.tick(.1);assert.ok(h.api.state().hazardGrace>0);
  const vine=traps.find(t=>t.kind==='vines');assert.ok(vine);const cycle=6-(vine.tier-1)*.4+1.8+2.5;
  h.api.setClock(6-(vine.tier-1)*.4+1.9-vine.offset+20*cycle);h.context.G.px=vine.x;h.context.G.pz=vine.z;h.api.tickHazards(.01);assert.equal(h.context.TowerMode.movementScale(),.55);
  h.context.G.px=h.context.G.pz=0;h.api.tickHazards(.01);assert.equal(h.context.TowerMode.movementScale(),1);
});
test('舊副本不突然新增陷阱，v3 副本有機關且重載配置相同',()=>{
  for(const version of [2,3]){
    const r=active(fixture('archive',35,version)),h=runtime(r);h.start();const traps=h.api.state().hazards;
    if(version===2)assert.equal(traps.length,0);else{
      assert.ok(traps.length>0&&traps.length<=D.offer(r).trapCount);
      const reloaded=runtime(r);reloaded.start();assert.equal(JSON.stringify(traps.map(t=>[t.cx,t.cy,t.kind])),JSON.stringify(reloaded.api.state().hazards.map(t=>[t.cx,t.cy,t.kind])));
    }
  }
});
