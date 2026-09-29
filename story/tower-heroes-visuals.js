/* Gear meshes share the game's render loop and lights; no textures or post effects. */
(function(root){'use strict';const H=root.TowerHeroes;
  function gear(T,kind){
    const g=new T.Group();g.name='hero-gear-'+kind;const materials=new Map();
    const mesh=(geo,c,x=0,y=0,z=0)=>{if(!materials.has(c))materials.set(c,new T.MeshLambertMaterial({color:c}));const m=new T.Mesh(geo,materials.get(c));m.position.set(x,y,z);g.add(m);return m;};
    const box=(w,h,d,c,x=0,y=0,z=0)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z),rod=(r,h,c,x=0,y=0,z=0)=>mesh(new T.CylinderGeometry(r,r,h,8),c,x,y,z),gold=0xd9bb75,iron=0x9aafbe,wood=0x72523e,dark=0x354d60;
    if(['longsword','greatsword','twin_daggers'].includes(kind)){const big=kind==='greatsword',small=kind==='twin_daggers',length=big?1.1:small?.4:.72,width=big?.17:small?.07:.1;rod(.04,.25,wood,0,-.05);box(big?.42:.28,.055,.08,gold,0,.1);box(width,length,.045,iron,0,.14+length/2);mesh(new T.ConeGeometry(width*.65,.17,4),iron,0,.23+length);box(.018,length,.052,0xc9dde0,0,.14+length/2);}
    else if(kind==='arcane_staff'){rod(.035,1.3,wood,0,.35);for(const y of [-.2,.76])rod(.06,.1,gold,0,y);const crown=mesh(new T.TorusGeometry(.2,.035,5,12),gold,0,1.1);crown.rotation.y=.2;mesh(new T.OctahedronGeometry(.13),0xbab2f2,0,1.1);}
    else if(kind==='spellbook'){for(const side of [-1,1]){const cover=box(.29,.07,.45,0x46757f,side*.14,0,.07);cover.rotation.z=side*.22;const pages=box(.25,.05,.4,0xf3ddad,side*.14,.055,.07);pages.rotation.z=side*.22;}box(.035,.025,.33,gold,0,.11,.08);}
    else if(['smith_hammer','warhammer'].includes(kind)){const big=kind==='warhammer';rod(.04,big?1.1:.65,wood,0,.2);box(big?.58:.42,big?.34:.23,big?.35:.26,iron,0,big?.8:.55);for(const x of [-1,1])box(.055,big?.37:.27,big?.38:.29,gold,x*(big?.28:.2),big?.8:.55);}
    else if(kind==='cooking_pan'){rod(.045,.42,wood,0,.08);const pan=rod(.23,.045,dark,0,.48);pan.rotation.x=Math.PI/2;mesh(new T.TorusGeometry(.21,.025,5,14),iron,0,.48,.026);}
    else if(['buckler','round_shield','tower_shield'].includes(kind)){const big=kind==='tower_shield';if(big){box(.5,.75,.08,dark);box(.045,.72,.1,gold);box(.5,.045,.1,gold,0,.12);}else{const disk=rod(kind==='buckler'?.26:.31,.08,kind==='buckler'?wood:iron);disk.rotation.x=Math.PI/2;mesh(new T.TorusGeometry(kind==='buckler'?.24:.29,.025,4,12),gold,0,0,.055);mesh(new T.SphereGeometry(.075,8,6),iron,0,0,.08);}box(.16,.05,.11,wood,0,0,-.08);}
    else if(kind==='heavy_helm'){rod(.31,.21,iron,0,1.86);for(const side of [-1,1])box(.065,.26,.35,iron,side*.28,1.66);box(.04,.15,.5,gold,0,1.95);}
    else if(kind==='light_hood'){box(.61,.19,.56,wood,0,1.86);box(.62,.045,.22,0xae875e,0,1.79,.25);for(const side of [-1,1])box(.07,.25,.3,wood,side*.29,1.65,-.09);}
    else if(kind==='rune_crown'){
      // Low circlet: open headband, inset forehead jewel and rounded filigree, never spikes.
      for(const y of [1.75,1.82]){const band=mesh(new T.TorusGeometry(.31,.018,4,20),gold,0,y);band.rotation.x=Math.PI/2;band.scale.x=1.05;}
      for(const side of [-1,1]){box(.035,.09,.33,0x677b99,side*.32,1.785);const leaf=mesh(new T.SphereGeometry(.075,8,6),gold,side*.2,1.79,.27);leaf.scale.set(1.25,.5,.3);}
      const mount=mesh(new T.TorusGeometry(.075,.017,4,12),gold,0,1.77,.327);mount.scale.y=1.15;
      const jewel=mesh(new T.SphereGeometry(.062,8,6),0x91d8e4,0,1.77,.34);jewel.scale.set(.85,1.1,.42);
      for(const side of [-1,1]){const scroll=mesh(new T.TorusGeometry(.09,.012,4,10,Math.PI),gold,side*.12,1.77,.31);scroll.rotation.z=side<0?0:Math.PI;}
    }
    else if(kind==='heavy_armor'){box(.69,.49,.44,iron,0,1.02);for(const y of [.76,.87,1.2])box(.71,.055,.47,dark,0,y);for(const side of [-1,1])box(.22,.17,.42,iron,side*.4,1.25);box(.12,.14,.03,gold,0,1.1,.25);}
    else if(kind==='light_armor'){box(.66,.59,.4,0x89664a,0,.99);for(const side of [-1,1]){const strap=box(.055,.6,.43,0xc1a17b,side*.12,1);strap.rotation.z=side*.2;}box(.69,.07,.42,wood,0,.73);}
    else if(kind==='robe'){const skirt=mesh(new T.CylinderGeometry(.3,.46,.74,8),0x45617c,0,.66);skirt.scale.z=.75;box(.65,.55,.4,0x45617c,0,1.04);for(const side of [-1,1])box(.04,.79,.035,gold,side*.18,.91,.235);box(.66,.06,.43,gold,0,.92);}
    return g;
  }
  function base(job,build,identity='hero'){const styles={swordsman:[0x577c99,0x604b3c,'boy'],mage:[0x796396,0x383243,'girl'],scout:[0x498a78,0x624930,'girl'],chef:[0xa68156,0x473428,'boy'],healer:[0x6d9982,0x49302b,'girl'],smith:[0x796957,0x453e38,'boy']},s=styles[job];const m=build({shirt:s[0],pants:0x354351,skin:identity==='hero'?0xe3b48d:0xcfa889,hair:identity==='hero'?0x2e2933:s[1],type:s[2]});m.userData.heroIdentityStyle=identity==='hero'?'protagonist':'traveller';m.userData.heroJob=job;m.userData.heroPieces=[];return m;}
  function dress(T,model,equipment,dispose){equipment=Object.fromEntries(Object.entries(equipment).map(([slot,g])=>[slot,g?.durability===0?null:g]));const signature=Object.values(equipment).map(g=>g?.kind||'-').join('|');if(model.userData.heroDress===signature)return;
    for(const p of model.userData.heroPieces||[]){p.parent?.remove(p);dispose(p);}const pieces=[];
    for(const item of Object.values(equipment).filter(Boolean)){const piece=gear(T,item.kind),slot=item.slot;pieces.push(piece);
      if(item.kind==='robe'&&model.userData.heroJob==='healer')piece.traverse(o=>{if(o.isMesh&&o.material.color.getHex()===0x45617c)o.material.color.setHex(0x6c947f);});
      if(slot==='weapon'){piece.position.set(0,-.36,.13);model.userData.armR.add(piece);if(item.kind==='twin_daggers'){const left=gear(T,item.kind);left.position.set(0,-.36,.13);model.userData.armL.add(left);pieces.push(left);}else if(item.kind==='spellbook'){piece.position.set(0,1.04,.49);model.add(piece);}}
      else if(slot==='shield'){piece.position.set(.07,-.32,.08);piece.rotation.y=Math.PI/3;model.userData.armL.add(piece);}else model.add(piece);
    }
    for(const p of model.userData.head?.children||[])if(p.name==='hair-crown'||p.name==='hair-fringe')p.visible=!equipment.helmet||equipment.helmet.kind==='rune_crown';
    Object.assign(model.userData,{heroDress:signature,heroPieces:pieces,heroWeapon:equipment.weapon?.kind,hasWeapon:!!equipment.weapon,hasShield:!!equipment.shield});
  }
  function pose(model,remaining,interval,fp=false,dt=0){const right=model.userData.armR,left=model.userData.armL,kind=model.userData.heroWeapon;if(!right||!left)return;
    if(root.TowerCombatMotion){
      const p=root.TowerCombatMotion.update(model,dt),T=root.THREE,q=model.userData.heroWrist||(model.userData.heroWrist=new T.Quaternion()),e=model.userData.heroWristEuler||(model.userData.heroWristEuler=new T.Euler());
      right.rotation.set(p.rx,p.ry,p.rz);left.rotation.set(p.lx,p.ly,p.lz);model.rotation.x=p.lean;model.rotation.z=p.tilt;
      for(const part of model.userData.heroPieces||[]){part.visible=!fp||part.parent===right||part.parent===left||part.name==='hero-gear-spellbook';
        if(part.name==='hero-gear-'+kind){if(kind==='spellbook'){part.position.set(0,1.04+p.bookLift,.49);part.rotation.set(p.bookTilt,0,0);}else{const l=part.parent===left;e.set(l?p.lwx:p.wx,l?p.lwy:p.wy,l?p.lwz:p.wz);q.setFromEuler(e);part.quaternion.copy(part.parent.quaternion).invert().multiply(q);}}
      }
      if(model.userData.legL)model.userData.legL.rotation.x-=p.knee;if(model.userData.legR)model.userData.legR.rotation.x+=p.knee;return;
    }
    const t=remaining>0?Math.max(0,Math.min(1,1-remaining/interval)):1,swing=remaining>0?Math.sin(t*Math.PI):0;
    // Forward is +Z: negative shoulder rotation moves the hand towards +Z.
    right.rotation.x=-.25-swing*1.45;right.rotation.z=-.08+swing*.3;
    if(['greatsword','warhammer','arcane_staff'].includes(kind)){left.rotation.x=-.48-swing*1.2;left.rotation.z=-.95;right.rotation.z=.65;}
    else if(kind==='spellbook'){left.rotation.x=right.rotation.x=-1;left.rotation.z=-.5;right.rotation.z=.5;}
    else if(kind==='twin_daggers'){left.rotation.x=-.3-Math.sin(Math.min(1,t+.2)*Math.PI)*swing;left.rotation.z=.12;}
    else{left.rotation.z=.05;left.rotation.x=model.userData.hasShield?-.35:0;}
    const T=root.THREE,q=model.userData.heroWrist||(model.userData.heroWrist=new T.Quaternion()),e=model.userData.heroWristEuler||(model.userData.heroWristEuler=new T.Euler());
    for(const p of model.userData.heroPieces||[]){p.visible=!fp||p.parent===right||p.parent===left||kind==='spellbook';
      if(p.name==='hero-gear-'+kind&&p.parent!==model){const phase=p.parent===left?swing*.8:swing;e.set(.25+1.35*phase,.16*phase,.12-.3*phase);q.setFromEuler(e);p.quaternion.copy(p.parent.quaternion).invert().multiply(q);}
    }
  }
  root.TowerHeroVisuals={gear,base,dress,pose};
})(globalThis);
