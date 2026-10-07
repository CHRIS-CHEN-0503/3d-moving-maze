import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const T=createRequire(import.meta.url)('../lib/three.min.js');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);let depth=0,at=html.indexOf('{',start);for(;at<html.length;at++){if(html[at]==='{')depth++;else if(html[at]==='}'&&--depth===0)break;}return html.slice(start,at+1);}
function recorder(log,name){return {clearRect(){},fillRect(){},beginPath(){},rect(){},moveTo(){log.push(name+':move');},lineTo(){},stroke(){log.push(name+':stroke');},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},closePath(){},fillText(){},drawImage(){log.push(name+':image');}};}

test('the minimap redraws its wall layer only when the walls change, and still paints it every refresh',()=>{
  const log=[],canvas=(name,w=240,h=240)=>({width:w,height:h,getContext:()=>recorder(log,name)});
  const walls=()=>Array.from({length:5},()=>Array(5).fill(false));
  const G={mazeW:5,mazeH:5,cell:4,hWalls:walls(),vWalls:walls(),px:0,pz:0,heading:0,mapUntil:0,items:[],exitCell:{x:4,y:4}};G.hWalls[1][2]=true;
  const c=vm.createContext({G,MP:{on:false},window:{},isShop:()=>false,magicMapEnabled:()=>false,worldToCell:()=>({x:0,y:0}),performance:{now:()=>0},document:{createElement:()=>canvas('layer')},globalThis:{}});
  vm.runInContext(fn('drawMap'),c);const mini=canvas('mini');
  const strokes=()=>log.filter(e=>e==='layer:stroke').length,images=()=>log.filter(e=>e==='mini:image').length;
  c.drawMap(mini,false);c.drawMap(mini,false);c.drawMap(mini,false);assert.equal(strokes(),1,'walls are stroked once');assert.equal(images(),3,'and pasted on every refresh');
  G.hWalls[1][2]=false;c.drawMap(mini,false);assert.equal(strokes(),2,'a broken wall redraws the layer');
  G.vWalls[3][1]=true;c.drawMap(mini,false);assert.equal(strokes(),3,'a shifted wall redraws the layer');
  mini.width=300;c.drawMap(mini,false);assert.equal(strokes(),4,'a resized map redraws');
  const big=canvas('big',600,600);c.drawMap(big,true);assert.equal(strokes(),5,'the big map keeps its own layer');c.drawMap(mini,false);assert.equal(strokes(),5);
  // Overlays drawn after the pasted layer still get the wall pen (2 px / 4 px, round caps).
  // As in a tower floor before the stairs appear (no exit marker restyles the pen first).
  const pens=[];const penCanvas=w=>{const ctx=recorder(log,'pen');return {width:w,height:w,getContext:()=>ctx};};
  c.window.TowerMode=c.TowerMode={active:true,mapMarkers:()=>[]};c.towerStairReveal={unlocked:false};c.window.MazeSight={map:ctx=>pens.push([ctx.lineWidth,ctx.lineCap,ctx.strokeStyle])};
  c.drawMap(penCanvas(240),false);c.drawMap(penCanvas(600),true);
  assert.deepEqual(pens,[[2,'round','rgba(255,255,255,.85)'],[4,'round','#b39ddb']]);
});

test('fixed pickup captions share one texture, story loot names stay per marker, and per-frame HUD text is compared first',()=>{
  const c=vm.createContext({THREE:T,document:{createElement:()=>({width:0,height:0,getContext:()=>({measureText:()=>({width:10}),strokeText(){},fillText(){}})})}});
  vm.runInContext(fn('makeTextSprite')+fn('makePickupMarker'),c);
  const tag=group=>group.children.find(child=>child.isSprite);
  const a=c.makePickupMarker(0xffd54f,'食物'),b=c.makePickupMarker(0xffd54f,'食物'),loot1=c.makePickupMarker(0xffd77c,'鐵劍 +1'),loot2=c.makePickupMarker(0xffd77c,'鐵劍 +1');
  assert.equal(tag(a).material.map,tag(b).material.map);assert.equal(tag(a).material.map.userData.sharedResource,true);assert.notEqual(tag(a).material,tag(b).material);
  assert.notEqual(tag(loot1).material.map,tag(loot2).material.map,'unbounded loot names are not cached');assert.notEqual(tag(loot1).material.map.userData.sharedResource,true);
  const checkout=fn('updateCheckoutBtn'),smell=fn('updateSmell'),satiety=fn('updateSatietyBar');
  assert.match(checkout,/if\(\$\('coCnt'\)\.textContent!==String\(left\)\)/);assert.match(checkout,/if\(\$\('coCnt'\)\.textContent!==cart\)/);
  assert.match(smell,/if\(\$\('smellTxt'\)\.textContent!==smell\)/);assert.match(smell,/if\(updateSmell\.turn!==turn\)/);
  assert.match(satiety,/if\(updateSatietyBar\.label!==label\)\{\$\('satietyWrap'\)\.setAttribute/);
  assert.match(html,/roomClock=MP\.on&&MP\.started&&\(MP\.mode==='tag'\|\|\['shop','treasure'\]\.includes\(MP\.mode\)&&!MP\.ended\|\|MP\.mode==='ctf'&&Number\.isFinite\(window\.CaptureFlag\?\.view\?\.\(\)\?\.deadline\)\);if\(!roomClock&&/,'timed rooms own their countdown clock');
  const frame=fn('mpFrame');assert.doesNotMatch(frame,/\$\('hudTime'\)\.textContent=/,'room countdowns compare before writing');assert.equal((frame.match(/setHudClock\(/g)||[]).length,3);
  assert.match(fn('updateCamera'),/camera\.position\.lerp\(cameraGoal\(tx,hh,tz\)/);assert.doesNotMatch(fn('updateCamera'),/lerp\(new V3/);
});
