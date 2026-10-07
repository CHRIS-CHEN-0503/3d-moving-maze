import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),N=require('../story/tower-narrative.js'),U=require('../story/tower-underworld.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
// Exercise the actual private runtime functions, not a rewritten storage mock.
function extract(name){const start=source.indexOf('  function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('\n  function ',start+1);assert.ok(end>start,name);return source.slice(start,end);}
const coreCode=['pruneHeroBackups','readSave','unreadableSave','surfaceClear','underworldIntro','startUnderworld','syncEngine','save','transact','exitUnlocked','reachExit','action','chooseProfession','handleAction'].map(extract).join('\n');
const SAVE='test-tower',SURFACE_CLEAR=SAVE+'_surface_clear_v1';
function winner(){const r=C.newRun({seed:59,name:'舊旅人'});r.floor=1;r.floorsCleared=99;r.hp=19;r.status='won';r.chronicle=N.newChronicle(1);r.chronicle.clues.push('clue:heart');r.chronicle.ending='keeper';r.gearBag.push(C.createGear('pan',1,r.seed,'old-pan'));return C.validateSave(r);}
function harness(current=winner(),surface=winner()){
  const stored=new Map([[SAVE,JSON.stringify(current)],[SURFACE_CLEAR,JSON.stringify(surface)]]),writes=[],dialogs=[],messages=[],events={entered:0,opened:0,revealed:0,enabled:0};let failAt=0;
  const context=vm.createContext({C,P,N,Underworld:U,Heroes:{...H,enable(){events.enabled++;throw Error('must not replace legacy equipment');}},HeroVisual:{portrait:id=>'<figure data-profession="'+id+'"></figure>'},
    SAVE,SURFACE_CLEAR,run:structuredClone(current),pendingUnderworld:null,pendingUnderworldSource:null,pendingUnderworldActive:null,
    pendingProfession:null,pendingHero:null,pendingSex:'female',pendingDungeonShift:null,upgradingProfession:false,
    active:false,paused:false,pauseAt:0,floorStarted:false,saveFailed:false,exitDeclined:false,explorer:null,partyUI:null,lightingUI:null,cinema:null,
    text:String,prose:rows=>rows.join('\n'),floorLabel:floor=>floor<0?'地下第 '+(-floor)+' 層':'第 '+floor+' 層',
    modern:()=>!!context.run?.party?.loadouts,inDungeon:()=>false,
    // Rendering is outside this storage harness; use the real text fallback.
    playStorySequence:()=>false,
    dialog:(...args)=>dialogs.push(args),showToast:message=>messages.push(message),enter:()=>events.entered++,open:()=>events.opened++,revealHero:()=>events.revealed++,
    damageFeedback(){},refreshGear(){},updateHud(){},document:{getElementById:()=>({value:'舊旅人'})},
    window:{},performance:{now:()=>1000},G:{running:true,satiety:73,shovels:2,kites:1,whistles:3,shovelRechargeAt:5500,skillCoolUntil:2200,hWalls:[],vWalls:[]},
    localStorage:{getItem:key=>stored.get(key)??null,get length(){return stored.size;},key:i=>[...stored.keys()][i]??null,removeItem:key=>stored.delete(key),setItem(key,value){writes.push({key,value});if(failAt&&writes.length===failAt)throw Error('QuotaExceededError');stored.set(key,value);}},
  });
  vm.runInContext(coreCode,context);
  return {context,stored,writes,dialogs,messages,events,failAt:n=>{failAt=n;},call:(name,...args)=>context[name](...args)};
}

test('failed surface backup, prior-save backup or active-save write never starts or overwrites the journey',()=>{
  for(const failedWrite of [1,2,3]){
    const h=harness(),before=h.stored.get(SAVE);h.call('underworldIntro');const candidate=JSON.stringify(h.context.pendingUnderworld);assert.equal(h.writes.length,0);
    h.failAt(failedWrite);h.call('startUnderworld');assert.equal(h.events.entered,0);assert.equal(h.stored.get(SAVE),before);assert.equal(h.context.run.floor,1);assert.equal(JSON.stringify(h.context.pendingUnderworld),candidate);assert.match(h.messages.at(-1),/無法備份並保存/);
    h.failAt(0);h.call('startUnderworld');assert.equal(h.events.entered,1);assert.equal(C.validateSave(h.stored.get(SAVE)).floor,-1);assert.equal(h.stored.get(SAVE+'_before_underworld'),before);assert.equal(h.stored.get(SURFACE_CLEAR),before);
  }
});

test('successful confirmation persists both recoverable snapshots before entering once',()=>{
  const h=harness(),before=h.stored.get(SAVE);h.call('underworldIntro');h.call('startUnderworld');
  assert.deepEqual(h.writes.map(w=>w.key),[SURFACE_CLEAR,SAVE+'_before_underworld',SAVE]);assert.equal(h.stored.get(SURFACE_CLEAR),before);assert.equal(h.stored.get(SAVE+'_before_underworld'),before);assert.equal(h.context.run.floor,-1);assert.equal(h.context.pendingUnderworld,null);assert.equal(h.context.floorStarted,false);
  h.call('startUnderworld');assert.equal(h.events.entered,1);assert.equal(h.writes.length,3);
});

test('a stale active save or changed surface source refuses the pending candidate without writing',()=>{
  for(const channel of ['active','surface']){
    const surface=winner(),current=channel==='active'?surface:C.startUnderworld(surface).run,h=harness(current,surface);h.call('underworldIntro');
    const changed=structuredClone(channel==='active'?current:surface);changed.coins+=1;changed.revision+=1;const key=channel==='active'?SAVE:SURFACE_CLEAR;h.stored.set(key,JSON.stringify(changed));const before=[...h.stored];
    h.call('startUnderworld');assert.equal(h.events.entered,0);assert.equal(h.events.opened,1);assert.equal(h.writes.length,0);assert.equal(h.context.pendingUnderworld,null);assert.deepEqual([...h.stored],before);assert.match(h.messages.at(-1),/已在其他地方更新/);
  }
});

test('old underground character selection excludes and rejects archer and robot without replacing legacy gear',()=>{
  const h=harness(),old=C.startUnderworld(winner()).run,before=JSON.stringify({equipment:old.equipment,gearBag:old.gearBag});
  h.call('chooseProfession',old,true);const html=h.dialogs.at(-1)[3];assert.equal((html.match(/data-tower="profession"/g)||[]).length,6);assert.doesNotMatch(html,/data-item="(?:archer|robot)"/);
  for(const job of ['archer','robot']){h.call('handleAction','profession',job);assert.equal(h.context.pendingHero,null);assert.equal(h.events.enabled,0);assert.equal(h.events.revealed,0);assert.match(h.messages.at(-1),/避免替換既有裝備/);}
  h.call('handleAction','profession','mage');assert.equal(h.events.enabled,0);assert.equal(h.events.revealed,1);assert.equal(h.context.pendingHero.party.loadouts,undefined);assert.equal(JSON.stringify({equipment:h.context.pendingHero.equipment,gearBag:h.context.pendingHero.gearBag}),before);assert.ok(C.validateSave(h.context.pendingHero));
  h.call('chooseProfession',C.newRun({seed:59}),false);for(const job of ['archer','robot'])assert.match(h.dialogs.at(-1)[3],new RegExp('data-item="'+job+'"'),'new stories expose all eight professions');
});

test('descent saves no old-floor exploration checkpoint and a failed save restores the active floor',()=>{
  for(const fails of [false,true]){
    const old=C.startUnderworld(winner()).run,h=harness(old);h.context.active=true;h.context.floorStarted=true;
    const map={w:1,h:1,key:'a',revealed:true,seen:'1'},magic={snapshot:()=>structuredClone(map)};h.context.window.MagicMap=magic;h.context.MagicMap=magic;
    if(fails)h.failAt(1);h.call('reachExit',true);
    if(fails){assert.equal(h.context.run.floor,-1);assert.equal(h.context.floorStarted,true);assert.equal(h.context.G.running,true);assert.equal(C.validateSave(h.stored.get(SAVE)).floor,-1);assert.deepEqual(h.context.run.engine.mapKnowledge,map);}
    else{assert.equal(h.context.run.floor,-2);assert.equal(h.context.floorStarted,false);assert.equal(h.context.G.running,false);const saved=C.validateSave(h.stored.get(SAVE));assert.ok(saved);assert.equal(saved.floor,-2);assert.equal(saved.engine.mapKnowledge,undefined);assert.equal(saved.engine.sightMemory,undefined);assert.equal(saved.engine.shovels,2);assert.equal(saved.engine.shovelCooldownMs,4500);h.call('save');assert.equal(C.validateSave(h.stored.get(SAVE)).engine.mapKnowledge,undefined);}
  }
});

test('growth v2 migration keeps the original snapshot once and refuses an unbacked write',()=>{
  const old=H.enable(P.enable(C.newRun({seed:59,name:'既有成長'}),'mage').run).run;
  old.party.loadouts.growth.version=1;delete old.party.loadouts.growth.members;
  assert.ok(C.validateSave(old));
  for(const fails of [false,true]){
    const h=harness(old),before=h.stored.get(SAVE),key=SAVE+'_before_underground_growth_v2';
    h.context.run=C.validateSave(old);assert.equal(h.context.run.party.loadouts.growth.version,2);
    if(fails)h.failAt(1);
    assert.equal(h.call('save'),!fails);
    if(fails){assert.equal(h.stored.get(SAVE),before);assert.equal(h.stored.has(key),false);}
    else{
      assert.deepEqual(h.writes.map(w=>w.key),[key,SAVE]);assert.equal(h.stored.get(key),before);
      h.context.run.coins++;assert.equal(h.call('save'),true);assert.equal(h.stored.get(key),before);
      assert.equal(h.writes.filter(w=>w.key===key).length,1);assert.ok(C.validateSave(h.stored.get(SAVE)));
    }
  }
});

test('re-entering after a finished underground journey says it replaces that record and never overwrites the first backup',()=>{
  const surface=winner(),finished=C.startUnderworld(surface).run;finished.floor=-50;finished.floorsCleared=149;finished.status='won';assert.ok(C.validateSave(finished),'fixture: a completed underground journey');
  const h=harness(finished,surface),first='{"original surface journey":true}';h.stored.set(SAVE+'_before_underworld',first);let clock=5000;h.context.Date={now:()=>clock+=10};
  h.call('underworldIntro');assert.match(h.dialogs.at(-1)[3],/取代已完成的地下篇紀錄/);
  const finishedRaw=h.stored.get(SAVE);h.call('startUnderworld');assert.equal(h.events.entered,1);
  assert.equal(h.stored.get(SAVE+'_before_underworld'),first,'the very first backup survives');
  const stamped=()=>[...h.stored.keys()].filter(k=>k.startsWith(SAVE+'_before_underworld_')).sort();
  assert.equal(stamped().length,1);assert.equal(h.stored.get(stamped()[0]),finishedRaw);
  for(let again=0;again<3;again++){const done=structuredClone(h.context.run);done.floor=-50;done.floorsCleared=149;done.status='won';done.revision+=1;h.stored.set(SAVE,JSON.stringify(done));h.call('underworldIntro');h.call('startUnderworld');}
  assert.equal(stamped().length,2,'later replacements keep only the newest two stamped copies');assert.equal(h.stored.get(SAVE+'_before_underworld'),first);
  const fresh=harness(winner(),winner());fresh.call('underworldIntro');assert.match(fresh.dialogs.at(-1)[3],/地上通關存檔會另行保留/);assert.doesNotMatch(fresh.dialogs.at(-1)[3],/取代已完成/);
});

test('an unreadable save is reported instead of looking empty, and a new journey asks first',()=>{
  const h=harness();h.stored.set(SAVE,'{"broken":');assert.equal(h.call('readSave'),null);assert.equal(h.call('unreadableSave'),true);
  h.call('handleAction','new');const [,title,,,buttons]=[...h.dialogs.at(-1)];assert.equal(title,'要建立新的旅程嗎？');assert.match(buttons,/data-tower="new-confirm"/);assert.match(buttons,/data-tower="menu"/);
  assert.equal(h.stored.get(SAVE),'{"broken":','nothing is written before the player confirms');
  h.stored.delete(SAVE);assert.equal(h.call('unreadableSave'),false,'no save at all is not an error');
  const ok=harness();assert.equal(ok.call('unreadableSave'),false);
  assert.match(source,/!saved&&unreadableSave\(\)\?'<p class="tower-copy tower-save-warning" role="alert">目前的存檔無法讀取/);
});

test('retrying a defeat brings every fallen member back under the hero, not only whoever fell last',async()=>{
  const {add}=await import('./tower-cooperation-fixtures.mjs');
  const run=H.enable(P.enable(C.newRun({seed:61,name:'重整隊伍'}),'swordsman').run).run,ally=add(run,'healer','herbal_heal','healer');
  H.setHp(run,'hero',0);H.switchRaw(run,ally);H.setHp(run,ally,0);run.status='dead';run.coins=30;assert.equal(H.state(run).active,ally);assert.ok(C.validateSave(run));
  const h=harness(run);h.context.run=structuredClone(run);h.context.cancelFloorQuest=()=>{};h.call('handleAction','retry');
  const after=h.context.run;assert.equal(after.status,'playing');assert.equal(H.state(after).active,'hero');
  for(const id of H.ids(after))assert.equal(H.hp(after,id),H.maxHp(after,id),id+' is back on their feet');
  assert.equal(after.hp,H.maxHp(after,'hero'));assert.equal(after.coins,18);assert.equal(h.events.entered,1);assert.ok(C.validateSave(after));
});
