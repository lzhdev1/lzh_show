import { CROPS, HERB_LIST, WILD_GREENS, type CropId } from "./crops";
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
/** 草药丛占野外菜丛比例，草药掉种子的概率与经验略高 */
export const HERB_PATCH_SHARE = 0.4;
export const HERB_SEED_CHANCE = 0.45;
export const HERB_FORAGE_XP = 6;
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

/** 同一轮内返回同一批菜丛；野菜与草药混排，草药约占四成，野菜可能自带阴阳/长生变异。 */
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
  const shuffle = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const fill = (ids: CropId[], count: number) => {
    const picked: CropId[] = [];
    while (picked.length < count) picked.push(...shuffle(ids.slice()));
    return picked.slice(0, count);
  };
  const herbCount = Math.round(FORAGE_PATCH_COUNT * HERB_PATCH_SHARE);
  const picks = shuffle([
    ...fill(HERB_LIST.map((crop) => crop.id), herbCount),
    ...fill(WILD_GREENS.map((crop) => crop.id), FORAGE_PATCH_COUNT - herbCount),
  ]);
  patches = picks.slice(0, FORAGE_PATCH_COUNT).map((crop, slot) => {
    // 草药丛不带变异，避免与野菜的阴阳/长生特效混线；变异留给播种抽签
    const mutation = !CROPS[crop].herb && next() < FORAGE_MUTATION_CHANCE ? pickWildMutation(next) : null;
    return { id: `forage-${rotation}-${slot}`, slot, crop, mutation };
  });
  lastRotation = rotation;
  return patches;
}