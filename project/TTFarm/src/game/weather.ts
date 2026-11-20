export type WeatherKind = "sunny" | "cloudy" | "rain";
export type Mutation = "amber" | "mist" | "pearl";

export const MUTATIONS = {
  amber: { label: "金穗", multiplier: 2, fruit: 0xffc855, leaf: 0xa7bc62 },
  mist: { label: "雾晶", multiplier: 3, fruit: 0xbda6ef, leaf: 0x73aab5 },
  pearl: { label: "雨珠", multiplier: 2, fruit: 0x80dfdc, leaf: 0x59ad8a },
} as const;

export const WEATHER = {
  sunny: { label: "晴天", mutation: "amber", chance: 0.18 },
  cloudy: { label: "多云", mutation: "mist", chance: 0.14 },
  rain: { label: "阵雨", mutation: "pearl", chance: 0.26 },
} as const;

const INTERVAL = 180_000;
const CYCLE: WeatherKind[] = ["sunny", "cloudy", "rain", "cloudy", "sunny", "rain"];

/** 以真实时间推进。刷新、离线和多设备登录时看到同一场天气。 */
export function weatherAt(now: number): WeatherKind {
  return CYCLE[Math.floor(now / INTERVAL) % CYCLE.length];
}

export function weatherEndsAt(now: number): number {
  return (Math.floor(now / INTERVAL) + 1) * INTERVAL;
}

export function isMutation(value: unknown): value is Mutation {
  return value === "amber" || value === "mist" || value === "pearl";
}

/** 一次播种只抽取一次，结果随地块存档。 */
export function rollMutation(weather: WeatherKind): Mutation | null {
  const { chance, mutation } = WEATHER[weather];
  return Math.random() < chance ? mutation : null;
}
