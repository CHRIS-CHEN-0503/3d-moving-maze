// Managed, loopback-only audition server. The allowlist contains only the
// generated page and complete audition MP3s, never the repository or samples.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

export function byteRange(header,size){
  if(!header)return {start:0,end:size-1,partial:false};
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||!size||(!match[1]&&!match[2]))return null;
  let start,end;
  if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
  else {start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
  return {start,end:Math.min(size-1,end),partial:true};
}
async function main(){
  const source=await realpath(resolve(process.argv[2]||'.agent-run/legato-orchestra-previews-20261005'));
  assert.ok(source.startsWith((await realpath('.agent-run'))+'/'));
  const port=Number(process.argv[3]||8798);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
  const report=JSON.parse(await readFile(source+'/report.json','utf8'));
  assert.equal(report.pass,true);assert.equal(report.officialMusicChanged,false);assert.ok(report.tracks.length>=1&&report.tracks.length<=16);
  const names=['index.html',...report.tracks.map(t=>t.filename)],files=new Map();
  for(const name of names){assert.equal(basename(name),name);assert.ok(name==='index.html'||name.endsWith('.mp3'));
    const path=await realpath(source+'/'+name);assert.ok(path.startsWith(source+'/'));
    files.set('/'+name,{bytes:await readFile(path),type:name==='index.html'?'text/html; charset=utf-8':'audio/mpeg'});
  }
  const server=createServer((request,response)=>{
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'});response.end();return;}
    let path;try{path=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400);response.end();return;}
    const file=files.get(path==='/'?'/index.html':path);
    if(!file){response.writeHead(404);response.end();return;}
    const range=byteRange(request.headers.range,file.bytes.length);
    if(!range){response.writeHead(416,{'Content-Range':'bytes */'+file.bytes.length});response.end();return;}
    const headers={'Content-Type':file.type,'Content-Length':range.end-range.start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(range.partial)headers['Content-Range']=`bytes ${range.start}-${range.end}/${file.bytes.length}`;
    response.writeHead(range.partial?206:200,headers);response.end(request.method==='HEAD'?undefined:file.bytes.subarray(range.start,range.end+1));
  });
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Local audition ready on 127.0.0.1:'+port+'; '+names.length+' allowlisted files; GET/HEAD only'));
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>{}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
