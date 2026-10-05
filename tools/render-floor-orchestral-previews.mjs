// All remaining story environments: audition only, no game integration.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {floorScores} from './orchestra-scores/floor-scenes.mjs';
import {renderAuditions,validate} from './render-scene-orchestral-previews.mjs';
import {continuity} from './render-legato-orchestral-previews.mjs';
const require=createRequire(import.meta.url),narrative=require('../story/tower-narrative.js'),materials=require('../story/tower-materials.js');
export {floorScores};
export function validateFloorScores(selected=floorScores){
  const chapters=narrative.allChapters().filter(c=>c.id!=='summoning');
  assert.deepEqual(selected.map(s=>s.chapterId),chapters.map(c=>c.id),'cover every remaining surface and underground chapter exactly once');
  return selected.map(score=>{
    const chapter=chapters.find(c=>c.id===score.chapterId),region=materials.ECOLOGIES.find(e=>e.id===score.chapterId);
    assert.deepEqual(score.floorRange,[chapter.high,chapter.low]);assert.equal(score.regionName,region.name);
    assert.equal(score.underground,chapter.high<0);assert.equal(score.id,score.chapterId.replace(':','-'));
    assert.equal(score.revision,'floor-audition');assert.ok(!['summit','boss','camp'].includes(score.id));
    return {...validate(score),chapterId:score.chapterId,regionName:score.regionName,floorRange:score.floorRange};
  });
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const range=score=>score.underground?'地下 '+(-score.floorRange[0])+'～'+(-score.floorRange[1])+' 層':score.floorRange[0]+'～'+score.floorRange[1]+' 樓';
export function previewPage(tracks){
  assert.equal(tracks.length,14);
  const sections=[false,true].map(underground=>`<section id="${underground?'underground':'surface'}"><h2>${underground?'地下續篇 · 五個區域':'地上篇 · 九個區域'}</h2><div class="tracks">${tracks.filter(t=>t.underground===underground).map(t=>`<article style="--accent:${escape(t.color)}"><small>${escape(t.regionName)} · ${range(t)}</small><h3>${escape(t.title)}</h3><p>${escape(t.description)}</p><small>${t.seconds.toFixed(1)} 秒 · ${t.bpm} 拍</small><audio controls preload="none" src="${encodeURIComponent(t.filename)}"></audio><div class="links"><a href="${encodeURIComponent(t.filename)}" download>下載試聽</a><details><summary>編曲段落</summary><ol>${t.sections.map(s=>`<li>${escape(s.name)}：${escape(s.description)}</li>`).join('')}</ol></details></div></article>`).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>樓層風格配樂 · 14 首試聽</title><style>*{box-sizing:border-box}body{margin:0;background:#111c28;color:#f2e8d4;font:17px system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:24px}h1{font-size:clamp(25px,4vw,34px)}h2{font-size:25px;margin:34px 0 20px}h3{font-size:23px;line-height:1.4;margin:8px 0}p{color:#c0cfdb;line-height:1.7}nav{display:flex;gap:12px;flex-wrap:wrap}nav a{border:1px solid #697f92;padding:12px 20px;border-radius:12px;text-decoration:none;background:#263a4d}a{color:#e5ce9f}small{display:block;color:#b9c8d4;font-size:14px}article{border:1px solid #526679;border-top:3px solid var(--accent);background:#1c2d3d;border-radius:16px;padding:20px;min-width:0}article p{min-height:88px;margin:10px 0}.tracks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}audio{display:block;width:100%;height:54px;margin:16px 0}.links>a{display:inline-flex;min-height:44px;align-items:center}summary{padding:12px 0;cursor:pointer;min-height:44px}details{color:#aebfce;font-size:14px}ol{padding-left:20px;line-height:1.7}footer{font-size:14px;color:#aabcc9;line-height:1.7;margin-top:32px}@media(max-width:680px){main{padding:14px}.tracks{grid-template-columns:1fr}article{padding:18px}article p{min-height:0}h2{font-size:23px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}</style><main><h1>樓層風格配樂 · 14 首試聽</h1><p>按照地上九個區域與地下五個區域各自的環境與故事重新編曲。持續弦樂與完整旋律承接，不把每一拍拆成獨立聲響。<br>這些均為新版試聽，尚未替換正式遊戲音樂；已確認的雲頂、營地與樓主戰維持不變。</p><nav><a href="#surface">地上篇 9 首</a><a href="#underground">地下篇 5 首</a></nav>${sections}<footer>使用已安裝管弦樂器取樣製作的原創編曲，不是真人樂團錄音；未散布原始取樣。音量、峰值、連續振幅與播放介面已檢查，聽感仍請實際試聽。一次僅播放一首，播放其他曲目會暫停前一首。<br>取樣條款參考：<a href="https://www.apple.com/legal/sla/docs/LogicPro.pdf">Logic Pro</a>、<a href="https://www.apple.com/legal/sla/docs/GarageBand.pdf">GarageBand</a></footer></main><script>document.addEventListener('play',event=>{if(event.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(audio=>{if(audio!==event.target)audio.pause();});},true);</script></html>`;
}
async function main(){
  const args=process.argv.slice(2),summaries=validateFloorScores();
  if(args.includes('--validate-only')){console.log(JSON.stringify(summaries));return;}
  const out=resolve(args.find(a=>!a.startsWith('--'))||'.agent-run/floor-orchestra-previews-20261005');
  const report=await renderAuditions(floorScores,out,{pageTitle:'樓層風格配樂試聽',introduction:'地上與地下各區域的原創配樂；尚未替換正式遊戲音樂，請先試聽。'});
  report.pass=false;report.continuity=[];
  try{
    for(const score of floorScores){
      const track=report.tracks.find(t=>t.id===score.id),bytes=await readFile(track.file);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),track.sha256);
      Object.assign(track,{chapterId:score.chapterId,regionName:score.regionName,floorRange:score.floorRange,underground:score.underground,color:score.color,tonality:score.tonality});
      const result=spawnSync('/opt/homebrew/bin/ffmpeg',['-v','error','-nostdin','-i',track.file,'-f','f32le','-ac','2','-ar','44100','pipe:1'],{timeout:30000,maxBuffer:60*1024*1024});
      assert.equal(result.status,0,String(result.error||result.stderr));
      const flowing=continuity(result.stdout,{bodySeconds:score.bars*4*60/score.bpm});
      assert.ok(flowing.isolatedSixDbDrops<=2&&flowing.quietToMedian>.55,score.id+' must keep a continuous bed without isolated gaps');
      report.continuity.push({id:score.id,...flowing});
    }
    await writeFile(out+'/index.html',previewPage(report.tracks));
    report.pass=true;
  }catch(error){report.failure=error.stack;throw error;}
  finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
  console.log(JSON.stringify({pass:report.pass,tracks:report.tracks.length,officialMusicChanged:false,page:out+'/index.html',continuity:report.continuity.map(c=>({id:c.id,isolatedSixDbDrops:c.isolatedSixDbDrops,quietToMedian:c.quietToMedian}))}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
