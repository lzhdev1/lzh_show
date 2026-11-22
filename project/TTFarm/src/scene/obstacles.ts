import { MathUtils, Vector3, type Mesh } from "three";
import { WORLD_HALF } from "./layout";

export const PLAYER_RADIUS = 0.32;
export type CollisionLayer = "terrain" | "deck";
type Point = { x: number; z: number };
type Edge = Point & { nx: number; nz: number; length: number };
type Footprint = {
  x: number; z: number; radius: number; edges?: Edge[]; layer?: CollisionLayer;
  xmin: number; xmax: number; zmin: number; zmax: number; stamp: number;
};
type Hit = { time: number; nx: number; nz: number };
const SKIN = 0.002;
const CELL = 8;
const BINS = 1 + Math.floor(2 * WORLD_HALF / CELL);
const bin = (value: number) => MathUtils.clamp(Math.floor((value + WORLD_HALF) / CELL), 0, BINS - 1);
const clamp = (value: number) => MathUtils.clamp(value, -WORLD_HALF, WORLD_HALF);

// A navigation grid is consulted only for blocked clicks. Physics always sweeps the
// full displacement against continuous footprints, independently of the grid pitch.
const STEP = 1.25;
const WIDTH = 1 + Math.round(WORLD_HALF * 2 / STEP);
const gridX = (id: number) => id % WIDTH * STEP - WORLD_HALF;
const gridZ = (id: number) => Math.floor(id / WIDTH) * STEP - WORLD_HALF;
const directions = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];

function overlaps(shape: Footprint, x: number, z: number) {
  if (!shape.edges) return (x - shape.x) ** 2 + (z - shape.z) ** 2 < shape.radius ** 2;
  let inside = false;
  for (const e of shape.edges) {
    const dx = x - e.x, dz = z - e.z;
    const along = MathUtils.clamp(-dx * e.nz + dz * e.nx, 0, e.length);
    if ((dx + along * e.nz) ** 2 + (dz - along * e.nx) ** 2 < PLAYER_RADIUS ** 2) return true;
    const endZ = e.z + e.nx * e.length;
    if ((z < e.z) !== (z < endZ) && x < e.x - e.nz * (z - e.z) / e.nx) inside = !inside;
  }
  return inside;
}

function sweepDisc(x: number, z: number, dx: number, dz: number, radius: number, hit: Hit) {
  const speedSq = dx * dx + dz * dz, dot = x * dx + z * dz;
  if (dot >= 0 || !speedSq) return;
  const discriminant = dot * dot - speedSq * (x * x + z * z - radius * radius);
  if (discriminant <= 0) return;
  const t = (-dot - Math.sqrt(discriminant)) / speedSq;
  if (t < -1e-7 || t >= hit.time) return;
  hit.time = Math.max(0, t);
  hit.nx = (x + dx * t) / radius;
  hit.nz = (z + dz * t) / radius;
}

function sweep(shape: Footprint, x: number, z: number, dx: number, dz: number, hit: Hit) {
  if (!shape.edges) {
    sweepDisc(x - shape.x, z - shape.z, dx, dz, shape.radius, hit);
    return;
  }
  for (const e of shape.edges) {
    const ox = x - e.x, oz = z - e.z;
    sweepDisc(ox, oz, dx, dz, PLAYER_RADIUS, hit);
    const approach = dx * e.nx + dz * e.nz;
    if (approach >= -1e-12) continue;
    const t = (PLAYER_RADIUS - ox * e.nx - oz * e.nz) / approach;
    if (t < -1e-7 || t >= hit.time) continue;
    const along = -(ox + t * dx) * e.nz + (oz + t * dz) * e.nx;
    if (along < 0 || along > e.length) continue;
    hit.time = Math.max(0, t);
    hit.nx = e.nx;
    hit.nz = e.nz;
  }
}

/** Spatial index for solid footprints. Only objects in the swept cells enter the narrow phase. */
export class WorldObstacles {
  private readonly bins: Footprint[][] = Array.from({length: BINS * BINS}, () => []);
  private stamp = 0;
  private readonly hit: Hit = { time: 1, nx: 0, nz: 0 };

