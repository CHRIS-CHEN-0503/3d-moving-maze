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
  function chooseVoice(voices,preferred='',profile={}){
    const zh=voices.filter(v=>/^zh(?:[-_](?:TW|CN|Hans|Hant)(?:[-_]|$)|$)/i.test(v.lang)&&!/^zh[-_]Hant[-_]HK/i.test(v.lang));
    const selected=zh.find(v=>v.voiceURI===preferred);if(selected&&!profile.gender)return selected;
    // 裝置不提供性別欄位，只能優先辨識已知女聲名稱，不假裝保證性別。
    const female=/女|female|mei[-\s]?jia|meijia|美佳|美嘉|曉曉|晓晓|xiaoxiao|hanhan|涵涵|yating|雅婷|hsiao|曉臻|曉雨|tracy|tingting|婷婷|sinji/i;
    const male=/男|male|yun[-\s]?(jhe|zhe|xi|yang)|雲哲|云哲|云希|云扬|zhiwei|志偉|志伟|kangkang|康康/i;
    const score=v=>(/^zh[-_](?:TW|Hant[-_]TW)$/i.test(v.lang)?200:100)+((profile.gender==='male'?male.test(v.name)&&!female.test(v.name):female.test(v.name))?40:0)+(v.localService?4:0)+(v.default?2:0);
    return zh.slice().sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function panelText(panel){
    if(!panel?.querySelectorAll)return '';
    if(typeof panel.voiceText==='string')return clean(panel.voiceText);
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
    let enabled=true,preferred='',voices=[],queue=[],current=null,currentAudio=null,player=null,generation=0,lastStory=null,failure='',listener=()=>{},sequence=0,loadTimer=null,character=()=>({});
    const recent=new Map(),pinnedVoices=new Map();let voiceTimer=null,voicePlaying=false;
    function characterSpeaker(){return {...character(),consistent:true};}
    function pinSpeaker(speaker){
      if(!speaker.consistent)return speaker;
      const key=speaker.identity||[speaker.gender||'narrator',speaker.age||'adult'].join(':');
      // An unloaded list is not a voice. Pin only a real Mandarin voice.
      const chosen=chooseVoice(voices,preferred,speaker);
      if(!pinnedVoices.has(key)&&chosen)pinnedVoices.set(key,chosen);
      return {...speaker,deviceOnly:true,pinnedVoice:pinnedVoices.get(key)||null};
    }
    function status(){return {supported,enabled,speaking:!!(current||currentAudio),playing:voicePlaying,loadingAudio:!!currentAudio&&!voicePlaying,loadingVoice:voiceTimer!==null,voice:chooseVoice(voices,preferred),voices:voices.filter(v=>chooseVoice([v])),failure,recorded:recordedSupported};}
    function notify(){listener(status());}
    function clearLoadTimer(){if(loadTimer!==null){env.clearTimeout?.(loadTimer);loadTimer=null;}}
    function clearVoiceTimer(){if(voiceTimer!==null){env.clearTimeout?.(voiceTimer);voiceTimer=null;}}
    function refresh(){try{voices=synth?.getVoices()||[];}catch(_){voices=[];}if(chooseVoice(voices)){clearVoiceTimer();if(failure==='chinese-voice-unavailable')failure='';}notify();if(voiceTimer===null&&queue.length)next();}
    function stop(forget=false){
      generation++;queue=[];current=null;voicePlaying=false;clearLoadTimer();clearVoiceTimer();
      if(currentAudio){try{currentAudio.pause();currentAudio.currentTime=0;}catch(_){}currentAudio=null;}
      if(forget)lastStory=null;try{synth?.cancel();}catch(_){}notify();
    }
    function next(){
      if(!enabled||current||currentAudio||voiceTimer!==null)return;
      while(queue.length&&queue[0].expires&&queue[0].expires<now())queue.shift();
      const entry=queue.shift();if(!entry){notify();return;}
      if(entry.asset&&recordedSupported){
        // Reuse the user-activated media element; Safari permissions are per element.
        const token=++generation,track=pack.get(entry.asset),audio=player||(player=new AudioCtor());currentAudio=audio;voicePlaying=false;
        audio.src=track.src;
        audio.preload='auto';audio.volume=1;
        audio.playbackRate=track.rate||1.16;audio.preservesPitch=true;
        const finish=()=>{if(token!==generation||currentAudio!==audio)return;clearLoadTimer();currentAudio=null;voicePlaying=false;next();};
        const fallback=()=>{
          if(token!==generation||currentAudio!==audio)return;
          clearLoadTimer();try{audio.pause();}catch(_){}currentAudio=null;voicePlaying=false;failure='recording-unavailable';
          if(entry.group)queue=queue.filter(e=>e.group!==entry.group);
          // Never rematch a failed recording: use device speech once, then continue.
          queue.unshift(...chunks(entry.text).map(text=>({text,expires:entry.expires,eventGroup:entry.eventGroup,speaker:{...track,...entry.speaker}})));next();
        };
        audio.onended=finish;audio.onerror=fallback;
        audio.onplaying=()=>{if(token===generation&&currentAudio===audio){voicePlaying=true;clearLoadTimer();notify();}};
        // A stalled download must not block every later voice event indefinitely.
        const waiting=()=>{if(token!==generation||currentAudio!==audio)return;voicePlaying=false;if(loadTimer===null&&env.setTimeout)loadTimer=env.setTimeout(fallback,8000);notify();};
        audio.onwaiting=waiting;audio.onstalled=waiting;waiting();
        try{audio.play()?.catch?.(fallback);notify();}catch(_){fallback();}return;
      }
      if(!speechSupported){failure='unavailable';next();return;}
      const profile=pinSpeaker(entry.speaker||{}),token=generation,u=new Utterance(entry.text),voice=profile.consistent?profile.pinnedVoice:chooseVoice(voices,preferred,profile);
      if(!voice){
        // Some tablets deliver voiceschanged after the first user tap. Never speak
        // with an unrelated system default while that list is still loading.
        if(env.setTimeout){queue.unshift(entry);voiceTimer=env.setTimeout(()=>{voiceTimer=null;if(token!==generation)return;try{voices=synth.getVoices()||[];}catch(_){}if(!chooseVoice(voices,preferred,profile)){if(queue[0]===entry)queue.shift();failure='chinese-voice-unavailable';}next();notify();},1500);notify();}
        else{failure='chinese-voice-unavailable';next();notify();}return;
      }
      u.lang=voice?.lang||'zh-TW';if(voice)u.voice=voice;u.rate=1;u.pitch=profile.age==='elder'?.95:profile.age==='child'?1.06:1;u.volume=1;
      current=u;voicePlaying=false;
      const finish=()=>{if(token!==generation||current!==u)return;current=null;voicePlaying=false;next();};
      const playing=value=>{if(token===generation&&current===u){voicePlaying=value;notify();}};
      u.onstart=()=>playing(true);u.onresume=()=>playing(true);u.onpause=()=>playing(false);
      u.onend=finish;u.onerror=e=>{if(token!==generation||current!==u)return;failure=e?.error||'unavailable';current=null;voicePlaying=false;queue=[];notify();};
      try{synth.speak(u);notify();}catch(_){failure='unavailable';current=null;voicePlaying=false;queue=[];notify();}
    }
    function entriesFor(text,story,speaker={}){
      const recorded=speaker.consistent&&!speaker.npc&&recordedSupported&&pack.exact?.(text,speaker.gender);
      if(recorded)return [{...recorded,expires:story?0:now()+12000,speaker}];
      speaker=pinSpeaker(speaker);
      const parts=(speaker.deviceOnly||speaker.npc)?[{text}]:recordedSupported&&pack.plan?pack.plan(text,speaker.gender):[{text}],expires=story?0:now()+12000;
      return parts.flatMap(p=>p.asset?[{...p,expires,speaker}]:chunks(p.text).map(text=>({text,expires,speaker})));
    }
    function say(value,{replace=false,story=false,speaker={}}={}){
      if(!enabled||!supported||env.document?.hidden)return false;
      const text=clean(value);if(!text)return false;
      if(!story&&!replace){const previous=recent.get(text);if(previous!==undefined&&now()-previous<1800)return false;recent.set(text,now());if(recent.size>32)recent.delete(recent.keys().next().value);}
      if(replace)stop();failure='';
      if(story)lastStory={text,asset:'',after:'',speaker};
      const pending=new Set(queue.filter(e=>e.expires).map(e=>e.eventGroup||e.group)).size;
      if(!story&&pending>=4)return false;
      const group=++sequence,items=entriesFor(text,story,speaker);
      // Limit queued events, not fragments: a mixed recording/dynamic sentence must remain whole.
      queue.push(...items.map(e=>({...e,eventGroup:group})));next();return true;
    }
    function playAsset(id,fallbackText,{replace=false,story=false,after='',continuation=[],speaker={}}={}){
      const track=pack?.get?.(id),fallback=clean(fallbackText||track?.text),tail=clean(after);
      if(!enabled||env.document?.hidden||!track?.src||!recordedSupported)return say(fallback,{replace,story,speaker});
      if(replace)stop();failure='';
      if(story)lastStory={text:fallback,asset:id,after:tail,speaker};
      const group=++sequence,expires=story?0:now()+12000;
      queue.push({asset:id,text:fallback,expires,group,speaker});
      for(const asset of continuation){const item=pack.get(asset);if(item)queue.push({asset,text:item.text,expires,group});}
      if(tail)queue.push(...entriesFor(tail,story,speaker).map(e=>({...e,group})));
      next();return true;
    }
    function readPanel(panel){
      const spoken=panelText(panel),asset=panel?.voiceAsset||'',after=panel?.voiceAfterText||'';
      const specified=panel?.voiceSpeaker||{};
      const wholeSummary=panel?.voiceScope==='summary'&&!!after;
      const speaker=wholeSummary?{...specified,consistent:true}:!asset&&panel?.voiceScope!=='full'&&!specified.npc?{...characterSpeaker(),...specified}:specified;
      // A merchant introduction and a dynamic equipment list must be one voice,
      // not a recorded actor followed by a different device actor.
      return asset&&!wholeSummary?playAsset(asset,spoken,{replace:true,story:true,after,speaker}):say(spoken,{replace:true,story:true,speaker});
    }
    function configure(settings={}){if(typeof settings.character==='function')character=settings.character;const changed=preferred!==(settings.voice||'');enabled=settings.enabled!==false;preferred=settings.voice||'';if(changed)pinnedVoices.clear();if(!enabled||changed)stop();refresh();}
    function listen(fn){listener=typeof fn==='function'?fn:()=>{};notify();}
    synth?.addEventListener?.('voiceschanged',refresh);
    env.document?.addEventListener?.('visibilitychange',()=>{if(env.document.hidden)stop();});
    env.addEventListener?.('pagehide',()=>stop(true));refresh();
    function replay(){return lastStory?.asset?playAsset(lastStory.asset,lastStory.text,{replace:true,story:true,after:lastStory.after,speaker:lastStory.speaker}):say(lastStory?.text||'',{replace:true,story:true,speaker:lastStory?.speaker});}
    return {configure,status,listen,refresh,readPanel,stop,announce:(text,replace=false)=>say(text,{replace,speaker:/(?:^|[。！!，,\s])(?:已)?(?:獲得|取得|使用|裝備|卸下|穿戴|賣出|修復|修理|打造|製作|烹飪|享用)/.test(clean(text))?characterSpeaker():{}}),announceAsset:(id,text,replace=false,speaker={})=>playAsset(id,text,{replace,speaker}),announceAssets:(ids,text)=>playAsset(ids[0],text,{replace:true,continuation:ids.slice(1)}),replay,preview:()=>say('你好，我會陪你探索迷宮。準備好了，就一起出發吧！',{replace:true})};
  }
  return {create,clean,chunks,chooseVoice,panelText};
});
