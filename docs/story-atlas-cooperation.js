/* Definitions are shared with the actual battle eligibility/transaction module. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StoryAtlasCooperation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const get=(file,name)=>{if(typeof module==='object'&&module.exports){const value=require('../story/'+file+'.js');return globalThis[name]||value;}return globalThis[name];};
  function records(){
    const C=get('tower-cooperation-core','TowerCooperation'),H=get('tower-heroes-core','TowerHeroes'),P=get('tower-party-core','TowerPartyCore'),R=get('tower-cooperation-runtime','TowerCooperationRuntime');
    return C.DEFINITIONS.map(d=>({id:d.id,name:d.name,category:'cooperation',jobs:d.participants.map(p=>p.job),underground:d.underground,description:d.description,iconHtml:R.icon(d.id),tags:[d.participants.length+' 人連攜',d.effect.attack?'合作攻擊':'合作輔助',d.formation.kind==='front'?'前後陣形':d.formation.kind==='pincer'?'夾擊陣形':'近距合作'],details:[
      {label:'需要隊員與已學技能',value:d.participants.map(p=>H.JOBS[p.job].name+'：'+H.SKILLS[p.skill].name).join(' ＋ ')},
      {label:'距離與相對位置',value:d.formation.description},
      {label:'共同條件',value:'不同隊員皆能行動、指定技能不在冷卻中，且互相看得見；不允許隔牆連攜。攻擊連攜還需有共同可命中的怪物。'+(d.participants.some(p=>p.job==='robot')?' 機器人必須還有能源；不額外扣動力石。':'')},
      {label:'合作準備',value:d.preparation+' 秒；期間條件失效則中止，不消耗技能或物资。'.replace('资','資')},
      {label:'冷卻',value:'所有參與技能至少進入 '+d.cooldown+' 秒冷卻；不能接著用同一招繞過冷卻。'},
      {label:'食材耗用',value:Object.entries(d.costs.ingredients).map(([k,n])=>P.INGREDIENTS[k]+' × '+n).join('、')||'不需食材'},
      {label:'箭矢耗用',value:d.costs.arrows?d.costs.arrows+' 支共用箭矢':'不需箭矢'},
      {label:'金屬零件耗用',value:d.costs.scrap?'金屬零件 × '+d.costs.scrap:'不需金屬零件'},
      {label:'開放條件',value:d.underground?'僅進入地下篇後；同時備齊三名對應隊員與技能。':'地上與地下皆可；需先招募、學會指定技能。'},
      {label:'操作',value:'條件符合時出現連攜鈕，點選想要的合作招式後發動。技能取得仍隨機，圖鑑不代表隊伍必定湊齊。'}
    ],notes:['參與人物原本的技能等級、武器與被動仍影響效果；這不是獨立裝備欄或自動贈送的新技能。','攻擊、護盾與治療沿用原規則；傷害不穿牆，吸收型護盾最多五分鐘且不無限相加。']}));
  }
  return Object.freeze({records});
});
