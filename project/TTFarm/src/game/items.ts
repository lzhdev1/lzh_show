import type { FishRarity } from "./fish";
import { FISHING_RODS, rodById } from "./fish";

/** 成长加速卡：一次把指定地块的生长进度提前 N 分钟。 */
export interface BoostCard {
  id: string;
  minutes: number;
  name: string;
  price: number;
  blurb: string;
}

const boostPrice: Record<number, number> = {
  2: 18, 5: 40, 10: 72, 20: 135, 30: 192, 40: 248,
  50: 300, 60: 352, 120: 650, 180: 930, 240: 1180, 300: 1420,
};

export const BOOST_CARDS: readonly BoostCard[] = [2, 5, 10, 20, 30, 40, 50, 60, 120, 180, 240, 300].map((minutes) => ({
  id: `boost-${minutes}`,
  minutes,
  name: `${minutes} 分钟加速卡`,
  price: boostPrice[minutes],
  blurb: minutes < 30 ? "适合催一茬快熟的菜" : minutes < 120 ? "半天到一天的生长量" : "长周期作物的救急卡",
}));

export const BOOST_BY_ID: Record<string, BoostCard> = Object.fromEntries(BOOST_CARDS.map((card) => [card.id, card]));

export function boostCardById(id: unknown): BoostCard | null {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(BOOST_BY_ID, id)
    ? BOOST_BY_ID[id]
    : null;
}

/** 鱼饵：稀有度权重决定更容易吸引哪一档鱼。 */
export interface BaitItem {
  id: string;
  name: string;
  short: string;
  price: number;
  color: string;
  target: string;
  blurb: string;
  weights: Partial<Record<FishRarity, number>>;
}

export const BAITS: readonly BaitItem[] = [
  {
    id: "worm", name: "蚯蚓饵", short: "蚯蚓", price: 8, color: "#b97852",
    target: "麦穗鱼、白条、鲫鱼", blurb: "最朴素的活饵，常见小鱼最爱。",
    weights: { common: 46, uncommon: 8, rare: 0.8 },
  },
  {
    id: "corn", name: "甜玉米饵", short: "玉米", price: 12, color: "#e4bd54",
    target: "鲤鱼、草鱼、鳊鱼", blurb: "甜香耐泡，专守体型偏大的素食鱼。",
    weights: { common: 28, uncommon: 24, rare: 2.2 },
  },
  {
    id: "wheat", name: "麦香饵", short: "麦香", price: 18, color: "#cda76c",
    target: "翘嘴、鳜鱼、鲈鱼", blurb: "麦香雾化快，掠食鱼会循味追上来。",
    weights: { common: 12, uncommon: 34, rare: 6.5, epic: 0.4 },
  },
  {
    id: "redworm", name: "红虫饵", short: "红虫", price: 32, color: "#b94b43",
    target: "银鱼、虹鳟、金鳟", blurb: "冷水鱼无法拒绝的一团红虫。",
    weights: { common: 5, uncommon: 28, rare: 16, epic: 1.2 },
  },
  {
    id: "shrimp", name: "小河虾", short: "河虾", price: 55, color: "#d38b78",
    target: "锦鲤、河豚、白鳝", blurb: "活虾挂钩，专诱肉食和底栖大鱼。",
    weights: { uncommon: 8, rare: 30, epic: 5.5, legendary: 0.4 },
  },
  {
    id: "glow", name: "夜光拟饵", short: "夜光", price: 110, color: "#6c9ed6",
    target: "胭脂鱼、鲥鱼、刀鱼", blurb: "月色下会发幽光，稀有鱼以为是小鱼群。",
    weights: { rare: 12, epic: 22, legendary: 1.4 },
  },
  {
    id: "dragon", name: "龙涎香饵", short: "龙涎", price: 260, color: "#d9ae4d",
    target: "蝴蝶鲤、赤鳞锦鲤、月光银鲟", blurb: "传说级底料，连深水巨物也会被香味惊动。",
    weights: { rare: 3, epic: 14, legendary: 9 },
  },
  {
    id: "universal", name: "万能饵", short: "万能", price: 80, color: "#7d9b6c",
    target: "全鱼种，稀有概率更均衡", blurb: "什么都像一点，什么都不精，胜在稳定。",
    weights: { common: 22, uncommon: 14, rare: 5, epic: 1.8, legendary: 0.5 },
  },
];

export const BAIT_BY_ID: Record<string, BaitItem> = Object.fromEntries(BAITS.map((bait) => [bait.id, bait]));

export function baitById(id: unknown): BaitItem | null {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(BAIT_BY_ID, id)
    ? BAIT_BY_ID[id]
    : null;
}

export interface ShopExtras {
  items: Record<string, number>;
  materials: Record<string, number>;
  ownedRods: string[];
  selectedBait: string | null;
}

export const STARTER_ROD = "bamboo";
const MAX_COUNT = 1_000_000;

const cleanCounts = (raw: unknown, allowed: Set<string>): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) out[key] = Math.min(MAX_COUNT, Math.round(n));
  }
  return out;
};

/** 服务端与本地共用：只接受已定义的商品 id，鱼竿必须真实存在。 */
export function normalizeShopExtras(raw: unknown): ShopExtras {
  const src = raw && typeof raw === "object" ? raw as Partial<ShopExtras> : {};
  const owned = FISHING_RODS.map((rod) => rod.id);
  let ownedRods = Array.isArray(src.ownedRods)
    ? owned.filter((id) => (src.ownedRods as unknown[]).includes(id))
    : [];
  if (ownedRods.length === 0) ownedRods = [STARTER_ROD];
  if (!ownedRods.includes(STARTER_ROD)) ownedRods.unshift(STARTER_ROD);
  return {
    items: cleanCounts(src.items, new Set(BOOST_CARDS.map((card) => card.id))),
    materials: cleanCounts(src.materials, new Set(BAITS.map((bait) => bait.id))),
    ownedRods,
    selectedBait: baitById(src.selectedBait)?.id ?? null,
  };
}

/** 兼容旧存档：已装备的鱼竿必然属于玩家；旧档没有商店字段时给一根入门竿。 */
export function migrateShopExtras(raw: unknown, equippedRod: string | null): ShopExtras {
  const extras = normalizeShopExtras(raw);
  const rod = rodById(equippedRod);
  if (rod && !extras.ownedRods.includes(rod.id)) extras.ownedRods.push(rod.id);
  return extras;
}
