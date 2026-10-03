(function(){
  'use strict';
  let mission=null,signature='',priorityCursor=0,revision=0,lastSync=0,pendingChoice=null,layoutPending=false;
  function layout(){
    const screen=$('gameScreen'),hud=$('hudTop'),panel=$('shopMission');if(!isShop()||!MP.started||!screen.classList.contains('active'))return;
    const origin=screen.getBoundingClientRect().top,top=Math.ceil(hud.getBoundingClientRect().bottom-origin)+6,missionHeight=panel.hidden?0:panel.getBoundingClientRect().height;
    const values={'--shop-mission-top':top+'px','--shop-sale-top':(top+(missionHeight?missionHeight+6:0))+'px'};
    for(const [property,value]of Object.entries(values))if(screen.style.getPropertyValue(property)!==value)screen.style.setProperty(property,value);
  }
  function scheduleLayout(){if(layoutPending)return;layoutPending=true;const run=()=>{layoutPending=false;layout();};if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else run();}
  function reset(){mission=null;signature='';priorityCursor=revision=lastSync=0;pendingChoice=null;$('shopMission').hidden=true;MP.shopBonus={};}
  function start(){reset();if(!isShop())return;mission=ShopCollectionCore.create(MP.seed,GOODS.length,matchRules().shopCollect!==0);}
  function progress(id){return mission?ShopCollectionCore.progress(mission,id):{paid:[],awarded:false};}
  function checkout(id,list){
    if(!mission)return 0;const bonus=ShopCollectionCore.checkout(mission,id,list)+(matchRules().shopOrders?ShopCollectionCore.checkoutOrder(mission,id,list):0);
    if(bonus){MP.shopBonus[id]=(MP.shopBonus[id]||0)+bonus;
      if(id===MP.id)showToast('訂單商品已結帳！任務 +'+bonus+' 分',2400,'任務完成，獲得'+bonus+'分');}
    if(MP.host)revision++;
    render();return bonus;
  }
  function targetsFor(id){return progress(id).order?.targets||(!progress(id).awarded?mission?.targets:[])||[];}
  function paidFor(id){return progress(id).order?progress(id).orderPaid:progress(id).paid;}
  function needed(id,gi){return !!targetsFor(id).includes(gi)&&!paidFor(id).includes(gi)&&!(MP.cartList[id]||[]).includes(gi);}
  function ready(id){return !!targetsFor(id).length&&targetsFor(id).every(gi=>paidFor(id).includes(gi)||(MP.cartList[id]||[]).includes(gi));}
  function goodForSlot(index,fallback){const orders=mission?Object.values(mission.players).flatMap(p=>p.order?.targets||[]):[];return orders.length?[...new Set([...mission.targets,...orders])][(index+priorityCursor++)%new Set([...mission.targets,...orders]).size]:mission?.targets[index]??fallback;}
  function choose(index,id=MP.id){if(!mission||!matchRules().shopOrders)return;if(MP.host){if(ShopCollectionCore.choose(mission,id,index)){revision++;RoomLifecycle.sendLocal({t:'orderchoice',id,index,number:progress(id).order.number,seed:MP.seed});}}else if(id===MP.id&&!pendingChoice){pendingChoice={index,at:performance.now()+700};mpSend({t:'orderrequest',index,seed:MP.seed});}signature='';render();}
  function sync(){
    if(!mission||!isShop()||!MP.started||MP.ended)return;const now=performance.now();
    if(pendingChoice&&now>=pendingChoice.at){mpSend({t:'orderrequest',index:pendingChoice.index,seed:MP.seed});pendingChoice.at=now+700;}
    if(MP.host&&now-lastSync>=500){lastSync=now;RoomLifecycle.sendLocal({t:'orderstate',seed:MP.seed,revision,players:mission.players,bonus:MP.shopBonus});}
  }
  function draw(){
    for(const canvas of $('shopMissionItems').querySelectorAll('canvas')){
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,48,48);NativeSymbols.draw(ctx,GOODS[Number(canvas.dataset.good)].emoji,24,24,46);
    }
  }
  function render(){
    const shown=isShop()&&MP.started&&!MP.ended&&!!mission?.targets.length;
    const visibilityChanged=$('shopMission').hidden===shown;$('shopMission').hidden=!shown;if(visibilityChanged)scheduleLayout();if(!shown)return;
    const p=progress(MP.id),cart=MP.cartList[MP.id]||[],targets=p.order?.targets||mission.targets,paid=p.order?p.orderPaid:p.paid,offers=matchRules().shopOrders?ShopCollectionCore.offers(mission,MP.id):[];
    const statuses=targets.map(gi=>paid.includes(gi)?'已結帳':cart.includes(gi)?'車上':'待找');
    const key=targets.join(',')+statuses.join(',')+p.awarded+':'+p.orders+':'+!!p.order;if(key===signature)return;signature=key;scheduleLayout();
    $('shopMission').classList.toggle('complete',p.awarded);
    if(p.order||offers.length)$('shopMission').classList.remove('complete');
    $('shopMissionTitle').textContent=offers.length?'追加訂單：二選一':p.order?'追加 '+paid.length+'/'+targets.length+' · 結帳＋'+p.order.bonus:p.awarded?'蒐集完成 ＋300 分':'蒐集 '+p.paid.length+'/5 · 集齊結帳＋300';
    const list=$('shopMissionItems');list.replaceChildren();
    if(offers.length){for(const offer of offers){const btn=document.createElement('button');btn.type='button';btn.style.cssText='height:44px;font-size:11px;display:block';const caption=(offer.index?'挑戰':'快速')+' '+offer.targets.length+'件 ＋'+offer.bonus;
      const icons=document.createElement('div');icons.style.cssText='height:21px;display:flex;justify-content:center;gap:3px';for(const gi of offer.targets){const canvas=document.createElement('canvas');canvas.width=canvas.height=48;canvas.dataset.good=gi;canvas.style.cssText='height:20px;width:20px';icons.appendChild(canvas);}const name=document.createElement('span');name.textContent=caption;name.style.display='block';btn.append(icons,name);
      btn.title=offer.targets.map(gi=>GOODS[gi].name).join('、');btn.setAttribute('aria-label',caption+'：'+btn.title);btn.onclick=()=>{if(!pendingChoice)showToast('追加訂單：'+btn.title,1800,'追加訂單，'+btn.title);choose(offer.index);};list.appendChild(btn);}draw();return;}
    targets.forEach((gi,i)=>{
      const btn=document.createElement('button');btn.type='button';btn.className=statuses[i]==='已結帳'?'paid':statuses[i]==='車上'?'carried':'';
      btn.setAttribute('aria-label',GOODS[gi].name+'，'+statuses[i]);btn.title=GOODS[gi].name+'，'+statuses[i];
      const canvas=document.createElement('canvas');canvas.width=canvas.height=48;canvas.dataset.good=gi;
      const name=document.createElement('span');name.textContent=GOODS[gi].name;
      const state=document.createElement('small');state.textContent=statuses[i];btn.append(canvas,name,state);
      btn.onclick=()=>showToast(GOODS[gi].name+'：'+statuses[i],1500,GOODS[gi].name+'，'+statuses[i]);list.append(btn);
    });draw();
  }
  window.PickupObjects?.onReady(()=>{if(mission)draw();});
  window.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('resize',scheduleLayout);
  if(window.ResizeObserver){const observer=new ResizeObserver(scheduleLayout);observer.observe($('hudTop'));observer.observe($('shopMission'));}
  const handle=mpHandle;mpHandle=function(m){
    if(m.t==='orderrequest'){if(MP.host&&isShop()&&MP.started&&!MP.ended&&m.sr===MP.seriesRound&&m.seed===MP.seed&&MP.roster.some(r=>r.id===m.f&&!r.disconnected))choose(m.index,m.f);return;}
    if(m.t==='orderchoice'){if(m.f!==MP.roster[0]?.id||m.sr!==MP.seriesRound||m.seed!==MP.seed||!mission)return;const p=progress(m.id);if(!p.order&&m.number===p.orders+1)ShopCollectionCore.choose(mission,m.id,m.index);signature='';render();return;}
    if(m.t==='orderstate'){
      if(MP.host||!mission||m.f!==MP.roster[0]?.id||m.sr!==MP.seriesRound||m.seed!==MP.seed||!Number.isSafeInteger(m.revision)||m.revision<revision||!m.players||Object.keys(m.players).some(actor=>!MP.roster.some(r=>r.id===actor)))return;
      const validList=a=>Array.isArray(a)&&a.length<=5&&a.every(i=>Number.isInteger(i)&&!!GOODS[i]);
      if(Object.values(m.players).some(p=>!validList(p.paid)||!validList(p.orderPaid)||!Number.isSafeInteger(p.orders)||p.orders<0||p.orders>3||(p.order&&(!validList(p.order.targets)||![80,150].includes(p.order.bonus)||p.order.number!==p.orders+1))))return;
      revision=m.revision;mission.players=JSON.parse(JSON.stringify(m.players));
      for(const actor of MP.roster.map(r=>r.id))MP.shopBonus[actor]=Math.max(0,Math.min(750,Number(m.bonus?.[actor])||0));
      if(progress(MP.id).order||!ShopCollectionCore.offers(mission,MP.id).length)pendingChoice=null;
      signature='';render();return;
    }
    handle(m);
  };
  window.ShopCollection={start,reset,checkout,render,needed,ready,goodForSlot,progress,choose,sync,offers:id=>mission?ShopCollectionCore.offers(mission,id):[],targets:()=>mission?.targets.slice()||[]};
})();
