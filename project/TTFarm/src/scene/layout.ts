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
export const FENCE_X = 11.6;
export const FENCE_Z = 8.6;
export const GATE_HALF = 1.7;

/** 河宽的一半 */
export const RIVER_HALF_WIDTH = 6.5;

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
 * 桥：架在河道上的一段，中心取曲线 0.52 处。
 * along 是跨河方向（沿河的法线），across 是顺河方向。
 */
const bridgeIndex = Math.round(RIVER_POINTS.length * 0.52);
const bridgePoint = RIVER_POINTS[bridgeIndex];
const bridgePrev = RIVER_POINTS[bridgeIndex - 2];
const bridgeNext = RIVER_POINTS[bridgeIndex + 2];
const tangent = new THREE.Vector3(
  bridgeNext.x - bridgePrev.x,
  0,
  bridgeNext.z - bridgePrev.z
).normalize();
const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

export const BRIDGE = {
  x: bridgePoint.x,
  z: bridgePoint.z,
  /** 跨河方向单位向量 */
  nx: normal.x,
  nz: normal.z,
  /** 桥体沿跨河方向的半长（要比河宽长，两端各搭到岸上） */
  halfLength: 9.6,
  /** 桥面半宽 */
  halfWidth: 2.7,
  /** 桥面高度 */
  deckY: 0.62,
};

/** 点到河道中心线的最近距离，同时给出从中心指向该点的单位法线 */
export function riverInfo(
  x: number,
  z: number
): { dist: number; nx: number; nz: number; cx: number; cz: number } {
  let best = Infinity;
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
    const d = Math.hypot(dx, dz);
    if (d < best) {
      best = d;
      bx = px;
      bz = pz;
    }
  }

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
  [0, 9.6],
  [4, 16],
  [9, 24],
  [13, 32],
  [17, 39],
  [20.5, 45],
];

export const ROAD_POINTS: THREE.Vector3[] = new THREE.CatmullRomCurve3(
  ROAD_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "catmullrom",
  0.5
).getSpacedPoints(80);

/** 点到土路中心线的最近距离 */
export function roadInfo(x: number, z: number): number {
  let best = Infinity;
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
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
    if (d < best) best = d;
  }
  return best;
}
