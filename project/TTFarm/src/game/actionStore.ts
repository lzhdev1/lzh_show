import { create } from "zustand";
import type { ActionId } from "../scene/rig";
import { ACTIONS, isActionId } from "../scene/actionMotion";

const PREFERRED_KEY = "ttfarm:preferred-action";
const DEFAULT_ACTION: ActionId = "cheer";

function loadPreferred(): ActionId {
  try {
    const stored = localStorage.getItem(PREFERRED_KEY);
    if (stored && isActionId(stored) && !ACTIONS[stored].hidden) return stored;
  } catch { /* 本地存储不可用时退回欢呼 */ }
  return DEFAULT_ACTION;
}

/** current 只镜像正在播放的动作；preferred 是右下角大按钮默认触发的动作。 */
export const useAction = create<{ current: ActionId | null; preferred: ActionId }>(() => ({
  current: null,
  preferred: loadPreferred(),
}));

export function requestAction(id: ActionId) {
  if (!ACTIONS[id].hidden) {
    useAction.setState({ preferred: id });
    try { localStorage.setItem(PREFERRED_KEY, id); } catch { /* ignore */ }
  }
  window.dispatchEvent(new CustomEvent("ttfarm:action", { detail: id }));
}

export function requestStopAction() {
  window.dispatchEvent(new CustomEvent("ttfarm:stop-action"));
}
