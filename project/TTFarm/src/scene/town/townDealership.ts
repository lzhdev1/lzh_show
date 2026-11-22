import * as THREE from "three";
import { TownBuilder } from "./townBuild";
import { buildCar } from "./townCar";
import { DEALERSHIP, PLAZA_Y } from "./townLayout";
import { lampGlow, showroomGlass, signMaterial, signTexture } from "./townMaterials";
import type { WorldObstacles } from "../obstacles";

const WHITE_FRAME = 0xf4ead7;

/**
 * 可进入的汽车店：北面整幅玻璃留 2.2m 自动门，东面仍是整墙河景玻璃。
 * 墙体按分段注册碰撞，门洞不挡人；室内三台展车、圆展台、接待台、沙发与灯带。
 */
export function createDealership(obstacles: WorldObstacles): THREE.Group {
  const b = new TownBuilder();
  const { w, d, h, doorX, doorWidth } = DEALERSHIP;
  const hw = w / 2, hd = d / 2;
  const doorL = doorX - doorWidth / 2, doorR = doorX + doorWidth / 2;

  // 基座与抛光地台
  b.box(w + 0.9, 0.3, d + 0.9, 0xa99b84, { y: 0.15 });
  b.box(w - 0.5, 0.08, d - 0.5, 0xeadfcb, { y: 0.31 });

  // 南、西两面实墙；北、东交给玻璃
  b.box(w, h, 0.5, DEALERSHIP.color, { z: -hd + 0.25, y: h / 2 });
  b.box(0.5, h, d, DEALERSHIP.color, { x: -hw + 0.25, y: h / 2 });
  // 北面门洞上方与两侧的实体框
  b.box(w + 0.6, 0.55, d + 0.6, DEALERSHIP.color, { y: h - 0.05 });
  b.box(w + 0.9, 0.32, d + 0.9, DEALERSHIP.accent, { y: h - 0.45 });
  b.box(w + 0.4, 1.15, 0.42, DEALERSHIP.accent, { y: 8.45, z: hd - 0.2 });
  b.box(0.42, 1.15, d + 0.4, DEALERSHIP.accent, { x: hw - 0.2, y: 8.45 });

  // 屋顶设备与背墙内衬
  b.box(2.4, 1.0, 2.0, 0xd9cbb4, { x: -3.2, y: h + 0.5, z: -2.8 });
  b.cylinder(0.5, 0.5, 0.18, 0x5d6a70, { x: -3.2, y: h + 1.05, z: -2.8 }, 12);
  b.box(w - 1.6, 6.2, 0.12, 0xe7dcc4, { z: -hd + 0.52, y: 3.2 });

  // 北面玻璃的白色竖梃与横梁：门洞处断开
  for (const x of [-hw + 0.4, doorL - 0.08, doorR + 0.08, hw - 0.4]) {
    b.box(0.18, 7.7, 0.24, WHITE_FRAME, { x, y: 4.15, z: hd });
  }
  b.box(doorWidth, 0.18, 0.3, WHITE_FRAME, { x: doorX, y: 7.9, z: hd });
  b.box(w - 0.8, 0.26, 0.3, WHITE_FRAME, { y: 7.9, z: hd });
  b.box(w - 0.4, 0.18, 0.3, WHITE_FRAME, { y: 0.38, z: hd });
  // 门洞地面：一条浅色迎宾石
  b.box(doorWidth + 0.3, 0.08, 1.0, 0xd9ccb7, { x: doorX, y: 0.36, z: hd + 0.25 });

  // 东面竖梃
  for (const z of [-hd + 0.4, 0, hd - 0.4]) {
    b.box(0.24, 7.7, 0.18, WHITE_FRAME, { x: hw, y: 4.15, z });
  }
  b.box(0.3, 0.26, d - 0.8, WHITE_FRAME, { x: hw, y: 7.9 });
  b.box(0.3, 0.18, d - 0.4, WHITE_FRAME, { x: hw, y: 0.38 });

  // 转角柱
  b.box(0.5, 8.3, 0.5, DEALERSHIP.accent, { x: hw - 0.2, y: 4.15, z: hd - 0.2 });

  // 三个展台：两台圆台，一台长台
  const podiums: Array<[number, number, number]> = [
    [-2.6, 0.7, 2.0],
    [2.7, 0.7, 0.8],
    [0.1, 0.55, -2.1],
  ];
  for (const [x, top, z] of podiums) {
    b.cylinder(2.0, 2.1, top - 0.32, 0xd8ccb4, { x, y: 0.32 + (top - 0.32) / 2, z }, 24);
    b.cylinder(1.6, 1.6, 0.06, 0x8f9a94, { x, y: top + 0.03, z }, 24);
  }

  // 接待台、沙发、墙面海报与屏幕
  b.box(2.8, 1.05, 0.9, 0x8c6a4a, { x: -4.1, y: 0.85, z: 2.9 });
  b.box(2.4, 0.16, 0.7, 0xeadfc8, { x: -4.1, y: 1.43, z: 2.9 });
  b.box(0.55, 0.5, 0.55, 0x39434a, { x: -4.1, y: 1.55, z: 2.95 });
  b.box(2.3, 0.5, 1.0, 0x6f7b74, { x: 3.7, y: 0.85, z: 3.1 });
  b.box(2.5, 0.65, 1.1, 0x7d8a82, { x: 3.7, y: 1.22, z: 3.12 });
  b.box(2.2, 2.9, 0.1, DEALERSHIP.accent, { x: 0.2, y: 4.6, z: -hd + 0.6 });
  b.box(1.8, 1.1, 0.06, 0xdfe9e4, { x: 0.2, y: 4.6, z: -hd + 0.68 });
  b.box(1.6, 0.9, 0.06, 0xdfe9e4, { x: 2.7, y: 4.5, z: -hd + 0.68 });
  b.cylinder(0.28, 0.32, 1.9, 0xd3a85c, { x: -4.6, y: 1.0, z: 4.0 }, 10);
  b.box(0.55, 0.55, 0.55, 0xcf8c56, { x: -4.6, y: 2.1, z: 4.0, rz: 0.2 });

  const group = b.build(true, true);

  // 两面超大落地玻璃：北面门洞断开，东面整墙
  const glassMat = showroomGlass;
  const northL = new THREE.Mesh(new THREE.BoxGeometry(doorL - (-hw + 0.55), 7.55, 0.07), glassMat);
  northL.position.set((-hw + 0.55 + doorL) / 2, 4.15, hd - 0.02);
  group.add(northL);
  const northR = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.55 - doorR, 7.55, 0.07), glassMat);
  northR.position.set((doorR + hw - 0.55) / 2, 4.15, hd - 0.02);
  group.add(northR);
  // 自动门：两片玻璃停在门洞两侧
  for (const sign of [-1, 1]) {
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(doorWidth / 2 - 0.06, 7.2, 0.05), glassMat);
    doorGlass.position.set(doorX + sign * (doorWidth / 2 + 0.55), 4.0, hd - 0.08);
    group.add(doorGlass);
  }
  const glassE = new THREE.Mesh(new THREE.BoxGeometry(0.07, 7.55, d - 0.9), glassMat);
  glassE.position.set(hw - 0.02, 4.15, 0);
  group.add(glassE);

  // 三台展车
  const cars = [
    { color: 0xd96a4f, x: -2.6, z: 2.0, y: 0.76, ry: 1.1, scale: 0.96 },
    { color: 0x6fa3b4, x: 2.7, z: 0.8, y: 0.76, ry: -0.55, scale: 1.04 },
    { color: 0xe7d2a6, x: 0.1, z: -2.1, y: 0.61, ry: 2.5, scale: 0.9 },
  ];
  for (const c of cars) {
    const car = buildCar(c.color);
    car.scale.setScalar(c.scale);
    car.position.set(c.x, c.y, c.z);
    car.rotation.y = c.ry;
    group.add(car);
  }

  // 灯带
  for (const x of [-3.4, 3.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 6.6), lampGlow);
    strip.position.set(x, 8.35, -0.4);
    group.add(strip);
  }

  // 店招
  const northTex = signTexture(DEALERSHIP.name, "#f4ead4", "#2f3c43", "#8a6b4d");
  const northSign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.16), signMaterial(northTex));
  northSign.position.set(0, 8.45, hd + 0.03);
  group.add(northSign);
  const eastTex = signTexture(DEALERSHIP.name, "#2f3c43", "#f5ead2", "#c7a877");
  const eastSign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.16), signMaterial(eastTex));
  eastSign.position.set(hw + 0.04, 8.45, 0);
  eastSign.rotation.y = Math.PI / 2;
  group.add(eastSign);
  const doorTex = signTexture("自动门 ENTER", "#2f3c43", "#f5ead2", "#c7a877");
  const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.35), signMaterial(doorTex));
  doorSign.position.set(doorX, 2.65, hd + 0.04);
  group.add(doorSign);

  group.name = DEALERSHIP.id;
  group.position.set(DEALERSHIP.x, PLAZA_Y, DEALERSHIP.z);

  // —— 碰撞：墙分段，门洞不挡人 ——
  const ox = DEALERSHIP.x, oz = DEALERSHIP.z;
  obstacles.addBox(ox, oz - hd + 0.25, w / 2, 0.28);              // 南墙
  obstacles.addBox(ox - hw + 0.25, oz, 0.28, d / 2);              // 西墙
  obstacles.addBox(ox + hw, oz, 0.12, d / 2);                     // 东玻璃
  const leftHalf = (doorL - (-hw + 0.35)) / 2;
  const rightHalf = (hw - 0.35 - doorR) / 2;
  obstacles.addBox(ox + (-hw + 0.35 + doorL) / 2, oz + hd, leftHalf, 0.12);
  obstacles.addBox(ox + (doorR + hw - 0.35) / 2, oz + hd, rightHalf, 0.12);
  for (const [x, , z] of podiums) obstacles.addCircle(ox + x, oz + z, 1.55);
  obstacles.addBox(ox - 4.1, oz + 2.9, 1.4, 0.45);
  obstacles.addCircle(ox - 4.6, oz + 4.0, 0.35);

  return group;
}
