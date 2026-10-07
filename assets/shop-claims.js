/* Ordinary shelf pickups and paid carts use the existing room transport, never a new backend. */
(function(){
  'use strict';const C=ShopClaimsCore;
  let ledger=null,epoch='',seen=new Set(),pending=new Map(),cutoffs={},paid=[],paidSeen=new Set(),payNo={},payWaiting=new Map(),checkoutStarts=new Map(),last=0,cartVersion=0,lastCart=0,cartSig='',cartSentAt=0;
  // Host broadcasts are event driven: each new receipt/payment is replayed a few times with backoff, and the cart snapshot is re-sent only when it changed or as a heartbeat.
  const SLOT_MS=350,REPLAYS=3,HEARTBEAT_MS=1500,receiptReplays=[],paymentReplays=[];
  const later=item=>({item,n:0,due:performance.now()+SLOT_MS});
  function dueReplays(list,now,limit){
    const rows=[];for(const e of list)if(rows.length<limit&&now>=e.due){rows.push(e.item);e.n++;e.due=now+SLOT_MS*2**e.n;}
    for(let i=list.length;i--;)if(list[i].n>=REPLAYS)list.splice(i,1);return rows;
  }
  const owner=()=>MP.roster?.[0]?.id,on=()=>MP.on&&MP.started&&!MP.ended&&MP.mode==='shop';
  const position=id=>{const p=MP.host&&id!==MP.id&&!MP.bots?.some(b=>b.id===id)&&MP.players?.[id];return p&&Number.isFinite(p.tx)&&Number.isFinite(p.tz)?{x:p.tx,z:p.tz}:botPosOf(id);};
  const stamp=()=>[MP.seed,MP.seriesRound,MP.round].join(':');
  function ensure(){const key=stamp();if(key===epoch)return;epoch=key;ledger=C.create(key);pending.clear();receiptReplays.length=0;cartSig='';last=cartVersion=lastCart=cartSentAt=0;}
  function reset(){ledger=null;epoch='';seen.clear();pending.clear();cutoffs={};paid=[];paidSeen.clear();payNo={};payWaiting.clear();checkoutStarts.clear();receiptReplays.length=paymentReplays.length=0;cartSig='';last=cartVersion=lastCart=cartSentAt=0;}
  const checkoutMs=()=>typeof CHECKOUT_MS==='number'?CHECKOUT_MS:5000;
  function registerAt(id,tolerance=0){const p=position(id);if(!p)return null;return (G.registers||[]).find(r=>Math.hypot(r.x-p.x,r.z-p.z)<CHECKOUT_RANGE+tolerance&&(!window.GameplayRules||window.GameplayRules.clear(p,r,G.wallBoxes||[])))||null;}
  function cancelStart(id,broadcast=false){checkoutStarts.delete(id);pending.delete('pay:'+id);MP.coUntil[id]=0;if(id===MP.id)G.coUntil=0;const bot=MP.bots?.find(b=>b.id===id);if(bot){bot.coUntil=0;bot.coPending=false;}if(broadcast)baseSend({t:'coend',f:id,sr:MP.seriesRound});}
  function hostStart(message){
    if(!on()||message.sr!==MP.seriesRound||!MP.roster.some(r=>r.id===message.f&&!r.disconnected))return;
    const id=message.f,bot=MP.bots?.find(b=>b.id===id),stun=id===MP.id?G.stunnedUntil:bot?.stunnedUntil||MP.players[id]?.stunnedUntil||0;
    if(checkoutStarts.has(id))return;
    // A guest's last position packet trails a running player by up to ~0.75 m.
    // The same lag allowance holds for the whole checkout (the guest is frozen
    // in place meanwhile), and any refusal is answered so nobody stays frozen.
    const lag=id===MP.id||bot?0:.8;
    if(message.ms!==checkoutMs()||G.shifting||G.frozen||performance.now()<stun||!(MP.carts[id]||0)||!registerAt(id,lag)){cancelStart(id,true);return;}
    const until=performance.now()+checkoutMs();checkoutStarts.set(id,{epoch:stamp(),until,lag});baseHandle({...message,ms:checkoutMs()});MP.coUntil[id]=until;
  }
  function apply(receipt){
    if(!on())return;ensure();
    C.apply(seen,receipt,epoch,MP.roster.map(r=>r.id),GOODS.length,r=>{
      pending.delete(r.token);const good=G.goods[r.slot];
      if(good?.spawnSerial===r.spawn){good.taken=true;good.backAt=performance.now()+SHOP_RESTOCK_MS;good.sprite.visible=false;good.tag.visible=false;good.marker.visible=false;}
      if(r.seq>(cutoffs[r.id]?.[epoch]??-1))cartAdd(r.id,r.gi);
      if(r.id===MP.id&&r.seq>(cutoffs[r.id]?.[epoch]??-1)){AudioEng.sfxCoin();showToast('獲得 '+GOODS[r.gi].name,1200,'獲得 '+GOODS[r.gi].name);}updateShopHud();
    });
  }
  function hostClaim(message){
    ensure();const id=message.f,member=MP.roster.find(r=>r.id===id&&!r.disconnected),b=MP.bots?.find(r=>r.id===id),stun=id===MP.id?G.stunnedUntil:b?.stunnedUntil||MP.players[id]?.stunnedUntil||0;
    const owned=ledger.claims[C.key(message.epoch,message.slot,message.spawn)],count=ledger.receipts.length;
    const receipt=C.claim(ledger,{epoch:message.epoch,id,slot:message.slot,spawn:message.spawn},G.goods[message.slot],position(id),!!member&&!G.shifting&&!G.frozen&&!isCheckingOut(id)&&performance.now()>=stun);
    if(receipt&&ledger.receipts.length>count)receiptReplays.push(later(receipt));
    // A refused claim on an already-owned good tells the asker who owns it, so a lost receipt is repaired on demand instead of replayed forever.
    const answer=receipt||owned;if(answer)RoomLifecycle.sendLocal({t:'goodreceipt',epoch,rows:[answer]});return !!receipt;
  }
  function request(id,slot){
    if(!on())return false;ensure();const good=G.goods[slot];if(!good||good.taken)return false;
    const packet={t:'goodclaim',f:id,slot,spawn:good.spawnSerial,epoch,sr:MP.seriesRound},token=C.key(epoch,slot,good.spawnSerial);
    if(MP.host)return hostClaim(packet);
    if(id!==MP.id||pending.has(token))return false;pending.set(token,{packet,at:performance.now()+700});mpSend(packet);return true;
  }
  function applyPayment(packet){
    if(!on()||packet.f!==owner()||packet.sr!==MP.seriesRound||packet.key!==[MP.seed,MP.seriesRound].join(':')||paidSeen.has(packet.token)||!MP.roster.some(r=>r.id===packet.id)||!Array.isArray(packet.list)||packet.list.length>1000||packet.list.some(i=>!Number.isInteger(i)||!GOODS[i])||!Number.isSafeInteger(packet.cut)||packet.cut< -1||!Number.isSafeInteger(packet.payNo)||packet.payNo<1)return;
    if(packet.payNo<=(payNo[packet.id]||0))return;
    if(packet.payNo!==(payNo[packet.id]||0)+1){payWaiting.set(packet.id+':'+packet.payNo,packet);return;}
    payNo[packet.id]=packet.payNo;
    paidSeen.add(packet.token);cutoffs[packet.id]??={};cutoffs[packet.id][packet.epoch]=Math.max(cutoffs[packet.id][packet.epoch]??-1,packet.cut);
    pending.delete('pay:'+packet.id);MP.cartList[packet.id]=packet.list.slice();MP.carts[packet.id]=packet.list.reduce((sum,i)=>sum+GOODS[i].price,0);
    if(packet.id===MP.id)G.coUntil=0;
    baseHandle({t:'codone',f:packet.id,v:MP.carts[packet.id],sr:MP.seriesRound,mid:packet.token});
    const nextKey=packet.id+':'+(packet.payNo+1),next=payWaiting.get(nextKey);if(next){payWaiting.delete(nextKey);applyPayment(next);}
  }
  function hostPay(message){
    if(!on()||message.sr!==MP.seriesRound||message.key!==[MP.seed,MP.seriesRound].join(':'))return;
    const id=message.f,start=checkoutStarts.get(id),bot=MP.bots?.find(b=>b.id===id),stun=id===MP.id?G.stunnedUntil:bot?.stunnedUntil||MP.players[id]?.stunnedUntil||0,now=performance.now();
    if(!MP.roster.some(r=>r.id===id&&!r.disconnected)||!start||start.epoch!==stamp())return;
    // A payment packet can arrive between frames. Recheck cancellation here,
    // rather than waiting for the next frame's ledger cleanup.
    if(G.shifting||G.frozen||now<stun||!registerAt(id,Math.max(.3,start.lag||0))){cancelStart(id,true);return;}
    if(now<start.until)return;
    const packet={t:'goodpaid',key:message.key,epoch:stamp(),id,list:(MP.cartList[id]||[]).slice(),cut:(ledger?.receipts.length||0)-1,payNo:(payNo[id]||0)+1,token:'paid:'+message.key+':'+paid.length,sr:MP.seriesRound};
    paid.push(packet);paymentReplays.push(later(packet));checkoutStarts.delete(id);RoomLifecycle.sendLocal(packet);
  }
  function cartState(packet){
    if(!on()||MP.host||packet.f!==owner()||packet.sr!==MP.seriesRound||packet.epoch!==stamp()||!Number.isSafeInteger(packet.seq)||!Number.isSafeInteger(packet.cut)||packet.cut< -1)return;
    ensure();if(packet.seq<=lastCart)return;
    const actors=MP.roster.map(r=>r.id);if(!packet.lists||actors.some(actor=>!Array.isArray(packet.lists[actor])||packet.lists[actor].length>1000||packet.lists[actor].some(gi=>!Number.isInteger(gi)||!GOODS[gi])||!Number.isSafeInteger(packet.payNo?.[actor])||packet.payNo[actor]<0||!Number.isFinite(packet.banked?.[actor])||packet.banked[actor]<0))return;
    lastCart=packet.seq;
    for(const actor of actors){cutoffs[actor]??={};cutoffs[actor][epoch]=Math.max(cutoffs[actor][epoch]??-1,packet.cut);MP.cartList[actor]=packet.lists[actor].slice();MP.carts[actor]=packet.lists[actor].reduce((sum,gi)=>sum+GOODS[gi].price,0);MP.banked[actor]=packet.banked[actor];MP.shopBonus??={};MP.shopBonus[actor]=Math.max(0,Math.min(750,Number(packet.bonus?.[actor])||0));if(packet.payNo[actor]>(payNo[actor]||0))pending.delete('pay:'+actor);payNo[actor]=Math.max(payNo[actor]||0,packet.payNo[actor]);}
    for(const [token,p]of payWaiting)if(p.payNo<=payNo[p.id])payWaiting.delete(token);
    updateShopHud();
  }
  const baseSend=mpSend;mpSend=function(m){if(m.t==='codone'&&on()){
    const packet={t:'goodpay',f:m.f||MP.id,key:[MP.seed,MP.seriesRound].join(':'),sr:MP.seriesRound};
    if(MP.host)hostPay(packet);else{pending.set('pay:'+MP.id,{packet,at:performance.now()+700});baseSend(packet);}return;
  }if(m.t==='costart'&&on()&&MP.host){const packet={...m,f:m.f||MP.id,sr:MP.seriesRound};hostStart(packet);if(checkoutStarts.has(packet.f))baseSend(packet);return;}baseSend(m);};
  const baseHandle=mpHandle;mpHandle=function(m){
    if(m.t==='costart'&&on()){
      if(MP.host){hostStart(m);return;}
      if(m.sr!==MP.seriesRound||m.ms!==checkoutMs()||!MP.roster.some(r=>r.id===m.f&&!r.disconnected))return;
    }
    if(m.t==='coend'&&on()){
      if(m.sr!==MP.seriesRound||!MP.roster.some(r=>r.id===m.f))return;
      cancelStart(m.f);
    }
    if(m.t==='goodclaim'){if(on()&&MP.host&&m.sr===MP.seriesRound)hostClaim(m);return;}
    if(m.t==='goodreceipt'){if(on()&&m.f===owner()&&m.sr===MP.seriesRound&&m.epoch===stamp()&&Array.isArray(m.rows)&&m.rows.length<=24)m.rows.forEach(apply);return;}
    if(m.t==='goodpay'){if(MP.host)hostPay(m);return;}
    if(m.t==='goodpaid'){applyPayment(m);return;}
    if(m.t==='goodcartstate'){cartState(m);return;}
    // Old direct item declarations cannot bypass the receipt owner.
    if(m.t==='take'&&m.kind==='good'&&on())return;
    if(m.t==='codone'&&on())return;
    // The host re-sends a start for a few seconds after launch; only a start that
    // can actually begin a round may clear receipts, checkouts and payments.
    if(m.t==='start'&&!MP.started)reset();baseHandle(m);
  };
  function tick(){if(!on())return;ensure();const now=performance.now();
    window.ShopCollection?.sync?.();
    if(MP.host)for(const [id,start]of checkoutStarts){const bot=MP.bots?.find(b=>b.id===id),stun=id===MP.id?G.stunnedUntil:bot?.stunnedUntil||MP.players[id]?.stunnedUntil||0;
      if(start.epoch!==stamp()||G.shifting||G.frozen||!registerAt(id,Math.max(.3,start.lag||0))||now<stun||!MP.roster.some(r=>r.id===id&&!r.disconnected))cancelStart(id,true);
    }
    for(const [key,p]of pending){if(p.packet.epoch&&p.packet.epoch!==epoch){pending.delete(key);continue;}if(now>=p.at){baseSend(p.packet);p.at=now+700;}}
    if(!MP.host||now-last<SLOT_MS)return;last=now;
    const rows=dueReplays(receiptReplays,now,24);if(rows.length)RoomLifecycle.sendLocal({t:'goodreceipt',epoch,rows});
    for(const packet of dueReplays(paymentReplays,now,4))RoomLifecycle.sendLocal(packet);
    const snapshot={cut:ledger.receipts.length-1,lists:Object.fromEntries(MP.roster.map(r=>[r.id,(MP.cartList[r.id]||[]).slice()])),banked:Object.fromEntries(MP.roster.map(r=>[r.id,MP.banked[r.id]||0])),bonus:MP.shopBonus||{},payNo:Object.fromEntries(MP.roster.map(r=>[r.id,payNo[r.id]||0]))},sig=JSON.stringify(snapshot);
    if(sig!==cartSig||now-cartSentAt>=HEARTBEAT_MS){cartSig=sig;cartSentAt=now;RoomLifecycle.sendLocal({t:'goodcartstate',epoch,seq:++cartVersion,...snapshot});}
  }
  const frame=mpFrame;mpFrame=function(dt){frame(dt);tick();};
  const leave=mpLeave;mpLeave=function(){reset();leave();};
  window.ShopClaims={request,tick,reset};
})();
