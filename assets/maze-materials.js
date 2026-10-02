/* One original atlas with deterministic hand-cut surface finishing.
 * Existing 256 px canvases are painted in place, never resized after upload.
 * No additional texture, material, draw call, animation or gameplay random use.
 */
(function(){
  'use strict';
  const tiles={brick:0,tile:1,hedge:2,rock:3,wood:4,grass:5,lavacrack:6,ice:7,books:8};
  let atlas=null,loading=false,failed=false;const pending=[];
  function finish(entry){
    const {canvas,kind}=entry,c=canvas.getContext('2d');
    // Lightweight canvas mocks / unsupported 2D contexts retain the atlas.
    if(!c||typeof c.save!=='function'||typeof c.bezierCurveTo!=='function')return;
    let state=2166136261;for(const letter of kind)state=Math.imul(state^letter.charCodeAt(0),16777619)>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    c.save();c.setTransform(canvas.width/256,0,0,canvas.height/256,0,0);
    const line=(points,width,color)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
    const inset=(x,y,w,h)=>{
      line([[x,y+h],[x,y],[x+w,y]],1.4,'rgba(255,255,246,.25)');
      line([[x+2,y+h],[x+w,y+h],[x+w,y+2]],1.6,'rgba(23,35,42,.2)');
    };
    if(kind==='brick'){
      for(let row=0;row<4;row++)for(let column=-1;column<3;column++){
        const x=column*128+(row%2)*64,y=row*64;
        inset(x+4,y+4,120,56);
        // Chisel chips run along the stone edge, not as fake loose pebbles.
        for(let i=0;i<3;i++){const u=x+9+random()*98;line([[u,y+5],[u+3,y+9],[u+7,y+5]],1,'rgba(42,49,51,.2)');}
      }
    }else if(kind==='tile'){
      for(let row=0;row<4;row++)for(let column=0;column<4;column++)inset(column*64+2,row*64+2,60,60);
      for(let i=0;i<18;i++){const x=random()*256,y=random()*256;line([[x,y],[x+10,y+1],[x+18,y-1]],.55,'rgba(63,72,76,.08)');}
    }else if(kind==='wood'||kind==='books'){
      for(let row=0;row<4;row++){
        inset(2,row*64+3,252,58);
        for(let grain=0;grain<4;grain++){const y=row*64+12+grain*11;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(70,y-9,150,y+10,256,y);c.strokeStyle='rgba(40,35,28,.14)';c.lineWidth=.8;c.stroke();}
        if(kind==='wood'){c.beginPath();c.ellipse(40+row*45,row*64+32,13,5,0,0,Math.PI*2);c.strokeStyle='rgba(35,28,22,.22)';c.lineWidth=1;c.stroke();}
      }
    }else if(kind==='rock'||kind==='ice'||kind==='lavacrack'){
      for(let i=0;i<7;i++){
        let x=random()*256,y=random()*256;const points=[[x,y]];
        for(let j=0;j<4;j++){x+=(random()-.3)*34;y+=12+random()*16;points.push([x,y]);}
        line(points,kind==='ice'?1.3:1.05,kind==='ice'?'rgba(244,255,255,.48)':kind==='lavacrack'?'rgba(255,210,115,.3)':'rgba(22,32,38,.23)');
        if(kind==='rock')line(points.map(([px,py])=>[px+1,py+1]),.7,'rgba(241,242,223,.16)');
      }
    }else if(kind==='hedge'||kind==='grass'){
      for(let i=0;i<85;i++){
        const x=random()*256,y=random()*256,s=3+random()*5;c.beginPath();c.moveTo(x-s,y);c.quadraticCurveTo(x,y-s,x+s,y);c.quadraticCurveTo(x,y+s,x-s,y);c.fillStyle=i%2?'rgba(230,245,204,.12)':'rgba(22,51,31,.14)';c.fill();
      }
    }
    // Fine mineral / fibre variation preserves the dominant environment colour.
    if(kind!=='lavacrack')for(let i=0;i<180;i++){
      const x=random()*256,y=random()*256,s=.45+random()*.95;c.fillStyle=i%3?'rgba(20,30,37,.055)':'rgba(255,255,246,.17)';c.fillRect(x,y,s,s);
    }
    c.restore();entry.texture.needsUpdate=true;
  }
  function paint(entry){
    const {canvas,texture,kind}=entry,index=tiles[kind],edge=atlas.naturalWidth/3;
    // Never resize a texture after WebGL has allocated its immutable storage.
    canvas.getContext('2d').drawImage(atlas,(index%3)*edge,Math.floor(index/3)*edge,edge,edge,0,0,canvas.width,canvas.height);
    finish(entry);
    texture.needsUpdate=true;
  }
  function enhance(canvas,texture,kind){
    if(!(kind in tiles))return;
    texture.anisotropy=2;
    const entry={canvas,texture,kind};
    if(failed){finish(entry);return;}
    if(atlas){paint(entry);return;}
    pending.push(entry);if(loading)return;loading=true;
    const img=new Image();img.onload=()=>{
      atlas=img;const entries=pending.splice(0),canvases=new Set(entries.map(e=>e.canvas));entries.forEach(paint);
      // Floor materials clone textures but share their source canvases.
      if(typeof scene!=='undefined'&&scene)scene.traverse(o=>{
        for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)for(const key of ['map','emissiveMap'])if(m[key]?.isTexture&&canvases.has(m[key].image))m[key].needsUpdate=true;
      });
    };img.onerror=()=>{failed=true;pending.splice(0).forEach(finish);};img.src='./assets/maze-materials-v1.webp';
  }
  window.MazeMaterials={enhance};
})();
