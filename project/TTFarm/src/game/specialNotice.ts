import { create } from "zustand";
import { HERB_ELEMENTS, type Mutation } from "./weather";

/** 非普通五行变异：雷霆、冰霜、神火、黄金、大地、风、精灵、阴阳、长生、仙品、神品与旧版变异都算。 */
export function isSpecialVarietyMutation(mutation: Mutation | null): mutation is Mutation {
  return Boolean(mutation) && !(HERB_ELEMENTS as readonly string[]).includes(mutation!);
}

let sequence = 0;
export const useSpecialNotice = create<{ id: number; text: string; announce: (text: string) => void }>((set) => ({
  id: 0,
  text: "",
  announce: (text) => set({ id: ++sequence, text }),
}));

/** 全局播报：地图上任何一个特殊变异作物出现都走这里。 */
export function announceSpecialCrop(name: string) {
  useSpecialNotice.getState().announce(`出现了「${name}」`);
}

// 给浏览器控制台和验收脚本留一个稳定的外部入口，不依赖 React 内部状态。
if (typeof window !== "undefined") {
  const host = window as Window & { __ttfarmSpecialNoticeBound?: boolean };
  if (!host.__ttfarmSpecialNoticeBound) {
    host.__ttfarmSpecialNoticeBound = true;
    window.addEventListener("ttfarm:special", (event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) announceSpecialCrop(detail);
    });
  }
}
