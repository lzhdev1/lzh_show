import { WILD_GREENS, type CropId } from "./crops";
import { pickWildMutation, type WildMutation } from "./weather";

/**
 * 野外野菜：与野生动物同一套时间种子思路——
 * 每轮刷新一批菜丛，同一轮内重进游戏、换设备看到的都是同一批；
 * 采摘记录（forage.taken）随存档保存，刷新不会重新长出来。
 */
export const FORAGE_ROTATION_MS = 10 * 60_000;
export const FORAGE_PATCH_COUNT = 28;
/** 每次采摘掉种子的概率 */
export const FORAGE_SEED_CHANCE = 0.35;
/** 采到野菜给的经验 */
export const FORAGE_XP = 4;
/** 野外菜丛自带变异的概率（阴阳/长生，级别同播种抽签） */
export const FORAGE_MUTATION_CHANCE = 0.10;

export interface WildPatch {
  id: string;
  slot: number;
  crop: CropId;
  mutation: WildMutation | null;
}

export interface ForageState {
  /** 采摘记录所属的刷新轮次；换轮后 taken 自动作废 */
  rotation: number;
  taken: number[];
}

export function normalizeForage(value?: unknown): ForageState {
  const src = (value && typeof value === "object" ? value : {}) as Partial<ForageState>;
  const rotation = Number.isFinite(src.rotation) ? Math.max(0, Math.trunc(src.rotation!)) : 0;
  const taken: number[] = [];
  for (const slot of Array.isArray(src.taken) ? src.taken : []) {
    const n = Number(slot);
    if (Number.isInteger(n) && n >= 0 && n < FORAGE_PATCH_COUNT && !taken.includes(n)) taken.push(n);
  }
  return { rotation, taken };
}

export function forageRotationAt(now: number): number {
  return Math.floor(now / FORAGE_ROTATION_MS);
}

export function forageEndsAt(now: number): number {
  return (Math.floor(now / FORAGE_ROTATION_MS) + 1) * FORAGE_ROTATION_MS;
}

let lastRotation = -1;
let patches: WildPatch[] = [];

/** 同一轮内返回同一批菜丛；野菜品种不够时洗第二遍补齐，约一成自带阴阳/长生变异。 */
export function wildPatchesAt(now: number): readonly WildPatch[] {
  const rotation = forageRotationAt(now);
  if (rotation === lastRotation) return patches;
  let seed = (rotation ^ 0x51f3a9c7) >>> 0;
  const next = () => {
    seed = (seed + 0x9e3779b9) >>> 0;
    let value = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
  };
  const greens = WILD_GREENS.map((crop) => crop.id);
  const picks: CropId[] = [];
  while (picks.length < FORAGE_PATCH_COUNT) {
    const round = greens.slice();
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    picks.push(...round);
  }
  patches = picks.slice(0, FORAGE_PATCH_COUNT).map((crop, slot) => {
    // 用独立序列抽变异，保证菜丛品种与变异互不串扰
    const mutation = next() < FORAGE_MUTATION_CHANCE ? pickWildMutation(next) : null;
    return { id: `forage-${rotation}-${slot}`, slot, crop, mutation };
  });
  lastRotation = rotation;
  return patches;
}