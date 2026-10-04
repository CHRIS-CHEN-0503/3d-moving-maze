// Three original local audition cues. Never replaces music, samples or saves.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import summit from './orchestra-scores/summit.mjs';
import boss from './orchestra-scores/boss.mjs';
import camp from './orchestra-scores/camp.mjs';

export const scores=[summit,boss,camp];
export function validate(score){
  const duration=score.bars*score.beatsPerBar*60/score.bpm+score.tail,desks=new Set(score.desks.map(p=>p.id));
  assert.ok(duration>=45&&duration<=60);assert.ok(score.bpm>=60&&score.bpm<=160);assert.equal(score.beatsPerBar,4);
  assert.equal(desks.size,score.desks.length);assert.ok(score.desks.length>=4&&score.desks.length<=6);
  for(const p of score.desks){assert.ok(['violins','violas','celli','flute','horn','clarinet'].includes(p.id));assert.ok(p.gain>=-28&&p.gain<=-8&&Math.abs(p.pan)<=1);}
  for(const n of score.notes){assert.ok(desks.has(n.desk));assert.ok([n.beat,n.length,n.key,n.velocity].every(Number.isFinite));assert.ok(n.beat>=0&&n.length>0&&n.beat+n.length<=score.bars*4+.001);assert.ok(Number.isInteger(n.key)&&n.key>=0&&n.key<=127&&Number.isInteger(n.velocity)&&n.velocity>0&&n.velocity<=127);}
  const lastOff=new Map();for(const n of [...score.notes].sort((a,b)=>a.beat-b.beat)){const key=n.desk+'-'+n.key;assert.ok((lastOff.get(key)??-1)<=n.beat+.00001,'overlapping same-key notes can truncate a sampled phrase');lastOff.set(key,n.beat+n.length);}
  for(const c of score.controls){assert.ok(desks.has(c.desk));assert.equal(c.controller,11);assert.ok(c.beat>=0&&c.beat<=score.bars*4&&Number.isInteger(c.value)&&c.value>=0&&c.value<=127);}
  for(const p of score.percussion){assert.ok(['timpani','tom','snare','cymbal','shaker','bell'].includes(p.type));assert.ok(Number.isFinite(p.beat)&&p.beat>=0&&p.beat<=score.bars*4&&p.gain>0&&p.gain<=.16);if(p.pitch!==undefined)assert.ok(Number.isFinite(p.pitch)&&p.pitch>=30&&p.pitch<=3000);}
  let next=0;for(const s of score.sections){assert.equal(s.fromBar,next);assert.ok(s.toBar>s.fromBar&&s.toBar<=score.bars);next=s.toBar;}assert.equal(next,score.bars);
  const events=score.notes.flatMap(n=>[{beat:n.beat,delta:1},{beat:n.beat+n.length,delta:-1}]).sort((a,b)=>a.beat-b.beat||a.delta-b.delta);
  let active=0,maxPolyphony=0;for(const e of events){active+=e.delta;maxPolyphony=Math.max(maxPolyphony,active);}assert.equal(active,0);assert.ok(maxPolyphony<=40);
  return {id:score.id,title:score.title,seconds:duration,bpm:score.bpm,notes:score.notes.length,percussion:score.percussion.length,maxPolyphony};
}
function command(program,args,{timeout=90000,binary=false}={}){
  const r=spawnSync(program,args,{encoding:binary?null:'utf8',timeout,maxBuffer:100*1024*1024});
  if(r.error||r.status!==0)throw Error(String(r.error||r.stderr||r.status));return r.stdout;
}
export function parseLoudness(stderr){
  const match=stderr.match(/\{\s*"input_i"[\s\S]*?\}/);assert.ok(match,'missing loudness measurements');
  const levels=JSON.parse(match[0]);
  // normalization_type is descriptive text, not a measured level.
  assert.ok(['input_i','input_tp','input_lra','input_thresh','target_offset'].every(key=>levels[key]!==undefined&&levels[key]!==''&&Number.isFinite(Number(levels[key]))),'invalid measured loudness');
  return levels;
}
function measureLoudness(ffmpeg,input){
  const meter=spawnSync(ffmpeg,['-hide_banner','-nostdin','-i',input,'-af','loudnorm=I=-18:TP=-2:LRA=10:print_format=json','-f','null','-'],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
  assert.equal(meter.status,0,String(meter.error||meter.stderr));return parseLoudness(meter.stderr);
}
export function analyse(pcm){
  assert.equal(pcm.length%8,0);const frames=pcm.length/8,windows=[];let peak=0,power=0,mean=0,l=0,r=0,cross=0;
  for(let i=0;i<frames;i++){
    const a=pcm.readFloatLE(i*8),b=pcm.readFloatLE(i*8+4);assert.ok(Number.isFinite(a)&&Number.isFinite(b));
    peak=Math.max(peak,Math.abs(a),Math.abs(b));power+=a*a+b*b;mean+=a+b;l+=a*a;r+=b*b;cross+=a*b;
  }
  for(let start=0;start<frames;start+=22050){let sum=0;const end=Math.min(frames,start+22050);for(let i=start;i<end;i++){const a=pcm.readFloatLE(i*8),b=pcm.readFloatLE(i*8+4);sum+=a*a+b*b;}windows.push(Math.sqrt(sum/((end-start)*2)));}
  return {frames,peak,rms:Math.sqrt(power/(frames*2)),mean:mean/(frames*2),leftRms:Math.sqrt(l/frames),rightRms:Math.sqrt(r/frames),stereoCorrelation:cross/Math.sqrt(l*r),halfSecondRms:windows};
}
// Original physical-style percussion: resonant membranes, filtered noise and
// inharmonic bells. No sampled drum file, pre-made loop or audio is extracted.
export function percussionMix(score,frames,sampleRate=44100){
  const left=new Float32Array(frames),right=new Float32Array(frames);
  let seed=0x5a31c9e7;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1;};
  for(const [index,hit]of score.percussion.entries()){
    const start=Math.round(hit.beat*60/score.bpm*sampleRate),ring={timpani:1.35,tom:.7,snare:.24,cymbal:1.65,shaker:.15,bell:2.8}[hit.type],count=Math.min(Math.ceil(ring*sampleRate),frames-start);
    const pitch=hit.pitch??({timpani:73.4,tom:110,bell:1174.66}[hit.type]??160),pan=hit.type==='cymbal'?.22:hit.type==='shaker'?-.18:(index%3-1)*.06;
    const lg=Math.sqrt((1-pan)/2),rg=Math.sqrt((1+pan)/2);let low=0,last=0;
    for(let i=0;i<count;i++){
      const t=i/sampleRate,noise=random();low+=.22*(noise-low);const high=noise-low,difference=high-last;last=high;let value=0;
      if(hit.type==='timpani'||hit.type==='tom'){
        const decay=hit.type==='timpani'?.43:.16,phase=2*Math.PI*pitch*(t+.012*(1-Math.exp(-t*36)));
        value=(Math.sin(phase)+.27*Math.sin(phase*2.71)*Math.exp(-t*6)+.12*Math.sin(phase*3.82)*Math.exp(-t*11))*Math.exp(-t/decay)+high*.20*Math.exp(-t*75);
      }else if(hit.type==='snare')value=(high*.77+.12*Math.sin(2*Math.PI*178*t)+.07*Math.sin(2*Math.PI*331*t))*Math.exp(-t/.057);
      else if(hit.type==='shaker')value=difference*.46*Math.exp(-t/.024);
      else if(hit.type==='cymbal')value=(high*.45+difference*.13+.10*Math.sin(2*Math.PI*1331*t)+.06*Math.sin(2*Math.PI*2297*t))*Math.exp(-t/.42);
      else value=(Math.sin(2*Math.PI*pitch*t)*Math.exp(-t/.75)+.26*Math.sin(2*Math.PI*pitch*2.01*t)*Math.exp(-t/.37)+.09*Math.sin(2*Math.PI*pitch*3.98*t)*Math.exp(-t/.22))*.58;
      value*=hit.gain*Math.min(1,t/.0015);left[start+i]+=value*lg;right[start+i]+=value*rg;
    }
  }
  // Three restrained room reflections keep the original percussion in the
  // hall rather than adding an unrelated dry electronic drum loop.
  const reflections=[[.047,.095],[.081,.064],[.127,.035]].map(([time,amount])=>[Math.round(time*sampleRate),amount]);
  for(let i=frames-1;i>=0;i--)for(const [delay,amount]of reflections){
    const prev=i-delay;if(prev>=0){left[i]+=right[prev]*amount;right[i]+=left[prev]*amount;}
  }
  return {left,right};
}
function wav(pcm){const b=Buffer.alloc(44+pcm.length);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(2,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(44100*8,28);b.writeUInt16LE(8,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);pcm.copy(b,44);return b;}
const sha=b=>createHash('sha256').update(b).digest('hex');
async function protectedHashes(){return Object.fromEntries(await Promise.all(['index.html','package.json','assets/classic-audio.js','assets/voice-pack.js','story/tower-audio.js','story/tower-mode.js'].map(async f=>[f,sha(await readFile(new URL('../'+f,import.meta.url)))])));}
async function main(){
  const args=process.argv.slice(2),out=resolve(args.find(a=>!a.startsWith('--'))||'.agent-run/scene-orchestra-previews');
  assert.ok(out.startsWith(resolve('.agent-run')+'/'));await mkdir(out,{recursive:true});
  if(args.includes('--validate-only')){console.log(JSON.stringify(scores.map(validate)));return;}
  const protectedBefore=await protectedHashes(),report={pass:false,localOnly:true,officialMusicChanged:false,sourceSamplesRedistributed:false,tracks:[],protectedBefore,limitations:['Sample-based original arrangements with original procedural percussion, not live orchestra recordings.','Signal and file checks do not claim a human subjective listening review.','Only preview files are created in the ignored local evidence folder; nothing is deployed.']};
  const ffmpeg='/opt/homebrew/bin/ffmpeg',ffprobe='/opt/homebrew/bin/ffprobe';
  try{for(const score of scores){
    const summary=validate(score),scorePath=out+'/'+score.id+'-score.json';await writeFile(scorePath,JSON.stringify(score,null,2));console.log('Rendering '+score.title+' '+summary.seconds.toFixed(2)+' seconds');
    command('/usr/bin/swift',[fileURLToPath(new URL('./render-scene-orchestral-preview.swift',import.meta.url)),scorePath,out],{timeout:210000});
    const receipt=JSON.parse(await readFile(out+'/'+score.id+'-render-receipt.json','utf8')),raw=out+'/'+score.id+'-orchestra.wav',source=await readFile(raw);
    assert.equal(source.toString('ascii',0,4),'RIFF');assert.ok(source.readUInt32LE(4)>44&&source.readUInt32LE(4)<source.length);
    const pcm=command(ffmpeg,['-v','error','-nostdin','-i',raw,'-f','f32le','-ac','2','-ar','44100','pipe:1'],{binary:true}),rawStats=analyse(pcm),drums=percussionMix(score,rawStats.frames);
    assert.ok(rawStats.rms>.0001&&rawStats.peak<.98);const orchestraGain=Math.min(32,.075/rawStats.rms),mixed=Buffer.alloc(pcm.length);
    let mixPeak=0;for(let i=0;i<rawStats.frames;i++)for(let c=0;c<2;c++){const fade=Math.min(1,i/44100/.03)*Math.min(1,(rawStats.frames-i)/44100/2),value=pcm.readFloatLE(i*8+c*4)*orchestraGain+(c?drums.right[i]:drums.left[i])*fade;assert.ok(Number.isFinite(value));mixed.writeFloatLE(value,i*8+c*4);mixPeak=Math.max(mixPeak,Math.abs(value));}
    assert.ok(mixPeak<.98,'room mix must preserve unclipped headroom');const mixPath=out+'/'+score.id+'-mix.wav';await writeFile(mixPath,wav(mixed));
    // ffmpeg's loudness measurement is on stderr; capture that bounded JSON
    // explicitly, then apply measured (two-pass) mastering.
    const levels=measureLoudness(ffmpeg,mixPath);
    const mp3=out+'/'+score.filename,filter=`loudnorm=I=-18:TP=-2:LRA=10:measured_I=${levels.input_i}:measured_TP=${levels.input_tp}:measured_LRA=${levels.input_lra}:measured_thresh=${levels.input_thresh}:offset=${levels.target_offset}:linear=true`;
    command(ffmpeg,['-v','error','-nostdin','-y','-i',mixPath,'-af',filter,'-ar','44100','-codec:a','libmp3lame','-b:a','192k',mp3]);
    const probe=JSON.parse(command(ffprobe,['-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels','-of','json',mp3]));assert.equal(probe.streams.length,1);assert.equal(probe.streams[0].codec_name,'mp3');assert.equal(probe.streams[0].sample_rate,'44100');assert.equal(probe.streams[0].channels,2);assert.ok(Math.abs(Number(probe.format.duration)-summary.seconds)<.1);
    const decoded=command(ffmpeg,['-v','error','-nostdin','-i',mp3,'-f','f32le','-ac','2','-ar','44100','pipe:1'],{binary:true}),stats=analyse(decoded);
    assert.ok(stats.peak>.1&&stats.peak<.90);assert.ok(stats.rms>.04&&stats.rms<.22);assert.ok(Math.abs(stats.mean)<.005);assert.ok(stats.leftRms/stats.rightRms>.5&&stats.leftRms/stats.rightRms<2);assert.ok(stats.stereoCorrelation<.9999);assert.ok(stats.halfSecondRms.at(-1)<stats.rms*.2);
    const finalLevels=measureLoudness(ffmpeg,mp3);
    assert.ok(Math.abs(Number(finalLevels.input_i)+18)<=.6,'encoded MP3 loudness must match the audition target');assert.ok(Number(finalLevels.input_tp)<=-1.5,'encoded MP3 must retain true-peak headroom');
    const bytes=await readFile(mp3),row={...summary,filename:score.filename,file:mp3,bytes:bytes.length,sha256:sha(bytes),scoreSha256:sha(await readFile(scorePath)),description:score.description,sections:score.sections,render:receipt,rawSignal:rawStats,orchestraGain,mixPeak,mastering:{targetIntegratedLufs:-18,targetTruePeakDb:-2,preMasterMeasurement:levels,encodedMp3Measurement:finalLevels},decodedSignal:stats,seconds:Number(probe.format.duration)};
    report.tracks.push(row);await writeFile(out+'/'+score.id+'-report.json',JSON.stringify(row,null,2));console.log('Verified '+score.id+' '+row.seconds.toFixed(2)+'s, peak '+stats.peak.toFixed(3));
  }
  report.protectedAfter=await protectedHashes();assert.deepEqual(report.protectedAfter,protectedBefore);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cards=report.tracks.map(t=>`<article><h2>${escape(t.title)}</h2><p>${escape(t.description)}</p><small>${t.seconds.toFixed(1)} 秒 · ${t.bpm} 拍 · 原創管弦取樣編曲</small><audio controls preload="none" src="${encodeURIComponent(basename(t.file))}"></audio><a href="${encodeURIComponent(basename(t.file))}" download>下載試聽</a></article>`).join('');
  await writeFile(out+'/index.html',`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>三場景配樂試聽</title><style>*{box-sizing:border-box}body{margin:0;background:#111f2d;color:#f5e6c7;font:17px system-ui,sans-serif}main{max-width:900px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:23px;margin:0}p{line-height:1.65;color:#bed0db}article{background:#1b3040;border:1px solid #526a79;border-radius:18px;padding:22px;margin:20px 0}small{display:block;color:#dbc79b}audio{display:block;width:100%;margin:20px 0 15px}a{color:#d9c194}footer{color:#a5bccd;font-size:14px;line-height:1.6}@media(max-width:480px){main{padding:14px}article{padding:18px}}</style><main><h1>三場景配樂試聽</h1><p>雲頂探索、刺激鼓動的樓主戰與營地休息。先確認風格；不自動播放，尚未替換正式遊戲音樂。</p>${cards}<footer>使用已安裝管弦樂器取樣及原創合成打擊編曲，不是真人樂團錄音；未散布原始取樣。音量與檔案已檢查，聽感仍請實際試聽確認。<br>取樣條款參考：<a href="https://www.apple.com/legal/sla/docs/LogicPro.pdf">Logic Pro</a>、<a href="https://www.apple.com/legal/sla/docs/GarageBand.pdf">GarageBand</a></footer></main></html>`);
  report.pass=true; // Success includes the completed, usable preview page.
  }catch(error){report.pass=false;report.failure=error.stack;throw error;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
  console.log(JSON.stringify({pass:report.pass,tracks:report.tracks.map(t=>({title:t.title,file:t.file,seconds:t.seconds,bpm:t.bpm})),officialMusicChanged:false,report:out+'/report.json'}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
