/* Local, optional explanations. Never starts a game loop or changes modal state. */
(function(root,factory){
  const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.TowerCompactHelp=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const installed=new WeakMap();let serial=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // html is trusted application markup; labels and IDs are always escaped.
  function render(title,html,options={}){
    const id=String(options.id||'tower-help-'+(++serial)).replace(/[^a-zA-Z0-9_-]/g,'-'),label=String(title||'詳細說明');
    return '<aside class="tower-compact-help"><button type="button" class="tower-help-toggle" data-tower-help-toggle aria-label="'+esc(label)+'" aria-expanded="false" aria-controls="'+esc(id)+'"><span aria-hidden="true">?</span></button><section id="'+esc(id)+'" class="tower-help-panel" data-tower-help-panel hidden role="region" aria-label="'+esc(label)+'" tabindex="-1"><header><strong>'+esc(label)+'</strong><button type="button" class="tower-help-close" data-tower-help-close aria-label="收起'+esc(label)+'">×</button></header><div class="tower-help-copy">'+String(html||'')+'</div><button type="button" class="tower-help-read" data-tower-help-read aria-label="朗讀'+esc(label)+'">朗讀說明</button></section></aside>';
  }
  function parts(wrapper){return {button:wrapper?.querySelector('[data-tower-help-toggle]'),panel:wrapper?.querySelector('[data-tower-help-panel]')};}
  function collapse(wrapper,focus=false){const {button,panel}=parts(wrapper);if(!button||!panel)return false;const wasOpen=!panel.hidden;panel.hidden=true;button.setAttribute('aria-expanded','false');if(focus&&wasOpen)button.focus?.();return wasOpen;}
  function closeAll(container,focus=false){let closed=false;for(const wrapper of container?.querySelectorAll('.tower-compact-help')||[])closed=collapse(wrapper,focus)||closed;return closed;}
  function defaultRead(panel){root.GameVoice?.readPanel?.(panel);}
  function install(document,options={}){
    if(!document?.addEventListener)return ()=>{};
    const previous=installed.get(document);if(previous){previous.options=options;return previous.dispose;}
    const state={options};
    const click=event=>{
      const target=event.target?.closest?.('[data-tower-help-toggle],[data-tower-help-close],[data-tower-help-read]');if(!target)return;
      const wrapper=target.closest('.tower-compact-help'),{button,panel}=parts(wrapper);if(!button||!panel)return;
      event.preventDefault();event.stopPropagation();
      if(target.hasAttribute('data-tower-help-toggle')){
        const opening=panel.hidden;closeAll(document);if(opening){panel.hidden=false;button.setAttribute('aria-expanded','true');panel.focus?.({preventScroll:true});}
      }else if(target.hasAttribute('data-tower-help-close')){collapse(wrapper,true);state.options.stop?.(panel);}
      else if(!panel.hidden){
        panel.voiceScope='full';panel.voiceAsset='';panel.voiceAfterText='';panel.voiceText=panel.querySelector('.tower-help-copy')?.textContent||'';
        panel.voiceSpeaker=wrapper.closest('#towerDialog')?.voiceSpeaker||{};
        (state.options.read||defaultRead)(panel);
      }
    };
    const key=event=>{if(event.key!=='Escape'&&event.code!=='Escape')return;const open=[...(document.querySelectorAll('.tower-compact-help')||[])].find(w=>!parts(w).panel?.hidden);if(!open)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();const panel=parts(open).panel;collapse(open,true);state.options.stop?.(panel);};
    document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);
    state.dispose=()=>{closeAll(document);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);installed.delete(document);};installed.set(document,state);return state.dispose;
  }
  return {render,install,closeAll};
});
