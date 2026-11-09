import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PALETTE, clay } from "./materials";
import {
  BRIDGE,
  FENCE_X,
  FENCE_Z,
  GATE_GAP,
  GATE_HALF,
  MOUNTAIN_LINE,
  RIVER_HALF_WIDTH,
  RIVER_POINTS,
  ROAD_HALF_WIDTH,
  ROAD_POINTS,
  WORLD_HALF,
  riverInfo,
  roadInfo,
} from "./layout";

import {
  buildBarn,
  buildBush,
  buildFenceSegment,
  buildFlower,
  buildGrassTuft,
  buildMountain,
  buildRock,
  buildSign,
  buildTree,
  buildWell,
  lumpy,
} from "./models";

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
    // 后墙也开一道门：农场后方那片草原不该只能绕一大圈才能到
    { from: new THREE.Vector3(-FENCE_X, 0, -FENCE_Z), to: new THREE.Vector3(FENCE_X, 0, -FENCE_Z), open: true },
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

  // —— 后门：两根门柱 + 一道门楣（门楣抬到人头顶上方，别做成拦路的横杆）——
  const backGate = new THREE.Group();
  backGate.position.set(0, 0, -FENCE_Z);
  [-1, 1].forEach((sign) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 2.05, 12),
      clay(PALETTE.woodDark)
    );
    post.position.set(sign * GATE_HALF, 1.02, 0);
    post.castShadow = true;
    backGate.add(post);
  });
  const backLintel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, GATE_HALF * 2 + 0.5, 10),
    clay(PALETTE.wood)
  );
  backLintel.rotation.z = Math.PI / 2;
  backLintel.position.set(0, 2.02, 0);
  backLintel.castShadow = true;
  backGate.add(backLintel);
  ring.add(backGate);

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
    // 远处的草色差：色差要小、块要碎，否则像贴在地上一块块的光斑
    [-52, 34, 12, 0x97d765],
    [48, 22, 10, 0x85c857],
    [-34, -64, 13, 0x97d765],
    [62, -58, 11, 0x85c857],
    [-88, 6, 14, 0x97d765],
    [96, -14, 12, 0x85c857],
    [-66, 78, 12, 0x85c857],
    [118, 40, 10, 0x97d765],
    [-108, -92, 15, 0x85c857],
    [24, 116, 11, 0x97d765],
    [-126, 54, 13, 0x97d765],
    [126, 96, 12, 0x85c857],
    [-120, -30, 12, 0x97d765],
    [14, -118, 13, 0x85c857],
    [-58, 128, 11, 0x85c857],
    [76, -112, 12, 0x97d765],
    [-14, 60, 10, 0x97d765],
    [40, -26, 9, 0x85c857],
    [-76, -18, 11, 0x97d765],
    [88, 118, 12, 0x85c857],
  ];
  patches.forEach(([x, z, r, color], i) => {
    // 每块用两个错位的圆拼，边缘就不会是规规矩矩的一个圆
    const blob = new THREE.Group();
    [
      [0, 0, r, 1],
      [r * 0.55, -r * 0.3, r * 0.62, 2],
    ].forEach(([ox, oz, rr, k]) => {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(rr, k === 1 ? 26 : 18),
        clay(color, { roughness: 0.95 })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.rotation.z = i * 0.7 + k;
      disc.position.set(ox, 0.004, oz);
      disc.receiveShadow = true;
      disc.material.polygonOffset = true;
      disc.material.polygonOffsetFactor = -1;
      disc.material.polygonOffsetUnits = -1;
      blob.add(disc);
    });
    blob.position.set(x, 0, z);
    group.add(blob);
  });
  return group;
}

