import { create } from "zustand";
import type { MushroomMutation, MushroomSpecies } from "./mushrooms";

export interface NearbyMushroom {
  id: string;
  species: MushroomSpecies;
  mutation: MushroomMutation;
  seasonKey: number;
  hostLabel: string;
  position: { x: number; z: number };
}

/** 脚边可采的菌子；只对当前刷新阶段有效，不落存档。 */
export const useMushroomInteraction = create<{
  nearby: NearbyMushroom | null;
  taken: string[];
  seasonKey: number;
}>(() => ({ nearby: null, taken: [], seasonKey: -1 }));

export function setNearbyMushroom(mushroom: NearbyMushroom | null) {
  const state = useMushroomInteraction.getState();
  if (state.nearby?.id !== mushroom?.id) useMushroomInteraction.setState({ nearby: mushroom });
}

/** 记录本阶段已经采走的菌，避免天气阶段内重绘时原地复活。 */
export function markMushroomTaken(id: string) {
  const state = useMushroomInteraction.getState();
  if (!state.taken.includes(id)) useMushroomInteraction.setState({ taken: [...state.taken, id] });
  if (state.nearby?.id === id) useMushroomInteraction.setState({ nearby: null });
}

export function resetMushroomSeason(seasonKey: number) {
  const state = useMushroomInteraction.getState();
  if (state.seasonKey !== seasonKey) {
    useMushroomInteraction.setState({ seasonKey, taken: [], nearby: null });
  }
}
