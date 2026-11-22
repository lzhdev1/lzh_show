import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { townGlass, townInk, townSolid, signMaterial, signTexture } from "./townMaterials";
import { PLAZA_Y, type ShopDef, type TowerDef } from "./townLayout";

const color = new THREE.Color();

interface Placement {
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  glass?: boolean;
}

/** 顶点色 + 合并：一栋楼最多两个网格（实心 / 玻璃），墨线单独一层 */
export class TownBuilder {
  readonly solid: THREE.BufferGeometry[] = [];
  readonly glass: THREE.BufferGeometry[] = [];

  add(geometry: THREE.BufferGeometry, hex: number, placement: Placement = {}) {
    // 圆角盒是非索引几何，盒/柱是索引几何：统一转非索引再 merge
    if (geometry.index) {
      const nonIndexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = nonIndexed;
    }
    const vertices = geometry.getAttribute("position").count;
    const colors = new Float32Array(vertices * 3);
    color.setHex(hex);
    for (let i = 0; i < vertices; i++) color.toArray(colors, i * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.deleteAttribute("uv");
    const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
      placement.rx ?? 0, placement.ry ?? 0, placement.rz ?? 0, "YXZ"));
    matrix.setPosition(placement.x ?? 0, placement.y ?? 0, placement.z ?? 0);
    geometry.applyMatrix4(matrix);
    (placement.glass ? this.glass : this.solid).push(geometry);
    return geometry;
  }

  box(w: number, h: number, d: number, hex: number, placement: Placement = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), hex, placement);
  }

  cylinder(rTop: number, rBottom: number, h: number, hex: number, placement: Placement = {}, segments = 10) {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, segments), hex, placement);
  }

  sphere(radius: number, hex: number, placement: Placement = {}, widthSegments = 10, heightSegments = 7) {
    return this.add(new THREE.SphereGeometry(radius, widthSegments, heightSegments), hex, placement);
  }

  build(castShadow = true, withEdges = true): THREE.Group {
    const group = new THREE.Group();
    if (this.solid.length) {
      const merged = mergeGeometries(this.solid)!;
      this.solid.forEach(geo => geo.dispose());
      const mesh = new THREE.Mesh(merged, townSolid);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (withEdges) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(merged, 32), townInk);
        edges.renderOrder = 1;
        group.add(edges);
      }
    }
    if (this.glass.length) {
      const merged = mergeGeometries(this.glass)!;
      this.glass.forEach(geo => geo.dispose());
      const mesh = new THREE.Mesh(merged, townGlass);
      mesh.castShadow = false;
      group.add(mesh);
    }
    return group;
  }
}

const yawOf = { "+z": 0, "-z": Math.PI, "+x": Math.PI / 2, "-x": -Math.PI / 2 } as const;

