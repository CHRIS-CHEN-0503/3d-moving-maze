// Offline, bounded raw-recording diagnosis; no browser or production writes.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.agent-run/cinematic-tower-multishot-preview/story-action-final'),report=JSON.parse(await readFile(root+'/report.json','utf8'));
const require=createRequire('/Users/chenziwei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'),sharp=require('sharp'),ffmpeg='/opt/homebrew/bin/ffmpeg';
const templates=['844-3-traveller-question-middle.png','844-2-map-offer-and-receive-middle-page1.png','raw-150-frame.png'];
const width=790,height=18,size=width*height,fps=10,masks=[];
for(const file of templates){const {data,info}=await sharp(root+'/'+file).extract({left:25,top:280,width,height}).greyscale().removeAlpha().raw().toBuffer({resolveWithObject:true});if(info.channels!==1)throw Error('Expected grayscale');masks.push([...data].map(v=>v>205));}
const pixels=execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',report.rawVideoPath,'-vf','fps=10,crop=790:18:25:280,format=gray','-f','rawvideo','-'],{timeout:25000,maxBuffer:50*1024*1024});
const frames=[];for(let offset=0;offset+size<=pixels.length;offset+=size){const image=pixels.subarray(offset,offset+size),scores=masks.map(mask=>{let both=0,either=0;for(let n=0;n<size;n++){const light=image[n]>205;if(light&&mask[n])both++;if(light||mask[n])either++;}return both/Math.max(1,either);});const best=Math.max(...scores),page=scores.indexOf(best);frames.push({time:offset/size/fps,page:best>.65?page:-1,score:best});}
const spans=[];for(const frame of frames){const last=spans.at(-1);if(last&&last.page===frame.page){last.end=frame.time+.1;last.minScore=Math.min(last.minScore,frame.score);}else spans.push({page:frame.page,start:frame.time,end:frame.time+.1,minScore:frame.score});}
const top=execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',report.rawVideoPath,'-vf','fps=10,scale=422:195,crop=422:100:0:0,format=gray','-f','rawvideo','-'],{timeout:25000,maxBuffer:90*1024*1024}),topSize=42200,changes=[];
for(let n=1;n*topSize<top.length;n++){let delta=0;for(let k=0;k<topSize;k++)delta+=Math.abs(top[n*topSize+k]-top[(n-1)*topSize+k]);const mean=delta/topSize;if(mean>5)changes.push({time:n/fps,mean});}
const result={rawVideo:report.rawVideoPath,rawDuration:Number(JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe',['-v','quiet','-show_format','-of','json',report.rawVideoPath],{encoding:'utf8',timeout:10000})).format.duration),captionCrop:{left:25,top:280,width,height,threshold:205},samplePrecision:.1,templates,captionSpans:spans.filter(s=>s.page>=0&&s.end-s.start>.2),majorImageChanges:changes};
await writeFile(root+'/video-timeline.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
