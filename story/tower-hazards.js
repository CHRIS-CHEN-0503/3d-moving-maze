/* 高塔機關：近身觸發、可觀察線索與公平預警；共用既有遊戲迴圈。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TowerHazards=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Base movement is 5.2 m/s: a full-speed blind crossing still meets the burst,
  // while reacting to the tell and stepping back remains possible.
  const WARNING_SECONDS=.65;
  const TYPES=Object.freeze({
    spikes:{name:'伸縮地刺',color:0x92938a,damage:8,sound:'metal',warningSound:'device',warning:'石板喀了一聲，快退開！',message:'哎呀，石縫裡竄出了地刺！'},
    vines:{name:'纏腳藤蔓',color:0x65704e,damage:0,sound:'thorns',warningSound:'device',warning:'腳邊的細根動了，快離開！',message:'藤蔓抓住鞋子，走得慢吞吞！'},
    steam:{name:'蒸氣噴口',color:0xbbcbc8,damage:6,sound:'smoke',warningSound:'smoke',warning:'石縫開始嘶嘶冒氣，先退開！',message:'呼，好燙的蒸氣！'},
    rubble:{name:'落石機關',color:0xa59680,damage:12,sound:'burst',warningSound:'device',warning:'頭頂落下了灰塵，快離開！',message:'轟！石塊擦身落下！'},
    wall_bolts:{name:'暗孔連弩',color:0xa3987d,damage:10,wall:true,sound:'bow',warningSound:'device',warning:'牆孔傳來上弦聲，快退開這條走道！',message:'咻！牆裡射出了暗箭！'},
    wall_steam:{name:'壁面蒸汽閥',color:0xbbcbc8,damage:8,wall:true,sound:'smoke',warningSound:'smoke',warning:'牆縫正在漏氣，別站在噴口前！',message:'呼！蒸汽橫掃了走道！'},
  });
  function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  function wallsAt(cx,cy,size,hWalls,vWalls){
    // The game stores horizontal walls below each cell, vertical walls to its right.
    if(!Array.isArray(hWalls)||!Array.isArray(vWalls))return [];
    return [cy===0||!!hWalls[cy-1]?.[cx],cx===size-1||!!vWalls[cy]?.[cx],cy===size-1||!!hWalls[cy]?.[cx],cx===0||!!vWalls[cy]?.[cx-1]];
  }
  function supported(trap,size,hWalls,vWalls){return !TYPES[trap.kind]?.wall||!!wallsAt(trap.cx,trap.cy,size,hWalls,vWalls)[trap.wallSide];}
  function layout({floor,seed,size,blocked=[],count,allKinds=false,hWalls,vWalls}){
    if(!Number.isInteger(floor)||!(floor>=1&&floor<=95||floor>=-50&&floor<=-1)||!Number.isInteger(size)||size<5||size>21)return [];
    const random=rng(seed^Math.imul(floor,73129)),tier=Math.min(5,1+Math.floor((99-floor)/20)),hasWalls=Array.isArray(hWalls)&&Array.isArray(vWalls);
    const pool=['spikes',...(allKinds||floor<=85?['vines']:[]),...(allKinds||floor<=65?['steam']:[]),...(allKinds||floor<=45?['rubble']:[]),...(hasWalls&&(allKinds||floor<=90)?['wall_bolts']:[]),...(hasWalls&&(allKinds||floor<=70)?['wall_steam']:[])];
    const occupied=blocked.map(key=>key.split(',').map(Number)),candidates=[];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      if(x+y<4||(size-1-x)+(size-1-y)<3)continue;
      if(occupied.some(([bx,by])=>Math.abs(x-bx)+Math.abs(y-by)<=1))continue;
      candidates.push({cx:x,cy:y});
    }
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    const limit=Math.min(8,count??Math.max(1,Math.floor(size*size/45))),result=[],offset=Math.floor(random()*pool.length);
    for(const cell of candidates){
      if(result.length>=limit)break;
      if(result.some(t=>Math.abs(t.cx-cell.cx)+Math.abs(t.cy-cell.cy)<2))continue;
      const roll=random(),sides=wallsAt(cell.cx,cell.cy,size,hWalls,vWalls).flatMap((wall,i)=>wall?[i]:[]);
      let kind=pool[(result.length+offset)%pool.length];
      if(TYPES[kind].wall&&!sides.length)kind=kind==='wall_bolts'?'spikes':'steam';
      const wallSide=TYPES[kind].wall?sides[Math.floor(roll*sides.length)]:null;
      result.push({...cell,kind,tier,wallSide,offset:roll*8,damage:TYPES[kind].damage+(TYPES[kind].damage?(tier-1)*2:0)});
    }
    return result;
  }
  function place(trap,point,cell=4,clear=()=>true,wallThickness=.7){
    const placed={...trap,...point,cell,yaw:TYPES[trap.kind].wall?[0,-Math.PI/2,Math.PI,Math.PI/2][trap.wallSide]:0};
    placed.mouth=-cell/2+wallThickness/2+.14;placed.reach=cell*1.85;
    const sx=placed.x+Math.sin(placed.yaw)*placed.mouth,sz=placed.z+Math.cos(placed.yaw)*placed.mouth;
    placed.source={x:sx,z:sz};
    if(TYPES[trap.kind].wall){
      // Clip the whole effect before the next wall; no beam mesh through a corner.
      let reach=0;
      for(let d=.2;d<=placed.reach;d+=.2){if(!clear(sx,sz,sx+Math.sin(placed.yaw)*d,sz+Math.cos(placed.yaw)*d))break;reach=d;}
      placed.reach=reach;
    }
    return placed;
  }
  function contains(trap,point,clear=()=>true,margin=0){
    const dx=point.x-trap.x,dz=point.z-trap.z,cell=trap.cell||4;
    if(TYPES[trap.kind].wall){
      const yaw=trap.yaw||0,lateral=dx*Math.cos(yaw)-dz*Math.sin(yaw),forward=dx*Math.sin(yaw)+dz*Math.cos(yaw),mouth=trap.mouth??-cell/2+.34;
      return Math.abs(lateral)<=cell*.455+margin&&forward>=mouth-margin&&forward<=mouth+(trap.reach??cell*1.85)+margin&&clear(trap.source.x,trap.source.z,point.x,point.z);
    }
    const inArea=trap.kind==='spikes'?Math.abs(dx)<=cell*.455+margin&&Math.abs(dz)<=1.85+margin:Math.hypot(dx,dz)<=1.85+margin;
    return inArea&&clear(trap.x,trap.z,point.x,point.z);
  }
  function phase(trap){
    const t=trap.trigger;
    return t?{state:t.state,progress:t.total?Math.max(0,Math.min(1,1-t.left/t.total)):0,cycle:t.cycle}:{state:'idle',progress:0,cycle:0};
  }
  function step(trap,dt,{inside=false,armed=true,paused=false}={}){
    if(paused||!Number.isFinite(dt)||dt<=0)return phase(trap);
    if(!armed||trap.heroRemoved){trap.trigger=null;return phase(trap);}
    const t=trap.trigger||(trap.trigger={state:'idle',left:0,total:0,cycle:0});
    const enter=(state,seconds)=>{t.state=state;t.left=t.total=seconds;};
    if(t.state==='idle'){if(inside){t.cycle=trap.cycleSerial=(trap.cycleSerial||0)+1;enter('warning',WARNING_SECONDS);}return phase(trap);}
    // At most one transition per frame, and no hidden tab/long frame can skip warning.
    t.left=Math.max(0,t.left-Math.min(.25,dt));
    if(t.left<=1e-8){
      if(t.state==='warning')enter('active',trap.kind==='vines'?2.1:trap.kind==='wall_bolts'?.65:1.25);
      else if(t.state==='active')enter('cooldown',Math.max(3.4,5.4-(trap.tier-1)*.4));
      else enter('idle',0);
    }
    return phase(trap);
  }
  function detection(trap,observers,{clear=()=>true,visible=()=>true}={}){
    if(!visible(trap.x,trap.z))return false;
    return observers.some(o=>{
      if(!o||o.alive===false)return false;
      const range=o.reveal>0?Math.min(16,o.reveal*(trap.cell||4)):o.scout?6:0;
      return range>0&&Math.hypot(o.x-trap.x,o.z-trap.z)<=range&&clear(o.x,o.z,trap.x,trap.z);
    });
  }
  function build(THREE,trap){
    const group=new THREE.Group(),moving=new THREE.Group(),clues=new THREE.Group(),mark=new THREE.Group();group.add(moving,clues,mark);group.rotation.y=trap.yaw||0;
    const stone=new THREE.MeshLambertMaterial({color:0x746f61}),dark=new THREE.MeshLambertMaterial({color:0x464a40});
    const material=new THREE.MeshLambertMaterial({color:TYPES[trap.kind].color,emissive:0x000000}),warningMat=new THREE.MeshBasicMaterial({color:0xe8c47a,transparent:true,opacity:.75,depthWrite:false});
    const add=(parent,geometry,mat,x,y,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
    // Idle tells are small seams, dusty roots, or wall holes—not luminous pickup rings.
    if(TYPES[trap.kind].wall){
      const mouth=trap.mouth??-1.66;
      add(clues,new THREE.BoxGeometry(2.65,.65,.065),stone,0,1.02,mouth-.12);
      for(const x of [-.94,0,.94])add(clues,new THREE.BoxGeometry(.14,.13,.035),dark,x,1.04,mouth-.078);
      if(trap.kind==='wall_bolts'){
        for(const x of [-1.35,-.45,.45,1.35]){
          const bolt=add(moving,new THREE.CylinderGeometry(.035,.035,.65,5),material,x,1.02,0);bolt.rotation.x=Math.PI/2;
          const tip=add(moving,new THREE.ConeGeometry(.09,.2,4),material,x,1.02,.42);tip.rotation.x=Math.PI/2;
        }
      }else{
        material.transparent=true;material.opacity=.46;material.depthWrite=false;
        for(let i=0;i<4;i++)add(moving,new THREE.SphereGeometry(1,7,5),material,0,1.03,mouth+(i+.5)*(trap.reach||3)/4).scale.set(1.64,.48,(trap.reach||3)/4*.49);
      }
      for(const x of [-1.38,1.38])add(mark,new THREE.BoxGeometry(.08,.88,.045),warningMat,x,1.02,mouth+.02);
    }else{
      if(trap.kind==='spikes'){
        for(const z of [-.52,.52])add(clues,new THREE.BoxGeometry(3.5,.012,.035),dark,0,.024,z);
        for(const x of [-1.3,0,1.3])for(const z of [-.52,.52])add(moving,new THREE.ConeGeometry(.12,.86,5),material,x,.43,z);
      }else if(trap.kind==='vines'){
        for(let i=0;i<4;i++){const vine=add(moving,new THREE.TorusGeometry(.5+i*.17,.035,4,10,Math.PI*1.6),material,(i%2-.5)*.3,.045,(Math.floor(i/2)-.5)*.3);vine.rotation.set(Math.PI/2,0,i*1.4);}
        add(clues,new THREE.DodecahedronGeometry(.12,0),stone,-.55,.07,.5);
      }else if(trap.kind==='steam'){
        for(const x of [-.28,0,.28])add(clues,new THREE.BoxGeometry(.03,.015,.42),dark,x,.027,0);
        material.transparent=true;material.opacity=.45;material.depthWrite=false;
        for(let i=0;i<3;i++)add(moving,new THREE.SphereGeometry(.4+i*.12,7,5),material,(i-1)*.28,.6+i*.42,0);
      }else{
        for(const x of [-.25,.25]){const crack=add(clues,new THREE.BoxGeometry(.024,.01,.72),dark,x,.024,0);crack.rotation.y=x*2;}
        for(let i=0;i<3;i++)add(moving,new THREE.DodecahedronGeometry(.3+i*.08,0),material,(i-1)*.65,.3+i*.12,(i%2)*.35-.17);
      }
      for(const x of [-1.65,1.65])add(mark,new THREE.BoxGeometry(.06,.016,1.1),warningMat,x,.035,0);
    }
    mark.visible=false;group.userData={moving,material,clues,mark,kind:trap.kind,trap};animate(group,phase(trap),0);return group;
  }
  function animate(model,p,elapsed,revealed=false){
    const {moving,material,kind,mark,clues,trap}=model.userData,warning=p.state==='warning',active=p.state==='active';
    mark.visible=revealed||warning;material.emissive.setHex(warning?0x574320:0x000000);
    clues.position.y=warning?Math.sin(elapsed*27)*.012:0;
    if(kind==='spikes'){moving.scale.y=active?1:warning?.025+p.progress*.07:.004;moving.position.y=.018;}
    if(kind==='vines'){moving.rotation.y=warning||active?Math.sin(elapsed*3)*.12:0;moving.scale.setScalar(active?1.65:warning?1.05:1);moving.scale.y=active?3:1;}
    if(kind==='steam'){moving.visible=warning||active;moving.scale.setScalar(active?1.8:.13+p.progress*.22);}
    if(kind==='rubble'){moving.visible=warning||active;moving.position.y=active?Math.max(0,2.1-p.progress*7):2.1;moving.scale.setScalar(warning?.15:1);moving.rotation.z=warning?Math.sin(elapsed*20)*.12:0;}
    if(kind==='wall_bolts'){moving.visible=active;moving.position.z=(trap.mouth??-1.66)+Math.max(0,(trap.reach||3)-.5)*p.progress;}
    if(kind==='wall_steam'){moving.visible=warning||active;moving.scale.y=active?1:.08+p.progress*.08;material.opacity=active?.42+Math.sin(elapsed*17)*.06:.15;}
  }
  return Object.freeze({TYPES,WARNING_SECONDS,wallsAt,supported,layout,place,contains,phase,step,detection,build,animate});
});