/** 高楼：基座 + 2~3 段退台 + 连续窗带 + 转角竖柱 + 屋顶设备 */
export function buildTower(def: TowerDef): THREE.Group {
  const b = new TownBuilder();
  const tiers = [
    { w: def.w, d: def.d, h: def.h * 0.48, y0: 0 },
    { w: def.w - 1.8, d: def.d - 1.8, h: def.h * 0.31, y0: def.h * 0.48 },
    { w: def.w - 3.6, d: def.d - 3.6, h: def.h * 0.21, y0: def.h * 0.79 },
  ];
  b.box(def.w + 1.1, 0.36, def.d + 1.1, 0xb9ac96, { y: 0.18 });

  for (const [index, tier] of tiers.entries()) {
    const y = tier.y0 + tier.h / 2;
    b.box(tier.w, tier.h, tier.d, def.color, { y });
    // 每层一条横向窗带，四面都包住，远看是整齐的楼层线
    const step = index === 0 ? 2.9 : 2.7;
    for (let fy = 2.1; fy < tier.h - 0.8; fy += step) {
      b.box(tier.w - 1.2, 0.52, 0.16, 0x8fb6c4, { y: tier.y0 + fy, z: tier.d / 2 + 0.05, glass: true });
      b.box(tier.w - 1.2, 0.52, 0.16, 0x8fb6c4, { y: tier.y0 + fy, z: -tier.d / 2 - 0.05, glass: true });
      b.box(0.16, 0.52, tier.d - 1.2, 0x8fb6c4, { x: tier.w / 2 + 0.05, y: tier.y0 + fy, glass: true });
      b.box(0.16, 0.52, tier.d - 1.2, 0x8fb6c4, { x: -tier.w / 2 - 0.05, y: tier.y0 + fy, glass: true });
    }
    // 转角竖柱：给方盒子一个立面节奏
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(0.5, tier.h, 0.5, def.accent, {
        x: sx * (tier.w / 2 - 0.25), z: sz * (tier.d / 2 - 0.25), y: tier.y0 + tier.h / 2,
      });
    }
    if (index === 0) {
      // 面向街道的双层高门厅
      b.box(tier.w * 0.48, 3.3, 0.16, 0x86aebc, { y: 1.9, z: tier.d / 2 + 0.06, glass: true });
      b.box(0.34, 3.5, 0.34, def.accent, { x: -tier.w * 0.24, y: 1.85, z: tier.d / 2 + 0.06 });
      b.box(0.34, 3.5, 0.34, def.accent, { x: tier.w * 0.24, y: 1.85, z: tier.d / 2 + 0.06 });
      b.box(tier.w * 0.5, 0.3, 1.2, 0xcbb89d, { y: 3.65, z: tier.d / 2 + 0.5 });
    }
    // 退台顶面加一圈薄檐
    b.box(tier.w + 0.7, 0.28, tier.d + 0.7, def.accent, { y: tier.y0 + tier.h });
  }

  const top = tiers[2];
  b.box(top.w + 0.4, 1.5, top.d + 0.4, def.color, { y: def.h + 0.75 });
  b.box(top.w + 1.2, 0.3, top.d + 1.2, def.accent, { y: def.h + 1.5 });
  b.cylinder(0.16, 0.2, 4.2, 0x6f6a62, { y: def.h + 3.4, x: top.w * 0.22, z: -top.d * 0.18 }, 8);
  b.cylinder(0.9, 1.1, 1.2, 0xcfc5b1, { y: def.h + 2.2, x: -top.w * 0.2, z: top.d * 0.15 }, 12);

  const group = b.build();
  group.name = def.id;
  group.position.set(def.x, PLAZA_Y, def.z);
  group.rotation.y = yawOf[def.face];
  return group;
}

/** 中层公寓：3~5 层，正面阳台一排，填补塔楼之间的街区纵深 */
export function buildMidrise(def: TowerDef): THREE.Group {
  const b = new TownBuilder();
  const { w, d, h } = def;
  const floors = Math.max(3, Math.round(h / 3.1));
  const floorH = h / floors;
  b.box(w + 0.6, 0.28, d + 0.6, 0xb5a58d, { y: 0.14 });
  b.box(w, h, d, def.color, { y: h / 2 });
  b.box(w + 0.3, 0.3, d + 0.3, def.accent, { y: h + 0.15 });

  for (let i = 0; i < floors; i++) {
    const fy = i * floorH;
    // 正面窗：一层门脸，二层以上双窗
    if (i === 0) {
      b.box(w * 0.62, 2.35, 0.14, 0x96bcc6, { y: 1.45, z: d / 2 + 0.05, glass: true });
      b.box(0.9, 2.25, 0.14, 0x4f4438, { x: w * 0.28, y: 1.22, z: d / 2 + 0.09 });
      b.box(w * 0.66, 0.26, 0.4, 0x54463a, { y: 2.8, z: d / 2 + 0.14 });
    } else {
      b.box(w * 0.25, 1.3, 0.13, 0x8fb4be, { x: -w * 0.24, y: fy + 1.75, z: d / 2 + 0.05, glass: true });
      b.box(w * 0.25, 1.3, 0.13, 0x8fb4be, { x: w * 0.24, y: fy + 1.75, z: d / 2 + 0.05, glass: true });
      // 阳台板 + 栏杆，阳台之间留出结构缝
      b.box(w * 0.78, 0.13, 1.0, def.accent, { y: fy + 0.85, z: d / 2 + 0.55 });
      b.box(w * 0.78, 0.42, 0.07, 0xe9ddc6, { y: fy + 1.12, z: d / 2 + 1.0 });
      for (const bx of [-w * 0.37, 0, w * 0.37]) {
        b.box(0.06, 0.46, 0.06, def.accent, { x: bx, y: fy + 1.12, z: d / 2 + 1.0 });
      }
    }
    // 楼层分隔线
    b.box(w + 0.06, 0.1, d + 0.06, def.accent, { y: fy + floorH });
  }
  // 侧墙各开两扇窄窗，避免大面积盲墙
  for (const side of [-1, 1]) {
    for (let i = 1; i < floors; i++) {
      b.box(0.12, 1.1, d * 0.2, 0x8fb4be, { x: side * (w / 2 + 0.04), y: i * floorH + 1.7, glass: true });
    }
  }
  b.box(w * 0.5, 1.0, d * 0.4, 0xcfc5b1, { y: h + 0.8, x: -w * 0.2 });
  b.cylinder(0.38, 0.42, 0.5, 0x6f6a62, { y: h + 0.55, x: w * 0.3, z: -d * 0.25 }, 10);

  const group = b.build();
  group.name = def.id;
  group.position.set(def.x, PLAZA_Y, def.z);
  group.rotation.y = yawOf[def.face];
  return group;
}

