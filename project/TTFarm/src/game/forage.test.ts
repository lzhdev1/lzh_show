import { describe, expect, it } from "vitest";
import {
  FORAGE_BATCH_COUNT, FORAGE_MUTATION_CHANCE, FORAGE_MUTATION_SEED_CHANCE, FORAGE_SEED_CHANCE,
  HERB_GROUND_CAP, HERB_TIER_CHANCE, HERB_SPAWN_MS,
  advanceForage, forageMutationSeedChance, forageSeedChance, normalizeForage, wildPatchesAt,
} from "./forage";
import { CROPS, HERB_TIER } from "./crops";

describe("野外刷新", () => {
  it("野菜每轮固定 10 株，slot 落在 0–14，同一轮内不变、换轮整批作废", () => {
    const now = 1_800_000_000_000;
    const batch = wildPatchesAt(now);
    expect(batch).toHaveLength(FORAGE_BATCH_COUNT);
    expect(new Set(batch.map((p) => p.slot)).size).toBe(FORAGE_BATCH_COUNT);
    for (const patch of batch) {
      expect(patch.slot).toBeGreaterThanOrEqual(0);
      expect(patch.slot).toBeLessThan(15);
      expect(CROPS[patch.crop].herb).toBeFalsy();
      expect(patch.source).toBe("wild");
    }
    expect(wildPatchesAt(now + 60_000)).toBe(batch);
    const next = wildPatchesAt(now + 10 * 60_000);
    expect(next).not.toBe(batch);
    expect(next.every((p) => p.id !== batch[0].id)).toBe(true);
  });

  it("每 5 分钟长一株草药，最多同时 15 株，id 不重复", () => {
    const start = 1_800_000_000_000 - (1_800_000_000_000 % HERB_SPAWN_MS);
    let state = advanceForage(normalizeForage(undefined), start);
    for (let i = 1; i <= 30; i += 1) state = advanceForage(state, start + i * HERB_SPAWN_MS);
    expect(state.herbs).toHaveLength(HERB_GROUND_CAP);
    expect(new Set(state.herbs.map((h) => h.id)).size).toBe(HERB_GROUND_CAP);
    expect(new Set(state.herbs.map((h) => h.slot)).size).toBe(HERB_GROUND_CAP);
    for (const herb of state.herbs) {
      expect(herb.source).toBe("herb");
      expect(CROPS[herb.crop].herb).toBe(true);
    }
  });

  it("草药档位概率约为常见 70% / 中档 20% / 珍稀 10%", () => {
    let state = normalizeForage({ herbSeed: 123456, herbTick: 0, herbCount: 0, herbs: [] });
    const counts = { common: 0, mid: 0, rare: 0 };
    for (let i = 1; i <= 600; i += 1) {
      state = advanceForage(state, i * HERB_SPAWN_MS);
      const added = state.herbs[state.herbs.length - 1];
      counts[HERB_TIER[added.crop as keyof typeof HERB_TIER]] += 1;
    }
    expect(counts.common / 600).toBeGreaterThan(0.62);
    expect(counts.common / 600).toBeLessThan(0.78);
    expect(counts.rare / 600).toBeGreaterThan(0.04);
    expect(counts.rare / 600).toBeLessThan(0.17);
    expect(HERB_TIER_CHANCE.common + HERB_TIER_CHANCE.mid + HERB_TIER_CHANCE.rare).toBeCloseTo(1);
  });

  it("掉种率：普通种子 30%，带变异额外 20% 变异种子", () => {
    expect(FORAGE_SEED_CHANCE).toBe(0.30);
    expect(FORAGE_MUTATION_SEED_CHANCE).toBe(0.20);
    expect(forageSeedChance()).toBe(FORAGE_SEED_CHANCE);
    const herb = (mutation: Parameters<typeof forageMutationSeedChance>[0]["mutation"], crop = "gouqi") => ({
      id: "h", slot: 15, crop: crop as never, mutation, source: "herb" as const,
    });
    expect(forageMutationSeedChance(herb(null))).toBe(0);
    expect(forageMutationSeedChance(herb("herbMetal"))).toBe(0.20);
    expect(forageMutationSeedChance(herb("xianpin"))).toBe(0.20);
    expect(forageMutationSeedChance(wildPatchesAt(1_800_000_000_000)[0])).toBeGreaterThanOrEqual(0);
  });

  it("旧存档只有 rotation/taken 时补出草药字段", () => {
    const state = normalizeForage({ rotation: 123, taken: [1, 9, 20] });
    expect(state.herbs).toEqual([]);
    expect(state.herbSeed).toBe(0);
    expect(state.taken).toEqual([1, 9]);
    expect(FORAGE_MUTATION_CHANCE).toBe(0.2);
  });
});
