import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pack=require('../assets/voice-pack.js'),narrative=require('../story/tower-narrative.js'),encounters=require('../story/tower-encounters.js');

test('主線每一頁、結局及六種副本正文都有專用錄音對應',()=>{
  const side=require('../story/tower-side-stories.js');
  function paragraphs(value){
    if(typeof value==='string'&&value.length>25&&/[\u4e00-\u9fff]/.test(value)){
      const plan=pack.plan(value);assert.ok(plan.length>0);assert.ok(plan.every(x=>x.asset),value);
    }else if(value&&typeof value==='object')Object.values(value).forEach(paragraphs);
  }
  paragraphs(narrative.SCENES);paragraphs(narrative.ENDINGS);paragraphs(side.STORIES);
});

test('固定道具只讀動作與名稱，模式與角色、環境皆可用專用音檔',()=>{
  for(const text of ['獲得 餅乾','使用 鐵鍬','裝備 平底鍋','單人遊戲','劇情模式・倒轉高塔','搶購模式','比賽搶終點','尋寶','搶購','疾風跑者','神祕城堡','踩到黏鼠板，走不動了！']){
    const plan=pack.plan(text);assert.equal(plan.length,1,text);assert.ok(plan[0].asset,text);
  }
  assert.deepEqual(pack.plan('新玩家小王，獲得 餅乾').map(x=>!!x.asset),[false,true]);
  assert.equal(pack.plan('John Smith，獲得 餅乾')[0].text,'John Smith，');
  assert.deepEqual(pack.plan('完全未收錄的一句話'),[{text:'完全未收錄的一句話'}]);
});

test('文字索引不含預載音檔與資料網址，且在播放模組之前載入',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('assets/voice-catalog.js')<html.indexOf('assets/voice-pack.js'));
  const catalog=readFileSync(new URL('../assets/voice-catalog.js',import.meta.url),'utf8');
  assert.doesNotMatch(catalog,/new Audio|data:audio|fetch\(/);
});

test('大拍賣使用三種完整句音檔，數字轉為中文發音且不再拼接商品名',()=>{
  for(const [seconds,text] of [[15,'十五'],[20,'二十'],[25,'二十五']]){
    const track=pack.get('shop.sale.clear.'+seconds);
    assert.equal(track.text,'大拍賣！限時'+seconds+'秒，快來搶購！');
    assert.equal(track.spokenText,'大拍賣！限時'+text+'秒，快來搶購！');
  }
  assert.equal(pack.get('shop.sale.good.0'),null);
});

test('第一批專用語音涵蓋開場、三位行商、五位探索者與怪物警告',()=>{
  const ids=Object.keys(pack.tracks);
  assert.equal(pack.version,1);assert.equal(ids.filter(id=>id.startsWith('story.scene99.')).length,3);
  assert.equal(ids.filter(id=>id.startsWith('merchant.')).length,3);assert.equal(ids.filter(id=>id.startsWith('explorer.')).length,5);
  assert.ok(pack.get('alert.monster'));assert.equal(pack.get('__proto__'),null);
});

test('錄音文字與畫面上的固定台詞一致',()=>{
  const opening=narrative.SCENES.find(scene=>scene.id==='scene:99');
  opening.paragraphs.forEach((text,index)=>assert.equal(pack.get(`story.scene99.${index+1}`).text,text));
  for(const merchant of Object.values(encounters.MERCHANTS))assert.equal(pack.get('merchant.'+merchant.id).text,merchant.greeting);
  for(const explorer of Object.values(encounters.EXPLORERS))assert.equal(pack.get('explorer.'+explorer.id).text,explorer.greeting);
});

test('索引中的音檔皆為小型延後載入資產',()=>{
  for(const track of Object.values(pack.tracks)){
    const path=fileURLToPath(new URL('../'+track.src.replace(/^\.\//,''),import.meta.url));
    assert.ok(existsSync(path),track.src+' 不存在');assert.ok(statSync(path).size>1000,track.src+' 內容過小');assert.ok(statSync(path).size<700000,track.src+' 應維持小型');
  }
});

test('生成器保留長篇餘裕，並在儲存前拒絕達長度上限的音檔',()=>{
  const generator=readFileSync(new URL('../tools/generate-voice-mlx.py',import.meta.url),'utf8');
  assert.match(generator,/token_limit = max\(256, max\(len\(text\) for text in texts\) \* 12 \+ 128\)/);
  assert.match(generator,/max_tokens=token_limit/);
  const check=generator.indexOf('if result.token_count >= token_limit - 1:');
  assert.ok(check>0&&check<generator.indexOf('encoded.replace(destination)'));
  assert.match(generator,/reached generation limit; existing file was not replaced/);
});