/** 平房门店：玻璃门脸 + 条纹雨棚 + 招牌 + 屋顶小件 */
export function buildShop(def: ShopDef): THREE.Group {
  const b = new TownBuilder();
  b.box(def.w + 0.7, 0.3, def.d + 0.7, 0xb5a58d, { y: 0.15 });
  b.box(def.w, def.h, def.d, def.color, { y: def.h / 2 });

  // 一层玻璃门脸
  b.box(def.w - 1.5, 2.5, 0.14, 0x9cc4cd, { y: 1.55, z: def.d / 2 + 0.04, glass: true });
  for (const mx of [-def.w / 4, 0, def.w / 4]) {
    b.box(0.14, 2.7, 0.18, def.accent, { x: mx, y: 1.45, z: def.d / 2 + 0.05 });
  }
  b.box(1.0, 2.25, 0.16, 0x55463a, { x: def.w / 2 - 0.95, y: 1.2, z: def.d / 2 + 0.08 });
  b.box(def.w - 1.2, 0.24, 0.5, 0x54463a, { y: 2.85, z: def.d / 2 + 0.18 });

  // 条纹雨棚：斜下 6°，两种颜色交替
  const slats = 10;
  const slatWidth = (def.w * 0.92) / slats;
  for (let i = 0; i < slats; i++) {
    b.box(slatWidth + 0.01, 0.1, 1.35, i % 2 ? 0xf3e6cd : def.accent, {
      x: -def.w * 0.46 + slatWidth * (i + 0.5), y: 3.22, z: def.d / 2 + 0.68, rx: -0.1,
    });
  }
  b.box(def.w * 0.94, 0.16, 0.16, def.accent, { y: 3.34, z: def.d / 2 + 0.06 });

  // 招牌底板 + 文字
  b.box(def.w * 0.8, 1.06, 0.14, 0x4c3b30, { y: def.h - 2.1, z: def.d / 2 + 0.07 });
  // 二层窗
  b.box(def.w * 0.24, 0.95, 0.14, 0x93b8c2, { x: -def.w * 0.32, y: def.h - 1.25, z: def.d / 2 + 0.05, glass: true });
  b.box(def.w * 0.24, 0.95, 0.14, 0x93b8c2, { x: def.w * 0.32, y: def.h - 1.25, z: def.d / 2 + 0.05, glass: true });

  // 屋顶压边 + 屋顶小件
  b.box(def.w + 0.6, 0.3, def.d + 0.6, def.accent, { y: def.h + 0.15 });
  if (def.kind === "bakery") {
    b.cylinder(0.28, 0.32, 1.6, 0xb56d48, { x: -def.w * 0.28, y: def.h + 1.0, z: -def.d * 0.2 });
    b.cylinder(0.42, 0.42, 0.16, 0x6e4d38, { x: -def.w * 0.28, y: def.h + 1.82, z: -def.d * 0.2 });
  } else if (def.kind === "tea") {
    b.box(def.w * 0.4, 0.8, 0.6, 0x6f8d70, { x: def.w * 0.22, y: def.h + 0.5, z: -def.d * 0.2 });
  } else if (def.kind === "book") {
    b.box(1.6, 0.22, 1.1, 0x546b78, { y: def.h + 0.38, z: -def.d * 0.2 });
  }

  const group = b.build();
  const signTex = signTexture(def.name, "#f6ecd6", "#3f3228", "#8d6647");
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(def.w * 0.72, 0.92), signMaterial(signTex));
  sign.position.set(0, def.h - 2.1, def.d / 2 + 0.16);
  group.add(sign);

  group.name = def.id;
  group.position.set(def.x, PLAZA_Y, def.z);
  group.rotation.y = yawOf[def.face];
  return group;
}

