// Three contrasting original audition prototypes. No common melody template,
// no common six-desk string bed, and no modification of approved recordings.
import {heldChords,phrase,smoothExpression} from './legato-support.mjs';

function finish(score){
  const end=score.bars*score.beatsPerBar;
  score.controls=score.desks.flatMap(d=>smoothExpression(d.id,[[0,91],[end*.34,96],[end*.66,104],[end,87]],1/32));
  score.notes.sort((a,b)=>a.beat-b.beat||a.key-b.key);
  return score;
}
function note(score,desk,beat,length,key,velocity){score.notes.push({desk,beat,length,key,velocity});}
function melody(score,desk,at,events,velocity,overlap=0){score.notes.push(...phrase(desk,at,events,velocity,overlap));}

const garden={
  id:'garden-identity',revision:'identity-audition',chapterId:'garden',regionName:'空中庭園',floorRange:[89,80],
  title:'花與風的圓舞曲',filename:'空中庭園-花與風的圓舞曲-辨識版.mp3',
  bpm:104,beatsPerBar:3,bars:28,tail:4,reverb:22,roomPreset:'mediumHall',
  style:'豎琴圓舞曲',signature:'從開頭就是流動豎琴、輕撥低音與三拍舞步；長笛唱出花園主題。',
  description:'輕盈明亮的三拍圓舞曲。豎琴流水、撥弦伴奏與長笛輪唱，像風吹花園；弦樂只是淡淡襯底，不再以厚弦樂開場。',
  desks:[{id:'harp',gain:-10,pan:-.24},{id:'pizzicato',gain:-20,pan:.24},{id:'flute',gain:-13,pan:.10},{id:'violas',gain:-28,pan:-.04}],
  notes:[],controls:[],percussion:[],
  sections:[{name:'花園的三拍舞步',fromBar:0,toBar:8,description:'豎琴立即呈現主奏，長笛接唱辨識主題'},
    {name:'枝葉轉身',fromBar:8,toBar:16,description:'長笛第二樂句與豎琴流動相接'},
    {name:'陽光穿過花棚',fromBar:16,toBar:22,description:'和聲短暫轉亮，主奏在高處展開'},
    {name:'風又回來',fromBar:22,toBar:28,description:'同一花園主題回返，留下柔和尾響'}]
};
const gardenChords=[[55,59,62,67],[52,55,59,64],[48,55,60,64],[50,57,62,66],
  [55,59,62,67],[57,60,64,69],[50,57,62,66],[55,59,62,67],
  [48,55,60,64],[52,55,59,67],[57,61,64,69],[50,57,62,66],[55,59,62,67],[55,59,62,67]];
garden.notes.push(...heldChords('violas',gardenChords.map(c=>[c[1],c[2]]),{beats:6,start:0,end:84,velocity:37,overlap:.12}));
for(let bar=0;bar<28;bar++){
  const chord=gardenChords[Math.floor(bar/2)],at=bar*3;
  for(let tick=0;tick<6;tick++)note(garden,'harp',at+tick*.5,.46,chord[[0,1,2,3,2,1][tick]]+12,bar%4===3?58:63);
  note(garden,'pizzicato',at+.015,.65,chord[0]-12,53);
  for(const beat of [1,2])for(const key of [chord[1],chord[2]])note(garden,'pizzicato',at+beat+.015,.42,key,40);
}
const flowerTheme=[[79,1],[81,.5],[83,1.5],[86,1.5],[84,.5],[83,1],[81,1.5],[79,1.5],[78,1],[79,2]];
melody(garden,'flute',.6,flowerTheme,69,.08);
melody(garden,'flute',25,[[83,1.5],[81,.5],[79,1],[76,1.5],[79,1.5],[81,1],[84,2],[83,2],[81,1.5],[79,2]],65,.08);
melody(garden,'flute',49,[[84,1.5],[86,1],[88,1.5],[86,2],[83,1.5],[81,1.5],[78,2],[81,2],[79,2]],68,.08);
melody(garden,'flute',67,flowerTheme,67,.08);

const echo={
  id:'echo-identity',revision:'identity-audition',chapterId:'echo',regionName:'回聲水晶窟',floorRange:[69,60],
  title:'晶穹之下',filename:'回聲水晶窟-晶穹之下-辨識版.mp3',
  bpm:70,beatsPerBar:4,bars:14,tail:4,reverb:43,roomPreset:'cathedral',
  style:'晶音氛圍樂',signature:'孤立而清亮的三音晶光，遼闊回音、不規則回應，沒有鼓點或三拍舞步。',
  description:'鋼片琴與顫音琴像不同高度的水晶互相共鳴。節奏自由、回音寬闊，弦樂很薄、木管很遠；不是另一首木管弦樂小夜曲。',
  desks:[{id:'celesta',gain:-9,pan:-.38},{id:'vibraphone',gain:-15,pan:.40},{id:'violins',gain:-28,pan:.12},{id:'flute',gain:-28,pan:-.15}],
  notes:[],controls:[],percussion:[],
  sections:[{name:'一束晶光',fromBar:0,toBar:4,description:'三音識別句與不規則的低晶音回應'},
    {name:'洞頂逐漸展開',fromBar:4,toBar:9,description:'晶音延展，薄弦與遠方氣息浮現'},
    {name:'光在另一面回答',fromBar:9,toBar:14,description:'識別句從另一音域回返，保留遼闊回響'}]
};
// Irregular, deliberate phrase spacing; not a metronomic bell on every beat.
for(const [at,key,length,velocity]of [[.15,90,1.8,71],[2.0,85,2.7,66],[5.4,80,3.1,61],
  [10.9,87,2.1,58],[13.8,92,1.5,63],[17.3,85,3.2,58],
  [22.1,94,2.5,68],[25.7,90,2.4,64],[29.0,87,3.7,61],
  [35.2,90,1.8,72],[37.05,85,2.7,66],[40.45,80,3.1,62],
  [46.0,87,2.5,63],[49.1,85,3.5,58],[53.0,90,2.6,55]])note(echo,'celesta',at,length,key,velocity);
