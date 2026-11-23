import * as THREE from "three";
import { TownBuilder } from "./townBuild";
import { buildCar, CAR_COLORS } from "./townCar";
import { townSurfaceHeight, walkNodes, type RouteNode } from "./townLayout";
import { bridgeHeightAt, BRIDGE, inRiver, onBridge } from "../layout";
import { HALL_PARKING, SHOPPER_ROUTE, inSalesHall, SALES_HALL } from "../salesHallLayout";

/** NPC 与循环车的固定参数都放这里，方便手感调优 */
const WALK_SPEED = 0.78;
const CAR_CRUISE = 3.1;
const DELIVERY_SPEED = 2.5;
const SHOP_PARK = 11;
const CITY_PARK = 5;
const SHOPPER_SPEED = 1.0;
const SHOPPER_PAUSE = 7;
const SHOPPER_COUNT = 4;

/** 行人只允许踩在岸上或桥面；河面本身不是可走地面。 */
function inWater(x: number, z: number, pad = 0.35) {
  return inRiver(x, z, pad) && !onBridge(x, z, pad);
}

function dryPoint(x: number, z: number) {
  if (!inWater(x, z)) return { x, z };
  // 万一路线点算进河里，拉到桥面中轴，宁可绕桥也不踩水。
  return {
    x: Math.max(BRIDGE.x - BRIDGE.halfLength + 0.7, Math.min(BRIDGE.x + BRIDGE.halfLength - 0.7, x)),
    z: BRIDGE.z,
  };
}

const SKIN = [0xf3c9a5, 0xe4ad82, 0xc88e64, 0xa9704d, 0xf7d8bb];
const HAIR = [0x3f2e26, 0x5b4234, 0x2e2a28, 0x7b5b3e, 0x9b7650, 0x4a3a52];
const COAT = [0x6f8f7c, 0xb56d54, 0x6e88a6, 0xc79b5e, 0x8b6f94, 0x5e7b74, 0xd0b18a, 0x9a5f68];
const PANTS = [0x46515c, 0x5a4c40, 0x3f4a44, 0x6a5b55, 0x4c4552];
const SHOES = [0x3a3633, 0x5d4634, 0x2f3339];

interface Person {
  node: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

/** 低模三渲二市民：头/发/帽/围巾/挎包/外套/手臂/裤腿/鞋，身体用顶点色合并 */
function makePerson(seed: number, shopper = false): Person {
  const node = new THREE.Group();
  const body = new TownBuilder();
  const r = mulberry(seed);
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const coat = COAT[Math.floor(r() * COAT.length)];
  const pants = PANTS[Math.floor(r() * PANTS.length)];
  const hair = HAIR[Math.floor(r() * HAIR.length)];
  const shoe = SHOES[Math.floor(r() * SHOES.length)];
  const scale = 0.92 + r() * 0.16;
  const hasHat = shopper ? r() < 0.35 : r() < 0.22;
  const hasBag = shopper || r() < 0.4;
  const hasScarf = r() < 0.45;

  // 裤腿与鞋：每条腿一个合并网格，挂在髋部枢轴上摆动
  const leg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.105, 0.62 * scale, 0);
    const lb = new TownBuilder();
    lb.box(0.17, 0.58 * scale, 0.2, pants, { y: -0.29 * scale, z: side * 0.01 });
    lb.box(0.19, 0.1, 0.32, shoe, { y: -0.55 * scale, z: 0.05 });
    const g = lb.build(false, false);
    pivot.add(g);
    return pivot;
  };
  const legL = leg(-1), legR = leg(1);
  node.add(legL, legR);

  // 躯干：下摆微张，肩部收窄，腰上一条深色腰带
  body.box(0.42, 0.52 * scale, 0.25, coat, { y: 0.88 * scale });
  body.box(0.46, 0.12, 0.27, coat, { y: 0.6 * scale });
  body.box(0.44, 0.055, 0.27, 0x5a4a3d, { y: 0.67 * scale });
  // 手臂：贴身两条，手掌比袖口浅
  for (const side of [-1, 1]) {
    body.box(0.11, 0.44 * scale, 0.14, coat, { x: side * 0.255, y: 0.86 * scale, rz: side * 0.05 });
    body.sphere(0.075, skin, { x: side * 0.28, y: 0.6 * scale, z: 0.015 });
  }
  // 衣领与前襟扣子
  body.box(0.26, 0.1, 0.19, 0xe7dcc7, { y: 1.15 * scale, z: 0.09 });
  for (let i = 0; i < 3; i++) body.sphere(0.024, 0x4b4037, { y: (1.08 - i * 0.14) * scale, z: 0.135 });

  // 脖子与头
  body.cylinder(0.075, 0.085, 0.1, skin, { y: 1.22 * scale }, 8);
  body.sphere(0.16, skin, { y: 1.36 * scale, z: 0.01 });
  // 头发：后脑一层 + 额前碎发
  body.sphere(0.168, hair, { y: 1.39 * scale, z: -0.035 });
  body.box(0.3, 0.09, 0.2, hair, { y: 1.46 * scale, z: -0.02 });
  body.box(0.18, 0.075, 0.08, hair, { y: 1.44 * scale, z: 0.11 });
  // 眼睛两点
  body.sphere(0.018, 0x2f2a27, { x: -0.058, y: 1.375 * scale, z: 0.145 });
  body.sphere(0.018, 0x2f2a27, { x: 0.058, y: 1.375 * scale, z: 0.145 });
  // 围巾
  if (hasScarf) {
    body.box(0.34, 0.09, 0.3, 0xc76a5b, { y: 1.2 * scale });
    body.box(0.09, 0.3, 0.13, 0xc76a5b, { x: 0.12, y: 1.03 * scale, z: 0.12, rz: 0.18 });
  }
  // 帽子
  if (hasHat) {
    body.cylinder(0.15, 0.16, 0.06, 0xefe2c9, { y: 1.53 * scale });
    body.cylinder(0.11, 0.13, 0.11, 0xefe2c9, { y: 1.6 * scale });
  }
  // 挎包：斜挎到腰侧
  if (hasBag) {
    body.box(0.2, 0.24, 0.1, shopper ? 0xc79b56 : 0x8a6748, { x: 0.27, y: 0.82 * scale, z: -0.03, rz: 0.1 });
    body.box(0.035, 0.52, 0.035, 0x6d5239, { x: 0.16, y: 1.03 * scale, z: 0.08, rz: -0.26 });
  }

  const bodyGroup = body.build(false, false);
  node.add(bodyGroup);
  return { node, legL, legR };
}

