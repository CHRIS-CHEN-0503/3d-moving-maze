import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allIdentityScores,newIdentityScores,validateAllIdentities,allIdentityPage} from '../tools/render-all-region-identity-previews.mjs';
import {identityScores} from '../tools/orchestra-scores/region-identities.mjs';
import {validate,scores,identityProfiles} from '../tools/render-scene-orchestral-previews.mjs';

test('fourteen identity auditions cover every canonical non-summit region, with eleven new recordings',()=>{
  const rows=validateAllIdentities();assert.equal(rows.length,14);assert.equal(newIdentityScores.length,11);
  assert.ok(rows.every(row=>row.seconds>=45&&row.seconds<=60));
  assert.deepEqual(allIdentityScores.map(s=>s.chapterId),['garden','roots','echo','library','mist','frost','clockwork','furnace','heart','underworld:roots','underworld:mist','underworld:library','underworld:furnace','underworld:heart']);
  assert.equal(new Set(allIdentityScores.map(s=>s.style)).size,14);
  for(const accepted of identityScores){assert.ok(allIdentityScores.includes(accepted));assert.ok(!newIdentityScores.includes(accepted));}
});
test('six new surface scores use separate palettes, rhythms and density, not a uniform six-desk bed',()=>{
  const surface=newIdentityScores.filter(s=>s.floorRange[0]>0);
  assert.equal(surface.length,6);assert.equal(new Set(surface.map(s=>s.desks.map(d=>d.id).join(','))).size,6);
  assert.deepEqual(surface.map(s=>s.beatsPerBar),[6,3,4,4,5,4]);
  assert.equal(new Set(surface.map(s=>s.bpm)).size,6);
  const forest=surface[0],snow=surface[3],fire=surface[4];
  assert.ok(forest.percussion.some(p=>p.type==='tom'));assert.deepEqual(snow.percussion,[]);
  assert.ok(fire.percussion.some(p=>p.type==='timpani'));
  assert.ok(forest.notes.length>snow.notes.length*4);assert.ok(!fire.desks.some(d=>d.id==='piano'));
});
test('underground regions have new instrument groups and forms, not surface transpositions',()=>{
  const lookup=id=>allIdentityScores.find(s=>s.chapterId===id);
  for(const key of ['roots','mist','library','furnace','heart']){
    const surface=lookup(key),under=lookup('underworld:'+key);
    assert.notDeepEqual(surface.desks.map(d=>d.id),under.desks.map(d=>d.id));
    assert.notEqual(surface.style,under.style);assert.notEqual(surface.bpm,under.bpm);
  }
  assert.ok(lookup('underworld:roots').desks.some(d=>d.id==='chant'));
  assert.ok(lookup('underworld:mist').desks.some(d=>d.id==='guitar'));
  assert.equal(lookup('underworld:library').sections.length,5);
  assert.ok(lookup('underworld:furnace').desks.some(d=>d.id==='mutedtrumpet'));
  assert.equal(lookup('underworld:heart').sections.length,2);
});
test('opening statements start immediately and each configured desk has authored notes',()=>{
  const leads=['marimba','piano','clarinet','piano','tuba','trumpet','chant','guitar','organ','piano','choir'];
  for(const [index,score]of newIdentityScores.entries())assert.ok(score.notes.some(n=>n.desk===leads[index]&&n.beat<=.25));
  for(const score of newIdentityScores)for(const desk of score.desks)assert.ok(score.notes.some(n=>n.desk===desk.id));
});
test('new identity capabilities retain explicit allowlists and reject unsafe overlaps or mismatched metres',()=>{
  for(const original of scores){const changed=structuredClone(original);changed.desks[0].id='piano';assert.throws(()=>validate(changed));}
  for(const identity of newIdentityScores){
    assert.deepEqual(identity.desks.map(d=>d.id),identityProfiles[identity.id].desks);
    const wrong=structuredClone(identity);wrong.beatsPerBar=wrong.beatsPerBar===4?3:4;assert.throws(()=>validate(wrong));
    const overlap=structuredClone(identity),n=overlap.notes[0];overlap.notes.push({...n,beat:n.beat+n.length/2});assert.throws(()=>validate(overlap),/same-key/);
    const revision=structuredClone(identity);revision.revision='floor-audition';assert.throws(()=>validate(revision),/explicit revision/);
  }
});
test('new sound-bank instruments and scene IDs remain explicitly limited to local identities',()=>{
  const swift=readFileSync(new URL('../tools/render-scene-orchestral-preview.swift',import.meta.url),'utf8');
  for(const id of ['marimba','panflute','oboe','piano','trombone','tuba','trumpet','choir','chant','organ','englishhorn','guitar','contrabass','mutedtrumpet','tremolo'])assert.ok(swift.includes('"'+id+'":'));
  for(const score of newIdentityScores)assert.ok(swift.includes('"'+score.id+'"'));
  assert.match(swift,/score.id.hasSuffix\("-identity"\)/);assert.match(swift,/loadSoundBankInstrument/);
});
test('combined page offers fourteen exclusive native players, nine surface and five underground cards',()=>{
  const page=allIdentityPage(allIdentityScores.map(s=>({...s,seconds:s.bars*s.beatsPerBar*60/s.bpm+s.tail,acceptedRecording:identityScores.includes(s)})));
  assert.equal((page.match(/<audio controls preload="none"/g)||[]).length,14);
  assert.equal((page.split('<section id="surface">')[1].split('</section>')[0].match(/<article /g)||[]).length,9);
  assert.equal((page.split('<section id="underground">')[1].split('</section>')[0].match(/<article /g)||[]).length,5);
  assert.equal((page.match(/已確認原錄音/g)||[]).length,3);
  assert.ok(page.includes('尚未替換正式遊戲音樂'));assert.ok(!page.includes('autoplay'));
  assert.ok(page.includes('隱藏地區名稱試聽'));assert.match(page,/audio!==event\.target\)audio\.pause/);
  assert.ok(!page.includes('/Library/'));assert.ok(!page.includes('report.json'));
  for(const s of allIdentityScores)assert.ok(page.includes(encodeURIComponent(s.filename)));
});
test('combined renderer copies accepted recordings exclusively and checks all prior exports without rewriting them',()=>{
  const code=readFileSync(new URL('../tools/render-all-region-identity-previews.mjs',import.meta.url),'utf8');
  assert.match(code,/renderAuditions\(newIdentityScores,out/);assert.match(code,/constants\.COPYFILE_EXCL/);
  assert.match(code,/t\.scoreSha256,sha\(Buffer\.from\(JSON\.stringify\(score,null,2\)\)\)/);
  assert.match(code,/assert\.deepEqual\(report\.acceptedAuditionsAfter,accepted\.hashes\)/);
  assert.match(code,/assert\.deepEqual\(report\.priorAuditionsAfter,previous\.hashes\)/);
  assert.match(code,/Output already has a report/);
});
