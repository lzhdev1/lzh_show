import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { FishingRod, FishSpecies } from "../game/fish";
import { FISH_LIST } from "../game/fish";
import { RIVER_BED, RIVER_POINTS } from "./layout";

/** 河鱼：50 种鱼全部在河道里自由巡游。几何与材质按物种缓存，每条鱼只做轻量位姿更新。 */
interface FishInstance {
  species: FishSpecies;
  root: THREE.Group;
  tail: THREE.Object3D;
  s: number;
  dir: number;
  speed: number;
  lateral: number;
  phase: number;
  size: number;
  /** 鱼体中心在水面以下的深度，按体型计算，保证背鳍也不会露出水面 */
  depth: number;
  /** 水面上的淡淡鱼影，让水下鱼群在不露背的情况下仍然可读 */
  shadow?: THREE.Mesh;
}

const WATER_Y = RIVER_BED.waterY;
const MAX_INDEX = RIVER_POINTS.length - 1;
const geometryCache = new Map<string, { body: THREE.BufferGeometry; tail: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }>();

function profile(u: number, body: FishSpecies["visual"]["body"]) {
  const sine = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
  switch (body) {
    case "slender": return Math.pow(sine, 0.56) * (0.94 - 0.18 * Math.abs(u - 0.42));
    case "round": return Math.pow(sine, 0.72) * (1.02 - 0.08 * Math.abs(u - 0.5));
    case "flat": return Math.pow(sine, 0.78) * (1.04 - 0.12 * Math.abs(u - 0.46));
    case "deep": return Math.pow(sine, 0.6) * (1.02 - 0.06 * Math.abs(u - 0.48));
    case "eel": return Math.pow(sine, 0.34) * (0.86 - 0.28 * u);
    case "puffer": return Math.pow(sine, 0.9) * 1.06;
    case "sturgeon": return Math.pow(sine, 0.48) * (0.86 - 0.34 * u);
    default: return sine;
  }
}

function widthFactor(body: FishSpecies["visual"]["body"]) {
  switch (body) {
    case "flat": return 0.48;
    case "deep": return 0.68;
    case "puffer": return 0.96;
    case "round": return 0.8;
    case "eel": return 0.58;
    case "sturgeon": return 0.66;
    default: return 0.56;
  }
}

function bodyColor(fish: FishSpecies, u: number, vertical: number, theta: number, out: THREE.Color) {
  const p = new THREE.Color(fish.visual.primary);
  const s = new THREE.Color(fish.visual.secondary);
  const b = new THREE.Color(fish.visual.belly);
  const a = new THREE.Color(fish.visual.accent);
  let base = p;
  const band = Math.sin(u * 38 + theta * 1.3);
  switch (fish.visual.pattern) {
    case "stripe":
      if (Math.sin(u * Math.PI * 11.5 + 0.4) > 0.42) base = s;
      break;
    case "spot":
      if (Math.sin(u * 52 + theta * 4.2) * Math.sin(theta * 3.3 + u * 21) > 0.42) base = a;
      break;
    case "patch":
      if (Math.sin(u * 13 + theta * 2.4 + 0.8) + Math.sin(u * 31 - theta * 3.8) > 0.75) base = s;
      break;
    case "scale":
      if (band > 0.83) base = a;
      else if (band < -0.8) base = s;
      break;
    case "glow":
      base = a.clone().lerp(p, Math.max(0, Math.min(1, Math.abs(vertical) * 0.6)));
      break;
    case "gradient":
      base = s.clone().lerp(p, Math.max(0, Math.min(1, (vertical + 0.5) * 0.85)));
      break;
    default:
      base = p;
  }
  if (vertical < -0.18) base = base.clone().lerp(b, Math.min(1, (-vertical - 0.18) * 1.7));
  return out.copy(base);
}

function buildBody(fish: FishSpecies) {
  const segs = 30, radial = 12;
  const wf = widthFactor(fish.visual.body);
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const tmp = new THREE.Color();
  for (let i = 0; i <= segs; i += 1) {
    const u = i / segs;
    const x = 0.5 - u;
    const pr = profile(u, fish.visual.body);
    const ry = Math.max(0.002, fish.visual.girth * 0.5 * pr);
    const rz = Math.max(0.0015, ry * wf);
    for (let j = 0; j < radial; j += 1) {
      const theta = (j / radial) * Math.PI * 2;
      const py = Math.cos(theta) * ry;
      const pz = Math.sin(theta) * rz;
      positions.push(x, py, pz);
      bodyColor(fish, u, Math.cos(theta), theta, tmp);
      // 头部和尾柄略提亮，鳞光更容易在河水里读出来
      const rim = 0.9 + 0.16 * Math.pow(Math.sin(u * Math.PI), 0.35);
      colors.push(tmp.r * rim, tmp.g * rim, tmp.b * rim);
    }
  }
  for (let i = 0; i < segs; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addFlatFin(parts: THREE.BufferGeometry[], points: Array<[number, number, number]>, color: THREE.Color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: points.length }, () => [color.r, color.g, color.b]).flat(), 3));
  g.setIndex(points.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
  g.computeVertexNormals();
  parts.push(g);
}

