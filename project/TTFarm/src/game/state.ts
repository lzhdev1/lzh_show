import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CROPS, CROP_LIST, cropMutationValid, type CropId, harvestKey, harvestLots, harvestValue, levelFromXp, produceName } from "./crops";
import { isMutation, isRainy, rollHerbMutation, rollMutation, rollWildMutation, weatherAt } from "./weather";
import { MAX_WATER, isReady, PLOT_COUNT, START_UNLOCKED, type PlotState } from "./growth";
import { normalizeAppearance, type AvatarId, type OutfitId } from "./appearance";
import { DEFAULT_DECOR, normalizeDecor, type FarmDecor } from "./decor";
import { normalizeRanch, type RanchState } from "./ranch";
import { createRanchActions, type RanchActions } from "./ranchActions";
import { normalizeForage, type ForageState } from "./forage";
import { createForageActions, type ForageActions } from "./forageActions";
import { meatLots, normalizeMeat } from "./market";
import { CAR_MODELS, CAR_PAINTS, newPlate, normalizeGarage, type CarModelId, type GarageState } from "./garage";
import { backpackSlots, backpackUpgradeCost, bagAddCheck, normalizeBackpackLevel, BAG_MAX_LEVEL } from "./backpack";
export { AVATARS, type AvatarId } from "./appearance";

export { PLOT_COLS, PLOT_ROWS, PLOT_COUNT, START_UNLOCKED } from "./growth";
/** 扩建价目：从第 7 块到最后一块，越往后越贵 */
export const LAND_PRICES = [
  150, 220, 300, 420, 560, 720, 900, 1100, 1320, 1580, 1860, 2180, 2520, 2900,
  3300, 3740, 4200, 4700, 5200, 5800, 6400, 7000, 7700, 8400,
];
/** 测试期金币：先给一大笔，方便试扩建和买东西 */
export const TEST_COINS = 99_999_999;

/** 第 id 块地的扩建价（超出价目表后按最后一条算） */
export function landPriceOf(id: number): number {
  return LAND_PRICES[id - START_UNLOCKED] ?? LAND_PRICES[LAND_PRICES.length - 1];
}

export interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "warn" | "chat";
}

interface GameData {
  coins: number;
  xp: number;
  plots: PlotState[];
  seeds: Record<CropId, number>;
  harvest: Record<string, number>;
  meat: Record<string, number>;
  garage: GarageState;
  backpackLevel: number;
  nickname: string;
  avatarId: AvatarId;
  outfitId: OutfitId;
  bottomId: OutfitId;
  decor: FarmDecor;
  ranch: RanchState;
  forage: ForageState;
  selectedSeed: CropId;
}

interface GameActions extends RanchActions, ForageActions {
  selectSeed: (crop: CropId) => void;
  selectPlot: (id: number | null) => void;
  buySeed: (crop: CropId, qty?: number) => void;
  plant: (plotId: number) => void;
  water: (plotId: number) => void;
  harvestPlot: (plotId: number) => void;
  sellAll: () => void;
  /** 只卖一种蔬菜/收成，大厅柜台用 */
  sellProduce: (key: string) => void;
  /** 卖指定份数的肉品 */
  sellMeat: (key: string, count?: number) => void;
  sellAllMeat: () => void;
  /** 在星野汽车购车；成功扣金币并写入车库 */
  buyCar: (model: CarModelId, color: number) => boolean;
  setActiveCar: (id: string | null) => void;
  /** 背包升一级：四类各 +10 格，最高 15 级 */
  upgradeBackpack: () => void;
  expand: () => void;
  /** 一次扩建 count 块地（金币不够或没有空地时返回失败原因） */
  expandBy: (count: number) => boolean;
  setAppearance: (avatarId: AvatarId, outfitId: OutfitId, bottomId: OutfitId) => void;
  setDecor: (decor: FarmDecor) => void;
  resetSave: () => void;
  notify: (text: string, tone?: "ok" | "warn" | "chat", duration?: number) => void;
  dismissToast: (id: number) => void;
}

type GameStore = GameData & {
  selectedPlot: number | null;
  toasts: ToastItem[];
} & GameActions;

const emptyRecord = (value: number): Record<CropId, number> => {
  const record = {} as Record<CropId, number>;
  CROP_LIST.forEach((crop) => {
    record[crop.id] = value;
  });
  return record;
};

