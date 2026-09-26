/* Original weapon foley: cached buffers, bounded polyphony, no timers/downloads. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CombatAudio=api;})(globalThis,function(){
  'use strict';
  const RATE=22050;
  function render(kind){
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
    const buffers={},active=new Set();
    function release(source){source.onended=null;source.disconnect();active.delete(source);}
    function stopSource(source){try{source.stop();}catch(_){}release(source);}
    function play(kind){
      if(!['swing','hit','hurt','block','defeat'].includes(kind))return;
      if(!buffers[kind]){const data=render(kind),b=context.createBuffer(1,data.length,RATE);b.getChannelData(0).set(data);buffers[kind]=b;}
      if(active.size>=4)stopSource(active.values().next().value);
      const source=context.createBufferSource();source.buffer=buffers[kind];source.connect(output);active.add(source);
      source.onended=()=>release(source);source.start();
    }
    function stop(){for(const source of [...active])stopSource(source);}
    return {play,stop};
  }
  return Object.freeze({RATE,render,create});
});
