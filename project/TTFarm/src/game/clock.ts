import { create } from "zustand";

/** 独立于存档的时钟：只驱动 UI 进度刷新，不写入 localStorage */
export const useClock = create<{ now: number }>()(() => ({ now: Date.now() }));

export function tickClock(now: number): void {
  useClock.setState({ now });
}
