/* Seeded, non-reward landscape islands. Only open passages before wall meshes exist. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerLandmarks=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  function hash(seed,value){let h=seed>>>0;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  const key=p=>p.x+','+p.y;
  const NAMES=Object.freeze({tree:'固定古樹區',pool:'固定水池區',crystal:'固定晶簇區',machine:'固定機組區',hearth:'固定爐石區',waystone:'固定路石區'});
  function svg(kind){
    const shape={tree:'<path fill="#8f6646" d="M27 25h10v33H27z"/><path fill="#638a59" d="M9 34C-2 16 25 6 32 12c13-10 34 11 22 24z"/><path fill="#a9b876" d="M23 16c-8 0-15 8-13 13 7-7 10-4 13-13z"/>',pool:'<ellipse fill="#527e8b" cx="32" cy="35" rx="27" ry="16"/><ellipse fill="#89c6cc" cx="32" cy="31" rx="22" ry="11"/><ellipse fill="#6d9b67" cx="23" cy="31" rx="7" ry="4"/><path stroke="#d5f1f0" d="M34 27h10M36 35h10"/>',crystal:'<path fill="#94cbde" d="m30 6 12 21-8 31H22l-8-31z"/><path fill="#e0f5f6" d="m30 6-8 21 0 31h12l-4-31z"/><path fill="#7398c3" d="m47 28 10 13-5 15H39l-3-15z"/>',machine:'<path fill="#71818a" d="M8 26h48v29H8z"/><path fill="#c3a878" d="m13 8 14 0 4 6 0 16-4 6H13l-4-6V14z"/><circle fill="#526a72" cx="20" cy="22" r="7"/><circle fill="#d2b77a" cx="44" cy="38" r="10"/><circle fill="#687b88" cx="44" cy="38" r="4"/>',hearth:'<path fill="#9a8873" d="M8 46 16 30h32l8 16-7 12H15z"/><path fill="#eda770" d="M32 7c5 10 14 13 11 23-1 7-20 7-22 0-2-7 7-13 11-23z"/><path fill="#ffe3a5" d="m32 21 4 10-8 0z"/>',waystone:'<path fill="#899a94" d="m23 8 21 2 9 36-6 12H16l-5-12z"/><path stroke="#d3c69e" d="m21 26 20-6m-20 6 11 9-3 14"/>'}[kind];
    return shape?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" role="img" aria-label="'+NAMES[kind]+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+shape+'</svg>':'';
  }
  function plan(run,size){
    if(!run||!run.party||run.expedition?.active||!C().isFloor(run.floor))return null;
    const config=C().floorConfig(run.floor,run.seed),n=size||config.size;if(!Number.isInteger(n)||n<7)return null;
    const x=2+hash(run.seed,'landmark:x:'+run.floor)%(n-5),y=2+hash(run.seed,'landmark:y:'+run.floor)%(n-5);
    const environment=config.environmentId,kind=['garden','roots'].includes(environment)?'tree':environment==='mist'?'pool':['echo','frost'].includes(environment)?'crystal':environment==='clockwork'?'machine':environment==='furnace'?'hearth':'waystone';
    return {id:'landmark:'+run.floor+':'+run.seed,floor:run.floor,kind,x,y,width:3,height:3,center:{x:x+1,y:y+1},cells:Array.from({length:9},(_,i)=>({x:x+i%3,y:y+Math.floor(i/3)}))};
  }
  function prepareMaze(run,maze,start){
    const p=plan(run,maze?.width);if(!p)return maze;
    if(maze.height!==maze.width||maze.hWalls?.length!==maze.height-1||maze.vWalls?.length!==maze.height||maze.hWalls.some(row=>row.length!==maze.width)||maze.vWalls.some(row=>row.length!==maze.width-1))throw new RangeError('固定景觀的牆陣尺寸不符。');
    // Removing walls cannot disconnect a generated maze or strand the current player.
    // Both internal corridors and the scenery's coordinates remain identical on shifts.
    for(let y=p.y;y<p.y+3;y++)for(let x=p.x;x<p.x+2;x++)maze.vWalls[y][x]=false;
    for(let y=p.y;y<p.y+2;y++)for(let x=p.x;x<p.x+3;x++)maze.hWalls[y][x]=false;
    return maze;
  }
  function build(T,p,cell){
    const group=new T.Group();group.name='fixed-landmark-'+p.kind;
    const mats=new Map(),mat=(color,extra={})=>{const id=color+JSON.stringify(extra);if(!mats.has(id))mats.set(id,new T.MeshLambertMaterial({color,...extra}));return mats.get(id);};
    const add=(geo,color,x,y,z,extra)=>{const mesh=new T.Mesh(geo,mat(color,extra));mesh.position.set(x,y,z);group.add(mesh);return mesh;};
    const area=cell*1.12;
    if(p.kind==='pool'){
      add(new T.CylinderGeometry(area,area,.08,16),0x437f86,0,.02,0,{transparent:true,opacity:.78});
      for(let i=0;i<8;i++){const a=i*Math.PI/4;add(new T.SphereGeometry(.34,6,4),0x8d9a8c,Math.sin(a)*area,.12,Math.cos(a)*area).scale.y=.55;}
      for(let i=0;i<3;i++){const leaf=add(new T.CylinderGeometry(.3,.3,.025,8),0x6d995f,(i-1)*.55,.08,.35);leaf.rotation.y=i;}
    }else if(p.kind==='tree'){
      // Trunk is off the cell centres, so the existing centre-to-centre paths stay clear.
      add(new T.CylinderGeometry(.3,.48,2.8,8),0x79593e,cell*.43,1.4,cell*.43);
      for(let i=0;i<3;i++){const crown=add(new T.SphereGeometry(1,10,7),i===1?0x61864c:0x497449,(i-1)*.65+cell*.43,3.1+(i%2)*.4,cell*.43);crown.scale.set(1.1,.8,1.05);}
      for(let i=0;i<4;i++){const a=i*Math.PI/2;const root=add(new T.CylinderGeometry(.08,.22,1.1,5),0x79593e,cell*.43+Math.sin(a)*.4,.2,cell*.43+Math.cos(a)*.4);root.rotation.z=Math.PI/2;root.rotation.y=a;}
    }else if(p.kind==='crystal'){
      for(let i=0;i<4;i++){const o=add(new T.OctahedronGeometry(.55,0),0x91c8d6,(i%2-.5)*.85,.65+(i%2)*.25,(Math.floor(i/2)-.5)*.85);o.scale.y=1.7;}
    }else if(p.kind==='machine'){
      add(new T.CylinderGeometry(.85,.95,.22,12),0x6b7070,0,.11,0);
      for(let i=0;i<3;i++){const wheel=add(new T.TorusGeometry(.38,.1,5,12),0xc6ac76,(i-1)*.6,.64,0);wheel.rotation.x=Math.PI/2;}
      add(new T.BoxGeometry(1.7,.5,.55),0x657986,0,.4,-.3);
    }else{
      add(new T.CylinderGeometry(.6,.85,.4,7),0x7f8179,0,.2,0);
      const stone=add(new T.OctahedronGeometry(.55,0),p.kind==='hearth'?0xd99965:0xb5b3a0,0,.9,0);stone.scale.y=1.6;
    }
    group.userData.landmarkId=p.id;return group;
  }
  return Object.freeze({NAMES,svg,plan,prepareMaze,build,key});
});
