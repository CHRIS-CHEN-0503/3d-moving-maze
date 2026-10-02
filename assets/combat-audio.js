/* Original weapon foley: cached buffers, bounded polyphony, no timers/downloads. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CombatAudio=api;})(globalThis,function(){
  'use strict';
  const RATE=22050;
  const ACTIONS=Object.freeze({slash:.3,bow:.25,metal:.24,magic:.48,frost:.45,heal:.55,shield:.4,scan:.4,smoke:.32,cook:.45,forge:.42,device:.38,drink:.32,charge:.65,burst:.48,thunder:.8,thorns:.65,meteor:.75,equip:.2,'hit-metal':.25,'hit-magic':.32});
  const SKILL_SOUNDS=Object.freeze({arrow:'bow',binding:'bow',volley:'bow',great_arrow:'bow',cleave:'slash',circle:'slash',blind:'slash',stun:'metal',stagger:'metal',splash:'cook',bolt:'magic',weak:'magic',slow:'slash',mark:'metal',shock:'thunder',thorns:'thorns',repel:'burst',starfall:'meteor',star_ring:'meteor',decisive:'slash',guard:'shield',barrier:'shield',ward:'shield',fortify:'forge',fortress:'shield',rally:'shield',speed:'scan',polish:'forge',stealth:'smoke',smoke:'smoke',stomach:'cook',meal:'cook',soup:'heal',feast:'cook',heal:'heal',revive:'heal',cleanse:'heal',sanctuary:'heal',reveal:'scan',escape:'scan',disarm:'device',daylight:'heal',repair:'forge',frost:'frost',taunt:'metal',barricade:'device'});
  const skillKind=skill=>Object.hasOwn(ACTIONS,skill?.presentation?.sound)?skill.presentation.sound:SKILL_SOUNDS[skill?.effect]||'magic';
  const hitKind=weapon=>['staff','book'].includes(weapon?.type)?'hit-magic':['blade','daggers','hammer','pan'].includes(weapon?.type)?'hit-metal':'hit';
  const itemKind=id=>({heal:'drink',ration:'cook',shield:'shield',hourglass:'scan',bell:'metal',map:'scan'}[id]||'device');
  const chargeSeconds=value=>Number.isFinite(value)&&value>0?Math.min(4,Math.max(.1,Math.round(value*10)/10)):.65;
  function renderAction(kind,seconds){
    const duration=kind==='charge'?chargeSeconds(seconds):ACTIONS[kind],data=new Float32Array(Math.round(RATE*duration));let seed=9143,low=0,peak=0;
    for(let i=0;i<data.length;i++){
      const t=i/RATE,p=i/(data.length-1),tau=Math.PI*2;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const n=seed/2147483648-1;low+=.08*(n-low);
      const air=n-low,attack=Math.min(1,t/.008),tail=Math.pow(1-p,2),tone=f=>Math.sin(tau*f*t);
      let sample=0;
      if(kind==='slash')sample=air*.35*Math.sin(Math.PI*p)+low*.9*Math.sin(Math.PI*p);
      if(kind==='bow')sample=(tone(210)*.28+tone(420)*.13)*Math.exp(-t*25)+air*.25*Math.sin(Math.PI*p);
      if(kind==='metal'||kind==='hit-metal')sample=(tone(420)*.36+tone(713)*.2+tone(1171)*.1+air*.23*Math.exp(-t*55))*Math.exp(-t*(kind==='metal'?9:14));
      if(kind==='magic'||kind==='hit-magic')sample=(Math.sin(tau*(260*t+600*t*t))*.28+tone(780)*.16+low*.9)*Math.sin(Math.PI*Math.min(1,p*1.8));
      if(kind==='frost')sample=(tone(1174)*.2+tone(1568)*.14+air*.28)*Math.exp(-t*6);
      if(kind==='heal')sample=(tone(523)*.22+tone(659)*.18+tone(784)*.16)*Math.sin(Math.PI*p);
      if(kind==='shield')sample=(tone(220)*.25+tone(440)*.14+tone(660)*.12+low*.5)*Math.sin(Math.PI*p);
      if(kind==='scan')sample=Math.sin(tau*(500*t+900*t*t))*.36*(.65+.35*Math.cos(tau*10*t));
      if(kind==='smoke')sample=(low*2+air*.12)*Math.sin(Math.PI*p);
      if(kind==='cook')sample=(air*.23+tone(730)*.15*Math.pow(Math.max(0,Math.cos(tau*9*t)),8))*Math.sin(Math.PI*p);
      if(kind==='forge')sample=(tone(560)*.28+tone(931)*.17+air*.2)*Math.exp(-(t%.17)*24);
      if(kind==='device'||kind==='equip')sample=(tone(180)*.3+tone(640)*.16+air*.25)*Math.exp(-(t%.11)*40);
      if(kind==='drink')sample=(Math.sin(tau*(360*t+40*Math.sin(t*18)*t))*.28+low*.8)*Math.sin(Math.PI*p);
      if(kind==='charge')sample=(Math.sin(tau*(120*t+240*t*t*.65/duration))*.35+tone(360)*.14+low*.6)*p;
      if(kind==='burst')sample=(low*2+Math.sin(tau*(100*t-70*t*t))*.4+air*.16*Math.exp(-t*25))*Math.exp(-t*5);
      if(kind==='thunder')sample=air*.6*Math.exp(-t*28)+low*2.4*Math.exp(-t*3.5)+tone(66)*.3*Math.exp(-t*5)+air*.16*Math.pow(Math.max(0,Math.cos(tau*19*t)),8)*Math.exp(-t*6);
      if(kind==='thorns')sample=(air*.33*Math.pow(Math.max(0,Math.cos(tau*13*t)),12)+low*.9+Math.sin(tau*(320*t-190*t*t))*.28)*Math.sin(Math.PI*p);
      if(kind==='meteor')sample=(air*.25*Math.exp(-t*9)+low*2*Math.exp(-t*4)+Math.sin(tau*(150*t-95*t*t))*.44)*Math.sin(Math.PI*Math.min(1,p*2));
      data[i]=sample*attack*tail;peak=Math.max(peak,Math.abs(data[i]));
    }
    // Consistent short, readable foley. The shared effects bus controls volume.
    if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.72/peak;
    data[0]=data[data.length-1]=0;return data;
  }
  function render(kind,seconds){
    if(Object.hasOwn(ACTIONS,kind))return renderAction(kind,seconds);
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
  function create(context,output){
    const buffers={},active=new Set(),last=new Map();
    function release(source){source.onended=null;source.disconnect();active.delete(source);}
    function stopSource(source){try{source.stop();}catch(_){}release(source);}
    function play(kind,seconds){
      if(!['swing','hit','hurt','block','defeat'].includes(kind)&&!Object.hasOwn(ACTIONS,kind))return;
      const now=context.currentTime;
      // Area attacks share a single hit sound rather than one per victim.
      if(Number.isFinite(now)&&now-(last.get(kind)??-Infinity)<.065)return;
      if(Number.isFinite(now))last.set(kind,now);
      const key=kind==='charge'?kind+':'+chargeSeconds(seconds):kind;
      if(!buffers[key]){const data=render(kind,seconds),b=context.createBuffer(1,data.length,RATE);b.getChannelData(0).set(data);buffers[key]=b;}
      if(active.size>=4)stopSource(active.values().next().value);
      const source=context.createBufferSource();source.buffer=buffers[key];source.connect(output);active.add(source);
      source.onended=()=>release(source);source.start();return ()=>{if(active.has(source))stopSource(source);};
    }
    function stop(){for(const source of [...active])stopSource(source);last.clear();}
    return {play,stop};
  }
  return Object.freeze({RATE,ACTIONS,SKILL_SOUNDS,skillKind,hitKind,itemKind,render,create});
});
