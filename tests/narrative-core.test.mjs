import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),N=require('../story/tower-narrative.js');
const source=readFileSync(new URL('../story/tower-narrative.js',import.meta.url),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function runAt(floor=99){return {floor,revision:0,name:'測試旅人',coins:24,bag:{ration:2},chronicle:N.newChronicle(floor)};}
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}

test('十章涵蓋99至1層，各有章首、章中、章末三幕且印記獨一',()=>{
  assert.equal(N.CHAPTERS.length,10);assert.equal(N.SCENES.length,30);assert.equal(N.ENDINGS.length,3);
  assert.equal(new Set(N.SCENES.map(s=>s.id)).size,30);assert.equal(new Set(N.CHAPTERS.map(c=>c.clueId)).size,10);
  for(let i=0;i<10;i++){
    const c=N.CHAPTERS[i],high=99-i*10,mid=95-i*10,low=i===9?1:90-i*10;
    assert.equal(c.high,high);assert.equal(c.mid,mid);assert.equal(c.low,low);assert.equal(c.clueText.length,3);
    assert.deepEqual(N.SCENES.filter(s=>s.chapter===c.id).map(s=>s.floor),[high,mid,low]);
  }
  for(let floor=1;floor<=99;floor++){const c=N.chapterForFloor(floor);assert.ok(floor<=c.high&&floor>=c.low);}
});

test('三十幕皆有三段完整繁中小說段落及180至280個漢字',()=>{
  for(const s of N.SCENES){
    assert.equal(s.paragraphs.length,3,s.id);const joined=s.paragraphs.join('');
    const count=(joined.match(/\p{Script=Han}/gu)||[]).length;
    assert.ok(count>=180&&count<=280,`${s.id}: ${count}漢字`);assert.match(joined,/[「」]/,s.id);
    assert.ok(s.paragraphs.every(p=>(p.match(/\p{Script=Han}/gu)||[]).length>=45),s.id);
    assert.doesNotMatch(joined,/TODO|待補|佔位|placeholder|[给终见紧装决]/,s.id);
  }
  for(const ending of N.ENDINGS){assert.equal(ending.paragraphs.length,3);assert.ok(ending.description);assert.ok(ending.paragraphs.every(p=>p.length>60));}
});

test('五位探索者反覆出現；早期核心伏筆有中後段回收',()=>{
  const all=N.SCENES.map(s=>s.paragraphs.join('')).join('\n');
  for(const name of ['伊芙','洛恩','米菈','奧倫','星奈'])assert.ok(all.split(name).length>4,name);
  const scene=floor=>N.scenesForFloor(floor)[0].paragraphs.join('');
  assert.match(scene(99),/三短一長/);assert.match(scene(35),/三短一長|完成訊號/);
  assert.match(scene(95),/有人在嗎/);assert.match(scene(29),/呼喚|回答/);
  assert.match(scene(75),/被遺忘交換/);assert.match(scene(40),/不必|沒有|保留/);
  assert.match(scene(55),/允許反悔/);assert.match(scene(1),/是否願意/);
});

test('場景查詢只解鎖已抵達樓層，回傳順序維持向下冒險',()=>{
  assert.equal(N.scenesForFloor(98).length,0);assert.equal(N.scenesForFloor(95)[0].id,'scene:95');
  assert.deepEqual(N.unlockedScenes(95).map(s=>s.floor),[99,95]);
  assert.equal(N.unlockedScenes(1).length,30);
  for(const floor of [0,100,1.5,'99',null]){assert.throws(()=>N.chapterForFloor(floor),RangeError);assert.throws(()=>N.unlockedScenes(floor),RangeError);}
});

test('可讀故事遵守印記取得時序，當章中幕與末幕不可提前劇透',()=>{
  for(const chapter of N.CHAPTERS){
    const mid=runAt(chapter.mid),low=runAt(chapter.low);
    assert.ok(!N.availableScenes(mid).some(s=>s.floor===chapter.mid));
    assert.equal(N.readScene(mid,'scene:'+chapter.mid).ok,false);
    assert.equal(N.readScene(low,'scene:'+chapter.low).ok,false);
    const collected=N.collectClue(mid).run;
    assert.ok(N.availableScenes(collected).some(s=>s.floor===chapter.mid));
    assert.ok(!N.availableScenes(collected).some(s=>s.floor===chapter.low));
    assert.equal(N.readScene(collected,'scene:'+chapter.mid).ok,true);
    const bottom={...collected,floor:chapter.low};
    assert.ok(N.availableScenes(bottom).some(s=>s.floor===chapter.low));
    assert.equal(N.readScene(bottom,'scene:'+chapter.low).ok,true);
    if(chapter.low>1){
      const passed=runAt(chapter.low-1);passed.chronicle.clues=[];
      assert.ok(N.availableScenes(passed).some(s=>s.floor===chapter.low));
      assert.equal(N.readScene(passed,'scene:'+chapter.low).ok,true);
    }
  }
  assert.deepEqual(N.availableScenes(null),[]);assert.deepEqual(N.availableScenes({floor:100}),[]);
  assert.match(N.scenesForFloor(99)[0].paragraphs.join(''),/半枚銅扣碎片/);
  assert.match(N.scenesForFloor(95)[0].paragraphs.join(''),/拼合成完整的回聲銅扣/);
});

