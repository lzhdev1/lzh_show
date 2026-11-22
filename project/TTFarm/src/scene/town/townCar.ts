import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TownBuilder } from "./townBuild";

export const CAR_COLORS = [0xd96a4f, 0x6fa3b4, 0xe7d2a6, 0x8aa36d, 0xf0ede4, 0x59626c, 0xb06a58, 0x7d8f9c] as const;

export type CarStyle = "city" | "tourer" | "sport";

const STYLE = {
  city: { length: 1, cabin: 1, roof: 1, rack: false, spoiler: false },
  tourer: { length: 1.06, cabin: 1.12, roof: 1.12, rack: true, spoiler: false },
  sport: { length: 0.98, cabin: 0.86, roof: 0.84, rack: false, spoiler: true },
} as const;

/**
 * 低模轿车：三厢车身 + 独立风挡/侧窗 + 后视镜 + 灯组 + 牌照 + 四轮。
 * 局部 +x 为车头。style 只改变座舱长度/高度和少量附件，不重做主体。
 */
export function addCar(
  b: TownBuilder, color: number, x: number, y: number, z: number,
  scale = 1, options: { wheels?: boolean; style?: CarStyle } = {},
) {
  const s = scale;
  const st = STYLE[options.style ?? "city"];
  const L = 3.95 * s * st.length;
  const bodyY = y + 0.72 * s;

  b.add(new RoundedBoxGeometry(L, 0.55 * s, 1.72 * s, 3, 0.16 * s), color, { x, y: bodyY, z });
  // 前后舱盖
  b.add(new RoundedBoxGeometry(1.12 * s * st.length, 0.16 * s, 1.66 * s, 2, 0.1 * s), color, { x: x + L / 2 - 0.55 * s, y: y + 1.0 * s, z });
  b.add(new RoundedBoxGeometry(0.9 * s * st.length, 0.15 * s, 1.64 * s, 2, 0.1 * s), color, { x: x - L / 2 + 0.5 * s, y: y + 0.99 * s, z });
  // 座舱：旅行车更长更高，跑车更低更短
  const cabinL = 2.16 * s * st.cabin;
  const cabinH = 0.5 * s * st.roof;
  const cabinY = y + 1.2 * s * st.roof;
  b.add(new RoundedBoxGeometry(cabinL, cabinH, 1.5 * s, 3, 0.12 * s), color, { x: x - 0.14 * s, y: cabinY, z });
  b.add(new RoundedBoxGeometry(cabinL - 0.24 * s, 0.1 * s, 1.42 * s, 2, 0.08 * s), color, { x: x - 0.14 * s, y: cabinY + 0.26 * s * st.roof, z });
  // 侧窗、前风挡、后风挡
  b.box(cabinL - 0.3 * s, 0.36 * s, 0.06 * s, 0x6f99a8, { x: x - 0.14 * s, y: cabinY - 0.01 * s, z: z + 0.75 * s, glass: true });
  b.box(cabinL - 0.3 * s, 0.36 * s, 0.06 * s, 0x6f99a8, { x: x - 0.14 * s, y: cabinY - 0.01 * s, z: z - 0.75 * s, glass: true });
  b.box(0.07 * s, 0.42 * s * st.roof, 1.36 * s, 0x6f99a8, { x: x + cabinL / 2 - 0.15 * s, y: cabinY, z, rz: -0.32, glass: true });
  b.box(0.07 * s, 0.42 * s * st.roof, 1.34 * s, 0x6f99a8, { x: x - cabinL / 2 + 0.02 * s, y: cabinY, z, rz: 0.36, glass: true });
  // 后视镜
  for (const sz of [-1, 1]) {
    b.box(0.16 * s, 0.1 * s, 0.1 * s, color, { x: x + cabinL / 2 - 0.4 * s, y: cabinY - 0.06 * s, z: z + sz * 0.9 * s });
  }
  // 车门缝
  for (const side of [-1, 1]) {
    b.box(0.035 * s, 0.4 * s, 0.015, 0x8c4436, { x: x - 0.25 * s, y: y + 0.72 * s, z: z + side * 0.865 * s });
  }
  // 前后灯、格栅与保险杠
  b.box(0.1 * s, 0.2 * s, 0.38 * s, 0xfff0c4, { x: x + L / 2, y: y + 0.82 * s, z: z + 0.56 * s });
  b.box(0.1 * s, 0.2 * s, 0.38 * s, 0xfff0c4, { x: x + L / 2, y: y + 0.82 * s, z: z - 0.56 * s });
  b.box(0.08 * s, 0.2 * s, 0.9 * s, 0x35383b, { x: x + L / 2 + 0.01 * s, y: y + 0.76 * s, z });
  b.box(0.08 * s, 0.18 * s, 0.34 * s, 0xd8483c, { x: x - L / 2, y: y + 0.8 * s, z: z + 0.56 * s });
  b.box(0.08 * s, 0.18 * s, 0.34 * s, 0xd8483c, { x: x - L / 2, y: y + 0.8 * s, z: z - 0.56 * s });
  // 牌照
  b.box(0.03 * s, 0.16 * s, 0.42 * s, 0xf2ead7, { x: x - L / 2 - 0.03 * s, y: y + 0.57 * s, z });
  b.box(3.7 * s * st.length, 0.16 * s, 1.78 * s, 0x47474a, { x, y: y + 0.42 * s, z });

  // 旅行车车顶行李架
  if (st.rack) {
    b.box(0.08 * s, 0.08 * s, 1.3 * s, 0x4a4d4f, { x: x - 0.5 * s, y: y + 1.53 * s, z });
    for (const sx of [-0.9, 0.1]) b.box(0.06 * s, 0.08 * s, 1.25 * s, 0x4a4d4f, { x: x + sx * s, y: y + 1.55 * s, z });
  }
  // 跑车尾翼
  if (st.spoiler) {
    b.box(0.35 * s, 0.06 * s, 1.5 * s, 0x3b4042, { x: x - L / 2 + 0.1 * s, y: y + 1.15 * s, z });
    b.box(0.1 * s, 0.28 * s, 0.1 * s, 0x3b4042, { x: x - L / 2 + 0.1 * s, y: y + 1.0 * s, z: z + 0.55 * s });
    b.box(0.1 * s, 0.28 * s, 0.1 * s, 0x3b4042, { x: x - L / 2 + 0.1 * s, y: y + 1.0 * s, z: z - 0.55 * s });
  }

  if (options.wheels !== false) {
    for (const wx of [-1.24, 1.24]) for (const wz of [-0.83, 0.83]) {
      b.cylinder(0.37 * s, 0.37 * s, 0.26 * s, 0x2d2d2e, { x: x + wx * s * st.length, y: y + 0.36 * s, z: z + wz * s, rx: Math.PI / 2 }, 14);
      b.cylinder(0.19 * s, 0.19 * s, 0.29 * s, 0xaaa9a2, { x: x + wx * s * st.length, y: y + 0.36 * s, z: z + wz * s, rx: Math.PI / 2 }, 10);
    }
  }
}

/** NPC 循环车：整体 merge，1 个网格 */
export function buildCar(color: number, style: CarStyle = "city") {
  const b = new TownBuilder();
  addCar(b, color, 0, 0, 0, 1, { style });
  const group = b.build(true, false);
  group.name = "town-car";
  return group;
}

/** 玩家驾驶车：车身 1 个网格 + 4 个独立车轮，用于转动 */
export function buildDetailedCar(color: number, style: CarStyle) {
  const b = new TownBuilder();
  addCar(b, color, 0, 0, 0, 1, { style, wheels: false });
  const body = b.build(true, false);
  body.name = "player-car";
  const root = new THREE.Group();
  root.add(body);
  const wheels: THREE.Group[] = [];
  for (const wx of [-1.24, 1.24]) for (const wz of [-0.83, 0.83]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const wb = new TownBuilder();
    wb.cylinder(0.37, 0.37, 0.26, 0x2d2d2e, { rx: Math.PI / 2 }, 14);
    wb.cylinder(0.19, 0.19, 0.29, 0xaaa9a2, { rx: Math.PI / 2 }, 10);
    const wheel = wb.build(true, false);
    pivot.add(wheel);
    root.add(pivot);
    wheels.push(pivot);
  }
  return { root, wheels };
}
