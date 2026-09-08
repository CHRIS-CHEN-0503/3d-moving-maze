/* 裂隙逸聞：原創支線文本與已完成故事的回聲；不授予主線印記或修改旅程。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerSideStories = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const STORIES = freeze({
    threads: {
      kind:'threads',title:'紅線彼端',explorerId:'eve',maxFloor:89,mechanic:'ordered',orderMode:'seeded',size:9,timeLimit:150,shiftSeconds:27,environmentId:'roots',palette:[0x82757e,0xc6a294,0xb4a18e,0xf78c9e,'tree'],
      description:'伊芙留下的紅線被牆分成三段，線的彼端卻有一個陌生人知道她的小秘密。',objective:'依副本提示的順序接回三段紅線，再返回出口。',
      intro:[
        '裂隙裡的樹根掛著三枚紅線結。伊芙蹲在最靠近門的那枚旁，指節被線磨得發白。「我以前跟隊友約好，誰先找到路，就拉兩下。」你碰了碰線頭，另一端竟回了三下。',
        '一道被牆隔住的聲音問：「畫地圖的人，還把北方畫在最下面嗎？」伊芙忽然笑了一下。那是她只說給同行者聽過的笑話，但聲音太遠，誰也無法確定它是現在的呼喚，還是樹根留下的昨日。',
        '三段線不能猛拉，否則會從不同岔路收緊。門邊依這次變形留下接線次序；你得循序鬆開線結，讓那一句沒說完的話自己走過來。伊芙把剩下的線交給你：「這回，換我學著等。」'
      ],
      steps:[
        {index:0,title:'窗邊的線結',prompt:'線頭纏著一片小窗形的木牌。門邊的接線次序若輪到這一段，就先鬆開背面的活結；別替彼端的人拉緊。',actionLabel:'接回窗邊紅線',success:'木牌輕碰樹根，聲音說：「我把那扇窗留著了。」',failure:'這段線還繃著；先按門邊次序接好前一段。'},
        {index:1,title:'口袋裡的線結',prompt:'一枚縫歪的布扣綁在線上，像有人匆忙修補過外套。依提示次序接它，才能讓線從移動牆縫穿過。',actionLabel:'接回布扣紅線',success:'布扣鬆開，傳來一聲很短的笑：「妳縫的扣子，又掉了。」',failure:'布扣卡進牆縫；接線次序不對，請看副本提示。'},
        {index:2,title:'岔路上的線結',prompt:'岔路標記只畫了一張空椅子，椅背的紅線還在微微顫動。這不是叫人立刻趕來，而是替重逢留位子。',actionLabel:'接回岔路紅線',success:'空椅子的圖樣亮起，線的彼端說：「別急，我還認得回來的路。」',failure:'岔路線還沒接到前段；請按照提示逐段完成。'}
      ],
      outro:[
        '最後一個結鬆開，三段紅線連成一條能隨牆轉彎的細路。彼端沒報名字，只把那個關於南北顛倒的笑話完整說了一遍。伊芙笑得蹲下去，手卻仍緊握著線。',
        '「我以前畫反地圖，是怕走散的人不知道我在等他。」她把窗形木牌遞給你，背面刻著兩張並排的椅子。你們沒有追問聲音來自哪一天，只約好下次接線時，各帶一個新的笑話。',
        '裂隙合上前，紅線輕輕碰了你的手背。它沒有替你打開章末的門，也沒有帶回失散者；它只證明，一句尚未抵達的話，仍值得替它留著路。'
      ],
      record:{id:'lore:threads',title:'兩張椅子的木牌',paragraphs:[
        '伊芙的反向地圖，原來也是一封沒有信封的留言：看到這種畫法，就知道她來過，也等過。她怕的不是看不懂方向，而是有人以為自己已經被忘記。',
        '紅線彼端的人記得她縫歪的扣子，還約了下一個笑話。我們尚未知道那道聲音的位置，便把兩張椅子的木牌收進日誌，不替重逢寫下日期。',
        '線結留下的是一個約定，不是通行證。就算後來的路把我們帶到不同地方，等待也不必變成把誰綁在原地的繩子。'
      ]},
      links:{sceneId:'scene:70',chapterText:'伊芙把兩張椅子的木牌繫在根脈門旁，沒有把那根紅線拉直。你聽見線後又傳來縫歪扣子的笑話，這一次她笑著回嘴：「下次自己縫。」陌生的聲音，終於有了像朋友的停頓。',endings:{
        release:'臨別時，伊芙把木牌從中間分開，讓兩張椅子各去一個方向。她說這不是散夥，只是下次見面，終於能挑一個不會搬家的地方。',
        keeper:'守望者的休息桌旁多了兩張不寫名字的椅子。伊芙說其中一張留給偶爾迷路的朋友，另一張也可以讓你坐；紅線這次只拿來修桌布。',
        bridge:'驛站開門後，伊芙收到一封只畫了倒向南方箭頭的邀請。她把窗形木牌放進口袋，笑著說，那個欠她新笑話的人，終於找到郵差了。'
      }}
    },
    mirrors: {
      kind:'mirrors',title:'倒影審判',explorerId:'mira',maxFloor:69,mechanic:'choice',orderMode:'none',size:7,timeLimit:150,shiftSeconds:28,environmentId:'mist',palette:[0x72969c,0xafd0cb,0xa0bebc,0xb4ffe9,'water'],
      description:'三座鏡子正在挑選誰才是真正的米菈。她卻記得自己從沒坐上過被告席。',objective:'閱讀每座鏡子的規則，各選出能保留原話的回答；順序不限。',
      intro:[
        '三座鏡子圍成沒有法官的房間。第一面映出總在微笑的米菈，第二面映出一直低頭的她，第三面什麼也沒有。鏡框宣讀：「三份紀錄，須刪去兩份，方可認定本人。」真正的米菈站在你身後，輕聲問誰定了這個規矩。',
        '她拿出那片空白書籤，這次沒有急著寫字。「有人問我喜不喜歡下雨。我說，有時喜歡，有時不喜歡。它只留下前半句。」你望向第三面鏡子，空白裡竟有一把剛剛收起的小傘。',
        '鏡座各刻了一條較舊的規則，字跡比判詞細得多。你要替三道記錄找回符合原文的做法，不是替米菈決定她應該成為哪一種人。她把書籤放在椅上，自己站著等答案。'
      ],
      steps:[
        {index:0,title:'晴雨鏡',prompt:'鏡座原文：「前後兩句皆須留下。」聲音說：「我喜歡雨聲，但不喜歡鞋子淋濕。」哪種紀錄符合原文？',options:['只留下她喜歡雨聲','把兩句原話都記下','刪掉兩句，避免矛盾'],correctChoice:1,actionLabel:'回答晴雨鏡',success:'鏡面第一次同時映出雨傘和陽光。米菈說：「對，兩個都是我。」',failure:'鏡座要求兩句都留下；相反的感受不代表其中一句是假的。'},
        {index:1,title:'留白鏡',prompt:'鏡座原文：「未作答不作推定。」鏡中人還沒決定是否離開，紀錄應該怎麼寫？',options:['她已同意離開','她已拒絕離開','尚未作答，保留空白'],correctChoice:2,actionLabel:'回答留白鏡',success:'空白不再閃成錯誤訊號，鏡子安靜留下了等待的位置。',failure:'原文說不能推定；沒有回答，不代表同意或拒絕。'},
        {index:2,title:'名字鏡',prompt:'鏡座原文：「引語須連同說話者保存。」兩位旅人說了相反的話，要留下怎樣的紀錄？',options:['分別署名，保留兩句','用票數較多的一句代替','把兩句合成大家都同意'],correctChoice:0,actionLabel:'回答名字鏡',success:'兩道倒影各自找到姓名的位置，沒有誰被改寫成另一個人。',failure:'鏡座要求連同說話者保存；不能把不同人的句子合成一個答案。'}
      ],
      outro:[
        '三座鏡子的判詞一行行退去，留下三個各自完整的倒影。米菈終於坐到那張椅子上，把書籤翻到背面，只寫了今天有一點想家，沒有解釋是一點還是很多。',
        '第三面鏡子的角落浮出一行細字：「收件者可以只拆自己願意拆的信。」旁邊畫著一把小傘，柄上的缺口與米菈手裡那片書籤相合。她把這個發現記下，說以後若遇到水邊的門，要慢慢讀。',
        '你們離開時，鏡子仍映著人，卻不再替誰裁判。米菈回頭朝那幾個看似相反的自己點頭，像與尚未說完話的朋友道別。'
      ],
      record:{id:'lore:mirrors',title:'一把尚未收起的傘',paragraphs:[
        '米菈不只會笑，也會猶豫，有時想起雨聲，有時先想到濕透的鞋子。三座鏡子的謎題有明文規則，真正的她卻不需要被縮成一條規則。',
        '我們留下她前後兩句話，留下沒有作答的空白，也把不同聲音還給不同名字。最後浮出的細字提到了收信，而非審判。',
        '那把傘的缺口與空白書籤相合，像某個仍在等她親手打開的信封。這一次，我不打算搶先替她拆開。'
      ]},
      links:{sceneId:'scene:40',chapterText:'米菈走過空杯時，把那片帶傘柄缺口的書籤壓進自己的日誌。「今天我還是不喜歡濕鞋子。」她忽然說，然後跟你一起笑了。那句關於雨的話，終於不用被誰刪去一半。',endings:{
        release:'米菈離開前遇上一場小雨。她把傘撐開又收起，讓幾滴雨落進掌心；這回喜歡或不喜歡，都不必向鏡子交代。',
        keeper:'米菈在休息室留下一把備用傘，傘旁沒有勸人樂觀的句子，只寫著「想用就拿」。你認得那個與書籤相合的缺口。',
        bridge:'米菈的小書屋有一頁可以一直空著的借閱簿。有人問空白算不算完成，她先指指窗邊的雨傘，再說，今天沒想好也可以下次再來。'
      }}
    },
    clockwork: {
      kind:'clockwork',title:'停擺工坊',explorerId:'rowan',maxFloor:79,mechanic:'repair',orderMode:'fixed',size:9,timeLimit:160,shiftSeconds:29,environmentId:'clockwork',palette:[0x8a7f68,0xc5b591,0xb5aa8a,0xffd785,'gear'],
      description:'洛恩遇見自己學徒時做壞的第一扇門。它沒有鎖，卻整夜喊著「請再試一次」。',objective:'找齊緩衝輪與回程簧片，最後修理中央機芯。',
      intro:[
        '工坊牆上掛滿沒有鑰匙的鎖，最小的一扇木門卻把自己鎖得死緊。洛恩聽見它喊請再試一次，臉就紅了。「我學徒時做的。師傅叫我修門鈴，我偷偷加了會替客人開門的機關。」',
        '那扇門分不清敲門與推門，夜裡總把空走廊當成排隊的客人。洛恩卸下自己的護目鏡，鏡片內側還留著歪歪的第一號作品。「我以為機器越快，大家就越喜歡它。」門後又傳來一聲失望的喀噠。',
        '緩衝輪與回程簧片被變形的工作台送到兩邊。先找齊零件，再碰中央機芯；如果硬推，它會把這次修理也當成另一位急著進門的客人。洛恩遞來空工具盒，這次先問你願不願意幫忙。'
      ],
      steps:[
        {index:0,title:'緩衝輪',prompt:'小輪齒間塞著一張舊紙條：「給鈴聲留一口氣。」取下紙屑後，它能讓機芯先停一下，再決定下一步。',actionLabel:'收好緩衝輪',success:'緩衝輪放進工具盒，洛恩認出師傅寫得很醜的氣字。',failure:'先把零件收妥，才有辦法修理中央機芯。'},
        {index:1,title:'回程簧片',prompt:'彈簧片的末端不是尖鉤，而是一小圈朝外的把手。裝好後，進門的人才能自己把門拉回來。',actionLabel:'收好回程簧片',success:'簧片輕輕彈響，聲音像有人終於能把話說完。',failure:'回程簧片還沒入盒；別急著推動機芯。'},
        {index:2,title:'第一號機芯',prompt:'機芯留著兩個空槽。必須先收集緩衝輪與回程簧片，才能讓門學會等待，也學會放手。',actionLabel:'裝回兩件零件',success:'木門先響了一下鈴，等你伸手，才緩緩打開。',failure:'缺少零件。先找到緩衝輪與回程簧片，再來修機芯。'}
      ],
      outro:[
        '木門開向一間小小的空屋，屋裡只有一張工作凳。洛恩坐了片刻，像終於輪到很久以前那個學徒下班。他把第一號作品的銘牌扶正，沒有磨掉自己寫錯的筆畫。',
        '凳下壓著師傅的便箋：「有些機關壞在走得太順。」下面畫了兩條原本不該接在一起的線，卻沒註明它們通往哪裡。洛恩仔細拓下圖案，說這不是答案，但以後聽見太急的門，他會知道先看哪裡。',
        '你們離開時，木門說的是慢走，不再叫人重試。洛恩把那張醜字便箋放回護目鏡後面，像替第一堂課補上了遲到很久的下課鐘。'
      ],
      record:{id:'lore:clockwork',title:'第一號作品',paragraphs:[
        '洛恩曾偷偷替門鈴加上自動開門機關，以為做得更多就會被稱讚。多年後，那扇門仍在空房間前反覆道歉，卻不知道自己究竟錯在哪裡。',
        '我們找回緩衝輪與回程簧片，讓它先等人伸手，再讓人自己離開。這場修理沒有碰到高塔的主機，只把一個學徒沒做完的小錯誤收了尾。',
        '師傅留下兩條分離管線的草圖，沒有名字，沒有完整答案。洛恩帶走拓本，卻把銘牌留在門上；那枚歪字，終於也能算是他學過的證明。'
      ]},
      links:{sceneId:'scene:20',chapterText:'洛恩把師傅那張醜字便箋放在新的維護記錄旁。你看見熟悉的兩條分離管線，與停擺工坊的小門畫在同一頁。這次他沒有替門追加任何自以為貼心的機關，只先請下一位旅人試著關上它。',endings:{
        release:'洛恩走前又回去看了第一號作品，確認它能從兩邊開合。他沒有帶走銘牌，只在背面加了一個新的日期，當作學徒終於交件。',
        keeper:'洛恩教新守望者修理時，總先拿出一只慢半拍的小門鈴。他不再用最快完成的人示範，而是請每個人試一次把門關回去。',
        bridge:'驛站的修理課從一扇不起眼的小木門開始。洛恩把第一號作品的歪字拓在課本上，學生笑時，他也笑，然後讓大家親手試試門把。'
      }}
    },
    tribunal: {
      kind:'tribunal',title:'封存證詞',explorerId:'oren',maxFloor:59,mechanic:'evidence',orderMode:'fixed',size:7,timeLimit:160,shiftSeconds:30,environmentId:'library',palette:[0x7e788d,0xb5abc3,0xaca0b2,0xe4c4ff,'books'],
      description:'奧倫找到一份替自己辯解得太完美的證詞。他說，真正的那一份應該難看得多。',objective:'先讀兩份原始證據，再於封存台選擇符合原文的保存方式。',
      intro:[
        '審議室的座位全空著，桌上卻排好寫著無責任三個字的判詞。奧倫拿起最上面一頁，讀了很久。「這裡說我當晚一直提出反對。」他把紙放低，「可我記得，我有一段時間沒有說話。」',
        '兩架證據櫃隨著迷宮分往不同方向，一架留著傳話人的錄音，另一架留著奧倫未寄出的附註。中央封存台催你們選一份最像真相的版本，好讓房間繼續保持整齊。奧倫第一次沒有接那支早已沾墨的筆。',
        '「先讀完，再決定怎麼留。」他把兩張標籤交給你。這裡不會替那一晚判誰有罪，也不會提早交出主線的殘頁；你們只要救回原話，免得往後的人連問題都無從追問。'
      ],
      steps:[
        {index:0,title:'傳話人的錄音',prompt:'錄音裡有人說：「我聽見他沉默了很久，後來才叫我們先等等。」頁腳規則：須保留原音、來源與先後，不得刪去停頓。',actionLabel:'讀取第一份證據',success:'你記下錄音來源與長長的停頓；那不是空白錄音。',failure:'證詞尚未讀取完整，先保存它的來源與順序。'},
        {index:1,title:'未寄出的附註',prompt:'奧倫寫道：「我當時害怕承認自己也不知道。」頁腳規則：附註須與原件並列，不可代替原件，也不可替所有人宣告原諒。',actionLabel:'讀取第二份證據',success:'附註放到錄音旁邊，兩份資料沒有被剪成一句漂亮的辯解。',failure:'附註必須與原件並列；先讀完內容再前往封存台。'},
        {index:2,title:'封存台',prompt:'請先讀完兩份證據。依照兩份頁腳規則，怎樣保存才不會替往後讀到的人預先寫好結論？',options:['只封存整齊的無責任判詞','刪掉錄音，只保留他的道歉','將錄音與附註署名並列，留待查證'],correctChoice:2,actionLabel:'選擇保存方式',success:'封存台留下兩份來源清楚的原件，判詞欄保持空著。',failure:'兩份規則要求保留原件與來源，附註不能取代原件；請再核對證據。'}
      ],
      outro:[
        '過分整齊的判詞變回普通白紙。奧倫把錄音與附註分別裝袋，沒有用那張白紙替自己補上一句好話。「我怕留下難看的部分，別人就再也不肯聽我說話。」他的聲音比平常慢。',
        '最後一個封袋裡掉出半張座位表。靠窗的席位寫著修門人，旁邊留了一個遲遲沒有簽名的格子。奧倫認出那是自己的筆，卻想不起為什麼那一天又把名字擦掉。',
        '你把座位表夾入日誌，沒有把擦痕補齊。離開時，奧倫終於在今日的送存紀錄上簽下名字；這一次不是批准別人前進，只是證明他願意讓那個問題留著。'
      ],
      record:{id:'lore:tribunal',title:'沒有替誰寫好的判詞',paragraphs:[
        '封存室保存過一個過分乾淨的奧倫，乾淨到他自己也認不出來。我們沒有選最好聽的說法，而是並列原音、附註與各自來源。',
        '奧倫承認自己也會害怕，不代表所有旅人已經原諒他。原件留下來，想問的人仍然能問，不想替他下結論的人也不必被催促。',
        '座位表上還有一格被擦去的簽名。這段支線沒有交出主線殘頁，只讓我知道，有些證據曾被藏起來，不是因為看不見，而是因為太不願意再看一次。'
      ]},
      links:{sceneId:'scene:50',chapterText:'奧倫把封存室帶出的兩個紙袋一起放上門邊的書架，原音與附註都沒少。「那份替我說得太好的判詞，就留白吧。」他說。你看著他的名字出現在送存欄，旁邊沒有任何要求被原諒的字。',endings:{
        release:'離開高塔前，奧倫把封存室的送存回條交給願意保管它的人。半張座位表也留在袋裡，擦去的格子仍然可見；他沒有趁告別把問題帶走。',
        keeper:'每次輪值交接，奧倫都會檢查原音與附註是否仍能分開查閱。他不再要求新值班者相信自己的記性，只教他們從哪裡找到當時的紀錄。',
        bridge:'驛站的維護台旁留著封存室送來的兩個紙袋，查閱者可以各自讀完再決定。奧倫偶爾坐在旁邊回答問題，也學會接受有人今天不想聽他回答。'
      }}
    },
    stars: {
      kind:'stars',title:'無星觀測台',explorerId:'sena',maxFloor:69,mechanic:'shift',orderMode:'seeded-tail',size:9,timeLimit:180,shiftSeconds:25,environmentId:'frost',palette:[0x687c9e,0xaebad9,0xa7b7ce,0xd7edff,'spire'],
      description:'星奈的觀測台永遠指著沒有星星的地方。她懷疑不是天空空了，而是記錄還停在牆的另一面。',objective:'先啟動觀測台，親歷至少一次迷宮變形，再依提示次序校準兩座星標。',
      intro:[
        '圓頂沒有破洞，星圖卻寫滿星星的位置。星奈踩上觀測台，把眼睛貼近空空的鏡筒。「我一直以為自己看錯了。」她摘下星形髮飾，鏡片後竟藏著一張不及指甲大的手繪圖，上面只有一顆很笨拙的星。',
        '「這是我第一次自己畫的，不是抄圖鑑。」她把它放進校準槽。台座微微亮起，浮出兩個等待移位的星標。刻度說得很清楚：先記錄此刻，讓迷宮變形一次，再用不同角度重看；原地等時間流逝不能當作觀測。',
        '兩座星標的讀取次序，會在這次旅程的提示中顯示。你必須先啟動中央台，再真正經歷移牆，最後依序校準。星奈把鏡筒扶正：「如果星星還在，我不想又因為站錯地方，就把它劃掉。」'
      ],
      steps:[
        {index:0,title:'初始觀測台',prompt:'把第一顆手繪星放進校準槽。啟動後，必須等本副本的迷宮實際變形至少一次；先前的變形或單純等待都不算。',actionLabel:'啟動觀測台',success:'台座記下此刻的牆影。請親歷一次迷宮變形，再依提示次序校準兩座星標。',failure:'必須先啟動觀測台，才能記錄新的變形觀測。'},
        {index:1,title:'遠光星標',prompt:'遠光星標記著鏡筒之外的微光。啟動中央台後親歷一次迷宮變形，再依提示輪到此處時校準。',actionLabel:'校準遠光星標',success:'遠光透過新的牆縫落入鏡筒，星奈在圖上補回一個小點。',failure:'還未記錄啟動後的變形，或星標次序不符；請查看副本提示。'},
        {index:2,title:'近影星標',prompt:'近影星標記著腳下的牆影。啟動中央台後親歷一次迷宮變形，再依提示輪到此處時校準。',actionLabel:'校準近影星標',success:'牆影退到正確刻度，空白星圖亮出了一條細細的觀測線。',failure:'還未記錄啟動後的變形，或星標次序不符；請查看副本提示。'}
      ],
      outro:[
        '最後一座星標對準，鏡筒裡只出現一點微光，並沒有壯麗得讓人鼓掌的星河。星奈卻趴在台邊看了很久。「就是它。比圖鑑上歪一點，但就是它。」她把那張小小的手繪圖重新別回髮飾後。',
        '底座吐出一條維護紙帶，上面先是一串短記號，隔了一段空白，才跟著較長的一筆。旁註被折痕壓住，只剩請看背面四個字。星奈沒有急著猜它代表什麼，先把正反兩面都仔細拓下。',
        '觀測台的結論很短：星未失，觀測面已移。你把這句話收進日誌，想起高塔那些始終重播同一段話的地方。也許下一次看不見答案時，要先問自己是不是仍站在昨日的位置。'
      ],
      record:{id:'lore:stars',title:'星未失，觀測面已移',paragraphs:[
        '星奈最珍惜的不是完整星圖，而是一顆自己第一次畫的、形狀有點歪的星。她曾因再也看不見它，懷疑起自己最初的那次仰望。',
        '我們在觀測台啟動後等來真正的移牆，再從兩座星標校準角度。微光並沒有重新誕生，它只是終於穿過了我們願意重看的那道縫。',
        '維護紙帶留下短記號、空白、長記號，還提醒讀者翻面。這不是此刻就能回答的謎底，但以後遇見一張只有正面被反覆閱讀的紀錄，我會記得它。'
      ]},
      links:{sceneId:'scene:30',chapterText:'星奈把無星觀測台的雙面拓本攤在融霜的門沿。你認得那些短記號後面曾被忽略的空白，還有最後較長的一筆。她將第一顆畫歪的星補在日期旁，這次不用把看不見的那段劃掉。',endings:{
        release:'星奈抵達自己的門前，先抬頭尋找那顆不太像圖鑑的星。她沒有立刻畫完新的星圖，只把第一筆留得稍微歪一點，像還給當年的自己一個點頭。',
        keeper:'守望台的觀測簿增加正面與背面兩欄。星奈偶爾把手繪星借給新值班者校準，提醒他們記下站的位置，不要只記下自己想看的天空。',
        bridge:'星奈在驛站辦了第一場沒有標準答案的觀星夜。每位旅人都可以畫出故鄉的星，第一張掛上去的，仍是那顆形狀不太準的小星。'
      }}
    },
    supper: {
      kind:'supper',title:'無名者的晚餐',explorerId:null,maxFloor:95,mechanic:'choice',orderMode:'none',size:7,timeLimit:150,shiftSeconds:30,environmentId:'garden',palette:[0x998979,0xd4b89a,0xc1ac8d,0xffcf8b,'garden'],
      description:'一張餐桌替三位不肯先報名字的旅人留著熱飯。先聽他們想吃什麼，今晚不查通行證。',objective:'依三位旅人的明確口味，從餐台的虛構餐點各選一份；不消耗背包。',
      intro:[
        '你走進裂隙，先聞到烤麵包的香氣。三張椅子分散在會移動的矮牆間，餐台上留著小牌：「姓名可以飯後再說。」鍋裡的湯沒有見底，桌邊也找不到收錢的人，只有一盞燈替晚到者留著。',
        '穿雨披的旅人想念家裡的鹹粥，戴手套的少年盯著甜麵包，抱枕頭的老人卻只想喝清爽的湯。他們各自把喜歡與不喜歡說得很清楚，像難得有人願意在趕路以外問這些小事。',
        '所有餐點都是餐台準備的故事道具，不會拿走你的口糧。先讀口味再選餐，送錯會觸動老餐台的退盤機關，造成輕微傷害，防具可減傷；之後仍能依提示換一份。桌燈會等到裂隙關閉，但不會逼誰把碗吃空。'
      ],
      steps:[
        {index:0,title:'雨披旅人的椅子',prompt:'旅人說：「我想吃熱的、鹹的，不放奶也不放糖。走了那麼久，今晚就想念一碗粥。」餐台應端哪一份？',options:['冷莓甜糕（冷、甜）','暖穀鹹粥（熱、鹹、無奶糖）','蜜乳麵包（甜、含奶）'],correctChoice:1,actionLabel:'選擇旅人的晚餐',success:'旅人捧起鹹粥，說自己最想念的其實是鍋蓋掀開的聲音。',failure:'他想要熱鹹粥，而且不要奶與糖；再看看餐台標示。'},
        {index:1,title:'手套少年的椅子',prompt:'少年說：「我要甜的、可以用手拿著吃的麵包。熱湯會讓我的手套濕掉。」餐台應端哪一份？',options:['蜜果軟麵包（甜、可手持）','熱蘑菇湯（鹹、液體）','暖穀鹹粥（鹹、需用匙）'],correctChoice:0,actionLabel:'選擇少年的晚餐',success:'少年把麵包掰成兩半，問你趕路時有沒有留下一個能吃點心的下午。',failure:'他要甜麵包、能用手拿，不是湯或鹹粥；請再選一份。'},
        {index:2,title:'抱枕老人的椅子',prompt:'老人說：「清淡、不辣的蔬菜湯就好。我只想喝湯，今晚先不吃甜點。」餐台應端哪一份？',options:['椒火濃湯（辣）','蜜雲布丁（甜點）','晴蔬清湯（清淡、不辣）'],correctChoice:2,actionLabel:'選擇老人的晚餐',success:'老人把枕頭放到空椅上，笑著說，那個位子也可以留給你的疲倦。',failure:'他要清淡不辣的蔬菜湯，暫時不吃甜點；標示裡就有答案。'}
      ],
      outro:[
        '三盞桌燈一起亮了。沒有人忽然宣布自己是被遺忘的王，也沒有哪只碗變成秘密鑰匙；他們只是把一餐飯好好吃到喜歡的位置，然後慢慢準備繼續走。',
        '少年在餐牌背面畫了四張椅子，原來也算進了你。雨披旅人留下掀鍋蓋的聲音怎麼寫，老人則把枕頭拍鬆，請你至少坐一小會兒。你終於問了他們的名字，他們笑著說，下次見面再交換也不遲。',
        '裂隙將合時，餐牌上多了一行字：不必帶著答案來吃飯。你把四張椅子的拓印收好，知道這一晚不會改變高塔的命令，卻可能讓明天的路沒那麼難走。'
      ],
      record:{id:'lore:supper',title:'第四張椅子',paragraphs:[
        '在找出口、找印記、找答案之間，我替三位旅人送過一頓晚餐。鹹粥、甜麵包、清淡的湯，都來自裂隙餐台，沒有消耗背包的補給。',
        '那裡沒有暗藏身分的考驗，也不要求報答；只要先聽清楚別人想要什麼。老餐台退錯盤時會磕傷人，卻仍容許重新選餐，不會把一次小失誤寫成誰的缺點。',
        '餐牌背面有第四張椅子，替趕路的我留著。這不是主線的另一把鑰匙，只是一個偶爾想起來，就會願意再往前走幾步的晚上。'
      ]},links:null
    }
  });
  function get(kind) { return typeof kind === 'string' && Object.hasOwn(STORIES,kind) ? STORIES[kind] : null; }
  function eligible(floor) { return Number.isInteger(floor) && floor >= 1 && floor <= 99 ? Object.values(STORIES).filter(story=>floor<=story.maxFloor) : []; }
  function step(kind,index) { const story=get(kind);return story && Number.isInteger(index) && index>=0 && index<3 ? story.steps[index] : null; }
  function recollection(kind) { return get(kind)?.record || null; }
  function completedEntries(run) {
    const history=run?.expedition?.history;
    if (!Array.isArray(history) || !Number.isInteger(run.floor) || run.floor<1 || run.floor>99) return [];
    return history.filter(entry=>entry && entry.outcome==='completed' && get(entry.kind) && Number.isInteger(entry.floor) && entry.floor>=run.floor && entry.floor<=get(entry.kind).maxFloor);
  }
  function collectedStories(run) { const kinds=new Set(completedEntries(run).map(entry=>entry.kind));return Object.values(STORIES).filter(story=>kinds.has(story.kind)); }
  function echoesForScene(run,sceneId) {
    if (typeof sceneId!=='string' || !/^scene:[1-9][0-9]?$/.test(sceneId)) return [];
    const floor=Number(sceneId.slice(6));
    if (!run || floor<run.floor) return [];
    const completed=new Set(completedEntries(run).filter(entry=>entry.floor>=floor).map(entry=>entry.kind));
    return Object.values(STORIES).filter(story=>completed.has(story.kind) && story.links?.sceneId===sceneId).map(story=>({kind:story.kind,title:story.record.title,text:story.links.chapterText}));
  }
  function endingEchoes(run,endingId) {
    if (!run || run.floor!==1 || !['release','keeper','bridge'].includes(endingId) || run.chronicle?.ending!==endingId) return [];
    return collectedStories(run).filter(story=>story.links).map(story=>({kind:story.kind,title:story.record.title,text:story.links.endings[endingId]}));
  }
  return freeze({STORIES,get,eligible,step,recollection,collectedStories,echoesForScene,endingEchoes});
});
