// Export the exact in-game procedural sound for listening; no external samples.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const sound=createRequire(import.meta.url)('../assets/maze-stone-audio.js');
const samples=sound.render(),wav=Buffer.alloc(44+samples.length*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sound.RATE,24);wav.writeUInt32LE(sound.RATE*2,28);
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
// Match the existing effect bus (0.8) and master (0.9), without narration ducking.
samples.forEach((x,i)=>wav.writeInt16LE(Math.round(x*.8*.9*32767),44+i*2));
const dir=new URL('../.agent-run/',import.meta.url);await mkdir(dir,{recursive:true});
const file=new URL('maze-stone-shift.wav',dir);await writeFile(file,wav);console.log(file.pathname);
