export const ELEMENTS = ["thunder", "frost", "flame", "gold", "earth", "wind"] as const;
export const SPIRITS = ["rosette", "nocturne", "coral", "orbit", "bamboo"] as const;
export type Spirit = typeof SPIRITS[number];
type Element = typeof ELEMENTS[number];
type Legacy = "amber" | "mist" | "pearl";
export type Mutation = Element | Spirit | Legacy;

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
const INTERVAL = 180_000;

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
