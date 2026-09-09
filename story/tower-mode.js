/* 倒轉高塔：共用一般版引擎與操作，獨立保存劇情進度。 */
(function () {
  'use strict';
  const C = window.TowerCore;
  const E = window.TowerEncounters, V = window.TowerCharacters;
  const N = window.TowerNarrative, D = window.TowerDungeons, S = window.TowerSideStories;
  const SAVE = 'maze3d_tower_v1';
  let run = null, active = false, paused = false, pauseAt = 0, modalFocus = null;
  let world = null, loot = [], monsters = [], traders = [], nearest = null;
  let warriorNpc = null, nearestWarrior = null, escort = null;
  let explorer = null, chest = null, relic = null, nearbyEncounter = null, lastSurveyCell = '', gearVisual = null, gearSignature = '', exitDeclined = false;
  let shiftLeft = 65, wasShifting = false, floorConfig = null, saveClock = 0, hudClock = 0;
  let attackLeft = 0, hurtLeft = 0, warning = false, floorStarted = false, saveFailed = false;
  let encounterHold = 0;
  let mainClue = null, rift = null, dungeonObjects = [], nearbyJourney = null, exploredCells = new Set(), reader = null, sideReader = null;
  let pendingDungeonShift = null;
  const color = { heal: 0xff719a, ration: 0xe7b86c, shield: 0x5edfff, hourglass: 0xcda5ff, bell: 0xffd677, map: 0x85e9ac, feather: 0xeaf6ff, coin: 0xffd76a };
  // 十區使用獨立色盤與建築輪廓；只有當層載入，不預載九十九個場景。
  const ENVIRONMENTS = [
    [0x658598,0x9aafbd,0xa3a9ae,0x9beded,'spire'],
    [0x7ca3a1,0xaab993,0x9dab7f,0x75c996,'garden'],
    [0x477b6b,0x87ae8b,0x8f9f80,0x558561,'tree'],
    [0x62678d,0xa9a0ca,0x989cba,0x9eebff,'crystal'],
    [0x8a7973,0xc1a580,0xb19b83,0xd8bd87,'books'],
    [0x70969e,0x91b8b5,0x92b9bb,0x79d3d1,'water'],
    [0x9bbfc9,0xc4e2e5,0xbfd6dd,0xe0fbff,'ice'],
    [0x8a8175,0xbca486,0xa69c87,0xdbaa65,'gear'],
    [0x906968,0xc19a83,0xb19b8c,0xffa35f,'fire'],
    [0x637c9b,0xadb6d7,0xb3bbc7,0xffe1a0,'heart'],
  ];
  function inDungeon() { return !!run?.expedition?.active; }
  function dungeonOffer() { return D && inDungeon() ? D.offer(run) : null; }
  function sideStory(kind) { return S?.get(kind)||null; }
  function explorerIdentity() { return explorer?.offer?.explorer || E.explorerIdentity?.(run.floor,run.seed) || {id:'eve',name:'伊芙',title:'探索者',greeting:''}; }
  function explorerName() { const person=explorerIdentity();return person.title+'・'+person.name; }
  function environmentSpec() {
    if(inDungeon())return sideStory(run.expedition.active.kind)?.palette||{archive:[0x718291,0xaea38f,0x9b9387,0xf1d29e,'books'],bells:[0x617b94,0x92aaba,0x8c99a8,0x91e5e7,'crystal'],lantern:[0x77748b,0xb8a58e,0x9a9295,0xffc878,'fire']}[run.expedition.active.kind];
    return ENVIRONMENTS[Math.max(0, Math.min(9, floorConfig.chapter - 1))];
  }
  function atmosphereStyle() {
    const [,wall,ground,accent,style]=environmentSpec();
    return {style,palette:{wall,ground,accent},seed:floorSeed()};
  }
  const text = escapeHtml;
  const el = id => document.getElementById(id);

  function install() {
    const hud = document.createElement('section');
    hud.id = 'towerHud'; hud.setAttribute('aria-label', '高塔生存狀態');
    hud.innerHTML = '<span class="tower-stat"><small>倒轉高塔</small><b id="towerFloor">99 F</b></span><span class="tower-stat"><small>生命</small><b id="towerHealth">100 / 100</b><progress id="towerHp" class="tower-health" max="100" value="100" aria-label="生命值"></progress></span><span class="tower-stat"><small>銅幣</small><b id="towerCoins">0</b></span><span class="tower-stat"><small>章節</small><b id="towerChapter"></b></span><div id="towerGuardStatus" class="tower-guard-status" hidden></div>';
    el('gameScreen').appendChild(hud);
    const gearStatus=document.createElement('div');gearStatus.id='towerGearStatus';gearStatus.className='tower-gear-status';hud.appendChild(gearStatus);
    const rail = document.createElement('nav'); rail.id = 'towerActionRail'; rail.setAttribute('aria-label', '劇情操作');
    rail.innerHTML = '<button class="tower-btn" id="towerBagBtn">背包 <small>B</small></button><button class="tower-btn" id="towerTalkBtn" disabled>附近無人 <small>R</small></button><button class="tower-btn" id="towerAttackBtn">揮擊 <small>X</small></button>';
    el('gameScreen').appendChild(rail);
    const objective = document.createElement('div'); objective.id = 'towerObjective'; el('gameScreen').appendChild(objective);
    const overlay = document.createElement('div'); overlay.id = 'towerOverlay'; overlay.hidden = true;
    overlay.innerHTML = '<section id="towerDialog" class="tower-card" role="dialog" aria-modal="true" aria-labelledby="towerDialogTitle" tabindex="-1"></section>';
    document.body.appendChild(overlay);
    el('storyEntryBtn').onclick = open;
    bindActionBtn(el('towerBagBtn'), inventory);
    bindActionBtn(el('towerTalkBtn'), trade);
    bindActionBtn(el('towerAttackBtn'), attack);
    overlay.addEventListener('click', event => {
      const button = event.target.closest('button[data-tower]');
      if (button && !button.disabled) handleAction(button.dataset.tower, button.dataset.item);
    });
    window.addEventListener('keydown', event => {
      if (!active && overlay.hidden) return;
      if (!overlay.hidden) {
        if (event.code === 'Escape' && active && run.status === 'playing' && floorStarted) closeDialog();
        if (event.code === 'Tab') {
          const buttons = [...el('towerDialog').querySelectorAll('button:not(:disabled),[href],input')];
          if (!buttons.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === el('towerDialog'))) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
      }
      if (typingInField() || event.repeat) return;
      if (event.code === 'KeyB') inventory();
      if (event.code === 'KeyR') trade();
      if (event.code === 'KeyX') attack();
      if (event.code === 'KeyJ') journal();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && active && !paused && !G.shifting && run.status === 'playing') pauseMenu();
      if (active) save();
    });
    window.addEventListener('pagehide', () => { if (active) save(); });
  }
  function action(label, key, item, disabled) {
    return '<button class="tower-btn" data-tower="' + key + '"' + (item ? ' data-item="' + text(item) + '"' : '') + (disabled ? ' disabled' : '') + '>' + text(label) + '</button>';
  }
  function dialog(kicker, title, copy, body, actions) {
    if (active && !paused) {
      paused = true; pauseAt = performance.now(); G.frozen = true;
      if(window.TowerAudio)window.TowerAudio.setPaused(true);
      Object.keys(keys).forEach(k => delete keys[k]); joy.active = false; joy.dx = joy.dy = 0;
      el('joyBase').style.display = el('joyStick').style.display = 'none';
    }
    if (el('towerOverlay').hidden) modalFocus = document.activeElement;
    el('towerOverlay').hidden = false;
    const closeButton=!pendingDungeonShift&&(!active||(run.status==='playing'&&G.running&&floorStarted))?'<button class="tower-close" data-tower="close" aria-label="關閉對話並返回">返回</button>':'';
    el('towerDialog').innerHTML = closeButton+'<div class="tower-kicker">' + text(kicker) + '</div><h2 class="tower-heading" id="towerDialogTitle">' + text(title) + '</h2><p class="tower-copy">' + text(copy) + '</p>' + (body || '') + '<div class="tower-actions">' + actions + '</div>';
    el('towerDialog').focus();
    el('towerDialog').scrollTop=0;
  }
  function closeDialog() {
    if(pendingDungeonShift)return;
    el('towerOverlay').hidden = true;
    if (active && paused) {
      const duration = performance.now() - pauseAt;
      G.startTime += duration;
      for (const key of ['shovelRechargeAt', 'skillCoolUntil', 'invisUntil', 'ghostUntil', 'mapUntil', 'compassUntil', 'visionUntil', 'owlUntil', 'stunnedUntil']) if (G[key] > pauseAt) G[key] += duration;
      Object.values(G.effects).forEach(effect => { if (effect.until > pauseAt) effect.until += duration; });
      paused = false; G.frozen = G.shifting;
      if(window.TowerAudio)window.TowerAudio.setPaused(false);
    }
    if (modalFocus && modalFocus.isConnected) modalFocus.focus();
  }
  function readSave() {
    try { return C.validateSave(JSON.parse(localStorage.getItem(SAVE) || 'null')); }
    catch (_) { return null; }
  }
  function syncEngine() {
    if (!run || !floorStarted) return;
    const now = paused ? pauseAt : performance.now();
    run.hunger = G.satiety;
    run.engine = { shovels: G.shovels, kites: G.kites, whistles: G.whistles, shovelCooldownMs: Math.max(0, G.shovelRechargeAt - now), skillCooldownMs: Math.max(0, G.skillCoolUntil - now) };
  }
  function save() {
    if (!run) return false;
    syncEngine();
    try { localStorage.setItem(SAVE, JSON.stringify(run)); return true; }
    catch (_) { if (!saveFailed) { saveFailed = true; showToast('瀏覽器無法保存進度，請保持此分頁開啟。', 4000); } return false; }
  }
  function canCollectOriginal(id) { return !active || !run.claimed.includes(id); }
  function itemConfig() { return inDungeon()?{itemCount:0,foodCount:0,storyCount:0,total:0}:E.floorLootCounts(floorConfig.size); }
  function preserveFloorPickups() { return active && floorStarted; }
  function reservedCells() {
    return floorStarted?[...traders,...loot,...dungeonObjects,...[warriorNpc,explorer,chest,relic,mainClue,rift].filter(Boolean)].map(item=>item.cx+','+item.cy):[];
  }
  function collectedOriginal(id) {
    if (!active || !run || inDungeon() || run.claimed.includes(id)) return;
    run.claimed.push(id); questEvent('collect',{id}); save();
  }
  function open() {
    const saved = readSave();
    dialog('全新單人長篇冒險', '倒轉高塔・第 99 層', '你在陌生的召喚陣中醒來。塔頂只有一扇向下的門。每下一層，空間更大，牆壁的心跳也更快。與同樣受困的冒險者交易，帶著補給活著走到第一層。', '<div class="tower-story-cover" role="img" aria-label="被召喚到雲上高塔的冒險者"></div><p class="tower-copy">單人故事 · 沿用原本職業與操作 · 每層自動保存（繼續時回到該層入口）</p>',
      (saved && saved.status !== 'won' ? action('繼續：第 ' + saved.floor + ' 層', 'continue') : saved&&N?action('回顧已完成故事','story-archive'):'') + action(saved ? '重新開始故事' : '建立主角', 'new') + action('回首頁', 'close'));
  }
  function beginNew() {
    run = C.newRun({ name: getPlayerName(), charIdx: G.charIdx, seed: (Math.random() * 0x7fffffff) | 0 });
    enter();
  }
  function enter() {
    closeDialog();
    if (MP.on) mpLeave();
    active = true; floorStarted = false; document.body.classList.add('story-active');
    G.charIdx = run.charIdx; G.view = 'tp'; G.spMode = 'classic';
    el('playerName').value = run.name;
    loadFloor(true);
  }
  function loadFloor(intro) {
    pendingDungeonShift=null;closeDialog(); floorStarted = false; reader=null;sideReader=null;
    floorConfig = C.floorConfig(run.floor);
    const instance=dungeonOffer();
    if(instance)floorConfig={...floorConfig,size:instance.size,name:instance.title,shiftSeconds:instance.shiftSeconds,monsterCount:0,narrative:'',environmentId:sideStory(instance.kind)?.environmentId||{archive:'library',bells:'echo',lantern:'furnace'}[instance.kind]};
    const settings = { mazeSize: CFG.mazeSize, itemCount: CFG.itemCount, foodCount: CFG.foodCount };
    const counts = itemConfig(); CFG.mazeSize = floorConfig.size; CFG.itemCount = counts.itemCount; CFG.foodCount = counts.foodCount;
    G.lvlIdx = floorConfig.themeIndex;
    try { startGame(); } finally { Object.assign(CFG, settings); }
    G.hungerLethal = false; G.drainPerSec = 0.12; G.satiety = run.hunger;
    if (run.engine) {
      G.shovels = run.engine.shovels; G.kites = run.engine.kites; G.whistles = run.engine.whistles;
      G.shovelRechargeAt = run.engine.shovelCooldownMs ? performance.now() + run.engine.shovelCooldownMs : 0;
      G.skillCoolUntil = run.engine.skillCooldownMs ? performance.now() + run.engine.skillCooldownMs : 0;
    }
    if (run.charIdx === 4 && !G.shovels && !G.shovelRechargeAt) G.shovelRechargeAt = performance.now() + shovelCdMs();
    updateShovelBtn(); updateKiteBtn(); updateWhistleBtn();
    el('hudLvlName').textContent = floorConfig.name; el('hudRound').textContent = instance?'副本':'劇情';
    buildTowerEnvironment(); buildWorld(); gearVisual=null;gearSignature='';refreshGear();encounterHold = 0; soundChanged();
    floorStarted = true; saveClock = 0; attackLeft = 0; hurtLeft = 3; wasShifting = false;
    save(); updateHud();
    if(instance){dungeonBriefing();return;}
    if(N){
      const chapter=N.chapterForFloor(run.floor),scene=run.floor===chapter.high&&N.scenesForFloor(run.floor).find(entry=>!run.chronicle.read.includes(entry.id));
      if(scene){readStory(scene.id,true);return;}
      if(intro)dialog('倒轉高塔 · 主線續章',floorConfig.name,N.objective(run),'<p class="tower-copy">每章中段尋找主線印記，章末出口需要印記。背包的故事日誌可重讀已抵達的章節。</p>'+floorFacts(),action('踏入迷宮','close')+action('故事日誌','journal'));
      return;
    }
    const narration = run.floor === 99 ? C.OPENING.text : floorConfig.narrative;
    if (intro || narration) dialog('第 ' + run.floor + ' 層 · ' + floorConfig.name, run.floor === 99 ? '我怎麼會在這裡？' : '向下的門，再次開啟', Array.isArray(narration) ? narration.join('\n\n') : (narration || '迷宮深處傳來金屬摩擦聲。找到下一扇門，繼續尋找召喚你的原因。'),
      '<p class="tower-copy">本層 ' + floorConfig.size + ' × ' + floorConfig.size + '｜物資 '+counts.total+' 件，不隨變形重生｜每 ' + floorConfig.shiftSeconds + ' 秒變形｜' + (floorConfig.monsterCount ? '武器只能擊暈，善用護衛合作' : '安全探索，先儲備補給') + '</p><p class="tower-copy">左側移動 · 右側看四周 · 背包／裝備 B · 互動 R · 擊暈 X · 空白鍵鐵鍬</p>', action('踏入迷宮', 'close'));
  }
  function floorFacts() {
    const counts=itemConfig();
    return '<p class="tower-copy">本層 '+floorConfig.size+' × '+floorConfig.size+' · 物資 '+counts.total+' 件 · 每 '+floorConfig.shiftSeconds+' 秒變形</p><p class="tower-copy">左側移動 · 右側看四周 · 背包 B · 互動 R · 故事日誌 J</p>';
  }
  function prose(paragraphs) { return '<div class="tower-prose">'+paragraphs.map(p=>'<p>'+text(p)+'</p>').join('')+'</div>'; }
  function echoCards(entries) { return entries.map(e=>'<aside class="tower-story-echo"><small>旅途回聲 · '+text(e.title)+'</small><p>'+text(e.text)+'</p></aside>').join(''); }
  function endingProse(ending) { return prose(ending.paragraphs)+echoCards(S?S.endingEchoes(run,ending.id):[]); }
  function readStory(id,enter=false,page=0,exit=false) {
    if(!N||!run)return;
    const entry=N.availableScenes(run).find(s=>s.id===id);if(!entry)return;
    page=Math.max(0,Math.min(entry.paragraphs.length-1,page));reader={id,page,enter,exit};
    dialog('倒轉高塔 · 第 '+entry.floor+' 層 · '+(page+1)+' / '+entry.paragraphs.length,entry.title,'',prose([entry.paragraphs[page]])+(page===entry.paragraphs.length-1?echoCards(S?S.echoesForScene(run,id):[]):''),
      (page?action('上一頁','story-prev'):'')+(page<entry.paragraphs.length-1?action('下一頁','story-next'):action(exit?'收進日誌，走向門後':enter?'收進日誌，繼續探索':'收進日誌','story-finish'))+action(exit?'暫留本層':'稍後在日誌閱讀','close'));
  }
  function journal() {
    if(!N||!run||G.shifting)return;
    const unlocked=N.availableScenes(run),chapter=N.chapterForFloor(run.floor);
    const entries=unlocked.slice().reverse().map(s=>'<article class="tower-journal-entry"><div><small>第 '+s.floor+' 層 · '+(run.chronicle.read.includes(s.id)?'已讀':'未讀')+'</small><h3>'+text(s.title)+'</h3></div>'+action('閱讀','story-read',s.id)+'</article>').join('');
    const clues=N.CHAPTERS.filter(c=>run.chronicle.clues.includes(c.clueId));
    const history=(run.expedition?.history||[]).slice(-5).reverse().map(h=>'第 '+h.floor+' 層 · '+(sideStory(h.kind)?.title||{archive:'無聲信庫',bells:'逆時鐘室',lantern:'餘燼渡廊'}[h.kind])+' · '+({completed:'已完成',abandoned:'已退出',expired:'時間耗盡'}[h.outcome])).join('／');
    const collected=S?S.collectedStories(run):[],sideEntries='<h3 class="tower-section-title">旅途逸聞 '+collected.length+' / 6</h3><p class="tower-copy">完成劇情裂隙可留下永久手記；部分人物會在後續主線回應。不收集也能完成主線。</p>'+collected.map(s=>'<article class="tower-journal-entry"><div><small>'+text(s.title)+'</small><h3>'+text(s.record.title)+'</h3></div>'+action('重讀逸聞','side-story-read',s.kind)+'</article>').join('');
    dialog('旅人的手記 · '+run.chronicle.read.length+' / 30 幕',chapter.title,N.objective(run),'<section class="tower-guard-summary"><h3>歸途印記 '+clues.length+' / 10</h3><p>'+text(clues.map(c=>c.clueName).join('、')||'第一枚線索仍在塔中等待。')+'</p></section>'+sideEntries+entries+(history?'<p class="tower-copy">裂隙紀錄：'+text(history)+'</p>':''),action(active?'回到迷宮':'回首頁','close')+(run.chronicle.ending?action('閱讀我的結局','ending-read'):'')+(active?(inDungeon()?action('副本目標','dungeon-brief'):action('探索者委託','quest')):''));
  }
  function readSideStory(kind,page=0,source='record') {
    const story=sideStory(kind);if(!story||!['intro','record','outro'].includes(source))return;
    if(source==='intro'){if(!inDungeon()||run.expedition.active.kind!==kind)return;}
    else if(!S.collectedStories(run).some(s=>s.kind===kind))return;
    const paragraphs=source==='record'?story.record.paragraphs:story[source];
    page=Math.max(0,Math.min(paragraphs.length-1,page));sideReader={kind,page,source};
    const back=source==='intro'?action('回副本目標','dungeon-brief'):source==='outro'?action('繼續旅程','close'):action('回故事日誌','journal');
    dialog('旅途逸聞 · '+(page+1)+' / '+paragraphs.length,source==='record'?story.record.title:story.title,'',prose([paragraphs[page]]),(page?action('上一頁','side-prev'):'')+(page<paragraphs.length-1?action('下一頁','side-next'):'')+back);
  }
  function journeyMarker(label,tint,shape='clue') {
    const model=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:tint,emissive:tint,emissiveIntensity:.22});
    const mesh=new THREE.Mesh(shape==='rift'?new THREE.TorusGeometry(.82,.12,6,22):new THREE.OctahedronGeometry(.44),material);mesh.position.y=1.15;model.add(mesh);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.55,.68,.18,8),new THREE.MeshLambertMaterial({color:0x415564}));base.position.y=.1;model.add(base);
    model.add(makePickupMarker(tint,label));model.userData.role=shape;model.userData.icon=mesh;return model;
  }
  function buildJourneyWorld(random,used) {
    if(N){const chapter=N.chapterForFloor(run.floor);if(run.floor<=chapter.mid&&!run.chronicle.clues.includes(chapter.clueId)){const point=chooseCell(random,used),model=journeyMarker('主線・'+chapter.clueName,0xffdf83);model.position.set(point.x,0,point.z);world.add(model);mainClue={...point,model};}}
    const offer=D&&D.offer(run);
    if(offer){const point=chooseCell(random,used),model=journeyMarker('裂隙・'+offer.title,0x7fe2db,'rift');model.position.set(point.x,0,point.z);model.visible=run.expedition.discovered;world.add(model);rift={...point,model,offer};}
  }
  function nearEntity(item,distance=2.6) { return !!(item&&item.model.visible&&Math.hypot(G.px-item.model.position.x,G.pz-item.model.position.z)<distance&&hasClearPath(G.px,G.pz,item.model.position.x,item.model.position.z)); }
  function updateJourneyNearby() {
    nearbyJourney=[mainClue,rift,...dungeonObjects].filter(item=>nearEntity(item)).sort((a,b)=>Math.hypot(G.px-a.x,G.pz-a.z)-Math.hypot(G.px-b.x,G.pz-b.z))[0]||null;
    if(nearbyJourney&&[nearest,nearestWarrior,nearbyEncounter].some(item=>item&&Math.hypot(G.px-item.model.position.x,G.pz-item.model.position.z)<Math.hypot(G.px-nearbyJourney.x,G.pz-nearbyJourney.z)))nearbyJourney=null;
  }
  function mainClueDialog() {
    if(!N||inDungeon()||!nearEntity(mainClue))return;
    const chapter=N.chapterForFloor(run.floor);
    if(!transact(N.collectClue(run)))return;
    mainClue.model.visible=false;nearbyJourney=null;
    const scene=N.scenesForFloor(chapter.mid).find(entry=>!run.chronicle.read.includes(entry.id));
    if(scene){readStory(scene.id,true);return;}
    dialog('主線更新 · 歸途印記',chapter.clueName,N.objective(run),prose(chapter.clueText),action('繼續前進','close')+action('故事日誌','journal'));
  }
  function dungeonOrder(offer) { return offer.order.map(i=>sideStory(offer.kind)?.steps[i].title||['晨光','正午','星夜'][i]).join(' → '); }
  function dungeonHint(offer) {
    if(offer.kind==='bells')return '符印順序：'+dungeonOrder(offer)+'。敲錯會觸發陷阱並重設順序。';
    if(offer.kind==='threads')return '紅線順序：'+dungeonOrder(offer)+'。接錯會觸動陷阱，需重新連接。';
    if(offer.kind==='stars'){const state=run.expedition?.active;return '星路順序：'+dungeonOrder(offer)+'。啟動第一座儀器後，須等迷宮實際完成一次變形。'+(state?.kind==='stars'&&state.progress.includes(0)?state.shiftCount>state.shiftAtStart?'已觀測到變形，可繼續校準。':'仍在等待變形。':'');}
    if(offer.kind==='clockwork'||offer.kind==='tribunal')return '先完成地圖上的 1、2 號線索，再到 3 號台完成修復或作答。';
    if(offer.kind==='supper')return '餐點由副本提供，不扣背包物品。聽完三位旅人的需要後選餐；配錯會觸動餐桌機關。';
    if(offer.kind==='mirrors')return '閱讀每面鏡子的問句，再選出答案；答錯觸發陷阱，但已答對的鏡子不會重設。';
    return '找齊三個標記後抵達出口。';
  }
  function dungeonBriefing() {
    const offer=dungeonOffer();if(!offer)return;
    dialog('裂隙副本 · '+run.floor+' 層之外',offer.title,offer.description,'<section class="tower-guard-summary"><h3>'+text(offer.objective)+'</h3><p>'+text(dungeonHint(offer))+'</p></section><p class="tower-copy">剩餘 '+Math.ceil(Math.max(0,offer.timeLimit-run.expedition.active.elapsed))+' 秒；暫停與變形時不計時。沒有普通物資，也不推進原層委託。裝備和補給照常消耗，護衛留在原層等候。中途退出不領獎。</p>',action('開始探索','close')+(sideStory(offer.kind)?action('閱讀副本故事','side-story-intro',offer.kind):'')+action('退出副本','dungeon-leave'));
  }
  function riftDialog() {
    if(inDungeon()||!nearEntity(rift))return;
    const offer=rift.offer;
    dialog('隨機奇遇 · 裂隙副本',offer.title,offer.description,'<section class="tower-guard-summary"><h3>'+text(offer.objective)+'</h3><p>獨立 '+offer.size+' × '+offer.size+' 小迷宮 · '+offer.timeLimit+' 秒 · 每 '+offer.shiftSeconds+' 秒變形</p></section><p class="tower-copy">完成可獲銅幣與補給或強化裝備。'+(sideStory(offer.kind)?'另收錄永久旅途逸聞，部分會在主線與結局得到回應；不影響主線通關資格。':'')+'任務與護衛留在原層；結束回到入口所在格。原層迷宮重新排列，但已拾取物不重生。每層裂隙只能挑戰一次。</p>',action('暫不進入','close')+action('進入副本','dungeon-enter',offer.id));
  }
  function enterDungeon(id) {
    if(!D||inDungeon()||G.shifting||!nearEntity(rift))return;
    syncEngine();const cell=worldToCell(G.px,G.pz),result=D.enter(run,id,{x:cell.x,y:cell.y,shiftLeft:Math.max(0,shiftLeft)},run.revision);
    if(!transact(result))return;loadFloor(false);
  }
  function buildDungeonWorld(random,used) {
    const offer=dungeonOffer();
    for(let index=0;index<3;index++){
      const point=chooseCell(random,used),label=sideStory(offer.kind)?.steps[index].title||(offer.kind==='archive'?'失落信件 '+(index+1):offer.kind==='bells'?['晨光符印','正午符印','星夜符印'][index]:'渡廊燈 '+(index+1));
      const model=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0xd1b075,emissive:0x846633,emissiveIntensity:.15});
      const geometries={threads:()=>new THREE.TorusGeometry(.4,.09,6,16),mirrors:()=>new THREE.CylinderGeometry(.42,.42,.06,12),clockwork:()=>new THREE.TorusGeometry(.38,.1,6,12),tribunal:()=>index===2?new THREE.CylinderGeometry(.24,.3,.4,8):new THREE.BoxGeometry(.6,.08,.8),stars:()=>new THREE.CylinderGeometry(.18,.24,.85,8),supper:()=>new THREE.SphereGeometry(.3,8,6,0,Math.PI*2,0,Math.PI/2)};
      const icon=new THREE.Mesh(geometries[offer.kind]?geometries[offer.kind]():offer.kind==='archive'?new THREE.BoxGeometry(.72,.12,.48):offer.kind==='bells'?new THREE.CylinderGeometry(.35,.52,.65,8):new THREE.OctahedronGeometry(.38),mat);icon.position.y=1;model.add(icon);
      const pedestal=new THREE.Mesh(new THREE.BoxGeometry(.65,.65,.65),new THREE.MeshLambertMaterial({color:0x556475}));pedestal.position.y=.32;model.add(pedestal);model.add(makePickupMarker(0xa6dfd9,label));
      if(offer.kind==='threads'){const spool=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.6,8),new THREE.MeshLambertMaterial({color:0x72513b}));spool.position.y=.95;model.add(spool);icon.material.color.setHex(0xe98d94);}
      if(offer.kind==='mirrors'){icon.rotation.x=Math.PI/2;icon.scale.set(1,1,1.5);const rim=new THREE.Mesh(new THREE.TorusGeometry(.49,.05,5,16),new THREE.MeshLambertMaterial({color:0x89bcbf}));rim.position.y=1;rim.scale.y=1.5;model.add(rim);}
      if(offer.kind==='clockwork'){for(let tooth=0;tooth<6;tooth++){const part=new THREE.Mesh(new THREE.BoxGeometry(.18,.24,.15),new THREE.MeshLambertMaterial({color:0xbe9863}));const a=tooth*Math.PI/3;part.position.set(Math.cos(a)*.41,1+Math.sin(a)*.41,0);part.rotation.z=a;model.add(part);}}
      if(offer.kind==='tribunal'){const ribbon=new THREE.Mesh(new THREE.BoxGeometry(.13,.03,.85),new THREE.MeshLambertMaterial({color:0xb87781}));ribbon.position.y=1.08;model.add(ribbon);}
      if(offer.kind==='stars'){icon.rotation.z=.65;const star=new THREE.Mesh(new THREE.OctahedronGeometry(.16),new THREE.MeshBasicMaterial({color:0xd0e5fc}));star.position.set(.3,1.8,0);model.add(star);}
      if(offer.kind==='supper'){
        icon.rotation.x=Math.PI;icon.position.y=1.03;
        const traveller=new THREE.Group();traveller.position.set(.75,0,0);model.add(traveller);
        const box=(w,h,d,c,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:c}));m.position.set(x,y,z);traveller.add(m);};
        box(.45,.6,.32,[0x876b9b,0x578784,0xbc8d58][index],0,.8,0);box(.4,.4,.35,0xe2bc91,0,1.32,0);box(.44,.12,.39,[0x5e4434,0xcac9bd,0x453d48][index],0,1.56,0);box(.16,.42,.18,0x354356,-.12,.28,0);box(.16,.42,.18,0x354356,.12,.28,0);box(.055,.07,.04,0x242c35,-.09,1.34,.19);box(.055,.07,.04,0x242c35,.09,1.34,.19);
      }
      model.position.set(point.x,0,point.z);model.userData.role='dungeon-object';model.userData.index=index;model.userData.kind=offer.kind;world.add(model);dungeonObjects.push({...point,index,label,model,icon,rotate:['archive','bells','lantern','threads','clockwork'].includes(offer.kind)});
    }
    refreshDungeonObjects();
  }
  function refreshDungeonObjects() {
    if(!inDungeon())return;
    for(const item of dungeonObjects){const done=run.expedition.active.progress.includes(item.index);item.icon.material.color.setHex(done?0x79dfac:0xe1bd83);item.icon.material.emissiveIntensity=done?.55:.15;}
  }
  function dungeonObjectDialog(index) {
    const item=dungeonObjects.find(o=>o.index===index);if(!inDungeon()||!nearEntity(item))return;
    const offer=dungeonOffer(),done=run.expedition.active.progress.includes(index);
    const story=sideStory(offer.kind),step=story?.steps[index];
    if(step){
      const choices=!done&&step.options?'<div class="tower-riddle-options">'+step.options.map((label,choice)=>action(label,'dungeon-choice',index+':'+choice)).join('')+'</div>':'';
      dialog(story.title,item.label,done?'這段記憶已經接起，可以繼續探索。':dungeonHint(offer),prose([done?step.success:step.prompt])+choices,action('返回迷宮','close')+(!done&&!step.options?action(step.actionLabel,'dungeon-interact',String(index)):''));return;
    }
    const fragments={archive:['「給仍在門邊等我的你：我已平安抵達。奇怪的是，塔裡的鐘聲一直沒有停。」信末的日期，被另一層墨水蓋住了。','「如果路又變了，請記住我們畫在門框的記號。不是每一封沒有回覆的信，都代表收信人忘記了你。」紙角繫著一小段紅線。','最後一封沒有地址，只寫著：「回家的時候，把這封信帶給還以為自己被遺忘的人。」你發現信紙的水印，和召喚台的紋路相同。'],lantern:['燈座上刻著：「第一盞留給先到的人。願你知道，這條路曾經有人走過。」','第二座燈裡剩著半截燈芯。旁邊的筆跡說：「我先走一段，替你看清下一個轉角。」','最後一座燈背後寫著：「如果你已經找到出口，請把光留給後來的人。」你聽見牆後傳來一聲很輕的道謝。']};
    dialog(offer.title,item.label,done?'這處記號已經完成。':offer.kind==='bells'?'牆面的詩句提示了先後順序：'+dungeonOrder(offer):'讓這段被遺忘的記憶重新亮起。',fragments[offer.kind]?prose([fragments[offer.kind][index]]):'',action('返回迷宮','close')+(!done?action(offer.kind==='archive'?'收回信件':offer.kind==='bells'?'敲響符印':'點亮燈火','dungeon-interact',String(index)):''));
  }
  function interactDungeon(index,choice) {
    const item=dungeonObjects.find(o=>o.index===index);if(!inDungeon()||!nearEntity(item))return;
    syncEngine();const result=D.interact(run,index,run.revision,choice===undefined?undefined:{choice});if(!transact(result))return;
    refreshDungeonObjects();closeDialog();
    if(run.status==='dead'){defeat();return;}
    showToast(result.message||'記憶已經亮起。',3000);
    if(run.expedition.active.progress.length===3)showToast('副本目標完成！趕在時間內找到出口領取報酬。',3500);
  }
  function tickDungeon(dt,now) {
    const result=D.tick(run,dt);if(!result.ok)return;run=result.run;
    if(result.effect?.expired){finishDungeon('expired');return;}
    nearbyEncounter=nearest=nearestWarrior=null;updateJourneyNearby();
    for(const item of dungeonObjects)if(item.rotate)item.icon.rotation.y+=dt*.35;
    if(run.effects.reveal>0)G.mapUntil=now+250;
    hudClock+=dt;if(hudClock>.15){hudClock=0;updateHud();}
    saveClock+=dt;if(saveClock>3){saveClock=0;save();}
  }
  function leaveDungeonDialog() {
    if(!inDungeon())return;
    dialog('退出副本確認','放下這段未完成的記憶？','退出後回到原層，不會領取獎勵，也不能在同一層重開這個副本。','',action('繼續挑戰','close')+action('確認退出副本','dungeon-abandon'));
  }
  function finishDungeon(outcome) {
    if(!inDungeon())return;
    syncEngine();const offer=dungeonOffer(),title=offer.title,story=sideStory(offer.kind),result=D.finish(run,outcome,run.revision);
    if(!result.ok){dialog('副本尚未結算','請先整理背包',result.message,'',action('整理背包','bag')+action('放棄報酬並退出','dungeon-leave'));return;}
    if(!transact(result)){dialog('副本尚未保存','請重試保存結算','這次結算尚未生效，報酬不會重複領取。副本倒數已暫停，請保持分頁開啟。','',action('重試保存','dungeon-settle',outcome));return;}
    floorStarted=false;loadFloor(false);
    const cell=result.effect.returnCell,p=cellToWorld(cell.x,cell.y);G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);shiftLeft=result.effect.returnShift;exitDeclined=true;restoreWarriorPosition();
    if(explorer&&run.adventure.quest?.type==='escort')explorer.model.position.set(p.x,0,p.z);
    save();updateHud();
    dialog('回到第 '+run.floor+' 層',outcome==='completed'?title+' · 記憶歸還':outcome==='expired'?'裂隙的時間已盡':'你離開了裂隙',outcome==='completed'?'副本報酬：'+rewardDescription(result.effect.reward):'這次沒有帶出報酬。你的旅程仍能繼續，消耗的裝備與補給不會重置。',(outcome==='completed'&&story?'<aside class="tower-story-echo"><small>永久逸聞已收錄 · '+text(story.record.title)+'</small><p>'+text(story.outro[0])+'</p></aside>':'')+'<p class="tower-copy">原層任務與主線保留；已拾取物、商店庫存與已擊敗怪物不重生。</p>',action('繼續旅程','close')+(outcome==='completed'&&story?action('閱讀副本後記','side-story-outro',story.kind):'')+action('整理裝備','bag'));
  }
  function mapMarkers() {
    if(!active)return [];
    return [mainClue,rift,...dungeonObjects].filter(o=>o&&o.model.visible).map(o=>({cx:o.cx,cy:o.cy,label:o===mainClue?'印':o===rift?'裂':String(o.index+1),color:o===mainClue?'#ffe295':o===rift?'#8ee5df':run.expedition.active.progress.includes(o.index)?'#83e7ae':'#edc789'}));
  }
  function buildTowerEnvironment() {
    if (envGroup) { disposeSceneObject(envGroup); scene.remove(envGroup); }
    envGroup = new THREE.Group(); envGroup.userData.anim = []; scene.add(envGroup);
    const [sky,wall,ground,accent,feature] = environmentSpec(); scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 28, Math.max(75, floorConfig.size * 5));
    envGroup.add(new THREE.HemisphereLight(0xd6edff, 0x5f5366, 0.85));
    envGroup.add(new THREE.AmbientLight(0xffffff, 0.42));
    const sun = new THREE.DirectionalLight(0xffe4b3, 0.8); sun.position.set(-15, 28, 14); envGroup.add(sun);
    wallMesh.material.color.setHex(wall);
    floorMesh.material.color.setHex(ground);
    const span = G.mazeW * G.cell;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(span * 0.75, span * 0.77, 3, 12), new THREE.MeshLambertMaterial({color: 0x31495d}));
    rim.position.y = -1.65; envGroup.add(rim);
    // 建築輪廓只在迷宮外，柱頂標示高塔朝下延伸；不增加即時陰影。
    const sceneryMaterial = new THREE.MeshLambertMaterial({color:accent});
    const stoneMaterial = new THREE.MeshLambertMaterial({color:wall});
    const detail = (geometry, material, x, y, z) => { const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);envGroup.add(mesh);return mesh; };
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), stoneMaterial);
      pillar.position.set(Math.cos(a)*span*.72, 1, Math.sin(a)*span*.72); envGroup.add(pillar);
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(.38), new THREE.MeshBasicMaterial({color: accent}));
      rune.position.copy(pillar.position); rune.position.y = 4.3; envGroup.add(rune);
      const x=pillar.position.x,z=pillar.position.z;
      if(feature==='tree'||feature==='garden') {
        detail(new THREE.ConeGeometry(feature==='tree'?2.8:2,6,6),sceneryMaterial,x,5,z);
      } else if(feature==='crystal'||feature==='ice') {
        const crystal=detail(new THREE.OctahedronGeometry(1.8),sceneryMaterial,x,5,z);crystal.scale.y=feature==='ice'?2.5:1.6;
      } else if(feature==='books') {
        detail(new THREE.BoxGeometry(4,4.5,1),stoneMaterial,x,3,z);
        for(let row=0;row<3;row++)detail(new THREE.BoxGeometry(3.5,.7,1.2),sceneryMaterial,x,1.6+row*1.25,z);
      } else if(feature==='gear'||feature==='heart') {
        const wheel=detail(new THREE.TorusGeometry(1.8,feature==='heart'?.12:.35,6,16),sceneryMaterial,x,5,z);wheel.rotation.y=-a;
        if(feature==='gear')for(let tooth=0;tooth<4;tooth++){const spoke=detail(new THREE.BoxGeometry(.25,4.6,.25),sceneryMaterial,x,5,z);spoke.rotation.z=tooth*Math.PI/4;}
      } else if(feature==='fire') {
        detail(new THREE.ConeGeometry(1.7,5,5),sceneryMaterial,x,5.6,z);
      } else if(feature==='water') {
        detail(new THREE.BoxGeometry(.35,7,2),sceneryMaterial,x,2,z);
      } else detail(new THREE.ConeGeometry(1.3,4,4),sceneryMaterial,x,6,z);
    }
  }
  function cellPoint(x, y) { return { cx: x, cy: y, ...cellToWorld(x, y) }; }
  function chooseCell(random, used, minimum = 2) {
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(random() * G.mazeW), y = Math.floor(random() * G.mazeH), key = x + ',' + y;
      if (x + y < minimum || used.has(key) || (x === G.exitCell.x && y === G.exitCell.y)) continue;
      used.add(key); return cellPoint(x, y);
    }
    for (let y = 0; y < G.mazeH; y++) for (let x = 0; x < G.mazeW; x++) if (!used.has(x + ',' + y) && x + y >= minimum) { used.add(x + ',' + y); return cellPoint(x, y); }
    return cellPoint(0, 0);
  }
  function buildWorld() {
    loot = []; monsters = []; traders = []; nearest = null; warriorNpc = nearestWarrior = escort = null;
    explorer=chest=relic=nearbyEncounter=null;lastSurveyCell='';exitDeclined=false;
    world = new THREE.Group(); scene.add(world);
    mainClue=rift=nearbyJourney=null;dungeonObjects=[];exploredCells=new Set();
    const random = mulberry32(floorSeed() ^ 0x712da), used = new Set(['0,0', G.exitCell.x + ',' + G.exitCell.y]);
    if(inDungeon()){buildDungeonWorld(random,used);return;}
    const originalPickups = [...(G.items||[]), ...(G.foods||[])];
    for(const item of originalPickups){const c=worldToCell(item.x,item.z);used.add(c.x+','+c.y);}
    for (const offer of E.merchantOffers(run.floor,run.seed)) {
      const point = chooseCell(random, used);
      const model = V.buildMerchant(offer.id,{THREE,CHARS,buildCharacter});model.position.set(point.x,0,point.z);
      const name = offer.title+'・'+offer.name,tag=makeTextSprite(name);tag.position.y=2.6;tag.scale.set(2.7,.5,1);model.add(tag);
      world.add(model);traders.push({...point,model,name,id:offer.id,offer});
    }
    const kinds = ['coin','heal','ration','shield','coin','hourglass','bell','map','ration','coin','feather'];
    for (let i = 0; i < itemConfig().storyCount; i++) {
      const point = chooseCell(random, used), kind = kinds[i % kinds.length], id = 's' + i;
      const model = new THREE.Group(); model.position.set(point.x,0,point.z);
      const icon = new THREE.Mesh(kind === 'coin' ? new THREE.CylinderGeometry(.34,.34,.14,10) : kind === 'ration' ? new THREE.BoxGeometry(.5,.4,.5) : new THREE.OctahedronGeometry(.42), new THREE.MeshLambertMaterial({color:color[kind],emissive:color[kind],emissiveIntensity:.16}));
      icon.position.y = 1; model.add(icon); model.add(makePickupMarker(color[kind], C.ITEMS[kind].name));
      model.visible = !run.claimed.includes(id); world.add(model); loot.push({ ...point, kind, id, model, icon });
    }
    for (let i = 0; i < floorConfig.monsterCount; i++) {
      const kind = floorConfig.monsterTypes[i % floorConfig.monsterTypes.length], def = C.MONSTERS[kind];
      const strength = C.monsterStrength(kind, run.floor), id = 'monster-' + i;
      const point = chooseCell(random, used, Math.min(7, floorConfig.size - 1)), model = monsterModel(kind, strength);
      const alive = !run.defeatedMonsters.includes(id);
      model.position.set(point.x, 0, point.z); model.visible = alive; model.userData.monsterId=id; world.add(model);
      monsters.push({ ...point, id, strength, kind, def, model, alive, path: [], pathLeft: i * .15, windup: 0, cooldown: 2, phase: i });
    }
    buildWarriors(used);
    const chestOffer=E.chestOffer(run.floor,run.seed);
    if(chestOffer){const point=chooseCell(random,used),model=V.buildChest({THREE});model.position.set(point.x,0,point.z);model.visible=!run.adventure.claimed.includes(chestOffer.id);world.add(model);chest={...point,offer:chestOffer,model};}
    const explorerOffer=E.explorerOffer(run);
    if(explorerOffer){const identity=explorerOffer.explorer||{id:'eve',name:'伊芙',title:'探索者'},point=chooseCell(random,used),model=V.buildExplorer(identity.id,{THREE,CHARS,buildCharacter});model.position.set(point.x,0,point.z);if(run.adventure.quest?.type==='escort'&&run.adventure.quest.status==='active')model.position.set(G.px,0,G.pz);const tag=makeTextSprite(identity.title+'・'+identity.name);tag.position.y=2.6;model.add(tag);world.add(model);explorer={...point,offer:explorerOffer,model,path:[],pathLeft:0};}
    // 尋物目標獨立於消耗物資，種子固定，讀檔或變形不會重抽。
    const point=chooseCell(random,used),model=new THREE.Group();model.position.set(point.x,0,point.z);
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.36),new THREE.MeshLambertMaterial({color:0xe3ccff}));gem.position.y=.8;model.add(gem);model.add(makePickupMarker(0xc49dff,'任務遺物'));
    model.visible=!!(run.adventure.quest&&run.adventure.quest.type==='relic'&&run.adventure.quest.status==='active');world.add(model);relic={...point,model};
    buildJourneyWorld(random,used);
  }
  function monsterModel(kind, strength) {
    const group = new THREE.Group(), type = ['clockmite','wisp','sentinel','hound'].indexOf(kind);
    const tint = C.MONSTERS[kind].color;
    const mat = new THREE.MeshLambertMaterial({color:tint});
    const body = new THREE.Mesh(type === 0 ? new THREE.SphereGeometry(.65,10,7) : type === 1 ? new THREE.OctahedronGeometry(.68) : new THREE.BoxGeometry(1.1,1.25,.85), mat);
    body.position.y = type === 0 ? .6 : 1; group.add(body);
    if (type === 1) for (const side of [-1,1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(.55,.9,3),mat); wing.rotation.z=side*1.3;wing.position.set(side*.7,1,0);group.add(wing); }
    if (type === 3) { body.scale.set(.8,.55,1.5); for (const x of [-.35,.35]) for (const z of [-.4,.4]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.2),mat);leg.position.set(x,.35,z);group.add(leg); } }
    for (const side of [-1,1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(.14,.16,.1),new THREE.MeshBasicMaterial({color:0xfff4c0}));eye.position.set(side*.22,1,.49);group.add(eye); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.83,.05,5,20),new THREE.MeshBasicMaterial({color:0xff6767,transparent:true,opacity:.42})); ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);group.userData.ring=ring;
    const tag = strengthTag(C.MONSTERS[kind].name, strength);tag.position.y=2.35;group.add(tag);group.userData.body=body;group.userData.tag=tag;
    return group;
  }
  function strengthTag(label, strength) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
    const ctx = canvas.getContext('2d'); ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#14202d'; ctx.lineWidth = 8; ctx.fillStyle = '#fff1c9';
    const caption = label + ' · ' + strength + '/5'; ctx.strokeText(caption,256,40,490); ctx.fillText(caption,256,40,490);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));
    tag.scale.set(3.4,.53,1); return tag;
  }
  function buildWarriorModel(strength, label) {
    const model = buildCharacter({...CHARS[0],shirt:0x658394,pants:0x303e50,hair:0x36313a});
    const steel = new THREE.MeshLambertMaterial({color:0xc3d7e2}), gold = new THREE.MeshLambertMaterial({color:0xe1b968});
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(.4,.26,.13,5),gold);
    shield.rotation.x = Math.PI/2; shield.position.set(-.52,1,.18); model.add(shield);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.1,1,.08),steel); blade.position.set(.52,1.3,.24); model.add(blade);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(.59,.17,.56),steel); helmet.position.y=1.86;model.add(helmet);
    const tag = strengthTag(label,strength);tag.position.y=2.65;model.add(tag);
    model.userData.guardTag=tag;model.userData.guardBlade=blade;return model;
  }
  function buildWarriors(used) {
    const offer = C.warriorOffer(run.floor,run.seed);
    if (offer && !run.hiredWarriors.includes(offer.id)) {
      const random = mulberry32(floorSeed() ^ 0x651cea);
      const point = chooseCell(random,used);
      const model=buildWarriorModel(offer.strength,'可聘戰士');model.position.set(point.x,0,point.z);world.add(model);
      warriorNpc={...point,offer,model};
    }
    if (run.warrior) {
      const model=buildWarriorModel(run.warrior.strength,'護衛戰士');world.add(model);
      escort={model,path:[],pathLeft:0};restoreWarriorPosition();
    }
  }
  function isHeld(monster) { return !!(run.warrior && run.warrior.mode==='holding' && run.warrior.targetId===monster.id); }
  function restoreWarriorPosition() {
    if(!escort||!run.warrior)return;
    const target=monsters.find(m=>m.alive&&isHeld(m));
    const x=target?target.model.position.x:G.px,z=target?target.model.position.z:G.pz;
    escort.model.position.set(x,0,z);escort.path=[];escort.pathLeft=0;
  }
  function refreshWarriorLabel() {
    if(!escort||!run.warrior)return;
    const model=escort.model,old=model.userData.guardTag;
    model.remove(old);disposeSceneObject(old);
    const tag=strengthTag(run.warrior.mode==='holding'?'牽制中':'護衛戰士',run.warrior.strength);
    tag.position.y=2.65;model.add(tag);model.userData.guardTag=tag;
  }
  function dismissEscort() {
    if(!escort)return;
    world.remove(escort.model);disposeSceneObject(escort.model);escort=null;
  }
  function updateWarrior(dt,now) {
    if(!escort||!run.warrior)return;
    const guard=run.warrior,p=escort.model.position;
    if(guard.mode==='holding') {
      const target=monsters.find(m=>m.alive&&isHeld(m));
      if(target){const q=target.model.position;const offset=playerInWall(q.x+.65,q.z,.28)?-.45:.65;p.set(q.x+offset,0,q.z);escort.model.rotation.y=-Math.PI/2;escort.model.userData.guardBlade.rotation.x=Math.sin(now*.008)*.35;}
      return;
    }
    const safe=nearest||run.effects.repel>0||now<G.invisUntil;
    const target=!safe&&monsters.filter(m=>m.alive&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<3&&Math.hypot(p.x-m.model.position.x,p.z-m.model.position.z)<4.5&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)&&hasClearPath(p.x,p.z,m.model.position.x,m.model.position.z)).sort((a,b)=>Math.hypot(p.x-a.model.position.x,p.z-a.model.position.z)-Math.hypot(p.x-b.model.position.x,p.z-b.model.position.z))[0];
    if(target) {
      const result=C.interceptMonster(run,target.id,C.effectiveMonsterStrength(run,target.id,target.strength),run.revision);
      if(result.ok) {
        run=result.run;target.windup=0;target.path=[];target.cooldown=2;
        if(result.effect.outcome==='defeat')defeatMonster(target,true);
        else showToast('戰士已攔住 '+target.def.name+'：'+(result.effect.seconds===null?'持續牽制，你可繼續前進':Math.ceil(result.effect.seconds/60)+' 分鐘，趁現在前進！'),3500);
        refreshWarriorLabel();save();updateHud();return;
      }
    }
    // 至多一名護衛，每半秒尋路；與玩家共用牆壁碰撞，不新增物理引擎。
    escort.pathLeft-=dt;
    if(Math.hypot(G.px-p.x,G.pz-p.z)<1.2)return;
    if(escort.pathLeft<=0){const a=worldToCell(p.x,p.z),b=worldToCell(G.px,G.pz);escort.path=solveMaze(a.x,a.y,b.x,b.y).slice(1);escort.pathLeft=.5;}
    const waypoint=escort.path.length?cellToWorld(...escort.path[0]):{x:G.px,z:G.pz};
    const dx=waypoint.x-p.x,dz=waypoint.z-p.z,len=Math.hypot(dx,dz),step=Math.min(len,5.8*dt);
    if(len>.001){const x=p.x+dx/len*step,z=p.z+dz/len*step;if(!playerInWall(x,z,.28)){p.x=x;p.z=z;}else escort.pathLeft=0;escort.model.rotation.y=Math.atan2(dx,dz);}
    if(len<.15)escort.path.shift();
    escort.model.userData.legL.rotation.x=Math.sin(now*.009)*.35;escort.model.userData.legR.rotation.x=-Math.sin(now*.009)*.35;
  }
  function floorSeed() { return (run.seed ^ Math.imul(run.floor, 7919) ^ (inDungeon()?0x7316dea:0)) | 0; }
  function soundChanged() {
    if(!active||!window.TowerAudio)return;
    AudioEng.stopMusic(); AudioEng.resume();
    window.TowerAudio.configure({context:AudioEng.ctx,output:AudioEng.musicGain});
    window.TowerAudio.setMuted(G.muted);
    window.TowerAudio.setEnvironment(floorConfig.environmentId);
    window.TowerAudio.setEncounter(encounterHold>0);
    window.TowerAudio.setPaused(paused);
  }
  function scheduleShift() { shiftLeft = dungeonOffer()?.shiftSeconds || C.floorConfig(run.floor).shiftSeconds; warning = false; G.preWarned = false; }
  function updateShift() {
    if (!active) return;
    el('shiftCountdown').textContent = Math.ceil(Math.max(0, shiftLeft)) + '秒';
    if (paused || !G.running || G.shifting) return;
    if (shiftLeft <= 3.5) {
      el('preWarn').style.display = 'block'; el('preWarnSec').textContent = Math.ceil(Math.max(0,shiftLeft));
      if (!warning) { warning = true; AudioEng.sfxTick(); }
    }
    if (shiftLeft <= 0) { el('preWarn').style.display = 'none'; wasShifting = true; doShift(); }
  }
  function updateHud() {
    if (!active) return;
    el('towerFloor').textContent = run.floor + ' F'; el('towerHealth').textContent = Math.ceil(run.hp) + ' / 100';
    el('towerHp').value = run.hp; el('towerCoins').textContent = run.coins;
    el('towerChapter').textContent = floorConfig.name;
    el('towerTalkBtn').disabled = !nearest && !nearestWarrior && !nearbyEncounter; el('towerTalkBtn').textContent = nearbyEncounter ? (nearbyEncounter===chest?'開箱 R':'對話 R') : nearestWarrior ? '聘請 R' : nearest ? '交易 R' : '附近無人';
    el('towerGuardStatus').hidden = !run.warrior;
    el('towerGuardStatus').textContent = warriorStatus();
    el('towerGearStatus').textContent=Object.entries(run.equipment).map(([slot,gear])=>({helmet:'盔',armor:'甲',shield:'盾',weapon:'武'}[slot])+' '+(gear?gear.durability:'—')).join(' · ');
    el('towerAttackBtn').disabled = attackLeft > 0 || !run.equipment.weapon; el('towerAttackBtn').textContent = !run.equipment.weapon?'需裝備武器':attackLeft > 0 ? '擊暈 ' + attackLeft.toFixed(1) : '擊暈 X';
    const effects = Object.entries(run.effects).filter(([,v])=>v>0).map(([k,v])=>({shield:'護盾',freeze:'定牆',repel:'驅怪',reveal:'回聲地圖'}[k])+' '+Math.ceil(v)+'秒');
    el('towerObjective').textContent = nearestWarrior ? '戰士 '+nearestWarrior.offer.strength+'/5 · '+costText(nearestWarrior.offer.cost)+' · 點「聘請」查看契約' : effects.length ? effects.join(' · ') : nearest ? nearest.name + '：靠近後可購買／出售補給' : '找到金色傳送門，前往' + (run.floor > 1 ? '第 ' + (run.floor - 1) + ' 層' : '塔外');
    const q=run.adventure.quest;
    if(nearbyEncounter)el('towerObjective').textContent=nearbyEncounter===chest?'封印寶箱 · 可能藏著強化裝備，也可能是陷阱':explorerName()+' · 對話查看委託';
    else if(q&&q.status!=='claimed'&&!nearest&&!nearestWarrior)el('towerObjective').textContent=(E.explorerOffer(run)?.title||'探索者委託')+' · '+q.progress+'/'+q.goal+(q.status==='ready'?' · 報酬待領':'');
    else if(N&&!nearest&&!nearestWarrior)el('towerObjective').textContent=N.objective(run);
    if(inDungeon()){const offer=dungeonOffer(),state=run.expedition.active;el('towerFloor').textContent='裂隙 · '+run.floor+' F';el('towerObjective').textContent=offer.title+' · '+state.progress.length+'/3 · 剩 '+Math.ceil(Math.max(0,offer.timeLimit-state.elapsed))+' 秒'+(['bells','threads'].includes(offer.kind)?' · '+offer.order.map(i=>i+1).join('→'):offer.kind==='stars'&&state.progress.length===1?(state.shiftCount>state.shiftAtStart?' · 星路已更新':' · 等待牆壁變形'):'');el('towerAttackBtn').disabled=true;el('towerAttackBtn').textContent='探索試煉';}
    if(nearbyJourney){el('towerTalkBtn').disabled=false;el('towerTalkBtn').textContent=nearbyJourney===rift?'裂隙 R':nearbyJourney===mainClue?'印記 R':'調查 R';el('towerObjective').textContent=nearbyJourney===rift?'裂隙副本 · 自願進入，結束回到原層':nearbyJourney===mainClue?'主線印記 · '+N.chapterForFloor(run.floor).clueName:el('towerObjective').textContent;}
    document.body.classList.toggle('tower-danger',run.hp<=25);
  }
  function saveDungeonShift() {
    if(!inDungeon()||run.expedition.active.kind!=='stars'||!D.observeShift)return;
    const retrying=!!pendingDungeonShift,result=D.observeShift(run);
    if(!result.ok)return;
    if(!transact(result)){
      pendingDungeonShift=run.expedition.active.id;
      dialog('觀測紀錄尚未保存','這次星路仍在等待保存','你已親歷一次迷宮變形；目前瀏覽器無法保存。副本倒數已暫停，請保持分頁開啟，恢復儲存空間後再重試，不必重新等待移牆。','',action('重試保存星路','dungeon-shift-retry'));
      return;
    }
    pendingDungeonShift=null;refreshDungeonObjects();
    if(retrying)closeDialog();
    if(result.message)showToast(result.message,3500);
  }
  function tick(dt, now) {
    if (!active || !floorStarted) return;
    if (wasShifting && !G.shifting) {
      wasShifting = false;
      wallMesh.material.color.setHex(environmentSpec()[1]);
      monsters.forEach(m=>{ const c=worldToCell(m.model.position.x,m.model.position.z),p=cellToWorld(c.x,c.y);m.model.position.set(p.x,0,p.z);m.path=[];m.pathLeft=0;m.windup=0;m.cooldown=2; });
      restoreWarriorPosition();
      if(explorer&&run.adventure.quest?.type==='escort'){explorer.model.position.set(G.px,0,G.pz);explorer.path=[];explorer.pathLeft=0;}
      if(!inDungeon())questEvent('shift',{id:'shift-'+Math.floor(run.floorElapsed*1000)});
      else if(run.expedition.active.kind==='stars')saveDungeonShift();
      if (run.effects.reveal>0) { const p=worldToCell(G.px,G.pz); G.solutionPath=solveMaze(p.x,p.y); }
    }
    if (paused || !G.running || G.frozen || G.shifting || run.status !== 'playing') return;
    run.hunger = G.satiety;
    const ticked = C.tickEffects(run, dt); run = ticked.run || ticked;
    if(ticked.effect && ticked.effect.warriorReleased){dismissEscort();showToast('護衛已盡力撤退，怪物將恢復追擊！',3500);save();}
    if (run.effects.freeze<=0) shiftLeft -= dt;
    attackLeft=Math.max(0,attackLeft-dt);hurtLeft=Math.max(0,hurtLeft-dt);
    if(gearVisual?.userData.weapon){
      if(window.CharacterMotion)window.CharacterMotion.worldWeaponPose(gearVisual.userData.weapon,playerGroup,1-attackLeft/.8);
      else gearVisual.userData.weapon.rotation.x=.25+Math.sin((.8-attackLeft)/.8*Math.PI)*1.35;
    }
    if (G.satiety<=0 && hurtLeft<=0) damage(3,'hunger');
    if(run.status!=='playing')return;
    const portal=cellToWorld(G.exitCell.x,G.exitCell.y);if(Math.hypot(G.px-portal.x,G.pz-portal.z)>2.2)exitDeclined=false;
    if(inDungeon()){tickDungeon(dt,now);return;}
    const pc=worldToCell(G.px,G.pz),cellKey=pc.x+','+pc.y;
    if(cellKey!==lastSurveyCell){lastSurveyCell=cellKey;questEvent('survey',pc);exploredCells.add(cellKey);}
    if(rift&&!rift.model.visible&&exploredCells.size>=3){const result=D.discover(run);if(result.ok){run=result.run;rift.model.visible=true;save();showToast('牆縫裡出現了異色裂隙，小地圖「裂」標記可找到入口。',4000);}}
    updateExplorer(dt,now);
    if(relic&&relic.model.visible&&Math.hypot(G.px-relic.x,G.pz-relic.z)<1.1&&hasClearPath(G.px,G.pz,relic.x,relic.z)){questEvent('relic',{id:run.adventure.quest.target});relic.model.visible=false;save();}
    for (const item of loot) {
      if (!item.model.visible) continue;
      item.icon.position.y=1+Math.sin(now*.003+item.cx)*.12;item.icon.rotation.y+=dt;
      if (Math.hypot(G.px-item.x,G.pz-item.z)<1.05) {
        const result=C.collect(run,item.kind,item.kind==='coin'?8:1);
        if(result.ok){run=result.run;run.claimed.push(item.id);item.model.visible=false;AudioEng.sfxPickup();showToast('取得 '+C.ITEMS[item.kind].name+(item.kind==='coin'?' +8':''));save();}
      }
    }
    nearest=traders.find(n=>Math.hypot(G.px-n.x,G.pz-n.z)<2.6&&hasClearPath(G.px,G.pz,n.x,n.z))||null;
    nearestWarrior=warriorNpc&&warriorNpc.model.visible&&Math.hypot(G.px-warriorNpc.x,G.pz-warriorNpc.z)<2.6&&hasClearPath(G.px,G.pz,warriorNpc.x,warriorNpc.z)?warriorNpc:null;
    if(nearestWarrior&&nearest&&Math.hypot(G.px-nearest.x,G.pz-nearest.z)<Math.hypot(G.px-nearestWarrior.x,G.pz-nearestWarrior.z))nearestWarrior=null;
    const closeEntities=[chest,explorer].filter(n=>n&&n.model.visible&&Math.hypot(G.px-n.model.position.x,G.pz-n.model.position.z)<2.6&&hasClearPath(G.px,G.pz,n.model.position.x,n.model.position.z));
    nearbyEncounter=closeEntities.sort((a,b)=>Math.hypot(G.px-a.model.position.x,G.pz-a.model.position.z)-Math.hypot(G.px-b.model.position.x,G.pz-b.model.position.z))[0]||null;
    if(nearbyEncounter){const d=Math.hypot(G.px-nearbyEncounter.model.position.x,G.pz-nearbyEncounter.model.position.z);if([nearest,nearestWarrior].some(n=>n&&Math.hypot(G.px-n.x,G.pz-n.z)<d))nearbyEncounter=null;}
    updateJourneyNearby();
    updateWarrior(dt,now);
    for(const monster of monsters) updateMonster(monster,dt,now);
    const threat=!nearest&&run.effects.repel<=0&&!(now<G.invisUntil)&&monsters.some(m=>m.alive&&!isHeld(m)&&!(run.monsterStuns[m.id]>0)&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<m.def.sight&&(m.path.length>0||m.windup>0));
    encounterHold=threat?4:Math.max(0,encounterHold-dt);
    if(window.TowerAudio)window.TowerAudio.setEncounter(encounterHold>0);
    if(run.effects.reveal>0){G.mapUntil=now+250; if(!G.solutionPath){const p=worldToCell(G.px,G.pz);G.solutionPath=solveMaze(p.x,p.y);}}
    hudClock+=dt;if(hudClock>.15){hudClock=0;updateHud();}
    saveClock+=dt;if(saveClock>8){saveClock=0;save();}
  }
  function hasClearPath(ax,az,bx,bz) {
    const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/.3);
    for(let i=1;i<=steps;i++)if(playerInWall(ax+(bx-ax)*i/steps,az+(bz-az)*i/steps,.1))return false;
    return true;
  }
  function updateMonster(m,dt,now) {
    if(!m.alive)return;
    const stunned=(run.monsterStuns[m.id]||0)>0;
    const questTarget=run.adventure?.quest?.status==='active'&&run.adventure.quest.target===m.id;
    if(m.stunLabel!==stunned||m.questLabel!==questTarget){const old=m.model.userData.tag;if(old){m.model.remove(old);disposeSceneObject(old);const tag=strengthTag((questTarget?'委託目標・':'')+m.def.name+(stunned?'（暈）':''),C.effectiveMonsterStrength(run,m.id,m.strength));tag.position.y=2.35;m.model.add(tag);m.model.userData.tag=tag;}
      if(m.stunLabel!==stunned&&!stunned&&isHeld(m)){const result=C.resolveHeldMonster(run,m.id,m.strength);if(result.ok&&result.effect.changed){run=result.run;save();updateHud();showToast('怪物恢復強度，護衛改為限時抵擋 '+result.effect.seconds+' 秒。');}}
      m.stunLabel=stunned;m.questLabel=questTarget;
    }
    if(stunned){m.windup=0;m.path=[];m.cooldown=2;m.model.userData.ring.material.opacity=.25+.12*Math.sin(now*.01);return;}
    if(isHeld(m)){m.windup=0;m.path=[];m.cooldown=2;m.model.userData.ring.material.opacity=.65;return;}
    const p=m.model.position, distance=Math.hypot(G.px-p.x,G.pz-p.z);
    const safe=traders.some(n=>Math.hypot(G.px-n.x,G.pz-n.z)<2.6&&hasClearPath(G.px,G.pz,n.x,n.z));
    const repelled=run.effects.repel>0||safe||now<G.invisUntil;
    m.cooldown=Math.max(0,m.cooldown-dt);m.pathLeft-=dt;
    m.model.userData.body.position.y=(m.kind==='clockmite' ? .6 : 1)+Math.sin(now*.004+m.phase)*.1;
    m.model.userData.ring.material.opacity=m.windup>0?.9:.35;
    if(m.windup>0){m.windup-=dt;if(m.windup<=0){if(!repelled&&distance<2.05&&hasClearPath(p.x,p.z,G.px,G.pz))damage(m.def.damage||12);m.cooldown=2.3;}return;}
    if(!repelled&&distance<1.85&&m.cooldown<=0&&hasClearPath(p.x,p.z,G.px,G.pz)){m.windup=.8;return;}
    if(distance>22)return;
    if(m.pathLeft<=0){
      m.pathLeft=.8+m.phase*.1;
      const from=worldToCell(p.x,p.z),pc=worldToCell(G.px,G.pz);
      let goal=pc;
      if(repelled)goal={x:G.mazeW-1-pc.x,y:G.mazeH-1-pc.y};
      else if(distance>m.def.sight){m.path=[];return;}
      m.path=solveMaze(from.x,from.y,goal.x,goal.y).slice(1);
    }
    if(!m.path.length)return;
    const waypoint=cellToWorld(m.path[0][0],m.path[0][1]),dx=waypoint.x-p.x,dz=waypoint.z-p.z,len=Math.hypot(dx,dz);
    const speed=Math.min(3.8,m.def.speed||2.1)*(m.kind==='wisp'?(Math.sin(now*.002)>0?1.25:.6):1);
    const step=Math.min(len,speed*dt);
    if(len>.001){const nx=p.x+dx/len*step,nz=p.z+dz/len*step;if(!playerInWall(nx,nz,.28)){p.x=nx;p.z=nz;}else{m.path=[];m.pathLeft=0;}m.model.rotation.y=Math.atan2(dx,dz);}
    if(len<.12)m.path.shift();
  }
  function damage(amount,source='monster') {
    if(hurtLeft>0||paused||run.status!=='playing')return;
    const result=C.takeDamage(run,amount,source);if(!result.ok)return;run=result.run;hurtLeft=1.5;refreshGear();
    showToast(result.effect&&result.effect.revived?'復甦羽亮起，你重新站了起來。':'受到 '+result.effect.damage+' 點傷害'+(result.effect.broken.length?' · 裝備已損壞':'，留意紅圈預警'));
    if(run.hp<=0||run.status==='dead')defeat();else save();updateHud();
  }
  function attack() {
    if(!active||paused||G.frozen||!G.running||inDungeon()||attackLeft>0)return;
    if(!run.equipment.weapon){showToast('請先在背包裝備球棒、平底鍋或木杖。');return;}
    attackLeft=.8;
    if(window.CharacterMotion)window.CharacterMotion.beginAction(playerGroup,'attack',.8);
    const target=monsters.filter(m=>m.alive&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<2.8&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)).sort((a,b)=>Math.hypot(G.px-a.model.position.x,G.pz-a.model.position.z)-Math.hypot(G.px-b.model.position.x,G.pz-b.model.position.z))[0];
    if(!target){showToast('揮擊落空：靠近怪物後再攻擊');return;}
    const result=C.hitMonster(run,target.id,target.strength);if(!result.ok){showToast(result.message);return;}
    run=result.run;target.cooldown=2;target.windup=0;AudioEng.sfxPickup();questEvent('stun',{monsterId:target.id});
    const rescue=C.resolveHeldMonster(run,target.id,target.strength);
    if(rescue.ok&&rescue.effect.outcome==='defeat'){run=rescue.run;defeatMonster(target,true);refreshWarriorLabel();}
    else showToast(target.def.name+' 擊暈 '+result.effect.stunSeconds+' 秒 · 強度 −1'+(result.effect.broken.length?' · 武器已損壞':''));
    refreshGear();save();updateHud();
  }
  function defeatMonster(target,byWarrior=false) {
    if(!target.alive)return;
    target.alive=false;target.model.visible=false;
    const id=target.id||'monster-'+target.phase;
    if(!run.defeatedMonsters.includes(id))run.defeatedMonsters.push(id);
    if(isHeld(target)){run.warrior=null;dismissEscort();}
    let reward=false;
    if(!run.claimed.includes(id)){const result=C.collect(run,'coin',12);if(result.ok){run=result.run;run.claimed.push(id);reward=true;}}
    questEvent('defeat',{monsterId:id});
    showToast((byWarrior?'護衛瞬間擊敗 ':'擊退 ')+target.def.name+(byWarrior?'，剩餘強度 '+run.warrior.strength+'/5':'')+(reward?' · +12 銅幣':''));save();
  }
  function costText(cost) { return Object.entries(cost).map(([id,count])=>C.ITEMS[id].name+' × '+count).join(' ＋ '); }
  function warriorStatus() {
    const guard=run&&run.warrior;
    return !guard?'目前沒有護衛':guard.mode==='escort'?'護衛 '+guard.strength+'/5 · 隨行保護':'護衛 '+guard.strength+'/5 · '+(guard.remaining===null?'持續牽制':Math.ceil(guard.remaining)+' 秒牽制');
  }
  function warriorRules() {
    return '<div class="tower-guard-rules"><p><b>戰士較強</b>立即擊敗怪物，扣除怪物分數後繼續護送。</p><p><b>雙方同分</b>持續牽制；你可擊暈怪物，使其降 1 分，讓護衛取勝。</p><p><b>怪物較強</b>每 1 分抵擋 1 分鐘，之後戰士撤退。</p></div><p class="tower-copy">一次聘請一人。隨行護衛可跨樓層；交戰中的護衛留在本層。武器只擊暈，不直接殺死怪物。</p>';
  }
  function warriorDialog() {
    if(!active||G.shifting||!nearestWarrior||run.status!=='playing')return;
    syncEngine();
    const offer=nearestWarrior.offer,affordable=Object.entries(offer.cost).every(([id,count])=>(id==='coin'?run.coins:run.bag[id]||0)>=count);
    const ranks='<div class="tower-ranks" aria-label="強度 '+offer.strength+' 分，最高 5 分">'+Array.from({length:5},(_,i)=>'<span class="'+(i<offer.strength?'filled':'')+'"></span>').join('')+'</div>';
    dialog('旅途奇遇 · 護衛契約',offer.name,'「付出約定的報酬，我就替你擋住危險。你只管往下走。」','<section class="tower-guard-offer"><div><h3>戰士強度 '+offer.strength+' / 5</h3>'+ranks+'</div><div><h3>聘請報酬</h3><p>'+text(costText(offer.cost))+'</p></div></section>'+warriorRules()+'<p class="tower-copy">'+(run.warrior?'已有一名護衛，待目前契約結束後才能再聘請。':affordable?'只有按下「同意並聘請」才會扣除報酬。':'補給不足，可先向行商購買或探索收集。')+'</p>',action('暫不聘請','close')+action('同意並聘請','hire',offer.id,!!run.warrior||!affordable));
  }
  function hireWarrior(id) {
    if(!active||!G.running||G.shifting||run.status!=='playing'||!warriorNpc||!warriorNpc.model.visible||warriorNpc.offer.id!==id||Math.hypot(G.px-warriorNpc.x,G.pz-warriorNpc.z)>=2.6||!hasClearPath(G.px,G.pz,warriorNpc.x,warriorNpc.z))return;
    syncEngine();
    if(!transact(C.hireWarrior(run,id,run.revision)))return;
    const model=warriorNpc.model;escort={model,path:[],pathLeft:0};warriorNpc=null;nearestWarrior=null;
    refreshWarriorLabel();closeDialog();updateHud();showToast('護衛開始同行：強度 '+run.warrior.strength+'/5。靠近危險時會自動攔截。',3500);
  }
  function transact(result) {
    if(!result.ok){showToast(result.message||'目前無法進行');return false;}
    const previous=run,previousHunger=G.satiety;
    run=result.run;G.satiety=run.hunger;
    if(!save()){run=previous;G.satiety=previousHunger;showToast('未能保存，這次操作尚未生效。請保持分頁開啟並重試。',4000);return false;}
    refreshGear();updateHud();return true;
  }
  function refreshGear() {
    if(!active||!run?.equipment||typeof playerGroup==='undefined'||!playerGroup||!V)return;
    const signature=Object.values(run.equipment).map(g=>g?g.id:'-').join('|');
    if(signature===gearSignature)return;
    if(gearVisual){const oldWeapon=gearVisual.userData.weapon;if(oldWeapon?.parent===scene){scene.remove(oldWeapon);disposeSceneObject(oldWeapon);}playerGroup.remove(gearVisual);disposeSceneObject(gearVisual);}
    gearVisual=new THREE.Group();gearSignature=signature;
    for(const gear of Object.values(run.equipment).filter(Boolean)){
      const model=V.buildGear(gear.kind,{THREE}),mount=V.GEAR_MOUNTS[gear.kind];
      model.position.set(...mount.position);if(mount.rotation)model.rotation.set(...mount.rotation);
      if(gear.slot==='weapon'&&window.CharacterMotion){scene.add(model);window.CharacterMotion.worldWeaponPose(model,playerGroup,1-attackLeft/.8);}
      else gearVisual.add(model);
      if(gear.slot==='weapon')gearVisual.userData.weapon=model;
    }
    playerGroup.add(gearVisual);
  }
  function gearDescription(gear) {
    return '耐久 '+gear.durability+'/'+gear.maxDurability+' · '+(gear.slot==='weapon'?'基礎擊暈 '+C.GEAR[gear.kind].stunSeconds+' 秒':'防禦 '+gear.defense)+(gear.bonus?' · 強化 +'+gear.bonus:'');
  }
  function gearCard(gear,equipped=false) {
    return '<article class="tower-item tower-gear-card'+(gear.bonus?' rare':'')+'"><h3>'+text(gear.name)+(equipped?' <small>穿戴中</small>':'')+'</h3><p>'+text(gearDescription(gear))+'</p><meter min="0" max="'+gear.maxDurability+'" value="'+gear.durability+'" aria-label="耐久度"></meter>'+(!equipped?action('裝備','equip',gear.id):'')+action('捨棄','discard-ask',gear.id)+'</article>';
  }
  function questEvent(event,data) {
    if(inDungeon())return false;
    const q=run?.adventure?.quest;
    if(!q||q.status!=='active'||q.type!==event)return false;
    const result=E.questProgress(run,event,data);if(!result.ok)return false;
    run=result.run;save();if(result.effect?.ready)showToast('委託完成！請找探索者領取報酬。',3000);return true;
  }
  function updateExplorer(dt,now) {
    if(!explorer||run.adventure.quest?.type!=='escort'||run.adventure.quest.status!=='active')return;
    const p=explorer.model.position;if(Math.hypot(G.px-p.x,G.pz-p.z)<1.6)return;
    explorer.pathLeft-=dt;
    if(explorer.pathLeft<=0){const a=worldToCell(p.x,p.z),b=worldToCell(G.px,G.pz);explorer.path=solveMaze(a.x,a.y,b.x,b.y).slice(1);explorer.pathLeft=.65;}
    const waypoint=explorer.path.length?cellToWorld(...explorer.path[0]):{x:G.px,z:G.pz};
    const dx=waypoint.x-p.x,dz=waypoint.z-p.z,length=Math.hypot(dx,dz),step=Math.min(length,5.5*dt);
    if(length>.001){const x=p.x+dx/length*step,z=p.z+dz/length*step;if(!playerInWall(x,z,.28)){p.x=x;p.z=z;}else explorer.pathLeft=0;explorer.model.rotation.y=Math.atan2(dx,dz);}
    if(length<.15)explorer.path.shift();
    explorer.model.userData.legL.rotation.x=Math.sin(now*.008)*.3;explorer.model.userData.legR.rotation.x=-Math.sin(now*.008)*.3;
  }
  function nearExplorer() { return explorer&&Math.hypot(G.px-explorer.model.position.x,G.pz-explorer.model.position.z)<2.8&&hasClearPath(G.px,G.pz,explorer.model.position.x,explorer.model.position.z); }
  function rewardDescription(reward) {
    return [reward.coins?reward.coins+' 銅幣':'',...Object.entries(reward.items||{}).map(([id,n])=>C.ITEMS[id].name+' × '+n),reward.gear?reward.gear.name+'（'+gearDescription(reward.gear)+'）':''].filter(Boolean).join(' ＋ ');
  }
  function questDialog() {
    if(!active||G.shifting||run.status!=='playing')return;
    const offer=E.explorerOffer(run),q=run.adventure.quest;
    if(!offer||(!q&&!nearExplorer())){dialog('探索者委託','目前沒有委託','每層有 20% 機會遇見五位探索者之一；他們的委託都隨機抽選。靠近本人可查看委託。','',action('回到迷宮','close'));return;}
    if(explorer)explorer.offer=offer;
    const target=monsters.find(m=>m.id===offer.target);
    const copy=offer.description+(target?' 目標：'+target.def.name+'（原始強度 '+target.strength+'/5）；接受後頭頂會標示「委託目標」。':'')+(q?' 進度 '+q.progress+' / '+q.goal:'');
    let actions=action('繼續探索','close');
    if(!q)actions+=action('接受委託','quest-accept',offer.id,!nearExplorer());
    else if(q.status==='ready')actions+=action('領取報酬','quest-reward',null,!nearExplorer());
    else if(q.status==='active'&&q.type==='donate')actions+=action('交付 '+q.goal+' 份'+C.ITEMS[q.target].name,'quest-donate',null,!nearExplorer()||run.bag[q.target]<q.goal);
    dialog(explorerName(),q?.status==='claimed'?'感謝你的幫助':offer.title,copy,(!q?'<p class="tower-copy">'+text(explorerIdentity().greeting||'')+'</p>':'')+'<section class="tower-guard-summary"><h3>完成報酬</h3><p>'+text(rewardDescription(offer.reward))+'</p></section><p class="tower-copy">離開本層、保存回首頁或重整挑戰會解除未結案委託；報酬必須向探索者領取。進出口前會再次確認。裝備放入行囊後請自行穿戴。</p>',actions);
  }
  function chestDialog() {
    if(!chest||!chest.model.visible)return;
    dialog('迷宮奇遇','開啟封印寶箱？','可能獲得強化裝備，也可能觸發陷阱。穿戴防具能減少陷阱傷害，但防具會消耗耐久。','<p class="tower-copy">每層有 20% 機會出現。內容已固定，開啟後不會因變形或讀檔重新出現。</p>',action('先不開啟','close')+action('打開寶箱','chest-open',chest.offer.id));
  }
  function openChest(id) {
    if(!chest||!chest.model.visible||Math.hypot(G.px-chest.x,G.pz-chest.z)>=2.6||!hasClearPath(G.px,G.pz,chest.x,chest.z))return;
    const result=E.openChest(run,id,run.revision);if(!transact(result))return;
    chest.model.visible=false;nearbyEncounter=null;
    if(run.status==='dead'){defeat();return;}
    const copy=result.effect.outcome==='gear'?result.effect.gear.name+' · '+gearDescription(result.effect.gear)+'，已放入裝備行囊。':'陷阱造成 '+result.effect.damage+' 點傷害。'+(result.effect.revived?'復甦羽保護了你。':'防具已按命中消耗耐久。');
    dialog('寶箱已開啟',result.effect.outcome==='gear'?'獲得強化裝備':'小心，是陷阱！',copy,'',action('查看裝備','bag')+action('繼續前進','close'));
  }
  function inventory() {
    if(!active||G.shifting||run.status!=='playing')return;
    syncEngine();
    const cards=Object.entries(C.ITEMS).filter(([id])=>id!=='coin').map(([id,item])=>'<article class="tower-item"><h3>'+text(item.name)+' <span>×'+(run.bag[id]||0)+'</span></h3><p>'+text(item.description||item.desc||'高塔冒險補給')+'</p>'+action(id==='feather'?'瀕死自動使用':'使用','use',id,!run.bag[id]||id==='feather')+'</article>').join('');
    const stats=C.equipmentStats(run),worn=Object.values(run.equipment).filter(Boolean).map(g=>gearCard(g,true)).join(''),stored=run.gearBag.map(g=>gearCard(g)).join('');
    dialog('旅人背包 · 暫停中','裝備與補給','生命 '+Math.ceil(run.hp)+' / 100 · 飽足 '+Math.ceil(run.hunger)+'% · 銅幣 '+run.coins,'<section class="tower-guard-summary"><h3>防禦 '+stats.defense+' · 強化 +'+stats.bonus+' · 擊暈 '+stats.stunSeconds+' 秒</h3><p>每次命中，三件已穿防具各減 1 耐久；武器命中減 1。每點已穿裝備強化增加 10 秒擊暈，耐久耗盡即損壞。</p></section><h3>穿戴中</h3><div class="tower-grid">'+(worn||'<p>尚未穿戴裝備。</p>')+'</div><h3 class="tower-section-title">裝備行囊 '+run.gearBag.length+'/24</h3><div class="tower-grid">'+(stored||'<p>商人與寶箱取得的裝備會放在這裡。</p>')+'</div><h3 class="tower-section-title">生存補給</h3><div class="tower-grid">'+cards+'</div><section class="tower-guard-summary"><h3>'+text(warriorStatus())+'</h3></section>'+warriorRules(),(N?action('故事日誌','journal'):'')+action('任務日誌','quest')+(inDungeon()?action('副本目標','dungeon-brief'):'')+action('回到迷宮','close')+action('保存並離開','quit'));
  }
  function trade() {
    if(!active||G.shifting||run.status!=='playing')return;
    if(nearbyJourney){if(nearbyJourney===mainClue)mainClueDialog();else if(nearbyJourney===rift)riftDialog();else dungeonObjectDialog(nearbyJourney.index);return;}
    if(nearbyEncounter){if(nearbyEncounter===chest)chestDialog();else questDialog();return;}
    if(nearestWarrior){warriorDialog();return;}
    if(!active||G.shifting||!nearest||run.status!=='playing')return;
    syncEngine();
    const cards=nearest.offer.supplies.map(id=>{const item=C.ITEMS[id];return '<article class="tower-item"><h3>'+text(item.name)+'</h3><p>'+text(item.description)+' · 持有 '+run.bag[id]+'</p>'+action('買 '+item.buyPrice+' 幣','buy',id)+action('賣出','sell',id,!run.bag[id])+'</article>';}).join('');
    const gear=nearest.offer.gear.map(({kind,gear,price})=>'<article class="tower-item tower-gear-card"><h3>'+text(gear.name)+'</h3><p>'+text(gearDescription(gear))+'</p>'+action(run.adventure.claimed.includes('stock:'+run.floor+':'+nearest.id+':'+kind)?'本層已售出':'購買 '+price+' 幣','buy-gear',kind,run.adventure.claimed.includes('stock:'+run.floor+':'+nearest.id+':'+kind)||run.coins<price)+'</article>').join('');
    dialog(nearest.name+' · 行商營地','專門裝備與補給','每位商人固定專賣一種防具與一種武器。剩餘銅幣 '+run.coins,'<div class="tower-grid">'+gear+cards+'</div><p class="tower-copy">買到的裝備放入行囊，請在背包選擇「裝備」；每件本層限一件，讀檔不會補貨。</p>',action('整理裝備','bag')+action('結束交易','close'));
  }
  function useItem(id) {
    syncEngine();const before={...run.effects};
    if(!transact(C.useItem(run,id)))return;
    const mul=CH().itemDurMul||1;for(const key of Object.keys(run.effects))if(run.effects[key]>before[key])run.effects[key]*=mul;
    if(id==='ration'&&CH().foodMul)G.satiety=run.hunger=Math.min(100,run.hunger+45*(CH().foodMul-1));
    if(id==='map'){const p=worldToCell(G.px,G.pz);G.solutionPath=solveMaze(p.x,p.y);G.mapUntil=performance.now()+run.effects.reveal*1000;}
    save();inventory();
  }
  function reachExit(confirmed=false) {
    if(!active||paused||!G.running||run.status!=='playing'||(exitDeclined&&!confirmed))return;
    if(inDungeon()){
      exitDeclined=true;
      if(run.expedition.active.progress.length===3){finishDungeon('completed');return;}
      dialog('副本出口','還有記憶沒有帶回','目前已完成 '+run.expedition.active.progress.length+' / 3；完成後再回來領取報酬。','',action('繼續尋找','close')+action('退出副本','dungeon-leave'));return;
    }
    if(N&&!N.canDescend(run)){
      exitDeclined=true;const chapter=N.chapterForFloor(run.floor);
      dialog('主線尚未完成','門上缺少一枚印記','找到「'+chapter.clueName+'」才能打開下一章的門。小地圖金色「印」標記指向線索，靠近後按「印記 R」。','',action('返回尋找','close')+action('故事日誌','journal'));return;
    }
    let q=run.adventure.quest;
    if(q&&q.status!=='claimed'&&!confirmed){
      const portal=cellToWorld(G.exitCell.x,G.exitCell.y);
      if(q.type==='escort'&&explorer)questEvent('escort',{atExit:hasClearPath(explorer.model.position.x,explorer.model.position.z,portal.x,portal.z),distance:Math.hypot(explorer.model.position.x-portal.x,explorer.model.position.z-portal.z)});
      q=run.adventure.quest;exitDeclined=true;
      dialog('出口確認',q.status==='ready'?'還有委託報酬尚未領取':'本層還有進行中的委託','下降後會解除本層委託，尚未領取的報酬也會失去。你可以先繼續探索。','<p class="tower-copy">'+text(E.explorerOffer(run)?.title||'探索者委託')+' · '+q.progress+'/'+q.goal+'</p>',action('留在本層','close')+(q.status==='ready'&&nearExplorer()?action('領取報酬並下降','exit-reward'):'')+action('放棄委託並下降','exit-confirm'));return;
    }
    if(N&&run.floor===N.chapterForFloor(run.floor).low){const scene=N.scenesForFloor(run.floor).find(entry=>!run.chronicle.read.includes(entry.id));if(scene){exitDeclined=true;readStory(scene.id,false,0,true);return;}}
    if(N&&run.floor===1&&!run.chronicle.ending){exitDeclined=true;dialog('主線終章 · 由你決定','把這座塔帶往哪裡？','三條路都不必犧牲任何人。這一次，高塔會等待你的回答。','<div class="tower-grid">'+N.ENDINGS.map(ending=>'<article class="tower-item"><h3>'+text(ending.title)+'</h3><p>'+text(ending.description)+'</p>'+action('選擇這條歸途','ending',ending.id)+'</article>').join('')+'</div>',action('再想一想','close'));return;}
    syncEngine();const result=C.descend(run);
    if(!transact(result))return;G.running=false;floorStarted=false;
    if(run.status==='won'){const ending=N&&N.ENDINGS.find(e=>e.id===run.chronicle.ending);dialog('塔外的第一道晨光',ending?ending.title:'你找到了回家的路',ending?'九十九層的旅程，終於有了你的答案。':C.ENDING.text,ending?endingProse(ending):'<p class="tower-copy">99 層旅程完成。你保住的不只是自己的生命，還有其他旅人的希望。</p>',action('回到首頁','home'));return;}
    dialog('本層探索完成','門後，是第 '+run.floor+' 層','下一層的迷宮更接近高塔心臟。補給與職業工具會隨你繼續旅程。','<p class="tower-copy">生命 '+Math.ceil(run.hp)+' · 銅幣 '+run.coins+' · 已自動保存</p>',action('繼續下降','descend')+action('保存並回首頁','home'));
  }
  function defeat() {
    if(!active)return;
    G.running=false;run.status='dead';run.hp=0;
    if(inDungeon()){const result=D.finish(run,'abandoned',run.revision);if(result.ok)run=result.run;}
    save();
    dialog('高塔仍在等待','這次旅程暫時停下','冒險者把你帶回本層入口。可以付出最多 12 枚銅幣重整行裝；已拾取的補給不會重複出現，未結案委託會解除。', '',action('重整後再挑戰','retry')+action('回首頁','home'));
  }
  function pauseMenu() { dialog('旅程已暫停','隨時可以繼續','切回遊戲後按繼續，牆壁倒數與怪物都會等待你。選擇保存回首頁會解除本層未結案委託。','',action('繼續探索','close')+action('保存並回首頁','home')); }
  function requestQuit() {
    if(G.shifting){showToast('請等牆壁移動完成再離開（約 2 秒）');return;}
    dialog('離開確認','保存這段旅程？','將保存職業、裝備、主線與背包。'+(inDungeon()?'副本進度與剩餘時間保留，下次從副本入口繼續。':'下次從目前樓層入口繼續。')+'本層探索者未結案委託會解除，未領取報酬會失去。','',action('繼續遊戲','close')+action('保存並回首頁','home'));
  }
  function cancelFloorQuest() {
    if(!run.adventure.quest||run.adventure.quest.status==='claimed')return;
    if(!run.adventure.claimed.includes('abandoned:'+run.floor))run.adventure.claimed.push('abandoned:'+run.floor);
    run.adventure.quest=null;
  }
  function stop() {
    const previous=C.validateAdventure(run.adventure,run.floor);cancelFloorQuest();
    if(!save()){run.adventure=previous;dialog('尚未保存','目前無法保存旅程','瀏覽器儲存空間可能不足。請先繼續遊戲並保持此分頁開啟，避免遺失目前樓層。','',action('回到旅程','close'));return;}
    cancelSceneTransition();G.running=false;G.frozen=true;
    if(window.TowerAudio)window.TowerAudio.stop();
    active=false;floorStarted=false;paused=false;
    document.body.classList.remove('story-active','tower-danger');el('towerOverlay').hidden=true;
    AudioEng.stopMusic();AudioEng.stopItemLoop();switchScreen('titleScreen');
  }
  function handleAction(key,id) {
    if(pendingDungeonShift){if(key==='dungeon-shift-retry')saveDungeonShift();return;}
    if(key==='close'){closeDialog();return;}
    if(key==='new'){if(readSave()){dialog('重新開始確認','展開另一段高塔旅程？','開始新故事後會取代目前的高塔存檔。','',action('保留目前進度','menu')+action('重新建立主角','new-confirm'));}else handleAction('new-confirm');return;}
    if(key==='menu'){open();return;}
    if(key==='new-confirm'){closeDialog();beginEntryFlow('story');el('profileTitle').textContent='建立高塔主角';el('profileNextBtn').textContent='進入第 99 層';return;}
    if(key==='continue'){run=readSave();if(run&&run.status==='playing')enter();else if(run&&run.status==='dead'){active=true;floorStarted=false;document.body.classList.add('story-active');defeat();}else open();return;}
    if(key==='descend'){loadFloor(false);return;}
    if(key==='home'){stop();return;}
    if(key==='quit'){requestQuit();return;}
    if(key==='retry'){run.status='playing';run.hp=100;run.hunger=Math.max(65,run.hunger);run.coins=Math.max(0,run.coins-12);cancelFloorQuest();enter();return;}
    if(key==='bag'){inventory();return;}
    if(key==='journal'){journal();return;}
    if(key==='story-archive'){const saved=readSave();if(N&&saved?.status==='won'){run=saved;journal();}return;}
    if(key==='ending-read'){const ending=N&&N.ENDINGS.find(e=>e.id===run?.chronicle.ending);if(ending)dialog('已完成的歸途',ending.title,'',endingProse(ending),action('回故事日誌','journal'));return;}
    if(key==='side-story-read'){readSideStory(id);return;}
    if(key==='side-story-intro'){readSideStory(id,0,'intro');return;}
    if(key==='side-story-outro'){readSideStory(id,0,'outro');return;}
    if(key==='side-next'&&sideReader){readSideStory(sideReader.kind,sideReader.page+1,sideReader.source);return;}
    if(key==='side-prev'&&sideReader){readSideStory(sideReader.kind,sideReader.page-1,sideReader.source);return;}
    if(key==='story-read'){readStory(id);return;}
    if(key==='story-next'&&reader){readStory(reader.id,reader.enter,reader.page+1,reader.exit);return;}
    if(key==='story-prev'&&reader){readStory(reader.id,reader.enter,reader.page-1,reader.exit);return;}
    if(key==='story-finish'&&reader){const entry=reader;if(run.chronicle.read.includes(entry.id)||transact(N.readScene(run,entry.id))){reader=null;if(entry.exit){closeDialog();reachExit(true);}else if(entry.enter)closeDialog();else journal();}return;}
    if(key==='ending'){if(N&&transact(N.chooseEnding(run,id))){closeDialog();reachExit(true);}return;}
    if(key==='dungeon-enter'){enterDungeon(id);return;}
    if(key==='dungeon-brief'){dungeonBriefing();return;}
    if(key==='dungeon-interact'){interactDungeon(Number(id));return;}
    if(key==='dungeon-choice'){if(typeof id==='string'&&/^[0-2]:[0-2]$/.test(id)){const parts=id.split(':').map(Number);interactDungeon(parts[0],parts[1]);}return;}
    if(key==='dungeon-leave'){leaveDungeonDialog();return;}
    if(key==='dungeon-abandon'){finishDungeon('abandoned');return;}
    if(key==='dungeon-settle'){finishDungeon(id);return;}
    if(key==='equip'){if(transact(C.equipGear(run,id,run.revision)))inventory();return;}
    if(key==='discard-ask'){const gear=[...run.gearBag,...Object.values(run.equipment)].find(g=>g&&g.id===id);if(gear)dialog('捨棄裝備確認','捨棄'+gear.name+'？','捨棄後不能取回，若這是最後一把武器，你會暫時無法擊暈怪物。','',action('保留裝備','bag')+action('確認捨棄','discard',id));return;}
    if(key==='discard'){if(transact(C.discardGear(run,id,run.revision)))inventory();return;}
    if(key==='quest'){questDialog();return;}
    if(key==='quest-accept'){if(nearExplorer()&&transact(E.acceptQuest(run,id,run.revision))){if(relic)relic.model.visible=run.adventure.quest.type==='relic';closeDialog();showToast('委託已接受，背包可查看進度。');}return;}
    if(key==='quest-donate'){if(nearExplorer()&&questEvent('donate',{}))questDialog();return;}
    if(key==='quest-reward'){if(nearExplorer()&&transact(E.claimQuestReward(run,run.revision)))questDialog();return;}
    if(key==='exit-reward'){if(!nearExplorer()||!transact(E.claimQuestReward(run,run.revision)))return;closeDialog();reachExit(true);return;}
    if(key==='exit-confirm'){closeDialog();reachExit(true);return;}
    if(key==='chest-open'){openChest(id);return;}
    if(key==='use'){useItem(id);return;}
    if(key==='hire'){hireWarrior(id);return;}
    if(key==='buy'||key==='sell'||key==='buy-gear'){
      if(!active||!G.running||!nearest||Math.hypot(G.px-nearest.x,G.pz-nearest.z)>=2.6||!hasClearPath(G.px,G.pz,nearest.x,nearest.z))return;
      const result=key==='buy-gear'?E.buyMerchantGear(run,nearest.id,id,run.revision):E[key==='buy'?'buySupply':'sellSupply'](run,nearest.id,id,1,run.revision);
      if(transact(result))trade();return;
    }
  }
  window.TowerMode = { get active(){return active;}, get paused(){return paused;}, open, beginNew, tick, floorSeed, atmosphereStyle, scheduleShift, updateShift, reachExit, defeat, requestQuit, canCollectOriginal, collectedOriginal, itemConfig, reservedCells, preserveFloorPickups, soundChanged, mapMarkers };
  install();
})();
