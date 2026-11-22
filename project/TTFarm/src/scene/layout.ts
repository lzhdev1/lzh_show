import * as THREE from "three";

/**
 * 世界布局的唯一事实源：地图多大、农场围栏在哪、河怎么流、桥在哪。
 * world.ts 建场景、player.ts 判边界、loop.ts 判点击落点都从这里取，
 * 改一处不会出现"看到的地形"和"能走的范围"对不上的情况。
 */

/** 可走区域：正方形，|x| <= WORLD_HALF 且 |z| <= WORLD_HALF */
export const WORLD_HALF = 150;
/** 山心到原点的距离：山脚正好压在可走边界外侧，人走到边上就是山脚 */
export const MOUNTAIN_LINE = 164;
/** 正门方向（+z 那条边）中间留出的山口半宽，以后扩图从这里接 */
export const GATE_GAP = 32;

/** 农场围栏（矩形），正面（+z）和后墙（-z）各开一道门 */
export const FENCE_X = 20;
export const FENCE_Z = 15;
export const GATE_HALF = 2.2;
export const FARM_BARN = { x: -13.1, z: -4.3, yaw: 0.50 };
export const FARM_MILL = { x: 12.7, z: -9.4, yaw: -0.48 };
export const FARM_SIGN = { x: -4.05, z: FENCE_Z - 0.7, yaw: 0.26 };

/** 河宽的一半 */
export const RIVER_HALF_WIDTH = 6.5;

/**
 * 河谷横截面：河不是平铺在地上的一条蓝带，而是草地上真正凹下去的一道沟。
 * 岸肩与草地齐平 → 下坡 → 水面线 → 水下坡 → 河床底。
 * 水面宽度就取 waterLine，正好与岸坡相交，不会出现"水浮在岸上"的悬空边。
 */
export const RIVER_BED = {
  /** 与草地齐平的外缘（岸肩外沿） */
  shoulder: 11.4,
  /** 平肩结束、开始下坡的位置 */
  edge: 8.4,
  /** 水面与岸坡的交线（水面宽度） */
  waterLine: 7.0,
  /** 水面高度：低于草地 0.5 米，看着才像一条沟里的水 */
  waterY: -0.5,
  /** 河床底平台边缘 */
  bedEdge: 2.6,
  /** 河床最低处 */
  bedY: -1.60,
};

/** 距河心 dist 处的河谷地面高度（水下的地形；岸肩外返回 0） */
export function riverBedHeight(dist: number): number {
  const { shoulder, edge, waterLine, waterY, bedEdge, bedY } = RIVER_BED;
  if (dist >= shoulder) return 0;
  if (dist >= edge) {
    // 岸肩：比草地高 4mm，避免和地面 z-fighting
    const t = (shoulder - dist) / (shoulder - edge);
    return 0.004 * t;
  }
  if (dist >= waterLine) {
    const t = (edge - dist) / (edge - waterLine);
    return 0.004 + (waterY - 0.004) * t * t;
  }
  if (dist >= bedEdge) {
    const t = (waterLine - dist) / (waterLine - bedEdge);
    return waterY + (bedY - waterY) * t;
  }
  return bedY;
}

/**
 * 河：从地图左下角的山脚流出来，沿 +z 边往右拐一段，
 * 再折向 -z 竖着往上游走，最后斜穿到地图右上角的山脚收尾。
 * 竖段特意走在农场右侧 30 米开外，河道不碰院子。
 */
const RIVER_CTRL: Array<[number, number]> = [
  [-152, 146],
  [-124, 126],
  [-94, 112],
  [-64, 108],
  [-36, 112],
  [-12, 120],
  [10, 118],
  [28, 108],
  [36, 90],
  [32, 68],
  [30, 46],
  [34, 24],
  [44, 4],
  [58, -14],
  [74, -38],
  [92, -66],
  [110, -96],
  [128, -124],
  [148, -146],
];

const curve = new THREE.CatmullRomCurve3(
  RIVER_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "catmullrom",
  0.5
);

/** 采样后的河道中心线，场景和碰撞共用同一组点 */
export const RIVER_POINTS: THREE.Vector3[] = curve.getSpacedPoints(160);

/**
 * 桥：对准河东小城主大道（z=52）架设，桥面 7.2m 与主大道同宽。
 * 东坡道端点 x≈43.1，正好压在城市道路起点 x=42.6 上，不再错位。
 * along 是跨河方向（正东），across 是顺河方向。
 */
export const BRIDGE = {
  x: 30.5,
  z: 52,
  /** 跨河方向单位向量：正东，和城市入口完全对齐 */
  nx: 1,
  nz: 0,
  /** 桥体沿跨河方向的半长（要比河宽长，两端各搭到岸上） */
  halfLength: 9.6,
  /** 桥面半宽：7.2m，两侧各留 0.78m 人行道，车辆可双向通过 */
  halfWidth: 3.6,
  /** 桥面高度 */
  deckY: 0.62,
  rampLength: 3.0,
};

