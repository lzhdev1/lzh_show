import * as THREE from "three";
import { PLOT_COLS, PLOT_ROWS } from "../game/state";
import type { CropId } from "../game/crops";
import { cropStage, growthProgress, isReady } from "../game/growth";
import { createCropModel, type CropModel } from "./crops3d";
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

/** 田垄横截面：中间高、两侧塌成坡，边缘留一点土坎，和邻地块接成一片 */
export function bedHeightAt(nx: number, nz: number): number {
  const fall = Math.max(0, 1 - Math.pow(Math.abs(nx), 4)) * Math.max(0, 1 - Math.pow(Math.abs(nz), 4));
  return 0.015 + BED_HEIGHT * Math.pow(fall, 0.9);
}

function createBedGeometry(size: number, segments = 18): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const half = size / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = x / half;
    const nz = z / half;
    // 起伏也要压到边缘为 0，否则相邻地块边缘对不上又会出现缝
    const fall = Math.max(0, 1 - Math.pow(Math.abs(nx), 4)) * Math.max(0, 1 - Math.pow(Math.abs(nz), 4));
    const wobble = Math.sin(x * 2.4 + z * 1.9) * 0.012 + Math.sin(z * 3.3 + x * 0.7) * 0.008;
    pos.setY(i, 0.015 + BED_HEIGHT * Math.pow(fall, 0.9) + wobble * fall);
  }
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
  soilMat: THREE.MeshStandardMaterial;
  crops: CropModel[];
  cropId: CropId | null;
  tufts: THREE.Mesh[];
  /** 开垦后土面上才出现的土斑与碎土 */
  details: THREE.Mesh[];
  readyRing: THREE.Mesh;
  selectRing: THREE.Mesh;
}

export interface Plots {
  group: THREE.Group;
  visuals: PlotVisual[];
  meshes: THREE.Mesh[];
}

/** 三种土面状态共用材质，卡通色块直接给颜色，不贴图 */
let soilMats: { empty: THREE.MeshStandardMaterial; dry: THREE.MeshStandardMaterial; wet: THREE.MeshStandardMaterial } | null = null;
function getSoilMats() {
  if (!soilMats) {
    soilMats = {
      // 未开垦：草色盖着土
      empty: clay(PALETTE.soilGrass, { roughness: 0.95 }),
      // 已翻好的干土
      dry: clay(PALETTE.soil, { roughness: 0.95 }),
      // 浇过水的湿土：更深更暖
      wet: clay(PALETTE.soilWet, { roughness: 0.9 }),
    };
  }
  return soilMats;
}

const SELECT_COLOR = 0xfff4cf;

