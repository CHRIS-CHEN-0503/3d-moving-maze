(function(){
  'use strict';
  const screen=$('gameScreen'),toggle=$('actionsToggle');
  const open=value=>{screen.classList.toggle('actions-open',value);toggle.setAttribute('aria-expanded',String(value));};
  bindActionBtn(toggle,()=>open(!screen.classList.contains('actions-open')));
  $('lookZone').addEventListener('touchstart',()=>open(false),{passive:true});
  $('lookZone').addEventListener('mousedown',()=>open(false));
  screen.addEventListener('click',e=>{if(e.target.closest('button')&&e.target.closest('button')!==toggle)open(false);});
  // 純文字介面移除系統表情圖；原創圖集、3D 模型與 SVG 保留。
  const strip=s=>s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu,'').replace(/\s{2,}/g,' ');
  const queue=new Set();let scheduled=false;
  function clean(root){
    if(root.nodeType===3){const s=strip(root.nodeValue);if(s!==root.nodeValue)root.nodeValue=s;return;}
    if(!root.querySelectorAll||root.closest?.('script,style,textarea,input'))return;
    const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
    while(n=walk.nextNode())if(!n.parentElement.closest('script,style,textarea,input')){const s=strip(n.nodeValue);if(s!==n.nodeValue)n.nodeValue=s;}
  }
  // 僅檢查變動文字，避免每幀重掃整個介面。
  const observer=new MutationObserver(records=>{
    for(const r of records){if(r.type==='characterData'){if(strip(r.target.nodeValue)!==r.target.nodeValue)queue.add(r.target);}else for(const n of r.addedNodes)queue.add(n);}
    if(queue.size&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;for(const n of queue)clean(n);queue.clear();});}
  });
  clean(document.body);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  const hp=updateHpHud;updateHpHud=function(){hp();if(MP.on&&MP.mode==='tag')$('hpHearts').textContent=hpOf(MP.id)+' / '+hpMaxOf(MP.id);};
})();
