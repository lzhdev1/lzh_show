import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PLOT_COLS, PLOT_ROWS } from "../game/state";
import type { CropId } from "../game/crops";
import { cropStage, growthProgress } from "../game/growth";
import { createCropLibrary } from "./crops3d";
import type { Mutation } from "../game/weather";
import { PALETTE, clay } from "./materials";
import { lumpy } from "./models";
import type { PlotState } from "../game/growth";

let soilSeed = 4127;
function between(min: number, max: number): number {
  soilSeed = (soilSeed * 16807) % 2147483647;
  return min + (soilSeed / 2147483647) * (max - min);
}

export const PLOT_SPACING = 2.6;
/** 地块之间不留缝：占地直接等于行距，相邻地块边缘正好接上 */
export const PLOT_SIZE = PLOT_SPACING;
/** 田垄中央比田埂高出的高度 */
export const BED_HEIGHT = 0.34;

// 两条菜垄位于四株作物的正下方，中央犁沟与田间小径的深度也用于脚底碰撞。
function furrowAt(nx: number, nz: number): number {
  const phase = nx * (PLOT_SIZE / 2) * Math.PI / 0.49 + Math.sin(nz * 3.2) * 0.13;
  return Math.pow(0.5 + 0.5 * Math.cos(phase), 1.35);
}

export function bedHeightAt(nx: number, nz: number, tilled = true): number {
  const fall = Math.max(0, 1 - nx ** 4) * Math.max(0, 1 - nz ** 4);
  const mound = tilled ? BED_HEIGHT - 0.135 * furrowAt(nx, nz) : 0.19;
  return 0.015 + mound * Math.pow(fall, 0.85);
}

