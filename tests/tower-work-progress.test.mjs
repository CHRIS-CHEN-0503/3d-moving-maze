import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const T=require('../lib/three.min.js'),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),X=require('../story/tower-expedition-core.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');

// A small DOM implementation keeps these tests on the real workHud/install path.
// Only actual work progress nodes are materialized; unrelated HUD nodes are absent.
function documentStub(){
  const nodes=new Map();
  function element(tag='div'){
    const node={tagName:tag.toUpperCase(),hidden:false,children:[],attributes:{},textContent:'',value:0,max:100,parts:{},
      setAttribute(key,value){this.attributes[key]=String(value);},
      getAttribute(key){return this.attributes[key]??null;},
      appendChild(child){this.children.push(child);child.parentNode=this;if(child.id)nodes.set(child.id,child);return child;},
      prepend(child){this.children.unshift(child);child.parentNode=this;if(child.id)nodes.set(child.id,child);},
      querySelector(selector){return this.parts[selector]||null;},
    };
    Object.defineProperty(node,'innerHTML',{get(){return this.markup||'';},set(markup){
      this.markup=markup;
      for(const [selector,pattern] of [['[data-work-name]',/<span data-work-name>(.*?)<\/span>/],['[data-work-state]',/<small data-work-state>(.*?)<\/small>/]]){
        const match=markup.match(pattern);if(match){const child=element(selector.includes('name')?'span':'small');child.textContent=match[1];this.parts[selector]=child;}
      }
      const match=markup.match(/<progress\b[^>]*value="([^"]+)"[^>]*aria-label="([^"]+)"/);
      if(match){const child=element('progress');child.value=Number(match[1]);child.setAttribute('aria-label',match[2]);this.parts.progress=child;}
    }});
    return node;
  }
  const left=element();left.id='towerLeftHud';nodes.set(left.id,left);
  const objective=element();objective.id='towerObjective';objective.hidden=true;objective.textContent='按住劇情才顯示主線';nodes.set(objective.id,objective);
  return {getElementById:id=>nodes.get(id)||null,createElement:element,nodes,left,objective,hidden:false};
}

const siteSeeds={};
const siteJobs=Object.keys(X.SITES);
for(let seed=1;seed<200&&Object.keys(siteSeeds).length<siteJobs.length;seed++){
  const run=P.enable(C.newRun({seed}),'swordsman').run,offer=X.siteOffer(run);
  siteSeeds[offer.job]??=seed;
}
assert.deepEqual(Object.keys(siteSeeds).sort(),siteJobs.sort(),'fixture seed pool covers every actual version-two exploration profession');

function harness(job='healer',options={}){
  let run=P.enable(C.newRun({seed:siteSeeds[job]}),options.profession||'swordsman').run;
  assert.equal(X.siteOffer(run).job,job,'seed must represent the requested site rather than a legacy six-job selection');
  let paused=false,wall=false,hurt=false,inDungeon=false,failSave=false,saves=0,dialog=null,closed=0;
  const document=documentStub(),world=new T.Group(),player=new T.Group(),messages=[],G={px:0,pz:0,running:true,shifting:false};
  const heroRuntime=options.workProgress?{create:()=>({install(){},reset(){},handle(){return false;},workProgress:options.workProgress})}:undefined;
  const context=vm.createContext({TowerPartyCore:P,TowerExpedition:X,TowerCharacters:require('../story/tower-characters.js'),TowerMaterials:require('../story/tower-materials.js'),TowerHeroesRuntime:heroRuntime,document});
  vm.runInContext(source,context);
  let cell=0;
  const ui=context.TowerPartyRuntime.create({THREE:T,G,core:C,text:String,action:(label,key,id,disabled)=>({label,key,id,disabled}).label+'|'+key+'|'+id+'|'+disabled,
    run:()=>run,paused:()=>paused,hurt:()=>hurt,inDungeon:()=>inDungeon,world:()=>world,player:()=>player,monsters:()=>[],traders:()=>[],
    cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),chooseCell:()=>({cx:++cell,cy:0,x:cell*4,z:0}),
    clear:()=>!wall,makeText:()=>new T.Group(),dispose(){},bind(){},follow(){return false;},audio:{sfxAction(){},sfxHit(){},sfxUse(){}},
    dialog:(...args)=>{dialog=args;paused=true;},close:()=>{closed++;paused=false;},toast:(...args)=>messages.push(args),
    transact:result=>{if(!result.ok||failSave)return false;run=result.run;return true;},save:()=>{saves++;return !failSave;},
  });
  ui.install();ui.build(()=>.5,new Set());
  const station=()=>ui.reserved().find(s=>s.kind==='site');
  const atSite=()=>{const s=station();G.px=s.x;G.pz=s.z;ui.tick(0,0);return s;};
  return {ui,document,G,world,player,messages,station,atSite,
    get run(){return run;},set run(v){run=v;},get dialog(){return dialog;},get saves(){return saves;},get closed(){return closed;},
    get box(){return document.getElementById('towerWorkProgress');},get bar(){return this.box.querySelector('progress');},
    get label(){return this.box.querySelector('[data-work-name]').textContent;},get state(){return this.box.querySelector('[data-work-state]').textContent;},
    set paused(v){paused=v;},set wall(v){wall=v;},set hurt(v){hurt=v;},set inDungeon(v){inDungeon=v;},set failSave(v){failSave=v;},
  };
}

