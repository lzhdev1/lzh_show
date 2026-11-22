import * as THREE from "three";
import { TownBuilder } from "./townBuild";
import { AVENUES, CROSSES, INTERSECTIONS, PLAZAS, PLAZA_Y, ROAD_Y, WALK_Y } from "./townLayout";

const ASPHALT = 0x45474a;
const SIDEWALK = 0xd6cab4;
const CURB = 0xb5a892;
const MARK = 0xf1e8d3;
const PLAZA = 0xc9bda7;

/** 沿一条轴线切段画板 */
function slab(b: TownBuilder, x0: number, x1: number, z0: number, z1: number, hex: number, y: number, h: number) {
  if (x1 <= x0 || z1 <= z0) return;
  b.box(x1 - x0, h, z1 - z0, hex, { x: (x0 + x1) / 2, y: y + h / 2, z: (z0 + z1) / 2 });
}

function curbLine(b: TownBuilder, x0: number, x1: number, z: number) {
  slab(b, x0, x1, z - 0.13, z + 0.13, CURB, 0, 0.17);
}
function curbLineZ(b: TownBuilder, x: number, z0: number, z1: number) {
  slab(b, x - 0.13, x + 0.13, z0, z1, CURB, 0, 0.17);
}

export interface TownRoads {
  group: THREE.Group;
  update: (t: number) => void;
  signalStates: (t: number) => { ew: "green" | "yellow" | "red"; ns: "green" | "yellow" | "red" };
}

const RED = 0xff4438, YELLOW = 0xffbe3d, GREEN = 0x48d079;
const DIM_RED = 0x5c2924, DIM_YELLOW = 0x5a4520, DIM_GREEN = 0x234a32;

