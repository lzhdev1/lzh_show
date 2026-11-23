import * as THREE from "three";
import {
  MUSHROOM_HABITAT_LABEL, MUSHROOM_LIST,
  complaintFor, mushroomMutationAt, mushroomSeasonAt, type MushroomHabitat, type MushroomMutation, type MushroomSpecies,
} from "../game/mushrooms";
import {
  markMushroomTaken, resetMushroomSeason, setNearbyMushroom, useMushroomInteraction, type NearbyMushroom,
} from "../game/mushroomInteraction";
import { createChatBubble } from "./chatBubble";
import { createMushroomModel } from "./mushroomModels";
import {
  BRIDGE, FENCE_X, FENCE_Z, RIVER_BED, ROAD_HALF_WIDTH, WORLD_HALF,
  inWorld, onBridge, riverInfo, roadInfo,
} from "./layout";
import { onRanchReserve } from "./ranchLayout";
import { inTown } from "./town/townLayout";
import { inSalesHallGround, inHallParkingGround } from "./salesHallLayout";
import type { WorldObstacles } from "./obstacles";

const HOST_COUNT = 30;
const HOST_KINDS = ["log", "stump", "trunk", "shrub", "ground"] as const;
type HostKind = typeof HOST_KINDS[number];

interface Host {
  id: string;
  kind: HostKind;
  group: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
  seed: number;
  surfaceY: number;
  radius: number;
}

interface MushroomActor {
  id: string;
  species: MushroomSpecies;
  mutation: MushroomMutation;
  host: Host;
  model: THREE.Group;
  aura: THREE.Group | null;
  bubble: ReturnType<typeof createChatBubble> | null;
  base: THREE.Vector3;
  current: THREE.Vector3;
  target: THREE.Vector3;
  seed: number;
  height: number;
}

