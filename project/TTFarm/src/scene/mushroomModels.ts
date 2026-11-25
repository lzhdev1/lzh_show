import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MushroomShape, MushroomSpecies } from "../game/mushrooms";

/**
 * 软胶/乙烯基菌类模型（海岛乐园式柔和）：
 * 平滑法线 + Catmull-Rom 样条圆剖面 + 柔和高光 Physical 材质 + 分层顶点色/AO。
 * 所有物种共用“菌柄 + 菌褶/孔面 + 菌环 + 菌盖”骨架，shape 决定轮廓、pattern 决定细节。
 * 每只合并成单一几何（1 draw call），在原点脚底生成，由场景按宿主缩放。
 */
const BASE_RADIUS = 0.34;
const WHITE = new THREE.Color(0xffffff);
const BLACK = new THREE.Color(0x000000);

function softMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}) {
  // 每只独立材质：disposeActor 会逐只释放，不能共享缓存
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true, flatShading: false, roughness: 0.45, metalness: 0,
    clearcoat: 0.2, clearcoatRoughness: 0.55, side: THREE.DoubleSide,
    emissive: opts.emissive ?? "#000000", emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
  });
}

const C = (h: string) => new THREE.Color(h);
const lighter = (c: THREE.Color, t: number) => c.clone().lerp(WHITE, t);
const darker = (c: THREE.Color, t: number) => c.clone().lerp(BLACK, t);

function lerpStops(stops: Array<[number, THREE.Color]>, t: number) {
  const lo = stops[0][0], hi = stops[stops.length - 1][0];
  t = Math.max(lo, Math.min(hi, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i], [b, cb] = stops[i + 1];
    if (t >= a && t <= b) return ca.clone().lerp(cb, (t - a) / (b - a || 1));
  }
  return stops[stops.length - 1][1].clone();
}

/** 逐面上色 + 轻微抖动：柔和的手绘色块过渡 */
function paintFaces(geo: THREE.BufferGeometry, fn: (c: THREE.Vector3, f: number) => THREE.Color, jitter = 0.02) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const cen = new THREE.Vector3(), v = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    cen.set(0, 0, 0);
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, f + k); cen.add(v); }
    cen.multiplyScalar(1 / 3);
    const col = fn(cen, f / 3).multiplyScalar(1 + Math.sin(f * 12.9898) * 0.5 * jitter);
    for (let k = 0; k < 3; k++) { colors[(f + k) * 3] = col.r; colors[(f + k) * 3 + 1] = col.g; colors[(f + k) * 3 + 2] = col.b; }
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  return g;
}
const solid = (geo: THREE.BufferGeometry, col: THREE.Color, j = 0.02) => paintFaces(geo, () => col.clone(), j);

/** 样条平滑剖面 + 高段数：剪影圆润、法线连续 */
function smoothProfile(pts: Array<[number, number]>, samples = 16) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "catmullrom", 0.5);
  return curve.getPoints(samples).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
}
const lathe = (pts: Array<[number, number]>, seg = 24) => new THREE.LatheGeometry(smoothProfile(pts), seg);

function radialStripes(geo: THREE.BufferGeometry, a: THREE.Color, b: THREE.Color, n: number) {
  return paintFaces(geo, c => (Math.floor((Math.atan2(c.z, c.x) + Math.PI) / (Math.PI * 2 / n)) % 2 ? a.clone() : b.clone()), 0.02);
}

function gillUnder(R: number, H: number, gill: THREE.Color) {
  const u = lathe([[0.04, -0.02], [R * 0.88, -0.045], [R * 0.76, -0.085]], 22);
  const p = radialStripes(u, gill, darker(gill, 0.22), 22);
  p.translate(0, H, 0);
  return p;
}
function poreUnder(R: number, H: number, pore: THREE.Color) {
  const u = lathe([[0.04, -0.02], [R * 0.9, -0.04], [R * 0.8, -0.07]], 16);
  u.translate(0, H, 0);
  return solid(u, pore, 0.02);
}
function stemPart(H: number, stem: THREE.Color) {
  const g = lathe([[0.095, 0], [0.105, 0.05], [0.068, 0.16], [0.062, 0.26], [0.08, 0.34], [0.085, H]], 16);
  return paintFaces(g, c => lerpStops([[0, darker(stem, 0.15)], [0.5, stem], [1, lighter(stem, 0.1)]], c.y / H));
}
function ringCollar(y: number, r: number, col: THREE.Color) {
  return solid(lathe([[r * 0.8, y], [r * 1.15, y - 0.018], [r * 0.95, y - 0.036]], 12), col);
}
function volva(col: THREE.Color) {
  const b = new THREE.IcosahedronGeometry(0.12, 1); b.scale(1, 0.82, 1); b.translate(0, 0.05, 0);
  return solid(b, col, 0.03);
}
function warts(R: number, H: number, topY: number, col: THREE.Color, count: number, seed: number) {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = seed + i * 2.399, d = Math.sqrt((i + 0.5) / count) * R * 0.74, t = d / R;
    const y = H + topY * (1 - t * t * 0.8) + 0.012;
    const s = new THREE.IcosahedronGeometry(0.04, 1); s.scale(1, 0.38, 1);
    s.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    out.push(solid(s, col, 0.02));
  }
  return out;
}

