import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),Z=require('../story/tower-hazards.js'),T=require('../lib/three.min.js'),C=require('../story/story-core.js'),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),N=require('../story/tower-narrative.js'),R=require('../story/tower-hero-growth.js');
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function grid(size=13,solid=false){return {hWalls:Array.from({length:size-1},()=>Array(size).fill(solid)),vWalls:Array.from({length:size},()=>Array(size-1).fill(solid))};}
function wallTrap(kind='wall_bolts',wallSide=0,clear=()=>true){return Z.place({kind,wallSide,tier:3,cx:4,cy:4,damage:14},{x:0,z:0},4,clear);}
function advance(trap,seconds,options={}){let p;for(let t=0;t<seconds-1e-7;t+=.1)p=Z.step(trap,Math.min(.1,seconds-t),options);return p;}
const localPoint=(t,x,z)=>({x:t.x+x*Math.cos(t.yaw)+z*Math.sin(t.yaw),z:t.z-x*Math.sin(t.yaw)+z*Math.cos(t.yaw)});

test('new wall traps use real supporting walls in all four orientations, never float in an open cell',()=>{
  for(let side=0;side<4;side++){
    const g=grid(9),x=4,y=4;
    if(side===0)g.hWalls[y-1][x]=true;if(side===1)g.vWalls[y][x]=true;if(side===2)g.hWalls[y][x]=true;if(side===3)g.vWalls[y][x-1]=true;
    assert.deepEqual(Z.wallsAt(x,y,9,g.hWalls,g.vWalls),[0,1,2,3].map(i=>i===side));
    const t={kind:'wall_bolts',cx:x,cy:y,wallSide:side};assert.ok(Z.supported(t,9,g.hWalls,g.vWalls));
    assert.equal(Z.supported(t,9,grid(9).hWalls,grid(9).vWalls),false);
  }
  const kinds=new Set();
  for(let seed=1;seed<=50;seed++){
    const opts={floor:35,seed,size:13,count:8,...grid(13,true)},traps=Z.layout(opts);
    assert.deepEqual(traps,Z.layout(opts));assert.ok(traps.length<=8);
    for(const t of traps){kinds.add(t.kind);assert.ok(Z.supported(t,13,opts.hWalls,opts.vWalls));}
    for(const t of Z.layout({...opts,...grid(13)}))if(Z.TYPES[t.kind].wall)assert.ok(t.cx===0||t.cy===0||t.cx===12||t.cy===12,'only the real perimeter wall can mount a mechanism in an open hall');
  }
  assert.equal(kinds.size,6);assert.deepEqual(Z.layout({floor:96,seed:1,size:13,...grid()}),[]);
  assert.ok(!Z.layout({floor:91,seed:1,size:13,...grid(13,true)}).some(t=>Z.TYPES[t.kind].wall));
});

test('wall volleys cover a corridor rather than one square, yet real walls clip both attack and mesh length',()=>{
  for(const kind of ['wall_bolts','wall_steam'])for(let side=0;side<4;side++){
    const t=wallTrap(kind,side);
    assert.ok(Z.contains(t,localPoint(t,1.5,0)),'one sidestep inside the same corridor does not evade the entire volley');
    assert.ok(Z.contains(t,localPoint(t,0,4)),'open continuation of the corridor is threatened');
    assert.equal(Z.contains(t,localPoint(t,2.4,0)),false);
    assert.equal(Z.contains(t,localPoint(t,0,-2)),false,'behind the mechanism is not its attack direction');
    assert.equal(Z.contains(t,localPoint(t,0,0),()=>false),false,'a wall always blocks even an in-rectangle target');
    const p=localPoint(t,0,2),clip=(ax,az,bx,bz)=>Math.hypot(bx-ax,bz-az)<=Math.hypot(p.x-t.source.x,p.z-t.source.z);
    const short=wallTrap(kind,side,clip);assert.ok(short.reach<t.reach);assert.ok(short.reach>2);
    assert.equal(Z.contains(short,localPoint(short,0,4)),false);
    assert.ok(Z.contains(short,localPoint(short,1.4,0)));
    if(kind==='wall_steam'){
      const model=Z.build(T,short);Z.animate(model,{state:'active',progress:.5},3);
      for(const puff of model.userData.moving.children){puff.geometry.computeBoundingBox();const b=puff.geometry.boundingBox;assert.ok(puff.position.z+b.max.z*puff.scale.z<=short.mouth+short.reach+1e-6,'visible puff never extends beyond clipped corridor');}
    }
  }
});

