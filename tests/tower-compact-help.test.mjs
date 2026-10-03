import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),Help=require('../story/tower-compact-help.js');
class Element{
  constructor(attributes={},parent=null){this.attributes={...attributes};this.parent=parent;this.children=[];this.hidden=false;this.focused=0;if(parent)parent.children.push(this);}
  hasAttribute(name){return Object.hasOwn(this.attributes,name);}
  setAttribute(name,value){this.attributes[name]=value;}
  matches(selector){return selector==='.tower-compact-help'?this.attributes.class==='tower-compact-help':selector==='.tower-help-copy'?this.attributes.class==='tower-help-copy':selector==='#towerDialog'?this.attributes.id==='towerDialog':selector.startsWith('[')&&this.hasAttribute(selector.slice(1,-1));}
  closest(selector){for(let e=this;e;e=e.parent)if(selector.split(',').some(s=>e.matches(s)))return e;return null;}
  querySelectorAll(selector){return this.children.flatMap(e=>[...(e.matches(selector)?[e]:[]),...e.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){this.focused++;}
}
function fixture(){
  const document=new Element(),listeners=new Map();document.addEventListener=(type,fn)=>{const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);};document.removeEventListener=(type,fn)=>listeners.get(type)?.delete(fn);
  const modal=new Element({id:'towerDialog'},document);modal.voiceSpeaker={identity:'merchant.tieLing',gender:'male',npc:true};
  const wrappers=[1,2].map(n=>{const wrapper=new Element({class:'tower-compact-help'},modal),button=new Element({'data-tower-help-toggle':'','aria-expanded':'false'},wrapper),panel=new Element({'data-tower-help-panel':''},wrapper),close=new Element({'data-tower-help-close':''},panel),read=new Element({'data-tower-help-read':''},panel),copy=new Element({class:'tower-help-copy'},panel);panel.hidden=true;copy.textContent='完整原文 '+n+'；修理加20%，材料不加價。';return {wrapper,button,panel,close,read,copy};});
  const read=[],stop=[];const dispose=Help.install(document,{read:p=>read.push(p),stop:p=>stop.push(p)});
  const emit=(type,target,other={})=>{const e={target,prevented:false,stopped:false,immediate:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;},...other};for(const fn of listeners.get(type)||[])fn(e);return e;};
  return {document,modal,wrappers,read,stop,listeners,dispose,emit};
}
test('read-only help renderer needs no DOM, game state, timers, storage or network',()=>{
  const source=readFileSync(new URL('../story/tower-compact-help.js',import.meta.url),'utf8'),context=vm.createContext({});
  for(const key of ['document','localStorage','fetch','setTimeout','setInterval','requestAnimationFrame'])Object.defineProperty(context,key,{get(){throw Error('Unexpected '+key);}});
  vm.runInContext(source,context);const html=context.TowerCompactHelp.render('維護規則','<p>保留完整說明</p>');assert.match(html,/data-tower-help-toggle/);assert.match(html,/保留完整說明/);assert.doesNotMatch(html,/data-tower=|<dialog/);
});
test('closed question button has an accessible label and explicit controlled hidden region',()=>{
  const html=Help.render('維護<規則>','<p>完整20%費率</p>',{id:'a" bad'});assert.match(html,/aria-label="維護&lt;規則&gt;"/);assert.match(html,/aria-expanded="false" aria-controls="a--bad"/);assert.match(html,/id="a--bad"[^>]* hidden role="region"/);assert.match(html,/>\?<\/span>/);assert.match(html,/朗讀維護&lt;規則&gt;/);assert.match(html,/<p>完整20%費率<\/p>/);
});
test('opening help leaves its parent modal untouched and opening another collapses only earlier help',()=>{
  const f=fixture(),[a,b]=f.wrappers,e=f.emit('click',a.button);assert.ok(e.prevented&&e.stopped);assert.equal(a.panel.hidden,false);assert.equal(a.button.attributes['aria-expanded'],'true');assert.equal(a.panel.focused,1);assert.equal(f.modal.hidden,false);
  f.emit('click',b.button);assert.equal(a.panel.hidden,true);assert.equal(a.button.attributes['aria-expanded'],'false');assert.equal(b.panel.hidden,false);assert.equal(f.modal.hidden,false);f.emit('click',b.button);assert.equal(b.panel.hidden,true);
});
test('Escape closes help, restores question focus and never closes the main modal',()=>{
  const f=fixture(),a=f.wrappers[0];assert.equal(f.emit('keydown',a.button,{key:'Escape'}).stopped,false);f.emit('click',a.button);const e=f.emit('keydown',a.panel,{key:'Escape'});assert.ok(e.prevented&&e.stopped&&e.immediate);assert.equal(a.panel.hidden,true);assert.equal(a.button.focused,1);assert.equal(f.modal.hidden,false);assert.equal(f.emit('keydown',a.button,{key:'Escape'}).stopped,false);
});
test('manual reading uses just the full original explanation with the current panel speaker',()=>{
  const f=fixture(),a=f.wrappers[0];f.emit('click',a.read);assert.equal(f.read.length,0);f.emit('click',a.button);f.emit('click',a.read);assert.equal(f.read.length,1);assert.equal(a.panel.voiceText,a.copy.textContent);assert.equal(a.panel.voiceScope,'full');assert.equal(a.panel.voiceAsset,'');assert.deepEqual(a.panel.voiceSpeaker,f.modal.voiceSpeaker);f.emit('click',a.close);assert.equal(a.panel.hidden,true);assert.equal(a.button.focused,1);assert.equal(f.stop.length,1);
});
test('unrelated actions are not consumed; installation is idempotent and removable',()=>{
  const f=fixture(),trade=new Element({'data-tower':'buy'},f.modal),e=f.emit('click',trade);assert.ok(!e.prevented&&!e.stopped);const second=[];assert.equal(Help.install(f.document,{read:p=>second.push(p)}),f.dispose);assert.equal(f.listeners.get('click').size,1);assert.equal(f.listeners.get('keydown').size,1);f.emit('click',f.wrappers[0].button);f.emit('click',f.wrappers[0].read);assert.equal(second.length,1);assert.equal(f.read.length,0);f.dispose();assert.equal(f.listeners.get('click').size,0);assert.equal(f.listeners.get('keydown').size,0);assert.equal(f.wrappers[0].panel.hidden,true);
});
test('touch target remains 44px and the folded panel cannot be exposed by generic layout CSS',()=>{
  const css=readFileSync(new URL('../story/tower-party.css',import.meta.url),'utf8');assert.match(css,/\.tower-help-toggle[^}]*min-width:44px;min-height:44px/);assert.match(css,/\.tower-help-panel\[hidden\]\{display:none!important\}/);assert.match(css,/\.tower-help-panel[^}]*overflow:auto/);assert.match(css,/\.tower-help-toggle:focus-visible/);
});
test('forge effect explanations are optional but material costs and forbidden-action reasons remain outside help',()=>{
  const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8'),forge=source.slice(source.indexOf('    function forgePanel('),source.indexOf('    function workMarkup('));
  assert.match(forge,/costLine\(q\.materialCost,true\)\+help\(q\.name\+'效果說明'/);assert.match(forge,/help\('維護與強化規則'/);assert.match(forge,/forge-trait-warning/);assert.match(forge,/party-mend-ask/);assert.match(forge,/party-mend-all-ask/);assert.doesNotMatch(forge,/forge-trait-guide/);
});
