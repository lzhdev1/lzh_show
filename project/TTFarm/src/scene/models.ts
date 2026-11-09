import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE, clay } from "./materials";

/** 固定种子随机：每次刷新场景细节一样，不会东一块西一块地跳 */
let seed = 9781;
function rnd(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
function between(min: number, max: number): number {
  return min + rnd() * (max - min);
}

/** 揉皱的球：顶点随机偏移，得到不规则但连续的有机外形，用在树冠、石头和土块上 */
export function lumpy(radius: number, detail: number, amount: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + Math.sin(v.x * 5.1 + v.z * 3.7) * amount + Math.sin(v.y * 4.3 - v.x * 2.1) * amount * 0.6;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function rounded(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, 2, r);
}

function addShadow(mesh: THREE.Mesh, receive = true): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
}

/* ---------------- 栅栏 ---------------- */

export function buildFenceSegment(length: number, height = 0.95): THREE.Group {
  const group = new THREE.Group();

  // 立柱：圆锥收一下上端，再加个圆头，不再是一根方柱
  const post = new THREE.Group();
  const postBody = addShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, height, 12), clay(PALETTE.wood))
  );
  postBody.position.y = height / 2;
  post.add(postBody);
  const cap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 8), clay(PALETTE.plank)));
  cap.position.y = height;
  cap.scale.y = 0.7;
  post.add(cap);
  post.position.x = -length / 2;
  post.rotation.z = between(-0.02, 0.02);
  group.add(post);

  const post2 = post.clone();
  post2.position.x = length / 2;
  post2.rotation.z = between(-0.02, 0.02);
  group.add(post2);

  // 两道横杆：略带上扬的圆角板
  [0.42, 0.72].forEach((h, i) => {
    const rail = addShadow(
      new THREE.Mesh(rounded(length, 0.1, 0.07, 0.035), clay(i === 0 ? PALETTE.plank : PALETTE.wood))
    );
    rail.position.y = h;
    rail.rotation.z = between(-0.012, 0.012);
    group.add(rail);
  });

  return group;
}

/* ---------------- 谷仓 ---------------- */

