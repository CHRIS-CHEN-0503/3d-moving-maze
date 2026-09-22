/* Decode every indexed recording and reject missing, silent or oversized clips. */
import {createRequire} from 'node:module';
import {stat,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pack=require('../assets/voice-pack.js'),exec=promisify(execFile);
const root=new URL('../',import.meta.url),all=[...new Set(Object.values(pack.tracks).map(t=>t.src))],report=[];
const files=process.argv.includes('--existing-only')?all.filter(src=>existsSync(new URL(src,root))):all;
let cursor=0;
async function worker(){
  while(cursor<files.length){
    const src=files[cursor++],path=fileURLToPath(new URL(src,root));
    const info=await stat(path);
    if(info.size<1000||info.size>700000)throw new Error(`音檔大小不符：${src}`);
    const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',path],{timeout:20000})).stdout);
    const stream=probe.streams[0],duration=Number(probe.format.duration);
    if(stream?.codec_name!=='mp3'||stream.channels!==1||stream.sample_rate!=='24000'||!(duration>.2&&duration<75))throw new Error(`音檔格式或時長不符：${src}`);
    const decoded=await exec('ffmpeg',['-nostdin','-hide_banner','-i',path,'-af','volumedetect','-f','null','-'],{timeout:30000,maxBuffer:100000});
    const peak=Number(decoded.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
    if(!Number.isFinite(peak)||peak< -30)throw new Error(`音檔疑似無聲：${src}`);
    report.push({src,bytes:info.size,duration,peakDb:peak});
  }
}
await Promise.all(Array.from({length:4},worker));
report.sort((a,b)=>a.src.localeCompare(b.src));
const summary={files:report.length,missingFiles:all.length-report.length,bytes:report.reduce((n,r)=>n+r.bytes,0),seconds:report.reduce((n,r)=>n+r.duration,0),longestSeconds:Math.max(...report.map(r=>r.duration))};
const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
if(output)await writeFile(output,JSON.stringify({summary,files:report},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
