(function(){
  'use strict';
  const voice=window.GameVoice,on=document.getElementById('cfgSpeech'),select=document.getElementById('cfgSpeechVoice'),hint=document.getElementById('speechStatus'),preview=document.getElementById('speechPreview');
  let voiceSignature='';
  function save(){CFG.speechOn=Number(on.value);CFG.speechVoice=select.value;saveCfg();voice.configure({enabled:!!CFG.speechOn,voice:CFG.speechVoice});}
  function render(state){
    if(AudioEng.musicGain&&AudioEng.ctx)AudioEng.musicGain.gain.setTargetAtTime(state.speaking?.09:.32,AudioEng.ctx.currentTime,.12);
    const chosen=CFG.speechVoice,signature=JSON.stringify([chosen,state.voices.map(v=>[v.voiceURI,v.name,v.lang])]);
    if(signature!==voiceSignature){
      voiceSignature=signature;select.replaceChildren();
      const auto=document.createElement('option');auto.value='';auto.textContent='自動選擇溫柔中文女聲';select.appendChild(auto);
      for(const v of state.voices){const option=document.createElement('option');option.value=v.voiceURI;option.textContent=v.name+'（'+v.lang+'）';select.appendChild(option);}
      if(chosen&&!state.voices.some(v=>v.voiceURI===chosen)){const missing=document.createElement('option');missing.value=chosen;missing.textContent='上次聲音目前不可用（改用自動）';select.appendChild(missing);}
    }
    select.value=chosen;on.value=String(CFG.speechOn);on.disabled=!state.supported;select.disabled=!state.supported||!state.enabled;preview.disabled=!state.supported||!state.enabled;
    hint.textContent=!state.supported?'這個瀏覽器不支援朗讀，文字與遊戲仍可正常使用。':!state.enabled?'語音已關閉，與背景音樂分開設定。':state.failure?'無法播放語音，請點「試聽」重試，或檢查裝置音量與中文語音。':state.voice?'目前聲音：'+state.voice.name+'。女聲與音色依裝置提供，可在上方選擇。':'等待裝置載入中文語音；若試聽無聲，請在系統安裝中文語音。';
  }
  on.addEventListener('change',save);select.addEventListener('change',save);preview.addEventListener('click',()=>voice.preview());
  voice.listen(render);voice.configure({enabled:!!CFG.speechOn,voice:CFG.speechVoice});
  // 系統語音需使用者操作才可播放；正式開始時以一句簡短提示啟動。
  document.getElementById('enterMenuBtn')?.addEventListener('click',()=>voice.announce('歡迎來到移動迷宮。請選擇你的冒險。',true));
  document.addEventListener('click',event=>{
    // 只讀首頁六個選項的名稱；冒泡階段執行，保留原本按鈕的導覽。
    const choice=event.target.closest('#homePanel .home-action');
    if(choice){voice.announce(choice.querySelector('strong')?.textContent||'',true);return;}
    const button=event.target.closest('[data-voice-action]');if(!button)return;
    if(button.dataset.voiceAction==='replay')voice.readPanel(document.getElementById('towerDialog'));
    else voice.stop();
  });
})();
