import * as THREE from "three";
import { PLOT_COLS, PLOT_ROWS } from "../game/state";
import type { CropId } from "../game/crops";
import { cropStage, growthProgress, isReady } from "../game/growth";
import { createCropModel, type CropModel } from "./crops3d";
import type { PlotState } from "../game/growth";

export const PLOT_SPACING = 2.6;
export const PLOT_SIZE = 2.16;

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
  readyRing: THREE.Mesh;
  selectRing: THREE.Mesh;
}

export interface Plots {
  group: THREE.Group;
  visuals: PlotVisual[];
  meshes: THREE.Mesh[];
}

const SELECT_COLOR = 0xfff4cf;

export function createPlots(): Plots {
  const group = new THREE.Group();
  const visuals: PlotVisual[] = [];
  const meshes: THREE.Mesh[] = [];

  const soilGeo = new THREE.BoxGeometry(PLOT_SIZE, 0.3, PLOT_SIZE);
  const readyGeo = new THREE.RingGeometry(0.98, 1.12, 32);
  const selectGeo = new THREE.RingGeometry(1.2, 1.34, 4);
  const tuftGeo = new THREE.ConeGeometry(0.1, 0.28, 4);
  const tuftMat = new THREE.MeshStandardMaterial({
    color: 0x5f9445,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  });

  for (let id = 0; id < PLOT_COLS * PLOT_ROWS; id += 1) {
    const pos = plotPosition(id);

    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x8a5a3b,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.set(0, 0.15, 0);
    soil.castShadow = true;
    soil.receiveShadow = true;
    soil.userData.plotId = id;

    // 未开垦地块上的杂草
    const tufts: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i += 1) {
      const tuft = new THREE.Mesh(tuftGeo, tuftMat);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      tuft.position.set(pos.x + Math.cos(a) * 0.55, 0.36, pos.z + Math.sin(a) * 0.55);
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
    readyRing.position.set(pos.x, 0.34, pos.z);
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
    selectRing.position.set(pos.x, 0.36, pos.z);
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
      soilMat,
      cropId: null,
      crops: [],
      tufts,
      readyRing,
      selectRing,
    });
    meshes.push(soil);
  }

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

    // 土色：未开垦是草地，浇水后加深
    if (!state.unlocked) {
      visual.soilMat.color.setHex(0x79a057);
    } else if (state.watered > 0) {
      visual.soilMat.color.setHex(0x6d4a30);
    } else {
      visual.soilMat.color.setHex(0x8a5a3b);
    }

    visual.tufts.forEach((tuft) => {
      tuft.visible = !state.unlocked;
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
          model.group.position.set(x, 0.3, z);
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
