/* Lightweight DOM only: gameplay rules live next to mode selection. */
(function(){
  'use strict';
  const panel=document.getElementById('matchSettings');
  for(const [key,def] of Object.entries(GameRules.FIELDS)){
    const label=document.createElement('label');label.className='match-field';label.dataset.rule=key;
    const caption=document.createElement('span');caption.textContent=def.label;label.appendChild(caption);
    const input=document.createElement(def.choices?'select':'input');input.id='rule-'+key;
    if(def.choices)for(const size of def.choices){const option=document.createElement('option');option.value=size;option.textContent=def.labels?.[size]||(key==='teamSize'?size+' 對 '+size:size+' × '+size);input.appendChild(option);}
    else{input.type='number';input.min=def.min;input.max=def.max;input.step=def.step;input.inputMode='decimal';}
    input.value=CFG[key];label.appendChild(input);panel.appendChild(label);
    input.addEventListener('change',()=>{const rules=GameRules.normalize({...CFG,[key]:input.value});CFG[key]=rules[key];input.value=rules[key];saveCfg();});
  }
  const viewRow=document.createElement('fieldset');viewRow.className='match-views';
  const legend=document.createElement('legend');legend.textContent='允許的視角';viewRow.appendChild(legend);
  for(const [id,title] of [['tp','第三人稱'],['fp','第一人稱'],['top','俯視']]){
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!CFG.views[id];
    input.addEventListener('change',()=>{if(!input.checked&&Object.values(CFG.views).filter(Boolean).length===1){input.checked=true;showToast('至少保留一種視角');return;}CFG.views[id]=input.checked?1:0;saveCfg();applyViewConfig();});
    label.append(input,document.createTextNode(title));viewRow.appendChild(label);
  }
  panel.appendChild(viewRow);
  const musicLabel=document.createElement('label');musicLabel.className='match-field';musicLabel.textContent='本機音樂';
  const music=document.createElement('select');music.id='matchMusic';music.setAttribute('aria-label','本機音樂');
  for(const [value,title] of [['1','開啟'],['0','關閉']]){const option=document.createElement('option');option.value=value;option.textContent=title;music.appendChild(option);}
  music.value=String(CFG.musicOn);music.addEventListener('change',()=>{CFG.musicOn=Number(music.value);G.muted=!CFG.musicOn;saveCfg();updateSoundBtn();});musicLabel.appendChild(music);panel.appendChild(musicLabel);
  function refresh(){
    const shown=GameRules.visible(G.spMode);
    panel.querySelectorAll('[data-rule]').forEach(row=>{row.hidden=!shown.includes(row.dataset.rule);});
    panel.querySelector('[data-rule="itemCount"] > span').textContent=G.spMode==='shop'?'每次出現的？道具箱':'每次出現的道具';
    document.getElementById('matchSettingsHint').textContent=entryMode==='multi'?'建立房間時使用這組規則；加入朋友房間則跟隨房主。':G.spMode==='tag'?'飽足感歸零會變慢，鬼抓人不會因此失敗。':'本次冒險使用以下規則，可隨時在開始前調整。';
    if(G.spMode==='ctf')document.getElementById('matchSettingsHint').textContent='中央搶旗，送進敵方基地守住 3 秒。同隊不誤傷；持旗減速 18%；R 傳旗。受擊回基地、掉旗 20 秒自動歸中。單人可與電腦練習；多人由房主選擇電腦補位，關閉時須等雙方人數到齊。';
  }
  document.getElementById('spModeRow').addEventListener('click',refresh);
  document.getElementById('profileNextBtn').addEventListener('click',refresh);
  document.getElementById('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')refresh();});
  document.getElementById('admSave').addEventListener('click',()=>{music.value=String(CFG.musicOn);});
  // Commit from the visible form before starting, including mobile keyboards that do not blur first.
  document.getElementById('startBtn').addEventListener('click',()=>{
    const values={...CFG};for(const key of Object.keys(GameRules.FIELDS))values[key]=document.getElementById('rule-'+key).value;
    Object.assign(CFG,GameRules.normalize(values));saveCfg();
    for(const key of Object.keys(GameRules.FIELDS))document.getElementById('rule-'+key).value=CFG[key];
  },true);
  refresh();
})();
