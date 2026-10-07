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
    {id:'dawn_breach',name:'破曉穿陣',underground:true,participants:[member('swordsman','taunt',5),member('mage','thorn_growth',8),member('archer','piercing_arrow',9.5)],formation:{kind:'front',front:0,distance:6,description:'三人兩兩相距不超過 6 公尺；劍士比其他兩人更靠近敵人至少 0.6 公尺。'},effect:{attack:1.3,targets:1},cooldown:48,description:'地下限定。劍士挑釁近處敵人，技能一～二級一隻、三～四級兩隻、五～六級三隻；棘蔓與強箭仍集中同一目標，傷害各提高 30%。棘蔓束縛三秒，但不阻止怪物攻擊。'},
    {id:'forest_recovery',name:'森宴回生',underground:true,participants:[member('chef','warm_soup'),member('healer','blessing'),member('scout','smoke')],formation:{kind:'close',distance:4.5,description:'三人兩兩相距不超過 4.5 公尺，互相看得見；近處有受傷而未倒下的隊友。'},effect:{injured:1,healPercent:R().HEALING.forestRecoveryPercent,cleanse:true},cooldown:55,description:'地下限定。濃湯治療後，可見近處隊友額外恢復 18% 最大生命並解除一般緩速；生命比例最低者得庇護祝福，遊俠以原煙幕干擾身旁敵人。不能復活倒地者。'},
    {id:'thunder_fist',name:'雷核飛拳',participants:[member('robot','flying_fist',6),member('mage','thunder_wave',3.5)],formation:{kind:'close',distance:4.5,description:'兩人相距不超過 4.5 公尺；同一隻敵人距機器人不超過 6 公尺、距術士不超過 3.5 公尺，兩人都看得見。'},effect:{attack:1.25,targets:1},cooldown:34,description:'重擊飛拳攜雷光一起轟擊同一隻敵人，兩招傷害各提高 25%；保留飛拳擊退與雷光短暫暈眩，樓層主不會被擊退。不穿牆、不額外消耗動力石。'},
    {id:'steel_oath',name:'鋼甲同盟',participants:[member('robot','folded_guard'),member('swordsman','guard_stance')],formation:{kind:'close',distance:4.5,description:'兩人相距不超過 4.5 公尺，互相看得見。'},effect:{shieldPercent:15},cooldown:42,description:'機器人啟動原摺甲防禦六秒、劍士進入原守護架勢八秒；近處可見隊友同時獲得 15% 最大生命護盾，最長五分鐘，不相加堆高。機器人防禦期間仍移動減半。'},
    {id:'core_reconstruction',name:'星核再造',underground:true,participants:[member('robot','parts_restore'),member('smith','repair'),member('healer','blessing')],formation:{kind:'close',distance:4.5,description:'三人兩兩相距不超過 4.5 公尺，互相看得見；參與的機器人受傷、未倒下，且至少一件機殼或拳臂受損但未破損。'},effect:{targetMember:0,mechanicalHealPercent:12,shieldPercent:15},cooldown:55,description:'地下限定。零件回補先恢復機器人生命，鍛匠以原應急修補維護其最受損的一件非核心機件，療癒師施加庇護祝福。機器人額外機械修復 12% 最大生命，近處隊友獲 15% 最大生命護盾、最長五分鐘；不以一般治療修機器人，不復活、不重建破損機件或修復核心。'},
  ].map(d=>({...d,underground:!!d.underground,preparation:d.participants.length===3?.9:.5,iconKeys:d.participants.map(p=>p.skill),costs:{ingredients:d.participants.reduce((sum,p)=>{for(const[k,v]of Object.entries(H().SKILLS[p.skill].cost||{}))sum[k]=(sum[k]||0)+v;return sum;},{}),arrows:d.participants.reduce((sum,p)=>sum+(H().SKILLS[p.skill].ammo||0),0),scrap:d.participants.reduce((sum,p)=>sum+(H().SKILLS[p.skill].scrapCost||0)+(H().SKILLS[p.skill].effect==='fortress'?2:0),0)}}));
  const DEFINITIONS=freeze(definitions),byId=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(DEFINITIONS.map(d=>[d.id,d])))),point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=1000&&Math.abs(p.z)<=1000;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),fail=message=>({ok:false,message});
  function line(space,a,b){if(!point(a)||!point(b)||typeof space.clear!=='function')return false;try{return space.clear(a,b)===true;}catch{return false;}}
  // One evaluate/available/hints call shares its monster id set and the unobstructed-line answers
  // (keyed by the two point objects), instead of recomputing them for each of the eleven definitions.
  function share(run){let specIds=null;const seen=new Map();return {specIds:()=>specIds||(specIds=new Set(rootSpecs(run))),line(space,a,b){if(!point(a)||!point(b)||typeof space.clear!=='function')return false;let row=seen.get(a);if(!row)seen.set(a,row=new Map());if(!row.has(b)){let ok=false;try{ok=space.clear(a,b)===true;}catch{}row.set(b,ok);}return row.get(b);}};}
  const repairable=(run,id)=>Object.values(H().equipment(run,id)||{}).some(g=>g&&!H().ROBOT.isCore(g)&&g.durability>0&&g.durability<g.maxDurability);
  function validTarget(run,d,id,nearby,members){const h=H();return d.participants.every((p,i)=>{const kind=h.SKILLS[p.skill].effect;if(kind==='heal')return h.organicHealable(run,id)&&h.hp(run,id)<h.maxHp(run,id);if(kind==='repair')return repairable(run,id);if(kind==='polish')return !!h.stats(run,id).weapon;if(kind==='robot_restore')return h.hp(run,members[i])<h.maxHp(run,members[i]);if(kind==='soup'||kind==='sanctuary')return nearby.some(other=>h.organicHealable(run,other)&&h.hp(run,other)<h.maxHp(run,other));return true;});}
  const evaluate=(run,key,space={})=>evaluateWith(run,key,space,share(run));
  function evaluateWith(run,key,space,shared){
    const look=(a,b)=>shared.line(space,a,b),h=H(),d=byId[key];if(!d||!h.enabled(run)||run.status!=='playing'||space.ready!==true)return fail('現在無法發動合作技能。');
    if(d.underground&&!C().isUnderworld(run))return fail('這項合作技在地下篇開放。');
    const positions=space.positions||{},active=h.state(run).active,origin=positions[active];if(!point(origin))return fail('先集合隊伍。');
    const candidates=d.participants.map(p=>h.ids(run).filter(id=>h.job(run,id)===p.job&&h.hp(run,id)>0&&(p.job!=='robot'||h.ROBOT.powered(run,id))&&h.actor(run,id)?.skills.includes(p.skill)&&point(positions[id])&&!space.blocked?.includes(id)&&!h.actor(run,id).pending&&!h.actor(run,id).shot&&h.actor(run,id).attack<=0&&h.actor(run,id).hurt<=0&&h.actor(run,id).cooldowns[p.skill]<=0&&distance(origin,positions[id])<=6&&look(origin,positions[id])&&(!h.SKILLS[p.skill].attack||h.stats(run,id).weapon)));
    if(candidates.some(ids=>!ids.length))return fail('需要靠近、能行動、技能與武器就緒且中間無牆的不同隊員。');
    if(Object.entries(d.costs.ingredients).some(([k,v])=>(run.party.ingredients[k]||0)<v)||(run.bag.arrow||0)<d.costs.arrows||(run.party.journey.scrap||0)<d.costs.scrap)return fail('合作所需的食材、零件或箭矢不足。');
    const specIds=shared.specIds(),monsters=(space.monsters||[]).filter(m=>m.alive!==false&&point(m)&&specIds.has(m.id)&&!run.defeatedMonsters.includes(m.id)&&look(origin,m));
    const combinations=candidates.reduce((sets,ids)=>sets.flatMap(list=>ids.filter(id=>!list.includes(id)).map(id=>[...list,id])),[[]]);
    for(const members of combinations){
      if(members.some((id,i)=>members.slice(i+1).some(other=>distance(positions[id],positions[other])>d.formation.distance||!look(positions[id],positions[other]))))continue;
      const nearby=h.ids(run).filter(id=>h.hp(run,id)>0&&point(positions[id])&&members.every(m=>distance(positions[m],positions[id])<=6&&look(positions[m],positions[id]))),choices=d.effect.targetMember!==undefined?[members[d.effect.targetMember]]:nearby,target=choices.filter(id=>nearby.includes(id)&&validTarget(run,d,id,nearby,members)).sort((a,b)=>h.hp(run,a)/h.maxHp(run,a)-h.hp(run,b)/h.maxHp(run,b))[0];
      if(!target||nearby.filter(id=>h.hp(run,id)<h.maxHp(run,id)).length<(d.effect.injured||0))continue;
      let targets=monsters.filter(m=>d.participants.every((p,i)=>!p.range||(distance(positions[members[i]],m)<=p.range&&look(positions[members[i]],m))));
      if(d.formation.kind==='front')targets=targets.filter(m=>{const front=distance(positions[members[d.formation.front]],m);return members.every((id,i)=>i===d.formation.front||distance(positions[id],m)>=front+.6);});
      if(d.formation.kind==='pincer')targets=targets.filter(m=>{const a=positions[members[0]],b=positions[members[1]],den=distance(a,m)*distance(b,m);return den>.01&&((a.x-m.x)*(b.x-m.x)+(a.z-m.z)*(b.z-m.z))/den<=.34;});
      targets=targets.sort((a,b)=>distance(origin,a)-distance(origin,b)).slice(0,d.effect.targets||3);
      if(d.effect.attack&&!targets.length)continue;
      return {ok:true,definition:d,members,target,nearby,targets:targets.map(m=>m.id),positions:Object.fromEntries(members.map(id=>[id,{x:positions[id].x,z:positions[id].z}]))};
    }
    return fail(d.effect.injured?'請集合受傷的隊友，並保持陣形。':'目前沒有符合距離、視線與陣形的怪物或隊伍。');
  }
  function rootSpecs(run){const p=typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;return p.monsterSpecs(run).map(m=>m.id);}
  function available(run,space){const shared=share(run);return DEFINITIONS.map(d=>evaluateWith(run,d.id,space,shared)).filter(v=>v.ok);}
  function hints(run,space){
    const h=H();if(!h.enabled(run)||run.status!=='playing'||space.ready!==true||typeof space.clear!=='function')return [];
    const positions=space.positions||{},active=h.state(run).active,all=h.ids(run).filter(id=>h.hp(run,id)>0&&point(positions[id]));if(!all.includes(active))return [];
    const affixes=typeof module==='object'&&module.exports?require('./tower-affixes.js'):globalThis.TowerAffixes,shared=share(run);
    return DEFINITIONS.flatMap(d=>{
      if(d.underground&&!C().isUnderworld(run))return [];
      const result=evaluateWith(run,d.id,space,shared);if(result.ok)return [];
      if(Object.entries(d.costs.ingredients).some(([k,v])=>(run.party.ingredients[k]||0)<v)||(run.bag.arrow||0)<d.costs.arrows||(run.party.journey.scrap||0)<d.costs.scrap)return [];
      // Regrouping can fix geometry, not missing skills, resources or readiness.
      // Keep the same non-spatial requirements as evaluate, including alternates.
      const candidates=d.participants.map(p=>all.filter(id=>{
        const a=h.actor(run,id);return h.job(run,id)===p.job&&a?.skills.includes(p.skill)&&(p.job!=='robot'||h.ROBOT.powered(run,id))&&!space.blocked?.includes(id)&&!affixes?.attackBlocked(run,id)&&!a.pending&&!a.shot&&a.attack<=0&&a.hurt<=0&&a.cooldowns[p.skill]<=0&&(!h.SKILLS[p.skill].attack||h.stats(run,id).weapon);
      }));
      if(candidates.some(ids=>!ids.length)||all.filter(id=>h.hp(run,id)<h.maxHp(run,id)).length<(d.effect.injured||0))return [];
      if(d.effect.attack){const known=shared.specIds();if(!(space.monsters||[]).some(m=>m.alive!==false&&point(m)&&known.has(m.id)&&!run.defeatedMonsters.includes(m.id)))return [];}
      const combinations=candidates.reduce((sets,ids)=>sets.flatMap(list=>ids.filter(id=>!list.includes(id)).map(id=>[...list,id])),[[]]);
      const members=combinations.find(members=>{
        const targets=d.effect.targetMember!==undefined?[members[d.effect.targetMember]]:all;
        return targets.some(id=>validTarget(run,d,id,all,members));
      });
      return members?[{definition:d,members,message:result.message}]:[];
    });
  }
  function cast(run,key,space,revision=run.revision){return C().transaction(run,revision,n=>{
    const plan=evaluate(n,key,space);if(!plan.ok)return plan;const d=plan.definition,h=H(),casts=[];
    // Heal the weakest member before group soup so the second cast never fails
    // merely because the first group heal already topped them off.
    const order=d.participants.map((p,i)=>({p,id:plan.members[i]})).sort((a,b)=>Number(b.p.skill==='herbal_heal')-Number(a.p.skill==='herbal_heal'));
    for(const {p,id}of order){const result=h.cast(n,p.skill,{actorId:id,targetId:plan.target,nearby:plan.nearby},n.revision);if(!result.ok)return result;Object.assign(n,result.run);casts.push(result.effect);}
    n.revision=run.revision;
    for(let i=0;i<d.participants.length;i++){const p=d.participants[i],id=plan.members[i],a=h.actor(n,id);a.cooldowns[p.skill]=Math.max(a.cooldowns[p.skill],d.cooldown);if(a.pending&&d.effect.attack)a.pending.damage=Math.min(250,a.pending.damage*d.effect.attack);}
    if(d.effect.mechanicalHealPercent)h.heal(n,plan.target,h.maxHp(n,plan.target)*d.effect.mechanicalHealPercent/100,{mechanical:true});
    for(const id of plan.nearby){if(d.effect.healPercent)h.heal(n,id,h.maxHp(n,id)*d.effect.healPercent/100);if(d.effect.shieldPercent)R().shield(n,id,h.maxHp(n,id)*d.effect.shieldPercent/100,id);if(d.effect.cleanse){const a=h.actor(n,id);a.buffs=a.buffs.filter(b=>b.id!=='slow');const affixes=typeof module==='object'&&module.exports?require('./tower-affixes.js'):globalThis.TowerAffixes;affixes?.clear(n,id);if(id===h.state(n).active)n.party.slowLeft=0;}}
    for(const cast of casts){if(cast.kind==='taunt')cast.targets=h.applyTaunt(n,cast.actorId,{monsters:space.monsters,origin:space.positions[cast.actorId],clear:(a,b)=>line(space,a,b),seconds:cast.power});if(cast.kind==='smoke'){const o=space.positions[cast.actorId],validIds=new Set(rootSpecs(n));cast.targets=(space.monsters||[]).filter(m=>m.alive!==false&&validIds.has(m.id)&&!n.defeatedMonsters.includes(m.id)&&point(m)&&distance(o,m)<=5&&line(space,o,m)).map(m=>m.id);for(const id of cast.targets){const e=h.state(n).enemy[id]||(h.state(n).enemy[id]={});e.blind=cast.power;}}}
    h.sync(n);return {ok:true,message:'合作技 · '+d.name,effect:{cooperation:key,casts,members:plan.members,nearby:plan.nearby,targets:plan.targets,cleanse:!!d.effect.cleanse}};
  });}
  return Object.freeze({DEFINITIONS,evaluate,available,hints,cast});
});
