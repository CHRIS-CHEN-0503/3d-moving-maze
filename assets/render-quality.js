/* Device-local, render-only quality. Simulation and multiplayer clocks never depend on it. */
(function(root){'use strict';
  const KEY='maze3d_render_quality_v1',MODES=['auto','detail','battery'];let mode='auto',controller=null;
  try{const saved=root.localStorage?.getItem(KEY);if(MODES.includes(saved))mode=saved;}catch(_){}
  function create(renderer,{mobile=false,dpr=1,onChange=()=>{}}={}){
    let ratio=0,elapsed=0,total=0,frames=0,slow=0,good=0,rest=0,previous=false,changes=0;
    const cap=()=>Math.min(Math.max(1,dpr),mode==='battery'?1:mode==='detail'?(mobile?1.75:2):(mobile?1.5:1.75));
    const clear=()=>{elapsed=total=frames=slow=good=rest=0;};
    function apply(value){const next=Math.round(Math.max(.85,Math.min(cap(),value))*100)/100;if(next===ratio)return;ratio=next;renderer.setPixelRatio(ratio);changes++;onChange({mode,ratio,reduced:ratio<=1});}
    function configure(){clear();apply(cap());}
    function frame(ms,active=true){
      if(active!==previous){previous=active;clear();}if(!active||mode!=='auto'||!Number.isFinite(ms)||ms<=0||ms>1000)return;
      // Tab restores and menu transitions are excluded; actual sustained slow frames are not.
      elapsed+=ms;total+=Math.min(ms,100);frames++;slow+=ms>24?1:0;rest=Math.max(0,rest-ms);
      if(elapsed<2500||frames<15)return;
      const average=total/frames,misses=slow/frames;elapsed=total=frames=slow=0;
      if(average>25||misses>.35){good=0;if(rest===0&&ratio>.85){apply(ratio-.15);rest=3500;}}
      else if(average<18.8&&misses<.08){if(++good>=3&&rest===0&&ratio<cap()){apply(ratio+.1);good=0;rest=7000;}}
      else good=0;
    }
    configure();return {frame,configure,status:()=>({mode,ratio,changes,mobile}),reset:clear};
  }
  function set(value){if(!MODES.includes(value))return false;mode=value;try{root.localStorage?.setItem(KEY,mode);}catch(_){}controller?.configure();refresh();return true;}
  function controls(){return '<section class="quality-controls" aria-label="畫質與流暢度"><div><b>畫質與流暢度</b><small>自動會依運行狀況調整場景解析度；文字與操作維持清晰。</small></div><div class="quality-options">'+[['auto','自動','建議使用'],['detail','細緻','優先細節'],['battery','省電','減少負載']].map(([id,label,note])=>'<button type="button" data-maze-quality="'+id+'" aria-pressed="'+(id===mode)+'"><strong>'+label+'</strong><small>'+note+'</small></button>').join('')+'</div></section>';}
  function refresh(){root.document?.querySelectorAll('[data-maze-quality]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mazeQuality===mode));}
  function connect(renderer,options){controller=create(renderer,{...options,onChange:p=>{if(root.document)root.document.documentElement.dataset.renderQuality=p.reduced?'economy':'full';options?.onChange?.(p);}});return controller;}
  root.document?.addEventListener('click',e=>{const b=e.target.closest?.('[data-maze-quality]');if(b){e.preventDefault();set(b.dataset.mazeQuality);}});
  const api={create,connect,set,controls,mode:()=>mode,frame:(ms,active)=>controller?.frame(ms,active),status:()=>controller?.status()||{mode},reset:()=>controller?.reset()};
  root.MazeQuality=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
