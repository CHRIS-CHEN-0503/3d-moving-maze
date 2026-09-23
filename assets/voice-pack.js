/* 移動迷宮專用錄音索引：音檔只在需要播放時才下載。 */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./voice-catalog.js'):root.MazeVoiceCatalog,typeof module==='object'&&module.exports?require('./role-voices.js'):root.MazeRoleVoices);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MazeVoicePack=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(catalog,roles){
  'use strict';
  const saleTracks={};
  for(const [seconds,spoken] of [[15,'十五'],[20,'二十'],[25,'二十五']])saleTracks['shop.sale.clear.'+seconds]=Object.freeze({src:'./assets/voice/sale-clear-'+seconds+'.mp3',text:'大拍賣！限時'+seconds+'秒，快來搶購！',spokenText:'大拍賣！限時'+spoken+'秒，快來搶購！'});
  const originalTracks={
    ...(catalog?.tracks||{}),
    ...saleTracks,
    'story.scene99.1':Object.freeze({src:'./assets/voice/story-scene99-1.mp3',text:'你醒來時，背下的石台仍在發熱，雲從破損欄杆外緩緩流過。頭頂沒有天空以外的東西，腳邊卻刻著第九十九層。一道平靜的聲音說：「召喚完成。」你問這是哪裡，它只重複那四個字，像一扇從不聽人回答的門。'}),
    'story.scene99.2':Object.freeze({src:'./assets/voice/story-scene99-2.mp3',text:'披著舊披風的女子從階梯後探出頭。「別站在那條亮線上。」她叫伊芙，話音剛落，整面牆便擦著你的鞋尖滑開。她遞來一張塔頂窄、塔底寬的地圖，說這座塔越往下越寬，牆壁移動得也越快，而她至今沒找到任何向上的路。'}),
    'story.scene99.3':Object.freeze({src:'./assets/voice/story-scene99-3.mp3',text:'你在掌心發現半枚銅扣碎片，殘缺的扣眼纏著細紅線。伊芙看見它時忽然停住笑容。「這是修門人的記號，我以為再也見不到了。」遠處傳來三短一長的敲擊，你回頭，石台上的召喚陣竟又亮了起來。'}),
    'merchant.tieLing':Object.freeze({src:'./assets/voice/merchant-tie-ling.mp3',text:'我是鐵匠鐵嶺。頭盔、球棒和保命補給，都在這裡挑。'}),
    'merchant.jinHe':Object.freeze({src:'./assets/voice/merchant-jin-he.mp3',text:'我是裁甲師錦禾。盔甲、平底鍋和旅途糧食，由我準備。'}),
    'merchant.lanZhou':Object.freeze({src:'./assets/voice/merchant-lan-zhou.mp3',text:'我是盾匠嵐舟。盾牌、木杖和探路工具，都在這裡。'}),
    'explorer.eve':Object.freeze({src:'./assets/voice/explorer-eve.mp3',text:'我的地圖又被高塔改寫了。沒關係，我們一起把路找回來。'}),
    'explorer.rowan':Object.freeze({src:'./assets/voice/explorer-rowan.mp3',text:'繩索、睡墊都帶齊了！路再難走，歇一口氣就能繼續。'}),
    'explorer.mira':Object.freeze({src:'./assets/voice/explorer-mira.mp3',text:'小心別碰翻我的藥瓶。這座塔的苔蘚，說不定藏著救命的線索。'}),
    'explorer.oren':Object.freeze({src:'./assets/voice/explorer-oren.mp3',text:'石壁上的古文還沒讀完，牆就搬走啦。年輕人，陪我找找下一句？'}),
    'explorer.sena':Object.freeze({src:'./assets/voice/explorer-sena.mp3',text:'從塔頂看過的流星，我一顆都記得。希望下一次，能站在塔外仰望。'}),
    'alert.monster':Object.freeze({src:'./assets/voice/alert-monster.mp3',text:'小心，附近有怪物。留意地上的紅圈，準備閃避，或請護衛攔住牠。'}),
  };
  const tracks=Object.freeze({...originalTracks,...roles?.tracks,...roles?.overrides});
  function get(id){return typeof id==='string'&&Object.hasOwn(tracks,id)?tracks[id]:null;}
  const normalize=s=>String(s||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/\s+/g,'').replace(/[·・]/g,'・');
  const byText=new Map();for(const [id,track] of Object.entries(tracks))if(!id.startsWith('role.'))byText.set(normalize(track.text),id);
  const keys=[...byText.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);
  const pattern=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
  function plan(text,gender){
    const original=String(text||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/[·・]/g,'・');
    const positions=[],characters=[];
    for(let i=0;i<original.length;i++)if(!/\s/.test(original[i])){positions.push(i);characters.push(original[i]);}
    const source=characters.join(''),out=[];let cursor=0;
    for(const match of source.matchAll(pattern)){
      const start=positions[match.index],end=positions[match.index+match[0].length-1]+1;
      if(start>cursor)out.push({text:original.slice(cursor,start)});
      const base=byText.get(match[0]),asset=roles?.variants?.[base]?.[gender]||base;out.push({asset,text:tracks[asset].text});cursor=end;
    }
    if(!out.length)return [{text:String(text)}];
    if(cursor<original.length)out.push({text:original.slice(cursor)});
    return out.filter(x=>x.asset||/[\p{L}\p{N}]/u.test(x.text));
  }
  return Object.freeze({version:1,tracks,get,plan});
});