/** 点到河道中心线的最近距离，同时给出从中心指向该点的单位法线 */
export function riverInfo(
  x: number,
  z: number
): { dist: number; nx: number; nz: number; cx: number; cz: number } {
  let bestSq = Infinity;
  let bx = x;
  let bz = z;
  let nx = 1;
  let nz = 0;

  for (let i = 0; i < RIVER_POINTS.length - 1; i += 1) {
    const a = RIVER_POINTS[i];
    const b = RIVER_POINTS[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = x - a.x;
    const apz = z - a.z;
    const lenSq = abx * abx + abz * abz;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apz * abz) / lenSq));
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dx = x - px;
    const dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestSq) {
      bestSq = d2;
      bx = px;
      bz = pz;
    }
  }

  const best = Math.sqrt(bestSq);
  if (best > 1e-6) {
    nx = (x - bx) / best;
    nz = (z - bz) / best;
  } else {
    // 正落在中心线上：用一个默认方向推开，保证调用方总能拿到有效法线
    nx = 1;
    nz = 0;
  }

  return { dist: best, nx, nz, cx: bx, cz: bz };
}

/** 该点是否踩在水里（不含桥面） */
export function inRiver(x: number, z: number, pad = 0): boolean {
  const { dist } = riverInfo(x, z);
  return dist < RIVER_HALF_WIDTH + pad;
}

/** 该点是否在桥面上（pad 是给人物半径留的余量） */
export function onBridge(x: number, z: number, pad = 0): boolean {
  const dx = x - BRIDGE.x;
  const dz = z - BRIDGE.z;
  // 跨河方向的分量 / 顺河方向的分量
  const along = dx * BRIDGE.nx + dz * BRIDGE.nz;
  const across = -dx * BRIDGE.nz + dz * BRIDGE.nx;
  return Math.abs(along) <= BRIDGE.halfLength && Math.abs(across) <= BRIDGE.halfWidth + pad;
}

/** Height of the bridge deck or its two inclined approach ramps. */
export function bridgeHeightAt(x: number, z: number): number | undefined {
  const dx = x - BRIDGE.x, dz = z - BRIDGE.z;
  const along = Math.abs(dx * BRIDGE.nx + dz * BRIDGE.nz);
  const across = Math.abs(-dx * BRIDGE.nz + dz * BRIDGE.nx);
  if (across > BRIDGE.halfWidth || along > BRIDGE.halfLength + BRIDGE.rampLength) return;
  return BRIDGE.deckY * (1 - Math.max(0, along - BRIDGE.halfLength) / BRIDGE.rampLength);
}

/** 点位是否落在可走的方形范围内 */
export function inWorld(x: number, z: number): boolean {
  return Math.abs(x) <= WORLD_HALF && Math.abs(z) <= WORLD_HALF;
}

/** 路宽的一半 */
export const ROAD_HALF_WIDTH = 1.2;

/**
 * 土路：从农场正门出来，绕到木桥的坡道口。
 * 有这条路，出门往桥走这件事才不显得像在空地上乱窜。
 */
const ROAD_CTRL: Array<[number, number]> = [
  [0, 7.4],
  [0, FENCE_Z - 2.4],
  [0, FENCE_Z + 0.5],
  [3, 20],
  [9, 24],
  [13, 32],
  [17, 39],
  [BRIDGE.x - BRIDGE.nx * (BRIDGE.halfLength + BRIDGE.rampLength + 2.5),
   BRIDGE.z - BRIDGE.nz * (BRIDGE.halfLength + BRIDGE.rampLength + 2.5)],
  [BRIDGE.x - BRIDGE.nx * (BRIDGE.halfLength + BRIDGE.rampLength - 0.35),
   BRIDGE.z - BRIDGE.nz * (BRIDGE.halfLength + BRIDGE.rampLength - 0.35)],
];

export const ROAD_POINTS: THREE.Vector3[] = new THREE.CatmullRomCurve3(
  ROAD_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "catmullrom",
  0.5
).getSpacedPoints(80);

/** 点到土路中心线的最近距离 */
export function roadInfo(x: number, z: number): number {
  let bestSq = Infinity;
  for (let i = 0; i < ROAD_POINTS.length - 1; i += 1) {
    const a = ROAD_POINTS[i];
    const b = ROAD_POINTS[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lenSq = abx * abx + abz * abz;
    const t =
      lenSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / lenSq));
    const dx = x - (a.x + abx * t);
    const dz = z - (a.z + abz * t);
    bestSq = Math.min(bestSq, dx * dx + dz * dz);
  }
  return Math.sqrt(bestSq);
}
