/* One render-only director. No extra renderer, RAF, lights, textures or timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerCinematics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function create(ctx){
    const T=ctx.THREE,env=ctx.env,doc=env.document;
    let state=null,overlay=null,caption=null,title=null,skip=null,resume=null,veil=null;
    function mount(){
      if(overlay)return;
      overlay=doc.createElement('section');overlay.id='towerCinema';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','towerCinemaTitle');
      overlay.innerHTML='<div class="cinema-veil" aria-hidden="true"></div><div class="cinema-controls"><button type="button" data-cinema="resume" hidden>繼續演出</button><button type="button" data-cinema="skip">跳過</button></div><div class="cinema-caption"><small>重要時刻 · 遊戲已暫停</small><h2 id="towerCinemaTitle"></h2><p></p></div>';
      doc.body.appendChild(overlay);title=overlay.querySelector('h2');caption=overlay.querySelector('p');veil=overlay.querySelector('.cinema-veil');skip=overlay.querySelector('[data-cinema="skip"]');resume=overlay.querySelector('[data-cinema="resume"]');
      skip.onclick=()=>finish(true);resume.onclick=()=>{if(!state)return;state.suspended=false;state.spoken=false;state.age=0;state.lastAt=env.performance?.now();resume.hidden=true;skip.focus();};
      for(const type of ['pointerdown','pointermove','pointerup','click','wheel','touchstart','touchmove'])overlay.addEventListener(type,e=>e.stopPropagation());
      for(const type of ['keydown','keyup'])env.addEventListener(type,e=>{if(!state)return;e.stopImmediatePropagation();if(type==='keydown'&&e.code==='Escape'){e.preventDefault();finish(true);}else if(e.code==='Tab'){e.preventDefault();(state.suspended&&doc.activeElement===skip?resume:skip).focus();}else if(!['Enter','Space'].includes(e.code))e.preventDefault();},true);
      doc.addEventListener('visibilitychange',()=>{if(!state||!doc.hidden)return;state.suspended=true;ctx.voice()?.stop();resume.hidden=false;});
    }
    function restore(s){const c=ctx.camera();c.position.copy(s.position);c.quaternion.copy(s.rotation);c.fov=s.fov;c.updateProjectionMatrix();if(s.showTarget)s.spec.target.visible=s.wasVisible;if(s.spec.faceTarget)s.spec.target.rotation.y=s.targetYaw;}
    function finish(complete=false){
      const s=state;if(!s)return false;state=null;ctx.voice()?.stop();restore(s);overlay.hidden=true;doc.body.classList.remove('tower-cinematic-active');ctx.release();
      if(s.focus?.isConnected)s.focus.focus();if(complete)s.spec.done?.();return true;
    }
    function start(spec){
      if(state||!spec?.target?.position||!ctx.available())return false;
      mount();const c=ctx.camera(),p=spec.target.position,player=ctx.player(),height=clamp(spec.height||2.8,1,4.5),focus=new T.Vector3(p.x,height*.6,p.z);
      let dx=player.x-p.x,dz=player.z-p.z,len=Math.hypot(dx,dz);if(len<.1){dx=Math.sin(spec.target.rotation?.y||0);dz=Math.cos(spec.target.rotation?.y||0);len=1;}
      const distance=clamp(height*1.5,2.8,5),goal=new T.Vector3(p.x+dx/len*distance,height*.75+.5,p.z+dz/len*distance);
      ctx.constrain?.(focus,goal);
      state={spec,position:c.position.clone(),rotation:c.quaternion.clone(),fov:c.fov,focus:doc.activeElement,foreground:(ctx.foreground?.()||[]).filter(o=>o&&o!==spec.target),goal,look:focus,age:0,lastAt:env.performance?.now(),targetYaw:spec.target.rotation.y,spoken:false,voiceAccepted:false,captionTime:clamp(String(spec.text||'').length*.15,3.5,14),suspended:false,showTarget:!!spec.showTarget,wasVisible:spec.target.visible};
      ctx.hold();if(spec.showTarget)spec.target.visible=true;
      if(spec.faceTarget)spec.target.rotation.y=Math.atan2(goal.x-p.x,goal.z-p.z);
      title.textContent=spec.title;caption.textContent=spec.text;overlay.hidden=false;resume.hidden=true;veil.style.opacity='0';doc.body.classList.add('tower-cinematic-active');skip.focus();
      return true;
    }
    function frame(dt){
      const s=state;if(!s)return false;
      if(!ctx.valid()||!s.spec.target.parent){finish(false);return false;}
      if(env.innerHeight>env.innerWidth&&!s.suspended){s.suspended=true;ctx.voice()?.stop();resume.hidden=false;}
      if(doc.hidden||s.suspended)return true;
      const now=env.performance?.now(),elapsed=Number.isFinite(now)&&Number.isFinite(s.lastAt)?(now-s.lastAt)/1000:clamp(dt,0,.1);s.lastAt=now;
      s.age+=Math.max(0,elapsed);const reduced=ctx.reduced(),intro=reduced?0:.42;
      // Fade-cut to a collision-clipped close shot: never fly through walls.
      veil.style.opacity=String(reduced?0:Math.max(0,1-Math.abs(s.age-.18)/.18));
      if(s.age>=intro*.45){const c=ctx.camera();c.position.copy(s.goal);c.lookAt(s.look);}
      if(!s.spoken&&s.age>=intro){s.spoken=true;s.voiceAccepted=!!ctx.voice()?.announceAsset(s.spec.asset||'',s.spec.text,true,s.spec.speaker||{});}
      const status=ctx.voice()?.status(),busy=status?.speaking||status?.loadingVoice;
      const spokenDone=s.voiceAccepted&&!busy&&!status?.failure&&s.age>=intro+1.2;
      const silentDone=(!s.voiceAccepted||status?.failure)&&!busy&&s.age>=intro+s.captionTime;
      if(spokenDone||silentDone||s.age>=45)finish(true);
      return true;
    }
    function render(draw){const hidden=[];if(state)for(const o of state.foreground)if(o.visible){o.visible=false;hidden.push(o);}try{return draw();}finally{for(const o of hidden)o.visible=true;}}
    return Object.freeze({start,frame,render,cancel:()=>finish(false),skip:()=>finish(true),get active(){return !!state;},get suspended(){return !!state?.suspended;}});
  }
  return Object.freeze({create});
});