/** 轻量可复现随机：NPC 外形在刷新后不变 */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Walker {
  constructor(
    private person: Person,
    private nodes: RouteNode[],
    private links: Array<[number, number]>,
    seed: number,
    nodeIndex: number,
  ) {
    this.node = nodeIndex;
    this.phase = mulberry(seed + 31)() * Math.PI * 2;
    if (inWater(nodes[this.node].x, nodes[this.node].z)) {
      this.node = nodes.findIndex(n => !inWater(n.x, n.z));
      if (this.node < 0) this.node = 0;
    }
    const start = dryPoint(nodes[this.node].x, nodes[this.node].z);
    this.person.node.position.set(start.x, 0.14, start.z);
  }
  node: number;
  target: number | null = null;
  phase: number;
  private neighborsOf(index: number): number[] {
    const out: number[] = [];
    for (const [a, b] of this.links) {
      if (a === index) out.push(b);
      else if (b === index) out.push(a);
    }
    return out;
  }
  update(dt: number, t: number) {
    const from = this.nodes[this.node];
    if (this.target === null) {
      const neighbors = this.neighborsOf(this.node).filter((index) => {
        const node = this.nodes[index];
        return node && !inWater(node.x, node.z) &&
          !inWater((from.x + node.x) * 0.5, (from.z + node.z) * 0.5);
      });
      if (neighbors.length) this.target = neighbors[Math.floor(Math.random() * neighbors.length)];
    }
    const to = this.target === null ? null : this.nodes[this.target];
    if (to) {
      const dx = to.x - from.x, dz = to.z - from.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.35) {
        this.node = this.target!;
        this.target = null;
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        const nx = this.person.node.position.x + (dx / dist) * step;
        const nz = this.person.node.position.z + (dz / dist) * step;
        if (inWater(nx, nz)) {
          this.target = null;
          this.person.node.position.x = from.x;
          this.person.node.position.z = from.z;
        } else {
          this.person.node.position.x = nx;
          this.person.node.position.z = nz;
          this.person.node.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
    const bridge = bridgeHeightAt(this.person.node.position.x, this.person.node.position.z);
    const y = bridge ?? Math.max(townSurfaceHeight(this.person.node.position.x, this.person.node.position.z), 0.14);
    this.person.node.position.y = y;
    const swing = Math.sin(t * 5.4 + this.phase);
    this.person.legL.rotation.x = swing * 0.42;
    this.person.legR.rotation.x = -swing * 0.42;
    this.person.node.position.y += Math.abs(swing) * 0.018;
    this.person.node.rotation.z = swing * 0.035;
  }
}

/** 过桥顾客：固定路线走到大厅柜台，停一会儿再原路返回 */
class Shopper {
  readonly person: Person;
  private route = SHOPPER_ROUTE.map((point) => dryPoint(point.x, point.z));
  private cumulative: number[] = [];
  private total = 0;
  private cursor = 1;
  private dir: 1 | -1 = 1;
  private pause = 0;
  private progress: number;
  constructor(index: number) {
    this.person = makePerson(800 + index, true);
    for (let i = 0; i < this.route.length; i++) {
      if (i === 0) this.cumulative.push(0);
      else {
        const a = this.route[i - 1], b = this.route[i];
        this.total += Math.hypot(b.x - a.x, b.z - a.z);
        this.cumulative.push(this.total);
      }
    }
    this.progress = (index / SHOPPER_COUNT) * this.total;
    this.person.node.rotation.y = 0;
  }
  update(dt: number, t: number) {
    if (this.pause > 0) this.pause -= dt;
    else this.progress += SHOPPER_SPEED * dt * this.dir;

    if (this.dir > 0 && this.progress >= this.total) {
      this.progress = this.total;
      this.pause = SHOPPER_PAUSE;
      this.dir = -1;
    } else if (this.dir < 0 && this.progress <= 0) {
      this.progress = 0;
      this.pause = SHOPPER_PAUSE;
      this.dir = 1;
    }

    while (this.cursor < this.route.length - 1 && this.cumulative[this.cursor] < this.progress) this.cursor++;
    while (this.cursor > 1 && this.cumulative[this.cursor - 1] > this.progress) this.cursor--;
    const a = this.route[this.cursor - 1], b = this.route[this.cursor];
    const seg = this.cumulative[this.cursor] - this.cumulative[this.cursor - 1] || 1;
    const k = Math.max(0, Math.min(1, (this.progress - this.cumulative[this.cursor - 1]) / seg));
    const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
    const safe = dryPoint(x, z);
    this.person.node.position.set(safe.x, this.groundAt(safe.x, safe.z), safe.z);
    this.person.node.rotation.y = Math.atan2((b.x - a.x) * this.dir, (b.z - a.z) * this.dir);
    const swing = Math.sin(t * 5.2 + this.cursor);
    this.person.legL.rotation.x = swing * 0.38;
    this.person.legR.rotation.x = -swing * 0.38;
  }
  private groundAt(x: number, z: number) {
    const bridge = bridgeHeightAt(x, z);
    if (bridge !== undefined) return bridge;
    if (inSalesHall(x, z)) return SALES_HALL.floorY;
    return 0.02;
  }
}

/**
 * 城内车辆闭环：绕中央街—东街—北大道之间的街区顺时针行驶。
 * 车辆只在这条闭环上走，不会从桥头突然出现或瞬移回起点。
 */
const CITY_LOOP: RouteNode[] = [
  { x: 86, z: 50.2 },
  { x: 118, z: 50.2 },
  { x: 123.6, z: 50.6 },
  { x: 127.8, z: 54.2 },
  { x: 127.8, z: 106 },
  { x: 124.6, z: 109.4 },
  { x: 119, z: 111.8 },
  { x: 87, z: 111.8 },
  { x: 83.2, z: 109.6 },
  { x: 80.2, z: 105.8 },
  { x: 80.2, z: 56.2 },
  { x: 83.2, z: 52.4 },
  { x: 86, z: 50.2 },
];

/**
 * 唯一会过桥的车：城市主大道 → 水泥桥 → 河岸步道 → 售货大厅北侧停车场。
 * 从东侧入口拐进车道，倒进第 3 个车位，停 11 秒再原路返回。
 */
const DELIVERY_ROUTE: RouteNode[] = [
  { x: 52, z: 52 },
  { x: 45.5, z: 52 },
  { x: 43.0, z: 52 },
  { x: 40.0, z: 52 },
  { x: 30.5, z: 52 },
  { x: 21.0, z: 52 },
  { x: 18.0, z: 49.2 },
  { x: 16.6, z: 44.0 },
  { x: 16.4, z: 36.0 },
  { x: 17.4, z: 29.0 },
  { x: 19.8, z: 27.4 },
  { x: 21.2, z: 25.0 },
  { x: 21.8, z: 22.0 },
  { x: 21.9, z: 20.6 },
  { x: 21.0, z: 20.0 },
  { x: 18.0, z: 19.8 },
  { x: 15.4, z: 19.9 },
  { x: HALL_PARKING.x, z: 21.0 },
  { x: HALL_PARKING.x, z: HALL_PARKING.z },
];

function curveOf(points: RouteNode[], closed: boolean) {
  return new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p.x, 0, p.z)),
    closed,
    "catmullrom",
    closed ? 0.32 : 0.24,
  );
}

