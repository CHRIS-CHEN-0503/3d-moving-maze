import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const S=require('../story/tower-side-stories.js'),N=require('../story/tower-narrative.js'),E=require('../story/tower-encounters.js');
const source=readFileSync(new URL('../story/tower-side-stories.js',import.meta.url),'utf8');
const expected={threads:['ordered',89,'eve'],mirrors:['choice',69,'mira'],clockwork:['repair',79,'rowan'],tribunal:['evidence',59,'oren'],stars:['shift',69,'sena'],supper:['choice',95,null]};
const entry=(kind,floor,outcome='completed')=>({id:`rift:${floor}:1`,kind,floor,outcome});
const runAt=(floor=1,history=[],ending=null)=>({floor,coins:40,bag:{ration:2},chronicle:{...N.newChronicle(floor),ending},expedition:{version:2,history,active:null}});
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};

test('六種新副本具有獨立機制、出現門檻、色盤，沿用五個探索者身份',()=>{
  assert.deepEqual(Object.keys(S.STORIES),Object.keys(expected));
  for(const [kind,[mechanic,maxFloor,explorerId]] of Object.entries(expected)){
    const story=S.get(kind);assert.equal(story.kind,kind);assert.equal(story.mechanic,mechanic);assert.equal(story.maxFloor,maxFloor);assert.equal(story.explorerId,explorerId);
    if(explorerId)assert.ok(E.EXPLORERS[explorerId]);
    assert.ok([7,9].includes(story.size));assert.ok(story.timeLimit>=90&&story.timeLimit<=180);assert.ok(story.shiftSeconds>=20&&story.shiftSeconds<=35);
    assert.equal(story.palette.length,5);assert.ok(story.palette.slice(0,4).every(color=>Number.isInteger(color)&&color>=0&&color<=0xffffff));
    assert.ok(['spire','garden','tree','crystal','books','water','ice','gear','fire','heart'].includes(story.palette[4]));
    assert.ok(N.CHAPTERS.some(chapter=>chapter.id===story.environmentId));
  }
  assert.equal(new Set(Object.values(S.STORIES).map(s=>JSON.stringify(s.palette))).size,6);
  assert.equal(S.get('threads').orderMode,'seeded');assert.equal(S.get('stars').orderMode,'seeded-tail');assert.ok(S.get('stars').timeLimit>=140);
});

for(const kind of Object.keys(expected))test(`${kind} 有完整三段開場、三段收束與永久逸聞，沒有佔位內容`,()=>{
  const story=S.get(kind);assert.ok(story.description.length>=25);assert.ok(story.objective.length>=20);
  for(const [label,paragraphs,min] of [['intro',story.intro,190],['outro',story.outro,180],['record',story.record.paragraphs,140]]){
    assert.equal(paragraphs.length,3,label);assert.ok(paragraphs.every(text=>typeof text==='string'&&text.length>=35),label);assert.ok(paragraphs.join('').length>=min,label);
    assert.doesNotMatch(paragraphs.join(''),/TODO|待補|placeholder|[红选来张话们给终见紧装决]/,label);
  }
  assert.equal(story.record.id,`lore:${kind}`);assert.ok(story.record.title.length>=5);assert.equal(S.recollection(kind),story.record);
  assert.equal(story.steps.length,3);assert.deepEqual(story.steps.map(step=>step.index),[0,1,2]);
  for(let index=0;index<3;index++){
    const step=S.step(kind,index);assert.equal(step,story.steps[index]);
    for(const field of ['title','prompt','actionLabel','success','failure'])assert.ok(typeof step[field]==='string'&&step[field].length>=3,`${kind}.${index}.${field}`);
    if(step.options){assert.equal(step.options.length,3);assert.equal(new Set(step.options).size,3);assert.ok(Number.isInteger(step.correctChoice)&&step.correctChoice>=0&&step.correctChoice<=2);}
    else assert.equal(step.correctChoice,undefined);
  }
});

test('謎題答案分布不固定同一按鈕，證物修理與變形均有明確先後提示',()=>{
  for(const kind of ['mirrors','supper']){
    assert.deepEqual(S.get(kind).steps.map(step=>step.correctChoice).sort(),[0,1,2]);
    assert.ok(S.get(kind).steps.every(step=>step.options.length===3));
  }
  assert.ok(!S.step('tribunal',0).options&&!S.step('tribunal',1).options);assert.equal(S.step('tribunal',2).options.length,3);
  assert.match(S.step('tribunal',2).prompt,/先讀完兩份證據/);assert.match(S.step('clockwork',2).prompt,/必須先收集緩衝輪與回程簧片/);
  assert.match(S.step('stars',0).prompt,/先前的變形或單純等待都不算/);
  assert.match(S.get('supper').intro.join(''),/不會拿走你的口糧/);assert.match(S.get('supper').intro.join(''),/輕微傷害，防具可減傷/);assert.equal(S.get('supper').links,null);
});

test('符合樓層才進入隨機池，非法輸入查詢回空且不取繼承屬性',()=>{
  assert.deepEqual(S.eligible(99),[]);assert.deepEqual(S.eligible(96),[]);assert.deepEqual(S.eligible(95).map(s=>s.kind),['supper']);
  assert.deepEqual(S.eligible(89).map(s=>s.kind),['threads','supper']);assert.equal(S.eligible(59).length,6);assert.equal(S.eligible(1).length,6);
  for(const floor of [0,100,1.2,'59',null,NaN,Infinity])assert.deepEqual(S.eligible(floor),[]);
  for(const kind of ['__proto__','constructor','toString','unknown',null,{}]){assert.equal(S.get(kind),null);assert.equal(S.recollection(kind),null);assert.equal(S.step(kind,0),null);}
  for(const index of [-1,3,1.2,'0',null,NaN])assert.equal(S.step('supper',index),null);
});

