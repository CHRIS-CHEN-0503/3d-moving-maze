import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),M=require('../story/tower-combat-motion.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),visuals=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
function env(){const e=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,TowerHeroes:H,TowerPartyCore:P,TowerCombatMotion:M});e.window=e;const start=html.indexOf('function buildCharacter(cd)'),end=html.indexOf('\n}',start)+2;vm.runInContext(html.slice(start,end),e);vm.runInContext(visuals,e);return e;}
const e=env(),V=e.TowerHeroVisuals,archer=sex=>V.base('archer',e.buildCharacter,'hero',sex);
const local=(m,node)=>{m.updateMatrixWorld(true);return m.worldToLocal(node.getWorldPosition(new T.Vector3()));};
const names=m=>{const list=[];m.userData.head.traverse(o=>{if(o.isMesh)list.push(o.name);});return list;};

test('archer arms are a quarter shorter, hang relaxed at hip height and wear leather bracers and gloves',()=>{
  const sword=V.base('swordsman',e.buildCharacter,'hero','female');
  for(const sex of ['male','female']){
    const m=archer(sex),rig=m.userData.bowArms;
    for(const arm of [rig.right,rig.left]){
      assert.ok(arm.bone<=.32,'each bone is at most .32 (was .42)');
      const shoulder=local(m,arm.upper),elbow=local(m,arm.elbow),hand=local(m,arm.hand);
      assert.ok(hand.y>.55&&hand.y<.8,sex+' rest hand at hip height, not knee height: '+hand.y);
      assert.ok(Math.abs(elbow.x)<=Math.abs(shoulder.x)+.1,sex+' elbows do not flare out (no hands-on-hips): '+elbow.x);
      assert.ok(elbow.z<shoulder.z&&elbow.z<hand.z,sex+' relaxed elbows fall back, forearms come forward');
      assert.notEqual(arm.elbow.children.find(c=>c.name.startsWith('bow-forearm')).material,arm.upper.material,'forearm is a leather bracer, not bare skin');
      assert.notEqual(arm.hand.children.find(c=>c.name.startsWith('bow-grip-hand')).material,arm.upper.material,'gloved hand');
    }
    // Rest hands sit close to where other professions' straight arms end.
    sword.updateMatrixWorld(true);const other=sword.worldToLocal(sword.userData.armR.localToWorld(new T.Vector3(0,-.36,0))).y;assert.ok(Math.abs(local(m,rig.right.hand).y-other)<.1,'rest hand '+local(m,rig.right.hand).y+' vs '+other);
  }
});

test('he is a handsome elf with swept bangs and a low ponytail; she is a pretty elf with a ribboned high ponytail',()=>{
  const him=archer('male'),her=archer('female');
  for(const m of [him,her]){const list=names(m);assert.ok(list.includes('elf-ear')&&list.includes('elf-earring'));assert.ok(!list.includes('human-ear'),'no hidden human ears are kept');}
  assert.deepEqual(['archer-swept-bangs','archer-low-ponytail','archer-hair-tie'].filter(n=>names(him).includes(n)).length,3);
  assert.deepEqual(['archer-ponytail','archer-ribbon','archer-lash'].filter(n=>names(her).includes(n)).length,3);
  for(const n of ['archer-ponytail','archer-ribbon','archer-lash'])assert.ok(!names(him).includes(n),n);
  for(const n of ['archer-swept-bangs','archer-low-ponytail'])assert.ok(!names(her).includes(n),n);
  // Her eyes are larger and more open; his gaze is cooler and narrower; both keep live expressions.
  const fh=him.userData.face,fs=her.userData.face;assert.ok(fs.eyes[0].scale.x>fh.eyes[0].scale.x&&fs.baseEyeY>fh.baseEyeY);
  F.update(her,1,'happy');F.update(her,2,'happy');assert.notEqual(fs.eyes[0].scale.y,fs.baseEyeY,'expressions still change the eyes');
  // A narrower jaw for him than a generic face, and a smaller heart-shaped chin for her.
  const width=(m,y)=>{const p=m.userData.headMesh.geometry.attributes.position;let w=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-y)<.03)w=Math.max(w,Math.abs(p.getX(i)));return w;};
  const generic=V.base('healer',e.buildCharacter,'hero','male');assert.ok(width(him,-.18)<width(generic,-.18));assert.ok(width(her,-.2)<width(him,-.2));
  assert.match(V.portrait('archer','male'),/data-hair="swept-bangs"/);assert.match(V.portrait('archer','male'),/data-hair="low-ponytail"/);assert.match(V.portrait('archer','female'),/data-hair="high-ponytail"/);
  assert.match(V.portrait('archer','male'),/俊美/);assert.match(V.portrait('archer','female'),/俏麗/);
});

test('hair accessories hide under helmets and hoods (his low ponytail stays below the rim) and restore afterwards',()=>{
  for(const sex of ['male','female'])for(const kind of ['light_hood','heavy_helm']){
    const m=archer(sex),helmet={kind,slot:'helmet',durability:100},equipment={helmet,armor:null,shield:null,weapon:null};
    const shown=()=>Object.fromEntries(m.userData.head.children.filter(c=>c.name.startsWith('archer-')&&c.name!=='archer-lash').map(c=>[c.name,c.visible]));
    V.dress(T,m,equipment,()=>{},{showHelmet:true});
    for(const [name,visible]of Object.entries(shown()))assert.equal(visible,['archer-low-ponytail','archer-hair-tie'].includes(name),sex+' '+kind+' '+name);
    V.dress(T,m,equipment,()=>{},{showHelmet:false});for(const [name,visible]of Object.entries(shown()))assert.equal(visible,true,name);
  }
});

test('hair lengths: shoulder-length under her ponytail, a longer layered cut for him; other professions unchanged',()=>{
  const drop=(job,sex)=>{const h=S.hair(T,{job,sex}),p=h.drape.attributes.position;let min=0;for(const i of h.drape.index.array)min=Math.min(min,p.getY(i));return min;};
  assert.ok(drop('archer','female')>drop('mage','female'),'her loose hair is shorter; the ponytail carries the length');
  assert.ok(drop('archer','male')<drop('healer','male'),'his layered cut is a little longer than the generic short cut');
});
