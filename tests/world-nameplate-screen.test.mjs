import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),T=require('../lib/three.min.js');
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/function makeTextSprite\(text(?:,shared=false)?\)\{[\s\S]*?\n\}/)[0];
function fixture(){
  const canvases=[],ctx=vm.createContext({THREE:T,document:{createElement(tag){assert.equal(tag,'canvas');const canvas={width:0,height:0,getContext(){return {font:'',measureText(text){return {width:text.length*Number(this.font.match(/\d+/)[0])};},strokeText(){},fillText(){}};}};canvases.push(canvas);return canvas;}}});
  vm.runInContext(source,ctx);return {create:ctx.makeTextSprite,canvases};
}
function shader(material){const s={uniforms:{},vertexShader:T.ShaderLib.sprite.vertexShader,fragmentShader:T.ShaderLib.sprite.fragmentShader};material.onBeforeCompile(s);return s;}
test('world nameplates preserve authored scale, visibility, material opacity and the single existing canvas texture',()=>{
  const h=fixture(),sp=h.create('🛠️高塔補給商店');assert.equal(h.canvases.length,1);assert.equal(sp.material.map.image.width,256);assert.equal(sp.material.map.image.height,64);assert.deepEqual(sp.scale.toArray(),[2.6,.65,1]);assert.equal(sp.material.transparent,true);assert.equal(sp.material.depthWrite,false);
  sp.scale.set(4.4,.7,1);sp.visible=false;sp.material.opacity=.45;const map=sp.material.map;
  sp.onBeforeRender({getSize:t=>t.set(568,320)});assert.deepEqual(sp.scale.toArray(),[4.4,.7,1]);assert.equal(sp.visible,false);assert.equal(sp.material.opacity,.45);assert.equal(sp.material.map,map);assert.equal(h.canvases.length,1);
  sp.material.dispose();map.dispose();
});
test('CSS size ceilings are readable on short landscape screens and proportional on small widths',()=>{
  const h=fixture(),sp=h.create('補給商店'),s=shader(sp.material),limit=s.uniforms.worldLabelLimits.value;
  for(const [w,height,expectedHeight]of [[1440,900,44],[844,390,42.9],[568,320,36],[390,844,44]]){sp.onBeforeRender({getSize:t=>t.set(w,height)});assert.ok(Math.abs(limit.x*w/2-Math.min(w*.36,240))<1e-8);assert.ok(Math.abs(limit.y*height/2-expectedHeight)<1e-8);}
  sp.onBeforeRender({getSize:t=>t.set(0,0)});assert.ok(Number.isFinite(limit.x)&&Number.isFinite(limit.y));sp.material.map.dispose();sp.material.dispose();
});
test('all labels reuse their viewport record and shader uniform with no frame-time objects or resources',()=>{
  const h=fixture(),a=h.create('旅人甲'),b=h.create('旅人乙'),first=shader(a.material),second=shader(b.material),guard=h.create.screenGuard,size=guard.size,limits=guard.limits;
  assert.equal(first.uniforms.worldLabelLimits.value,second.uniforms.worldLabelLimits.value);assert.equal(a.material.customProgramCacheKey(),b.material.customProgramCacheKey());
  const renderer={getSize(target){assert.equal(target,size);return target.set(844,390);}};
  for(let n=0;n<500;n++){a.onBeforeRender(renderer);b.onBeforeRender(renderer);assert.equal(h.create.screenGuard,guard);assert.equal(guard.size,size);assert.equal(guard.limits,limits);}
  assert.equal(h.canvases.length,2);assert.doesNotMatch(source.slice(source.indexOf('sp.onBeforeRender='),source.indexOf('sp.scale.set')),/\bnew\b|setTimeout|setInterval|requestAnimationFrame/);
  for(const sp of [a,b]){sp.material.map.dispose();sp.material.dispose();}
});
test('actual Three sprite shaders receive only a shrink cap and an offscreen alpha fade, without changing the library',()=>{
  const h=fixture(),sp=h.create('旅人'),before={vertex:T.ShaderLib.sprite.vertexShader,fragment:T.ShaderLib.sprite.fragmentShader},s=shader(sp.material);
  assert.match(s.vertexShader,/uniform vec2 worldLabelLimits/);assert.match(s.vertexShader,/scale \*= min\(1\.0,/);assert.match(s.vertexShader,/smoothstep\(0\.88, 1\.0,/);assert.match(s.vertexShader,/worldLabelClip\.w > 0\.0/);assert.match(s.vertexShader,/abs\(cos\(rotation\)\)/);assert.match(s.fragmentShader,/opacity \* worldLabelFade/);
  assert.equal(s.vertexShader.match(/vec2 alignedPosition =/g).length,1);assert.equal(s.fragmentShader.match(/vec4 diffuseColor =/g).length,1);assert.equal(T.ShaderLib.sprite.vertexShader,before.vertex);assert.equal(T.ShaderLib.sprite.fragmentShader,before.fragment);
  assert.doesNotMatch(source,/\.visible\s*=|\.opacity\s*=|ShaderMaterial|PointLight|DirectionalLight/);sp.material.map.dispose();sp.material.dispose();
});
