/* Render-only, bounded fog/history batches. All temporary visibility is restored in finally. */
(function(root){'use strict';const C=root.MazeSightCore;let state=null,layer=null,source=null,liveWalls=null,memoryWalls=null,fog=null,shade=null,last=0,revealed=false,frame=null,changed=[],batches=[];const hidden=new Set();
  function active(){return !!frame&&['tp','top'].includes(frame.g.view);}
  function reset(){restore();if(layer){layer.parent?.remove(layer);const materials=new Set(),geometries=new Set();layer.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());}state=layer=source=frame=null;batches=[];last=0;revealed=false;}
  function build(f){if(layer){layer.parent?.remove(layer);const mats=new Set(),geos=new Set();layer.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});mats.forEach(m=>m.dispose());geos.forEach(g=>g.dispose());}const T=f.T,g=f.g,n=2*g.mazeW*g.mazeH+4;layer=new T.Group();layer.name='maze-sight-layer';layer.visible=false;f.scene.add(layer);batches=[];
    const mesh=(geo,mat,count)=>{const m=new T.InstancedMesh(geo,mat,count);m.frustumCulled=false;m.count=0;layer.add(m);return m;};
    liveWalls=mesh(f.wall.geometry.clone(),f.wall.material.clone(),n);
    // Remembered terrain is a quiet floor plan, not a second full-height grey maze.
    memoryWalls=mesh(new T.BoxGeometry(1,.08,1),new T.MeshBasicMaterial({color:0x354553,fog:false}),n);
    fog=mesh(new T.PlaneGeometry(g.cell,g.cell),new T.MeshBasicMaterial({color:0x091321,side:T.DoubleSide,fog:false}),g.mazeW*g.mazeH);shade=mesh(new T.PlaneGeometry(g.cell,g.cell),new T.MeshBasicMaterial({color:0x14212e,side:T.DoubleSide,fog:false}),g.mazeW*g.mazeH);
    for(const parent of [f.atmosphere?.wallRoot,f.atmosphere?.floorRoot])for(const src of parent?.children||[])if(src.isInstancedMesh)batches.push({src,mesh:mesh(src.geometry.clone(),src.material.clone(),src.count),wall:parent===f.atmosphere.wallRoot});source=f.wall;
  }
  function xy(x,z){const g=frame.g;return {x:x/g.cell+g.mazeW/2,y:z/g.cell+g.mazeH/2};}
  function cellVisible(x,y){return !!state&&C.inside(state,x,y)&&!!state.current[y*state.w+x];}
  function visible(x,z){if(!active())return true;const p=xy(x,z),a=xy(frame.g.px,frame.g.pz);return Math.hypot(p.x-a.x,p.y-a.y)<=frame.radius&&C.line(state,a.x,a.y,p.x,p.y,frame.g.hWalls,frame.g.vWalls);}
  function tile(x,z){const p=xy(x,z);return cellVisible(Math.floor(p.x),Math.floor(p.y));}
  function update(f,now=performance.now()){frame=f;const g=f.g;if(!g.hWalls||!g.vWalls||!f.wall)return;if(!state||state.w!==g.mazeW||state.h!==g.mazeH)state=C.create(g.mazeW,g.mazeH);if(source!==f.wall)build(f);if(now-last<100&&!f.force)return;last=now;const a=xy(g.px,g.pz);
    // The grid remains the occluder while walls animate down, so a shift never grants X-ray vision.
    C.update(state,a.x,a.y,g.hWalls,g.vWalls,f.radius);const magic=!!root.MagicMap?.isRevealed();if(magic&&!revealed)C.reveal(state,g.hWalls,g.vWalls);revealed=magic;
    const T=f.T,m=new T.Matrix4(),q=new T.Quaternion(),p=new T.Vector3(),s=new T.Vector3(),counts={live:0,memory:0,fog:0,shade:0};
    const put=(mesh,key,x,y,z,sx,sz)=>{p.set(x,y,z);s.set(sx,1,sz);m.compose(p,q,s);mesh.setMatrixAt(counts[key]++,m);};
    for(const b of g.wallBoxes){const exists=b.boundary||(b.type==='h'?g.hWalls[b.gy]?.[b.gx]:g.vWalls[b.gy]?.[b.gx]);const show=exists&&(b.boundary||(b.type==='h'?(cellVisible(b.gx,b.gy)||cellVisible(b.gx,b.gy+1)):(cellVisible(b.gx,b.gy)||cellVisible(b.gx+1,b.gy))));if(show)put(liveWalls,'live',(b.minX+b.maxX)/2,g.wallH/2,(b.minZ+b.maxZ)/2,b.maxX-b.minX,b.maxZ-b.minZ);}
    for(let y=0;y<state.h-1;y++)for(let x=0;x<state.w;x++)if(state.horizontal[y*state.w+x]===1&&!cellVisible(x,y)&&!cellVisible(x,y+1))put(memoryWalls,'memory',(x+.5-state.w/2)*g.cell,.1,(y+1-state.h/2)*g.cell,g.cell+g.wallT,.12);
    for(let y=0;y<state.h;y++)for(let x=0;x<state.w-1;x++)if(state.vertical[y*(state.w-1)+x]===1&&!cellVisible(x,y)&&!cellVisible(x+1,y))put(memoryWalls,'memory',(x+1-state.w/2)*g.cell,.1,(y+.5-state.h/2)*g.cell,.12,g.cell+g.wallT);
    for(let y=0;y<state.h;y++)for(let x=0;x<state.w;x++)if(!cellVisible(x,y)){const wx=(x+.5-state.w/2)*g.cell,wz=(y+.5-state.h/2)*g.cell;m.makeRotationX(-Math.PI/2);m.setPosition(wx,.045,wz);if(!state.seen[y*state.w+x])fog.setMatrixAt(counts.fog++,m);else shade.setMatrixAt(counts.shade++,m);}
    for(const [mesh,key]of [[liveWalls,'live'],[memoryWalls,'memory'],[fog,'fog'],[shade,'shade']]){mesh.count=counts[key];mesh.instanceMatrix.needsUpdate=true;}
    const tint=new T.Color();
    for(const batch of batches){
      let count=0;
      for(let i=0;i<batch.src.count;i++){
        batch.src.getMatrixAt(i,m);p.setFromMatrixPosition(m);
        const c=xy(p.x,p.z),x=Math.floor(c.x),y=Math.floor(c.y);
        const verticalEdge=Math.abs(c.x-Math.round(c.x))<.12&&(cellVisible(Math.floor(c.x-.12),y)||cellVisible(Math.floor(c.x+.12),y));
        const horizontalEdge=Math.abs(c.y-Math.round(c.y))<.12&&(cellVisible(x,Math.floor(c.y-.12))||cellVisible(x,Math.floor(c.y+.12)));
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
  function filter(o){if(!o||!o.visible||o===layer||o.isLight||o.isCamera)return;const p=o.getWorldPosition(new frame.T.Vector3()),c=xy(p.x,p.z);if(!C.inside(state,Math.floor(c.x),Math.floor(c.y)))return;if(!visible(p.x,p.z))hide(o);}
  function before(){if(!active()||!layer)return;const f=frame;layer.visible=true;liveWalls.position.y=f.wall.position.y;for(const b of batches)if(b.wall)b.mesh.position.y=f.wall.position.y;hide(f.wall);hide(f.atmosphere?.floorRoot);for(const o of f.objects())filter(o);}
  function restore(){for(const o of changed)o.visible=true;changed=[];hidden.clear();if(layer)layer.visible=false;}
  function render(f,renderer,camera){update(f);try{before();renderer.render(f.scene,camera);}finally{restore();}}
  function map(ctx,pad,cw,ch){if(!active()||!state)return;const g=frame.g;for(let y=0;y<state.h;y++)for(let x=0;x<state.w;x++)if(!cellVisible(x,y)){ctx.fillStyle=state.seen[y*state.w+x]?'#182631':'#091321';ctx.fillRect(pad+x*cw-.5,pad+y*ch-.5,cw+1,ch+1);}ctx.beginPath();ctx.strokeStyle='#667784';for(let y=0;y<state.h-1;y++)for(let x=0;x<state.w;x++)if(state.horizontal[y*state.w+x]===1&&!cellVisible(x,y)&&!cellVisible(x,y+1)){ctx.moveTo(pad+x*cw,pad+(y+1)*ch);ctx.lineTo(pad+(x+1)*cw,pad+(y+1)*ch);}for(let y=0;y<state.h;y++)for(let x=0;x<state.w-1;x++)if(state.vertical[y*(state.w-1)+x]===1&&!cellVisible(x,y)&&!cellVisible(x+1,y)){ctx.moveTo(pad+(x+1)*cw,pad+y*ch);ctx.lineTo(pad+(x+1)*cw,pad+(y+1)*ch);}ctx.stroke();}
  root.MazeSight={active,reset,update,render,visible,cellVisible,map,snapshot:()=>C.snapshot(state),restore:v=>{const s=C.restore(v);if(s){state=s;last=0;}return !!s;},stats:()=>state?{current:state.current.reduce((a,b)=>a+b,0),seen:state.seen.reduce((a,b)=>a+b,0),batches:layer?.children.length||0}:null};
})(globalThis);
