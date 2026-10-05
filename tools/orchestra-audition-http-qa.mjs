// Finite allowlist and media-range check. The single rejected POST is local only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve(process.env.ORCHESTRA_QA_SOURCE||'.agent-run/all-region-identities-20261005-final');
const base=process.env.ORCHESTRA_QA_URL||'http://127.0.0.1:8798/';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));assert.ok(source.startsWith(resolve('.agent-run')+'/'));
const out=resolve(process.env.ORCHESTRA_QA_OUT||'.agent-run/all-region-identities-browser-qa');assert.ok(out.startsWith(resolve('.agent-run')+'/'));
const report={pass:false,localOnly:true,checks:[]},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=(name,options={})=>fetch(new URL(encodeURIComponent(name),base),{...options,signal:AbortSignal.timeout(10000)});
try{
  const exported=JSON.parse(await readFile(source+'/report.json','utf8'));assert.equal(exported.pass,true);
  for(const name of ['index.html',...exported.tracks.map(t=>t.filename)]){
    const original=await readFile(source+'/'+name),response=await request(name);assert.equal(response.status,200);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(original));
    const head=await request(name,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),original.length);assert.equal((await head.arrayBuffer()).byteLength,0);
    report.checks.push({name,status:200,sha256:sha(original),head:true});
  }
  const track=exported.tracks[0],original=await readFile(source+'/'+track.filename);
  const partial=await request(track.filename,{headers:{Range:'bytes=128-255'}});assert.equal(partial.status,206);
  assert.equal(partial.headers.get('content-range'),`bytes 128-255/${original.length}`);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),original.subarray(128,256));
  const invalid=await request(track.filename,{headers:{Range:'bytes='+original.length+'-'}});assert.equal(invalid.status,416);
  const write=await request('index.html',{method:'POST',body:'local-write-must-be-rejected'});assert.equal(write.status,405);
  for(const name of ['report.json',track.id+'-score.json',track.id+'-orchestra.wav',track.id+'-mix.wav','package.json','credentials.env'])assert.equal((await request(name)).status,404);
  report.range206=true;report.invalid416=true;report.write405=true;report.privateFiles404=true;report.pass=true;
}catch(error){report.failure=error.stack;throw error;}finally{await mkdir(out,{recursive:true});await writeFile(out+'/http-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,range206:report.range206,privateFiles404:report.privateFiles404,report:out+'/http-report.json'}));}
