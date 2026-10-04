/* Reuses the maze frame and controls. Hints never speak or disclose hidden positions. */
(function(){
  'use strict';const C=ClassicTacticsCore,cache=new Map();let hWalls=null,vWalls=null,wallCount=-1,round='',builds=0,hud=null,lastText='',lastFrame=-Infinity,lastLayout=-Infinity;
  function reset(){cache.clear();hWalls=vWalls=null;wallCount=-1;round='';lastText='';lastFrame=lastLayout=-Infinity;if(hud)hud.hidden=true;}
  function distances(actor,p,now=performance.now()){
    const epoch=[G.startTime,MP.seed,MP.seriesRound,MP.round].join(':');
    if(epoch!==round||hWalls!==G.hWalls||vWalls!==G.vWalls||wallCount!==(G.wallBoxes?.length||0)){cache.clear();round=epoch;hWalls=G.hWalls;vWalls=G.vWalls;wallCount=G.wallBoxes?.length||0;}
    const cell=worldToCell(p.x,p.z),old=cache.get(actor);
    if(old&&old.cell.x===cell.x&&old.cell.y===cell.y&&now-old.at<650)return old.view;
    const view=C.field(G,cell);if(cache.size>=12&&!cache.has(actor))cache.delete(cache.keys().next().value);cache.set(actor,{cell,at:now,view});builds++;return view;
  }
  function invisible(id,now){return now<(id===MP.id?G.invisUntil:MP.bots?.find(b=>b.id===id)?.invisUntil||MP.players?.[id]?.invisUntil||0);}
  function nearest(actor,candidates,cell,weight,now){return C.nearest(distances(actor.id,actor,now),candidates,cell,weight);}
  function escape(actor,p,candidates,now){return C.flee(distances(actor.id,actor,now),distances('threat:'+MP.taggedId,p,now),candidates);}
  function context(now){
    const mode=MP.on?MP.mode:'classic',variant=window.ModeVariants?.state?.(),capture=window.CaptureFlag?.view?.(),carrier=capture?.flag?.holder,team=capture?.members?.[MP.id]?.team;
    return {mode,running:G.running,story:!!window.TowerMode?.active,ended:MP.on&&MP.ended,frozen:G.frozen,shifting:G.shifting,id:MP.id,hunger:G.satiety,
      left:MP.on&&['shop','tag','treasure'].includes(mode)?Math.max(0,(G.roundEndsAt-now)/1000):mode==='ctf'&&capture?Math.max(0,(capture.deadline-Date.now())/1000):undefined,
      cart:MP.carts?.[MP.id]||0,load:mode==='shop'?cartLoad(MP.id)*100:0,checking:mode==='shop'&&isCheckingOut(MP.id),collection:matchRules().shopCollect!==0,
      orderReady:mode==='shop'&&!!window.ShopCollection?.ready(MP.id),orderOffers:mode==='shop'&&!!window.ShopCollection?.offers(MP.id).length,
      ghost:mode==='tag'&&MP.taggedId===MP.id,holder:MP.treasure?.holder,sealed:variant?.mode==='treasure'&&variant.sealed,
      carrier:carrier===MP.id,allyCarrier:carrier&&capture?.members?.[carrier]?.team===team,checkpoint:variant&&['race','classic'].includes(variant.mode)&&!variant.progress?.[MP.on?MP.id:'solo']?.checkpoint};
  }
  function ensureHud(){if(hud)return;hud=document.createElement('div');hud.id='classicObjectiveHint';hud.setAttribute('role','status');hud.setAttribute('aria-live','off');hud.hidden=true;
    hud.style.cssText='position:absolute;left:12px;top:54px;z-index:16;max-width:min(260px,45vw);box-sizing:border-box;padding:4px 8px;border:1px solid #78979f80;border-radius:8px;background:#122738c9;color:#e5f1ef;font:12px/1.35 system-ui;pointer-events:none';$('gameScreen').appendChild(hud);}
  function layout(now){if(!hud||hud.hidden||now-lastLayout<500)return;lastLayout=now;const base=$('hudInfo')?.getBoundingClientRect?.(),origin=$('gameScreen').getBoundingClientRect().top;let bottom=base?base.bottom-origin+5:54;
    for(const id of ['tagBanner','treasureBanner','preWarn','captureHud','modeObjective']){const node=$(id);if(!node||node.hidden||node.style.display==='none')continue;const rect=node.getBoundingClientRect();if(rect.width&&rect.left<272&&rect.right>12)bottom=Math.max(bottom,rect.bottom-origin+5);}
    hud.style.top=Math.ceil(bottom)+'px';hud.style.fontSize=window.innerHeight<=440?'11px':'12px';
  }
  function frame(){const now=performance.now();if(now-lastFrame<250)return;lastFrame=now;const result=C.hint(context(now));if(!result.text){if(hud)hud.hidden=true;return;}ensureHud();hud.hidden=false;
    if(lastText!==result.text){lastText=result.text;hud.textContent=result.text;}const border=result.urgent?'#ffd778':'#78979f80';if(hud.style.borderColor!==border)hud.style.borderColor=border;layout(now);
  }
  // ModeVariants is already called from the main frame in single-player and rooms.
  const variantsFrame=ModeVariants.frame;ModeVariants.frame=function(...args){variantsFrame(...args);frame();};
  const leave=mpLeave;mpLeave=function(){reset();leave();};
  window.ClassicTactics={distances,nearest,escape,invisible,frame,reset,stats:()=>({fields:cache.size,builds})};
})();
