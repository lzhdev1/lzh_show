import {
  CROPS, cropMutationValid, HERB_POOL, WILD_GREENS,
  type CropId, type HerbTier,
} from "./crops";
import { HERB_ELEMENTS, isHerbMutation, pickWildMutation, type Mutation } from "./weather";

/**
 * 野外采集的两套刷新：
 * 1. 野菜：每 10 分钟整批换新（10 株，随机种类，20% 变异），上一批没摘完也直接作废；
 *    采摘记录按轮次存进存档，同一轮内重进看到的是同一批。
 * 2. 草药：每 5 分钟长出一株，随机分布，地里最多同时 15 株；超上限时随机清掉一株。
 *    草药是持久的：不摘就一直留着，所以整份列表随存档保存。
 */
export const FORAGE_ROTATION_MS = 10 * 60_000;
/** 每批野菜的株数 */
export const FORAGE_BATCH_COUNT = 10;
/** 锚点总数：0–14 给野菜，15–29 给草药，两套位置互不重叠 */
export const FORAGE_ANCHOR_COUNT = 30;
const WILD_SLOT_COUNT = 15;
const HERB_SLOT_START = 15;
const HERB_SLOT_COUNT = 15;

/** 三类野外作物采到普通种子的概率：统一 30% */
export const FORAGE_SEED_CHANCE = 0.30;
/** 采到带变异的植株时，掉「变异种子」的概率：统一 20% */
export const FORAGE_MUTATION_SEED_CHANCE = 0.20;
/** 野菜自带变异的概率（阴阳 / 长生） */
export const FORAGE_MUTATION_CHANCE = 0.20;

/** 草药刷新间隔 */
export const HERB_SPAWN_MS = 5 * 60_000;
/** 地面上最多同时存在的草药株数 */
export const HERB_GROUND_CAP = 15;
/** 草药三档刷新概率：常见 70% / 中档 20% / 珍稀 10% */
export const HERB_TIER_CHANCE: Record<HerbTier, number> = { common: 0.70, mid: 0.20, rare: 0.10 };
/** 草药三档的基础掉种子概率：统一 30% */
export const HERB_SEED_CHANCE: Record<HerbTier, number> = { common: 0.30, mid: 0.30, rare: 0.30 };
/** 草药带五行变异的概率 */
export const HERB_MUTATION_CHANCE = 0.20;
/** 草药带仙品 / 神品变异的概率（与五行独立抽，两者同时中时取特殊） */
export const HERB_SPECIAL_CHANCE = 0.10;
/** 变异草药掉变异种子的概率：统一 20%，与普通草药种子分开判定 */
export const HERB_MUTATION_SEED_CHANCE = 0.20;
export const HERB_SPECIAL_SEED_CHANCE = 0.20;

export interface WildPatch {
  id: string;
  /** 锚点下标：0–14 野菜，15–29 草药 */
  slot: number;
  crop: CropId;
  mutation: Mutation | null;
  /** 来源：野菜批次 / 持久草药 */
  source: "wild" | "herb";
}

export interface ForageState {
  /** 野菜批次所属轮次；换轮后 taken 自动作废 */
  rotation: number;
  taken: number[];
  /** 草药刷新的随机种子；0 表示还没初始化 */
  herbSeed: number;
  /** 已经结算到的 5 分钟刻度 */
  herbTick: number;
  /** 已经生成过的草药编号，用于保证 id 唯一 */
  herbCount: number;
  /** 地面上的草药 */
  herbs: WildPatch[];
}

export function normalizeForage(value?: unknown): ForageState {
  const src = (value && typeof value === "object" ? value : {}) as Partial<ForageState>;
  const rotation = Number.isFinite(src.rotation) ? Math.max(0, Math.trunc(src.rotation!)) : 0;
  const taken: number[] = [];
  for (const slot of Array.isArray(src.taken) ? src.taken : []) {
    const n = Number(slot);
    if (Number.isInteger(n) && n >= 0 && n < WILD_SLOT_COUNT && !taken.includes(n)) taken.push(n);
  }
  const herbSeed = Number.isFinite(src.herbSeed) ? Math.max(0, Math.trunc(src.herbSeed!)) >>> 0 : 0;
  const herbTick = Number.isFinite(src.herbTick) ? Math.max(0, Math.trunc(src.herbTick!)) : 0;
  const herbCount = Number.isFinite(src.herbCount) ? Math.max(0, Math.trunc(src.herbCount!)) : 0;
  const herbs: WildPatch[] = [];
  for (const item of Array.isArray(src.herbs) ? src.herbs : []) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id : "";
    const crop = typeof item.crop === "string" && CROPS[item.crop as CropId]?.herb ? item.crop as CropId : null;
    const slot = Number(item.slot);
    if (!id || !crop) continue;
    if (!Number.isInteger(slot) || slot < HERB_SLOT_START || slot >= HERB_SLOT_START + HERB_SLOT_COUNT) continue;
    if (herbs.some((herb) => herb.slot === slot || herb.id === id)) continue;
    const raw = item.mutation as Mutation | null | undefined;
    const mutation = raw && isHerbMutation(raw) && cropMutationValid(crop, raw) ? raw : null;
    herbs.push({ id, slot, crop, mutation, source: "herb" });
  }
  return { rotation, taken, herbSeed, herbTick, herbCount, herbs };
}