for(const [at,key,length]of [[1.15,66,5.8],[8.0,73,6.2],[16.5,68,6.8],[24.2,75,5.8],[32.6,70,5.6],[41.1,73,6.3],[48.9,66,6.8]])note(echo,'vibraphone',at,length,key,49);
echo.notes.push(...heldChords('violins',[[78,85],[80,87],[82,89],[78,85]],{beats:14,start:0,end:56,velocity:27,overlap:.28}));
melody(echo,'flute',18.2,[[90,4.8],[87,4.0],[85,5.5]],37,.15);
melody(echo,'flute',42.7,[[87,4.8],[85,5.8]],34,.15);

const clockwork={
  id:'clockwork-identity',revision:'identity-audition',chapterId:'clockwork',regionName:'齒輪工坊',floorRange:[29,20],
  title:'齒輪匠的奇想',filename:'齒輪工坊-齒輪匠的奇想-辨識版.mp3',
  bpm:128,beatsPerBar:4,bars:26,tail:4,reverb:12,roomPreset:'smallRoom',
  style:'機械撥弦進行曲',signature:'大鍵琴、撥弦低音與低音管的短句，三加三加二重音像不同大小的齒輪交接。',
  description:'帶一點古怪與冒險感的機械進行曲。大鍵琴與撥弦密集咬合，低音管唱出工坊識別句；小空間、乾脆節奏，不使用長弦樂鋪底。',
  desks:[{id:'harpsichord',gain:-16,pan:-.28},{id:'pizzicato',gain:-15,pan:.20},{id:'bassoon',gain:-10,pan:-.05},{id:'clarinet',gain:-18,pan:.26}],
  notes:[],controls:[],percussion:[],
  sections:[{name:'啟動齒輪',fromBar:0,toBar:4,description:'大鍵琴與低音管立即建立機械識別句'},
    {name:'大小齒輪交接',fromBar:4,toBar:12,description:'三加三加二重音與撥弦前進'},
    {name:'反轉一次',fromBar:12,toBar:16,description:'伴奏減半，木管單獨轉出新方向'},
    {name:'全部運轉',fromBar:16,toBar:22,description:'主題回歸、雙木管與低弦撥奏交接'},
    {name:'合上最後齒序',fromBar:22,toBar:26,description:'辨識句再次出現，乾脆而不生硬地收束'}]
};
const gearChords=[[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,55,59],
  [48,55,60,63],[46,53,58,62],[43,50,55,59],[48,55,60,63],
  [44,51,56,60],[41,48,53,56],[43,50,55,59],[48,55,60,63],[48,55,60,63]];
for(let bar=0;bar<26;bar++){
  const at=bar*4,chord=gearChords[Math.floor(bar/2)],reduced=bar>=12&&bar<16;
  for(let tick=0;tick<8;tick++){
    if(reduced&&tick%2)continue;
    const accent=[0,3,6].includes(tick);
    note(clockwork,'harpsichord',at+tick*.5,.28,chord[[1,3,2,1,2,3,1,2][tick]]+12,accent?76:55);
    clockwork.percussion.push({type:'shaker',beat:at+tick*.5+.04,gain:accent?.014:.005});
  }
  for(const [beat,step]of [[0,0],[1.5,1],[3,0]])note(clockwork,'pizzicato',at+beat,.38,chord[step]-12,beat===0?73:63);
  if(!reduced)clockwork.percussion.push({type:'tom',beat:at,pitch:110,gain:.018});
}
const gearTheme=[[48,.5],[55,.5],[51,.75],[50,.25],[53,.5],[48,1],[55,.5],[58,.5],[55,.75],[53,.25],[50,.5],[48,1]];
for(const at of [.15,16.15,32.15,64.15,88.15])melody(clockwork,'bassoon',at,gearTheme,84);
melody(clockwork,'clarinet',48.15,[[75,.5],[72,.5],[70,.75],[68,.25],[67,.5],[65,1],[67,.5],[70,.5],[72,.5],[74,.5],[71,.5],[67,1]],69);
melody(clockwork,'clarinet',72.15,[[75,.75],[74,.25],[72,.5],[70,.5],[72,1],[74,.5],[75,.5],[79,.5],[77,.5],[75,.5],[74,.5],[71,1]],71);

export const identityScores=[finish(garden),finish(echo),finish(clockwork)];
