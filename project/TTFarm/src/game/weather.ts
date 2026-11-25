export const ELEMENTS = ["thunder", "frost", "flame", "gold", "earth", "wind"] as const;
export const SPIRITS = ["rosette", "nocturne", "coral", "orbit", "bamboo"] as const;
/** 野菜专属变异：阴阳与长生，各三级（星辰数 / 金龙数） */
export const WILD_MUTATIONS = ["yinyang1", "yinyang2", "yinyang3", "longlife1", "longlife2", "longlife3"] as const;
/** 草药专属：金木水火土五行 + 仙品 + 神品 */
export const HERB_MUTATIONS = ["herbMetal", "herbWood", "herbWater", "herbFire", "herbEarth", "xianpin", "shenpin"] as const;
export const HERB_ELEMENTS = ["herbMetal", "herbWood", "herbWater", "herbFire", "herbEarth"] as const;
export type Spirit = typeof SPIRITS[number];
type Element = typeof ELEMENTS[number];
type Legacy = "amber" | "mist" | "pearl";
export type WildMutation = typeof WILD_MUTATIONS[number];
export type HerbMutation = typeof HERB_MUTATIONS[number];
export type Mutation = Element | Spirit | Legacy | WildMutation | HerbMutation;

export const MUTATIONS = {
  thunder: { label: "雷霆", multiplier: 2, fruit: 0x9d76ff, leaf: 0x6585d7 },
  frost: { label: "冰霜", multiplier: 2, fruit: 0x98eaff, leaf: 0x91c9e0 },
  flame: { label: "神火", multiplier: 2, fruit: 0xff8050, leaf: 0xd34d58 },
  gold: { label: "黄金", multiplier: 3, fruit: 0xffd34c, leaf: 0xe4aa48 },
  earth: { label: "大地气息", multiplier: 5, fruit: 0xd39960, leaf: 0x79bf78 },
  wind: { label: "风之息", multiplier: 5, fruit: 0x89f4cf, leaf: 0x52bbab },
  rosette: { label: "花庭舞姬·露茜", multiplier: 8, fruit: 0xef8ba8, leaf: 0xb5c990 },
  nocturne: { label: "月夜骑士·凛", multiplier: 8, fruit: 0x956cc4, leaf: 0x6c7fbd },
  coral: { label: "潮歌巫女·汐音", multiplier: 8, fruit: 0x59cacf, leaf: 0x9cdce4 },
  orbit: { label: "星轨领航员·昴", multiplier: 8, fruit: 0xe49b55, leaf: 0x7dabc6 },
  bamboo: { label: "竹林画师·青砚", multiplier: 8, fruit: 0x83b38b, leaf: 0x61b7a2 },
  // 既有等级和售价随旧收成保留。
  amber: { label: "金穗", multiplier: 2, fruit: 0xffc855, leaf: 0xa7bc62 },
  mist: { label: "雾晶", multiplier: 3, fruit: 0xbda6ef, leaf: 0x73aab5 },
  pearl: { label: "雨珠", multiplier: 2, fruit: 0x80dfdc, leaf: 0x59ad8a },
  // 野菜专属：阴阳（黑白双分 + 星辰环绕）、长生（玉质 + 金龙环绕）。
  yinyang1: { label: "阴阳·一星", multiplier: 4, fruit: 0xe8e6f0, leaf: 0x9aa0b0 },
  yinyang2: { label: "阴阳·二星", multiplier: 8, fruit: 0xe8e6f0, leaf: 0x9aa0b0 },
  yinyang3: { label: "阴阳·三星", multiplier: 16, fruit: 0xe8e6f0, leaf: 0x9aa0b0 },
  longlife1: { label: "长生·一龙", multiplier: 5, fruit: 0x9fdcb8, leaf: 0x7cc9a0 },
  longlife2: { label: "长生·二龙", multiplier: 10, fruit: 0x9fdcb8, leaf: 0x7cc9a0 },
  longlife3: { label: "长生·三龙", multiplier: 20, fruit: 0x9fdcb8, leaf: 0x7cc9a0 },
  // 草药专属：五行按「金木水火土」配色，仙品玉白、神品金黄。
  herbMetal: { label: "金品", multiplier: 4, fruit: 0xffd76a, leaf: 0xd8b25c },
  herbWood:  { label: "木品", multiplier: 4, fruit: 0x8fe07a, leaf: 0x5fa84a },
  herbWater: { label: "水品", multiplier: 4, fruit: 0x7ad8e8, leaf: 0x4f9bb0 },
  herbFire:  { label: "火品", multiplier: 5, fruit: 0xff7a4a, leaf: 0xc94f3f },
  herbEarth: { label: "土品", multiplier: 5, fruit: 0xd9a05a, leaf: 0x9a7a3f },
  xianpin:   { label: "仙品", multiplier: 15, fruit: 0xf4f0ff, leaf: 0xbfe8c8 },
  shenpin:   { label: "神品", multiplier: 30, fruit: 0xffe066, leaf: 0xd8a63a },
} as const;

