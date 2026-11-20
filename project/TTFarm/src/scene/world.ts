import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildWaterSurface } from "./riverWater";
import { buildSubmergedDetails } from "./riverBed";
import { buildRain, type SkyWeather } from "./atmosphere";
import { bakeScenery } from "./scenery";
import { meadowGround } from "./grassGround";
import { buildWindmill } from "./windmill";
import { createFarmDecor } from "./farmDecor";
import type { FarmDecor } from "../game/decor";
import { WorldObstacles } from "./obstacles";
import { PALETTE, clay } from "./materials";
import {
  BRIDGE,
  FENCE_X,
  FENCE_Z,
  GATE_GAP,
  FARM_BARN,
  FARM_MILL,
  MOUNTAIN_LINE,
  RIVER_BED,
  RIVER_POINTS,
  ROAD_HALF_WIDTH,
  ROAD_POINTS,
  WORLD_HALF,
  riverBedHeight,
  riverInfo,
  roadInfo,
} from "./layout";

import {
  buildBarn,
  buildBush,
  buildFlower,
  buildGrassTuft,
  buildMountain,
  buildRock,
  buildTree,
  buildWell,
  flowerGeometry,
  flowerMaterial,
  grassTuftGeometry,
  grassTuftMaterial,
  updateGrassWind,
} from "./models";

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

