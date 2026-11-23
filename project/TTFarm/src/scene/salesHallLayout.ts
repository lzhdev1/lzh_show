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
  { x: 43.4, z: 52.6 },
  { x: 40.0, z: 52.2 },
  { x: 34.0, z: 52.0 },
  { x: 27.0, z: 52.0 },
  { x: 21.0, z: 51.6 },
  { x: 18.0, z: 47.6 },
  { x: 16.6, z: 43.0 },
  { x: 16.3, z: 35.0 },
  { x: 17.2, z: 27.5 },
  { x: 19.3, z: 22.0 },
  { x: 21.2, z: 18.8 },
  { x: 23.0, z: 17.2 },
  { x: 23.0, z: 14.6 },
  { x: 21.6, z: 13.0 },
] as const;

/** 送货车在售货大厅北侧停车场里的固定车位（第 3 个车位中心） */
export const HALL_PARKING = { x: 14.1, z: 24.1, yaw: -Math.PI / 2 } as const;

/**
 * 售货大厅停车场：农场北围栏外、大厅西北侧。
 * 入口在东侧，车道沿南边一条，五个车位一律车头朝北停放。
 */
export const HALL_PARKING_LOT = {
  x0: 6.8, x1: 21.3,
  z0: 18.2, z1: 26.4,
  /** 东侧入口硬化带 */
  apronX1: 23.1,
  apronZ0: 18.3,
  apronZ1: 22.2,
  /** 大厅北门到停车场的短接步道 */
  pathX0: 18.0,
  pathX1: 23.2,
  pathZ0: 17.0,
  pathZ1: 19.0,
} as const;

export const HALL_PARKING_BAYS = {
  x0: 7.6,
  width: 2.6,
  count: 5,
  z0: 22.0,
  depth: 4.2,
} as const;

/** 停车场及其入口，树木/石头/野草都不许落进来 */
export function inHallParkingGround(x: number, z: number): boolean {
  return x >= HALL_PARKING_LOT.x0 - 2.4 && x <= HALL_PARKING_LOT.apronX1 + 1.6 &&
    z >= HALL_PARKING_LOT.pathZ0 - 1.2 && z <= HALL_PARKING_LOT.z1 + 1.8;
}

/** 停车场地面比草地略高，走上去要抬脚 */
export function hallParkingHeight(x: number, z: number): number {
  if (x >= HALL_PARKING_LOT.x0 && x <= HALL_PARKING_LOT.apronX1 &&
      z >= HALL_PARKING_LOT.z0 && z <= HALL_PARKING_LOT.z1) return 0.065;
  if (x >= HALL_PARKING_LOT.pathX0 && x <= HALL_PARKING_LOT.pathX1 &&
      z >= HALL_PARKING_LOT.pathZ0 && z <= HALL_PARKING_LOT.pathZ1) return 0.04;
  return 0;
}

