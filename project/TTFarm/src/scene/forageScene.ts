import * as THREE from "three";
import { forageRotationAt, wildPatchesAt, type ForageState, type WildPatch } from "../game/forage";
import { setNearbyPatch } from "../game/forageInteraction";
import { WILD_CLEARINGS } from "../game/ranch";
import { CROPS } from "../game/crops";
import { isWildMutation } from "../game/weather";
import type { createCropLibrary } from "./crops3d";
import { createCropAuras } from "./cropAuras";
import { FORAGE_ANCHORS } from "./forageAnchors";
import { createWildAuras } from "./wildAuras";
import { FENCE_X, FENCE_Z, RIVER_BED, ROAD_HALF_WIDTH, onBridge, riverInfo, roadInfo, WORLD_HALF } from "./layout";
import { onRanchReserve } from "./ranchLayout";
import type { WorldObstacles } from "./obstacles";

/**
 * 野外野菜丛：与野生动物同一套确定性刷新思路。
 * 锚点表在 forageAnchors.ts（只撒在玩家真会走到的草地上），
 * 每个锚点再按障碍与开阔度微调落点；已采摘的按存档 taken 隐藏，换轮重长。
 */

function hash(key: string) {
  let n = 2166136261;
  for (const char of key) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

/**
 * 落点开阔度：周围三层共 24 个方向都能走过去才算“这片草地敞亮”。
 * 用来在合格候选里挑视觉最舒服的一处，而不是撞上第一个能放的点——
 * 那往往正是树干、石头和围栏的夹角里。
 */
function openScore(p: THREE.Vector3, obstacles: WorldObstacles) {
  const q = new THREE.Vector3();
  let clear = 0;
  let total = 0;
  for (const r of [1.6, 2.8, 4.0]) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + r * 0.7;
      q.set(p.x + r * Math.cos(a), 0, p.z + r * Math.sin(a));
      total++;
      if (obstacles.canWalk(p, q)) clear++;
    }
  }
  return clear / total;
}

function spawnAt(patch: WildPatch, obstacles: WorldObstacles) {
  const [cx, cz] = FORAGE_ANCHORS[patch.slot % FORAGE_ANCHORS.length];
  const phase = hash(patch.id) * Math.PI * 2;
  const acceptable = (p: THREE.Vector3) => {
    if (Math.abs(p.x) > WORLD_HALF - 8 || Math.abs(p.z) > WORLD_HALF - 8) return false;
    if (Math.abs(p.x) < FENCE_X + 2 && Math.abs(p.z) < FENCE_Z + 2) return false;
    if (onRanchReserve(p.x, p.z, 2)) return false;
    // 河谷整道沟（含岸坡）都不长野菜：离河心至少岸肩外 2.5 米
    if (riverInfo(p.x, p.z).dist < RIVER_BED.shoulder + 2.5) return false;
    if (onBridge(p.x, p.z, 2)) return false;
    if (roadInfo(p.x, p.z) < ROAD_HALF_WIDTH + 1) return false;
    // 离野生动物空地远一点，避免采摘卡和投喂卡叠在一起
    if (WILD_CLEARINGS.some(([wx, wz]) => Math.hypot(p.x - wx, p.z - wz) < 7)) return false;
    // 关键：先确认落点本身没被树/石头/建筑占住（canWalk 只查终点，所以传两次）
    if (!obstacles.canWalk(p, p)) return false;
    return [0, 1, 2, 3, 4, 5, 6, 7].every((k) =>
      obstacles.canWalk(p, { x: p.x + 1.3 * Math.cos(k * Math.PI / 4), z: p.z + 1.3 * Math.sin(k * Math.PI / 4) }));
  };
  // 第一轮：贴着锚点找（偏移最多 6.5 米），在合格候选里挑最开阔的一处
  let best: THREE.Vector3 | null = null;
  let bestScore = -Infinity;
  const cand = new THREE.Vector3();
  for (let i = 0; i < 96; i++) {
    const a = phase + i * 2.4;
    const r = Math.sqrt(i) * 0.7 + 0.4;
    cand.set(cx + r * Math.cos(a), 0, cz + r * Math.sin(a));
    if (!acceptable(cand)) continue;
    const score = openScore(cand, obstacles) - r * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = cand.clone();
    }
  }
  if (best) return best;
  // 第二轮：锚点贴着河时允许走远，横跨河谷去找对岸的草地
  for (let i = 0; i < 260; i++) {
    const a = phase + i * 2.4;
    const r = Math.sqrt(i) * 1.3 + 0.5;
    const p = new THREE.Vector3(cx + r * Math.cos(a), 0, cz + r * Math.sin(a));
    if (acceptable(p)) return p;
  }
  // 兜底：先沿河法线推到岸肩外，再交给障碍投影，绝不把菜丛丢进水里
  const info = riverInfo(cx, cz);
  const push = RIVER_BED.shoulder + 3;
  const safe = info.dist < push
    ? { x: info.cx + info.nx * push, z: info.cz + info.nz * push }
    : { x: cx, z: cz };
  const projected = obstacles.project(safe);
  const p = new THREE.Vector3(projected.x, 0, projected.z);
  if (acceptable(p)) return p;
  for (let i = 0; i < 120; i++) {
    const a = phase + i * 2.4;
    const r = Math.sqrt(i) * 1.3 + 0.5;
    const q = new THREE.Vector3(p.x + r * Math.cos(a), 0, p.z + r * Math.sin(a));
    if (acceptable(q)) return q;
  }
  return p;
}

