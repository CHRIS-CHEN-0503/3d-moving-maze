import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// 完全原創的音符、編曲及合成音色；不讀取取樣庫、歌曲或外部音訊。
// 一首 = 8 小節，戰鬥曲 = 12 小節。所有延音／反射環接到開頭，沒有淡出靜默缺口。
const RATE = 32000;
const TAU = Math.PI * 2;
const OUT = fileURLToPath(new URL('../assets/music/', import.meta.url));
const MAX_TRACK_BYTES = 500000;
const MAX_TOTAL_BYTES = 3000000;
const MODES = {
  dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const TRACKS = [
  { id: 'summoning', title: '雲端初醒', bpm: 60, root: 50, key: 'D Dorian', mode: 'dorian', voice: 'glass', progression: [0, 5, 3, 4, 0, 2, 5, 4], motif: [0, 4, 2, -1, 6, 4, 1, -1], pulse: 2, percussion: .2 },
  { id: 'garden', title: '遺園微風', bpm: 76, root: 55, key: 'G Major', mode: 'major', voice: 'wood', progression: [0, 3, 4, 0, 5, 3, 1, 4], motif: [2, 4, 6, 4, 1, 3, 2, 0], pulse: 4, percussion: .35 },
  { id: 'roots', title: '倒生枝蔓', bpm: 68, root: 52, key: 'E Minor', mode: 'minor', voice: 'reed', progression: [0, 5, 2, 6, 0, 3, 5, 4], motif: [4, 2, -1, 0, 1, 3, -1, 2], pulse: 2, percussion: .5 },
  { id: 'echo', title: '晶礦回聲', bpm: 56, root: 54, key: 'F# Minor', mode: 'minor', voice: 'bell', progression: [0, 2, 5, 3, 0, 6, 3, 4], motif: [0, -1, 6, 4, -1, 2, 4, -1], pulse: 2, percussion: .1 },
  { id: 'library', title: '無聲的書頁', bpm: 64, root: 47, key: 'B Minor', mode: 'minor', voice: 'felt', progression: [0, 3, 6, 2, 5, 3, 1, 4], motif: [2, 1, 0, -1, 4, 3, 2, -1], pulse: 2, percussion: .15 },
  { id: 'mist', title: '霧中旅人', bpm: 58, root: 50, key: 'D Minor', mode: 'minor', voice: 'air', progression: [0, 6, 5, 3, 0, 2, 5, 4], motif: [4, -1, 2, 1, -1, 0, 3, -1], pulse: 1, percussion: .08 },
  { id: 'frost', title: '霜階星芒', bpm: 62, root: 57, key: 'A Lydian', mode: 'lydian', voice: 'chime', progression: [0, 1, 4, 2, 0, 5, 1, 4], motif: [6, 4, -1, 2, 3, -1, 1, 0], pulse: 2, percussion: .12 },
  { id: 'clockwork', title: '齒輪小徑', bpm: 80, root: 48, key: 'C Minor', mode: 'minor', voice: 'pluck', progression: [0, 4, 5, 3, 0, 2, 1, 4], motif: [0, 2, 4, 2, 6, 3, 4, 1], pulse: 4, percussion: .65 },
  { id: 'furnace', title: '不熄的爐火', bpm: 72, root: 49, key: 'C# Phrygian', mode: 'phrygian', voice: 'brass', progression: [0, 1, 5, 3, 0, 6, 1, 4], motif: [0, -1, 4, 3, 1, 0, -1, 4], pulse: 2, percussion: .75 },
  { id: 'heart', title: '黎明歸途', bpm: 66, root: 53, key: 'F Major', mode: 'major', voice: 'warm', progression: [0, 5, 3, 4, 2, 5, 3, 0], motif: [0, 2, 4, 6, 5, 3, 2, 0], pulse: 2, percussion: .35 },
  { id: 'combat', title: '守護歸途', bpm: 112, bars: 12, root: 52, key: 'E Dorian', mode: 'dorian', voice: 'mallet', progression: [0, 0, 3, 4, 0, 5, 3, 4, 2, 5, 1, 4], motif: [0, 0, 4, 2, 6, 4, 3, 1], pulse: 4, percussion: 1, combat: true },
];

function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${program}: ${result.error?.message || result.stderr || result.status}`);
  return result.stdout;
}
function random(seed) { return () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296; }
function frequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }
function degree(track, note) {
  const scale = MODES[track.mode];
  return track.root + scale[((note % 7) + 7) % 7] + 12 * Math.floor(note / 7);
}
function tone(voice, phase, t) {
  const fundamental = Math.sin(phase);
  switch (voice) {
    case 'glass': return fundamental + .18 * Math.sin(phase * 2) * Math.exp(-t * 2) + .035 * Math.sin(phase * 3);
    case 'wood': return fundamental + .27 * Math.sin(phase * 2) * Math.exp(-t * 10) + .08 * Math.sin(phase * 3) * Math.exp(-t * 6);
    case 'reed': return fundamental + .2 * Math.sin(phase * 3) + .035 * Math.sin(phase * 5);
    case 'bell': return fundamental + .24 * Math.sin(phase * 2.003) * Math.exp(-t * 3) + .05 * Math.sin(phase * 3.998) * Math.exp(-t * 5);
    case 'felt': return fundamental + .22 * Math.sin(phase * 2) * Math.exp(-t * 4) + .08 * Math.sin(phase * 3) * Math.exp(-t * 7);
    case 'air': return fundamental + .1 * Math.sin(phase * 2 + .25 * Math.sin(t * 3));
    case 'chime': return fundamental + .2 * Math.sin(phase * 3) * Math.exp(-t * 5);
    case 'pluck': return fundamental + .3 * Math.sin(phase * 2) * Math.exp(-t * 9) + .09 * Math.sin(phase * 4) * Math.exp(-t * 14);
    case 'brass': return fundamental + .26 * Math.sin(phase * 2) + .12 * Math.sin(phase * 3) * (1 - Math.exp(-t * 6));
    case 'warm': return fundamental + .15 * Math.sin(phase * 2) + .06 * Math.sin(phase * 3);
    case 'mallet': return fundamental + .35 * Math.sin(phase * 2) * Math.exp(-t * 12) + .1 * Math.sin(phase * 3) * Math.exp(-t * 8);
    case 'bass': return fundamental + .12 * Math.sin(phase * 2);
    default: return fundamental + .1 * Math.sin(phase * 2);
  }
}

function synthesize(track, trackIndex) {
  const beat = 60 / track.bpm, bars = track.bars || 8;
  const frames = Math.round(bars * 4 * beat * RATE);
  const left = new Float32Array(frames), right = new Float32Array(frames);
  const noise = random(0x51d728 + trackIndex * 719);
  let events = 0;
  function add(start, duration, midi, voice, gain, pan = 0, attack = .025, release = .32) {
    events++;
    const offset = Math.round(start * RATE), count = Math.ceil((duration + release) * RATE);
    const hz = frequency(midi), l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < count; i++) {
      const t = i / RATE;
      const onset = Math.min(1, t / attack);
      const tail = t < duration ? 1 : Math.max(0, 1 - (t - duration) / release);
      const envelope = Math.sin(onset * Math.PI / 2) ** 2 * tail ** 2;
      const decay = ['wood', 'felt', 'pluck', 'mallet', 'bell', 'chime'].includes(voice) ? .3 + .7 * Math.exp(-t * 2.6) : 1;
      const value = tone(voice, TAU * hz * t, t) * envelope * decay * gain;
      const index = (offset + i) % frames;
      left[index] += value * l; right[index] += value * r;
    }
  }
  function drum(start, kind, gain, pan = 0) {
    events++;
    const duration = kind === 'kick' ? .24 : .13, offset = Math.round(start * RATE);
    let low = 0;
    for (let i = 0; i < duration * RATE; i++) {
      const t = i / RATE, attack = Math.min(1, t / .004);
      const decay = Math.exp(-t * (kind === 'kick' ? 20 : 36));
      low = low * .84 + (noise() * 2 - 1) * .16;
      const value = (kind === 'kick' ? Math.sin(TAU * (52 * t + 34 * .025 * (1 - Math.exp(-t / .025)))) : low) * attack * decay * (1 - t / duration) ** 2 * gain;
      const index = (offset + i) % frames;
      left[index] += value * Math.sqrt((1 - pan) / 2); right[index] += value * Math.sqrt((1 + pan) / 2);
    }
  }
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * 4 * beat, chord = track.progression[bar % track.progression.length];
    // 慢起音的和弦墊底；高塔上層疏朗，下層加上更明確的低音與脈動。
    [0, 2, 4].forEach((interval, i) => add(start, 3.6 * beat, degree(track, chord + interval), 'pad', .048, (i - 1) * .48, .24, .7));
    add(start, 1.6 * beat, degree(track, chord) - 12, 'bass', .105, -.08, .035, .2);
    add(start + 2 * beat, 1.3 * beat, degree(track, chord + (bar % 2 ? 4 : 0)) - 12, 'bass', .075, .08, .035, .18);
    const arp = track.pulse;
    for (let tick = 0; tick < arp * 2; tick++) {
      const chordNote = [0, 4, 2, 6][(tick + bar) % 4];
      add(start + tick * 2 * beat / arp, .22 * beat, degree(track, chord + chordNote) + 12, 'felt', .034, tick % 2 ? .38 : -.38, .015, .22);
    }
    for (let pulse = 0; pulse < 4; pulse++) {
      const motif = track.motif[(bar * 3 + pulse * 2) % track.motif.length];
      if (motif < 0 || (track.id === 'mist' && pulse % 2)) continue;
      const note = degree(track, chord + motif) + (['furnace', 'combat'].includes(track.id) ? 0 : 12);
      add(start + (pulse + (bar % 2 ? .125 : 0)) * beat, (pulse === 3 ? .55 : .7) * beat, note, track.voice, .077, pulse % 2 ? .18 : -.18, track.id === 'mist' ? .1 : .025, .38);
    }
    drum(start, 'kick', .11 * track.percussion);
    drum(start + 2 * beat, 'kick', .08 * track.percussion);
    drum(start + beat, 'brush', .12 * track.percussion, -.28);
    drum(start + 3 * beat, 'brush', .1 * track.percussion, .28);
    if (track.combat || track.id === 'clockwork') for (let step = 0; step < 8; step++) drum(start + (step + .5) * beat / 2, 'brush', .045, step % 2 ? .45 : -.45);
  }
  const mixedL = new Float32Array(frames), mixedR = new Float32Array(frames);
  const taps = [Math.round(.137 * RATE), Math.round(.283 * RATE), Math.round(.419 * RATE), Math.round(.613 * RATE)];
  let sumL = 0, sumR = 0;
  for (let i = 0; i < frames; i++) {
    let a = left[i], b = right[i];
    taps.forEach((offset, n) => { const index = (i - offset + frames) % frames, gain = .14 / (n + 1); a += right[index] * gain; b += left[index] * gain; });
    mixedL[i] = Math.tanh(a * 1.5); mixedR[i] = Math.tanh(b * 1.5); sumL += mixedL[i]; sumR += mixedR[i];
  }
  const meanL = sumL / frames, meanR = sumR / frames;
  let maximum = 0;
  for (let i = 0; i < frames; i++) maximum = Math.max(maximum, Math.abs(mixedL[i] - meanL), Math.abs(mixedR[i] - meanR));
  const gain = .68 / maximum;
  const pcm = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++) {
    mixedL[i] = (mixedL[i] - meanL) * gain; mixedR[i] = (mixedR[i] - meanR) * gain;
    pcm.writeInt16LE(Math.round(mixedL[i] * 32767), i * 4); pcm.writeInt16LE(Math.round(mixedR[i] * 32767), i * 4 + 2);
  }
  const seam = Math.max(Math.abs(mixedL[0] - mixedL.at(-1)), Math.abs(mixedR[0] - mixedR.at(-1)));
  assert.ok(seam < .04, `${track.id} 循環接縫過大：${seam}`);
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return { wave: Buffer.concat([header, pcm]), frames, events, seam };
}

async function inspect(track, scratch) {
  const path = join(OUT, track.id + '.m4a');
  const decodedPath = join(scratch, track.id + '-decoded.wav');
  command('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEF32@' + RATE, path, decodedPath]);
  const wave = await readFile(decodedPath);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
  let decoded = null;
  for (let offset = 12; offset + 8 <= wave.length;) {
    const kind = wave.toString('ascii', offset, offset + 4), size = wave.readUInt32LE(offset + 4);
    if (kind === 'data') { decoded = wave.subarray(offset + 8, offset + 8 + size); break; }
    offset += 8 + size + (size % 2);
  }
  assert.ok(decoded && decoded.length > 0, '解碼音檔必須有有效波形');
  let peak = 0, power = 0, mean = 0;
  for (let i = 0; i < decoded.length; i += 4) { const value = decoded.readFloatLE(i); peak = Math.max(peak, Math.abs(value)); power += value * value; mean += value; }
  const samples = decoded.length / 4, duration = samples / 2 / RATE;
  const bytes = (await stat(path)).size;
  const rms = Math.sqrt(power / samples);
  assert.ok(duration >= 24 && duration <= 40, `${track.id} 時長超出預算`);
  assert.ok(bytes <= MAX_TRACK_BYTES, `${track.id} 檔案超過 500KB`);
  assert.ok(peak < .85 && rms > .035, `${track.id} 音量或峰值不合格：${peak} / ${rms}`);
  assert.ok(Math.abs(mean / samples) < .003, `${track.id} 直流偏移過大`);
  const seam = Math.max(Math.abs(decoded.readFloatLE(0) - decoded.readFloatLE(decoded.length - 8)), Math.abs(decoded.readFloatLE(4) - decoded.readFloatLE(decoded.length - 4)));
  assert.ok(seam < .06, `${track.id} 壓縮後循環接縫過大：${seam}`);
  return { id: track.id, title: track.title, file: 'assets/music/' + track.id + '.m4a', seconds: Number(duration.toFixed(3)), bpm: track.bpm, key: track.key, voice: track.voice, bytes, peak: Number(peak.toFixed(6)), rms: Number(rms.toFixed(6)), seam: Number(seam.toFixed(6)), sha256: createHash('sha256').update(await readFile(path)).digest('hex') };
}

await mkdir(OUT, { recursive: true });
const checkOnly = process.argv.includes('--check');
const scratch = await mkdtemp(join(tmpdir(), 'maze-original-score-'));
try {
  const metadata = [];
  for (const [index, track] of TRACKS.entries()) {
    if (!checkOnly) {
      const synthesized = synthesize(track, index);
      const wavePath = join(scratch, track.id + '.wav');
      await writeFile(wavePath, synthesized.wave);
      command('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac ', '-b', '64000', '-q', '127', wavePath, join(OUT, track.id + '.m4a')]);
    }
    metadata.push(await inspect(track, scratch));
  }
  const totalBytes = metadata.reduce((sum, track) => sum + track.bytes, 0);
  assert.ok(totalBytes < MAX_TOTAL_BYTES, `總音樂超過 3MB：${totalBytes}`);
  assert.equal(new Set(metadata.map(track => track.sha256)).size, 11, '每首必須是獨立創作');
  console.log(JSON.stringify({ sampleRate: RATE, channels: 2, bitrate: 64000, tracks: metadata, totalBytes, allChecksPassed: true }, null, 2));
} finally {
  // 僅移除本次 mkdtemp 產出的離線母帶，不會刪除使用者目錄或已發布資產。
  if (scratch) await rm(scratch, { recursive: true, force: true });
}
