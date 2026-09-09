import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const THREE = require('../lib/three.min.js');
const atmosphere = require('../assets/maze-atmosphere.js');

function grid(size = 13, style = 'indoor', extra = {}) {
  const cell = 4, wallT = .7, wallBoxes = [], edge = size * cell / 2;
  const add = (x, z, sx, sz, boundary = false) => wallBoxes.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, boundary, inst: wallBoxes.length });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x - (size - 1) / 2) * cell, pz = (y - (size - 1) / 2) * cell;
    if (y < size - 1 && (x + y) % 2 === 0) add(px, pz + cell / 2, cell + wallT, wallT);
    if (x < size - 1 && (x + y) % 3 === 0) add(px + cell / 2, pz, wallT, cell + wallT);
  }
  add(0, -edge, size * cell + wallT, wallT, true); add(0, edge, size * cell + wallT, wallT, true);
  add(-edge, 0, wallT, size * cell + wallT, true); add(edge, 0, wallT, size * cell + wallT, true);
  return { width: size, height: size, cell, wallHeight: 3, wallBoxes, style, seed: 86721, ...extra };
}
function resources(handle) {
  const materials = new Set(), geometries = new Set(), meshes = [];
  for (const root of [handle.wallRoot, handle.floorRoot]) root.traverse(object => {
    assert.equal(Boolean(object.isLight), false, '建築裝飾不能增加即時光源');
    assert.equal(Boolean(object.isSprite), false, '裝飾不能有拾取標籤或表情符號');
    assert.equal(object.userData.role, 'scenery');
    if (!object.isMesh) return;
    assert.ok(object.isInstancedMesh, '靜態裝飾必須合批');
    assert.ok(object.material.depthTest && object.material.depthWrite, '牆後裝飾不可穿透牆面');
    assert.equal(object.material.transparent, false, '裝飾不使用可拾取物光圈');
    assert.equal(object.material.map, null, '裝飾沒有圖片載入量');
    assert.equal(object.castShadow, false, '不增加動態陰影');
    meshes.push(object); materials.add(object.material); geometries.add(object.geometry);
  });
  return { meshes, materials, geometries };
}
function bounds(part) {
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(part.x, part.y, part.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, part.ry, part.rz, 'YXZ')), new THREE.Vector3(part.sx, part.sy, part.sz));
  return new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5)).applyMatrix4(matrix);
}

test('建築模組提供瀏覽器與 Node 相同介面，風格及預算表不可被遊戲改寫', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../assets/maze-atmosphere.js', import.meta.url), 'utf8'), context);
  for (const method of ['plan', 'build']) assert.equal(typeof context.MazeAtmosphere[method], 'function');
  assert.equal(Object.keys(atmosphere.STYLES).length, 17);
  assert.ok(Object.isFrozen(atmosphere.STYLES)); assert.ok(Object.isFrozen(atmosphere.LIMITS.low));
  for (const style of Object.values(atmosphere.STYLES)) assert.ok(Object.isFrozen(style));
  assert.throws(() => atmosphere.build(null, grid()), TypeError);
  for (const field of ['width', 'height', 'cell', 'wallHeight']) for (const value of [0, -1, Infinity, NaN]) assert.throws(() => atmosphere.plan(grid(7, 'indoor', { [field]: value })), RangeError);
  assert.throws(() => atmosphere.plan(grid(7, 'indoor', { width: 100 })), RangeError);
  assert.throws(() => atmosphere.plan(grid(7, 'indoor', { wallBoxes: null })), TypeError);
  for (const unknown of ['constructor', '__proto__', 'missing', undefined]) assert.equal(atmosphere.plan(grid(7, unknown)).style, 'indoor');
});

test('六個一般場景、十個高塔區域、賣場的原創幾何細節各有區別', () => {
  const signatures = new Set();
  for (const style of Object.keys(atmosphere.STYLES)) {
    const data = atmosphere.plan(grid(13, style));
    signatures.add(JSON.stringify([...data.wall, ...data.glow, ...data.floor].map(({ color, ...part }) => part)));
    assert.ok(data.floor.length > 0, `${style} 需要地板分段`);
    if (style !== 'shop') assert.ok(data.wall.length > data.stats.wallSections * 4, `${style} 不能只有普通矩形框`);
  }
  assert.equal(signatures.size, 17, '除去顏色仍然有十七組不同的建築圖樣');
});

