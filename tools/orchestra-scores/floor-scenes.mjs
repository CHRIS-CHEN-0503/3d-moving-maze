// Fourteen original exploration cues, not replacements for approved music.
// Every environment has its own harmony, melody, orchestration and arc.
import {heldChords,phrase,smoothExpression} from './legato-support.mjs';

const durations=[2.8,2.0,3.0,2.4,1.6,3.1];
function compose(plan){
  const notes=[
    ...heldChords('celli',plan.harmony.map(c=>[c[0]]),{velocity:plan.weight||66,overlap:.35}),
    ...heldChords('violas',plan.harmony.map(c=>[c[1],c[2]]),{start:.05,end:64,velocity:62,overlap:.35}),
    ...heldChords('violins',plan.harmony.map(c=>[c[3],c[4]]),{start:.10,end:64,velocity:61,overlap:.35})
  ];
  for(let i=0;i<4;i++)notes.push(...phrase(plan.leads[i],i*16+.4,
    plan.melody[i].map((key,n)=>[key,(plan.durations||durations)[n]]),plan.melodyVelocity||59,.16));
  // Sustained answers in another desk; no same-key reattacks within a phrase.
  for(const answer of plan.answers||[])notes.push(...phrase(answer.desk,answer.beat,answer.events,answer.velocity||47,.20));
  if(plan.pulse)for(let beat=0;beat<64;beat+=plan.pulse.step){
    const chord=plan.harmony[Math.floor(beat/8)],key=chord[0]+12+(Math.floor(beat/plan.pulse.step)%2?7:0);
    notes.push({desk:'celli',beat:beat+.18,length:Math.min(plan.pulse.step*.72,64-beat-.18),key,velocity:plan.pulse.velocity});
  }
  const arc=plan.arc||[86,89,92,95,99,102,96,90,82];
  const desks=[
    {id:'violins',gain:plan.stringGain??-11,pan:-.30},
    {id:'violas',gain:-12,pan:.22},{id:'celli',gain:-11,pan:.10},
    {id:'flute',gain:plan.leads.includes('flute')?-20:-26,pan:-.12},
    {id:'clarinet',gain:plan.leads.includes('clarinet')?-20:-25,pan:.12},
    {id:'horn',gain:plan.leads.includes('horn')?-21:-25,pan:.28}
  ];
  const controls=desks.flatMap(d=>smoothExpression(d.id,arc.map((v,i)=>[i*8,v]),1/32));
  const underground=plan.chapterId.startsWith('underworld:');
  return {
    id:plan.chapterId.replace(':','-'),revision:'floor-audition',chapterId:plan.chapterId,
    regionName:plan.regionName,floorRange:plan.floorRange,underground,
    title:plan.title,filename:plan.regionName+'-'+plan.title+'.mp3',
    bpm:plan.bpm,beatsPerBar:4,bars:16,tail:4,reverb:plan.reverb||28,
    description:plan.description,tonality:plan.tonality,color:plan.color,
    sections:plan.sections.map((name,i)=>({name,fromBar:i*4,toBar:(i+1)*4,description:plan.sectionNotes[i]})),
    desks,notes:notes.sort((a,b)=>a.beat-b.beat||a.key-b.key),controls:controls.sort((a,b)=>a.beat-b.beat),
    percussion:plan.percussion||[]
  };
}
const bell=(beat,pitch,gain=.022)=>({type:'bell',beat,pitch,gain});
const drum=(beat,pitch,gain=.025)=>({type:'timpani',beat,pitch,gain});
export const floorScores=[
  compose({chapterId:'garden',regionName:'空中庭園',floorRange:[89,80],title:'風中的返鄉種籽',bpm:80,color:'#adc98b',tonality:'F major / Lydian light',
    description:'長笛在花影間舒展，明亮弦樂與稀疏小鐘承接風的流動；輕盈而不逐拍斷開。',
    harmony:[[41,53,57,65,72],[38,53,57,65,69],[46,53,58,65,74],[48,55,60,64,72],[41,53,57,67,72],[43,55,59,65,74],[48,55,58,64,72],[41,53,57,65,69]],
    leads:['flute','flute','clarinet','flute'],melody:[[77,81,79,84,82,81],[79,77,74,77,81,79],[79,82,81,86,84,82],[81,79,77,74,76,77]],
    answers:[{desk:'horn',beat:25,events:[[58,6],[60,5.5]]}],percussion:[bell(8.4,1046.5),bell(32.4,1396.9),bell(48.4,1046.5)],
    sections:['花影迎風','不急著回答','種籽的光','向更深處'],sectionNotes:['長笛與持續弦樂','圓號從遠方接唱','旋律向上展開','落回溫暖和聲']}),
  compose({chapterId:'roots',regionName:'倒生之森',floorRange:[79,70],title:'年輪深處的紅線',bpm:74,color:'#769879',tonality:'E Dorian / minor forest',
    description:'低音弦樂像粗根緩緩延伸，單簧管穿梭其間；幽深、有生命感，後半段透出同行的暖意。',
    harmony:[[40,52,55,62,66],[38,50,57,62,66],[43,55,59,62,67],[45,52,57,61,69],[40,52,55,62,67],[42,54,57,64,69],[47,54,57,63,66],[40,52,55,62,64]],
    leads:['clarinet','clarinet','flute','clarinet'],melody:[[64,67,66,71,69,67],[66,62,64,67,69,66],[76,79,78,81,79,76],[67,66,64,62,63,64]],
    answers:[{desk:'horn',beat:34,events:[[55,6],[57,6]]}],stringGain:-13,reverb:31,
    sections:['根牆呼吸','記號相連','林隙微光','紅線仍在'],sectionNotes:['低弦鋪底','單簧管接續長句','長笛從樹冠穿出','留下回返的旋律']}),
  compose({chapterId:'echo',regionName:'回聲水晶窟',floorRange:[69,60],title:'水晶不替你回答',bpm:78,color:'#8dc9d5',tonality:'B minor / suspended crystal chords',
    description:'高弦、長笛與晶亮鐘音在空間中相互回答，回音不搶主旋律；清透、空靈，保持整段音樂的流動。',
    harmony:[[35,54,59,66,73],[43,55,59,66,74],[38,57,62,69,76],[40,55,59,67,74],[42,54,61,68,73],[43,55,62,69,74],[42,57,61,68,73],[35,54,59,66,71]],
    leads:['flute','clarinet','flute','flute'],melody:[[83,78,81,86,85,83],[71,74,73,78,76,74],[85,86,90,88,86,85],[83,81,78,81,85,83]],
    percussion:[bell(2,1479.98,.017),bell(18,1108.7,.017),bell(34,1661.22,.020),bell(50,1479.98,.016)],reverb:34,
    sections:['晶光深處','不同的回音','聲音分開','聽見自己'],sectionNotes:['高弦連接鐘音','單簧管回答長笛','旋律提高而不急促','收回透明和聲']}),
  compose({chapterId:'library',regionName:'失落圖書館',floorRange:[59,50],title:'未寫完的歸途',bpm:72,color:'#b49dbf',tonality:'G minor / chamber mystery',
    description:'單簧管與中音弦樂像在舊書頁間低語，緩慢轉換的和聲帶出疑問；不以驚嚇或密集節拍破壞閱讀氣氛。',
    harmony:[[43,55,58,62,69],[39,55,58,63,70],[46,53,58,65,72],[41,53,57,60,67],[43,55,58,62,67],[48,55,60,63,70],[38,54,57,62,69],[43,55,58,62,67]],
    leads:['clarinet','clarinet','horn','clarinet'],melody:[[67,69,70,74,72,69],[70,67,65,69,72,70],[62,65,67,70,69,65],[69,67,66,62,65,67]],
    answers:[{desk:'flute',beat:20,events:[[77,5],[74,5]]}],stringGain:-13,reverb:27,
    sections:['書架的低語','缺失的頁角','未完的條款','把書還回去'],sectionNotes:['單簧管溫柔起句','長笛遠處應答','圓號承接疑問','回到安靜的中弦']}),
  compose({chapterId:'mist',regionName:'霧水迴廊',floorRange:[49,40],title:'水面仍記得',bpm:70,color:'#87b8bf',tonality:'A minor / F major reflections',
    description:'柔軟弦樂形成連續水流，木管唱出若隱若現的旋律；帶一點思念，沒有反覆的短促敲擊。',
    harmony:[[45,52,57,64,71],[41,53,57,64,72],[48,55,60,64,71],[43,55,59,62,69],[45,52,57,65,72],[41,53,60,67,72],[40,55,59,64,71],[45,52,57,64,69]],
    leads:['flute','clarinet','flute','clarinet'],melody:[[76,74,72,71,74,76],[69,72,71,67,69,71],[77,79,76,74,72,76],[71,69,67,64,68,69]],
    answers:[{desk:'horn',beat:38,events:[[57,7.5],[53,6]]}],reverb:33,stringGain:-12,
    sections:['霧裡的水紋','模糊的倒影','名字漸清楚','水流向前'],sectionNotes:['長笛漫入水霧','低音木管接唱','弦樂向亮處展開','以長句收束而非切斷']}),
  compose({chapterId:'frost',regionName:'霜封迴廊',floorRange:[39,30],title:'封雪之後的鐘聲',bpm:76,color:'#b4d2ea',tonality:'E minor → G major',
    description:'清冷高弦與遠鐘描畫結霜空間，長笛從細小旋律逐漸唱成完整樂句；寒意之中保留甦醒的希望。',
    harmony:[[40,55,59,66,71],[36,52,55,62,67],[43,55,59,62,69],[38,54,57,62,69],[40,55,59,67,74],[43,55,62,67,71],[38,54,57,64,69],[43,55,59,62,67]],
    leads:['flute','flute','clarinet','flute'],melody:[[83,79,78,74,76,78],[79,78,76,74,71,74],[71,74,76,79,78,76],[79,81,83,81,78,79]],
    percussion:[bell(5,1975.53,.018),bell(21,1567.98,.018),bell(45,1760,.020),bell(57,1567.98,.014)],reverb:32,
    sections:['凝結的空間','鐘的回音','霜開始鬆動','新的刻度'],sectionNotes:['高弦不急著落地','遠鐘與木管相接','旋律轉向明亮','大調弦樂舒展']}),
  compose({chapterId:'clockwork',regionName:'齒輪工坊',floorRange:[29,20],title:'逆轉齒序',bpm:92,color:'#c1aa75',tonality:'D minor / ordered ostinato',
    description:'低弦內聲部有規律地推進，長弓底層不中斷；木管與圓號像齒輪交接，節奏明確而不變成逐拍音效。',
    harmony:[[38,53,57,62,69],[46,53,58,65,72],[43,55,58,62,69],[45,52,57,61,67],[38,53,57,64,69],[41,53,57,60,67],[45,52,59,61,69],[38,53,57,62,69]],
    leads:['clarinet','flute','horn','clarinet'],melody:[[69,65,67,74,72,69],[77,76,74,79,77,76],[62,65,67,69,73,74],[72,69,67,65,64,62]],
    pulse:{step:2,velocity:45},percussion:[drum(0,73.42,.022),bell(8,880,.012),drum(16,65.41,.025),drum(32,73.42,.025),bell(40,1108.7,.013),drum(48,73.42,.024)],reverb:24,
    sections:['齒輪咬合','順序交接','逆向的轉動','新的運轉'],sectionNotes:['持續弦樂托住脈動','長笛從節奏中接唱','圓號擴大旋律','回到穩定的齒序']}),
  compose({chapterId:'furnace',regionName:'熔火爐心',floorRange:[19,10],title:'不燃燒的名字',bpm:90,color:'#d39772',tonality:'C minor / warm heroic release',
    description:'厚實低弦、圓號與克制定音鼓展現爐心的重量，後半段由壓迫轉向堅定；保留探索曲，不直接套用樓主戰。',
    harmony:[[36,51,55,62,67],[44,51,56,63,70],[41,53,56,60,67],[43,50,55,59,65],[36,51,55,63,70],[44,51,58,63,72],[43,50,55,62,71],[36,52,55,62,67]],
    leads:['horn','clarinet','horn','flute'],melody:[[60,63,67,65,62,60],[67,68,70,72,71,67],[63,67,70,72,74,75],[79,77,75,74,76,79]],
    pulse:{step:4,velocity:49},weight:72,stringGain:-10,
    percussion:[drum(0,65.41,.035),drum(8,51.91,.030),drum(16,87.31,.030),drum(24,98,.028),drum(32,65.41,.033),{type:'cymbal',beat:32,gain:.014},drum(48,65.41,.028)],
    sections:['爐壁的重量','熱流流動','不必失去自己','穩定的火光'],sectionNotes:['低弦與圓號','旋律穿過鼓聲','弦樂與銅管展開','木管帶出希望']}),
  compose({chapterId:'heart',regionName:'歸途塔心',floorRange:[9,1],title:'每個人的門把',bpm:74,color:'#d6c29a',tonality:'D major / returning theme',
    description:'寬廣弦樂與長圓號句承接一路的探索，木管在高處回答；莊嚴而溫暖，像接近歸途時終於能放鬆呼吸。',
    harmony:[[38,54,57,64,69],[43,55,59,62,69],[35,54,57,62,69],[45,52,57,61,68],[40,55,59,64,71],[43,55,62,66,71],[45,57,61,64,69],[38,54,57,62,69]],
    leads:['horn','flute','horn','flute'],melody:[[62,69,66,64,67,69],[78,81,79,76,78,81],[66,69,71,74,73,69],[81,79,78,76,73,74]],
    percussion:[bell(16,1174.66,.018),bell(48,1479.98,.018)],weight:68,stringGain:-10,
    sections:['最寬的迷宮','一路的回聲','門不只一扇','你自己的歸途'],sectionNotes:['圓號唱出寬闊主題','長笛接唱','弦樂向高處展開','溫暖長句收束']}),
  compose({chapterId:'underworld:roots',regionName:'根脈遺站',floorRange:[-1,-10],title:'石壁後的留燈歌',bpm:73,color:'#9290b0',tonality:'F sharp minor / ancient roots',
    description:'深弦與低單簧管唱出像遠方哼唱的旋律，微小燈光以長笛回應；比地上森林更古老，也更孤寂。',
    harmony:[[42,54,57,64,69],[38,54,57,64,71],[45,52,57,61,68],[40,52,59,64,68],[42,54,57,66,73],[47,54,59,62,69],[37,53,56,61,68],[42,54,57,64,69]],
    leads:['clarinet','horn','clarinet','flute'],melody:[[66,61,64,69,68,66],[57,61,64,66,64,61],[69,71,73,71,68,66],[78,76,73,76,80,78]],
    answers:[{desk:'flute',beat:20,events:[[80,5],[78,6]]}],reverb:33,stringGain:-13,
    sections:['石壁後的聲音','古路的路鈴','留著一盞燈','更深處的歌'],sectionNotes:['低木管與根脈低弦','圓號留下遠方回答','弦樂略向上展開','長笛接住歌聲']}),
  compose({chapterId:'underworld:mist',regionName:'無名渡渠',floorRange:[-11,-20],title:'無名渡船',bpm:70,color:'#7ca5b9',tonality:'C sharp minor / underground river',
    description:'低弦像霧河持續流動，高低木管隔著寬闊空間相望；鐘音很少，讓地下水道保有深度與寂靜。',
    harmony:[[37,56,61,68,73],[45,57,61,68,76],[42,54,57,64,73],[44,56,59,63,71],[37,56,61,68,76],[40,56,59,66,71],[44,56,60,68,75],[37,56,61,68,73]],
    leads:['flute','clarinet','horn','flute'],melody:[[85,80,83,87,85,83],[68,64,66,71,69,68],[61,64,68,71,69,68],[83,85,87,85,81,80]],
    percussion:[bell(10,1108.7,.014),bell(42,1318.51,.014)],stringGain:-13,reverb:35,
    sections:['沒有天空的河','隔岸的提燈','渡船靠近','水面留下光'],sectionNotes:['高木管越過低弦','低單簧管回答','圓號唱出遠路','長笛重新延展']}),
  compose({chapterId:'underworld:library',regionName:'沉頁藏書庫',floorRange:[-21,-30],title:'誓言的後半頁',bpm:78,color:'#9e91ae',tonality:'E harmonic minor / suspended vow',
    description:'沉穩弦樂上方，單簧管與圓號輪流說出未完的句子；和聲由緊繃逐漸鬆開，仍保留古老石頁的神秘。',
    harmony:[[40,55,59,66,71],[48,55,60,64,71],[45,57,60,64,72],[47,54,59,63,69],[40,55,59,67,74],[43,55,59,62,71],[47,54,57,63,69],[40,55,59,64,71]],
    leads:['clarinet','horn','clarinet','flute'],melody:[[71,67,66,64,63,66],[59,62,63,67,66,63],[72,71,69,67,66,64],[79,78,76,74,75,76]],
    answers:[{desk:'horn',beat:38,events:[[55,5],[59,6]]}],reverb:31,stringGain:-12,
    sections:['石頁的誓言','只有半句話','失落的允許','不再是鎖'],sectionNotes:['單簧管低語','銅管拉開空間','旋律逐漸放鬆','高木管留下出口']}),
  compose({chapterId:'underworld:furnace',regionName:'無火深井',floorRange:[-31,-40],title:'深井裡仍有光',bpm:84,color:'#b89a87',tonality:'G minor → G major / geothermal light',
    description:'厚低弦與緩慢定音鼓描畫深井的尺度，長圓號句越過暗處；不靠刺耳高音製造危險，末段讓光逐漸打開。',
    harmony:[[43,55,58,62,69],[39,55,58,65,70],[48,55,60,63,70],[38,54,57,62,69],[43,55,58,65,74],[46,53,58,65,72],[38,54,57,64,69],[43,55,59,62,71]],
    leads:['horn','clarinet','horn','flute'],melody:[[55,58,62,60,57,55],[67,65,63,62,66,67],[58,62,65,67,69,70],[79,81,83,81,78,79]],
    durations:[3.2,1.8,2.7,3,1.7,2.5],weight:71,stringGain:-10,reverb:34,percussion:[drum(0,49,.029),drum(16,65.41,.027),drum(32,49,.031),drum(48,49,.022)],
    sections:['井底的重量','熱流在暗處','分開的光路','燈不會熄'],sectionNotes:['低弦承接鼓尾','木管穿過石井','圓號慢慢抬升','最後和聲轉暖']}),
  compose({chapterId:'underworld:heart',regionName:'原初門庭',floorRange:[-41,-50],title:'守燈人也能回家',bpm:82,color:'#c4b6d9',tonality:'D minor → D major / final homecoming',
    description:'原初石門的深弦逐漸展開為溫暖銅管，回返旋律由木管接唱；從古老莊嚴走向自由、同行與晨光。',
    harmony:[[38,53,57,64,69],[46,53,58,65,72],[43,55,58,62,69],[45,52,57,61,68],[38,54,57,64,71],[43,55,59,66,74],[45,57,61,64,73],[38,54,57,62,69]],
    leads:['horn','clarinet','horn','flute'],melody:[[62,69,65,64,67,69],[70,69,67,65,64,62],[66,69,71,74,76,73],[81,78,76,74,73,74]],
    weight:69,stringGain:-10,percussion:[drum(0,73.42,.024),bell(16,1174.66,.013),drum(32,73.42,.025),{type:'cymbal',beat:32,gain:.009},bell(48,1479.98,.017)],reverb:33,
    sections:['比高塔更古老','等待的回聲','她也有歸途','迎向晨光'],sectionNotes:['低圓號與寬闊弦樂','木管重新唱出主題','由小調轉向大調','長笛帶著光回家']})
];
