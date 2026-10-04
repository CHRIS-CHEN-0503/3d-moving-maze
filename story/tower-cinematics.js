/* One render-only director. No extra renderer, RAF, lights, textures or timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerCinematics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Authored edits only: prepare a tiny immutable shot list once, not a new
  // camera/renderer per angle. Invalid lists fall back to the old single shot.
  function prepareCuts(shot,bias){
    if(!Array.isArray(shot?.cuts)||shot.cuts.length<2||shot.cuts.length>8)return null;
    const vector=value=>value?.isVector3&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z);
    const cuts=[];let previous=-1;
    for(const cut of shot.cuts){
      if(!cut||!Number.isFinite(cut.at)||cut.at<0||cut.at>90||cut.at<=previous||!vector(cut.goal)||!vector(cut.focus)||
        cut.goalTo&&!vector(cut.goalTo)||cut.focusTo&&!vector(cut.focusTo)||
        cut.fov!==undefined&&!Number.isFinite(cut.fov)||cut.duration!==undefined&&(!Number.isFinite(cut.duration)||cut.duration<=0))return null;
      if(cut.goal.distanceToSquared(cut.focus)<.0001||(cut.goalTo||cut.goal).distanceToSquared(cut.focusTo||cut.focus)<.0001)return null;
      const focus=cut.focus.clone(),focusTo=(cut.focusTo||cut.focus).clone();focus.y+=bias;focusTo.y+=bias;
      cuts.push({id:String(cut.id||'shot-'+cuts.length).slice(0,64),at:cut.at,duration:clamp(cut.duration||4,.5,24),
        goal:cut.goal.clone(),goalTo:(cut.goalTo||cut.goal).clone(),focus,focusTo,fov:clamp(cut.fov||50,38,64),
        subjects:Array.isArray(cut.subjects)?cut.subjects.filter(name=>typeof name==='string'&&name.length<=40).slice(0,2).join(','):''});previous=cut.at;
    }
    return cuts[0].at===0?cuts:null;
  }
  function create(ctx){
    const T=ctx.THREE,env=ctx.env,doc=env.document;
    let state=null,overlay=null,caption=null,title=null,skip=null,resume=null,veil=null,previous=null,next=null,later=null,kicker=null;
    function mount(){
      if(overlay)return;
      overlay=doc.createElement('section');overlay.id='towerCinema';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','towerCinemaTitle');
      overlay.innerHTML='<div class="cinema-veil" aria-hidden="true"></div><div class="cinema-controls"><button type="button" data-cinema="resume" hidden>繼續演出</button><button type="button" data-cinema="later" hidden>稍後再看</button><button type="button" data-cinema="skip">跳過</button></div><div class="cinema-caption"><small>重要時刻 · 遊戲已暫停</small><h2 id="towerCinemaTitle"></h2><p></p><nav class="cinema-pages" aria-label="劇情段落"><button type="button" data-cinema="previous" hidden>上一段</button><button type="button" data-cinema="next" hidden>下一段</button></nav></div>';
      doc.body.appendChild(overlay);title=overlay.querySelector('h2');caption=overlay.querySelector('p');veil=overlay.querySelector('.cinema-veil');skip=overlay.querySelector('[data-cinema="skip"]');resume=overlay.querySelector('[data-cinema="resume"]');
      previous=overlay.querySelector('[data-cinema="previous"]');next=overlay.querySelector('[data-cinema="next"]');later=overlay.querySelector('[data-cinema="later"]');kicker=overlay.querySelector('small');
      previous.onclick=()=>navigate('previous');next.onclick=()=>navigate('next');later.onclick=()=>{const leave=state?.spec.leave;finish(false);leave?.();};
      skip.onclick=()=>finish(true,{skipped:true});resume.onclick=()=>{if(!state)return;state.suspended=false;state.spoken=false;state.age=0;state.shotAge=0;state.shotReady=false;state.cutIndex=-1;state.lastAt=env.performance?.now();resume.hidden=true;skip.focus();};
      for(const type of ['pointerdown','pointermove','pointerup','click','wheel','touchstart','touchmove'])overlay.addEventListener(type,e=>e.stopPropagation());
      for(const type of ['keydown','keyup'])env.addEventListener(type,e=>{if(!state)return;e.stopImmediatePropagation();if(type==='keydown'&&e.code==='Escape'){e.preventDefault();finish(true,{skipped:true});}else if(e.code==='Tab'){e.preventDefault();if(type==='keydown'){const buttons=[resume,later,skip,previous,next].filter(b=>!b.hidden),i=buttons.indexOf(doc.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}}else if(!['Enter','Space'].includes(e.code))e.preventDefault();},true);
      doc.addEventListener('visibilitychange',()=>{if(!state||!doc.hidden)return;state.suspended=true;ctx.voice()?.stop();resume.hidden=false;});
    }
    function sampleActors(s,time,status){if(s.actors){for(const actor of s.actors)actor?.sample(time,status);}else s.actor?.sample(time,status);}
    function restore(s){if(s.actors){for(const actor of s.actors)actor?.restore();}else s.actor?.restore();const c=ctx.camera();c.position.copy(s.position);c.quaternion.copy(s.rotation);c.fov=s.fov;c.updateProjectionMatrix();if(s.showTarget)s.spec.target.visible=s.wasVisible;if(s.spec.faceTarget)s.spec.target.rotation.y=s.targetYaw;}
    function navigate(direction){const callback=state?.spec[direction];if(!callback)return;finish(false);callback();}
    function finish(complete=false,result={}){
      const s=state;if(!s)return false;state=null;ctx.voice()?.stop();restore(s);overlay.hidden=true;doc.body.classList.remove('tower-cinematic-active');ctx.release();
      if(s.focus?.isConnected)s.focus.focus();if(complete)s.spec.done?.(result);return true;
    }
    function start(spec){
      if(state||!spec?.target?.position||!ctx.available(spec))return false;
      mount();const c=ctx.camera(),p=spec.target.position,player=ctx.player(),height=clamp(spec.height||2.8,1,4.5),focus=new T.Vector3(p.x,height*.6,p.z);
      let dx=player.x-p.x,dz=player.z-p.z,len=Math.hypot(dx,dz);if(len<.1){dx=Math.sin(spec.target.rotation?.y||0);dz=Math.cos(spec.target.rotation?.y||0);len=1;}
      const distance=clamp(height*1.5,2.8,5),goal=new T.Vector3(p.x+dx/len*distance,height*.75+.5,p.z+dz/len*distance);
      if(spec.shot){focus.copy(spec.shot.focus);goal.copy(spec.shot.goal);}else ctx.constrain?.(focus,goal);
      // A story stage has its own composition and lens, independent of the
      // gameplay camera. Lower the eye-line on short landscape displays so the
      // cast remains above the reading panel instead of behind it.
      const story=!!spec.sequence,polished=story&&spec.shot?.edition==='preview',bias=polished?(env.innerHeight<=340?-.24:env.innerHeight<=420?-.13:0):0;
      focus.y+=bias;
      const goalTo=polished?(spec.shot?.goalTo?.clone?.()||goal.clone().add(new T.Vector3(.22,-.08,-.30))):null;
      const lookTo=polished?(spec.shot?.focusTo?.clone?.()||focus.clone()):null;if(polished&&spec.shot?.focusTo)lookTo.y+=bias;
      const lens=polished?clamp(Number(spec.shot?.fov)||50,38,64):null;
      const cuts=polished?prepareCuts(spec.shot,bias):null;
      state={spec,position:c.position.clone(),rotation:c.quaternion.clone(),fov:c.fov,focus:doc.activeElement,foreground:(ctx.foreground?.()||[]).filter(o=>o&&o!==spec.target),goal,look:focus,age:0,lastAt:env.performance?.now(),targetYaw:spec.target.rotation.y,spoken:false,voiceAccepted:false,captionTime:clamp(String(spec.text||'').length*.15,3.5,14),suspended:false,showTarget:!!spec.showTarget,wasVisible:spec.target.visible};
      Object.assign(state,{goalTo,lookTo,lens,polished,cuts,cutIndex:-1,shotAge:0,shotReady:false,shotSeconds:clamp(Number(spec.shot?.duration)||14,6,24),framing:new T.Vector3()});
      // Only the approved preview may stage two independently authored roles.
      // Both use one clock and one director; a duplicate/foreign cast falls
      // back to the previous featured-actor performance.
      const tracks=spec.actorTracks;
      if(polished&&Array.isArray(tracks)&&tracks.length>0&&tracks.length<=2){
        const seen=new Set();let valid=true;
        for(const track of tracks){const actor=track?.actor;if(!actor?.parent||!actor?.userData||seen.has(actor)||spec.scene&&actor.parent!==spec.scene){valid=false;break;}seen.add(actor);}
        if(valid){state.actors=[];for(const track of tracks)state.actors.push(env.TowerCinematicActors?.create({...track,speechAnimation:false},{reduced:ctx.reduced()}));}
      }
      if(!state.actors)state.actor=env.TowerCinematicActors?.create(spec,{reduced:ctx.reduced()});
      ctx.hold();if(spec.showTarget)spec.target.visible=true;
      if(spec.faceTarget)spec.target.rotation.y=Math.atan2(goal.x-p.x,goal.z-p.z);
      title.textContent=spec.title;caption.textContent=spec.caption??spec.text;overlay.setAttribute('data-story',story?'true':'false');overlay.setAttribute('data-polished',polished?'true':'false');overlay.hidden=false;resume.hidden=true;veil.style.opacity='0';doc.body.classList.add('tower-cinematic-active');skip.focus();
      overlay.setAttribute('data-shot','pending');overlay.setAttribute('data-shot-index','-1');overlay.setAttribute('data-shot-subjects','');
      previous.hidden=!spec.previous;next.hidden=!spec.next;later.hidden=!spec.leave;kicker.textContent=spec.kicker||'重要時刻 · 遊戲已暫停';skip.textContent=spec.sequence?'跳過這幕':'跳過';
      return true;
    }
    function frame(dt){
      const s=state;if(!s)return false;
      if(!ctx.valid(s.spec)||!s.spec.target.parent){finish(false);return false;}
      if(env.innerHeight>env.innerWidth&&!s.suspended){s.suspended=true;ctx.voice()?.stop();resume.hidden=false;}
      if(doc.hidden||s.suspended){sampleActors(s,s.cuts?s.shotAge:s.age,{speaking:false,phase:'suspended'});return true;}
      const now=env.performance?.now(),elapsed=Number.isFinite(now)&&Number.isFinite(s.lastAt)?(now-s.lastAt)/1000:clamp(dt,0,.1);s.lastAt=now;
      s.age+=Math.max(0,elapsed);const reduced=ctx.reduced(),intro=reduced?0:.42;
      if(!s.spoken&&s.age>=intro){s.spoken=true;s.voiceAccepted=!!ctx.voice()?.announceAsset(s.spec.asset||'',s.spec.text,true,s.spec.speaker||{});}
      const status=ctx.voice()?.status(),busy=status?.speaking||status?.loadingVoice;
      // A buffering/queued recording must not consume the intended shot beats.
      // The first audible frame anchors time zero: its elapsed interval belongs
      // to stage preparation or loading, not to the narration just started.
      const loading=!!(status?.loadingVoice||status?.loadingAudio),playing=status?.playing??(status?.speaking&&!loading);
      if(s.cuts){
        const ready=s.spoken&&!loading&&(!s.voiceAccepted||!busy||playing);
        if(ready&&s.shotReady)s.shotAge+=Math.max(0,elapsed);
        s.shotReady=ready;
      }
      // Fade-cut to a collision-clipped close shot: never fly through walls.
      veil.style.opacity=String(reduced?0:Math.max(0,1-Math.abs(s.age-.18)/.18));
      if(s.age>=intro*.45){
        const c=ctx.camera();c.position.copy(s.goal);s.framing.copy(s.look);
        if(s.polished){
          if(s.cuts){
            let index=0;if(!reduced)for(let n=1;n<s.cuts.length;n++){if(s.shotAge<s.cuts[n].at)break;index=n;}
            const cut=s.cuts[index];
            if(s.cutIndex!==index){s.cutIndex=index;overlay.setAttribute('data-shot',cut.id);overlay.setAttribute('data-shot-index',String(index));overlay.setAttribute('data-shot-subjects',cut.subjects);}
            c.position.copy(cut.goal);s.framing.copy(cut.focus);
            if(c.fov!==cut.fov){c.fov=cut.fov;c.updateProjectionMatrix();}
            if(!reduced){const progress=clamp((s.shotAge-cut.at)/cut.duration,0,1),ease=progress*progress*(3-2*progress);c.position.lerp(cut.goalTo,ease);s.framing.lerp(cut.focusTo,ease);}
          }else{
            if(c.fov!==s.lens){c.fov=s.lens;c.updateProjectionMatrix();}
            if(!reduced){const progress=clamp((s.age-intro)/s.shotSeconds,0,1),ease=progress*progress*(3-2*progress);c.position.lerp(s.goalTo,ease);s.framing.lerp(s.lookTo,ease);}
          }
        }else if(s.spec.sequence&&!reduced){const drift=Math.min(.22,s.age*.006);c.position.x+=drift;c.position.y+=Math.sin(s.age*.14)*.025;}
        c.lookAt(s.framing);
      }
      // A queued utterance or a buffering recording is not audible speech.
      const performanceTime=s.cuts?s.shotAge:s.age;
      s.spec.frame?.(performanceTime);sampleActors(s,performanceTime,{speaking:!!(s.spec.speechAnimation!==false&&s.voiceAccepted&&playing&&!loading),loading,phase:'active'});
      const spokenDone=s.voiceAccepted&&!busy&&!status?.failure&&s.age>=intro+1.2;
      // A full story page must remain readable when narration is disabled or
      // unavailable. Its visible next/skip controls provide the way forward.
      const silentDone=!s.spec.sequence&&(!s.voiceAccepted||status?.failure)&&!busy&&s.age>=intro+s.captionTime;
      const limit=s.spec.sequence?clamp(String(s.spec.text||'').length*.4+20,45,120):45;
      if(s.spec.sequence&&s.voiceAccepted&&s.age>=limit){ctx.voice()?.stop();s.voiceAccepted=false;}
      if(spokenDone||silentDone||(!s.spec.sequence&&s.age>=limit))finish(true);
      return true;
    }
    function render(draw){if(state?.spec.render)return state.spec.render();const hidden=[];if(state)for(const o of state.foreground)if(o.visible){o.visible=false;hidden.push(o);}try{return draw();}finally{for(const o of hidden)o.visible=true;}}
    return Object.freeze({start,frame,render,cancel:()=>finish(false),skip:()=>finish(true,{skipped:true}),get active(){return !!state;},get suspended(){return !!state?.suspended;}});
  }
  return Object.freeze({create});
});
