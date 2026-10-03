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
    const enabled=()=>ctx.active()&&!!r()?.party?.light;
    const ready=()=>enabled()&&r().status==='playing'&&G.running&&!G.shifting;
    const distance=p=>Math.hypot(G.px-p.x,G.pz-p.z);
    const clear=p=>ctx.clear(G.px,G.pz,p.x,p.z);
    function part(parent,geo,color,x,y,z,glow=false){const mesh=new T.Mesh(geo,glow?new T.MeshBasicMaterial({color}):new T.MeshLambertMaterial({color}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
    const box=(g,w,h,d,c,x,y,z,glow=false)=>part(g,new T.BoxGeometry(w,h,d),c,x,y,z,glow);
    function torchModel(){const g=new T.Group();g.name='traveller-torch';part(g,new T.CylinderGeometry(.045,.065,.8,6),0x805338,0,.4,0);part(g,new T.CylinderGeometry(.095,.07,.23,7),0xdfca9a,0,.87,0);const flame=part(g,new T.OctahedronGeometry(.16),0xffb547,0,1.1,0,true);flame.scale.y=1.65;part(g,new T.OctahedronGeometry(.085),0xffecaa,0,1.08,.06,true);g.userData.flame=flame;return g;}
    function sourceModel(style,color){
      const g=new T.Group();g.name='light-'+style;
      if(style==='crystal'||style==='rune'){
        part(g,new T.CylinderGeometry(.4,.53,.3,6),0x596674,0,.15,0);
        const crystal=part(g,new T.OctahedronGeometry(.36),color,0,1.05,0,true);crystal.scale.y=style==='rune'?1:1.8;
        if(style==='rune'){const ring=part(g,new T.TorusGeometry(.51,.035,4,12),0xaaa087,0,1.05,0);ring.rotation.x=.5;}
        else for(const x of [-.35,.35]){const c=part(g,new T.OctahedronGeometry(.2),color,x,.45,0,true);c.scale.y=1.7;c.rotation.z=-x;}
      }else if(style==='fungus'){
        for(const [x,z,h]of [[0,0,1.1],[-.35,.1,.6],[.28,.2,.75]]){part(g,new T.CylinderGeometry(.05,.1,h,5),0x9aae88,x,h/2,z);part(g,new T.SphereGeometry(h*.36,8,4,0,Math.PI*2,0,Math.PI/2),color,x,h,z,true);}
      }else if(style==='brazier'){
        part(g,new T.CylinderGeometry(.45,.3,.35,8),0x615651,0,.3,0);
        for(const x of [-.2,0,.2]){const f=part(g,new T.OctahedronGeometry(.2),color,x,.65,0,true);f.scale.y=1.8;}
      }else{
        box(g,.14,1.35,.14,0x6d5640,0,.675,0);box(g,.6,.1,.1,0x6d5640,.23,1.35,0);
        part(g,new T.CylinderGeometry(.23,.23,.46,6),color,.43,1.12,0,true);
        for(const y of [.86,1.4])part(g,new T.CylinderGeometry(.3,.24,.09,6),0x57636a,.43,y,0);
        for(const x of [.22,.64])box(g,.035,.5,.04,0x57636a,x,1.12,0);
      }
      return g;
    }
    function supplyModel(){
      const g=new T.Group();g.name='torch-materials';
      for(const z of [-.12,0,.12]){const stick=part(g,new T.CylinderGeometry(.045,.06,.65,5),0xbc9066,0,.64,z);stick.rotation.z=Math.PI/2;}
      box(g,.14,.19,.4,0xd8c9a4,0,.66,0);box(g,.35,.06,.32,0xe8ddbe,.24,.55,.07);
      g.add(ctx.marker(0xffcd85,'木枝與布條'));return g;
    }
    function addSource(point,style,color,name){
      const model=sourceModel(style,color);model.position.set(point.x,0,point.z);group.add(model);
      sources.push({...point,model,color,name});
    }
    function reset(){if(group){group.parent?.remove(group);ctx.dispose(group);}group=rig=carried=orb=profile=null;sources=[];supplies=[];lamps=[];nearSources=[];nearClock=0;panelRevision=null;}
    function build(random,used){
      reset();if(!enabled())return;
      profile=L.profile(ctx.environment().id,ctx.environment().underworld===true);rig=ctx.environment().rig;
      group=new T.Group();group.name='tower-lighting';ctx.world().add(group);
      // Keep a constant light count (no shader recompilation when walking past lamps).
      for(let i=0;i<3;i++){const light=new T.PointLight(0xffd19a,0,i===0?14:10.5,1.4);light.name='tower-light-slot-'+i;light.castShadow=false;group.add(light);lamps.push(light);}
      carried=torchModel();carried.scale.setScalar(.8);group.add(carried);
      orb=new T.Group();orb.name='daylight-orb';part(orb,new T.IcosahedronGeometry(.14,0),0xfff4cb,0,0,0,true);const ring=part(orb,new T.TorusGeometry(.26,.018,4,16),0xffe2a1,0,0,0,true);ring.rotation.x=Math.PI/2;group.add(orb);
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
    function status(){const power=L.robotLight(r());if(power)return '動力光源 · 永久照明 · '+(power.tier>=4?'日光術範圍':'火把範圍');const l=r().party.light;return l.daylight>0?'日光術 '+time(l.daylight):l.lit?'火把 '+time(l.fuel):'未點燈 · 火把 '+l.torches+' 支'+(l.fuel>0?'，餘火 '+time(l.fuel):'');}
    function hud(){
      const button=document.getElementById('towerLightBtn'),line=document.getElementById('towerLightStatus');if(!button)return;
      button.hidden=!enabled();line.hidden=!enabled();if(!enabled())return;
      const mode=L.portable(r());button.dataset.light=mode;button.disabled=G.shifting||!G.running;
      const power=L.robotLight(r()),symbol=power?'core':L.canCast(r())?'daylight':'torch';
      if(button.dataset.icon!==symbol){button.dataset.icon=symbol;button.innerHTML=icon(symbol);}
      button.style.color=power?'#'+power.color.toString(16).padStart(6,'0'):'';
      button.title=status()+' · '+(power?'查看核心與能源':symbol==='daylight'?'點擊施放日光術':'點擊使用火把')+'（L）';button.setAttribute('aria-label',power?'查看動力光源與核心':symbol==='daylight'?'施放日光術':'使用火把');line.textContent=status();
    }
    function quickUse(){if(!ready()||ctx.paused?.())return false;if(L.robotLight(r())){ctx.robotPanel?.();return true;}if(L.canCast(r())&&r().party.light.daylight>0){ctx.toast('日光術仍在照明。',1500,false);return false;}
      const mage=L.canCast(r()),result=mage?L.daylight(r(),r().revision):L.torch(r(),r().revision);if(!ctx.transact(result)){if(result.message)ctx.toast(result.message,2000,result.message);return false;}if(mage){if(!ctx.daylightCast?.())ctx.audio.sfxAction?.('magic');}else ctx.audio.sfxAction?.('smoke');updateVisual(0,true);hud();ctx.toast(result.message,1800,mage?false:result.message);return true;
    }
    function merchantCard(id){
      if(!enabled()||id!=='suHe'||!Object.hasOwn(r().party.light.bought,id))return '';
      const l=r().party.light,left=L.SHOP_STOCK-l.bought[id];
      return '<article class="tower-item tower-light-card"><details class="trade-item-details"><summary>'+icon('torch')+'<div><h3>旅人火把</h3><small>持有 '+l.torches+' · 剩 '+left+'</small></div><span class="trade-detail-indicator" aria-hidden="true">⌄</span></summary><p>照明五分鐘。沒有術士時，帶著火把探索黑暗中的道路。</p></details><div class="trade-card-actions">'+ctx.action('購買 '+L.TORCH_PRICE+' 幣','light-buy',id,!left||r().coins<L.TORCH_PRICE||l.torches>=99)+'</div></article>';
    }
    function panel(quiet=false){
      if(!ready())return;const run=r(),l=run.party.light;panelRevision=run.revision;
      const body='<div class="tower-grid tower-light-grid"><article class="tower-item tower-light-card">'+icon('torch')+'<h3>火把 · 五分鐘</h3><p>持有 '+l.torches+' 支'+(l.fuel>0?' · 目前餘量 '+time(l.fuel):'')+'</p><p>'+(root.TowerResourceIcons?.svg('wood')||'')+'木枝 '+l.wood+' · '+(root.TowerResourceIcons?.svg('cloth')||'')+'布條 '+l.cloth+'<br>沒有現成火把時，直接消耗木枝、布條各一份點燃，無須先製作。</p>'+ctx.action(l.lit?'熄滅並保留燃料':l.fuel>0?'重新點燃':'點燃火把','light-torch',null,!l.lit&&(l.daylight>0||!l.fuel&&!l.torches&&(!l.wood||!l.cloth)))+'</article><article class="tower-item tower-light-card">'+icon('daylight')+'<h3>日光術 · 十分鐘</h3><p>光照範圍比火把更大。這是術士的自帶本領，不占技能格；隊伍中有能行動的術士就能使用。</p><p>'+(l.daylight>0?'剩餘 '+time(l.daylight):L.canCast(run)?'隊伍可以施放日光術。':'隊伍目前沒有能施法的術士。')+'</p>'+ctx.action('施放日光術','light-daylight',null,!L.canCast(run)||l.cooldown>0)+'</article></div>'+(root.TowerCompactHelp?.render('照明使用說明','<p>直接點左側照明小圖，或按 L 使用。有術士時小圖會換成日光術，操作機器人時顯示內建動力光源。</p><p>日光術期間火把不耗燃料；閱讀、暫停與離線時不計時。營地與行商有固定照明，雜貨商也會販售火把。</p>')||'');
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
      const mode=L.portable(r()),power=L.robotLight(r());nearClock-=dt;
      if(nearClock<=0||force){nearClock=.15;const companions=(ctx.robotSources?.()||[]).filter(p=>distance(p)<p.radius&&clear(p));nearSources=[...sources.filter(p=>distance(p)<10.5&&clear(p)),...companions].sort((a,b)=>((b.radius||10.5)-distance(b))-((a.radius||10.5)-distance(a))).slice(0,2);}
      // A distant lamp is a beacon, not free illumination of the whole corridor.
      const ambientRadius=nearSources.reduce((value,p)=>Math.max(value,(p.radius||10.5)-distance(p)*1.15),profile.radius);
      const heroes=root.TowerHeroes,dayRange=r().party?.loadouts?Math.min(20,12+Math.max(0,...heroes.ids(r()).filter(id=>heroes.job(r(),id)==='mage').map(id=>heroes.level(r(),id)-1))):15;
      range=Math.max(ambientRadius,power?power.radius:mode==='daylight'?dayRange:mode==='torch'?10:profile.radius);
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
      const light=lamps[0];light.position.set(G.px,power?1.25:2.25,G.pz);light.color.setHex(power?power.color:mode==='daylight'?0xfff2d1:0xffc07a);light.distance=mode==='daylight'?Math.max(15,range+6):14;
      light.intensity=mode==='none'?0:mode==='daylight'?4.2:3.3;
      for(let i=0;i<2;i++){const source=nearSources[i],slot=lamps[i+1];slot.intensity=source?3.2:0;if(source){slot.color.setHex(source.color);slot.position.set(source.x,source.robot?1.25:1.8,source.z);slot.distance=source.robot?source.radius+4:10.5;}}
      carried.visible=!power&&mode==='torch'&&G.view!=='fp';orb.visible=!power&&mode==='daylight';
      const yaw=ctx.player()?.rotation.y||0;carried.position.set(G.px+Math.cos(yaw)*.38-Math.sin(yaw)*.24,1.23,G.pz-Math.sin(yaw)*.38-Math.cos(yaw)*.24);carried.rotation.y=yaw;
      orb.position.set(G.px,2.65,G.pz);orb.rotation.y=r().elapsed*.3;
    }
    function tick(dt){
      if(!enabled()||!group)return;
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
    return {install,build,reset,tick,hud,panel,quickUse,handle,merchantCard,updateVisual,reserved:()=>[...sources,...supplies],radius:()=>enabled()?range:null};
  }
  root.TowerLightingRuntime={create,icon};
})(typeof globalThis!=='undefined'?globalThis:this);
