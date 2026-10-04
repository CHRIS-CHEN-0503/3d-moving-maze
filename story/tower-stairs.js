/* A recessed down-stair, not a floating exit badge or portal. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerStairs=api;})(globalThis,function(){
  const REVEAL_SECONDS=1.2;
  function floor(T,size,p){const s=new T.Shape();s.moveTo(-size/2,-size/2);s.lineTo(size/2,-size/2);s.lineTo(size/2,size/2);s.lineTo(-size/2,size/2);s.closePath();const hole=new T.Path(),x=p.x,y=-p.z;hole.moveTo(x-.86,y-1.21);hole.lineTo(x-.86,y+1.21);hole.lineTo(x+.86,y+1.21);hole.lineTo(x+.86,y-1.21);hole.closePath();s.holes.push(hole);const geo=new T.ShapeGeometry(s),uv=geo.attributes.uv,pos=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+size/2)/size,(pos.getY(i)+size/2)/size);return geo;}
  function build(T){const g=new T.Group();g.name='tower-down-stairs';g.userData.stairs=true;const stone=new T.MeshLambertMaterial({color:0x6d7c89}),trim=new T.MeshLambertMaterial({color:0xb7bcaa}),dark=new T.MeshBasicMaterial({color:0x09121b});const box=(w,h,d,mat,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
    for(let i=0;i<7;i++){const step=box(1.66,.16,.345,stone,0,-.08-i*.24,-1.035+i*.345),edge=box(1.66,.025,.055,trim,0,-i*.24,-1.19+i*.345);step.userData.stairStep=i;edge.userData.stairStep=i;}
    box(1.68,.025,2.4,dark,0,-1.85,0);for(const side of [-1,1]){box(.12,.13,2.65,trim,side*.95,.09,0);box(.14,1.9,2.4,stone,side*.87,-.88,0);for(const z of [-1.1,.9])box(.065,.62,.065,trim,side*.96,.35,z);box(.07,.07,2.14,trim,side*.96,.64,-.1);}
    return g;
  }
  /* Render-only: the owning mode supplies its authoritative completion result.
     The floor aperture cover belongs beside this model, not below a hidden root.
     Reuse the game's existing frame clock; never schedule an independent loop. */
  function createReveal(model,{reduced=false}={}){
    if(!model||!Array.isArray(model.children))throw new TypeError('A stair model is required');
    const records=model.children.map(node=>({node,step:Number.isInteger(node.userData?.stairStep)?node.userData.stairStep:null,y:node.position.y,scale:node.scale.clone(),visible:node.visible}));
    let unlocked=false,elapsed=0,revealing=false,disposed=false;
    const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
    function restore(){for(const r of records){r.node.position.y=r.y;r.node.scale.copy(r.scale);r.node.visible=r.visible;}}
    function paint(){
      const p=unlocked?Math.min(1,elapsed/REVEAL_SECONDS):0;
      model.userData.stairUnlocked=unlocked;model.userData.stairRevealProgress=p;
      model.visible=unlocked;
      if(!unlocked||!revealing){restore();return;}
      for(const r of records){
        // A low-cost emergence: seven separate stone treads settle in sequence.
        // Details share their existing materials, so opacity is never mutated.
        const start=r.step===null?.18:r.step*.075;
        const local=smooth((p-start)/(r.step===null?.72:.5));
        r.node.visible=r.visible&&local>0;
        r.node.position.y=r.y-(1-local)*(r.step===null?.3:.42);
        r.node.scale.copy(r.scale);r.node.scale.y=r.scale.y*(.08+.92*local);
      }
    }
    function setUnlocked(value,{immediate=false}={}){
      if(disposed)return false;
      const next=value===true;
      if(next===unlocked){if(next&&immediate){elapsed=REVEAL_SECONDS;revealing=false;paint();}return false;}
      unlocked=next;elapsed=next&&(immediate||reduced)?REVEAL_SECONDS:0;
      revealing=next&&elapsed<REVEAL_SECONDS;paint();return true;
    }
    function frame(dt){
      if(disposed||!revealing)return false;
      if(!Number.isFinite(dt)||dt<=0)return false;
      elapsed=Math.min(REVEAL_SECONDS,elapsed+Math.min(dt,.25));
      if(elapsed>=REVEAL_SECONDS)revealing=false;
      paint();return revealing;
    }
    function dispose(){if(disposed)return;revealing=false;elapsed=unlocked?REVEAL_SECONDS:0;paint();disposed=true;}
    paint();
    return Object.freeze({setUnlocked,frame,dispose,get unlocked(){return unlocked;},get revealing(){return revealing;},get progress(){return unlocked?Math.min(1,elapsed/REVEAL_SECONDS):0;}});
  }
  return Object.freeze({floor,build,createReveal,REVEAL_SECONDS});
});
