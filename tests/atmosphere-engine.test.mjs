import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const THREE = require('../lib/three.min.js');
const MazeAtmosphere = require('../assets/maze-atmosphere.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tower = readFileSync(new URL('../story/tower-mode.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const theme = { id: 'indoor', wall3d: 0xb0785a, wall: 0xb0785a, floor: 0x8d6e63, wallTex: 'brick' };

function engineFunction(name) {
  const start = html.indexOf(`function ${name}(`), end = html.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return html.slice(start, end + 2);
}
function harness({ enabled = true, coarse = false, towerStyle = null } = {}) {
  const texture = new THREE.Texture();
  const G = { mazeW: 3, mazeH: 3, cell: 4, wallT: .35, wallH: 3, lvlIdx: 0,
    hWalls: [[true, false, true], [false, true, true]], vWalls: [[true, false], [true, true], [false, true]],
    items: [{ id: 'sentinel-pickup', taken: true }], foods: [{ taken: false }], px: 4, pz: 4, shovels: 2,
  };
  const context = vm.createContext({ THREE, V3: THREE.Vector3, G, theme,
    scene: new THREE.Scene(), wallMesh: null, _texCache: { brick: texture }, spriteCache: {},
    makePickupMarker: {}, makeTex: () => texture, MP: { on: false, seed: 77 },
    MazeAtmosphere: enabled ? MazeAtmosphere : undefined,
    TowerMode: towerStyle ? { active: true, atmosphereStyle: () => towerStyle } : undefined,
    matchMedia: () => ({ matches: coarse }),
    RNG: () => { throw new Error('建築細節不得消耗玩法亂數'); },
  });
  context.window = context;
  const worldStart = html.indexOf('function cellToWorld('), worldEnd = html.indexOf('/* =====================================================', worldStart);
  assert.ok(worldStart > 0 && worldEnd > worldStart);
  vm.runInContext(['let mazeAtmosphere=null;', html.slice(worldStart, worldEnd),
    ...['disposeSceneObject', 'clearMazeAtmosphere', 'buildMazeAtmosphere', 'buildWalls', 'removeWallBox'].map(engineFunction)].join('\n'), context);
  return { context, texture, run: source => vm.runInContext(source, context), get atmosphere() { return vm.runInContext('mazeAtmosphere', context); } };
}
function matrices(mesh) {
  const matrix = new THREE.Matrix4();
  return Array.from({ length: mesh.count }, (_, index) => { mesh.getMatrixAt(index, matrix); return matrix.toArray(); });
}
function trackResources(...roots) {
  const counts = new Map();
  for (const root of roots) root.traverse(object => {
    for (const resource of [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material])]) {
      if (!resource || counts.has(resource)) continue;
      counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
    }
  });
  return counts;
}
function options(h) {
  const G = h.context.G;
  return { wallBoxes: G.wallBoxes, width: G.mazeW, height: G.mazeH, cell: G.cell, wallHeight: G.wallH,
    style: theme.id, palette: { wall: theme.wall3d, ground: theme.floor }, seed: G.lvlIdx + 1, quality: 'balanced' };
}

test('真實 buildWalls 把牆紋附著於升降牆，地板嵌紋留在地面', () => {
  const h = harness(); h.run('buildWalls(theme)');
  const { wallRoot, floorRoot } = h.atmosphere;
  assert.equal(wallRoot.parent, h.context.wallMesh); assert.equal(floorRoot.parent, h.context.scene);
  h.context.scene.updateMatrixWorld(true);
  const before = wallRoot.localToWorld(new THREE.Vector3(1, 1, 1));
  h.context.wallMesh.position.y = -2.7; h.context.scene.updateMatrixWorld(true);
  const lowered = wallRoot.localToWorld(new THREE.Vector3(1, 1, 1));
  assert.ok(Math.abs(lowered.y - before.y + 2.7) < 1e-9);
  assert.equal(floorRoot.getWorldPosition(new THREE.Vector3()).y, 0);
  assert.ok(h.atmosphere.stats.drawCalls <= 3);
  let lights = 0; h.context.scene.traverse(object => { if (object.isLight) lights++; }); assert.equal(lights, 0);
});

