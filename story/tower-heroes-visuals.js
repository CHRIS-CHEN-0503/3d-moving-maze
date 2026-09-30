/* Gear meshes share the game's render loop and lights; no textures or post effects. */
(function(root){'use strict';const H=root.TowerHeroes;
  function gear(T,kind){
    const g=new T.Group(),definition=H.GEAR[kind],tier=definition?.tier||1;g.name='hero-gear-'+kind;g.userData.tier=tier;g.userData.baseKind=definition?.baseKind||kind;kind=g.userData.baseKind;const materials=new Map();
    const mesh=(geo,c,x=0,y=0,z=0)=>{if(!materials.has(c))materials.set(c,new T.MeshLambertMaterial({color:c}));const m=new T.Mesh(geo,materials.get(c));m.position.set(x,y,z);g.add(m);return m;};
    const box=(w,h,d,c,x=0,y=0,z=0)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z),rod=(r,h,c,x=0,y=0,z=0)=>mesh(new T.CylinderGeometry(r,r,h,8),c,x,y,z),gold=tier===3?0xf3d390:0xd9bb75,iron=tier===3?0xcce2e8:tier===2?0xb2c9d2:0x9aafbe,wood=tier===3?0x495f4a:tier===2?0x785d51:0x72523e,dark=tier===3?0x284753:0x354d60;
    if(['longsword','greatsword','twin_daggers'].includes(kind)){const big=kind==='greatsword',small=kind==='twin_daggers',length=big?1.1:small?.4:.72,width=big?.17:small?.07:.1;rod(.04,.25,wood,0,-.05);box(big?.42:.28,.055,.08,gold,0,.1);box(width,length,.045,iron,0,.14+length/2);mesh(new T.ConeGeometry(width*.65,.17,4),iron,0,.23+length);box(.018,length,.052,0xc9dde0,0,.14+length/2);}
    else if(kind==='arcane_staff'){rod(.035,1.3,wood,0,.35);for(const y of [-.2,.76])rod(.06,.1,gold,0,y);const crown=mesh(new T.TorusGeometry(.2,.035,5,12),gold,0,1.1);crown.rotation.y=.2;mesh(new T.OctahedronGeometry(.13),0xbab2f2,0,1.1);}
    else if(kind==='spellbook'){for(const side of [-1,1]){const cover=box(.29,.07,.45,0x46757f,side*.14,0,.07);cover.rotation.z=side*.22;const pages=box(.25,.05,.4,0xf3ddad,side*.14,.055,.07);pages.rotation.z=side*.22;}box(.035,.025,.33,gold,0,.11,.08);}
    else if(kind==='elven_bow'){
      const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.62,0),new T.Vector3(.28,-.36,0),new T.Vector3(.33,0,0),new T.Vector3(.28,.36,0),new T.Vector3(0,.62,0)]);
      mesh(new T.TubeGeometry(curve,16,.035+tier*.006,6,false),wood);rod(.022,.21,0x9c8b67,.32,0,0);
      rod(.007,1.24,0xe4dfc8);for(const y of [-.48,.48]){const tip=mesh(new T.SphereGeometry(.07,8,5),gold,.12,y,0);tip.scale.set(1,.5,.5);}g.rotation.z=.12;
      const arrow=box(.012,.015,.68,0xcfb38a,0,0,.12);arrow.name='bow-nocked-arrow';mesh(new T.ConeGeometry(.035,.11,4),iron,0,0,.5).rotation.x=Math.PI/2;
    }
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
    if(tier>1){
      const head=definition.slot==='helmet',body=definition.slot==='armor',shield=definition.slot==='shield',y=head?1.8:body?1.08:kind==='arcane_staff'?1.1:kind==='spellbook'?.08:kind==='elven_bow'?0:.32,z=head?.34:body?.26:shield?.1:kind==='spellbook'?.3:0;
      for(const side of [-1,1]){const jewel=mesh(new T.SphereGeometry(tier===3?.065:.045,8,5),tier===3?0x8de8cf:0x95c9ef,side*(body?.19:head?.15:.09),y,z);jewel.scale.z=.55;}
      if(tier===3){if(body){for(const side of [-1,1])box(.035,.43,.035,gold,side*.23,1.01,.26);}else if(shield){for(const side of [-1,1])box(.025,.4,.025,gold,side*.13,0,.1);}else if(!head){rod(.065,.09,gold,0,kind==='arcane_staff'?.62:.16);}}
    }
    return g;
  }
  const STYLES=Object.freeze({swordsman:{shirt:0x577c99,hair:0x614832,skin:0xdcb38e,width:1.07,height:1.08,face:1.04,eyes:0x314a63,shape:'square'},mage:{shirt:0x796396,hair:0xd0c2da,skin:0xdfc1b2,width:.91,height:1.03,face:.95,eyes:0x614f92,shape:'slender'},scout:{shirt:0x498a78,hair:0x95533d,skin:0xd5a383,width:.88,height:.93,face:.9,eyes:0x30604c,shape:'petite'},chef:{shirt:0xa68156,hair:0x634330,skin:0xe4b087,width:1.18,height:.99,face:1.06,eyes:0x573e2d,shape:'round'},healer:{shirt:0x6d9982,hair:0xe0ce98,skin:0xe9c1a6,width:.94,height:1.01,face:.94,eyes:0x3f7766,shape:'soft'},smith:{shirt:0x796957,hair:0x4d3631,skin:0xbb8b6f,width:1.25,height:1.02,face:1.08,eyes:0x594337,shape:'stocky'},archer:{shirt:0x657e55,hair:0xd3bc76,skin:0xe7ceb0,width:.85,height:1.16,face:.89,eyes:0x3f8366,shape:'elf'}});
  function base(job,build,identity='hero',sex=root.TowerPartyCore?.PROFESSIONS[job]?.gender||'male'){
    const s=STYLES[job],female=sex==='female',m=build({shirt:s.shirt,pants:0x354351,skin:s.skin,hair:s.hair,type:female?'girl':'boy'}),T=root.THREE;
    m.scale.set(s.width*(female?.94:1),s.height*(female?.97:1),job==='chef'||job==='smith'?1.08:.96);
    Object.assign(m.userData,{heroIdentityStyle:identity==='hero'?'protagonist':'traveller',heroJob:job,heroSex:sex,heroShape:s.shape,heroPieces:[]});
    const head=m.userData.head;if(!T||!head)return m;head.scale.set(s.face,job==='chef'?.96:job==='archer'?1.07:1,1);
    for(const child of head.children)if(child.name==='hair-side'||job==='archer'&&child.name==='human-ear')child.visible=false;
    if(m.children.find(c=>c.name==='base-skirt'))m.children.find(c=>c.name==='base-skirt').visible=false;
    const mats=new Map(),add=(geo,color,x,y,z,parent=head)=>{if(!mats.has(color))mats.set(color,new T.MeshLambertMaterial({color}));const o=new T.Mesh(geo,mats.get(color));o.position.set(x,y,z);parent.add(o);return o;};
    const hair=(w,h,d,x,y,z)=>{const o=add(new T.BoxGeometry(w,h,d),s.hair,x,y,z);o.name='profession-hair';return o;};
    if(female){if(['swordsman','scout','smith'].includes(job)){for(let i=0;i<4;i++){const bead=add(new T.SphereGeometry(.085-i*.008,8,5),s.hair,job==='scout'?.25:-.24,-.14-i*.115,-.15);bead.name='profession-hair';}add(new T.SphereGeometry(.06,8,5),s.shirt,job==='scout'?.25:-.24,-.55,-.15);}else{const back=hair(.48,job==='archer'?.73:.57,.12,0,-.13,-.27);back.scale.x=job==='healer'?1.08:.92;for(const side of [-1,1])hair(.075,.4,.13,side*.27,-.13,-.16);}}
    else if(job==='mage'||job==='archer'){hair(.45,.4,.12,0,-.11,-.27);hair(.17,.19,.08,.12,.17,.27).rotation.z=.25;}else{hair(.24,.11,.09,.06,.22,.23).rotation.z=job==='scout'?-.3:.12;}
    if(job==='archer')for(const side of [-1,1]){const ear=add(new T.ConeGeometry(.085,.34,5),s.skin,side*.34,.02,-.02);ear.rotation.z=-side*1.05;add(new T.SphereGeometry(.035,6,4),0xe6d19d,side*.31,-.055,.025);}
    const face=m.userData.face;if(face){for(const eye of face.eyes)eye.material=new T.MeshLambertMaterial({color:s.eyes});for(const b of face.brows)b.scale.x=job==='smith'?1.2:job==='healer'?.8:1;face.mouth.scale.x=job==='chef'?1.25:job==='archer'?.8:1;}
    if(job==='scout')for(const side of [-1,1])for(let i=0;i<2;i++)add(new T.SphereGeometry(.012,5,4),0xa56a51,side*(.15+i*.04),-.055,.265);
    if(job==='chef'&&!female){for(const side of [-1,1]){const moustache=add(new T.SphereGeometry(.065,8,5),s.hair,side*.045,-.09,.27);moustache.scale.set(1,.35,.3);}}
    if(job==='smith'){const scar=add(new T.BoxGeometry(.013,.11,.012),0xe2bd9b,-.16,.08,.275);scar.rotation.z=.25;}
    const accessoryColor=job==='chef'?0xf0ddbd:job==='healer'?0xbed6bb:job==='archer'?0xb1bc7a:0xaebfc4;
    const badge=add(new T.SphereGeometry(.045,8,5),accessoryColor,.2,1.21,.23,m);badge.scale.z=.4;
    return m;
  }
  function portrait(job,sex='male'){
    const s=STYLES[job],female=sex==='female',hex=c=>'#'+c.toString(16).padStart(6,'0'),ears=job==='archer'?'<path d="m22 35-12-9 5 19 9 1m50-11 12-9-5 19-9 1" fill="'+hex(s.skin)+'"/>':'',hair=female?'<path d="M22 25q26-27 52 0v50H20Z" fill="'+hex(s.hair)+'"/>':'<path d="M22 27q26-23 52 0v13H22Z" fill="'+hex(s.hair)+'"/>';
    return '<svg class="hero-portrait" viewBox="0 0 96 112" role="img" aria-label="'+H.JOBS[job].name+' · '+(female?'女性':'男性')+'外觀"><rect x="2" y="2" width="92" height="108" rx="20" fill="#1b333d"/>'+hair+ears+'<rect x="24" y="27" width="48" height="46" rx="'+(job==='chef'?14:job==='smith'?6:10)+'" fill="'+hex(s.skin)+'"/><path d="M14 109V91q0-21 34-21t34 21v18" fill="'+hex(s.shirt)+'"/><path d="M25 32q22-27 46 0l-14-2-9 6-10-7Z" fill="'+hex(s.hair)+'"/><ellipse cx="36" cy="47" rx="3" ry="4" fill="'+hex(s.eyes)+'"/><ellipse cx="60" cy="47" rx="3" ry="4" fill="'+hex(s.eyes)+'"/><path d="M41 62q7 5 14 0" fill="none" stroke="#815248" stroke-width="2" stroke-linecap="round"/>'+(job==='chef'&&!female?'<path d="m36 57 12-3 12 3-12 2Z" fill="'+hex(s.hair)+'"/>':'')+(job==='mage'||job==='healer'?'<path d="M24 83h48M41 83l7 13 7-13" fill="none" stroke="#d8c999" stroke-width="3"/>':'<path d="M31 86h34v19H31Z" fill="#344f58"/>')+'</svg>';
  }
  function dress(T,model,equipment,dispose){equipment=Object.fromEntries(Object.entries(equipment).map(([slot,g])=>[slot,g?.durability===0?null:g]));const signature=Object.values(equipment).map(g=>g?.kind||'-').join('|');if(model.userData.heroDress===signature)return;
    for(const p of model.userData.heroPieces||[]){p.parent?.remove(p);dispose(p);}const pieces=[];
    for(const item of Object.values(equipment).filter(Boolean)){const piece=gear(T,item.kind),slot=item.slot;pieces.push(piece);
      const baseKind=H.GEAR[item.kind].baseKind;
      if(baseKind==='robe'&&model.userData.heroJob==='healer')piece.traverse(o=>{if(o.isMesh&&o.material.color.getHex()===0x45617c)o.material.color.setHex(0x6c947f);});
      if(slot==='weapon'){piece.position.set(0,-.36,.13);model.userData.armR.add(piece);if(baseKind==='twin_daggers'){const left=gear(T,item.kind);left.position.set(0,-.36,.13);model.userData.armL.add(left);pieces.push(left);}else if(baseKind==='spellbook'){piece.position.set(0,1.04,.49);model.add(piece);}}
      else if(slot==='shield'){piece.position.set(.07,-.32,.08);piece.rotation.y=Math.PI/3;model.userData.armL.add(piece);}else model.add(piece);
    }
    for(const p of model.userData.head?.children||[])if(p.name==='hair-crown'||p.name==='hair-fringe')p.visible=!equipment.helmet||H.GEAR[equipment.helmet.kind]?.baseKind==='rune_crown';
    Object.assign(model.userData,{heroDress:signature,heroPieces:pieces,heroWeapon:H.GEAR[equipment.weapon?.kind]?.baseKind,heroWeaponKind:equipment.weapon?.kind,hasWeapon:!!equipment.weapon,hasShield:!!equipment.shield});
  }
  function pose(model,remaining,interval,fp=false,dt=0){const right=model.userData.armR,left=model.userData.armL,kind=model.userData.heroWeapon;if(!right||!left)return;
    if(root.TowerCombatMotion){
      const p=root.TowerCombatMotion.update(model,dt),T=root.THREE,q=model.userData.heroWrist||(model.userData.heroWrist=new T.Quaternion()),e=model.userData.heroWristEuler||(model.userData.heroWristEuler=new T.Euler());
      right.rotation.set(p.rx,p.ry,p.rz);left.rotation.set(p.lx,p.ly,p.lz);model.rotation.x=p.lean;model.rotation.z=p.tilt;
      for(const part of model.userData.heroPieces||[]){part.visible=!fp||part.parent===right||part.parent===left||part.userData.baseKind==='spellbook';
        if(part.userData.baseKind===kind){if(kind==='spellbook'){part.position.set(0,1.04+p.bookLift,.49);part.rotation.set(p.bookTilt,0,0);}else{const l=part.parent===left;e.set(l?p.lwx:p.wx,l?p.lwy:p.wy,l?p.lwz:p.wz);q.setFromEuler(e);part.quaternion.copy(part.parent.quaternion).invert().multiply(q);}}
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
      if(p.userData.baseKind===kind&&p.parent!==model){const phase=p.parent===left?swing*.8:swing;e.set(.25+1.35*phase,.16*phase,.12-.3*phase);q.setFromEuler(e);p.quaternion.copy(p.parent.quaternion).invert().multiply(q);}
    }
  }
  root.TowerHeroVisuals={gear,STYLES,base,portrait,dress,pose};
})(globalThis);