function hash(text: string) {
  let n = 2166136261;
  for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

function randomSource(seed: number) {
  let value = (seed ^ 0x5bf03635) >>> 0;
  return () => {
    value = (value + 0x9e3779b9) >>> 0;
    let t = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 0x100000000;
  };
}

function previewFungi() {
  if (typeof location === "undefined") return false;
  const local = location.hostname === "127.0.0.2" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  return local && new URLSearchParams(location.search).has("fungi");
}

function blockedForWild(x: number, z: number, pad = 2) {
  if (!inWorld(x, z) || Math.abs(x) > WORLD_HALF - 12 || Math.abs(z) > WORLD_HALF - 12) return true;
  if (Math.abs(x) < FENCE_X + 8 && Math.abs(z) < FENCE_Z + 8) return true;
  if (onRanchReserve(x, z, 4)) return true;
  if (riverInfo(x, z).dist < RIVER_BED.shoulder + pad) return true;
  if (onBridge(x, z, 5) || Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 15) return true;
  if (roadInfo(x, z) < ROAD_HALF_WIDTH + pad) return true;
  if (inTown(x, z) || inSalesHallGround(x, z) || inHallParkingGround(x, z)) return true;
  return false;
}

function addHostObstacle(host: Host, obstacles: WorldObstacles) {
  if (host.kind === "log") obstacles.addCircle(host.position.x, host.position.z, 0.55);
  else if (host.kind === "stump") obstacles.addCircle(host.position.x, host.position.z, 0.42);
  else if (host.kind === "trunk") obstacles.addCircle(host.position.x, host.position.z, 0.32);
}

function barkMaterial(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
}

function buildHost(kind: HostKind, seed: number) {
  const group = new THREE.Group();
  const bark = barkMaterial(kind === "log" ? "#6c4f36" : kind === "stump" ? "#73563d" : "#5f4934");
  const cut = new THREE.MeshStandardMaterial({ color: "#cbb58e", roughness: 0.82 });
  const moss = new THREE.MeshStandardMaterial({ color: "#62834e", roughness: 0.95 });
  const leaf = new THREE.MeshStandardMaterial({ color: "#4e714a", roughness: 0.9 });
  const branchMat = barkMaterial("#76593c");

  if (kind === "log") {
    const length = 2.1 + seed * 0.9;
    const radius = 0.22 + seed * 0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.07, length, 9, 2), bark);
    body.rotation.z = Math.PI / 2;
    body.rotation.y = seed * 1.8;
    body.position.y = radius;
    body.castShadow = true;
    group.add(body);
    const end = new THREE.CylinderGeometry(radius * 0.99, radius * 0.99, 0.035, 10);
    for (const sign of [-1, 1]) {
      const cap = new THREE.Mesh(end, cut);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(sign * (length / 2 + 0.018), radius, 0);
      group.add(cap);
    }
    for (let i = 0; i < 4; i++) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(radius * (0.55 + i % 2 * 0.2), 7, 4), moss);
      patch.scale.set(1, 0.28, 0.8);
      patch.position.set((i - 1.5) * length * 0.18, radius * 1.65, (i % 2 ? 0.12 : -0.12));
      group.add(patch);
    }
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.6, 0.45, 7), branchMat);
    stub.rotation.z = 0.8;
    stub.position.set(-length * 0.2, radius * 1.55, 0.08);
    group.add(stub);
  } else if (kind === "stump") {
    const height = 0.55 + seed * 0.18;
    const radius = 0.32 + seed * 0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height, 9, 2), bark);
    body.position.y = height / 2;
    body.castShadow = true;
    group.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, 0.035, 10), cut);
    top.position.y = height + 0.015;
    group.add(top);
    for (let i = 0; i < 3; i++) {
      const root = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.35, height * 0.7, 5), bark);
      const a = i / 3 * Math.PI * 2;
      root.rotation.z = 1.2;
      root.position.set(Math.cos(a) * radius * 0.9, height * 0.35, Math.sin(a) * radius * 0.9);
      group.add(root);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.66, 0.018, 4, 20), cut);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height + 0.04;
    group.add(ring);
  } else if (kind === "trunk") {
    const height = 2.2 + seed * 0.8;
    const radius = 0.26 + seed * 0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, height, 9, 3), bark);
    body.position.y = height / 2;
    body.rotation.z = (seed - 0.5) * 0.1;
    body.castShadow = true;
    group.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 0.04, 9), cut);
    top.position.y = height;
    top.rotation.x = Math.PI / 2;
    group.add(top);
    for (let i = 0; i < 2; i++) {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.55, 6), branchMat);
      stub.rotation.z = i ? 1.0 : -0.9;
      stub.rotation.x = 0.2;
      stub.position.set(i ? 0.2 : -0.22, height * 0.62 + i * 0.2, i * 0.08);
      group.add(stub);
    }
    const ivy = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 1.04, 0.28, 6, 1, true), moss);
    ivy.position.y = height * 0.28;
    group.add(ivy);
  } else if (kind === "shrub") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 6), branchMat);
    body.position.y = 0.21;
    group.add(body);
    const geo = new THREE.IcosahedronGeometry(0.34, 1);
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(geo, i % 3 === 0 ? moss : leaf);
      const a = i / 4 * Math.PI * 2 + seed * 3;
      puff.position.set(Math.cos(a) * 0.24, 0.42 + (i % 2) * 0.16, Math.sin(a) * 0.24);
      puff.scale.set(0.9 + i % 2 * 0.25, 0.75, 0.9);
      puff.castShadow = true;
      group.add(puff);
    }
    for (let i = 0; i < 5; i++) {
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.5, 4), branchMat);
      const a = i / 5 * Math.PI * 2;
      twig.rotation.z = Math.cos(a) * 0.35;
      twig.rotation.x = Math.sin(a) * 0.35;
      twig.position.set(Math.cos(a) * 0.18, 0.36, Math.sin(a) * 0.18);
      group.add(twig);
    }
  } else {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), moss);
    mound.scale.y = 0.3;
    mound.position.y = 0.01;
    group.add(mound);
    for (let i = 0; i < 5; i++) {
      const grass = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 4), leaf);
      const a = i * 1.7;
      grass.position.set(Math.cos(a) * 0.4, 0.15, Math.sin(a) * 0.4);
      grass.rotation.z = Math.cos(a) * 0.6;
      group.add(grass);
    }
  }
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.receiveShadow = true;
  });
  return group;
}

function hostSurface(kind: HostKind, seed: number) {
  if (kind === "log") return 0.22 + seed * 0.08;
  if (kind === "stump") return 0.55 + seed * 0.18;
  if (kind === "trunk") return 0.7 + seed * 1.6;
  if (kind === "ground") return 0.16;
  return 0.08;
}

