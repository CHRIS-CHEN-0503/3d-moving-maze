import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const GM=require('../story/tower-gm.js'),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),N=require('../story/tower-narrative.js'),M=require('../story/tower-materials.js');
const JOBS=['swordsman','mage','scout','chef','healer','smith','archer','robot'];
const ALL_FLOORS=[...Array.from({length:99},(_,i)=>99-i),...Array.from({length:50},(_,i)=>-1-i)];
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('every surface floor and every underground floor yields a save the real validator accepts, with a full party and full items',()=>{
  for(const floor of ALL_FLOORS){
    const k=Math.abs(floor),job=JOBS[k%8],companions=[1,2,3,4].map(i=>({job:JOBS[(k+i)%8],level:10,sex:i%2?'female':'male'}));
    const built=GM.build({floor,job,level:15,companions,items:GM.fullItems(),seed:500+k});
    assert.equal(built.ok,true,floor+' '+job+': '+built.message);
    const run=built.run,limit=GM.limits(floor);assert.ok(C.validateSave(JSON.parse(JSON.stringify(run))),floor+' survives a JSON round trip');
    assert.equal(run.floor,floor);assert.equal(run.status,'playing');assert.equal(run.floorsCleared,floor>0?99-floor:98-floor);
    assert.equal(run.party.members.length,limit.members,'companions are capped at the floor limit');assert.equal(H.level(run,'hero'),limit.hero);
    for(const m of run.party.members)assert.ok(H.level(run,m.id)<=limit.member);
    assert.equal(run.underworld?.version??null,floor<0?1:null);
  }
});

test('each profession can lead on the first floor of every chapter and in the deep, alone or with friends',()=>{
  const starts=[99,89,79,69,59,49,39,29,19,9,1,-1,-10,-11,-21,-31,-41,-50];
  for(const job of JOBS)for(const floor of starts){
    for(const companions of [[],JOBS.filter(j=>j!==job).slice(0,2).map(j=>({job:j,level:3}))]){
      const built=GM.build({floor,job,level:7,companions,seed:77});assert.equal(built.ok,true,job+'@'+floor+': '+built.message);
      assert.equal(H.job(built.run,'hero'),job);assert.equal(built.run.party.members.length,companions.length);
    }
  }
});

test('levels, items and the arrow quiver are clamped to what a real journey may hold',()=>{
  const surface=GM.build({floor:60,job:'archer',level:99,companions:[{job:'mage',level:99}],seed:3,items:{coins:5e9,scrap:500,bag:{heal:-4,arrow:99999,map:12.6},materials:{ironore:1000},ingredients:{herb:150},light:{torches:200}}});
  assert.equal(surface.ok,true,surface.message);const r=surface.run;
  assert.equal(H.level(r,'hero'),10);assert.equal(H.level(r,'gm:1:mage'),5);
  assert.equal(r.coins,999999);assert.equal(r.party.journey.scrap,99);assert.equal(r.bag.heal,0);assert.equal(r.bag.map,13);
  assert.equal(r.bag.arrow,C.itemLimit('arrow',r),'arrows fill the real quiver capacity, not the 3000 storage cap');assert.ok(r.bag.arrow<3000);
  assert.equal(r.party.journey.materials.ironore,99);assert.equal(r.party.ingredients.herb,99);assert.equal(r.party.light.torches,99);
  // Unspecified items keep a fresh journey's defaults.
  const plain=GM.build({floor:60,job:'archer',seed:3}).run;assert.equal(plain.coins,C.newRun({seed:3}).coins);assert.equal(plain.bag.heal,C.newRun({seed:3}).bag.heal);
  const deep=GM.build({floor:-30,job:'swordsman',level:99,companions:Array.from({length:6},()=>({job:'healer',level:99})),seed:4});
  assert.equal(deep.ok,true);assert.equal(H.level(deep.run,'hero'),15);assert.equal(deep.run.party.members.length,4);assert.ok(deep.run.party.members.every(m=>H.level(deep.run,m.id)===10));assert.match(deep.notes.join(''),/最多 4 位/);
  for(const bad of [0,100,-51,1.5,'x'])assert.equal(GM.build({floor:bad,job:'mage'}).ok,false,String(bad));
  assert.equal(GM.build({floor:50,job:'wizard'}).ok,false);
});

test('the deep starts through the real underground entrance: nobody is drawn to leave, chosen friends join afterwards',()=>{
  for(const ending of ['release','keeper','bridge']){
    const built=GM.build({floor:-15,job:'smith',level:12,companions:[{job:'mage',level:8},{job:'archer',level:6}],ending,seed:91});assert.equal(built.ok,true);
    const run=built.run;assert.equal(run.underworld.departed,null,'no one departs');assert.equal(run.underworld.surfaceEnding,ending);assert.equal(run.chronicle.ending,ending);
    assert.deepEqual(run.party.members.map(m=>m.profession),['mage','archer']);
  }
});

