/* 倒轉高塔：共用一般版引擎與操作，獨立保存劇情進度。 */
(function () {
  'use strict';
  const C = window.TowerCore;
  const SAVE = 'maze3d_tower_v1';
  let run = null, active = false, paused = false, pauseAt = 0, modalFocus = null;
  let world = null, loot = [], monsters = [], traders = [], nearest = null;
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
    hud.innerHTML = '<span class="tower-stat"><small>倒轉高塔</small><b id="towerFloor">99 F</b></span><span class="tower-stat"><small>生命</small><b id="towerHealth">100 / 100</b><progress id="towerHp" class="tower-health" max="100" value="100" aria-label="生命值"></progress></span><span class="tower-stat"><small>銅幣</small><b id="towerCoins">0</b></span><span class="tower-stat"><small>章節</small><b id="towerChapter"></b></span>';
    el('gameScreen').appendChild(hud);
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
  function itemConfig() { return {itemCount:5,foodCount:Math.max(4,Math.round(floorConfig.size/2))}; }
  function reservedCells() {
    const entrance=solveMaze(0,0)[1]||[0,1];
    return [entrance.join(','),...(floorStarted?[...traders,...loot].map(item=>item.cx+','+item.cy):[])];
  }
  function collectedOriginal(id) {
    if (!active || !run || run.claimed.includes(id)) return;
    run.claimed.push(id); save();
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
    CFG.mazeSize = floorConfig.size; CFG.itemCount = 5; CFG.foodCount = Math.max(4, Math.round(floorConfig.size / 2));
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
    buildTowerEnvironment(); buildWorld(); encounterHold = 0; soundChanged();
    floorStarted = true; saveClock = 0; attackLeft = 0; hurtLeft = 3; wasShifting = false;
    save(); updateHud();
    const narration = run.floor === 99 ? C.OPENING.text : floorConfig.narrative;
    if (intro || narration) dialog('第 ' + run.floor + ' 層 · ' + floorConfig.name, run.floor === 99 ? '我怎麼會在這裡？' : '向下的門，再次開啟', Array.isArray(narration) ? narration.join('\n\n') : (narration || '迷宮深處傳來金屬摩擦聲。找到下一扇門，繼續尋找召喚你的原因。'),
      '<p class="tower-copy">本層 ' + floorConfig.size + ' × ' + floorConfig.size + '｜每 ' + floorConfig.shiftSeconds + ' 秒變形｜' + (floorConfig.monsterCount ? '留意怪物紅色警戒圈' : '安全探索，先儲備補給') + '</p><p class="tower-copy">左側拖曳移動 · 右側拖曳看四周 · 背包 B · 交易 R · 揮擊 X · 空白鍵鐵鍬</p>', action('踏入迷宮', 'close'));
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
    loot = []; monsters = []; traders = []; nearest = null;
    world = new THREE.Group(); scene.add(world);
    const random = mulberry32(floorSeed() ^ 0x712da), used = new Set(['0,0', G.exitCell.x + ',' + G.exitCell.y]);
    const originalPickups = [...(G.items||[]), ...(G.foods||[])];
    for(const item of originalPickups){const c=worldToCell(item.x,item.z);used.add(c.x+','+c.y);}
    const near = solveMaze(0, 0)[1] || [0, 1]; used.add(near.join(','));
    // 營地與原版道具也分離，避免交易角色站在可拾取光圈中。
    for(const item of originalPickups){const c=worldToCell(item.x,item.z);if(c.x===near[0]&&c.y===near[1]){const p=chooseCell(random,used);item.x=p.x;item.z=p.z;item.sprite.position.x=item.marker.position.x=p.x;item.sprite.position.z=item.marker.position.z=p.z;}}
    const count = floorConfig.merchant ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const point = i === 0 ? cellPoint(near[0], near[1]) : chooseCell(random, used);
      const model = buildCharacter(CHARS[(run.floor + i + 1) % CHARS.length]); model.position.set(point.x, 0, point.z);
      const name = i === 0 ? '行商・阿洛' : '探路者・伊芙';
      const tag = makeTextSprite(name); tag.position.y = 2.5; tag.scale.set(1.8,.35,1); model.add(tag);
      const mat = new THREE.MeshBasicMaterial({color: 0x63f0ca});
      const flag = new THREE.Mesh(new THREE.ConeGeometry(.2,.5,4), mat); flag.position.y = 3.3; model.add(flag);
      world.add(model); traders.push({ ...point, model, name, type: i });
    }
    const kinds = ['coin','heal','ration','shield','coin','hourglass','bell','map','ration','coin','feather'];
    for (let i = 0; i < Math.min(14, floorConfig.size + 3); i++) {
      const point = chooseCell(random, used), kind = kinds[i % kinds.length], id = 's' + i;
      const model = new THREE.Group(); model.position.set(point.x,0,point.z);
      const icon = new THREE.Mesh(kind === 'coin' ? new THREE.CylinderGeometry(.34,.34,.14,10) : kind === 'ration' ? new THREE.BoxGeometry(.5,.4,.5) : new THREE.OctahedronGeometry(.42), new THREE.MeshLambertMaterial({color:color[kind],emissive:color[kind],emissiveIntensity:.16}));
      icon.position.y = 1; model.add(icon); model.add(makePickupMarker(color[kind], C.ITEMS[kind].name));
      model.visible = !run.claimed.includes(id); world.add(model); loot.push({ ...point, kind, id, model, icon });
    }
    for (let i = 0; i < floorConfig.monsterCount; i++) {
      const kind = floorConfig.monsterTypes[i % floorConfig.monsterTypes.length], def = C.MONSTERS[kind];
      const point = chooseCell(random, used, Math.min(7, floorConfig.size - 1)), model = monsterModel(kind, i);
      model.position.set(point.x, 0, point.z); world.add(model);
      monsters.push({ ...point, kind, def, model, hp: def.hp || 60, alive: true, path: [], pathLeft: i * .15, windup: 0, cooldown: 2, phase: i });
    }
  }
  function monsterModel(kind, index) {
    const group = new THREE.Group(), type = ['clockmite','wisp','sentinel','hound'].indexOf(kind);
    const tint = C.MONSTERS[kind].color;
    const mat = new THREE.MeshLambertMaterial({color:tint});
    const body = new THREE.Mesh(type === 0 ? new THREE.SphereGeometry(.65,10,7) : type === 1 ? new THREE.OctahedronGeometry(.68) : new THREE.BoxGeometry(1.1,1.25,.85), mat);
    body.position.y = type === 0 ? .6 : 1; group.add(body);
    if (type === 1) for (const side of [-1,1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(.55,.9,3),mat); wing.rotation.z=side*1.3;wing.position.set(side*.7,1,0);group.add(wing); }
    if (type === 3) { body.scale.set(.8,.55,1.5); for (const x of [-.35,.35]) for (const z of [-.4,.4]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.2),mat);leg.position.set(x,.35,z);group.add(leg); } }
    for (const side of [-1,1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(.14,.16,.1),new THREE.MeshBasicMaterial({color:0xfff4c0}));eye.position.set(side*.22,1,.49);group.add(eye); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.83,.05,5,20),new THREE.MeshBasicMaterial({color:0xff6767,transparent:true,opacity:.42})); ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);group.userData.ring=ring;
    const tag = makeTextSprite(C.MONSTERS[kind].name);tag.position.y=2.35;tag.scale.set(1.8,.4,1);group.add(tag);group.userData.body=body;
    return group;
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
    el('towerTalkBtn').disabled = !nearest; el('towerTalkBtn').textContent = nearest ? '交易 R' : '附近無人';
    el('towerAttackBtn').disabled = attackLeft > 0; el('towerAttackBtn').textContent = attackLeft > 0 ? '揮擊 ' + attackLeft.toFixed(1) : '揮擊 X';
    const effects = Object.entries(run.effects).filter(([,v])=>v>0).map(([k,v])=>({shield:'護盾',freeze:'定牆',repel:'驅怪',reveal:'回聲地圖'}[k])+' '+Math.ceil(v)+'秒');
    el('towerObjective').textContent = effects.length ? effects.join(' · ') : nearest ? nearest.name + '：靠近後可購買／交換補給' : '找到金色傳送門，前往' + (run.floor > 1 ? '第 ' + (run.floor - 1) + ' 層' : '塔外');
    document.body.classList.toggle('tower-danger',run.hp<=25);
  }
  function tick(dt, now) {
    if (!active || !floorStarted) return;
    if (wasShifting && !G.shifting) {
      wasShifting = false;
      wallMesh.material.color.setHex(environmentSpec()[1]);
      monsters.forEach(m=>{ const c=worldToCell(m.model.position.x,m.model.position.z),p=cellToWorld(c.x,c.y);m.model.position.set(p.x,0,p.z);m.path=[];m.pathLeft=0;m.windup=0;m.cooldown=2; });
      if (run.effects.reveal>0) { const p=worldToCell(G.px,G.pz); G.solutionPath=solveMaze(p.x,p.y); }
    }
    if (paused || !G.running || G.frozen || G.shifting || run.status !== 'playing') return;
    run.hunger = G.satiety;
    const ticked = C.tickEffects(run, dt); run = ticked.run || ticked;
    if (run.effects.freeze<=0) shiftLeft -= dt;
    attackLeft=Math.max(0,attackLeft-dt);hurtLeft=Math.max(0,hurtLeft-dt);
    if (G.satiety<=0 && hurtLeft<=0) damage(3);
    for (const item of loot) {
      if (!item.model.visible) continue;
      item.icon.position.y=1+Math.sin(now*.003+item.cx)*.12;item.icon.rotation.y+=dt;
      if (Math.hypot(G.px-item.x,G.pz-item.z)<1.05) {
        const result=C.collect(run,item.kind,item.kind==='coin'?8:1);
        if(result.ok){run=result.run;run.claimed.push(item.id);item.model.visible=false;AudioEng.sfxPickup();showToast('取得 '+C.ITEMS[item.kind].name+(item.kind==='coin'?' +8':''));save();}
      }
    }
    nearest=traders.find(n=>Math.hypot(G.px-n.x,G.pz-n.z)<2.6&&hasClearPath(G.px,G.pz,n.x,n.z))||null;
    for(const monster of monsters) updateMonster(monster,dt,now);
    const threat=!nearest&&run.effects.repel<=0&&!(now<G.invisUntil)&&monsters.some(m=>m.alive&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<m.def.sight&&(m.path.length>0||m.windup>0));
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
  function damage(amount) {
    if(hurtLeft>0||paused||run.status!=='playing')return;
    const result=C.takeDamage(run,amount);if(!result.ok)return;run=result.run;hurtLeft=1.5;
    showToast(result.effect&&result.effect.revived?'復甦羽亮起，你重新站了起來。':'受到 '+Math.round(amount)+' 點攻擊，留意紅圈預警');
    if(run.hp<=0||run.status==='dead')defeat();else save();updateHud();
  }
  function attack() {
    if(!active||paused||G.frozen||!G.running||attackLeft>0)return;
    attackLeft=.8;swingWeapon();
    const target=monsters.filter(m=>m.alive&&Math.hypot(G.px-m.model.position.x,G.pz-m.model.position.z)<2.8&&hasClearPath(G.px,G.pz,m.model.position.x,m.model.position.z)).sort((a,b)=>a.hp-b.hp)[0];
    if(!target){showToast('揮擊落空：靠近怪物後再攻擊');return;}
    target.hp-=28;target.cooldown=1.2;target.windup=0;AudioEng.sfxPickup();
    if(target.hp<=0){target.alive=false;target.model.visible=false;const id='monster-'+target.phase;let reward=false;if(!run.claimed.includes(id)){const r=C.collect(run,'coin',12);if(r.ok){run=r.run;run.claimed.push(id);reward=true;}}showToast('擊退 '+target.def.name+(reward?'，獲得 12 枚銅幣':'（此守衛已領過獎勵）'));save();}
    else showToast(target.def.name+' 剩餘生命 '+Math.ceil(target.hp));
  }
  function transact(result) {
    if(!result.ok){showToast(result.message||'目前無法進行');return false;}
    run=result.run;G.satiety=run.hunger;save();updateHud();return true;
  }
  function inventory() {
    if(!active||G.shifting||run.status!=='playing')return;
    syncEngine();
    const cards=Object.entries(C.ITEMS).filter(([id])=>id!=='coin').map(([id,item])=>'<article class="tower-item"><h3>'+text(item.name)+' <span>×'+(run.bag[id]||0)+'</span></h3><p>'+text(item.description||item.desc||'高塔冒險補給')+'</p>'+action(id==='feather'?'瀕死自動使用':'使用','use',id,!run.bag[id]||id==='feather')+'</article>').join('');
    dialog('旅人背包 · 暫停中','補給與生存','生命 '+Math.ceil(run.hp)+' / 100 · 飽足 '+Math.ceil(run.hunger)+'% · 銅幣 '+run.coins,'<div class="tower-grid">'+cards+'</div>',action('回到迷宮','close')+action('保存並離開','quit'));
  }
  function trade() {
    if(!active||G.shifting||!nearest||run.status!=='playing')return;
    syncEngine();
    const cards=Object.entries(C.ITEMS).filter(([id])=>id!=='coin').map(([id,item])=>'<article class="tower-item"><h3>'+text(item.name)+'</h3><p>'+text(item.description||item.desc||'高塔冒險補給')+' · 持有 '+(run.bag[id]||0)+'</p>'+action('買 '+(item.buyPrice||item.price)+' 幣','buy',id)+action('賣出','sell',id,!run.bag[id])+'</article>').join('');
    const bundle=items=>Object.entries(items).map(([key,count])=>C.ITEMS[key].name+' × '+count).join(' ＋ ');
    const trades=C.EXCHANGES.map(item=>'<article class="tower-item"><h3>'+text(item.name)+'</h3><p>'+text(bundle(item.give)+' → '+bundle(item.receive))+'</p>'+action('交換','exchange',item.id)+'</article>').join('');
    dialog(nearest.name+' · 營地安全區','旅人補給站','「有人說塔在守護我們。可我只想知道，誰把我們帶進來？」剩餘銅幣 '+run.coins,'<div class="tower-grid">'+cards+'</div><div class="tower-actions">'+trades+'</div>',action('結束交易','close'));
  }
  function useItem(id) {
    syncEngine();const before={...run.effects};
    if(!transact(C.useItem(run,id)))return;
    const mul=CH().itemDurMul||1;for(const key of Object.keys(run.effects))if(run.effects[key]>before[key])run.effects[key]*=mul;
    if(id==='ration'&&CH().foodMul)G.satiety=run.hunger=Math.min(100,run.hunger+45*(CH().foodMul-1));
    if(id==='map'){const p=worldToCell(G.px,G.pz);G.solutionPath=solveMaze(p.x,p.y);G.mapUntil=performance.now()+run.effects.reveal*1000;}
    save();inventory();
  }
  function reachExit() {
    if(!active||paused||!G.running||run.status!=='playing')return;
    syncEngine();G.running=false;const result=C.descend(run);
    if(!result.ok){G.running=true;return;}run=result.run;floorStarted=false;const saved=save();
    if(run.status==='won'){dialog('塔外的第一道晨光','你找到了回家的路',C.ENDING.text,'<p class="tower-copy">99 層旅程完成。你保住的不只是自己的生命，還有其他旅人的希望。</p>',action('回到首頁','home'));return;}
    dialog('本層探索完成','門後，是第 '+run.floor+' 層','下一層的迷宮更接近高塔心臟。補給與職業工具會隨你繼續旅程。','<p class="tower-copy">生命 '+Math.ceil(run.hp)+' · 銅幣 '+run.coins+' · '+(saved?'已自動保存':'儲存失敗，請勿關閉分頁')+'</p>',action('繼續下降','descend')+action('保存並回首頁','home'));
  }
  function defeat() {
    if(!active)return;
    G.running=false;run.status='dead';run.hp=0;save();
    dialog('高塔仍在等待','這次旅程暫時停下','冒險者把你帶回本層入口。可以付出最多 12 枚銅幣重整行裝；已拾取的補給不會重複出現。', '',action('重整後再挑戰','retry')+action('回首頁','home'));
  }
  function pauseMenu() { dialog('旅程已暫停','隨時可以繼續','切回遊戲後按繼續，牆壁倒數與怪物都會等待你。','',action('繼續探索','close')+action('保存並回首頁','home')); }
  function requestQuit() {
    if(G.shifting){showToast('請等牆壁移動完成再離開（約 2 秒）');return;}
    dialog('離開確認','保存這段旅程？','將保存職業、樓層、背包與生命；下次從目前樓層入口繼續。','',action('繼續遊戲','close')+action('保存並回首頁','home'));
  }
  function stop() {
    if(!save()){dialog('尚未保存','目前無法保存旅程','瀏覽器儲存空間可能不足。請先繼續遊戲並保持此分頁開啟，避免遺失目前樓層。','',action('回到旅程','close'));return;}
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
    if(key==='retry'){run.status='playing';run.hp=100;run.hunger=Math.max(65,run.hunger);run.coins=Math.max(0,run.coins-12);enter();return;}
    if(key==='use'){useItem(id);return;}
    if(key==='buy'||key==='sell'){if(transact(C[key](run,id,1,run.revision)))trade();return;}
    if(key==='exchange'){if(transact(C.exchange(run,id,run.revision)))trade();}
  }
  window.TowerMode = { get active(){return active;}, get paused(){return paused;}, open, beginNew, tick, floorSeed, scheduleShift, updateShift, reachExit, defeat, requestQuit, canCollectOriginal, collectedOriginal, itemConfig, reservedCells, soundChanged };
  install();
})();
