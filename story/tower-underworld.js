/* 地下續篇：純資料與確定性設定，不依賴主塔核心或改寫地上規則。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerUnderworld=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const CHAPTERS=freeze([
    {id:'underworld:roots',chapter:11,high:-1,mid:-5,low:-10,title:'地下第一章・樹根裡有人留燈',name:'根脈遺站',environmentId:'roots',themeIndex:3,size:19,objective:'沿著樹根間仍亮著的燈，找出是誰在地下等待。',clueId:'underworld:clue:roots',clueName:'返程路牌',clueText:[
      '木牌上刻著河流、燈塔與一扇石門，卻沒有高塔。原來這條地下路比你剛走出的高塔更古老。',
      '背面的字說：「走累了便回頭，燈會替你留路。」燈油早已乾了，樹根裡卻仍傳來有人輕聲哼唱。',
      '路牌指向地下十層的根脈閘。越過它，就能到達歌聲傳來的渡河處。'],recaps:['打敗一樓樓層主後，石壁露出隱藏樓梯。幾天後你重返塔內，自願追查地下仍亮著的燈。','返程路牌比高塔更古老。燈油已乾，卻有人一直替這條路留著光。']},
    {id:'underworld:mist',chapter:12,high:-11,mid:-15,low:-20,title:'地下第二章・渡船上的名字',name:'無名渡渠',environmentId:'mist',themeIndex:4,size:19,objective:'尋找真名渡籤，幫守燈人想起自己的名字。',clueId:'underworld:clue:mist',clueName:'真名渡籤',clueText:[
      '渡籤上刻著「璃安」，旁邊是一筆歪歪的燈。那是很久以前，一個獲救的孩子替守燈人刻下的名字。',
      '璃安讀出它，水中便映出她原來的模樣。名字能讓人記起自己，卻不能變成命令她留下的咒語。',
      '渡籤背面畫著藏書室。璃安曾把自己的守燈誓言留在那裡，她想知道為什麼那句承諾始終不能結束。'],recaps:['你在霧河遇見守燈人。她記得每位旅人的歸處，卻忘了別人曾怎樣稱呼她。','守燈人名叫璃安。渡籤指出她的誓言藏在更深的書庫，可能也是她無法離開的原因。']},
    {id:'underworld:library',chapter:13,high:-21,mid:-25,low:-30,title:'地下第三章・誓言缺掉的半頁',name:'沉頁藏書庫',environmentId:'library',themeIndex:0,size:19,objective:'找回守燈誓言的後半頁，查明璃安為何不能離開。',clueId:'underworld:clue:library',clueName:'撤回書籤',clueText:[
      '書籤夾著誓言的後半頁：「願意守燈的人，也可以在疲倦時放下燈。」璃安的承諾原本不是一生的鎖。',
      '洪水那年，石頁破裂，守門者只記住「等到最後一人回家」。它把偶爾回來探路的人也算成尚未離開，等待因此永遠沒有終點。',
      '補上後半頁，就能解除那道命令。但璃安擔心自己一走，歸途的燈會熄滅；答案藏在地下深井。'],recaps:['書庫裡有比建塔紀錄更早的石頁。你要找出璃安的誓言為什麼變成永遠的等待。','誓言允許守燈人休息，只是後半頁遺失了。現在還要確認：璃安離開後，路燈是否仍能亮著。']},
    {id:'underworld:furnace',chapter:14,high:-31,mid:-35,low:-40,title:'地下第四章・不必燃燒自己',name:'無火深井',environmentId:'furnace',themeIndex:5,size:19,objective:'找出地下燈火真正的來源，讓璃安能安心放下燈。',clueId:'underworld:clue:furnace',clueName:'分流燈芯',clueText:[
      '燈芯連著地底的熱泉。照亮道路的並不是璃安的生命，而是被舊石閘堵住大半的地熱。',
      '你讓熱流分別進入回程燈與原初石門。離開她的手，燈仍穩穩亮著；不需要另一個人接替她被困在這裡。',
      '地下四十層的分流盤能固定這條新光路。完成後，帶著燈芯前往最深的原初門庭。'],recaps:['璃安怕自己離開就會熄燈。你陪她走入深井，查明燈火是否真需要有人永遠守著。','分流燈芯證明路燈由地熱供能。光路接好後，璃安可以離開，也不必犧牲另一位守燈人。']},
    {id:'underworld:heart',chapter:15,high:-41,mid:-45,low:-50,title:'地下第五章・輪到守燈人回家',name:'原初門庭',environmentId:'heart',themeIndex:0,size:21,objective:'解開最後的守門誓約，讓璃安也能選擇自己的歸途。',clueId:'underworld:clue:heart',clueName:'同行歸印',clueText:[
      '歸印映出旅人並肩走過石門的身影。這扇門早於高塔存在，原本只為願意同行的人指出回程。',
      '你問璃安是否想走出去。她回答願意，歸印才亮起；同行者各有自己的選擇，離隊的人也不會因此失去名字。',
      '地下五十層仍有最後的機關與誓守者。解除它們，帶著歸印走向地面，這次地下旅程就能完整結束。'],recaps:['原初石門比高塔更古老。地熱已重新照亮歸途，最後要解除把璃安強留在此的守門誓約。','璃安親口選擇一起離開。帶同行歸印解除最後機關、擊敗誓守者，讓守燈人也能迎向晨光。']},
  ]);
  const SCENES=freeze([
    {id:'underworld:scene:1',chapter:'underworld:roots',floor:-1,title:'石壁後的歌聲',paragraphs:[
      '離開高塔幾天後，一位旅人趕來告訴你：「一樓的樓層主被打敗後，石壁裂開了，後面還有向下的樓梯。」你返回塔內，果然看見一束青色燈光從石縫透出。裡面沒有召喚聲，只有很輕的歌。',
      '你先與同伴說好，想留下的人不必勉強同行，名字仍會留在你們的故事裡。這次是你自己想知道下面有什麼。踏上第一級階梯時，粗大的樹根讓出一線路，遠處有人說：「別吹熄最後那盞燈。」']},
    {id:'underworld:scene:5',chapter:'underworld:roots',floor:-5,title:'比高塔更早的路',paragraphs:[
      '返程路牌夾在兩道緩緩合攏的根牆之間。你趁牆退開時將它取下，發現圖上只有河流、燈塔與石門，根本沒有高塔。樹皮下的刻字說，最早的旅人先找到這條歸途，後來才在上面築塔避難。',
      '一盞早已沒有燈油的小燈忽然亮起，照出往地下十層的方向。「走累了便回頭。」剛才的聲音近了一點。你問她是誰，回答卻只是一陣咳嗽般的火花，接著歌聲沿樹根退往更深的地方。']},
    {id:'underworld:scene:10',chapter:'underworld:roots',floor:-10,title:'根牆攔住的渡口',paragraphs:[
      '根脈巡站長從粗根中站起，胸前掛滿生鏽的路鈴。「守燈人不能離站。」它反覆說著，牆壁也跟著向你逼近。你終於明白，那道聲音不只在替你照路，她自己也被守衛擋在下面。',
      '返程路牌指向三座定錨器。解除根牆、擊敗巡站長後，才能沿閘門走到渡口。歌聲從門縫傳來：「如果見到一張刻著名字的渡籤，請替我帶來。我記得每個人的路，卻記不起自己的名字了。」']},
    {id:'underworld:scene:11',chapter:'underworld:mist',floor:-11,title:'提著燈的陌生人',paragraphs:[
      '霧河沒有天空，水面卻漂著一盞盞像星星的小燈。岸邊站著披青色斗篷的女子，她的衣角被光穿透，手中的提燈與樹根裡那盞一樣。「我不是迷路的人。」她說，「我在等最後一位旅人回家。」',
      '你問她等了多久，她望著覆滿水苔的石階，答不出來。霧中響起划槳聲，擺渡人的影子正往這邊靠近。女子把提燈抬高，讓你看見可藏身的轉角；她只請你留意沉在水邊的舊渡籤。']},
    {id:'underworld:scene:15',chapter:'underworld:mist',floor:-15,title:'璃安',paragraphs:[
      '真名渡籤埋在乾涸的水槽裡，刻著「璃安」，旁邊是一盞畫歪的小燈。女子讀出這兩個字，愣了很久。「是那個孩子替我刻的。他說，每個送人回家的人，也該有自己的名字。」',
      '水面映出她曾笑著送船離岸的樣子。她是原初之門燈火凝成的守燈人，不靠誰的記憶活著。璃安想起自己曾留下一句誓言，卻想不起最後半句；那本書就在河底更深的藏書庫。']},
    {id:'underworld:scene:20',chapter:'underworld:mist',floor:-20,title:'只差她沒有上船',paragraphs:[
      '霧籤擺渡人把長槳橫在閘前：「船可以送旅人，不能送守燈人。」璃安低頭，像早已聽過這句話無數次。你問她想不想過河，她第一次抬頭說：「想。我也想知道，門外的風是什麼味道。」',
      '真名渡籤標著三、一、二的閘序。解除水閘與守衛，才能讓船道通往書庫。你沒有替璃安宣誓，只替她在船邊留了一個位置。她提著燈站在那裡，光在霧裡終於不再顯得孤單。']},
    {id:'underworld:scene:21',chapter:'underworld:library',floor:-21,title:'石頁裡的洪水',paragraphs:[
      '藏書庫的書頁由薄石片做成，根鬚托著書架緩緩移動。你在一幅浮雕前停下：洪水淹過平原，人們循著璃安的燈穿過古老石門，之後才在門上方建起避難的高塔。這裡真的比塔更早。',
      '璃安摸著裂開的石書，念出自己記得的誓言：「我願留燈，直到最後一人回家。」下一頁卻不見了。遠處的卷燈藏書者合上大書，所有燈影瞬間轉向你；它不想讓誰碰到被藏起的後半句。']},
    {id:'underworld:scene:25',chapter:'underworld:library',floor:-25,title:'承諾也能放下',paragraphs:[
      '撤回書籤帶你找到落在書架後的半頁石片。你將它拼回去，讀出後面的字：「願意守燈的人，也可以在疲倦時放下燈。」璃安的手微微發抖。原來她的承諾從來不是一生的鎖。',
      '洪水震裂石頁後，守衛只記住前半句；只要偶爾還有旅人回來，它就認為等待不能結束。你說可以把整句誓言帶到最深的門前，璃安卻看向提燈：「可是，我走了，後來的人怎麼回家？」']},
    {id:'underworld:scene:30',chapter:'underworld:library',floor:-30,title:'不是找下一個人代替',paragraphs:[
      '卷燈藏書者攤開空白石頁，要你接下守燈人的名字。「一人離開，一人留下。」你沒有拿起筆，只把完整誓言放到光鏡前。璃安能離開，不該靠另一個人失去自由來交換。',
      '鏡光對準金色記號、守衛倒下後，書庫深處才會開出一段溫熱階梯。石牆上刻著燈芯與熱泉的圖案。你指給璃安看：「先去看看燈真正靠什麼亮著，再決定怎麼辦。」她握緊提燈，跟上你的腳步。']},
    {id:'underworld:scene:31',chapter:'underworld:furnace',floor:-31,title:'井底沒有火',paragraphs:[
      '熱氣沿著石縫上升，井底卻找不到半點火焰。紅金色水流穿過透明石管，把光送往頭頂的迷宮。璃安的提燈靠近管道時忽然變亮，她驚訝地鬆了手，燈竟仍浮在空中。',
      '「也許，燈不需要我一直拿著。」她小聲說。話音未落，一座封住熱泉的巨閘開始震動。你發現管道缺了分流燈芯；先找到它，才能讓返程燈與石門各自獲得穩定的光。']},
    {id:'underworld:scene:35',chapter:'underworld:furnace',floor:-35,title:'空著的雙手',paragraphs:[
      '分流燈芯嵌進石座，兩道熱流便分向不同管道。你等著頭頂的燈熄滅，它們卻一盞接一盞穩穩亮著。璃安慢慢放下提燈；照路的力量來自地熱，她只是替堵塞的舊光路指引方向。',
      '她看著空著的雙手，忽然笑了，又像快要哭出來。「我還能幫人，但不用永遠站在同一個地方，對嗎？」你點頭。只要在地下四十層固定分流盤，就能帶她前往原初之門，解除最後的誓約。']},
    {id:'underworld:scene:40',chapter:'underworld:furnace',floor:-40,title:'把退路照亮',paragraphs:[
      '深井熾石衛舉起重鎚，要將新接好的光路全部砸回原位。它只認得璃安舉燈的影子，認為守燈人放手就是災難。你讓她先退到亮著的樓梯旁，自己帶隊避開落鎚與翻動的石盤。',
      '擊敗石衛、穩住三座分流盤之後，前後的路燈都會保持明亮。「這次換我陪你走。」璃安說。她不再只照著你的背影，而是走到你身旁。最深處的門慢慢顯出輪廓，石框磨得很舊，上面沒有高塔的標記。']},
    {id:'underworld:scene:41',chapter:'underworld:heart',floor:-41,title:'高塔之前的門',paragraphs:[
      '原初門庭寬得像一座埋在地底的廣場。門框裡浮著星光，四周刻滿旅人並肩離去的身影。「那時候還沒有高塔。」璃安說。最早的人在這裡找到歸途，後來才築塔保護它；她的燈也從這道地熱星光裡誕生。',
      '如今光路已通，門卻仍用舊誓把她留住。你把返程路牌、渡籤、書籤與燈芯放上石台，只差最後一枚同行歸印。那不是命令別人跟隨的印章，而是由本人願意同行時才會亮起的光。']},
    {id:'underworld:scene:45',chapter:'underworld:heart',floor:-45,title:'她親口說願意',paragraphs:[
      '同行歸印落入你掌心，映出璃安站在門邊的身影。你沒有把她直接拉過來，只問：「要和我們一起出去看看嗎？」她看了一眼身後仍明亮的路，清楚回答：「願意。但累了，我也可以回來休息。」',
      '你答應，歸印便亮了。先離隊的人不必回來補上誓言，想去哪裡也仍由各人決定。地下五十層傳來沉重腳步，最後的誓守者正從門中醒來；它還不肯承認，守燈人也能有自己的歸途。']},
    {id:'underworld:scene:50',chapter:'underworld:heart',floor:-50,title:'最後一位歸人',paragraphs:[
      '原門誓守者站在階梯前，說最後一人還沒回家，所以守燈人不能走。你看向璃安，忽然明白這個永遠繞不出的圈：「她也是旅人。你把她留下，就永遠等不到最後一人回家。」',
      '誓守者抬起武器，石庭最後一次震動。帶著同行歸印解除機關、擊敗它，才能讓完整誓言取代舊命令。璃安握住自己的提燈，這次不是為了守在原地，而是準備陪你走上通往晨光的樓梯。']},
  ]);
  const ENDING=freeze({id:'underworld:ending:return',title:'地下終章・守燈人迎來的早晨',description:'原初之門解除舊誓，璃安自願與你走回地面。地下的燈仍照著歸途，這次旅程已完整結束。',paragraphs:[
    '誓守者放下武器，五枚地下印記在門上亮起。完整的石頁取代了那半句命令；原初之門不再要求誰永遠留下，只為願意回家的旅人指出方向。身後的燈由地熱照料，一盞也沒有熄滅。',
    '璃安踏出高塔時，晨風吹動她的斗篷。她愣了一會兒，才笑著說：「原來風是這樣的。」你們坐在門外吃了一頓簡單早餐，談起先離隊的同伴，也談起各自想去的地方。沒有人的名字被忘記，也沒有誰必須留下來證明情誼。',
    '主塔仍保留你先前選定的未來，地下的冒險也確實到此結束。告別時，璃安送你一盞小燈，說想再見時可以來敲門，不用召喚。你帶著那點溫暖轉身，這回的路，通向你自己想回去的家。']});
  const isFloor=floor=>Number.isInteger(floor)&&floor>=-50&&floor<=-1;
  function chapterForFloor(floor){if(!isFloor(floor))throw new RangeError('地下樓層必須為 -1 至 -50。');return CHAPTERS.find(c=>floor<=c.high&&floor>=c.low);}
  function floorConfig(floor,seed=1){
    const chapter=chapterForFloor(floor);if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw new RangeError('無效的旅程種子。');
    const depth=-floor,monsterMin=chapter.size===21?9:8,monsterMax=Math.min(12,monsterMin+4);
    let roll=(seed^Math.imul(floor,0x9e3779b9))>>>0;roll=Math.imul(roll^roll>>>16,0x21f0aaad);roll=Math.imul(roll^roll>>>15,0x735a2d97);
    const monsterCount=monsterMin+((roll^roll>>>15)>>>0)%(monsterMax-monsterMin+1);
    // Underground pacing is independent: 51s at B1, minus 0.5s per floor,
    // capped at 30s. The surface formula remains 150 - (99 - floor).
    return {floor,size:chapter.size,shiftSeconds:Math.max(30,51-(depth-1)*.5),themeIndex:chapter.themeIndex,environmentId:chapter.environmentId,chapter:chapter.chapter,name:chapter.name,
      monsterTypes:['clockmite','sentinel','wisp','hound','shardseer'],monsterCount,count:monsterCount,monsterMin,monsterMax,monsterStrengthBonus:4,
      merchant:floor===chapter.high||depth%5===0,rewardCoins:15+Math.floor((depth-1)/10)*2,narrative:floor===chapter.high?SCENES.find(s=>s.floor===floor).paragraphs[0]:'',floorTitle:'地下 '+depth+' 層 · '+chapter.name,underworld:true,variant:'underworld'};
  }
  return freeze({CHAPTERS,SCENES,ENDING,isFloor,chapterForFloor,floorConfig});
});
