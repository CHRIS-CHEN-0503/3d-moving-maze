import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js'),H=require('../story/tower-heroes-core.js'),S=require('../assets/character-sculpt.js');
function visuals(){const e=vm.createContext({THREE:T,TowerHeroes:H,CharacterSculpt:S});vm.runInContext(readFileSync(new URL('../story/tower-heroes-visuals.js',import.meta.url),'utf8'),e);return e.TowerHeroVisuals;}
const close=(actual,wanted,note='')=>assert.ok(Math.abs(actual-wanted)<.00001,note+': '+actual+' != '+wanted);
const array=v=>Array.from(v);
function hit(g,point,direction){g.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(...point),new T.Vector3(...direction)).intersectObject(g,true)[0];}
function colorAt(h){const a=h.object.geometry.attributes.color;if(!a)return h.object.material.color;return new T.Color(a.getX(h.face.a),a.getY(h.face.a),a.getZ(h.face.a));}
function verticesOfColor(g,hex){
  const wanted=new T.Color(hex),points=[];g.traverse(m=>{if(!m.isMesh)return;m.updateMatrix();const a=m.geometry.attributes.position,n=m.geometry.attributes.normal,c=m.geometry.attributes.color;for(let i=0;i<a.count;i++){
    const shade=c?.96+.04*Math.max(-1,Math.min(1,n.getY(i))):1,actual=c?new T.Color(c.getX(i),c.getY(i),c.getZ(i)):m.material.color;
    if(['r','g','b'].every(k=>Math.abs(actual[k]-wanted[k]*shade)<.000001))points.push(new T.Vector3(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(m.matrix));
  }});assert.ok(points.length,'missing authored material '+hex.toString(16));return new T.Box3().setFromPoints(points);
}
test('every hammer grade has clear gold end faces normal to its actual +Z / -Z contact plane',()=>{
  const V=visuals();for(const base of ['smith_hammer','warhammer'])for(let tier=1;tier<=5;tier++)for(const sex of ['male','female']){
    const g=V.gear(T,H.tierKind(base,tier),{sex}),c=g.userData.contact,big=base==='warhammer',y=big?.8:.55,stretch=tier>=4?1+(tier-3)*.06:1,z=(big?.28:.2)*stretch+.0275,gold=tier===5?0xf0d298:tier===4?0xe3dcec:tier===3?0xf3d390:0xd9bb75;
    assert.equal(c.kind,'hammer-face');assert.deepEqual(array(c.normal),[0,0,1]);assert.deepEqual(array(c.headCenter),[0,y,0]);close(c.center[2],z);close(c.rearCenter[2],-z);
    for(const side of [-1,1]){const h=hit(g,[0,y,side*(z+1)],[0,0,-side]);assert.ok(h,base+':'+tier);close(h.point.z,side*z,'real striking face');close(h.face.normal.z,side,'real face normal');close(h.face.normal.x,0);const expected=new T.Color(gold),color=colorAt(h);for(const channel of ['r','g','b'])close(color[channel],expected[channel]*.96,'face must be gold, not iron cheek');}
    assert.ok(g.userData.authoredParts.includes('hammer-striking-face-front'));assert.ok(g.userData.authoredParts.includes('hammer-striking-face-back'));
    const b=new T.Box3().setFromObject(g);assert.ok(b.max.z-b.min.z>b.max.x-b.min.x,'hammer head must extend along the striking normal');
  }
});
test('elven bows share one shooting plane with a centered grip, rear string and correctly nocked forward arrow',()=>{
  const V=visuals();for(let tier=1;tier<=5;tier++)for(const sex of ['male','female']){
    const g=V.gear(T,H.tierKind('elven_bow',tier),{sex}),c=g.userData.contact,string=verticesOfColor(g,0xe4dfc8),grip=verticesOfColor(g,0x9c8b67),arrow=g.getObjectByName('bow-nocked-arrow');
    assert.ok(arrow);arrow.geometry.computeBoundingBox();const b=arrow.geometry.boundingBox.clone().translate(arrow.position);close(b.min.z,-.32,'nock must meet string');close(b.max.z,.36);close((string.max.z+string.min.z)/2,-.32);close(string.min.y,-.62);close(string.max.y,.62);assert.ok(string.max.x<=.00701&&string.min.x>=-.00701);
    close((grip.max.x+grip.min.x)/2,0);close((grip.max.z+grip.min.z)/2,0);close(grip.max.y,.105);close(grip.min.y,-.105);assert.deepEqual(array(c.grip),[0,0,0]);assert.deepEqual(array(c.nock),[0,0,-.32]);assert.deepEqual(array(c.normal),[0,0,1]);
    g.updateMatrixWorld(true);close(new T.Box3().setFromObject(g).max.z,c.center[2],'arrowhead must end on actual forward axis');for(const name of ['bow-curved-limbs','bow-centered-grip','bow-taut-string','bow-forward-arrowhead'])assert.ok(g.userData.authoredParts.includes(name));
  }
});
test('pan strikes with its flat bottom and blade / magic sources preserve their authored functional axes',()=>{
  const V=visuals();for(let tier=1;tier<=5;tier++)for(const sex of ['male','female']){
    const pan=V.gear(T,H.tierKind('cooking_pan',tier),{sex}),c=pan.userData.contact,h=hit(pan,[0,.48,-1],[0,0,1]);close(h.point.z,c.center[2]);close(h.face.normal.z,-1);assert.deepEqual(array(c.normal),[0,0,-1]);
    for(const base of ['longsword','greatsword','twin_daggers']){const g=V.gear(T,H.tierKind(base,tier),{sex}),c=g.userData.contact,reverse=base==='twin_daggers';assert.deepEqual(array(c.normal),[reverse?-1:1,0,0]);assert.deepEqual(array(c.axis),[0,reverse?-1:1,0]);assert.ok(reverse?c.tip[1]<c.center[1]:c.tip[1]>c.center[1]);g.updateMatrixWorld(true);close(new T.Box3().setFromObject(g)[reverse?'min':'max'].y,c.tip[1],'real beveled blade tip');if(reverse){assert.equal(g.userData.gripStyle,'reverse');assert.deepEqual(array(c.grip),[0,0,0]);}}
    const staff=V.gear(T,H.tierKind('arcane_staff',tier),{sex}).userData.contact,book=V.gear(T,H.tierKind('spellbook',tier),{sex}).userData.contact;assert.deepEqual(array(staff.center),[0,1.1,0]);assert.deepEqual(array(staff.normal),[0,1,0]);assert.deepEqual(array(book.center),[0,.09,.3]);assert.deepEqual(array(book.normal),[0,0,1]);
  }
});
test('all nine weapon families retain their functional hand mounts and bounded mobile render cost',t=>{
  const V=visuals(),families=H.BASE_GEAR.filter(g=>g.slot==='weapon');assert.equal(families.length,9);let maxDraws=0,maxTriangles=0;
  for(const {kind:base}of families)for(let tier=1;tier<=5;tier++)for(const sex of ['male','female']){
    const model=new T.Group(),armR=new T.Group(),armL=new T.Group();model.add(armR,armL);model.userData={armR,armL,heroJob:H.GEAR[base].jobs[0],heroSex:sex};const item={kind:H.tierKind(base,tier),slot:'weapon',durability:10},shield=H.GEAR[base].hands===2?null:{kind:'round_shield',slot:'shield',durability:10};
    V.dress(T,model,{weapon:item,shield},()=>{});const g=model.userData.heroPieces.find(p=>p.userData.baseKind===base);assert.ok(g.userData.contact);assert.equal(g.parent,armR);assert.deepEqual(g.position.toArray(),[0,-.36,.13]);if(base==='spellbook')assert.equal(g.userData.bookOpen,0);if(base==='twin_daggers')assert.ok(armL.children.some(p=>p.userData.baseKind===base));if(shield)assert.ok(armL.children.some(p=>p.userData.baseKind==='round_shield'));
    let triangles=0,draws=0;g.traverse(p=>{assert.ok(!p.isLight);if(p.isMesh){draws++;triangles+=(p.geometry.index?.count||p.geometry.attributes.position.count)/3;assert.ok(!p.castShadow);}});maxDraws=Math.max(maxDraws,draws);maxTriangles=Math.max(maxTriangles,triangles);assert.ok(draws<=8,base+':'+tier+' actual mesh draw count '+draws);assert.ok(triangles<=2700,base+':'+tier+':'+triangles);if(tier>3){const previous=V.gear(T,H.tierKind(base,3),{sex});let previousDraws=0;previous.traverse(p=>{if(p.isMesh)previousDraws++;});assert.ok(draws<=previousDraws);}
  }
  t.diagnostic('90 weapon variants: max '+maxDraws+' draws and '+maxTriangles+' triangles; no additional lights or shadows');
});
