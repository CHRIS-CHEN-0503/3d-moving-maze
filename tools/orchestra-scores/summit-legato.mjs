// Separate audition revision: the previously approved/formal score stays intact.
import {heldChords, phrase, smoothExpression} from './legato-support.mjs';
const harmony = [
  [50,57,60,64,69], [46,53,57,62,65], [41,53,57,60,67], [45,52,57,62,64],
  [50,57,61,66,69], [43,54,57,62,69], [45,52,59,61,64], [38,50,57,61,66]
];
const notes = [
  ...heldChords('celli', harmony.map(c => [c[0]]), {velocity:67}),
  ...heldChords('violas', harmony.map(c => [c[1],c[2]]), {start:.06,end:64,velocity:63}),
  ...heldChords('violins', harmony.map(c => [c[3]+12,c[4]+12]), {start:.12,end:64,velocity:62}),
  ...phrase('flute', .6, [[74,3.1],[76,2],[77,3.1],[79,2.2],[76,2],[74,2.3]], 59),
  ...phrase('flute', 16.2, [[77,3],[79,2],[81,2.4],[79,2.5],[77,2.3],[73,3]], 61),
  ...phrase('flute', 32.2, [[78,3],[81,2.7],[83,3.3],[81,2],[79,1.7],[78,2]], 64),
  ...phrase('flute', 48.2, [[78,2.5],[76,2],[74,3.5],[73,2],[76,1.5],[74,3.5]], 60),
  ...phrase('horn', 17, [[57,6.9],[60,7.0]], 53, .24),
  ...phrase('horn', 33, [[61,6.9],[62,7.0]], 57, .24),
  ...phrase('clarinet', 8.8, [[65,3.4],[62,3.2]], 51),
  ...phrase('clarinet', 48.7, [[66,6],[64,4],[61,4]], 50)
];
const controls = ['violins','violas','celli'].flatMap(desk => smoothExpression(desk,
  [[0,86],[8,91],[16,90],[24,95],[32,98],[40,103],[48,99],[56,94],[64,82]]));
for (const desk of ['flute','horn','clarinet']) controls.push(...smoothExpression(desk,
  [[0,91],[16,95],[32,100],[40,103],[48,97],[56,93],[64,83]]));
export default {
  id:'summit', revision:'legato-audition', title:'雲海與回聲・連奏版', filename:'雲頂探索-雲海與回聲-連奏版.mp3',
  bpm:76,beatsPerBar:4,bars:16,tail:4,reverb:28,
  description:'連續長弓弦樂承接雲海，旋律以完整樂句接唱；和聲每兩小節緩緩推進，共同音不重新起音，從神秘走向溫暖壯麗。',
  tonality:'D minor → D major; original D–A–F/E motif, continuous two-bar harmony',
  sections:[
    {name:'雲海流動',fromBar:0,toBar:4,description:'連續的低弦與長笛，不逐拍切斷'},
    {name:'遠方回聲',fromBar:4,toBar:8,description:'圓號以長句回答，共同音延續'},
    {name:'光穿雲層',fromBar:8,toBar:12,description:'大調展開，以樂句而非每小節起伏'},
    {name:'通往未知',fromBar:12,toBar:16,description:'旋律緩緩收束，弦樂保持承接'}
  ],
  desks:[{id:'violins',gain:-9,pan:-.30},{id:'violas',gain:-12,pan:.25},{id:'celli',gain:-11,pan:.10},{id:'flute',gain:-20,pan:-.10},{id:'horn',gain:-21,pan:.20},{id:'clarinet',gain:-22,pan:-.20}],
  notes:notes.sort((a,b)=>a.beat-b.beat||a.key-b.key),controls:controls.sort((a,b)=>a.beat-b.beat),
  percussion:[]
};