test('proximity warnings cannot be skipped, paused, skipped by tab stalls or resumed as unavoidable active damage',()=>{
  for(const kind of Object.keys(Z.TYPES)){
    const t={kind,tier:5};advance(t,40);assert.equal(Z.phase(t).state,'idle','no remote automatic red pulsing');
    assert.equal(Z.step(t,9,{inside:true}).state,'warning');assert.equal(Z.phase(t).progress,0,'entry frame never consumes warning time');
    assert.equal(Z.step(t,9,{inside:true}).state,'warning','one long frame cannot skip the warning');
    const before=Z.phase(t);Z.step(t,20,{paused:true});assert.deepEqual(Z.phase(t),before);
    Z.step(t,0);assert.deepEqual(Z.phase(t),before);
    Z.step(t,.1,{armed:false,inside:true});assert.equal(Z.phase(t).state,'idle');
    Z.step(t,.1,{inside:true});assert.equal(Z.phase(t).progress,0);advance(t,Z.WARNING_SECONDS-.01);assert.equal(Z.phase(t).state,'warning');
    advance(t,.02);assert.equal(Z.phase(t).state,'active');
    const reload={kind,tier:5};assert.equal(Z.phase(reload).state,'idle');assert.equal(Z.step(reload,.1,{inside:true}).state,'warning');
    t.heroRemoved=true;assert.equal(Z.step(t,.1,{inside:true}).state,'idle');
  }
});

test('real base-speed blind running can be hit, but observing and retreating after 0.2 seconds is safe',()=>{
  const baseSpeed=Number(/baseSpeed:([\d.]+)/.exec(read('index.html'))[1]);assert.equal(baseSpeed,5.2);
  for(const kind of Object.keys(Z.TYPES)){
    for(const retreat of [false,true]){
      const trap=Z.TYPES[kind].wall?wallTrap(kind):Z.place({kind,tier:3},{x:0,z:0}),point={x:-3,z:0};
      let sinceWarning=0,triggered=false,hit=false;
      for(let step=0;step<240;step++){
        point.x+=baseSpeed/120*(retreat&&sinceWarning>=.2?-1:1);
        const p=Z.step(trap,1/120,{inside:Z.contains(trap,point,()=>true,.22)});
        if(p.state==='warning'||triggered){triggered=true;sinceWarning+=1/120;}
        if(p.state==='active'&&Z.contains(trap,point)){hit=true;break;}
      }
      assert.ok(triggered,kind);assert.equal(hit,!retreat,kind+(retreat?' permits a reactive retreat':' catches unobservant straight running'));
    }
  }
});

test('scout has nearby identification; reveal skill extends it, but neither history nor walls reveal live traps',()=>{
  const t=wallTrap(),clear=()=>true,visible=()=>true,at=(x,extra={})=>({x,z:0,...extra});
  assert.equal(Z.detection(t,[at(1)],{clear,visible}),false,'non-scout sees physical clues, not a free warning overlay');
  assert.ok(Z.detection(t,[at(5.9,{scout:true})],{clear,visible}));
  assert.equal(Z.detection(t,[at(6.1,{scout:true})],{clear,visible}),false);
  assert.equal(Z.detection(t,[at(1,{scout:true,alive:false})],{clear,visible}),false);
  assert.ok(Z.detection(t,[at(11,{reveal:3})],{clear,visible}));
  assert.equal(Z.detection(t,[at(13,{reveal:3})],{clear,visible}),false);
  assert.equal(Z.detection(t,[at(1,{scout:true,reveal:7})],{clear:()=>false,visible}),false);
  assert.equal(Z.detection(t,[at(1,{scout:true,reveal:7})],{clear,visible:()=>false}),false,'explored cells cannot substitute for current visibility');
});

