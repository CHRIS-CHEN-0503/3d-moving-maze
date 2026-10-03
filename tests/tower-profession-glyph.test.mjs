import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url),Icons=require('../story/tower-heroes-icons.js');
const context=vm.createContext({TowerHeroIcons:Icons});
vm.runInContext(readFileSync(new URL('../story/tower-party-runtime.js',import.meta.url),'utf8'),context);

test('all eight profession glyphs use the shared compact roster sizing class',()=>{
  for(const job of ['swordsman','mage','scout','chef','healer','smith','archer','robot']){
    const svg=context.TowerPartyRuntime.portrait(job);
    assert.match(svg,/^<svg class="party-glyph" /,job);
    assert.doesNotMatch(svg,/class="hero-icon"/,job);
    assert.match(svg,/aria-hidden="true"/);
  }
});

test('robot roster sizing preserves the original illustration and all full-size item icons',()=>{
  const original=Icons.svg('job_robot');
  assert.equal(context.TowerPartyRuntime.portrait('robot'),original.replace('class="hero-icon"','class="party-glyph"'));
  assert.match(Icons.svg('robot'),/^<svg class="hero-icon" /);
  assert.equal(Icons.svg('job_robot'),original);
});
