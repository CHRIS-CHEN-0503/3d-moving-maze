import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{tracks}=require('../story/tower-floor-lords.js');
await mkdir('.agent-run',{recursive:true});
await writeFile('.agent-run/lord-voice-manifest.json',JSON.stringify(tracks,null,2)+'\n');
console.log('建立 '+Object.keys(tracks).length+' 段樓層主原創台詞清單。');