function moundProfile(t: number) {
  // smoothstep 两端切线归零：坡脚平缓接地面，坡顶是圆丘而不是被削平的平台。
  const s = 1 - t * t * (3 - 2 * t);
  return Math.pow(s, 0.8);
}

/** 石头也用一体起伏的岩块，不用方盒/圆柱拼出“平板”。 */
function createRockGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const n = 1
      + Math.sin(x * 2.6 + seed * 3.7) * 0.13
      + Math.sin(y * 3.2 - seed * 2.1) * 0.10
      + Math.sin(z * 2.9 + seed * 5.3) * 0.09;
    position.setXYZ(i, x * n, y * (y < 0 ? 0.42 : 0.72) * n, z * n);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createMoundGeometry(radius: number, height: number, seed: number) {
  const rings = 9;
  const segments = 22;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  const grassDeep = new THREE.Color("#88a05f");
  const grassMid = new THREE.Color("#a3b671");
  const grassDry = new THREE.Color("#c4c783");
  const soil = new THREE.Color("#9b815c");
  const stretch = 0.84 + (Math.sin(seed * 4.1) + 1) * 0.08;
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const profile = moundProfile(t);
    for (let segment = 0; segment < segments; segment++) {
      const theta = segment / segments * Math.PI * 2;
      const rim = 1 + t * (
        Math.sin(theta * 3 + seed * 2.7) * 0.085
        + Math.sin(theta * 5 - seed * 1.9) * 0.052
        + Math.sin(theta * 8 + seed * 4.3) * 0.028
      );
      const r = radius * t * rim * (t === rings ? 1.08 : 1);
      // 低频肩部起伏 + 细碎坡面起伏：轮廓不是旋转体，坡面也有凹有脊。
      const shoulder = Math.sin(theta * 4 + seed * 3.1) * Math.sin(t * Math.PI) * 0.09;
      const ripple = Math.sin(theta * 7 - seed * 1.3) * Math.sin(t * Math.PI) * 0.028;
      const y = Math.max(0, height * (profile + shoulder * profile + ripple))
        + (t === rings ? -0.015 : 0);
      const bx = Math.cos(theta) * r * (1 + Math.sin(theta * 2 + seed) * 0.055);
      const bz = Math.sin(theta) * r * stretch;
      positions.push(bx, y, bz);
      const patch = Math.sin(theta * 5 + seed * 5.2) * 0.5 + 0.5;
      const bare = profile > 0.4 && patch > 0.78 ? (profile - 0.4) * 0.42 : 0;
      const soilAmount = Math.min(0.42, bare);
      color.copy(grassDeep).lerp(grassMid, 0.34 + patch * 0.55);
      color.lerp(grassDry, profile * 0.42);
      color.lerp(soil, soilAmount);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, d, a, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildGardenTerrain(obstacles: WorldObstacles, group: THREE.Group) {
  const matGrassBlade = new THREE.MeshStandardMaterial({ color: "#5f8142", roughness: 0.96 });
  const moundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true });
  const stone = new THREE.MeshStandardMaterial({ color: "#a9a798", roughness: 0.95, flatShading: true });
  const stoneWarm = new THREE.MeshStandardMaterial({ color: "#b9ab91", roughness: 0.95, flatShading: true });
  const rnd = randomSource(0x6f756e67);
  const used: Array<[number, number]> = [];

  const place = (radius: number, kind: "mound" | "rock") => {
    for (let attempt = 0; attempt < 90; attempt++) {
      const x = (rnd() * 2 - 1) * (WORLD_HALF - 18);
      const z = (rnd() * 2 - 1) * (WORLD_HALF - 18);
      if (blockedForWild(x, z, 3.5)) continue;
      if (used.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < radius + 8)) continue;
      if (!obstacles.canWalk({ x, z }, { x, z })) continue;
      used.push([x, z]);
      const p = new THREE.Vector3(x, 0, z);

      if (kind === "mound") {
        const h = Math.min(1.7, 0.45 + radius * 0.24 + rnd() * 0.16);
        const seed = rnd() * 100;
        const mound = new THREE.Mesh(createMoundGeometry(radius, h, seed), moundMaterial);
        mound.position.copy(p);
        mound.rotation.y = rnd() * 6.28;
        mound.castShadow = true;
        mound.receiveShadow = true;
        group.add(mound);
        // 土丘没有单独的地面高度采样，碰撞圈按视觉半径收口，
        // 只留最外圈薄边可踩，避免玩家走进坡面后腰部以下埋进土里。
        obstacles.addCircle(x, z, radius * 0.99);
        for (let i = 0; i < 11; i++) {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3 + rnd() * 0.22, 5), matGrassBlade);
          const a = rnd() * 6.28;
          const t = 0.3 + rnd() * 0.58;
          const d = radius * t;
          tuft.position.set(x + Math.cos(a) * d, h * moundProfile(t) + 0.02, z + Math.sin(a) * d);
          tuft.rotation.set(Math.sin(a) * 0.18, rnd() * 6.28, Math.cos(a) * 0.4);
          group.add(tuft);
        }
      } else {
        const scale = 0.3 + rnd() * 0.66;
        const rock = new THREE.Mesh(createRockGeometry(rnd() * 100), rnd() > 0.45 ? stone : stoneWarm);
        rock.position.set(x, scale * (0.24 + rnd() * 0.1), z);
        rock.scale.set(scale * (1.15 + rnd() * 0.4), scale * (0.72 + rnd() * 0.3), scale * (0.9 + rnd() * 0.4));
        rock.rotation.set(rnd() * 0.1, rnd() * 6.28, rnd() * 0.1);
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
        obstacles.addCircle(x, z, scale * 0.58);
      }
      return;
    }
  };

  for (let i = 0; i < 34; i++) place(1.5 + rnd() * 2.3, "mound");
  for (let i = 0; i < 46; i++) place(0.3 + rnd() * 0.55, "rock");
}

