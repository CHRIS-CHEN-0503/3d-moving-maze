/* Exploration is local to each player. Revealing a map never grants opponents' positions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MagicMap=api;})(globalThis,function(){
  'use strict';
  let state=null,peek=null;
  function create(w,h){
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>25||h>25)throw new RangeError('Invalid maze dimensions');
    return{w,h,seen:new Uint8Array(w*h),revealed:false};
  }
  function explore(s,x,y,hWalls,vWalls,radius=2){
    if(!s||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=s.w||y>=s.h)return;
    const queue=[[x,y,0]],visited=new Set([y*s.w+x]);
    for(let i=0;i<queue.length;i++){
      const [cx,cy,d]=queue[i];s.seen[cy*s.w+cx]=1;if(d>=radius)continue;
      const next=[[cx-1,cy,cx>0&&vWalls[cy]?.[cx-1]===false],[cx+1,cy,cx<s.w-1&&vWalls[cy]?.[cx]===false],
        [cx,cy-1,cy>0&&hWalls[cy-1]?.[cx]===false],[cx,cy+1,cy<s.h-1&&hWalls[cy]?.[cx]===false]];
      for(const [nx,ny,open] of next){const key=ny*s.w+nx;if(open&&!visited.has(key)){visited.add(key);queue.push([nx,ny,d+1]);}}
    }
  }
  function enabled(story,mode,rules){return mode!=='shop'&&(story||rules?.magicMap===1);}
  function count(size){return size<=11?1:2;}
  function reset(w,h){state=create(w,h);peek=null;}
  function reveal(){if(state)state.revealed=true;}
  function isRevealed(){return !!state?.revealed;}
  function visible(x,y){return !!state&&x>=0&&y>=0&&x<state.w&&y<state.h&&(state.revealed||state.seen[y*state.w+x]===1||peek?.seen[y*state.w+x]===1);}
  function layoutKey(hWalls,vWalls){
    let hash=2166136261;
    for(const rows of [hWalls,vWalls])for(const row of rows||[])for(const wall of row)hash=Math.imul(hash^(wall?1:0),16777619);
    return (hash>>>0).toString(16);
  }
  function snapshot(hWalls,vWalls){return state?{w:state.w,h:state.h,key:layoutKey(hWalls,vWalls),seen:Array.from(state.seen).join(''),revealed:state.revealed}:null;}
  function restore(saved,hWalls,vWalls){
    if(!state||!saved||saved.w!==state.w||saved.h!==state.h||saved.key!==layoutKey(hWalls,vWalls)||typeof saved.revealed!=='boolean'||typeof saved.seen!=='string'||saved.seen.length!==state.w*state.h||/[^01]/.test(saved.seen))return false;
    state.seen=Uint8Array.from(saved.seen,Number);state.revealed=saved.revealed;return true;
  }
  function mask(ctx,{w,h,x,y,hWalls,vWalls,pad,cw,ch}){
    if(!state||state.w!==w||state.h!==h)reset(w,h);
    explore(state,x,y,hWalls,vWalls);
    const radius=globalThis.TowerMode?.temporaryMapRadius?.()||0;peek=radius>0?create(w,h):null;if(peek)explore(peek,x,y,hWalls,vWalls,radius);
    if(state.revealed)return;
    ctx.save();ctx.fillStyle='#0b1727';
    for(let cy=0;cy<h;cy++)for(let cx=0;cx<w;cx++)if(!state.seen[cy*w+cx]&&!peek?.seen[cy*w+cx])ctx.fillRect(pad+cx*cw-.6,pad+cy*ch-.6,cw+1.2,ch+1.2);
    ctx.restore();
  }
  return Object.freeze({create,explore,enabled,count,reset,reveal,isRevealed,visible,snapshot,restore,mask});
});
