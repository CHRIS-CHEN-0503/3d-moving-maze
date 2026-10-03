import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../story/story-core.js'),P=require('../story/tower-party-core.js'),H=require('../story/tower-heroes-core.js');
const source=readFileSync(new URL('../story/tower-mode.js',import.meta.url),'utf8');
const saveSource=source.slice(source.indexOf('  function save()'),source.indexOf('  function canCollectOriginal'));
const SAVE='maze3d_tower_v1',backup=SAVE+'_before_core_expiry_v1';
const fresh=()=>H.enable(P.enable(C.newRun({seed:35,name:'核心耗盡備份'}),'robot').run).run;
function harness(raw,run,failure='none',previousBackup){
  const storage=new Map([[SAVE,raw]]);if(previousBackup!==undefined)storage.set(backup,previousBackup);let fail=failure!=='none';
  const context=vm.createContext({C,Heroes:H,run,SAVE,saveFailed:false,syncEngine(){},showToast(){},localStorage:{
    getItem(k){if(fail&&(failure==='read-main'&&k===SAVE||failure==='read-backup'&&k===backup))throw Error('storage read');return storage.get(k)||null;},
    setItem(k,v){if(fail&&(failure==='write-backup'&&k===backup||failure==='write-main'&&k===SAVE))throw Error('quota');storage.set(k,v);}
  }});vm.runInContext(saveSource,context);return {storage,context,recover(){fail=false;}};
}
test('the actual save function backs up exact expired-core raw once before writing the pruned journey',()=>{
  for(const location of ['active','bag','inactive','traveller']){
    let original=fresh();
    if(location==='bag'){original.gearBag.push(C.createGear('robot_core',99,original.seed,'expired-backup'));original.gearBag[0].durability=0;}
    else if(location==='active')original.equipment.core1.durability=0;
    else{
      const member={id:'backup-robot',profession:'robot',sex:'female',level:1,hp:34,cooldown:0,hurtLeft:0};original.party.members.push(member);original.party.joined.push(member.id);H.addMember(original,member);
      if(location==='inactive')H.equipment(original,member.id).core1.durability=0;
      else{original=P.dismiss(original,member.id).run;original.party.travellers[0].loadout.robotEquipment.core1.durability=0;}
    }
    const raw=JSON.stringify(original,null,2),run=C.validateSave(raw);assert.ok(run,location);assert.equal(H.ROBOT.needsCoreExpiryMigration(run),false);
    const {storage,context}=harness(raw,run);assert.equal(context.save(),true,location);assert.equal(storage.get(backup),raw);assert.equal(storage.get(SAVE),JSON.stringify(run));assert.equal(context.save(),true);assert.equal(storage.get(backup),raw);assert.deepEqual(C.validateSave(storage.get(SAVE)),run);
  }
});
test('expired-core backup or main-save failures preserve the old main file and never mutate the in-memory run',()=>{
  for(const failure of ['read-main','read-backup','write-backup','write-main']){
    const original=fresh();original.equipment.core1.durability=0;const raw=JSON.stringify(original,null,2),run=C.validateSave(raw),before=JSON.stringify(run);
    const {storage,context,recover}=harness(raw,run,failure);assert.equal(context.save(),false,failure);assert.equal(storage.get(SAVE),raw);assert.equal(JSON.stringify(context.run),before);assert.equal(storage.get(backup),failure==='write-main'?raw:undefined);
    recover();assert.equal(context.save(),true);assert.equal(storage.get(backup),raw);assert.equal(H.ROBOT.needsCoreExpiryMigration(C.validateSave(storage.get(SAVE))),false);assert.equal(context.save(),true);assert.equal(storage.get(backup),raw);
  }
});
test('preexisting expiry backups remain unchanged and healthy/current cores do not create a migration backup',()=>{
  const expired=fresh();expired.equipment.core1.durability=0;const raw=JSON.stringify(expired),run=C.validateSave(raw);
  const oldBackup='Earlier exact raw core expiry record',existing=harness(raw,run,'none',oldBackup);assert.equal(existing.context.save(),true);assert.equal(existing.storage.get(backup),oldBackup);
  for(const durability of [100,1]){const healthy=fresh();healthy.equipment.core1.durability=durability;const current=harness(JSON.stringify(healthy),healthy);assert.equal(current.context.save(),true);assert.equal(current.storage.has(backup),false);}
});