function buildBodyParts(fish: FishSpecies) {
  const parts: THREE.BufferGeometry[] = [];
  const fin = new THREE.Color(fish.visual.fin);
  const accent = new THREE.Color(fish.visual.accent);
  const eye = new THREE.Color(fish.visual.eye);
  const girth = fish.visual.girth;
  // 背鳍、臀鳍与胸鳍：薄三角片，双面材质
  addFlatFin(parts, [
    [0.20, girth * 0.52, 0], [-0.04, girth * 0.95, 0], [-0.14, girth * 0.5, 0],
  ], fin);
  addFlatFin(parts, [
    [-0.02, -girth * 0.48, 0], [-0.24, -girth * 0.7, 0], [-0.48, -girth * 0.36, 0],
  ], fin);
  addFlatFin(parts, [
    [0.25, 0.015, girth * 0.46], [0.09, girth * 0.08, girth * 0.9], [-0.04, -0.02, girth * 0.64],
  ], accent);
  addFlatFin(parts, [
    [0.25, 0.015, -girth * 0.46], [0.09, girth * 0.08, -girth * 0.9], [-0.04, -0.02, -girth * 0.64],
  ], accent);
  if (fish.visual.body === "puffer" || fish.visual.body === "sturgeon") {
    const spikeColor = new THREE.Color(fish.visual.secondary);
    for (let i = 0; i < 16; i += 1) {
      const u = 0.16 + (i / 16) * 0.7;
      const theta = Math.PI / 2 + (i % 2 ? 0.65 : -0.65);
      const x = 0.5 - u, ry = girth * 0.5 * profile(u, fish.visual.body);
      const base = new THREE.Vector3(x, Math.cos(theta) * ry, Math.sin(theta) * (ry * widthFactor(fish.visual.body)));
      const tip = base.clone().add(new THREE.Vector3(0, 0.55 * ry, Math.sin(theta) * 0.55 * ry)).multiplyScalar(1.12);
      const cone = new THREE.ConeGeometry(Math.max(0.004, ry * 0.12), Math.max(0.012, ry * 0.65), 4);
      cone.translate(0, Math.max(0.012, ry * 0.65) / 2, 0);
      cone.lookAt(new THREE.Vector3(0, 0, 0));
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.sub(base).normalize()));
      cone.translate(base.x, base.y, base.z);
      const cg = cone.toNonIndexed();
      const col = new Float32Array(cg.attributes.position.count * 3);
      for (let k = 0; k < col.length; k += 3) { col[k] = spikeColor.r; col[k + 1] = spikeColor.g; col[k + 2] = spikeColor.b; }
      cg.setAttribute("color", new THREE.BufferAttribute(col, 3));
      parts.push(cg);
    }
  }
  // 眼睛：黑瞳 + 一点白色高光
  const eyeR = Math.max(0.011, girth * 0.032);
  for (const side of [-1, 1]) {
    const sph = new THREE.SphereGeometry(eyeR, 8, 6);
    const ry = girth * 0.5 * profile(0.2, fish.visual.body);
    sph.translate(0.3, ry * 0.32, side * ry * widthFactor(fish.visual.body) * 0.86);
    const eg = sph.toNonIndexed();
    const col = new Float32Array(eg.attributes.position.count * 3);
    for (let k = 0; k < col.length; k += 3) { col[k] = eye.r; col[k + 1] = eye.g; col[k + 2] = eye.b; }
    eg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(eg);
    const hi = new THREE.SphereGeometry(eyeR * 0.28, 6, 4);
    hi.translate(0.305, ry * 0.33, side * ry * widthFactor(fish.visual.body) * 0.89);
    const hg = hi.toNonIndexed();
    const hc = new Float32Array(hg.attributes.position.count * 3).fill(1);
    hg.setAttribute("color", new THREE.BufferAttribute(hc, 3));
    parts.push(hg);
  }
  // 胡须：两根细圆柱，向后外侧飘
  if ((fish.visual.whiskers ?? 0) > 0) {
    const wl = fish.visual.whiskers!;
    for (const side of [-1, 1]) {
      const cyl = new THREE.CylinderGeometry(0.0045, 0.003, wl, 5, 1);
      cyl.rotateZ(Math.PI / 2);
      cyl.translate(wl / 2, 0, 0);
      cyl.rotateY(side * 0.38 * Math.PI);
      cyl.translate(0.47, -0.01, side * 0.012);
      const g = cyl.toNonIndexed();
      const col = new Float32Array(g.attributes.position.count * 3);
      const bc = new THREE.Color(fish.visual.secondary);
      for (let k = 0; k < col.length; k += 3) { col[k] = bc.r; col[k + 1] = bc.g; col[k + 2] = bc.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      parts.push(g);
    }
  }
  return parts;
}

