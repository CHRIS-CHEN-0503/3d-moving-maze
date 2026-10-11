import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=await import(new URL('../functions/api/scores.js',import.meta.url));
const kv=(initial=null,{failPut=false}={})=>{let value=initial;return {get:async()=>value,put:async(key,next)=>{if(failPut)throw new Error('KV PUT failed: 429 Too Many Requests');value=next;},read:()=>JSON.parse(value||'[]')};};
const post=(env,body)=>api.onRequestPost({env,request:{json:async()=>body}});
const record=(extra={})=>({name:'小明',char:'🧒',level:'cave',timeSec:42,score:5370,date:'2026-10-07',...extra});

test('scores accept only plausible records for real levels and store them normalised',async()=>{
  const env={SCORES:kv()};
  assert.equal((await post(env,record())).status,200);
  for(const bad of [{level:'moon'},{timeSec:0},{timeSec:-30},{date:'yesterday'},{name:''},{name:'\u0000\u0001'}])assert.equal((await post(env,record(bad))).status,400,JSON.stringify(bad));
  assert.equal((await post(env,null)).status,400);
  await post(env,record({char:'<b>x</b>',score:1e9,timeSec:12.6}));
  // v1.61.1: a score above what the game can award in 13 s (6000 − 15 s plus stars) is clamped to that ceiling.
  const stored=env.SCORES.read();assert.equal(stored.length,2);assert.equal(stored[0].char,'bx/b');assert.equal(stored[0].score,Math.max(100,6000-13*15)+3000);assert.equal(stored[0].timeSec,13);
});

test('each level keeps its own top list, so fast levels cannot evict slower ones',async()=>{
  const existing=[...Array.from({length:150},(_,i)=>({...record(),level:'field',timeSec:10+i})),{...record(),level:'volcano',timeSec:900}];
  const env={SCORES:kv(JSON.stringify(existing))};await post(env,record({level:'field',timeSec:5}));
  const stored=env.SCORES.read();assert.equal(stored.filter(r=>r.level==='field').length,100);assert.equal(stored.filter(r=>r.level==='volcano').length,1);assert.equal(stored[0].timeSec,5);
});

test('a throttled or corrupted store answers with retryable errors instead of crashing',async()=>{
  assert.equal((await post({SCORES:kv('[]',{failPut:true})},record())).status,503);
  const broken=await api.onRequestGet({env:{SCORES:kv('{not json')}});assert.equal(broken.status,200);assert.equal(await broken.text(),'[]');
  const env={SCORES:kv('{not json')};assert.equal((await post(env,record())).status,200);assert.equal(env.SCORES.read().length,1);
});

test('server level list matches the game levels and the leaderboard escapes every cell',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=html.indexOf('const LEVELS'),levels=[...html.slice(start,html.indexOf('];',start)).matchAll(/id:'([a-z]+)'/g)].map(m=>m[1]);
  const source=readFileSync(new URL('../functions/api/scores.js',import.meta.url),'utf8');assert.deepEqual([...source.match(/LEVEL_IDS = new Set\(\[([^\]]+)\]\)/)[1].matchAll(/'([a-z]+)'/g)].map(m=>m[1]),levels);
  assert.match(html,/<td>\$\{escapeHtml\(r\.char\|\|''\)\}/);assert.match(html,/<td>\$\{escapeHtml\(Math\.round\(Number\(r\.score\)\|\|0\)\)\}<\/td>/);
});