  private add(shape: Footprint) {
    if (shape.xmax < -WORLD_HALF || shape.xmin > WORLD_HALF ||
        shape.zmax < -WORLD_HALF || shape.zmin > WORLD_HALF) return;
    for (let z = bin(shape.zmin); z <= bin(shape.zmax); z++)
      for (let x = bin(shape.xmin); x <= bin(shape.xmax); x++) this.bins[z * BINS + x].push(shape);
  }

  addCircle(x: number, z: number, radius: number, layer?: CollisionLayer) {
    const r = radius + PLAYER_RADIUS;
    this.add({x, z, radius: r, layer, xmin: x-r, xmax: x+r, zmin: z-r, zmax: z+r, stamp: 0});
  }

  private addPolygon(points: Point[], layer?: CollisionLayer) {
    if (points.length < 3) return;
    let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
    const edges: Edge[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx,dz);
      if (length < 1e-5) continue;
      edges.push({x: a.x, z: a.z, nx: dz / length, nz: -dx / length, length});
      xmin = Math.min(xmin, a.x); xmax = Math.max(xmax, a.x);
      zmin = Math.min(zmin, a.z); zmax = Math.max(zmax, a.z);
    }
    const shape = {x: 0, z: 0, radius: 0, edges, layer, xmin: xmin - PLAYER_RADIUS,
      xmax: xmax + PLAYER_RADIUS, zmin: zmin - PLAYER_RADIUS, zmax: zmax + PLAYER_RADIUS, stamp: 0};
    this.add(shape);
    return shape;
  }

  addBox(x: number, z: number, halfX: number, halfZ: number, yaw = 0, layer?: CollisionLayer) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const shape = this.addPolygon([[-halfX,-halfZ],[halfX,-halfZ],[halfX,halfZ],[-halfX,halfZ]].map(([u,v]) =>
      ({x: x + cos*u + sin*v, z: z - sin*u + cos*v})), layer);
    return () => {
      if (!shape) return;
      for (let row = bin(shape.zmin); row <= bin(shape.zmax); row++) {
        for (let col = bin(shape.xmin); col <= bin(shape.xmax); col++) {
          const cell = this.bins[row * BINS + col];
          const index = cell.indexOf(shape);
          if (index >= 0) cell.splice(index, 1);
        }
      }
    };
  }

  /** Each peak and foothill is star-shaped. Slice its actual transformed triangles at
   * ground level so hollows and gaps survive the render batching of multiple mountains. */
  addMountainSection(mesh: Mesh) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
    const vertices = Array.from({length: position.count}, (_, i) =>
      new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    const contour = new Map<string, Point>();
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      for (let side = 0; side < 3; side++) {
        const u = i + side, v = i + (side + 1) % 3;
        const a = vertices[index ? index.getX(u) : u], b = vertices[index ? index.getX(v) : v];
        if ((a.y < 0) === (b.y < 0)) continue;
        const t = -a.y / (b.y - a.y);
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        contour.set(Math.round(x * 1e4) + "," + Math.round(z * 1e4), {x,z});
      }
    }
    const points = [...contour.values()];
    const center = new Vector3().setFromMatrixPosition(mesh.matrixWorld);
    points.sort((a,b) => Math.atan2(a.z-center.z,a.x-center.x) - Math.atan2(b.z-center.z,b.x-center.x));
    this.addPolygon(points);
  }

  private visit(xmin: number, xmax: number, zmin: number, zmax: number, layer: CollisionLayer,
    test: (shape: Footprint) => boolean) {
    const stamp = ++this.stamp;
    for (let row = bin(zmin); row <= bin(zmax); row++) {
      for (let col = bin(xmin); col <= bin(xmax); col++) {
        for (const shape of this.bins[row * BINS + col]) {
          if (shape.stamp === stamp) continue;
          shape.stamp = stamp;
          if ((shape.layer && shape.layer !== layer) || shape.xmin > xmax || shape.xmax < xmin ||
              shape.zmin > zmax || shape.zmax < zmin) continue;
          if (test(shape)) return true;
        }
      }
    }
    return false;
  }

  private blocked(x: number, z: number, layer: CollisionLayer) {
    return this.visit(x, x, z, z, layer, shape => overlaps(shape, x, z));
  }

  private trace(x: number, z: number, dx: number, dz: number, layer: CollisionLayer) {
    const hit = this.hit;
    hit.time = 1;
    this.visit(Math.min(x,x+dx), Math.max(x,x+dx), Math.min(z,z+dz), Math.max(z,z+dz), layer, shape => {
      sweep(shape, x, z, dx, dz, hit);
      return hit.time === 0;
    });
    return hit;
  }

  canWalk(a: Point, b: Point, layer: CollisionLayer = "terrain") {
    if (Math.abs(b.x) > WORLD_HALF || Math.abs(b.z) > WORLD_HALF ||
        this.blocked(a.x,a.z,layer) || this.blocked(b.x,b.z,layer)) return false;
    return this.trace(a.x, a.z, b.x-a.x, b.z-a.z, layer).time === 1;
  }

  /**
   * 大半径占位检测：中心 + 圆周 8 点。给车辆用，避免只用一个点就穿过墙角。
   * 圆形近似比车辆包围盒稍保守，但驾驶时不会明显卡顿。
   */
  canOccupy(x: number, z: number, radius: number, layer: CollisionLayer = "terrain"): boolean {
    if (Math.abs(x) > WORLD_HALF || Math.abs(z) > WORLD_HALF) return false;
    if (this.blocked(x, z, layer)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (this.blocked(x + Math.cos(a) * radius, z + Math.sin(a) * radius, layer)) return false;
    }
    return true;
  }

  /** Mutates only desired.x/z. The unused displacement slides along the contact;
   * subsequent sweeps stop a slide at a second wall or at a concave corner. */
  move(from: Point, desired: Point, layer: CollisionLayer = "terrain") {
    let x = from.x, z = from.z;
    let dx = clamp(desired.x) - x, dz = clamp(desired.z) - z;
    for (let pass = 0; pass < 4; pass++) {
      const length = Math.hypot(dx,dz);
      if (length < 1e-8) break;
      const hit = this.trace(x, z, dx, dz, layer);
      if (hit.time === 1) { x += dx; z += dz; break; }
      const advance = Math.max(0, hit.time - SKIN / length);
      x += dx * advance; z += dz * advance;
      dx *= 1 - advance; dz *= 1 - advance;
      const into = dx*hit.nx + dz*hit.nz;
      dx -= hit.nx * into; dz -= hit.nz * into;
      dx = clamp(x + dx) - x; dz = clamp(z + dz) - z;
    }
    desired.x = x; desired.z = z;
  }

  project(point: Point, layer: CollisionLayer = "terrain"): Vector3 {
    const x = clamp(point.x), z = clamp(point.z);
    if (!this.blocked(x,z,layer)) return new Vector3(x,0,z);
    // Find exposed ground even inside overlapping mountain skirts at the map edge.
    // Approach from there until first contact, leaving a small skin for subsequent sweeps.
    let nearest = Infinity, bx = x, bz = z;
    for (let ring = 1; ring <= WIDTH && (ring - 1) * STEP < nearest; ring++) {
      const check = (i: number, j: number) => {
        const px = x + i * STEP, pz = z + j * STEP, d = Math.hypot(px-x,pz-z);
        if (d >= nearest || Math.abs(px) > WORLD_HALF || Math.abs(pz) > WORLD_HALF ||
            this.blocked(px,pz,layer)) return;
        nearest = d; bx = px; bz = pz;
      };
      for (let i = -ring; i <= ring; i++) {
        check(i,-ring); check(i,ring);
        if (Math.abs(i) < ring) { check(-ring,i); check(ring,i); }
      }
    }
    const dx = x-bx, dz = z-bz;
    const hit = this.trace(bx,bz,dx,dz,layer);
    const t = Math.max(0, hit.time - SKIN / nearest);
    return new Vector3(bx + t * dx, 0, bz + t * dz);
  }

  route(from: Vector3, point: Vector3, layer: CollisionLayer = "terrain",
    allowSegment?: (a: Vector3, b: Vector3) => boolean): Vector3[] {
    const goal = this.project(point, layer);
    const clear = (a: Vector3,b: Vector3) => this.canWalk(a,b,layer) && (!allowSegment || allowSegment(a,b));
    if (clear(from,goal)) return [goal];
    const a = new Vector3(), b = new Vector3();
    const costs = new Map<number,number>(), previous = new Map<number,number>();
    const queue = new RouteQueue();
    const push = (id: number, cost: number, parent: number) => {
      costs.set(id,cost); previous.set(id,parent);
      // A slight goal bias keeps a cross-map click from expanding thousands of
      // equivalent staircases. The final visibility pass removes grid stair-steps.
      const dx = Math.abs(gridX(id)-goal.x), dz = Math.abs(gridZ(id)-goal.z);
      const octile = Math.max(dx,dz) + (Math.SQRT2 - 1) * Math.min(dx,dz);
      queue.push({id, cost, score: cost + 1.06 * octile});
    };
    const sx = Math.round((from.x + WORLD_HALF)/STEP), sz = Math.round((from.z + WORLD_HALF)/STEP);
    for (let z = Math.max(0,sz-1); z <= Math.min(WIDTH-1,sz+1); z++) {
      for (let x = Math.max(0,sx-1); x <= Math.min(WIDTH-1,sx+1); x++) {
        const id = z * WIDTH + x;
        b.set(gridX(id),0,gridZ(id));
        if (clear(from,b)) push(id,Math.hypot(from.x-b.x,from.z-b.z),-1);
      }
    }
    while (queue.length) {
      const {id, cost} = queue.pop();
      if (cost !== costs.get(id)) continue;
      a.set(gridX(id),0,gridZ(id));
      if (Math.abs(a.x-goal.x) <= 2*STEP && Math.abs(a.z-goal.z) <= 2*STEP && clear(a,goal)) {
        const chain: Vector3[] = [goal];
        for (let n = id; n >= 0; n = previous.get(n)!) chain.push(new Vector3(gridX(n),0,gridZ(n)));
        chain.reverse();
        const path: Vector3[] = [];
        let anchor = from;
        for (let i = 0; i < chain.length; i++) {
          if (i > 0 && !clear(anchor,chain[i])) {
            anchor = chain[i-1]; path.push(anchor);
          }
        }
        path.push(goal);
        return path;
      }
      const col = id % WIDTH, row = Math.floor(id / WIDTH);
      for (const [dx,dz] of directions) {
        const x = col + dx, z = row + dz;
        if (x < 0 || x >= WIDTH || z < 0 || z >= WIDTH) continue;
        const next = z * WIDTH + x, distance = cost + STEP * (dx && dz ? Math.SQRT2 : 1);
        if (distance >= (costs.get(next) ?? Infinity) - 1e-8) continue;
        b.set(gridX(next),0,gridZ(next));
        if (clear(a,b)) push(next,distance,id);
      }
    }
    return [];
  }
}

interface Entry { id: number; score: number; cost: number }
class RouteQueue {
  private entries: Entry[] = [];
  get length() { return this.entries.length; }
  push(entry: Entry) {
    let i = this.entries.length;
    this.entries.push(entry);
    while (i > 0) {
      const parent = (i-1) >> 1;
      if (this.entries[parent].score <= entry.score) break;
      this.entries[i] = this.entries[parent]; i = parent;
    }
    this.entries[i] = entry;
  }
  pop(): Entry {
    const root = this.entries[0], last = this.entries.pop()!;
    if (!this.entries.length) return root;
    let i = 0;
    while (2*i+1 < this.entries.length) {
      let child = 2*i+1;
      if (child+1 < this.entries.length && this.entries[child+1].score < this.entries[child].score) child++;
      if (this.entries[child].score >= last.score) break;
      this.entries[i] = this.entries[child]; i = child;
    }
    this.entries[i] = last;
    return root;
  }
}
