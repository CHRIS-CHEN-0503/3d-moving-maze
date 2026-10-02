/* Late-expedition equipment metadata. No dependency on run state or renderer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerGearTiers=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TIERS=Object.freeze({
    4:Object.freeze({requiredLevel:8,factor:2.7,priceFactor:5.2,label:'秘銀精製'}),
    5:Object.freeze({requiredLevel:10,factor:3.4,priceFactor:7.2,label:'歸途傳承'}),
  });
  const TIER_NAMES=Object.freeze(Object.fromEntries(Object.entries({
    longsword:['暮星秘銀劍','破曉歸途劍'],greatsword:['斷嶽秘銀巨劍','天穹鎮門巨劍'],
    arcane_staff:['紫曜引星杖','原初星海法杖'],spellbook:['月泉祈願法典','曙世生命法典'],
    smith_hammer:['星砧精鍛鎚','萬鍛匠心鎚'],warhammer:['鎮脈地鳴重錘','創爐擎天重錘'],
    cooking_pan:['琥珀百香鍋','萬味歸鄉御鍋'],twin_daggers:['暮影流光雙刃','無聲晨曦雙刃'],
    elven_bow:['銀森映月弓','千葉世界樹弓'],heavy_helm:['秘銀鎮衛重盔','曦光守誓重盔'],
    heavy_armor:['暮星秘銀戰甲','歸途不朽重甲'],light_hood:['夜行風羽兜帽','森語曙羽兜帽'],
    light_armor:['月影遊風輕甲','千葉曙光輕甲'],rune_crown:['紫曜祈星法冠','原初晨星法冠'],
    robe:['月泉流光法袍','萬象歸光法袍'],buckler:['月紋靈木小圓盾','曙葉庇佑小圓盾'],
    round_shield:['秘銀星環圓盾','曜光誓約圓盾'],tower_shield:['山門秘銀塔盾','歸途長城塔盾'],
  }).map(([kind,names])=>[kind,Object.freeze(names)])));
  function definition(base,tier){
    if(!Number.isInteger(tier)||!Object.hasOwn(TIERS,tier)||!Object.hasOwn(TIER_NAMES,base?.kind))return null;
    const config=TIERS[tier],names=TIER_NAMES[base?.kind];
    if(!config||!names)return null;
    const factor=config.factor;
    return Object.freeze({...base,kind:base.kind+'_t'+tier,baseKind:base.kind,tier,requiredLevel:config.requiredLevel,name:names[tier-4],
      damage:Math.round(base.damage*factor),magicDamage:Math.round(base.magicDamage*factor),support:Math.round(base.support*factor*100)/100,
      defense:base.defense?Math.max(Math.round(base.defense*factor),base.defense+tier-1):0,
      reach:base.type==='bow'?base.reach+(tier-1)*1.2:base.reach,buyPrice:Math.round(base.buyPrice*config.priceFactor)});
  }
  return Object.freeze({TIERS,TIER_NAMES,definition});
});
