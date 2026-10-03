import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),game=readFileSync(new URL('index.html',root),'utf8'),atlas=readFileSync(new URL('docs/職業裝備圖鑑.html',root),'utf8');
const sharedChangedRules=['tower-foraging','tower-cooperation-core','tower-cooperation-runtime'];
const rules=['tower-affixes','tower-adventure-events','tower-landmarks',...sharedChangedRules];
function references(html){return [...html.matchAll(/(?:src|href)="([^"?]+)\?v=([^"]+)"/g)].map(([,path,version])=>({path:path.replace(/^\.\//,''),version}));}
test('v1.55.0 gameplay additions have versioned real entrypoints in both game and atlas',()=>{
  for(const name of rules){for(const [html,prefix]of [[game,'story/'],[atlas,'../story/']])assert.equal(references(html).find(r=>r.path===prefix+name+'.js')?.version,'1.55.0',prefix+name);}
  for(const name of ['mode-variants-core','mode-variants','shop-claims-core','shop-claims','shop-collection','shop-collection-core','setup-controls','game-rules','capture-mode'])assert.equal(references(game).find(r=>r.path==='assets/'+name+'.js')?.version,'1.55.0',name);
  assert.equal(references(game).find(r=>r.path==='story/tower-floor-lords.js')?.version,'1.55.0');
  assert.equal(references(atlas).find(r=>r.path==='story-atlas-cooperation.js')?.version,'1.55.0');
  assert.match(game,/const GAME_VERSION='1\.55\.0'/);assert.match(atlas,/v1\.55\.0 圖鑑/);
});
test('changed shared atlas rules reject both stale and absent cache tags',()=>{
  for(const path of [...sharedChangedRules.map(name=>'../story/'+name+'.js'),'story-atlas-cooperation.js']){
    const source=path+'?v=1.55.0';
    assert.equal(references(atlas).filter(r=>r.path===path).length,1,path+' must have exactly one real entry');
    for(const stale of ['?v=1.54.3','']){
      const simulated=references(atlas.replace(source,path+stale)).find(r=>r.path===path);
      assert.notEqual(simulated?.version,'1.55.0',path+stale);
    }
  }
});
