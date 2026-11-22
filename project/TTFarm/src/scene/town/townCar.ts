import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TownBuilder } from "./townBuild";
import { clay } from "../materials";
import { signMaterial, signTexture } from "./townMaterials";

export const CAR_COLORS = [0xd96a4f, 0x6fa3b4, 0xe7d2a6, 0x8aa36d, 0xf0ede4, 0x59626c, 0xb06a58, 0x7d8f9c] as const;

export type CarStyle = "city" | "tourer" | "sport";

interface CarDims {
  half: number;
  width: number;
  bodyTop: number;
  roofY: number;
  cabinFront: number;
  roofFront: number;
  roofRear: number;
  deckRear: number;
  wheelX: number;
  wheelZ: number;
  roofRack: boolean;
  spoiler: boolean;
}

const DIMS: Record<CarStyle, CarDims> = {
  city: {
    half: 2.06, width: 1.78, bodyTop: 0.96, roofY: 1.45,
    cabinFront: 1.02, roofFront: 0.33, roofRear: -1.05, deckRear: -1.82,
    wheelX: 1.28, wheelZ: 0.79, roofRack: false, spoiler: false,
  },
  tourer: {
    half: 2.2, width: 1.86, bodyTop: 0.99, roofY: 1.55,
    cabinFront: 1.04, roofFront: 0.38, roofRear: -1.45, deckRear: -2.03,
    wheelX: 1.36, wheelZ: 0.81, roofRack: true, spoiler: false,
  },
  sport: {
    half: 2.12, width: 1.9, bodyTop: 0.9, roofY: 1.28,
    cabinFront: 0.92, roofFront: 0.28, roofRear: -1.02, deckRear: -1.86,
    wheelX: 1.32, wheelZ: 0.84, roofRack: false, spoiler: true,
  },
};

const SKIN = 0xf0c6a2;
const HAIR = 0x3d2b24;
const COAT = 0xd9c49d;
const PANTS = 0x47505c;
const SHOE = 0x3c3530;

function shapeOfBody(d: CarDims) {
  const s = new THREE.Shape();
  s.moveTo(-d.half, 0.62);
  s.quadraticCurveTo(-d.half + 0.03, 0.86, -d.half + 0.36, 0.94);
  s.lineTo(-0.22 * d.half, d.bodyTop);
  s.lineTo(0.4 * d.half, d.bodyTop);
  s.quadraticCurveTo(0.7 * d.half, d.bodyTop - 0.015, 0.84 * d.half, 0.82);
  s.quadraticCurveTo(d.half - 0.03, 0.72, d.half, 0.58);
  s.quadraticCurveTo(d.half + 0.005, 0.37, d.half - 0.13, 0.3);
  s.lineTo(-d.half + 0.16, 0.3);
  s.quadraticCurveTo(-d.half - 0.005, 0.39, -d.half, 0.62);
  return s;
}

