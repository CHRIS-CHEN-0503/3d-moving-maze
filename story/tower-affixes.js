/* Material attunement and bounded combat ailments. Shared game/atlas catalogue. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerAffixes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const E=()=>typeof module==='object'&&module.exports?require('./tower-encounters.js'):globalThis.TowerEncounters;
  const EFFECTS=Object.freeze({
    burn:Object.freeze({name:'灼傷',color:'#ffa765',material:'embercore',duration:6,power:2,description:'每兩秒受到灼燒傷害，持續六秒。',path:'M12 3c1 5 5 6 5 11a5 5 0 0 1-10 0c0-3 2-5 3-7 0 3 1 4 2 4 2-2 1-5 0-8Z'}),
    poison:Object.freeze({name:'中毒',color:'#b3e889',material:'toughfiber',duration:8,power:2,description:'每兩秒受到毒傷，持續八秒。',path:'M9 3h6m-5 0v6l-5 9q-1 3 2 3h10q3 0 2-3l-5-9V3M8 15h8m-5 3h2'}),
    slow:Object.freeze({name:'緩速',color:'#a9defb',material:'crystalshard',duration:5,power:.3,description:'移動速度降低30%，持續五秒。',path:'M12 3v18M4 7l16 10M4 17 20 7M9 5l3 3 3-3M9 19l3-3 3 3'}),
    curse:Object.freeze({name:'衰弱詛咒',color:'#d8adf7',material:'starore',duration:6,power:.2,underground:true,description:'攻擊與接受治療效果降低20%，持續六秒。',path:'M4 12q8-12 16 0-8 12-16 0Zm8-4v8M3 3l18 18'}),
    shock:Object.freeze({name:'電麻',color:'#ffea91',material:'ironore',duration:.8,power:1,description:'短暫電麻0.8秒，暫停移動與出手；樓層主只受短暫緩速。',path:'m14 2-9 12h6l-1 8 9-13h-6Z'}),
    root:Object.freeze({name:'束縛',color:'#8bdab6',material:'abyssalloy',duration:2,power:1,underground:true,description:'藤根束縛移動兩秒，仍可攻击；樓層主只受短暫緩速。',path:'M12 21V3M12 10Q3 4 3 12q0 5 9 4m0-9q9-6 9 2 0 5-9 6'}),
  });
  const finite=(n,a,b,int=false)=>Number.isFinite(n)&&n>=a&&n<=b&&(!int||Number.isInteger(n));
  const own=(o,k)=>Object.hasOwn(o,k),copy=v=>JSON.parse(JSON.stringify(v));
  function svg(id){const e=EFFECTS[id];return e?'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+e.path+'"/></svg>':'';}
  function validateGear(g){if(g.affix===undefined&&g.affixRoll===undefined)return {};if(g.slot==='core'||/^robot_/.test(g.kind)||!['weapon','armor','helmet','shield'].includes(g.slot))return null;const attempts=g.affixRoll??0;if(!finite(attempts,0,100000,true))return null;if(g.affix===undefined)return {affixRoll:attempts};const a=g.affix;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['id','power'].includes(k))||!own(EFFECTS,a.id)||!finite(a.power,1,3,true))return null;return {affix:{id:a.id,power:a.power},affixRoll:attempts};}
  const fresh=()=>({version:1,actors:{},enemies:{}});
  function validate(v,{actors=[],floor}={}){if(v===undefined)return undefined;if(!v||v.version!==1||Object.keys(v).some(k=>!['version','actors','enemies'].includes(k)))return null;const result=fresh();for(const side of ['actors','enemies']){const map=v[side];if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>(side==='actors'?5:C().MAX_MONSTERS))return null;for(const[id,list]of Object.entries(map)){if(side==='actors'?!actors.includes(id):!C().validMonsterId(id,floor))return null;if(!Array.isArray(list)||list.length>6||new Set(list.map(s=>s?.id)).size!==list.length)return null;result[side][id]=[];for(const s of list){if(!s||!own(EFFECTS,s.id)||Object.keys(s).some(k=>!['id','left','power','clock','owner'].includes(k))||!finite(s.left,0,EFFECTS[s.id].duration)||!finite(s.power,0,EFFECTS[s.id].power*(['burn','poison'].includes(s.id)?3:1))||!finite(s.clock,0,2)||!(s.owner===null||actors.includes(s.owner)))return null;result[side][id].push({...s});}}}return result;}
  const state=run=>run.party?.loadouts?.afflictions;
  const list=(run,id,enemy=false)=>(state(run)?.[enemy?'enemies':'actors'][id]||[]).filter(s=>s.left>0);
  const has=(run,id,key,enemy=false)=>list(run,id,enemy).find(s=>s.id===key)||null;
  function mutable(run){return run.party.loadouts.afflictions||(run.party.loadouts.afflictions=fresh());}
  function clear(run,id){if(state(run))delete state(run).actors[id];}
  function resist(run,id,key){const h=H(),e=h.equipment(run,id)||{},ward=Math.max(0,...Object.values(e).filter(g=>g?.durability>0&&g.slot!=='weapon'&&g.affix?.id===key).map(g=>.35+.05*(g.affix.power-1))),body=['slow','shock','root'].includes(key)?h.ROBOT.controlResistance?.(run,id)||0:0;return Math.min(.65,ward+body+h.pv(run,'purity',id)/100);}
  function apply(run,target,key,{enemy=false,owner=null,power=1,lord=false,cell}={}){const h=H(),def=EFFECTS[key];if(!def||!h.enabled(run)||(!enemy&&h.hp(run,target)<=0))return false;
    if(!enemy){const ward=h.buff(run,'ward',target),meal=h.buff(run,'meal_'+key,target);if(ward?.power>0||meal?.power>0){const b=meal?.power>0?meal:ward;b.power=0;b.left=0;return false;}}
    if(lord&&['shock','root'].includes(key))key='slow';const d=EFFECTS[key],resistance=enemy?0:resist(run,target,key),duration=Math.round(d.duration*(1-resistance)*(lord?.5:1)*1000)/1000,amount=d.power*(['burn','poison'].includes(key)?power:1)*(1-resistance);
    const map=mutable(run)[enemy?'enemies':'actors'],old=(map[target]||[]).find(s=>s.id===key),entry={id:key,left:Math.max(old?.left||0,duration),power:Math.max(old?.power||0,amount),clock:old?.clock??0,owner};map[target]=[...(map[target]||[]).filter(s=>s.id!==key),entry];return true;
  }
  function offense(run,id,enemy=false){return 1-(has(run,id,'curse',enemy)?.power||0);}
  function movement(run,id,enemy=false){if(has(run,id,'root',enemy)||has(run,id,'shock',enemy))return 0;return 1-(has(run,id,'slow',enemy)?.power||0);}
  function attackBlocked(run,id,enemy=false){return !!has(run,id,'shock',enemy);}
  function enemyHit(run,id,spec){if(!spec)return false;const k=String(spec.kind||'');let key=/mushroom|slime|fung|spider|moth/.test(k)?'poison':/wisp|specter|shadow|ghost/.test(k)?'curse':/crystal|shard|golem/.test(k)?'shock':/vine|root|flower|garden/.test(k)?'root':/hound|wolf|drake|fire/.test(k)&&/燼|火|爐/.test(spec.def?.name||'')?'burn':null;if(spec.lord)key=/garden/.test(spec.lordId||k)?'root':/crystal/.test(spec.lordId||k)?'shock':key;if(!key||H().roll(run,id,'monster-status:'+spec.id)>=(spec.lord?35:25))return false;return apply(run,id,key);}
  function attunement(gear){return gear?.durability>0&&gear.affix?{weaponId:gear.id,id:gear.affix.id,power:gear.affix.power}:null;}
  function validAttunement(value){return value===undefined||value===null||!!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&Object.keys(value).every(k=>['weaponId','id','power'].includes(k))&&typeof value.weaponId==='string'&&value.weaponId.length>0&&value.weaponId.length<=160&&own(EFFECTS,value.id)&&finite(value.power,1,3,true));}
  function weaponHit(run,id,spec,source){const imprint=source===undefined?attunement(H().equipment(run,id)?.weapon):source;if(!imprint||!validAttunement(imprint)||!spec||run.defeatedMonsters.includes(spec.id)||H().roll(run,id,'affix:'+imprint.weaponId+':'+spec.id)>=25)return false;return apply(run,spec.id,imprint.id,{enemy:true,owner:id,power:imprint.power,lord:!!spec.lord});}
  function tick(run,dt){
    if(!state(run)||!Number.isFinite(dt)||dt<=0)return;
    const h=H();
    for(const side of ['actors','enemies'])for(const[id,statuses]of Object.entries(state(run)[side])){
      const enemy=side==='enemies',down=()=>enemy?run.defeatedMonsters.includes(id):h.hp(run,id)<=0;
      if(down()){delete state(run)[side][id];continue;}
      for(const s of statuses){
        // A prior simultaneous ailment may already have killed this target.
        // Do not recreate its deleted health entry or award the same kill twice.
        if(down()||!state(run)[side][id])break;
        const step=Math.min(dt,s.left);
        if(['burn','poison'].includes(s.id)){
          const total=s.clock+step,ticks=Math.floor((total+1e-9)/2);s.clock=Math.max(0,total-ticks*2);
          if(ticks){
            const damage=Math.max(1,Math.round(s.power))*ticks;
            if(enemy){
              const spec=P().monsterSpecs(run).find(m=>m.id===id);
              if(spec){const before=run.party.health[id]??spec.maxHp,events=typeof module==='object'&&module.exports?require('./tower-adventure-events.js'):globalThis.TowerAdventureEvents,actual=events?.limitLordDamage?.(run,id,damage,spec.maxHp)??damage;run.party.health[id]=Math.max(0,before-actual);if(run.party.health[id]===0)h.finishMonster(run,spec);}
            }else h.hurt(run,id,damage,'status');
          }
        }
        s.left=Math.max(0,s.left-dt);
        if(down()){delete state(run)[side][id];break;}
      }
      if(state(run)[side][id]){state(run)[side][id]=statuses.filter(s=>s.left>0);if(!state(run)[side][id].length)delete state(run)[side][id];}
    }
  }
  function quote(run,gearId,key,service){const h=H(),g=h.allGear(run).find(g=>g.id===gearId),d=EFFECTS[key];if(!g||!d||!h.enabled(run)||g.slot==='core'||/^robot_/.test(g.kind))return null;const merchant=service?.kind==='merchant',access=merchant?E().serviceAvailable(run,service,g):(service===undefined||service?.kind==='camp')&&P().has(run,'smith'),coins=Math.ceil((10+4*(h.GEAR[g.kind]?.tier||1))*(merchant?1.2:1)),count=2,chance=Math.min(85,65+(h.GEAR[g.kind]?.tier||1)*3);const reason=!access?'需要隊內鍛匠或可承作這件裝備的商人。':g.durability===0?'先修復裝備，再進行材料附魔。':d.underground&&run.floor>0?'這種附魔只在地下城開放。':(g.affixRoll||0)>=100000?'這件裝備已達附魔次數上限。':'';return {gearId,key,name:d.name,material:d.material,count,coins,chance,allowed:!reason,reason,affordable:run.coins>=coins&&(run.party.journey.materials[d.material]||0)>=count,description:g.slot==='weapon'?'命中時25%機率附加'+d.name+'。':'受到'+d.name+'時，持續時間與效果減少35%。'};}
  function forge(run,gearId,key,revision=run.revision,service){return C().transaction(run,revision,n=>{const q=quote(n,gearId,key,service);if(!q?.allowed)return {ok:false,message:q?.reason||'無效的附魔選項。'};if(!q.affordable)return {ok:false,message:'材料或銅幣不足，尚未扣款。'};const g=H().allGear(n).find(g=>g.id===gearId);n.coins-=q.coins;n.party.journey.materials[q.material]-=q.count;g.affixRoll=(g.affixRoll||0)+1;let hash=n.seed>>>0;for(const ch of g.id+':'+key+':'+g.affixRoll)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;const success=hash%100<q.chance;if(success)g.affix={id:key,power:1};return {ok:true,message:success?'附魔成功：'+q.name+'！':'附魔未成功，原有附魔仍保留。',effect:{affix:success,key,gearId}};});}
  return Object.freeze({EFFECTS,svg,validateGear,fresh,validate,state,list,has,clear,resist,apply,offense,movement,attackBlocked,enemyHit,attunement,validAttunement,weaponHit,tick,quote,forge});
});
