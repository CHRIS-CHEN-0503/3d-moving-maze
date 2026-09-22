/* One shared, finite-stock flash sale per maze layout. Host owns schedule and pickup. */
(function(){
  'use strict';
  let enabled=false,epoch=0,due=Infinity,offered=false,state=null,root=null,wares=[],sign=null,clerk=null,ends=0,rev=-1,acc=0,pulse=0,seed=1;
  const applied=new Set(),pickupAt=new Map();
  const now=()=>performance.now(),duration=size=>size<=11?15000:size<=15?20000:25000;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function clearVisual(){if(root){root.parent?.remove(root);disposeSceneObject(root);}root=null;wares=[];sign=null;clerk=null;$('shopSaleHud').hidden=true;}
  function stop(){clearVisual();enabled=false;state=null;applied.clear();pickupAt.clear();due=Infinity;rev=-1;}
  function reset(){
    stop();if(!isShop()||!MP.started||MP.ended)return;enabled=true;epoch=MP.round||0;offered=false;acc=0;pulse=0;
    seed=(MP.seed^0x5a1e^Math.imul(epoch+1,2654435761))>>>0;
    // First event is unpredictable but early enough to reach in a short round.
    due=now()+8000+Math.floor(random()*12000);
  }
  function location(){
    const cells=[];
    for(let y=0;y<G.mazeH;y++)for(let x=0;x<G.mazeW;x++){
      const p=cellToWorld(x,y);
      if(playerInWall(p.x,p.z,1.45)||window.ShopChaos?.reserved(p.x,p.z))continue;
      if((G.registers||[]).some(r=>Math.hypot(r.x-p.x,r.z-p.z)<G.cell*1.5))continue;
      if((G.goods||[]).some(g=>g&&Math.hypot(g.x-p.x,g.z-p.z)<G.cell))continue;
      if(MP.roster.some(r=>{const q=botPosOf(r.id);return q&&Math.hypot(q.x-p.x,q.z-p.z)<G.cell*1.5;}))continue;
      cells.push({cx:x,cy:y,...p});
    }
    return cells[Math.floor(random()*cells.length)];
  }
  function build(){
    clearVisual();root=new THREE.Group();root.name='flash-sale';root.position.set(state.x,0,state.z);scene.add(root);
    const box=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);root.add(m);return m;};
    box(2.6,.78,1.1,0,.4,0,0xa72735);box(2.8,.12,1.3,0,.85,0,0xffd579);
    for(const x of [-1.25,1.25])box(.09,2.8,.09,x,1.4,-.45,0xffd579);
    for(let i=0;i<7;i++)box(.43,.16,2.2,(i-3)*.43,2.82,-.2,i%2?0xffdc83:0xd43b41);
    // Keep signs below the supermarket's 3.2 m ceiling, in front of the canopy.
    const title=makeTextSprite('限時大拍賣');title.position.set(0,2.6,1.1);title.scale.set(3.6,.6,1);root.add(title);
    sign=makeTextSprite(GOODS[state.gi].name+' · 六件限定');sign.position.set(0,2.07,.8);sign.scale.set(3.1,.52,1);root.add(sign);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.6,.07,6,24),new THREE.MeshBasicMaterial({color:0xffcb55}));ring.rotation.x=-Math.PI/2;ring.position.y=.08;root.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.22,.4,3.1,8,1,true),new THREE.MeshBasicMaterial({color:0xffb641,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));beam.position.set(0,1.55,-.7);root.add(beam);
    // Original game character, red apron and cap: one small clerk, no lights or image downloads.
    clerk=buildCharacter(CHARS[0]);clerk.scale.setScalar(.85);clerk.position.set(0,0,-.95);root.add(clerk);
    const apron=box(.46,.56,.08,0,.77,-.68,0xd43b41);apron.name='sale-apron';box(.55,.12,.5,0,1.56,-.95,0xd43b41);
    for(let i=0;i<6;i++){const s=makeEmojiSprite(GOODS[state.gi].emoji,.66);s.position.set((i%3-1)*.86,1.24+Math.floor(i/3)*.32,.43-Math.floor(i/3)*.58);s.userData.saleSlot=i;root.add(s);wares.push(s);}
  }
  function broadcast(){
    RoomLifecycle.sendLocal({t:'salesync',round:epoch,...state,left:Math.max(0,ends-now()),sentAt:Date.now()});pulse=now()+1500;
  }
  function begin(){
    const p=location();if(!p){due=now()+1000;return;}
    offered=true;state={...p,gi:Math.floor(random()*GOODS.length),claims:Array(6).fill(''),rev:0};ends=now()+duration(G.mazeW);broadcast();
  }
  function receive(m){
    if(!enabled||!MP.started||MP.ended||m.f!==MP.order[0]||m.sr!==MP.seriesRound||m.round!==epoch)return;
    if(!Number.isInteger(m.gi)||!GOODS[m.gi]||!Number.isInteger(m.rev)||m.rev<rev||!Number.isFinite(m.left)||m.left<0||m.left>duration(G.mazeW))return;
    if(!Number.isInteger(m.cx)||!Number.isInteger(m.cy)||m.cx<0||m.cy<0||m.cx>=G.mazeW||m.cy>=G.mazeH||!Number.isFinite(m.x)||!Number.isFinite(m.z))return;
    if(!Array.isArray(m.claims)||m.claims.length!==6||m.claims.some(id=>id!==''&&!MP.roster.some(r=>r.id===id)))return;
    if(state&&(m.gi!==state.gi||m.cx!==state.cx||m.cy!==state.cy))return;
    // Cumulative stock snapshots recover missed or reordered pickups without awarding twice.
    if([...applied].some(i=>m.claims[i]!==state.claims[i]))return;
    const first=rev<0;
    const age=Number.isFinite(m.sentAt)?Math.max(0,Math.min(1500,Date.now()-m.sentAt)):0;
    const deadline=now()+Math.max(0,m.left-age);
    if(first)ends=deadline;else ends=Math.min(ends,deadline);
    state={cx:m.cx,cy:m.cy,x:m.x,z:m.z,gi:m.gi,claims:m.claims.slice(),rev:m.rev};rev=m.rev;offered=true;
    if(first&&ends>now()){
      build();const seconds=duration(G.mazeW)/1000,line=GOODS[state.gi].name+'大拍賣，限時'+seconds+'秒！';showToast(line,3000,false);
      window.GameVoice?.announceAssets(['shop.sale.good.'+state.gi,'shop.sale.limit.'+seconds],line);
    }
    for(let i=0;i<6;i++)if(state.claims[i]&&!applied.has(i)){
      applied.add(i);cartAdd(state.claims[i],state.gi);
      if(state.claims[i]===MP.id)showToast('搶到 '+GOODS[state.gi].name+'！記得結帳',1400,'獲得 '+GOODS[state.gi].name);
    }
    updateShopHud();render();
  }
  function render(){
    if(!state||MP.ended||now()>=ends||state.claims.every(Boolean)){clearVisual();return;}
    wares.forEach((s,i)=>s.visible=!state.claims[i]);
    const h=$('shopSaleHud');h.hidden=false;h.textContent=GOODS[state.gi].name+'大拍賣 · '+Math.ceil((ends-now())/1000)+'秒 · 剩'+state.claims.filter(x=>!x).length+'件';
  }
  function eligible(id){
    const b=MP.bots?.find(b=>b.id===id),stun=id===MP.id?G.stunnedUntil:b?.stunnedUntil;
    return !isCheckingOut(id)&&now()>=(stun||0)&&window.ShopChaos?.speed(id)!==0&&now()>=(pickupAt.get(id)||0);
  }
  function tick(dt){
    if(!enabled)return;if(!MP.started||MP.ended){stop();return;}
    if(clerk?.userData.armR)clerk.userData.armR.rotation.z=.7+Math.sin(now()/220)*.28;
    acc+=dt;if(acc<.1)return;acc=0;render();if(!MP.host||G.frozen||G.shifting)return;
    if(!offered&&now()>=due){
      // Do not spawn a sale that the round or imminent maze change would instantly cut off.
      if(Math.min(G.roundEndsAt||Infinity,G.nextShiftAt||Infinity)-now()>=duration(G.mazeW)+1000)begin();
      else offered=true;
    }
    if(!state)return;
    if(now()<ends){
      // Closest eligible shopper wins a contested item; same shopper loads at most one per 1.4 s.
      const near=MP.roster.filter(r=>!r.disconnected&&eligible(r.id)).map(r=>({id:r.id,p:botPosOf(r.id)})).filter(r=>r.p).map(r=>({...r,d:Math.hypot(r.p.x-state.x,r.p.z-state.z)})).filter(r=>r.d<1.65).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id));
      for(const r of near){const slot=state.claims.indexOf('');if(slot<0)break;state.claims[slot]=r.id;state.rev++;pickupAt.set(r.id,now()+1400);broadcast();}
    }
    if(now()>=pulse)broadcast();
  }
  function collectForBot(b,dt,time,mul){
    if(!enabled||!root||!state||now()>=ends||state.claims.every(Boolean)||Math.hypot(b.x-state.x,b.z-state.z)>G.cell*4)return false;
    botWalk(b,{x:state.cx,y:state.cy},'sale'+epoch,dt,time,mul);return true;
  }
  function map(ctx,big,pad,cw,ch){
    if(!root||!state||now()>=ends)return;const x=pad+(state.cx+.5)*cw,y=pad+(state.cy+.5)*ch,r=big?10:5;
    ctx.save();ctx.fillStyle='#e84145';ctx.strokeStyle='#ffe29a';ctx.lineWidth=2;ctx.beginPath();ctx.rect(x-r,y-r,r*2,r*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  const handle=mpHandle;mpHandle=function(m){if(m.t==='salesync'){receive(m);return;}handle(m);};
  const frame=mpFrame;mpFrame=function(dt){frame(dt);tick(dt);};
  const base=window.ShopChaos,baseStart=base.start,baseRebuild=base.rebuild,baseStop=base.stop;
  base.start=function(){baseStart();reset();};base.rebuild=function(){baseRebuild();reset();};base.stop=function(){stop();baseStop();};
  window.ShopSale={tick,stop,map,collectForBot,duration};
})();
