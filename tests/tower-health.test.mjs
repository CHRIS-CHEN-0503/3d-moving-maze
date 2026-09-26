import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const C=createRequire(import.meta.url)('../story/story-core.js');
const E=createRequire(import.meta.url)('../story/tower-encounters.js');
test('無敵時傷害不扣生命、消耗防具或復甦羽；寶箱仍僅能領取一次',()=>{
  const run=C.newRun({seed:17}),gear=C.createGear('armor',99,17,'a');run.equipment.armor=gear;run.bag.feather=1;
  const before=JSON.stringify(run),result=C.applyDamage(run,999,'monster',true);assert.equal(result.effect.protected,true);assert.equal(JSON.stringify(run),before);
  let seed=1,offer;while(seed<10000){offer=E.chestOffer(99,seed);if(offer?.outcome==='trap')break;seed++;}
  const chestRun=C.newRun({seed}),opened=E.openChest(chestRun,offer.id,chestRun.revision,true);
  assert.equal(opened.run.hp,60);assert.equal(opened.effect.damage,0);assert.equal(opened.effect.protected,true);
  assert.equal(E.openChest(opened.run,offer.id,opened.run.revision).ok,false);
});
test('劇情生命60，飽食100；療癒和復甦遵守上限',()=>{
  const run=C.newRun({seed:17});assert.equal(C.MAX_HP,60);assert.equal(run.hp,60);assert.equal(run.hunger,100);
  assert.equal(C.useItem(run,'heal').ok,false);assert.equal(run.bag.heal,2);
  for(const [hp,expected] of [[1,36],[40,60],[59,60]]){
    const healed=C.useItem({...run,hp},'heal');assert.equal(healed.run.hp,expected);assert.ok(C.validateSave(healed.run));
  }
  const revived=C.takeDamage({...run,bag:{...run.bag,feather:1}},1000);
  assert.equal(revived.run.hp,50);assert.equal(revived.effect.revived,true);assert.ok(C.validateSave(revived.run));
});
test('舊存檔生命按比例遷移一次，保留所有非生命資料且不修改原物件',()=>{
  for(const hp of [100,80,50,1,.1,0]){
    const legacy={...C.newRun({seed:17}),stateVersion:1,hp,status:hp?'playing':'dead'};
    const before=structuredClone(legacy),next=C.validateSave(JSON.stringify(legacy));
    assert.ok(next);assert.equal(next.stateVersion,2);assert.equal(next.hp,hp*60/100);
    assert.deepEqual({...next,stateVersion:1,hp},legacy);assert.deepEqual(legacy,before);
    assert.deepEqual(C.validateSave(next),next,'重讀不能再次縮減');
  }
});
test('拒絕新版超量生命與損壞舊存檔；正常交易和換層不恢復舊上限',()=>{
  const run=C.newRun({seed:17});
  for(const hp of [60.1,100,-1,NaN,Infinity])assert.equal(C.validateSave({...run,hp}),null);
  for(const hp of [101,-1,NaN])assert.equal(C.validateSave({...run,stateVersion:1,hp}),null);
  assert.equal(C.validateSave({...run,stateVersion:1,hp:0,status:'playing'}),null);
  const migrated=C.collect({...run,stateVersion:1,hp:80},'coin',1).run;
  assert.equal(migrated.hp,48);assert.equal(C.collect(migrated,'coin',1).run.hp,48);
  assert.equal(C.descend(migrated).run.hp,48);
});
test('四種怪物傷害不變，但無防具滿血能承受的命中次數降低',()=>{
  const expected={clockmite:8,sentinel:4,wisp:6,hound:4};
  for(const [kind,count] of Object.entries(expected)){
    let run=C.newRun({seed:17}),hits=0;
    while(run.status==='playing'&&hits<20){run=C.takeDamage(run,C.MONSTERS[kind].damage).run;hits++;}
    assert.equal(hits,count);assert.equal(run.status,'dead');
  }
});
test('生命介面、背包和重試統一使用核心生命上限',()=>{
  const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
  assert.match(source,/towerHealth[^\n]*C.MAX_HP/);assert.match(source,/max="'\+C.MAX_HP\+'/);
  assert.match(source,/旅人背包[^\n]*C.MAX_HP/);assert.match(source,/key==='retry'[^\n]*run.hp=C.MAX_HP/);
  assert.doesNotMatch(source,/run.hp=100|run.hp\)\s*\+\s*' \/ 100/);
});
