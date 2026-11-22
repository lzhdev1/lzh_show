import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TownBuilder, addBench, addGardenTree, addLampPost, addTreePlanter, buildMidrise, buildShop, buildTower } from "./townBuild";
import { createDealership } from "./townDealership";
import { buildConvenienceStore } from "./townStores";
import { createTownLife } from "./townLife";
import { createTownRoads, SIGNAL_POLES } from "./townRoads";
import { disposeTownMaterials, lampGlow, signMaterial, signTexture, townGlass, townInk, townSolid } from "./townMaterials";
import { MIDRISES, POCKET_PARK, SHOPS, TOWERS, WALK, AVENUES, CROSSES, INTERSECTIONS, type TownFace } from "./townLayout";
import type { WorldObstacles } from "../obstacles";

const faceYaw: Record<TownFace, number> = { "+z": 0, "-z": Math.PI, "+x": Math.PI / 2, "-x": -Math.PI / 2 };

/** 沿四条主路的人行道均匀布灯，路口区间自动跳过 */
const LAMPS: Array<[number, number]> = (() => {
  const list: Array<[number, number]> = [];
  const nearIntersection = (x: number, z: number) =>
    INTERSECTIONS.some(i => Math.abs(x - i.cross.x) < i.cross.half + 4 && Math.abs(z - i.avenue.z) < i.avenue.half + 4);
  for (const a of AVENUES) {
    for (const z of [a.z - a.half - 1, a.z + a.half + 1]) {
      for (let x = a.x0 + 6; x <= a.x1 - 4; x += 14) {
        if (!nearIntersection(x, z)) list.push([x, z]);
      }
    }
  }
  for (const c of CROSSES) {
    for (const x of [c.x - c.half - 1, c.x + c.half + 1]) {
      for (let z = c.z0 + 7; z <= c.z1 - 4; z += 16) {
        if (!nearIntersection(x, z)) list.push([x, z]);
      }
    }
  }
  return list;
})();

const TREES: Array<[number, number]> = [
  [WALK.crossWestX, 24.8], [WALK.crossEastX, 24.8],
  [WALK.crossWestX, 93.4], [WALK.crossEastX, 93.4],
  [WALK.eastWestX, 24.8], [WALK.eastEastX, 24.8],
  [WALK.eastWestX, 93.4], [WALK.eastEastX, 93.4],
  [WALK.crossWestX, 135.2], [WALK.crossEastX, 135.2],
  [WALK.eastWestX, 135.2], [WALK.eastEastX, 135.2],
];

/** 街区内部绿化：只落在铺装边缘、店面背后，不挡门头 */
const PLAZA_TREES: Array<[number, number]> = [
  [46.6, 64], [46.6, 84], [75, 76],
  [119, 65], [118.4, 84], [118.4, 43],
  [45.5, 37.5], [67.5, 29],
  [118.5, 66.5], [118.5, 74],
  [47, 96], [66, 94], [110, 94], [118, 92],
  [47, 128], [76, 134], [88, 128], [119, 134],
  [132.5, 28], [132.5, 50], [132.5, 96], [132.5, 120],
];

const BENCHES: Array<[number, number, number]> = [
  [47.4, 58.8, Math.PI], [73.2, 58.8, Math.PI], [88.6, 58.8, Math.PI], [117.4, 58.8, Math.PI],
  [48.5, 103.2, 0], [66, 103.2, 0], [90, 103.2, 0], [112, 103.2, 0],
  [132.2, 62, Math.PI / 2], [132.2, 86, Math.PI / 2],
];

/** 把整城建筑的实心/玻璃/墨线各并成一张网格；每栋只剩招牌等少量独立网格 */
function mergeBuildingShells(group: THREE.Group, roots: THREE.Object3D[]) {
  group.updateMatrixWorld(true);
  const solids: THREE.BufferGeometry[] = [];
  const glasses: THREE.BufferGeometry[] = [];
  const inks: THREE.BufferGeometry[] = [];
  const oldGeometries: THREE.BufferGeometry[] = [];
  for (const root of roots) {
    root.updateMatrixWorld(true);
    const remove: THREE.Object3D[] = [];
    root.traverse(node => {
      if (node instanceof THREE.Mesh && (node.material === townSolid || node.material === townGlass)) {
        const geo = node.geometry.clone().applyMatrix4(node.matrixWorld);
        (node.material === townSolid ? solids : glasses).push(geo);
        oldGeometries.push(node.geometry);
        remove.push(node);
      } else if (node instanceof THREE.LineSegments && node.material === townInk) {
        const geo = node.geometry.clone().applyMatrix4(node.matrixWorld);
        inks.push(geo);
        oldGeometries.push(node.geometry);
        remove.push(node);
      }
    });
    remove.forEach(node => node.removeFromParent());
  }
  for (const geo of oldGeometries) geo.dispose();

  const addStatic = (parts: THREE.BufferGeometry[], kind: "solid" | "glass" | "ink") => {
    if (!parts.length) return;
    const merged = mergeGeometries(parts);
    parts.forEach(geo => geo.dispose());
    if (!merged) return;
    if (kind === "ink") {
      const edges = new THREE.LineSegments(merged, townInk);
      edges.renderOrder = 1;
      edges.name = "town-merged-ink";
      group.add(edges);
      return;
    }
    const mesh = new THREE.Mesh(merged, kind === "solid" ? townSolid : townGlass);
    mesh.castShadow = kind === "solid";
    mesh.receiveShadow = kind === "solid";
    mesh.name = kind === "solid" ? "town-merged-solid" : "town-merged-glass";
    group.add(mesh);
  };
  addStatic(solids, "solid");
  addStatic(glasses, "glass");
  addStatic(inks, "ink");
}



