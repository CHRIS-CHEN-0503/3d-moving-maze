// Original local audition score. Time values use quarter-note beats, not seconds.
const notes = [];
const controls = [];
const add = (desk, beat, length, key, velocity) => notes.push({desk, beat, length, key, velocity});
const line = (desk, bar, events, velocity) => {
  for (const [offset, length, key, accent = 0] of events) {
    add(desk, bar * 4 + offset, length, key, velocity + accent);
  }
};

// Each inner voice is written separately: the harmony changes through close
// motion while the cello gives the listener a steady place to rest.
//                   bass, lower inner, upper inner, lower high, upper high
const harmony = [
  [38, 57, 62, 66, 69], // D(add9)
  [37, 57, 61, 64, 69], // A/C#
  [35, 57, 62, 66, 69], // Bm7
  [43, 55, 62, 64, 67], // G6
  [40, 55, 62, 64, 67], // Em7
  [43, 55, 59, 62, 67], // G
  [45, 57, 61, 64, 69], // A
  [38, 57, 62, 66, 69], // D
  [35, 57, 62, 66, 69], // Bm7
  [40, 55, 59, 62, 67], // Em7
  [43, 55, 59, 62, 67], // G
  [45, 57, 61, 64, 69], // A
  [42, 57, 62, 66, 69], // D/F#
  [43, 55, 62, 64, 67], // G6
  [45, 57, 61, 64, 69], // A(add9)
  [38, 57, 62, 66, 69], // D(add9), final settling
];

for (let bar = 0; bar < 16; bar++) {
  const [bass, low, inner, high, top] = harmony[bar];
  const v = [47, 45, 50, 46, 48, 48, 52, 45, 49, 48, 50, 53, 51, 48, 46, 43][bar];
  const held = bar === 15 ? 4 : 3.8;
  add('celli', bar * 4, held, bass, v + 5);
  add('violas', bar * 4 + 0.06, held - 0.06, low, v);
  add('violas', bar * 4 + 0.12, held - 0.12, inner, v - 5);

  // The first phrase leaves space around the solo. The third phrase opens
  // the upper strings; the last one gradually returns to the fire's warmth.
  if (bar >= 2) {
    add('violins', bar * 4 + 0.18, held - 0.18, high, v - 6);
    if (bar >= 4 && bar !== 7) add('violins', bar * 4 + 0.28, held - 0.28, top, v - 10);
  }
  if ([5, 6, 10, 11, 13, 14].includes(bar)) {
    add('celli', bar * 4 + 2.25, 1.25, bass + 12, v - 13);
  }
}

// Phrase 1: D–A–F#–E is an intimate invitation, with a breath after each bar.
line('flute', 0, [[0.5, 1.25, 74], [2, 0.75, 69, -5], [3, 0.75, 78, 3]], 70);
line('flute', 1, [[0, 1.5, 76], [2.25, 0.75, 73, -3], [3.25, 0.5, 76]], 67);
line('flute', 2, [[0.25, 1.25, 78], [2, 1, 81, 4], [3.25, 0.5, 78, -2]], 72);
line('flute', 3, [[0, 1.25, 76], [1.75, 1.75, 74, -4]], 68);

// Phrase 2: a small question rises through G, then resolves at the first D.
line('flute', 4, [[0.5, 0.75, 76], [1.5, 1, 79, 3], [2.75, 0.5, 78], [3.5, 0.25, 76, -3]], 70);
line('flute', 5, [[0.25, 1, 74], [1.5, 0.75, 71, -3], [2.5, 0.5, 67, -5], [3.25, 0.5, 74]], 68);
line('flute', 6, [[0, 0.75, 73], [1, 0.75, 76], [2, 0.75, 78, 2], [3, 0.75, 76]], 71);
line('flute', 7, [[0.25, 2.75, 74, -3]], 68);

// Phrase 3: the clarinet answers from a lower register; the upper strings
// briefly carry a lantern-like countermelody into the return.
line('clarinet', 8, [[0.5, 0.75, 71], [1.5, 1, 74, 2], [2.75, 1, 78, 3]], 68);
line('clarinet', 9, [[0.25, 1.25, 76], [1.75, 0.75, 74], [2.75, 0.75, 71, -4]], 67);
line('clarinet', 10, [[0, 1, 74], [1.25, 0.75, 79, 3], [2.25, 0.75, 78], [3.25, 0.5, 76, -2]], 69);
line('clarinet', 11, [[0.25, 1.5, 73], [2.25, 1.25, 69, -4]], 67);
line('violins', 9, [[2, 0.75, 74], [3, 0.75, 76, 2]], 45);
line('violins', 10, [[0, 1.5, 78], [2, 1.25, 76, -2]], 48);
line('flute', 11, [[2.5, 1, 76, -4]], 65);

