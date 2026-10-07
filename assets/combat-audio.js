/* Original weapon foley: cached buffers, bounded polyphony, no timers/downloads; common sounds are warmed only in idle time. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CombatAudio=api;})(globalThis,function(){
  'use strict';
  const RATE=22050;
  const ACTIONS=Object.freeze({slash:.3,bow:.25,metal:.24,magic:.48,frost:.45,heal:.55,shield:.4,scan:.4,smoke:.32,cook:.45,forge:.42,device:.38,drink:.32,charge:.65,burst:.48,thunder:.8,thorns:.65,meteor:.75,equip:.2,'hit-metal':.25,'hit-magic':.32,robot:.6,'robot-impact':.5,'robot-drive':.7});
  const ALIASES=Object.freeze({barrier:'shield',mechanism:'device'});
  const SKILL_SOUNDS=Object.freeze({arrow:'bow',binding:'bow',volley:'bow',great_arrow:'bow',cleave:'slash',circle:'slash',blind:'slash',stun:'metal',stagger:'metal',splash:'cook',bolt:'magic',weak:'magic',slow:'slash',mark:'metal',shock:'thunder',thorns:'thorns',repel:'burst',starfall:'meteor',star_ring:'meteor',decisive:'slash',guard:'shield',barrier:'shield',ward:'shield',fortify:'forge',fortress:'shield',rally:'shield',speed:'scan',polish:'forge',stealth:'smoke',smoke:'smoke',stomach:'cook',meal:'cook',soup:'heal',feast:'cook',heal:'heal',revive:'heal',cleanse:'heal',sanctuary:'heal',reveal:'scan',escape:'scan',disarm:'device',daylight:'heal',repair:'forge',frost:'frost',taunt:'metal',barricade:'device',robot_fist:'robot',robot_charge:'robot-drive',robot_quake:'robot-impact',robot_guard:'shield',robot_speed:'robot-drive',robot_restore:'forge',robot_meteor:'robot-impact',robot_double:'robot',mech_aid:'shield'});
  // Older robot metadata shares generic hammer/forge sounds. Upgrade only
  // those legacy choices; an intentionally authored elemental sound wins.
  const skillKind=skill=>skill?.job==='robot'&&['metal','forge'].includes(skill?.presentation?.sound)&&SKILL_SOUNDS[skill.effect]?SKILL_SOUNDS[skill.effect]:Object.hasOwn(ACTIONS,skill?.presentation?.sound)?skill.presentation.sound:SKILL_SOUNDS[skill?.effect]||'magic';
  const hitKind=weapon=>['staff','book'].includes(weapon?.type)?'hit-magic':['blade','daggers','hammer','pan','fists'].includes(weapon?.type)?'hit-metal':'hit';
  const itemKind=id=>({heal:'drink',haste:'drink',ration:'cook',shield:'shield',hourglass:'scan',bell:'metal',map:'scan',power_glimmer:'magic',power_starlight:'magic',power_sunheart:'magic'}[id]||'device');
  const chargeSeconds=value=>Number.isFinite(value)&&value>0?Math.min(4,Math.max(.1,Math.round(value*10)/10)):.65;
  // exp/log is several times cheaper than Math.pow and agrees to ~1e-15 for these positive bases.
  const power=(base,exponent)=>Math.exp(exponent*Math.log(base));
  const SWELLING=new Set(['slash','bow','magic','hit-magic','frost','shield','scan','smoke','cook','thorns','robot-drive']);
  // One quiet early reflection gives body without another Web Audio voice,
  // convolution node or a tail that hides the next action/narration syllable.
  function finishAction(kind,data){
    const delay=Math.round(RATE*(kind==='thunder'?.071:.037));
    let peak=0;for(let i=data.length-1;i>=0;i--){if(i>=delay)data[i]+=data[i-delay]*.1*(1-i/data.length);peak=Math.max(peak,Math.abs(data[i]));}
    if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.64/peak;
    data[0]=data[data.length-1]=0;return data;
  }
  function renderAction(kind){
    const data=new Float32Array(Math.round(RATE*ACTIONS[kind])),tau=Math.PI*2,swelling=SWELLING.has(kind);let seed=9143,low=0,rumble=0,t=0;
    // The helpers read the shared sample time, so they are built once per sound instead of once per sample.
    const tone=f=>Math.sin(tau*f*t),pulse=(at,decay)=>t<at?0:Math.min(1,(t-at)/.004)*Math.exp(-(t-at)*decay);
    for(let i=0;i<data.length;i++){
      t=i/RATE;const p=i/(data.length-1);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const n=seed/2147483648-1;low+=.08*(n-low);rumble+=.019*(n-rumble);
      const air=n-low,attack=Math.min(1,t/.004),tail=power(1-p,1.35),swell=swelling?power(Math.sin(Math.PI*p),1.3):0;
      let sample=0;
      if(kind==='slash')sample=(air*.24+low*1.55)*swell+tone(930)*.045*pulse(.1,24);
      if(kind==='bow')sample=(tone(196)*.34+tone(392)*.14+tone(781)*.045)*pulse(0,25)+air*.18*pulse(.018,17)+(low-rumble)*.3*swell;
      if(kind==='metal'||kind==='hit-metal'){const decay=kind==='metal'?8:14;sample=(tone(392)*.27+tone(643)*.16+tone(1093)*.055)*pulse(0,decay)+tone(106)*.24*pulse(0,26)+air*.18*pulse(0,65);}
      if(kind==='magic'||kind==='hit-magic'){const impact=kind==='hit-magic';sample=Math.sin(tau*(240*t+(impact?240:570)*t*t))*.23*swell+tone(720)*.12*pulse(.03,7)+tone(1080)*.04*pulse(.085,9)+low*.5*swell+(impact?rumble*2.6*pulse(0,16):0);}
      if(kind==='frost')sample=(tone(1318)*.16+tone(1760)*.07+tone(2217)*.025)*pulse(.025,7)+air*.16*(pulse(0,42)+.6*pulse(.11,45)+.35*pulse(.2,40))+low*.45*swell;
      if(kind==='heal')sample=tone(523.25)*.25*pulse(.01,3.4)+tone(659.25)*.17*pulse(.075,3.8)+tone(784)*.13*pulse(.15,4.3)+tone(1046.5)*.035*pulse(.23,6);
      if(kind==='shield')sample=(tone(220)*.22+tone(329.6)*.1+tone(440)*.14)*swell+tone(90)*.13*pulse(0,20)+air*.035*pulse(.025,30);
      if(kind==='scan')sample=(Math.sin(tau*(480*t+540*t*t))*.22+tone(960)*.045)*swell*(.78+.22*Math.cos(tau*7*t));
      if(kind==='smoke')sample=(low*1.6+air*.11+rumble*.7)*swell;
      if(kind==='cook')sample=air*.12*swell+tone(510)*.12*pulse(.03,20)+Math.sin(tau*(320*t+65*t*t))*.12*pulse(.11,25)+low*.85*swell;
      if(kind==='forge'){const hammer=pulse(0,18)+.68*pulse(.18,22);sample=(tone(440)*.22+tone(711)*.13+tone(1127)*.035)*hammer+tone(92)*.22*(pulse(0,28)+.6*pulse(.18,30))+air*.11*(pulse(0,65)+.55*pulse(.18,60));}
      if(kind==='device'||kind==='equip'){const second=kind==='equip'?.065:.14;sample=(tone(173)*.26+tone(638)*.08+air*.12)*(pulse(0,36)+.65*pulse(second,40))+tone(286)*.075*pulse(second+.024,17);}
      if(kind==='drink')sample=(Math.sin(tau*(290*t+60*Math.sin(t*15)*t))*.18+low*.75)*(pulse(.025,12)+.65*pulse(.135,14))+air*.06*pulse(0,45);
      if(kind==='burst')sample=(rumble*2.8+low*.85+Math.sin(tau*(110*t-85*t*t))*.27)*pulse(0,5)+air*.11*pulse(0,38);
      if(kind==='thunder')sample=air*.24*(pulse(0,42)+.6*pulse(.095,44)+.3*pulse(.17,48))+rumble*5.6*(pulse(.035,2.6)+.25*pulse(.24,5))+tone(62)*.2*pulse(.035,4)+low*.55*pulse(.12,4);
      if(kind==='thorns')sample=air*.18*(pulse(.035,34)+.75*pulse(.15,40)+.6*pulse(.29,32))+low*1.45*swell+Math.sin(tau*(240*t-110*t*t))*.15*swell;
      if(kind==='meteor')sample=(low*.8+air*.15)*Math.pow(Math.sin(Math.PI*Math.min(1,p*2.8)),2)+(rumble*4+tone(72)*.27)*pulse(.19,4)+air*.15*pulse(.19,30);
      if(kind==='robot')sample=(tone(132)*.18+tone(264)*.07)*pulse(0,15)+Math.sin(tau*(95*t+180*t*t))*.12*pulse(.03,8)+(tone(78)*.28+low*1.5+air*.12)*pulse(.15,13);
      if(kind==='robot-impact')sample=(tone(70)*.3+tone(141)*.11+rumble*4+air*.15)*pulse(0,10)+(tone(387)*.095+tone(637)*.06)*pulse(.025,8);
      if(kind==='robot-drive')sample=Math.sin(tau*(82*t+145*t*t))*.19*swell+tone(164)*.1*swell+low*.85*swell+air*.09*(pulse(.05,20)+.5*pulse(.3,20));
      data[i]=sample*attack*tail;
    }
    return finishAction(kind,data);
  }
  // The 110->480 Hz sweep depends on the length, so each length is synthesized once and remembered.
  function synthesizeCharge(duration){
    const length=Math.round(RATE*duration),data=new Float32Array(length),tau=Math.PI*2;let seed=9143,low=0;
    for(let i=0;i<length;i++){
      const t=i/RATE,p=i/(length-1);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const n=seed/2147483648-1;low+=.08*(n-low);
      const sample=(Math.sin(tau*(110*t+185*t*t/duration))*.29+Math.sin(tau*330*t)*.09+low*.42)*power(p,.65)*(1+.08*Math.sin(tau*6*t));
      data[i]=sample*Math.min(1,t/.004)*power(1-p,1.35);
    }
    return finishAction('charge',data);
  }
  // Each player caches the finished AudioBuffer per length (bufferFor), so a
  // second module-level copy of the samples would only hold memory.
  function renderCharge(seconds){return synthesizeCharge(chargeSeconds(seconds));}
  function render(kind,seconds){
    kind=Object.hasOwn(ALIASES,kind)?ALIASES[kind]:kind;
    if(kind==='charge')return renderCharge(seconds);
    if(Object.hasOwn(ACTIONS,kind))return renderAction(kind);
    const duration=kind==='defeat'?.55:kind==='block'?.28:kind==='hurt'?.3:kind==='swing'?.24:.2,data=new Float32Array(Math.round(RATE*duration));
    let seed=7381,low=0,mid=0;
    for(let i=0;i<data.length;i++){
      const t=i/RATE,p=i/(data.length-1);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const n=seed/2147483648-1;low+=.06*(n-low);mid+=(.15+.5*Math.sin(Math.PI*p))*(n-mid);
      // Rising/falling air versus a woody impact with a low body.
      data[i]=kind==='swing'?(mid-low)*Math.pow(Math.sin(Math.PI*p),1.7)*.85:
        Math.sin(Math.min(1,t/.003)*Math.PI/2)*Math.pow(1-p,2)*
        ((mid-low)*.5*Math.exp(-t*24)+Math.sin(2*Math.PI*(180*t-200*t*t))*.48*Math.exp(-t*13));
      if(kind==='block')data[i]=(Math.sin(t*2*Math.PI*780)*.26+Math.sin(t*2*Math.PI*1243)*.17+(mid-low)*.5)*Math.min(1,t/.003)*Math.exp(-t*18)*(1-p);
      if(kind==='defeat')data[i]=(low*1.4*Math.exp(-t*8)+Math.sin(t*2*Math.PI*392)*.17+Math.sin(t*2*Math.PI*588)*.12)*Math.min(1,t/.008)*Math.pow(1-p,2);
      if(kind==='hurt')data[i]=(Math.sin(2*Math.PI*(100*t-90*t*t))*.5+low*.5)*Math.min(1,t/.005)*Math.exp(-t*12)*(1-p);
    }
    data[0]=data[data.length-1]=0;return data;
  }
  // Most frequent sounds first, then every charge length a skill or cooperation cast can request.
  const WARM=Object.freeze([['swing'],['hit'],['hit-metal'],['hit-magic'],['slash'],['bow'],['magic'],['metal'],['hurt'],['block'],['heal'],['shield'],
    ...[.5,.7,.8,.9,1,1.2,1.6].map(seconds=>['charge',seconds])]);
  const IDLE_SLICE_MS=8;
  function create(context,output,{voice=()=>globalThis.GameVoice?.status?.(),idle=globalThis.requestIdleCallback}={}){
    const buffers={},active=new Set(),last=new Map(),levels=new Map();
    function bufferFor(kind,seconds){
      const key=kind==='charge'?kind+':'+chargeSeconds(seconds):kind;
      if(!buffers[key]){const data=render(kind,seconds),b=context.createBuffer(1,data.length,RATE);b.getChannelData(0).set(data);buffers[key]=b;}
      return buffers[key];
    }
    function release(source){source.onended=null;source.disconnect();levels.get(source)?.disconnect();levels.delete(source);active.delete(source);}
    function stopSource(source){try{source.stop();}catch(_){}release(source);}
    function play(kind,seconds){
      kind=Object.hasOwn(ALIASES,kind)?ALIASES[kind]:kind;
      if(!['swing','hit','hurt','block','defeat'].includes(kind)&&!Object.hasOwn(ACTIONS,kind))return;
      const now=context.currentTime;
      // Area attacks share a single hit sound rather than one per victim.
      if(Number.isFinite(now)&&now-(last.get(kind)??-Infinity)<.065)return;
      if(Number.isFinite(now))last.set(kind,now);
      const buffer=bufferFor(kind,seconds);
      if(active.size>=4)stopSource(active.values().next().value);
      const source=context.createBufferSource();source.buffer=buffer;
      // Four simultaneous normal voices stay below unity even before the
      // existing effects/master controls. Narration keeps first priority.
      if(typeof context.createGain==='function'){
        const gain=context.createGain();let speaking=false;try{const status=voice?.();speaking=!!(status?.speaking||status?.loadingVoice||status?.loadingAudio);}catch{/* Audio remains available if speech status is unavailable. */}
        gain.gain.value=(kind==='charge'?.22:.32)*(speaking?.36:1);source.connect(gain);gain.connect(output);levels.set(source,gain);
      }else source.connect(output);
      active.add(source);
      source.onended=()=>release(source);source.start();return ()=>{if(active.has(source))stopSource(source);};
    }
    function stop(){for(const source of [...active])stopSource(source);last.clear();}
    // Synthesis is synchronous, so warm the common sounds only when the browser reports idle time.
    if(typeof idle==='function'){
      const queue=[...WARM],warm=deadline=>{
        while(queue.length&&deadline.timeRemaining()>=IDLE_SLICE_MS)bufferFor(...queue.shift());
        if(queue.length)idle(warm);
      };
      idle(warm);
    }
    return {play,stop};
  }
  return Object.freeze({RATE,ACTIONS,ALIASES,SKILL_SOUNDS,skillKind,hitKind,itemKind,render,create});
});
