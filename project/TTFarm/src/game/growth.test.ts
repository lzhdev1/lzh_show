import { describe, expect, it } from "vitest";
import { CROPS, SHOP_CROPS } from "./crops";
import {
  applyGuestWater,
  applySelfWater,
  canShowWaterHint,
  formatCountdown,
  GUEST_WATER_PER_WINDOW,
  growTotal,
  guestWaterGate,
  MAX_WATER,
  MIN_GROW_RATIO,
  resetWater,
  SEED_WATER_FREE,
  selfWaterGate,
  SELF_WATER_PER_WINDOW,
  WATER_BOOST,
  WATER_WINDOW_MS,
  type PlotState,
} from "./growth";

const HOUR = WATER_WINDOW_MS;
const plot = (patch: Partial<PlotState> = {}): PlotState => ({
  id: 0,
  unlocked: true,
  crop: "radish",
  plantedAt: 1_000,
  watered: 0,
  mutation: null,
  selfWater: [],
  selfWaterTotal: 0,
  guestWater: null,
  ...patch,
});

describe("普通作物生长时间", () => {
  const isFlower = (id: string) => id === "tulip" || id === "lily" || id.startsWith("rose");

  it("24 种商店作物：花卉统一 20 分钟，其余时间越长的解锁等级越高，榴莲 18 小时封顶", () => {
    expect(SHOP_CROPS).toHaveLength(24);
    const flowers = SHOP_CROPS.filter((crop) => isFlower(crop.id));
    expect(flowers).toHaveLength(8);
    for (const crop of flowers) {
      expect(crop.growMs, `${crop.name} 应为 20 分钟`).toBe(20 * 60_000);
    }

    const order = SHOP_CROPS.filter((crop) => !isFlower(crop.id)).sort((a, b) => a.growMs - b.growMs);
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i].growMs, `${order[i].name} 应不早于 ${order[i - 1].name}`)
        .toBeGreaterThanOrEqual(order[i - 1].growMs);
      expect(order[i].unlockLevel, `${order[i].name} 的解锁等级`).toBeGreaterThanOrEqual(order[i - 1].unlockLevel);
    }
    expect(CROPS.radish.growMs).toBe(3 * 60_000);
    expect(CROPS.durian.growMs).toBe(18 * 60 * 60_000);
  });

  it("每次浇水缩短 2%，25 次封在基准时长的一半", () => {
    expect(WATER_BOOST).toBe(0.02);
    expect(growTotal("durian", 0)).toBe(CROPS.durian.growMs);
    expect(growTotal("durian", 1)).toBeCloseTo(CROPS.durian.growMs * 0.98, 0);
    expect(growTotal("durian", MAX_WATER)).toBeCloseTo(CROPS.durian.growMs * MIN_GROW_RATIO, 0);
    expect(growTotal("durian", MAX_WATER + 10)).toBeCloseTo(CROPS.durian.growMs * MIN_GROW_RATIO, 0);
  });
});

describe("作物成熟倒计时", () => {
  it("统一显示时:分:秒，小时不封顶", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(1_000)).toBe("00:00:01");
    expect(formatCountdown(3_600_000)).toBe("01:00:00");
    expect(formatCountdown(36 * 3_600_000)).toBe("36:00:00");
    expect(formatCountdown(-1_000)).toBe("00:00:00");
  });
});