function buildTail(fish: FishSpecies) {
  const len = fish.visual.body === "eel" ? 0.2 : fish.visual.body === "puffer" ? 0.1 : 0.22;
  const spread = fish.visual.body === "puffer" ? 0.11 : fish.visual.body === "deep" ? 0.22 : 0.17;
  const points: Array<[number, number, number]> = [];
  const color: number[] = [];
  const c = new THREE.Color(fish.visual.fin);
  const accent = new THREE.Color(fish.visual.accent);
  const push = (x: number, y: number, z: number, tint: THREE.Color = c) => {
    points.push([x, y, z]);
    color.push(tint.r, tint.g, tint.b);
  };
  const shape = fish.visual.tail;
  if (shape === "fork") {
    push(0, 0, 0);
    push(-len * 0.68, spread, 0, accent);
    push(-len * 1.35, spread * 0.52, 0);
    push(-len * 0.5, -spread, 0, accent);
    push(-len * 1.35, -spread * 0.52, 0);
    push(-len * 0.52, 0, 0);
  } else if (shape === "ribbon") {
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      push(-len * 1.7, Math.sin(Math.PI * t) * spread * 1.6, 0, c.clone().lerp(accent, t));
      push(-len * 1.7, -Math.sin(Math.PI * t) * spread * 1.6, 0, accent);
    }
  } else if (shape === "crescent") {
    push(0, 0, 0);
    push(-len * 0.8, spread * 1.45, 0, accent);
    push(-len * 1.55, spread * 0.9, 0);
    push(-len * 0.8, -spread * 0.75, 0);
    push(-len * 1.25, -spread * 0.45, 0);
    push(-len * 0.55, 0, 0);
  } else {
    const edges = shape === "round" ? 0.72 : 1;
    push(0, 0, 0);
    for (let i = 0; i <= 7; i += 1) {
      const t = i / 7;
      const angle = (t - 0.5) * Math.PI * 1.05;
      push(-len * 1.35, Math.sin(angle) * spread * edges, 0, i % 2 ? accent : c);
      push(-len * 1.35, -Math.sin(angle) * spread * edges, 0, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  const idx: number[] = [];
  if (shape === "fork") {
    idx.push(0, 1, 2, 0, 2, 5, 0, 5, 4, 0, 4, 3);
  } else if (shape === "ribbon") {
    for (let i = 0; i < 12; i += 2) idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
  } else if (shape === "crescent") {
    idx.push(0, 1, 2, 0, 2, 5, 0, 5, 4, 0, 4, 3);
  } else {
    for (let i = 1; i < points.length - 1; i += 2) idx.push(0, i, i + 1);
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function fishAssets(fish: FishSpecies) {
  const cached = geometryCache.get(fish.id);
  if (cached) return cached;
  const bodyBase = buildBody(fish);
  const body = mergeOrSelf([bodyBase, ...buildBodyParts(fish)]);
  body.computeVertexNormals();
  const tail = buildTail(fish);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.34, metalness: 0.16, side: THREE.DoubleSide,
    emissive: new THREE.Color(fish.visual.accent), emissiveIntensity: (fish.visual.glow ?? 0) * 0.45,
  });
  const assets = { body, tail, material };
  geometryCache.set(fish.id, assets);
  return assets;
}

function mergeOrSelf(parts: THREE.BufferGeometry[]) {
  if (parts.length === 1) return parts[0];
  // 身体是索引几何、鳍和眼睛是无索引几何，先统一成无索引并只保留 position/normal/color，
  // 否则 mergeGeometries 会因属性表不一致返回 null。
  const cleaned = parts.map((part) => {
    const geo = part.index ? part.toNonIndexed() : part;
    for (const name of Object.keys(geo.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "color") geo.deleteAttribute(name);
    }
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    return geo;
  });
  const merged = mergeGeometries(cleaned, false);
  if (!merged) {
    cleaned.forEach((geo, index) => { if (index > 0 && geo !== parts[index]) geo.dispose(); });
    return cleaned[0];
  }
  parts.forEach((part) => part.dispose());
  cleaned.forEach((geo) => { if (!parts.includes(geo)) geo.dispose(); });
  return merged;
}

/** 让鱼体连同背鳍最高点都沉在水面下；大鱼按体高自动加深，避免鳍尖穿出水面。 */
function swimDepth(species: FishSpecies, size: number) {
  // 背鳍最高点约 0.95×体高，取整个体高再加一点余量。
  return species.visual.girth * size + 0.055 + Math.random() * 0.06;
}

function createFish(species: FishSpecies): FishInstance {
  const { body, tail, material } = fishAssets(species);
  const root = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body, material);
  bodyMesh.renderOrder = 3;
  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.5, 0, 0);
  const tailMesh = new THREE.Mesh(tail, material);
  tailMesh.renderOrder = 3;
  tailGroup.add(tailMesh);
  root.add(bodyMesh, tailGroup);
  return {
    species, root, tail: tailGroup,
    s: 0, dir: 1, speed: 0.2, lateral: 0,
    phase: 0, size: 1, depth: 0.18,
  };
}

