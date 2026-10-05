// Release only the fourteen accepted complete arrangements, not loose samples.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {allIdentityScores,validateAllIdentities} from './render-all-region-identity-previews.mjs';
import {foldTail} from './finalize-scene-orchestral-music.mjs';
import {analyse,parseLoudness} from './render-scene-orchestral-previews.mjs';

export const APPROVED_REGION_HASHES=Object.freeze({
  garden:'747341ef0b27f3be992a70311bab6d5e0d0a5f0823bb7f9b6cb2a3121618ba20',
  roots:'2d2b5b6d3c30f131c7b5ac3bb81bf9936d7e711963196a984ed32b2e6f9f0fec',
  echo:'6bbd6271db7b56c0140e13eb2d84800943c76ce04555b34ceab4c5f60d95e6f0',
  library:'5698aaf00a2336d6536b8646c47d08592864d37e444467a930be67c5f9188969',
  mist:'7445ff5355f94f639f10fc2950084b7b3596b86ad2ee593103ecb597ef06e4ce',
  frost:'cb9d74427f60164c8a0487ecbd7ff0cc206b118377aea3ccbdfad285d79d595b',
  clockwork:'9560d707f6649b7ac2394a7da73d730579b1d2436e4287f58ecfdf600a6560d0',
  furnace:'65f850ab2006ff9781138eb223a3734a7918bd014aefe7531fad6c02dbeb2dcf',
  heart:'08828cad0cd2484edcf83f441dd8619c4a30843ec957f29ab683fe36dc89e4cd',
  'underworld-roots':'7fef6e30164cbc3d8b1da57c5eafc6431aeb4c93968ca29921d0b7c6bcb802b2',
  'underworld-mist':'368391a41c5b96bd267411603e317ca0657735e203d3ad38680e85445eb71765',
  'underworld-library':'9638ceaf327503dc13ecf0e523de49b3503f50556d6373282099ea09fd6595fc',
  'underworld-furnace':'a5b256c0e184a90b0eae588e78cfc39ce263b80c0fe915508548a9baf2c5069a',
  'underworld-heart':'1a6745c9c2481cd33dbd32f9718ca231bd19f1b7f5b1b9dbd52da5f60bcbb30a',
});
export function loopFrames(score){
  assert.ok(Number.isInteger(score.bars)&&score.bars>0);assert.ok([3,4,5,6].includes(score.beatsPerBar));
  assert.ok(Number.isFinite(score.bpm)&&score.bpm>=60&&score.bpm<=160);
  return Math.round(score.bars*score.beatsPerBar*60/score.bpm*44100);
}
export function appendRegionTracks(manifest,tracks){
  assert.deepEqual(manifest.tracks.map(t=>t.id),['summit','boss','camp']);
  assert.deepEqual(tracks.map(t=>t.id),Object.keys(APPROVED_REGION_HASHES));
  assert.equal(new Set([...manifest.tracks,...tracks].map(t=>t.id)).size,17);
  return {...structuredClone(manifest),tracks:[...structuredClone(manifest.tracks),...structuredClone(tracks)]};
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),ffmpeg='/opt/homebrew/bin/ffmpeg';
function command(args,binary=false){const r=spawnSync(ffmpeg,args,{encoding:binary?null:'utf8',timeout:60000,maxBuffer:70*1024*1024});if(r.error||r.status!==0)throw Error(String(r.error||r.stderr||r.status));return r.stdout;}
function meter(file){const r=spawnSync(ffmpeg,['-hide_banner','-nostdin','-i',file,'-af','loudnorm=I=-18:TP=-2:LRA=10:print_format=json','-f','null','-'],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});assert.equal(r.status,0,String(r.error||r.stderr));return parseLoudness(r.stderr);}
function mastering(levels){parseLoudness(JSON.stringify(levels));return `loudnorm=I=-18:TP=-2:LRA=10:measured_I=${levels.input_i}:measured_TP=${levels.input_tp}:measured_LRA=${levels.input_lra}:measured_thresh=${levels.input_thresh}:offset=${levels.target_offset}:linear=true`;}
function wav(pcm){const b=Buffer.alloc(44+pcm.length);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(2,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(352800,28);b.writeUInt16LE(8,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);pcm.copy(b,44);return b;}
async function main(){
  validateAllIdentities();const source=resolve('.agent-run/all-region-identities-20261005-final'),accepted=resolve('.agent-run/region-identity-previews-20261005');
  const out=resolve(process.argv[2]||'.agent-run/orchestra-region-assets-v1579');assert.ok(out.startsWith(resolve('.agent-run')+'/'));
  try{await access(out+'/report.json');throw Error('Preserve existing export evidence; select a new output directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(out,{recursive:true});
  const report={pass:false,tracks:[],verifiedAuditions:[],officialSamplesRedistributed:false};
  const originalBytes=await readFile('assets/music/orchestra-manifest.json'),previous=JSON.parse(originalBytes),audition=JSON.parse(await readFile(source+'/report.json','utf8'));
  assert.equal(audition.pass,true);assert.equal(audition.tracks.length,14);
  const protectedFiles=['assets/music/orchestra-summit.m4a','assets/music/orchestra-boss.m4a','assets/music/orchestra-camp.m4a','assets/music/combat.m4a'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(protectedFiles.map(async f=>[f,sha(await readFile(f))])));
  report.retainedBefore=await snapshot();
  const sourcePaths=['index.html','report.json',...audition.tracks.map(t=>t.filename)],snapSources=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async f=>[f,sha(await readFile(source+'/'+f))])));
  report.auditionsBefore=await snapSources();
  try{
    // Prove every mix reproduces the exact accepted audition before touching public assets.
    for(const score of allIdentityScores){
      const id=score.chapterId.replace(':','-'),row=audition.tracks.find(t=>t.id===score.id),folder=row.acceptedRecording?accepted:source;
      assert.equal(row.sha256,APPROVED_REGION_HASHES[id]);assert.equal(sha(await readFile(source+'/'+row.filename)),row.sha256);
      const scoreBytes=await readFile(folder+'/'+score.id+'-score.json');assert.equal(sha(scoreBytes),row.scoreSha256);assert.deepEqual(JSON.parse(scoreBytes),score);
      const mix=folder+'/'+score.id+'-mix.wav',verify=out+'/'+id+'-accepted-verification.mp3';
      command(['-v','error','-nostdin','-y','-i',mix,'-af',mastering(row.mastering.preMasterMeasurement),'-ar','44100','-codec:a','libmp3lame','-b:a','192k',verify]);
      assert.equal(sha(await readFile(verify)),row.sha256,'mix must reproduce the accepted recording');
      report.verifiedAuditions.push({id,sha256:row.sha256,scoreSha256:row.scoreSha256,mixSha256:sha(await readFile(mix))});
      console.log('Approved source verified: '+id);
    }
    for(const score of allIdentityScores){
      const id=score.chapterId.replace(':','-'),row=audition.tracks.find(t=>t.id===score.id),folder=row.acceptedRecording?accepted:source;
      const pcm=command(['-v','error','-nostdin','-i',folder+'/'+score.id+'-mix.wav','-f','f32le','-ac','2','-ar','44100','pipe:1'],true),frames=loopFrames(score),loop=foldTail(pcm,frames);
      const guardFrames=Math.round(.003*44100);
      for(let i=0;i<guardFrames;i++)for(let c=0;c<2;c++)for(const frame of [i,frames-1-i]){const offset=frame*8+c*4;loop.writeFloatLE(loop.readFloatLE(offset)*Math.sin(i/guardFrames*Math.PI/2)**2,offset);}
      assert.ok(analyse(loop).peak<.98);const loopPath=out+'/'+id+'-loop.wav';await writeFile(loopPath,wav(loop));
      const levels=meter(loopPath),filename='orchestra-'+id+'.m4a',final=out+'/'+filename;
      command(['-v','error','-nostdin','-y','-i',loopPath,'-af',mastering(levels),'-ar','44100','-ac','2','-c:a','aac','-b:a','128k','-movflags','+faststart',final]);
      const bytes=await readFile(final),decoded=command(['-v','error','-nostdin','-i',final,'-f','f32le','-ac','2','-ar','44100','pipe:1'],true),signal=analyse(decoded),loudness=meter(final);
      assert.ok(signal.frames>=frames&&signal.frames-frames<=2048);assert.ok(signal.peak>.1&&signal.peak<.90);assert.ok(signal.rms>.04&&signal.rms<.22);assert.ok(Math.abs(signal.mean)<.005);
      assert.ok(signal.stereoCorrelation<.9999);assert.ok(Math.abs(Number(loudness.input_i)+18)<=.6);assert.ok(Number(loudness.input_tp)<=-1.5);
      let seamDelta=0;for(let c=0;c<2;c++)seamDelta=Math.max(seamDelta,Math.abs(decoded.readFloatLE(c*4)-decoded.readFloatLE((frames-1)*8+c*4)));
      assert.ok(seamDelta<.015,'encoded loop boundary retains small waveform steps');assert.ok(signal.halfSecondRms.at(-2)>.003,'do not loop the silent audition tail');
      const track={id,title:score.title,regionName:score.regionName,floorRange:score.floorRange,file:'assets/music/'+filename,bpm:score.bpm,bars:score.bars,beatsPerBar:score.beatsPerBar,sampleRate:44100,channels:2,frames,loopStart:0,loopEnd:frames/44100,bytes:bytes.length,sha256:sha(bytes),integratedLoudness:Number(loudness.input_i),truePeakDb:Number(loudness.input_tp),seamDelta};
      report.tracks.push(track);await writeFile(out+'/'+id+'-report.json',JSON.stringify({track,signal,loudness,originalAuditionSha256:row.sha256,loopMethod:'Natural release folded into a whole-bar loop; three-millisecond endpoint guard, no four-second fade loop'},null,2));
      console.log('Game loop verified: '+id+' '+track.loopEnd.toFixed(2)+'s');
    }
    const manifest=appendRegionTracks(previous,report.tracks);assert.ok(manifest.tracks.reduce((sum,t)=>sum+t.bytes,0)<16*1024*1024);
    report.retainedAfter=await snapshot();assert.deepEqual(report.retainedAfter,report.retainedBefore);
    report.auditionsAfter=await snapSources();assert.deepEqual(report.auditionsAfter,report.auditionsBefore);
    assert.equal(sha(await readFile('assets/music/orchestra-manifest.json')),sha(originalBytes),'do not overwrite a concurrently changed manifest');
    for(const track of report.tracks)await copyFile(out+'/'+track.file.split('/').at(-1),track.file);
    await writeFile('assets/music/orchestra-manifest.json',JSON.stringify(manifest,null,2)+'\n');report.manifest=manifest;report.pass=true;
    console.log(JSON.stringify({pass:true,acceptedSources:14,newLoops:14,retainedRecordings:4,bytes:manifest.tracks.reduce((sum,t)=>sum+t.bytes,0),constants:report.tracks.map(t=>`    'orchestra-${t.id}': Object.freeze({ loopStart: 0, loopEnd: ${t.loopEnd}, sha256: '${t.sha256}' }),`)}));
  }catch(error){report.failure=error.stack;throw error;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