// Phrase 4: the opening motif returns, expanded, then settles on D. Its
// final note releases a half-beat before the strings and room reverberation.
line('flute', 12, [[0.25, 0.75, 74], [1.25, 0.75, 69, -4], [2.25, 1.25, 78, 4]], 72);
line('flute', 13, [[0, 1.25, 76], [1.75, 0.75, 74, -2], [2.75, 1, 71, -4]], 68);
line('flute', 14, [[0.25, 0.75, 73], [1.25, 0.75, 76, 2], [2.25, 0.75, 74], [3.25, 0.5, 73, -3]], 68);
line('flute', 15, [[0.25, 3.25, 74, -6]], 68);
line('clarinet', 12, [[0.25, 3, 66, -4]], 53);
line('clarinet', 13, [[0.25, 3, 67, -5]], 52);
line('clarinet', 15, [[0.25, 3.25, 66, -8]], 50);

// A restrained horn appears only at the two arrivals, inside the harmony.
for (const [bar, key, velocity] of [[7, 62, 43], [12, 62, 45], [15, 62, 40]]) {
  add('horn', bar * 4 + 0.35, 3.25, key, velocity);
}

// Expression curves give each four-bar phrase a gentle, breathing arc.
const expression = {
  violins: [[0, 60], [8, 66], [16, 74], [24, 78], [28, 68], [32, 70], [40, 80], [44, 72], [48, 77], [56, 68], [60, 60], [63.8, 51]],
  violas: [[0, 70], [8, 75], [12, 69], [16, 76], [24, 80], [28, 69], [32, 75], [40, 81], [44, 73], [48, 79], [56, 69], [60, 63], [63.8, 54]],
  celli: [[0, 75], [8, 79], [12, 73], [16, 79], [24, 83], [28, 73], [32, 78], [40, 83], [44, 76], [48, 81], [56, 73], [60, 67], [63.8, 57]],
  flute: [[0, 83], [8, 87], [12, 80], [16, 86], [24, 88], [28, 79], [32, 79], [44, 81], [48, 88], [52, 84], [56, 81], [60, 76], [63.5, 65]],
  clarinet: [[0, 80], [32, 84], [36, 82], [40, 87], [44, 79], [48, 74], [52, 70], [60, 64], [63.5, 57]],
  horn: [[0, 64], [28, 69], [48, 72], [60, 62], [63.5, 53]],
};
for (const [desk, events] of Object.entries(expression)) {
  for (const [beat, value] of events) controls.push({desk, beat, controller: 11, value});
}
notes.sort((a, b) => a.beat - b.beat || a.key - b.key);
controls.sort((a, b) => a.beat - b.beat);

export default {
  id: 'camp',
  title: '火光下的約定',
  filename: '營地休息-火光下的約定.mp3',
  bpm: 78,
  beatsPerBar: 4,
  bars: 16,
  tail: 4,
  reverb: 19,
  description: '原創奇幻營地休息試聽：長笛先唱出有留白的 D–A–F#–E 主題，單簧管在第三段溫柔回答；低弦與細微法國號托住四段逐步展開、再落回火光的樂句。',
  tonality: 'D 大調；加九與六和弦，經 B 小調、E 小調與 A 大調回到 D。',
  sections: [
    {name: '坐回火光', fromBar: 0, toBar: 4, description: '低弦暖墊與有呼吸的長笛；主題輕輕出現。'},
    {name: '彼此照應', fromBar: 4, toBar: 8, description: '上弦逐漸展開，旋律微微上揚，第一次安穩落在 D。'},
    {name: '今夜的故事', fromBar: 8, toBar: 12, description: '單簧管接唱，兩小節高弦回答帶來溫暖的交流感。'},
    {name: '明天再出發', fromBar: 12, toBar: 16, description: '長笛主題以較寬的樂句回來，尾聲緩緩收束。'},
  ],
  desks: [
    {id: 'violins', gain: -21, pan: -0.36},
    {id: 'violas', gain: -23, pan: -0.12},
    {id: 'celli', gain: -19, pan: 0.24},
    {id: 'flute', gain: -12, pan: -0.05},
    {id: 'clarinet', gain: -14, pan: 0.12},
    {id: 'horn', gain: -25, pan: 0.35},
  ],
  notes,
  controls,
  percussion: [
    {type: 'bell', beat: 0.25, gain: 0.035},
    {type: 'bell', beat: 32.25, gain: 0.025},
  ],
};
