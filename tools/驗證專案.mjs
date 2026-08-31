import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const requiredIds = [
  'titleScreen',
  'startBtn',
  'singleBtn',
  'mpBtn',
  'mpCreate',
  'mpJoin',
  'homePanel',
  'profilePanel',
  'setupPanel',
  'profileNextBtn',
  'profileBackBtn',
  'setupBackBtn',
  'profileError',
  'mpChosenMode',
  'roundCount',
  'hudRound',
  'mpNextRound',
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

const entryShellTag = html.match(/<[^>]+\bclass=["'][^"']*\bentry-shell\b[^"']*["'][^>]*>/)?.[0] ?? '';
assert.match(entryShellTag, /\bdata-panel=["']homePanel["']/, '首頁容器缺少 data-panel="homePanel" 初始狀態');
assert.match(
  html,
  /function\s+setFlowPanel\s*\([^)]*\)\s*\{[\s\S]{0,800}(?:\bshell|document\.querySelector\([^)]*\.entry-shell[^)]*\))\.dataset\.panel\s*=\s*id\b/,
  'setFlowPanel 沒有同步更新 shell.dataset.panel',
);

const homeUtilityButtons = ['admBtn', 'lbBtn', 'helpBtn'];
for (const id of homeUtilityButtons) {
  const buttonTag = html.match(new RegExp(`<button\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`))?.[0] ?? '';
  assert.match(buttonTag, /\bclass=["'][^"']*\butility\b[^"']*["']/, `首頁次要動作 #${id} 缺少 utility 類別`);
}

assert.match(
  html,
  /\.setup-side\s*\{[^}]*display\s*:\s*grid[^}]*grid-template(?:-columns|-areas)?\s*:/,
  'setup-side 缺少緊湊 grid 配置',
);
const compactSetupClasses = ['setup-summary', 'setup-modes', 'setup-view', 'setup-start'];
for (const className of compactSetupClasses) {
  assert.match(
    html,
    new RegExp(`\\bclass=["'][^"']*\\b${className}\\b[^"']*["']`),
    `關卡設定缺少緊湊配置類別：${className}`,
  );
}

assert.match(html, /--action-rail-space\s*:/, '右側工具列缺少 --action-rail-space 安全距離');
const actionRightOffsets = ['near', 'mid', 'far'];
for (const offset of actionRightOffsets) {
  assert.match(
    html,
    new RegExp(`--action-right-${offset}\\s*:[^;]*var\\(--action-rail-space\\)[^;]*;`),
    `動作按鈕距離 --action-right-${offset} 沒有從安全欄推導`,
  );
}

const actionButtonIds = ['shovelBtn', 'kiteBtn', 'atkBtn', 'robBtn', 'coBtn', 'skillBtn', 'whistleBtn'];
for (const id of actionButtonIds) {
  assert.match(
    html,
    new RegExp(`#${id}\\s*\\{[^}]*right\\s*:\\s*var\\(--action-right-(?:near|mid|far)\\)`),
    `動作按鈕 #${id} 沒有使用右側安全距離`,
  );
}

const narrowLandscapeStart = html.search(
  /@media\s*(?=[^{]*orientation\s*:\s*landscape)(?=[^{]*max-width\s*:\s*700px)[^{]*\{/,
);
assert.notEqual(narrowLandscapeStart, -1, '缺少 max-width:700px 的窄橫式縮放規則');
const narrowLandscapeCss = html.slice(narrowLandscapeStart, narrowLandscapeStart + 2400);
assert.match(
  narrowLandscapeCss,
  /#(?:shovelBtn|kiteBtn|atkBtn|robBtn|coBtn|skillBtn|whistleBtn)[^{]*\{[^}]*(?:width|height)\s*:/,
  '窄橫式規則沒有縮小動作按鈕',
);

const requiredFlowFunctions = [
  'beginEntryFlow',
  'continueToSetup',
  'openMultiplayerRoom',
];
for (const functionName of requiredFlowFunctions) {
  assert.match(html, new RegExp(`function\\s+${functionName}\\s*\\(`), `缺少首頁流程函式：${functionName}`);
}

const requiredSeriesFunctions = [
  'selectedRoundTotal',
  'resetSeries',
  'ensureSeriesPlayer',
  'recordSeriesRound',
  'rankedSeriesStats',
  'seriesSummaryHtml',
  'renderSingleSeriesResult',
  'sendMpRoundStart',
];
for (const functionName of requiredSeriesFunctions) {
  assert.match(html, new RegExp(`function\\s+${functionName}\\s*\\(`), `缺少多輪統計函式：${functionName}`);
}

assert.match(html, /assets\/首頁迷宮背景\.webp/, '首頁沒有引用生成的迷宮背景');
assert.match(html, /assets\/遊戲視覺圖集\.webp/, '遊戲 UI 沒有引用視覺圖集');
assert.match(html, /assets\/玩法說明圖集\.webp/, '遊戲說明沒有引用玩法圖集');
assert.match(html, /\.help-art\{[^}]*background-size:300% 100%/, '玩法圖集沒有保持三格橫向切片');
assert.match(html, /wss:\/\/broker\.emqx\.io:8084\/mqtt/, '多人 MQTT 預設網址被意外改動');
assert.match(html, /class MiniMQTT/, '多人 MiniMQTT 實作遺失');
assert.match(html, /\bseriesRound:\s*1\b/, '多人缺少 seriesRound 狀態');
assert.match(html, /\bseriesTotal:\s*SERIES\.total\b/, '多人開局沒有傳送 seriesTotal');
assert.match(html, /const MP_ROUND_EVENTS=new Set\(/, '多人缺少需要輪次保護的事件集合');
assert.match(html, /MP_ROUND_EVENTS\.has\(obj\.t\)&&obj\.sr===undefined\)obj\.sr=MP\.seriesRound/, '多人送出封包沒有附加 seriesRound');
assert.match(html, /MP_ROUND_EVENTS\.has\(m\.t\)&&Number\(m\.sr\|\|1\)!==MP\.seriesRound\)return/, '多人缺少舊輪延遲封包阻擋');
assert.match(html, /window\.addEventListener\(['"]beforeunload["']/, '進行中的賽事缺少離開頁面確認');
assert.match(html, /if\(G\.running\|\|MP\.started\)\{e\.preventDefault\(\);e\.returnValue=['"]{2};\}/, 'beforeunload 沒有保護進行中的遊戲');
assert.match(html, /screen\.orientation&&screen\.orientation\.lock&&screen\.orientation\.lock\('landscape'\)/, '橫式鎖定嘗試遺失');
assert.doesNotMatch(html, /id=["']orientTip["']/, '舊的一次性轉向提示仍存在');
assert.match(html, /function scoreApiUrl\(\)\{ return CFG\.apiUrl\|\|'\/api\/scores'; \}/, 'Cloudflare 分數 API 路徑被意外改動');
assert.match(html, /function makePickupMarker\(color,label\)/, '可拾取物的共用光圈標記遺失');
assert.match(html, /G\.items\.push\(\{type,sprite:sp,marker,/, '一般道具沒有保留拾取標記');
assert.match(html, /G\.foods\.push\(\{type,sprite:sp,marker,/, '食物沒有保留拾取標記');
assert.match(html, /G\.goods\[i\]=\{g,gi,sprite:sp,tag,marker,/, '商品沒有保留拾取標記');
assert.ok((html.match(/\.marker\.visible=false/g)||[]).length >= 3, '道具、食物或商品被取得後沒有隱藏拾取標記');

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
const helpAtlasUrl = new URL('../assets/玩法說明圖集.webp', import.meta.url);
await access(helpAtlasUrl);
const helpAtlasStat = await stat(helpAtlasUrl);
assert.ok(helpAtlasStat.size >= 20 * 1024, `玩法圖集過小，可能不是完整資產：${helpAtlasStat.size} bytes`);
assert.ok(helpAtlasStat.size <= 120 * 1024, `玩法圖集超過 120KB 效能預算：${helpAtlasStat.size} bytes`);
const helpAtlasHeader = (await readFile(helpAtlasUrl)).subarray(0, 12);
assert.equal(helpAtlasHeader.subarray(0, 4).toString('ascii'), 'RIFF', '玩法圖集不是有效的 RIFF 檔案');
assert.equal(helpAtlasHeader.subarray(8, 12).toString('ascii'), 'WEBP', '玩法圖集不是有效的 WebP 檔案');
await access(new URL('../lib/three.min.js', import.meta.url));
await access(new URL('../functions/api/scores.js', import.meta.url));

console.log(`專案靜態驗證通過：${requiredIds.length} 個必要 UI、${homeUtilityButtons.length} 個首頁次要動作、${compactSetupClasses.length} 個緊湊設定區塊、${actionButtonIds.length} 個安全定位動作鈕、${requiredFlowFunctions.length} 個首頁流程函式、${requiredSeriesFunctions.length} 個多輪統計函式、${inlineScripts.length} 段 inline JavaScript、${atlasClasses.length} 個視覺圖集區塊。`);