test('裝飾開關不改迷宮格線、碰撞盒、原牆矩陣、拾取狀態或玩法亂數', () => {
  const on = harness(), off = harness({ enabled: false }), original = plain(on.context.G);
  const rng = on.context.RNG;
  on.run('buildWalls(theme)'); off.run('buildWalls(theme)');
  assert.deepEqual(plain(on.context.G), plain(off.context.G));
  for (const key of Object.keys(original)) assert.deepEqual(plain(on.context.G[key]), original[key], key);
  assert.deepEqual(matrices(on.context.wallMesh), matrices(off.context.wallMesh));
  assert.equal(on.context.RNG, rng);
  assert.equal(off.atmosphere, null);
});

test('真實 removeWallBox 只清掉該 inst 的牆紋，保留鄰牆裝飾與原敲牆規則', () => {
  const h = harness(); h.run('buildWalls(theme)');
  const atmosphere = h.atmosphere, plan = MazeAtmosphere.plan(options(h));
  const target = h.context.G.wallBoxes.find(wall => !wall.boundary && plan.wall.some(piece => piece.wallInst === wall.inst));
  assert.ok(target, '測試需要一面有嵌紋的內牆');
  const before = plain(h.context.G), meshes = new Map(atmosphere.wallRoot.children.map(mesh => [mesh.name, mesh]));
  const snapshots = new Map([...meshes].map(([name, mesh]) => [name, matrices(mesh)]));
  h.context.target = target; h.run('removeWallBox(target)');
  assert.equal(h.context.G.wallBoxes.length, before.wallBoxes.length - 1);
  assert.equal(h.context.G.wallBoxes.includes(target), false);
  const grid = target.type === 'h' ? h.context.G.hWalls : h.context.G.vWalls;
  assert.equal(grid[target.gy][target.gx], false);
  assert.deepEqual(plain(h.context.G.items), before.items); assert.deepEqual(plain(h.context.G.foods), before.foods);
  const matrix = new THREE.Matrix4(); h.context.wallMesh.getMatrixAt(target.inst, matrix);
  assert.ok(matrix.elements[0] < .002 && matrix.elements[5] < .002 && matrix.elements[10] < .002);
  let removed = 0, untouched = 0;
  for (const [name, pieces] of [['wall-relief-batch', plan.wall], ['wall-lamp-inlay-batch', plan.glow]]) {
    if (!pieces.length) continue;
    const current = matrices(meshes.get(name));
    for (const [index, piece] of pieces.entries()) {
      if (piece.wallInst === target.inst) {
        assert.equal(current[index][0], 0); assert.equal(current[index][5], 0); assert.equal(current[index][10], 0); removed++;
      } else { assert.deepEqual(current[index], snapshots.get(name)[index]); untouched++; }
    }
  }
  assert.ok(removed > 0 && untouched > 0);
});

test('重建牆先清理前一代裝飾，舊私有資源僅釋放一次且共享牆貼圖留存', () => {
  const h = harness(); h.run('buildWalls(theme)');
  const old = h.atmosphere, oldWall = h.context.wallMesh;
  const resources = trackResources(oldWall, old.floorRoot);
  let textureDisposed = 0; h.texture.addEventListener('dispose', () => textureDisposed++);
  h.run('buildWalls(theme)');
  assert.notEqual(h.atmosphere, old); assert.notEqual(h.context.wallMesh, oldWall);
  assert.equal(oldWall.parent, null); assert.equal(old.wallRoot.parent, null); assert.equal(old.floorRoot.parent, null);
  assert.equal(old.wallRoot.children.length, 0); assert.equal(old.floorRoot.children.length, 0);
  for (const count of resources.values()) assert.equal(count, 1);
  assert.equal(textureDisposed, 0);
  assert.equal(h.context.scene.children.filter(object => object.name === 'maze-floor-atmosphere').length, 1);
  assert.equal(h.context.wallMesh.children.filter(object => object.name === 'maze-wall-atmosphere').length, 1);
});

