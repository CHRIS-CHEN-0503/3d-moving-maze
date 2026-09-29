/* Single/double activation is keyed by actor ID, not a periodically redrawn button. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.TowerTeamTactics=api;})(globalThis,function(root){
  'use strict';
  const DOUBLE_MS=320;
  function gesture({single,double,ready=()=>true,schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now()}){
    let timer=null,id=null,at=0;
    function clear(){if(timer!==null)cancel(timer);timer=null;id=null;}
    function activate(next,keyboard=false){if(!ready()){clear();return;}if(keyboard){clear();single(next);return;}
      const time=now();if(timer!==null&&id===next&&time-at<=DOUBLE_MS){clear();double(next);return;}
      clear();id=next;at=time;timer=schedule(()=>{timer=null;id=null;if(ready())single(next);},DOUBLE_MS);
    }
    return {activate,clear};
  }
  function create({run,ready,saveChoice,switchActor,label,escape}){
    const H=root.TowerHeroes,R=root.TowerHeroGrowth,doc=root.document;let panel=null,team=null,selected=null;
    const valid=id=>ready()&&H.ids(run()).includes(id)&&H.hp(run(),id)>0;
    const control=gesture({ready,single:open,double:id=>{close();if(valid(id))switchActor(id);}});
    function anchor(){return [...team.querySelectorAll('[data-hero-switch]')].find(b=>b.dataset.heroSwitch===selected);}
    function close(restore=false){const button=selected&&anchor();selected=null;if(panel)panel.hidden=true;control.clear();if(restore)button?.focus();}
    function position(){const button=anchor();if(!button){close();return;}const b=button.getBoundingClientRect(),p=panel.getBoundingClientRect(),pad=8;
      const beside=b.bottom+6+p.height>root.innerHeight-pad&&b.right+8+p.width<=root.innerWidth-pad;
      panel.style.left=Math.max(pad,Math.min(beside?b.right+8:b.left,root.innerWidth-p.width-pad))+'px';
      panel.style.top=Math.max(pad,Math.min(beside?b.top:b.bottom+6,root.innerHeight-p.height-pad))+'px';
    }
    function open(id){if(!valid(id))return;if(selected===id){close();return;}selected=id;const current=R.state(run()).policies[id].strategy;
      panel.innerHTML='<header><strong>'+escape(label(id))+'・戰鬥策略</strong><button type="button" data-tactics-close aria-label="關閉策略">×</button></header><div class="hero-tactic-options">'+Object.entries(R.STRATEGIES).map(([key,s])=>'<button type="button" data-tactic="'+key+'" aria-pressed="'+(current===key)+'"><b>'+escape(s.name)+'</b><small>'+escape(s.description)+'</small></button>').join('')+'</div><p>自動行動時生效 · 快速點兩下職業卡切換操作</p>';
      panel.hidden=false;position();panel.querySelector('[data-tactic][aria-pressed="true"]')?.focus();root.GameVoice?.announce('選擇戰鬥策略',true);
    }
    function refresh(){if(!ready()){close();return;}if(selected){if(!valid(selected))close();else position();}}
    function install(){team=doc.getElementById('heroTeamBar');panel=doc.createElement('section');panel.id='heroTactics';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','隊員戰鬥策略');doc.getElementById('gameScreen').appendChild(panel);
      for(const host of [team,panel])for(const type of ['pointerdown','touchstart'])host.addEventListener(type,e=>e.stopPropagation(),{passive:true});
      team.addEventListener('click',e=>{const b=e.target.closest('[data-hero-switch]');if(b&&!b.disabled){e.stopPropagation();control.activate(b.dataset.heroSwitch,e.detail===0);}});
      panel.addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('[data-tactics-close]')){close(true);return;}const b=e.target.closest('[data-tactic]');if(b&&selected&&valid(selected)&&saveChoice(selected,b.dataset.tactic))close(true);});
      doc.addEventListener('pointerdown',e=>{if(!team.contains(e.target)&&!panel.contains(e.target))close();},{capture:true,passive:true});
      doc.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const options=[...panel.querySelectorAll('[data-tactic]')],i=options.indexOf(doc.activeElement),next=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:options.length-1))%options.length;options[next].focus();}},{capture:true});
      root.addEventListener('resize',refresh);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)close();});
    }
    return {install,refresh,close};
  }
  return {DOUBLE_MS,gesture,create};
});
