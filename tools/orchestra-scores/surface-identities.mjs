// Six remaining surface regions. Distinct musical forms, not a shared tune.
import {createIdentity as make,note,line,bed,hit,finish} from './identity-score-support.mjs';

const roots=make({chapterId:'roots',regionName:'倒生之森',floorRange:[79,70],title:'根鬚的古老舞步',
  bpm:128,metre:6,bars:16,room:'mediumHall',reverb:25,style:'森林木鼓舞曲',colour:'#849b65',
  signature:'低木鼓的雙重呼吸、木琴六拍循環與排笛答句；不是庭園豎琴舞步。',
  description:'古老森林的六拍舞曲。木琴像枝葉交錯，排笛與雙簧管從根牆後回答，木鼓在低處推動探索；溫暖卻帶野性。',
  desks:[['marimba',-13,-.32],['panflute',-11,.25],['oboe',-19,-.05],['celli',-26,.08]],
  sections:[['樹根的足音',0,4,'木鼓與木琴先建立六拍識別'],['林中的回應',4,10,'排笛長句與雙簧管接唱'],['枝葉齊舞',10,13,'舞步加密、旋律向上'],['深根仍呼吸',13,16,'森林主題回返']]});
const rootChords=[[40,47,52],[43,50,55],[45,52,57],[38,45,50],[40,47,52],[48,55,60],[47,54,59],[40,47,52]];
bed(roots,'celli',rootChords.map(c=>[c[0]]),12,45);
for(let bar=0;bar<16;bar++){
  const at=bar*6,c=rootChords[Math.floor(bar/2)];
  for(let j=0;j<6;j++)note(roots,'marimba',at+j+.025,.58,c[[0,2,1,0,1,2][j]]+12,j%3===0?75:51);
  hit(roots,'tom',at,.048,98);hit(roots,'tom',at+3,.033,146.83);
  if(bar>=10)hit(roots,'shaker',at+4.5,.012);
}
const rootCall=[[76,2],[79,1],[78,2],[74,1],[76,3],[71,3]];
for(const at of [.18,24.18,60.18,78.18])line(roots,'panflute',at,rootCall,74,.08);
line(roots,'oboe',42,[[67,3],[69,2],[71,1],[74,3],[71,3]],65,.08);

const library=make({chapterId:'library',regionName:'失落圖書館',floorRange:[59,50],title:'書頁間的小夜曲',
  bpm:92,metre:3,bars:26,room:'smallRoom',reverb:17,style:'鋼琴室內小夜曲',colour:'#ab91b5',
  signature:'鋼琴低音與柔軟和弦，雙簧管唱出三拍小夜曲；親近安靜，沒有工坊的大鍵琴敲動。',
  description:'貼近耳邊的鋼琴與雙簧管室內樂。三拍步伐較慢，旋律像翻閱一封未寄出的信，保留停頓、回答與完整的呼吸。',
  desks:[['piano',-12,-.18],['oboe',-12,.12],['clarinet',-22,-.12],['celli',-27,.15]],
  sections:[['第一封信',0,8,'鋼琴與雙簧管的短主題'],['頁角的回答',8,17,'單簧管接過不同的旋律'],['讀完仍未合上',17,26,'原主題以更柔軟的和聲回返']]});
const bookChords=[[45,52,57,60],[41,48,53,57],[48,55,60,64],[43,50,55,59],[45,52,57,60],[38,45,50,53],
  [40,47,52,56],[45,52,57,60],[48,55,60,64],[41,48,53,57],[38,45,50,53],[40,47,52,56],[45,52,57,60]];
bed(library,'celli',bookChords.map(c=>[c[0]]),6,35);
for(let bar=0;bar<26;bar++){
  const at=bar*3,c=bookChords[Math.floor(bar/2)];note(library,'piano',at,.95,c[0],58);
  for(const key of c.slice(1))note(library,'piano',at+1,1.65,key,bar%2?44:50);
}
const letter=[[76,1.5],[74,.5],[72,1],[71,2],[69,1],[72,1.5],[74,.5],[76,1],[79,2],[76,1]];
line(library,'oboe',.25,letter,69,.10);line(library,'oboe',54.25,letter,63,.10);
line(library,'clarinet',27.3,[[69,2],[72,1],[71,1.5],[67,1.5],[65,2],[69,1],[72,2],[71,1]],64,.10);
line(library,'oboe',69,[[74,1.5],[72,1.5],[71,1.5],[68,1.5],[69,2.5]],60,.1);