test('all six tells remain low-key at rest; scout marks and warnings use bounded original meshes with matching action sounds',()=>{
  const allowed=new Set(['metal','device','thorns','smoke','burst','bow']);
  for(const kind of Object.keys(Z.TYPES)){
    const t=Z.TYPES[kind].wall?wallTrap(kind):Z.place({kind,tier:3},{x:0,z:0}),model=Z.build(T,t);let meshes=0,vertices=0;
    model.traverse(o=>{assert.ok(!o.isLight&&!o.isSprite);if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;assert.ok(!o.material.map);}});
    assert.ok(meshes<=14);assert.ok(vertices<1600);assert.equal(model.userData.mark.visible,false);assert.equal(model.userData.material.emissive.getHex(),0);
    Z.animate(model,{state:'idle',progress:0},1,true);assert.ok(model.userData.mark.visible);
    Z.animate(model,{state:'idle',progress:0},2,false);assert.equal(model.userData.mark.visible,false);
    Z.animate(model,{state:'warning',progress:.5},3);assert.ok(model.userData.mark.visible);
    assert.ok(allowed.has(Z.TYPES[kind].sound));assert.ok(allowed.has(Z.TYPES[kind].warningSound));assert.ok(Z.TYPES[kind].warning&&Z.TYPES[kind].message);
  }
});

// Use the real hero runtime fixture: only the world/DOM boundary is stubbed.
const aimSource=read('tests/tower-auto-aim.test.mjs'),fa=aimSource.indexOf('function fixture('),fb=aimSource.indexOf('\nfunction position(',fa);
const heroFixture=vm.runInNewContext('('+aimSource.slice(fa,fb).replaceAll('new URL(\'../story/\'+file+\'.js\',import.meta.url)',"new URL('story/'+file+'.js',baseUrl)")+')',{vm,assert,require,readFileSync,URL,baseUrl:new URL('../',import.meta.url),C,H,P,N,R,T});
test('new wall mechanisms use the real scout disarm channel/progress and permanently stop activation',()=>{
  for(const kind of ['wall_bolts','wall_steam']){
    const f=heroFixture('disarm'),t={...wallTrap(kind),id:'84:4:4:'+kind,x:1,z:0,model:new T.Group()};f.ctx.hazards=()=>[t];
    assert.ok(f.ui.cast('disarm'));assert.equal(f.ui.workProgress().label,'拆解陷阱');assert.equal(f.ui.workProgress().ratio,0);
    f.ui.tick(.5);assert.ok(f.ui.workProgress().ratio>0);assert.equal(t.heroRemoved,undefined);
    f.pause(true);const paused=f.ui.workProgress().ratio;f.ui.tick(10);assert.equal(f.ui.workProgress().ratio,paused);f.pause(false);
    for(let i=0;i<45;i++)f.ui.tick(.1);
    assert.equal(f.ui.workProgress(),null);assert.ok(t.heroRemoved);assert.equal(t.model.visible,false);assert.ok(H.state(f.run()).removedTraps.includes(t.id));
    assert.equal(Z.step(t,.1,{inside:true}).state,'idle');assert.ok(C.validateSave(f.run()));
  }
});

test('position API returns copies, not mutable companion or active player coordinates',()=>{
  const f=heroFixture(),at=f.ui.position('hero');at.x=123;assert.equal(f.G.px,0);assert.equal(f.ui.position('hero').x,0);assert.equal(f.ui.position('missing'),null);
});
