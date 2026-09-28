/* Player-centred visibility and last-seen topology. No game RNG or collision writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MazeSightCore=api;})(globalThis,function(){
  'use strict';
  function create(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>25||h>25)throw Error('Invalid sight dimensions');return {w,h,current:new Uint8Array(w*h),seen:new Uint8Array(w*h),horizontal:Array(w*(h-1)).fill(-1),vertical:Array((w-1)*h).fill(-1)};}
  function inside(s,x,y){return x>=0&&y>=0&&x<s.w&&y<s.h;}
  function line(s,ax,ay,bx,by,hw,vw){let x=Math.floor(ax),y=Math.floor(ay),tx=Math.floor(bx),ty=Math.floor(by);if(!inside(s,x,y)||!inside(s,tx,ty))return false;const dx=bx-ax,dy=by-ay,sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?Math.abs(1/dx):Infinity,stepY=dy?Math.abs(1/dy):Infinity;let nextX=dx?(sx>0?x+1-ax:ax-x)/Math.abs(dx):Infinity,nextY=dy?(sy>0?y+1-ay:ay-y)/Math.abs(dy):Infinity;
    const wallX=()=>sx>0?vw[y]?.[x]!==false:vw[y]?.[x-1]!==false,wallY=()=>sy>0?hw[y]?.[x]!==false:hw[y-1]?.[x]!==false;
    for(let i=0;i<52;i++){if(x===tx&&y===ty)return true;if(Math.abs(nextX-nextY)<1e-9){if(wallX()||wallY())return false;const nx=x+sx,ny=y+sy;if(!inside(s,nx,ny)||(sx>0?vw[ny]?.[x]:vw[ny]?.[x-1])!==false||(sy>0?hw[y]?.[nx]:hw[y-1]?.[nx])!==false)return false;x=nx;y=ny;nextX+=stepX;nextY+=stepY;}else if(nextX<nextY){if(wallX())return false;x+=sx;nextX+=stepX;}else{if(wallY())return false;y+=sy;nextY+=stepY;}if(!inside(s,x,y))return false;}return false;
  }
  function update(s,ax,ay,hw,vw,radius=5){s.current.fill(0);for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)if(Math.hypot(x+.5-ax,y+.5-ay)<=radius&&line(s,ax,ay,x+.5,y+.5,hw,vw)){s.current[y*s.w+x]=1;s.seen[y*s.w+x]=1;}
    const px=Math.floor(ax),py=Math.floor(ay);if(inside(s,px,py)){s.current[py*s.w+px]=1;s.seen[py*s.w+px]=1;}
    for(let y=0;y<s.h-1;y++)for(let x=0;x<s.w;x++)if(s.current[y*s.w+x]||s.current[(y+1)*s.w+x])s.horizontal[y*s.w+x]=hw[y][x]?1:0;
    for(let y=0;y<s.h;y++)for(let x=0;x<s.w-1;x++)if(s.current[y*s.w+x]||s.current[y*s.w+x+1])s.vertical[y*(s.w-1)+x]=vw[y][x]?1:0;return s;
  }
  function reveal(s,hw,vw){s.seen.fill(1);s.horizontal=hw.flat().map(Boolean).map(Number);s.vertical=vw.flat().map(Boolean).map(Number);}
  function snapshot(s){return s?{version:1,w:s.w,h:s.h,seen:Array.from(s.seen).join(''),horizontal:s.horizontal.slice(),vertical:s.vertical.slice()}:null;}
  function restore(v){if(!v||v.version!==1)return null;let s;try{s=create(v.w,v.h);}catch{return null;}if(typeof v.seen!=='string'||v.seen.length!==s.w*s.h||/[^01]/.test(v.seen))return null;for(const k of ['horizontal','vertical'])if(!Array.isArray(v[k])||v[k].length!==s[k].length||!v[k].every(n=>[-1,0,1].includes(n)))return null;s.seen=Uint8Array.from(v.seen,Number);s.horizontal=v.horizontal.slice();s.vertical=v.vertical.slice();return s;}
  return Object.freeze({create,inside,line,update,reveal,snapshot,restore});
});
