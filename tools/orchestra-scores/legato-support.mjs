// Pure score helpers: held common tones, gentle overlaps and phrase-level
// expression. No audio processing that could conceal a broken performance.
import assert from 'node:assert/strict';

export function heldChords(desk, chords, {beats = 8, start = 0, end = 64, velocity = 64, overlap = .26} = {}) {
  const notes = [], held = new Map();
  for (let index = 0; index < chords.length; index++) {
    const at = start + index * beats, keys = new Set(chords[index]);
    assert.equal(keys.size, chords[index].length, 'a desk chord has unique pitches');
    assert.ok(at < end);
    for (const [key, note] of held) if (!keys.has(key)) {
      note.length = Math.min(end, at + overlap) - note.beat;
      held.delete(key);
    }
    for (const key of keys) if (!held.has(key)) {
      const note = {desk, beat: at, length: 0, key, velocity};
      notes.push(note); held.set(key, note);
    }
  }
  for (const note of held.values()) note.length = end - note.beat;
  return notes;
}

export function phrase(desk, beat, events, velocity = 60, overlap = .13) {
  const notes = [];
  for (let i = 0; i < events.length; i++) {
    const [key, duration] = events[i];
    assert.ok(duration > 0);
    const previous = notes.at(-1);
    if (previous?.key === key) previous.length += duration;
    else {
      if (previous) previous.length += overlap;
      notes.push({desk, beat, length: duration, key, velocity});
    }
    beat += duration;
  }
  return notes;
}

export function smoothExpression(desk, anchors, step = 1 / 16) {
  assert.ok(step > 0 && step <= .125);
  assert.ok(anchors.length >= 2);
  for (let i = 1; i < anchors.length; i++) assert.ok(anchors[i][0] > anchors[i - 1][0]);
  const controls = []; let previous = -1, segment = 0;
  const last = anchors.at(-1)[0];
  for (let beat = anchors[0][0]; beat <= last + step / 2; beat += step) {
    beat = Math.min(beat, last);
    while (segment < anchors.length - 2 && beat > anchors[segment + 1][0]) segment++;
    const [a, x] = anchors[segment], [b, y] = anchors[segment + 1];
    const p = Math.max(0, Math.min(1, (beat - a) / (b - a))), eased = p * p * (3 - 2 * p);
    const value = Math.round(x + (y - x) * eased);
    if (value !== previous) controls.push({desk, beat, controller: 11, value});
    previous = value;
    if (beat === last) break;
  }
  return controls;
}
