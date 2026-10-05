import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {identityScores,identityPage,validateIdentities} from '../tools/render-region-identity-previews.mjs';
import {scores,validate} from '../tools/render-scene-orchestral-previews.mjs';

test('identity auditions keep canonical regions, full 45–60 second files and three different instrument groups',()=>{
  const rows=validateIdentities();assert.equal(rows.length,3);
  assert.ok(rows.every(row=>row.seconds>=45&&row.seconds<=60));
  assert.equal(new Set(identityScores.map(s=>s.desks.map(d=>d.id).join(','))).size,3);
  assert.deepEqual(identityScores.map(s=>s.bpm),[104,70,128]);
  assert.deepEqual(identityScores.map(s=>s.beatsPerBar),[3,4,4]);
  assert.equal(new Set(identityScores.map(s=>s.roomPreset)).size,3);
  assert.equal(new Set(identityScores.map(s=>s.sections.length)).size,3);
});
test('the opening signature starts immediately with a unique lead, not the same string bed',()=>{
  const [garden,echo,gear]=identityScores;
  for(const [score,lead]of [[garden,'harp'],[echo,'celesta'],[gear,'harpsichord']]){
    assert.ok(score.notes.some(n=>n.desk===lead&&n.beat<=.2));
    assert.ok(score.notes.filter(n=>n.beat*60/score.bpm<4).some(n=>n.desk===lead));
  }
  assert.ok(!gear.desks.some(d=>['violins','violas','celli','flute','horn'].includes(d.id)));
  assert.ok(!echo.desks.some(d=>['celli','violas','horn','clarinet'].includes(d.id)));
  assert.ok(!garden.desks.some(d=>['celli','violins','horn','clarinet'].includes(d.id)));
});
test('harp waltz, unmetered crystal spacing and geared accents differ in density and articulation',()=>{
  const [garden,echo,gear]=identityScores,rate=s=>s.notes.length/(s.bars*s.beatsPerBar*60/s.bpm);
  assert.ok(rate(gear)>rate(echo)*4);assert.ok(rate(garden)>rate(echo)*3);
  assert.deepEqual(echo.percussion,[]);assert.deepEqual(garden.percussion,[]);
  assert.ok(gear.percussion.length>150);assert.ok(gear.notes.filter(n=>n.desk==='harpsichord').every(n=>n.length<.3));
  assert.ok(echo.notes.filter(n=>n.desk==='celesta').every(n=>n.length>=1.5));
  assert.ok(garden.notes.filter(n=>n.desk==='flute').some(n=>n.length>=2));
});
test('additional instruments and metres are explicit identity-only capabilities, not weakened original score checks',()=>{
  const original=structuredClone(scores[0]);original.beatsPerBar=3;assert.throws(()=>validate(original));
  original.beatsPerBar=4;original.desks[0].id='harp';assert.throws(()=>validate(original));
  const unknown=structuredClone(identityScores[0]);unknown.id='anything-identity';assert.throws(()=>validate(unknown),/unknown identity/);
  const wrong=structuredClone(identityScores[0]);wrong.revision='floor-audition';assert.throws(()=>validate(wrong),/explicit revision/);
  for(const identity of identityScores){const score=structuredClone(identity),n=score.notes[0];score.notes.push({...n,beat:n.beat+n.length/2});assert.throws(()=>validate(score),/same-key/);}
});
test('every new timbre uses an installed sound bank program, with no download or loose sample export',()=>{
  const swift=readFileSync(new URL('../tools/render-scene-orchestral-preview.swift',import.meta.url),'utf8');
  for(const id of ['harp','celesta','vibraphone','pizzicato','harpsichord','bassoon'])assert.ok(swift.includes('"'+id+'":'));
  for(const score of identityScores)assert.ok(swift.includes('"'+score.id+'"'));
  assert.match(swift,/loadSoundBankInstrument/);assert.match(swift,/New instruments are local identity auditions only/);
});
test('new audition page has exclusive native playback and optional hidden region labels, not autoplay',()=>{
  const page=identityPage(identityScores.map(s=>({...s,seconds:s.bars*s.beatsPerBar*60/s.bpm+s.tail})));
  assert.equal((page.match(/<audio controls preload="none"/g)||[]).length,3);
  assert.ok(!page.includes('autoplay'));assert.ok(page.includes('尚未替換正式遊戲音樂'));
  assert.ok(page.includes('隱藏地區名稱試聽'));assert.match(page,/audio!==event\.target\)audio\.pause/);
  assert.ok(!page.includes('/Library/'));assert.ok(!page.includes('report.json'));
  for(const score of identityScores){assert.ok(page.includes(score.regionName));assert.ok(page.includes(encodeURIComponent(score.filename)));}
});
