import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url),A=require('../assets/combat-audio.js'),H=require('../story/tower-heroes-core.js'),Hazards=require('../story/tower-hazards.js');
function measure(data){let peak=0,sum=0,mean=0;for(const sample of data){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;mean+=sample;}return {peak,rms:Math.sqrt(sum/data.length),mean:mean/data.length};}
function band(data,from,to){let power=0;for(let frequency=from;frequency<=to;frequency+=25){let re=0,im=0;for(let n=0;n<data.length;n++){const phase=2*Math.PI*frequency*n/A.RATE;re+=data[n]*Math.cos(phase);im+=data[n]*Math.sin(phase);}power+=(re*re+im*im)/(data.length*data.length);}return power;}
function audioContext(){const sources=[],gains=[],buffers=[];const context={currentTime:1,createBuffer(ch,n,rate){const data=new Float32Array(n),buffer={ch,n,rate,getChannelData:()=>data};buffers.push(buffer);return buffer;},createGain(){const gain={gain:{value:1},connect(out){this.output=out;},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;},createBufferSource(){const source={connect(out){this.output=out;},start(){this.started=true;},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};sources.push(source);return source;}};return {context,sources,gains,buffers};}
test('every action has a cached original layered waveform with conservative peak/RMS and smooth outer edges',()=>{
  const waves=new Set();for(const kind of Object.keys(A.ACTIONS)){const data=A.render(kind),m=measure(data);assert.deepEqual(data,A.render(kind),kind);assert.equal(data[0],0);assert.equal(data.at(-1),0);assert.ok(data.every(Number.isFinite),kind);assert.ok(m.peak>.5&&m.peak<=.641,kind+' peak');assert.ok(m.rms>.035&&m.rms<.36,kind+' RMS '+m.rms);assert.ok(Math.abs(m.mean)<.025,kind+' DC '+m.mean);assert.ok(Math.abs(data[1])<.035&&Math.abs(data.at(-2))<.003,kind+' edge');waves.add(Buffer.from(data.buffer).toString('base64'));}
  assert.equal(waves.size,Object.keys(A.ACTIONS).length);
});
test('lightning has a low thunder body, frost is crystalline, healing retains a major chord and robot is not the hammer recording',()=>{
  const thunder=A.render('thunder'),frost=A.render('frost'),heal=A.render('heal');
  const lowThunder=band(thunder,40,240),brightThunder=band(thunder,1100,2100),lowFrost=band(frost,40,240),brightFrost=band(frost,1100,2100);
  assert.ok(lowThunder>brightThunder*2,'thunder body dominates crackle');assert.ok(brightFrost>lowFrost*2,'ice shimmer is not a bass blast');
  assert.ok(band(heal,515,540)+band(heal,650,675)+band(heal,775,800)>band(heal,1200,2000)*3,'healing chord remains gentle and tonal');
  for(const kind of ['robot','robot-drive','robot-impact'])assert.notDeepEqual(A.render(kind),A.render('metal'));assert.notDeepEqual(A.render('thorns'),thunder);assert.notDeepEqual(A.render('slash'),A.render('bow'));
});
test('all nine professions, preparation, ordinary hits, supplies, hazards and existing literal action hooks resolve to real audio',()=>{
  const jobs=new Set();for(const skill of Object.values(H.SKILLS)){jobs.add(skill.job);assert.ok(A.ACTIONS[A.skillKind(skill)],skill.id);}assert.equal(jobs.size,9);
  assert.equal(A.skillKind(H.SKILLS.flying_fist),'robot');assert.equal(A.skillKind(H.SKILLS.iron_charge),'robot-drive');assert.equal(A.skillKind(H.SKILLS.shoulder_quake),'robot-impact');
  assert.equal(A.skillKind({...H.SKILLS.flying_fist,presentation:{sound:'thunder'}}),'thunder');
  assert.equal(A.skillKind(H.SKILLS.herbal_heal),'heal');assert.equal(A.skillKind(H.SKILLS.arcane_bolt),'magic');
  for(const gear of Object.values(H.GEAR).filter(g=>g.slot==='weapon'))assert.ok(A.ACTIONS[A.hitKind(gear)]||A.hitKind(gear)==='hit',gear.kind);
  for(const def of Object.values(Hazards.TYPES))for(const kind of [def.sound,def.warningSound])assert.ok(A.ACTIONS[kind]||A.ALIASES[kind],kind);
  for(const id of ['heal','haste','ration','power_glimmer','power_starlight','power_sunheart','shield','hourglass','bell','map'])assert.ok(A.ACTIONS[A.itemKind(id)],id);
  for(const file of readdirSync(new URL('../story/',import.meta.url)).filter(f=>f.endsWith('.js'))){const source=readFileSync(new URL('../story/'+file,import.meta.url),'utf8');for(const match of source.matchAll(/sfxAction(?:\?\.)?\(\s*'([^']+)'/g))assert.ok(A.ACTIONS[match[1]]||A.ALIASES[match[1]],file+': '+match[1]);}
});
test('previously silent barrier and mechanism hooks play canonical buffers and share their anti-duplicate window',()=>{
  const f=audioContext(),player=A.create(f.context,{});player.play('barrier');player.play('shield');assert.equal(f.sources.length,1);assert.deepEqual(A.render('barrier'),A.render('shield'));
  f.context.currentTime+=.07;player.play('mechanism');player.play('device');assert.equal(f.sources.length,2);assert.deepEqual(A.render('mechanism'),A.render('device'));
  for(const invalid of ['not-a-sound','toString','__proto__','constructor'])player.play(invalid);assert.equal(f.sources.length,2);player.stop();assert.ok(f.sources.every(s=>s.disconnected));assert.ok(f.gains.every(g=>g.disconnected));
});
test('four simultaneous voices have headroom before user volume, reuse buffers and dispose each per-voice level connection',()=>{
  const f=audioContext(),output={},player=A.create(f.context,output,{voice:()=>({speaking:false})});
  for(const kind of ['thunder','robot-impact','metal','magic'])player.play(kind);assert.equal(f.sources.length,4);assert.equal(f.gains.length,4);
  let bound=0;for(const source of f.sources){const gain=source.output;assert.equal(gain.output,output);assert.equal(gain.gain.value,.32);bound+=measure(source.buffer.getChannelData()).peak*gain.gain.value;}assert.ok(bound<.83);
  const oldEnd=f.sources[0].onended;player.play('heal');assert.equal(f.sources[0].stopped,true);assert.equal(f.gains[0].disconnected,true);oldEnd();assert.equal(f.sources.filter(s=>!s.disconnected).length,4);
  f.context.currentTime+=.07;player.play('heal');assert.equal(f.buffers.length,5);player.stop();player.stop();assert.ok(f.sources.every(s=>s.disconnected));assert.ok(f.gains.every(g=>g.disconnected));
});
test('audible or queued narration lowers action volume without changing the saved effects control, and charge is deliberately quieter',()=>{
  for(const state of [{speaking:true},{loadingVoice:true},{loadingAudio:true}]){const f=audioContext(),output={gain:{value:.7}},player=A.create(f.context,output,{voice:()=>state});player.play('thunder');assert.ok(Math.abs(f.gains[0].gain.value-.32*.36)<1e-10);assert.equal(output.gain.value,.7);player.stop();}
  const f=audioContext(),player=A.create(f.context,{}, {voice:()=>{throw new Error('speech unavailable');}});player.play('charge',1.2);assert.equal(f.gains[0].gain.value,.22);assert.equal(f.sources[0].buffer.n,Math.round(A.RATE*1.2));player.stop();
});
test('sound-only module owns no timers, animation loops, context creation, external downloads or music controller changes',()=>{
  const source=readFileSync(new URL('../assets/combat-audio.js',import.meta.url),'utf8');assert.doesNotMatch(source,/requestAnimationFrame\s*\(|set(?:Timeout|Interval)\s*\(|fetch\s*\(|new\s+(?:Audio|AudioContext|webkitAudioContext)|localStorage|createConvolver|TowerAudio/);
});
