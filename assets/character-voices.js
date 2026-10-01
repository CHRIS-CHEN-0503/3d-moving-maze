/* Original short role lines. Built-in synthetic voices, no human voice cloning. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MazeCharacterVoices=api;})(globalThis,function(){
  'use strict';
  const lines={
    swordsman:{male:['我來帶隊，大家跟緊！','先穩住，我還能守住！','前方安全了，繼續走吧。'],female:['我來迎戰，跟在我身後！','我需要掩護，先站穩！','前方沒有怪物了，我們走吧。']},
    mage:{male:['看我的魔法，退後一點！','魔力還在，先保護自己！','危險解除了，繼續探路。'],female:['讓魔法打開前路！','幫我擋一下，我先休息！','魔法奏效了，大家沒事吧？']},
    scout:{male:['找到破綻了，跟我來！','先躲開，別硬撐！','安全了，前方還有路。'],female:['我來吸引牠，抓住機會！','我先退一步，幫我掩護！','這條路可以放心走了。']},
    chef:{male:['鍋子上場，讓一讓！','得補充一下，幫我擋住！','收工，待會煮點好吃的！'],female:['小心熱湯，我來幫忙！','我需要補給，先別衝太快！','大家辛苦了，等等開飯！']},
    healer:{male:['別怕，我會照顧大家！','我也受傷了，需要幫忙！','危險過了，讓我看看傷口。'],female:['我在這裡，大家互相照應！','請掩護我，先處理傷口！','都平安就好，繼續前進吧。']},
    smith:{male:['輪到我出手了！','先保護我，我得站穩！','解決了，檢查一下裝備吧。'],female:['我來敲開這條路！','我需要幫忙，再打一次！','安全了，裝備還撐得住。']},
    archer:{male:['目標看見了，準備放箭！','幫我掩護，我先退後！','目標倒下了，繼續前進。'],female:['弓箭準備好了，開始攻擊！','別讓牠靠近，幫我一下！','怪物倒下了，路上安全了。']},
  };
  const voices={swordsman:{male:'dylan',female:'vivian'},mage:{male:'dylan',female:'serena'},scout:{male:'dylan',female:'vivian'},chef:{male:'uncle_fu',female:'serena'},healer:{male:'dylan',female:'serena'},smith:{male:'uncle_fu',female:'vivian'},archer:{male:'dylan',female:'serena'}};
  const specialties={
    swordsman:{male:'我會守住大家，放心前進！',female:'靠近我，我來保護大家！'},
    mage:{male:'日光術，照亮前方的路。',female:'讓光陪著我們，別怕黑。'},
    scout:{male:'陷阱拆好了，放心走吧。',female:'這個陷阱交給我，安全了！'},
    chef:{male:'香味出來了，準備開飯！',female:'熱騰騰的料理，做好囉！'},
    healer:{male:'慢慢呼吸，我來治療你。',female:'傷口會好的，我陪著你。'},
    smith:{male:'鍛造完成，試試這份手藝！',female:'裝備做好了，更可靠了！'},
    archer:{male:'拉弓，放箭！',female:'弓箭準備好了，發射！'},
  };
  const events=['battle','danger','victory','specialty'],tracks={};
  for(const [job,sexes]of Object.entries(lines))for(const [gender,sentences]of Object.entries(sexes))sentences.forEach((text,i)=>{
    const id='character.'+job+'.'+gender+'.'+events[i];
    tracks[id]=Object.freeze({src:'./assets/voice/characters/'+job+'-'+gender+'-'+events[i]+'.mp3',text,speaker:voices[job][gender],instruction:(gender==='male'?'成年男性，':'成年女性，')+'温暖清楚，冒险游戏角色说话，自然正常语速，不要夸张尖叫。',category:'character-bark'});
  });
  for(const [job,sexes]of Object.entries(specialties))for(const [gender,text]of Object.entries(sexes)){const id='character.'+job+'.'+gender+'.specialty';tracks[id]=Object.freeze({src:'./assets/voice/characters/'+job+'-'+gender+'-specialty.mp3',text,speaker:voices[job][gender],instruction:(gender==='male'?'成年男性，':'成年女性，')+'普通话自然清楚，正常语速，温暖自信，不要唱歌。',category:'character-bark'});}
  function create(ctx){let clock=0,next=0;const played=new Map(),low=new Set();
    function say(event,id,{allowPaused=false}={}){const H=globalThis.TowerHeroes,run=ctx.run(),voice=ctx.voice||globalThis.GameVoice;if(!H?.enabled(run)||!H.ids(run).includes(id)||!voice||!allowPaused&&ctx.paused?.())return false;
      const key=id+':'+event,status=voice.status();if(!status.enabled||!status.supported||status.speaking||clock<next||clock<(played.get(key)||0))return false;
      const asset='character.'+H.job(run,id)+'.'+H.sex(run,id)+'.'+event,track=tracks[asset];if(!track)return false;
      played.set(key,clock+45);next=clock+12;voice.announceAsset(asset,track.text,false,{identity:'party-'+id,gender:H.sex(run,id),age:'adult'});return true;
    }
    function tick(dt){clock+=dt;const H=globalThis.TowerHeroes,run=ctx.run();if(!H?.enabled(run))return;for(const id of H.ids(run)){const ratio=H.hp(run,id)/H.maxHp(run,id);if(ratio>.5)low.delete(id);if(ratio>0&&ratio<=.25&&!low.has(id)){if(say('danger',id))low.add(id);}}}
    return {say,tick,reset(){clock=0;next=0;played.clear();low.clear();}};
  }
  return {tracks:Object.freeze(tracks),events,create};
});
