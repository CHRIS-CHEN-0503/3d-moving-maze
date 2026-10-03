/* A single host receipt owns each ordinary shelf item. No optimistic score credit. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ShopClaimsCore=api;})(globalThis,function(){
  'use strict';
  function create(epoch){return {epoch:String(epoch),claims:Object.create(null),receipts:[]};}
  function key(epoch,slot,spawn){return String(epoch)+':'+slot+':'+spawn;}
  function claim(state,request,good,position,eligible=true){
    const previous=state?.claims[key(request?.epoch,request?.slot,request?.spawn)];
    if(previous)return previous.id===String(request.id)?previous:null;
    if(!state||!request||!good||!eligible||String(request.epoch)!==state.epoch||!Number.isSafeInteger(request.slot)||request.slot<0||!Number.isSafeInteger(request.spawn)||request.spawn!==good.spawnSerial||!Number.isInteger(good.gi)||good.taken||!position||![position.x,position.z,good.x,good.z].every(Number.isFinite)||Math.hypot(position.x-good.x,position.z-good.z)>1.9)return null;
    const token=key(state.epoch,request.slot,request.spawn);
    const receipt={token,epoch:state.epoch,id:String(request.id),slot:request.slot,spawn:request.spawn,gi:good.gi,seq:state.receipts.length};
    state.claims[token]=receipt;state.receipts.push(receipt);good.taken=true;return receipt;
  }
  function valid(receipt,epoch,roster,count){return !!receipt&&String(receipt.epoch)===String(epoch)&&Number.isSafeInteger(receipt.slot)&&receipt.slot>=0&&Number.isSafeInteger(receipt.spawn)&&receipt.spawn>=1&&Number.isSafeInteger(receipt.gi)&&receipt.gi>=0&&receipt.gi<count&&Number.isSafeInteger(receipt.seq)&&receipt.seq>=0&&roster.includes(receipt.id)&&receipt.token===key(epoch,receipt.slot,receipt.spawn);}
  function apply(seen,receipt,epoch,roster,count,credit){if(!valid(receipt,epoch,roster,count)||seen.has(receipt.token))return false;seen.add(receipt.token);credit(receipt);return true;}
  function batch(state,cursor=0,size=24){const rows=state.receipts.slice(cursor,cursor+size);return {rows,next:cursor+rows.length>=state.receipts.length?0:cursor+rows.length};}
  return Object.freeze({create,key,claim,valid,apply,batch});
});
