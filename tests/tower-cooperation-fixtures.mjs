import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),G=require('../story/tower-hero-growth.js'),N=require('../story/tower-narrative.js'),D=require('../story/tower-dungeons.js'),Co=require('../story/tower-cooperation-core.js');
export function ownSkill(run,id,key){const a=H.actor(run,id),job=H.job(run,id);let draw;for(let seed=1;seed<10000;seed++){draw=H.draft(seed,job,job);if(draw.skills.includes(key))break;}assert.ok(draw.skills.includes(key));a.skills=[...draw.skills];a.passives=Object.values(H.PASSIVES).filter(p=>p.job===job&&!p.unique&&!['ingredient_care','care','recovery'].includes(p.id)).slice(0,2).map(p=>p.id);a.cooldowns=Object.fromEntries(a.skills.map(k=>[k,0]));a.learned=null;G.record(run,id).choices=[];}
export function add(run,job,key,id='ally-'+job){const m={id,profession:job,sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(m);run.party.joined.push(id);H.addMember(run,m);ownSkill(run,id,key);return id;}
export function fixture(key,under=Co.DEFINITIONS.find(d=>d.id===key).underground){const def=Co.DEFINITIONS.find(d=>d.id===key);let run=H.enable(P.enable(C.newRun({seed:53,name:'合作測試'}),def.participants[0].job).run).run;
  if(under){run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);run.chronicle.ending='release';run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);P.advance(run,{reward:false});const v=C.startUnderworld(run);assert.ok(v.ok,v.message);run=v.run;}
  ownSkill(run,'hero',def.participants[0].skill);const ids=['hero',...def.participants.slice(1).map(p=>add(run,p.job,p.skill))];
  for(const k of Object.keys(run.party.ingredients))run.party.ingredients[k]=20;run.bag.arrow=50;run.party.journey.scrap=20;
  const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:i*.8,z:0}])),monster=P.monsterSpecs(run)[0],monsters=[{id:monster.id,alive:true,x:0,z:2.5}];
  if(def.formation.kind==='front'){for(const id of ids)positions[id]={x:0,z:0};positions[ids[def.formation.front]]={x:0,z:1.2};}
  if(def.formation.kind==='pincer'){positions[ids[0]]={x:-1,z:1};positions[ids[1]]={x:1,z:1};monsters[0]={...monsters[0],x:0,z:1};}
  if(def.effect.injured)for(const id of ids)H.setHp(run,id,Math.max(1,H.maxHp(run,id)-20));
  if(def.effect.mechanicalHealPercent){const id=ids[def.effect.targetMember];H.setHp(run,id,Math.max(1,H.maxHp(run,id)-30));H.equipment(run,id).armor.durability-=10;}
  const space={ready:true,positions,monsters,clear:()=>true,blocked:[]};assert.ok(C.validateSave(run),'fixture should be saveable');return {run,space,ids,def};
}
