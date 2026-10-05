import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {floorScores,validateFloorScores,previewPage} from '../tools/render-floor-orchestral-previews.mjs';

test('fourteen cues cover canonical nine surface and five underground regions without replacing approved scenes',()=>{
  const rows=validateFloorScores();assert.equal(rows.length,14);
  assert.equal(floorScores.filter(s=>s.underground).length,5);assert.equal(floorScores.filter(s=>!s.underground).length,9);
  assert.equal(new Set(floorScores.map(s=>s.id)).size,14);assert.equal(new Set(floorScores.map(s=>s.filename)).size,14);
  assert.ok(rows.every(r=>r.seconds>=45&&r.seconds<=60));
  assert.throws(()=>validateFloorScores(floorScores.slice(1)),/exactly once/);
  const wrong=structuredClone(floorScores);wrong[0].floorRange=[89,79];assert.throws(()=>validateFloorScores(wrong));
});
for(const score of floorScores){
  test(score.id+' has its own melody, continuous long strings and smooth phrase-level expression',()=>{
    for(const desk of ['celli','violas','violins'])for(let beat=.15;beat<64;beat+=.125){
      assert.ok(score.notes.some(n=>n.desk===desk&&n.length>7&&n.beat<=beat&&n.beat+n.length>=beat),'unbroken long bow at '+desk+' '+beat);
    }
    for(const desk of score.desks){const c=score.controls.filter(c=>c.desk===desk.id);assert.equal(c[0].beat,0);assert.equal(c[0].value,86);assert.equal(c.at(-1).value,82);assert.ok(c.at(-1).beat<=64&&c.at(-1).beat>62,'deduplicated final value holds through beat 64');
      for(let i=1;i<c.length;i++){assert.ok(c[i].beat>c[i-1].beat);assert.ok(Math.abs(c[i].value-c[i-1].value)<=1);}
    }
    assert.equal(score.sections.length,4);assert.ok(score.notes.filter(n=>['flute','clarinet','horn'].includes(n.desk)).every(n=>n.length>=1.5));
  });
}
test('environment melodies and harmonies are distinct, not one transposed track fourteen times',()=>{
  const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const motifs=floorScores.map(s=>{const lead=s.notes.filter(n=>['flute','horn','clarinet'].includes(n.desk)&&n.beat<16).sort((a,b)=>a.beat-b.beat);return hash(lead.map((n,i)=>[n.desk,n.key-lead[0].key,i? n.beat-lead[i-1].beat:0,n.length]));});
  assert.equal(new Set(motifs).size,14,'interval/rhythm/desk fingerprints differ even after transposition');
  const beds=floorScores.map(s=>hash(s.notes.filter(n=>n.desk==='violas').map(n=>[n.beat,n.key,n.length])));assert.equal(new Set(beds).size,14);
  assert.ok(floorScores.find(s=>s.id==='clockwork').percussion.length>0);assert.deepEqual(floorScores.find(s=>s.id==='mist').percussion,[]);
});
test('the shared renderer explicitly accepts every audition ID, without a path-like wildcard',()=>{
  const swift=readFileSync(new URL('../tools/render-scene-orchestral-preview.swift',import.meta.url),'utf8');
  for(const score of floorScores)assert.ok(swift.includes('"'+score.id+'"'));assert.match(swift,/scenes\.contains\(score\.id\)/);
});
test('floor audition page has all native players, region and range labels, no autoplay, and exclusive playback',()=>{
  const tracks=floorScores.map(s=>({...s,seconds:s.bars*4*60/s.bpm+s.tail})),page=previewPage(tracks);
  assert.equal((page.match(/<article /g)||[]).length,14);assert.equal((page.match(/<audio controls preload="none"/g)||[]).length,14);
  assert.ok(!page.includes('autoplay'));assert.match(page,/尚未替換正式遊戲音樂/);assert.match(page,/audio!==event\.target\)audio\.pause/);
  for(const score of floorScores){assert.ok(page.includes(score.title));assert.ok(page.includes(encodeURIComponent(score.filename)));assert.ok(page.includes(score.regionName));}
  assert.ok(!page.includes('instrumentPaths'));assert.ok(!page.includes('/Library/'));assert.ok(!page.includes('report.json'));
  assert.throws(()=>previewPage(tracks.slice(1)));
});
