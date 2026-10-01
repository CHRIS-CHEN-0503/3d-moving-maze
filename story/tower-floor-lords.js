/* Original environment guardians. One extra lord per chapter finale, no extra loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerFloorLords=api;})(globalThis,function(){
  'use strict';
  const ID='monster-11';
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
  const LORDS=Object.freeze(Object.fromEntries(rows.map(([floor,environment,name,personality,color,accent,strength,speed,damage,sight,speaker,lines])=>[floor,Object.freeze({id:'lord-'+environment,floor,environment,name,personality,color,accent,strength,speed,damage,sight,shape:'floor-lord',ranged:['echo','library','mist','heart'].includes(environment),description:personality,lines:Object.freeze(lines),speaker})])));
  const defs=()=>Object.fromEntries(Object.values(LORDS).map(d=>[d.id,d]));
  const forRun=run=>run?.party&&!run.expedition?.active?LORDS[run.floor]||null:null;
  function spec(run){const d=forRun(run);return d?{id:ID,kind:d.id,def:d,strength:d.strength,maxHp:Math.min(240,85+Math.round((99-run.floor)*1.5)),lord:true}:null;}
  const defeated=run=>!forRun(run)||run.defeatedMonsters.includes(ID);
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
  return Object.freeze({ID,LORDS,defs,forRun,spec,defeated,build,tracks:Object.freeze(tracks)});
});
