import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),T=require('../lib/three.min.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),towerMode=read('story/tower-mode.js'),partyRuntime=read('story/tower-party-runtime.js');
// Extract one named function (balanced braces) from a source file.
function extract(source,name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,'missing '+name);
  let depth=0,at=source.indexOf('{',start);for(;at<source.length;at++){const ch=source[at];if(ch==='{')depth++;else if(ch==='}'&&--depth===0)break;}
  return source.slice(start,at+1);
}

test('startup survives browsers without AbortSignal.timeout instead of aborting the whole game script',()=>{
  assert.doesNotMatch(html,/signal:AbortSignal\.timeout\(/);
  const make=env=>{const c=vm.createContext({setTimeout:(fn,ms)=>{env.timers.push(ms);return 1;},...env.globals});vm.runInContext(extract(html,'timeoutSignal'),c);return c.timeoutSignal;};
  const legacy={timers:[],globals:{AbortSignal:class{},AbortController}};const signal=make(legacy)(5000);assert.ok(signal instanceof AbortSignal);assert.deepEqual(legacy.timers,[5000]);
  assert.equal(make({timers:[],globals:{}})(5000),undefined,'no abort support simply means no timeout');
  const modern=make({timers:[],globals:{AbortSignal,AbortController}})(5000);assert.ok(modern instanceof AbortSignal);
});

test('an interrupted iOS audio context is resumed on the next gesture, while running or closed contexts are left alone',()=>{
  const method=html.match(/\n resume\(\)\{[^\n]*\},\n/)[0].trim().replace(/,$/,'');
  const engine=vm.runInNewContext('({'+method+'})');
  for(const [state,expected]of [['suspended',1],['interrupted',1],['running',0],['closed',0]]){let calls=0;engine.ctx={state,resume(){calls++;return Promise.reject(new Error('needs a gesture'));}};engine.resume();assert.equal(calls,expected,state);}
  engine.ctx=null;assert.doesNotThrow(()=>engine.resume());
  const init=html.slice(html.indexOf(' init(){'),html.indexOf(' resume(){'));
  for(const type of ['touchend','pointerdown','keydown'])assert.match(init,new RegExp("'"+type+"'"));assert.match(init,/visibilitychange/);
  assert.match(read('assets/classic-audio.js'),/context\.state !== 'running' && context\.state !== 'closed'/);
});

test('forged multiplayer packets cannot inject markup or crash a lobby through avatars, money maps or series totals',()=>{
  const c=vm.createContext({CHARS:[{emoji:'A'},{emoji:'B'}]});for(const name of ['escapeHtml','safeCharIdx','safeRoster','moneyMap'])vm.runInContext(extract(html,name),c);
  assert.equal(c.safeCharIdx(99),0);assert.equal(c.safeCharIdx(-1),0);assert.equal(c.safeCharIdx('1'),0);assert.equal(c.safeCharIdx(1),1);
  const roster=c.safeRoster([{id:'p1',name:'<b>x</b>',charIdx:99},null,{id:5},{id:'p2',name:'ok',charIdx:1,bot:true}],[]);
  assert.equal(roster.length,2);assert.equal(roster[0].charIdx,0);assert.equal(roster[1].bot,true);assert.deepEqual(c.safeRoster('not a list',['kept']),['kept']);
  const money=c.moneyMap({p1:'<img src=x onerror=alert(1)>',p2:12.6,p3:-4,p4:1e12,['__proto__']:5});
  assert.deepEqual(JSON.parse(JSON.stringify(money)),{p2:13,p3:0,p4:1e7});c.money=money;assert.equal(vm.runInContext('Object.getPrototypeOf(money)===Object.prototype',c),true,'a __proto__ key cannot swap the prototype');
  assert.equal(c.escapeHtml('<img onerror=x>'),'&lt;img onerror=x&gt;');
  const shopEnd=html.slice(html.indexOf("    case 'shopend':{"),html.indexOf("$('cartWrap').style.display='none';"));
  assert.match(shopEnd,/MP\.carts=moneyMap\(m\.carts\)/);assert.match(shopEnd,/MP\.banked=moneyMap\(m\.banked\)/);assert.match(shopEnd,/MP\.shopBonus=moneyMap\(m\.shopBonus\)/);assert.doesNotMatch(shopEnd,/\$\$\{r\.[vb]\}/);
  assert.match(html,/MP\.roster=safeRoster\(m\.players,MP\.roster\); MP\.mode=m\.mode;/);assert.match(html,/MP\.order=m\.order; MP\.roster=safeRoster\(m\.players,MP\.roster\);/);
  const capture=read('assets/capture-mode.js');assert.match(capture,/擊退 '\+count\(m\.hits\)\+'／接力 '\+count\(m\.passes\)\+'／'\+count\(m\.points\)/);
  const count=vm.runInNewContext(capture.match(/const count=([^;]+);/)[1]);assert.equal(count('<svg onload=1>'),0);assert.equal(count('7'),7);assert.equal(count(-3),0);
  assert.match(read('assets/mode-variants.js'),/const bell=id=>Math\.max\(0,Math\.min\(150,Math\.round\(Number\(state\.progress\[id\]\?\.score\)\|\|0\)\)\)/);
});

test('a whistle gather never places anyone inside a wall, deterministically on every device',()=>{
  // 5 x 5 maze of 4 m cells with a wall slab east of the centre cell.
  const G={cell:4,mazeW:5,mazeH:5,wallBoxes:[{minX:1.75,maxX:2.25,minZ:-2,maxZ:2},{minX:-2,maxX:2,minZ:1.75,maxZ:2.25}]};
  const c=vm.createContext({G});for(const name of ['playerInWall','worldToCell','cellToWorld','gatherSpot'])vm.runInContext(extract(html,name),c);
  const spread=[[0,0],[1.1,0],[-1.1,0],[0,1.1],[0,-1.1],[0.8,0.8],[-0.8,-0.8]];
  for(const [x,z] of [[1.2,0],[1.2,1.2],[-1.3,1.2],[0,0],[.9,-.4]])for(const o of spread){
    const a=c.gatherSpot(x,z,o),b=c.gatherSpot(x,z,o);assert.deepEqual({...a},{...b});assert.equal(c.playerInWall(a.x,a.z),false,`${x},${z} + ${o}`);
  }
  assert.deepEqual({...c.gatherSpot(-.5,0,[0,0])},{x:-.5,z:0},'an open caller spot is kept exactly');
});

test('cloak and invisibility fades restore each material’s own translucency instead of forcing everything opaque',()=>{
  const shadow=new T.MeshBasicMaterial({transparent:true,opacity:.17}),cheek=new T.MeshBasicMaterial({transparent:true,opacity:.09}),body=new T.MeshLambertMaterial(),group=new T.Group();
  group.add(new T.Mesh(new T.PlaneGeometry(),shadow),new T.Mesh(new T.PlaneGeometry(),[cheek,body]));
  const G={invisUntil:0,ghostUntil:0},c=vm.createContext({playerGroup:group,G,performance:{now:()=>1000}});vm.runInContext(extract(html,'fadePlayer'),c);vm.runInContext(extract(html,'setGhostLook'),c);
  c.setGhostLook(true);assert.equal(body.transparent,true);assert.equal(body.opacity,.45);assert.equal(shadow.opacity,.17,'never brighter than authored');
  c.fadePlayer(.35);assert.equal(body.opacity,.35);c.setGhostLook(false);
  assert.deepEqual([shadow.transparent,shadow.opacity,cheek.transparent,cheek.opacity,body.transparent,body.opacity],[true,.17,true,.09,false,1]);
  G.invisUntil=5000;c.setGhostLook(true);c.setGhostLook(false);assert.equal(body.opacity,.35,'invisibility outlasting the cloak stays faded');c.fadePlayer(null);assert.equal(body.opacity,1);
});

test('classic timing and view fixes: time gems cannot produce negative runs and an owl flight does not leak into the next round',()=>{
  assert.match(html,/G\.elapsed=Math\.max\(0,\(performance\.now\(\)-G\.startTime\)\/1000-G\.timeOffset\);/);
  const reset=html.indexOf("G.kites=0; G.whistles=0; G.visionUntil=0; G.owlUntil=0; G.viewBefore=null;");assert.ok(reset>0);
  assert.match(html.slice(reset-160,reset),/if\(G\.viewBefore\)G\.view=G\.viewBefore;/);
});

test('robot core slots get readable HUD labels and new-journey backups stay bounded',()=>{
  const labels=vm.runInNewContext('('+towerMode.match(/const GEAR_SLOT_LABELS = Object\.freeze\((\{[^}]+\})\)/)[1]+')');
  for(const slot of ['helmet','armor','shield','weapon','core1','core2'])assert.equal(typeof labels[slot],'string');
  const store=new Map(),localStorage={get length(){return store.size;},key:i=>[...store.keys()][i]??null,removeItem:k=>store.delete(k),setItem:(k,v)=>store.set(k,v)};
  const SAVE='maze3d_tower_v1';for(const at of [5,1,9,3,7])store.set(SAVE+'_before_heroes_'+at,'old');store.set(SAVE,'current');store.set(SAVE+'_before_heroes_note','keep');store.set(SAVE+'_before_underworld','keep');
  const c=vm.createContext({localStorage,SAVE});vm.runInContext(extract(towerMode,'pruneHeroBackups'),c);c.pruneHeroBackups(2);
  assert.deepEqual([...store.keys()].filter(k=>/_before_heroes_\d+$/.test(k)).sort(),[SAVE+'_before_heroes_7',SAVE+'_before_heroes_9']);
  for(const key of [SAVE,SAVE+'_before_heroes_note',SAVE+'_before_underworld'])assert.ok(store.has(key));
  const broken=vm.createContext({localStorage:{get length(){throw new Error('blocked');}},SAVE});vm.runInContext(extract(towerMode,'pruneHeroBackups'),broken);assert.doesNotThrow(()=>broken.pruneHeroBackups(2));
  assert.match(towerMode,/pruneHeroBackups\(2\);localStorage\.setItem\(SAVE\+'_before_heroes_'\+Date\.now\(\),old\)/);
});

test('companion AI skips strikes the core must reject and keeps mechanical aid inside its real cast radius',()=>{
  const runs={robot:{fuel:0},shocked:{shock:true},ready:{}};
  const c=vm.createContext({modern:()=>true,r:()=>runs,H:{job:(run,id)=>id==='robot'||id==='ready-robot'?'robot':'swordsman',ROBOT:{powered:(run,id)=>id==='ready-robot'}},root:{TowerAffixes:{attackBlocked:(run,id)=>id==='shocked'}}});
  vm.runInContext(extract(partyRuntime,'strikeReady'),c);
  assert.equal(c.strikeReady('robot'),false);assert.equal(c.strikeReady('shocked'),false);assert.equal(c.strikeReady('ready'),true);assert.equal(c.strikeReady('ready-robot'),true);
  assert.match(partyRuntime,/if\(enemy&&m\.cooldown<=0&&strikeReady\(m\.id\)&&/);
  assert.match(partyRuntime,/r\(\)\.effects\.reveal=Math\.max\(r\(\)\.effects\.reveal\|\|0,seconds\)/);
  const growth=read('story/tower-growth-runtime.js');assert.match(growth,/const aidNear=near\.filter\(k=>dist\(p,pos\(k\)\)<=4\)/);assert.match(growth,/else R\.state\(r\(\)\)\.policies\[id\]\.thinkLeft=Math\.max\(/);
  const heroGrowth=read('story/tower-hero-growth.js');assert.match(heroGrowth,/const aid=Array\.isArray\(combat\.aidNear\)\?combat\.aidNear:near;/);
  assert.match(read('story/tower-heroes-runtime.js'),/s\.effect==='mech_aid'\?4:6/,'cast radius the AI now respects');
});

test('skill-effect textures and shaders survive a floor teardown that disposes the old scene',()=>{
  const c=vm.createContext({_texCache:{},spriteCache:{},makePickupMarker:{ringGeom:null,beamGeom:null,materials:{}}});vm.runInContext(extract(html,'disposeSceneObject'),c);
  const shared=new T.MeshBasicMaterial({map:new T.DataTexture(new Uint8Array(4),1,1)}),own=new T.MeshBasicMaterial(),geometry=new T.PlaneGeometry();shared.userData.sharedResource=true;shared.map.userData.sharedResource=true;
  const events=[];shared.addEventListener('dispose',()=>events.push('shared'));shared.map.addEventListener('dispose',()=>events.push('map'));own.addEventListener('dispose',()=>events.push('own'));
  const root=new T.Group();root.add(new T.Mesh(geometry,shared),new T.Mesh(geometry,own));c.disposeSceneObject(root);assert.deepEqual(events,['own']);
  const effects=read('story/tower-skill-effects.js');assert.match(effects,/for\(const map of \[glow,petal,mist\]\)map\.userData\.sharedResource=true;/);assert.match(effects,/particleMaterial\.userData\.sharedResource=true;/);assert.match(effects,/shieldMaterial\.userData\.sharedResource=true;/);
});

test('returning from a rift regroups followers beside the player instead of leaving them at the floor entrance',()=>{
  assert.match(towerMode,/restoreWarriorPosition\(\);partyUI\?\.regroup\?\.\(\);/);
  const P=require('../story/tower-party-core.js'),C=require('../story/story-core.js'),N=require('../story/tower-narrative.js');
  let run=P.enable(C.newRun({seed:31415}),'swordsman').run;run.floor=84;run.floorsCleared=15;run.chronicle=N.newChronicle(84);P.advance(run);
  run.party.members=['swordsman','mage','healer'].map((profession,i)=>({id:'companion:test:'+profession,profession,sex:P.PROFESSIONS[profession].gender,level:1,hp:20,cooldown:0,hurtLeft:0}));run.party.joined=run.party.members.map(m=>m.id);
  const world=new T.Group(),player=new T.Group(),G={px:0,pz:0,running:true,shifting:false};let nextCell=1;
  const context=vm.createContext({TowerMaterials:require('../story/tower-materials.js'),TowerResourceIcons:require('../story/tower-resource-icons.js'),TowerPartyCore:P,TowerExpedition:require('../story/tower-expedition-core.js'),TowerCharacters:require('../story/tower-characters.js'),TowerMonsterSense:require('../story/tower-monster-sense.js'),TowerFieldGuide:require('../story/tower-field-guide.js'),document:{getElementById:()=>null}});vm.runInContext(partyRuntime,context);
  const ui=context.TowerPartyRuntime.create({THREE:T,G,core:C,text:String,action:()=>'',dialog(){},transact:result=>{if(!result.ok)return false;run=result.run;return true;},save:()=>true,toast(){},audio:{sfxHit(){},sfxSwing(){},sfxUse(){},sfxGuardBlock(){}},quest(){},
    run:()=>run,paused:()=>false,inDungeon:()=>false,world:()=>world,monsters:()=>[],traders:()=>[],player:()=>player,clear:()=>true,cell:(cx,cy)=>({cx,cy,x:cx*4,z:cy*4}),worldToCell:(x,z)=>({x:Math.round(x/4),y:Math.round(z/4)}),chooseCell:()=>({cx:nextCell,cy:0,x:nextCell++*4,z:0}),makeText:()=>new T.Group(),follow:()=>false,dispose(){},damage(){},bind(){},swing(){}});
  ui.build(()=>.5,new Set());const models=()=>world.children.at(-1).children.filter(m=>m.userData.companionId);assert.equal(models().length,3);
  G.px=36;G.pz=-28;player.position.set(36,0,-28);ui.regroup();
  for(const model of models())assert.ok(Math.hypot(model.position.x-36,model.position.z+28)<1.5,model.userData.companionId);
  const list=models();for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++)assert.ok(list[a].position.distanceTo(list[b].position)>.4);
});

test('a guest checkout within one position update of the register is accepted, and a refusal unfreezes the guest explicitly',()=>{
  const C=require('../assets/shop-claims-core.js');let time=10000;const packets=[];
  const MP={on:true,started:true,ended:false,host:true,id:'h',mode:'shop',seed:31,seriesRound:1,round:0,roster:[{id:'h'},{id:'g'}],players:{g:{tx:2.5,tz:0}},cartList:{g:[1]},carts:{g:11},banked:{},coUntil:{},bots:[]};
  const G={goods:[],shifting:false,frozen:false,stunnedUntil:0,registers:[{x:0,z:0}]};
  const c=vm.createContext({MP,G,ShopClaimsCore:C,window:{GameplayRules:require('../assets/gameplay-rules.js')},performance:{now:()=>time},GOODS:[],SHOP_RESTOCK_MS:6000,CHECKOUT_RANGE:2,CHECKOUT_MS:5000,RoomLifecycle:{sendLocal(){}},cartAdd(){},botPosOf:()=>({x:0,z:0}),isCheckingOut:()=>false,AudioEng:{sfxCoin(){}},showToast(){},updateShopHud(){},mpFrame(){},mpLeave(){},mpSend:m=>packets.push(m),mpHandle(){}});
  vm.runInContext(read('assets/shop-claims.js'),c);
  c.mpHandle({t:'costart',f:'g',ms:5000,sr:1});assert.ok(MP.coUntil.g>time,'0.5 m of position lag is accepted');assert.equal(packets.filter(p=>p.t==='coend').length,0);
  for(let frame=0;frame<5;frame++){time+=16;c.mpFrame(.016);}assert.ok(MP.coUntil.g>time,'the host’s own per-frame check keeps the same lag allowance');assert.equal(packets.filter(p=>p.t==='coend').length,0);
  time+=5000;c.mpHandle({t:'goodpay',f:'g',sr:1,key:'31:1'});
  MP.coUntil.g=0;const fresh=vm.createContext({...c,MP:{...MP,players:{g:{tx:3.6,tz:0}},coUntil:{}}});vm.runInContext(read('assets/shop-claims.js'),fresh);
  fresh.mpHandle({t:'costart',f:'g',ms:5000,sr:1});assert.ok(!(fresh.MP.coUntil.g>time),'too far is still refused');assert.deepEqual(packets.filter(p=>p.t==='coend').map(p=>p.f),['g'],'and the guest is told');
  const stunned=vm.createContext({...c,MP:{...MP,players:{g:{tx:2.5,tz:0,stunnedUntil:time+3000}},coUntil:{}}});vm.runInContext(read('assets/shop-claims.js'),stunned);packets.length=0;
  stunned.mpHandle({t:'costart',f:'g',ms:5000,sr:1});assert.deepEqual(packets.filter(p=>p.t==='coend').map(p=>p.f),['g'],'a stunned guest is unfrozen with an explicit refusal');
});

test('first-person shovel and kite aim where the camera looks, not the last walking direction',()=>{
  const G={view:'fp',heading:0,camYaw:Math.PI/2,px:0,pz:0,wallBoxes:[{minX:-.25,maxX:.25,minZ:1.75,maxZ:2.25,id:'north'},{minX:-2.25,maxX:-1.75,minZ:-.25,maxZ:.25,id:'west'}]};
  const c=vm.createContext({G});vm.runInContext(extract(html,'findWallAhead'),c);
  assert.equal(c.findWallAhead().id,'west','camera yaw π/2 looks toward −x');G.view='tp';assert.equal(c.findWallAhead().id,'north','other views keep the body heading');
});

test('the floating 3D compass arrow can actually appear: only its group toggles visibility',()=>{
  const build=html.slice(html.indexOf('compass3D=new THREE.Mesh('),html.indexOf('compass3D=cGroup;'));
  assert.doesNotMatch(build,/compass3D\.visible=false/);assert.match(build,/cGroup\.visible=false/);
  assert.match(extract(html,'updateCompass'),/compass3D\.visible=true;/);
});

test('a hidden tab pauses a solo classic round and silences item music, while rooms keep their clock',()=>{
  const block=html.slice(html.indexOf('const SOLO_DEADLINES='),html.indexOf('\n});',html.indexOf('let soloHiddenAt=0;'))+4);
  const run=({mp=false}={})=>{
    let now=10000,listener;const audio={loops:0,stops:0,startItemLoop(){this.loops++;},stopItemLoop(){this.stops++;},shiftSound:null,combatSound:null};
    const G={running:true,startTime:4000,nextShiftAt:70000,ghostUntil:12000,shovelRechargeAt:0,radarNextAt:9000,effects:{speed:{until:15000,label:'加速'}}};
    const document={hidden:false,addEventListener:(type,fn)=>{if(type==='visibilitychange')listener=fn;}};
    vm.runInNewContext(block,{document,G,MP:{on:mp},AudioEng:audio,performance:{now:()=>now},window:{}});
    document.hidden=true;listener();now+=300000;document.hidden=false;listener();return {G,audio};
  };
  const solo=run();assert.equal(solo.G.startTime,304000);assert.equal(solo.G.nextShiftAt,370000);assert.equal(solo.G.ghostUntil,312000);assert.equal(solo.G.effects.speed.until,315000);
  assert.equal(solo.G.shovelRechargeAt,0,'unset timers stay unset');assert.equal(solo.G.radarNextAt,9000,'already-expired deadlines are not revived');
  assert.equal(solo.audio.stops,1);assert.equal(solo.audio.loops,1,'item music resumes for still-active effects');
  const room=run({mp:true});assert.equal(room.G.startTime,4000);assert.equal(room.G.nextShiftAt,70000);assert.equal(room.audio.stops,1);
});

test('touch controls keep the joystick thumb out of second-finger steals and pinch zoom; rank replies cannot go stale',()=>{
  const touch=extract(html,'setupTouch');
  assert.match(touch,/if\(joy\.active&&\[\.\.\.e\.touches\]\.some\(t=>t\.identifier===joy\.id\)\)return;/);
  assert.match(html,/const fingers=\[\.\.\.e\.touches\]\.filter\(t=>!\(joy\.active&&t\.identifier===joy\.id\)\);/);assert.match(html,/addEventListener\('touchcancel',\(\)=>\{pinchDist=0;\}\)/);
  const win=extract(html,'winGame');assert.match(win,/\$\('winRank'\)\.textContent='';/);assert.match(win,/if\(rankToken!==winGame\.rankToken\)return;/);
  assert.match(extract(html,'saveRecord'),/signal:timeoutSignal\(8000\)/);
});

test('saving checks cheap migration conditions first and validates the previous save at most once',()=>{
  const save=extract(towerMode,'save');
  assert.equal((save.match(/C\.validateSave\(previous\)/g)||[]).length,1,'only inside the memoised helper');
  assert.match(save,/const validPrevious=\(\)=>\{if\(!previousChecked\)\{previousChecked=true;previousIsValid=!!C\.validateSave\(previous\);\}return previousIsValid;\};/);
  for(const line of save.split('\n').filter(l=>l.includes('validPrevious()')))assert.match(line,/&&validPrevious\(\)\)localStorage\.setItem/,'validation is the last condition');
  assert.match(save,/localStorage\.setItem\(SAVE, JSON\.stringify\(run\)\); saveFailed = false; return true;/,'a later failure warns again');
});

test('restocking a shop shelf frees the replaced label texture but keeps shared emoji and marker resources',()=>{
  const shared=new T.CanvasTexture({width:1,height:1}),ringGeom=new T.RingGeometry(),markerMat=new T.MeshBasicMaterial(),events=[];
  const label=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture({width:1,height:1})})),emoji=new T.Sprite(new T.SpriteMaterial({map:shared})),marker=new T.Mesh(ringGeom,markerMat);
  label.material.map.addEventListener('dispose',()=>events.push('label-texture'));shared.addEventListener('dispose',()=>events.push('shared-texture'));ringGeom.addEventListener('dispose',()=>events.push('ring'));markerMat.addEventListener('dispose',()=>events.push('marker-material'));
  const itemGroup=new T.Group();itemGroup.add(label,emoji,marker);
  const G={goods:[{sprite:emoji,tag:label,marker,spawnSerial:1}]},c=vm.createContext({G,itemGroup,GOODS:[{emoji:'🍎',price:3}],cellToWorld:()=>({x:0,z:0}),makeEmojiSprite:()=>new T.Sprite(new T.SpriteMaterial({map:shared})),makeTextSprite:()=>new T.Sprite(new T.SpriteMaterial()),makePickupMarker:Object.assign(()=>new T.Mesh(ringGeom,markerMat),{ringGeom,beamGeom:null,materials:{a:{m:markerMat}}}),_texCache:{},spriteCache:{'🍎':shared}});
  vm.runInContext(extract(html,'disposeSceneObject')+extract(html,'placeGood'),c);c.placeGood(0,0,0,0);
  assert.deepEqual(events,['label-texture']);assert.equal(G.goods[0].spawnSerial,2);assert.equal(itemGroup.children.includes(label),false);
});

