import { create } from "zustand";

export type TownNavTarget = "dealer" | null;

interface TownNavState {
  x: number;
  z: number;
  inTown: boolean;
  target: TownNavTarget;
  setPose: (x: number, z: number, inTown: boolean) => void;
  request: (target: TownNavTarget) => void;
  consume: () => TownNavTarget;
  clear: () => void;
}

/** 城内定位与“带我去”导航：场景写坐标，UI 读方向，loop 消费目标。 */
export const useTownNav = create<TownNavState>((set, get) => ({
  x: 0,
  z: 0,
  inTown: false,
  target: null,
  setPose(x, z, inTown) {
    const state = get();
    if (state.inTown === inTown && Math.abs(state.x - x) < 0.45 && Math.abs(state.z - z) < 0.45) return;
    set({ x, z, inTown });
  },
  request(target) {
    set({ target });
  },
  consume() {
    const target = get().target;
    if (target) set({ target: null });
    return target;
  },
  clear() {
    if (get().target) set({ target: null });
  },
}));
