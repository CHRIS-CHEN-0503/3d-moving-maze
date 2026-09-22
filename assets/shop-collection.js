(function(){
  'use strict';
  let mission=null,signature='';
  function reset(){mission=null;signature='';$('shopMission').hidden=true;MP.shopBonus={};}
  function start(){reset();if(!isShop())return;mission=ShopCollectionCore.create(MP.seed,GOODS.length,matchRules().shopCollect!==0);}
  function progress(id){return mission?ShopCollectionCore.progress(mission,id):{paid:[],awarded:false};}
  function checkout(id,list){
    if(!mission)return 0;const bonus=ShopCollectionCore.checkout(mission,id,list);
    if(bonus){MP.shopBonus[id]=(MP.shopBonus[id]||0)+bonus;
      if(id===MP.id)showToast('五樣商品已結帳！蒐集任務 +'+bonus+' 分',3200,'蒐集任務完成，獲得三百分');}
    render();return bonus;
  }
  function needed(id,gi){return !!mission?.targets.includes(gi)&&!progress(id).paid.includes(gi)&&!(MP.cartList[id]||[]).includes(gi);}
  function ready(id){return !!mission?.targets.length&&!progress(id).awarded&&mission.targets.every(gi=>progress(id).paid.includes(gi)||(MP.cartList[id]||[]).includes(gi));}
  function goodForSlot(index,fallback){return mission?.targets[index]??fallback;}
  function draw(){
    for(const canvas of $('shopMissionItems').querySelectorAll('canvas')){
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,48,48);NativeSymbols.draw(ctx,GOODS[Number(canvas.dataset.good)].emoji,24,24,46);
    }
  }
  function render(){
    const shown=isShop()&&MP.started&&!MP.ended&&!!mission?.targets.length;
    $('shopMission').hidden=!shown;if(!shown)return;
    const p=progress(MP.id),cart=MP.cartList[MP.id]||[];
    const statuses=mission.targets.map(gi=>p.paid.includes(gi)?'已結帳':cart.includes(gi)?'車上':'待找');
    const key=mission.targets.join(',')+statuses.join(',')+p.awarded;if(key===signature)return;signature=key;
    $('shopMission').classList.toggle('complete',p.awarded);
    $('shopMissionTitle').textContent=p.awarded?'蒐集完成 ＋300 分':'蒐集 '+p.paid.length+'/5 · 集齊結帳＋300';
    const list=$('shopMissionItems');list.replaceChildren();
    mission.targets.forEach((gi,i)=>{
      const btn=document.createElement('button');btn.type='button';btn.className=statuses[i]==='已結帳'?'paid':statuses[i]==='車上'?'carried':'';
      btn.setAttribute('aria-label',GOODS[gi].name+'，'+statuses[i]);btn.title=GOODS[gi].name+'，'+statuses[i];
      const canvas=document.createElement('canvas');canvas.width=canvas.height=48;canvas.dataset.good=gi;
      const name=document.createElement('span');name.textContent=GOODS[gi].name;
      const state=document.createElement('small');state.textContent=statuses[i];btn.append(canvas,name,state);
      btn.onclick=()=>showToast(GOODS[gi].name+'：'+statuses[i],1500,GOODS[gi].name+'，'+statuses[i]);list.append(btn);
    });draw();
  }
  window.PickupObjects?.onReady(()=>{if(mission)draw();});
  window.ShopCollection={start,reset,checkout,render,needed,ready,goodForSlot,progress,targets:()=>mission?.targets.slice()||[]};
})();
