// 账号与存档接口：都挂在主站的 /api/ttfarm 下。
// 开发时由 Vite 的 proxy 透传给同容器的 Next，线上和页面同域，因此不需要拼域名、也没有跨域问题。

const BASE = "/api/ttfarm";

export interface AccountUser {
  id: number;
  username: string;
  nickname: string;
  avatarId: string;
}

export interface RemotePlot {
  id: number;
  unlocked: boolean;
  crop: string | null;
  plantedAt: number;
  watered: number;
}

export interface RemoteState {
  coins: number;
  xp: number;
  plots: RemotePlot[];
  seeds: Record<string, number>;
  harvest: Record<string, number>;
  nickname: string;
  avatarId: string;
  selectedSeed: string;
}

export interface AuthResult {
  token: string;
  user: AccountUser;
  state: RemoteState;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `请求失败（${res.status}）`;
    throw new Error(message);
  }
  return payload as T;
}

export const ttfarmApi = {
  login: (username: string) =>
    request<AuthResult>("/login", { method: "POST", body: JSON.stringify({ username }) }),

  register: (username: string) =>
    request<AuthResult>("/register", { method: "POST", body: JSON.stringify({ username }) }),

  loadState: (token: string) =>
    request<{ state: RemoteState }>("/state", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  saveState: (token: string, state: unknown) =>
    request<{ ok: boolean }>("/state", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state }),
    }),
};
