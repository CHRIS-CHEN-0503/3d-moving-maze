import test from 'node:test';
import assert from 'node:assert/strict';
import {analyse, parseLoudness, percussionMix, scores, validate} from '../tools/render-scene-orchestral-previews.mjs';

const copyScore = () => structuredClone(scores[0]);
const bodySeconds = score => score.bars * score.beatsPerBar * 60 / score.bpm;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('loudness parser accepts descriptive normalization type but rejects missing or invalid measured levels', () => {
  const levels = {input_i:'-18',input_tp:'-6',input_lra:'4',input_thresh:'-28',target_offset:'0.1',normalization_type:'dynamic'};
  assert.deepEqual(parseLoudness('meter output\n'+JSON.stringify(levels)),levels);
  for(const bad of [undefined,'','nan','-inf']) {
    assert.throws(()=>parseLoudness(JSON.stringify({...levels,input_tp:bad})),/invalid measured loudness/);
  }
  assert.throws(()=>parseLoudness('no measurement'),/missing loudness measurements/);
});

test('all three original scores validate as complete 45–60 second auditions', () => {
  assert.deepEqual(scores.map(score => score.id), ['summit', 'boss', 'camp']);
  for (const score of scores) {
    const result = validate(score);
    assert.equal(result.id, score.id);
    assert.equal(result.notes, score.notes.length);
    assert.equal(result.percussion, score.percussion.length);
    assert.ok(result.seconds >= 45 && result.seconds <= 60);
    near(result.seconds, bodySeconds(score) + score.tail);
    assert.ok(result.maxPolyphony > 0 && result.maxPolyphony <= 40);
    assert.equal(score.sections[0].fromBar, 0);
    assert.equal(score.sections.at(-1).toBar, score.bars);
  }
});

test('boss cue is 136 bpm and has substantially denser attacks and percussion', () => {
  const boss = scores.find(score => score.id === 'boss');
  assert.equal(boss.bpm, 136);
  assert.equal(boss.sections.length, 4);
  for (const other of scores.filter(score => score.id !== 'boss')) {
    assert.ok(boss.notes.length / bodySeconds(boss) > other.notes.length / bodySeconds(other) * 4);
    assert.ok(boss.percussion.length / bodySeconds(boss) > other.percussion.length / bodySeconds(other) * 10);
  }
  for (const type of ['timpani', 'snare', 'tom', 'cymbal', 'shaker']) {
    assert.ok(boss.percussion.some(hit => hit.type === type), `boss drive includes ${type}`);
  }
});

test('same-desk same-key overlap is rejected before it can cut a sampled phrase', () => {
  const score = copyScore();
  const first = score.notes[0];
  score.notes.push({...first, beat: first.beat + first.length / 2});
  assert.throws(() => validate(score), /overlapping same-key notes/);
});

test('rearticulation at a previous note-off and simultaneous notes on separate desks remain valid', () => {
  const score = copyScore();
  const first = {...score.notes[0], beat: 0, length: 1};
  score.notes = [first, {...first, beat: 1}, {...first, desk: 'violins'}];
  assert.equal(validate(score).maxPolyphony, 2);
});

const invalidScores = [
  ['tempo outside the audition range', score => { score.bpm = 161; }],
  ['duration outside 45–60 seconds', score => { score.tail = 20; }],
  ['duplicate sampled desk', score => { score.desks[1].id = score.desks[0].id; }],
  ['unknown note desk', score => { score.notes[0].desk = 'unsupported'; }],
  ['non-finite timing', score => { score.notes[0].beat = NaN; }],
  ['note outside the musical body', score => { score.notes[0].beat = score.bars * 4; }],
  ['MIDI key above 127', score => { score.notes[0].key = 128; }],
  ['silent MIDI note-on', score => { score.notes[0].velocity = 0; }],
  ['unsupported controller', score => { score.controls[0].controller = 7; }],
  ['percussion gain outside the mix headroom', score => { score.percussion[0].gain = 0.2; }],
  ['unsupported percussion type', score => { score.percussion[0].type = 'unsupported'; }],
  ['non-finite percussion pitch', score => { score.percussion[0].pitch = Infinity; }],
  ['gap between exclusive-end sections', score => { score.sections[1].fromBar += 1; }],
  ['section extending past the score', score => { score.sections.at(-1).toBar += 1; }],
];
for (const [name, change] of invalidScores) {
  test(`score validator rejects ${name}`, () => {
    const score = copyScore();
    change(score);
    assert.throws(() => validate(score), {name: 'AssertionError'});
  });
}

for (const type of ['timpani', 'tom', 'snare', 'cymbal', 'shaker', 'bell']) {
  test(`${type} percussion is deterministic, finite, stereo and silent before its beat`, () => {
    const sampleRate = 8000;
    const frames = 8000;
    const score = {bpm: 120, percussion: [{type, beat: 1, gain: 0.05}]};
    const first = percussionMix(score, frames, sampleRate);
    const second = percussionMix(score, frames, sampleRate);
    assert.ok(first.left instanceof Float32Array && first.right instanceof Float32Array);
    assert.equal(first.left.length, frames);
    assert.equal(first.right.length, frames);
    assert.notEqual(first.left.buffer, first.right.buffer);
    assert.deepEqual(first, second);
    assert.ok(first.left.every(Number.isFinite) && first.right.every(Number.isFinite));
    assert.ok(first.left.subarray(0, 4000).every(value => value === 0));
    assert.ok(first.right.subarray(0, 4000).every(value => value === 0));
    assert.ok(first.left.some(value => Math.abs(value) > 0.0001));
    assert.ok(first.right.some(value => Math.abs(value) > 0.0001));
    assert.ok(first.left.some((value, index) => value !== first.right[index]));
  });
}

test('percussion with no events produces exactly silent stereo buffers', () => {
  const mixed = percussionMix({bpm: 120, percussion: []}, 2048, 8000);
  assert.equal(mixed.left.length, 2048);
  assert.equal(mixed.right.length, 2048);
  assert.ok(mixed.left.every(value => value === 0));
  assert.ok(mixed.right.every(value => value === 0));
});

test('percussion outside the requested buffer cannot alter its samples', () => {
  const mixed = percussionMix({bpm: 120, percussion: [{type: 'snare', beat: 4, gain: 0.1}]}, 2048, 8000);
  assert.ok(mixed.left.every(value => value === 0));
  assert.ok(mixed.right.every(value => value === 0));
});

test('stereo float PCM analysis measures actual signal rather than metadata', () => {
  const channels = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const pcm = Buffer.alloc(channels.length * 8);
  channels.forEach(([left, right], index) => {
    pcm.writeFloatLE(left, index * 8);
    pcm.writeFloatLE(right, index * 8 + 4);
  });
  const measured = analyse(pcm);
  assert.equal(measured.frames, channels.length);
  assert.equal(measured.peak, 1);
  assert.equal(measured.mean, 0);
  near(measured.rms, Math.sqrt(0.5));
  near(measured.leftRms, Math.sqrt(0.5));
  near(measured.rightRms, Math.sqrt(0.5));
  assert.equal(measured.stereoCorrelation, 0);
  assert.equal(measured.halfSecondRms.length, 1);
  near(measured.halfSecondRms[0], measured.rms);
});

test('PCM analysis rejects incomplete stereo frames and non-finite samples', () => {
  assert.throws(() => analyse(Buffer.alloc(7)), {name: 'AssertionError'});
  for (const bad of [NaN, Infinity]) {
    const pcm = Buffer.alloc(8);
    pcm.writeFloatLE(bad, 4);
    assert.throws(() => analyse(pcm), {name: 'AssertionError'});
  }
});