for(const job of Object.keys(X.SITES))test(job+' exploration shows independent named progress and resumes to a single completion',()=>{
  const h=harness(job),s=h.atSite(),coins=h.run.coins;
  assert.ok(h.box.hidden);assert.ok(h.document.objective.hidden);
  h.ui.handle('party-explore-work',s.offer.id);
  assert.equal(h.box.hidden,false);assert.equal(h.label,X.SITES[job].verb);assert.equal(h.state,'處理中');assert.equal(h.bar.value,0);assert.equal(h.document.left.getAttribute('data-working'),'true');
  h.ui.tick(3,3000);assert.equal(h.bar.value,25);assert.equal(h.run.party.journey.site.progress,3);
  assert.ok(h.document.objective.hidden,'work display never reopens the hidden story objective');
  h.paused=true;h.ui.tick(8,11000);assert.ok(h.box.hidden);assert.equal(h.run.party.journey.site.progress,3);
  h.paused=false;h.ui.tick(3,14000);assert.equal(h.bar.value,50);assert.equal(h.run.party.journey.site.progress,6);
  h.G.px=s.x+4;h.ui.tick(1,15000);assert.ok(h.box.hidden);assert.equal(h.run.party.journey.site.progress,6);assert.equal(h.saves,1);
  h.atSite();assert.equal(h.box.hidden,false);assert.equal(h.state,'已暫停 · 對話繼續');assert.equal(h.bar.value,50);
  h.ui.tick(1,16000);assert.equal(h.run.party.journey.site.progress,6,'returning alone does not resume without consent');
  h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(6,22000);
  assert.ok(h.box.hidden);assert.equal(h.run.party.journey.site.done,true);assert.equal(h.run.coins,coins+8);assert.ok(C.validateSave(h.run));assert.equal(h.document.left.getAttribute('data-working'),'false');
  h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(20,42000);assert.equal(h.run.coins,coins+8);
});

test('all site panels disclose progress rather than work seconds, including spoken summaries and continuation',()=>{
  for(const job of Object.keys(X.SITES)){
    const h=harness(job),s=h.atSite();h.ui.interact();
    assert.equal(h.dialog[1],X.SITES[job].name);assert.ok(h.dialog[3].includes('尚未開始'));
    assert.ok(h.dialog[4].includes('慢慢處理|party-explore-work'));
    // A reward may disclose how long its exit route lasts; that is not work time.
    // Remove only the exact shared reward copy and retain all other disclosures.
    for(const value of [h.dialog[3],h.dialog[4],h.dialog[5].summary])assert.doesNotMatch(value.replace(X.SITES[job].reward,''),/十二秒|12\s*秒|已完成\s*\d+\s*秒|需要\s*\d+\s*秒/);
    h.paused=false;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(6,6000);h.hurt=true;h.ui.tick(0,6000);h.hurt=false;h.ui.interact();
    assert.ok(h.dialog[3].includes('value="50"'));assert.ok(h.dialog[4].includes('繼續處理|party-explore-work'));
    assert.doesNotMatch(h.messages.map(m=>m[2]).filter(Boolean).join(' '),/\d+\s*秒|十二秒/);
  }
});

test('profession alternatives complete immediately without inventing waiting or changing the original reward',()=>{
  for(const job of Object.keys(X.SITES)){
    const h=harness(job,{profession:job}),s=h.atSite(),coins=h.run.coins;
    h.ui.handle('party-explore-job',s.offer.id);
    assert.ok(h.run.party.journey.site.done,job);assert.equal(h.run.party.journey.site.method,'profession');assert.equal(h.run.coins,coins+8);assert.ok(h.box.hidden);assert.equal(h.closed,1);
    h.ui.interact();assert.ok(h.dialog[3].includes('value="100"'));assert.ok(h.dialog[3].includes('已完成'));
  }
});

test('hurt and newly obstructed paths interrupt, preserve and save progress before explicit continuation',()=>{
  for(const cause of ['hurt','wall']){
    const h=harness(),s=h.atSite();h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(4,4000);h[cause]=true;h.ui.tick(1,5000);
    assert.equal(h.run.party.journey.site.progress,4);assert.equal(h.saves,1);
    h[cause]=false;h.ui.tick(1,6000);assert.equal(h.state,'已暫停 · 對話繼續');assert.equal(h.run.party.journey.site.progress,4);
    h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(2,8000);assert.equal(h.run.party.journey.site.progress,6);assert.equal(h.bar.value,50);
  }
});