function roadHeightAt(x: number, z: number) {
  const bridge = bridgeHeightAt(x, z);
  if (bridge !== undefined) return bridge;
  return Math.max(townSurfaceHeight(x, z), 0.02) + 0.06;
}

class RouteCar {
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly total: number;
  private t: number;
  speed = CAR_CRUISE;
  constructor(start: number, private mesh: THREE.Group) {
    this.curve = curveOf(CITY_LOOP, true);
    this.total = this.curve.getLength();
    this.t = start;
    this.sample();
  }
  private sample() {
    const point = this.curve.getPointAt(this.t);
    const tangent = this.curve.getTangentAt(this.t);
    this.mesh.position.set(point.x, roadHeightAt(point.x, point.z), point.z);
    // 车辆模型局部 +x 是车头，+z 是左侧车门；朝向按车头对准切线换算。
    this.mesh.rotation.y = Math.atan2(-tangent.z, tangent.x);
  }
  update(dt: number) {
    this.t = (this.t + (this.speed * dt) / this.total) % 1;
    this.sample();
  }
}

class DeliveryVan {
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly total: number;
  private t = 0;
  private dir: 1 | -1 = 1;
  private pause = 0;
  constructor(private mesh: THREE.Group) {
    this.curve = curveOf(DELIVERY_ROUTE, false);
    this.total = this.curve.getLength();
    this.mesh.position.y = 0.08;
    this.sample();
  }
  private sample() {
    const point = this.curve.getPointAt(this.t);
    const tangent = this.curve.getTangentAt(this.t);
    this.mesh.position.set(point.x, roadHeightAt(point.x, point.z), point.z);
    const forward = this.dir > 0 ? 1 : -1;
    this.mesh.rotation.y = Math.atan2(-tangent.z * forward, tangent.x * forward);
  }
  update(dt: number) {
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) {
        this.dir = this.dir > 0 ? -1 : 1;
      }
      return;
    }
    this.t += (this.dir * DELIVERY_SPEED * dt) / this.total;
    if (this.t >= 1) {
      this.t = 1;
      this.pause = SHOP_PARK;
      this.sample();
      return;
    }
    if (this.t <= 0) {
      this.t = 0;
      this.pause = CITY_PARK;
      this.sample();
      return;
    }
    this.sample();
  }
}