/** 路灯杆：批量进街道家具，灯罩由场景统一实例化自发光球 */
export function addLampPost(b: TownBuilder, x: number, z: number) {
  b.cylinder(0.24, 0.32, 0.18, 0x4f4a43, { x, y: 0.09, z });
  b.cylinder(0.075, 0.1, 4.7, 0x4f4a43, { x, y: 2.5, z }, 8);
  b.cylinder(0.3, 0.18, 0.14, 0x4f4a43, { x, y: 4.9, z }, 10);
  b.cylinder(0.34, 0.34, 0.06, 0x4f4a43, { x, y: 5.12, z }, 10);
}

/** 街区花园里的树：不配石座，树干直接落地，适合草坪 */
export function addGardenTree(b: TownBuilder, x: number, z: number, scale = 1) {
  b.cylinder(0.1 * scale, 0.15 * scale, 1.5 * scale, 0x6b4f34, { x, y: 0.75 * scale, z });
  b.sphere(0.72 * scale, 0x739655, { x, y: 2.0 * scale, z }, 9, 7);
  b.sphere(0.52 * scale, 0x86a866, { x: x + 0.4 * scale, y: 2.3 * scale, z: z - 0.2 * scale }, 8, 6);
  b.sphere(0.46 * scale, 0x628648, { x: x - 0.38 * scale, y: 2.2 * scale, z: z + 0.24 * scale }, 8, 6);
}

/** 行道树花坛：石座 + 树干 + 三层树冠，风格与农场树一致但更规整 */
export function addTreePlanter(b: TownBuilder, x: number, z: number, scale = 1) {
  b.cylinder(0.62 * scale, 0.7 * scale, 0.5, 0xa79a84, { x, y: 0.25 });
  b.cylinder(0.42 * scale, 0.46 * scale, 0.12, 0x5d4a34, { x, y: 0.56 });
  b.cylinder(0.09 * scale, 0.12 * scale, 1.4 * scale, 0x6b4f34, { x, y: 1.25 * scale });
  b.sphere(0.78 * scale, 0x6f9154, { x, y: 2.05 * scale, z }, 9, 7);
  b.sphere(0.58 * scale, 0x83a563, { x: x + 0.36 * scale, y: 2.42 * scale, z: z - 0.18 * scale }, 8, 6);
  b.sphere(0.5 * scale, 0x5f8249, { x: x - 0.4 * scale, y: 2.3 * scale, z: z + 0.22 * scale }, 8, 6);
}

export function addBench(b: TownBuilder, x: number, z: number, ry = 0) {
  b.box(1.9, 0.12, 0.52, 0x9b6f48, { x, y: 0.62, z, ry });
  b.box(1.9, 0.5, 0.1, 0x9b6f48, { x: x + Math.sin(ry) * 0.2, y: 0.9, z: z + Math.cos(ry) * 0.2, ry });
  for (const s of [-1, 1]) {
    b.box(0.12, 0.55, 0.42, 0x4b4a45, { x: x + Math.cos(ry) * s * 0.75, y: 0.3, z: z - Math.sin(ry) * s * 0.75, ry });
  }
}
