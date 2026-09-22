/* 專用錄音優先、裝置語音備援；不使用麥克風，每次只朗讀一段。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.MazeSpeech=api;if(root.document)root.GameVoice=api.create(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function clean(value){return String(value||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/\b([1-5])\s*\/\s*5\b/g,'$1 分').replace(/\s+/g,' ').trim();}
  function chunks(value){
    const parts=clean(value).match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g)||[],out=[];
    for(const part of parts)for(let i=0;i<part.length;i+=90)out.push(part.slice(i,i+90));
    return out;
  }
  function chooseVoice(voices,preferred=''){
    const zh=voices.filter(v=>/^zh(?:[-_]|$)/i.test(v.lang));
    const selected=zh.find(v=>v.voiceURI===preferred);if(selected)return selected;
    // 裝置不提供性別欄位，只能優先辨識已知女聲名稱，不假裝保證性別。
    const female=/女|female|mei[-\s]?jia|meijia|美佳|美嘉|曉曉|晓晓|xiaoxiao|hanhan|涵涵|yating|雅婷|hsiao|曉臻|曉雨|tracy|tingting|婷婷|sinji/i;
    const score=v=>(/^zh[-_]TW$/i.test(v.lang)?40:0)+(female.test(v.name)?80:0)+(v.localService?4:0)+(v.default?2:0);
    return zh.slice().sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function panelText(panel){
    if(!panel?.querySelectorAll)return '';
    const text=node=>clean(node?.innerText||node?.textContent||'');
    const visible=node=>!node.closest('[data-voice-controls],[hidden],.tower-close');
    // 故事正文與日誌保留全文；一般操作介面只讀摘要及主要動作。
    if(panel.voiceScope==='full'||panel.querySelector?.('.tower-prose'))return [...panel.querySelectorAll('h2,h3,p,li,dt,dd,small,button')].filter(visible).map(text).filter(Boolean).join('。');
    const title=text(panel.querySelector?.('h2'));
    const lead=text(panel.querySelector?.('p.tower-copy')).split(/[。！？\n]/)[0];
    const summary=panel.voiceSummary||[title,lead].filter(Boolean).join('。');
    const actions=[...new Set([...panel.querySelectorAll('.tower-actions > button:not(:disabled)')].filter(visible).map(text).filter(Boolean))];
    return [summary,...actions].filter(Boolean).join('。');
  }
  function create(env){
    const synth=env.speechSynthesis,Utterance=env.SpeechSynthesisUtterance;
    const speechSupported=!!(synth&&Utterance),AudioCtor=env.Audio,pack=env.MazeVoicePack;
    const recordedSupported=typeof AudioCtor==='function'&&!!pack?.get,supported=speechSupported||recordedSupported,now=()=>env.Date?.now?.()??Date.now();
    let enabled=true,preferred='',voices=[],queue=[],current=null,currentAudio=null,generation=0,lastStory=null,failure='',listener=()=>{};
    const recent=new Map();
    function status(){return {supported,enabled,speaking:!!(current||currentAudio),voice:chooseVoice(voices,preferred),voices:voices.filter(v=>/^zh(?:[-_]|$)/i.test(v.lang)),failure,recorded:recordedSupported};}
    function notify(){listener(status());}
    function refresh(){try{voices=synth?.getVoices()||[];}catch(_){voices=[];}notify();}
    function stop(forget=false){
      generation++;queue=[];current=null;
      if(currentAudio){try{currentAudio.pause();currentAudio.currentTime=0;}catch(_){}currentAudio=null;}
      if(forget)lastStory=null;try{synth?.cancel();}catch(_){}notify();
    }
    function next(){
      if(!enabled||!speechSupported||current||currentAudio)return;
      while(queue.length&&queue[0].expires&&queue[0].expires<now())queue.shift();
      const entry=queue.shift();if(!entry){notify();return;}
      const token=generation,u=new Utterance(entry.text),voice=chooseVoice(voices,preferred);
      u.lang=voice?.lang||'zh-TW';if(voice)u.voice=voice;u.rate=.9;u.pitch=1.03;u.volume=1;
      current=u;
      const finish=()=>{if(token!==generation||current!==u)return;current=null;next();};
      u.onend=finish;u.onerror=e=>{if(token!==generation||current!==u)return;failure=e?.error||'unavailable';current=null;queue=[];notify();};
      try{synth.speak(u);notify();}catch(_){failure='unavailable';current=null;queue=[];notify();}
    }
    function say(value,{replace=false,story=false}={}){
      if(!enabled||!speechSupported||env.document?.hidden)return false;
      const text=clean(value);if(!text)return false;
      if(!story&&!replace){const previous=recent.get(text);if(previous!==undefined&&now()-previous<1800)return false;recent.set(text,now());if(recent.size>32)recent.delete(recent.keys().next().value);}
      if(replace)stop();failure='';
      if(story)lastStory={text,asset:'',after:''};
      const pending=queue.filter(e=>e.expires).length;
      if(!story&&pending>=4)return false;
      const items=chunks(text).map(text=>({text,expires:story?0:now()+12000}));
      queue.push(...(story?items:items.slice(0,4-pending)));next();return true;
    }
    function playAsset(id,fallbackText,{replace=false,story=false,after='',continuation=[]}={}){
      const track=pack?.get?.(id),fallback=clean(fallbackText||track?.text),tail=clean(after);
      if(!enabled||env.document?.hidden||!track?.src||!recordedSupported)return say(fallback,{replace,story});
      if(replace)stop();failure='';
      if(story)lastStory={text:fallback,asset:id,after:tail};
      const token=generation,audio=new AudioCtor(track.src);currentAudio=audio;
      try{audio.preload='auto';audio.volume=1;}catch(_){}
      const finish=()=>{if(token!==generation||currentAudio!==audio)return;currentAudio=null;if(continuation.length){playAsset(continuation[0],'',{continuation:continuation.slice(1)});return;}notify();if(tail&&!say(tail,{story:false}))next();else if(!tail)next();};
      const fallbackToSpeech=error=>{if(token!==generation||currentAudio!==audio)return;currentAudio=null;failure=error||'recording-unavailable';notify();if(!say(fallback,{story}))next();};
      audio.onended=finish;audio.onerror=()=>fallbackToSpeech('recording-unavailable');
      try{const result=audio.play();result?.catch?.(()=>fallbackToSpeech('recording-unavailable'));notify();return true;}
      catch(_){fallbackToSpeech('recording-unavailable');return speechSupported;}
    }
    function readPanel(panel){
      const spoken=panelText(panel),asset=panel?.voiceAsset||'',after=panel?.voiceAfterText||'';
      return asset?playAsset(asset,spoken,{replace:true,story:true,after}):say(spoken,{replace:true,story:true});
    }
    function configure(settings={}){const changed=preferred!==(settings.voice||'');enabled=settings.enabled!==false;preferred=settings.voice||'';if(!enabled||changed)stop();refresh();}
    function listen(fn){listener=typeof fn==='function'?fn:()=>{};notify();}
    synth?.addEventListener?.('voiceschanged',refresh);
    env.document?.addEventListener?.('visibilitychange',()=>{if(env.document.hidden)stop();});
    env.addEventListener?.('pagehide',()=>stop(true));refresh();
    function replay(){return lastStory?.asset?playAsset(lastStory.asset,lastStory.text,{replace:true,story:true,after:lastStory.after}):say(lastStory?.text||'',{replace:true,story:true});}
    return {configure,status,listen,refresh,readPanel,stop,announce:(text,replace=false)=>say(text,{replace}),announceAsset:(id,text,replace=false)=>playAsset(id,text,{replace}),announceAssets:(ids,text)=>playAsset(ids[0],text,{replace:true,continuation:ids.slice(1)}),replay,preview:()=>say('你好，我會陪你探索迷宮。準備好了，就一起出發吧！',{replace:true})};
  }
  return {create,clean,chunks,chooseVoice,panelText};
});
