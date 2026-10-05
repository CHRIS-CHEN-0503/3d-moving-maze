// Read-only comparison of the committed allowlist export with both Pages URLs.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [directory,fixedURL,sourceSHA,outPath]=process.argv.slice(2),source=resolve(directory);
assert.match(sourceSHA,/^[a-f0-9]{40}$/);assert.match(fixedURL,/^https:\/\/[a-f0-9]{8}\.3d-moving-maze\.pages\.dev\/$/);
const roots=(await readdir(source)).filter(f=>f!=='.wrangler').sort();
assert.deepEqual(roots,['assets','docs','functions','index.html','lib','manifest.webmanifest','package.json','story','wrangler.toml'].sort());
const manifest=JSON.parse(await readFile(join(source,'assets/music/orchestra-manifest.json'),'utf8'));
assert.equal(manifest.tracks.length,17);
const names=['index.html','package.json','manifest.webmanifest','story/tower-audio.js','story/tower-mode.js','assets/audio-settings.js','docs/職業裝備圖鑑.html','assets/music/orchestra-manifest.json',...manifest.tracks.map(t=>t.file),'assets/music/combat.m4a'];
assert.equal(new Set(names).size,names.length);
const hash=b=>createHash('sha256').update(b).digest('hex'),version=JSON.parse(await readFile(join(source,'package.json'),'utf8')).version;
assert.equal(version,'1.57.9');
const report={pass:false,version,sourceSHA,source,roots,files:[],services:[],readOnly:true};
await mkdir(resolve(outPath),{recursive:true});
try{
  for(const base of [fixedURL,'https://3d-moving-maze.pages.dev/']){
    for(const name of names){
      const expected=await readFile(join(source,name)),url=new URL(name,base);url.searchParams.set('release',sourceSHA);
      const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
      assert.equal(response.status,200,name);const bytes=Buffer.from(await response.arrayBuffer());
      assert.equal(hash(bytes),hash(expected),base+name);assert.equal(bytes.length,expected.length);
      report.files.push({base,path:name,status:response.status,bytes:bytes.length,sha256:hash(bytes)});
    }
    for(const name of ['api/runtime-config','api/scores']){
      const response=await fetch(new URL(name,base),{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
      assert.equal(response.status,200);const data=await response.json();
      assert.ok(name.endsWith('scores')?Array.isArray(data):data&&typeof data==='object'&&!Array.isArray(data));
      report.services.push({base,path:name,status:response.status,jsonValid:true});
    }
  }
  report.pass=true;
}catch(error){report.failure=error.stack;throw error;}finally{
  await writeFile(join(resolve(outPath),'readback.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:report.pass,version,sourceSHA,files:report.files.length,services:report.services,failure:report.failure}));
}
