// v1.62.0 · every profession wears its own silhouette: the shared gear families (heavy helm/armor, light hood/armor,
// crown/robe, the three shields and the elven bow) build different, job-marked geometry for each job that may wear
// them, within the existing draw and bounds budgets. The base figure also gets rounded shoulder caps instead of a
// flat mantle board.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),S=require('../assets/character-sculpt.js'),F=require('../assets/character-face.js'),CM=require('../assets/character-motion.js'),H=require('../story/tower-heroes-core.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('function buildCharacter('),builder=html.slice(start,html.indexOf('\n}',start)+2),source=readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8');
const env=vm.createContext({THREE:T,CharacterSculpt:S,CharacterFace:F,CharacterMotion:CM,TowerHeroes:H});env.window=env;vm.runInContext(builder,env);vm.runInContext(source,env);
const V=env.TowerHeroVisuals;
const FAMILIES={heavy_helm:{swordsman:['knight-cheek-plate','knight-nasal-bar'],smith:['smith-goggle-lens','smith-ear-flap','smith-crown-ring']},
  heavy_armor:{swordsman:['knight-round-pauldron'],smith:['smith-leather-apron','smith-tool-pouch','smith-square-pauldron']},
  light_hood:{chef:['chef-toque-crown','chef-toque-band'],scout:['scout-hood-tail','scout-face-scarf'],archer:['archer-cap-peak','archer-cap-feather']},
  light_armor:{chef:['chef-breast-button','chef-neckerchief','chef-waist-apron'],scout:['scout-side-cape','scout-thigh-sheath'],archer:['archer-quiver','archer-quiver-arrow','archer-leaf-guard']},
  rune_crown:{mage:['mage-crescent-spire','mage-star-finial'],healer:['healer-halo-ring','healer-veil'],cleric:[['eboshi-cap','kanzashi-stem']]},
  robe:{mage:['mage-shoulder-cape','mage-rune-pendant'],healer:['healer-cross-sash','healer-herb-satchel'],cleric:['wide-hanging-sleeve','crossed-collar']},
  buckler:{swordsman:['knight-shield-band'],smith:['smith-anvil-boss'],chef:['chef-lid-knob','chef-ladle-hook']},
  round_shield:{swordsman:['knight-shield-band'],smith:['smith-anvil-boss'],chef:['chef-lid-knob']},
  tower_shield:{swordsman:['knight-shield-band'],smith:['smith-anvil-boss'],chef:['chef-lid-knob']},
  elven_bow:{archer:['bow-curved-limbs'],cleric:['yumi-lacquered-limbs']}};
const signature=g=>{const parts=[];g.traverse(o=>{if(o.isMesh)parts.push(Array.from(o.geometry.attributes.position.array).map(v=>Math.round(v*1000)));});return JSON.stringify(parts);};
const authored=g=>new Set((g.userData.authoredParts||[]).map(p=>p.name||p));
const names=g=>{const set=new Set();g.traverse(o=>{if(o.name)set.add(o.name);});for(const n of authored(g))set.add(n);return set;};

test('every job that may wear a shared family gets its own marked silhouette, within the draw and bounds budgets',()=>{
  for(const [family,jobs] of Object.entries(FAMILIES)){
    assert.deepEqual(Object.keys(jobs).sort(),[...H.GEAR[family].jobs].sort(),family+' covers every job allowed to wear it');
    for(const tier of [1,3,5])for(const sex of ['male','female']){
      const seen=new Map();
      for(const [job,markers] of Object.entries(jobs)){
        const g=V.gear(T,H.tierKind(family,tier),{job,sex}),label=family+' '+job+' '+sex+' t'+tier;
        assert.ok(g.children.length<=8,label+' stays within eight draw groups: '+g.children.length);
        const got=names(g);for(const marker of markers)assert.ok((Array.isArray(marker)?marker:[marker]).some(name=>got.has(name)),label+' carries '+marker);
        g.updateMatrixWorld(true);const b=new T.Box3().setFromObject(g);assert.ok(b.max.y<2.4&&b.min.y>-.85,label+' bounds');
        // The cleric's eboshi is an authored tall hat from v1.60.0; every other headpiece stays under the shared ceiling.
        if(H.GEAR[family].slot==='helmet'&&!(family==='rune_crown'&&job==='cleric'))assert.ok(b.max.y<2.1,label+' no oversized headgear');
        g.traverse(o=>{if(o.isMesh)for(const key of ['position','normal'])assert.ok(Array.from(o.geometry.attributes[key].array).every(Number.isFinite),label+' finite '+key);});
        const sig=signature(g);for(const [other,otherSig] of seen)assert.notEqual(sig,otherSig,label+' differs from '+other);seen.set(job,sig);
      }
    }
  }
});

test('helmet families keep the half-sphere cap that hides the hair boundary, and shields keep their grip',()=>{
  for(const family of ['heavy_helm','light_hood'])for(const job of H.GEAR[family].jobs)for(const sex of ['male','female']){
    const g=V.gear(T,family,{job,sex});let cap=0;g.traverse(o=>{if(o.isMesh&&o.geometry.type==='SphereGeometry'&&o.geometry.parameters?.thetaLength===Math.PI/2)cap++;});
    assert.ok(cap>=1,family+' '+job+' '+sex+' keeps the physical cap');
  }
  assert.match(source,/else if\(\['buckler','round_shield','tower_shield'\]\.includes\(kind\)\)\{const big=kind==='tower_shield',smith=job==='smith',chef=job==='chef'/);
});

test('the base figure wears rounded shoulder caps on both arms and armor uses layered pauldrons instead of a mantle board',()=>{
  for(const job of Object.keys(H.JOBS).filter(j=>j!=='robot'))for(const sex of ['male','female']){
    const m=V.base(job,env.buildCharacter,'hero',sex);
    for(const key of ['armL','armR']){const sleeve=m.userData[key].children.find(c=>c.name==='connected-shoulder-sleeve');assert.ok(sleeve?.geometry.userData.shoulderCap,job+' '+sex+' '+key+' sleeve carries the baked shoulder cap');assert.ok(!m.userData[key].children.some(c=>c.name==='rounded-shoulder-cap'),'the cap is merged, not a separate mesh');sleeve.geometry.computeBoundingBox();assert.ok(sleeve.geometry.boundingBox.max.y>.12,'the cap rounds above the sleeve top');}
    let meshes=0,triangles=0;m.traverse(p=>{if(p.isMesh){meshes++;triangles+=(p.geometry.index?.count??p.geometry.attributes.position.count)/3;}});
    assert.ok(meshes<65&&triangles<7000,job+' '+sex+' figure budget '+meshes+'/'+triangles);
  }
  assert.doesNotMatch(source,/tiered-shoulder-mantle/);
  for(const kind of ['heavy_armor_t3','light_armor_t3','robe_t3']){const g=V.gear(T,kind,{sex:'male'});assert.ok(names(g).has('layered-pauldron'),kind+' has layered pauldrons');}
  assert.match(builder,/cap\.name='rounded-shoulder-cap';arm\.add\(cap\);/,'classic characters get the same cap');
});