test('舊存檔補已通過章節印記，但不免費給當章印記或假造閱讀紀錄',()=>{
  assert.deepEqual(N.newChronicle(99),{version:1,read:[],clues:[],ending:null});
  assert.deepEqual(N.newChronicle(89).clues,['clue:summoning']);
  assert.deepEqual(N.newChronicle(90).clues,[]);
  const final=N.newChronicle(1);assert.equal(final.clues.length,9);assert.ok(!final.clues.includes('clue:heart'));assert.deepEqual(final.read,[]);
  assert.deepEqual(N.validateChronicle(undefined,45),N.newChronicle(45));
});

test('驗證拒絕未知ID、重複值、未解鎖閱讀/印記以及錯誤結局',()=>{
  const valid=N.newChronicle(99);
  for(const field of ['read','clues']){const value=copy(valid);value[field]=['fake'];assert.equal(N.validateChronicle(value,99),null);}
  assert.equal(N.validateChronicle({...valid,read:['scene:95']},99),null);
  assert.equal(N.validateChronicle({...valid,clues:['clue:summoning']},99),null);
  assert.equal(N.validateChronicle({...valid,read:['scene:99','scene:99']},99),null);
  assert.equal(N.validateChronicle({...valid,ending:'release'},99),null);
  assert.equal(N.validateChronicle({...N.newChronicle(1),ending:'release'},1),null);
  assert.equal(N.validateChronicle({...N.newChronicle(1),clues:['clue:heart'],ending:'fake'},1),null);
  assert.equal(N.validateChronicle(null,99),null);assert.equal(N.validateChronicle({...valid,version:2},99),null);
  assert.equal(N.validateChronicle(valid,0),null);
});

test('驗證深複製故事陣列，讀幕不改原run、不改無關玩法欄位',()=>{
  const run=deepFreeze(runAt(95)),before=JSON.stringify(run),result=N.readScene(run,'scene:99');
  assert.equal(result.ok,true);assert.equal(result.run.revision,1);assert.deepEqual(result.run.chronicle.read,['scene:99']);
  assert.equal(JSON.stringify(run),before);assert.equal(result.run.bag,run.bag);assert.equal(result.run.coins,24);
  const checked=N.validateChronicle(result.run.chronicle,95);checked.read.push('scene:95');checked.clues.push('clue:summoning');
  assert.deepEqual(result.run.chronicle.read,['scene:99']);assert.deepEqual(result.run.chronicle.clues,[]);
  assert.equal(N.readScene(result.run,'scene:99').ok,false);assert.equal(N.readScene(run,'scene:90').ok,false);
});

for(const chapter of N.CHAPTERS)test(`${chapter.title}：章中才可取印記，章末缺印記不能下降`,()=>{
  const before=runAt(chapter.mid+1);assert.equal(N.collectClue(before).ok,false);assert.equal(N.canDescend(before),true);
  const mid=deepFreeze(runAt(chapter.mid)),taken=N.collectClue(mid);assert.equal(taken.ok,true);assert.ok(taken.run.chronicle.clues.includes(chapter.clueId));assert.equal(taken.run.revision,1);
  assert.equal(N.collectClue(taken.run).ok,false);assert.ok(!mid.chronicle.clues.includes(chapter.clueId));
  const last=runAt(chapter.low);assert.equal(N.canDescend(last),false);assert.match(N.objective(last),new RegExp(chapter.clueName));
  last.chronicle=copy(taken.run.chronicle);assert.equal(N.canDescend(last),true);
});

test('完整99層旅程必經十個實體印記門檻，閱讀本身不會發印記',()=>{
  let run=runAt();
  for(let floor=99;floor>=1;floor--){
    run={...run,floor};
    const chapter=N.chapterForFloor(floor);if(floor===chapter.mid)run=N.collectClue(run).run;
    for(const scene of N.scenesForFloor(floor)){const before=[...run.chronicle.clues];const read=N.readScene(run,scene.id);assert.equal(read.ok,true);run=read.run;assert.deepEqual(run.chronicle.clues,before);}
    assert.equal(N.canDescend(run),true,`floor ${floor}`);assert.ok(N.validateChronicle(run.chronicle,floor));
  }
  assert.equal(run.chronicle.read.length,30);assert.equal(run.chronicle.clues.length,10);
});

test('三種結局只在第一層取得塔心印記後可選，選定不可重複切換',()=>{
  for(const ending of N.ENDINGS){
    assert.equal(N.chooseEnding(runAt(5),ending.id).ok,false);assert.equal(N.chooseEnding(runAt(1),ending.id).ok,false);
    const run=deepFreeze(N.collectClue(runAt(1)).run),result=N.chooseEnding(run,ending.id);
    assert.equal(result.ok,true);assert.equal(result.run.chronicle.ending,ending.id);assert.equal(run.chronicle.ending,null);assert.ok(N.validateChronicle(result.run.chronicle,1));
    assert.equal(N.chooseEnding(result.run,ending.id).ok,false);assert.equal(N.chooseEnding(run,'fake').ok,false);assert.match(N.objective(result.run),/歸途已開啟/);
  }
});

test('UMD在無模組與無引擎的瀏覽器環境亦可載入，故事內容不可被改寫',()=>{
  const context=vm.createContext({});vm.runInContext(source,context);
  assert.equal(context.TowerNarrative.CHAPTERS.length,10);assert.equal(context.TowerNarrative.canDescend({floor:99}),true);
  assert.ok(Object.isFrozen(N.SCENES));assert.ok(Object.isFrozen(N.SCENES[0].paragraphs));
  assert.throws(()=>{N.SCENES[0].paragraphs[0]='altered';},TypeError);
  assert.equal(N.readScene({...runAt(),revision:Number.MAX_SAFE_INTEGER},'scene:99').ok,false);
});
