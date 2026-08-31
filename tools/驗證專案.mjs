import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const requiredIds = [
  'titleScreen',
  'startBtn',
  'mpBtn',
  'mpCreate',
  'mpJoin',
  'gameScreen',
  'c3d',
  'admBtn',
  'lbBtn',
  'helpBtn',
  'landscapeGate',
];

for (const id of requiredIds) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `缺少必要 UI：#${id}`);
}

assert.match(html, /assets\/首頁迷宮背景\.webp/, '首頁沒有引用生成的迷宮背景');
assert.match(html, /assets\/遊戲視覺圖集\.webp/, '遊戲 UI 沒有引用視覺圖集');
assert.match(html, /wss:\/\/broker\.emqx\.io:8084\/mqtt/, '多人 MQTT 預設網址被意外改動');
assert.match(html, /class MiniMQTT/, '多人 MiniMQTT 實作遺失');
assert.match(html, /screen\.orientation&&screen\.orientation\.lock&&screen\.orientation\.lock\('landscape'\)/, '橫式鎖定嘗試遺失');
assert.doesNotMatch(html, /id=["']orientTip["']/, '舊的一次性轉向提示仍存在');
assert.match(html, /function scoreApiUrl\(\)\{ return CFG\.apiUrl\|\|'\/api\/scores'; \}/, 'Cloudflare 分數 API 路徑被意外改動');

const atlasClasses = [
  'indoor', 'field', 'cave', 'forest', 'mist', 'volcano',
  'race', 'tag', 'treasure', 'shop', 'win', 'fail',
];
for (const atlasClass of atlasClasses) {
  assert.match(html, new RegExp(`atlas-${atlasClass}\\b`), `缺少視覺圖集區塊：${atlasClass}`);
}

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());

assert.ok(inlineScripts.length >= 3, 'inline JavaScript 區塊數量異常');
inlineScripts.forEach((script, index) => {
  new vm.Script(script, { filename: `index-inline-${index + 1}.js` });
});

await access(new URL('../assets/首頁迷宮背景.png', import.meta.url));
await access(new URL('../assets/首頁迷宮背景.webp', import.meta.url));
const atlasUrl = new URL('../assets/遊戲視覺圖集.webp', import.meta.url);
await access(atlasUrl);
const atlasStat = await stat(atlasUrl);
assert.ok(atlasStat.size <= 180 * 1024, `視覺圖集超過 180KB 效能預算：${atlasStat.size} bytes`);
await access(new URL('../lib/three.min.js', import.meta.url));
await access(new URL('../functions/api/scores.js', import.meta.url));

console.log(`專案靜態驗證通過：${requiredIds.length} 個必要 UI、${inlineScripts.length} 段 inline JavaScript、${atlasClasses.length} 個視覺圖集區塊。`);
