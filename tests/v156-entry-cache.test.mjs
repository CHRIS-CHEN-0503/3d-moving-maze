import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createRequire} from 'node:module';

const root=new URL('../',import.meta.url),origin='https://maze-entry-cache.test';
const release='1.57.4',knightHealingVersion='1.57.2',filmVersion='1.58.0',lightVersion='1.58.2',archerVersion='1.58.3',feedbackVersion='1.58.4',upgradeVersion='1.58.5',xpBarVersion='1.58.6',levelUpVersion='1.58.7',gameEntry='index.html',atlasEntry='docs/職業裝備圖鑑.html';
const game=readFileSync(new URL(gameEntry,root),'utf8');
const atlas=readFileSync(new URL(atlasEntry,root),'utf8');
const packageInfo=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
// Entrypoint versions advance independently from asset caches. Headwear and
// shoulder fitting changes the visual provider in 1.57.6. The 1.57.7 music
// controller and its mode routing advance without refreshing unchanged assets.
// In 1.57.8 only the audio controller advances for approved legato recordings.
// In 1.57.9 both audio and region routing advance for the approved fourteen cues.
// In 1.58.0 every region film stage, its director/actors and the reviewed fixes advance.
const changedGameAssets=[
  {asset:'assets/game-voice.js',kind:'script'},
  // 1.58.2: regional mini lords, lord experience and the mini lord's healing draught.
  {asset:'story/tower-floor-lords.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-loot.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-stairs.js',kind:'script'},
  {asset:'story/tower-cinematic-actors.js',kind:'script',version:filmVersion},
  {asset:'story/tower-cinematic-look.js',kind:'script'},
  {asset:'story/tower-story-direction.js',kind:'script',version:filmVersion},
  {asset:'story/tower-story-theater.js',kind:'script',version:filmVersion},
  {asset:'assets/combat-audio.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-cinematics.js',kind:'script',version:filmVersion},
  {asset:'story/tower-mode.js',kind:'script',version:levelUpVersion},
  // 1.58.1 adds the hidden 逃生梯 (GM) panel, loaded before the story runtime; 1.58.2 links it to the detailed adventure book.
  {asset:'story/tower-gm.js',kind:'script',version:lightVersion},
  {asset:'story/tower-audio.js',kind:'script',version:filmVersion},
  {asset:'story/tower-team-tactics.js',kind:'script',version:'1.57.1'},
  {asset:'story/tower-cooperation-runtime.js',kind:'script',version:filmVersion},
  {asset:'story/tower-cinematics.css',kind:'link',version:filmVersion},
  {asset:'assets/character-face.js',kind:'script',version:filmVersion},
  {asset:'assets/shop-claims.js',kind:'script',version:filmVersion},
  {asset:'assets/classic-tactics-core.js',kind:'script'},
  {asset:'assets/classic-tactics.js',kind:'script'},
  {asset:'assets/mode-variants.js',kind:'script',version:filmVersion},
  {asset:'story/tower-hero-growth.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-growth-runtime.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-heroes-runtime.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-party-runtime.js',kind:'script',version:lightVersion},
  // 1.58.4: job vitality, quick gear upgrade prompt, healing flask, marked-block survey.
  {asset:'story/tower-encounters.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-recruitment.js',kind:'script',version:feedbackVersion},
  {asset:'story/tower-heroes.css',kind:'link',version:levelUpVersion},
  // 1.58.3: redesigned archer (proportioned arms, faces, hair) and livelier skill casting.
  {asset:'assets/character-sculpt.js',kind:'script',version:archerVersion},
  {asset:'story/tower-heroes-visuals.js',kind:'script',version:archerVersion},
  {asset:'story/tower-combat-motion.js',kind:'script',version:archerVersion},
  {asset:'story/tower-heroes-core.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-ascension-catalog.js',kind:'script',version:knightHealingVersion},
  {asset:'story/tower-cooperation-core.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-expedition-core.js',kind:'script',version:filmVersion},
  {asset:'story/tower-party-core.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-field-guide.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-adventure-events.js',kind:'script'},
  // 1.58.2: skill light (flash slot, view kick, enemy flash, defeat burst, sharper arcs).
  {asset:'story/tower-skill-effects.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-combat-readability.js',kind:'script',version:lightVersion},
  // 1.58.2: hunt rifts (rift-only combatant ids in the save, the rift offer and settlement).
  {asset:'story/story-core.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-dungeons.js',kind:'script',version:levelUpVersion},
  {asset:'story/tower-story-insights.js',kind:'script'},
  {asset:'story/tower-environment-life.js',kind:'script',version:filmVersion},
  {asset:'story/tower-party.css',kind:'link'},
  {asset:'story/tower-mobile.css',kind:'link',version:levelUpVersion},
  // The v1.58.0 performance round also changed these modules.
  {asset:'assets/character-motion.js',kind:'script',version:filmVersion},
  {asset:'assets/equipment-surfaces.js',kind:'script',version:filmVersion},
  {asset:'assets/maze-atmosphere.js',kind:'script',version:filmVersion},
  {asset:'assets/maze-sight.js',kind:'script',version:filmVersion},
  {asset:'assets/shop-collection.js',kind:'script',version:filmVersion},
  {asset:'assets/room-lifecycle.js',kind:'script',version:filmVersion},
  {asset:'assets/capture-mode.js',kind:'script',version:filmVersion},
  {asset:'story/tower-creature-art.js',kind:'script',version:filmVersion},
  {asset:'story/tower-lighting-core.js',kind:'script',version:filmVersion},
  {asset:'story/tower-lighting-runtime.js',kind:'script',version:lightVersion},
  {asset:'story/tower-robot-core.js',kind:'script',version:filmVersion},
];
const changedAtlasAssets=[{asset:'docs/story-atlas-rules.js',kind:'script',version:levelUpVersion},{asset:'story/tower-encounters.js',kind:'script',version:levelUpVersion},{asset:'story/tower-recruitment.js',kind:'script',version:feedbackVersion},{asset:'docs/story-atlas.js',kind:'script',version:lightVersion},{asset:'docs/story-atlas.css',kind:'link',version:lightVersion},{asset:'docs/story-atlas-gm.js',kind:'script',version:levelUpVersion},{asset:'story/tower-floor-lords.js',kind:'script',version:levelUpVersion},{asset:'story/tower-dungeons.js',kind:'script',version:levelUpVersion},{asset:'docs/story-atlas-items.js',kind:'script',version:levelUpVersion},{asset:'story/tower-hero-growth.js',kind:'script',version:levelUpVersion},{asset:'story/tower-adventure-events.js',kind:'script'},{asset:'story/tower-party-runtime.js',kind:'script',version:lightVersion},{asset:'story/tower-cooperation-runtime.js',kind:'script',version:filmVersion},{asset:'story/tower-heroes-core.js',kind:'script',version:levelUpVersion},{asset:'story/tower-ascension-catalog.js',kind:'script',version:knightHealingVersion},{asset:'story/tower-cooperation-core.js',kind:'script',version:levelUpVersion},{asset:'story/tower-expedition-core.js',kind:'script',version:filmVersion},{asset:'story/tower-party-core.js',kind:'script',version:levelUpVersion},{asset:'story/tower-field-guide.js',kind:'script',version:levelUpVersion},{asset:'story/story-core.js',kind:'script',version:levelUpVersion},{asset:'story/tower-lighting-core.js',kind:'script',version:filmVersion},{asset:'story/tower-lighting-runtime.js',kind:'script',version:lightVersion},{asset:'story/tower-robot-core.js',kind:'script',version:filmVersion}];