/** 野外菌圃：灌木、朽木、树桩与树干常驻，雨后一个阶段才长出菌子。 */
export function createWildGarden(obstacles: WorldObstacles) {
  const group = new THREE.Group();
  group.name = "wild-fungi-and-underbrush";
  const hostGroup = new THREE.Group();
  hostGroup.name = "fungi-hosts";
  group.add(hostGroup);
  buildGardenTerrain(obstacles, group);

  const hosts: Host[] = [];
  const rnd = randomSource(0x1a2b3c4d);
  for (let i = 0; i < HOST_COUNT * 3 && hosts.length < HOST_COUNT; i++) {
    const x = (rnd() * 2 - 1) * (WORLD_HALF - 22);
    const z = (rnd() * 2 - 1) * (WORLD_HALF - 22);
    if (blockedForWild(x, z, 4)) continue;
    if (hosts.some((host) => Math.hypot(x - host.position.x, z - host.position.z) < 8.5)) continue;
    if (!obstacles.canWalk({ x, z }, { x, z })) continue;
    const kind = HOST_KINDS[Math.floor(rnd() * HOST_KINDS.length)];
    const seed = rnd();
    const model = buildHost(kind, seed);
    model.position.set(x, 0, z);
    model.rotation.y = rnd() * Math.PI * 2;
    hostGroup.add(model);
    const host: Host = {
      id: `host-${i}`,
      kind,
      group: model,
      position: new THREE.Vector3(x, 0, z),
      yaw: model.rotation.y,
      seed,
      surfaceY: hostSurface(kind, seed),
      radius: kind === "log" ? 1.4 : kind === "stump" ? 0.5 : kind === "trunk" ? 0.36 : 0.55,
    };
    hosts.push(host);
    addHostObstacle(host, obstacles);
  }

  const mushroomGroup = new THREE.Group();
  mushroomGroup.name = "mushrooms";
  group.add(mushroomGroup);
  const actors = new Map<string, MushroomActor>();
  let lastSeason = -1;
  let active = false;
  let debugInspectable = false;
  let debugDistance = 999;
  let debugClosest: string | null = null;

  const speciesByHabitat = new Map<MushroomHabitat, MushroomSpecies[]>();
  for (const habitat of ["log", "stump", "trunk", "shrub", "ground"] as MushroomHabitat[]) {
    speciesByHabitat.set(habitat, MUSHROOM_LIST.filter((item) => item.habitat === habitat));
  }

  function disposeActor(actor: MushroomActor) {
    mushroomGroup.remove(actor.model);
    actor.aura?.removeFromParent();
    actor.aura?.traverse((object) => {
      if (object instanceof THREE.Sprite) object.material.dispose();
    });
    actor.bubble?.dispose();
    actor.model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  function mushroomPlacement(host: Host, index: number, rndValue: () => number) {
    const a = host.yaw + index * 2.3 + rndValue() * 0.8;
    const tr = host.kind === "log"
      ? 0.65 + rndValue() * 0.5
      : host.kind === "stump"
        ? 0.12 + rndValue() * 0.34
        : host.kind === "trunk"
          ? 0.22 + rndValue() * 0.14
          : 0.18 + rndValue() * 0.62;
    const local = new THREE.Vector3(Math.cos(a) * tr, 0, Math.sin(a) * tr);
    const y = host.kind === "trunk" ? host.surfaceY + rndValue() * 0.35 : host.surfaceY + 0.015;
    return host.position.clone().add(local).setY(y);
  }

  function auraFor(actor: MushroomActor, t: number) {
    if (actor.mutation === null || actor.mutation === "spirit") return null;
    const aura = new THREE.Group();
    aura.position.copy(actor.current);
    const radius = Math.max(0.62, actor.species.size * 2.7);
    if (actor.mutation === "magic") {
      const fogMat = new THREE.MeshBasicMaterial({ color: 0x4a1c73, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const fog = new THREE.Mesh(new THREE.SphereGeometry(radius * (0.55 + i * 0.15), 10, 7), fogMat);
        fog.position.set((i - 1) * radius * 0.32, 0.26 + i * 0.07, (i % 2 ? 1 : -1) * radius * 0.2);
        fog.scale.y = 0.55;
        aura.add(fog);
      }
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#e8ddffcc";
      ctx.beginPath();
      ctx.roundRect(22, 16, 52, 42, 16);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(30, 48, 36, 22, 8);
      ctx.fill();
      ctx.fillStyle = "#3a1956";
      ctx.beginPath();
      ctx.ellipse(38, 38, 7, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(58, 38, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(45, 51);
      ctx.lineTo(51, 51);
      ctx.lineTo(51, 60);
      ctx.lineTo(45, 60);
      ctx.closePath();
      ctx.fill();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const skullMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false, toneMapped: false });
      for (let i = 0; i < 3; i++) {
        const skull = new THREE.Sprite(skullMat.clone());
        skull.scale.setScalar(radius * 0.7);
        skull.renderOrder = 25;
        skull.position.set(0, 0.38 + i * 0.08, 0);
        skull.userData.orbit = i * 2.1;
        aura.add(skull);
      }
      aura.userData.type = "magic";
    } else {
      const colors = ["#ff6b6b", "#ffa94d", "#ffe066", "#7bd88f", "#63c7ff", "#7c83ff", "#c77dff"];
      for (let i = 0; i < 7; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(radius * (0.48 + i * 0.028), 0.008, 4, 28, Math.PI),
          new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.46, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        arc.position.y = 0.42 + i * 0.008;
        arc.rotation.z = 0;
        aura.add(arc);
      }
      const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending });
      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 8, 5), mistMat);
        const a = i * 1.9;
        puff.position.set(Math.cos(a) * radius * 0.36, 0.22 + (i % 2) * 0.08, Math.sin(a) * radius * 0.36);
        aura.add(puff);
      }
      aura.userData.type = "mist";
    }
    aura.userData.start = t;
    mushroomGroup.add(aura);
    return aura;
  }

  function seasonNow(now: number) {
    const season = mushroomSeasonAt(now);
    if (!previewFungi()) return season;
    return { active: true, key: 900000 + Math.floor(now / 60000), phaseEnds: now + 60 * 60000 };
  }

  function sync(now: number) {
    const season = seasonNow(now);
    active = season.active;
    resetMushroomSeason(season.key);
    if (!season.active) {
      if (lastSeason !== -1) actors.forEach(disposeActor);
      actors.clear();
      lastSeason = -1;
      setNearbyMushroom(null);
      return;
    }
    if (lastSeason === season.key) return;
    lastSeason = season.key;
    actors.forEach(disposeActor);
    actors.clear();
    const rndM = randomSource(season.key ^ 0x7f2e1d3c);
    const seen = new Set<string>();
    for (const host of hosts) {
      const habitat = host.kind === "shrub" ? "shrub" : host.kind === "ground" ? "ground" : host.kind;
      const pool = speciesByHabitat.get(habitat) ?? MUSHROOM_LIST;
      const count = 1 + Math.floor(rndM() * 3) + (host.kind === "log" ? 1 : 0);
      for (let i = 0; i < count; i++) {
        let species = pool[Math.floor(rndM() * pool.length)];
        if (seen.has(species.id)) species = pool[(pool.indexOf(species) + 1) % pool.length];
        seen.add(species.id);
        const id = `fungus-${season.key}-${host.id}-${i}`;
        const mutation = mushroomMutationAt(id, season.key);
        const base = mushroomPlacement(host, i, rndM);
        const model = createMushroomModel(species);
        model.position.copy(base);
        model.rotation.z = (rndM() - 0.5) * 0.09;
        mushroomGroup.add(model);
        const actor: MushroomActor = {
          id, species, mutation, host, model, aura: null, bubble: null,
          base, current: base.clone(), target: base.clone(), seed: rndM(), height: species.size * 1.4,
        };
        if (mutation === "magic" || mutation === "mist") actor.aura = auraFor(actor, 0);
        if (mutation === "spirit") {
          actor.bubble = createChatBubble();
          actor.bubble.sprite.position.copy(base);
          actor.bubble.sprite.position.y += actor.height + 0.38;
          mushroomGroup.add(actor.bubble.sprite);
        }
        actors.set(id, actor);
      }
    }
  }

  const playerPoint = new THREE.Vector3();
  const rayHit = new THREE.Vector3();
  const bounds = new THREE.Sphere();

  if (previewFungi() && typeof window !== "undefined") {
    (window as Window & {
      __ttfarmFungi?: {
        count: () => number;
        spots: () => Array<{ id: string; x: number; z: number; mutation: MushroomMutation }>;
        near: () => string | null;
        player: () => { x: number; z: number };
        flags: () => { inspectable: boolean; active: boolean };
        debug: () => { distance: number; closest: string | null; playerY: number };
      };
    }).__ttfarmFungi = {      count: () => actors.size,
      spots: () => [...actors.values()].map((actor) => ({ id: actor.id, x: actor.current.x, z: actor.current.z, mutation: actor.mutation })),
      near: () => useMushroomInteraction.getState().nearby?.id ?? null,
      player: () => ({ x: playerPoint.x, z: playerPoint.z }),
      flags: () => ({ inspectable: debugInspectable, active }),
      debug: () => ({ distance: debugDistance, closest: debugClosest, playerY: playerPoint.y }),
    };
  }

  return {
    group,
    update(t: number, now: number, player: THREE.Vector3, inspectable: boolean) {
      sync(now);
      playerPoint.copy(player);
      const taken = useMushroomInteraction.getState().taken;
      for (const [id, actor] of actors) {
        if (taken.includes(id)) {
          disposeActor(actor);
          actors.delete(id);
          continue;
        }
        const model = actor.model;
        if (actor.mutation === "spirit") {
          const phase = ((now / 1000) + actor.seed * 7) % 10;
          if (phase >= 6) {
            actor.bubble?.set(complaintFor(actor.id));
          } else {
            actor.bubble?.set(null);
          }
          const step = Math.floor(now / 10_000);
          const host = actor.host;
          const roll = hash(`${actor.id}:${step}`);
          const dir = roll > 0.5 ? 1 : -1;
          if (host.kind === "log") {
            // 朽木上的通灵菌沿着木头轴向小步挪，不离开木身。
            const axisX = Math.cos(host.yaw);
            const axisZ = -Math.sin(host.yaw);
            const along = (hash(`${actor.id}:along:${step}`) * 2 - 1) * 0.52;
            actor.target.copy(actor.base);
            actor.target.x += axisX * along;
            actor.target.z += axisZ * along;
          } else {
            const angle = Math.atan2(actor.base.z - host.position.z, actor.base.x - host.position.x)
              + dir * (0.14 + hash(`${actor.id}:angle:${step}`) * (host.kind === "trunk" ? 0.55 : 0.7));
            const radius = Math.hypot(actor.base.x - host.position.x, actor.base.z - host.position.z);
            actor.target.set(
              host.position.x + Math.cos(angle) * radius,
              actor.base.y,
              host.position.z + Math.sin(angle) * radius,
            );
          }
          const shore = riverInfo(actor.target.x, actor.target.z);
          if (shore.dist < RIVER_BED.shoulder + 1.2) actor.target.copy(actor.base);
          actor.current.lerp(actor.target, 1 - Math.exp(-0.12 * 0.65));
          model.position.copy(actor.current);
          if (actor.bubble) {
            actor.bubble.sprite.position.copy(actor.current);
            actor.bubble.sprite.position.y += actor.height + 0.38;
            actor.bubble.tick(now);
          }
        } else {
          model.rotation.z += Math.sin(t * 1.2 + actor.seed * 9) * 0.0008;
        }
        if (actor.aura) {
          actor.aura.position.copy(actor.current);
          actor.aura.children.forEach((child, index) => {
            if (child instanceof THREE.Sprite && child.userData.orbit !== undefined) {
              const orbit = child.userData.orbit as number;
              const angle = t * 0.9 + orbit;
              child.position.set(Math.cos(angle) * 0.4, 0.34 + Math.sin(t * 1.7 + index) * 0.07, Math.sin(angle) * 0.4);
              (child.material as THREE.SpriteMaterial).opacity = 0.32 + 0.26 * (0.5 + Math.sin(t * 2.4 + index) * 0.5);
            }
          });
        }
      }
      if (!inspectable || !active) {
        debugInspectable = inspectable;
        setNearbyMushroom(null);
        return;
      }
      debugInspectable = true;
      let closest: MushroomActor | null = null;
      let closestDist = 2.55 ** 2;
      for (const actor of actors.values()) {
        // 树干上的菌可能长在 2 米高处，采菌判定只算脚边水平距离，
        // 否则站在树根下也会因为高度差而看不到采集卡。
        const dx = actor.current.x - playerPoint.x;
        const dz = actor.current.z - playerPoint.z;
        const d = dx * dx + dz * dz;
        if (d < closestDist) {
          closestDist = d;
          closest = actor;
        }
      }
      debugDistance = Math.sqrt(closestDist);
      debugClosest = closest?.id ?? null;
      setNearbyMushroom(closest ? {        id: closest.id,
        species: closest.species,
        mutation: closest.mutation,
        seasonKey: lastSeason,
        hostLabel: MUSHROOM_HABITAT_LABEL[closest.host.kind],
        position: { x: closest.current.x, z: closest.current.z },
      } satisfies NearbyMushroom : null);
    },
    pickMushroom(raycaster: THREE.Raycaster) {
      if (!active) return null;
      let best = Infinity;
      let found: MushroomActor | null = null;
      for (const actor of actors.values()) {
        bounds.center.copy(actor.current);
        bounds.center.y += actor.height * 0.56;
        bounds.radius = Math.max(0.26, actor.species.size);
        if (raycaster.ray.intersectSphere(bounds, rayHit)) {
          const distance = rayHit.distanceToSquared(raycaster.ray.origin);
          if (distance < best) { best = distance; found = actor; }
        }
      }
      return found ? found.current.clone() : null;
    },
    nearestMushroomPoint() {
      let best = Infinity;
      let found: MushroomActor | null = null;
      for (const actor of actors.values()) {
        const dx = actor.current.x - playerPoint.x;
        const dz = actor.current.z - playerPoint.z;
        const distance = dx * dx + dz * dz;
        if (distance < best) { best = distance; found = actor; }
      }
      return found ? obstacles.project(found.current, "terrain") : null;
    },
    /** 采完立刻从场景撤掉，不能等下一次天气阶段。 */
    take(id: string) {
      markMushroomTaken(id);
      const actor = actors.get(id);
      if (actor) { disposeActor(actor); actors.delete(id); }
    },
    count() { return actors.size; },
    dispose() {
      actors.forEach(disposeActor);
      actors.clear();
      setNearbyMushroom(null);
      mushroomGroup.clear();
      hostGroup.clear();
    },
  };
}
