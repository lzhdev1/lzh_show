import * as THREE from "three";
import { TownBuilder } from "./townBuild";
import { PLAZAS, PLAZA_Y, ROAD_Y, TOWN, WALK_Y, WALK } from "./townLayout";

const ASPHALT = 0x45474a;
const SIDEWALK = 0xd6cab4;
const CURB = 0xb5a892;
const MARK = 0xf1e8d3;
const PLAZA = 0xc9bda7;

/** 沿一条轴线切段画板：跳过路口区间，避免与另一条路重叠造成闪面 */
function slab(b: TownBuilder, x0: number, x1: number, z0: number, z1: number, hex: number, y: number, h: number) {
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
  const a = TOWN.avenue, c = TOWN.cross;

  // 柏油：大道整条，十字街在路口处断开（路口由大道覆盖）
  slab(b, a.x0, a.x1, a.z - a.half, a.z + a.half, ASPHALT, 0, ROAD_Y);
  slab(b, c.x - c.half, c.x + c.half, c.z0, a.z - a.half, ASPHALT, 0, ROAD_Y);
  slab(b, c.x - c.half, c.x + c.half, a.z + a.half, c.z1, ASPHALT, 0, ROAD_Y);

  // 人行道：四条边在路口断开，四角补 2×2 的转角板
  slab(b, a.x0, WALK.crossWestX - 1, WALK.avenueSouthZ - 1, WALK.avenueSouthZ + 1, SIDEWALK, 0, WALK_Y);
  slab(b, WALK.crossEastX + 1, a.x1, WALK.avenueSouthZ - 1, WALK.avenueSouthZ + 1, SIDEWALK, 0, WALK_Y);
  slab(b, a.x0, WALK.crossWestX - 1, WALK.avenueNorthZ - 1, WALK.avenueNorthZ + 1, SIDEWALK, 0, WALK_Y);
  slab(b, WALK.crossEastX + 1, a.x1, WALK.avenueNorthZ - 1, WALK.avenueNorthZ + 1, SIDEWALK, 0, WALK_Y);
  slab(b, WALK.crossWestX - 1, WALK.crossWestX + 1, c.z0, WALK.avenueSouthZ - 1, SIDEWALK, 0, WALK_Y);
  slab(b, WALK.crossWestX - 1, WALK.crossWestX + 1, WALK.avenueNorthZ + 1, c.z1, SIDEWALK, 0, WALK_Y);
  slab(b, WALK.crossEastX - 1, WALK.crossEastX + 1, c.z0, WALK.avenueSouthZ - 1, SIDEWALK, 0, WALK_Y);
  slab(b, WALK.crossEastX - 1, WALK.crossEastX + 1, WALK.avenueNorthZ + 1, c.z1, SIDEWALK, 0, WALK_Y);
  for (const sx of [WALK.crossWestX, WALK.crossEastX]) {
    for (const sz of [WALK.avenueSouthZ, WALK.avenueNorthZ]) {
      slab(b, sx - 1, sx + 1, sz - 1, sz + 1, SIDEWALK, 0, WALK_Y);
    }
  }

  // 街区铺装：整块硬地，楼与楼之间不露草
  for (const p of PLAZAS) slab(b, p.x0, p.x1, p.z0, p.z1, PLAZA, 0, PLAZA_Y);

  // 路缘石
  curbLine(b, a.x0, WALK.crossWestX - 2, a.z + a.half + 0.13);
  curbLine(b, WALK.crossEastX + 2, a.x1, a.z + a.half + 0.13);
  curbLine(b, a.x0, WALK.crossWestX - 2, a.z - a.half - 0.13);
  curbLine(b, WALK.crossEastX + 2, a.x1, a.z - a.half - 0.13);
  curbLineZ(b, c.x - c.half - 0.13, c.z0, WALK.avenueSouthZ - 2);
  curbLineZ(b, c.x - c.half - 0.13, WALK.avenueNorthZ + 2, c.z1);
  curbLineZ(b, c.x + c.half + 0.13, c.z0, WALK.avenueSouthZ - 2);
  curbLineZ(b, c.x + c.half + 0.13, WALK.avenueNorthZ + 2, c.z1);

  // 车道虚线：路口区间留空
  for (let x = a.x0 + 2; x < a.x1 - 2; x += 6) {
    if (x > WALK.crossWestX - 3 && x < WALK.crossEastX + 3) continue;
    slab(b, x, x + 2.7, a.z - 0.09, a.z + 0.09, MARK, ROAD_Y, 0.014);
  }
  for (let z = c.z0 + 2; z < c.z1 - 2; z += 6) {
    if (z > WALK.avenueSouthZ - 3 && z < WALK.avenueNorthZ + 3) continue;
    slab(b, c.x - 0.09, c.x + 0.09, z, z + 2.7, MARK, ROAD_Y, 0.014);
  }

  // 斑马线：跨大道两条（路口西/东），跨十字街两条（路口南/北）
  const stripe = (x: number, z: number, w: number, d: number) =>
    slab(b, x - w / 2, x + w / 2, z - d / 2, z + d / 2, MARK, ROAD_Y, 0.016);
  for (const west of [true, false]) {
    const cx = west ? WALK.crossWestX : WALK.crossEastX;
    for (let i = 0; i < 4; i++) {
      const x = cx - 1.1 + i * 0.72;
      stripe(x, a.z, 0.46, a.half * 2 + 0.2);
    }
  }
  for (const south of [true, false]) {
    const cz = south ? WALK.avenueSouthZ : WALK.avenueNorthZ;
    for (let i = 0; i < 4; i++) {
      const z = cz - 1.1 + i * 0.72;
      stripe(c.x, z, c.half * 2 + 0.2, 0.46);
    }
  }

  // 停车线：给车辆一个“遇红灯停”的视觉锚点
  slab(b, WALK.crossWestX - 2.6, WALK.crossWestX - 2.2, a.z - a.half + 0.1, a.z - 0.2, MARK, ROAD_Y, 0.014);
  slab(b, WALK.crossEastX + 2.2, WALK.crossEastX + 2.6, a.z + 0.2, a.z + a.half - 0.1, MARK, ROAD_Y, 0.014);
  slab(b, c.x - c.half + 0.1, c.x - 0.2, WALK.avenueSouthZ - 2.6, WALK.avenueSouthZ - 2.2, MARK, ROAD_Y, 0.014);
  slab(b, c.x + 0.2, c.x + c.half - 0.1, WALK.avenueNorthZ + 2.2, WALK.avenueNorthZ + 2.6, MARK, ROAD_Y, 0.014);

  // 井盖：两个小圆盘，别让路口太空
  b.cylinder(0.42, 0.42, 0.018, 0x35373a, { x: c.x + 4.2, y: ROAD_Y + 0.01, z: a.z + 1.6 }, 14);
  b.cylinder(0.38, 0.38, 0.018, 0x35373a, { x: c.x - 4.6, y: ROAD_Y + 0.01, z: a.z - 1.4 }, 14);

  const group = b.build(false, false);
  group.name = "town-roads";

  // 信号灯：四根柱、四个灯头，灯头朝向对应车道
  const lensMats: Array<{ side: "ew" | "ns"; r: THREE.MeshBasicMaterial; y: THREE.MeshBasicMaterial; g: THREE.MeshBasicMaterial }> = [];
  const signalBuilder = new TownBuilder();
  const poles: Array<{ x: number; z: number; face: number; side: "ew" | "ns" }> = [
    { x: 77.0, z: 46.7, face: Math.PI, side: "ew" },   // 面朝西，管东行
    { x: 87.0, z: 57.3, face: 0, side: "ew" },         // 面朝东，管西行
    { x: 87.0, z: 46.7, face: -Math.PI / 2, side: "ns" }, // 面朝南，管北行
    { x: 77.0, z: 57.3, face: Math.PI / 2, side: "ns" }, // 面朝北，管南行
  ];
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

  for (const p of poles) {
    const nx = Math.sin(p.face), nz = Math.cos(p.face);
    const r = new THREE.MeshBasicMaterial({ color: DIM_RED });
    const y = new THREE.MeshBasicMaterial({ color: DIM_YELLOW });
    const g = new THREE.MeshBasicMaterial({ color: DIM_GREEN });
    for (const [mat, offset] of [[r, 0.34], [y, 0], [g, -0.34]] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 7), mat);
      lens.position.set(p.x + nx * 0.49, 4.55 + offset, p.z + nz * 0.49);
      group.add(lens);
    }
    lensMats.push({ side: p.side, r, y, g });
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
    if ((mat.color.getHex() !== target)) mat.color.setHex(target);
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
export const SIGNAL_POLES: Array<{ x: number; z: number }> = [
  { x: 77.0, z: 46.7 }, { x: 87.0, z: 57.3 }, { x: 87.0, z: 46.7 }, { x: 77.0, z: 57.3 },
];
