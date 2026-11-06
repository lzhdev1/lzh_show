import { CROPS, type CropId } from "./crops";

export interface PlotState {
  id: number;
  unlocked: boolean;
  crop: CropId | null;
  /** 播种时间戳（毫秒），离线生长靠它推导，不模拟逐秒 */
  plantedAt: number;
  /** 已浇水次数，受上限约束 */
  watered: number;
}

export const MAX_WATER = 3;
/** 每次浇水缩短的成熟时间比例 */
const WATER_BOOST = 0.18;

/** 该地块成熟所需总时长（考虑浇水加速） */
export function growTotal(crop: CropId, watered: number): number {
  const base = CROPS[crop].growMs;
  return base * (1 - WATER_BOOST * Math.min(watered, MAX_WATER));
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