function addBody(paint: TownBuilder, color: number, d: CarDims) {
  const geo = new THREE.ExtrudeGeometry(shapeOfBody(d), {
    depth: d.width,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.045,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -d.width / 2);
  paint.add(geo, color);

  // 前后轮眉：让侧面有起伏，不是一条直板
  for (const wx of [-d.wheelX, d.wheelX]) {
    paint.add(new RoundedBoxGeometry(0.92, 0.18, d.width + 0.05, 3, 0.07), color, {
      x: wx, y: 0.67, z: 0,
    });
    // 轮眉黑色衬里：贴在车身外皮，压住轮胎上沿
    for (const z of [-(d.width / 2 + 0.012), d.width / 2 + 0.012]) {
      const arch = new THREE.TorusGeometry(0.435, 0.026, 6, 22, Math.PI);
      arch.translate(wx, 0.37, z);
      paint.add(arch, 0x3b3d3f);
    }
  }
  // 裙边、前铲、后扩散器
  paint.box(d.half * 1.78, 0.1, d.width + 0.015, 0x4a4b4f, { y: 0.34 });
  paint.add(new RoundedBoxGeometry(0.18, 0.2, d.width + 0.04, 2, 0.05), 0x404246, {
    x: d.half - 0.02, y: 0.43, z: 0,
  });
  paint.add(new RoundedBoxGeometry(0.18, 0.2, d.width + 0.04, 2, 0.05), 0x404246, {
    x: -d.half + 0.02, y: 0.43, z: 0,
  });
  // 前盖与尾箱折线、侧腰线、油箱盖：把大面切出二次元的分块层次
  for (const z of [-(d.width / 2 + 0.012), d.width / 2 + 0.012]) {
    paint.box(d.half * 0.58, 0.018, 0.014, 0xd8cbb8, { x: d.half * 0.46, y: d.bodyTop + 0.012, z });
    paint.box(0.018, 0.35, 0.012, 0x5b4238, { x: d.cabinFront - 0.3, y: 0.69, z });
    paint.box(0.018, 0.35, 0.012, 0x5b4238, { x: d.roofRear + 0.22, y: 0.69, z });
    paint.box(0.56, 0.018, 0.012, 0xc9b9a4, { x: 0.72, y: 0.84, z });
  }
  for (const side of [-1, 1]) {
    paint.add(new THREE.CircleGeometry(0.09, 12), 0x7d4c41, {
      x: -d.half + 0.52, y: 0.78, z: side * (d.width / 2 + 0.004), ry: side < 0 ? Math.PI : 0,
    });
  }
}

function addCabin(paint: TownBuilder, color: number, d: CarDims) {
  const roofLen = d.roofFront - d.roofRear + 0.18;
  const roofX = (d.roofFront + d.roofRear) / 2;
  paint.add(new RoundedBoxGeometry(roofLen, 0.12, d.width - 0.18, 5, 0.06), color, {
    x: roofX, y: d.roofY, z: 0,
  });
  // 车顶前缘与后缘的薄檐，翻过一圈就是二次元车顶的弧
  paint.box(roofLen * 0.9, 0.035, d.width - 0.2, 0xd8cbb8, { x: roofX, y: d.roofY - 0.055, z: 0 });
  // A/C 柱：四条细柱把透明座舱框起来
  for (const z of [-(d.width / 2 - 0.07), d.width / 2 - 0.07]) {
    paint.box(0.085, d.roofY - 0.91, 0.085, color, {
      x: d.roofFront, y: (d.roofY + 0.91) / 2, z, rz: 0.28,
    });
    paint.box(0.085, d.roofY - 0.91, 0.085, color, {
      x: d.roofRear, y: (d.roofY + 0.91) / 2, z, rz: -0.36,
    });
    paint.box(0.065, d.roofY - 0.91, 0.065, 0x383b3d, {
      x: (d.roofFront + d.roofRear) * 0.52, y: (d.roofY + 0.91) / 2, z,
    });
    // C 柱侧板：把后风挡两侧封住，让侧面从“玻璃通到车尾”变成轿车厢体
    const cShape = new THREE.Shape();
    cShape.moveTo(d.roofRear - 0.03, d.roofY - 0.08);
    cShape.lineTo(d.deckRear + 0.14, 0.94);
    cShape.lineTo(d.roofRear + 0.28, 0.94);
    cShape.lineTo(d.roofRear + 0.1, d.roofY - 0.08);
    const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: 0.035, bevelEnabled: false });
    cGeo.translate(0, 0, z > 0 ? z - 0.035 : z);
    paint.add(cGeo, color);
    // 窗沿镀铬细条：压在腰线上，侧窗下缘更利落
    paint.box(d.cabinFront - d.roofRear + 0.18, 0.024, 0.018, 0xcfc8b8, {
      x: (d.cabinFront + d.roofRear) / 2 + 0.06, y: 0.925, z,
    });
    // 侧窗上沿深色压条：让透明玻璃有一圈清楚的轮廓
    paint.box(d.roofFront - d.roofRear + 0.08, 0.022, 0.016, 0x303336, {
      x: (d.roofFront + d.roofRear) / 2, y: d.roofY - 0.085, z,
    });
  }
  // 车顶行李架 / 小尾翼
  if (d.roofRack) {
    for (const z of [-0.58, 0.58]) paint.box(roofLen * 0.82, 0.06, 0.06, 0x4a4d4f, { x: roofX, y: d.roofY + 0.1, z });
    for (const x of [roofX - roofLen * 0.32, roofX + roofLen * 0.32]) {
      for (const z of [-0.58, 0.58]) paint.box(0.055, 0.1, 0.055, 0x4a4d4f, { x, y: d.roofY + 0.06, z });
    }
    // 行李架横杆
    for (const x of [roofX - 0.18, roofX + 0.18]) paint.box(0.05, 0.035, 1.16, 0x585b5c, { x, y: d.roofY + 0.12, z: 0 });
  }
  if (d.spoiler) {
    paint.add(new RoundedBoxGeometry(0.5, 0.055, d.width - 0.16, 3, 0.025), 0x35393c, {
      x: -d.half + 0.22, y: d.bodyTop + 0.2, z: 0,
    });
    paint.box(0.42, 0.028, 0.22, 0x2c3032, { x: -d.half + 0.22, y: d.bodyTop + 0.17, z: 0 });
    for (const z of [-0.68, 0.68]) paint.box(0.09, 0.19, 0.07, 0x35393c, { x: -d.half + 0.24, y: d.bodyTop + 0.09, z });
  }
}

