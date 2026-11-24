import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CROPS, CROP_LIST, cropMutationValid, type CropId, harvestKey, harvestLots, harvestValue, levelFromXp, produceName } from "./crops";
import { MUTATIONS, isMutation, isRainy, rollHerbMutation, rollMutation, rollWildMutation, weatherAt, type Mutation } from "./weather";
import { MAX_WATER, isReady, PLOT_COUNT, START_UNLOCKED, type PlotState } from "./growth";
import { normalizeAppearance, type AvatarId, type OutfitId } from "./appearance";
import { DEFAULT_DECOR, normalizeDecor, type FarmDecor } from "./decor";
import { normalizeRanch, type RanchState } from "./ranch";
import { createRanchActions, type RanchActions } from "./ranchActions";
import { normalizeForage, type ForageState } from "./forage";
import { createForageActions, type ForageActions } from "./forageActions";
import { meatLots, normalizeMeat } from "./market";
import { CAR_MODELS, CAR_PAINTS, newPlate, normalizeGarage, type CarModelId, type GarageState } from "./garage";
import { backpackSlots, backpackUpgradeCost, bagAddCheck, bagAddSlotCost, bagUsedSlots, normalizeBackpackLevel, BAG_MAX_LEVEL } from "./backpack";
import { remainingMs } from "./growth";
import {
  BAIT_BY_ID,
  baitById,
  boostCardById,
  migrateShopExtras,
  STARTER_ROD,
} from "./items";
import {
  codexFishKey,
  codexFromHoldings,
  codexMushroomKey,
  codexMutationKey,
  codexPlantKey,
  markCodexCollected,
  mergeCodexCollections,
  normalizeCodexCollection,
  type CodexCollection,
} from "./codexCollection";
import { MUSHROOMS } from "./mushrooms";
import { announceSpecialCrop, isSpecialVarietyMutation } from "./specialNotice";
import { fishById, normalizeFishingState, rodById, rodUnlocked } from "./fish";
export { AVATARS, type AvatarId } from "./appearance";

export { PLOT_COLS, PLOT_ROWS, PLOT_COUNT, START_UNLOCKED } from "./growth";
/** 扩建价目：从第 7 块到最后一块，越往后越贵 */
export const LAND_PRICES = [
  150, 220, 300, 420, 560, 720, 900, 1100, 1320, 1580, 1860, 2180, 2520, 2900,
  3300, 3740, 4200, 4700, 5200, 5800, 6400, 7000, 7700, 8400,
];
const SEED_KEYS = new Set<string>(CROP_LIST.map((crop) => crop.id));
const HARVEST_KEYS = new Set<string>(
  CROP_LIST.flatMap((crop) => [
    crop.id,
    ...Object.keys(MUTATIONS).map((mutation) => harvestKey(crop.id, mutation as Mutation)),
  ]),
);
const finiteInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const cleanCounts = (raw: unknown, fallback: Record<string, number>, allowed: Set<string>): Record<string, number> => {
  const out = { ...fallback };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) out[key] = Math.min(1_000_000, Math.round(n));
    else if (Number.isFinite(n) && n === 0) out[key] = 0;
  }
  return out;
};
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
  /** 图鉴收集记录：只增不减，卖出后仍算已收集 */
  codexCollected: CodexCollection;
  /** 已装备的鱼竿 id；null 表示还没在背包里装备鱼竿 */
  fishingRod: string | null;
  /** 鱼篓：每种鱼的存量，与图鉴收集相互独立 */
  fishCaught: Record<string, number>;
  /** 成长加速卡库存 */
  items: Record<string, number>;
  /** 鱼饵库存，暂与「杂物」共用一页背包 */
  materials: Record<string, number>;
  /** 已购买的鱼竿；入门竿默认拥有 */
  ownedRods: string[];
  /** 当前选中的鱼饵；没有库存时仍可选中，但不会咬钩 */
  selectedBait: string | null;
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
  /** 选一根鱼竿装备；未到等级或不存在时返回 false */
  equipFishingRod: (id: string) => boolean;
  /** 卸下当前鱼竿；右下角大按钮会退回默认动作 */
  unequipFishingRod: () => void;
  /** 把钓到的鱼放进鱼篓，同时点亮鱼类图鉴 */
  collectFish: (id: string) => boolean;
  /** 采一朵菌：给金币、记账并点亮菌类图鉴 */
  collectMushroom: (id: string) => boolean;
  /** 商店：买成长加速卡，放入背包「道具」页 */
  buyBoostCard: (id: string, qty?: number) => boolean;
  /** 商店：买鱼饵，放入背包「杂物」页；首次购买会自动选中 */
  buyBait: (id: string, qty?: number) => boolean;
  /** 商店：买鱼竿，放入背包「装备」页，不会自动装备 */
  buyFishingRod: (id: string) => boolean;
  /** 选中鱼饵；传 null 表示不用饵 */
  selectBait: (id: string | null) => void;
  /** 咬钩成功时消耗一枚鱼饵 */
  consumeBait: (id: string) => boolean;
  /** 对一块正在生长的地使用加速卡 */
  useBoostCard: (id: string, plotId: number) => boolean;
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

