import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),A=require('../assets/combat-audio.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const V=(()=>{const c=vm.createContext({});vm.runInContext(read('story/tower-skill-effects.js'),c);return c.TowerSkillEffects;})();
const LEVEL_UP={id:'level-up',job:'',effect:'levelup',presentation:{family:'levelup',colors:[0xffd66b,0xfff3c9]}};
function manager(options={}){const world=new T.Group(),flashes=[],kicks=[];const fx=V.create(T,{world:()=>world,limit:12,flash:(at,color,power,seconds)=>flashes.push({at:{...at},color,power,seconds}),kick:(amount,seconds)=>kicks.push({amount,seconds}),...options});return {fx,world,flashes,kicks};}
const named=(group,name)=>{const list=[];group.traverse(o=>{if(o.name===name)list.push(o);});return list;};

test('a level up raises a golden column of light from a ground ring, with climbing halos, a crest star and streaming sparks',()=>{
  const {fx,world,flashes,kicks}=manager(),f=fx.emit(LEVEL_UP,{x:2,z:-3},0);
  assert.ok(f);assert.equal(f.family,'levelup');assert.equal(f.total,1.8);assert.equal(f.group.name,'skill-vfx-level-up');assert.deepEqual(f.group.position.toArray(),[2,.04,-3]);
  for(const [name,count]of [['level-up-light-pillar',1],['level-up-ground-ring',1],['level-up-rising-halo',2],['level-up-crest-star',1],['level-up-rising-spark',7],['batched-spell-particles',1]])assert.equal(named(f.group,name).length,count,name);
  assert.deepEqual(flashes.map(l=>[l.color,l.power,l.seconds]),[[0xfff3c9,3.4,.9]],'one warm burst of real light on the floor, walls and party');assert.deepEqual(kicks,[],'no camera shake');
  const pillar=named(f.group,'level-up-light-pillar')[0],star=named(f.group,'level-up-crest-star')[0],halo=named(f.group,'level-up-rising-halo')[0],bottom=()=>pillar.position.y-1.3*pillar.scale.y;
  fx.tick(.05);const early={height:pillar.scale.y,star:star.scale.x,halo:halo.position.y};assert.ok(Math.abs(bottom())<1e-6,'the column grows up from the floor');assert.ok(early.star<.01,'the star waits for the column');
  fx.tick(.5);assert.ok(pillar.scale.y>early.height*4&&Math.abs(bottom())<1e-6);assert.ok(star.scale.x>1,'the star flares at the crest');assert.ok(halo.position.y>early.halo+.4,'the halos climb');
  fx.tick(1.3);assert.equal(world.children.length,0,'gone after 1.8 seconds');assert.equal(fx.stats().groups,0);
});

test('reduced motion keeps the moment but calms it: fewer sparks, shorter travel, dimmer light',()=>{
  const {fx,flashes}=manager({reducedMotion:true}),f=fx.emit(LEVEL_UP,{x:0,z:0},0);
  assert.equal(f.total,1.2);assert.equal(named(f.group,'level-up-rising-spark').length,2);assert.ok(Math.abs(flashes[0].power-3.4*.6)<1e-9);
  const halo=named(f.group,'level-up-rising-halo')[0],start=halo.position.y;fx.tick(.6);assert.ok(halo.position.y-start<.3,'short travel');
});

test('a short rising fanfare plays: C, E, G, then high C',()=>{
  assert.equal(A.ACTIONS.levelup,.8,'within the 0.81-second bound of every action sound');const data=A.render('levelup');assert.equal(data.length,Math.round(.8*A.RATE));
  const at=seconds=>{let peak=0;const i=Math.round(seconds*A.RATE);for(let n=i;n<i+Math.round(.02*A.RATE);n++)peak=Math.max(peak,Math.abs(data[n]));return peak;};
  assert.ok(at(.01)>.05&&at(.085)>.05&&at(.16)>.05&&at(.235)>.05,'four notes in a row');
});

test('the team HUD celebrates every rise in level once, from any experience source, and never on a new floor or loaded save',()=>{
  const runtime=read('story/tower-heroes-runtime.js');
  assert.match(runtime,/const ids=H\.ids\(r\(\)\);watchLevels\(ids\);/,'checked on every HUD pass');
  assert.match(runtime,/ups=seenLevels&&key===seenKey\?ids\.filter\(id=>seenLevels\[id\]!==undefined&&levels\[id\]>seenLevels\[id\]\):\[\]/,'only a rise on the same floor of the same journey, for an actor already seen');
  assert.match(runtime,/lights\.emit\(LEVEL_UP,\{x:at\.x,z:at\.z\},0\);root\.CharacterFace\?\.react\(actorModel\(id\),'happy',2\.2\);/);
  assert.match(runtime,/ctx\.audio\.sfxAction\?\.\('levelup'\);/);assert.match(runtime,/升到 '\+levels\[ups\[0\]\]\+' 級'/);
  assert.match(runtime,/banner\.innerHTML='<b>升級！<\/b><span>'\+esc\(text\)\+'<\/span>';banner\.hidden=false;banner\.classList\.remove\('is-playing'\);void banner\.offsetWidth;banner\.classList\.add\('is-playing'\);/,'its own banner, which a kill message cannot cover');
  assert.match(runtime,/levelBanner\.id='heroLevelBanner';levelBanner\.hidden=true;levelBanner\.setAttribute\('role','status'\)/);assert.match(runtime,/function reset\(\)\{[^}]*seenLevels=null;seenKey='';/);
  const css=read('story/tower-heroes.css');assert.match(css,/\.just-leveled>button\{animation:hero-level-up 1\.8s ease-out 1\}/);assert.match(css,/#heroLevelBanner\.is-playing\{animation:hero-level-banner 2\.4s ease-out 1 forwards\}/);assert.match(css,/prefers-reduced-motion:reduce\)\{#heroTeamBar \.hero-team-member\.just-leveled>button\{animation:none/);
});
