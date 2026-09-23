import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const THREE=createRequire(import.meta.url)('../lib/three.min.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
function fixture(size=13){
  const c=vm.createContext({THREE,V3:THREE.Vector3,envGroup:null,scene:new THREE.Scene(),
    G:{mazeW:size,mazeH:size,cell:4,view:'tp',px:0,pz:0,camYaw:0,camPitch:0,wallH:1.25,wallBoxes:[],visionUntil:0},
    CFG:{cameraDistance:7},camera:new THREE.PerspectiveCamera(70,1,.1,300),
    makeTex:()=>new THREE.Texture(),makeTextSprite:()=>new THREE.Sprite(),makeEmojiSprite:()=>new THREE.Sprite(),
    disposeSceneObject(){},localStorage:{getItem:()=>null},window:{TowerMode:{active:true}},TowerMode:{active:true},
    performance:{now:()=>1000},updateTopMask(){}});
  vm.runInContext(block('function cameraDistance(', 'const runtimeConfigReady=')+
    block('function buildEnvironment(', '</script>')+
    block('function cameraClearDist(', '/* 身體正前方')+
    block('function updateCamera(dt)', '</script>'),c);
  c.CFG.cameraDistance=7;
  c.buildEnvironment({id:'shop',sky:0xffffff,fog:[0xffffff,90,400],amb:0xffffff,ambI:1,dirI:.45});
  return c;
}
for(const size of [11,13,25])test(`超市 ${size} 格：最遠距離完整上下轉動，鏡頭與吊掛物保留淨空`,()=>{
  const c=fixture(size),ceiling=c.envGroup.children.find(o=>o.geometry?.type==='PlaneGeometry');
  assert.equal(ceiling.position.y,10);
  const overhead=c.envGroup.children.filter(o=>o.position.y>8&&!o.isLight);
  assert.ok(overhead.length>=38,'天花板、燈盤、燈管、吊扇和招牌一起抬高');
  let previous=-Infinity;
  for(const pitch of [-.12,0,.2,.4,.6,.9]){
    c.G.camPitch=pitch;c.updateCamera(.1);
    assert.ok(c.camera.position.y>previous);previous=c.camera.position.y;
    for(const object of overhead){
      const bounds=new THREE.Box3().setFromObject(object);
      assert.ok(bounds.min.y>c.camera.position.y+.9,'鏡頭不碰到吊掛物');
    }
  }
  assert.ok(c.camera.position.y>7.8);
});
test('超市從俯視切回時立即回到屋頂下，第一人稱和俯視不受高度保護限制',()=>{
  const c=fixture();c.camera.position.y=48;c.updateCamera(.016);
  assert.equal(c.camera.position.y,c.envGroup.userData.cameraCeiling);
  c.G.view='fp';c.updateCamera(.016);assert.equal(c.camera.position.y,1.6);
  c.G.view='top';c.G.topZoom=48;c.G.owlUntil=0;c.updateCamera(1);assert.equal(c.camera.position.y,48);
});
test('非超市場景不套用屋頂限制，第三人稱仍保留牆壁避讓',()=>{
  const c=fixture();c.envGroup.userData.cameraCeiling=undefined;c.G.wallH=3;
  c.G.wallBoxes=[{minX:-2,maxX:2,minZ:.7,maxZ:1.3}];c.updateCamera(.1);
  assert.ok(c.camera.position.z<.52);assert.equal(c.camera.position.y,2.35);
  c.camera.position.y=48;c.updateCamera(.016);assert.ok(c.camera.position.y>8.7);
});
