import * as THREE from "three";
import { buildCar } from "./town/townCar";
import { signTexture, lampGlow } from "./town/townMaterials";
import { HALL_PARKING_BAYS, HALL_PARKING_LOT } from "./salesHallLayout";
import type { WorldObstacles } from "./obstacles";

const ASPHALT = 0x5b5d5a;
const ASPHALT_DARK = 0x50524f;
const LINE = 0xf3ecd8;
const CONCRETE = 0xc8bca7;
const STONE = 0x928775;

const surfaceMaterial = new THREE.MeshStandardMaterial({
  color: ASPHALT, roughness: 0.94, metalness: 0.02,
});
const apronMaterial = new THREE.MeshStandardMaterial({
  color: ASPHALT_DARK, roughness: 0.95, metalness: 0.02,
});
const paintMaterial = new THREE.MeshStandardMaterial({
  color: LINE, roughness: 0.68, metalness: 0.01,
});
const concreteMaterial = new THREE.MeshStandardMaterial({
  color: CONCRETE, roughness: 0.9,
});
const stoneMaterial = new THREE.MeshStandardMaterial({
  color: STONE, roughness: 0.92,
});

function slab(
  width: number, depth: number, height: number,
  x: number, y: number, z: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

/** 停车场功能件：五个标准车位、挡车器、入口牌、灯与静态停放的 NPC 车。 */
export function createHallParking(obstacles: WorldObstacles): THREE.Group {
  const group = new THREE.Group();
  group.name = "hall-parking";
  const lot = HALL_PARKING_LOT;
  const bay = HALL_PARKING_BAYS;
  const lotW = lot.x1 - lot.x0;
  const lotD = lot.z1 - lot.z0;
  const lotCX = (lot.x0 + lot.x1) / 2;
  const lotCZ = (lot.z0 + lot.z1) / 2;

  // 沥青面：主场地 + 东侧入口 + 大厅北门短接步道
  group.add(slab(lotW, lotD, 0.065, lotCX, 0.0325, lotCZ, surfaceMaterial));
  group.add(slab(lot.apronX1 - lot.x1, lot.apronZ1 - lot.apronZ0, 0.065,
    (lot.x1 + lot.apronX1) / 2, 0.0325, (lot.apronZ0 + lot.apronZ1) / 2, apronMaterial));
  group.add(slab(lot.pathX1 - lot.pathX0, lot.pathZ1 - lot.pathZ0, 0.04,
    (lot.pathX0 + lot.pathX1) / 2, 0.02, (lot.pathZ0 + lot.pathZ1) / 2, concreteMaterial));

  // 车位线：先画前缘横线，再画车位分隔竖线；线宽 7.5cm，近看才像刚刷的漆
  const lineY = 0.069;
  const bayCount = bay.count;
  const bayEndX = bay.x0 + bay.width * bayCount;
  const bayEndZ = bay.z0 + bay.depth;
  group.add(slab(bayEndX - bay.x0, 0.075, 0.006,
    (bay.x0 + bayEndX) / 2, lineY, bay.z0, paintMaterial));
  for (let i = 0; i <= bayCount; i++) {
    group.add(slab(0.075, bay.depth, 0.006,
      bay.x0 + i * bay.width, lineY, (bay.z0 + bayEndZ) / 2, paintMaterial));
  }
  // 车位后缘线，和入口前缘一起把五个格子框完整
  group.add(slab(bayEndX - bay.x0, 0.075, 0.006,
    (bay.x0 + bayEndX) / 2, lineY, bayEndZ, paintMaterial));

  // 每个车位尾部的混凝土挡车器
  for (let i = 0; i < bayCount; i++) {
    const cx = bay.x0 + bay.width * (i + 0.5);
    group.add(slab(1.62, 0.18, 0.09, cx, 0.079, bayEndZ - 0.16, concreteMaterial));
    // 两个黑黄警示块，衬一点颜色
    for (const sx of [-0.38, 0.38]) {
      group.add(slab(0.34, 0.185, 0.095, cx + sx, 0.082, bayEndZ - 0.16, stoneMaterial));
    }
  }

  // 西、北、南三边低路缘；东边留入口
  const curbH = 0.14;
  group.add(slab(0.24, lotD + 0.2, curbH, lot.x0 - 0.05, curbH / 2, lotCZ, concreteMaterial));
  group.add(slab(lotW, 0.24, curbH, lotCX, curbH / 2, lot.z0 + 0.04, concreteMaterial));
  group.add(slab(lotW, 0.24, curbH, lotCX, curbH / 2, lot.z1 - 0.04, concreteMaterial));

  // 入口牌：白底绿字，P + 停车场
  const signTex = signTexture("P  停车场", "#f7f1df", "#2f6152", "#2f6152");
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.68),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }),
  );
  sign.position.set(22.15, 2.45, 18.15);
  sign.rotation.y = Math.PI;
  group.add(sign);
  for (const sx of [-1.0, 1.0]) {
    group.add(slab(0.09, 0.09, 2.4, 22.15 + sx, 1.2, 18.15, stoneMaterial));
  }
  group.add(slab(2.45, 0.12, 0.12, 22.15, 2.82, 18.15, stoneMaterial));
  obstacles.addCircle(22.15, 18.15, 0.22);

  // 两盏矮庭院灯，晚上给停车场一点暖光
  for (const [lx, lz] of [[lot.x0 + 0.45, lot.z0 + 0.9], [lot.x1 - 0.45, lot.z0 + 0.9]] as const) {
    group.add(slab(0.13, 0.13, 2.7, lx, 1.35, lz, stoneMaterial));
    group.add(slab(0.4, 0.4, 0.38, lx, 2.72, lz, lampGlow));
    obstacles.addCircle(lx, lz, 0.16);
  }

  // 静态停放的 NPC 车：只占 3 个车位，其余留空；第 3 个车位留给送货车
  const parked: Array<{ bay: number; color: number; style: "city" | "tourer" | "sport"; scale: number }> = [
    { bay: 0, color: 0x6fa3b4, style: "city", scale: 0.98 },
    { bay: 1, color: 0xe7d2a6, style: "tourer", scale: 1.0 },
    { bay: 4, color: 0x8aa36d, style: "sport", scale: 1.02 },
  ];
  for (const item of parked) {
    const mesh = buildCar(item.color, item.style);
    mesh.scale.setScalar(item.scale);
    mesh.position.set(bay.x0 + bay.width * (item.bay + 0.5), 0.065, bay.z0 + bay.depth / 2);
    mesh.rotation.y = -Math.PI / 2;
    group.add(mesh);
    const cx = bay.x0 + bay.width * (item.bay + 0.5);
    obstacles.addBox(cx, bay.z0 + bay.depth / 2, 1.0, 2.08);
  }

  return group;
}
