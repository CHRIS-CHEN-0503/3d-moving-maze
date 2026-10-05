import test from 'node:test';
import assert from 'node:assert/strict';
import {heldChords,phrase,smoothExpression} from '../tools/orchestra-scores/legato-support.mjs';
import {legatoScores,continuity} from '../tools/render-legato-orchestral-previews.mjs';
import {scores,validate} from '../tools/render-scene-orchestral-previews.mjs';
import {byteRange} from '../tools/serve-orchestra-audition.mjs';

test('flowing auditions contain only summit and camp; the approved boss score is not changed',()=>{
  assert.deepEqual(legatoScores.map(s=>s.id),['summit','camp']);
  assert.equal(scores.find(s=>s.id==='boss').bpm,136);
  for(const score of legatoScores){validate(score);assert.equal(score.revision,'legato-audition');assert.match(score.filename,/連奏版/);assert.deepEqual(score.percussion,[]);}
});
for(const score of legatoScores){
  test(score.id+' retains a continuous string bed and has fewer attacks than its original score',()=>{
    const original=scores.find(s=>s.id===score.id),strings=['violins','violas','celli'];
    assert.ok(score.notes.length<original.notes.length*.75);
    for(const desk of strings){
      const notes=score.notes.filter(n=>n.desk===desk);
      if(desk!=='celli')assert.ok(notes.some(n=>n.length>=15),'common inner/high tones are tied across multiple bars; the bass may change every two bars');
      assert.ok(notes.every(n=>n.length>=7.5));
      for(let beat=.2;beat<64;beat+=.05)assert.ok(notes.some(n=>n.beat<=beat&&n.beat+n.length>=beat),'no string gap at '+beat);
    }
    assert.ok(score.notes.filter(n=>['flute','clarinet'].includes(n.desk)).every(n=>n.length>=1.5),'melody is not a series of short separated hits');
  });
  test(score.id+' expression never jumps more than one controller step',()=>{
    for(const desk of score.desks){const controls=score.controls.filter(c=>c.desk===desk.id);assert.ok(controls.length>10);assert.equal(controls[0].beat,0);
      for(let i=1;i<controls.length;i++){assert.ok(controls[i].beat>controls[i-1].beat);assert.ok(Math.abs(controls[i].value-controls[i-1].value)<=1);}
    }
  });
}
test('common chord tones remain one note, while different tones overlap without same-key retriggers',()=>{
  const notes=heldChords('violas',[[60,64],[60,65],[60,64]],{end:24});
  assert.deepEqual(notes.find(n=>n.key===60),{desk:'violas',beat:0,length:24,key:60,velocity:64});
  const first=notes.find(n=>n.key===64),next=notes.find(n=>n.key===65);assert.ok(first.beat+first.length>next.beat);
  validate({...legatoScores[0],notes});
  assert.throws(()=>heldChords('violas',[[60,60]],{end:8}),/unique pitches/);
});
test('a melodic phrase ties repeated pitches and joins changes with restrained overlap',()=>{
  assert.deepEqual(phrase('flute',1,[[74,2],[74,3],[76,2]],60,.15),[
    {desk:'flute',beat:1,length:5.15,key:74,velocity:60},{desk:'flute',beat:6,length:2,key:76,velocity:60}
  ]);
  assert.throws(()=>phrase('flute',0,[[74,0]]));
});
test('smooth expression retains endpoints, removes redundant events and rejects reversed anchors',()=>{
  const controls=smoothExpression('violas',[[0,80],[8,90],[16,80]]);assert.equal(controls[0].value,80);assert.equal(controls.at(-1).value,80);
  for(let i=1;i<controls.length;i++)assert.notEqual(controls[i].value,controls[i-1].value);
  assert.throws(()=>smoothExpression('violas',[[2,80],[0,90]]));assert.throws(()=>smoothExpression('violas',[[0,80],[8,90]],0));
});
function signal(envelope){const rate=1000,seconds=8,b=Buffer.alloc(rate*seconds*8);for(let i=0;i<rate*seconds;i++){const value=Math.sin(i*2*Math.PI*.041)*envelope(i/rate);b.writeFloatLE(value,i*8);b.writeFloatLE(value*.9,i*8+4);}return b;}
test('continuity diagnostics distinguish an unbroken bed from isolated volume dips without claiming musical quality',()=>{
  const smooth=continuity(signal(()=>.1),{sampleRate:1000});
  const interrupted=continuity(signal(t=>Math.floor(t*10)%5===0?.005:.1),{sampleRate:1000});
  assert.equal(smooth.isolatedSixDbDrops,0);assert.ok(interrupted.isolatedSixDbDrops>0);assert.ok(smooth.quietToMedian>.95);assert.ok(interrupted.quietToMedian<.1);
  assert.match(smooth.limitation,/not subjective/);
});
test('continuity checks reject nonfinite or incomplete audio and report silence honestly',()=>{
  assert.throws(()=>continuity(Buffer.alloc(7)));
  const invalid=signal(()=>.1);invalid.writeFloatLE(NaN,30000);assert.throws(()=>continuity(invalid,{sampleRate:1000}));
  const silent=continuity(signal(()=>0),{sampleRate:1000});assert.equal(silent.contrastDb,null);assert.equal(silent.quietToMedian,null);
  assert.throws(()=>continuity(signal(()=>.1),{sampleRate:1000,bodySeconds:20}));
});
test('local audition supports exact, open-ended and suffix byte ranges for native seeking',()=>{
  assert.deepEqual(byteRange(undefined,100),{start:0,end:99,partial:false});
  assert.deepEqual(byteRange('bytes=0-',100),{start:0,end:99,partial:true});
  assert.deepEqual(byteRange('bytes=20-40',100),{start:20,end:40,partial:true});
  assert.deepEqual(byteRange('bytes=-10',100),{start:90,end:99,partial:true});
  assert.deepEqual(byteRange('bytes=20-200',100),{start:20,end:99,partial:true});
  for(const bad of ['bytes=100-','bytes=50-20','bytes=-0','bytes=-','bytes=0-10,20-40','bytes=9007199254740992-'])assert.equal(byteRange(bad,100),null);
});
