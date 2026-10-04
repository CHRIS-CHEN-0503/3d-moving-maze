// Turn approved original audition mixes into bounded, continuous game loops.
// Complete authored recordings only; never copies an instrument sample/library.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scores,analyse,parseLoudness} from './render-scene-orchestral-previews.mjs';

export function foldTail(pcm,frames){
  assert.ok(Number.isInteger(frames)&&frames>0&&frames*8<=pcm.length);
  assert.equal(pcm.length%8,0);const out=Buffer.from(pcm.subarray(0,frames*8));
  // The four-second natural release belongs to the preceding phrase. Fold it
  // into the next phrase, preserving a whole-bar period rather than chopping
  // beats for an arbitrary crossfade or repeating the audition's silent tail.
  for(let offset=frames*8;offset<pcm.length;offset+=4){
    const target=(offset-frames*8)%out.length;
    const value=out.readFloatLE(target)+pcm.readFloatLE(offset);
    assert.ok(Number.isFinite(value));out.writeFloatLE(value,target);
  }
  return out;
}
function wav(pcm){const b=Buffer.alloc(44+pcm.length);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(2,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(352800,28);b.writeUInt16LE(8,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);pcm.copy(b,44);return b;}
function command(program,args,binary=false){const r=spawnSync(program,args,{encoding:binary?null:'utf8',timeout:60000,maxBuffer:60*1024*1024});if(r.error||r.status!==0)throw Error(String(r.error||r.stderr||r.status));return r.stdout;}
function meter(file){const r=spawnSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-nostdin','-i',file,'-af','loudnorm=I=-18:TP=-2:LRA=10:print_format=json','-f','null','-'],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});assert.equal(r.status,0,String(r.error||r.stderr));return parseLoudness(r.stderr);}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
  const source=resolve(process.argv[2]||'.agent-run/scene-orchestra-previews-audition-20261005'),out=resolve('.agent-run/orchestra-game-assets-v1577');
  assert.ok(source.startsWith(resolve('.agent-run')+'/'));await mkdir(out,{recursive:true});
  const audition=JSON.parse(await readFile(source+'/report.json','utf8'));assert.equal(audition.pass,true);
  const manifest={version:1,originalScore:true,sourceSamplesRedistributed:false,description:'原創管弦取樣編曲與原創合成打擊；完整編曲，非真人樂團錄音。',licenseReferences:['https://www.apple.com/legal/sla/docs/LogicPro.pdf','https://www.apple.com/legal/sla/docs/GarageBand.pdf'],tracks:[]};
  const ffmpeg='/opt/homebrew/bin/ffmpeg';
  for(const score of scores){
    const pcm=command(ffmpeg,['-v','error','-nostdin','-i',source+'/'+score.id+'-mix.wav','-f','f32le','-ac','2','-ar','44100','pipe:1'],true);
    const frames=Math.round(score.bars*4*60/score.bpm*44100),loop=foldTail(pcm,frames);
    // A three-millisecond zero-crossing guard also survives AAC's boundary
    // reconstruction; it does not shorten a beat or add an audible pause.
    const guardFrames=Math.round(.003*44100);
    for(let i=0;i<guardFrames;i++)for(let c=0;c<2;c++)for(const frame of [i,frames-1-i]){const index=frame*8+c*4;loop.writeFloatLE(loop.readFloatLE(index)*Math.sin(i/guardFrames*Math.PI/2)**2,index);}
    const stats=analyse(loop);
    assert.ok(stats.peak>0&&stats.peak<.98);const path=out+'/'+score.id+'-loop.wav';await writeFile(path,wav(loop));
    const levels=meter(path),filename='orchestra-'+score.id+'.m4a';
    const filter=`loudnorm=I=-18:TP=-2:LRA=10:measured_I=${levels.input_i}:measured_TP=${levels.input_tp}:measured_LRA=${levels.input_lra}:measured_thresh=${levels.input_thresh}:offset=${levels.target_offset}:linear=true`;
    command(ffmpeg,['-v','error','-nostdin','-y','-i',path,'-af',filter,'-ar','44100','-ac','2','-c:a','aac','-b:a','128k','-movflags','+faststart',resolve('assets/music/'+filename)]);
    const final=resolve('assets/music/'+filename),bytes=await readFile(final),decoded=command(ffmpeg,['-v','error','-nostdin','-i',final,'-f','f32le','-ac','2','-ar','44100','pipe:1'],true),signal=analyse(decoded),loudness=meter(final);
    assert.ok(signal.frames>=frames&&signal.frames-frames<=2048);assert.ok(Math.abs(Number(loudness.input_i)+18)<=.6);assert.ok(Number(loudness.input_tp)<=-1.5);
    let seamDelta=0;for(let c=0;c<2;c++)seamDelta=Math.max(seamDelta,Math.abs(decoded.readFloatLE(c*4)-decoded.readFloatLE((frames-1)*8+c*4)));
    assert.ok(seamDelta<.015,'native AAC loop seam has no large waveform jump');
    // No final audition fade/silence: the last half second keeps audible power.
    assert.ok(signal.halfSecondRms.at(-2)>.003,'loop must not repeat a silent audition tail');
    const track={id:score.id,title:score.title,file:'assets/music/'+filename,bpm:score.bpm,bars:score.bars,sampleRate:44100,channels:2,frames,loopStart:0,loopEnd:frames/44100,bytes:bytes.length,sha256:sha(bytes),integratedLoudness:Number(loudness.input_i),truePeakDb:Number(loudness.input_tp),seamDelta};
    manifest.tracks.push(track);await writeFile(out+'/'+score.id+'-report.json',JSON.stringify({track,signal,loudness,loopMethod:'Natural release folded into the next whole-bar phrase; no silent four-second audition tail',originalAuditionSha256:audition.tracks.find(t=>t.id===score.id).sha256},null,2));
    console.log(JSON.stringify(track));
  }
  await writeFile('assets/music/orchestra-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  await writeFile(out+'/report.json',JSON.stringify({pass:true,manifest,localEvidence:out},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
