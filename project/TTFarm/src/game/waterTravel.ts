import { MathUtils, Vector3 } from "three";
import { BRIDGE, RIVER_BED, bridgeHeightAt, riverBedHeight, riverInfo } from "../scene/layout";
import { PLAYER_RADIUS } from "../scene/obstacles";

const toe = BRIDGE.halfLength + BRIDGE.rampLength;
// Rail center offset, rail post radius and a little space for path waypoints.
const deckWidth = BRIDGE.halfWidth - PLAYER_RADIUS - 0.18 - 0.13 - 0.025;
// The central span has headroom for a swimmer. At either bank the raised
// riverbed meets the underside of the bridge and its approach embankment.
const channel = 4.15;
const side = BRIDGE.halfWidth + PLAYER_RADIUS;
const bounds = Math.hypot(toe, side) + 1;
const along = (x: number, z: number) => (x - BRIDGE.x) * BRIDGE.nx + (z - BRIDGE.z) * BRIDGE.nz;
const across = (x: number, z: number) => (z - BRIDGE.z) * BRIDGE.nx - (x - BRIDGE.x) * BRIDGE.nz;

function bridgePoint(a: number, b: number, out = new Vector3()) {
  return out.set(BRIDGE.x + a * BRIDGE.nx - b * BRIDGE.nz, out.y, BRIDGE.z + a * BRIDGE.nz + b * BRIDGE.nx);
}

export function approachPoint(end: number) {
  return bridgePoint(end * (toe + 0.55), 0);
}

/** Return the first ramp for a direct trip across the bridge from either bank. */
export function bridgeCrossing(from: Vector3, to: Vector3) {
  const start = along(from.x, from.z), end = along(to.x, to.z);
  if (start * end >= 0 || Math.min(Math.abs(start), Math.abs(end)) < toe) return;
  const fraction = start / (start - end);
  const offset = MathUtils.lerp(across(from.x, from.z), across(to.x, to.z), fraction);
  if (Math.abs(offset) <= BRIDGE.halfWidth + 2) return start < 0 ? 0 : 1;
}

export function deckPoint(point: Vector3) {
  return bridgePoint(MathUtils.clamp(along(point.x, point.z), -toe, toe),
    MathUtils.clamp(across(point.x, point.z), -deckWidth, deckWidth));
}

// Swept segment against the two solid approach embankments in bridge space.
function crossesApproach(a: number, b: number, da: number, db: number, sign: number) {
  const x = sign * a, dx = sign * da;
  if ((!dx && (x < channel || x > toe)) || (!db && Math.abs(b) > side)) return false;
  const t0 = dx ? (channel - x) / dx : -Infinity, t1 = dx ? (toe - x) / dx : Infinity;
  const s0 = db ? (-side - b) / db : -Infinity, s1 = db ? (side - b) / db : Infinity;
  return Math.max(0, Math.min(t0, t1), Math.min(s0, s1)) <= Math.min(1, Math.max(t0, t1), Math.max(s0, s1));
}

export function terrainSegment(from: Vector3, to: Vector3) {
  // Most A* edges are far from the bridge.
  if (Math.min(from.x, to.x) > BRIDGE.x + bounds || Math.max(from.x, to.x) < BRIDGE.x - bounds ||
      Math.min(from.z, to.z) > BRIDGE.z + bounds || Math.max(from.z, to.z) < BRIDGE.z - bounds) return true;
  const a = along(from.x, from.z), b = across(from.x, from.z);
  const da = along(to.x, to.z) - a, db = across(to.x, to.z) - b;
  return !crossesApproach(a, b, da, db, 1) && !crossesApproach(a, b, da, db, -1);
}

export function terrainPoint(point: Vector3) {
  const a = along(point.x, point.z), b = across(point.x, point.z), abs = Math.abs(a);
  if (abs < channel || abs > toe || Math.abs(b) > side) return point;
  const endDist = Math.min(abs - channel, toe - abs);
  if (side - Math.abs(b) < endDist) return bridgePoint(a, (Math.sign(b) || 1) * (side + 0.06));
  return bridgePoint(Math.sign(a) * (abs - channel < toe - abs ? channel - 0.06 : toe + 0.06), b);
}

export function advanceBridge(fromX: number, fromZ: number, desired: Vector3, wasOnDeck: boolean) {
  if (!wasOnDeck && (Math.abs(desired.x - BRIDGE.x) > bounds || Math.abs(desired.z - BRIDGE.z) > bounds)) return false;
  const a = along(desired.x, desired.z), b = across(desired.x, desired.z), abs = Math.abs(a);
  if (wasOnDeck) {
    if (abs > toe) return false;
    bridgePoint(a, MathUtils.clamp(b, -deckWidth, deckWidth), desired);
    return true;
  }
  const prevA = along(fromX, fromZ), prevB = across(fromX, fromZ);
  if (abs <= toe && Math.abs(prevA) >= toe - 0.00001 && prevA * a > 0 && Math.abs(b) <= deckWidth) return true;
  if (abs >= channel && abs <= toe && Math.abs(b) <= side) {
    if (Math.abs(prevB) >= side) bridgePoint(a, Math.sign(prevB) * (side + 0.0001), desired);
    else if (Math.abs(prevA) <= channel) bridgePoint(Math.sign(a) * (channel - 0.0001), b, desired);
    else if (Math.abs(prevA) >= toe) bridgePoint(Math.sign(a) * (toe + 0.0001), b, desired);
    else desired.copy(terrainPoint(desired));
  }
  return false;
}

export function sampleTravelSurface(x: number, z: number, onDeck: boolean, fieldHeightAt: (x: number, z: number) => number) {
  const waterY = RIVER_BED.waterY;
  const deck = onDeck ? bridgeHeightAt(x, z) : undefined;
  // 干地优先用 fieldHeightAt：农场台地、城外土丘、大厅台阶都靠它抬脚；
  // 只有它没有正高度时才退回河床，避免把水面也抬到 0。
  const dryY = fieldHeightAt(x, z);
  const floorY = deck ?? (dryY > 0 ? dryY : riverBedHeight(riverInfo(x, z).dist));
  return { floorY, waterY, depth: Math.max(0, waterY - floorY) };
}
