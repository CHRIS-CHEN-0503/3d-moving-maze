/* 原創迷宮建築細節：只附著既有牆／地板，不參與碰撞、拾取或遊戲亂數。
 * build(THREE, {wallBoxes,width,height,cell,wallHeight,style,palette,seed,quality})
 * palette 可覆寫 {wall,ground,accent}；quality: low 或 balanced。
 * wallMap / floorMap 可借用引擎快取材質，模組絕不複製或釋放來源貼圖。
 * wallRoot 掛在 wallMesh 下以跟隨升降，floorRoot 直接掛 scene；重建前 dispose。
 * 打破牆時 removeWall(原 wallBox.inst)，不以可變陣列位置代替 inst。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MazeAtmosphere = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STYLES = Object.freeze({
    indoor: { motif: 'arch', wall: 0xb0785a, ground: 0x8d6e63, accent: 0xbda990, lamp: true },
    field: { motif: 'hedge', wall: 0x66964f, ground: 0x7cb342, accent: 0xa0b07b },
    cave: { motif: 'strata', wall: 0x82739c, ground: 0x6b5d80, accent: 0xb3a7c8 },
    forest: { motif: 'bark', wall: 0x795548, ground: 0x558b2f, accent: 0x627a4f },
    mist: { motif: 'wetland', wall: 0x78909c, ground: 0x607d8b, accent: 0x9babaf },
    volcano: { motif: 'basalt', wall: 0x7a3b28, ground: 0x5a2a1a, accent: 0x9b776b },
    shop: { motif: 'shop', wall: 0xfdfdfd, ground: 0xf5f5f5, accent: 0xbcd6e6 },
    spire: { motif: 'spire', wall: 0x9aafbd, ground: 0xa3a9ae, accent: 0x9beded, lamp: true },
    garden: { motif: 'vine', wall: 0xaab993, ground: 0x9dab7f, accent: 0x75c996 },
    tree: { motif: 'roots', wall: 0x87ae8b, ground: 0x8f9f80, accent: 0x558561 },
    crystal: { motif: 'echo', wall: 0xa9a0ca, ground: 0x989cba, accent: 0x9eebff, lamp: true },
    books: { motif: 'shelves', wall: 0xc1a580, ground: 0xb19b83, accent: 0xd8bd87, lamp: true },
    water: { motif: 'tide', wall: 0x91b8b5, ground: 0x92b9bb, accent: 0x79d3d1 },
    ice: { motif: 'frost', wall: 0xc4e2e5, ground: 0xbfd6dd, accent: 0xe0fbff },
    gear: { motif: 'conduit', wall: 0xbca486, ground: 0xa69c87, accent: 0xdbaa65, lamp: true },
    fire: { motif: 'vents', wall: 0xc19a83, ground: 0xb19b8c, accent: 0xffa35f, lamp: true },
    heart: { motif: 'orbit', wall: 0xadb6d7, ground: 0xb3bbc7, accent: 0xe2d8bb, lamp: true },
  });
  Object.values(STYLES).forEach(Object.freeze);
  const LIMITS = Object.freeze({
    low: Object.freeze({ wallSections: 28, floorCells: 80 }),
    balanced: Object.freeze({ wallSections: 48, floorCells: 160 }),
  });
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function hash(value, seed) {
    let h = (seed >>> 0) ^ 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
    return h >>> 0;
  }
  function mix(a, b, factor) {
    let result = 0;
    for (const shift of [16, 8, 0]) result |= Math.round(((a >>> shift) & 255) * (1 - factor) + ((b >>> shift) & 255) * factor) << shift;
    return result;
  }
  function normalize(options = {}) {
    for (const key of ['width', 'height', 'cell', 'wallHeight']) {
      if (!Number.isFinite(options[key]) || options[key] <= 0) throw new RangeError('Invalid atmosphere ' + key);
    }
    if (!Number.isInteger(options.width) || !Number.isInteger(options.height) || options.width > 99 || options.height > 99) throw new RangeError('Invalid atmosphere grid');
    if (!Array.isArray(options.wallBoxes)) throw new TypeError('Atmosphere wallBoxes must be an array');
    const style = has(STYLES, options.style) ? options.style : 'indoor', base = STYLES[style];
    const palette = {};
    for (const key of ['wall', 'ground', 'accent']) {
      const value = options.palette?.[key];
      palette[key] = Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : base[key];
    }
    return { ...options, style, base, palette, seed: Number(options.seed) >>> 0, limits: LIMITS[options.quality === 'low' ? 'low' : 'balanced'] };
  }
  function wallCandidates(o) {
    const faces = [], edgeX = o.width * o.cell / 2, edgeZ = o.height * o.cell / 2;
    for (let wallIndex = 0; wallIndex < o.wallBoxes.length; wallIndex++) {
      const b = o.wallBoxes[wallIndex];
      if (![b?.minX, b?.maxX, b?.minZ, b?.maxZ].every(Number.isFinite) || b.maxX <= b.minX || b.maxZ <= b.minZ) continue;
      const axis = b.maxX - b.minX >= b.maxZ - b.minZ ? 'x' : 'z';
      const min = axis === 'x' ? b.minX : b.minZ, length = axis === 'x' ? b.maxX - b.minX : b.maxZ - b.minZ;
      const count = Math.max(1, Math.min(99, Math.round(length / o.cell))), span = Math.min(o.cell, length / count);
      const inst = Number.isInteger(b.inst) ? b.inst : wallIndex;
      for (let segment = 0; segment < count; segment++) for (const sign of [-1, 1]) {
        const along = min + (segment + .5) * length / count;
        const surface = axis === 'x' ? (sign < 0 ? b.minZ : b.maxZ) : (sign < 0 ? b.minX : b.maxX);
        // 外牆只刻內側，不把圖騰做成牆後資訊／外部地標。
        if (b.boundary && ((axis === 'x' && Math.abs(surface + sign * .08) >= edgeZ) || (axis === 'z' && Math.abs(surface + sign * .08) >= edgeX))) continue;
        const key = [axis, along.toFixed(4), surface.toFixed(4), sign].join(':');
        faces.push({ axis, along, surface, sign, span, inst, score: hash(key, o.seed), key });
      }
    }
    return faces.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key)).slice(0, o.limits.wallSections);
  }
  function plan(options) {
    const o = normalize(options), wall = [], glow = [], floor = [], relief=[];
    const { base, palette: p } = o;
    const stone = mix(p.wall, 0xffffff, .15), shadow = mix(p.wall, 0x17242b, .34), accent = mix(p.accent, p.wall, .35);
    const faces = base.motif === 'shop' || o.wallHeight < .65 ? [] : wallCandidates(o);
    let richFaces=0;
    for (const f of faces) {
      const furnished=!!o.rich&&richFaces++<(o.limits.wallSections===28?12:20);
      const put = (u, v, width, height, color, rz = 0, batch = wall) => {
        const faceOffset = batch === glow ? .025 : .017;
        batch.push({ x: f.axis === 'x' ? f.along + u * f.span : f.surface + f.sign * faceOffset,
          y: v * o.wallHeight, z: f.axis === 'x' ? f.surface + f.sign * faceOffset : f.along + u * f.span,
          sx: width * f.span, sy: height * o.wallHeight, sz: .026,
          ry: f.axis === 'x' ? 0 : -Math.PI / 2, rz, color, wallInst: f.inst, role: 'wall-inlay' });
      };
      // 踢腳線、牆頂簷與接縫柱建立尺度；不超出原牆頂、不增加通道障礙。
      put(0, .085, .86, .065, shadow);
      put(0, .91, .86, .045, stone);
      put(-.39, .48, .025, .79, stone); put(.39, .48, .025, .79, stone);
      if(!furnished)switch (base.motif) {
        case 'arch':
          put(0, .55, .62, .045, accent);
          put(-.25, .69, .025, .24, stone); put(.25, .69, .025, .24, stone);
          put(0, .81, .5, .04, stone);
          break;
        case 'hedge':
        case 'vine':
          for (let i = 0; i < 4; i++) {
            put(-.24 + i * .15, .38 + (i % 2) * .12, .018, .36, shadow, (i % 2 ? 1 : -1) * .2);
            put(-.24 + i * .15, .55 + (i % 2) * .1, base.motif === 'vine' ? .15 : .09, .055, accent, (i % 2 ? 1 : -1) * .4);
          }
          if (base.motif === 'vine') put(0, .69, .64, .025, shadow);
          break;
        case 'bark':
        case 'roots':
          for (let i = 0; i < 4; i++) put(-.27 + i * .18, .42, .023 + i * .004, .48 + i * .05, shadow, (i - 1.5) * .12);
          put(-.14, .56, .2, .025, accent, -.5); put(.2, .38, .22, .026, accent, .48);
          if (base.motif === 'roots') { put(0, .18, .66, .06, accent, .12); put(.08, .24, .48, .024, shadow, -.24); }
          break;
        case 'strata':
        case 'basalt':
          for (let i = 0; i < 4; i++) put((i % 2 ? .07 : -.07), .29 + i * .145, .59 - i * .045, .035, i % 2 ? accent : shadow, (i % 2 ? -.1 : .1));
          if (base.motif === 'basalt') for (let i = 0; i < 3; i++) put(-.22 + i * .22, .53, .026, .45, shadow, .07);
          break;
        case 'wetland':
        case 'tide':
          for (let i = 0; i < 4; i++) put((i % 2 ? -.04 : .04), .24 + i * .1, .62, .02, i % 2 ? shadow : accent, (i % 2 ? -.04 : .04));
          if (base.motif === 'wetland') { put(-.27, .45, .02, .36, shadow, -.1); put(.26, .4, .025, .3, shadow, .13); }
          else { put(-.27, .65, .045, .23, stone); put(.27, .65, .045, .23, stone); }
          break;
        case 'spire':
          for (let i = 0; i < 3; i++) put((i - 1) * .2, .55 + (i === 1 ? .04 : 0), .03, i === 1 ? .45 : .32, accent);
          put(0, .29, .6, .028, shadow); put(0, .82, .6, .026, stone);
          break;
        case 'echo':
        case 'frost':
          // 水晶／冰霜是嵌在岩壁的長裂紋，不是可拾取的獨立寶石。
          for (let i = 0; i < 3; i++) {
            put(-.2 + i * .2, .48, .018, .5 - i * .055, accent, (i % 2 ? -.35 : .35));
            put(-.17 + i * .18, .66 - i * .07, .18, .018, stone, (i % 2 ? .25 : -.25));
          }
          if (base.motif === 'echo') put(0, .29, .61, .028, shadow);
          else put(0, .76, .64, .022, accent, -.05);
          break;
        case 'shelves':
          for (const v of [.32, .55, .78]) put(0, v, .64, .045, shadow);
          for (let i = 0; i < 4; i++) put(-.23 + i * .15, .65, .065, .13 + (i % 2) * .03, mix(accent, shadow, i * .16));
          break;
        case 'conduit':
          put(-.23, .48, .045, .48, shadow); put(.23, .48, .045, .48, shadow);
          put(0, .31, .5, .04, accent); put(0, .71, .5, .04, accent);
          for (let i = 0; i < 3; i++) put(0, .41 + i * .09, .3, .025, shadow);
          break;
        case 'vents':
          put(0, .51, .62, .42, shadow);
          for (let i = 0; i < 5; i++) put(-.24 + i * .12, .51, .042, .38, stone);
          put(0, .76, .66, .034, accent);
          break;
        case 'orbit':
          // 開放階梯式嵌紋，不做與出口相似的閉合發光圓環。
          for (let i = 0; i < 3; i++) {
            put((i - 1) * .2, .35 + i * .15, .18, .027, accent);
            put((i - 1) * .2 + .08, .41 + i * .15, .021, .14, stone);
          }
          break;
      }
      // Wall-mounted silhouettes and recessed furniture; never loose loot,
      // never a new collision, texture download, point light or animation loop.
      if(furnished){
        // A composed wall bay, not a scatter of miniature objects. All pieces
        // remain inside the wall height and within 0.19 m of its surface.
        const solid=(u,v,w,h,depth,color,rz=0)=>{put(u,v,w,h,color,rz);const piece=wall[wall.length-1];piece.sz=depth;piece.role='wall-sculpture';piece.feature=base.motif;};
        const round=(u,v,w,h,color,rz=0)=>relief.push({x:f.axis==='x'?f.along+u*f.span:f.surface+f.sign*.06,y:v*o.wallHeight,z:f.axis==='x'?f.surface+f.sign*.06:f.along+u*f.span,sx:w*f.span,sy:h*o.wallHeight,sz:.18,ry:f.axis==='x'?0:-Math.PI/2,rz,color,wallInst:f.inst,role:'wall-sculpture',feature:base.motif});
        const arch=(u,v,w,h,color)=>{
          for(let i=0;i<7;i++){
            const a=(i+.5)*Math.PI/7,dx=-w*f.span*.5*Math.sin(a),dy=h*o.wallHeight*Math.cos(a);
            solid(u+Math.cos(a)*w*.5,v+Math.sin(a)*h,Math.hypot(dx,dy)*Math.PI/7/f.span*1.09,.06,.14,color,Math.atan2(dy,dx));
          }
          solid(u-w*.5,v-.17,.063,.36,.15,color);solid(u+w*.5,v-.17,.063,.36,.15,color);
        };
        const shade=mix(p.wall,0x111d28,.58), metal=mix(p.accent,0xe8d9b3,.24), variant=f.score%3;
        switch(base.motif){
          case 'arch':
            solid(0,.48,.62,.65,.035,shade);arch(0,.58,.64,.22,stone);
            solid(0,.22,.77,.06,.2,accent);solid(0,.63,.055,.35,.06,shadow);
            for(const s of [-1,1]){solid(s*.16,.53,.02,.3,.07,accent);solid(s*.22,.3,.09,.065,.12,stone);}
            break;
          case 'spire':
            solid(0,.5,.53,.6,.04,shade);arch(0,.6,.56,.24,stone);
            for(const s of [-1,0,1]){solid(s*.13,.5,.027,.42-Math.abs(s)*.08,.12,accent);solid(s*.13,.73,.08,.055,.13,metal,s*.25);}
            solid(0,.19,.68,.05,.15,stone);solid(0,.27,.33,.018,.08,accent);
            break;
          case 'hedge':
          case 'vine':
            for(const s of [-1,1]){
              solid(s*.23,.47,.035,.57,.11,shadow,s*.12);
              solid(s*.15,.58,.21,.03,.1,shadow,s*.45);
              round(s*.23,.73,.28,.18,accent,s*.2);round(s*.15,.47,.25,.17,mix(p.wall,0x304637,.24),s*-.25);
            }
            if(base.motif==='vine'){solid(0,.22,.68,.05,.15,stone);solid(0,.29,.58,.027,.1,shadow);solid(0,.82,.6,.035,.1,accent);}
            else solid(0,.2,.68,.035,.12,shadow);
            break;
          case 'bark':
          case 'roots':
            round(-.19,.47,.13,.67,shadow,-.04);round(.2,.5,.12,.74,stone,.08);
            solid(-.18,.51,.018,.62,.17,shade,-.04);solid(.18,.52,.018,.58,.17,shadow,.07);
            for(const s of [-1,1]){solid(s*.12,.3,.35,.05,.14,shadow,s*.42);solid(s*.23,.75,.25,.036,.12,accent,s*-.55);}
            if(base.motif==='roots'){round(-.15,.16,.47,.1,accent,.16);round(.16,.18,.41,.09,shadow,-.2);}
            break;
          case 'strata':
          case 'basalt':
            for(let i=0;i<5;i++)solid(-.27+i*.135,.48+(i%2)*.07,.1,.54+(i%3)*.065,.09+(i%2)*.08,i%2?shade:stone,(i-2)*.055);
            for(let i=0;i<3;i++)solid((i-1)*.17,.32+i*.13,.24,.025,.18,accent,i%2?.15:-.12);
            if(base.motif==='basalt')solid(.25,.49,.018,.38,.19,mix(p.accent,0x7e352b,.44),.08);
            break;
          case 'wetland':
            solid(0,.3,.7,.045,.15,shade);solid(0,.41,.67,.034,.1,accent);
            for(let i=0;i<5;i++){solid(-.26+i*.13,.51,.036,.46+(i%2)*.13,.11,i%2?shadow:stone,(i-2)*.04);solid(-.26+i*.13,.24,.045,.045,.13,shade);}
            round(-.25,.23,.2,.07,mix(p.ground,0x24483d,.5));round(.23,.21,.23,.065,shadow);
            break;
          case 'tide':
            solid(0,.52,.62,.57,.03,shade);arch(0,.6,.62,.2,stone);
            for(const u of [-.18,0,.18])solid(u,.49,.032,.41,.14,accent);
            for(const v of [.32,.43])solid(0,v,.58,.026,.17,mix(accent,0xdae5df,.3));
            solid(0,.23,.77,.06,.19,stone);round(0,.25,.41,.04,shadow);
            break;
          case 'echo':
          case 'frost':
            for(let i=0;i<5;i++){const v=.31+(i%3)*.065;solid((i-2)*.12,v+.18,.065,.29+(i%2)*.18,.13,i%2?stone:accent,(i-2)*.16);solid((i-2)*.12,v,.12,.075,.09,shadow);}
            if(base.motif==='frost'){round(-.22,.79,.24,.1,stone);round(.18,.77,.32,.11,accent);solid(-.2,.67,.024,.18,.13,accent,.08);solid(.2,.61,.028,.24,.12,stone,-.1);}
            else{solid(0,.19,.7,.065,.18,shade);solid(0,.25,.57,.026,.17,accent);}
            break;
          case 'shelves':
            solid(0,.5,.7,.63,.04,shade);
            for(const u of [-.35,.35])solid(u,.51,.04,.66,.2,stone);
            for(const v of [.24,.46,.68]){solid(0,v,.76,.045,.2,accent);for(let i=0;i<5;i++)solid(-.28+i*.14,v+.103,.072,.135+((i+variant)%3)*.018,.14,mix(metal,0x665378,((i+variant)%5)*.13),(i===variant?.07:0));}
            solid(0,.84,.79,.065,.18,stone);
            break;
          case 'conduit':
            solid(0,.53,.53,.49,.04,shade);
            for(const s of [-1,1]){solid(s*.29,.48,.045,.6,.13,metal);solid(s*.29,.3,.07,.06,.18,shadow);solid(s*.29,.69,.07,.06,.18,shadow);}
            for(let i=0;i<8;i++){const a=i*Math.PI/4;solid(Math.cos(a)*.16,.55+Math.sin(a)*.14,.055,.07,.17,accent,a);}
            round(0,.55,.22,.2,stone);solid(0,.55,.07,.06,.19,shade);solid(0,.23,.7,.045,.12,shadow);
            break;
          case 'vents':
            solid(0,.5,.68,.55,.045,shade);arch(0,.62,.6,.19,shadow);
            for(let i=0;i<7;i++)solid(-.27+i*.09,.46,.038,.37,.17,stone);
            solid(0,.22,.77,.055,.19,accent);solid(0,.34,.62,.02,.09,mix(accent,0xa53d1e,.55));
            break;
          case 'orbit':
            solid(0,.49,.63,.61,.025,shade);
            for(let i=0;i<5;i++){const u=(i-2)*.12,v=.34+(i%3)*.11;solid(u,v,.022,.31,.11,accent);solid(u+.035,v+.14,.085,.035,.14,metal);}
            arch(0,.61,.66,.2,stone);solid(0,.2,.75,.045,.17,accent);
            break;
        }
      }
      if (base.lamp && f.score % 3 === 0) {
        put(.29, .7, .09, .13, shadow);
        put(.29, .7, .038, .075, mix(p.accent, 0xf1eee4, .72), 0, glow);
      }
    }
    const cells = [];
    for (let z = 0; z < o.height; z++) for (let x = 0; x < o.width; x++) cells.push({ x, z, score: hash('floor:' + x + ':' + z, o.seed) });
    cells.sort((a, b) => a.score - b.score || a.z - b.z || a.x - b.x);
    for (const c of cells.slice(0, o.limits.floorCells)) {
      if(o.exitCell&&c.x===o.exitCell.x&&c.z===o.exitCell.y)continue;
      const x = (c.x - (o.width - 1) / 2) * o.cell, z = (c.z - (o.height - 1) / 2) * o.cell;
      const light = c.score % 2 === 0, flip = (c.score >>> 2) % 2 === 0, offset = ((c.score >>> 4) % 3 - 1) * .15 * o.cell;
      const tileColor = mix(p.ground, light ? 0xd6d5cb : 0x343f40, base.motif === 'shop' ? .035 : .11);
      let layer = 0;
      const addFloor = (dx, dz, sx, sz, color) => floor.push({ x: x + dx, y: .005 + layer++ * .00075, z: z + dz, sx, sy: .008, sz, ry: 0, rz: 0, color, wallInst: null, role: 'floor-inlay' });
      const sx = (flip ? .7 : .48) * o.cell, sz = (flip ? .48 : .7) * o.cell;
      if(o.rich&&base.motif!=='shop'){
        // Four broad, low-contrast fragments per cell at most: a coherent
        // surface rhythm instead of objects scattered down the walking lane.
        const seam=mix(p.ground,0x283c3b,.2), inlay=mix(p.ground,p.accent,.21);
        if(['hedge','vine','bark','roots','wetland'].includes(base.motif)){
          addFloor(-.23*o.cell,offset,.22*o.cell,.57*o.cell,tileColor);
          addFloor(.23*o.cell,-offset,.2*o.cell,.42*o.cell,mix(p.ground,0x314937,.14));
          addFloor(-.26*o.cell,offset,.017,.49*o.cell,seam);
          addFloor(.21*o.cell,-offset,.017,.37*o.cell,inlay);
        }else if(['strata','basalt','echo','frost'].includes(base.motif)){
          addFloor(-.13*o.cell,offset,.57*o.cell,.33*o.cell,tileColor);
          addFloor(.2*o.cell,-.21*o.cell,.28*o.cell,.24*o.cell,inlay);
          addFloor(-.12*o.cell,offset,.018,.29*o.cell,seam);
          addFloor(.2*o.cell,-.21*o.cell,.21*o.cell,.016,seam);
        }else{
          addFloor(0,0,.86*o.cell,.78*o.cell,tileColor);
          addFloor(0,-.27*o.cell,.72*o.cell,.027,inlay);
          addFloor(-.28*o.cell,0,.024,.69*o.cell,inlay);
          addFloor(.18*o.cell,0,.017,.74*o.cell,seam);
        }
      }else{
        addFloor(flip ? 0 : offset, flip ? offset : 0, sx, sz, tileColor);
        addFloor(flip ? 0 : offset, flip ? offset : 0, flip ? sx : .018, flip ? .018 : sz, mix(p.ground, 0x25353a, .23));
        if (base.motif === 'shop' || ['arch', 'spire', 'shelves', 'conduit', 'orbit'].includes(base.motif)) {
          addFloor(flip ? sx * .25 : offset, flip ? offset : sz * .25, flip ? .016 : sx, flip ? sz : .016, mix(p.ground, 0x25353a, .17));
        }
      }
    }
    const instances = wall.length + glow.length + floor.length+relief.length;
    return { style: o.style, wall, glow, floor, relief, stats: { wallSections: faces.length, floorCells: Math.min(cells.length, o.limits.floorCells), instances, drawCalls: [wall, glow, floor,relief].filter(a => a.length).length, triangles: (instances-relief.length) * 12+relief.length*100 } };
  }
  function build(THREE, options) {
    if (!THREE?.InstancedMesh || !THREE?.Group) throw new TypeError('MazeAtmosphere requires THREE');
    const data = plan(options), wallRoot = new THREE.Group(), floorRoot = new THREE.Group();
    wallRoot.name = 'maze-wall-atmosphere'; floorRoot.name = 'maze-floor-atmosphere';
    wallRoot.userData.role = floorRoot.userData.role = 'scenery';
    const resources = new Set(), released = new Set(), walls = new Map();
    const own = resource => { resources.add(resource); resource.addEventListener('dispose', () => released.add(resource)); return resource; };
    const geometry = own(new THREE.BoxGeometry(1, 1, 1));
    const position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), matrix = new THREE.Matrix4(), color = new THREE.Color();
    function batch(parts, parent, basic, name,shape=geometry) {
      if (!parts.length) return;
      const borrowedMap=parent===floorRoot?options.floorMap:options.wallMap;
      const material = own(basic ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: 0xffffff, map:borrowedMap?.isTexture?borrowedMap:null }));
      // 燈罩只是會受深度遮擋的明亮嵌片，沒有額外點光源／透明光暈。
      // Instance matrices/colours are object-owned GPU buffers: releasing the
      // geometry alone does not release them in Three's WebGLObjects cache.
      const mesh = own(new THREE.InstancedMesh(shape, material, parts.length)); mesh.name = name; mesh.userData.role = 'scenery';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; position.set(p.x, p.y, p.z); scale.set(p.sx, p.sy, p.sz);
        rotation.setFromEuler(euler.set(0, p.ry, p.rz, 'YXZ')); matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(p.color));
        if (p.wallInst !== null) {
          if (!walls.has(p.wallInst)) walls.set(p.wallInst, []);
          walls.get(p.wallInst).push({ mesh, index: i });
        }
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      parent.add(mesh);
    }
    batch(data.wall, wallRoot, false, 'wall-relief-batch'); batch(data.glow, wallRoot, true, 'wall-lamp-inlay-batch'); batch(data.floor, floorRoot, false, 'floor-inlay-batch');
    if(data.relief.length)batch(data.relief,wallRoot,false,'rounded-wall-sculpture-batch',own(new THREE.SphereGeometry(.5,10,6)));
    let disposed = false;
    return {
      wallRoot, floorRoot, stats: Object.freeze({ ...data.stats }),
      removeWall(inst) {
        if (disposed || !walls.has(inst)) return false;
        matrix.makeScale(0, 0, 0);
        for (const entry of walls.get(inst)) { entry.mesh.setMatrixAt(entry.index, matrix); entry.mesh.instanceMatrix.needsUpdate = true; }
        walls.delete(inst); return true;
      },
      // Leave the scene now; the caller frees GPU resources after the replacement has drawn.
      detach() { wallRoot.parent?.remove(wallRoot); floorRoot.parent?.remove(floorRoot); },
      dispose() {
        if (disposed) return; disposed = true;
        wallRoot.parent?.remove(wallRoot); floorRoot.parent?.remove(floorRoot);
        for (const resource of resources) if (!released.has(resource)) resource.dispose();
        wallRoot.clear(); floorRoot.clear(); walls.clear(); resources.clear(); released.clear();
      },
    };
  }
  return Object.freeze({ STYLES, LIMITS, plan, build });
});
