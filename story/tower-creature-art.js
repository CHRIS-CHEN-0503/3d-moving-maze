/* Original tower fauna. Vertex-colour surfaces are merged by material so the
 * silhouettes can be sculpted without one draw call per foot, scale or petal.
 * No downloaded art, dynamic light, shared disposable resource or animation loop.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.TowerCreatureArt=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const COLORS=Object.freeze({clockmite:0xdba65f,wisp:0xa6a0ff,sentinel:0x839cae,hound:0xff9868,shardseer:0x63dbe9,mushroom:0xcf95bc,crab:0xc28c62,moth:0xdfcc79,flower:0x96bb70});
  const mix=(a,b,t)=>{let c=0;for(const s of [16,8,0])c|=Math.round(((a>>>s)&255)*(1-t)+((b>>>s)&255)*t)<<s;return c;};
  function build(T,kind,def={}){
    if(!T?.BufferGeometry||!Object.prototype.hasOwnProperty.call(COLORS,kind))return null;
    const tint=Number.isInteger(def.color)?def.color:COLORS[kind],dark=mix(tint,0x172332,.63),light=mix(tint,0xffedc5,.3),ivory=0xe9dcc0;
    const model=new T.Group(),body=new T.Group();model.name='tower-creature-'+kind;model.add(body);body.name='creature-body';body.position.y=kind==='clockmite'?.6:1;
    const material=new T.MeshLambertMaterial({vertexColors:true}),luminous=new T.MeshBasicMaterial({vertexColors:true});
    const buckets=new Map(),tmp=new T.Vector3(),normal=new T.Vector3(),matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),quaternion=new T.Quaternion(),euler=new T.Euler(),color=new T.Color();
    function add(geometry,tone,pos=[0,0,0],scale=[1,1,1],rotation=[0,0,0],parent=body,glow=false){
      const original=geometry;if(geometry.index)geometry=geometry.toNonIndexed();
      quaternion.setFromEuler(euler.set(...rotation));matrix.compose(new T.Vector3(...pos),quaternion,new T.Vector3(...scale));normalMatrix.getNormalMatrix(matrix);
      if(!buckets.has(parent))buckets.set(parent,[{p:[],n:[],c:[]},{p:[],n:[],c:[]}]);const bucket=buckets.get(parent)[glow?1:0],p=geometry.attributes.position,n=geometry.attributes.normal;color.setHex(tone);
      for(let i=0;i<p.count;i++){tmp.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();bucket.p.push(tmp.x,tmp.y,tmp.z);bucket.n.push(normal.x,normal.y,normal.z);bucket.c.push(color.r,color.g,color.b);}
      geometry.dispose();if(geometry!==original)original.dispose();
    }
    const ellipsoid=(tone,pos,scale,rotation=[0,0,0],parent=body,glow=false)=>add(new T.SphereGeometry(1,10,6),tone,pos,scale,rotation,parent,glow);
    const faceted=(tone,pos,scale)=>add(new T.DodecahedronGeometry(1,0),tone,pos,scale);
    function rod(tone,a,b,r1=.05,r2=r1,parent=body){
      const from=new T.Vector3(...a),to=new T.Vector3(...b),dir=to.clone().sub(from),g=new T.CylinderGeometry(r2,r1,dir.length(),6,1);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));add(g,tone,from.add(to).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],parent);
    }
    const curve=(tone,points,r=.04,parent=body)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),8,r,5,false),tone,[0,0,0],[1,1,1],[0,0,0],parent);
    const cone=(tone,pos,r=.12,h=.3,rotation=[0,0,0],parent=body)=>add(new T.ConeGeometry(r,h,6,1),tone,pos,[1,1,1],rotation,parent);
    const eye=(x,y,z,size=.075,tone=0xffdeb0,parent=body)=>ellipsoid(tone,[x,y,z],[size,size*.8,size*.55],[0,0,0],parent,true);
    const lathe=(tone,points,pos=[0,0,0],scale=[1,1,1])=>add(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),12),tone,pos,scale);
    if(kind==='clockmite'){
      ellipsoid(dark,[0,-.08,-.02],[.53,.27,.62]);
      for(const s of [-1,1]){
        ellipsoid(tint,[s*.23,.1,-.12],[.3,.31,.5],[0,0,s*-.12]);
        for(let i=0;i<3;i++){const z=(i-1)*.38;rod(dark,[s*.35,-.08,z],[s*.7,-.17,z-.12],.065,.045);rod(light,[s*.7,-.17,z-.12],[s*.87,-.48,z+.04],.045,.025);}
        curve(dark,[[s*.19,.05,.47],[s*.28,.2,.69],[s*.4,.28,.82]],.028);
        eye(s*.18,.09,.71,.086);
      }
      ellipsoid(dark,[0,-.015,.46],[.33,.22,.24]);
      // Segmented winding crown, attached to the carapace, makes it a clockwork
      // beetle even at minimised phone rendering resolution.
      add(new T.CylinderGeometry(.21,.24,.09,10),light,[0,.39,-.1]);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;cone(dark,[Math.cos(a)*.23,.42,Math.sin(a)*.23-.1],.055,.11);}
      add(new T.CylinderGeometry(.065,.065,.1,6),dark,[0,.44,-.1]);
    }else if(kind==='wisp'){
      lathe(tint,[[0,-.65],[.1,-.5],[.3,-.27],[.42,.1],[.34,.45],[.15,.7],[0,.88]],[0,0,0],[1,1,.8]);
      ellipsoid(light,[0,.17,.22],[.28,.25,.17]);
      for(const s of [-1,1]){curve(tint,[[s*.22,.07,0],[s*.59,.25,-.1],[s*.61,.57,-.17]],.085);cone(tint,[s*.61,.63,-.18],.084,.24,[.16,0,-s*.12]);curve(light,[[s*.09,-.16,0],[s*.27,-.47,-.07],[s*.16,-.65,-.23]],.045);eye(s*.1,.22,.37,.09,0x302641);}
      cone(light,[.05,.76,-.035],.17,.49,[.22,0,-.25]);
    }else if(kind==='sentinel'){
      faceted(dark,[0,.04,0],[.57,.54,.34]);faceted(tint,[0,.12,.12],[.5,.49,.32]);
      faceted(light,[0,.68,0],[.32,.33,.28]);faceted(dark,[0,.55,.22],[.28,.12,.16]);
      for(const s of [-1,1]){
        faceted(tint,[s*.54,.32,0],[.29,.29,.3]);rod(dark,[s*.55,.13,0],[s*.62,-.28,.04],.17,.2);faceted(light,[s*.65,-.3,.08],[.23,.3,.22]);
        rod(dark,[s*.22,-.35,0],[s*.25,-.72,0],.19,.16);faceted(tint,[s*.25,-.82,.09],[.24,.2,.35]);
        eye(s*.125,.73,.255,.063,0xb6f4e6);
      }
      for(let i=0;i<3;i++)add(new T.OctahedronGeometry(.105),0x8ddcca,[0,.27-i*.13,.432],[.48,1,.28],[0,0,0],body,true);
    }else if(kind==='hound'){
      ellipsoid(dark,[0,-.12,-.17],[.38,.35,.66]);ellipsoid(tint,[0,.02,.27],[.37,.39,.38]);
      ellipsoid(dark,[0,.32,.49],[.3,.29,.38],[.13,0,0]);ellipsoid(light,[0,.2,.79],[.22,.15,.28]);faceted(dark,[0,.25,1.02],[.12,.08,.09]);
      for(const s of [-1,1]){
        cone(dark,[s*.21,.62,.35],.145,.43,[.08,0,s*-.18]);cone(tint,[s*.21,.62,.37],.08,.28,[.08,0,s*-.18]);
        for(const z of [-.52,.38]){rod(dark,[s*.28,-.25,z],[s*.3,-.56,z-.1],.1,.07);rod(tint,[s*.3,-.56,z-.1],[s*.31,-.81,z+.02],.07,.05);ellipsoid(dark,[s*.31,-.84,z+.08],[.12,.09,.19]);}
        eye(s*.245,.39,.69,.062,0xffce68);
        cone(ivory,[s*.145,.065,.87],.035,.16,[Math.PI,0,0]);
      }
      curve(dark,[[0,-.03,-.68],[.16,.2,-.97],[.24,.48,-1.12]],.1);
      for(let i=0;i<4;i++)cone(tint,[0,.26+i*.02,-.55+i*.18],.1,.26,[.32,0,0]);
    }else if(kind==='shardseer'){
      lathe(dark,[[0,-.86],[.43,-.72],[.36,-.42],[.3,.04],[.38,.36],[.19,.6],[0,.62]]);
      add(new T.OctahedronGeometry(.42),tint,[0,.63,0],[.7,1.3,.65]);
      for(const s of [-1,1]){add(new T.OctahedronGeometry(.29),light,[s*.4,.26,0],[1,.9,.7],[0,0,s*.35]);rod(dark,[s*.34,.18,0],[s*.45,-.24,.16],.075,.065);eye(s*.1,.63,.246,.052,0xf3f9d0);}
      for(const [x,h]of [[-.22,.22],[0,.3],[.22,.22]])add(new T.OctahedronGeometry(.14),light,[x,.85,0],[.55,h/.14,.55],[0,0,-x*.7]);
      curve(dark,[[-.48,-.75,.22],[-.52,-.05,.23],[-.65,.55,.22]],.04);add(new T.OctahedronGeometry(.17),tint,[-.64,.68,.22],[.8,1.6,.8]);
    }else if(kind==='mushroom'){
      lathe(ivory,[[0,-.94],[.3,-.86],[.25,-.57],[.22,-.1],[.34,.06],[0,.08]]);
      add(new T.SphereGeometry(.78,14,7,0,Math.PI*2,0,Math.PI/2),tint,[0,.06,0],[1,.65,1]);
      add(new T.ConeGeometry(.77,.11,14),dark,[0,.025,0],[1,1,1],[Math.PI,0,0]);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;ellipsoid(ivory,[Math.cos(a)*.43,.495,Math.sin(a)*.43],[.115,.026,.13],[Math.sin(a)*.42,0,-Math.cos(a)*.42]);}
      for(const s of [-1,1]){ellipsoid(dark,[s*.24,-.88,.02],[.19,.1,.22]);eye(s*.105,-.31,.224,.054,0x4c3844);curve(tint,[[s*.2,-.38,0],[s*.42,-.41,.08],[s*.47,-.25,.09]],.055);}
      for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(light,[Math.cos(a)*.25,.003,Math.sin(a)*.25],[Math.cos(a)*.69,.003,Math.sin(a)*.69],.015,.022);}
    }else if(kind==='crab'){
      ellipsoid(dark,[0,-.55,0],[.64,.23,.5]);add(new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2),tint,[0,-.5,0],[.68,.45,.55]);
      for(const s of [-1,1]){
        for(let i=0;i<3;i++){const z=(i-1)*.32;rod(dark,[s*.45,-.54,z],[s*.81,-.6,z-.11],.062,.045);rod(tint,[s*.81,-.6,z-.11],[s*.96,-.9,z+.12],.045,.022);}
        rod(dark,[s*.46,-.5,.35],[s*.65,-.3,.64],.095,.065);ellipsoid(light,[s*.72,-.2,.7],[.23,.2,.25]);
        curve(tint,[[s*.85,-.11,.74],[s*.91,-.04,.98],[s*.78,-.07,1.03]],.072);curve(dark,[[s*.64,-.18,.79],[s*.62,-.16,.98],[s*.72,-.12,1.025]],.052);
        rod(dark,[s*.24,-.32,.35],[s*.29,-.055,.44],.036,.028);eye(s*.29,-.04,.456,.075,0xf7e6bf);
      }
      for(let i=0;i<3;i++)cone(light,[(i-1)*.25,-.035,-.16],.067,.16);
    }else if(kind==='moth'){
      ellipsoid(dark,[0,0,0],[.16,.22,.5]);ellipsoid(light,[0,.09,.35],[.22,.2,.23]);
      for(let i=0;i<3;i++)ellipsoid(i%2?dark:tint,[0,-.01,-.22-i*.13],[.17-i*.023,.17-i*.02,.14]);
      for(const s of [-1,1]){
        curve(dark,[[s*.11,.2,.44],[s*.28,.47,.48],[s*.4,.5,.39]],.022);eye(s*.13,.15,.53,.068,0x473728);
        const wing=new T.Group();wing.name='party-wing';wing.position.set(s*.14,.03,-.03);body.add(wing);
        // Scalloped fore/hind wings share one material batch per animated side.
        const outline=[[0,0],[.27,.59],[.68,.72],[.94,.57],[1.05,.29],[.85,.11],[.99,-.13],[.8,-.43],[.5,-.55],[.22,-.4],[.07,-.19]],positions=[],normals=[];
        for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],front=s>0?[a,b]:[b,a];for(const [x,z]of [[.33,0],...front]){positions.push(s*x,0,z);normals.push(0,1,0);}for(const [x,z]of [[.33,0],...front.slice().reverse()]){positions.push(s*x,-.012,z);normals.push(0,-1,0);}}
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));add(geo,tint,[0,0,0],[1,1,1],[0,0,0],wing);
        for(const [x,z,sz]of [[.6,.31,.2],[.55,-.27,.15]]){ellipsoid(dark,[s*x,.013,z],[sz,.012,sz*.88],[0,0,0],wing);ellipsoid(light,[s*x,.028,z],[sz*.6,.014,sz*.55],[0,0,0],wing);}
        for(const z of [.3,-.2])rod(dark,[0,.01,0],[s*.78,.015,z],.013,.008,wing);
      }
    }else if(kind==='flower'){
      curve(dark,[[0,-.89,0],[-.09,-.54,-.1],[.03,-.14,0],[0,.22,.03]],.13);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;curve(dark,[[0,-.69,0],[Math.cos(a)*.28,-.82,Math.sin(a)*.28],[Math.cos(a)*.55,-.91,Math.sin(a)*.55]],.055);ellipsoid(tint,[Math.cos(a)*.32,-.48,Math.sin(a)*.32],[.34,.07,.18],[0,-a,i%2?.25:-.25]);}
      ellipsoid(dark,[0,.29,.04],[.43,.38,.28]);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;ellipsoid(i%2?0xba647f:0xd890a0,[Math.cos(a)*.34,.29+Math.sin(a)*.34,.07],[.27,.15,.15],[0,0,a]);}
      ellipsoid(0x573542,[0,.29,.286],[.26,.23,.055]);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;cone(ivory,[Math.cos(a)*.18,.29+Math.sin(a)*.17,.31],.032,.115,[0,0,a+Math.PI/2]);}
      for(const s of [-1,1])eye(s*.13,.51,.29,.05,0xf5d980);
    }
    let triangles=0,drawCalls=0,usesGlow=false;
    for(const [parent,rows]of buckets)for(const [index,data]of rows.entries())if(data.p.length){
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.p,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(data.n,3));geometry.setAttribute('color',new T.Float32BufferAttribute(data.c,3));geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,index?luminous:material);mesh.name=index?'creature-eye-light':'creature-sculpture';parent.add(mesh);triangles+=data.p.length/9;drawCalls++;if(index)usesGlow=true;
    }
    if(!usesGlow)luminous.dispose();
    const ring=new T.Mesh(new T.TorusGeometry(.83,.045,5,20),new T.MeshBasicMaterial({color:0xe28476,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.065;ring.name='creature-threat-ring';model.add(ring);
    triangles+=ring.geometry.index.count/3;drawCalls++;model.userData.body=body;model.userData.ring=ring;model.userData.art=Object.freeze({kind,triangles,drawCalls});return model;
  }
  return Object.freeze({build,kinds:Object.freeze(Object.keys(COLORS))});
});
