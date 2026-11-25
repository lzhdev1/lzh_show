import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { Player } from "./player";
import { WorldObstacles } from "./obstacles";

describe("jumping onto walkable terrain", () => {
  it("keeps the feet above a rising mound instead of sinking and popping back up", () => {
    const obstacles = new WorldObstacles();
    const ramp = (x: number) => (x <= 0 ? 0 : Math.min(0.9, x * 1.8));
    const player = new Player("xiaosui", obstacles, (x) => ramp(x), "field", "field", true, false);
    player.relocate(-0.55, 0, 0);
    player.jump();

    const forward = new Vector3(1, 0, 0);
    let minClearance = Infinity;
    for (let i = 0; i < 120; i++) {
      player.update(1 / 60, i / 60, forward, true);
      minClearance = Math.min(minClearance, player.root.position.y - ramp(player.positionRef.x));
    }

    expect(player.isJumping).toBe(false);
    expect(minClearance).toBeGreaterThanOrEqual(-0.001);
    expect(player.root.position.y).toBeGreaterThan(0.85);
  });
});
