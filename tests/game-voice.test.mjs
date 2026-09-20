import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),V=require('../assets/game-voice.js');
function harness(){
  let now=1000,voices=[];const spoken=[],events={},docEvents={};
  const synth={getVoices:()=>voices,addEventListener:(key,fn)=>events[key]=fn,cancel(){this.cancelled=(this.cancelled||0)+1;},speak(u){spoken.push(u);}};
  const env={speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},Date:{now:()=>now},document:{hidden:false,addEventListener:(key,fn)=>docEvents[key]=fn},addEventListener:(key,fn)=>events[key]=fn};
  const voice=V.create(env);return{voice,spoken,synth,env,at:t=>now=t,voices:list=>{voices=list;events.voiceschanged();},finish:()=>spoken.at(-1).onend(),hide:()=>{env.document.hidden=true;docEvents.visibilitychange();}};
}
const female={voiceURI:'mei',name:'Mei-Jia',lang:'zh-TW',localService:true},male={voiceURI:'yun',name:'YunJhe',lang:'zh-TW'},en={voiceURI:'en',name:'Samantha',lang:'en-US'};
test('自動優先台灣中文女聲，尊重指定中文聲音，延遲載入也能更新',()=>{
  assert.equal(V.chooseVoice([en,male,female]),female);assert.equal(V.chooseVoice([female,male],'yun'),male);assert.equal(V.chooseVoice([en]),null);
  assert.equal(V.chooseVoice([{name:'婷婷',lang:'zh-CN'},{name:'美佳',lang:'zh-TW'}]).name,'美佳');
  const h=harness();h.voices([en,male,female]);h.voice.announce('你好');assert.equal(h.spoken[0].voice,female);assert.equal(h.spoken[0].rate,.9);assert.equal(h.spoken[0].pitch,1.03);
});
test('完整故事分段串接不重疊，換頁與停止使舊回呼失效',()=>{
  const h=harness();h.voice.readPanel({voiceScope:'full',querySelectorAll:()=>[{closest:()=>null,textContent:'第一段。第二段。第三段。'}]});
  assert.equal(h.spoken.length,1);const old=h.spoken[0];h.finish();assert.equal(h.spoken.length,2);
  h.voice.announce('新頁',true);old.onend();assert.equal(h.spoken.length,3);assert.equal(h.spoken.at(-1).text,'新頁');
  h.voice.stop();h.finish();assert.equal(h.spoken.length,3);assert.equal(h.voice.status().speaking,false);
});
test('道具提示排隊、去除表情符號、避免重複與過期提示',()=>{
  const h=harness();h.voice.announce('⛏️ 獲得鐵鍬');h.voice.announce('⛏️ 獲得鐵鍬');h.voice.announce('取得補給');assert.equal(h.spoken.length,1);
  assert.equal(h.spoken[0].text,'獲得鐵鍬');h.at(15000);h.finish();assert.equal(h.spoken.length,1);
  assert.equal(V.clean('戰士 3/5'),'戰士 3 分');assert.ok(V.chunks('甲'.repeat(400)).every(s=>s.length<=90));
});
test('關閉立即取消、阻止新語音；換分頁取消，缺少語音支援不影響遊戲',()=>{
  const h=harness();h.voice.announce('道具');h.voice.configure({enabled:false});h.voice.announce('故事');assert.equal(h.spoken.length,1);assert.equal(h.voice.status().speaking,false);
  h.voice.configure({enabled:true});h.voice.announce('道具');h.hide();assert.equal(h.voice.status().speaking,false);assert.equal(h.voice.announce('背景'),false);
  const unsupported=V.create({});assert.equal(unsupported.announce('你好'),false);assert.equal(unsupported.status().supported,false);unsupported.stop();
});
test('播放錯誤顯示失敗狀態，試聽可重試而非永久鎖死',()=>{
  const h=harness();h.voice.preview();h.spoken[0].onerror({error:'not-allowed'});assert.equal(h.voice.status().failure,'not-allowed');h.voice.preview();assert.equal(h.voice.status().failure,'');assert.equal(h.spoken.length,2);
});
test('故事抽取包含內文與選項，不朗讀控制列或隱藏文字',()=>{
  const h=harness(),node=(text,hidden=false)=>({textContent:text,closest:()=>hidden?{}:null});
  h.voice.readPanel({voiceScope:'full',querySelectorAll:()=>[node('塔頂'),node('故事內文'),node('下一頁'),node('停止',true)]});
  while(h.voice.status().speaking)h.finish();assert.equal(h.spoken.map(u=>u.text).join(''),'塔頂。故事內文。下一頁');
});
test('一般版與劇情版共用語音，不再跟隨音樂靜音；道具事件有播報',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(html,/id="cfgSpeech"/);assert.match(html,/speechOn:s.speechOn===0\?0:1/);assert.match(html,/function speak\(text\)\{window.GameVoice\?\.announce/);
  assert.match(html,/announce\('獲得 '\+t.name/);assert.match(tower,/GameVoice\?\.readPanel/);assert.match(tower,/announce\('使用 '\+C.ITEMS/);
});

test('背包摘要及重聽不讀裝備詳細數值，保留主要操作',()=>{
  const node=textContent=>({textContent,closest:()=>null}),h=harness();
  const panel={voiceSummary:'裝備與補給。穿戴中：木仗',querySelector:()=>null,querySelectorAll:selector=>selector.startsWith('.tower-actions')?[node('回到迷宮')]:[node('耐久 9，防禦 3，擊暈 10 秒')]};
  assert.equal(V.panelText(panel),'裝備與補給。穿戴中：木仗。回到迷宮');
  h.voice.readPanel(panel);while(h.voice.status().speaking)h.finish();const first=h.spoken.map(u=>u.text).join('');
  h.voice.replay();while(h.voice.status().speaking)h.finish();assert.equal(h.spoken.map(u=>u.text).join(''),first+first);assert.doesNotMatch(first,/耐久|防禦|擊暈/);
});
test('一般介面只讀標題、首句重點及主要選項，故事正文仍完整',()=>{
  const node=textContent=>({textContent,closest:()=>null});
  const panel={querySelector:s=>s==='h2'?node('整理行囊'):s==='p.tower-copy'?node('請選擇裝備。詳細耐久 8'):null,querySelectorAll:s=>s.startsWith('.tower-actions')?[node('返回'),node('返回')]:[node('故事一'),node('故事二')]};
  assert.equal(V.panelText(panel),'整理行囊。請選擇裝備。返回');
  const select=panel.querySelector;panel.querySelector=s=>s==='.tower-prose'?{}:select(s);
  assert.equal(V.panelText(panel),'故事一。故事二');
});
test('一般拾取、食物、鐵鍬與購物均只提供名稱播報',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/typeof readAloud==='string'\?readAloud:msg/);
  assert.match(html,/'獲得 '\+f.type.name/);assert.match(html,/'獲得 '\+gd.g.name/);assert.match(html,/'使用 鐵鍬'/);
});

test('首頁六個選項只讀名稱，快速改選會取代舊朗讀，關閉語音不播報',()=>{
  const h=harness(),events={},nodes=new Map();
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){}});return nodes.get(id);},addEventListener:(type,fn)=>events[type]=fn};
  const voice={...h.voice,listen(){}};
  vm.runInNewContext(readFileSync(new URL('../assets/voice-settings.js',import.meta.url),'utf8'),{window:{GameVoice:voice},document,CFG:{speechOn:1,speechVoice:''}});
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const choices=[...html.matchAll(/<button class="home-action[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/g)].map(m=>m[1]);
  assert.deepEqual(choices,['劇情模式・倒轉高塔','單人遊戲','多人遊戲','遊戲設定','勇者歷史','遊戲說明']);
  const click=label=>events.click({target:{closest:selector=>selector==='#homePanel .home-action'?{querySelector:()=>({textContent:label})}:null}});
  choices.forEach(click);assert.deepEqual(h.spoken.map(u=>u.text),choices);assert.ok(h.synth.cancelled>=6);
  h.voice.configure({enabled:false});choices.forEach(click);assert.equal(h.spoken.length,6);
  const tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');assert.match(tower,/storyEntryBtn'\)\.onclick = \(\) => open\(true\)/);
});
