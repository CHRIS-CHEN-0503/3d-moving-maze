/* Render-only close-camera comfort. Never changes materials, collision or save state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MazeCameraComfort=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const states=new WeakMap(),ENTER=1.05,LEAVE=1.35,STEEP=Math.tan(65*Math.PI/180);
  function constrainOrbit(target,candidate,wallBoxes,wallHeight,margin=.18){
    if(!target||!candidate||!wallBoxes||!Number.isFinite(wallHeight)||wallHeight<=0)return candidate;
    const tx=target.x,ty=target.y,tz=target.z,cx=candidate.x,cy=candidate.y,cz=candidate.z;
    if(!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isFinite(tz)||!Number.isFinite(cx)||!Number.isFinite(cy)||!Number.isFinite(cz))return candidate;
    // Test the whole sight line, not just the camera's height. A camera above
    // a high wall can still look through it on its way down to the actor.
    // Keep the real top plane: genuinely over-wall views and low shop shelves
    // must not behave like infinite-height collision columns.
    if(ty>wallHeight&&cy>wallHeight||ty<0&&cy<0)return candidate;
    const dx=cx-tx,dy=cy-ty,dz=cz-tz,length=Math.hypot(dx,dy,dz);
    if(!Number.isFinite(length)||length<1e-8)return candidate;
    const minX=Math.min(tx,cx),maxX=Math.max(tx,cx),minZ=Math.min(tz,cz),maxZ=Math.max(tz,cz);
    let earliest=1,blocked=false;
    for(let i=0;i<wallBoxes.length;i++){
      const b=wallBoxes[i];
      if(!b||!Number.isFinite(b.minX)||!Number.isFinite(b.maxX)||!Number.isFinite(b.minZ)||!Number.isFinite(b.maxZ)||b.minX>b.maxX||b.minZ>b.maxZ)continue;
      if(b.maxX<minX||b.minX>maxX||b.maxZ<minZ||b.minZ>maxZ)continue;
      // A shifting wall may temporarily contain the target. There is no clear
      // segment before its entry; permit escape instead of pulling backwards.
      if(tx>b.minX&&tx<b.maxX&&tz>b.minZ&&tz<b.maxZ&&ty>0&&ty<wallHeight)continue;
      let enter=0,leave=earliest,hit=true;
      for(let axis=0;axis<3;axis++){
        const origin=axis===0?tx:axis===1?ty:tz,delta=axis===0?dx:axis===1?dy:dz;
        const low=axis===0?b.minX:axis===1?0:b.minZ,high=axis===0?b.maxX:axis===1?wallHeight:b.maxZ;
        if(Math.abs(delta)<1e-10){if(origin<low||origin>high){hit=false;break;}continue;}
        let near=(low-origin)/delta,far=(high-origin)/delta;
        if(near>far){const swap=near;near=far;far=swap;}
        enter=Math.max(enter,near);leave=Math.min(leave,far);
        if(enter>leave){hit=false;break;}
      }
      if(hit&&leave>1e-10&&enter<=earliest){earliest=enter;blocked=true;}
    }
    if(blocked){
      const padding=Number.isFinite(margin)&&margin>=0?margin:.18,t=Math.max(0,earliest-padding/length);
      candidate.x=tx+dx*t;candidate.y=ty+dy*t;candidate.z=tz+dz*t;
    }
    return candidate;
  }
  function stateFor(player,camera){
    let state=states.get(player);
    if(!state){state={hidden:false,camera:null,anchor:player.position.clone(),eye:player.position.clone(),scale:player.position.clone()};states.set(player,state);}
    if(state.camera!==camera){state.camera=camera;state.hidden=false;}
    return state;
  }
  function occludes(player,camera,state){
    // Head rigs sit at approximately 1.5 units. Use the real rig so a short
    // scout and a tall elf are evaluated at their own height, not the floor.
    const head=player.userData?.head;
    if(head?.getWorldPosition)head.getWorldPosition(state.anchor);
    else player.localToWorld(state.anchor.set(0,1.5,0));
    camera.getWorldPosition(state.eye);player.getWorldScale(state.scale);
    const scale=Math.max(.65,Math.min(1.6,Math.abs(state.scale.y)));
    const dx=state.eye.x-state.anchor.x,dy=state.eye.y-state.anchor.y,dz=state.eye.z-state.anchor.z;
    const horizontal=Math.hypot(dx,dz),distance=Math.hypot(horizontal,dy);
    if(!Number.isFinite(distance)||!Number.isFinite(scale))return false;
    // Above-head views remain visible. The height allowance intentionally
    // preserves the ordinary low third-person camera pushed toward a wall.
    if(dy>.9*scale&&dy>horizontal*STEEP)return false;
    return distance<(state.hidden?LEAVE:ENTER)*scale;
  }
  function render(player,camera,view,callback){
    if(typeof callback!=='function')throw new TypeError('A synchronous render callback is required.');
    if(!player?.position?.clone||!player.localToWorld||!player.getWorldScale||!camera?.getWorldPosition)return callback();
    const state=stateFor(player,camera);
    if(view!=='tp'){state.hidden=false;return callback();}
    // Includes nested drawing passes: do not expose an already hidden actor.
    if(!player.visible)return callback();
    state.hidden=occludes(player,camera,state);
    if(!state.hidden)return callback();
    const visible=player.visible;player.visible=false;
    try{return callback();}finally{player.visible=visible;}
  }
  return Object.freeze({render,constrainOrbit});
});
