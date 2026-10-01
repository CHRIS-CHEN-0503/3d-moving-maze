/* Gear meshes share the game's render loop and lights; no textures or post effects. */
(function(root){'use strict';const H=root.TowerHeroes;
  function gear(T,kind,appearance={}){
    const g=new T.Group(),definition=H.GEAR[kind],tier=definition?.tier||1,female=appearance.sex==='female',job=appearance.job||definition?.jobs?.[0]||'swordsman',look=style(job,female?'female':'male');g.name='hero-gear-'+kind;Object.assign(g.userData,{tier,baseKind:definition?.baseKind||kind,wearVariant:female?'female':'male',adultDesign:true});kind=g.userData.baseKind;const materials=new Map();
    const mesh=(geo,c,x=0,y=0,z=0)=>{if(!materials.has(c))materials.set(c,new T.MeshLambertMaterial({color:c}));const m=new T.Mesh(geo,materials.get(c));m.position.set(x,y,z);g.add(m);return m;};
    const box=(w,h,d,c,x=0,y=0,z=0)=>mesh(root.CharacterSculpt?root.CharacterSculpt.roundedBox(T,w,h,d):new T.BoxGeometry(w,h,d),c,x,y,z),rod=(r,h,c,x=0,y=0,z=0)=>mesh(new T.CylinderGeometry(r,r,h,10),c,x,y,z),soft=(w,h,d,c,x=0,y=0,z=0)=>{const m=mesh(new T.SphereGeometry(1,12,8),c,x,y,z);m.scale.set(w/2,h/2,d/2);return m;},body=(w,h,d,c,y)=>{const geo=female?new T.LatheGeometry([[0,-.5],[.43,-.48],[.47,-.3],[.35,.02],[.49,.3],[.4,.43],[.25,.5],[0,.5]].map(([r,y])=>new T.Vector2(r*w,y*h)),12):root.CharacterSculpt?root.CharacterSculpt.torso(T,w,h,d):new T.BoxGeometry(w,h,d);if(female)geo.scale(1,1,d/w);return mesh(geo,c,0,y);},gold=tier===3?0xf3d390:0xd9bb75,iron=tier===3?0xcce2e8:tier===2?0xb2c9d2:female?0xb8cbd7:0x9aafbe,wood=tier===3?0x495f4a:tier===2?0x785d51:0x72523e,dark=tier===3?0x284753:0x354d60;
    const neck=(color,y,z)=>{const s=new T.Shape();s.moveTo(-.12,.13);s.lineTo(.12,.13);s.lineTo(0,-.1);s.closePath();return mesh(new T.ShapeGeometry(s),color,0,y,z);};
    const coat=(color,y=.58)=>{for(const side of [-1,1]){const tail=box(female?.23:.28,female?.48:.3,.07,color,side*.19,y,-.12);tail.rotation.z=side*(female?.13:.04);tail.name=female?'female-split-coat':'male-short-coat';}};
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
    else if(kind==='heavy_helm'){const cap=mesh(new T.SphereGeometry(female?.285:.315,12,6,0,Math.PI*2,0,Math.PI/2),iron,0,female?1.75:1.68);cap.scale.set(1,female?.86:1,.9);for(const side of [-1,1])soft(female?.065:.09,female?.2:.27,.28,iron,side*(female?.25:.275),female?1.68:1.63,-.025);if(female){for(const side of [-1,1]){const wing=soft(.15,.045,.12,gold,side*.245,1.84,.14);wing.rotation.z=-side*.3;}}else box(.055,.14,.49,gold,0,1.91);}
    else if(kind==='light_hood'){const cap=mesh(new T.SphereGeometry(female?.285:.325,12,6,0,Math.PI*2,0,Math.PI/2),female?look.cloak:wood,0,female?1.74:1.66);cap.scale.set(1,female?.75:1,.9);soft(female?.54:.63,.055,.23,female?look.accent:0xae875e,0,female?1.8:1.73,.23);if(female){const fold=soft(.15,.12,.28,look.cloak,.25,1.73,-.055);fold.rotation.z=-.25;soft(.07,.09,.04,gold,-.21,1.78,.2);}else for(const side of [-1,1])soft(.09,.27,.29,wood,side*.285,1.58,-.07);}
    else if(kind==='rune_crown'){
      // Low circlet: open headband, inset forehead jewel and rounded filigree, never spikes.
      for(const y of [1.75,1.82]){const band=mesh(new T.TorusGeometry(female?.3:.31,female?.014:.018,4,20),gold,0,y);band.rotation.x=Math.PI/2;band.scale.x=1.05;}
      for(const side of [-1,1]){box(.035,.09,.33,0x677b99,side*.32,1.785);const leaf=mesh(new T.SphereGeometry(.075,8,6),gold,side*.2,1.79,.27);leaf.scale.set(1.25,.5,.3);}
      const mount=mesh(new T.TorusGeometry(.075,female?.012:.017,4,12),gold,0,1.77,.327);mount.scale.set(female?.85:1,female?1.3:1.15,1);
      const jewel=mesh(new T.SphereGeometry(.062,8,6),female?(job==='healer'?0xb8e4cf:0xc5ace7):0x91d8e4,0,1.77,.34);jewel.scale.set(female?.72:.85,female?1.2:1.1,.42);
      for(const side of [-1,1]){const scroll=mesh(new T.TorusGeometry(.09,.012,4,10,Math.PI),gold,side*.12,1.77,.31);scroll.rotation.z=side<0?0:Math.PI;}
    }
    else if(kind==='heavy_armor'){body(female?.68:.76,female?.62:.59,.46,iron,1.03);for(const y of [female?.79:.76,.9,1.22]){const band=mesh(new T.TorusGeometry(female?.285:.34,.022,4,12),dark,0,y);band.rotation.x=Math.PI/2;band.scale.z=.67;}for(const side of [-1,1]){soft(female?.22:.3,female?.16:.25,.42,iron,side*(female?.335:.39),1.25);if(female){const plate=box(.23,.25,.09,iron,side*.22,.7,.14);plate.rotation.z=side*.16;plate.name='female-armored-fauld';}}const crest=soft(female?.085:.12,.15,.035,gold,0,1.12,.25);crest.name=female?'female-leaf-crest':'male-shield-crest';coat(look.cloak,female?.58:.62);}
    else if(kind==='light_armor'){const leather=female?look.leather:0x89664a;body(female?.63:.7,female?.65:.63,.42,leather,1.0);for(const side of [-1,1]){const strap=box(.045,.57,.043,female?look.accent:0xc1a17b,side*(female?.1:.14),1,.215);strap.rotation.z=side*(female?.26:.16);}const belt=mesh(new T.TorusGeometry(female?.235:.31,.035,4,12),wood,0,.77);belt.rotation.x=Math.PI/2;belt.scale.z=.72;coat(female?look.cloak:leather,.6);if(female){neck(look.skin,1.26,.24);soft(.085,.07,.028,gold,0,1.1,.245);}else{const sash=box(.065,.61,.04,look.accent,0,1.0,.225);sash.rotation.z=-.6;}}
    else if(kind==='robe'){const cloth=look.cloak;if(female){const back=mesh(new T.CylinderGeometry(.25,.35,.85,14,false,Math.PI/2,Math.PI),cloth,0,.59,-.04);back.scale.z=.74;for(const side of [-1,1]){const panel=box(.22,.79,.07,cloth,side*.22,.61,.17);panel.rotation.z=side*.095;panel.name='female-slit-robe';}}else{const skirt=mesh(new T.CylinderGeometry(.27,.37,.74,14),cloth,0,.66);skirt.scale.z=.75;}body(female?.64:.7,female?.64:.58,.43,cloth,1.06);for(const side of [-1,1])box(.035,female?.64:.79,.03,gold,side*(female?.13:.18),female?1.02:.91,.225);const belt=mesh(new T.TorusGeometry(female?.23:.3,.025,4,12),gold,0,female?.85:.92);belt.rotation.x=Math.PI/2;belt.scale.z=.75;if(female)neck(look.skin,1.3,.24);else{for(const side of [-1,1]){const lapel=box(.12,.26,.05,look.accent,side*.09,1.23,.23);lapel.rotation.z=-side*.3;}}}
    if(tier>1){
      const head=definition.slot==='helmet',body=definition.slot==='armor',shield=definition.slot==='shield',y=head?1.8:body?1.08:kind==='arcane_staff'?1.1:kind==='spellbook'?.08:kind==='elven_bow'?0:.32,z=head?.34:body?.26:shield?.1:kind==='spellbook'?.3:0;
      for(const side of [-1,1]){const jewel=mesh(new T.SphereGeometry(tier===3?.065:.045,8,5),tier===3?0x8de8cf:0x95c9ef,side*(body?.19:head?.15:.09),y,z);jewel.scale.z=.55;}
      if(tier===3){if(body){for(const side of [-1,1])box(.035,.43,.035,gold,side*.23,1.01,.26);}else if(shield){for(const side of [-1,1])box(.025,.4,.025,gold,side*.13,0,.1);}else if(!head){rod(.065,.09,gold,0,kind==='arcane_staff'?.62:.16);}}
    }
    if(female&&kind==='rune_crown'){g.scale.set(.88,.96,.91);g.position.y=.105;}
    return g;
  }
  const STYLES=Object.freeze({swordsman:{shirt:0x577c99,hair:0x614832,skin:0xdcb38e,width:1.07,height:1.08,face:1.04,eyes:0x314a63,shape:'square'},mage:{shirt:0x796396,hair:0xd0c2da,skin:0xdfc1b2,width:.91,height:1.03,face:.95,eyes:0x614f92,shape:'slender'},scout:{shirt:0x498a78,hair:0x95533d,skin:0xd5a383,width:.88,height:.93,face:.9,eyes:0x30604c,shape:'petite'},chef:{shirt:0xa68156,hair:0x634330,skin:0xe4b087,width:1.18,height:.99,face:1.06,eyes:0x573e2d,shape:'round'},healer:{shirt:0x6d9982,hair:0xe0ce98,skin:0xe9c1a6,width:.94,height:1.01,face:.94,eyes:0x3f7766,shape:'soft'},smith:{shirt:0x796957,hair:0x4d3631,skin:0xbb8b6f,width:1.25,height:1.02,face:1.08,eyes:0x594337,shape:'stocky'},archer:{shirt:0x657e55,hair:0xd3bc76,skin:0xe7ceb0,width:.85,height:1.16,face:.89,eyes:0x3f8366,shape:'elf'}});
  // All playable/recruitable job variants are adult adventurers. Appearance only:
  // no item duplication, gender equip locks, stat changes or save migration.
  const VARIANTS=Object.freeze({
    swordsman:{male:{hair:0x4d352e,cloak:0x293f66,accent:0xb9d4e8,leather:0x6a4b3b,description:'俐落短髮、寬肩、短戰袍與盾徽'},female:{hair:0x953f34,shirt:0x7595b5,cloak:0x426993,accent:0xe2c585,leather:0x705241,description:'赤銅側辮、修身分片護甲與藍色長戰袍'}},
    mage:{male:{hair:0xbabecb,cloak:0x3f436b,accent:0xaacbda,leather:0x534662,description:'灰銀短髮、短鬚、立領長袍'},female:{hair:0x493457,shirt:0x9174b2,cloak:0x674677,accent:0xe4bd85,leather:0x76516e,description:'紫黑長波浪髮、收腰側開衩法袍'}},
    scout:{male:{hair:0x654132,cloak:0x244f47,accent:0x99c5b4,leather:0x785843,description:'斜瀏海、斜背束帶與短獵裝'},female:{hair:0xbc7845,shirt:0x76a18b,cloak:0x377561,accent:0xe4bc8b,leather:0x705b4f,description:'蜜銅側編髮、斜肩披巾與分片輕甲'}},
    chef:{male:{hair:0x4f3428,cloak:0x70503b,accent:0xf0ddbd,leather:0x876248,description:'濃髭、圓肩、雙排扣短圍裙'},female:{hair:0x7d3937,shirt:0xbb9070,cloak:0x946458,accent:0xf4dcc2,leather:0x9e7763,description:'側髻與捲髮、收腰圍裙式輕甲'}},
    healer:{male:{hair:0x715440,cloak:0x325e52,accent:0xb6d7b5,leather:0x625c42,description:'栗色短髮、寬領綠袍與療護肩巾'},female:{hair:0xe0be74,shirt:0x94b49b,cloak:0x648d79,accent:0xe9d6a0,leather:0x7b8060,description:'金色長側髮、垂墜開衩療護袍'}},
    smith:{male:{hair:0x332a27,cloak:0x4b3532,accent:0xd1a078,leather:0x574234,description:'厚鬚、寬肩金屬鎧與短工匠戰袍'},female:{skin:0xdab098,hair:0x824832,eyes:0x74563e,shirt:0x9c7857,cloak:0x806344,accent:0xe4c48e,leather:0x8d6245,description:'柔和圓臉、赤棕雙辮與實用工匠護甲'}},
    archer:{male:{hair:0xb19b62,cloak:0x354d3a,accent:0xb5c77d,leather:0x68543e,description:'精靈短髮、獵裝束帶與短斗篷'},female:{width:.98,height:1.03,face:.95,hair:0xd2aa55,shirt:0x90a36b,cloak:0x617843,accent:0xefd495,leather:0x847245,description:'勻稱精靈身形、長編髮、葉片輕甲與側披風'}},
  });
  const style=(job,sex='male')=>({...STYLES[job],...VARIANTS[job]?.[sex]});
  function base(job,build,identity='hero',sex=root.TowerPartyCore?.PROFESSIONS[job]?.gender||'male'){
    const s=style(job,sex),female=sex==='female',m=build({shirt:s.shirt,pants:0x354351,skin:s.skin,hair:s.hair,type:female?'girl':'boy'}),T=root.THREE;
    m.scale.set(s.width*(female?.9:1.03),s.height*(female?1.05:1),job==='chef'||job==='smith'?1.08:.96);
    Object.assign(m.userData,{heroIdentityStyle:identity==='hero'?'protagonist':'traveller',heroJob:job,heroSex:sex,heroShape:s.shape,heroVariant:job+'-'+sex,adultDesign:true,heroPieces:[]});
    const head=m.userData.head;if(!T||!head)return m;head.scale.set(s.face*(female?.87:1.03),female?.94:job==='chef'?.96:job==='archer'?1.07:1,1);if(female)head.position.y+=.07;
    const jaw=({swordsman:1.14,mage:.94,scout:.95,chef:1.1,healer:1.0,smith:1.18,archer:.9}[job])*(female?.85:1),faceMesh=m.userData.headMesh;
    if(faceMesh&&root.CharacterSculpt?.head){faceMesh.geometry.dispose();faceMesh.geometry=root.CharacterSculpt.head(T,.54,.55,.48,{jaw:female&&job==='smith'?.94:jaw,cheek:job==='chef'?1.45:female&&job==='smith'?1.45:female?1.2:1,chin:female?.86:job==='smith'?1.12:1});}
    for(const child of head.children)if(child.name==='hair-side'||job==='archer'&&child.name==='human-ear')child.visible=false;
    if(m.children.find(c=>c.name==='base-skirt'))m.children.find(c=>c.name==='base-skirt').visible=false;
    const mats=new Map(),add=(geo,color,x,y,z,parent=head)=>{if(!mats.has(color))mats.set(color,new T.MeshLambertMaterial({color}));const o=new T.Mesh(geo,mats.get(color));o.position.set(x,y,z);parent.add(o);return o;};
    const hair=(w,h,d,x,y,z)=>{const o=add(root.CharacterSculpt?root.CharacterSculpt.capsule(T,w,h,d):new T.BoxGeometry(w,h,d),s.hair,x,y,z);o.name='profession-hair';return o;},soft=(w,h,d,color,x,y,z,parent=head)=>{const o=add(new T.SphereGeometry(1,10,6),color,x,y,z,parent);o.scale.set(w/2,h/2,d/2);return o;};
    if(female){
      if(['swordsman','scout','smith'].includes(job)){for(const side of job==='smith'?[-1,1]:[job==='scout'?-1:1]){const count=job==='smith'?3:4;for(let i=0;i<count;i++){const bead=soft(.15-i*.012,.18,.15,s.hair,side*(.29+i*.014),-.12-i*.125,.055);bead.name='profession-hair';bead.userData.braidSide=side;}soft(.08,.06,.075,s.accent,side*.33,-.12-count*.125,.06);}hair(.19,.11,.11,-.13,.15,.23).rotation.z=.3;}
      else if(job==='chef'){soft(.26,.25,.25,s.hair,.2,.02,-.24);for(const side of [-1,1])hair(.13,.33,.17,side*.27,-.11,.04);hair(.27,.105,.11,-.07,.17,.22).rotation.z=-.25;}
      else{hair(.47,job==='archer'?.8:.62,.16,0,-.21,-.24);for(const side of [-1,1]){const lock=hair(job==='mage'?.15:.12,job==='archer'?.6:.46,.16,side*.26,-.21,.04);lock.rotation.z=side*(job==='mage'?.18:.07);}hair(.29,.12,.1,-.065,.15,.225).rotation.z=-.18;}
    }else{hair(.24,.1,.09,.06,.22,.23).rotation.z=job==='scout'?-.3:.12;if(job==='mage'){hair(.31,.26,.12,0,-.12,-.24);hair(.16,.12,.065,0,-.21,.18);}if(job==='smith')hair(.25,.17,.06,0,-.18,.18);}
    if(job==='archer')for(const side of [-1,1]){const ear=add(new T.ConeGeometry(.085,.34,5),s.skin,side*.34,.02,-.02);ear.rotation.z=-side*1.05;add(new T.SphereGeometry(.035,6,4),0xe6d19d,side*.31,-.055,.025);}
    const nose=head.children.find(c=>c.name==='sculpted-nose');if(nose)nose.scale.set(female?.82:job==='smith'?1.15:1,female?.9:1,job==='mage'?1.15:female?.85:1);
    const bridge=soft(.048,.105,.044,s.skin,0,-.015,.244);bridge.name='nose-bridge';for(const side of [-1,1]){const nostril=soft(.013,.012,.01,0x8b6055,side*.024,-.074,.286);nostril.name='nostril';}
    const face=m.userData.face;if(face){const eyeMaterial=new T.MeshLambertMaterial({color:s.eyes});for(const eye of face.eyes){eye.material=eyeMaterial;eye.scale.x=female&&job==='smith'?.96:female?.88:.76;}for(const b of face.brows){b.scale.x=(job==='smith'?(female?.86:1.2):job==='healer'?.8:1)*(female?.9:1.1);b.scale.y=female?.7:1.2;}face.width=(job==='chef'?1.15:job==='archer'?.85:1)*(female?.9:1);for(const lip of face.lips||[])lip.material.color.setHex(female?0xb3747b:0xae8170);for(const cheek of face.cheeks)cheek.material.opacity=female?.34:.24;}
    if(job==='scout')for(const side of [-1,1])for(let i=0;i<2;i++)add(new T.SphereGeometry(.012,5,4),0xa56a51,side*(.15+i*.04),-.055,.265);
    if(job==='chef'&&!female){for(const side of [-1,1]){const moustache=add(new T.SphereGeometry(.065,8,5),s.hair,side*.045,-.09,.265);moustache.scale.set(1,.35,.3);}}
    if(job==='smith'&&!female){const scar=add(new T.BoxGeometry(.013,.11,.012),0xe2bd9b,-.16,.08,.275);scar.rotation.z=.25;}
    if(job==='archer'&&female)for(const limb of [m.userData.armL,m.userData.armR,m.userData.legL,m.userData.legR]){limb.scale.x*=1.08;limb.scale.z*=1.08;}
    const badge=add(new T.SphereGeometry(.045,8,5),s.accent,.2,1.21,.23,m);badge.scale.z=.4;
    if(female){for(const leg of [m.userData.legL,m.userData.legR]){leg.material=new T.MeshLambertMaterial({color:s.skin});const boot=leg.children.find(c=>c.geometry?.type==='ExtrudeGeometry');if(boot){boot.scale.y=1.8;boot.position.y=-.38;}}for(const arm of [m.userData.armL,m.userData.armR]){const sleeve=arm.children.find(c=>c.geometry?.type==='LatheGeometry');if(sleeve)sleeve.scale.y=.65;}}
    return m;
  }
  function portrait(job,sex='male'){
    const s=style(job,sex),female=sex==='female',hex=c=>'#'+c.toString(16).padStart(6,'0'),ears=job==='archer'?'<path d="m22 35-12-9 5 19 9 1m50-11 12-9-5 19-9 1" fill="'+hex(s.skin)+'"/>':'',long=['mage','healer','archer'].includes(job),hair=female?'<path d="M23 28q2-24 25-24t25 24v'+(long?55:40)+'l-12-8H32l-11 8Z" fill="'+hex(s.hair)+'"/>':'<path d="M23 30q1-25 25-25 27 3 25 25v13H23Z" fill="'+hex(s.hair)+'"/>',face=female?'M27 29q21-15 42 0v24q-2 15-21 23-19-8-21-23Z':'M24 29q24-17 48 0v27l-9 15-15 6-15-6-9-15Z';
    const braids=female&&job==='smith'?'<g data-hair="twin-braids" fill="none" stroke="'+hex(s.hair)+'" stroke-width="8" stroke-linecap="round"><path d="M24 51q-10 8-4 18t-1 17"/><path d="M72 51q10 8 4 18t1 17"/></g><path d="M14 84h12m44 0h12" stroke="'+hex(s.accent)+'" stroke-width="4"/>':female&&!long?'<path d="M72 50q11 7 3 21t-1 17" fill="none" stroke="'+hex(s.hair)+'" stroke-width="8" stroke-linecap="round"/>':'';
    return '<svg class="hero-portrait" viewBox="0 0 96 112" role="img" aria-label="'+H.JOBS[job].name+' · 成年'+(female?'女性':'男性')+' · '+s.description+'"><rect x="2" y="2" width="92" height="108" rx="20" fill="#1b333d"/>'+hair+ears+'<path d="'+face+'" fill="'+hex(s.skin)+'"/><path d="M'+(female?'19':'12')+' 110V92q0-20 '+(female?'29':'36')+'-20t'+(female?'29':'36')+' 20v18" fill="'+hex(s.cloak)+'"/><path d="M27 32q17-28 43-4l-16 7-11-8-16 16Z" fill="'+hex(s.hair)+'"/><path d="M30 42h12m12 0h12" stroke="'+hex(s.hair)+'" stroke-width="'+(female?2:3)+'" stroke-linecap="round"/><ellipse cx="36" cy="49" rx="3" ry="4" fill="'+hex(s.eyes)+'"/><ellipse cx="60" cy="49" rx="3" ry="4" fill="'+hex(s.eyes)+'"/><path d="m48 49-3 8h5m-9 7q7 4 14 0" fill="none" stroke="'+(female?'#aa6672':'#936f60')+'" stroke-width="2" stroke-linecap="round"/>'+braids+(!female&&['chef','mage','smith'].includes(job)?'<path d="m34 65 14 4 14-4-5 11H39Z" fill="'+hex(s.hair)+'"/>':'')+'<path d="M'+(female?'32 83 48 98 64 83':'27 85h42m-33 0 12 16 12-16')+'" fill="none" stroke="'+hex(s.accent)+'" stroke-width="3"/></svg>';
  }
  function dress(T,model,equipment,dispose,{showHelmet=true}={}){equipment=Object.fromEntries(Object.entries(equipment).map(([slot,g])=>[slot,g?.durability===0?null:g]));const appearance={job:model.userData.heroJob,sex:model.userData.heroSex},signature=(appearance.job||'')+'|'+(appearance.sex||'male')+'|'+showHelmet+'|'+Object.values(equipment).map(g=>g?.kind||'-').join('|');if(model.userData.heroDress===signature)return;
    for(const p of model.userData.heroPieces||[]){p.parent?.remove(p);dispose(p);}const pieces=[];
    for(const item of Object.values(equipment).filter(g=>g&&(g.slot!=='helmet'||showHelmet))){const piece=gear(T,item.kind,appearance),slot=item.slot;pieces.push(piece);
      const baseKind=H.GEAR[item.kind].baseKind;
      if(slot==='weapon'){piece.position.set(0,-.36,.13);model.userData.armR.add(piece);if(baseKind==='twin_daggers'){const left=gear(T,item.kind,appearance);left.position.set(0,-.36,.13);model.userData.armL.add(left);pieces.push(left);}else if(baseKind==='spellbook'){piece.position.set(0,1.04,.49);model.add(piece);}}
      else if(slot==='shield'){piece.position.set(.07,-.32,.08);piece.rotation.y=Math.PI/3;model.userData.armL.add(piece);}else model.add(piece);
    }
    for(const p of model.userData.head?.children||[])if(p.name==='hair-crown'||p.name==='hair-fringe')p.visible=!showHelmet||!equipment.helmet||H.GEAR[equipment.helmet.kind]?.baseKind==='rune_crown';
    Object.assign(model.userData,{heroDress:signature,heroPieces:pieces,heroWeapon:H.GEAR[equipment.weapon?.kind]?.baseKind,heroWeaponKind:equipment.weapon?.kind,hasWeapon:!!equipment.weapon,hasShield:!!equipment.shield});
  }
  function pose(model,remaining,interval,fp=false,dt=0){const right=model.userData.armR,left=model.userData.armL,kind=model.userData.heroWeapon;if(!right||!left)return;
    if(root.TowerCombatMotion){
      const p=root.TowerCombatMotion.update(model,dt),T=root.THREE,q=model.userData.heroWrist||(model.userData.heroWrist=new T.Quaternion()),e=model.userData.heroWristEuler||(model.userData.heroWristEuler=new T.Euler()),offset=model.userData.heroWristOffset||(model.userData.heroWristOffset=new T.Vector3());
      right.rotation.set(p.rx,p.ry,p.rz);left.rotation.set(p.lx,p.ly,p.lz);model.rotation.x=p.lean;model.rotation.z=p.tilt;
      for(const part of model.userData.heroPieces||[]){part.visible=!fp||part.parent===right||part.parent===left||part.userData.baseKind==='spellbook';
        if(part.userData.baseKind===kind){if(kind==='spellbook'){part.position.set(0,1.04+p.bookLift,.49+p.bookPush);part.rotation.set(p.bookTilt,0,0);}else{const l=part.parent===left;offset.set(l?p.lpx:p.wpx,l?p.lpy:p.wpy,l?p.lpz:p.wpz).applyQuaternion(q.copy(part.parent.quaternion).invert());part.position.set(0,-.36,.13).add(offset);e.set(l?p.lwx:p.wx,l?p.lwy:p.wy,l?p.lwz:p.wz);q.setFromEuler(e);part.quaternion.copy(part.parent.quaternion).invert().multiply(q);}}
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
  root.TowerHeroVisuals={gear,STYLES,VARIANTS,style,base,portrait,dress,pose};
})(globalThis);
