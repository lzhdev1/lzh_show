import type { RemoteState } from "../api/client";
import type { CropId } from "./crops";

export function makeSave(overrides: Partial<RemoteState> = {}): RemoteState {
  const plots = Array.from({ length: 30 }, (_, id) => ({
    id,
    unlocked: id < 6,
    crop: null,
    plantedAt: 0,
    watered: 0,
    mutation: null,
  }));
  return {
    revision: 1,
    saveVersion: 8,
    coins: 100,
    xp: 0,
    plots,
    seeds: { radish: 3, cabbage: 2 } as Record<CropId, number>,
    harvest: {},
    meat: {},
    nickname: "测试农场",
    avatarId: "xiaosui",
    selectedSeed: "radish",
    ...overrides,
  };
}