test('maze shifting cancels ongoing work, hides progress, saves it and requires another interaction',()=>{
  const h=harness(),s=h.atSite();h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(4,4000);
  h.G.shifting=true;h.ui.tick(5,9000);assert.ok(h.box.hidden);assert.equal(h.run.party.journey.site.progress,4);assert.equal(h.saves,1);
  h.ui.shift();h.G.shifting=false;h.ui.tick(1,10000);assert.equal(h.state,'已暫停 · 對話繼續');assert.equal(h.run.party.journey.site.progress,4);
  h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(2,12000);assert.equal(h.bar.value,50);
});

test('paused, stopped, dead, dungeon and stale-world states hide the work HUD without reopening the objective',()=>{
  const changes=[h=>h.paused=true,h=>h.G.running=false,h=>h.run.status='dead',h=>h.inDungeon=true,h=>h.run.floor=98];
  for(const change of changes){const h=harness(),s=h.atSite();h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(3,3000);change(h);h.ui.refreshWorkProgress();assert.ok(h.box.hidden);assert.ok(h.document.objective.hidden);}
});

test('reset and scene rebuild remove the live work state while saved fractional progress can resume',()=>{
  const h=harness(),s=h.atSite();h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(3.5,3500);
  h.ui.reset();assert.ok(h.box.hidden);assert.equal(h.run.party.journey.site.progress,3.5);
  h.run=C.validateSave(JSON.stringify(h.run));assert.ok(h.run);h.ui.build(()=>.5,new Set());assert.ok(h.box.hidden);
  const rebuilt=h.atSite();assert.equal(h.state,'已暫停 · 對話繼續');assert.equal(h.bar.value,3.5/12*100);
  h.ui.handle('party-explore-work',rebuilt.offer.id);h.ui.tick(8.5,12000);assert.ok(h.run.party.journey.site.done);assert.ok(h.box.hidden);
});

test('failed completion save cannot grant rewards or mark work done; another attempt completes only once',()=>{
  const h=harness(),s=h.atSite(),coins=h.run.coins;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(6,6000);h.failSave=true;h.ui.tick(6,12000);
  assert.equal(h.run.party.journey.site.done,false);assert.equal(h.run.coins,coins);assert.equal(h.run.party.journey.site.progress,12);
  assert.equal(h.box.hidden,false);assert.equal(h.state,'已暫停 · 對話繼續');assert.equal(h.bar.value,100);
  h.failSave=false;h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(.1,12100);assert.ok(h.run.party.journey.site.done);assert.equal(h.run.coins,coins+8);assert.ok(h.box.hidden);
});

test('disarm progress bridges into the shared HUD ahead of site work without seconds and disappears when completed',()=>{
  let task=null;
  const h=harness('healer',{workProgress:()=>task}),s=h.atSite();
  h.ui.handle('party-explore-work',s.offer.id);h.ui.tick(3,3000);assert.equal(h.bar.value,25);assert.equal(h.label,'淨化泉水');
  task={label:'拆解陷阱',ratio:0};h.ui.refreshWorkProgress();assert.equal(h.box.hidden,false);assert.equal(h.label,'拆解陷阱');assert.equal(h.bar.value,0);
  task={label:'拆解陷阱',ratio:.625};h.ui.refreshWorkProgress();assert.equal(h.bar.value,62.5);assert.equal(h.state,'處理中');assert.equal(h.bar.getAttribute('aria-label'),'拆解陷阱進度');
  assert.doesNotMatch(h.label+h.state+h.bar.getAttribute('aria-label'),/秒|\d/);assert.ok(h.document.objective.hidden);
  h.paused=true;h.ui.refreshWorkProgress();assert.ok(h.box.hidden);h.paused=false;
  h.document.hidden=true;h.ui.refreshWorkProgress();assert.ok(h.box.hidden);h.document.hidden=false;
  h.G.shifting=true;h.ui.refreshWorkProgress();assert.ok(h.box.hidden);h.G.shifting=false;
  h.G.running=false;h.ui.refreshWorkProgress();assert.ok(h.box.hidden);h.G.running=true;
  h.ui.refreshWorkProgress();assert.equal(h.bar.value,62.5);assert.equal(h.box.hidden,false);
  h.G.px=s.x+5;h.ui.tick(0,3000);assert.equal(h.box.hidden,false,'disarm progress does not require a nearby exploration station');
  task={label:'拆解陷阱',ratio:1};h.ui.refreshWorkProgress();assert.equal(h.bar.value,100);
  task=null;h.ui.refreshWorkProgress();assert.ok(h.box.hidden);assert.ok(h.document.objective.hidden);
});
