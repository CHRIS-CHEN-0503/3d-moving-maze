import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pack=require('../assets/voice-pack.js'),narrative=require('../story/tower-narrative.js'),encounters=require('../story/tower-encounters.js');

test('大拍賣20種商品與三種限时錄音正確對應，不將秒數念錯',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const names=[...html.match(/const GOODS=\[([\s\S]*?)\];/)[1].matchAll(/name:'([^']+)'/g)].map(x=>x[1]);
  assert.equal(names.length,20);names.forEach((name,i)=>assert.equal(pack.get('shop.sale.good.'+i).text,name+'大拍賣！'));
  for(const [seconds,text] of [[15,'十五'],[20,'二十'],[25,'二十五']])assert.equal(pack.get('shop.sale.limit.'+seconds).text,'限時'+text+'秒！只有六件，快來搶購喔！');
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
