/* Local atmospheric life, not loot or illumination. One draw, 24 points,
   10 Hz visibility checks, existing simulation clock, no lights or timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerEnvironmentLife=api;})(globalThis,function(){
  'use strict';
  const PROFILES=Object.freeze({
    spire:Object.freeze({name:'高塔浮塵',color:0xf0ddba,kind:0,speed:.23}),
    garden:Object.freeze({name:'花園花瓣',color:0xecc9b8,kind:1,speed:.3}),
    tree:Object.freeze({name:'林根飛絮',color:0xb2ce88,kind:1,speed:.2}),
    crystal:Object.freeze({name:'晶窟微塵',color:0xb7dbe5,kind:0,speed:.15}),
    books:Object.freeze({name:'舊書浮塵',color:0xdcc49e,kind:0,speed:.12}),
    water:Object.freeze({name:'水霧凝珠',color:0xb7dce0,kind:2,speed:.45}),
    ice:Object.freeze({name:'飄落霜晶',color:0xe0f3f6,kind:1,speed:.38}),
    gear:Object.freeze({name:'工坊塵埃',color:0xe3cfad,kind:0,speed:.15}),
    fire:Object.freeze({name:'爐火餘燼',color:0xf2aa69,kind:3,speed:.35}),
    heart:Object.freeze({name:'心室星塵',color:0xe3d3e8,kind:0,speed:.1})
  });
  const VERTEX='attribute float seed;attribute float visible;uniform float age;uniform float kind;uniform float speed;varying float opacity;void main(){vec3 p=position;float a=age*speed+seed*6.28318;p.x+=sin(a)*.09;p.z+=cos(a*.7)*.07;if(kind>2.5)p.y+=fract(age*speed+seed)*.5;else if(kind>.5)p.y-=fract(age*speed+seed)*.32;else p.y+=sin(a)*.06;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((kind>.5?.11:.065)*220./max(1.,-v.z),1.,12.);opacity=visible*.32*(.65+.35*sin(a));}';
  const FRAGMENT='uniform vec3 tint;uniform float kind;varying float opacity;void main(){vec2 p=(gl_PointCoord-.5)*2.;float d=kind>2.5?abs(p.x)*.75+abs(p.y)*1.25:kind>.5?length(p*vec2(1.,1.4)):length(p);float alpha=pow(max(0.,1.-d),1.8)*opacity;if(alpha<.012)discard;gl_FragColor=vec4(tint,alpha);}';
  function create(T,ctx={}){
    const profile=PROFILES[ctx.style]||PROFILES.spire,count=24,positions=new Float32Array(count*3),seeds=new Float32Array(count),visible=new Float32Array(count);
    let seed=Number(ctx.seed)>>>0,age=0,sampleLeft=0,destroyed=false,checks=0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    // Stable offsets do not use gameplay RNG or persist anything in a save.
    const offsets=new Float32Array(count*3);for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=1.1+random()*3.1;offsets[i*3]=Math.sin(a)*r;offsets[i*3+1]=.4+random()*1.9;offsets[i*3+2]=Math.cos(a)*r;seeds[i]=random();}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('seed',new T.BufferAttribute(seeds,1));geometry.setAttribute('visible',new T.BufferAttribute(visible,1));
    const material=new T.ShaderMaterial({uniforms:{age:{value:0},kind:{value:profile.kind},speed:{value:profile.speed},tint:{value:new T.Color(profile.color)}},vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,blending:T.NormalBlending,toneMapped:false});
    const cloud=new T.Points(geometry,material);cloud.name='local-environment-'+ctx.style;cloud.userData.role='scenery';cloud.frustumCulled=false;ctx.world?.()?.add(cloud);cloud.visible=false;
    function tick(dt){
      if(destroyed||!Number.isFinite(dt)||dt<=0)return;const p=ctx.player?.();if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)){cloud.visible=false;return;}
      const reduced=!!ctx.reduced?.(),budget=ctx.quality?.()==='battery'?8:count;
      cloud.visible=!reduced;if(reduced)return;
      // MazeSight filters each root by its world position. Keep this root at
      // the observer, and vertices local, instead of hiding all nearby dust
      // whenever the maze centre is behind a wall.
      cloud.position.set(p.x,0,p.z);age+=Math.min(dt,.25);material.uniforms.age.value=age;sampleLeft-=dt;
      if(sampleLeft>0)return;sampleLeft=.1;
      for(let i=0;i<count;i++){const x=p.x+offsets[i*3],z=p.z+offsets[i*3+2];positions[i*3]=offsets[i*3];positions[i*3+1]=offsets[i*3+1];positions[i*3+2]=offsets[i*3+2];checks++;visible[i]=i<budget&&(!ctx.visible||ctx.visible(x,z))&&(!ctx.clear||ctx.clear(p.x,p.z,x,z))?1:0;}
      geometry.attributes.position.needsUpdate=true;geometry.attributes.visible.needsUpdate=true;
    }
    function destroy(){if(destroyed)return;destroyed=true;cloud.parent?.remove(cloud);geometry.dispose();material.dispose();}
    return {tick,destroy,cloud,profile,stats:()=>({points:destroyed?0:count,drawCalls:destroyed||!cloud.visible?0:1,checks,textureBytes:0})};
  }
  return Object.freeze({PROFILES,create});
});
