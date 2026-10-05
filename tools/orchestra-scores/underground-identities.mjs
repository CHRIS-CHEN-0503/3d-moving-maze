// Underground memories have their own forms, not darker transpositions of the tower.
import {createIdentity as make,note,line,bed,hit,finish} from './identity-score-support.mjs';

const roots=make({chapterId:'underworld:roots',regionName:'根脈遺站',floorRange:[-1,-10],title:'留燈者的古祭歌',
  bpm:60,metre:4,bars:12,room:'cathedral',reverb:40,style:'低吟祭儀',colour:'#8c9c7b',
  signature:'低聲人聲取樣與管風琴踏板，稀疏鼓聲像地下的脈搏；不再是地上森林的舞曲。',
  description:'古道留下無詞低吟，管風琴與低弦托住遺站的重量。巴松管偶爾模仿人的嘆息，鼓聲不催促前進，像有人仍守著那盞燈。',
  desks:[['chant',-12,-.1],['organ',-26,.26],['celli',-24,-.3],['bassoon',-17,.17]],
  sections:[['守燈的低吟',0,4,'低人聲與踏板先建立古祭氛圍'],['遺站仍有人',4,9,'巴松管回答低吟'],['不熄的燈',9,12,'人聲回返、鼓聲漸退']]});
const rootChords=[[38,45,50],[38,46,53],[41,48,53],[36,43,48],[38,45,50],[38,45,50]];
bed(roots,'organ',rootChords.map(c=>[c[0],c[1]]),8,39);
bed(roots,'celli',rootChords.map(c=>[c[0]-12]),8,44);
line(roots,'chant',.15,[[50,5.8],[53,3.2],[52,4],[50,5]],70,.22);
line(roots,'bassoon',19.4,[[45,3.5],[48,3],[46,4.5],[43,2.5]],65,.20);
line(roots,'chant',34.2,[[50,4.2],[53,2.7],[52,2.1],[50,4.3]],62,.22);
for(const at of [0,8,16,24,32,40]){hit(roots,'tom',at,.030,73.42);hit(roots,'tom',at+1.2,.017,98);}

const mist=make({chapterId:'underworld:mist',regionName:'無名渡渠',floorRange:[-11,-20],title:'璃安的渡河歌',
  bpm:96,metre:6,bars:14,room:'mediumHall',reverb:29,style:'木吉他舟歌',colour:'#82a7b1',
  signature:'木吉他的左右搖擺與英國管長句；六拍像船槳，不像森林木鼓的跳舞。',
  description:'尼龍弦吉他在兩次船槳之間流動，英國管唱出忘名渡者的舟歌。柔和鐵琴只是遠岸燈火，溫暖、漂泊而孤獨。',
  desks:[['englishhorn',-10,.1],['guitar',-18,-.32],['celli',-25,.20],['vibraphone',-28,.34]],
  sections:[['第一槳',0,4,'吉他搖擺與英國管的渡河主題'],['隔水問名',4,10,'旋律向另一岸伸展'],['船沒有停',10,14,'主題回返、留住漂泊感']]});
const ferryChords=[[45,52,57,60],[41,48,53,57],[48,55,60,64],[43,50,55,59],[45,52,57,60],[38,45,50,53],[40,47,52,56]];
bed(mist,'celli',ferryChords.map(c=>[c[0]]),12,38);
for(let bar=0;bar<14;bar++){
  const at=bar*6,c=ferryChords[Math.floor(bar/2)];
  for(let j=0;j<6;j++)note(mist,'guitar',at+j*.95,.8,c[[0,2,3,1,2,3][j]],j===0||j===3?67:46);
}
const ferryCall=[[69,3],[72,2],[71,1],[67,4],[69,2],[65,3],[64,2],[65,1],[67,4],[69,2]];
line(mist,'englishhorn',.2,ferryCall,72,.14);
line(mist,'englishhorn',36.2,[[72,3],[74,2],[76,1],[74,3],[71,3],[69,4],[67,2],[65,3],[64,3]],68,.14);
line(mist,'englishhorn',66.2,[[69,3],[72,2],[71,1],[67,4],[69,2],[65,4.5]],64,.14);
for(const [at,key]of [[10.5,81],[29.2,79],[58.7,76],[79.2,81]])note(mist,'vibraphone',at,3.5,key,37);

const library=make({chapterId:'underworld:library',regionName:'沉頁藏書庫',floorRange:[-21,-30],title:'石頁上的誓言賦格',
  bpm:108,metre:4,bars:20,room:'cathedral',reverb:34,style:'管風琴誓言賦格',colour:'#9985aa',
  signature:'管風琴主題逐聲進入，雙簧管與大鍵琴追問；像石造教堂，不是地上圖書館的小夜曲。',
  description:'一段誓言在不同聲部中接力、追逐、重疊。管風琴帶著古老秩序，大鍵琴像刻字，雙簧管提出缺失的半句；節奏堅定而不變成機械敲擊。',
  desks:[['organ',-18,-.12],['harpsichord',-22,.3],['oboe',-13,.08],['celli',-25,-.28]],
  sections:[['第一聲誓言',0,3,'管風琴提出主題、低踏板承接'],['另一半進入',3,7,'雙簧管接唱、低弦加入'],['石頁相追',7,13,'大鍵琴與管風琴對位'],['尚未寫完',13,17,'聲部轉向新的和聲'],['誓言回聲',17,20,'主題收束但仍留問題']]});
