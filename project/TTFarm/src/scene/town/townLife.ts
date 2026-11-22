import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TownBuilder } from "./townBuild";
import { buildCar, CAR_COLORS } from "./townCar";
import { walkNodes, WALK_Y, ROAD_Y, WALK } from "./townLayout";

const SKIN = [0xe8c5a4, 0xd9b08a, 0xc99874];
const HAIR = [0x332a25, 0x54402f, 0x2c2724, 0x8a6746, 0xd0c09e];
const CLOTH = [0x5b7a8a, 0xb06a5c, 0x87976a, 0xd2ad63, 0x7a6b8f, 0xded2bb, 0x4e6858, 0xc3866b];
const PANTS = [0x4a4c52, 0x6b6152, 0x3e4a52, 0x84776a];

const NPC_COUNT = 14;

function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)];

/** 上半身 + 头 + 头发 + 配饰，全部 merge；双腿独立以便摆步 */
function buildPerson(rand: () => number) {
  const b = new TownBuilder();
  const shirt = pick(rand, CLOTH);
  const pants = pick(rand, PANTS);
  const skin = pick(rand, SKIN);
  const hair = pick(rand, HAIR);
  const skirt = rand() < 0.35;
  const hat = rand() < 0.28;
  const bag = rand() < 0.4;

  b.add(new RoundedBoxGeometry(0.44, 0.5, 0.27, 2, 0.07), shirt, { y: 0.93 });
  if (skirt) {
    b.cylinder(0.24, 0.31, 0.38, shirt, { y: 0.66 }, 10);
  } else {
    b.box(0.4, 0.16, 0.24, pants, { y: 0.64 });
  }
  b.box(0.12, 0.42, 0.15, skin, { x: -0.28, y: 0.94, rz: 0.08 });
  b.box(0.12, 0.42, 0.15, skin, { x: 0.28, y: 0.94, rz: -0.08 });
  b.box(0.3, 0.1, 0.2, shirt, { y: 1.19 });
  b.sphere(0.175, skin, { y: 1.34 }, 12, 9);
  // 头发：后脑壳 + 额前一小撮，避免圆头
  b.add(new THREE.SphereGeometry(0.186, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, { y: 1.37, z: -0.01 });
  b.box(0.2, 0.08, 0.18, hair, { y: 1.28, z: 0.1, rx: -0.12 });
  if (hat) {
    b.cylinder(0.27, 0.29, 0.05, 0xd8c59c, { y: 1.48 }, 14);
    b.cylinder(0.17, 0.2, 0.16, 0xd8c59c, { y: 1.55 }, 14);
  }
  if (bag) {
    b.box(0.26, 0.3, 0.12, 0x6b4f3a, { x: 0.31, y: 0.76, z: 0.12 });
    b.box(0.04, 0.5, 0.04, 0x6b4f3a, { x: 0.27, y: 1.05, z: 0.08, rz: 0.18 });
  }
  // 一条围巾，打破色块
  b.box(0.32, 0.09, 0.22, rand() < 0.5 ? 0xd8d2c0 : 0xa8564e, { y: 1.22 });

  const body = b.build(true, false);

  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const lb = new TownBuilder();
    lb.box(0.15, 0.5, 0.18, pants, { y: -0.25, x: 0.0 });
    lb.box(0.17, 0.1, 0.28, 0x4a413a, { y: -0.51, z: 0.04 });
    const group = lb.build(true, false);
    const leg = group.children[0] as THREE.Mesh;
    leg.position.set(side * 0.105, 0.56, 0);
    legs.push(leg);
  }
  return { body, legs };
}

export interface Walker {
  group: THREE.Group;
  legs: THREE.Mesh[];
  from: number;
  to: number;
  progress: number;
  distance: number;
  speed: number;
  idle: number;
  phase: number;
  height: number;
  previous: number;
}

export interface TownLife {
  group: THREE.Group;
  update: (dt: number, t: number) => void;
  walkers: Walker[];
  cars: THREE.Group[];
}