describe("自己的浇水配额", () => {
  it("刚播下可以连浇 3 次", () => {
    let p = plot();
    for (let i = 0; i < SEED_WATER_FREE; i += 1) {
      expect(selfWaterGate(p, 2_000).ok).toBe(true);
      p = applySelfWater(p, 2_000);
    }
    expect(p.selfWaterTotal).toBe(SEED_WATER_FREE);
    expect(p.watered).toBe(SEED_WATER_FREE);
    // 免费 3 次不占小时额度，紧接着还能按每小时 2 次继续浇
    expect(p.selfWater).toEqual([]);
    expect(selfWaterGate(p, 2_000).ok).toBe(true);
  });

  it("免费额度之后每小时 2 次，跨窗口恢复", () => {
    let p = plot({ crop: "durian" });
    for (let i = 0; i < SEED_WATER_FREE; i += 1) p = applySelfWater(p, 2_000);
    p = applySelfWater(p, 2_000); // 本小时第 1 次
    p = applySelfWater(p, 2_001); // 本小时第 2 次
    const locked = selfWaterGate(p, 2_002);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toBe("quota");
    expect(locked.waitMs).toBe(WATER_WINDOW_MS - 2);
    // 等第一个窗口滑出后恢复
    expect(selfWaterGate(p, 2_000 + HOUR + 1).ok).toBe(true);
    expect(SELF_WATER_PER_WINDOW).toBe(2);
  });

  it("成熟后、空地和到上限都不能浇", () => {
    expect(selfWaterGate(plot({ crop: null }), 2_000).reason).toBe("empty");
    expect(selfWaterGate(plot({ watered: MAX_WATER }), 2_000).reason).toBe("cap");
    const ripe = plot({ plantedAt: 2_000 - CROPS.radish.growMs });
    expect(selfWaterGate(ripe, 2_000).reason).toBe("ready");
  });
});

describe("浇水标识按查看者判断", () => {
  it("自己浇到本小时上限后自己看不到，但好友仍能看到", () => {
    let p = plot({ crop: "durian" });
    for (let i = 0; i < SEED_WATER_FREE; i += 1) p = applySelfWater(p, 2_000);
    p = applySelfWater(p, 2_000);
    p = applySelfWater(p, 2_001);
    expect(canShowWaterHint(p, 2_002, "self")).toBe(false);
    expect(canShowWaterHint(p, 2_002, "guest")).toBe(true);
    expect(canShowWaterHint(p, 2_002, "none")).toBe(false);
  });

  it("好友浇过之后好友看不到，主人剩余额度仍可见", () => {
    const p = applyGuestWater(plot(), 2_000, "42");
    expect(canShowWaterHint(p, 2_001, "guest")).toBe(false);
    expect(canShowWaterHint(p, 2_001, "self")).toBe(true);
    expect(canShowWaterHint(applyGuestWater(plot({ watered: MAX_WATER }), 2_000, "42"), 2_001, "self")).toBe(false);
  });

  it("成熟后谁都不显示浇水标识", () => {
    const ripe = plot({ plantedAt: 2_000 - CROPS.radish.growMs });
    expect(canShowWaterHint(ripe, 2_000, "self")).toBe(false);
    expect(canShowWaterHint(ripe, 2_000, "guest")).toBe(false);
  });
});

describe("朋友帮浇的互斥", () => {
  it("一个朋友浇完后，当小时其他朋友不能再浇", () => {
    const p = plot();
    expect(guestWaterGate(p, 2_000).ok).toBe(true);
    const watered = applyGuestWater(p, 2_000, "42");
    expect(watered.guestWater).toEqual({ by: "42", t: 2_000 });
    const locked = guestWaterGate(watered, 2_000 + 60_000);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toBe("quota");
    expect(locked.waitMs).toBe(HOUR - 60_000);
  });

  it("每小时窗口重新开放一次", () => {
    const p = applyGuestWater(plot({ crop: "durian" }), 2_000, "42");
    expect(guestWaterGate(p, 2_000 + HOUR).ok).toBe(true);
    expect(GUEST_WATER_PER_WINDOW).toBe(1);
  });

  it("播种与收获都会清空浇水记录", () => {
    const planted = resetWater(plot({ watered: 9, selfWater: [1, 2], selfWaterTotal: 5, guestWater: { by: "7", t: 3 } }), 5_000, false);
    expect(planted).toMatchObject({ plantedAt: 5_000, watered: 0, selfWater: [], selfWaterTotal: 0, guestWater: null });
    expect(resetWater(plot(), 5_000, true).watered).toBe(1);
  });
});
