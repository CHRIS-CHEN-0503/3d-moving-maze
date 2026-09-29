/* Original low-poly expedition presentation. Uses the existing render/update loop. */
(function(root){
  'use strict';
  function create(ctx){
    const P=root.TowerPartyCore,X=root.TowerExpedition,T=ctx.THREE,V=root.TowerCharacters,H=root.TowerHeroes;
    const modern=()=>!!r()?.party?.loadouts,records=()=>modern()?H.followerRecords(r()):r().party.members;
    const heroes=root.TowerHeroesRuntime?.create({...ctx,actors:()=>actors,safeCamp,syncActors,hit:applyHit,portrait,walkClear:(a,b)=>walkClear(a,b)});
    let actors=[],queue=[],queueClock=0,stations=[],near=null,offer=null,group=null,pulse=0,uiClock=0,skillLeft=0,guardVoiceLeft=0,worldFloor=null,worldSeed=null,working=null,pendingForge=null,pendingDismantle=null,pendingRepair=null,forgeSelected=null;
    const r=()=>ctx.run(), enabled=()=>!!r()?.party, live=()=>enabled()&&(modern()||!ctx.inDungeon())&&worldFloor===r().floor&&worldSeed===r().seed;
    const esc=ctx.text,act=ctx.action;
    const distance=p=>Math.hypot(ctx.G.px-p.x,ctx.G.pz-p.z);
    const clear=p=>ctx.clear(ctx.G.px,ctx.G.pz,p.x,p.z);
    const QUEUE_GAP=1.8,BODY_GAP=1.15;
    const walkClear=(a,b)=>ctx.followClear?ctx.followClear(a,b):ctx.clear(a.x,a.z,b.x,b.z);
    const part=(parent,geometry,color,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true}));m.position.set(x,y,z);parent.add(m);return m;};
    const ball=(p,s,c,x,y,z)=>part(p,new T.SphereGeometry(s,8,6),c,x,y,z);
    const box=(p,a,b,c,color,x,y,z)=>part(p,new T.BoxGeometry(a,b,c),color,x,y,z);
    const ring=(p,size,color)=>{const mesh=part(p,new T.TorusGeometry(size,.04,4,20),color,0,.07,0);mesh.rotation.x=Math.PI/2;return mesh;};
    function label(model,name,y=2.65){const tag=ctx.makeText(name);tag.position.y=y;tag.scale.set(1.65,.28,1);model.add(tag);model.userData.partyTag=tag;return tag;}
    function healthBar(model,color,y=2.15){const back=new T.Sprite(new T.SpriteMaterial({color:0x192939,depthWrite:false})),bar=new T.Sprite(new T.SpriteMaterial({color,depthWrite:false}));back.position.y=bar.position.y=y;back.scale.set(1,.08,1);bar.scale.set(.94,.055,1);back.renderOrder=1;bar.renderOrder=2;model.add(back,bar);model.userData.partyHp=bar;model.userData.partyHpBack=back;}
    function portrait(job){const colors={swordsman:'#83b5dc',mage:'#b99bff',scout:'#82dfbf',chef:'#ffd69c',healer:'#b9e6c4',smith:'#cca383'},c=colors[job];const paths={swordsman:'M25 5 10 22l-4 5m4-9 9 8m-7-5 4 4',mage:'m12 26 9-18m-2-4 2 4 5 1-4 3 1 5-4-3-4 1 2-5-2-4Z',scout:'M6 14h20M8 14l4-7h8l5 7M9 18v6h14v-6m-10 1v2m6-2v2',chef:'M9 18c-9-7 1-14 7-8 6-6 16 1 7 8v9H9Zm1 6h12',healer:'M16 28V10M16 20C4 23 3 9 14 13m2 3C28 17 29 4 18 8',smith:'m7 27 13-14M14 8l5-5 10 10-5 5Z M6 23l4 4'};return '<svg class="party-glyph" viewBox="0 0 32 32" aria-hidden="true" style="color:'+c+'"><path d="'+paths[job]+'"/></svg>';}
    function foodArt(id){const mushroom=id==='mushroom',herb=id==='herb',root=id==='root',shell=id==='shell',meat=id==='meat',nectar=id==='nectar';return '<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+(mushroom?'<path fill="#f0dbc6" d="M27 19h10v23H27z"/><path fill="#c88fae" d="M8 23C9 0 54 0 56 23Z"/><circle fill="#ffeacd" cx="23" cy="16" r="3"/>':herb?'<path stroke="#4eaf81" stroke-width="4" d="M30 44 36 8"/><ellipse fill="#88cf9a" cx="22" cy="24" rx="13" ry="7"/><ellipse fill="#b8e29e" cx="42" cy="13" rx="12" ry="7"/>':root?'<path fill="#d6ac68" d="M14 18Q54 5 49 27T10 39Z"/><path stroke="#649b69" stroke-width="4" d="m47 16 10-8m-9 8 0-12"/>':shell?'<path fill="#bba690" d="M9 39Q3 1 32 5q29-4 23 34Z"/><path stroke="#816e59" fill="none" d="M32 7v29M17 12l8 23m22-23-8 23"/>':meat?'<path fill="#d7836c" d="M9 34Q5 8 29 10t26 24Q27 49 9 34"/><path stroke="#f9d5b9" fill="none" stroke-width="5" d="M18 27q9-12 24 2"/>':nectar?'<path fill="#e9b750" d="M31 3Q5 31 18 40t26 0Q57 31 31 3"/><path stroke="#ffeb9d" stroke-width="4" d="M24 30q-4 7 3 9"/>':'<ellipse fill="#dfb775" cx="32" cy="26" rx="26" ry="10"/><path fill="#7da3b1" d="M6 26q4 21 26 20 22 1 26-20Z"/><circle fill="#86c69b" cx="22" cy="23" r="5"/><circle fill="#e3a273" cx="39" cy="26" r="6"/><path stroke="#d8e9e1" fill="none" stroke-width="2" d="M22 14q-5-5 0-10m12 10q-5-5 0-10m12 10q-5-5 0-10"/>')+'</svg>';}
    function ingredientModel(id){const model=new T.Group();if(id==='mushroom'){part(model,new T.CylinderGeometry(.13,.16,.55,8),0xead8bc,0,.28,0);part(model,new T.SphereGeometry(.45,10,6,0,Math.PI*2,0,Math.PI/2),0xca8db8,0,.48,0);}else if(id==='root'){const bulb=ball(model,.33,0xcfac76,0,.25,0);bulb.scale.set(1.3,.7,.8);for(let i=0;i<3;i++){const leaf=box(model,.12,.45,.035,0x83b776,(i-1)*.1,.6,0);leaf.rotation.z=(i-1)*.6;}}else if(id==='herb'){for(let i=0;i<4;i++){const leaf=ball(model,.2,0x8bc79a,(i%2?1:-1)*.12,.2+i*.1,0);leaf.scale.set(1.2,.5,.4);}}else if(id==='nectar'){part(model,new T.ConeGeometry(.25,.4,8),0xecc05d,0,.4,0);ball(model,.25,0xecc05d,0,.15,0);}else if(id==='shell'){const m=ball(model,.35,0xcab196,0,.2,0);m.scale.y=.6;}else{const m=ball(model,.35,0xda9682,0,.2,0);m.scale.y=.55;}return model;}
    function dishArt(id){
      const drawings={
        stew:'<path fill="#849eb2" d="M9 19h46v20q-23 14-46 0Z"/><ellipse fill="#ce9c63" cx="32" cy="20" rx="23" ry="9"/><path stroke="#64788e" stroke-width="4" fill="none" d="M9 24H3v12h6m46-12h6v12h-6"/><circle fill="#dcbd85" cx="23" cy="20" r="5"/><path fill="#a57284" d="M34 23q5-16 14 0Z"/>',
        broth:'<path fill="#d6e5cf" d="M9 20h40v19q-20 12-40 0Z"/><path stroke="#b5ccb9" stroke-width="5" fill="none" d="M49 25q22-2 0 13"/><ellipse fill="#9caf70" cx="29" cy="20" rx="20" ry="7"/><path stroke="#cff2ae" stroke-width="3" d="m18 17 8 6m4-7 7 7"/>',
        skewer:'<path stroke="#c1a17a" stroke-width="4" d="m8 44 45-37"/><path fill="#b28472" stroke="#e9bd6c" stroke-width="2" d="M12 30q-3-17 16-13L34 25ZM27 19q-3-17 16-13L49 14Z"/><path fill="#f5d68d" d="m17 31 5-6 5 3-6 6m13-17 6-6 4 4-6 5"/>',
        crab:'<ellipse fill="#cedbd4" cx="32" cy="32" rx="29" ry="12"/><path fill="#dc8b70" d="M10 31q1-23 20-11 11-17 23 5-14 15-43 6Z"/><path stroke="#835b47" stroke-width="2" d="m21 18 6 12m11-14 6 12"/><path fill="#94c875" d="m12 27-7-10 14 4"/>',
        soup:'<path fill="#dda971" d="M12 18h40v23q-20 10-40 0Z"/><ellipse fill="#f1d583" cx="32" cy="18" rx="20" ry="7"/><path stroke="#bf965b" stroke-width="3" d="m20 18 8 3m8-5 8 3"/><path stroke="#f8dfb6" fill="none" d="M25 8q-3-4 0-7m13 7q-3-4 0-7"/>',
        bento:'<rect fill="#b47f55" x="5" y="7" width="54" height="36" rx="6"/><rect fill="#f0d9ae" x="9" y="11" width="22" height="28" rx="3"/><path stroke="#745443" stroke-width="3" d="M33 8v33m0-17h23"/><path fill="#9dc681" d="M38 13h15v6H38z"/><path fill="#d79376" d="M38 28h15v9H38z"/>',
        salad:'<ellipse fill="#c7dcd0" cx="32" cy="32" rx="28" ry="13"/><path fill="#73b98b" d="M10 29q-7-22 13-14 1-19 15-6 23-8 17 11 9 24-20 16Z"/><path stroke="#c3e6a0" stroke-width="3" d="m15 19 14 12m5-17-3 16m19-8-16 10"/><circle fill="#dbb486" cx="24" cy="23" r="4"/>',
        feast:'<ellipse fill="#b5c9c8" cx="32" cy="34" rx="31" ry="12"/><path fill="#d59c71" d="M8 28q8-25 26 0Z"/><path fill="#d4dec5" d="M32 20h26v15q-13 10-26 0Z"/><ellipse fill="#e9bd71" cx="45" cy="20" rx="13" ry="6"/><path fill="#82b680" d="m14 34 7-14 8 15Z"/>',
      };
      return '<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+drawings[id]+'</svg>';
    }
    function memberModel(job,level,identity='companion'){
      if(modern()&&ctx.makeHero){const m=ctx.makeHero(job,identity);m.userData.partyProfession=job;return m;}
      const model=job==='swordsman'?V.buildWarrior(level,{THREE:T}):V.buildExplorer({mage:'sena',scout:'eve',chef:'rowan',healer:'mira',smith:'oren'}[job],{THREE:T});
      model.userData.partyProfession=job;
      if(job==='swordsman')return model;
      const color=P.PROFESSIONS[job].color;
      const mantle=box(model,.85,.22,.58,color,0,1.27,0);mantle.name='profession-mantle';
      if(job==='chef'){part(model,new T.CylinderGeometry(.27,.26,.45,8),0xf1ebda,0,2.15,0);ball(model,.29,0xf1ebda,0,2.35,0);}
      if(job==='mage'){part(model,new T.ConeGeometry(.33,.7,8),color,0,2.24,0);ball(model,.17,0xbbe9ee,-.55,1.6,0);}
      if(job==='smith'){box(model,.12,.75,.12,0x806043,-.5,.65,.13);box(model,.48,.22,.22,0x93a5b3,-.5,1.08,.13);}
      return model;
    }
    function monsterModel(kind,strength){
      if(!P.MONSTERS[kind])return null;const def=P.MONSTERS[kind],model=new T.Group(),body=new T.Group();model.add(body);body.position.y=1;
      if(kind==='mushroom'){part(body,new T.CylinderGeometry(.28,.38,1,8),0xe4d7be,0,-.4,0);part(body,new T.SphereGeometry(.86,12,7,0,Math.PI*2,0,Math.PI/2),def.color,0,.03,0);for(let i=0;i<5;i++)ball(body,.1,0xffe9c1,Math.cos(i*1.3)*.52,.42,Math.sin(i*1.3)*.52);}
      if(kind==='crab'){const shell=ball(body,.65,def.color,0,-.45,0);shell.scale.set(1.15,.6,1);for(const s of [-1,1]){for(let i=0;i<3;i++){const leg=box(body,.65,.09,.1,0x946d55,s*.7,-.7,(i-1)*.4);leg.rotation.z=s*.25;}ball(body,.3,0xd9b286,s*.7,-.3,.6);}}
      if(kind==='moth'){ball(body,.3,0x8b724a,0,0,0);for(const s of [-1,1]){const wing=ball(body,.6,def.color,s*.57,0,0);wing.scale.set(1,.13,.85);wing.name='party-wing';}}
      if(kind==='flower'){part(body,new T.CylinderGeometry(.18,.3,1.2,7),0x698d55,0,-.4,0);for(let i=0;i<6;i++){const petal=ball(body,.34,0xd58e9e,Math.cos(i*Math.PI/3)*.4,.38,Math.sin(i*Math.PI/3)*.4);petal.scale.y=.4;}ball(body,.3,0xe9c974,0,.38,0);}
      for(const s of [-1,1])ball(body,.08,0x223549,s*.2,0,.43);
      model.userData.body=body;model.userData.ring=ring(model,.92,0xe28476);model.userData.ring.material.transparent=true;model.userData.tag=label(model,def.name+' · '+strength+'/5');return model;
    }
    function stationModel(kind,index){const model=new T.Group();
      if(kind==='camp'){part(model,new T.CylinderGeometry(.6,.8,.16,8),0x657785,0,.08,0);for(let i=0;i<3;i++){const log=box(model,.9,.12,.12,0xc3a27b,0,.2,0);log.rotation.y=i*2;}const pot=part(model,new T.SphereGeometry(.44,10,7,0,Math.PI*2,0,Math.PI/2),0x859da8,0,.65,0);pot.rotation.z=Math.PI;label(model,'旅人營地',1.7);return model;}
      const d=X.BOSSES[r().floor],type=d.kind;
      part(model,new T.CylinderGeometry(.58,.7,.4,8),0x6e8593,0,.2,0);
      const seal=new T.Group();seal.name='seal';seal.position.y=1.2;model.add(seal);
      const turner=['mirror','reverse','gear'].includes(type)||type==='heart'&&index===1;
      if(turner){
        if(type==='gear'){const wheel=part(seal,new T.TorusGeometry(.48,.12,5,12),d.color);wheel.rotation.x=Math.PI/2;for(let i=0;i<6;i++)box(seal,.17,.17,.17,d.color,Math.sin(i*Math.PI/3)*.56,0,Math.cos(i*Math.PI/3)*.56);}
        else box(seal,.75,.9,.12,d.color,0,0,0);
        box(seal,.07,.06,1.15,0xffefb0,0,0,.67);
        const angle=X.target(r(),index)*Math.PI/2;ball(model,.18,0xffcc69,Math.sin(angle)*1.28,.17,Math.cos(angle)*1.28);
      }else if(type==='tide'||type==='steam'){part(seal,new T.TorusGeometry(.35,.07,4,10),d.color);box(seal,.7,.08,.1,d.color,0,0,0);}
      else if(type==='frost'){const bowl=part(seal,new T.SphereGeometry(.4,8,6,0,Math.PI*2,0,Math.PI/2),0x6f8c9d);bowl.rotation.z=Math.PI;part(seal,new T.ConeGeometry(.22,.65,6),0xffbf75,0,.3,0);}
      else part(seal,new T.OctahedronGeometry(.42),d.color);
      label(model,(type==='pulse'?'浮標':type==='frost'?'暖爐':type==='tide'?'水閘':type==='steam'?'壓力閥':type==='chase'?'定錨器':turner?'光針':'封印')+' '+(index+1),2.2);
      const warning=ring(model,1,d.color);warning.name='boss-warning';
      if(['tide','pulse'].includes(type)){const water=part(model,new T.CylinderGeometry(1,1,.045,24),0x548da3,0,.045,0);water.name='boss-water';water.material.transparent=true;water.material.opacity=.32;water.material.depthWrite=false;}
      for(let i=0;i<4;i++){
        const angle=i*Math.PI/2,arm=new T.Group();arm.name='boss-arm';arm.userData.angle=angle;arm.position.set(Math.sin(angle)*1.35,0,Math.cos(angle)*1.35);
        if(type==='chase'||type==='stone'){box(arm,type==='chase'?1.1:.65,1.25,.28,d.color,0,.63,0);arm.rotation.y=angle;}
        else if(type==='mirror'){part(arm,new T.ConeGeometry(.23,1.25,6),0x6b9d71,0,.63,0);}
        else if(type==='steam'){part(arm,new T.CylinderGeometry(.13,.2,.55,6),0x88705e,0,.27,0);ball(arm,.25,0xd8ccbb,0,.75,0);ball(arm,.3,0xd8ccbb,0,1.05,0);}
        else if(type==='frost'){part(arm,new T.ConeGeometry(.24,1.35,5),0xcbeff1,0,.67,0);}
        else if(type==='gear'){const wheel=part(arm,new T.TorusGeometry(.45,.1,4,10),d.color,0,.48,0);box(arm,1,.1,.1,d.color,0,.48,0);wheel.name='gear-wheel';}
        else if(type==='tide'||type==='pulse'){box(arm,.7,.12,.25,0xaee8e6,0,.1,0);arm.rotation.y=angle;}
        else{const blade=box(arm,.15,1.4,.45,d.color,0,.7,0);blade.rotation.z=.35;}
        arm.scale.y=.08;model.add(arm);
      }
      return model;
    }
    function siteModel(job){const model=new T.Group(),c=P.PROFESSIONS[job].color;
      if(['swordsman','scout'].includes(job)){for(const s of [-1,1])box(model,.25,1.55,.32,0x98a6aa,s*.55,.78,0);box(model,1.35,.23,.38,0xb6c0b8,0,1.55,0);box(model,.85,1.1,.2,c,0,.65,0);}
      else if(job==='mage'){part(model,new T.OctahedronGeometry(.48),c,0,.9,0);const circle=ring(model,.7,c);circle.position.y=.35;}
      else if(job==='chef'){box(model,1,.55,.8,0x9a7658,0,.3,0);for(let i=0;i<4;i++)part(model,new T.ConeGeometry(.1,.28,5),0xdcc8a1,(i%2-.5)*.7,.7,(Math.floor(i/2)-.5)*.5);}
      else if(job==='healer'){part(model,new T.CylinderGeometry(.7,.75,.3,10),0x829cac,0,.15,0);part(model,new T.CylinderGeometry(.6,.6,.06,10),0x85b5b5,0,.32,0);ball(model,.2,c,0,.7,0);}
      else{box(model,1,.55,.65,0x8e9b9f,0,.4,0);const gear=part(model,new T.TorusGeometry(.32,.12,4,10),c,0,.9,0);gear.rotation.x=Math.PI/2;box(model,.7,.1,.1,0xd8b179,0,.9,0);}
      label(model,X.SITES[job].name,2);ring(model,.95,c);return model;
    }
    function reset(){heroes?.reset();actors=[];queue=[];queueClock=0;stations=[];near=null;offer=null;group=null;pulse=0;skillLeft=0;guardVoiceLeft=0;worldFloor=null;worldSeed=null;working=null;pendingForge=pendingDismantle=null;}
    function recruitAvailable(candidate){
      const party=r()?.party;
      return !!candidate&&!!party&&!party.joined.includes(candidate.id)&&!party.members.some(m=>m.profession===candidate.profession);
    }
    function removeStation(station){
      station.model.parent?.remove(station.model);ctx.dispose(station.model);
      stations=stations.filter(s=>s!==station);if(near===station)near=null;
      if(station.kind==='recruit'&&offer?.id===station.offer?.id)offer=null;
    }
    function pruneRecruits(){
      if(!live())return;
      // Scene-level invariant: a named traveller cannot be both a follower and
      // a waiting recruit, even if a stale rule module or scene produced it.
      for(const station of stations)if(station.kind==='recruit'&&!recruitAvailable(station.offer))removeStation(station);
    }
    function build(random,used){
      // Rebuilding this runtime must replace its old group, not abandon a still
      // visible copy. Do not remove merchants, explorers or other world objects.
      const stale=new Set(ctx.world()?.children.filter(o=>o.name==='tower-party-scene')||[]);if(group)stale.add(group);
      for(const old of stale)if(old.parent){old.parent.remove(old);ctx.dispose(old);}
      reset();worldFloor=r()?.floor;worldSeed=r()?.seed;if(!live())return;group=new T.Group();group.name='tower-party-scene';ctx.world().add(group);if(ctx.inDungeon()){syncActors();return;}
      const p=ctx.cell(0,0),camp={...p,kind:'camp',model:stationModel('camp')};camp.model.position.set(p.x,0,p.z);group.add(camp.model);stations.push(camp);
      offer=P.recruitOffer(r());if(recruitAvailable(offer)){const p=ctx.chooseCell(random,used),model=memberModel(offer.profession,offer.level);if(modern())root.TowerHeroVisuals.dress(T,model,H.preview(r(),offer).equipment,ctx.dispose);model.position.set(p.x,0,p.z);label(model,P.PROFESSIONS[offer.profession].person+' · '+P.PROFESSIONS[offer.profession].name);group.add(model);stations.push({...p,kind:'recruit',offer,model});}
      if(r().party.boss)for(let index=0;index<r().party.boss.seals.length;index++){const p=ctx.chooseCell(random,used,4),model=stationModel('boss',index);model.position.set(p.x,0,p.z);group.add(model);stations.push({...p,kind:'boss',index,model});}
      const site=X.siteOffer(r());if(site){let p=ctx.chooseCell(random,used);if(['swordsman','scout'].includes(site.job)&&ctx.passage)for(let i=0;i<8&&!ctx.passage(p,true);i++)p=ctx.chooseCell(random,used);const model=siteModel(site.job);model.position.set(p.x,0,p.z);group.add(model);const station={...p,kind:'site',offer:site,model};stations.push(station);if(r().party.journey.site.done&&['swordsman','scout'].includes(site.job))ctx.passage?.(station);}
      syncActors();const specs=P.monsterSpecs(r());for(const m of ctx.monsters()){healthBar(m.model,0xef9e81);m.partyMaxHp=specs.find(s=>s.id===m.id)?.maxHp||1;}
    }
    function companionSpawn(origin={x:ctx.G.px,z:ctx.G.pz},occupied=actors,slot=actors.length){
      // Use the same body clearance as walking, not the thinner interaction ray.
      // Entry cells border two outer walls: the previous 1.5 m offset put a
      // 0.28 m follower inside their collision boxes and stuck on the next step.
      for(const radius of [1.25,.95])for(let i=0;i<16;i++){
        const angle=slot*2.1+i*Math.PI/8+(ctx.player()?.rotation.y||0)+Math.PI,p={x:origin.x+Math.sin(angle)*radius,z:origin.z+Math.cos(angle)*radius};
        if(walkClear(origin,p)&&distance(p)>.85&&occupied.every(a=>Math.hypot(a.model.position.x-p.x,a.model.position.z-p.z)>=BODY_GAP))return p;
      }
      return origin;
    }
    function syncActors(){if(!live()||!group)return;pruneRecruits();for(const a of actors)if(!records().some(m=>m.id===a.id)){group.remove(a.model);ctx.dispose(a.model);}actors=actors.filter(a=>records().some(m=>m.id===a.id));
      for(const m of records())if(!actors.some(a=>a.id===m.id)){const model=memberModel(m.profession,m.level,m.id),p=companionSpawn();model.position.set(p.x,0,p.z);model.userData.companionId=m.id;label(model,P.PROFESSIONS[m.profession].name+' · '+(m.id==='hero'?(r().name||'主角'):P.PROFESSIONS[m.profession].person));healthBar(model,0x8cd2bd,2.35);group.add(model);actors.push({id:m.id,model,path:[],pathLeft:0});}
      if(modern())for(const a of actors)root.TowerHeroVisuals.dress(T,a.model,H.equipment(r(),a.id),ctx.dispose);
      queue=queue.filter(a=>actors.includes(a));for(const a of actors)if(!queue.includes(a))queue.push(a);queueClock=0;
    }
    function safeCamp(){return live()&&(stations.some(s=>s.kind==='camp'&&distance(s)<2.8&&clear(s))||ctx.traders().some(s=>distance(s)<2.8&&clear(s)))&&!ctx.monsters().some(m=>m.alive&&distance(m.model.position)<4&&clear(m.model.position));}
    function forgePanel(quiet=false){if(!enabled())return;pendingForge=pendingDismantle=pendingRepair=null;const run=r(),safe=safeCamp(),gear=X.allGear(run);
      if(!gear.some(g=>g.id===forgeSelected))forgeSelected=gear[0]?.id;
      const g=gear.find(g=>g.id===forgeSelected),draw=kind=>root.TowerHeroIcons?.svg(kind)||'';
      const list='<nav class="forge-picker" aria-label="選擇要處理的裝備">'+gear.map(item=>'<button class="tower-btn forge-pick" data-tower="party-forge-select" data-item="'+esc(item.id)+'" aria-pressed="'+(item.id===forgeSelected)+'">'+draw(item.kind)+'<span><b>'+esc(item.name)+'</b><small>'+ (item.durability===0?'已損壞': '耐久 '+item.durability+'/'+item.maxDurability)+'</small></span></button>').join('')+'</nav>';
      let detail='<p>尚無可處理的裝備。</p>';
      if(g){const level=(g.forge?.level||0)+1,parts=level*3,coins=modern()?Math.ceil(level*8*(1-H.teamPassive(run,'economy')/100)):level*(P.has(run,'smith')?4:8),quote=X.repairQuote(run,g.id),choices=g.forge?[g.forge.trait]:Object.keys(X.TRAITS).filter(t=>t!=='grip'||g.slot!=='weapon');
        detail='<section class="forge-detail" aria-label="選中裝備的作業"><header class="forge-piece">'+draw(g.kind)+'<div><h3>'+esc(g.name)+'</h3><p>耐久 '+g.durability+'/'+g.maxDurability+' · '+(g.forge?X.TRAITS[g.forge.trait].name+' '+g.forge.level+'/2':'尚未鍛造')+'</p></div></header><section class="forge-repair"><h3>'+(g.durability===0?'重建破損裝備':'修理裝備')+'</h3><p>'+(quote?quote.broken?'需有能行動的鍛匠；修理費為正常費用的 1.5 倍。':'補滿這件裝備的耐久，不補回耐用特性的保護次數。':'耐久完整，無需修理。')+'</p>'+ (quote?act('修復 · '+quote.parts+' 零件／'+quote.coins+' 幣','party-mend-ask',g.id,!safe||!quote.allowed||run.coins<quote.coins||run.party.journey.scrap<quote.parts):'')+'</section><h3>鍛造特性</h3><div class="party-forge-traits">'+choices.map(t=>'<section><div><b>'+esc(X.TRAITS[t].name)+'</b><p>'+esc(X.TRAITS[t].description)+'</p></div>'+act(level>2?'已達上限':(g.forge?'升級':'選擇')+X.TRAITS[t].name+' · '+parts+' 零件／'+coins+' 幣','party-forge-ask',t+'|'+g.id,!safe||g.durability===0||level>2||run.party.journey.scrap<parts||run.coins<coins)+'</section>').join('')+'</div><div class="forge-salvage">'+act('拆解 · 回收 '+X.salvageValue(g)+' 零件','party-dismantle-ask',g.id,!safe)+'</div></section>';
      }
      ctx.dialog('營地工坊 · 暫停中','鍛匠工坊','零件 '+run.party.journey.scrap+'/99 · 銅幣 '+run.coins+(!safe?' · 請先靠近安全營地或行商。':' · 先選裝備，再選作業。'),'<div class="forge-workspace">'+list+detail+'</div>',act('料理與休息','party-kitchen')+act('裝備背包','bag')+act('回到迷宮','close'),{silent:quiet,workshop:true,summary:'鍛匠工坊。先選裝備，再選修理、鍛造或拆解。'});
    }
    function sitePanel(s){const done=r().party.journey.site.done,has=P.has(r(),s.offer.job);ctx.dialog('職業探索 · 暫停中',s.offer.name,s.offer.description,
      '<p class="tower-copy">'+esc(s.offer.reward)+' 另獲得八枚銅幣。這是可跳過的探索，不影響主線通關。</p><p class="tower-copy">'+(done?'此處已完成，不會再次給予獎勵。':'一般處理需在現場累積十二秒，途中仍有怪物與陷阱；離開、受傷或變形會中斷，可稍後接續。已完成 '+Math.floor(r().party.journey.site.progress)+' 秒。')+'</p>',
      (done?'':act('請'+P.PROFESSIONS[s.offer.job].name+s.offer.verb,'party-explore-job',s.offer.id,!has)+act('慢慢處理 · 十二秒','party-explore-work',s.offer.id))+act('返回迷宮','close'),{summary:done?'這處探索已經完成。':s.offer.description+' 沒有對應職業也可以慢慢處理，需要十二秒。'});}
    function finishSite(s,method){const result=X.explore(r(),s.offer.id,method,r().revision);working=null;if(!commit(result))return false;if(result.effect.passage)ctx.passage?.(s);ctx.audio.sfxAction?.('device');ctx.close?.();return true;}
    function bossHelp(){if(!r()?.party?.boss)return;const d=X.BOSSES[r().floor];ctx.dialog('章末機關 · 暫停中',d.name,d.description,'<p class="tower-copy">'+esc(X.hint(r()))+'</p><p class="tower-copy">地面警戒圈標示危險範圍；黃光時退開，紅光時不可接近。操作只需靠近並按對話鈕。所有職業都能完成。整座迷宮的變形倒數維持原規則。</p>',act('回到迷宮','close'),{summary:d.description+' '+X.hint(r())});}
    function panel(kind='team',quiet=false){if(!enabled())return;if(kind==='team'&&modern()){heroes.panel(undefined,quiet);return;}
      const run=r(),p=run.party;let body='',copy='四人小隊：主角加三名旅人。劍士就是護衛，占用一個隊友名額。';
      if(kind==='cook'){
        copy=safeCamp()?'營地很安全，可以烹飪、修理，或分享乾糧讓隊友恢復。':'在起點營地或行商身旁，且附近沒有怪物時才能烹飪、修理與休息。已做好的料理隨時可吃。';
        body='<div class="party-stocks">'+Object.entries(P.INGREDIENTS).map(([id,name])=>'<span>'+foodArt(id)+esc(name)+' <b>'+p.ingredients[id]+'</b></span>').join('')+'</div><div class="tower-grid">'+Object.entries(P.RECIPES).map(([id,recipe])=>'<article class="tower-item party-recipe">'+dishArt(id)+'<h3>'+esc(recipe.name)+' ×'+p.meals[id]+'</h3><p>'+Object.entries(recipe.cost).map(([k,v])=>P.INGREDIENTS[k]+' '+v).join('、')+'</p><p>生命 +'+recipe.hp+' · 飽食 +'+recipe.hunger+(recipe.team?' · 隊友生命 +'+recipe.team:'')+(recipe.buff?'<br>'+P.BUFFS[recipe.buff]+'，持續三層':'')+'</p>'+act('烹飪','party-cook',id,!safeCamp()||Object.entries(recipe.cost).some(([k,v])=>p.ingredients[k]<v))+act('享用','party-eat',id,!p.meals[id])+'</article>').join('')+'</div>';
      }else if(kind==='bestiary'){
        copy='擊敗怪物取得材料，料理是下一段冒險的補給。留意牠們的攻擊前兆，不必硬拚。';body='<div class="tower-grid">'+Object.entries(P.defs()).map(([id,m])=>'<article class="tower-item"><h3>'+esc(m.name)+'</h3><p>'+esc(m.description)+'</p><p>材料：'+Object.keys(P.MONSTERS[id]?.drop||{shell:1}).map(k=>P.INGREDIENTS[k]).join('、')+'</p></article>').join('')+'</div>';
      }else{
        body='<div class="tower-grid"><article class="tower-item">'+portrait(p.profession)+'<h3>'+esc(P.PROFESSIONS[p.profession].name)+' · 你</h3><p>'+esc(P.PROFESSIONS[p.profession].description)+'</p></article>'+p.members.map(m=>'<article class="tower-item">'+portrait(m.profession)+'<h3>'+esc(P.PROFESSIONS[m.profession].person)+' · '+esc(P.PROFESSIONS[m.profession].name)+'</h3><p>強度 '+m.level+'/5 · 生命 '+Math.ceil(m.hp)+'/'+P.memberMax(m)+(m.hp<=0?' · 需要料理或營地休息':'')+'</p>'+act('與他道別','party-dismiss-ask',m.id)+'</article>').join('')+'</div><p class="tower-copy">'+(p.buffs.length?p.buffs.map(b=>P.BUFFS[b.id]+'（'+b.floors+' 層）').join(' · '):'烹飪料理可獲得增益；最多同時保留兩種。')+'</p>';
      }
      ctx.dialog('高塔遠征 · 暫停中',{team:'冒險隊伍',cook:'旅人廚房',bestiary:'迷宮生物誌'}[kind],copy,body,act('隊伍','party-team')+act('料理','party-kitchen')+act('鍛匠工坊','party-forge')+act('生物誌','party-bestiary')+(run.party.boss?act('本層機關說明','party-boss-help'):'')+act('分享乾糧休息','party-rest',null,!safeCamp())+act('修理 '+(modern()?Math.ceil(6*(1-H.teamPassive(run,'economy')/100)):P.has(run,'smith')?3:6)+' 幣','party-repair',null,!safeCamp())+act('裝備與道具','bag')+act('回到迷宮','close'),{silent:quiet,summary:{team:'冒險隊伍。主角加三名同伴。',cook:'旅人廚房。選擇烹飪，或享用料理。',bestiary:'迷宮生物誌。了解怪物，收集材料。'}[kind]});
    }
    function commit(result,speak=true){if(!ctx.transact(result))return false;if(speak&&result.message)ctx.toast(result.message,2300,result.message);return true;}
    function interact(){pruneRecruits();if(!live()||!near||ctx.G.shifting||distance(near)>2.6||!clear(near))return false;const n=near;if(n.kind==='camp'){panel('cook');return true;}
      if(n.kind==='site'){sitePanel(n);return true;}
      if(n.kind==='recruit'){const job=P.PROFESSIONS[offer.profession],draw=modern()?H.preview(r(),offer):null;ctx.dialog(job.name+' · '+job.person,'一起尋找回家的路',draw?'主動：'+draw.skills.map(k=>H.SKILLS[k].name).join('、')+'。被動：'+draw.passives.map(k=>H.PASSIVES[k].name).join('、')+'。':job.description,'<div class="party-invite">'+portrait(offer.profession)+'<p>強度 '+offer.level+'/5 · 招募費 '+offer.price+' 枚銅幣 · 隊伍 '+(r().party.members.length+1)+'/4</p></div>',act('邀請加入','party-recruit',offer.id,r().coins<offer.price||r().party.members.length>=3)+act('查看隊伍','party-team')+act('下次再聊','close'),{speaker:{gender:job.gender,age:'adult'},summary:job.name+'，'+job.person+'。'+job.description+'。邀請加入需要'+offer.price+'枚銅幣。'});return true;}
      if(n.kind==='boss'){if(commit(P.bossAction(r(),n.index,r().revision))){ctx.audio.sfxAction?.('device');ctx.save();}return true;}return false;
    }
    function handle(key,id){if(heroes?.handle(key,id))return true;if(!key.startsWith('party-'))return false;if(!enabled())return true;
      if(key==='party-team'){panel();return true;}if(key==='party-kitchen'){panel('cook');return true;}if(key==='party-bestiary'){panel('bestiary');return true;}
      if(key==='party-forge'){forgePanel();return true;}if(key==='party-boss-help'){bossHelp();return true;}
      if(key==='party-forge-select'){forgeSelected=id;forgePanel(true);return true;}
      if(key==='party-mend-ask'||key==='party-mend-confirm'){
        if(!safeCamp())return true;const g=X.allGear(r()).find(g=>g.id===id),q=X.repairQuote(r(),id);if(!g||!q)return true;
        if(key==='party-mend-ask'){pendingRepair={id,revision:r().revision};ctx.dialog('確認修理',g.name,'補滿耐久需要 '+q.coins+' 枚銅幣與 '+q.parts+' 份金屬零件。'+(q.broken?'破損修理費已乘上 1.5 倍，且需要能行動的鍛匠。':''),'',act('返回工坊','party-forge')+act('確認修復','party-mend-confirm',id),{summary:'確認修復 '+g.name+'。'});return true;}
        if(!pendingRepair||pendingRepair.id!==id)return true;
        if(commit(X.repair(r(),id,pendingRepair.revision))){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();syncActors();forgePanel(true);}return true;
      }
      if(key==='party-forge-ask'||key==='party-forge-confirm'){
        if(!safeCamp())return true;const split=id?.indexOf('|'),trait=id?.slice(0,split),gearId=id?.slice(split+1),g=X.allGear(r()).find(g=>g.id===gearId);if(!g||!Object.hasOwn(X.TRAITS,trait))return true;
        if(key==='party-forge-ask'){pendingForge={id,revision:r().revision};ctx.dialog('確認鍛造',g.name+' · '+X.TRAITS[trait].name,'選定特性後不能更換，每件裝備最多強化兩次。確認後才會扣除工坊列出的零件與銅幣。','',act('返回工坊','party-forge')+act('確認鍛造','party-forge-confirm',id),{summary:'確認鍛造'+X.TRAITS[trait].name+'。選定後不能更換。'});return true;}
        if(!pendingForge||pendingForge.id!==id)return true;
        if(commit(X.forge(r(),gearId,trait,pendingForge.revision))){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();forgePanel(true);}return true;
      }
      if(key==='party-dismantle-ask'||key==='party-dismantle'){
        if(!safeCamp())return true;const g=X.allGear(r()).find(g=>g.id===id);if(!g)return true;
        if(key==='party-dismantle-ask'){pendingDismantle={id,revision:r().revision};ctx.dialog('拆解裝備確認','拆解'+g.name+'？','拆解後不能取回，將獲得'+X.salvageValue(g)+'份零件。'+(r().equipment[g.slot]?.id===id?'這件裝備正在穿戴中。':''),'',act('保留裝備','party-forge')+act('確認拆解','party-dismantle',id),{summary:'確定拆解'+g.name+'？拆解後不能取回。'});return true;}
        if(!pendingDismantle||pendingDismantle.id!==id)return true;
        if(commit(X.dismantle(r(),id,pendingDismantle.revision))){ctx.audio.sfxAction?.('device');ctx.refreshGear?.();forgePanel(true);}return true;
      }
      if(key==='party-explore-job'||key==='party-explore-work'){
        const s=stations.find(s=>s.kind==='site'&&s.offer.id===id);if(!live()||!s||distance(s)>2.6||!clear(s)||r().party.journey.site.done||ctx.G.shifting)return true;
        if(key==='party-explore-job')finishSite(s,'profession');else{working=s;ctx.close?.();ctx.toast('開始處理，留意四周的動靜。',1600,'開始處理，留意四周。');}return true;
      }
      if(key==='party-dismiss-ask'){const m=r().party.members.find(m=>m.id===id);if(m)ctx.dialog('與同伴道別','確定讓'+P.PROFESSIONS[m.profession].person+'離隊？','這位旅人會繼續自己的旅程，不能在原地重新招募。已支付的費用不會退回。','',act('繼續同行','party-team')+act('確定道別','party-dismiss',id));return true;}
      if(key==='party-dismiss'){if(commit(P.dismiss(r(),id,r().revision))){syncActors();panel('team',true);}return true;}
      if(key==='party-recruit'){pruneRecruits();if(!near||near.kind!=='recruit'||distance(near)>2.6||!clear(near))return true;const station=near;if(commit(P.recruit(r(),id,r().revision))){if(stations.includes(station))removeStation(station);syncActors();panel('team',true);}return true;}
      if(key==='party-cook'&&safeCamp()){if(commit(P.cook(r(),id,r().revision))){ctx.audio.sfxAction?.('cook');panel('cook',true);}return true;}
      if(key==='party-eat'){if(commit(P.eat(r(),id,r().revision))){ctx.audio.sfxAction?.('cook');panel('cook',true);}return true;}
      if((key==='party-rest'||key==='party-repair')&&safeCamp()){if(commit(P.camp(r(),key==='party-rest'?'rest':'repair',r().revision))){ctx.audio.sfxAction?.(key==='party-rest'?'cook':'forge');panel('cook',true);}return true;}return true;
    }
    function applyHit(m,memberId=null,skillId=null){
      if(modern()&&heroes.preparing(memberId||H.state(r()).active))return;
      const source=memberId?actors.find(a=>a.id===memberId)?.model.position:{x:ctx.G.px,z:ctx.G.pz};if(!source)return;
      const dx=source.x-m.model.position.x,dz=source.z-m.model.position.z,front=Math.cos(Math.atan2(dx,dz)-m.model.rotation.y)>.45;
      const result=P.strike(r(),m.id,{memberId,front,skillId},r().revision);if(!commit(result,false))return;
      if(modern())heroes.impact(m,memberId||H.state(r()).active,skillId);else ctx.audio.sfxHit();if(result.effect.stunned){m.windup=0;ctx.quest('stun',{monsterId:m.id});}
      if(result.effect.dead){m.alive=false;m.model.visible=false;ctx.quest('defeat',{monsterId:m.id});ctx.toast(result.message,2600,result.message);if(memberId){ctx.audio.sfxGuardDefeat?.();if(r().party.members.find(x=>x.id===memberId)?.profession==='swordsman')root.GameVoice?.announceAsset('guard.defeat','怪物已經打倒了，繼續前進！',true);}ctx.save();}
      else if(result.effect.broken)ctx.toast('武器用壞了！可換上備用武器，或請鍛匠在營地修復。',2400,'武器壞了，找鍛匠修理吧');
      if(result.effect.stunned||skillId==='backstab'||skillId==='decisive_slash')m.windup=0;return result;
    }
    function attack(){if(!live()||ctx.paused()||ctx.G.shifting||(modern()&&heroes.preparing())||(modern()?H.actor(r()).attack:skillLeft)>0)return;skillLeft=modern()?H.stats(r()).interval:X.attackInterval(r());ctx.audio.sfxSwing();ctx.swing();
      const facing=ctx.player()?.rotation.y||0,target=ctx.monsters().filter(m=>{const p=m.model.position;return m.alive&&distance(p)<(modern()?H.stats(r()).reach:2.8)&&clear(p)&&Math.cos(Math.atan2(p.x-ctx.G.px,p.z-ctx.G.pz)-facing)>-.05;}).sort((a,b)=>distance(a.model.position)-distance(b.model.position))[0];
      if(target)applyHit(target);else{if(modern()){H.actor(r()).attack=H.stats(r()).interval;ctx.save();}ctx.toast('前方沒有碰到怪物，靠近後再出手。',1200,false);}
    }
    function skill(){if(modern()){heroes.cast(H.actor(r()).skills[0]);return;}if(!live()||ctx.paused()||ctx.G.shifting||!ctx.G.running)return;const result=P.skill(r(),r().revision);if(!commit(result))return;ctx.audio.sfxUse();if(result.effect.skill==='mage')for(const m of ctx.monsters())if(m.alive&&distance(m.model.position)<4&&clear(m.model.position)){r().monsterStuns[m.id]=Math.max(r().monsterStuns[m.id]||0,2);m.windup=0;}ctx.save();hud();}
    function guard(m,dt){if(!live())return false;if(heroes?.blocker(m,dt))return true;
      const provoke=modern()?H.state(r()).enemy[m.id]:null;if(provoke?.tauntLeft>0&&provoke.tauntId!==H.state(r()).active){const bait=actors.find(a=>a.id===provoke.tauntId);if(bait&&H.hp(r(),bait.id)>0&&Math.hypot(bait.model.position.x-m.model.position.x,bait.model.position.z-m.model.position.z)>(m.def.ranged?7:1.7)){ctx.follow(m,dt,m.def.speed??2.1,1.35,bait.model.position,{direct:true});return true;}}const a=actors.find(a=>{const member=records().find(x=>x.id===a.id);return (modern()?H.pv(r(),'guard_instinct',a.id)>0||(H.state(r()).enemy[m.id]?.tauntLeft>0&&H.state(r()).enemy[m.id]?.tauntId===a.id):member?.profession==='swordsman')&&member.hp>0&&Math.hypot(a.model.position.x-m.model.position.x,a.model.position.z-m.model.position.z)<(m.def.ranged?7:1.8)&&ctx.clear(a.model.position.x,a.model.position.z,m.model.position.x,m.model.position.z);});
      if(!a){m.partyGuardId=null;return false;}if(m.partyGuardId!==a.id&&guardVoiceLeft<=0){root.GameVoice?.announceAsset('guard.hold','我來擋住牠，你先走！',true);guardVoiceLeft=8;}m.partyGuardId=a.id;m.path=[];m.model.rotation.y=Math.atan2(a.model.position.x-m.model.position.x,a.model.position.z-m.model.position.z);m.cooldown=Math.max(0,m.cooldown-dt);
      if(m.windup>0){m.windup-=dt;if(m.windup<=0){if(modern())H.setBuff(r(),a.id,'intercept',.1,1);const status=modern()?H.state(r()).enemy[m.id]:null,weak=Math.max(status?.weak||0,status?.relayWeak>0?.25:0);if(status)status.weak=0;const hit=P.hurtMember(r(),a.id,m.def.damage*(1-weak),r().revision);if(commit(hit,false)){ctx.audio.sfxGuardBlock?.();if(hit.effect.down)ctx.toast(hit.message,2500,hit.message);}m.cooldown=2.4;}}
      else if(m.cooldown<=0)m.windup=.9;return true;
    }
    function shift(){
      pruneRecruits();working=null;queueClock=0;if(modern()){const seconds=H.teamPassive(r(),'intuition');if(seconds)r().effects.reveal=seconds;}heroes?.reset();if(modern())root.TowerHeroGrowth.state(r()).route=null;const placed=[];
      for(const a of actors){
        const c=ctx.worldToCell(a.model.position.x,a.model.position.z),centre=ctx.cell(c.x,c.y),p=companionSpawn(centre,placed,placed.length);
        a.model.position.set(p.x,0,p.z);a.path=[];a.pathLeft=0;a.safeTurn=false;a.queueLeader=null;placed.push(a);
      }
    }
    function orderQueue(dt){
      queueClock-=dt;if(queueClock>0)return;queueClock=.5;
      const player={x:ctx.G.px,z:ctx.G.pz},scores=new Map(queue.map(a=>[a,ctx.followDistance?ctx.followDistance(a.model.position,player):distance(a.model.position)]));
      // Stable ordering with hysteresis: let the nearer traveller lead when
      // turning around or leaving a narrow camp, without swapping every frame.
      for(let i=0;i<queue.length-1;i++){
        let nearest=i;for(let j=i+1;j<queue.length;j++)if(scores.get(queue[j])<scores.get(queue[nearest]))nearest=j;
        // Compare with every remaining traveller. Adjacent-only swaps can miss
        // a frontmost member behind two similar scores and deadlock the entry.
        if(scores.get(queue[nearest])+.35<scores.get(queue[i]))queue.splice(i,0,queue.splice(nearest,1)[0]);
      }
    }
    function queueMove(actor,dt,speed,stop,target){
      const p=actor.model.position,start={x:p.x,z:p.z},peers=actors.filter(a=>a!==actor);
      const gap=(point,a)=>Math.hypot(point.x-a.model.position.x,point.z-a.model.position.z);
      const overlap=peers.some(a=>gap(start,a)<BODY_GAP-.001);
      const free=point=>walkClear(start,point)&&peers.every(a=>gap(point,a)>=BODY_GAP-.001||gap(point,a)>gap(start,a)+.00001);
      const moving=ctx.follow(actor,dt,speed,stop,target,{direct:true});
      if(moving&&free(p)&&!overlap)return true;
      if(!moving&&!overlap)return false;
      let dx=p.x-start.x,dz=p.z-start.z;p.x=start.x;p.z=start.z;
      // Yield sideways inside the corridor rather than walk through a companion.
      // If a restored/turned-around group overlaps, separate gradually, never
      // teleport through a wall or move the player to make room.
      if(overlap){dx=dz=0;for(const other of peers){const d=gap(start,other);if(d<BODY_GAP){dx+=(start.x-other.model.position.x)/Math.max(d,.01);dz+=(start.z-other.model.position.z)/Math.max(d,.01);}}}
      if(Math.hypot(dx,dz)<.001){const angle=actors.indexOf(actor)*2.1;dx=Math.sin(angle);dz=Math.cos(angle);}
      const angle=Math.atan2(dx,dz),side=actors.indexOf(actor)%2?1:-1,step=speed*Math.min(dt,.1);
      for(const turn of [0,side*Math.PI/4,-side*Math.PI/4,side*Math.PI/2,-side*Math.PI/2,Math.PI]){
        const next={x:start.x+Math.sin(angle+turn)*step,z:start.z+Math.cos(angle+turn)*step};
        if(!free(next))continue;p.x=next.x;p.z=next.z;actor.model.rotation.y=angle+turn;return step>0;
      }
      return false;
    }
    function friendlyVisibility(model){
      const camera=ctx.camera?.();if(!camera)return;const c=camera.position,p=model.position,dx=ctx.G.px-c.x,dz=ctx.G.pz-c.z,length=dx*dx+dz*dz,t=length>.01?((p.x-c.x)*dx+(p.z-c.z)*dz)/length:0;
      const cameraDistance=Math.hypot(p.x-c.x,p.z-c.z),occludes=c.y<3.5&&(cameraDistance<1.4||(t>0&&t<1&&Math.hypot(p.x-c.x-t*dx,p.z-c.z-t*dz)<.65));
      if(model.userData.partyOccludes!==occludes){model.userData.partyOccludes=occludes;model.traverse(o=>{if(o.isMesh&&o.material){o.material.transparent=occludes;o.material.opacity=occludes?.16:1;o.material.depthWrite=!occludes;}});}
      for(const key of ['partyTag','partyHp','partyHpBack'])if(model.userData[key])model.userData[key].visible=!occludes&&cameraDistance>2.8;
    }
    function tick(dt,now){if(!live())return;pruneRecruits();if(ctx.paused()||ctx.G.shifting)return;skillLeft=Math.max(0,skillLeft-dt);guardVoiceLeft=Math.max(0,guardVoiceLeft-dt);pulse+=dt;
      near=stations.filter(s=>s.model.visible&&distance(s)<2.6&&clear(s)).sort((a,b)=>distance(a)-distance(b))[0]||null;
      if(working){if(distance(working)>2.6||!clear(working)||ctx.hurt?.()){working=null;ctx.toast('先避開危險，稍後可以接著處理。',1400,false);}else{const site=r().party.journey.site;site.progress=Math.min(12,site.progress+dt);if(site.progress>=12)finishSite(working,'work');}}
      for(const s of stations)if(s.kind==='recruit')friendlyVisibility(s.model);
      orderQueue(dt);
      let leader={x:ctx.G.px,z:ctx.G.pz},leaderId='player';
      for(const a of queue){const m=records().find(m=>m.id===a.id);if(!m)continue;friendlyVisibility(a.model);a.model.userData.partyHp.scale.x=.94*Math.max(.001,m.hp/(modern()?H.maxHp(r(),m.id):P.memberMax(m)));a.model.rotation.z=m.hp<=0?.2:0;if(m.hp<=0)continue;
        const enemy=ctx.monsters().filter(e=>e.alive&&distance(e.model.position)<6&&ctx.clear(a.model.position.x,a.model.position.z,e.model.position.x,e.model.position.z)).sort((a,b)=>distance(a.model.position)-distance(b.model.position))[0];
        const fighting=(modern()?H.pv(r(),'guard_instinct',a.id)>0:m.profession==='swordsman')&&enemy,target=fighting?enemy.model.position:leader,targetId=fighting?'enemy:'+enemy.id:leaderId;
        if(a.queueLeader!==targetId){a.queueLeader=targetId;a.path=[];a.pathLeft=0;}
        const speed=(fighting?3.6:Math.hypot(target.x-a.model.position.x,target.z-a.model.position.z)>6?6.2:5.6)*(modern()?H.speed(r(),a.id):1);
        const moving=queueMove(a,dt,speed,fighting?1.35:QUEUE_GAP,target);
        // A guard who leaves the line must not drag the rest of the party into
        // battle; downed companions likewise never become a stationary leader.
        if(!fighting){leader=a.model.position;leaderId=a.id;}
        friendlyVisibility(a.model);
        if(root.CharacterFace)root.CharacterFace.update(a.model,now/1000,enemy?'focus':'calm');
        for(const key of ['legL','legR'])if(a.model.userData[key])a.model.userData[key].rotation.x=moving?Math.sin(now*.01)*(key==='legL'?1:-1)*.35:0;
        if(a.model.userData.armR){const elapsed=(m.profession==='mage'?3:1.8)-m.cooldown;a.model.userData.armR.rotation.x=m.cooldown>0&&elapsed<.45?-Math.sin(elapsed/.45*Math.PI)*1.1:0;}
        if(!modern()&&m.profession==='healer'&&m.cooldown<=0&&r().hp<30&&r().party.ingredients.herb&&distance(a.model.position)<5){const result=ctx.core.transaction(r(),r().revision,n=>{n.party.ingredients.herb--;n.hp=Math.min(ctx.core.MAX_HP,n.hp+16);n.party.members.find(x=>x.id===m.id).cooldown=20;return {ok:true,message:'澄音用香草替你包紮了傷口。'};});commit(result);}
        if(enemy&&m.cooldown<=0&&!(modern()&&heroes.wantsSkill(m.id))&&(modern()||['swordsman','mage','scout'].includes(m.profession))&&Math.hypot(a.model.position.x-enemy.model.position.x,a.model.position.z-enemy.model.position.z)<(modern()?H.stats(r(),m.id).reach:m.profession==='mage'?6:2.4)){
          a.model.rotation.y=Math.atan2(enemy.model.position.x-a.model.position.x,enemy.model.position.z-a.model.position.z);root.CharacterMotion?.beginAction(a.model,'attack',.5);applyHit(enemy,m.id);
        }
      }
      if(modern()){for(const a of actors){root.TowerHeroVisuals.dress(T,a.model,H.equipment(r(),a.id),ctx.dispose);root.TowerHeroVisuals.pose(a.model,H.actor(r(),a.id).attack,H.stats(r(),a.id).interval);}heroes.tick(dt);}
      for(const m of ctx.monsters()){if(!m.alive)continue;if(m.model.userData.partyHp)m.model.userData.partyHp.scale.x=.94*Math.max(.001,(r().party.health[m.id]??m.partyMaxHp)/m.partyMaxHp);
        if(ctx.camera?.()&&m.model.userData.tag)m.model.userData.tag.visible=m.model.position.distanceTo(ctx.camera().position)>3.4;
        if(m.kind==='moth'){m.model.userData.body.children.filter(x=>x.name==='party-wing').forEach((w,i)=>w.rotation.z=Math.sin(now*.012)*(i?1:-1)*.5);if(m.windup>0)for(const other of ctx.monsters())if(other.alive&&other!==m&&Math.hypot(other.model.position.x-m.model.position.x,other.model.position.z-m.model.position.z)<6)other.alertLeft=4;}
        if(m.kind==='mushroom'&&m.windup>0&&m.windup<=dt&&distance(m.model.position)<2.8&&clear(m.model.position)){if(modern())H.inflict(r(),H.state(r()).active,'slow',3,.6);else r().party.slowLeft=3;}
      }
      const b=r().party.boss;if(b){const phase=P.bossPhase(r()),d=X.BOSSES[r().floor];for(const s of stations.filter(s=>s.kind==='boss')){
        const hazard=X.danger(r(),s.index),seal=s.model.children.find(x=>x.name==='seal'),solved=b.seals[s.index],color=solved?0x83ccac:phase==='warning'?0xffc273:hazard.active?0xf28975:d.kind==='pulse'&&X.cycle(r())%3===s.index?0xffffff:d.color;
        if(seal){seal.rotation.y=b.angles[s.index]*Math.PI/2;seal.position.y=1.2+(phase==='strike'?.16:Math.sin(pulse*2)*.06);seal.traverse(o=>{if(o.isMesh)o.material.color.setHex(color);});}
        for(const arm of s.model.children.filter(x=>x.name==='boss-arm')){arm.scale.y=hazard.active?1:!solved&&phase==='warning'?.22+Math.sin(pulse*10)*.04:.08;const angle=arm.userData.angle;arm.position.set(Math.sin(angle)*hazard.radius*.82,0,Math.cos(angle)*hazard.radius*.82);}
        const warning=s.model.children.find(x=>x.name==='boss-warning');warning.scale.set(hazard.radius,hazard.radius,1);warning.material.color.setHex(color);
        const water=s.model.children.find(x=>x.name==='boss-water');if(water){water.scale.set(hazard.radius,1,hazard.radius);water.position.y=hazard.active?.5:.05;water.visible=!solved;}
        if(hazard.active&&distance(s)<hazard.radius&&clear(s)&&s.hitCycle!==hazard.cycle){s.hitCycle=hazard.cycle;ctx.damage(hazard.damage,'trap','機關動起來了，快退到警戒圈外！');if(ctx.paused()||r().status!=='playing')break;}
      }}
      uiClock+=dt;if(uiClock>.15){uiClock=0;hud();}
    }
    function hud(){if(!enabled())return;
      const status=document.getElementById('towerGuardStatus');if(status){status.hidden=false;let button=status.querySelector('.party-status');if(!button){status.innerHTML='<button class="party-status" type="button"></button>';button=status.firstChild;button.onclick=()=>panel();}button.textContent=P.PROFESSIONS[modern()?H.job(r()):r().party.profession].name+' · 隊伍 '+(r().party.members.length+1)+'/4'+(r().party.members.some(m=>m.hp<=0)?' · 同伴需要休息':'');}
      const attack=document.getElementById('towerAttackBtn');if(attack&&live()&&!ctx.inDungeon()){const cd=modern()?H.actor(r()).attack:skillLeft;attack.disabled=cd>0;const label=r().equipment.weapon?'揮擊':'徒手';if(window.BattleDock)BattleDock.attackLabel(label,cd);else attack.textContent=label+(cd>0?' '+cd.toFixed(1):' X');}
      if(modern())heroes.hud();
      const skillButton=document.getElementById('towerProfessionBtn');if(skillButton){skillButton.hidden=!live()||modern();skillButton.disabled=r().party.cooldown>0||ctx.paused();skillButton.textContent=r().party.cooldown>0?'準備 '+Math.ceil(r().party.cooldown)+'秒':P.PROFESSIONS[r().party.profession].skill+' C';}
      const talk=document.getElementById('towerTalkBtn');if(near&&live()&&talk){talk.disabled=false;talk.hidden=ctx.paused();talk.ariaLabel=near.kind==='camp'?'營地料理（R）':near.kind==='boss'?'操作機關（R）':near.kind==='site'?'探索機關（R）':'邀請同伴（R）';}
      const objective=document.getElementById('towerObjective');if(objective&&live()){
        if(working)objective.textContent='處理中 '+Math.floor(r().party.journey.site.progress)+'/12 秒 · 可隨時離開避險';
        else if(near)objective.textContent=near.kind==='camp'?'旅人營地 · 料理、鍛造與休息':near.kind==='recruit'?'旅人正在招募同行者 · 靠近對話':near.kind==='site'?near.offer.name+' · '+(r().party.journey.site.done?'已完成':'對話可選職業專長或一般處理'):X.BOSSES[r().floor].name+' · '+({idle:'對話開始；背包可讀機關說明',warning:'黃光預警，先退開！',strike:'機關啟動，避開警戒圈',rest:X.hint(r()),done:'封印已解除'}[P.bossPhase(r())]);
        else if(r().party.boss&&!r().party.boss.done)objective.textContent=X.BOSSES[r().floor].name+' · 機關 '+r().party.boss.seals.filter(Boolean).length+'/'+r().party.boss.seals.length+' · 背包內有說明';
      }
    }
    function install(){heroes?.install();const rail=document.getElementById('towerActionRail');if(!rail)return;const b=document.createElement('button');b.id='towerProfessionBtn';b.className='tower-btn';b.hidden=true;ctx.bind(b,skill);rail.prepend(b);}
    function switchControl(from,to){const target=actors.find(a=>a.id===to),old={x:ctx.G.px,z:ctx.G.pz};if(!target)return;const next={x:target.model.position.x,z:target.model.position.z};syncActors();const previous=actors.find(a=>a.id===from);if(previous)previous.model.position.set(old.x,0,old.z);ctx.G.px=next.x;ctx.G.pz=next.z;ctx.player().position.set(next.x,0,next.z);}
    return {enabled,live,portrait,switchControl,heroes,refreshActors:syncActors,ingredientModel,monsterModel,build,tick,hud,attack,skill,guard,shift,interact,handle,panel,install,reset,safeCamp,get nearby(){pruneRecruits();return live()?near:null;},reserved:()=>{pruneRecruits();return live()?stations:[];},markers:()=>{pruneRecruits();return live()?stations.filter(s=>s.model.visible).map(s=>({cx:s.cx,cy:s.cy,color:s.kind==='boss'?'#efc977':'#a0dcc2',label:s.kind==='boss'?String(s.index+1):s.kind==='camp'?'營':s.kind==='site'?'探':'友'})):[];}};
  }
  root.TowerPartyRuntime={create};
})(typeof globalThis!=='undefined'?globalThis:this);
