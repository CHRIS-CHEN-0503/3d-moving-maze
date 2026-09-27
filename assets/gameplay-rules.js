(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GameplayRules=api;})(globalThis,function(){
  'use strict';
  // Segment/AABB slab intersection: bounded by wall count, no per-step sampling.
  function clear(a,b,walls=[]){
    if(!a||!b||![a.x,a.z,b.x,b.z].every(Number.isFinite))return false;
    return !walls.some(w=>{
      let low=0,high=1;
      for(const [axis,min,max] of [['x','minX','maxX'],['z','minZ','maxZ']]){
        const d=b[axis]-a[axis];
        if(Math.abs(d)<1e-8){if(a[axis]<=w[min]||a[axis]>=w[max])return false;}
        else{let t1=(w[min]-a[axis])/d,t2=(w[max]-a[axis])/d;if(t1>t2)[t1,t2]=[t2,t1];low=Math.max(low,t1);high=Math.min(high,t2);if(low>=high)return false;}
      }
      return high>0&&low<1;
    });
  }
  function contact(a,b,walls,range){return !!a&&!!b&&Math.hypot(a.x-b.x,a.z-b.z)<=range&&clear(a,b,walls);}
  return Object.freeze({clear,contact});
});