// 顶点色沿垄背提亮、沿沟底压暗。草皮取世界坐标调色，让相邻地块连成一片。
function createBedGeometry(tilled: boolean, offset: THREE.Vector3): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(PLOT_SIZE, PLOT_SIZE, tilled ? 32 : 16, 14);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(tilled ? 0xbeb1a1 : 0x89a36b);
  const light = new THREE.Color(tilled ? 0xfff6e0 : 0xb1c58a);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const nx = x * 2 / PLOT_SIZE, nz = z * 2 / PLOT_SIZE;
    const wx = x + offset.x, wz = z + offset.z;
    const brush = Math.sin(2.1 * wx - wz) * 0.09 + Math.sin(5.9 * wx + 2.8 * wz) * 0.052;
    const grain = Math.sin(wx * 21 + wz * 12) * Math.sin(wx * 9 - wz * 7);
    const edge = Math.max(0, 1 - nx ** 6) * Math.max(0, 1 - nz ** 6);
    const value = tilled
      ? 0.27 + (1 - furrowAt(nx, nz)) * 0.46 + brush + grain * 0.075
      : 0.5 + 0.24 * Math.sin(wx * 0.7 + wz * 1.4) + brush + grain * 0.04;
    pos.setY(i, bedHeightAt(nx, nz, tilled) + (brush * 0.044 + grain * 0.002) * edge);
    color.copy(dark).lerp(light, THREE.MathUtils.clamp(value, 0, 1)).toArray(colors, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createGrassClump(): THREE.BufferGeometry {
  const p: number[] = [], rgb: number[] = [];
  const shade = new THREE.Color(0x6f925e), mid = new THREE.Color(0x95b66a), sun = new THREE.Color(0xc2cc82);
  function vertex(x: number, y: number, z: number, color: THREE.Color) {
    p.push(x, y, z);
    rgb.push(color.r, color.g, color.b);
  }
  for (let blade = 0; blade < 9; blade++) {
    const a = blade * 2.4;
    const dx = Math.sin(a), dz = Math.cos(a);
    const r = 0.035 + blade % 3 * 0.019;
    const reach = 0.09 + blade % 4 * 0.045;
    const tall = 0.14 + blade % 3 * 0.085;
    const w = 0.018 + blade % 3 * 0.006;
    const bx = dx * r, bz = dz * r;
    const mx = bx + dx * reach * 0.42, mz = bz + dz * reach * 0.42;
    const tx = bx + dx * reach, tz = bz + dz * reach;
    vertex(bx - dz*w, 0, bz + dx*w, shade); vertex(mx - dz*w, tall*0.7, mz + dx*w, mid); vertex(bx + dz*w, 0, bz - dx*w, shade);
    vertex(bx + dz*w, 0, bz - dx*w, shade); vertex(mx - dz*w, tall*0.7, mz + dx*w, mid); vertex(mx + dz*w, tall*0.7, mz - dx*w, mid);
    vertex(mx - dz*w, tall*0.7, mz + dx*w, mid); vertex(tx, tall, tz, sun); vertex(mx + dz*w, tall*0.7, mz - dx*w, mid);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
  geo.computeVertexNormals();
  return geo;
}

export function plotPosition(id: number): THREE.Vector3 {
  const col = id % PLOT_COLS;
  const row = Math.floor(id / PLOT_COLS);
  const x = (col - (PLOT_COLS - 1) / 2) * PLOT_SPACING;
  // 行序从近到远：角色出生在下方，第一排就在脚边，扩建朝谷仓方向推进
  const z = -(row - (PLOT_ROWS - 1) / 2) * PLOT_SPACING;
  return new THREE.Vector3(x, 0, z);
}

export interface PlotVisual {
  id: number;
  group: THREE.Group;
  soil: THREE.Mesh;
  meadow: THREE.BufferGeometry;
  bed: THREE.BufferGeometry;
  cropMesh: THREE.InstancedMesh | null;
  cropId: CropId | null;
  stage: number;
  mutation: Mutation | null;
  tufts: THREE.InstancedMesh;
  readyRing: THREE.Mesh;
  selectRing: THREE.Mesh;
}

export interface Plots {
  group: THREE.Group;
  visuals: PlotVisual[];
  meshes: THREE.Mesh[];
  library: ReturnType<typeof createCropLibrary>;
  materials: ReturnType<typeof createFieldMaterials>;
}

function createFieldMaterials() {
  // 一张小纹理给全部土面叠上断续细笔触。近看有颗粒，缩远时 mipmap 会将其柔化。
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const tone = between(231, 248);
    pixels.set([tone, tone, tone, 255], i);
  }
  for (let i = 0; i < 250; i++) {
    const x = Math.floor(between(0, size)), y = Math.floor(between(0, size));
    const length = between(2, 7), drift = between(-0.45, 0.45);
    const tone = i % 3 === 0 ? 199 : 255;
    for (let j = 0; j < length; j++) {
      const u = (x + Math.round(j * drift) + size) % size, v = (y + j) % size;
      pixels.set([tone, tone, tone, 255], 4 * (v * size + u));
    }
  }
  const grain = new THREE.DataTexture(pixels, size, size);
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  return {
    empty: new THREE.MeshLambertMaterial({ vertexColors: true }),
    dry: new THREE.MeshLambertMaterial({ color: 0xc28f6c, vertexColors: true, map: grain }),
    wet: new THREE.MeshLambertMaterial({ color: 0x936b54, vertexColors: true, map: grain }),
    foliage: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true }),
  };
}

const SELECT_COLOR = 0xfff4cf;
const cropStamp = new THREE.Object3D();

