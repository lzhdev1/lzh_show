import { describe, expect, it } from "vitest";
import { FORAGE_ANCHOR_COUNT } from "../game/forage";
import { FORAGE_ANCHORS } from "./forageAnchors";
import { inTown } from "./town/townLayout";
import { inHallParkingGround } from "./salesHallLayout";

describe("野菜/草药锚点", () => {
  it("刚好 30 个锚点，slot 与下标一一对应", () => {
    expect(FORAGE_ANCHORS).toHaveLength(FORAGE_ANCHOR_COUNT);
    const unique = new Set(FORAGE_ANCHORS.map(([x, z]) => `${x},${z}`));
    expect(unique.size).toBe(FORAGE_ANCHOR_COUNT);
  });

  it("没有落在城镇或停车场", () => {
    for (const [x, z] of FORAGE_ANCHORS) {
      expect(inTown(x, z)).toBe(false);
      expect(inHallParkingGround(x, z)).toBe(false);
    }
  });
});
