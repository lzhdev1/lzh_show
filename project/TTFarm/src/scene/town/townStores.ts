import * as THREE from "three";
import { TownBuilder } from "./townBuild";
import type { ShopDef, TownFace } from "./townLayout";
import { PLAZA_Y } from "./townLayout";
import { lampGlow, showroomGlass, signMaterial, signTexture } from "./townMaterials";
import type { WorldObstacles } from "../obstacles";

const FACE_YAW: Record<TownFace, number> = { "+z": 0, "-z": Math.PI, "+x": Math.PI / 2, "-x": -Math.PI / 2 };

/**
 * 可进入的 24H 便利店：门洞 2.2m，前墙只有门洞两侧的玻璃；室内货架、
 * 冷柜、关东煮台、收银台、吊灯。墙体与货架分段注册碰撞。
 */
export function buildConvenienceStore(def: ShopDef, obstacles: WorldObstacles): THREE.Group {
  const b = new TownBuilder();
  const extras = new THREE.Group();
  const yaw = FACE_YAW[def.face];
  const hw = def.w / 2, hd = def.d / 2;
  const doorW = 2.2;
  const doorL = -doorW / 2, doorR = doorW / 2;
  const base = 0xe8dfca;

  // 地台与室内地板
  b.box(def.w + 0.5, 0.18, def.d + 0.5, 0xb8a88f, { y: 0.09 });
  b.box(def.w - 0.3, 0.03, def.d - 0.3, 0xd9cdb6, { y: 0.2 });

  // 侧墙与后墙
  b.box(0.32, def.h, def.d, base, { x: -hw + 0.16, y: def.h / 2 });
  b.box(0.32, def.h, def.d, base, { x: hw - 0.16, y: def.h / 2 });
  b.box(def.w - 0.3, def.h, 0.32, base, { z: -hd + 0.16, y: def.h / 2 });

  // 前墙：门洞左右玻璃 + 门头
  b.box(def.w + 0.4, 0.4, def.d + 0.4, def.accent, { y: def.h - 0.2 });
  b.box(def.w + 0.2, 0.18, 0.5, def.accent, { y: 2.55, z: hd - 0.15 });
  b.box(def.w, 0.16, 0.32, 0xf1e7d4, { y: 2.72, z: hd - 0.12 });
  b.box(doorW, 0.2, 0.32, 0xf1e7d4, { y: def.h - 0.55, z: hd - 0.1 });
  for (const x of [-hw + 0.12, doorL - 0.1, doorR + 0.1, hw - 0.12]) {
    b.box(0.16, def.h - 0.65, 0.24, 0xf1e7d4, { x, y: (def.h - 0.55) / 2 + 0.1, z: hd - 0.1 });
  }
  // 门口踏步与迎宾垫
  b.box(doorW + 0.6, 0.06, 0.8, 0xa89b85, { y: 0.14, z: hd + 0.4 });
  b.box(doorW - 0.3, 0.03, 0.55, 0x9d4f45, { y: 0.18, z: hd + 0.4 });

  // 前玻璃，门洞两侧；自动门玻璃停到两侧
  const northL = new THREE.Mesh(new THREE.BoxGeometry(doorL - (-hw + 0.2), def.h - 0.8, 0.06), showroomGlass);
  northL.position.set((-hw + 0.2 + doorL) / 2, (def.h - 0.65) / 2 + 0.3, hd - 0.16);
  // 上面这块只做视觉，父级整体旋转
  const northR = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.2 - doorR, def.h - 0.8, 0.06), showroomGlass);
  northR.position.set((doorR + hw - 0.2) / 2, (def.h - 0.65) / 2 + 0.3, hd - 0.16);

  // 门洞两侧停靠的自动门扇
  for (const sign of [-1, 1]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2 - 0.05, def.h - 1.0, 0.04), showroomGlass);
    pane.position.set(sign * (doorW / 2 + 0.52), (def.h - 0.65) / 2 + 0.3, hd - 0.2);
    extras.add(pane);
  }
  extras.add(northL, northR);

  // 顶棚与后部冷柜、货架
  b.box(def.w - 0.2, 0.12, def.d - 0.3, 0xcfc4af, { y: def.h - 0.68, z: -0.15 });
  // 冷柜：后墙一排，玻璃门
  b.box(def.w - 1.4, 2.15, 0.75, 0xd9e2df, { y: 1.3, z: -hd + 0.65 });
  for (const x of [-hw + 0.85, -0.45, 1.02, hw - 0.85]) {
    b.box(0.08, 1.8, 0.1, 0x879b96, { x, y: 1.28, z: -hd + 1.03 });
  }
  // 冷柜里的饮料：彩色小瓶
  const drinkColors = [0x7fc1b0, 0xe8b25e, 0xc85f54, 0x6f91c4, 0xd9d3b0];
  for (let i = 0; i < 24; i++) {
    const x = -hw + 0.55 + (i % 12) * 0.48;
    const y = 0.68 + Math.floor(i / 12) * 0.62;
    b.box(0.18, 0.42, 0.18, drinkColors[i % drinkColors.length], { x, y, z: -hd + 1.02 });
  }

  // 两侧货架：三排，留出中间 1.6m 走道
  for (const side of [-1, 1]) {
    const x = side * (hw - 0.6);
    b.box(0.44, 2.0, 4.9, 0xdbcbb0, { x, y: 1.15, z: 0.35 });
    for (let shelf = 0; shelf < 4; shelf++) {
      b.box(0.5, 0.05, 4.85, 0x9f8d73, { x, y: 0.55 + shelf * 0.48, z: 0.35 });
      for (let item = 0; item < 8; item++) {
        const z = -1.9 + item * 0.58;
        const colors = [0xd96c5b, 0xe4b55e, 0x6f9c7e, 0x7d8fbf, 0xd7d0b4, 0xb87fa4];
        b.box(0.28, 0.3, 0.28, colors[(item + shelf + (side > 0 ? 2 : 0)) % colors.length], {
          x: side * (hw - 1.0), y: 0.73 + shelf * 0.48, z,
        });
      }
    }
  }

  // 收银台与关东煮台：放在门内右手边，不挡门
  b.box(2.0, 0.95, 0.85, 0x8d6a4b, { x: hw - 1.75, y: 0.72, z: hd - 2.35 });
  b.box(1.9, 0.1, 0.7, 0xe6d7bd, { x: hw - 1.75, y: 1.23, z: hd - 2.35 });
  b.box(0.48, 0.42, 0.4, 0x394147, { x: hw - 2.2, y: 1.48, z: hd - 2.4 });
  b.box(0.62, 0.4, 0.52, 0x9b4d43, { x: hw - 1.2, y: 1.38, z: hd - 2.45 });
  // 关东煮锅
  b.cylinder(0.42, 0.44, 0.28, 0xc9c2b2, { x: hw - 1.3, y: 1.42, z: hd - 1.65 }, 12);
  for (let i = 0; i < 5; i++) {
    b.cylinder(0.075, 0.075, 0.08, 0xe1c890, { x: hw - 1.55 + i * 0.12, y: 1.58, z: hd - 1.65 }, 8);
  }

  // 吊灯：三盏暖白圆灯
  const lampPositions: Array<[number, number]> = [[-1.4, 1.8], [1.0, 1.8], [0.0, -1.6]];
  for (const [x, z] of lampPositions) {
    b.box(0.05, 0.6, 0.05, 0x4a4a48, { x, y: def.h - 0.9, z });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.18, 12, 1, true), lampGlow);
    shade.position.set(x, def.h - 1.2, z);
    extras.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lampGlow);
    bulb.position.set(x, def.h - 1.3, z);
    extras.add(bulb);
  }

  // 玻璃门贴与 24H 招牌
  const frontTex = signTexture(`${def.name} · 24H`, "#e9e2cb", "#35685f", "#d8b25c");
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(def.w - 0.7, 0.92), signMaterial(frontTex));
  sign.position.set(0, def.h - 0.38, hd + 0.04);
  extras.add(sign);
  const openTex = signTexture("24 小时营业", "#35685f", "#f4eedc", "#d8b25c");
  const openSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), signMaterial(openTex));
  openSign.position.set(0, 2.4, hd + 0.06);
  extras.add(openSign);

  // 门口 24H 小灯箱
  b.box(0.34, 1.2, 0.34, def.accent, { x: -hw - 0.25, y: 1.9, z: hd - 0.3 });
  const totemTex = signTexture("24H", "#f5edd8", "#35685f", "#d8b25c");
  const totem = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), signMaterial(totemTex));
  totem.position.set(-hw - 0.25, 2.75, hd + 0.0);
  extras.add(totem);

  const group = b.build(true, true);
  group.add(extras);
  group.name = def.id;
  group.position.set(def.x, PLAZA_Y, def.z);
  group.rotation.y = yaw;

  // 碰撞：墙体与货架/柜台分段；门洞保留 2.2m
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const putBox = (lx: number, lz: number, hx: number, hz: number) => {
    const wx = def.x + lx * cos + lz * sin;
    const wz = def.z - lx * sin + lz * cos;
    obstacles.addBox(wx, wz, hx, hz, yaw);
  };
  putBox(-hw + 0.16, 0, 0.16, hd);
  putBox(hw - 0.16, 0, 0.16, hd);
  putBox(0, -hd + 0.16, hw, 0.16);
  const leftHalf = (doorL - (-hw + 0.2)) / 2, rightHalf = (hw - 0.2 - doorR) / 2;
  putBox(-hw + 0.2 + leftHalf, hd - 0.1, leftHalf, 0.1);
  putBox(doorR + rightHalf, hd - 0.1, rightHalf, 0.1);
  for (const side of [-1, 1]) putBox(side * (hw - 0.6), 0.35, 0.22, 2.45);
  putBox(hw - 1.75, hd - 2.35, 1.0, 0.45);

  return group;
}