test('裝飾分布可重現且絕不讀 Math.random、不改碰撞盒或既有遊戲亂數', () => {
  const options = grid(), original = structuredClone(options), random = Math.random;
  let first, second;
  try {
    Math.random = () => { throw new Error('不能消耗遊戲亂數'); };
    first = atmosphere.plan(options); second = atmosphere.plan(options);
  } finally { Math.random = random; }
  assert.deepEqual(options, original);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, atmosphere.plan({ ...options, seed: options.seed + 1 }));
  assert.deepEqual(first, atmosphere.plan({ ...options, wallBoxes: [...options.wallBoxes].reverse() }), '同一實際牆位置不因碰撞盒陣列排序而換裝飾');
  const empty = atmosphere.plan({ ...options, wallBoxes: [null, { minX: Infinity, maxX: 1, minZ: 0, maxZ: 1 }, { minX: 1, maxX: 0, minZ: 0, maxZ: 1 }] });
  assert.equal(empty.wall.length, 0); assert.ok(empty.floor.length > 0);
});

test('所有牆飾在原牆高內、牆面外僅凸出 0.045 以下，不遮擋走道或越牆揭露地標', () => {
  for (const style of Object.keys(atmosphere.STYLES)) {
    const options = grid(13, style), data = atmosphere.plan(options), byInst = new Map(options.wallBoxes.map(wall => [wall.inst, wall]));
    for (const p of [...data.wall, ...data.glow]) {
      const box = bounds(p), wall = byInst.get(p.wallInst);
      assert.ok(box.min.y >= 0 && box.max.y <= options.wallHeight, `${style} 不得超過牆高`);
      assert.ok(box.min.x >= wall.minX - .045 && box.max.x <= wall.maxX + .045 && box.min.z >= wall.minZ - .045 && box.max.z <= wall.maxZ + .045, `${style} 必須附著牆面`);
      if (wall.boundary) {
        const edge = options.width * options.cell / 2;
        assert.ok(Math.abs(p.x) < edge && Math.abs(p.z) < edge, '外牆裝飾只能刻在內側');
      }
      assert.equal(p.role, 'wall-inlay');
    }
  }
});

test('地板均為低於 0.012 的平面鋪裝，各格獨立變化且細縫不同深度避免閃爍', () => {
  for (const style of Object.keys(atmosphere.STYLES)) {
    const options = grid(7, style), data = atmosphere.plan(options), edge = options.width * options.cell / 2;
    const ys = new Set(), colors = new Set();
    for (const part of data.floor) {
      const box = bounds(part); ys.add(part.y); colors.add(part.color);
      assert.ok(box.min.y > 0 && box.max.y <= .012);
      assert.ok(box.min.x > -edge && box.max.x < edge && box.min.z > -edge && box.max.z < edge);
      assert.equal(part.wallInst, null); assert.equal(part.role, 'floor-inlay');
    }
    assert.ok(ys.size >= 2, '不同層避免共面深度衝突'); assert.ok(colors.size >= 3, '地板不是單一色塊');
  }
});

test('壁燈是無光源的嵌片，較底板略向外且仍在牆面安全範圍內', () => {
  const data = atmosphere.plan(grid(13, 'indoor'));
  assert.ok(data.glow.length > 0);
  for (const p of data.glow) {
    const holder = data.wall.find(b => b.wallInst === p.wallInst && b.y === p.y && Math.hypot(b.x - p.x, b.z - p.z) < .01);
    assert.ok(holder);
    assert.ok(Math.abs(Math.hypot(holder.x - p.x, holder.z - p.z) - .008) < 1e-8);
  }
});

test('超大地圖與低效能設定都有固定繪製上限，所有裝飾最多三個合批且無外部資源', () => {
  for (const quality of ['balanced', 'low']) for (const style of Object.keys(atmosphere.STYLES)) {
    const handle = atmosphere.build(THREE, grid(39, style, { quality })), result = resources(handle);
    assert.ok(result.meshes.length <= 3); assert.equal(result.meshes.length, handle.stats.drawCalls);
    assert.ok(handle.stats.wallSections <= atmosphere.LIMITS[quality].wallSections);
    assert.ok(handle.stats.floorCells <= atmosphere.LIMITS[quality].floorCells);
    assert.ok(handle.stats.triangles <= (quality === 'low' ? 8000 : 14000), `${style} ${quality} ${handle.stats.triangles}`);
    assert.equal(result.geometries.size, 1, '同一層所有細節共用單位立方體');
    assert.equal(result.meshes.reduce((sum, mesh) => sum + mesh.count, 0), handle.stats.instances);
    handle.dispose();
  }
});

