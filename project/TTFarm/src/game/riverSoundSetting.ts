export const RIVER_SOUND_CHANGED = "ttfarm:river-sound";
export const RAIN_SOUND_CHANGED = "ttfarm:rain-sound";

function soundPreference(storageKey: string, event: string) {
  let enabled = true;
  try {
    enabled = window.localStorage.getItem(storageKey) !== "off";
  } catch {
    // 隐私模式仍允许在本次游玩中切换声音。
  }
  return {
    get: () => enabled,
    set(value: boolean) {
      enabled = value;
      try {
        window.localStorage.setItem(storageKey, value ? "on" : "off");
      } catch {
        // 无法写入本地偏好时，内存中的开关仍然生效。
      }
      window.dispatchEvent(new Event(event));
    },
  };
}

export const { get: getRiverSoundEnabled, set: setRiverSoundEnabled } =
  soundPreference("ttfarm-river-sound", RIVER_SOUND_CHANGED);
export const { get: getRainSoundEnabled, set: setRainSoundEnabled } =
  soundPreference("ttfarm-rain-sound", RAIN_SOUND_CHANGED);
