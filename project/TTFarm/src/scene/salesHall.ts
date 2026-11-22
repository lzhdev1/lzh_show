import * as THREE from "three";
import { TownBuilder } from "./town/townBuild";
import { SALES_HALL } from "./salesHallLayout";
import { lampGlow, showroomGlass, signMaterial, signTexture } from "./town/townMaterials";
import type { WorldObstacles } from "./obstacles";

const PLASTER = 0xeadcc2;
const TIMBER = 0x876a4c;
const ROOF = 0x6f7c72;
const STONE = 0xb9ae9a;

/**
 * 河岸售货大厅：混凝土台架空河坡，白灰墙 + 木构 + 东面整幅河景玻璃。
 * 北门 2.2m 自动门；室内蔬菜架、肉品冷柜、称重台与吊灯。
 */
export function createSalesHall(obstacles: WorldObstacles): THREE.Group {
  const b = new TownBuilder();
  const extras = new THREE.Group();
  const { w, d, h, floorY } = SALES_HALL;
  const hw = w / 2, hd = d / 2;
  const doorW = SALES_HALL.doorW;
  const doorL = -doorW / 2, doorR = doorW / 2;

  // 架空基座：整块混凝土台 + 东侧挡墙，把河坡藏到台下
  b.box(w + 1.2, floorY, d + 0.8, 0xa9a091, { y: floorY / 2 });
  b.box(w + 0.4, 0.12, d + 0.2, 0xd8c9ad, { y: floorY - 0.04 });
  b.box(0.4, 1.7, d + 0.2, 0x958b79, { x: hw + 0.35, y: -0.55, z: 0 });
  for (const z of [-3.6, 0, 3.6]) {
    b.cylinder(0.24, 0.3, 1.5, 0x8e8577, { x: hw + 0.15, y: -0.65, z }, 8);
  }

  // 室内木地板
  b.box(w - 0.35, 0.03, d - 0.35, 0xc7a97d, { y: floorY + 0.015 });
  // 地板拼缝
  for (let i = -3; i <= 3; i++) {
    b.box(w - 0.4, 0.008, 0.025, 0x9a805c, { y: floorY + 0.033, z: i * 1.25 });
  }

  // 西墙、南墙：白灰墙 + 木框
  b.box(0.32, h, d, PLASTER, { x: -hw + 0.16, y: h / 2 });
  b.box(0.38, h + 0.3, 0.38, TIMBER, { x: -hw + 0.16, y: h / 2, z: -hd + 0.19 });
  b.box(0.38, h + 0.3, 0.38, TIMBER, { x: -hw + 0.16, y: h / 2, z: hd - 0.19 });
  b.box(w, h, 0.32, PLASTER, { z: -hd + 0.16, y: h / 2 });
  b.box(w + 0.2, 0.42, 0.42, TIMBER, { y: 0.33, z: -hd + 0.21 });
  b.box(w + 0.2, 0.24, 0.42, TIMBER, { y: h - 0.3, z: -hd + 0.21 });

  // 北面：门洞两侧玻璃 + 门头 + 雨棚
  b.box(w + 0.3, 0.5, 0.42, TIMBER, { y: h - 0.25, z: hd });
  b.box(doorW, 0.28, 0.5, TIMBER, { x: 0, y: 4.25, z: hd });
  for (const x of [-hw + 0.18, doorL - 0.1, doorR + 0.1, hw - 0.18]) {
    b.box(0.2, h - 0.5, 0.26, TIMBER, { x, y: h / 2, z: hd - 0.05 });
  }
  b.box(w - 1.4, 0.26, 0.26, TIMBER, { y: 0.34, z: hd - 0.05 });
  // 雨棚：向外出挑 1.4m
  b.box(w + 0.8, 0.12, 1.6, 0x6d7b70, { y: 4.42, z: hd + 0.72 });
  b.box(w + 0.9, 0.14, 0.14, TIMBER, { y: 4.35, z: hd + 1.5 });
  for (const x of [-hw + 0.2, hw - 0.2]) {
    b.cylinder(0.07, 0.09, 1.6, TIMBER, { x, y: 3.55, z: hd + 1.1 }, 8);
  }

  // 东面整幅河景玻璃：五道竖梃
  for (const z of [-hd + 0.2, -2.4, 0, 2.4, hd - 0.2]) {
    b.box(0.3, h, 0.18, TIMBER, { x: hw - 0.1, y: h / 2, z });
  }
  b.box(0.3, 0.28, d - 0.2, TIMBER, { x: hw - 0.1, y: h - 0.16 });
  b.box(0.3, 0.24, d - 0.2, TIMBER, { x: hw - 0.1, y: 0.36 });

  // 浅坡屋顶：两片木构坡面 + 屋脊
  for (const side of [-1, 1]) {
    b.box(w / 2 + 0.7, 0.22, d + 0.9, ROOF, { x: side * (w / 4 + 0.35), y: h + 0.55, rz: side * 0.16 });
  }
  b.box(0.18, 0.18, d + 1.0, TIMBER, { y: h + 1.12, z: 0 });
  // 屋脊通风口
  b.box(0.5, 0.35, 2.2, 0x59655f, { y: h + 1.3, z: -1.2 });

  // 柜台：西侧靠中，面向门口
  b.box(1.45, 1.0, 3.1, 0x8d6a4b, { x: -1.55, y: 0.72, z: 0.6 });
  b.box(1.65, 0.12, 3.3, 0xe2d2b6, { x: -1.55, y: 1.28, z: 0.6 });
  b.box(0.4, 0.34, 0.32, 0x37424a, { x: -1.9, y: 1.5, z: 1.6 });
  b.box(0.55, 0.18, 0.5, 0xb9b2a2, { x: -1.25, y: 1.43, z: 0.2 });
  // 秤上的青菜
  b.box(0.5, 0.18, 0.34, 0x6e9b5e, { x: -1.25, y: 1.58, z: 0.2 });

  // 蔬菜架：沿西墙三段木架，摆南瓜/番茄/白菜/胡萝卜
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 0.55 + shelf * 0.62;
    b.box(0.8, 0.08, 4.6, 0xa98b62, { x: -2.55, y, z: -2.1 });
    b.box(0.08, 0.55, 0.08, TIMBER, { x: -2.55, y: y - 0.27, z: -4.2 });
    b.box(0.08, 0.55, 0.08, TIMBER, { x: -2.55, y: y - 0.27, z: 0.1 });
    const produce = [
      { color: 0xe08a4c, w: 0.38, h: 0.3 },
      { color: 0xc95e4e, w: 0.24, h: 0.24 },
      { color: 0x83a45c, w: 0.34, h: 0.3 },
      { color: 0xd9a95a, w: 0.2, h: 0.42 },
      { color: 0x9b7bb4, w: 0.22, h: 0.2 },
    ];
    for (let i = 0; i < 8; i++) {
      const p = produce[(i + shelf * 2) % produce.length];
      b.box(p.w, p.h, p.w, p.color, { x: -2.28, y: y + p.h / 2 + 0.04, z: -3.9 + i * 0.55 });
    }
  }

  // 肉品冷柜：南侧，玻璃罩 + 红白肉块
  b.box(3.1, 1.0, 1.1, 0xd7d3c4, { x: 0.55, y: 0.72, z: -4.35 });
  b.box(2.9, 0.08, 0.95, 0x8a6a4d, { x: 0.55, y: 1.26, z: -4.35 });
  for (let i = 0; i < 5; i++) {
    b.box(0.38, 0.18, 0.55, i % 2 ? 0xb44f4a : 0xe0a394, { x: -0.55 + i * 0.55, y: 1.4, z: -4.35 });
  }
  // 冷柜玻璃挡板
  const caseGlass = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.75, 0.05), showroomGlass);
  caseGlass.position.set(0.55, 1.68, -3.82);
  extras.add(caseGlass);

  // 吊灯三盏
  for (const [x, z] of [[-0.5, -2.6], [-0.5, 1.8], [1.3, 3.2]] as const) {
    b.box(0.05, 0.9, 0.05, 0x3f3b35, { x, y: h - 0.85, z });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 12, 1, true), lampGlow);
    shade.position.set(x, h - 1.38, z);
    shade.rotation.x = Math.PI;
    extras.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lampGlow);
    bulb.position.set(x, h - 1.5, z);
    extras.add(bulb);
  }

  // 门口价目黑板
  b.box(1.5, 1.1, 0.06, 0x3f4b45, { x: 1.8, y: 2.0, z: hd + 0.12 });
  for (let i = 0; i < 4; i++) {
    b.box(1.0, 0.05, 0.02, 0xf1e8d3, { x: 1.8, y: 2.38 - i * 0.2, z: hd + 0.16 });
  }

  // 玻璃：东面整墙 + 北门两侧 + 停靠门扇
  const eastGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.7, d - 0.5), showroomGlass);
  eastGlass.position.set(hw - 0.02, h / 2 + 0.1, 0);
  extras.add(eastGlass);
  const northL = new THREE.Mesh(new THREE.BoxGeometry(doorL - (-hw + 0.24), h - 1.4, 0.06), showroomGlass);
  northL.position.set((-hw + 0.24 + doorL) / 2, h / 2 + 0.2, hd - 0.1);
  const northR = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.24 - doorR, h - 1.4, 0.06), showroomGlass);
  northR.position.set((doorR + hw - 0.24) / 2, h / 2 + 0.2, hd - 0.1);
  extras.add(northL, northR);
  for (const sign of [-1, 1]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2 - 0.06, 3.3, 0.04), showroomGlass);
    pane.position.set(sign * (doorW / 2 + 0.52), 1.8, hd + 0.05);
    extras.add(pane);
  }

  // 招牌
  const tex = signTexture("河岸售货大厅", "#eadcc2", "#3d5a49", "#b17a4e");
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.9), signMaterial(tex));
  sign.position.set(0, h - 0.1, hd + 0.24);
  extras.add(sign);
  const subTex = signTexture("蔬菜 · 肉品 · 称重", "#3d5a49", "#eadcc2", "#b17a4e");
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.38), signMaterial(subTex));
  sub.position.set(0, 3.85, hd + 0.12);
  extras.add(sub);

  // 门外货筐与草垛，给河岸一点生活气
  b.box(1.3, 0.6, 1.0, 0xb38b5d, { x: -3.8, y: 0.35, z: 1.0 });
  for (let i = 0; i < 4; i++) {
    b.sphere(0.2, i % 2 ? 0xd8864e : 0x86a45f, { x: -4.1 + i * 0.25, y: 0.7, z: 0.8 + (i % 2) * 0.3 });
  }
  b.box(1.1, 0.55, 0.9, 0xb38b5d, { x: 3.5, y: 0.32, z: -1.6 });

  // 岸边石阶与步道：北门出来接桥西端
  for (let z = 17.6; z < 25; z += 1.2) {
    b.box(3.0, 0.05, 1.1, STONE, { x: 23, y: 0.025, z });
  }
  for (let z = 27; z < 48; z += 1.4) {
    b.box(2.4, 0.05, 1.25, STONE, { x: 17.3 - (z - 27) * 0.02, y: 0.025, z });
  }

  const group = b.build(true, true);
  group.add(extras);
  group.name = "sales-hall";
  group.position.set(SALES_HALL.x, 0, SALES_HALL.z);

  // —— 碰撞：墙分段，北门留 2.2m ——
  const ox = SALES_HALL.x, oz = SALES_HALL.z;
  obstacles.addBox(ox - hw + 0.16, oz, 0.18, hd);
  obstacles.addBox(ox, oz - hd + 0.16, hw, 0.18);
  obstacles.addBox(ox + hw, oz, 0.1, hd);
  const leftHalf = (doorL - (-hw + 0.24)) / 2, rightHalf = (hw - 0.24 - doorR) / 2;
  obstacles.addBox(ox + (-hw + 0.24 + doorL) / 2, oz + hd, leftHalf, 0.1);
  obstacles.addBox(ox + (doorR + hw - 0.24) / 2, oz + hd, rightHalf, 0.1);
  obstacles.addBox(ox - 1.55, oz + 0.6, 0.78, 1.6);
  obstacles.addBox(ox - 2.55, oz - 2.1, 0.42, 2.35);
  obstacles.addBox(ox + 0.55, oz - 4.35, 1.55, 0.55);

  return group;
}
