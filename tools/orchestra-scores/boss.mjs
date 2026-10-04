// Original local audition cue: a driving, evolving acoustic orchestral battle.
// Bars are zero based. All note-offs fit within the 28-bar musical body.
const bpm = 136;
const bars = 28;
const notes = [];
const percussion = [];
const controls = [];
const violinPulse = new Set();
const add = (desk, beat, length, key, velocity) => {
  const note = { desk, beat, length, key, velocity };
  notes.push(note);
  return note;
};
const hit = (type, beat, gain, pitch) => {
  percussion.push({ type, beat, gain, ...(pitch ? { pitch } : {}) });
};

const harmony = {
  dm: { root: 38, fifth: 45, low: [50, 57], mid: [62, 65, 69], high: [74, 77, 81] },
  bb: { root: 34, fifth: 41, low: [46, 53], mid: [58, 62, 65], high: [70, 74, 77] },
  eb: { root: 39, fifth: 46, low: [51, 58], mid: [63, 67, 70], high: [75, 79, 82] },
  a: { root: 33, fifth: 40, low: [45, 52], mid: [57, 61, 64], high: [69, 73, 76] },
  c: { root: 36, fifth: 43, low: [48, 55], mid: [60, 64, 67], high: [72, 76, 79] },
  gm: { root: 31, fifth: 38, low: [43, 50], mid: [55, 58, 62], high: [67, 70, 74] },
};
const progression = [
  'dm', 'bb', 'eb', 'a',
  'dm', 'dm', 'bb', 'c', 'dm', 'bb', 'gm', 'a',
  'gm', 'eb', 'dm', 'a', 'gm', 'bb', 'c', 'a',
  'dm', 'bb', 'gm', 'a', 'dm', 'eb', 'a', 'dm',
];

for (let bar = 0; bar < bars; bar++) {
  const chord = harmony[progression[bar]];
  const start = bar * 4;
  const intro = bar < 4;
  const pressure = bar >= 12 && bar < 20;
  const finale = bar >= 20;
  const last = bar === bars - 1;
  const pulseVelocity = intro ? 75 + bar * 5 : finale ? 100 : pressure ? 91 : 86;

  // The persistent low-string pulse is shaped 3+3+2; upper strings answer
  // with an off-beat bow pattern rather than one unchanging arpeggio.
  for (let eighth = 0; eighth < (last ? 6 : 8); eighth++) {
    const accented = eighth === 0 || eighth === 3 || eighth === 6;
    const key = eighth === 3 || eighth === 7 ? chord.fifth : chord.root + (eighth === 5 ? 12 : 0);
    add('celli', start + eighth * .5, accented ? .37 : .29,
      key, pulseVelocity + (accented ? 11 : -8));
    if (bar > 0) {
      const upperIndex = pressure ? [0, 2, 1, 2, 0, 1, 2, 1][eighth] : [0, 1, 2, 1, 0, 2, 1, 2][eighth];
      const upperKey = chord.high[upperIndex] - (intro ? 12 : 0);
      violinPulse.add(add('violins', start + eighth * .5 + .025, .26,
        upperKey, pulseVelocity - (accented ? 0 : 17)));
    }
  }

  // Middle strings establish harmony with changing durations and clear gaps.
  const violaPattern = pressure ? [0, 1.5, 2.5, 3.5] : intro ? [0, 2] : [0, 1.5, 3];
  violaPattern.forEach((offset, index) => {
    if (last && offset > 2.5) return;
    const voice = chord.mid[index % chord.mid.length];
    add('violas', start + offset, intro ? 1.35 : .62,
      voice, intro ? 70 : finale ? 99 : 86);
    if (offset === 0 || finale) {
      add('violas', start + offset + .012, intro ? 1.25 : .55,
        chord.mid[(index + 1) % 3], intro ? 61 : 77);
    }
  });

  // Timpani root pitches follow the written bass harmony; snare and low tom
  // form a forward-moving orchestral march with syncopated answers.
  const lowPitch = 440 * 2 ** ((chord.root - 69) / 12);
  hit('timpani', start, intro ? .078 : finale ? .108 : .091, lowPitch);
  hit('timpani', start + 2, intro ? .06 : .079, lowPitch);
  if (intro) {
    hit('tom', start + 1.5, .042 + bar * .009, lowPitch * 1.5);
    hit('snare', start + 3, .04 + bar * .009);
  } else {
    hit('snare', start + 1, pressure ? .081 : .067);
    if (!last) hit('snare', start + 3, finale ? .091 : .079);
    hit('tom', start + 2.75, .051, lowPitch * 1.5);
    if (finale && !last) hit('timpani', start + 3.5, .057, lowPitch);
    for (let eighth = 0; eighth < (last ? 6 : 8); eighth++) {
      hit('shaker', start + eighth * .5 + .02, eighth % 2 ? .018 : .025);
    }
  }
  if ([0, 4, 12, 20, 24].includes(bar)) hit('cymbal', start, intro ? .04 : .057);
  if ([3, 11, 19, 23, 26].includes(bar)) {
    // Short rising rolls announce actual structural changes.
    for (let sixteenth = 0; sixteenth < 8; sixteenth++) {
      hit('snare', start + 2 + sixteenth * .25, .028 + sixteenth * .006);
    }
    hit('tom', start + 3.5, .065, lowPitch * 1.25);
    hit('tom', start + 3.75, .078, lowPitch);
  }
}

