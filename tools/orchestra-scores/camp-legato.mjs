// A flowing, quieter camp arrangement; no changes to the formal camp asset.
import {heldChords, phrase, smoothExpression} from './legato-support.mjs';
const harmony = [
  [38,57,62,66,69], [35,57,62,66,69], [43,55,62,64,67], [45,57,61,64,69],
  [40,55,59,62,67], [43,55,59,62,67], [45,57,61,64,69], [38,57,62,66,69]
];
const notes = [
  ...heldChords('celli', harmony.map(c => [c[0]]), {velocity:65,overlap:.35}),
  ...heldChords('violas', harmony.map(c => [c[1],c[2]]), {start:.06,end:64,velocity:64,overlap:.35}),
  ...heldChords('violins', harmony.map(c => [c[3],c[4]]), {start:.12,end:64,velocity:61,overlap:.35}),
  ...phrase('flute', .7, [[74,3.3],[69,2.3],[78,3.2],[76,2.2],[74,3.1]], 60, .18),
  ...phrase('flute', 16.5, [[76,3.0],[79,2.8],[78,2.5],[76,2.6],[73,3.8]], 59, .18),
  ...phrase('clarinet', 32.6, [[71,3.0],[74,3.2],[78,2.8],[76,2.5],[74,3.0]], 61, .18),
  ...phrase('flute', 48.4, [[74,3.0],[78,2.8],[76,2.4],[73,2.5],[74,4.4]], 57, .18),
  ...phrase('horn', 24.8, [[61,6.2]], 46),
  ...phrase('horn', 56.8, [[62,6.4]], 43)
];
const controls = ['violins','violas','celli'].flatMap(desk => smoothExpression(desk,
  [[0,87],[8,90],[16,91],[24,94],[32,89],[40,94],[48,92],[56,88],[64,80]]));
for (const desk of ['flute','horn','clarinet']) controls.push(...smoothExpression(desk,
  [[0,92],[16,95],[24,97],[32,94],[40,98],[48,92],[56,88],[64,80]]));
export default {
  id:'camp',revision:'legato-audition',title:'火光下的約定・連奏版',filename:'營地休息-火光下的約定-連奏版.mp3',
  bpm:78,beatsPerBar:4,bars:16,tail:4,reverb:26,
  description:'暖弦持續托住火光，長笛與單簧管以較長的樂句輪流接唱；減少短音、停頓與強起音，維持溫柔安穩的營地氣氛。',
  tonality:'D major; original D–A–F#–E theme, continuous common-tone strings',
  sections:[
    {name:'坐回火光',fromBar:0,toBar:4,description:'低弦連續鋪底，長笛延展原主題'},
    {name:'彼此照應',fromBar:4,toBar:8,description:'旋律不逐拍停頓，兩小節和聲緩緩流動'},
    {name:'今夜的故事',fromBar:8,toBar:12,description:'單簧管長句回答，弦樂不重新敲擊'},
    {name:'明天再出發',fromBar:12,toBar:16,description:'暖弦保持連接，尾聲自然放鬆'}
  ],
  desks:[{id:'violins',gain:-12,pan:-.30},{id:'violas',gain:-12,pan:-.12},{id:'celli',gain:-11,pan:.20},{id:'flute',gain:-20,pan:-.07},{id:'clarinet',gain:-20,pan:.10},{id:'horn',gain:-25,pan:.30}],
  notes:notes.sort((a,b)=>a.beat-b.beat||a.key-b.key),controls:controls.sort((a,b)=>a.beat-b.beat),
  percussion:[]
};
