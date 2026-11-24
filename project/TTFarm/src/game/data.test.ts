import { describe, expect, it } from "vitest";
import { CROPS } from "./crops";
import { FISH_LIST, FISH_TOTAL, fishById, normalizeFishingState, rodById } from "./fish";
import { MUSHROOM_LIST } from "./mushrooms";
import { BOOST_CARDS, BAITS, baitById, boostCardById, normalizeShopExtras } from "./items";
import { CODEX_ANIMALS, CODEX_FISH, CODEX_MUSHROOMS, CODEX_MUTATIONS, CODEX_PLANTS } from "./codex";

describe("game data catalogs", () => {
  it("keeps crop keys, unlock levels and growth values internally consistent", () => {
    const crops = Object.entries(CROPS);
    expect(crops).toHaveLength(94);
    expect(crops.filter(([, crop]) => crop.wild)).toHaveLength(20);
    expect(crops.filter(([, crop]) => crop.herb)).toHaveLength(50);
    for (const [key, crop] of crops) {
      expect(crop.id, key).toBe(key);
      expect(crop.growMs).toBeGreaterThan(0);
      expect(crop.yields).toBeGreaterThan(0);
      expect(crop.unlockLevel).toBeGreaterThanOrEqual(1);
      expect(crop.unlockLevel).toBeLessThanOrEqual(15);
      expect(crop.xp).toBeGreaterThanOrEqual(0);
    }
  });

  it("has unique fish, mushrooms, boosts and baits", () => {
    for (const [list, label] of [[FISH_LIST, "fish"], [MUSHROOM_LIST, "mushroom"], [BOOST_CARDS, "boost"], [BAITS, "bait"]] as const) {
      expect(new Set(list.map((item) => item.id)).size, label).toBe(list.length);
    }
    expect(FISH_TOTAL).toBe(50);
    expect(MUSHROOM_LIST).toHaveLength(100);
  });

  it("rejects prototype keys in fishing state", () => {
    expect(fishById("toString")).toBeNull();
    expect(rodById("constructor")).toBeNull();
    expect(normalizeFishingState({ rod: "toString", fish: { toString: 2, "jiyu": 1 } }))
      .toEqual({ rod: null, fish: { jiyu: 1 } });
  });

  it("rejects prototype keys in shop extras", () => {
    expect(baitById("toString")).toBeNull();
    expect(boostCardById("constructor")).toBeNull();
    expect(normalizeShopExtras({ selectedBait: "toString", materials: { toString: 3, worm: 2 } }))
      .toMatchObject({ selectedBait: null, materials: { worm: 2 } });
  });

  it("keeps the codex totals tied to the live catalogs", () => {
    expect(CODEX_PLANTS).toHaveLength(94);
    expect(CODEX_MUTATIONS).toHaveLength(27);
    expect(CODEX_ANIMALS).toHaveLength(20);
    expect(CODEX_FISH).toHaveLength(FISH_LIST.length);
    expect(CODEX_MUSHROOMS).toHaveLength(MUSHROOM_LIST.length);
  });
});
