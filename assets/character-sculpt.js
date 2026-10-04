/* Original low-poly sculpted silhouettes. Geometry is owned by each model, not
   globally cached across scenes: disposing one character cannot break another. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CharacterSculpt=api;})(globalThis,function(){
  'use strict';
  function ellipsoid(T,w,h,d){const g=new T.SphereGeometry(1,12,8);g.scale(w/2,h/2,d/2);return g;}
  function catHead(T){
    const g=new T.SphereGeometry(1,24,16),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=Math.max(0,z),cheek=Math.exp(-((Math.abs(x)-.52)**2/.16+(y+.22)**2/.18)),snout=Math.exp(-(x*x/.30+(y+.32)**2/.13));p.setXYZ(i,x*.305*(1+.09*cheek),y*.265,z*.25+front*(.053*cheek+.072*snout));}
    g.computeVertexNormals();g.userData.catSculpt=true;return g;
  }
  function catEye(T){const g=new T.SphereGeometry(1,12,8),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setXYZ(i,x*.055,y*.041*(1-.3*Math.abs(x)),p.getZ(i)*.014);}g.computeVertexNormals();return g;}
  function catDetails(T,appearance={}){
    const skin=appearance.skin??0xffa040,hair=appearance.hair??0xef6c00,parts=[],add=(name,geometry,color,position,rotation=[0,0,0])=>parts.push({name,geometry,color,position,rotation});
    const ear=new T.Shape();ear.moveTo(-.115,-.04);ear.quadraticCurveTo(-.135,.10,-.025,.27);ear.quadraticCurveTo(0,.30,.025,.27);ear.quadraticCurveTo(.135,.10,.115,-.04);ear.quadraticCurveTo(0,-.09,-.115,-.04);
    for(const side of [-1,1]){
      const outer=new T.ExtrudeGeometry(ear,{depth:.09,bevelEnabled:true,bevelThickness:.016,bevelSize:.014,bevelSegments:2,curveSegments:4});outer.translate(0,0,-.045);
      add('cat-continuous-ear',outer,skin,[side*.195,.195,-.025],[0,-side*.12,-side*.18]);
      const inner=new T.ExtrudeGeometry(ear,{depth:.008,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1,curveSegments:3});inner.scale(.67,.65,1);inner.translate(-.007,.035,0);add('cat-cupped-inner-ear',inner,0xe6a29b,[side*.195,.195,.035],[0,-side*.12,-side*.18]);
      for(let i=0;i<3;i++){const path=new T.CatmullRomCurve3([new T.Vector3(side*.108,-.106-i*.020,.321),new T.Vector3(side*.21,-.10-i*.026,.324),new T.Vector3(side*.365,-.069-i*.042,.287)]);add('cat-whisker',new T.TubeGeometry(path,6,.004,3,false),0x59463c,[0,0,0]);}
      for(let i=0;i<3;i++){const dot=ellipsoid(T,.010,.010,.005);add('cat-whisker-root',dot,0x805b49,[side*(.085+i*.022),-.084-i%2*.018,.340-i*.006]);}
    }
    const muzzle=new T.SphereGeometry(1,16,10),mp=muzzle.attributes.position;
    for(let i=0;i<mp.count;i++){const x=mp.getX(i),y=mp.getY(i),z=mp.getZ(i);mp.setXYZ(i,x*.18,y*.095,z*.075+Math.max(0,z)*.018*Math.exp(-((Math.abs(x)-.52)**2/.14)));}muzzle.computeVertexNormals();add('cat-connected-muzzle',muzzle,0xffe0b0,[0,-.10,.264]);
    const nose=new T.Shape();nose.moveTo(-.047,.012);nose.quadraticCurveTo(-.05,.033,-.026,.031);nose.quadraticCurveTo(0,.021,.026,.031);nose.quadraticCurveTo(.05,.033,.047,.012);nose.quadraticCurveTo(.015,-.004,.005,-.022);nose.quadraticCurveTo(0,-.028,-.005,-.022);nose.quadraticCurveTo(-.015,-.004,-.047,.012);
    const ng=new T.ExtrudeGeometry(nose,{depth:.014,bevelEnabled:true,bevelThickness:.006,bevelSize:.004,bevelSegments:2,curveSegments:4});add('cat-rounded-nose',ng,0xcd8792,[0,-.059,.343]);
    const philtrum=new T.CatmullRomCurve3([new T.Vector3(0,-.08,.359),new T.Vector3(0,-.101,.358),new T.Vector3(0,-.13,.349)]);add('cat-nose-to-mouth',new T.TubeGeometry(philtrum,4,.004,3,false),0x59463c,[0,0,0]);
    for(const side of [-1,1]){const path=new T.CatmullRomCurve3([new T.Vector3(side*.045,.218,.165),new T.Vector3(side*.034,.187,.196),new T.Vector3(side*.056,.157,.222)]);add('cat-forehead-fur-mark',new T.TubeGeometry(path,5,.013,4,false),hair,[0,0,0]);}
    const middle=new T.CatmullRomCurve3([new T.Vector3(0,.232,.146),new T.Vector3(0,.205,.177),new T.Vector3(0,.172,.204)]);add('cat-forehead-fur-mark',new T.TubeGeometry(middle,5,.011,4,false),hair,[0,0,0]);
    return parts;
  }
  function catTail(T){return new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,.82,-.18),new T.Vector3(0,.84,-.38),new T.Vector3(.08,.99,-.51),new T.Vector3(.13,1.10,-.46)]),12,.045,6,false);}
  function head(T,w=.54,h=.55,d=.48,{jaw=1,cheek=1,chin=1,detail='shared'}={}){
    const g=new T.SphereGeometry(1,detail==='hero'?26:20,detail==='hero'?18:14),p=g.attributes.position;
    for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const lower=Math.max(0,-y),front=Math.max(0,z),eye=Math.exp(-((Math.abs(x)-.48)**2/.055+(y-.1)**2/.04));
      x*=1+(jaw-1)*lower*.7;y+=.035*(chin-1)*lower;z+=front*(.065*cheek*Math.exp(-((Math.abs(x)-.56)**2/.07+(y+.2)**2/.09))-.05*eye+.035*chin*Math.exp(-(x*x/.12+(y+.65)**2/.08)));
      // One connected cheekbone, philtrum and chin surface, instead of adding
      // more floating face pieces. The temple stays rounded under every hairdo.
      z+=front*(.025*Math.exp(-((Math.abs(x)-.5)**2/.045+(y+.03)**2/.035))-.018*Math.exp(-(x*x/.04+(y+.42)**2/.045)));
      // Connected nasal bridge, orbital rims, cheek planes and lip recess.
      // The detailed head stays below one thousand triangles.
      z+=front*(.082*Math.exp(-(x*x/.012+(y+.055)**2/.07))+.078*Math.exp(-(x*x/.025+(y+.225)**2/.019))
        -.026*Math.exp(-((Math.abs(x)-.43)**2/.07+(y-.12)**2/.055))
        +.019*Math.exp(-((Math.abs(x)-.62)**2/.06+(y+.25)**2/.045))
        -.02*Math.exp(-(x*x/.13+(y+.47)**2/.01)));
      x*=1-.035*Math.exp(-((y-.28)**2/.06));p.setXYZ(i,x*w/2,y*h/2,z*d/2);
    }g.computeVertexNormals();return g;
  }
  function knightHead(T){
    // Keep the forehead/scalp seam and existing segment budget. Shape the lower
    // face into lean cheek planes and a longer, tapered jaw, not a round ball.
    const g=head(T,.54,.55,.48,{jaw:1.06,cheek:1.12,chin:1.04,detail:'hero'}),p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),lower=Math.max(0,-y/.275),faceBand=Math.max(0,Math.min(1,(.11-y)/.16)),front=Math.max(0,z/.24);
      const lean=1-faceBand*(.075+.19*lower);
      const cheekPlane=.022*front*Math.exp(-((Math.abs(x)-.15)**2/.005+(y+.07)**2/.006));
      p.setXYZ(i,x*lean,y*(1+.20*lower),z-cheekPlane);
    }
    g.computeVertexNormals();g.userData.knightFace=true;return g;
  }
  function capsule(T,w,h,d){
    const cap=Math.min(h*.28,w*.48),points=[new T.Vector2(0,-h/2),new T.Vector2(w*.31,-h/2+cap*.2),new T.Vector2(w*.47,-h/2+cap*.65),new T.Vector2(w/2,-h/2+cap),new T.Vector2(w*.48,h/2-cap),new T.Vector2(w*.43,h/2-cap*.5),new T.Vector2(w*.27,h/2-cap*.15),new T.Vector2(0,h/2)];
    const g=new T.LatheGeometry(points,10);g.scale(1,1,d/w);return g;
  }
  function torso(T,w,h,d){
    const points=[[.12,-.5],[.4,-.47],[.46,-.3],[.48,.04],[.5,.23],[.43,.42],[.29,.5],[0,.5]].map(([r,y])=>new T.Vector2(r*w,y*h));
    const g=new T.LatheGeometry(points,12);g.scale(1,1,d/w);return g;
  }
  function knightTorso(T,w,h,d){
    // Same ring and segment budget as the shared torso. A tapered waist,
    // sloped deltoids and fuller upper chest replace the short barrel shape.
    const points=[[.12,-.5],[.35,-.47],[.38,-.3],[.44,.04],[.5,.23],[.44,.42],[.27,.5],[0,.5]].map(([r,y])=>new T.Vector2(r*w,y*h));
    const g=new T.LatheGeometry(points,12);g.scale(1,1,d/w);g.userData.knightSculpt=true;return g;
  }
  function gripHand(T){
    // One connected gloved palm and curled finger surface, replacing the old
    // floating thumb rather than adding five separate finger draw calls.
    const g=new T.SphereGeometry(1,12,8),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),finger=Math.max(0,-x),groove=1-.055*finger*Math.sin((y+1)*Math.PI*3)**2;p.setXYZ(i,x*.077*groove+.046,y*.096-.03,z*.074*groove+.006);}
    g.computeVertexNormals();g.userData.closedGrip=true;return g;
  }
  function roundedBox(T,w,h,d){
    const b=Math.min(w,h,d)*.22,r=Math.min(w,h)*.22,s=new T.Shape(),x=w/2-b,y=h/2-b,q=Math.max(0,r-b);
    s.moveTo(-x+q,-y);s.lineTo(x-q,-y);s.quadraticCurveTo(x,-y,x,-y+q);s.lineTo(x,y-q);s.quadraticCurveTo(x,y,x-q,y);s.lineTo(-x+q,y);s.quadraticCurveTo(-x,y,-x,y-q);s.lineTo(-x,-y+q);s.quadraticCurveTo(-x,-y,-x+q,-y);s.closePath();
    const g=new T.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:3,steps:1});g.translate(0,0,-d/2+b);return g;
  }
  function cloth(T,width,height,depth=.1){
    const cols=8,rows=6,positions=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const u=x/cols*2-1,v=y/rows;positions.push(u*width/2*(.73+.27*v),-v*height+.025*Math.cos(u*Math.PI*3)*v*v,depth*(1-u*u)+.023*Math.cos(u*Math.PI*3)*v);}
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.userData.clothSurface=true;return g;
  }
  // A continuous scalp-to-nape surface. Crown and lower hair use the same seam
  // positions AND normals so a helmet can hide the crown without floating locks.
  function hair(T,{job='classic',sex='male',detail='hero'}={}){
    const female=sex==='female',long=female&&['mage','healer','archer'].includes(job),braided=female&&['classic','swordsman','scout','smith'].includes(job),low=detail==='npc',segments=low?18:28,rings=low?10:14,seam=rings/2,braidSegments=low?16:24,braidSides=low?5:7;
    const knight=job==='swordsman'&&!female,length=long?(job==='archer'?.83:job==='mage'?.73:.67):female?.3:job==='mage'?.33:.24,positions=[knight?-.018:0,knight?.321:.335,-.018],indices=[],braids=[];
    for(let row=1;row<=rings;row++)for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,v=row/rings,cap=Math.min(1,v/.5),drop=Math.max(0,(v-.5)/.5),front=Math.max(0,Math.min(1,(Math.cos(a)-.25)/.5)),back=1-front;
      const theta=cap*Math.PI/2,r=Math.sin(theta),wave=(long?.016:.004)*Math.sin(a*7+drop*3)*Math.sin(drop*Math.PI*.8),tip=long?1-.085*Math.sin(a*3)**2-.035*Math.cos(a*5):1;
      const x=(.289*r+wave*back)*(1+back*drop*(long?.07:-.06)-back*Math.max(0,drop-.75)*.15)*Math.sin(a);
      // A small lift along the low side of the part leaves the remodeled brow
      // visible without floating it away from the real facial surface.
      // The knight has an ear-above short cut, not the shared cheek-length
      // side locks. Only the rear nape is longer; the scalp seam stays intact.
      const trim=knight?.012+.063*Math.max(0,-Math.cos(a))**2:length*tip;
      const y=.335-.255*(1-Math.cos(theta))+drop*(front*(.018+Math.sin(a)*.025)-back*trim)+(knight?front*(.025*Math.sin(a-.35)+.030*Math.exp(-((Math.sin(a)+.36)**2/.07)))*Math.sin(theta):0);
      const z=(.267*r+wave)*Math.cos(a)-.018-back*drop*(long?.025:.004);
      positions.push(x,y,z);
    }
    for(let i=0;i<segments;i++)indices.push(0,1+i,1+(i+1)%segments);
    for(let row=0;row<rings-1;row++)for(let i=0;i<segments;i++){const a=1+row*segments+i,b=1+row*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
    const whole=new T.BufferGeometry();whole.setAttribute('position',new T.Float32BufferAttribute(positions,3));whole.setIndex(indices);whole.computeVertexNormals();
    function section(crown){const g=new T.BufferGeometry(),chosen=[];g.setAttribute('position',whole.attributes.position.clone());g.setAttribute('normal',whole.attributes.normal.clone());for(let i=0;i<indices.length;i+=3){const rows=indices.slice(i,i+3).map(n=>n===0?0:Math.floor((n-1)/segments)+1);if(crown?Math.max(...rows)<=seam:Math.max(...rows)>seam)chosen.push(...indices.slice(i,i+3));}g.setIndex(chosen);g.computeBoundingSphere();g.userData.continuousHair=true;return g;}
    const crown=section(true),drape=section(false);whole.dispose();
    if(braided){const sides=job==='smith'||job==='classic'?[-1,1]:[job==='scout'?-1:1];for(const side of sides){const points=Array.from({length:13},(_,i)=>{const t=i/12;return new T.Vector3(side*(.235+.065*Math.sin(t*Math.PI/2)),-.07-t*(job==='smith'?.53:.6),-.12+.16*t+.025*Math.sin(t*Math.PI*5));});
      const path=new T.CatmullRomCurve3(points),g=new T.TubeGeometry(path,braidSegments,.065,braidSides,false),p=g.attributes.position;
      // Sculpt the braid into one rope, not disconnected beads.
      for(let i=0;i<p.count;i++){const row=Math.floor(i/(braidSides+1)),t=Math.min(1,row/braidSegments),center=path.getPointAt(t),taper=1-.4*t,ripple=1+.07*Math.sin(t*Math.PI*12);p.setXYZ(i,center.x+(p.getX(i)-center.x)*taper*ripple,center.y+(p.getY(i)-center.y)*taper*ripple,center.z+(p.getZ(i)-center.z)*taper*ripple);}g.computeVertexNormals();g.userData.braidSide=side;braids.push({geometry:g,side});
    }}
    return {crown,drape,braids,long,braided};
  }
  return Object.freeze({ellipsoid,head,knightHead,catHead,catEye,catDetails,catTail,capsule,torso,knightTorso,gripHand,roundedBox,cloth,hair});
});
