/** 河岸售货大厅：农场东侧、河东岸坡顶。北门进店，东面看河。 */
export const SALES_HALL = {
  x: 23, z: 12, w: 6.4, d: 10, h: 7.2,
  floorY: 0.18,
  doorW: 2.2,
  x0: 23 - 3.2, x1: 23 + 3.2,
  z0: 12 - 5, z1: 12 + 5,
} as const;

/** 柜台中心与交互半径 */
export const HALL_COUNTER = { x: 21.1, z: 12.6, radius: 2.7 } as const;

export function inSalesHall(x: number, z: number): boolean {
  return x >= SALES_HALL.x0 && x <= SALES_HALL.x1 && z >= SALES_HALL.z0 && z <= SALES_HALL.z1;
}

/** 售货大厅及其门口硬化区：树/石/草丛不许落进来 */
export function inSalesHallGround(x: number, z: number): boolean {
  return x >= SALES_HALL.x0 - 2.2 && x <= SALES_HALL.x1 + 2.2 &&
    z >= SALES_HALL.z0 - 1.5 && z <= SALES_HALL.z1 + 3.0;
}

export function salesHallHeight(x: number, z: number): number {
  return inSalesHall(x, z) ? SALES_HALL.floorY : 0;
}

/**
 * 城市顾客路线：主大道 → 桥东门楼 → 水泥桥西端 → 河岸步道 → 大厅北门 → 收银台，
 * 到柜台前停留后原路返回。
 */
export const SHOPPER_ROUTE = [
  { x: 48.5, z: 56.6 },
  { x: 45.2, z: 55.4 },
  { x: 43.4, z: 51.5 },
  { x: 40.0, z: 49.8 },
  { x: 34.0, z: 49.6 },
  { x: 27.0, z: 49.4 },
  { x: 21.0, z: 49.3 },
  { x: 18.0, z: 47.2 },
  { x: 16.6, z: 43.0 },
  { x: 16.3, z: 35.0 },
  { x: 17.2, z: 27.5 },
  { x: 19.3, z: 22.0 },
  { x: 21.2, z: 18.8 },
  { x: 23.0, z: 17.2 },
  { x: 23.0, z: 14.6 },
  { x: 21.6, z: 13.0 },
] as const;
