import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),N=require('../story/tower-narrative.js');
const source=readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8');
const start=source.indexOf('    function interact(){'),end=source.indexOf('\n    function handle(',start);
assert.ok(start>=0&&end>start);
function journey(underground,modern){
  let run=P.enable(C.newRun({seed:43,name:'招募檢查'}),'mage').run;
  if(modern)run=H.enable(run).run;
  if(underground){
    run.floor=1;run.floorsCleared=99;run.status='won';run.chronicle=N.newChronicle(1);run.chronicle.clues=N.CHAPTERS.map(c=>c.clueId);run.chronicle.ending='release';P.advance(run,{reward:false});
    const entered=C.startUnderworld(run);assert.ok(entered.ok,entered.message);run=entered.run;
  }
  return run;
}
function invite(run){
  let offer=P.recruitOffer(run);
  for(let floor=run.floor;!offer&&floor>-50;){run.floor=--floor;run.floorsCleared=99-floor-1;P.advance(run,{reward:false});offer=P.recruitOffer(run);}
  assert.ok(offer);assert.ok(C.validateSave(run));
  let dialog;
  const context=vm.createContext({P,H,offer,r:()=>run,modern:()=>H.enabled(run),pruneRecruits(){},live:()=>true,near:{kind:'recruit'},distance:()=>0,clear:()=>true,
    ctx:{G:{shifting:false},dialog:(...args)=>{dialog=args;}},root:{TowerHeroVisuals:{portrait:()=>'<figure></figure>'}},portrait:()=>'<figure></figure>',act:label=>label});
  vm.runInContext(source.slice(start,end),context);assert.equal(context.interact(),true);return {offer,html:dialog[3]};
}
test('underground invitation shows level five of ten and its random fourth-level reward',()=>{
  const {offer,html}=invite(journey(true,true));
  assert.equal(offer.level,5);assert.match(html,/等級 5\/10/);assert.match(html,/加入時隨機獲得四級解鎖的一招普通技能/);assert.doesNotMatch(html,/等級 5\/5|可再選一招/);
});
test('surface invitation keeps level one of five without underground growth copy',()=>{
  const {offer,html}=invite(journey(false,true));
  assert.equal(offer.level,1);assert.match(html,/等級 1\/5/);assert.doesNotMatch(html,/地下新同伴|最高可升至 10/);
});
test('legacy underground invitation does not advertise modern skills or a ten-level cap',()=>{
  const {offer,html}=invite(journey(true,false));
  assert.equal(offer.level,5);assert.match(html,/等級 5\/5/);assert.doesNotMatch(html,/隨機獲得四級|可再選一招|最高可升至 10/);
});
