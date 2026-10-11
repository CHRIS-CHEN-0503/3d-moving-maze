/* 倒轉高塔：共用一般版引擎與操作，獨立保存劇情進度。 */
(function () {
  'use strict';
  const C = window.TowerCore;
  const E = window.TowerEncounters, V = window.TowerCharacters;
  const N = window.TowerNarrative, D = window.TowerDungeons, S = window.TowerSideStories;
  const P = window.TowerPartyCore, Heroes=window.TowerHeroes, HeroVisual=window.TowerHeroVisuals, Cooking=window.TowerCommissionCooking;
  const Lords=window.TowerFloorLords,Loot=window.TowerLoot,Foraging=window.TowerForaging,Reinforcements=window.TowerReinforcements;
  const Underworld=window.TowerUnderworld;
  const Landmarks=window.TowerLandmarks,AdventureEvents=window.TowerAdventureEvents;
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const modern=()=>!!run?.party?.loadouts;
  let partyUI = null, lightingUI = null, lightingRig = null, pendingProfession = null, pendingHero = null, pendingSex = 'male', upgradingProfession = false;
  const SAVE = (window.TowerGM?.active?.()?window.TowerGM.GM_SAVE:'maze3d_tower_v1');
  const SURFACE_CLEAR=SAVE+'_surface_clear_v1';
  const AUTO_AIM_SETTING='maze3d_tower_auto_aim_v1';
  let autoAim=false;try{autoAim=localStorage.getItem(AUTO_AIM_SETTING)==='on';}catch(_){}
  let pendingUnderworld=null,pendingUnderworldSource='',pendingUnderworldActive='';
  const floorLabel=floor=>floor<0?'地下第 '+Math.abs(floor)+' 層':'第 '+floor+' 層';
  let run = null, active = false, paused = false, pauseAt = 0, modalFocus = null;
  let world = null, loot = [], monsters = [], traders = [], nearest = null;
  let environmentLife=null;
  let tradeCategory='supplies',tradeMerchant='',pendingCooking=null;
  // Menus opened from a shop keep a way back to it while the player stays there.
  let menuReturn=null,lastPressed=null,discardFrom='bag';
  let warriorNpc = null, nearestWarrior = null, escort = null;
  let explorer = null, chest = null, relic = null, nearbyEncounter = null, lastSurveyCell = '', gearVisual = null, gearSignature = '', exitDeclined = false;
  let shiftLeft = C.floorConfig(99).shiftSeconds, wasShifting = false, floorConfig = null, saveClock = 0, hudClock = 0;
  let heroFp=null,heroFpKind='';
  let attackLeft = 0, hurtLeft = 0, warning = false, floorStarted = false, saveFailed = false;
  let encounterHold = 0, bossEncounterHold = 0, campDialog = false;
  let cinema = null,storyTheater=null,storyTheaterKey='',storyPreviewScreen='';
  const encounterAlert=window.TowerEncounterAlert?.create({THREE,world:()=>world,player:()=>playerGroup,camera:()=>camera,firstPerson:()=>G.view==='fp',voice:()=>window.GameVoice?.announceAsset('alert.monster','小心，附近有怪物。留意地上的紅圈，準備閃避，或請護衛攔住牠。',true)});
  let objectiveHint = null, hiddenDuringShift = 0, liveValidateClock = 0;
  // Each new journey keeps a full backup of the replaced save. Keep only the
  // newest few so repeated restarts cannot exhaust storage and block saving.
  function pruneHeroBackups(keep,prefix=SAVE+'_before_heroes_'){try{const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(prefix)&&/^\d+$/.test(key.slice(prefix.length)))keys.push(key);}keys.sort((a,b)=>Number(a.slice(prefix.length))-Number(b.slice(prefix.length)));for(const key of keys.slice(0,Math.max(0,keys.length-keep)))localStorage.removeItem(key);}catch(_){/* storage unavailable: the caller reports it */}}
  // Robot core slots ride in run.equipment too; label them instead of printing "undefined".
  const GEAR_SLOT_LABELS = Object.freeze({helmet:'盔',armor:'甲',shield:'盾',weapon:'武',core1:'核一',core2:'核二'});
  let hurtFlash = 0, guardClashAt = 0;
  let bolts = [], boltParts = null, traderSafe = false;
  let huntGate = null;
  let mainClue = null, rift = null, dungeonObjects = [], nearbyJourney = null, exploredCells = new Set(), reader = null, sideReader = null;
  let pendingDungeonShift = null;
  let hazards = [], hazardSlow = 1, hazardGrace = 3;
  let landmark=null,eventMarker=null,followupMarker=null,counterObjects=[],nearbyAdventure=null,lordCounterNotice=false;
  const color = { heal: 0xff719a, ration: 0xe7b86c, shield: 0x5edfff, hourglass: 0xcda5ff, bell: 0xffd677, map: 0x85e9ac, feather: 0xeaf6ff, coin: 0xffd76a, arrow:0xb3d79b };
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
  function dungeonOffer() { return D && inDungeon() ? (D.activeOffer?D.activeOffer(run):D.offer(run)) : null; }
  // A hunt rift is a battle trial: its own monsters, companions along, no puzzle objects or traps.
  function huntActive() { return inDungeon()&&!!D?.isHuntId?.(run.expedition.active.id); }
  function huntTally(offer=dungeonOffer()) { return offer?.hunt?offer.required.filter(i=>run.defeatedMonsters.includes('monster-h-'+i)).length:0; }
  function dungeonComplete() { const offer=dungeonOffer();return offer?.hunt?D.huntDone(run,offer):run.expedition.active.progress.length===3; }
  function sideStory(kind) { return S?.get(kind)||null; }
  function explorerIdentity() { return explorer?.offer?.explorer || E.explorerIdentity?.(run.floor,run.seed) || {id:'eve',name:'伊芙',title:'探索者',greeting:''}; }
  function explorerName() { const person=explorerIdentity();return person.title+'・'+person.name; }
  function environmentSpec() {
    if(inDungeon()&&!huntActive())return sideStory(run.expedition.active.kind)?.palette||{archive:[0x718291,0xaea38f,0x9b9387,0xf1d29e,'books'],bells:[0x617b94,0x92aaba,0x8c99a8,0x91e5e7,'crystal'],lantern:[0x77748b,0xb8a58e,0x9a9295,0xffc878,'fire']}[run.expedition.active.kind];
    if(floorConfig.underworld){
      const base=ENVIRONMENTS[{roots:2,mist:5,library:4,furnace:8,heart:9}[floorConfig.environmentId]??9];
      return [...base];
    }
    return ENVIRONMENTS[Math.max(0, Math.min(9, floorConfig.chapter - 1))];
  }
  function atmosphereStyle() {
    const [,wall,ground,accent,style]=environmentSpec();
    return {style,palette:{wall,ground,accent},seed:floorSeed()};
  }
  const text = escapeHtml;
  const el = id => document.getElementById(id);

  function createObjectiveHint(control,panel,available,readText) {
    let enabled=false,left=0,pointer=null,key=null,focused=true,shown=null,at=null;
    const ready=()=>enabled&&focused&&!document.hidden&&available();
    function show(value){
      if(shown===value)return;shown=value;panel.hidden=!value;
      if(enabled)control.setAttribute('aria-expanded',String(value));
    }
    function render(){
      const canShow=ready();if(canShow&&at===null)at=performance.now();
      const visible=canShow&&(left>0||pointer!==null||key!==null);
      if(visible&&readText){const message=readText();if(message!=null&&panel.textContent!==message)panel.textContent=message;}
      show(visible);
    }
    function releasePointer(){
      const id=pointer;pointer=null;
      if(id!==null)try{if(control.hasPointerCapture(id))control.releasePointerCapture(id);}catch(_){}
    }
    function suspend(){releasePointer();key=null;at=null;show(false);}
    function endPointer(event){
      if(event.pointerId!==pointer)return;
      event.preventDefault();event.stopPropagation();releasePointer();render();
    }
    control.addEventListener('pointerdown',event=>{
      if(!ready()||pointer!==null||event.button!==0)return;
      event.preventDefault();event.stopPropagation();left=0;pointer=event.pointerId;
      try{control.setPointerCapture(pointer);}catch(_){}
      render();
    });
    control.addEventListener('pointercancel',endPointer);
    control.addEventListener('lostpointercapture',endPointer);
    window.addEventListener('pointerup',endPointer);
    control.addEventListener('keydown',event=>{
      if(!ready()||!['Space','Enter'].includes(event.code))return;
      event.preventDefault();event.stopPropagation();if(key!==null)return;
      left=0;key=event.code;render();
    });
    window.addEventListener('keyup',event=>{
      if(event.code!==key)return;
      event.preventDefault();event.stopPropagation();key=null;render();
    });
    control.addEventListener('click',event=>{if(enabled){event.preventDefault();event.stopPropagation();}});
    control.addEventListener('contextmenu',event=>{if(enabled)event.preventDefault();});
    control.addEventListener('blur',()=>{if(pointer!==null||key!==null){suspend();render();}});
    window.addEventListener('blur',()=>{focused=false;suspend();});
    window.addEventListener('focus',()=>{focused=true;render();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else render();});
    return {
      enter(){
        suspend();enabled=true;left=3;
        control.disabled=false;control.setAttribute('role','button');control.tabIndex=0;
        control.setAttribute('aria-controls',panel.id);
        control.setAttribute('aria-expanded','false');
        control.setAttribute('aria-label','按住查看劇情目標，放開隱藏');
        control.title='按住查看劇情目標';render();
      },
      tick(){
        if(!ready()){suspend();return;}
        // The engine clamps frame time for movement. Use the actual visible
        // elapsed time here so slow phones still dismiss the hint in 3 seconds.
        const now=performance.now();left=Math.max(0,left-(at===null?0:Math.max(0,now-at)/1000));at=now;if(left<1e-6)left=0;render();
      },
      suspend,refresh:render,
      stop(){
        suspend();enabled=false;left=0;control.disabled=true;control.tabIndex=-1;control.title='';
        for(const name of ['role','aria-controls','aria-label','aria-expanded'])control.removeAttribute(name);
      },
    };
  }

  function setHudExpanded(expanded,persist=false) {
    el('towerHudDetails').hidden=!expanded;
    const toggle=el('towerHudToggle');
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.setAttribute('aria-label',expanded?'收合生存資訊':'展開生存資訊');
    toggle.title=expanded?'收合資訊':'展開資訊';
    el('towerHud').setAttribute('data-expanded',String(expanded));
    if(persist)try{localStorage.setItem('maze3d_tower_hud_expanded',expanded?'1':'0');}catch(_){}
  }

  function install() {
    const leftHud = document.createElement('div');leftHud.id='towerLeftHud';
    const topHud=el('hudTop'),topInfo=el('hudInfo');
    if(topHud&&topInfo){topHud.prepend(leftHud);leftHud.appendChild(topInfo);}
    else el('gameScreen').appendChild(leftHud);
    const hud = document.createElement('section');
    hud.id = 'towerHud'; hud.setAttribute('aria-label', '高塔生存狀態');
    hud.innerHTML = '<div class="tower-hud-summary"><span class="tower-stat tower-floor-stat"><small>樓層</small><b id="towerFloor">99 F</b></span><span class="tower-hud-health"><span class="tower-stat"><small>生命</small><b id="towerHealth">'+C.MAX_HP+' / '+C.MAX_HP+'</b></span><progress id="towerHp" class="tower-health" max="'+C.MAX_HP+'" value="'+C.MAX_HP+'" aria-label="生命值"></progress></span><button type="button" id="towerHudToggle" aria-controls="towerHudDetails" aria-expanded="false" aria-label="展開生存資訊"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div><div id="towerHudDetails" hidden><div class="tower-hud-meta"><span id="towerChapter"></span><span class="tower-stat"><small>'+(window.TowerResourceIcons?.svg('coin')||'')+'銅幣</small><b id="towerCoins">0</b></span></div><div id="towerGuardStatus" class="tower-guard-status" hidden></div></div>';
    leftHud.appendChild(hud);
    const hurt=document.createElement('div');hurt.id='towerHurtGlow';hurt.setAttribute('aria-hidden','true');el('gameScreen').appendChild(hurt);
    const gearStatus=document.createElement('div');gearStatus.id='towerGearStatus';gearStatus.className='tower-gear-status';el('towerHudDetails').appendChild(gearStatus);
    let hudExpanded=false;try{hudExpanded=localStorage.getItem('maze3d_tower_hud_expanded')==='1';}catch(_){}
    setHudExpanded(hudExpanded);
    bindActionBtn(el('towerHudToggle'),()=>setHudExpanded(el('towerHudDetails').hidden,true));
    const rail = document.createElement('nav'); rail.id = 'towerActionRail'; rail.setAttribute('aria-label', '劇情操作');
    rail.innerHTML = '<button class="tower-btn" id="towerBagBtn">背包 <small>B</small></button><button class="tower-btn" id="towerJournalBtn">日誌 <small>J</small></button><button class="tower-btn" id="towerQuestBtn">任務 <small>Q</small></button><button class="tower-btn" id="towerAttackBtn">揮擊 <small>X</small></button>';
    el('gameScreen').appendChild(rail);
    const talk=document.createElement('button');talk.id='towerTalkBtn';talk.className='round-btn';talk.hidden=true;
    talk.setAttribute('aria-label','對話（R）');talk.setAttribute('aria-keyshortcuts','R');
    // 固定圖示不隨互動類型變動；文字僅供輔助閱讀，保留原本 R 互動。
    talk.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M23 18h2a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H13a3 3 0 0 0-3 3v2"/><path d="M7 12h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-6 4v-4a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z"/><path d="M9 18h.1M13 18h.1M17 18h.1"/></svg>';
    el('hudRightBtns').appendChild(talk);
    const objective = document.createElement('div'); objective.id = 'towerObjective'; objective.hidden=true; el('gameScreen').appendChild(objective);
    // While a lord's half-health shield is up, the held hint shows the counter objective instead of the chapter line.
    objectiveHint=createObjectiveHint(el('hudRoundControl'),objective,()=>active&&floorStarted&&G.running&&!paused&&run?.status==='playing',()=>{if(inDungeon())return null;const guard=AdventureEvents?.guardNotice?.(run);return guard?guard.objective:N?N.objective(run):null;});
    const overlay = document.createElement('div'); overlay.id = 'towerOverlay'; overlay.hidden = true;
    overlay.innerHTML = '<section id="towerDialog" class="tower-card" role="dialog" aria-modal="true" aria-labelledby="towerDialogTitle" tabindex="-1"></section>';
    document.body.appendChild(overlay);
    cinema=window.TowerCinematics?.create({THREE,env:window,camera:()=>camera,player:()=>({x:G.px,z:G.pz}),voice:()=>window.GameVoice,reduced:()=>!!reducedMotion?.matches,
      available:spec=>!paused&&!G.shifting&&(spec?.sequence?!!run:active&&floorStarted&&G.running&&run?.status==='playing'),valid:spec=>!G.shifting&&(spec?.sequence?!!run:active&&floorStarted&&G.running),
      constrain:(focus,goal)=>window.MazeCameraComfort?.constrainOrbit(focus,goal,G.wallBoxes,G.wallH,.25),
      foreground:()=>{const list=[playerGroup,heroFp];world?.traverse(o=>{if(o.isSprite||o.userData.partyTag&&o.userData.head)list.push(o);});return list;},
      hold:()=>{dialog('重要時刻','演出中','','','',{silent:true});el('towerOverlay').hidden=true;if(heroFp)heroFp.visible=false;},release:()=>{closeDialog();if(active&&modern())updateHeroFirstPerson();}});
    el('storyEntryBtn').onclick = () => open(true);
    bindActionBtn(el('towerBagBtn'), ()=>inventory());
    bindActionBtn(el('towerTalkBtn'), ()=>trade());
    bindActionBtn(el('towerJournalBtn'), journal);
    bindActionBtn(el('towerQuestBtn'), ()=>questDialog(false,true));
    bindActionBtn(el('towerAttackBtn'), attack);
    overlay.addEventListener('click', event => {
      const button = event.target.closest('button[data-tower]');
      if (button && !button.disabled) {
        lastPressed={tower:button.dataset.tower,item:button.dataset.item||''};
        const label=window.TowerMenuVoice?.label(button.dataset.tower,button.dataset.item);
        handleAction(button.dataset.tower, button.dataset.item);
        if(label)window.GameVoice?.announce(label,true);
      }
    });
    overlay.addEventListener('input',event=>window.MazeAudioSettings?.input(event));
    window.addEventListener('keydown', event => {
      if (!active && overlay.hidden) return;
      // v1.61.1 · a cutscene owns the keyboard: no bag, trade or journal panels over a lord's line.
      if (cinema?.active) return;
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
      if (event.code === 'KeyQ') questDialog(false,true);
      if (event.code === 'KeyL') lightingUI?.quickUse();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && active && !paused && !G.shifting && run.status === 'playing') pauseMenu();
      // Leaving mid-shift cannot open a dialog yet; pause as soon as the walls settle.
      else if (document.hidden && active && !paused && G.shifting && run.status === 'playing') hiddenDuringShift = hiddenDuringShift || performance.now();
      if (active) save();
    });
    window.addEventListener('pagehide', () => { if (active) save(); });
    if(P&&window.TowerPartyRuntime){
      partyUI=window.TowerPartyRuntime.create({THREE,G,core:C,text,action,returnAction:()=>returnAction(),inHunt:()=>huntActive(),skillFlash:(at,color,power,seconds)=>lightingUI?.flash?.(at,color,power,seconds),dialog,help:(title,html)=>window.TowerCompactHelp?.render(title,html)||html,transact,save,toast:showToast,audio:AudioEng,quest:questEvent,
        run:()=>run,paused:()=>paused,world:()=>world,monsters:()=>monsters,traders:()=>traders,player:()=>playerGroup,camera:()=>camera,inDungeon,autoAim:()=>autoAim,
        clear:hasClearPath,followClear:followerClear,followDistance:followerDistance,cell:cellPoint,worldToCell,chooseCell,makeText:makeTextSprite,follow:followNpc,dispose:disposeSceneObject,damage,
        close:closeDialog,refreshGear,hurt:()=>hurtLeft>0,passage:openExplorationPassage,
        makeHero:(job,identity,gender)=>HeroVisual.base(job,buildCharacter,identity,gender||P.sex(run,identity)),hazards:()=>hazards,clearSlow:()=>{hazardSlow=1;},
        beforeAction:()=>!checkLordEntrance(),beforeMonsterHit:allowMonsterHit,
        monsterEngaged:(m)=>{if(m.lord){encounterHold=bossEncounterHold=4;window.TowerAudio?.setEncounter(true,true);if(!cinema)lordVoice(m,'encounter');}},monsterDefeated:(m)=>{restoreDrops();if(m.lord){bossEncounterHold=0;window.TowerAudio?.setEncounter(encounterHold>0,false);presentLord(m,'defeat');}},
        bind:bindActionBtn,swing:()=>{attackLeft=.8/(modern()?1:C.hasteMultiplier(run));window.CharacterMotion?.beginAction(playerGroup,'attack',attackLeft);if(modern())window.TowerCombatMotion?.begin(playerGroup,'attack',Heroes.stats(run).interval);}});
      partyUI.install();
    }
    if(window.TowerLighting&&window.TowerLightingRuntime){
      lightingUI=window.TowerLightingRuntime.create({THREE,G,run:()=>run,active:()=>active,paused:()=>paused,world:()=>world,traders:()=>traders,player:()=>playerGroup,camera:()=>camera,dispose:disposeSceneObject,inDungeon,
        environment:()=>({id:floorConfig.environmentId,underworld:floorConfig.underworld===true,rig:lightingRig}),clear:hasClearPath,cell:cellPoint,chooseCell,marker:makePickupMarker,daylightCast:()=>partyUI?.heroes.daylight(),
        robotPanel:()=>partyUI?.heroes.panel(Heroes.state(run).active),robotSources:()=>modern()?Heroes.ids(run).filter(id=>id!==Heroes.state(run).active&&Heroes.job(run,id)==='robot'&&Heroes.hp(run,id)>0).flatMap(id=>{const at=partyUI?.heroes.position(id),power=window.TowerLighting.robotLight(run,id);return at&&power?[{...at,...power,robot:true}]:[];}):[],
        bind:bindActionBtn,action,dialog,transact,toast:showToast,audio:AudioEng,close:closeDialog,trade});
      lightingUI.install();
    }
    // Keep every left-side layer in normal flow; opening details pushes rows down.
    const effects=el('effectChips');if(effects)leftHud.appendChild(effects);
  }
  // Confirmations read as the main choice, irreversible ones as warnings and
  // leaving the menu as the quiet exit; keys and order never change.
  function action(label, key, item, disabled, extra='') {
    const tone=/(?:-confirm|-do)$|^hero-robot-upgrade$/.test(key)?' primary':/^(?:discard|party-dismantle|party-dismiss)$/.test(key)?' danger':key==='close'?' is-exit':'';
    return '<button class="tower-btn'+tone+(extra?' '+extra:'')+'" data-tower="' + key + '"' + (item ? ' data-item="' + text(item) + '"' : '') + (disabled ? ' disabled' : '') + '>' + text(label) + '</button>';
  }
  function returnAction(){
    const shop=menuReturn&&nearest&&nearest.id===menuReturn.merchant&&Math.hypot(G.px-nearest.x,G.pz-nearest.z)<2.6;
    return shop?action('回到商店','trade-back',menuReturn.merchant):'';
  }
  function isCampMusicDialog(kicker, narration, actions) {
    if (!active || !G.running || run?.status !== 'playing' || !partyUI?.safeCamp?.()) return false;
    if (narration.commerce === 'camp') return true;
    if (narration.workshop && kicker === '營地工坊 · 暫停中') return true;
    if (kicker === '安全營地 · 動力核心') return true;
    if (kicker === '機體強化 · 暫停中' && !String(actions).includes('data-tower="party-merchant-forge"')) return true;
    // General robot management also has craft/workshop buttons in its footer;
    // only the actual service confirmations may inherit an established camp.
    if (!campDialog) return false;
    const returnAction = kicker === '製作核心確認' ? 'hero-core-craft' : kicker === '機體進階確認' ? 'hero-robot-workshop' :
      /^(?:確認修理|確認鍛造|確認材料附魔|拆解裝備確認)$/.test(kicker) ? 'party-forge-back' : null;
    return returnAction !== null && String(actions).includes('data-tower="' + returnAction + '"');
  }
  function dialog(kicker, title, copy, body, actions, narration={}) {
    el('towerTalkBtn').hidden=true;
    campDialog = isCampMusicDialog(kicker, narration, actions);
    window.TowerAudio?.setCamp(campDialog);
    if (active && !paused) {
      paused = true; pauseAt = performance.now(); G.frozen = true;
      if(window.TowerAudio)window.TowerAudio.setPaused(true);
      Object.keys(keys).forEach(k => delete keys[k]); joy.active = false; joy.dx = joy.dy = 0;
      el('joyBase').style.display = el('joyStick').style.display = 'none';
    }
    objectiveHint?.suspend();
    partyUI?.refreshWorkProgress();
    if (el('towerOverlay').hidden) modalFocus = document.activeElement;
    // A quiet refresh of the same page (after buying, cooking, equipping…)
    // keeps the reader's place and the pressed button instead of jumping to the top.
    // Tabs and workshop sub-pages are different pages even under the same title.
    const pageMarks=[...new Set(String(body||'').match(/aria-current="page"[^>]*?data-item="[^"]*"|data-forge-page="[a-z]+"/g)||[])].join(',');
    const pageKey=kicker+'|'+title+'|'+pageMarks,dialogNode=el('towerDialog'),sameRefresh=narration.silent===true&&!el('towerOverlay').hidden&&dialogNode.dataset?.pageKey===pageKey,keepScroll=sameRefresh?dialogNode.querySelector?.('.tower-dialog-content')?.scrollTop||0:0;
    el('towerOverlay').hidden = false;
    const closeButton=!pendingDungeonShift&&(!active||(run.status==='playing'&&G.running&&floorStarted))?'<button class="tower-close" data-tower="close" aria-label="關閉對話並返回">返回</button>':'';
    const voiceControls=window.GameVoice?.status().enabled&&window.GameVoice?.status().supported?'<nav class="tower-voice-controls" data-voice-controls aria-label="故事朗讀"><button class="tower-btn" type="button" data-voice-action="replay" aria-label="重新朗讀這一頁"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z M17 8q5 4 0 8 M19 4q9 8 0 16"/></svg>重聽</button><button class="tower-btn" type="button" data-voice-action="stop" aria-label="停止朗讀"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>停止</button></nav>':'';
    el('towerDialog').classList.toggle('hero-management',!!narration.heroManagement);
    el('towerDialog').classList.toggle('hero-creation',!!narration.heroCreation);
    el('towerDialog').classList.toggle('tower-workshop',!!narration.workshop);
    el('towerDialog').classList.toggle('tower-commerce',!!narration.commerce);
    el('towerDialog').setAttribute?.('data-commerce',narration.commerce||'');
    const wallet=Number.isFinite(narration.wallet)?'<span class="tower-trade-wallet" aria-label="持有銅幣 '+text(narration.wallet)+'">'+(window.TowerResourceIcons?.svg('coin')||'')+text(narration.wallet)+' 幣</span>':'';
    el('towerDialog').innerHTML = '<header class="tower-dialog-header"><div class="tower-dialog-titles'+(wallet?' tower-titles-with-wallet':'')+'"><div class="tower-kicker">' + text(kicker) + '</div><h2 class="tower-heading" id="towerDialogTitle">' + text(title) + '</h2>'+wallet+'</div>'+voiceControls+closeButton+'</header><div class="tower-dialog-content" tabindex="0" role="region" aria-label="對話內容">'+(copy?'<p class="tower-copy">' + text(copy) + '</p>':'') + (body || '') + '</div><div class="tower-actions">' + actions + '</div>';
    if(dialogNode.dataset)dialogNode.dataset.pageKey=pageKey;
    // Page-level rules live behind one "?" in the header instead of a full row.
    const pageHelp=dialogNode.querySelector?.('.tower-dialog-content > .tower-compact-help'),dialogHeader=dialogNode.querySelector?.('.tower-dialog-header');
    if(pageHelp&&typeof dialogHeader?.insertBefore==='function'){pageHelp.classList?.add('in-header');dialogHeader.insertBefore(pageHelp,dialogHeader.querySelector('.tower-close'));}
    window.TowerCompactHelp?.install(document);
    const restored=sameRefresh&&lastPressed?[...(dialogNode.querySelectorAll?.('button[data-tower]')||[])].find(b=>b.dataset.tower===lastPressed.tower&&(b.dataset.item||'')===lastPressed.item&&!b.disabled):null;
    (restored||el('towerDialog')).focus();
    el('towerDialog').scrollTop=0;
    if(keepScroll){const content=dialogNode.querySelector?.('.tower-dialog-content');if(content)content.scrollTop=keepScroll;}
    el('towerDialog').voiceScope=narration.full?'full':'summary';
    el('towerDialog').voiceSummary=narration.summary||'';
    el('towerDialog').voiceText=narration.text;
    el('towerDialog').voiceAsset=narration.asset||'';
    el('towerDialog').voiceAfterText=narration.afterText||'';
    const roleSpeaker=narration.speaker||window.MazeRoleVoices?.profiles?.[narration.asset]||(kicker==='旅途奇遇 · 護衛契約'?{gender:'male',age:nearestWarrior?.offer?.strength===1?'young':'adult'}:null);
    el('towerDialog').voiceSpeaker=roleSpeaker?{...roleSpeaker,npc:true}:{};
    if(!narration.silent){
      if(window.TowerMenuVoice?.quiet(kicker,narration))window.GameVoice?.stop();
      else window.GameVoice?.readPanel(el('towerDialog'));
    }
  }
  function openBattleSettings(quiet=false){if(!active||!G.running)return;dialog('旅程暫停中','遊戲設定','調整聲音、畫質與操作，關閉後繼續冒險。',window.MazeAudioSettings.controls()+(window.MazeQuality?.controls()||'')+'<div class="battle-settings-options">'+action('音樂：'+(G.muted?'關':'開'),'battle-music')+(modern()?'<button class="tower-btn" data-tower="battle-auto-aim" role="switch" aria-checked="'+autoAim+'">自動對準：'+(autoAim?'開':'關')+'</button>'+action('技能排序','hero-order')+action('自動行動／快捷欄','hero-policy'):'')+'</div>'+(modern()?'<p class="tower-copy">自動對準：按攻擊或對敵技能時，朝向攻擊範圍內最近、未被牆壁遮擋的怪物。不會自動走位；輔助技能仍由你選隊友。</p>':''),action('離開遊戲','quit',null,false,'is-leave')+action('繼續遊戲','close'),{silent:quiet,summary:'遊戲設定。可以調整音量、畫質、自動對準與隊友行動。'});}
  function closeDialog() {
    if(pendingDungeonShift)return;
    menuReturn=null;if(el('towerDialog').dataset)el('towerDialog').dataset.pageKey='';
    campDialog = false; window.TowerAudio?.setCamp(false);
    pendingWarriorReplacement=null;
    pendingCooking=null;
    window.GameVoice?.stop(true);
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
    if(active&&floorStarted)partyUI?.hud();
    objectiveHint?.refresh();
  }
  function readSave() {
    try { return C.validateSave(JSON.parse(localStorage.getItem(SAVE) || 'null')); }
    catch (_) { return null; }
  }
  // A stored journey that no longer validates (damaged, or written by a newer
  // version) must not look like "no save": warn and keep its raw text.
  function unreadableSave() {
    try { return !!localStorage.getItem(SAVE) && !readSave(); }
    catch (_) { return false; }
  }
  function surfaceClear() {
    const current=readSave();
    if(current?.status==='won'&&current.floor===1)return current;
    try{const saved=C.validateSave(JSON.parse(localStorage.getItem(SURFACE_CLEAR)||'null'));return saved?.status==='won'&&saved.floor===1?saved:null;}catch(_){return null;}
  }
  function underworldIntro(){
    const cleared=surfaceClear();if(!cleared||!Underworld||!C.startUnderworld)return;
    const result=C.startUnderworld(cleared,cleared.revision);
    if(!result.ok){showToast(result.message||'目前無法開啟地下旅程，地上進度仍完整保留。');return;}
    pendingUnderworld=result.run;pendingUnderworldSource=JSON.stringify(cleared);pendingUnderworldActive=localStorage.getItem(SAVE);
    const departed=pendingUnderworld.underworld?.departed,job=departed?P.PROFESSIONS[departed.profession]?.name:'';
    const farewell=departed?`${job||'同伴'}${departed.name?'・'+departed.name:''}搖了搖頭：「我答應陪你走出高塔。現在已經做到了，我想先回家休息。你們要平安回來。」你尊重這個決定，接過對方留下的裝備，好好道別。`:'沒有同伴需要道別。你收好裝備，決定親自查明樓梯下方的秘密。';
    const current=readSave(),replaces=current&&current.status!=='won',replacesFinished=current?.status==='won'&&current.floor<0;
    const paragraphs=['你已經走出高塔。幾天後，一名旅人帶來消息：第 1 層樓主離開後，原本封閉的石壁竟露出隱藏樓梯。','高塔之下，還有一座更古老的地下城。這一次沒有召喚，也沒有強迫。帶著好奇，你決定回去看看。',farewell,'地下怪物更加強大。你可招募最多四名同伴，與主角組成五人隊伍。前四十層沿用最大的迷宮；最後十層還會更寬廣。'];
    const note=replaces?'目前另有未完成旅程，確認後會先備份，再切換成地下篇。':replacesFinished?'這會從地上通關時重新出發，取代已完成的地下篇紀錄；確認後會先另存備份，地上通關存檔也會保留。':'地上通關存檔會另行保留。';
    const decide=()=>dialog('通關後的新篇章 · 地下五十層','門外，還有一條向下的路','是否開始這次自願的探索？','<p class="tower-copy">承接地上通關時的等級、技能、裝備與補給。離隊只發生這一次；續玩不會再次抽選。'+note+'</p>',action('先留在塔外','underworld-cancel')+action('帶著好奇，進入地下城','underworld-start'),{silent:true});
    // Without the film stage the same backup and replacement notice follows the story text.
    if(!playStorySequence({id:'underworld-introduction',title:'門外，還有一條向下的路',floor:1,paragraphs},decide,decide))dialog('通關後的新篇章 · 地下五十層','門外，還有一條向下的路','',prose(paragraphs)+'<p class="tower-copy">'+note+'</p>',action('先留在塔外','underworld-cancel')+action('帶著好奇，進入地下城','underworld-start'),{full:true});
  }
  function startUnderworld(){
    if(!pendingUnderworld)return;
    const cleared=surfaceClear(),candidate=C.validateSave(pendingUnderworld);
    if(!cleared||!candidate){pendingUnderworld=null;open();return;}
    if(JSON.stringify(cleared)!==pendingUnderworldSource||localStorage.getItem(SAVE)!==pendingUnderworldActive){pendingUnderworld=null;open();showToast('旅程已在其他地方更新，請重新確認地下篇，不會覆蓋新進度。',4000);return;}
    // Stage both recoverable snapshots before replacing the active journey.
    // A failed storage write never starts an unsaved underground expedition.
    try{
      const old=localStorage.getItem(SAVE);
      localStorage.setItem(SURFACE_CLEAR,JSON.stringify(cleared));
      // Never overwrite the first backup: it may hold the surface journey this
      // expedition first replaced. Later replacements keep the newest two stamped copies.
      const first=localStorage.getItem(SAVE+'_before_underworld');
      if(old&&!first)localStorage.setItem(SAVE+'_before_underworld',old);
      else if(old&&old!==first){pruneHeroBackups(1,SAVE+'_before_underworld_');localStorage.setItem(SAVE+'_before_underworld_'+Date.now(),old);}
      localStorage.setItem(SAVE,JSON.stringify(candidate));
    }catch(_){showToast('無法備份並保存地下旅程，目前進度未變。請先騰出瀏覽器儲存空間。',4000);return;}
    run=candidate;pendingUnderworld=null;floorStarted=false;enter();
  }
  function syncEngine() {
    if (!run || !floorStarted) return;
    const now = paused ? pauseAt : performance.now();
    run.hunger = G.satiety;
    run.engine = { shovels: G.shovels, kites: G.kites, whistles: G.whistles, shovelCooldownMs: Math.max(0, G.shovelRechargeAt - now), skillCooldownMs: Math.max(0, G.skillCoolUntil - now) };
    if(window.MagicMap)run.engine.mapKnowledge=MagicMap.snapshot(G.hWalls,G.vWalls);
    if(window.MazeSight){const memory=MazeSight.snapshot();if(memory)run.engine.sightMemory={...memory,key:MagicMap.layoutKey(G.hWalls,G.vWalls)};}
  }
  function save() {
    if (!run) return false;
    syncEngine();
    try {
      const raw=localStorage.getItem(SAVE);let previous=null;
      try{previous=raw?JSON.parse(raw):null;}catch(_){}
      // Validating the old save is the expensive part of every save; check cheap
      // migration conditions first and validate at most once, only when needed.
      let previousChecked=false,previousIsValid=false;const validPrevious=()=>{if(!previousChecked){previousChecked=true;previousIsValid=!!C.validateSave(previous);}return previousIsValid;};
      if(run.party?.journey&&previous?.party&&!previous.party.journey&&validPrevious())localStorage.setItem(SAVE+'_before_expedition2',raw);
      if(run.party?.light&&previous?.party&&previous.party.light===undefined&&validPrevious())localStorage.setItem(SAVE+'_before_lighting',raw);
      if(run.party?.journey?.materials&&previous?.party&&previous.party.journey?.materials===undefined&&!localStorage.getItem(SAVE+'_before_regional_crafting')&&validPrevious())localStorage.setItem(SAVE+'_before_regional_crafting',raw);
      if(run.party?.travellers&&previous?.party&&previous.party.travellers===undefined&&!localStorage.getItem(SAVE+'_before_traveller_reunion')&&validPrevious())localStorage.setItem(SAVE+'_before_traveller_reunion',raw);
      if(run.party?.foraging&&previous?.party&&previous.party.foraging===undefined&&!localStorage.getItem(SAVE+'_before_foraging_v1')&&validPrevious())localStorage.setItem(SAVE+'_before_foraging_v1',raw);
      if(run.party?.foraging?.version===4&&[1,2,3].includes(previous?.party?.foraging?.version)&&!localStorage.getItem(SAVE+'_before_foraging_v4')&&validPrevious())localStorage.setItem(SAVE+'_before_foraging_v4',raw);
      if(previous&&typeof Heroes!=='undefined'&&Heroes?.ROBOT?.needsMigration(previous)&&!localStorage.getItem(SAVE+'_before_robot_power_v1')&&validPrevious())localStorage.setItem(SAVE+'_before_robot_power_v1',raw);
      if(previous&&typeof Heroes!=='undefined'&&Heroes?.ROBOT?.needsCoreExpiryMigration(previous)&&!localStorage.getItem(SAVE+'_before_core_expiry_v1')&&validPrevious())localStorage.setItem(SAVE+'_before_core_expiry_v1',raw);
      if(run.party?.loadouts?.growth&&previous?.party?.loadouts&&!previous.party.loadouts.growth&&!localStorage.getItem(SAVE+'_before_hero_growth')&&validPrevious())localStorage.setItem(SAVE+'_before_hero_growth',raw);
      if(run.party?.loadouts?.growth?.version===2&&previous?.party?.loadouts&&previous.party.loadouts.growth?.version!==2&&!localStorage.getItem(SAVE+'_before_underground_growth_v2')&&validPrevious())localStorage.setItem(SAVE+'_before_underground_growth_v2',raw);
      if(run.party?.loadouts?.xpScale===10&&previous?.party?.loadouts&&previous.party.loadouts.xpScale===undefined&&!localStorage.getItem(SAVE+'_before_xp10')&&validPrevious())localStorage.setItem(SAVE+'_before_xp10',raw);
      const previousGear=previous?[...(previous.gearBag||[]),...Object.values(previous.equipment||{}),...Object.values(previous.party?.loadouts?.actors||{}).flatMap(a=>Object.values(a?.equipment||{})),...(previous.party?.loot?.entries||[]).filter(e=>e.type==='gear').map(e=>e.gear)].filter(Boolean):[];
      if(previous&&previousGear.some(g=>g.durabilityVersion===undefined)&&!localStorage.getItem(SAVE+'_before_durability2')&&validPrevious())localStorage.setItem(SAVE+'_before_durability2',raw);
      if(previous&&previousGear.some(g=>g.durabilityVersion===undefined||g.durabilityVersion===2)&&!localStorage.getItem(SAVE+'_before_durability3')&&validPrevious())localStorage.setItem(SAVE+'_before_durability3',raw);
      if(previous&&previousGear.some(g=>g.durabilityVersion===undefined||g.durabilityVersion===2||g.durabilityVersion===3)&&!localStorage.getItem(SAVE+'_before_durability4')&&validPrevious())localStorage.setItem(SAVE+'_before_durability4',raw);
      if(previous&&previousGear.some(g=>g.durabilityVersion===undefined||g.durabilityVersion<5)&&!localStorage.getItem(SAVE+'_before_durability5')&&validPrevious())localStorage.setItem(SAVE+'_before_durability5',raw);
      if(C.DURABILITY_VERSION>=6&&previous&&previousGear.some(g=>g.durabilityVersion===undefined||g.durabilityVersion<6)&&!localStorage.getItem(SAVE+'_before_durability6')&&validPrevious())localStorage.setItem(SAVE+'_before_durability6',raw);
      if(run.status==='won'&&run.floor===1&&C.validateSave(run))localStorage.setItem(SURFACE_CLEAR,JSON.stringify(run));
      localStorage.setItem(SAVE, JSON.stringify(run)); saveFailed = false; return true;
    }
    catch (_) { if (!saveFailed) { saveFailed = true; showToast('瀏覽器無法保存進度，請保持此分頁開啟。', 4000); } return false; }
  }
  function canCollectOriginal(id) { return !active || !run.claimed.includes(id); }
  function itemConfig() { return {itemCount:0,foodCount:0,storyCount:0,total:0}; }
  function preserveFloorPickups() { return active && floorStarted; }
  function occupiedCells(includeForaging=true){return [...(landmark?.cells||[]).map(c=>c.x+','+c.y),...traders,...loot.filter(item=>includeForaging||!item.foraging),...dungeonObjects,...hazards,...counterObjects,...(partyUI?.reserved()||[]),...(lightingUI?.reserved()||[]),...[warriorNpc,explorer,chest,relic,mainClue,rift,eventMarker,followupMarker].filter(Boolean)].map(item=>typeof item==='string'?item:item.cx+','+item.cy);}
  function reservedCells() {
    // startGame asks before buildWorld exists; reserve the same seeded island
    // already here so the initial magic-map pickups cannot occupy its scenery.
    return floorStarted?occupiedCells():(Landmarks?.plan(run,G.mazeW)?.cells||[]).map(c=>c.x+','+c.y);
  }
  function collectedOriginal(id) {
    if (!active || !run || inDungeon() || run.claimed.includes(id)) return;
    run.claimed.push(id); questEvent('collect',{id}); save();
  }
  function open(silent=false) {
    if(P&&(!window.TowerLighting||!window.TowerLightingRuntime||!Lords||!Loot||!Reinforcements)){dialog('載入尚未完成','冒險模組尚未載入','請重新整理網頁後再繼續。既有旅程不會被覆寫。','',action('回首頁','close'));return;}
    const saved = readSave(),cleared=surfaceClear(),underground=saved?.floor<0;
    const professionCount=P?.PROFESSIONS?Object.keys(P.PROFESSIONS).length:'多';
    const unlock=cleared&&Underworld?'<section class="underworld-unlock"><small>已解鎖 · 通關後篇章</small><h3>石壁後的隱藏樓梯</h3><p>走出高塔不是唯一的答案。地下五十層，還留著無人聽見的聲音。</p><p>更強的怪物 · 最多五人隊伍 · 五座地下封印</p>'+action(underground&&saved.status!=='won'?'繼續地下旅程':'探索地下五十層',underground&&saved.status!=='won'?'continue':'underworld-intro')+'</section>':'';
    dialog(cleared?'地上篇已完成 · 下一段旅程由你決定':'單人長篇冒險 · 高塔遠征', cleared?'倒轉高塔・歸途之外':'倒轉高塔・第 99 層', '你在陌生的召喚陣中醒來。塔頂只有一扇向下的門。與同樣受困的旅人組隊、討伐怪物、採集食材，在移動的迷宮裡煮一頓熱飯，再一起尋找回家的路。', '<div class="tower-story-cover" role="img" aria-label="被召喚到雲上高塔的冒險者"></div>'+(!saved&&unreadableSave()?'<p class="tower-copy tower-save-warning" role="alert">目前的存檔無法讀取（可能已損毀，或來自較新的遊戲版本）。原始資料仍保留在瀏覽器中；若剛更新過遊戲，請先重新整理網頁。建立新主角前會先另存備份，不會直接刪除。</p>':'')+(saved&&!saved.party?.loadouts?'<p class="tower-copy">目前旅程是舊版規則，仍可繼續。要體驗三主動、兩被動與逐人裝備，請選「重新開始故事」；選好職業後會先備份舊旅程。</p>':'')+'<p class="tower-copy">'+professionCount+'種職業 · 地上四人／地下五人隊伍 · '+(P?.RECIPES?Object.keys(P.RECIPES).length:'多種')+' 道料理 · 合作連攜 · 職業探索與鍛造。第 90 至 10 層的整十樓層及第 1 層，各有專屬挑戰。</p><p class="tower-copy">沿用原本移動操作 · 每層自動保存（續玩回到當層入口） · 魔法地圖變形後重新探索。</p><p class="tower-copy">特定職業學會指定技能，並符合附近站位及視線條件時，可按連攜鈕發動合作招式；會消耗參與技能的冷卻及物資。</p><p><a class="tower-atlas-link" href="docs/職業裝備圖鑑.html" target="_blank" rel="noopener">開啟劇情完整圖鑑與連攜說明</a></p>',
      (saved && saved.status !== 'won' ? action('繼續：' + floorLabel(saved.floor), 'continue') : saved&&N?action('回顧已完成故事','story-archive'):'') + action(saved ? '重新開始地上篇' : '建立主角', 'new') + action('回首頁', 'close'),{silent});
    if(unlock)el('towerDialog').querySelector('.tower-dialog-content').insertAdjacentHTML('afterbegin',unlock);
  }
  function beginNew() {
    pendingHero=null;pendingSex='male';
    const fresh=C.newRun({ name: getPlayerName(), charIdx: 0, seed: Math.max(1,(Math.random() * 0x7fffffff) | 0) });
    if(P&&partyUI)chooseProfession(fresh);else {run=fresh;enter();}
  }
  function chooseProfession(value,upgrade=false) {
    pendingProfession=value;upgradingProfession=upgrade;
    const introductions={swordsman:'持劍近戰，重裝與護盾保護同伴。',mage:'雙手法杖，擅長遠程法術與結界。',scout:'身形輕巧，雙短刃與陷阱探索。',chef:'體態厚實，鐵鍋與料理補給。',healer:'手持法書，治療、救援及弱化。',smith:'肩背壯實，短鎚或重錘與裝備修理。',archer:'修長精靈，長弓遠程射擊與牽制。',cleric:'神社神職，弓箭附加詛咒，祈禱強化隊友。',robot:'機殼守護與雙拳近戰，可用鍛造材料強化機體；不穿一般裝備。'};
    dialog('高塔遠征 · 建立角色','你想如何走出這座塔？','先選外觀與職業，下一步揭曉技能；男女能力相同。'+(value.warrior?'原有護衛會直接轉成劍士隊友，進度與費用保留。':''),'<div class="hero-create-fields"><label>冒險者稱呼 <input id="heroNameInput" maxlength="24" value="'+text(value.name)+'" aria-label="冒險者稱呼"></label><div class="hero-sex-picker" aria-label="角色外觀">'+['male','female'].map(s=>'<button type="button" class="tower-btn" data-tower="hero-sex" data-item="'+s+'" aria-pressed="'+(pendingSex===s)+'">'+(s==='male'?'男性外觀':'女性外觀')+'</button>').join('')+'</div></div><div class="tower-grid party-professions">'+Object.entries(P.PROFESSIONS).filter(([id])=>!(upgrade&&value.floor<0&&['archer','cleric','robot'].includes(id))).map(([id,job])=>'<article class="tower-item hero-profession-card">'+HeroVisual.portrait(id,pendingSex)+'<h3>'+text(job.name)+'</h3><p>'+text(introductions[id])+'</p>'+action('選擇'+job.name,'profession',id)+'</article>').join('')+'</div>',action('稍後再選','profession-cancel'),{heroCreation:true,summary:'請先選男女外觀，再選職業。'});
  }
  function revealHero(){const value=pendingHero;if(!value)return;const a=value.party.loadouts?.actors.hero,job=value.party.profession;
    const list=a?[...a.skills,...a.passives].map(k=>{const s=Heroes.SKILLS[k]||Heroes.PASSIVES[k];return '<article>'+window.TowerHeroIcons.svg(k)+'<div><b>'+text(s.name)+'</b><small>'+(Heroes.SKILLS[k]?'主動技能':'被動技能')+'</small><p>'+text(s.description)+'</p></div></article>';}).join(''):'<p>'+text(P.PROFESSIONS[job].description)+'</p>';
    dialog('高塔遠征 · 出發前確認',value.name+' · '+P.PROFESSIONS[job].name,'這就是你本次的技能。確認後按「開始冒險」進入迷宮；返回選角不會重抽相同職業的技能。','<div class="hero-reveal">'+HeroVisual.portrait(job,value.party.sex)+'<section class="hero-skill-list">'+list+'</section></div>',action('返回選角','hero-create-back')+action('開始冒險','hero-create-start'),{heroManagement:true,heroCreation:true,summary:'角色建立完成。'+(a?'主動技能：'+a.skills.map(k=>Heroes.SKILLS[k].name).join('、')+'。被動技能：'+a.passives.map(k=>Heroes.PASSIVES[k].name).join('、')+'。':'')+'確認後開始冒險。'});
  }
  function enter() {
    if(P&&partyUI&&!run.party){chooseProfession(run,true);return;}
    closeDialog();
    if (MP.on) mpLeave();
    active = true; floorStarted = false; document.body.classList.add('story-active');
    encounterAlert?.resetSession();
    partyUI?.heroes?.resetVoices();
    if(modern())Heroes.gainXp(run,0);
    G.charIdx = run.charIdx; G.view = 'tp'; G.spMode = 'classic';
    el('playerName').value = run.name;
    loadFloor(true);
  }
  function loadFloor(intro, returning=false) {
    clearStoryTheater();
    environmentLife?.destroy();environmentLife=null;
    encounterAlert?.clearVisual();
    objectiveHint?.suspend();
    pendingDungeonShift=null;closeDialog(); floorStarted = false; reader=null;sideReader=null;
    lightingUI?.reset();window.TowerCreatureArt?.release?.();
    // Remove live effects before startGame disposes the old scene. Their
    // manager-owned particle programs/textures must survive the floor change.
    partyUI?.reset();
    floorConfig = C.floorConfig(run.floor,run.seed);
    AdventureEvents?.ensure(run);
    const instance=dungeonOffer();
    if(instance)floorConfig={...floorConfig,size:instance.size,name:instance.title,shiftSeconds:instance.shiftSeconds,monsterCount:0,narrative:'',environmentId:instance.hunt?floorConfig.environmentId:sideStory(instance.kind)?.environmentId||{archive:'library',bells:'echo',lantern:'furnace'}[instance.kind]};
    const settings = { mazeSize: CFG.mazeSize, itemCount: CFG.itemCount, foodCount: CFG.foodCount };
    const counts = itemConfig(); CFG.mazeSize = floorConfig.size; CFG.itemCount = counts.itemCount; CFG.foodCount = counts.foodCount;
    G.lvlIdx = floorConfig.themeIndex;
    try { startGame(); } finally { Object.assign(CFG, settings); }
    G.hungerLethal = false; G.drainPerSec = modern() ? .12*Heroes.hungerScale(run) : .12; G.satiety = run.hunger;
    if (run.engine) {
      G.shovels = run.engine.shovels; G.kites = run.engine.kites; G.whistles = run.engine.whistles;
      G.shovelRechargeAt = run.engine.shovelCooldownMs ? performance.now() + run.engine.shovelCooldownMs : 0;
      G.skillCoolUntil = run.engine.skillCooldownMs ? performance.now() + run.engine.skillCooldownMs : 0;
      window.MagicMap?.restore(run.engine.mapKnowledge,G.hWalls,G.vWalls);
      if(run.engine.sightMemory&&window.MagicMap&&run.engine.sightMemory.key===MagicMap.layoutKey(G.hWalls,G.vWalls))window.MazeSight?.restore(run.engine.sightMemory);
    }
    if (!run.party && run.charIdx === 4 && !G.shovels && !G.shovelRechargeAt) G.shovelRechargeAt = performance.now() + shovelCdMs();
    updateShovelBtn(); updateKiteBtn(); updateWhistleBtn();
    el('hudLvlName').textContent = floorConfig.name; el('hudRound').textContent = instance?'副本':'劇情';
    buildTowerEnvironment(); buildWorld(); gearVisual=null;gearSignature='';refreshGear();encounterHold = bossEncounterHold = 0; campDialog = false; soundChanged();
    floorStarted = true; saveClock = 0; attackLeft = 0; hurtLeft = 3; wasShifting = false; hiddenDuringShift = 0; liveValidateClock = 0;
    clearHurtFeedback();guardClashAt=0;
    save(); updateHud();
    objectiveHint?.enter();
    if(instance){dungeonBriefing();return;}
    if(N){
      const chapter=N.chapterForFloor(run.floor),scene=run.floor===chapter.high&&N.scenesForFloor(run.floor).find(entry=>!run.chronicle.read.includes(entry.id));
      // Coming back out of a rift shows its settlement first; an unread chapter
      // opening stays in the journal instead of covering that summary.
      if(scene&&!returning){readStory(scene.id,true);return;}
      if(intro&&!playStorySequence({id:'floor-brief:'+run.floor,title:floorConfig.name,floor:run.floor,paragraphs:[N.objective(run)]},closeDialog,closeDialog))dialog('倒轉高塔 · 主線續章',floorConfig.name,N.objective(run),'<p class="tower-copy">每章中段尋找主線印記，章末出口需要印記。背包的故事日誌可重讀已抵達的章節。</p>'+floorFacts(),action('踏入迷宮','close')+action('故事日誌','journal'));
      return;
    }
    const narration = run.floor === 99 ? C.OPENING.text : floorConfig.narrative;
    const legacyParagraphs=Array.isArray(narration)?narration:[narration||'迷宮深處傳來金屬摩擦聲。找到下一扇門，繼續尋找召喚你的原因。'];
    if((intro||narration)&&playStorySequence({id:'legacy-floor:'+run.floor,title:run.floor===99?'我怎麼會在這裡？':'向下的門，再次開啟',floor:run.floor,paragraphs:legacyParagraphs},closeDialog,closeDialog))return;
    if (intro || narration) dialog('第 ' + run.floor + ' 層 · ' + floorConfig.name, run.floor === 99 ? '我怎麼會在這裡？' : '向下的門，再次開啟', Array.isArray(narration) ? narration.join('\n\n') : (narration || '迷宮深處傳來金屬摩擦聲。找到下一扇門，繼續尋找召喚你的原因。'),
      '<p class="tower-copy">本層 ' + floorConfig.size + ' × ' + floorConfig.size + '｜物資 '+counts.total+' 件，不隨變形重生｜每 ' + floorConfig.shiftSeconds + ' 秒變形｜' + (floorConfig.monsterCount ? '武器只能擊暈，善用護衛合作' : '安全探索，先儲備補給') + '</p><p class="tower-copy">左側移動 · 右側看四周 · 背包／裝備 B · 互動 R · 擊暈 X · 空白鍵鐵鍬</p>', action('踏入迷宮', 'close'));
  }
  function floorFacts() {
    return '<p class="tower-copy">本層 '+floorConfig.size+' × '+floorConfig.size+' · 每 '+floorConfig.shiftSeconds+' 秒變形 · 怪物總上限 '+(Reinforcements?.limit(floorConfig.size)||20)+' 隻</p><p class="tower-copy">討伐候選物資判定：普通20%'+(run.party?'（五種常用食材'+Loot.chance({type:'ingredient',key:'herb',rarity:'common'})+'%）':'')+'、少見12%、稀有6%、珍稀3%，需靠近拾取。'+(run.party?'牆角可採藥草與礦石，本層採過不補回。':'')+'商人、寶箱與委託獎勵保留；樓層主另有50%機率掉裝備。變形後會增援1～3隻，不超過總上限。</p><p class="tower-copy">魔法地圖需探索道路，可由怪物掉落或向商人購買；使用後揭露本次迷宮，變形後重新探索。</p><p class="tower-copy">左側移動 · 右側看四周 · 背包 B · 互動 R · 故事日誌 J</p>';
  }
  function prose(paragraphs) { return '<div class="tower-prose">'+paragraphs.map(p=>'<p>'+text(p)+'</p>').join('')+'</div>'; }
  function echoCards(entries) { return entries.map(e=>'<aside class="tower-story-echo"><small>旅途回聲 · '+text(e.title)+'</small><p>'+text(e.text)+'</p></aside>').join(''); }
  function endingProse(ending) { return prose(ending.paragraphs)+echoCards(S?S.endingEchoes(run,ending.id):[]); }
  function clearStoryTheater(){cinema?.cancel();storyTheater?.dispose();storyTheater=null;storyTheaterKey='';if(storyPreviewScreen){const previous=storyPreviewScreen;storyPreviewScreen='';switchScreen(previous);}}
  function playStoryPage(entry,page,narration,asset,onFinish,onLeave,caption=narration){
    if(!cinema||!window.TowerStoryTheater||!run||G.shifting)return false;
    closeDialog();
    if(!storyTheater||storyTheaterKey!==entry.id){
      clearStoryTheater();const env=C.floorConfig(entry.floor??run.floor,run.seed).environmentId||'spire';
      if(!active){storyPreviewScreen=document.querySelector('.screen.active')?.id||'titleScreen';switchScreen('gameScreen');}
      storyTheater=TowerStoryTheater.create({THREE,hero:active&&(!modern()||Heroes.state(run).active==='hero')?playerGroup:null,heroJob:modern()?Heroes.job(run,'hero'):run.party?.profession||'swordsman',heroSex:run.party?.sex||'male',heroName:run.name||'旅人',buildActor:({job,sex,name})=>HeroVisual.base(job,buildCharacter,name||'hero',sex),buildStoryActor:({id})=>id?V.buildExplorer(id,{THREE,CHARS,buildCharacter}):null,dispose:disposeSceneObject,environment:entry.environment||env,floor:entry.floor??run.floor,reduced:!!reducedMotion?.matches});storyTheaterKey=entry.id;
    }
    if(!storyTheater){clearStoryTheater();return false;}
    const staged=storyTheater.page({entry,page,text:entry.paragraphs[page],title:entry.title});
    if(!staged){clearStoryTheater();return false;}
    const show=index=>readStory(entry.id,reader.enter,index,reader.exit,true);
    const side=index=>readSideStory(sideReader.kind,index,sideReader.source,true);
    const nextPage=index=>entry.side?side(index):entry.custom?entry.show(index):show(index);
    const finish=()=>{clearStoryTheater();onFinish();};
    const started=cinema.start({...staged,sequence:true,text:narration,caption,asset,title:entry.title,kicker:'倒轉高塔 · '+floorLabel(entry.floor??run.floor)+' · '+(page+1)+' / '+entry.paragraphs.length,
      render:()=>renderer.render(staged.scene,camera),previous:page?()=>nextPage(page-1):null,next:page<entry.paragraphs.length-1?()=>nextPage(page+1):finish,
      leave:()=>{clearStoryTheater();onLeave();},done:result=>{if(!result.skipped&&page<entry.paragraphs.length-1)nextPage(page+1);else finish();}});
    if(!started){clearStoryTheater();return false;}return true;
  }
  function playStorySequence(entry,finish,leave=finish,page=0){
    const sequence={...entry,custom:true,show:index=>playStorySequence(entry,finish,leave,index)};
    return playStoryPage(sequence,page,entry.paragraphs[page],'',finish,leave);
  }
  function finishStoryReader(){
    if(!reader)return;const entry=reader;
    if(run.chronicle.read.includes(entry.id)||transact(N.readScene(run,entry.id))){reader=null;if(entry.exit){closeDialog();reachExit(true);}else if(entry.enter)closeDialog();else journal();}
    else readStory(entry.id,entry.enter,entry.page,entry.exit,true);
  }
  function readStory(id,enter=false,page=0,exit=false,continuation=false) {
    if(!N||!run)return;
    const entry=N.availableScenes(run).find(s=>s.id===id);if(!entry)return;
    page=Math.max(0,Math.min(entry.paragraphs.length-1,page));reader={id,page,enter,exit};
    const storyActions=(page?action('上一頁','story-prev'):'')+(page<entry.paragraphs.length-1?action('下一頁','story-next'):action(exit?'收進日誌，走向門後':enter?'收進日誌，繼續探索':'收進日誌','story-finish'))+action(exit?'暫留本層':'稍後在日誌閱讀','close');
    const recorded=id==='scene:99'?'story.scene99.'+(page+1):'';
    const echoes=page===entry.paragraphs.length-1&&S?S.echoesForScene(run,id):[];
    const after=echoes.flatMap(e=>[e.title,e.text]).join('。');
    const narration=[!continuation&&!recorded?entry.title:'',entry.paragraphs[page],after].filter(Boolean).join('。');
    if(playStoryPage(entry,page,narration,after?'':recorded,finishStoryReader,()=>{const browsing=!reader?.enter&&!reader?.exit;reader=null;if(browsing)journal();else closeDialog();},[entry.paragraphs[page],after].filter(Boolean).join('。')))return;
    dialog('倒轉高塔 · '+floorLabel(entry.floor)+' · '+(page+1)+' / '+entry.paragraphs.length,entry.title,'',prose([entry.paragraphs[page]])+echoCards(echoes),storyActions,{asset:recorded,afterText:after,text:narration});
  }
  function journal() {
    if(!N||!run||G.shifting)return;
    const unlocked=N.availableScenes(run),chapter=N.chapterForFloor(run.floor);
    const brief=N.brief?.(run),growth=window.TowerFieldGuide?.progression(run);
    const overview=brief?'<section class="adventure-brief"><div><small>目前線索</small><p>'+text(brief.recap)+'</p></div><div><small>接下來</small><p>'+text(brief.next)+'</p><small>'+text(brief.landmark)+'</small></div></section>':'';
    const milestone=growth?'<p class="field-guide-hint">主角 '+growth.level+' 級 · '+text(growth.next)+(growth.nextLevelXp!==null?' 距離升級還需 '+growth.remainingXp+' 經驗。':'')+'</p>':'';
    const entries=unlocked.slice().reverse().map(s=>'<article class="tower-journal-entry"><div><small>'+floorLabel(s.floor)+' · '+(run.chronicle.read.includes(s.id)?'已讀':'未讀')+'</small><h3>'+text(s.title)+'</h3></div>'+action('閱讀','story-read',s.id)+'</article>').join('');
    const chapters=run.floor<0?N.allChapters():N.CHAPTERS;
    const clues=chapters.filter(c=>run.chronicle.clues.includes(c.clueId));
    const history=(run.expedition?.history||[]).slice(-5).reverse().map(h=>'第 '+h.floor+' 層 · '+(sideStory(h.kind)?.title||{archive:'無聲信庫',bells:'逆時鐘室',lantern:'餘燼渡廊'}[h.kind])+' · '+({completed:'已完成',abandoned:'已退出',expired:'時間耗盡'}[h.outcome])).join('／');
    const collected=S?S.collectedStories(run):[],sideEntries='<h3 class="tower-section-title">旅途逸聞 '+collected.length+' / 6</h3><p class="tower-copy">完成劇情裂隙可留下永久手記；部分人物會在後續主線回應。不收集也能完成主線。</p>'+collected.map(s=>'<article class="tower-journal-entry"><div><small>'+text(s.title)+'</small><h3>'+text(s.record.title)+'</h3></div>'+action('重讀逸聞','side-story-read',s.kind)+'</article>').join('');
    dialog('旅人的手記 · '+run.chronicle.read.length+' / '+(run.floor<0?N.totalSceneCount():30)+' 幕',chapter.title,N.objective(run),overview+milestone+storyInsightCards()+'<section class="tower-guard-summary"><h3>歸途印記 '+clues.length+' / '+chapters.length+'</h3><p class="tower-clue-list">'+(clues.map(c=>'<span>'+(window.TowerResourceIcons?.svg('clue')||'')+text(c.clueName)+'</span>').join('')||'第一枚線索仍在塔中等待。')+'</p></section>'+sideEntries+entries+(history?'<p class="tower-copy">裂隙紀錄：'+text(history)+'</p>':''),action(active?'回到迷宮':'回首頁','close')+(run.chronicle.ending?action('閱讀地上篇結局','ending-read'):'')+(run.floor===-50&&run.status==='won'?action('閱讀地下篇結局','underworld-ending'):'')+(active?(inDungeon()?action('副本目標','dungeon-brief'):action('探索者委託','quest')):''),{full:true});
  }
  function storyInsightCards(){
    const notes=window.TowerStoryInsights?.journal(run);if(!notes)return '';
    const sources=rows=>rows.filter(Boolean).map(s=>action(floorLabel(s.floor)+' · '+s.title,'story-read',s.id)).join('');
    const threads=notes.threads.map(n=>'<article class="story-note"><small>'+text(n.status)+'</small><h4>'+text(n.title)+'</h4><p>'+text(n.text)+'</p><div class="story-note-sources">'+sources(n.sources)+'</div></article>').join('');
    const people=notes.characters.map(n=>'<article class="story-note"><h4>'+text(n.name)+'</h4><p>'+text(n.text)+'</p>'+(n.echo?'<aside><small>已收錄逸聞 · '+text(n.echo.title)+'</small><p>'+text(n.echo.text)+'</p>'+action('重讀逸聞','side-story-read',n.echo.kind)+'</aside>':'')+'<div class="story-note-sources">'+sources(n.sources)+'</div></article>').join('');
    const effects=AdventureEvents?.recollections?.(run)||[],recollections=effects.map(n=>'<article class="story-note"><small>'+floorLabel(n.floor)+' · '+text(n.status)+'</small><h4>'+text(n.title)+'</h4>'+(n.choiceLabel?'<p><b>當時的選擇：</b>'+text(n.choiceLabel)+'</p>':'')+'<p>'+text(n.consequence)+'</p>'+(n.next?'<p class="story-note-next">'+text(n.next)+'</p>':'')+'</article>').join('');
    const fold=(title,count,body,empty)=>'<details class="story-insights"><summary><span>'+text(title)+'</span><small>'+count+' 則 · 點開查看</small></summary><div class="story-insight-grid">'+(body||'<p>'+text(empty)+'</p>')+'</div></details>';
    return fold('把線索連起來',notes.threads.length,threads,'讀完故事並取得印記後，這裡會留下你已查明的線索。')+fold('同行者的心事',notes.characters.length,people,'認識旅途人物後，這裡會記下他們在意的事。')+(effects.length?fold('選擇留下的餘波',effects.length,recollections,''): '');
  }
  function canObserveLandmark(){return !!(active&&!inDungeon()&&landmark?.model&&window.TowerStoryInsights&&nearEntity(landmark,G.cell*1.4));}
  function observeLandmark(){if(!canObserveLandmark())return;const note=window.TowerStoryInsights.observation(run);if(!note)return;
    dialog('環境手記 · 只觀察，不消耗物資',note.title,'停下看看：景觀不隨牆壁變形，痕跡卻可能與旅途線索互相呼應。',prose(note.paragraphs)+'<p class="story-note-next">'+text(note.next)+'</p>',action('繼續探索','close')+action('故事日誌','journal'),{summary:note.paragraphs.join('。')});
  }
  function readSideStory(kind,page=0,source='record',continuation=false) {
    const story=sideStory(kind);if(!story||!['intro','record','outro'].includes(source))return;
    if(source==='intro'){if(!inDungeon()||run.expedition.active.kind!==kind)return;}
    else if(!S.collectedStories(run).some(s=>s.kind===kind))return;
    const paragraphs=source==='record'?story.record.paragraphs:story[source];
    page=Math.max(0,Math.min(paragraphs.length-1,page));sideReader={kind,page,source};
    const back=source==='intro'?action('回副本目標','dungeon-brief'):source==='outro'?action('繼續旅程','close'):action('回故事日誌','journal');
    const title=source==='record'?story.record.title:story.title;
    const finish=()=>{sideReader=null;if(source==='intro')dungeonBriefing();else if(source==='record')journal();else closeDialog();};
    if(playStoryPage({id:'side:'+kind+':'+source,title,paragraphs,floor:run.floor,environment:story.environmentId,side:true},page,[continuation?'':title,paragraphs[page]].filter(Boolean).join('。'),'',finish,finish,paragraphs[page]))return;
    dialog('旅途逸聞 · '+(page+1)+' / '+paragraphs.length,title,'',prose([paragraphs[page]]),(page?action('上一頁','side-prev'):'')+(page<paragraphs.length-1?action('下一頁','side-next'):'')+back,{text:[continuation?'':title,paragraphs[page]].filter(Boolean).join('。')});
  }
  function journeyMarker(label,tint,shape='clue') {
    const model=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:tint,emissive:tint,emissiveIntensity:.22});
    const mesh=new THREE.Mesh(shape==='rift'?new THREE.TorusGeometry(.82,.12,6,22):new THREE.OctahedronGeometry(.44),material);mesh.position.y=1.15;model.add(mesh);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.55,.68,.18,8),new THREE.MeshLambertMaterial({color:0x415564}));base.position.y=.1;model.add(base);
    model.add(makePickupMarker(tint,label));model.userData.role=shape;model.userData.icon=mesh;return model;
  }
  function buildJourneyWorld(random,used) {
    // Every optional object reserves its cell whether or not it appears this time,
    // so finishing a rift, taking a clue or ending a commission never moves the
    // rest of the floor (or revives a disarmed trap somewhere else) after a reload.
    if(N){const chapter=N.chapterForFloor(run.floor),cluePoint=run.floor<=chapter.mid?chooseCell(random,used):null;if(cluePoint&&!run.chronicle.clues.includes(chapter.clueId)){const point=cluePoint,model=journeyMarker('主線・'+chapter.clueName,0xffdf83);model.position.set(point.x,0,point.z);world.add(model);mainClue={...point,model};}}
    const offer=D&&D.offer(run),riftPoint=chooseCell(random,used);
    if(offer){const point=riftPoint,model=journeyMarker('裂隙・'+offer.title,0x7fe2db,'rift');model.position.set(point.x,0,point.z);model.visible=run.expedition.discovered;world.add(model);rift={...point,model,offer};}
  }
  function nearEntity(item,distance=2.6) { return !!(item&&item.model.visible&&Math.hypot(G.px-item.model.position.x,G.pz-item.model.position.z)<distance&&hasClearPath(G.px,G.pz,item.model.position.x,item.model.position.z)); }
  function updateJourneyNearby() {
    nearbyJourney=[mainClue,rift,huntGate,...dungeonObjects].filter(item=>nearEntity(item)).sort((a,b)=>Math.hypot(G.px-a.x,G.pz-a.z)-Math.hypot(G.px-b.x,G.pz-b.z))[0]||null;
    if(nearbyJourney&&[nearest,nearestWarrior,nearbyEncounter].some(item=>item&&Math.hypot(G.px-item.model.position.x,G.pz-item.model.position.z)<Math.hypot(G.px-nearbyJourney.x,G.pz-nearbyJourney.z)))nearbyJourney=null;
  }
  function mainClueDialog(presented=false) {
    if(!N||inDungeon()||!nearEntity(mainClue))return;
    const chapter=N.chapterForFloor(run.floor);
    if(!presented&&presentMoment({key:'clue:'+chapter.clueId,target:mainClue.model,height:1.8,title:chapter.clueName,text:'你找到了'+chapter.clueName+'。它正回應你的聲音。看看它留下了什麼線索。',done:()=>mainClueDialog(true)}))return;
    if(!transact(N.collectClue(run)))return;
    mainClue.model.visible=false;nearbyJourney=null;
    const scene=N.scenesForFloor(chapter.mid).find(entry=>!run.chronicle.read.includes(entry.id));
    if(scene){readStory(scene.id,true);return;}
    dialog('主線更新 · 歸途印記',chapter.clueName,N.objective(run),prose(chapter.clueText),action('繼續前進','close')+action('故事日誌','journal'));
  }
  function dungeonOrder(offer) { return offer.order.map(i=>sideStory(offer.kind)?.steps[i].title||['晨光','正午','星夜'][i]).join(' → '); }
  function dungeonHint(offer) {
    if(offer.hunt)return '目前 '+huntTally(offer)+' / '+offer.required.length+'。完成後回到出口領取報酬；隊友一同作戰。';
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
    dialog('裂隙副本 · '+run.floor+' 層之外',offer.title,offer.description,'<section class="tower-guard-summary"><h3>'+text(offer.objective)+'</h3><p>'+text(dungeonHint(offer))+'</p></section>'+difficultyFacts(offer)+'<p class="tower-copy">剩餘 '+Math.ceil(Math.max(0,offer.timeLimit-run.expedition.active.elapsed))+' 秒；暫停與變形時不計時。沒有普通物資，也不推進原層委託。裝備和補給照常消耗，'+(modern()?'四人隊伍一同探索。':'護衛留在原層等候。')+'中途退出不領獎。</p>',action('開始探索','close')+(sideStory(offer.kind)?action('閱讀副本故事','side-story-intro',offer.kind):'')+action('退出副本','dungeon-leave'),{summary:offer.title+'。'+offer.objective+'。'+dungeonHint(offer)+(offer.tier?'。試煉強度 '+offer.tier+'，注意會發亮的地面機關。':'')});
  }
  function difficultyFacts(offer) {
    if(offer.hunt)return '<p class="tower-copy">討伐強度 '+offer.tier+' / 5 · '+offer.size+' × '+offer.size+' · '+offer.count+' 隻怪物 · 每 '+offer.shiftSeconds+' 秒變形。'+(offer.champion!==null?'首領頭戴金冠。':offer.carriers.length?'帶晶的怪物頭上有發光的裂晶。':'')+'</p>';
    return offer.tier?'<p class="tower-copy">試煉強度 '+offer.tier+' / 5 · '+offer.size+' × '+offer.size+' · 每 '+offer.shiftSeconds+' 秒變形 · 最多 '+offer.trapCount+' 處機關。琥珀色閃動是預警：先退開，等機關收起再通過。藤蔓會拖慢腳步，防具可抵禦其他陷阱。</p>':'';
  }
  function riftDialog(presented=false) {
    if(inDungeon()||!nearEntity(rift))return;
    const offer=rift.offer;
    if(!presented&&presentMoment({key:'rift:'+offer.kind,target:rift.model,height:2.1,title:offer.title,text:offer.description,done:()=>riftDialog(true)}))return;
    dialog('隨機奇遇 · 裂隙副本',offer.title,offer.description,'<section class="tower-guard-summary"><h3>'+text(offer.objective)+'</h3><p>獨立 '+offer.size+' × '+offer.size+' 小迷宮 · '+offer.timeLimit+' 秒 · 每 '+offer.shiftSeconds+' 秒變形</p></section><p class="tower-copy">完成可獲銅幣與補給或強化裝備。'+(sideStory(offer.kind)?'另收錄永久旅途逸聞，部分會在主線與結局得到回應；不影響主線通關資格。':'')+(modern()?'四人隊伍隨行，委託留在原層；':'任務與護衛留在原層；')+'結束回到入口所在格。原層迷宮重新排列，但已拾取物不重生。每層裂隙只能挑戰一次。</p>',action('暫不進入','close')+action('進入副本','dungeon-enter',offer.id),{silent:presented,summary:offer.title+'。'+offer.objective+'。完成後領取報酬，結束回到原層。'});
  }
  function huntDialog(){
    if(inDungeon()||!nearEntity(huntGate))return;
    const offer=huntGate.offer,party=1+(run.party?.members?.filter(m=>m.hp>0).length||0);
    dialog('隨機奇遇 · 討伐裂隙',offer.title,offer.description,'<section class="tower-guard-summary"><h3>'+text(offer.objective)+'</h3><p>獨立 '+offer.size+' × '+offer.size+' 小迷宮 · '+offer.count+' 隻怪物 · '+offer.timeLimit+' 秒 · 強度 '+offer.tier+' / 5</p></section><p class="tower-copy">隊伍 '+party+' 人一同進入。裂隙裡的怪物不掉落物品，經驗為一般的一半；完成後回到出口領取 '+offer.reward.coins+' 銅幣與補給（'+rewardDescription(offer.reward)+'）。倒下會照一般失敗處理；中途退出不領獎，這一層也不能再進入。</p>',action('先不要','close')+action('進入討伐','hunt-enter',offer.id));
  }
  function enterHunt(id){
    if(!D||inDungeon()||G.shifting||!nearEntity(huntGate))return;
    syncEngine();const cell=worldToCell(G.px,G.pz),result=D.enter(run,id,{x:cell.x,y:cell.y,shiftLeft:Math.max(0,shiftLeft)},run.revision);
    if(!transact(result))return;loadFloor(false);
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
    syncEngine();const result=D.interact(run,index,run.revision,{choice,invulnerable:hurtLeft>0});if(!transact(result))return;
    refreshDungeonObjects();closeDialog();
    if(run.status==='dead'){defeat();return;}
    showToast(result.message||'記憶已經亮起。',3000);
    if(run.expedition.active.progress.length===3)showToast('副本目標完成！趕在時間內找到出口領取報酬。',3500);
  }
  let dungeonClock=0;
  function tickDungeon(dt,now) {
    // The clock is committed four times a second: each commit is a full validated transaction, far too costly per frame.
    dungeonClock+=dt;
    if(dungeonClock>=.25){const seconds=dungeonClock;dungeonClock=0;const result=D.tick(run,seconds);if(!result.ok)return;run=result.run;
      if(result.effect?.expired){finishDungeon('expired');return;}}
    nearbyEncounter=nearest=nearestWarrior=null;updateJourneyNearby();
    for(const item of dungeonObjects)if(item.rotate)item.icon.rotation.y+=dt*.35;
    if(run.effects.reveal>0)G.mapUntil=now+250;
    hudClock+=dt;if(hudClock>.15){hudClock=0;updateHud();}
    saveClock+=dt;if(saveClock>3){saveClock=0;save();}
  }
  function leaveDungeonDialog() {
    if(!inDungeon())return;
    dialog('退出副本確認',huntActive()?'放棄這次討伐？':'放下這段未完成的記憶？','退出後回到原層，不會領取獎勵，也不能在同一層重開這個副本。','',action('繼續挑戰','close')+action('確認退出副本','dungeon-abandon'));
  }
  function finishDungeon(outcome) {
    dungeonClock=0;
    if(!inDungeon())return;
    syncEngine();const offer=dungeonOffer(),title=offer.title,story=sideStory(offer.kind),result=D.finish(run,outcome,run.revision);
    if(!result.ok){dialog('副本尚未結算','請先整理背包',result.message,'',action('整理背包','bag')+action('放棄報酬並退出','dungeon-leave'));return;}
    if(!transact(result)){dialog('副本尚未保存','請重試保存結算','這次結算尚未生效，報酬不會重複領取。副本倒數已暫停，請保持分頁開啟。','',action('重試保存','dungeon-settle',outcome));return;}
    floorStarted=false;loadFloor(false,true);
    const cell=result.effect.returnCell,p=cellToWorld(cell.x,cell.y);G.px=p.x;G.pz=p.z;playerGroup.position.set(p.x,0,p.z);shiftLeft=result.effect.returnShift;exitDeclined=true;restoreWarriorPosition();partyUI?.regroup?.();
    if(explorer&&run.adventure.quest?.type==='escort')explorer.model.position.set(p.x,0,p.z);
    save();updateHud();
    dialog('回到第 '+run.floor+' 層',outcome==='completed'?title+' · 記憶歸還':outcome==='expired'?'裂隙的時間已盡':'你離開了裂隙',outcome==='completed'?'副本報酬：'+rewardDescription(result.effect.reward):'這次沒有帶出報酬。你的旅程仍能繼續，消耗的裝備與補給不會重置。',(outcome==='completed'&&story?'<aside class="tower-story-echo"><small>永久逸聞已收錄 · '+text(story.record.title)+'</small><p>'+text(story.outro[0])+'</p></aside>':'')+'<p class="tower-copy">原層任務與主線保留；已拾取物、商店庫存與已擊敗怪物不重生。</p>',action('繼續旅程','close')+(outcome==='completed'&&story?action('閱讀副本後記','side-story-outro',story.kind):'')+action('整理裝備','bag'),{silent:outcome==='completed',summary:outcome==='completed'?title+'。副本完成。'+rewardSpeech(result.effect.reward):'你離開了裂隙。這次沒有帶出報酬，旅程仍能繼續。'});
    if(outcome==='completed')window.GameVoice?.announce(rewardSpeech(result.effect.reward),true);
  }
  function mapMarkers() {
    if(!active)return [];
    return [...[mainClue,rift,huntGate,...dungeonObjects].filter(o=>o&&o.model.visible).map(o=>({cx:o.cx,cy:o.cy,label:o===mainClue?'印':o===rift?'裂':o===huntGate?'獵':String(o.index+1),color:o===mainClue?'#ffe295':o===rift?'#8ee5df':o===huntGate?'#ff9a78':run.expedition.active.progress.includes(o.index)?'#83e7ae':'#edc789'})),...[eventMarker,followupMarker,...counterObjects].filter(o=>o?.model.visible).map(o=>({cx:o.cx,cy:o.cy,label:o===eventMarker?'選':o===followupMarker?'信':run.floor===80?'藤':'晶',color:'#bcd991',beacon:counterObjects.includes(o)})),
      // Survey commission blocks still to visit: beacons, so they show through the fog.
      ...(inDungeon()?[]:(E.surveyTargets?.(run)||[]).map(t=>({cx:t.x,cy:t.y,label:'測',color:'#ffd27a',beacon:true}))),...(partyUI?.markers()||[])];
  }
  function buildTowerEnvironment() {
    if (envGroup) { disposeSceneObject(envGroup); scene.remove(envGroup); }
    envGroup = new THREE.Group(); envGroup.userData.anim = []; scene.add(envGroup);
    const [sky,wall,ground,accent,feature] = environmentSpec(); scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 28, Math.max(75, floorConfig.size * 5));
    envGroup.add(new THREE.HemisphereLight(0xd6edff, 0x5f5366, 0.85));
    envGroup.add(new THREE.AmbientLight(0xffffff, 0.42));
    const sun = new THREE.DirectionalLight(0xffe4b3, 0.8); sun.position.set(-15, 28, 14); envGroup.add(sun);
    lightingRig=null;
    if(run.party?.light&&window.TowerLighting){
      const light=window.TowerLighting.profile(floorConfig.environmentId,floorConfig.underworld===true);
      scene.background.setHex(light.sky);scene.fog.color.setHex(light.sky);
      envGroup.children[0].intensity=light.hemi;envGroup.children[1].intensity=light.ambient;sun.intensity=light.sun;
      // Lava cracks remain a faint landmark, not a full-floor light source.
      floorMesh.material.emissiveIntensity=.035;
      lightingRig={fog:scene.fog};
    }
    wallMesh.material.color.setHex(wall);
    floorMesh.material.color.setHex(ground);
    const span = G.mazeW * G.cell;
    // Keep the tower shell open: a solid cylinder cap would cover the recessed stairs.
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(span * 0.75, span * 0.77, floorConfig.underworld?18:3, 12, 1, true), new THREE.MeshLambertMaterial({color:floorConfig.underworld?wall:0x31495d, side: THREE.DoubleSide}));
    rim.position.y = floorConfig.underworld?6:-1.65;envGroup.add(rim);
    // An open vault keeps the free camera usable; rock teeth stay outside the
    // playable maze and reuse the chapter material, never blocking a corridor.
    if(floorConfig.underworld){
      const rockMaterial=new THREE.MeshLambertMaterial({color:wall}),rockGeo=new THREE.ConeGeometry(2,6,5);
      for(let i=0;i<10;i++){const angle=i/10*Math.PI*2,rock=new THREE.Mesh(rockGeo,rockMaterial);rock.position.set(Math.cos(angle)*span*.69,10,Math.sin(angle)*span*.69);rock.rotation.z=Math.PI;rock.scale.setScalar(.7+(i%3)*.15);envGroup.add(rock);}
    }
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
  function openExplorationPassage(point,inspect=false){
    if(!active||inDungeon()||G.shifting)return false;
    const candidates=G.wallBoxes.filter(w=>!w.boundary&&['h','v'].includes(w.type)).map(w=>({w,d:Math.hypot((w.minX+w.maxX)/2-point.x,(w.minZ+w.maxZ)/2-point.z)})).filter(v=>v.d<G.cell*.7).sort((a,b)=>a.d-b.d);
    if(inspect)return !!candidates[0];
    if(candidates[0]){removeWallBox(candidates[0].w);AudioEng.sfxBreak();}
    if(run.effects.reveal>0){const c=worldToCell(G.px,G.pz);G.solutionPath=solveMaze(c.x,c.y);}
    return !!candidates[0];
  }
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
    clearBolts();clearTagTextures();
    partyUI?.reset();
    hazards=[];hazardSlow=1;hazardGrace=3;
    loot = []; monsters = []; traders = []; nearest = null; warriorNpc = nearestWarrior = escort = null;
    explorer=chest=relic=nearbyEncounter=null;lastSurveyCell='';exitDeclined=false;
    world = new THREE.Group(); scene.add(world);
    environmentLife?.destroy();
    environmentLife=window.TowerEnvironmentLife?.create(THREE,{world:()=>world,style:environmentSpec()[4],seed:floorSeed(),player:()=>({x:G.px,z:G.pz}),visible:(x,z)=>!window.MazeSight?.active()||MazeSight.visible(x,z),clear:hasClearPath,reduced:()=>!!reducedMotion?.matches,quality:()=>window.MazeQuality?.mode()});
    mainClue=rift=huntGate=nearbyJourney=null;dungeonObjects=[];exploredCells=new Set();
    landmark=null;eventMarker=followupMarker=nearbyAdventure=null;counterObjects=[];lordCounterNotice=false;
    const random = mulberry32(floorSeed() ^ 0x712da), used = new Set(['0,0', G.exitCell.x + ',' + G.exitCell.y]);
    landmark=Landmarks?.plan(run,G.mazeW)||null;
    if(landmark){for(const c of landmark.cells)used.add(c.x+','+c.y);const model=Landmarks.build(THREE,landmark,G.cell),center=cellPoint(landmark.center.x,landmark.center.y);model.position.set(center.x,0,center.z);world.add(model);landmark.model=model;}
    const originalPickups = [...(G.items||[]), ...(G.foods||[])];
    for(const item of originalPickups){const c=worldToCell(item.x,item.z);used.add(c.x+','+c.y);}
    if(huntActive()){buildHuntWorld(random,used);partyUI?.build(random,used);lightingUI?.build(random,used);return;}
    if(inDungeon()){buildDungeonWorld(random,used);lightingUI?.build(random,used);buildHazards(used);return;}
    for (const offer of E.merchantOffers(run.floor,run.seed,modern())) {
      const point = chooseCell(random, used);
      const model = V.buildMerchant(offer.id,{THREE,CHARS,buildCharacter});model.position.set(point.x,0,point.z);
      const name = offer.title+'・'+offer.name,tag=makeTextSprite(name);tag.position.y=2.6;tag.scale.set(2.7,.5,1);model.add(tag);
      world.add(model);traders.push({...point,model,name,id:offer.id,offer});
    }
    const partyMonsters=run.party?P.monsterSpecs(run):null;
    for (let i = 0; i < (partyMonsters?partyMonsters.length:floorConfig.monsterCount); i++) {
      const kind = partyMonsters?partyMonsters[i].kind:run.floor<=54&&i===floorConfig.monsterCount-1?'shardseer':floorConfig.monsterTypes[i % floorConfig.monsterTypes.length], def = partyMonsters?partyMonsters[i].def:C.MONSTERS[kind];
      const spec=partyMonsters?.[i],strength = spec?spec.strength:C.monsterStrength(kind, run.floor), id = spec?.id||'monster-' + i;
      let point = spec?.reinforcement?cellPoint(spec.cx,spec.cy):chooseCell(random, used, Math.min(7, floorConfig.size - 1));
      if(spec?.reinforcement){
        if(landmark?.cells.some(c=>c.x===point.cx&&c.y===point.cy)){
          point=chooseCell(random,used,2);const saved=run.party.reinforcements.monsters.find(m=>m.id===spec.id);if(saved){saved.cx=point.cx;saved.cy=point.cy;}
        }
        used.add(point.cx+','+point.cy);
      }
      const model = monsterModel(kind, strength, def);if(spec?.elite)markMiniLord(model);
      const alive = !run.defeatedMonsters.includes(id);
      model.position.set(point.x, 0, point.z); model.visible = alive; model.userData.monsterId=id; world.add(model);
      monsters.push({ ...point, id, strength, kind, def, model, alive,lord:!!spec?.lord,elite:!!spec?.elite,maxHp:spec?.maxHp, path: [], pathLeft: i * .15, windup: 0, cooldown: 2, phase: i,voiceEvents:new Set() });
    }
    if(!run.party)buildWarriors(used);
    const chestOffer=E.chestOffer(run.floor,run.seed,modern());
    if(chestOffer){const point=chooseCell(random,used),model=V.buildChest({THREE});model.position.set(point.x,0,point.z);model.visible=!run.adventure.claimed.includes(chestOffer.id);world.add(model);chest={...point,offer:chestOffer,model};}
    const explorerOffer=E.explorerOffer(run),explorerPoint=chooseCell(random,used);
    if(explorerOffer){const identity=explorerOffer.explorer||{id:'eve',name:'伊芙',title:'探索者'},point=explorerPoint,model=V.buildExplorer(identity.id,{THREE,CHARS,buildCharacter});model.position.set(point.x,0,point.z);if(run.adventure.quest?.type==='escort'&&run.adventure.quest.status==='active')model.position.set(G.px,0,G.pz);const tag=makeTextSprite(identity.title+'・'+identity.name);tag.position.y=2.6;model.add(tag);world.add(model);explorer={...point,offer:explorerOffer,model,path:[],pathLeft:0};}
    // 尋物目標獨立於消耗物資，種子固定，讀檔或變形不會重抽。
    const point=chooseCell(random,used),model=new THREE.Group();model.position.set(point.x,0,point.z);
    const cache=V.buildChest({THREE});cache.scale.setScalar(.65);model.add(cache);model.name='quest-relic-cache';
    model.visible=!!(run.adventure.quest&&run.adventure.quest.type==='relic'&&run.adventure.quest.status==='active');world.add(model);relic={...point,model};
    buildJourneyWorld(random,used);
    partyUI?.build(random,used);
    lightingUI?.build(random,used);
    buildHazards(used);
    restoreDrops();
    buildForaging(used);
    buildAdventureWorld(random,used);
    buildHuntGate(random,used);
  }
  function buildHuntGate(random,used){
    const offer=D?.huntOffer?.(run);if(!offer||inDungeon())return;
    const point=chooseCell(random,used,3),model=journeyMarker('討伐・'+offer.title.replace('討伐裂隙・',''),0xff8f6b,'rift');model.position.set(point.x,0,point.z);model.name='hunt-rift-gate';world.add(model);huntGate={...point,model,offer};
  }
  function buildHuntWorld(random,used){
    const specs=P.monsterSpecs(run);
    specs.forEach((spec,i)=>{
      const point=chooseCell(random,used,Math.min(4,floorConfig.size-1)),model=monsterModel(spec.kind,spec.strength,spec.def);
      if(spec.champion)markMiniLord(model);if(spec.carrier)markCarrier(model);
      const alive=!run.defeatedMonsters.includes(spec.id);model.position.set(point.x,0,point.z);model.visible=alive;model.userData.monsterId=spec.id;world.add(model);
      monsters.push({...point,id:spec.id,strength:spec.strength,kind:spec.kind,def:spec.def,model,alive,lord:false,elite:!!spec.elite,hunt:true,maxHp:spec.maxHp,path:[],pathLeft:i*.15,windup:0,cooldown:2,phase:i,voiceEvents:new Set()});
    });
  }
  // A crystal carrier glows with a floating shard above its name.
  let shardParts=null;
  function markCarrier(model){
    if(!shardParts){shardParts={shape:new THREE.OctahedronGeometry(.16),glow:new THREE.MeshBasicMaterial({color:0x8ff3ff})};for(const part of Object.values(shardParts))part.userData={...part.userData,sharedResource:true};}
    const shard=new THREE.Mesh(shardParts.shape,shardParts.glow);shard.name='hunt-carrier-shard';shard.position.y=2.75;shard.scale.y=1.6;model.add(shard);model.userData.carrier=true;return model;
  }
  function prepareMaze(maze,start){return active&&!inDungeon()&&Landmarks?Landmarks.prepareMaze(run,maze,start):maze;}
  function buildAdventureWorld(random,used){
    if(!AdventureEvents||!run.party||inDungeon())return;
    for(const cell of occupiedCells())used.add(cell);
    const state=AdventureEvents.ensure(run),offer=AdventureEvents.offer(run);
    const marker=(cx,cy,label,tint)=>{const point=cellPoint(cx,cy),model=journeyMarker(label,tint);model.position.set(point.x,0,point.z);world.add(model);return {...point,model};};
    if(landmark&&offer){eventMarker=marker(landmark.x,landmark.y,offer.name,0xa3d38d);eventMarker.model.visible=state.current.choice===null;eventMarker.offer=offer;}
    if(landmark&&state.chain?.status==='active'&&state.chain.targetFloor===run.floor)followupMarker=marker(landmark.x+2,landmark.y+2,AdventureEvents.KINDS[state.chain.kind].person+'的留言',0xdccc90);
    const lord=monsters.find(m=>m.lord);
    if(state.lord&&lord)for(let i=0;i<state.lord.broken.length;i++){
      let point;if(run.floor===60){const near=[];for(let y=0;y<G.mazeH;y++)for(let x=0;x<G.mazeW;x++)if(!used.has(x+','+y)){const p=cellPoint(x,y),d=Math.hypot(p.x-lord.x,p.z-lord.z);if(d>=G.cell*.8&&d<=G.cell*2.1)near.push({p,d});}near.sort((a,b)=>a.d-b.d);point=near.find(v=>hasClearPath(lord.x,lord.z,v.p.x,v.p.z))?.p||near[0]?.p;}
      if(run.floor===80)point=gardenVinePoint(lord,used,counterObjects[0]);
      point=point||chooseCell(random,used,4);used.add(point.cx+','+point.cy);
      const model=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:run.floor===80?0x78a768:0x89d6e1,emissive:run.floor===80?0x345e32:0x498498,emissiveIntensity:.15});
      if(run.floor===80){for(let j=0;j<3;j++){const vine=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,1.4,6),material);vine.position.set((j-1)*.22,.7,0);vine.rotation.z=(j-1)*.22;model.add(vine);}const bud=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),material);bud.position.y=1.6;model.add(bud);}
      else{const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.65,0),material);crystal.position.y=1.05;crystal.scale.y=1.65;model.add(crystal);}
      model.position.set(point.x,0,point.z);model.name='lord-counter-'+i;world.add(model);counterObjects.push({...point,model,index:i});
    }
    refreshAdventureWorld();
  }
  // The garden queen's two vines grow around her starting ground (1.2-3.2 cells away), the second on the
  // far side from the first where possible, so the shield fight stays in one place instead of a chased
  // search of the whole maze.
  function gardenVinePoint(lord,used,first){
    const ring=[];for(let y=0;y<G.mazeH;y++)for(let x=0;x<G.mazeW;x++)if(!used.has(x+','+y)){const p=cellPoint(x,y),d=Math.hypot(p.x-lord.x,p.z-lord.z);if(d>=G.cell*1.2&&d<=G.cell*3.2)ring.push({p,d,a:Math.atan2(p.x-lord.x,p.z-lord.z)});}
    const order=(a,b)=>a.d-b.d||a.p.cx-b.p.cx||a.p.cy-b.p.cy;if(!first)return ring.sort(order)[0]?.p||null;
    const from=Math.atan2(first.x-lord.x,first.z-lord.z),away=v=>{const d=Math.abs(v.a-from)%(Math.PI*2);return Math.min(d,Math.PI*2-d);};
    return ring.sort((a,b)=>away(b)-away(a)||order(a,b))[0]?.p||null;
  }
  function refreshAdventureWorld(){
    const s=run.adventure?.events;if(!s)return;
    if(eventMarker)eventMarker.model.visible=s.current?.choice===null;
    if(followupMarker)followupMarker.model.visible=s.chain?.status==='active'&&s.chain.targetFloor===run.floor;
    for(const item of counterObjects){item.model.visible=s.lord?.phase==='guarded'&&!s.lord.broken[item.index];const glow=s.lord?.armed>0?.65:.15;if(item.glow!==glow){item.glow=glow;item.model.traverse(o=>{if(o.isMesh)o.material.emissiveIntensity=glow;});}}
    if(s.lord?.phase==='guarded'&&!lordCounterNotice){lordCounterNotice=true;showToast(run.floor===80?'園后的根盾亮起了！斬斷她身旁的兩根供能藤（小地圖「藤」）。':'伯爵的晶罩亮起了！轉動晶柱，引晶光擊中它。',4200);AudioEng.sfxAction?.('barrier');}
    // The shield itself is visible on the lord: a tinted dome while guarded, gone once exposed.
    const guardedLord=monsters.find(m=>m.lord&&m.alive),notice=AdventureEvents.guardNotice?.(run);
    if(guardedLord){let dome=guardedLord.model.getObjectByName('lord-guard-dome');if(notice&&!dome){dome=new THREE.Mesh(new THREE.SphereGeometry(1.45,14,10),new THREE.MeshBasicMaterial({color:notice.color,transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide}));dome.name='lord-guard-dome';dome.position.y=1.05;guardedLord.model.add(dome);}if(dome)dome.visible=!!notice;}
    nearbyAdventure=[eventMarker,followupMarker,...counterObjects].find(o=>o?.model.visible&&Math.hypot(G.px-o.x,G.pz-o.z)<2.6&&hasClearPath(G.px,G.pz,o.x,o.z))||null;
  }
  function adventureDialog(){
    const item=nearbyAdventure;if(!item||!item.model.visible)return;
    if(item===eventMarker){const o=item.offer;dialog('迷宮小事件 · 兩種選擇都可繼續',o.name,o.copy,'<p class="tower-copy">'+AdventureEvents.svg(o.kind)+(landmark?Landmarks.svg(landmark.kind):'')+'景觀不隨移牆改變。</p><div class="tower-grid">'+o.choices.map(c=>'<article class="tower-item"><h3>'+text(c.label)+'</h3><p>'+text(c.description)+'</p></article>').join('')+'</div>',o.choices.map((c,i)=>action(c.label,'adventure-choice',o.id+':'+i)).join('')+action('稍後再選','close'),{full:true});return;}
    if(item===followupMarker){if(transact(AdventureEvents.inspect(run))){refreshAdventureWorld();questDialog(false,true);}return;}
    if(run.floor===80){if(transact(AdventureEvents.counter(run,item.index))){AudioEng.sfxBreak();refreshAdventureWorld();closeDialog();}return;}
    if(transact(AdventureEvents.armCounter(run))){AudioEng.sfxAction?.('mechanism');refreshAdventureWorld();closeDialog();showToast('躲在晶柱後方，讓伯爵的晶光打中晶柱！',3600);}
  }
  function followupPanel(){
    const q=AdventureEvents?.brief(run);if(!q)return false;
    dialog('旅途後續 · 不影響主線',q.name,q.copy,AdventureEvents.svg(q.kind)+'<section class="tower-guard-summary"><h3>接下來</h3><p>'+text(q.next)+'</p><p>'+text(AdventureEvents.KINDS[q.kind].reward)+'</p></section>',action('繼續探索','close')+(q.status==='ready'?action('領取答謝','adventure-claim'):'')+action('放下這次委託','adventure-abandon')+(run.adventure.quest&&run.adventure.quest.status!=='claimed'?action('本層委託','quest-local'):'')+(run.adventure.events.lord?.phase==='guarded'?action('樓主場景提示','adventure-lord-help'):''),{summary:q.name+'。'+q.next});return true;
  }
  function lordCounterPanel(){
    const state=run.adventure?.events?.lord;if(state?.phase!=='guarded')return false;
    const garden=state.floor===80,copy=garden?'根盾正在保護園后。兩根供能藤長在她附近，小地圖以「藤」標示；靠近亮起的藤，點對話斬斷，兩根都斬斷後再攻擊園后。':'晶罩正在保護伯爵。靠近晶柱點對話轉向，亮光期間繞到它後面，引伯爵的晶光擊中晶柱；若晶柱熄滅，再轉一次。';
    dialog('樓主場景 · 先觀察再進攻',garden?'斬斷供能藤':'借晶光破晶罩',copy,AdventureEvents.svg(garden?'rootCounter':'crystalCounter')+'<p class="tower-copy">'+(garden?'已斬斷 '+state.broken.filter(Boolean).length+' / 2 根供能藤。':'躲在晶柱後方，而不是站在伯爵與晶柱之間。')+'</p>',action('繼續作戰','close')+(AdventureEvents.brief(run)?action('旅途後續','adventure-followup'):'')+(run.adventure.quest&&run.adventure.quest.status!=='claimed'?action('本層委託','quest-local'):''),{summary:copy});return true;
  }
  function buildForaging(used){
    if(!run.party||!partyUI||inDungeon())return;
    const excluded=new Set([...used,...occupiedCells()]);
    for(const spec of Foraging.plan(run,G,{excludeCells:excluded})){
      const center=cellPoint(spec.cx,spec.cy),point={...center,x:center.x+spec.offsetX*G.cell,z:center.z+spec.offsetY*G.cell},model=new THREE.Group();
      model.name='floor-'+spec.kind;model.userData.foragingId=spec.id;model.position.set(point.x,0,point.z);
      const icon=spec.kind==='power'?powerStoneModel(spec.key,spec.quantity):spec.kind==='herb'?partyUI.ingredientModel(spec.key):partyUI.materialModel(spec.key);
      icon.scale.setScalar(spec.kind==='herb'?.8:.7);icon.position.y=spec.kind==='herb'?.23:.2;model.add(icon);
      const bed=new THREE.Mesh(new THREE.CylinderGeometry(.32,.38,.07,7),new THREE.MeshLambertMaterial({color:spec.kind==='herb'?0x665844:0x787a78}));bed.position.y=.035;model.add(bed);
      world.add(model);loot.push({...point,id:spec.id,kind:'foraging',foraging:spec,model,icon,retry:0});
    }
  }
  function powerStoneModel(key,quantity=1){
    const group=new THREE.Group(),hex=Heroes.ROBOT.FUEL_ITEMS[key]?.color||'#48a8ff';group.name='power-stone-cluster';
    for(let i=0;i<quantity;i++){const mat=new THREE.MeshLambertMaterial({color:hex,emissive:hex,emissiveIntensity:.6}),stone=new THREE.Mesh(new THREE.OctahedronGeometry(.28,0),mat);stone.position.set((i-1)*.23,.2+(i%2)*.08,(i%2)*.17);stone.scale.set(.8,1.35,.8);stone.rotation.z=(i-1)*.2;group.add(stone);}return group;
  }
  // The healing draught on the floor: a round red flask with a cork and a white
  // cross, matching the bag icon. (The 🧴 emoji sprite was the grab mode's
  // laundry detergent bottle.) Owned meshes, released with the drop.
  // Floor drops of every potion share this bottle, tinted by kind.
  const POTION_TINTS={heal:[0xe2384f,0x8a1424],heal_mid:[0xff5f2e,0x8a2a10],heal_high:[0xff3f9a,0x8a1050],spirit:[0x4f9df0,0x123e7a],haste_strong:[0xffcf3a,0x8a6410],arcane:[0xa77bff,0x3c2280],courage:[0xff7a2e,0x8a3410],forget:[0x5fd8c0,0x1c6458]};
  function potionModel(key='heal'){
    const tint=POTION_TINTS[key]||POTION_TINTS.heal,group=new THREE.Group();group.name='healing-draught';group.userData.potion=key;
    const glass=new THREE.MeshPhongMaterial({color:0xd8f0ff,transparent:true,opacity:.38,shininess:90,specular:0xffffff,depthWrite:false}),liquid=new THREE.MeshLambertMaterial({color:tint[0],emissive:tint[1],emissiveIntensity:.45}),cork=new THREE.MeshLambertMaterial({color:0x9a6b43}),band=new THREE.MeshLambertMaterial({color:0xe8c66a});
    const body=new THREE.Mesh(new THREE.SphereGeometry(.26,16,12),glass);body.position.y=.26;body.renderOrder=2;
    const fill=new THREE.Mesh(new THREE.SphereGeometry(.215,14,10,0,Math.PI*2,Math.PI*.32,Math.PI*.68),liquid);fill.position.y=.26;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.18,12,1,true),glass);neck.position.y=.58;neck.renderOrder=2;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.085,.018,6,14),band);ring.rotation.x=Math.PI/2;ring.position.y=.5;
    const stopper=new THREE.Mesh(new THREE.CylinderGeometry(.07,.062,.12,10),cork);stopper.position.y=.71;
    group.add(fill,body,neck,ring,stopper);
    // Healing draughts carry a white cross; the others stay plain.
    if(key.startsWith('heal')){const mark=new THREE.MeshBasicMaterial({color:0xffffff});for(const [w,h]of [[.15,.045],[.045,.15]]){const bar=new THREE.Mesh(new THREE.BoxGeometry(w,h,.012),mark);bar.position.set(0,.27,.255);group.add(bar);}}
    return group;
  }
  function repositionForaging(){
    if(!run.party||inDungeon())return;
    const excluded=new Set(occupiedCells(false));
    for(const monster of monsters.filter(m=>m.alive)){const c=worldToCell(monster.model.position.x,monster.model.position.z);excluded.add(c.x+','+c.y);}
    const plan=new Map(Foraging.plan(run,G,{excludeCells:excluded}).map(spec=>[spec.id,spec]));
    for(const item of loot.filter(item=>item.foraging)){
      const spec=plan.get(item.id);item.model.visible=!!spec;if(!spec)continue;
      const center=cellPoint(spec.cx,spec.cy);Object.assign(item,{cx:spec.cx,cy:spec.cy,x:center.x+spec.offsetX*G.cell,z:center.z+spec.offsetY*G.cell,foraging:spec});item.model.position.set(item.x,0,item.z);
    }
  }
  function restoreDrops(){
    if(!run.party||inDungeon())return;
    for(const entry of run.party.loot.entries){if(loot.some(l=>l.id===entry.id))continue;
      // Older saves and roaming monsters can leave drops inside a newly reserved
      // landscape. Relocate the saved entry once, never recreate the reward.
      if(landmark?.cells.some(c=>c.x===entry.cx&&c.y===entry.cy)){
        const blocked=new Set([...occupiedCells().filter(cell=>!loot.some(l=>l.entry&&l.cx+','+l.cy===cell)),'0,0',G.exitCell.x+','+G.exitCell.y]);
        const cells=[];for(let y=0;y<G.mazeH;y++)for(let x=0;x<G.mazeW;x++)if(!blocked.has(x+','+y))cells.push({x,y,d:Math.abs(x-entry.cx)+Math.abs(y-entry.cy)});
        cells.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);if(cells[0]){entry.cx=cells[0].x;entry.cy=cells[0].y;}
      }
      const point=cellPoint(entry.cx,entry.cy),model=new THREE.Group(),icon=new THREE.Group();model.position.set(point.x,0,point.z);model.name='combat-drop';
      if(entry.type==='ingredient')icon.add(partyUI.ingredientModel(entry.key));
      else if(entry.type==='material')icon.add(partyUI.materialModel(entry.key));
      else if(entry.type==='gear'){const gear=HeroVisual.gear(THREE,entry.gear.kind);gear.scale.setScalar(.48);gear.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gear),center=box.getCenter(new THREE.Vector3());gear.position.sub(center);icon.add(gear);}
      else if(entry.type==='fuel'){const wood=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,.75,6),new THREE.MeshLambertMaterial({color:0xa98a64}));wood.rotation.z=-.5;icon.add(wood);const cloth=new THREE.Mesh(new THREE.BoxGeometry(.35,.26,.18),new THREE.MeshLambertMaterial({color:0xe4d6b4}));cloth.position.set(.16,.12,0);icon.add(cloth);}
      else if(Heroes?.ROBOT?.fuelItemIds.includes(entry.key))icon.add(powerStoneModel(entry.key,entry.quantity));
      else if(entry.type==='item'&&Object.hasOwn(POTION_TINTS,entry.key))icon.add(potionModel(entry.key));
      else{const symbols={ration:'🍪',shield:'🛡️',hourglass:'⌛',bell:'🔔',map:'🗺️',feather:'🪶',arrow:'🏹'};icon.add(makeEmojiSprite(symbols[entry.key],.9));}
      icon.position.y=.65;model.add(icon,makePickupMarker(entry.type==='gear'?0xffd77c:0x84dfbc,Loot.label(entry)));world.add(model);loot.push({...point,id:entry.id,entry,kind:'combat-drop',model,icon,retry:0});
    }
  }
  function spawnReinforcements(){
    if(!run.party||inDungeon())return;
    const used=new Set(['0,0',G.exitCell.x+','+G.exitCell.y,...occupiedCells()]),pc=worldToCell(G.px,G.pz);for(let y=pc.y-1;y<=pc.y+1;y++)for(let x=pc.x-1;x<=pc.x+1;x++)used.add(x+','+y);
    for(const m of monsters.filter(m=>m.alive)){const c=worldToCell(m.model.position.x,m.model.position.z);used.add(c.x+','+c.y);}
    const random=mulberry32(floorSeed()^(run.party.reinforcements.shift+1)*7919),cells=Array.from({length:3},()=>{const p=chooseCell(random,used,2);return {x:p.cx,y:p.cy};}),result=Reinforcements.spawn(run,cells);if(!result.ok)return;run=result.run;
    for(const spec of P.monsterSpecs(run).filter(m=>result.effect.reinforcements.some(n=>n.id===m.id))){const p=cellPoint(spec.cx,spec.cy),model=monsterModel(spec.kind,spec.strength,spec.def);model.position.set(p.x,0,p.z);model.userData.monsterId=spec.id;world.add(model);monsters.push({...p,...spec,model,alive:true,path:[],pathLeft:.2,windup:0,cooldown:3,phase:monsters.length,voiceEvents:new Set()});}
    for(const m of monsters.filter(m=>!m.alive&&Reinforcements.validId(m.id))){m.model.parent?.remove(m.model);disposeSceneObject(m.model);}monsters=monsters.filter(m=>m.alive||!Reinforcements.validId(m.id));partyUI?.refreshMonsters();save();
  }
  function momentSeen(key){return run.adventure.claimed.includes('cinema:'+key);}
  function presentMoment(spec){
    if(!cinema||momentSeen(spec.key))return false;
    const floor=run.floor;
    return cinema.start({...spec,done:()=>{if(!active||run.floor!==floor)return;if(!momentSeen(spec.key)&&run.adventure.claimed.length<128)run.adventure.claimed.push('cinema:'+spec.key);save();spec.done?.();}});
  }
  function presentLord(m,event){
    // The farewell close-up must not freeze a hit flash, a squash or a raised weapon on the fallen lord.
    if(event==='defeat'&&m?.model){window.TowerCombatReadability?.update?.(THREE,m,{visible:false});restLord(m);if(m.model.userData.ring)m.model.userData.ring.visible=false;}
    if(!cinema)return lordVoice(m,event);
    // A companion may finish a lord behind a corner. Keep its farewell audio,
    // but never cut to a hidden actor or reveal a room through the fog.
    if(event==='defeat'&&(!hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)||Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)>Math.min(14,lightingUI?.radius()||14)||window.MazeSight?.active()&&!MazeSight.visible(m.model.position.x,m.model.position.z)))return lordVoice(m,event);
    const index=['encounter','wounded','defeat'].indexOf(event),asset=m.def.recordedVoice===false?'underworld.'+m.def.id+'.'+event:'lord.'+m.def.environment+'.'+event;
    const line=m.def.recordedVoice===false?m.def.lines?.[index]:Lords.tracks[asset]?.text;
    if(!line)return false;
    return presentMoment({key:'lord:'+m.id+':'+event,target:m.model,height:3.1,title:m.def.name,text:line,asset,performance:event==='encounter'?'challenge':event==='wounded'?'hurt':'farewell',personality:m.def.environment,faceTarget:true,showTarget:event==='defeat',speaker:{npc:true,consistent:true,identity:m.def.id||m.def.environment,gender:m.def.speaker==='serena'?'female':'male',age:'adult'},done:()=>{m.voiceEvents.add(event);m.windup=0;m.cooldown=Math.max(1,m.cooldown);m.cinemaGrace=1;}});
  }
  function checkLordEntrance(){
    if(!cinema||cinema.active||!active||paused||G.shifting||inDungeon())return !!cinema?.active;
    const m=monsters.find(m=>m.lord&&m.alive&&!momentSeen('lord:'+m.id+':encounter')&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<=Math.min(14,lightingUI?.radius()||14)&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)&&(!window.MazeSight?.active()||MazeSight.visible(m.model.position.x,m.model.position.z)));
    return !!m&&presentLord(m,'encounter');
  }
  function allowMonsterHit(m){
    if(cinema?.active)return false;
    if(m.lord&&run.adventure?.events?.lord?.phase==='guarded')return false;
    if(!cinema||!m.lord||momentSeen('lord:'+m.id+':encounter'))return true;
    checkLordEntrance();return false;
  }
  function lordVoice(m,event){
    if(!m.lord||m.voiceEvents.has(event))return false;
    const voice=window.GameVoice,status=voice?.status();
    if(!status?.enabled||!status.supported||status.speaking&&event==='wounded')return false;
    m.voiceEvents.add(event);
    if(m.def.recordedVoice===false){
      const line=m.def.lines?.[['encounter','wounded','defeat'].indexOf(event)];
      if(line)voice.announceAsset('underworld.'+m.def.id+'.'+event,line,event==='encounter',{npc:true,consistent:true,identity:m.def.id,gender:m.def.speaker==='serena'?'female':'male',age:'adult'});
    }else{const id='lord.'+m.def.environment+'.'+event,track=Lords.tracks[id];if(track)voice.announceAsset(id,track.text,event==='encounter');}
    return true;
  }
  function buildHazards(used) {
    const H=window.TowerHazards,offer=dungeonOffer();
    if(!H||(offer&&![3,4].includes(offer.catalogVersion)))return;
    hazards=H.layout({floor:run.floor,seed:floorSeed(),size:G.mazeW,hWalls:G.hWalls,vWalls:G.vWalls,blocked:[...used],count:offer?.trapCount,allKinds:!!offer}).map(spec=>{
      const trap=H.place(spec,cellToWorld(spec.cx,spec.cy),G.cell,hasClearPath,G.wallT||.7),model=H.build(THREE,trap),prefix=run.floor+':'+trap.cx+':'+trap.cy+':';
      // A previously disarmed location stays disarmed even if its new wall skin differs.
      const heroRemoved=!!(modern()&&Heroes.state(run).removedTraps.some(id=>id.startsWith(prefix)));
      model.position.set(trap.x,0,trap.z);model.visible=!heroRemoved;world.add(model);
      return {...trap,id:prefix+trap.kind,model,heroRemoved,lastHit:-1,lastWarning:-1,lastFire:-1,observeLeft:0,revealed:false};
    });
  }
  function tickHazards(dt) {
    if(paused||!G.running||G.frozen||G.shifting||document.hidden||run.status!=='playing')return;
    hazardSlow=1;hazardGrace=Math.max(0,hazardGrace-dt);
    const H=window.TowerHazards;if(!H)return;
    const elapsed=run.expedition.active?.elapsed??run.floorElapsed,player={x:G.px,z:G.pz},visible=(x,z)=>!window.MazeSight?.active()||window.MazeSight.visible(x,z);
    let observers;
    for(const trap of hazards){
      if(trap.heroRemoved||modern()&&Heroes.state(run).removedTraps.includes(trap.id)||!H.supported(trap,G.mazeW,G.hWalls,G.vWalls)){
        trap.heroRemoved=true;trap.trigger=null;trap.model.visible=false;continue;
      }
      const inside=H.contains(trap,player,hasClearPath,.22),phase=H.step(trap,dt,{inside,armed:hazardGrace===0});
      trap.observeLeft-=dt;
      if(trap.observeLeft<=0){
        trap.observeLeft=.18;
        if(!observers)observers=modern()?Heroes.ids(run).flatMap(id=>{
          const at=id===Heroes.state(run).active?player:partyUI?.heroes?.position?.(id);
          return at&&Heroes.hp(run,id)>0?[{x:at.x,z:at.z,scout:Heroes.job(run,id)==='scout',reveal:Heroes.buff(run,'path_eye',id)?.power||0}]:[];
        }):[];
        trap.revealed=H.detection(trap,observers,{clear:hasClearPath,visible});
      }
      H.animate(trap.model,phase,elapsed,trap.revealed&&visible(trap.x,trap.z));
      const distance=Math.hypot(G.px-trap.x,G.pz-trap.z);
      const audible=inside||distance<8&&hasClearPath(G.px,G.pz,trap.x,trap.z);
      if(phase.state==='warning'&&trap.lastWarning!==phase.cycle&&hazardGrace===0&&audible){
        trap.lastWarning=phase.cycle;showToast(H.TYPES[trap.kind].warning,1700);AudioEng.sfxAction?.(H.TYPES[trap.kind].warningSound);
      }
      if(phase.state!=='active'||hazardGrace>0)continue;
      if(trap.lastFire!==phase.cycle&&audible){trap.lastFire=phase.cycle;AudioEng.sfxAction?.(H.TYPES[trap.kind].sound);}
      if(!H.contains(trap,player,hasClearPath))continue;
      if(trap.kind==='vines'){if(modern()){const id=Heroes.state(run).active;if(!Heroes.buff(run,'slow',id)&&trap.lastHit!==phase.cycle)Heroes.inflict(run,id,'slow',2,.55);}else hazardSlow=.55;}
      if(trap.lastHit===phase.cycle||hurtLeft>0)continue;
      trap.lastHit=phase.cycle;
      if(trap.damage)damage(trap.damage,'trap',H.TYPES[trap.kind].message);
      else showToast(H.TYPES[trap.kind].message,1800);
      if(paused||run.status!=='playing')break;
    }
  }
  function monsterModel(kind, strength, regionalDef) {
    const lord=Lords?.defs()[kind];if(lord){const model=Lords.build(THREE,lord),tag=strengthTag(lord.name+'・樓層主',strength);tag.position.y=3;model.add(tag);model.userData.tag=tag;return model;}
    const def=regionalDef||P?.defs()[kind]||C.MONSTERS[kind],creature=window.TowerCreatureArt?.build(THREE,kind,def);
    if(creature){const tag=strengthTag(def.name,strength);tag.position.y=2.3;creature.add(tag);creature.userData.tag=tag;return creature;}
    const original=partyUI?.monsterModel(kind,strength,def);if(original)return original;
    const group = new THREE.Group(), type = ['clockmite','wisp','sentinel','hound'].indexOf(kind);
    const tint = C.MONSTERS[kind].color;
    const mat = new THREE.MeshLambertMaterial({color:tint});
    const body = new THREE.Mesh(type === 0 ? new THREE.SphereGeometry(.65,10,7) : type === 1 ? new THREE.OctahedronGeometry(.68) : new THREE.BoxGeometry(1.1,1.25,.85), mat);
    body.position.y = type === 0 ? .6 : 1; group.add(body);
    if(kind==='shardseer'){
      body.scale.set(.75,1.15,.75);
      for(const x of [-.55,0,.55]){const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.3),mat);crystal.scale.y=1.6;crystal.position.set(x,2-Math.abs(x)*.3,0);group.add(crystal);}
      const staff=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,1.7,6),mat);staff.position.set(-.85,1,0);group.add(staff);
    }
    if (type === 1) for (const side of [-1,1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(.55,.9,3),mat); wing.rotation.z=side*1.3;wing.position.set(side*.7,1,0);group.add(wing); }
    if (type === 3) { body.scale.set(.8,.55,1.5); for (const x of [-.35,.35]) for (const z of [-.4,.4]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.2),mat);leg.position.set(x,.35,z);group.add(leg); } }
    for (const side of [-1,1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(.14,.16,.1),new THREE.MeshBasicMaterial({color:0xfff4c0}));eye.position.set(side*.22,1,.49);group.add(eye); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.83,.05,5,20),new THREE.MeshBasicMaterial({color:0xff6767,transparent:true,opacity:.42})); ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);group.userData.ring=ring;
    const tag = strengthTag(C.MONSTERS[kind].name, strength);tag.position.y=2.35;group.add(tag);group.userData.body=body;group.userData.tag=tag;
    return group;
  }
  // Label canvases depend only on their caption, so a stun toggle reuses the
  // floor's texture instead of drawing and uploading a new 512x80 canvas.
  // They are flagged shared (scene disposal skips them) and freed per floor.
  const tagTextures = new Map();
  function clearTagTextures() { for (const texture of tagTextures.values()) texture.dispose?.(); tagTextures.clear(); }
  // A mini lord is its regional creature, larger, with a golden crown over its name and a golden ring at its feet.
  let crownParts=null;
  function markMiniLord(model){
    if(!crownParts){crownParts={gold:new THREE.MeshBasicMaterial({color:0xffd56a}),halo:new THREE.MeshBasicMaterial({color:0xffcf5a,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide}),band:new THREE.CylinderGeometry(.24,.27,.1,10,1,true),spike:new THREE.ConeGeometry(.06,.18,4),ring:new THREE.RingGeometry(.92,1.08,28)};for(const part of Object.values(crownParts))part.userData={...part.userData,sharedResource:true};}
    model.scale.setScalar(1.35);const crown=new THREE.Group();crown.name='mini-lord-crown';crown.position.y=2.66;
    const band=new THREE.Mesh(crownParts.band,crownParts.gold);crown.add(band);
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2,spike=new THREE.Mesh(crownParts.spike,crownParts.gold);spike.position.set(Math.sin(a)*.24,.13,Math.cos(a)*.24);crown.add(spike);}
    const halo=new THREE.Mesh(crownParts.ring,crownParts.halo);halo.name='mini-lord-halo';halo.rotation.x=-Math.PI/2;halo.position.y=.05;
    model.add(crown,halo);model.userData.miniLord=true;return model;
  }
  function strengthTag(label, strength) {
    const caption = label + ' · ' + strength + '/5';
    let texture = tagTextures.get(caption);
    if (!texture) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
      const ctx = canvas.getContext('2d'); ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#14202d'; ctx.lineWidth = 8; ctx.fillStyle = '#fff1c9';
      ctx.strokeText(caption,256,40,490); ctx.fillText(caption,256,40,490);
      texture = new THREE.CanvasTexture(canvas); texture.userData = {...texture.userData, sharedResource:true}; tagTextures.set(caption, texture);
    }
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
    tag.scale.set(run?.party ? 1.65 : 3.4,run?.party ? .26 : .53,1); return tag;
  }
  function buildWarriorModel(strength, label) {
    const model = V.buildWarrior(strength,{THREE});
    const tag = strengthTag(label,strength);tag.position.y=2.65;model.add(tag);
    model.userData.guardTag=tag;return model;
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
    if(escort.model.userData.strength!==run.warrior.strength){
      const old=escort.model,next=buildWarriorModel(run.warrior.strength,'護衛戰士');
      next.position.copy(old.position);next.quaternion.copy(old.quaternion);world.add(next);world.remove(old);disposeSceneObject(old);escort.model=next;
    }
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
      if(target){
        const q=target.model.position,offset=playerInWall(q.x+.65,q.z,.28)?-.45:.65;
        p.set(q.x+offset,0,q.z);escort.model.rotation.y=offset>0?-Math.PI/2:Math.PI/2;
        const blade=escort.model.userData.guardBlade,phase=(now%1400)/1400;
        if(guard.strength===5){
          // Short repeating face-first hammer clashes. The positive +Z gold
          // end follows the impact stroke; recovery is visibly slower.
          const stroke=phase<.42?phase/.42:1-(phase-.42)/.58;
          blade.rotation.x=.1+stroke;
        }else blade.rotation.x=Math.sin(now*.008)*.35;
      }
      if(target&&!(run.monsterStuns[target.id]>0)&&now>=guardClashAt&&Math.hypot(G.px-p.x,G.pz-p.z)<12&&hasClearPath(p.x,p.z,G.px,G.pz)){AudioEng.sfxGuardBlock?.();guardClashAt=now+1400;}
      return;
    }
    const safe=nearest||run.effects.repel>0||now<G.invisUntil;
    const target=!safe&&monsters.filter(m=>m.alive&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<3&&Math.hypot(p.x-m.model.position.x,p.z-m.model.position.z)<4.5&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)&&hasClearPath(p.x,p.z,m.model.position.x,m.model.position.z)).sort((a,b)=>Math.hypot(p.x-a.model.position.x,p.z-a.model.position.z)-Math.hypot(p.x-b.model.position.x,p.z-b.model.position.z))[0];
    if(target) {
      const result=C.interceptMonster(run,target.id,C.effectiveMonsterStrength(run,target.id,target.strength),run.revision);
      if(result.ok) {
        run=result.run;target.windup=0;target.path=[];target.cooldown=2;
        if(result.effect.outcome==='defeat')defeatMonster(target,true);
        else {showToast('戰士已攔住 '+target.def.name+'：'+(result.effect.seconds===null?'持續牽制，你可繼續前進':Math.ceil(result.effect.seconds/60)+' 分鐘，趁現在前進！'),3500,false);guardFeedback(result.effect.seconds===null?'hold':'timed');}
        refreshWarriorLabel();save();updateHud();return;
      }
    }
    const moving=followNpc(escort,dt,5.8,1.2);
    escort.model.userData.legL.rotation.x=moving?Math.sin(now*.009)*.35:0;escort.model.userData.legR.rotation.x=-escort.model.userData.legL.rotation.x;
  }
  function followerClear(a,b) {
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));
    for(let i=1;i<=steps;i++)if(playerInWall(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,.28))return false;
    return true;
  }
  function followerDistance(a,b){
    if(followerClear(a,b))return Math.hypot(a.x-b.x,a.z-b.z);
    const from=worldToCell(a.x,a.z),to=worldToCell(b.x,b.z),path=solveMaze(from.x,from.y,to.x,to.y);
    if(!path.length)return Infinity;
    if(path.length>1&&followerClear(a,cellToWorld(...path[1])))path.shift();
    let distance=0,previous=a;
    for(const cell of path){const p=cellToWorld(...cell);distance+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}
    return distance+Math.hypot(b.x-previous.x,b.z-previous.z);
  }
  function followNpc(actor,dt,speed,stopDistance,target={x:G.px,z:G.pz},options={}) {
    const p=actor.model.position;
    actor.pathLeft=Math.max(0,(actor.pathLeft||0)-dt);
    if(Math.hypot(target.x-p.x,target.z-p.z)<=stopDistance&&followerClear(p,target))return false;
    // A moving queue leader may stop between cell centres. Follow that exact
    // position when the full body can pass, without circling the cell centre.
    if(options.direct&&!actor.safeTurn&&followerClear(p,target)){
      const dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz),step=Math.min(Math.max(0,len-stopDistance),speed*Math.min(dt,.1));
      const next={x:p.x+dx/len*step,z:p.z+dz/len*step};
      if(followerClear(p,next)){actor.path=[];p.x=next.x;p.z=next.z;actor.model.rotation.y=Math.atan2(dx,dz);return step>0;}
      actor.safeTurn=true;actor.path=[];actor.pathLeft=0;
    }
    let waypoint=actor.path?.length?cellToWorld(...actor.path[0]):null;
    // 到達安全路點才重算，不能因已跨入下一格就略過尚未走完的轉角。
    if(waypoint&&Math.hypot(waypoint.x-p.x,waypoint.z-p.z)<.03){actor.path.shift();actor.safeTurn=false;waypoint=null;}
    if((!actor.path?.length||!waypoint)&&actor.pathLeft<=0){
      const a=worldToCell(p.x,p.z),b=worldToCell(target.x,target.z);
      actor.path=solveMaze(a.x,a.y,b.x,b.y);actor.pathLeft=.5;
      if(actor.path.length>1&&!actor.safeTurn&&followerClear(p,cellToWorld(...actor.path[1])))actor.path.shift();
    }
    waypoint=actor.path?.length?cellToWorld(...actor.path[0]):target;
    if(Math.hypot(waypoint.x-p.x,waypoint.z-p.z)<.03){actor.path.shift();actor.safeTurn=false;return false;}
    const dx=waypoint.x-p.x,dz=waypoint.z-p.z,len=Math.hypot(dx,dz),step=Math.min(len,speed*Math.min(dt,.1));
    const next={x:p.x+dx/len*step,z:p.z+dz/len*step};
    if(!followerClear(p,next)){actor.path=[];actor.pathLeft=0;actor.safeTurn=true;return false;}
    p.x=next.x;p.z=next.z;actor.model.rotation.y=Math.atan2(dx,dz);
    return step>0;
  }
  function floorSeed() { return (run.seed ^ Math.imul(run.floor, 7919) ^ (inDungeon()?0x7316dea:0)) | 0; }
  function soundChanged() {
    if(!active||!window.TowerAudio)return;
    AudioEng.stopMusic(); AudioEng.resume();
    window.TowerAudio.configure({context:AudioEng.ctx,output:AudioEng.musicGain});
    window.TowerAudio.setMuted(G.muted);
    window.TowerAudio.setEnvironment(floorConfig.environmentId,floorConfig.underworld===true);
    window.TowerAudio.setEncounter(encounterHold>0,bossEncounterHold>0);
    window.TowerAudio.setCamp(campDialog);
    window.TowerAudio.setPaused(paused);
  }
  function scheduleShift() { shiftLeft = dungeonOffer()?.shiftSeconds || C.floorConfig(run.floor).shiftSeconds; warning = false; G.preWarned = false; }
  function updateShift() {
    if (!active) return;
    const countdown = Math.ceil(Math.max(0, shiftLeft)) + '秒'; if (el('shiftCountdown').textContent !== countdown) el('shiftCountdown').textContent = countdown;
    if (paused || !G.running || G.shifting) return;
    if (shiftLeft <= 3.5) {
      el('preWarn').style.display = 'block'; el('preWarnSec').textContent = Math.ceil(Math.max(0,shiftLeft));
      if (!warning) { warning = true; AudioEng.sfxTick(); }
    }
    if (shiftLeft <= 0) { el('preWarn').style.display = 'none'; wasShifting = true; doShift(); }
  }
  // Write a HUD value only when it differs from what the element already shows;
  // updateHud runs about seven times a second during play.
  function hudSet(id,key,value){const node=el(id);if(!node)return;if(key==='textContent')value=String(value);if(node[key]!==value)node[key]=value;}
  function updateHud() {
    if (!active) return;
    const maxHp=modern()?Heroes.maxHp(run):C.MAX_HP,dungeon=inDungeon();
    let floorText=run.floor<0?'B'+Math.abs(run.floor):run.floor + ' F';
    hudSet('towerHealth','textContent',Math.ceil(run.hp) + ' / '+maxHp);hudSet('towerHp','max',maxHp);
    hudSet('towerHp','value',run.hp); hudSet('towerCoins','textContent',run.coins);
    hudSet('towerChapter','textContent',floorConfig.name);
    let talkDisabled = !nearest && !nearestWarrior && !nearbyEncounter, talkLabel = nearbyEncounter ? (nearbyEncounter===chest?'開箱（R）':'對話（R）') : nearestWarrior ? '對話：聘請（R）' : nearest ? '對話：交易（R）' : '附近無人';
    if(!run.party){hudSet('towerGuardStatus','hidden',!run.warrior);hudSet('towerGuardStatus','textContent',warriorStatus());}
    hudSet('towerGearStatus','textContent',Object.entries(run.equipment).filter(([slot])=>GEAR_SLOT_LABELS[slot]).map(([slot,gear])=>GEAR_SLOT_LABELS[slot]+' '+(gear?gear.durability:'—')).join(' · '));
    if(dungeon&&!huntActive()){hudSet('towerAttackBtn','disabled',true);if(window.BattleDock)BattleDock.attackLabel('探索',0);else hudSet('towerAttackBtn','textContent','探索試煉');}
    else{hudSet('towerAttackBtn','disabled',attackLeft > 0 || !run.equipment.weapon || robotEnergy()?.value===0);if(window.BattleDock)BattleDock.attackLabel(!run.equipment.weapon?'徒手':'揮擊',attackLeft);else hudSet('towerAttackBtn','textContent',!run.equipment.weapon?'需裝備武器':attackLeft > 0 ? '擊暈 ' + attackLeft.toFixed(1) : '擊暈 X');}
    const effects = Object.entries(run.effects).filter(([,v])=>v>0).map(([k,v])=>({shield:'護盾',freeze:'定牆',repel:'驅怪',reveal:'出口路線',haste:'加速'}[k])+' '+Math.ceil(v)+'秒');
    let objective = nearestWarrior ? '戰士 '+nearestWarrior.offer.strength+'/5 · '+costText(nearestWarrior.offer.cost)+' · 點「聘請」查看契約' : effects.length ? effects.join(' · ') : nearest ? nearest.name + '：靠近後可購買／出售補給' : '找到樓梯，前往' + ([1,-50].includes(run.floor)?'歸途':floorLabel(run.floor-1));
    const q=run.adventure.quest;
    if(nearbyEncounter)objective=nearbyEncounter===chest?'封印寶箱 · 可能藏著強化裝備，也可能是陷阱':explorerName()+' · 對話查看委託';
    else if(q&&q.status!=='claimed'&&!nearest&&!nearestWarrior)objective=(E.explorerOffer(run)?.title||'探索者委託')+' · '+q.progress+'/'+q.goal+(q.status==='ready'?' · 報酬待領':'');
    else if(N&&!nearest&&!nearestWarrior)objective=N.objective(run);
    if(dungeon&&dungeonOffer()?.hunt){const offer=dungeonOffer(),state=run.expedition.active;floorText='討伐 · '+run.floor+' F';objective=offer.title.replace('討伐裂隙・','討伐・')+' · '+huntTally(offer)+'/'+offer.required.length+' · 剩 '+Math.ceil(Math.max(0,offer.timeLimit-state.elapsed))+' 秒';}
    else if(dungeon){const offer=dungeonOffer(),state=run.expedition.active;floorText='裂隙 · '+run.floor+' F';objective=offer.title+' · '+state.progress.length+'/3 · 剩 '+Math.ceil(Math.max(0,offer.timeLimit-state.elapsed))+' 秒'+(['bells','threads'].includes(offer.kind)?' · '+offer.order.map(i=>i+1).join('→'):offer.kind==='stars'&&state.progress.length===1?(state.shiftCount>state.shiftAtStart?' · 星路已更新':' · 等待牆壁變形'):'');}
    if(nearbyJourney){talkDisabled=false;talkLabel=nearbyJourney===rift?'裂隙（R）':nearbyJourney===huntGate?'討伐（R）':nearbyJourney===mainClue?'印記（R）':'調查（R）';objective=nearbyJourney===rift?'裂隙副本 · 自願進入，結束回到原層':nearbyJourney===huntGate?huntGate.offer.title+' · 自願進入，結束回到原層':nearbyJourney===mainClue?'主線印記 · '+N.chapterForFloor(run.floor).clueName:objective;}
    if(nearbyAdventure){talkDisabled=false;talkLabel='調查（R）';objective=nearbyAdventure===eventMarker?eventMarker.offer.name:nearbyAdventure===followupMarker?'後續留言 · 靠近查看':run.floor===80?'供能藤 · 靠近斬斷':'晶柱 · 轉向後引來晶光';}
    // The half-health shield owns the objective line until its counters are done; the vine/pillar prompt still wins when one is in reach.
    const guardNotice=!nearbyAdventure&&!dungeon?AdventureEvents?.guardNotice?.(run):null;if(guardNotice)objective=guardNotice.objective;
    if(talkDisabled&&canObserveLandmark()){talkDisabled=false;talkLabel='觀察地標（R）';}
    hudSet('towerFloor','textContent',floorText);hudSet('towerObjective','textContent',objective);
    hudSet('towerTalkBtn','disabled',talkDisabled);hudSet('towerTalkBtn','ariaLabel',talkLabel);hudSet('towerTalkBtn','hidden',paused||!G.running||talkDisabled);
    document.body.classList.toggle('tower-danger',run.hp<=maxHp*.25);
    partyUI?.hud();
    lightingUI?.hud();
    if(typeof updateSatietyBar==='function')updateSatietyBar();
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
    objectiveHint?.tick(dt);
    if(G.shifting)clearBolts();
    if (wasShifting && !G.shifting) {
      wasShifting = false;
      if (hiddenDuringShift) { const since = hiddenDuringShift; hiddenDuringShift = 0; if (active && !paused && run.status === 'playing') { pauseMenu(); pauseAt = Math.min(pauseAt, since); } }
      hazardGrace=3;hazardSlow=1;
      wallMesh.material.color.setHex(environmentSpec()[1]);
      monsters.forEach(m=>{ const c=worldToCell(m.model.position.x,m.model.position.z),p=cellToWorld(c.x,c.y);m.model.position.set(p.x,0,p.z);m.path=[];m.pathLeft=0;m.windup=0;m.cooldown=2; });
      restoreWarriorPosition();
      partyUI?.shift();
      repositionForaging();
      if(!inDungeon())spawnReinforcements();
      if(explorer&&run.adventure.quest?.type==='escort'){explorer.model.position.set(G.px,0,G.pz);explorer.path=[];explorer.pathLeft=0;}
      if(!inDungeon())questEvent('shift',{id:'shift-'+Math.floor(run.floorElapsed*1000)});
      else if(run.expedition.active.kind==='stars')saveDungeonShift();
      if (run.effects.reveal>0) { const p=worldToCell(G.px,G.pz); G.solutionPath=solveMaze(p.x,p.y); }
    }
    if (paused || !G.running || G.frozen || G.shifting || run.status !== 'playing') return;
    if(checkLordEntrance())return;
    run.hunger = G.satiety;
    if(modern())run.engine.shovels=G.shovels;
    const previousControlled=modern()?Heroes.state(run).active:null,previousControlledHp=previousControlled?Heroes.hp(run,previousControlled):0;
    // Validate-and-copy once per second of play; the frames in between use the
    // in-place live tick with the same bookkeeping (no per-frame save clone).
    liveValidateClock += dt;
    const validateNow = liveValidateClock >= 1 || !C.tickEffectsLive; if (validateNow) liveValidateClock = 0;
    const ticked = validateNow ? C.tickEffects(run, dt) : C.tickEffectsLive(run, dt); run = ticked.run || ticked;
    if(previousControlled&&Heroes.hp(run,previousControlled)<previousControlledHp){hurtFlash=.65;el('towerHurtGlow').style.opacity='1';AudioEng.sfxHurt?.();}
    if(previousControlled&&previousControlled!==Heroes.state(run).active){partyUI?.switchControl(previousControlled,Heroes.state(run).active);hurtLeft=Heroes.actor(run).hurt;refreshGear();partyUI?.refreshActors();updateHud();save();}
    AdventureEvents?.tick(run,dt);
    lightingUI?.tick(dt);
    environmentLife?.tick(dt);
    if(ticked.effect && ticked.effect.warriorReleased){dismissEscort();showToast('護衛已盡力撤退，怪物將恢復追擊！',3500);save();}
    if (run.effects.freeze<=0) shiftLeft -= dt;
    attackLeft=Math.max(0,attackLeft-dt);hurtLeft=Math.max(0,hurtLeft-dt);
    if(hurtFlash>0){hurtFlash=Math.max(0,hurtFlash-dt);el('towerHurtGlow').style.opacity=String(hurtFlash/.65);}
    if(modern()){G.drainPerSec=.12*Heroes.hungerScale(run);if(G.shovels!==run.engine.shovels){G.shovels=run.engine.shovels;updateShovelBtn();}HeroVisual.pose(playerGroup,Heroes.actor(run).attack,Heroes.stats(run).interval,G.view==='fp',dt);updateHeroFirstPerson();}
    if(gearVisual?.userData.weapon){
      if(window.CharacterMotion)window.CharacterMotion.worldWeaponPose(gearVisual.userData.weapon,playerGroup,1-attackLeft/.8,G.view==='fp');
      else gearVisual.userData.weapon.rotation.x=.25+Math.sin((.8-attackLeft)/.8*Math.PI)*1.35;
    }
    if (G.satiety<=0 && hurtLeft<=0 && !robotEnergy()) damage(3,'hunger');
    if(run.status!=='playing')return;
    const portal=cellToWorld(G.exitCell.x,G.exitCell.y);if(Math.hypot(G.px-portal.x,G.pz-portal.z)>2.2)exitDeclined=false;
    tickHazards(dt);if(paused||run.status!=='playing')return;
    if(huntActive()){tickHunt(dt,now);return;}
    if(inDungeon()){if(modern())partyUI?.tick(dt,now);tickDungeon(dt,now);return;}
    const pc=worldToCell(G.px,G.pz),cellKey=pc.x+','+pc.y;
    if(cellKey!==lastSurveyCell){lastSurveyCell=cellKey;questEvent('survey',pc);exploredCells.add(cellKey);}
    if(rift&&!rift.model.visible&&exploredCells.size>=3){const result=D.discover(run);if(result.ok){run=result.run;rift.model.visible=true;save();showToast('牆縫裡出現了異色裂隙，小地圖「裂」標記可找到入口。',4000);}}
    updateExplorer(dt,now);
    if(relic&&relic.model.visible&&Math.hypot(G.px-relic.x,G.pz-relic.z)<1.1&&hasClearPath(G.px,G.pz,relic.x,relic.z)){questEvent('relic',{id:run.adventure.quest.target});relic.model.visible=false;save();}
    for (const item of loot) {
      if (!item.model.visible) continue;
      if(!item.foraging){item.icon.position.y=1+Math.sin(now*.003+item.cx)*.12;item.icon.rotation.y+=dt;}
      if (Math.hypot(G.px-item.x,G.pz-item.z)<1.05&&hasClearPath(G.px,G.pz,item.x,item.z)) {
        if(item.foraging){item.retry=Math.max(0,item.retry-dt);if(item.retry>0)continue;const result=Foraging.claim(run,item.id);if(result.ok){run=result.run;item.model.visible=false;AudioEng.sfxPickup();showToast(result.message,1800,result.message);questEvent('collect',{id:item.id});save();}else{item.retry=3;showToast(result.message,1800,false);}continue;}
        if(item.entry){item.retry=Math.max(0,item.retry-dt);if(item.retry>0)continue;const result=Loot.claim(run,item.id);if(result.ok){run=result.run;item.model.visible=false;AudioEng.sfxPickup();showToast(result.message,1800,result.message);questEvent('collect',{id:item.id});save();if(result.effect?.pickup?.type==='gear')partyUI?.heroes?.suggestUpgrade?.(result.effect.pickup.gear.id);}else{item.retry=3;showToast(result.message,1800,false);}continue;}
        if(item.kind==='ingredient'){if(hasClearPath(G.px,G.pz,item.x,item.z)&&transact(P.gather(run,item.id,item.ingredient,run.revision))){item.model.visible=false;AudioEng.sfxPickup();showToast('獲得'+P.INGREDIENTS[item.ingredient],1800,'獲得 '+P.INGREDIENTS[item.ingredient]);questEvent('collect',{id:item.id});}continue;}
        const amount=item.kind==='coin'?8:item.quantity||1,result=C.collect(run,item.kind,amount);
        if(result.ok){run=result.run;run.claimed.push(item.id);item.model.visible=false;AudioEng.sfxPickup();showToast('取得 '+C.ITEMS[item.kind].name+(amount>1?' +'+amount:'')+'。'+(C.ITEMS[item.kind].description||''),1800,'獲得 '+C.ITEMS[item.kind].name);save();}
      }
    }
    nearest=traders.find(n=>Math.hypot(G.px-n.x,G.pz-n.z)<2.6&&hasClearPath(G.px,G.pz,n.x,n.z))||null;
    if(loot.some(l=>l.entry&&!run.party?.loot.entries.some(e=>e.id===l.id))){
      const groundIds=new Set(run.party?.loot.entries.map(e=>e.id)||[]);
      for(const item of loot.filter(l=>l.entry&&!groundIds.has(l.id))){item.model.parent?.remove(item.model);disposeSceneObject(item.model);}loot=loot.filter(l=>!l.entry||groundIds.has(l.id));
    }
    nearestWarrior=warriorNpc&&warriorNpc.model.visible&&Math.hypot(G.px-warriorNpc.x,G.pz-warriorNpc.z)<2.6&&hasClearPath(G.px,G.pz,warriorNpc.x,warriorNpc.z)?warriorNpc:null;
    if(nearestWarrior&&nearest&&Math.hypot(G.px-nearest.x,G.pz-nearest.z)<Math.hypot(G.px-nearestWarrior.x,G.pz-nearestWarrior.z))nearestWarrior=null;
    const closeEntities=[chest,explorer].filter(n=>n&&n.model.visible&&Math.hypot(G.px-n.model.position.x,G.pz-n.model.position.z)<2.6&&hasClearPath(G.px,G.pz,n.model.position.x,n.model.position.z));
    nearbyEncounter=closeEntities.sort((a,b)=>Math.hypot(G.px-a.model.position.x,G.pz-a.model.position.z)-Math.hypot(G.px-b.model.position.x,G.pz-b.model.position.z))[0]||null;
    if(nearbyEncounter){const d=Math.hypot(G.px-nearbyEncounter.model.position.x,G.pz-nearbyEncounter.model.position.z);if([nearest,nearestWarrior].some(n=>n&&Math.hypot(G.px-n.x,G.pz-n.z)<d))nearbyEncounter=null;}
    updateJourneyNearby();
    refreshAdventureWorld();
    partyUI?.tick(dt,now);
    if(paused)return;
    updateWarrior(dt,now);
    traderSafe=traders.some(n=>Math.hypot(G.px-n.x,G.pz-n.z)<2.6&&hasClearPath(G.px,G.pz,n.x,n.z));
    if(!updateMonsters(dt,now))return;
    const threat=updateThreat(dt,now);
    if(window.CharacterFace){
      CharacterFace.update(playerGroup,now/1000,hurtLeft>0?'hurt':threat?'focus':nearest||nearestWarrior||nearbyEncounter?'happy':'calm');
      for(const npc of traders)npcFace(npc,now);npcFace(warriorNpc,now);npcFace(explorer,now);
    }
    if(run.effects.reveal>0){G.mapUntil=now+250; if(!G.solutionPath){const p=worldToCell(G.px,G.pz);G.solutionPath=solveMaze(p.x,p.y);}}
    hudClock+=dt;if(hudClock>.15){hudClock=0;updateHud();}
    saveClock+=dt;if(saveClock>8){saveClock=0;save();}
    objectiveHint?.refresh();
  }
  // Shared by the floor and a hunt rift: every monster's move, attack and readability, then its bolts.
  function updateMonsters(dt,now){
    for(const monster of monsters){
      updateMonster(monster,dt,now);
      if(paused)return false;
      const cell=worldToCell(monster.model.position.x,monster.model.position.z),center=cellToWorld(cell.x,cell.y),half=G.cell/2-.08;
      window.TowerCombatReadability?.update(THREE,monster,{dt,stunned:(run.monsterStuns[monster.id]||0)>0,visible:monster.model.visible&&(!window.MazeSight?.active()||MazeSight.visible(monster.model.position.x,monster.model.position.z)),reducedMotion:!!reducedMotion?.matches,bounds:{minX:center.x-half,minZ:center.z-half,maxX:center.x+half,maxZ:center.z+half}});
    }
    updateBolts(dt);return true;
  }
  function updateThreat(dt,now){
    let threat=false,lordThreat=false;
    if(!nearest&&run.effects.repel<=0&&!(now<G.invisUntil))for(const m of monsters){
      if(m.alive&&(m.awarenessLeft>0||m.windup>0)&&!isHeld(m)&&!(run.monsterStuns[m.id]>0)&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)){
        threat=true;if(m.lord)lordThreat=true;if(lordThreat)break;
      }
    }
    encounterAlert?.update(threat,dt);
    updateEncounterMusic(threat,lordThreat,dt);
    return threat;
  }
  // A hunt rift: companions fight beside the hero, monsters act as on a floor, the trial clock and HUD run as in a rift.
  let huntNoticed=false;
  function tickHunt(dt,now){
    if(modern())partyUI?.tick(dt,now);if(paused)return;
    traderSafe=false;
    if(!updateMonsters(dt,now))return;
    const threat=updateThreat(dt,now);
    if(window.CharacterFace)CharacterFace.update(playerGroup,now/1000,hurtLeft>0?'hurt':threat?'focus':'calm');
    const done=dungeonComplete();
    if(done&&!huntNoticed){huntNoticed=true;showToast('討伐完成！回到出口領取報酬。',3500);AudioEng.sfxAction?.('heal');}
    if(!done)huntNoticed=false;
    tickDungeon(dt,now);
  }
  function npcFace(npc,now){if(npc?.model?.visible)CharacterFace.update(npc.model,now/1000,npc===nearest||npc===nearestWarrior||npc===nearbyEncounter?'happy':'calm');}
  function updateEncounterMusic(threat, lordThreat, dt) {
    encounterHold=threat?4:Math.max(0,encounterHold-dt);
    bossEncounterHold=lordThreat?4:monsters.some(m=>m.lord&&m.alive)?Math.max(0,bossEncounterHold-dt):0;
    if(window.TowerAudio)window.TowerAudio.setEncounter(encounterHold>0,bossEncounterHold>0);
  }
  function hasClearPath(ax,az,bx,bz) {
    const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/.3);
    for(let i=1;i<=steps;i++)if(playerInWall(ax+(bx-ax)*i/steps,az+(bz-az)*i/steps,.1))return false;
    return true;
  }
  // A lord that is stunned, held or guarded drops its wind-up pose instead of freezing mid-swing.
  const restLord=m=>{if(m.lord&&m.model){m.strikeLeft=0;Lords?.pose?.(m.model,{});}};
  function updateMonster(m,dt,now) {
    if(!m.alive||paused||G.frozen||G.shifting||!G.running||run.status!=='playing')return;
    if(cinema&&m.lord&&!momentSeen('lord:'+m.id+':encounter')){checkLordEntrance();return;}
    if(m.cinemaGrace>0){m.cinemaGrace=Math.max(0,m.cinemaGrace-dt);return;}
    m.alertLeft=Math.max(0,(m.alertLeft||0)-dt);
    const stunned=(run.monsterStuns[m.id]||0)>0;
    const questTarget=run.adventure?.quest?.status==='active'&&run.adventure.quest.target===m.id;
    if(m.stunLabel!==stunned||m.questLabel!==questTarget){const old=m.model.userData.tag;if(old){m.model.remove(old);disposeSceneObject(old);const tag=strengthTag((questTarget?'委託目標・':'')+m.def.name+(m.lord?'・樓層主':'')+(stunned?'（暈）':''),C.effectiveMonsterStrength(run,m.id,m.strength));tag.position.y=m.lord?3:2.35;m.model.add(tag);m.model.userData.tag=tag;}
      if(m.stunLabel!==stunned&&!stunned&&isHeld(m)){const result=C.resolveHeldMonster(run,m.id,m.strength);if(result.ok&&result.effect.changed){run=result.run;save();updateHud();showToast('怪物恢復強度，護衛改為限時抵擋 '+result.effect.seconds+' 秒。');}}
      m.stunLabel=stunned;m.questLabel=questTarget;
    }
    if(stunned){m.windup=0;m.path=[];m.cooldown=2;m.model.userData.ring.material.opacity=.25+.12*Math.sin(now*.01);restLord(m);return;}
    if(isHeld(m)){m.windup=0;m.path=[];m.cooldown=2;m.model.userData.ring.material.opacity=.65;restLord(m);return;}
    if(partyUI?.guard(m,dt)){restLord(m);return;}
    const p=m.model.position, distance=Math.hypot(G.px-p.x,G.pz-p.z),status=modern()?Heroes.state(run).enemy[m.id]:null;
    const affixes=window.TowerAffixes,blocked=!!affixes?.attackBlocked(run,m.id,true);
    if(blocked){m.windup=0;m.aim=null;}
    const weakening=Math.max(status?.weak||0,status?.relayWeak>0?.25:0),monsterDamage=(m.def.damage||12)*(1-weakening)*(affixes?.offense(run,m.id,true)??1);
    // Physical contact is dangerous even during windup/recovery or invisibility.
    // Stunned and guard-held monsters returned above; walls still block contact.
    if(!blocked&&distance<1.15&&hasClearPath(p.x,p.z,G.px,G.pz)){damage(monsterDamage,'monster','',m.id);if(status)status.weak=0;}
    if(run.status!=='playing')return;
    // Computed once per frame after companions and dashes have moved the player.
    const safe=traderSafe;
    const hidden=modern()&&(Heroes.buff(run,'stealth')||status?.blind>0);
    const repelled=run.effects.repel>0||safe||now<G.invisUntil;
    const sense=window.TowerMonsterSense,baseProfile=sense?.profile(m.def)||{range:m.def.sight},profile={...baseProfile,range:baseProfile.range*(AdventureEvents?.senseScale(run)??1)},inRange=distance<=profile.range+(m.alertLeft>0?4:0),line=inRange&&hasClearPath(p.x,p.z,G.px,G.pz),concealed=hidden||now<G.invisUntil,detected=distance<=(concealed?Math.min(2,profile.range):profile.range)+(m.alertLeft>0?4:0)&&(line||profile.hearing&&!concealed);
    m.awarenessLeft=Math.max(0,(m.awarenessLeft||0)-dt);// A short silent notice: the name only, no spoken explanation.
    if(detected&&m.elite&&!m.announced){m.announced=true;showToast(m.def.name+' 出現了！',2200,false);}if(detected&&!repelled){m.awarenessLeft=2.5;m.lastKnown={x:G.px,z:G.pz};if(m.lord){if(!cinema)lordVoice(m,'encounter');if((run.party.health[m.id]??m.maxHp)<=m.maxHp*.5)lordVoice(m,'wounded');}}
    m.cooldown=Math.max(0,m.cooldown-dt);m.pathLeft-=dt;
    m.model.userData.body.position.y=(m.kind==='clockmite' ? .6 : 1)+Math.sin(now*.004+m.phase)*.1;
    m.model.userData.ring.material.opacity=m.windup>0?.9:.35;
    if(m.lord){const dome=m.model.getObjectByName('lord-guard-dome');if(dome?.visible)dome.material.opacity=.2+.1*Math.sin(now*.005);m.strikeLeft=Math.max(0,(m.strikeLeft||0)-dt);
      // The director object always exists; cutscenes stop this tick themselves, so the attack pose runs whenever the lord does.
      Lords?.pose?.(m.model,{windup:m.windup,total:m.windupTotal,strike:m.strikeLeft});}
    if(m.def.ranged&&!blocked){
      if(repelled){m.windup=0;m.aim=null;}
      else if(m.windup>0){
        m.windup-=dt;
        if(m.windup<=0){if(m.aim&&hasClearPath(p.x,p.z,m.aim.x,m.aim.z))launchBolt(m);m.strikeLeft=.4;m.aim=null;m.cooldown=3.4;}
        return;
      }else if(detected&&!hidden&&distance<=Math.min(12,profile.range)&&m.cooldown<=0&&line){
        m.aim={x:G.px,z:G.pz};m.windup=1.1;m.windupTotal=1.1;m.model.rotation.y=Math.atan2(G.px-p.x,G.pz-p.z);return;
      }
      if(!repelled&&detected&&distance<=Math.min(7,profile.range)&&!hidden)return;
    }
    if(!m.def.ranged&&!blocked&&m.windup>0){m.windup-=dt;if(m.windup<=0){if(!repelled&&distance<2.05&&hasClearPath(p.x,p.z,G.px,G.pz)){m.cueRelease=(m.cueRelease||0)+1;damage(monsterDamage,'monster','',m.id);if(status)status.weak=0;}m.strikeLeft=.4;m.cooldown=2.3;}return;}
    if(!m.def.ranged&&!blocked&&!repelled&&distance<1.85&&m.cooldown<=0&&hasClearPath(p.x,p.z,G.px,G.pz)){m.windup=.8;m.windupTotal=.8;return;}
    if(distance>22)return;
    if(m.pathLeft<=0){
      m.pathLeft=.8+m.phase*.1;
      const from=worldToCell(p.x,p.z),pc=worldToCell(G.px,G.pz);
      let goal=detected?pc:m.lastKnown?worldToCell(m.lastKnown.x,m.lastKnown.z):pc;
      if(repelled)goal={x:G.mazeW-1-pc.x,y:G.mazeH-1-pc.y};
      else if(m.awarenessLeft<=0){m.path=[];return;}
      m.path=solveMaze(from.x,from.y,goal.x,goal.y).slice(1);
    }
    if(!m.path.length)return;
    if(status?.root>0){m.path=[];return;}
    const waypoint=cellToWorld(m.path[0][0],m.path[0][1]),dx=waypoint.x-p.x,dz=waypoint.z-p.z,len=Math.hypot(dx,dz);
    const speed=(affixes?.movement(run,m.id,true)??1)*(status?.slow>0?1-Math.min(.5,status.slowPower||.2):1)*Math.min(3.8,m.def.speed??2.1)*(m.kind==='wisp'?(Math.sin(now*.002)>0?1.25:.6):1);
    const step=Math.min(len,speed*dt);
    if(len>.001){const nx=p.x+dx/len*step,nz=p.z+dz/len*step;if(!playerInWall(nx,nz,.28)){p.x=nx;p.z=nz;}else{m.path=[];m.pathLeft=0;}m.model.rotation.y=Math.atan2(dx,dz);}
    if(len<.12)m.path.shift();
  }
  function damage(amount,source='monster',message='',monsterId=null) {
    if(hurtLeft>0||paused||run.status!=='playing')return;
    const before=modern()?Heroes.state(run).active:null,result=C.takeDamage(run,amount,source,monsterId);if(!result.ok)return;run=result.run;
    if(result.effect.switched){partyUI?.switchControl(before,Heroes.state(run).active);hurtLeft=Heroes.actor(run).hurt;}
    if(result.effect.damage===0){hurtLeft=2;refreshGear();save();return;}
    damageFeedback(result.effect);refreshGear();
    showToast(result.effect&&result.effect.revived?'復甦羽亮起，你重新站了起來。':(message||'受到 '+result.effect.damage+' 點傷害，留意紅圈預警')+(result.effect.broken.length?' · 裝備已損壞':''),1800,result.effect.revived?'使用 復甦羽':(message||'受到攻擊')+(result.effect.broken.length?'，裝備已損壞':''));
    if(run.hp<=0||run.status==='dead')defeat();else save();updateHud();
  }
  function clearHurtFeedback(){hurtFlash=0;el('towerHurtGlow').style.opacity='0';}
  function clearBolts(){for(const b of bolts){world?.remove(b.model);disposeSceneObject(b.model);}bolts=[];}
  function launchBolt(m){
    if(bolts.length>=8||!world||window.TowerAffixes?.attackBlocked(run,m.id,true))return;
    const p=m.model.position,dx=m.aim.x-p.x,dz=m.aim.z-p.z,len=Math.hypot(dx,dz);if(len<.01)return;
    if(!boltParts){boltParts={geometry:new THREE.OctahedronGeometry(.22),material:new THREE.MeshBasicMaterial({color:0x84f1ff})};for(const part of Object.values(boltParts))part.userData={...part.userData,sharedResource:true};}
    const model=new THREE.Mesh(boltParts.geometry,boltParts.material);
    m.cueRelease=(m.cueRelease||0)+1;
    model.position.set(p.x,1,p.z);world.add(model);bolts.push({model,owner:m.id,vx:dx/len*5,vz:dz/len*5,left:2.2,damage:m.def.damage*(window.TowerAffixes?.offense(run,m.id,true)??1)*(modern()?1-Math.max(Heroes.state(run).enemy[m.id]?.weak||0,Heroes.state(run).enemy[m.id]?.relayWeak>0?.25:0):1)});if(modern()&&Heroes.state(run).enemy[m.id])Heroes.state(run).enemy[m.id].weak=0;AudioEng.sfxSwing();
  }
  function updateBolts(dt){
    if(paused||G.frozen||G.shifting||!G.running||run.status!=='playing')return;
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i],owner=monsters.find(m=>m.id===b.owner),p=b.model.position;
      let remove=!owner?.alive||isHeld(owner)||(run.monsterStuns[b.owner]||0)>0;
      const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vz)*dt/.18)),step=dt/steps;
      for(let j=0;j<steps&&!remove;j++){
        const nx=p.x+b.vx*step,nz=p.z+b.vz*step;
        if(playerInWall(nx,nz,.18)){remove=true;break;}
        p.x=nx;p.z=nz;b.left-=step;
        const crystal=run.floor===60&&b.owner==='monster-11'&&run.adventure?.events?.lord?.phase==='guarded'&&run.adventure.events.lord.armed>0?counterObjects[0]:null;
        if(crystal?.model.visible&&Math.hypot(crystal.x-p.x,crystal.z-p.z)<.85){if(transact(AdventureEvents.counter(run,0))){refreshAdventureWorld();AudioEng.sfxBreak();showToast('晶光被反射了，伯爵的護罩破開！',3000);}remove=true;}
        if(!remove&&Math.hypot(G.px-p.x,G.pz-p.z)<.8&&hasClearPath(p.x,p.z,G.px,G.pz)){damage(b.damage,'monster','',b.owner);remove=true;}
        if(b.left<=0)remove=true;
      }
      if(remove){world?.remove(b.model);disposeSceneObject(b.model);bolts.splice(i,1);}
    }
  }
  function damageFeedback(effect){
    if(effect?.target==='monster'||effect?.target==='companion')return;
    if(!(effect?.damage>0))return;
    hurtLeft=2;hurtFlash=.65;el('towerHurtGlow').style.opacity='1';AudioEng.sfxHurt?.();
  }
  function guardFeedback(kind){
    const line={hold:'我來擋住牠，你先走！',timed:'我只能擋住一會兒，快走！',defeat:'怪物已經打倒了，繼續前進！'}[kind];
    if(kind==='defeat')AudioEng.sfxGuardDefeat?.();else AudioEng.sfxGuardBlock?.();
    guardClashAt=performance.now()+1400;encounterHold=4;
    window.GameVoice?.announceAsset('guard.'+kind,line,true);
  }
  function attack() {
    if(!active||paused||G.frozen||!G.running||inDungeon()&&!huntActive()||(!run?.party?.loadouts&&attackLeft>0))return;
    if(checkLordEntrance())return;
    if(partyUI?.live()){partyUI.attack();return;}
    if(!run.equipment.weapon){showToast('請先在背包裝備球棒、平底鍋或木杖。');return;}
    attackLeft=.8/C.hasteMultiplier(run);
    AudioEng.sfxSwing();
    if(window.CharacterMotion)window.CharacterMotion.beginAction(playerGroup,'attack',attackLeft);
    const target=monsters.filter(m=>m.alive&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<2.8&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)).sort((a,b)=>Math.hypot(G.px-a.model.position.x,G.pz-a.model.position.z)-Math.hypot(G.px-b.model.position.x,G.pz-b.model.position.z))[0];
    if(!target){showToast('揮擊落空：靠近怪物後再攻擊');return;}
    const result=C.hitMonster(run,target.id,target.strength);if(!result.ok){showToast(result.message);return;}
    run=result.run;target.cooldown=2;target.windup=0;AudioEng.sfxHit();questEvent('stun',{monsterId:target.id});
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
    showToast((byWarrior?'護衛瞬間擊敗 ':'擊退 ')+target.def.name+(byWarrior?'，剩餘強度 '+(run.warrior?.strength||0)+'/5':'')+(reward?' · +12 銅幣':''),1800,false);
    if(byWarrior)guardFeedback('defeat');save();
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
    pendingWarriorReplacement=null;
    const offer=nearestWarrior.offer,affordable=Object.entries(offer.cost).every(([id,count])=>(id==='coin'?run.coins:run.bag[id]||0)>=count);
    const style=V.WARRIOR_STYLES[offer.strength];
    const ranks='<p>'+text(style.name+'：'+style.equipment+'，手持'+style.weapon)+'。</p><div class="tower-ranks" aria-label="強度 '+offer.strength+' 分，最高 5 分">'+Array.from({length:5},(_,i)=>'<span class="'+(i<offer.strength?'filled':'')+'"></span>').join('')+'</div>';
    dialog('旅途奇遇 · 護衛契約',offer.name,'「付出約定的報酬，我就替你擋住危險。你只管往下走。」','<section class="tower-guard-offer"><div><h3>戰士強度 '+offer.strength+' / 5</h3>'+ranks+'</div><div><h3>聘請報酬</h3><p>'+text(costText(offer.cost))+'</p></div></section>'+warriorRules()+'<p class="tower-copy">'+(run.warrior?'目前護衛 '+run.warrior.strength+' / 5 分，可確認解聘後改聘眼前戰士。原報酬不退還。':'只有按下「同意並聘請」才會扣除報酬。')+(!affordable?' 補給不足，可先向行商購買或探索收集。':'')+'</p>',action('暫不聘請','close')+action(run.warrior?'解聘並改聘…':'同意並聘請',run.warrior?'rehire-review':'hire',offer.id,!affordable),{summary:style.name+'，戰士強度 '+offer.strength+' 分。聘請需要 '+costText(offer.cost)+'。'+(run.warrior?'可解聘原護衛後改聘，原報酬不退還。':'')});
  }
  let pendingWarriorReplacement=null;
  function canHireWarrior(id) {
    return active&&G.running&&!G.shifting&&run.status==='playing'&&warriorNpc&&warriorNpc.model.visible&&warriorNpc.offer.id===id&&Math.hypot(G.px-warriorNpc.x,G.pz-warriorNpc.z)<2.6&&hasClearPath(G.px,G.pz,warriorNpc.x,warriorNpc.z);
  }
  function reviewWarriorReplacement(id) {
    if(!canHireWarrior(id)||!run.warrior)return;
    syncEngine();
    const offer=warriorNpc.offer,guard=run.warrior;
    pendingWarriorReplacement={id,oldId:guard.offerId,revision:run.revision};
    const warning='原護衛的報酬不退還，也不能再次聘回。'+(guard.mode==='holding'?' 原護衛正在牽制怪物；解聘後，該怪物會恢復行動！':'');
    dialog('旅途奇遇 · 護衛契約','要更換護衛嗎？',warning,'<section class="tower-guard-offer"><div><h3>原護衛 '+guard.strength+' / 5 分</h3><p>'+text(warriorStatus())+'</p></div><div><h3>新護衛 '+offer.strength+' / 5 分</h3><p>'+text(offer.name)+'</p><p>新聘費用：'+text(costText(offer.cost))+'</p></div></section>',action('保留原護衛','close')+action('確認解聘並聘請','rehire-confirm',id),{summary:'原護衛 '+guard.strength+' 分，新護衛 '+offer.strength+' 分。新聘需要 '+costText(offer.cost)+'。'+warning});
  }
  function hireWarrior(id,replace=false) {
    if(!canHireWarrior(id))return;
    const confirmation=pendingWarriorReplacement;
    if(replace&&(!confirmation||confirmation.id!==id))return;
    syncEngine();
    if(!transact(C.hireWarrior(run,id,replace?confirmation.revision:run.revision,replace?confirmation.oldId:null)))return;
    dismissEscort();
    const model=warriorNpc.model;escort={model,path:[],pathLeft:0};warriorNpc=null;nearestWarrior=null;
    refreshWarriorLabel();closeDialog();updateHud();showToast('護衛開始同行：強度 '+run.warrior.strength+'/5。靠近危險時會自動攔截。',3500);
  }
  function transact(result) {
    if(!result.ok){showToast(result.message||'目前無法進行');return false;}
    const previous=run,previousHunger=G.satiety;
    run=result.run;G.satiety=run.hunger;
    if(!save()){run=previous;G.satiety=previousHunger;showToast('未能保存，這次操作尚未生效。請保持分頁開啟並重試。',4000);return false;}
    if(modern()&&previous?.party?.loadouts?.active!==Heroes.state(run).active){partyUI?.switchControl(previous?.party?.loadouts?.active,Heroes.state(run).active);hurtLeft=Heroes.actor(run).hurt;}
    damageFeedback(result.effect);refreshGear();partyUI?.refreshActors();updateHud();return true;
  }
  function refreshGear() {
    if(!active||!run?.equipment||typeof playerGroup==='undefined'||!playerGroup||!V)return;
    if(run?.party?.loadouts){
      const who=Heroes.state(run).active;
      if(playerGroup.userData.heroIdentity!==who||playerGroup.userData.heroFloor!==world.uuid){
        const old=playerGroup,model=HeroVisual.base(Heroes.job(run),buildCharacter,who,Heroes.sex(run));model.position.copy(old.position);model.rotation.copy(old.rotation);old.parent?.remove(old);disposeSceneObject(old);scene.add(model);playerGroup=model;playerGroup.userData.heroIdentity=who;playerGroup.userData.heroFloor=world.uuid;G.charIdx=run.charIdx;gearVisual=null;gearSignature='';
      }
      HeroVisual.dress(THREE,playerGroup,run.equipment,disposeSceneObject,{showHelmet:Heroes.actor(run).showHelmet});return;
    }
    const signature=Object.values(run.equipment).map(g=>g?g.id:'-').join('|');
    if(signature===gearSignature)return;
    if(gearVisual){
      for(const piece of [gearVisual.userData.weapon,gearVisual.userData.shield])if(piece&&piece.parent!==gearVisual){piece.parent?.remove(piece);disposeSceneObject(piece);}
      playerGroup.remove(gearVisual);disposeSceneObject(gearVisual);
    }
    gearVisual=new THREE.Group();gearSignature=signature;
    playerGroup.userData.hasWeapon=!!run.equipment.weapon;playerGroup.userData.hasShield=!!run.equipment.shield;
    for(const part of playerGroup.userData.head?.children||[])if(part.name==='hair-crown'||part.name==='hair-fringe')part.visible=!run.equipment.helmet;
    for(const gear of Object.values(run.equipment).filter(Boolean)){
      const model=V.buildGear(gear.kind,{THREE}),mount=V.GEAR_MOUNTS[gear.kind];
      model.position.set(...mount.position);if(mount.rotation)model.rotation.set(...mount.rotation);
      if(gear.slot==='weapon'&&window.CharacterMotion){scene.add(model);window.CharacterMotion.worldWeaponPose(model,playerGroup,1-attackLeft/.8,G.view==='fp');}
      else if(gear.slot==='shield'&&playerGroup.userData.armL){
        model.position.set(.065,-.33,.09);model.rotation.set(0,Math.PI/3,0);
        playerGroup.userData.armL.add(model);gearVisual.userData.shield=model;
      }
      else gearVisual.add(model);
      if(gear.slot==='weapon')gearVisual.userData.weapon=model;
    }
    playerGroup.add(gearVisual);
  }
  function updateHeroFirstPerson(){
    if(heroFp?.parent!==world){heroFp=null;heroFpKind='';}
    if(G.view!=='fp'){if(heroFp)heroFp.visible=false;return;}
    const weapon=run.equipment.weapon,kind=weapon?.durability>0?weapon.kind:'',baseKind=Heroes.GEAR[kind]?.baseKind;
    const appearance={job:Heroes.job(run),sex:Heroes.sex(run)},signature=kind+'|'+appearance.job+'|'+appearance.sex;
    if(signature!==heroFpKind||!heroFp){
      if(heroFp){world.remove(heroFp);disposeSceneObject(heroFp);}
      heroFp=new THREE.Group();heroFp.name='hero-first-person-weapon';heroFpKind=signature;
      // First person renders its own pieces because the body is hidden. It
      // must still follow the actual two-hand rig and weapon-specific motion.
      heroFp.userData.poseMatrix=new THREE.Matrix4();heroFp.userData.parentInverse=new THREE.Matrix4();heroFp.userData.anchor=new THREE.Vector3();
      if(kind){heroFp.add(HeroVisual.gear(THREE,kind,appearance));if(['twin_daggers','robot_fists'].includes(baseKind))heroFp.add(HeroVisual.gear(THREE,kind,appearance));}
      else if(appearance.job==='robot')for(const source of [playerGroup.userData.armRBareFist,playerGroup.userData.armLBareFist])if(source){const copy=source.clone(true);copy.traverse(node=>{if(node.geometry)node.geometry=node.geometry.clone();if(node.material)node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();});heroFp.add(copy);}
      for(const piece of heroFp.children)piece.matrixAutoUpdate=false;
      world.add(heroFp);
    }
    if(appearance.job==='robot')HeroVisual.syncRobotLight?.(heroFp,{tier:playerGroup.userData.robotLightTier,color:playerGroup.userData.robotLightColor});
    heroFp.visible=true;playerGroup.updateWorldMatrix(true,true);world.updateWorldMatrix(true,false);
    const inverse=heroFp.userData.parentInverse,matrix=heroFp.userData.poseMatrix;
    // The sight system tests a dynamic group's origin. Anchor the FP group at
    // its owner, rather than the unseen maze origin, then copy relative poses.
    inverse.copy(world.matrixWorld).invert();heroFp.position.copy(heroFp.userData.anchor.setFromMatrixPosition(playerGroup.matrixWorld).applyMatrix4(inverse));
    heroFp.updateWorldMatrix(true,false);inverse.copy(heroFp.matrixWorld).invert();
    let i=0;
    const pieces=!kind&&appearance.job==='robot'?[playerGroup.userData.armRBareFist,playerGroup.userData.armLBareFist].filter(Boolean):playerGroup.userData.heroPieces||[];
    for(const source of pieces){
      if(kind&&source.userData.baseKind!==baseKind)continue;
      const piece=heroFp.children[i++];if(!piece)break;
      matrix.copy(source.matrixWorld);matrix.elements[13]+=.32;
      // Keep the authored matrix intact: nonuniform body proportions plus
      // wrist rotation contain shear that quaternion decomposition would lose.
      matrix.premultiply(inverse);piece.matrix.copy(matrix);piece.matrixWorldNeedsUpdate=true;piece.visible=source.visible;
      if(baseKind==='spellbook')HeroVisual.bookPose?.(piece,source.userData.bookOpen||0);
    }
    for(;i<heroFp.children.length;i++)heroFp.children[i].visible=false;
  }
  function gearDescription(gear) {
    if(modern())return partyUI.heroes.info(gear);
    if(run?.party)return '耐久 '+gear.durability+'/'+gear.maxDurability+' · '+(gear.slot==='weapon'?'攻擊 '+({bat:15,pan:13,staff:11}[gear.kind]+gear.bonus*2)+' · 短暫暈眩':'防禦 '+gear.defense)+(gear.bonus?' · 強化 +'+gear.bonus:'')+(gear.forge?' · '+window.TowerExpedition.TRAITS[gear.forge.trait].name+' '+gear.forge.level+'/2'+(gear.forge.trait==='durable'?'（耐用保護剩 '+gear.forge.reserve+' 次）':''):'');
    return '耐久 '+gear.durability+'/'+gear.maxDurability+' · '+(gear.slot==='weapon'?'基礎擊暈 '+C.GEAR[gear.kind].stunSeconds+' 秒':'防禦 '+gear.defense)+(gear.bonus?' · 強化 +'+gear.bonus:'');
  }
  function gearCard(gear,equipped=false) {
    return '<article class="tower-item tower-gear-card'+(gear.bonus?' rare':'')+'"><h3>'+text(gear.name)+(equipped?' <small>穿戴中</small>':'')+'</h3><p>'+text(gearDescription(gear))+'</p><meter min="0" max="'+gear.maxDurability+'" value="'+gear.durability+'" aria-label="耐久度"></meter>'+(!equipped?action('裝備','equip',gear.id):'')+action('捨棄','discard-ask',gear.id)+'</article>';
  }
  function questEvent(event,data) {
    if(inDungeon())return false;
    const q=run?.adventure?.quest;
    if(!q||q.status!=='active'||q.type!==event&&!(modern()&&q.type==='stun'&&['defeat','root'].includes(event)))return false;
    const result=E.questProgress(run,event,data);if(!result.ok)return false;
    run=result.run;save();if(result.effect?.ready)showToast('委託完成！請找探索者領取報酬。',3000);else if(event==='survey'&&E.surveyTargets?.(run).length)showToast('已畫下這個區塊 · '+run.adventure.quest.progress+'/'+run.adventure.quest.goal,2200);return true;
  }
  function updateExplorer(dt,now) {
    if(!explorer||run.adventure.quest?.type!=='escort'||run.adventure.quest.status!=='active')return;
    const moving=followNpc(explorer,dt,5.5,1.2,{x:G.px,z:G.pz},{direct:true});
    explorer.model.userData.legL.rotation.x=moving?Math.sin(now*.008)*.3:0;explorer.model.userData.legR.rotation.x=-explorer.model.userData.legL.rotation.x;
    const portal=cellToWorld(G.exitCell.x,G.exitCell.y),p=explorer.model.position,distance=Math.hypot(p.x-portal.x,p.z-portal.z);
    // questProgress refuses a traveller farther than 2.8 m or out of sight of the stairs.
    if(distance<=2.8&&Math.hypot(G.px-portal.x,G.pz-portal.z)<2.2&&nearExplorer()&&hasClearPath(p.x,p.z,portal.x,portal.z))questEvent('escort',{atExit:true,distance});
  }
  function nearExplorer() { return !inDungeon()&&explorer&&Math.hypot(G.px-explorer.model.position.x,G.pz-explorer.model.position.z)<2.8&&hasClearPath(G.px,G.pz,explorer.model.position.x,explorer.model.position.z); }
  function rewardDescription(reward) {
    return [reward.coins?reward.coins+' 銅幣':'',...Object.entries(reward.items||{}).map(([id,n])=>C.ITEMS[id].name+' × '+n),reward.gear?reward.gear.name+'（'+gearDescription(reward.gear)+'）':''].filter(Boolean).join(' ＋ ');
  }
  function gearSpeech(gear) { return C.GEAR[gear.kind]?.name||gear.name; }
  function rewardSpeech(reward) {
    return '獲得 '+[reward.coins?'銅幣':'',...Object.keys(reward.items||{}).map(id=>C.ITEMS[id].name),reward.gear?gearSpeech(reward.gear):''].filter(Boolean).join('、');
  }
  function questDialog(quiet=false,viewOnly=false,localOnly=false) {
    if(!active||G.shifting||run.status!=='playing')return;
    if(viewOnly&&!localOnly&&lordCounterPanel())return;
    if(viewOnly&&!localOnly&&followupPanel())return;
    const offer=E.explorerOffer(run),q=run.adventure.quest;
    if(!offer||(!q&&!nearExplorer())||viewOnly&&(!q||q.status==='claimed')){dialog('探索者委託','目前未接受任何任務','靠近迷宮中的探索者交談，可以接受委託。','',action('回到迷宮','close'),{summary:'目前未接受任何任務。'});return;}
    if(explorer)explorer.offer=offer;
    const target=monsters.find(m=>m.id===offer.target);
    const copy=offer.description+(target?' 目標：'+target.def.name+'（原始強度 '+target.strength+'/5）；接受後頭頂會標示「委託目標」。':'')+(q?' 進度 '+q.progress+' / '+q.goal:'');
    let actions=action('繼續探索','close');
    if(!q)actions+=action('接受委託','quest-accept',offer.id,!nearExplorer()||inDungeon());
    else if(q.status==='ready')actions+=action('領取報酬','quest-reward',null,!nearExplorer());
    else if(q.status==='active'&&q.type==='donate')actions+=action('交付 '+q.goal+' 份'+C.ITEMS[q.target].name,'quest-donate',null,!nearExplorer()||run.bag[q.target]<q.goal);
    const person=explorerIdentity(),after=!q?[offer.title,copy,'完成報酬：'+rewardDescription(offer.reward),'繼續探索','接受委託'].join('。'):'';
    dialog(explorerName(),q?.status==='claimed'?'感謝你的幫助':offer.title,copy,((q?.type||offer.type)==='relic'?'<p class="tower-copy">'+(window.TowerResourceIcons?.svg('questFragment')||'')+'委託記憶碎片</p>':'')+(!q?'<p class="tower-copy">'+text(person.greeting||'')+'</p>':'')+'<section class="tower-guard-summary"><h3>完成報酬</h3><p>'+text(rewardDescription(offer.reward))+'</p></section><p class="tower-copy">離開本層、保存回首頁或重整挑戰會解除未結案委託；報酬必須向探索者領取。進出口前會再次確認。裝備放入行囊後請自行穿戴。</p>',actions,{full:true,silent:quiet===true,asset:!q?'explorer.'+person.id:'',afterText:after,speaker:window.MazeRoleVoices?.profiles?.['explorer.'+person.id]});
  }
  function chestDialog() {
    if(!chest||!chest.model.visible)return;
    dialog('迷宮奇遇','開啟封印寶箱？','可能獲得強化裝備，也可能觸發陷阱。穿戴防具能減少陷阱傷害，但防具會消耗耐久。','<p class="tower-copy">每層有 20% 機會出現。內容已固定，開啟後不會因變形或讀檔重新出現。</p>',action('先不開啟','close')+action('打開寶箱','chest-open',chest.offer.id));
  }
  function openChest(id) {
    if(!chest||!chest.model.visible||Math.hypot(G.px-chest.x,G.pz-chest.z)>=2.6||!hasClearPath(G.px,G.pz,chest.x,chest.z))return;
    const result=E.openChest(run,id,run.revision,hurtLeft>0);if(!transact(result))return;
    chest.model.visible=false;nearbyEncounter=null;
    if(run.status==='dead'){defeat();return;}
    if(result.effect.outcome==='gear')partyUI?.heroes?.suggestUpgrade?.(result.effect.gear.id);
    const copy=result.effect.outcome==='gear'?result.effect.gear.name+' · '+gearDescription(result.effect.gear)+'，已放入裝備行囊。':'陷阱造成 '+result.effect.damage+' 點傷害。'+(result.effect.revived?'復甦羽保護了你。':'防具已按命中消耗耐久。');
    dialog('寶箱已開啟',result.effect.outcome==='gear'?'獲得強化裝備':'小心，是陷阱！',copy,'',action('查看裝備','bag')+action('繼續前進','close'),{silent:result.effect.outcome==='gear',summary:result.effect.outcome==='gear'?'獲得 '+gearSpeech(result.effect.gear):'小心，是陷阱！'});
    if(result.effect.outcome==='gear')window.GameVoice?.announce('獲得 '+gearSpeech(result.effect.gear),true);
  }
  function inventory(quiet=false) {
    if(!active||G.shifting||run.status!=='playing')return;
    syncEngine();
    const supplyCard=([id,item])=>{
      const guide=window.TowerFieldGuide?.item(id,run),owned=run.bag[id]||0;
      return '<article class="tower-item supply-card'+(owned?'':' is-empty')+'">'+(window.TowerHeroIcons?.svg('item_'+id)||'')+'<h3>'+text(item.name)+' <span>×'+owned+'</span></h3><p>'+text(guide?.effect||item.description||item.desc||'高塔冒險補給')+'</p>'+(guide?'<details class="supply-guide"><summary>何時使用？</summary><p>'+text(guide.when)+'</p><small>'+text(guide.caution)+'</small></details>':'')+action(id==='arrow'?'射擊自動消耗':id==='feather'?'瀕死自動使用':'使用','use',id,!owned||['arrow','feather'].includes(id))+'</article>';
    };
    const supplies=Object.entries(C.ITEMS).filter(([id])=>id!=='coin'&&(id!=='arrow'||modern())).sort(([a],[b])=>Number(!!run.bag[b])-Number(!!run.bag[a]));
    const lightCard=run.party&&lightingUI?'<article class="tower-item supply-light'+(modern()?' is-compact':'')+'"><div><h3>照明工具</h3><p>火把五分鐘 · 日光術十分鐘</p></div>'+action('照明補給','light-panel')+'</article>':'';
    const cards=lightCard+supplies.map(supplyCard).join('');
    const stats=C.equipmentStats(run),worn=Object.values(run.equipment).filter(Boolean).map(g=>gearCard(g,true)).join(''),stored=run.gearBag.map(g=>gearCard(g)).join('');
    if(modern()){
      // One place to see what the party carries; usable supplies first and the
      // rest folded away, so the first screen is never a wall of empty cards.
      const owned=supplies.filter(([id])=>run.bag[id]>0),missing=supplies.filter(([id])=>!(run.bag[id]>0)),sum=list=>Object.values(list||{}).reduce((a,b)=>a+(Number(b)||0),0);
      const chip=(icon,label,value)=>'<span class="bag-chip">'+icon+'<span>'+text(label)+'</span><b>'+text(value)+'</b></span>';
      const overview='<section class="bag-overview" aria-label="隊伍持有資源">'+chip(window.TowerResourceIcons?.svg('coin')||'','銅幣',run.coins)+chip(window.TowerResourceIcons?.svg('scrap')||'','零件',run.party.journey.scrap+'／99')+chip(window.TowerPartyRuntime?.foodArt?.('herb')||'','食材',sum(run.party.ingredients)+' 份')+chip(window.TowerResourceIcons?.svg('ironore')||'','鍛造素材',sum(run.party.journey.materials)+' 份')+chip('','裝備行囊',run.gearBag.length+'／'+(C.isUnderworld(run)?28:24))+'</section>';
      const body=overview+'<h3 class="bag-section-title">可以使用 · '+owned.length+' 種</h3><div class="tower-grid">'+lightCard+(owned.map(supplyCard).join('')||'')+'</div>'+(owned.length?'':'<p class="bag-empty">目前沒有可使用的補給，可向雜貨商購買或在迷宮拾取。</p>')+(missing.length?'<details class="bag-more"><summary>還沒有的補給 · '+missing.length+' 種</summary><div class="tower-grid">'+missing.map(supplyCard).join('')+'</div></details>':'');
      dialog('旅人背包 · 暫停中','生存補給','',body,action('隊伍裝備','hero-panel',Heroes.state(run).active)+action('料理','party-kitchen')+(window.TowerAlchemy?.makers(run).length?action('藥水製作','party-alchemy'):'')+(P.has(run,'chef')?action('食譜研發','party-lab'):'')+action('生物誌','party-bestiary')+(run.party.boss&&!inDungeon()?action('機關說明','party-boss-help'):'')+(AdventureEvents?.guardNotice?.(run)?action('樓主護罩','adventure-lord-help'):'')+action('任務','quest-view')+returnAction()+action('回到迷宮','close'),{silent:quiet===true,summary:'生存補給。選擇道具，或開啟隊伍管理。'});return;}
    if(run.party){
      const body='<section class="tower-guard-summary"><h3>防禦 '+stats.defense+' · 強化 +'+stats.bonus+'</h3><p>武器可直接討伐怪物，命中消耗一點耐久；短暫暈眩後，怪物會有四秒抗暈期。三件防具受擊各消耗一點耐久。武器損壞後仍可徒手攻擊。</p></section><h3>穿戴中</h3><div class="tower-grid">'+(worn||'<p>尚未穿戴裝備。</p>')+'</div><h3>裝備行囊 '+run.gearBag.length+'/24</h3><div class="tower-grid">'+stored+'</div><h3>生存補給</h3><div class="tower-grid">'+cards+'</div>';
      dialog('旅人背包 · 暫停中','裝備與補給','生命 '+Math.ceil(run.hp)+' / '+C.MAX_HP+' · 飽足 '+Math.ceil(run.hunger)+'% · 銅幣 '+run.coins,body,action('隊伍','party-team')+action('食材與料理','party-kitchen')+action('鍛匠工坊','party-forge')+(window.TowerAlchemy?.makers(run).length?action('藥水製作','party-alchemy'):'')+(P.has(run,'chef')?action('食譜研發','party-lab'):'')+(run.party.boss&&!inDungeon()?action('本層機關說明','party-boss-help'):'')+(AdventureEvents?.guardNotice?.(run)?action('樓主護罩說明','adventure-lord-help'):'')+action('生物誌','party-bestiary')+action('故事日誌','journal')+action('任務日誌','quest')+(inDungeon()?action('副本目標','dungeon-brief'):'')+action('回到迷宮','close')+action('保存並離開','quit'),{silent:quiet===true,summary:'裝備與補給。可以更換裝備、使用道具，或查看隊伍、料理與鍛匠工坊。'});return;
    }
    dialog('旅人背包 · 暫停中','裝備與補給','生命 '+Math.ceil(run.hp)+' / '+C.MAX_HP+' · 飽足 '+Math.ceil(run.hunger)+'% · 銅幣 '+run.coins,'<section class="tower-guard-summary"><h3>防禦 '+stats.defense+' · 強化 +'+stats.bonus+' · 擊暈 '+stats.stunSeconds+' 秒</h3><p>每次命中，三件已穿防具各減 1 耐久；武器命中減 1。每點已穿裝備強化增加 10 秒擊暈，耐久耗盡即損壞。</p></section><h3>穿戴中</h3><div class="tower-grid">'+(worn||'<p>尚未穿戴裝備。</p>')+'</div><h3 class="tower-section-title">裝備行囊 '+run.gearBag.length+'/24</h3><div class="tower-grid">'+(stored||'<p>商人與寶箱取得的裝備會放在這裡。</p>')+'</div><h3 class="tower-section-title">生存補給</h3><div class="tower-grid">'+cards+'</div><section class="tower-guard-summary"><h3>'+text(warriorStatus())+'</h3></section>'+warriorRules(),(N?action('故事日誌','journal'):'')+action('任務日誌','quest')+(inDungeon()?action('副本目標','dungeon-brief'):'')+action('回到迷宮','close')+action('保存並離開','quit'),{silent:quiet===true,summary:'裝備與補給。穿戴中：'+(Object.values(run.equipment).filter(Boolean).map(gearSpeech).join('、')||'尚未穿戴裝備')+'。可以更換裝備或使用補給。'});
  }
  function trade(quiet=false,direct=false) {
    if(!active||G.shifting||run.status!=='playing')return;
    // "回到商店" goes straight back to the stall instead of re-resolving the nearest interaction.
    if(!direct){
    if(nearbyAdventure&&!quiet){adventureDialog();return;}
    if(partyUI?.interact())return;
    if(nearbyJourney){if(nearbyJourney===mainClue)mainClueDialog();else if(nearbyJourney===rift)riftDialog();else if(nearbyJourney===huntGate)huntDialog();else dungeonObjectDialog(nearbyJourney.index);return;}
    if(nearbyEncounter){if(nearbyEncounter===chest)chestDialog();else questDialog();return;}
    if(nearestWarrior){warriorDialog();return;}
    if(!nearest&&canObserveLandmark()&&!quiet){observeLandmark();return;}
    }
    if(!active||G.shifting||!nearest||run.status!=='playing')return;
    syncEngine();menuReturn={kind:'trade',merchant:nearest.id};
    const grocer=nearest.id===E.GROCERY.merchantId,hunter=nearest.id===E.HUNTER?.merchantId,ingredients=E.INGREDIENT_MERCHANTS?.includes(nearest.id)&&run.party?E.groceryOffers(run,nearest.id):[],scrollTop=quiet?(el('towerDialog').querySelector('.tower-dialog-content')?.scrollTop||0):0;
    if(!quiet||tradeMerchant!==nearest.id){tradeCategory='supplies';tradeMerchant=nearest.id;}
    if(!ingredients.length)tradeCategory='supplies';if(hunter)tradeCategory='ingredients';
    const heading=(art,name,stat)=>art+'<div><h3>'+text(name)+'</h3><small>'+text(stat)+'</small></div><span class="trade-detail-indicator" aria-hidden="true">⌄</span>';
    const scrap=grocer&&run.party?window.TowerExpedition?.scrapOffer?.(run):null;
    const scrapMost=scrap?Math.min(scrap.remaining,scrap.room):0,scrapBlocked=!scrap?'':!scrap.remaining?'本層已售完':!scrap.room?'零件袋已滿':'';
    const scrapButtons=!scrap?'':scrapBlocked?action(scrapBlocked,'buy-scrap','1',true):[...new Set([1,scrapMost])].map(n=>action(run.coins<scrap.price*n?'銅幣不足 · '+scrap.price*n+' 幣':'買 '+n+' 份 · '+scrap.price*n+' 幣','buy-scrap',String(n),run.coins<scrap.price*n)).join('');
    const scrapCard=scrap?'<article class="tower-item grocery-supply grocery-scrap"><details class="trade-item-details"><summary>'+heading(window.TowerResourceIcons?.svg('scrap')||'','金屬零件','持有 '+scrap.owned+'／99 · 本層剩 '+scrap.remaining+'/'+scrap.stock)+'</summary><p>修理、鍛造、機器人機件與部分技能都會用到；拆解裝備也能回收。每層限購 '+scrap.stock+' 份。</p></details><div class="trade-card-actions">'+scrapButtons+'</div></article>':'';
    const cards=(lightingUI?.merchantCard(nearest.id)||'')+scrapCard+nearest.offer.supplies.map(id=>{
      const item=C.ITEMS[id],quantity=id==='arrow'?Math.max(0,Math.min(10,C.itemLimit('arrow',run)-run.bag.arrow)):1,cost=C.supplyPrice(id,quantity),full=run.bag[id]>=C.itemLimit(id,run);
      return '<article class="tower-item grocery-supply"><details class="trade-item-details"><summary>'+heading(window.TowerHeroIcons?.svg(Heroes?.ROBOT?.FUEL_ITEMS[id]?id:'item_'+id)||'',item.name,'持有 '+run.bag[id]+'／'+C.itemLimit(id,run))+'</summary><p>'+text(item.description)+'</p></details><div class="trade-card-actions">'+action(full?(id==='arrow'?'箭袋已滿':'已達上限'):run.coins<cost?'銅幣不足 · '+cost+' 幣':(id==='arrow'&&quantity<10?'補滿'+' '+quantity+' 支':'買'+(id==='arrow'?' '+quantity+' 支':''))+' · '+cost+' 幣','buy',id,full||quantity===0||run.coins<cost)+(item.sellPrice>0?action('賣 '+item.sellPrice+' 幣','sell',id,!run.bag[id]):'')+'</div></article>';
    }).join('');
    const ingredientCards=ingredients.map(offer=>'<article class="tower-item grocery-ingredient'+(offer.specialty?' is-specialty':'')+'" data-grocery-offer="'+text(offer.id)+'"><details class="trade-item-details"><summary>'+heading(window.TowerPartyRuntime?.foodArt(offer.ingredientId)||'',offer.ingredientId==='herb'?offer.name+'（藥草）':offer.name,'持有 '+run.party.ingredients[offer.ingredientId]+' · 剩 '+offer.remaining+'/'+offer.stock)+'</summary><p>'+(offer.hunter?'魔物獵人的獵獲 · 各層稀罕食材，可用於食譜研發':offer.specialty?'遠方特產 · '+text(floorLabel(offer.sourceFloor)+' · '+offer.sourceName):'常用食材')+'；本層限量，不會補貨。</p></details><div class="trade-card-actions">'+action(!offer.remaining?'本層已售完':run.party.ingredients[offer.ingredientId]>=99?'食材袋已滿':run.coins<offer.price?'銅幣不足 · '+offer.price+' 幣':'買 1 份 · '+offer.price+' 幣','buy-ingredient',offer.id,!offer.remaining||run.party.ingredients[offer.ingredientId]>=99||run.coins<offer.price)+'</div></article>').join('');
    // Gear is grouped by body slot and tells who in the party can use it and
    // how it compares, so a long late-floor stock reads at a glance.
    const fit=gear=>{if(!modern()||!Heroes?.GEAR?.[gear.kind])return '';const users=Heroes.ids(run).filter(id=>Heroes.canEquip?.(run,id,gear));if(!users.length)return '<small class="trade-fit is-muted">隊伍目前無人可用 · '+text(Heroes.GEAR[gear.kind].jobs.map(j=>Heroes.JOBS[j]?.name||j).join('、'))+'</small>';
      // Compare against every member who could wear it and show the biggest upgrade.
      let best=null;for(const id of users){const gains=(window.TowerEquipmentCompare?.compare(Heroes,run,id,gear)?.deltas||[]).filter(d=>d.delta&&d.good),score=gains.reduce((sum,d)=>sum+Math.abs(d.delta)*(d.key==='interval'||d.key==='heal'?10:1),0);if(gains.length&&(!best||score>best.score))best={id,gains,score};}
      const gain=best?.gains.slice(0,2).map(d=>d.label+' '+(d.delta>0?'+':'')+d.delta+d.unit).join('、'),jobs=users.map(id=>Heroes.JOBS[Heroes.job(run,id)]?.name).filter((n,i,a)=>a.indexOf(n)===i).join('、');
      return '<small class="trade-fit'+(gain?' is-good':'')+'">'+text(jobs)+' 可用'+(gain?' · '+text((users.length>1?Heroes.JOBS[Heroes.job(run,best.id)]?.name+' ':'')+gain):'')+'</small>';};
    const gearCardHtml=({kind,gear,price})=>{const sold=run.adventure.claimed.includes('stock:'+run.floor+':'+nearest.id+':'+kind);return '<article class="tower-item tower-gear-card"><details class="trade-item-details"><summary>'+heading(window.TowerHeroIcons?.svg(kind)||'',gear.name,'耐久 '+gear.durability+'/'+gear.maxDurability)+'</summary><p>'+text(gearDescription(gear))+'</p></details>'+fit(gear)+'<div class="trade-card-actions">'+action(sold?'本層已售出':run.coins<price?'銅幣不足 · '+price+' 幣':'購買 '+price+' 幣','buy-gear',kind,sold||run.coins<price)+'</div></article>';};
    const SLOT_GROUPS=[['weapon','武器'],['helmet','頭部'],['armor','身體'],['shield','盾牌']],slotOf=entry=>entry.gear.slot;
    const groups=[...SLOT_GROUPS,['','其他']].map(([slot,label])=>[label,nearest.offer.gear.filter(entry=>slot?slotOf(entry)===slot:!SLOT_GROUPS.some(([s])=>s===slotOf(entry)))]).filter(([,list])=>list.length);
    const gear=groups.length>1?groups.map(([label,list])=>'<h3 class="trade-group-title">'+text(label)+' <small>'+list.length+' 件</small></h3><div class="tower-grid trade-stock-grid">'+list.map(gearCardHtml).join('')+'</div>').join(''):'<div class="tower-grid trade-stock-grid">'+nearest.offer.gear.map(gearCardHtml).join('')+'</div>';
    const stockVoice=grocer?'這裡可以買藥品、道具與限量食材，也可以委託料理。':hunter?'這裡可以買各層的稀罕食材，拿去廚房做食譜研發。':('出售：'+nearest.offer.gear.map(g=>gearSpeech(g.gear)).join('、')+'。也可以維護與強化裝備。');
    const voiceSummary=nearest.name+'。'+stockVoice;
    const tabs=grocer&&ingredients.length?'<nav class="trade-categories" aria-label="商品分類">'+['supplies','ingredients'].map(id=>'<button class="tower-btn" data-tower="trade-tab" data-item="'+id+'" aria-pressed="'+(tradeCategory===id)+'">'+(id==='supplies'?'藥品與道具':'限量食材')+'</button>').join('')+'</nav>':'';
    const notes='<p>'+text(nearest.offer.greeting||'')+'</p><p>'+(grocer?'藥品、食材與道具可在這裡購買；限量食材本層售完不補貨。已解鎖菜色也能自備材料委託料理。':hunter?'六樣各層稀罕食材隨機上架，每份 '+(E.HUNTER?.price??5)+' 幣，本層售完不補貨；配合廚師的食譜研發，命中就能記下隱藏食譜。':'裝備放入背包後可更換穿戴；每件本層限一件。'+(run.party?'本店維護及強化費比隊內鍛匠多 20%，材料不加價。':'')+'藥品、食材與道具請向雜貨商購買。')+'</p>';
    const help=window.TowerCompactHelp?.render(grocer?'雜貨與委託說明':hunter?'獵獲食材說明':'購買與維護說明',notes)||notes;
    const stock=help+(grocer?tabs+'<section class="grocery-stock" data-trade-category="supplies"'+(tradeCategory!=='supplies'?' hidden':'')+'><div class="tower-grid trade-stock-grid">'+cards+'</div></section><section class="grocery-stock" data-trade-category="ingredients"'+(tradeCategory!=='ingredients'?' hidden':'')+'><div class="tower-grid trade-stock-grid">'+ingredientCards+'</div></section>':hunter?'<section class="grocery-stock" data-trade-category="ingredients"><div class="tower-grid trade-stock-grid">'+ingredientCards+'</div></section>':gear);
    dialog(nearest.name+' · 行商營地',grocer?'旅行雜貨與遠方食材':hunter?'各層稀罕食材':'專門裝備與維護','',stock,(run.party?(grocer?action('委託料理','commission-cooking'):hunter?(P.has(run,'chef')?action('食譜研發','party-lab'):''):action('維護與強化','party-merchant-forge',nearest.id)):'')+(modern()&&!grocer&&!hunter?action('隊伍裝備','hero-panel',Heroes.state(run).active):action('背包','bag'))+action('結束交易','close'),{silent:quiet===true,commerce:grocer||hunter?'grocery':'merchant',wallet:run.coins,summary:voiceSummary,asset:'merchant.'+nearest.id,afterText:stockVoice+'。'+(modern()&&!grocer&&!hunter?'隊伍裝備':'背包')+'。結束交易。'});
    if(quiet)el('towerDialog').querySelector('.tower-dialog-content').scrollTop=scrollTop;
  }
  function cookingServiceReady(){
    return !!(Cooking&&active&&G.running&&!G.shifting&&run?.status==='playing'&&run.party&&!inDungeon()&&nearest?.id===E.GROCERY.merchantId&&Math.hypot(G.px-nearest.x,G.pz-nearest.z)<2.6&&hasClearPath(G.px,G.pz,nearest.x,nearest.z));
  }
  function cookingMaterials(recipe){return '<div class="party-costs" aria-label="原配方材料">'+Object.entries(recipe.cost).map(([id,need])=>{const have=run.party.ingredients[id];return '<span class="party-cost'+(have<need?' missing':'')+'">'+window.TowerPartyRuntime.foodArt(id)+'<span>'+text(P.INGREDIENTS[id])+' <b>'+have+'/'+need+'</b>'+(have<need?'<small>缺 '+(need-have)+'</small>':'')+'</span></span>';}).join('')+'</div>';}
  function commissionCooking(quiet=false){
    pendingCooking=null;if(!cookingServiceReady()){showToast('請靠近雜貨商蘇禾，再委託料理。');return;}menuReturn={kind:'trade',merchant:nearest.id};
    const cards=Cooking.recipes(run,nearest.id).map(q=>{const recipe=P.RECIPES[q.recipeId],reason=!q.allowed?q.reason:run.coins<q.fee?'代煮費不足':q.missing.length?'材料不足':'';
      return '<article class="tower-item grocery-supply" data-commission-recipe="'+text(q.recipeId)+'"><details class="trade-item-details"><summary>'+window.TowerPartyRuntime.dishArt(q.recipeId)+'<div><h3>'+text(recipe.name)+'</h3><small>'+text(q.categoryName)+' · 代煮 '+q.fee+' 幣 · 備好 '+q.owned+' 份</small></div><span class="trade-detail-indicator" aria-hidden="true">⌄</span></summary>'+cookingMaterials(recipe)+'<p>生命 +'+recipe.hp+' · 飽食 +'+recipe.hunger+(recipe.team?' · 全隊 +'+recipe.team:'')+(recipe.buff?' · '+text(P.BUFFS[recipe.buff]):'')+'</p></details><div class="trade-card-actions">'+action(reason||'委託一份 · '+q.fee+' 幣','commission-cook-ask',q.recipeId,!q.allowed||!q.affordable)+'</div></article>';}).join('');
    const notes='<p>自備原配方材料，依難度付費；每次一份。基本2幣、精製5幣、盛宴8幣、地下12幣。沒有廚師也可委託已解鎖菜色，地下仍有深度限制。不套用廚師雙份與省料效果。確認後才扣材料與費用，取消不消耗。</p>';
    dialog('蘇禾 · 代煮服務','委託料理','',(window.TowerCompactHelp?.render('代煮規則與收費',notes)||notes)+'<div class="tower-grid trade-stock-grid">'+cards+'</div>',action('回到雜貨攤','commission-cook-back')+action('已備料理','party-kitchen')+action('結束交易','close'),{silent:quiet,commerce:'grocery',wallet:run.coins,summary:'委託料理。自備原配方材料，依難度付費。選擇料理後再確認。'});
  }
  function confirmCooking(recipeId){
    if(!cookingServiceReady()){pendingCooking=null;showToast('作業位置已改變，請重新靠近蘇禾。');return;}
    const q=Cooking.quote(run,recipeId,nearest.id);if(!q.allowed||!q.affordable){showToast(q.reason||'食材或代煮費不足，尚未扣款。');return;}
    pendingCooking={recipeId,merchantId:nearest.id,floor:run.floor,seed:run.seed,revision:run.revision};
    dialog('委託料理確認',q.name,'使用下列原配方材料，另付 '+q.fee+' 枚銅幣。確認後獲得一份，取消不扣任何物資。',cookingMaterials(P.RECIPES[recipeId]),action('取消','commission-cooking')+action('確認代煮 · '+q.fee+' 幣','commission-cook-confirm',recipeId),{commerce:'grocery',wallet:run.coins,summary:'確認委託'+q.name+'，代煮費'+q.fee+'枚銅幣。'});
  }
  function useItem(id) {
    syncEngine();const before={...run.effects};
    // Bag use pauses simulation, including the combat-item cooldown. Refuel
    // through the atomic core API so deliberate repeated bag taps can finish.
    // Live quick slots and automatic items still use their normal cooldowns.
    const bagFuel=paused&&modern()&&Heroes.ROBOT.fuelItemIds.includes(id);
    const result=bagFuel?Heroes.ROBOT.useFuel(run,id):C.useItem(run,id),readyShovels=result.ok&&id==='shovel'?result.run.engine.shovels:null;
    if(!transact(result))return;
    AudioEng.sfxAction?.(window.CombatAudio?.itemKind(id)||'device');
    // A spare shovel becomes the ready one on the HUD at once. Saving rebuilds run.engine from G, so the
    // count is taken from the transaction result rather than from the copy that was just overwritten.
    if(readyShovels!==null){G.shovels=readyShovels;run.engine.shovels=readyShovels;if(typeof updateShovelBtn==='function')updateShovelBtn();}
    const mul=run.party?1:CH().itemDurMul||1;for(const key of Object.keys(run.effects))if(key!=='haste'&&run.effects[key]>before[key])run.effects[key]*=mul;
    if(!run.party&&id==='ration'&&CH().foodMul)G.satiety=run.hunger=Math.min(100,run.hunger+45*(CH().foodMul-1));
    if(id==='map'){window.MagicMap?.reveal();const p=worldToCell(G.px,G.pz);G.solutionPath=solveMaze(p.x,p.y);G.mapUntil=performance.now()+run.effects.reveal*1000;}
    save();inventory(true);window.GameVoice?.announce('使用 '+C.ITEMS[id].name,true);
  }
  function exitUnlocked(){
    if(!active||!run||run.status!=='playing')return false;
    if(inDungeon())return dungeonComplete();
    // Optional commissions remain optional. Chapter clues, maze seals and
    // floor lords use the same authoritative rules as descending itself.
    return (!N||N.canDescend(run))&&(!run.party||P.canDescend(run));
  }
  function reachExit(confirmed=false) {
    if(!active||paused||!G.running||run.status!=='playing'||(exitDeclined&&!confirmed))return;
    if(!exitUnlocked()||(typeof towerStairReveal!=='undefined'&&towerStairReveal?.revealing))return;
    if(inDungeon()){
      exitDeclined=true;
      const hunt=dungeonOffer()?.hunt;
      if(dungeonComplete()){if(confirmed){finishDungeon('completed');return;}dialog('副本向下樓梯',hunt?'討伐完成，要回到主塔嗎？':'要帶著記憶回到主塔嗎？','本次挑戰已完成，也可以先留在副本看看。','',action('留在本層','close')+action('返回主塔並領獎','exit-confirm'));return;}
      dialog('副本出口',hunt?'還有目標沒有擊倒':'還有記憶沒有帶回','目前已完成 '+(hunt?huntTally()+' / '+dungeonOffer().required.length:run.expedition.active.progress.length+' / 3')+'；完成後再回來領取報酬。','',action(hunt?'繼續討伐':'繼續尋找','close')+action('退出副本','dungeon-leave'));return;
    }
    // Do not open a pausing confirmation while the escort is still catching up.
    // Completion is also checked every frame, independently of chapter gates.
    const escort=run.adventure.quest;
    if(!confirmed&&escort?.type==='escort'&&escort.status==='active'&&explorer){
      const portal=cellToWorld(G.exitCell.x,G.exitCell.y),p=explorer.model.position;
      if(nearExplorer())questEvent('escort',{atExit:hasClearPath(p.x,p.z,portal.x,portal.z),distance:Math.hypot(p.x-portal.x,p.z-portal.z)});
      if(run.adventure.quest.status==='active')return;
    }
    if(N&&!N.canDescend(run)){
      exitDeclined=true;const chapter=N.chapterForFloor(run.floor);
      dialog('主線尚未完成','門上缺少一枚印記','找到「'+chapter.clueName+'」才能打開下一章的門。小地圖金色「印」標記指向線索，靠近後按「印記 R」。','',action('返回尋找','close')+action('故事日誌','journal'));return;
    }
    if(run.party&&!P.canDescend(run)){exitDeclined=true;const lord=Lords.forRun(run);dialog('魔王樓層','樓梯尚未開啟',(run.party.boss&&!run.party.boss.done?'需要先解除「'+P.BOSS_FLOORS[run.floor].name+'」的迷宮機關。':'迷宮機關已解除。')+(lord&&!Lords.defeated(run)?' 還要擊敗樓層主「'+lord.name+'」。':' 樓層主已擊敗。'),'小地圖數字可找到機關；樓層主不會隨變形重生。',action('留在本層','close'));return;}
    let q=run.adventure.quest;
    if(q&&q.status!=='claimed'&&!confirmed){
      const portal=cellToWorld(G.exitCell.x,G.exitCell.y);
      if(q.type==='escort'&&explorer)questEvent('escort',{atExit:hasClearPath(explorer.model.position.x,explorer.model.position.z,portal.x,portal.z),distance:Math.hypot(explorer.model.position.x-portal.x,explorer.model.position.z-portal.z)});
      q=run.adventure.quest;exitDeclined=true;
      dialog('出口確認',q.status==='ready'?'還有委託報酬尚未領取':'本層還有進行中的委託','下降後會解除本層委託，尚未領取的報酬也會失去。你可以先繼續探索。','<p class="tower-copy">'+text(E.explorerOffer(run)?.title||'探索者委託')+' · '+q.progress+'/'+q.goal+'</p>',action('留在本層','close')+(q.status==='ready'&&nearExplorer()?action('領取報酬並下降','exit-reward'):'')+action('放棄委託並下降','exit-confirm'));return;
    }
    if(!confirmed){exitDeclined=true;dialog('出口確認',[1,-50].includes(run.floor)?'要結束這段旅程嗎？':'要前往下一層嗎？','你可以留下探索、拾取掉落物或整理裝備。離開後本層怪物與未拾取物品不再保留。','',action('留在本層','close')+action([1,-50].includes(run.floor)?'繼續前往歸途':'下降至'+floorLabel(run.floor-1),'exit-confirm'));return;}
    if(N&&run.floor===N.chapterForFloor(run.floor).low){const scene=N.scenesForFloor(run.floor).find(entry=>!run.chronicle.read.includes(entry.id));if(scene){exitDeclined=true;readStory(scene.id,false,0,true);return;}}
    if(N&&run.floor===1&&!run.chronicle.ending){exitDeclined=true;dialog('主線終章 · 由你決定','把這座塔帶往哪裡？','三條路都不必犧牲任何人。這一次，高塔會等待你的回答。','<div class="tower-grid">'+N.ENDINGS.map(ending=>'<article class="tower-item"><h3>'+text(ending.title)+'</h3><p>'+text(ending.description)+'</p>'+action('選擇這條歸途','ending',ending.id)+'</article>').join('')+'</div>',action('再想一想','close'),{full:true});return;}
    syncEngine();const result=C.descend(run),wasStarted=floorStarted;
    // The result has already cleared the old layout memory. Saving it must not
    // copy the still-rendered floor's map back into the new floor's engine data.
    floorStarted=false;
    if(!transact(result)){floorStarted=wasStarted;return;}G.running=false;
    if(run.status==='won'){
      if(run.floor===-50){underworldEnding(true);return;}
      const ending=N&&N.ENDINGS.find(e=>e.id===run.chronicle.ending),news='塔內出現一條隱藏樓梯。回到「劇情模式」後，可以自行選擇進入地下篇。現在，先好好享受走出迷宮的晨光。';
      const finish=()=>dialog('地上篇完成 · 塔外的第一道晨光',ending?ending.title:'你找到了回家的路','九十九層的旅程，終於有了你的答案。','<section class="underworld-unlock"><h3>新的旅人帶來了消息</h3><p>'+news+'</p></section>',action('結束旅程，回到首頁','home'),{silent:true});
      const paragraphs=[...(ending?.paragraphs||[C.ENDING.text]),...(ending&&S?S.endingEchoes(run,ending.id).flatMap(e=>[e.text]):[]),news];
      if(!playStorySequence({id:'surface-ending',title:ending?.title||'你找到了回家的路',floor:1,paragraphs},finish,finish))dialog('地上篇完成 · 塔外的第一道晨光',ending?ending.title:'你找到了回家的路','九十九層的旅程，終於有了你的答案。',(ending?endingProse(ending):prose([C.ENDING.text]))+'<section class="underworld-unlock"><h3>新的旅人帶來了消息</h3><p>'+news+'</p></section>',action('結束旅程，回到首頁','home'),{full:true});return;
    }
    dialog('本層探索完成','門後，是'+floorLabel(run.floor),run.floor<0?'地下的回聲越來越清楚。同伴、裝備與補給會一起前進。':'下一層的迷宮更接近高塔心臟。補給與職業工具會隨你繼續旅程。','<p class="tower-copy">生命 '+Math.ceil(run.hp)+' · 銅幣 '+run.coins+' · 已自動保存</p>',action('繼續下降','descend')+action('保存並回首頁','home'));
  }
  function underworldEnding(completed=false){
    if(!Underworld||run?.floor!==-50||run.status!=='won')return;
    const ending=Underworld.ENDING;
    const finish=()=>dialog('地下篇完成 · 五十層歸途',ending.title,'這次探索是你的選擇；現在，也由你決定回家。','',action(completed?'結束旅程，回到首頁':'回故事日誌',completed?'home':'journal'),{silent:true});
    if(!playStorySequence({id:'underworld-ending',title:ending.title,floor:-50,paragraphs:ending.paragraphs||[ending.text]},finish,finish))dialog('地下篇完成 · 五十層歸途',ending.title,'這次探索是你的選擇；現在，也由你決定回家。',prose(ending.paragraphs||[ending.text]),action(completed?'結束旅程，回到首頁':'回故事日誌',completed?'home':'journal'),{full:true});
  }
  function defeat() {
    if(!active)return;
    clearStoryTheater();
    G.running=false;run.status='dead';run.hp=0;
    if(inDungeon()){const result=D.finish(run,'abandoned',run.revision);if(result.ok)run=result.run;}
    save();
    dialog('高塔仍在等待','這次旅程暫時停下','冒險者把你帶回本層入口。可以付出最多 12 枚銅幣重整行裝：'+(modern()&&run.party?.members?.length?'全隊回到主角身邊並恢復體力；':'恢復體力；')+'已拾取的補給不會重複出現，未結案委託會解除。', '',action('重整後再挑戰','retry')+action('回首頁','home'));
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
    clearStoryTheater();
    const previous=C.validateAdventure(run.adventure,run.floor,run.seed);cancelFloorQuest();
    if(!save()){run.adventure=previous;dialog('尚未保存','目前無法保存旅程','瀏覽器儲存空間可能不足。請先繼續遊戲並保持此分頁開啟，避免遺失目前樓層。','',action('回到旅程','close'));return;}
    cancelSceneTransition();G.running=false;G.frozen=true;
    window.GameVoice?.stop(true);
    if(window.TowerAudio)window.TowerAudio.stop();
    active=false;floorStarted=false;paused=false;campDialog=false;bossEncounterHold=0;encounterAlert?.clearVisual();
    objectiveHint?.stop();
    partyUI?.reset();
    lightingUI?.reset();window.TowerCreatureArt?.release?.();
    environmentLife?.destroy();environmentLife=null;
    clearBolts();clearTagTextures();
    clearHurtFeedback();hurtLeft=0;guardClashAt=0;
    document.body.classList.remove('story-active','tower-danger');el('towerOverlay').hidden=true;
    AudioEng.stopMusic();AudioEng.stopItemLoop();switchScreen('titleScreen');
  }
  function handleAction(key,id) {
    if(cinema?.active)return;
    if(pendingDungeonShift){if(key==='dungeon-shift-retry')saveDungeonShift();return;}
    if(key==='profession'&&upgradingProfession&&pendingProfession?.floor<0&&['archer','cleric','robot'].includes(id)){showToast('這份舊旅程沿用原裝備規則；射手、神職與機器人請在新故事建立，避免替換既有裝備。');return;}
    if(key==='profession-cancel'){pendingProfession=pendingHero=null;upgradingProfession=false;open();return;}
    if(key==='hero-sex'&&pendingProfession){pendingProfession.name=(el('heroNameInput')?.value||pendingProfession.name).trim().slice(0,24)||'冒險者';if(['male','female'].includes(id))pendingSex=id;chooseProfession(pendingProfession,upgradingProfession);return;}
    if(key==='hero-create-back'&&pendingProfession){chooseProfession(pendingProfession,upgradingProfession);return;}
    if(key==='profession'&&pendingProfession){pendingProfession.name=(document.getElementById('heroNameInput')?.value||pendingProfession.name).trim().slice(0,24)||'冒險者';let result=P.enable(pendingProfession,id,pendingSex);if(result.ok&&(!upgradingProfession||['archer','robot'].includes(id)))result=Heroes.enable(result.run);if(!result.ok){showToast(result.message);return;}pendingHero=result.run;revealHero();return;}
    if(key==='hero-create-start'&&pendingHero){
      if(upgradingProfession){try{localStorage.setItem(SAVE+'_before_party',JSON.stringify(pendingProfession));}catch(_){showToast('無法保存升級前的備份，尚未改動舊旅程。請先騰出瀏覽器儲存空間。');return;}}
      if(!upgradingProfession){try{const old=localStorage.getItem(SAVE);if(old){pruneHeroBackups(2);localStorage.setItem(SAVE+'_before_heroes_'+Date.now(),old);}}catch(_){showToast('無法備份舊存檔，尚未開始新旅程。');return;}}
      const previous=run;run=pendingHero;floorStarted=false;if(!save()){run=previous;return;}pendingProfession=pendingHero=null;upgradingProfession=false;enter();return;}
    if(key==='battle-settings'){openBattleSettings();return;}
    if(key==='battle-auto-aim'&&modern()){autoAim=!autoAim;try{localStorage.setItem(AUTO_AIM_SETTING,autoAim?'on':'off');}catch(_){showToast('此裝置無法保存操作設定，本次遊戲仍可使用。',1800,false);}openBattleSettings(true);return;}
    if(key==='quest-view'){questDialog(false,true);return;}
    if(key==='quest-local'){questDialog(false,true,true);return;}
    if(key==='adventure-lord-help'){lordCounterPanel();return;}
    if(key==='adventure-followup'){followupPanel();return;}
    if(key==='adventure-choice'){
      const match=typeof id==='string'&&id.match(/^(event:-?\d{1,2}:\d{1,10}:(?:forest|workshop|river)):([01])$/);
      if(!match||!active||G.shifting||nearbyAdventure!==eventMarker||!eventMarker?.model.visible||Math.hypot(G.px-eventMarker.x,G.pz-eventMarker.z)>=2.6||!hasClearPath(G.px,G.pz,eventMarker.x,eventMarker.z))return;
      const result=AdventureEvents.choose(run,match[1],Number(match[2]));if(transact(result)){refreshAdventureWorld();closeDialog();showToast(result.message,4000);}return;
    }
    if(key==='adventure-claim'){const result=AdventureEvents.settle(run);if(transact(result)){refreshAdventureWorld();closeDialog();showToast(result.message,3000);AudioEng.sfxPickup();}return;}
    if(key==='adventure-abandon'){dialog('放下後續委託','這次先不追蹤留言？','不會失去物品，也不影響主線；之後的小事件仍可遇到。','',action('保留委託','quest-view')+action('放下委託','adventure-abandon-confirm'));return;}
    if(key==='adventure-abandon-confirm'){if(transact(AdventureEvents.settle(run,true))){refreshAdventureWorld();closeDialog();}return;}
    if(key==='trade-tab'&&['supplies','ingredients'].includes(id)){tradeCategory=id;trade(true);el('towerDialog').querySelector('.tower-dialog-content').scrollTop=0;return;}
    if(key==='commission-cooking'){commissionCooking();return;}
    if(key==='trade-back'){if(returnAction())trade(false,true);else closeDialog();return;}
    if(key==='commission-cook-back'){pendingCooking=null;if(cookingServiceReady())trade(true);else closeDialog();return;}
    if(key==='commission-cook-ask'){confirmCooking(id);return;}
    if(key==='commission-cook-confirm'){
      const q=pendingCooking;pendingCooking=null;if(!q||q.recipeId!==id||!cookingServiceReady()||q.merchantId!==nearest.id||q.floor!==run.floor||q.seed!==run.seed){showToast('這份委託已失效，請重新確認。');return;}
      if(transact(Cooking.cook(run,id,q.revision,q.merchantId))){AudioEng.sfxAction?.('cook');commissionCooking(true);showToast('獲得 '+P.RECIPES[id].name,1800,false);window.GameVoice?.announce('獲得 '+P.RECIPES[id].name,true);}return;
    }
    if(key==='battle-music'){el('soundToggle').click();openBattleSettings();return;}
    if(partyUI?.handle(key,id))return;
    if(lightingUI?.handle(key,id))return;
    if(key==='close'){closeDialog();return;}
    if(key==='new'){if(readSave()){dialog('重新開始確認','展開另一段高塔旅程？','選好職業後會先備份目前故事，再建立新技能與裝備旅程。其他模式與設定不變。','',action('保留目前進度','menu')+action('重新建立主角','new-confirm'));}else if(unreadableSave()){dialog('存檔無法讀取','要建立新的旅程嗎？','目前的存檔無法讀取。選好職業後會先把原始資料另存備份，再建立新旅程；若剛更新過遊戲，建議先重新整理網頁再試一次。','',action('先不要','menu')+action('備份後建立新主角','new-confirm'));}else handleAction('new-confirm');return;}
    if(key==='menu'){open();return;}
    if(key==='underworld-intro'){underworldIntro();return;}
    if(key==='underworld-cancel'){pendingUnderworld=null;open();return;}
    if(key==='underworld-start'){startUnderworld();return;}
    if(key==='underworld-ending'){underworldEnding();return;}
    if(key==='new-confirm'){beginNew();return;}
    if(key==='continue'){run=readSave();if(run&&run.status==='playing')enter();else if(run&&run.status==='dead'){active=true;floorStarted=false;document.body.classList.add('story-active');defeat();}else open();return;}
    if(key==='descend'){loadFloor(false);return;}
    if(key==='home'){stop();return;}
    if(key==='quit'){requestQuit();return;}
    // Regrouping brings the whole party back on its feet under the hero's control,
    // instead of reviving only whoever happened to fall last.
    if(key==='retry'){run.status='playing';if(modern()){Heroes.returnToHero(run);for(const m of run.party.members)Heroes.setHp(run,m.id,Heroes.maxHp(run,m.id));}run.hp=modern()?Heroes.maxHp(run):C.MAX_HP;if(modern())Heroes.sync(run);run.hunger=Math.max(65,run.hunger);run.coins=Math.max(0,run.coins-12);cancelFloorQuest();enter();return;}
    if(key==='bag'){inventory();return;}
    if(key==='journal'){journal();return;}
    if(key==='story-archive'){const saved=readSave();if(N&&saved?.status==='won'){run=saved;journal();}return;}
    if(key==='ending-read'){const ending=N&&N.ENDINGS.find(e=>e.id===run?.chronicle.ending);if(ending&&!playStorySequence({id:'ending-replay:'+ending.id,title:ending.title,floor:1,paragraphs:[...ending.paragraphs,...(S?S.endingEchoes(run,ending.id).map(e=>e.text):[])]},journal,journal))dialog('已完成的歸途',ending.title,'',endingProse(ending),action('回故事日誌','journal'));return;}
    if(key==='side-story-read'){readSideStory(id);return;}
    if(key==='side-story-intro'){readSideStory(id,0,'intro');return;}
    if(key==='side-story-outro'){readSideStory(id,0,'outro');return;}
    if(key==='side-next'&&sideReader){readSideStory(sideReader.kind,sideReader.page+1,sideReader.source,true);return;}
    if(key==='side-prev'&&sideReader){readSideStory(sideReader.kind,sideReader.page-1,sideReader.source,true);return;}
    if(key==='story-read'){readStory(id);return;}
    if(key==='story-next'&&reader){readStory(reader.id,reader.enter,reader.page+1,reader.exit,true);return;}
    if(key==='story-prev'&&reader){readStory(reader.id,reader.enter,reader.page-1,reader.exit,true);return;}
    if(key==='story-finish'&&reader){finishStoryReader();return;}
    if(key==='ending'){if(N&&transact(N.chooseEnding(run,id))){closeDialog();reachExit(true);}return;}
    if(key==='dungeon-enter'){enterDungeon(id);return;}
    if(key==='hunt-enter'){enterHunt(id);return;}
    if(key==='dungeon-brief'){dungeonBriefing();return;}
    if(key==='dungeon-interact'){interactDungeon(Number(id));return;}
    if(key==='dungeon-choice'){if(typeof id==='string'&&/^[0-2]:[0-2]$/.test(id)){const parts=id.split(':').map(Number);interactDungeon(parts[0],parts[1]);}return;}
    if(key==='dungeon-leave'){leaveDungeonDialog();return;}
    if(key==='dungeon-abandon'){finishDungeon('abandoned');return;}
    if(key==='dungeon-settle'){finishDungeon(id);return;}
    if(key==='equip'){const gear=run.gearBag.find(g=>g.id===id);if(transact(C.equipGear(run,id,run.revision))){inventory(true);window.GameVoice?.announce('裝備 '+(gear?gearSpeech(gear):'裝備'),true);}return;}
    if(key==='discard-ask'){const gear=[...run.gearBag,...Object.values(run.equipment)].find(g=>g&&g.id===id);discardFrom=el('towerDialog').classList?.contains('hero-management')?'hero':'bag';if(gear)dialog('捨棄裝備確認','捨棄'+gear.name+'？','捨棄後不能取回，若這是最後一把武器，你會暫時無法擊暈怪物。','',action('保留裝備',discardFrom==='hero'?'hero-panel':'bag',discardFrom==='hero'?partyUI?.heroes?.selected?.()||Heroes.state(run).active:undefined)+action('確認捨棄','discard',id));return;}
    // Discarding from team management returns there, not to the supplies page.
    if(key==='discard'){if(transact(C.discardGear(run,id,run.revision))){if(discardFrom==='hero'&&modern()&&partyUI?.heroes)partyUI.heroes.panel(partyUI.heroes.selected?.(),true);else inventory();}return;}
    if(key==='quest'){questDialog();return;}
    if(key==='quest-accept'){if(nearExplorer()&&transact(E.acceptQuest(run,id,run.revision))){if(relic)relic.model.visible=run.adventure.quest.type==='relic';closeDialog();showToast('委託已接受，背包可查看進度。');}return;}
    if(key==='quest-donate'){if(nearExplorer()&&questEvent('donate',{}))questDialog();return;}
    if(key==='quest-reward'){if(!nearExplorer())return;const result=E.claimQuestReward(run,run.revision);if(transact(result)){questDialog(true);window.GameVoice?.announce(rewardSpeech(result.effect.reward),true);}return;}
    if(key==='exit-reward'){if(!nearExplorer())return;const result=E.claimQuestReward(run,run.revision);if(!transact(result))return;closeDialog();reachExit(true);window.GameVoice?.announce(rewardSpeech(result.effect.reward));return;}
    if(key==='exit-confirm'){closeDialog();reachExit(true);return;}
    if(key==='chest-open'){openChest(id);return;}
    if(key==='use'){useItem(id);return;}
    if(key==='hire'){hireWarrior(id);return;}
    if(key==='rehire-review'){reviewWarriorReplacement(id);return;}
    if(key==='rehire-confirm'){hireWarrior(id,true);return;}
    if(key==='buy-scrap'){
      if(!active||!G.running||!nearest||nearest.id!==E.GROCERY.merchantId||Math.hypot(G.px-nearest.x,G.pz-nearest.z)>=2.6||!hasClearPath(G.px,G.pz,nearest.x,nearest.z))return;
      const quantity=Math.max(1,Math.floor(Number(id)||1));
      if(transact(window.TowerExpedition.buyScrap(run,nearest.id,quantity,run.revision))){trade(true,true);window.GameVoice?.announce('獲得 金屬零件',true);}return;
    }
    if(key==='buy-ingredient'){
      if(!active||!G.running||!nearest||!E.INGREDIENT_MERCHANTS?.includes(nearest.id)||Math.hypot(G.px-nearest.x,G.pz-nearest.z)>=2.6||!hasClearPath(G.px,G.pz,nearest.x,nearest.z))return;
      const offer=E.groceryOffers(run,nearest.id).find(o=>o.id===id);
      if(offer&&transact(E.buyIngredient(run,nearest.id,id,1,run.revision))){trade(true);window.GameVoice?.announce('獲得 '+offer.name,true);}return;
    }
    if(key==='buy'||key==='sell'||key==='buy-gear'){
      if(!active||!G.running||!nearest||Math.hypot(G.px-nearest.x,G.pz-nearest.z)>=2.6||!hasClearPath(G.px,G.pz,nearest.x,nearest.z))return;
      const quantity=key==='buy'&&id==='arrow'?Math.max(0,Math.min(10,C.itemLimit('arrow',run)-run.bag.arrow)):1,result=key==='buy-gear'?E.buyMerchantGear(run,nearest.id,id,run.revision):E[key==='buy'?'buySupply':'sellSupply'](run,nearest.id,id,quantity,run.revision);
      if(transact(result)){trade(true);window.GameVoice?.announce((key==='sell'?'賣出 ':'獲得 ')+(C.ITEMS[id]?.name||C.GEAR[id]?.name||'裝備'),true);}return;
    }
  }
  function voiceProfile(){if(!active||!run?.party)return null;const job=modern()?Heroes.job(run):run.party.profession,gender=P.sex(run,modern()?Heroes.state(run).active:'hero');return {identity:'tower-'+(modern()?Heroes.state(run).active:'hero')+'-'+job+'-'+gender,gender,age:'adult'};}
  function toolUsed(){if(active&&modern()){Heroes.toolSpent(run);run.engine.shovels=G.shovels;}}
  function robotEnergy(){if(!active||!modern()||Heroes.job(run)!=='robot')return null;return {value:Heroes.actor(run).robot.fuel};}
  function movementLocked(){return !!(active&&modern()&&partyUI?.movementLocked?.());}
  function movementScale(){if(!active||paused||G.shifting)return 1;const traits=run.party?window.TowerExpedition.traits(run):{speed:1,grip:0};return (modern()?Heroes.speed(run):C.hasteMultiplier(run))*Math.min(1,hazardSlow+(traits.grip>0?.15:0))*(run.party?.slowLeft>0?(traits.grip>0?.8:.6):1)*(modern()?1:traits.speed);}
  // startSaved/pauseForPanel/leaveForReload serve the 逃生梯 (GM) panel: load the prepared sandbox journey,
  // pause while it is open, or end the floor normally (saved, engine stopped) before a reload.
  window.TowerMode = { startSaved:()=>{open(true);handleAction('continue');},pauseForPanel:()=>{if(active&&floorStarted&&!paused&&run?.status==='playing')pauseMenu();},leaveForReload:()=>{if(active)stop();return !active;},get cinematicActive(){return !!cinema?.active;},cinematicFrame:dt=>cinema?.frame(dt),prepareMaze,openBattleSettings, sightRoot:()=>active?world:null, voiceProfile, toolUsed, robotEnergy, get active(){return active;}, get paused(){return paused;}, get partyActive(){return active&&!!run?.party;}, temporaryMapRadius:()=>modern()?(Heroes.buff(run,'path_eye')?.power||0):0, lightRadius:()=>active?lightingUI?.radius():null, useProfessionSkill:()=>partyUI?.skill(), movementLocked, movementScale, open, beginNew, tick, floorSeed, atmosphereStyle, scheduleShift, updateShift, exitUnlocked, reachExit, defeat, requestQuit, canCollectOriginal, collectedOriginal, itemConfig, reservedCells, preserveFloorPickups, soundChanged, mapMarkers };
  window.TowerMode.cinematicRender=draw=>cinema?cinema.render(draw):draw();
  install();
})();
