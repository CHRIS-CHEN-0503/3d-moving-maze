import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),R=require('../story/tower-recruitment.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),B=require('../story/tower-floor-lords.js');
const clone=structuredClone;
const ok=result=>{assert.ok(result.ok,result.message);assert.ok(C.validateSave(result.run),'transaction output remains saveable');return result.run;};
const fresh=seed=>ok(H.enable(ok(P.enable(C.newRun({seed,name:'重逢測試'}),'mage','female'))));
function move(run,floor){run.floor=floor;run.floorsCleared=floor<0?99-floor-1:99-floor;run.claimed=[];run.defeatedMonsters=[];run.monsterStuns={};run.adventure=C.newAdventure();run.expedition=D.newExpedition();if(floor>0)run.chronicle=N.newChronicle(floor);P.advance(run,{reward:false});assert.ok(C.validateSave(run));return run;}
function put(run,type,id,count){if(type==='coins')run.coins=count;else if(type==='scrap')run.party.journey.scrap=count;else if(type==='materials')run.party.journey.materials[id]=count;else if(type==='bag')run.bag[id]=count;else run.party[type][id]=count;}
function fund(run,offer=P.recruitOffer(run)){for(const c of P.recruitQuote(run,offer.id).list)put(run,c.type,c.id,c.count);return run;}
function recruit(run){const offer=P.recruitOffer(run);assert.ok(offer);fund(run,offer);return ok(P.recruit(run,offer.id,run.revision));}
function nextReturn(run,id){for(let f=run.floor-1;f>= (C.isUnderworld(run)?-50:1);f--){if(f===0)break;move(run,f);const o=P.recruitOffer(run);if(o?.returning&&o.id===id)return o;}assert.fail('a later seeded floor should offer the retired traveller again');}
function learn(run,id){const a=H.actor(run,id),known=[...a.skills,...a.passives],key=Object.values({...H.SKILLS,...H.PASSIVES}).find(s=>s.job===H.job(run,id)&&!s.unique&&!known.includes(s.id)).id;return ok(G.choose(run,key,id));}
function enterUnderworld(run){move(run,1);run.chronicle.ending='keeper';run.chronicle.clues.push(N.chapterForFloor(1).clueId);run.party.boss.started=true;run.party.boss.done=true;run.party.boss.seals.fill(true);run.defeatedMonsters.push(B.spec(run).id);return ok(C.startUnderworld(ok(C.descend(run))));}

const fixtures={};
for(let seed=1;seed<=40&&Object.keys(fixtures).length<16;seed++)for(const floor of [99,97,95,93,91,89,87,85]){
  const run=move(fresh(seed),floor),offer=P.recruitOffer(run);if(offer)fixtures[R.identity(offer.profession,offer.sex)]??={seed,floor};
}
assert.equal(Object.keys(fixtures).length,16);

test('sixteen named traveller profiles retain distinct reasonable agreements and basic meal prerequisites',()=>{
  assert.equal(Object.keys(R.TERMS).length,16);assert.ok(Object.values(R.TERMS).some(p=>!p.costs.coins));
  assert.equal(new Set(Object.values(R.TERMS).map(p=>JSON.stringify(p.costs))).size,15,'robot male and smith male share the approved six coins plus two scrap price');
  for(const p of Object.values(R.TERMS)){assert.ok(p.story.length>10);for(const key of Object.keys(p.costs.meals||{}))assert.ok(P.BASIC_RECIPES.includes(key));for(const c of Object.values(p.costs).flatMap(v=>typeof v==='number'?[v]:Object.values(v)))assert.ok(c>0&&c<=10);}
});
for(const [identity,{seed,floor}] of Object.entries(fixtures))test(identity+' costs are shown and deducted exactly; insufficient any one requirement is atomic',()=>{
  const run=move(fresh(seed),floor),offer=P.recruitOffer(run);fund(run,offer);const q=P.recruitQuote(run,offer.id);
  assert.ok(q.affordable);assert.equal(q.returning,false);assert.equal(R.identity(q.offer.profession,q.offer.sex),identity);assert.deepEqual(q.costs,R.TERMS[identity].costs);
  for(const c of q.list){assert.ok(c.label);assert.equal(c.have,c.count);assert.equal(c.missing,0);const poor=clone(run);put(poor,c.type,c.id,c.count-1);const before=clone(poor),bad=P.recruit(poor,offer.id,poor.revision);assert.equal(bad.ok,false);assert.deepEqual(poor,before);assert.deepEqual(bad.run,before);assert.equal(P.recruitQuote(poor,offer.id).affordable,false);}
  const before=clone(run),joined=ok(P.recruit(run,offer.id,run.revision));assert.deepEqual(run,before);
  for(const c of q.list)assert.equal(R.stock(joined,c.type,c.id),c.type==='bag'&&c.id==='arrow'?15:0,'deduct '+c.label+' exactly, new archers alone receive their original starter arrows');
  if(!q.costs.coins)assert.equal(joined.coins,before.coins);assert.equal(joined.party.members.length,1);assert.equal(joined.party.members[0].sex,offer.sex);
  assert.equal(P.recruit(joined,offer.id).ok,false);assert.equal(P.recruit(run,offer.id,run.revision-1).ok,false);assert.equal(P.recruit(run).ok,false);
});

test('surface reunion preserves identity, level, XP, skill order, passives, learned choice and headgear preference',()=>{
  let run=recruit(fresh(43)),id=run.party.members[0].id;H.gainXp(run,G.XP[3]);run=learn(run,id);run=ok(H.reorderSkills(run,id,[...H.actor(run,id).skills].reverse()));run=ok(H.showHeadgear(run,id,false));H.actor(run,id).roll=41;
  H.actor(run,id).buffs=[{id:'barrier',left:200,power:30}];H.actor(run,id).attack=1;H.actor(run,id).tool=5;for(const k in H.actor(run,id).cooldowns)H.actor(run,id).cooldowns[k]=7;
  const before=H.recruitSnapshot(run,id),member=clone(run.party.members[0]),gear=H.allGear(run).map(g=>g.id).sort();H.setHp(run,id,0);
  run=ok(P.dismiss(run,id));assert.equal(run.party.travellers.length,1);assert.deepEqual(H.allGear(run).map(g=>g.id).sort(),gear);assert.deepEqual(run.party.travellers[0].loadout,before);
  assert.equal(P.recruitOffer(run),null);assert.equal(P.recruit(run,id).ok,false);const same=clone(run);same.seed++;assert.ok(!P.recruitOffer(same)||P.recruitOffer(same).id!==id,'a new maze seed cannot undo the same-floor restriction');
  run=C.validateSave(JSON.stringify(run));const offer=nextReturn(run,id);assert.equal(offer.level,member.level);assert.equal(offer.recruitCount,2);assert.equal(offer.departures,1);
  const preview=H.preview(run,offer);assert.deepEqual(preview.skills,before.skills);assert.deepEqual(preview.passives,before.passives);assert.ok(Object.values(preview.equipment).every(g=>g===null));
  fund(run);const q=P.recruitQuote(run,id),base=R.TERMS[R.identity(member.profession,member.sex)];for(const c of q.list)assert.equal(c.count,Math.ceil((typeof base.costs[c.type]==='number'?base.costs[c.type]:base.costs[c.type][c.id])*1.5));
  run=ok(P.recruit(run,id));assert.deepEqual(H.recruitSnapshot(run,id),before);assert.equal(run.party.members[0].xp,member.xp);assert.equal(H.hp(run,id),H.maxHp(run,id));assert.deepEqual(H.allGear(run).map(g=>g.id).sort(),gear);assert.ok(Object.values(H.equipment(run,id)).every(g=>g===null));
  const a=H.actor(run,id);assert.deepEqual(a.buffs,[]);assert.equal(a.attack,0);assert.equal(a.tool,0);assert.ok(Object.values(a.cooldowns).every(n=>n===0));assert.equal(a.pending,null);assert.equal(a.shot,null);assert.equal(H.canLearn(run,id),false);
});

test('repeat archer invitations increase their supplies but never issue another starter kit or arrows',()=>{
  const fixture=fixtures['archer:male'];let run=recruit(move(fresh(fixture.seed),fixture.floor)),id=run.party.members[0].id;
  const gear=H.allGear(run).map(g=>g.id).sort();for(const expected of [2,3,4]){run=ok(P.dismiss(run,id));const offer=nextReturn(run,id);assert.equal(offer.recruitCount,expected);fund(run,offer);const arrows=run.bag.arrow,price=P.recruitQuote(run,id).costs.bag.arrow;run=ok(P.recruit(run,id));assert.equal(run.bag.arrow,arrows-price);assert.deepEqual(H.allGear(run).map(g=>g.id).sort(),gear);assert.equal(run.party.joined.filter(k=>k===id).length,1);}
});

test('long-term reunion requirements never exceed a supply stack capacity',()=>{
  const run=fresh(43),offer={id:'preview',profession:'archer',sex:'male',level:5,returning:true,departures:100,recruitCount:101};
  const q=R.quote(run,offer);assert.equal(q.costs.bag.arrow,99);assert.equal(q.costs.ingredients.root,51);
  for(const c of q.list)assert.ok(c.type==='coins'||c.count<=99);
});

test('forced underground farewell is archived and can rejoin without erasing the ending; surface skills are preserved',()=>{
  let run=recruit(fresh(43)),id=run.party.members[0].id;H.gainXp(run,G.XP[3]);run=learn(run,id);const talents=H.recruitSnapshot(run,id);run=enterUnderworld(run);
  assert.equal(run.underworld.departed.id,id);assert.equal(run.party.travellers[0].departedFloor,1);const ending=clone(run.underworld),gear=H.allGear(run).map(g=>g.id).sort();
  const offered=P.recruitOffer(run);if(!offered?.returning||offered.id!==id)nextReturn(run,id);fund(run);run=ok(P.recruit(run,id));
  const {attrs:after,...kept}=H.recruitSnapshot(run,id),{attrs:remembered,...was}=talents;
  assert.equal(H.level(run,id),5);assert.deepEqual(kept,was);assert.ok(H.ATTRIBUTES.every(k=>after[k]>=remembered[k]),'remembered free points stay');assert.equal(H.unspentPoints(run,id),0);assert.deepEqual(run.underworld,ending);assert.deepEqual(H.allGear(run).map(g=>g.id).sort(),gear);assert.equal(G.available(run,id),0);
});

test('underground newcomers learn their random fourth-level skill once, and level ten reunions retain their chosen ultimate',()=>{
  let run=enterUnderworld(fresh(17));for(let f=-1;!P.recruitOffer(run)&&f>-50;)move(run,--f);run=recruit(run);const id=run.party.members[0].id;
  assert.equal(H.level(run,id),5);assert.ok(H.actor(run,id).learned);assert.equal(G.record(run,id).choices.length,1);H.gainXp(run,G.XP[9]);
  while(G.available(run,id))run=learn(run,id);const ultimate=G.ultimateOptions(run,id)[1];run=ok(G.chooseUltimate(run,id,ultimate.id));
  const before=H.recruitSnapshot(run,id),xp=H.experience(run,id);run=ok(P.dismiss(run,id));const offer=nextReturn(run,id);assert.equal(offer.level,10);fund(run);run=ok(P.recruit(run,id));
  assert.deepEqual(H.recruitSnapshot(run,id),before);assert.equal(H.experience(run,id),xp);assert.equal(G.record(run,id).awakening,ultimate.id);assert.equal(G.available(run,id),0);assert.equal(G.availableUltimate(run,id),false);
});

test('a surface traveller who left without choosing their level-four skill receives only the one missing bonus on underground return',()=>{
  let run=recruit(fresh(31));const id=run.party.members[0].id;H.gainXp(run,G.XP[3]);assert.equal(G.available(run,id),1);run=enterUnderworld(run);
  if(!P.recruitOffer(run)?.returning)nextReturn(run,id);fund(run);run=ok(P.recruit(run,id));assert.equal(H.level(run,id),5);assert.equal(G.record(run,id).choices.length,1);const learned=H.actor(run,id).learned;
  run=ok(P.dismiss(run,id));nextReturn(run,id);fund(run);run=ok(P.recruit(run,id));assert.equal(H.actor(run,id).learned,learned);assert.equal(G.record(run,id).choices.length,1);
});

test('archive validation rejects duplicate identities, foreign skills, inflated growth and invented equipment; old saves migrate empty',()=>{
  let run=recruit(fresh(43));const id=run.party.members[0].id;run=ok(P.dismiss(run,id));
  for(const corrupt of [
    n=>n.party.travellers.push(clone(n.party.travellers[0])),
    n=>n.party.travellers[0].id='hero',n=>n.party.travellers[0].identity='healer:female',n=>n.party.travellers[0].departedFloor=98,n=>n.party.travellers[0].departures=0,
    n=>n.party.travellers[0].loadout.skills[0]='star_ring',n=>n.party.travellers[0].loadout.skills.push('decisive_slash'),n=>n.party.travellers[0].loadout.growth.awakening='decisive_slash',
    n=>n.party.travellers[0].loadout.equipment={weapon:n.equipment.weapon},n=>n.party.travellers[0].loadout.learned='sword_break',n=>n.party.travellers[0].level=10,n=>n.party.travellers[0].loadout=null,
  ]){const bad=clone(run);corrupt(bad);assert.equal(C.validateSave(bad),null);}
  const legacy=clone(run);delete legacy.party.travellers;assert.deepEqual(C.validateSave(legacy).party.travellers,[]);assert.equal(C.validateSave({...run,party:{...run.party,travellers:null}}),null);
});

test('legacy parties can dismiss and meet the same traveller without modern equipment or fabricated stored talents',()=>{
  let run=ok(P.enable(C.newRun({seed:43}),'chef'));run=recruit(run);const id=run.party.members[0].id;run=ok(P.dismiss(run,id));assert.equal(run.party.travellers[0].loadout,null);nextReturn(run,id);fund(run);run=ok(P.recruit(run,id));assert.equal(run.party.members[0].id,id);assert.equal(run.party.loadouts,undefined);
});
