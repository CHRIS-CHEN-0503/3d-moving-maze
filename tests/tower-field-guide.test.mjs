import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),E=require('../story/tower-encounters.js'),X=require('../story/tower-expedition-core.js'),S=require('../story/tower-monster-sense.js'),F=require('../story/tower-field-guide.js');
const frozen=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
const fresh=(job='mage',seed=23)=>H.enable(P.enable(C.newRun({seed}),job).run).run;
const at=(r,f)=>{r.floor=f;r.floorsCleared=99-f;r.chronicle=N.newChronicle(f);P.advance(r);return r;};

test('all monster advice uses actual personality sensing and never mutates combat definitions',()=>{
  const defs=P.defs(),before=JSON.stringify(defs);assert.equal(Object.keys(defs).length,24);
  for(const d of Object.values(defs)){
    const guide=F.monster(d),profile=S.profile(d);
    assert.equal(guide.range,profile.range);assert.equal(guide.hearing,profile.hearing);
    assert.equal(S.detect(d,{distance:guide.range,line:true}),true);
    assert.equal(S.detect(d,{distance:guide.range+.01,line:true}),false);
    assert.ok(['role','threat','tell','counter','sensing'].every(k=>typeof guide[k]==='string'&&guide[k].trim()),d.id);
    assert.equal(!!guide.gate,d.id.startsWith('lord-'));
    if(d.ranged)assert.match(guide.counter,/側移|側面|轉角/);
    guide.counter='caller changed a display object';
    assert.notEqual(F.monster(d).counter,guide.counter);
  }
  assert.equal(JSON.stringify(defs),before);
  assert.equal(F.monster('hound').hearing,true);assert.equal(F.monster('flower').hearing,false);
  assert.equal(F.monster(null),null);
});

test('chapter recap follows collected evidence, never awards clues or exposes future chapters',()=>{
  for(const chapter of N.CHAPTERS){
    const start=frozen(at(fresh(),chapter.high)),before=JSON.stringify(start),intro=F.progression(start),brief=N.brief(start);
    assert.equal(brief.clueFound,false);assert.equal(JSON.stringify(start),before);assert.ok(intro);
    const mid=at(fresh(),chapter.mid),unfound=N.brief(frozen(structuredClone(mid))),found=N.collectClue(mid).run;
    assert.equal(unfound.recap,brief.recap);assert.equal(N.brief(found).clueFound,true);assert.notEqual(N.brief(found).recap,brief.recap);
    assert.equal(found.chronicle.read.length,0,'Recaps never auto-read voiced scenes');
    for(const future of N.CHAPTERS.filter(c=>c.high<chapter.low))assert.ok(![brief.recap,unfound.recap,N.brief(found).recap].join('').includes(future.clueName));
    assert.ok(brief.recap.length<=90,'A returning player gets a brief explanation');
    assert.ok(C.validateSave(found));
  }
  assert.equal(N.brief(null),null);assert.equal(N.brief({floor:0}),null);
  const r=N.collectClue(at(fresh(),1)).run,done=N.chooseEnding(r,'keeper').run;
  assert.equal(N.brief(done).recap,N.ENDINGS.find(e=>e.id==='keeper').description);
  assert.match(N.brief(r).landmark,/歸途/);
});

test('gear advice covers all three tiers and distinguishes locked, worn and broken pieces',()=>{
  for(const def of Object.values(H.GEAR)){
    const r=frozen(fresh(def.jobs[0])),g=C.createGear(def.kind,40,r.seed,'guide-'+def.kind),before=JSON.stringify(r);
    const guide=F.gear(g,r,'hero');assert.equal(guide.requiredLevel,def.requiredLevel);assert.equal(guide.tier,def.tier);
    if(def.requiredLevel>1)assert.match(guide.fit,/還需要升到/);else assert.match(guide.fit,/符合/);
    assert.equal(JSON.stringify(r),before);
    for(const [durability,severity] of [[21,'good'],[20,'warning'],[10,'critical'],[0,'broken']])assert.equal(F.gear({...g,durability,maxDurability:100},r,'hero').severity,severity);
    if(def.slot==='weapon')assert.match(guide.wear,['bow','staff','book'].includes(def.type)?/發射就消耗/:/揮空不扣/);
  }
  assert.equal(F.gear('missing'),null);
  assert.match(F.gear('longsword',fresh('chef'),'hero').fit,/不適合/);
});

