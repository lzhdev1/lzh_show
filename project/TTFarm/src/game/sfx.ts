/** 农场动作音效：用事件把游戏状态与场景层的声音实现解耦，便于单独测状态。 */
export const SFX_EVENT = "ttfarm:sfx";
export const SFX_CHANGED = "ttfarm:sfx-setting";
export type SfxKind = "plant" | "water" | "harvest";

let enabled = true;
try {
  enabled = window.localStorage.getItem("ttfarm-sfx") !== "off";
} catch {
  // 隐私模式无法持久化时，本次游玩仍按默认开启处理。
}

export function getSfxEnabled(): boolean {
  return enabled;
}

export function setSfxEnabled(value: boolean): void {
  enabled = value;
  try {
    window.localStorage.setItem("ttfarm-sfx", value ? "on" : "off");
  } catch {
    // 写不进去也不影响本次开关。
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SFX_CHANGED));
}

/** 仅在动作真正成功后调用，避免点到冷却中的地块也出声。 */
export function emitSfx(kind: SfxKind): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent<SfxKind>(SFX_EVENT, { detail: kind }));
}