/** 四边的大山：贴着方形地图的四条边摆一圈，正门方向（+z 边）留一道山口 */
function buildMountains(): THREE.Group {
  const group = new THREE.Group();
  const PER_SIDE = 12;

  let variant = 0;
  const place = (x: number, z: number, scaleJitter: number) => {
    // 底宽大于高度：山才是一片连绵的山脊，而不是一排尖锥
    const base = 40 + ((variant * 23) % 13) + scaleJitter * 0.5;
    const height = 34 + ((variant * 19) % 13);
    const mountain = buildMountain(base, height, variant);
    mountain.position.set(x, 0, z);
    mountain.rotation.y = variant * 0.9;
    group.add(mountain);
    variant += 1;
  };

  for (let side = 0; side < 4; side += 1) {
    for (let i = 0; i < PER_SIDE; i += 1) {
      const t = (i + 0.5) / PER_SIDE;
      const along = -MOUNTAIN_LINE + t * 2 * MOUNTAIN_LINE;
      const jitter = ((variant * 37) % 15) - 7;
      let x = 0;
      let z = 0;
      if (side === 0) {
        x = along;
        z = -MOUNTAIN_LINE - jitter;
      } else if (side === 1) {
        x = MOUNTAIN_LINE + jitter;
        z = along;
      } else if (side === 2) {
        x = along;
        z = MOUNTAIN_LINE + jitter;
      } else {
        x = -MOUNTAIN_LINE - jitter;
        z = along;
      }
      // +z 边中间留山口：这一段不摆山，以后从这里往外扩图
      if (side === 2 && Math.abs(x) < GATE_GAP) {
        variant += 1;
        continue;
      }
      place(x, z, jitter);
    }
  }

  // 四个角各补一座，别让对角线方向漏出天际线
  ([
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as Array<[number, number]>).forEach(([sx, sz]) => {
    place(sx * MOUNTAIN_LINE, sz * MOUNTAIN_LINE, 0);
  });

  return group;
}

/** 沿一条中心线生成贴地的条带（河、路都靠它） */
function buildRibbon(
  pts: THREE.Vector3[],
  halfWidth: number,
  y: number,
  color: number,
  roughness: number,
  wobbleAmp = 0.09,
  emissive?: number
): THREE.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < pts.length; i += 1) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    // 宽度不要像两条平行线，加一点起伏更像自然地形
    const wobble =
      1 + Math.sin(i * 0.33) * wobbleAmp + Math.sin(i * 0.09) * wobbleAmp * 0.7;
    const w = halfWidth * wobble;
    positions.push(pts[i].x + nx * w, y, pts[i].z + nz * w);
    positions.push(pts[i].x - nx * w, y, pts[i].z - nz * w);
  }

  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = clay(color, {
    roughness,
    emissive,
    emissiveIntensity: emissive ? 0.12 : 0,
  });
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** 沿河道生成一条贴地的条带（沙岸、水边过渡、水面都靠它） */
function buildRiverRibbon(
  halfWidth: number,
  y: number,
  color: number,
  roughness: number,
  emissive?: number
): THREE.Mesh {
  return buildRibbon(RIVER_POINTS, halfWidth, y, color, roughness, 0.09, emissive);
}

/** 农场门口通往木桥的土路 */
function buildRoad(): THREE.Mesh {
  // 比地块的土浅一点、灰一点，别在草地上压出一道扎眼的红棕带
  return buildRibbon(ROAD_POINTS, ROAD_HALF_WIDTH, 0.012, 0xc9a273, 0.95, 0.06);
}

