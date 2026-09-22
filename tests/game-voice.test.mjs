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
function recordedHarness(){
  const audio=[],spoken=[],instances=[];
  class FakeAudio{constructor(){instances.push(this);}play(){const self=this;audio.push({src:this.src,played:true,onended:this.onended,onerror:this.onerror,get paused(){return self.paused;}});}pause(){this.paused=true;}}
  const synth={getVoices:()=>[],addEventListener(){},cancel(){},speak(u){spoken.push(u);}};
  const env={Audio:FakeAudio,MazeVoicePack:{get:id=>id==='intro'?{src:'./intro.mp3',text:'專用旁白'}:id==='limit'?{src:'./limit.mp3',text:'限時十五秒'}:null},speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},Date:{now:()=>1000},document:{hidden:false,addEventListener(){}},addEventListener(){}};
  return{voice:V.create(env),audio,spoken,instances};
}
function catalogHarness(speech=true){
  const audio=[],spoken=[],instances=[];let now=1000;
  const timers=new Map();let timerId=0;
  class FakeAudio{constructor(){instances.push(this);}play(){const self=this;audio.push({src:this.src,onended:this.onended,onerror:this.onerror,onplaying:this.onplaying,onwaiting:this.onwaiting,get paused(){return self.paused;}});}pause(){this.paused=true;}}
  const env={Audio:FakeAudio,MazeVoicePack:require('../assets/voice-pack.js'),Date:{now:()=>now},document:{hidden:false,addEventListener(){}},addEventListener(){},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}};
  if(speech){env.speechSynthesis={getVoices:()=>[],addEventListener(){},cancel(){},speak:u=>spoken.push(u)};env.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};}
  const voice=V.create(env);
  return {voice,audio,spoken,instances,timers,at:t=>now=t,drain(){let i=0,j=0,limit=100;while(voice.status().speaking&&limit--){if(audio[i])audio[i++].onended();else if(spoken[j])spoken[j++].onend();else break;}assert.ok(limit>0);}};
}
test('連續錄音重用同一播放器，舊音檔的延遲回呼不能結束新音檔',()=>{
  const h=catalogHarness();h.voice.announce('單人遊戲');h.voice.announce('多人遊戲');
  const first=h.audio[0];first.onended();assert.equal(h.audio.length,2);assert.equal(h.instances.length,1);
  first.onended();first.onerror();assert.equal(h.voice.status().speaking,true);assert.equal(h.spoken.length,0);
  h.audio[1].onended();assert.equal(h.voice.status().speaking,false);
});
test('下載卡住會備援，已開始播放或關閉語音會清除等待計時',()=>{
  const h=catalogHarness();h.voice.announce('單人遊戲');assert.equal(h.timers.size,1);
  [...h.timers.values()][0]();assert.equal(h.spoken[0].text,'單人遊戲');assert.equal(h.timers.size,0);
  h.voice.announce('多人遊戲',true);h.audio[1].onplaying();assert.equal(h.timers.size,0);
  h.audio[1].onwaiting();assert.equal(h.timers.size,1);h.audio[1].onplaying();assert.equal(h.timers.size,0);
  h.voice.announce('遊戲設定',true);assert.equal(h.timers.size,1);h.voice.stop();assert.equal(h.timers.size,0);
});
test('固定提示自動找錄音，不預載；重複拾取去重且不搶話',()=>{
  const h=catalogHarness();assert.equal(h.audio.length,0);
  h.voice.announce('獲得 餅乾');h.voice.announce('獲得 餅乾');h.voice.announce('使用 鐵鍬');
  assert.equal(h.audio.length,1);assert.equal(h.spoken.length,0);h.drain();assert.equal(h.audio.length,2);assert.equal(h.spoken.length,0);
});
test('動態名字保留裝置朗讀，錄音與裝置語音不重疊，也不截斷同一事件',()=>{
  const h=catalogHarness();h.voice.announce('小雨獲得 餅乾。小晴獲得 牛奶。小明獲得 鐵鍬。');
  assert.equal(h.spoken[0].text,'小雨');assert.equal(h.audio.length,0);h.drain();
  assert.equal(h.audio.length,3);assert.deepEqual(h.spoken.map(x=>x.text).join('').replace(/[。]/g,''),'小雨小晴小明');
});
test('自動錄音失敗只備援該片段，不重試壞音檔或取消後續事件',()=>{
  const h=catalogHarness();h.voice.announce('獲得 餅乾');h.voice.announce('使用 鐵鍬');
  h.audio[0].onerror();assert.equal(h.audio[0].paused,true);assert.equal(h.spoken[0].text,'獲得 餅乾');
  h.spoken[0].onend();assert.equal(h.audio.length,2);h.audio[1].onended();assert.equal(h.voice.status().speaking,false);
});
test('沒有裝置語音仍可播放固定音檔，關閉後舊回呼不能續播',()=>{
  const h=catalogHarness(false);h.voice.announce('單人遊戲');assert.equal(h.audio.length,1);
  h.voice.configure({enabled:false});h.audio[0].onended();assert.equal(h.voice.status().speaking,false);assert.equal(h.voice.announce('多人遊戲'),false);
});
test('一般事件最多排四個，過期提示不延遲重播；故事不使用事件上限',()=>{
  const h=catalogHarness();h.voice.announce('單人遊戲');
  for(const label of ['多人遊戲','遊戲設定','勇者歷史','遊戲說明'])assert.equal(h.voice.announce(label),true);
  assert.equal(h.voice.announce('鬼抓人'),false);h.at(15000);h.audio[0].onended();assert.equal(h.audio.length,1);
  const text=['單人遊戲','多人遊戲','遊戲設定','勇者歷史','遊戲說明','鬼抓人'].join('。');
  const story=catalogHarness();story.voice.readPanel({voiceScope:'full',querySelectorAll:()=>[{closest:()=>null,textContent:text}]});story.drain();assert.equal(story.audio.length,6);
});
const female={voiceURI:'mei',name:'Mei-Jia',lang:'zh-TW',localService:true},male={voiceURI:'yun',name:'YunJhe',lang:'zh-TW'},en={voiceURI:'en',name:'Samantha',lang:'en-US'};
test('叫賣兩段錄音連續播放、拾取朗讀不插隊，關閉語音立即停止',()=>{
  const h=recordedHarness(),states=[];h.voice.listen(s=>states.push(s.speaking));
  h.voice.announceAssets(['intro','limit'],'商品大拍賣，限時十五秒');h.voice.announce('獲得商品');
  assert.equal(h.audio.length,1);assert.equal(h.spoken.length,0);h.audio[0].onended();
  assert.equal(h.audio[1].src,'./limit.mp3');assert.equal(states.at(-1),true);assert.equal(h.spoken.length,0);
  h.audio[1].onended();assert.equal(h.spoken[0].text,'獲得商品');
  h.voice.announceAssets(['intro','limit'],'叫賣');const first=h.audio.at(-1);h.voice.configure({enabled:false});first.onended();assert.equal(first.paused,true);assert.equal(h.audio.length,3);
});
test('叫賣第一段失敗朗讀完整句；第二段失敗只讀秒數',()=>{
  const h=recordedHarness();h.voice.announceAssets(['intro','limit'],'完整叫賣');h.audio[0].onerror();assert.equal(h.spoken[0].text,'完整叫賣');
  h.voice.announceAssets(['intro','limit'],'完整叫賣');h.audio[1].onended();h.audio[2].onerror();assert.equal(h.spoken.at(-1).text,'限時十五秒');
});
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
test('有專用錄音時延後下載並優先播放，結束後才朗讀操作選項，重聽會重播錄音',()=>{
  const h=recordedHarness(),panel={voiceAsset:'intro',voiceAfterText:'下一頁',querySelectorAll:()=>[{closest:()=>null,textContent:'專用旁白。下一頁'}]};
  assert.equal(h.audio.length,0);assert.equal(h.voice.readPanel(panel),true);assert.equal(h.audio.length,1);assert.equal(h.audio[0].src,'./intro.mp3');assert.equal(h.spoken.length,0);assert.equal(h.voice.status().recorded,true);
  h.audio[0].onended();assert.equal(h.spoken[0].text,'下一頁');h.voice.replay();assert.equal(h.audio.length,2);assert.equal(h.audio[1].played,true);
});
test('專用錄音不可用時自動改用裝置朗讀，不中斷故事',()=>{
  const h=recordedHarness(),panel={voiceAsset:'intro',querySelectorAll:()=>[{closest:()=>null,textContent:'完整故事。繼續'}]};
  h.voice.readPanel(panel);h.audio[0].onerror();assert.equal(h.spoken[0].text,'完整故事。');h.spoken[0].onend();assert.equal(h.spoken[1].text,'繼續');
});
test('故事抽取包含內文與選項，不朗讀控制列或隱藏文字',()=>{
  const h=harness(),node=(text,hidden=false)=>({textContent:text,closest:()=>hidden?{}:null});
  h.voice.readPanel({voiceScope:'full',querySelectorAll:()=>[node('塔頂'),node('故事內文'),node('下一頁'),node('停止',true)]});
  while(h.voice.status().speaking)h.finish();assert.equal(h.spoken.map(u=>u.text).join(''),'塔頂。故事內文。下一頁');
});
test('一般版與劇情版共用語音，不再跟隨音樂靜音；道具事件有播報',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),tower=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(html,/id="cfgSpeech"/);assert.match(html,/speechOn:s.speechOn===0\?0:1/);assert.match(html,/function speak\(text\)\{window.GameVoice\?\.announce/);assert.match(html,/assets\/voice-pack\.js/);
  assert.match(html,/announce\('獲得 '\+t.name/);assert.match(tower,/GameVoice\?\.readPanel/);assert.match(tower,/announce\('使用 '\+C.ITEMS/);
  assert.match(tower,/announceAsset\('alert\.monster'/);assert.match(tower,/story\.scene99\./);assert.match(tower,/merchant\.'\+nearest\.id/);assert.match(tower,/explorer\.'\+person\.id/);
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

test('單人過關、失敗與多人結算提供簡短結果朗讀',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const [name,label] of [['winGame','恭喜過關！'],['loseGame','遊戲結束'],['showMPResults','遊戲結束']]){
    const body=html.slice(html.indexOf('function '+name+'(')).split('\n}')[0];
    assert.ok(body.includes("window.GameVoice?.announce('"+label+"',true)"),name);
  }
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

test('朗讀期間降低背景音樂與道具音效，結束後恢復原本音量',()=>{
  const nodes=new Map(),levels={};let render;
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){},replaceChildren(){},appendChild(){}});return nodes.get(id);},createElement:()=>({}),addEventListener(){}};
  const AudioEng={ctx:{currentTime:0}};
  for(const name of ['musicGain','fxGain','itemGain'])AudioEng[name]={gain:{setTargetAtTime:value=>levels[name]=value}};
  const voice={listen:fn=>render=fn,configure(){}};
  vm.runInNewContext(readFileSync(new URL('../assets/voice-settings.js',import.meta.url),'utf8'),{window:{GameVoice:voice},document,AudioEng,CFG:{speechOn:1,speechVoice:''}});
  render({supported:true,enabled:true,voices:[],speaking:true});assert.deepEqual(levels,{musicGain:.09,fxGain:.45,itemGain:.16});
  render({supported:true,enabled:true,voices:[],speaking:false});assert.deepEqual(levels,{musicGain:.32,fxGain:.8,itemGain:.4});
});

test('角色、環境、視角與多人玩法選擇讀出名稱',()=>{
  const h=harness(),events={},nodes=new Map();
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){}});return nodes.get(id);},addEventListener:(type,fn)=>events[type]=fn};
  vm.runInNewContext(readFileSync(new URL('../assets/voice-settings.js',import.meta.url),'utf8'),{window:{GameVoice:{...h.voice,listen(){}}},document,CFG:{speechOn:1,speechVoice:''}});
  for(const [selector,label] of [['#charRow .char-btn','疾風跑者'],['#lvlRow .lvl-btn','神祕城堡'],['#viewRow .view-btn','第三人稱'],['.mp-mode-btn','比賽搶終點']]){
    events.click({target:{closest:query=>query.split(', ').includes(selector)?{textContent:label}:null}});
  }
  assert.deepEqual(h.spoken.map(u=>u.text),['疾風跑者','神祕城堡','第三人稱','比賽搶終點']);
});
