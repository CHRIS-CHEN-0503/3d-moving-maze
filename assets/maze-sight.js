/* Render-only, bounded fog/history batches. All temporary visibility is restored in finally. */
(function(root){'use strict';const C=root.MazeSightCore;let state=null,layer=null,source=null,liveWalls=null,memoryWalls=null,fog=null,shade=null,last=0,revealed=false,frame=null,changed=[],batches=[];const hidden=new Set(),owned=new Set(),released=new Set();
  // fullVision (shops) drops the fog entirely; overview (the owl flight) only stops masking for a
  // while: exploration memory and the built layer stay, so landing restores the same fog at once.
  function active(){return !!frame&&!frame.fullVision&&!frame.overview&&['tp','top'].includes(frame.g.view);}
  function own(resource){if(!owned.has(resource)){owned.add(resource);resource.addEventListener('dispose',()=>released.add(resource));}return resource;}
  function clearLayer(){layer?.parent?.remove(layer);for(const resource of owned)if(!released.has(resource))resource.dispose();layer?.clear();owned.clear();released.clear();layer=null;batches=[];}
  // A rebuild (each maze shift) keeps the previous clones alive until the new
  // layer has drawn twice, so their shader programs are reused, not recompiled.
  let retiring=[];
  function retireLayer(){if(!layer)return;layer.parent?.remove(layer);retiring.push({layer,owned:[...owned],released:new Set(released),frames:2});owned.clear();released.clear();layer=null;batches=[];}
  function flushRetiring(force=false){if(!retiring.length)return;const keep=[];for(const item of retiring){if(!force&&--item.frames>0){keep.push(item);continue;}for(const resource of item.owned)if(!item.released.has(resource))resource.dispose();item.layer.clear();}retiring=keep;}
  function reset(){restore();clearLayer();flushRetiring(true);state=source=frame=null;last=0;revealed=false;}
  function build(f){retireLayer();const T=f.T,g=f.g,n=2*g.mazeW*g.mazeH+4;layer=new T.Group();layer.name='maze-sight-layer';layer.visible=false;f.scene.add(layer);
    const mesh=(geo,mat,count)=>{const m=own(new T.InstancedMesh(own(geo),own(mat),count));m.frustumCulled=false;m.count=0;layer.add(m);return m;};
    liveWalls=mesh(f.wall.geometry.clone(),f.wall.material.clone(),n);
    // Remembered terrain is a quiet floor plan, not a second full-height grey maze.
    memoryWalls=mesh(new T.BoxGeometry(1,.08,1),new T.MeshBasicMaterial({color:0x354553,fog:false}),n);
    fog=mesh(new T.PlaneGeometry(g.cell,g.cell),new T.MeshBasicMaterial({color:0x091321,side:T.DoubleSide,fog:false}),g.mazeW*g.mazeH);shade=mesh(new T.PlaneGeometry(g.cell,g.cell),new T.MeshBasicMaterial({color:0x14212e,side:T.DoubleSide,fog:false}),g.mazeW*g.mazeH);
    for(const parent of [f.atmosphere?.wallRoot,f.atmosphere?.floorRoot])for(const src of parent?.children||[])if(src.isInstancedMesh)batches.push({src,mesh:mesh(src.geometry.clone(),src.material.clone(),src.count),wall:parent===f.atmosphere.wallRoot});source=f.wall;
  }
  // Grid coordinates without temporary objects: these run per object every frame.
  function gx(x){return x/frame.g.cell+frame.g.mazeW/2;}
  function gy(z){return z/frame.g.cell+frame.g.mazeH/2;}
  let scratch=null;function temp(T){if(!scratch||scratch.T!==T)scratch={T,m:new T.Matrix4(),q:new T.Quaternion(),p:new T.Vector3(),s:new T.Vector3(),tint:new T.Color(),world:new T.Vector3()};return scratch;}
  function current(x,y){return !!state&&C.inside(state,x,y)&&!!state.current[y*state.w+x];}
  function cellVisible(x,y){if(frame?.fullVision||frame?.overview)return true;return current(x,y);}
  function visible(x,z){if(!active())return true;const px=gx(x),py=gy(z),ax=gx(frame.g.px),ay=gy(frame.g.pz);return Math.hypot(px-ax,py-ay)<=frame.radius&&C.line(state,ax,ay,px,py,frame.g.hWalls,frame.g.vWalls);}
  function tile(x,z){return current(Math.floor(gx(x)),Math.floor(gy(z)));}
  function update(f,now=performance.now()){if(f.fullVision){if(layer||state)reset();frame=f;return;}frame=f;const g=f.g;if(!g.hWalls||!g.vWalls||!f.wall)return;if(!state||state.w!==g.mazeW||state.h!==g.mazeH)state=C.create(g.mazeW,g.mazeH);if(source!==f.wall)build(f);if(now-last<100&&!f.force)return;last=now;const ax=gx(g.px),ay=gy(g.pz);
    // The grid remains the occluder while walls animate down, so a shift never grants X-ray vision.
    C.update(state,ax,ay,g.hWalls,g.vWalls,f.radius);const magic=!!root.MagicMap?.isRevealed();if(magic&&!revealed)C.reveal(state,g.hWalls,g.vWalls);revealed=magic;
    const T=f.T,{m,q,p,s,tint}=temp(T),counts={live:0,memory:0,fog:0,shade:0};q.identity();
    const put=(mesh,key,x,y,z,sx,sz)=>{p.set(x,y,z);s.set(sx,1,sz);m.compose(p,q,s);mesh.setMatrixAt(counts[key]++,m);};
    for(const b of g.wallBoxes){const exists=b.boundary||(b.type==='h'?g.hWalls[b.gy]?.[b.gx]:g.vWalls[b.gy]?.[b.gx]);const show=exists&&(b.boundary||(b.type==='h'?(current(b.gx,b.gy)||current(b.gx,b.gy+1)):(current(b.gx,b.gy)||current(b.gx+1,b.gy))));if(show)put(liveWalls,'live',(b.minX+b.maxX)/2,g.wallH/2,(b.minZ+b.maxZ)/2,b.maxX-b.minX,b.maxZ-b.minZ);}
    // Historical layout stays in the minimap only. Do not draw grey floor-plan
    // outlines through the hidden surrounding maze in the main 3D view.
    for(let y=0;y<state.h;y++)for(let x=0;x<state.w;x++)if(!current(x,y)){const wx=(x+.5-state.w/2)*g.cell,wz=(y+.5-state.h/2)*g.cell;m.makeRotationX(-Math.PI/2);m.setPosition(wx,.045,wz);if(!state.seen[y*state.w+x])fog.setMatrixAt(counts.fog++,m);else shade.setMatrixAt(counts.shade++,m);}
    for(const [mesh,key]of [[liveWalls,'live'],[memoryWalls,'memory'],[fog,'fog'],[shade,'shade']]){mesh.count=counts[key];mesh.instanceMatrix.needsUpdate=true;}
    for(const batch of batches){
      let count=0;
      for(let i=0;i<batch.src.count;i++){
        batch.src.getMatrixAt(i,m);p.setFromMatrixPosition(m);
        const cx=gx(p.x),cy=gy(p.z),x=Math.floor(cx),y=Math.floor(cy);
        const verticalEdge=Math.abs(cx-Math.round(cx))<.12&&(current(Math.floor(cx-.12),y)||current(Math.floor(cx+.12),y));
        const horizontalEdge=Math.abs(cy-Math.round(cy))<.12&&(current(x,Math.floor(cy-.12))||current(x,Math.floor(cy+.12)));
        if(tile(p.x,p.z)||(batch.wall&&(verticalEdge||horizontalEdge))){
          batch.mesh.setMatrixAt(count,m);
          if(batch.src.instanceColor){batch.src.getColorAt(i,tint);batch.mesh.setColorAt(count,tint);}count++;
        }
      }
      batch.mesh.count=count;batch.mesh.instanceMatrix.needsUpdate=true;
      if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;
    }
  }
  function hide(o){if(o&&o.visible&&!hidden.has(o)){hidden.add(o);changed.push(o);o.visible=false;}}
  function filter(o){if(!o||!o.visible||o===layer||o.isLight||o.isCamera)return;const p=o.getWorldPosition(temp(frame.T).world);if(!C.inside(state,Math.floor(gx(p.x)),Math.floor(gy(p.z))))return;if(!visible(p.x,p.z))hide(o);}
  function before(){if(!active()||!layer)return;const f=frame;layer.visible=true;liveWalls.position.y=f.wall.position.y;for(const b of batches)if(b.wall)b.mesh.position.y=f.wall.position.y;hide(f.wall);hide(f.atmosphere?.floorRoot);for(const o of f.objects())filter(o);}
  function restore(){for(const o of changed)o.visible=true;changed=[];hidden.clear();if(layer)layer.visible=false;}
  function render(f,renderer,camera){update(f);try{before();renderer.render(f.scene,camera);}finally{restore();flushRetiring();}}
  function map(ctx,pad,cw,ch){if(!active()||!state)return;const g=frame.g;for(let y=0;y<state.h;y++)for(let x=0;x<state.w;x++)if(!current(x,y)){ctx.fillStyle=state.seen[y*state.w+x]?'#182631':'#091321';ctx.fillRect(pad+x*cw-.5,pad+y*ch-.5,cw+1,ch+1);}ctx.beginPath();ctx.strokeStyle='#667784';for(let y=0;y<state.h-1;y++)for(let x=0;x<state.w;x++)if(state.horizontal[y*state.w+x]===1&&!current(x,y)&&!current(x,y+1)){ctx.moveTo(pad+x*cw,pad+(y+1)*ch);ctx.lineTo(pad+(x+1)*cw,pad+(y+1)*ch);}for(let y=0;y<state.h;y++)for(let x=0;x<state.w-1;x++)if(state.vertical[y*(state.w-1)+x]===1&&!current(x,y)&&!current(x+1,y)){ctx.moveTo(pad+(x+1)*cw,pad+y*ch);ctx.lineTo(pad+(x+1)*cw,pad+(y+1)*ch);}ctx.stroke();}
  root.MazeSight={active,reset,update,render,visible,cellVisible,map,snapshot:()=>C.snapshot(state),restore:v=>{const s=C.restore(v);if(s){state=s;last=0;}return !!s;},stats:()=>state?{current:state.current.reduce((a,b)=>a+b,0),seen:state.seen.reduce((a,b)=>a+b,0),batches:layer?.children.length||0,memoryWalls:memoryWalls?.count||0}:null};
})(globalThis);