/** 过河的桥：桥面 + 横铺木条 + 两端坡道 + 栏杆 + 桥桩 */
function buildBridge(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(BRIDGE.x, 0, BRIDGE.z);
  // 让局部 +z 对准跨河方向，桥就横着架在河上
  group.rotation.y = Math.atan2(BRIDGE.nx, BRIDGE.nz);

  const halfLen = BRIDGE.halfLength;
  const halfWid = BRIDGE.halfWidth;
  const deckY = BRIDGE.deckY;

  const deck = new THREE.Mesh(
    new RoundedBoxGeometry(halfWid * 2, 0.2, halfLen * 2, 3, 0.06),
    clay(PALETTE.wood, { roughness: 0.9 })
  );
  deck.position.y = deckY;
  deck.castShadow = true;
  deck.receiveShadow = true;
  // 桥面要能被点击选中，否则点到桥上会打穿到桥下的地面，目标点落回自己脚下
  deck.name = "bridge-deck";
  group.add(deck);

  // 横铺的桥板：给桥面分出一格一格的木条
  for (let i = -4; i <= 4; i += 1) {
    const slat = new THREE.Mesh(
      new RoundedBoxGeometry(halfWid * 2 - 0.26, 0.06, 1.1, 2, 0.02),
      clay(PALETTE.plank, { roughness: 0.95 })
    );
    slat.position.set(0, deckY + 0.12, (i * (halfLen * 2 - 1.4)) / 8);
    group.add(slat);
  }

  // 两端坡道：把桥面接到地面，别让桥板看上去漂在草上
  [-1, 1].forEach((sign) => {
    const rampLen = 3.0;
    const ramp = new THREE.Mesh(
      new RoundedBoxGeometry(halfWid * 2 - 0.24, 0.16, rampLen, 3, 0.05),
      clay(PALETTE.wood, { roughness: 0.9 })
    );
    ramp.position.set(0, deckY * 0.5, sign * (halfLen + rampLen / 2 - 0.35));
    ramp.rotation.x = sign * -0.19;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);
  });

  // 栏杆：两侧各五根立柱 + 两根横杆，顺桥面通长
  [-1, 1].forEach((side) => {
    const railX = side * (halfWid - 0.18);
    [-1, -0.5, 0, 0.5, 1].forEach((t) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 1.0, 8),
        clay(PALETTE.woodDark)
      );
      post.position.set(railX, deckY + 0.5, t * (halfLen - 0.15));
      post.castShadow = true;
      group.add(post);
    });
    [0.62, 0.98].forEach((h) => {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, halfLen * 1.94, 8),
        clay(PALETTE.wood)
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(railX, deckY + h, 0);
      rail.castShadow = true;
      group.add(rail);
    });
  });

  // 桥桩：四根斜插进水里
  [-1, 1].forEach((side) => {
    [-1, 1].forEach((sign) => {
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.13, 1.1, 8),
        clay(PALETTE.woodDark)
      );
      pile.position.set(side * (halfWid - 0.5), deckY - 0.55, sign * halfLen * 0.55);
      group.add(pile);
    });
  });

  return group;
}

/** 河：从山口流进来，S 形折到地图右上角，岸边有石头和芦苇 */
function buildRiver(): THREE.Group {
  const group = new THREE.Group();

  group.add(buildRiverRibbon(RIVER_HALF_WIDTH + 2.4, 0.014, 0xded0a6, 0.96));
  group.add(buildRiverRibbon(RIVER_HALF_WIDTH + 0.8, 0.024, 0x4f9fbf, 0.5));
  group.add(
    buildRiverRibbon(RIVER_HALF_WIDTH, 0.035, PALETTE.water, 0.18, 0x2b7fa8)
  );

  // 岸石与芦苇：沿河道两侧交替，别让河岸是一条光秃秃的色带
  let placed = 0;
  RIVER_POINTS.forEach((p, i) => {
    if (i % 7 !== 0) return;
    const prev = RIVER_POINTS[Math.max(0, i - 1)];
    const next = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    const side = placed % 2 === 0 ? 1 : -1;
    const off = RIVER_HALF_WIDTH + 1.9 + (placed % 3) * 0.5;
    const x = p.x + nx * off * side;
    const z = p.z + nz * off * side;
    // 桥位附近别放东西，免得挡住上桥的路
    if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 16) {
      placed += 1;
      return;
    }
    if (placed % 3 === 0) {
      const rock = buildRock(0.7 + (placed % 4) * 0.12);
      rock.position.set(x, 0.02, z);
      group.add(rock);
    } else {
      const tuft = buildGrassTuft();
      tuft.position.set(x, 0, z);
      tuft.scale.set(1.0, 2.1 + (placed % 3) * 0.3, 1.0);
      group.add(tuft);
    }
    placed += 1;
  });

  group.add(buildBridge());

  return group;
}

