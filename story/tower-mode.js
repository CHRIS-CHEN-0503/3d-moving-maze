/* 倒轉高塔：共用一般版引擎與操作，獨立保存劇情進度。 */
(function () {
  'use strict';
  const C = window.TowerCore;
  const E = window.TowerEncounters, V = window.TowerCharacters;
  const SAVE = 'maze3d_tower_v1';
  let run = null, active = false, paused = false, pauseAt = 0, modalFocus = null;
  let world = null, loot = [], monsters = [], traders = [], nearest = null;
  let warriorNpc = null, nearestWarrior = null, escort = null;
  let explorer = null, chest = null, relic = null, nearbyEncounter = null, lastSurveyCell = '', gearVisual = null, gearSignature = '', exitDeclined = false;
  let shiftLeft = 65, wasShifting = false, floorConfig = null, saveClock = 0, hudClock = 0;
  let attackLeft = 0, hurtLeft = 0, warning = false, floorStarted = false, saveFailed = false;
  let encounterHold = 0;
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
  function environmentSpec() { return ENVIRONMENTS[Math.max(0, Math.min(9, floorConfig.chapter - 1))]; }
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
    const closeButton=(!active||(run.status==='playing'&&G.running&&floorStarted))?'<button class="tower-close" data-tower="close" aria-label="關閉對話並返回">返回</button>':'';
    el('towerDialog').innerHTML = closeButton+'<div class="tower-kicker">' + text(kicker) + '</div><h2 class="tower-heading" id="towerDialogTitle">' + text(title) + '</h2><p class="tower-copy">' + text(copy) + '</p>' + (body || '') + '<div class="tower-actions">' + actions + '</div>';
    el('towerDialog').focus();
  }
  function closeDialog() {
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
  function itemConfig() { return E.floorLootCounts(floorConfig.size); }
  function preserveFloorPickups() { return active && floorStarted; }
  function reservedCells() {
    return floorStarted?[...traders,...loot,...[warriorNpc,explorer,chest,relic].filter(Boolean)].map(item=>item.cx+','+item.cy):[];
  }
  function collectedOriginal(id) {
    if (!active || !run || run.claimed.includes(id)) return;
    run.claimed.push(id); questEvent('collect',{id}); save();
  }
  function open() {
    const saved = readSave();
    dialog('全新單人長篇冒險', '倒轉高塔・第 99 層', '你在陌生的召喚陣中醒來。塔頂只有一扇向下的門。每下一層，空間更大，牆壁的心跳也更快。與同樣受困的冒險者交易，帶著補給活著走到第一層。', '<div class="tower-story-cover" role="img" aria-label="被召喚到雲上高塔的冒險者"></div><p class="tower-copy">單人故事 · 沿用原本職業與操作 · 每層自動保存（繼續時回到該層入口）</p>',
      (saved && saved.status !== 'won' ? action('繼續：第 ' + saved.floor + ' 層', 'continue') : '') + action(saved ? '重新開始故事' : '建立主角', 'new') + action('回首頁', 'close'));
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
    closeDialog(); floorStarted = false;
    floorConfig = C.floorConfig(run.floor);
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
    el('hudLvlName').textContent = floorConfig.name; el('hudRound').textContent = '劇情';
    buildTowerEnvironment(); buildWorld(); gearVisual=null;gearSignature='';refreshGear();encounterHold = 0; soundChanged();
    floorStarted = true; saveClock = 0; attackLeft = 0; hurtLeft = 3; wasShifting = false;
    save(); updateHud();
    const narration = run.floor === 99 ? C.OPENING.text : floorConfig.narrative;
    if (intro || narration) dialog('第 ' + run.floor + ' 層 · ' + floorConfig.name, run.floor === 99 ? '我怎麼會在這裡？' : '向下的門，再次開啟', Array.isArray(narration) ? narration.join('\n\n') : (narration || '迷宮深處傳來金屬摩擦聲。找到下一扇門，繼續尋找召喚你的原因。'),
      '<p class="tower-copy">本層 ' + floorConfig.size + ' × ' + floorConfig.size + '｜物資 '+counts.total+' 件，不隨變形重生｜每 ' + floorConfig.shiftSeconds + ' 秒變形｜' + (floorConfig.monsterCount ? '武器只能擊暈，善用護衛合作' : '安全探索，先儲備補給') + '</p><p class="tower-copy">左側移動 · 右側看四周 · 背包／裝備 B · 互動 R · 擊暈 X · 空白鍵鐵鍬</p>', action('踏入迷宮', 'close'));
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
    const random = mulberry32(floorSeed() ^ 0x712da), used = new Set(['0,0', G.exitCell.x + ',' + G.exitCell.y]);
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
    if(explorerOffer){const point=chooseCell(random,used),model=V.buildExplorer({THREE,CHARS,buildCharacter});model.position.set(point.x,0,point.z);if(run.adventure.quest?.type==='escort'&&run.adventure.quest.status==='active')model.position.set(G.px,0,G.pz);const tag=makeTextSprite('探索者・伊芙');tag.position.y=2.6;model.add(tag);world.add(model);explorer={...point,offer:explorerOffer,model,path:[],pathLeft:0};}
    // 尋物目標獨立於消耗物資，種子固定，讀檔或變形不會重抽。
    const point=chooseCell(random,used),model=new THREE.Group();model.position.set(point.x,0,point.z);
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.36),new THREE.MeshLambertMaterial({color:0xe3ccff}));gem.position.y=.8;model.add(gem);model.add(makePickupMarker(0xc49dff,'任務遺物'));
    model.visible=!!(run.adventure.quest&&run.adventure.quest.type==='relic'&&run.adventure.quest.status==='active');world.add(model);relic={...point,model};
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
  function floorSeed() { return (run.seed ^ Math.imul(run.floor, 7919)) | 0; }
  function soundChanged() {
    if(!active||!window.TowerAudio)return;
    AudioEng.stopMusic(); AudioEng.resume();
    window.TowerAudio.configure({context:AudioEng.ctx,output:AudioEng.musicGain});
    window.TowerAudio.setMuted(G.muted);
    window.TowerAudio.setEnvironment(floorConfig.environmentId);
    window.TowerAudio.setEncounter(encounterHold>0);
    window.TowerAudio.setPaused(paused);
  }
  function scheduleShift() { shiftLeft = C.floorConfig(run.floor).shiftSeconds; warning = false; G.preWarned = false; }
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
    if(nearbyEncounter)el('towerObjective').textContent=nearbyEncounter===chest?'封印寶箱 · 可能藏著強化裝備，也可能是陷阱':'探索者・伊芙 · 對話查看委託';
    else if(q&&q.status!=='claimed'&&!nearest&&!nearestWarrior)el('towerObjective').textContent=(E.explorerOffer(run)?.title||'探索者委託')+' · '+q.progress+'/'+q.goal+(q.status==='ready'?' · 報酬待領':'');
    document.body.classList.toggle('tower-danger',run.hp<=25);
  }
  function tick(dt, now) {
    if (!active || !floorStarted) return;
    if (wasShifting && !G.shifting) {
      wasShifting = false;
      wallMesh.material.color.setHex(environmentSpec()[1]);
      monsters.forEach(m=>{ const c=worldToCell(m.model.position.x,m.model.position.z),p=cellToWorld(c.x,c.y);m.model.position.set(p.x,0,p.z);m.path=[];m.pathLeft=0;m.windup=0;m.cooldown=2; });
      restoreWarriorPosition();
      if(explorer&&run.adventure.quest?.type==='escort'){explorer.model.position.set(G.px,0,G.pz);explorer.path=[];explorer.pathLeft=0;}
      questEvent('shift',{id:'shift-'+Math.floor(run.floorElapsed*1000)});
      if (run.effects.reveal>0) { const p=worldToCell(G.px,G.pz); G.solutionPath=solveMaze(p.x,p.y); }
    }
    if (paused || !G.running || G.frozen || G.shifting || run.status !== 'playing') return;
    run.hunger = G.satiety;
    const ticked = C.tickEffects(run, dt); run = ticked.run || ticked;
    if(ticked.effect && ticked.effect.warriorReleased){dismissEscort();showToast('護衛已盡力撤退，怪物將恢復追擊！',3500);save();}
    if (run.effects.freeze<=0) shiftLeft -= dt;
    attackLeft=Math.max(0,attackLeft-dt);hurtLeft=Math.max(0,hurtLeft-dt);
    if (G.satiety<=0 && hurtLeft<=0) damage(3,'hunger');
    const portal=cellToWorld(G.exitCell.x,G.exitCell.y);if(Math.hypot(G.px-portal.x,G.pz-portal.z)>2.2)exitDeclined=false;
    const pc=worldToCell(G.px,G.pz),cellKey=pc.x+','+pc.y;
    if(cellKey!==lastSurveyCell){lastSurveyCell=cellKey;questEvent('survey',pc);}
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
    updateWarrior(dt,now);
    for(const monster of monsters) updateMonster(monster,dt,now);
    const threat=!nearest&&run.effects.repel<=0&&!(now<G.invisUntil)&&monsters.some(m=>m.alive&&!isHeld(m)&&!(run.monsterStuns[m.id]>0)&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<m.def.sight&&(m.path.length>0||m.windup>0));
    if(gearVisual?.userData.weapon)gearVisual.userData.weapon.rotation.x=attackLeft>0?-Math.sin((.8-attackLeft)/.8*Math.PI)*1.1:0;
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
    if(!active||paused||G.frozen||!G.running||attackLeft>0)return;
    if(!run.equipment.weapon){showToast('請先在背包裝備球棒、平底鍋或木杖。');return;}
    attackLeft=.8;
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
    run=result.run;G.satiety=run.hunger;refreshGear();save();updateHud();return true;
  }
  function refreshGear() {
    if(!active||!run?.equipment||typeof playerGroup==='undefined'||!playerGroup||!V)return;
    const signature=Object.values(run.equipment).map(g=>g?g.id:'-').join('|');
    if(signature===gearSignature)return;
    if(gearVisual){playerGroup.remove(gearVisual);disposeSceneObject(gearVisual);}
    gearVisual=new THREE.Group();gearSignature=signature;
    for(const gear of Object.values(run.equipment).filter(Boolean)){
      const model=V.buildGear(gear.kind,{THREE}),mount=V.GEAR_MOUNTS[gear.kind];
      model.position.set(...mount.position);if(mount.rotation)model.rotation.set(...mount.rotation);
      gearVisual.add(model);if(gear.slot==='weapon')gearVisual.userData.weapon=model;
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
    if(!offer||(!q&&!nearExplorer())){dialog('探索者委託','目前沒有委託','探索者伊芙有 20% 機會出現在每一層；靠近她可查看委託。','',action('回到迷宮','close'));return;}
    if(explorer)explorer.offer=offer;
    const target=monsters.find(m=>m.id===offer.target);
    const copy=offer.description+(target?' 目標：'+target.def.name+'（原始強度 '+target.strength+'/5）；接受後頭頂會標示「委託目標」。':'')+(q?' 進度 '+q.progress+' / '+q.goal:'');
    let actions=action('繼續探索','close');
    if(!q)actions+=action('接受委託','quest-accept',offer.id,!nearExplorer());
    else if(q.status==='ready')actions+=action('領取報酬','quest-reward',null,!nearExplorer());
    else if(q.status==='active'&&q.type==='donate')actions+=action('交付 '+q.goal+' 份'+C.ITEMS[q.target].name,'quest-donate',null,!nearExplorer()||run.bag[q.target]<q.goal);
    dialog('探索者・伊芙',q?.status==='claimed'?'感謝你的幫助':offer.title,copy,'<section class="tower-guard-summary"><h3>完成報酬</h3><p>'+text(rewardDescription(offer.reward))+'</p></section><p class="tower-copy">離開本層、保存回首頁或重整挑戰會解除未結案委託；報酬必須向探索者領取。進出口前會再次確認。裝備放入行囊後請自行穿戴。</p>',actions);
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
    dialog('旅人背包 · 暫停中','裝備與補給','生命 '+Math.ceil(run.hp)+' / 100 · 飽足 '+Math.ceil(run.hunger)+'% · 銅幣 '+run.coins,'<section class="tower-guard-summary"><h3>防禦 '+stats.defense+' · 強化 +'+stats.bonus+' · 擊暈 '+stats.stunSeconds+' 秒</h3><p>每次命中，三件已穿防具各減 1 耐久；武器命中減 1。每點已穿裝備強化增加 10 秒擊暈，耐久耗盡即損壞。</p></section><h3>穿戴中</h3><div class="tower-grid">'+(worn||'<p>尚未穿戴裝備。</p>')+'</div><h3 class="tower-section-title">裝備行囊 '+run.gearBag.length+'/24</h3><div class="tower-grid">'+(stored||'<p>商人與寶箱取得的裝備會放在這裡。</p>')+'</div><h3 class="tower-section-title">生存補給</h3><div class="tower-grid">'+cards+'</div><section class="tower-guard-summary"><h3>'+text(warriorStatus())+'</h3></section>'+warriorRules(),action('任務日誌','quest')+action('回到迷宮','close')+action('保存並離開','quit'));
  }
  function trade() {
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
    let q=run.adventure.quest;
    if(q&&q.status!=='claimed'&&!confirmed){
      const portal=cellToWorld(G.exitCell.x,G.exitCell.y);
      if(q.type==='escort'&&explorer)questEvent('escort',{atExit:hasClearPath(explorer.model.position.x,explorer.model.position.z,portal.x,portal.z),distance:Math.hypot(explorer.model.position.x-portal.x,explorer.model.position.z-portal.z)});
      q=run.adventure.quest;exitDeclined=true;
      dialog('出口確認',q.status==='ready'?'還有委託報酬尚未領取':'本層還有進行中的委託','下降後會解除本層委託，尚未領取的報酬也會失去。你可以先繼續探索。','<p class="tower-copy">'+text(E.explorerOffer(run)?.title||'探索者委託')+' · '+q.progress+'/'+q.goal+'</p>',action('留在本層','close')+(q.status==='ready'&&nearExplorer()?action('領取報酬並下降','exit-reward'):'')+action('放棄委託並下降','exit-confirm'));return;
    }
    syncEngine();G.running=false;const result=C.descend(run);
    if(!result.ok){G.running=true;return;}run=result.run;floorStarted=false;const saved=save();
    if(run.status==='won'){dialog('塔外的第一道晨光','你找到了回家的路',C.ENDING.text,'<p class="tower-copy">99 層旅程完成。你保住的不只是自己的生命，還有其他旅人的希望。</p>',action('回到首頁','home'));return;}
    dialog('本層探索完成','門後，是第 '+run.floor+' 層','下一層的迷宮更接近高塔心臟。補給與職業工具會隨你繼續旅程。','<p class="tower-copy">生命 '+Math.ceil(run.hp)+' · 銅幣 '+run.coins+' · '+(saved?'已自動保存':'儲存失敗，請勿關閉分頁')+'</p>',action('繼續下降','descend')+action('保存並回首頁','home'));
  }
  function defeat() {
    if(!active)return;
    G.running=false;run.status='dead';run.hp=0;save();
    dialog('高塔仍在等待','這次旅程暫時停下','冒險者把你帶回本層入口。可以付出最多 12 枚銅幣重整行裝；已拾取的補給不會重複出現，未結案委託會解除。', '',action('重整後再挑戰','retry')+action('回首頁','home'));
  }
  function pauseMenu() { dialog('旅程已暫停','隨時可以繼續','切回遊戲後按繼續，牆壁倒數與怪物都會等待你。選擇保存回首頁會解除本層未結案委託。','',action('繼續探索','close')+action('保存並回首頁','home')); }
  function requestQuit() {
    if(G.shifting){showToast('請等牆壁移動完成再離開（約 2 秒）');return;}
    dialog('離開確認','保存這段旅程？','將保存職業、裝備、樓層、背包與生命；下次從目前樓層入口繼續。本層未結案委託會解除，未領取報酬會失去。','',action('繼續遊戲','close')+action('保存並回首頁','home'));
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
  window.TowerMode = { get active(){return active;}, get paused(){return paused;}, open, beginNew, tick, floorSeed, scheduleShift, updateShift, reachExit, defeat, requestQuit, canCollectOriginal, collectedOriginal, itemConfig, reservedCells, preserveFloorPickups, soundChanged };
  install();
})();
