import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {provisionTravellers} from './recruit-fixtures.mjs';
import {readFileSync,statSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),B=require('../story/tower-floor-lords.js'),L=require('../story/tower-loot.js'),R=require('../story/tower-reinforcements.js'),S=require('../story/tower-monster-sense.js'),St=require('../story/tower-stairs.js'),A=require('../assets/maze-atmosphere.js'),T=require('../lib/three.min.js');
function fresh(floor=99,seed=31,job='swordsman',sex='male'){const r=H.enable(P.enable(C.newRun({seed}),job,sex).run).run;r.floor=floor;r.floorsCleared=99-floor;r.chronicle=N.newChronicle(floor);r.expedition=D.newExpedition();r.defeatedMonsters=[];P.advance(r);return r;}
const living=r=>P.monsterSpecs(r).filter(m=>!r.defeatedMonsters.includes(m.id));
const cells=[{x:2,y:2},{x:3,y:3},{x:4,y:4}];
function defeat(r,spec){r.defeatedMonsters.push(spec.id);delete r.party.health[spec.id];delete r.party.poise[spec.id];delete r.party.loadouts.enemy[spec.id];delete r.monsterStuns[spec.id];return L.recordKill(r,spec,{x:2,y:3});}
function killByAttack(r,id){
  const Events=require('../story/tower-adventure-events.js');
  for(let i=0;i<100&&!r.defeatedMonsters.includes(id);i++){
    H.tick(r,2);const hit=H.strike(r,id,{lootCell:{x:2,y:3}});assert.ok(hit.ok,hit.message);r=hit.run;
    // Defeating the two revised lords includes their real half-health counter,
    // rather than assuming ordinary strikes can bypass a scene guard.
    const guard=r.adventure.events?.lord;if(id===B.ID&&guard?.phase==='guarded'){
      if(guard.floor===60){const arm=Events.armCounter(r);assert.ok(arm.ok);r=arm.run;}
      for(let j=0;j<guard.broken.length;j++)if(!guard.broken[j]){const counter=Events.counter(r,j);assert.ok(counter.ok,counter.message);r=counter.run;}
    }
  }
  assert.ok(r.defeatedMonsters.includes(id));return r;
}
test('ten original environmental lords only spawn on main-tower chapter finales, once each',()=>{
  assert.equal(Object.keys(B.LORDS).length,10);const names=new Set(),shapes=new Set();
  for(const [floor,d]of Object.entries(B.LORDS)){const r=fresh(+floor),spec=P.monsterSpecs(r).filter(m=>m.lord);assert.equal(spec.length,1);assert.equal(spec[0].id,B.ID);assert.equal(spec[0].strength,d.strength);assert.equal(spec[0].maxHp,Math.round(Math.min(240,85+Math.round((99-floor)*1.5))*1.3));assert.ok(d.personality);names.add(d.name);const m=B.build(T,d);let triangles=0,meshes=0;const shape=[];m.updateMatrixWorld(true);m.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.equal(o.material.map,null);shape.push([o.geometry.type,o.matrixWorld.elements]);}});assert.ok(meshes<=40&&triangles<6000,d.name+" "+meshes+"/"+triangles);shapes.add(JSON.stringify(shape));r.expedition.active={};assert.equal(B.forRun(r),null);}
  assert.equal(names.size,10);assert.ok(shapes.size>=9);assert.equal(B.forRun(fresh(91)),null);
});
test('maze seal completion and actual floor-lord defeat are both required, including after reload',()=>{
  let r=fresh(90);r.chronicle.clues.push('clue:summoning');assert.equal(P.canDescend(r),false);r=killByAttack(r,B.ID);assert.equal(P.canDescend(r),false,'Killing the lord does not solve the maze');assert.ok(!living(r).some(m=>m.lord));r.party.boss.started=true;r.party.boss.done=true;r.party.boss.seals.fill(true);assert.equal(P.canDescend(r),true);r=C.validateSave(JSON.stringify(r));assert.ok(r);assert.equal(P.canDescend(r),true);assert.equal(P.monsterSpecs(r).filter(m=>m.lord).length,1,'The saved dead specification does not create a second lord');const next=C.descend(r);assert.ok(next.ok,next.message);assert.equal(next.run.floor,89);assert.deepEqual(next.run.party.loot,L.fresh());assert.deepEqual(next.run.party.reinforcements,R.fresh());
});
test('small/medium/large live caps are 10/15/20, including lords; 500 idle shifts never accumulate beyond them',()=>{
  for(const floor of [99,90,80,70,60,50,40,30,20,10,1]){let r=fresh(floor),cap=R.limit(C.floorConfig(floor).size);assert.equal(cap,C.floorConfig(floor).size<=9?10:C.floorConfig(floor).size<=13?15:20);let saw=new Set();for(let i=0;i<500;i++){const result=R.spawn(r,cells);assert.ok(result.ok);r=result.run;saw.add(result.effect.wanted);assert.ok(result.effect.reinforcements.length<=3);assert.ok(living(r).length<=cap);assert.equal(living(r).filter(m=>m.lord).length,B.forRun(r)?1:0);assert.ok(C.validateSave(JSON.stringify(r)));}assert.deepEqual([...saw].sort(),[1,2,3]);assert.equal(living(r).length,cap);assert.equal(R.spawn(r,cells).effect.reinforcements.length,0);}
});
test('defeating an enemy opens a cap slot; no lord respawn, reload preserves IDs and remaining health',()=>{
  let r=fresh(80);for(let i=0;i<10;i++)r=R.spawn(r,cells).run;const before=living(r);assert.equal(before.length,10);r=killByAttack(r,B.ID);const one=R.spawn(r,cells);assert.equal(one.effect.reinforcements.length,1);r=one.run;assert.equal(living(r).length,10);assert.equal(living(r).filter(m=>m.lord).length,0);const m=living(r).find(m=>m.reinforcement);r.party.health[m.id]=7;const saved=C.validateSave(JSON.stringify(r));assert.ok(saved);assert.deepEqual(living(saved).map(m=>m.id),living(r).map(m=>m.id));assert.equal(saved.party.health[m.id],7);assert.equal(R.spawn(saved,cells).effect.reinforcements.length,0);
});
test('reinforcement farming, collected and uncollected drops keep bounded, valid save data without resurrection',()=>{
  let r=fresh(59),kept=[];for(const m of living(r))kept.push(...defeat(r,m));
  for(let i=0;i<500;i++){r=R.spawn(r,cells).run;for(const m of living(r)){kept.push(...defeat(r,m));}assert.ok(r.defeatedMonsters.length<=112);assert.ok(r.party.loot.entries.length<=L.MAX_GROUND);assert.ok(r.party.reinforcements.monsters.length<=R.CAP);assert.ok(C.validateSave(JSON.stringify(r)));}
  const ids=new Set(r.party.loot.entries.map(e=>e.id));assert.ok(ids.size>20);assert.deepEqual(r.party.loot.entries.map(e=>e.id),kept.map(e=>e.id),'No existing uncollected pile is evicted');assert.equal(living(r).length,0);r=C.validateSave(JSON.stringify(r));assert.equal(living(r).length,0);
});
test('drops roll once per defeated monster, are deterministic and use descending rarity probabilities',()=>{
  // Ordinary monsters roll one candidate against its rarity; bosses (v1.58.7) always leave several piles instead.
  assert.deepEqual(L.CHANCES,{common:20,uncommon:12,rare:6,legendary:3});const samples=Object.fromEntries(Object.keys(L.CHANCES).map(k=>[k,{all:0,dropped:0}]));let gears=0;const piles={};
  for(let seed=1;seed<=3000;seed++){const r=fresh(90,seed),spec=P.monsterSpecs(r).find(m=>!m.lord&&!m.elite),prefix=r.floor+':'+spec.id,choices=L.pool(r,spec),pick=choices[L.hash(seed,prefix+':kind')%choices.length],out=defeat(r,spec);samples[pick.rarity].all++;samples[pick.rarity].dropped+=out.length?1:0;assert.ok(out.length<=1);assert.deepEqual(L.recordKill(r,spec,{x:2,y:3}),[]);const copy=fresh(90,seed);assert.deepEqual(defeat(copy,P.monsterSpecs(copy).find(m=>!m.lord&&!m.elite)),out);assert.ok(out.every(e=>e.cx===2&&e.cy===3));
    const lord=P.monsterSpecs(r).find(m=>m.lord),loot=defeat(r,lord);gears+=loot.some(e=>e.type==='gear')?1:0;piles[loot.length]=(piles[loot.length]||0)+1;assert.ok(loot.length>=2&&loot.length<=5,'a chapter lord leaves 2-5 piles');assert.equal(new Set(loot.map(e=>e.type+':'+e.key)).size,loot.length,'all different');}
  for(const [rarity,s]of Object.entries(samples))assert.ok(Math.abs(s.dropped/s.all-L.CHANCES[rarity]/100)<.04,rarity+': '+JSON.stringify(s));assert.ok(Math.abs(gears/3000-.5)<.02,'The seeded gear roll follows 50%, not an exact quota');
  assert.deepEqual(Object.keys(piles).map(Number).sort(),[2,3,4,5],'every count from two to five occurs');
});
test('physical loot claims are atomic, capacity-safe, exactly once and saved across shifts',()=>{
  let r=fresh(),entry;for(let seed=1;seed<500;seed++){r=fresh(90,seed);defeat(r,P.monsterSpecs(r).find(m=>m.lord));entry=r.party.loot.entries.find(e=>e.type==='gear');if(entry)break;}assert.ok(entry);const before=structuredClone(r.party.loot.entries);r=R.spawn(r,cells).run;assert.deepEqual(r.party.loot.entries,before);r=C.validateSave(JSON.stringify(r));for(let i=0;i<24;i++)r=C.grantGear(r,C.createGear('longsword',90,r.seed,'capacity-'+i)).run;const full=JSON.stringify(r);assert.equal(L.claim(r,entry.id).ok,false);assert.equal(JSON.stringify(r),full);r.gearBag.pop();const result=L.claim(r,entry.id);assert.ok(result.ok);assert.ok(result.run.gearBag.some(g=>g.id===entry.gear.id));assert.equal(L.claim(result.run,entry.id).ok,false);assert.ok(C.validateSave(result.run));
});
test('loot and reinforcement validation reject forged, duplicate, future and impossible save records',()=>{
  let r=R.spawn(fresh(),cells).run;assert.ok(C.validateSave(r));for(const change of [n=>n.party.reinforcements.monsters[0].id='monster-11',n=>n.party.reinforcements.monsters[0].kind='lord-cloud',n=>n.party.reinforcements.monsters[0].cx=999,n=>n.party.reinforcements.shift=0,n=>n.party.reinforcements.monsters.push({...n.party.reinforcements.monsters[0]})]){const n=structuredClone(r);change(n);assert.equal(C.validateSave(n),null);}
  const spec=living(r)[0];defeat(r,spec);const restored=C.validateSave(r);assert.ok(restored);const n=structuredClone(r);n.party.loot.rolled.push('monster-r-999-0');assert.equal(C.validateSave(n),null);r.expedition.active={};assert.equal(R.spawn(r,cells).ok,false);
});
test('personality sensing is floor-independent, aggressive predators hear but never bypass attack walls',()=>{
  assert.ok(S.profile(P.defs().hound).range>S.profile(P.defs().mushroom).range);for(const id of Object.keys(S.PERSONALITIES)){const def=P.defs()[id],p=S.profile(def);assert.ok(p.personality);assert.equal(S.detect(def,{distance:p.range+.1,line:true}),false);assert.equal(S.detect(def,{distance:p.range,line:true}),true);assert.equal(S.detect(def,{distance:4,line:false}),p.hearing);assert.equal(S.detect(def,{distance:4,line:true,hidden:true}),false);assert.equal(S.detect(def,{distance:1,line:true,hidden:true}),true);}const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');assert.match(source,/if\(m\.aim&&hasClearPath\(p\.x,p\.z,m\.aim\.x,m\.aim\.z\)\)launchBolt/);
});
test('headgear visibility is personal, persisted, cosmetic only and migrated without altering equipment',()=>{
  let r=provisionTravellers(fresh());r=P.recruit(r,P.recruitOffer(r).id).run;const id=r.party.members[0].id,before=H.stats(r,'hero'),gear=structuredClone(r.equipment);r=H.showHeadgear(r,'hero',false).run;assert.equal(H.actor(r,'hero').showHelmet,false);assert.equal(H.actor(r,id).showHelmet,true);assert.deepEqual(H.stats(r,'hero'),before);assert.deepEqual(r.equipment,gear);r=C.validateSave(JSON.stringify(r));r=H.switchActor(r,id).run;assert.equal(H.actor(r,'hero').showHelmet,false);P.advance(r);assert.equal(H.actor(r,'hero').showHelmet,false);assert.ok(C.validateSave(r));const old=structuredClone(r);delete H.actor(old,'hero').showHelmet;assert.equal(H.actor(C.validateSave(old),'hero').showHelmet,true);const bad=structuredClone(r);H.actor(bad).showHelmet='no';assert.equal(C.validateSave(bad),null);
});
test('the down-stair has a recessed floor aperture, descending steps and bounded original geometry',()=>{
  const m=St.build(T);assert.equal(m.userData.stairs,true);assert.ok(!m.userData.ring);assert.ok(m.children.length<30);const ys=m.children.filter(o=>o.geometry.parameters.width===1.66&&o.geometry.parameters.height===.16).map(o=>o.position.y);assert.equal(ys.length,7);assert.ok(ys.every((y,i)=>!i||y<ys[i-1]));const geo=St.floor(T,40,{x:12,z:12}),point=new T.Vector2(12,-12),p=geo.attributes.position;for(let i=0;i<geo.index.count;i+=3){const vs=[0,1,2].map(j=>new T.Vector2(p.getX(geo.index.getX(i+j)),p.getY(geo.index.getX(i+j))));const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),signs=vs.map((v,j)=>cross(v,vs[(j+1)%3],point));assert.ok(!signs.every(n=>n>0)&&!signs.every(n=>n<0),'No floor triangle covers the stair opening');}
});
test('original rich wall decoration is instanced, attached, collision-free and capped on phones',()=>{
  const walls=Array.from({length:60},(_,i)=>({inst:i,type:'h',minX:i*4,maxX:i*4+4,minZ:0,maxZ:.3,boundary:false}));for(const style of ['spire','garden','roots','echo','shelves','tide','frost','conduit','vents','orbit'])for(const quality of ['low','balanced']){const o={wallBoxes:walls,width:19,height:19,cell:4,wallHeight:4,style,quality,seed:23,rich:true,exitCell:{x:18,y:18}},p=A.plan(o),m=A.build(T,o);assert.ok(p.stats.drawCalls<=4);assert.ok(p.stats.wallSections<=(quality==='low'?28:48));assert.ok(p.relief.length<=100);let lights=0;m.wallRoot.traverse(n=>{if(n.isLight)lights++;});assert.equal(lights,0);assert.ok(!p.floor.some(n=>Math.abs(n.x-36)<.9&&Math.abs(n.z-36)<1.3));m.dispose();}
});
test('every lord has three distinct recorded lines, no missing audio and no auto-panel narration hijack',()=>{
  assert.equal(Object.keys(B.tracks).length,30);const voice=require('../assets/voice-pack.js');for(const [id,track]of Object.entries(B.tracks)){assert.equal(track.category,'character-bark');assert.ok(track.text);assert.ok(statSync(new URL('../'+track.src,import.meta.url)).size>3000,id);assert.equal(voice.tracks[id].text,track.text);}assert.equal(new Set(Object.values(B.tracks).map(t=>t.text)).size,30);
});
test('long character and lord names fit the original nameplate texture instead of clipping',()=>{
  const source=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=source.indexOf('function makeTextSprite(text'),end=source.indexOf('\n}',start)+2;
  let font='',paint=[];const ctx={set font(v){font=v;},get font(){return font;},measureText(text){return {width:text.length*parseInt(font.slice(5))};},strokeText(...args){paint.push(args);},fillText(...args){paint.push(args);}};
  const e=vm.createContext({THREE:T,document:{createElement:()=>({getContext:()=>ctx})}});vm.runInContext(source.slice(start,end),e);for(const name of ['劍士',...Object.values(B.LORDS).map(d=>d.name+' · '+d.strength+'/5')]){paint=[];vm.runInContext('makeTextSprite('+JSON.stringify(name)+')',e);assert.equal(paint.length,2);assert.equal(paint[0][0],name);assert.equal(paint[0][3],240);assert.ok(ctx.measureText(name).width<=240||parseInt(font.slice(5))===14);}
});
