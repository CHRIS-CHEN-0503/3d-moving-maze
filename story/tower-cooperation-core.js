/* Cooperative story skills. Pure spatial rules; costs and cooldowns commit together. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerCooperation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const R=()=>typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;
  const member=(job,skill,range=0)=>({job,skill,range});
  const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const definitions=[
    {id:'thunder_blades',name:'雷刃交響',participants:[member('swordsman','wind_slash',3.5),member('mage','thunder_wave',3.5)],formation:{kind:'close',distance:4.5,description:'兩人相距不超過 4.5 公尺，目標在兩人的近身範圍。'},effect:{attack:1.2,targets:3},cooldown:32,description:'裂風斬與雷光震盪同時命中至多三隻共同看見的近身怪物；兩招傷害各提高 20%，保留雷光的短暫暈眩。'},
    {id:'cross_hunt',name:'破綻追獵',participants:[member('scout','throw_blade',8),member('archer','piercing_arrow',9.5)],formation:{kind:'pincer',distance:6,description:'兩人相距不超過 6 公尺，分站敵人不同側，夾角至少約 70 度。'},effect:{attack:1.25,targets:1},cooldown:30,description:'飛刃先牽制、強箭再命中同一目標；兩招傷害各提高 25%，保留飛刃緩速。'},
    {id:'forged_opening',name:'鍛鋒破陣',participants:[member('smith','weak_pin',8),member('swordsman','wind_slash',3.5)],formation:{kind:'front',front:1,distance:5,description:'劍士比鍛匠更靠近敵人至少 0.6 公尺，兩人相距不超過 5 公尺。'},effect:{attack:1.15,targets:1},cooldown:32,description:'鍛匠先留下弱點，劍士隨即追斬；兩招傷害各提高 15%，後手也受原弱點標記加成。'},
    {id:'warm_radiance',name:'暖光共餐',participants:[member('chef','warm_soup'),member('healer','herbal_heal')],formation:{kind:'close',distance:4.5,description:'兩人相距不超過 4.5 公尺；近處至少兩名隊員受傷而未倒下。'},effect:{injured:2,shieldPercent:12},cooldown:48,description:'先為生命比例最低的隊友療癒，再分享濃湯；可見近處隊友獲得 12% 最大生命護盾，最長五分鐘。原治療加成照常。'},
    {id:'leaf_return',name:'葉幕歸途',participants:[member('archer','woodland_stride'),member('healer','blessing')],formation:{kind:'close',distance:4.5,description:'兩人相距不超過 4.5 公尺，互相看得見。'},effect:{shieldPercent:10},cooldown:44,description:'近處隊友獲得原林間疾步加速、10% 最大生命護盾；生命比例最低者另獲原庇護祝福。護盾最長五分鐘，不疊加堆高。'},
    {id:'starforge_guard',name:'星錘護陣',participants:[member('mage','barrier'),member('smith','reinforce')],formation:{kind:'close',distance:4.5,description:'兩人相距不超過 4.5 公尺，互相看得見。'},effect:{shieldPercent:10},cooldown:48,description:'為生命比例最低的隊友同時施放原護身結界與臨時加固，其他近處隊友也獲 10% 最大生命護盾，最長五分鐘。'},
    {id:'dawn_breach',name:'破曉穿陣',underground:true,participants:[member('swordsman','taunt',5),member('mage','thorn_growth',8),member('archer','piercing_arrow',9.5)],formation:{kind:'front',front:0,distance:6,description:'三人兩兩相距不超過 6 公尺；劍士比其他兩人更靠近敵人至少 0.6 公尺。'},effect:{attack:1.3,targets:1},cooldown:48,description:'地下限定。劍士挑釁掩護，棘蔓束縛三秒，射手跟進強箭；棘蔓與箭傷害各提高 30%。束縛不阻止怪物攻擊。'},
    {id:'forest_recovery',name:'森宴回生',underground:true,participants:[member('chef','warm_soup'),member('healer','blessing'),member('scout','smoke')],formation:{kind:'close',distance:4.5,description:'三人兩兩相距不超過 4.5 公尺，互相看得見；近處有受傷而未倒下的隊友。'},effect:{injured:1,healPercent:12,cleanse:true},cooldown:55,description:'地下限定。濃湯治療後，可見近處隊友額外恢復 12% 最大生命並解除一般緩速；生命比例最低者得庇護祝福，斥候以原煙幕干擾身旁敵人。不能復活倒地者。'},
  ].map(d=>({...d,underground:!!d.underground,preparation:d.participants.length===3?1.2:.8,iconKeys:d.participants.map(p=>p.skill),costs:{ingredients:d.participants.reduce((sum,p)=>{for(const[k,v]of Object.entries(H().SKILLS[p.skill].cost||{}))sum[k]=(sum[k]||0)+v;return sum;},{}),arrows:d.participants.reduce((sum,p)=>sum+(H().SKILLS[p.skill].ammo||0),0)}}));
  const DEFINITIONS=freeze(definitions),byId=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(DEFINITIONS.map(d=>[d.id,d])))),point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=1000&&Math.abs(p.z)<=1000;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),fail=message=>({ok:false,message});
  function line(space,a,b){if(!point(a)||!point(b)||typeof space.clear!=='function')return false;try{return space.clear(a,b)===true;}catch{return false;}}
  function evaluate(run,key,space={}){
    const h=H(),d=byId[key];if(!d||!h.enabled(run)||run.status!=='playing'||space.ready!==true)return fail('現在無法發動合作技能。');
    if(d.underground&&!C().isUnderworld(run))return fail('這項合作技在地下篇開放。');
    const positions=space.positions||{},active=h.state(run).active,origin=positions[active];if(!point(origin))return fail('先集合隊伍。');
    const candidates=d.participants.map(p=>h.ids(run).filter(id=>h.job(run,id)===p.job&&h.hp(run,id)>0&&h.actor(run,id)?.skills.includes(p.skill)&&point(positions[id])&&!space.blocked?.includes(id)&&!h.actor(run,id).pending&&!h.actor(run,id).shot&&h.actor(run,id).attack<=0&&h.actor(run,id).hurt<=0&&h.actor(run,id).cooldowns[p.skill]<=0&&distance(origin,positions[id])<=6&&line(space,origin,positions[id])&&(!h.SKILLS[p.skill].attack||h.stats(run,id).weapon)));
    if(candidates.some(ids=>!ids.length))return fail('需要靠近、能行動、技能與武器就緒且中間無牆的不同隊員。');
    if(Object.entries(d.costs.ingredients).some(([k,v])=>(run.party.ingredients[k]||0)<v)||(run.bag.arrow||0)<d.costs.arrows)return fail('合作所需的食材、材料或箭矢不足。');
    const specIds=new Set(rootSpecs(run)),monsters=(space.monsters||[]).filter(m=>m.alive!==false&&point(m)&&specIds.has(m.id)&&!run.defeatedMonsters.includes(m.id)&&line(space,origin,m));
    const combinations=candidates.reduce((sets,ids)=>sets.flatMap(list=>ids.filter(id=>!list.includes(id)).map(id=>[...list,id])),[[]]);
    for(const members of combinations){
      if(members.some((id,i)=>members.slice(i+1).some(other=>distance(positions[id],positions[other])>d.formation.distance||!line(space,positions[id],positions[other]))))continue;
      const nearby=h.ids(run).filter(id=>h.hp(run,id)>0&&point(positions[id])&&members.every(m=>distance(positions[m],positions[id])<=6&&line(space,positions[m],positions[id]))),target=nearby.slice().sort((a,b)=>h.hp(run,a)/h.maxHp(run,a)-h.hp(run,b)/h.maxHp(run,b))[0];
      if(!target||nearby.filter(id=>h.hp(run,id)<h.maxHp(run,id)).length<(d.effect.injured||0))continue;
      let targets=monsters.filter(m=>d.participants.every((p,i)=>!p.range||(distance(positions[members[i]],m)<=p.range&&line(space,positions[members[i]],m))));
      if(d.formation.kind==='front')targets=targets.filter(m=>{const front=distance(positions[members[d.formation.front]],m);return members.every((id,i)=>i===d.formation.front||distance(positions[id],m)>=front+.6);});
      if(d.formation.kind==='pincer')targets=targets.filter(m=>{const a=positions[members[0]],b=positions[members[1]],den=distance(a,m)*distance(b,m);return den>.01&&((a.x-m.x)*(b.x-m.x)+(a.z-m.z)*(b.z-m.z))/den<=.34;});
      targets=targets.sort((a,b)=>distance(origin,a)-distance(origin,b)).slice(0,d.effect.targets||3);
      if(d.effect.attack&&!targets.length)continue;
      return {ok:true,definition:d,members,target,nearby,targets:targets.map(m=>m.id),positions:Object.fromEntries(members.map(id=>[id,{x:positions[id].x,z:positions[id].z}]))};
    }
    return fail(d.effect.injured?'請集合受傷的隊友，並保持陣形。':'目前沒有符合距離、視線與陣形的怪物或隊伍。');
  }
  function rootSpecs(run){const p=typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;return p.monsterSpecs(run).map(m=>m.id);}
  function available(run,space){return DEFINITIONS.map(d=>evaluate(run,d.id,space)).filter(v=>v.ok);}
  function cast(run,key,space,revision=run.revision){return C().transaction(run,revision,n=>{
    const plan=evaluate(n,key,space);if(!plan.ok)return plan;const d=plan.definition,h=H(),casts=[];
    // Heal the weakest member before group soup so the second cast never fails
    // merely because the first group heal already topped them off.
    const order=d.participants.map((p,i)=>({p,id:plan.members[i]})).sort((a,b)=>Number(b.p.skill==='herbal_heal')-Number(a.p.skill==='herbal_heal'));
    for(const {p,id}of order){const result=h.cast(n,p.skill,{actorId:id,targetId:plan.target,nearby:plan.nearby},n.revision);if(!result.ok)return result;Object.assign(n,result.run);casts.push(result.effect);}
    n.revision=run.revision;
    for(let i=0;i<d.participants.length;i++){const p=d.participants[i],id=plan.members[i],a=h.actor(n,id);a.cooldowns[p.skill]=Math.max(a.cooldowns[p.skill],d.cooldown);if(a.pending&&d.effect.attack)a.pending.damage=Math.min(250,a.pending.damage*d.effect.attack);}
    for(const id of plan.nearby){if(d.effect.healPercent)h.heal(n,id,h.maxHp(n,id)*d.effect.healPercent/100);if(d.effect.shieldPercent)R().shield(n,id,h.maxHp(n,id)*d.effect.shieldPercent/100,id);if(d.effect.cleanse){const a=h.actor(n,id);a.buffs=a.buffs.filter(b=>b.id!=='slow');if(id===h.state(n).active)n.party.slowLeft=0;}}
    for(const cast of casts){if(cast.kind==='taunt'){cast.targets=plan.targets;for(const id of cast.targets){const e=h.state(n).enemy[id]||(h.state(n).enemy[id]={});e.tauntId=cast.actorId;e.tauntLeft=cast.power;}}if(cast.kind==='smoke'){const o=space.positions[cast.actorId],validIds=new Set(rootSpecs(n));cast.targets=(space.monsters||[]).filter(m=>m.alive!==false&&validIds.has(m.id)&&!n.defeatedMonsters.includes(m.id)&&point(m)&&distance(o,m)<=5&&line(space,o,m)).map(m=>m.id);for(const id of cast.targets){const e=h.state(n).enemy[id]||(h.state(n).enemy[id]={});e.blind=cast.power;}}}
    h.sync(n);return {ok:true,message:'合作技 · '+d.name,effect:{cooperation:key,casts,members:plan.members,nearby:plan.nearby,targets:plan.targets,cleanse:!!d.effect.cleanse}};
  });}
  return Object.freeze({DEFINITIONS,evaluate,available,cast});
});
