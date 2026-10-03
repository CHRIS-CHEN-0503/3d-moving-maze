import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
function fixture(recorded=true){
  let speaking=true,enabled=true;const calls=[],env=vm.createContext({window:{GameVoice:{status:()=>({enabled,supported:true,speaking}),announceAsset:(...args)=>calls.push(args)}},Lords:{tracks:{'lord.spire.encounter':{text:'開場'},'lord.spire.wounded':{text:'受傷'},'lord.spire.defeat':{text:'落敗'}}}});
  vm.runInContext(source.slice(source.indexOf('  function lordVoice('),source.indexOf('  function buildHazards('))+'\nthis.say=lordVoice;',env);
  const monster={lord:true,voiceEvents:new Set(),def:{id:'depth',environment:'spire',recordedVoice:recorded,speaker:'serena',lines:['開場','受傷','落敗']}};
  return {say:event=>env.say(monster,event),calls,monster,speaking:v=>speaking=v,enabled:v=>enabled=v};
}
for(const recorded of [true,false])test('floor lord opens once even while another message speaks; defeat queues behind opening '+recorded,()=>{
  const f=fixture(recorded);assert.equal(f.say('encounter'),true);assert.equal(f.calls[0][2],true);assert.equal(f.say('encounter'),false);assert.equal(f.calls.length,1);
  assert.equal(f.say('wounded'),false);assert.equal(f.monster.voiceEvents.has('wounded'),false);
  assert.equal(f.say('defeat'),true);assert.equal(f.calls[1][2],false,'must not cut off encounter voice even after a fast kill');assert.equal(f.say('defeat'),false);
  if(!recorded)assert.equal(f.calls[0][3].gender,'female');
});
test('disabled voice does not consume lord lines; wounded can retry when the channel clears',()=>{
  const f=fixture();f.enabled(false);assert.equal(f.say('encounter'),false);assert.equal(f.monster.voiceEvents.size,0);f.enabled(true);f.speaking(false);assert.equal(f.say('wounded'),true);assert.equal(f.calls[0][2],false);
});