function references(html,entry){
  return [...html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<(script|link)\b[^>]*>/gi)].flatMap(([tag,name])=>{
    const kind=name.toLowerCase(),attribute=kind==='script'?'src':'href';
    const source=[...tag.matchAll(/\s(src|href)\s*=\s*(["'])([\s\S]*?)\2/gi)].find(match=>match[1].toLowerCase()===attribute)?.[3];
    if(!source)return [];
    const url=new URL(source.replace(/&amp;/g,'&'),origin+'/'+entry);
    if(url.origin!==origin||! /\.(js|css)$/i.test(url.pathname))return [];
    return [{asset:decodeURIComponent(url.pathname).replace(/^\//,''),version:url.searchParams.get('v'),kind,source,tag}];
  });
}

function assertReleaseReferences(html,entry,expected){
  const refs=references(html,entry);
  for(const {asset,kind,version='1.57.0'}of expected){
    const found=refs.filter(ref=>ref.asset===asset);
    assert.equal(found.length,1,entry+': '+asset+' must have one live reference');
    assert.equal(found[0].kind,kind,entry+': '+asset+' reference type');
    assert.equal(found[0].version,version,entry+': '+asset+' must invalidate its changed cache');
    if(kind==='link')assert.match(found[0].tag,/\brel\s*=\s*(["'])stylesheet\1/i,asset+' must be a stylesheet');
    else assert.doesNotMatch(found[0].tag,/\s(?:async|defer)(?:\s|=|>)/i,asset+' must preserve ordered classic execution');
  }
  return refs;
}

function assertGameVersion(html,manifest){
  const declarations=[...html.matchAll(/\bconst\s+GAME_VERSION\s*=\s*(["'])([^"']+)\1/g)];
  assert.equal(declarations.length,1,'one real game version declaration');
  assert.equal(declarations[0][2],'1.58.7','GAME_VERSION');
  assert.equal(manifest.version,'1.58.7','package.json version');
}

function assertCinematicOrder(html){
  const refs=assertReleaseReferences(html,gameEntry,changedGameAssets);
  const index=asset=>refs.findIndex(ref=>ref.asset==='story/'+asset+'.js');
  const director=index('tower-cinematics'),runtime=index('tower-mode');
  for(const provider of ['tower-cinematic-actors','tower-cinematic-look','tower-story-theater'])assert.ok(index(provider)<director,provider+' must load before the director');
  assert.ok(index('tower-cinematic-look')<index('tower-story-theater'),'cinematic surface provider must load before the stage');
  assert.ok(index('tower-story-direction')<index('tower-story-theater'),'narrative direction must load before the stage');
  assert.ok(director<runtime,'cinematic director must load before story runtime');
}

function sectionText(html,title){
  const sections=[...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)];
  const section=sections.find(([,body])=>new RegExp('<h3>'+title+'<\\/h3>').test(body));
  assert.ok(section,'atlas section: '+title);
  return section[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

test('actual v1.58.7 game and package versions are synchronized',()=>{
  assertGameVersion(game,packageInfo);
  assert.match(atlas,/劇情模式\s*·\s*v1\.58\.7 圖鑑/);
});

test('v1.58.0 region film stages and reviewed fixes update while unchanged assets retain their tags',()=>{
  assertReleaseReferences(game,gameEntry,changedGameAssets);
  assertReleaseReferences(atlas,atlasEntry,changedAtlasAssets);
  for(const {asset}of [...changedGameAssets,...changedAtlasAssets])assert.ok(statSync(new URL(asset,root)).isFile(),asset+' must exist');
});

test('actor and theater providers load before the director, which loads before runtime',()=>{
  assertCinematicOrder(game);
});

test('shared parser resolves quoted relative assets without counting comments, images or external URLs',()=>{
  const fixture=`<!-- <script src='../story/tower-stairs.js?v=0.0.0'></script> -->
    <script src='../story/tower-stairs.js?theme=dark&amp;v=1.57.0'></script>
    <link href="../story/tower-cinematics.css?v=1.57.0" rel="stylesheet">
    <script src='https://other.test/story/tower-mode.js?v=1.57.0'></script>
    <img src='../story/tower-mode.js?v=1.57.0'>`;
  assert.deepEqual(references(fixture,atlasEntry).map(({asset,version,kind})=>({asset,version,kind})),[
    {asset:'story/tower-stairs.js',version:'1.57.0',kind:'script'},
    {asset:'story/tower-cinematics.css',version:'1.57.0',kind:'link'},
  ]);
});

test('every changed game and atlas asset rejects stale, malformed, unversioned and removed references',()=>{
  for(const [html,entry,expected]of [[game,gameEntry,changedGameAssets],[atlas,atlasEntry,changedAtlasAssets]]){
    assertReleaseReferences(html,entry,expected);
    for(const {asset}of expected){
      const ref=references(html,entry).find(ref=>ref.asset===asset);
      assert.ok(ref,asset+' must be found before mutation');
      for(const value of ['1.56.0','1.57.0-old','broken','',...['1.57.0','1.57.1','1.57.2','1.57.3','1.57.4','1.57.5','1.57.6','1.57.7','1.57.8','1.57.9','1.58.0','1.58.1','1.58.2','1.58.3','1.58.4','1.58.5','1.58.6','1.58.7'].filter(version=>version!==ref.version)]){
        const source=ref.source.replace(/([?&])v=[^&#]*/,'$1v='+value);
        assert.notEqual(source,ref.source,asset+' mutation must take effect');
        assert.throws(()=>assertReleaseReferences(html.replace(ref.source,source),entry,expected),undefined,entry+': '+asset+' rejects '+JSON.stringify(value));
      }
      const unversioned=ref.source.replace(/[?&]v=[^&#]*/,'');
      assert.throws(()=>assertReleaseReferences(html.replace(ref.source,unversioned),entry,expected),undefined,asset+' rejects missing cache key');
      assert.throws(()=>assertReleaseReferences(html.replace(ref.tag,''),entry,expected),undefined,asset+' rejects removed entry');
      assert.throws(()=>assertReleaseReferences(html.replace(ref.tag,'<!-- '+ref.tag+' -->'),entry,expected),undefined,asset+' rejects commented-out entry');
      assert.throws(()=>assertReleaseReferences(html.replace(ref.tag,ref.tag+ref.tag),entry,expected),undefined,asset+' rejects duplicate entry');
    }
  }
});

test('invalid source and manifest versions fail independently instead of matching each other',()=>{
  for(const stale of ['1.55.0','1.57.3','1.57.4','1.57.5','1.57.6','1.57.7','1.57.8','1.57.9','1.58.0','1.58.1','1.58.2','1.58.3','1.58.4','1.58.5','1.58.6']){
    const oldGame=game.replace(/(\bconst\s+GAME_VERSION\s*=\s*["'])1\.58\.7/,(_,prefix)=>prefix+stale);
    assert.notEqual(oldGame,game,'version mutation must take effect');
    assert.throws(()=>assertGameVersion(oldGame,packageInfo));
    assert.throws(()=>assertGameVersion(game,{...packageInfo,version:stale}));
    assert.throws(()=>assertGameVersion(oldGame,{...packageInfo,version:stale}));
  }
});

test('wrong script order and unordered async loading are caught on the real entry',()=>{
  const refs=references(game,gameEntry),get=name=>refs.find(ref=>ref.asset==='story/'+name+'.js');
  const swap=(a,b)=>game.replace(a.tag,'<!-- v156-swap-slot -->').replace(b.tag,a.tag).replace('<!-- v156-swap-slot -->',b.tag);
  for(const provider of ['tower-cinematic-actors','tower-cinematic-look','tower-story-theater'])assert.throws(()=>assertCinematicOrder(swap(get(provider),get('tower-cinematics'))));
  assert.throws(()=>assertCinematicOrder(swap(get('tower-cinematic-look'),get('tower-story-theater'))));
  assert.throws(()=>assertCinematicOrder(swap(get('tower-story-direction'),get('tower-story-theater'))));
  assert.throws(()=>assertCinematicOrder(swap(get('tower-cinematics'),get('tower-mode'))));
  const actor=get('tower-cinematic-actors');
  assert.throws(()=>assertCinematicOrder(game.replace(actor.tag,actor.tag.replace('<script ','<script async '))));
});

test('atlas documents animated story navigation, reading transactions and safe pauses',()=>{
  const text=sectionText(atlas,'動畫故事舞台');
  for(const pattern of [/塔頂開場/,/地上與地下章節/,/副本開場與結尾/,/旅程結局/,/人物動作/,/上一段/,/下一段/,/稍後再看/,/跳過整幕/,/換段不重唸標題/,/關閉語音或播放失敗.*停留當段/,/完成或跳[過过]整幕才記為已讀/,/日誌可重看動畫/,/不扣生命、補給與遊戲時間/,/減少動態.*停住鏡頭及環境動畫.*降低人物動作/])assert.match(text,pattern);
  const moment=sectionText(atlas,'重要時刻鏡頭');
  for(const pattern of [/台詞講完才開始戰鬥/,/呼吸、轉頭、眨眼/,/不是逐字精準對嘴/,/暫停/,/恢復原視角與人物姿勢/])assert.match(moment,pattern);
});

test('atlas and shared item guide explain hidden stairs and completion-only reveal without mandatory side quests',()=>{
  const text=sectionText(atlas,'通關後樓梯浮現');
  for(const pattern of [/未完成.*樓梯、地板洞口及地圖出口標記都隱藏/,/主線印記/,/迷宮機關/,/樓層主/,/裂隙需.*三段記憶/,/七階石梯依序浮現/,/動畫完成才可.*下樓或留在本層/,/選擇性委託不變成強制任務/,/讀檔或同層變形不重播/,/減少動態.*直接呈現/])assert.match(text,pattern);
  const require=createRequire(import.meta.url),items=require('../docs/story-atlas-items.js');
  const notes=items.scope.notes.join(' ');
  for(const pattern of [/樓梯只在既有必要通關條件達成後顯示/,/地板洞口、出口標記與路線也隱藏/,/七階石梯浮現後才可.*下樓或留下/,/普通樓層不新增強制委託/,/裂隙需完成三段記憶/,/讀檔或同層變形不重播/])assert.match(notes,pattern);
});
