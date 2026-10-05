// Local auditions only. Three accepted recordings are copied, never re-rendered.
import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {renderAuditions,validate} from './render-scene-orchestral-previews.mjs';
import {identityScores} from './orchestra-scores/region-identities.mjs';
import {surfaceIdentityScores} from './orchestra-scores/surface-identities.mjs';
import {undergroundIdentityScores} from './orchestra-scores/underground-identities.mjs';
const require=createRequire(import.meta.url),narrative=require('../story/tower-narrative.js'),materials=require('../story/tower-materials.js');
const chapters=narrative.allChapters().filter(c=>c.id!=='summoning'),available=[...identityScores,...surfaceIdentityScores,...undergroundIdentityScores];
export const allIdentityScores=chapters.map(c=>available.find(s=>s.chapterId===c.id));
export const newIdentityScores=allIdentityScores.filter(s=>s&&!identityScores.includes(s));
export function validateAllIdentities(){
  assert.equal(allIdentityScores.length,14);assert.equal(newIdentityScores.length,11);assert.ok(allIdentityScores.every(Boolean));
  assert.equal(new Set(allIdentityScores.map(s=>s.id)).size,14);assert.equal(new Set(allIdentityScores.map(s=>s.filename)).size,14);
  return allIdentityScores.map((score,index)=>{
    const chapter=chapters[index],ecology=materials.ECOLOGIES.find(e=>e.id===score.chapterId);
    assert.deepEqual(score.floorRange,[chapter.high,chapter.low]);assert.equal(score.regionName,ecology.name);
    assert.equal(basename(score.filename),score.filename);return validate(score);
  });
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function allIdentityPage(tracks){
  assert.equal(tracks.length,14);
  const cards=rows=>rows.map(t=>`<article style="--region:${escape(t.colour||'#b8bb95')}"><header><small>${escape(t.regionName)} · ${t.floorRange[0]<0?'地下 '+(-t.floorRange[0])+'～'+(-t.floorRange[1]):t.floorRange.join('～')} 樓${t.acceptedRecording?' · 已確認原錄音':''}</small><h3>${escape(t.title)}</h3><p>${escape(t.description)}</p></header><div class="blind-label">曲目 ${tracks.indexOf(t)+1}</div><small>${t.seconds.toFixed(1)} 秒 · ${escape(t.style)}</small><audio controls preload="none" src="${encodeURIComponent(t.filename)}"></audio><a href="${encodeURIComponent(t.filename)}" download>下載試聽</a><details><summary>這一區的聲音記號</summary><p>${escape(t.signature)}</p></details></article>`).join('');
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>十四地區 · 各自的聲音</title><style>*{box-sizing:border-box}html{scroll-padding-top:18px}body{margin:0;background:#101e2b;color:#f4e5c6;font:17px system-ui,sans-serif}main{max-width:920px;margin:auto;padding:24px}h1{font-size:30px}h2{font-size:27px;margin:34px 0 16px}h3{font-size:23px;margin:12px 0}p{color:#c2d0da;line-height:1.65}nav{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}article{padding:22px;border:1px solid #526a79;border-left:5px solid var(--region);border-radius:16px;background:#1b3040;margin:18px 0}small{display:block;color:#c9be9d}audio{display:block;width:100%;height:54px;margin:18px 0}button{font:inherit;min-height:44px;background:#294759;color:#f4e5c6;border:1px solid #7693a7;border-radius:10px;padding:10px 16px}a{color:#e3c990;display:inline-flex;min-height:44px;align-items:center}nav a{border:1px solid #6d8594;border-radius:10px;padding:8px 16px;text-decoration:none}summary{padding:12px 0;cursor:pointer;min-height:44px}.blind-label{display:none;font-size:24px}.blind article header,.blind article>small,.blind article details{display:none}.blind .blind-label{display:block}footer{font-size:14px;color:#adbecb;line-height:1.6;margin:28px 0}@media(max-width:480px){main{padding:14px}article{padding:18px}h1{font-size:27px}}</style><main><h1>十四地區 · 各自的聲音</h1><p>地上與地下使用不同的主奏、節拍、密度、回音空間與曲式。新增十一首，先前確認的庭園、水晶窟與工坊三首保留原錄音。<br>仍是試聽版，尚未替換正式遊戲音樂；可隱藏地區名稱，從聲音判斷所在區域。</p><button id="blindToggle" type="button" aria-pressed="false">隱藏地區名稱試聽</button><nav><a href="#surface">地上篇 9 首</a><a href="#underground">地下篇 5 首</a></nav><section id="surface"><h2>地上篇 · 九個地區</h2>${cards(tracks.filter(t=>t.floorRange[0]>0))}</section><section id="underground"><h2>地下篇 · 五個地區</h2>${cards(tracks.filter(t=>t.floorRange[0]<0))}</section><footer>使用本機已安裝樂器取樣與原創打擊編曲，不是真人樂團錄音，沒有散布原始取樣。檔案與音量已檢查；辨識度與聽感仍請實際試聽確認。</footer></main><script>document.addEventListener('play',event=>{if(event.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(audio=>{if(audio!==event.target)audio.pause();});},true);document.querySelector('#blindToggle').addEventListener('click',event=>{const blind=document.body.classList.toggle('blind');event.target.setAttribute('aria-pressed',String(blind));event.target.textContent=blind?'顯示地區名稱':'隱藏地區名稱試聽';});</script></html>`;
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function snapshot(folder,count){
  const report=JSON.parse(await readFile(folder+'/report.json','utf8'));assert.equal(report.pass,true);assert.equal(report.tracks.length,count);
  const hashes=Object.fromEntries(await Promise.all(['index.html','report.json',...report.tracks.map(t=>t.filename)].map(async name=>[name,sha(await readFile(folder+'/'+name))])));
  for(const t of report.tracks)assert.equal(hashes[t.filename],t.sha256);
  return {report,hashes};
}
async function main(){
  const args=process.argv.slice(2),summaries=validateAllIdentities();
  if(args.includes('--validate-only')){console.log(JSON.stringify(summaries));return;}
  const out=resolve(args[0]||'.agent-run/all-region-identities-20261005');
  // A failed or finished export remains evidence; select another folder for reruns.
  assert.ok(out.startsWith(resolve('.agent-run')+'/'));
  try{await access(out+'/report.json');throw Error('Output already has a report; use a fresh audition directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const acceptedFolder=resolve('.agent-run/region-identity-previews-20261005'),previousFolder=resolve('.agent-run/floor-orchestra-previews-20261005');
  const accepted=await snapshot(acceptedFolder,3),previous=await snapshot(previousFolder,14);
  for(const score of identityScores){const t=accepted.report.tracks.find(t=>t.id===score.id);assert.equal(t.scoreSha256,sha(Buffer.from(JSON.stringify(score,null,2))));}
  const report=await renderAuditions(newIdentityScores,out,{pageTitle:'其餘十一區・不同風格試聽'});report.pass=false;
  try{
    for(const score of identityScores){
      const original=accepted.report.tracks.find(t=>t.id===score.id);
      await copyFile(acceptedFolder+'/'+original.filename,out+'/'+original.filename,constants.COPYFILE_EXCL);
      assert.equal(sha(await readFile(out+'/'+original.filename)),original.sha256);
      report.tracks.push({...original,file:out+'/'+original.filename,acceptedRecording:true});
    }
    report.tracks=allIdentityScores.map(score=>{
      const track=report.tracks.find(t=>t.id===score.id);assert.ok(track);
      return {...track,chapterId:score.chapterId,regionName:score.regionName,floorRange:score.floorRange,style:score.style,signature:score.signature,beatsPerBar:score.beatsPerBar,colour:score.colour,acceptedRecording:track.acceptedRecording===true};
    });
    report.acceptedAuditionsBefore=accepted.hashes;report.acceptedAuditionsAfter=(await snapshot(acceptedFolder,3)).hashes;
    report.priorAuditionsBefore=previous.hashes;report.priorAuditionsAfter=(await snapshot(previousFolder,14)).hashes;
    assert.deepEqual(report.acceptedAuditionsAfter,accepted.hashes);assert.deepEqual(report.priorAuditionsAfter,previous.hashes);
    report.newRecordings=11;report.acceptedRecordingsCopied=3;
    await writeFile(out+'/index.html',allIdentityPage(report.tracks));report.pass=true;
  }catch(error){report.failure=error.stack;throw error;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
  console.log(JSON.stringify({pass:report.pass,tracks:14,newRecordings:11,acceptedRecordingsUnchanged:3,priorAuditionsUnchanged:14,officialMusicChanged:false,page:out+'/index.html'}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