test('clearMazeAtmosphere 重複呼叫安全，不移除主牆或改碰撞盒', () => {
  const h = harness(); h.run('buildWalls(theme)');
  const old = h.atmosphere, wall = h.context.wallMesh, before = plain(h.context.G);
  const resources = trackResources(old.wallRoot, old.floorRoot);
  let wallDisposed = 0; wall.geometry.addEventListener('dispose', () => wallDisposed++);
  h.run('clearMazeAtmosphere(); clearMazeAtmosphere();');
  assert.equal(h.atmosphere, null); assert.equal(wall.parent, h.context.scene);
  assert.equal(old.wallRoot.parent, null); assert.equal(old.floorRoot.parent, null);
  assert.deepEqual(plain(h.context.G), before); assert.equal(wallDisposed, 0);
  for (const count of resources.values()) assert.equal(count, 1);
  h.run('disposeSceneObject(scene)');
  assert.equal(wallDisposed, 1);
  for (const count of resources.values()) assert.equal(count, 1);
});

test('手機觸控走低批次預算，劇情使用當層專屬色盤而非一般城堡色盤', () => {
  const style = { style: 'ice', palette: { wall: 0xc4e2e5, ground: 0xbfd6dd, accent: 0xe0fbff }, seed: 54321 };
  const h = harness({ coarse: true, towerStyle: style }); h.run('buildWalls(theme)');
  const expected = MazeAtmosphere.plan({ ...options(h), ...style, quality: 'low' });
  assert.deepEqual(plain(h.atmosphere.stats), expected.stats);
  assert.ok(h.atmosphere.stats.wallSections <= 28 && h.atmosphere.stats.floorCells <= 80);
  const mesh = h.atmosphere.wallRoot.children.find(object => object.name === 'wall-relief-batch');
  const color = new THREE.Color(); mesh.getColorAt(0, color);
  assert.equal(color.getHex(), expected.wall[0].color);
});

test('高塔公開目前章節與副本的裝飾風格，主樓層與副本種子保持隔離', () => {
  const from = tower.indexOf('  const ENVIRONMENTS = ['), to = tower.indexOf('  const text = escapeHtml;', from);
  assert.ok(from > 0 && to > from);
  const seedFunction = tower.match(/^  function floorSeed\([^\n]+$/m)?.[0]; assert.ok(seedFunction);
  const context = vm.createContext({ Math, run: { seed: 321, floor: 89, expedition: null }, floorConfig: { chapter: 2 },
    S: { get: kind => kind === 'mirrors' ? { palette: [1, 2, 3, 4, 'crystal'] } : null }, E: {}, D: null,
  });
  vm.runInContext(tower.slice(from, to) + '\n' + seedFunction, context);
  const call = () => plain(vm.runInContext('atmosphereStyle()', context));
  assert.deepEqual(call(), { style: 'garden', palette: { wall: 0xaab993, ground: 0x9dab7f, accent: 0x75c996 }, seed: (321 ^ Math.imul(89, 7919)) | 0 });
  const before = plain(context.run);
  call(); assert.deepEqual(plain(context.run), before);
  context.run.expedition = { active: { kind: 'mirrors' } };
  assert.deepEqual(call(), { style: 'crystal', palette: { wall: 2, ground: 3, accent: 4 }, seed: (321 ^ Math.imul(89, 7919) ^ 0x7316dea) | 0 });
  context.run.expedition.active.kind = 'archive';
  assert.deepEqual(call().palette, { wall: 0xaea38f, ground: 0x9b9387, accent: 0xf1d29e });
  assert.equal(call().style, 'books');
  assert.match(tower, /window\.TowerMode\s*=\s*\{[^\n]*\batmosphereStyle\b/);
  assert.ok(tower.indexOf('floorConfig = C.floorConfig(run.floor)') < tower.indexOf('try { startGame(); }'), '初始建牆前已有章節設定');
});
