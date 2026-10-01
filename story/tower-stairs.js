/* A recessed down-stair, not a floating exit badge or portal. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerStairs=api;})(globalThis,function(){
  function floor(T,size,p){const s=new T.Shape();s.moveTo(-size/2,-size/2);s.lineTo(size/2,-size/2);s.lineTo(size/2,size/2);s.lineTo(-size/2,size/2);s.closePath();const hole=new T.Path(),x=p.x,y=-p.z;hole.moveTo(x-.86,y-1.21);hole.lineTo(x-.86,y+1.21);hole.lineTo(x+.86,y+1.21);hole.lineTo(x+.86,y-1.21);hole.closePath();s.holes.push(hole);const geo=new T.ShapeGeometry(s),uv=geo.attributes.uv,pos=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+size/2)/size,(pos.getY(i)+size/2)/size);return geo;}
  function build(T){const g=new T.Group();g.name='tower-down-stairs';g.userData.stairs=true;const stone=new T.MeshLambertMaterial({color:0x6d7c89}),trim=new T.MeshLambertMaterial({color:0xb7bcaa}),dark=new T.MeshBasicMaterial({color:0x09121b});const box=(w,h,d,mat,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
    for(let i=0;i<7;i++){box(1.66,.16,.345,stone,0,-.08-i*.24,-1.035+i*.345);box(1.66,.025,.055,trim,0,-i*.24,-1.19+i*.345);}
    box(1.68,.025,2.4,dark,0,-1.85,0);for(const side of [-1,1]){box(.12,.13,2.65,trim,side*.95,.09,0);box(.14,1.9,2.4,stone,side*.87,-.88,0);for(const z of [-1.1,.9])box(.065,.62,.065,trim,side*.96,.35,z);box(.07,.07,2.14,trim,side*.96,.64,-.1);}
    return g;
  }return Object.freeze({floor,build});
});
