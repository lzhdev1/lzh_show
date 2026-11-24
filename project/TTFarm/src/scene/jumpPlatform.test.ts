import { describe, expect, it } from "vitest";
import { WorldObstacles } from "./obstacles";

describe("jumpable obstacle tops", () => {
  it("only ignores a footprint once the feet clear its top", () => {
    const obstacles = new WorldObstacles();
    obstacles.addCircle(0, 0, 0.4, "terrain", 0.5);
    expect(obstacles.canWalk({ x: -1, z: 0 }, { x: 1, z: 0 }, "terrain", 0)).toBe(false);
    expect(obstacles.canWalk({ x: -1, z: 0 }, { x: 1, z: 0 }, "terrain", 0.4)).toBe(false);
    expect(obstacles.canWalk({ x: -1, z: 0 }, { x: 1, z: 0 }, "terrain", 0.6)).toBe(true);
  });

  it("returns the highest top under the player without grabbing a taller platform above", () => {
    const obstacles = new WorldObstacles();
    obstacles.addCircle(0, 0, 0.3, "terrain", 0.35);
    obstacles.addCircle(0, 0, 0.3, "terrain", 0.85);
    expect(obstacles.platformTopAt(0, 0, 0.9)).toBe(0.85);
    expect(obstacles.platformTopAt(0, 0, 0.5)).toBe(0.35);
    expect(obstacles.platformTopAt(2, 0, 0.9)).toBeUndefined();
  });
});