function makePlots(): PlotState[] {
  return Array.from({ length: PLOT_COUNT }, (_, id) => ({
    id,
    unlocked: id < START_UNLOCKED,
    crop: null,
    plantedAt: 0,
    watered: 0,
    mutation: null,
  }));
}

export function initialData(): GameData {
  return {
    coins: TEST_COINS,
    xp: 0,
    plots: makePlots(),
    seeds: { ...emptyRecord(0), radish: 3, cabbage: 2 },
    harvest: emptyRecord(0),
    meat: {},
    garage: { cars: [], activeId: null },
    backpackLevel: 1,
    nickname: "农场主",
    avatarId: "xiaosui",
    outfitId: "field",
    bottomId: "field",
    decor: { ...DEFAULT_DECOR },
    ranch: normalizeRanch(undefined),
    forage: normalizeForage(undefined),
    selectedSeed: "radish",
  };
}

let toastSeq = 0;

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialData(),
      ...createRanchActions(set, get),
      ...createForageActions(set, get),
      selectedPlot: null,
      toasts: [],

      notify: (text, tone = "ok", duration = 2400) => {
        toastSeq += 1;
        const id = toastSeq;
        // 顶部只留最近两条：新消息直接把旧消息顶掉，避免提示堆成瀑布。
        set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-2) }));
        window.setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, duration);
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      selectSeed: (crop) => {
        const level = levelFromXp(get().xp);
        if (level < CROPS[crop].unlockLevel) {
          get().notify(`${CROPS[crop].name}需要 ${CROPS[crop].unlockLevel} 级解锁`, "warn");
          return;
        }
        set({ selectedSeed: crop });
      },

      selectPlot: (id) => set({ selectedPlot: id }),

      buySeed: (crop, qty = 1) => {
        const def = CROPS[crop];
        if (def.wild) {
          get().notify("野菜种子不卖，去野外采摘有机会捡到", "warn");
          return;
        }
        if (def.herb) {
          get().notify("草药种子不卖，去野外的草药丛里采", "warn");
          return;
        }
        const level = levelFromXp(get().xp);
        if (level < def.unlockLevel) {
          get().notify(`${def.name}需要 ${def.unlockLevel} 级解锁`, "warn");
          return;
        }
        const cost = def.seedPrice * qty;
        if (get().coins < cost) {
          get().notify("金币不够啦", "warn");
          return;
        }
        const room = bagAddCheck(get().seeds, crop, qty, get().backpackLevel);
        if (!room.ok) {
          get().notify(`种子背包已满（${room.used}/${room.slots} 格），先升级背包`, "warn");
          return;
        }
        set((s) => ({
          coins: s.coins - cost,
          seeds: { ...s.seeds, [crop]: s.seeds[crop] + qty },
        }));
        get().notify(`买入 ${def.name}种子 ×${qty}`);
      },

      plant: (plotId) => {
        const { plots, selectedSeed, seeds } = get();
        const plot = plots[plotId];
        if (!plot) return;
        if (!plot.unlocked) {
          get().notify("这块地还没开垦", "warn");
          return;
        }
        if (plot.crop) {
          get().notify("这块地已经种着东西了", "warn");
          return;
        }
        const def = CROPS[selectedSeed];
        if (seeds[selectedSeed] <= 0) {
          get().notify(`${def.name}种子用完了，去商店买`, "warn");
          return;
        }
        const now = Date.now();
        const weather = weatherAt(now);
        // 三类作物分开抽签：草药五行/仙品/神品，野菜阴阳/长生，普通作物按天气抽元素
        const mutation = def.herb ? rollHerbMutation() : def.wild ? rollWildMutation() : rollMutation(weather);
        const watered = isRainy(weather) ? 1 : 0;
        set((s) => ({
          seeds: { ...s.seeds, [selectedSeed]: s.seeds[selectedSeed] - 1 },
          plots: s.plots.map((p) =>
            p.id === plotId
              ? { ...p, crop: selectedSeed, plantedAt: now, watered, mutation }
              : p
          ),
        }));
        get().notify(`种下了${def.name}${watered ? "，雨水已浇灌" : ""}`);
      },

      water: (plotId) => {
        const plot = get().plots[plotId];
        if (!plot || !plot.crop) {
          get().notify("这块地还是空的", "warn");
          return;
        }
        if (isReady(plot, Date.now())) {
          get().notify("已经熟了，先收了吧", "warn");
          return;
        }
        if (plot.watered >= MAX_WATER) {
          get().notify("今天的浇水次数用完了", "warn");
          return;
        }
        set((s) => ({
          plots: s.plots.map((p) => (p.id === plotId ? { ...p, watered: p.watered + 1 } : p)),
        }));
        get().notify("浇了水，长得快一点了");
      },

      harvestPlot: (plotId) => {
        const plot = get().plots[plotId];
        if (!plot || !plot.crop) return;
        if (!isReady(plot, Date.now())) {
          get().notify("还没熟，再等等", "warn");
          return;
        }
        const def = CROPS[plot.crop];
        const key = harvestKey(def.id, plot.mutation);
        const room = bagAddCheck(get().harvest, key, def.yields, get().backpackLevel);
        if (!room.ok) {
          get().notify(`杂物背包已满（${room.used}/${room.slots} 格），先升级背包或卖掉一批`, "warn");
          return;
        }
        const before = levelFromXp(get().xp);
        const after = levelFromXp(get().xp + def.xp);
        set((s) => ({
          xp: s.xp + def.xp,
          harvest: { ...s.harvest, [key]: (s.harvest[key] ?? 0) + def.yields },
          plots: s.plots.map((p) =>
            p.id === plotId ? { ...p, crop: null, plantedAt: 0, watered: 0, mutation: null } : p
          ),
        }));
        get().notify(`收获${produceName(def, plot.mutation)} ×${def.yields}`);
        if (after > before) {
          get().notify(`升到 ${after} 级，解锁了新作物`);
        }
      },

      sellAll: () => {
        const { harvest } = get();
        const total = harvestValue(harvest);
        if (total <= 0) {
          get().notify("仓库里没有可卖的菜", "warn");
          return;
        }
        set((s) => ({
          coins: s.coins + total,
          harvest: emptyRecord(0),
        }));
        get().notify(`卖出全部收成，+${total} 金币`);
      },

      sellProduce: (key) => {
        const lot = harvestLots(get().harvest).find((item) => item.key === key);
        if (!lot || lot.count <= 0) {
          get().notify("这一批蔬菜已经卖完了", "warn");
          return;
        }
        const total = lot.price * lot.count;
        set((s) => ({ coins: s.coins + total, harvest: { ...s.harvest, [key]: 0 } }));
        get().notify(`卖出${lot.name} ×${lot.count}，+${total} 金币`);
      },

      sellMeat: (key, count) => {
        const lot = meatLots(get().meat).find((item) => item.key === key);
        if (!lot) {
          get().notify("冷柜里没有这批肉", "warn");
          return;
        }
        const qty = Math.max(1, Math.min(lot.count, Math.trunc(count ?? lot.count)));
        const total = lot.price * qty;
        set((s) => {
          const meat = { ...s.meat };
          const remain = (meat[key] ?? 0) - qty;
          if (remain > 0) meat[key] = remain;
          else delete meat[key];
          return { coins: s.coins + total, meat };
        });
        get().notify(`卖出${lot.name} ×${qty}，+${total} 金币`);
      },

      sellAllMeat: () => {
        const lots = meatLots(get().meat);
        const total = lots.reduce((sum, lot) => sum + lot.price * lot.count, 0);
        if (total <= 0) {
          get().notify("冷柜里没有可卖的肉", "warn");
          return;
        }
        set((s) => ({ coins: s.coins + total, meat: {} }));
        get().notify(`卖出全部肉品，+${total} 金币`);
      },

      buyCar: (modelId, color) => {
        const model = CAR_MODELS.find((m) => m.id === modelId);
        if (!model) return false;
        const { coins, garage, notify } = get();
        if (garage.cars.length >= 6) {
          notify("车库最多停 6 台车，先开一台出去吧", "warn");
          return false;
        }
        if (coins < model.price) {
          notify(`还差 ${model.price - coins} 金币`, "warn");
          return false;
        }
        const index = garage.cars.length;
        const car = {
          id: `car-${Date.now().toString(36)}-${index}`,
          model: model.id,
          color: CAR_PAINTS.some((p) => p.hex === color) ? color : CAR_PAINTS[0].hex,
          plate: newPlate(index),
          purchasedAt: Date.now(),
        };
        set((s) => ({
          coins: s.coins - model.price,
          garage: { cars: [...s.garage.cars, car], activeId: car.id },
        }));
        notify(`提车成功：${model.name} ${car.plate}`);
        return true;
      },

      setActiveCar: (id) => {
        set((s) => ({
          garage: {
            ...s.garage,
            activeId: id && s.garage.cars.some((c) => c.id === id) ? id : null,
          },
        }));
      },

      upgradeBackpack: () => {
        const level = normalizeBackpackLevel(get().backpackLevel);
        const cost = backpackUpgradeCost(level);
        if (cost === null) {
          get().notify(`背包已经是 ${BAG_MAX_LEVEL} 级，无法再升级`, "warn");
          return;
        }
        if (get().coins < cost) {
          get().notify(`升级背包还差 ${cost - get().coins} 金币`, "warn");
          return;
        }
        const next = level + 1;
        set((s) => ({ coins: s.coins - cost, backpackLevel: next }));
        get().notify(`背包升至 Lv${next}，每类 ${backpackSlots(next)} 格`);
      },

      expand: () => {
        const next = get().plots.find((p) => !p.unlocked);
        if (!next) {
          get().notify("所有地块都开垦完了", "warn");
          return;
        }
        const price = LAND_PRICES[next.id - START_UNLOCKED] ?? 720;
        if (get().coins < price) {
          get().notify(`还差 ${price - get().coins} 金币`, "warn");
          return;
        }
        set((s) => ({
          coins: s.coins - price,
          plots: s.plots.map((p) => (p.id === next.id ? { ...p, unlocked: true } : p)),
        }));
        get().notify(`开垦了一块新地，-${price} 金币`);
      },

      expandBy: (count) => {
        const targets = get()
          .plots.filter((p) => !p.unlocked)
          .slice(0, Math.max(0, count));
        if (targets.length === 0) {
          get().notify("没有可扩建的地了", "warn");
          return false;
        }
        const cost = targets.reduce((sum, p) => sum + landPriceOf(p.id), 0);
        if (get().coins < cost) {
          get().notify(`还差 ${cost - get().coins} 金币`, "warn");
          return false;
        }
        const ids = new Set(targets.map((p) => p.id));
        set((s) => ({
          coins: s.coins - cost,
          plots: s.plots.map((p) => (ids.has(p.id) ? { ...p, unlocked: true } : p)),
        }));
        get().notify(`扩建了 ${targets.length} 块地，-${cost} 金币`);
        return true;
      },

      setAppearance: (avatarId, outfitId, bottomId) => {
        set(normalizeAppearance(avatarId, outfitId, bottomId));
        get().notify("穿搭已保存");
      },

      setDecor: (decor) => {
        set({ decor: normalizeDecor(decor) });
        get().notify("农场装饰已保存");
      },

      resetSave: () => {
        set({ ...initialData(), nickname: get().nickname, selectedPlot: null, toasts: [] });
        get().notify("存档已重置");
      },
    }),
    {
      name: "ttfarm-save-v1",
      version: 1,
      // 只持久化游戏数据，选中态与提示不落盘
      partialize: (s) => ({
        coins: s.coins,
        xp: s.xp,
        plots: s.plots,
        seeds: s.seeds,
        harvest: s.harvest,
        meat: s.meat,
        garage: s.garage,
        backpackLevel: s.backpackLevel,
        nickname: s.nickname,
        avatarId: s.avatarId,
        outfitId: s.outfitId,
        bottomId: s.bottomId,
        decor: s.decor,
        ranch: s.ranch,
        forage: s.forage,
        selectedSeed: s.selectedSeed,
      }),
      // 兼容字段缺失（版本升级、新增作物）的情况
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameData>;
        const base = initialData();
        const plots = base.plots.map((plot) => {
          const old = saved.plots?.find((p) => p.id === plot.id);
          return old ? {
            ...plot,
            ...old,
            mutation: old.crop && isMutation(old.mutation) && cropMutationValid(old.crop, old.mutation) ? old.mutation : null,
          } : plot;
        });
        return {
          ...current,
          ...base,
          ...saved,
          coins: saved.coins ?? base.coins,
          ...normalizeAppearance(saved.avatarId, saved.outfitId, saved.bottomId),
          decor: normalizeDecor(saved.decor),
          ranch: normalizeRanch(saved.ranch),
          forage: normalizeForage(saved.forage),
          plots,
          seeds: { ...base.seeds, ...saved.seeds },
          harvest: { ...base.harvest, ...saved.harvest },
          meat: normalizeMeat(saved.meat),
          garage: normalizeGarage(saved.garage),
          backpackLevel: normalizeBackpackLevel(saved.backpackLevel),
        };
      },
    }
  )
);