function capProfile(shape: MushroomShape, R: number, top: number): Array<[number, number]> {
  switch (shape) {
    case "flat": return [[0, top], [0.14, top * 0.9], [0.28, top * 0.55], [R * 0.98, 0.02], [R, -0.01], [R * 0.88, 0.01]];
    case "bell": return [[0, top], [0.10, top * 0.9], [0.18, top * 0.62], [0.24, top * 0.25], [R * 0.8, -0.02], [R * 0.7, -0.05]];
    case "cone": return [[0, top], [0.09, top * 0.78], [0.18, top * 0.42], [0.28, top * 0.1], [R * 0.9, -0.02], [R * 0.8, -0.04]];
    case "wax": return [[0, top], [0.11, top * 0.86], [0.23, top * 0.5], [R * 0.95, 0.02], [R, -0.01], [R * 0.86, -0.03]];
    case "umbrella":
    default: return [[0, top], [0.11, top * 0.94], [0.21, top * 0.8], [0.30, top * 0.5], [R * 0.98, 0.05], [R, -0.01], [R * 0.86, -0.05]];
  }
}
function capTopFor(shape: MushroomShape) {
  if (shape === "flat") return 0.13;
  if (shape === "bell") return 0.34;
  if (shape === "cone") return 0.36;
  if (shape === "wax") return 0.18;
  return 0.32;
}