test('an arrow already in flight still lands when its archer is shocked; a shocked archer cannot start a new swing',()=>{
  const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),F=require('../story/tower-affixes.js');
  let run=H.enable(P.enable(C.newRun({seed:7}),'archer','female').run).run;const spec=P.monsterSpecs(run)[0];assert.ok(spec);
  const shocked=JSON.parse(JSON.stringify(run));const applied=F.apply(shocked,H.state(shocked).active,'shock');assert.ok(F.attackBlocked(shocked,H.state(shocked).active),'fixture is shocked'+(applied?'':' (apply returned falsy)'));
  const melee=H.strike(shocked,spec.id,{front:true},shocked.revision);assert.equal(melee.ok,false);assert.match(melee.message,/電麻/);
  const shot=H.strike(shocked,spec.id,{front:true,shot:true},shocked.revision);assert.doesNotMatch(shot.message||'',/電麻/);
});

test('a quiet refresh keeps the scroll position only on the same page; switching a tab or workshop view starts at the top',()=>{
  const body=towerMode.slice(towerMode.indexOf('  function dialog('),towerMode.indexOf('  function openBattleSettings('));
  assert.match(body,/const pageMarks=\[\.\.\.new Set\(String\(body\|\|''\)\.match\(/);assert.match(body,/const pageKey=kicker\+'\|'\+title\+'\|'\+pageMarks/);
  const marks=b=>[...new Set(String(b).match(/aria-current="page"[^>]*?data-item="[^"]*"|data-forge-page="[a-z]+"/g)||[])].join(',');
  const gear='<button aria-current="page" class="is-current tower-btn" data-tower="hero-tab" data-item="gear">裝備</button>',skills='<button aria-current="page" class="is-current tower-btn" data-tower="hero-tab" data-item="skills">技能</button>';
  assert.notEqual(marks(gear),marks(skills));assert.notEqual(marks('<div data-forge-page="list">'),marks('<div data-forge-page="detail">'));assert.equal(marks('<div data-forge-page="list"></div><div data-forge-page="list">'),marks('<div data-forge-page="list">'));
});

test('invisibility ends from the main loop (which honours paused time), never from a background timer',()=>{
  const skill=html.slice(html.indexOf('G.invisUntil=now+secs*1000;'),html.indexOf('G.invisUntil=now+secs*1000;')+400);
  assert.doesNotMatch(skill,/setTimeout/);assert.match(skill,/fadePlayer\(0\.35\);G\.invisFaded=true;/);
  assert.match(html,/if\(G\.invisFaded&&performance\.now\(\)>=G\.invisUntil\)\{G\.invisFaded=false;fadePlayer\(null\);if\(performance\.now\(\)<G\.ghostUntil\)fadePlayer\(0\.45\);\}/);
});

test('a skill already cast (and paid for) still lands when its archer is shocked in flight; a fresh swing is still refused',async()=>{
  const {add}=await import('./tower-cooperation-fixtures.mjs');
  const C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js'),F=require('../story/tower-affixes.js');
  let run=H.enable(P.enable(C.newRun({seed:53,name:'電麻'}),'swordsman').run).run;run.floor=84;run.floorsCleared=15;P.advance(run);
  const id=add(run,'archer','piercing_arrow','archer');run.bag.arrow=20;const spec=P.monsterSpecs(run)[0];
  const cast=H.cast(run,'piercing_arrow',{actorId:id},run.revision);assert.equal(cast.ok,true,cast.message);run=cast.run;
  F.apply(run,id,'shock');assert.equal(F.attackBlocked(run,id),true);
  const fresh=P.strike(run,spec.id,{memberId:id,front:true},run.revision);assert.equal(fresh.ok,false);assert.match(fresh.message,/電麻/);
  const landed=P.strike(run,spec.id,{memberId:id,skillId:'piercing_arrow',shot:false,front:true},run.revision);assert.equal(landed.ok,true,landed.message);
  const twice=P.strike(landed.run,spec.id,{memberId:id,skillId:'piercing_arrow',front:true},landed.run.revision);assert.equal(twice.ok,false,'one cast still hits a target once');
  assert.equal(H.cast(landed.run,'piercing_arrow',{actorId:id},landed.run.revision).ok,false,'a shocked archer cannot cast a new skill');
});
