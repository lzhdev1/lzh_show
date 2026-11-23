/** 图鉴收集记录：只增不减，记录“曾经拿到过”，不跟随库存减少。 */
export type CodexCollection = Record<string, true>;

const PREFIXES = ["plant:", "mutation:", "animal:"] as const;
const KEY_BODY = /^[A-Za-z0-9_]+$/;
const MAX_KEYS = 512;

export function codexPlantKey(crop: string): string {
  return `plant:${crop}`;
}
export function codexMutationKey(mutation: string): string {
  return `mutation:${mutation}`;
}
export function codexAnimalKey(species: string): string {
  return `animal:${species}`;
}

function validKey(key: string): boolean {
  if (key.length < 8 || key.length > 64) return false;
  const prefix = PREFIXES.find((item) => key.startsWith(item));
  return Boolean(prefix && KEY_BODY.test(key.slice(prefix.length)));
}

/** 服务端与旧存档入口统一归一化，只接受已知前缀的布尔标记。 */
export function normalizeCodexCollection(raw: unknown): CodexCollection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CodexCollection = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === true && validKey(key)) out[key] = true;
    if (Object.keys(out).length >= MAX_KEYS) break;
  }
  return out;
}

/** 标记一批收集项；没有新增时返回原对象，避免触发无意义的状态更新。 */
export function markCodexCollected(base: CodexCollection, keys: readonly string[]): CodexCollection {
  let next = base;
  for (const key of keys) {
    if (!validKey(key) || next[key]) continue;
    if (next === base) next = { ...base };
    next[key] = true;
  }
  return next;
}

/** 把当前库存与牧场回填为“曾收集”，兼容没有历史记录的旧账号。 */
export function codexFromHoldings(
  seeds: Record<string, number>,
  harvest: Record<string, number>,
  species: readonly string[],
): CodexCollection {
  const keys: string[] = [];
  for (const [crop, count] of Object.entries(seeds)) {
    if (count > 0) keys.push(codexPlantKey(crop));
  }
  for (const [key, count] of Object.entries(harvest)) {
    if (count <= 0) continue;
    const [crop, mutation] = key.split(":");
    if (crop) keys.push(codexPlantKey(crop));
    if (mutation) keys.push(codexMutationKey(mutation));
  }
  for (const animal of species) keys.push(codexAnimalKey(animal));
  return markCodexCollected({}, keys);
}

/** 多端合并只并集，不删除任何一端已经收集的条目。 */
export function mergeCodexCollections(...records: readonly (CodexCollection | undefined)[]): CodexCollection {
  let out: CodexCollection = {};
  for (const record of records) {
    if (!record) continue;
    out = markCodexCollected(out, Object.keys(record));
  }
  return out;
}
