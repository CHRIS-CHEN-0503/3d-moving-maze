/* Original low-poly lamps and torches; three reused, shadow-free lights per scene. */
(function(root){
  'use strict';
  const L=root.TowerLighting;
  const ICONS={torch:'<path d="m10 14-2 7h4l2-7M8 13h8M12 2c2 3 5 4 5 7a5 5 0 0 1-10 0c0-2 2-4 3-5v4c2-1 2-3 2-6Z"/>',daylight:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'};
  const icon=kind=>kind==='core'?(root.TowerHeroIcons?.svg('robot_core')||'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>'):'<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[kind]+'</svg>';
  const time=seconds=>Math.floor(Math.ceil(seconds)/60)+':'+String(Math.ceil(seconds)%60).padStart(2,'0');
  function create(ctx){
    const T=ctx.THREE,r=ctx.run,G=ctx.G;
    let group=null,sources=[],supplies=[],lamps=[],carried=null,orb=null,rig=null,profile=null,nearClock=0,nearSources=[],range=7,lastFuel=0,lastDaylight=0,panelRevision=null;
    // Skill flashes light the floor, walls and actors through one more permanent slot (dark when idle),
    // so the light count never changes during a fight. Battery mode builds no slot at all.
    let flashLight=null,flashLeft=0,flashTotal=0,flashPower=0;
    const enabled=()=>ctx.active()&&!!r()?.party?.light;
    const ready=()=>enabled()&&r().status==='playing'&&G.running&&!G.shifting;
    const distance=p=>Math.hypot(G.px-p.x,G.pz-p.z);
    const clear=p=>ctx.clear(G.px,G.pz,p.x,p.z);
    // Every lamp is authored as small primitives, then baked once into at most two vertex-coloured
    // meshes: a lit one (Lambert) and a self-lit one (Basic). Identical lamps share one baked geometry
    // and both materials for the floor; the whole lot is released with the lighting group.
    let materials=null;const baked=new Map();
    const surface=glow=>{materials=materials||{};return glow?materials.glow||(materials.glow=new T.MeshBasicMaterial({vertexColors:true})):materials.lit||(materials.lit=new T.MeshLambertMaterial({vertexColors:true}));};
    function authored(){
      const list=[],add=(geo,color,x,y,z,glow=false,pose={})=>{list.push({geo,color,x,y,z,glow,pose});};
      return {list,add,box:(w,h,d,c,x,y,z,glow,pose)=>add(new T.BoxGeometry(w,h,d),c,x,y,z,glow,pose)};
    }
    function bake(list){
      const buckets=[{p:[],n:[],c:[]},{p:[],n:[],c:[]}],matrix=new T.Matrix4(),quaternion=new T.Quaternion(),euler=new T.Euler(),position=new T.Vector3(),scale=new T.Vector3(),color=new T.Color();
      for(const item of list){
        const {rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}=item.pose,geo=item.geo.index?item.geo.toNonIndexed():item.geo,bucket=buckets[item.glow?1:0];
        geo.applyMatrix4(matrix.compose(position.set(item.x,item.y,item.z),quaternion.setFromEuler(euler.set(rx,ry,rz)),scale.set(sx,sy,sz)));color.setHex(item.color);
        const xyz=geo.attributes.position,normal=geo.attributes.normal;
        for(let i=0;i<xyz.count;i++){bucket.p.push(xyz.getX(i),xyz.getY(i),xyz.getZ(i));bucket.n.push(normal.getX(i),normal.getY(i),normal.getZ(i));bucket.c.push(color.r,color.g,color.b);}
        if(geo!==item.geo)geo.dispose();item.geo.dispose();
      }
      return buckets.map(b=>{if(!b.p.length)return null;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('color',new T.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();return g;});
    }
    function bakedModel(name,key,compose){
      if(!baked.has(key)){const a=authored();compose(a);baked.set(key,bake(a.list));}
      const g=new T.Group();g.name=name;
      for(const [index,geometry]of baked.get(key).entries())if(geometry){const mesh=new T.Mesh(geometry,surface(index===1));mesh.name=index?'lamp-glow-batch':'lamp-lit-batch';g.add(mesh);}
      return g;
    }
    function torchModel(){const g=bakedModel('traveller-torch','torch',a=>{a.add(new T.CylinderGeometry(.045,.065,.8,6),0x805338,0,.4,0);a.add(new T.CylinderGeometry(.095,.07,.23,7),0xdfca9a,0,.87,0);a.add(new T.OctahedronGeometry(.16),0xffb547,0,1.1,0,true,{sy:1.65});a.add(new T.OctahedronGeometry(.085),0xffecaa,0,1.08,.06,true);});g.userData.flame=g.getObjectByName('lamp-glow-batch');return g;}
    function sourceModel(style,color){
      return bakedModel('light-'+style,style+':'+color,a=>{
        if(style==='crystal'||style==='rune'){
          a.add(new T.CylinderGeometry(.4,.53,.3,6),0x596674,0,.15,0);
          a.add(new T.OctahedronGeometry(.36),color,0,1.05,0,true,{sy:style==='rune'?1:1.8});
          if(style==='rune')a.add(new T.TorusGeometry(.51,.035,4,12),0xaaa087,0,1.05,0,false,{rx:.5});
          else for(const x of [-.35,.35])a.add(new T.OctahedronGeometry(.2),color,x,.45,0,true,{sy:1.7,rz:-x});
        }else if(style==='fungus'){
          for(const [x,z,h]of [[0,0,1.1],[-.35,.1,.6],[.28,.2,.75]]){a.add(new T.CylinderGeometry(.05,.1,h,5),0x9aae88,x,h/2,z);a.add(new T.SphereGeometry(h*.36,8,4,0,Math.PI*2,0,Math.PI/2),color,x,h,z,true);}
        }else if(style==='brazier'){
          a.add(new T.CylinderGeometry(.45,.3,.35,8),0x615651,0,.3,0);
          for(const x of [-.2,0,.2])a.add(new T.OctahedronGeometry(.2),color,x,.65,0,true,{sy:1.8});
        }else{
          a.box(.14,1.35,.14,0x6d5640,0,.675,0);a.box(.6,.1,.1,0x6d5640,.23,1.35,0);
          a.add(new T.CylinderGeometry(.23,.23,.46,6),color,.43,1.12,0,true);
          for(const y of [.86,1.4])a.add(new T.CylinderGeometry(.3,.24,.09,6),0x57636a,.43,y,0);
          for(const x of [.22,.64])a.box(.035,.5,.04,0x57636a,x,1.12,0);
        }
      });
    }
    function supplyModel(){
      const g=bakedModel('torch-materials','supply',a=>{
        for(const z of [-.12,0,.12])a.add(new T.CylinderGeometry(.045,.06,.65,5),0xbc9066,0,.64,z,false,{rz:Math.PI/2});
        a.box(.14,.19,.4,0xd8c9a4,0,.66,0);a.box(.35,.06,.32,0xe8ddbe,.24,.55,.07);
      });
      g.add(ctx.marker(0xffcd85,'木枝與布條'));return g;
    }
    function addSource(point,style,color,name){
      const model=sourceModel(style,color);model.position.set(point.x,0,point.z);group.add(model);
      sources.push({...point,model,color,name});
    }
    function reset(){if(group){group.parent?.remove(group);ctx.dispose(group);}group=rig=carried=orb=profile=materials=null;baked.clear();sources=[];supplies=[];lamps=[];nearSources=[];nearClock=0;panelRevision=null;flashLight=null;flashLeft=flashTotal=flashPower=0;}
    function build(random,used){
      reset();if(!enabled())return;
      profile=L.profile(ctx.environment().id,ctx.environment().underworld===true);rig=ctx.environment().rig;
      group=new T.Group();group.name='tower-lighting';ctx.world().add(group);
      // Keep a constant light count (no shader recompilation when walking past lamps).
      for(let i=0;i<3;i++){const light=new T.PointLight(0xffd19a,0,i===0?14:10.5,1.4);light.name='tower-light-slot-'+i;light.castShadow=false;group.add(light);lamps.push(light);}
      if(root.MazeQuality?.mode?.()!=='battery'){flashLight=new T.PointLight(0xffffff,0,8,1.6);flashLight.name='tower-light-slot-skill';flashLight.castShadow=false;group.add(flashLight);}
      carried=torchModel();carried.scale.setScalar(.8);group.add(carried);
      orb=bakedModel('daylight-orb','orb',a=>{a.add(new T.IcosahedronGeometry(.14,0),0xfff4cb,0,0,0,true);a.add(new T.TorusGeometry(.26,.018,4,16),0xffe2a1,0,0,0,true,{rx:Math.PI/2});});group.add(orb);
      const entry=ctx.cell(0,0);
      // Entrance camp and every travelling merchant have a permanent lamp.
      addSource({...entry,x:entry.x+.8,z:entry.z+.65},'lantern',0xffd28b,ctx.inDungeon()?'裂隙引路燈':'旅人營地');
      for(const merchant of ctx.traders())addSource({...merchant,x:merchant.x+.75,z:merchant.z+.65},'lantern',0xffd28b,'行商營地');
      const count=Math.min(6,2+Math.floor(G.mazeW/5));
      for(let i=0;i<count;i++){const p=ctx.chooseCell(random,used);addSource(p,profile.style,profile.color,profile.name);}
      if(!ctx.inDungeon()&&!root.TowerLoot)for(let i=0;i<L.supplyCount(G.mazeW);i++){
        const id='light-supply-'+i,p=ctx.chooseCell(random,used),model=supplyModel();model.position.set(p.x,0,p.z);model.visible=!r().party.light.gathered.includes(id);group.add(model);supplies.push({...p,id,model,retry:0});
      }
      lastFuel=r().party.light.fuel;lastDaylight=r().party.light.daylight;updateVisual(0,true);hud();
    }
    function install(){
      const summary=document.querySelector('#towerHud .tower-hud-summary'),button=document.createElement('button');
      button.id='towerLightBtn';button.type='button';button.hidden=true;button.setAttribute('aria-label','照明工具（L）');button.setAttribute('aria-keyshortcuts','L');button.innerHTML=icon('torch');summary.insertBefore(button,document.getElementById('towerHudToggle'));
      ctx.bind(button,quickUse);
      const status=document.createElement('div');status.id='towerLightStatus';status.hidden=true;document.getElementById('towerHudDetails').appendChild(status);
    }
    function status(light=L.portableInfo(r())){const l=r().party.light;return light.mode==='daylight'?'日光術 '+time(l.daylight):light.mode==='torch'?'火把 '+time(l.fuel):light.mode==='core'?(light.cores===2?'雙核心':light.cores===1?'單核心':'內建微光')+'動力光源 · 永久照明':'未點燈 · 火把 '+l.torches+' 支'+(l.fuel>0?'，餘火 '+time(l.fuel):'');}
    // The HUD refreshes at a fixed cadence, but its nodes change rarely (the label only each second).
    // Remember what was last written to these two nodes and touch the DOM only for a difference.
    let shown=null;
    function hud(){
      const button=document.getElementById('towerLightBtn'),line=document.getElementById('towerLightStatus');if(!button)return;
      if(!shown||shown.button!==button||shown.line!==line)shown={button,line,hidden:null,light:null,disabled:null,symbol:null,color:null,title:null,label:null,text:null};
      const on=enabled();
      if(shown.hidden!==!on){button.hidden=!on;line.hidden=!on;shown.hidden=!on;}
      if(!on)return;
      const info=L.portableInfo(r()),mode=info.mode,disabled=!!(G.shifting||!G.running);
      if(shown.light!==mode){button.dataset.light=mode;shown.light=mode;}
      if(shown.disabled!==disabled){button.disabled=disabled;shown.disabled=disabled;}
      const power=L.robotLight(r()),symbol=L.canCast(r())?'daylight':power?'core':'torch';
      if(shown.symbol!==symbol||button.dataset.icon!==symbol){button.dataset.icon=symbol;button.innerHTML=icon(symbol);shown.symbol=symbol;}
      const color=symbol==='core'?'#'+power.color.toString(16).padStart(6,'0'):'';
      if(shown.color!==color){button.style.color=color;shown.color=color;}
      const text=status(info),title=text+' · '+(symbol==='daylight'?'點擊施放日光術':'點擊使用火把；核心請從背包管理')+'（L）',label=symbol==='daylight'?'施放日光術':'使用火把';
      if(shown.title!==title){button.title=title;shown.title=title;}
      if(shown.label!==label){button.setAttribute('aria-label',label);shown.label=label;}
      if(shown.text!==text){line.textContent=text;shown.text=text;}
    }
    function quickUse(){if(!ready()||ctx.paused?.())return false;if(L.canCast(r())&&r().party.light.daylight>0){ctx.toast('日光術仍在照明。',1500,false);return false;}
      const mage=L.canCast(r()),result=mage?L.daylight(r(),r().revision):L.torch(r(),r().revision);if(!ctx.transact(result)){if(result.message)ctx.toast(result.message,2000,result.message);return false;}if(mage){if(!ctx.daylightCast?.())ctx.audio.sfxAction?.('magic');}else ctx.audio.sfxAction?.('smoke');updateVisual(0,true);hud();ctx.toast(result.message,1800,mage?false:result.message);return true;
    }
    function merchantCard(id){
      if(!enabled()||id!=='suHe'||!Object.hasOwn(r().party.light.bought,id))return '';
      const l=r().party.light,left=L.SHOP_STOCK-l.bought[id];
      return '<article class="tower-item tower-light-card"><details class="trade-item-details"><summary>'+icon('torch')+'<div><h3>旅人火把</h3><small>持有 '+l.torches+' · 剩 '+left+'</small></div><span class="trade-detail-indicator" aria-hidden="true">⌄</span></summary><p>照明五分鐘。沒有術士時，帶著火把探索黑暗中的道路。</p></details><div class="trade-card-actions">'+ctx.action('購買 '+L.TORCH_PRICE+' 幣','light-buy',id,!left||r().coins<L.TORCH_PRICE||l.torches>=99)+'</div></article>';
    }
    function panel(quiet=false){
      if(!ready())return;const run=r(),l=run.party.light;panelRevision=run.revision;
      const body='<div class="tower-grid tower-light-grid"><article class="tower-item tower-light-card">'+icon('torch')+'<h3>火把 · 五分鐘</h3><p>持有 '+l.torches+' 支'+(l.fuel>0?' · 目前餘量 '+time(l.fuel):'')+'</p><p>'+(root.TowerResourceIcons?.svg('wood')||'')+'木枝 '+l.wood+' · '+(root.TowerResourceIcons?.svg('cloth')||'')+'布條 '+l.cloth+'<br>沒有現成火把時，直接消耗木枝、布條各一份點燃，無須先製作。</p>'+ctx.action(l.lit?'熄滅並保留燃料':l.fuel>0?'重新點燃':'點燃火把','light-torch',null,!l.lit&&(l.daylight>0||!l.fuel&&!l.torches&&(!l.wood||!l.cloth)))+'</article><article class="tower-item tower-light-card">'+icon('daylight')+'<h3>日光術 · 十分鐘</h3><p>光照範圍比火把更大。這是術士的自帶本領，不占技能格；隊伍中有能行動的術士就能使用。</p><p>'+(l.daylight>0?'剩餘 '+time(l.daylight):L.canCast(run)?'隊伍可以施放日光術。':'隊伍目前沒有能施法的術士。')+'</p>'+ctx.action('施放日光術','light-daylight',null,!L.canCast(run)||l.cooldown>0)+'</article></div>'+(root.TowerCompactHelp?.render('照明使用說明','<p>直接點左側照明小圖，或按 L 使用。隊伍有能行動的術士時可直接施放日光術，不受帶隊職業影響；核心從背包管理。</p><p>光照範圍：單核心小於火把、火把小於雙核心、雙核心小於日光術。全隊採最強來源，切換帶隊角色不會換光；日光術與雙核心期間火把不耗燃料。閱讀、暫停與離線時不計時。</p><p>營地與行商有固定照明，雜貨商也會販售火把。</p>')||'');
      ctx.dialog('照明工具 · 暫停中','帶著光繼續前進',status(),body,ctx.action('裝備背包','bag')+ctx.action('回到迷宮','close'),{silent:quiet,summary:'照明工具。點左側小圖直接使用，火把五分鐘；日光術十分鐘。'});
    }
    function handle(key,id){
      if(!key.startsWith('light-'))return false;if(!ready())return true;
      if(key==='light-panel'){panel();return true;}
      let result;
      if(key==='light-buy'){
        const merchant=ctx.traders().find(m=>m.id===id&&distance(m)<2.6&&clear(m));
        if(!merchant)return true;result=L.buy(r(),id,r().revision);
      }else if(panelRevision===r().revision){
        if(key==='light-craft')result=L.craft(r(),panelRevision);
        if(key==='light-torch')result=L.torch(r(),panelRevision);
        if(key==='light-daylight'){
          result=L.daylight(r(),panelRevision);
        }
      }
      if(!result)return true;
      if(ctx.transact(result)){
        if(key!=='light-daylight')ctx.audio.sfxAction?.(key==='light-torch'?'smoke':'device');updateVisual(0,true);hud();
        if(key==='light-buy')ctx.trade(true);else if(key==='light-craft')panel(true);else ctx.close();
        if(key==='light-daylight'&&!ctx.daylightCast?.())ctx.audio.sfxAction?.('magic');
        ctx.toast(result.message,2000,key==='light-daylight'?false:result.message);
      }
      return true;
    }
    function updateVisual(dt,force=false){
      if(!group||!enabled())return;
      const portable=L.portableInfo(r()),mode=portable.mode,power=mode==='core'?portable:null;nearClock-=dt;
      if(nearClock<=0||force){nearClock=.15;const companions=mode==='daylight'?[]:(ctx.robotSources?.()||[]).filter(p=>distance(p)<p.radius&&clear(p));nearSources=[...sources.filter(p=>distance(p)<10.5&&clear(p)),...companions].sort((a,b)=>((b.radius||10.5)-distance(b))-((a.radius||10.5)-distance(a))).slice(0,2);}
      // A distant lamp is a beacon, not free illumination of the whole corridor.
      const ambientRadius=nearSources.reduce((value,p)=>Math.max(value,(p.radius||10.5)-distance(p)*1.15),profile.radius);
      range=Math.max(ambientRadius,portable.radius||profile.radius);
      // Keep the player clear when the third-person camera is pulled back. The
      // extra distance belongs to the camera, not to the player's sight range.
      if(rig?.fog){
        const camera=ctx.camera();
        if(G.view==='top'){
          const height=Math.abs(camera.position.y);rig.fog.near=Math.hypot(height,range*.6);rig.fog.far=Math.hypot(height,range*1.8);
        }else{
          const offset=G.view==='tp'?Math.hypot(camera.position.x-G.px,camera.position.y-1.5,camera.position.z-G.pz):0;
          rig.fog.near=offset+range*.6;rig.fog.far=offset+range*1.8;
        }
      }
      const light=lamps[0];light.position.set(G.px,power?1.25:2.25,G.pz);light.color.setHex(portable.color);light.distance=mode==='daylight'?Math.max(L.DAYLIGHT_RADIUS,range+6):power?power.radius+4:14;
      light.intensity=mode==='none'?0:mode==='daylight'?4.2:power?power.cores===2?3.8:power.cores===1?2.8:2:3.3;
      for(let i=0;i<2;i++){const source=nearSources[i],slot=lamps[i+1];slot.intensity=source?3.2:0;if(source){slot.color.setHex(source.color);slot.position.set(source.x,source.robot?1.25:1.8,source.z);slot.distance=source.robot?source.radius+4:10.5;}}
      carried.visible=!power&&mode==='torch'&&G.view!=='fp';orb.visible=!power&&mode==='daylight';
      const yaw=ctx.player()?.rotation.y||0;carried.position.set(G.px+Math.cos(yaw)*.38-Math.sin(yaw)*.24,1.23,G.pz-Math.sin(yaw)*.38-Math.cos(yaw)*.24);carried.rotation.y=yaw;
      orb.position.set(G.px,2.65,G.pz);orb.rotation.y=r().elapsed*.3;
    }
    // A short burst of coloured light where a skill is cast or lands. The strongest current burst wins.
    function flash(at,color=0xffffff,power=2,seconds=.25){
      if(!flashLight||!at||!Number.isFinite(at.x)||!Number.isFinite(at.z)||!(power>0)||!(seconds>0))return false;
      const current=flashTotal>0?flashPower*Math.pow(flashLeft/flashTotal,2):0;if(current>power)return false;
      flashLight.position.set(at.x,Number.isFinite(at.y)?at.y:1.4,at.z);flashLight.color.setHex(color);flashLight.distance=Math.min(12,6+power*1.2);
      flashPower=Math.min(8,power);flashTotal=flashLeft=Math.min(1.2,seconds);flashLight.intensity=flashPower;return true;
    }
    function decayFlash(dt){if(!flashLight||flashLeft<=0)return;flashLeft=Math.max(0,flashLeft-dt);flashLight.intensity=flashLeft>0?flashPower*Math.pow(flashLeft/flashTotal,2):0;}
    function tick(dt){
      if(!enabled()||!group)return;
      decayFlash(Math.max(0,Number(dt)||0));
      updateVisual(dt);const l=r().party.light;
      if(lastFuel>0&&l.fuel===0)ctx.toast('火把燃盡了，找個亮處補充吧。',2500,'火把燃盡了');
      if(lastDaylight>0&&l.daylight===0)ctx.toast('日光術結束了。',2000,'日光術結束了');
      lastFuel=l.fuel;lastDaylight=l.daylight;
      for(const supply of supplies){
        if(!supply.model.visible)continue;supply.retry=Math.max(0,supply.retry-dt);
        if(!supply.retry&&distance(supply)<1.05&&clear(supply)){
          supply.retry=3;const result=L.gather(r(),supply.id,r().revision);
          if(ctx.transact(result)){supply.model.visible=false;ctx.audio.sfxPickup();ctx.toast(result.message,2000,result.message);}
        }
      }
    }
    return {install,build,reset,tick,hud,panel,quickUse,handle,merchantCard,updateVisual,flash,reserved:()=>[...sources,...supplies],radius:()=>enabled()?range:null};
  }
  root.TowerLightingRuntime={create,icon};
})(typeof globalThis!=='undefined'?globalThis:this);
