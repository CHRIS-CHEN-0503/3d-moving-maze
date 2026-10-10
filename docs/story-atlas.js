/* One read-only atlas. No game loop, player saves, network or account access. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Player edition by default; "#逃生梯" opens the detailed edition (set before paint by the page head).
  const gmHash=()=>{try{return decodeURIComponent(location.hash.slice(1))==='逃生梯';}catch{return false;}};
  const gm=document.documentElement.dataset.edition==='gm';
  // Players do not need clauses about old-save migration, internal code or probability breakdowns; the detailed edition keeps them.
  const DEV_CLAUSE=/舊存檔|旧存檔|舊旅程|舊版|遷移|程式|退役|／[^；。]*機率為/;
  const playerText=text=>{if(gm||typeof text!=='string')return text;const parts=text.split(/(?<=[；。])/),kept=parts.filter(part=>!DEV_CLAUSE.test(part));return kept.length===parts.length?text:kept.join('').replace(/；$/,'。');};
  const forPlayer=r=>gm?r:{...r,description:playerText(r.description)||r.description,notes:(r.notes||[]).map(playerText).filter(Boolean),details:(r.details||[]).map(d=>({...d,value:playerText(d.value)}))};
  try{
    const R=StoryAtlasRules.build(),itemRecords=StoryAtlasItems.records();
    function spriteIcon(r){if(r.icon?.provider!=='pickup')return '';const p=PickupObjects,f=p.frames[r.icon.key],s=p.sheets[p.sheetFor[r.icon.key]];return f&&s?'<svg class="pickup-sprite" viewBox="'+f.join(' ')+'" aria-hidden="true"><image width="'+s.width+'" height="'+s.height+'" href="../'+esc(s.src)+'"/></svg>':'';}
    // Hidden dishes stay a discovery: the player edition lists only what research has to find, the detailed edition shows them all.
    const items=itemRecords.filter(r=>gm||!r.hidden).map(r=>({...r,itemCategory:r.category,category:r.recipe?'cooking':'items',jobs:r.jobs||[],iconHtml:StoryAtlasItems.iconHtml(r)||spriteIcon(r),tags:[r.category,...(r.drop?[r.drop.label]:[])],details:[{label:'效果與使用方式',value:r.effect},{label:'取得方式',value:r.acquisition},...(r.capacityRule?[{label:'箭袋容量',value:r.capacityRule}]:r.stackLimit?[{label:'持有上限',value:r.stackLimit+' 份'}]:[])],notes:r.notes||[],underground:r.gateFloor<0||!!r.requiredDepth||!!r.recipe?.requiredDepth||!!r.underground}));
    const cooperation=StoryAtlasCooperation.records();const entries=[...R.entries,...items,...cooperation].map(r=>forPlayer({...r,notes:r.notes||[],underground:!!(r.underground||r.ascension||r.tier>3),anchor:'entry-'+r.category+'-'+r.id}));
    if(entries.some(r=>!r.iconHtml))throw Error('圖示缺漏：'+entries.filter(r=>!r.iconHtml).map(r=>r.id).join('、'));
    const categories={all:'全部',jobs:'職業',skills:'技能',weapons:'武器',armor:'防具',items:'道具與材料',cooking:'烹飪',forging:'鍛造',cooperation:'連攜'};
    const titles={all:'完整圖鑑',jobs:'職業總覽',skills:'技能全書',weapons:'武器圖鑑',armor:'防具與盾牌',items:'補給、材料與探索物資',cooking:'營地料理與地下食譜',forging:'鍛匠工藝',cooperation:'隊伍合作連攜'};
    let category='jobs',expanded=false,current=[];
    $('stats').innerHTML=[[R.jobs.length,'種職業'],[R.skills.length,'種技能'],[R.gear.length,'件裝備'],[items.length,'種物資與本領'],[cooperation.length,'招連攜']].map(([n,t])=>'<span><b>'+n+'</b>'+t+'</span>').join('');
    $('job').insertAdjacentHTML('beforeend',R.jobs.map(j=>'<option value="'+esc(j.id)+'">'+esc(j.name)+'</option>').join(''));
    function subtypes(){const previous=$('kind').value,options=category==='skills'?[['active','主動技能'],['passive','被動技能'],['ordinary','普通技能'],['awakening','十級覺醒'],['advanced','地下進階']]:['weapons','armor'].includes(category)?[1,2,3,4,5].map(n=>['tier'+n,'第 '+n+' 階']):category==='items'?[...new Set(items.filter(i=>i.category==='items').map(i=>i.itemCategory))].map(s=>[s,s]):[];
      $('kind').innerHTML='<option value="">全部類型</option>'+options.map(([id,n])=>'<option value="'+esc(id)+'">'+esc(n)+'</option>').join('');$('kind').value=options.some(([id])=>id===previous)?previous:'';$('kind').disabled=!options.length;}
    function subtype(r,value){if(!value)return true;if(value==='active'||value==='passive')return r.skillType===value;if(value==='ordinary')return !r.unique;if(value==='awakening')return r.unique&&!r.ascension;if(value==='advanced')return !!r.ascension;if(value.startsWith('tier'))return r.tier===Number(value.slice(4));return r.itemCategory===value;}
    function card(r){
      const label=r.category==='skills'?(r.skillType==='active'?'主動':'被動')+' · '+TowerHeroes.JOBS[r.job].name:categories[r.category];
      const table=r.levels?.length?'<table class="rank-table"><caption>'+esc(r.levels[0].label)+' · '+(r.category==='forging'?'鍛造等級':'技能等級（非人物等級）')+'</caption><thead><tr>'+r.levels.map(l=>'<th scope="col">'+l.level+'級</th>').join('')+'</tr></thead><tbody><tr>'+r.levels.map(l=>'<td>'+esc(l.value)+esc(l.unit)+'</td>').join('')+'</tr></tbody></table>':'';
      const related=r.category==='jobs'?'<button type="button" data-job-skills="'+esc(r.id)+'">查看本職業技能</button>':'';
      return '<article class="entry" id="'+esc(r.anchor)+'" data-category="'+r.category+'"><div class="entry-head"><div class="art" aria-hidden="true">'+r.iconHtml+'</div><div><small>'+esc(label)+'</small><h3>'+esc(r.name)+'</h3></div></div><div class="tags">'+(r.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+(r.underground?'<span class="tag under">地下限定</span>':'')+'</div><p>'+esc(r.description)+'</p><details'+(expanded?' open':'')+'><summary>效果、數值與取得方式</summary>'+table+'<dl class="facts">'+(r.details||[]).filter(d=>d.value!==undefined&&d.value!=='').map(d=>'<div><dt>'+esc(d.label)+'</dt><dd>'+esc(d.value)+'</dd></div>').join('')+'</dl>'+r.notes.map(n=>'<p class="entry-note">'+esc(n)+'</p>').join('')+related+'<p><a class="entry-link" href="#'+encodeURIComponent(r.anchor)+'" aria-label="'+esc(r.name)+'的固定連結">連到這一項</a></p></details></article>';
    }
    function saveFilters(){const u=new URL(location.href);u.search='';for(const[k,v]of [['category',category],['q',$('search').value],['job',$('job').value],['scope',$('scope').value],['kind',$('kind').value]])if(v)u.searchParams.set(k,v);try{history.replaceState(null,'',u);}catch{/* file preview may not allow history changes */}}
    function render(){const q=$('search').value.trim().toLocaleLowerCase(),job=$('job').value,scope=$('scope').value,kind=$('kind').value;
      current=entries.filter(r=>(category==='all'||r.category===category)&&(!job||!r.jobs?.length||r.jobs.includes(job))&&(!scope||r.underground===(scope==='underground'))&&subtype(r,kind)&&(!q||[r.name,r.description,...(r.tags||[]),...(r.notes||[]),...(r.details||[]).map(d=>d.value)].join(' ').toLocaleLowerCase().includes(q)));
      $('categories').innerHTML=Object.entries(categories).map(([id,name])=>'<button type="button" data-category="'+id+'" aria-pressed="'+(category===id)+'">'+name+'<small>'+ (id==='all'?entries.length:entries.filter(r=>r.category===id).length)+'</small></button>').join('');
      $('sectionTitle').textContent=titles[category];$('resultCount').textContent='顯示 '+current.length+'／'+entries.length+' 項'+(q?' · 搜尋「'+$('search').value.trim()+'」':'')+' · 點開卡片查看完整資料';
      $('content').innerHTML=current.length?current.map(card).join(''):'<div class="no-results"><h3>沒有符合的內容</h3><p>試試較短的關鍵字，或重設職業與解鎖範圍。</p><button type="button" data-clear>清除篩選</button></div>';
      $('expand').setAttribute('aria-pressed',String(expanded));$('expand').textContent=expanded?'全部收合':'全部展開';saveFilters();
    }
    function clear(){for(const id of ['search','job','scope','kind'])$(id).value='';category='all';expanded=false;subtypes();render();}
    $('categories').addEventListener('click',e=>{const b=e.target.closest('button[data-category]');if(!b)return;category=b.dataset.category;subtypes();render();});
    $('search').addEventListener('input',()=>{if($('search').value.trim()&&category!=='all'){category='all';subtypes();}render();});
    for(const id of ['job','scope','kind'])$(id).addEventListener('change',render);
    $('reset').addEventListener('click',clear);
    $('expand').addEventListener('click',()=>{expanded=!expanded;for(const d of $('content').querySelectorAll('details'))d.open=expanded;$('expand').setAttribute('aria-pressed',String(expanded));$('expand').textContent=expanded?'全部收合':'全部展開';});
    $('content').addEventListener('click',e=>{if(e.target.closest('[data-clear]'))clear();const b=e.target.closest('[data-job-skills]');if(b){category='skills';$('search').value='';$('scope').value='';$('job').value=b.dataset.jobSkills;subtypes();render();$('results').scrollIntoView({block:'start'});}});
    let printed=[];addEventListener('beforeprint',()=>{printed=[...document.querySelectorAll('details')].map(d=>[d,d.open]);for(const[d]of printed)d.open=true;});addEventListener('afterprint',()=>{for(const[d,open]of printed)d.open=open;printed=[];});$('print').addEventListener('click',()=>window.print());
    function deepLink(){let anchor;try{anchor=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!anchor.startsWith('entry-'))return;const entry=entries.find(r=>r.anchor===anchor);if(!entry)return;if(!$(anchor)){category=entry.category;for(const id of ['search','job','scope','kind'])$(id).value='';subtypes();render();}const target=$(anchor);target.querySelector('details').open=true;requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
    const params=new URLSearchParams(location.search);if(Object.hasOwn(categories,params.get('category')))category=params.get('category');$('search').value=params.get('q')||'';for(const id of ['job','scope'])$(id).value=params.get(id)||'';subtypes();$('kind').value=params.get('kind')||'';render();deepLink();addEventListener('hashchange',deepLink);addEventListener('hashchange',()=>{if(!gm&&gmHash())location.reload();});
    if(gm)$('gmTables').innerHTML=StoryAtlasGm.sections().map(t=>'<section class="gm-section" id="gm-'+esc(t.id)+'"><h3>'+esc(t.title)+'</h3><p>'+esc(t.intro)+'</p><div class="gm-scroll"><table class="gm-table"><thead><tr>'+t.columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map(row=>'<tr>'+row.map((v,i)=>i?'<td>'+esc(v)+'</td>':'<th scope="row">'+esc(v)+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>'+(t.notes||[]).map(n=>'<p class="entry-note">'+esc(n)+'</p>').join('')+'</section>').join('');
    const topLink=document.querySelector('.back-top'),topState=()=>{topLink.hidden=scrollY<400;};topState();addEventListener('scroll',topState,{passive:true});
    document.documentElement.dataset.atlasReady='true';
  }catch(error){$('loadError').hidden=false;$('loadError').textContent+=' '+error.message;$('resultCount').textContent='載入未完成';console.error(error);}
})();
