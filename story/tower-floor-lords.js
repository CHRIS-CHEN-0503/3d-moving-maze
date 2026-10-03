/* Original environment guardians. One extra lord per chapter finale, no extra loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerFloorLords=api;})(globalThis,function(){
  'use strict';
  const ID='monster-11',UNDERWORLD_ID='monster-12';
  const TACTICS=Object.freeze(Object.fromEntries(Object.entries({
    cloud:{role:'守誓近衛',threat:'守在章末門前，靠太近會接連承受碰撞與重擊。',counter:'先留好退路，等重擊落空，再與同伴一起上前。'},
    garden:{role:'庭園守門',threat:'會沿通道逼近；花根與牆角可能縮小你的退路。',counter:'選較寬的通道交戰，別讓隊伍退進死路。'},
    roots:{role:'緩行重衛',threat:'行動較慢，但近身碰撞與揮擊都很有力。',counter:'用遠程隊員拉開距離，近戰隊員趁出手間隔反擊。'},
    echo:{role:'晶光射手',threat:'隔著長通道聚集晶光，射擊時不必貼近你。',counter:'瞄準開始後立刻側移；轉角是阻擋晶光的掩護。'},
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
  function build(T,d){
    const model=new T.Group(),body=new T.Group();model.name=d.id;model.userData.floorLord=true;model.add(body);body.position.y=1;
    const materials=new Map(),mat=(color,glow=false)=>{const key=color+':'+glow;if(!materials.has(key))materials.set(key,glow?new T.MeshBasicMaterial({color}):new T.MeshLambertMaterial({color}));return materials.get(key);};
    const add=(geo,color,x,y,z,glow=false)=>{const o=new T.Mesh(geo,mat(color,glow));o.position.set(x,y,z);body.add(o);return o;};
    const orb=(color,x,y,z,w,h=w,depth=w)=>{const o=add(new T.SphereGeometry(1,10,8),color,x,y,z);o.scale.set(w,h,depth);return o;};
    const plate=(w,h,zDepth,color,x,y,z)=>add(new T.BoxGeometry(w,h,zDepth),color,x,y,z);
    orb(d.color,0,.25,0,.6,.72,.43);orb(d.color,0,1.12,.03,.41,.4,.34);
    for(const side of [-1,1]){orb(d.color,side*.69,.25,0,.2,.5,.22);orb(d.color,side*.32,-.65,0,.22,.48,.25);add(new T.SphereGeometry(.055,8,6),d.accent,side*.15,1.18,.35,true);}
    plate(.18,.05,.025,0x26313b,0,1.01,.375);
    const env=d.environment;
    if(['cloud','frost','heart'].includes(env)){for(const side of [-1,1]){const wing=plate(.7,.3,.15,d.accent,side*.75,.72,-.18);wing.rotation.z=side*.3;}add(new T.TorusGeometry(.42,.06,5,16),d.accent,0,1.17,-.06);}
    if(env==='cloud'){orb(d.accent,-.82,.28,.23,.3,.4,.1);plate(.045,.85,.055,d.accent,.88,.44,.1);orb(d.accent,.88,.93,.1,.12,.15,.12);}
    if(env==='frost'){for(const side of [-1,1])add(new T.OctahedronGeometry(.19),d.accent,side*.32,1.55,.02).scale.y=1.45;plate(.045,1.45,.045,d.accent,.86,.42,.1);add(new T.ConeGeometry(.11,.35,4),d.accent,.86,1.3,.1);}
    if(['garden','roots'].includes(env)){for(let i=0;i<5;i++){const branch=add(new T.ConeGeometry(env==='roots'?.17:.12,.65,5),i%2?d.color:d.accent,(i-2)*.18,1.6,-.02);branch.rotation.z=(i-2)*.22;}for(const side of [-1,1]){const leaf=orb(d.accent,side*.7,.7,0,.2,.36,.1);leaf.rotation.z=side*.7;}}
    if(env==='echo'){for(const side of [-1,1])add(new T.OctahedronGeometry(.28),d.accent,side*.6,.8,.05).scale.y=1.6;add(new T.OctahedronGeometry(.21),d.accent,0,.35,.45);}
    if(env==='library'){plate(.8,.65,.14,d.accent,0,.16,.5);for(const side of [-1,1]){const cover=plate(.42,.68,.06,d.color,side*.22,.16,.61);cover.rotation.y=side*-.24;}plate(.85,.14,.75,d.color,0,1.56,.02);}
    if(env==='mist'){const paddle=plate(.1,1.55,.09,d.accent,.9,.5,.1);paddle.rotation.z=-.3;plate(.35,.5,.12,d.color,1.12,-.2,.1);add(new T.ConeGeometry(.55,.36,8),d.accent,0,1.55,0);}
    if(env==='clockwork'){for(const side of [-1,1]){const wheel=add(new T.TorusGeometry(.28,.08,5,12),d.accent,side*.58,.65,.02);wheel.rotation.y=Math.PI/2;}plate(.46,.46,.12,d.accent,.84,.25,.1);}
    if(env==='furnace'){for(const side of [-1,1]){const horn=add(new T.ConeGeometry(.12,.48,5),d.accent,side*.34,1.52,0);horn.rotation.z=side*-.5;}orb(d.accent,0,.3,.43,.2,.28,.08);const hammer=plate(.7,.35,.36,d.color,.9,-.1,.1);plate(.1,.75,.1,d.accent,.9,.3,.1);hammer.rotation.z=.1;}
    if(env==='heart')orb(d.accent,0,.4,.45,.22,.22,.1);
    const ring=new T.Mesh(new T.RingGeometry(.7,1.05,24),new T.MeshBasicMaterial({color:0xd55668,transparent:true,opacity:.35,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;model.add(ring);
    Object.assign(model.userData,{body,ring,accent:d.accent});return model;
  }
  return Object.freeze({ID,UNDERWORLD_ID,LORDS,UNDERWORLD_LORDS,allLords,defs,forRun,spec,defeated,build,tracks:Object.freeze(tracks)});
});
