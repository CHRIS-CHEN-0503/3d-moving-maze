/* 高塔原創低面數人物與装備：只產生幾何，不載入圖片、不建立燈光或動畫迴圈。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TowerCharacters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MERCHANT_STYLES = Object.freeze({
    tieLing: Object.freeze({ id: 'tieLing', name: '鐵匠・鐵嶺', goods: Object.freeze(['helmet', 'bat']), colors: Object.freeze({ cloth: 0x80533b, metal: 0x78838e, accent: 0xcfad72 }), silhouette: '矮壯、灰鬍、皮圍裙與鍛槌' }),
    jinHe: Object.freeze({ id: 'jinHe', name: '裁甲師・錦禾', goods: Object.freeze(['armor', 'pan']), colors: Object.freeze({ cloth: 0x9c4778, metal: 0xa4b2bf, accent: 0xe1c67d }), silhouette: '女性、紫紅披肩、分層胸甲與裁縫腰包' }),
    lanZhou: Object.freeze({ id: 'lanZhou', name: '盾匠・嵐舟', goods: Object.freeze(['shield', 'staff']), colors: Object.freeze({ cloth: 0x356b58, metal: 0x899ca3, accent: 0xc8ad73 }), silhouette: '高瘦、綠長外套、單片護目與背圓盾' }),
  });
  const EXPLORER_STYLES = Object.freeze({
    eve: Object.freeze({ id: 'eve', name: '伊芙', title: '探索者', description: '擅長記錄路線的青年旅人，總把新發現畫在隨身地圖上。', silhouette: '女性、旅行帽、側辮、青綠斗篷與地圖' }),
    rowan: Object.freeze({ id: 'rowan', name: '洛恩', title: '探索者', description: '熱心的青年攀塔客，帶著攀繩和睡墊尋找通往塔外的路。', silhouette: '男性、寬肩長腿、紅棕短髮、短外套、攀繩與橫向睡墊' }),
    mira: Object.freeze({ id: 'mira', name: '米菈', title: '探索者', description: '喜歡研究塔內植物的年輕採集員，腰間總帶著分類好的樣本瓶。', silhouette: '女性、蓬鬆雙髻、圓眼鏡、寬短裙與三瓶樣本匣' }),
    oren: Object.freeze({ id: 'oren', name: '奧倫', title: '探索者', description: '溫和的年長古文學者，靠著手杖和舊卷軸解讀高塔的往事。', silhouette: '年長男性、高瘦長袍、白眉長鬍、側灰髮、手杖與卷軸' }),
    sena: Object.freeze({ id: 'sena', name: '星奈', title: '探索者', description: '身形嬌小的年輕觀星旅人，透過望遠鏡追尋高塔之外的星光。', silhouette: '女性、小巧身形、銀紫短髮、流星髮飾、單肩短披與望遠鏡' }),
  });
  const aliases = Object.freeze({ blacksmith: 'tieLing', smith: 'tieLing', armorer: 'jinHe', tailor: 'jinHe', shieldsmith: 'lanZhou', warden: 'lanZhou' });
  // 相對於一般版 playerGroup 的建議掛載點；回傳模型自身仍以原點為中心／握柄。
  const GEAR_MOUNTS = Object.freeze({
    helmet: Object.freeze({ position: Object.freeze([0, 1.82, 0]), rotation: Object.freeze([0, 0, 0]) }),
    armor: Object.freeze({ position: Object.freeze([0, .99, 0]), rotation: Object.freeze([0, 0, 0]) }),
    shield: Object.freeze({ position: Object.freeze([-.48, 1.02, .04]), rotation: Object.freeze([0, -Math.PI / 2, 0]) }),
    bat: Object.freeze({ position: Object.freeze([.48, .9, .18]), rotation: Object.freeze([.25, 0, -.2]) }),
    pan: Object.freeze({ position: Object.freeze([.48, .9, .18]), rotation: Object.freeze([.25, 0, -.2]) }),
    staff: Object.freeze({ position: Object.freeze([.48, .9, .18]), rotation: Object.freeze([.25, 0, -.2]) }),
  });

  function kit(deps) {
    const T = deps && deps.THREE;
    if (!T || !T.Group || !T.Mesh || !T.MeshLambertMaterial) throw new TypeError('TowerCharacters 需要 deps.THREE。');
    const materials = new Map(), geometries = new Map();
    const material = color => {
      if (!materials.has(color)) materials.set(color, new T.MeshLambertMaterial({ color, flatShading: true }));
      return materials.get(color);
    };
    const geometry = (kind, args) => {
      const key = kind + ':' + args.join(',');
      if (!geometries.has(key)) geometries.set(key, new T[kind](...args));
      return geometries.get(key);
    };
    function shape(parent, kind, args, color, name, x = 0, y = 0, z = 0) {
      const object = new T.Mesh(geometry(kind, args), material(color));
      object.name = name; object.position.set(x, y, z); parent.add(object);
      return object;
    }
    return {
      T,
      box: (parent, size, color, name, x, y, z) => shape(parent, 'BoxGeometry', size, color, name, x, y, z),
      cylinder: (parent, size, color, name, x, y, z) => shape(parent, 'CylinderGeometry', size, color, name, x, y, z),
      sphere: (parent, size, color, name, x, y, z) => shape(parent, 'SphereGeometry', size, color, name, x, y, z),
      cone: (parent, size, color, name, x, y, z) => shape(parent, 'ConeGeometry', size, color, name, x, y, z),
      torus: (parent, size, color, name, x, y, z) => shape(parent, 'TorusGeometry', size, color, name, x, y, z),
      crystal: (parent, size, color, name, x, y, z) => shape(parent, 'OctahedronGeometry', size, color, name, x, y, z),
    };
  }

  function figure(k, options) {
    const g = new k.T.Group();
    const { width = .62, legHeight = .55, bodyY = .97, headY = 1.58, shirt, pants, skin = 0xe5b593 } = options;
    const body = k.box(g, [width, .64, .37], shirt, 'torso', 0, bodyY, 0);
    const head = k.box(g, [.53, .49, .48], skin, 'head', 0, headY, 0);
    for (const side of [-1, 1]) k.box(g, [.066, .085, .025], 0x222b34, 'eye', side * .12, headY + .03, .253);
    const limbs = {};
    for (const [side, suffix] of [[-1, 'L'], [1, 'R']]) {
      const arm = new k.T.Group(); arm.name = 'arm' + suffix; arm.position.set(side * (width / 2 + .09), bodyY + .24, 0);
      k.box(arm, [.18, .38, .19], shirt, 'sleeve', 0, -.16, 0);
      k.box(arm, [.16, .17, .18], skin, 'hand', 0, -.39, .025); g.add(arm);
      const leg = new k.T.Group(); leg.name = 'leg' + suffix; leg.position.set(side * width * .25, legHeight, 0);
      k.box(leg, [.21, legHeight - .09, .23], pants, 'trouser', 0, -(legHeight - .09) / 2, 0);
      k.box(leg, [.25, .18, .34], 0x303c43, 'boot', 0, -legHeight + .09, .055); g.add(leg);
      limbs['arm' + suffix] = arm; limbs['leg' + suffix] = leg;
    }
    g.userData = { ...limbs, body, head, modelFamily: 'tower-original', frontAxis: '+Z' };
    return g;
  }

  function makeSmith(k) {
    const g = figure(k, { width: .8, legHeight: .51, bodyY: .89, headY: 1.46, shirt: 0x5a6570, pants: 0x51463e, skin: 0xd8ad8a });
    k.box(g, [.69, .78, .09], 0x80533b, 'leather-apron', 0, .83, .24);
    k.box(g, [.1, .45, .04], 0xba926a, 'apron-strap-left', -.22, 1.15, .294).rotation.z = -.18;
    k.box(g, [.1, .45, .04], 0xba926a, 'apron-strap-right', .22, 1.15, .294).rotation.z = .18;
    k.box(g, [.8, .11, .43], 0x483b36, 'work-belt', 0, .73, 0);
    k.box(g, [.14, .14, .055], 0xcfad72, 'belt-buckle', 0, .73, .265);
    k.box(g, [.48, .27, .13], 0xc1c7c7, 'wide-grey-beard', 0, 1.31, .287);
    k.cone(g, [.23, .2, 4], 0xc1c7c7, 'beard-tip', 0, 1.11, .285).rotation.z = Math.PI;
    k.box(g, [.12, .11, .13], 0xd8ad8a, 'nose', 0, 1.46, .3);
    k.cylinder(g, [.32, .34, .23, 8], 0x78838e, 'forge-helmet', 0, 1.76, 0);
    k.box(g, [.71, .065, .57], 0x414e5d, 'helmet-brim', 0, 1.65, .015);
    k.box(g, [.1, .22, .57], 0xb9bdbe, 'helmet-ridge', 0, 1.78, 0);
    for (const side of [-1, 1]) k.box(g, [.06, .06, .04], 0xcfad72, 'helmet-rivet', side * .23, 1.74, .3);
    const hammer = new k.T.Group(); hammer.name = 'forge-hammer'; hammer.position.set(0, -.39, .1);
    k.cylinder(hammer, [.037, .047, .42, 6], 0x9b7751, 'hammer-handle', 0, .14, 0);
    k.box(hammer, [.35, .19, .23], 0x9ba7af, 'hammer-head', 0, .39, 0);
    k.box(hammer, [.06, .2, .24], 0x566674, 'hammer-band', 0, .39, 0);
    g.userData.armR.add(hammer); g.userData.armR.rotation.z = -.22;
    return g;
  }

  function makeArmorer(k) {
    const g = figure(k, { width: .59, legHeight: .57, bodyY: .98, headY: 1.63, shirt: 0x613e65, pants: 0x473a55, skin: 0xf0c7ad });
    k.box(g, [.59, .15, .54], 0x362b42, 'hair-crown', 0, 1.9, -.005);
    for (const side of [-1, 1]) k.box(g, [.15, .5, .18], 0x362b42, 'side-hair', side * .31, 1.57, -.08).rotation.z = side * .14;
    k.box(g, [.82, .77, .13], 0x9c4778, 'shawl-back', 0, 1.02, -.28).rotation.x = .1;
    for (const side of [-1, 1]) {
      k.box(g, [.25, .22, .48], 0xb25a8e, 'shawl-shoulder', side * .38, 1.26, .015).rotation.z = side * .25;
      k.box(g, [.17, .65, .08], 0x9c4778, 'shawl-tail', side * .27, .95, .26).rotation.z = side * .14;
    }
    for (let i = 0; i < 3; i++) k.box(g, [.49 - i * .035, .2, .105], i % 2 ? 0x899eaf : 0xa4b2bf, 'fitted-armor-plate', 0, 1.2 - i * .18, .25 + i * .016);
    k.box(g, [.09, .08, .06], 0xe1c67d, 'shawl-clasp', -.29, 1.26, .29);
    k.box(g, [.69, .09, .46], 0x765340, 'tailoring-belt', 0, .72, 0);
    k.box(g, [.23, .24, .2], 0x9c7554, 'sewing-pouch', .4, .65, .09);
    k.box(g, [.24, .075, .21], 0xc79b6c, 'pouch-flap', .4, .76, .09);
    k.cylinder(g, [.055, .055, .15, 6], 0xe9d0a5, 'thread-spool', -.36, .78, .24).rotation.z = Math.PI / 2;
    k.box(g, [.04, .21, .025], 0xd2d8d7, 'sewing-shears-a', .4, .9, .19).rotation.z = .3;
    k.box(g, [.04, .21, .025], 0xd2d8d7, 'sewing-shears-b', .43, .9, .19).rotation.z = -.3;
    return g;
  }

  function makeShieldsmith(k, deps) {
    const g = figure(k, { width: .51, legHeight: .68, bodyY: 1.08, headY: 1.82, shirt: 0x356b58, pants: 0x354d48, skin: 0xe0b28c });
    k.box(g, [.59, .83, .13], 0x285142, 'long-coat-back', 0, .87, -.25);
    for (const side of [-1, 1]) {
      k.box(g, [.22, .69, .1], 0x427e65, 'coat-front-tail', side * .16, .81, .24).rotation.z = side * .06;
      k.box(g, [.15, .3, .09], 0xc8ad73, 'coat-lapel', side * .15, 1.28, .244).rotation.z = -side * .28;
    }
    k.box(g, [.57, .14, .51], 0x46544d, 'swept-short-hair', 0, 2.08, -.01).rotation.z = -.08;
    k.box(g, [.28, .16, .075], 0x46544d, 'short-beard', 0, 1.66, .268);
    k.torus(g, [.083, .021, 5, 12], 0xc8ad73, 'single-goggle-frame', .13, 1.86, .291);
    k.cylinder(g, [.064, .064, .018, 10], 0x8cb9c1, 'single-goggle-lens', .13, 1.86, .292).rotation.x = Math.PI / 2;
    k.box(g, [.14, .04, .035], 0x796c52, 'goggle-arm', .265, 1.86, .253);
    k.box(g, [.066, .85, .04], 0x977c51, 'shield-strap', 0, 1.1, .253).rotation.z = -.55;
    const shield = buildGear('shield', deps); shield.name = 'back-round-shield'; shield.position.set(0, 1.17, -.39); shield.rotation.y = Math.PI; shield.scale.setScalar(1.38); g.add(shield);
    return g;
  }

  function buildMerchant(id, deps) {
    const canonical = typeof id === 'string' && (Object.hasOwn(MERCHANT_STYLES, id) ? id : Object.hasOwn(aliases, id) ? aliases[id] : null);
    if (!canonical) throw new RangeError('未知的高塔商人：' + id);
    const k = kit(deps);
    const group = canonical === 'tieLing' ? makeSmith(k) : canonical === 'jinHe' ? makeArmorer(k) : makeShieldsmith(k, deps);
    group.name = 'tower-merchant-' + canonical;
    Object.assign(group.userData, { merchantId: canonical, role: 'merchant', style: MERCHANT_STYLES[canonical] });
    return group;
  }

  function makeEve(k) {
    const group = figure(k, { width: .57, legHeight: .57, bodyY: .99, headY: 1.62, shirt: 0x718997, pants: 0x535e6d, skin: 0xe9bb9d });
    k.box(group, [.57, .16, .5], 0x695048, 'traveler-hair', 0, 1.87, -.02);
    k.box(group, [.18, .39, .18], 0x695048, 'traveler-braid', .3, 1.54, -.05).rotation.z = .13;
    k.cylinder(group, [.29, .33, .24, 8], 0xbfad85, 'travel-hat-crown', 0, 1.99, -.015);
    k.cylinder(group, [.47, .47, .045, 10], 0xd5c096, 'travel-hat-brim', 0, 1.86, -.015);
    k.cylinder(group, [.332, .332, .075, 8], 0x648f8a, 'hat-ribbon', 0, 1.92, -.015);
    k.box(group, [.76, .84, .14], 0x507d83, 'travel-cloak', 0, 1, -.24).rotation.x = .13;
    k.box(group, [.77, .19, .49], 0x67949a, 'cloak-shoulders', 0, 1.27, -.015);
    k.box(group, [.075, .09, .055], 0xd7ba75, 'cloak-brooch', .2, 1.27, .28);
    k.box(group, [.38, .47, .21], 0x9a7655, 'field-backpack', 0, .96, -.48);
    k.box(group, [.4, .085, .23], 0xc09b6f, 'backpack-flap', 0, 1.19, -.48);
    const map = new k.T.Group(); map.name = 'unfolded-map'; map.position.set(0, -.35, .21); map.rotation.x = -.5;
    k.box(map, [.31, .23, .02], 0xe9ddb7, 'map-paper-left', -.07, 0, 0).rotation.y = -.18;
    k.box(map, [.24, .23, .02], 0xf4e9cc, 'map-paper-right', .15, 0, .015).rotation.y = .24;
    k.box(map, [.18, .025, .018], 0x658b80, 'map-route-a', -.04, .04, .024).rotation.z = -.3;
    k.box(map, [.024, .13, .018], 0x658b80, 'map-route-b', .04, -.005, .03).rotation.z = -.35;
    group.userData.armL.add(map);
    group.userData.armL.rotation.x = -.32;
    return group;
  }

  function makeRowan(k) {
    const g = figure(k, { width: .72, legHeight: .64, bodyY: 1.04, headY: 1.69, shirt: 0xbb7047, pants: 0x405862, skin: 0xc8916e });
    k.box(g, [.58, .16, .52], 0x713d2f, 'copper-short-hair', 0, 1.94, -.015);
    k.box(g, [.38, .14, .17], 0x98513b, 'windswept-fringe', -.08, 1.92, .24).rotation.z = -.24;
    k.box(g, [.14, .21, .39], 0x713d2f, 'cropped-sideburn', .275, 1.77, -.02);
    k.box(g, [.43, .13, .51], 0xdfb85f, 'climber-scarf', 0, 1.42, .035);
    k.box(g, [.17, .37, .08], 0xdfb85f, 'scarf-short-tail', -.19, 1.25, .25).rotation.z = -.19;
    k.box(g, [.77, .12, .45], 0x775642, 'utility-belt', 0, .76, 0);
    for (const side of [-1, 1]) k.box(g, [.2, .22, .08], 0xe0a968, 'jacket-pocket', side * .23, .95, .24);
    k.box(g, [.38, .54, .23], 0x5c716b, 'climber-pack', 0, 1.07, -.34);
    k.cylinder(g, [.13, .13, .76, 8], 0x90a79a, 'rolled-sleeping-mat', 0, 1.35, -.37).rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) k.cylinder(g, [.137, .137, .065, 8], 0x445f5a, 'bedroll-strap', side * .23, 1.35, -.37).rotation.z = Math.PI / 2;
    const rope = k.torus(g, [.23, .047, 4, 10], 0xd7bb7e, 'coiled-climbing-rope', -.42, .77, .22); rope.scale.y = 1.2;
    k.box(g, [.085, .12, .07], 0x765140, 'rope-tie', -.42, 1.01, .23);
    const pick = new k.T.Group(); pick.name = 'climbing-pick'; pick.position.set(0, -.38, .14);
    k.cylinder(pick, [.035, .042, .36, 6], 0x705740, 'pick-grip', 0, .12, 0);
    k.box(pick, [.31, .07, .08], 0xb8c5c6, 'pick-head', .025, .31, 0).rotation.z = -.2;
    g.userData.armR.add(pick); g.userData.armR.rotation.z = -.18;
    return g;
  }

  function makeMira(k) {
    const g = figure(k, { width: .6, legHeight: .52, bodyY: .93, headY: 1.54, shirt: 0x58826a, pants: 0x555747, skin: 0xe7b791 });
    k.box(g, [.57, .17, .51], 0x523d32, 'gatherer-hair-crown', 0, 1.8, -.015);
    for (const side of [-1, 1]) {
      k.sphere(g, [.185, 7, 5], 0x654939, 'round-double-bun', side * .33, 1.85, -.07);
      k.box(g, [.16, .04, .12], 0xdca864, 'bun-ribbon', side * .35, 1.79, .065);
      k.torus(g, [.094, .018, 4, 10], 0xc3ad70, 'round-spectacle-frame', side * .125, 1.57, .282);
    }
    k.box(g, [.062, .025, .025], 0xc3ad70, 'spectacle-bridge', 0, 1.57, .282);
    k.cylinder(g, [.28, .48, .59, 6], 0x668d72, 'flared-gathering-skirt', 0, .62, 0);
    k.box(g, [.4, .43, .065], 0xe1d6b4, 'linen-apron', 0, .78, .325);
    k.box(g, [.69, .09, .44], 0x937044, 'sample-belt', 0, .9, 0);
    k.box(g, [.48, .26, .21], 0x937044, 'three-vial-case', .14, .85, .35);
    for (let i = 0; i < 3; i++) {
      k.cylinder(g, [.049, .049, .23, 7], [0xa3bf76, 0x88bbc1, 0xd9a77e][i], 'sample-vial', -.02 + i * .15, 1.02, .35);
      k.box(g, [.071, .052, .071], 0xd2bd89, 'vial-cork', -.02 + i * .15, 1.15, .35);
    }
    k.box(g, [.37, .43, .24], 0x937044, 'gathering-basket', 0, .98, -.38);
    for (const side of [-1, 1]) k.cone(g, [.1, .37, 4], 0x719751, 'pressed-leaf-sample', side * .12, 1.36, -.38).rotation.z = side * .35;
    return g;
  }

  function makeOren(k) {
    const g = figure(k, { width: .49, legHeight: .68, bodyY: 1.11, headY: 1.79, shirt: 0x7c6c92, pants: 0x565263, skin: 0xe5bf9f });
    k.box(g, [.2, .2, .24], 0xe5bf9f, 'scholar-neck', 0, 1.485, 0);
    k.cylinder(g, [.26, .34, 1.01, 6], 0x766689, 'scholar-long-robe', 0, .91, -.01);
    for (const side of [-1, 1]) {
      k.box(g, [.1, .3, .43], 0xc3c5bf, 'silver-temple-hair', side * .285, 1.86, -.03);
      k.box(g, [.15, .045, .04], 0xe8e6d7, 'white-brow', side * .12, 1.89, .271).rotation.z = side * .06;
      k.box(g, [.092, .8, .04], 0xd8c898, 'robe-long-trim', side * .14, .99, .29);
    }
    k.box(g, [.11, .13, .11], 0xd7a987, 'scholar-nose', 0, 1.77, .288);
    k.box(g, [.4, .16, .095], 0xe8e6d7, 'white-beard-root', 0, 1.58, .283);
    k.cone(g, [.205, .48, 4], 0xe8e6d7, 'long-pointed-white-beard', 0, 1.35, .292).rotation.z = Math.PI;
    k.box(g, [.58, .085, .42], 0x594d54, 'scholar-sash', 0, .72, 0);
    k.cylinder(g, [.097, .097, .71, 8], 0xc9b897, 'back-scroll-case', -.14, 1.07, -.3).rotation.z = -.27;
    for (const y of [.75, 1.39]) k.cylinder(g, [.109, .109, .055, 8], 0x927953, 'scroll-case-cap', y === .75 ? -.23 : -.06, y, -.3).rotation.z = -.27;
    const cane = new k.T.Group(); cane.name = 'scholar-walking-cane'; cane.position.set(.055, -.32, .15);
    k.cylinder(cane, [.037, .045, 1.32, 7], 0x8e7652, 'walking-cane-shaft', 0, -.18, 0);
    k.sphere(cane, [.079, 6, 4], 0xc6b17e, 'walking-cane-knob', 0, .5, 0);
    g.userData.armR.add(cane);
    const book = k.box(g.userData.armL, [.27, .32, .08], 0x9b7069, 'ancient-field-book', 0, -.32, .17); book.rotation.z = -.16;
    return g;
  }

  function makeSena(k) {
    const g = figure(k, { width: .5, legHeight: .48, bodyY: .84, headY: 1.42, shirt: 0x64608d, pants: 0x555276, skin: 0xecc6b0 });
    k.box(g, [.58, .16, .52], 0xb4adce, 'silver-lilac-bob-crown', 0, 1.68, -.02);
    k.box(g, [.56, .42, .17], 0xa09bbd, 'short-bob-back', 0, 1.42, -.23);
    k.box(g, [.19, .3, .12], 0xb4adce, 'asymmetric-bob-fringe', -.24, 1.48, .19).rotation.z = -.17;
    k.crystal(g, [.082, 0], 0xf2d98f, 'comet-hairpin-star', .24, 1.7, .26);
    k.cone(g, [.056, .19, 3], 0xe8c77e, 'comet-hairpin-tail', .32, 1.63, .25).rotation.z = -.8;
    k.box(g, [.49, .56, .1], 0x39395f, 'single-shoulder-cape', -.14, .91, -.25).rotation.z = -.17;
    k.box(g, [.36, .19, .5], 0x8680ad, 'asymmetric-mantle', -.28, 1.1, -.03).rotation.z = -.16;
    k.box(g, [.1, .18, .06], 0xd4c389, 'mantle-fastener', -.13, 1.02, .23);
    k.box(g, [.065, .55, .035], 0xc4a879, 'star-atlas-strap', .04, .91, .226).rotation.z = -.55;
    k.box(g, [.25, .29, .14], 0x9882a3, 'star-atlas-satchel', .3, .68, .12);
    k.crystal(g, [.06, 0], 0xf0d797, 'atlas-star-seal', .3, .7, .207);
    const scope = new k.T.Group(); scope.name = 'pocket-telescope'; scope.position.set(0, -.35, .19); scope.rotation.x = -.28;
    k.cylinder(scope, [.07, .073, .36, 8], 0xb89d62, 'telescope-barrel', 0, 0, .08).rotation.x = Math.PI / 2;
    k.cylinder(scope, [.087, .087, .065, 8], 0xdcc68b, 'telescope-front-rim', 0, 0, .265).rotation.x = Math.PI / 2;
    k.cylinder(scope, [.065, .065, .012, 8], 0x90b9c8, 'telescope-lens', 0, 0, .303).rotation.x = Math.PI / 2;
    g.userData.armR.add(scope); g.userData.armR.rotation.x = -.45;
    return g;
  }

  function buildExplorer(id, deps) {
    // 舊版 buildExplorer({THREE,...}) 仍生成同一個伊芙模型。
    if (deps === undefined && id && typeof id === 'object') { deps = id; id = 'eve'; }
    if (typeof id !== 'string' || !Object.hasOwn(EXPLORER_STYLES, id)) throw new RangeError('未知的高塔探索者：' + id);
    const builders = { eve: makeEve, rowan: makeRowan, mira: makeMira, oren: makeOren, sena: makeSena };
    const group = builders[id](kit(deps)), style = EXPLORER_STYLES[id];
    group.name = 'tower-explorer-' + id;
    Object.assign(group.userData, { role: 'explorer', explorerId: id, characterName: style.title + '・' + style.name, style });
    return group;
  }

  function buildGear(kind, deps) {
    const k = kit(deps), group = new k.T.Group();
    group.name = 'tower-gear-' + kind;
    if (kind === 'helmet') {
      k.cylinder(group, [.305, .33, .18, 8], 0x97a8b9, 'helmet-band', 0, 0, 0);
      const dome = k.sphere(group, [.335, 8, 6], 0xb0bfca, 'helmet-dome', 0, .055, 0); dome.scale.y = .52;
      k.box(group, [.72, .045, .57], 0x647b8e, 'helmet-brim', 0, -.083, .02);
      k.box(group, [.085, .17, .065], 0xc6b37d, 'helmet-noseguard', 0, -.1, .302);
    } else if (kind === 'armor') {
      k.box(group, [.68, .62, .1], 0xa0b3c2, 'armor-breastplate', 0, 0, .235);
      k.box(group, [.57, .09, .025], 0xd2bd86, 'armor-trim', 0, -.21, .301);
      for (const side of [-1, 1]) k.box(group, [.19, .18, .45], 0x6f889c, 'armor-pauldron', side * .385, .25, 0).rotation.z = side * .12;
      k.box(group, [.1, .31, .03], 0xc0d0d8, 'armor-center-ridge', 0, .04, .308);
    } else if (kind === 'shield') {
      k.cylinder(group, [.32, .32, .09, 12], 0x4d7b69, 'shield-board', 0, 0, 0).rotation.x = Math.PI / 2;
      k.torus(group, [.295, .027, 5, 12], 0xc7b688, 'shield-rim', 0, 0, .047);
      k.cylinder(group, [.09, .12, .075, 8], 0xa5b5bd, 'shield-boss', 0, 0, .075).rotation.x = Math.PI / 2;
      k.box(group, [.035, .45, .035], 0x8aa996, 'shield-stripe', 0, 0, .057);
    } else if (kind === 'bat') {
      k.cylinder(group, [.042, .035, .3, 7], 0x946b46, 'bat-grip', 0, .12, 0);
      k.cylinder(group, [.088, .044, .45, 8], 0xc49b67, 'bat-barrel', 0, .485, 0);
      k.cylinder(group, [.047, .047, .065, 7], 0x536773, 'bat-grip-band', 0, .27, 0);
      k.sphere(group, [.087, 8, 4], 0xc49b67, 'bat-cap', 0, .71, 0).scale.y = .35;
    } else if (kind === 'pan') {
      k.box(group, [.056, .36, .05], 0x936749, 'pan-handle', 0, .15, 0);
      k.cylinder(group, [.205, .205, .045, 12], 0x728594, 'pan-bowl', 0, .5, 0).rotation.x = Math.PI / 2;
      k.torus(group, [.185, .025, 5, 12], 0xa5b5be, 'pan-rim', 0, .5, .035);
    } else if (kind === 'staff') {
      k.cylinder(group, [.028, .04, .61, 7], 0x8e7752, 'staff-shaft', 0, .275, 0);
      k.cylinder(group, [.043, .043, .07, 7], 0xc1b78a, 'staff-collar', 0, .56, 0);
      k.torus(group, [.088, .028, 5, 10], 0x6d988c, 'staff-crown', 0, .679, 0);
      k.crystal(group, [.059, 0], 0xa5d3c3, 'staff-stone', 0, .677, 0);
    } else throw new RangeError('未知的高塔裝備：' + kind);
    Object.assign(group.userData, { role: 'gear', kind, mount: GEAR_MOUNTS[kind], modelFamily: 'tower-original' });
    return group;
  }

  function buildChest(deps) {
    const k = kit(deps), group = new k.T.Group(); group.name = 'tower-treasure-chest';
    const body = k.box(group, [1.06, .53, .7], 0x855c3c, 'chest-body', 0, .285, 0);
    k.box(group, [1.12, .07, .75], 0x4c4540, 'chest-base', 0, .035, 0);
    const lid = new k.T.Group(); lid.name = 'chest-lid-pivot'; lid.position.set(0, .54, -.35); group.add(lid);
    k.box(lid, [1.1, .2, .74], 0xab7d4d, 'chest-lid', 0, .1, .35);
    k.box(lid, [1.06, .055, .52], 0xc59c61, 'chest-lid-top', 0, .22, .35);
    for (const side of [-1, 1]) {
      k.box(group, [.095, .54, .735], 0xbda36e, 'chest-band', side * .37, .285, 0);
      k.box(lid, [.099, .21, .77], 0xd3ba81, 'chest-lid-band', side * .37, .105, .35);
    }
    k.box(group, [.18, .23, .055], 0xd7bb78, 'chest-lock', 0, .43, .394);
    k.box(group, [.043, .08, .02], 0x4d4d49, 'chest-keyhole', 0, .43, .428);
    Object.assign(group.userData, { role: 'chest', body, lid, openAngle: -Math.PI * .58, modelFamily: 'tower-original' });
    return group;
  }

  return Object.freeze({ MERCHANT_STYLES, EXPLORER_STYLES, GEAR_MOUNTS, buildMerchant, buildExplorer, buildChest, buildGear });
});
