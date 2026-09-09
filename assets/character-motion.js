/* 共用角色姿態：沿用遊戲更新迴圈，不建計時器、貼圖或即時燈光。角色正面為 +Z。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CharacterMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  let nextPhase = 0;

  function prepare(model) {
    if (!model || !model.userData) return null;
    const data = model.userData;
    if (!data.motion) {
      data.motion = { phase: (nextPhase++ % 17) * .37, stride: 0, elapsed: 1, duration: 0,
        action: '', progress: 1, strength: 0, weapon: null, bodyScaleY: data.body?.scale?.y || 1 };
    }
    return data.motion;
  }
  function beginAction(model, action, duration) {
    const state = prepare(model);
    if (!state || !['attack', 'grab'].includes(action)) return false;
    state.action = action; state.elapsed = 0; state.duration = Math.max(.1, Math.min(1, Number(duration) || .48));
    state.progress = 0; state.strength = 0;
    return true;
  }

  // 棍／鍋／杖沿模型的 +Y 延伸。正的 X 旋轉把 +Y 轉向角色正面 +Z；負角會向後揮。
  function weaponPose(weapon, progress) {
    if (!weapon) return;
    const reach = Math.sin(Math.PI * clamp(progress));
    weapon.position.set(.48 - .18 * reach, .9 + .04 * reach, .18 + .25 * reach);
    weapon.rotation.set(.25 + 1.35 * reach, -.16 * reach, -.2 + .38 * reach);
  }
  function worldWeaponPose(weapon, model, progress, firstPerson = false) {
    if (!weapon || !model) return;
    weaponPose(weapon, progress);
    weapon.position.applyQuaternion(model.quaternion).add(model.position);
    // 第一人稱只抬高畫面中的武器；不移動角色或改變前向判定。
    if (firstPerson) weapon.position.y += .32;
    weapon.quaternion.premultiply(model.quaternion);
  }

  function update(model, dt, time, moving, speed = 1, firstPerson = false) {
    const state = prepare(model);
    if (!state) return null;
    const data = model.userData;
    if (!data.armL || !data.armR || !data.legL || !data.legR) return state;
    const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    const pace = Math.max(.5, Math.min(2.5, Number.isFinite(speed) ? speed : 1));
    state.stride += (clamp(moving) - state.stride) * (1 - Math.exp(-step * 13));
    state.phase += step * (8 + 2 * pace) * (.3 + .7 * state.stride);
    if (state.action) {
      state.elapsed = Math.min(state.duration, state.elapsed + step);
      state.progress = state.elapsed / state.duration;
      if (state.elapsed >= state.duration) state.action = '';
    } else state.progress = 1;
    state.strength = state.action ? Math.sin(state.progress * Math.PI) : 0;
    const wave = Math.sin(state.phase), stride = state.stride, strike = state.strength;
    const breathe = Math.sin((Number.isFinite(time) ? time : 0) * 2.15 + state.phase * .025);
    const swing = wave * .68 * stride;
    data.legL.rotation.x = -swing - .13 * strike;
    data.legR.rotation.x = swing + .12 * strike;
    data.armL.rotation.x = swing * .8 - .24 * strike;
    data.armR.rotation.x = -swing * .8 * (1 - strike) - (state.action === 'grab' ? 1.32 : 1.04) * strike;
    data.armL.rotation.z = -.055 - .035 * breathe * (1 - stride);
    data.armR.rotation.z = .055 + .035 * breathe * (1 - stride) + .12 * strike;
    model.position.y = .012 * (1 + breathe) * (1 - stride) + Math.abs(wave) * .045 * stride;
    model.rotation.x = .045 * stride + .065 * strike;
    model.rotation.z = wave * .025 * stride - .025 * strike;
    if (data.body?.scale) data.body.scale.y = state.bodyScaleY * (1 + breathe * .008 * (1 - stride));
    if (data.head) {
      data.head.rotation.y = Math.sin((Number.isFinite(time) ? time : 0) * .72) * .055 * (1 - stride) * (1 - strike);
      data.head.rotation.x = -.035 * stride + .045 * strike;
    }
    if (state.weapon) {
      state.weapon.visible = state.action === 'attack';
      if (state.weaponWorld) worldWeaponPose(state.weapon, model, state.progress, firstPerson);
      else weaponPose(state.weapon, state.progress);
    }
    if (state.grabHand) {
      state.grabHand.visible = state.action === 'grab' && firstPerson;
      worldWeaponPose(state.grabHand, model, state.progress);
      state.grabHand.position.y += .26;
    }
    return state;
  }

  function buildHand(T, skin) {
    const group = new T.Group(), material = new T.MeshLambertMaterial({color: skin, flatShading: true});
    const palm = new T.Mesh(new T.BoxGeometry(.17,.22,.12), material); palm.position.y=.18;group.add(palm);
    const fingers = new T.Mesh(new T.BoxGeometry(.15,.13,.08),material);fingers.position.set(0,.33,.045);group.add(fingers);
    group.name='first-person-reaching-hand';group.visible=false;return group;
  }

  // 一般對戰沿用職業武器輪廓；只在首次揮擊建立，後續重用到這個角色場景結束。
  function buildWeapon(T, index) {
    if (!T?.Group || !T?.Mesh) throw new TypeError('CharacterMotion 需要 THREE。');
    const group = new T.Group(); group.name = 'profession-weapon-' + index;
    const wood = new T.MeshLambertMaterial({color: 0xb88953, flatShading: true});
    const metal = new T.MeshLambertMaterial({color: 0xbbcbd1, flatShading: true});
    const accent = new T.MeshLambertMaterial({color: index === 3 ? 0x9bded5 : 0xd87d55, flatShading: true});
    const part = (geometry, material, x, y, z) => {
      const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); group.add(mesh); return mesh;
    };
    if (index === 1) {
      part(new T.BoxGeometry(.07,.34,.06),wood,0,.14,0);
      part(new T.CylinderGeometry(.23,.23,.065,12),metal,0,.51,0).rotation.x = Math.PI / 2;
    } else if (index === 2) {
      part(new T.BoxGeometry(.2,.15,.22),accent,0,.06,0);
      part(new T.SphereGeometry(.2,8,6),accent,0,.27,.035).scale.set(1,1.1,.85);
    } else if (index === 3) {
      part(new T.CylinderGeometry(.035,.045,.62,6),wood,0,.27,0);
      part(new T.OctahedronGeometry(.14,0),accent,0,.64,0);
    } else if (index === 4) {
      part(new T.BoxGeometry(.1,.6,.07),metal,0,.26,0);
      part(new T.BoxGeometry(.28,.09,.1),metal,0,.55,0);
      for (const side of [-1,1]) part(new T.BoxGeometry(.075,.2,.1),metal,side*.105,.64,0);
    } else if (index === 5) {
      part(new T.BoxGeometry(.28,.2,.15),accent,0,.15,0);
      for (const side of [-1,0,1]) part(new T.ConeGeometry(.047,.28,5),metal,side*.095,.39,.025);
    } else {
      part(new T.BoxGeometry(.1,.22,.1),wood,0,.03,0);
      part(new T.BoxGeometry(.36,.065,.14),accent,0,.17,0);
      part(new T.BoxGeometry(.105,.6,.055),wood,0,.48,0);
    }
    // Remove materials not used by this profession immediately; instantiated mesh materials are disposed with its scene.
    const used = new Set(group.children.map(mesh => mesh.material));
    for (const material of [wood,metal,accent]) if (!used.has(material)) material.dispose();
    Object.assign(group.userData, {frontAxis: '+Z', shaftAxis: '+Y', role: 'attack-visual'});
    weaponPose(group, 0); group.visible = false;
    return group;
  }
  return Object.freeze({ prepare, beginAction, update, weaponPose, worldWeaponPose, buildWeapon, buildHand });
});
