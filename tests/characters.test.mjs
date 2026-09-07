import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const THREE = require('../lib/three.min.js');
const characters = require('../story/tower-characters.js');
const deps = { THREE, buildCharacter() { throw new Error('原創人物不應只重新著色既有職業'); }, CHARS: [] };

function details(group) {
  let meshes = 0, triangles = 0;
  const materials = new Set(), geometries = new Set();
  group.traverse(object => {
    assert.equal(Boolean(object.isLight), false, '模型不包含即時燈光');
    assert.equal(Boolean(object.isSprite), false, '姓名與圖示由呼叫端配置');
    if (!object.isMesh) return;
    meshes++;
    geometries.add(object.geometry);
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      materials.add(material);
      assert.equal(material.type, 'MeshLambertMaterial');
      assert.equal(material.map, null, '不使用外部貼圖或每幀畫布');
    }
  });
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite));
  return { meshes, triangles, materials, geometries, bounds, size };
}

test('瀏覽器與Node皆提供同一個無外部依賴的建模介面', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../story/tower-characters.js', import.meta.url), 'utf8'), context);
  for (const method of ['buildMerchant', 'buildExplorer', 'buildChest', 'buildGear']) assert.equal(typeof context.TowerCharacters[method], 'function');
  assert.deepEqual(Object.keys(characters.MERCHANT_STYLES), ['tieLing', 'jinHe', 'lanZhou']);
  assert.throws(() => characters.buildMerchant('tieLing'), TypeError);
  for (const invalid of ['missing', '__proto__', 'constructor', null]) assert.throws(() => characters.buildMerchant(invalid, deps), RangeError);
  assert.throws(() => characters.buildGear('not-an-item', deps), RangeError);
});

test('三商人有獨立裝束和輪廓，商品分類正確，保留跟隨走路用四肢樞紐', () => {
  const expected = {
    tieLing: { nodes: ['leather-apron', 'wide-grey-beard', 'forge-hammer', 'forge-helmet'], goods: ['helmet', 'bat'] },
    jinHe: { nodes: ['shawl-back', 'fitted-armor-plate', 'sewing-pouch', 'sewing-shears-a'], goods: ['armor', 'pan'] },
    lanZhou: { nodes: ['long-coat-back', 'short-beard', 'single-goggle-frame', 'back-round-shield'], goods: ['shield', 'staff'] },
  };
  const summaries = {};
  for (const [id, style] of Object.entries(expected)) {
    const model = characters.buildMerchant(id, deps);
    assert.equal(model.isGroup, true);
    assert.equal(model.userData.merchantId, id);
    assert.equal(model.userData.role, 'merchant');
    assert.deepEqual(model.userData.style.goods, style.goods);
    for (const node of style.nodes) assert.ok(model.getObjectByName(node), `${id} 缺少專屬輪廓：${node}`);
    for (const limb of ['armL', 'armR', 'legL', 'legR']) {
      assert.equal(model.userData[limb].isGroup, true);
      assert.equal(model.userData[limb].parent, model);
      model.userData[limb].rotation.x = .2;
    }
    const result = details(model);
    assert.ok(result.meshes <= 45, `${id} meshes: ${result.meshes}`);
    assert.ok(result.triangles <= 1800, `${id} triangles: ${result.triangles}`);
    assert.ok(result.materials.size <= 18, `${id} materials: ${result.materials.size}`);
    assert.ok(result.size.y >= 1.7 && result.size.y < 2.4);
    summaries[id] = result;
  }
  assert.ok(summaries.tieLing.size.x > summaries.lanZhou.size.x, '鐵嶺應比嵐舟矮壯');
  assert.ok(summaries.tieLing.size.y < summaries.jinHe.size.y && summaries.jinHe.size.y < summaries.lanZhou.size.y);
  assert.equal(characters.buildMerchant('blacksmith', deps).userData.merchantId, 'tieLing');
  assert.equal(characters.buildMerchant('tailor', deps).userData.merchantId, 'jinHe');
});

test('探索者具有帽、斗篷、背包和可見地圖，身份不會誤認為商人', () => {
  const model = characters.buildExplorer(deps);
  assert.equal(model.userData.role, 'explorer');
  assert.equal(model.userData.merchantId, undefined);
  for (const part of ['travel-hat-crown', 'travel-cloak', 'field-backpack', 'unfolded-map']) assert.ok(model.getObjectByName(part));
  assert.equal(model.getObjectByName('unfolded-map').parent, model.userData.armL);
  const result = details(model);
  assert.ok(result.meshes < 40);
  assert.ok(result.triangles < 1500);
  assert.ok(result.size.y < 2.3);
});

test('裝備模型有不同外形與局部掛載點，武器從握柄沿Y伸展而不遮滿畫面', () => {
  const expected = { helmet: 'helmet-dome', armor: 'armor-breastplate', shield: 'shield-board', bat: 'bat-barrel', pan: 'pan-bowl', staff: 'staff-crown' };
  for (const [kind, part] of Object.entries(expected)) {
    const model = characters.buildGear(kind, deps);
    assert.equal(model.isGroup, true);
    assert.ok(model.getObjectByName(part));
    assert.deepEqual(model.position.toArray(), [0, 0, 0]);
    assert.equal(model.userData.kind, kind);
    assert.equal(model.userData.mount, characters.GEAR_MOUNTS[kind]);
    const result = details(model);
    assert.ok(result.meshes <= 5);
    assert.ok(result.triangles < 400);
    if (['bat', 'pan', 'staff'].includes(kind)) {
      assert.ok(result.bounds.max.y <= .82 && result.bounds.max.y >= .7);
      assert.ok(result.bounds.min.y >= -.04);
    }
  }
});

test('寶箱蓋有獨立背側鉸鏈，打開只旋轉箱蓋；不同模型不共用可被意外釋放的資源', () => {
  const chest = characters.buildChest(deps);
  const result = details(chest);
  assert.equal(chest.userData.role, 'chest');
  assert.equal(chest.userData.lid.parent, chest);
  const bodyMatrix = chest.userData.body.matrixWorld.clone();
  chest.userData.lid.rotation.x = chest.userData.openAngle;
  chest.updateMatrixWorld(true);
  assert.deepEqual(chest.userData.body.matrixWorld.elements, bodyMatrix.elements);
  assert.ok(new THREE.Box3().setFromObject(chest).max.y > result.bounds.max.y);
  assert.ok(result.meshes <= 12 && result.triangles < 200);
  const a = details(characters.buildMerchant('tieLing', deps));
  const b = details(characters.buildMerchant('tieLing', deps));
  assert.ok([...a.geometries].every(geometry => !b.geometries.has(geometry)));
  assert.ok([...a.materials].every(material => !b.materials.has(material)));
  assert.ok(a.geometries.size < a.meshes, '同一人物內應共用同尺寸幾何減少分配');
});
