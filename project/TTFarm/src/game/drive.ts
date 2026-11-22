import { create } from "zustand";

/**
 * 驾驶模式运行态：UI 发起请求，loop 消费；loop 上下车后回写 driving。
 * 车辆拥有数据在 state.garage，这里只存「这一次」的请求。
 */
interface DriveState {
  requested: string | null;
  driving: boolean;
  start: (id: string) => void;
  stop: () => void;
  setDriving: (value: boolean) => void;
  consume: () => string | null;
}

export const useDrive = create<DriveState>((set, get) => ({
  requested: null,
  driving: false,
  start(id) {
    if (get().driving) return;
    set({ requested: id });
  },
  stop() {
    set({ driving: false, requested: null });
  },
  setDriving(value) {
    set({ driving: value, requested: null });
  },
  consume() {
    const id = get().requested;
    if (id) set({ requested: null });
    return id;
  },
}));