test('profession guide distinguishes inherent abilities from actually owned random passives',()=>{
  for(const job of Object.keys(H.JOBS)){
    let owned=false,missing=false;
    for(let seed=1;seed<=25;seed++){
      const run=frozen(fresh(job,seed)),before=JSON.stringify(run),guide=F.profession(job,run,'hero');
      assert.equal(guide.name,H.JOBS[job].name);assert.ok(guide.innate);
      for(const entry of guide.random){assert.equal(entry.learned,H.actor(run,'hero').passives.includes(entry.id));assert.equal(entry.description,H.PASSIVES[entry.id].description);if(entry.learned)owned=true;else missing=true;}
      assert.equal(JSON.stringify(run),before);
    }
    assert.ok(owned&&missing,job+' advice reflects random abilities instead of assuming a class bonus');
  }
  assert.match(F.profession('mage').innate,/日光術.*不占技能欄/);
  assert.match(F.profession('smith').innate,/耐久歸零/);
  assert.equal(F.profession('missing'),null);
});

test('progression guide uses saved XP and milestone choices without creating state on read',()=>{
  let run=fresh();for(let level=1;level<=10;level++){
    H.gainXp(run,Math.max(0,G.XP[level-1]-run.party.loadouts.xp));
    const snapshot=frozen(structuredClone(run)),before=JSON.stringify(snapshot),guide=F.progression(snapshot);
    assert.equal(guide.level,level);assert.equal(guide.recruitLimit,P.recruitLimit(run));
    assert.equal(guide.nextLevelXp,level<10?G.XP[level]:null);
    assert.equal(guide.ready,[4,6,8].filter(l=>l<=level).length);
    assert.equal(JSON.stringify(snapshot),before);
  }
  assert.equal(F.progression(C.newRun({seed:1})),null);
  const source=readFileSync(new URL('../story/tower-field-guide.js',import.meta.url),'utf8'),context=vm.createContext({});vm.runInContext(source,context);
  assert.ok(context.TowerFieldGuide,'The browser loads metadata without eager dependency cycles');
});

test('chapter mechanism presentation matches its environment while keeping every puzzle and clock',()=>{
  const expected={90:['stone',2,14,3,3,12],80:['mirror',2,14,3,3,15],70:['chase',3,16,4,4,16],60:['tide',3,18,4,5,14],50:['steam',3,17,5,4,18],40:['reverse',3,16,4,4,16],30:['pulse',3,15,4,4,18],20:['frost',3,18,5,4,17],10:['gear',3,16,4,4,20],1:['heart',3,18,5,4,20]};
  for(const [floor,mechanic]of Object.entries(X.BOSSES).filter(([f])=>Number(f)>0)){
    assert.equal(mechanic.environmentId,C.floorConfig(Number(floor)).environmentId);
    assert.deepEqual(['kind','count','cycle','warning','strike','damage'].map(k=>mechanic[k]),expected[floor]);
    assert.ok(mechanic.nodeName&&mechanic.description);
  }
  assert.deepEqual(X.BOSSES[70].order,[0,1,2]);assert.deepEqual(X.BOSSES[60].order,[2,0,1]);
});

test('quest display explains hand-in and keeps advisory fields out of the saved quest',()=>{
  let run,offer;for(let seed=1;seed<1000;seed++){const r=fresh('mage',seed),q=E.explorerOffer(r);if(q?.type==='escort'){run=r;offer=q;break;}}
  assert.ok(offer);assert.match(offer.description,/等我跟上/);assert.match(offer.leaveWarning,/目前這一層/);
  run=E.acceptQuest(run,offer.id).run;run=E.questProgress(run,'escort',{atExit:true,distance:1}).run;
  assert.match(E.explorerOffer(run).nextStep,new RegExp(offer.explorer.name));
  assert.equal(Object.hasOwn(run.adventure.quest,'nextStep'),false);assert.ok(C.validateSave(run));
  const before=JSON.stringify(run);assert.equal(E.explorerOffer(run).status,'ready');assert.equal(JSON.stringify(run),before);
});
