/* Cosmetic joint tracks only. No combat rules, random draws, timers or GPU allocations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerCombatMotion=api;})(globalThis,function(){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const REST=Object.freeze({rx:-.25,ry:0,rz:-.08,lx:0,ly:0,lz:.05,wx:.25,wy:0,wz:.12,lwx:.25,lwy:0,lwz:-.12,wpx:0,wpy:0,wpz:0,lpx:0,lpy:0,lpz:0,lean:0,tilt:0,bookLift:0,bookTilt:0,bookPush:0,knee:0,bowRaise:0,bowDraw:0});
  // Author a swing plane, then turn blades around their handle so the sharp
  // +/-X edge follows that arc. Hammers use the same arc with their +Z face.
  // Converted once at module load; sampling remains scalar joint interpolation.
  function swing(p,angle,roll=0,twist=0){const ca=Math.cos(angle),sa=Math.sin(angle),cr=Math.cos(roll),sr=Math.sin(roll),ct=Math.cos(twist),st=Math.sin(twist),m13=cr*st+sr*sa*ct;return {...p,wx:Math.abs(m13)<.9999999?Math.atan2(cr*sa*ct-sr*st,ca*ct):Math.atan2(sa,cr*ca),wy:Math.asin(Math.max(-1,Math.min(1,m13))),wz:Math.abs(m13)<.9999999?Math.atan2(sr*ca,cr*ct-sr*sa*st):0};}
  // Local +Y handle twist after each knife's original Rx*Rz pose. Its +Y
  // tip/axis stays in exactly the same place, but +/-X edges replace the flat
  // face. The left follow-up adds .2 twist for its cross-body shoulder travel.
  function knifeCut(p){const out={...p};for(const wrist of ['w','lw']){const angle=p[wrist+'x'],roll=p[wrist+'z'],twist=Math.PI/2+(wrist==='lw'?.2:0),ca=Math.cos(angle),sa=Math.sin(angle),cr=Math.cos(roll),sr=Math.sin(roll),ct=Math.cos(twist),st=Math.sin(twist);out[wrist+'x']=Math.atan2(sa*ct-ca*sr*st,sa*sr*st+ca*ct);out[wrist+'y']=Math.asin(cr*st);out[wrist+'z']=Math.atan2(sr,cr*ct);}return out;}
  const WEAPONS=Object.freeze({
    // Blade is +Y, character faces +Z. First: high diagonal cut; second: level forward thrust.
    longsword:[[swing({rx:-2.1,ry:-.35,rz:-.62,wpy:.12,tilt:-.07},-.4,-.5,Math.PI/2),swing({rx:-1,ry:.25,rz:.48,wpz:.15,lean:.13,tilt:.08},1.9,-.5,Math.PI/2),swing({rx:-.55,rz:.72,wpy:-.1,lean:.1},2.3,-.5,Math.PI/2)],
      [{rx:-.7,ry:-.2,rz:-.16,wx:Math.PI/2,wz:0,wpz:-.12,lean:-.07},{rx:-1.6,ry:0,rz:0,wx:Math.PI/2,wz:0,wpz:.5,lean:.18},{rx:-1.15,rz:-.08,wx:Math.PI/2,wpz:.22,lean:.09}]],
    greatsword:[[swing({rx:-1.45,lx:-1.3,rz:.55,lz:-.85},.05,0,Math.PI/2),swing({rx:-.9,lx:-.95,rz:.65,lz:-.85,lean:.18},1.75,0,Math.PI/2),swing({rx:-.6,lx:-.75,rz:.65,lz:-.85},1.45,0,Math.PI/2)],
      [swing({rx:-1.5,lx:-1.35,rz:.3,lz:-.7,lean:-.04},.2,-.55,Math.PI/2),swing({rx:-.85,lx:-.8,rz:.7,lz:-.95,tilt:.1,lean:.15},1.75,-.55,Math.PI/2),swing({rx:-.65,lx:-.65,rz:.8,lz:-1},1.5,-.55,Math.PI/2)]],
    smith_hammer:[[{rx:-1.5,rz:-.25,wx:.12},{rx:-.75,rz:.1,wx:1.85,lean:.16},{rx:-.6,wx:1.35}],
      [swing({rx:-1.5,ry:-.15,rz:-.4},.15,.4),swing({rx:-.85,ry:.15,rz:.25,lean:.13,tilt:.07},1.8,.4),swing({rx:-.6,rz:.35},1.45,.4)]],
    warhammer:[[{rx:-1.8,lx:-1.65,rz:.6,lz:-.9,wx:.02,lean:-.08,knee:.15},{rx:-.7,lx:-.65,rz:.65,lz:-.9,wx:1.95,lean:.23,knee:.2},{rx:-.6,lx:-.6,rz:.65,lz:-.9,wx:1.5}],
      [swing({rx:-1.65,lx:-1.5,rz:.35,lz:-.7,lean:-.07,knee:.12},.1,-.4),swing({rx:-.8,lx:-.75,rz:.75,lz:-1,lean:.2,tilt:-.08,knee:.18},1.85,-.4),swing({rx:-.65,lx:-.6,rz:.8,lz:-1},1.5,-.4)]],
    // Pan's open bowl is +Z; its solid -Z bottom leads both the down-slap
    // (turned around the handle) and the rising slap.
    cooking_pan:[[{rx:-1.5,rz:-.2,wx:.12,wy:Math.PI,wz:.05},{rx:-.8,rz:.1,wx:1.85,wy:Math.PI,wz:-.05,lean:.12},{rx:-.55,wx:1.4,wy:Math.PI,wz:-.1}],
      [{rx:-.6,rz:-.2,wx:2.65,wz:0},{rx:-1.4,rz:.1,wx:1.8,wz:0,lean:.05},{rx:-1.1,wx:1.95,wz:0}]],
    // +Z is forward, the right shoulder is -X. Alternate a right-then-left
    // combination with a simultaneous inward X cut. Wrist Z signs deliberately
    // oppose the shoulders: the real blade tips cross in front, not behind us.
    twin_daggers:[[knifeCut({rx:-.7,lx:-.5,rz:-.25,lz:.2,wx:.5,lwx:.35,wz:-.12,lwz:.12,tilt:-.04}),knifeCut({rx:-1.6,lx:-.45,rz:.18,lz:.12,wx:1.57,lwx:.2,wz:-.12,lwz:.16,lean:.06,tilt:.045}),knifeCut({rx:-.45,lx:-1.6,rz:-.12,lz:-.18,wx:.2,lwx:1.57,wz:-.16,lwz:.12,lean:.06,tilt:-.045})],
      [{rx:-.9,lx:-.9,rz:-.85,lz:.85,wx:.7,lwx:.7,wz:.65,lwz:-.65,lean:-.025},{rx:-1.35,lx:-1.35,rz:.9,lz:-.9,wx:1.3,lwx:1.3,wz:-.8,lwz:.8,lean:.09},{rx:-1.15,lx:-1.15,rz:1,lz:-1,wx:1.15,lwx:1.15,wz:-1.05,lwz:1.05,lean:.075}]],
    arcane_staff:[[{rx:-1.7,lx:-1.25,rz:.45,lz:-.75,wx:.15,wpy:.12},{rx:-1.3,lx:-1,rz:.55,lz:-.85,wx:1.57,wpz:.16,lean:.05},{rx:-1,lx:-.75,rz:.55,lz:-.75,wx:1.25}],
      [{rx:-1.1,lx:-.65,rz:.55,lz:-.55,wx:.05,wpy:.2},{rx:-1.4,lx:-1.2,rz:.5,lz:-.85,wx:1.57,wpz:.26},{rx:-1.05,lx:-.75,rz:.55,lz:-.75,wx:1.2}]],
    spellbook:[[{rx:-1,lx:-1,rz:.5,lz:-.5,bookLift:.13,bookTilt:-.2},{rx:-1.65,lx:-1.1,rz:-.25,lz:-.5,bookLift:.18,bookTilt:.12,bookPush:.18},{rx:-1.15,lx:-1,rz:.15,lz:-.5,bookLift:.07}],
      [{rx:-1.05,lx:-1.05,rz:.45,lz:-.45,bookLift:.08,bookTilt:-.16},{rx:-1.45,lx:-1.45,rz:.55,lz:-.55,bookLift:.28,bookTilt:.08,bookPush:.3},{rx:-1,lx:-1.1,rz:.5,lz:-.5,bookLift:.1,bookPush:.1}]],
    // The archer's two-joint rig holds the bow ahead of the chest; the left
    // wrist draws its rear string. Scalar reach tracks also blend back to rest.
    elven_bow:[[{rx:-1.45,lx:-1.4,wx:0,wz:0,bowRaise:1,bowDraw:.03},{rx:-1.4,lx:-1.5,wx:0,wz:0,bowRaise:1,bowDraw:.08,lean:-.03},{rx:-1.2,lx:-1.25,wx:.05,wz:0,bowRaise:.9,bowDraw:-.04}],
      [{rx:-1.5,lx:-1.45,wx:0,wz:0,bowRaise:1,bowDraw:.04},{rx:-1.45,lx:-1.55,wx:0,wz:0,bowRaise:1,bowDraw:.07,lean:.02},{rx:-1.25,lx:-1.3,wx:.05,wz:0,bowRaise:.85,bowDraw:-.04}]],
    // Knuckles stay aimed +Z while the shoulder throws a straight right and
    // a left body-hook. Both punches originate ahead of the chest, never a
    // handle swing; the off hand covers the core during the striking phase.
    robot_fists:[[{rx:-.72,lx:-.68,ry:-.18,rz:-.16,lz:.12,wx:0,lwx:0,wz:0,lwz:0,lean:-.045},{rx:-1.48,lx:-.64,ry:0,rz:0,lz:.2,wx:0,lwx:0,wz:0,lwz:0,wpz:.20,lean:.13},{rx:-.78,lx:-.73,wx:0,lwx:0,wz:0,lwz:0}],
      [{rx:-.62,lx:-.85,rz:-.2,lz:.5,ly:.20,wx:0,lwx:0,wz:0,lwz:0,tilt:.055},{rx:-.7,lx:-1.38,rz:-.2,lz:-.13,ly:-.1,wx:0,lwx:0,wz:0,lwz:0,lpz:.18,lean:.105,tilt:-.045},{rx:-.69,lx:-.72,wx:0,lwx:0,wz:0,lwz:0}]],
    unarmed:[[{rx:-.55,rz:-.3},{rx:-1.55,rz:0,lean:.1},{rx:-.65}], [{lx:-.55,lz:.3},{lx:-1.55,lz:0,lean:.1},{lx:-.65}]]
  });
  const FAMILIES=Object.freeze({arrow:'bow',binding:'bow',volley:'bow',great_arrow:'bow',cleave:'slash',circle:'spin',blind:'thrust',stun:'heavy',stagger:'heavy',splash:'cook',bolt:'cast',weak:'cast',slow:'thrust',mark:'thrust',shock:'cast',thorns:'cast',repel:'ward',starfall:'cast',star_ring:'cast',decisive:'heavy',guard:'ward',barrier:'ward',ward:'ward',fortify:'forge',fortress:'deploy',rally:'rally',speed:'cook',polish:'forge',stealth:'scout',smoke:'scout',stomach:'cook',meal:'cook',soup:'cook',feast:'cook',heal:'heal',revive:'heal',cleanse:'heal',sanctuary:'heal',reveal:'scout',escape:'scout',disarm:'deploy',daylight:'cast',repair:'forge',frost:'cast',taunt:'rally',barricade:'deploy',robot_fist:'punch',robot_charge:'charge_run',robot_quake:'ground_slam',robot_guard:'machine_guard',robot_speed:'maintenance',robot_restore:'maintenance',robot_meteor:'ground_slam',robot_double:'double_punch',mech_aid:'core_aid'});
  const ROBOT_FAMILIES=Object.freeze({flying_fist:'punch',iron_charge:'charge_run',shoulder_quake:'ground_slam',folded_guard:'machine_guard',joint_oil:'maintenance',parts_restore:'maintenance',steel_meteor_fist:'ground_slam',explosive_fists:'double_punch',mech_aid:'core_aid'});
  const SKILL_TRACKS={
    cast:[{rx:-1.6,lx:-1.2,rz:.4,lz:-.6,wx:.1,bookLift:.12},{rx:-1.65,lx:-1.25,rz:-.25,lz:.25,wx:Math.PI/2,wz:0,bookLift:.2,bookPush:.18,lean:.05},{rx:-1.05,lx:-.8,wx:1.2}],
    heal:[{rx:-1,lx:-1,rz:.25,lz:-.25,bookLift:.1},{rx:-1.5,lx:-1.5,rz:-.4,lz:.4,wx:.65,bookLift:.2,bookTilt:-.1},{rx:-1.15,lx:-1.15,rz:-.15,lz:.15}],
    ward:[{rx:-.7,lx:-.9,rz:.3,lz:-.2},{rx:-1.2,lx:-1.5,rz:-.25,lz:.2,wx:.9,lean:-.04},{rx:-.8,lx:-1.1,rz:-.1,lz:.1}],
    rally:[{rx:-.75,lx:-.5,wx:.2},{rx:-2.15,lx:-1.3,rz:-.2,lz:.25,wx:.15,lean:-.06},{rx:-1.3,lx:-.6}],
    cook:[{rx:-.85,lx:-.85,wx:.9,bookLift:0},{rx:-1.3,lx:-1.1,ry:.35,rz:.15,lz:-.2,wx:1.4,wz:.5,lean:.06},{rx:-1,lx:-.85,ry:-.3,wx:1.2,wz:-.35}],
    forge:[{rx:-1.5,lx:-1.15,wx:.12,knee:.08},{rx:-.8,lx:-1.15,wx:1.8,lean:.18,knee:.16},{rx:-1.25,lx:-1.1,wx:.55}],
    deploy:[{rx:-.8,lx:-.8,wx:.8,lean:.12,knee:.18},{rx:-1.1,lx:-1.1,rz:.2,lz:-.2,wx:1.35,lean:.24,knee:.32},{rx:-.9,lx:-.9,wx:.8,lean:.12,knee:.15}],
    scout:[{rx:-.5,lx:-.4,rz:-.25},{rx:-1.2,lx:-.85,ry:.5,rz:-.6,lz:.45,wx:1.1,tilt:-.05},{rx:-.6,lx:-.5,ry:-.3,wx:.6}],
    thrust:[{rx:-.65,lx:-.55,wx:.7},{rx:-1.6,lx:-.85,wx:1.6,lean:.12},{rx:-.8,lx:-1,wx:1}],
    // Level sweep: blade +Y reaches forward while its +/-X cutting edges
    // lead the lateral motion. Never roll the flat face into the target.
    spin:[{rx:-1.2,lx:-1.1,ry:-.3,rz:.25,lz:-.65,wx:Math.PI/2,wy:0,wz:-1.15,tilt:-.04},{rx:-1.45,lx:-1.25,ry:.25,rz:.55,lz:-.85,wx:Math.PI/2,wy:0,wz:1.15,lean:.08,tilt:.04},{rx:-1.2,lx:-1.1,rz:.6,lz:-.9,wx:Math.PI/2,wy:0,wz:1.55}],
    punch:[{rx:-.75,lx:-.6,ry:-.18,wx:0,lwx:0,wz:0,lwz:0,lean:-.06},{rx:-1.55,lx:-.7,wx:0,lwx:0,wz:0,lwz:0,wpz:.27,lean:.12},{rx:-1.0,lx:-.65,wx:0,lwx:0,wz:0,lwz:0}],
    charge_run:[{rx:-.65,lx:-.65,rz:-.35,lz:.35,wx:0,lwx:0,wz:0,lwz:0,lean:-.08,knee:.22},{rx:-1.15,lx:-1.15,rz:-.1,lz:.1,wx:0,lwx:0,wz:0,lwz:0,lean:.24,knee:.17},{rx:-.8,lx:-.8,wx:0,lwx:0,wz:0,lwz:0,lean:.09}],
    ground_slam:[{rx:-2.25,lx:-1.15,rz:-.1,lz:.25,wx:0,lwx:0,wz:0,lwz:0,lean:-.10,knee:.18},{rx:-.48,lx:-.48,wx:0,lwx:0,wz:0,lwz:0,wpy:-.27,lpy:-.10,lean:.25,knee:.32},{rx:-.78,lx:-.7,wx:0,lwx:0,wz:0,lwz:0,lean:.12,knee:.13}],
    machine_guard:[{rx:-.9,lx:-.9,rz:.38,lz:-.38,wx:0,lwx:0,wz:0,lwz:0},{rx:-1.1,lx:-1.1,rz:.55,lz:-.55,wx:0,lwx:0,wz:0,lwz:0,wpy:.15,lpy:.15,lean:-.035,knee:.12},{rx:-1.05,lx:-1.05,rz:.5,lz:-.5,wx:0,lwx:0,wz:0,lwz:0}],
    maintenance:[{rx:-.85,lx:-.5,rz:.25,lz:-.1,wx:0,lwx:0,wz:0,lwz:0},{rx:-1.15,lx:-.9,rz:.5,lz:-.3,wx:0,lwx:0,wz:0,lwz:0,lean:.04},{rx:-.8,lx:-.75,rz:.2,lz:-.15,wx:0,lwx:0,wz:0,lwz:0}],
    double_punch:[{rx:-.9,lx:-.9,rz:-.28,lz:.28,wx:0,lwx:0,wz:0,lwz:0,lean:-.06},{rx:-1.47,lx:-.72,wx:0,lwx:0,wz:0,lwz:0,wpz:.18,lean:.12},{rx:-.72,lx:-1.47,wx:0,lwx:0,wz:0,lwz:0,lpz:.18,lean:.12}],
    core_aid:[{rx:-.9,lx:-.9,rz:.3,lz:-.3,wx:0,lwx:0,wz:0,lwz:0},{rx:-1.3,lx:-1.3,rz:-.25,lz:.25,wx:0,lwx:0,wz:0,lwz:0,wpy:.09,lpy:.09,lean:-.02},{rx:-.85,lx:-.85,wx:0,lwx:0,wz:0,lwz:0}],
  };
  // Greatsword support grips must remain reachable during support gestures,
  // not just ordinary strikes. Keep the weapon over the body centerline and
  // reuse the authored two-hand diagonal sweep for the circular skill.
  const TWO_HAND_SKILLS=Object.freeze({spin:WEAPONS.greatsword[1],ward:SKILL_TRACKS.ward.map(p=>({...p,rz:.65})),rally:SKILL_TRACKS.rally.map(p=>({...p,rz:.65}))});
  const motionFamilies=new Set(Object.values(FAMILIES));
  const familyFor=skill=>ROBOT_FAMILIES[skill?.id]||(motionFamilies.has(skill?.presentation?.motion)?skill.presentation.motion:FAMILIES[skill?.effect]||'');
  function rest(kind,shield){const p={...REST};if(shield)p.lx=-.35;if(['greatsword','warhammer','arcane_staff'].includes(kind)){p.rx=-.35;p.lx=-.5;p.rz=.65;p.lz=-.9;}if(['longsword','greatsword'].includes(kind)){p.wy=Math.PI/2;p.wz=0;}if(kind==='spellbook'){p.rx=p.lx=-1;p.rz=.5;p.lz=-.5;}if(kind==='elven_bow'){p.rx=-.7;p.lx=-.35;p.wx=0;}if(kind==='robot_fists'){p.rx=p.lx=-.64;p.rz=-.14;p.lz=.14;p.wx=p.lwx=p.wz=p.lwz=0;}return p;}
  function sample(kind,action='attack',variant=0,progress=1,shield=false,family='',out={}){
    kind=kind.replace(/_t[2-5]$/,'');
    const base=rest(kind,shield),track=(WEAPONS[kind]||WEAPONS.unarmed)[variant%2];let poses=track;
    if(action==='skill'||action==='charge'){poses=family==='bow'?WEAPONS.elven_bow[variant%2]:family==='slash'?(kind==='greatsword'?WEAPONS.greatsword[0]:WEAPONS.longsword[0]):family==='heavy'?track:family==='thrust'&&['longsword','greatsword'].includes(kind)?WEAPONS.longsword[1]:family==='thrust'&&kind==='twin_daggers'?WEAPONS.twin_daggers[0]:SKILL_TRACKS[family]||SKILL_TRACKS.cast;}
    if((action==='skill'||action==='charge')&&kind==='greatsword'&&TWO_HAND_SKILLS[family])poses=TWO_HAND_SKILLS[family];
    const t=clamp(progress);if(action!=='charge'&&t===1){Object.assign(out,base);return out;}
    if(action==='charge'){const prep=poses[0],amount=Math.min(1,t*5);for(const k in base)out[k]=base[k]+((prep[k]??base[k])-base[k])*amount;return out;}
    const times=[0,.22,.48,.7,1],frames=[base,poses[0],poses[1],poses[2],base];let i=0;while(i<3&&t>times[i+1])i++;const u=clamp((t-times[i])/(times[i+1]-times[i])),smooth=u*u*(3-2*u);
    for(const k in base){const a=frames[i][k]??base[k],b=frames[i+1][k]??base[k];out[k]=a+(b-a)*smooth;}return out;
  }
  function state(model){return model.userData.combatMotion||(model.userData.combatMotion={counts:{},action:'',elapsed:0,duration:1,variant:0,family:'',pose:{}});}
  function begin(model,action,duration,skill){if(!model?.userData)return false;const s=state(model),kind=model.userData.heroWeapon||'unarmed';s.action=action;s.duration=Math.max(.1,Math.min(4,Number(duration)||.65));s.elapsed=0;s.family=familyFor(skill);s.skillId=skill?.id||'';if(action==='attack'){s.variant=s.counts[kind]||0;s.counts[kind]=(s.variant+1)%2;}else s.variant=0;return true;}
  function cancel(model){if(model?.userData.combatMotion){const s=state(model);s.action='';s.elapsed=s.duration;}}
  function update(model,dt=0){const s=state(model);s.elapsed=Math.min(s.duration,s.elapsed+Math.max(0,Math.min(.1,Number(dt)||0)));if(s.elapsed>=s.duration)s.action='';return sample(model.userData.heroWeapon||'unarmed',s.action||'attack',s.variant,s.action?s.elapsed/s.duration:1,model.userData.hasShield,s.family,s.pose);}
  return Object.freeze({WEAPONS,FAMILIES,ROBOT_FAMILIES,familyFor,sample,begin,cancel,update,state});
});
