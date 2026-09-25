/* 高塔機關：固定樓層配置、暫停友善的遊戲時間、低面數原創物件。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TowerHazards=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES=Object.freeze({
    spikes:{name:'伸縮地刺',color:0x9aaebb,damage:8,warning:'地刺要冒出來了，小心！',message:'哎呀，地刺冒出來了！'},
    vines:{name:'纏腳藤蔓',color:0x5f9152,damage:0,warning:'藤蔓醒來了，繞旁邊走！',message:'藤蔓拉住鞋子，走得慢吞吞！'},
    steam:{name:'蒸氣噴口',color:0xd1e7eb,damage:6,warning:'噴口在冒氣了，先等一下！',message:'呼，好燙的蒸氣！'},
    rubble:{name:'落石機關',color:0xb5a087,damage:12,warning:'碎石在晃動，快離開下面！',message:'轟！小心頭上的石頭！'},
  });
  function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  function layout({floor,seed,size,blocked=[],count,allKinds=false}){
    if(!Number.isInteger(floor)||floor<1||floor>95||!Number.isInteger(size)||size<5)return [];
    const random=rng(seed^Math.imul(floor,73129)),tier=Math.min(5,1+Math.floor((99-floor)/20));
    const pool=['spikes',...(allKinds||floor<=85?['vines']:[]),...(allKinds||floor<=65?['steam']:[]),...(allKinds||floor<=45?['rubble']:[])];
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
      const kind=pool[(result.length+offset)%pool.length];
      result.push({...cell,kind,tier,offset:random()*8,damage:TYPES[kind].damage+(TYPES[kind].damage?(tier-1)*2:0)});
    }
    return result;
  }
  function phase(trap,elapsed){
    const rest=6-(trap.tier-1)*.4,warning=1.8,active=trap.kind==='vines'?2.5:1.2,cycle=rest+warning+active;
    const t=((elapsed+trap.offset)%cycle+cycle)%cycle;
    return {state:t<rest?'idle':t<rest+warning?'warning':'active',progress:t<rest?0:t<rest+warning?(t-rest)/warning:(t-rest-warning)/active,cycle:Math.floor((elapsed+trap.offset)/cycle)};
  }
  function build(THREE,trap){
    const group=new THREE.Group(),moving=new THREE.Group();group.add(moving);
    const metal=new THREE.MeshLambertMaterial({color:0x465563});
    const material=new THREE.MeshLambertMaterial({color:TYPES[trap.kind].color,emissive:0x000000});
    const add=(parent,geometry,mat,x,y,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
    // 外框不是道具光圈；裸露齒槽、藤根、噴管與裂石本身就是辨識線索。
    if(trap.kind==='spikes'){
      moving.position.y=.14;
      add(group,new THREE.BoxGeometry(1.7,.12,1.3),metal,0,.08,0);
      for(const x of [-.55,0,.55])for(const z of [-.35,.35])add(moving,new THREE.ConeGeometry(.14,.9,5),material,x,.45,z);
    }else if(trap.kind==='vines'){
      for(let i=0;i<4;i++){const vine=add(moving,new THREE.TorusGeometry(.32+i*.11,.075,4,10,Math.PI*1.6),material,(i%2-.5)*.45,.13,(Math.floor(i/2)-.5)*.45);vine.rotation.set(Math.PI/2,0,i*1.4);}
      add(group,new THREE.DodecahedronGeometry(.3,0),metal,-.55,.17,.5);
    }else if(trap.kind==='steam'){
      add(group,new THREE.CylinderGeometry(.62,.7,.16,10),metal,0,.1,0);
      for(const x of [-.3,0,.3])add(group,new THREE.CylinderGeometry(.08,.08,.23,6),material,x,.23,0);
      material.transparent=true;material.opacity=.6;
      for(let i=0;i<3;i++)add(moving,new THREE.ConeGeometry(.35+i*.13,.85,7),material,(i-1)*.28,.6+i*.42,0);
    }else{
      for(const x of [-.45,0,.45]){const crack=add(group,new THREE.BoxGeometry(.055,.03,1.55),metal,x,.04,0);crack.rotation.y=x*2;}
      for(let i=0;i<3;i++)add(moving,new THREE.DodecahedronGeometry(.27+i*.07,0),material,(i-1)*.43,.3+i*.12,(i%2)*.35-.17);
    }
    group.userData={moving,material,kind:trap.kind};return group;
  }
  function animate(model,phase,elapsed){
    const {moving,material,kind}=model.userData,warning=phase.state==='warning',active=phase.state==='active';
    material.emissive.setHex(warning?0x996322:active?0x733329:0x000000);
    if(kind==='spikes')moving.scale.y=active?1:warning?.18+phase.progress*.12:.08;
    if(kind==='vines'){moving.rotation.y=warning||active?Math.sin(elapsed*3)*.12:0;moving.scale.y=active?2:1;}
    if(kind==='steam'){moving.visible=warning||active;moving.scale.setScalar(active?1:.2+phase.progress*.25);}
    if(kind==='rubble'){moving.position.y=active?Math.max(0,1.8-phase.progress*8):warning?1.8:.05;moving.rotation.z=warning?Math.sin(elapsed*20)*.12:0;}
  }
  return Object.freeze({TYPES,layout,phase,build,animate});
});
