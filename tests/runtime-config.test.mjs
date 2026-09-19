import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../functions/api/runtime-config.js',import.meta.url),'utf8');
const {onRequestGet}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
test('後台端點僅回傳允許的公開連線設定，不洩露其他環境變數',async()=>{
  const r=onRequestGet({env:{MAZE_BROKER_URL:'wss://example.com/mqtt',MAZE_SCORES_URL:'https://example.com/scores',SECRET_KEY:'do-not-expose'}});
  assert.deepEqual(await r.json(),{broker:'wss://example.com/mqtt',apiUrl:'https://example.com/scores'});assert.equal(r.headers.get('cache-control'),'no-store');
});
test('拒絕含帳密或非加密網址，缺少設定使用內建服務',async()=>{
  const r=await onRequestGet({env:{MAZE_BROKER_URL:'ws://example.com',MAZE_SCORES_URL:'https://name:password@example.com'}}).json();
  assert.equal(r.broker,'wss://broker.emqx.io:8084/mqtt');assert.equal(r.apiUrl,'');
});
