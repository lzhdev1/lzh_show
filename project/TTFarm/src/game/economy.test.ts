import { describe, expect, it } from "vitest";
import {
  CROP_XP_PER_MIN,
  CROPS,
  HARVEST_MAX,
  HARVEST_MIN,
  HERB_LIST,
  HERB_XP_PER_MIN,
  LEVEL_XP,
  MAX_LEVEL,
  MUTATION_SEED_DROP_CHANCE,
  SHOP_CROPS,
  WILD_GREENS,
  forageYieldOf,
  harvestYieldOf,
  levelFromXp,
  nextLevelXp,
  parseSeedKey,
  seedInfoOf,
  seedKey,
} from "./crops";
import { growTotal, plotMutationRevealed, settlePlotMutation, type PlotState } from "./growth";
import { MUSHROOM_LIST, MUSHROOM_PICK_XP, mushroomYieldOf } from "./mushrooms";

const LEVEL_PRICES = [60, 78, 98, 126, 160, 205, 262, 335, 430, 550, 700, 900];

describe("普通作物经济", () => {
  it("24 种普通作物按 12 级递进定价，同档同价", () => {
    expect(SHOP_CROPS).toHaveLength(24);
    for (const crop of SHOP_CROPS) {
      expect(crop.sellPrice).toBe(LEVEL_PRICES[crop.unlockLevel - 1]);
    }
    // 等级越高单价越高，不会出现倒挂
    for (let i = 1; i < LEVEL_PRICES.length; i += 1) {
      expect(LEVEL_PRICES[i]).toBeGreaterThan(LEVEL_PRICES[i - 1]);
    }
  });

  it("种子价 = 单份售价 × 60%，取整", () => {
    for (const crop of SHOP_CROPS) {
      expect(crop.seedPrice).toBe(Math.round(crop.sellPrice * 0.6));
    }
  });

  it("一块地满收 5 份，一级 300、十二级 4500", () => {
    expect(CROPS.radish.sellPrice * HARVEST_MAX).toBe(300);
    expect(CROPS.durian.sellPrice * HARVEST_MAX).toBe(4500);
  });

  it("收获份数 1–5，同一茬结果稳定", () => {
    for (let plot = 0; plot < 30; plot += 1) {
      const plantedAt = 1_700_000_000_000 + plot * 60_000;
      const first = harvestYieldOf(CROPS.radish, plot, plantedAt);
      expect(first).toBeGreaterThanOrEqual(HARVEST_MIN);
      expect(first).toBeLessThanOrEqual(HARVEST_MAX);
      expect(harvestYieldOf(CROPS.radish, plot, plantedAt)).toBe(first);
    }
    // 30 块地不应全落在同一份数
    const counts = new Set(
      Array.from({ length: 30 }, (_, plot) => harvestYieldOf(CROPS.radish, plot, 1_700_000_000_000)),
    );
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe("变异种子", () => {
  it("变异种子商店不卖，且能解析回作物与变异", () => {
    expect(MUTATION_SEED_DROP_CHANCE).toBe(0.30);
    const key = seedKey("radish", "gold");
    const info = seedInfoOf(key);
    expect(info?.id).toBe("radish");
    expect(info?.mutation).toBe("gold");
    expect(info?.shopSellable).toBe(false);
    expect(parseSeedKey(key)).toEqual({ id: "radish", mutation: "gold" });
    expect(seedInfoOf("radish")?.shopSellable).toBe(true);
    expect(seedInfoOf("radish:spirit")).toBeNull();
  });
});

describe("阶段变异", () => {
  const basePlot: PlotState = {
    id: 0,
    unlocked: true,
    crop: "radish",
    plantedAt: 1_700_000_000_000,
    watered: 0,
    mutation: null,
    plantSeed: 0,
    mutationChecked: 0,
  };

  it("播种时不会直接显示变异，发芽后才显形", () => {
    const total = growTotal("radish", 0);
    const early = { ...basePlot, plantSeed: 12345 };
    expect(plotMutationRevealed(early, basePlot.plantedAt)).toBe(false);
    const mid = settlePlotMutation(early, basePlot.plantedAt + total * 0.6);
    expect(mid.mutationChecked).toBeGreaterThanOrEqual(2);
    if (mid.mutation) {
      expect(plotMutationRevealed(mid, basePlot.plantedAt + total * 0.6)).toBe(true);
    }
  });

  it("每个阶段只判一次，命中后锁定不再改", () => {
    const total = growTotal("radish", 0);
    // 扫一个必定在发芽/成长段命中的种子
    let hit: PlotState | null = null;
    for (let seed = 1; seed < 5000 && !hit; seed += 1) {
      const plot = { ...basePlot, plantSeed: seed };
      const grown = settlePlotMutation(plot, basePlot.plantedAt + total * 0.51);
      if (grown.mutation) hit = grown;
    }
    expect(hit).not.toBeNull();
    const locked = hit as PlotState;
    expect(locked.mutationChecked).toBe(3);
    const mature = settlePlotMutation(locked, basePlot.plantedAt + total);
    expect(mature.mutation).toBe(locked.mutation);
    expect(mature.plantSeed).toBe(locked.plantSeed);
  });

  it("不浇水的总时长与浇水加速后的进度一致", () => {
    expect(growTotal("radish", 0)).toBe(CROPS.radish.growMs);
    expect(growTotal("radish", 25)).toBe(CROPS.radish.growMs * 0.5);
  });
});

describe("野菜、草药与蘑菇经济", () => {
  it("野菜 20 种：60 → 500 递进，生长 3 分钟 → 60 分钟", () => {
    expect(WILD_GREENS).toHaveLength(20);
    const prices = [...WILD_GREENS].sort((a, b) => a.sellPrice - b.sellPrice).map((crop) => crop.sellPrice);
    expect(prices[0]).toBe(60);
    expect(prices[prices.length - 1]).toBe(500);
    for (let i = 1; i < prices.length; i += 1) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    const grows = [...WILD_GREENS].sort((a, b) => a.growMs - b.growMs).map((crop) => crop.growMs);
    expect(grows[0]).toBe(3 * 60_000);
    expect(grows[grows.length - 1]).toBe(60 * 60_000);
    for (let i = 1; i < grows.length; i += 1) expect(grows[i]).toBeGreaterThan(grows[i - 1]);
  });

  it("草药 50 种：600 → 25,800 递进，生长 1 小时 → 36 小时", () => {
    expect(HERB_LIST).toHaveLength(50);
    const sorted = [...HERB_LIST].sort((a, b) => a.sellPrice - b.sellPrice);
    expect(sorted[0].sellPrice).toBe(600);
    expect(sorted[sorted.length - 1].sellPrice).toBe(25_800);
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i].sellPrice).toBeGreaterThan(sorted[i - 1].sellPrice);
    expect(sorted[0].growMs).toBe(60 * 60_000);
    expect(sorted[sorted.length - 1].growMs).toBe(36 * 60 * 60_000);
  });

  it("蘑菇 100 种：30 → 6,666，采 1–3 份", () => {
    const prices = MUSHROOM_LIST.map((item) => item.price);
    expect(Math.min(...prices)).toBe(30);
    expect(Math.max(...prices)).toBe(6_666);
    for (let i = 0; i < 200; i += 1) {
      const count = mushroomYieldOf();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it("采摘份数：野菜 1–4，草药固定 1", () => {
    for (let i = 0; i < 200; i += 1) {
      const count = forageYieldOf(CROPS.jicai);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(4);
      expect(forageYieldOf(CROPS.renshen)).toBe(1);
    }
    // 种回地里也走同一套区间
    expect(harvestYieldOf(CROPS.renshen, 0, 1)).toBe(1);
    const wild = harvestYieldOf(CROPS.jicai, 0, 1);
    expect(wild).toBeGreaterThanOrEqual(1);
    expect(wild).toBeLessThanOrEqual(4);
  });
});

describe("经验系统", () => {
  it("30 级封顶：100 → 90,000，累计 416,930", () => {
    expect(MAX_LEVEL).toBe(30);
    expect(LEVEL_XP).toHaveLength(30);
    expect(LEVEL_XP[1] - LEVEL_XP[0]).toBe(100);
    expect(LEVEL_XP[29] - LEVEL_XP[28]).toBe(90_000);
    expect(LEVEL_XP[29]).toBe(416_930);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(4_909)).toBe(11);
    expect(levelFromXp(4_910)).toBe(12);
    expect(levelFromXp(416_929)).toBe(29);
    expect(levelFromXp(416_930)).toBe(30);
    expect(levelFromXp(9_999_999)).toBe(30);
    expect(nextLevelXp(29)).toBe(416_930);
    expect(nextLevelXp(30)).toBeNull();
  });

  it("12 级前解锁全部 24 种普通作物", () => {
    expect(CROP_XP_PER_MIN).toBeCloseTo(600 / 1080, 6);
    expect(HERB_XP_PER_MIN).toBeCloseTo(300 / 1080, 6);
    for (const crop of SHOP_CROPS) expect(crop.unlockLevel).toBeLessThanOrEqual(12);
  });

  it("普通作物经验：萝卜 2、榴莲 600，按分钟四舍五入", () => {
    expect(CROPS.radish.xp).toBe(2);
    expect(CROPS.cabbage.xp).toBe(3);
    expect(CROPS.strawberry.xp).toBe(31);
    expect(CROPS.watermelon.xp).toBe(42);
    expect(CROPS.durian.xp).toBe(600);
    for (const crop of SHOP_CROPS) {
      const expected = Math.round((crop.growMs / 60_000) * CROP_XP_PER_MIN);
      expect(crop.xp).toBe(expected);
    }
  });

  it("野菜同系数，草药减半；蘑菇固定 15", () => {
    expect(CROPS.huihuicai.xp).toBe(2);
    expect(CROPS.xiangchun.xp).toBe(33);
    expect(CROPS.qiai.xp).toBe(17);
    expect(CROPS.renshen.xp).toBe(600);
    for (const crop of WILD_GREENS) {
      expect(crop.xp).toBe(Math.round((crop.growMs / 60_000) * CROP_XP_PER_MIN));
    }
    for (const crop of HERB_LIST) {
      expect(crop.xp).toBe(Math.round((crop.growMs / 60_000) * HERB_XP_PER_MIN));
    }
    expect(MUSHROOM_PICK_XP).toBe(15);
  });
});