// Four-bar threat introduction: deliberate horn stabs grow into an upbeat.
[[0, 62, 1.2], [1.5, 69, .65], [2.5, 65, .8],
  [4, 58, 1.4], [6, 65, 1.1],
  [8, 63, 1.1], [9.5, 70, .7], [10.5, 67, .65],
  [12, 64, 1.25], [13.5, 61, .7], [14.5, 64, .5], [15.25, 69, .55]]
  .forEach(([beat, key, length], index) => add('horn', beat, length, key, 79 + Math.min(index, 10) * 2));

// The first main theme develops the original D-A-F-E cell into a question
// and answer. Its rests let the string pulse remain audible under the horn.
const mainTheme = [
  [[0, 62, .85], [1, 69, .7], [2, 65, .65], [3, 64, .75]],
  [[0, 62, 1.1], [1.5, 65, .45], [2, 69, .75], [3, 72, .7]],
  [[0, 70, 1.15], [1.5, 65, .6], [2.5, 62, .55], [3.25, 60, .55]],
  [[0, 64, .8], [1, 67, .8], [2.25, 72, 1.05]],
  [[0, 74, .8], [1, 69, .7], [2, 65, .65], [3, 64, .75]],
  [[0, 62, .65], [.75, 65, .55], [1.5, 70, .85], [2.5, 69, .55], [3.25, 65, .55]],
  [[0, 67, .85], [1.25, 62, .65], [2.25, 58, .65], [3.25, 62, .55]],
  [[0, 64, .65], [.75, 61, .55], [1.5, 57, .75], [2.5, 61, .45], [3.25, 69, .55]],
];
mainTheme.forEach((phrase, index) => {
  phrase.forEach(([offset, key, length], point) => {
    add('horn', (index + 4) * 4 + offset, length, key, 100 + (point === 0 ? 7 : 0));
  });
});

// At the midpoint, the horn steps back to bold responses while a distinct
// high-string line and woody clarinet build tension over darker harmony.
const pressureLine = [
  [74, 70, 67, 69, 70, 74], [75, 74, 70, 67, 70, 75],
  [77, 74, 69, 65, 69, 74], [76, 73, 69, 64, 69, 73],
  [74, 79, 77, 74, 70, 69], [77, 74, 70, 65, 70, 74],
  [76, 79, 76, 72, 74, 76], [76, 73, 69, 73, 76, 81],
];
pressureLine.forEach((phrase, index) => {
  const start = (index + 12) * 4;
  const offsets = [0, .75, 1.5, 2, 2.75, 3.5];
  phrase.forEach((key, point) => {
    add('violins', start + offsets[point] + .01, point === 0 ? .58 : .36, key, 94 + point * 2);
  });
  const chord = harmony[progression[index + 12]];
  add('horn', start + .05, .7, chord.mid[0], 109);
  add('horn', start + .065, .7, chord.mid[2], 94);
  add('horn', start + 2.55, .6, chord.mid[1], 100);
  add('clarinet', start + 1.05, .75, chord.mid[2] + 12, 78);
  add('clarinet', start + 3.02, .65, chord.mid[1] + 12, 83);
});

