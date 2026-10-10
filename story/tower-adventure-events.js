/* Small, consequential choices and two-floor follow-ups; independent of main-line gates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerAdventureEvents=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const own=(o,k)=>Object.hasOwn(o,k),int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  const KINDS=Object.freeze({
    forest:{name:'被困住的幼菇',person:'米菈',copy:'一叢幼菇被枯枝壓住。可以留下生長的機會，也可以收下牠們掉落的韌絲。',choices:[{label:'扶起幼菇',description:'下一層獲得一份藥草與甜根莖。'},{label:'收下落下的韌絲',description:'現在獲得兩份韌絲，幼菇仍留在原地生長。'}],follow:'在兩層後的固定景觀旁找米菈留下的採樣筆記。',reward:'米菈送來兩份月傘菇及十二枚銅幣。'},
    workshop:{name:'轟響的舊機組',person:'洛恩',copy:'機組一直轟響，藏在其中的零件已鬆脫。關小聲可讓下一段路安靜，也可以收下零件修理裝備。',choices:[{label:'關小機組聲音',description:'下一層前六十秒，怪物察敵範圍減少30%。'},{label:'收集鬆脫零件',description:'現在獲得三份金屬零件與一份精鐵礦。'}],follow:'在兩層後的固定景觀旁查看洛恩的維護回條。',reward:'洛恩送來兩份金屬零件及十二枚銅幣。'},
    river:{name:'霧河的回程燈',person:'伊芙',copy:'一盞舊燈歪在霧河邊。扶正它可讓下一段路暫時安定，也可以採下河邊成熟的霧蓮藕。',choices:[{label:'扶正回程燈',description:'下一層暫停迷宮變化二十秒。'},{label:'採下成熟霧蓮藕',description:'現在獲得兩份霧蓮藕，回程燈仍留在岸邊。'}],follow:'在兩層後的固定景觀旁讀伊芙留下的路標。',reward:'伊芙送來一份藥草、一份花蜜及十二枚銅幣。'},
  });
  function svg(kind){
    const shape={forest:'<path fill="#ba7390" d="M8 32a24 24 0 0 1 48 0z"/><path fill="#f3d6a1" d="M24 32h16v23H24z"/><circle fill="#ffdec0" cx="23" cy="23" r="4"/><circle fill="#ffdec0" cx="39" cy="26" r="3"/><path stroke="#68975d" d="m8 45 48-9m-8 15 7-16"/>',workshop:'<path fill="#c4a46c" d="m22 7 20 0 4 9 10 5 0 22-10 5-4 9H22l-4-9-10-5V21l10-5z"/><circle fill="#446574" cx="32" cy="32" r="14"/><circle fill="#e3d294" cx="32" cy="32" r="7"/>',river:'<path stroke="#7fcbd3" d="M5 47q9-8 18 0t18 0 18 0M7 55q8-7 16 0t18 0 16 0"/><path fill="#8f7349" d="M21 12h22v28H21z"/><path fill="#ffe39b" d="M25 17h14v17H25z"/><path stroke="#d8c59a" d="M24 12V8h16v4"/>',rootCounter:'<path stroke="#87ae63" d="M11 56c18-23-8-25 12-42M34 57c22-26-12-26 15-46"/><path fill="#b8d482" d="m12 31 15-9-3 14zm21 5 17-10-4 15z"/>',crystalCounter:'<path fill="#92dce8" d="m32 5 17 23-8 27H23l-8-27z"/><path fill="#dbf5f3" d="m32 5 0 50-9 0-8-27z"/><path stroke="#e6ba6f" d="m5 33 14-8m-9-4 9 4-2 9m42-1-12-8"/>'}[kind];
    return shape?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" role="img" aria-label="'+(KINDS[kind]?.name||({rootCounter:'供能藤',crystalCounter:'轉向晶柱'}[kind]))+'" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+shape+'</svg>':'';
  }
  function hash(seed,text){let h=seed>>>0;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  const isFloor=f=>int(f,1,99)||int(f,-50,-1);
  const nextFloor=f=>f>1?f-1:f<0&&f>-50?f-1:null;
  const twoFloors=f=>{const first=nextFloor(f);return first!==null?nextFloor(first):null;};
  function offer(run){
    if(!run?.party||run.expedition?.active||!isFloor(run.floor)||[90,80,70,60,50,40,30,20,10,1,-10,-20,-30,-40,-50].includes(run.floor))return null;
    const depth=run.floor>0?99-run.floor:-run.floor-1,period=2+hash(run.seed,'event-spacing')%2;
    if(depth%period!==1)return null;
    const env=C().floorConfig(run.floor,run.seed).environmentId,kind=env==='roots'||env==='garden'?'forest':env==='clockwork'?'workshop':env==='mist'?'river':null;
    return kind?{...KINDS[kind],kind,floor:run.floor,id:'event:'+run.floor+':'+run.seed+':'+kind}:null;
  }
  function fresh(){return {version:1,current:null,pending:null,benefit:null,chain:null,history:[],lord:null};}
  function validate(value,context={}){
    if(value===undefined)return fresh();
    const v=value;if(!v||Array.isArray(v)||v.version!==1||Object.keys(v).some(k=>!['version','current','pending','benefit','chain','history','lord'].includes(k)))return null;
    const eventAt=floor=>offer({...context,floor,party:{},expedition:{active:null}});
    if(!Array.isArray(v.history)||v.history.length>149||new Set(v.history).size!==v.history.length||!v.history.every(s=>{const m=typeof s==='string'&&s.match(/^event:(-?\d{1,2}):(\d{1,10}):(forest|workshop|river)$/);return m&&Number(m[1])>=context.floor&&Number(m[2])===context.seed&&eventAt(Number(m[1]))?.id===s;}))return null;
    const fields=(p,allowed)=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).every(k=>allowed.includes(k));
    const validIdentity=p=>p&&own(KINDS,p.kind)&&isFloor(p.floor)&&eventAt(p.floor)?.id===p.id;
    let current=null,pending=null,benefit=null,chain=null,lord=null;
    if(v.current!==null){const p=v.current;if(!fields(p,['id','floor','kind','choice'])||!validIdentity(p)||p.floor!==context.floor||![null,0,1].includes(p.choice)||(p.choice!==null)!==v.history.includes(p.id))return null;current={id:p.id,floor:p.floor,kind:p.kind,choice:p.choice};}
    if(v.pending!==null){const p=v.pending;if(!fields(p,['id','floor','kind','targetFloor','choice'])||!validIdentity(p)||nextFloor(p.floor)!==p.targetFloor||p.choice!==0||!v.history.includes(p.id)||p.floor!==context.floor||current?.id!==p.id||current.choice!==0)return null;pending={id:p.id,floor:p.floor,kind:p.kind,targetFloor:p.targetFloor,choice:0};}
    if(v.benefit!==null){const p=v.benefit;if(!fields(p,['floor','kind','left'])||p.floor!==context.floor||p.kind!=='quiet'||!Number.isFinite(p.left)||p.left<0||p.left>60)return null;benefit={floor:p.floor,kind:'quiet',left:p.left};}
    if(v.chain!==null){const p=v.chain;if(!fields(p,['id','floor','kind','targetFloor','status'])||!validIdentity(p)||twoFloors(p.floor)!==p.targetFloor||!['active','ready','claimed','abandoned'].includes(p.status)||!v.history.includes(p.id)||p.floor<context.floor||['ready','claimed'].includes(p.status)&&context.floor>p.targetFloor||p.status==='active'&&context.floor<p.targetFloor)return null;chain={id:p.id,floor:p.floor,kind:p.kind,targetFloor:p.targetFloor,status:p.status};}
    if(v.lord!==null){const p=v.lord;if(!fields(p,['floor','phase','broken','armed'])||p.floor!==context.floor||![80,60].includes(p.floor)||!['idle','guarded','exposed'].includes(p.phase)||!Array.isArray(p.broken)||p.broken.length!==(p.floor===80?2:1)||!p.broken.every(b=>typeof b==='boolean')||p.phase==='idle'&&p.broken.some(Boolean)||p.phase==='exposed'&&!p.broken.every(Boolean)||p.phase==='guarded'&&p.broken.every(Boolean)||!Number.isFinite(p.armed??0)||(p.armed??0)<0||(p.armed??0)>8)return null;lord={floor:p.floor,phase:p.phase,broken:[...p.broken],armed:p.armed??0};}
    return {version:1,current,pending,benefit,chain,history:[...v.history],lord};
  }
  function ensure(run){
    const state=validate(run.adventure?.events,{floor:run.floor,seed:run.seed});if(!state)return null;
    if(!run.adventure)return null;run.adventure.events=state;
    const event=offer(run);if(event&&!state.current)state.current={id:event.id,floor:event.floor,kind:event.kind,choice:state.history.includes(event.id)?1:null};
    if([80,60].includes(run.floor)&&run.party&&!run.expedition?.active&&!state.lord)state.lord={floor:run.floor,phase:'idle',broken:Array(run.floor===80?2:1).fill(false),armed:0};
    return state;
  }
  const addIngredient=(run,key,n)=>{run.party.ingredients[key]=Math.min(99,(run.party.ingredients[key]||0)+n);};
  const addMaterial=(run,key,n)=>{run.party.journey.materials[key]=Math.min(99,(run.party.journey.materials[key]||0)+n);};
  function choose(run,id,choice,revision=run.revision){return C().transaction(run,revision,n=>{
    const state=ensure(n),event=offer(n);if(!state||!event||event.id!==id||![0,1].includes(choice)||state.current.choice!==null||state.history.includes(id))return {ok:false,message:'這次選擇已完成，或不在當前樓層。'};
    state.current.choice=choice;state.history.push(id);
    if(choice===0&&nextFloor(n.floor)!==null)state.pending={id,floor:n.floor,kind:event.kind,targetFloor:nextFloor(n.floor),choice};
    else if(event.kind==='forest')addMaterial(n,'toughfiber',2);
    else if(event.kind==='workshop'){n.party.journey.scrap=Math.min(99,n.party.journey.scrap+3);addMaterial(n,'ironore',1);}
    else addIngredient(n,'lotus',2);
    // One readable follow-up at a time, no compulsory quest chain or friendship grind.
    if(twoFloors(n.floor)!==null&&(!state.chain||['claimed','abandoned'].includes(state.chain.status)))state.chain={id,floor:n.floor,kind:event.kind,targetFloor:twoFloors(n.floor),status:'active'};
    return {ok:true,message:event.choices[choice].label+'。'+event.choices[choice].description,effect:{adventureChoice:id,choice}};
  });}
  function advance(run,previousFloor){
    if(!run.adventure)return null;const state=run.adventure.events;if(!state)return ensure(run);
    if(previousFloor===run.floor)return ensure(run);
    state.current=null;state.benefit=null;state.lord=null;
    if(state.pending){const p=state.pending;if(p.targetFloor===run.floor&&run.party){if(p.kind==='forest'){addIngredient(run,'herb',1);addIngredient(run,'root',1);}else if(p.kind==='workshop')state.benefit={floor:run.floor,kind:'quiet',left:60};else run.effects.freeze=Math.max(run.effects.freeze,20);}state.pending=null;}
    if(state.chain?.status==='active'&&run.floor<state.chain.targetFloor)state.chain.status='abandoned';
    return ensure(run);
  }
  function inspect(run,revision=run.revision){return C().transaction(run,revision,n=>{const s=ensure(n),q=s?.chain;if(!q||q.status!=='active'||q.targetFloor!==n.floor||n.expedition?.active)return {ok:false,message:'這一層沒有等待查看的後續留言。'};q.status='ready';return {ok:true,message:'找到'+KINDS[q.kind].person+'的回條，可在任務頁領取答謝。',effect:{chainReady:true}};});}
  function settle(run,abandon=false,revision=run.revision){return C().transaction(run,revision,n=>{const s=ensure(n),q=s?.chain;if(!q||!['active','ready'].includes(q.status)||!abandon&&q.status!=='ready')return {ok:false,message:'目前沒有可處理的後續委託。'};q.status=abandon?'abandoned':'claimed';if(abandon)return {ok:true,message:'已放下這次後續委託，主線仍可繼續。'};n.coins=Math.min(999999,n.coins+12);if(q.kind==='forest')addIngredient(n,'mushroom',2);else if(q.kind==='workshop')n.party.journey.scrap=Math.min(99,n.party.journey.scrap+2);else{addIngredient(n,'herb',1);addIngredient(n,'nectar',1);}return {ok:true,message:KINDS[q.kind].reward,effect:{chainClaimed:q.id}};});}
  function brief(run){const q=run.adventure?.events?.chain;if(!q||['claimed','abandoned'].includes(q.status))return null;return {name:KINDS[q.kind].person+'的後續留言',copy:KINDS[q.kind].follow,next:q.status==='ready'?'回條已找到，點「領取答謝」。':'前往'+(q.targetFloor<0?'地下 B'+(-q.targetFloor):q.targetFloor+' 層')+'，靠近固定景觀查看留言。',...q};}
  // Version one stored historical identities, not historical alternatives.
  // Read back only what remains provable; never turn an absent choice into 1.
  function recollections(run){
    if(!run||!isFloor(run.floor)||!int(run.seed,1,0xffffffff)||run.adventure?.events===undefined)return [];
    const state=validate(run.adventure.events,{floor:run.floor,seed:run.seed});if(!state)return [];
    const floorName=f=>f<0?'地下 '+(-f)+' 層':'第 '+f+' 層';
    return state.history.slice(-6).reverse().map(id=>{
      const [,rawFloor,,kind]=id.split(':'),floor=Number(rawFloor),event=KINDS[kind];
      const choice=state.current?.id===id?state.current.choice:state.pending?.id===id?state.pending.choice:null;
      const q=state.chain?.id===id?state.chain:null;
      let status='已經歷',next='這段旅程已留下事件紀錄。';
      if(q){
        status={active:'後續待查',ready:'回條已找到',claimed:'答謝已領取',abandoned:'已放下後續'}[q.status];
        next=q.status==='active'?'在'+floorName(q.targetFloor)+'的固定景觀旁查看'+event.person+'的留言。':q.status==='ready'?'回條已找到，可在任務頁領取答謝。':q.status==='claimed'?event.reward:'這次後續已放下；主線仍可繼續。';
      }
      const known=choice===0||choice===1;
      const consequence=known?event.choices[choice].description:'當時的選項未保存在舊事件紀錄裡，不能由結果反推。';
      return {id,floor,kind,title:event.name,choice,choiceLabel:known?event.choices[choice].label:'已經歷；選項未保存',consequence,next,status};
    });
  }
  function tick(run,dt){if(!Number.isFinite(dt)||dt<0)return;const b=run.adventure?.events?.benefit,l=run.adventure?.events?.lord;if(b?.left>0)b.left=Math.max(0,b.left-dt);if(l?.armed>0)l.armed=Math.max(0,l.armed-dt);}
  function senseScale(run){return run.adventure?.events?.benefit?.left>0?.7:1;}
  function lordState(run){return ensure(run)?.lord;}
  // One source for every place that explains the half-health shield: the HUD line,
  // the repeated hit hint, the dome colour and the help entry.
  function guardNotice(run){const b=lordState(run);if(!b||b.phase!=='guarded')return null;
    if(b.floor===80){const done=b.broken.filter(Boolean).length,left=b.broken.length-done;return {objective:'園后根盾 · 供能藤 '+done+'/'+b.broken.length+' · 靠近小地圖「藤」斬斷',hint:'根盾擋下了攻擊！先斬斷園后身旁的供能藤（小地圖「藤」，還剩 '+left+' 根），再進攻。',help:'樓主護罩說明',color:0x78a768};}
    return {objective:'伯爵晶罩 · '+(b.armed>0?'晶柱已轉向，躲到它後面引晶光擊中':'轉動晶柱，引晶光擊中晶柱'),hint:'晶罩擋下了攻擊！'+(b.armed>0?'躲到晶柱後面，讓伯爵的晶光打中晶柱。':'先靠近晶柱轉向，再引晶光擊中它。'),help:'樓主護罩說明',color:0x89d6e1};}
  function limitLordDamage(run,id,damage,maxHp){
    if(![80,60].includes(run.floor)||id!=='monster-11'||!run.party||run.expedition?.active)return damage;
    const state=lordState(run);if(!state)return damage;const hp=run.party.health[id]??maxHp;
    if(state.phase==='guarded')return 0;
    if(state.phase==='idle'&&hp-damage<=maxHp*.5){state.phase='guarded';return Math.max(0,hp-maxHp*.5);}
    return damage;
  }
  function counter(run,index,revision=run.revision){return C().transaction(run,revision,n=>{const b=lordState(n);if(!b||b.phase!=='guarded'||!int(index,0,b.broken.length-1)||b.broken[index]||b.floor===60&&b.armed<=0)return {ok:false,message:'這處供能已停止，或還沒有完成場景反制。'};b.broken[index]=true;if(b.broken.every(Boolean)){b.phase='exposed';b.armed=0;}return {ok:true,message:b.phase==='exposed'?'樓主的護罩消退了，趁現在進攻！': '供能藤已斬斷，再找另一根。',effect:{lordExposed:b.phase==='exposed'}};});}
  function armCounter(run,revision=run.revision){return C().transaction(run,revision,n=>{const b=lordState(n);if(!b||b.floor!==60||b.phase!=='guarded')return {ok:false,message:'晶柱暫時不需要轉向。'};b.armed=8;return {ok:true,message:'晶柱已轉向，躲到後面引晶光擊中它！'};});}
  return Object.freeze({KINDS,svg,fresh,validate,offer,ensure,choose,advance,inspect,settle,brief,recollections,tick,senseScale,lordState,guardNotice,limitLordDamage,counter,armCounter,nextFloor});
});
