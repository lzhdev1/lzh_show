import { describe, expect, it } from "vitest";
import { mergeFarmSave } from "./saveMerge";
import { makeSave } from "./testSave";

describe("mergeFarmSave", () => {
  it("merges independent inventory changes including meat", () => {
    const base = makeSave({ meat: { wolf: 1 }, coins: 100 });
    const local = makeSave({ meat: { wolf: 3 }, coins: 80 });
    const remote = makeSave({ meat: { wolf: 2 }, coins: 120 });
    const result = mergeFarmSave(base, local, remote);

    expect(result?.meat).toEqual({ wolf: 4 });
    expect(result?.coins).toBe(100);
  });

  it("matches changed plots by id even when remote array order changes", () => {
    const base = makeSave();
    const local = makeSave();
    const remote = makeSave();
    local.plots[1] = { ...local.plots[1], crop: "radish", plantedAt: 123 };
    remote.plots = [...remote.plots].reverse();

    const result = mergeFarmSave(base, local, remote);

    expect(result?.plots[1].crop).toBe("radish");
    expect(result?.plots.map((plot) => plot.id)).toEqual(remote.plots.map((plot) => plot.id).sort((a, b) => a - b));
  });

  it("rejects duplicate or missing plot ids", () => {
    const base = makeSave();
    const local = makeSave();
    const remote = makeSave();
    remote.plots[1] = { ...remote.plots[1], id: remote.plots[0].id };

    expect(mergeFarmSave(base, local, remote)).toBeNull();
  });

  it("rejects a negative inventory delta instead of producing negative counts", () => {
    const base = makeSave({ harvest: { radish: 10 } });
    const local = makeSave({ harvest: { radish: 2 } });
    const remote = makeSave({ harvest: { radish: 3 } });

    expect(mergeFarmSave(base, local, remote)).toBeNull();
  });

  it("keeps codex and owned rods as monotonic unions", () => {
    const base = makeSave();
    const local = makeSave({ ownedRods: ["bamboo", "stream"], codexCollected: { "plant:radish": true } });
    const remote = makeSave({ ownedRods: ["bamboo", "spirit"], codexCollected: { "plant:cabbage": true } });

    const result = mergeFarmSave(base, local, remote);

    expect(result?.ownedRods).toEqual(["bamboo", "spirit", "stream"]);
    expect(result?.codexCollected).toEqual({ "plant:radish": true, "plant:cabbage": true });
  });
});