const vow=[[62,1],[69,1],[65,1],[64,.5],[62,.5],[61,1],[64,1],[67,1],[65,1]];
line(library,'organ',.1,vow,69,.03);
line(library,'oboe',12.1,vow.map(([k,d])=>[k+12,d]),69,.07);
line(library,'celli',24.1,vow.map(([k,d])=>[k-12,d]),65,.06);
for(const at of [32.1,48.1,64.1])line(library,'organ',at,vow,63,.05);
line(library,'oboe',40.1,[[77,2],[76,1],[74,1],[73,2],[76,1],[79,1],[77,3],[76,1],[74,2],[73,2]],67,.07);
line(library,'oboe',68.2,[[77,2],[76,1],[74,1],[73,2],[74,5.5]],64,.07);
const vowRoots=[38,38,46,43,38,41,43,45,38,38];
for(let bar=3;bar<20;bar++){
  const at=bar*4,root=vowRoots[Math.floor(bar/2)];
  if(bar>=7)for(let j=0;j<4;j++)note(library,'harpsichord',at+j,.58,root+12+[0,7,12,7][j],51);
  if(bar>=9)note(library,'celli',at,3.7,root,43);
}
// Continuous low pedal joins the contrapuntal entries without periodic gaps.
// Its register never shares a key with the upper organ subject.
bed(library,'organ',vowRoots.map(k=>[k]),8,51);

const furnace=make({chapterId:'underworld:furnace',regionName:'無火深井',floorRange:[-31,-40],title:'深井的黑鐵脈動',
  bpm:88,metre:4,bars:18,room:'smallRoom',reverb:18,style:'黑鐵工業室內交響',colour:'#a78a77',
  signature:'低鋼琴雙擊、乾燥金屬聲、弱音小號與低音提琴；不是地上爐心的厚重五拍銅管。',
  description:'沒有火焰的井仍在運轉：低鋼琴留下不整齊的雙擊，金屬在遠處回應，弱音小號像一個疲倦的人。弦樂顫音逐漸形成壓力，但不把它寫成熱血戰歌。',
  desks:[['piano',-13,-.15],['contrabass',-18,.22],['mutedtrumpet',-17,.12],['tremolo',-28,-.3]],
  sections:[['井仍在轉',0,5,'低鋼琴雙擊與低音提琴'],['沒有燃料的回答',5,10,'弱音小號唱出疲倦長句'],['黑鐵承壓',10,14,'顫音與金屬聲堆出緊張'],['不必再燃燒',14,18,'旋律放鬆、機械仍繼續']]});
const ironRoots=[36,36,44,41,36,43,44,41,36];
bed(furnace,'tremolo',ironRoots.map(k=>[k+19,k+24]),8,38);
for(let bar=0;bar<18;bar++){
  const at=bar*4,root=ironRoots[Math.floor(bar/2)];
  note(furnace,'piano',at,.62,root,80);note(furnace,'piano',at+.65,.52,root+12,63);
  note(furnace,'contrabass',at+.08,2.8,root,72);
  if(bar%2===0)hit(furnace,'bell',at+2.7,.016,196);
  if(bar>=10&&bar<14){note(furnace,'piano',at+3.1,.52,root+7,64);hit(furnace,'tom',at+2,.022,65.41);}
}
line(furnace,'mutedtrumpet',.25,[[60,3],[63,1],[62,3],[58,2],[55,4]],66,.12);
line(furnace,'mutedtrumpet',21.2,[[67,3],[65,2],[63,4],[62,2],[60,5]],65,.12);
line(furnace,'mutedtrumpet',55.2,[[63,3],[62,2],[58,3],[55,3],[60,4.5]],59,.12);

const heart=make({chapterId:'underworld:heart',regionName:'原初門庭',floorRange:[-41,-50],title:'第一盞燈的回聲',
  bpm:72,metre:4,bars:14,room:'cathedral',reverb:48,style:'古門合唱聖詠',colour:'#c3adce',
  signature:'寬闊合唱、管風琴、細碎豎琴；從莊嚴暗色到溫暖明亮，沒有地上塔心的小號凱旋。',
  description:'穿過最深的門庭，聽見的不是另一場決戰，而是第一盞燈的記憶。合唱在巨大空間中展開，豎琴與鋼片琴像星光；暗色和聲漸漸允許留燈者也能回家。',
  desks:[['choir',-13,-.08],['organ',-27,.15],['harp',-27,.36],['violins',-27,-.32],['celesta',-28,.25]],
  sections:[['第一盞燈之前',0,7,'暗色合唱與巨大門庭的長回聲'],['留燈者也能回家',7,14,'和聲轉暖、豎琴與星光慢慢上升']]});
const originChords=[[45,52,57],[41,48,53],[38,45,50],[40,47,52],[48,55,60],[43,50,55],[48,55,60]];
bed(heart,'organ',originChords.map(c=>c.slice(0,2)),8,38);
bed(heart,'violins',originChords.map(c=>c.slice(1).map(k=>k+12)),8,37);
line(heart,'choir',.2,[[69,4],[72,3],[71,5],[67,4],[65,4],[64,3],[65,4]],75,.22);
line(heart,'choir',29.2,[[72,4],[76,3],[74,4],[72,4],[71,3],[72,7.5]],73,.22);
for(const at of [2.3,12.4,23.2,31.4,41.3,50.2]){
  const c=originChords[Math.floor(at/8)];for(let j=0;j<3;j++)note(heart,'harp',at+j*.48,1.5,c[j]+24,44);
}
for(const [at,key]of [[8.5,88],[20.4,86],[38.2,91],[52.2,96]])note(heart,'celesta',at,3.2,key,34);

export const undergroundIdentityScores=[finish(roots),finish(mist),finish(library),finish(furnace),finish(heart)];
