import { CROPS, type CropId } from "./crops";
import { ELEMENTS, SPIRITS, WEATHER, weatherAt, type Mutation } from "./weather";

export const PLOT_COLS = 6;
export const PLOT_ROWS = 5;
export const PLOT_COUNT = PLOT_COLS * PLOT_ROWS;
export const START_UNLOCKED = PLOT_COLS;
export const PLOT_SPACING = 2.6;

export function plotIdAt(x: number, z: number): number | null {
  const col = Math.floor(x / PLOT_SPACING + PLOT_COLS / 2);
  const row = Math.floor(-z / PLOT_SPACING + PLOT_ROWS / 2);
  if (col < 0 || col >= PLOT_COLS || row < 0 || row >= PLOT_ROWS) return null;
  return row * PLOT_COLS + col;
}

/** 最近一次朋友帮浇的记录：锁住这一小时，其他朋友不能再动手 */
export interface GuestWater {
  by: string;
  t: number;
}

export interface PlotState {
  id: number;
  unlocked: boolean;
  crop: CropId | null;
  /** 播种时间戳（毫秒），离线生长靠它推导，不模拟逐秒 */
  plantedAt: number;
  /** 累计浇水次数（含雨水与朋友帮浇），决定最终成熟时长 */
  watered: number;
  mutation: Mutation | null;
  /** 自己浇水的最近时间戳（只留最近 5 次，用于按小时配额判定） */
  selfWater?: number[];
  /** 自己累计浇水次数，用来判断播种后那 3 次免费额度是否用完 */
  selfWaterTotal?: number;
  /** 最近一次朋友帮浇，60 分钟内其他朋友不能再浇这株 */
  guestWater?: GuestWater | null;
  /** 本茬的变异随机种子：由播种时的作物 + 地块决定，保证离线/换设备结果一致 */
  plantSeed?: number;
  /** 已经判定过几个生长阶段的变异（0–3）；变异种子播种时直接记 3 */
  mutationChecked?: number;
}

/** 每株累计浇水次数的硬上限：正好把加速幅度封在一半 */
export const MAX_WATER = 25;
/** 每次浇水缩短的成熟时间比例 */
export const WATER_BOOST = 0.02;
/** 浇水最多把成熟时长压到基准的这一比例 */
export const MIN_GROW_RATIO = 0.5;
/** 刚播下时自己可以连着浇的次数 */
export const SEED_WATER_FREE = 3;
/** 免费额度用完后，自己每小时可浇的次数 */
export const SELF_WATER_PER_WINDOW = 2;
/** 每个小时窗口里，所有朋友合计只能帮浇的次数 */
export const GUEST_WATER_PER_WINDOW = 1;
/** 配额窗口长度：一小时 */
export const WATER_WINDOW_MS = 60 * 60_000;

/** 该地块成熟所需总时长（考虑浇水加速） */
export function growTotal(crop: CropId, watered: number): number {
  const base = CROPS[crop].growMs;
  const ratio = Math.max(MIN_GROW_RATIO, 1 - WATER_BOOST * Math.min(watered, MAX_WATER));
  return base * ratio;
}

/** 0–1 的生长进度 */
export function growthProgress(plot: PlotState, now: number): number {
  if (!plot.crop || !plot.plantedAt) return 0;
  const total = growTotal(plot.crop, plot.watered);
  return Math.min(1, Math.max(0, (now - plot.plantedAt) / total));
}

/** 剩余毫秒，未种植返回 null */
export function remainingMs(plot: PlotState, now: number): number | null {
  if (!plot.crop || !plot.plantedAt) return null;
  const total = growTotal(plot.crop, plot.watered);
  return Math.max(0, total - (now - plot.plantedAt));
}

export function isReady(plot: PlotState, now: number): boolean {
  if (!plot.crop) return false;
  return growthProgress(plot, now) >= 1;
}

/** 0 种子 / 1 幼苗 / 2 成长 / 3 成熟 */
export function cropStage(progress: number): 0 | 1 | 2 | 3 {
  if (progress >= 1) return 3;
  if (progress >= 0.5) return 2;
  if (progress >= 0.18) return 1;
  return 0;
}

