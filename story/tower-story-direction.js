/* Narrative-aware coverage for an already built story stage. Pure editorial
   data only: the existing director owns the clock, actor rig and camera. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerStoryDirection=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const INTENTS=Object.freeze({
    observe:Object.freeze({mood:'thoughtful',gesture:'turn',gaze:'altar'}),
    recall:Object.freeze({mood:'reflective',gesture:'recollect',gaze:'down'}),
    discover:Object.freeze({mood:'reveal',gesture:'inspect',gaze:'down'}),
    guide:Object.freeze({mood:'guide',gesture:'point',gaze:'altar'}),
    resolve:Object.freeze({mood:'guide',gesture:'turn',gaze:'altar'}),
    danger:Object.freeze({mood:'challenge',gesture:'warn',gaze:'altar'}),
    hurt:Object.freeze({mood:'hurt',gesture:'recollect',gaze:'down'}),
    farewell:Object.freeze({mood:'farewell',gesture:'recollect',gaze:'front'}),
    hope:Object.freeze({mood:'excited',gesture:'turn',gaze:'altar'})
  });
  function intent(text){
    if(/告別|再見|歸途|回家|放下|離隊/.test(text))return 'farewell';
    if(/受傷|疼痛|發抖|哭泣|害怕|傷口/.test(text))return 'hurt';
    if(/攔住|守衛|挑戰|不准|逼近|舉起武器|危險|追來/.test(text))return 'danger';
    if(/回憶|想起|記得|記憶|曾經|那一年/.test(text))return 'recall';
    if(/尚未|還沒|未能|沒有找到|不曾/.test(text))return 'observe';
    if(/繼續|前往|往下|出發|走向|抵達|第\s*\d+\s*層/.test(text))return 'resolve';
    if(/指向|指著|提醒|告訴|遞來|地圖|路牌|帶.*走/.test(text))return 'guide';
    if(/取得|獲得|找到|發現|揭開|出現|光芒|浮現|回答|銅扣/.test(text))return 'discover';
    if(/歡呼|成功|希望|加油|終於/.test(text))return 'hope';
    return 'observe';
  }
  function storyUnits(text){
    // Keep the existing wording authoritative. Classification selects a pose;
    // it never generates dialogue, a prop, another character or a story event.
    const clauses=String(text||'').split(/[，。！？；\n]+/u).map(s=>s.trim()).filter(Boolean);
    return clauses.length?clauses.map(text=>Object.freeze({intent:intent(text),weight:Math.max(1,Array.from(text).length)})):[Object.freeze({intent:'observe',weight:1})];
  }
  function face(T,actor,fallback){
    const p=new T.Vector3(...fallback),head=actor?.userData?.headMesh||actor?.userData?.head;
    if(head?.isObject3D){actor.updateMatrixWorld(true);head.getWorldPosition(p);}
    else if(actor?.position){p.x=actor.position.x;p.z=actor.position.z;p.y=actor.position.y+1.7;}
    if(![p.x,p.y,p.z].every(Number.isFinite))p.set(...fallback);
    return p;
  }
  function beats(units,duration,partner,isNpc){
    const count=duration<10?3:duration<16?4:5,result=[],weights=units.reduce((n,u)=>n+u.weight,0);
    for(let n=0;n<count;n++){
      const at=duration*n/count,span=duration/count;
      let progress=count===3?(n===0?0:n===1?.25:1):n/(count-1),cursor=progress*weights,selected=units.at(-1);
      for(const unit of units){cursor-=unit.weight;if(cursor<=0){selected=unit;break;}}
      const definition=INTENTS[selected.intent];
      // First settle into the place, then react, then look toward the next
      // intention. Two actors alternate speaking-like gestures and listening;
      // narration itself is never treated as their spoken dialogue.
      let gesture=definition.gesture,mood=definition.mood,gaze=definition.gaze;
      if(n===0){gesture='listen';gaze=partner?(isNpc?'partner-left':'partner-right'):'altar';mood='thoughtful';}
      else if(partner&&((isNpc&&n%2===0)||(!isNpc&&n%2===1))){gesture='listen';gaze=isNpc?'partner-left':'partner-right';}
      if(n===count-1&&selected.intent!=='danger'&&selected.intent!=='hurt')gesture=selected.intent==='discover'?'recollect':'turn';
      result.push(Object.freeze({at,duration:span,mood,gesture,gaze}));
    }
    return Object.freeze(result);
  }
  function plan({THREE:T,hero=null,npc=null,text='',environment='cloud',page=0,name=''}={}){
    if(!T?.Vector3)return null;
    const words=String(text),units=storyUnits(words),characters=Array.from(words.replace(/\s/g,'')).length;
    // This is an editorial estimate, not fabricated word-level audio timing.
    // A short floor objective gets a 6–9 s sequence, not the 24 s opening act.
    const duration=Math.round(clamp(characters/4.8+1.3,6,24)*100)/100;
    const validHero=hero?.isObject3D?hero:null,validNpc=npc?.isObject3D&&npc!==validHero&&npc.visible!==false&&String(name)&&words.includes(String(name))&&(!validHero||npc.parent===validHero.parent)?npc:null;
    const h=face(T,validHero,[-.9,1.9,.45]),n=face(T,validNpc,[.95,1.9,-.05]),focusActor=validNpc||validHero;
    const pair=Object.freeze([...(validHero?['hero']:[]),...(validNpc?[String(name)]:[])]),lead=validNpc?n:h,leadName=validNpc?[String(name)]:validHero?['hero']:[];
    const eye=validNpc?Math.min(h.y,n.y):h.y,base=validHero?.position.y||0;
    const make=(id,at,span,goal,goalTo,focus,focusTo,fov,subjects)=>Object.freeze({id,at,duration:span,goal:new T.Vector3(...goal),goalTo:new T.Vector3(...goalTo),focus:new T.Vector3(...focus),focusTo:new T.Vector3(...focusTo),fov,subjects:Object.freeze(subjects.slice())});
    const count=duration<10?3:4,segment=duration/count,cuts=[];
    cuts.push(make('story-establish',0,segment,[2.8,4.7,7.9],[2.58,4.52,7.62],[-.1,base+.43,-1.05],[-.1,base+.46,-1.03],54,pair));
    cuts.push(make(validNpc?'story-listener-response':'story-traveller-response',segment,segment,[lead.x+.4,lead.y+.21,lead.z+2.62],[lead.x+.34,lead.y+.19,lead.z+2.48],[lead.x,lead.y-.42,lead.z],[lead.x,lead.y-.4,lead.z],45,leadName));
    if(count===4)cuts.push(make(validNpc?'story-shared-direction':'story-landmark-perspective',segment*2,segment,[3.05,eye+.8,4.15],[2.9,eye+.72,3.98],[-.38,eye-.73,-.28],[-.38,eye-.71,-.3],51,pair));
    cuts.push(make('story-onward',segment*(count-1),segment,[1.78,eye+1.12,5.35],[1.57,eye+1.02,5.07],[-.4,eye-.82,-.72],[-.44,eye-.79,-.75],52,pair));
    const tracks=[];
    if(validHero)tracks.push(Object.freeze({actor:validHero,identity:'hero',performance:'thoughtful',personality:environment,speechAnimation:false,beats:beats(units,duration,!!validNpc,false)}));
    if(validNpc)tracks.push(Object.freeze({actor:validNpc,identity:String(name),performance:INTENTS[units[0].intent].mood,personality:environment,speechAnimation:false,beats:beats(units,duration,!!validHero,true)}));
    const actorTracks=Object.freeze(tracks),first=cuts[0],lastIntent=units.at(-1).intent;
    const actionPlan=Object.freeze({kind:'narrative-coverage',pageIndex:Math.max(0,Math.floor(Number(page)||0)),timing:'editorial-estimate',duration,intents:Object.freeze(units.map(u=>u.intent)),tracks:Object.freeze(tracks.map(t=>Object.freeze({identity:t.identity,beats:t.beats}))),props:Object.freeze([])});
    const shot=Object.freeze({edition:'preview',kind:'story-'+lastIntent,focus:first.focus.clone(),goal:first.goal.clone(),focusTo:first.focusTo.clone(),goalTo:first.goalTo.clone(),fov:first.fov,duration,cuts:Object.freeze(cuts)});
    return Object.freeze({shot,actorTracks,duration,performance:INTENTS[lastIntent].mood,actionPlan,target:focusActor});
  }
  return Object.freeze({plan});
});
