/* Optional objective variants. Geometry and state are shared, seeded and host-owned. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ModeVariantsCore=api;})(globalThis,function(){
  'use strict';
  const enabled=(mode,rules)=>!!rules?.[{classic:'raceCheckpoint',race:'raceCheckpoint',treasure:'treasureSeal',ctf:'ctfShortcut',shop:'shopOrders',tag:'tagBells'}[mode]];
  const near=(a,b,r=1.6)=>!!a&&!!b&&[a.x,a.z,b.x,b.z].every(Number.isFinite)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
  function cells(seed,w,h,count=2,excluded=[]){let n=(seed^0x4d0de123)>>>0;const pool=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(!excluded.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)<2))pool.push({x,y});const result=[];while(pool.length&&result.length<count){n=(Math.imul(n,1664525)+1013904223)>>>0;const i=Math.floor(n/4294967296*pool.length),p=pool.splice(i,1)[0];if(!result.some(q=>Math.abs(p.x-q.x)+Math.abs(p.y-q.y)<Math.max(2,Math.floor(w/3))))result.push(p);}return result;}
  function create(mode,seed,epoch,points,ids){return {mode,seed:seed>>>0,epoch:String(epoch),points:points.map(p=>({...p})),rev:0,sealed:true,progress:Object.fromEntries(ids.map(id=>[id,{checkpoint:false,bell:0,score:0,cool:0,channel:null}])),shortcut:[{until:0,cool:0,channel:null},{until:0,cool:0,channel:null}]};}
  function stand(p,point,now,seconds,channel,key,eligible){if(!eligible||!near(p,point))return {channel:null,done:false};if(!channel||channel.key!==key)return {channel:{key,since:now},done:false};return {channel,done:now-channel.since>=seconds*1000};}
  function tick(state,positions,now,context={}){
    if(!state||context.shifting||context.ended){if(state){for(const p of Object.values(state.progress))p.channel=null;for(const s of state.shortcut)s.channel=null;}return [];}
    const events=[];
    for(const [id,p] of Object.entries(state.progress)){
      const pos=positions[id],eligible=!!pos&&!context.outs?.[id]&&!context.stunned?.[id];
      if(state.mode==='classic'||state.mode==='race'){
        if(p.checkpoint)continue;const s=stand(pos,state.points[0],now,.8,p.channel,'checkpoint',eligible);p.channel=s.channel;if(s.done){p.checkpoint=true;p.channel=null;events.push({kind:'checkpoint',id});}
      }else if(state.mode==='treasure'){
        if(!state.sealed||context.holder!==id){p.channel=null;continue;}const i=state.points.findIndex(q=>near(pos,q));const s=stand(pos,state.points[i],now,1.5,p.channel,'seal'+i,eligible&&i>=0);p.channel=s.channel;if(s.done){state.sealed=false;p.channel=null;events.push({kind:'seal',id});}
      }else if(state.mode==='tag'){
        const i=p.bell%Math.max(1,state.points.length),s=stand(pos,state.points[i],now,1,p.channel,'bell'+i,eligible&&id!==context.ghost&&now>=p.cool&&p.score<150);p.channel=s.channel;if(s.done){p.bell++;p.score+=25;p.cool=now+15000;p.channel=null;events.push({kind:'bell',id,score:p.score});}
      }else if(state.mode==='ctf'){
        const team=context.teams?.[id],slot=state.shortcut[team];if(!slot||now<slot.until||now<slot.cool)continue;
        if(slot.channel&&slot.channel.key!=='shortcut:'+id){const other=slot.channel.key.slice(9);if(near(positions[other],state.points[team])&&!context.outs?.[other]&&!context.stunned?.[other])continue;slot.channel=null;}
        const s=stand(pos,state.points[team],now,2,slot.channel,'shortcut:'+id,eligible);if(slot.channel&&!s.channel&&slot.channel.key!=='shortcut:'+id)continue;slot.channel=s.channel;
        if(s.done){slot.until=now+10000;slot.cool=now+15000;slot.channel=null;events.push({kind:'shortcut',id,team,until:slot.until});}
      }
    }
    if(events.length)state.rev++;return events;
  }
  function canFinish(state,id){return !state||!state.progress[id]||(state.mode==='treasure'?!state.sealed:['race','classic'].includes(state.mode)?state.progress[id].checkpoint:true);}
  function progress(state,id,now){const p=state?.progress[id];if(!p)return 0;const ch=p.channel||(state.mode==='ctf'?state.shortcut.find(s=>s.channel?.key==='shortcut:'+id)?.channel:null);return ch?Math.max(0,Math.min(1,(now-ch.since)/(state.mode==='treasure'?1500:state.mode==='ctf'?2000:state.mode==='tag'?1000:800))):0;}
  return Object.freeze({enabled,near,cells,create,stand,tick,canFinish,progress});
});
