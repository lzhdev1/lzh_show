import * as THREE from "three";
import type { MushroomShape, MushroomSpecies } from "../game/mushrooms";

/**
 * 程序化菌类模型：所有物种共用一套“菌柄 + 菌褶 + 菌环 + 菌盖”骨架，
 * shape 决定菌盖轮廓，pattern 决定斑点、环纹、鳞片或发光。
 * 每个模型在原点脚底生成，最终由场景按宿主高度缩放。
 */
const BASE_RADIUS = 0.34;

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function paint(color: string, opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; opacity?: number; transparent?: boolean } = {}) {
  const key = `${color}:${opts.roughness ?? 0.7}:${opts.metalness ?? 0}:${opts.emissive ?? ""}:${opts.emissiveIntensity ?? 0}:${opts.opacity ?? 1}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: THREE.DoubleSide,
  });
  materialCache.set(key, material);
  return material;
}

function lathe(points: Array<[number, number]>, segments = 18) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

function addMesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

/** 菌褶：一圈从中心散到边缘的薄片，合并成一个几何，避免每个褶一片 draw call。 */
function gillMesh(radius: number, material: THREE.Material) {
  const pieces: THREE.BufferGeometry[] = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    const box = new THREE.BoxGeometry(radius * 0.90, 0.012, 0.018);
    box.translate(radius * 0.47, 0, 0);
    box.rotateY(angle);
    pieces.push(box);
  }
  const merged = merge(pieces);
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = false;
  return mesh;
}

function merge(pieces: THREE.BufferGeometry[]) {
  // BoxGeometry 等内置几何是带 index 的，直接拷 position 会让 36 个顶点当 24 个用，
  // 三角形索引就错位。先摊平 index，再按顶点顺序拼成一份非索引几何。
  const flat = pieces.map((piece) => piece.index ? piece.toNonIndexed() : piece);
  const merged = new THREE.BufferGeometry();
  let positions = 0;
  let hasUv = true;
  for (const piece of flat) {
    positions += piece.getAttribute("position").count;
    if (!piece.getAttribute("uv")) hasUv = false;
  }
  const array = new Float32Array(positions * 3);
  const normals = new Float32Array(positions * 3);
  const uvs = hasUv ? new Float32Array(positions * 2) : null;
  let offset = 0;
  for (const piece of flat) {
    const position = piece.getAttribute("position");
    const normal = piece.getAttribute("normal");
    array.set(position.array as Float32Array, offset * 3);
    normals.set(normal.array as Float32Array, offset * 3);
    if (uvs) uvs.set(piece.getAttribute("uv").array as Float32Array, offset * 2);
    offset += position.count;
  }
  merged.setAttribute("position", new THREE.BufferAttribute(array, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  if (uvs) merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  for (const piece of flat) if (!pieces.includes(piece)) piece.dispose();
  for (const piece of pieces) piece.dispose();
  return merged;
}

function capDome(shape: MushroomShape) {
  switch (shape) {
    case "bell":
      return new THREE.SphereGeometry(BASE_RADIUS, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
    case "flat":
      return lathe([[0, 0.11], [0.15, 0.095], [0.34, 0.035], [0.42, -0.005], [0.39, -0.04]]);
    case "cone":
      return lathe([[0, 0.27], [0.10, 0.16], [0.22, 0.05], [0.35, -0.02], [0.31, -0.055]]);
    case "morel":
      return lathe([[0, 0.35], [0.11, 0.25], [0.18, 0.12], [0.25, 0.00], [0.31, -0.05]]);
    case "wax":
      return lathe([[0, 0.18], [0.11, 0.12], [0.23, 0.04], [0.33, -0.01], [0.30, -0.04]]);
    case "umbrella":
    default:
      return lathe([[0, 0.16], [0.12, 0.14], [0.25, 0.09], [0.34, 0.01], [0.41, -0.06], [0.38, -0.095]]);
  }
}

function addWarts(group: THREE.Group, radius: number, baseY: number, capTop: number, material: THREE.Material, seed: number) {
  const count = 5 + Math.floor(seed * 5);
  const geo = new THREE.SphereGeometry(0.032, 6, 4);
  for (let i = 0; i < count; i++) {
    const a = seed * 9 + i * 2.399;
    const d = Math.sqrt((i + 0.5) / count) * radius * 0.78;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const t = Math.min(1, d / radius);
    const y = baseY + capTop * (1 - t * t * 0.82) + 0.015;
    const wart = new THREE.Mesh(geo, material);
    wart.position.set(x, y, z);
    wart.scale.setScalar(0.55 + (i % 3) * 0.12);
    wart.castShadow = true;
    group.add(wart);
  }
}

function addScales(group: THREE.Group, radius: number, baseY: number, capTop: number, material: THREE.Material) {
  const geo = new THREE.ConeGeometry(0.022, 0.055, 5);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3;
    const d = radius * (0.3 + (i % 4) * 0.15);
    const cone = new THREE.Mesh(geo, material);
    cone.position.set(Math.cos(a) * d, baseY + capTop * (1 - d / radius * 0.45), Math.sin(a) * d);
    cone.rotation.z = Math.cos(a) * 0.7;
    cone.rotation.x = -Math.sin(a) * 0.7;
    group.add(cone);
  }
}

function addRings(group: THREE.Group, radius: number, material: THREE.Material) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.40, 0.018, 5, 20), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.26;
  group.add(ring);
}

function capHeight(shape: MushroomShape) {
  if (shape === "flat") return 0.11;
  if (shape === "cone") return 0.27;
  if (shape === "morel") return 0.35;
  if (shape === "wax") return 0.18;
  if (shape === "bell") return 0.24;
  return 0.16;
}

function mushroomCoral(stemMat: THREE.Material, accentMat: THREE.Material) {
  const group = new THREE.Group();
  const branchGeo = new THREE.CylinderGeometry(0.026, 0.042, 0.22, 6);
  for (let i = 0; i < 7; i++) {
    const branch = new THREE.Mesh(branchGeo, i % 2 ? accentMat : stemMat);
    const a = i * 2.1;
    branch.position.set(Math.cos(a) * 0.08, 0.09 + (i % 3) * 0.06, Math.sin(a) * 0.08);
    branch.rotation.z = Math.cos(a) * 0.42;
    branch.rotation.x = -Math.sin(a) * 0.42;
    branch.castShadow = true;
    group.add(branch);
  }
  const tip = new THREE.SphereGeometry(0.04, 6, 4);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7;
    const ball = new THREE.Mesh(tip, accentMat);
    ball.position.set(Math.cos(a) * 0.16, 0.30 + (i % 2) * 0.05, Math.sin(a) * 0.16);
    group.add(ball);
  }
  return group;
}

export function createMushroomModel(species: MushroomSpecies) {
  const capMat = paint(species.cap, {
    roughness: species.pattern === "glow" ? 0.36 : 0.62,
    metalness: species.pattern === "glow" ? 0.2 : 0,
    emissive: species.pattern === "glow" ? species.accent : undefined,
    emissiveIntensity: species.pattern === "glow" ? 0.52 : 0,
    transparent: species.shape === "jelly",
    opacity: species.shape === "jelly" ? 0.52 : 1,
  });
  const stemMat = paint(species.stem, { roughness: 0.8 });
  const gillMat = paint(species.gill, { roughness: 0.86 });
  const accentMat = paint(species.accent, { roughness: 0.5, emissive: species.pattern === "glow" ? species.accent : undefined, emissiveIntensity: species.pattern === "glow" ? 0.7 : 0 });
  const group = new THREE.Group();
  const seed = (species.name.length * 7 + parseInt(species.id.slice(1), 10) * 13) % 97 / 97;

  if (species.shape === "coral") {
    group.add(mushroomCoral(stemMat, accentMat));
  } else if (species.shape === "puff") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(BASE_RADIUS * 0.72, 14, 10), capMat);
    body.scale.set(1, 0.82, 1);
    body.position.y = 0.24;
    body.castShadow = true;
    group.add(body);
    addMesh(group, new THREE.CylinderGeometry(0.06, 0.06, 0.025, 8), gillMat, 0, 0.44, 0);
    addMesh(group, new THREE.CylinderGeometry(0.16, 0.20, 0.11, 10), stemMat, 0, 0.08, 0);
  } else {
    const height = species.shape === "fan" ? 0.28 : 0.30 + seed * 0.08;
    const radius = species.shape === "fan" ? 0.30 : BASE_RADIUS * (0.82 + seed * 0.22);
    addMesh(group, new THREE.CylinderGeometry(0.055, 0.075, height, 8, 3), stemMat, 0, height / 2, 0);
    const volva = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.07, 9), stemMat);
    volva.position.y = 0.035;
    volva.castShadow = true;
    group.add(volva);
    if (species.pattern === "ring") addRings(group, radius, accentMat);

    const y = height + 0.01;
    let cap: THREE.Mesh | null = null;
    if (species.shape === "cup") {
      const bowl = new THREE.Mesh(lathe([[0.06, 0], [0.22, 0.05], [0.30, 0.15], [0.26, 0.21], [0.17, 0.16]]), capMat);
      bowl.position.y = y;
      bowl.castShadow = true;
      group.add(bowl);
      const inner = new THREE.Mesh(lathe([[0.02, 0.03], [0.18, 0.08], [0.24, 0.14]]), gillMat);
      inner.position.y = y + 0.004;
      group.add(inner);
    } else if (species.shape === "fan") {
      const shelf = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.88, 0.055, 18, 1, false, 0, Math.PI), capMat);
      shelf.position.set(radius * 0.34, y + 0.06, 0);
      shelf.rotation.z = -0.08;
      shelf.rotation.y = Math.PI * 0.22;
      shelf.castShadow = true;
      group.add(shelf);
      const under = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, 0.012, 18, 1, false, 0, Math.PI), gillMat);
      under.position.set(radius * 0.34, y + 0.028, 0);
      under.rotation.y = shelf.rotation.y;
      group.add(under);
    } else {
      cap = new THREE.Mesh(capDome(species.shape), capMat);
      cap.position.y = y;
      cap.rotation.z = (seed - 0.5) * 0.10;
      cap.castShadow = true;
      group.add(cap);
      const gills = gillMesh(radius, gillMat);
      gills.position.y = y - 0.016;
      group.add(gills);
      const h = capHeight(species.shape);
      if (species.pattern === "spots") addWarts(group, radius, y, h, accentMat, seed);
      if (species.pattern === "scales") addScales(group, radius, y, h, accentMat);
      if (species.pattern === "striate") {
        const band = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.80, 0.010, 4, 24), accentMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = y + 0.012;
        group.add(band);
      }
      if (species.shape === "tooth") {
        const toothGeo = new THREE.ConeGeometry(0.012, 0.075, 5);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          const tooth = new THREE.Mesh(toothGeo, accentMat);
          tooth.position.set(Math.cos(a) * radius * 0.66, y - 0.055, Math.sin(a) * radius * 0.66);
          tooth.rotation.z = Math.PI;
          group.add(tooth);
        }
      }
      if (species.shape === "morel") {
        for (let i = 0; i < 5; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * (0.26 + i * 0.12), 0.012, 4, 16), gillMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y + 0.08 + i * 0.055;
          group.add(ring);
        }
      }
    }
  }

  // 所有物种统一朝随机方向略微歪斜，避免一排菌像尺子量过。
  group.rotation.y = seed * Math.PI * 2;
  group.scale.setScalar(species.size / BASE_RADIUS);
  group.userData.speciesId = species.id;
  return group;
}

export function createMushroomGlow(color: string, radius: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
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