/** 四边的大山：贴着方形地图的四条边摆一圈，正门方向（+z 边）留一道山口 */
function buildMountains(obstacles: WorldObstacles): THREE.Group {
  const group = new THREE.Group();
  const PER_SIDE = 12;
  const ridges = new Map<string, THREE.Group>();

  let variant = 0;
  const place = (x: number, z: number, scaleJitter: number) => {
    // 底宽大于高度：山才是一片连绵的山脊，而不是一排尖锥
    const base = 40 + ((variant * 23) % 13) + scaleJitter * 0.5;
    const height = 24 + ((variant * 19) % 15) + 11*Math.sin(variant*.82+1.4);
    const mountain = buildMountain(base, height, variant);
    mountain.position.set(x, 0, z);
    mountain.rotation.y = variant * 0.9;
    mountain.traverse(part => {
      if (part instanceof THREE.Mesh) obstacles.addMountainSection(part);
    });
    const key = Math.floor(x / 75) + "," + Math.floor(z / 75);
    let ridge = ridges.get(key);
    if (!ridge) { ridge = new THREE.Group(); ridges.set(key, ridge); }
    ridge.add(mountain);
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

  for (const ridge of ridges.values()) {
    const mesh = bakeScenery(ridge);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

function buildRoad(points = ROAD_POINTS, halfWidth = ROAD_HALF_WIDTH): THREE.Mesh {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const bands = [-1, -.87, -.68, 0, .68, .87, 1];
  const tints = [0x9db57b, 0xb4b187, 0xc2ad89, 0xcab592, 0xc4ac85, 0xb5b489, 0x9db57b];
  const color = new THREE.Color();
  points.forEach((p,i) => {
    const prev = points[Math.max(0,i-1)];
    const next = points[Math.min(points.length-1,i+1)];
    const dx = next.x-prev.x, dz = next.z-prev.z, len = Math.hypot(dx,dz);
    // Feather the gate end into the turf and give each shoulder an irregular width.
    const tip = THREE.MathUtils.smoothstep(i,0,6);
    bands.forEach((factor,k) => {
      const jitter = Math.sin(i * 1.91 + Math.sign(factor)*8.) * 0.12 + Math.sin(i*.53)*.09;
      const width = halfWidth * (1+jitter*Math.abs(factor)) * (.70+.30*tip);
      positions.push(p.x-factor*width*dz/len, .014, p.z+factor*width*dx/len);
      color.setHex(tints[k]);
      const edgeAlpha = 1 - THREE.MathUtils.smoothstep(Math.abs(factor), 0.68, 1);
      colors.push(color.r, color.g, color.b, edgeAlpha * tip);
      if (i && k) {
        const j=i*bands.length+k;
        indices.push(j-bands.length-1,j-bands.length,j-1,j-bands.length,j,j-1);
      }
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geo.setIndex(indices); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 pathXZ;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n pathXZ=position.xz;");
    shader.fragmentShader = "varying vec2 pathXZ;\n" + shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      vec2 cells = pathXZ * vec2(4.5,7.6);
      vec2 tile = floor(cells);
      vec2 seed = fract(sin(vec2(dot(tile,vec2(13.2,71.3)),dot(tile,vec2(51.1,23.7))))*713.31);
      float pebble = length(fract(cells)-(.2+.6*seed));
      diffuseColor.rgb *= 1. + (.45-seed.x)*.31*(1.-smoothstep(.06,.21+fwidth(pebble),pebble));
    `);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
/** 过河的桥：桥面 + 横铺木条 + 两端坡道 + 栏杆 + 桥桩 */
function buildBridge(obstacles: WorldObstacles): THREE.Group {
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
  deck.position.y = deckY - 0.135;
  deck.castShadow = true;
  deck.receiveShadow = true;
  // 桥面要能被点击选中，否则点到桥上会打穿到桥下的地面，目标点落回自己脚下
  deck.name = "bridge-deck";
  group.add(deck);

  // Keep the structural details in one batch and the deck as a separate ray target.
  const framing = new THREE.Group();
  const boardCount = 29;
  const pitch = halfLen * 2 / boardCount;
  const boards = [0xb68b64, 0xc89c72, 0xb99370, 0xd0ab7e, 0xc59b74];
  for (let i = 0; i < boardCount; i++) {
    const z = -halfLen + (i + 0.5) * pitch;
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(halfWid * 2 + Math.sin(i * 5) * 0.075, 0.095, pitch - 0.026),
      clay(boards[(i * 7) % boards.length])
    );
    slat.position.set(0, deckY - 0.047, z);
    framing.add(slat);
  }

  // 两端坡道：把桥面接到地面，别让桥板看上去漂在草上
  [-1, 1].forEach((sign) => {
    const rampLen = BRIDGE.rampLength;
    const ramp = new THREE.Mesh(
      new RoundedBoxGeometry(halfWid * 2 - 0.24, 0.16, rampLen, 3, 0.05),
      clay(0xb79470)
    );
    ramp.position.set(0, deckY * 0.5 - 0.075, sign * (halfLen + rampLen / 2 - 0.12));
    ramp.rotation.x = sign * Math.atan2(deckY, rampLen);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    ramp.name = "bridge-ramp";
    group.add(ramp);
  });

  // 栏杆：两侧各五根立柱 + 两根横杆，顺桥面通长
  [-1, 1].forEach((side) => {
    const railX = side * (halfWid - 0.18);
    const railCenter = group.localToWorld(new THREE.Vector3(railX, 0, 0));
    obstacles.addBox(railCenter.x, railCenter.z, 0.13, halfLen - 0.02, group.rotation.y, "deck");
    [-1, -0.5, 0, 0.5, 1].forEach((t) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.13, 1.14, 8),
        clay(0x8d6853)
      );
      post.position.set(railX, deckY + 0.5, t * (halfLen - 0.15));
      post.castShadow = true;
      framing.add(post);
    });
    [0.62, 0.98].forEach((h) => {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, halfLen * 1.94, 8),
        clay(0xab8968)
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(railX, deckY + h, 0);
      rail.castShadow = true;
      framing.add(rail);
    });
  });

  // 桥桩：四根斜插进水里
  [-1, 1].forEach((side) => {
    [-1, 1].forEach((sign) => {
      const bottom = RIVER_BED.bedY - .15;
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.21, deckY - bottom, 8),
        clay(0x8d6853)
      );
      pile.position.set(side * (halfWid - 0.5), (deckY + bottom) * .5, sign * halfLen * 0.55);
      const pileCenter = group.localToWorld(pile.position.clone());
      obstacles.addCircle(pileCenter.x, pileCenter.z, 0.21, "terrain");
      framing.add(pile);
    });
  });

  group.add(bakeScenery(framing));
  return group;
}

/**
 * 河谷：草地上真正凹下去的一道沟。岸肩、下坡、水面线、水下坡、河床都在这一张壳上，
 * 用顶点色从草土渐变到湿沙再到河床泥，所以看不出是拼出来的几条色带。
 */
function buildRiverValley() {
  // 横截面从左岸到右岸：位置 / 高度 / 颜色
  const PROFILE: Array<[number, number, number]> = [
    [RIVER_BED.shoulder, 0.004, 0x8fb061],
    [RIVER_BED.edge, 0.004, 0x9aa869],
    [RIVER_BED.waterLine, RIVER_BED.waterY, 0xc1b493],
    [RIVER_BED.bedEdge, RIVER_BED.bedY, 0xa6b19a],
    [0, RIVER_BED.bedY - 0.02, 0x96a99a],
    [-RIVER_BED.bedEdge, RIVER_BED.bedY, 0xa6b19a],
    [-RIVER_BED.waterLine, RIVER_BED.waterY, 0xc1b493],
    [-RIVER_BED.edge, 0.004, 0x9aa869],
    [-RIVER_BED.shoulder, 0.004, 0x8fb061],
  ];

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const sectionStart: number[] = [];
  const SECTION_STEP = 1; // 与草地开口及水面使用同一套采样，岸沿没有漏缝。
  const tint = new THREE.Color();

  for (let i = 0; i < RIVER_POINTS.length; i += SECTION_STEP) {
    const p = RIVER_POINTS[i];
    const prev = RIVER_POINTS[Math.max(0, i - 1)];
    const next = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    sectionStart.push(positions.length / 3);
    for (const [off, y, hex] of PROFILE) {
      positions.push(p.x + nx * off, y, p.z + nz * off);
      tint.setHex(hex);
      colors.push(tint.r, tint.g, tint.b);
    }
  }

  const P = PROFILE.length;
  for (let s = 0; s < sectionStart.length - 1; s += 1) {
    const a = sectionStart[s];
    const b = sectionStart[s + 1];
    for (let k = 0; k < P - 1; k += 1) {
      indices.push(a + k, a + k + 1, b + k);
      indices.push(b + k, a + k + 1, b + k + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    envMapIntensity: 0.45,
  });
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** 河：凹进草地的河谷 + 沟底流动的水面 + 水面上的碎波光；update 让水一直在动 */
function buildRiver(obstacles: WorldObstacles) {
  const group = new THREE.Group();
  // 河谷地形（岸坡 + 河床）先铺，水面压在沟里
  const valley = buildRiverValley();
  group.add(valley);

  // 水面宽度正好等于 waterLine，与岸坡严丝合缝地相交，不会出现悬空的水边
  const water = buildWaterSurface();
  const bed = buildSubmergedDetails(valley, water.time, water.cloud);
  group.add(...water.tiles, bed.details);

  // 岸石与芦苇：沿河道两侧交替，石头压在岸肩上，芦苇立在坡上
  let placed = 0;
  RIVER_POINTS.forEach((p, i) => {
    if (i % 5 !== 0) return;
    const prev = RIVER_POINTS[Math.max(0, i - 1)];
    const next = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    const side = placed % 2 === 0 ? 1 : -1;
    const isRock = placed % 3 === 0;
    const off = isRock ? 8.5 + (placed % 3) * 0.6 : 7.5 + (placed % 4) * 0.28;
    const x = p.x + nx * off * side;
    const z = p.z + nz * off * side;
    // 桥位附近别放东西，免得挡住上桥的路
    if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 16) {
      placed += 1;
      return;
    }
    const y = riverBedHeight(off);
    if (isRock) {
      const rock = buildRock(0.7 + (placed % 4) * 0.12);
      rock.position.set(x, y, z);
      obstacles.addCircle(x, z, rock.scale.x * 0.40, "terrain");
      group.add(rock);
    } else {
      const tuft = buildGrassTuft();
      tuft.position.set(x, y, z);
      tuft.scale.set(1.0, 2.1 + (placed % 3) * 0.3, 1.0);
      group.add(tuft);
    }
    placed += 1;
  });

  // Cattails, stones and floating leaves form irregular pockets on the inside banks.
  const shallows = new THREE.Group();
  for (let i = 3; i < RIVER_POINTS.length - 2; i += 3) {
    const p = RIVER_POINTS[i], next = RIVER_POINTS[i+1];
    const len = p.distanceTo(next), tx = (next.x-p.x)/len, tz = (next.z-p.z)/len;
    const sign = i % 2 ? 1 : -1;
    const x = p.x - sign*tz*6.7, z = p.z + sign*tx*6.7;
    if (Math.hypot(x-BRIDGE.x,z-BRIDGE.z)<6) continue;
    for (let j=0;j<4;j++) {
      const h = 0.62 + 0.60*(0.5+0.5*Math.sin(i+j*5.92));
      const px = x + tx*j*0.23, pz = z + tz*j*0.23;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.013,.025,h,5),clay(0x759557));
      stem.position.set(px,RIVER_BED.waterY+h*.5-.06,pz);
      const catkin = new THREE.Mesh(new THREE.CylinderGeometry(.033,.038,.18,6),clay(0x85654b));
      catkin.position.set(px,RIVER_BED.waterY+h-.13,pz);
      shallows.add(stem,catkin);
      const inset = .43 + .95*(0.5+0.5*Math.cos(i*.76+j*3.21));
      const pad = new THREE.Mesh(new THREE.CircleGeometry(.21 + .1*Math.sin(i+j), 10, 0.25, 5.86),clay(j % 2 ? 0x86a66d : 0xa1b57e));
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = i+j;
      pad.position.set(px+sign*tz*inset+tx*j*.41,RIVER_BED.waterY+.017,pz-sign*tx*inset+tz*j*.41);
      shallows.add(pad);
    }
    const rock = buildRock(1.12);
    rock.position.set(x,RIVER_BED.waterY-.06,z);
    obstacles.addCircle(x, z, rock.scale.x * 0.40, "terrain");
    shallows.add(rock);
  }
  const bankDetail = bakeScenery(shallows);
  bankDetail.castShadow = false;
  group.add(bankDetail);

  const bridge = buildBridge(obstacles);
  group.add(bridge);
  const surfaces = [valley, ...water.tiles, ...bridge.children.filter(part => part.name.startsWith("bridge-"))];
  return { group, surfaces, update: water.update, dispose: bed.dispose };
}

/** 农场外的草原：树、石头撑骨架，草和野花铺满近处，别让草原一眼望到山还是一片空 */
function buildMeadow(obstacles: WorldObstacles): THREE.Group {
  const group = new THREE.Group();

  const treeBeds: Sprite[][] = [[], [], []];
  const rocks: Sprite[] = [];
  const tufts: Sprite[] = [];
  const pinkFlowers: Sprite[] = [];
  const yellowFlowers: Sprite[] = [];

  /** 院子里、河道里、桥位附近、土路上都留空 */
  const blocked = (x: number, z: number): boolean => {
    if (Math.abs(x) < FENCE_X + 2 && Math.abs(z) < FENCE_Z + 2) return true;
    if (riverInfo(x, z).dist < RIVER_BED.shoulder) return true;
    if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 14) return true;
    if (roadInfo(x, z) < ROAD_HALF_WIDTH + 1.6) return true;
    return false;
  };

  // 方形地图太大，黄金角散点会中间密、边上稀；改成带抖动的方格，
  // 铺到山脚每 8 米左右一件，密度均匀又不会像摆出来的阵列
  const SPAN = WORLD_HALF - 3;
  const GRID = 38;
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

      if (blocked(x, z)) continue;
      // 留一部分空地，草原上不该每格都插着东西
      if (r4 < 0.3) continue;

      const scale = 0.95 + r3 * 0.9;
      const kind = Math.floor(r3 * 1000) % 10;
      if (kind < 3) {
        const species = r1 < 0.16 ? 1 : r1 > 0.70 ? 2 : 0;
        treeBeds[species].push({x, z, s: scale, r: r2 * 6.28});
        obstacles.addCircle(x, z, 0.20 * scale);
      } else if (kind < 6) {
        rocks.push({x, z, s: scale * 0.95, r: r2 * 6.28});
        obstacles.addCircle(x, z, 0.40 * scale * 0.95);
      } else if (Math.hypot(x, z) > 100) {
        // 只有远处的草交给这张疏网格，近处由下面的密网格负责
        tufts.push({ x, z, s: scale * 1.5, r: r3 * 6.28 });
      }
    }
  }

  // 近处密网格：4 米一簇草、每簇再带两三朵野花，走到草原上才有草地的质感
  const NEAR = 62;
  const NGRID = window.matchMedia("(pointer: coarse)").matches ? 26 : 32;
  const NSTEP = (NEAR * 2) / NGRID;
  for (let i = 0; i < NGRID; i += 1) {
    for (let j = 0; j < NGRID; j += 1) {
      const gx = -NEAR + (i + 0.5) * NSTEP;
      const gz = -NEAR + (j + 0.5) * NSTEP;

      const h1 = Math.sin(i * 51.19 + j * 13.71) * 31847.31;
      const r1 = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 17.83 + j * 91.27) * 19423.77;
      const r2 = h2 - Math.floor(h2);
      const h3 = Math.sin(i * 33.41 + j * 27.59) * 48151.19;
      const r3 = h3 - Math.floor(h3);
      const h4 = Math.sin(i * 79.13 + j * 5.37) * 27139.53;
      const r4 = h4 - Math.floor(h4);

      const x = gx + (r1 - 0.5) * NSTEP * 0.86;
      const z = gz + (r2 - 0.5) * NSTEP * 0.86;

      if (blocked(x, z)) continue;
      if (r4 < 0.1) continue;

      const scale = 0.8 + r3 * 0.55;
      tufts.push({ x, z, s: scale * 1.55, r: r3 * 6.28 });

      if (r4 > 0.42) {
        const count = 2 + Math.floor(r2 * 3); // 每簇 2~4 朵
        for (let f = 0; f < count; f += 1) {
          const a = r1 * 6.28 + f * 1.9;
          const d = 0.34 + r3 * 0.55;
          const bucket = f % 2 === 0 ? pinkFlowers : yellowFlowers;
          bucket.push({
            x: x + Math.cos(a) * d,
            z: z + Math.sin(a) * d,
            s: 1.35 + r2 * 0.75,
            r: r1 * 6.28,
          });
        }
      }
    }
  }

  const templates = [0,1,4].map((variant) => bakeScenery(buildTree(1, variant)));
  templates.forEach((tree, index) => {
    group.add(instanceTiles(tree.geometry, tree.material, treeBeds[index], 70, true));
  });
  const rock = buildRock(1);
  rock.geometry.scale(1,0.72,1.05);
  rock.geometry.translate(0,0.14,0);
  group.add(
    instanceTiles(rock.geometry, rock.material, rocks, 80, false),
    instanceTiles(grassTuftGeometry(), grassTuftMaterial(), tufts, 40, false),
    instanceTiles(flowerGeometry(PALETTE.flowerPink), flowerMaterial(), pinkFlowers, 40, false),
    instanceTiles(flowerGeometry(PALETTE.flowerYellow), flowerMaterial(), yellowFlowers, 40, false),
  );

  return group;
}

interface Sprite { x: number; z: number; s: number; r: number }

/** Chunk the meadow so off-camera groves and wildflowers cost no vertex work. */
function instanceTiles(geo: THREE.BufferGeometry, mat: THREE.Material, items: Sprite[], size: number, shadow: boolean) {
  const cells = new Map<string, Sprite[]>();
  for (const it of items) {
    const key = Math.floor(it.x / size) + "," + Math.floor(it.z / size);
    const cell = cells.get(key);
    if (cell) cell.push(it);
    else cells.set(key, [it]);
  }
  const group = new THREE.Group();
  for (const cell of cells.values()) {
    const mesh = instanceSprites(geo, mat, cell);
    mesh.castShadow = shadow;
    group.add(mesh);
  }
  return group;
}

/** 把一堆 {位置, 缩放, 朝向} 铺成一个 InstancedMesh */
function instanceSprites(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  sprites: Array<{ x: number; z: number; s: number; r: number }>
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, sprites.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  sprites.forEach((it, i) => {
    q.setFromAxisAngle(up, it.r);
    p.set(it.x, 0, it.z);
    s.setScalar(it.s);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = sprites.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  return mesh;
}

export interface World {
  group: THREE.Group;
  ground: THREE.Mesh;
  obstacles: WorldObstacles;
  walkSurfaces: THREE.Object3D[];
  setDecor: (decor: FarmDecor) => void;
  update: (t: number, weather?: SkyWeather, player?: THREE.Vector3, swimAmount?: number) => void;
  dispose: () => void;
}

export function createWorld(initialDecor?: FarmDecor): World {
  const group = new THREE.Group();
  const obstacles = new WorldObstacles();

  // 草地：地面必须沿河道挖出一条洞，否则那块平平的草会把下凹的河谷整片盖住
  const GROUND_HALF = WORLD_HALF * 1.6;
  const groundShape = new THREE.Shape();
  groundShape.moveTo(-GROUND_HALF, -GROUND_HALF);
  groundShape.lineTo(GROUND_HALF, -GROUND_HALF);
  groundShape.lineTo(GROUND_HALF, GROUND_HALF);
  groundShape.lineTo(-GROUND_HALF, GROUND_HALF);
  groundShape.closePath();

  // 洞的轮廓：沿河心左右各推到岸肩，与河谷壳的外缘严丝合缝
  const holePath = new THREE.Path();
  {
    const leftEdge: THREE.Vector2[] = [];
    const rightEdge: THREE.Vector2[] = [];
    for (let i = 0; i < RIVER_POINTS.length; i += 1) {
      const p = RIVER_POINTS[i];
      const prev = RIVER_POINTS[Math.max(0, i - 1)];
      const next = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;
      const w = RIVER_BED.shoulder;
      // Shape 走 XY 平面，rotateX(-90°) 后 shape 的 y 对应世界的 -z
      leftEdge.push(new THREE.Vector2(p.x + nx * w, -(p.z + nz * w)));
      rightEdge.push(new THREE.Vector2(p.x - nx * w, -(p.z - nz * w)));
    }
    holePath.setFromPoints(leftEdge.concat(rightEdge.reverse()));
    holePath.closePath();
  }
  groundShape.holes.push(holePath);

  const groundGeo = new THREE.ShapeGeometry(groundShape);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, meadowGround());
  ground.receiveShadow = true;
  group.add(ground);


  // 田埂：一整块圆角草台，地块是草台上一格格翻好的土
  // 6×5 的地块占 15.6×13，草台各边再留 0.7 走脚
  const field = new THREE.Mesh(
    new RoundedBoxGeometry(17.0, 0.2, 14.4, 3, 0.06),
    clay(PALETTE.grassLight, { roughness: 0.95 })
  );
  field.position.set(0, 0.1, 0);
  field.receiveShadow = true;
  group.add(field);

  const decor = createFarmDecor(obstacles, initialDecor);
  group.add(decor.group);
  group.add(buildMountains(obstacles));
  group.add(buildMeadow(obstacles));
  const river = buildRiver(obstacles);
  group.add(river.group);
  group.add(buildRoad());

  // 谷仓和磨坊分居院内西、东北两边，给田边和双门留下通道。
  const barn = buildBarn();
  barn.position.set(FARM_BARN.x, 0, FARM_BARN.z);
  barn.rotation.y = FARM_BARN.yaw;
  obstacles.addBox(barn.position.x, barn.position.z, 1.75, 1.55, barn.rotation.y);
  const hay = barn.localToWorld(new THREE.Vector3(-2.05, 0, 0.6));
  obstacles.addBox(hay.x, hay.z, 0.25, 0.34, barn.rotation.y);
  const barrel = barn.localToWorld(new THREE.Vector3(1.95, 0, 0.8));
  obstacles.addCircle(barrel.x, barrel.z, 0.28);
  const barnMesh = bakeScenery(barn);
  barnMesh.name = "farm-barn";
  group.add(barnMesh);
  const mill = buildWindmill();
  mill.group.position.set(FARM_MILL.x, 0, FARM_MILL.z);
  mill.group.rotation.y = FARM_MILL.yaw;
  mill.group.name = "farm-windmill";
  obstacles.addCircle(mill.group.position.x, mill.group.position.z, 1.48 * mill.group.scale.x);
  group.add(mill.group);
  // Two narrower paths skirt the raised planting beds and meet the building doors.
  const barnDoor = barn.localToWorld(new THREE.Vector3(0,0,1.56));
  const millDoor = mill.group.localToWorld(new THREE.Vector3(0,0,1.49));
  for (const points of [
    [[-.70,11.5],[-4.5,10.3],[-9.55,8.1],[-10.95,4.2],[-11.35,.15],[barnDoor.x,barnDoor.z]],
    [[.70,12.3],[5.3,10.5],[10.8,8.6],[12.2,4.1],[12.1,-.8],[11.6,-5.1],[millDoor.x,millDoor.z]],
  ]) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,z]) => new THREE.Vector3(x,0,z)));
    group.add(buildRoad(curve.getSpacedPoints(42), .70));
  }

  // 水井放在草台与右侧围栏之间的走道上
  const well = buildWell();
  well.position.set(9.9, 0, -3.8);
  obstacles.addCircle(well.position.x, well.position.z, 0.82);
  group.add(bakeScenery(well));

  // 门外用一串踩实的土块石阶代替整块路板：不铺平板，看起来更像走出来的乡间小路
  const trail = new THREE.Group();
  for (let i=0;i<29;i++) {
    const p = ROAD_POINTS[Math.min(ROAD_POINTS.length-1,Math.floor(i*.64))];
    const edge = i%4<2 ? -.83 : .87;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.12+(i%3)*.039),clay([0xc4b494,0xa79b82,0xb8ab92][i%3]));
    rock.scale.set(1.25,.26,.73); rock.rotation.y = i*.71;
    rock.position.set(p.x+edge+.21*Math.sin(i*2.3),.035,p.z+.23*Math.cos(i*4.31));
    trail.add(rock);
  }
  group.add(bakeScenery(trail));
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


  const dust = createDustMotes();
  group.add(dust.points);
  const rain = buildRain();
  group.add(rain.mesh);

  const trees: Array<[number, number, number]> = [
    [-15.4, -8.6, 1.25],
    [-16.6, 1.4, 1.05],
    [-14.8, 9.6, 1.15],
    [17.5, -12.3, 1.1],
    [16.8, 1.8, 1.2],
    [15.2, 10.0, 1.0],
    [-8.6, 12.5, 1.3],
    [8.8, 12.8, 1.15],
    [-17.2, 12.1, 1.2],
    [17.1, 12.4, 1.05],
  ];
  trees.forEach(([x, z, s], i) => {
    const tree = buildTree(s, i);
    tree.position.set(x, 0, z);
    tree.rotation.y = i * 1.2;
    obstacles.addCircle(x, z, 0.20 * tree.scale.x);
    group.add(bakeScenery(tree));
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
    obstacles.addCircle(x, z, 0.40 * rock.scale.x);
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
    group.add(bakeScenery(bush));
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
    group.add(bakeScenery(flower));
  });

  let lastTime = 0;
  return {
    group,
    ground,
    obstacles,
    walkSurfaces: [ground, ...river.surfaces],
    setDecor: decor.setDecor,
    dispose() {
      river.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      group.traverse((node) => {
        if (node instanceof THREE.InstancedMesh) node.dispose();
        if (!(node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line)) return;
        geometries.add(node.geometry);
        const list = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of list) {
          materials.add(material);
          if (material.map) textures.add(material.map);
        }
      });
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
      group.clear();
    },
    update(t, weather = "sunny", player, swimAmount = 0) {
      decor.update(t);
      const raining = weather === "rain";
      updateGrassWind(t);
      dust.points.visible = weather === "sunny";
      if (dust.points.visible) dust.update(t);
      rain.mesh.visible = raining;
      if (raining) rain.update(t, player);
      river.update(t, weather, player, swimAmount);
      const dt = Math.min(0.1, Math.max(0, t - lastTime));
      mill.rotor.rotation.z += dt * (raining ? 0.85 : weather === "cloudy" ? 0.53 : 0.28);
      lastTime = t;
    },
  };
}