/** 农场外的草原：树、石头、草丛散在围栏外面，别让草原一眼望到山还是一片空 */
function buildMeadow(): THREE.Group {
  const group = new THREE.Group();

  // 方形地图太大，黄金角散点会中间密、边上稀；改成带抖动的方格，
  // 铺到山脚每 10 米左右一件，密度均匀又不会像摆出来的阵列
  const SPAN = WORLD_HALF - 3;
  const GRID = 34;
  const STEP = (SPAN * 2) / GRID;

  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const gx = -SPAN + (i + 0.5) * STEP;
      const gz = -SPAN + (j + 0.5) * STEP;

      const h1 = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
      const r1 = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 39.346 + j * 11.135) * 24634.6345;
      const r2 = h2 - Math.floor(h2);
      const h3 = Math.sin(i * 7.31 + j * 61.7) * 12345.678;
      const r3 = h3 - Math.floor(h3);
      const keep = Math.sin(i * 21.7 + j * 4.3) * 9871.23;
      const r4 = keep - Math.floor(keep);

      const x = gx + (r1 - 0.5) * STEP * 0.82;
      const z = gz + (r2 - 0.5) * STEP * 0.82;

      // 院子里、河道里、桥位附近、土路上都留空
      if (Math.abs(x) < 15.5 && Math.abs(z) < 13.5) continue;
      if (riverInfo(x, z).dist < RIVER_HALF_WIDTH + 4.4) continue;
      if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 14) continue;
      if (roadInfo(x, z) < ROAD_HALF_WIDTH + 1.6) continue;
      // 留一部分空地，草原上不该每格都插着东西
      if (r4 < 0.3) continue;

      const scale = 0.95 + r3 * 0.9;
      const kind = Math.floor(r3 * 1000) % 10;
      // 远处的小草簇根本看不见，只留树和石头，省下来的开销拿来加密近处
      const distant = Math.hypot(x, z) > 96;
      if (distant && kind >= 5) continue;
      if (kind < 2) {
        const tree = buildTree(scale, i * 7 + j);
        tree.position.set(x, 0, z);
        tree.rotation.y = r1 * 6.28;
        group.add(tree);
      } else if (kind < 5) {
        const rock = buildRock(scale * 0.95);
        rock.position.set(x, 0.02, z);
        rock.rotation.y = r2 * 6.28;
        group.add(rock);
      } else {
        const tuft = buildGrassTuft();
        tuft.position.set(x, 0, z);
        tuft.scale.setScalar(scale * 1.6);
        tuft.rotation.y = r3 * 6.28;
        group.add(tuft);
        // 草簇旁边带一小簇野花，远看是一点点彩色的碎光
        if (kind > 7 && !distant) {
          for (let f = 0; f < 3; f += 1) {
            const fa = r1 * 6.28 + f * 2.1;
            const flower = buildFlower(f % 2 === 0 ? PALETTE.flowerPink : PALETTE.flowerYellow);
            flower.position.set(x + Math.cos(fa) * 0.9, 0.02, z + Math.sin(fa) * 0.9);
            group.add(flower);
          }
        }
      }
    }
  }

  return group;
}

export interface World {
  group: THREE.Group;
  ground: THREE.Mesh;
  update?: (t: number) => void;
}

