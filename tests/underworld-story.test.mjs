import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),U=require('../story/tower-underworld.js'),N=require('../story/tower-narrative.js'),X=require('../story/tower-expedition-core.js'),B=require('../story/tower-floor-lords.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js');
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function narrativeRun(floor=-1,ending='bridge'){
  const chronicle=N.newChronicle(floor);chronicle.ending=ending;chronicle.read=N.SCENES.map(s=>s.id);
  return {floor,revision:0,status:'playing',party:{},chronicle,underworld:{version:1,departed:null,surfaceEnding:ending}};
}
function playable(floor,seed=31){
  const r=H.enable(P.enable(C.newRun({seed}),'swordsman').run).run;r.floor=floor;r.floorsCleared=99+(-floor-1);r.chronicle=narrativeRun(floor).chronicle;r.underworld={version:1,departed:null,surfaceEnding:'bridge'};P.advance(r,{reward:false});return r;
}
test('all fifty underground floors are deterministic, correctly sized and independent of surface pacing',()=>{
  const lows=new Set(),highs=new Set();
  for(let depth=1;depth<=50;depth++){
    const floor=-depth,config=U.floorConfig(floor,31),chapter=U.chapterForFloor(floor);
    assert.equal(config.size,depth<=40?19:21);assert.equal(config.chapter,10+Math.ceil(depth/10));assert.equal(config.environmentId,chapter.environmentId);
    assert.equal(config.shiftSeconds,Math.max(30,51-(depth-1)*.5));assert.equal(config.monsterStrengthBonus,4);
    assert.deepEqual(config.monsterTypes,['clockmite','sentinel','wisp','hound','shardseer']);
    assert.equal(config.monsterMin,depth<=40?8:9,'v1.60: one more at the low end');assert.equal(config.monsterMax,12,'the high end is capped at 12 because monster-12 is the lord slot');
    assert.ok(config.monsterCount>=config.monsterMin&&config.monsterCount<=config.monsterMax);assert.equal(config.count,config.monsterCount);
    assert.deepEqual(U.floorConfig(floor,31),config);assert.deepEqual(C.floorConfig(floor,31),config);
    assert.equal(config.merchant,floor===chapter.high||depth%5===0);assert.equal(config.rewardCoins,15+Math.floor((depth-1)/10)*2);
    for(let seed=1;seed<=30;seed++)(depth<=40?lows:highs).add(U.floorConfig(floor,seed).monsterCount);
  }
  assert.deepEqual([...lows].sort((a,b)=>a-b),[8,9,10,11,12]);assert.deepEqual([...highs].sort((a,b)=>a-b),[9,10,11,12]);
  for(const floor of [99,90,35,1])assert.equal(C.floorConfig(floor).shiftSeconds,150-(99-floor));
  for(const floor of [0,1,-51,-1.5,'-1',NaN])assert.throws(()=>U.floorConfig(floor),RangeError);
  for(const seed of [0,-1,1.5,0x100000000])assert.throws(()=>U.floorConfig(-1,seed),RangeError);
});
test('five original underground chapters add fifteen bounded scenes while keeping the original catalogues intact',()=>{
  assert.equal(N.CHAPTERS.length,10);assert.equal(N.SCENES.length,30);assert.equal(N.ENDINGS.length,3);assert.equal(N.allChapters().length,15);assert.equal(N.totalSceneCount(),45);
  assert.equal(new Set(N.allScenes().map(s=>s.id)).size,45);assert.equal(new Set(N.allChapters().map(c=>c.clueId)).size,15);
  for(let index=0;index<U.CHAPTERS.length;index++){
    const chapter=U.CHAPTERS[index];assert.deepEqual([chapter.high,chapter.mid,chapter.low],[-1-index*10,-5-index*10,-10-index*10]);
    const scenes=U.SCENES.filter(s=>s.chapter===chapter.id);assert.deepEqual(scenes.map(s=>s.floor),[chapter.high,chapter.mid,chapter.low]);assert.ok(chapter.clueId.startsWith('underworld:'));
    for(const scene of scenes){assert.ok(scene.id.startsWith('underworld:'));assert.ok(scene.paragraphs.length>=2&&scene.paragraphs.length<=3);assert.ok(scene.paragraphs.every(p=>p.length>=45&&p.length<=145));assert.match(scene.paragraphs.join(''),/[「」]/);}
  }
  const prose=JSON.stringify({chapters:U.CHAPTERS,scenes:U.SCENES,ending:U.ENDING});
  assert.doesNotMatch(prose,/[满却没门见旧张两寻护终说为来发让们挡]/);
  assert.doesNotMatch(prose,/預填答案|核驗表格|維修網|回執/);
  assert.match(U.SCENES[0].paragraphs.join(''),/一樓.*樓層主被打敗後.*石壁/);assert.match(U.SCENES[0].paragraphs.join(''),/幾天後/);
  assert.match(U.SCENES.find(s=>s.floor===-5).paragraphs.join(''),/沒有高塔/);assert.match(U.SCENES.find(s=>s.floor===-25).paragraphs.join(''),/後|半頁/);
  assert.match(U.SCENES.find(s=>s.floor===-35).paragraphs.join(''),/地熱/);assert.match(U.ENDING.paragraphs.join(''),/璃安|主塔.*先前|結束/);
  assert.ok(Object.isFrozen(U.CHAPTERS[0].clueText));assert.ok(Object.isFrozen(N.allScenes()));
});
test('surface endings and readings survive fifty floors; each underground clue gates its own scenes and finale',()=>{
  for(const ending of N.ENDINGS){
    let run=narrativeRun(-1,ending.id),surface=structuredClone(run.chronicle);
    for(let floor=-1;floor>=-50;floor--){
      run={...run,floor};const chapter=N.chapterForFloor(floor),before=JSON.stringify(run),frozen=freeze(structuredClone(run));
      assert.ok(N.validateChronicle(frozen.chronicle,floor));assert.ok(N.brief(frozen));assert.doesNotMatch(N.objective(frozen),/^歸途已開啟/);
      if(floor>chapter.mid)assert.equal(N.collectClue(frozen).ok,false);
      if(floor===chapter.mid){
        const scene=N.scenesForFloor(floor)[0];assert.equal(N.readScene(frozen,scene.id).ok,false);assert.equal(N.availableScenes(frozen).some(s=>s.id===scene.id),false);
        const next=N.collectClue(frozen);assert.ok(next.ok);run=next.run;assert.equal(N.collectClue(run).ok,false);
      }
      for(const scene of N.scenesForFloor(floor)){const clues=[...run.chronicle.clues],result=N.readScene(run,scene.id);assert.ok(result.ok,result.message);run=result.run;assert.deepEqual(run.chronicle.clues,clues);assert.equal(N.readScene(run,scene.id).ok,false);}
      assert.equal(JSON.stringify(frozen),before);assert.equal(N.canDescend(run),true);
      if(floor===chapter.low){const missing=structuredClone(run);missing.chronicle.clues=missing.chronicle.clues.filter(id=>id!==chapter.clueId);assert.equal(N.canDescend(missing),false);}
      assert.equal(run.chronicle.ending,ending.id);assert.ok(surface.read.every(id=>run.chronicle.read.includes(id)));assert.ok(surface.clues.every(id=>run.chronicle.clues.includes(id)));
    }
    assert.equal(run.chronicle.clues.length,15);assert.equal(run.chronicle.read.length,45);
    assert.match(N.objective(run),/機關.*樓層主/);run.status='won';assert.equal(N.brief(run).recap,U.ENDING.description);assert.equal(N.objective(run),U.ENDING.description);
    assert.equal(N.chooseEnding(run,'release').ok,false,'Underground completion never overwrites the surface ending');
  }
});
test('underground chronicle validation rejects future, duplicate and forged IDs without changing saved evidence',()=>{
  const run=narrativeRun(-1),before=JSON.stringify(run);
  for(const mutate of [c=>c.read.push('underworld:scene:15'),c=>c.clues.push('underworld:clue:mist'),c=>c.clues.push('underworld:clue:missing'),c=>c.read.push('scene:99'),c=>c.ending='underworld:ending:return']){
    const bad=structuredClone(run.chronicle);mutate(bad);assert.equal(N.validateChronicle(bad,-1),null);
  }
  assert.equal(N.readScene(run,'underworld:scene:50').ok,false);assert.equal(JSON.stringify(run),before);
  const surface=N.newChronicle(1);surface.clues.push('underworld:clue:roots');assert.equal(N.validateChronicle(surface,1),null);
  assert.equal(N.validateChronicle(run.chronicle,-51),null);assert.equal(N.canDescend({floor:0}),false);
});
test('all five underground mechanisms are solvable, validate on reload and only pay their reward once',()=>{
  for(const floor of [-10,-20,-30,-40,-50])for(const seed of [1,17,31]){
    let run=playable(floor,seed);const def=X.BOSSES[floor],before=run.coins;
    assert.equal(def.environmentId,U.floorConfig(floor).environmentId);assert.ok(C.validateSave(run));
    assert.ok(X.validateBoss(run.party.boss,floor));assert.ok(X.validateJourney(run.party.journey,floor));
    run=X.bossAction(run,0).run;
    for(let round=0;round<8&&!run.party.boss.done;round++){
      run.party.boss.clock=round*def.cycle+def.warning+def.strike+.1;
      for(let tries=0;tries<4;tries++)for(let i=0;i<def.count;i++){const result=X.bossAction(run,i);if(result.ok)run=result.run;}
    }
    assert.equal(run.party.boss.done,true,floor+' / '+seed);assert.equal(run.coins,before+35);
    assert.equal(X.bossAction(run,0).ok,false);assert.ok(C.validateSave(run));
    const wrong=structuredClone(run.party.boss);wrong.floor=floor-1;assert.equal(X.validateBoss(wrong,floor),undefined);
  }
});
test('underground lords never collide with twelve ordinary monsters or accidentally reference surface recordings',()=>{
  assert.equal(Object.keys(B.LORDS).length,10);assert.equal(Object.keys(B.UNDERWORLD_LORDS).length,5);assert.equal(Object.keys(B.tracks).length,30);
  const names=new Set();for(const [floor,def]of Object.entries(B.UNDERWORLD_LORDS)){
    const run=playable(Number(floor)),spec=B.spec(run);assert.equal(spec.id,'monster-12');assert.equal(spec.maxHp,def.maxHp);assert.equal(spec.maxHp,Math.round((450+Math.abs(floor)*15)*1.3));
    assert.equal(def.recordedVoice,false);assert.ok(def.id.startsWith('lord-underworld-'));assert.equal(def.lines.length,3);names.add(def.name);
    const monsters=P.monsterSpecs(run);assert.equal(new Set(monsters.map(m=>m.id)).size,monsters.length);assert.equal(monsters.filter(m=>m.lord).length,1);
    assert.equal(B.defeated(run),false);run.defeatedMonsters.push(B.ID);assert.equal(B.defeated(run),false);run.defeatedMonsters.push(B.UNDERWORLD_ID);assert.equal(B.defeated(run),true);
    run.expedition.active={};assert.equal(B.forRun(run),null);assert.equal(B.spec(run),null);
  }
  assert.equal(names.size,5);assert.equal(B.spec(playable(-11)),null);
});
test('underground data loads without core dependencies and narrative supports deferred browser loading',()=>{
  const us=readFileSync(new URL('../story/tower-underworld.js',import.meta.url),'utf8'),ns=readFileSync(new URL('../story/tower-narrative.js',import.meta.url),'utf8'),context=vm.createContext({});
  assert.doesNotMatch(us,/require\(|TowerCore|\b(?:fetch|setTimeout|setInterval)\s*\(/);
  vm.runInContext(ns,context);assert.equal(context.TowerNarrative.totalSceneCount(),30);
  vm.runInContext(us,context);assert.equal(context.TowerNarrative.totalSceneCount(),45);assert.equal(context.TowerNarrative.chapterForFloor(-50).id,'underworld:heart');
  assert.equal(context.TowerUnderworld.floorConfig(-1).size,19);assert.equal(context.TowerUnderworld.floorConfig(-50).size,21);
});
