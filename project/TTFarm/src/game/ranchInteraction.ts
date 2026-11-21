import { create } from "zustand";
import type { WildAnimal } from "./ranch";

export const useRanchInteraction = create<{ nearbyAnimal: WildAnimal | null; nearRanch: boolean }>()(() => ({
  nearbyAnimal: null, nearRanch: false,
}));

export function setNearbyAnimal(animal: WildAnimal | null) {
  if (useRanchInteraction.getState().nearbyAnimal?.id !== animal?.id) {
    useRanchInteraction.setState({ nearbyAnimal: animal });
  }
}

export function setNearRanch(nearRanch: boolean) {
  if (useRanchInteraction.getState().nearRanch !== nearRanch) useRanchInteraction.setState({ nearRanch });
}