function gableTriangle(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export function buildBarn(): THREE.Group {
  const group = new THREE.Group();
  const W = 3.2;
  const H = 2.0;
  const D = 2.8;

  // 石基
  const base = addShadow(new THREE.Mesh(rounded(W + 0.3, 0.22, D + 0.3, 0.06), clay(PALETTE.stone)));
  base.position.y = 0.1;
  group.add(base);

  // 墙体
  const wall = addShadow(new THREE.Mesh(rounded(W, H, D, 0.08), clay(PALETTE.barnRed, { roughness: 0.9 })));
  wall.position.y = 0.22 + H / 2;
  group.add(wall);

  // 正面的竖木板：深浅两色交替，读起来是"一块块钉起来的墙"
  for (let i = 0; i < 9; i += 1) {
    const slat = new THREE.Mesh(
      rounded(0.3, H - 0.08, 0.05, 0.02),
      clay(i % 2 === 0 ? 0xcf5d47 : 0xc85743, { roughness: 0.92 })
    );
    slat.position.set(-W / 2 + 0.24 + i * 0.345, 0.22 + H / 2, D / 2 + 0.02);
    group.add(slat);
  }

  // 山墙三角
  [-1, 1].forEach((dir) => {
    const gable = addShadow(
      new THREE.Mesh(gableTriangle(W, 0.78, 0.1), clay(0xc85743, { roughness: 0.92 }))
    );
    gable.position.set(0, 0.22 + H, dir * (D / 2 - 0.02));
    group.add(gable);
  });

  // 屋面：两块斜板各自成组，瓦片贴着坡面排，不再悬空乱飞
  const roofLen = D + 0.6;
  const ridgeY = 0.22 + H + 0.82;
  const slopeAngle = Math.atan2(0.82, W / 2 + 0.28);
  const slopeLen = Math.hypot(W / 2 + 0.28, 0.82);
  [-1, 1].forEach((dir) => {
    const side = new THREE.Group();
    side.position.set(0, ridgeY, 0);
    side.rotation.z = -dir * slopeAngle;
    group.add(side);

    const slab = addShadow(
      new THREE.Mesh(rounded(slopeLen, 0.14, roofLen, 0.05), clay(0xb94a38, { roughness: 0.9 }))
    );
    slab.position.set((dir * slopeLen) / 2, 0, 0);
    side.add(slab);

    // 瓦片：四排，贴着坡面板面往上叠，边缘略翘
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const tile = new THREE.Mesh(
          rounded(slopeLen / 4 - 0.03, 0.055, roofLen / 5 - 0.03, 0.024),
          clay((row + col) % 2 === 0 ? 0xd05a44 : 0xc8553f, { roughness: 0.9 })
        );
        tile.position.set(
          dir * (slopeLen * (0.13 + row * 0.25)),
          0.085,
          -roofLen / 2 + roofLen / 10 + col * (roofLen / 5)
        );
        tile.rotation.x = row % 2 === 0 ? 0.03 : -0.02;
        side.add(tile);
      }
    }
  });

  const ridge = addShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, roofLen, 10), clay(PALETTE.cream))
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = ridgeY + 0.06;
  group.add(ridge);

  // 正面大门：白门 + 红色 X 撑条 + 门框
  const door = new THREE.Mesh(rounded(1.0, 1.55, 0.1, 0.04), clay(PALETTE.cream, { roughness: 0.85 }));
  door.position.set(0, 0.22 + 0.78, D / 2 + 0.05);
  addShadow(door);
  group.add(door);

  [1, -1].forEach((k) => {
    const brace = new THREE.Mesh(rounded(0.09, 1.5, 0.06, 0.02), clay(PALETTE.barnRed));
    brace.position.set(0, 0.22 + 0.78, D / 2 + 0.11);
    brace.rotation.z = k * 0.55;
    group.add(brace);
  });

  const frameTop = addShadow(new THREE.Mesh(rounded(1.2, 0.12, 0.12, 0.04), clay(PALETTE.cream)));
  frameTop.position.set(0, 0.22 + 1.6, D / 2 + 0.06);
  group.add(frameTop);

  // 阁楼小门
  const loft = new THREE.Mesh(rounded(0.5, 0.4, 0.06, 0.02), clay(PALETTE.cream));
  loft.position.set(0, 0.22 + H + 0.22, D / 2 + 0.03);
  group.add(loft);

  // 两扇窗：白框 + 十字格
  [-0.95, 0.95].forEach((x) => {
    const win = new THREE.Mesh(rounded(0.5, 0.5, 0.07, 0.03), clay(0xfff8e6, { roughness: 0.8 }));
    win.position.set(x, 0.22 + 1.15, D / 2 + 0.03);
    group.add(win);
    const barV = new THREE.Mesh(rounded(0.06, 0.5, 0.04, 0.015), clay(PALETTE.barnRed));
    barV.position.set(x, 0.22 + 1.15, D / 2 + 0.07);
    group.add(barV);
    const barH = new THREE.Mesh(rounded(0.5, 0.06, 0.04, 0.015), clay(PALETTE.barnRed));
    barH.position.set(x, 0.22 + 1.15, D / 2 + 0.07);
    group.add(barH);
  });

  // 门边的草垛与木桶
  const hay = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 14), clay(0xf0c45f, { roughness: 0.95 })));
  hay.rotation.z = Math.PI / 2;
  hay.position.set(-2.05, 0.36, 0.6);
  group.add(hay);

  const barrel = new THREE.Group();
  const barrelBody = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.55, 12), clay(PALETTE.wood)));
  barrelBody.position.y = 0.28;
  barrel.add(barrelBody);
  [0.12, 0.44].forEach((y) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 14), clay(PALETTE.woodDark));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    barrel.add(hoop);
  });
  barrel.position.set(1.95, 0, 0.8);
  group.add(barrel);

  group.position.set(-4.9, 0, -4.9);
  group.rotation.y = 0.22;
  return group;
}

/* ---------------- 水井 ---------------- */

