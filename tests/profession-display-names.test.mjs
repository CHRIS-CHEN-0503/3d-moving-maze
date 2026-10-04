import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),H=require('../story/tower-heroes-core.js'),P=require('../story/tower-party-core.js'),C=require('../story/story-core.js'),F=require('../story/tower-field-guide.js'),D=require('../docs/story-atlas-rules.js');
require('../story/tower-party-runtime.js');

test('ranger display names agree across professions, guides and the atlas without renaming scout IDs',()=>{
  for(const spec of [H.JOBS.scout,P.PROFESSIONS.scout,F.profession('scout'),D.profession('scout')])assert.equal(spec.name,'遊俠');
  for(const id of ['backstab','throw_blade','path_eye','disarm','stealth','smoke'])assert.equal(H.SKILLS[id].job,'scout');
  for(const id of ['fleet','intuition','trap_sense'])assert.equal(H.PASSIVES[id].job,'scout');
  assert.deepEqual(H.GEAR.twin_daggers.jobs,['scout']);assert.equal(H.JOBS.scout.starter,'twin_daggers');
  assert.equal(H.enable(P.enable(C.newRun({seed:19}),'scout').run).run.party.profession,'scout');
  for(const path of ['../story/tower-party-core.js','../story/tower-heroes-core.js','../story/tower-expedition-core.js','../story/tower-cooperation-core.js','../story/tower-field-guide.js','../docs/隊伍作業效果.md','../docs/主角成長與自動戰鬥.md'])assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),'utf8'),/斥候/);
});

test('dwarf smith appearance is catalog text, not a new saved race or combat bonus',()=>{
  assert.equal(H.JOBS.smith.name,'鍛匠');assert.equal(P.PROFESSIONS.smith.name,'鍛匠');
  assert.match(H.JOBS.smith.description,/矮人族.*男女均.*職業能力相同/);assert.match(P.PROFESSIONS.smith.description,/矮人族/);assert.match(F.profession('smith').innate,/矮人族/);
  const atlas=D.profession('smith');assert.match(atlas.description,/矮人族/);assert.equal(atlas.details.find(r=>r.label==='人物設定').value,H.JOBS.smith.description);
  const run=H.enable(P.enable(C.newRun({seed:19}),'smith').run).run;assert.equal(run.party.profession,'smith');assert.ok(C.validateSave(run));assert.doesNotMatch(JSON.stringify(run),/矮人族/);
  assert.equal(H.JOBS.smith.armor,'heavy');assert.equal(H.JOBS.smith.starter,'smith_hammer');assert.deepEqual(H.GEAR.smith_hammer.jobs,['smith']);assert.equal(H.GEAR.smith_hammer.damage,8);
});
