import * as THREE from "three";
import { TownBuilder } from "./townBuild";
import { buildCar, CAR_COLORS } from "./townCar";
import { DEALERSHIP, PLAZA_Y } from "./townLayout";
import { lampGlow, showroomGlass, signMaterial, signTexture } from "./townMaterials";

const WHITE_FRAME = 0xf4ead7;

export function createDealership(): THREE.Group {
  const b = new TownBuilder();
  const { w, d, h } = DEALERSHIP;
  const hw = w / 2, hd = d / 2;

  b.box(w + 0.9, 0.34, d + 0.9, 0xb6a78f, { y: 0.17 });
  b.box(w - 0.4, 0.12, d - 0.4, 0xe9dfca, { y: 0.32 });

  // 只保留西、南两面实墙，北、东两面整面交给玻璃
  b.box(w, h, 0.5, DEALERSHIP.color, { z: -hd + 0.25, y: h / 2 });
  b.box(0.5, h, d, DEALERSHIP.color, { x: -hw + 0.25, y: h / 2 });
  b.box(w + 0.6, 0.55, d + 0.6, DEALERSHIP.color, { y: h - 0.05 });
  b.box(w + 0.9, 0.32, d + 0.9, DEALERSHIP.accent, { y: h - 0.45 });
  // 玻璃上方的招牌墙：让店招有实体落脚
  b.box(w + 0.4, 1.15, 0.42, DEALERSHIP.accent, { y: 8.45, z: hd - 0.2 });
  b.box(0.42, 1.15, d + 0.4, DEALERSHIP.accent, { x: hw - 0.2, y: 8.45 });

  // 屋顶设备与背墙内衬
  b.box(2.4, 1.0, 2.0, 0xd9cbb4, { x: -3.2, y: h + 0.5, z: -2.8 });
  b.cylinder(0.5, 0.5, 0.18, 0x5d6a70, { x: -3.2, y: h + 1.05, z: -2.8 }, 12);
  b.box(w - 1.6, 5.6, 0.12, 0xe7dcc4, { z: -hd + 0.52, y: 3.2 });

  // 玻璃幕墙的白色竖梃与横梁：保留整面通透，只做必要分格
  for (const [x, z] of [[-hw + 0.4, hd], [0, hd], [hw - 0.4, hd]]) {
    b.box(0.2, 7.7, 0.24, WHITE_FRAME, { x, y: 4.15, z });
  }
  b.box(w - 0.8, 0.26, 0.3, WHITE_FRAME, { y: 7.9, z: hd });
  b.box(w - 0.4, 0.18, 0.3, WHITE_FRAME, { y: 0.38, z: hd });
  for (const [x, z] of [[hw, -hd + 0.4], [hw, 0], [hw, hd - 0.4]]) {
    b.box(0.24, 7.7, 0.2, WHITE_FRAME, { x, y: 4.15, z });
  }
  b.box(0.3, 0.26, d - 0.8, WHITE_FRAME, { x: hw, y: 7.9 });
  b.box(0.3, 0.18, d - 0.4, WHITE_FRAME, { x: hw, y: 0.38 });

  // 转角柱：两面玻璃交汇处唯一的实体
  b.box(0.5, 8.3, 0.5, DEALERSHIP.accent, { x: hw - 0.2, y: 4.15, z: hd - 0.2 });

  // 店内地台、展台、前台与墙面海报
  b.cylinder(2.2, 2.2, 0.22, 0xd8ccb4, { x: -2.7, y: 0.54, z: 0.2 }, 24);
  b.cylinder(1.75, 1.75, 0.08, 0x8f9a94, { x: -2.7, y: 0.68, z: 0.2 }, 24);
  b.cylinder(1.9, 1.9, 0.22, 0xd8ccb4, { x: 2.9, y: 0.54, z: -1.0 }, 24);
  b.cylinder(1.5, 1.5, 0.08, 0x8f9a94, { x: 2.9, y: 0.68, z: -1.0 }, 24);
  b.box(2.6, 1.05, 0.8, 0x8c6a4a, { x: -3.6, y: 0.85, z: -3.9 });
  b.box(3.4, 2.2, 0.1, DEALERSHIP.accent, { x: 0.2, y: 4.6, z: -hd + 0.6 });
  b.box(2.6, 1.6, 0.08, 0xe9dcc0, { x: 2.7, y: 4.5, z: -hd + 0.6 });

  const group = b.build(true, true);

  // 两面超大落地玻璃
  const glassN = new THREE.Mesh(new THREE.BoxGeometry(w - 0.9, 7.55, 0.07), showroomGlass);
  glassN.position.set(0, 4.15, hd - 0.02);
  group.add(glassN);
  const glassE = new THREE.Mesh(new THREE.BoxGeometry(0.07, 7.55, d - 0.9), showroomGlass);
  glassE.position.set(hw - 0.02, 4.15, 0);
  group.add(glassE);

  // 展车：一辆朝向大道，一辆斜对十字街
  const carA = buildCar(CAR_COLORS[0]);
  carA.position.set(-2.7, 0.72, 0.2);
  carA.rotation.y = 1.15;
  group.add(carA);
  const carB = buildCar(CAR_COLORS[1]);
  carB.position.set(2.9, 0.72, -1.0);
  carB.rotation.y = -0.55;
  group.add(carB);

  // 室内灯带：透明度高的玻璃后面点两笔暖光
  for (const x of [-3.2, 3.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 6.4), lampGlow);
    strip.position.set(x, 8.35, -0.4);
    group.add(strip);
  }

  // 店招：北面横一块，东面竖一块
  const northTex = signTexture(DEALERSHIP.name, "#f4ead4", "#2f3c43", "#8a6b4d");
  const northSign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.16), signMaterial(northTex));
  northSign.position.set(0, 8.45, hd + 0.03);
  group.add(northSign);
  const eastTex = signTexture(DEALERSHIP.name, "#2f3c43", "#f5ead2", "#c7a877");
  const eastSign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.16), signMaterial(eastTex));
  eastSign.position.set(hw + 0.04, 8.45, 0);
  eastSign.rotation.y = Math.PI / 2;
  group.add(eastSign);

  group.name = DEALERSHIP.id;
  group.position.set(DEALERSHIP.x, PLAZA_Y, DEALERSHIP.z);
  return group;
}