export function buildWell(): THREE.Group {
  const group = new THREE.Group();
  const radius = 0.72;

  // 井壁：一圈圈石头错缝砌起来，不再是光溜溜一个圆柱
  for (let row = 0; row < 3; row += 1) {
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + (row % 2 === 0 ? 0 : Math.PI / count);
      const stone = new THREE.Mesh(
        rounded(0.27, 0.26, 0.2, 0.05),
        clay(row === 1 ? 0xcec8b8 : PALETTE.stone, { roughness: 0.95 })
      );
      stone.position.set(Math.cos(a) * radius, 0.16 + row * 0.27, Math.sin(a) * radius);
      stone.rotation.y = -a + Math.PI / 2;
      stone.rotation.x = between(-0.04, 0.04);
      addShadow(stone);
      group.add(stone);
    }
  }

  const water = new THREE.Mesh(new THREE.CircleGeometry(0.62, 26), clay(PALETTE.water, { roughness: 0.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.78;
  group.add(water);

  // 木架 + 横梁 + 摇柄 + 吊桶
  [-0.5, 0.5].forEach((x) => {
    const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.3, 10), clay(PALETTE.wood)));
    post.position.set(x, 1.45, 0);
    group.add(post);
  });

  const beam = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.16, 10), clay(PALETTE.plank)));
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 2.06;
  group.add(beam);

  const crank = new THREE.Group();
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8), clay(PALETTE.woodDark));
  axle.rotation.z = Math.PI / 2;
  crank.add(axle);
  const handleArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), clay(PALETTE.woodDark));
  handleArm.position.set(0.16, -0.17, 0);
  crank.add(handleArm);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), clay(PALETTE.plank));
  handle.position.set(0.16, -0.34, 0);
  crank.add(handle);
  crank.position.set(0.52, 2.02, 0);
  group.add(crank);

  const bucket = new THREE.Group();
  const bucketBody = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 12), clay(PALETTE.plank)));
  bucketBody.position.y = -0.13;
  bucket.add(bucketBody);
  const bucketHoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 12), clay(PALETTE.woodDark));
  bucketHoop.rotation.x = Math.PI / 2;
  bucketHoop.position.y = -0.02;
  bucket.add(bucketHoop);
  bucket.position.set(0, 1.75, 0);
  group.add(bucket);

  // 井顶：两片坡瓦 + 屋脊，和谷仓同一套屋顶语言
  [-1, 1].forEach((dir) => {
    const slab = addShadow(new THREE.Mesh(rounded(0.95, 0.1, 1.3, 0.04), clay(PALETTE.roofRed, { roughness: 0.9 })));
    slab.position.set(dir * 0.42, 2.32, 0);
    slab.rotation.z = -dir * 0.5;
    group.add(slab);
  });
  const ridge = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8), clay(PALETTE.cream)));
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = 2.56;
  group.add(ridge);

  group.position.set(4.85, 0, -4.6);
  return group;
}

/* ---------------- 树 ---------------- */

export function buildTree(scale: number, variant: number): THREE.Group {
  const group = new THREE.Group();

  // 树干：底部粗、往上收，带一点弧度
  const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.19, 1.25, 12), clay(0x9c6a3e, { roughness: 0.9 })));
  trunk.position.y = 0.62;
  group.add(trunk);

  // 两根分枝：让树干不是一根直筒
  [[0.32, 1.05, 0.55], [-0.3, 1.15, -0.4]].forEach(([x, y], i) => {
    const branch = addShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.6, 8), clay(0x9c6a3e, { roughness: 0.9 }))
    );
    branch.position.set(x, y, 0);
    branch.rotation.z = i === 0 ? -0.55 : 0.6;
    group.add(branch);
  });

  // 树冠：一簇揉皱的球，三层深浅绿，边缘不规则
  const greens = [PALETTE.leaf, PALETTE.leafLight, PALETTE.leafDark, 0xa9dd74];
  const blobs: Array<[number, number, number, number]> = [
    [0, 1.72, 0, 0.88],
    [-0.52, 1.5, 0.2, 0.62],
    [0.55, 1.56, -0.18, 0.56],
    [0.1, 2.12, 0.1, 0.52],
    [-0.3, 2.0, -0.5, 0.44],
    [0.36, 1.95, 0.52, 0.42],
  ];
  blobs.forEach(([bx, by, bz, r], i) => {
    const crown = addShadow(
      new THREE.Mesh(lumpy(r, 2, 0.09), clay(greens[(i + variant) % greens.length], { roughness: 0.92 }))
    );
    crown.position.set(bx, by, bz);
    crown.scale.set(1, 0.94, 1);
    crown.rotation.set(i * 0.5, i * 0.9, i * 0.3);
    group.add(crown);
  });

  group.scale.setScalar(scale);
  return group;
}

/* ---------------- 石头 / 草丛 / 花 / 灌木 ---------------- */

