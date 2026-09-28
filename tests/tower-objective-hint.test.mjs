import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const factory=source.slice(source.indexOf('  function createObjectiveHint('),source.indexOf('  function setHudExpanded('));
class Target {
  listeners=new Map();attributes={};captures=new Set();hidden=true;writes=0;
  addEventListener(name,callback){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(callback);}
  setAttribute(name,value){this.attributes[name]=value;this.writes++;}
  removeAttribute(name){delete this.attributes[name];}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.emit('lostpointercapture',{pointerId:id});}
  emit(name,values={}){const e={button:0,pointerId:1,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};for(const f of this.listeners.get(name)||[])f(e);return e;}
}
function fixture(){
  const window=new Target(),document=new Target(),control=new Target(),panel=new Target();document.hidden=false;panel.id='towerObjective';
  let available=true,now=0;const context=vm.createContext({window,document,performance:{now:()=>now}});vm.runInContext(factory,context);
  const actual=context.createObjectiveHint(control,panel,()=>available),ui={...actual,tick:seconds=>{now+=seconds*1000;actual.tick();}};ui.enter();
  return {window,document,control,panel,ui,elapse:seconds=>{now+=seconds*1000;},set available(value){available=value;}};
}
test('objective appears for exactly three active seconds; text changes do not reopen it',()=>{
  const h=fixture();assert.equal(h.panel.hidden,false);assert.equal(h.control.attributes['aria-expanded'],'true');
  h.ui.tick(1);h.ui.tick(1.9);assert.equal(h.panel.hidden,false);h.ui.tick(.1);assert.equal(h.panel.hidden,true);
  h.panel.textContent='已取得回聲銅扣，尋找出口';h.ui.tick(1);assert.equal(h.panel.hidden,true);
});
test('reading the opening pauses the three-second preview instead of consuming it behind the dialog',()=>{
  const h=fixture();h.available=false;h.ui.suspend();h.ui.tick(30);assert.equal(h.panel.hidden,true);
  h.available=true;h.ui.refresh();h.ui.tick(2);assert.equal(h.panel.hidden,false);h.ui.tick(1);assert.equal(h.panel.hidden,true);
});
test('slow rendering does not stretch the preview beyond three real seconds',()=>{
  const h=fixture();h.elapse(2.95);h.ui.tick(.05);assert.equal(h.panel.hidden,true);
});
test('pointer hold survives the preview timeout, and release outside the control hides immediately',()=>{
  const h=fixture(),e=h.control.emit('pointerdown');assert.equal(e.prevented,true);assert.equal(e.stopped,true);assert.ok(h.control.captures.has(1));
  h.ui.tick(20);assert.equal(h.panel.hidden,false);h.window.emit('pointerup');assert.equal(h.panel.hidden,true);assert.equal(h.control.captures.size,0);
  h.ui.tick(.1);assert.equal(h.panel.hidden,true);h.control.emit('click');assert.equal(h.panel.hidden,true);
});
test('second-finger touch can peek while moving; an unrelated finger release cannot close it',()=>{
  const h=fixture();h.ui.tick(3);h.control.emit('pointerdown',{pointerId:8,isPrimary:false,pointerType:'touch'});
  h.window.emit('pointerup',{pointerId:2});assert.equal(h.panel.hidden,false);
  h.control.emit('pointerdown',{pointerId:9});h.window.emit('pointerup',{pointerId:9});assert.equal(h.panel.hidden,false);
  h.window.emit('pointerup',{pointerId:8});assert.equal(h.panel.hidden,true);
});
test('touch cancel or lost capture releases the hint without leaving a stuck overlay',()=>{
  for(const kind of ['pointercancel','lostpointercapture']){const h=fixture();h.control.emit('pointerdown');h.control.emit(kind);assert.equal(h.panel.hidden,true);h.ui.tick(.1);assert.equal(h.panel.hidden,true);}
});
test('Space and Enter are hold-only and do not bubble into game actions',()=>{
  for(const code of ['Space','Enter']){const h=fixture();h.ui.tick(3);const e=h.control.emit('keydown',{code});assert.equal(e.stopped,true);assert.equal(e.prevented,true);
    h.control.emit('keydown',{code,repeat:true});h.ui.tick(6);assert.equal(h.panel.hidden,false);h.window.emit('keyup',{code});assert.equal(h.panel.hidden,true);}
});
test('blur, dialog suspension, and hidden document cancel held input without reopening on return',()=>{
  for(const kind of ['blur','dialog','hidden']){const h=fixture();h.control.emit('pointerdown');
    if(kind==='blur')h.window.emit('blur');else if(kind==='dialog'){h.available=false;h.ui.suspend();}else{h.document.hidden=true;h.document.emit('visibilitychange');}
    assert.equal(h.panel.hidden,true);h.ui.tick(4);h.available=true;h.document.hidden=false;h.document.emit('visibilitychange');h.window.emit('focus');h.ui.tick(.1);assert.equal(h.panel.hidden,true);}
  const h=fixture();h.control.emit('keydown',{code:'Space'});h.control.emit('blur');assert.equal(h.panel.hidden,true);
});
test('stopping restores a noninteractive round label; re-entry gets one fresh preview',()=>{
  const h=fixture();h.control.emit('pointerdown');h.ui.stop();assert.equal(h.panel.hidden,true);assert.equal(h.control.tabIndex,-1);assert.equal(h.control.attributes.role,undefined);
  assert.equal(h.control.emit('pointerdown').prevented,false);h.ui.tick(10);assert.equal(h.panel.hidden,true);
  h.ui.enter();assert.equal(h.control.tabIndex,0);assert.equal(h.panel.hidden,false);h.ui.tick(3);assert.equal(h.panel.hidden,true);
});
test('unchanged hidden state has no per-frame attribute churn, and display rules honor hidden',()=>{
  const h=fixture();h.ui.tick(3);const writes=h.control.writes;for(let i=0;i<120;i++)h.ui.tick(1/60);assert.equal(h.control.writes,writes);
  const css=readFileSync(new URL('../assets/game-polish.css',import.meta.url),'utf8');assert.match(css,/#towerObjective\[hidden\]\s*\{\s*display:none!important/);
  assert.match(source,/objectiveHint\?\.enter\(\)/);assert.match(source,/objectiveHint\?\.stop\(\)/);
});
