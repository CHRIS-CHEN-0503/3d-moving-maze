/* Original procedural stone movement: cached once, one source per maze shift. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MazeStoneAudio=api;})(globalThis,function(){
  'use strict';
  const RATE=22050,DURATION=3.2;
  function render(){
    const data=new Float32Array(Math.round(RATE*DURATION));let seed=0x57a0e,low=0,mid=0,grit=0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
    const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    // Descending slabs, rising slabs, then a heavy settling impact at 2.3 seconds.
    const hits=[[.07,.7,68],[.43,.22,109],[.84,.36,81],[1.43,.55,62],[1.82,.28,96],[2.28,.95,55]];
    for(let i=0;i<data.length;i++){
      const t=i/RATE,n=random();low+=.016*(n-low);mid+=.105*(n-mid);grit+=.38*(n-grit);
      const moving=smooth(t/.14)*(1-smooth((t-.75)/.25))+.92*smooth((t-1.36)/.16)*(1-smooth((t-2.15)/.2));
      const bed=smooth(t/.1)*Math.exp(-Math.max(0,t-2.3)*4.5);
      const uneven=.67+.19*Math.sin(t*21)+.14*Math.sin(t*47+1.3);
      let v=low*2.4*bed+(mid-low)*1.35*moving*uneven+(grit-mid)*.21*moving*uneven;
      for(const [at,weight,hz] of hits){
        const d=t-at;if(d<0||d>1)continue;
        const attack=smooth(d/.009),decay=Math.exp(-d*7);
        // Inharmonic stone resonances, not a musical note or electronic alarm.
        v+=weight*attack*(decay*(.29*Math.sin(2*Math.PI*hz*d)+.16*Math.sin(2*Math.PI*hz*1.57*d)+.1*Math.sin(2*Math.PI*hz*2.31*d))+(mid-low)*1.2*Math.exp(-d*11));
      }
      data[i]=Math.tanh(v*1.7)*.72*smooth((DURATION-t)/.08);
    }
    data[0]=data[data.length-1]=0;return data;
  }
  function create(context,output){
    const samples=render(),buffer=context.createBuffer(1,samples.length,RATE);buffer.getChannelData(0).set(samples);
    let current=null;
    function stop(){if(!current)return;const source=current;current=null;source.onended=null;try{source.stop();}catch(_){}source.disconnect();}
    function play(){
      stop();const source=context.createBufferSource();source.buffer=buffer;source.connect(output);current=source;
      source.onended=()=>{source.disconnect();if(current===source)current=null;};source.start();
    }
    return {play,stop};
  }
  return Object.freeze({render,create,RATE,DURATION});
});