function sampleRiver(index: number, out: THREE.Vector3) {
  const a = Math.max(0, Math.min(MAX_INDEX - 1, Math.floor(index)));
  const t = Math.max(0, Math.min(1, index - a));
  const p = RIVER_POINTS[a], q = RIVER_POINTS[a + 1];
  return out.set(p.x + (q.x - p.x) * t, WATER_Y, p.z + (q.z - p.z) * t);
}

function tangentAt(index: number, out: THREE.Vector3) {
  const i = Math.max(1, Math.min(MAX_INDEX - 1, Math.round(index)));
  return out.set(RIVER_POINTS[i + 1].x - RIVER_POINTS[i - 1].x, 0, RIVER_POINTS[i + 1].z - RIVER_POINTS[i - 1].z).normalize();
}

export interface RiverFishScene {
  group: THREE.Group;
  update: (dt: number, elapsed: number, player: THREE.Vector3) => void;
  dispose: () => void;
}

export function createRiverFishScene(): RiverFishScene {
  const group = new THREE.Group();
  group.name = "river-fish-school";
  const fish: FishInstance[] = [];
  const v = new THREE.Vector3();
  const t = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const playerNear = new THREE.Vector3();
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x123b3b, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  });

  const addFish = (species: FishSpecies) => {
    const instance = createFish(species);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.renderOrder = 2;
    shadow.rotation.y = Math.random() * Math.PI;
    instance.shadow = shadow;
    group.add(instance.root, shadow);
    fish.push(instance);
    return instance;
  };

  // 50 种鱼各放一条，沿整条河均匀铺开；再补几条常见鱼，让近岸不至于太空
  FISH_LIST.forEach((species, i) => {
    const instance = addFish(species);
    instance.s = (i / FISH_LIST.length) * MAX_INDEX + (Math.random() - 0.5) * 2.2;
    instance.dir = Math.random() < 0.5 ? 1 : -1;
    instance.speed = 0.11 + Math.random() * 0.22;
    instance.lateral = (Math.random() - 0.5) * 8.4;
    instance.phase = Math.random() * Math.PI * 2;
    instance.size = species.visual.length * (0.86 + Math.random() * 0.28);
    instance.depth = swimDepth(species, instance.size);
    instance.root.scale.setScalar(instance.size);
  });
  // 近距离补充：常见鱼和小鱼群，放在农场附近的河段
  for (let i = 0; i < 18; i += 1) {
    const species = FISH_LIST[Math.floor(Math.random() * 20)];
    const instance = addFish(species);
    instance.s = 68 + Math.random() * 28;
    instance.dir = Math.random() < 0.5 ? 1 : -1;
    instance.speed = 0.14 + Math.random() * 0.25;
    instance.lateral = (Math.random() - 0.5) * 10;
    instance.phase = Math.random() * Math.PI * 2;
    instance.size = species.visual.length * (0.82 + Math.random() * 0.24);
    instance.depth = swimDepth(species, instance.size);
    instance.root.scale.setScalar(instance.size);
  }

  const update = (dt: number, elapsed: number, player: THREE.Vector3) => {
    playerNear.copy(player);
    for (const item of fish) {
      item.s += item.dir * item.speed * dt * 1.35;
      if (item.s > MAX_INDEX - 2) { item.s = MAX_INDEX - 2; item.dir = -1; }
      if (item.s < 2) { item.s = 2; item.dir = 1; }
      sampleRiver(item.s, v);
      tangentAt(item.s, t);
      // 侧向摆到河道内，避免鱼贴岸或钻进河床
      const lateral = item.lateral + Math.sin(elapsed * 0.34 + item.phase) * 1.2;
      const nx = -t.z, nz = t.x;
      v.x += nx * lateral * 0.46;
      v.z += nz * lateral * 0.46;
      // 鱼真正在水下游：按体高算中心深度，背鳍也留在水面以下；
      // 只在深浅之间做很小的起伏，不再把鱼背抬出水面当可见性补丁。
      const bob = Math.sin(elapsed * 0.62 + item.phase) * 0.018;
      item.root.position.set(v.x, WATER_Y - item.depth + bob, v.z);
      item.root.rotation.y = Math.atan2(-t.z, t.x) + (item.dir < 0 ? Math.PI : 0);
      item.root.rotation.x = Math.sin(elapsed * 0.9 + item.phase) * 0.035;
      item.root.rotation.z = Math.sin(elapsed * 1.7 + item.phase) * 0.07;
      // 靠镜头太远的鱼缩到极小，减少填满水面的碎点
      tmp.copy(item.root.position).sub(playerNear);
      const dist = tmp.length();
      const visible = dist < 110;
      item.root.visible = visible;
      if (item.shadow) {
        item.shadow.visible = visible && dist < 72;
        item.shadow.position.set(v.x, WATER_Y + 0.006, v.z);
        item.shadow.rotation.y = item.root.rotation.y;
        item.shadow.scale.set(item.size * 0.92, 1, item.size * 0.30);
      }
      item.tail.rotation.y = Math.sin(elapsed * (4.4 + item.speed * 13) + item.phase) * 0.42;
    }
  };

  const dispose = () => {
    fish.forEach((item) => {
      item.shadow?.removeFromParent();
      item.root.removeFromParent();
    });
    shadowGeometry.dispose();
    shadowMaterial.dispose();
    geometryCache.forEach(({ body, tail, material }) => {
      body.dispose(); tail.dispose(); material.dispose();
    });
    geometryCache.clear();
  };

  return { group, update, dispose };
}