export function createMushroomModel(species: MushroomSpecies) {
  const cap = C(species.cap), stem = C(species.stem), gill = C(species.gill), accent = C(species.accent);
  const glow = species.pattern === "glow";
  const jelly = species.shape === "jelly";
  const material = softMaterial({
    emissive: glow ? species.accent : undefined,
    emissiveIntensity: glow ? 0.5 : 0,
    transparent: jelly, opacity: jelly ? 0.6 : 1,
  });
  const seed = (species.name.length * 7 + parseInt(species.id.slice(1), 10) * 13) % 97 / 97;
  const parts: THREE.BufferGeometry[] = [];
  const H = 0.34 + seed * 0.06;
  const R = BASE_RADIUS * (0.85 + seed * 0.2);

  if (species.shape === "coral") {
    const branch = new THREE.CylinderGeometry(0.024, 0.04, 0.22, 8);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.1;
      const b = branch.clone();
      b.translate(Math.cos(a) * 0.08, 0.1 + (i % 3) * 0.06, Math.sin(a) * 0.08);
      b.rotateZ(Math.cos(a) * 0.4); b.rotateX(-Math.sin(a) * 0.4);
      parts.push(solid(b, i % 2 ? accent : stem, 0.03));
    }
    const tip = new THREE.IcosahedronGeometry(0.04, 1);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7; const t = tip.clone();
      t.translate(Math.cos(a) * 0.16, 0.3 + (i % 2) * 0.05, Math.sin(a) * 0.16);
      parts.push(solid(t, accent, 0.02));
    }
  } else if (species.shape === "puff") {
    const b = new THREE.IcosahedronGeometry(BASE_RADIUS * 0.72, 2); b.scale(1, 0.9, 1); b.translate(0, 0.24, 0);
    parts.push(solid(b, cap, 0.03));
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399, ph = Math.acos(1 - 2 * ((i + 0.5) / 14));
      const d = new THREE.Vector3(Math.sin(ph) * Math.cos(a), Math.cos(ph), Math.sin(ph) * Math.sin(a));
      if (d.y < -0.2) continue;
      const s = new THREE.ConeGeometry(0.018, 0.045, 6); s.translate(0, 0.022, 0);
      s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
      s.translate(d.x * 0.23, 0.24 + d.y * 0.21, d.z * 0.23);
      parts.push(solid(s, darker(cap, 0.12), 0.02));
    }
    const stub = new THREE.CylinderGeometry(0.08, 0.11, 0.1, 10); stub.translate(0, 0.05, 0);
    parts.push(solid(stub, darker(stem, 0.1), 0.02));
  } else if (species.shape === "fan") {
    const fan = new THREE.CylinderGeometry(R, R * 0.9, 0.05, 20, 1, false, 0, Math.PI);
    parts.push(paintFaces(fan, c => lerpStops([[0, darker(cap, 0.3)], [0.4, cap], [0.75, lighter(cap, 0.2)], [1, lighter(cap, 0.45)]], Math.hypot(c.x, c.z) / R), 0.02));
    const under = new THREE.CylinderGeometry(R * 0.92, R * 0.84, 0.015, 20, 1, false, 0, Math.PI);
    under.translate(0, -0.03, 0);
    parts.push(solid(under, gill, 0.02));
    const knob = new THREE.IcosahedronGeometry(0.07, 1); knob.translate(0, 0, -0.02);
    parts.push(solid(knob, darker(cap, 0.3), 0.02));
    for (const p of parts) p.translate(0, 0.24, 0);
  } else if (species.shape === "cup") {
    const bowl = lathe([[0.06, 0], [0.22, 0.05], [0.30, 0.15], [0.26, 0.21], [0.17, 0.16]], 20);
    bowl.translate(0, H * 0.5, 0);
    parts.push(solid(bowl, cap, 0.02));
    const inner = lathe([[0.02, 0.03], [0.18, 0.08], [0.24, 0.14]], 20);
    inner.translate(0, H * 0.5 + 0.004, 0);
    parts.push(solid(inner, gill, 0.02));
    const st = new THREE.CylinderGeometry(0.05, 0.07, H * 0.5, 10); st.translate(0, H * 0.25, 0);
    parts.push(solid(st, stem, 0.02));
  } else if (species.shape === "morel") {
    parts.push(stemPart(H * 0.75, stem));
    const top = 0.34;
    const cp = lathe([[0, top], [0.09, top * 0.9], [0.15, top * 0.66], [0.19, top * 0.36], [R * 0.6, 0.02], [R * 0.55, 0]], 16);
    const cpp = paintFaces(cp, () => darker(cap, 0.35), 0.03); cpp.translate(0, H * 0.75, 0);
    parts.push(cpp);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const b = new THREE.BoxGeometry(0.018, top * 0.95, 0.018);
      b.translate(R * 0.4, top * 0.5, 0); b.rotateY(a); b.translate(0, H * 0.75, 0);
      parts.push(solid(b, cap, 0.02));
    }
    for (let k = 0; k < 3; k++) {
      const t = new THREE.TorusGeometry(R * (0.5 - k * 0.13), 0.012, 6, 14);
      t.rotateX(Math.PI / 2); t.translate(0, H * 0.75 + 0.06 + k * 0.1, 0);
      parts.push(solid(t, cap, 0.02));
    }
  } else {
    // 伞菌类（umbrella/bell/flat/cone/wax/tooth/jelly）
    parts.push(stemPart(H, stem));
    parts.push(volva(darker(stem, 0.12)));
    if (species.pattern === "ring") parts.push(ringCollar(0.24, 0.085, lighter(stem, 0.15)));
    const top = capTopFor(species.shape);
    const cp = lathe(capProfile(species.shape, R, top), 24);
    const cpp = paintFaces(cp, c => lerpStops([[-0.2, gill], [0.12, darker(cap, 0.18)], [0.5, cap], [1, lighter(cap, 0.18)]], c.y / top), 0.025);
    cpp.translate(0, H, 0);
    parts.push(cpp);
    parts.push(species.shape === "cone" ? poreUnder(R, H, lighter(gill, 0.1)) : gillUnder(R, H, gill));
    if (species.pattern === "spots") parts.push(...warts(R, H, top, accent, 8, seed * 9));
    if (species.pattern === "scales") parts.push(...warts(R, H, top, lighter(cap, 0.35), 10, seed * 5));
    if (species.pattern === "striate") {
      const band = new THREE.TorusGeometry(R * 0.8, 0.008, 6, 24);
      band.rotateX(Math.PI / 2); band.translate(0, H + 0.012, 0);
      parts.push(solid(band, accent, 0.02));
    }
    if (species.shape === "tooth") {
      const tooth = new THREE.ConeGeometry(0.012, 0.07, 6);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2; const t = tooth.clone();
        t.rotateX(Math.PI); t.translate(Math.cos(a) * R * 0.6, H - 0.05, Math.sin(a) * R * 0.6);
        parts.push(solid(t, accent, 0.02));
      }
    }
  }

  const merged = mergeGeometries(parts, false);
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.y = seed * Math.PI * 2;
  group.rotation.z = (seed - 0.5) * 0.08;
  group.scale.setScalar(species.size / BASE_RADIUS);
  group.userData.speciesId = species.id;
  return group;
}

export function createMushroomGlow(color: string, radius: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, `${color}88`);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(radius);
  return sprite;
}

export type MushroomModel = ReturnType<typeof createMushroomModel>;
