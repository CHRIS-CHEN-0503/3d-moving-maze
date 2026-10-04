/* Attack anticipation and impact feedback: two local draws per visible enemy,
   no new lights, timers, full-screen flashes, textures or gameplay decisions. */
(function(root){'use strict';
  function attach(T,model){
    if(model.userData.combatReadability)return model.userData.combatReadability;
    const group=new T.Group();group.name='monster-attack-cue';group.visible=false;model.add(group);
    const material=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(0xffa65e)},progress:{value:0},opacity:{value:.5},bounds:{value:new T.Vector4(-1e6,-1e6,1e6,1e6)}},vertexShader:'varying vec2 v;varying vec2 worldXZ;void main(){v=uv*2.-1.;worldXZ=(modelMatrix*vec4(position,1.)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;varying vec2 worldXZ;uniform vec4 bounds;uniform vec3 tint;uniform float progress;uniform float opacity;void main(){if(worldXZ.x<bounds.x||worldXZ.y<bounds.y||worldXZ.x>bounds.z||worldXZ.y>bounds.w)discard;float r=length(v);float edge=1.-smoothstep(.91,1.,r);float fill=1.-smoothstep(progress-.06,progress+.06,r);float a=(.08+fill*.19+pow(r,6.)*.22)*edge*opacity;gl_FragColor=vec4(tint,a);}',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});
    const disc=new T.Mesh(new T.PlaneGeometry(4.1,4.1),material);disc.rotation.x=-Math.PI/2;disc.position.y=.045;group.add(disc);
    const shape=new T.Shape();shape.moveTo(0,.65);shape.lineTo(.18,0);shape.lineTo(0,.14);shape.lineTo(-.18,0);shape.closePath();
    const direction=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0xffce83,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false}));direction.rotation.x=Math.PI/2;direction.scale.setScalar(.65);direction.position.set(0,.45,.35);group.add(direction);
    const data={group,disc,direction,material,baseScale:model.userData.body?.scale.clone(),impact:0,lastRelease:0,windupTotal:0,lastWindup:0};model.userData.combatReadability=data;return data;
  }
  function update(T,m,{dt=0,stunned=false,visible=true,reducedMotion=false,bounds=null}={}){
    if(!m.alive&&!m.model.userData.combatReadability)return null;
    const state=attach(T,m.model),w=Math.max(0,m.windup||0),body=m.model.userData.body;
    if(!m.alive||!visible){state.group.visible=false;state.lastRelease=m.cueRelease||0;state.impact=0;state.lastWindup=0;if(body&&state.baseScale)body.scale.copy(state.baseScale);return state;}
    if((m.cueRelease||0)!==state.lastRelease&&!stunned)state.impact=.22;
    state.lastRelease=m.cueRelease||0;state.impact=Math.max(0,state.impact-dt);
    if(bounds)state.material.uniforms.bounds.value.set(bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ);
    const attacking=w>0,alert=(m.awarenessLeft||0)>0,stateColor=stunned?0x8cdcf5:attacking?0xffa74f:0xee836a;
    if(attacking){if(Number.isFinite(m.windupTotal)&&m.windupTotal>0)state.windupTotal=m.windupTotal;else if(state.lastWindup<=0||w>state.lastWindup)state.windupTotal=w;}else state.windupTotal=0;state.lastWindup=w;
    state.group.visible=attacking||stunned||state.impact>0;
    state.material.uniforms.tint.value.setHex(stateColor);
    state.material.uniforms.progress.value=stunned?.4:attacking?Math.max(0,Math.min(1,1-w/(state.windupTotal||w))):1;
    state.material.uniforms.opacity.value=stunned?.6:attacking?1:state.impact/.22;
    state.disc.scale.setScalar(m.def.ranged?.62:stunned?.44:1);
    state.direction.visible=attacking&&!!m.def.ranged;
    if(m.model.userData.ring)m.model.userData.ring.visible=!attacking&&(stunned||alert);
    // A readable windup/release silhouette also works for colour-blind players.
    if(body&&state.baseScale){const charge=attacking&&!reducedMotion?Math.min(1,w/(state.windupTotal||w))*.07:0;body.scale.set(state.baseScale.x*(1+charge),state.baseScale.y*(1-charge),state.baseScale.z);}
    return state;
  }
  root.TowerCombatReadability={attach,update};if(typeof module==='object'&&module.exports)module.exports=root.TowerCombatReadability;
})(globalThis);