export function createPlots(): Plots {
  const group = new THREE.Group();
  // 抬到田埂草台顶面（world.ts 里草台高 0.2），地块才有厚度而不是陷进草里
  group.position.y = 0.2;
  const visuals: PlotVisual[] = [];
  const meshes: THREE.Mesh[] = [];

  // 田垄：一整条土坡，中间高两侧塌，相邻地块边缘相接，看不到缝
  const materials = createFieldMaterials();
  const arcs = Array.from({ length: 4 }, (_, i) =>
    new THREE.RingGeometry(0.99, 1.02, 8, 1, Math.PI * (0.18 + i / 2), 0.46)
  );
  const readyGeo = mergeGeometries(arcs)!;
  arcs.forEach((arc) => arc.dispose());
  const selectGeo = new THREE.RingGeometry(1.62, 1.68, 4);
  const tuftGeo = createGrassClump();
  const stamp = new THREE.Object3D();

  for (let id = 0; id < PLOT_COLS * PLOT_ROWS; id += 1) {
    const pos = plotPosition(id);

    const meadow = createBedGeometry(false, pos);
    const bed = createBedGeometry(true, pos);
    const soil = new THREE.Mesh(meadow, materials.empty);
    soil.castShadow = true;
    soil.receiveShadow = true;
    soil.userData.plotId = id;

    // 未开垦地块上的杂草
    const tufts = new THREE.InstancedMesh(tuftGeo, materials.foliage, 10);
    for (let i = 0; i < tufts.count; i += 1) {
      const x = between(-1.14, 1.14), z = between(-1.14, 1.14);
      stamp.position.set(pos.x + x, bedHeightAt(x * 2 / PLOT_SIZE, z * 2 / PLOT_SIZE, false), pos.z + z);
      stamp.rotation.set(0, between(0, Math.PI * 2), between(-0.1, 0.1));
      stamp.scale.setScalar(between(0.52, 1.08));
      stamp.updateMatrix();
      tufts.setMatrixAt(i, stamp.matrix);
    }
    group.add(tufts);

    const readyRing = new THREE.Mesh(
      readyGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffe3a3,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    readyRing.rotation.x = -Math.PI / 2;
    readyRing.position.set(pos.x, BED_HEIGHT + 0.06, pos.z);
    readyRing.visible = false;
    group.add(readyRing);

    const selectRing = new THREE.Mesh(
      selectGeo,
      new THREE.MeshBasicMaterial({
        color: SELECT_COLOR,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.rotation.z = Math.PI / 4;
    selectRing.position.set(pos.x, BED_HEIGHT + 0.06, pos.z);
    selectRing.visible = false;
    group.add(selectRing);

    // 地块自身放在 group 里，跟随位置移动
    const holder = new THREE.Group();
    holder.position.copy(pos);

    holder.add(soil);
    group.add(holder);

    visuals.push({
      id,
      group: holder,
      soil,
      bed,
      meadow,
      cropId: null,
      cropMesh: null,
      mutation: null,
      stage: -1,
      tufts,
      readyRing,
      selectRing,
    });
    meshes.push(soil);
  }

  // —— 石埂：只围整片田的最外圈，把 30 块地当成一整块田围起来 ——
  // 外缘 = 最外列/行的地块边缘：x ±7.8、z ±6.5
  const RIM_STEP = 0.62;
  const rimGeo = lumpy(0.24, 1, 0.28);
  const rimMat = clay(PALETTE.stone, { roughness: 0.95, flatShading: true });
  const edgeX = (PLOT_COLS / 2) * PLOT_SPACING;
  const edgeZ = (PLOT_ROWS / 2) * PLOT_SPACING;
  const perX = Math.round((edgeX * 2) / RIM_STEP);
  const perZ = Math.round((edgeZ * 2) / RIM_STEP);
  const rim = new THREE.InstancedMesh(rimGeo, rimMat, (perX + 1) * 2 + (perZ + 1) * 2);
  rim.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const stoneTintA = new THREE.Color(PALETTE.stone);
  const stoneTintB = new THREE.Color(0xc2baa9);
  const tint = new THREE.Color();
  let rimIndex = 0;

  for (let side = 0; side < 4; side += 1) {
    // 0/1 是前后两条长边，2/3 是左右两条短边
    const count = side < 2 ? perX : perZ;
    const half = side < 2 ? edgeX : edgeZ;
    for (let k = 0; k <= count; k += 1) {
      const t = (k / count - 0.5) * 2 * half;
      const dx = side < 2 ? t : side === 2 ? -edgeX : edgeX;
      const dz = side === 0 ? -edgeZ : side === 1 ? edgeZ : t;
      dummy.position.set(
        dx + between(-0.03, 0.03),
        0.12 + between(-0.014, 0.014),
        dz + between(-0.03, 0.03)
      );
      dummy.rotation.set(0, between(0, Math.PI * 2), 0);
      dummy.scale.set(between(1.0, 1.26), between(0.5, 0.62), between(0.94, 1.2));
      dummy.updateMatrix();
      rim.setMatrixAt(rimIndex, dummy.matrix);
      tint.copy(between(0, 1) > 0.5 ? stoneTintA : stoneTintB).offsetHSL(0, 0, between(-0.05, 0.05));
      rim.setColorAt(rimIndex, tint);
      rimIndex += 1;
    }
  }
  rim.count = rimIndex;
  rim.instanceMatrix.needsUpdate = true;
  if (rim.instanceColor) rim.instanceColor.needsUpdate = true;
  group.add(rim);

  return { group, visuals, meshes, library: createCropLibrary(), materials };
}

/** 每帧把 store 状态同步给 3D：结构变化才重建作物，其余只改显隐与颜色 */
export function updatePlots(
  plots: Plots,
  states: PlotState[],
  selectedId: number | null,
  now: number,
  t: number
): void {
  plots.library.wind.value = t;
  for (let i = 0; i < plots.visuals.length; i += 1) {
    const visual = plots.visuals[i];
    const state = states[visual.id];
    if (!state) continue;

    const mats = plots.materials;
    visual.soil.material = state.unlocked ? (state.watered > 0 ? mats.wet : mats.dry) : mats.empty;
    visual.soil.geometry = state.unlocked ? visual.bed : visual.meadow;
    visual.tufts.visible = !state.unlocked;
    const stage = state.crop ? cropStage(growthProgress(state, now)) : -1;
    if (state.crop && (stage !== visual.stage || state.crop !== visual.cropId || state.mutation !== visual.mutation)) {
      const geometry = plots.library.model(state.crop, stage, state.mutation);
      if (!visual.cropMesh) {
        const mesh = new THREE.InstancedMesh(geometry, plots.library.material, 4);
        for (let k = 0; k < 4; k++) {
          const x = k % 2 === 0 ? -0.49 : 0.49, z = k < 2 ? -0.49 : 0.49;
          cropStamp.position.set(x, bedHeightAt(x * 2 / PLOT_SIZE, z * 2 / PLOT_SIZE), z);
          cropStamp.rotation.y = (visual.id + k) * 1.8;
          cropStamp.scale.setScalar(0.93 + (visual.id + k) % 3 * 0.055);
          cropStamp.updateMatrix();
          mesh.setMatrixAt(k, cropStamp.matrix);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        visual.group.add(mesh);
        visual.cropMesh = mesh;
      }
      visual.cropMesh.geometry = geometry;
      visual.cropMesh.computeBoundingSphere();
    }
    if (visual.cropMesh) visual.cropMesh.visible = Boolean(state.crop);
    visual.cropId = state.crop;
    visual.mutation = state.mutation;
    visual.stage = stage;

    const ready = stage === 3;
    visual.readyRing.visible = ready;
    if (ready) {
      (visual.readyRing.material as THREE.MeshBasicMaterial).opacity = 0.48 + Math.sin(t * 1.8 + i * 0.6) * 0.08;
    }

    visual.selectRing.visible = selectedId === visual.id;
    if (visual.selectRing.visible) {
      visual.selectRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
    }
  }
}

/** 释放所有地块资源（页面卸载时调用，demo 里主要防止热更新残留） */
export function disposePlots(plots: Plots): void {
  const geometries = new Set<THREE.BufferGeometry>();
  plots.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material !== plots.library.material) geometries.add(obj.geometry);
    if (obj instanceof THREE.InstancedMesh) obj.dispose();
  });
  plots.visuals.forEach(({ bed, meadow }) => { geometries.add(bed); geometries.add(meadow); });
  geometries.forEach((geo) => geo.dispose());
  plots.materials.dry.map?.dispose();
  Object.values(plots.materials).forEach((material) => material.dispose());
  plots.library.dispose();
  plots.visuals.forEach((v) => {
    (v.readyRing.material as THREE.Material).dispose();
    (v.selectRing.material as THREE.Material).dispose();
  });
}
