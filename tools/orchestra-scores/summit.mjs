// Original melody and orchestration; local listening preview, not a game asset.
const notes=[],controls=[],percussion=[];
const note=(desk,beat,length,key,velocity)=>notes.push({desk,beat,length,key,velocity});
const harmony=[
  [50,57,60,64,69],[46,53,57,62,65],[41,53,57,60,67],[48,55,60,62,67],
  [43,50,57,58,65],[46,53,57,62,65],[45,53,57,60,64],[45,52,57,61,64],
  [50,57,61,66,69],[43,54,57,62,69],[40,55,59,62,66],[45,52,57,62,64],
  [47,54,57,62,66],[43,54,57,62,69],[45,52,59,61,64],[38,50,57,61,66]
];
const melody=[
  [[.4,1.4,74],[2.2,1.25,76]],[[0,2.35,77],[2.7,.75,74]],
  [[.25,1.45,72],[2,1.4,79]],[[.15,1.3,76],[1.9,1.55,74]],
  [[.2,1.3,77],[1.8,.7,79],[2.65,.9,81]],[[0,2.15,77],[2.55,1.0,74]],
  [[.2,1.3,76],[1.85,1.45,77]],[[.2,1.15,76],[1.8,1.55,73]],
  [[.1,1.4,78],[1.9,1.5,81]],[[0,2.1,83],[2.55,1.0,81]],
  [[.2,1.25,79],[1.85,1.35,78]],[[.15,1.2,76],[1.75,1.4,74]],
  [[.15,1.35,78],[1.85,.7,81],[2.8,.7,83]],[[0,1.6,81],[2.0,1.3,79]],
  [[.15,1.15,76],[1.65,.85,73],[2.75,.85,76]],[[.15,3.55,74]]
];
for(let bar=0;bar<16;bar++){
  const t=bar*4,c=harmony[bar],energy=bar<4?0:bar<8?7:bar<12?14:10;
  note('celli',t,3.88,c[0],46+energy);
  note('violas',t+.065,3.79,c[1],40+energy);note('violas',t+.09,3.74,c[2],38+energy);
  note('violins',t+.09,3.76,c[3]+12,39+energy);note('violins',t+.13,3.70,c[4]+12,35+energy);
  for(const [at,len,key]of melody[bar])note('flute',t+at,len,key,60+(bar>=8?8:0));
  if(bar>=4){note('horn',t+.25,3.25,c[2],bar>=8?63:48);if(bar>=8&&bar<14)note('horn',t+.28,3.17,c[3],51);}
  if(bar%2===1&&bar<8)note('clarinet',t+2.35,1.4,c[2]+12,50);
  if(bar>=10&&bar<15){note('clarinet',t+.25,1.35,c[1]+12,46);note('clarinet',t+2.5,1.1,c[2]+12,48);}
  for(const desk of ['violins','violas','celli','horn'])for(let step=0;step<=8;step++){
    const p=step/8;controls.push({desk,beat:t+p*3.9,controller:11,value:Math.round(66+energy+Math.sin(p*Math.PI)*17)});
  }
  if([0,4,8,12].includes(bar))percussion.push({type:'bell',beat:t+.18,gain:.017,pitch:bar<8?587.33:880});
}
export default {
  id:'summit',title:'雲海與回聲',filename:'雲頂探索-雲海與回聲.mp3',bpm:76,beatsPerBar:4,bars:16,tail:4,reverb:25,
  description:'薄霧中的召喚台、遠山與未知道路；木管提出問題，弦樂與圓號逐漸回答，最後留下溫暖而未完的希望。',
  tonality:'D minor → D major, shared original D–A–F/E motif',
  sections:[
    {name:'霧中醒來',fromBar:0,toBar:4,description:'輕弦與長笛，保持探索空間'},
    {name:'回聲呼喚',fromBar:4,toBar:8,description:'圓號低聲加入，單簧管回答'},
    {name:'雲海展開',fromBar:8,toBar:12,description:'轉向大調、弦樂抬升，展現溫暖壯麗'},
    {name:'走向未知',fromBar:12,toBar:16,description:'旋律收束，留出自然廳堂尾響'}
  ],
  desks:[{id:'violins',gain:-13,pan:-.36},{id:'violas',gain:-17,pan:.29},{id:'celli',gain:-13,pan:.13},{id:'flute',gain:-14,pan:-.12},{id:'horn',gain:-18,pan:.22},{id:'clarinet',gain:-20,pan:-.24}],
  notes,controls,percussion
};
