/* Original environment guardians. One extra lord per chapter finale, no extra loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerFloorLords=api;})(globalThis,function(){
  'use strict';
  const ID='monster-11',UNDERWORLD_ID='monster-12';
  const TACTICS=Object.freeze(Object.fromEntries(Object.entries({
    cloud:{role:'守誓近衛',threat:'守在章末門前，靠太近會接連承受碰撞與重擊。',counter:'先留好退路，等重擊落空，再與同伴一起上前。'},
    garden:{role:'庭園守門',threat:'會沿通道逼近；半血時，兩根供能藤會撐起根盾。',counter:'保留退路；根盾亮起後，兩根供能藤會長在園后附近（小地圖「藤」），靠近點對話斬斷，再進攻園后。'},
    roots:{role:'緩行重衛',threat:'行動較慢，但近身碰撞與揮擊都很有力。',counter:'用遠程隊員拉開距離，近戰隊員趁出手間隔反擊。'},
    echo:{role:'晶光射手',threat:'遠處蓄力射晶光；半血會啟動晶罩，普通攻擊暫時無效。',counter:'蓄力時先側移；半血後轉動晶柱，躲到它後方引晶光擊中晶柱破罩；晶柱熄滅可再轉一次。'},
    library:{role:'書庫術衛',threat:'從書架間瞄準旅人，接近也不能免去碰撞傷害。',counter:'沿書架轉角接近，留下能躲回去的掩護。'},
    mist:{role:'霧中遠衛',threat:'警戒範圍大，會從霧中的通道蓄力射擊。',counter:'先保持照明，看清蓄力後側移，別直直追著走。'},
    frost:{role:'警覺獵手',threat:'能看見很遠的動靜，追上後會近身重擊。',counter:'在踏進長通道前整隊，保留緩速或護盾應付追擊。'},
    clockwork:{role:'循聲總工',threat:'能聽見牆後動靜，隔著牆躲藏仍可能引來追擊。',counter:'用擊暈爭取空檔再拉開距離，別只靠一面薄牆藏身。'},
    furnace:{role:'猛攻追獵',threat:'會從很遠的地方循聲追來，貼身碰撞十分危險。',counter:'開戰前補好護盾，配合緩速與治療，沿有退路的走道交戰。'},
    heart:{role:'塔心術衛',threat:'守住最後的出口，遠程射擊與近身碰撞都要閃避。',counter:'跟著蓄力節奏側移，在牆後重整隊伍，再分批反擊。'},
  }).map(([id,value])=>[id,Object.freeze(value)])));
  const rows=[
    [90,'cloud','雲門守誓者','守約而嚴肅，先出聲警告再迎戰。',0xc9dfec,0xdab56e,2,1.35,11,10,'uncle_fu',['雲門由我看守，先證明你的勇氣。','你沒有退後，我也不會失信。','約定已成，帶著同伴往下走吧。']],
    [80,'garden','荊冠園后','驕傲的園丁，不容旅人破壞庭園。',0x719864,0xe3a8be,2,1.4,12,12,'serena',['這是我的庭園，別踩壞花根！','花園不會讓你輕易通過！','記住，離開時要照顧你的同伴。']],
    [70,'roots','盤根老木','保護森林的老樹，沉穩且固執。',0x755d45,0xb6ca7b,3,1.05,14,11,'uncle_fu',['我的根守著這條路，旅人停步。','森林還在呼吸，我還能守住。','你的心很堅定，去找下一條路吧。']],
    [60,'echo','晶響伯爵','追求完美回聲，善用晶光遠攻。',0x779bb8,0xb9eced,3,1.35,15,15,'dylan',['你的腳步打亂了我的回聲。','聽清楚，水晶即將反擊。','這次回聲，記住了你的名字。']],
    [50,'library','藏頁監館者','嚴格守護書庫，討厭喧嘩與偷書。',0x625b7a,0xe6d3a5,3,1.5,16,13,'serena',['請保持安靜，這裡不准偷走故事。','書頁還沒翻完，你不能離開。','這一頁是你的了，好好記住它。']],
    [40,'mist','霧河渡守','孤獨的守渡人，主動驅離闖入者。',0x577b80,0xb0dfd5,4,1.65,18,17,'uncle_fu',['霧河不渡沒有決心的人。','潮水還在，我就不會退。','去吧，別讓同伴留在霧裡。']],
    [30,'frost','霜角守望者','警覺的冰原獵手，察敵範圍很廣。',0x9dbacb,0xe4f2ff,4,1.8,19,18,'dylan',['雪地留下了你的腳印，我看見你了。','寒霜還沒退，別急著向前！','你的勇氣，比寒風更堅強。']],
    [20,'clockwork','百齒總工','講究效率，見到入侵者立即追捕。',0x8f8068,0xe3b97b,4,1.7,20,14,'uncle_fu',['停下！這裡的齒輪不容你打亂。','備用機關啟動，再來一次！','通道交給你了，別讓隊伍掉隊。']],
    [10,'furnace','熾爐鬥王','好戰的大塊頭，看到對手便追擊。',0x755046,0xffa269,5,1.95,22,20,'uncle_fu',['終於有對手了，讓我看看你的本事！','爐火更旺了，接住這一招！','打得痛快！下面的路交給你了。']],
    [1,'heart','塔心聆聲者','記得召喚者的聲音，守護最後的門。',0x756f88,0xf3d8a1,5,1.7,23,16,'serena',['我認得你的聲音，但你準備好答案了嗎？','高塔正在等待，別放開同伴的手。','答案已經聽見，這次由你選擇歸途。']],
  ];
  const LORDS=Object.freeze(Object.fromEntries(rows.map(([floor,environment,name,personality,color,accent,strength,speed,damage,sight,speaker,lines])=>[floor,Object.freeze({id:'lord-'+environment,floor,environment,name,personality,color,accent,strength,speed,damage,sight,shape:'floor-lord',ranged:['echo','library','mist','heart'].includes(environment),description:personality,tactics:TACTICS[environment],lines:Object.freeze(lines),speaker})])));
  const undergroundRows=[
    [-10,70,'根脈巡站長','忠於舊職責的樹根守衛，認為守燈人離站就會讓道路消失。',600,26,0x59705b,0xc4d99c,['守燈人不能離站，誰也不能帶她走。','根牆收緊，留住最後那盞燈！','原來，放手也不會讓路消失。']],
    [-20,40,'霧籤擺渡人','沉默的石舟守衛，願意載走所有旅人，唯獨不肯載守燈人。',750,28,0x3e6975,0xc6e5dc,['船可以送旅人，不能送守燈人。','霧河還沒准許你們渡過！','她也有自己的名字，自己的彼岸。']],
    [-30,50,'卷燈藏書者','抱緊殘缺誓頁的古老書靈，堅持離開的人必須找人代替。',900,30,0x67537e,0xe7ceaf,['一人離開，一人留下。誰來接過燈？','守燈的誓言，不准更改！','那半頁，原來一直都在。']],
    [-40,10,'深井熾石衛','脾氣急躁的熔石巨衛，看到璃安放手就以為燈火會熄滅。',1050,32,0x794e47,0xf5bf78,['拿穩那盞燈，不許放手！','我會把光路鎖回原位！','燈還亮著。她真的可以離開。']],
    [-50,1,'原門誓守者','被半句誓言束縛的門庭古衛，從未把守燈人也當成需要回家的旅人。',1200,34,0x536776,0xffe1a6,['最後一人還沒回家，守燈人不能走。','舊誓仍在，誰也不准離開！','原來，她就是最後一位歸人。']],
  ];
  const UNDERWORLD_LORDS=Object.freeze(Object.fromEntries(undergroundRows.map(([floor,baseFloor,name,personality,maxHp,damage,color,accent,lines])=>{
    const base=LORDS[baseFloor];return [floor,Object.freeze({...base,id:'lord-underworld-'+base.environment,floor,name,personality,description:personality,maxHp:Math.round(maxHp*1.3),damage,color,accent,strength:5,underworld:true,recordedVoice:false,
      tactics:Object.freeze({...base.tactics,...(base.environment==='furnace'?{role:'深井重衛',threat:'察覺長通道裡的旅人便會逼近，近身重擊十分危險。'}:{role:'地下'+base.tactics.role}),tell:base.ranged?'身前聚光、腳下警示亮起時，立刻準備側移。':'靠近後會停步蓄力；警戒圈亮起時先退到圈外。'}),lines:Object.freeze(lines)})];
  })));
  const ALL_LORDS=Object.freeze({...LORDS,...UNDERWORLD_LORDS});
  const allLords=()=>ALL_LORDS;
  const defs=()=>Object.fromEntries(Object.values(ALL_LORDS).map(d=>[d.id,d]));
  const forRun=run=>run?.party&&!run.expedition?.active?ALL_LORDS[run.floor]||null:null;
  function spec(run){const d=forRun(run);return d?{id:d.underworld?UNDERWORLD_ID:ID,kind:d.id,def:d,strength:d.strength,maxHp:d.maxHp||Math.round(Math.min(240,85+Math.round((99-run.floor)*1.5))*1.3),lord:true}:null;}
  const defeated=run=>{const d=forRun(run);return !d||run.defeatedMonsters.includes(d.underworld?UNDERWORLD_ID:ID);};
  const tracks={};for(const d of Object.values(LORDS))for(const [i,event]of ['encounter','wounded','defeat'].entries())tracks['lord.'+d.environment+'.'+event]=Object.freeze({src:'./assets/voice/lords/'+d.environment+'-'+event+'.mp3',text:d.lines[i],speaker:d.speaker,instruction:'成年角色，普通话清楚自然，正常速度，沉稳有戏剧感，不要尖叫，不要唱歌。',category:'character-bark'});
  // Every lord is sculpted for its own hall: a cloud knight, a thorn queen, a treant,
  // a crystal count, a book warden, a ferryman, an antlered hunter, a gear foreman,
  // a furnace brawler and the listener of the tower heart. Underground wardens reuse
  // their hall's silhouette in their own colours with a warden badge. The cinematic
  // rig (head/torso/arms/legs/mouth/eyes) and the gameplay ring keep their contract.
  const shade=(hex,f)=>{const r=Math.min(255,Math.round(((hex>>16)&255)*f)),g=Math.min(255,Math.round(((hex>>8)&255)*f)),b=Math.min(255,Math.round((hex&255)*f));return (r<<16)|(g<<8)|b;};
  function build(T,d){
    const model=new T.Group(),body=new T.Group();model.name=d.id;model.userData.floorLord=true;model.userData.environment=d.environment;model.add(body);body.position.y=1;
    const materials=new Map(),mat=(color,glow=false)=>{const key=color+':'+glow;if(!materials.has(key))materials.set(key,glow?new T.MeshBasicMaterial({color}):new T.MeshLambertMaterial({color}));return materials.get(key);};
    const joint=(name,x,y,z)=>{const g=new T.Group();g.name='cinema-'+name;g.position.set(x,y,z);body.add(g);return g;};
    // Parts are authored in body space and re-parented under their joint, so acting rotates them around the joint.
    const put=(parent,geo,color,x,y,z,{glow=false,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}={})=>{const o=new T.Mesh(geo,mat(color,glow)),base=parent===body?{x:0,y:0,z:0}:parent.position;o.position.set(x-base.x,y-base.y,z-base.z);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);parent.add(o);return o;};
    const box=(w,h,dep)=>new T.BoxGeometry(w,h,dep),cyl=(rt,rb,h,n=8)=>new T.CylinderGeometry(rt,rb,h,n),cone=(r,h,n=6)=>new T.ConeGeometry(r,h,n),ball=(r,w=8,h=6)=>new T.SphereGeometry(r,w,h),ring=(r,t,a=5,b=12)=>new T.TorusGeometry(r,t,a,b),gem=r=>new T.OctahedronGeometry(r,0);
    const env=d.environment,C=d.color,A=d.accent,dark=shade(C,.6),light=shade(C,1.3);
    const head=joint('head',0,1.15,0),torso=joint('torso',0,.3,0),arms=[joint('arm-left',.62,.72,0),joint('arm-right',-.62,.72,0)],legs=[joint('leg-left',.3,-.3,0),joint('leg-right',-.3,-.3,0)];
    const arm=side=>arms[side>0?0:1],leg=side=>legs[side>0?0:1],eyes=[];
    const face=(y=1.2,gap=.15,r=.055,z=.3,mouthY=1.03)=>{for(const side of [-1,1])eyes.push(put(head,ball(r,8,6),A,side*gap,y,z,{glow:true}));const mouth=put(head,box(.18,.05,.025),0x26313b,0,mouthY,z+.03);mouth.name='cinema-mouth';return mouth;};
    let mouth;
    if(env==='cloud'){
      put(torso,box(.9,1,.55),C,0,.3,0);put(torso,box(.7,.5,.12),A,0,.4,.3);put(torso,box(.5,.16,.14),light,0,-.2,.3);
      for(const s of [-1,1]){put(arm(s),box(.46,.24,.5),light,s*.62,.98,0);put(arm(s),box(.7,.3,.15),A,s*.78,.72,-.2,{rz:s*.3});put(arm(s),box(.26,.75,.26),C,s*.62,.35,0);put(leg(s),box(.32,.7,.34),C,s*.3,-.62,0);put(leg(s),box(.36,.2,.42),dark,s*.3,-.9,.03);}
      put(head,box(.5,.5,.5),C,0,1.15,0);put(head,box(.4,.08,.05),dark,0,1.2,.27);put(head,box(.08,.3,.4),A,0,1.5,0);
      put(arm(-1),cyl(.04,.04,2.2,5),light,-.76,.5,.15);put(arm(-1),cone(.09,.35,5),A,-.76,1.75,.15);put(arm(-1),box(.5,.35,.03),A,-1.02,1.35,.15);
      put(body,ring(.9,.1,6,18),light,0,-.92,0,{rx:Math.PI/2});mouth=face();
    }else if(env==='garden'){
      put(torso,cyl(.28,.22,.9,10),C,0,.35,0);put(body,cone(.75,1.4,10),C,0,-.3,0);put(torso,box(.34,.36,.1),A,0,.42,.26);
      for(let i=0;i<3;i++)put(body,cone(.18,.5,4),A,Math.sin(i*2.1)*.6,-.68,Math.cos(i*2.1)*.6,{rx:.3,ry:i*2.1});
      put(head,ball(.33,10,8),light,0,1.15,0);put(head,ring(.3,.04,4,10),A,0,1.4,0,{rx:Math.PI/2});for(let i=0;i<6;i++){const a=i*Math.PI/3;put(head,cone(.06,.28,4),dark,Math.sin(a)*.26,1.55,Math.cos(a)*.26,{rx:Math.cos(a)*.35,rz:-Math.sin(a)*.35});}
      put(head,box(.5,.6,.06),C,0,1.1,-.3);
      for(const s of [-1,1]){put(arm(s),cyl(.07,.09,.8,6),C,s*.62,.35,0);put(leg(s),cyl(.1,.1,.5,5),dark,s*.2,-.5,0);}
      put(arm(-1),cyl(.03,.03,1.1,5),dark,-.7,.5,.2);put(arm(-1),ball(.16,8,6),A,-.7,1.1,.2);for(const s of [-1,1])put(arm(-1),cone(.08,.22,4),light,-.7+s*.12,1.04,.2,{rz:s*1.2});
      mouth=face(1.2,.13,.05,.3,1.05);
    }else if(env==='roots'){
      put(torso,cyl(.5,.62,1.1,8),C,0,.3,0);for(let i=0;i<3;i++)put(torso,box(.3,.5,.1),dark,Math.sin(i*2.1)*.5,.2+i*.12,Math.cos(i*2.1)*.5,{ry:i*2.1});put(torso,ball(.5,8,5),A,0,.95,0,{sx:.95,sy:.3,sz:.95});
      put(head,cyl(.35,.3,.45,7),C,0,1.15,0);for(let i=0;i<5;i++){put(head,cone(.12,.6,5),i%2?C:A,(i-2)*.18,1.56,-.02,{rz:(i-2)*.22});put(head,ball(.11,6,5),A,(i-2)*.24,1.8,-.02);}
      for(const s of [-1,1]){put(arm(s),cyl(.14,.1,.9,6),C,s*.72,.3,0,{rz:s*.45});for(let i=0;i<3;i++)put(arm(s),cone(.06,.3,4),dark,s*.95+(i-1)*.08,-.2,(i-1)*.08,{rx:Math.PI});put(leg(s),cyl(.22,.28,.7,6),C,s*.32,-.65,0);put(leg(s),cone(.12,.3,4),dark,s*.32,-.88,.25,{rx:-1.3});}
      mouth=face(1.2,.14,.05,.33,1.02);
    }else if(env==='echo'){
      put(torso,gem(.55),C,0,.35,0,{sy:1.3,sz:.8});for(let i=0;i<4;i++)put(torso,box(.3,.9,.06),light,(i-1.5)*.28,.4,-.32,{rz:(i-1.5)*.22});put(torso,gem(.21),A,0,.4,.45,{glow:true});
      put(head,gem(.3),C,0,1.15,0,{sy:1.3});for(let i=0;i<3;i++)put(head,gem(.1),A,(i-1)*.18,1.58,0,{sy:1.6});
      for(const s of [-1,1]){put(arm(s),gem(.2),C,s*.62,.35,0,{sy:2});put(leg(s),cyl(.12,.16,.7,6),C,s*.28,-.65,0);put(body,gem(.12),A,s*.95,.1,0,{sy:1.5,glow:true});}
      put(arm(-1),cyl(.035,.035,1,5),light,-.7,.5,.2);for(const s of [-1,1])put(arm(-1),cyl(.03,.03,.5,5),light,-.7+s*.08,1.2,.2);
      mouth=face(1.2,.12,.05,.26,1.05);
    }else if(env==='library'){
      put(torso,box(.95,1.05,.35),C,0,.3,0);put(torso,box(.12,1.05,.37),dark,-.5,.3,0);put(torso,box(.8,.9,.1),light,0,.3,.2);put(torso,box(.5,.25,.03),A,0,.5,.28);
      put(head,box(.5,.42,.45),C,0,1.15,0);put(head,cone(.05,.5,4),A,.2,1.5,0,{rz:-.4});put(head,ring(.1,.02,4,10),A,0,1.2,.26);
      for(const s of [-1,1]){put(arm(s),box(.22,.7,.22),C,s*.62,.35,0);for(let i=0;i<3;i++)put(arm(s),box(.45,.7,.03),light,s*(.9+i*.12),.7+i*.05,-.2-i*.06,{rz:s*(.3+i*.35)});put(leg(s),box(.3,.7,.3),C,s*.3,-.65,0);}
      put(arm(-1),cyl(.015,.015,.4,4),dark,-.75,.0,.25);put(arm(-1),cyl(.1,.1,.22,6),A,-.75,-.3,.25,{glow:true});
      mouth=face(1.2,.14,.05,.25,1.03);
    }else if(env==='mist'){
      put(body,cone(.6,1.3,9),C,0,-.1,0);put(torso,box(.3,.3,.12),A,0,.45,.3);
      put(head,ball(.3,9,7),C,0,1.15,0);put(head,cone(.75,.3,10),A,0,1.42,0);put(head,cone(.25,.3,8),A,0,1.62,0);
      for(const s of [-1,1]){put(arm(s),cyl(.08,.1,.75,6),C,s*.62,.35,0);put(leg(s),cyl(.1,.1,.4,5),dark,s*.2,-.55,0);put(body,ball(.3,7,5),light,s*.65,-.86,.3,{sx:1,sy:.3,sz:1});}
      put(arm(-1),cyl(.04,.04,2.3,5),light,-.72,.5,.15);put(arm(-1),box(.22,.5,.06),C,-.72,-.6,.15);put(arm(1),cyl(.03,.03,1.6,5),dark,.72,.7,.15);put(arm(1),ball(.14,8,6),A,.72,1.55,.15,{glow:true});
      mouth=face(1.2,.13,.05,.28,1.03);
    }else if(env==='frost'){
      put(torso,box(.8,1,.5),C,0,.3,0);put(torso,ring(.55,.14,6,14),light,0,.8,0,{rx:Math.PI/2});
      put(head,box(.44,.48,.44),C,0,1.15,0);for(const s of [-1,1]){put(arm(s),gem(.19),A,s*.55,1,0,{sy:1.5});for(let i=0;i<3;i++)put(head,cone(.05,.5,4),light,s*(.25+i*.12),1.42+i*.1,-.05,{rz:s*(-.5-i*.35)});put(arm(s),box(.26,.75,.26),C,s*.62,.35,0);put(leg(s),box(.3,.7,.3),C,s*.3,-.65,0);put(leg(s),ring(.2,.06,5,10),light,s*.3,-.92,0,{rx:Math.PI/2});}
      put(arm(-1),cyl(.035,.035,2,5),light,-.7,.55,.15);put(arm(-1),cone(.1,.45,4),A,-.7,1.72,.15);
      mouth=face(1.2,.14,.05,.25,1.03);
    }else if(env==='clockwork'){
      put(torso,box(.8,.9,.5),C,0,.3,0);put(torso,ring(.42,.12,6,12),A,0,.35,.2);put(torso,cyl(.1,.1,.6,6),dark,-.3,1.1,-.2);put(torso,ball(.14,6,5),A,-.3,1.42,-.2);
      put(head,box(.5,.45,.5),C,0,1.15,0);for(const s of [-1,1])put(head,ring(.09,.03,4,10),A,s*.15,1.2,.26);
      for(const s of [-1,1]){put(arm(s),cyl(.12,.12,.75,6),C,s*.62,.35,0);put(leg(s),box(.3,.7,.3),C,s*.3,-.65,0);put(leg(s),cyl(.06,.06,.5,5),light,s*.45,-.6,0);}
      put(arm(-1),cyl(.04,.04,1,5),light,-.7,.3,.15);put(arm(-1),box(.22,.18,.1),light,-.7,.85,.15);put(arm(-1),box(.08,.1,.12),dark,-.7,.9,.15);put(arm(1),ring(.18,.06,5,10),A,.72,.1,.2);
      mouth=face(1.2,.15,.05,.3,1.03);
    }else if(env==='furnace'){
      put(torso,box(1.1,1,.65),C,0,.3,0);put(torso,box(.6,.4,.06),A,0,.3,.34,{glow:true});for(let i=0;i<3;i++)put(torso,box(.6,.04,.08),dark,0,.18+i*.12,.36);
      put(head,box(.55,.5,.5),C,0,1.1,0);for(const s of [-1,1]){put(head,cone(.12,.48,5),A,s*.34,1.5,0,{rz:-s*.5});put(arm(s),cone(.14,.3,5),dark,s*.78,1.05,0);put(arm(s),box(.34,.9,.34),C,s*.72,.3,0);put(leg(s),box(.4,.75,.4),C,s*.32,-.6,0);put(leg(s),box(.44,.28,.44),dark,s*.32,-.86,0);put(torso,ball(.06,5,4),A,s*.45,-.05,.36,{glow:true});}
      put(arm(-1),cyl(.06,.06,1.1,6),dark,-.82,.4,.15);put(arm(-1),box(.75,.38,.4),C,-.82,1.05,.15);
      mouth=face(1.15,.16,.05,.28,.98);
    }else{ // heart
      put(body,cyl(.35,.6,1.6,10),C,0,0,0);put(torso,box(.4,.9,.08),A,0,.3,.35);
      put(head,ball(.3,10,8),light,0,1.15,0);put(head,cone(.4,.5,8),C,0,1.4,0);put(head,ring(.5,.03,5,20),A,0,1.62,0,{rx:Math.PI/2,glow:true});put(head,ring(.35,.025,5,18),A,0,1.78,0,{rx:Math.PI/2+.4,glow:true});
      for(const s of [-1,1]){put(arm(s),cyl(.08,.1,.75,6),C,s*.62,.35,0);put(arm(s),ring(.14,.03,5,12),A,s*.7,.1,.3,{glow:true});put(leg(s),cyl(.08,.08,.3,5),dark,s*.2,-.5,0);}
      mouth=face(1.2,.13,.05,.28,1.04);
    }
    if(d.underworld){put(torso,gem(.14),A,0,.62,.4,{glow:true});for(const s of [-1,1])put(arm(s),ring(.2,.05,5,10),dark,s*.62,.78,0,{rx:Math.PI/2});}
    const ringMesh=new T.Mesh(new T.RingGeometry(.7,1.05,24),new T.MeshBasicMaterial({color:0xd55668,transparent:true,opacity:.35,side:T.DoubleSide,depthWrite:false}));ringMesh.rotation.x=-Math.PI/2;ringMesh.position.y=.025;model.add(ringMesh);
    // Strike flash: a short accent shockwave at the feet, hidden until pose() shows a release.
    const flash=new T.Mesh(new T.RingGeometry(.3,1.2,24),new T.MeshBasicMaterial({color:A,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));flash.rotation.x=-Math.PI/2;flash.position.y=.04;flash.visible=false;flash.name='lord-strike-flash';model.add(flash);
    Object.assign(model.userData,{body,ring:ringMesh,flash,accent:d.accent,cinemaRig:{head,torso,arms,legs,mouth,eyes}});return model;
  }
  // Attack acting shared by every lord: wind-up, release and recovery as absolute joint
  // targets above the authored rest pose, so cutscene snapshots and restores stay exact.
  const STYLE=Object.freeze({cloud:'thrust',garden:'sweep',mist:'sweep',echo:'cast',library:'cast',heart:'cast',roots:'smash',frost:'smash',clockwork:'smash',furnace:'smash'});
  function pose(model,{windup=0,total=0,strike=0}={}){
    const rig=model?.userData?.cinemaRig,body=model?.userData?.body;if(!rig||!body)return null;
    const base=model.userData.poseBase||(model.userData.poseBase={torso:[rig.torso.rotation.x,rig.torso.rotation.z],arms:rig.arms.map(a=>[a.rotation.x,a.rotation.z]),head:rig.head.rotation.x,z:body.position.z});
    const kind=STYLE[model.userData.environment]||'smash',charge=total>0&&windup>0?1-Math.max(0,Math.min(1,windup/total)):0,hit=strike>0?Math.min(1,strike/.4):0;
    let torsoX=0,armR=0,armL=0,lean=0,lunge=0,headX=0;
    if(kind==='smash'){armR=-2.4*charge+1.9*hit;armL=-.6*charge+.3*hit;torsoX=-.25*charge+.45*hit;lunge=.35*hit;}
    else if(kind==='thrust'){armR=-1.3*charge+1.5*hit;torsoX=-.15*charge+.25*hit;lunge=.6*hit;headX=-.1*charge;}
    else if(kind==='sweep'){armR=-1.6*charge+1.2*hit;lean=.25*charge-.35*hit;torsoX=-.1*charge+.2*hit;lunge=.25*hit;}
    else{armR=-1.9*charge+.6*hit;armL=-1.9*charge+.6*hit;torsoX=-.2*charge+.1*hit;headX=-.25*charge+.1*hit;lunge=.1*hit;}
    rig.torso.rotation.x=base.torso[0]+torsoX;rig.torso.rotation.z=base.torso[1]+lean;rig.arms[0].rotation.x=base.arms[0][0]+armL;rig.arms[1].rotation.x=base.arms[1][0]+armR;rig.head.rotation.x=base.head+headX;body.position.z=base.z+lunge;
    const flash=model.userData.flash;if(flash){flash.visible=hit>0;if(hit>0){flash.scale.setScalar(.6+1.2*(1-hit));flash.material.opacity=.55*hit;}else flash.material.opacity=0;}
    return {kind,charge,hit};
  }
  // Mini lords (小樓主): one per non-lord floor of a modern party journey, picked by floor from its
  // region's two, so the same region repeats them across floors. Each is a larger, tougher regional
  // creature (an existing creature form) that is worth extra experience. Not a chapter lord: no
  // cutscene, voice, boss music, gear drop or descent gate. It takes the free lord slot ID.
  const MINI_XP=Object.freeze({surface:40,underworld:20}),LORD_XP=100,MINI_HP=1.8,MINI_DAMAGE=1.25;
  // The hunt-rift champion is a little tougher than a floor mini lord (still below the chapter lord).
  const CHAMPION_HP=2.2,CHAMPION_DAMAGE=1.35;
  const MINI_LORDS=Object.freeze(Object.fromEntries(Object.entries({
    summoning:[['雲冠傘王','mushroom',0xe9ddff],['雲階巨蟲','clockmite',0xe2c27a]],
    garden:[['荊芽花衛','flower',0xe58aa2],['蜜后侍蛾','moth',0xf0c050]],
    roots:[['老根傘首','mushroom',0xb08a5c],['盤藤遊蟲長','clockmite',0x93b15e]],
    echo:[['回音晶蟹王','crab',0x8fd8ec],['迴響晶衛長','sentinel',0xa2bde0]],
    library:[['禁書墨傘','mushroom',0x7a6699],['館藏甲衛長','sentinel',0xcdb47c]],
    mist:[['霧渠巨蟹','crab',0x74a6ae],['渡霧燈靈','wisp',0xb6f0e0]],
    frost:[['霜冠術士','shardseer',0xc4ecff],['冰原甲衛長','sentinel',0xdcf0fa]],
    clockwork:[['發條獵犬長','hound',0xcf9c5a],['巨輪遊蟲','clockmite',0xe3b45e]],
    furnace:[['炎鬃獵犬王','hound',0xff7c48],['熔晶術士長','shardseer',0xff9c6a]],
    heart:[['歸燈花后','flower',0xf6d68c],['守門燼犬','hound',0xe4a284]],
    'underworld:roots':[['深脈傘王','mushroom',0x8f7bb0],['星礦根衛長','sentinel',0x9db88a]],
    'underworld:mist':[['盲河巨螯','crab',0x6a8f9e],['無名渡魂','wisp',0xa8dcd0]],
    'underworld:library':[['封誓晶術士','shardseer',0xb59cf0],['誓頁巨蛾','moth',0xd9c08a]],
    'underworld:furnace':[['無火獵犬王','hound',0xc8724f],['井底鎮甲長','sentinel',0x8f8a9e]],
    'underworld:heart':[['門庭星靈','wisp',0xf4e2a6],['誓火巨犬','hound',0xf09a6c]],
  }).map(([region,list])=>[region,Object.freeze(list.map(([name,kind,color],i)=>Object.freeze({id:'mini-'+region.replace(':','-')+'-'+i,name,kind,color,region})))])));
  const pick=(seed,text)=>{let h=seed>>>0;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
  // Whether this floor has a mini lord (every tower region has a catalogue): cheap, for legal-ID checks.
  const hasMini=run=>!!run?.party?.loadouts&&!run.expedition?.active&&Number.isInteger(run.floor)&&run.floor!==0&&!ALL_LORDS[run.floor];
  // The catalogue entry for this floor, or null on lord floors, rifts, legacy journeys and unknown regions.
  function miniFor(run,region){
    if(!hasMini(run)||!region)return null;
    const list=MINI_LORDS[region];return list?list[pick(run.seed,'mini-lord:'+run.floor)%list.length]:null;
  }
  return Object.freeze({ID,UNDERWORLD_ID,LORDS,UNDERWORLD_LORDS,MINI_LORDS,MINI_XP,LORD_XP,MINI_HP,MINI_DAMAGE,CHAMPION_HP,CHAMPION_DAMAGE,allLords,defs,forRun,spec,defeated,hasMini,miniFor,build,pose,STYLE,tracks:Object.freeze(tracks)});
});
