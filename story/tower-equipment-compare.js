/* Read-only preview using the same combat formulas as an actual equip. */
(function(root){'use strict';
  function compare(H,run,id,item){
    if(!H.enabled(run)||!H.actor(run,id)||!H.GEAR[item?.kind]||!H.canEquip(run,id,item))return null;
    const current=H.equipment(run,id),next={...current,[item.slot]:item},state=H.state(run);
    const removesShield=item.slot==='weapon'&&H.GEAR[item.kind].hands===2&&!!next.shield;
    if(removesShield)next.shield=null;
    const actor={...H.actor(run,id),equipment:id===state.active?null:next};
    const preview={...run,equipment:id===state.active?next:run.equipment,party:{...run.party,loadouts:{...state,actors:{...state.actors,[id]:actor}}}};
    const before=H.stats(run,id),after=H.stats(preview,id);
    const fields=[['damage','物理',1,false],['spellDamage','法術',1,false],['armor','防禦',1,false],['interval','攻擊間隔',100,true],['heal','治療加成',100,false],['reach','射程',10,false]];
    const deltas=fields.map(([key,label,precision,lowerBetter])=>{const delta=Math.round((after[key]-before[key])*precision)/precision;return {key,label,delta,good:lowerBetter?delta<0:delta>0,unit:key==='interval'?'秒':key==='heal'?'%':key==='reach'?'公尺':''};}).filter(d=>Math.abs(d.delta)>.0001).map(d=>d.key==='heal'?{...d,delta:Math.round(d.delta*100)}:d);
    return {deltas,removesShield,broken:item.durability<=0,same:current[item.slot]?.id===item.id};
  }
  root.TowerEquipmentCompare={compare};if(typeof module==='object'&&module.exports)module.exports=root.TowerEquipmentCompare;
})(globalThis);
