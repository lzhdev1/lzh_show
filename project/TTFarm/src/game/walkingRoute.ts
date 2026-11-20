import { Vector3 } from "three";
import type { WorldObstacles } from "../scene/obstacles";
import { approachPoint, bridgeCrossing, deckPoint, terrainPoint, terrainSegment } from "./waterTravel";

const approaches = [approachPoint(-1), approachPoint(1)];
const horizontalSq = (a: Vector3, b: Vector3) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

/** Land and water share a route. Enter and leave the elevated deck at a ramp. */
export function walkingRoute(from: Vector3, point: Vector3, obstacles: WorldObstacles,
                             fromDeck: boolean, targetDeck = false): Vector3[] {
  const goal = targetDeck ? deckPoint(point) : terrainPoint(obstacles.project(point));
  const groundRoute = (a: Vector3, b: Vector3) => obstacles.route(a, b, "terrain", terrainSegment);

  if (fromDeck && targetDeck) return [goal];
  if (fromDeck || targetDeck) {
    const ground = fromDeck ? goal : from;
    const nearest = horizontalSq(ground, approaches[0]) < horizontalSq(ground, approaches[1]) ? 0 : 1;
    for (const end of [nearest, 1 - nearest]) {
      const ramp = approaches[end];
      if (fromDeck) {
        const trail = groundRoute(ramp, goal);
        if (trail.length || horizontalSq(ramp, goal) < 1e-6) return [ramp, ...trail];
      } else {
        const trail = groundRoute(from, ramp);
        if (trail.length || horizontalSq(from, ramp) < 1e-6) return [...trail, goal];
      }
    }
    return [];
  }

  // A straight trip across both approaches uses the bridge. Swimmers and
  // people crossing elsewhere can travel directly through the river.
  const start = bridgeCrossing(from, goal);
  if (start !== undefined) {
    const farRamp = approaches[1 - start];
    const first = groundRoute(from, approaches[start]);
    const last = groundRoute(farRamp, goal);
    if (first.length && last.length) return [...first, farRamp, ...last];
  }
  return groundRoute(from, goal);
}
