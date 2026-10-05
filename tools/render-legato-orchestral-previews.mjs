// Local revisions only. Do not run the formal-asset finalizer for this audition.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {renderAuditions,validate} from './render-scene-orchestral-previews.mjs';
import summit from './orchestra-scores/summit-legato.mjs';
import camp from './orchestra-scores/camp-legato.mjs';
export const legatoScores=[summit,camp];

// A diagnostic, not a listening-quality score: 100ms amplitude contrast and
// isolated drops relative to neighbouring windows, excluding entry/tail fades.
export function continuity(pcm,{sampleRate=44100,bodySeconds=pcm.length/8/sampleRate}={}){
  assert.equal(pcm.length%8,0);assert.ok(Number.isFinite(sampleRate)&&sampleRate>0&&Number.isFinite(bodySeconds)&&bodySeconds>4);assert.ok(pcm.length/8/sampleRate>=bodySeconds-1/sampleRate);
  const frames=pcm.length/8,step=Math.round(sampleRate*.1),windows=[];
  for(let at=0;at<Math.min(frames,bodySeconds*sampleRate);at+=step){
    let power=0;const end=Math.min(at+step,frames);
    for(let i=at;i<end;i++){const l=pcm.readFloatLE(i*8),r=pcm.readFloatLE(i*8+4);assert.ok(Number.isFinite(l)&&Number.isFinite(r));power+=l*l+r*r;}
    windows.push(Math.sqrt(power/((end-at)*2)));
  }
  const inside=windows.slice(20,-20),sorted=[...inside].sort((a,b)=>a-b);
  const percentile=p=>sorted[Math.floor((sorted.length-1)*p)];
  const p10=percentile(.1),median=percentile(.5),p90=percentile(.9);
  let drops=0;for(let i=20;i<windows.length-20;i++){
    const neighbours=[...windows.slice(i-4,i),...windows.slice(i+1,i+5)].sort((a,b)=>a-b);
    if(windows[i]<neighbours[4]*.5)drops++;
  }
  return {windowSeconds:.1,interiorWindows:inside.length,p10,median,p90,contrastDb:p10>0?20*Math.log10(p90/p10):null,isolatedSixDbDrops:drops,quietToMedian:median>0?p10/median:null,limitation:'Amplitude diagnostics only; not subjective comfort, musicality or physical-device listening evidence.'};
}
function decode(file){const r=spawnSync('/opt/homebrew/bin/ffmpeg',['-v','error','-nostdin','-i',file,'-f','f32le','-ac','2','-ar','44100','pipe:1'],{timeout:30000,maxBuffer:60*1024*1024});assert.equal(r.status,0,String(r.error||r.stderr));return r.stdout;}
async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--validate-only')){console.log(JSON.stringify(legatoScores.map(validate)));return;}
  const out=resolve(args[0]||'.agent-run/legato-orchestra-previews-20261005');
  const report=await renderAuditions(legatoScores,out,{pageTitle:'雲頂與營地・連奏版試聽',introduction:'兩首改成持續弦樂鋪底、完整旋律樂句與平滑的音量變化。樓主戰保留不變；這是新版試聽，尚未替換正式遊戲音樂。'});
  report.pass=false;report.continuity=[];
  try{for(const score of legatoScores){
    const baseline=resolve('assets/music/orchestra-'+score.id+'.m4a'),candidate=out+'/'+score.filename;
    const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
    const bodySeconds=score.bars*4*60/score.bpm;
    report.continuity.push({id:score.id,baseline:{file:baseline,sha256:await hash(baseline),...continuity(decode(baseline),{bodySeconds})},candidate:{file:candidate,sha256:await hash(candidate),...continuity(decode(candidate),{bodySeconds})}});
  }report.pass=true;}catch(error){report.failure=error.stack;throw error;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
  console.log(JSON.stringify({pass:report.pass,officialMusicChanged:false,continuity:report.continuity}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
