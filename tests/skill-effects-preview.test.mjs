import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url),THREE=require('../lib/three.min.js'),html=readFileSync(new URL('../docs/技能光影預覽.html',import.meta.url),'utf8');
function setup(reduced=false){
  const elements=new Map(),raf=new Map(),events=new Map();let time=0,next=0,disposed=0;
  function element(tag='div'){
    const node={tag,children:[],dataset:{},attrs:{},listeners:{},textContent:'',innerHTML:'',value:'',checked:false,hidden:false,disabled:false};
    Object.defineProperty(node,'options',{get(){return node.children;}});node.appendChild=child=>{node.children.push(child);return child;};node.append=(...children)=>node.children.push(...children);node.replaceChildren=(...children)=>{node.children=children;};node.setAttribute=(key,value)=>{node.attrs[key]=value;};node.addEventListener=(key,fn)=>{node.listeners[key]=fn;};node.getBoundingClientRect=()=>({width:844,height:230});return node;
  }
  for(const id of ['stage','choices','skill-select','play','auto','caption','description','count','error','replay','select-label'])elements.set(id,element(id==='skill-select'?'select':'div'));
  const env=vm.createContext({THREE:{...THREE,WebGLRenderer:class{setPixelRatio(){}setSize(){}render(){}dispose(){disposed++;}}},devicePixelRatio:2,matchMedia:()=>({matches:reduced}),performance:{now:()=>time},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{raf.set(++next,fn);return next;},cancelAnimationFrame:id=>raf.delete(id)});
  env.window=env;env.addEventListener=(key,fn)=>events.set(key,fn);env.removeEventListener=(key,fn)=>{if(events.get(key)===fn)events.delete(key);};env.document={hidden:false,getElementById:id=>elements.get(id),createElement:element,addEventListener:env.addEventListener,removeEventListener:env.removeEventListener};
  const refs=[...html.matchAll(/<script src="([^"]+)"/g)].map(match=>match[1]);for(const ref of refs){if(ref.includes('three.min.js'))continue;vm.runInContext(readFileSync(new URL('../docs/'+ref.split('?')[0],import.meta.url),'utf8'),env,{filename:ref});}
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(inline.length,1);vm.runInContext(inline[0][1],env,{filename:'skill-effects-preview-inline'});
  return {env,elements,refs,events,raf,get disposed(){return disposed;},frame(ms=50){time+=ms;const row=raf.entries().next().value;assert.ok(row);raf.delete(row[0]);row[1](time);},click(id){elements.get(id).listeners.click();}};
}

test('skill preview loads real catalog dependencies, offers nine professions and every current active skill without the removed daylight skill',()=>{
  const f=setup(),H=f.env.TowerHeroes,all=Object.values(H.SKILLS),preview=f.env.skillPreview;assert.equal(all.length,81);assert.equal(preview.skills.length,all.length);assert.equal(f.elements.get('choices').children.length,Object.keys(H.JOBS).length);assert.equal(f.elements.get('count').textContent,'9 職業 · 81 招');assert.equal(preview.skills.includes('daylight'),false);
  for(const skill of all){assert.equal(preview.selectSkill(skill.id),true);assert.equal(preview.current,skill.id);assert.equal(f.elements.get('skill-select').value,skill.id);assert.equal(f.elements.get('skill-select').options.length,all.filter(row=>row.job===skill.job).length);assert.ok(f.elements.get('skill-select').options.every(option=>H.SKILLS[option.value].job===skill.job));assert.ok(preview.stats().groups>0,skill.id+' emits actual game effects');assert.equal(f.elements.get('description').textContent,skill.description);assert.ok(f.env.TowerHeroIcons.svg(skill.id),skill.id+' has game icon');}
  assert.equal(preview.selectSkill('daylight'),false);assert.equal(preview.show(-1),false);assert.equal(preview.show(0),true);assert.equal(preview.current,all[0].id);preview.destroy();
});

test('each profession card selects its live representative, and replay/pause controls truly freeze the effect timeline',()=>{
  const f=setup(),preview=f.env.skillPreview;
  for(const button of f.elements.get('choices').children){button.listeners.click();assert.equal(preview.current,preview.representatives[button.dataset.job]);assert.equal(button.attrs['aria-pressed'],'true');assert.ok(button.children[0].innerHTML.includes('<svg'));}
  f.click('play');assert.equal(preview.paused,true);const before=preview.stats();for(let i=0;i<100;i++)f.frame();assert.deepEqual(preview.stats(),before);assert.equal(f.elements.get('play').textContent,'繼續動畫');f.click('play');for(let i=0;i<100;i++)f.frame();assert.equal(preview.stats().groups,0);
  f.click('replay');assert.equal(preview.paused,false);assert.equal(preview.stats().groups,1);f.elements.get('auto').checked=true;const current=preview.current;for(let i=0;i<66;i++)f.frame();assert.notEqual(preview.current,current);preview.destroy();
});

test('preview stays silent and isolated, supports reduced motion and releases the renderer and shared effects on exit',()=>{
  assert.doesNotMatch(html,/localStorage|sessionStorage|\bfetch\s*\(|WebSocket|AudioContext|new\s+Audio\b/);assert.match(html,/靶柱不是角色造型/);assert.match(html,/目前靜音/);assert.match(html,/min-height:44px/);assert.match(html,/tower-skill-effects\.js\?v=1\.60\.0/);
  const f=setup(true);assert.equal(f.env.skillPreview.reducedMotion,true);assert.ok(f.env.skillPreview.stats().particles<=12);f.events.get('pagehide')({persisted:true});assert.equal(f.disposed,0);f.events.get('pagehide')({persisted:false});assert.equal(f.disposed,1);assert.equal(f.raf.size,0);assert.equal(f.env.skillPreview.stats().groups,0);assert.equal(f.env.skillPreview.stats().textureBytes,0);assert.equal(f.env.skillPreview.destroy(),false);
});
