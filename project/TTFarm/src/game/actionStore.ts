import { create } from "zustand";
import type { ActionId } from "../scene/rig";

/** 只镜像 Player 的当前动作用于 UI 高亮；触发一律走事件，避免 UI 直接持有 3D 对象。 */
export const useAction = create<{ current: ActionId | null }>(() => ({ current: null }));

export function requestAction(id: ActionId) {
  window.dispatchEvent(new CustomEvent("ttfarm:action", { detail: id }));
}

export function requestStopAction() {
  window.dispatchEvent(new CustomEvent("ttfarm:stop-action"));
}