interface PatchActor {
  patch: WildPatch;
  mesh: THREE.InstancedMesh;
  anchor: THREE.Vector3;
}

export function createForageScene(obstacles: WorldObstacles, library: ReturnType<typeof createCropLibrary>) {
  const group = new THREE.Group();
  group.name = "wild-greens";
  const auras = createWildAuras();
  group.add(auras.group);
  // 草药丛自带五行 / 仙品 / 神品时，复用田里的柔光与落雷（按丛位传中心点）
  const herbAuras = createCropAuras(() => undefined);
  group.add(herbAuras.group);
  const actors = new Map<string, PatchActor>();
  let lastKey = "";
  const hit = new THREE.Vector3();
  const bound = new THREE.Sphere();
  const stamp = new THREE.Object3D();
  const playerPosition = new THREE.Vector3();

  function sync(now: number, forage: ForageState) {
    const rotation = forageRotationAt(now);
    const taken = forage.rotation === rotation ? forage.taken : [];
    const key = `${rotation}:${taken.join(",")}`;
    if (key === lastKey) return;
    lastKey = key;
    const patches = wildPatchesAt(now);
    const wanted = new Set<string>();
    for (const patch of patches) {
      if (taken.includes(patch.slot)) continue;
      wanted.add(patch.id);
      if (actors.has(patch.id)) continue;
      const anchor = spawnAt(patch, obstacles);
      const { geometry, material } = library.model(patch.crop, 3, patch.mutation);
      // 一丛五株：中间一株最壮的当主株，外围四株错落，远看是一片而不是三根小苗
      const CLUMPS = 5;
      const mesh = new THREE.InstancedMesh(geometry, material, CLUMPS);
      mesh.castShadow = true;
      const seed = hash(patch.id);
      for (let k = 0; k < CLUMPS; k++) {
        const a = seed * Math.PI * 2 + k * 1.25;
        const r = k === 0 ? 0 : k < 3 ? 0.30 : 0.46;
        stamp.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
        stamp.rotation.set(0, seed * 6.28 + k * 1.8, 0);
        stamp.scale.setScalar(k === 0 ? 1.2 : 0.9 + (k % 2) * 0.08);
        stamp.updateMatrix();
        mesh.setMatrixAt(k, stamp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.position.copy(anchor);
      mesh.computeBoundingSphere();
      group.add(mesh);
      actors.set(patch.id, { patch, mesh, anchor });
      if (patch.mutation && isWildMutation(patch.mutation)) {
        auras.setEmitter(patch.id, anchor.clone().add(new THREE.Vector3(0, 0.12, 0)), patch.mutation, 1.35);
      } else if (patch.mutation && CROPS[patch.crop].herb) {
        herbAuras.setPlot(patch.slot, patch.mutation, 3, anchor.clone().add(new THREE.Vector3(0, 0.1, 0)));
      }
    }
    for (const [id, actor] of actors) {
      if (wanted.has(id)) continue;
      group.remove(actor.mesh);
      actor.mesh.dispose();
      actors.delete(id);
      auras.setEmitter(id, null, null);
      herbAuras.setPlot(actor.patch.slot, null, -1);
    }
  }

  function nearestPatchPoint() {
    let best = Infinity;
    let found: PatchActor | undefined;
    for (const actor of actors.values()) {
      const distance = actor.anchor.distanceToSquared(playerPosition);
      if (distance < best) {
        best = distance;
        found = actor;
      }
    }
    return found?.anchor.clone() ?? null;
  }

  function pickPatch(raycaster: THREE.Raycaster) {
    let best = Infinity;
    let found: PatchActor | undefined;
    for (const actor of actors.values()) {
      bound.center.copy(actor.anchor);
      bound.center.y += 0.28;
      bound.radius = 0.88;
      if (raycaster.ray.intersectSphere(bound, hit)) {
        const dist = hit.distanceToSquared(raycaster.ray.origin);
        if (dist < best) {
          best = dist;
          found = actor;
        }
      }
    }
    return found?.anchor.clone() ?? null;
  }

  return {
    group,
    update(t: number, now: number, forage: ForageState, player: THREE.Vector3, active: boolean) {
      playerPosition.copy(player);
      sync(now, forage);
      auras.update(t);
      herbAuras.setTime(t);
      let closest: WildPatch | null = null;
      let closestDist = 2.3 ** 2;
      if (active) {
        for (const actor of actors.values()) {
          const d = actor.anchor.distanceToSquared(playerPosition);
          if (d < closestDist && obstacles.canWalk(playerPosition, actor.anchor)) {
            closestDist = d;
            closest = actor.patch;
          }
        }
      }
      setNearbyPatch(closest);
    },
    pickPatch,
    nearestPatchPoint,
    dispose() {
      setNearbyPatch(null);
      actors.forEach((actor) => actor.mesh.dispose());
      actors.clear();
      auras.dispose();
      herbAuras.dispose();
      group.clear();
    },
  };
}