// The final theme is broader and higher, with an exposed upward cry in the
// penultimate bar and one resolved final impact; no repeating fade-out loop.
const finalTheme = [
  [[0, 74, 1.2], [1.5, 69, .6], [2.5, 65, .55], [3.25, 64, .55]],
  [[0, 70, .75], [1, 65, .6], [2, 62, .65], [3, 65, .75]],
  [[0, 67, .65], [.75, 70, .55], [1.5, 74, .8], [2.5, 70, .55], [3.25, 67, .55]],
  [[0, 69, .7], [1, 73, .6], [2, 76, .7], [3, 73, .7]],
  [[0, 74, 1.15], [1.5, 77, .5], [2.25, 81, .7], [3.25, 77, .55]],
  [[0, 75, .7], [1, 70, .65], [2, 67, .7], [3, 70, .7]],
  [[0, 73, .55], [.75, 76, .55], [1.5, 81, .75], [2.5, 76, .6], [3.25, 73, .55]],
  [[0, 74, 1.0], [1.5, 69, .7], [3, 62, .95]],
];
finalTheme.forEach((phrase, index) => {
  const start = (index + 20) * 4;
  phrase.forEach(([offset, key, length], point) => {
    add('horn', start + offset, length, key, point === 0 ? 119 : 111);
    if (index >= 4 && index < 7) {
      add('flute', start + offset + .035, Math.max(.3, length - .12), key + 12, 81);
    }
  });
});

// Ending: stop the pulse before the fourth beat and land as an ensemble.
const ending = (bars - 1) * 4 + 3;
add('celli', ending, .96, 38, 119);
add('celli', ending + .01, .94, 50, 99);
for (const key of [62, 65, 69]) add('violas', ending + .012, .95, key, 98);
for (const key of [74, 77, 81]) add('violins', ending + .018, .94, key, 105);
hit('timpani', ending, .118, 73.416);
hit('tom', ending, .07, 110);
hit('cymbal', ending, .065);

// Expression changes follow the section arc independently of note accents.
for (const desk of ['violins', 'violas', 'celli', 'horn', 'flute', 'clarinet']) {
  for (const [beat, value] of [[0, 85], [8, 93], [16, 105], [44, 111],
    [48, desk === 'horn' ? 98 : 106], [64, 112], [80, 119], [96, 123], [108, 115]]) {
    controls.push({ desk, beat, controller: 11, value });
  }
}

// One sampled section cannot release an older same-key pulse independently
// of a newer melodic note. Give the pressure melody priority at those joins;
// the cello, middle strings and drums keep the uninterrupted forward drive.
const violinMelody = notes.filter(n => n.desk === 'violins' && !violinPulse.has(n));
for (let i = notes.length - 1; i >= 0; i--) {
  const n = notes[i];
  if (violinPulse.has(n) && violinMelody.some(m => m.key === n.key &&
    m.beat < n.beat + n.length + .01 && n.beat < m.beat + m.length + .01)) notes.splice(i, 1);
}
notes.sort((a, b) => a.beat - b.beat || a.key - b.key);
percussion.sort((a, b) => a.beat - b.beat);
controls.sort((a, b) => a.beat - b.beat);

export default {
  id: 'boss',
  title: '石之王座・決戰',
  filename: '樓主戰-石之王座.mp3',
  bpm,
  beatsPerBar: 4,
  bars,
  tail: 4,
  reverb: 18,
  description: '136 拍的原創樓主戰試聽。八分低弦以 3+3+2 重音推進，定音鼓、軍鼓和低鼓形成刺激的搏動；圓號主題經過破門、正面交鋒、升壓與最後突擊四段發展，末尾全團重擊落在 D 小調。',
  tonality: 'D 小調；降二級 E-flat 色彩與 A 大三和弦形成戰鬥張力，主題動機 D–A–F–E。',
  sections: [
    { name: '破門', fromBar: 0, toBar: 4, description: '低弦立即起跑，圓號威脅動機與鼓聲逐層加重。' },
    { name: '正面交鋒', fromBar: 4, toBar: 12, description: '圓號完整主題，弦樂切分回應，八分脈動維持衝刺感。' },
    { name: '攻勢升壓', fromBar: 12, toBar: 20, description: '高弦新旋律和單簧管交錯，降二級陰影、銅管重擊與滾奏提高壓力。' },
    { name: '最後突擊', fromBar: 20, toBar: 28, description: '圓號高音主題、長笛倍奏和更強鼓點，最後一次全團重擊確定收束。' },
  ],
  desks: [
    { id: 'violins', gain: -16, pan: -.38 },
    { id: 'violas', gain: -19, pan: -.08 },
    { id: 'celli', gain: -12, pan: .25 },
    { id: 'horn', gain: -11, pan: .12 },
    { id: 'clarinet', gain: -23, pan: -.16 },
    { id: 'flute', gain: -24, pan: -.27 },
  ],
  notes,
  controls,
  percussion,
};