test('搶購模式只增加平面鋪裝，不在低貨架上新增物件或假商品', () => {
  const handle = atmosphere.build(THREE, grid(13, 'shop', { wallHeight: 1.25 }));
  assert.equal(handle.wallRoot.children.length, 0); assert.equal(handle.stats.wallSections, 0);
  assert.equal(handle.stats.drawCalls, 1); assert.equal(handle.floorRoot.children.length, 1);
  handle.dispose();
});

test('敲除牆面會一次隱藏該牆所有建築及燈片，不動其他牆或地板', () => {
  const options = grid(), plan = atmosphere.plan(options), handle = atmosphere.build(THREE, options), matrix = new THREE.Matrix4();
  const inst = plan.glow[0].wallInst, groundBefore = handle.floorRoot.children[0].instanceMatrix.array.slice();
  assert.equal(handle.removeWall(inst), true);
  for (const [name, parts] of [['wall-relief-batch', plan.wall], ['wall-lamp-inlay-batch', plan.glow]]) {
    const mesh = handle.wallRoot.getObjectByName(name);
    for (let i = 0; i < parts.length; i++) {
      mesh.getMatrixAt(i, matrix);
      assert.equal(matrix.determinant() === 0, parts[i].wallInst === inst, '只清除指定牆的浮雕');
    }
  }
  assert.deepEqual(handle.floorRoot.children[0].instanceMatrix.array, groundBefore);
  assert.equal(handle.removeWall(inst), false); assert.equal(handle.removeWall(-999), false);
  handle.dispose(); assert.equal(handle.removeWall(plan.wall[0].wallInst), false);
});

test('牆飾跟隨牆的升降而地板不升降，沒有逐幀重建或新增動畫迴圈', () => {
  const handle = atmosphere.build(THREE, grid()), scene = new THREE.Scene(), movingWall = new THREE.Group();
  scene.add(movingWall); movingWall.add(handle.wallRoot); scene.add(handle.floorRoot);
  const reference = handle.wallRoot.children[0].instanceMatrix.array, target = new THREE.Vector3();
  movingWall.position.y = -1.5; scene.updateMatrixWorld(true);
  assert.equal(handle.wallRoot.getWorldPosition(target).y, -1.5); assert.equal(handle.floorRoot.getWorldPosition(target).y, 0);
  assert.equal(handle.wallRoot.children[0].instanceMatrix.array, reference);
  const source = readFileSync(new URL('../assets/maze-atmosphere.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval|setTimeout|fetch\(|TextureLoader|PointLight|makePickupMarker/);
  handle.dispose(); assert.equal(movingWall.children.length, 0); assert.equal(scene.children.length, 1);
});

test('資源可重複釋放、與既有場景清理相容，兩層不共用可誤釋放的資源', () => {
  const a = atmosphere.build(THREE, grid()), b = atmosphere.build(THREE, grid()), ar = resources(a), br = resources(b);
  assert.ok([...ar.geometries].every(g => !br.geometries.has(g)));
  assert.ok([...ar.materials].every(m => !br.materials.has(m)));
  const counts = new Map();
  for (const resource of [...ar.geometries, ...ar.materials]) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
  // 模擬引擎 disposeSceneObject 已先釋放父場景，之後模組再清理。
  for (const resource of [...ar.geometries, ...ar.materials]) resource.dispose();
  a.dispose(); a.dispose();
  assert.ok([...counts.values()].every(count => count === 1), '每個自有資源最多釋放一次');
  assert.equal(a.wallRoot.children.length, 0); assert.equal(a.floorRoot.children.length, 0);
  assert.ok(b.wallRoot.children.length > 0);
  const secondCounts = new Map();
  for (const resource of [...br.geometries, ...br.materials]) { secondCounts.set(resource, 0); resource.addEventListener('dispose', () => secondCounts.set(resource, secondCounts.get(resource) + 1)); }
  b.dispose(); b.dispose(); assert.ok([...secondCounts.values()].every(count => count === 1));
});

test('高塔覆寫色盤可套用副本顏色，不影響造型及已配置數量', () => {
  const normal = atmosphere.plan(grid(13, 'books')), alternate = atmosphere.plan(grid(13, 'books', { palette: { wall: 0x776688, ground: 0x556677, accent: 0x99aabb } }));
  assert.deepEqual(normal.stats, alternate.stats);
  assert.notEqual(normal.wall[0].color, alternate.wall[0].color);
  assert.deepEqual(normal.wall.map(({ color, ...part }) => part), alternate.wall.map(({ color, ...part }) => part));
});
