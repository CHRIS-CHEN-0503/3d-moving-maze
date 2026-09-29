/* Original lightweight spell geometry. Cosmetic only: never decides hits or consumes RNG. */
(function(root){'use strict';
  const PALETTES={swordsman:[0xffdc91,0xff9b54],mage:[0xc6a8ff,0x6fdfff],scout:[0x8dffe0,0x4dceaa],chef:[0xffca83,0xff884d],healer:[0xc4ffd2,0x65e9b3],smith:[0xffd3a0,0xff8f48]};
  const FAMILIES={decisive:'slash',star_ring:'meteor',escape:'scan',feast:'steam',sanctuary:'heal',fortress:'shield',cleave:'slash',circle:'spin',blind:'slash',stun:'impact',stagger:'impact',splash:'splash',bolt:'cast',weak:'cast',slow:'cast',mark:'cast',shock:'storm',repel:'wave',starfall:'meteor',guard:'shield',barrier:'shield',ward:'shield',fortify:'shield',rally:'aura',speed:'aura',polish:'forge',stealth:'smoke',smoke:'smoke',stomach:'steam',meal:'steam',soup:'heal',heal:'heal',revive:'heal',cleanse:'cleanse',reveal:'scan',disarm:'scan',daylight:'sun',repair:'forge',frost:'frost',taunt:'wave',barricade:'forge'};
  function create(T,ctx){let effects=[];const limit=ctx.limit||12,reduced=!!ctx.reducedMotion;
    function dispose(f){f.group.parent?.remove(f.group);const geometries=new Set(),materials=new Set(f.mats);f.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
    function removeOld(){if(effects.length>=limit)dispose(effects.shift());}
    function emit(skill,at,angle=0,options={}){
      if(!at||!skill||!FAMILIES[skill.effect])return null;
      if(ctx.visible&&!ctx.visible(at))return null;
      removeOld();const family=options.impact?'hit':options.stage==='charge'?'charge':options.stage==='land'?'burst':FAMILIES[skill.effect],colors=PALETTES[skill.job]||PALETTES.swordsman,group=new T.Group();group.name='skill-vfx-'+skill.id;group.position.set(at.x,.04,at.z);group.rotation.y=angle;
      const total=family==='hit'?.36:family==='charge'||family==='meteor'?Math.min(4,Math.max(.1,Number(options.duration)||(family==='charge'?.65:.7))):reduced?.65:family==='heal'||family==='shield'?1.4:1.05,parts=[];
      const mats=colors.map(color=>new T.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false}));
      function part(geometry,x=0,y=0,z=0,tint=0,mode='rise'){const m=new T.Mesh(geometry,mats[tint]);m.position.set(x,y,z);group.add(m);parts.push({m,base:m.position.clone(),mode});return m;}
      function ring(radius,y=0,tint=0,arc=Math.PI*2,mode='expand'){const m=part(new T.RingGeometry(radius*.9,radius,24,1,0,arc),0,y,0,tint,mode);m.rotation.x=-Math.PI/2;return m;}
      // A translucent local ground glow; no dynamic light/shadow or full-screen flash.
      const groundMat=new T.MeshBasicMaterial({color:colors[1],transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
      const ground=new T.Mesh(new T.CircleGeometry(1.2,20),groundMat);ground.rotation.x=-Math.PI/2;ground.position.y=.006;group.add(ground);
      if(family==='hit'){
        // Contact streaks and a compact burst at body height; never a screen flash.
        const magical=['staff','book'].includes(options.weapon)||['mage','healer'].includes(skill.job);
        part(new T.RingGeometry(.27,.43,16),0,1.05,0,1,'expand');
        if(!magical)for(const sign of [-1,1]){const streak=part(new T.BoxGeometry(1.05,.08,.04),0,1.05,.03,0,'breathe');streak.rotation.z=sign*.65;}
        else part(new T.IcosahedronGeometry(.29,0),0,1.05,0,0,'breathe');
        for(let i=0;i<(reduced?3:6);i++){const a=i*Math.PI/3;part(new T.OctahedronGeometry(.065),Math.sin(a)*.24,1.05+Math.cos(a)*.24,Math.cos(a)*.19,i%2,'contact');}
        ground.scale.setScalar(.6);
      }else if(family==='charge'){
        ring(.65,.04);ring(.9,.06,1);
        for(let i=0;i<(reduced?2:4);i++){const a=i*Math.PI/2;part(new T.OctahedronGeometry(.07),Math.sin(a)*.7,.4,Math.cos(a)*.7,i%2,'gather');}
      }else if(['slash','spin','splash'].includes(family)){
        for(let i=0;i<(reduced?1:3);i++){const r=ring(1.3+i*.25,.45+i*.35,i%2,family==='spin'?Math.PI*1.65:Math.PI*.9,'sweep');r.rotation.z=-Math.PI*.45+i*.12;r.position.z=.35;}
        for(let i=0;i<4;i++)part(new T.OctahedronGeometry(.07),Math.sin(i)*.8,.75+i*.14,1+i*.12,i%2,'spark');
      }else if(['heal','cleanse','steam','aura','sun'].includes(family)){
        ring(.9,.02);ring(1.1,.03,1);
        for(let i=0;i<(reduced?3:6);i++){const theta=i*Math.PI/3,m=part(new T.OctahedronGeometry(family==='sun'?.12:.07),Math.sin(theta)*.65,.15+i*.24,Math.cos(theta)*.65,i%2,'orbit');m.rotation.z=Math.PI/4;}
        if(family==='heal'||family==='cleanse'){part(new T.BoxGeometry(.48,.12,.06),0,1.6,0);part(new T.BoxGeometry(.12,.48,.06),0,1.6,0);}
        if(family==='sun'){part(new T.IcosahedronGeometry(.25,0),0,2.05,0);const r=ring(.5,2.05,1);r.rotation.x=0;}
      }else if(family==='shield'){
        ring(1,.04);const dome=part(new T.SphereGeometry(1.05,12,6,0,Math.PI*2,0,Math.PI/2),0,.2,0,1,'breathe');dome.material=groundMat;
        for(let i=0;i<4;i++){const r=part(new T.TorusGeometry(.8,.025,3,16),0,1,0,i%2,'breathe');r.rotation.y=i*Math.PI/4;}
      }else if(family==='meteor'){
        ring(1.35,.02,1);ring(.9,.03);
        for(let i=0;i<(skill.effect==='star_ring'?3:1);i++){const theta=i*Math.PI*2/3,radius=skill.effect==='star_ring'?.72:0,x=Math.sin(theta)*radius,z=Math.cos(theta)*radius;part(new T.OctahedronGeometry(.35),x,3.4,z,0,'fall');const trail=part(new T.ConeGeometry(.18,1.8,6),x,4.35,z,1,'fall');trail.rotation.z=Math.PI;}
      }else if(family==='frost'){
        ring(1.65,.015,1);for(let i=0;i<6;i++){const a=i*Math.PI/3;part(new T.ConeGeometry(.16,.65,4),Math.sin(a)*1.15,.2,Math.cos(a)*1.15,i%2,'rise');}
      }else if(family==='smoke'){
        for(let i=0;i<(reduced?3:5);i++){const a=i*2.4,m=part(new T.IcosahedronGeometry(.42,0),Math.sin(a)*.65,.25+i*.17,Math.cos(a)*.65,1,'mist');m.material=groundMat;}
        ring(1,.03,1);
      }else if(['scan','wave','storm'].includes(family)){
        for(let i=0;i<(reduced?1:3);i++)ring(.8+i*.3,.08+i*.22,i%2);
        if(family==='storm')for(let i=0;i<5;i++){const a=i*1.25,m=part(new T.ConeGeometry(.075,1,3),Math.sin(a),.7,Math.cos(a),i%2,'spark');m.rotation.z=.4;}
      }else if(family==='forge'){
        ring(.7,.04);for(let i=0;i<6;i++){const a=i*Math.PI/3;part(new T.OctahedronGeometry(.08),Math.sin(a)*.35,.8,Math.cos(a)*.35,i%2,'spark');}part(new T.BoxGeometry(.45,.13,.1),0,1.25,0);
      }else if(family==='cast'){
        for(let i=0;i<2;i++){const r=part(new T.TorusGeometry(.32+i*.16,.03,3,16),0,1.15,.55,i,'spin');r.rotation.z=i*.5;}part(new T.OctahedronGeometry(.17),0,1.15,.6);
      }else{
        ring(.7,.1);for(let i=0;i<6;i++){const a=i*Math.PI/3;part(new T.OctahedronGeometry(.1),Math.sin(a)*.2,.9,Math.cos(a)*.2,i%2,'spark');}
      }
      ctx.world().add(group);const f={group,total,left:total,parts,mats:[...mats,groundMat],family,at:{x:at.x,z:at.z},skill:skill.id};effects.push(f);return f;
    }
    function tick(dt){for(let i=effects.length-1;i>=0;i--){const f=effects[i];f.left-=dt;if(f.left<=0){dispose(f);effects.splice(i,1);continue;}if(ctx.visible)f.group.visible=ctx.visible(f.at);const t=1-f.left/f.total,fade=Math.min(1,(1-t)*3);for(const m of f.mats)m.opacity=(m===f.mats[2]?.13:.85)*fade;
      for(const p of f.parts){const {m,base,mode}=p,travel=reduced?.3:1;
        if(mode==='expand'){m.scale.setScalar(1+t*1.3*travel);}
        if(mode==='rise')m.position.y=base.y+t*.7*travel;
        if(mode==='fall')m.position.y=Math.max(.1,base.y-t*4.5);
        if(mode==='spark'){m.position.x=base.x*(1+t*2);m.position.z=base.z*(1+t*2);m.position.y=base.y+Math.sin(t*Math.PI)*.5;m.scale.setScalar(1-t*.65);}
        if(mode==='sweep'){m.rotation.z+=dt*4*travel;m.scale.setScalar(.8+t*.75);}
        if(mode==='orbit'){const a=t*2*travel; m.position.x=base.x*Math.cos(a)-base.z*Math.sin(a);m.position.z=base.x*Math.sin(a)+base.z*Math.cos(a);m.position.y=base.y+t*.8;}
        if(mode==='breathe')m.scale.setScalar(.9+Math.sin(t*Math.PI)*.12);
        if(mode==='mist'){m.scale.setScalar(1+t*.8);m.position.y=base.y+t*.45;}
        if(mode==='spin')m.rotation.z+=dt*2;
        if(mode==='contact'){m.position.set(base.x*(1+t*3),base.y+(base.y-1.05)*t*3,base.z*(1+t*3));m.scale.setScalar(1-t*.8);}
        if(mode==='gather'){m.position.set(base.x*(1-t),base.y+t*.8,base.z*(1-t));}
      }
    }}
    function reset(){effects.forEach(dispose);effects=[];}
    function cancel(effect){const i=effects.indexOf(effect);if(i>=0)dispose(effects.splice(i,1)[0]);}
    return {emit,tick,reset,cancel,stats:()=>({groups:effects.length,max:limit,meshes:effects.reduce((n,f)=>n+f.group.children.length,0)})};
  }
  root.TowerSkillEffects={create,FAMILIES};
})(globalThis);