export function buildRock(scale: number): THREE.Mesh {
  const rock = addShadow(new THREE.Mesh(lumpy(0.36, 2, 0.16), clay(0xcfcaba, { roughness: 0.95 })));
  rock.scale.set(scale, scale * 0.72, scale * 1.05);
  rock.position.y = 0.17;
  rock.rotation.y = between(0, Math.PI);
  return rock;
}

function grassBladeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 9; i += 1) {
    const x = 12 + i * 13 + between(-4, 4);
    const h = between(70, 118);
    const leftCtl = x + between(-16, -8);
    const width = between(3.5, 6);
    const g = ctx.createLinearGradient(0, 128, 0, 128 - h);
    g.addColorStop(0, "#3f8a33");
    g.addColorStop(1, "#9ad964");
    ctx.strokeStyle = g;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.quadraticCurveTo(leftCtl, 128 - h * 0.55, x + between(-6, 6), 128 - h);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let grassTex: THREE.CanvasTexture | null = null;

export function buildGrassTuft(): THREE.Group {
  const group = new THREE.Group();
  grassTex ??= grassBladeTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: grassTex,
    transparent: true,
    alphaTest: 0.42,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i += 1) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.44), mat);
    card.position.y = 0.22;
    card.rotation.y = (i / 3) * Math.PI + between(-0.1, 0.1);
    group.add(card);
  }
  return group;
}

export function buildFlower(color: number): THREE.Group {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 6), clay(PALETTE.leafDark));
  stem.position.y = 0.13;
  group.add(stem);

  const leaf = new THREE.Mesh(lumpy(0.07, 1, 0.2), clay(PALETTE.leaf));
  leaf.scale.set(1.6, 0.5, 1);
  leaf.position.set(0.07, 0.12, 0);
  leaf.rotation.z = 0.4;
  group.add(leaf);

  // 五片花瓣，比一个大球更像花
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), clay(color, { roughness: 0.8 }));
    petal.position.set(Math.cos(a) * 0.055, 0.3, Math.sin(a) * 0.055);
    petal.scale.set(1, 0.6, 1);
    group.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), clay(PALETTE.flowerYellow));
  center.position.y = 0.305;
  group.add(center);

  group.rotation.y = between(0, Math.PI);
  return group;
}

export function buildBush(scale: number, variant: number): THREE.Group {
  const group = new THREE.Group();
  const greens = [PALETTE.leafDark, PALETTE.leaf, PALETTE.leafLight];
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.3, 0, 0.34],
    [-0.24, 0.24, 0.1, 0.24],
    [0.26, 0.26, -0.06, 0.22],
    [0.05, 0.44, 0.02, 0.2],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const blob = addShadow(new THREE.Mesh(lumpy(r, 2, 0.12), clay(greens[(i + variant) % greens.length])));
    blob.position.set(x, y, z);
    group.add(blob);
  });
  group.scale.setScalar(scale);
  return group;
}

/* ---------------- 招牌 ---------------- */

export function buildSign(texture: THREE.Texture): THREE.Group {
  const group = new THREE.Group();

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.05),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
  );
  board.position.set(0, 1.42, 0.02);
  board.castShadow = true;
  group.add(board);

  // 背板 + 四周木框
  const back = addShadow(new THREE.Mesh(rounded(2.2, 1.15, 0.09, 0.03), clay(PALETTE.plank)));
  back.position.set(0, 1.42, -0.04);
  group.add(back);
  [
    [0, 1.42 + 0.58, 0, 2.3, 0.1, 0.1],
    [0, 1.42 - 0.58, 0, 2.3, 0.1, 0.1],
    [-1.1, 1.42, 0, 0.1, 1.24, 0.1],
    [1.1, 1.42, 0, 0.1, 1.24, 0.1],
  ].forEach(([x, y, z, w, h, d]) => {
    const bar = new THREE.Mesh(rounded(w, h, d, 0.03), clay(PALETTE.wood));
    bar.position.set(x, y, z);
    group.add(bar);
  });

  // 两根圆木柱 + 斜撑
  [-0.88, 0.88].forEach((x) => {
    const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 10), clay(PALETTE.wood)));
    post.position.set(x, 0.95, -0.02);
    group.add(post);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), clay(PALETTE.plank));
    foot.position.set(x, 0.07, -0.02);
    foot.scale.y = 0.6;
    group.add(foot);
  });

  return group;
}