test('the best kit follows job, level and depth; two-handed weapons drop the shield and robots keep their integrated parts',()=>{
  const at=(floor,job,level,companions=[])=>GM.build({floor,job,level,companions,seed:12}).run;
  const low=at(90,'swordsman',1);assert.equal(low.equipment.weapon.kind,'longsword');assert.equal(low.equipment.shield.kind,'tower_shield');
  const mid=at(50,'swordsman',6);assert.deepEqual(Object.values(mid.equipment).map(g=>g&&H.GEAR[g.kind].tier),[3,3,3,3]);
  const surfaceTop=at(5,'mage',10);assert.ok(Object.values(surfaceTop.equipment).filter(Boolean).every(g=>H.GEAR[g.kind].tier<=3),'the surface never wears tier 4-5');
  const deep=at(-25,'smith',15);assert.ok(Object.values(deep.equipment).filter(Boolean).every(g=>H.GEAR[g.kind].tier===5));
  for(const job of ['mage','healer','scout','archer']){const run=at(40,job,6);assert.equal(run.equipment.shield,null,job+' has no shield');}
  const robot=at(30,'robot',6),plain=GM.build({floor:30,job:'robot',level:6,gear:false,seed:12}).run;assert.deepEqual(robot.equipment,plain.equipment,'robot parts are left as built');
  const off=GM.build({floor:50,job:'swordsman',level:6,gear:false,seed:12}).run;assert.equal(H.GEAR[off.equipment.weapon.kind].tier,1,'gear can be left at the starter kit');
  const party=at(-5,'chef',9,[{job:'archer',level:9}]);assert.ok(H.equipment(party,'gm:1:archer').weapon.kind.startsWith('elven_bow'));
});

test('stories before the chosen floor are marked read by default and can be kept unread',()=>{
  const read=GM.build({floor:65,job:'healer',seed:5}).run,unread=GM.build({floor:65,job:'healer',readStories:false,seed:5}).run;
  assert.deepEqual(read.chronicle.read,N.unlockedScenes(65).map(s=>s.id));assert.ok(read.chronicle.read.length>0);assert.deepEqual(unread.chronicle.read,[]);
  assert.ok(C.validateSave(unread));
});

test('the ladder opens only on its own address, and the story module then uses a separate sandbox save',()=>{
  for(const hash of ['#逃生梯','#%E9%80%83%E7%94%9F%E6%A2%AF','#gm-ladder'])assert.equal(GM.active({hash}),true,hash);
  for(const hash of ['','#','#home','#逃生','#逃生梯x','#GM-LADDER'])assert.equal(GM.active({hash}),false,hash);
  assert.equal(GM.GM_SAVE,'maze3d_tower_gm_v1');assert.notEqual(GM.GM_SAVE,'maze3d_tower_v1');
  const tower=read('story/tower-mode.js'),line=tower.split('\n').find(l=>/^\s*const SAVE = /.test(l));
  const pick=window=>vm.runInNewContext(line.trim().replace(/^const SAVE = /,'')+';',{window});
  assert.equal(pick({}),'maze3d_tower_v1','normal play keeps the real journey');assert.equal(pick({TowerGM:{active:()=>false,GM_SAVE:GM.GM_SAVE}}),'maze3d_tower_v1');
  assert.equal(pick({TowerGM:{active:()=>true,GM_SAVE:GM.GM_SAVE}}),'maze3d_tower_gm_v1','the ladder writes only its sandbox');
  const html=read('index.html');assert.ok(html.indexOf('story/tower-gm.js?v=')<html.indexOf('story/tower-mode.js?v='),'the ladder decides the save key before the story module loads');
  assert.doesNotMatch(html,/逃生梯<\/(?:button|a)>|href="[^"]*#逃生梯/,'no visible link to the ladder in the game');
  assert.doesNotMatch(read('story/tower-gm.js'),/fetch\(|XMLHttpRequest|mpSend|\/api\//,'the panel never talks to a server or a room');
});

test('the floor list covers all 149 floors grouped by chapter and depth, and full items use every storage limit',()=>{
  const groups=GM.floors(),floors=groups.flatMap(g=>g.floors.map(f=>f.floor));
  assert.deepEqual(floors,ALL_FLOORS);assert.equal(groups.length,N.CHAPTERS.length+5);assert.ok(groups.every(g=>g.floors.every(f=>f.name)));
  const full=GM.fullItems();assert.deepEqual(Object.keys(full.bag).sort(),Object.keys(C.ITEMS).filter(k=>k!=='coin').sort());
  assert.deepEqual(Object.keys(full.materials).sort(),Object.keys(M.MATERIALS).sort());assert.deepEqual(Object.keys(full.ingredients).sort(),Object.keys(P.INGREDIENTS).sort());
});
