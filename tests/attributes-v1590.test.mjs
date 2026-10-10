import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),L=require('../story/tower-loot.js'),E=require('../story/tower-encounters.js'),GM=require('../story/tower-gm.js');
const T=require('../lib/three.min.js'),A=require('../assets/combat-audio.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const build=(floor,job,level,companions=[],seed=4)=>GM.build({floor,job,level,seed,companions:companions.map(j=>({job:j,level:Math.min(level,floor<0?10:5)}))}).run;
const valid=run=>{const saved=C.validateSave(JSON.stringify(run));assert.ok(saved,'save remains valid');return saved;};
const ok=result=>{assert.ok(result.ok,result.message);return result.run;};
const spend=(run,id,key,times=1)=>{for(let i=0;i<times;i++)run=ok(H.allocate(run,id,key,run.revision));return run;};

test('five ability scores: every job starts at 25 and grows 3 automatic points a level, plus 2 free points; robots have no intellect',()=>{
  assert.deepEqual([...H.ATTRIBUTES],['str','int','vit','agi','luk']);assert.deepEqual(Object.values(H.ATTRIBUTE_NAMES),['力量','智力','體質','敏捷','幸運']);
  assert.equal(H.FREE_POINTS_PER_LEVEL,2);assert.equal(H.AUTO_POINTS_PER_LEVEL,3);assert.equal(P.ATTRIBUTE_CAP,10);
  for(const job of Object.keys(H.JOBS)){
    assert.equal(Object.values(H.ATTRIBUTE_BASE[job]).reduce((a,b)=>a+b,0),25,job);assert.equal(Object.values(H.ATTRIBUTE_GROWTH[job]).reduce((a,b)=>a+b,0),H.AUTO_POINTS_PER_LEVEL,job);
    assert.equal(H.attributeAllowed(job,'int'),job!=='robot');assert.ok(H.ATTRIBUTE_PLAN[job].every(k=>H.attributeAllowed(job,k)),job+' plan uses only usable scores');
  }
  assert.equal(H.ATTRIBUTE_BASE.robot.int,0);assert.equal(H.freePoints(1),0);assert.equal(H.freePoints(10),18);assert.equal(H.freePoints(15),28);
  const sheet=H.attributeSheet(build(60,'swordsman',6),'hero');assert.equal(sheet.points,10);assert.equal(sheet.unspent,10);
  assert.deepEqual(sheet.scores.map(s=>[s.key,s.natural,s.free]),[['str',17,0],['int',2,0],['vit',12,0],['agi',5,0],['luk',4,0]],'base plus five levels of strength +2, constitution +1');
});

test('an unspent journey keeps every number of the old balance; each free point adds exactly its step',()=>{
  let run=build(50,'mage',8);const base={hp:H.maxHp(run,'hero'),mp:H.maxMp(run,'hero'),st:H.stats(run,'hero'),crit:H.critChance(run,'hero')};
  assert.equal(base.hp,P.vitalHp('mage',8,true));assert.equal(base.mp,Math.round((40+5*8)*H.SPIRIT.mage));assert.equal(base.crit,H.CRIT_DEFAULT);
  run=spend(run,'hero','int',10);let st=H.stats(run,'hero');
  assert.ok(Math.abs(st.spellDamage/base.st.spellDamage-1.15)<1e-9,'intellect +1.5% spell attack per point');assert.equal(st.damage,base.st.damage);
  assert.equal(H.maxMp(run,'hero'),Math.round((40+5*8)*H.SPIRIT.mage*1.2),'+2% MP per point');assert.ok(Math.abs(st.heal-base.st.heal-.1)<1e-9,'+1% healing per point');
  run=spend(run,'hero','vit',4);assert.equal(H.maxHp(run,'hero'),P.vitalHp('mage',8,true,4));assert.equal(P.vitalHp('mage',8,true,4),Math.round((60+7*3)*P.VITALITY.mage*1.08),'+2% life per constitution point');
  let sword=build(50,'swordsman',9);const before=H.stats(sword,'hero');sword=spend(sword,'hero','str',10);sword=spend(sword,'hero','agi',4);sword=spend(sword,'hero','luk',2);const after=H.stats(sword,'hero');
  assert.ok(Math.abs(after.damage/before.damage-1.15)<1e-9,'strength +1.5% physical attack per point');assert.ok(Math.abs(after.interval/before.interval-.96)<1e-9,'agility shortens the swing 1% per point');
  assert.equal(H.critChance(sword,'hero'),H.CRIT_DEFAULT+2);assert.equal(H.critChance(build(50,'scout',3),'hero'),8);assert.equal(H.critChance(build(50,'archer',3),'hero'),6);assert.equal(H.critChance(build(50,'robot',3),'hero'),3);
  valid(sword);
});

test('spending is bounded: points from levels only, ten per score, no intellect for robots, and life rises with constitution',()=>{
  let run=build(50,'swordsman',6);assert.equal(H.allocate(run,'hero','str',run.revision).ok,true);
  run=spend(run,'hero','vit',1);const before=H.hp(run,'hero');H.setHp(run,'hero',before-20);const hurt=H.hp(run,'hero'),max=H.maxHp(run,'hero');
  run=spend(run,'hero','vit',1);assert.equal(H.hp(run,'hero')-hurt,H.maxHp(run,'hero')-max,'the wound is kept; current life rises by the added ceiling');
  run=spend(run,'hero','str',8);assert.equal(H.unspentPoints(run,'hero'),0);const none=H.allocate(run,'hero','luk',run.revision);assert.equal(none.ok,false);assert.match(none.message,/沒有可分配的自由點數/);
  let deep=build(-30,'swordsman',15);deep=spend(deep,'hero','str',10);const capped=H.allocate(deep,'hero','str',deep.revision);assert.equal(capped.ok,false);assert.match(capped.message,/上限 10 點/);
  const robot=build(50,'robot',6),refused=H.allocate(robot,'hero','int',robot.revision);assert.equal(refused.ok,false);assert.match(refused.message,/機器人/);
  assert.equal(H.allocate(run,'hero','charm',run.revision).ok,false);
});

test('saves reject forged ability records and accept old saves without them',()=>{
  const run=spend(build(50,'swordsman',4,['healer']),'hero','str',2),ally=run.party.members[0].id;valid(run);
  for(const corrupt of [a=>{a.str=7;},a=>{a.luk=1.5;},a=>{a.luk=-1;},a=>{a.charm=1;},a=>{delete a.agi;}]){const bad=structuredClone(run);corrupt(H.actor(bad,'hero').attrs);assert.equal(C.validateSave(JSON.stringify(bad)),null);}
  const cap=build(-30,'mage',15);H.actor(cap,'hero').attrs={str:11,int:0,vit:0,agi:0,luk:0};assert.equal(C.validateSave(JSON.stringify(cap)),null,'eleven in one score');
  const robot=build(50,'robot',6);H.actor(robot,'hero').attrs={str:0,int:1,vit:0,agi:0,luk:0};assert.equal(C.validateSave(JSON.stringify(robot)),null,'robot intellect');
  const flag=structuredClone(run);H.actor(flag,ally).attrAuto='yes';assert.equal(C.validateSave(JSON.stringify(flag)),null);
  // Life above the constitution ceiling is still refused, for the hero and for companions.
  const life=structuredClone(run);H.state(life).actors.hero.attrs.vit=0;life.party.loadouts.heroHp=999;assert.equal(C.validateSave(JSON.stringify(life)),null);
  const member=structuredClone(run);member.party.members[0].hp=H.maxHp(run,ally)+1;assert.equal(C.validateSave(JSON.stringify(member)),null);
});

test('an old save gets its points: the hero chooses, companions spend theirs at the next sync with the same life rise as a level up',()=>{
  const fresh=build(50,'swordsman',6,['healer','robot']),old=structuredClone(fresh);
  for(const a of Object.values(old.party.loadouts.actors)){delete a.attrs;delete a.attrAuto;}
  for(const m of old.party.members)m.hp=P.vitalHp(m.profession,m.level,false)-3;
  const loaded=valid(old);assert.deepEqual(H.attrs(loaded,'hero'),{str:0,int:0,vit:0,agi:0,luk:0});assert.equal(H.actor(loaded,'hero').attrAuto,false);assert.equal(H.unspentPoints(loaded,'hero'),10);
  for(const m of loaded.party.members){assert.equal(H.actor(loaded,m.id).attrAuto,true);assert.equal(H.unspentPoints(loaded,m.id),8,'nothing changes at load');assert.equal(m.hp,P.vitalHp(m.profession,m.level,false)-3);}
  H.sync(loaded);
  for(const m of loaded.party.members){assert.equal(H.unspentPoints(loaded,m.id),0);assert.equal(H.maxHp(loaded,m.id)-H.hp(loaded,m.id),3,'the wound is preserved');assert.ok(H.attr(loaded,m.id,'vit')>0);}
  assert.equal(H.attr(loaded,loaded.party.members[1].id,'int'),0,'a robot companion never spends intellect');valid(loaded);
});

test('automatic companions spend each level along their plan; the hero waits; switching automatic on spends what is left',()=>{
  let run=build(90,'mage',1,['healer']);const ally=run.party.members[0].id;
  for(let l=2;l<=5;l++){H.gainXp(run,G.XP[l-1]-H.state(run).xp);assert.equal(H.unspentPoints(run,ally),0);assert.equal(H.unspentPoints(run,'hero'),H.freePoints(l));}
  assert.deepEqual(H.attrs(run,ally),H.autoSpend({},'healer',5));assert.deepEqual(H.attrs(run,ally),{str:0,int:4,vit:2,agi:2,luk:0});
  run=ok(H.setAttributeAuto(run,'hero',true,run.revision));assert.equal(H.unspentPoints(run,'hero'),0);assert.deepEqual(H.attrs(run,'hero'),H.autoSpend({},'mage',5));
  run=ok(H.setAttributeAuto(run,ally,false,run.revision));H.gainXp(run,G.XP[5]-H.state(run).xp);assert.equal(H.unspentPoints(run,ally),0,'surface companions stop at five');
  // The plan skips a full score instead of stalling.
  const full=H.autoSpend({str:0,int:10,vit:0,agi:0,luk:0},'mage',15);assert.equal(H.ATTRIBUTES.reduce((n,k)=>n+full[k],0),28);assert.equal(full.int,10);
  assert.ok(H.ATTRIBUTES.every(k=>full[k]<=10));
});

test('the forgetting draught returns every free point, switches automatic off, keeps life and MP inside the new ceilings',()=>{
  let run=build(-12,'healer',12,['swordsman']);const ally=run.party.members[0].id;run=spend(run,'hero','vit',10);run=spend(run,'hero','int',8);run.bag.forget=2;
  const empty=build(50,'mage',4);empty.bag.forget=1;const refusedEmpty=G.use(empty,'forget','hero',false,empty.revision);assert.equal(refusedEmpty.ok,false);assert.match(refusedEmpty.message,/還沒有分配/);
  H.setHp(run,'hero',H.maxHp(run,'hero'));const used=G.use(run,'forget','hero',false,run.revision);assert.ok(used.ok,used.message);assert.match(used.message,/退回 18 點/);run=used.run;
  assert.equal(H.unspentPoints(run,'hero'),22);assert.equal(H.actor(run,'hero').attrAuto,false);assert.equal(H.hp(run,'hero'),H.maxHp(run,'hero'),'life is clipped to the lower ceiling');assert.equal(run.bag.forget,1);valid(run);
  assert.equal(H.actor(run,ally).attrAuto,true);run=ok(G.use(run,'forget',ally,false,run.revision));assert.equal(H.actor(run,ally).attrAuto,false,'the companion now waits for a manual choice');assert.equal(H.unspentPoints(run,ally),H.freePoints(H.level(run,ally)));
  assert.equal(G.use(Object.assign(structuredClone(run),{bag:{...run.bag,forget:5}}),'forget','hero',true).ok,false,'never drunk automatically');
  const legacy=C.newRun({seed:3,name:'舊旅程'});legacy.bag.forget=1;assert.equal(C.useItem(legacy,'forget').ok,false);
  assert.ok(G.itemIds.includes('forget'));assert.equal(C.ITEMS.forget.buyPrice,null);
});

test('critical hits: a fixed 1.5x per roll from the attack itself, about the job base plus one point per free luck',()=>{
  const sample=(run,count)=>{const spec=P.monsterSpecs(run).find(m=>!m.lord&&!m.elite),seen=[];for(let k=0;k<count;k++){const copy=structuredClone(run);copy.revision=k;const hit=H.strike(copy,spec.id,{},copy.revision);assert.ok(hit.ok,hit.message);seen.push(hit.effect);}return seen;};
  const plain=sample(build(90,'swordsman',6),500),crits=plain.filter(e=>e.crit),normal=plain.filter(e=>!e.crit);
  assert.ok(crits.length>=6&&crits.length<=40,'about 4%: '+crits.length);assert.equal(new Set(normal.map(e=>e.damage)).size,1);assert.equal(new Set(crits.map(e=>e.damage)).size,1);
  assert.ok(Math.abs(crits[0].damage/normal[0].damage-H.CRIT_MULTIPLIER)<.1,'1.5x: '+crits[0].damage+' vs '+normal[0].damage);
  const lucky=sample(spend(build(90,'swordsman',6),'hero','luk',10),500).filter(e=>e.crit).length;assert.ok(lucky>=45&&lucky<=100,'about 14% with ten luck: '+lucky);
  const run=build(90,'swordsman',6),spec=P.monsterSpecs(run).find(m=>!m.lord&&!m.elite),a=H.strike(structuredClone(run),spec.id,{},run.revision),b=H.strike(structuredClone(run),spec.id,{},run.revision);assert.equal(a.effect.crit,b.effect.crit,'reloading never rerolls');assert.equal(a.effect.damage,b.effect.damage);
  assert.equal(H.DAMAGE_RECORD_LIMIT,250*1.15);
});

test('chapter lords from 30F on leave a forgetting draught 60% of the time, on their own slot; no shop sells it',()=>{
  let lords=0,hits=0;
  for(let seed=1;seed<=60;seed++)for(const floor of [30,20,10,1,-10,-30,-50]){const run=build(floor,'mage',floor<0?12:8,[],seed),spec=P.monsterSpecs(run).find(m=>m.lord),drops=H.finishMonster(run,spec,{x:1,y:1}),forget=drops.filter(d=>d.key==='forget');lords++;hits+=forget.length;
    assert.ok(forget.length<=1);if(forget.length)assert.equal(forget[0].id,floor+':'+spec.id+':forget');assert.ok(drops.filter(d=>d.key!=='forget').length>=2&&drops.filter(d=>d.key!=='forget').length<=5);valid(run);}
  assert.ok(hits/lords>.5&&hits/lords<.7,'about 60%: '+hits+'/'+lords);
  for(let seed=1;seed<=40;seed++){for(const [floor,kind] of [[40,'lord'],[90,'lord'],[25,'mini'],[-15,'mini']]){const run=build(floor,'mage',floor<0?12:6,[],seed),spec=P.monsterSpecs(run).find(m=>kind==='lord'?m.lord:m.elite);if(!spec)continue;assert.ok(!H.finishMonster(run,spec,{x:1,y:1}).some(d=>d.key==='forget'),kind+' '+floor);}}
  // Forged draughts are refused: above 30F, on an ordinary monster, or more than one.
  const at40=build(40,'mage',8),lord40=P.monsterSpecs(at40).find(m=>m.lord);H.finishMonster(at40,lord40,{x:1,y:1});at40.party.loot.entries.push({id:'40:'+lord40.id+':forget',source:lord40.id,type:'item',key:'forget',rarity:'legendary',quantity:1,cx:1,cy:1});assert.equal(C.validateSave(JSON.stringify(at40)),null);
  const at20=build(20,'mage',8),plain=P.monsterSpecs(at20).find(m=>!m.lord&&!m.elite);H.finishMonster(at20,plain,{x:1,y:1});at20.party.loot.entries.push({id:'20:'+plain.id+':forget',source:plain.id,type:'item',key:'forget',rarity:'legendary',quantity:1,cx:1,cy:1});assert.equal(C.validateSave(JSON.stringify(at20)),null);
  const lord20=build(20,'mage',8,[],7),boss=P.monsterSpecs(lord20).find(m=>m.lord);H.finishMonster(lord20,boss,{x:1,y:1});lord20.party.loot.entries=lord20.party.loot.entries.filter(e=>e.key!=='forget');lord20.party.loot.entries.push({id:'20:'+boss.id+':forget',source:boss.id,type:'item',key:'forget',rarity:'legendary',quantity:2,cx:1,cy:1});assert.equal(C.validateSave(JSON.stringify(lord20)),null);
  assert.ok(!L.pool(build(20,'mage',8),{id:'monster-1',strength:1,def:{}}).some(e=>e.key==='forget'),'never an ordinary drop');
  assert.ok(!E.MERCHANTS.suHe.supplies.includes('forget'));for(let seed=1;seed<=200;seed++){const shop=E.merchantOffers(20,seed,true).find(m=>m.id==='suHe');if(shop)assert.ok(!shop.supplies.includes('forget'));}
  assert.equal(L.FORGET_FLOOR,30);assert.equal(L.FORGET_CHANCE,60);
});

const V=(()=>{const c=vm.createContext({});vm.runInContext(read('story/tower-skill-effects.js'),c);return c.TowerSkillEffects;})();
const CRITICAL={id:'critical-hit',job:'',effect:'critical',presentation:{family:'critical',colors:[0xfff8e0,0xffc53d]}};
function manager(options={}){const world=new T.Group(),flashes=[],kicks=[];const fx=V.create(T,{world:()=>world,limit:12,flash:(at,color,power,seconds)=>flashes.push({color,power,seconds}),kick:(amount,seconds)=>kicks.push({amount,seconds}),...options});return {fx,world,flashes,kicks};}
const named=(group,name)=>{const list=[];group.traverse(o=>{if(o.name===name)list.push(o);});return list;};

test('a critical hit shows as light, not text: a white-gold star, outward rays, a snapping ring and a short real flash',()=>{
  const {fx,world,flashes,kicks}=manager(),f=fx.emit(CRITICAL,{x:1,z:2},.4);
  assert.equal(f.family,'critical');assert.equal(f.total,.55);
  for(const [name,count]of [['critical-core-flash',1],['critical-star-burst',1],['critical-shock-ring',1],['critical-light-ray',6]])assert.equal(named(f.group,name).length,count,name);
  let text=0;f.group.traverse(o=>{if(o.isSprite&&o.material.map?.image?.getContext)text++;});assert.equal(text,0,'no text sprite');
  assert.deepEqual(flashes.map(l=>[l.color,l.power,l.seconds]),[[0xffc53d,4.2,.3]]);assert.deepEqual(kicks,[{amount:.05,seconds:.14}],'a small jolt');
  const star=named(f.group,'critical-star-burst')[0],ray=named(f.group,'critical-light-ray')[0],start=Math.hypot(ray.position.x,ray.position.y-1.05);
  fx.tick(.08);assert.ok(star.scale.x>1,'the star snaps open at once');fx.tick(.2);assert.ok(Math.hypot(ray.position.x,ray.position.y-1.05)>start*2,'rays fly outward');
  fx.tick(.3);assert.equal(world.children.length,0,'gone after .55 seconds');
  // The burst is drawn over the attacker's body; its floor light keeps depth, and later effects never inherit it.
  const again=manager(),burst=again.fx.emit(CRITICAL,{x:0,z:0}),depth=o=>o.material?.depthTest;let over=0,floor=0;burst.group.traverse(o=>{if(!o.material||o.isPoints)return;if(o.name==='spell-contact-light'){assert.equal(depth(o),true,'floor light');floor++;}else{assert.equal(depth(o),false,o.name);over++;}});assert.ok(over>=9&&floor===1);
  again.fx.tick(1);const later=again.fx.emit({id:'level-up',job:'',effect:'levelup',presentation:{family:'levelup',colors:[0xffd66b,0xfff3c9]}},{x:0,z:0},0);later.group.traverse(o=>{if(o.material&&!o.isPoints)assert.notEqual(depth(o),false,'pooled materials keep depth for other effects: '+o.name);});
  // A sweep that crits on a whole pack shows two bursts in one frame.
  const pack=manager();assert.ok(pack.fx.emit(CRITICAL,{x:0,z:0}));assert.ok(pack.fx.emit(CRITICAL,{x:1,z:0}));assert.equal(pack.fx.emit(CRITICAL,{x:2,z:0}),null);pack.fx.tick(.016);assert.ok(pack.fx.emit(CRITICAL,{x:2,z:0}));
  const calm=manager({reducedMotion:true}),c=calm.fx.emit(CRITICAL,{x:0,z:0});assert.equal(c.total,.4);assert.equal(named(c.group,'critical-light-ray').length,3);assert.ok(Math.abs(calm.flashes[0].power-4.2*.6)<1e-9);assert.deepEqual(calm.kicks,[]);
});

test('a sharp critical strike sound, and the runtime wiring: crit flag to the burst, the ability tab, its handlers and the level banner hint',()=>{
  assert.equal(A.ACTIONS.critical,.34);assert.ok(A.ACTIONS.critical<=.81);assert.equal(A.render('critical').length,Math.round(.34*A.RATE));assert.equal(A.itemKind('forget'),'magic');
  const party=read('story/tower-party-runtime.js'),runtime=read('story/tower-heroes-runtime.js');
  assert.match(party,/heroes\.impact\(m,memberId\|\|H\.state\(r\(\)\)\.active,skillId,result\.effect\.crit===true\)/);
  assert.match(runtime,/if\(crit\)lights\.emit\(CRITICAL,at,/);assert.match(runtime,/ctx\.audio\.sfxAction\?\.\(crit\?'critical':/);assert.doesNotMatch(runtime,/爆擊！|CRITICAL!/);
  assert.match(runtime,/current\(act\('能力值'\+\(pendingPoints\(id\)\?' · '\+pendingPoints\(id\):''\),'hero-tab','attrs'\),panelTab==='attrs'\)/);assert.match(runtime,/panelTab=\['gear','skills','bag','attrs'\]\.includes\(id\)/);
  for(const key of ['hero-attr','hero-attr-auto','hero-attr-forget'])assert.match(runtime,new RegExp("key==='"+key+"'"));
  assert.match(runtime,/H\.allocate\(r\(\),who,score,r\(\)\.revision\)/);assert.match(runtime,/R\.use\(r\(\),'forget',id,false,r\(\)\.revision\)/);assert.match(runtime,/aria-label="'\+esc\(s\.name\+'加一點'\)/);
  assert.match(runtime,/hint=points\?'<small>能力值可分配 '\+points\+' 點<\/small>':''/);assert.match(runtime,/\(points\[id\]\?' · 配點'\+points\[id\]:''\)/);
  const css=read('story/tower-heroes.css');assert.match(css,/\.hero-attr-row \.hero-attr-plus\{min-width:44px;min-height:44px/);
  assert.ok(read('story/tower-heroes-icons.js').includes('item_forget:'));assert.match(read('story/tower-mode.js'),/forget:\[0x5fd8c0,0x1c6458\]/);
});
