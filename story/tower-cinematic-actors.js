/* Dialogue-only joint performances. The director supplies time and actual voice
   state; this module never owns a loop, audio, gameplay state or world position. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerCinematicActors=api;})(globalThis,function(){
  'use strict';
  const EMPTY=Object.freeze({}),NO_ACTOR=Object.freeze({sample:()=>false,restore:()=>false,active:false,performance:'idle',beatCount:0,timelineDuration:0});
  const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
  const PROFILES=Object.freeze({
    idle:Object.freeze({head:.018,nod:.02,lean:.006,left:-.06,right:-.09,open:.025,period:9.4,rise:.8,hold:.45,fall:1.05,rest:.012}),
    challenge:Object.freeze({head:.075,nod:.06,lean:.038,left:-.43,right:-.88,open:.16,period:6.6,rise:.58,hold:1.25,fall:.85,rest:.055}),
    guide:Object.freeze({head:.065,nod:.055,lean:-.014,left:-.34,right:-.76,open:.22,period:7.2,rise:.72,hold:1.6,fall:1.0,rest:.02}),
    hurt:Object.freeze({head:.038,nod:.105,lean:.078,left:-.48,right:-.36,open:.055,period:8.1,rise:.48,hold:1.2,fall:1.05,rest:.075}),
    farewell:Object.freeze({head:.05,nod:.075,lean:.022,left:-.15,right:-.67,open:.16,period:8.0,rise:.72,hold:1.5,fall:1.15,rest:.018}),
    thoughtful:Object.freeze({head:.058,nod:.09,lean:.021,left:-.11,right:-.32,open:.065,period:10.2,rise:1.05,hold:1.9,fall:1.15,rest:.025}),
    reveal:Object.freeze({head:.078,nod:-.055,lean:-.025,left:-.39,right:-.81,open:.26,period:8.7,rise:.84,hold:1.8,fall:1.1,rest:.012}),
    excited:Object.freeze({head:.065,nod:-.025,lean:-.018,left:-.42,right:-.59,open:.22,period:6.9,rise:.5,hold:1.15,fall:.84,rest:.014}),
    surprised:Object.freeze({head:.05,nod:-.045,lean:-.027,left:-.25,right:-.36,open:.13,period:8.4,rise:.4,hold:1.15,fall:1.05,rest:.018}),
    reflective:Object.freeze({head:.047,nod:.085,lean:.018,left:-.12,right:-.25,open:.06,period:10.5,rise:.9,hold:1.8,fall:1.25,rest:.025})
  });
  // Small local joint offsets, never world-space movement. Hands stay below
  // the face; equipment remains attached to its original bones throughout.
  // Columns: head xyz, torso xyz, left arm xyz, right arm xyz.
  const GESTURES=Object.freeze({
    wake:Object.freeze([.19,-.08,0,.14,0,0,-.7,-.03,.15,-.78,.03,-.15]),
    inspect:Object.freeze([.11,-.08,0,.055,0,0,-.98,-.04,.16,-.72,.04,-.12]),
    point:Object.freeze([-.015,.035,0,-.025,.085,0,-.12,0,.035,-.94,.05,-.15]),
    warn:Object.freeze([-.035,-.025,0,-.05,-.07,0,-.2,-.03,.09,-.79,.035,-.28]),
    offer:Object.freeze([.045,0,0,-.055,0,0,-1.02,-.035,.13,-.94,.035,-.13]),
    receive:Object.freeze([.095,0,0,.055,0,0,-1.04,-.025,.15,-1.02,.025,-.15]),
    palm:Object.freeze([.13,-.05,0,.045,0,0,-.35,-.035,.16,-1.04,.025,-.075]),
    recollect:Object.freeze([.075,-.04,.018,.021,0,0,-.12,0,.035,-.34,.015,-.08]),
    turn:Object.freeze([0,.105,0,0,.115,0,-.09,0,.025,-.11,0,-.025]),
    listen:Object.freeze([.022,0,0,0,0,0,-.055,0,.016,-.065,0,-.016]),
    settle:Object.freeze([0,0,0,0,0,0,-.03,0,.01,-.035,0,-.01])
  });
  const GAZES=Object.freeze({front:Object.freeze([0,0,0]),down:Object.freeze([.16,0,0]),palm:Object.freeze([.18,-.12,0]),altar:Object.freeze([.06,.23,0]),'partner-left':Object.freeze([.015,-.3,0]),'partner-right':Object.freeze([.015,.3,0])});
  // Brow tilt, eye alertness, withdrawn smile, lowered eyelid. Emotions are
  // held/crossfaded independently of each arm gesture's return to rest.
  const EXPRESSIONS=Object.freeze({idle:Object.freeze([.022,0,0,0]),challenge:Object.freeze([-.075,0,0,0]),guide:Object.freeze([.022,0,0,0]),hurt:Object.freeze([.095,0,.8,.12]),farewell:Object.freeze([.04,0,.15,0]),thoughtful:Object.freeze([.035,0,.1,.04]),reveal:Object.freeze([-.045,.03,0,0]),excited:Object.freeze([-.04,.04,0,0]),surprised:Object.freeze([-.13,.12,.72,0]),reflective:Object.freeze([.07,0,1,.16])});
  const has=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const smooth=n=>{const u=clamp(n,0,1);return u*u*u*(u*(u*6-15)+10);};
  function pulse(t,start,rise,hold,fall){
    if(t<=start)return 0;
    if(t<start+rise)return smooth((t-start)/rise);
    if(t<=start+rise+hold)return 1;
    return 1-smooth((t-start-rise-hold)/fall);
  }
  function prepareBeats(input,fallback){
    if(!Array.isArray(input)||!input.length||input.length>24)return null;
    const result=[];
    for(const item of input){
      if(!item||!Number.isFinite(item.at)||!Number.isFinite(item.duration)||item.at<0||item.duration<.05||item.duration>60||item.at+item.duration>600||typeof item.gesture!=='string'||!has(GESTURES,item.gesture))continue;
      const mood=typeof item.mood==='string'&&has(PROFILES,item.mood)?item.mood:fallback;
      let gaze=typeof item.gaze==='string'&&has(GAZES,item.gaze)?GAZES[item.gaze]:GAZES.front;
      if(item.gaze&&typeof item.gaze==='object'){
        const x=item.gaze.x,y=item.gaze.y,z=item.gaze.z;
        if(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z))gaze=Object.freeze([clamp(x,-.24,.24),clamp(y,-.4,.4),clamp(z,-.08,.08)]);
      }
      result.push(Object.freeze({at:item.at,end:item.at+item.duration,duration:item.duration,mood,expression:EXPRESSIONS[mood],gesture:item.gesture,pose:GESTURES[item.gesture],gaze,rise:Math.min(.7,item.duration*.24),fall:Math.min(.8,item.duration*.24),transition:Math.min(.55,item.duration*.2)}));
    }
    result.sort((a,b)=>a.at-b.at);
    // Ambiguous overlapping performances are never blended arbitrarily.
    for(let n=1;n<result.length;n++)if(result[n].at<result[n-1].end-1e-8)return null;
    return result.length?Object.freeze(result):null;
  }
  // Resolve a performance once, not by scanning the subtitle on every frame.
  function performance(spec){
    const explicit=typeof spec.performance==='string'?spec.performance:typeof spec.profile==='string'?spec.profile:spec.profile?.performance;
    if(has(PROFILES,explicit))return explicit;
    const text=String(explicit||spec.text||'');
    if(/告別|再見|離開|歸途|守.*最後|再會|farewell|defeat/i.test(text))return 'farewell';
    if(/受傷|疼|痛|竟然|裂|破.*防|hurt|wounded/i.test(text))return 'hurt';
    if(/引導|跟.*來|這邊|前方|道路|希望|guide|welcome/i.test(text))return 'guide';
    if(/挑戰|挑釁|戰鬥|休想|入侵|不准|攔|challenge|encounter/i.test(text))return 'challenge';
    if(/發現|顯現|浮現|出現|召喚|揭開|reveal|discovery/i.test(text))return 'reveal';
    if(/歡呼|太好了|成功|終於|振奮|excited|celebrat/i.test(text))return 'excited';
    if(/思考|思索|疑問|沉思|困惑|記憶|thoughtful|ponder/i.test(text))return 'thoughtful';
    return 'idle';
  }
  function temperament(spec){
    const text=String(spec.personality||spec.profile?.personality||'');
    if(/garden|forest|root|tree|庭|森|樹|根|慢|穩/i.test(text))return {pace:.76,force:.82};
    if(/furnace|lava|forge|fire|爐|火|熔|衝動/i.test(text))return {pace:1.14,force:1.15};
    if(/library|book|echo|圖書|藏書|克制|低語/i.test(text))return {pace:.88,force:.72};
    if(/ice|frost|mist|霜|冰|霧/i.test(text))return {pace:.82,force:.86};
    return {pace:1,force:1};
  }
  function owned(node,actor){
    if(!node||node===actor||!node.position||!node.rotation||!node.quaternion||!node.scale)return false;
    let parent=node.parent;while(parent){if(parent===actor)return true;parent=parent.parent;}return false;
  }
  function create(spec=EMPTY,{reduced=false}={}){
    const actor=spec.actor||spec.target,data=actor?.userData;if(!data)return NO_ACTOR;
    const authored=data.cinemaRig,face=data.face||EMPTY;
    const head=authored?.head||data.head,torso=authored?.torso||data.body;
    const arms=authored?.arms||[data.armL,data.armR],legs=authored?.legs||[data.legL,data.legR];
    const mouth=authored?.mouth||face.mouth,eyes=authored?.eyes||face.eyes||[];
    const brows=authored?.brows||face.brows||[],whites=face.whites||[],lids=face.lids||[],lips=face.lips||[],pupils=face.pupils||[],corners=face.corners||[];
    // A scenery/landmark target is intentionally inert, even if it has meshes.
    const joints=[head,torso,arms[0],arms[1],legs[0],legs[1]].filter(node=>owned(node,actor));
    if(!joints.length)return NO_ACTOR;
    const snapshots=[],byNode=new Map();
    function capture(node){
      if(!owned(node,actor)||byNode.has(node))return;
      const p=node.position,r=node.rotation,q=node.quaternion,s=node.scale;
      const snap={node,px:p.x,py:p.y,pz:p.z,rx:r.x,ry:r.y,rz:r.z,order:r.order,qx:q.x,qy:q.y,qz:q.z,qw:q.w,sx:s.x,sy:s.y,sz:s.z,visible:node.visible};
      snapshots.push(snap);byNode.set(node,snap);
    }
    // Attachments follow the same bones; snapshot once so a cancelled scene
    // restores their exact visibility and authored transforms too.
    if(actor.traverse)actor.traverse(capture);else for(const node of [...joints,mouth,...eyes,...brows,...whites,...lids,...lips,...pupils])capture(node);
    const bone=node=>byNode.get(node)||null;
    const headBase=bone(head),torsoBase=bone(torso),leftBase=bone(arms[0]),rightBase=bone(arms[1]),leftLeg=bone(legs[0]),rightLeg=bone(legs[1]),mouthBase=bone(mouth);
    const eyeBases=eyes.map(bone),whiteBases=whites.map(bone),lidBases=lids.map(bone),browBases=brows.map(bone),lipBases=lips.map(bone),pupilBases=pupils.map(bone),cornerBases=corners.map(bone),teethBase=bone(face.teeth);
    const kind=performance(spec),profile=PROFILES[kind],character=temperament(spec),amount=reduced?.26:1,force=character.force*amount,speechAllowed=spec.speechAnimation!==false;
    const beats=prepareBeats(spec.beats,kind);
    const phaseOffset=(Number(actor.id)||0)%17*.17;
    let active=true,lastReflection=0;
    function closeMouth(reflection=0){
      if(mouthBase){mouth.scale.set(mouthBase.sx,mouthBase.sy,mouthBase.sz);mouth.visible=mouthBase.visible;}
      for(const s of lipBases)if(s){s.node.scale.set(s.sx,s.sy,s.sz);s.node.position.set(s.px,s.py,s.pz);s.node.visible=s.visible;}
      for(const s of cornerBases)if(s){s.node.scale.set(s.sx,s.sy,s.sz);s.node.position.set(s.px,s.py,s.pz);}
      if(teethBase)teethBase.node.visible=teethBase.visible;
      if(reflection>0&&mouthBase){
        // A remembered loss is not a smile or an invented syllable. Flatten
        // the borrowed smile ribbon and lower its corners without new meshes.
        const w=clamp(reflection,0,1);mouth.scale.x=mouthBase.sx*(1-.1*w);mouth.scale.y=mouthBase.sy*(1-.58*w);
        for(let n=0;n<lipBases.length;n++){const s=lipBases[n];if(s){s.node.scale.x=s.sx*(1-.1*w);s.node.scale.y=s.sy*(1-.45*w);s.node.position.y=s.py+(mouthBase.py+(n%2?-.004:.004)-s.py)*w;}}
        for(const s of cornerBases)if(s){s.node.scale.y=s.sy*(1-.55*w);s.node.position.y=s.py+(mouthBase.py-s.py)*w;}
        if(teethBase)teethBase.node.visible=false;
      }
    }
    function joint(s,x=0,y=0,z=0){if(s)s.node.rotation.set(s.rx+x,s.ry+y,s.rz+z,s.order);}
    function speech(t,talking,reflection=0){
      closeMouth(reflection);
      if(!talking||!mouthBase)return;
      const syllable=.15+.85*Math.abs(Math.sin(t*8.4)*Math.cos(t*2.65)),opening=syllable*(reduced?.55:1),height=authored?2.5:6.5;
      mouth.scale.set(mouthBase.sx*(1-.12*opening),mouthBase.sy*(1+height*opening),mouthBase.sz);mouth.visible=true;
      for(let i=0;i<lipBases.length;i++){const s=lipBases[i];if(s){s.node.scale.x=s.sx*(1-.1*opening);s.node.position.y=s.py+(i%2?-.012:.007)*opening;}}
    }
    function sampleBeats(time,t,talking,buffering){
      let beat=null,index=-1;
      for(let n=0;n<beats.length;n++){if(time<beats[n].at)break;beat=beats[n];index=n;}
      const moving=beat&&time<beat.end,weight=moving?pulse(time,beat.at,beat.rise,beat.duration-beat.rise-beat.fall,beat.fall):0;
      const gesture=weight*force*(buffering?.18:1),faceForce=force*smooth(time/.7)*(buffering?.18:1),breathForce=force*smooth(time/.7)*(buffering?.28:1),breathe=Math.sin(t*1.36+phaseOffset),pose=beat?.pose||GESTURES.settle,gaze=beat?.gaze||GAZES.front;
      const previous=index>0?beats[index-1]:null,fromGaze=previous?.gaze||GAZES.front,fromFace=previous?.expression||EXPRESSIONS.idle,toFace=beat?.expression||EXPRESSIONS.idle,blend=beat?smooth((time-beat.at)/beat.transition):0;
      const gx=fromGaze[0]+(gaze[0]-fromGaze[0])*blend,gy=fromGaze[1]+(gaze[1]-fromGaze[1])*blend,gz=fromGaze[2]+(gaze[2]-fromGaze[2])*blend;
      const brow=fromFace[0]+(toFace[0]-fromFace[0])*blend,eyeAlert=fromFace[1]+(toFace[1]-fromFace[1])*blend,reflection=fromFace[2]+(toFace[2]-fromFace[2])*blend,lidLower=fromFace[3]+(toFace[3]-fromFace[3])*blend;
      // A wake-up lifts the chin during the held pose; the following action
      // starts from rest rather than replaying the same periodic arm gesture.
      const waking=beat?.gesture==='wake',standing=waking?smooth((time-beat.at)/(beat.rise+beat.duration*.27)):0,turnSign=gy<0?-1:1;
      joint(headBase,clamp((pose[0]-(waking?.27*standing:0))*gesture+gx*faceForce,-.3,.3),clamp(pose[1]*gesture+gy*faceForce,-.48,.48),clamp(pose[2]*gesture+gz*faceForce,-.1,.1));
      joint(torsoBase,pose[3]*gesture*(waking?1-.92*standing:1)+breathe*.004*breathForce,pose[4]*gesture*(beat?.gesture==='turn'?turnSign:1),pose[5]*gesture);
      if(torsoBase)torso.scale.y=torsoBase.sy*(1+breathe*.006*breathForce);
      const brace=waking?1-.8*standing:1;
      joint(leftBase,clamp(pose[6]*gesture*brace,-1.14,1.14),pose[7]*gesture,pose[8]*gesture);joint(rightBase,clamp(pose[9]*gesture*brace,-1.14,1.14),pose[10]*gesture,pose[11]*gesture);
      joint(leftLeg,.005*breathe*breathForce,0,.004*breathForce);joint(rightLeg,-.005*breathe*breathForce,0,-.004*breathForce);
      const blinkAt=(t+phaseOffset)%(5.25+phaseOffset*.31),blink=reduced?1:1-.91*pulse(blinkAt,1.42,.055,.035,.115),alert=1+eyeAlert*faceForce;
      for(const s of eyeBases)if(s)s.node.scale.y=s.sy*blink*alert;
      for(const s of whiteBases)if(s)s.node.scale.y=s.sy*blink*alert;
      for(const s of lidBases)if(s)s.node.scale.y=s.sy*(.45+.55*blink)*(1-lidLower*faceForce);
      for(const s of pupilBases)if(s){s.node.position.x=s.px+gy*.005*faceForce;s.node.position.y=s.py-gx*.009*faceForce;}
      for(let n=0;n<browBases.length;n++)joint(browBases[n],0,0,(n%2?-1:1)*brow*faceForce);
      lastReflection=reflection*faceForce;speech(t,talking,lastReflection);
      return true;
    }
    function sample(time,status=EMPTY){
      if(!active||!Number.isFinite(time))return false;
      // Stopping narration must not leave an open mouth frozen in the shot.
      // All other joints stay exactly where the suspension caught them.
      if(status.phase==='suspended'||status.phase==='paused'||status.phase==='silent'){closeMouth(beats?lastReflection:0);return true;}
      const t=Math.max(0,time)*character.pace,ease=smooth(t/.7);
      const talking=speechAllowed&&status.speaking===true&&status.loading!==true&&status.phase!=='loading';
      const buffering=status.loading===true||status.phase==='loading',gesture=force*ease*(buffering?.18:1),breathForce=force*ease*(buffering?.28:1);
      if(beats)return sampleBeats(Math.max(0,time),t,talking,buffering);
      const breathe=Math.sin(t*1.36+phaseOffset),period=profile.period+phaseOffset*.12,cycle=Math.floor(t/period),local=t-cycle*period;
      // Sparse authored beats include anticipation, a clear held pose, then a
      // slower recovery. The long neutral interval is intentional: an actor
      // should listen or consider the words, not loop a mechanical arm swing.
      const emphasis=pulse(local,.22,profile.rise,profile.hold,profile.fall),variant=cycle%3;
      const delivery=(variant===1?.87:variant===2?.95:1)*emphasis,beat=pulse(local,.46,.42,.25,.62);
      const glance=pulse(local,profile.rise+profile.hold+1.55,.48,.7,.74),look=(variant===1?-1:1)*glance;
      const wounded=kind==='hurt',farewell=kind==='farewell',thinking=kind==='thoughtful',revealing=kind==='reveal',excited=kind==='excited';
      const nod=profile.nod*(.42*delivery+.58*beat),speechNod=talking?.012*pulse(local,.95,.16,.08,.28):0;
      joint(headBase,(nod+speechNod+(thinking?.025*glance:0))*gesture,(profile.head*(.48*delivery+.52*look))*gesture,(wounded?.035:farewell?-.018:thinking?.018:0)*gesture);
      joint(torsoBase,(profile.lean*(.55+.45*delivery)+breathe*.006)*gesture,(wounded?-.018:.022*look)*gesture,(excited?-.012*delivery:wounded?.02:0)*gesture);
      if(torsoBase)torso.scale.y=torsoBase.sy*(1+breathe*.0075*breathForce);
      const leftPose=profile.rest+(-profile.left-profile.rest)*delivery*(variant===1?.75:1),rightPose=profile.rest+(-profile.right-profile.rest)*delivery;
      joint(leftBase,-leftPose*gesture,(wounded?.075:-.055*delivery)*gesture,profile.open*delivery*gesture+breathe*.007*breathForce);
      const wave=farewell?.055*(pulse(local,1.06,.2,.12,.22)-pulse(local,1.58,.2,.12,.22)):0;
      joint(rightBase,-rightPose*gesture,(wounded?-.065:.055*delivery)*gesture,(-profile.open*delivery+wave)*gesture-breathe*.007*breathForce);
      // A grounded weight shift, never a jump or root/world-position change.
      joint(leftLeg,(wounded?.026*delivery:.008*breathe)*breathForce,0,.006*ease*force);
      joint(rightLeg,(wounded?.035*delivery:-.008*breathe)*breathForce,0,-.006*ease*force);
      const blinkPeriod=5.25+phaseOffset*.31,blinkAt=(t+phaseOffset)%blinkPeriod;
      const blink=reduced?1:1-.91*pulse(blinkAt,1.42,.055,.035,.115);
      for(let i=0;i<eyeBases.length;i++)if(eyeBases[i])eyeBases[i].node.scale.y=eyeBases[i].sy*blink;
      for(let i=0;i<whiteBases.length;i++)if(whiteBases[i])whiteBases[i].node.scale.y=whiteBases[i].sy*blink;
      for(let i=0;i<lidBases.length;i++)if(lidBases[i])lidBases[i].node.scale.y=lidBases[i].sy*(.45+.55*blink);
      for(let i=0;i<pupilBases.length;i++)if(pupilBases[i]){pupilBases[i].node.position.x=pupilBases[i].px+look*.0022*gesture;pupilBases[i].node.position.y=pupilBases[i].py+(revealing?.0017*delivery:thinking?-.0014*delivery:0)*gesture;}
      const browMood=wounded?.095:kind==='challenge'?-.075:farewell?.04:revealing?-.045:excited?-.04:thinking?.035:.022;
      for(let i=0;i<browBases.length;i++)joint(browBases[i],0,0,(i%2?-1:1)*browMood*(.35+.65*delivery)*gesture);
      // Syllable-like motion remains actual-voice-gated, not phoneme extraction.
      speech(t,talking);
      return true;
    }
    function restore(){
      if(!active)return false;active=false;
      for(const s of snapshots){
        const node=s.node;node.position.set(s.px,s.py,s.pz);node.scale.set(s.sx,s.sy,s.sz);node.quaternion.set(s.qx,s.qy,s.qz,s.qw);node.visible=s.visible;
        // Quaternion is the authoritative transform. Three's conversion back
        // to Euler can round the captured angles; preserve both representations
        // exactly without invoking the coupled quaternion callback a second time.
        if('_x' in node.rotation){node.rotation._x=s.rx;node.rotation._y=s.ry;node.rotation._z=s.rz;node.rotation._order=s.order;}
        else node.rotation.set(s.rx,s.ry,s.rz,s.order);
      }
      return true;
    }
    return Object.freeze({sample,restore,get active(){return active;},performance:kind,beatCount:beats?.length||0,timelineDuration:beats?.[beats.length-1]?.end||0});
  }
  return Object.freeze({create,PROFILES});
});