export function forageRotationAt(now: number): number {
  return Math.floor(now / FORAGE_ROTATION_MS);
}

export function forageEndsAt(now: number): number {
  return (Math.floor(now / FORAGE_ROTATION_MS) + 1) * FORAGE_ROTATION_MS;
}

/** 下一株草药出现的时刻 */
export function herbNextAt(state: ForageState): number {
  return (state.herbTick + 1) * HERB_SPAWN_MS;
}

/** mulberry32：同一颗种子必然给出同一串随机数 */
function rngFrom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

let cacheRotation = -1;
let cachePatches: WildPatch[] = [];

/** 同一轮内返回同一批野菜；换轮后整批重抽，上一批的剩余株不再保留。 */
export function wildPatchesAt(now: number): readonly WildPatch[] {
  const rotation = forageRotationAt(now);
  if (rotation === cacheRotation) return cachePatches;
  const rnd = rngFrom((rotation ^ 0x51f3a9c7) >>> 0);
  const slots = shuffle(Array.from({ length: WILD_SLOT_COUNT }, (_, i) => i), rnd).slice(0, FORAGE_BATCH_COUNT);
  cachePatches = slots.map((slot) => {
    const crop = WILD_GREENS[Math.floor(rnd() * WILD_GREENS.length)].id;
    const mutation = rnd() < FORAGE_MUTATION_CHANCE ? pickWildMutation(rnd) : null;
    return { id: `forage-${rotation}-${slot}`, slot, crop, mutation, source: "wild" as const };
  });
  cacheRotation = rotation;
  return cachePatches;
}

/**
 * 采到普通种子的概率：三类作物统一 30%，与变异种子分开判定。
 * 带变异的植株还会额外按 20% 掉一颗变异种子。
 */
export function forageSeedChance(): number {
  return FORAGE_SEED_CHANCE;
}
/** 带变异植株额外掉变异种子的概率：20%；普通植株为 0 */
export function forageMutationSeedChance(patch: WildPatch): number {
  return patch.mutation ? FORAGE_MUTATION_SEED_CHANCE : 0;
}

function rollHerbTier(rnd: () => number): HerbTier {
  const roll = rnd();
  if (roll < HERB_TIER_CHANCE.common) return "common";
  if (roll < HERB_TIER_CHANCE.common + HERB_TIER_CHANCE.mid) return "mid";
  return "rare";
}

/**
 * 抽一株草药的品种与变异（只决定这株是什么，掉种子概率另算）。
 * 变异按四档一次抽出：无变异 70% / 五行 20% / 仙品 5% / 神品 5%，
 * 这样"普通变异 20%"和"特殊变异 10%"两个概率都精确成立。
 */
function rollHerb(rnd: () => number) {
  const tier = rollHerbTier(rnd);
  const pool = HERB_POOL[tier];
  const crop = pool[Math.floor(rnd() * pool.length)];
  let mutation: Mutation | null = null;
  const roll = rnd();
  if (roll < HERB_MUTATION_CHANCE) mutation = HERB_ELEMENTS[Math.floor(rnd() * HERB_ELEMENTS.length)];
  else if (roll < HERB_MUTATION_CHANCE + HERB_SPECIAL_CHANCE) {
    mutation = rnd() < 0.5 ? "xianpin" : "shenpin";
  }
  return { crop, mutation };
}

/** 离线最多补 24 小时的刷新，再久也只是重抽最后 15 株，没必要真跑一遍 */
const MAX_CATCHUP_TICKS = 288;

/**
 * 把草药刷新结算到 now：每过 5 分钟长一株，超过 15 株随机清一株。
 * 结果由 herbSeed + 编号决定，所以换设备重新加载也不会长出一批不同的草。
 */
export function advanceForage(state: ForageState, now: number): ForageState {
  const tick = Math.floor(now / HERB_SPAWN_MS);
  if (!state.herbSeed) {
    return { ...state, herbSeed: (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1, herbTick: tick, herbCount: 0, herbs: [] };
  }
  if (!Number.isFinite(tick) || tick <= state.herbTick) return state;
  const herbs = state.herbs.slice();
  let seq = state.herbCount;
  const from = Math.max(state.herbTick + 1, tick - MAX_CATCHUP_TICKS + 1);
  for (let t = from; t <= tick; t += 1) {
    seq += 1;
    const rnd = rngFrom((state.herbSeed ^ Math.imul(seq, 0x9e3779b1)) >>> 0);
    const { crop, mutation } = rollHerb(rnd);
    if (herbs.length >= HERB_GROUND_CAP) herbs.splice(Math.floor(rnd() * herbs.length), 1);
    const used = new Set(herbs.map((herb) => herb.slot));
    const free: number[] = [];
    for (let slot = HERB_SLOT_START; slot < HERB_SLOT_START + HERB_SLOT_COUNT; slot += 1) {
      if (!used.has(slot)) free.push(slot);
    }
    const slot = free[Math.min(free.length - 1, Math.floor(rnd() * free.length))];
    herbs.push({ id: `herb-${seq}`, slot, crop, mutation, source: "herb" });
  }
  return { ...state, herbTick: tick, herbCount: seq, herbs };
}