export interface Town {
  group: THREE.Group;
  update: (dt: number, t: number) => void;
  dispose: () => void;
}

export function createTown(obstacles: WorldObstacles): Town {
  const group = new THREE.Group();
  group.name = "town";

  const roads = createTownRoads();
  group.add(roads.group);

  const buildingRoots: THREE.Object3D[] = [];
  for (const def of TOWERS) {
    const root = buildTower(def);
    buildingRoots.push(root);
    group.add(root);
    obstacles.addBox(def.x, def.z, def.w / 2, def.d / 2, faceYaw[def.face]);
  }
  for (const def of MIDRISES) {
    const root = buildMidrise(def);
    buildingRoots.push(root);
    group.add(root);
    obstacles.addBox(def.x, def.z, def.w / 2, def.d / 2, faceYaw[def.face]);
  }
  for (const def of SHOPS) {
    if (def.enterable === "mart24") {
      const root = buildConvenienceStore(def, obstacles);
      buildingRoots.push(root);
      group.add(root);
    } else {
      const root = buildShop(def);
      buildingRoots.push(root);
      group.add(root);
      obstacles.addBox(def.x, def.z, def.w / 2, def.d / 2, faceYaw[def.face]);
    }
  }
  const dealer = createDealership(obstacles);
  buildingRoots.push(dealer);
  group.add(dealer);
  mergeBuildingShells(group, buildingRoots);

  // —— 街道家具 ——
  const props = new TownBuilder();
  const globes: Array<[number, number]> = [];
  for (const [x, z] of LAMPS) {
    addLampPost(props, x, z);
    globes.push([x, z]);
    obstacles.addCircle(x, z, 0.28);
  }
  for (const [x, z] of TREES) {
    addTreePlanter(props, x, z, 0.92 + ((x + z) % 3) * 0.06);
    obstacles.addCircle(x, z, 0.66);
  }
  for (const [x, z] of PLAZA_TREES) {
    addTreePlanter(props, x, z, 0.9);
    obstacles.addCircle(x, z, 0.62);
  }

  // 口袋公园：水景 + 长椅，给东侧街区一个可停留的开放空间
  const park = POCKET_PARK;
  props.cylinder(2.25, 2.4, 0.5, 0xb3a48c, { x: park.x, y: 0.25, z: park.z }, 24);
  props.cylinder(1.95, 1.95, 0.07, 0x84c7d0, { x: park.x, y: 0.53, z: park.z }, 20);
  props.cylinder(0.38, 0.46, 1.05, 0xb3a48c, { x: park.x, y: 1.0, z: park.z }, 14);
  props.cylinder(1.05, 0.62, 0.3, 0xb3a48c, { x: park.x, y: 1.55, z: park.z }, 18);
  props.cylinder(0.8, 0.8, 0.05, 0x84c7d0, { x: park.x, y: 1.72, z: park.z }, 16);
  props.sphere(0.26, 0x9fd6d8, { x: park.x, y: 1.92, z: park.z }, 10, 7);
  obstacles.addCircle(park.x, park.z, 2.55);
  addBench(props, park.x, park.z - 3.4, 0);
  addBench(props, park.x, park.z + 3.4, Math.PI);

  // 三块街区花园：草皮 + 矮绿篱 + 园树，打断大片铺装的单调
  const garden = (cx: number, cz: number, w: number, d: number, trees: Array<[number, number]>) => {
    props.box(w, 0.05, d, 0x8fae6c, { x: cx, y: 0.14, z: cz });
    props.box(w, 0.5, 0.28, 0x5d7d4b, { x: cx, y: 0.37, z: cz - d / 2 + 0.14 });
    props.box(0.28, 0.5, d * 0.6, 0x5d7d4b, { x: cx - w / 2 + 0.14, y: 0.37, z: cz + d * 0.12 });
    props.box(0.28, 0.5, d * 0.6, 0x5d7d4b, { x: cx + w / 2 - 0.14, y: 0.37, z: cz + d * 0.12 });
    for (const [tx, tz] of trees) {
      addGardenTree(props, tx, tz, 0.85 + ((tx + tz) % 3) * 0.05);
      obstacles.addCircle(tx, tz, 0.48);
    }
  };
  garden(92, 83, 7, 9, [[90.6, 81.5], [93.6, 85.4]]);
  garden(101, 33, 7, 9, [[99.6, 31], [102.4, 35.4]]);
  garden(62, 30, 9, 6, [[59.8, 30], [64.4, 29.2]]);
  garden(70, 135, 8, 5, [[67, 134], [72.5, 136.5]]);
  garden(116, 134, 7, 5, [[113.5, 133], [118, 136]]);
  garden(136, 128, 5, 7, [[136, 128]]);
  addBench(props, 92, 78.4, 0);
  addBench(props, 101, 28.4, 0);
  addBench(props, 62, 26.7, 0);
  addBench(props, 70, 131.8, 0);
  addBench(props, 116, 130.8, 0);
  for (const [x, z, ry] of BENCHES) addBench(props, x, z, ry);
  addBench(props, 47.2, 44.6, Math.PI);
  addBench(props, 73.2, 44.6, Math.PI);

  // 消防栓与邮筒
  const hydrant = (x: number, z: number) => {
    props.cylinder(0.16, 0.2, 0.62, 0xb94b3e, { x, y: 0.31, z });
    props.cylinder(0.22, 0.22, 0.1, 0xb94b3e, { x, y: 0.66, z });
    props.box(0.5, 0.12, 0.12, 0xb94b3e, { x, y: 0.42, z });
    obstacles.addCircle(x, z, 0.22);
  };
  hydrant(50.5, 48.8);
  hydrant(110, 55.2);
  props.box(0.5, 0.72, 0.4, 0x4d7a86, { x: 106.5, y: 0.5, z: 48.8 });
  props.cylinder(0.22, 0.22, 0.08, 0x4d7a86, { x: 106.5, y: 0.88, z: 48.8 }, 10);
  obstacles.addCircle(106.5, 48.8, 0.25);

  // 入口门楼：桥头东侧两根砖柱 + 横梁 + 城名
  const gateX = 45.2;
  for (const z of [47.8, 56.2]) {
    props.box(0.8, 5.2, 0.8, 0xb3795c, { x: gateX, y: 2.6, z });
    props.box(1.0, 0.28, 1.0, 0x8f6a52, { x: gateX, y: 5.32, z });
    obstacles.addBox(gateX, z, 0.45, 0.45, 0);
  }
  props.box(0.75, 0.55, 9.4, 0x8f6a52, { x: gateX, y: 5.6, z: 52 });
  props.box(0.9, 0.12, 5.2, 0xe6d6b6, { x: gateX, y: 5.92, z: 52 });
  const gateTex = signTexture("河东小城", "#efe2c6", "#4b3a2c", "#8d6647");
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.66), signMaterial(gateTex));
  gateSign.position.set(gateX - 0.42, 5.55, 52);
  gateSign.rotation.y = -Math.PI / 2;
  group.add(gateSign);

  const propsGroup = props.build(true, true);
  group.add(propsGroup);

  const globeGeo = new THREE.SphereGeometry(0.27, 12, 8);
  const globeMesh = new THREE.InstancedMesh(globeGeo, lampGlow, globes.length);
  const matrix = new THREE.Matrix4();
  globes.forEach(([x, z], i) => {
    matrix.makeTranslation(x, 5.28, z);
    globeMesh.setMatrixAt(i, matrix);
  });
  globeMesh.instanceMatrix.needsUpdate = true;
  globeMesh.castShadow = false;
  group.add(globeMesh);

  for (const p of SIGNAL_POLES) obstacles.addCircle(p.x, p.z, 0.3);

  const life = createTownLife(roads.signalStates);
  group.add(life.group);

  return {
    group,
    update(dt, t) {
      roads.update(t);
      life.update(dt, t);
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      group.traverse(node => {
        if (node instanceof THREE.InstancedMesh) node.dispose();
        if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points)) return;
        geometries.add(node.geometry);
        const list = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of list) {
          materials.add(material);
          if (material.map) textures.add(material.map);
        }
      });
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
      disposeTownMaterials();
      group.clear();
    },
  };
}
