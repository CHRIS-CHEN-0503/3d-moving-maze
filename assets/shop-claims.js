/* Ordinary shelf pickups and paid carts use the existing room transport, never a new backend. */
(function(){
  'use strict';const C=ShopClaimsCore;
  let ledger=null,epoch='',seen=new Set(),pending=new Map(),cutoffs={},paid=[],paidSeen=new Set(),payNo={},payWaiting=new Map(),cursor=0,payCursor=0,last=0,cartVersion=0,lastCart=0;
  const owner=()=>MP.roster?.[0]?.id,on=()=>MP.on&&MP.started&&!MP.ended&&MP.mode==='shop';
  const position=id=>{const p=MP.host&&id!==MP.id&&!MP.bots?.some(b=>b.id===id)&&MP.players?.[id];return p&&Number.isFinite(p.tx)&&Number.isFinite(p.tz)?{x:p.tx,z:p.tz}:botPosOf(id);};
  const stamp=()=>[MP.seed,MP.seriesRound,MP.round].join(':');
  function ensure(){const key=stamp();if(key===epoch)return;epoch=key;ledger=C.create(key);pending.clear();cursor=last=cartVersion=lastCart=0;}
  function reset(){ledger=null;epoch='';seen.clear();pending.clear();cutoffs={};paid=[];paidSeen.clear();payNo={};payWaiting.clear();cursor=payCursor=last=cartVersion=lastCart=0;}
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
    const receipt=C.claim(ledger,{epoch:message.epoch,id,slot:message.slot,spawn:message.spawn},G.goods[message.slot],position(id),!!member&&!G.shifting&&!G.frozen&&!isCheckingOut(id)&&performance.now()>=stun);
    if(receipt)RoomLifecycle.sendLocal({t:'goodreceipt',epoch,rows:[receipt]});return !!receipt;
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
    baseHandle({t:'codone',f:packet.id,v:MP.carts[packet.id],sr:MP.seriesRound,mid:packet.token});
    const nextKey=packet.id+':'+(packet.payNo+1),next=payWaiting.get(nextKey);if(next){payWaiting.delete(nextKey);applyPayment(next);}
  }
  function hostPay(message){
    if(!on()||message.sr!==MP.seriesRound||message.key!==[MP.seed,MP.seriesRound].join(':')||G.shifting)return;
    const id=message.f,until=MP.coUntil[id]||0,p=position(id);
    if(!MP.roster.some(r=>r.id===id&&!r.disconnected)||!until||performance.now()<until-150||!p||!(G.registers||[]).some(r=>Math.hypot(r.x-p.x,r.z-p.z)<CHECKOUT_RANGE+.3))return;
    const packet={t:'goodpaid',key:message.key,epoch:stamp(),id,list:(MP.cartList[id]||[]).slice(),cut:(ledger?.receipts.length||0)-1,payNo:(payNo[id]||0)+1,token:'paid:'+message.key+':'+paid.length,sr:MP.seriesRound};
    paid.push(packet);RoomLifecycle.sendLocal(packet);
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
  }baseSend(m);};
  const baseHandle=mpHandle;mpHandle=function(m){
    if(m.t==='goodclaim'){if(on()&&MP.host&&m.sr===MP.seriesRound)hostClaim(m);return;}
    if(m.t==='goodreceipt'){if(on()&&m.f===owner()&&m.sr===MP.seriesRound&&m.epoch===stamp()&&Array.isArray(m.rows)&&m.rows.length<=24)m.rows.forEach(apply);return;}
    if(m.t==='goodpay'){if(MP.host)hostPay(m);return;}
    if(m.t==='goodpaid'){applyPayment(m);return;}
    if(m.t==='goodcartstate'){cartState(m);return;}
    // Old direct item declarations cannot bypass the receipt owner.
    if(m.t==='take'&&m.kind==='good'&&on())return;
    if(m.t==='codone'&&on())return;
    if(m.t==='start')reset();baseHandle(m);
  };
  function tick(){if(!on())return;ensure();const now=performance.now();
    window.ShopCollection?.sync?.();
    for(const [key,p]of pending){if(p.packet.epoch&&p.packet.epoch!==epoch){pending.delete(key);continue;}if(now>=p.at){baseSend(p.packet);p.at=now+700;}}
    if(!MP.host||now-last<350)return;last=now;const chunk=C.batch(ledger,cursor);cursor=chunk.next;if(chunk.rows.length)RoomLifecycle.sendLocal({t:'goodreceipt',epoch,rows:chunk.rows});
    if(paid.length){RoomLifecycle.sendLocal(paid[payCursor%paid.length]);payCursor++;}
    RoomLifecycle.sendLocal({t:'goodcartstate',epoch,seq:++cartVersion,cut:ledger.receipts.length-1,lists:Object.fromEntries(MP.roster.map(r=>[r.id,(MP.cartList[r.id]||[]).slice()])),banked:Object.fromEntries(MP.roster.map(r=>[r.id,MP.banked[r.id]||0])),bonus:MP.shopBonus||{},payNo:Object.fromEntries(MP.roster.map(r=>[r.id,payNo[r.id]||0]))});
  }
  const frame=mpFrame;mpFrame=function(dt){frame(dt);tick();};
  const leave=mpLeave;mpLeave=function(){reset();leave();};
  window.ShopClaims={request,tick,reset};
})();
