/* One original atlas; 256 px surfaces, no new lights or draw calls. */
(function(){
  'use strict';
  const tiles={brick:0,tile:1,hedge:2,rock:3,wood:4,grass:5,lavacrack:6,ice:7,books:8};
  let atlas=null,loading=false,failed=false;const pending=[];
  function paint(entry){
    const {canvas,texture,kind}=entry,index=tiles[kind],edge=atlas.naturalWidth/3;
    // Never resize a texture after WebGL has allocated its immutable storage.
    canvas.getContext('2d').drawImage(atlas,(index%3)*edge,Math.floor(index/3)*edge,edge,edge,0,0,canvas.width,canvas.height);
    texture.needsUpdate=true;
  }
  function enhance(canvas,texture,kind){
    if(failed||!(kind in tiles))return;
    texture.anisotropy=2;
    const entry={canvas,texture,kind};
    if(atlas){paint(entry);return;}
    pending.push(entry);if(loading)return;loading=true;
    const img=new Image();img.onload=()=>{
      atlas=img;const entries=pending.splice(0),canvases=new Set(entries.map(e=>e.canvas));entries.forEach(paint);
      // Floor materials clone textures but share their source canvases.
      if(typeof scene!=='undefined'&&scene)scene.traverse(o=>{
        for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)for(const key of ['map','emissiveMap'])if(m[key]?.isTexture&&canvases.has(m[key].image))m[key].needsUpdate=true;
      });
    };img.onerror=()=>{failed=true;pending.length=0;};img.src='./assets/maze-materials-v1.webp';
  }
  window.MazeMaterials={enhance};
})();
