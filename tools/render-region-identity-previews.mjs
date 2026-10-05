// Local audition only; preserve the fourteen earlier auditions and all game music.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {renderAuditions,validate} from './render-scene-orchestral-previews.mjs';
import {identityScores} from './orchestra-scores/region-identities.mjs';
export {identityScores};
const require=createRequire(import.meta.url),narrative=require('../story/tower-narrative.js');
export function validateIdentities(){
  assert.deepEqual(identityScores.map(s=>s.chapterId),['garden','echo','clockwork']);
  return identityScores.map(score=>{const chapter=narrative.allChapters().find(c=>c.id===score.chapterId);assert.deepEqual(score.floorRange,[chapter.high,chapter.low]);return validate(score);});
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function identityPage(tracks){
  assert.equal(tracks.length,3);
  const cards=tracks.map(t=>`<article><header><small>${escape(t.regionName)} · ${t.floorRange[0]}～${t.floorRange[1]} 樓</small><h2>${escape(t.title)}</h2><p>${escape(t.description)}</p></header><div class="blind-label">曲目 ${tracks.indexOf(t)+1}</div><small>${t.seconds.toFixed(1)} 秒 · ${escape(t.style)} · ${t.beatsPerBar===3?'三拍舞曲':'四拍／自由樂句'}</small><audio controls preload="none" src="${encodeURIComponent(t.filename)}"></audio><a href="${encodeURIComponent(t.filename)}" download>下載試聽</a><details><summary>這一區的聲音記號</summary><p>${escape(t.signature)}</p></details></article>`).join('');
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>三區域 · 配樂辨識度重製</title><style>*{box-sizing:border-box}body{margin:0;background:#111f2d;color:#f3e5c9;font:17px system-ui,sans-serif}main{max-width:920px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:23px}p{color:#c0d0d9;line-height:1.65}article{padding:22px;border:1px solid #526a79;border-radius:18px;background:#1b3040;margin:20px 0}article:nth-of-type(1){border-left:5px solid #a9c17e}article:nth-of-type(2){border-left:5px solid #87cbdc}article:nth-of-type(3){border-left:5px solid #c9a168}small{display:block;color:#c9be9d}audio{display:block;width:100%;height:54px;margin:18px 0}button{font:inherit;min-height:44px;background:#284658;color:#f3e5c9;border:1px solid #7693a7;border-radius:10px;padding:10px 16px}a{color:#e1c895;display:inline-flex;min-height:44px;align-items:center}summary{padding:12px 0;cursor:pointer;min-height:44px}.blind-label{display:none;font-size:24px}.blind article header,.blind article>small,.blind article details{display:none}.blind .blind-label{display:block}footer{font-size:14px;color:#acbecb;line-height:1.6}@media(max-width:480px){main{padding:14px}article{padding:18px}}</style><main><h1>三區域 · 配樂辨識度重製</h1><p>這次不只換旋律：主奏音色、拍子、密度、回音空間與段落都拉開。可隱藏地區名稱，試著從開頭認出所在區域。<br>仍是試聽版，尚未替換正式遊戲音樂；先前十四首與已確認的雲頂、營地、樓主戰全部保留。</p><button id="blindToggle" type="button" aria-pressed="false">隱藏地區名稱試聽</button>${cards}<footer>使用本機已安裝樂器取樣及原創打擊編曲，不是真人樂團錄音，沒有散布原始取樣。檔案與音量已檢查；辨識度與聽感請以實際試聽判斷。</footer></main><script>document.addEventListener('play',event=>{if(event.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(audio=>{if(audio!==event.target)audio.pause();});},true);document.querySelector('#blindToggle').addEventListener('click',event=>{const blind=document.body.classList.toggle('blind');event.target.setAttribute('aria-pressed',String(blind));event.target.textContent=blind?'顯示地區名稱':'隱藏地區名稱試聽';});</script></html>`;
}
async function priorAuditions(){
  const out=resolve('.agent-run/floor-orchestra-previews-20261005'),report=JSON.parse(await readFile(out+'/report.json','utf8'));
  assert.equal(report.pass,true);assert.equal(report.tracks.length,14);
  const hash=async name=>createHash('sha256').update(await readFile(out+'/'+name)).digest('hex');
  return Object.fromEntries(await Promise.all(['index.html','report.json',...report.tracks.map(t=>t.filename)].map(async name=>[name,await hash(name)])));
}
async function main(){
  const args=process.argv.slice(2);validateIdentities();
  if(args.includes('--validate-only')){console.log(JSON.stringify(identityScores.map(validate)));return;}
  const out=resolve(args[0]||'.agent-run/region-identity-previews-20261005'),before=await priorAuditions();
  const report=await renderAuditions(identityScores,out,{pageTitle:'三區域・配樂辨識度重製',introduction:'以豎琴圓舞曲、晶音氛圍樂、機械撥弦進行曲拉開風格。尚未替換正式遊戲音樂。'});
  report.pass=false;
  try{
    for(const track of report.tracks){const score=identityScores.find(s=>s.id===track.id);Object.assign(track,{regionName:score.regionName,floorRange:score.floorRange,style:score.style,signature:score.signature,beatsPerBar:score.beatsPerBar});}
    report.priorAuditionsBefore=before;report.priorAuditionsAfter=await priorAuditions();assert.deepEqual(report.priorAuditionsAfter,before);
    await writeFile(out+'/index.html',identityPage(report.tracks));report.pass=true;
  }catch(error){report.failure=error.stack;throw error;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
  console.log(JSON.stringify({pass:report.pass,tracks:3,priorAuditionsUnchanged:14,officialMusicChanged:false,page:out+'/index.html'}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
