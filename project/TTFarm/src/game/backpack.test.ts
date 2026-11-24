import { describe, expect, it } from "vitest";
import { backpackSlots, bagAddCheck, bagStackSlots, bagUsedSlots, normalizeBackpackLevel } from "./backpack";

describe("backpack capacity", () => {
  it("normalizes bad levels and scales slots per level", () => {
    expect(normalizeBackpackLevel(undefined)).toBe(1);
    expect(normalizeBackpackLevel(0)).toBe(1);
    expect(normalizeBackpackLevel(99)).toBe(15);
    expect(backpackSlots(1)).toBe(30);
    expect(backpackSlots(15)).toBe(170);
  });

  it("counts stacks instead of raw item counts", () => {
    expect(bagStackSlots(0)).toBe(0);
    expect(bagStackSlots(999)).toBe(1);
    expect(bagStackSlots(1000)).toBe(2);
    expect(bagUsedSlots({ radish: 999, cabbage: 1000 })).toBe(3);
  });

  it("rejects an addition that would exceed the category slots", () => {
    const full = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`item${index}`, 1]));
    expect(bagAddCheck(full, "new", 1, 1).ok).toBe(false);
    expect(bagAddCheck({ radish: 998 }, "radish", 1, 1).ok).toBe(true);
    const nearlyFull = { ...Object.fromEntries(Array.from({ length: 29 }, (_, index) => [`item${index}`, 1])), radish: 999 };
    expect(bagAddCheck(nearlyFull, "radish", 1, 1).ok).toBe(false);
  });
});