const INITIAL_SEEDS: Record<CropId, number> = { ...emptyRecord(0), radish: 3, cabbage: 2 };

export function initialData(): GameData {
  return {
    coins: TEST_COINS,
    xp: 0,
    plots: makePlots(),
    seeds: { ...INITIAL_SEEDS },
    harvest: emptyRecord(0),
    meat: {},
    garage: { cars: [], activeId: null },
    backpackLevel: 1,
    codexCollected: codexFromHoldings(INITIAL_SEEDS, {}, []),
    fishingRod: null,
    fishCaught: {},
    items: {},
    materials: { worm: 3 },
    ownedRods: [STARTER_ROD],
    selectedBait: "worm",
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
        if (!def) return;
        const count = Number.isFinite(qty) ? Math.max(1, Math.min(99, Math.trunc(qty))) : 1;
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
        const cost = def.seedPrice * count;
        if (get().coins < cost) {
          get().notify("金币不够啦", "warn");
          return;
        }
        const room = bagAddCheck(get().seeds, crop, count, get().backpackLevel);
        if (!room.ok) {
          get().notify(`种子背包已满（${room.used}/${room.slots} 格），先升级背包`, "warn");
          return;
        }
        set((s) => ({
          coins: s.coins - cost,
          seeds: { ...s.seeds, [crop]: s.seeds[crop] + count },
          codexCollected: markCodexCollected(s.codexCollected, [codexPlantKey(crop)]),
        }));
        get().notify(`买入 ${def.name}种子 ×${count}`);
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
        if (isSpecialVarietyMutation(mutation)) announceSpecialCrop(produceName(def, mutation));
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
        const slots = backpackSlots(get().backpackLevel);
        const used = bagUsedSlots(get().harvest) + bagUsedSlots(get().materials);
        const extra = bagAddSlotCost(get().harvest, key, def.yields);
        if (used + extra > slots) {
          get().notify(`杂物背包已满（${used}/${slots} 格），先升级背包或卖掉一批`, "warn");
          return;
        }
        const before = levelFromXp(get().xp);
        const after = levelFromXp(get().xp + def.xp);
        set((s) => ({
          xp: s.xp + def.xp,
          harvest: { ...s.harvest, [key]: (s.harvest[key] ?? 0) + def.yields },
          codexCollected: markCodexCollected(s.codexCollected, [
            codexPlantKey(def.id),
            ...(plot.mutation ? [codexMutationKey(plot.mutation)] : []),
          ]),
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
        const raw = Math.trunc(count ?? lot.count);
        const qty = Number.isFinite(raw) ? Math.max(1, Math.min(lot.count, raw)) : lot.count;
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

      equipFishingRod: (id) => {
        const rod = rodById(id);
        if (!rod) return false;
        if (!get().ownedRods.includes(rod.id)) {
          get().notify("这根鱼竿还没买，去商店装备栏看看", "warn");
          return false;
        }
        const level = levelFromXp(get().xp);
        if (!rodUnlocked(rod, level)) {
          get().notify(`${rod.name}需要 Lv${rod.level} 才能使用`, "warn");
          return false;
        }
        set({ fishingRod: rod.id });
        get().notify(`已装备：${rod.name}`);
        return true;
      },

      unequipFishingRod: () => {
        if (!get().fishingRod) return;
        set({ fishingRod: null });
        get().notify("已卸下鱼竿，右下角大按钮切回默认动作");
      },

      buyBoostCard: (id, qty = 1) => {
        const card = boostCardById(id);
        if (!card) return false;
        const count = Number.isFinite(qty) ? Math.max(1, Math.min(99, Math.trunc(qty))) : 1;
        const s = get();
        const cost = card.price * count;
        if (s.coins < cost) {
          s.notify("金币不够啦", "warn");
          return false;
        }
        const slots = backpackSlots(s.backpackLevel);
        const used = bagUsedSlots(s.items);
        const extra = bagAddSlotCost(s.items, card.id, count);
        if (used + extra > slots) {
          s.notify(`道具背包已满（${used}/${slots} 格），先升级背包`, "warn");
          return false;
        }
        set({
          coins: s.coins - cost,
          items: { ...s.items, [card.id]: (s.items[card.id] ?? 0) + count },
        });
        s.notify(`买入 ${card.name} ×${count}`);
        return true;
      },

      buyBait: (id, qty = 1) => {
        const bait = baitById(id);
        if (!bait) return false;
        const count = Number.isFinite(qty) ? Math.max(1, Math.min(99, Math.trunc(qty))) : 1;
        const s = get();
        const cost = bait.price * count;
        if (s.coins < cost) {
          s.notify("金币不够啦", "warn");
          return false;
        }
        const slots = backpackSlots(s.backpackLevel);
        const used = bagUsedSlots(s.materials) + bagUsedSlots(s.harvest);
        const extra = bagAddSlotCost(s.materials, bait.id, count);
        if (used + extra > slots) {
          s.notify(`杂物背包已满（${used}/${slots} 格），先升级背包或卖点菜`, "warn");
          return false;
        }
        set({
          coins: s.coins - cost,
          materials: { ...s.materials, [bait.id]: (s.materials[bait.id] ?? 0) + count },
          selectedBait: s.selectedBait ?? bait.id,
        });
        s.notify(`买入 ${bait.name} ×${count}`);
        return true;
      },

      buyFishingRod: (id) => {
        const rod = rodById(id);
        if (!rod) return false;
        const s = get();
        if (s.ownedRods.includes(rod.id)) {
          s.notify("这根鱼竿已经在背包里了", "warn");
          return false;
        }
        const level = levelFromXp(s.xp);
        if (level < rod.level) {
          s.notify(`${rod.name}需要 Lv${rod.level} 才能购买`, "warn");
          return false;
        }
        const slots = backpackSlots(s.backpackLevel);
        if (s.ownedRods.length + 1 > slots) {
          s.notify(`装备背包已满（${s.ownedRods.length}/${slots} 格），先升级背包`, "warn");
          return false;
        }
        if (s.coins < rod.price) {
          s.notify("金币不够啦", "warn");
          return false;
        }
        set({
          coins: s.coins - rod.price,
          ownedRods: [...s.ownedRods, rod.id],
        });
        s.notify(`买入 ${rod.name}，去背包「装备」页装备`);
        return true;
      },

      selectBait: (id) => {
        if (id !== null && !BAIT_BY_ID[id]) return;
        set({ selectedBait: id });
      },

      consumeBait: (id) => {
        const s = get();
        const have = s.materials[id] ?? 0;
        if (have <= 0) return false;
        const materials = { ...s.materials, [id]: have - 1 };
        if (materials[id] <= 0) delete materials[id];
        set({ materials });
        return true;
      },

      useBoostCard: (id, plotId) => {
        const card = boostCardById(id);
        if (!card) return false;
        const s = get();
        const have = s.items[id] ?? 0;
        if (have <= 0) {
          s.notify("这张加速卡用完了", "warn");
          return false;
        }
        const plot = s.plots[plotId];
        if (!plot || !plot.crop) {
          s.notify("选一块正在生长的地再用卡", "warn");
          return false;
        }
        const now = Date.now();
        const remain = remainingMs(plot, now);
        if (remain === null) return false;
        if (remain <= 0) {
          s.notify("这块地已经熟了，不用加速", "warn");
          return false;
        }
        const apply = Math.min(remain, card.minutes * 60_000);
        const items = { ...s.items, [id]: have - 1 };
        if (items[id] <= 0) delete items[id];
        set({
          items,
          plots: s.plots.map((p) => (p.id === plotId ? { ...p, plantedAt: p.plantedAt - apply } : p)),
        });
        const minutes = Math.round(apply / 60_000);
        s.notify(`${CROPS[plot.crop].name}生长提前了 ${minutes} 分钟`);
        return true;
      },

      collectFish: (id) => {
        const fish = fishById(id);
        if (!fish) return false;
        const s = get();
        const check = bagAddCheck(s.fishCaught, id, 1, s.backpackLevel);
        if (!check.ok) {
          s.notify("鱼篓已满，先卖掉一部分鱼或升级背包", "warn");
          return false;
        }
        set({
          fishCaught: { ...s.fishCaught, [id]: (s.fishCaught[id] ?? 0) + 1 },
          codexCollected: markCodexCollected(s.codexCollected, [codexFishKey(id)]),
        });
        return true;
      },

      collectMushroom: (id) => {
        const species = MUSHROOMS[id];
        if (!species) return false;
        const s = get();
        set({
          coins: s.coins + species.price,
          xp: s.xp + 3,
          codexCollected: markCodexCollected(s.codexCollected, [codexMushroomKey(id)]),
        });
        s.notify(`采到${species.name}，+${species.price} 金币，已记入菌类图鉴`);
        return true;
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
        codexCollected: s.codexCollected,
        fishingRod: s.fishingRod,
        fishCaught: s.fishCaught,
        items: s.items,
        materials: s.materials,
        ownedRods: s.ownedRods,
        selectedBait: s.selectedBait,
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
          if (!old) return plot;
          const crop = typeof old.crop === "string" && SEED_KEYS.has(old.crop) ? old.crop as CropId : null;
          return {
            ...plot,
            unlocked: Boolean(old.unlocked),
            crop,
            plantedAt: crop ? finiteInt(old.plantedAt, 0, 9_999_999_999_999, 0) : 0,
            watered: crop ? finiteInt(old.watered, 0, MAX_WATER, 0) : 0,
            mutation: crop && isMutation(old.mutation) && cropMutationValid(crop, old.mutation) ? old.mutation : null,
          };
        });
        const seeds = cleanCounts(saved.seeds, base.seeds, SEED_KEYS);
        const harvest = cleanCounts(saved.harvest, base.harvest, HARVEST_KEYS);
        const ranch = normalizeRanch(saved.ranch);
        const fishing = normalizeFishingState({ rod: saved.fishingRod, fish: saved.fishCaught });
        const extras = migrateShopExtras(
          {
            items: saved.items,
            materials: saved.materials,
            ownedRods: saved.ownedRods,
            selectedBait: saved.selectedBait,
          },
          fishing.rod,
        );
        const codexCollected = mergeCodexCollections(
          base.codexCollected,
          normalizeCodexCollection(saved.codexCollected),
          codexFromHoldings(seeds, harvest, ranch.animals.map((animal) => animal.species), fishing.fish),
        );
        return {
          ...current,
          coins: finiteInt(saved.coins, 0, 9_999_999_999, base.coins),
          xp: finiteInt(saved.xp, 0, 99_999_999, 0),
          plots,
          seeds,
          harvest,
          meat: normalizeMeat(saved.meat),
          nickname: typeof saved.nickname === "string" && saved.nickname.trim() ? saved.nickname.trim() : base.nickname,
          ...normalizeAppearance(saved.avatarId, saved.outfitId, saved.bottomId),
          decor: normalizeDecor(saved.decor),
          ranch,
          forage: normalizeForage(saved.forage),
          garage: normalizeGarage(saved.garage),
          backpackLevel: normalizeBackpackLevel(saved.backpackLevel),
          codexCollected,
          fishingRod: fishing.rod,
          fishCaught: fishing.fish,
          items: extras.items,
          materials: extras.materials,
          ownedRods: extras.ownedRods,
          selectedBait: extras.selectedBait,
          selectedSeed: typeof saved.selectedSeed === "string" && SEED_KEYS.has(saved.selectedSeed)
            ? saved.selectedSeed
            : base.selectedSeed,
        };
      },
    }
  )
);
