import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TownBuilder } from "./townBuild";

export const CAR_COLORS = [0xd96a4f, 0x6fa3b4, 0xe7d2a6, 0x8aa36d, 0xf0ede4, 0x59626c] as const;

/** 低模轿车：车身 + 座舱玻璃带 + 前后灯 + 四轮；局部 +x 为车头，整体由调用方旋转 */
export function addCar(b: TownBuilder, color: number, x: number, y: number, z: number, scale = 1) {
  const s = scale;
  b.add(new RoundedBoxGeometry(3.95 * s, 0.55 * s, 1.72 * s, 3, 0.16 * s), color, { x, y: y + 0.72 * s, z });
  // 前后舱盖，压出轿车三厢比例
  b.add(new RoundedBoxGeometry(1.18 * s, 0.16 * s, 1.66 * s, 2, 0.1 * s), color, { x: x + 1.34 * s, y: y + 1.0 * s, z });
  b.add(new RoundedBoxGeometry(0.92 * s, 0.15 * s, 1.64 * s, 2, 0.1 * s), color, { x: x - 1.46 * s, y: y + 0.99 * s, z });
  // 座舱：比车身窄一圈，侧窗、前风挡、后风挡各自独立
  b.add(new RoundedBoxGeometry(2.16 * s, 0.5 * s, 1.5 * s, 3, 0.12 * s), color, { x: x - 0.14 * s, y: y + 1.2 * s, z });
  b.add(new RoundedBoxGeometry(1.9 * s, 0.1 * s, 1.42 * s, 2, 0.08 * s), color, { x: x - 0.14 * s, y: y + 1.46 * s, z });
  b.box(1.86 * s, 0.36 * s, 0.06 * s, 0x6f99a8, { x: x - 0.14 * s, y: y + 1.19 * s, z: z + 0.75 * s, glass: true });
  b.box(1.86 * s, 0.36 * s, 0.06 * s, 0x6f99a8, { x: x - 0.14 * s, y: y + 1.19 * s, z: z - 0.75 * s, glass: true });
  b.box(0.07 * s, 0.44 * s, 1.36 * s, 0x6f99a8, { x: x + 0.82 * s, y: y + 1.21 * s, z, rz: -0.32, glass: true });
  b.box(0.07 * s, 0.43 * s, 1.34 * s, 0x6f99a8, { x: x - 1.1 * s, y: y + 1.21 * s, z, rz: 0.36, glass: true });
  // 后视镜
  b.box(0.14 * s, 0.1 * s, 0.1 * s, color, { x: x + 0.64 * s, y: y + 1.13 * s, z: z + 0.9 * s });
  b.box(0.14 * s, 0.1 * s, 0.1 * s, color, { x: x + 0.64 * s, y: y + 1.13 * s, z: z - 0.9 * s });
  // 前后灯、格栅与保险杠
  b.box(0.1 * s, 0.2 * s, 0.38 * s, 0xfff0c4, { x: x + 2.0 * s, y: y + 0.82 * s, z: z + 0.56 * s });
  b.box(0.1 * s, 0.2 * s, 0.38 * s, 0xfff0c4, { x: x + 2.0 * s, y: y + 0.82 * s, z: z - 0.56 * s });
  b.box(0.08 * s, 0.2 * s, 0.9 * s, 0x35383b, { x: x + 2.01 * s, y: y + 0.75 * s, z });
  b.box(0.08 * s, 0.18 * s, 0.34 * s, 0xd8483c, { x: x - 2.0 * s, y: y + 0.8 * s, z: z + 0.56 * s });
  b.box(0.08 * s, 0.18 * s, 0.34 * s, 0xd8483c, { x: x - 2.0 * s, y: y + 0.8 * s, z: z - 0.56 * s });
  b.box(3.7 * s, 0.16 * s, 1.78 * s, 0x47474a, { x, y: y + 0.42 * s, z });
  for (const wx of [-1.24, 1.24]) for (const wz of [-0.83, 0.83]) {
    b.cylinder(0.37 * s, 0.37 * s, 0.26 * s, 0x2d2d2e, { x: x + wx * s, y: y + 0.36 * s, z: z + wz * s, rx: Math.PI / 2 }, 12);
    b.cylinder(0.19 * s, 0.19 * s, 0.29 * s, 0xaaa9a2, { x: x + wx * s, y: y + 0.36 * s, z: z + wz * s, rx: Math.PI / 2 }, 10);
  }
}

/** 一台独立车辆：整体 merge，最多 2 个网格 */
export function buildCar(color: number) {
  const b = new TownBuilder();
  addCar(b, color, 0, 0, 0);
  const group = b.build(true, false);
  group.name = "town-car";
  return group;
}