const mist=make({chapterId:'mist',regionName:'霧水迴廊',floorRange:[49,40],title:'霧河慢慢流',
  bpm:62,metre:4,bars:12,room:'mediumHall',reverb:35,style:'水霧印象樂',colour:'#86b5b9',
  signature:'柔軟的低單簧管長句，豎琴只偶爾掠過；水流般慢板、不敲鐘或跳舞。',
  description:'低單簧管像人在霧中低語，柔弦形成長長水面，豎琴不規律地泛起水紋。節奏不催促，情緒朦朧、溫暖而有一點迷路的憂傷。',
  desks:[['clarinet',-9,-.08],['harp',-23,.34],['violas',-25,-.25],['celli',-25,.16]],
  sections:[['霧從水面升起',0,3,'低單簧管與水面長音'],['看不清的倒影',3,8,'旋律自由延展、豎琴散落水紋'],['水仍往前',8,12,'長句回到熟悉的低音']]});
const waterChords=[[38,50,57,65],[46,53,58,65],[41,53,60,67],[43,55,62,69],[38,50,57,65],[48,55,60,67],[45,52,57,64],[38,50,57,65]];
bed(mist,'celli',waterChords.map(c=>[c[0]]),6,42);bed(mist,'violas',waterChords.map(c=>c.slice(1,3)),6,42);
for(const at of [1.4,9.5,19.3,28.1,39.8]){
  const c=waterChords[Math.floor(at/6)];for(let i=0;i<4;i++)note(mist,'harp',at+i*.32,.85,c[i]+12,45);
}
line(mist,'clarinet',.15,[[65,3.2],[62,2.8],[60,2.1],[62,3.5],[65,3.4]],73,.22);
line(mist,'clarinet',20.1,[[67,3.4],[69,2.5],[65,3.7],[62,3.2]],70,.20);
line(mist,'clarinet',35.4,[[65,3.2],[62,2.8],[60,2.1],[62,3.5]],65,.20);

const frost=make({chapterId:'frost',regionName:'霜封迴廊',floorRange:[39,30],title:'雪停以前',
  bpm:66,metre:4,bars:12,room:'cathedral',reverb:32,style:'冰原鋼琴慢板',colour:'#b8d6e5',
  signature:'清冷鋼琴的高低音回答，遠方圓號只偶爾浮現；空白與長弦像雪。',
  description:'清冷而有情感的鋼琴慢板。低音落下之後，高音像雪片慢慢回答；高弦與遠方圓號保留寒冷尺度，不使用水晶窟的自由晶音主奏。',
  desks:[['piano',-9,-.12],['celesta',-28,.33],['violins',-27,-.25],['horn',-26,.22]],
  sections:[['第一片雪',0,4,'鋼琴獨自提出冰原主題'],['凍住的遠方',4,9,'長弦與圓號漸漸回應'],['雪後一點光',9,12,'鋼琴收回暖色和聲']]});
const snowChords=[[40,55,59],[36,52,55],[43,55,59],[38,54,57],[40,55,59],[43,55,59]];
bed(frost,'violins',snowChords.map(c=>c.slice(1).map(k=>k+12)),8,32);
for(const [at,key,len]of [[0,40,5.7],[1.6,83,2.2],[4.4,79,2.8],[8.2,36,5.5],[10.3,78,3.1],[14.8,76,2.5],
  [17.1,43,5.4],[19.5,79,3],[23.1,83,3.5],[27,38,5.2],[29.5,81,3.2],[33.7,78,3],
  [37.2,40,4.3],[38.7,79,3.2],[42.4,76,2.4],[45.2,79,2.5]])note(frost,'piano',at,len,key,key<50?62:68);
line(frost,'horn',18.6,[[59,6.4],[62,5.3]],44,.25);
for(const [at,key]of [[12.2,90],[31.6,88],[44.8,91]])note(frost,'celesta',at,2.8,key,35);

