// Local original-score preview only. Never writes deployed assets or libraries.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),out=resolve(args.find(a=>!a.startsWith('--'))||'.agent-run/summit-orchestra-preview');
assert.ok(out.startsWith(resolve('.agent-run')+'/'),'Preview output must stay in ignored local evidence directory');
await mkdir(out,{recursive:true});
function command(program,args,{timeout=45000,binary=false}={}){
  const r=spawnSync(program,args,{encoding:binary?null:'utf8',timeout,maxBuffer:40*1024*1024});
  if(r.error||r.status!==0)throw Error(String(r.error||r.stderr||r.status));
  return r.stdout;
}
if(!args.includes('--master-only'))command('/usr/bin/swift',[fileURLToPath(new URL('./render-summit-orchestral-preview.swift',import.meta.url)),out],{timeout:180000});
const raw=out+'/cloud-summit-orchestra-original.wav',mp3=out+'/雲海之門-管弦試聽.mp3';
const source=await readFile(raw);assert.equal(source.toString('ascii',0,4),'RIFF');
assert.ok(source.readUInt32LE(4)<source.length,'WAVE header finalized, not streaming/unfinished');
command('/opt/homebrew/bin/ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y','-i',raw,'-af','loudnorm=I=-18:TP=-1.5:LRA=11','-ar','44100','-codec:a','libmp3lame','-b:a','192k',mp3]);
const probe=JSON.parse(command('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels','-of','json',mp3]));
assert.equal(probe.streams.length,1);assert.equal(probe.streams[0].channels,2);assert.equal(probe.streams[0].sample_rate,'44100');assert.ok(Math.abs(Number(probe.format.duration)-40)<.03);
const pcm=command('/opt/homebrew/bin/ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-i',mp3,'-f','f32le','-acodec','pcm_f32le','pipe:1'],{binary:true});
let peak=0,power=0,mean=0;for(let i=0;i<pcm.length;i+=4){const v=pcm.readFloatLE(i);assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));power+=v*v;mean+=v;}
const samples=pcm.length/4,rms=Math.sqrt(power/samples);mean/=samples;
assert.ok(peak>.1&&peak<.89,'No clipping and audible master');assert.ok(rms>.04&&rms<.3,'Reasonable preview signal level');assert.ok(Math.abs(mean)<.005,'No strong DC offset');
const receipt=JSON.parse(await readFile(out+'/score-receipt.json','utf8')),encoded=await readFile(mp3);
const report={pass:true,title:receipt.title,seconds:Number(probe.format.duration),bytes:encoded.length,sampleRate:44100,channels:2,peak,rms,mean,sha256:createHash('sha256').update(encoded).digest('hex'),file:mp3,composition:receipt,officialMusicChanged:false,sourceSamplesRedistributed:false,listeningStatus:'Signal, codec and source checks passed; subjective orchestral tone to be reviewed by the listener, not represented as a live performance.'};
await writeFile(out+'/preview-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:true,file:mp3,seconds:report.seconds,bytes:report.bytes,peak,rms,sha256:report.sha256}));
