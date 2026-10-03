import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),F=require('../story/tower-affixes.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
const guardSource=source.match(/    function guard\(m,dt\)\{[\s\S]*?(?=    function shift\()/)?.[0];assert.ok(guardSource);
function harness(){
 const run=H.enable(P.enable(C.newRun({seed:31}),'smith').run).run,m={...P.monsterSpecs(run)[0],model:{position:{x:0,z:0}},windup:.2,path:[1],aim:{x:0,z:0}},follows=[];
 const member={id:'ally-swordsman',profession:'swordsman',sex:'male',level:1,hp:34,cooldown:0,hurtLeft:0};run.party.members.push(member);run.party.joined.push(member.id);H.addMember(run,member);
 const env=vm.createContext({root:{TowerAffixes:F},H,P,modern:()=>true,live:()=>true,r:()=>run,actors:[{id:member.id,model:{position:{x:0,z:12}}}],heroes:{blocker:()=>false},ctx:{follow:(...args)=>follows.push(args)},guardVoiceLeft:1,records:()=>run.party.members});
 vm.runInContext(guardSource+'globalThis.guard=guard;',env);return {run,m,guard:env.guard,follows,member};
}
test('guard-held electric enemies cancel windup and cannot damage or chase a teammate',()=>{
 const h=harness();F.apply(h.run,h.m.id,'shock',{enemy:true});const before=JSON.stringify(h.run);assert.equal(h.guard(h.m,.2),true);assert.equal(h.m.windup,0);assert.equal(h.m.aim,null);assert.equal(h.follows.length,0);assert.equal(JSON.stringify(h.run),before);
});
test('taunted monsters still obey affix slow or rooting rather than bypassing control',()=>{
 for(const [key,scale]of [['slow',.7],['root',0]]){const h=harness();H.state(h.run).enemy[h.m.id]={tauntId:h.member.id,tauntLeft:5};F.apply(h.run,h.m.id,key,{enemy:true});assert.equal(h.guard(h.m,.1),true);assert.equal(h.follows.length,1);assert.equal(h.follows[0][2],(h.m.def.speed??2.1)*scale);}
});
test('active character meals use the same curse healing penalty as medicines and teammate healing',()=>{
 const r=H.enable(P.enable(C.newRun({seed:31}),'smith').run).run;r.party.meals.stew=1;H.setHp(r,'hero',10);F.apply(r,'hero','curse');const result=P.eat(r,'stew');assert.ok(result.ok,result.message);assert.equal(result.run.hp,10+P.RECIPES.stew.hp*.8);assert.equal(result.run.party.meals.stew,0);assert.ok(C.validateSave(result.run));
});