const furnace=make({chapterId:'furnace',regionName:'熔火爐心',floorRange:[19,10],title:'熔岩的五拍心跳',
  bpm:126,metre:5,bars:20,room:'mediumHall',reverb:23,style:'五拍銅管戰鼓交響',colour:'#c98c66',
  signature:'低銅管、厚重鼓點與五拍步伐，像岩漿不停推動石閘。',
  description:'低號與長號形成厚重銅管，五拍重心讓腳步略帶不安；定音鼓像爐心壓力，圓號唱出堅定的短主題。比樓主戰慢、重，不直接複用決戰曲。',
  desks:[['trombone',-13,-.2],['tuba',-17,.16],['horn',-13,.28],['celli',-23,-.12]],
  sections:[['石閘承壓',0,4,'五拍鼓心與低銅管識別'],['火流交錯',4,10,'圓號主題越過重量'],['爐心翻湧',10,15,'長號回應、鼓點加深'],['不必燃盡',15,20,'主題回返而不變成快速戰鬥曲']]});
const fireRoots=[36,44,41,43,36,44,41,43,36,36];
bed(furnace,'celli',fireRoots.map(k=>[k]),10,60);
for(let bar=0;bar<20;bar++){
  const at=bar*5,key=fireRoots[Math.floor(bar/2)];note(furnace,'tuba',at,2.3,key,75);note(furnace,'tuba',at+3,1.7,key+7,64);
  for(const beat of [0,2,3.5])hit(furnace,'timpani',at+beat,beat===0?.065:.035,beat===0?65.41:87.31);
  if(bar>=10&&bar<15)hit(furnace,'snare',at+4,.019);
}
const fireCall=[[60,1.5],[63,1],[67,2.5],[65,1.5],[62,1],[60,2.5],[58,2],[59,1],[60,2]];
for(const at of [.2,20.2,75.2])line(furnace,'horn',at,fireCall,76,.08);
line(furnace,'trombone',50.2,[[55,2],[56,1],[58,2],[60,3],[59,2],[55,4]],80,.08);
hit(furnace,'cymbal',50,.022);hit(furnace,'cymbal',75,.015);

const heart=make({chapterId:'heart',regionName:'歸途塔心',floorRange:[9,1],title:'歸途的金色號角',
  bpm:84,metre:4,bars:16,room:'mediumHall',reverb:29,style:'號角合唱頌歌',colour:'#d5ba7d',
  signature:'明亮小號短主題，暖圓號與合唱承接；像接近出口時看見陽光。',
  description:'小號先唱出歸途記號，寬弦、圓號與合唱逐漸接住它。莊嚴又明亮，是探索的凱旋感，不是緊張的戰鬥進行曲。',
  desks:[['trumpet',-14,-.15],['horn',-17,.28],['choir',-24,.08],['violins',-24,-.30]],
  sections:[['看見歸途',0,4,'小號立即提出短主題'],['同行的聲音',4,10,'圓號、寬弦與合唱展開'],['門已不只一扇',10,16,'號角回返、明亮地收束']]});
const homeChords=[[50,54,57],[55,59,62],[47,54,57],[57,61,64],[52,55,59],[55,59,62],[57,61,64],[50,54,57]];
bed(heart,'choir',homeChords.map(c=>c.map(k=>k+12)),8,48);bed(heart,'violins',homeChords.map(c=>c.slice(1).map(k=>k+12)),8,46);
const returnCall=[[74,1],[78,1],[81,2],[79,1.5],[78,.5],[76,2],[74,3],[69,1]];
for(const at of [.12,40.12])line(heart,'trumpet',at,returnCall,70,.10);
line(heart,'horn',17,[[62,3],[66,2],[69,3],[71,2],[69,3],[66,3]],68,.15);
line(heart,'horn',54,[[64,2],[61,2],[62,5.5]],63,.12);
hit(heart,'cymbal',32,.010);hit(heart,'bell',48,.018,1174.66);

export const surfaceIdentityScores=[finish(roots),finish(library),finish(mist),finish(frost),finish(furnace),finish(heart)];
