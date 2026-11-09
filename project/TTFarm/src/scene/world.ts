import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE, clay } from "./materials";
import {
  buildBarn,
  buildBush,
  buildFenceSegment,
  buildFlower,
  buildGrassTuft,
  buildRock,
  buildSign,
  buildTree,
  buildWell,
  lumpy,
} from "./models";

const FENCE_X = 6.2;
const FENCE_Z = 7.8;
/** 正面围栏留的门口半宽（门口在 x 轴中心，人能从这里走出去） */
export const GATE_HALF = 1.55;

function createSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff6e2";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "#7cc14e";
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 480, 224);
  ctx.fillStyle = "#3f7a34";
  ctx.font = 'bold 96px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TT农场", 256, 116);
  ctx.fillStyle = "#9aa86f";
  ctx.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("T T F A R M", 256, 198);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 沿矩形四边铺围栏段，转角处补一根立柱，围栏不再是一条直线拼板 */
function buildFenceRing(): THREE.Group {
  const ring = new THREE.Group();
  const segment = 1.55;

  const sides: Array<{ from: THREE.Vector3; to: THREE.Vector3; open?: boolean }> = [
    { from: new THREE.Vector3(-FENCE_X, 0, -FENCE_Z), to: new THREE.Vector3(FENCE_X, 0, -FENCE_Z) },
    { from: new THREE.Vector3(FENCE_X, 0, -FENCE_Z), to: new THREE.Vector3(FENCE_X, 0, FENCE_Z) },
    // 正面朝玩家的一边开个门，中间那段不铺围栏
    { from: new THREE.Vector3(FENCE_X, 0, FENCE_Z), to: new THREE.Vector3(-FENCE_X, 0, FENCE_Z), open: true },
    { from: new THREE.Vector3(-FENCE_X, 0, FENCE_Z), to: new THREE.Vector3(-FENCE_X, 0, -FENCE_Z) },
  ];

  sides.forEach(({ from, to, open }) => {
    const dir = to.clone().sub(from);
    const length = dir.length();
    const count = Math.max(1, Math.round(length / segment));
    dir.normalize();
    const rotY = Math.atan2(dir.x, dir.z) + Math.PI / 2;

    for (let i = 0; i < count; i += 1) {
      const pieceLen = length / count;
      const center = from.clone().addScaledVector(dir, (i + 0.5) * pieceLen);
      // 门口留空：中间那几段围栏直接跳过
      if (open && Math.abs(center.x) < GATE_HALF) continue;
      const fence = buildFenceSegment(pieceLen);
      fence.position.set(center.x, 0, center.z);
      fence.rotation.y = rotY;
      ring.add(fence);
    }
    // 转角立柱
    const corner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.08, 12),
      clay(PALETTE.wood)
    );
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), clay(PALETTE.plank));
    cap.position.y = 1.08;
    cap.scale.y = 0.7;
    corner.position.set(from.x, 0.54, from.z);
    corner.castShadow = true;
    cap.position.x = from.x;
    cap.position.z = from.z;
    cap.castShadow = true;
    ring.add(corner);
    ring.add(cap);
  });

  // —— 农场大门：两根门柱 + 圆木门楣 + 两扇向外敞开的木门 ——
  const gate = new THREE.Group();
  gate.position.set(0, 0, FENCE_Z);
  const postH = 1.52;

  [-1, 1].forEach((sign) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.13, postH, 14),
      clay(PALETTE.woodDark)
    );
    post.position.set(sign * GATE_HALF, postH / 2, 0);
    post.castShadow = true;
    gate.add(post);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), clay(PALETTE.plank));
    cap.position.set(sign * GATE_HALF, postH + 0.04, 0);
    cap.scale.y = 0.72;
    cap.castShadow = true;
    gate.add(cap);

    // 门柱上的斜撑：两根短斜木，给敞开的门口一点结构感
    const bracket = new THREE.Mesh(
      new RoundedBoxGeometry(0.62, 0.09, 0.09, 2, 0.03),
      clay(PALETTE.woodDark)
    );
    bracket.position.set(sign * (GATE_HALF - 0.02), postH - 0.3, 0);
    bracket.rotation.z = sign * 0.55;
    bracket.castShadow = true;
    gate.add(bracket);
  });

  // 门楣圆木
  const lintel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, GATE_HALF * 2 + 0.6, 12),
    clay(PALETTE.wood)
  );
  lintel.rotation.z = Math.PI / 2;
  lintel.position.set(0, postH, 0);
  lintel.castShadow = true;
  gate.add(lintel);

  // 门楣下挂一块小木牌
  const board = new THREE.Mesh(
    new RoundedBoxGeometry(0.62, 0.26, 0.05, 2, 0.02),
    clay(PALETTE.cream)
  );
  board.position.set(0, postH - 0.26, 0);
  board.castShadow = true;
  gate.add(board);



  ring.add(gate);

  return ring;
}

function createGlowSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,250,220,1)");
  grad.addColorStop(0.35, "rgba(255,244,196,0.55)");
  grad.addColorStop(1, "rgba(255,238,180,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 空气里的暖色光尘：细碎亮点，给晴天场景一点空气感 */
function createDustMotes(): { points: THREE.Points; update: (t: number) => void } {
  const count = 64;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = 0.6 + Math.random() * 4.0;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    seeds[i] = Math.random() * Math.PI * 2;
    heights[i] = 0.6 + Math.random() * 4.0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: createGlowSprite(),
    color: 0xfff6cc,
    size: 0.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;

  const update = (t: number) => {
    const attr = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      attr.setY(i, heights[i] + Math.sin(t * 0.35 + seeds[i]) * 0.3);
    }
    attr.needsUpdate = true;
    material.opacity = 0.3 + Math.sin(t * 0.8) * 0.06;
  };

  return { points, update };
}

/** 草地上的深浅色斑：让大平面不平，也不显脏 */
function buildGrassPatches(): THREE.Group {
  const group = new THREE.Group();
  const patches: Array<[number, number, number, number]> = [
    [-7.5, 3.2, 4.6, PALETTE.grassLight],
    [6.4, 4.6, 3.8, PALETTE.grassDark],
    [2.6, -6.2, 4.2, PALETTE.grassLight],
    [-4.2, -6.6, 3.4, PALETTE.grassDark],
    [8.2, -1.2, 3.0, PALETTE.grassLight],
    [-8.6, -3.4, 2.8, PALETTE.grassLight],
  ];
  patches.forEach(([x, z, r, color], i) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 26), clay(color, { roughness: 0.95 }));
    disc.rotation.x = -Math.PI / 2;
    disc.rotation.z = i * 0.7;
    disc.position.set(x, 0.004, z);
    disc.receiveShadow = true;
    disc.material.polygonOffset = true;
    disc.material.polygonOffsetFactor = -1;
    disc.material.polygonOffsetUnits = -1;
    group.add(disc);
  });
  return group;
}

export interface World {
  group: THREE.Group;
  ground: THREE.Mesh;
  update?: (t: number) => void;
}