function addDetails(paint: TownBuilder, solid: TownBuilder, color: number, d: CarDims) {
  // 前脸：格栅、镀铬横条、日行灯、主灯
  paint.add(new RoundedBoxGeometry(0.07, 0.18, 0.62, 3, 0.035), 0x2c3033, { x: d.half + 0.005, y: 0.61, z: 0 });
  for (let i = 0; i < 3; i++) {
    paint.box(0.095, 0.026, 0.52, 0xb8b5a8, { x: d.half + 0.012, y: 0.55 + i * 0.06, z: 0 });
  }
  for (const z of [-(d.width / 2 - 0.42), d.width / 2 - 0.42]) {
    paint.add(new RoundedBoxGeometry(0.1, 0.2, 0.4, 3, 0.045), 0xffefc1, { x: d.half + 0.005, y: 0.76, z });
    paint.box(0.07, 0.045, 0.31, 0xfff7d9, { x: d.half + 0.055, y: 0.67, z });
    paint.add(new RoundedBoxGeometry(0.1, 0.16, 0.38, 3, 0.04), 0xc9463c, { x: -d.half - 0.005, y: 0.77, z });
  }
  // 后牌照位与尾灯贯穿条
  paint.box(0.06, 0.05, d.width - 0.58, 0xc9463c, { x: -d.half - 0.025, y: 0.82, z: 0 });

  // 车门缝、把手、侧后视镜
  for (const z of [-(d.width / 2 + 0.004), d.width / 2 + 0.004]) {
    paint.box(0.018, 0.53, 0.016, 0x7d3f34, { x: d.cabinFront - 0.28, y: 0.66, z });
    paint.box(0.2, 0.045, 0.05, 0xc9c5b8, { x: d.cabinFront - 0.52, y: 0.83, z });
    paint.add(new RoundedBoxGeometry(0.18, 0.1, 0.14, 3, 0.04), color, {
      x: d.cabinFront - 0.12, y: d.bodyTop + 0.08, z: z * 1.14,
    });
    paint.box(0.09, 0.055, 0.1, 0x92b7c2, { x: d.cabinFront - 0.12, y: d.bodyTop + 0.08, z: z * 1.24 });
  }

  // 内饰与驾驶员：透过透明玻璃能看到方向盘、座椅和人
  solid.add(new RoundedBoxGeometry(0.4, 0.16, d.width - 0.3, 3, 0.05), 0x34363a, {
    x: d.cabinFront - 0.28, y: 0.9, z: 0,
  });
  for (const z of [-0.34, 0.34]) {
    solid.add(new RoundedBoxGeometry(0.42, 0.16, 0.38, 3, 0.07), 0x725146, { x: -0.22, y: 0.74, z });
    solid.add(new RoundedBoxGeometry(0.15, 0.5, 0.38, 3, 0.06), 0x6a4a40, { x: -0.42, y: 0.95, z });
    solid.add(new RoundedBoxGeometry(0.22, 0.1, 0.22, 3, 0.05), 0x725146, { x: -0.42, y: 1.22, z });
  }
  solid.add(new THREE.TorusGeometry(0.17, 0.034, 8, 22), 0x272a2c, {
    x: 0.3, y: 1.02, z: -0.34, ry: Math.PI / 2,
  });
  solid.box(0.7, 0.08, 0.09, 0x3f4144, { x: 0.42, y: 0.93, z: -0.34 });

  // 驾驶员：头发、头、躯干、手臂搭在方向盘上、双腿
  // 低顶跑车整体下沉，别让脑袋从车顶穿出去
  const seatX = -0.14, seatZ = -0.34;
  const dy = Math.max(-0.18, Math.min(0.04, d.roofY - 1.45));
  solid.sphere(0.125, SKIN, { x: seatX, y: 1.31 + dy, z: seatZ });
  solid.sphere(0.128, HAIR, { x: seatX - 0.06, y: 1.35 + dy, z: seatZ - 0.008 });
  solid.box(0.2, 0.07, 0.2, HAIR, { x: seatX, y: 1.4 + dy, z: seatZ });
  // 露出脸：眼睛、鼻尖，让玻璃里坐着的是玩家而不是一团头发
  for (const zOff of [-0.048, 0.048]) {
    solid.sphere(0.018, 0x2f2a27, { x: seatX + 0.104, y: 1.325 + dy, z: seatZ + zOff });
  }
  solid.sphere(0.014, 0xe7a992, { x: seatX + 0.125, y: 1.29 + dy, z: seatZ });
  solid.box(0.075, 0.07, 0.03, 0x2f2a27, { x: seatX + 0.05, y: 1.31 + dy, z: seatZ + 0.112 });
  solid.add(new RoundedBoxGeometry(0.27, 0.36, 0.24, 3, 0.06), COAT, {
    x: seatX, y: 1.07 + dy, z: seatZ,
  });
  // 左右手臂向前伸到方向盘
  for (const side of [-1, 1]) {
    solid.box(0.34, 0.085, 0.09, COAT, {
      x: seatX + 0.2, y: 1.07 + dy, z: seatZ + side * 0.1, rz: -0.12, ry: side * 0.16,
    });
    solid.sphere(0.048, SKIN, { x: seatX + 0.36, y: 1.03 + dy, z: seatZ + side * 0.11 });
  }
  // 坐姿腿：大腿水平、小腿向下
  for (const side of [-1, 1]) {
    solid.box(0.3, 0.12, 0.14, PANTS, { x: seatX + 0.1, y: 0.67 + dy, z: seatZ + side * 0.1 });
    solid.box(0.12, 0.34, 0.14, PANTS, { x: seatX + 0.23, y: 0.51 + dy, z: seatZ + side * 0.1 });
    solid.box(0.18, 0.09, 0.17, SHOE, { x: seatX + 0.3, y: 0.36 + dy, z: seatZ + side * 0.1 });
  }

  // 底盘与排气
  solid.box(d.half * 1.7, 0.12, d.width - 0.28, 0x2d3032, { y: 0.27 });
  for (const z of [-0.36, 0.36]) solid.cylinder(0.07, 0.08, 0.2, 0x9a9b96, { x: -d.half - 0.08, y: 0.39, z, rz: Math.PI / 2 }, 10);
}