export function createTownRoads(): TownRoads {
  const b = new TownBuilder();

  // 柏油：大道整条画，街道只画路口之间的段，避免路口叠面
  for (const a of AVENUES) {
    slab(b, a.x0, a.x1, a.z - a.half, a.z + a.half, ASPHALT, 0, ROAD_Y);
  }
  for (const c of CROSSES) {
    let from = c.z0;
    for (const a of [...AVENUES].sort((m, n) => m.z - n.z)) {
      const gap0 = a.z - a.half - 0.1, gap1 = a.z + a.half + 0.1;
      if (gap0 > from) slab(b, c.x - c.half, c.x + c.half, from, gap0, ASPHALT, 0, ROAD_Y);
      from = Math.max(from, gap1);
    }
    if (from < c.z1) slab(b, c.x - c.half, c.x + c.half, from, c.z1, ASPHALT, 0, ROAD_Y);
  }

  // 人行道：每条线在路口断开，路口四角补 2×2 转角板
  for (const a of AVENUES) {
    for (const z of [a.z - a.half - 1, a.z + a.half + 1]) {
      let from = a.x0;
      for (const c of [...CROSSES].sort((m, n) => m.x - n.x)) {
        const gap0 = c.x - c.half - 1;
        const gap1 = c.x + c.half + 1;
        if (gap0 > from) slab(b, from, gap0, z - 1, z + 1, SIDEWALK, 0, WALK_Y);
        from = Math.max(from, gap1);
      }
      if (from < a.x1) slab(b, from, a.x1, z - 1, z + 1, SIDEWALK, 0, WALK_Y);
    }
  }
  for (const c of CROSSES) {
    for (const x of [c.x - c.half - 1, c.x + c.half + 1]) {
      let from = c.z0;
      for (const a of [...AVENUES].sort((m, n) => m.z - n.z)) {
        const gap0 = a.z - a.half - 1;
        const gap1 = a.z + a.half + 1;
        if (gap0 > from) slab(b, x - 1, x + 1, from, gap0, SIDEWALK, 0, WALK_Y);
        from = Math.max(from, gap1);
      }
      if (from < c.z1) slab(b, x - 1, x + 1, from, c.z1, SIDEWALK, 0, WALK_Y);
    }
  }
  for (const i of INTERSECTIONS) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = i.cross.x + sx * (i.cross.half + 1);
      const z = i.avenue.z + sz * (i.avenue.half + 1);
      slab(b, x - 1, x + 1, z - 1, z + 1, SIDEWALK, 0, WALK_Y);
    }
  }

  // 街区铺装：整块硬地，楼与楼之间不露草
  for (const p of PLAZAS) slab(b, p.x0, p.x1, p.z0, p.z1, PLAZA, 0, PLAZA_Y);

  // 路缘石：沿每条路的两侧，在路口区间断开
  for (const a of AVENUES) {
    for (const side of [-1, 1]) {
      const z = a.z + side * (a.half + 0.13);
      let from = a.x0;
      for (const c of [...CROSSES].sort((m, n) => m.x - n.x)) {
        const gap0 = c.x - c.half - 2;
        const gap1 = c.x + c.half + 2;
        if (gap0 > from) curbLine(b, from, gap0, z);
        from = Math.max(from, gap1);
      }
      if (from < a.x1) curbLine(b, from, a.x1, z);
    }
  }
  for (const c of CROSSES) {
    for (const side of [-1, 1]) {
      const x = c.x + side * (c.half + 0.13);
      let from = c.z0;
      for (const a of [...AVENUES].sort((m, n) => m.z - n.z)) {
        const gap0 = a.z - a.half - 2;
        const gap1 = a.z + a.half + 2;
        if (gap0 > from) curbLineZ(b, x, from, gap0);
        from = Math.max(from, gap1);
      }
      if (from < c.z1) curbLineZ(b, x, from, c.z1);
    }
  }

  // 车道虚线：每条路中心线，路口区间留空
  for (const a of AVENUES) {
    for (let x = a.x0 + 2; x < a.x1 - 2; x += 6) {
      if (CROSSES.some(c => x > c.x - c.half - 3 && x < c.x + c.half + 3)) continue;
      slab(b, x, x + 2.7, a.z - 0.09, a.z + 0.09, MARK, ROAD_Y, 0.014);
    }
  }
  for (const c of CROSSES) {
    for (let z = c.z0 + 2; z < c.z1 - 2; z += 6) {
      if (AVENUES.some(a => z > a.z - a.half - 3 && z < a.z + a.half + 3)) continue;
      slab(b, c.x - 0.09, c.x + 0.09, z, z + 2.7, MARK, ROAD_Y, 0.014);
    }
  }

  // 斑马线：每个路口四条
  const stripe = (x: number, z: number, w: number, d: number) =>
    slab(b, x - w / 2, x + w / 2, z - d / 2, z + d / 2, MARK, ROAD_Y, 0.016);
  for (const i of INTERSECTIONS) {
    const a = i.avenue, c = i.cross;
    for (const cx of [c.x - c.half - 1, c.x + c.half + 1]) {
      for (let k = 0; k < 4; k++) {
        stripe(cx - 1.1 + k * 0.72, a.z, 0.46, a.half * 2 + 0.2);
      }
    }
    for (const cz of [a.z - a.half - 1, a.z + a.half + 1]) {
      for (let k = 0; k < 4; k++) {
        stripe(c.x, cz - 1.1 + k * 0.72, c.half * 2 + 0.2, 0.46);
      }
    }
  }

  // 停车线：每个路口四个方向各一条，给车辆一个停车锚点
  for (const i of INTERSECTIONS) {
    const a = i.avenue, c = i.cross;
    slab(b, c.x - c.half - 3.4, c.x - c.half - 3.0, a.z - a.half + 0.1, a.z - 0.2, MARK, ROAD_Y, 0.014);
    slab(b, c.x + c.half + 3.0, c.x + c.half + 3.4, a.z + 0.2, a.z + a.half - 0.1, MARK, ROAD_Y, 0.014);
    slab(b, c.x - c.half + 0.1, c.x - 0.2, a.z - a.half - 3.4, a.z - a.half - 3.0, MARK, ROAD_Y, 0.014);
    slab(b, c.x + 0.2, c.x + c.half - 0.1, a.z + a.half + 3.0, a.z + a.half + 3.4, MARK, ROAD_Y, 0.014);
  }

  // 井盖：每个路口附近两个
  for (const [n, i] of INTERSECTIONS.entries()) {
    b.cylinder(0.42, 0.42, 0.018, 0x35373a, { x: i.cross.x + 4.2, y: ROAD_Y + 0.01, z: i.avenue.z + 1.6 + (n % 2) }, 14);
    b.cylinder(0.38, 0.38, 0.018, 0x35373a, { x: i.cross.x - 4.6, y: ROAD_Y + 0.01, z: i.avenue.z - 1.4 - (n % 2) }, 14);
  }

  const group = b.build(false, false);
  group.name = "town-roads";

  // 信号灯：每个路口四根柱、四个灯头
  const signalBuilder = new TownBuilder();
  const poles: Array<{ x: number; z: number; face: number; side: "ew" | "ns" }> = [];
  for (const i of INTERSECTIONS) {
    const a = i.avenue, c = i.cross;
    const xo = c.half + 1.5, zo = a.half + 1.4;
    poles.push(
      { x: c.x - xo, z: a.z - zo, face: Math.PI, side: "ew" },
      { x: c.x + xo, z: a.z + zo, face: 0, side: "ew" },
      { x: c.x + xo, z: a.z - zo, face: -Math.PI / 2, side: "ns" },
      { x: c.x - xo, z: a.z + zo, face: Math.PI / 2, side: "ns" },
    );
  }
  for (const p of poles) {
    signalBuilder.cylinder(0.2, 0.28, 0.25, 0x4a4b4d, { x: p.x, y: 0.125, z: p.z }, 8);
    signalBuilder.cylinder(0.08, 0.11, 5.4, 0x4a4b4d, { x: p.x, y: 2.85, z: p.z }, 8);
    signalBuilder.box(0.36, 1.08, 0.3, 0x2f3336, {
      x: p.x + Math.sin(p.face) * 0.32, y: 4.55, z: p.z + Math.cos(p.face) * 0.32, ry: p.face,
    });
    signalBuilder.box(0.7, 0.1, 0.1, 0x4a4b4d, {
      x: p.x + Math.sin(p.face) * 0.18, y: 4.9, z: p.z + Math.cos(p.face) * 0.18, ry: p.face,
    });
  }
  group.add(signalBuilder.build());

  // 镜片按「方向 + 灯色」共享材质并实例化：16 根柱子原本 48 个独立网格，现在只剩 6 个
  const lensGeo = new THREE.SphereGeometry(0.105, 10, 7);
  const buckets = { ew: [[], [], []], ns: [[], [], []] } as Record<"ew" | "ns", THREE.Matrix4[][]>;
  const sideMats = {
    ew: { r: new THREE.MeshBasicMaterial({ color: DIM_RED }), y: new THREE.MeshBasicMaterial({ color: DIM_YELLOW }), g: new THREE.MeshBasicMaterial({ color: DIM_GREEN }) },
    ns: { r: new THREE.MeshBasicMaterial({ color: DIM_RED }), y: new THREE.MeshBasicMaterial({ color: DIM_YELLOW }), g: new THREE.MeshBasicMaterial({ color: DIM_GREEN }) },
  };
  const lensMats: Array<{ side: "ew" | "ns"; r: THREE.MeshBasicMaterial; y: THREE.MeshBasicMaterial; g: THREE.MeshBasicMaterial }> = [];
  for (const p of poles) {
    const nx = Math.sin(p.face), nz = Math.cos(p.face);
    for (const [index, offset] of [[0, 0.34], [1, 0], [2, -0.34]] as const) {
      const matrix = new THREE.Matrix4().makeTranslation(p.x + nx * 0.49, 4.55 + offset, p.z + nz * 0.49);
      buckets[p.side][index].push(matrix);
    }
  }
  for (const side of ["ew", "ns"] as const) {
    const mats = sideMats[side];
    lensMats.push({ side, ...mats });
    for (const [index, mat] of [[0, mats.r], [1, mats.y], [2, mats.g]] as const) {
      const items = buckets[side][index];
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(lensGeo, mat, items.length);
      items.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;
      group.add(mesh);
    }
  }

  const signalStates = (t: number) => {
    const cycle = t % 18;
    if (cycle < 8.5) return { ew: "green" as const, ns: "red" as const };
    if (cycle < 10) return { ew: "yellow" as const, ns: "red" as const };
    if (cycle < 16.5) return { ew: "red" as const, ns: "green" as const };
    return { ew: "red" as const, ns: "yellow" as const };
  };

  const apply = (mat: THREE.MeshBasicMaterial, on: boolean, hexOn: number, hexOff: number) => {
    const target = on ? hexOn : hexOff;
    if (mat.color.getHex() !== target) mat.color.setHex(target);
  };

  const update = (t: number) => {
    const states = signalStates(t);
    for (const s of lensMats) {
      const state = s.side === "ew" ? states.ew : states.ns;
      apply(s.r, state === "red", RED, DIM_RED);
      apply(s.y, state === "yellow", YELLOW, DIM_YELLOW);
      apply(s.g, state === "green", GREEN, DIM_GREEN);
    }
  };
  update(0);

  return { group, update, signalStates };
}

/** 信号灯柱的碰撞占位 */
export const SIGNAL_POLES: Array<{ x: number; z: number }> = INTERSECTIONS.flatMap(i => {
  const xo = i.cross.half + 1.5, zo = i.avenue.half + 1.4;
  return [
    { x: i.cross.x - xo, z: i.avenue.z - zo },
    { x: i.cross.x + xo, z: i.avenue.z + zo },
    { x: i.cross.x + xo, z: i.avenue.z - zo },
    { x: i.cross.x - xo, z: i.avenue.z + zo },
  ];
});
