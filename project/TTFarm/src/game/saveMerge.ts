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
  const plotSet = (plots: RemoteState["plots"], ids: Set<number>) => {
    const map = new Map<number, RemoteState["plots"][number]>();
    for (const plot of plots) {
      if (!Number.isSafeInteger(plot.id) || plot.id < 0 || map.has(plot.id) || ids.has(plot.id) === false) return null;
      map.set(plot.id, plot);
    }
    return map;
  };
  const ids = new Set(remote.plots.map((plot) => plot.id));
  if (ids.size !== remote.plots.length) return null;
  const basePlots = plotSet(base.plots, ids) ?? new Map();
  const localPlots = plotSet(local.plots, ids) ?? new Map();
  const remotePlots = plotSet(remote.plots, ids) ?? new Map();
  if (basePlots.size !== ids.size || localPlots.size !== ids.size || remotePlots.size !== ids.size) return null;
  for (const [id, localPlot] of localPlots) {
    const before = basePlots.get(id), current = remotePlots.get(id);
    if (!before || !current) return null;
    if (equal(before, localPlot)) continue;
    if (!equal(before, current)) return null;
    remotePlots.set(id, localPlot);
  }
  result.plots = [...remotePlots.values()].sort((a, b) => a.id - b.id);
  for (const field of ["coins", "xp"] as const) {
    result[field] += local[field] - base[field];
    if (result[field] < 0) return null;
  }
  for (const field of ["seeds", "harvest", "meat", "items", "materials"] as const) {
    const counts: Record<string, number> = { ...(remote[field] ?? {}) };
    const before: Record<string, number> = base[field] ?? {}, after: Record<string, number> = local[field] ?? {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      counts[key] = (counts[key] ?? 0) + (after[key] ?? 0) - (before[key] ?? 0);
      if (counts[key] < 0) return null;
      if (counts[key] === 0) delete counts[key];
    }
    Object.assign(result, { [field]: counts });
  }
  // 鱼竿只增不减，两端买到的直接并集。
  result.ownedRods = Array.from(new Set([...(remote.ownedRods ?? []), ...(local.ownedRods ?? [])]));
  if (local.selectedBait !== undefined) result.selectedBait = local.selectedBait;
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