export const WEATHER = {
  sunny:  { label: "晴天", chance: .22, affinity: ["flame", "gold"], cover: 0 },
  cloudy: { label: "多云", chance: .26, affinity: ["earth", "wind"], cover: .52 },
  rain:   { label: "阵雨", chance: .32, affinity: ["earth", "frost"], cover: .79 },
  snow:   { label: "雪天", chance: .40, affinity: ["frost", "gold"], cover: .59 },
  gale:   { label: "大风天", chance: .36, affinity: ["wind", "earth"], cover: .38 },
  storm:  { label: "雷雨天", chance: .48, affinity: ["thunder", "flame"], cover: 1 },
  fog:    { label: "大雾天", chance: .42, affinity: ["gold", "frost"], cover: .65 },
} as const;
export type WeatherKind = keyof typeof WEATHER;
const kinds = Object.keys(WEATHER) as WeatherKind[];
export const WEATHER_INTERVAL_MS = 180_000;
const INTERVAL = WEATHER_INTERVAL_MS;

function shuffledForecast(block: number) {
  const bag = [...kinds];
  let seed = (block ^ 0x73a411cd) >>> 0;
  for (let i = bag.length - 1; i > 0; i--) {
    seed = (seed + 0x9e3779b9) >>> 0;
    let v = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    v = Math.imul(v ^ (v >>> 15), 0x735a2d97);
    const j = ((v ^ (v >>> 15)) >>> 0) % (i + 1);
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

let lastBlock = NaN;
let forecast: WeatherKind[] = [];
/** 时间种子保证跨设备同天候，每轮洗牌并避开相邻两次同天气。 */
export function weatherAt(now: number): WeatherKind {
  const slot = Math.floor(now / INTERVAL), block = Math.floor(slot / kinds.length);
  if (lastBlock !== block) {
    forecast = shuffledForecast(block);
    if (forecast[0] === shuffledForecast(block - 1)[kinds.length - 1]) {
      [forecast[0], forecast[1]] = [forecast[1], forecast[0]];
    }
    lastBlock = block;
  }
  return forecast[slot - block * kinds.length];
}

export function weatherEndsAt(now: number): number {
  return (Math.floor(now / INTERVAL) + 1) * INTERVAL;
}

export function isRainy(weather: WeatherKind): boolean {
  return weather === "rain" || weather === "storm";
}

export function isMutation(value: unknown): value is Mutation {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MUTATIONS, value);
}

export function isSpirit(value: Mutation): value is Spirit {
  return (SPIRITS as readonly Mutation[]).includes(value);
}

export const SPIRIT_SHARE = .10;

/** 仅在播种时抽签；任何天气都能出现全部新品种。 */
export function rollMutation(weather: WeatherKind, random = Math.random): Mutation | null {
  const { chance, affinity } = WEATHER[weather];
  if (random() >= chance) return null;
  if (random() < SPIRIT_SHARE) return SPIRITS[Math.floor(random() * SPIRITS.length)];
  // 主亲和权重 6，次亲和权重 3，其余各 1。
  let draw = random() * 13;
  for (const element of ELEMENTS) {
    draw -= element === affinity[0] ? 6 : element === affinity[1] ? 3 : 1;
    if (draw < 0) return element;
  }
  return ELEMENTS[ELEMENTS.length - 1];
}

export function isWildMutation(value: Mutation): value is WildMutation {
  return (WILD_MUTATIONS as readonly Mutation[]).includes(value);
}

/** 变异级别：阴阳看星辰数，长生看金龙数，都是 1–3 */
export function wildMutationTier(value: WildMutation): 1 | 2 | 3 {
  return Number(value.slice(-1)) as 1 | 2 | 3;
}

export function wildMutationFamily(value: WildMutation): "yinyang" | "longlife" {
  return value.startsWith("yinyang") ? "yinyang" : "longlife";
}

/**
 * 野菜播种抽签：10% 变异（与普通作物的精灵变异概率对齐），阴阳/长生各半；
 * 级别 68% / 25% / 7%。野菜没有五行变异，这 10% 就是它的全部变异概率。
 */
export const WILD_MUTATION_CHANCE = 0.10;
/** 必中抽签：只决定家族与级别，供野外菜丛生成复用 */
export function pickWildMutation(random = Math.random): WildMutation {
  const family = random() < 0.5 ? "yinyang" : "longlife";
  const tier = random();
  const level = tier < 0.68 ? 1 : tier < 0.93 ? 2 : 3;
  return `${family}${level}` as WildMutation;
}
export function rollWildMutation(random = Math.random): WildMutation | null {
  if (random() >= WILD_MUTATION_CHANCE) return null;
  return pickWildMutation(random);
}

export function isHerbMutation(value: Mutation): value is HerbMutation {
  return (HERB_MUTATIONS as readonly Mutation[]).includes(value);
}

/**
 * 草药播种抽签：五行 20%（相当于普通作物的普通变异），
 * 仙品 / 神品合计 10%，与普通作物的精灵变异概率对齐，二者各半。
 */
export const HERB_MUTATION_CHANCE = 0.20;
export const HERB_SPECIAL_CHANCE = 0.10;
export function rollHerbMutation(random = Math.random): HerbMutation | null {
  const roll = random();
  if (roll < HERB_MUTATION_CHANCE) {
    const draw = Math.min(0.9999, Math.max(0, random()));
    return HERB_ELEMENTS[Math.floor(draw * HERB_ELEMENTS.length)];
  }
  if (roll < HERB_MUTATION_CHANCE + HERB_SPECIAL_CHANCE) {
    return random() < 0.5 ? "xianpin" : "shenpin";
  }
  return null;
}
