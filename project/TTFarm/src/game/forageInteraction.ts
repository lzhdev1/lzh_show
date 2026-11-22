import { create } from "zustand";
import type { WildPatch } from "./forage";

/** 脚边可采摘的野菜丛，只在当前场景有效，不落存档。 */
export const useForageInteraction = create<{ nearbyPatch: WildPatch | null }>()(() => ({
  nearbyPatch: null,
}));

export function setNearbyPatch(patch: WildPatch | null) {
  if (useForageInteraction.getState().nearbyPatch?.id !== patch?.id) {
    useForageInteraction.setState({ nearbyPatch: patch });
  }
}