function addGlass(glass: THREE.BufferGeometry[], d: CarDims) {
  const side = new THREE.Shape();
  side.moveTo(d.cabinFront - 0.04, 0.93);
  side.lineTo(d.roofFront + 0.03, d.roofY - 0.09);
  side.lineTo(d.roofRear - 0.02, d.roofY - 0.08);
  side.lineTo(d.roofRear + 0.17, 0.93);
  side.lineTo(d.cabinFront - 0.04, 0.93);
  for (const z of [-(d.width / 2 - 0.035), d.width / 2 - 0.035]) {
    const geo = new THREE.ExtrudeGeometry(side, { depth: 0.035, bevelEnabled: false });
    geo.translate(0, 0, z > 0 ? z - 0.035 : z);
    glass.push(geo);
  }

  // 前风挡：上沿往后收，匹配座舱斜面
  const frontMidX = (d.cabinFront + d.roofFront) / 2 - 0.02;
  const frontMidY = (0.94 + d.roofY) / 2;
  const frontLen = Math.hypot(d.cabinFront - d.roofFront, d.roofY - 0.94) * 1.02;
  const frontAngle = Math.atan2(d.cabinFront - d.roofFront, d.roofY - 0.94);
  const front = new THREE.BoxGeometry(0.045, frontLen, d.width - 0.3);
  front.applyMatrix4(new THREE.Matrix4().makeRotationZ(frontAngle).setPosition(frontMidX, frontMidY, 0));
  glass.push(front);

  // 后风挡：上沿朝前收
  const rearMidX = (d.roofRear + d.deckRear) / 2 + 0.01;
  const rearMidY = (0.94 + d.roofY) / 2;
  const rearLen = Math.hypot(d.roofRear - d.deckRear, d.roofY - 0.94) * 0.88;
  const rearAngle = -Math.atan2(d.roofRear - d.deckRear, d.roofY - 0.94);
  const rear = new THREE.BoxGeometry(0.045, rearLen, d.width - 0.34);
  rear.applyMatrix4(new THREE.Matrix4().makeRotationZ(rearAngle).setPosition(rearMidX, rearMidY, 0));
  glass.push(rear);
}

