/* 逃生梯詳細版的設計數值速查：只讀遊戲模組的常數與公式，不讀存檔、不碰頁面。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StoryAtlasGm=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const mod=(file,name)=>node?require('../story/'+file):globalThis[name];
  const G=()=>mod('tower-hero-growth.js','TowerHeroGrowth'),H=()=>mod('tower-heroes-core.js','TowerHeroes'),B=()=>mod('tower-floor-lords.js','TowerFloorLords'),M=()=>mod('tower-materials.js','TowerMaterials'),D=()=>mod('tower-dungeons.js','TowerDungeons');
  const floorName=f=>f>0?f+' F':'B'+(-f);
  const range=(high,low)=>floorName(high)+'～'+floorName(low);
  const fixed=(n,d=2)=>Number(n).toFixed(d);

  function levels(){
    const xp=G().XP;
    return {id:'levels',title:'等級與累計經驗',intro:'主角在地上最高 10 級，地下最高 15 級；同伴地上 5 級、地下 10 級。',
      columns:['等級','累計經驗','升到此級需要'],rows:xp.map((total,i)=>[String(i+1),String(total),i?String(total-xp[i-1]):'—'])};
  }
  function life(){
    const p=mod('tower-party-core.js','TowerPartyCore'),h=H(),jobs=Object.entries(p.VITALITY).sort((a,b)=>b[1]-a[1]);
    return {id:'life',title:'生命上限',intro:'主角 60＋每級 3、同伴 40＋每級 5，再乘職業體質；機器人的「機體強化」被動另加，最多 30。',
      columns:['職業','體質','主角 1／10／15 級','同伴 1／5／10 級'],rows:jobs.map(([job,v])=>[h.JOBS[job].name,'× '+v.toFixed(2).replace(/0$/,''),[1,10,15].map(l=>p.vitalHp(job,l,true)).join('／'),[1,5,10].map(l=>p.vitalHp(job,l,false)).join('／')])};
  }
  function mana(){
    const h=H(),jobs=Object.entries(h.SPIRIT).filter(([job])=>job!=='robot').sort((a,b)=>b[1]-a[1]);
    return {id:'mana',title:'MP 上限與技能消耗',intro:'MP 上限＝（40＋每級 5）× 職業精神；每秒回復 1.2＋上限的 1.5%。每招消耗 4＋原冷卻的一半（一般最多 30、覺醒與進階最多 45）；冷卻已減為原本的一半。機器人沒有 MP。',
      columns:['職業','精神','1／10／15 級上限','最貴的一般招式'],rows:jobs.map(([job,v])=>{const own=Object.values(h.SKILLS).filter(s=>s.job===job&&!s.unique).sort((a,b)=>b.mp-a.mp)[0];return [h.JOBS[job].name,'× '+v,[1,10,15].map(l=>h.mpMax(job,l)).join('／'),own?own.name+' '+own.mp:'—'];})};
  }
  function attributes(){
    const h=H(),p=mod('tower-party-core.js','TowerPartyCore'),names=h.ATTRIBUTE_NAMES,list=k=>h.ATTRIBUTES.map(a=>k[a]||0).join('／'),step=h.ATTRIBUTE_STEP,pct=n=>Math.round(n*1000)/10+'%';
    return {id:'attributes',title:'能力值與爆擊',intro:'能力值＝職業基礎＋每級自動 '+h.AUTO_POINTS_PER_LEVEL+' 點＋每級自由 '+h.FREE_POINTS_PER_LEVEL+' 點；自由點數每項最多 '+p.ATTRIBUTE_CAP+' 點，只有自由點數改變數值。順序：'+h.ATTRIBUTES.map(a=>names[a]).join('／')+'。',
      columns:['職業','1 級基礎','每級自動','自動配點順序','基礎爆擊率'],rows:Object.keys(h.JOBS).map(job=>[h.JOBS[job].name,list(h.ATTRIBUTE_BASE[job]),Object.entries(h.ATTRIBUTE_GROWTH[job]).map(([a,v])=>names[a]+' +'+v).join('、'),h.ATTRIBUTE_PLAN[job].map(a=>names[a]).join('→'),(h.CRIT_BASE[job]??h.CRIT_DEFAULT)+'%']),
      notes:['每 1 點自由點數：力量 物理攻擊 +'+pct(step.str)+'；智力 魔法攻擊 +'+pct(step.int)+'、MP 上限 +'+pct(step.intMp)+'、治療 +'+pct(step.intHeal)+'；體質 HP 上限 +'+pct(step.vit)+'；敏捷 攻擊間隔 −'+pct(step.agi)+'（0.35 秒下限不變）；幸運 爆擊率 +'+step.luk+' 個百分點。','爆擊造成 '+h.CRIT_MULTIPLIER+' 倍傷害，判定取自該次攻擊本身，讀檔不重擲。機器人不能分配智力。遺忘藥水退回全部自由點數，第 30 層之後的樓主 60% 掉落。']};
  }
  function killXp(){
    const h=H(),b=B(),depth=h.SURFACE_XP_DEPTH,floors=[99,90,80,70,60,50,40,30,20,10,1];
    return {id:'kill-xp',title:'擊殺經驗公式',
      intro:'基礎 = 5 ＋ 強度 × 2；小樓主另加 '+b.MINI_XP.surface+'（地上）／'+b.MINI_XP.underworld+'（地下）；地上章末樓主另加 '+b.LORD_XP+'。地上再乘 1 ＋（99 − 樓層）÷ '+depth+'，地下一律 × 5；討伐裂隙內再 × '+h.HUNT_XP+'，且不給銅幣與掉落。',
      columns:['樓層','經驗倍率'],rows:floors.map(f=>[floorName(f),'× '+fixed(1+(99-f)/depth)]).concat([['地下各層','× 5.00']]),
      notes:['以每層打倒小樓主與章末樓主、一般怪依比例計算（v1.60.0 門檻）：清八成五約第 90 層 2 級、第 80 層 3 級、第 56 層 5 級、第 20 層 8 級、第 8 層 9 級，地下第 3 層前後 10 級；全清約地下第 1 層，清六成約地下第 9 層。地下清八成五約 B39 達到 15 級，全清約 B34，清六成到 B50 仍為 14 級。','同伴從加入起各自累積與主角相同的經驗（地上最高 5 級、地下 10 級），不再跟著主角的等級跳升。']};
  }
  function lords(){
    const b=B(),all=b.allLords();
    const rows=Object.values(all).sort((x,y)=>y.floor-x.floor).map(d=>{const spec=b.spec({floor:d.floor,party:{}});
      return [floorName(d.floor),d.name,String(spec.maxHp),String(d.damage),String(d.strength),d.ranged?'遠程':'近戰',d.tactics?.counter||''];});
    return {id:'lords',title:'章末樓主',intro:'生命為基礎值。擊敗地上章末樓主另得 '+b.LORD_XP+' 點經驗（再乘地上倍率）；地下樓主不另加。',
      columns:['樓層','名稱','生命','傷害','強度','攻擊','應對'],rows};
  }
  function minis(){
    const b=B(),m=M();
    const rows=m.ECOLOGIES.map(e=>[e.name,range(e.high,e.low),(b.MINI_LORDS[e.id]||[]).map(x=>x.name+'（'+(e.variants[x.kind]?.name||x.kind)+'）').join('、')]);
    return {id:'minis',title:'小樓主名冊',
      intro:'沒有章末樓主的樓層各一隻，從該區兩位中依旅程種子與樓層決定，同區不同樓層會重複出現。強度比同族高一級、生命 × '+b.MINI_HP+'、傷害 × '+b.MINI_DAMAGE+'（不超過該章樓主傷害減一）；必定留下一瓶初級療癒藥，不擋樓梯。',
      columns:['區域','樓層','小樓主（造型來源）'],rows};
  }
  function hunts(){
    const d=D(),kinds=Object.entries(d.HUNT_KINDS),tiers=[1,2,3,4,5];
    const floorsOf=tier=>{const list=[];for(let f=98;f>=1;f--)if(d.huntTier(f)===tier)list.push(f);return tier===5?range(list[0],list.at(-1))+'、地下':range(list[0],list.at(-1));};
    const rows=tiers.map(t=>{const shapes=kinds.map(([k])=>d.huntShape(k,t)),first=shapes[0];
      return [String(t),floorsOf(t),...shapes.map(s=>s.count+' 隻 · '+s.timeLimit+' 秒 · '+s.reward.coins+' 幣'),String(first.reward.items.heal)];});
    return {id:'hunts',title:'討伐裂隙',
      intro:'第 99 層與章末樓主樓層以外，每層依旅程種子 '+d.HUNT_CHANCE+'% 出現，種類三選一：'+kinds.map(([,k])=>k.title.replace('討伐裂隙・','')+'（'+k.objective.replace(/。$/,'')+'）').join('；')+'。完成另給療癒藥與乾糧 1；離開、逾時或倒下沒有獎勵，每層一次。',
      columns:['深度','樓層',...kinds.map(([,k])=>k.title.replace('討伐裂隙・','')),'療癒藥'],rows};
  }
  function sections(){return [levels(),life(),mana(),attributes(),killXp(),lords(),minis(),hunts()];}
  return Object.freeze({sections});
});
