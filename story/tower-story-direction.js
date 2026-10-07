/* Narrative-aware coverage for an already built story stage. Pure editorial
   data only: the existing director owns the clock, actor rig and camera. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerStoryDirection=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const INTENTS=Object.freeze({
    observe:Object.freeze({mood:'thoughtful',gesture:'lookaround',gaze:'altar'}),
    recall:Object.freeze({mood:'reflective',gesture:'recollect',gaze:'down'}),
    discover:Object.freeze({mood:'reveal',gesture:'inspect',gaze:'down'}),
    guide:Object.freeze({mood:'guide',gesture:'point',gaze:'altar'}),
    resolve:Object.freeze({mood:'guide',gesture:'turn',gaze:'altar'}),
    danger:Object.freeze({mood:'challenge',gesture:'warn',gaze:'altar'}),
    hurt:Object.freeze({mood:'hurt',gesture:'hug',gaze:'down'}),
    farewell:Object.freeze({mood:'farewell',gesture:'wave',gaze:'front'}),
    hope:Object.freeze({mood:'excited',gesture:'cheer',gaze:'altar'})
  });
  // Open-sky stages take a high establishing view; enclosed halls, caves and
  // workshops stay lower so their ceilings and walls frame the cast.
  const OPEN=Object.freeze(['cloud','garden','mist']);
  const CLOSE=Object.freeze(['recall','hurt','farewell','hope']);
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
  function beats(units,duration,partner,isNpc,environment){
    const count=duration<10?3:duration<16?4:5,result=[],weights=units.reduce((n,u)=>n+u.weight,0);let listened=false;
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
      else if(partner&&((isNpc&&n%2===0)||(!isNpc&&n%2===1))){gesture=listened?'nod':'listen';listened=true;gaze=isNpc?'partner-left':'partner-right';}
      // The closing beat looks onward; a farewell or a cheer keeps its own
      // gesture, and danger/hurt never relax into a casual turn.
      if(n===count-1&&!['danger','hurt','farewell','hope'].includes(selected.intent))gesture=selected.intent==='discover'?'recollect':'turn';
      // Cold air reads in the body: a hurt or wary actor in the frost shivers.
      if(environment==='frost'&&(gesture==='hug'||(gesture==='lookaround'&&n%2===0)))gesture='shiver';
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
    const make=(id,at,span,goal,goalTo,focus,focusTo,fov,subjects,sway)=>Object.freeze({id,at,duration:span,goal:new T.Vector3(...goal),goalTo:new T.Vector3(...goalTo),focus:new T.Vector3(...focus),focusTo:new T.Vector3(...focusTo),fov,sway,subjects:Object.freeze(subjects.slice())});
    // Coverage grammar: alternate the establishing side page by page, move in
    // closer for remembered/emotional lines, look up at a threat, and let the
    // closing shot crane away for resolve or drift back for a farewell. Every
    // lens stays in front of the stage with faces above the phone captions.
    const firstIntent=units[0].intent,lastIntent=units.at(-1).intent,open=OPEN.includes(environment),side=Math.max(0,Math.floor(Number(page)||0))%2?-1:1;
    const tone=units.some(u=>u.intent==='danger')?'danger':CLOSE.includes(firstIntent)||CLOSE.includes(lastIntent)?'close':'plain';
    const count=duration<10?3:4,segment=duration/count,cuts=[];
    if(open)cuts.push(make('story-establish',0,segment,[2.8*side,4.7,7.9],[2.58*side,4.52,7.62],[-.1,base+.43,-1.05],[-.1,base+.46,-1.03],54,pair,.018));
    else cuts.push(make('story-establish',0,segment,[2.45*side,3.75,7.35],[2.22*side,3.6,7.02],[-.1,base+.6,-1.1],[-.1,base+.62,-1.08],54,pair,.018));
    const response=validNpc?'story-listener-response':'story-traveller-response';
    if(tone==='danger')cuts.push(make(response,segment,segment,[lead.x+.5*side,lead.y-.3,lead.z+2.55],[lead.x+.44*side,lead.y-.34,lead.z+2.38],[lead.x,lead.y-.22,lead.z],[lead.x,lead.y-.2,lead.z],47,leadName,.009));
    else if(tone==='close')cuts.push(make(response,segment,segment,[lead.x+.3*side,lead.y+.12,lead.z+2.18],[lead.x+.26*side,lead.y+.1,lead.z+2.02],[lead.x,lead.y-.32,lead.z],[lead.x,lead.y-.31,lead.z],44,leadName,.006));
    else cuts.push(make(response,segment,segment,[lead.x+.4*side,lead.y+.21,lead.z+2.62],[lead.x+.34*side,lead.y+.19,lead.z+2.48],[lead.x,lead.y-.42,lead.z],[lead.x,lead.y-.4,lead.z],45,leadName,.007));
    // A slow lateral arc gives the shared two-shot parallax instead of a zoom.
    if(count===4)cuts.push(make(validNpc?'story-shared-direction':'story-landmark-perspective',segment*2,segment,[3.05*side,eye+.8,4.15],[2.6*side,eye+.74,4.42],[-.38,eye-.73,-.28],[-.3,eye-.71,-.3],51,pair,.012));
    if(lastIntent==='danger')cuts.push(make('story-onward',segment*(count-1),segment,[1.62*side,eye+.5,4.75],[1.48*side,eye+.44,4.38],[-.3,eye-.62,-.5],[-.32,eye-.6,-.52],50,pair,.012));
    else if(['resolve','hope','guide'].includes(lastIntent))cuts.push(make('story-onward',segment*(count-1),segment,[1.78*side,eye+.95,5.1],[1.98*side,eye+1.32,5.62],[-.4,eye-.8,-.8],[-.46,eye-.7,-1.2],52,pair,.014));
    else if(['recall','hurt','farewell'].includes(lastIntent))cuts.push(make('story-onward',segment*(count-1),segment,[1.55*side,eye+.95,4.7],[1.85*side,eye+1.25,5.5],[-.4,eye-.8,-.72],[-.42,eye-.78,-.74],52,pair,.014));
    else cuts.push(make('story-onward',segment*(count-1),segment,[1.78*side,eye+1.12,5.35],[1.57*side,eye+1.02,5.07],[-.4,eye-.82,-.72],[-.44,eye-.79,-.75],52,pair,.014));
    const tracks=[];
    if(validHero)tracks.push(Object.freeze({actor:validHero,identity:'hero',performance:'thoughtful',personality:environment,speechAnimation:false,beats:beats(units,duration,!!validNpc,false,environment)}));
    if(validNpc)tracks.push(Object.freeze({actor:validNpc,identity:String(name),performance:INTENTS[units[0].intent].mood,personality:environment,speechAnimation:false,beats:beats(units,duration,!!validHero,true,environment)}));
    const actorTracks=Object.freeze(tracks),first=cuts[0];
    const actionPlan=Object.freeze({kind:'narrative-coverage',pageIndex:Math.max(0,Math.floor(Number(page)||0)),timing:'editorial-estimate',duration,coverage:tone,intents:Object.freeze(units.map(u=>u.intent)),tracks:Object.freeze(tracks.map(t=>Object.freeze({identity:t.identity,beats:t.beats}))),props:Object.freeze([])});
    const shot=Object.freeze({edition:'preview',kind:'story-'+lastIntent,focus:first.focus.clone(),goal:first.goal.clone(),focusTo:first.focusTo.clone(),goalTo:first.goalTo.clone(),fov:first.fov,duration,cuts:Object.freeze(cuts)});
    return Object.freeze({shot,actorTracks,duration,performance:INTENTS[lastIntent].mood,actionPlan,target:focusActor});
  }
  return Object.freeze({plan});
});
