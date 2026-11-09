import { AVATARS, type AvatarId } from "../game/state";

/** 内置形象对应的 VRM 文件；没有配置就退回程序化模型 */
export function builtinModelUrl(id: AvatarId): string | null {
  const option = AVATARS.find((item) => item.id === id);
  if (!option?.model) return null;
  return `${import.meta.env.BASE_URL}avatars/vrm/${option.model}`;
}

/**
 * 本地导入的模型（VRoid 刚导出的 .vrm，或从别处拿到的）。
 * 这是会话级的：刷新页面后失效，不写进存档。
 */
let customUrl: string | null = null;
let customLabel: string | null = null;
const listeners = new Set<(url: string | null) => void>();

export function setCustomModel(url: string | null, label?: string): void {
  if (customUrl && customUrl !== url) URL.revokeObjectURL(customUrl);
  customUrl = url;
  customLabel = label ?? null;
  listeners.forEach((fn) => fn(customUrl));
}

export function getCustomModel(): { url: string | null; label: string | null } {
  return { url: customUrl, label: customLabel };
}

export function onCustomModelChange(fn: (url: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
