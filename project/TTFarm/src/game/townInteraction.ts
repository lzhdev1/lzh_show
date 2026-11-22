import { create } from "zustand";

export type TownPlace = "market" | "dealer" | "mart-a" | "mart-b" | null;

interface TownInteraction {
  place: TownPlace;
  martName: string;
  set: (place: TownPlace, martName?: string) => void;
}

/** 场景每帧写入，UI 只在地点变化时重渲染 */
export const useTownInteraction = create<TownInteraction>((set, get) => ({
  place: null,
  martName: "",
  set(place, martName = "") {
    if (get().place === place && get().martName === martName) return;
    set({ place, martName });
  },
}));
