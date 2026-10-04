/* Player notes derived only from read scenes and held clues. No save writes or RNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerStoryInsights=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const get=(file,name)=>typeof module==='object'&&module.exports?require('./'+file+'.js'):globalThis[name];
  const N=()=>get('tower-narrative','TowerNarrative'),S=()=>get('tower-side-stories','TowerSideStories'),M=()=>get('tower-materials','TowerMaterials'),F=()=>get('tower-field-guide','TowerFieldGuide');
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const stage=(read,clues,text,status='待查')=>({read,clues,text,status});
  const THREADS=freeze([
    {id:'copper',title:'銅扣上少了什麼',stages:[
      stage(['scene:99'],[],'半枚銅扣讓伊芙收住了笑容。修門人的記號，為什麼會出現在我的手裡？'),
      stage(['scene:99','scene:95'],['clue:summoning'],'銅扣留下我呼救的原聲，背面的文字卻被刮去。它能辨認我，仍沒說明我是怎樣答應來的。','已連起'),
      stage(['scene:99','scene:95','scene:65'],['clue:summoning','clue:echo'],'水晶讓刮去的確認符號重新顯現。銅扣辨認的是說話者；把求助直接算成同意，才是被省略的步驟。','已回收')
    ]},
    {id:'red-thread',title:'紅線不是把人綁住',stages:[
      stage(['scene:99'],[],'銅扣上的紅線與伊芙有關。她說沒有向上的路，卻仍把地圖交給剛醒來的我。'),
      stage(['scene:99','scene:75'],['clue:roots'],'木環保存相互等待的名字。失散並不等於被遺忘；紅線有一端，仍在我看不見的路上。','已連起'),
      stage(['scene:99','scene:75','scene:70'],['clue:roots'],'伊芙聽見隊友報平安後，先替同行者繫穩線結才走支路。她要留下可再相遇的路，沒有要求誰停在原地等她。','已回收')
    ]},
    {id:'clock',title:'三短一長，敲給誰聽',stages:[
      stage(['scene:99'],[],'召喚陣再次亮起之前，遠處有人敲了三短一長。是警告、呼喚，還是等著被聽見的答覆？'),
      stage(['scene:99','scene:69'],[],'星奈認得同一個節拍，說它來自維護人員。找到鐘室，才能查清這道訊號為什麼沒有傳到高塔。','已連起'),
      stage(['scene:99','scene:69','scene:35'],['clue:frost'],'送達回條與敲擊終於互相印證：救援早已完成。聲音一直留著，是高塔只重播求救，沒有讀到後來的回答。','已回收')
    ]},
    {id:'emergency',title:'暫時辦法，為何成了常態',stages:[
      stage(['scene:75'],['clue:roots'],'木環原有的離開規則上蓋著緊急封印。門不肯放人，可能不是最初建塔時的安排。'),
      stage(['scene:75','scene:55'],['clue:roots','clue:library'],'奧倫批准了臨時接引，洛恩拆下確認器；兩人各以為對方會恢復。補註還在，解除時間卻一直空白。','已連起'),
      stage(['scene:75','scene:55','scene:30','scene:25'],['clue:roots','clue:library','clue:frost','clue:clockwork'],'救援完成的紀錄先結束緊急狀態，分開的管線再恢復詢問。這場修理需要把證明與機關都接回去，單靠一句後悔不能開門。','已回收')
    ]},
    {id:'memory',title:'記憶真的會被用掉嗎',stages:[
      stage(['scene:45'],['clue:mist'],'米菈找回自己的故事，能源表卻把記憶與燃料列在一起。把名字接回去，還不足以讓害怕的人放心。'),
      stage(['scene:45','scene:19'],['clue:mist'],'爐心裡的熱流與記憶分走兩列管道。錯誤的標籤讓兩者看似相同，親眼看到的路線卻不同。','已連起'),
      stage(['scene:45','scene:19','scene:15'],['clue:mist','clue:furnace'],'記憶回到導航槽後，爐火仍穩定明亮。能源由地熱供應；把故事還給主人，不會消耗打開歸途的力量。','已回收')
    ]},
    {id:'lamp',title:'沒有燈油，路為何仍亮著',stages:[
      stage(['underworld:scene:5'],['underworld:clue:roots'],'路牌比高塔更早，空燈卻仍發光。這條歸途有人照看，但光一定來自她嗎？'),
      stage(['underworld:scene:5','underworld:scene:25'],['underworld:clue:roots','underworld:clue:library'],'誓言的後半頁允許守燈人休息。解除命令之前，仍要回答她的擔心：放下燈，其他人是否就失去退路？','已連起'),
      stage(['underworld:scene:5','underworld:scene:25','underworld:scene:35'],['underworld:clue:roots','underworld:clue:library','underworld:clue:furnace'],'分流後的路燈靠地熱穩穩亮著。璃安照顧過這條路，卻不是它的燃料；找一個人替她被困住，也不是修理。','已回收')
    ]},
    {id:'last-traveler',title:'誰沒有被算進歸人',stages:[
      stage(['underworld:scene:11'],[],'守燈人等最後一位旅人回家，卻說自己不是迷路的人。她也有一個想去的地方嗎？'),
      stage(['underworld:scene:11','underworld:scene:45'],['underworld:clue:heart'],'璃安親口選擇同行，也保留累了就回來休息的權利。她的回答不需要離隊同伴替她補上。','已連起'),
      stage(['underworld:scene:11','underworld:scene:45','underworld:scene:50'],['underworld:clue:heart'],'誓守者要等所有人回家，卻把守燈人排除在旅人之外。讓她也有歸途，才可能結束這個等不到最後一人的圈。','已回收')
    ]}
  ]);
  const PEOPLE=freeze([
    {id:'eve',name:'伊芙',first:'scene:99',side:'threads',stages:[
      stage(['scene:99'],[],'她熟悉變形的危險，卻仍沒有自己的出口。把地圖交給新人，是在替下一次同行留位置。'),
      stage(['scene:70'],['clue:roots'],'她先確認隊友平安，也替目前的同行者繫好線。找回舊朋友，沒有讓她忽略身邊的人。'),
      stage(['scene:20'],['clue:clockwork'],'當門接受拒絕，她才看見另一種出口：能停下，也能稍後再選。她找的路因此不只通往一個地方。')
    ]},
    {id:'mira',name:'米菈',first:'scene:89',side:'mirrors',stages:[
      stage(['scene:89'],[],'塔能複製故鄉的花，卻不知道窗後是誰。她想找回的，從來不只是一座屋子。'),
      stage(['scene:80'],['clue:garden'],'她按住我的手腕，留下自己回答的位置。幫助她回家，也需要先聽她說想回到哪裡。'),
      stage(['scene:45'],['clue:mist'],'她找回完整故事，卻只分享願意說出的部分。記憶被還給她，不代表所有人都有權讀它。')
    ]},
    {id:'rowan',name:'洛恩',first:'scene:79',side:'clockwork',stages:[
      stage(['scene:79'],[],'他的錶沒有指針，人卻一直修理機器。找鐘室，也是在查明哪一天之後，他只剩讓機器繼續轉。'),
      stage(['scene:65'],['clue:echo'],'他承認拆過確認器，以為那只是拖慢救援的零件。曾經熟練的工作，也可能正是需要重看的錯誤。'),
      stage(['scene:29','scene:25'],['clue:clockwork'],'他重新接線之前先問是否願意幫忙。改變已經出現在動手前的一句話裡，不只在最後完成的機關上。')
    ]},
    {id:'oren',name:'奧倫',first:'scene:59',side:'tribunal',stages:[
      stage(['scene:59'],[],'他先問又來了多少人，卻沒有回答為什麼沒人被送回去。那一晚的恐懼，仍在替今天的門作決定。'),
      stage(['scene:55'],['clue:library'],'他承認批准，也承認一直等待別人恢復程序。米菈沒有替所有旅人原諒他；下一步仍得一起修理。'),
      stage(['scene:20'],['clue:clockwork'],'他保留難看的維護紀錄，讓後來的人能查明為何不能省略。承擔責任，也包括放下替所有人下結論的權力。')
    ]},
    {id:'sena',name:'星奈',first:'scene:69',side:'stars',stages:[
      stage(['scene:69'],[],'她會敲同一個維護節拍，卻沒有把猜測當答案。她帶著星圖，仍願意等別人的一句話完整說完。'),
      stage(['scene:39'],[],'她一直替完成訊號敲門，因為有人只看求救紀錄。看見事情的後半段，需要耐心，也需要換一面讀。'),
      stage(['scene:30'],['clue:frost'],'她終於不必守著同一個節拍。紀錄仍會繼續，這次能留下新的日期與不一樣的聲音。')
    ]},
    {id:'lian',name:'璃安',first:'underworld:scene:11',stages:[
      stage(['underworld:scene:11'],[],'她記得旅人的歸處，卻答不出自己等了多久。先看見她是一個人，才能問她想往哪裡走。'),
      stage(['underworld:scene:15'],['underworld:clue:mist'],'名字來自一個曾被她幫助的孩子。被需要很久之後，她也開始找回可以屬於自己的稱呼。'),
      stage(['underworld:scene:35'],['underworld:clue:furnace'],'她看著空出的雙手，既笑又想哭。路燈仍亮的證明，讓休息終於不再像一次背叛。'),
      stage(['underworld:scene:45'],['underworld:clue:heart'],'她說願意一起出去，也說累了可以回來。同行是一個今天作出的回答，不是一份永遠有效的誓約。')
    ]}
  ]);
  // Each row keeps an observable detail separate from conclusions found in prose.
  const OBSERVATIONS=freeze({
    summoning:{title:'召喚台邊的磨痕',base:'石面的刻線在欄桿缺口前收束，邊沿留著反覆踩出的磨痕。牆會換位，這一小塊石台仍能讓人站穩。',opening:'我先記下亮線的位置。伊芙的警告比召喚完成那句話，更清楚地告訴我該往哪裡站。',clue:'銅扣記下聲音的來處，石台卻只重複完成。我還需要知道：它何時聽過我的回答。',close:'門上的自願抵達，與銅扣保存的原話不一致。我把兩者並排記下，沒有替那些聲音補上同意。'},
    garden:{title:'花根旁的小窗',base:'花葉朝著窗光生長，路石卻不對準任何一扇門。即使像家，這片庭園仍有塔內走廊的轉角。',opening:'米菈問的是窗後等著誰。辨認故鄉時，漂亮的風景還不能替代一個人的記得。',clue:'種籽接受沒有指定地址的願望。我留下空白，先沿它照出的路繼續找門。',close:'我沒有替米菈回答，門仍能開。允許每個人自己想，是這片庭園終於讓出的路。'},
    roots:{title:'樹皮上的舊線結',base:'根鬚繞過石縫，幾個線結沒有被新長的樹皮吞掉。變形搬動走廊，這裡仍留著舊路經過的痕跡。',opening:'洛恩說扣子是他的，刻字卻不是他寫的。一件留下的物品，也可能有不只一人的故事。',clue:'木環把名字成對留下。我先保存連結，不把暫時看不見的人劃成消失。',close:'紅線彼端傳來報平安；伊芙先繫好這一端才去尋人。岔路可以讓人分開，也可以讓後來的人找回彼此。'},
    echo:{title:'晶面的兩重回音',base:'敲一下晶面，近處與遠處會先後回響。兩道聲音重疊時很相像，停頓卻能讓它們重新分開。',opening:'晶牆模仿過我的聲音。我記下聽見的原句，也記下自己沒有說過它。',clue:'水晶保存不同人的回答。讓聲音依序說完，比把它們調成一個節拍更接近真實。',close:'門沒有替沉默的人決定。這裡留下的停頓，第一次能算作等待，而不是故障。'},
    library:{title:'書頁下面的字',base:'書架背面的紙角比正面磨損得更重。一張新標籤下面還有舊墨，層疊的字沒有因被遮住就消失。',opening:'奧倫桌上那個塗黑的方框仍在。我先找原手冊，不讓今天的解釋代替當時的文字。',clue:'殘頁保留恢復規則，解除時間卻空白。知道原來該怎麼做，還需要找到讓它重新生效的證明。',close:'兩個人一起卸下門軸零件，沒有用握手代替修理。我把改變記在他們實際做過的地方。'},
    mist:{title:'水面與空杯',base:'水光沿石槽繞過一個乾燥的凹口，倒影會在轉角分開。看起來連成一片的水，也走著不同的路。',opening:'倒影裡有不屬於我的故事。我先辨認它來自誰，不拿自己的記得去填陌生人的空白。',clue:'米菈只分享自己願意說的部分。清楚的水珠沒有讓我取得閱讀她全部往事的權利。',close:'空杯的標示拆下後，導航槽仍接受水珠。能認得一個人，不需要從他身上拿走一段人生。'},
    frost:{title:'冰層下的另一個日期',base:'霜把石面磨成半透明，一道刻痕被覆住，另一道卻仍能摸到。表面的安靜沒有消除冰下留下的東西。',opening:'鐘停在同一個刻度，紀錄卻不只那一天。星奈提醒我去看求救之後發生了什麼。',clue:'最後的送達回條證明那一晚已經過去。三短一長終於有了能對應的結果。',close:'門上的日期開始往前走，舊紀錄也沒有被擦掉。結束一場警報，不必把它曾經發生過的事實一起埋住。'},
    clockwork:{title:'並排的兩道管線',base:'小機組旁有兩道並排的槽，焊點在交會處格外粗。齒輪轉得很順，仍看不出它傳遞的東西是否相同。',opening:'呼喚與回答裡傳來相同內容。機器運轉正常，不等於接線正在尊重人的意思。',clue:'銅扣辨認人，水晶保存回答，殘頁允許反悔。幾件線索各有用途，不能只把它們當作增加力量的零件。',close:'一位旅人拒絕後，門留下能再呼喚的鈴。我記下這次沒有發警報的暫停。'},
    furnace:{title:'爐石旁的兩種流動',base:'石縫傳來穩定的熱，旁邊的透明槽映出細小光影。兩種流動靠得很近，經過的路徑卻各自分開。',opening:'米菈先觀察水珠沒有被火碰到。她的停步，讓我們看清了表格上沒有分開的兩條路。',clue:'記憶回到導航槽，火種仍跳動。把能源與名字分開之後，兩邊都沒有因此失去光。',close:'修好裝置之後，夥伴對塔的用途仍有不同想法。我先把這些意願分別留下，等最後的門再聽每個人回答。'},
    heart:{title:'留給手掌的空格',base:'路石的紋路圍著一小塊未刻字的平面。這裡很寬，刻痕卻沒有把所有方向壓成一條箭頭。',opening:'九枚印記各自留下不同證據。剩下的空格不需要新的犧牲，而需要我自己的回答。',clue:'星印接受繼續，也保留改變心意的可能。往前走，並不代表替同行的人一次決定到底。',close:'門學會詢問之後，三種未來仍各有照顧的方式。我選的結局會留下，其他人的去留也仍屬於他們。'},
    'underworld:roots':{title:'根脈間的停腳處',base:'根間的小燈映在舊石路上，樹皮沒有蓋住路邊的磨痕。有幾道腳印停在同一處，又轉向原來的方向。',opening:'這一次地下沒有召喚聲。我是自己走進來，也先與同伴說好不必勉強跟隨。',clue:'返程路牌允許回頭。燈油早乾了，光卻沒有熄；我還不能把看不見的照料者當成答案。',close:'巡站長反覆說守燈人不能離站。我記下這道限制，也記下門縫裡那位連自己的名字都找不到的人。'},
    'underworld:mist':{title:'渡渠邊的名字槽',base:'水邊的石槽留著插過木籤的凹痕，潮痕沒有替每一格補上名字。小燈映在水裡，與岸邊的光各有一段距離。',opening:'提燈的陌生人記得別人的歸處，卻說不出自己等了多久。這裡還需要留一個屬於她的問題。',clue:'渡籤保存了璃安的名字。這能讓她記起自己，不能成為命令她留下的新辦法。',close:'渡渠的門開向書庫。她想查看自己的誓言，我先陪她尋找原文，不替她說承諾一定不能結束。'},
    'underworld:library':{title:'斷頁邊的留白',base:'石頁的斷口經過反覆觸摸，表面的字只有半句。旁邊留著能接回另一片的缺槽，磨得與字跡一樣舊。',opening:'誓言早於高塔，仍需要讀完。古老不代表完整，半頁文字也不能替另一半作答。',clue:'後半頁允許守燈人在疲憊時放下燈。她仍擔心路會因此變暗；解除命令還需要讓她安心的證據。',close:'補全石頁之後，留下的路仍通往深井。先去看燈真正靠什麼亮著，才有辦法回答放手會不會熄光。'},
    'underworld:furnace':{title:'沒有火焰的暖石',base:'爐石溫暖，卻看不到火苗。光沿透明石管往上走，轉過一個分岔，再進入不同方向的細槽。',opening:'提燈靠近管道就變亮。我的第一筆觀察是光的變化，還不能把巧合寫成璃安必須留下的理由。',clue:'分流後，她放下燈，路上仍一盞盞亮著。原來雙手空下來，也可以是修理完成的樣子。',close:'前後的燈都保持明亮，璃安走到我身邊。這段路已經不用誰一直站在同一個位置才能成立。'},
    'underworld:heart':{title:'門庭裡並肩的人影',base:'石框刻著並肩離去的人，沒有哪一個被刻得更大。入口前留著足夠兩人停步的地方，腳印也不只朝向一邊。',opening:'原初門早於高塔。同行的圖樣先留在這裡，後來才有把一個人永遠留下的舊誓。',clue:'璃安親口願意，也留下累了能休息的回答。歸印照亮的是她自己的選擇，不是讓她跟隨我的命令。',close:'誓守者沒有把守燈人算進旅人。只要她仍被留下，最後一人就永遠不會回家；我終於知道這道圈該從哪裡解開。'}
  });
  // Authoring is kept in Traditional Chinese without changing voiced source prose.
  function context(run){
    const n=N();if(!run||!n)return null;
    const chronicle=n.validateChronicle(run.chronicle,run.floor);if(!chronicle)return null;
    return {n,chronicle,read:new Set(chronicle.read),clues:new Set(chronicle.clues),chapter:n.chapterForFloor(run.floor)};
  }
  const allows=(ctx,value)=>value.read.every(id=>ctx.read.has(id))&&value.clues.every(id=>ctx.clues.has(id));
  const latest=(ctx,stages)=>stages.filter(s=>allows(ctx,s)).at(-1);
  const source=(ctx,id)=>{const scene=ctx.n.allScenes().find(s=>s.id===id);return scene?{id,title:scene.title,floor:scene.floor}:null;};
  function threads(run){const ctx=context(run);if(!ctx)return [];
    return THREADS.flatMap(thread=>{const note=latest(ctx,thread.stages);return note?[{id:thread.id,title:thread.title,text:note.text,status:note.status,sources:note.read.map(id=>source(ctx,id))}]:[];});
  }
  function characters(run){const ctx=context(run);if(!ctx)return [];const stories=S()?.collectedStories(run)||[];
    return PEOPLE.flatMap(person=>{const side=stories.find(s=>s.kind===person.side),note=latest(ctx,person.stages);if(!note&&!side)return [];
      const named=ctx.n.allScenes().some(scene=>ctx.read.has(scene.id)&&scene.paragraphs.some(p=>p.includes('璃安'))),name=person.id==='lian'&&!named?'提燈的陌生人':person.name;
      return [{id:person.id,name,text:note?.text||(side?side.record.paragraphs[0]:''),sources:note?note.read.map(id=>source(ctx,id)):[],echo:side?{kind:side.kind,title:side.record.title,text:side.record.paragraphs[0]}:null}];
    });
  }
  function journal(run){return {threads:threads(run),characters:characters(run)};}
  function observation(run){const ctx=context(run);if(!ctx||run.expedition?.active)return null;const chapter=ctx.chapter,o=OBSERVATIONS[chapter.id];if(!o)return null;
    const sceneId=floor=>floor<0?'underworld:scene:'+(-floor):'scene:'+floor;
    let key='',id='';if(ctx.read.has(sceneId(chapter.low))&&ctx.clues.has(chapter.clueId)){key='close';id=sceneId(chapter.low);}else if(ctx.read.has(sceneId(chapter.mid))&&ctx.clues.has(chapter.clueId)){key='clue';id=sceneId(chapter.mid);}else if(ctx.read.has(sceneId(chapter.high))){key='opening';id=sceneId(chapter.high);}
    return {title:o.title,chapter:chapter.id,paragraphs:[o.base,...(key?[o[key]]:[])],sourceIds:id?[id]:[],stage:key||'observed',next:ctx.n.objective(run)};
  }
  function bestiary(run,definitions){const ctx=context(run),m=M();if(!ctx||!m)return [];const ecology=m.ecology(run),defs=definitions||get('tower-party-core','TowerPartyCore')?.defs()||{};
    return Object.entries(defs).map(([id,def],order)=>{
      const lord=id.startsWith('lord-'),local=lord?def.floor===run.floor&&!run.expedition?.active:Object.hasOwn(ecology.variants,id),sceneId=def.floor<0?'underworld:scene:'+(-def.floor):'scene:'+def.floor;
      const storyKnown=lord&&ctx.read.has(sceneId),known=!lord||local||storyKnown;
      const variant=ecology.variants[id],guide=F()?.monster(def);
      return {id,local,known,storyKnown,name:variant?.name||(known?def.name:'尚未遇見的樓層主'),region:local?ecology.name:'',lore:lord?(storyKnown?def.personality:local?'守在本章出口的樓層主。先觀察蓄力與地面警示，留好退路。':''):guide?.lore||'',order};
    }).sort((a,b)=>Number(b.local)-Number(a.local)||Number(b.known)-Number(a.known)||a.order-b.order).map(({order,...row})=>row);
  }
  return Object.freeze({threads,characters,journal,observation,bestiary});
});
