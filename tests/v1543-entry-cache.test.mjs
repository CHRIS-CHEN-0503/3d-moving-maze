import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const origin='https://maze-entry-cache.test';
const minimum='1.54.3';
// These assets changed in this release. Keep a fixed release floor, rather than
// requiring unchanged assets to follow every future package.json version.
const releaseAssets=new Set([
  'docs/story-atlas-cooperation.js','docs/story-atlas-items.js','docs/story-atlas-rules.js',
  'story/story-core.js','story/tower-cooperation-core.js','story/tower-cooperation-runtime.js',
  'story/tower-dungeons.js','story/tower-expedition-core.js','story/tower-field-guide.js',
  'story/tower-foraging.js','story/tower-hero-growth.js','story/tower-heroes-core.js',
  'story/tower-heroes-runtime.js','story/tower-loot.js','story/tower-mobile.css',
  'story/tower-mode.js','story/tower-party-core.js','story/tower-party-runtime.js',
  'story/tower-party.css','story/tower-robot-core.js',
]);

function references(html,entry){
  return [...html.matchAll(/<(script|link)\b[^>]*>/gi)].flatMap(([tag,name])=>{
    const attribute=name.toLowerCase()==='script'?'src':'href';
    const source=[...tag.matchAll(/\s(src|href)\s*=\s*(["'])([\s\S]*?)\2/gi)].find(match=>match[1].toLowerCase()===attribute)?.[3];
    if(!source)return [];
    const url=new URL(source.replace(/&amp;/g,'&'),origin+'/'+entry);
    if(url.origin!==origin||!/\.(js|css)$/i.test(url.pathname))return [];
    return [{asset:decodeURIComponent(url.pathname).replace(/^\//,''),version:url.searchParams.get('v'),source}];
  });
}

function semver(value){
  const match=typeof value==='string'&&value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
  if(!match||match[4]?.split('.').some(id=>/^0\d+$/.test(id)))return null;
  const numbers=match.slice(1,4).map(Number);
  return numbers.every(Number.isSafeInteger)?{numbers,prerelease:match[4]??null}:null;
}
function freshEnough(value){
  const actual=semver(value),floor=semver(minimum);if(!actual)return false;
  for(let i=0;i<3;i++)if(actual.numbers[i]!==floor.numbers[i])return actual.numbers[i]>floor.numbers[i];
  return actual.prerelease===null;
}

test('both entry points share relative-path, quoted-attribute and query-version parsing',()=>{
  const fixture=`<script defer src='../story/tower-party-runtime.js?theme=dark&amp;v=1.54.3'></script>
    <script src="story-atlas-items.js?v=1.54.10"></script>
    <link media='screen' href='../story/tower-mobile.css?v=1.55.0' rel='stylesheet'>
    <script src='https://elsewhere.test/story/tower-party-runtime.js?v=1.0.0'></script>
    <img src='../story/tower-mode.js?v=1.0.0'>`;
  assert.deepEqual(references(fixture,'docs/職業裝備圖鑑.html').map(({asset,version})=>({asset,version})),[
    {asset:'story/tower-party-runtime.js',version:'1.54.3'},
    {asset:'docs/story-atlas-items.js',version:'1.54.10'},
    {asset:'story/tower-mobile.css',version:'1.55.0'},
  ]);
  assert.equal(references('<script src="story/tower-mode.js?v=1.54.3"></script>','index.html')[0].asset,'story/tower-mode.js');
});

test('cache versions compare semantic components, reject missing/old tags and allow later releases',()=>{
  for(const version of [null,'','1.54.2','1.47.0','1.54.3-alpha','01.54.3','1.54','1.54.3-alpha.01'])assert.equal(freshEnough(version),false,String(version));
  for(const version of ['1.54.3','1.54.3+build.1','1.54.10','1.55.0','1.55.0-beta.1','2.0.0'])assert.equal(freshEnough(version),true,version);
});

test('old or absent tags on atlas helpers and party runtime are caught by the same real-entry parser',()=>{
  for(const entry of ['index.html','docs/職業裝備圖鑑.html']){
    const html=readFileSync(resolve(base,entry),'utf8'),refs=references(html,entry);
    const assets=['story/tower-party-runtime.js',...(entry.startsWith('docs/')?['docs/story-atlas-rules.js','docs/story-atlas-items.js','docs/story-atlas-cooperation.js']:[])];
    for(const asset of assets){
      const ref=refs.find(ref=>ref.asset===asset);assert.ok(ref,entry+' must parse '+asset);
      for(const source of [ref.source.replace(/([?&])v=[^&#]*/,'$1v=1.54.2'),ref.source.replace(/[?&]v=[^&#]*/,'')]){
        const simulated=references(html.replace(ref.source,source),entry).find(ref=>ref.asset===asset);
        assert.ok(simulated);assert.equal(freshEnough(simulated.version),false,entry+': '+source);
      }
    }
  }
});

for(const entry of ['index.html','docs/職業裝備圖鑑.html']){
  test(entry+' gives every referenced v1.54.3-changed JS/CSS a cache tag of at least '+minimum,()=>{
    const refs=references(readFileSync(resolve(base,entry),'utf8'),entry).filter(ref=>releaseAssets.has(ref.asset));
    assert.ok(refs.length>0,'Entry parser must inspect release assets');
    for(const ref of refs)assert.ok(freshEnough(ref.version),entry+': '+ref.source+' needs v >= '+minimum);
    // Only actual references are inspected: the atlas need not import gameplay
    // modules it does not use, and unchanged art may retain its historical tag.
  });
}