export function createWorld(): World {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    // 山在 ±164，山脚外缘到 ±200；地面铺到 ±240，山外只留一条窄边，不会从山上看到一整片空地
    new THREE.PlaneGeometry(WORLD_HALF * 3.2, WORLD_HALF * 3.2),
    clay(PALETTE.grass, { roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  group.add(buildGrassPatches());

  // 田埂：一整块圆角草台，地块是草台上一格格翻好的土
  // 6×5 的地块占 15.6×13，草台各边再留 0.7 走脚
  const field = new THREE.Mesh(
    new RoundedBoxGeometry(17.0, 0.2, 14.4, 3, 0.06),
    clay(PALETTE.grassLight, { roughness: 0.95 })
  );
  field.position.set(0, 0.1, 0);
  field.receiveShadow = true;
  group.add(field);

  group.add(buildFenceRing());
  group.add(buildMountains());
  group.add(buildMeadow());
  group.add(buildRiver());
  group.add(buildRoad());

  // 谷仓挪到围栏外左侧：农场扩大后围栏内全是田，谷仓做背景，屋顶高过栅栏
  const barn = buildBarn();
  barn.position.set(-13.8, 0, -3.2);
  barn.rotation.y = 0.24;
  group.add(barn);

  // 水井放在草台与右侧围栏之间的走道上
  const well = buildWell();
  well.position.set(9.9, 0, -3.8);
  group.add(well);

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
  // 路两侧零散的石头（相对门口位置，随围栏一起外移）
  const pathRocks: Array<[number, number, number]> = [
    [-1.7, FENCE_Z + 1.3, 0.2],
    [1.65, FENCE_Z + 2.9, 0.24],
    [-1.55, FENCE_Z + 4.5, 0.18],
  ];
  pathRocks.forEach(([x, z, s]) => {
    const rock = buildRock(s);
    rock.position.set(x, 0.02, z);
    group.add(rock);
  });

  const sign = buildSign(createSignTexture());
  sign.position.set(-10.4, 0, 7.5);
  sign.rotation.y = Math.PI / 3;
  group.add(sign);

  const dust = createDustMotes();
  group.add(dust.points);

  const trees: Array<[number, number, number]> = [
    [-15.4, -8.6, 1.25],
    [-16.6, 1.4, 1.05],
    [-14.8, 9.6, 1.15],
    [15.6, -8.4, 1.1],
    [16.8, 1.8, 1.2],
    [15.2, 10.0, 1.0],
    [-8.6, 15.4, 1.3],
    [8.8, 15.8, 1.15],
    [-16.0, 14.8, 1.2],
    [16.2, 14.4, 1.05],
  ];
  trees.forEach(([x, z, s], i) => {
    const tree = buildTree(s, i);
    tree.position.set(x, 0, z);
    tree.rotation.y = i * 1.2;
    group.add(tree);
  });

  // 石头
  [
    [9.3, 6.9, 0.85],
    [-9.5, 6.7, 0.7],
    [13.2, 5.6, 1.0],
    [-2.2, -9.0, 0.8],
    [-13.0, 7.2, 0.65],
  ].forEach(([x, z, s]) => {
    const rock = buildRock(s);
    rock.position.x = x;
    rock.position.z = z;
    group.add(rock);
  });

  // 草丛：三张交叉的草叶卡片，比圆锥更接近草
  [
    [-6.4, 8.0],
    [6.6, 8.1],
    [-9.9, 1.4],
    [10.1, 1.6],
    [-9.7, -5.8],
    [9.9, -6.4],
    [-4.8, -8.0],
    [5.0, -8.2],
    [-13.4, 2.8],
    [13.6, -2.4],
  ].forEach(([x, z], i) => {
    const tuft = buildGrassTuft();
    tuft.position.set(x, 0, z);
    tuft.rotation.y = i * 0.6;
    tuft.scale.setScalar(1 + (i % 3) * 0.12);
    group.add(tuft);
  });

  // 灌木：贴着围栏，把栅栏根部收拾得不那么空
  [
    [-9.1, 6.5, 1.1],
    [9.1, 6.5, 0.95],
    [-9.3, -6.9, 1.05],
    [9.3, -6.9, 0.9],
    [-2.9, 8.1, 1.0],
    [3.1, 8.1, 0.9],
  ].forEach(([x, z, s], i) => {
    const bush = buildBush(s, i);
    bush.position.set(x, 0, z);
    group.add(bush);
  });

  // 野花
  const flowers: Array<[number, number, number]> = [
    [-7.4, 7.8, PALETTE.flowerPink],
    [-6.6, 8.3, PALETTE.flowerYellow],
    [7.4, 7.8, PALETTE.flowerPink],
    [6.6, 8.3, PALETTE.flowerYellow],
    [-10.4, -2.0, PALETTE.flowerYellow],
    [10.6, -1.4, PALETTE.flowerPink],
    [-3.2, 9.8, PALETTE.flowerPink],
    [3.4, 10.0, PALETTE.flowerYellow],
    [-11.0, 5.2, PALETTE.flowerPink],
    [11.0, 5.4, PALETTE.flowerYellow],
  ];
  flowers.forEach(([x, z, color]) => {
    const flower = buildFlower(color);
    flower.position.set(x, 0, z);
    group.add(flower);
  });

  return { group, ground, update: dust.update };
}
