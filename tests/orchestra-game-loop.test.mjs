import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {foldTail,replaceSelectedTracks,APPROVED_LEGATO_HASHES} from '../tools/finalize-scene-orchestral-music.mjs';

test('natural release folds into the next whole stereo phrase without losing beats',()=>{
  const pcm=Buffer.alloc(48);for(let i=0;i<12;i++)pcm.writeFloatLE(i/32,i*4);
  const loop=foldTail(pcm,4);assert.equal(loop.length,32);
  for(let i=0;i<8;i++)assert.equal(loop.readFloatLE(i*4),i<4?(i+8+i)/32:i/32);
  assert.equal(pcm.readFloatLE(0),0,'source audition remains unchanged');
});
test('loop folding rejects incomplete frames, non-finite release and invalid period',()=>{
  for(const frames of [0,-1,1.5,3])assert.throws(()=>foldTail(Buffer.alloc(16),frames));
  assert.throws(()=>foldTail(Buffer.alloc(17),1));
  const pcm=Buffer.alloc(16);pcm.writeFloatLE(NaN,8);assert.throws(()=>foldTail(pcm,1));
});
test('legato replacement preserves the existing boss metadata and forbids replacing a boss or duplicate scene',()=>{
  const manifest={version:1,tracks:[{id:'summit',sha256:'old-summit'},{id:'boss',sha256:'keep-boss',loopEnd:49.41176870748299},{id:'camp',sha256:'old-camp'}]};
  const original=structuredClone(manifest),updates=[{id:'summit',sha256:'new-summit'},{id:'camp',sha256:'new-camp'}];
  const next=replaceSelectedTracks(manifest,updates);assert.deepEqual(next.tracks[1],manifest.tracks[1]);assert.deepEqual(manifest,original);
  assert.deepEqual(next.tracks.map(t=>t.sha256),['new-summit','keep-boss','new-camp']);
  assert.throws(()=>replaceSelectedTracks(manifest,[{id:'boss'}]));assert.throws(()=>replaceSelectedTracks(manifest,[updates[0],updates[0]]));
  assert.deepEqual(Object.keys(APPROVED_LEGATO_HASHES),['summit','camp']);
});
test('published complete recordings match their manifest, whole-bar loops and bounded mobile size',()=>{
  const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('assets/music/orchestra-manifest.json',root),'utf8'));
  assert.equal(manifest.originalScore,true);assert.equal(manifest.sourceSamplesRedistributed,false);
  assert.deepEqual(manifest.tracks.map(t=>t.id),['summit','boss','camp']);
  let bytes=0;
  for(const track of manifest.tracks){
    const data=readFileSync(new URL(track.file,root));bytes+=data.length;
    assert.equal(data.toString('ascii',4,8),'ftyp');assert.equal(data.length,track.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'),track.sha256);
    assert.equal(track.sampleRate,44100);assert.equal(track.channels,2);
    assert.equal(track.loopStart,0);assert.equal(track.loopEnd,track.frames/track.sampleRate);
    assert.ok(Math.abs(track.loopEnd-track.bars*4*60/track.bpm)<1/44100);
    assert.ok(track.loopEnd>=45&&track.loopEnd<=55&&track.seamDelta<.015);
    assert.ok(Math.abs(track.integratedLoudness+18)<=.6&&track.truePeakDb<=-1.5);
  }
  assert.ok(bytes<3*1024*1024,'three complete AAC cues fit below three MiB together');
  assert.doesNotMatch(JSON.stringify(manifest),/\/Users\/|\.exs|\.agent-run|instrumentPaths/,'public manifest excludes local paths and raw source instruments');
});