test('永久逸聞只從已完成紀錄取出，放棄、逾時、進行中與無效歷史都不解鎖',()=>{
  const history=[entry('threads',89),entry('threads',88),entry('mirrors',69,'abandoned'),entry('stars',68,'expired'),entry('tribunal',59),entry('supper',95)];
  const run=runAt(50,history);run.expedition.active={kind:'clockwork',progress:[0,1,2]};
  assert.deepEqual(S.collectedStories(run).map(s=>s.kind),['threads','tribunal','supper']);
  for(const invalid of [entry('mirrors',70),entry('tribunal',49),entry('stars',68.5),entry('archive',90),null])assert.deepEqual(S.collectedStories(runAt(50,[invalid])),[]);
  for(const invalid of [null,{},{...runAt(1,history),floor:0},{floor:50,expedition:{history:null}}])assert.deepEqual(S.collectedStories(invalid),[]);
});

test('五個故事各在指定主線章末呼應；尚未走到、其他章節、不完成都不提前出現',()=>{
  const mapping={threads:70,mirrors:40,clockwork:20,tribunal:50,stars:30};
  for(const [kind,floor] of Object.entries(mapping)){
    const story=S.get(kind),id=`scene:${floor}`,run=runAt(floor,[entry(kind,story.maxFloor)]);
    assert.equal(story.links.sceneId,id);assert.ok(N.SCENES.some(scene=>scene.id===id));
    const echo=S.echoesForScene(run,id);assert.equal(echo.length,1);assert.equal(echo[0].kind,kind);assert.equal(echo[0].title,story.record.title);assert.ok(echo[0].text.length>=60);
    assert.deepEqual(S.echoesForScene({...run,floor:floor+1},id),[]);assert.deepEqual(S.echoesForScene(run,`scene:${floor-1}`),[]);
    for(const outcome of ['abandoned','expired'])assert.deepEqual(S.echoesForScene(runAt(floor,[entry(kind,story.maxFloor,outcome)]),id),[]);
  }
  for(const invalid of [null,'scene:0','scene:01','scene:100','scene:70:extra','70'])assert.deepEqual(S.echoesForScene(runAt(),invalid),[]);
});

test('晚期完成仍收錄永久逸聞，但重讀更早章節不倒寫已發生的故事',()=>{
  for(const story of Object.values(S.STORIES).filter(s=>s.links)){
    const floor=Number(story.links.sceneId.slice(6));
    const late=runAt(1,[entry(story.kind,floor-1)]);
    assert.equal(S.collectedStories(late).length,1);assert.deepEqual(S.echoesForScene(late,story.links.sceneId),[]);
    assert.equal(S.echoesForScene(runAt(1,[entry(story.kind,floor)]),story.links.sceneId).length,1);
    const both=runAt(1,[entry(story.kind,floor-1),entry(story.kind,floor+1)]);assert.equal(S.echoesForScene(both,story.links.sceneId).length,1);
  }
});

test('已選結局依五段已完成逸聞增補回應；尚未選或選其他結局不劇透',()=>{
  const history=Object.values(S.STORIES).map(story=>entry(story.kind,story.maxFloor));
  for(const ending of ['release','keeper','bridge']){
    const run=runAt(1,history,ending),echoes=S.endingEchoes(run,ending);assert.equal(echoes.length,5);assert.ok(echoes.every(e=>e.kind!=='supper'&&e.text.length>=45));
    assert.equal(new Set(echoes.map(e=>e.kind)).size,5);assert.deepEqual(S.endingEchoes({...run,floor:5},ending),[]);
    assert.deepEqual(S.endingEchoes(runAt(1,history),ending),[]);assert.deepEqual(S.endingEchoes(run,'unknown'),[]);
    assert.deepEqual(S.endingEchoes(runAt(1,[entry('threads',89,'abandoned')],ending),ending),[]);
  }
  assert.deepEqual(S.endingEchoes(null,'release'),[]);
});

test('查詢故事不改主線印記、背包、銅幣或旅程歷史',()=>{
  const run=deepFreeze(runAt(1,[entry('threads',89),entry('tribunal',55),entry('supper',90)],'bridge'));
  const before=JSON.stringify(run);
  S.collectedStories(run);S.echoesForScene(run,'scene:70');S.endingEchoes(run,'bridge');S.recollection('supper');
  assert.equal(JSON.stringify(run),before);assert.ok(!run.chronicle.clues.includes('clue:heart'));
  const stories=S.collectedStories(run);stories.length=0;assert.equal(S.collectedStories(run).length,3);
  const echoes=S.endingEchoes(run,'bridge');echoes[0].text='modified';assert.notEqual(S.endingEchoes(run,'bridge')[0].text,'modified');
});

test('敘事模組可獨立於引擎、網路及時鐘載入，所有內容定義深凍結',()=>{
  const context=vm.createContext({});vm.runInContext(source,context);
  assert.equal(Object.keys(context.TowerSideStories.STORIES).length,6);assert.equal(context.TowerSideStories.eligible(95)[0].kind,'supper');
  for(const story of Object.values(S.STORIES)){
    assert.ok(Object.isFrozen(story)&&Object.isFrozen(story.steps)&&Object.isFrozen(story.intro)&&Object.isFrozen(story.record.paragraphs));
    assert.throws(()=>{story.intro[0]='改寫';},TypeError);
  }
  assert.ok(Object.isFrozen(S.STORIES));assert.doesNotMatch(source,/fetch\(|setInterval\(|requestAnimationFrame\(|Math\.random\(|Date\.now\(/);
});