export function createTownLife(
  signalStates: (t: number) => { ew: "green" | "yellow" | "red"; ns: "green" | "yellow" | "red" },
  seed = 1009,
) {
  return new TownLife(signalStates, seed);
}

export class TownLife {
  private walkers: Walker[] = [];
  private shoppers: Shopper[] = [];
  private cityCars: RouteCar[] = [];
  private delivery: DeliveryVan | null = null;
  readonly group = new THREE.Group();
  constructor(_signalStates: (t: number) => { ew: "green" | "yellow" | "red"; ns: "green" | "yellow" | "red" }, seed = 1009) {
    this.group.name = "town-life";
    const graph = walkNodes();
    const r = mulberry(seed);
    for (let i = 0; i < 24; i++) {
      const person = makePerson(seed + i * 7 + 3);
      person.node.name = `town-walker-${i}`;
      this.walkers.push(new Walker(person, graph.nodes, graph.links, seed + i, Math.floor(r() * graph.nodes.length)));
      this.group.add(person.node);
    }
    for (let i = 0; i < SHOPPER_COUNT; i++) {
      const shopper = new Shopper(i);
      shopper.person.node.name = `town-shopper-${i}`;
      this.shoppers.push(shopper);
      this.group.add(shopper.person.node);
    }

    // 城内 5 台循环车：沿街区外圈闭环，不越桥、不落地到广场
    const styles: Array<"city" | "tourer" | "sport"> = ["city", "tourer", "city", "sport", "tourer"];
    for (let i = 0; i < styles.length; i++) {
      const mesh = buildCar(CAR_COLORS[(i + 1) % CAR_COLORS.length], styles[i]);
      mesh.scale.setScalar(0.98 + (i % 3) * 0.03);
      const car = new RouteCar(i / styles.length, mesh);
      this.cityCars.push(car);
      this.group.add(mesh);
    }

    // 唯一过桥车：送到售货大厅门口停车
    const van = buildCar(0xefe8d8, "tourer");
    van.scale.setScalar(1.04);
    this.delivery = new DeliveryVan(van);
    this.group.add(van);
  }
  update(dt: number, t: number) {
    for (const w of this.walkers) w.update(dt, t);
    for (const s of this.shoppers) s.update(dt, t);
    for (const c of this.cityCars) c.update(dt);
    this.delivery?.update(dt);
  }
}
