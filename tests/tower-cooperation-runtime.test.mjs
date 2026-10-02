import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {C,H,Co,fixture} from './tower-cooperation-fixtures.mjs';
const require=createRequire(import.meta.url),I=require('../story/tower-heroes-icons.js'),source=readFileSync(new URL('../story/tower-cooperation-runtime.js',import.meta.url),'utf8');
function harness(key='thunder_blades'){
  const f=fixture(key);let run=f.run,ready=true,accept=true,clear=true,visible=true,saves=0;const busy=new Set(),nodes={},sounds=[],glows=[],motions=[],hits=[],toasts=[];
  const element=()=>({hidden:false,innerHTML:'',listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(){},appendChild(el){nodes[el.id]=el;}});nodes.gameScreen=element();
  const world=f.space.monsters.map(m=>({...m,model:{position:{x:m.x,z:m.z},rotation:{y:0}}}));
  const sandbox={TowerHeroes:H,TowerCooperation:Co,TowerHeroIcons:I,document:{createElement:element,getElementById:id=>nodes[id]}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
  const ui=sandbox.TowerCooperationRuntime.create({run:()=>run,ready:()=>ready,pos:id=>f.space.positions[id],clear:()=>clear,visible:()=>visible,busy:id=>busy.has(id),monsters:()=>world,
    text:String,toast:(...args)=>toasts.push(args),motion:(...args)=>motions.push(args),glow:(...args)=>{const id=glows.length;glows.push(args);return id;},sound:(...args)=>{sounds.push(args);return ()=>{};},cancelGlow(){},cancelMotion(){},cancelTarget(){},clearSlow(){},save(){saves++;},
    transact:result=>{if(!accept||!result.ok)return false;run=result.run;return true;},hit:(m,id,skill)=>{assert.equal(ui.preparing(id),null,'hit cannot be blocked by its own preparation');const result=H.strike(run,m.id,{memberId:id,skillId:skill},run.revision);assert.ok(result.ok,result.message);run=result.run;hits.push(result.effect);if(result.effect.dead)m.alive=false;return result;}});
  ui.install();return {f,ui,nodes,sandbox,sounds,glows,motions,hits,toasts,get run(){return run;},get saves(){return saves;},setReady:value=>ready=value,setAccept:value=>accept=value,setClear:value=>clear=value,setVisible:value=>visible=value,busy,world,finish(){for(let i=0;i<15;i++)ui.tick(.1);}};
}
test('real runtime offers a two-person combo, charges once and applies real hits with sound and light',()=>{
  const h=harness();h.ui.hud();assert.equal(h.nodes.heroCooperationBar.hidden,false);assert.match(h.nodes.heroCooperationBar.innerHTML,/data-cooperation="thunder_blades"/);const before=structuredClone(h.run);
  assert.equal(h.ui.start('thunder_blades'),true);assert.ok(h.ui.preparing('hero'));assert.equal(h.ui.start('thunder_blades'),false);assert.deepEqual(h.run,before);h.finish();
  assert.equal(h.ui.preparing('hero'),null);assert.ok(h.hits.length>=1);assert.ok(h.sounds.length>=4);assert.ok(h.glows.length>=4);assert.ok(h.saves);assert.ok(C.validateSave(h.run));assert.ok(h.toasts.some(v=>v[0].includes('合作成功')));assert.doesNotMatch(h.nodes.heroCooperationBar.innerHTML,/data-cooperation="thunder_blades"/);
});
test('three-person underground runtime releases native taunt, binding and arrow skills',()=>{
  const h=harness('dawn_breach');h.world[0].windup=1;assert.ok(h.ui.start('dawn_breach'));assert.ok(h.f.ids.every(id=>h.ui.preparing(id)));h.finish();assert.ok(h.hits.length);assert.equal(h.world[0].windup,0);assert.equal(h.run.bag.arrow,h.f.run.bag.arrow-1);assert.ok(h.sounds.length>=6);assert.ok(C.validateSave(h.run));
});
test('support runtime produces real recovery and shields without inventing attacks',()=>{
  const h=harness('warm_radiance'),before=H.hp(h.run,'hero');assert.ok(h.ui.start('warm_radiance'));h.finish();assert.ok(H.hp(h.run,'hero')>before);assert.ok(H.buff(h.run,'barrier','hero'));assert.equal(h.hits.length,0);assert.equal(h.run.party.ingredients.herb,18);assert.equal(h.run.party.ingredients.root,19);assert.ok(C.validateSave(h.run));
});
test('movement, pause, shift-like readiness, wall, lost actor and competing cast cancel without payment',()=>{
  for(const cancel of [h=>h.f.space.positions.hero.x+=1,h=>h.setReady(false),h=>h.setClear(false),h=>delete h.f.space.positions[h.f.ids[1]],h=>h.busy.add(h.f.ids[1]),h=>H.setHp(h.run,h.f.ids[1],0),h=>h.setVisible(false)]){
    const h=harness('cross_hunt');assert.ok(h.ui.start('cross_hunt'));cancel(h);const before=structuredClone(h.run);h.finish();assert.equal(h.ui.preparing('hero'),null);assert.deepEqual(h.run,before);assert.equal(h.hits.length,0);assert.equal(h.saves,0);
  }
});
test('explicit cancel and failed persistence cannot partially consume resources',()=>{
  for(const mode of ['cancel','save-failure']){const h=harness('warm_radiance'),before=structuredClone(h.run);assert.ok(h.ui.start('warm_radiance'));if(mode==='cancel')h.ui.cancel();else h.setAccept(false);h.finish();assert.deepEqual(h.run,before);assert.equal(h.saves,0);assert.equal(h.ui.preparing('hero'),null);}
});
test('reset removes stale controls and ready checks reject all hidden buttons',()=>{
  const h=harness();h.ui.hud();h.ui.start('thunder_blades');h.ui.reset();assert.equal(h.nodes.heroCooperationBar.hidden,true);assert.equal(h.nodes.heroCooperationBar.innerHTML,'');h.setReady(false);assert.equal(h.ui.start('thunder_blades'),false);h.ui.hud();assert.equal(h.nodes.heroCooperationBar.hidden,true);assert.equal(h.saves,0);
});
test('catalog and battle use the same single SVG composed only of actual constituent icons',()=>{
  const h=harness();for(const d of Co.DEFINITIONS){const svg=h.sandbox.TowerCooperationRuntime.icon(d.id);assert.equal((svg.match(/<svg\b/g)||[]).length,1);assert.ok(d.iconKeys.every(k=>svg.includes(I.svg(k).replace(/^<svg[^>]*>|<\/svg>$/g,''))));assert.doesNotMatch(svg,/http[^" ]*\.(png|webp)|<image|<script/);}
  h.ui.hud();assert.ok(h.nodes.heroCooperationBar.innerHTML.includes(h.sandbox.TowerCooperationRuntime.icon('thunder_blades')));assert.equal(h.sandbox.TowerCooperationRuntime.icon('unknown'),'');
});
