/* Original low-poly sculpted silhouettes. Geometry is owned by each model, not
   globally cached across scenes: disposing one character cannot break another. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CharacterSculpt=api;})(globalThis,function(){
  'use strict';
  function ellipsoid(T,w,h,d){const g=new T.SphereGeometry(1,12,8);g.scale(w/2,h/2,d/2);return g;}
  function head(T,w=.54,h=.55,d=.48,{jaw=1,cheek=1,chin=1}={}){
    const g=new T.SphereGeometry(1,18,12),p=g.attributes.position;
    for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const lower=Math.max(0,-y),front=Math.max(0,z),eye=Math.exp(-((Math.abs(x)-.48)**2/.055+(y-.1)**2/.04));
      x*=1+(jaw-1)*lower*.7;y+=.035*(chin-1)*lower;z+=front*(.065*cheek*Math.exp(-((Math.abs(x)-.56)**2/.07+(y+.2)**2/.09))-.05*eye+.035*chin*Math.exp(-(x*x/.12+(y+.65)**2/.08)));p.setXYZ(i,x*w/2,y*h/2,z*d/2);
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
  return Object.freeze({ellipsoid,head,capsule,torso,roundedBox});
});
