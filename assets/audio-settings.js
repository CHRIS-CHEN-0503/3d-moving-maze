/* Persist only two device preferences; one shared music/effects bus. */
(function(root){'use strict';
  const KEY='maze3d_audio_mix_v1',defaults={music:100,effects:100};let values={...defaults},ducked=false,engine=null;
  const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
  try{const saved=JSON.parse(root.localStorage.getItem(KEY));if(saved&&valid(saved.music)&&valid(saved.effects))values={music:saved.music,effects:saved.effects};}catch(_){}
  function apply(){if(!engine?.ctx)return;const t=engine.ctx.currentTime;
    for(const [node,gain]of [[engine.musicGain,(ducked?.09:.32)*values.music/100],[engine.fxGain,(ducked?.45:.8)*values.effects/100],[engine.itemGain,(ducked?.16:.4)*values.effects/100]])node?.gain.setTargetAtTime(gain,t,.08);
  }
  function set(key,value){if(!Object.hasOwn(defaults,key)||!valid(value))return false;values[key]=Math.round(value);try{root.localStorage.setItem(KEY,JSON.stringify(values));}catch(_){}apply();return true;}
  function controls(){return '<section class="audio-mix-controls" aria-label="聲音音量">'+[['music','音樂音量'],['effects','音效音量']].map(([key,name])=>'<label class="audio-mix-row"><span>'+name+' <output data-mix-output="'+key+'">'+values[key]+'%</output></span><input type="range" min="0" max="100" step="1" value="'+values[key]+'" data-audio-mix="'+key+'" aria-label="'+name+'"></label>').join('')+'</section>';}
  function input(event){const el=event.target,key=el.dataset.audioMix;if(!key||!set(key,Number(el.value)))return false;const out=el.closest('.audio-mix-row')?.querySelector('output');if(out)out.textContent=values[key]+'%';return true;}
  root.MazeAudioSettings={controls,input,set,get:()=>({...values}),connect:e=>{engine=e;apply();},duck:value=>{ducked=!!value;apply();}};
})(globalThis);
