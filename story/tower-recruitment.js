/* Named travellers, material-based invitations and durable reunion records. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerRecruitment=api;})(globalThis,function(){
  'use strict';
  const C=()=>typeof module==='object'&&module.exports?require('./story-core.js'):globalThis.TowerCore;
  const P=()=>typeof module==='object'&&module.exports?require('./tower-party-core.js'):globalThis.TowerPartyCore;
  const H=()=>typeof module==='object'&&module.exports?require('./tower-heroes-core.js'):globalThis.TowerHeroes;
  const G=()=>typeof module==='object'&&module.exports?require('./tower-hero-growth.js'):globalThis.TowerHeroGrowth;
  const M=()=>typeof module==='object'&&module.exports?require('./tower-materials.js'):globalThis.TowerMaterials;
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const TERMS=freeze({
    'swordsman:male':{costs:{coins:8,ingredients:{root:1}},story:'蒼衡想補足旅費與乾糧，好在前方替大家開路。'},
    'swordsman:female':{costs:{coins:4,meals:{broth:1}},story:'瑟琳剛結束守夜，想先喝一碗暖湯，再一起出發。'},
    'mage:male':{costs:{coins:6,ingredients:{mushroom:2}},story:'星嵐正在研究菇傘留下的符紋，願意與提供材料的旅伴同行。'},
    'mage:female':{costs:{ingredients:{herb:2,root:1}},story:'露彌不收旅費；她想帶些香草與根莖，照顧迷路的旅人。'},
    'scout:male':{costs:{coins:4,bag:{ration:1}},story:'逐杉要準備一份行路乾糧與修補靴子的旅費。'},
    'scout:female':{costs:{ingredients:{mushroom:2,herb:1}},story:'巧栗願意帶路，只希望分到幾份野外採集的食材。'},
    'chef:male':{costs:{ingredients:{root:2,mushroom:1}},story:'禾谷不談價錢：帶來根莖和菇，他就願意為隊伍掌勺。'},
    'chef:female':{costs:{meals:{bento:1}},story:'杏桃想嚐嚐你的旅人飯盒，與願意分享料理的人一起走。'},
    'healer:male':{costs:{ingredients:{herb:3}},story:'沐川希望補滿藥草袋，不收銅幣，只帶救人的香草。'},
    'healer:female':{costs:{meals:{stew:1},ingredients:{herb:1}},story:'澄音餓了一整夜；一碗燉鍋與一份香草，就是她需要的補給。'},
    'smith:male':{costs:{coins:6,scrap:2},story:'砧岳需要幾枚銅幣和可用零件，才能帶著工具上路。'},
    'smith:female':{costs:{materials:{ironore:1},ingredients:{root:1}},story:'鐵薇對精鐵礦比銅幣有興趣，再帶一份根莖就能精神飽滿地出發。'},
    'archer:male':{costs:{bag:{arrow:10},ingredients:{root:1}},story:'風梢希望補足箭袋與口糧，願意用精靈的目光守住遠處。'},
    'archer:female':{costs:{coins:3,meals:{salad:1}},story:'嵐羽想要清爽的香草沙拉與少許旅費，同行時會照看後方。'},
    'cleric:male':{costs:{coins:6,ingredients:{herb:1}},story:'伊吹想為小祠備一束香草，願以祝詞與弓箭守護隊伍。'},
    'cleric:female':{costs:{coins:4,meals:{soup:1}},story:'緋鈴剛結束神樂，想先喝一碗熱湯，再與你同行。'},
    'robot:male':{costs:{coins:6,scrap:2},story:'鐵衡想補足維護費和零件，願意用厚實機殼守住隊伍前方。'},
    'robot:female':{costs:{materials:{ironore:1},scrap:1},story:'鈴芯需要一份精鐵礦與一個可用零件；修好關節後，她願意和你一起探索。'},
  });
  const identity=(job,sex)=>job+':'+sex;
  const archive=run=>run?.party?.travellers||[];
  const remembered=(run,job,sex)=>archive(run).find(t=>t.identity===identity(job,sex));
  const away=(run,t)=>!run.party.members.some(m=>m.id===t.id||m.profession===t.profession)&&run.floor<t.departedFloor;
  function select(run,candidate,roll){
    const returning=archive(run).filter(t=>away(run,t)).sort((a,b)=>a.identity<b.identity?-1:1);
    // A majority of eligible encounters can be reunions; seeds keep the choice
    // stable through reloads and maze changes. No same-floor dismissal reroll.
    const old=returning.length&&roll%100<60?returning[Math.floor(roll/100)%returning.length]:remembered(run,candidate.profession,candidate.sex);
    if(old){if(!away(run,old))return null;return {...candidate,id:old.id,profession:old.profession,sex:old.sex,level:C().isUnderworld(run)?Math.max(5,old.level):old.level,returning:true,recruitCount:old.departures+1,departures:old.departures};}
    if(archive(run).some(t=>t.profession===candidate.profession&&t.departedFloor===run.floor)||run.party.joined.includes(candidate.id)||run.party.members.some(m=>m.profession===candidate.profession))return null;
    return {...candidate,returning:false,recruitCount:1,departures:0};
  }
  function stock(run,type,id){if(type==='coins')return run.coins;if(type==='scrap')return run.party.journey.scrap;if(type==='materials')return run.party.journey.materials[id];if(type==='bag')return run.bag[id];return run.party[type][id];}
  function label(type,id){if(type==='coins')return '銅幣';if(type==='scrap')return '金屬零件';if(type==='materials')return M().MATERIALS[id];if(type==='ingredients')return P().INGREDIENTS[id];if(type==='meals')return P().RECIPES[id].name;return C().ITEMS[id].name;}
  function quote(run,offer){
    if(!offer||!run.party)return {offer:null,costs:{},list:[],affordable:false,reason:'這位旅人目前不在附近。',story:'',returning:false};
    const terms=TERMS[identity(offer.profession,offer.sex)],scale=1+(offer.departures||0)*.5,costs={},list=[];
    for(const [type,amount] of Object.entries(terms.costs)){
      // Inventory stacks are capped at 99; a long expedition must never ask
      // for more supplies than the bag can physically hold.
      const increased=n=>Math.min(type==='coins'?999999:99,Math.ceil(n*scale));
      if(typeof amount==='number')costs[type]=increased(amount);else costs[type]=Object.fromEntries(Object.entries(amount).map(([key,n])=>[key,increased(n)]));
      for(const [id,count] of typeof costs[type]==='number'?[[type,costs[type]]]:Object.entries(costs[type])){const have=stock(run,type,id);list.push({type,id,label:label(type,id),count,have,missing:Math.max(0,count-have)});}
    }
    let reason='';if(run.party.members.length>=P().recruitLimit(run))reason='隊伍名額已滿，請先與一位同伴道別。';
    else if(run.party.members.some(m=>m.profession===offer.profession))reason='隊伍已有相同職業的同伴。';
    else if(list.some(c=>c.missing))reason='還缺少：'+list.filter(c=>c.missing).map(c=>c.label+' '+c.missing).join('、')+'。';
    const story=offer.returning?P().person(offer.profession,offer.sex)+'還記得上次的旅程，願意再次同行；這回希望準備更充足的補給。原有等級與技能保留，'+(offer.profession==='robot'?'機殼與拳臂保留原有階級與耐久。':'裝備請從背包重新分配。'):terms.story;
    return {offer,costs,list,affordable:!reason,reason,story,returning:!!offer.returning,recruitCount:offer.recruitCount};
  }
  function pay(run,q){for(const c of q.list){if(c.type==='coins')run.coins-=c.count;else if(c.type==='scrap')run.party.journey.scrap-=c.count;else if(c.type==='materials')run.party.journey.materials[c.id]-=c.count;else if(c.type==='bag')run.bag[c.id]-=c.count;else run.party[c.type][c.id]-=c.count;}}
  function remember(run,member){
    const p=run.party,key=identity(member.profession,member.sex),before=archive(run).find(t=>t.identity===key);
    const record={identity:key,id:member.id,profession:member.profession,sex:member.sex,level:member.level,xp:member.xp??G().XP[member.level-1],departedFloor:run.floor,departures:Math.min(149,(before?.departures||0)+1),legacy:!p.loadouts,loadout:p.loadouts?H().recruitSnapshot(run,member.id):null};
    p.travellers=[...archive(run).filter(t=>t.identity!==key),record];return record;
  }
  function restore(run,offer){const t=remembered(run,offer.profession,offer.sex);if(!t||!away(run,t))return null;
    const m={id:t.id,profession:t.profession,sex:t.sex,level:offer.level,xp:Math.max(t.xp,G().XP[offer.level-1]),hp:run.party.loadouts?P().vitalHp(t.profession,offer.level,false):28+offer.level*6,cooldown:0,hurtLeft:0};
    run.party.members.push(m);if(run.party.loadouts)H().restoreMember(run,m,t.loadout);return m;
  }
  function validate(value,party,floor){
    if(value===undefined)return [];
    if(!Array.isArray(value)||value.length>16||new Set(value.map(t=>t?.identity)).size!==value.length||new Set(value.map(t=>t?.id)).size!==value.length)return null;
    const result=[];for(const t of value){
      if(!t||typeof t!=='object'||Array.isArray(t)||t.identity!==identity(t.profession,t.sex)||!Object.hasOwn(TERMS,t.identity)||typeof t.id!=='string'||!t.id||t.id==='hero'||t.id.length>80||!party.joined.includes(t.id)||!C().isFloor(t.departedFloor)||t.departedFloor<floor||!Number.isInteger(t.departures)||t.departures<1||t.departures>149||!Number.isInteger(t.level)||t.level<1||t.level>(t.departedFloor<0&&party.loadouts?10:5)||!Number.isInteger(t.xp))return null;
      const xp=G().migrateXp(t.xp,t.level,party.loadouts?.xpCurve);if(xp<G().XP[t.level-1]||xp>G().XP[9])return null;
      const current=party.members.find(m=>m.id===t.id),same=party.members.find(m=>identity(m.profession,m.sex)===t.identity);
      if(current&&(current.profession!==t.profession||current.sex!==t.sex)||same&&same.id!==t.id)return null;
      if(typeof t.legacy!=='boolean'||t.legacy!==(t.loadout===null))return null;
      const loadout=t.loadout===null?null:H().validateRecruitSnapshot(t.loadout,t.profession,t.level,t.departedFloor);
      if(t.loadout!==null&&!loadout||!party.loadouts&&loadout)return null;
      result.push({identity:t.identity,id:t.id,profession:t.profession,sex:t.sex,level:t.level,xp,departedFloor:t.departedFloor,departures:t.departures,legacy:t.legacy,loadout});
    }return result;
  }
  return Object.freeze({TERMS,profiles:TERMS,identity,label,stock,archive,remembered,select,quote,pay,remember,restore,validate});
});
