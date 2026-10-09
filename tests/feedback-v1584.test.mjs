import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js');
const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),E=require('../story/tower-encounters.js'),F=require('../story/tower-field-guide.js'),GM=require('../story/tower-gm.js');
// The atlas reads the shared icon and portrait modules, as in story-atlas-rules.test.mjs.
for(const m of ['tower-hero-growth','tower-heroes-icons','tower-forge-icons','tower-expedition-core','tower-affixes','tower-party-runtime'])require('../story/'+m+'.js');
const Atlas=require('../docs/story-atlas-rules.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const JOBS=Object.keys(P.VITALITY);

test('the robot card face is as short as every other profession; its machine rules move into the card details and stay in game',()=>{
  const lengths=Object.keys(H.JOBS).map(job=>F.profession(job).innate.length);assert.ok(F.profession('robot').innate.length<=Math.max(...lengths.filter((_,i)=>Object.keys(H.JOBS)[i]!=='robot'))+20);
  const card=Atlas.profession('robot');assert.equal(card.description,F.profession('robot').innate);assert.doesNotMatch(card.description,/九成|十分鐘|火把|日光術/);
  assert.match(card.details[0].label,/機體規則/);assert.match(card.details[0].value,/九成.*十分鐘.*動力石/);
  for(const job of Object.keys(H.JOBS).filter(j=>j!=='robot'))assert.ok(!Atlas.profession(job).details.some(r=>r.label==='機體規則'),job);
  assert.match(read('story/tower-heroes-runtime.js'),/esc\(guide\.innate\)\+'<\/p>'\+\(guide\.rules\?'<p>'\+esc\(guide\.rules\)\+'<\/p>':''\)/,'the in-game skills tab still explains the machine rules');
});

test('life depends on the profession: a level-1 swordsman companion is sturdier than a level-1 archer hero, and no cap ever drops',()=>{
  assert.ok(P.vitalHp('swordsman',1,false)>P.vitalHp('archer',1,true),'tank companion vs ranged protagonist');
  for(const level of [1,5,10]){const order=JOBS.map(j=>P.vitalHp(j,level,false));assert.equal(Math.max(...order),P.vitalHp('swordsman',level,false));assert.equal(Math.min(...order),P.vitalHp('mage',level,false));}
  for(const job of JOBS){for(let level=1;level<=15;level++)assert.ok(P.vitalHp(job,level,true)>=60+3*(level-1),job+' hero '+level);for(let level=1;level<=10;level++)assert.ok(P.vitalHp(job,level,false)>=28+6*level,job+' companion '+level);}
  for(const job of JOBS)assert.ok(Math.abs(P.vitalHp(job,10,false)/P.vitalHp(job,10,true)-1)<.05,job+' a level-10 companion still matches a level-10 hero');
  // A journey saved with the old numbers still loads, and leveling adds exactly the new maximum.
  const run=GM.build({floor:94,job:'archer',level:1,seed:3,companions:[{job:'swordsman',level:1},{job:'healer',level:1}]}).run,ids=H.ids(run);
  assert.deepEqual(ids.map(id=>H.maxHp(run,id)),[60,P.vitalHp('swordsman',1,false),P.vitalHp('healer',1,false)]);
  const old=structuredClone(run);H.setHp(old,'hero',60);for(const m of old.party.members)H.setHp(old,m.id,34);assert.ok(C.validateSave(JSON.stringify(old)),'old-formula health is still within every cap');
  const before=Object.fromEntries(ids.map(id=>[id,[H.hp(old,id),H.maxHp(old,id)]]));H.gainXp(old,H.state(old).xp>0?0:1400);
  for(const id of ids)assert.equal(H.hp(old,id)-before[id][0],H.maxHp(old,id)-before[id][1],id);
  for(const under of [false,true]){const ceiling=H.hpCeiling(under);for(const job of JOBS)assert.ok(P.vitalHp(job,under?15:10,true)+30<=ceiling&&P.vitalHp(job,under?10:5,false)+30<=ceiling);}
  const deep=GM.build({floor:-40,job:'robot',level:15,seed:3,companions:[{job:'swordsman',level:10}]});assert.equal(deep.ok,true,deep.message);
});

test('a dropped healing draught is a red flask with a cork, not the grab mode detergent sprite',()=>{
  const tower=read('story/tower-mode.js'),start=tower.indexOf('  const POTION_TINTS='),end=tower.indexOf('  function repositionForaging(){');
  assert.ok(start>0&&end>start);assert.match(tower,/else if\(entry\.type==='item'&&Object\.hasOwn\(POTION_TINTS,entry\.key\)\)icon\.add\(potionModel\(entry\.key\)\);/,'every potion drop uses the bottle');assert.doesNotMatch(tower,/heal:'🧴'/);
  const c=vm.createContext({THREE:T});vm.runInContext(tower.slice(start,end)+';this.potionModel=potionModel;',c);const flask=c.potionModel('heal');
  const meshes=[];flask.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.ok(meshes.length>=7&&meshes.length<=9);
  assert.ok(meshes.some(m=>m.material.color.getHex()===0xe2384f),'red healing liquid');assert.ok(meshes.some(m=>m.material.color.getHex()===0x9a6b43),'cork');assert.ok(meshes.filter(m=>m.material.color.getHex()===0xffffff).length===2,'white cross');
  assert.ok(meshes.every(m=>!m.material.map),'no texture, no emoji sprite');
  // Other potions reuse the bottle in their own colour; only healing draughts carry the white cross.
  for(const [key,color]of [['spirit',0x4f9df0],['arcane',0xa77bff],['courage',0xff7a2e],['heal_mid',0xff5f2e]]){const b=c.potionModel(key),list=[];b.traverse(o=>{if(o.isMesh)list.push(o);});assert.ok(list.some(m=>m.material.color.getHex()===color),key);assert.equal(list.filter(m=>m.material.color.getHex()===0xffffff).length,key.startsWith('heal')?2:0,key);}flask.updateMatrixWorld(true);const box=new T.Box3().setFromObject(flask);assert.ok(box.max.y<.85&&box.min.y>-.01);
});

test('older saved cell surveys keep their original rule, so no journey in progress breaks',()=>{
  let run=null;for(let seed=1;seed<4000&&!run;seed++){const r=C.newRun({seed}),o=E.explorerOffer(r);if(o?.type==='survey')run=E.acceptQuest(r,o.id).run;}
  const q=run.adventure.quest;q.target='cells';q.id=q.id.replace(/zones:[^:]+/,'cells');run=C.validateSave(JSON.stringify(run));assert.ok(run);
  assert.deepEqual(E.surveyTargets(run),[],'no beacons for an old survey');for(const [x,y] of [[0,0],[1,0],[2,0]])run=E.questProgress(run,'survey',{x,y}).run;assert.equal(run.adventure.quest.status,'ready');
  assert.match(E.explorerOffer(run).description,/三個不同的迷宮格/);
});

function upgradeFixture(){
  const run=GM.build({floor:50,job:'swordsman',level:6,seed:7,companions:[{job:'archer',level:5}],gear:false}).run;
  const add=(kind,id)=>{const g=C.createGear(kind,50,run.seed,id);run.gearBag.push(g);return g;};return {run,add};
}
test('a pickup is suggested whenever attack or defense rises for someone, measured with the real equip; equal or unusable gear is not',()=>{
  const {run,add}=upgradeFixture(),snapshot=JSON.stringify(run);
  const sword=add('longsword_t2','up-sword'),u=H.upgradeFor(run,sword.id);assert.equal(u.actorId,'hero');assert.equal(u.slot,'weapon');assert.ok(u.after.offense>u.before.offense*1.03);assert.equal(u.worn.kind,'longsword');
  const bow=add('elven_bow_t2','up-bow'),b=H.upgradeFor(run,bow.id);assert.equal(H.job(run,b.actorId),'archer','goes to the archer, not the leader');
  const armor=add('heavy_armor_t2','up-armor'),a=H.upgradeFor(run,armor.id);assert.equal(a.slot,'armor');assert.ok(a.after.armor>a.before.armor);
  assert.equal(H.upgradeFor(run,add('longsword','same').id),null,'an equal item changes nothing');
  // A trade-off still asks: attack rises, defense drops because the shield comes off; the prompt says so.
  const great=H.upgradeFor(run,add('greatsword_t2','two-hand').id);assert.equal(great.actorId,'hero');assert.ok(great.offense>0&&great.armor<0);assert.equal(great.tradeoff,true);assert.equal(great.shieldOff,true);
  // Small rises count too: a +1 helmet or shield.
  const plusHelm=C.createGear('heavy_helm',50,run.seed,'helm-plus',true);run.gearBag.push(plusHelm);const helm=H.upgradeFor(run,plusHelm.id);assert.equal(helm.slot,'helmet');assert.ok(helm.armor>0&&!helm.tradeoff,'a +'+plusHelm.bonus+' helmet');
  assert.equal(H.upgradeFor(run,add('spellbook_t2','no-healer').id),null,'nobody in this party can use a healer book');assert.ok(C.validateSave(JSON.stringify(run)),'the fixture stays a real save');assert.equal(H.upgradeFor(run,'missing'),null);
  const young=GM.build({floor:94,job:'swordsman',level:2,seed:7,gear:false}).run,early=C.createGear('longsword_t2',94,young.seed,'early');young.gearBag.push(early);assert.equal(H.upgradeFor(young,early.id),null,'level 2 cannot wear a level-3 weapon yet');
  const before=JSON.parse(snapshot);assert.equal(JSON.stringify({...JSON.parse(JSON.stringify(run)),gearBag:before.gearBag}),JSON.stringify(before),'read only: nothing but the added bag items differ');
  // A broken weapon counts as no weapon, so even an identical fresh one is an upgrade.
  H.equipment(run,'hero').weapon.durability=0;assert.equal(H.upgradeFor(run,run.gearBag.find(g=>g.id.includes('same')).id)?.actorId,'hero');
  // A pure improvement wins over a bigger trade-off for the same pickup choice.
  assert.equal(H.upgradeGain({offense:10,armor:8},{offense:10.1,armor:8}).offense>0,true,'a 1% attack rise counts');assert.equal(H.upgradeGain({offense:10,armor:8},{offense:10,armor:8.5}).armor>0,true,'half a point of defense counts');
  assert.equal(H.upgradeGain({offense:10,armor:8},{offense:10,armor:8}),null);assert.equal(H.upgradeGain({offense:10,armor:8},{offense:9,armor:7}),null,'nothing rises');assert.equal(H.upgradeGain({offense:10,armor:8},{offense:12,armor:6}).tradeoff,true);
  const swapped=H.equip(run,u.actorId,u.gearId,run.revision);assert.equal(swapped.ok,true);assert.equal(H.equipment(swapped.run,'hero').weapon.id,sword.id);assert.ok(swapped.run.gearBag.some(g=>g.kind==='longsword'),'the old weapon returns to the bag');assert.ok(C.validateSave(JSON.stringify(swapped.run)));
});

test('the runtime pulses a prompt after a stronger pickup or chest, opens a comparison and equips with one tap',()=>{
  const runtime=read('story/tower-heroes-runtime.js'),tower=read('story/tower-mode.js'),css=read('story/tower-heroes.css');
  assert.match(tower,/if\(result\.effect\?\.pickup\?\.type==='gear'\)partyUI\?\.heroes\?\.suggestUpgrade\?\.\(result\.effect\.pickup\.gear\.id\);/);
  assert.match(tower,/if\(result\.effect\.outcome==='gear'\)partyUI\?\.heroes\?\.suggestUpgrade\?\.\(result\.effect\.gear\.id\);/);
  assert.match(runtime,/upgrade\.id='heroUpgradeAlert';upgrade\.hidden=true;document\.getElementById\('towerLeftHud'\)\.appendChild\(upgrade\);if\(bind\)bind\(upgrade,upgradeDialog\)/);
  assert.match(runtime,/act\('立刻換上','hero-upgrade-equip',u\.actorId\+'\|'\+u\.gearId\)\+act\('暫不更換','hero-upgrade-skip',u\.gearId\)/);
  assert.match(runtime,/\(u\.tradeoff\?'。注意：'\+\(u\.offense<0\?'攻擊':'防禦'\)\+'會下降'\+\(u\.shieldOff\?'，雙手武器會卸下盾牌（放回行囊）':''\):''\)/,'a trade-off names what drops');assert.match(runtime,/rises=\(u\.offense>1e-6\?'攻擊↑':''\)\+\(u\.armor>1e-6\?'防禦↑':''\)/,'the prompt says what rises');
  assert.match(runtime,/if\(key==='hero-upgrade-equip'\)\{[^\n]*commit\(H\.equip\(r\(\),who,item,r\(\)\.revision\)\)/,'one tap uses the normal equip transaction');
  assert.match(runtime,/function hud\(force=false\)\{if\(force\)upgradeAlert\(\);/,'a stale prompt clears after any change');assert.match(runtime,/function reset\(\)\{upgrades=\[\];upgradeAlert\(\);/);
  assert.match(css,/#heroUpgradeAlert\{[^}]*animation:hero-upgrade-pulse/);assert.match(css,/prefers-reduced-motion:reduce\)\{#heroUpgradeAlert\{animation:none/);assert.match(css,/#heroUpgradeAlert\{[^}]*min-height:44px/);
});
