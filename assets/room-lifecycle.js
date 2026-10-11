/* Room lifecycle: local authoritative completion, retries, readiness and countdown. */
(function(){
  'use strict';
  const baseHandle=mpHandle,baseSend=mpSend,baseLeave=mpLeave;
  let timer=null,pending=null,lastStart='',lastHost=0,lastPulse=0,lastRetry=0,result=null,startPacket=null;
  const seen=new Set(),outbox=[];let serial=0;
  let readyRequest=null,readySerial=0;
  function renderReady(){
    const button=$('mpReady');button.disabled=!!pending||!!readyRequest;
    if(readyRequest){button.textContent='準備狀態傳送中…';$('mpStatus').textContent='正在等待房主確認…';}
  }
  const hostId=()=>MP.roster?.[0]?.id;
  // Treasure verdicts are host-only results: retried until delivered and processed once.
  const critical=new Set(['start','end','shopend','shift','raceend','twin','contact','tresok','tresdrop']);
  function ensureTimer(){if(!timer)timer=setInterval(tick,250);}
  function sendLocal(message){
    const m={...message,f:MP.id,sr:MP.seriesRound,mid:MP.id+':'+Date.now()+':'+(++serial)};
    mpHandle(m);if(MP.net){baseSend(m);if(['chaoseffect','chaosloot','chaosuse','ragewall','salesync','contact','tresok','tresdrop','shift'].includes(m.t))outbox.push({m,left:3,at:performance.now()+400});}return m;
  }
  function abort(reason){
    pending=null;startPacket=null;result=null;$('roomCountdown').hidden=true;
    if(!MP.started){mpRenderLobby();$('mpStatus').textContent=reason;return;}
    MP.started=false;MP.ended=true;G.running=false;G.frozen=true;
    AudioEng.stopMusic();AudioEng.stopItemLoop();
    $('mpResultTitle').textContent='連線中止';$('mpResultBody').textContent=reason+' 本輪不計勝負。';
    $('mpSeriesState').textContent='請回選單重新建立房間';$('mpSeriesSummary').textContent='';
    $('mpNextRound').style.display='none';$('mpResult').style.display='flex';
  }
  function tick(){
    const now=performance.now();
    if(!MP.on)return;
    if(readyRequest&&!MP.host&&!pending){
      if(now>=readyRequest.deadline){readyRequest=null;mpRenderLobby();renderReady();$('mpStatus').textContent='房主尚未確認，請再按一次準備或檢查連線。';}
      else if(now>=readyRequest.retryAt){baseSend(readyRequest.packet);readyRequest.retryAt=now+800;}
    }
    for(let i=outbox.length-1;i>=0;i--){const retry=outbox[i];if(now>=retry.at){if(MP.net)baseSend(retry.m);retry.at=now+400;if(--retry.left<=0)outbox.splice(i,1);}}
    if(!MP.host&&now-lastPulse>1000){lastPulse=now;baseSend({t:'roompresent'});}
    if(MP.host&&!MP.started){
      const gone=MP.roster.filter(r=>r.id!==MP.id&&!r.bot&&r.seenAt&&now-r.seenAt>15000);
      if(gone.length){for(const r of gone)mpHandle({t:'bye',f:r.id});}
    }
    if(pending){
      const left=Math.max(0,Math.ceil((pending.launchAt-Date.now())/1000));
      $('roomCountdown').textContent=left?'準備出發 · '+left:'出發！';
      if(!left){const packet=pending;pending=null;$('roomCountdown').hidden=true;
        lastStart=packet.session;lastHost=now;window.TagRage?.reset();baseHandle(packet);
        if(['shop','tag','treasure'].includes(MP.mode))G.roundEndsAt=now+Math.max(0,packet.launchAt+packet.roundMs-Date.now());
        window.ShopChaos?.start();
      }
    }
    window.TagRage?.tick();
    // Reuse this existing timer when the host's animation frame is suspended.
    if(document.hidden&&MP.started&&!MP.ended){window.ModeVariants?.frame();window.ShopClaims?.tick();}
    if(MP.host){
      if(startPacket&&now-lastRetry>800&&Date.now()<startPacket.launchAt+5000){lastRetry=now;if(MP.net)baseSend(startPacket);}
      if(MP.started&&!MP.ended){
        if(['shop','tag'].includes(MP.mode)&&now>=G.roundEndsAt){
          mpSend(MP.mode==='shop'?{t:'shopend',carts:MP.carts,banked:MP.banked,shopBonus:MP.shopBonus}:{t:'end',loser:MP.taggedId,catches:MP.tagCatches});
        }
        // The race grace period also ends while the host's tab is in the background.
        if(MP.mode==='race'&&MP.raceEndAt&&now>MP.raceEndAt&&typeof mpEndRace==='function')mpEndRace();
        if(MP.mode==='treasure'&&now>=G.roundEndsAt){
          if(!MP.duelOvertime&&MP.treasure?.holder){MP.duelOvertime=true;G.roundEndsAt+=30000;showToast('有人帶著寶藏！最後延長 30 秒，帶到出口才算勝利。',3000);}
          if(now>=G.roundEndsAt)mpSend({t:'twin',timeout:true,winner:null});
        }
      }
      if(now-lastPulse>1000){lastPulse=now;
        if(result&&MP.net)baseSend(result);
        else if(MP.started)baseSend({t:'roompulse',sr:MP.seriesRound,left:Math.max(0,G.roundEndsAt-now),overtime:!!MP.duelOvertime,
          ...(MP.mode==='treasure'&&MP.treasure?.cell?{tres:{holder:MP.treasure.holder||null,x:MP.treasure.cell.x,y:MP.treasure.cell.y,v:MP.treasure.v||0}}:{})});
        else if(!pending)mpBroadcastLobby();
      }
    }else if((MP.started||pending)&&now-lastHost>15000)abort('房主連線逾時。');
  }
  mpSend=function(m){
    if(MP.host&&critical.has(m.t)){
      if(m.t==='start'&&MP.net){
        if(pending||!mpLobbyPlan().ready)return;
        m={...m,launchAt:Date.now()+5000,session:MP.room+':'+Date.now()+':'+m.seriesRound};
      }
      const packet=sendLocal(m);
      if(m.t==='start')startPacket=packet;
      if(['end','shopend','raceend','twin'].includes(m.t))result=packet;
    }else baseSend(m);
  };
  mpHandle=function(m){
    if(!m||!MP.on)return;
    const owner=hostId();
    if(m.t==='roompresent'){const p=MP.roster.find(r=>r.id===m.f);if(p)p.seenAt=performance.now();return;}
    if(m.t==='lobby'&&owner&&m.f!==owner)return;
    if(['start','end','shopend','shift','raceend','roompulse','tresok','tresdrop'].includes(m.t)&&owner&&m.f!==owner)return;
    if(m.t==='twin'&&m.timeout&&m.f!==owner)return;
    if(m.t==='roompulse'){
      if(m.sr===MP.seriesRound){
        lastHost=performance.now();
        if(MP.started&&['tag','shop','treasure'].includes(MP.mode)&&Number.isFinite(m.left)&&m.left>=0){
          if(MP.mode==='treasure'&&m.overtime===true&&!MP.duelOvertime){MP.duelOvertime=true;G.roundEndsAt=performance.now()+Math.min(30000,m.left);showToast('尋寶進入最後 30 秒延長賽！',2400);}
          else G.roundEndsAt=Math.min(G.roundEndsAt,performance.now()+m.left);
        }
        if(MP.started&&MP.mode==='treasure'&&m.tres&&typeof syncTreasure==='function')syncTreasure(m.tres);
      }
      return;
    }
    if(m.t==='ready'){
      if(MP.host&&!MP.started&&!pending){const player=MP.roster.find(r=>r.id===m.f&&!r.bot);if(player){
        if(Number.isSafeInteger(m.readySeq)&&m.readySeq<(player.readySeq||0))return;
        player.ready=m.ready===true;if(Number.isSafeInteger(m.readySeq))player.readySeq=m.readySeq;
        mpRenderLobby();mpBroadcastLobby();
      }}
      return;
    }
    if(m.t==='hello'&&pending){baseSend({t:'full',to:m.f});return;}
    if(m.t==='startcancel'&&m.f===owner){pending=null;startPacket=null;$('roomCountdown').hidden=true;$('mpReady').disabled=false;mpRenderLobby();return;}
    if(m.t==='bye'&&pending){pending=null;startPacket=null;$('roomCountdown').hidden=true;$('mpReady').disabled=false;if(MP.host)baseSend({t:'startcancel'});}
    if(m.t==='bye'&&m.f===owner&&!MP.host){abort('房主已離開。');return;}
    if(m.mid){if(seen.has(m.mid))return;seen.add(m.mid);if(seen.size>500)seen.delete(seen.values().next().value);}
    if(m.f===owner)lastHost=performance.now();
    // A guest's treasure win is a claim. The host checks the holder it arbitrated and republishes
    // the verdict as a retried result, so a lost packet cannot leave one device still playing.
    if(m.t==='twin'&&!m.timeout&&owner&&m.f!==owner){
      if(!MP.host||!MP.started||MP.ended||MP.mode!=='treasure'||Number(m.sr||1)!==MP.seriesRound||m.winner!==m.f||MP.treasure?.holder!==m.f)return;
      mpSend({t:'twin',winner:m.winner});return;
    }
    // Only the host checks moving positions. Peers apply that decision, not their later interpolated poses.
    if(window.GameplayRules&&['hit','tag','rob'].includes(m.t)){
      if(!MP.host||!MP.started||MP.ended||G.shifting||Number(m.sr||1)!==MP.seriesRound)return;
      const validMode=m.t==='rob'?MP.mode==='shop':m.t==='tag'?MP.mode==='tag':['tag','treasure'].includes(MP.mode);
      if(!validMode||m.f===m.to||!MP.roster.some(p=>p.id===m.f)||!MP.roster.some(p=>p.id===m.to))return;
      if(m.t==='tag'&&m.f!==MP.taggedId)return;
      if(!GameplayRules.contact(botPosOf(m.f),botPosOf(m.to),G.wallBoxes,m.t==='rob'?SHOP_ROB_RANGE+.6:2.6))return;
      if(m.t==='rob'&&isCheckingOut(m.to))return;
      mpSend({t:'contact',event:{...m,contactApproved:true}});return;
    }
    if(m.t==='contact'){
      if(m.f!==owner||!MP.started||MP.ended||m.sr!==MP.seriesRound||!m.event||!['hit','tag','rob'].includes(m.event.t))return;
      baseHandle({...m.event,contactApproved:true});return;
    }
    if(m.t==='start'){
      if(MP.started||m.session&&lastStart===m.session)return;
      if(MP.host&&MP.net&&!mpLobbyPlan().ready)return;
      result=null;ensureTimer();
      if(m.launchAt&&MP.net){pending=m;$('roomCountdown').hidden=false;$('mpStart').disabled=true;$('mpReady').disabled=true;tick();return;}
    }
    if(m.t==='raceend'){
      if(!MP.started||MP.ended||m.sr!==MP.seriesRound)return;
      MP.finishers=m.finishers;MP.outs=m.outs;finishRace();return;
    }
    baseHandle(m);
    if(m.t==='hello'&&MP.host){const p=MP.roster.find(r=>r.id===m.f);if(p)p.seenAt=performance.now();}
    if(m.t==='lobby'){
      const me=MP.roster.find(r=>r.id===MP.id);
      if(readyRequest&&me?.ready===readyRequest.packet.ready&&me.readySeq===readyRequest.packet.readySeq)readyRequest=null;
      renderReady();ensureTimer();
    }
    if(m.t==='start'){window.TagRage?.reset();window.ShopChaos?.start();}
  };
  const finishRace=mpEndRace;
  mpEndRace=function(){
    if(!MP.host||MP.ended)return;
    mpSend({t:'raceend',finishers:MP.finishers,outs:MP.outs});
  };
  const renderResult=showMPResults;
  showMPResults=function(...args){
    renderResult(...args);
    window.ShopChaos?.stop();window.ShopCollection?.render();
    for(const p of MP.roster)if(!p.bot)p.ready=false;
    if(SERIES.kind==='multi'&&SERIES.current<SERIES.total){
      $('mpNextRound').style.display='block';$('mpNextRoundLabel').textContent='返回房間準備下一輪';
    }
  };
  const next=$('mpNextRound').onclick;
  $('mpNextRound').onclick=()=>{
    if(SERIES.kind!=='multi'){next();return;}
    $('mpResult').style.display='none';$('mpModal').style.display='flex';$('mpSetup').style.display='none';$('mpLobby').style.display='block';
    $('mpReady').disabled=false;mpRenderLobby();if(MP.host)mpBroadcastLobby();
  };
  $('mpStart').onclick=()=>{
    if(!MP.host||MP.started||pending)return;
    const players=mpRoundPlayers();if(!players)return;
    const round=SERIES.kind==='multi'&&SERIES.current>0&&SERIES.current<SERIES.total?SERIES.current+1:1;
    if(round===1)resetSeries('multi',selectedRoundTotal(),players);
    sendMpRoundStart(players,round);
  };
  bindActionBtn($('mpReady'),()=>{
    if(!MP.on||MP.host||MP.started||pending||readyRequest)return;
    const me=MP.roster.find(r=>r.id===MP.id);if(!me)return;
    readySerial=Math.max(readySerial,me.readySeq||0)+1;
    const packet={t:'ready',ready:!me.ready,readySeq:readySerial};
    readyRequest={packet,retryAt:performance.now()+800,deadline:performance.now()+10000};
    baseSend(packet);renderReady();ensureTimer();
  });
  mpLeave=function(){
    clearInterval(timer);timer=null;pending=null;startPacket=null;result=null;lastStart='';seen.clear();outbox.length=0;
    readyRequest=null;readySerial=0;
    $('roomCountdown').hidden=true;$('mpReady').disabled=false;window.ShopChaos?.stop();baseLeave();
  };
  const connect=mpConnect;
  // v1.61.1 · forward every argument: the retry counter must survive this wrapper, or a broker
  // outage reconnects every second forever instead of backing off and stopping.
  mpConnect=async function(...args){await connect(...args);ensureTimer();};
  window.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  window.RoomLifecycle={tick,sendLocal,hostSeenAt:()=>lastHost};
})();