export function createPlots(): Plots {
  const group = new THREE.Group();
  // 抬到田埂草台顶面（world.ts 里草台高 0.2），地块才有厚度而不是陷进草里
  group.position.y = 0.2;
  const visuals: PlotVisual[] = [];
  const meshes: THREE.Mesh[] = [];

  // 田垄：一整条土坡，中间高两侧塌，相邻地块边缘相接，看不到缝
  const soilGeo = createBedGeometry(PLOT_SIZE);
  const SOIL_MATS = getSoilMats();
  const readyGeo = new THREE.RingGeometry(0.98, 1.12, 32);
  const selectGeo = new THREE.RingGeometry(1.55, 1.72, 4);
  const tuftGeo = new THREE.ConeGeometry(0.1, 0.28, 6);
  const tuftMat = clay(PALETTE.leafDark, { roughness: 0.9 });
  // 土面细节：细碎的土颗粒，撒在表面做质感，不用大块色斑（会像污渍）
  const clodGeo = lumpy(0.045, 1, 0.25);
  const clodMat = clay(0x8a5a38, { roughness: 0.95 });

  for (let id = 0; id < PLOT_COLS * PLOT_ROWS; id += 1) {
    const pos = plotPosition(id);

    const soilMat = SOIL_MATS.empty;
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.castShadow = true;
    soil.receiveShadow = true;
    soil.userData.plotId = id;

    // 未开垦地块上的杂草
    const tufts: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i += 1) {
      const tuft = new THREE.Mesh(tuftGeo, tuftMat);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const tx = pos.x + Math.cos(a) * 0.55;
      const tz = pos.z + Math.sin(a) * 0.55;
      tuft.position.set(tx, bedHeightAt((tx - pos.x) / (PLOT_SIZE / 2), (tz - pos.z) / (PLOT_SIZE / 2)) + 0.02, tz);
      tuft.rotation.z = (i - 1.5) * 0.15;
      group.add(tuft);
      tufts.push(tuft);
    }

    const readyRing = new THREE.Mesh(
      readyGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffce5c,
        transparent: true,
        opacity: 0.85,
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

    // 土面细节：十几颗细碎土粒，开垦后才出现
    const details: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i += 1) {
      const clod = new THREE.Mesh(clodGeo, clodMat);
      const cx = between(-0.92, 0.92);
      const cz = between(-0.92, 0.92);
      clod.position.set(cx, bedHeightAt(cx / (PLOT_SIZE / 2), cz / (PLOT_SIZE / 2)) + 0.01, cz);
      clod.scale.setScalar(between(0.6, 1.3));
      clod.visible = false;
      holder.add(clod);
      details.push(clod);
    }

    holder.add(soil);
    group.add(holder);

    visuals.push({
      id,
      group: holder,
      soil,
      soilMat,
      cropId: null,
      crops: [],
      tufts,
      details,
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

  return { group, visuals, meshes };
}

/** 每帧把 store 状态同步给 3D：结构变化才重建作物，其余只改显隐与颜色 */
export function updatePlots(
  plots: Plots,
  states: PlotState[],
  selectedId: number | null,
  now: number,
  t: number
): void {
  for (let i = 0; i < plots.visuals.length; i += 1) {
    const visual = plots.visuals[i];
    const state = states[visual.id];
    if (!state) continue;

    // 土面状态：未开垦 / 翻好的干土 / 浇过水的湿土，换共享材质而不是改颜色
    const mats = getSoilMats();
    if (!state.unlocked) {
      visual.soil.material = mats.empty;
      visual.soilMat = mats.empty;
    } else if (state.watered > 0) {
      visual.soil.material = mats.wet;
      visual.soilMat = mats.wet;
    } else {
      visual.soil.material = mats.dry;
      visual.soilMat = mats.dry;
    }

    visual.tufts.forEach((tuft) => {
      tuft.visible = !state.unlocked;
    });

    // 开垦过才露出土斑和碎土，没开的还是草皮盖着
    visual.details.forEach((detail) => {
      detail.visible = state.unlocked;
    });

    if (state.crop !== visual.cropId) {
      visual.crops.forEach((model) => {
        visual.group.remove(model.group);
        model.dispose();
      });
      visual.crops = [];
      visual.cropId = state.crop;
      if (state.crop) {
        const spots: Array<[number, number]> = [
          [-0.44, -0.44],
          [0.44, -0.44],
          [-0.44, 0.44],
          [0.44, 0.44],
        ];
        spots.forEach(([x, z], index) => {
          const model = createCropModel(state.crop as CropId);
          model.group.position.set(x, BED_HEIGHT + 0.02, z);
          model.group.rotation.y = (visual.id + index) * 0.7;
          model.group.scale.setScalar(0.82);
          visual.group.add(model.group);
          visual.crops.push(model);
        });
      }
    }

    if (state.crop && visual.crops.length > 0) {
      const progress = growthProgress(state, now);
      const stage = cropStage(progress);
      visual.crops.forEach((model) => model.sync(stage, t));
    }

    const ready = isReady(state, now);
    visual.readyRing.visible = ready;
    if (ready) {
      const pulse = 1 + Math.sin(t * 3.4) * 0.06;
      visual.readyRing.scale.setScalar(pulse);
      (visual.readyRing.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 3.4) * 0.2;
    }

    visual.selectRing.visible = selectedId === visual.id;
    if (visual.selectRing.visible) {
      visual.selectRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
    }
  }
}

/** 释放所有地块资源（页面卸载时调用，demo 里主要防止热更新残留） */
export function disposePlots(plots: Plots): void {
  plots.visuals.forEach((v) => {
    v.crops.forEach((model) => model.dispose());
    v.soilMat.dispose();
  });
}
