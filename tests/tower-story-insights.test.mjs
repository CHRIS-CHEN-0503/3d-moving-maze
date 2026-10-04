import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),N=require('../story/tower-narrative.js'),I=require('../story/tower-story-insights.js'),P=require('../story/tower-party-core.js'),M=require('../story/tower-materials.js');
const copy=v=>structuredClone(v),frozen=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
const runAt=floor=>({floor,revision:0,seed:31415,chronicle:N.newChronicle(floor),expedition:{active:null,history:[]}});
function read(run,id){const out=N.readScene(run,id);assert.ok(out.ok,out.message);return out.run;}
function clue(run){const out=N.collectClue(run);assert.ok(out.ok,out.message);return out.run;}
const note=(run,id)=>I.threads(run).find(n=>n.id===id);
test('all 149 floors offer stable observations without writing, rereading or granting clues',()=>{
  for(const floor of [...Array.from({length:99},(_,i)=>99-i),...Array.from({length:50},(_,i)=>-i-1)]){
    const run=frozen(runAt(floor)),before=JSON.stringify(run),view=I.observation(run);
    assert.ok(view?.title,floor);assert.equal(view.stage,'observed');assert.equal(view.paragraphs.length,1);assert.deepEqual(view.sourceIds,[]);assert.equal(view.chapter,N.chapterForFloor(floor).id);
    assert.deepEqual(I.observation(run),view);assert.equal(JSON.stringify(run),before);
    assert.deepEqual(I.journal(run),{threads:[],characters:[]},'migrated clues never invent readings');
  }
});
test('copper clue only connects inspected evidence, never lower-floor or held-clue assumptions',()=>{
  let run=read(runAt(99),'scene:99');assert.equal(note(run,'copper').status,'待查');assert.doesNotMatch(note(run,'copper').text,/同意|省略|確認符號/);
  run={...run,floor:95};run=clue(run);assert.equal(note(run,'copper').status,'待查');run=read(run,'scene:95');assert.equal(note(run,'copper').status,'已連起');
  run={...run,floor:65};run.chronicle.clues=N.newChronicle(65).clues;run=clue(run);assert.equal(note(run,'copper').status,'已連起');run=read(run,'scene:65');assert.equal(note(run,'copper').status,'已回收');
  assert.match(note(run,'copper').text,/求助.*同意/);assert.deepEqual(note(run,'copper').sources.map(s=>s.id),['scene:99','scene:95','scene:65']);
  const missing=copy(run);missing.chronicle.read=missing.chronicle.read.filter(id=>id!=='scene:95');assert.equal(note(missing,'copper').status,'待查');
});
test('unread revelations remain unavailable even when an older journey reaches the final floor',()=>{
  let run=runAt(1);run.chronicle.clues.push('clue:heart');run.chronicle.read=['scene:99'];
  const view=I.journal(frozen(run)),body=JSON.stringify(view);
  assert.equal(view.threads.length,3);assert.equal(view.characters.length,1);assert.doesNotMatch(body,/奧倫|救援早已完成|地熱|璃安|拆下確認器/);
  assert.ok(view.threads.every(t=>t.status==='待查'));assert.equal(I.observation(run).stage,'observed');
});
test('full stories produce seven earned resolutions with accurate, already-read source links',()=>{
  let run=runAt(99);
  for(const floor of [...Array.from({length:99},(_,i)=>99-i),...Array.from({length:50},(_,i)=>-i-1)]){
    run={...run,floor};const chapter=N.chapterForFloor(floor);if(floor===chapter.mid)run=clue(run);
    for(const scene of N.scenesForFloor(floor))run=read(run,scene.id);
    const before=JSON.stringify(run),view=I.journal(frozen(copy(run)));
    for(const entry of [...view.threads,...view.characters])for(const source of entry.sources){assert.ok(run.chronicle.read.includes(source.id));assert.equal(source.title,N.allScenes().find(s=>s.id===source.id).title);}
    assert.equal(JSON.stringify(run),before);
  }
  assert.equal(I.threads(run).length,7);assert.ok(I.threads(run).every(t=>t.status==='已回收'));assert.equal(I.characters(run).length,6);
  assert.match(note(run,'clock').text,/救援早已完成/);assert.match(note(run,'memory').text,/地热|地熱/);assert.match(note(run,'lamp').text,/不是.*燃料/);assert.match(note(run,'last-traveler').text,/守燈人.*旅人/);
});
test('an observation requires its own read chapter stage as well as the mid-chapter clue',()=>{
  for(const chapter of N.allChapters()){
    let run=read(runAt(chapter.high),chapter.high<0?'underworld:scene:'+(-chapter.high):'scene:'+chapter.high);assert.equal(I.observation(run).stage,'opening');
    run={...run,floor:chapter.mid};run=clue(run);assert.equal(I.observation(run).stage,'opening');
    run=read(run,chapter.mid<0?'underworld:scene:'+(-chapter.mid):'scene:'+chapter.mid);assert.equal(I.observation(run).stage,'clue');
    run={...run,floor:chapter.low};assert.equal(I.observation(run).stage,'clue');run=read(run,chapter.low<0?'underworld:scene:'+(-chapter.low):'scene:'+chapter.low);assert.equal(I.observation(run).stage,'close');
    assert.ok(I.observation(run).sourceIds.every(id=>run.chronicle.read.includes(id)));
  }
});
test('side records enter character notes only after a completed valid surface story',()=>{
  const run=runAt(70);run.expedition.history=[{floor:79,kind:'clockwork',outcome:'expired'},{floor:80,kind:'threads',outcome:'abandoned'}];assert.deepEqual(I.characters(run),[]);
  run.expedition.history[0].outcome='completed';const notes=I.characters(run);assert.equal(notes.length,1);assert.equal(notes[0].id,'rowan');assert.equal(notes[0].echo.kind,'clockwork');assert.match(notes[0].echo.text,/第一扇|門鈴/);
  const invented=copy(run);invented.expedition.history[0].floor=-79;assert.deepEqual(I.characters(invented),[]);
});
test('the underground stranger has no invented name, and surface notes survive an ending unchanged',()=>{
  let run=runAt(-11);run.chronicle.read=['scene:99','underworld:scene:11'];run.chronicle.ending='keeper';const before=JSON.stringify(run);const notes=I.characters(run);
  assert.equal(notes.find(n=>n.id==='lian').name,'提燈的陌生人');assert.doesNotMatch(JSON.stringify(notes),/璃安/);assert.equal(notes.find(n=>n.id==='eve').name,'伊芙');assert.equal(JSON.stringify(run),before);
  run={...run,floor:-15};run=clue(run);run=read(run,'underworld:scene:15');assert.equal(I.characters(run).find(n=>n.id==='lian').name,'璃安');assert.equal(run.chronicle.ending,'keeper');
});
test('bestiary prioritizes real local ecology and conceals future guardian biographies',()=>{
  const defs=P.defs();for(const chapter of N.allChapters()){
    const run=frozen(runAt(chapter.high)),rows=I.bestiary(run,defs),local=rows.filter(row=>row.local),ecology=M.ecology(run);
    assert.deepEqual(new Set(local.map(r=>r.id)),new Set(Object.keys(ecology.variants)));assert.ok(local.every(r=>r.name===ecology.variants[r.id].name&&r.region===ecology.name));
    assert.ok(rows.slice(0,local.length).every(r=>r.local));assert.ok(rows.filter(r=>r.id.startsWith('lord-')).every(r=>!r.known&&r.lore===''&&r.name==='尚未遇見的樓層主'));
  }
  const boss=runAt(-40),row=I.bestiary(boss,defs).find(r=>r.id===defs['lord-underworld-furnace'].id);assert.ok(row.local&&row.known);assert.equal(row.storyKnown,false);assert.doesNotMatch(row.lore,/璃安|放手|燈火會熄滅/);
  boss.chronicle.clues.push('underworld:clue:furnace');const seen=read(boss,'underworld:scene:40'),known=I.bestiary(seen,defs).find(r=>r.id===row.id);assert.equal(known.storyKnown,true);assert.equal(known.lore,defs[row.id].personality);
});
test('projections fail closed for malformed readings and stay usable before deferred browser dependencies load',()=>{
  const run=runAt(99);run.chronicle.read=['scene:35'];assert.deepEqual(I.journal(run),{threads:[],characters:[]});assert.equal(I.observation(run),null);assert.deepEqual(I.bestiary(run),[]);
  for(const floor of [0,100,-51,'99'])assert.equal(I.observation({...run,floor}),null);
  const source=readFileSync(new URL('../story/tower-story-insights.js',import.meta.url),'utf8'),ctx=vm.createContext({});vm.runInContext(source,ctx);assert.equal(ctx.TowerStoryInsights.observation({floor:99}),null);
  assert.doesNotMatch(source,/\b(?:fetch|setTimeout|setInterval|localStorage|Math\.random)\b/);assert.doesNotMatch(source,/[这却说让为门页录与个会来归灯]/);
});
