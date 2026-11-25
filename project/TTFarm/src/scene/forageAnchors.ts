import { FORAGE_ANCHOR_COUNT } from "../game/forage";
import { WILD_CLEARINGS } from "../game/ranch";
import { FENCE_X, FENCE_Z, RIVER_BED, ROAD_HALF_WIDTH, WORLD_HALF, onBridge, riverInfo, roadInfo } from "./layout";
import { onRanchReserve } from "./ranchLayout";
import { inHallParkingGround } from "./salesHallLayout";
import { inTown } from "./town/townLayout";

/**
 * 野菜菜丛的锚点表：只有一处事实源，forageScene 与调试脚本共用。
 * 目标不是“全图平均撒”，而是“撒在玩家真会走到的草地上”——
 * 近处环带多、远处点缀，全部避开院子、牧场、河谷、土路与兽群空地。
 * 每个锚点固定对应一个 slot；forageScene 每轮把 slot 整体错开 5 位，
 * 同一轮内可预期，换轮后菜丛不会永远刷在原来的草地。
 */

// 六条环带：r 是半径，n 是该带的候选数，take 是最终采用的名额
const ANCHOR_RINGS: readonly { r: number; n: number; take: number; jitter: number }[] = [
  { r: 24, n: 11, take: 7, jitter: 4.5 },
  { r: 33, n: 11, take: 6, jitter: 5 },
  { r: 43, n: 10, take: 5, jitter: 5.5 },
  { r: 55, n: 9, take: 4, jitter: 6.5 },
  { r: 72, n: 8, take: 2, jitter: 8 },
  { r: 92, n: 5, take: 1, jitter: 10 },
];

/** 门口看得见的固定点：开局在院子里抬头就能看到菜，不用先跑一趟 */
const DOOR_SIDE: readonly (readonly [number, number])[] = [
  [-3.0, 18.5],
  [11.5, 19.0],
  [-4.0, -19.5],
];

/** 确定性散列，保证每次启动生成同一套锚点 */
function anchorSeed(i: number) {
  let n = Math.imul(i + 0x9e3779b9, 0x85ebca6b) >>> 0;
  n ^= n >>> 13;
  return (Math.imul(n, 0xc2b2ae35) >>> 0) / 4294967296;
}

/** 严格条件：不进城镇、不进院子、不下河谷、不压路、不挤牧场与兽群空地 */
function anchorSpotOk(x: number, z: number) {
  if (Math.abs(x) > WORLD_HALF - 12 || Math.abs(z) > WORLD_HALF - 12) return false;
  if (inTown(x, z)) return false;
  if (Math.abs(x) < FENCE_X + 3 && Math.abs(z) < FENCE_Z + 3) return false;
  if (onRanchReserve(x, z, 3)) return false;
  if (riverInfo(x, z).dist < RIVER_BED.shoulder + 3.2) return false;
  if (onBridge(x, z, 3)) return false;
  if (roadInfo(x, z) < ROAD_HALF_WIDTH + 1.6) return false;
  if (inHallParkingGround(x, z)) return false;
  if (WILD_CLEARINGS.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 8)) return false;
  return true;
}

/** 放宽条件：候选被河谷与牧场砍太多时兜底用，只保证不进城镇、不下水、不进院子 */
function looseOk([x, z]: [number, number]) {
  return Math.abs(x) < WORLD_HALF - 10 && Math.abs(z) < WORLD_HALF - 10 &&
    !inTown(x, z) &&
    !inHallParkingGround(x, z) &&
    !(Math.abs(x) < FENCE_X + 2 && Math.abs(z) < FENCE_Z + 2) &&
    !onRanchReserve(x, z, 2) &&
    riverInfo(x, z).dist > RIVER_BED.shoulder + 2.5;
}

export const FORAGE_ANCHORS: readonly (readonly [number, number])[] = (() => {
  const seeds: [number, number][] = DOOR_SIDE.map(([x, z]) => [x, z] as [number, number]);
  let k = 0;
  for (const ring of ANCHOR_RINGS) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + (anchorSeed(k++) - 0.5) * 0.9;
      const r = ring.r + (anchorSeed(k++) * 2 - 1) * ring.jitter;
      seeds.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  const chosen: [number, number][] = [];
  const spacing = (x: number, z: number) => chosen.length
    ? Math.min(...chosen.map(([cx, cz]) => Math.hypot(x - cx, z - cz)))
    : Infinity;
  const pushSpaced = (list: [number, number][], minGap: number) => {
    let best = -1;
    let bestGap = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const gap = spacing(list[i][0], list[i][1]);
      if (gap >= minGap && gap > bestGap) { bestGap = gap; best = i; }
    }
    if (best < 0) return false;
    chosen.push(list[best]);
    list.splice(best, 1);
    return true;
  };
  const occupied = ([x, z]: [number, number]) =>
    chosen.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.1);

  // 门口那几处先站住脚
  for (const [x, z] of DOOR_SIDE) {
    if (anchorSpotOk(x, z) || looseOk([x, z])) chosen.push([x, z]);
  }
  // 每条环带按名额取点，相邻保持 7 米以上，菜丛不会挤成一坨
  for (const ring of ANCHOR_RINGS) {
    const pool = seeds.filter(([x, z]) => {
      const d = Math.hypot(x, z);
      return Math.abs(d - ring.r) < ring.jitter + 8 && anchorSpotOk(x, z) && !occupied([x, z]);
    });
    for (let i = 0; i < ring.take; i++) if (!pushSpaced(pool, 7)) break;
  }
  // 名额没凑满时，从所有剩余合格点里按最疏的方式补齐
  const extra = seeds.filter(([x, z]) => anchorSpotOk(x, z) && !occupied([x, z]));
  for (const gap of [7, 5, 3]) {
    while (chosen.length < FORAGE_ANCHOR_COUNT && pushSpaced(extra, gap)) { /* 继续补 */ }
  }
  // 河谷、城镇与牧场占掉太多候选时退一档，保证锚点表长度恒定等于锚点数量
  if (chosen.length < FORAGE_ANCHOR_COUNT) {
    const spare = seeds.filter((point) => looseOk(point) && !occupied(point));
    while (chosen.length < FORAGE_ANCHOR_COUNT && spare.length) chosen.push(spare.shift()!);
  }
  return chosen.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10] as const);
})();
