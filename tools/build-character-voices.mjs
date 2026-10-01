import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{tracks}=require('../assets/character-voices.js');
const selected=process.argv[2]?.split(',').filter(Boolean),chosen=selected?Object.fromEntries(selected.map(id=>{if(!Object.hasOwn(tracks,id))throw Error('Unknown character line: '+id);return [id,tracks[id]];})):tracks;
const output=selected?'.agent-run/character-voice-retry.json':'.agent-run/character-voice-manifest.json';
await mkdir('.agent-run',{recursive:true});
await writeFile(output,JSON.stringify(chosen,null,2)+'\n');
console.log('建立 '+Object.keys(chosen).length+' 段七職業男女配音清單。');
