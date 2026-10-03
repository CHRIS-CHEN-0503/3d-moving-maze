import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,statSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),Voices=require('../assets/character-voices.js'),V=require('../assets/game-voice.js'),pack=require('../assets/voice-pack.js');
const source=readFileSync(new URL('../assets/character-voices.js',import.meta.url),'utf8');
function fixture({gender='male',job='mage',random=()=>0,voice}={}){
  let enabled=true,supported=true,speaking=false,paused=false,draws=0;
  const calls=[],actors={hero:{job,gender},ally:{job:'mage',gender:gender==='male'?'female':'male'}},run={};
  const H={enabled:()=>true,ids:()=>Object.keys(actors),job:(_r,id)=>actors[id].job,sex:(_r,id)=>actors[id].gender,hp:()=>60,maxHp:()=>60};
  const env=vm.createContext({TowerHeroes:H,Math:Object.assign(Object.create(Math),{random(){draws++;return random();}})});
  vm.runInContext(source,env);
  const api=env.MazeCharacterVoices.create({run:()=>run,paused:()=>paused,voice:voice||{status:()=>({enabled,supported,speaking}),announceAsset(...args){calls.push(args);}}});
  return {api,calls,draws:()=>draws,enable:v=>enabled=v,support:v=>supported=v,speak:v=>speaking=v,pause:v=>paused=v};
}
test('daylight randomly selects two complete recordings per sex, retaining the same built-in speaker',()=>{
  for(const gender of ['male','female'])for(const [draw,suffix]of [[0,''],[.4999,''],[.5,'.hope'],[.9999,'.hope']]){
    const f=fixture({gender,random:()=>draw});assert.equal(f.api.say('specialty','hero'),true);
    const [id,text,interrupt,profile]=f.calls[0];assert.equal(id,'character.mage.'+gender+'.specialty'+suffix);assert.equal(text,Voices.tracks[id].text);assert.equal(interrupt,false);assert.equal(profile.gender,gender);assert.equal(profile.identity,'party-hero');assert.equal(f.draws(),1);
    const normal=Voices.tracks['character.mage.'+gender+'.specialty'],hope=Voices.tracks['character.mage.'+gender+'.specialty.hope'];
    assert.equal(hope.text,'加油！有光的地方就有希望！');assert.equal(hope.speaker,normal.speaker);assert.equal(hope.speaker,gender==='male'?'dylan':'serena');assert.equal(hope.instruction,normal.instruction);assert.equal(hope.category,'character-bark');assert.equal(pack.get(id).src,Voices.tracks[id].src);
    assert.ok(statSync(new URL('../'+hope.src,import.meta.url)).size>1500);
  }
});
test('the two lines share one actor-event cooldown and keep the team cooldown; random draws cannot bypass them',()=>{
  const f=fixture({random:()=>.9});assert.equal(f.api.say('specialty','hero'),true);assert.equal(f.api.say('specialty','ally'),false);assert.equal(f.draws(),1);
  f.api.tick(11.99);assert.equal(f.api.say('specialty','ally'),false);f.api.tick(.01);assert.equal(f.api.say('specialty','ally'),true);assert.equal(f.calls[1][3].gender,'female');assert.match(f.calls[1][0],/mage\.female\.specialty\.hope$/);
  f.api.tick(32.99);assert.equal(f.api.say('specialty','hero'),false);f.api.tick(.01);assert.equal(f.api.say('specialty','hero'),true);assert.equal(f.draws(),3);
});
test('disabled, unsupported, paused or speaking states do not select or queue a daylight line',()=>{
  for(const [control,value]of [['enable',false],['support',false],['speak',true],['pause',true]]){
    const f=fixture({random:()=>.9});f[control](value);assert.equal(f.api.say('specialty','hero'),false);assert.equal(f.calls.length,0);assert.equal(f.draws(),0);
    f[control](!value);assert.equal(f.api.say('specialty','hero'),true);assert.equal(f.calls.length,1);
  }
  const f=fixture();assert.equal(f.api.say('specialty','missing'),false);assert.equal(f.draws(),0);
});
test('other professions and mage battle, danger and victory keep their original recording IDs',()=>{
  for(const job of ['swordsman','scout','chef','healer','smith','archer'])for(const gender of ['male','female']){
    const f=fixture({job,gender,random:()=>.9});assert.equal(f.api.say('specialty','hero'),true);assert.equal(f.calls[0][0],'character.'+job+'.'+gender+'.specialty');assert.equal(f.draws(),0);
  }
  for(const event of ['battle','danger','victory']){const f=fixture({random:()=>.9});assert.equal(f.api.say(event,'hero'),true);assert.equal(f.calls[0][0],'character.mage.male.'+event);assert.equal(f.draws(),0);}
});
test('only the chosen MP3 is loaded on demand, one player is reused and speech-off stops the clip',()=>{
  const played=[],players=[];let draw=0;
  class Audio{constructor(){players.push(this);}play(){played.push({src:this.src,ended:this.onended});}pause(){this.paused=true;}}
  const voice=V.create({Audio,MazeVoicePack:pack,Date:{now:()=>1000},document:{hidden:false,addEventListener(){}},addEventListener(){}}),f=fixture({voice,random:()=>draw});
  assert.equal(players.length,0);assert.equal(played.length,0);assert.equal(f.api.say('specialty','hero'),true);assert.match(played[0].src,/mage-male-specialty\.mp3$/);assert.equal(players.length,1);
  played[0].ended();f.api.tick(45);draw=.9;assert.equal(f.api.say('specialty','hero'),true);assert.match(played[1].src,/mage-male-specialty-hope\.mp3$/);assert.equal(players.length,1);
  voice.configure({enabled:false});assert.equal(players[0].paused,true);assert.equal(voice.status().speaking,false);played[1].ended();f.api.tick(45);assert.equal(f.api.say('specialty','hero'),false);assert.equal(played.length,2);
});
