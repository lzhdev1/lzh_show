/** 背包每类的基础格数、升级步长与叠加上限。 */
export const BAG_BASE_SLOTS = 30;
export const BAG_SLOT_STEP = 10;
export const BAG_MAX_LEVEL = 15;
export const BAG_STACK_LIMIT = 999;
/** 升级价：按当前等级线性递增，1→2 级 120 金币。 */
export const BAG_UPGRADE_UNIT = 120;

export function normalizeBackpackLevel(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(BAG_MAX_LEVEL, Math.max(1, Math.round(n)));
}

/** 每个分类的格数：Lv1 30 格，每升一级 +10，Lv15 为 170 格。 */
export function backpackSlots(level: unknown): number {
  return BAG_BASE_SLOTS + (normalizeBackpackLevel(level) - 1) * BAG_SLOT_STEP;
}

/** 当前等级升下一级的金币价；满级返回 null。 */
export function backpackUpgradeCost(level: unknown): number | null {
  const current = normalizeBackpackLevel(level);
  return current >= BAG_MAX_LEVEL ? null : current * BAG_UPGRADE_UNIT;
}

/** 单个物品堆叠到 999 后要占新格。 */
export function bagStackSlots(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.ceil(Math.trunc(count) / BAG_STACK_LIMIT);
}

/** 一个分类当前占用的格数。 */
export function bagUsedSlots(items: Record<string, number>): number {
  return Object.values(items).reduce((sum, count) => sum + bagStackSlots(count), 0);
}

/** 往一个分类追加 amount 份某物品，需要新增多少格。 */
export function bagAddSlotCost(items: Record<string, number>, key: string, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return bagStackSlots((items[key] ?? 0) + amount) - bagStackSlots(items[key] ?? 0);
}

export interface BagAddResult {
  ok: boolean;
  used: number;
  slots: number;
  extra: number;
}

/** 分类是否还有足够空格放下这次收获/购买。 */
export function bagAddCheck(
  items: Record<string, number>,
  key: string,
  amount: number,
  level: unknown,
): BagAddResult {
  const slots = backpackSlots(level);
  const used = bagUsedSlots(items);
  const extra = bagAddSlotCost(items, key, amount);
  return { ok: used + extra <= slots, used, slots, extra };
}