export function createTownLife(
  signalStates: (t: number) => { ew: "green" | "yellow" | "red"; ns: "green" | "yellow" | "red" },
  seed = 1009,
): TownLife {
  const rand = makeRandom(seed);
  const { nodes, links } = walkNodes();
  const adjacency: number[][] = nodes.map(() => []);
  for (const [a, b] of links) { adjacency[a].push(b); adjacency[b].push(a); }

  const group = new THREE.Group();
  group.name = "town-life";
  const walkers: Walker[] = [];

  for (let i = 0; i < NPC_COUNT; i++) {
    const { body, legs } = buildPerson(rand);
    const scale = 0.94 + rand() * 0.14;
    const start = Math.floor(rand() * nodes.length);
    const to = adjacency[start][Math.floor(rand() * adjacency[start].length)];
    const person = new THREE.Group();
    person.add(body);
    for (const leg of legs) person.add(leg);
    person.scale.setScalar(scale);
    const a = nodes[start], bNode = nodes[to];
    const distance = Math.hypot(bNode.x - a.x, bNode.z - a.z);
    const progress = rand() * 0.7;
    person.position.set(a.x + (bNode.x - a.x) * progress, WALK_Y, a.z + (bNode.z - a.z) * progress);
    person.rotation.y = Math.atan2(bNode.x - a.x, bNode.z - a.z);
    group.add(person);
    walkers.push({
      group: person, legs, from: start, to, progress, distance,
      speed: 0.62 + rand() * 0.36, idle: 0, phase: rand() * 6.28,
      height: 1.55 * scale, previous: start,
    });
  }

  // 车：四条车道，各自循环；车身整体合并
  const cars: THREE.Group[] = [];
  interface Lane { kind: "x" | "z"; fixed: number; min: number; max: number; dir: 1 | -1; rotation: number; }
  const lanes: Lane[] = [
    { kind: "x", fixed: 50.2, min: 43.5, max: 121.5, dir: 1, rotation: 0 },
    { kind: "x", fixed: 50.2, min: 43.5, max: 121.5, dir: 1, rotation: 0 },
    { kind: "x", fixed: 53.8, min: 43.5, max: 121.5, dir: -1, rotation: Math.PI },
    { kind: "x", fixed: 53.8, min: 43.5, max: 121.5, dir: -1, rotation: Math.PI },
    { kind: "z", fixed: 83.8, min: 23, max: 95, dir: 1, rotation: -Math.PI / 2 },
    { kind: "z", fixed: 80.2, min: 23, max: 95, dir: -1, rotation: Math.PI / 2 },
  ];
  const carState: Array<{ lane: Lane; pos: number; speed: number }> = [];
  lanes.forEach((lane, index) => {
    const car = buildCar(CAR_COLORS[index % CAR_COLORS.length]);
    const span = lane.max - lane.min;
    const pos = lane.kind === "x" ? lane.min + span * (0.12 + index * 0.16) : lane.min + span * (0.18 + index * 0.13);
    if (lane.kind === "x") car.position.set(pos, ROAD_Y, lane.fixed);
    else car.position.set(lane.fixed, ROAD_Y, pos);
    car.rotation.y = lane.rotation;
    group.add(car);
    cars.push(car);
    carState.push({ lane, pos, speed: 3.4 });
  });

  const carUpdate = (dt: number, t: number, states: ReturnType<typeof signalStates>) => {
    for (const [index, car] of cars.entries()) {
      const state = carState[index];
      const { lane } = state;
      const signal = lane.kind === "x" ? states.ew : states.ns;
      let target = 3.3 + (index % 3) * 0.45;
      // 接近停车线且非绿灯：减速并停在线上，绿灯再起步
      const stop = lane.kind === "x"
        ? (lane.dir > 0 ? WALK.crossWestX - 3.2 : WALK.crossEastX + 3.2)
        : (lane.dir > 0 ? WALK.avenueSouthZ - 3.2 : WALK.avenueNorthZ + 3.2);
      const remaining = (stop - state.pos) * lane.dir;
      if (signal !== "green" && remaining > -0.4 && remaining < 11) {
        target = Math.max(0, Math.min(target, remaining * 0.42));
      }
      state.speed += (target - state.speed) * Math.min(1, dt * 4.2);
      state.pos += state.speed * lane.dir * dt;
      if (lane.dir > 0 && state.pos > lane.max) { state.pos = lane.min; state.speed = 2.2; }
      if (lane.dir < 0 && state.pos < lane.min) { state.pos = lane.max; state.speed = 2.2; }
      if (lane.kind === "x") car.position.x = state.pos;
      else car.position.z = state.pos;
    }
    void t;
  };

  const update = (dt: number, t: number) => {
    carUpdate(dt, t, signalStates(t));
    for (const w of walkers) {
      const person = w.group;
      if (w.idle > 0) {
        w.idle -= dt;
        person.position.y = WALK_Y + Math.sin(t * 1.2 + w.phase) * 0.008;
        for (const leg of w.legs) leg.rotation.x *= 0.85;
        continue;
      }
      w.progress += (w.speed / Math.max(0.001, w.distance)) * dt;
      if (w.progress >= 1) {
        w.progress = 0;
        w.previous = w.from;
        w.from = w.to;
        const options = adjacency[w.to].filter(id => id !== w.previous);
        w.to = options.length ? options[Math.floor(rand() * options.length)] : adjacency[w.to][0];
        w.distance = Math.hypot(nodes[w.to].x - nodes[w.from].x, nodes[w.to].z - nodes[w.from].z);
        w.speed = 0.62 + rand() * 0.36;
        if (rand() < 0.22) w.idle = 1.2 + rand() * 2.4;
      }
      const from = nodes[w.from], to = nodes[w.to];
      person.position.x = from.x + (to.x - from.x) * w.progress;
      person.position.z = from.z + (to.z - from.z) * w.progress;
      const stride = Math.sin(t * 5.2 * w.speed + w.phase);
      person.position.y = WALK_Y + Math.abs(stride) * 0.035;
      const yaw = Math.atan2(to.x - from.x, to.z - from.z);
      person.rotation.y = yaw;
      person.rotation.z = Math.sin(t * 2.6 + w.phase) * 0.018;
      w.legs[0].rotation.x = stride * 0.4;
      w.legs[1].rotation.x = -stride * 0.4;
    }
  };

  return { group, update, walkers, cars };
}
