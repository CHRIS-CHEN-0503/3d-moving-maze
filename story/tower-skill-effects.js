/* Original soft particle spells. No line/ring geometry, shadows or postprocessing. */
(function(root){'use strict';
  const PALETTES={swordsman:[0xffe5af,0xffa46c],mage:[0xc6b5ff,0x86e4ff],scout:[0xa3ffe0,0x54cda2],chef:[0xffd6a0,0xff9a64],healer:[0xd9ffe4,0x79edba],smith:[0xffdea9,0xffa465],archer:[0xffe6ac,0x99ddb2]};
  const FAMILIES={arrow:'arrow',binding:'arrow',volley:'arrow',great_arrow:'arrow',decisive:'slash',star_ring:'meteor',escape:'scan',feast:'steam',sanctuary:'heal',fortress:'shield',cleave:'slash',circle:'spin',blind:'slash',stun:'impact',stagger:'impact',splash:'splash',bolt:'cast',weak:'cast',slow:'cast',mark:'cast',shock:'storm',repel:'wave',starfall:'meteor',guard:'shield',barrier:'shield',ward:'shield',fortify:'shield',rally:'aura',speed:'aura',polish:'forge',stealth:'smoke',smoke:'smoke',stomach:'steam',meal:'steam',soup:'heal',heal:'heal',revive:'heal',cleanse:'cleanse',reveal:'scan',disarm:'scan',daylight:'sun',repair:'forge',frost:'frost',taunt:'wave',barricade:'forge'};
  function create(T,ctx){let effects=[];const limit=Math.min(12,ctx.limit||12),reduced=!!ctx.reducedMotion;
    // Two small original alpha textures live with this effect manager (8 KiB).
    function texture(petal=false){const size=32,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(x-15.5)/15.5,dy=(y-15.5)/15.5,d=Math.sqrt(dx*dx*(petal?2.1:1)+dy*dy),a=Math.pow(Math.max(0,1-d),petal?1.3:2.1),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*255);}const map=new T.DataTexture(data,size,size,T.RGBAFormat);map.needsUpdate=true;map.magFilter=map.minFilter=T.LinearFilter;return map;}
    const glow=texture(),petal=texture(true);
    function dispose(f){f.group.parent?.remove(f.group);const geometries=new Set();f.group.traverse(o=>{if(o.isMesh&&o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());f.mats.forEach(m=>m.dispose());}
    function emit(skill,at,angle=0,options={}){
      if(!at||!skill||!FAMILIES[skill.effect]||ctx.visible&&!ctx.visible(at))return null;
      if(effects.length>=limit)dispose(effects.shift());
      const family=options.impact?'hit':options.stage==='charge'?'charge':options.stage==='land'?'burst':FAMILIES[skill.effect],colors=PALETTES[skill.job]||PALETTES.swordsman,group=new T.Group();group.name='skill-vfx-'+skill.id;group.position.set(at.x,.04,at.z);group.rotation.y=angle;
      const total=family==='hit'?.42:family==='charge'||family==='meteor'?Math.min(4,Math.max(.1,Number(options.duration)||.75)):reduced?.65:['heal','shield','sun'].includes(family)?1.4:1.05,parts=[],mats=[];
      function material(color,opacity=.8,map=null,sprite=false){const opts={color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,...(map?{map}:{}),side:T.DoubleSide},m=sprite?new T.SpriteMaterial(opts):new T.MeshBasicMaterial(opts);m.userData.baseOpacity=opacity;mats.push(m);return m;}
      function soft(x,y,z,size,tint=0,mode='rise',leaf=false){const m=new T.Sprite(material(colors[tint],leaf?.85:.95,leaf?petal:glow,true));m.position.set(x,y,z);m.scale.set(size,leaf?size*1.4:size,1);group.add(m);parts.push({m,base:m.position.clone(),scale:m.scale.clone(),mode});return m;}
      function solid(geometry,x,y,z,tint=0,mode='rise',opacity=.65){const m=new T.Mesh(geometry,material(colors[tint],opacity));m.position.set(x,y,z);group.add(m);parts.push({m,base:m.position.clone(),scale:m.scale.clone(),mode});return m;}
      const ground=new T.Mesh(new T.PlaneGeometry(3.2,3.2),material(colors[1],.35,glow));ground.rotation.x=-Math.PI/2;ground.position.y=.008;group.add(ground);
      const count=reduced?3:6;
      if(['slash','spin','splash'].includes(family)){
        const shape=new T.Shape();shape.moveTo(-1.1,0);shape.quadraticCurveTo(.2,1.4,1.2,.15);shape.quadraticCurveTo(.4,.6,-1.1,0);const sweep=solid(new T.ShapeGeometry(shape,12),0,1,.5,0,'sweep',.48);sweep.rotation.x=-.6;
        for(let i=0;i<count;i++)soft(Math.sin(i*1.6)*.7,.8+i*.09,.6+Math.cos(i)*.5,.4,i%2,'spark',family==='splash');
      }else if(family==='shield'){
        const dome=solid(new T.SphereGeometry(1.1,12,7,0,Math.PI*2,0,Math.PI/2),0,.12,0,1,'breathe',.14);
        dome.userData.filledShield=true;for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*.8,.3+i*.17,Math.cos(a)*.8,.5,i%2,'orbit',true);}
      }else if(family==='meteor'){
        const n=skill.effect==='star_ring'?3:1;for(let i=0;i<n;i++){const a=i*Math.PI*2/3,x=Math.sin(a)*.7,z=Math.cos(a)*.7;soft(x,3.4,z,1.4,0,'fall');const flame=soft(x,4.1,z,1.1,1,'fall');flame.scale.y=2.3;}
      }else if(family==='charge'){
        soft(0,1.1,0,1.5,0,'breathe');for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a),.2+i*.14,Math.cos(a),.45,i%2,'gather');}
      }else if(family==='frost'){
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;const shard=solid(new T.ConeGeometry(.18,.65,5),Math.sin(a)*1.1,.24,Math.cos(a)*1.1,i%2,'rise',.6);shard.rotation.z=Math.sin(a)*.18;}
        soft(0,.4,0,2,1,'breathe');
      }else if(['smoke','steam'].includes(family)){
        for(let i=0;i<count;i++){const a=i*2.4;soft(Math.sin(a)*.65,.25+i*.13,Math.cos(a)*.65,1.35,1,'mist');}
      }else if(['cast','arrow'].includes(family)){
        soft(0,1.12,.5,1,0,'breathe');for(let i=0;i<count;i++)soft(Math.sin(i*1.9)*.25,.95+i*.07,.4+i*.13,.32,i%2,'spark',family==='arrow');
      }else if(['hit','burst','impact','storm','forge'].includes(family)){
        soft(0,1.05,0,family==='burst'?2:1.3,0,'breathe');for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*.2,1.05+Math.cos(a)*.18,Math.cos(a)*.2,.32,i%2,'contact');}
      }else{
        soft(0,['sun','heal','cleanse'].includes(family)?1.75:.45,0,family==='sun'?1.9:1.35,0,'breathe');
        for(let i=0;i<count;i++){const a=i*Math.PI*2/count;soft(Math.sin(a)*.65,.15+i*.2,Math.cos(a)*.65,.45,i%2,['scan','wave'].includes(family)?'spark':'orbit',['heal','aura'].includes(family));}
      }
      ctx.world().add(group);const f={group,total,left:total,parts,mats,family,at:{x:at.x,z:at.z},skill:skill.id};effects.push(f);return f;
    }
    function tick(dt){for(let i=effects.length-1;i>=0;i--){const f=effects[i];f.left-=dt;if(f.left<=0){dispose(f);effects.splice(i,1);continue;}if(ctx.visible)f.group.visible=ctx.visible(f.at);const t=1-f.left/f.total,fade=Math.min(1,(1-t)*3),travel=reduced?.3:1;for(const m of f.mats)m.opacity=m.userData.baseOpacity*fade;
      for(const p of f.parts){const{m,base,mode,scale}=p;let size=1;if(mode==='rise')m.position.y=base.y+t*.85*travel;if(mode==='fall')m.position.y=Math.max(.12,base.y-t*4.5);if(mode==='spark'||mode==='contact'){m.position.x=base.x*(1+t*3*travel);m.position.z=base.z*(1+t*3*travel);m.position.y=base.y+(mode==='contact'?(base.y-1.05)*t*3:Math.sin(t*Math.PI)*.6);size=1-t*.6;}if(mode==='sweep'){m.rotation.z+=dt*3*travel;size=.8+t*.8;}if(mode==='orbit'){const a=t*2*travel;m.position.x=base.x*Math.cos(a)-base.z*Math.sin(a);m.position.z=base.x*Math.sin(a)+base.z*Math.cos(a);m.position.y=base.y+t*.7;}if(mode==='breathe')size=.9+Math.sin(t*Math.PI)*.25;if(mode==='mist'){size=1+t*1.1;m.position.y=base.y+t*.5;}if(mode==='gather')m.position.set(base.x*(1-t),base.y+t*.7,base.z*(1-t));m.scale.copy(scale).multiplyScalar(size);}
    }}
    function reset(){effects.forEach(dispose);effects=[];}
    function cancel(f){const i=effects.indexOf(f);if(i>=0)dispose(effects.splice(i,1)[0]);}
    return {emit,tick,reset,cancel,stats:()=>({groups:effects.length,max:limit,meshes:effects.reduce((n,f)=>n+f.group.children.length,0),textureBytes:8192})};
  }
  root.TowerSkillEffects={create,FAMILIES};
})(globalThis);
