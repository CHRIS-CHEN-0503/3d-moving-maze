#!/usr/bin/env node
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {mkdir,unlink,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require=createRequire(import.meta.url),pack=require('../assets/voice-pack.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.VOICEBOX_URL||'http://127.0.0.1:17493';
const force=process.argv.includes('--force');
if(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))throw new Error('為安全起見，只允許連接本機 Voicebox。');

async function request(route,options={}){
  const response=await fetch(base+route,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  if(!response.ok)throw new Error(`${route} 回應 ${response.status}：${(await response.text()).slice(0,500)}`);
  return response;
}
async function run(command,args){
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:'inherit'});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${command} 結束碼 ${code}`)));
  });
}
async function waitForGeneration(id){
  let previous='';
  for(let attempt=0;attempt<900;attempt++){
    const current=await (await request('/history/'+encodeURIComponent(id))).json(),status=current.status||'';
    if(status!==previous){console.log(`  ${status||'等待中'}`);previous=status;}
    if(status==='completed')return current;
    if(status==='failed')throw new Error(`語音生成失敗：${current.error||'未知原因'}`);
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw new Error('語音生成逾時。');
}
async function profile(){
  const profiles=await (await request('/profiles')).json();
  const found=profiles.find(item=>item.name==='迷宮旁白 Serena'&&item.voice_type==='preset'&&item.preset_engine==='qwen_custom_voice'&&item.preset_voice_id==='Serena');
  if(found)return found;
  return (await request('/profiles',{method:'POST',body:JSON.stringify({name:'迷宮旁白 Serena',description:'3D移動迷宮專用合成女聲；使用 Voicebox 內建 Serena，未複製真人聲音。',language:'zh',voice_type:'preset',preset_engine:'qwen_custom_voice',preset_voice_id:'Serena',default_engine:'qwen_custom_voice'})})).json();
}

await request('/health');
const voice=await profile(),entries=Object.entries(pack.tracks),outputDir=path.join(root,'assets','voice');
await mkdir(outputDir,{recursive:true});
for(let index=0;index<entries.length;index++){
  const [id,track]=entries[index],destination=path.join(root,track.src.replace(/^\.\//,''));
  if(!force&&existsSync(destination)){console.log(`略過 ${id}`);continue;}
  console.log(`生成 ${index+1}/${entries.length} ${id}`);
  const queued=await (await request('/generate',{method:'POST',body:JSON.stringify({profile_id:voice.id,text:track.text,language:'zh',engine:'qwen_custom_voice',model_size:'0.6B',seed:20260920+index,instruct:'溫暖、清楚、自然的女聲，像為兒童講冒險故事；咬字清晰，速度稍慢，不誇張。',normalize:true})})).json();
  const generation=await waitForGeneration(queued.id);
  const wav=path.join(outputDir,'.'+path.basename(destination,'.mp3')+'.wav');
  const audio=await request('/audio/'+encodeURIComponent(generation.id),{headers:{}});
  await writeFile(wav,Buffer.from(await audio.arrayBuffer()));
  try{await run('ffmpeg',['-nostdin','-loglevel','error','-y','-i',wav,'-ac','1','-ar','24000','-b:a','64k',destination]);}
  finally{await unlink(wav).catch(()=>{});}
}
console.log(`完成 ${entries.length} 段專用語音。`);
