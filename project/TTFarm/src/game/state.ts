import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CROPS, CROP_LIST, type CropId, levelFromXp } from "./crops";
import { MAX_WATER, isReady, type PlotState } from "./growth";

export const PLOT_COLS = 6;
export const PLOT_ROWS = 5;
export const PLOT_COUNT = PLOT_COLS * PLOT_ROWS;
/** 初始已开垦的地块数量（最靠前的一排） */
export const START_UNLOCKED = PLOT_COLS;
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

export type AvatarId = "xiaosui";

export interface AvatarOption {
  id: AvatarId;
  name: string;
  tagline: string;
  portrait: string;
  /** 对应的 VRM 模型文件名（放在 public/avatars/vrm/ 下） */
  model?: string;
}

const asset = (file: string) => `${import.meta.env.BASE_URL}avatars/${file}`;

/** 目前只有这一个日系少女形象，其余占位角色已全部移除 */
export const AVATARS: AvatarOption[] = [
  {
    id: "xiaosui",
    name: "小穗",
    tagline: "爱把菜畦排整齐",
    portrait: asset("xiaosui.jpg"),
    // 放 public/avatars/vrm/ 下的文件名；换成 VRoid Studio 导出的少女模型后改这里
    // （或在游戏内的资料面板直接导入 .vrm）
    model: "xiaosui.vrm",
  },
];

export interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "warn";
}

interface GameData {
  coins: number;
  xp: number;
  plots: PlotState[];
  seeds: Record<CropId, number>;
  harvest: Record<CropId, number>;
  nickname: string;
  avatarId: AvatarId;
  selectedSeed: CropId;
}

interface GameActions {
  selectSeed: (crop: CropId) => void;
  selectPlot: (id: number | null) => void;
  buySeed: (crop: CropId, qty?: number) => void;
  plant: (plotId: number) => void;
  water: (plotId: number) => void;
  harvestPlot: (plotId: number) => void;
  sellAll: () => void;
  expand: () => void;
  /** 一次扩建 count 块地（金币不够或没有空地时返回失败原因） */
  expandBy: (count: number) => boolean;
  setProfile: (nickname: string, avatarId: AvatarId) => void;
  resetSave: () => void;
  notify: (text: string, tone?: "ok" | "warn") => void;
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
  }));
}

export function initialData(): GameData {
  return {
    coins: TEST_COINS,
    xp: 0,
    plots: makePlots(),
    seeds: { ...emptyRecord(0), radish: 3, cabbage: 2 },
    harvest: emptyRecord(0),
    nickname: "农场主",
    avatarId: "xiaosui",
    selectedSeed: "radish",
  };
}

let toastSeq = 0;

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialData(),
      selectedPlot: null,
      toasts: [],

      notify: (text, tone = "ok") => {
        toastSeq += 1;
        const id = toastSeq;
        set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
        window.setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 2400);
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
        set((s) => ({
          seeds: { ...s.seeds, [selectedSeed]: s.seeds[selectedSeed] - 1 },
          plots: s.plots.map((p) =>
            p.id === plotId
              ? { ...p, crop: selectedSeed, plantedAt: now, watered: 0 }
              : p
          ),
        }));
        get().notify(`种下了${def.name}`);
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
        const before = levelFromXp(get().xp);
        const after = levelFromXp(get().xp + def.xp);
        set((s) => ({
          xp: s.xp + def.xp,
          harvest: { ...s.harvest, [def.id]: s.harvest[def.id] + def.yields },
          plots: s.plots.map((p) =>
            p.id === plotId ? { ...p, crop: null, plantedAt: 0, watered: 0 } : p
          ),
        }));
        get().notify(`收获${def.name} ×${def.yields}`);
        if (after > before) {
          get().notify(`升到 ${after} 级，解锁了新作物`);
        }
      },

      sellAll: () => {
        const { harvest } = get();
        let total = 0;
        CROP_LIST.forEach((crop) => {
          total += harvest[crop.id] * crop.sellPrice;
        });
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

      setProfile: (nickname, avatarId) => {
        const trimmed = nickname.trim().slice(0, 12) || "农场主";
        set({ nickname: trimmed, avatarId });
        get().notify("资料已保存");
      },

      resetSave: () => {
        set({ ...initialData(), selectedPlot: null, toasts: [] });
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
        nickname: s.nickname,
        avatarId: s.avatarId,
        selectedSeed: s.selectedSeed,
      }),
      // 兼容字段缺失（版本升级、新增作物）的情况
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameData>;
        const base = initialData();
        const plots = base.plots.map((plot) => {
          const old = saved.plots?.find((p) => p.id === plot.id);
          return old ? { ...plot, ...old } : plot;
        });
        return {
          ...current,
          ...base,
          ...saved,
          // 测试期：旧存档里的金币也统一抬到测试额度，否则会被本地存档覆盖回 120
          coins: TEST_COINS,
          // 旧存档里可能存着已删掉的形象 id，统一收回唯一的少女形象
          avatarId: "xiaosui",
          plots,
          seeds: { ...base.seeds, ...saved.seeds },
          harvest: { ...base.harvest, ...saved.harvest },
        };
      },
    }
  )
);
