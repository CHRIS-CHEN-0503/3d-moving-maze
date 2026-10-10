import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {C,H,Co,fixture} from './tower-cooperation-fixtures.mjs';
const require=createRequire(import.meta.url),I=require('../story/tower-heroes-icons.js'),source=readFileSync(new URL('../story/tower-cooperation-runtime.js',import.meta.url),'utf8');
// Same shape as the existing runtime harness, plus a real assemble hook and movable positions.
function harness(key='thunder_blades'){
  const f=fixture(key);let run=f.run,ready=true,assembled=[];const nodes={},hits=[],toasts=[];
  const element=()=>({hidden:false,innerHTML:'',listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(){},appendChild(el){nodes[el.id]=el;},contains:()=>true});nodes.gameScreen=element();
  const world=f.space.monsters.map(m=>({...m,model:{position:{x:m.x,z:m.z},rotation:{y:0}}}));
  const sandbox={TowerHeroes:H,TowerCooperation:Co,TowerHeroIcons:I,document:{createElement:element,getElementById:id=>nodes[id]}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
  const ui=sandbox.TowerCooperationRuntime.create({run:()=>run,ready:()=>ready,pos:id=>f.space.positions[id],clear:()=>true,visible:()=>true,busy:()=>false,monsters:()=>world,assemble:(ids,definition)=>{assembled.push({ids,definition:definition.id});return true;},
    text:String,toast:(...args)=>toasts.push(args[0]),motion(){},glow:()=>0,sound:()=>()=>{},cancelGlow(){},cancelMotion(){},cancelTarget(){},clearSlow(){},save(){},
    transact:result=>{if(!result.ok)return false;run=result.run;return true;},hit:(m,id,skill)=>{const result=H.strike(run,m.id,{memberId:id,skillId:skill},run.revision);assert.ok(result.ok,result.message);run=result.run;hits.push(result.effect);if(result.effect.dead)m.alive=false;return result;}});
  ui.install();return {f,ui,nodes,hits,toasts,assembled,world,get run(){return run;},steps(n){for(let i=0;i<n;i++)ui.tick(.1);}};
}
test('a tap that lands after the line broke locks the combo: the AI partner is assembled, reserved, and the combo fires itself once the formation holds',()=>{
  const h=harness(),ally=h.f.ids[1],home={...h.f.space.positions[ally]};h.f.space.positions[ally]={x:7,z:0};
  assert.equal(h.ui.start('thunder_blades'),false);assert.equal(h.ui.gathering(),'thunder_blades');assert.deepEqual(h.assembled[0],{ids:['hero',ally],definition:'thunder_blades'});assert.ok(h.ui.reserved(ally));assert.ok(!h.ui.reserved('nobody'));assert.ok(h.toasts.some(t=>t.includes('就位')));
  h.ui.hud();assert.match(h.nodes.heroCooperationBar.innerHTML,/cancel-gather/);assert.match(h.nodes.heroCooperationBar.innerHTML,/就位中/);
  h.steps(5);assert.equal(h.ui.gathering(),'thunder_blades','still waiting while the partner walks');assert.equal(h.ui.preparing('hero'),null);
  h.f.space.positions[ally]=home;h.steps(1);assert.equal(h.ui.gathering(),null);assert.ok(h.ui.preparing('hero'),'auto-started once the formation held');assert.ok(h.ui.reserved(ally));
  h.steps(40);assert.ok(h.hits.length>=1);assert.ok(h.toasts.some(t=>t.includes('合作成功')));assert.ok(C.validateSave(h.run));
});
test('the lock expires after eight seconds without a formation, can be cancelled from the bar, and never pays anything',()=>{
  const h=harness(),ally=h.f.ids[1];h.f.space.positions[ally]={x:7,z:0};const before=JSON.stringify(h.run);
  assert.equal(h.ui.start('thunder_blades'),false);h.steps(83);assert.equal(h.ui.gathering(),null);assert.ok(h.toasts.some(t=>t.includes('時限')));assert.equal(JSON.stringify(h.run),before);
  assert.equal(h.ui.start('thunder_blades'),false);assert.equal(h.ui.gathering(),'thunder_blades');h.nodes.heroCooperationBar.listeners.click({target:{closest:()=>({dataset:{cooperation:'cancel-gather'},disabled:false})}});assert.equal(h.ui.gathering(),null);assert.equal(JSON.stringify(h.run),before);
});
test('a small hero drift keeps the charge, a long one cancels it, and the monster may drift up to the release tolerance',()=>{
  let h=harness();assert.ok(h.ui.start('thunder_blades'));h.f.space.positions.hero.x+=.9;h.steps(1);assert.ok(h.ui.preparing('hero'),'0.9 m is within the new tolerance');h.steps(40);assert.ok(h.hits.length>=1);
  h=harness();assert.ok(h.ui.start('thunder_blades'));h.f.space.positions.hero.x+=1.2;h.steps(1);assert.equal(h.ui.preparing('hero'),null,'1.2 m cancels');assert.ok(h.toasts.some(t=>t.includes('取消')));assert.equal(h.hits.length,0);
  h=harness();assert.ok(h.ui.start('thunder_blades'));h.world[0].model.position.z=4;h.steps(45);assert.ok(h.hits.length>=1,'monster 0.5 m beyond the 3.5 m range still gets hit at release');
  h=harness();assert.ok(h.ui.start('thunder_blades'));h.world[0].model.position.z=5.2;h.steps(45);assert.equal(h.hits.length,0,'well beyond the tolerance the charge is cancelled without payment');assert.ok(C.validateSave(h.run));
});
