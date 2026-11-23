import type { RemoteState } from "../api/client";
import { mergeCodexCollections } from "./codexCollection";

// PostgreSQL JSONB may return object properties in another order.
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  return Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every(k => Object.prototype.hasOwnProperty.call(b, k) && equal(a[k], b[k]));
}

/** Preserve independent actions and their inventory deltas as a unit. A competing
 * action on the same plot, herd or insufficient stock must be resolved as a whole. */
export function mergeFarmSave(base: RemoteState, local: RemoteState, remote: RemoteState): RemoteState | null {
  const result = { ...remote, plots: [...remote.plots] };
  for (const field of ["avatarId","outfitId","bottomId","selectedSeed","decor","ranch","forage","garage","backpackLevel","fishingRod"] as const) {
    // 旧客户端草稿不带新字段（如 forage）：视为未改动，保留远端值
    if (local[field] === undefined || equal(base[field], local[field])) continue;
    if (!equal(base[field], remote[field])) return null;
    Object.assign(result, { [field]: local[field] });
  }
  if (base.plots.length !== local.plots.length || result.plots.length !== local.plots.length) return null;
  for (let i = 0; i < local.plots.length; i++) {
    if (equal(base.plots[i], local.plots[i])) continue;
    if (!equal(base.plots[i], remote.plots[i])) return null;
    result.plots[i] = local.plots[i];
  }
  for (const field of ["coins", "xp"] as const) {
    result[field] += local[field] - base[field];
    if (result[field] < 0) return null;
  }
  for (const field of ["seeds", "harvest"] as const) {    const counts: Record<string, number> = { ...remote[field] };
    const before: Record<string, number> = base[field], after: Record<string, number> = local[field];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      counts[key] = (counts[key] ?? 0) + (after[key] ?? 0) - (before[key] ?? 0);
      if (counts[key] < 0) return null;
    }
    Object.assign(result, { [field]: counts });
  }
  // 图鉴只增不减，两端各自收集的条目直接并集，不参与冲突判定。
  const fish: Record<string, number> = { ...(remote.fishCaught ?? {}) };
  {
    const before = base.fishCaught ?? {}, after = local.fishCaught ?? {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      fish[key] = (fish[key] ?? 0) + (after[key] ?? 0) - (before[key] ?? 0);
      if (fish[key] <= 0) delete fish[key];
    }
  }
  result.fishCaught = fish;
  result.codexCollected = mergeCodexCollections(remote.codexCollected, local.codexCollected);
  return result;
}
