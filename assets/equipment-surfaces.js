/* Original, model-owned 128px surface atlas. Drawn once on equipment creation,
   never during animation; no download, shared texture cache or extra lights. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.EquipmentSurfaces=api;})(globalThis,function(){
  'use strict';
  const SIZE=128,REGIONS=Object.freeze({metal:[2/128,66/128,60/128,60/128],leather:[66/128,66/128,60/128,60/128],fabric:[2/128,2/128,60/128,60/128],paper:[66/128,2/128,60/128,60/128]});
  function path(ctx,points,close=false){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);if(close)ctx.closePath();ctx.stroke();}
  // Small authored maker marks repeat the same heraldry as the raised model.
  function emblem(ctx,job,x,y,r){
    ctx.save();ctx.translate(x,y);ctx.lineWidth=.75;ctx.strokeStyle='#b6bec5';
    const p=points=>path(ctx,points.map(([a,b])=>[a*r,b*r]));
    if(job==='swordsman'){p([[-.65,-.75],[.65,-.75],[.55,.3],[0,.95],[-.55,.3],[-.65,-.75]]);p([[0,-.55],[0,.55]]);p([[-.35,-.15],[.35,-.15]]);}
    else if(job==='smith'){p([[-.8,-.25],[.8,-.25],[.55,.15],[-.55,.15],[-.8,-.25]]);p([[0,.15],[0,.7]]);p([[-.55,.75],[.55,.75]]);}
    else if(job==='chef'){p([[-.7,0],[-.55,.6],[.55,.6],[.7,0],[-.7,0]]);p([[-.8,-.1],[.8,-.1]]);p([[-.25,-.35],[-.4,-.6],[-.2,-.85]]);p([[.25,-.35],[.1,-.6],[.3,-.85]]);}
    else if(job==='scout'){p([[-.6,-.7],[.15,.65]]);p([[.6,-.7],[-.15,.65]]);p([[-.55,.45],[-.25,.65]]);p([[.55,.45],[.25,.65]]);}
    else if(job==='archer'){ctx.beginPath();ctx.moveTo(-.2*r,-.9*r);ctx.quadraticCurveTo(1.1*r,0,-.2*r,.9*r);ctx.stroke();p([[-.2,-.9],[-.2,.9]]);p([[-.65,0],[.85,0],[.55,-.25]]);}
    else if(job==='healer'){p([[0,.85],[0,-.8]]);ctx.beginPath();ctx.ellipse(-r*.32,-r*.22,r*.45,r*.2,-.5,0,Math.PI*2);ctx.ellipse(r*.3,-r*.58,r*.4,r*.18,.5,0,Math.PI*2);ctx.stroke();}
    else{p([[0,-.9],[.7,0],[0,.9],[-.7,0],[0,-.9]]);p([[-.85,0],[.85,0]]);p([[0,-.55],[0,.55]]);}
    ctx.restore();
  }
  function metal(ctx,tier,job){
    const wash=ctx.createLinearGradient(0,0,64,64);wash.addColorStop(0,'#f8fbff');wash.addColorStop(.46,'#d5dfe7');wash.addColorStop(.55,'#eef4f8');wash.addColorStop(1,'#c4d0d9');ctx.fillStyle=wash;ctx.fillRect(0,0,64,64);
    ctx.lineWidth=.45;for(let i=0;i<28;i++){const x=(i*19+5)%62,y=(i*13+7)%62;ctx.strokeStyle=i%3?'#e5ebf0':'#bdcbd5';path(ctx,[[x,y],[Math.min(63,x+2+(i%4)),y-.7]]);}
    ctx.strokeStyle='#b3c0cb';ctx.lineWidth=.8;ctx.strokeRect(5.5,5.5,53,53);ctx.strokeStyle='#f5f8fb';ctx.strokeRect(7,7,50,50);
    if(tier>1){ctx.strokeStyle='#aebbc7';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(32+side*22,11);ctx.bezierCurveTo(32+side*8,13,32+side*25,27,32+side*13,37);ctx.bezierCurveTo(32+side*7,43,32+side*15,49,32+side*22,51);ctx.stroke();}}
    if(tier>=3){emblem(ctx,job,32,29,9+tier);ctx.strokeStyle='#c0cbd3';for(const y of [15,48])path(ctx,[[20,y],[26,y-2],[32,y],[38,y-2],[44,y]]);}
    if(tier>=4){ctx.strokeStyle='#a7b6c3';for(const x of [14,50])for(const y of [15,48])path(ctx,[[x,y-3],[x+2,y],[x,y+3],[x-2,y],[x,y-3]]);}
  }
  function leather(ctx,tier){
    ctx.fillStyle='#eef0ef';ctx.fillRect(64,0,64,64);for(let i=0;i<220;i++){ctx.fillStyle=i%3?'#d9dedb':'#f5f7f5';ctx.fillRect(65+(i*29%62),1+(i*41%62),.8,.6);}
    ctx.lineWidth=.55;ctx.strokeStyle='#a3b0ab';path(ctx,[[69,3],[69,61]]);path(ctx,[[123,3],[123,61]]);ctx.strokeStyle='#f9faf8';
    for(let y=7;y<60;y+=4){path(ctx,[[70,y],[73,y-2]]);path(ctx,[[119,y-2],[122,y]]);}
    if(tier>1){ctx.strokeStyle='#bdc7c1';ctx.lineWidth=.7;for(let y=8;y<58;y+=10)path(ctx,[[78,y],[96,y+6],[114,y]]);}
    if(tier>=3){ctx.strokeStyle='#a9b7ad';ctx.beginPath();ctx.ellipse(96,32,12,18,0,0,Math.PI*2);ctx.stroke();}
  }
  function fabric(ctx,tier,job){
    ctx.fillStyle='#f6f7f5';ctx.fillRect(0,64,64,64);ctx.lineWidth=.35;
    for(let i=0;i<64;i+=3){ctx.strokeStyle=i%2?'#d9dfdb':'#e8ede9';path(ctx,[[i,64],[i,128]]);path(ctx,[[0,64+i],[64,64+i]]);}
    ctx.strokeStyle='#bec9bf';ctx.lineWidth=.85;for(const x of [6,58])path(ctx,[[x,68],[x,124]]);ctx.strokeStyle='#eef2ec';for(const x of [8,56])path(ctx,[[x,68],[x,124]]);
    if(tier>1){ctx.strokeStyle='#bbc7bd';for(let y=75;y<122;y+=12)path(ctx,[[5,y],[9,y+3],[5,y+6]]);}
    if(tier>=3){emblem(ctx,job,32,93,9);ctx.strokeStyle='#c8d2c9';for(const y of [73,118])path(ctx,[[14,y],[25,y-2],[32,y+1],[39,y-2],[50,y]]);}
  }
  function paper(ctx,tier,job){
    ctx.fillStyle='#fffaf0';ctx.fillRect(64,64,64,64);ctx.strokeStyle='#d8cfba';ctx.lineWidth=.5;ctx.strokeRect(69,69,54,54);ctx.strokeStyle='#89938c';
    for(let row=0;row<6;row++){const y=77+row*6;for(let col=0;col<5;col++){const x=76+col*8;path(ctx,[[x,y],[x+1,y-2],[x+3,y+1],[x+5,y-1]]);}}
    if(tier>=3)emblem(ctx,job,111,113,6);ctx.strokeStyle='#ebe2d0';for(const y of [67,125])path(ctx,[[65,y],[127,y]]);
  }
  function create(T,{tier=1,job='swordsman',kind='',sex='male'}={},documentObject=typeof document==='object'?document:null){
    if(!documentObject?.createElement||!T?.CanvasTexture)return null;
    const canvas=documentObject.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext?.('2d');if(!ctx)return null;
    metal(ctx,tier,job);leather(ctx,tier);fabric(ctx,tier,job);paper(ctx,tier,job);
    const texture=new T.CanvasTexture(canvas);if(T.SRGBColorSpace)texture.colorSpace=T.SRGBColorSpace;else texture.encoding=T.sRGBEncoding;texture.anisotropy=1;texture.name='original-equipment-'+kind+'-'+job+'-'+sex;
    texture.userData={equipmentOwned:true,procedural:true,size:SIZE,tier,job,sex,kind,bytes:SIZE*SIZE*4};return texture;
  }
  function coordinates(T,geometry,surface){
    const r=REGIONS[surface];if(!r)return;
    const uv=geometry.attributes.uv,positions=geometry.attributes.position;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for(let i=0;i<positions.count;i++){const x=uv?uv.getX(i):positions.getX(i),y=uv?uv.getY(i):positions.getY(i);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    const values=[];for(let i=0;i<positions.count;i++){const u=((uv?uv.getX(i):positions.getX(i))-x0)/(x1-x0||1),v=((uv?uv.getY(i):positions.getY(i))-y0)/(y1-y0||1);values.push(r[0]+u*r[2],r[1]+v*r[3]);}
    geometry.setAttribute('uv',new T.Float32BufferAttribute(values,2));
  }
  return Object.freeze({SIZE,REGIONS,create,coordinates});
});
