/* Original low-poly sculpted silhouettes. Geometry is owned by each model, not
   globally cached across scenes: disposing one character cannot break another. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CharacterSculpt=api;})(globalThis,function(){
  'use strict';
  function ellipsoid(T,w,h,d){const g=new T.SphereGeometry(1,12,8);g.scale(w/2,h/2,d/2);return g;}
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
  function capsule(T,w,h,d){
    const cap=Math.min(h*.28,w*.48),points=[new T.Vector2(0,-h/2),new T.Vector2(w*.31,-h/2+cap*.2),new T.Vector2(w*.47,-h/2+cap*.65),new T.Vector2(w/2,-h/2+cap),new T.Vector2(w*.48,h/2-cap),new T.Vector2(w*.43,h/2-cap*.5),new T.Vector2(w*.27,h/2-cap*.15),new T.Vector2(0,h/2)];
    const g=new T.LatheGeometry(points,10);g.scale(1,1,d/w);return g;
  }
  function torso(T,w,h,d){
    const points=[[.12,-.5],[.4,-.47],[.46,-.3],[.48,.04],[.5,.23],[.43,.42],[.29,.5],[0,.5]].map(([r,y])=>new T.Vector2(r*w,y*h));
    const g=new T.LatheGeometry(points,12);g.scale(1,1,d/w);return g;
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
    const length=long?(job==='archer'?.83:job==='mage'?.73:.67):female?.3:job==='mage'?.33:.24,positions=[0,.335,-.018],indices=[],braids=[];
    for(let row=1;row<=rings;row++)for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,v=row/rings,cap=Math.min(1,v/.5),drop=Math.max(0,(v-.5)/.5),front=Math.max(0,Math.min(1,(Math.cos(a)-.25)/.5)),back=1-front;
      const theta=cap*Math.PI/2,r=Math.sin(theta),wave=(long?.016:.004)*Math.sin(a*7+drop*3)*Math.sin(drop*Math.PI*.8),tip=long?1-.085*Math.sin(a*3)**2-.035*Math.cos(a*5):1;
      const x=(.289*r+wave*back)*(1+back*drop*(long?.07:-.06)-back*Math.max(0,drop-.75)*.15)*Math.sin(a);
      const y=.335-.255*(1-Math.cos(theta))+drop*(front*(.018+Math.sin(a)*.025)-back*length*tip);
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
  return Object.freeze({ellipsoid,head,capsule,torso,roundedBox,cloth,hair});
});