export function formatRemain(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s} 秒`;
  return `${m} 分 ${String(s).padStart(2, "0")} 秒`;
}

export type WaterGateReason = "empty" | "ready" | "cap" | "quota";

export interface WaterGate {
  ok: boolean;
  /** 还不能浇的原因，配合各地自己的文案 */
  reason?: WaterGateReason;
  /** quota 时距离下次恢复的毫秒 */
  waitMs?: number;
  /** 当前这一小时里自己/朋友还能浇几次 */
  left: number;
}

function windowRecent(times: number[] | undefined, now: number): number[] {
  return (times ?? []).filter((t) => Number.isFinite(t) && now - t >= 0 && now - t < WATER_WINDOW_MS);
}

/** 自己这块地现在能不能浇水 */
export function selfWaterGate(plot: PlotState, now: number): WaterGate {
  if (!plot.crop) return { ok: false, reason: "empty", left: 0 };
  if (isReady(plot, now)) return { ok: false, reason: "ready", left: 0 };
  if (plot.watered >= MAX_WATER) return { ok: false, reason: "cap", left: 0 };
  // 刚种下的 3 次属于播种窗口，不受小时配额约束
  if ((plot.selfWaterTotal ?? 0) < SEED_WATER_FREE) return { ok: true, left: SEED_WATER_FREE - (plot.selfWaterTotal ?? 0) };
  const recent = windowRecent(plot.selfWater, now);
  const left = SELF_WATER_PER_WINDOW - recent.length;
  if (left <= 0) {
    const next = Math.min(...recent) + WATER_WINDOW_MS;
    return { ok: false, reason: "quota", waitMs: Math.max(0, next - now), left: 0 };
  }
  return { ok: true, left };
}

/** 朋友帮浇：这一小时内只要有人浇过，其他人就锁死 */
export function guestWaterGate(plot: PlotState, now: number): WaterGate {
  if (!plot.crop) return { ok: false, reason: "empty", left: 0 };
  if (isReady(plot, now)) return { ok: false, reason: "ready", left: 0 };
  if (plot.watered >= MAX_WATER) return { ok: false, reason: "cap", left: 0 };
  const last = plot.guestWater;
  if (last && Number.isFinite(last.t) && now - last.t >= 0 && now - last.t < WATER_WINDOW_MS) {
    return { ok: false, reason: "quota", waitMs: last.t + WATER_WINDOW_MS - now, left: 0 };
  }
  return { ok: true, left: GUEST_WATER_PER_WINDOW };
}

/** 田里浇水标识的查看者：自己看自己剩余额度，好友看好友额度，参观者不显示。 */
export type WaterViewer = "self" | "guest" | "none";

/**
 * 这块地的浇水标识是否对当前查看者可见。
 * 自己浇到上限/冷却时自己看不到，但若好友仍可帮浇，好友依旧能看到。
 */
export function canShowWaterHint(plot: PlotState, now: number, viewer: WaterViewer): boolean {
  if (viewer === "none") return false;
  const gate = viewer === "self" ? selfWaterGate(plot, now) : guestWaterGate(plot, now);
  return gate.ok;
}

/** 记一次自己浇水：次数 +1；免费 3 次不占小时额度，之后滚动保留最近 5 个时间戳 */
export function applySelfWater(plot: PlotState, now: number): PlotState {
  const total = (plot.selfWaterTotal ?? 0) + 1;
  const recent = windowRecent(plot.selfWater, now);
  return {
    ...plot,
    watered: plot.watered + 1,
    selfWaterTotal: total,
    selfWater: total <= SEED_WATER_FREE ? recent : [...recent, now].slice(-5),
  };
}

/** 记一次朋友帮浇：次数 +1 并写上下一位朋友的锁定时间 */
export function applyGuestWater(plot: PlotState, now: number, by: string): PlotState {
  return { ...plot, watered: plot.watered + 1, guestWater: { by, t: now } };
}

/** 播种时重置所有浇水记录 */
export function resetWater(plot: PlotState, plantedAt: number, rainy: boolean): PlotState {
  return {
    ...plot,
    plantedAt,
    watered: rainy ? 1 : 0,
    selfWater: [],
    selfWaterTotal: 0,
    guestWater: null,
  };
}

/** 给界面用的一句话：这块地本小时自己还能浇几次 */
export function waterHint(plot: PlotState, now: number): string {
  const gate = selfWaterGate(plot, now);
  if (gate.ok) {
    return (plot.selfWaterTotal ?? 0) < SEED_WATER_FREE
      ? `刚播下，还能连浇 ${gate.left} 次`
      : `本小时还能浇 ${gate.left} 次`;
  }
  if (gate.reason === "quota" && gate.waitMs) return `${formatRemain(gate.waitMs)}后可再浇`;
  if (gate.reason === "cap") return `已浇到上限（${MAX_WATER} 次）`;
  if (gate.reason === "ready") return "已经熟了";
  return "";
}

/** 成熟阶段命中变异时，精灵占比（整体精灵率仍约一成） */
export const MUTATION_SPIRIT_SHARE = 0.30;

/** 每个生长阶段（发芽 18% / 成长 50% / 成熟 100%）的单次变异概率 */
export function stageMutationChance(weather: ReturnType<typeof weatherAt>): number {
  // 把整茬的天气总概率摊到三次判定上：1-(1-c)^(1/3)，整茬合计仍等于天气面板的 c
  return 1 - Math.pow(1 - WEATHER[weather].chance, 1 / 3);
}

function stageRandom(seed: number, stage: number): () => number {
  let s = (seed ^ Math.imul(stage, 0x9e3779b1)) >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickElement(weather: ReturnType<typeof weatherAt>, random: () => number): Mutation {
  // 主亲和权重 6，次亲和权重 3，其余各 1。
  const { affinity } = WEATHER[weather];
  let draw = random() * 13;
  for (const element of ELEMENTS) {
    draw -= element === affinity[0] ? 6 : element === affinity[1] ? 3 : 1;
    if (draw < 0) return element;
  }
  return ELEMENTS[ELEMENTS.length - 1];
}

/**
 * 结算某一茬作物的阶段变异：只在进入发芽 / 成长 / 成熟时各判定一次，
 * 一旦命中就锁定种类，后续阶段不再判；精灵只在成熟阶段出现。
 * 用播种时的天气概率与 plantSeed 推导，离线跨阶段、换设备重算结果都一致。
 */
export function settlePlotMutation(plot: PlotState, now: number): PlotState {
  if (!plot.crop || !plot.plantedAt) return plot;
  const def = CROPS[plot.crop];
  if (def.wild || def.herb) return plot;
  const progress = growthProgress(plot, now);
  const stage = cropStage(progress);
  const checked = plot.mutation ? 3 : Math.min(3, Math.max(0, Math.trunc(plot.mutationChecked ?? 0)));
  if (checked >= stage) return plot;
  const seed = plot.plantSeed ?? ((Math.imul(plot.id + 1, 0x85ebca6b) ^ plot.plantedAt) >>> 0);
  const weather = weatherAt(plot.plantedAt);
  const chance = stageMutationChance(weather);
  let next = checked;
  let mutation: Mutation | null = plot.mutation;
  while (next < stage && !mutation) {
    next += 1;
    const random = stageRandom(seed, next);
    if (random() >= chance) continue;
    // 成熟阶段才可能出精灵；前面两段只出元素
    if (next === 3 && random() < MUTATION_SPIRIT_SHARE) {
      mutation = SPIRITS[Math.floor(random() * SPIRITS.length)];
    } else {
      mutation = pickElement(weather, random);
    }
  }
  return { ...plot, plantSeed: seed, mutation, mutationChecked: mutation ? 3 : next };
}

/** 未进入发芽阶段前，任何界面都按普通作物显示 */
export function plotMutationRevealed(plot: PlotState, now: number): boolean {
  return Boolean(plot.mutation) && cropStage(growthProgress(plot, now)) >= 1;
}
