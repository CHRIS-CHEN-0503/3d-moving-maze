/* Deterministic, host-owned neutral-flag rules. Distances use world metres. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CaptureCore=api;})(globalThis,function(){
  'use strict';
  const near=(a,b,r)=>!!a&&!!b&&Number.isFinite(a.x)&&Number.isFinite(a.z)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
  function create(roster,center,bases,now=0){
    if(!Array.isArray(roster)||roster.length<4||roster.length>10||roster.length%2||new Set(roster.map(p=>p.id)).size!==roster.length)throw Error('兩隊各需 2～5 位玩家');
    return {members:Object.fromEntries(roster.map((p,i)=>[p.id,{team:i%2,points:0,hits:0,passes:0,cool:0,stun:0,safe:now+3000,respawn:0,offline:false}])),center:{...center},bases,flag:{...center,holder:null,returnAt:0,lock:0},channel:null,winner:null,rev:0};
  }
  function drop(s,id,positions,now){if(s.flag.holder!==id)return false;const pos=positions[id]||s.center;s.flag={x:pos.x,z:pos.z,holder:null,returnAt:now+20000,lock:now+1000};s.channel=null;s.rev++;return true;}
  function ready(p,now){return p&&!p.offline&&now>=p.stun;}
  function attack(s,id,to,positions,now,clear=()=>true){
    const a=s.members[id],b=s.members[to];
    if(s.winner!==null||!ready(a,now)||!ready(b,now)||a.team===b.team||now<a.cool||now<b.safe||!near(positions[id],positions[to],2.4)||!clear(positions[id],positions[to]))return false;
    a.cool=now+1800;a.hits++;a.points+=75;
    drop(s,to,positions,now);b.stun=now+3000;b.safe=now+6000;b.respawn++;s.rev++;return true;
  }
  function pass(s,id,to,positions,now,clear=()=>true){
    const a=s.members[id],b=s.members[to];
    if(s.winner!==null||s.flag.holder!==id||!ready(a,now)||!ready(b,now)||id===to||a.team!==b.team||now<s.flag.lock||!near(positions[id],positions[to],6)||!clear(positions[id],positions[to]))return false;
    s.flag.holder=to;s.flag.lock=now+2000;s.channel=null;a.passes++;s.rev++;return true;
  }
  function disconnect(s,id,positions,now){const p=s.members[id];if(!p||p.offline)return;drop(s,id,positions,now);p.offline=true;s.rev++;}
  function tick(s,positions,now,clear=()=>true){
    if(s.winner!==null)return;
    const f=s.flag;
    if(f.holder&&(!ready(s.members[f.holder],now)||!positions[f.holder]))drop(s,f.holder,positions,now);
    if(!s.flag.holder){
      if(s.flag.returnAt&&now>=s.flag.returnAt){s.flag={...s.center,holder:null,returnAt:0,lock:now+500};s.rev++;}
      if(now>=s.flag.lock){
        const closest=Object.keys(s.members).filter(id=>ready(s.members[id],now)&&near(positions[id],s.flag,1.5)&&clear(positions[id],s.flag)).sort((a,b)=>Math.hypot(positions[a].x-s.flag.x,positions[a].z-s.flag.z)-Math.hypot(positions[b].x-s.flag.x,positions[b].z-s.flag.z)||a.localeCompare(b))[0];
        if(closest){s.flag.holder=closest;s.flag.returnAt=0;s.flag.lock=now+1000;s.rev++;}
      }
    }
    const id=s.flag.holder;if(!id)return;
    const team=s.members[id].team,pos=positions[id],base=s.bases[1-team];
    const contested=Object.keys(s.members).some(other=>s.members[other].team!==team&&ready(s.members[other],now)&&near(positions[other],base,3.2)&&clear(positions[other],base));
    if(!near(pos,base,1.8)||contested){if(s.channel){s.channel=null;s.rev++;}return;}
    if(!s.channel||s.channel.id!==id){s.channel={id,since:now};s.rev++;}
    else if(now-s.channel.since>=3000){s.winner=team;s.members[id].points+=500;for(const member of Object.values(s.members))if(member.team===team)member.points+=1000;s.rev++;}
  }
  return Object.freeze({create,attack,pass,tick,drop,disconnect,near});
});