export function createWorld(): World {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), clay(PALETTE.grass, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  group.add(buildGrassPatches());

  // 田埂：一整块圆角草台，地块是草台上一格格翻好的土
  const field = new THREE.Mesh(
    new RoundedBoxGeometry(9.5, 0.2, 12.9, 3, 0.06),
    clay(PALETTE.grassLight, { roughness: 0.95 })
  );
  field.position.set(0, 0.1, 0);
  field.receiveShadow = true;
  group.add(field);

  group.add(buildFenceRing());
  group.add(buildBarn());
  group.add(buildWell());

  // 门外用一串踩实的土块石阶代替整块路板：不铺平板，看起来更像走出来的乡间小路
  const pathStones: Array<[number, number, number]> = [
    [0.1, FENCE_Z + 0.7, 0.46],
    [-0.42, FENCE_Z + 2.0, 0.42],
    [0.36, FENCE_Z + 3.2, 0.44],
    [-0.3, FENCE_Z + 4.4, 0.38],
    [0.24, FENCE_Z + 5.6, 0.4],
  ];
  pathStones.forEach(([x, z, s], index) => {
    const stone = new THREE.Mesh(lumpy(s, 2, 0.14), clay(0xab845e, { roughness: 1 }));
    stone.position.set(x, 0.03, z);
    stone.scale.y = 0.12;
    stone.rotation.y = index * 0.9;
    stone.receiveShadow = true;
    group.add(stone);
  });
  // 路两侧零散的石头
  const pathRocks: Array<[number, number, number]> = [
    [-1.6, 9.4, 0.2],
    [1.55, 10.9, 0.24],
    [-1.45, 12.6, 0.18],
  ];
  pathRocks.forEach(([x, z, s]) => {
    const rock = buildRock(s);
    rock.position.set(x, 0.02, z);
    group.add(rock);
  });

  const sign = buildSign(createSignTexture());
  sign.position.set(-3.6, 0, 6.4);
  sign.rotation.y = Math.PI / 4;
  group.add(sign);

  const dust = createDustMotes();
  group.add(dust.points);

  const trees: Array<[number, number, number]> = [
    [-9.2, -7.4, 1.15],
    [-9.6, -1.2, 1],
    [-8.9, 5.2, 1.2],
    [9.1, -6.8, 1.05],
    [9.5, -0.4, 1.25],
    [8.6, 5.6, 0.95],
    [-2.2, -10.4, 1.3],
    [2.4, -10.8, 1.1],
    [-5.6, 9.9, 1.2],
    [5.2, 10.2, 1.05],
  ];
  trees.forEach(([x, z, s], i) => {
    const tree = buildTree(s, i);
    tree.position.set(x, 0, z);
    tree.rotation.y = i * 1.2;
    group.add(tree);
  });

  // 石头
  [
    [3.4, 7.6, 0.9],
    [-5.3, 2.4, 0.7],
    [6.6, 2.8, 1],
    [-1.6, -8.4, 0.8],
    [-7.2, 6.8, 0.6],
  ].forEach(([x, z, s]) => {
    const rock = buildRock(s);
    rock.position.x = x;
    rock.position.z = z;
    group.add(rock);
  });

  // 草丛：三张交叉的草叶卡片，比圆锥更接近草
  [
    [-4.2, 5.2],
    [4.4, 5.4],
    [-5.8, -6.2],
    [6.1, -2.4],
    [-2.4, 8.6],
    [2.8, 8.8],
    [-7.6, 0.6],
    [7.4, -6.9],
    [-0.4, -9.4],
    [9.4, 2.6],
  ].forEach(([x, z], i) => {
    const tuft = buildGrassTuft();
    tuft.position.set(x, 0, z);
    tuft.rotation.y = i * 0.6;
    tuft.scale.setScalar(1 + (i % 3) * 0.12);
    group.add(tuft);
  });

  // 灌木：贴着围栏，把栅栏根部收拾得不那么空
  [
    [-5.9, 4.4, 1.15],
    [5.7, 5.0, 1.0],
    [-6.0, -5.4, 1.1],
    [6.0, -6.6, 0.95],
    [-2.9, 7.3, 1.05],
    [3.2, 7.4, 0.9],
  ].forEach(([x, z, s], i) => {
    const bush = buildBush(s, i);
    bush.position.set(x, 0, z);
    group.add(bush);
  });

  // 野花
  const flowers: Array<[number, number, number]> = [
    [-3.2, 4.2, PALETTE.flowerPink],
    [-2.6, 3.4, PALETTE.flowerYellow],
    [3.9, 4.0, PALETTE.flowerPink],
    [4.5, 3.2, PALETTE.flowerYellow],
    [-6.6, -3.2, PALETTE.flowerYellow],
    [7.2, 0.8, PALETTE.flowerPink],
    [-1.2, 9.0, PALETTE.flowerPink],
    [3.2, 9.4, PALETTE.flowerYellow],
    [-8.2, 1.8, PALETTE.flowerPink],
    [1.4, 10.8, PALETTE.flowerYellow],
  ];
  flowers.forEach(([x, z, color]) => {
    const flower = buildFlower(color);
    flower.position.set(x, 0, z);
    group.add(flower);
  });

  return { group, ground, update: dust.update };
}
