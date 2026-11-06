/** 作物配置表：数值是 demo 用的，后续可整体替换而不影响逻辑 */
export type CropId =
  | "radish"
  | "cabbage"
  | "tomato"
  | "corn"
  | "strawberry"
  | "pumpkin";

export interface CropDef {
  id: CropId;
  name: string;
  /** 种子价格 */
  seedPrice: number;
  /** 每份收成售价 */
  sellPrice: number;
  /** 一次收获产出份数 */
  yields: number;
  /** 成熟所需的真实毫秒（未浇水） */
  growMs: number;
  /** 解锁所需等级 */
  unlockLevel: number;
  /** 收获获得的经验 */
  xp: number;
  /** 果实主色 */
  body: number;
  /** 叶片主色 */
  leaf: number;
}

export const CROPS: Record<CropId, CropDef> = {
  radish: {
    id: "radish",
    name: "萝卜",
    seedPrice: 12,
    sellPrice: 9,
    yields: 2,
    growMs: 40_000,
    unlockLevel: 1,
    xp: 3,
    body: 0xe2557b,
    leaf: 0x5f9d46,
  },
  cabbage: {
    id: "cabbage",
    name: "白菜",
    seedPrice: 20,
    sellPrice: 14,
    yields: 2,
    growMs: 60_000,
    unlockLevel: 1,
    xp: 5,
    body: 0xa8d67f,
    leaf: 0x4c8c3a,
  },
  tomato: {
    id: "tomato",
    name: "番茄",
    seedPrice: 35,
    sellPrice: 16,
    yields: 3,
    growMs: 80_000,
    unlockLevel: 2,
    xp: 7,
    body: 0xe04b34,
    leaf: 0x4f8f3f,
  },
  corn: {
    id: "corn",
    name: "玉米",
    seedPrice: 50,
    sellPrice: 20,
    yields: 3,
    growMs: 110_000,
    unlockLevel: 3,
    xp: 9,
    body: 0xf2c94c,
    leaf: 0x5a9a42,
  },
  strawberry: {
    id: "strawberry",
    name: "草莓",
    seedPrice: 70,
    sellPrice: 26,
    yields: 3,
    growMs: 140_000,
    unlockLevel: 4,
    xp: 12,
    body: 0xe03b3b,
    leaf: 0x4f8f3f,
  },
  pumpkin: {
    id: "pumpkin",
    name: "南瓜",
    seedPrice: 90,
    sellPrice: 55,
    yields: 2,
    growMs: 180_000,
    unlockLevel: 5,
    xp: 18,
    body: 0xef8b2c,
    leaf: 0x5a8f3a,
  },
};

export const CROP_LIST = Object.values(CROPS);

/** 等级阈值：index 即等级 - 1 */
export const LEVEL_XP = [0, 30, 80, 150, 250, 400];

export function levelFromXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i += 1) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  return level;
}

export function nextLevelXp(level: number): number | null {
  return LEVEL_XP[level] ?? null;
}
