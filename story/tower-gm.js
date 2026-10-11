/* 逃生梯（GM 模式）：只由 #逃生梯 網址開啟的劇情測試入口。
   在獨立的 GM 存檔中直接產生任一樓層的合法旅程，指定隊伍、等級與物品；
   不出現在遊戲選單，不送成績、不連多人，也不碰正式劇情存檔。 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TowerGM=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const HASHES=['逃生梯','gm-ladder'];
  // A jump made during play waits in PENDING: leaving the page saves the running floor into
  // GM_SAVE, so the new journey is moved in only after the reload, before the story starts.
  const GM_SAVE='maze3d_tower_gm_v1',PENDING='maze3d_tower_gm_pending',AUTOSTART='maze3d_tower_gm_autostart';
  const node=typeof module==='object'&&module.exports;
  const dep=(file,name)=>node?require('./'+file):root[name];
  const C=()=>dep('story-core.js','TowerCore'),P=()=>dep('tower-party-core.js','TowerPartyCore'),H=()=>dep('tower-heroes-core.js','TowerHeroes');
  const N=()=>dep('tower-narrative.js','TowerNarrative'),G=()=>dep('tower-hero-growth.js','TowerHeroGrowth'),E=()=>dep('tower-encounters.js','TowerEncounters'),D=()=>dep('tower-dungeons.js','TowerDungeons');
  const M=()=>dep('tower-materials.js','TowerMaterials');
  const ENDINGS=['release','keeper','bridge'];
  const clampInt=(value,min,max)=>Math.max(min,Math.min(max,Math.round(Number(value)||0)));

  function active(location=root.location){
    try{const hash=decodeURIComponent(String(location?.hash||'').replace(/^#/,''));return HASHES.includes(hash);}catch(_){return false;}
  }
  const limits=floor=>floor<0?{hero:15,member:10,members:4}:{hero:10,member:5,members:3};

  // Gear the actor's job can wear, best tier its level allows (tiers 4-5 only underground).
  function bestKit(job,level,floor){
    const h=H(),kit={};if(job==='robot')return kit;
    for(const slot of h.SLOTS){
      const options=Object.values(h.GEAR).filter(g=>g.slot===slot&&!g.integrated&&!g.craftOnly&&!g.core&&g.jobs?.includes(job)&&(g.tier||1)<=(floor<0?5:3)&&(g.requiredLevel||1)<=level);
      if(!options.length)continue;
      // One-handed weapon plus the sturdiest shield for shield users; otherwise the strongest piece.
      const shieldUser=Object.values(h.GEAR).some(g=>g.slot==='shield'&&g.jobs?.includes(job));
      const pick=options.filter(g=>slot!=='weapon'||!shieldUser||g.hands!==2).sort((a,b)=>(b.tier||1)-(a.tier||1)||(b.defense||0)-(a.defense||0)||(b.damage||0)+(b.magicDamage||0)-(a.damage||0)-(a.magicDamage||0)||(a.kind<b.kind?-1:1))[0];
      if(pick)kit[slot]=pick.kind;
    }
    return kit;
  }

  function jump(run,floor,readStories){
    const n=N();
    run.floor=floor;run.floorsCleared=floor>0?99-floor:99+(-floor-1);run.status='playing';
    run.chronicle=n.newChronicle(floor);if(floor<0)run.chronicle.ending=run.underworld.surfaceEnding;
    run.chronicle.read=readStories?n.unlockedScenes(floor).map(s=>s.id):[];
    run.adventure=E().newAdventure();run.expedition=D().newExpedition();run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.floorElapsed=0;
    if(run.engine){delete run.engine.sightMemory;delete run.engine.mapKnowledge;}
    P().advance(run,{reward:false});
  }

  /* options: {floor, job, sex, name, level, companions:[{job,sex,level}], items:{coins,bag,scrap,materials,ingredients,light},
     gear:true, readStories:true, ending:'release', seed}. Returns {ok, run, message, notes}. */
  function build(options={}){
    const c=C(),p=P(),h=H(),notes=[];
    const floor=Number(options.floor);if(!c.isFloor(floor))return {ok:false,message:'樓層必須是 99～1 或 B1～B50。'};
    const job=options.job;if(!p.PROFESSIONS[job])return {ok:false,message:'請選擇有效的職業。'};
    const sex=options.sex==='female'?'female':'male',limit=limits(floor),seed=clampInt(options.seed||Date.now()%0x7fffffff,1,0x7fffffff);
    let run=c.newRun({seed,name:String(options.name||'逃生梯旅人').trim().slice(0,24)||'逃生梯旅人',charIdx:0});
    let step=p.enable(run,job,sex);if(!step.ok)return {ok:false,message:step.message};run=step.run;
    step=h.enable(run);if(!step.ok)return {ok:false,message:step.message};run=step.run;
    if(floor<0){
      // The underground always starts from a finished surface journey, through the real entrance.
      run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N().newChronicle(1);
      run.chronicle.clues=N().CHAPTERS.map(ch=>ch.clueId);run.chronicle.ending=ENDINGS.includes(options.ending)?options.ending:'release';
      p.advance(run,{reward:false});
      step=c.startUnderworld(run,run.revision);if(!step.ok)return {ok:false,message:step.message||'無法開啟地下篇。'};run=step.run;
    }
    jump(run,floor,options.readStories!==false);
    // Hero level first: on the surface a hero level-up also lifts companions, so they join afterwards.
    const level=clampInt(options.level||1,1,limit.hero),XP=G().XP;
    if(level>1)h.gainXp(run,Math.max(0,XP[level-1]-(h.state(run).xp||0)));
    const companions=(Array.isArray(options.companions)?options.companions:[]).filter(m=>p.PROFESSIONS[m?.job]).slice(0,limit.members);
    if((options.companions||[]).length>limit.members)notes.push((floor<0?'地下':'地上')+'最多 '+limit.members+' 位同伴，多的已略過。');
    companions.forEach((m,i)=>{
      const lv=clampInt(m.level||1,1,limit.member),member={id:'gm:'+(i+1)+':'+m.job,profession:m.job,sex:m.sex==='female'?'female':'male',level:lv,hp:28+lv*6,cooldown:0,hurtLeft:0};
      run.party.members.push(member);run.party.joined.push(member.id);h.addMember(run,member);
    });
    for(const id of h.ids(run))h.setHp(run,id,h.maxHp(run,id));
    if(options.gear!==false)for(const id of h.ids(run)){
      const kit=bestKit(h.job(run,id),h.level(run,id),floor),worn=h.equipment(run,id);if(!worn)continue;
      for(const [slot,kind]of Object.entries(kit)){const gear=c.createGear(kind,floor,seed,'gm-'+id.replace(/[^a-z0-9]/gi,'')+'-'+slot);if(gear&&c.validateGear(gear))worn[slot]=gear;}
      if(kit.weapon&&h.GEAR[kit.weapon]?.hands===2)worn.shield=null;
    }
    // Items, clamped to what a real journey may hold.
    const items=options.items||{},bag=items.bag||{};
    if(items.coins!==undefined)run.coins=clampInt(items.coins,0,999999);
    for(const key of Object.keys(c.ITEMS))if(key!=='coin'&&bag[key]!==undefined)run.bag[key]=clampInt(bag[key],0,key==='arrow'?c.itemLimit('arrow',run):99);
    const journey=run.party.journey;if(items.scrap!==undefined)journey.scrap=clampInt(items.scrap,0,99);
    for(const key of Object.keys(M().MATERIALS))if(items.materials?.[key]!==undefined)journey.materials[key]=clampInt(items.materials[key],0,99);
    for(const key of Object.keys(p.INGREDIENTS))if(items.ingredients?.[key]!==undefined)run.party.ingredients[key]=clampInt(items.ingredients[key],0,99);
    for(const key of ['torches','wood','cloth'])if(items.light?.[key]!==undefined)run.party.light[key]=clampInt(items.light[key],0,99);
    run.hunger=100;run.hp=h.maxHp(run);h.state(run).heroHp=h.maxHp(run,'hero');
    const valid=c.validateSave(run);
    if(!valid)return {ok:false,message:'產生的旅程沒有通過存檔檢查，請換個組合再試。'};
    return {ok:true,run:valid,notes,message:'已準備'+(floor<0?'地下第 '+(-floor):'第 '+floor)+' 層的旅程。'};
  }

  // Everything at its storage limit for quick testing.
  function fullItems(){
    const c=C(),p=P(),bag={};for(const key of Object.keys(c.ITEMS))if(key!=='coin')bag[key]=key==='arrow'?3000:99;
    return {coins:9999,bag,scrap:99,materials:Object.fromEntries(Object.keys(M().MATERIALS).map(k=>[k,99])),ingredients:Object.fromEntries(Object.keys(p.INGREDIENTS).map(k=>[k,99])),light:{torches:99,wood:99,cloth:99}};
  }

  // The floor list grouped by chapter, for the picker.
  function floors(){
    const n=N(),c=C(),groups=[];
    for(const ch of n.CHAPTERS){const list=[];for(let f=ch.high;f>=ch.low;f--)list.push({floor:f,label:f+' F',name:c.floorConfig(f).name});groups.push({title:ch.title,floors:list});}
    const deep=[];for(let f=-1;f>=-50;f--)deep.push({floor:f,label:'B'+(-f),name:c.floorConfig(f).name});
    for(let i=0;i<5;i++)groups.push({title:'地下篇 · B'+(i*10+1)+'～B'+(i*10+10),floors:deep.slice(i*10,i*10+10)});
    return groups;
  }

  /* ---------------- 面板（僅瀏覽器、僅 #逃生梯） ---------------- */
  const OPTIONS='maze3d_tower_gm_options';
  const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const JOB_ORDER=['swordsman','mage','scout','chef','healer','smith','archer','robot','cleric'];
  let panel=null;
  function remembered(){try{return JSON.parse(root.localStorage.getItem(OPTIONS)||'null')||{};}catch(_){return {};}}
  function css(){
    if(root.document.getElementById('gmLadderStyle'))return;
    const style=root.document.createElement('style');style.id='gmLadderStyle';
    style.textContent=`#gmLadderBtn{position:fixed;left:50%;transform:translateX(-50%);top:max(6px,env(safe-area-inset-top));opacity:.85;z-index:100001;border:1px solid #ffd27a;background:rgba(40,26,6,.88);color:#ffe7b0;border-radius:999px;padding:6px 12px;font:600 13px/1.2 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4)}
#gmLadderPanel{position:fixed;inset:0;z-index:100002;background:rgba(8,10,18,.98);color:#f3ead8;overflow:auto;-webkit-overflow-scrolling:touch;font:14px/1.45 system-ui,sans-serif;padding:max(12px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 18px max(14px,env(safe-area-inset-left))}
#gmLadderPanel[hidden]{display:none}#gmLadderPanel h2{margin:0;font-size:18px;color:#ffd27a}#gmLadderPanel .gm-head{display:flex;gap:10px;align-items:center;justify-content:space-between;position:sticky;top:-12px;background:rgba(8,10,18,.97);padding:6px 0 8px;z-index:1}
#gmLadderPanel .gm-note{margin:2px 0 0;color:#b9b2a4;font-size:12px}#gmLadderPanel .gm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:8px}
#gmLadderPanel fieldset{border:1px solid rgba(255,210,122,.3);border-radius:10px;padding:8px 10px;margin:0;min-width:0}#gmLadderPanel legend{color:#ffd27a;font-weight:700;padding:0 4px}
#gmLadderPanel label{display:flex;align-items:center;gap:6px;margin:4px 0;flex-wrap:wrap}#gmLadderPanel select,#gmLadderPanel input[type=number],#gmLadderPanel input[type=text]{background:#161b28;color:#f3ead8;border:1px solid #4a5168;border-radius:6px;padding:4px 6px;font:inherit;min-height:30px}
#gmLadderPanel input[type=number]{width:72px}#gmLadderPanel .gm-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px}#gmLadderPanel .gm-items label{justify-content:space-between;margin:2px 0}
#gmLadderPanel .gm-member{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}#gmLadderPanel .gm-member[aria-disabled=true]{opacity:.45}
#gmLadderPanel button{font:inherit;border-radius:8px;border:1px solid #5b6480;background:#232a3c;color:#f3ead8;padding:6px 12px;min-height:34px}#gmLadderPanel .gm-go{background:#c98a1e;border-color:#ffd27a;color:#1b1204;font-weight:800}
#gmLadderPanel .gm-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#gmLadderPanel .gm-book{display:inline-flex;align-items:center;min-height:34px;padding:6px 12px;border-radius:8px;border:1px solid #ffd27a;color:#ffd27a;text-decoration:none}#gmLadderPanel .gm-status{min-height:1.4em;color:#ffb38a;margin:6px 0 0}`;
    root.document.head.appendChild(style);
  }
  function numberInput(group,key,label,max,value){return '<label><span>'+esc(label)+'</span><input type="number" min="0" max="'+max+'" step="1" data-gm-'+group+'="'+esc(key)+'" placeholder="預設" value="'+(value===undefined||value===null?'':esc(value))+'"></label>';}
  function render(){
    const c=C(),p=P(),saved=remembered(),items=saved.items||{},jobs=JOB_ORDER.filter(k=>p.PROFESSIONS[k]);
    const jobOptions=(selected,none)=>(none?'<option value="">（無）</option>':'')+jobs.map(k=>'<option value="'+k+'"'+(k===selected?' selected':'')+'>'+esc(p.PROFESSIONS[k].name)+'</option>').join('');
    const sexOptions=selected=>['male','female'].map(k=>'<option value="'+k+'"'+(k===selected?' selected':'')+'>'+(k==='male'?'男性外觀':'女性外觀')+'</option>').join('');
    const floorOptions=floors().map(g=>'<optgroup label="'+esc(g.title)+'">'+g.floors.map(f=>'<option value="'+f.floor+'"'+(f.floor===(saved.floor??99)?' selected':'')+'>'+esc(f.label+' · '+f.name)+'</option>').join('')+'</optgroup>').join('');
    const members=[0,1,2,3].map(i=>{const m=(saved.companions||[])[i]||{};return '<div class="gm-member" data-gm-member="'+i+'"><span>同伴 '+(i+1)+'</span><select data-gm-mjob="'+i+'" aria-label="同伴 '+(i+1)+' 職業">'+jobOptions(m.job||'',true)+'</select><select data-gm-msex="'+i+'" aria-label="同伴 '+(i+1)+' 外觀">'+sexOptions(m.sex||'female')+'</select><label>等級 <input type="number" min="1" max="10" step="1" data-gm-mlevel="'+i+'" value="'+esc(m.level||5)+'"></label></div>';}).join('');
    const bagItems=Object.keys(c.ITEMS).filter(k=>k!=='coin').map(k=>numberInput('bag',k,c.ITEMS[k].name,k==='arrow'?3000:99,items.bag?.[k])).join('');
    const materials=Object.entries(M().MATERIALS).map(([k,name])=>numberInput('materials',k,name,99,items.materials?.[k])).join('');
    const ingredients=Object.entries(p.INGREDIENTS).map(([k,v])=>numberInput('ingredients',k,typeof v==='string'?v:(v?.name||k),99,items.ingredients?.[k])).join('');
    const light=[['torches','火把'],['wood','木材'],['cloth','布料']].map(([k,name])=>numberInput('light',k,name,99,items.light?.[k])).join('');
    panel.innerHTML='<div class="gm-head"><div><h2>🪜 逃生梯 · GM 模式</h2><p class="gm-note">使用獨立的 GM 存檔，不會覆蓋正式劇情旅程；不送成績、不連多人。</p></div><div class="gm-actions"><button type="button" class="gm-go" data-gm-act="go">出發</button><a class="gm-book" href="docs/職業裝備圖鑑.html#逃生梯" target="_blank" rel="noopener">冒險書詳細版</a><button type="button" data-gm-act="close">關閉</button></div></div><p class="gm-status" role="status" aria-live="polite"></p>'+
      '<div class="gm-grid"><fieldset><legend>樓層</legend><label>前往 <select data-gm="floor" aria-label="前往樓層">'+floorOptions+'</select></label><label><input type="checkbox" data-gm="readStories"'+(saved.readStories===false?'':' checked')+'> 之前的故事標記為已讀</label><label>地上結局（地下篇用） <select data-gm="ending">'+ENDINGS.map(k=>'<option value="'+k+'"'+(k===(saved.ending||'release')?' selected':'')+'>'+esc((N().ENDINGS?.find?.(e=>e.id===k)?.title)||k)+'</option>').join('')+'</select></label></fieldset>'+
      '<fieldset><legend>主角</legend><label>稱呼 <input type="text" maxlength="24" data-gm="name" value="'+esc(saved.name||'逃生梯旅人')+'"></label><label>職業 <select data-gm="job">'+jobOptions(saved.job||'swordsman')+'</select></label><label>外觀 <select data-gm="sex">'+sexOptions(saved.sex||'male')+'</select></label><label>等級 <input type="number" min="1" max="15" step="1" data-gm="level" value="'+esc(saved.level||5)+'"></label><label><input type="checkbox" data-gm="gear"'+(saved.gear===false?'':' checked')+'> 依等級配好最佳裝備（機器人保留機件）</label></fieldset>'+
      '<fieldset><legend>同伴</legend>'+members+'<p class="gm-note" data-gm-limit></p></fieldset>'+
      '<fieldset><legend>銅幣與零件</legend><div class="gm-items">'+numberInput('top','coins','銅幣',999999,items.coins)+numberInput('top','scrap','金屬零件',99,items.scrap)+light+'</div><div class="gm-actions" style="margin-top:6px"><button type="button" data-gm-act="full">全部補滿</button><button type="button" data-gm-act="zero">全部清零</button><button type="button" data-gm-act="default">恢復預設</button></div></fieldset>'+
      '<fieldset><legend>補給</legend><div class="gm-items">'+bagItems+'</div><p class="gm-note">箭矢超過箭袋容量時會自動截到上限。</p></fieldset>'+
      '<fieldset><legend>鍛造素材</legend><div class="gm-items">'+materials+'</div></fieldset>'+
      '<fieldset><legend>食材</legend><div class="gm-items">'+ingredients+'</div></fieldset></div>';
    refreshLimits();
  }
  const q=selector=>panel.querySelector(selector),qa=selector=>[...panel.querySelectorAll(selector)];
  function refreshLimits(){
    const floor=Number(q('[data-gm="floor"]').value),limit=limits(floor);
    q('[data-gm="level"]').max=limit.hero;
    qa('[data-gm-member]').forEach((row,i)=>{const off=i>=limit.members;row.setAttribute('aria-disabled',String(off));row.querySelectorAll('select,input').forEach(el=>{el.disabled=off;});row.querySelector('[data-gm-mlevel]').max=limit.member;});
    q('[data-gm-limit]').textContent=(floor<0?'地下篇：主角最高 15 級、同伴最多 4 位且最高 10 級。':'地上：主角最高 10 級、同伴最多 3 位且最高 5 級。')+'超過上限的數值會自動調整。';
  }
  function readForm(){
    const value=name=>q('[data-gm="'+name+'"]'),num=el=>el.value===''?undefined:Number(el.value);
    const group=name=>Object.fromEntries(qa('[data-gm-'+name+']').filter(el=>el.value!=='').map(el=>[el.getAttribute('data-gm-'+name),Number(el.value)]));
    const top=group('top'),light=group('light');
    const companions=qa('[data-gm-member]').map((row,i)=>({job:row.querySelector('[data-gm-mjob]').value,sex:row.querySelector('[data-gm-msex]').value,level:Number(row.querySelector('[data-gm-mlevel]').value)||1,i})).filter(m=>m.job&&!qa('[data-gm-member]')[m.i].querySelector('select').disabled).map(({i,...m})=>m);
    return {floor:Number(value('floor').value),job:value('job').value,sex:value('sex').value,name:value('name').value,level:num(value('level')),gear:value('gear').checked,readStories:value('readStories').checked,ending:value('ending').value,companions,
      items:{coins:top.coins,scrap:top.scrap,bag:group('bag'),materials:group('materials'),ingredients:group('ingredients'),light}};
  }
  function fill(mode){
    const full=fullItems(),set=(group,key,v)=>{const el=q('[data-gm-'+group+'="'+key+'"]');if(el)el.value=v;};
    if(mode==='default'){qa('.gm-items input').forEach(el=>{el.value='';});return;}
    set('top','coins',mode==='full'?full.coins:0);set('top','scrap',mode==='full'?99:0);
    for(const k of Object.keys(full.bag))set('bag',k,mode==='full'?full.bag[k]:0);
    for(const g of ['materials','ingredients','light'])for(const k of Object.keys(full[g]))set(g,k,mode==='full'?99:0);
  }
  function status(text){const el=q('.gm-status');if(el)el.textContent=text;}
  function go(){
    const options=readForm();const result=build({...options,seed:Math.max(1,(Math.random()*0x7fffffff)|0)});
    if(!result.ok){status(result.message);return;}
    const playing=!!root.TowerMode?.active;
    try{root.localStorage.setItem(playing?PENDING:GM_SAVE,JSON.stringify(result.run));root.localStorage.setItem(OPTIONS,JSON.stringify(options));if(playing)root.sessionStorage.setItem(AUTOSTART,'1');}catch(_){status('瀏覽器無法寫入 GM 存檔，請檢查儲存空間。');return;}
    if(playing){root.TowerMode.leaveForReload?.();root.location.reload();return;}
    close();if(root.document.getElementById('splashScreen')?.classList.contains('active')&&typeof root.enterMainMenu==='function')root.enterMainMenu();
    root.TowerMode?.startSaved?.();
  }
  function open(){if(!panel)return;root.TowerMode?.pauseForPanel?.();render();panel.hidden=false;q('[data-gm="floor"]')?.focus();}
  function close(){if(panel)panel.hidden=true;}
  function whenReady(fn,tries=0){if(root.TowerMode?.startSaved&&root.document.getElementById('splashScreen'))fn();else if(tries<100)setTimeout(()=>whenReady(fn,tries+1),100);}
  function install(){
    if(!root.document||!active()||panel)return false;
    css();
    const button=root.document.createElement('button');button.id='gmLadderBtn';button.type='button';button.textContent='🪜 逃生梯';button.setAttribute('aria-label','開啟逃生梯 GM 面板');
    panel=root.document.createElement('section');panel.id='gmLadderPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','逃生梯 GM 模式');
    root.document.body.append(button,panel);
    button.addEventListener('click',open);
    // During story play the top centre belongs to the status bar on phones; sit beside the floor row instead.
    const place=()=>{const toggle=root.document.getElementById('towerHudToggle'),r=root.document.body.classList.contains('story-active')&&toggle?.offsetParent?toggle.getBoundingClientRect():null;
      if(r&&r.width){button.style.left=Math.round(r.right+10)+'px';button.style.top=Math.round(r.top+(r.height-button.offsetHeight)/2)+'px';button.style.transform='none';}else{button.style.left=button.style.top=button.style.transform='';}};
    place();setInterval(place,1000);root.addEventListener('resize',place);
    panel.addEventListener('click',e=>{const act=e.target.closest?.('[data-gm-act]')?.getAttribute('data-gm-act');if(act==='go')go();else if(act==='close')close();else if(act)fill(act);});
    panel.addEventListener('change',e=>{if(e.target.matches?.('[data-gm="floor"]'))refreshLimits();});
    let autostart=false;try{autostart=root.sessionStorage.getItem(AUTOSTART)==='1';root.sessionStorage.removeItem(AUTOSTART);const pending=root.localStorage.getItem(PENDING);if(pending){root.localStorage.removeItem(PENDING);if(autostart)root.localStorage.setItem(GM_SAVE,pending);}}catch(_){autostart=false;}
    whenReady(()=>{if(autostart&&root.localStorage.getItem(GM_SAVE)){if(root.document.getElementById('splashScreen')?.classList.contains('active')&&typeof root.enterMainMenu==='function')root.enterMainMenu();root.TowerMode.startSaved();}else open();});
    return true;
  }
  if(root.document&&root.addEventListener){
    // The sandbox save key is chosen when the story module loads, so switching in or out reloads the page.
    const was=active();root.addEventListener('hashchange',()=>{if(active()!==was)root.location.reload();});
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install);else install();
  }

  return Object.freeze({HASHES,GM_SAVE,PENDING,AUTOSTART,active,build,fullItems,floors,bestKit,limits,install,get enabled(){return active();}});
});
