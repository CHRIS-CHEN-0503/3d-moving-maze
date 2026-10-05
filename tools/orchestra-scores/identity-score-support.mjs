// Timing helpers only. Each region authors its own instruments, form and score.
import assert from 'node:assert/strict';
import {heldChords,phrase,smoothExpression} from './legato-support.mjs';
export function createIdentity({chapterId,regionName,floorRange,title,bpm,metre,bars,room,reverb,style,signature,description,desks,sections,colour}){
  return {id:chapterId.replace(':','-')+'-identity',revision:'identity-audition',chapterId,regionName,floorRange,title,
    filename:regionName+'-'+title+'-辨識版.mp3',bpm,beatsPerBar:metre,bars,tail:4,roomPreset:room,reverb,style,signature,description,colour,
    desks:desks.map(([id,gain,pan])=>({id,gain,pan})),notes:[],controls:[],percussion:[],
    sections:sections.map(([name,fromBar,toBar,description])=>({name,fromBar,toBar,description}))};
}
export function note(s,desk,beat,length,key,velocity=60){assert.ok(beat>=0&&length>0&&beat+length<=s.bars*s.beatsPerBar+.001);s.notes.push({desk,beat,length,key,velocity});}
export function line(s,desk,at,events,velocity=60,overlap=0){const notes=phrase(desk,at,events,velocity,overlap);assert.ok(notes.every(n=>n.beat+n.length<=s.bars*s.beatsPerBar+.001));s.notes.push(...notes);}
export function bed(s,desk,chords,beats,velocity=40,start=0){s.notes.push(...heldChords(desk,chords,{beats,start,end:s.bars*s.beatsPerBar,velocity,overlap:.18}));}
export function hit(s,type,beat,gain,pitch){s.percussion.push({type,beat,gain,...(pitch===undefined?{}:{pitch})});}
export function finish(s,anchors){
  const end=s.bars*s.beatsPerBar;
  s.controls=s.desks.flatMap(d=>smoothExpression(d.id,anchors||[[0,86],[end*.25,95],[end*.70,102],[end,86]],1/32));
  s.notes.sort((a,b)=>a.beat-b.beat||a.key-b.key);return s;
}