/** 给钓鱼场景用的鱼竿模型：不同鱼竿有不同竿色与导环。 */
export interface RodAsset {
  group: THREE.Group;
  tip: THREE.Object3D;
  base: THREE.Object3D;
  set: (rod: FishingRod) => void;
  dispose: () => void;
}

export function createRodAsset(): RodAsset {
  const group = new THREE.Group();
  const base = new THREE.Object3D();
  base.position.set(0, 0, 0);
  const lower = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.y = 1.15;
  upper.rotation.x = 0.12;
  const tip = new THREE.Object3D();
  tip.position.y = 1.55;
  upper.add(tip);
  lower.add(upper);

  const wood = new THREE.MeshStandardMaterial({ color: "#b98b4e", roughness: 0.62, metalness: 0.12 });
  const wrap = new THREE.MeshStandardMaterial({ color: "#59422b", roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: "#d8e2dc", roughness: 0.3, metalness: 0.7 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.016, 1.15, 7), wood);
  shaft.position.y = 0.575;
  const shaft2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.007, 1.55, 7), wood);
  shaft2.position.y = 0.775;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.025, 0.34, 8), wrap);
  grip.position.y = 0.18;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.028, 14), metal);
  reel.rotation.x = Math.PI / 2;
  reel.position.set(0, 0.22, -0.034);
  const reelKnob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 7, 5), metal);
  reelKnob.position.set(0.035, 0.22, -0.034);
  lower.add(shaft, grip, reel, reelKnob);
  upper.add(shaft2);
  base.add(lower);
  group.add(base);

  const guides: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i += 1) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(0.0065 + i * 0.0015, 0.0012, 4, 8), metal);
    g.position.set(0, 0.42 + i * 0.33, 0.012);
    g.rotation.x = Math.PI / 2;
    upper.add(g);
    guides.push(g);
  }

  let current = "";
  const set = (rod: FishingRod) => {
    if (current === rod.id) return;
    current = rod.id;
    (wood as THREE.MeshStandardMaterial).color.set(rod.color);
    (wrap as THREE.MeshStandardMaterial).color.set(rod.color).multiplyScalar(0.55);
    (metal as THREE.MeshStandardMaterial).color.set(rod.accent);
  };

  const dispose = () => {
    group.removeFromParent();
    [wood, wrap, metal].forEach((m) => m.dispose());
    group.traverse((node) => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
  };

  return { group, tip, base, set, dispose };
}