function addWheelGeometry(builder: TownBuilder, x: number, z: number, centerY = 0.37) {
  const y = centerY;
  // 轮胎：胎体 + 两侧胎壁，压住金属轮圈
  builder.cylinder(0.37, 0.37, 0.26, 0x1f2022, { x, y, z, rx: Math.PI / 2 }, 24);
  for (const side of [-1, 1]) {
    builder.add(new THREE.TorusGeometry(0.335, 0.045, 7, 24), 0x292a2c, {
      x, y, z: z + side * 0.11,
    });
    // 轮圈外沿的银色圆环
    builder.add(new THREE.TorusGeometry(0.247, 0.016, 6, 24), 0xd2d0c6, {
      x, y, z: z + side * 0.125,
    });
  }
  // 刹车盘：从辐条缝隙里透出一点深灰
  builder.cylinder(0.205, 0.205, 0.05, 0x5a5d5d, { x, y, z, rx: Math.PI / 2 }, 18);
  // 五根细辐条，一根只朝一个方向，别再长成风车
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    builder.box(0.052, 0.215, 0.274, 0xd8d6cc, {
      x: x + Math.sin(a) * 0.112,
      y: y + Math.cos(a) * 0.112,
      z,
      rz: a,
    });
  }
  // 中心盖与轮毂螺栓
  builder.cylinder(0.092, 0.1, 0.282, 0xa9aaa4, { x, y, z, rx: Math.PI / 2 }, 14);
  builder.cylinder(0.045, 0.045, 0.292, 0x70736f, { x, y, z, rx: Math.PI / 2 }, 10);
  // 卡钳
  builder.box(0.18, 0.055, 0.292, 0x8a5040, { x: x + 0.15, y, z });
}

function finishGlass(geos: THREE.BufferGeometry[], material: THREE.Material) {
  const merged = mergeGeometries(geos.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute("uv");
    return g;
  }))!;
  geos.forEach(geo => geo.dispose());
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = false;
  return mesh;
}

/** NPC 循环车：流线车身 + 独立窗面 + 四轮，按部件合批成少量网格。 */
export function buildCar(color: number, style: CarStyle = "city") {
  const d = DIMS[style];
  const paint = new TownBuilder();
  const solid = new TownBuilder();
  const glass: THREE.BufferGeometry[] = [];
  addBody(paint, color, d);
  addCabin(paint, color, d);
  addDetails(paint, solid, color, d);
  addGlass(glass, d);
  for (const wx of [-d.wheelX, d.wheelX]) for (const wz of [-d.wheelZ, d.wheelZ]) addWheelGeometry(solid, wx, wz);

  const group = new THREE.Group();
  group.add(paint.build(true, true));
  group.add(solid.build(true, true));
  group.add(finishGlass(glass, clay(0x6f99a8, { roughness: 0.2, metalness: 0.18, side: THREE.DoubleSide })));
  group.name = "town-car";
  return group;
}

/** 玩家车：亮面车漆、真透明玻璃、可见驾驶员、可独立转动的四个车轮。 */
export function buildDetailedCar(color: number, style: CarStyle, plate: string) {
  const d = DIMS[style];
  const paint = new TownBuilder();
  const solid = new TownBuilder();
  const glass: THREE.BufferGeometry[] = [];
  addBody(paint, color, d);
  addCabin(paint, color, d);
  addDetails(paint, solid, color, d);
  addGlass(glass, d);

  const paintMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.22, envMapIntensity: 0.9,
  });
  const bodyGroup = paint.build(true, true);
  bodyGroup.traverse((node) => {
    if (node instanceof THREE.Mesh) node.material = paintMaterial;
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xbfe8ee, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.08,
    side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2,
  });

  const root = new THREE.Group();
  root.add(bodyGroup);
  root.add(solid.build(true, true));
  root.add(finishGlass(glass, glassMaterial));

  // 前后牌照
  const plateTex = signTexture(plate, "#e8f0e2", "#33443a", "#6f8a75");
  for (const [x, ry] of [[d.half + 0.055, Math.PI / 2], [-d.half - 0.065, -Math.PI / 2]] as const) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.15), signMaterial(plateTex));
    sign.position.set(x, 0.52, 0);
    sign.rotation.y = ry;
    root.add(sign);
  }

  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  for (const wx of [-d.wheelX, d.wheelX]) {
    for (const wz of [-d.wheelZ, d.wheelZ]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, 0.37, wz);
      const wb = new TownBuilder();
      addWheelGeometry(wb, 0, 0, 0);
      const wheel = wb.build(true, false);
      pivot.add(wheel);
      root.add(pivot);
      wheels.push(pivot);
      if (wx > 0) frontWheels.push(pivot);
    }
  }

  root.name = "player-car";
  return { root, wheels, frontWheels };
}
