/* Cosmetic joint tracks only. No combat rules, random draws, timers or GPU allocations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerCombatMotion=api;})(globalThis,function(){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const REST=Object.freeze({rx:-.25,ry:0,rz:-.08,lx:0,ly:0,lz:.05,wx:.25,wy:0,wz:.12,lwx:.25,lwy:0,lwz:-.12,lean:0,tilt:0,bookLift:0,bookTilt:0,knee:0});
  const WEAPONS=Object.freeze({
    longsword:[[{rx:-.55,ry:-.55,rz:-.5,wx:.5,wy:-.7,wz:-.8},{rx:-1.35,ry:.45,rz:.35,wx:1.55,wy:.65,wz:.5},{rx:-.7,rz:.55,wx:1.2,wy:.8}],
      [{rx:-1.5,rz:-.2,wx:.2,wz:-.2},{rx:-1.05,ry:-.35,wx:1.8,wy:-.3,wz:-.45,lean:.12},{rx:-.6,rz:-.3,wx:1.4}]],
    greatsword:[[{rx:-1.45,lx:-1.3,rz:.55,lz:-.85,wx:.05},{rx:-.9,lx:-.95,rz:.65,lz:-.85,wx:1.75,lean:.18},{rx:-.6,lx:-.75,rz:.65,lz:-.85,wx:1.45}],
      [{rx:-.75,lx:-.7,rz:.25,lz:-.7,wy:-.6,wz:-.6},{rx:-1.1,lx:-1,rz:.7,lz:-.95,wx:1.6,wy:.65,wz:.65,tilt:.1},{rx:-.7,lx:-.65,rz:.8,lz:-1,wx:1.4,wy:.5}]],
    smith_hammer:[[{rx:-1.5,rz:-.25,wx:.12},{rx:-.75,rz:.1,wx:1.85,lean:.16},{rx:-.6,wx:1.35}],
      [{rx:-.5,ry:-.6,rz:-.55,wx:.55,wz:-.7},{rx:-1.2,ry:.35,rz:.4,wx:1.5,wz:.6,tilt:.1},{rx:-.55,rz:.35,wx:1.2}]],
    warhammer:[[{rx:-1.8,lx:-1.65,rz:.6,lz:-.9,wx:.02,lean:-.08,knee:.15},{rx:-.7,lx:-.65,rz:.65,lz:-.9,wx:1.95,lean:.23,knee:.2},{rx:-.6,lx:-.6,rz:.65,lz:-.9,wx:1.5}],
      [{rx:-.65,lx:-.55,rz:.3,lz:-.65,wx:.65,wy:-.55,wz:-.35},{rx:-1,lx:-.9,rz:.75,lz:-1,wx:1.7,wy:.5,wz:.3,tilt:.16},{rx:-.65,lx:-.6,rz:.8,lz:-1,wx:1.25,wy:.4}]],
    cooking_pan:[[{rx:-.65,ry:-.5,rz:-.45,wx:.45,wz:-.8},{rx:-1.1,ry:.5,rz:.3,wx:1.65,wz:.65},{rx:-.65,rz:.4,wx:1.3}],
      [{rx:-.55,rz:-.2,wx:.5,wz:.2},{rx:-1.55,rz:.1,wx:.95,wy:.2,lean:.1},{rx:-1,wx:1.2,wz:-.2}]],
    twin_daggers:[[{rx:-.8,lx:-.3,rz:-.35,lz:.3,wx:.6,lwx:.3},{rx:-1.45,lx:-.8,rz:.1,lz:.4,wx:1.65,lwx:1.2,lean:.08},{rx:-.65,lx:-1.4,rz:-.25,lz:.05,wx:.9,lwx:1.6}],
      [{rx:-.3,lx:-.8,rz:-.3,lz:.35,wx:.3,lwx:.6},{rx:-.8,lx:-1.45,rz:-.4,lz:-.1,wx:1.2,lwx:1.65,lean:.08},{rx:-1.4,lx:-.65,rz:-.05,lz:.25,wx:1.6,lwx:.9}]],
    arcane_staff:[[{rx:-1.2,lx:-1,rz:.5,lz:-.75,wx:.15},{rx:-1.15,lx:-1,rz:.65,lz:-.9,wx:1.15,lean:.07},{rx:-.75,lx:-.6,rz:.65,lz:-.85,wx:.7}],
      [{rx:-.5,lx:-.4,rz:.55,lz:-.7,wx:.5,wz:-.3},{rx:-1.4,lx:-1.1,rz:.65,lz:-.9,wx:.85,wz:.2},{rx:-1,lx:-.7,rz:.65,lz:-.85,wx:.35}]],
    spellbook:[[{rx:-.95,lx:-1,rz:.5,lz:-.5,bookLift:.04,bookTilt:-.12},{rx:-1.55,lx:-1,rz:-.25,lz:-.5,wx:1.1,bookLift:.1,bookTilt:.12},{rx:-1.2,lx:-1,rz:.15,lz:-.5,bookLift:.05}],
      [{rx:-1,lx:-1.1,rz:.5,lz:-.5,bookLift:.13,bookTilt:-.18},{rx:-1.25,lx:-1.3,rz:.65,lz:-.65,bookLift:.2,bookTilt:.16},{rx:-1,lx:-1.1,rz:.5,lz:-.5,bookLift:.1}]],
    elven_bow:[[{rx:-1.45,lx:-1.1,ry:-.15,ly:.65,wx:0,lwx:.9},{rx:-1.5,lx:-1.3,ry:.1,ly:.9,wx:0,lwx:1.1,lean:-.05},{rx:-1.35,lx:-.65,ly:.25,wx:.15}],
      [{rx:-1.3,lx:-1.1,rz:-.1,lz:.2,ly:.65,wx:0},{rx:-1.4,lx:-1.35,rz:-.2,lz:.25,ly:.95,wx:0,lean:.03},{rx:-1.25,lx:-.7,ly:.2,wx:.1}]],
    unarmed:[[{rx:-.55,rz:-.3},{rx:-1.55,rz:0,lean:.1},{rx:-.65}], [{lx:-.55,lz:.3},{lx:-1.55,lz:0,lean:.1},{lx:-.65}]]
  });
  const FAMILIES=Object.freeze({arrow:'bow',binding:'bow',volley:'bow',great_arrow:'bow',cleave:'slash',circle:'spin',blind:'thrust',stun:'heavy',stagger:'heavy',splash:'cook',bolt:'cast',weak:'cast',slow:'thrust',mark:'thrust',shock:'cast',repel:'ward',starfall:'cast',star_ring:'cast',decisive:'heavy',guard:'ward',barrier:'ward',ward:'ward',fortify:'forge',fortress:'deploy',rally:'rally',speed:'cook',polish:'forge',stealth:'scout',smoke:'scout',stomach:'cook',meal:'cook',soup:'cook',feast:'cook',heal:'heal',revive:'heal',cleanse:'heal',sanctuary:'heal',reveal:'scout',escape:'scout',disarm:'deploy',daylight:'cast',repair:'forge',frost:'cast',taunt:'rally',barricade:'deploy'});
  const SKILL_TRACKS={
    cast:[{rx:-1.6,lx:-1.2,rz:.4,lz:-.6,wx:.1,bookLift:.12},{rx:-1.65,lx:-1.25,rz:-.25,lz:.25,wx:1.2,bookLift:.2,lean:.05},{rx:-1.05,lx:-.8,wx:.65}],
    heal:[{rx:-1,lx:-1,rz:.25,lz:-.25,bookLift:.1},{rx:-1.5,lx:-1.5,rz:-.4,lz:.4,wx:.65,bookLift:.2,bookTilt:-.1},{rx:-1.15,lx:-1.15,rz:-.15,lz:.15}],
    ward:[{rx:-.7,lx:-.9,rz:.3,lz:-.2},{rx:-1.2,lx:-1.5,rz:-.25,lz:.2,wx:.9,lean:-.04},{rx:-.8,lx:-1.1,rz:-.1,lz:.1}],
    rally:[{rx:-.75,lx:-.5,wx:.2},{rx:-2.15,lx:-1.3,rz:-.2,lz:.25,wx:.15,lean:-.06},{rx:-1.3,lx:-.6}],
    cook:[{rx:-.85,lx:-.85,wx:.9,bookLift:0},{rx:-1.3,lx:-1.1,ry:.35,rz:.15,lz:-.2,wx:1.4,wz:.5,lean:.06},{rx:-1,lx:-.85,ry:-.3,wx:1.2,wz:-.35}],
    forge:[{rx:-1.5,lx:-1.15,wx:.12,knee:.08},{rx:-.8,lx:-1.15,wx:1.8,lean:.18,knee:.16},{rx:-1.25,lx:-1.1,wx:.55}],
    deploy:[{rx:-.8,lx:-.8,wx:.8,lean:.12,knee:.18},{rx:-1.1,lx:-1.1,rz:.2,lz:-.2,wx:1.35,lean:.24,knee:.32},{rx:-.9,lx:-.9,wx:.8,lean:.12,knee:.15}],
    scout:[{rx:-.5,lx:-.4,rz:-.25},{rx:-1.2,lx:-.85,ry:.5,rz:-.6,lz:.45,wx:1.1,tilt:-.05},{rx:-.6,lx:-.5,ry:-.3,wx:.6}],
    thrust:[{rx:-.65,lx:-.55,wx:.7},{rx:-1.6,lx:-.85,wx:1.6,lean:.12},{rx:-.8,lx:-1,wx:1}],
  };
  function rest(kind,shield){const p={...REST};if(shield)p.lx=-.35;if(['greatsword','warhammer','arcane_staff'].includes(kind)){p.rx=-.35;p.lx=-.5;p.rz=.65;p.lz=-.9;}if(kind==='spellbook'){p.rx=p.lx=-1;p.rz=.5;p.lz=-.5;}if(kind==='elven_bow'){p.rx=-.7;p.lx=-.35;p.wx=0;}return p;}
  function sample(kind,action='attack',variant=0,progress=1,shield=false,family='',out={}){
    kind=kind.replace(/_t[23]$/,'');
    const base=rest(kind,shield),track=(WEAPONS[kind]||WEAPONS.unarmed)[variant%2];let poses=track;
    if(action==='skill'){poses=family==='bow'?WEAPONS.elven_bow[variant%2]:family==='slash'?WEAPONS.longsword[variant%2]:family==='heavy'?track:family==='spin'?[{...track[0],ry:-.75,tilt:-.1},{...track[1],ry:.85,wy:1,wz:.7,tilt:.12},{...track[2],ry:.4}]:SKILL_TRACKS[family]||SKILL_TRACKS.cast;}
    const t=clamp(progress);if(action!=='charge'&&t===1){Object.assign(out,base);return out;}
    if(action==='charge'){const prep=['deploy','forge','cook'].includes(family)?SKILL_TRACKS[family][0]:['heavy','slash','spin','thrust','bow'].includes(family)?track[0]:SKILL_TRACKS.cast[0],amount=Math.min(1,t*5);for(const k in base)out[k]=base[k]+((prep[k]??base[k])-base[k])*amount;return out;}
    const times=[0,.22,.48,.7,1],frames=[base,poses[0],poses[1],poses[2],base];let i=0;while(i<3&&t>times[i+1])i++;const u=clamp((t-times[i])/(times[i+1]-times[i])),smooth=u*u*(3-2*u);
    for(const k in base){const a=frames[i][k]??base[k],b=frames[i+1][k]??base[k];out[k]=a+(b-a)*smooth;}return out;
  }
  function state(model){return model.userData.combatMotion||(model.userData.combatMotion={counts:{},action:'',elapsed:0,duration:1,variant:0,family:'',pose:{}});}
  function begin(model,action,duration,skill){if(!model?.userData)return false;const s=state(model),kind=model.userData.heroWeapon||'unarmed';s.action=action;s.duration=Math.max(.1,Math.min(4,Number(duration)||.65));s.elapsed=0;s.family=FAMILIES[skill?.effect]||'';s.skillId=skill?.id||'';if(action==='attack'){s.variant=s.counts[kind]||0;s.counts[kind]=(s.variant+1)%2;}else s.variant=0;return true;}
  function cancel(model){if(model?.userData.combatMotion){const s=state(model);s.action='';s.elapsed=s.duration;}}
  function update(model,dt=0){const s=state(model);s.elapsed=Math.min(s.duration,s.elapsed+Math.max(0,Math.min(.1,Number(dt)||0)));if(s.elapsed>=s.duration)s.action='';return sample(model.userData.heroWeapon||'unarmed',s.action||'attack',s.variant,s.action?s.elapsed/s.duration:1,model.userData.hasShield,s.family,s.pose);}
  return Object.freeze({WEAPONS,FAMILIES,sample,begin,cancel,update,state});
});
